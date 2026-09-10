import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { isBlocked, selfPersonIdOf } from '@/src/lib/account';

import { supabaseOnServer } from '../../../auth/server-client';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { ReadingSection } from '../../reading/section';
import { ReadingTabs } from '../../reading-tabs';

/** 풀이 생성은 응답 뒤에서 최대 240초 동안 돌 수 있다. */
export const maxDuration = 300;

export const metadata = {
  title: '사주풀이 — 만세력',
  description: '내 사주 또는 저장한 사람의 사주풀이를 읽습니다.',
};

/**
 * 한 사람의 사주풀이가 사는 **독립된 결과 화면.**
 *
 * `/me` 와 `/me/people/[id]` 는 명식을 보는 자리다. 이 화면에는 풀이만 두고 두 자리는
 * 탭으로 오간다. `self` 만 사람이 기억할 수 있는 이름이고 저장한 사람은 불투명 Person id 다.
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

  return (
    <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-14">
      <header className="flex flex-col gap-2">
        <Link
          href="/me/readings"
          className="self-start text-sm text-secondary underline underline-offset-2 hover:text-accent"
        >
          ← 만든 풀이 목록
        </Link>
        <p className="eyebrow">사주풀이</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{name}</h1>
        <p className="text-sm text-secondary">만들어 둔 사주풀이를 읽거나 새로 받습니다.</p>
      </header>

      <ReadingTabs
        current="reading"
        chartHref={chartHref}
        readingHref={mine ? '/me/readings/self' : `/me/readings/${personId}`}
        label={name}
      />

      <ReadingSection
        target={mine ? { kind: 'self' } : { kind: 'person', personId }}
        heading={readingTitle}
        layout="page"
      />
    </main>
  );
}
