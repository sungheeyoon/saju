import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { isBlocked, selfPersonIdOf } from '@/src/lib/account';

import { supabaseOnServer } from '../../../auth/server-client';
import { SajuResult } from '../../../saju/view';
import { UnreadableRevisionError } from '@/src/lib/input/revision';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { payloadForViewer } from '../../payload';
import { ReadingTabs } from '../../reading-tabs';

export const metadata = {
  title: '사주 상세 보기 — 만세력',
  description: '저장된 한 사람의 명식과 운 흐름을 자세히 봅니다.',
};

export default async function PersonSajuPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  /**
   * **못 읽은 것을 중지로 말하지 않는다**(ADR 0048).
   *
   * 여기는 `account?.status !== 'active'` 로 물어서, 계정을 못 읽었을 때도 「중지된
   * 계정입니다」를 세우고 있었다. `app_user` 의 select 정책은 `id = auth.uid()` 하나이고
   * `status` 를 안 보므로 — 정지된 계정도 자기 행을 읽는다 — 그 말은 참일 수가 없었다.
   */
  const { state } = await readAccount(supabase);
  if (isBlocked(state)) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-12">
        <AccountNotice state={state} />
      </main>
    );
  }

  const { personId } = await params;
  let person;
  try {
    person = await payloadForViewer(personId);
  } catch (error) {
    if (error instanceof UnreadableRevisionError) {
      return (
        <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-12">
          <p className="rounded-[1.75rem] border border-border bg-surface p-5 text-sm">{error.message}</p>
        </main>
      );
    }
    throw error;
  }
  if (!person) notFound();

  /**
   * 내 명식이면 풀이 칸은 `/me` 의 것이다 — 두 자리에 세우면 글이 둘 선다.
   *
   * **주소에 적힌 글자가 아니라 `person.personId` 로 견준다.** uuid 비교는 대소문자를
   * 안 가려서 대문자로 적은 주소도 조회를 지나가는데, 문자열 비교는 가린다. 그 둘이
   * 갈리는 순간 이 값이 거짓이 되고 화면은 못 만드는 버튼을 세운다 — DB 는 거절하므로
   * 안전은 지켜지지만, 「못 만드는 버튼을 안 보여 준다」는 약속이 깨진다.
   */
  const mine = selfPersonIdOf(state) === person.personId;


  return (
    <main className="app-shell flex flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="eyebrow">{mine ? '내 명식' : '저장한 사람'}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">{person.name}의 사주</h1>
          <p className="mt-1 text-sm text-secondary">명식과 운의 흐름을 자세히 확인하세요.</p>
        </div>
        {/*
          **궁합은 여기서도 시작한다**(ADR 0036).

          저장한 사람을 보고 있는 사람이 「이 사람과 누구」를 떠올리는 자리는 바로
          여기다. 궁합의 첫 걸음(`/compat`)이 **첫 칸이 이 사람으로 채워진 채** 열린다 —
          주소의 `#a.person` 이 그 값이다.
        */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/compat#a.person=${person.personId}`}
            className="rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            {mine ? '나와 궁합 보기' : '이 사람과 궁합 보기'}
          </Link>
          <Link
            href={mine ? '/me' : '/me/people'}
            className="rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            {mine ? '내 사주로' : '사람 목록으로'}
          </Link>
        </div>
      </header>

      <ReadingTabs
        current="chart"
        chartHref={`/me/people/${person.personId}`}
        readingHref={mine ? '/me/readings/self' : `/me/readings/${person.personId}`}
        label={mine ? '내 사주' : person.name}
      />

      <SajuResult saju={person.saju} />
    </main>
  );
}
