'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { ActionSheet, type ActionChoice } from '../../ui/action-sheet';
import { ICON_BUTTON_ON_PHOTO_FACE } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import type { MyPhoto } from './photos';

/** 보기의 「⋯」 이름 — 머리글 톱니의 「설정 메뉴」와 같은 꼴(대장 settings-07) */
export const PHOTO_MENU_LABEL = '사진 메뉴';

/** 이만큼 옆으로 밀면 다음 · 앞 장 — 카드 사진 넘기기(`app/me/matching/card-photos.tsx`)와 같은 문턱 */
const SWIPE_PX = 48;

/**
 * **사진 크게 보기** — 프로필 사진 칸을 누르면 그 장이 화면 가득 선다(2026-10-24 운영자 「사진 자체를 누르면 사진을 크게 했을 때
 * 보여주거나 … 대표사진으로 하기 삭제 이렇게 보여야」).
 *
 * 레퍼런스 다수를 따랐다(근거 표는 #835 본문) — 카카오톡의 내 프로필 사진 보기(검은 전체 화면 · 왼쪽 위 × · 가운데 「1 / 2」), iPhone 사진 앱 ·
 * 인스타그램의 오른쪽 위 「⋯」, 「⋯」가 여는 아래 판에 맨 아래 붉은 「삭제」(인스타그램 · 카카오톡 iOS), 좌우로 쓸어넘겨 다른 장(iPhone ·
 * 카카오톡). 넓은 화면은 가운데 큰 판이고 좌우 화살표가 선다.
 *
 * - 「⋯」의 판(`ActionSheet`)에서 고르면 보기를 먼저 닫고 그 일을 한다 — 「삭제」는 확인 창, 「사진 변경」은 기기의 사진 창, 「위치 조정」은 맞추는 창.
 *   닫기를 먼저 해야 보기가 닫히며 초점을 사진 칸으로 돌려놓는 일이 뒤에 연 창의 초점을 빼앗지 않는다.
 * - Esc · × 는 보기를 닫고 초점은 연 사진 칸으로 돌아온다(브라우저가 `<dialog>` 를 닫을 때 한다). ← → 키는 앞 · 다음 장.
 */
export function PhotoViewer({
  userId,
  photos,
  at,
  onAt,
  onClose,
  choicesFor,
}: {
  userId: string;
  photos: readonly MyPhoto[];
  /** 보는 장의 칸 번호(1부터) — `null` 이면 닫혀 있다 */
  at: number | null;
  onAt: (position: number) => void;
  onClose: () => void;
  /** 그 장의 「⋯」 판 줄 */
  choicesFor: (photo: MyPhoto, position: number) => ActionChoice[];
}) {
  const view = useRef<HTMLDialogElement>(null);
  const [menu, setMenu] = useState(false);
  const press = useRef<{ x: number; y: number } | null>(null);

  const open = at !== null && photos[at - 1] !== undefined;
  useEffect(() => {
    const node = view.current;
    if (node === null) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);

  const total = photos.length;
  const position = at ?? 1;
  const photo = photos[position - 1];

  const step = (by: number) => {
    const next = position + by;
    if (next >= 1 && next <= total) onAt(next);
  };

  /** 판에서 고른 일 — 보기를 먼저 닫고 한다 */
  const choices =
    photo === undefined
      ? []
      : choicesFor(photo, position).map((choice) => ({
          ...choice,
          run: () => {
            view.current?.close();
            choice.run();
          },
        }));

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    press.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = press.current;
    press.current = null;
    if (start === null) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return;
    step(dx < 0 ? 1 : -1);
  };

  return (
    <dialog
      ref={view}
      aria-label={`사진 ${position} / ${total}`}
      onClose={() => {
        setMenu(false);
        onClose();
      }}
      onClick={(event) => {
        /* 넓은 화면의 어두운 바깥을 누르면 닫는다 */
        if (event.target === event.currentTarget) view.current?.close();
      }}
      onKeyDown={(event) => {
        if (menu) return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          step(-1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          step(1);
        }
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-black p-0 text-white backdrop:bg-black lg:m-auto lg:h-[min(88dvh,52rem)] lg:w-[min(40rem,92vw)] lg:rounded-paper lg:shadow-float lg:backdrop:bg-black/70"
    >
      {open && photo !== undefined && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
            {/* 왼쪽 위 × — 카카오톡 프로필 사진 보기와 같은 자리 */}
            <button
              type="button"
              onClick={() => view.current?.close()}
              aria-label="닫기"
              className="grid size-11 place-items-center rounded-full text-white hover:bg-white/10"
            >
              <Icon name="close" className="size-6" />
            </button>
            <p className="flex items-center gap-2 text-body font-semibold tabular-nums" aria-hidden="true">
              {position === 1 && (
                <span className="rounded-full bg-white px-2 py-0.5 text-tag font-semibold text-black">대표</span>
              )}
              {position} / {total}
            </p>
            <button
              type="button"
              onClick={() => setMenu(true)}
              aria-label={PHOTO_MENU_LABEL}
              aria-haspopup="dialog"
              aria-expanded={menu}
              className="grid size-11 place-items-center rounded-full text-white hover:bg-white/10"
            >
              <Icon name="more" className="size-6" />
            </button>
          </div>

          <div
            className="relative min-h-0 flex-1 touch-pan-y select-none"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              press.current = null;
            }}
          >
            {/* 사진 전체가 보이게 담는다(자르지 않는다) — 바탕 그림이라 끌리지 않는다 */}
            <div
              key={photo.version}
              aria-hidden="true"
              data-photo-view=""
              className="absolute inset-0 bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(/me/photo/${userId}/${photo.position}?v=${photo.version})` }}
            />
            {position > 1 && (
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => step(-1)}
                className={`${ICON_BUTTON_ON_PHOTO_FACE} absolute left-3 top-1/2 hidden -translate-y-1/2 sm:grid`}
              >
                <Icon name="chevron" className="size-5 rotate-180" />
              </button>
            )}
            {position < total && (
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => step(1)}
                className={`${ICON_BUTTON_ON_PHOTO_FACE} absolute right-3 top-1/2 hidden -translate-y-1/2 sm:grid`}
              >
                <Icon name="chevron" className="size-5" />
              </button>
            )}
          </div>
          <div className="h-[max(1rem,env(safe-area-inset-bottom))] shrink-0" />
        </div>
      )}
      <ActionSheet open={menu} onClose={() => setMenu(false)} label={PHOTO_MENU_LABEL} choices={choices} />
    </dialog>
  );
}
