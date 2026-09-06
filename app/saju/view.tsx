import {
  CARD,
} from '../card';
import { CopyLinkButton } from '../copy-link';
import { sajuViewFor } from './request-view';
import {
  ClaimStrengthLegend,
  TOPICS_THE_TABLE_HOLDS,
  placeNowUtterances,
  TOPIC_TABLE_FOOTNOTE,
  UtteranceList,
  said,
} from '../utterances';
import {
  assembleNowText,
  assembleText,
  currentFortuneOf,
  type CurrentFortune,
  type Saju,
  type Utterance,
} from '@/src/lib/saju';
import {
  PillarChart,
} from './pillars';
import {
  StarTable,
} from './stars';
import {
  RelationTable,
} from './relations';
import {
  DaeunTable,
  NowFortune,
  SaeunTable,
  WolunTable,
} from './fortune';
import {
  FortuneTabs,
} from './fortune-tabs';
import {
  ElementChart,
  StrengthMeter,
} from './analysis';
import {
  TimeCorrections,
  Warnings,
} from './corrections';


/**
 * 이 명식에 대해 **말할 수 있는 것** — 문장은 요약, 아래 카드가 근거다.
 *
 * 궁합에서는 손으로 쓴 카드를 발화로 갈아 끼웠다. 여기서는 그러지 않는다 —
 * **원국 카드가 발화보다 자세하기** 때문이다. 세력 막대와 세 기준, 지장간 며칠치,
 * 조후 원문의 조건, 종격 판정의 재료 넷은 한 문장으로 접을 수 없고 접어서도 안 된다.
 * 그래서 역할을 나눈다: 이 카드는 **얼마나 세게 말할 수 있는가**를 들고, 아래 카드들은
 * 그렇게 말하게 해 준 숫자를 든다.
 *
 * **나란히 서는 것이 요점이다.** 억부 문장과 종격 문장이 서로 다른 오행을 가리킬 수
 * 있어서, 종격 여섯 벌이 전부 "억부 후보를 뒤집지 않습니다"를 달고 나간다. 두 문장을
 * 서로 다른 카드에 흩어 두면 그 마디가 무엇을 향한 말인지 보이지 않는다.
 */
function SaidAbout({ utterances }: { utterances: Utterance[] }) {
  return (
    <section className={CARD}>
      <h2 className="text-base font-semibold">이 명식에 대해 말할 수 있는 것</h2>

      <div className="mt-3">
        <UtteranceList utterances={utterances} />
      </div>

      <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
        <ClaimStrengthLegend tail=" 아래 카드들이 그 근거를 숫자로 폅니다." />
      </div>
    </section>
  );
}


const RESULT_LINKS = [
  ['chart', '명식'],
  ['analysis', '분석'],
  ['relations', '관계'],
  ['fortune', '운'],
  ['stars', '신살'],
  ['corrections', '보정'],
] as const;


function ResultNav() {
  return (
    <nav
      aria-label="결과 바로가기"
      className="sticky top-20 z-20 -my-2 overflow-x-auto rounded-xl border border-border bg-surface/95 px-2 py-2 shadow-sm backdrop-blur"
    >
      <ul className="flex min-w-max items-center gap-1">
        {RESULT_LINKS.map(([target, label]) => (
          <li key={target}>
            <a
              href={`#${target}`}
              className="flex min-h-10 items-center rounded-lg px-3 text-sm text-secondary hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}


/**
 * 화면 하나가 그리는 데 필요한 것 — **한 번만 세고 나눠 쓴다.**
 *
 * 세 값 모두 명식과 기준 시각에서만 나온다. 각 칸이 제 손으로 세면 세운 표와 월운
 * 표가 각자 '지금' 을 판정하게 되고, 엔진이 "따로 세면 어긋난다"로 세운 규율이
 * 화면에서 되돌아온다.
 */
export type SajuViewModel = {
  readonly saju: Saju;
  readonly utterances: Utterance[];
  readonly now: CurrentFortune;
  readonly nowText: ReturnType<typeof placeNowUtterances>;
};

/**
 * 명식과 기준 시각에서 그릴 것을 짓는다 — **정의는 여기 하나이고 부르는 쪽이 둘이다.**
 *
 * 서버 화면은 한 번 그리고 마니 그대로 부르고, 익명 계산기는 `useMemo` 로 감싸서
 * 부른다. 계산기는 폼 상태를 들고 있어 **타이핑마다 이 트리를 다시 그리는데**, 그때
 * `assembleText` 가 매번 도는 것은 눈에 보이는 느려짐이다. 그렇다고 이 함수를 화면
 * 안에서 `useMemo` 로 부르면 그 화면이 클라이언트가 되고, 그러면 저장된 사람 화면까지
 * 통째로 브라우저로 간다.
 *
 * 두 벌로 적지 않는 것이 요점이다 — 두 벌이 되면 한쪽만 고쳐지는 날 같은 명식이 두
 * 화면에서 다르게 선다.
 */
export function sajuViewModelOf(saju: Saju, viewedAt: number): SajuViewModel {
  const now = currentFortuneOf(saju, new Date(viewedAt));

  return {
    saju,
    utterances: assembleText(saju),
    now,
    nowText: placeNowUtterances(assembleNowText(now)),
  };
}

/**
 * 서버가 부르는 자리 — 저장한 사람의 상세 화면도 공개 계산기와 같은 결과 구성을 쓴다.
 * 저장된 입력을 주소로 옮기지 않고, 서버가 권한을 확인해 계산한 명식만 받는다.
 *
 * **훅이 없다.** 그래서 이 화면과 그 아래 스물넷은 서버에서 그려지고, 브라우저로 가는
 * 것은 운 탭 하나뿐이다(`FortuneTabs`).
 *
 * 기준 시각은 `sajuViewFor` 가 든다 — 시계를 읽는 자리를 컴포넌트 밖에 둔다.
 */
export async function SajuResult({ saju }: { saju: Saju }) {
  return <SajuView {...(await sajuViewFor(saju))} />;
}

export function SajuView({ saju, utterances, now, nowText }: SajuViewModel) {
  return (
    <div className="flex flex-col gap-6">
      <ResultNav />
      <CopyLinkButton />
      <PillarChart saju={saju} />
      <SaidAbout
        utterances={said(utterances, (topic) => !TOPICS_THE_TABLE_HOLDS.includes(topic))}
      />
      <div id="analysis" className="scroll-mt-20 grid gap-6 lg:grid-cols-2">
        <ElementChart saju={saju} />
        <StrengthMeter saju={saju} />
      </div>
      <RelationTable
        saju={saju}
        coverage={said(utterances, (topic) => topic === TOPIC_TABLE_FOOTNOTE)}
      />
      <NowFortune now={now} text={nowText} />
      {/*
        **표 셋을 여기서 그려서 넘긴다.** 탭은 고르는 일만 하므로 브라우저로 가야 하지만,
        표는 안 가도 된다 — 서버 화면에서는 표가 이미 그려진 채로 탭에 실려 간다.
        탭이 표를 자식으로 부르면 표 셋의 코드가 탭을 따라 브라우저로 간다.
      */}
      <FortuneTabs
        daeun={<DaeunTable saju={saju} now={now} />}
        saeun={<SaeunTable saju={saju} now={now} />}
        wolun={<WolunTable saju={saju} now={now} />}
      />
      <StarTable saju={saju} />
      <TimeCorrections saju={saju} />
      <Warnings saju={saju} />
      {/*
        넘길 자료 패널은 **여기 서지 않는다.**

        「프롬프트 + 자료 복사」·「JSON 내려받기」·「붙여 넣을 분량 46KB」·`relations-v1`
        은 계약을 검산하는 우리에게 필요한 것이지 사주를 보러 온 사람이 쓰는 것이 아니다.

        그 패널은 `/evidence` 에 있었고 **지금은 없다**(ADR 0047) — 로그인 없는 화면이
        프롬프트 모듈을 통째로 짊어지고 있었다. 내부 검증은 `/me/reading/inspect` 하나로
        모였고, 거기서 보는 것은 **실제로 나가는** 프롬프트다.
      */}
    </div>
  );
}
