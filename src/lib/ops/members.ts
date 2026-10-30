import type { RpcRow } from '../db';
import type { GrantLedger, HistoryLine } from './credit-grant';
import { sanctionEntriesOf, type SanctionEntry, type Standing } from './suspension';

/** 회원 · 무상 지급 장부 · 처분 이력을 화면의 값으로 옮긴다 — 웹과 앱이 함께 쓴다 (G-110 ③, ADR 0185 · 0187 · 0189) */
/** DB 가 받는 찾는 말의 길이 — 넘으면 `22023` 이라 묻기 전에 거른다 */
export const QUERY_MAX = 64;

/** 출처 하나의 장부 — 받은(산) 수 · 확정 쓰임 · 빈자리(받은 − 확정 − 예약, 묶음은 걷은 것 · 확보 중인 것도 뺀다) */
export type CreditSource = {
  readonly received: number;
  readonly used: number;
  readonly left: number;
};

/**
 * 풀이권 — `available` 은 이용자 본인 화면과 같은 셈(`reading_credits_for`)이고, 출처별은 쓰임 장부다. 풀이 대상을 지우면 셈은
 * 자리를 돌려주지만 장부의 확정 줄은 남아 둘의 합이 다를 수 있다(`20261214080000`).
 */
export type MemberCredits = {
  /** 지금 쓸 수 있는 풀이권 — 본인 화면의 잔액 */
  readonly available: number;
  /** 가입 무료 */
  readonly free: CreditSource;
  /** 운영 무상 지급 */
  readonly granted: CreditSource;
  /** 유료 구매 — `received` 는 산 수 합, 환불로 걷은 수는 `refunded` */
  readonly bought: CreditSource & { readonly refunded: number };
  /** 몫을 가리지 않은 예약 중 — 도는 풀이 · 답을 기다리는 요청 */
  readonly reserved: number;
  /** 진행 중인 환불 확보가 잡은 수 */
  readonly held: number;
  /** 몫을 가리지 않은 확정 쓰임 — 만든 풀이의 수 */
  readonly usedAll: number;
  /** 그중 몫 밖 — 지운 대상으로 돌아온 자리로 쓴 것 */
  readonly outsideUsed: number;
};

export type Member = {
  readonly userId: string;
  readonly nickname: string | null;
  readonly status: string;
  readonly credits: MemberCredits;
  /** 승인된 적 있는 주문의 번호(`rdo_…`), 최근 것부터 — 주문 화면(`/ops/orders?order=`)으로 가는 길이다 */
  readonly orderNumbers: readonly string[];
};

export type MemberRecord = {
  readonly member: Member;
};

export const memberOf = (row: RpcRow<'operator_member'>): Member => ({
  userId: row.user_id,
  nickname: row.nickname ?? null,
  status: row.status,
  credits: {
    available: row.available,
    free: { received: row.free_credits, used: row.free_used, left: row.free_left },
    granted: { received: row.granted_credits, used: row.granted_used, left: row.granted_left },
    bought: {
      received: row.bought_credits,
      used: row.used_bought,
      left: row.bundle_left,
      refunded: row.refunded_credits,
    },
    reserved: row.reserved_all,
    held: row.held_credits,
    usedAll: row.used_all,
    outsideUsed: row.outside_used,
  },
  orderNumbers: row.order_numbers ?? [],
});

/** 찾는 말 — 앞뒤 빈칸을 걷고, 비었거나 DB 가 안 받을 길이면 `null`(묻지 않는다) */
export const queryOf = (value: string | string[] | undefined): string | null => {
  const text = (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
  return text.length === 0 || text.length > QUERY_MAX ? null : text;
};

export type MemberGrantLedger = GrantLedger & {
  readonly used: number;
  readonly reserved: number;
};

export const ledgerOf = (row: RpcRow<'operator_member_grant_ledger'>): MemberGrantLedger => ({
  granted: row.granted,
  used: row.used,
  reserved: row.reserved,
  revocable: row.revocable,
  version: row.version,
});

export const historyLineOf = (row: RpcRow<'operator_member_credit_history'>): HistoryLine => ({
  key: row.line_key,
  at: row.at,
  kind: row.kind,
  source: row.source,
  delta: row.delta ?? null,
  state: row.state ?? null,
  cause: row.cause ?? null,
  reason: row.reason ?? null,
  note: row.note ?? null,
  orderNumber: row.order_number ?? null,
  actorNickname: row.actor_nickname ?? null,
  reportId: row.report_id ?? null,
  carriedOver: row.carried_over === true,
});

export type MemberSanctions = Standing & { readonly entries: readonly SanctionEntry[] };

export const sanctionsOf = (row: RpcRow<'operator_member_sanctions'>): MemberSanctions => ({
  status: row.status,
  isOperator: row.is_operator === true,
  version: row.version,
  warnings12m: row.warnings_12m,
  entries: sanctionEntriesOf(row.lines ?? null),
});
