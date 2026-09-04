import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { Halted } from '../halted';
import { ParticipationToggle, PreferenceForm } from './manage';
import { preferGenderOf } from './profile';

export const metadata = {
  title: '인연 찾기 설정 — 만세력',
  description: '인연 목록에 어떻게 서고, 무엇이 공개되는지 정합니다.',
};

/**
 * 인연 찾기 **설정** — 목록은 여기 없다.
 *
 * 추천 목록은 홈(`/me`)이 든다(ADR 0037). 목록이 스냅샷이 된 뒤로 그것을 읽는 값이
 * 싸졌고, 매번 보는 것을 매번 안 보는 것(조건) 아래에 둘 이유가 없어졌다.
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
    supabase.from('discovery_profile').select('prefer_gender, opted_out_at').maybeSingle(),
  ]);

  /**
   * **묻는 것은 「껐는가」다**(PRD §4.1).
   *
   * `opted_in_at` 을 보고 있었다. 참여가 기본으로 켜진 뒤로 그 칸이 비어 있다는 것은
   * 「참여하지 않는다」가 아니라 **「홈을 아직 안 열었다」**를 뜻할 수 있다 — 참여를 여는
   * 것은 홈이 요약을 넣는 자리이기 때문이다. 그 상태를 「참여 안 함」으로 그리면, 곧
   * 목록에 설 사람에게 「당신은 안 보입니다」라고 말하게 된다.
   *
   * 끈 사건은 그런 애매함이 없다. 사용자가 누른 것만 그 칸에 남는다.
   */
  const resting = profile?.opted_out_at != null;

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
          {/*
            **이름과 사진은 여기 없다.** 그 둘은 계정의 것이고 프로필 화면이 든다 —
            참여를 끄면 함께 거둬지는 값들과 한 행에 두면, 참여하지 않는 사람은 이름
            없는 사람이 된다(§5.2).
          */}
          <p className="text-sm text-secondary">
            닉네임·프로필 사진·소개는{' '}
            <Link href="/me/profile" className="text-accent underline underline-offset-2">
              프로필 화면
            </Link>
            에서 정합니다.
          </p>

          <PreferenceForm current={preferGenderOf(profile?.prefer_gender)} />

          {/* **끄기 직전에도 되돌리기 직전에도 무엇이 나가는지 읽힌다.** */}
          <ParticipationToggle resting={resting} />

          {/* 쉬는 사람에게는 목록이 없다 — 없는 자리로 가는 길을 내지 않는다 */}
          {!resting && (
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
