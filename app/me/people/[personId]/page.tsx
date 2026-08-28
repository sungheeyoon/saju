import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { supabaseOnServer } from '../../../auth/server-client';
import { SajuResult } from '../../../saju-calculator';
import { UnreadableRevisionError } from '../../../revision';
import { Halted } from '../../halted';
import { payloadForViewer } from '../../payload';

export const metadata = {
  title: '사주 상세 보기 — 만세력',
  description: '저장한 사람의 명식과 운 흐름을 자세히 봅니다.',
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

  const { data: account } = await supabase.from('app_user').select('status').maybeSingle();
  if (account?.status !== 'active') {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-12">
        <Halted status={account?.status ?? 'suspended'} />
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
          <p className="rounded-2xl border border-border bg-surface p-5 text-sm">{error.message}</p>
        </main>
      );
    }
    throw error;
  }
  if (!person) notFound();

  return (
    <main className="app-shell flex flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="eyebrow">저장한 사람</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">{person.name}의 사주</h1>
          <p className="mt-1 text-sm text-secondary">명식과 운의 흐름을 자세히 확인하세요.</p>
        </div>
        <Link
          href="/me/people"
          className="rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
        >
          사람 목록으로
        </Link>
      </header>

      <SajuResult saju={person.saju} />
    </main>
  );
}
