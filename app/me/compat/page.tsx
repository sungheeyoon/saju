import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { analyzeCompatibility } from '@/src/lib/saju';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { CompatView } from '../../compat-view';
import { REVISION_REPLACED_NOTE, UnreadableRevisionError } from '../../revision';
import { payloadForViewer, type PersonPayload } from '../payload';
import { ReadingSection } from '../reading/section';

/** 이 페이지의 Reading Server Action 이 플랫폼 기본 상한에 먼저 잘리지 않게 한다. */
export const maxDuration = 300;

export const metadata = {
  title: '저장된 사람끼리 궁합 — 만세력',
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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">저장된 사람끼리 궁합</h1>
        <p className="max-w-2xl text-sm text-secondary">
          저장해 둔 사람 둘을 고르면 <strong className="font-medium">사이에</strong> 성립하는
          형충회합과 오행 보완을 봅니다. 내가 끼지 않는 조합도 됩니다.
        </p>
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href="/me" className="text-accent underline underline-offset-2">
            내 사주
          </Link>
          <Link href="/me/people" className="text-accent underline underline-offset-2">
            등록한 사람
          </Link>
          <Link href="/me/discovery" className="text-accent underline underline-offset-2">
            후보
          </Link>
        </p>
      </header>

      {suspended ? (
        <p className="text-sm text-muted">
          중지된 계정입니다. 저장된 자료는 그대로 있고, 지금은 열어 볼 수 없습니다.
        </p>
      ) : (
        <>
          <PairPicker people={people} a={a} b={b} />
          {outcome !== null && <Result outcome={outcome} />}
        </>
      )}
    </main>
  );
}

/** 주소에 같은 이름이 두 번 오면 앞의 것만 읽는다 — 뒤의 것으로 조용히 바뀌지 않게 */
const firstOf = (value: string | string[] | undefined): string | null =>
  (Array.isArray(value) ? value[0] : value) ?? null;

/**
 * 두 사람을 고르는 자리 — **평범한 GET 폼이다.**
 *
 * 자바스크립트가 하는 일이 없다. 고른 결과가 곧 주소(`?a=…&b=…`)이고 그 주소가
 * 곧 화면이므로, 상태를 들고 있다가 옮겨 줄 컴포넌트가 필요하지 않다.
 */
function PairPicker({
  people,
  a,
  b,
}: {
  people: { personId: string; label: string; isSelf: boolean }[];
  a: string | null;
  b: string | null;
}) {
  if (people.length < 2) {
    return (
      <section className={`${CARD} bg-surface-sunken`}>
        <h2 className="text-base font-semibold">고를 사람이 아직 둘이 아닙니다</h2>
        <p className="mt-1.5 text-sm text-secondary">
          가족이나 친구를 등록하면 여기서 고를 수 있습니다.{' '}
          <Link href="/me/people" className="text-accent underline underline-offset-2">
            사람 등록하기
          </Link>
        </p>
      </section>
    );
  }

  return (
    <form method="get" action="/me/compat" className={`${CARD} flex flex-wrap items-end gap-3`}>
      {(['a', 'b'] as const).map((side) => (
        <label key={side} className="flex flex-col gap-1.5">
          <span className="text-xs text-secondary">{side === 'a' ? '첫 번째' : '두 번째'}</span>
          <select
            name={side}
            defaultValue={(side === 'a' ? a : b) ?? ''}
            required
            className="h-11 rounded-md border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash sm:h-10"
          >
            <option value="" disabled>
              고르기
            </option>
            {people.map((person) => (
              <option key={person.personId} value={person.personId}>
                {person.label}
                {person.isSelf ? ' (나)' : ''}
              </option>
            ))}
          </select>
        </label>
      ))}

      <button
        type="submit"
        className="h-11 rounded-md bg-accent-strong px-5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 sm:h-10"
      >
        궁합 보기
      </button>
    </form>
  );
}

/**
 * 고른 둘이 무엇인가 — **화면을 그리기 전에 답이 나온다.**
 *
 * 못 보는 사람은 여기서 `notFound()` 로 끝난다.
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

  return { kind: 'ok', first, second, viewedAt: Date.now() };
}

function Result({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === 'empty') {
    return (
      <section className={`${CARD} bg-surface-sunken`}>
        <h2 className="text-base font-semibold">두 사람을 골라 주세요</h2>
        <p className="mt-1.5 text-sm text-secondary">
          고른 두 사람의 <strong className="font-medium">지금 저장된</strong> 출생정보로
          계산합니다.
        </p>
      </section>
    );
  }

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

  return (
    <CompatView
      charts={{ a: first.saju, b: second.saju }}
      compat={analyzeCompatibility(first.saju, second.saju)}
      names={{ a: first.name, b: second.name }}
      viewedAt={outcome.viewedAt}
      /*
        로그인 화면에서는 사실 아래에 **현재 결과**가 선다. 익명 화면의 `match-v0`
        카드는 여기 서지 않는다 — 점수가 둘이면 무엇을 믿을지 사용자가 정해야 한다.
      */
      verdict={
        <ReadingSection
          target={{ kind: 'private', personA: first.personId, personB: second.personId }}
        />
      }
      notice={
        <p className="text-xs text-muted">
          <strong className="font-medium">현재 저장된 출생정보 기준입니다.</strong>{' '}
          {REVISION_REPLACED_NOTE}
        </p>
      }
    />
  );
}
