import { SAJU_PATH } from '@/src/lib/consent';
import { queryFromSearchParams } from '@/src/lib/input/query';

/**
 * **세션이 갈라 세우는 두 주소**(ADR 0144) — `/` 는 로그인 전 첫 화면, `/saju` 는 로그인한 사람의 계산 자리다.
 *
 * 두 화면은 미리 그려지고 세션을 브라우저에서 안다 — 여기서 고른 주소로 그 화면이 `replace` 로 옮긴다(방문 기록에 떠난
 * 주소가 안 남는다). `#` 뒤는 서버에 안 오므로(ADR 0007) 옮기는 것도 브라우저가 한다.
 */

/** 주소창의 두 조각 — `window.location` 의 그 이름 그대로(`?…` · `#…`, 없으면 빈 문자열) */
type Address = { search: string; hash: string };

/**
 * 로그인한 사람이 `/` 에 왔을 때 — 입력을 든 주소면 `/saju` 에 그 입력째, 아니면 홈.
 *
 * `#` 뒤는 무엇이든 그대로 싣는다 — 계산 입력이든 이어 보기 낱말(`resume-reading`)이든 가르지 않는다. 옛 `?` 링크는
 * 입력으로 읽히는 것만 싣는다(`hash-query.ts` 가 그 링크를 읽는다) — 입력이 아닌 쿼리만 든 `/` 는 홈이다.
 */
export function memberLandingOf({ search, hash }: Address): string {
  if (hash.length > 1) return `${SAJU_PATH}${search}${hash}`;
  if (search.length > 1 && queryFromSearchParams(new URLSearchParams(search)) !== null) return `${SAJU_PATH}${search}`;
  return '/me';
}

/** 로그인하지 않은 사람이 `/saju` 에 왔을 때 — 같은 쿼리와 `#` 뒤를 들고 첫 화면으로 */
export function visitorLandingOf({ search, hash }: Address): string {
  return `/${search}${hash}`;
}
