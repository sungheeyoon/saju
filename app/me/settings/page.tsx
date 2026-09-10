import Link from 'next/link';
import { redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { RequestDeletion } from '../leaving';
import { ConsentControls } from '../consent-controls';
import { ParticipationToggle, PreferenceForm } from '../discovery/manage';
import { preferGenderOf } from '../discovery/profile';
import { NOTICE_VERSION, OPTIONAL_CONSENT_NOTE, asKoreanDay } from '@/src/lib/consent';

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

  /** 온보딩을 안 묻는 화면이라 `self_person_id` 를 안 읽고, 대신 동의 칸을 함께 읽는다 */
  const [{ state, row: account }, { data: discoveryProfile }] = await Promise.all([
    readAccount<{
      status: string;
      improvement_consent: boolean | null;
      contact_consent: boolean | null;
      notice_version: string | null;
      notice_ack_at: string | null;
    }>(supabase, 'status, improvement_consent, contact_consent, notice_version, notice_ack_at'),
    supabase.from('discovery_profile').select('prefer_gender, opted_out_at').maybeSingle(),
  ]);

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

      {isBlocked(state) && <AccountNotice state={state} />}

      {state.kind === 'active' && (
        <>
          <PreferenceForm current={preferGenderOf(discoveryProfile?.prefer_gender)} />
          <ParticipationToggle resting={discoveryProfile?.opted_out_at != null} />
        </>
      )}

      {state.kind === 'active' && account !== null && (
        <section className={`${CARD} flex flex-col gap-4`}>
          <div>
            <h2 className="text-base font-bold">선택 동의</h2>
            <p className="mt-1 text-sm text-secondary">{OPTIONAL_CONSENT_NOTE}</p>
          </div>
          <ConsentControls
            improvement={account.improvement_consent === true}
            contact={account.contact_consent === true}
          />
          <p className="border-t border-border pt-4 text-xs leading-5 text-muted">
            {account.notice_ack_at === null
              ? '아직 처리 안내를 확인하지 않으셨습니다.'
              : `${asKoreanDay(account.notice_ack_at.slice(0, 10))}에 처리 안내를 확인하셨습니다.`}{' '}
            {account.notice_version !== NOTICE_VERSION && '안내가 새로 바뀌어 다시 보여 드립니다.'}{' '}
            <Link href="/privacy" className="font-semibold text-accent underline underline-offset-4">
              처리방침 보기
            </Link>
          </p>
        </section>
      )}

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

      {state.kind === 'active' && (
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
