'use client';

import Link from 'next/link';
import { useRef, type ReactNode, type RefObject } from 'react';

import type { PhotoFocus } from '@/src/lib/profile';
import type { Element } from '@/src/lib/saju';

import { BUTTON_SECONDARY } from '../ui/buttons';
import { Icon } from '../ui/icons';
import { Avatar } from './avatar';
import { CardPhotos } from './matching/card-photos';
import { Letter } from './matching/letter';
import { DetailSheet, openSheet } from './matching/today-card';

/**
 * 매칭된 상대 한 사람 — **지금의** 사진 · 소개다(동의 당시의 것이 아니다). 서버가 이미 열린 문에서 지어 넘긴다 —
 * 사진 주소는 대화방 · 인연 궁합의 읽는 문이 낸 초점의 수만큼(`photoUrlsOf`), 소개는 `my_match_scope` 의 한 칸.
 */
export type PartnerProfile = {
  readonly userId: string;
  readonly nickname: string;
  readonly intro: string | null;
  /** 대표가 먼저 — 없으면 빈 목록이고, 사진 칸 대신 첫 글자 동그라미가 선다 */
  readonly photoUrls: readonly string[];
  /** 장마다 보일 자리 — `photoUrls` 와 같은 차례 · 같은 수(G-98) */
  readonly photoFocus: readonly PhotoFocus[];
  /** 그 사람의 일간 오행 — 사진이 없을 때 동그라미의 색. 모르면 `null`(회색) */
  readonly tone: Element | null;
};

/** 시트 · 머리 단추의 보조기기 이름 — 오늘의 인연 · 지나친 인연 시트와 같은 이름이다(문구 대장 43) */
export const partnerSheetName = (nickname: string): string => `${nickname} 님 자세히`;

/**
 * **상대 프로필 시트** — 대화방 머리 · 말풍선 곁 사진과 인연 궁합 머리의 사진이 연다(운영자 결정 2026-10-11, ADR 0155 덧).
 *
 * 별도 화면이 아니라 시트다 — 방의 스크롤 자리 · 더 불러 둔 이전 말 · 쓰던 글이 그대로 남는다. 모양은 오늘의 인연 ⓘ 시트
 * (`DetailSheet`) 한 벌이라 폰은 아래에서 올라오고 넓은 화면(lg)은 가운데 대화상자다. 위에서부터 사진 넘기기(오늘의 인연
 * 카드와 같은 판 `CardPhotos` — 반 탭 · 막대 · 가로 쓸기 · 넓은 화면의 화살표) → 이름 → 소개 전문 → 「인연 궁합」이고,
 * 머리에 「⋯」(신고 · 차단, 부르는 쪽이 준다)와 닫기가 선다. 사진이 없으면 사진 칸 대신 첫 글자 동그라미 하나, 소개가 없으면
 * 그 줄을 뺀다. `toMatch` 가 없으면(인연 궁합 화면 자신이 연 시트) 「인연 궁합」 단추가 안 선다.
 */
export function PartnerSheet({
  sheet,
  partner,
  toMatch,
  menu,
}: {
  sheet: RefObject<HTMLDialogElement | null>;
  partner: PartnerProfile;
  toMatch: string | null;
  menu?: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const intro = partner.intro !== null && partner.intro.trim() !== '' ? partner.intro : null;
  return (
    <DetailSheet sheet={sheet} nickname={partner.nickname} label={partnerSheetName(partner.nickname)} menu={menu} nameInBody>
      <div className="flex flex-col gap-4">
        {partner.photoUrls.length > 0 ? (
          <div
            ref={frame}
            className="relative mx-auto aspect-[4/5] w-full max-w-[24rem] select-none overflow-hidden rounded-[1.75rem] bg-surface-sunken"
          >
            <CardPhotos
              card={{
                candidateUserId: partner.userId,
                nickname: partner.nickname,
                hasPhoto: true,
                photoUrls: partner.photoUrls,
                photoFocus: partner.photoFocus,
                avatarElement: partner.tone,
              }}
              bounce={frame}
            />
          </div>
        ) : (
          <span className="self-center">
            <Avatar userId={partner.userId} nickname={partner.nickname} hasPhoto={false} size={128} tone={partner.tone} />
          </span>
        )}
        {/* 이름은 머리의 제목(보조기기)이 이미 읽는다 — 여기는 보이기만 한다 */}
        <p aria-hidden="true" className="break-keep text-center font-rounded text-[1.5rem] leading-8 text-foreground">
          {partner.nickname}
        </p>
        {intro !== null && <Letter nickname={partner.nickname} intro={intro} />}
        {toMatch !== null && (
          <Link href={toMatch} className={`${BUTTON_SECONDARY} w-full`}>
            <Icon name="heart" className="size-5 text-danger" />
            인연 궁합
          </Link>
        )}
      </div>
    </DetailSheet>
  );
}

/**
 * 상대의 얼굴 하나 — 누르면 상대 프로필 시트가 열린다. 인연 궁합 머리가 쓴다(대화방은 머리 · 말풍선의 여러 자리가 한 시트를
 * 열어 `PartnerSheet` 를 직접 든다).
 */
export function PartnerFace({
  partner,
  size,
  menu,
}: {
  partner: PartnerProfile;
  size: number;
  menu?: ReactNode;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={partnerSheetName(partner.nickname)}
        onClick={() => openSheet(sheet.current)}
        className="shrink-0 rounded-full active:scale-95"
      >
        <Avatar
          userId={partner.userId}
          nickname={partner.nickname}
          hasPhoto={partner.photoUrls.length > 0}
          focus={partner.photoFocus[0]}
          size={size}
        />
      </button>
      <PartnerSheet sheet={sheet} partner={partner} toMatch={null} menu={menu} />
    </>
  );
}
