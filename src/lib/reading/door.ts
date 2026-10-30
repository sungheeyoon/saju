import type { CurrentReading } from './current-reading';
import type { LastRun } from './run';

/**
 * **앱의 문(`app/api/mobile`)이 답하는 모양** — 서버와 앱이 같은 타입을 든다(ADR 0211).
 *
 * 값은 서버에서 다 지어 나간다. 글의 근거 절은 서버에서 잘리고(`currentReading`), 날짜의 글자 · 기다림의 길이 · 절 이름처럼
 * 서버 모듈이 든 것도 글자로 건넌다 — 프롬프트 모듈은 앱 묶음에 들지 않는다.
 */

/** 문이 값이 아니라 까닭으로 답한 것 — 401 · 403 · 404 · 400 · 503 · 500 의 본문 */
export type DoorRefusal =
  /** 토큰이 없거나 거절됐다 — 앱은 다시 로그인으로 */
  | { readonly refused: 'sign-in' }
  /** 가입(또는 안내 재확인)을 마치지 않았다 — 앱은 가입 화면으로 */
  | { readonly refused: 'signup' }
  /** 베타가 끝났다 */
  | { readonly refused: 'closed' }
  /** 대상의 모양이 틀렸거나 내 목록에 없다 */
  | { readonly refused: 'not-found' }
  /** 못 읽었거나 못 닿았다 — 문을 안 열었다. 다시 시도할 수 있다 */
  | { readonly refused: 'unavailable'; readonly message: string };

/** 만드는 버튼이 말하는 데 드는 풀이권 — 못 물었으면 통째로 `null` */
export type DoorCredits = {
  readonly limit: number;
  readonly used: number;
  readonly reserved: number;
  readonly requested: number;
  readonly available: number;
};

/** 일간 — 표지의 색과 머리 딱지 */
export type DoorDayMaster = { readonly stem: string; readonly element: string };

/** 이용이 멈췄다 — 웹의 안내와 같은 글자 */
type Blocked = { readonly view: 'blocked'; readonly title: string; readonly detail: string };

/** 한 대상의 풀이 칸 — `GET /api/mobile/reading` */
export type ReadingView =
  | {
      readonly view: 'reading';
      readonly reading: CurrentReading | null;
      /** 「…생성」 앞의 시각 · 「읽는 데 약 N분」의 N — 글이 없으면 `null` */
      readonly createdLabel: string | null;
      readonly minutes: number | null;
      readonly run: LastRun | null;
      readonly credits: DoorCredits | null;
      /** 기다리는 동안의 절 이름 — 이름을 미리 모르는 궁합이면 `null`(ADR 0127) */
      readonly outline: readonly string[] | null;
      /** 기다림의 길이를 말하는 한 줄 — 상한에서 지은 글자 */
      readonly waitNote: string;
      /** 한 사람 풀이의 머리 — 궁합은 부르는 화면이 든다 */
      readonly subject: { readonly name: string; readonly title: string; readonly dayMaster: DoorDayMaster | null } | null;
    }
  /** 내 사주를 아직 저장하지 않았다 */
  | { readonly view: 'no-self' }
  /** 저장한 사람 id 로 온 내 사주 — 앱은 `self` 로 옮긴다 */
  | { readonly view: 'is-self' }
  | Blocked;

/** 누름의 답 — **결과가 아니라 시작 여부다.** 웹의 `ReadingStart` 와 같은 값이다(`POST /api/mobile/reading`) */
export type ReadingPress =
  | { readonly ok: true; readonly started: boolean }
  | { readonly ok: false; readonly message: string; readonly outOfCredits?: true };

/** 쓰기의 답 — 웹의 `SaveResult` 와 같은 값이다(`/api/mobile/me/*`) */
export type DoorSave = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** 기다리는 동안의 물음 — `GET /api/mobile/reading/run` */
export type RunView = { readonly run: LastRun | null };

/** 보관함의 칩 칸 */
export type ShelfSlot = 'saju' | 'compat' | 'match';

/** 보관함의 한 권 — 본문이 없다(ADR 0033) */
export type ShelfBook = {
  readonly key: string;
  readonly href: string;
  readonly single: boolean;
  readonly shelf: ShelfSlot;
  readonly title: string;
  readonly metaphor: string | null;
  readonly date: string;
  readonly score: number | null;
  readonly stale: boolean;
  readonly subjects: readonly (DoorDayMaster | null)[];
  readonly names: readonly string[];
};

/** 아직 도는 한 권 */
export type ShelfMaking = {
  readonly href: string;
  readonly name: string;
  readonly shelf: ShelfSlot;
  readonly names: readonly string[];
};

/** 풀이 보관함 — `GET /api/mobile/readings` */
export type ShelfView =
  | {
      readonly view: 'shelf';
      readonly books: readonly ShelfBook[];
      readonly making: readonly ShelfMaking[];
      readonly hasSelf: boolean;
    }
  | Blocked;
