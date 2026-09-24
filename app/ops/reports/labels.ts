import { REPORT_REASONS } from '@/src/lib/account';

/**
 * 운영자 신고 화면이 **값을 부르는 말** — 목록과 상세가 같은 사실을 같은 글자로 적게 한 자리에 둔다.
 *
 * 운영자에게만 보이는 말이다. `/ops/**` 의 설명 · 제목 · 빈 상태 문구는 표 승인을 생략하고 PR 에 모아
 * 보고한다(`docs/agents/delegation.md`, ADR 0103). 사유의 이름은 사용자가 고른 그 글자
 * (`REPORT_REASONS`)를 그대로 쓴다 — 운영자가 읽는 말과 신고한 사람이 누른 말이 갈리면 안 된다.
 */

/**
 * 처리 상태 — 처리 필요는 안 봤거나 추가 확인 필요, 처리 완료는 그 밖의 검토다. 어느 쪽인가는 DB 의 `report_is_open` 이
 * 정해 문이 `is_open` 으로 내준다(ADR 0107). 글자는 2026-09-24 운영자가 승인한 그대로다.
 */
export const REVIEW_LABEL = {
  open: '처리 필요',
  done: '처리 완료',
} as const;

export const reviewStateLabel = (isOpen: boolean): string => (isOpen ? REVIEW_LABEL.open : REVIEW_LABEL.done);

/**
 * 검토 결과 — 검토 문(`review_report`)이 적는 값(`report.review_outcome`, ADR 0105 · 0107). 글자는 2026-09-24 운영자가
 * 승인한 그대로다(「조치 없음 / 경고 / 이용 정지 결정 / 추가 확인 필요」) — 제재 결과의 말이라 `/ops/**` 예외가 아니다.
 * 「이용 정지 결정」은 그때 내린 판단이다 — 계정의 **지금** 상태(「이용 정지」, 아래)와 같은 글자가 되지 않게 했다.
 * 모르는 값은 값 그대로 세운다 — 검사식이 넷만 받으므로 새 값이 서면 여기 먼저 더한다.
 */
const REVIEW_OUTCOME_LABEL: Readonly<Record<string, string>> = {
  no_action: '조치 없음',
  warning: '경고',
  suspension: '이용 정지 결정',
  needs_more: '추가 확인 필요',
};

export const reviewOutcomeLabel = (outcome: string): string => REVIEW_OUTCOME_LABEL[outcome] ?? outcome;

/** 검토 시각만 있고 결과가 없는 신고 — 검토 기록이 생기기 전(2026-09-24 전)에 본 것이다 */
export const NO_REVIEW_RECORD = '결과 기록 없음';

export const EVIDENCE_LABEL = {
  chat: '대화 근거 있음',
  none: '대화 근거 없음',
} as const;

/** 스냅샷의 보낸 쪽 — 방에는 둘뿐이라 이름 대신 신고 안의 자리로 부른다 */
export const SIDE_LABEL = {
  reporter: '신고한 사용자',
  reported: '신고받은 사용자',
} as const;

export type Side = keyof typeof SIDE_LABEL;

/** 베낄 때 보낸 사람 칸이 이미 비어 있던 줄 — 두 계정 어느 쪽에도 대어지지 않는다 */
export const UNKNOWN_SIDE_LABEL = '알 수 없음';

export const sideOf = (value: string | null): Side | null =>
  value === 'reporter' || value === 'reported' ? value : null;

/**
 * 계정의 **지금** 상태 — 이름은 PRD 의 계정 상태 표(이용 정지 · 탈퇴 대기)와 같다. 근거가 아니라
 * 「지금 이 사람에게 무슨 일이 걸려 있나」라서 상단에만 선다.
 */
const ACCOUNT_STATUS_LABEL: Readonly<Record<string, string>> = {
  active: '이용 중',
  suspended: '이용 정지',
  deletion_requested: '탈퇴 대기',
};

export const accountStatusLabel = (status: string | null): string =>
  (status === null ? undefined : ACCOUNT_STATUS_LABEL[status]) ?? '알 수 없음';

export const reasonLabel = (reason: string): string =>
  REPORT_REASONS.find((known) => known.value === reason)?.label ?? reason;

export const NO_NICKNAME = '닉네임 없음';

/**
 * 근거의 시각 — **초까지, 한국 시간으로.**
 *
 * 채팅 목록의 시각(`messageTimeLabel`)은 오늘이면 시각만 적는다. 여기서는 그러면 안 된다 — 신고를
 * 읽는 날과 메시지를 보낸 날이 다르고, 같은 분에 오간 말의 차례를 가려야 할 때가 있다. 서버는 UTC 라
 * 시간대를 적어 두지 않으면 아홉 시간 어긋난다.
 */
export const evidenceTime = (iso: string): string =>
  new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
