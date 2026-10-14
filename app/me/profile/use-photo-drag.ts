'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** 길게 누름 — 이만큼 손가락이 머물면 사진이 들린다 */
const LIFT_AFTER_MS = 350;
/** 들리기 전에 이만큼 움직이면 스크롤로 본다 — 들지 않는다 */
const SCROLL_SLOP_PX = 10;

/** 들린 사진 하나 — 어디서 들었고, 지금 어느 칸 위에 있고, 손가락이 얼마나 움직였나 */
export type Lift = { from: number; over: number; dx: number; dy: number };

/**
 * **길게 눌러 끌어 옮기기** — 사진 칸을 길게 누르면 들리고, 끌어 다른 사진 칸에 놓으면 `move(from, to)` 를 부른다.
 *
 * 들리기 전에 움직이면 스크롤로 보고 놓는다. 들린 동안은 페이지가 스크롤되지 않는다(`gridRef` 에 단 비수동 `touchmove`).
 * 들었다 놓은 뒤의 누름(`click`)은 메뉴를 안 열어야 하므로 `takeSwallowedClick` 이 한 번 답한다. 칸은 `data-photo-slot` 에
 * 제 자리(1부터)를 든다 — 손가락 아래의 칸을 그것으로 찾는다.
 */
export function usePhotoDrag({
  busy,
  total,
  move,
}: {
  /** 처리하는 동안은 들지 않는다 */
  busy: boolean;
  /** 지금 선 사진 수 — 이 밖의 칸 위에서는 놓을 자리가 없다 */
  total: number;
  /** 화면의 칸 번호로 옮긴다 */
  move: (from: number, to: number) => void;
}) {
  const [lift, setLift] = useState<Lift | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /** 누르기 시작한 자리와 시각을 재는 타이머 — 그리기와 상관없는 값이라 상태에 안 둔다 */
  const press = useRef<{ position: number; x: number; y: number; timer: number | null } | null>(null);
  /** 들린 동안 페이지가 스크롤되지 않게 — 비수동 `touchmove` 가 읽는다 */
  const lifted = useRef(false);
  /** 들었다 놓은 뒤의 누름(`click`)은 메뉴를 안 연다 — 길게 누름은 옮기기다 */
  const swallowClick = useRef(false);

  /* 누르는 중에 화면을 떠나면 들어 올릴 타이머를 거둔다 */
  useEffect(
    () => () => {
      if (press.current?.timer != null) window.clearTimeout(press.current.timer);
    },
    [],
  );

  /*
    들린 사진을 끄는 동안 폰이 페이지를 스크롤하지 않게 한다. `touch-action` 은 손이 닿는 순간에 정해져
    길게 누른 뒤에는 못 바꾼다 — 그래서 `touchmove` 를 비수동으로 받아 들린 동안만 막는다.
    사진 칸 위에서 그냥 쓸어 넘기는 스크롤은 그대로 된다.
  */
  useEffect(() => {
    const grid = gridRef.current;
    if (grid === null) return;
    const hold = (event: TouchEvent) => {
      if (lifted.current) event.preventDefault();
    };
    grid.addEventListener('touchmove', hold, { passive: false });
    return () => grid.removeEventListener('touchmove', hold);
  }, []);

  /** 손가락 아래의 사진 칸 — 들린 그림은 `pointer-events: none` 이라 그 아래 칸이 잡힌다 */
  const slotUnder = (x: number, y: number): number | null => {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-photo-slot]');
    const position = Number(hit?.dataset.photoSlot);
    return Number.isInteger(position) && position >= 1 && position <= total ? position : null;
  };

  const endPress = () => {
    if (press.current?.timer != null) window.clearTimeout(press.current.timer);
    press.current = null;
    lifted.current = false;
    setLift(null);
  };

  const onPointerDown = (position: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (busy || event.button !== 0) return;
    /* 지난 길게 누름 뒤에 누름(`click`)이 안 왔으면 걸쇠가 남아 있다 — 새 누름마다 푼다 */
    swallowClick.current = false;
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    const start = { position, x: event.clientX, y: event.clientY, timer: null as number | null };
    start.timer = window.setTimeout(() => {
      lifted.current = true;
      swallowClick.current = true;
      /* 들린 뒤에는 칸 밖으로 나가도 이 칸이 손가락을 쥔다 */
      try {
        target.setPointerCapture(pointerId);
      } catch {
        /* 손가락이 이미 떨어졌다 — 들 것이 없다 */
      }
      setLift({ from: position, over: position, dx: 0, dy: 0 });
    }, LIFT_AFTER_MS);
    press.current = start;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const start = press.current;
    if (start === null) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!lifted.current) {
      if (Math.hypot(dx, dy) > SCROLL_SLOP_PX) endPress();
      return;
    }
    const over = slotUnder(event.clientX, event.clientY) ?? start.position;
    setLift({ from: start.position, over, dx, dy });
  };

  const onPointerUp = () => {
    const ended = lift;
    endPress();
    if (ended !== null && ended.over !== ended.from) move(ended.from, ended.over);
  };

  /** 이 누름(`click`)이 들었다 놓은 뒤의 것인가 — 한 번 답하고 걸쇠를 푼다 */
  const takeSwallowedClick = () => {
    const swallowed = swallowClick.current;
    swallowClick.current = false;
    return swallowed;
  };

  return { lift, gridRef, onPointerDown, onPointerMove, onPointerUp, endPress, takeSwallowedClick };
}
