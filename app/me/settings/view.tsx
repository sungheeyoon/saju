import type { ReactNode } from 'react';

import type { AccountState } from '@/src/lib/account';
import { isBlocked } from '@/src/lib/account';
import { OPTIONAL_CONSENT_NOTE, asKoreanDay, noticeAckHolds } from '@/src/lib/consent';
import type { DiscoveryProfile } from '@/src/lib/discovery';
import { initialOf } from '@/src/lib/profile';

import type { SkippableRead } from '../../db-error';
import { FailureLine } from '../../ui/failure-line';
import { COLUMN, TYPE_TITLE } from '../../ui/surfaces';
import { AccountNotice } from '../account-notice';
import { Avatar } from '../avatar';
import { ConsentControls } from '../consent-controls';
import { ParticipationToggle, PreferenceForm } from '../discovery/manage';
import { RequestDeletion } from '../leaving';
import { SETTINGS_GROUP, SETTINGS_TEXT_WRAP, SettingsGroup, SettingsLinkRow } from './card';
import { PushRow } from './push-row';
import { SignOutRow } from './sign-out-row';

/** 화면이 그리는 데 쓰는 값 — 읽기는 `page.tsx` 가 한다(화면은 그리기만, `docs/architecture.md`) */
export type SettingsData = {
  state: AccountState;
  account: {
    nickname: string | null;
    improvement_consent: boolean | null;
    contact_consent: boolean | null;
    notice_version: string | null;
    notice_ack_at: string | null;
  } | null;
  discoveryProfile: SkippableRead<DiscoveryProfile | null>;
  /** 사진이 한 장도 없다고 **읽었을 때만** 참 — 못 읽었으면 거짓(ADR 0078) */
  photoless: boolean;
  email: string | undefined;
  userId: string;
  /** 푸시 공개 열쇠가 있는 배포인가(G-71) */
  pushAvailable: boolean;
};

/**
 * 설정 화면의 그림 — **회색 바탕 위에 흰 무리가 쌓인 설정 목록 하나**(2026-10-26, #838 운영자 피드백 · 규칙은 `card.tsx` 머리).
 *
 * 위에서 아래로 「나 → 인연 → 알림 → 동의 → 계정 → 탈퇴하기」 차례다. 자주 바꾸는 것이 위, 되돌리기 어려운 것이 맨 아래다.
 *
 * **맨 위는 내 프로필이다** — 카카오톡 · 당근 설정의 맨 위처럼 동그란 사진(없으면 이름 첫 글자)과 굵은 이름, 그 아래 로그인 이메일.
 * 줄 전체가 프로필 화면(`/me/profile`)으로 가고 오른쪽은 「›」 하나다 — 「사진 추가」 글자는 걷었다(운영자 2026-10-26). 이름 · 사진 · 소개는 앱 전체에서 불리는 값이라 제 화면이 있다.
 */
export function SettingsView({ data }: { data: SettingsData }): ReactNode {
  const { state, account, discoveryProfile, photoless, email, userId, pushAvailable } = data;
  const active = state.kind === 'active';
  return (
    /* 화면 바탕이 가라앉은 면이고 무리 사이의 틈이 곧 회색 띠다(TDS `Border` 의 `height16`) — 폰에서는 무리가 화면 끝까지 간다 */
    <main className={`flex w-full flex-1 flex-col bg-surface-sunken ${SETTINGS_TEXT_WRAP}`}>
      {/* 넓은 화면(lg)에서는 다른 좁은 단 화면과 같은 기둥(46rem)의 왼쪽 끝에 제목과 무리가 선다(ADR 0161 추기) — 1280 에서 x=272 */}
      <div className={`mx-auto flex w-full ${COLUMN} flex-col gap-4 pb-10 pt-8 sm:px-5 sm:pb-14 sm:pt-12 lg:px-0`}>
        <h1 className={`${TYPE_TITLE} px-6 lg:px-0`}>설정</h1>

        {isBlocked(state) && (
          <div className="px-4 sm:px-0">
            <AccountNotice state={state} />
          </div>
        )}

        {active && account !== null && (
          <section className={SETTINGS_GROUP} aria-label="내 프로필">
            <SettingsLinkRow
              href="/me/profile"
              big
              leading={
                photoless ? (
                  /*
                    사진이 없을 때의 기본 얼굴 — 흰 줄 위에서 또렷하게 짙은 크림 면 위의 이름 첫 글자(카카오톡 · 당근의 기본 프로필이
                    흰 바탕에서 회색 동그라미로 서는 것과 같은 자리). 사진 칸과 같은 56px 이다.
                  */
                  <span
                    aria-hidden="true"
                    className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-soft text-heading font-bold text-cream-ink"
                  >
                    {initialOf(account.nickname ?? '')}
                  </span>
                ) : (
                  <Avatar userId={userId} nickname={account.nickname ?? ''} hasPhoto size={56} />
                )
              }
              label={account.nickname ?? '내 프로필'}
              help={email}
            />
          </section>
        )}

        {/*
          못 읽었으면 두 줄 대신 실패 줄 하나가 선다 — 기본값으로 메우면 끈 사람에게 「켜져 있다」고 말하고(ADR 0078), 말없이 비우면
          그 설정이 있는 줄도 모른다(ADR 0164 덧).
        */}
        {active && (
          <SettingsGroup title="인연">
            {discoveryProfile.ok ? (
              <>
                <ParticipationToggle resting={discoveryProfile.value?.optedOut ?? false} />
                <PreferenceForm current={discoveryProfile.value?.preferGender ?? 'any'} />
              </>
            ) : (
              <FailureLine retry className="px-6 py-3">
                인연 찾기 설정을 불러오지 못했어요. {discoveryProfile.reason}
              </FailureLine>
            )}
          </SettingsGroup>
        )}

        {/*
          이 기기의 새 메시지 알림 — 상태는 브라우저만 알아 줄이 스스로 잰다(ADR 0156). **공개 열쇠가 없는 배포에는 안 세운다** —
          운영에 열쇠를 넣기 전(G-71)에 세우면 모든 사람에게 「이 브라우저에서는 알림을 받을 수 없어요」라는 거짓을 말한다.
        */}
        {active && pushAvailable && <PushRow />}

        {active && account !== null && (
          <SettingsGroup title="선택 동의" description={OPTIONAL_CONSENT_NOTE}>
            <ConsentControls
              improvement={account.improvement_consent === true}
              contact={account.contact_consent === true}
            />
            {/* 처리 안내도 이 무리의 한 줄이다 — 무엇을 켰나 · 껐나 · 확인했나 셋이 한 무리다 */}
            <SettingsLinkRow
              href="/privacy"
              label="개인정보 처리 안내"
              help={
                account.notice_ack_at === null
                  ? '아직 확인하지 않았어요.'
                  : `${asKoreanDay(account.notice_ack_at.slice(0, 10))}에 확인했어요.`
              }
              note={!noticeAckHolds(account.notice_version) ? '안내가 바뀌어 다시 보여 드려요.' : undefined}
            />
          </SettingsGroup>
        )}

        {/* 로그아웃은 「계정」 무리의 한 줄, 탈퇴하기는 그 아래 무리 밖 작은 글자(토스 · 당근 설정의 맨 아래) */}
        <SettingsGroup title="계정">
          {!active && email !== undefined && (
            <p className="px-6 py-3 text-small leading-5 text-secondary">{email}</p>
          )}
          <SignOutRow />
        </SettingsGroup>

        {active && <RequestDeletion />}
      </div>
    </main>
  );
}
