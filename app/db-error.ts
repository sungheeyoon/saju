/**
 * DB 가 낸 거절을 사용자에게 옮길 것인가 — **우리 문장만 옮긴다.**
 *
 * 이 저장소의 거절은 DB 가 문장으로 낸다(`raise exception '풀이권을 다 쓰셨습니다…'`). 화면이 다시
 * 판정하지 않는 것이 규율이고(ADR 0006 계열), 그래서 앱은 그 문장을 그대로 세운다.
 *
 * 그 길에 **우리가 쓰지 않은 문장**도 함께 실린다. 함수가 없거나(`42883`), 정책이 이름 없이 막거나
 * (`42501`), PostgREST 가 스키마 캐시로 거절하면(`PGRST202`) 영어 원문이 사용자 화면에 선다. 사용자는
 * 할 수 있는 것이 없고, 그 문장은 우리 스키마의 속을 말한다.
 *
 * **가르는 값은 한국어다.** 우리가 쓴 거절은 전부 한국어 문장이고(`supabase/migrations` 의
 * `raise exception`), Postgres·PostgREST 가 스스로 내는 문장은 영어다. 코드(SQLSTATE)로 가르는 길도
 * 있었는데 못 가른다 — `42501` 은 우리가 「중지된 계정입니다」로 쓰는 코드이면서 정책이 이름 없이 막을
 * 때의 코드이기도 하다.
 *
 * 걸러진 원문은 **서버 기록에 남긴다.** 사용자에게서 지우는 것이 아니라 자리를 옮기는 것이다.
 */

/** 한글 음절 하나라도 있으면 우리가 쓴 문장이다 */
const KOREAN = /[가-힣]/;

export type DbError = { readonly message: string; readonly code?: string };

/**
 * @param where 기록에 남길 자리 이름 — 「어디서 났나」를 사람이 읽을 수 있게
 * @param fallback 우리 문장이 아닐 때 사용자에게 보일 말
 */
export function userFacingDbMessage(error: DbError, where: string, fallback: string): string {
  if (KOREAN.test(error.message)) return error.message;

  console.error(where, error.code ?? '', error.message);
  return fallback;
}
