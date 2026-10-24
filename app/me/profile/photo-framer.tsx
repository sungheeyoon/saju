'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

import { draggedFocus, focusPosition, steppedFocus, type PhotoFocus } from '@/src/lib/profile';

import { CONFIRM_FIRST_FOCUS, ConfirmDialog } from '../../ui/confirm-dialog';

/** 창 제목 · 사진 칸 메뉴의 줄이 같은 글자다(대장 settings-01) */
export const PHOTO_FRAME_TITLE = '위치 조정';

/**
 * **사진의 보일 자리를 맞추는 창**(G-98) — 「사진 변경」 · 새 사진을 고른 뒤, 그리고 사진 칸 메뉴의 「위치 조정」이 연다.
 *
 * 실제로 보일 틀 둘에 그 사진을 담는다 — 큰 틀은 프로필 대표 칸 · 인연 카드의 비율(3:4), 작은 둥근 틀은 대화 · 요청 · 보관함의
 * 얼굴이다. 어느 틀에서 끌어도(손가락 · 마우스) 두 틀이 같이 움직인다 — 같은 두 수(`object-position`)를 보이니까. 큰 틀은 화살표
 * 키로도 옮긴다. 확대는 없다(위치만). 바이트는 안 바뀐다 — 「저장」은 두 수만 낸다.
 *
 * 확인 창 한 벌(`ConfirmDialog`, ADR 0166)이라 「취소」 · Esc · 바깥 누름이 같은 일이다. 첫 초점은 큰 틀 — 열자마자 화살표가 듣는다.
 */
export function PhotoFramer({
  open,
  src,
  focus,
  onFocus,
  onSave,
  onCancel,
}: {
  open: boolean;
  /** 맞출 사진 — 기기의 사진(blob)이나 서버의 그 장 */
  src: string | null;
  focus: PhotoFocus;
  onFocus: (focus: PhotoFocus) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onCancel}
      title={PHOTO_FRAME_TITLE}
      confirmLabel="저장"
      firstFocus="confirm"
      onConfirm={onSave}
    >
      {src !== null && (
        <div className="mt-2 flex flex-col items-center gap-3">
          <FocusFrame
            src={src}
            focus={focus}
            onFocus={onFocus}
            keyboard
            className="aspect-[3/4] w-full max-w-[17rem] rounded-cell"
          />
          <FocusFrame src={src} focus={focus} onFocus={onFocus} className="size-16 rounded-full" />
        </div>
      )}
    </ConfirmDialog>
  );
}

/**
 * 틀 하나 — 사진을 덮어 담고, 끌면 그 틀이 넘치는 쪽으로 자리가 옮는다(`draggedFocus`). 넘치지 않는 축은 그대로다 — 그 축은 어느
 * 값이어도 이 틀에서 같은 모양이고, 다른 틀(비율이 다른)에서 보인다.
 */
function FocusFrame({
  src,
  focus,
  onFocus,
  keyboard = false,
  className,
}: {
  src: string;
  focus: PhotoFocus;
  onFocus: (focus: PhotoFocus) => void;
  /** 화살표 키를 받는 틀 — 창의 첫 초점 */
  keyboard?: boolean;
  className: string;
}) {
  /*
    사진의 본래 크기 — 끈 거리를 %로 옮길 때 넘친 길이를 잰다. 그림은 틀의 바탕(`background-*`)으로 그린다 — 덮어 담기 ·
    자리가 `object-*` 와 같은 뜻이다.
  */
  const natural = useRef({ width: 0, height: 0 });
  /*
    크기를 잰 사진 — 그 전에 끌면 넘친 길이를 몰라 자리가 안 옮는다. 틀이 `data-measured` 를 달아 시험이 그 뒤에 끈다
    (창이 서자마자 끈 시험이 사진이 오기 전에 끌어 가끔 붉었다, 2026-10-24)
  */
  const [measured, setMeasured] = useState<string | null>(null);
  useEffect(() => {
    const probe = new Image();
    probe.onload = () => {
      natural.current = { width: probe.naturalWidth, height: probe.naturalHeight };
      setMeasured(src);
    };
    probe.src = src;
    return () => {
      probe.onload = null;
    };
  }, [src]);
  const drag = useRef<{ x: number; y: number; start: PhotoFocus; frame: { width: number; height: number } } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* 손가락이 이미 떨어졌다 */
    }
    const box = event.currentTarget.getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, start: focus, frame: { width: box.width, height: box.height } };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start === null) return;
    onFocus(draggedFocus(start.start, event.clientX - start.x, event.clientY - start.y, start.frame, natural.current));
  };

  const end = () => {
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = steppedFocus(focus, event.key);
    if (next === null) return;
    event.preventDefault();
    onFocus(next);
  };

  return (
    <div
      {...(keyboard
        ? {
            ...CONFIRM_FIRST_FOCUS,
            tabIndex: 0,
            role: 'group',
            'aria-label': '사진 위치',
            'aria-keyshortcuts': 'ArrowLeft ArrowRight ArrowUp ArrowDown',
            onKeyDown,
          }
        : { 'aria-hidden': true })}
      data-focus-frame={keyboard ? 'main' : 'round'}
      data-measured={measured === src ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      className={`relative shrink-0 cursor-grab touch-none select-none overflow-hidden bg-surface-sunken bg-cover bg-no-repeat outline-none ring-1 ring-border active:cursor-grabbing focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent)_55%,transparent)] ${className}`}
      style={{ backgroundImage: `url(${src})`, backgroundPosition: focusPosition(focus) }}
    />
  );
}
