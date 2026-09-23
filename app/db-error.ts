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
 * **가르는 값은 한국어다 — 다만 한국어만으로는 모자란다.** 우리가 쓴 거절은 전부 한국어 문장이고
 * (`supabase/migrations` 의 `raise exception`), Postgres·PostgREST 가 스스로 내는 문장은 영어다.
 * 코드(SQLSTATE)로 가르는 길도 있었는데 못 가른다 — `42501` 은 우리가 「이용이 정지된 계정입니다」로 쓰는
 * 코드이면서 정책이 이름 없이 막을 때의 코드이기도 하다. 재어 보면 더 분명하다: 우리 `raise` 537개가
 * **11종**의 errcode 를 세우고 그중 `42501`·`23505`·`23514`·`23502` 는 **Postgres 자신도 내는 코드**다.
 * 코드 허용목록은 그래서 답이 아니다.
 *
 * ## 한국어가 들었다고 우리 것은 아니다
 *
 * 시스템 오류가 **사용자가 보낸 한글을 되돌려 실을 수 있다** —
 * `invalid input syntax for type uuid: "한글"`. 한글 한 자를 근거로 통과시키면 그 영어 원문이
 * 통째로 화면에 선다. 막으려던 바로 그 일이다.
 *
 * **가드는 큰따옴표다.** Postgres·PostgREST 는 값과 식별자를 `"…"` 로 감싸 되돌리고, 우리 문장은
 * 그러지 않는다 — 재어 봤다: 마이그레이션의 **84종 중 큰따옴표가 든 것은 0개**, 한글이 없는 것도 0개다.
 * 그래서 이 가드는 우리 것을 하나도 안 막는다.
 *
 * **남는 구멍을 적어 둔다.** 따옴표 없이 한글을 실어 오는 시스템 문장은 여전히 지나간다. 그것까지
 * 닫으려면 우리 `raise` 537개에 **전용 표식**(고유 errcode나 고정 접두사)을 달아야 하고, 그건 이
 * 함수가 아니라 마이그레이션의 일이다.
 *
 * 걸러진 원문은 **서버 기록에 남긴다.** 사용자에게서 지우는 것이 아니라 자리를 옮기는 것이다.
 *
 * ## 왜 안 쓰이고 있었나 (#67)
 *
 * 이 함수는 잘 지어졌는데 **두 자리에서만** 불렸고, 서른 몇 자리가 `error.message` 를 그대로
 * 사용자에게 냈다. 까닭이 서명에 있었다 — `fallback` 이 **필수**라, 쓰려면 한국어 문장을 새로 짓고
 * 그 문장이 살 자리부터 찾아야 했다. 그래서 아무도 안 썼다.
 *
 * **문턱을 없앴다.** `fallback` 은 이제 선택이고, 안 주면 코드에서 지어 온다. 호출부가 할 일은
 * 「이 오류를 사용자에게 옮긴다」고 적는 것뿐이다.
 */

/** 우리 문장은 전부 한국어다 — 84종을 재어 확인했다 */
const KOREAN = /[가-힣]/;

/**
 * **되돌아온 값이 실려 있다.** Postgres·PostgREST 는 값과 식별자를 큰따옴표로 감싸 내보내므로
 * (`… uuid: "한글"`), 한글이 있어도 이것이 보이면 우리 문장이 아니다. 우리 84종에는 없다.
 */
const ECHOED = /"/;

/** 우리가 쓴 문장인가 — **문자 종류 하나에 기대지 않는다** */
const ours = (message: string): boolean => KOREAN.test(message) && !ECHOED.test(message);

type DbError = { readonly message: string; readonly code?: string };

/**
 * 까닭을 못 고를 때 서는 말.
 *
 * **무엇이 잘못됐는지 말하지 않는다.** 여기 닿은 오류는 우리가 뜻을 모르는 것이고, 모르면서
 * 짐작을 적으면 사용자는 있지도 않은 원인을 고치려 든다. 할 수 있는 일(다시 시도)만 적는다.
 */
const UNKNOWN_NOTE = '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';

/** 우리 쪽이 어긋났다 — 사용자가 고칠 것이 없다 */
const BROKEN_NOTE = '서비스가 잠시 어긋났습니다. 잠시 뒤 다시 시도해 주세요.';

/** 문이 이름 없이 막았다 — 「없는 것」과 「못 보는 것」을 여기서 가르지 않는다 */
const DENIED_NOTE = '이 작업을 할 권한이 없습니다. 다시 로그인한 뒤 시도해 주세요.';

/** 오래 걸려 끊겼다 — 다시 누르면 되는 갈래다 */
const BUSY_NOTE = '처리가 오래 걸려 멈췄습니다. 잠시 뒤 다시 시도해 주세요.';

/**
 * 우리가 안 쓴 오류 중 **까닭을 아는 것들.**
 *
 * 이 표가 도는 것은 **한국어 문턱을 지난 뒤**다. 그래서 `42501` 이 여기 있어도 우리가 그 코드로
 * 쓴 「이용이 정지된 계정입니다」를 가로채지 않는다 — 그 문장은 위에서 이미 그대로 나갔다.
 *
 * 표를 넓히지 않는다. 사용자가 **할 수 있는 일이 달라지는** 갈래만 든다. 코드마다 다른 문장을
 * 지어 두면 그것은 번역이 아니라 우리 스키마의 속을 한국어로 적는 일이다.
 */
const BY_CODE: Readonly<Record<string, string>> = {
  /* 함수가 없다 · 스키마 캐시가 문을 못 찾는다 — 배포가 어긋난 모양이다 */
  '42883': BROKEN_NOTE,
  '42P01': BROKEN_NOTE,
  PGRST202: BROKEN_NOTE,
  PGRST204: BROKEN_NOTE,

  /* 로그인이 없거나 정책이 이름 없이 막았다 */
  '28000': DENIED_NOTE,
  '42501': DENIED_NOTE,
  PGRST301: DENIED_NOTE,

  /* 시간·잠금으로 끊겼다 */
  '57014': BUSY_NOTE,
  '55P03': BUSY_NOTE,
};

/**
 * DB 거절을 **사용자에게 보일 한 문장으로.**
 *
 * @param where 기록에 남길 자리 이름 — 「어디서 났나」를 사람이 읽을 수 있게
 * @param fallback 우리 문장이 아닐 때 보일 말. **안 주면 코드에서 지어 온다** — 호출부가
 *   문장을 새로 짓지 않아도 쓸 수 있어야 이 문이 실제로 쓰인다(#67)
 */
export function userFacingDbMessage(error: DbError, where: string, fallback?: string): string {
  if (ours(error.message)) return error.message;

  console.error(where, error.code ?? '', error.message);
  return fallback ?? BY_CODE[error.code ?? ''] ?? UNKNOWN_NOTE;
}

/**
 * 같은 번역을 **던지는 자리**에 (`throw dbFailure(error, 'my_candidates')`).
 *
 * 화면 몇은 거절을 값으로 안 받고 던져서 오류 경계가 받는다. 그 경계는 `error.message` 를
 * 그대로 세우므로, 던지는 자리가 원문을 실으면 **영어가 화면에 선다** — 값으로 내는 자리만
 * 고치면 그 길이 그대로 남는다.
 */
export function dbFailure(error: DbError, where: string, fallback?: string): Error {
  return new Error(userFacingDbMessage(error, where, fallback));
}

/**
 * **없어도 화면이 서는 값** — 못 읽으면 그 자리만 생략한다(ADR 0078).
 *
 * 헤더의 남은 풀이권, 소식 배지의 수처럼 본체가 아닌 것들이 이 모양으로 온다.
 * 본체는 이 타입을 안 쓴다 — 모든 화면이 같은 분기를 다시 적게 되고, 그러면 오류
 * 경계가 이미 하는 일을 화면마다 손으로 한 번 더 한다.
 *
 * **`0` 과 「모른다」를 가르는 것이 이 타입의 전부다.** 지금까지는 `if (error) return 0`
 * 한 줄이 「DB 가 성공했고 0 건이다」와 「DB 가 터져 못 읽었다」를 한 값으로 합쳤고,
 * 그래서 배지가 사라진 화면과 읽을 것이 없는 화면이 같은 얼굴이었다.
 */
export type SkippableRead<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

/** 읽었다 */
export const read = <T>(value: T): SkippableRead<T> => ({ ok: true, value });

/** 못 읽었다 — 까닭은 기록에 남기고, 화면은 그 자리를 비운다 */
export const unread = (error: DbError, where: string): SkippableRead<never> => ({
  ok: false,
  reason: userFacingDbMessage(error, where),
});
