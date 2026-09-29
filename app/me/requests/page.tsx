import Link from 'next/link';

import { isBlocked } from '@/src/lib/account';
import type { NotificationKind } from '@/src/lib/consent';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { answerOfThrown } from '../../db-error';
import { Icon, type IconName } from '../../ui/icons';
import { TYPE_META, TYPE_SECTION, TYPE_TITLE } from '../../ui/surfaces';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { inboxForViewer, type Inbox } from './inbox';
import { ReadNotificationsOnVisit } from './manage';
import { when } from './when';

export const metadata = {
  title: '소식',
  description: '궁합 요청의 결과와 풀이의 새 소식을 확인합니다.',
};

/**
 * 소식 — **머리글의 종이 여는 화면이고, 지나간 일만 든다**(ADR 0130).
 *
 * 받은 요청 · 보낸 요청은 인연 탭 맨 위로 옮겼다 — 동의가 일어나는 자리는 인연에서 난 일 곁이다
 * (`app/me/matching/requests-lead.tsx`). 여기는 요청의 결과와 풀이의 소식을 시간순 한 장으로 세운다.
 * 요청의 소식을 누르면 인연 탭으로 간다(`inbox.ts` 의 `destinationFor`).
 *
 * 이 화면에 들어오는 순간 소식은 전부 읽음이 된다(`ReadNotificationsOnVisit`) — 요청이 왔다는 줄도.
 * 그 요청은 답할 때까지 인연 탭의 딱지가 센다.
 */
export default async function RequestsPage() {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

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
  } catch (thrown) {
    /*
      문이 던진 거절(`DbFailure`)은 이미 우리말로 옮겨졌다 — 그것만 옮긴다. 망 · 모르는 예외의 원문은 영어일 수
      있어 기록에만 보내고 일반 문장이 선다(`answerOfThrown`). 전에는 `error.message` 를 그대로 세웠다.
    */
    return (
      <p className="text-sm text-muted">소식을 불러오지 못했어요. {answerOfThrown(thrown, 'inbox')}</p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <ReadNotificationsOnVisit unread={inbox.unread} />
      <Notifications inbox={inbox} />
    </div>
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
        소식은 앱 안에서만 볼 수 있어요. 이메일 · 문자 · 카카오톡으로는 보내지 않아요.
      </p>
    </section>
  );
}
