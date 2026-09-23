import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { supabaseOnServer } from '../../../auth/server-client';
import { CARD } from '../../../card';
import {
  NO_NICKNAME,
  REVIEW_LABEL,
  SIDE_LABEL,
  UNKNOWN_SIDE_LABEL,
  accountStatusLabel,
  evidenceTime,
  reasonLabel,
} from '../labels';
import { DENIED, operatorReport, type AccountNow, type Snapshot } from '../read';

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
 * 읽기 전용이다. 스냅샷을 고치거나 지우는 길, 검토 완료를 적는 누름은 없다.
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
              <Item title="검토 상태" wide>
                {found.value.reviewedAt === null ? (
                  REVIEW_LABEL.unreviewed
                ) : (
                  <>
                    {REVIEW_LABEL.reviewed}
                    <span className="ml-2 tabular-nums text-muted">
                      {evidenceTime(found.value.reviewedAt)}
                    </span>
                  </>
                )}
              </Item>
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
