import Link from 'next/link';
import { notFound } from 'next/navigation';

import { supabaseOnServer } from '../../../auth/server-client';
import { signedInUser } from '../../../auth/signed-in';
import { redirectToSignIn } from '../../../auth/sign-in-redirect';
import {
  CHOSEN_MESSAGE_LABEL,
  NO_NICKNAME,
  NO_REVIEW_RECORD,
  SIDE_LABEL,
  UNKNOWN_SIDE_LABEL,
  WARNING_LABEL,
  accountStatusLabel,
  evidenceTime,
  reasonLabel,
  reviewOutcomeLabel,
  reviewStateLabel,
  type Side,
} from '@/src/lib/ops/report-labels';
import {
  DENIED,
  operatorReport,
  operatorReports,
  reportParties,
  type AccountNow,
  type PartySummary,
  type Review,
  type Snapshot,
  type WarningRecord,
} from '../read';
import { NO_FILTERS } from '@/src/lib/ops/report-filters';
import { HELD_SUSPENSION, SIDE_NAME, sanctionLabel, type ReviewLogLine } from '@/src/lib/ops/report-review';
import { ReviewPanel } from './review-panel';
import { CARD } from '../../../ui/surfaces';
import { FailureLine } from '../../../ui/failure-line';
import { secondFactorGate } from '../../second-factor';

export const metadata = {
  title: '신고 내용',
  description: '신고 내용과 신고 당시 저장된 대화 일부를 보고 처분합니다.',
};

const LINK = 'text-sm font-semibold text-accent underline-offset-4 hover:underline';

/**
 * **신고 한 건과 그 근거, 그리고 처분** (G-24 1차판 · G-111 ②, ADR 0103 · 0188).
 *
 * 근거는 신고 당시의 **불변 사본**뿐이다(ADR 0091). 이 화면은 실제 대화방도 현재 메시지도 다시 읽지
 * 않고, 대화방으로 가는 링크도 없다 — 문이 방과 메시지의 id 를 아예 안 내준다. 두 계정의 지금 상태는
 * 근거 밖에 서고 스냅샷 안에 섞지 않는다: 근거는 그때의 것이고 상태는 지금의 것이다.
 *
 * **같은 화면에서 처분한다** — 넓은 화면은 두 열이다: 왼쪽 근거(신고 · 신고 당시 대화), 오른쪽 대상 회원 요약과 처분(스크롤해도
 * 붙어 선다). 폰은 신고 → 근거 → 대상 → 처분 차례로 한 열이다. 처리 필요면 처분 폼, 처리 완료면 반영 결과와 「처분 바꾸기」가
 * 선다. 스냅샷을 고치거나 지우는 길은 없다. 이 화면을 여는 것 자체가 접속기록에 남는다 — 대상 요약도 제 줄(`reports.target`)을.
 */
export default async function OperatorReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const { reportId } = await params;
  await secondFactorGate(supabase, 'reports.detail', `/ops/reports/${reportId}`, { reportId });
  const found = await operatorReport(reportId);
  if (found === DENIED) notFound();
  if (found.ok && found.value === null) notFound();

  const report = found.ok ? found.value : null;
  const [parties, next] =
    report === null
      ? [null, null]
      : await Promise.all([reportParties(reportId), report.isOpen ? Promise.resolve(null) : nextOpen(reportId)]);
  const known = parties !== null && parties.ok ? parties.value : [];

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <Link href="/ops/reports" className="text-sm font-semibold text-accent">
          신고 목록
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">신고 내용</h1>
      </header>

      {report === null ? (
        <FailureLine retry className={CARD}>
          신고를 읽지 못했습니다.
        </FailureLine>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <section aria-label="신고" className={`${CARD} flex flex-col gap-4`}>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <Item title="접수 시각">
                  <span className="tabular-nums">{evidenceTime(report.createdAt)}</span>
                </Item>
                <Item title="신고 사유">{reasonLabel(report.reason)}</Item>
                <Item title="덧붙인 내용" wide>
                  {report.detail === null ? (
                    <span className="text-muted">없음</span>
                  ) : (
                    <span className="whitespace-pre-wrap leading-6">{report.detail}</span>
                  )}
                </Item>
                <Account title="신고한 계정" who={report.reporter} />
                <Account title="신고받은 계정" who={report.reported} />
              </dl>
            </section>

            <Evidence snapshot={report.snapshot} />
          </div>

          <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
            <Parties parties={parties} reportId={reportId} />

            <section aria-labelledby="review-title" className={`${CARD} flex flex-col gap-4`}>
              <h2 id="review-title" className="flex items-baseline gap-2 text-base font-bold">
                처분
                <span className="text-sm font-semibold text-secondary">{reviewStateLabel(report.isOpen)}</span>
              </h2>
              <ReviewPanel
                now={{
                  reportId,
                  reason: report.reason,
                  isOpen: report.isOpen,
                  outcome: report.review?.outcome ?? null,
                  version: report.version,
                }}
                parties={known}
              >
                <Result report={report} next={next} />
              </ReviewPanel>
              {report.reviewLog.length > 0 && <ReviewLog lines={report.reviewLog} />}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * 「다음 신고」 — 처리 필요 중 급한 순의 첫 건(이 신고 말고). 못 읽으면 단추를 안 세운다 — 목록이 그 자리다. 목록 문을 한 번 더
 * 부르므로 접속기록에 목록 한 줄이 함께 남는다.
 */
async function nextOpen(reportId: string): Promise<string | null> {
  const listed = await operatorReports(NO_FILTERS);
  if (listed === DENIED || !listed.ok) return null;
  return listed.value.rows.find((row) => row.reportId !== reportId)?.reportId ?? null;
}

/** 「회원 열기」 — 신고 id 를 들고 간다(무상 지급의 관련 신고, G-111 ①) */
const memberHref = (userId: string, reportId: string): string => `/ops/members?q=${userId}&report=${reportId}`;

function Item({
  title,
  wide = false,
  children,
}: {
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-xs text-muted">{title}</dt>
      <dd className="mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}

type ResultReport = {
  readonly reportId: string;
  readonly isOpen: boolean;
  readonly reviewedAt: string | null;
  readonly review: Review | null;
  readonly warning: WarningRecord | null;
  readonly heldSuspension: Side | null;
  readonly reporter: AccountNow;
  readonly reported: AccountNow;
};

/**
 * 반영 결과 — 처리한 뒤 · 이미 처리된 신고. 「처리 완료 · 경고」 · 제재 대상과 그 계정의 **지금** 상태 · 안내번호와 이용자 확인 ·
 * 판단 근거 · 실행자 · 시각. 이용 정지 결정을 다른 결과로 바꿨는데 계정이 아직 정지면 그 줄이 선다 — 해제는 회원 화면에서 따로다.
 * 실행자는 검토한 운영자다(`reviewed_by` = `sanctioned_by`, ADR 0107).
 */
function Result({ report, next }: { report: ResultReport; next: string | null }) {
  const review = report.review;
  const sanctioned = review?.sanctioned ?? null;
  const target = sanctioned === null ? null : report[sanctioned];
  const held = report.heldSuspension;
  const member = target ?? (held === null ? null : report[held]);
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
        <Item title="결과">
          {review === null ? (
            <span className="text-muted">{NO_REVIEW_RECORD}</span>
          ) : (
            `${reviewStateLabel(report.isOpen)} · ${reviewOutcomeLabel(review.outcome)}`
          )}
        </Item>
        {target !== null && sanctioned !== null && (
          <Item title="제재 대상">
            {target.nickname ?? NO_NICKNAME} · {SIDE_LABEL[sanctioned]}
            <span className="block text-xs font-normal text-secondary">지금 {accountStatusLabel(target.status)}</span>
          </Item>
        )}
        {report.warning !== null && <WarningItems warning={report.warning} />}
        {review !== null && (
          <Item title="판단 근거" wide>
            {review.note === null ? (
              <span className="text-muted">없음</span>
            ) : (
              <span className="whitespace-pre-wrap font-normal leading-6">{review.note}</span>
            )}
          </Item>
        )}
        <Item title="실행자 · 시각" wide>
          {review?.reviewerNickname ?? NO_NICKNAME}
          {report.reviewedAt !== null && (
            <span className="ml-2 font-normal tabular-nums text-muted">{evidenceTime(report.reviewedAt)}</span>
          )}
        </Item>
      </dl>
      {held !== null && (
        <p className="rounded-card bg-warning-wash p-3 text-sm font-semibold text-warning">
          {SIDE_LABEL[held]} · {HELD_SUSPENSION}
        </p>
      )}
      {(next !== null || member !== null) && (
        <div className="flex flex-wrap gap-4">
          {next !== null && (
            <Link href={`/ops/reports/${next}`} className={LINK}>
              다음 신고
            </Link>
          )}
          {member !== null && (
            <Link href={memberHref(member.userId, report.reportId)} className={LINK}>
              회원 열기
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 대상 회원 요약 — 신고받은 계정은 지금 상태 · 「현재 신고 기준 최근 12개월 경고 N회」 · 처분 이력 최근 셋 · 「회원 열기」, 신고한
 * 계정은 닉네임 · 상태 · 「회원 열기」 한 줄. 떠난 사람의 신고로 옮겨진 경고는 세지 않는다 — 그 한 줄이 늘 선다(G-110 의 경계).
 */
function Parties({
  parties,
  reportId,
}: {
  parties: Awaited<ReturnType<typeof reportParties>> | null;
  reportId: string;
}) {
  if (parties === null) return null;
  if (!parties.ok) {
    return (
      <FailureLine retry className={CARD}>
        대상 회원을 읽지 못했습니다.
      </FailureLine>
    );
  }
  const reported = parties.value.find((party) => party.side === 'reported');
  const reporter = parties.value.find((party) => party.side === 'reporter');
  return (
    <section aria-labelledby="parties-title" className={`${CARD} flex flex-col gap-3`}>
      <h2 id="parties-title" className="text-base font-bold">
        대상 회원
      </h2>
      {reported !== undefined && <ReportedParty party={reported} reportId={reportId} />}
      {reporter !== undefined && (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border pt-3 text-sm">
          <span className="text-xs text-muted">{SIDE_NAME.reporter}</span>
          <span className="font-semibold">{reporter.nickname ?? NO_NICKNAME}</span>
          <span className="text-xs text-secondary">{accountStatusLabel(reporter.status)}</span>
          <Link href={memberHref(reporter.userId, reportId)} className={`ml-auto ${LINK}`}>
            회원 열기
          </Link>
        </p>
      )}
      <p className="text-xs text-muted">탈퇴한 신고자의 분리 보관 경고는 런북 SQL 로 따로 셉니다.</p>
    </section>
  );
}

function ReportedParty({ party, reportId }: { party: PartySummary; reportId: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">{SIDE_NAME.reported}</p>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-lg font-bold">{party.nickname ?? NO_NICKNAME}</span>
        <span className="font-mono text-xs text-muted">{party.userId.slice(0, 8)}</span>
        <span className="rounded-full bg-surface-soft px-2.5 py-0.5 text-xs font-semibold text-secondary">
          {accountStatusLabel(party.status)}
        </span>
        {party.isOperator && (
          <span className="rounded-full bg-accent-wash px-2.5 py-0.5 text-xs font-semibold">운영자 계정</span>
        )}
      </p>
      <p className="text-sm text-secondary">
        현재 신고 기준 최근 12개월 경고 <span className="tabular-nums">{party.warnings12m}</span>회
      </p>
      {party.recent.length > 0 && (
        <ul aria-label="처분 이력 최근 셋" className="flex flex-col gap-1 text-xs text-secondary">
          {party.recent.map((line) => (
            <li key={`${line.at}-${line.kind}`} className="flex flex-wrap gap-x-2">
              <span className="tabular-nums text-muted">{evidenceTime(line.at)}</span>
              <span>{sanctionLabel(line)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href={memberHref(party.userId, reportId)} className={`self-start ${LINK}`}>
        회원 열기
      </Link>
    </div>
  );
}

/** 처분 이력 — 지금 결과까지 최근 것부터. 바꾼 처분은 앞 줄로 남는다(덮어쓰지 않는다) */
function ReviewLog({ lines }: { lines: readonly ReviewLogLine[] }) {
  return (
    <details className="border-t border-border pt-3 text-sm" open={lines.length > 1}>
      <summary className="cursor-pointer text-xs font-semibold text-secondary">처분 이력 {lines.length}건</summary>
      <ol className="mt-2 flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line.version} className="flex flex-col gap-0.5 rounded-card bg-surface-soft p-3">
            <p className="flex flex-wrap gap-x-2 text-xs text-muted">
              <span className="tabular-nums">{line.version}차</span>
              <span className="tabular-nums">{evidenceTime(line.at)}</span>
              <span>{line.carriedOver ? '기록 이전' : (line.actorNickname ?? NO_NICKNAME)}</span>
            </p>
            <p className="font-semibold">
              {line.outcome === null ? NO_REVIEW_RECORD : reviewOutcomeLabel(line.outcome)}
              {line.sanctionedSide !== null && ` · ${SIDE_LABEL[line.sanctionedSide]}`}
              {line.warningCategory !== null && ` · ${reasonLabel(line.warningCategory)}`}
            </p>
            {line.note !== null && <p className="whitespace-pre-wrap text-secondary">{line.note}</p>}
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * 경고의 안내 — 이용자에게 간 안내번호 · 갈래와 이용자가 확인했는가(ADR 0108). 이의 제기를 인정해 결과가 바뀌어도 안내번호는
 * 남는다 — 그때는 갈래가 비어 있어 그 줄이 안 선다. 이메일 발송 결과는 발송 잡(G-26)이 서면 더한다.
 */
function WarningItems({ warning }: { warning: WarningRecord }) {
  return (
    <>
      <Item title={WARNING_LABEL.ref}>
        <span className="font-mono">{warning.ref}</span>
      </Item>
      {warning.category !== null && <Item title={WARNING_LABEL.category}>{reasonLabel(warning.category)}</Item>}
      <Item title={WARNING_LABEL.acknowledged}>
        {warning.acknowledgedAt === null ? (
          <span className="text-muted">{WARNING_LABEL.notYet}</span>
        ) : (
          <span className="tabular-nums">{evidenceTime(warning.acknowledgedAt)}</span>
        )}
      </Item>
    </>
  );
}

function Account({ title, who }: { title: string; who: AccountNow }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{title}</dt>
      <dd className="mt-0.5 font-semibold">{who.nickname ?? NO_NICKNAME}</dd>
      <dd className="break-all font-mono text-xs text-muted">{who.userId}</dd>
      <dd className="mt-1 text-xs text-secondary">지금 계정 상태 · {accountStatusLabel(who.status)}</dd>
    </div>
  );
}

/**
 * 신고 당시 대화 — **베낀 차례대로.** 고른 메시지는 문이 이미 하나로 추려 준다(`chosenOnce`).
 * 대화 신고가 아니면 안내 한 줄만 선다.
 */
function Evidence({ snapshot }: { snapshot: Snapshot | null }) {
  return (
    <section aria-labelledby="evidence-title" className={`${CARD} flex flex-col gap-4`}>
      <div>
        <h2 id="evidence-title" className="text-base font-bold">
          신고 당시 대화
        </h2>
        {snapshot !== null && (
          <p className="mt-1 text-sm text-secondary">
            신고 당시 저장된 대화 일부입니다. 전체 대화는 열 수 없습니다.
          </p>
        )}
      </div>

      {snapshot === null ? (
        <p className="text-sm text-secondary">이 신고에는 저장된 대화 근거가 없습니다.</p>
      ) : (
        <>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span>
              저장 시각 <span className="tabular-nums">{evidenceTime(snapshot.capturedAt)}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              신고한 메시지 앞 {snapshot.contextBefore}건 · 뒤 {snapshot.contextAfter}건까지
            </span>
          </p>

          <ol aria-label="신고 당시 대화" className="flex flex-col gap-2">
            {snapshot.messages.map((message) => (
              <li
                key={message.seq}
                aria-current={message.chosen ? 'true' : undefined}
                className={`rounded-cell border p-4 ${
                  message.chosen ? 'border-accent bg-accent-wash' : 'border-border bg-surface-soft'
                }`}
              >
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className="font-semibold text-secondary">
                    {message.side === null ? UNKNOWN_SIDE_LABEL : SIDE_LABEL[message.side]}
                  </span>
                  <span className="tabular-nums">{evidenceTime(message.sentAt)}</span>
                  {message.chosen && (
                    <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-on-accent">
                      {CHOSEN_MESSAGE_LABEL}
                    </span>
                  )}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
