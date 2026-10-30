import { candidateCardText } from '../discovery';
import type { ElementSummary } from '../discovery/element-axes';
import { focusesOf } from '../profile';
import { ELEMENTS, type ChartSnapshot, type Element } from '../saju';

/**
 * **문이 내준 행을 카드 · 사진 칸 · 여덟 글자로 옮기는 말** — 웹(`app/me/candidates.ts` · `app/shared-pillar.ts`)과 앱이 함께 쓴다.
 * 자를 것을 고르는 판단은 여기도 없다 — 자르는 일은 DB 의 읽는 문이 이미 했다.
 */

/**
 * 기본 아바타의 오행 — 다섯 중 하나가 아니면 `null`(회색).
 *
 * **칸이 없어도 `null` 이다.** 앱이 DB 보다 먼저 배포되면 옛 문은 `avatar_element` 를 안 준다 —
 * 그때 아바타는 회색으로 서고 나머지는 그대로 돈다. 배포 순서가 어느 쪽이어도 창이 안 생긴다.
 */
const avatarElementOf = (value: string | null | undefined): Element | null =>
  ELEMENTS.find((element) => element === value) ?? null;

/**
 * 한 사람의 사진 주소들 — `/me/photo/{id}/{n}`, `n` 은 1부터 세는 자리다(G-60).
 *
 * 판본을 안 붙인다. 사진은 `private, no-cache` 에 판본 `ETag` 라 브라우저가 쓸 때마다 묻고, 순서를 바꾸면
 * 그 자리의 판본이 달라 새 장이 바로 선다(G-119, `app/me/photo/photo-response.ts`). 판본을 실으려면 목록이 장마다
 * 시각을 내줘야 한다 — 카드가 쓰지 않는 값을 내보내지 않는다.
 */
export const photoUrlsOf = (userId: string, count: number): string[] =>
  Array.from({ length: Math.max(0, Math.min(count, 6)) }, (_, index) => `/me/photo/${userId}/${index + 1}`);

/**
 * 매칭된 상대의 사진 전부 — 대화방 · 인연 궁합의 상대 프로필 시트가 넘긴다.
 *
 * 장 수는 읽는 문이 낸 초점(`[x1, y1, x2, y2, …]`, `photo_focus_of`)의 짝 수다 — 그 문은 장마다 두 수를 내므로 장 수를 따로
 * 묻지 않는다. 초점이 비었는데 사진이 있다고 하면(옛 문) 대표 한 장이다. 볼 수 있는지는 바이트 문(`may_see_photo`)이 그대로 답한다.
 */
export function photosFromFocus(userId: string, flat: readonly number[] | null | undefined, hasPhoto: boolean) {
  const count = hasPhoto ? Math.max(1, Math.floor((flat?.length ?? 0) / 2)) : 0;
  const photoUrls = photoUrlsOf(userId, count);
  return { photoUrls, photoFocus: focusesOf(flat, photoUrls.length) };
}

/**
 * 장 수 — **칸이 없으면 옛 칸으로 한 장을 센다.** 앱이 DB 보다 먼저 배포되면 옛 문은 `photo_count` 를
 * 안 준다. 그때 카드는 대표 한 장으로 서고 나머지는 그대로 돈다.
 */
const photoCountOf = (count: number | null | undefined, hasPhoto: boolean): number =>
  typeof count === 'number' ? count : hasPhoto ? 1 : 0;

/** 공개 행의 칸 — 칸 이름은 `my_discovery_board` · `my_passed_connections` 와 같다 */
type PublicCardRow = {
  candidate_user_id: string;
  nickname: string;
  intro: string | null;
  has_photo: boolean | null;
  supplied_elements: string[] | null;
  balance_band: string;
  preview_score: number;
  avatar_element?: string | null;
  photo_count?: number | null;
  photo_focus?: readonly number[] | null;
};

/** RPC가 허용한 공개 행을 직렬화 가능한 카드로 옮긴다. 복원도 기존 점수 문구를 쓴다. */
export function publicCardFromRow(row: PublicCardRow, mySummary: Pick<ElementSummary, 'counts'>) {
  const hasPhoto = row.has_photo === true;
  const photoUrls = photoUrlsOf(row.candidate_user_id, photoCountOf(row.photo_count, hasPhoto));
  return {
    candidateUserId: row.candidate_user_id,
    nickname: row.nickname,
    intro: row.intro,
    hasPhoto,
    photoUrls,
    photoFocus: focusesOf(row.photo_focus, photoUrls.length),
    avatarElement: avatarElementOf(row.avatar_element),
    exploration: false,
    ...candidateCardText({
      suppliedElements: row.supplied_elements,
      balanceBand: row.balance_band,
      previewScore: row.preview_score,
      viewerCounts: mySummary.counts,
    }),
  };
}

/**
 * **저장돼 있던 여덟 글자의 모양인가**(ADR 0071). DB 가 모양을 이미 봤어도 화면으로 나가는 경계라 한 번 더 본다.
 *
 * 아니면 기본값으로 메우지 않는다 — 없는 여덟 글자를 지어 세우면 두 사람이 동의한 적 없는 명식이 보드에 선다.
 */
export function isStoredChart(value: unknown): value is ChartSnapshot {
  if (typeof value !== 'object' || value === null) return false;

  const chart = value as Record<string, unknown>;
  const pillar = (at: unknown): boolean =>
    typeof at === 'object' &&
    at !== null &&
    typeof (at as Record<string, unknown>).stem === 'string' &&
    typeof (at as Record<string, unknown>).branch === 'string';

  if (!pillar(chart.year) || !pillar(chart.month) || !pillar(chart.day)) return false;
  if (chart.hour !== null && !pillar(chart.hour)) return false;
  return typeof chart.dayMaster === 'string';
}
