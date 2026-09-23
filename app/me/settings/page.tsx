import Link from 'next/link';
import { redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';

import { supabaseOnServer } from '../../auth/server-client';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { RequestDeletion } from '../leaving';
import { ConsentControls } from '../consent-controls';
import { SETTINGS_QUIET, SettingsCard, SettingsRow } from './card';
import { ParticipationToggle, PreferenceForm } from '../discovery/manage';
import { preferGenderOf } from '../discovery/profile';
import { OPTIONAL_CONSENT_NOTE, asKoreanDay, noticeAckHolds } from '@/src/lib/consent';

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
    // eslint-disable-next-line no-restricted-syntax -- 옛 자리(ADR 0085): 문으로 옮기면 지운다
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
        <SettingsCard title="선택 동의" description={OPTIONAL_CONSENT_NOTE}>
          <ConsentControls
            improvement={account.improvement_consent === true}
            contact={account.contact_consent === true}
          />
          {/*
            **처리 안내도 이 카드의 한 줄이다.** 작은 글자 한 줄로 카드 밑단에 깔려
            있었는데, 여기서 사용자가 찾는 것 셋(무엇을 켰나 · 무엇을 껐나 · 무엇을
            확인했나) 중 하나다. 위의 선택 항목 둘과 같은 줄 모양으로 선다.
          */}
          <SettingsRow
            label="개인정보 처리 안내"
            help={
              account.notice_ack_at === null
                ? '아직 처리 안내를 확인하지 않았습니다.'
                : `${asKoreanDay(account.notice_ack_at.slice(0, 10))} 처리 안내를 확인했습니다.`
            }
            note={
              !noticeAckHolds(account.notice_version)
                ? '안내가 새로 바뀌어 다시 보여 드립니다.'
                : undefined
            }
          >
            <Link href="/privacy" className={SETTINGS_QUIET}>
              처리방침 보기
            </Link>
          </SettingsRow>
        </SettingsCard>
      )}

      <SettingsCard title="로그인 정보">
        <SettingsRow help={user.email}>
          <form action={signOut}>
            <button type="submit" className={SETTINGS_QUIET}>
              로그아웃
            </button>
          </form>
        </SettingsRow>
      </SettingsCard>

      {state.kind === 'active' && (
        <SettingsCard title="탈퇴">
          <RequestDeletion />
        </SettingsCard>
      )}
    </main>
  );
}
