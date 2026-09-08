import { redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';

import { supabaseOnServer } from '../../auth/server-client';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { ProfileForm } from './form';

export const metadata = {
  title: '프로필 — 만세력',
  description: '앱 안에서 불릴 이름과 프로필 사진을 정합니다.',
};

/**
 * 프로필 — **고치는 자리 하나** (PRD §5.1).
 *
 * 이름을 **짓는** 일은 여기 없다. 가입 폼이 코드·이름·안내 확인을 한 번에 적으므로
 * (`/signup`, ADR 0042), 이 화면에 닿는 사람은 이미 이름이 있다. 그래서 관문의 예외
 * 목록에서도 빠졌다 — 이름 없이 열려야 할 이유가 없어졌다.
 *
 * 여기 남는 것은 **셋을 고치는 일**이다: 닉네임 · 프로필 사진 · 소개. 뒤의 둘은 가입
 * 폼에 없으므로 실제로 채우는 자리도 여기다.
 */
export default async function ProfilePage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  // 정책이 자기 행만 내주므로 `where` 를 적지 않는다. 적으면 판정하는 자리가 둘이 된다.
  /** 온보딩을 안 묻는 화면이라 `self_person_id` 를 안 읽고, 대신 이름과 소개를 함께 읽는다 */
  const { state, row: account } = await readAccount<{
    status: string;
    nickname: string | null;
    intro: string | null;
  }>(supabase, 'status, nickname, intro');

  if (isBlocked(state) || account === null) {
    return (
      <main className="app-shell flex w-full flex-1 flex-col gap-7 py-9 sm:py-12">
        <AccountNotice state={state} />
      </main>
    );
  }

  /*
    **한 장인지 아닌지만 묻는다.** 바이트는 이 화면에 안 실린다 — 그림은 주소로 받아
    간다(`/me/photo/[userId]`).
  */
  const { data: photo } = await supabase.rpc('photo_of', { p_user_id: user.id });
  const hasPhoto = (photo ?? []).length > 0;

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="flex flex-col gap-1.5 border-b border-border pb-6">
        <p className="eyebrow">프로필</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em]">프로필</h1>
        <p className="max-w-xl text-sm text-secondary">
          앱에서 사용할 닉네임과 프로필을 관리합니다.
        </p>
      </header>

      <ProfileForm
        current={{ nickname: account.nickname ?? '', intro: account.intro ?? '' }}
        hasPhoto={hasPhoto}
        userId={user.id}
      />
    </main>
  );
}
