import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { analyzeCompatibility } from '@/src/lib/saju';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { CompatView } from '../../compat-view';
import { pairRelationFor } from './actions';
import { PairPicker } from './picker';
import { RelationForNext } from './relation-for-next';
import { CompatHero } from '../../compat-hero';
import { REVISION_REPLACED_NOTE, UnreadableRevisionError } from '../../revision';
import { Halted } from '../halted';
import { payloadForViewer, type PersonPayload } from '../payload';
import { myPrivateReadings, type PrivateReadingEntry } from '../reading/current';
import { ReadingSection } from '../reading/section';

/**
 * 모델 240초 상한이 먼저 끝나 실패를 기록하고, DB 600초 만료보다는 먼저 닫는다.
 *
 * **결과 칸이 서는 화면은 다 이 값을 든다.** 생성은 응답 뒤에 도는데(`after`), 그
 * 콜백이 사는 시간은 그것을 부른 라우트의 상한이다. 여기 없으면 플랫폼 기본값에서
 * 잘리고, 그러면 시도가 열린 채 남아 이 대상이 10분간 잠긴다.
 */
export const maxDuration = 300;

export const metadata = {
  title: '저장한 사람으로 궁합 보기 — 만세력',
  description: '저장해 둔 두 사람을 골라 사이에 성립하는 관계를 봅니다.',
};

/**
 * 저장된 두 사람의 궁합 — **서버가 판본 둘을 읽어 계산한다.**
 *
 * 익명 화면과 갈리는 것은 **입력을 어디서 받는가 하나**여야 한다(ADR 0007 「이행」).
 * 그쪽은 주소의 `#` 뒤에서 읽어 브라우저가 계산하고, 여기는 Person id 둘로 저장된
 * 판본을 읽어 서버가 계산한다. 결과 화면(`CompatView`)은 같은 것을 쓴다.
 *
 * **주소에는 id 둘뿐이다.** 저장된 출생 원문을 fragment 로 옮기지 않는다 — 남이
 * 등록한 가족의 생년월일시가 주소창에 실리는 것은 그 ADR 이 익명 링크에서 막으려던
 * 것과 같은 일이다. id 가 요청 라인에 실리는 것은 괜찮다. 불투명 식별자이고 접근은
 * RLS 가 잠근다.
 *
 * **나 중심이 아니어도 된다.** 엄마×아빠처럼 내가 끼지 않는 조합이 이 화면의
 * 이유다(PRD US 21).
 */
export default async function ManagedCompatPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string | string[]; b?: string | string[] }>;
}) {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const params = await searchParams;
  const a = firstOf(params.a);
  const b = firstOf(params.b);

  const [{ data: account }, { data: edges }] = await Promise.all([
    supabase.from('app_user').select('status, self_person_id').maybeSingle(),
    // 정책이 자기 목록만 내준다. 여기서 `user_id` 를 또 적지 않는다.
    supabase
      .from('user_person_access')
      .select('person_id, local_label')
      .order('created_at', { ascending: true }),
  ]);

  const people = (edges ?? []).map((edge) => ({
    personId: edge.person_id as string,
    label: edge.local_label as string,
    isSelf: edge.person_id === account?.self_person_id,
  }));

  /**
   * 중지된 계정에는 아무것도 안 보인다(정책이 막는다). 그대로 두면 404 로 떨어지는데,
   * 그건 「없는 사람」에게 하는 말이라 여기서는 틀린 말이다.
   */
  const suspended = account !== null && account.status !== 'active';

  /**
   * **그릴 것을 정하기 전에 다 읽는다.**
   *
   * 거절을 화면 안쪽의 컴포넌트에 두면 그 컴포넌트가 그려질 때는 응답이 이미
   * 흘러나가기 시작했을 수 있고, 그러면 404 를 부르고도 200 이 나간다. 없는 사람과
   * 못 보는 사람이 **같은 상태 코드**로 거절되는 것이 이 화면의 약속이라, 그 약속이
   * 렌더 순서에 기대지 않게 여기서 먼저 답을 낸다.
   */
  const outcome = suspended ? null : await pairOutcome(a, b);

  if (suspended) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-8 py-9 sm:py-14">
        <CompatHero mode="saved" />
        <Halted status={account?.status ?? 'suspended'} />
      </main>
    );
  }

  /**
   * **결과는 제 페이지에 선다.**
   *
   * 고르는 칸과 본 궁합 목록과 결과를 한 화면에 쌓아 두면, 다시 찾아온 사람이 자기
   * 결과에 닿기까지 세 덩어리를 지나야 한다. 「무엇을 볼까」와 「무엇이 나왔나」는
   * 다른 물음이므로 자리를 가른다 — 주소는 이미 갈려 있었다(`?a=…&b=…`).
   */
  if (outcome !== null && outcome.kind === 'ok') {
    return <ResultPage outcome={outcome} />;
  }

  return (
    <main className="app-shell flex flex-1 flex-col gap-8 py-9 sm:py-14">
      <CompatHero mode="saved" />

      <div className="flex flex-col gap-6">
        <PairPicker people={people} a={a} b={b} />
        <SeenPairs />
        {outcome !== null && <Result outcome={outcome} />}
      </div>
    </main>
  );
}

/**
 * 두 사람의 결과 하나 — **제목이 곧 누구와 누구인가**다.
 *
 * 사람이 보러 온 것은 읽어 주는 글이다. 그 앞에 표 스물몇 개를 세워 두면 글까지
 * 내려오지 못하므로 판정을 먼저 세우고 사실은 접는다(`foldFacts`).
 */
async function ResultPage({ outcome }: { outcome: Extract<Outcome, { kind: 'ok' }> }) {
  return (
    <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-14">
      <header className="flex flex-col gap-2">
        <Link
          href="/me/compat"
          className="self-start text-sm text-secondary underline underline-offset-2 hover:text-accent"
        >
          ← 다른 궁합 보기
        </Link>
        <p className="eyebrow">궁합</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
          {outcome.first.name} <span className="text-muted">×</span> {outcome.second.name}
        </h1>
      </header>

      <Result outcome={outcome} />
    </main>
  );
}

/**
 * **본 궁합을 다시 찾아가는 자리.**
 *
 * 결과가 사는 주소는 `?a=…&b=…` 이고 둘 다 불투명 uuid 다. 화면을 벗어나면 주소가
 * 사라지고, 사라진 주소를 사람이 기억할 수는 없다 — 저장돼 있는데 **닿을 수 없는 것**은
 * 사용자에게 없는 것과 같다. 두 사람을 다시 고르면 같은 결과가 서기는 하지만, 그러려면
 * 내가 누구와 누구를 봤는지를 먼저 기억해야 한다. 사람이 스물이면 그것은 기억이 아니라
 * 뒤지기다.
 *
 * **고르는 칸 바로 아래**에 둔다. 결과 아래에 두면 긴 풀이를 다 지나야 만나고, 그러면
 * 다시 찾아가려는 사람에게는 없는 것과 같다. 여기는 「무엇을 볼까」를 정하는 자리이고
 * 이 목록도 같은 물음에 답한다.
 *
 * **비어 있으면 아무것도 안 그린다.** 처음 온 사람에게 빈 목록은 할 일이 하나 더 있는
 * 것처럼 보이는데, 고르는 칸이 이미 그 말을 하고 있다.
 */
async function SeenPairs() {
  const seen = await myPrivateReadings();
  if (seen.length === 0) return null;

  return (
    <section className={`${CARD} flex flex-col gap-3`}>
      <div>
        <h2 className="text-base font-semibold">본 궁합</h2>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          만들어 둔 풀이가 그대로 남아 있습니다. 눌러서 다시 보세요.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {seen.map((one) => (
          <SeenPair key={`${one.personA}:${one.personB}`} entry={one} />
        ))}
      </ul>
    </section>
  );
}

function SeenPair({ entry }: { entry: PrivateReadingEntry }) {
  return (
    <li>
      <Link
        href={`/me/compat?a=${entry.personA}&b=${entry.personB}`}
        className="flex items-center gap-3 rounded-xl border border-border-strong bg-surface px-4 py-3 text-sm hover:border-accent hover:text-accent"
      >
        <span className="min-w-0 flex-1 truncate font-medium">
          {entry.labelA} <span className="text-muted">×</span> {entry.labelB}
        </span>
        {entry.score !== null && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-accent">
            {entry.score}
            <span className="ml-0.5 text-xs font-normal text-muted">점</span>
          </span>
        )}
        {/*
          **낡았다는 것을 목록에서도 말한다.** 열어 봐야 알게 되면, 목록은 「지금 입력으로
          본 것」과 「그 뒤에 고친 입력으로 다시 봐야 하는 것」을 같은 줄로 보이게 된다.
          색만으로 말하지 않는다 — 낱말이 함께 있어야 한다.
        */}
        {!entry.fromCurrentRevision && (
          <span className="shrink-0 rounded-full bg-warning-wash px-2 py-0.5 text-[11px] font-semibold text-warning">
            이전 입력
          </span>
        )}
        <time dateTime={entry.createdAt} className="shrink-0 text-xs text-muted">
          {seenAt(entry.createdAt)}
        </time>
      </Link>
    </li>
  );
}

/** 날짜만 — 목록에서 분 단위는 읽는 데 방해만 된다 */
const seenAt = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

/** 주소에 같은 이름이 두 번 오면 앞의 것만 읽는다 — 뒤의 것으로 조용히 바뀌지 않게 */
const firstOf = (value: string | string[] | undefined): string | null =>
  (Array.isArray(value) ? value[0] : value) ?? null;

/**
 * 두 사람을 고르는 자리 — **평범한 GET 폼이다.**
 *
 * 자바스크립트가 하는 일이 없다. 고른 결과가 곧 주소(`?a=…&b=…`)이고 그 주소가
 * 곧 화면이므로, 상태를 들고 있다가 옮겨 줄 컴포넌트가 필요하지 않다.
 */
type Outcome =
  | { kind: 'empty' }
  | { kind: 'same' }
  | { kind: 'unreadable'; message: string }
  | {
      kind: 'ok';
      first: PersonPayload;
      second: PersonPayload;
      /**
       * 이 쌍의 Person id — **판본을 다 읽은 뒤에만 존재한다.**
       *
       * 주소에서 곧장 꺼내 쓰지 않는 까닭이 있다. 결과 슬롯이 AI 풀이 대상을 들려면
       * 그 대상은 **실제로 읽힌 두 사람**이어야 한다. 주소의 값을 그대로 쓰면 못 읽는
       * 판본이나 못 보는 사람에게도 풀이 버튼이 서고, 눌러야 거절을 만난다.
       */
      pair: { personA: string; personB: string };
      /**
       * 결과를 **보는** 시각(ms) — 판본을 읽은 그때다.
       *
       * 엔진은 지금을 스스로 묻지 않고(`NOW_POLICY.viewingInstant`) 넘겨받는다.
       * 부르는 자리를 그리는 도중이 아니라 읽는 자리에 두는 것은, 같은 요청 안에서
       * 두 번 그려도 같은 답이 나와야 하기 때문이다.
       */
      viewedAt: number;
    };

async function pairOutcome(a: string | null, b: string | null): Promise<Outcome> {
  if (a === null || b === null) return { kind: 'empty' };

  /**
   * 같은 사람 둘은 궁합이 아니다.
   *
   * 없는 사람·못 보는 사람과 달리 이것은 **주소만 보고도 아는 사실**이라 따로 말해도
   * 아무것도 새어 나가지 않는다.
   */
  if (a === b) return { kind: 'same' };

  let payloads;
  try {
    payloads = await Promise.all([payloadForViewer(a), payloadForViewer(b)]);
  } catch (error) {
    /**
     * 못 읽는 판본은 **기본값으로 메우지 않는다.** 저장된 값은 그대로 있고 읽는
     * 쪽이 못 읽는 것이므로, 그렇게 말하고 멈춘다(`/me` 와 같은 규율).
     */
    if (error instanceof UnreadableRevisionError) return { kind: 'unreadable', message: error.message };
    throw error;
  }

  const [first, second] = payloads;

  /**
   * **없는 사람과 못 보는 사람을 같은 말로 거절한다.**
   *
   * 갈리면 응답 차이만으로 그 Person 이 실재하는지 알아낼 수 있다. 여기서 두 경우가
   * 같아지는 것은 문장을 맞춰 적어서가 아니라 **답이 한 자리에서 나오기 때문**이다 —
   * `payloadForViewer` 는 둘 다 `null` 을 내고, 그 `null` 을 응답으로 바꾸는 곳이
   * 이 한 줄뿐이다. HTTP 상태·문장·화면 종류·응답 구조 넷이 그래서 같다.
   */
  if (first === null || second === null) notFound();

  return { kind: 'ok', first, second, pair: { personA: a, personB: b }, viewedAt: Date.now() };
}

async function Result({ outcome }: { outcome: Outcome }) {
  /**
   * **아직 안 골랐으면 아무것도 안 그린다.**
   *
   * 「두 사람을 골라 주세요」 카드가 고르는 칸 바로 아래 서 있었다. 같은 말을 두 번
   * 하는 자리이고, 처음 온 사람에게는 할 일이 하나 더 있는 것처럼 보인다.
   */
  if (outcome.kind === 'empty') return null;

  if (outcome.kind === 'same') {
    return (
      <p role="alert" className={`${CARD} text-sm`}>
        같은 사람을 두 번 고를 수는 없습니다. 서로 다른 두 사람을 골라 주세요.
      </p>
    );
  }

  if (outcome.kind === 'unreadable') {
    return (
      <section className={`${CARD} flex flex-col gap-2`}>
        <p className="text-sm">{outcome.message}</p>
        <p className="text-xs text-muted">
          저장된 값은 그대로 있습니다. 지금 화면이 그 값을 읽지 못하는 것입니다.
        </p>
      </section>
    );
  }

  const { first, second } = outcome;

  /**
   * **이 쌍에 적어 둔 사이** — 다시 풀이받을 때 고칠 수 있게 칸에 세운다.
   *
   * 못 읽으면 칸을 안 세운다. 「모른다」로 세워 두면 화면이 저장된 값과 다른 말을
   * 하게 되고, 사용자는 자기가 답한 적 없는 값을 보고 답한 줄 안다.
   */
  const stored = await pairRelationFor(outcome.pair.personA, outcome.pair.personB);

  return (
    <CompatView
      charts={{ a: first.saju, b: second.saju }}
      compat={analyzeCompatibility(first.saju, second.saju)}
      names={{ a: first.name, b: second.name }}
      viewedAt={outcome.viewedAt}
      /**
       * 비공개 궁합의 결과 슬롯 — **자기 풀이·공유 궁합과 같은 칸을 쓴다**(`ReadingSection`).
       *
       * 이 자리가 비어 있는 동안 화면은 관계 스물몇 개를 세워 놓고 **읽어 주는 버튼이
       * 없었다.** 파이프라인은 처음부터 세 kind 를 다 받았고(`ReadingTarget`), 쌍의 차례도
       * DB 가 정한다(`least`·`greatest`) — 막혀 있던 것은 화면 한 줄뿐이었다.
       */
      foldFacts
      verdict={
        <ReadingSection
          key="private-reading"
          target={{ kind: 'private', ...outcome.pair }}
          layout="page"
          /**
           * **사이를 고치는 칸이 만드는 버튼 옆에 선다.**
           *
           * 고르는 칸에서만 물었으므로, 처음에 안 골랐거나 잘못 고른 사람은 바꿀
           * 길이 없었다. 「읽기 전에 묻는다」(ADR 0019)는 그대로다 — 이 칸이 바꾸는
           * 것은 지금 서 있는 글이 아니라 **다음 글**이고, 그래서 버튼 옆이다.
           */
          ask={
            stored.ok ? (
              <RelationForNext
                key="relation-for-next"
                personA={outcome.pair.personA}
                personB={outcome.pair.personB}
                initial={stored.relation}
              />
            ) : undefined
          }
        />
      }
      notice={
        /*
          **키를 단다.** 이 원소는 서버 컴포넌트가 만들어 클라이언트 컴포넌트
          (`CompatView`)의 자식 배열로 건너간다. 경계를 넘어온 원소는 `jsx` 가 달아 두는
          「검사했다」 표시를 잃으므로, 정적인 자리에 서 있어도 React 가 키를 찾는다.
        */
        <p key="revision-notice" className="text-xs text-muted">
          <strong className="font-medium">현재 저장된 출생정보 기준입니다.</strong>{' '}
          {REVISION_REPLACED_NOTE}
        </p>
      }
    />
  );
}
