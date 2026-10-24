'use client';

import { useEffect, useRef, useState } from 'react';

import { FOCUS_CENTER, PHOTO_MAX_COUNT, type PhotoFocus } from '@/src/lib/profile';

import { actionAnswer } from '../../ui/action-answer';
import type { useDoneNote } from '../../ui/done-note';
import { setPhotoFocus } from './actions';
import { sendNewPhoto, sendReplacement } from './photo-send';
import type { MyPhoto } from './photos';
import type { usePhotoRemoval } from './use-photo-removal';

/** 사진 올리기를 막은, 우리가 안 쓴 문장 — 우리 문장 하나로 선다(`app/db-error.boundary.test.ts`) */
const UNREADABLE_PHOTO = '사진을 열지 못했어요. 다른 사진을 골라 주세요.';
/** 바꾸려던 장이 그 사이 서버 목록에서 빠졌다 — DB 가 낡은 누름에 내는 문장과 같은 글자(`20261202090000`) */
const REPLACE_FAILED = '사진을 바꾸지 못했어요. 다시 시도해 주세요.';
/** 맞추려던 장이 그 사이 서버 목록에서 빠졌다 — DB 가 낡은 누름에 내는 문장과 같은 글자(`20261203090000`) */
const FOCUS_FAILED = '위치를 저장하지 못했어요. 다시 시도해 주세요.';

/** 「위치 조정」이 끝난 말 — 사진 저장의 말과 같은 꼴(대장 settings-01) */
const FOCUS_SAVED = '위치를 저장했어요';

/** 고른 순간 칸에 서는 기기의 사진 — 서버가 그 장을 내줄 때까지의 미리보기 */
export type Upload = { key: number; url: string; done: boolean; focus: PhotoFocus };

/**
 * 그 자리에서 바꾸는 장 — `version` 은 바꾸기 전의 장, `next` 는 서버가 답한 새 판본(답 전에는 `null`). 기기의 사진이 옛 장의
 * 칸을 덮고, 새 판본의 장이 서면 그 뒤에 깔린다
 */
export type Replacing = { version: number; url: string; next: number | null; focus: PhotoFocus };

/** 열린 위치 조정 창 — 맞출 사진과 지금 자리. 닫히면 `settle` 이 고른 자리(「취소」면 `null`)를 한 번 돌려준다 */
type Framing = { src: string; focus: PhotoFocus; settle: (focus: PhotoFocus | null) => void };

/**
 * **바이트와 보일 자리를 서버에 보내는 일** — 올리기(`pick`) · 바꾸기(`chooseReplacement` → `replace`) · 위치 조정(`adjust`).
 * 셋 다 위치 조정 창(`framer`)을 지나고, 셋 다 `sending` 을 든다. 미리보기(`waiting` · `backdrop` · `replacing`)는 서버의 장이
 * 설 때까지 칸에 기기의 사진을 세운다. 사진 판의 설명은 `PhotoGrid` 머리에 있다.
 */
export function usePhotoUploads({
  userId,
  stored,
  photos,
  total,
  working,
  removal,
  done,
  clearFailure,
  failed,
}: {
  userId: string;
  /** 이 배포가 사진을 저장소에 두나 — 서버가 화면을 그릴 때 정한다(G-120). 아니면 지금처럼 DB 다 */
  stored: boolean;
  /** 서버가 준 지금 목록 */
  photos: readonly MyPhoto[];
  /** 지금 칸에 선 사진 수(지운 장은 뺀다) */
  total: number;
  /** 옮기기가 서버에 가는 중이다 */
  working: boolean;
  /** 지우기 쪽이 세는 서버 목록의 자리 — 서버가 지웠다고 답한 장은 목록이 새로 오기 전에도 뺀다 */
  removal: Pick<ReturnType<typeof usePhotoRemoval>, 'serverPositionOf' | 'serverVersions'>;
  done: ReturnType<typeof useDoneNote>;
  clearFailure: () => void;
  failed: (message: string) => void;
}) {
  /** 열린 위치 조정 창 */
  const [framing, setFraming] = useState<Framing | null>(null);
  /**
   * 「위치 조정」으로 고른 자리(판본별) — 서버 목록보다 먼저 그린다. 서버 목록도 곧 같은 자리를 들고 오므로 걷지 않는다 — 실패면
   * 그 장만 걷는다. 판본은 장마다 하나라(바꾸면 새 판본) 다른 장에 번지지 않는다
   */
  const [placed, setPlaced] = useState<ReadonlyMap<number, PhotoFocus>>(() => new Map());

  /** 고른 장들 — 올라가는 차례대로. 서버 목록에 새 장이 서면 앞에서부터 걷힌다 */
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [sending, setSending] = useState(false);
  /** 빈 칸보다 많이 골랐다 — 다음 누름까지 상태 줄에 남는다 */
  const [overflowed, setOverflowed] = useState(false);
  /** 그 자리에서 바꾸는 장 — 다음 누름까지 */
  const [replacing, setReplacing] = useState<Replacing | null>(null);
  /** 「사진 변경」이 고른 장이 앉을 자리(판본) — 파일 창이 닫힐 때까지 */
  const replaceTarget = useRef<number | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  /** 이번 올리기 전에 서버에 있던 판본 — 이 밖의 판본이 서면 그것이 방금 올린 장이다 */
  const [before, setBefore] = useState<ReadonlySet<number>>(() => new Set());
  const nextKey = useRef(0);

  /** 서버 목록에 이미 선 새 장의 수 — 그만큼 앞의 미리보기가 걷힌다(올리기는 차례대로라 앞의 장이 먼저 선다) */
  const fresh = photos.filter((photo) => !before.has(photo.version));
  const landed = fresh.length;
  /*
    방금 선 서버의 장 뒤에 기기의 사진을 깔아 둔다 — 서버의 그림이 받아지는 동안 칸이 하얗게 비지 않게. 올리기는 차례대로라
    새 판본의 차례가 고른 장의 차례다.
  */
  const backdrop = new Map(
    fresh.flatMap((photo, index) => {
      const upload = uploads[index];
      return upload?.done ? [[photo.version, { url: upload.url, focus: upload.focus }] as const] : [];
    }),
  );
  const waiting = uploads.filter((upload, index) => !(upload.done && index < landed));
  const busy = working || sending;

  /*
    미리보기 주소(blob)는 다음 올리기가 시작될 때와 화면을 떠날 때 거둔다 — 서버의 장이 선 뒤에는 칸이 그 주소를 안 그린다
    (`waiting`). 걷은 미리보기 목록을 상태로 비우지 않는다 — 다음 올리기가 갈아 끼운다.
  */
  const previews = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of previews.current) URL.revokeObjectURL(url);
    },
    [],
  );

  /*
    지난 올리기의 미리보기를 걷는다 — 다음 누름(옮기기 · 지우기)이 시작될 때. 걷지 않으면 방금 올린 장을 지운 뒤 「서버에 선
    새 장」의 수가 줄어 그 장의 미리보기가 다시 섰다. 올리는 동안에는 두 누름이 안 받아진다(`busy`).
  */
  const settle = () => {
    setUploads([]);
    setReplacing(null);
  };

  /**
   * **고른 뒤 올리기 전의 한 단계** — 위치 조정 창을 열고 사람이 고른 자리를 기다린다(G-98). 「취소」면 `null` — 그 장은
   * 안 올린다. 미리보기 · 「저장 중…」은 고른 자리로 선다.
   */
  const frame = (src: string, focus: PhotoFocus) =>
    new Promise<PhotoFocus | null>((resolve) => {
      let settled = false;
      setFraming({
        src,
        focus,
        settle: (chosen) => {
          if (settled) return;
          settled = true;
          setFraming(null);
          resolve(chosen);
        },
      });
    });

  /** 「위치 조정」 — 이미 있는 장의 자리만 다시 맞춘다. 바이트 · 판본 · 하루 한도는 그대로다(`set_my_photo_focus`) */
  const adjust = async (photo: MyPhoto) => {
    if (busy) return;
    clearFailure();
    setOverflowed(false);
    done.clear();
    settle();
    const chosen = await frame(`/me/photo/${userId}/${photo.position}?v=${photo.version}`, focusOfPhoto(photo));
    if (chosen === null) return;
    setPlaced((was) => new Map(was).set(photo.version, chosen));
    setSending(true);
    const position = removal.serverPositionOf(photo.version);
    const result =
      position === null
        ? { ok: false as const, message: FOCUS_FAILED }
        : await actionAnswer(setPhotoFocus({ position, version: photo.version, focus: chosen }));
    if (result.ok) done.say(FOCUS_SAVED);
    else {
      setPlaced((was) => {
        const next = new Map(was);
        next.delete(photo.version);
        return next;
      });
      failed(result.message);
    }
    setSending(false);
  };

  /** 그 장이 지금 보이는 자리 — 방금 고른 자리가 서버 목록보다 앞선다 */
  const focusOfPhoto = (photo: MyPhoto): PhotoFocus => placed.get(photo.version) ?? photo.focus;

  const pick = async (files: FileList | null) => {
    const all = [...(files ?? [])];
    const chosen = all.slice(0, PHOTO_MAX_COUNT - total);
    clearFailure();
    done.clear();
    setOverflowed(chosen.length < all.length);
    if (chosen.length === 0) return;

    for (const url of previews.current) URL.revokeObjectURL(url);
    /*
      **한 장을 고르면 자리를 맞추고 올린다** — 「취소」면 안 올린다. 여러 장을 한꺼번에 고르면 창을 장마다 세우지 않는다(여섯 번
      「저장」을 누르게 된다) — 가운데로 올리고, 장마다 메뉴의 「위치 조정」으로 맞춘다.
    */
    const batch: { file: File; key: number; url: string; focus: PhotoFocus }[] = [];
    for (const file of chosen) {
      const url = URL.createObjectURL(file);
      const focus = chosen.length === 1 ? await frame(url, FOCUS_CENTER) : FOCUS_CENTER;
      if (focus === null) URL.revokeObjectURL(url);
      else batch.push({ file, key: nextKey.current++, url, focus });
    }
    previews.current = batch.map((one) => one.url);
    if (batch.length === 0) return;
    setBefore(removal.serverVersions());
    setUploads(batch.map(({ key, url, focus }) => ({ key, url, focus, done: false })));
    setSending(true);

    let sent = 0;
    for (const [index, { file, key, focus }] of batch.entries()) {
      let message: string | null = null;
      try {
        const result = await sendNewPhoto(file, focus, stored);
        if (!result.ok) message = result.message;
      } catch {
        /*
          여기 닿는 것은 브라우저가 못 읽은 사진(`createImageBitmap`)이다 — 액션이 던진 것은 `actionAnswer` 가
          받았다. 우리 문장 하나로 선다.
        */
        message = UNREADABLE_PHOTO;
      }

      if (message !== null) {
        /* 이 장과 아직 안 간 뒤의 장을 걷는다 — 앞서 올라간 장은 그대로다 */
        const rest = batch.slice(index);
        const dropped = new Set(rest.map((one) => one.key));
        setUploads((was) => was.filter((upload) => !dropped.has(upload.key)));
        failed(message);
        break;
      }

      sent += 1;
      setUploads((was) => was.map((upload) => (upload.key === key ? { ...upload, done: true } : upload)));
      done.say(sent === 1 ? '사진을 저장했어요' : `사진 ${sent}장을 저장했어요`);
    }
    setSending(false);
  };

  /** 「사진 변경」 — 그 장을 기억하고 기기의 사진 창을 연다. 고르면 `replace` 가 받는다 */
  const chooseReplacement = (photo: MyPhoto) => {
    if (busy) return;
    replaceTarget.current = photo.version;
    replaceInput.current?.click();
  };

  const replace = async (file: File | undefined) => {
    const version = replaceTarget.current;
    replaceTarget.current = null;
    if (file === undefined || version === null || busy) return;
    clearFailure();
    setOverflowed(false);
    done.clear();
    settle();

    for (const old of previews.current) URL.revokeObjectURL(old);
    const url = URL.createObjectURL(file);
    previews.current = [url];
    const focus = await frame(url, FOCUS_CENTER);
    if (focus === null) return;

    setReplacing({ version, url, next: null, focus });
    setSending(true);

    let message: string | null = null;
    let next: number | null = null;
    try {
      const result = await sendReplacement(file, version, () => removal.serverPositionOf(version), focus, stored);
      if (result === null) message = REPLACE_FAILED;
      else if (result.ok) next = result.version;
      else message = result.message;
    } catch {
      /* 브라우저가 못 읽은 사진(`createImageBitmap`) — 올리기와 같은 우리 문장 */
      message = UNREADABLE_PHOTO;
    }

    if (message !== null || next === null) {
      setReplacing(null);
      failed(message ?? REPLACE_FAILED);
    } else {
      setReplacing({ version, url, next, focus });
      done.say('사진을 변경했어요');
    }
    setSending(false);
  };

  return {
    busy,
    sending,
    overflowed,
    /** 빈 칸보다 많이 고른 줄을 걷는다 — 다음 누름에서 */
    forgetOverflow: () => setOverflowed(false),
    waiting,
    backdrop,
    replacing,
    replaceInput,
    focusOfPhoto,
    settle,
    pick,
    adjust,
    chooseReplacement,
    replace,
    /** 위치 조정 창(`PhotoFramer`)에 그대로 넘기는 값 */
    framer: {
      open: framing !== null,
      src: framing?.src ?? null,
      focus: framing?.focus ?? FOCUS_CENTER,
      onFocus: (focus: PhotoFocus) => setFraming((was) => (was === null ? was : { ...was, focus })),
      onSave: () => framing?.settle(framing.focus),
      onCancel: () => framing?.settle(null),
    },
  };
}
