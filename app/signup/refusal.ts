/** 가입 폼의 칸 — 거절의 말이 그 칸 곁에 선다 */
export type SignupField = 'code' | 'nickname';

/**
 * **가입 거절이 어느 칸의 것인가** — 말을 그 칸 곁에 세우려고 가른다(2026-10-11 화면 점검).
 *
 * 거절은 폼 맨 아래 한 줄로 섰다 — 「이미 사용 중인 닉네임이에요」가 닉네임 칸에서 한 화면 아래였다. DB 가 내는 거절
 * (`complete_signup`, `20261105090000`)은 칸을 말하지 않으므로 errcode 와 문장으로 가른다:
 *
 * - `23505` — 닉네임 중복 하나뿐이다
 * - `22023` — 닉네임 길이 · 빈 코드. 문장에 「닉네임」이 있으면 닉네임 칸이다
 * - `42501` — 코드(없는 코드 · 여러 번 틀림 · 정원)와 정지된 계정이 같은 코드다. 문장에 「코드」가 있으면 코드 칸이다
 *
 * 나머지(안내가 바뀜 · 테스트가 끝남 · 정지 · 알 수 없는 오류)는 칸이 없다 — 단추 곁에 선다. 틀린 코드가 `false` 로 오는
 * 갈래는 액션이 따로 `code` 를 준다.
 */
export function refusedField(code: string | undefined, message: string): SignupField | null {
  if (code === '23505') return 'nickname';
  if (code === '22023') return message.includes('닉네임') ? 'nickname' : 'code';
  if (code === '42501' && message.includes('코드')) return 'code';
  return null;
}
