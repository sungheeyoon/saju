import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { supabaseOnServer } from '../../../auth/server-client';
import { CARD } from '../../../card';
import {
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
} from '../labels';
import {
  DENIED,
  operatorReport,
  type AccountNow,
  type Review,
  type Snapshot,
  type WarningRecord,
} from '../read';

export const metadata = {
  title: '신고 내용 — 만세력',
  description: '신고 내용과 신고 당시 저장된 대화 일부를 봅니다.',
};

/**
 * **신고 한 건과 그 근거** (G-24 1차판, ADR 0103).
 *
 * 근거는 신고 당시의 **불변 사본**뿐이다(ADR 0091). 이 화면은 실제 대화방도 현재 메시지도 다시 읽지
 * 않고, 대화방으로 가는 링크도 없다 — 문이 방과 메시지의 id 를 아예 안 내준다. 두 계정의 지금 상태는
 * 상단에만 서고 스냅샷 안에 섞지 않는다: 근거는 그때의 것이고 상태는 지금의 것이다.
 *
 * 읽기 전용이다. 스냅샷을 고치거나 지우는 길, 검토 완료를 적는 누름은 없다. 검토 기록(결과 · 근거 · 당시 제재
 * 대상)은 운영자가 CLI 로 부르는 검토 문이 적고 여기서는 읽기만 한다(ADR 0105 · 0107). 이 화면을 여는 것 자체가 접속기록에 남는다.
 */
export default async function OperatorReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { reportId } = await params;
  const found = await operatorReport(reportId);
  if (found === DENIED) notFound();
  if (found.ok && found.value === null) notFound();

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <Link href="/ops/reports" className="text-sm font-semibold text-accent">
          신고 목록
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">신고 내용</h1>
      </header>

      {!found.ok || found.value === null ? (
        <p role="alert" className={`${CARD} text-sm text-danger`}>
          신고를 읽지 못했습니다. 잠시 뒤에 새로고침해 주세요.
        </p>
      ) : (
        <>
          <section aria-label="신고" className={`${CARD} flex flex-col gap-4`}>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Item title="접수 시각">
                <span className="tabular-nums">{evidenceTime(found.value.createdAt)}</span>
              </Item>
              <Item title="신고 사유">{reasonLabel(found.value.reason)}</Item>
              <Item title="덧붙인 내용" wide>
                {found.value.detail === null ? (
                  <span className="text-muted">없음</span>
                ) : (
                  <span className="whitespace-pre-wrap leading-6">{found.value.detail}</span>
                )}
              </Item>
              <Account title="신고한 계정" who={found.value.reporter} />
              <Account title="신고받은 계정" who={found.value.reported} />
              <Item title="처리 상태" wide>
                {reviewStateLabel(found.value.isOpen)}
                {found.value.reviewedAt !== null && (
                  <span className="ml-2 tabular-nums text-muted">{evidenceTime(found.value.reviewedAt)}</span>
                )}
              </Item>
              {found.value.reviewedAt !== null && <ReviewRecord review={found.value.review} />}
              {found.value.warning !== null && <WarningItems warning={found.value.warning} />}
            </dl>
          </section>

          <Evidence snapshot={found.value.snapshot} />
        </>
      )}
    </main>
  );
}

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

/**
 * 검토 기록 — 검토 문이 채운 칸. 기록이 생기기 전에 본 신고는 결과가 없다. 「당시 제재 대상」은 적힌 때의 대상이다 —
 * 지금 정지인가는 위 「지금 계정 상태」가 답한다. 실행한 운영자(`sanctioned_by`)는 아직 안 세운다(ADR 0107).
 */
function ReviewRecord({ review }: { review: Review | null }) {
  if (review === null) {
    return (
      <Item title="검토 결과" wide>
        <span className="text-muted">{NO_REVIEW_RECORD}</span>
      </Item>
    );
  }
  return (
    <>
      <Item title="검토 결과">{reviewOutcomeLabel(review.outcome)}</Item>
      <Item title="검토한 운영자">{review.reviewerNickname ?? NO_NICKNAME}</Item>
      <Item title="판단 근거" wide>
        {review.note === null ? (
          <span className="text-muted">없음</span>
        ) : (
          <span className="whitespace-pre-wrap leading-6">{review.note}</span>
        )}
      </Item>
      {review.sanctioned !== null && <Item title="당시 제재 대상">{SIDE_LABEL[review.sanctioned]}</Item>}
    </>
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
                className={`rounded-2xl border p-4 ${
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
                      신고한 메시지
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
