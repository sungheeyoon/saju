/**
 * 채팅 화면의 **문구 상수만** 모은 파일이다(ADR 0159).
 *
 * 여기에는 `export const 이름 = '글자';` 만 선다 — import · 함수 · 계산 · 키 · 경로 · 설정값은 두지 않는다. CI 계획기
 * (`scripts/ci-plan.mjs` 의 `COPY_FILES`)가 이 파일의 문자열 값만 바뀐 PR 을 「문구만 바뀐 파일」로 세므로, 화면에 서는
 * 글자가 아닌 값을 여기 두면 그 값이 바뀌어도 동작 검사가 안 선다. 모양과 「화면의 글자 자리만 부른다」는 `scripts/ci-plan.test.ts` 가 잰다.
 *
 * `src/lib/chat` 에 살던 것을 옮겼다(G-90) — 글자는 그대로다. 액션이 돌려주는 말(`RATE_LIMITED_TEXT` · `TOO_LONG_TEXT`)과 탭 이름
 * (`CHAT_TAB_LABEL`, 돌아갈 곳 · 메타데이터 제목에도 쓰인다)은 화면 밖에서도 쓰여 거기 남는다.
 */

/** 빈 목록 — 사용자가 정한 글자 그대로(2026-09-23) */
export const CHAT_EMPTY_TITLE = '아직 채팅방이 없어요';
export const CHAT_EMPTY_DETAIL = '요청이 수락돼 인연 궁합이 열리면 메시지를 주고받을 수 있어요.';
/** 쓰는 칸 — 사용자가 정한 글자 그대로(2026-09-23) */
export const CHAT_INPUT_PLACEHOLDER = '메시지를 입력해 주세요';
export const CHAT_SEND_LABEL = '보내기';

/**
 * 말이 하나도 없는 열린 방 — 두 사람 카드 아래 두 줄, 그리고 목록에서 그 방의 미리보기 줄(운영자 2026-10-10, 화면 점검 C4,
 * 문구 대장 28).
 */
export const ROOM_FIRST_HELLO = '가볍게 인사를 건네 보세요.';
export const ROOM_SAFETY_NOTE = '불편한 대화는 오른쪽 위 ⋯ 메뉴에서 신고하거나 차단할 수 있어요.';
export const ROOM_NO_MESSAGES_YET = '아직 나눈 대화가 없어요';

/**
 * 방이 스스로 갱신되며 새로 선 자리(ADR 0155) — 운영자 확정(2026-10-10, 문구 대장 33).
 *
 * - 위에서 과거를 읽는 동안 상대의 새 말이 왔을 때 대화 칸 아래에 서는 단추. 누르면 맨 아래로 간다.
 * - 대화 칸 맨 위에서 가진 것 앞의 200건을 더 읽는 단추와 읽는 동안의 글자.
 */
export const NEW_MESSAGES_LABEL = '새 메시지 보기';
export const OLDER_MESSAGES_LABEL = '이전 메시지 더 보기';
export const OLDER_LOADING_LABEL = '불러오는 중…';
