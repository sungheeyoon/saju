'use client';

import Link from 'next/link';

import { MY_PROFILE_EDIT_LABEL } from '@/src/lib/chat/copy';
import type { PhotoFocus } from '@/src/lib/profile';
import { STEM_INFO, type Stem } from '@/src/lib/saju';

import { BUTTON_SECONDARY_SMALL_FACE } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { StemSymbol } from '../../ui/stem-symbol';
import { Avatar } from '../avatar';
import { PartnerSheet, usePartnerSheet } from '../partner-sheet';

/** 동그라미의 읽는 이름 — 누르면 「내 프로필」 시트가 열린다(카카오톡 친구 탭 맨 위 「내 프로필」) */
const MY_PROFILE_LABEL = '내 프로필';

/**
 * **홈의 동그란 내 프로필** — 내 사주 카드 이름 왼쪽의 56px 원(2026-10-26 운영자).
 *
 * 누르면 아래에서 「내 프로필」 시트가 올라온다 — 카카오톡에서 내 프로필을 누르면 크게 보이고 그 안의 「프로필 편집」으로 가는 것과
 * 같은 걸음이다. 시트는 대화방의 「내 프로필」(#834)과 같은 한 벌(`PartnerSheet`)이고, 궁합 단추 자리에 「프로필 편집」이 선다 —
 * 그 단추가 프로필 수정 화면(`/me/profile`)으로 간다. 사진 · 닉네임 · 소개 · 출생 정보를 그 화면 한 곳에서 고친다(카드의 연필은
 * 걷었다).
 *
 * 사진이 없으면 원 안에 내 일간의 천간 그림이 서고, 시트의 사진 칸은 내 일간 색 띠에 첫 글자다.
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
        toMatch={
          /* 대화방 「내 프로필」 시트와 같은 단추 — 사진 아래 폭을 다 쓰는 한 줄 */
          <Link href="/me/profile" className={`${BUTTON_SECONDARY_SMALL_FACE} min-h-12 w-full px-4`}>
            <Icon name="pencil" className="size-4" />
            {MY_PROFILE_EDIT_LABEL}
          </Link>
        }
      />
    </>
  );
}
