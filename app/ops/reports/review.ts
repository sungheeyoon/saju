import { REPORT_REASONS } from '@/src/lib/account';

import { accountLabel } from '../account-label';
import { firstLine } from '../first-line';
import { statusReasonLabel, UNRECORDED } from '../members/suspension';
import { reasonLabel, reviewOutcomeLabel, REVIEW_LABEL, sideOf, type Side } from './labels';

/**
 * **신고 처분의 「실행 전 확인」** — 처분 폼이 확인창에 보이는 값과 서버에 내는 값을 한 자리에서 짓는다(G-111 ②, ADR 0188).
 *
 * 처분 단추를 누르는 순간 값을 고정해(`ReviewPlan`) 그 고정본으로 단추 이름 · 확인창을 그리고, 같은 고정본을 그대로 낸다 — 창이 열린
 * 뒤 폼을 바꿔도 내는 것은 창에 보인 값이다. 서버는 운영자인가 · 신고 · 제재 대상 · 읽은 처리 버전 · 요청 번호를 다시 잰다.
 */

export const OUTCOMES = ['no_action', 'needs_more', 'warning', 'suspension'] as const;

export type Outcome = (typeof OUTCOMES)[number];

export const isOutcome = (value: string): value is Outcome => (OUTCOMES as readonly string[]).includes(value);

/** 경고 · 이용 정지 결정은 제재 대상이 있다 — DB 의 `sanction_follows_the_outcome` 과 같은 갈래 */
export const sanctions = (outcome: Outcome): boolean => outcome === 'warning' || outcome === 'suspension';

/** 판단 근거의 길이 — DB 의 `review_note` 검사식과 같은 수 */
export const NOTE_MAX = 500;

/** 경고 3회째부터 이용 정지 결정을 검토한다(ADR 0108) */
const REVIEW_SUSPENSION_FROM = 3;

export const SIDE_NAME: Record<Side, string> = { reported: '신고받은 계정', reporter: '신고한 계정' };

/** 확인창 · 폼이 아는 계정 — 대상 요약 문이 낸다 */
export type Party = {
  readonly side: Side;
  readonly userId: string;
  readonly nickname: string | null;
  readonly status: string | null;
  readonly isOperator: boolean;
  /** 현재 신고 기준 최근 12개월 경고 수 */
  readonly warnings12m: number;
  /** 이 신고의 지금 경고가 위 수에 들었는가 */
  readonly warnedHere: boolean;
};

/** 폼이 아는 신고의 지금 */
export type ReportNow = {
  readonly reportId: string;
  readonly reason: string;
  readonly isOpen: boolean;
  /** 지금 결과 — 처음이면 `null` */
  readonly outcome: string | null;
  /** 처리 버전 — 처분 이력 줄 수 */
  readonly version: number;
};

export type ReviewInput = {
  readonly outcome: Outcome;
  readonly side: Side;
  readonly warningCategory: string;
  readonly note: string;
};

/** 서버에 내는 값 — 확인창에 보인 그대로 */
export type ReviewRequest = {
  readonly reportId: string;
  readonly outcome: Outcome;
  readonly note: string;
  /** 경고 · 이용 정지 결정의 제재 대상 — 그 밖에는 `null` */
  readonly sanctionedUserId: string | null;
  /** 경고의 갈래 — 경고가 아니면 `null` */
  readonly warningCategory: string | null;
  /** 화면이 읽은 처리 버전 — 다르면 서버가 거절한다(「다른 운영자가 먼저 처리했습니다」) */
  readonly seenVersion: number;
  /** 처분 단추를 누를 때 지은 요청 번호 — 응답이 끊겨 다시 내면 같은 결과가 돌아온다 */
  readonly requestId: string;
};

export type ReviewPlan = {
  readonly request: ReviewRequest;
  /** 확인창을 거치는가 — 경고 · 이용 정지 결정과 처분 바꾸기 전부(처음 적는 조치 없음 · 추가 확인에는 없다) */
  readonly confirm: boolean;
  readonly title: string;
  /** 실행 단추 — 「경고로 처분」 · 「이용 정지」 · 「경고로 바꾸기」 */
  readonly confirmLabel: string;
  readonly danger: boolean;
  /** 신고 — id 앞 8자 */
  readonly reportLine: string;
  /** 제재 대상 — 「닉네임 · 3f2a9c1e · 신고받은 계정」, 대상이 없으면 `null` */
  readonly targetLine: string | null;
  /** 처분 전 → 후 — 「처리 필요 → 경고(괴롭힘이나 위협)」 */
  readonly changeLine: string;
  /** 판단 근거의 첫 줄 */
  readonly reasonLine: string;
  /** 실행 결과 */
  readonly resultLines: readonly string[];
};

/** 처분 바꾸기인가 — 처리 완료(조치 없음 · 경고 · 이용 정지 결정)인 신고에 다시 적는 것 */
const isChange = (now: ReportNow): boolean => !now.isOpen;

const FIRST_LABEL: Record<Outcome, string> = {
  no_action: '조치 없음으로 처리',
  needs_more: '추가 확인으로 남기기',
  warning: '경고로 처분',
  suspension: '이용 정지',
};

const CHANGE_LABEL: Record<Outcome, string> = {
  no_action: '조치 없음으로 바꾸기',
  needs_more: '추가 확인으로 바꾸기',
  warning: '경고로 바꾸기',
  suspension: '이용 정지 결정으로 바꾸기',
};

/** 확인창의 제목 — 처음 적는 조치 없음 · 추가 확인은 창을 안 거치지만 고정본은 같은 모양이다 */
const FIRST_TITLE: Record<Outcome, string> = {
  no_action: '조치 없음으로 처리할까요?',
  needs_more: '추가 확인으로 남길까요?',
  warning: '경고로 처분할까요?',
  suspension: '이용 정지할까요?',
};

const DONE: Record<Outcome, string> = {
  no_action: '조치 없음으로 처리했습니다.',
  needs_more: '추가 확인으로 남겼습니다.',
  warning: '경고로 처분했습니다.',
  suspension: '이용 정지했습니다.',
};

/** 처분이 선 뒤의 한 줄 — 같은 요청의 재시도였으면 이미 처리됐다고 말한다 */
export const doneNote = (changed: boolean, outcome: Outcome, replayed: boolean): string =>
  replayed ? '이미 처리했습니다.' : changed ? '처분을 바꿨습니다.' : DONE[outcome];

/** 처분 단추의 말 — 결과를 말한다. 확인창의 실행 단추도 같은 말이다 */
export const actionLabel = (now: ReportNow, outcome: Outcome): string =>
  (isChange(now) ? CHANGE_LABEL : FIRST_LABEL)[outcome];

/** 확인창을 거치는가 */
export const needsConfirm = (now: ReportNow, outcome: Outcome): boolean => isChange(now) || sanctions(outcome);

/** 처분 전 — 처음이면 「처리 필요」, 추가 확인 필요면 그 이름, 처리 완료면 그 결과 */
const beforeLabel = (now: ReportNow): string =>
  now.outcome === null ? REVIEW_LABEL.open : reviewOutcomeLabel(now.outcome);

/**
 * 「이번이 N회째 경고」의 N — **현재 신고 기준** 최근 12개월 경고 수에 이번 것을 더한다. 이 신고가 이미 그 대상에게 경고로 적혀
 * 있으면(경고를 경고로 고치는 것) 그 건은 이미 수에 들었으므로 한 번만 센다.
 */
export const warningOrdinal = (party: Pick<Party, 'warnings12m' | 'warnedHere'>): number =>
  party.warnings12m - (party.warnedHere ? 1 : 0) + 1;

export function warningSentence(party: Pick<Party, 'warnings12m' | 'warnedHere'>): string {
  const n = warningOrdinal(party);
  const said = `현재 신고 기준 이번이 ${n}회째 경고입니다.`;
  return n >= REVIEW_SUSPENSION_FROM ? `${said} 이용 정지 결정을 검토하세요.` : said;
}

/** 정지 결정을 다른 결과로 바꿔도 정지는 남는다 — 해제는 회원 화면에서 따로(G-111 ③) */
export const HELD_SUSPENSION = '계정은 아직 이용 정지 상태입니다 — 해제는 회원 화면에서.';

/** 확인창의 실행 결과 줄 */
function resultLines(now: ReportNow, outcome: Outcome, target: Party | null): readonly string[] {
  const lines: string[] = [];
  if (isChange(now)) lines.push('이미 적힌 결과를 바꿉니다.');
  if (outcome === 'warning') lines.push('이용자에게 갈래와 안내번호가 갑니다.');
  if (outcome === 'suspension') {
    lines.push(target?.status === 'suspended' ? '계정은 이미 이용 정지 상태입니다.' : '대화방이 닫히고 모든 이용이 막힙니다.');
  }
  if (now.outcome === 'suspension' && outcome !== 'suspension') lines.push(HELD_SUSPENSION);
  return lines;
}

/** 경고 갈래 — 신고 사유와 같은 값 · 글자다(ADR 0108) */
export const WARNING_CATEGORIES = REPORT_REASONS;

/**
 * 처분 단추를 누르는 순간의 처분 — `requestId` 는 부르는 쪽이 넘긴다(같은 값으로 다시 내는 재시도는 앞 번호를 다시 쓴다).
 * 경고 · 정지가 아니면 제재 대상 · 갈래는 비운다.
 */
export function reviewPlan(
  now: ReportNow,
  parties: readonly Party[],
  input: ReviewInput,
  requestId: string,
): ReviewPlan {
  const target = sanctions(input.outcome) ? (parties.find((party) => party.side === input.side) ?? null) : null;
  const warning = input.outcome === 'warning';
  const request: ReviewRequest = Object.freeze({
    reportId: now.reportId,
    outcome: input.outcome,
    note: input.note.trim(),
    sanctionedUserId: target?.userId ?? null,
    warningCategory: warning ? input.warningCategory : null,
    seenVersion: now.version,
    requestId,
  });
  const after = warning
    ? `${reviewOutcomeLabel(input.outcome)}(${reasonLabel(input.warningCategory)})`
    : reviewOutcomeLabel(input.outcome);
  const label = actionLabel(now, input.outcome);
  return Object.freeze({
    request,
    confirm: needsConfirm(now, input.outcome),
    title: isChange(now) ? '처분을 바꿀까요?' : FIRST_TITLE[input.outcome],
    confirmLabel: label,
    danger: input.outcome === 'suspension',
    reportLine: now.reportId.slice(0, 8),
    targetLine: target === null ? null : `${accountLabel(target.nickname, target.userId)} · ${SIDE_NAME[target.side]}`,
    changeLine: `${beforeLabel(now)} → ${after}`,
    reasonLine: firstLine(input.note),
    resultLines: resultLines(now, input.outcome, target),
  });
}

/**
 * 앞의 고정본과 같은 처분인가 — 같으면 그 고정본(요청 번호 · 읽은 버전째)을 다시 낸다(응답이 끊긴 뒤의 재시도). 첫 누름이 이미
 * 섰으면 DB 가 첫 결과를 돌려주고(「이미 처리했습니다」), 안 섰으면 그때 읽은 버전으로 다시 잰다.
 */
export const samePlan = (
  plan: ReviewPlan | null,
  now: ReportNow,
  parties: readonly Party[],
  input: ReviewInput,
): boolean => {
  if (plan === null || plan.request.reportId !== now.reportId) return false;
  const fresh = reviewPlan(now, parties, input, plan.request.requestId);
  return (
    plan.request.outcome === fresh.request.outcome &&
    plan.request.note === fresh.request.note &&
    plan.request.sanctionedUserId === fresh.request.sanctionedUserId &&
    plan.request.warningCategory === fresh.request.warningCategory
  );
};

/** 제재 대상을 고를 때 막는 까닭 — 정지할 수 없는 계정이면 한 줄, 아니면 `null`. 최종으로 막는 것은 서버다 */
export function suspensionBlocked(target: Party | undefined): string | null {
  if (target === undefined) return null;
  if (target.isOperator) return '운영자 계정은 정지할 수 없습니다.';
  if (target.status === 'deletion_requested') return '탈퇴를 신청한 계정이라 정지할 수 없습니다.';
  return null;
}

/** 처분 이력의 줄 — 상세 문이 내는 `review_log` 의 한 칸 */
export type ReviewLogLine = {
  readonly version: number;
  readonly outcome: string | null;
  readonly sanctionedSide: Side | null;
  readonly warningCategory: string | null;
  readonly note: string | null;
  readonly actorNickname: string | null;
  readonly at: string;
  readonly carriedOver: boolean;
};

const textOf = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** 상세 문의 `review_log`(jsonb) 를 줄로 — 모양이 아닌 칸은 비운다 */
export function reviewLogOf(value: unknown): readonly ReviewLogLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ReviewLogLine[] => {
    if (typeof item !== 'object' || item === null) return [];
    const line = item as Record<string, unknown>;
    if (typeof line.version !== 'number' || typeof line.at !== 'string') return [];
    return [
      {
        version: line.version,
        outcome: textOf(line.outcome),
        sanctionedSide: sideOf(textOf(line.sanctioned_side)),
        warningCategory: textOf(line.warning_category),
        note: textOf(line.note),
        actorNickname: textOf(line.actor_nickname),
        at: line.at,
        carriedOver: line.carried_over === true,
      },
    ];
  });
}

/** 대상 요약의 처분 이력 한 칸 — 신고의 경고 · 이용 정지 결정 또는 계정 상태 이력 */
export type SanctionLine = {
  readonly at: string;
  readonly kind: string;
  readonly reason: string | null;
  readonly reportId: string | null;
};

export function sanctionLinesOf(value: unknown): readonly SanctionLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SanctionLine[] => {
    if (typeof item !== 'object' || item === null) return [];
    const line = item as Record<string, unknown>;
    if (typeof line.at !== 'string' || typeof line.kind !== 'string') return [];
    return [{ at: line.at, kind: line.kind, reason: textOf(line.reason), reportId: textOf(line.report_id) }];
  });
}

/** 처분 이력 한 칸의 말 — 「경고 · 괴롭힘이나 위협」 · 「이용 정지 · 결제 부정」 · 「정지 해제 · 소명 인정」 */
export function sanctionLabel(line: SanctionLine): string {
  if (line.kind === 'warning') return line.reason === null ? '경고' : `경고 · ${reasonLabel(line.reason)}`;
  if (line.kind === 'suspension') return '이용 정지 결정';
  // 탈퇴 대기에서 돌아온 것은 정지를 푼 것이 아니다
  if (line.reason === 'deletion_withdrawn') return statusReasonLabel('deletion_withdrawn');
  const what = line.kind === 'suspended' ? '이용 정지' : '정지 해제';
  if (line.reason === null) return `${what} · ${UNRECORDED}`;
  return `${what} · ${statusReasonLabel(line.reason)}`;
}
