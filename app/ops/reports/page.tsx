import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { REPORT_REASONS } from '@/src/lib/account';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { filtersOf, hrefOf, isFiltered, type ReportFilters } from './filters';
import {
  EVIDENCE_LABEL,
  NO_NICKNAME,
  REVIEW_LABEL,
  WARNING_LABEL,
  evidenceTime,
  reasonLabel,
  reviewOutcomeLabel,
  reviewStateLabel,
} from './labels';
import { DENIED, operatorReports, type Account, type ReportRow } from './read';

export const metadata = {
  title: '신고 — 만세력',
  description: '접수된 신고와 신고 당시 저장된 대화 일부를 봅니다.',
};

/**
 * **운영자가 신고를 찾는 자리** (G-24 1차판, ADR 0103).
 *
 * `/ops/survey` 와 같은 경계다 — 이 화면은 「나는 운영자인가」를 안 묻고 자료를 청해 **거절당하면
 * 없는 화면이 된다**(`notFound`). 메뉴에도 안 선다. 주소는 운영 절차서가 든다(`docs/ops/runbook.md`).
 *
 * **읽기 전용이다.** 데이터를 바꾸는 누름이 없다 — 거르는 것과 쪽을 넘기는 것도 링크다. 검토 완료 ·
 * 제재 · 메모는 1차판에 없다.
 *
 * 이메일 · 출생정보 · 풀이 · 저장한 사람은 문이 안 내준다. 두 계정은 닉네임과 내부 UUID 로만
 * 가른다 — UUID 는 같은 사람이 여러 번 신고했거나 당했는지 가리는 내부 식별자다.
 */
export default async function OperatorReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const filters = filtersOf(await searchParams);
  const listed = await operatorReports(filters);
  if (listed === DENIED) notFound();

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">운영</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">신고</h1>
        <p className="mt-1 text-sm text-secondary">
          접수된 신고와 신고 당시 저장된 대화 일부를 봅니다.
        </p>
      </header>

      <Filters filters={filters} />

      {!listed.ok ? (
        <p role="alert" className={`${CARD} text-sm text-danger`}>
          신고를 읽지 못했습니다. 잠시 뒤에 새로고침해 주세요.
        </p>
      ) : listed.value.rows.length === 0 ? (
        <p className={`${CARD} text-sm text-secondary`}>
          {isFiltered(filters) ? '조건에 맞는 신고가 없습니다.' : '접수된 신고가 없습니다.'}
        </p>
      ) : (
        <>
          <ul aria-label="신고 목록" className="flex flex-col gap-3">
            {listed.value.rows.map((row) => (
              <Row key={row.reportId} row={row} />
            ))}
          </ul>
          <Pages filters={filters} pages={listed.value.pages} />
        </>
      )}
    </main>
  );
}

/**
 * 거르는 칸 셋 — 누름이 아니라 링크다. 지금 고른 것은 `aria-current` 가 든다. 안내번호 칸은 주소(`?ref=`)로 가는 GET 폼이다 —
 * 자료를 바꾸는 누름이 아니다(ADR 0108). 다른 거르기는 그대로 싣고 쪽만 처음으로 돌아간다.
 */
function Filters({ filters }: { filters: ReportFilters }) {
  return (
    <nav aria-label="신고 거르기" className={`${CARD} flex flex-col gap-4`}>
      <form action="/ops/reports" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor="warning-ref" className="shrink-0 text-xs font-semibold text-muted sm:w-20">
          {WARNING_LABEL.ref}
        </label>
        <div className="flex gap-2">
          {filters.review !== 'all' && <input type="hidden" name="review" value={filters.review} />}
          {filters.reason !== null && <input type="hidden" name="reason" value={filters.reason} />}
          {filters.evidence !== 'all' && <input type="hidden" name="evidence" value={filters.evidence} />}
          <input
            id="warning-ref"
            name="ref"
            defaultValue={filters.ref ?? ''}
            placeholder="W-7K3F"
            autoComplete="off"
            spellCheck={false}
            className="min-h-9 w-32 rounded-full border border-border bg-surface-soft px-3 font-mono text-sm uppercase"
          />
          <button
            type="submit"
            className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface-soft px-3 text-sm text-secondary"
          >
            {WARNING_LABEL.search}
          </button>
        </div>
      </form>
      <Choices
        title="처리 상태"
        options={[
          { label: '전체', href: hrefOf(filters, { review: 'all' }), current: filters.review === 'all' },
          {
            label: REVIEW_LABEL.open,
            href: hrefOf(filters, { review: 'open' }),
            current: filters.review === 'open',
          },
          {
            label: REVIEW_LABEL.done,
            href: hrefOf(filters, { review: 'done' }),
            current: filters.review === 'done',
          },
        ]}
      />
      <Choices
        title="신고 사유"
        options={[
          { label: '전체', href: hrefOf(filters, { reason: null }), current: filters.reason === null },
          ...REPORT_REASONS.map((reason) => ({
            label: reason.label,
            href: hrefOf(filters, { reason: reason.value }),
            current: filters.reason === reason.value,
          })),
        ]}
      />
      <Choices
        title="대화 근거"
        options={[
          { label: '전체', href: hrefOf(filters, { evidence: 'all' }), current: filters.evidence === 'all' },
          {
            label: EVIDENCE_LABEL.chat,
            href: hrefOf(filters, { evidence: 'chat' }),
            current: filters.evidence === 'chat',
          },
          {
            label: EVIDENCE_LABEL.none,
            href: hrefOf(filters, { evidence: 'none' }),
            current: filters.evidence === 'none',
          },
        ]}
      />
    </nav>
  );
}

function Choices({
  title,
  options,
}: {
  title: string;
  options: readonly { label: string; href: string; current: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <p className="shrink-0 text-xs font-semibold text-muted sm:w-20">{title}</p>
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => (
          <li key={option.label}>
            <Link
              href={option.href}
              aria-current={option.current ? 'page' : undefined}
              className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${
                option.current
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-border bg-surface-soft text-secondary'
              }`}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ row }: { row: ReportRow }) {
  return (
    <li className={`${CARD} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-base font-bold">{reasonLabel(row.reason)}</span>
        <span className="text-xs tabular-nums text-muted">{evidenceTime(row.createdAt)}</span>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <Who title="신고한 계정" who={row.reporter} />
        <Who title="신고받은 계정" who={row.reported} />
      </dl>

      <p className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-surface-soft px-2.5 py-1 font-semibold text-secondary">
          {reviewStateLabel(row.isOpen)}
          {row.reviewOutcome !== null && ` · ${reviewOutcomeLabel(row.reviewOutcome)}`}
        </span>
        <span className="rounded-full bg-surface-soft px-2.5 py-1 text-secondary">
          {row.snapshotMessages === null
            ? EVIDENCE_LABEL.none
            : `${EVIDENCE_LABEL.chat} · 메시지 ${row.snapshotMessages}건`}
        </span>
        {row.warningRef !== null && (
          <span className="rounded-full bg-surface-soft px-2.5 py-1 font-mono text-secondary">
            {WARNING_LABEL.ref} {row.warningRef}
          </span>
        )}
      </p>

      <Link
        href={`/ops/reports/${row.reportId}`}
        className="self-start text-sm font-semibold text-accent underline-offset-4 hover:underline"
      >
        신고 내용 보기
      </Link>
    </li>
  );
}

function Who({ title, who }: { title: string; who: Account }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{title}</dt>
      <dd className="font-semibold">{who.nickname ?? NO_NICKNAME}</dd>
      <dd className="break-all font-mono text-xs text-muted">{who.userId}</dd>
    </div>
  );
}

/** 쪽 — 최신부터 30건씩. 한 쪽의 크기는 DB 만 알고, 여기는 쪽 수만 받는다 */
function Pages({ filters, pages }: { filters: ReportFilters; pages: number }) {
  if (pages <= 1 && filters.page === 1) return null;

  return (
    <nav aria-label="쪽" className="flex items-center justify-between gap-3 text-sm">
      {filters.page > 1 ? (
        <Link href={hrefOf(filters, { page: filters.page - 1 })} className="font-semibold text-accent">
          이전 쪽
        </Link>
      ) : (
        <span />
      )}
      <span className="tabular-nums text-muted">
        {filters.page} / {Math.max(pages, filters.page)}쪽
      </span>
      {filters.page < pages ? (
        <Link href={hrefOf(filters, { page: filters.page + 1 })} className="font-semibold text-accent">
          다음 쪽
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
