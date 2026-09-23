/**
 * 채팅의 정책 — 수 · 닫힌 방의 뜻 · 거절의 종류, 그리고 그 자리에서 **사람에게 하는 말.**
 *
 * `src/lib/account` 와 같은 규율이다 — 정책이 문장을 들고 화면은 글자를 앞에 세우기만 한다.
 * 문구는 사용자가 2026-09-23 에 정한 것을 그대로 옮겼다(PRD §5.3 · §7.1). 여기서 짓지 않는다.
 *
 * ## 수의 원본은 DB 다
 *
 * 한도 · 창 · 길이 · 스냅샷 문맥 · 보존은 `chat_policy()` 가 내주고(ADR 0091), 여기 적힌 수는
 * **그 사본**이다 — 화면이 「1,000자까지」라고 미리 말하려면 서버를 부르지 않고 알아야 한다.
 * 두 자리가 갈리면 화면이 거짓말하므로 흐름 검사(`scripts/check-chat.mjs`)가 `chat_policy()` 를
 * 불러 이 표와 견준다. 세는 일은 여기서 하지 않는다 — 함수 안에서 센다(ADR 0039).
 *
 * ## 여기 **없는** 것
 *
 * 누가 방을 보는가가 없다. 그것은 `chat_room_readable` 하나가 들고, 읽는 문이 내주는 것이 곧
 * 화면이 보는 것이다(ADR 0091). 여기 다시 적으면 판정하는 자리가 둘이 된다.
 */

/** `chat_policy()` 의 사본 — 칸 이름은 그 함수의 반환 칸과 같다 */
export const CHAT_POLICY = {
  rateLimit: 30,
  rateWindowSeconds: 60,
  maxLength: 1000,
  snapshotContext: 5,
  retentionDays: 90,
} as const;

/** 이름은 DB 의 검사식과 같다(`chat_room.closed_reason`) */
export const CLOSED_REASONS = ['block', 'suspension', 'deletion_request'] as const;
export type ClosedReason = (typeof CLOSED_REASONS)[number];

export const closedReasonOf = (value: unknown): ClosedReason | null =>
  CLOSED_REASONS.find((known) => known === value) ?? null;

/**
 * 닫힌 방 안에 서는 한 줄 — **닫힌 이유가 말을 정한다**(PRD §7.1 의 표).
 *
 * 이용 정지 · 탈퇴 대기로 닫힌 방은 닫은 사람에게는 안 보이므로(ADR 0091), 그 두 문장은 언제나
 * **상대**를 두고 하는 말이다. 차단은 둘 다 보고, 누가 차단했는지는 화면이 말하지 않는다.
 */
const CLOSED_ROOM_TEXT: Record<ClosedReason, string> = {
  block: '차단되어 대화할 수 없습니다.',
  suspension: '상대의 서비스 이용이 정지되어 대화할 수 없습니다.',
  deletion_request: '상대가 탈퇴를 신청하여 대화할 수 없습니다.',
};

export const closedRoomText = (reason: ClosedReason): string => CLOSED_ROOM_TEXT[reason];

/**
 * 처분이 끝난 상대의 이름 자리(PRD §5.3 「탈퇴」). 지금 처분은 방을 계정과 함께 지우므로 이
 * 글자가 서는 화면은 아직 없다(G-27) — 문구만 정해 두었다.
 */
export const LEFT_USER_LABEL = '탈퇴한 사용자';

/** `send_chat_message` 가 값으로 내는 셋 — 던지는 것은 문(`db-error`)이 옮긴다(ADR 0091) */
export const SEND_OUTCOMES = ['sent', 'closed', 'rate_limited'] as const;
export type SendOutcome = (typeof SEND_OUTCOMES)[number];

export const sendOutcomeOf = (value: unknown): SendOutcome | null =>
  SEND_OUTCOMES.find((known) => known === value) ?? null;

/**
 * 한도에 걸린 전송에 하는 말 — 사용자가 2026-09-23 에 승인했다(PRD §7.1).
 */
export const RATE_LIMITED_TEXT = '메시지를 너무 빠르게 보내고 있습니다. 잠시 뒤에 다시 보내 주세요.';

/** 화면 이름과 빈 목록 — 사용자가 정한 글자 그대로(2026-09-23) */
export const CHAT_TAB_LABEL = '채팅';
export const CHAT_EMPTY_TITLE = '아직 채팅방이 없습니다';
export const CHAT_EMPTY_DETAIL = '상세 궁합 요청이 완료되면 메시지를 주고받을 수 있습니다.';
export const CHAT_INPUT_PLACEHOLDER = '메시지를 입력해 주세요';
export const CHAT_SEND_LABEL = '보내기';

/** 방 제목 — `{닉네임} 님` */
export const roomTitleOf = (nickname: string): string => `${nickname} 님`;

/**
 * 보내기 전에 앱이 막는 것 둘 — 빈 본문과 너무 긴 본문. DB 도 같은 둘을 막지만(`22023`) 그
 * 문장은 「요청을 처리하지 못했습니다」로 바뀌어 사람에게 뜻이 없다. 그래서 앱이 먼저 본다.
 */
export type BodyCheck = 'ok' | 'blank' | 'too_long';

export const checkBody = (body: string): BodyCheck => {
  if (body.trim() === '') return 'blank';
  if (body.length > CHAT_POLICY.maxLength) return 'too_long';
  return 'ok';
};

/** 신고의 덧붙이는 말과 같은 문장이다 — DB 가 같은 길이에 같은 말을 던진다 */
export const TOO_LONG_TEXT = '적어 주신 내용이 너무 깁니다.';

/**
 * 목록의 시각 — 오늘이면 시각, 아니면 날짜. **한 사실에는 한 표기**라 풀이 목록의 날짜 표기
 * (`readingDate`)와 같은 모양을 쓴다.
 *
 * **시간대는 한국이다.** 서버(Vercel · CI)는 UTC 라 기계의 시간대로 재면 「오후 3:24」가 「오전 6:24」로
 * 서고, 「오늘」의 경계도 아홉 시간 어긋난다 — 이 화면을 읽는 사람은 한국에 있다(PRD §7.1).
 */
const KST = 'Asia/Seoul';

const dayIn = (at: Date): string =>
  at.toLocaleDateString('ko-KR', { timeZone: KST, year: 'numeric', month: 'long', day: 'numeric' });

export const messageTimeLabel = (iso: string, now: Date = new Date()): string => {
  const at = new Date(iso);
  const day = dayIn(at);
  return day === dayIn(now)
    ? at.toLocaleTimeString('ko-KR', { timeZone: KST, hour: 'numeric', minute: '2-digit' })
    : day;
};
