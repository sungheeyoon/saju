'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { snackbar, type Snack } from './snackbar-store';

/** 폰의 하단 독(`app/site-header.tsx` 의 `Dock`) — 스낵바는 그 위에 뜬다 */
const DOCK_ID = 'mobile-member-navigation';

/** 독도 없을 때 바닥에서 띄우는 거리(px) — 홈 막대는 따로 더한다 */
const FLOOR_GAP = 16;
/** 독 위로 띄우는 거리(px) */
const DOCK_GAP = 8;

/**
 * 바닥에서 얼마나 띄우나(px) — **보이는 독이 있으면 그 위**, 없으면 0 이고 바닥에서 조금 띄운다(넓은 화면 · 대화방 · 로그인 전). 독은 `md:hidden` 이라
 * 넓은 화면에서는 자리가 없다(`display: none` 이면 높이가 0).
 */
function liftAboveDock(): number {
  const dock = document.getElementById(DOCK_ID);
  if (dock === null) return 0;
  const box = dock.getBoundingClientRect();
  if (box.height === 0) return 0;
  return Math.max(0, window.innerHeight - box.top) + DOCK_GAP;
}

/**
 * **바닥 스낵바 한 자리** — 뿌리 레이아웃에 한 번 선다(ADR 0109 추기 2026-10-24 「바닥 스낵바」). 부르는 쪽은 `showSnackbar` 만 안다.
 *
 * - **알림 자리는 늘 서 있고 글자만 바뀐다**(`aria-live="polite"`) — 새로 생긴 알림 자리는 화면 읽기가 못 읽고 지나간다(`DoneNote` 와
 *   같은 까닭). 역할(`role="status"`)은 달지 않는다 — 화면마다 하나뿐인 상태 줄을 역할로 찾는 시험이 있다.
 * - 한 번에 하나 · 4초 · 단추 하나 · 누르고 있거나 초점이 있으면 시계가 선다(`snackbar-store.ts`).
 * - 모양은 당근 SEED Snackbar — 먹색 판 · 밝은 글자 · 단추는 굵은 다른 색 · 높이 44px 이상 · 폭 464px 까지. 모서리는 SEED 의 8px 대신
 *   이 앱의 칸 단(`rounded-cell` 12px, 모서리 세 단)이다.
 * - 줄인 움직임이면 움직이지 않고 선다.
 */
export function SnackbarHost() {
  const shown = useSyncExternalStore(snackbar.subscribe, snackbar.get, () => null);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      data-snackbar=""
      className="pointer-events-none fixed inset-x-4 bottom-0 z-[60] flex justify-center"
    >
      {shown !== null && <SnackbarCard key={shown.id} snack={shown} />}
    </div>
  );
}

/** 한 장 — 바뀌면 새로 선다(`key`). 선 다음 틀에 독을 재고 올라온다 */
function SnackbarCard({ snack }: { snack: Snack }) {
  const [lift, setLift] = useState<number | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setLift(liftAboveDock()));
    return () => cancelAnimationFrame(frame);
  }, []);

  const entered = lift !== null;
  return (
    <div
      onPointerEnter={snackbar.pause}
      onPointerLeave={snackbar.resume}
      onPointerDown={snackbar.pause}
      onPointerUp={snackbar.resume}
      onFocus={snackbar.pause}
      onBlur={snackbar.resume}
      style={{ marginBottom: lift === null || lift === 0 ? `calc(${FLOOR_GAP}px + env(safe-area-inset-bottom))` : `${lift}px` }}
      className={`pointer-events-auto flex min-h-11 w-full max-w-[29rem] items-center gap-3 rounded-cell bg-accent py-1 pl-4 pr-1.5 text-on-accent shadow-float transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
        entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <p className="min-w-0 flex-1 py-2 text-body leading-6">{snack.message}</p>
      {snack.action !== null && (
        <button
          type="button"
          onClick={snackbar.act}
          className="inline-flex min-h-11 shrink-0 items-center rounded-cell px-2.5 text-body font-bold text-accent-soft hover:bg-accent-strong active:opacity-70"
        >
          {snack.action.label}
        </button>
      )}
    </div>
  );
}
