import { buildMatchPreview, type MatchBasis } from '@/src/lib/matching';
import type { Compatibility, Saju } from '@/src/lib/saju';

import { MatchIndexCard } from './match-index';

/**
 * 궁합 결과 화면의 「궁합 베타」 칸 — 받은 눈금(`basis`)으로 낸 수를 그린다.
 *
 * **눈금은 부르는 화면이 정한다**(`matchBasisOf`). 저장된 풀이가 있으면 그 풀이를 잰 판과 기준점이고, 없을 때만
 * 지금의 판을 사이로 고른다 — 옛 풀이 옆에 새 판의 수를 세우지 않는다(ADR 0113).
 *
 * **셈은 여기서 부르고 그리기는 `MatchIndexCard` 가 한다.** 서버 컴포넌트라 셈도 서버에서 나고, 브라우저로는
 * 그려진 지표만 간다 — 두 명식 전체를 화면 자료로 싣지 않는다(ADR 0010).
 *
 * ## 「인연 찾기에서 요청하기」를 걷었다
 *
 * 이 칸 아래에 「상세 궁합 리포트 — 인연 찾기에서 요청하기」가 서 있었다. AI 궁합으로
 * 가는 길이 없던 시절, **닿는 곳이 있는 유일한 버튼**이었기 때문이다.
 *
 * 지금은 바로 아래에 궁합풀이를 만드는 버튼이 선다. 그 옆에서 「상세 궁합은 두 분이
 * 서로 동의해야 열립니다」라고 말하면, 방금 만들 수 있다고 한 것을 못 만든다고 하는
 * 셈이다 — 인연 찾기는 **모르는 사람과 이어지는 길**이지 이 두 사람을 읽는 길이 아니다.
 */
export function MatchResult({
  charts,
  compat,
  names,
  basis,
}: {
  charts: Record<'a' | 'b', Saju>;
  compat: Compatibility;
  names: Record<'a' | 'b', string>;
  basis: MatchBasis;
}) {
  const preview = buildMatchPreview(charts, compat, names, basis);

  return <MatchIndexCard preview={preview} names={names} />;
}
