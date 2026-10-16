import { rpcArgs, type RpcRow } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { noteDenial } from '../denial';

/**
 * 회원 한 명이 **브라우저로 내려오는 문** (G-110 ③, ADR 0185).
 *
 * 신고 화면의 문(`../reports/read.ts`)과 같은 규율이다. **운영자인지 여기서 안 묻는다** — 묻는 자리는 DB 의
 * `is_operator()` 하나고, 자료를 청해서 거절당하는 것으로 안다(`42501`). **문이 읽을 때마다 DB 가 접속기록에 한 줄을
 * 적는다** — 성공은 문 안에서(`members.find` · `members.warnings`), 거절은 아래 `noteDenial` 이 머리 문의 이름 한 줄로.
 * 기록에는 찾은 말(닉네임)이 안 들어간다 — 무엇으로 찾았나와 찾은 계정 id 만이다.
 *
 * 찾는 열쇠는 닉네임이나 계정 id 다 — 이메일은 문이 받지도 내지도 않는다. 닉네임은 유일하므로 찾으면 한 명이다.
 *
 * 생성 타입은 반환 칸을 전부 `null` 이 아닌 것으로 적는다(`returns table` 의 한계) — 닉네임 · 경고 칸은 실제로 빈다.
 */

/** 운영자가 아니라고 DB 가 답했다 — `42501` */
export const DENIED = 'denied';

/** DB 가 받는 찾는 말의 길이 — 넘으면 `22023` 이라 묻기 전에 거른다 */
export const QUERY_MAX = 64;

type Asked = { readonly error: { readonly code?: string } | null };

const denied = (answers: readonly Asked[]): boolean => answers.some((answer) => answer.error?.code === '42501');

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

export type MemberWarning = {
  readonly reportId: string;
  readonly reviewedAt: string;
  /** `warning` · `suspension` — 이 계정이 제재 대상으로 적힌 검토만 온다 */
  readonly outcome: string;
  readonly ref: string | null;
  readonly category: string | null;
  readonly acknowledgedAt: string | null;
  /** 경고 3회째의 셈에 드는가 — 경고이고 12개월 안(ADR 0108 추기). 정의는 DB 에 있다 */
  readonly counted: boolean;
};

type MemberRecord = {
  readonly member: Member;
  readonly warnings: readonly MemberWarning[];
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

export const warningOf = (row: RpcRow<'operator_member_warnings'>): MemberWarning => ({
  reportId: row.report_id,
  reviewedAt: row.reviewed_at,
  outcome: row.review_outcome,
  ref: row.warning_ref ?? null,
  category: row.warning_category ?? null,
  acknowledgedAt: row.warning_acknowledged_at ?? null,
  counted: row.counted === true,
});

/** 찾는 말 — 앞뒤 빈칸을 걷고, 비었거나 DB 가 안 받을 길이면 `null`(묻지 않는다) */
export const queryOf = (value: string | string[] | undefined): string | null => {
  const text = (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
  return text.length === 0 || text.length > QUERY_MAX ? null : text;
};

/**
 * 한 명을 찾고, 찾았으면 그 경고 이력을 청한다. 없으면 `null` — 화면은 「찾는 회원이 없습니다」를 세운다.
 * 못 읽으면 빈 결과가 아니라 실패다 — 신고 목록처럼 운영자 화면이 제 문장을 세운다.
 *
 * 찾는 말이 없어도(`null`) 문을 부른다 — 그때 문은 운영자인가만 묻고 빈 결과를 낸다(적지 않는다). 그래야 찾는 칸만 선
 * 첫 화면도 운영자가 아니면 404 다.
 */
export async function operatorMember(
  query: string | null,
): Promise<typeof DENIED | SkippableRead<MemberRecord | null>> {
  const supabase = await supabaseOnServer();
  const found = await supabase.rpc('operator_member', rpcArgs<'operator_member'>({ p_query: query }));

  if (denied([found])) {
    await noteDenial(supabase, 'members.find');
    return DENIED;
  }
  if (found.error) return unread(found.error, 'operator_member');

  const row = found.data?.[0];
  if (row === undefined) return read(null);

  const warned = await supabase.rpc('operator_member_warnings', { p_user_id: row.user_id });
  if (denied([warned])) {
    await noteDenial(supabase, 'members.warnings');
    return DENIED;
  }
  if (warned.error) return unread(warned.error, 'operator_member_warnings');

  return read({ member: memberOf(row), warnings: (warned.data ?? []).map(warningOf) });
}
