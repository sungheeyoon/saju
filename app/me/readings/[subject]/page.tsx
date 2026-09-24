import { notFound, redirect } from 'next/navigation';

import { isBlocked, selfPersonIdOf } from '@/src/lib/account';
import { STEM_INFO } from '@/src/lib/saju';

import { supabaseOnServer } from '../../../auth/server-client';
import { BUTTON_TERTIARY } from '../../../ui/buttons';
import { TYPE_TITLE } from '../../../ui/surfaces';
import { readAccount } from '../../account';
import { currentReading } from '../../reading/current';
import { ReadingSection } from '../../reading/section';
import { BackToShelf } from '../frame';
import { SubjectTag } from '../shelf';
import { dayMastersOf } from '../subject';

/** 풀이 생성은 응답 뒤에서 최대 240초 동안 돌 수 있다. */
export const maxDuration = 300;

export const metadata = {
  title: '사주풀이',
  description: '내 사주 또는 저장한 사람의 사주풀이를 읽습니다.',
};

/**
 * 한 사람의 사주풀이가 사는 **독립된 결과 화면.**
 *
 * `/me` 와 `/me/people/[id]` 는 명식을 보는 자리다. 이 화면에는 풀이만 두고 두 자리는
 * 각 화면의 입구에서 연다. `self` 만 사람이 기억할 수 있는 이름이고 저장한 사람은 불투명 Person id 다.
 *
 * **책장 옆 칸에 펼쳐진다**(6차 warm). 넓은 화면에서는 레이아웃(`../layout.tsx`)의 책장이 왼쪽에 그대로
 * 서고 이 화면이 오른쪽 칸을 채운다. 폰은 이 화면만 서고, 「← 만든 풀이 목록」이 책장으로 돌아간다.
 *
 * **에세이처럼 읽는다**(5차 warm). 글의 짜임(모델이 낸 소제목 · 문단)은 `ReadingPanel` 과 `Markdown` 이
 * 그대로 들고, 이 화면은 표지 색을 정해 넘긴다 — 대상의 일간 오행이다. 목록의 책 표지와 같은 색이라
 * 표지를 누르고 들어온 사람이 같은 책을 펼친 것으로 읽는다.
 */
export default async function SingleReadingPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { state } = await readAccount(supabase);
  /* 막힌 계정의 안내는 레이아웃이 한 장으로 세운다 — 이 칸은 아무것도 읽지 않는다 */
  if (isBlocked(state)) return null;

  const selfPersonId = selfPersonIdOf(state);
  const { subject } = await params;
  const mine = subject === 'self';
  if (mine && selfPersonId === null) redirect('/me');

  const edge = mine
    ? null
    : (
        // eslint-disable-next-line no-restricted-syntax -- 옛 자리(ADR 0085): 문으로 옮기면 지운다
        await supabase
          .from('user_person_access')
          .select('person_id, local_label')
          .eq('person_id', subject)
          .maybeSingle()
      ).data;
  if (!mine && edge === null) notFound();

  const personId = mine ? selfPersonId : (edge?.person_id as string);
  if (personId === null) notFound();

  /* self Person id 를 직접 적은 옛 링크도 자기 풀이 한 자리로 모은다. */
  if (!mine && selfPersonId === personId) redirect('/me/readings/self');

  const name = mine ? '내 사주' : (edge?.local_label as string);
  const readingTitle = mine ? '내 사주풀이' : `${name}의 사주풀이`;
  const target = mine ? ({ kind: 'self' } as const) : ({ kind: 'person', personId } as const);
  /*
    **글이 있으면 머리 딱지도 그 글을 만들 때의 일간이다**(2026-09-25) — 「수정 전」 글을 보는 동안에는 책장 표지 ·
    글 표지 · 딱지가 모두 그때의 값이다. 지금 일간은 새로 받은 글부터 선다. 글이 없으면 지금 명식이고, 못 읽는
    명식이면 표지가 회색이다 — 색을 지어 넣지 않는다.
  */
  const reading = await currentReading(target);
  const dayMaster =
    reading?.dayMasterA != null
      ? { stem: reading.dayMasterA, element: STEM_INFO[reading.dayMasterA].element }
      : ((await dayMastersOf(supabase, [personId])).get(personId) ?? null);

  return (
    <article aria-labelledby="reading-subject" className="flex min-w-0 flex-col gap-8">
      <header className="flex flex-col gap-5">
        <BackToShelf className={`${BUTTON_TERTIARY} self-start`} />
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-secondary">
              사주풀이
              {dayMaster !== null && (
                <span className="rounded-full bg-surface py-0.5 pl-1 pr-2 ring-1 ring-border">
                  <SubjectTag subject={dayMaster} />
                </span>
              )}
            </p>
            {/* 넓은 화면에서는 옆 칸의 「만든 풀이」가 이 화면의 h1 이다 — 글의 이름은 그 아래 단이다 */}
            <h2 id="reading-subject" className={TYPE_TITLE}>
              {name}
            </h2>
          </div>

        </div>
      </header>

      <ReadingSection
        target={target}
        reading={reading}
        heading={readingTitle}
        layout="page"
        bare
        tones={[dayMaster?.element ?? null]}
      />
    </article>
  );
}
