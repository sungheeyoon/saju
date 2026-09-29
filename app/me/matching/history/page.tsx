import Link from 'next/link';

import { isBlocked } from '@/src/lib/account';

import { supabaseOnServer } from '../../../auth/server-client';
import { signedInUser } from '../../../auth/signed-in';
import { redirectToSignIn } from '../../../auth/sign-in-redirect';
import { answerOfThrown, read, type SkippableRead } from '../../../db-error';
import { BUTTON_TERTIARY } from '../../../ui/buttons';
import { Icon } from '../../../ui/icons';
import { TYPE_SECTION, TYPE_TITLE } from '../../../ui/surfaces';
import { MakingShelf, PairCover } from '../../(shelf)/readings/shelf';
import { readAccount } from '../../account';
import { AccountNotice } from '../../account-notice';
import { myReadings, type ReadingEntry } from '../../reading/current';
import { matchesForViewer, requestsForViewer, type InboxMatch, type Requests } from '../../requests/inbox';
import { makingMatches, matchBooks, pastRequests } from '../history';
import { COUNT_CHIP } from '../history-row';
import { PastRequestList, receivedOf } from '../requests-lead';

export const metadata = {
  title: '인연 기록',
  robots: { index: false, follow: false },
};

/**
 * **인연 기록** — 인연 궁합 전부와 지난 요청(운영자 답 2026-09-29 u2, ADR 0130 덧붙임).
 *
 * 인연 탭 첫 화면은 덱이 주인이라 지나간 것은 「인연 기록 N」 한 줄로만 선다(`history-row.tsx`). 이 화면이 그 줄의 안쪽이다 —
 * #330 이 덱 아래 펼쳤던 최근 인연 궁합 셋과 지난 요청 접이칸이 여기로 왔다. 주소가 `/me/matching` 아래라 인연 탭에 불이
 * 켜지고(`site-header.tsx`), 로그인 · 가입 관문(`proxy.ts` 의 `/me/:path*` · `src/lib/consent/gate.ts`)도 그대로 지난다.
 *
 * 인연 궁합 표지는 책장의 궁합 표지 그대로(`PairCover`)이고, 수락 직후 글이 아직 없는 것은 책장의 「만드는 중」 편지
 * (`MakingShelf`)로 선다 — 탭의 한 줄이 센 수(`my_matches`)와 여기 선 수가 같다. 둘 다 `?from=history` 를 달고 결과 화면으로 간다 — 결과 화면의 ← 가
 * 이 화면으로 돌아온다(`from` 약속, 2026-09-29 u2).
 *
 * 둘은 **나란히 읽고 따로 비운다** — 어느 한쪽을 못 읽어도 다른 쪽은 선다(ADR 0078). 못 읽은 쪽은 제 자리에 까닭 한 줄.
 */
export default async function MatchHistoryPage() {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const { state } = await readAccount<{ status: string }>(supabase, 'status');
  if (isBlocked(state)) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-7 py-9 sm:py-12">
        <AccountNotice state={state} />
      </main>
    );
  }

  const [readings, matches, requests] = await Promise.all([
    myReadings().then(read, (thrown: unknown): SkippableRead<readonly ReadingEntry[]> => ({
      ok: false,
      reason: answerOfThrown(thrown, 'my_readings'),
    })),
    matchesForViewer().then(read, (thrown: unknown): SkippableRead<readonly InboxMatch[]> => ({
      ok: false,
      reason: answerOfThrown(thrown, 'my_matches'),
    })),
    requestsForViewer().then(read, (thrown: unknown): SkippableRead<Requests> => ({
      ok: false,
      reason: answerOfThrown(thrown, 'inbox'),
    })),
  ]);

  const books = readings.ok ? matchBooks(readings.value) : [];
  /* 글이 아직 없는 인연 궁합 — 수락 직후 만드는 중이다. 글 목록을 못 읽었으면 가르지 못하므로 안 세운다 */
  const making = readings.ok && matches.ok ? makingMatches(readings.value, matches.value) : [];
  const matchCount = books.length + making.length;
  const past = requests.ok ? pastRequests(requests.value) : null;
  const pastCount = past === null ? 0 : past.sent.length + past.decided.length;
  const empty = readings.ok && requests.ok && matchCount === 0 && pastCount === 0 && past?.blocked === 0;

  return (
    <main className="app-shell flex flex-1 flex-col gap-7 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <Link href="/me/matching" className={`${BUTTON_TERTIARY} -ml-1 self-start`}>
          <Icon name="back" className="size-4" />
          인연
        </Link>
        <h1 className={TYPE_TITLE}>인연 기록</h1>
      </header>

      {empty && <p className="text-[15px] leading-6 text-secondary">아직 인연 기록이 없습니다.</p>}

      {(!readings.ok || matchCount > 0) && (
        <section aria-labelledby="history-matches" className="flex flex-col gap-4">
          <h2 id="history-matches" className={`${TYPE_SECTION} flex items-center gap-2`}>
            인연 궁합
            {readings.ok && <span className={COUNT_CHIP}>{matchCount}</span>}
          </h2>
          {readings.ok ? (
            <>
              {making.length > 0 && (
                <MakingShelf matches={making} titled={false} hrefOf={(matchId) => `/me/match/${matchId}?from=history`} />
              )}
              {books.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {books.map((book) => (
                    <li key={book.key}>
                      <PairCover book={book} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">인연 궁합을 읽지 못했습니다 — {readings.reason}</p>
          )}
        </section>
      )}

      {(!requests.ok || (past !== null && (pastCount > 0 || past.blocked > 0))) && (
        <section aria-labelledby="history-requests" className="flex flex-col gap-4">
          <h2 id="history-requests" className={`${TYPE_SECTION} flex items-center gap-2`}>
            지난 요청
            {requests.ok && <span className={COUNT_CHIP}>{pastCount}</span>}
          </h2>
          {requests.ok ? (
            past !== null && <PastRequestList past={past} guide={receivedOf(requests.value.requests).length === 0} />
          ) : (
            <p className="text-sm text-muted">요청을 읽지 못했습니다 — {requests.reason}</p>
          )}
        </section>
      )}
    </main>
  );
}
