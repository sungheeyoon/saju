import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CONSENT_INTRO, MATCH_RESULT_LINK, REQUEST_STATUS_TEXT } from '@/src/lib/consent';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { inboxForViewer, type Inbox, type InboxMatch, type InboxRequest } from './inbox';
import {
  BlockButton,
  BlockedCount,
  CancelButton,
  MarkAllRead,
  MatchScope,
  RespondButtons,
} from './manage';

export const metadata = {
  title: '요청과 알림 — 만세력',
  description: '상세 궁합 요청과 앱 내 알림, 그리고 성립한 Match 를 봅니다.',
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

  const { data: account } = await supabase
    .from('app_user')
    .select('status, self_person_id')
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">요청과 알림</h1>
        <p className="max-w-2xl text-sm text-secondary">
          상세 궁합은 <strong className="font-medium">서로 동의한 뒤</strong>에 열립니다.
          요청은 지금 두 사람의 출생정보 판본에 매여 있고, 어느 한쪽이 그 입력을 고치면
          무효가 됩니다.
        </p>
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href="/me" className="text-accent underline underline-offset-2">
            내 사주
          </Link>
          <Link href="/me/discovery" className="text-accent underline underline-offset-2">
            후보
          </Link>
        </p>
      </header>

      {account === null ? (
        <p className="text-sm text-muted">계정을 읽지 못했습니다. 다시 로그인해 주세요.</p>
      ) : account.status !== 'active' ? (
        <p className="text-sm text-muted">중지된 계정입니다.</p>
      ) : (
        <InboxSections />
      )}
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
    <>
      <Notifications inbox={inbox} />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">받은 요청 {received.length > 0 && `(${received.length})`}</h2>
        {received.length === 0 ? (
          <p className="text-sm text-muted">답할 요청이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {received.map((request) => (
              <li key={request.requestId} className={`${CARD} flex flex-col gap-3`}>
                <RequestHead request={request} />
                {/*
                  **동의 화면이다.** 무엇이 열리는지는 눌러야 나타나는 것이 아니라
                  카드가 열릴 때부터 버튼 위에 서 있다 — 읽지 않고 누른 수락은 동의가
                  아니고, 눌러야 나타나는 고지는 밖에서 잴 수도 없다.
                */}
                <MatchScope intro={CONSENT_INTRO} />
                <RespondButtons requestId={request.requestId} />
                <div className="flex flex-wrap items-center gap-4 border-t border-border pt-2">
                  <BlockButton userId={request.counterpartUserId} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">보낸 요청</h2>
        {sent.length === 0 ? (
          <p className="text-sm text-muted">기다리는 중인 요청이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sent.map((request) => (
              <li key={request.requestId} className={`${CARD} flex flex-col gap-2`}>
                <RequestHead request={request} />
                <p className="text-sm text-secondary">{REQUEST_STATUS_TEXT.pending.sent}</p>
                <div className="flex flex-wrap items-center gap-4 border-t border-border pt-2">
                  <CancelButton requestId={request.requestId} />
                  <BlockButton userId={request.counterpartUserId} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Matches matches={inbox.matches} />

      {/*
        끝난 요청도 남긴다. **왜 사라졌는지**를 말할 수 있어야 하기 때문이다 —
        무효와 거둠은 둘 다 「성립하지 않았다」지만 이유가 다르다(US 43).
      */}
      {decided.length > 0 && (
        <details className="rounded-xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm">끝난 요청 {decided.length}개</summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {decided.map((request) => (
              <li key={request.requestId} className="flex flex-col gap-0.5">
                <span className="flex flex-wrap items-baseline gap-2">
                  <strong className="font-medium">{request.nickname}</strong>
                  <span className="text-xs text-muted">
                    {REQUEST_STATUS_TEXT[request.status].label}
                  </span>
                  <span className="text-xs text-muted">{when(request.decidedAt ?? request.createdAt)}</span>
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
      )}

      <BlockedCount count={inbox.blocked} />
    </>
  );
}

function Notifications({ inbox }: { inbox: Inbox }) {
  return (
    <section className={`${CARD} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">
          알림 {inbox.unread > 0 && <span className="text-accent">{inbox.unread}</span>}
        </h2>
        <MarkAllRead unread={inbox.unread} />
      </div>

      {inbox.notifications.length === 0 ? (
        <p className="text-sm text-muted">아직 알림이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {inbox.notifications.map((notification) => (
            <li
              key={notification.notificationId}
              className="flex flex-wrap items-baseline gap-x-3 text-sm"
            >
              {/* 읽지 않은 것만 표시한다 — 읽은 것에 「읽음」을 붙이면 목록이 시끄럽다 */}
              {notification.unread && (
                <span className="size-1.5 rounded-full bg-accent" aria-label="읽지 않음" />
              )}
              <span className={notification.unread ? '' : 'text-secondary'}>
                {notification.text}
              </span>
              <span className="text-xs text-muted">{when(notification.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        알림은 앱 안에서만 옵니다. 이메일·문자·카카오로는 보내지 않습니다.
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
function Matches({ matches }: { matches: InboxMatch[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">성립한 Match</h2>

      {matches.length === 0 ? (
        <p className="text-sm text-muted">아직 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {matches.map((match) => (
            <li key={match.matchId} className={`${CARD} flex flex-col gap-2`}>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="text-base font-semibold">{match.nickname}</h3>
                <span className="text-xs text-muted">{when(match.createdAt)} 성립</span>
              </div>
              {match.intro !== null && <p className="text-sm text-secondary">{match.intro}</p>}
              {match.suppliedToMe !== null && (
                <p className="text-sm text-secondary">{match.suppliedToMe}</p>
              )}
              <p className="text-sm text-secondary">{match.balanceLabel}</p>
              <div className="flex flex-wrap items-center gap-4 border-t border-border pt-2">
                <Link
                  href={`/me/match/${match.matchId}`}
                  className="text-sm text-accent underline underline-offset-2"
                >
                  {MATCH_RESULT_LINK}
                </Link>
                <BlockButton userId={match.partnerUserId} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 요청 한 장의 머리 — 별명·소개와 **양쪽 방향의 오행** */
function RequestHead({ request }: { request: InboxRequest }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="text-base font-semibold">{request.nickname}</h3>
        <span className="text-xs text-muted">{when(request.createdAt)}</span>
      </div>

      {request.intro !== null && <p className="text-sm text-secondary">{request.intro}</p>}

      {/* 내 자리 기준이다 — 방향은 DB 가 뒤집어 준다 */}
      {request.suppliedToMe !== null && (
        <p className="text-sm text-secondary">{request.suppliedToMe}</p>
      )}
      {request.suppliedToThem !== null && (
        <p className="text-sm text-secondary">{request.suppliedToThem}</p>
      )}
      <p className="text-sm text-secondary">{request.balanceLabel}</p>
    </div>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
