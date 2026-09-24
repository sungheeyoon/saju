import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { isBlocked, selfPersonIdOf } from '@/src/lib/account';

import { supabaseOnServer } from '../../auth/server-client';
import { TYPE_TITLE } from '../../ui/surfaces';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { myReadings } from '../reading/current';
import { matchesForViewer } from '../requests/inbox';
import { bookOf } from './book';
import { ReadingsFrame, type NextBook } from './frame';
import { BlankBook, MakingShelf, Nothing, PairCover, Shelf, SingleCover } from './shelf';

/**
 * 만든 글이 **한 목록에** 서는 자리 (ADR 0033) — 그리고 그 목록 옆에서 글을 읽는 자리.
 *
 * 풀이가 네 화면에 흩어져 있었다. 이제 한 사람 풀이는 `/me/readings/[subject]`에 따로
 * 서고, 두 궁합은 각각의 결과 화면에 선다. 이 목록은 그 네 갈래의 공통 입구다.
 *
 * ## 책장이 레이아웃에 산다 (6차 warm)
 *
 * 넓은 화면은 왼쪽 책장 · 오른쪽 글의 두 칸이다(시안 3차 warm). 책장을 레이아웃에 두어 표지를 눌러
 * 옮겨 다녀도 목록이 그대로 서고 오른쪽만 바뀐다. 두 칸을 어떻게 갈아 끼우는지는 `frame.tsx` 가 든다.
 * 글이 새로 만들어지면 글 화면이 `router.refresh()` 를 부르고, 그것이 이 레이아웃도 다시 읽는다 —
 * 표지의 비유가 따라 바뀐다.
 *
 * ## 여기서 아무것도 판정하지 않는다
 *
 * 차례도 좁힘도 DB 가 정한다(`my_readings`). 화면은 한 사람짜리와 두 사람짜리를
 * **사주풀이·궁합풀이 두 구역으로만 가르고**, 각 구역 안에서는 DB 가 준 차례를 그대로
 * 지킨다. 다시 정렬하거나 대상을 빼면 판정하는 자리가 둘이 되고, 둘이 갈리는 날 이
 * 화면이 DB 보다 넓거나 좁아진다.
 *
 * ## 책장에는 본문이 없다
 *
 * 표지가 드는 것은 종류·대상 이름·날짜·점수·「수정 전」·비유 한 줄과 **가는 길**뿐이다. 본문을
 * 실으면 이 목록이 곧 두 번째 결과 화면이 되고, 「결과 화면에 무엇이 나가는가」의 답이
 * 둘이 된다(ADR 0008). 특히 `match` 는 잘린 글이라 자르는 자리가 둘이 되는 순간
 * 한쪽이 덜 자른다. 그 경계는 함수가 이미 들지만(반환형에 `output` 이 없다) 화면도
 * 같은 것을 지킨다 — 열지 않는 것과 못 여는 것은 다르다. 옆 칸의 글은 제 주소의 화면이 따로 읽는다.
 *
 * 표지 색은 대상의 일간이다. **그 값도 목록 문이 준다**(G-59) — 명식을 다시 읽지도 엔진을 돌리지도 않는다.
 * 인연 궁합의 상대 쪽 반은 결과 화면이 이미 연 동의 당시 사본의 일간이다. 문이 모르면 회색 표지다.
 */
export default async function ReadingsLayout({ children }: { children: ReactNode }) {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  /** 빈 상태의 길이 내 사주 등록 여부를 묻는다 — 온보딩으로 보내지는 않는다 */
  const { state } = await readAccount(supabase);
  if (isBlocked(state)) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-14">
        <AccountNotice state={state} />
      </main>
    );
  }
  const selfPersonId = selfPersonIdOf(state);

  const [readings, matches] = await Promise.all([myReadings(), matchesForViewer()]);
  const madeMatchIds = new Set(
    readings.flatMap((reading) =>
      reading.kind === 'match' && reading.matchId !== null ? [reading.matchId] : [],
    ),
  );
  const making = matches.filter((match) => !madeMatchIds.has(match.matchId));

  const books = readings.map(bookOf);
  /* 구역 안의 차례는 DB 가 준 그대로다 — 가르기만 하고 다시 세우지 않는다 */
  const singles = books.filter((book) => book.single);
  const pairs = books.filter((book) => !book.single);
  const hasSelfReading = readings.some((entry) => entry.kind === 'self');

  const title = (
    <header className="flex flex-col gap-2">
      <h1 className={TYPE_TITLE}>만든 풀이</h1>
      {books.length > 0 && (
        <p className="text-[13px] font-semibold tabular-nums text-secondary">
          사주풀이 {singles.length} · 궁합풀이 {pairs.length}
        </p>
      )}
    </header>
  );

  const shelf = (
    <>
      {title}
      {making.length > 0 && <MakingShelf matches={making} />}
      {/*
        **빈 구역도 선다 — 점선 한 권으로.** 구역을 통째로 숨기면 「궁합풀이도 여기 꽂힌다」가 안
        보인다. 빈 자리는 같은 크기의 점선 표지라 「한 권 더」로 읽히고, 누르면 만드는 자리로 간다.
      */}
      <Shelf title="사주풀이" description="나와 저장한 사람을 한 사람씩 본 풀이입니다.">
        {singles.map((book) => (
          <li key={book.key}>
            <SingleCover book={book} />
          </li>
        ))}
        {selfPersonId === null ? (
          <BlankBook href="/me" element="木" label="내 사주 등록" />
        ) : (
          !hasSelfReading && <BlankBook href="/me/readings/self" element="木" label="내 사주풀이" />
        )}
      </Shelf>

      <Shelf title="궁합풀이" description="두 사람을 함께 맞대어 본 풀이입니다.">
        {pairs.map((book) => (
          <li key={book.key}>
            <PairCover book={book} />
          </li>
        ))}
        {pairs.length === 0 && <BlankBook href="/compat" element="火" label="궁합 보러 가기" />}
      </Shelf>
    </>
  );

  /* 한 권도 없으면 목록 주소에는 두 칸 대신 안내 한 장이 선다 — 글 주소(`/me/readings/self`)는 그래도 두 칸이다 */
  const nothing =
    books.length === 0 && making.length === 0 ? (
      <div className="flex flex-col gap-10">
        {title}
        <Nothing hasSelf={selfPersonId !== null} />
      </div>
    ) : null;

  const nextBooks: NextBook[] = singles.map((book) => ({
    href: book.href,
    title: book.title,
    metaphor: book.metaphor,
    element: book.subjects[0]?.element ?? null,
  }));

  return (
    <main className="app-shell flex flex-1 flex-col py-9 sm:py-14">
      <ReadingsFrame shelf={shelf} nothing={nothing} singles={nextBooks}>
        {children}
      </ReadingsFrame>
    </main>
  );
}
