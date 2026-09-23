/**
 * 접속 상태의 정책 — 구간 셋과 그 자리에서 **사람에게 하는 말**(PRD §7.2, ADR 0092).
 *
 * `src/lib/chat` 과 같은 규율이다 — 정책이 문장을 들고 화면은 글자를 앞에 세우기만 한다.
 * 문구는 사용자가 2026-09-23 에 정한 것을 그대로 옮겼다(#121). 여기서 짓지 않는다.
 *
 * ## 수의 원본은 DB 다
 *
 * 「지금」 창 · 쓰기 억제 창 · 하루는 `presence_policy()` 가 내주고, 여기 적힌 수는 **그 사본**이다.
 * 구간을 계산하는 자리도 DB 다(`activity_band_of`) — 앱은 시각을 받지 않으므로 계산할 수가 없다.
 * 두 자리가 갈리면 화면이 거짓말하므로 흐름 검사(`scripts/check-chat.mjs`)가 `presence_policy()`
 * 를 불러 이 표와 견준다.
 *
 * ## 여기 **없는** 것
 *
 * 누구의 구간을 누가 보는가가 없다. 읽는 문 둘(`my_chat_rooms` · `my_discovery_board`)이 자기가
 * 이미 내주는 사람에 대해서만 구간을 싣고, 그것이 곧 화면이 보는 것이다(ADR 0092).
 */

/** `presence_policy()` 의 사본 — 칸 이름은 그 함수의 반환 칸과 같다 */
export const PRESENCE_POLICY = {
  nowWindowSeconds: 300,
  writeWindowSeconds: 60,
  dayWindowSeconds: 86400,
} as const;

/** 이름은 DB 의 `activity_band_of` 가 내는 셋과 같다 */
export const ACTIVITY_BANDS = ['now', 'day', 'earlier'] as const;
export type ActivityBand = (typeof ACTIVITY_BANDS)[number];

export const activityBandOf = (value: unknown): ActivityBand | null =>
  ACTIVITY_BANDS.find((known) => known === value) ?? null;

/**
 * 구간마다 한 줄 — 사용자가 정한 글자 그대로(2026-09-23). 카드에 홀로 서도 뜻이 닫히는 말이다.
 */
const ACTIVITY_TEXT: Record<ActivityBand, string> = {
  now: '지금 활동 중',
  day: '최근 24시간 내 활동',
  earlier: '24시간 이전 활동',
};

export const activityText = (band: ActivityBand): string => ACTIVITY_TEXT[band];

/**
 * 처리방침에 드는 한 줄 — 새로 적는 개인정보라 밝힌다(#121). 사용자가 준 문장 그대로다.
 */
export const ACTIVITY_PRIVACY_LINE =
  '로그인 상태에서 마지막 활동 시각을 수집합니다. 이 정보는 활동 상태를 표시하는 데 사용되며, 다른 이용자에게는 정확한 시각이 아닌 ‘지금 활동 중’, ‘최근 24시간 내 활동’, ‘24시간 이전 활동’ 구간으로만 표시됩니다.';
