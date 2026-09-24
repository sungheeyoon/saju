import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { isBlocked, selfPersonIdOf } from '@/src/lib/account';

import { supabaseOnServer } from '../../../auth/server-client';
import { BUTTON_TERTIARY } from '../../../ui/buttons';
import { Icon } from '../../../ui/icon';
import { TYPE_TITLE } from '../../../ui/surfaces';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { ReadingSection } from '../../reading/section';
import { ReadingTabs } from '../../reading-tabs';
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
 * 탭으로 오간다. `self` 만 사람이 기억할 수 있는 이름이고 저장한 사람은 불투명 Person id 다.
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
  if (isBlocked(state)) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-14">
        <AccountNotice state={state} />
      </main>
    );
  }

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
  const chartHref = mine ? '/me' : `/me/people/${personId}`;
  const readingTitle = mine ? '내 사주풀이' : `${name}의 사주풀이`;
  /* 못 읽는 명식이면 표지가 회색이다 — 색을 지어 넣지 않는다 */
  const dayMaster = (await dayMastersOf(supabase, [personId])).get(personId) ?? null;

  return (
    <main className="app-shell flex flex-1 flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-5">
        <Link href="/me/readings" className={`${BUTTON_TERTIARY} self-start`}>
          <Icon name="back" className="size-4" />
          만든 풀이 목록
        </Link>
        {/*
          **왼쪽은 누구의 글인가, 오른쪽은 그 사람의 두 자리.** 넓은 화면에서 한 줄, 폰에서는 이름 아래에
          탭이 선다 — 탭은 글 위에 있어야 「사주로 돌아가기」가 8천 자 뒤로 밀리지 않는다.
        */}
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
            <h1 className={TYPE_TITLE}>{name}</h1>
          </div>
          <div className="w-full sm:w-auto sm:min-w-64">
            <ReadingTabs
              current="reading"
              chartHref={chartHref}
              readingHref={mine ? '/me/readings/self' : `/me/readings/${personId}`}
              label={name}
            />
          </div>
        </div>
      </header>

      <ReadingSection
        target={mine ? { kind: 'self' } : { kind: 'person', personId }}
        heading={readingTitle}
        layout="page"
        bare
        tones={[dayMaster?.element ?? null]}
      />
    </main>
  );
}
