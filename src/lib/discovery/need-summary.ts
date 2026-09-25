import { YONGSIN_POLICY, pillarOf, type ChartSnapshot, type Element, type Pillar } from '../saju';

import { needTargetsFor } from './compat-axes';

/**
 * **필요한 기운 요약** — 매칭 풀에 오행 요약 옆으로 실리는 두 값(ADR 0113).
 *
 * 후보 카드의 `v2-beta` 점수에서 「서로 채우는 기운」 축(`needComplementSymmetric`)은 받는 쪽의
 * **억부 1순위**와 **가장 무거운 기운**을 알아야 한다. 억부는 엔진(TS)에만 있으므로 DB 가 못 만들고,
 * 앱이 만들어 넣는다 — 오행 요약과 같은 길이다. 주는 쪽의 드러난 몫(일간 · 다른 천간 · 지지 본기,
 * 지장간만은 0)은 오행 요약의 `counts` · `glyphCount` 가 이미 들고 있어서 여기에 한 번 더 싣지 않는다.
 *
 * **판정을 저장하지 않는다는 약속(ADR 0001)의 예외다** — 그 예외를 이 두 오행으로 좁힌다. 억부의
 * 판정 이름(신강 · 신약) · 점수 · 대안 · 조후는 싣지 않는다. 판정이 거두어졌는지(`withheld`)도 안 싣는다 —
 * 점수는 그래도 1순위로 셈을 하므로 DB 가 쓸 데가 없다.
 *
 * **여덟 글자에서만 만든다**(`ChartSnapshot`). 앱은 제 명식에서, 전환 백필은 `person.current_chart`
 * 에서 만드는데 둘이 같은 함수를 지나야 같은 값이 나온다. 억부는 기둥 넷만 본다 — 출생 시각
 * (`instant`)은 조후만 쓰고 조후는 이 요약에 안 든다.
 */
export type NeedSummary = {
  /** 억부 1순위 오행 */
  primary: Element;
  /** 억부가 가장 무겁다고 본 오행 — 상대가 이것을 보태면 작은 반대 신호다 */
  heaviest: Element;
  /** 어느 셈으로 만들었나 — `NEED_SUMMARY_RULE` */
  rule: string;
};

/**
 * 요약을 만든 **엔진 셈의 이름** — 억부 규칙과 오행 무게(ADR 0114).
 *
 * 입력 판(`input_version`)과 여덟 글자의 판(`chart_engine_version`)은 같아도 억부의 셈이 바뀌면 1순위가 바뀐다 —
 * 월지 ×2 · 지장간 60:30:10 이 기본이 된 날 약 14% 가 바뀌었다. 그래서 요약이 이 이름을 들고, DB 는 **지금
 * 이름**(`discovery_need_rule()`)과 다른 요약을 낡은 요약처럼 풀에서 뺀다. 이름은 엔진의 두 정책에서 짓는다 —
 * 엔진이 규칙을 올리면 여기도 따라 바뀌고, DB 의 이름과 어긋나 `scripts/card-score-sql.test.ts` 가 깨진다.
 * 그날은 DB 의 이름을 올리는 마이그레이션과 백필이 함께 간다.
 */
export const NEED_SUMMARY_RULE = `${YONGSIN_POLICY.ruleSet}+${YONGSIN_POLICY.elementWeights}`;

const pillarOrThrow = (glyphs: ChartSnapshot['day']): Pillar => {
  const pillar = pillarOf(glyphs.stem, glyphs.branch);
  // 검사식(`is_chart_snapshot`)을 지난 여덟 글자라 여기 올 일이 없다 — 오면 계산하지 않고 던진다
  if (pillar === null) throw new Error('60갑자에 없는 기둥입니다.');
  return pillar;
};

/** 여덟 글자에서 필요한 기운 요약 한 벌 — 엔진 기본 무게(월지 ×2 · 지장간 60:30:10, ADR 0114)로 잰다 */
export function needSummaryOf(chart: ChartSnapshot): NeedSummary {
  const targets = needTargetsFor({
    year: pillarOrThrow(chart.year),
    month: pillarOrThrow(chart.month),
    day: pillarOrThrow(chart.day),
    hour: chart.hour === null ? null : pillarOrThrow(chart.hour),
    dayMaster: chart.dayMaster,
  });
  return { primary: targets.primary, heaviest: targets.heaviest, rule: NEED_SUMMARY_RULE };
}

