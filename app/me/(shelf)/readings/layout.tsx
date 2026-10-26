import type { ReactNode } from 'react';

import { isBlocked, selfPersonIdOf } from '@/src/lib/account';

import { supabaseOnServer } from '../../../auth/server-client';
import { signedInUser } from '../../../auth/signed-in';
import { redirectToSignIn } from '../../../auth/sign-in-redirect';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { myReadings } from '../../reading/current';
import { matchesForViewer } from '../../requests/inbox';
import { runningReadings } from '../../home/running';
import { runningName } from '../../home/running-line';
import { readingHrefOf } from '../../reading/target';
import { withCameFrom } from '../../../came-from';
import { COMPAT_ENTRY_LABEL } from '../../../service-features';
import { bookOf, shelfNamesOf } from './book';
import { ReadingsFrame, ShelfItem, type NextBook } from './frame';
import { SHELF_KIND_LABEL, shelfKindOfReading, type ShelfKind } from './kind';
import type { ShelfLists } from './opening';
import { BlankBook, MakingGroup, MakingMatchRow, MakingRow, Nothing, Shelf, ShelfRow } from './shelf';

/**
 * **풀이 보관함** — 만든 글이 **한 목록에** 서는 자리 (ADR 0033) — 그리고 그 목록 옆에서 글을 읽는 자리.
 *
 * 보관함은 **홈 탭의 전체 기록**이다(ADR 0133 · 0134). 궁합 탭 · 인연 탭은 최근 몇 권만 들고 「모두 보기」로
 * 이리 보낸다 — 필터 칩 넷(전체 · 사주풀이 · 궁합풀이 · 인연 궁합)이 주소의 `?kind=` 를 읽어 그 칸으로 연다.
 *
 * 풀이가 네 화면에 흩어져 있었다. 이제 한 사람 풀이는 `/me/readings/[subject]`에 따로
 * 서고, 두 궁합은 각각의 결과 화면에 선다 — 보관함에서 열면 그 화면이 이 틀의 옆 칸에 선다(`readings/compat` · `readings/match/[id]`,
 * ADR 0134). 이 목록은 그 네 갈래의 공통 입구다.
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
 * **사주풀이·궁합풀이 두 구역으로만 가르고**(칩이 고른 칸은 kind 로만 거른다), 각 구역 안에서는 DB 가 준
 * 차례를 그대로 지킨다. 다시 정렬하거나 대상을 빼면 판정하는 자리가 둘이 되고, 둘이 갈리는 날 이
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

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  /*
    **책장은 계정과 나란히 읽는다**(2026-09-30) — 만든 풀이 · 성립한 Match 는 계정을 몰라도 읽을 수 있다. 계정을 읽은 뒤에
    시작하던 동안 탭 이동이 한 물결 더 길었다. 이용이 멈춘 계정이면 안 쓰고 버린다 — 아래에서 따로 받아 보므로, 여기서
    안 잡으면 버린 쪽의 실패가 처리되지 않은 거절로 뜬다.
  */
  const reading = Promise.all([myReadings(), matchesForViewer(), runningReadings()]);
  reading.catch(() => {});

  /** 빈 상태의 길이 내 사주 등록 여부를 묻는다 — 온보딩으로 보내지는 않는다 */
  const { state } = await readAccount(supabase);
  if (isBlocked(state)) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-8 sm:py-12">
        <AccountNotice state={state} />
      </main>
    );
  }
  const selfPersonId = selfPersonIdOf(state);

  const [readings, matches, runningRead] = await reading;
  const madeMatchIds = new Set(
    readings.flatMap((reading) =>
      reading.kind === 'match' && reading.matchId !== null ? [reading.matchId] : [],
    ),
  );
  const making = matches.filter((match) => !madeMatchIds.has(match.matchId));

  const books = readings.map((entry) => ({ book: bookOf(entry), kind: shelfKindOfReading(entry.kind), matchId: entry.matchId }));
  /* 구역 안의 차례는 DB 가 준 그대로다 — 가르기만 하고 다시 세우지 않는다 */
  const singles = books.flatMap(({ book }) => (book.single ? [book] : []));
  const pairsOf = (only: 'compat' | 'match' | null) =>
    books.filter(({ book, kind }) => !book.single && (only === null || kind === only));
  const hasSelfReading = readings.some((entry) => entry.kind === 'self');

  /*
    **만드는 중인 한 사람 풀이 · 궁합풀이도 책장에 선다**(2026-10-10 화면 점검 B3) — 홈에서 「만드는 중」을 보고 오면 그 풀이가
    사라진 것처럼 읽혔다. 무엇이 도는가는 DB 가 정하고(`my_running_readings`), 여기서는 **이미 꽂힌 권을 한 번 더 세우지 않는
    것**만 가른다 — 다시 받는 중인 글은 제 표지가 그대로 선다. 인연 궁합은 `making` 이 든다. 못 읽으면 안 선다(부속
    정보, ADR 0078).
  */
  const shelved = new Set(books.map(({ book }) => book.href));
  const runningBooks = (runningRead.ok ? runningRead.value : []).flatMap((one) => {
    const href = readingHrefOf(one.target);
    return one.target.kind === 'match' || shelved.has(href)
      ? []
      : [
          {
            key: href,
            href,
            name: runningName(one),
            names: shelfNamesOf(one.labelA, one.labelB),
            single: one.target.kind === 'self' || one.target.kind === 'person',
          },
        ];
  });
  const makingSingles = runningBooks.filter((one) => one.single);
  const makingPairs = runningBooks.filter((one) => !one.single);
  const makingSelfReading = runningBooks.some((one) => one.href === readingHrefOf({ kind: 'self' }));
  /* 인연 궁합 줄은 그 Match 의 받는 기운 · 균형을 든다(#849) — 같은 Match 를 두 번 읽지 않게 위에서 읽은 목록에서 찾는다 */
  const matchOf = new Map(matches.map((match) => [match.matchId, match]));
  const privates = pairsOf('compat');
  const fated = pairsOf('match');

  /*
    **맨 위의 「만드는 중」**(2026-10-26 운영자 결정 「안 D」) — 아직 도는 것은 종류와 상관없이 칩 · 찾기 바로 아래에 모인다. 차례는
    인연 궁합 → 사주풀이 → 궁합풀이(아래 묶음과 같은 차례)다. 전체 칸에서는 묶음 밖이라 줄마다 종류를 달고 머리 「만드는 중」이
    선다. 칩 하나를 고르면 그 종류의 것만 머리 없이 선다.
  */
  const makingRows = (only: Exclude<ShelfKind, 'all'> | null) => {
    const shelfKind: ShelfKind = only ?? 'all';
    const tagged = only === null;
    const rows = [
      ...(only === null || only === 'match'
        ? making.map((match) => (
            <ShelfItem key={match.matchId} href={`/me/match/${match.matchId}`}>
              <MakingMatchRow
                match={match}
                href={withCameFrom(`/me/match/${match.matchId}`, 'shelf', shelfKind)}
                kind={tagged ? SHELF_KIND_LABEL.match : undefined}
              />
            </ShelfItem>
          ))
        : []),
      ...(only === null || only === 'saju' ? makingSingles : []).map((one) => (
        <ShelfItem key={one.key} href={one.href}>
          <MakingRow href={one.href} name={one.name} from="shelf" kind={tagged ? SHELF_KIND_LABEL.saju : undefined} />
        </ShelfItem>
      )),
      ...(only === null || only === 'compat' ? makingPairs : []).map((one) => (
        <ShelfItem key={one.key} href={one.href}>
          <MakingRow href={one.href} name={one.name} from="shelf" kind={tagged ? SHELF_KIND_LABEL.compat : undefined} />
        </ShelfItem>
      )),
    ];
    return rows;
  };
  const allMaking = makingRows(null);

  /*
    묶음의 머리는 전체 칸에만 선다 — 칩 하나를 고르면 칩이 이미 무엇을 보는지 말한다(안 D). 그때 그 종류의 만드는 중인 줄은 같은
    목록의 맨 위에 붙는다(한 열이 끊기지 않게)
  */
  const sajuShelf = (titled: boolean) => (
    /*
      **사주풀이 묶음은 비어도 선다 — 점선 한 줄로.** 내 사주풀이가 아직 없으면 그 받는 자리가 끝에 선다. 내 사주가 없으면 등록이다.
    */
    <Shelf {...(titled ? { title: '사주풀이', description: '나와 저장한 사람을 한 사람씩 본 풀이예요.' } : {})}>
      {!titled && makingRows('saju')}
      {singles.map((book) => (
        <ShelfItem key={book.key} href={book.href}>
          <ShelfRow book={book} from="shelf" />
        </ShelfItem>
      ))}
      {selfPersonId === null ? (
        <BlankBook href="/me" element="木" label="내 사주 등록하기" wide />
      ) : (
        !hasSelfReading && !makingSelfReading && <BlankBook href="/me/readings/self" element="木" label="사주풀이 받기" from="shelf" wide />
      )}
    </Shelf>
  );

  /* 직접 본 궁합 — 비면 궁합 탭으로 가는 점선 한 줄. 만드는 중인 것은 맨 위에 있으므로 그때는 점선을 안 세운다 */
  const compatShelf = (titled: boolean) => (
    <Shelf {...(titled ? { title: '궁합풀이', description: '두 사람을 함께 맞대어 본 풀이예요.' } : {})}>
      {!titled && makingRows('compat')}
      {privates.map(({ book }) => (
        <ShelfItem key={book.key} href={book.href}>
          <ShelfRow book={book} from="shelf" />
        </ShelfItem>
      ))}
      {privates.length === 0 && makingPairs.length === 0 && (
        <BlankBook href="/compat" element="火" label={COMPAT_ENTRY_LABEL} wide />
      )}
    </Shelf>
  );

  /* 인연 궁합 — 다 된 글. 전체 칸에서는 한 권도 없으면 묶음이 안 선다. 인연 궁합 칩에서 아무것도 없으면 오늘의 인연으로 가는 점선 한 줄 */
  const fatedShelf = (titled: boolean) =>
    (fated.length > 0 || !titled) && (
      <Shelf {...(titled ? { title: '인연 궁합', description: '서로 동의해 두 사람이 함께 보는 궁합풀이예요.' } : {})}>
        {!titled && makingRows('match')}
        {fated.map(({ book, matchId }) => (
          <ShelfItem key={book.key} href={book.href}>
            <ShelfRow book={book} from="shelf" match={(matchId === null ? undefined : matchOf.get(matchId)) ?? null} />
          </ShelfItem>
        ))}
        {fated.length === 0 && making.length === 0 && <BlankBook href="/me/matching" element="水" label="오늘의 인연" wide />}
      </Shelf>
    );

  /* 필터 칸마다의 책장(ADR 0133) — 어느 칸을 세울지는 주소를 읽는 `frame.tsx` 가 고른다. 차례는 안 D(운영자 2026-10-26) */
  const shelves: Record<ShelfKind, ReactNode> = {
    all: (
      <>
        {allMaking.length > 0 && <MakingGroup>{allMaking}</MakingGroup>}
        {fatedShelf(true)}
        {sajuShelf(true)}
        {compatShelf(true)}
      </>
    ),
    saju: sajuShelf(false),
    compat: compatShelf(false),
    match: fatedShelf(false),
  };

  /* 한 권도 없으면 목록 주소에는 두 칸 대신 안내 한 장이 선다 — 글 주소(`/me/readings/self`)는 그래도 두 칸이다 */
  const nothing = books.length === 0 && making.length === 0 && runningBooks.length === 0 ? <Nothing hasSelf={selfPersonId !== null} /> : null;

  /* 칩마다 책장에 선 차례 그대로의 주소 — 넓은 화면에서 목록만 열면 이 가운데 한 권을 편다(`opening.ts`) */
  const makingHrefs = making.map((match) => `/me/match/${match.matchId}`);
  const hrefsOf = (entries: readonly { book: { href: string } }[]) => entries.map(({ book }) => book.href);
  const runningSingleHrefs = makingSingles.map((one) => one.href);
  const runningPairHrefs = makingPairs.map((one) => one.href);
  const lists: ShelfLists = {
    all: [
      ...makingHrefs,
      ...runningSingleHrefs,
      ...runningPairHrefs,
      ...hrefsOf(fated),
      ...singles.map((book) => book.href),
      ...hrefsOf(privates),
    ],
    saju: [...runningSingleHrefs, ...singles.map((book) => book.href)],
    compat: [...runningPairHrefs, ...hrefsOf(privates)],
    match: [...makingHrefs, ...hrefsOf(fated)],
  };

  const nextBooks: NextBook[] = singles.map((book) => ({
    href: book.href,
    title: book.title,
    metaphor: book.metaphor,
    element: book.subjects[0]?.element ?? null,
    stem: book.subjects[0]?.stem ?? null,
  }));

  /* 찾는 칸이 맞춰 볼 이름 — 주소는 `lists` 와 같은 꼴(인연 궁합의 편지는 `/me/match/[id]`)이다 */
  const names: Record<string, readonly string[]> = Object.fromEntries([
    ...making.map((match) => [`/me/match/${match.matchId}`, [match.nickname]] as const),
    ...runningBooks.map((one) => [one.href, one.names] as const),
    ...books.map(({ book }) => [book.href, book.names] as const),
  ]);

  return (
    <main className="app-shell flex flex-1 flex-col py-8 sm:py-12">
      <ReadingsFrame account={user.id} shelves={shelves} lists={lists} nothing={nothing} singles={nextBooks} names={names}>
        {children}
      </ReadingsFrame>
    </main>
  );
}
