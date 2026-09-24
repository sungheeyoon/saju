import Link from 'next/link';
import { redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';
import {
  CONSENT_FLOW_CAVEAT,
  CONSENT_FLOW_STEPS,
  REQUEST_STATUS_TEXT,
  type NotificationKind,
} from '@/src/lib/consent';

import { supabaseOnServer } from '../../auth/server-client';
import { Icon, type IconName } from '../../ui/icons';
import { BADGE, ROW_CARD, TYPE_META, TYPE_NAME, TYPE_SECTION, TYPE_TITLE } from '../../ui/surfaces';
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
  title: '소식',
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
 *
 * ## 답할 일이 위, 알림이 아래 (5차, 부드러움)
 *
 * 알림 목록이 맨 위에 서 있었고 받은 요청은 그 아래였다. 알림은 이 화면에 들어오는 순간 전부
 * 읽음이 되므로(`ReadNotificationsOnVisit`) 다시 볼 일이 적고, 받은 요청은 **내가 답할 때까지
 * 남는** 유일한 것이다. 그래서 차례를 뒤집었다 — 답할 일은 크게 위에, 지나간 일은 시간순 한 장의
 * 목록으로 아래에. 숫자 타일 셋(새 소식 · 받은 요청 · 답변 대기)은 뺐다. 읽는 순간 0 이 되는 수와
 * 바로 아래 절의 수를 한 번 더 세우는 판이었다 — 수는 절 제목 옆 딱지가 든다.
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
    <main className="app-shell flex w-full max-w-2xl flex-1 flex-col gap-8 py-8 sm:py-12">
      <h1 className={TYPE_TITLE}>소식</h1>

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
    <div className="flex flex-col gap-10">
      <ReadNotificationsOnVisit unread={inbox.unread} />

      <section className="flex flex-col gap-3">
        <SectionHead title="받은 요청" count={received.length} />
        {received.length === 0 ? (
          <Nothing>답할 요청이 없습니다.</Nothing>
        ) : (
          <ul className="flex flex-col gap-4">
            {received.map((request) => (
              <li
                key={request.requestId}
                className="flex flex-col gap-4 rounded-[1.75rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6"
              >
                <RequestHead request={request} large />
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
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2">
                  <BlockButton userId={request.counterpartUserId} />
                  <ReportButton userId={request.counterpartUserId} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHead title="보낸 요청" count={sent.length} />
        {sent.length === 0 ? (
          <Nothing>기다리는 중인 요청이 없습니다.</Nothing>
        ) : (
          <ul className="flex flex-col gap-2">
            {sent.map((request) => (
              <li key={request.requestId} className={`${ROW_CARD} flex flex-col gap-2`}>
                <RequestHead request={request} />
                <p className="text-sm leading-6 text-secondary">{REQUEST_STATUS_TEXT.pending.sent}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-1">
                  <CancelButton requestId={request.requestId} />
                  <BlockButton userId={request.counterpartUserId} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Notifications inbox={inbox} />

      {/*
        끝난 요청도 남긴다. **왜 사라졌는지**를 말할 수 있어야 하기 때문이다 —
        무효와 거둠은 둘 다 「성립하지 않았다」지만 이유가 다르다(US 43).
      */}
      {decided.length > 0 && <DecidedRequests requests={decided} />}

      <div className="flex flex-col gap-3">
        <ConsentGuide />
        <BlockedCount count={inbox.blocked} />
      </div>
    </div>
  );
}

/** 절 제목 — 수는 딱지로. 0 이면 딱지를 안 세운다(빈 자리가 바로 아래에서 말한다) */
function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className={TYPE_SECTION}>{title}</h2>
      {count > 0 && <span className={BADGE}>{count}</span>}
    </div>
  );
}

/** 접이칸 한 줄 — 제목 줄이 44px 을 넘고 끝의 셰브론이 펴지면 아래를 본다 */
const FOLD = `${ROW_CARD} group py-0`;
const FOLD_SUMMARY =
  'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden';

function FoldMark() {
  return (
    <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">
      <Icon name="chevron" className="size-4" />
    </span>
  );
}

function ConsentGuide() {
  return (
    <details className={FOLD}>
      <summary className={FOLD_SUMMARY}>
        궁합 요청은 어떻게 진행되나요?
        <FoldMark />
      </summary>
      <ol className="flex flex-col gap-4 border-t border-border py-4">
        {CONSENT_FLOW_STEPS.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[1.75rem_1fr] gap-3">
            <span className="grid size-7 place-items-center rounded-full bg-cream text-[13px] font-bold text-cream-ink">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="mt-1 text-[13px] leading-5 text-secondary">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-border py-4 text-[13px] leading-5 text-muted">
        {CONSENT_FLOW_CAVEAT}
      </p>
    </details>
  );
}

function DecidedRequests({ requests }: { requests: readonly InboxRequest[] }) {
  return (
    <details className={FOLD}>
      <summary className={`${FOLD_SUMMARY} text-secondary`}>
        끝난 요청 {requests.length}개
        <FoldMark />
      </summary>
      <ul className="flex flex-col divide-y divide-border border-t border-border text-sm">
        {requests.map((request) => (
          <li key={request.requestId} className="flex flex-col gap-1 py-3">
            <span className="flex flex-wrap items-center gap-2">
              <strong className="font-semibold">{request.nickname}</strong>
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[12px] font-medium text-secondary">
                {REQUEST_STATUS_TEXT[request.status].label}
              </span>
              <span className={`ml-auto ${TYPE_META}`}>
                {when(request.decidedAt ?? request.createdAt)}
              </span>
            </span>
            <span className="text-[13px] leading-5 text-secondary">
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

/**
 * 사건마다 줄 머리의 그림 — **색이 아니라 모양이 갈래를 말한다.** 문장이 이미 사건을 말하므로
 * 그림은 훑어볼 때의 손잡이일 뿐이고, 그래서 늘 `aria-hidden` 이다.
 */
const NOTIFICATION_ICON: Record<NotificationKind, IconName> = {
  request_received: 'heart',
  request_accepted: 'heart',
  request_rejected: 'close',
  request_invalidated: 'alert',
  request_expired: 'ticket',
  reading_ready: 'reading',
  reading_failed: 'alert',
};

/** 되돌아볼 일이 난 사건 — 그림 자리가 위험 색을 입는다(문장이 따로 말하므로 색만으로 말하지 않는다) */
const NOTIFICATION_WARNS: readonly NotificationKind[] = ['request_invalidated', 'reading_failed'];

/**
 * 알림 — **한 장의 목록에 시간순으로.** 알림함처럼 줄 사이는 실선 하나이고, 안 읽은 줄은 크림 면과
 * 점으로 선다. 갈 자리가 있는 줄은 줄 전체가 링크이고 끝에 셰브론이 선다.
 */
function Notifications({ inbox }: { inbox: Inbox }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className={TYPE_SECTION}>새 소식</h2>

      {inbox.notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[1.5rem] border-2 border-dashed border-border-strong px-5 py-7 text-center">
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-full bg-surface-sunken text-muted"
          >
            <Icon name="bell" />
          </span>
          <p className="text-sm font-semibold">새로 도착한 소식이 없습니다</p>
          <p className={TYPE_META}>새 요청이나 풀이 결과가 생기면 여기에 알려드릴게요.</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[1.5rem] border border-border bg-surface">
          {inbox.notifications.map((notification) => {
            const warns = NOTIFICATION_WARNS.includes(notification.kind);
            const inner = (
              <>
                <span
                  aria-hidden="true"
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${
                    warns
                      ? 'bg-danger-wash text-danger'
                      : notification.unread
                        ? 'bg-cream text-cream-ink'
                        : 'bg-surface-sunken text-secondary'
                  }`}
                >
                  <Icon name={NOTIFICATION_ICON[notification.kind]} className="size-[1.15rem]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={`text-[15px] leading-6 ${
                      notification.unread ? 'font-semibold text-foreground' : 'text-secondary'
                    }`}
                  >
                    {notification.text}
                  </span>
                  <time dateTime={notification.createdAt} className={TYPE_META}>
                    {when(notification.createdAt)}
                  </time>
                </span>
                {/* 읽지 않은 것만 표시한다 — 읽은 것에 「읽음」을 붙이면 목록이 시끄럽다 */}
                {notification.unread && (
                  <span
                    role="img"
                    aria-label="읽지 않음"
                    className="mt-2 size-2 shrink-0 rounded-full bg-badge"
                  />
                )}
                {notification.href !== null && (
                  <span aria-hidden="true" className="mt-2 text-muted">
                    <Icon name="chevron" className="size-4" />
                  </span>
                )}
              </>
            );
            const row = `flex items-start gap-3 px-4 py-3.5 sm:px-5 ${
              notification.unread ? 'bg-cream/60' : ''
            }`;
            return (
              <li
                key={notification.notificationId}
                className="border-t border-border first:border-t-0"
              >
                {/*
                  **갈 자리가 있으면 링크로 세운다.** 실패 알림은 「무엇이 안 됐다」로
                  끝나면 안 되고 다시 누를 자리까지 닿아야 한다 — 비공개 궁합은 두
                  사람을 다시 골라야 가는 자리다. 갈 곳이 없으면 글자로만 선다.
                */}
                {notification.href === null ? (
                  <div className={row}>{inner}</div>
                ) : (
                  <Link href={notification.href} className={`${row} hover:bg-surface-soft`}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className={TYPE_META}>
        소식은 앱 안에서만 확인할 수 있습니다. 이메일·문자·카카오로는 보내지 않습니다.
      </p>
    </section>
  );
}

/**
 * 절이 비었을 때 — **카드 자리에 점선 자리가 선다.** 같은 절이 차면 그 자리에 카드가 서므로,
 * 빈 것도 같은 층의 자리로 말한다. 회색 문장 한 줄만 바탕에 떠 있으면 빈 것과 카드 밖의 것이
 * 같은 모양이 된다.
 */
function Nothing({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border-2 border-dashed border-border-strong px-5 py-4">
      <p className="text-sm text-secondary">{children}</p>
    </div>
  );
}

/** 요청 한 장의 머리 — 닉네임·사진·소개와 **양쪽 방향의 오행** */
function RequestHead({ request, large = false }: { request: InboxRequest; large?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar
          userId={request.counterpartUserId}
          nickname={request.nickname}
          hasPhoto={request.hasPhoto}
          size={large ? 52 : 40}
        />
        <div className="min-w-0 flex-1">
          <h3 className={large ? TYPE_NAME : 'text-base font-semibold'}>{request.nickname}</h3>
          <time dateTime={request.createdAt} className={`block ${TYPE_META}`}>
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
    <span className="rounded-xl bg-surface-sunken px-3 py-1.5 text-[13px] font-medium leading-5 text-secondary">
      {children}
    </span>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
