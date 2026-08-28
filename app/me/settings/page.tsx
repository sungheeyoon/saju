import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { Halted } from '../halted';
import { RequestDeletion } from '../leaving';

export const metadata = {
  title: '계정 관리 — 만세력',
  description: '로그인 정보와 계정 상태를 확인하고 계정을 관리합니다.',
};

export default async function SettingsPage() {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data: account } = await supabase.from('app_user').select('status').maybeSingle();

  const signOut = async () => {
    'use server';
    const client = await supabaseOnServer();
    await client.auth.signOut();
    redirect('/');
  };

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">설정</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">계정 관리</h1>
        <p className="mt-1 text-sm text-secondary">로그인과 계정에 관한 작업을 한곳에서 관리합니다.</p>
      </header>

      {account !== null && account.status !== 'active' && <Halted status={account.status} />}

      <section className={`${CARD} flex flex-col gap-4`}>
        <div>
          <h2 className="text-base font-bold">로그인 정보</h2>
          <p className="mt-1 text-sm text-secondary">{user.email}</p>
        </div>
        <form action={signOut} className="border-t border-border pt-4">
          <button
            type="submit"
            className="h-10 rounded-xl border border-border-strong px-4 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            로그아웃
          </button>
        </form>
      </section>

      {account?.status === 'active' && (
        <section className={`${CARD} flex flex-col gap-4`}>
          <div>
            <h2 className="text-base font-bold">계정 삭제</h2>
            <p className="mt-1 text-sm text-secondary">
              삭제 요청의 영향과 남는 자료를 확인한 뒤 요청할 수 있습니다.
            </p>
          </div>
          <RequestDeletion />
        </section>
      )}
    </main>
  );
}
