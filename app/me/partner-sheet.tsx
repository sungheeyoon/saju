'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { MY_PROFILE_EDIT_LABEL } from '@/src/lib/chat/copy';

import type { PhotoFocus } from '@/src/lib/profile';
import type { Element } from '@/src/lib/saju';

import { Avatar } from './avatar';
import { CandidatePhoto } from './matching/candidate-photo';
import { CardPhotos } from './matching/card-photos';
import { BUTTON_SECONDARY_SMALL_FACE } from '../ui/buttons';
import { Icon } from '../ui/icons';
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
 * 20rem(320×400) 한 칸에 같은 높이 문턱을 둔다. **넓은 화면의 두 열은 아랫선이 사진 아래와 맞는다** — 시트를 46rem 으로 넓혀 오른쪽 열이
 * 약 21.5rem 이다. 오른쪽 열은 사진 높이에 묶이고(`contain: size` · `items-stretch`) 「프로필 편집」은 그 맨 아래에 붙는다. 소개(최대 500자,
 * `INTRO_MAX`)가 그 높이를 넘으면 그 칸 안에서 스크롤한다(`IntroBody`, 운영자 2026-10-27 「사진이랑 소개글 아래 마진이 안 맞는다」 · 「넘치면 스크롤」). 전에는 내 시트가 가로 4:3 · 넓은 화면 2:1, 사진 없는 상대가 높이 128px 띠였다.
 */
const PROFILE_PHOTO_FRAME =
  'relative mx-auto aspect-[4/5] w-full max-w-[min(100%,44.8dvh)] shrink-0 select-none overflow-hidden rounded-card lg:max-w-[min(100%,20rem,44.8dvh)] lg:self-start';

/**
 * **상대 프로필 시트** — 대화방 머리 · 말풍선 곁 사진과 인연 궁합 머리 · 요청 카드의 얼굴이 연다(운영자 결정 2026-10-11, ADR 0155 덧).
 *
 * 별도 화면이 아니라 시트다 — 방의 스크롤 자리 · 더 불러 둔 이전 말 · 쓰던 글이 그대로 남는다. 판은 오늘의 인연 ⓘ · 지나친 인연
 * 시트(`DetailSheet`)와 같은 한 벌이라 **이름이 머리에 선다** — 시트를 내려 읽는 동안에도 누구인지가 남고, 그 줄 끝에 「⋯」(신고 ·
 * 차단, 부르는 쪽이 준다)와 닫기가 선다(힌지 · 대화방 머리와 같은 줄). 폰은 아래에서 올라오고 넓은 화면(lg)은 가운데 대화상자다.
 *
 * 몸은 위에서부터 **사진(세로 4:5) → 궁합 한 줄(「☯ 궁합 82점 … 궁합풀이 보기 ›」, `CompatRow`) → 소개**다. 소개는 접지 않고
 * 끝까지 서고 시트 안에서 내려 읽는다(힌지 · 범블 · 헬로우톡의 프로필 상세, 운영자 결정 2026-10-27). 넓은 화면은 사진이 왼쪽 열, 궁합 · 소개가 오른쪽 열이다. 사진 넘기기는 오늘의 인연 카드와 같은 판(`CardPhotos` —
 * 반 탭 · 막대 · 가로 쓸기 · 넓은 화면의 화살표). 사진이 없으면 **같은 4:5 칸**에 그 사람의 색 판과 첫 글자(덱 카드와 같은 모양)가 선다.
 * 홈 · 대화방의 「내 프로필」도 이 시트 그대로다 — 칸 · 열이 상대 시트와 같다(`PROFILE_PHOTO_FRAME`).
 * 소개가 없으면 그 구역을 뺀다. 궁합 줄은 부르는 쪽이 준다 — 대화방은 머리의 알약과 같은 상태의 한 줄(`CompatRow`)을 넘기고,
 * 인연 궁합 화면 · 요청 카드가 연 시트는 `null` 이라 그 줄만 빠진다.
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
  /** 몸의 맨 아래 — 내 시트의 「프로필 편집」(폰은 시트 바닥에 붙는다, `SelfProfile`) */
  footer?: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const introHeadingId = useId();
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
      wide={side}
      menu={control.shown ? menu : null}
      onClose={control.closed}
    >
      <div
        data-partner-sheet=""
        className={`flex flex-col gap-5 ${side ? 'lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-stretch lg:gap-6' : ''} ${footer !== undefined ? PINNED_SCROLL_MARGIN : ''}`}
      >
        {/* 사진이 없어도 같은 4:5 칸 — 그 사람의 색 판에 첫 글자(`CandidatePhoto`), 내 시트는 그 위에 「사진 추가」 */}
        <div ref={frame} className={`${PROFILE_PHOTO_FRAME} bg-surface-sunken`}>
          {hasPhoto ? <CardPhotos card={face} bounce={frame} /> : <CandidatePhoto card={face} initialClass="text-figure" />}
          {!hasPhoto && emptyPhoto}
        </div>
        {side && (
          /*
            넓은 화면의 오른쪽 열은 사진 높이에 묶인다 — `contain: size` 라 이 열의 글이 행 높이를 늘리지 못하고(행은 사진 400), 늘어난 칸에
            맞춰 선다. 넘치는 소개는 그 칸 안에서 스크롤하고(`IntroBody`), 궁합 줄 · 「프로필 편집」은 스크롤 밖 위아래에 그대로다
          */
          <div className="flex min-w-0 flex-col gap-5 lg:min-h-0 lg:[contain:size]">
            {toMatch}
            {(intro !== null || emptyIntro !== undefined) && (
              <section
                aria-labelledby={introHeadingId}
                className="flex flex-col gap-2 border-t border-border pt-4 lg:min-h-0 lg:flex-1 lg:first:border-t-0 lg:first:pt-0"
              >
                <h3 id={introHeadingId} className={TYPE_META}>
                  {INTRO_HEADING}
                </h3>
                <IntroBody labelledBy={introHeadingId} roomy={emptyIntro !== undefined}>
                  {intro !== null ? (
                    <p className="whitespace-pre-wrap break-keep [overflow-wrap:anywhere] text-body leading-[1.7] text-foreground">{intro}</p>
                  ) : (
                    emptyIntro
                  )}
                </IntroBody>
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
 * **소개 글의 칸 — 넓은 화면에서 넘치면 그 칸 안에서 스크롤한다**(운영자 결정 2026-10-27 — 소개 최대 500자, 「넘치면 스크롤」). 오른쪽 열은
 * 사진 높이에 묶여 있어 긴 소개는 여기서 잘리고, 아래 끝 32px 가 바탕색으로 옅어져 이어지는 글이 있음을 보인다(끝까지 내리면 그 띠는 글 아래
 * 빈 자리에 선다 — 마지막 줄을 안 가린다). 넘칠 때만 키보드로 닿는다 — `tabIndex=0` 과 소개 머리를 이름으로 든 칸이라(구역은 바깥 `section` 하나, 초점 테는 앱의 한 벌) Tab 으로 와서 화살표 ·
 * Page Down 으로 내린다(마우스 휠은 늘). 넓은 화면에는 얇은 스크롤바(`scrollbar-quiet`, `app/globals.css`)가 늘 선다. 폰은 묶이지 않아 넘치지 않는다 — 시트 전체가 스크롤한다. 내 시트는 소개가 비어도 세 줄 높이를 잡는다.
 */
function IntroBody({ labelledBy, roomy, children }: { labelledBy: string; roomy: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (el === null) return;
    /*
      글의 높이로 잰다 — 상자의 `scrollHeight` 에는 아래 페이드 띠(32px, 흐름 안의 `::after`)가 들어가 띠보다 짧게 넘치는 글도 넘친다고 읽었다.
      상자와 글 둘 다 본다 — 글만 자라도(펼친 소개 · 바뀐 글) 다시 잰다
    */
    const measure = () => {
      const text = el.firstElementChild as HTMLElement | null;
      setOverflows(text !== null && text.offsetHeight > el.clientHeight + 1);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    if (el.firstElementChild !== null) watch.observe(el.firstElementChild);
    return () => watch.disconnect();
  }, []);
  return (
    /* 이름은 바깥 `section`(「소개」)이 든다 — 이 상자는 겹 구역이 아니라 초점이 닿는 스크롤 칸이다(역할 없이 tabIndex · 이름) */
    <div
      ref={box}
      {...(overflows ? { tabIndex: 0, 'aria-labelledby': labelledBy } : {})}
      className={`${roomy ? 'min-h-[4.8rem]' : ''} rounded-cell outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent)_55%,transparent)] lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain scrollbar-quiet lg:after:pointer-events-none lg:after:sticky lg:after:bottom-0 lg:after:block lg:after:h-8 lg:after:bg-gradient-to-t lg:after:from-background lg:after:to-transparent lg:after:content-['']`}
    >
      {children}
    </div>
  );
}

/**
 * 바닥에 붙은 판(`MyProfileEditFooter`)이 있는 시트 — 키보드로 옮긴 초점이 판 밑에 숨지 않게, 초점이 가는 것들은 판 높이(약 108px — 판 84 ·
 * 페이드 24)만큼 아래를 비워 두고 스크롤된다. 폰만이다 — 넓은 화면은 판이 제자리다
 */
const PINNED_SCROLL_MARGIN = 'max-lg:[&_:is(a,button,[tabindex])]:scroll-mb-28';

/**
 * **「내 프로필」 시트의 「프로필 편집」 — 폰은 시트 바닥에 붙는다**(운영자 2026-10-27). 홈의 동그란 프로필 · 대화방 「⋯ → 내 프로필」이 같은
 * 판을 쓴다(`footer`). 사진이 4:5 라 폰에서는 이 줄이 첫 화면 밖으로 밀렸다. 붙은 판 위 24px 는 바탕색으로 옅어져 그 아래 글이 반쪽으로 잘린
 * 채 보이지 않고, 아래는 아이폰 홈 막대만큼 비운다(`env(safe-area-inset-bottom)`, 아래 판 `ActionSheet` 와 같은 셈). 끝까지 내리면 판이
 * 제자리(소개 아래)에 서므로 마지막 줄이 다 보인다 — 위 틈(28px)이 페이드(24px)보다 넓다. 넓은 화면은 두 열의 오른쪽 맨 아래(사진 아랫선)다.
 */
export function MyProfileEditFooter() {
  return (
    <div className="sticky bottom-0 z-[1] -mx-5 -mb-10 mt-2 bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-background before:to-transparent lg:static lg:mx-0 lg:mb-0 lg:mt-auto lg:bg-transparent lg:p-0 lg:before:hidden">
      <Link href="/me/profile" className={`${BUTTON_SECONDARY_SMALL_FACE} min-h-12 w-full px-4`}>
        <Icon name="pencil" className="size-4" />
        {MY_PROFILE_EDIT_LABEL}
      </Link>
    </div>
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
