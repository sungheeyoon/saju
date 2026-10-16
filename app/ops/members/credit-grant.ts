import { refundReasonLabel } from '../orders/labels';

/**
 * **무상 풀이권 지급 · 회수의 「실행 전 확인」과 이력의 말** — 확인창에 보이는 값과 서버에 내는 값을 한 자리에서 짓는다
 * (G-111 ①, ADR 0187).
 *
 * 확인창을 여는 순간 값을 고정해(`GrantPlan`) 그 고정본으로 단추 이름 · 본문을 그리고, 같은 고정본을 그대로 낸다 — 창이 열린 뒤
 * 폼을 바꿔도 내는 것은 창에 보인 값이다. 서버는 상한 · 갈래 · 회수할 수 있는 수 · 읽은 버전 · 요청 번호를 다시 잰다.
 */

/** 지급 한 번의 위 끝 — DB 의 `a_grant_is_at_most_ten` 과 같은 수 */
export const GRANT_MAX = 10;

/** 메모의 길이 — DB 의 `grant_entry_note_is_short` 와 같은 수 */
export const NOTE_MAX = 200;

export const GRANT_REASONS = [
  { value: 'outage', label: '장애 보상' },
  { value: 'operator', label: '운영 지급' },
] as const;

export const REVOKE_REASONS = [
  { value: 'mistake', label: '잘못 지급' },
  { value: 'duplicate', label: '중복 지급' },
  { value: 'other', label: '기타' },
] as const;

export type GrantKind = 'grant' | 'revoke';

const REASONS: Record<GrantKind, readonly { readonly value: string; readonly label: string }[]> = {
  grant: GRANT_REASONS,
  revoke: REVOKE_REASONS,
};

export const isGrantReason = (kind: GrantKind, value: string): boolean =>
  REASONS[kind].some((reason) => reason.value === value);

/** 지급 · 회수의 갈래 이름 — 모르는 값은 그대로 */
export const grantReasonLabel = (value: string): string =>
  [...GRANT_REASONS, ...REVOKE_REASONS].find((reason) => reason.value === value)?.label ?? value;

/** 메모의 첫 줄 — 확인창의 사유 칸에 갈래와 함께 선다 */
export const firstLine = (note: string): string => note.trim().split('\n')[0]?.trim() ?? '';

/** 확인창의 대상 — 닉네임 · 계정 id 앞 8자(동명이인을 가른다) */
export const memberLabel = (nickname: string | null, userId: string): string =>
  `${nickname ?? '닉네임 없음'} · ${userId.slice(0, 8)}`;

/** 서버에 내는 값 — 확인창에 보인 그대로 */
export type GrantRequest = {
  readonly kind: GrantKind;
  readonly userId: string;
  readonly credits: number;
  readonly reason: string;
  readonly note: string;
  /** 신고 화면에서 넘어온 지급의 관련 신고 — 회수에는 없다 */
  readonly reportId: string | null;
  /** 화면이 읽은 그 계정의 장부 줄 수 — 다르면 서버가 거절한다 */
  readonly seenVersion: number;
  /** 확인창을 열 때 지은 요청 번호 — 응답이 끊겨 다시 내면 같은 줄이 돌아온다 */
  readonly requestId: string;
};

export type GrantPlan = {
  readonly request: GrantRequest;
  readonly title: string;
  /** 확인 단추 — 「3장 지급」 · 「2장 회수」 */
  readonly confirmLabel: string;
  /** 수량 칸 — 「무상 풀이권 3장 (지급분 2장 → 5장)」 */
  readonly amountLine: string;
  /** 사유 칸 — 「장애 보상 — <메모 첫 줄>」 */
  readonly reasonLine: string;
  /** 결과 칸 */
  readonly resultLine: string;
};

/** 폼이 아는 지금 — 운영 지급분 받은 수 · 회수할 수 있는 수 · 읽은 버전 */
export type GrantLedger = {
  readonly granted: number;
  readonly revocable: number;
  readonly version: number;
};

export const NOT_REFUNDABLE = '현금 환불 대상이 아닙니다.';

/** 확인창을 여는 순간의 지급 · 회수 — `requestId` 는 부르는 쪽이 넘긴다(같은 값으로 다시 여는 재시도는 앞 번호를 다시 쓴다) */
export function grantPlan(
  ledger: GrantLedger,
  input: Omit<GrantRequest, 'seenVersion' | 'requestId'>,
  requestId: string,
): GrantPlan {
  const request: GrantRequest = Object.freeze({ ...input, note: input.note.trim(), seenVersion: ledger.version, requestId });
  const reasonLine = `${grantReasonLabel(input.reason)} — ${firstLine(input.note)}`;
  return Object.freeze(
    input.kind === 'grant'
      ? {
          request,
          title: '무상 풀이권을 지급할까요?',
          confirmLabel: `${input.credits}장 지급`,
          amountLine: `무상 풀이권 ${input.credits}장 (지급분 ${ledger.granted}장 → ${ledger.granted + input.credits}장)`,
          reasonLine,
          resultLine: `${NOT_REFUNDABLE} 이용자에게 수량과 사유가 안내됩니다.`,
        }
      : {
          request,
          title: '무상 지급분을 회수할까요?',
          confirmLabel: `${input.credits}장 회수`,
          amountLine: `무상 지급분 ${input.credits}장 (회수할 수 있는 ${ledger.revocable}장 → ${ledger.revocable - input.credits}장)`,
          reasonLine,
          resultLine: '이용자에게 수량과 사유가 안내됩니다.',
        },
  );
}

/**
 * 앞의 고정본과 같은 지급 · 회수인가 — 같으면 그 고정본(요청 번호 · 읽은 버전째)을 다시 낸다(응답이 끊긴 뒤의 재시도). 첫 누름이
 * 이미 섰으면 DB 가 같은 줄을 돌려주고(「이미 지급했습니다」), 안 섰으면 그때 읽은 버전으로 다시 잰다. 성공한 뒤에는 부르는 쪽이
 * 고정본을 버린다 — 같은 값으로 한 번 더 주는 것은 새 요청이다.
 */
export const samePlan = (plan: GrantPlan | null, input: Omit<GrantRequest, 'seenVersion' | 'requestId'>): boolean =>
  plan !== null &&
  plan.request.kind === input.kind &&
  plan.request.userId === input.userId &&
  plan.request.credits === input.credits &&
  plan.request.reason === input.reason &&
  plan.request.note === input.note.trim() &&
  plan.request.reportId === input.reportId;

/**
 * 실패한 누름 뒤에 고정본을 어떻게 하나.
 *
 * - **결과를 모른다**(응답이 끊겼다 — `ACTION_UNREACHED_NOTE`): 서버에서 섰을 수 있다. 고정본(요청 번호 · 읽은 버전)을 지켜 두고
 *   화면을 다시 읽는다 — 같은 값으로 다시 누르면 같은 요청 번호로 가서 섰으면 첫 결과(「이미 지급했습니다」), 안 섰으면 그때 한 번.
 * - **서버가 분명히 거절했다**(버전 충돌 · 상한 · 회수할 수 있는 수 · 권한 …): 그 고정본으로는 다시 내도 같은 거절이다. 버리고 화면을
 *   다시 읽는다 — 다음 누름은 새 읽은 버전 · 새 요청 번호로 새 확인을 연다.
 */
export const afterFailure = (message: string, unreached: string): 'keep' | 'discard' =>
  message === unreached ? 'keep' : 'discard';

/** 회수 단추를 잠글 까닭 — 회수할 것이 없으면 한 줄, 있으면 `null` */
export function revokeBlocked(revocable: number, reserved: number): string | null {
  if (revocable > 0) return null;
  return reserved > 0 ? `회수할 무상 지급분이 없습니다 — 예약 중 ${reserved}장은 풀린 뒤 회수합니다.` : '회수할 무상 지급분이 없습니다.';
}

// ── 이력 ─────────────────────────────────────────────────────────────────────

export const HISTORY_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'orders', label: '구매 · 환불' },
  { value: 'grants', label: '지급 · 회수' },
  { value: 'uses', label: '사용' },
] as const;

export type HistoryFilter = (typeof HISTORY_FILTERS)[number]['value'];

export const historyFilterOf = (value: string | string[] | undefined): HistoryFilter => {
  const text = Array.isArray(value) ? value[0] : value;
  return HISTORY_FILTERS.find((filter) => filter.value === text)?.value ?? 'all';
};

/** 한 번에 보이는 줄 수와 「더 보기」의 위 끝 — DB 는 500 까지 받는다 */
export const HISTORY_PAGE = 30;
export const HISTORY_MAX = 300;

export const historyLimitOf = (value: string | string[] | undefined): number => {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(n) || n < HISTORY_PAGE) return HISTORY_PAGE;
  return Math.min(HISTORY_MAX, Math.ceil(n / HISTORY_PAGE) * HISTORY_PAGE);
};

export type HistoryLine = {
  readonly at: string;
  readonly kind: string;
  readonly source: string;
  readonly delta: number | null;
  readonly state: string | null;
  readonly cause: string | null;
  readonly reason: string | null;
  readonly note: string | null;
  readonly orderNumber: string | null;
  readonly actorNickname: string | null;
  readonly reportId: string | null;
  readonly carriedOver: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  free: '가입 무료',
  grant: '무상 지급',
  bundle: '유료 구매',
  outside: '몫 밖',
};

export const sourceLabel = (source: string): string => SOURCE_LABEL[source] ?? source;

const KIND_LABEL: Record<string, string> = {
  purchase: '구매',
  refund: '환불',
  use: '사용',
  grant: '지급',
  revoke: '회수',
};

export const historyKindLabel = (kind: string): string => KIND_LABEL[kind] ?? kind;

/**
 * 증감 사유 — 사용 줄은 상태가 말한다. 확정은 「풀이 사용」 · 「인연 요청 사용」, 예약은 무엇이 잡았나(「풀이」 · 「인연 요청」 —
 * 「예약 중」은 증감 칸이 말한다), 풀림은 「반환 · 차감 없음」.
 * 지급 · 회수 · 환불은 갈래다.
 */
export function historyCause(line: HistoryLine): string {
  if (line.kind === 'use') {
    const what = line.cause === 'request' ? '인연 요청' : '풀이';
    if (line.state === 'released') return '반환 · 차감 없음';
    if (line.state === 'reserved') return what;
    return `${what} 사용`;
  }
  if (line.kind === 'purchase') return '구매';
  if (line.kind === 'refund') return line.reason === null ? '환불' : `환불 — ${refundReasonLabel(line.reason)}`;
  if (line.kind === 'grant' && line.carriedOver) return '운영 지급 — 기록 이전';
  return line.reason === null ? historyKindLabel(line.kind) : grantReasonLabel(line.reason);
}

/**
 * 증감 칸 — 풀이권의 증감이라 늘 「장」이다(「회」는 실제 풀이 횟수에만 쓴다). 확정 사용은 「−1장」, 예약은 부호 없이 「예약 중」,
 * 반환은 숫자 없이 빈 칸이다 — 사유 칸의 「반환 · 차감 없음」이 말한다(−1 · +1 로 읽히지 않게).
 */
export function historyAmount(line: HistoryLine): string {
  if (line.kind === 'use') {
    if (line.state === 'released') return '';
    if (line.state === 'reserved') return '예약 중';
  }
  if (line.delta === null) return '';
  return line.delta >= 0 ? `+${line.delta}장` : `−${Math.abs(line.delta)}장`;
}
