'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';

import type { PhotoFocus } from '@/src/lib/profile';
import type { Element } from '@/src/lib/saju';

import { Avatar } from './avatar';
import { CandidatePhoto } from './matching/candidate-photo';
import { CardPhotos } from './matching/card-photos';
import { closeSheet, DetailSheet, openSheet } from '../ui/sheet';
import { TYPE_META } from '../ui/surfaces';

/**
 * 매칭된 상대 한 사람 — **지금의** 사진 · 소개다(동의 당시의 것이 아니다). 서버가 이미 열린 문에서 지어 넘긴다 —
 * 사진 주소는 대화방 · 인연 궁합의 읽는 문이 낸 초점의 수만큼(`photoUrlsOf`), 소개는 `my_match_scope` 의 한 칸.
 */
export type PartnerProfile = {
  readonly userId: string;
  readonly nickname: string;
  readonly intro: string | null;
  /** 대표가 먼저 — 없으면 빈 목록이고, 같은 4:5 사진 칸에 첫 글자가 선다 */
  readonly photoUrls: readonly string[];
  /** 장마다 보일 자리 — `photoUrls` 와 같은 차례 · 같은 수(G-98) */
  readonly photoFocus: readonly PhotoFocus[];
  /** 그 사람의 일간 오행 — 사진이 없을 때 사진 칸의 색. 모르면 `null`(회색) */
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

/** 소개 구역의 이름 — 프로필 화면의 같은 칸 이름(「소개 (선택)」, `app/me/profile/form.tsx`)과 한 낱말이다 */
const INTRO_HEADING = '소개';

/**
 * **사진 칸 한 벌 — 세로 4:5, 사진이 있든 없든 · 폰이든 넓은 화면이든 · 내 시트든 상대 시트든 같은 칸이다**(운영자 2026-10-27 「데스크톱에서도
 * 비율 맞춰줘야지」 · 「사진 없을 때도 비율 똑같이」) — 오늘의 인연 카드의 넓은 화면(4:5)과 같은 세로 사진이다. **높이 때문에 비율을 깨지 않는다 — 폭을 줄인다**: 폰은 시트 폭을
 * 다 쓰되 높이가 화면의 56%(폭 44.8dvh)를 넘으면 폭을 줄이고(낮은 폰에서도 사진 아래 단추가 첫 화면에 걸린다), 넓은 화면(lg)은 왼쪽 열
 * 18rem 한 칸에 같은 높이 문턱을 둔다. 전에는 내 시트가 가로 4:3 · 넓은 화면 2:1, 사진 없는 상대가 높이 128px 띠였다.
 */
const PROFILE_PHOTO_FRAME =
  'relative mx-auto aspect-[4/5] w-full max-w-[min(100%,44.8dvh)] shrink-0 select-none overflow-hidden rounded-card lg:max-w-[min(100%,18rem,44.8dvh)]';

/**
 * **상대 프로필 시트** — 대화방 머리 · 말풍선 곁 사진과 인연 궁합 머리 · 요청 카드의 얼굴이 연다(운영자 결정 2026-10-11, ADR 0155 덧).
 *
 * 별도 화면이 아니라 시트다 — 방의 스크롤 자리 · 더 불러 둔 이전 말 · 쓰던 글이 그대로 남는다. 판은 오늘의 인연 ⓘ · 지나친 인연
 * 시트(`DetailSheet`)와 같은 한 벌이라 **이름이 머리에 선다** — 시트를 내려 읽는 동안에도 누구인지가 남고, 그 줄 끝에 「⋯」(신고 ·
 * 차단, 부르는 쪽이 준다)와 닫기가 선다(힌지 · 대화방 머리와 같은 줄). 폰은 아래에서 올라오고 넓은 화면(lg)은 가운데 대화상자다.
 *
 * 몸은 위에서부터 **사진(세로 4:5) → 궁합 단추(폭을 다 쓰는 한 줄) → 소개**다(스카이피플 · 아만다의 상세 — 사진 바로 아래 주 행동,
 * 그 아래 구역). 넓은 화면은 사진이 왼쪽 열, 궁합 · 소개가 오른쪽 열이다. 사진 넘기기는 오늘의 인연 카드와 같은 판(`CardPhotos` —
 * 반 탭 · 막대 · 가로 쓸기 · 넓은 화면의 화살표). 사진이 없으면 **같은 4:5 칸**에 그 사람의 색 판과 첫 글자(덱 카드와 같은 모양)가 선다.
 * 홈 · 대화방의 「내 프로필」도 이 시트 그대로다 — 칸 · 열이 상대 시트와 같다(`PROFILE_PHOTO_FRAME`).
 * 소개가 없으면 그 구역을 뺀다. 궁합 단추는 부르는 쪽이 준다 — 대화방은 머리의 것과 같은 상태 · 같은 모양의 단추를 넘기고
 * (`CompatChip` 의 `fill`), 인연 궁합 화면 · 요청 카드가 연 시트는 `null` 이라 안 선다.
 */
export function PartnerSheet({
  control,
  partner,
  toMatch,
  menu,
  emptyIntro,
  emptyPhoto,
  footer,
}: {
  control: PartnerSheetControl;
  partner: PartnerProfile;
  /** 인연 궁합으로 가는 단추 — 없으면 `null` */
  toMatch: ReactNode | null;
  menu?: ReactNode;
  /** 소개가 비었을 때 「소개」 구역에 세울 것 — 내 시트는 「소개를 써 보세요」 링크. 없으면 그 구역을 뺀다 */
  emptyIntro?: ReactNode;
  /** 사진이 없을 때 빈 사진 칸 위에 세울 것 — 내 시트의 「사진 추가」 */
  emptyPhoto?: ReactNode;
  /** 몸의 맨 아래 — 내 시트의 「프로필 편집」 */
  footer?: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const intro = partner.intro !== null && partner.intro.trim() !== '' ? partner.intro : null;
  const hasPhoto = partner.photoUrls.length > 0;
  const side = toMatch !== null || intro !== null || emptyIntro !== undefined || footer !== undefined;
  const face = {
    candidateUserId: partner.userId,
    nickname: partner.nickname,
    hasPhoto,
    photoUrls: partner.photoUrls,
    photoFocus: partner.photoFocus,
    avatarElement: partner.tone,
  };
  return (
    <DetailSheet
      sheet={control.sheet}
      nickname={partner.nickname}
      label={partnerSheetName(partner.nickname)}
      menu={control.shown ? menu : null}
      onClose={control.closed}
    >
      <div
        data-partner-sheet=""
        className={`flex flex-col gap-5 ${side ? 'lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-6' : ''}`}
      >
        {/* 사진이 없어도 같은 4:5 칸 — 그 사람의 색 판에 첫 글자(`CandidatePhoto`), 내 시트는 그 위에 「사진 추가」 */}
        <div ref={frame} className={`${PROFILE_PHOTO_FRAME} bg-surface-sunken`}>
          {hasPhoto ? <CardPhotos card={face} bounce={frame} /> : <CandidatePhoto card={face} initialClass="text-figure" />}
          {!hasPhoto && emptyPhoto}
        </div>
        {side && (
          <div className="flex min-w-0 flex-col gap-5">
            {toMatch}
            {(intro !== null || emptyIntro !== undefined) && (
              <section className="flex flex-col gap-2 border-t border-border pt-4 lg:first:border-t-0 lg:first:pt-0">
                <h3 className={TYPE_META}>
                  {INTRO_HEADING}
                </h3>
                {/* 내 시트는 소개 칸이 세 줄 높이를 잡는다 — 소개가 비어도 팝업 높이가 같다 */}
                <div className={emptyIntro !== undefined ? 'min-h-[4.8rem]' : ''}>
                  {intro !== null ? (
                    <p className="whitespace-pre-wrap break-keep [overflow-wrap:anywhere] text-body leading-[1.7] text-foreground">{intro}</p>
                  ) : (
                    emptyIntro
                  )}
                </div>
              </section>
            )}
            {footer}
          </div>
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
