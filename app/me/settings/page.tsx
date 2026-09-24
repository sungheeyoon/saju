import Link from 'next/link';
import { redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';

import { supabaseOnServer } from '../../auth/server-client';
import { Icon } from '../../ui/icon';
import { TYPE_META, TYPE_TITLE } from '../../ui/surfaces';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { RequestDeletion } from '../leaving';
import { ConsentControls } from '../consent-controls';
import { SETTINGS_QUIET, SettingsCard, SettingsLinkRow, SettingsRow } from './card';
import { ParticipationToggle, PreferenceForm } from '../discovery/manage';
import { myDiscoveryProfile } from '../discovery/discovery-profile';
import { OPTIONAL_CONSENT_NOTE, asKoreanDay, noticeAckHolds } from '@/src/lib/consent';

export const metadata = {
  title: '계정 관리',
  description: '로그인 정보와 계정 상태를 확인하고 계정을 관리합니다.',
};

/**
 * 계정 관리 — **무리 지은 목록 하나** (5차, 부드러움).
 *
 * 위에서 아래로 「나 → 만남 → 동의 → 로그인 → 떠나기」 차례다. 자주 바꾸는 것이 위, 되돌리기
 * 어려운 것이 맨 아래다. 모양은 `card.tsx` 한 벌이 든다.
 */
export default async function SettingsPage() {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  /** 온보딩을 안 묻는 화면이라 `self_person_id` 를 안 읽고, 대신 동의 칸과 이름을 함께 읽는다 */
  const [{ state, row: account }, discoveryProfile] = await Promise.all([
    readAccount<{
      status: string;
      nickname: string | null;
      improvement_consent: boolean | null;
      contact_consent: boolean | null;
      notice_version: string | null;
      notice_ack_at: string | null;
    }>(
      supabase,
      'status, nickname, improvement_consent, contact_consent, notice_version, notice_ack_at',
    ),
    myDiscoveryProfile(),
  ]);

  const signOut = async () => {
    'use server';
    const client = await supabaseOnServer();
    await client.auth.signOut();
    redirect('/');
  };

  return (
    <main className="app-shell flex w-full max-w-2xl flex-1 flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className={TYPE_TITLE}>계정 관리</h1>
        <p className={TYPE_META}>로그인과 계정에 관한 작업을 한곳에서 관리합니다.</p>
      </header>

      {isBlocked(state) && <AccountNotice state={state} />}

      {/*
        **프로필은 여기서 고치지 않고 그 화면으로 간다.** 이름 · 사진 · 소개는 앱 전체에서 불리는
        값이라 제 화면(`/me/profile`)이 있다 — 설정 앱이 맨 위에 「나」를 한 줄로 세우는 것과 같다.
      */}
      {state.kind === 'active' && account !== null && (
        <SettingsCard title="프로필">
          <SettingsLinkRow
            href="/me/profile"
            leading={
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-cream text-cream-ink"
              >
                <Icon name="people" />
              </span>
            }
            label={account.nickname ?? '프로필'}
            help="닉네임 · 사진 · 소개"
          />
        </SettingsCard>
      )}

      {/* 못 읽었으면 두 칸을 비운다 — 기본값으로 메우면 끈 사람에게 「켜져 있다」고 말한다(ADR 0078) */}
      {state.kind === 'active' && discoveryProfile.ok && (
        <>
          <PreferenceForm current={discoveryProfile.value?.preferGender ?? 'any'} />
          <ParticipationToggle resting={discoveryProfile.value?.optedOut ?? false} />
        </>
      )}

      {state.kind === 'active' && account !== null && (
        <SettingsCard title="선택 동의" description={OPTIONAL_CONSENT_NOTE}>
          <ConsentControls
            improvement={account.improvement_consent === true}
            contact={account.contact_consent === true}
          />
          {/*
            **처리 안내도 이 무리의 한 줄이다.** 여기서 사용자가 찾는 것 셋(무엇을 켰나 · 무엇을
            껐나 · 무엇을 확인했나) 중 하나라, 위의 선택 항목 둘과 같은 줄 모양으로 선다.
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
