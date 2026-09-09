'use client';

import { buildMatchPreview } from '@/src/lib/matching';
import type { Compatibility, Saju } from '@/src/lib/saju';

import { MatchIndexCard } from './match-index';

/**
 * 익명·저장 궁합 화면의 `match-v0` 칸.
 *
 * **셈은 여기서 부르고 그리기는 `MatchIndexCard` 가 한다.** 이 화면은 두 명식을
 * 브라우저가 들고 있어도 되는 자리라(사용자가 스스로 넣었거나 자기 사람들이다)
 * 지표도 브라우저에서 난다. Match 결과 화면은 그럴 수 없으므로 서버에서 같은
 * 함수를 부르고 결과만 넘긴다(ADR 0010) — **부르는 자리가 둘이어도 부르는 함수는
 * 하나**라, 두 화면의 숫자가 갈릴 자리가 없다.
 *
 * ## 「인연 찾기에서 요청하기」를 걷었다
 *
 * 이 칸 아래에 「상세 궁합 리포트 — 인연 찾기에서 요청하기」가 서 있었다. AI 궁합으로
 * 가는 길이 없던 시절, **닿는 곳이 있는 유일한 버튼**이었기 때문이다.
 *
 * 지금은 바로 아래에 궁합 풀이를 만드는 버튼이 선다. 그 옆에서 「상세 궁합은 두 분이
 * 서로 동의해야 열립니다」라고 말하면, 방금 만들 수 있다고 한 것을 못 만든다고 하는
 * 셈이다 — 인연 찾기는 **모르는 사람과 이어지는 길**이지 이 두 사람을 읽는 길이 아니다.
 */
export function MatchResult({
  charts,
  compat,
  names,
}: {
  charts: Record<'a' | 'b', Saju>;
  compat: Compatibility;
  names: Record<'a' | 'b', string>;
}) {
  const preview = buildMatchPreview(charts, compat, names);

  return <MatchIndexCard preview={preview} names={names} />;
}
