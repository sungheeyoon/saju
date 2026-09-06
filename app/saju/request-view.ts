import type { Saju } from '@/src/lib/saju';

import { sajuViewModelOf, type SajuViewModel } from './view';

/**
 * 서버 화면이 그릴 것을 짓는다 — **시계를 읽는 자리가 여기다.**
 *
 * 운은 보는 시각으로 짚는데, 엔진은 시각을 스스로 묻지 않는다
 * (`NOW_POLICY.viewingInstant`). 서버 화면은 요청마다 한 번 그려지므로 요청이 도착한
 * 때가 곧 「지금」이다.
 *
 * **컴포넌트 안에서 안 읽는다.** 화면 본문에서 `Date.now()` 를 읽으면 그 값이 렌더
 * 출력으로 흘러 순수성 규칙에 걸린다(`react-hooks/purity`). 규칙을 끄는 대신 자리를
 * 옮긴다 — 이 페이지의 다른 값들도 전부 `await` 한 자료 함수에서 오고, 기준 시각도
 * 그중 하나일 뿐이다.
 *
 * 익명 계산기는 이 함수를 안 쓴다. 거기는 시각을 **제출할 때마다** 새로 잡아야 해서
 * (`SajuCalculator`), 요청 시각이 답이 아니다.
 */
export async function sajuViewFor(saju: Saju): Promise<SajuViewModel> {
  return sajuViewModelOf(saju, Date.now());
}
