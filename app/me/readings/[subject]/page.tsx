import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { isBlocked, selfPersonIdOf } from '@/src/lib/account';
import { UnreadableRevisionError } from '@/src/lib/input/revision';

import { supabaseOnServer } from '../../../auth/server-client';
import { SajuResult } from '../../../saju/view';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { payloadForViewer } from '../../payload';
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
 * `/me` 와 `/me/people/[id]` 는 명식을 보는 자리다. 긴 풀이까지 그 아래에 붙이면
 * 사람 목록에서 풀이를 누르고도 명식 전체를 지나야 하므로, 풀이 목록 아래에 별도 주소를
 * 둔다. `self` 만 사람이 기억할 수 있는 이름이고 저장한 사람은 불투명 Person id 다.
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

  const personId = mine ? selfPersonId : subject;
  if (personId === null) notFound();

  let person;
  try {
    person = await payloadForViewer(personId);
  } catch (error) {
    if (error instanceof UnreadableRevisionError) {
      return (
        <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-14">
          <p className="rounded-[1.75rem] border border-border bg-surface p-5 text-sm">{error.message}</p>
        </main>
      );
    }
    throw error;
  }
  if (person === null) notFound();

  /* self Person id 를 직접 적은 옛 링크도 자기 풀이 한 자리로 모은다. */
  if (!mine && selfPersonId === person.personId) redirect('/me/readings/self');

  const chartHref = mine ? '/me' : `/me/people/${person.personId}`;
  const pageTitle = mine ? '내 사주' : person.name;
  const readingTitle = mine ? '내 사주풀이' : `${person.name}의 사주풀이`;

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
        <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{pageTitle}</h1>
        <p className="text-sm text-secondary">풀이를 먼저 읽고, 필요할 때 명식 근거를 펼쳐 보세요.</p>
      </header>

      <ReadingTabs
        current="reading"
        chartHref={chartHref}
        readingHref={mine ? '/me/readings/self' : `/me/readings/${person.personId}`}
        label={mine ? '내 사주' : person.name}
      />

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[1.75rem] border border-border bg-surface-sunken px-5 py-4 hover:border-accent sm:px-6 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="text-base font-semibold">명식 자세히 보기</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted">
              {person.name}님의 여덟 글자와 오행, 운의 흐름을 확인합니다.
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-sm text-secondary">
            <span className="group-open:hidden">펼치기</span>
            <span className="hidden group-open:inline">접기</span>
          </span>
        </summary>
        <div className="mt-6">
          <SajuResult saju={person.saju} />
        </div>
      </details>

      <ReadingSection
        target={mine ? { kind: 'self' } : { kind: 'person', personId: person.personId }}
        heading={readingTitle}
        layout="page"
      />
    </main>
  );
}
