import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { Halted } from '../halted';
import { ParticipationToggle, ProfileForm } from './manage';
import { PREFER_GENDERS, type DiscoveryProfileInput, type PreferGender } from './profile';

export const metadata = {
  title: '인연 찾기 설정 — 만세력',
  description: '인연 목록에 어떻게 서고, 무엇이 공개되는지 정합니다.',
};

/**
 * 인연 찾기 **설정** — 목록은 여기 없다.
 *
 * 추천 목록은 홈(`/me`)이 든다(ADR 0037). 목록이 스냅샷이 된 뒤로 그것을 읽는 값이
 * 싸졌고, 매번 보는 것을 매번 안 보는 것(별명·소개·조건) 아래에 둘 이유가 없어졌다.
 *
 * 여기 남는 것은 **내가 남에게 어떻게 보이는가**다. 그 판단은 한 번 정하면 오래 안
 * 건드리는 값이라 따로 선다.
 */
export default async function DiscoveryPage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const [{ data: account }, { data: profile }] = await Promise.all([
    supabase.from('app_user').select('status, self_person_id').maybeSingle(),
    supabase
      .from('discovery_profile')
      .select('nickname, intro, prefer_gender, opted_in_at')
      .maybeSingle(),
  ]);

  const optedIn = profile?.opted_in_at != null;

  return (
    <main className="app-shell flex w-full max-w-4xl flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="flex flex-col gap-1.5">
        <p className="eyebrow">인연</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em]">인연 찾기 설정</h1>
        <p className="max-w-2xl text-sm text-secondary">
          서로 부족한 오행을 보완할 수 있는 사람을 소개합니다. 여기서는 내가 어떻게
          보일지를 정하고, 소개받은 목록은 홈에서 봅니다.
        </p>
      </header>

      {account === null ? (
        <p className="text-sm text-muted">계정을 읽지 못했습니다. 다시 로그인해 주세요.</p>
      ) : account.status !== 'active' ? (
        <Halted status={account.status} />
      ) : account.self_person_id === null ? (
        <section className={`${CARD} bg-surface-sunken`}>
          <h2 className="text-base font-semibold">먼저 내 사주를 등록해 주세요</h2>
          <p className="mt-1.5 text-sm text-secondary">
            오행의 보완을 살펴보려면 먼저 내 사주가 필요합니다.{' '}
            <Link href="/me" className="text-accent underline underline-offset-2">
              내 사주 등록하기
            </Link>
          </p>
        </section>
      ) : (
        <>
          <ProfileForm current={profileInput(profile)} />

          {/*
            **켜기 전에 무엇이 나가는지부터 읽힌다.** 별명이 없으면 아직 켤 수 없지만,
            그렇다고 이 설명을 감추면 사용자는 무엇을 켜는 것인지 모른 채 별명부터 짓게 된다.
            버튼은 잠그고 이유를 옆에 적는다.
          */}
          <ParticipationToggle optedIn={optedIn} needsNickname={profile === null} />

          {/* 켠 사람에게만 목록으로 가는 길을 낸다 — 안 켠 사람에게는 아직 목록이 없다 */}
          {optedIn && (
            <Link
              href="/me"
              className="self-start text-sm font-semibold text-accent underline underline-offset-4"
            >
              소개받은 인연 보러 가기 <span aria-hidden="true">→</span>
            </Link>
          )}
        </>
      )}
    </main>
  );
}

function profileInput(
  profile: { nickname: string; intro: string | null; prefer_gender: string } | null,
): DiscoveryProfileInput {
  return {
    nickname: profile?.nickname ?? '',
    intro: profile?.intro ?? '',
    preferGender: (PREFER_GENDERS as readonly string[]).includes(profile?.prefer_gender ?? '')
      ? (profile?.prefer_gender as PreferGender)
      : 'any',
  };
}
