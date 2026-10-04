/**
 * 로그인 · 가입을 다녀와서 **돌아갈 곳 하나**(ADR 0128).
 *
 * ## 왜 여기 모았나
 *
 * 로그인으로 보내는 자리가 스물일곱이었고(2026-09-29 `grep -rn "/auth" app`), 돌아갈 곳을 든 것은 셋뿐이었다 —
 * 궁합(`/auth?next=%2Fcompat`), 사주 이어 보기, 가입 화면의 같은 갈래.
 * 나머지 스물넷은 `/auth` 만 적어서, `/me/match/…` 를 열다 세션이 끊긴 사람은 로그인을 마치고 `/me` 에 섰다. 가입 관문도
 * `/signup` 으로만 보내고 가입을 마친 사람을 언제나 `/me` 로 보냈다 — 목적지를 들고 온 사람도 거기서 잃었다.
 *
 * ## `next` 는 최종 목적지 하나다
 *
 * 중간 걸음(가입 · 내 사주 확인)은 `next` 에 겹쳐 싣지 않는다. 운영자가 `next=/me/onboard/self?next=…` 처럼
 * 겹겹이 보이는 주소를 이상하게 봤다(2026-09-29). 중간 걸음은 **관문이 끼운다** — `/me` 아래는 `gateFor` 가,
 * 사주 이어 보기는 `afterSignIn` 이 가입 화면을 거치게 한다. 그래서 `/auth` · `/signup` 을 가리키는 `next` 는
 * 받지 않는다: 받으면 그것이 곧 겹친 `next` 다.
 *
 * 순수 함수라 관문(`gate.ts`)과 화면 · 문이 같은 것을 부른다 — 이 lib 은 app 을 모르므로 여기 산다.
 */

/** 돌아갈 곳을 모르거나 못 믿을 때 — 내 사주 */
const DEFAULT_RETURN_PATH = '/me';

/** 로그인한 사람이 저장하지 않고 한 사람의 사주를 보는 자리(ADR 0144) — 로그인 전에는 `/` 가 같은 일을 한다 */
export const SAJU_PATH = '/saju';

/**
 * 사주 이어 보기 — 로그인 전 첫 화면에서 적던 입력으로 돌아온다(입력은 주소가 아니라 탭의 `sessionStorage` 가 든다,
 * `app/reading-draft.ts`). 로그인을 마친 사람이 서는 곳이라 회원의 계산 자리다(ADR 0144).
 */
export const RESUME_READING_PATH = `${SAJU_PATH}#resume-reading`;

/**
 * 옛 사주 이어 보기 주소 — 배포 전에 로그인을 떠난 탭이 이 값을 `next` 로 들고 돌아온다. 돌아갈 곳으로 읽을 때 새 주소로
 * 갈아 읽어, 가입 화면을 거치는 갈래와 로그인 화면의 제목이 같은 답을 낸다.
 */
const LEGACY_RESUME_READING_PATH = '/#resume-reading';

/**
 * 첫 화면의 로그인 전 궁합 결과에서 넣은 두 사람으로 궁합을 이어 본다(ADR 0131) — 두 사람도 주소가 아니라 탭의
 * `sessionStorage` 가 든다(`app/reading-draft.ts`).
 */
export const RESUME_PAIR_PATH = '/compat#resume-pair';

/**
 * `#` 뒤 낱말로 입력을 되찾는 목적지 — **가입 화면을 한 번 거친다.** 관문(`proxy.ts`)은 `#` 뒤를 못 보므로 가입 화면으로
 * 보낼 때 `next` 에 낱말이 안 실리고, 가입을 마친 사람은 입력 없이 도착한다. 로그인을 마친 자리가 낱말째 싣는다.
 */
const RESUMES: readonly string[] = [RESUME_READING_PATH, RESUME_PAIR_PATH];

/**
 * 관문(`proxy.ts`)이 화면에 넘기는 **지금 주소**(경로 + 쿼리) — 서버 화면은 자기 주소를 모른다.
 *
 * 레이아웃은 쿼리도 동적 조각도 못 받는다(`/me/readings/[subject]` 의 레이아웃). 화면마다 주소를 다시 지으면
 * 열아홉이 저마다 짓고 하나는 틀린다. proxy 가 매 요청 덮어쓰고, 읽는 쪽이 `safeReturnPath` 로 다시 좁힌다 —
 * 이 머리글을 누가 지어 보내도 같은 사이트 경로 밖으로는 못 간다.
 */
export const RETURN_PATH_HEADER = 'x-saju-return-path';

/** 로그인 · 가입 자신 — 돌아갈 곳이 되면 `next` 가 겹친다 */
const detour = (pathname: string): boolean =>
  ['/auth', '/signup'].some((path) => pathname === path || pathname.startsWith(`${path}/`));

/**
 * 로그인 뒤 돌아갈 **같은 사이트 경로.**
 *
 * 외부 주소 · 프로토콜 상대 주소(`//…`) · 역슬래시로 시작하는 주소(`/\…` — 브라우저가 `//…` 로 읽는다)는
 * 받지 않는다. `next` 는 주소창에서 온 값이므로 그대로 redirect 하면 열린 리다이렉트가 된다.
 */
export function safeReturnPath(value: string | string[] | null | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate?.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return DEFAULT_RETURN_PATH;
  }

  try {
    const parsed = new URL(candidate, 'https://local.invalid');
    if (parsed.origin !== 'https://local.invalid') return DEFAULT_RETURN_PATH;
    if (detour(parsed.pathname)) return DEFAULT_RETURN_PATH;
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return path === LEGACY_RESUME_READING_PATH ? RESUME_READING_PATH : path;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}

/**
 * 로그인 · 가입 · 로그인 실패 화면의 주소 — **돌아갈 곳을 `next` 하나로 싣는다.**
 *
 * 돌아갈 곳이 기본값(`/me`)이면 싣지 않는다. 안 실어도 같은 곳으로 가고, 주소가 짧다.
 */
export function withReturnPath(screen: '/auth' | '/signup' | '/auth/denied', next: string | null | undefined): string {
  const destination = safeReturnPath(next);
  return destination === DEFAULT_RETURN_PATH ? screen : `${screen}?next=${encodeURIComponent(destination)}`;
}

/**
 * 머리글처럼 **지금 서 있는 자리**에서 로그인으로 보낼 때.
 *
 * 현관(`/`)에서 누른 「로그인」은 현관으로 돌아오라는 뜻이 아니다 — 들어가서 내 사주를 보려는 것이다.
 */
export const signInFrom = (pathname: string): string =>
  withReturnPath('/auth', pathname === '/' ? DEFAULT_RETURN_PATH : pathname);

/**
 * 로그인을 마친 사람이 **처음 설 곳** — 가입 관문이 못 서는 목적지만 가입 화면을 거친다.
 *
 * `/me` 아래 · `/compat` 은 관문(`gateFor`)이 가입 전인 사람을 가입 화면으로 보낸다. 사주 이어 보기(`/saju`)는
 * 관문 밖이라, 궁합 이어 보기(`/compat#resume-pair`)는 관문이 `#` 뒤를 못 보아 여기서 가입 화면을 한 번 거치게
 * 한다 — 가입을 마쳤으면 그 화면이 곧장 목적지로 보낸다.
 */
export function afterSignIn(next: string): string {
  const destination = safeReturnPath(next);
  return RESUMES.includes(destination) ? withReturnPath('/signup', destination) : destination;
}
