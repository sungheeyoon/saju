import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';
import { RELATION_LABEL } from '@/src/lib/people';
import { analyzeCompatibility, STEM_INFO, type Element } from '@/src/lib/saju';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { CompatView } from '../../compat-view';
import { MatchResult } from '../../compat-match';
import { ScoringNote } from '../../match-index';
import { pairRelationFor } from './actions';
import { CompatHero } from '../../compat-hero';
import { INPUT_EDIT_REPLACED_NOTE } from '@/src/lib/input/edit';
import { UNREADABLE_INPUT_NOTE } from '@/src/lib/input/stored';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { payloadForViewer, type PersonPayload } from '../payload';
import { ReadingSection } from '../reading/section';
import { elementScope } from '../../element-tone';
import { BUTTON_TERTIARY } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icon';
import { TYPE_META, TYPE_TITLE } from '../../ui/surfaces';

/**
 * 모델 240초 상한이 먼저 끝나 실패를 기록하고, DB 600초 만료보다는 먼저 닫는다.
 *
 * **결과 칸이 서는 화면은 다 이 값을 든다.** 생성은 응답 뒤에 도는데(`after`), 그
 * 콜백이 사는 시간은 그것을 부른 라우트의 상한이다. 여기 없으면 플랫폼 기본값에서
 * 잘리고, 그러면 시도가 열린 채 남아 이 대상이 10분간 잠긴다.
 */
export const maxDuration = 300;

export const metadata = {
  title: '궁합',
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
 * 이유다(`prd-archive` US 21).
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

  /* 고를 사람 목록은 여기서 안 읽는다 — 고르는 자리가 `/compat` 으로 갔다(ADR 0054) */
  const { state } = await readAccount(supabase);

  /**
   * 중지된 계정에는 아무것도 안 보인다(정책이 막는다). 그대로 두면 404 로 떨어지는데,
   * 그건 「없는 사람」에게 하는 말이라 여기서는 틀린 말이다.
   */
  const blocked = isBlocked(state);

  /**
   * **그릴 것을 정하기 전에 다 읽는다.**
   *
   * 거절을 화면 안쪽의 컴포넌트에 두면 그 컴포넌트가 그려질 때는 응답이 이미
   * 흘러나가기 시작했을 수 있고, 그러면 404 를 부르고도 200 이 나간다. 없는 사람과
   * 못 보는 사람이 **같은 상태 코드**로 거절되는 것이 이 화면의 약속이라, 그 약속이
   * 렌더 순서에 기대지 않게 여기서 먼저 답을 낸다.
   */
  const outcome = blocked ? null : await pairOutcome(a, b);

  if (blocked) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-8 sm:gap-8 sm:py-12">
        <CompatHero />
        <AccountNotice state={state} />
      </main>
    );
  }

  /**
   * **결과는 제 페이지에 선다.**
   *
   * 고르는 칸과 결과를 한 화면에 쌓아 두면, 다시 찾아온 사람이 자기 결과에 닿기까지
   * 두 덩어리를 지나야 한다. 「무엇을 볼까」와 「무엇이 나왔나」는 다른 물음이므로
   * 자리를 가른다 — 주소는 이미 갈려 있었다(`?a=…&b=…`).
   */
  if (outcome !== null && outcome.kind === 'ok') {
    return <ResultPage outcome={outcome} />;
  }

  /**
   * **인자 없이 열리면 고르는 자리로 보낸다.**
   *
   * 여기 「본 궁합」 목록이 서 있었다. 다시 찾아오는 길이라는 까닭이었는데, **풀이 목록
   * (`/me/readings`)이 이미 그 일을 더 잘 한다** — 궁합 줄에 점수와 한 줄 비유와
   * 「이전 명식」 딱지와 날짜까지 선다. 같은 목록이 두 자리에 있으면 한쪽만 고쳐지는
   * 날이 오고, 그날 두 화면은 서로 다른 것을 말한다(ADR 0033).
   *
   * 주소는 살려 둔다. 이 화면으로 오는 옛 길이 있었고(풀이 목록의 빈 상태·사람을 못
   * 찾은 자리), 그 링크가 404 를 만나는 것보다 **시작하는 자리로 이어지는 것**이 맞다.
   */
  if (outcome === null || outcome.kind === 'empty') redirect('/compat');

  /**
   * **거절은 그 자리에서 말한다.** 같은 사람 둘(`same`)과 못 읽은 판본(`unreadable`)은
   * 주소가 무언가를 가리키고 있는데 결과가 안 나는 경우다. 고르는 자리로 되돌려 보내면
   * 사용자는 **왜 되돌아왔는지 모른 채** 같은 주소를 다시 누른다.
   */
  return (
    <main className="app-shell flex flex-1 flex-col gap-6 py-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <Link href="/compat" className={`${BUTTON_TERTIARY} -ml-1 self-start`}>
          <Icon name="back" className="size-4" />
          궁합 보러 가기
        </Link>
        <p className="text-[13px] font-semibold text-secondary">궁합</p>
        <h1 className={TYPE_TITLE}>궁합을 볼 수 없습니다</h1>
      </header>

      <Result outcome={outcome} />
    </main>
  );
}

/**
 * 두 사람의 결과 하나 — **제목이 곧 누구와 누구인가**다.
 *
 * **만세력이 먼저 서고 만드는 버튼은 그 아래다**(ADR 0036). 고르는 칸이 곧장 모델을
 * 부르던 동안 사용자는 만세력을 보기 전에 풀이권을 썼다. 이제 고르면 이 화면이 서고,
 * 여기서 한 번 더 눌러야 글이 난다 — `/` 와 `/compat` 이 이미 그 모양이다.
 *
 * 그 앞에 표 스물몇 개를 세워 두면 글까지 내려오지 못하므로 **관계표는 접어 둔다**
 * (`analysis="folded"`). 서는 것은 여덟 글자다 — 표는 우리가 대조하는 값이라 없애지
 * 않고 접는다(ADR 0035). 접이칸이 살던 화면(`/compat` 의 결과)이 이 자리로 합쳐지면서
 * 그 값이 갈 곳이 여기뿐이다.
 */
async function ResultPage({ outcome }: { outcome: Extract<Outcome, { kind: 'ok' }> }) {
  return (
    <main className="app-shell flex flex-1 flex-col gap-6 py-8 sm:py-12">
      <header className="flex flex-col gap-3">
        {/* 되돌아가는 자리는 **만든 풀이 목록**이다 — 이 궁합도 거기 한 줄로 선다 */}
        <Link href="/me/readings" className={`${BUTTON_TERTIARY} -ml-1 self-start`}>
          <Icon name="back" className="size-4" />
          만든 풀이 목록
        </Link>
        <div className="flex items-center gap-4">
          <PairMark elements={[elementOf(outcome.first), elementOf(outcome.second)]} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-secondary">궁합</p>
            <h1 className={`${TYPE_TITLE} break-words`}>
              {outcome.first.name} <span className="text-secondary">×</span> {outcome.second.name}
            </h1>
          </div>
        </div>
      </header>

      <Result outcome={outcome} />
    </main>
  );
}

const elementOf = (payload: PersonPayload): Element => STEM_INFO[payload.saju.pillars.dayMaster].element;

/**
 * **두 사람의 표식** — 두 원이 살짝 겹쳐 선다(홈의 관계 지도에서 두 사람을 잇는 말투). 각 원은 그 사람의 일간
 * 색과 상징이다. 그림이라 보조기기에는 안 읽히고, 누구와 누구인지는 바로 옆 제목이 든다.
 */
function PairMark({ elements }: { elements: readonly [Element, Element] }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center">
      {elements.map((element, index) => (
        <span
          key={index}
          className={`${elementScope(element)} grid size-12 place-items-center rounded-full bg-[var(--tile)] ring-4 ring-background sm:size-14 ${
            index === 1 ? '-ml-3' : ''
          }`}
        >
          <ElementSymbol element={element} className="size-7 sm:size-8" />
        </span>
      ))}
    </span>
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

  const [one, other] = await Promise.all([payloadForViewer(a), payloadForViewer(b)]);

  /**
   * **없는 사람과 못 보는 사람을 같은 말로 거절한다.**
   *
   * 갈리면 응답 차이만으로 그 Person 이 실재하는지 알아낼 수 있다. 여기서 두 경우가
   * 같아지는 것은 문장을 맞춰 적어서가 아니라 **답이 한 자리에서 나오기 때문**이다 —
   * `payloadForViewer` 는 둘 다 `null` 을 내고, 그 `null` 을 응답으로 바꾸는 곳이
   * 이 한 줄뿐이다. HTTP 상태·문장·화면 종류·응답 구조 넷이 그래서 같다.
   */
  if (one === null || other === null) notFound();

  /**
   * 못 읽는 입력은 **기본값으로 메우지 않는다.** 저장된 값은 그대로 있고 읽는
   * 쪽이 못 읽는 것이므로, 그렇게 말하고 멈춘다(`/me` 와 같은 규율).
   *
   * 한쪽만 못 읽어도 궁합은 못 선다 — 두 명식이 다 있어야 맞대어 볼 수 있다.
   */
  const unreadable = [one, other].find((view) => view.kind === 'unreadable-input');
  if (unreadable !== undefined && unreadable.kind === 'unreadable-input') {
    return { kind: 'unreadable', message: unreadable.message };
  }

  if (one.kind !== 'ok' || other.kind !== 'ok') notFound();

  return {
    kind: 'ok',
    first: one.payload,
    second: other.payload,
    pair: { personA: a, personB: b },
  };
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
      <p role="alert" className={`${CARD} text-[15px] leading-6`}>
        같은 사람을 두 번 고를 수는 없습니다. 서로 다른 두 사람을 골라 주세요.
      </p>
    );
  }

  if (outcome.kind === 'unreadable') {
    return (
      <section className={`${CARD} flex flex-col gap-2`}>
        <p className="text-[15px]">{outcome.message}</p>
        <p className={TYPE_META}>{UNREADABLE_INPUT_NOTE}</p>
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
      /**
       * 비공개 궁합의 결과 슬롯 — **자기 풀이·공유 궁합과 같은 칸을 쓴다**(`ReadingSection`).
       *
       * 이 자리가 비어 있는 동안 화면은 관계 스물몇 개를 세워 놓고 **읽어 주는 버튼이
       * 없었다.** 파이프라인은 처음부터 세 kind 를 다 받았고(`ReadingTarget`), 쌍의 차례도
       * DB 가 정한다(`least`·`greatest`) — 막혀 있던 것은 화면 한 줄뿐이었다.
       */
      analysis="folded"
      verdict={
        <>
          {/*
            **두 길이 같은 차례로 선다** — 두 명식 → 베타 지표 → 사이 → 만드는 버튼.
            직접 입력 화면에도 이 칸이 있었는데 여기만 없어서, 같은 흐름을 지나온
            사람이 화면마다 다른 것을 보고 있었다.

            셈은 브라우저에서 난다(`MatchResult`). 내 사람들의 명식이라 브라우저가
            들고 있어도 되는 자리이고, 부르는 함수는 저쪽과 같다(ADR 0010).
          */}
          <MatchResult
            key="match-index"
            charts={{ a: first.saju, b: second.saju }}
            compat={analyzeCompatibility(first.saju, second.saju)}
            names={{ a: first.name, b: second.name }}
          />
          <ScoringNote key="scoring-note" />
          <ReadingSection
            key="private-reading"
            target={{ kind: 'private', ...outcome.pair }}
            layout="page"
            /**
             * **여기서는 사이를 다시 묻지 않는다**(ADR 0054).
             *
             * 물음은 두 사람을 고르는 자리에 있다 — 「사이에 따라 방향을 달리 잡겠다」가
             * 까닭이므로 읽기 전에 물어야 뜻이 있고(ADR 0019), 그 자리가 이미 읽기
             * 전이다. 한 흐름에서 두 번 물으면 사용자는 서로 다른 두 물음으로 읽는다.
             *
             * 대신 **무엇으로 읽는지는 적는다.** 이 값이 글의 방향을 바꾸는데 화면에
             * 안 서면, 사용자는 자기가 무엇을 골랐는지 모른 채 만드는 버튼을 누른다.
             * 고치는 길은 두 사람을 고르는 자리다.
             */
            ask={
              stored.ok && stored.relation !== null ? (
                <p key="relation-line" className="text-[13px] leading-5 text-secondary">
                  <strong className="font-semibold text-foreground">
                    {RELATION_LABEL[stored.relation]}
                  </strong>{' '}
                  사이로 읽어 드립니다. 바꾸시려면 두 사람을 고르는 자리에서 다시 고르세요.
                </p>
              ) : undefined
            }
          />
        </>
      }
      notice={
        /*
          **키를 단다.** 이 원소는 서버 컴포넌트가 만들어 클라이언트 컴포넌트
          (`CompatView`)의 자식 배열로 건너간다. 경계를 넘어온 원소는 `jsx` 가 달아 두는
          「검사했다」 표시를 잃으므로, 정적인 자리에 서 있어도 React 가 키를 찾는다.
        */
        <p key="input-edit-notice" className="text-[13px] leading-5 text-secondary">
          <strong className="font-semibold text-foreground">현재 저장된 출생 정보 기준입니다.</strong>{' '}
          {INPUT_EDIT_REPLACED_NOTE}
        </p>
      }
    />
  );
}
