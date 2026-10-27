'use client';

import Link from 'next/link';

import { PHOTO_ADD } from '@/src/lib/account/copy';
import type { PhotoFocus } from '@/src/lib/profile';
import { STEM_INFO, type Stem } from '@/src/lib/saju';

import { BUTTON_SECONDARY_SMALL_FACE } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { StemSymbol } from '../../ui/stem-symbol';
import { Avatar } from '../avatar';
import { MyProfileEditFooter, PartnerSheet, usePartnerSheet } from '../partner-sheet';

/** 동그라미의 읽는 이름 — 누르면 「내 프로필」 시트가 열린다(카카오톡 친구 탭 맨 위 「내 프로필」) */
const MY_PROFILE_LABEL = '내 프로필';

/** 소개가 비었을 때의 줄 — 프로필 수정 화면 소개 칸의 자리표시와 같은 글자(`app/me/profile/form.tsx`) */
const INTRO_PLACEHOLDER = '간단한 소개를 입력해 주세요';

/**
 * **홈의 동그란 내 프로필** — 내 사주 카드 이름 왼쪽의 56px 원(2026-10-26 운영자).
 *
 * 누르면 아래에서 「내 프로필」 시트가 올라온다 — 다른 사람이 나를 볼 때와 같은 시트(`PartnerSheet`, 대화방 #833 · #834)로 이름 ·
 * 사진(넘김) · 「소개」(접지 않고 끝까지, 시트 안 스크롤)를 그대로 보인다. 사진 칸은 상대 시트와 같은 세로 4:5 한 칸이고 넓은 화면은 사진 왼쪽 · 소개 오른쪽의 두 열이다
 * (운영자 2026-10-27 — 전의 가로 4:3 · 넓은 화면 2:1 을 걷었다). 소개가 비었으면 그 자리의 줄이 바로 편집으로 가고, 맨 아래 「프로필 편집」이 프로필 수정 화면(`/me/profile`)이다
 * — 고칠 때만 넘어간다(아만다 「마이」의 「프로필 수정하기」 · 틴더의 연필). 사진 · 닉네임 · 소개 · 출생 정보를 그 화면 한 곳에서 고친다(카드의 연필은
 * 걷었다).
 *
 * 사진이 없으면 원 안에 내 일간의 천간 그림이 서고, 시트의 사진 칸은 같은 4:5 칸에 내 일간 색과 첫 글자, 그 위에 「사진 추가」다.
 */
export function SelfProfile({
  userId,
  nickname,
  intro,
  photoUrls,
  photoFocus,
  stem,
}: {
  userId: string;
  nickname: string;
  intro: string | null;
  photoUrls: readonly string[];
  photoFocus: readonly PhotoFocus[];
  stem: Stem;
}) {
  const control = usePartnerSheet();
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={MY_PROFILE_LABEL}
        onClick={control.open}
        className="shrink-0 rounded-full active:scale-95"
      >
        <Avatar
          userId={userId}
          nickname={nickname}
          hasPhoto={photoUrls.length > 0}
          focus={photoFocus[0]}
          size={56}
          faceClass="bg-surface text-[var(--ink)]"
          fallback={<StemSymbol stem={stem} className="size-8" />}
        />
      </button>
      <PartnerSheet
        control={control}
        partner={{ userId, nickname, intro, photoUrls, photoFocus, tone: STEM_INFO[stem].element }}
        toMatch={null}
        emptyPhoto={
          /* 빈 사진 칸 가운데 아래 「사진 추가」 — 프로필 화면 사진 판의 빈 칸과 같은 글자(`PHOTO_ADD`, 대장 47) */
          <Link
            href="/me/profile"
            className={`${BUTTON_SECONDARY_SMALL_FACE} absolute bottom-3 left-1/2 min-h-11 -translate-x-1/2 px-4`}
          >
            <Icon name="plus" className="size-4" />
            {PHOTO_ADD}
          </Link>
        }
        emptyIntro={
          /* 소개가 비었으면 그 자리에서 바로 편집으로 — 프로필 화면의 소개 칸과 같은 글자(`form.tsx` 의 자리표시) */
          <Link href="/me/profile" className="-mx-2 flex min-h-11 items-center justify-between gap-2 rounded-cell px-2 text-body text-muted hover:bg-surface-sunken">
            {INTRO_PLACEHOLDER}
            <Icon name="chevron" className="size-4 shrink-0" />
          </Link>
        }
        footer={
          /* 고칠 때만 프로필 수정 화면으로 — 폰은 시트 바닥에 붙은 판(대화방 「내 프로필」 시트와 같은 판) */
          <MyProfileEditFooter />
        }
      />
    </>
  );
}
