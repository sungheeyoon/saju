import { REPORT_REASONS, warningRefOf, type ReportReason } from '@/src/lib/account';

/**
 * 신고 목록의 **거르는 칸 셋과 쪽** — 주소가 곧 상태다.
 *
 * 화면은 읽기 전용이라(G-24 1차판, ADR 0103) 거르는 것도 누름이 아니라 링크다. 그래서 거른 상태는
 * 주소의 물음표 뒤에만 있고, 이 파일이 그것을 읽고 다시 짓는다. 판단은 여기 두고 화면(`.tsx`)은
 * 그리기만 한다 — vitest 는 `.tsx` 에 안 닿는다(ADR 0080).
 *
 * 모르는 값은 **걸러지지 않은 것으로** 읽는다. 오류로 세우면 손으로 친 주소 하나가 운영자 화면을
 * 깨뜨리고, 그 화면은 운영자가 가장 급할 때 여는 자리다.
 */

/**
 * 처리 상태 — `open` 은 처리 필요(안 봤거나 추가 확인 필요), `done` 은 처리 완료다. 무엇이 처리 필요인가는 DB 의
 * `report_is_open` 하나가 정한다(ADR 0107) — 여기서는 어느 쪽을 청하는지만 적는다.
 */
type ReviewFilter = 'all' | 'open' | 'done';
type EvidenceFilter = 'all' | 'chat' | 'none';

export type ReportFilters = {
  readonly review: ReviewFilter;
  readonly reason: ReportReason | null;
  readonly evidence: EvidenceFilter;
  /**
   * 안내번호로 찾기 — 이의 제기 메일에 적힌 `W-7K3F` 를 이메일 없이 경고로 잇는다(ADR 0108). 모양이 맞으면 표의 모양으로
   * 고쳐 두고, 안 맞으면 친 글자(대문자 · 앞 16자)를 그대로 보낸다 — 걸러지지 않은 목록을 세우면 운영자가 찾은 줄로 읽는다
   */
  readonly ref: string | null;
  /** 1 부터 센다 — 주소에 서는 수다 */
  readonly page: number;
};

export const NO_FILTERS: ReportFilters = { review: 'all', reason: null, evidence: 'all', ref: null, page: 1 };

/**
 * 쪽의 윗끝 — 주소에 아무 수나 적어 DB 에 큰 `offset` 을 보내지 않게. 한 쪽이 30건이니
 * 30만 건까지다. 그보다 많아지는 날이면 이 화면이 아니라 검색이 필요하다.
 */
const LAST_PAGE = 10_000;

type SearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

const one = (value: string | readonly string[] | undefined): string | undefined =>
  typeof value === 'string' ? value : value?.[0];

const REVIEWS: readonly ReviewFilter[] = ['all', 'open', 'done'];
const EVIDENCES: readonly EvidenceFilter[] = ['all', 'chat', 'none'];

const reasonOf = (value: string | undefined): ReportReason | null =>
  REPORT_REASONS.find((reason) => reason.value === value)?.value ?? null;

const refOf = (value: string | undefined): string | null => {
  const typed = value?.trim() ?? '';
  if (typed === '') return null;
  return warningRefOf(typed) ?? typed.toUpperCase().slice(0, 16);
};

export function filtersOf(params: SearchParams): ReportFilters {
  const review = one(params.review);
  const evidence = one(params.evidence);
  const page = Number(one(params.page));
  return {
    review: REVIEWS.find((known) => known === review) ?? 'all',
    reason: reasonOf(one(params.reason)),
    evidence: EVIDENCES.find((known) => known === evidence) ?? 'all',
    ref: refOf(one(params.ref)),
    page: Number.isInteger(page) && page >= 1 && page <= LAST_PAGE ? page : 1,
  };
}

/**
 * 거른 상태 하나를 바꾼 주소. **거르는 칸을 바꾸면 첫 쪽으로 돌아간다** — 셋째 쪽에서 사유를
 * 바꿨는데 셋째 쪽에 머물면 빈 쪽이 서기 쉽다. 쪽만 바꿀 때는 `page` 를 함께 준다.
 */
export function hrefOf(filters: ReportFilters, change: Partial<ReportFilters>): string {
  const next = { ...filters, page: 1, ...change };
  const query = new URLSearchParams();
  if (next.review !== 'all') query.set('review', next.review);
  if (next.reason !== null) query.set('reason', next.reason);
  if (next.evidence !== 'all') query.set('evidence', next.evidence);
  if (next.ref !== null) query.set('ref', next.ref);
  if (next.page !== 1) query.set('page', String(next.page));
  const said = query.toString();
  return said === '' ? '/ops/reports' : `/ops/reports?${said}`;
}

/** 목록 문의 인자 — 이름은 마이그레이션의 것이다(`operator_reports`). `p_reviewed` 는 「처리 완료인가」다 */
export function argsOf(filters: ReportFilters) {
  return {
    p_reviewed: filters.review === 'all' ? null : filters.review === 'done',
    p_reason: filters.reason,
    p_has_snapshot: filters.evidence === 'all' ? null : filters.evidence === 'chat',
    p_page: filters.page - 1,
    p_warning_ref: filters.ref,
  };
}

export const isFiltered = (filters: ReportFilters): boolean =>
  filters.review !== 'all' || filters.reason !== null || filters.evidence !== 'all' || filters.ref !== null;

/**
 * 신고 id 로 읽을 수 있는 모양인가 — **DB 에 묻기 전에** 가른다.
 *
 * uuid 가 아닌 값을 보내면 PostgREST 가 함수에 닿기 전에 형 변환으로 거절한다(`22P02`). 그러면
 * 운영자가 아닌 사람에게 「없는 화면」(404) 대신 「읽지 못했다」가 서고, 그 차이가 곧 「여기 뭔가
 * 있다」는 신호다. 모양이 아니면 없는 신고와 같은 답을 한다.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isReportId = (value: string): boolean => UUID.test(value);
