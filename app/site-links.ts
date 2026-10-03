/**
 * **누구나 여는 안내 화면 셋** — 서비스 소개 · 자주 묻는 질문 · 처리방침.
 *
 * 바닥글(`site-footer.tsx`), 톱니 메뉴(`site-header.tsx`), 없는 주소(`not-found.tsx`)가 같은 줄을 세운다. 세 자리가
 * 글자를 따로 적으면 이름을 고치는 날 한 자리만 옛 이름으로 남는다.
 *
 * 셋 다 로그인 없이 열린다 — `proxy.ts` 의 matcher 밖이다.
 */
export const GUIDE_LINKS = [
  { href: '/about', label: '서비스 소개' },
  { href: '/help', label: '자주 묻는 질문' },
  { href: '/privacy', label: '처리방침' },
] as const;

/** 풀이권이 무엇인지 답하는 자리 — 머리글의 잔액 칩이 여기로 간다 */
export const CREDITS_HELP_HREF = '/help#credits';
