import Link from 'next/link';
import { notFound } from 'next/navigation';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import {
  NO_NICKNAME,
  WARNING_LABEL,
  accountStatusLabel,
  evidenceTime,
  reasonLabel,
  reviewOutcomeLabel,
} from '../reports/labels';
import { DENIED, QUERY_MAX, operatorMember, queryOf, type Member, type MemberWarning } from './read';
import { CARD } from '../../ui/surfaces';
import { CopyValue } from '../copy-value';
import { FailureLine } from '../../ui/failure-line';

export const metadata = {
  title: '회원',
  description: '닉네임이나 계정 id 로 회원을 찾아 상태 · 풀이권 · 경고 이력을 봅니다.',
};

/**
 * **운영자가 회원 한 명을 찾는 자리** (G-110 ③, ADR 0185).
 *
 * 신고 화면(`/ops/reports`)과 같은 경계다 — 「나는 운영자인가」를 안 묻고 자료를 청해 **거절당하면 없는 화면이 된다**
 * (`notFound`). 찾는 말 없이 열어도 문을 한 번 부른다(`read.ts`).
 *
 * **읽기 전용이다.** 찾는 칸은 주소(`?q=`)로 가는 GET 폼이고, 누름은 계정 id 를 복사하는 하나뿐이다. 보여 주는 것은 G-110 이
 * 든 넷 — 상태 · 산 풀이권 · 쓴 풀이권 · 경고 이력 — 뿐이고, 이메일 · 출생정보 · 풀이 · 저장한 사람 · 주문 금액은 문이 안
 * 내준다. 찾고 볼 때마다 접속기록에 남는다.
 */
export default async function OperatorMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const query = queryOf((await searchParams).q);
  const found = await operatorMember(query);
  if (found === DENIED) notFound();

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">운영</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">회원</h1>
        <p className="mt-1 text-sm text-secondary">닉네임이나 계정 id 로 회원을 찾아 상태 · 풀이권 · 경고 이력을 봅니다.</p>
      </header>

      <form action="/ops/members" className={`${CARD} flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3`}>
        <label htmlFor="member-query" className="shrink-0 text-xs font-semibold text-muted">
          닉네임 또는 계정 id
        </label>
        <div className="flex min-w-0 flex-1 gap-2">
          <input
            id="member-query"
            name="q"
            defaultValue={query ?? ''}
            maxLength={QUERY_MAX}
            autoComplete="off"
            spellCheck={false}
            className="min-h-9 min-w-0 flex-1 rounded-full border border-border bg-surface-soft px-3 text-field"
          />
          <button
            type="submit"
            className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-border bg-surface-soft px-3 text-sm text-secondary"
          >
            {WARNING_LABEL.search}
          </button>
        </div>
      </form>

      {query === null ? null : !found.ok ? (
        <FailureLine retry className={CARD}>
          회원을 읽지 못했습니다.
        </FailureLine>
      ) : found.value === null ? (
        <p className={`${CARD} text-sm text-secondary`}>찾는 회원이 없습니다.</p>
      ) : (
        <>
          <Account member={found.value.member} />
          <Credits member={found.value.member} />
          <Warnings warnings={found.value.warnings} />
        </>
      )}
    </main>
  );
}

function Account({ member }: { member: Member }) {
  return (
    <section aria-label="계정" className={`${CARD} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xl font-bold tracking-[-0.02em]">{member.nickname ?? NO_NICKNAME}</span>
        <span className="rounded-full bg-surface-soft px-2.5 py-1 text-xs font-semibold text-secondary">
          {accountStatusLabel(member.status)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 text-xs text-muted">
          계정 id <span className="break-all font-mono text-secondary">{member.userId}</span>
        </p>
        <CopyValue value={member.userId} label="계정 id 복사" />
      </div>
    </section>
  );
}

/**
 * 풀이권 — 묶음과 쓰임 장부의 셈을 그대로 적는다. 화면은 더하거나 빼지 않는다 — 안 쓴 회차의 셈은 환불 셈
 * (`operator_reading_refund_basis`)의 일이다. 승인된 주문의 번호마다 주문 화면(`/ops/orders`, G-110 ②)으로 가는 길이 선다.
 */
function Credits({ member }: { member: Member }) {
  const { credits } = member;
  return (
    <section aria-labelledby="member-credits" className={`${CARD} flex flex-col gap-3`}>
      <h2 id="member-credits" className="text-base font-semibold">
        풀이권
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Count title="산 풀이권" value={credits.bought} />
        <Count title="환불로 걷은 회차" value={credits.refunded} />
        <Count title="산 것에서 쓴 회차" value={credits.usedBought} />
        <Count title="쓴 풀이권 (무료 포함)" value={credits.usedAll} />
      </dl>
      {credits.reservedBought > 0 && (
        <p className="text-xs text-secondary">산 것에서 예약 중 {credits.reservedBought}회 — 쓴 것도 안 쓴 것도 아닙니다.</p>
      )}
      {member.orderNumbers.length > 0 && (
        <ul aria-label="주문" className="flex flex-wrap gap-2">
          {member.orderNumbers.map((orderNumber) => (
            <li key={orderNumber}>
              <Link
                href={`/ops/orders?order=${encodeURIComponent(orderNumber)}`}
                className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface-soft px-3 font-mono text-xs text-secondary"
              >
                {orderNumber}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Count({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-row bg-surface-soft px-3 py-2">
      <dt className="text-xs text-muted">{title}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums">{value}회</dd>
    </div>
  );
}

/**
 * 경고 이력 — 이 계정이 제재 대상으로 적힌 경고 · 이용 정지 결정, 최근 것부터. 판단 근거는 문이 안 낸다 — 신고 내용 화면이
 * 든다. 「12개월 셈」은 경고 3회째의 셈에 드는 경고다(ADR 0108). 이의 제기를 인정한 경고는 여기 안 선다.
 *
 * **지금 계정의 신고에서 센 것뿐이다** — 신고한 사람이 떠나 분리 보관(`retention.report`)으로 옮겨진 경고는 문이 안 읽는다
 * (ADR 0185 의 3). 그래서 횟수 · 빈 상태를 「현재 신고」로 한정해 말하고, 보관분은 런북 SQL 로 센다는 줄을 늘 둔다 — 「경고가
 * 없다」고 단정하지 않는다.
 */
function Warnings({ warnings }: { warnings: readonly MemberWarning[] }) {
  const counted = warnings.filter((warning) => warning.counted).length;
  return (
    <section aria-labelledby="member-warnings" className={`${CARD} flex flex-col gap-3`}>
      <h2 id="member-warnings" className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold">
        경고 이력
        <span className="text-xs font-normal text-muted">현재 신고 기준 최근 12개월 경고 {counted}회</span>
      </h2>
      <p className="text-xs text-muted">탈퇴한 신고자의 분리 보관 경고는 런북 SQL 로 따로 셉니다.</p>
      {warnings.length === 0 ? (
        <p className="text-sm text-secondary">현재 신고에 적힌 경고가 없습니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {warnings.map((warning) => (
            <WarningRow key={warning.reportId} warning={warning} />
          ))}
        </ul>
      )}
    </section>
  );
}

function WarningRow({ warning }: { warning: MemberWarning }) {
  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{reviewOutcomeLabel(warning.outcome)}</span>
        {warning.category !== null && <span className="text-sm text-secondary">{reasonLabel(warning.category)}</span>}
        <span className="text-xs tabular-nums text-muted">{evidenceTime(warning.reviewedAt)}</span>
      </p>
      <p className="flex flex-wrap items-center gap-2 text-xs">
        {warning.ref !== null && (
          <span className="rounded-full bg-surface-soft px-2.5 py-1 font-mono text-secondary">
            {WARNING_LABEL.ref} {warning.ref}
          </span>
        )}
        {warning.outcome === 'warning' && (
          <span className="rounded-full bg-surface-soft px-2.5 py-1 text-secondary">
            {warning.acknowledgedAt === null
              ? `이용자 ${WARNING_LABEL.notYet}`
              : `${WARNING_LABEL.acknowledged} ${evidenceTime(warning.acknowledgedAt)}`}
          </span>
        )}
        {warning.counted && (
          <span className="rounded-full bg-accent-wash px-2.5 py-1 font-semibold text-foreground">12개월 셈</span>
        )}
      </p>
      <Link
        href={`/ops/reports/${warning.reportId}`}
        className="self-start text-sm font-semibold text-accent underline-offset-4 hover:underline"
      >
        신고 내용 보기
      </Link>
    </li>
  );
}
