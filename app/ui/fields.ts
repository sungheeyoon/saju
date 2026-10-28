/**
 * **글을 받는 칸 한 벌** — 48px · 흰 면 · 굵은 테 · 16px 글자(`text-field`). 크림 바탕 위에서도 칸임이 보인다.
 *
 * 가입(`app/signup/form.tsx`)과 프로필(`app/me/profile/form.tsx`)이 같은 글자로 따로 적던 것을 올렸다(G-109). 가입은 거절된 칸을
 * 붉히려고 `aria-invalid:border-danger` 를 덧붙인다. 신고 칸(`ring` 테 · 12px 모서리)과 2단계 인증 코드 칸(고정폭 숫자 · 넓은 자간)은
 * 모양이 달라 각자의 파일에 남았다. 글자가 16px 아래로 내려가지 않는 것은 `fields.test.ts` 가 잰다(ADR 0109 「입력 칸의 글자」).
 */
export const FIELD =
  'min-h-12 rounded-cell border border-border-strong bg-surface px-4 text-field outline-none placeholder:text-muted focus:border-foreground focus:ring-2 focus:ring-accent-soft';
