import { analyzeCompatibility, type Saju, type Stem } from '../saju';

import { buildMatchPreview, matchBasisOf } from './index';

/**
 * 로그인 전 첫 화면의 **로그인 전 궁합 결과** — 모델을 안 부르고 엔진 계산만으로 한 줄을 세운다(ADR 0131).
 *
 * 한 줄은 궁합 결과 화면의 「궁합 베타」 칸이 「먼저 보이는 신호」로 세우는 것과 **같은 함수**에서 온다
 * (`buildMatchPreview` 의 첫 신호) — 로그인 뒤 같은 두 사람의 궁합을 열면 같은 문장을 다시 만난다. 사이는 묻지 않은 채
 * (`relation: null`) 잰다 — 첫 화면은 사이를 묻지 않는다.
 *
 * **점수는 내지 않는다.** 화면은 점수를 가린 모양만 세우는데, 수를 받아 두고 흐리게만 그리면 페이지 원문에 수가 남는다.
 * 여기서 아예 안 넘긴다.
 */
export type PairTaste = {
  readonly dayMasters: { readonly a: Stem; readonly b: Stem };
  readonly line: string;
};

export function pairTasteOf(charts: { a: Saju; b: Saju }, names: { a: string; b: string }): PairTaste {
  const compat = analyzeCompatibility(charts.a, charts.b);
  const preview = buildMatchPreview(charts, compat, names, matchBasisOf(null, { matched: false, relation: null }));
  return {
    dayMasters: { a: charts.a.pillars.dayMaster, b: charts.b.pillars.dayMaster },
    /* 신호는 늘 하나 이상이다 — 두 사람이 서로를 보는 관점 줄은 언제나 선다(`buildMatchPreview`) */
    line: preview.highlights[0] ?? '',
  };
}
