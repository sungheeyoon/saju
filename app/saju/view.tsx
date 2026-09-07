import { sajuViewFor } from './request-view';
import {
  TOPIC_TABLE_FOOTNOTE,
  said,
} from '../utterances';
import {
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
  NowOverlaps,
  SaeunTable,
  WolunTable,
} from './fortune';
import {
  FortuneTabs,
} from './fortune-tabs';
import {
  ElementChart,
  StrengthMeter,
  YongsinCard,
} from './analysis';
import {
  TimeCorrections,
  Warnings,
} from './corrections';


/**
 * 바로가기 — **화면에 선 차례와 같다.**
 *
 * 다르면 이 줄은 목차가 아니라 또 하나의 메뉴가 된다. 신살이 위로 올라갔으므로 여기서도
 * 위로 온다.
 */
const RESULT_LINKS = [
  ['chart', '명식'],
  ['stars', '신살'],
  ['analysis', '분석'],
  ['yongsin', '용신'],
  ['relations', '관계'],
  ['fortune', '운'],
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

  /*
    **현재운 문장은 더 이상 안 짓는다.** 그것을 세우던 카드가 없어졌다 — 어느 운이
    도는지는 표가 짚고, 겹치는 자리는 `now.overlaps` 가 그대로 든다. 조립기
    (`assembleNowText`)는 지우지 않는다: 시험이 그 계약을 재고 있고, 화면이 안 쓰는
    것과 없어도 되는 것은 다른 말이다.
  */
  return {
    saju,
    utterances: assembleText(saju),
    now,
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

/**
 * 기준 시각을 사람이 읽는 모양으로 — **한국 달력 시각이다**(`viewedOn`).
 *
 * `viewedAt` 을 그대로 찍으면 보는 사람의 시간대로 찍힌다. 절입일에는 시각이 달을
 * 가르므로, 시까지 적어야 같은 날짜에 두 답이 있는 것처럼 보이지 않는다.
 */
function asOf(now: CurrentFortune): string {
  const { year, month, day, hour, minute } = now.viewedOn;
  return `${year}년 ${month}월 ${day}일 ${hour}시 ${minute}분`;
}

export function SajuView({ saju, utterances, now }: SajuViewModel) {
  return (
    <div className="flex flex-col gap-6">
      <ResultNav />
      <PillarChart saju={saju} />
      {/*
        **신살이 여덟 글자 바로 아래 선다.**

        맨 아래에 있었다. 화면이 위에서부터 「무엇을 셌는가 → 그래서 무엇을 쓰는가」로
        내려가는 차례였고 신살은 그 어느 쪽도 아니라 끝에 붙었다. 그런데 여덟 글자 다음에
        사람들이 찾는 것이 그것이다 — 자리를 읽는 표라 명식 표 바로 옆이 제 자리이기도 하다.

        판정은 여전히 안 한다(길흉은 표 밖 한 줄). 위로 온 것은 순서지 무게가 아니다.
      */}
      <StarTable saju={saju} />
      {/*
        **요약 카드는 없다.**

        「이 명식에 대해 말할 수 있는 것」이 여기 있었다. 발화를 모아 문장으로 세우고,
        아래 카드들이 그 근거를 숫자로 편다는 구성이었다. 그런데 그 문장들이 말하는
        억부·조후·종격은 **바로 아래 카드가 같은 말을 더 자세히** 한다 — 익명 화면에서
        결과물은 표다(ADR 0025).

        딱지 범례는 함께 지우지 않고 **용신 카드로 옮겼다.** 「시험」·「참고표」가 붙는
        자리가 거기이고, 범례가 사라지면 아래 카드들이 뜻 모를 기호를 달고 선다.
      */}
      {/*
        **두 카드를 나란히 두지 않는다.** 나란히 세우면 왼쪽은 표 하나로 끝나고 오른쪽은
        그 세 배로 길어서, 둘이 같은 무게로 읽히라고 만든 배치가 오히려 한쪽을 빈칸으로
        만들었다. 폭을 다 쓰면 오행 표의 막대도 길어진다 — 그 막대가 이 카드의 본문이다.
      */}
      <div id="analysis" className="scroll-mt-20 flex flex-col gap-6">
        <ElementChart saju={saju} />
        <StrengthMeter saju={saju} />
      </div>
      <YongsinCard saju={saju} />
      <RelationTable
        saju={saju}
        coverage={said(utterances, (topic) => topic === TOPIC_TABLE_FOOTNOTE)}
      />
      {/*
        **바로가기의 '운' 은 이 묶음을 짚는다.** 전에는 「지금의 운」 카드가 그 자리를
        들었는데 그 카드가 없어졌고, 남은 겹침 칸은 겹칠 것이 없으면 안 선다 — 없을 수
        있는 것에 앵커를 걸면 어떤 명식에서는 바로가기가 아무 데도 안 간다.
      */}
      <div id="fortune" className="scroll-mt-20 flex flex-col gap-6">
        <NowOverlaps now={now} />
        {/*
          **표 셋을 여기서 그려서 넘긴다.** 탭은 고르는 일만 하므로 브라우저로 가야 하지만,
          표는 안 가도 된다 — 서버 화면에서는 표가 이미 그려진 채로 탭에 실려 간다.
          탭이 표를 자식으로 부르면 표 셋의 코드가 탭을 따라 브라우저로 간다.
        */}
        <FortuneTabs
          asOf={asOf(now)}
          daeun={<DaeunTable saju={saju} now={now} />}
          saeun={<SaeunTable saju={saju} now={now} />}
          wolun={<WolunTable saju={saju} now={now} />}
        />
      </div>
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
