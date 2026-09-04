import { NOTICE_VERSION } from './notice';
import type { BetaDates } from './notice';

/**
 * `/me` 아래로 들어오는 사람을 **어디로 보낼 것인가** — 한 함수가 답한다.
 *
 * ## 왜 레이아웃이 아닌가
 *
 * 이 판정은 `app/me/layout.tsx` 에 있었다. 그런데 **레이아웃은 자기 아래 화면끼리 옮겨
 * 다닐 때 다시 안 돈다** — 재어 봤다(2026-09-04). `/me/settings` 에서 헤더의 「내 사주」를
 * 누르면 `GET /me` 는 도는데 레이아웃은 한 줄도 안 돈다. 그래서 관문 셋이 **첫 문서
 * 적재에서만** 섰고, 앱 안에서 걸어 다니는 사람에게는 아무것도 안 물었다.
 *
 * 그리고 레이아웃이 던진 `redirect` 가 **자기 아래 화면**을 가리키면(`/me` →
 * `/me/profile`) 브라우저가 주소만 옮기고 그 조각을 끝없이 다시 받는다. 채울 자리가
 * 비어 흰 화면이 된다 — 안내를 확인한 사람이 실제로 그것을 봤다(커밋 `2cbb31f`).
 *
 * 그래서 `proxy.ts` 로 옮겼다. 거기는 **앱 안 이동에도 매번 돈다.**
 *
 * ## 판정은 여기 있고 부르는 것은 proxy 다
 *
 * 자료를 읽는 일과 고르는 일을 뗀다. 고르는 규칙은 순수 함수라 시험이 계정 상태를 손으로
 * 세워 전부 밟을 수 있다 — 브라우저를 띄우지 않고. **밟히지 않은 규칙이 이 구멍을
 * 만들었다.**
 *
 * ## 여기서 하는 일은 여전히 길을 가리키는 것이다
 *
 * 막는 일은 DB 가 한다 — `create_self_person` 이 이름을 묻고, `is_active_account()` 가
 * 종료일을 본다. 이 함수가 틀려도 열리는 문은 없다.
 */

/** 계정에서 관문이 보는 세 칸 */
export type GateAccount = {
  readonly nickname: string | null;
  readonly noticeVersion: string | null;
  readonly noticeScheduleId: number | null;
};

/** 지금 안내 한 벌 — 못 읽었으면 `null` */
export type GateNotice = {
  readonly scheduleId: number;
  readonly dates: BetaDates;
};

/**
 * 관문이 서는 자리인가.
 *
 * `/me/photo/…` 는 뺀다. **그림을 내주는 자리**라 튕기면 사진이 깨지고, 하필 깨지는
 * 곳이 이름과 사진을 정하는 화면이다. 레이아웃 시절에도 여기는 관문 밖이었다 —
 * route handler 에는 레이아웃이 안 걸리기 때문이고, 그 사실이 우연히 맞았다.
 */
const gated = (path: string): boolean =>
  (path === '/me' || path.startsWith('/me/')) && !path.startsWith('/me/photo/');

/** 이름이 없어도 열리는 자리 — 이름을 짓는 화면 자신과, 나가는 길 */
const openWithoutName = (path: string): boolean =>
  path.startsWith('/me/profile') || path.startsWith('/me/settings');

/**
 * 베타가 끝났는가 — **한국 시각의 그날 끝까지**가 종료일이다.
 *
 * 날짜만 견주면 종료일 당일 오전에 이미 끝난 것이 된다.
 */
export const betaIsOver = (dates: BetaDates, now: Date): boolean =>
  new Date(`${dates.endsOn}T23:59:59+09:00`) < now;

/**
 * 어디로 보낼까 — 보낼 곳이 없으면 `null`.
 *
 * @param account 못 읽었으면 `null`. **그때는 아무 데도 안 보낸다** — 계정을 못 읽은
 *   것은 안내를 안 본 것과 다르고, 돌려보내면 그 화면도 못 읽어 되돌이가 된다.
 *   화면마다 「계정을 읽지 못했습니다」라고 말할 자리가 있다.
 */
export function gateFor(
  path: string,
  account: GateAccount | null,
  notice: GateNotice | null,
  now: Date,
): string | null {
  if (!gated(path)) return null;
  if (account === null) return null;

  /**
   * **끝났으면 여기서 끝난다.**
   *
   * 그래도 계정 관리는 연다. 종료일과 파기 사이는 자료가 아직 남아 있는 기간이고,
   * 그때야말로 철회와 삭제 요청이 필요하다 — 「끝났다」가 「이제 아무것도 못 한다」가
   * 되면 안 된다.
   */
  if (notice !== null && betaIsOver(notice.dates, now)) {
    return path.startsWith('/me/settings') ? null : '/closed';
  }

  /**
   * **판본과 그 줄을 둘 다 본다.**
   *
   * 날짜만 견주면 같은 날짜로 **운영자 정보만** 바꿔도 안 잡힌다 — 안내의 내용은 표의
   * 한 줄이 들고, 어느 칸이 바뀌든 새 줄이 된다.
   *
   * 일정이 아직 없으면(`notice === null`) 그때도 보낸다. 그 화면이 「아직 시작할 수
   * 없습니다」를 말할 자리다.
   */
  if (
    notice === null ||
    account.noticeVersion !== NOTICE_VERSION ||
    account.noticeScheduleId !== notice.scheduleId
  ) {
    return '/welcome';
  }

  /**
   * **안내 다음이 이름이다**(PRD §5.1).
   *
   * 이름은 앱 안의 모든 자리에서 사람을 부르는 말이라, 없는 채로 지나가면 소식과 요청
   * 목록이 이름 자리에 빈 칸을 세운다. 그래서 첫 입력보다 앞에 선다.
   */
  if (account.nickname === null && !openWithoutName(path)) return '/me/profile';

  return null;
}
