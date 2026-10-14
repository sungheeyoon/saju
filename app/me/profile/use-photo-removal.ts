'use client';

import { useEffect, useRef, useState } from 'react';

import { actionAnswer } from '../../ui/action-answer';
import { removePhoto } from './actions';
import { serverPosition } from './photo-positions';
import type { MyPhoto } from './photos';

/** 지운 장을 되돌릴 수 있는 동안 — 이 시간이 지나야 서버에서 지운다 */
const UNDO_MS = 5000;

/**
 * **늦은 지우기와 서버 목록의 자리** — 사진 판(`PhotoGrid`)의 지우기 한 벌.
 *
 * × 를 누르면 그 장이 곧바로 칸에서 빠지고(`hidden`) `UNDO_MS` 동안 되돌릴 수 있다(`undoable`). 서버에는 그 시간이 지나야,
 * 또는 다른 누름이 서버에 가기 전에(`sendRemoval`), 또는 화면을 떠나거나 탭이 가려질 때 보낸다. 되돌릴 수 있는 장은 하나다.
 *
 * 다른 누름이 서버에 보내는 자리도 여기서 센다 — 지우기를 기다리는 장이 화면에서만 빠져 있고, 서버가 지웠다고 답한 장은
 * 목록이 새로 오기 전에도 빼야 해서다(`serverPhotos` · `serverPositionOf`).
 */
export function usePhotoRemoval({
  photos,
  failed,
}: {
  /** 서버가 준 지금 목록 */
  photos: readonly MyPhoto[];
  /** 서버가 거절했다 — 까닭을 세우고 목록을 다시 받는다 */
  failed: (message: string) => void;
}) {
  /** 화면에서 뺀 장(판본) — 되돌릴 수 있는 동안과, 지우기를 보낸 뒤 서버 목록이 새로 올 때까지 */
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set());
  /** 되돌릴 수 있는 장 — 상태 줄에 「실행 취소」가 선다 */
  const [undoable, setUndoable] = useState<number | null>(null);
  const pendingRemoval = useRef<{ version: number; timer: number } | null>(null);
  /** 서버가 지웠다고 답한 판본 — 서버 목록이 새로 오기 전에도 그 장을 빼고 자리를 센다 */
  const gone = useRef(new Set<number>());
  /** 지금 서버 목록 — 늦게 보내는 지우기가 그때의 자리를 센다 */
  const latest = useRef(photos);
  const undoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    latest.current = photos;
  }, [photos]);

  /* 지운 칸의 × 가 사라지면 초점이 갈 데가 없다 — 「실행 취소」로 옮긴다 */
  useEffect(() => {
    if (undoable !== null) undoRef.current?.focus();
  }, [undoable]);

  /*
    화면을 떠나면 기다리던 지우기를 그때 보낸다 — 다른 화면으로 가면(언마운트) 곧바로, 탭을 닫으면 `pagehide` 에서.
    답은 안 기다린다 — 받을 화면이 없다. 탭이 가려질 때는 아래(`visibilitychange`)가 먼저 보낸다.
  */
  useEffect(() => {
    const sendNow = () => {
      const pending = pendingRemoval.current;
      if (pending === null) return;
      window.clearTimeout(pending.timer);
      pendingRemoval.current = null;
      const position = serverPosition(latest.current, gone.current, pending.version);
      if (position !== null) void actionAnswer(removePhoto({ position, version: pending.version }));
    };
    window.addEventListener('pagehide', sendNow);
    return () => {
      window.removeEventListener('pagehide', sendNow);
      sendNow();
    };
  }, []);

  const unhide = (version: number) =>
    setHidden((was) => {
      const next = new Set(was);
      next.delete(version);
      return next;
    });

  /** 기다리던 지우기를 지금 보낸다 — 다른 누름이 서버에 가기 전에 */
  const sendRemoval = async () => {
    const pending = pendingRemoval.current;
    if (pending === null) return;
    window.clearTimeout(pending.timer);
    pendingRemoval.current = null;
    setUndoable(null);
    const position = serverPosition(latest.current, gone.current, pending.version);
    if (position === null) return;
    const result = await actionAnswer(removePhoto({ position, version: pending.version }));
    if (result.ok) {
      gone.current.add(pending.version);
      return;
    }
    unhide(pending.version);
    failed(result.message);
  };

  /*
    **탭이 가려지면(`visibilitychange` 의 hidden) 먼저 보낸다**(ADR 0165). 폰은 앱을 바꾸거나 화면을 끄면 그대로 탭을 버리기도 해서
    `pagehide` 가 안 오거나 그때 보낸 요청이 끊긴다. 가려진 탭은 아직 살아 있어 요청이 끝까지 간다 — 그때는 화면이 남아 있으니
    띠를 걷고 실패하면 그 장을 되살리는 보통 길(`sendRemoval`)로 보낸다. 다른 탭을 잠깐 봐도 실행 취소는 그때 끝난다.
  */
  const sendLatest = useRef(async () => {});
  useEffect(() => {
    sendLatest.current = sendRemoval;
  });
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') void sendLatest.current();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);

  const undo = () => {
    const pending = pendingRemoval.current;
    if (pending === null) return;
    window.clearTimeout(pending.timer);
    pendingRemoval.current = null;
    setUndoable(null);
    unhide(pending.version);
  };

  /** 그 장을 칸에서 빼고 되돌릴 수 있게 둔다 — 앞서 기다리던 지우기는 지금 보낸다(되돌릴 수 있는 장은 하나다) */
  const hide = (version: number) => {
    void sendRemoval();
    setHidden((was) => new Set(was).add(version));
    setUndoable(version);
    pendingRemoval.current = {
      version,
      timer: window.setTimeout(() => void sendRemoval(), UNDO_MS),
    };
  };

  return {
    hidden,
    undoable,
    undoRef,
    hide,
    undo,
    sendRemoval,
    /** 지금 서버 목록 — 서버가 지웠다고 답한 장은 뺀다 */
    serverPhotos: () => latest.current.filter((one) => !gone.current.has(one.version)),
    /** 그 장이 서버에서 지금 몇 번째인가 — 없으면 `null` */
    serverPositionOf: (version: number) => serverPosition(latest.current, gone.current, version),
    /** 지금 서버 목록의 판본들 — 올리기 전에 들어 둔다 */
    serverVersions: (): ReadonlySet<number> => new Set(latest.current.map((photo) => photo.version)),
  };
}
