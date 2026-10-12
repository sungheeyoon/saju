/**
 * **누구나 여는 약관 화면 셋** — 이용약관 · 환불정책 · 처리방침(ADR 0171). 앱 안 바닥글은 이 셋만 든다 — 결제 페이지까지
 * 상시 닿아야 하는 링크다(전자상거래법 제10조 · PG 심사).
 */
export const POLICY_LINKS = [
  { href: '/terms', label: '이용약관' },
  { href: '/refund', label: '환불정책' },
  { href: '/privacy', label: '처리방침' },
] as const;

/**
 * **누구나 여는 안내 화면** — 서비스 소개 · 자주 묻는 질문 · 그리고 약관 화면 셋(`POLICY_LINKS`).
 *
 * 지금은 바닥글(`site-footer.tsx`)이 이 줄을 세운다. 다른 자리가 같은 셋을 세우게 되면 글자를 따로 적지 않고
 * 여기서 가져온다 — 이름을 고치는 날 한 자리만 옛 이름으로 남지 않게.
 *
 * 모두 로그인 없이 열린다 — `proxy.ts` 의 matcher 밖이다. 바닥글은 줄이 늘면 감아 내린다.
 */
export const GUIDE_LINKS = [
  { href: '/about', label: '서비스 소개' },
  { href: '/help', label: '자주 묻는 질문' },
  ...POLICY_LINKS,
] as const;
