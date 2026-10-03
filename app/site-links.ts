/**
 * **누구나 여는 안내 화면 셋** — 서비스 소개 · 자주 묻는 질문 · 처리방침.
 *
 * 지금은 바닥글(`site-footer.tsx`)이 이 줄을 세운다. 다른 자리가 같은 셋을 세우게 되면 글자를 따로 적지 않고
 * 여기서 가져온다 — 이름을 고치는 날 한 자리만 옛 이름으로 남지 않게.
 *
 * 셋 다 로그인 없이 열린다 — `proxy.ts` 의 matcher 밖이다.
 */
export const GUIDE_LINKS = [
  { href: '/about', label: '서비스 소개' },
  { href: '/help', label: '자주 묻는 질문' },
  { href: '/privacy', label: '처리방침' },
] as const;
