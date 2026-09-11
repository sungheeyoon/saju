import Link from 'next/link';
import { redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';
import {
  CONSENT_FLOW_CAVEAT,
  CONSENT_FLOW_STEPS,
  REQUEST_STATUS_TEXT,
} from '@/src/lib/consent';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { Avatar } from '../avatar';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { inboxForViewer, type Inbox, type InboxRequest } from './inbox';
import {
  BlockButton,
  ReportButton,
  BlockedCount,
  CancelButton,
  MatchConsentQuestion,
  ReadNotificationsOnVisit,
  RespondButtons,
} from './manage';

/**
 * **수락이 여기서 풀이를 떠나보낸다** (ADR 0038).
 *
 * 동의하면 시도가 열리고, 제출은 응답 뒤에 돈다(`after`). 그 콜백이 사는 시간은 그것을
 * 부른 라우트의 상한이다 — 여기 없으면 플랫폼 기본값에서 잘리고, 그러면 시도가 열린 채
 * 남아 그 Match 가 10분간 잠긴다. 결과 칸이 서는 화면들과 같은 값을 든다.
 */
export const maxDuration = 300;

export const metadata = {
  title: '소식 — 만세력',
  description: '궁합 요청과 함께 보는 궁합의 새 소식을 확인합니다.',
};

/**
 * 요청함 — **후보 카드만 본 것은 궁합 동의가 아니다.**
 *
 * 여기가 동의가 일어나는 자리다. 받은 요청은 무엇이 열리는지 읽은 뒤에만 수락되고,
 * 그 수락은 판본을 다시 확인한 뒤에야 Match 가 된다(전부 `respond_to_match_request`
 * 안에서 한 트랜잭션으로).
 *
 * 이 화면이 요청에 대해 아는 것은 별명·소개·상태·채우는 오행·균형뿐이다. 여덟 글자도
 * 생년월일시도 점수도 `my_match_requests()` 의 반환형에 없다.
 */
export default async function RequestsPage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  /** 온보딩을 안 묻는 화면이라 `self_person_id` 도 안 읽는다 — 안 물은 것에 답이 나오지 않게 */
  const { state } = await readAccount(supabase, 'status');

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-8 py-9 sm:py-14">
      <header className="flex max-w-2xl flex-col gap-2">
        <p className="eyebrow">소식</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">궁합 요청과 새 소식</h1>
        <p className="text-sm leading-6 text-secondary">
          답해야 할 요청부터 새로 열린 궁합까지, 지금 확인할 일을 한곳에 모았습니다.
        </p>
      </header>

      {isBlocked(state) ? <AccountNotice state={state} /> : <InboxSections />}
    </main>
  );
}

async function InboxSections() {
  let inbox: Inbox;
  try {
    inbox = await inboxForViewer();
  } catch (error) {
    // 거절의 문장은 DB 가 쓴다 — 사람이 읽을 수 있게 써 뒀다.
    return (
      <p className="text-sm text-muted">
        요청함을 읽지 못했습니다 — {error instanceof Error ? error.message : '알 수 없는 까닭'}
      </p>
    );
  }

  const received = inbox.requests.filter(
    (request) => request.direction === 'received' && request.status === 'pending',
  );
  const sent = inbox.requests.filter(
    (request) => request.direction === 'sent' && request.status === 'pending',
  );
  const decided = inbox.requests.filter((request) => request.status !== 'pending');

  return (
    <div className="flex flex-col gap-8">
      <ReadNotificationsOnVisit unread={inbox.unread} />
      <InboxSummary unread={inbox.unread} received={received.length} sent={sent.length} />

      <Notifications inbox={inbox} />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section className="flex flex-col gap-3">
            <SectionHead
              title="받은 요청"
              count={received.length}
              description="내 답을 기다리고 있는 요청입니다."
            />
            {received.length === 0 ? (
              <Nothing>답할 요청이 없습니다.</Nothing>
            ) : (
              <ul className="flex flex-col gap-3">
                {received.map((request) => (
                  <li
                    key={request.requestId}
                    className={`${CARD} flex flex-col gap-4 border-accent/30`}
                  >
                    <RequestHead request={request} />
                    {/*
                      **동의 화면이다.** 무엇이 열리는지는 눌러야 나타나는 것이 아니라
                      카드가 열릴 때부터 버튼 위에 서 있다 — 읽지 않고 누른 수락은 동의가
                      아니고, 눌러야 나타나는 고지는 밖에서 잴 수도 없다.
                    */}
                    <MatchConsentQuestion />
                    <RespondButtons requestId={request.requestId} />
                    {/*
                      신고는 **상대가 나에게 한 일**이 있는 자리에만 둔다 — 받은 요청과
                      성립한 Match. 내가 보낸 요청 카드에는 두지 않는다.
                    */}
                    <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
                      <BlockButton userId={request.counterpartUserId} />
                      <ReportButton userId={request.counterpartUserId} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead
              title="보낸 요청"
              count={sent.length}
              description="상대의 답을 기다리고 있는 요청입니다."
            />
            {sent.length === 0 ? (
              <Nothing>기다리는 중인 요청이 없습니다.</Nothing>
            ) : (
              <ul className="flex flex-col gap-3">
                {sent.map((request) => (
                  <li key={request.requestId} className={`${CARD} flex flex-col gap-3`}>
                    <RequestHead request={request} />
                    <p className="rounded-xl bg-surface-soft px-4 py-3 text-sm text-secondary">
                      {REQUEST_STATUS_TEXT.pending.sent}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
                      <CancelButton requestId={request.requestId} />
                      <BlockButton userId={request.counterpartUserId} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/*
            끝난 요청도 남긴다. **왜 사라졌는지**를 말할 수 있어야 하기 때문이다 —
            무효와 거둠은 둘 다 「성립하지 않았다」지만 이유가 다르다(US 43).
          */}
          {decided.length > 0 && <DecidedRequests requests={decided} />}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <ConsentGuide />
          <nav aria-label="소식 화면 관련 메뉴" className={`${CARD} flex flex-col gap-3`}>
            <p className="text-xs font-bold tracking-[0.08em] text-muted">빠른 이동</p>
            {/* 소개받은 사람들은 홈에 선다(ADR 0037) — 이 자리는 설정으로만 잇는다 */}
            <Link
              href="/me"
              className="flex items-center justify-between rounded-xl bg-surface-soft px-4 py-3 text-sm font-medium hover:bg-accent-wash hover:text-accent"
            >
              내 사주와 인연 목록 <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/me/settings"
              className="flex items-center justify-between rounded-xl bg-surface-soft px-4 py-3 text-sm font-medium hover:bg-accent-wash hover:text-accent"
            >
              계정 관리 <span aria-hidden="true">→</span>
            </Link>
          </nav>
          <BlockedCount count={inbox.blocked} />
        </aside>
      </div>
    </div>
  );
}

function InboxSummary({
  unread,
  received,
  sent,
}: {
  unread: number;
  received: number;
  sent: number;
}) {
  const items = [
    { label: '새 소식', value: unread, tone: 'bg-accent text-on-accent' },
    { label: '받은 요청', value: received, tone: 'bg-accent-wash text-accent' },
    { label: '답변 대기', value: sent, tone: 'bg-earth-soft text-earth' },
  ] as const;

  return (
    <section aria-label="소식 요약" className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-h-24 flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
        >
          <span className="text-xs font-medium text-secondary">{item.label}</span>
          <span
            className={`mt-3 grid size-9 place-items-center self-end rounded-full text-base font-bold tabular-nums ${item.tone}`}
          >
            {item.value}
          </span>
        </div>
      ))}
    </section>
  );
}

function SectionHead({
  title,
  count,
  description,
}: {
  title: string;
  count: number;
  description: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs font-semibold tabular-nums text-secondary">
        {count}
      </span>
    </div>
  );
}

function ConsentGuide() {
  return (
    <details className={`${CARD} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
        궁합 요청은 어떻게 진행되나요?
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-soft text-lg font-normal text-secondary group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <ol className="mt-5 flex flex-col gap-4 border-t border-border pt-5">
        {CONSENT_FLOW_STEPS.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[1.75rem_1fr] gap-3">
            <span className="grid size-7 place-items-center rounded-full bg-accent-wash text-xs font-bold text-accent-strong">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="mt-1 text-xs leading-5 text-secondary">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted">
        {CONSENT_FLOW_CAVEAT}
      </p>
    </details>
  );
}

function DecidedRequests({ requests }: { requests: readonly InboxRequest[] }) {
  return (
    <details className="rounded-2xl border border-border bg-surface px-5 py-4">
      <summary className="cursor-pointer text-sm font-medium text-secondary">
        끝난 요청 {requests.length}개
      </summary>
      <ul className="mt-4 flex flex-col divide-y divide-border border-t border-border text-sm">
        {requests.map((request) => (
          <li key={request.requestId} className="flex flex-col gap-1 py-3 first:pt-4 last:pb-0">
            <span className="flex flex-wrap items-baseline gap-2">
              <strong className="font-medium">{request.nickname}</strong>
              <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-muted">
                {REQUEST_STATUS_TEXT[request.status].label}
              </span>
              <span className="ml-auto text-xs text-muted">
                {when(request.decidedAt ?? request.createdAt)}
              </span>
            </span>
            <span className="text-xs text-secondary">
              {request.direction === 'sent'
                ? REQUEST_STATUS_TEXT[request.status].sent
                : REQUEST_STATUS_TEXT[request.status].received}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Notifications({ inbox }: { inbox: Inbox }) {
  return (
    <section className={`${CARD} flex flex-col gap-4 overflow-hidden`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-accent-wash text-accent">
            <BellIcon />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight">새 소식</h2>
            <p className="text-xs text-muted">최근 활동과 풀이 상태를 확인하세요.</p>
          </div>
        </div>
      </div>

      {inbox.notifications.length === 0 ? (
        <div className="rounded-2xl bg-surface-soft px-5 py-6 text-center">
          <p className="text-sm font-medium">새로 도착한 소식이 없습니다</p>
          <p className="mt-1 text-xs text-muted">새 요청이나 풀이 결과가 생기면 여기에 알려드릴게요.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {inbox.notifications.map((notification) => (
            <li
              key={notification.notificationId}
              className={`grid grid-cols-[0.5rem_minmax(0,1fr)] gap-3 rounded-xl px-4 py-3 text-sm sm:grid-cols-[0.5rem_minmax(0,1fr)_auto] ${
                notification.unread ? 'bg-accent-wash/70' : 'bg-surface-soft'
              }`}
            >
              {/* 읽지 않은 것만 표시한다 — 읽은 것에 「읽음」을 붙이면 목록이 시끄럽다 */}
              <span
                className={`mt-2 size-1.5 rounded-full ${notification.unread ? 'bg-accent' : 'bg-border-strong'}`}
                aria-label={notification.unread ? '읽지 않음' : undefined}
                aria-hidden={notification.unread ? undefined : true}
              />
              {/*
                **갈 자리가 있으면 링크로 세운다.** 실패 알림은 「무엇이 안 됐다」로
                끝나면 안 되고 다시 누를 자리까지 닿아야 한다 — 비공개 궁합은 두
                사람을 다시 골라야 가는 자리다. 갈 곳이 없으면 글자로만 선다.
              */}
              {notification.href === null ? (
                <span className={`leading-6 ${notification.unread ? 'font-medium' : 'text-secondary'}`}>
                  {notification.text}
                </span>
              ) : (
                <Link
                  href={notification.href}
                  className={`leading-6 underline underline-offset-2 ${
                    notification.unread ? 'font-medium text-accent' : 'text-secondary'
                  }`}
                >
                  {notification.text}
                </Link>
              )}
              <time
                dateTime={notification.createdAt}
                className="col-start-2 text-xs text-muted sm:col-start-3 sm:row-start-1 sm:mt-1"
              >
                {when(notification.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        소식은 앱 안에서만 확인할 수 있습니다. 이메일·문자·카카오로는 보내지 않습니다.
      </p>
    </section>
  );
}

/**
 * 성립한 Match.
 *
 * **여기서 나가는 것은 후보 카드가 이미 말한 것뿐이다.** 궁합과 지표는 이 목록이
 * 아니라 결과 화면에 선다 — 목록이 결과를 미리 조금 보여주기 시작하면, 무엇이
 * 동의로 열린 것인지가 두 자리로 갈린다.
 */
/**
 * 절이 비었을 때 — **카드 자리에 카드가 선다.**
 *
 * 「받은 요청」·「보낸 요청」·「함께 보는 궁합」이 비면 회색 문장 한 줄만 바탕에 떠 있었다.
 * 그런데 같은 절이 차면 그 자리에 카드가 서므로, 한 화면 안에서 같은 층의 절들이 있고
 * 없고에 따라 다른 모양으로 보였다 — 빈 것과 카드 밖의 것은 다른 말이다.
 */
function Nothing({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-5 py-5">
      <span aria-hidden="true" className="size-2 rounded-full bg-border-strong" />
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}

/** 요청 한 장의 머리 — 닉네임·사진·소개와 **양쪽 방향의 오행** */
function RequestHead({ request }: { request: InboxRequest }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar
          userId={request.counterpartUserId}
          nickname={request.nickname}
          hasPhoto={request.hasPhoto}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{request.nickname}</h3>
          <time dateTime={request.createdAt} className="mt-0.5 block text-xs text-muted">
            {when(request.createdAt)}
          </time>
        </div>
      </div>

      {request.intro !== null && <p className="text-sm leading-6 text-secondary">{request.intro}</p>}

      {/* 내 자리 기준이다 — 방향은 DB 가 뒤집어 준다 */}
      <div className="flex flex-wrap gap-2">
        {request.suppliedToMe !== null && <InfoChip>{request.suppliedToMe}</InfoChip>}
        {request.suppliedToThem !== null && <InfoChip>{request.suppliedToThem}</InfoChip>}
        <InfoChip>{request.balanceLabel}</InfoChip>
      </div>
    </div>
  );
}

function InfoChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-surface-soft px-3 py-1 text-xs leading-5 text-secondary">
      {children}
    </span>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 fill-none stroke-current"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 8H4c0-1 2-1 2-8Z" />
      <path d="M9.5 20h5" />
    </svg>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
