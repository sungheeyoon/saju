import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

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
import {
  DENIED,
  QUERY_MAX,
  operatorMember,
  queryOf,
  type CreditSource,
  type Member,
  type MemberWarning,
} from './read';
import { memberCreditHistory, memberGrantLedger, type MemberGrantLedger, type MemberHistory } from './credits';
import {
  HISTORY_FILTERS,
  HISTORY_MAX,
  HISTORY_PAGE,
  historyAmount,
  historyCause,
  historyFilterOf,
  historyKindLabel,
  historyLimitOf,
  sourceLabel,
  type HistoryFilter,
  type HistoryLine,
} from './credit-grant';
import { GrantPanel } from './grant-panel';
import type { SkippableRead } from '../../db-error';
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
 * **읽기 전용이다.** 찾는 칸은 주소(`?q=`)로 가는 GET 폼이고, 누름은 계정 id 를 복사하는 하나뿐이다. 보여 주는 것은 상태 ·
 * 풀이권(본인 화면과 같은 잔액과 출처별 장부, 운영자 2026-10-17) · 경고 이력뿐이고, 이메일 · 출생정보 · 풀이 · 저장한 사람 · 주문 금액은 문이 안
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

  const params = await searchParams;
  const query = queryOf(params.q);
  const found = await operatorMember(query);
  if (found === DENIED) notFound();

  const member = found.ok ? found.value?.member ?? null : null;
  const filter = historyFilterOf(params.history);
  const limit = historyLimitOf(params.n);
  const [ledger, history] =
    member === null
      ? [null, null]
      : await Promise.all([memberGrantLedger(member.userId), memberCreditHistory(member.userId, filter, limit)]);
  if (ledger === DENIED || history === DENIED) notFound();
  const reportId = reportIdOf(params.report);

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
          <Credits member={found.value.member} ledger={ledger} reportId={reportId} />
          {history !== null && (
            <History userId={found.value.member.userId} history={history} filter={filter} limit={limit} />
          )}
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
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-semibold text-secondary">사용 가능한 풀이권</span>
        <span className="text-4xl font-bold tracking-[-0.04em] tabular-nums">{member.credits.available}장</span>
      </p>
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
 * 풀이권 출처별 장부 — 가입 무료 · 운영 지급 · 유료 구매의 받은(산) 수 · 확정 쓰임 · 빈자리, 그리고 예약 중 · 환불 확보 중. 화면은
 * 더하거나 빼지 않는다 — 셈은 문(`operator_member`)이 다 낸다. 잔액(위 계정 칸)은 본인 화면의 셈이고 이것은 장부라, 풀이 대상을
 * 지운 계정은 둘의 합이 다르다 — 그 한 줄을 늘 둔다. 승인된 주문의 번호마다 주문 화면(`/ops/orders`, G-110 ②)으로 가는 길이 선다.
 */
function Credits({
  member,
  ledger,
  reportId,
}: {
  member: Member;
  ledger: SkippableRead<MemberGrantLedger | null> | null;
  reportId: string | null;
}) {
  const { credits } = member;
  return (
    <section aria-labelledby="member-credits" className={`${CARD} flex flex-col gap-3`}>
      <h2 id="member-credits" className="text-base font-semibold">
        풀이권 출처
      </h2>
      <p className="text-xs text-muted">출처별은 장부 기준이라 합이 잔액과 다를 수 있습니다.</p>
      <dl className="flex max-w-xl flex-col divide-y divide-border">
        <Source title="가입 무료" receivedLabel="받은" source={credits.free} />
        <Source title="운영 지급" receivedLabel="받은" source={credits.granted} />
        <Source title="유료 구매" receivedLabel="구매한" source={credits.bought} />
      </dl>
      <ul aria-label="그 밖의 수" className="flex flex-wrap gap-2 text-xs">
        <Chip>예약 중 {credits.reserved}장</Chip>
        <Chip>환불 확보 중 {credits.held}장</Chip>
        <Chip>환불한 풀이권 {credits.bought.refunded}장</Chip>
        <Chip>풀이 {credits.usedAll}회</Chip>
        {credits.outsideUsed > 0 && <Chip>몫 밖 풀이 {credits.outsideUsed}회</Chip>}
      </ul>
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
      {ledger === null ? null : !ledger.ok ? (
        <FailureLine retry>무상 지급분을 읽지 못했습니다.</FailureLine>
      ) : ledger.value === null ? null : (
        <>
          <p className="flex flex-wrap items-center gap-2 text-xs text-secondary">
            <span className="rounded-full bg-surface-soft px-2.5 py-1 font-semibold">현금 환불 대상 아님</span>
            운영 지급 중 회수할 수 있는 것 {ledger.value.revocable}장
            {ledger.value.reserved > 0 && ` · 예약 중 ${ledger.value.reserved}장`}
          </p>
          <GrantPanel
            userId={member.userId}
            nickname={member.nickname}
            ledger={ledger.value}
            reserved={ledger.value.reserved}
            reportId={reportId}
          />
        </>
      )}
    </section>
  );
}

/** 신고 화면에서 넘어온 신고 id — 모양이 틀리면 버린다(DB 가 그 회원의 신고인지 다시 잰다) */
const reportIdOf = (value: string | string[] | undefined): string | null => {
  const text = (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text.toLowerCase() : null;
};

const historyHref = (userId: string, filter: HistoryFilter, limit: number = HISTORY_PAGE): string => {
  const params = new URLSearchParams({ q: userId });
  if (filter !== 'all') params.set('history', filter);
  if (limit > HISTORY_PAGE) params.set('n', String(limit));
  return `/ops/members?${params.toString()}#member-history`;
};

/**
 * 풀이권 이력 — 구매 · 환불 · 사용 · 지급 · 회수를 한 목록에 최근 것부터(G-111 ①). 줄마다 종류 · 출처 · 수 · 증감 사유.
 * 수는 늘고 준 것만 부호가 있다 — 예약 · 반환은 차감이 아니다. 사용 줄은 무엇을 풀었는지 적지 않는다(ADR 0185 의 2). 구매 ·
 * 환불 줄은 주문 번호로 주문 화면에 간다 — 금액은 거기서만.
 */
function History({
  userId,
  history,
  filter,
  limit,
}: {
  userId: string;
  history: SkippableRead<MemberHistory>;
  filter: HistoryFilter;
  limit: number;
}) {
  return (
    <section aria-labelledby="member-history" className={`${CARD} flex flex-col gap-3`}>
      <h2 id="member-history" className="text-base font-semibold">
        풀이권 이력
      </h2>
      <nav aria-label="이력 거르기" className="flex flex-wrap gap-2">
        {HISTORY_FILTERS.map((one) => (
          <Link
            key={one.value}
            href={historyHref(userId, one.value)}
            aria-current={one.value === filter ? 'true' : undefined}
            className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${
              one.value === filter
                ? 'border-foreground bg-foreground font-semibold text-background'
                : 'border-border bg-surface-soft text-secondary'
            }`}
          >
            {one.label}
          </Link>
        ))}
      </nav>
      {!history.ok ? (
        <FailureLine retry>이력을 읽지 못했습니다.</FailureLine>
      ) : history.value.lines.length === 0 ? (
        <p className="text-sm text-secondary">풀이권 이력이 없습니다.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {history.value.lines.map((line, index) => (
              <HistoryRow key={`${line.at}-${line.kind}-${index}`} line={line} />
            ))}
          </ul>
          {history.value.more && limit < HISTORY_MAX && (
            <Link
              href={historyHref(userId, filter, limit + HISTORY_PAGE)}
              className="self-start text-sm font-semibold text-accent underline-offset-4 hover:underline"
            >
              더 보기
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function HistoryRow({ line }: { line: HistoryLine }) {
  const amount = historyAmount(line);
  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{historyKindLabel(line.kind)}</span>
        <span className="rounded-full bg-surface-soft px-2.5 py-1 text-xs font-semibold text-secondary">
          {sourceLabel(line.source)}
        </span>
        {amount !== '' && <span className="font-semibold tabular-nums">{amount}</span>}
        <span className="text-xs tabular-nums text-muted">{evidenceTime(line.at)}</span>
      </p>
      <p className="text-sm text-secondary">{historyCause(line)}</p>
      {line.note !== null && <p className="break-words text-sm text-secondary">{line.note}</p>}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {line.orderNumber !== null && (
          <Link
            href={`/ops/orders?order=${encodeURIComponent(line.orderNumber)}`}
            className="font-mono text-accent underline-offset-4 hover:underline"
          >
            {line.orderNumber}
          </Link>
        )}
        {line.actorNickname !== null && <span>실행자 {line.actorNickname}</span>}
        {line.reportId !== null && (
          <Link href={`/ops/reports/${line.reportId}`} className="text-accent underline-offset-4 hover:underline">
            관련 신고 보기
          </Link>
        )}
      </p>
    </li>
  );
}

function Source({ title, receivedLabel, source }: { title: string; receivedLabel: string; source: CreditSource }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr_1fr_1fr] items-baseline gap-2 py-2 first:pt-0 last:pb-0 sm:grid-cols-[6rem_1fr_1fr_1fr]">
      <dt className="text-sm font-semibold">{title}</dt>
      <Figure label={receivedLabel} value={source.received} />
      <Figure label="사용" value={source.used} />
      <Figure label="남은" value={source.left} />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <dd className="text-sm">
      <span className="text-xs text-muted">{label}</span> <span className="font-semibold tabular-nums">{value}장</span>
    </dd>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <li className="rounded-full bg-surface-soft px-2.5 py-1 text-secondary">{children}</li>;
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
