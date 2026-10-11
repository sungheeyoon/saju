'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';

import type { PhotoFocus } from '@/src/lib/profile';
import type { Element } from '@/src/lib/saju';

import { Avatar } from './avatar';
import { CardPhotos } from './matching/card-photos';
import { Letter } from './matching/letter';
import { closeSheet, DetailSheet, openSheet } from './matching/today-card';

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

/**
 * 시트를 여는 손잡이 — 여는 쪽(머리 · 말풍선 · 얼굴)이 `open` 을 부른다. **「⋯」는 열려 있는 동안만 선다** — 닫힌 시트 안에
 * 같은 「신고 · 차단」이 하나 더 서 있으면 문서에 그 단추가 둘이 되어, 머리의 「⋯」를 찾는 자리가 어느 것인지 갈리지 않는다.
 */
export function usePartnerSheet() {
  const sheet = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(false);
  const open = useCallback(() => {
    setShown(true);
    openSheet(sheet.current);
  }, []);
  /** 시트 안의 단추가 다른 칸으로 넘길 때 — X · Esc 와 같은 닫힘 몸짓으로 닫는다 */
  const close = useCallback(() => closeSheet(sheet.current), []);
  const closed = useCallback(() => setShown(false), []);
  return { sheet, shown, open, close, closed };
}

export type PartnerSheetControl = ReturnType<typeof usePartnerSheet>;

/** 시트 · 머리 단추의 보조기기 이름 — 오늘의 인연 · 지나친 인연 시트와 같은 이름이다(문구 대장 43) */
export const partnerSheetName = (nickname: string): string => `${nickname} 님 자세히`;

/**
 * **상대 프로필 시트** — 대화방 머리 · 말풍선 곁 사진과 인연 궁합 머리의 사진이 연다(운영자 결정 2026-10-11, ADR 0155 덧).
 *
 * 별도 화면이 아니라 시트다 — 방의 스크롤 자리 · 더 불러 둔 이전 말 · 쓰던 글이 그대로 남는다. 모양은 오늘의 인연 ⓘ 시트
 * (`DetailSheet`) 한 벌이라 폰은 아래에서 올라오고 넓은 화면(lg)은 가운데 대화상자다. 위에서부터 사진 넘기기(오늘의 인연
 * 카드와 같은 판 `CardPhotos` — 반 탭 · 막대 · 가로 쓸기 · 넓은 화면의 화살표) → 이름 → 소개 전문 → 궁합 단추이고,
 * 머리에 「⋯」(신고 · 차단, 부르는 쪽이 준다)와 닫기가 선다. 사진이 없으면 사진 칸 대신 첫 글자 동그라미 하나, 소개가 없으면
 * 그 줄을 뺀다. 궁합 단추는 부르는 쪽이 준다 — 대화방은 머리의 것과 같은 상태 · 같은 모양의 단추를 넘기고(`CompatChip`), 인연
 * 궁합 화면 자신이 연 시트는 `null` 이라 안 선다.
 */
export function PartnerSheet({
  control,
  partner,
  toMatch,
  menu,
}: {
  control: PartnerSheetControl;
  partner: PartnerProfile;
  /** 인연 궁합으로 가는 단추 — 없으면 `null` */
  toMatch: ReactNode | null;
  menu?: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const intro = partner.intro !== null && partner.intro.trim() !== '' ? partner.intro : null;
  return (
    <DetailSheet
      sheet={control.sheet}
      nickname={partner.nickname}
      label={partnerSheetName(partner.nickname)}
      menu={control.shown ? menu : null}
      onClose={control.closed}
      nameInBody
    >
      <div data-partner-sheet="" className="flex flex-col gap-4">
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
        {toMatch}
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
  const control = usePartnerSheet();
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={partnerSheetName(partner.nickname)}
        onClick={control.open}
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
      <PartnerSheet control={control} partner={partner} toMatch={null} menu={menu} />
    </>
  );
}
