import type { ReactNode } from 'react';

import {
  ELEMENT_KO,
  GENDER_KO,
  STEM_INFO,
  type Compatibility,
  type CompatSide,
  type Saju,
} from '@/src/lib/saju';

import { BetweenSections } from './between-view';

import { elementScope } from './element-tone';
import { DayMasterChip, PillarStrip } from './me/people/chart-bits';
import { sharedPillarChartOf, type SharedPillarChart } from './shared-pillar';
import { ElementSymbol } from './ui/element-symbol';
import { TILE, TYPE_META, TYPE_NAME, TYPE_SECTION } from './ui/surfaces';

/**
 * 궁합 **결과 영역** — 계산이 끝난 값만 받는다.
 *
 * 부르는 자리는 `/me/compat` 하나다. 저장된 판본 둘을 서버가 읽어 계산하고 여기는 그리기만 한다 — 누름도
 * 상태도 없어서 서버 컴포넌트로 선다. 두 명식 전체(`Saju`)는 서버에서 여덟 글자로 잘린 뒤에만 그려지고,
 * 브라우저로는 그려진 결과만 간다(2026-09-25 전에는 `'use client'` 라 두 명식과 관계 표 전체가 화면 자료로 실렸다).
 *
 * Match 결과 화면은 이 컴포넌트 전체가 아니라 `PillarPair`만 재사용한다. 그 화면은
 * 상대의 `Saju`를 받지 않고, 동의로 열린 여덟 글자만 잘라 만든 `SharedPillarChart`를
 * 받는다(ADR 0010·0012).
 */

/**
 * 이름을 안 넣었을 때 쓰는 말. 넣으면 이름이 이 자리를 대신한다.
 *
 * "첫 번째 사람의 일지"는 **읽는 사람이 자기를 어디에 놓아야 할지 모른다.**
 * 궁합은 두 사람이 각자 자기 기준으로 읽는 것이라, 관계 한 줄에서 어느 글자가
 * 누구 것인지가 이름으로 붙어야 그 읽기가 가능해진다.
 */
export const SIDE_LABEL: Record<CompatSide, string> = { a: '첫 번째', b: '두 번째' };

export const SIDES: readonly CompatSide[] = ['a', 'b'];

export function CompatView({
  charts,
  compat,
  names,
  notice,
  verdict,
}: {
  charts: Record<CompatSide, Saju>;
  /** 두 사람을 부르는 말 — 입력한 이름이거나 '첫 번째 사람' */
  names: Record<CompatSide, string>;
  compat: Compatibility;
  /** 결과 맨 위에 서는 한 줄 — 무엇을 기준으로 본 결과인가 */
  notice: ReactNode;
  /**
   * 사실 **아래에 서는 판정** — 「궁합 베타」 카드와 궁합풀이. 카드의 수가 곧 풀이 점수의
   * 기준점이라 **두 수가 같은 축에 선다**(ADR 0060) — 축이 다른 점수 둘을 한 화면에
   * 세우면 사용자가 무엇을 믿을지 정해야 하고, 그 물음에 우리가 답을 갖고 있지 않다.
   */
  verdict: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      {notice}
      <PillarPair
        charts={{
          a: { ...sharedPillarChartOf(charts.a.pillars), gender: charts.a.meta.gender },
          b: { ...sharedPillarChartOf(charts.b.pillars), gender: charts.b.meta.gender },
        }}
        names={names}
      />
      <FoldedAnalysis compat={compat} names={names} />
      {verdict}
    </div>
  );
}

/**
 * 접어 둔 분석 — **기본은 접힘이고, 펴면 그대로 다 나온다.**
 *
 * 관계 표와 그 표에서 세운 발화는 우리가 대조하는 엔진 중간 결과다(ADR 0035). 사용자 앞에 표 스물몇 개가
 * 먼저 서면 아래의 지표와 풀이까지 못 내려가므로 접는다 — 없애면 두 결과를 나란히 놓고 보는 자리를 잃는다.
 * **숨김 뒤에 자격을 걸지 않는다.** 이건 보안이 아니라 편집이다.
 *
 * 접이칸이 제 이름으로 무엇이 들었는지 말한다. 「계산을 확인하는 자리입니다」처럼
 * **자기 용도를 적지 않는다** — 그 문장이 붙어 있던 칸은 사용자에게 「내가 볼 것이
 * 아니다」로 읽혔고, 그러면 접어 둔 뜻이 아니라 치워 둔 뜻이 된다.
 *
 * 딱지를 마크업으로만 재는 검사는 태그 한 겹에 조용히 0을 내므로, e2e 는 이 칸을
 * **실제로 눌러** 안에 든 것을 본다.
 */
function FoldedAnalysis({
  compat,
  names,
}: {
  compat: Compatibility;
  names: Record<CompatSide, string>;
}) {
  return (
    <details className="group">
      {/*
        **마커를 우리가 그린다.** `display` 를 `list-item` 이 아닌 값으로 주면 브라우저가
        기본 삼각형을 지우고, 그러면 눌러야 하는 자리인지가 화면에 안 남는다. 펼침
        상태는 `<summary>` 가 스스로 알리므로 이 글자는 화면에만 선다.
      */}
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[1.5rem] border border-border bg-surface px-5 py-4 hover:border-border-strong active:scale-[0.99] sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>
          <span className={TYPE_NAME}>두 사주를 맞대어 본 표</span>
          <span className="mt-0.5 block text-[13px] leading-5 text-secondary">
            사이에 걸리는 관계와, 그 표에서 말할 수 있는 것.
          </span>
        </span>
        <span aria-hidden className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-secondary">
          <span className="group-open:hidden">펼치기</span>
          <span className="hidden group-open:inline">접기</span>
          <svg viewBox="0 0 12 12" className="size-3 group-open:rotate-180">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>

      <div className="mt-6 flex flex-col gap-6">
        <BetweenSections compat={compat} names={names} />
      </div>
    </details>
  );
}

/**
 * 두 명식을 **한 쌍의 보드** 안에 놓는다.
 *
 * 독립 카드 두 장은 저장한 사람 목록과 같은 인상을 줬다. 이 화면의 주어는 사람 둘이
 * 아니라 **둘 사이**이므로, 공통 외곽 하나(크림 종이) 안에 각 사람을 좌우 면으로 나눈다.
 * 면은 그 사람의 일간 색을 입어 목록의 타일과 같은 사람으로 읽힌다.
 *
 * 가운데에 `×` 표식을 한 번 두었다가 걷었다. 묶여 있다는 것은 이미 외곽이 말하고,
 * 그 위에 얹은 기호는 두 면 사이에서 읽을 것이 없는 자리를 하나 더 만들었다.
 */
export function PillarPair({
  charts,
  names,
}: {
  charts: Record<CompatSide, SharedPillarChart>;
  names: Record<CompatSide, string>;
}) {
  return (
    <section className="rounded-[2rem] bg-cream p-4 sm:p-6">
      <header className="px-1 pb-4 sm:px-2">
        <p className="text-[13px] font-semibold text-cream-ink">각자의 사주</p>
        <h2 className={`mt-0.5 ${TYPE_SECTION}`}>궁합의 출발점</h2>
      </header>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {SIDES.map((side) => (
          <PairSide key={side} side={side} name={names[side]} chart={charts[side]} />
        ))}
      </div>
    </section>
  );
}

/**
 * 한 사람의 면 — **저장한 사람 타일과 같은 조각을 쓴다**(`DayMasterChip` · `PillarStrip`).
 *
 * 같은 한 사람을 목록에서는 타일로, 여기서는 다른 모양으로 보면 두 화면을 오가는 사람에게
 * 같은 것이 두 번 다르게 서는 셈이라 조각을 한 벌로 맞춘다.
 */
function PairSide({
  side,
  name,
  chart,
}: {
  side: CompatSide;
  name: string;
  chart: SharedPillarChart;
}) {
  const dayMaster = STEM_INFO[chart.dayMaster];

  return (
    <section className={`${elementScope(dayMaster.element)} ${TILE} relative flex flex-col gap-3 overflow-hidden sm:p-5`}>
      <ElementSymbol
        element={dayMaster.element}
        className="pointer-events-none absolute -right-5 -top-5 size-28 opacity-[0.14]"
      />
      <div className="relative flex min-w-0 flex-col gap-2">
        <DayMasterChip stem={chart.dayMaster} className="self-start" />
        <div className="min-w-0">
          <p className={TYPE_META}>{side === 'a' ? '첫 번째 사람' : '두 번째 사람'}</p>
          <h3 className={`${TYPE_NAME} truncate`}>{name}</h3>
          <p className={TYPE_META}>
            {chart.gender !== undefined && `${GENDER_KO[chart.gender]} · `}
            {dayMaster.ko}
            {ELEMENT_KO[dayMaster.element]} 일간
          </p>
        </div>
      </div>

      <div className="relative">
        <PillarStrip pillars={chart} name={name} size="lg" />
      </div>
    </section>
  );
}
