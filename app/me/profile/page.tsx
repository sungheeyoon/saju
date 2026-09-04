import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../../auth/server-client';
import { Halted } from '../halted';
import { ProfileForm } from './form';

export const metadata = {
  title: '프로필 — 만세력',
  description: '앱 안에서 불릴 이름과 프로필 사진을 정합니다.',
};

/**
 * 프로필 — **가입할 때 짓고, 언제든 고친다**(PRD §5.1).
 *
 * 한 주소가 두 자리를 든다. 이름이 없으면 짓는 자리이고, 있으면 고치는 자리다. 갈라
 * 두면 「고치기」 주소가 이름 없는 사람에게 열려 관문이 하나 새는 자리가 된다.
 *
 * ## 관문은 `/me` 레이아웃이 든다
 *
 * 여기는 이름이 없어도 열려야 하는 자리라, 이 화면만 관문의 예외다. 그 판단도 레이아웃
 * 한 곳에 있다 — 화면마다 「나는 예외다」를 적으면 언젠가 하나가 안 고쳐진다.
 */
export default async function ProfilePage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  // 정책이 자기 행만 내주므로 `where` 를 적지 않는다. 적으면 판정하는 자리가 둘이 된다.
  const { data: account } = await supabase
    .from('app_user')
    .select('status, nickname, intro')
    .maybeSingle();

  if (account === null) {
    return (
      <main className="app-shell flex w-full flex-1 flex-col gap-7 py-9 sm:py-12">
        <p className="text-sm text-muted">계정을 읽지 못했습니다. 다시 로그인해 주세요.</p>
      </main>
    );
  }

  if (account.status !== 'active') {
    return (
      <main className="app-shell flex w-full flex-1 flex-col gap-7 py-9 sm:py-12">
        <Halted status={account.status} />
      </main>
    );
  }

  /*
    **한 장인지 아닌지만 묻는다.** 바이트는 이 화면에 안 실린다 — 그림은 주소로 받아
    간다(`/me/photo/[userId]`).
  */
  const { data: photo } = await supabase.rpc('photo_of', { p_user_id: user.id });
  const hasPhoto = (photo ?? []).length > 0;

  const naming = account.nickname === null;

  return (
    <main className="app-shell flex w-full max-w-2xl flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="flex flex-col gap-1.5 border-b border-border pb-6">
        <p className="eyebrow">프로필</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em]">
          {naming ? '어떻게 불러 드릴까요' : '프로필'}
        </h1>
        <p className="max-w-xl text-sm text-secondary">
          {naming
            ? '앱 안에서 쓰실 닉네임을 정해 주세요. 사진과 소개는 나중에 채우셔도 됩니다.'
            : '앱 안의 모든 자리에서 이 이름으로 불립니다. 언제든 고치실 수 있습니다.'}
        </p>
      </header>

      <ProfileForm
        current={{ nickname: account.nickname ?? '', intro: account.intro ?? '' }}
        hasPhoto={hasPhoto}
        userId={user.id}
        naming={naming}
      />
    </main>
  );
}
