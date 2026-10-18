import { firstLine } from '../first-line';
import { NO_NICKNAME, accountStatusLabel, reasonLabel, reviewOutcomeLabel } from '../reports/labels';

/**
 * **회원 화면의 이용 정지 · 해제의 「실행 전 확인」과 처분 이력의 말** — 확인창에 보이는 값과 서버에 내는 값을 한 자리에서 짓는다
 * (G-111 ③, ADR 0189).
 *
 * 무상 지급(`credit-grant.ts`, ADR 0187)과 같은 모양이다 — 확인창을 여는 순간 값을 고정해(`StatusPlan`) 그 고정본으로 단추 이름 ·
 * 본문을 그리고, 같은 고정본을 그대로 낸다. 서버는 운영자인가 · 지금 상태 · 운영자 계정 · 읽은 버전 · 요청 번호를 다시 잰다.
 */

/** 메모의 길이 — DB 의 `account_status_change.note` 검사식과 같은 수 */
export const NOTE_MAX = 200;

/** 신고와 무관한 정지의 갈래(G-111-8) — 신고로 정지하는 것은 신고 상세의 처분이다 */
const SUSPEND_REASONS = [
  { value: 'policy', label: '운영정책 위반' },
  { value: 'payment', label: '결제 부정' },
  { value: 'eligibility', label: '이용 자격' },
  { value: 'other', label: '기타' },
] as const;

const UNSUSPEND_REASONS = [
  { value: 'appeal', label: '소명 인정' },
  { value: 'mistake', label: '잘못 정지' },
  { value: 'other', label: '기타' },
] as const;

export type StatusKind = 'suspend' | 'unsuspend';

const REASONS: Record<StatusKind, readonly { readonly value: string; readonly label: string }[]> = {
  suspend: SUSPEND_REASONS,
  unsuspend: UNSUSPEND_REASONS,
};

export const reasonsOf = (kind: StatusKind) => REASONS[kind];

export const isStatusReason = (kind: StatusKind, value: string): boolean =>
  REASONS[kind].some((reason) => reason.value === value);

/** 계정 상태 이력의 갈래 이름 — 신고의 정지 결정 · 탈퇴 대기의 해제까지. 모르는 값은 그대로 */
const STATUS_REASON_LABEL: Readonly<Record<string, string>> = {
  report: '신고 처분',
  policy: '운영정책 위반',
  payment: '결제 부정',
  eligibility: '이용 자격',
  other: '기타',
  appeal: '소명 인정',
  mistake: '잘못 정지',
  deletion_withdrawn: '탈퇴 대기 해제',
};

export const statusReasonLabel = (value: string): string => STATUS_REASON_LABEL[value] ?? value;

/** 공통 함수 밖의 변경(직접 UPDATE) — 실행자 · 갈래가 빈 상태 이력 줄의 딱지 */
export const UNRECORDED = '실행자 · 사유 없음';

/** 처분 이력 문이 낸 그 계정의 지금 — 단추를 고르고 읽은 버전을 든다 */
export type Standing = {
  readonly status: string;
  readonly isOperator: boolean;
  /** 그 계정의 상태 이력 줄 수 — 정지 · 해제 문이 받는 「읽은 버전」 */
  readonly version: number;
  /** 현재 신고 기준 최근 12개월 경고 수 */
  readonly warnings12m: number;
};

/**
 * 계정 칸에 무엇을 세우나 — 이용 중이면 「이용 정지」, 이용 정지면 「정지 해제」, 운영자 계정이면 단추 없이 딱지(G-111-10),
 * 탈퇴 대기면 단추 없이 한 줄(해제는 런북).
 */
type StatusAction =
  | { readonly kind: StatusKind }
  | { readonly kind: 'operator' }
  | { readonly kind: 'none'; readonly note: string };

export function statusAction(standing: Pick<Standing, 'status' | 'isOperator'>): StatusAction {
  if (standing.status === 'active') return standing.isOperator ? { kind: 'operator' } : { kind: 'suspend' };
  if (standing.status === 'suspended') return { kind: 'unsuspend' };
  if (standing.status === 'deletion_requested') return { kind: 'none', note: '탈퇴 대기 — 해제는 런북' };
  return { kind: 'none', note: '이 상태는 화면에서 바꾸지 않습니다' };
}

/** 서버에 내는 값 — 확인창에 보인 그대로 */
export type StatusRequest = {
  readonly kind: StatusKind;
  readonly userId: string;
  readonly reason: string;
  readonly note: string;
  /** 화면이 읽은 그 계정의 상태 이력 줄 수 — 다르면 서버가 거절한다 */
  readonly seenVersion: number;
  /** 확인창을 열 때 지은 요청 번호 — 응답이 끊겨 다시 내면 같은 줄이 돌아온다 */
  readonly requestId: string;
};

type StatusInput = Omit<StatusRequest, 'seenVersion' | 'requestId'>;

export type StatusPlan = {
  readonly request: StatusRequest;
  readonly title: string;
  /** 확인 단추 — 「이용 정지」 · 「정지 해제」 */
  readonly confirmLabel: string;
  /** 처분 칸 — 「이용 중 → 이용 정지」 */
  readonly changeLine: string;
  /** 사유 칸 — 「결제 부정 — <메모 첫 줄>」 */
  readonly reasonLine: string;
  /** 결과 칸 */
  readonly resultLine: string;
};

/** 확인창의 대상 — 닉네임 · 계정 id 앞 8자(동명이인을 가른다) */
export const memberLabel = (nickname: string | null, userId: string): string =>
  `${nickname ?? NO_NICKNAME} · ${userId.slice(0, 8)}`;

/** 확인창을 여는 순간의 정지 · 해제 — `requestId` 는 부르는 쪽이 넘긴다(응답이 끊긴 뒤의 재시도는 앞 번호를 다시 쓴다) */
export function statusPlan(standing: Pick<Standing, 'version'>, input: StatusInput, requestId: string): StatusPlan {
  const request: StatusRequest = Object.freeze({ ...input, note: input.note.trim(), seenVersion: standing.version, requestId });
  const reasonLine = `${statusReasonLabel(input.reason)} — ${firstLine(input.note)}`;
  return Object.freeze(
    input.kind === 'suspend'
      ? {
          request,
          title: '이용 정지할까요?',
          confirmLabel: '이용 정지',
          changeLine: `${accountStatusLabel('active')} → ${accountStatusLabel('suspended')}`,
          reasonLine,
          resultLine: '대화방이 닫히고 모든 이용이 막힙니다.',
        }
      : {
          request,
          title: '정지를 풀까요?',
          confirmLabel: '정지 해제',
          changeLine: `${accountStatusLabel('suspended')} → ${accountStatusLabel('active')}`,
          reasonLine,
          // 방의 닫힘은 상태라 해제가 되살리지 않는다(ADR 0091 「되살아난 계정에 방을 다시 여는 길」)
          resultLine: '닫힌 대화방은 다시 열리지 않습니다.',
        },
  );
}

/**
 * 앞의 고정본과 같은 정지 · 해제인가 — 같으면 그 고정본(요청 번호 · 읽은 버전째)을 다시 낸다(응답이 끊긴 뒤의 재시도). 첫 누름이
 * 이미 섰으면 DB 가 같은 줄을 돌려주고(「이미 처리했습니다」), 안 섰으면 그때 읽은 버전으로 다시 잰다.
 */
export const samePlan = (plan: StatusPlan | null, input: StatusInput): boolean =>
  plan !== null &&
  plan.request.kind === input.kind &&
  plan.request.userId === input.userId &&
  plan.request.reason === input.reason &&
  plan.request.note === input.note.trim();

const DONE: Record<StatusKind, string> = { suspend: '이용 정지했습니다.', unsuspend: '정지를 해제했습니다.' };

/** 성공 뒤의 한 줄 — 같은 요청의 재시도였으면 이미 처리됐다고 말한다 */
export const doneNote = (kind: StatusKind, replayed: boolean): string => (replayed ? '이미 처리했습니다.' : DONE[kind]);

// ── 처분 이력 ────────────────────────────────────────────────────────────────

/** 처분 이력 한 줄 — 신고의 경고 · 이용 정지 결정(`report`) 또는 계정 상태 이력(`status`) */
export type SanctionEntry = {
  readonly id: string;
  readonly source: 'report' | 'status';
  readonly at: string;
  /** 신고면 `warning` · `suspension`, 상태면 바뀐 뒤의 상태 `suspended` · `active` */
  readonly kind: string;
  /** 상태면 바뀌기 전 — 탈퇴 대기의 해제를 정지 해제와 가른다 */
  readonly fromStatus: string | null;
  /** 경고 갈래 또는 상태 이력의 갈래 */
  readonly reason: string | null;
  /** 운영자의 메모 — 상태 이력만. 판단 근거는 신고 상세가 든다 */
  readonly note: string | null;
  readonly reportId: string | null;
  readonly warningRef: string | null;
  readonly acknowledgedAt: string | null;
  /** 경고 3회째의 셈에 드는가(ADR 0108) */
  readonly counted: boolean;
  /** 갈래 · 실행자가 남았나 — 거짓이면 공통 함수 밖의 변경이다 */
  readonly recorded: boolean;
  readonly actorNickname: string | null;
};

const textOf = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** 처분 이력 문의 `lines`(jsonb) 를 줄로 — 모양이 아닌 칸은 버린다 */
export function sanctionEntriesOf(value: unknown): readonly SanctionEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SanctionEntry[] => {
    if (typeof item !== 'object' || item === null) return [];
    const line = item as Record<string, unknown>;
    const source = line.source === 'report' || line.source === 'status' ? line.source : null;
    if (source === null || typeof line.id !== 'string' || typeof line.at !== 'string' || typeof line.kind !== 'string') {
      return [];
    }
    return [
      {
        id: line.id,
        source,
        at: line.at,
        kind: line.kind,
        fromStatus: textOf(line.from_status),
        reason: textOf(line.reason),
        note: textOf(line.note),
        reportId: textOf(line.report_id),
        warningRef: textOf(line.warning_ref),
        acknowledgedAt: textOf(line.acknowledged_at),
        counted: line.counted === true,
        recorded: line.recorded === true,
        actorNickname: textOf(line.actor_nickname),
      },
    ];
  });
}

/** 처분 이력 한 줄의 종류 — 「경고」 · 「이용 정지 결정」 · 「이용 정지」 · 「정지 해제」 · 「탈퇴 대기 해제」 */
export function sanctionKindLabel(entry: Pick<SanctionEntry, 'source' | 'kind' | 'fromStatus'>): string {
  if (entry.source === 'report') return reviewOutcomeLabel(entry.kind);
  if (entry.kind === 'suspended') return '이용 정지';
  if (entry.kind === 'active') return entry.fromStatus === 'deletion_requested' ? '탈퇴 대기 해제' : '정지 해제';
  return accountStatusLabel(entry.kind);
}

/** 처분 이력 한 줄의 갈래 — 경고는 신고 사유의 글자, 상태 이력은 그 갈래. 없으면 `null` */
export function sanctionReasonLabel(entry: Pick<SanctionEntry, 'source' | 'reason'>): string | null {
  if (entry.reason === null) return null;
  return entry.source === 'report' ? reasonLabel(entry.reason) : statusReasonLabel(entry.reason);
}
