import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { Halted } from '../halted';
import { myReadings, type ReadingEntry } from '../reading/current';
import { readingDate, readingHref, readingTitle } from '../reading/line';

export const metadata = {
  title: '풀이 — 만세력',
  description: '내가 만든 사주풀이와 궁합 풀이가 시간순으로 섭니다.',
};

/**
 * 만든 글이 **한 목록에** 서는 자리 (ADR 0033).
 *
 * 풀이가 네 화면에 흩어져 있었다 — 자기 풀이는 `/me`, 저장한 사람은 그 사람 상세,
 * 비공개 궁합은 `/me/compat` 의 「본 궁합」, 인연 궁합은 `/me/match/[id]`. **만든 글이
 * 어디 있는지 사용자가 외워야 하는 상태였다.**
 *
 * ## 여기서 아무것도 판정하지 않는다
 *
 * 차례도 좁힘도 DB 가 정한다(`my_readings`). 다시 정렬하거나 걸러내면 판정하는 자리가
 * 둘이 되고, 둘이 갈리는 날 이 화면이 DB 보다 넓거나 좁아진다.
 *
 * ## 본문이 없다
 *
 * 줄이 드는 것은 종류·대상 이름·날짜·점수·「이전 입력」과 **가는 길**뿐이다. 본문을
 * 실으면 이 목록이 곧 두 번째 결과 화면이 되고, 「결과 화면에 무엇이 나가는가」의 답이
 * 둘이 된다(ADR 0008). 특히 `match` 는 잘린 글이라 자르는 자리가 둘이 되는 순간
 * 한쪽이 덜 자른다. 그 경계는 함수가 이미 들지만(반환형에 `output` 이 없다) 화면도
 * 같은 것을 지킨다 — 열지 않는 것과 못 여는 것은 다르다.
 */
export default async function ReadingsPage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data: account } = await supabase.from('app_user').select('status').maybeSingle();
  if (account !== null && account.status !== 'active') {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-14">
        <Halted status={account.status} />
      </main>
    );
  }

  const readings = await myReadings();

  return (
    <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-14">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">풀이</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">만든 풀이</h1>
        <p className="text-sm text-secondary">
          내 사주와 저장한 사람, 두 사람의 궁합까지 만들어 둔 글이 최근 것부터 섭니다.
          누르면 그 글이 사는 화면으로 갑니다.
        </p>
      </header>

      {readings.length === 0 ? <Nothing /> : <Made readings={readings} />}
    </main>
  );
}

/**
 * 아직 하나도 없을 때 — **어디서 만드는지를 말한다.**
 *
 * 「본 궁합」은 비어 있으면 아무것도 안 그렸다. 거기서는 **고르는 칸이 이미 그 말을
 * 하고 있었기** 때문이다. 여기는 사용자가 메뉴에서 눌러 들어온 제 화면이라 그 말을
 * 대신해 줄 것이 없고, 빈 화면만 남으면 고장으로 읽힌다.
 */
function Nothing() {
  return (
    <section className={`${CARD} flex flex-col gap-1.5`}>
      <h2 className="text-base font-semibold">아직 만든 풀이가 없습니다</h2>
      <p className="text-sm leading-6 text-secondary">
        <Link href="/me" className="text-accent underline underline-offset-2">
          내 사주
        </Link>{' '}
        에서 내 풀이를 만들 수 있고, 저장한 사람의 풀이와 두 사람의 궁합은{' '}
        <Link href="/me/people" className="text-accent underline underline-offset-2">
          사람
        </Link>{' '}
        에서 시작합니다.
      </p>
    </section>
  );
}

function Made({ readings }: { readings: readonly ReadingEntry[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {readings.map((one) => (
        <li key={`${one.kind}:${one.matchId ?? one.personA ?? 'me'}:${one.personB ?? ''}`}>
          <Link
            href={readingHref(one)}
            className="flex items-center gap-3 rounded-xl border border-border-strong bg-surface px-4 py-3 text-sm hover:border-accent hover:text-accent"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{readingTitle(one)}</span>

            {/* 궁합 줄에는 점수가 함께 선다 — 결과 화면에서 이미 본 값이다(ADR 0033) */}
            {one.score !== null && (
              <span className="shrink-0 text-sm font-semibold tabular-nums text-accent">
                {one.score}
                <span className="ml-0.5 text-xs font-normal text-muted">점</span>
              </span>
            )}

            {/*
              **낡았다는 것을 목록에서도 말한다.** 열어 봐야 알게 되면, 목록은 「지금
              입력으로 본 것」과 「그 뒤에 고친 입력으로 다시 봐야 하는 것」을 같은 줄로
              보이게 된다. 색만으로 말하지 않는다 — 낱말이 함께 있어야 한다.
            */}
            {!one.fromCurrentRevision && (
              <span className="shrink-0 rounded-full bg-warning-wash px-2 py-0.5 text-[11px] font-semibold text-warning">
                이전 입력
              </span>
            )}

            <time dateTime={one.createdAt} className="shrink-0 text-xs text-muted">
              {readingDate(one.createdAt)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
