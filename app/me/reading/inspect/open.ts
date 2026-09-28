/**
 * **검산 화면은 Vercel 배포에서 서지 않는다.**
 *
 * 이 화면은 로그인만 묻고 프롬프트 몸통 전문(`READING_PROMPTS`)과 판본 계약을 편다 — 운영(Production)에서는
 * 가입한 누구나 주소 하나로 그것을 읽었다(밤샘 감사 보안, `docs/notes/2026-09-28-overnight-audit.md`).
 * 우리 작업대이지 사용자 화면이 아니다(`docs/prd.md` 화면 표의 「검산」).
 *
 * `VERCEL_ENV` 가 `production` · `preview` 이면 닫고, 그 밖(로컬 `next dev` · `next start` · 흐름 · e2e)에서는
 * 연다. Preview 도 닫는 까닭은 그것도 밖에서 열리는 주소이고 운영 키를 들기 때문이다(`docs/ops/runbook.md`
 * 「접속값은 여섯이고 넣는 손은 하나다」 — `OPENAI_API_KEY` 는 Production · Preview).
 */
export function inspectOpen(vercelEnv: string | undefined = process.env.VERCEL_ENV): boolean {
  return vercelEnv !== 'production' && vercelEnv !== 'preview';
}
