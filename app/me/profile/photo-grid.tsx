'use client';

import { useRouter } from 'next/navigation';
import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  PHOTO_MAX_EDGE,
  PHOTO_NOTE,
  PHOTO_TYPES,
  movedPhotos,
} from '@/src/lib/profile';

import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_TERTIARY } from '../../ui/buttons';
import { DoneNote, useDoneNote } from '../../ui/done-note';
import { addPhoto, movePhoto, removePhoto } from './actions';
import type { MyPhoto } from './photos';

/** 길게 누름 — 이만큼 손가락이 머물면 사진이 들린다 */
const LIFT_AFTER_MS = 350;
/** 들리기 전에 이만큼 움직이면 스크롤로 본다 — 들지 않는다 */
const SCROLL_SLOP_PX = 10;
/** 지운 장을 되돌릴 수 있는 동안 — 이 시간이 지나야 서버에서 지운다 */
const UNDO_MS = 5000;
/** 빈 칸보다 많이 골랐을 때 — 앞의 장만 올리고 이 한 줄을 남긴다 */
const PHOTO_LIMIT_NOTE = `${PHOTO_MAX_COUNT}장까지 올릴 수 있어요`;
/** 사진 올리기를 막은, 우리가 안 쓴 문장 — 우리 문장 하나로 선다(`app/db-error.boundary.test.ts`) */
const UNREADABLE_PHOTO = '사진을 열지 못했어요. 다른 사진을 골라 주세요.';

/**
 * 올린 사진을 줄여서 보낸다 — **폰으로 찍은 사진은 그대로 못 올린다.**
 *
 * 요즘 사진 한 장이 3~5MB 다. 상한(512KB)에 걸려 거절하면 사용자가 할 수 있는 일이
 * 없다 — 「작게 만들어 오세요」는 브라우저가 할 수 있는 일을 사람에게 미루는 말이다.
 * 그래서 긴 변을 512px 로 줄이고 WebP 로 다시 굽는다. 카드와 프로필에 서는 크기가
 * 그만하다.
 *
 * **잘라 내지 않는다.** 비율을 지켜 줄이기만 한다 — 얼굴이 잘리는 자리를 우리가 고르면
 * 그것은 사용자가 고른 사진이 아니다. 칸에 담을 때만 CSS 가 가운데를 보인다.
 */
async function shrink(
  file: File,
): Promise<{ ok: true; contentType: string; base64: string } | { ok: false; message: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext('2d');
  if (context === null) return { ok: false, message: '사진을 줄이지 못했어요. 다른 사진을 골라 주세요.' };
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const baked = (type: string) =>
    new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.85));

  /*
    **WebP 를 못 구우면 JPEG 로 물러선다**(운영자 2026-09-30). 못 굽는 브라우저의 `toBlob` 은 요청한 형식 대신 PNG 를
    내준다 — 사진을 PNG 로 구우면 512px 한 장이 상한(512KB)을 넘기 쉬워 「사진이 너무 커요」로 떨어졌다. 그래서 받은
    형식이 WebP 가 아니면 같은 캔버스를 JPEG(같은 품질 0.85)로 다시 굽는다. 그것도 안 되면 원본을 그대로 보낸다 —
    상한은 아래에서 다시 본다.
  */
  const webp = await baked('image/webp');
  const blob = webp?.type === 'image/webp' ? webp : await baked('image/jpeg');
  const chosen = blob ?? file;
  const contentType = (PHOTO_TYPES as readonly string[]).includes(chosen.type)
    ? chosen.type
    : 'image/jpeg';

  if (chosen.size > PHOTO_MAX_BYTES) {
    return {
      ok: false,
      message: `사진이 너무 커요. ${Math.round(PHOTO_MAX_BYTES / 1024)}KB 이하 사진을 골라 주세요.`,
    };
  }

  const buffer = new Uint8Array(await chosen.arrayBuffer());
  let binary = '';
  for (const byte of buffer) binary += String.fromCharCode(byte);

  return { ok: true, contentType, base64: btoa(binary) };
}

/** 들린 사진 하나 — 어디서 들었고, 지금 어느 칸 위에 있고, 손가락이 얼마나 움직였나 */
type Lift = { from: number; over: number; dx: number; dy: number };

/** 고른 순간 칸에 서는 기기의 사진 — 서버가 그 장을 내줄 때까지의 미리보기 */
type Upload = { key: number; url: string; done: boolean };

/**
 * 사진 여섯 칸 — **첫 칸이 두 배라 대표 사진으로 읽힌다**(G-60, 운영자 2026-09-25 시안).
 *
 * - 사진 칸을 **길게 누르면 들리고**, 끌어 다른 사진 칸에 두면 그 자리로 옮겨 앉는다 — 사이의 장이
 *   한 칸씩 밀린다(`movedPhotos` · DB 의 `move_my_photo` 가 같은 뜻). 키보드는 ← → 로 한 칸씩.
 * - × 가 그 장을 내린다. 뒤의 장이 당겨 앉는다.
 * - 빈 칸의 + 가 올린다. 어느 빈 칸을 눌러도 **맨 뒤에** 앉는다 — 자리는 빈틈없이 1..k 다.
 *
 * **고르면 바로 올라간다.** 「고르기」와 「저장」을 갈라 두면 고르고 저장을 안 한 사람이 생기고,
 * 그 사람은 사진을 올렸다고 알고 있다.
 *
 * ## 올렸는지 눈으로 안다 (운영자 2026-10-11 「올라간 건지 애매하다」)
 *
 * - **고른 순간 그 칸에 기기의 사진이 미리보기로 선다** — 「올리는 중…」 덮개를 쓰고. 한 장이 끝나면 덮개가 걷히고 아래
 *   상태 줄이 「사진을 올렸어요」를 잠깐 말한다(`app/ui/done-note.tsx`). 여러 장이면 **장마다 따로** 걷힌다 — 올리기는
 *   전이(`startTransition`) 밖에서 돈다. 한 전이로 묶으면 그 안의 화면 갱신이 마지막 장까지 기다려 한꺼번에 섰다.
 * - 실패하면 그 칸과 아직 안 간 뒤의 칸이 걷히고 까닭이 선다. 앞서 올라간 장은 그대로이고 상태 줄이 몇 장을 올렸는지 말한다.
 * - 빈 칸보다 많이 고르면 앞의 장만 올리고 「6장까지 올릴 수 있어요」가 남는다 — 말없이 버리지 않는다.
 *
 * ## 지우기는 되돌릴 수 있다
 *
 * × 를 누르면 그 장이 곧바로 칸에서 빠지고 상태 줄에 「사진을 지웠어요 · 실행 취소」가 `UNDO_MS` 동안 선다. **서버에서는
 * 그 시간이 지나야 지운다**(화면의 늦은 지우기). 실행 취소는 아무 요청도 안 보낸다 — 지웠다가 다시 올리는 것이 아니라서
 * 하루 올리기 한도(ADR 0125)를 깎지 않는다. 다른 누름(올리기 · 옮기기 · 다른 장 지우기)이 오면 기다리던 지우기를 먼저
 * 보낸다 — 되돌릴 수 있는 장은 하나다. 화면을 떠나면(다른 화면으로 가거나 탭을 닫으면) 그때 보낸다. 탭을 닫는 순간의
 * 요청은 브라우저가 끊을 수 있다 — 그러면 그 장은 남는다(지워지지 않은 쪽으로 틀린다).
 *
 * 순서는 서버 답을 기다리지 않고 먼저 옮겨 그린다(`useOptimistic`). 서버가 거절하면 서버가 준 순서로
 * 돌아가고, 받아들이면 새로 받은 순서가 그 자리를 잇는다. 옮기기 · 지우기가 서버에 보내는 자리는 화면의 칸 번호가 아니라
 * **그 장(판본)이 서버 목록에서 몇 번째인가**로 짓는다 — 지우기를 기다리는 장이 화면에서만 빠져 있어서다.
 *
 * **그림 주소는 서버가 준 자리로 짓는다**(`photo.position`) — 칸의 자리가 아니다. 주소가 자리 번호라
 * (`/me/photo/{id}/{n}?v=`), 옮긴 칸의 새 주소를 서버가 옮기기 전에 받아 가면 **옛 장의 바이트가 새
 * 주소에 1분 캐시된다** — `?v=` 는 맞는데 눈에는 안 옮겨진 그림이 선다. 누름을 600ms 늦춘 e2e 에서
 * 대표 칸이 옛 장을 보였다(2026-09-25). 서버가 준 자리의 주소는 이미 받아 둔 그 장이라 곧바로 선다.
 */
export function PhotoGrid({ userId, photos }: { userId: string; photos: readonly MyPhoto[] }) {
  const router = useRouter();
  const [order, moveInView] = useOptimistic(
    photos,
    (current: readonly MyPhoto[], step: { version: number; onto: number }) =>
      movedPhotos(current, positionOf(current, step.version), positionOf(current, step.onto)),
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();
  const [lift, setLift] = useState<Lift | null>(null);
  const done = useDoneNote();

  /** 고른 장들 — 올라가는 차례대로. 서버 목록에 새 장이 서면 앞에서부터 걷힌다 */
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [sending, setSending] = useState(false);
  /** 빈 칸보다 많이 골랐다 — 다음 누름까지 상태 줄에 남는다 */
  const [overflowed, setOverflowed] = useState(false);
  /** 이번 올리기 전에 서버에 있던 판본 — 이 밖의 판본이 서면 그것이 방금 올린 장이다 */
  const [before, setBefore] = useState<ReadonlySet<number>>(() => new Set());
  const nextKey = useRef(0);

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

  const gridRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /** 옮긴 뒤 초점을 둘 자리 — 그린 뒤에 옮긴다 */
  const focusAfter = useRef<number | null>(null);
  /** 누르기 시작한 자리와 시각을 재는 타이머 — 그리기와 상관없는 값이라 상태에 안 둔다 */
  const press = useRef<{ position: number; x: number; y: number; timer: number | null } | null>(null);
  /** 들린 동안 페이지가 스크롤되지 않게 — 비수동 `touchmove` 가 읽는다 */
  const lifted = useRef(false);

  const shown = order.filter((photo) => !hidden.has(photo.version));
  const total = shown.length;
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
      return upload?.done ? [[photo.version, upload.url] as const] : [];
    }),
  );
  const waiting = uploads.filter((upload, index) => !(upload.done && index < landed));
  const busy = working || sending;
  const inputId = `photo-upload-${userId}`;

  useEffect(() => {
    latest.current = photos;
  }, [photos]);

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

  useEffect(() => {
    if (focusAfter.current === null) return;
    slotRefs.current[focusAfter.current - 1]?.focus();
    focusAfter.current = null;
  }, [order]);

  /* 지운 칸의 × 가 사라지면 초점이 갈 데가 없다 — 「실행 취소」로 옮긴다 */
  useEffect(() => {
    if (undoable !== null) undoRef.current?.focus();
  }, [undoable]);

  /* 누르는 중에 화면을 떠나면 들어 올릴 타이머를 거둔다 */
  useEffect(
    () => () => {
      if (press.current?.timer != null) window.clearTimeout(press.current.timer);
    },
    [],
  );

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

  /*
    옮기기 · 지우기는 화면이 본 **그 장의 판본**을 함께 보낸다(`20261027090000`). 다른 탭이 먼저 목록을 바꿨으면
    DB 가 옮기기를 거절하고 지우기는 지나간다 — 어느 쪽이든 목록을 다시 받아 지금 모양을 그린다. 받아들인 누름은
    액션의 응답이 화면을 다시 그려 오고(`account-changed`), 거절된 누름은 서버가 아무것도 안 무르므로 여기서 다시 읽는다.
    액션 부름이 던지면(망이 끊겼다) `actionAnswer` 가 실패 값으로 접는다 — 화면째 오류 경계로 가지 않는다.
  */
  const failed = (message: string) => {
    setFailure(message);
    router.refresh();
  };

  /*
    지난 올리기의 미리보기를 걷는다 — 다음 누름(옮기기 · 지우기)이 시작될 때. 걷지 않으면 방금 올린 장을 지운 뒤 「서버에 선
    새 장」의 수가 줄어 그 장의 미리보기가 다시 섰다. 올리는 동안에는 두 누름이 안 받아진다(`busy`).
  */
  const settleUploads = () => setUploads([]);

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

  /** `from` · `to` 는 화면의 칸 번호다 */
  const move = (from: number, to: number) => {
    const photo = shown[from - 1];
    const onto = shown[to - 1];
    if (busy || photo === undefined || onto === undefined || from === to) return;
    setFailure(null);
    done.clear();
    settleUploads();
    focusAfter.current = to;
    startWorking(async () => {
      moveInView({ version: photo.version, onto: onto.version });
      await sendRemoval();
      const server = latest.current.filter((one) => !gone.current.has(one.version));
      const result = await actionAnswer(
        movePhoto(positionOf(server, photo.version), positionOf(server, onto.version), photo.version),
      );
      if (!result.ok) failed(result.message);
    });
  };

  const remove = (position: number) => {
    const photo = shown[position - 1];
    if (busy || photo === undefined) return;
    setFailure(null);
    setOverflowed(false);
    done.clear();
    settleUploads();
    /* 앞서 기다리던 지우기는 지금 보낸다 — 되돌릴 수 있는 장은 하나다 */
    void sendRemoval();
    setHidden((was) => new Set(was).add(photo.version));
    setUndoable(photo.version);
    pendingRemoval.current = {
      version: photo.version,
      timer: window.setTimeout(() => void sendRemoval(), UNDO_MS),
    };
  };

  const pick = async (files: FileList | null) => {
    const all = [...(files ?? [])];
    const chosen = all.slice(0, PHOTO_MAX_COUNT - total);
    setFailure(null);
    done.clear();
    setOverflowed(chosen.length < all.length);
    if (chosen.length === 0) return;

    for (const url of previews.current) URL.revokeObjectURL(url);
    const batch = chosen.map((file) => ({ file, key: nextKey.current++, url: URL.createObjectURL(file) }));
    previews.current = batch.map((one) => one.url);
    setBefore(new Set(latest.current.map((photo) => photo.version)));
    setUploads(batch.map(({ key, url }) => ({ key, url, done: false })));
    setSending(true);

    /* 지운 장이 아직 서버에 있으면 여섯 칸이 찼다고 거절된다 — 먼저 보낸다 */
    await sendRemoval();

    let sent = 0;
    for (const [index, { file, key }] of batch.entries()) {
      let message: string | null = null;
      try {
        const shrunk = await shrink(file);
        if (!shrunk.ok) message = shrunk.message;
        else {
          const result = await actionAnswer(addPhoto({ contentType: shrunk.contentType, base64: shrunk.base64 }));
          if (!result.ok) message = result.message;
        }
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
      done.say(sent === 1 ? '사진을 올렸어요' : `사진 ${sent}장을 올렸어요`);
    }
    setSending(false);
  };

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

  const onPointerDown = (position: number) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (busy || event.button !== 0) return;
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    const start = { position, x: event.clientX, y: event.clientY, timer: null as number | null };
    start.timer = window.setTimeout(() => {
      lifted.current = true;
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

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
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

  const photoSlot = (photo: MyPhoto, position: number) => {
    const lifting = lift?.from === position;
    const target = lift !== null && !lifting && lift.over === position;
    return (
      <div data-photo-slot={position} className="relative h-full w-full">
        <button
          type="button"
          ref={(element) => {
            slotRefs.current[position - 1] = element;
          }}
          aria-label={`사진 ${position} / ${total}, 길게 눌러 옮기기`}
          aria-keyshortcuts="ArrowLeft ArrowRight"
          onPointerDown={onPointerDown(position)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={endPress}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            /* 처리하는 동안은 ← → 도 안 받는다 — 끌기와 같은 문턱 */
            if (busy) return;
            if (event.key === 'ArrowLeft' && position > 1) {
              event.preventDefault();
              move(position, position - 1);
            } else if (event.key === 'ArrowRight' && position < total) {
              event.preventDefault();
              move(position, position + 1);
            }
          }}
          className={`block h-full w-full cursor-grab touch-manipulation select-none rounded-2xl bg-surface outline-none [-webkit-touch-callout:none] focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent)_55%,transparent)] ${
            target ? 'ring-4 ring-accent' : ''
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none block h-full w-full transition-transform duration-150 motion-reduce:transition-none ${
              lifting ? 'relative z-20 rounded-2xl shadow-float' : ''
            }`}
            style={{
              ...(lifting && lift !== null ? { transform: `translate(${lift.dx}px, ${lift.dy}px) scale(1.05)` } : {}),
              ...(backdrop.has(photo.version)
                ? { backgroundImage: `url(${backdrop.get(photo.version)})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '1rem' }
                : {}),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 바이트를 우리 라우트가 내준다 */}
            <img
              src={`/me/photo/${userId}/${photo.position}?v=${photo.version}`}
              alt=""
              draggable={false}
              className="h-full w-full rounded-2xl object-cover"
            />
          </span>
        </button>
        <button
          type="button"
          onClick={() => remove(position)}
          disabled={busy}
          aria-label="사진 지우기"
          className="absolute -right-1 -top-1 z-10 grid size-11 place-items-center rounded-full disabled:opacity-55"
        >
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-full bg-foreground text-[15px] leading-none text-surface ring-2 ring-surface"
          >
            ×
          </span>
        </button>
      </div>
    );
  };

  /** 올라가는 중인 장 — 기기의 사진 위에 「올리는 중…」 덮개. 끝나면 덮개만 걷히고, 서버의 장이 오면 그 장으로 바뀐다 */
  const uploadSlot = (upload: Upload) => (
    <div
      aria-hidden="true"
      className="relative h-full w-full overflow-hidden rounded-2xl bg-surface bg-cover bg-center"
      style={{ backgroundImage: `url(${upload.url})` }}
    >
      {!upload.done && (
        <span className="absolute inset-0 grid place-items-center bg-[color-mix(in_srgb,var(--foreground)_45%,transparent)] text-[13px] font-semibold text-surface">
          올리는 중…
        </span>
      )}
    </div>
  );

  const emptySlot = (position: number) => {
    /* 첫 빈 칸만 올리기 칸으로 읽힌다 — 나머지 빈 칸도 누르면 같은 칸을 연다. 앉는 자리는 맨 뒤다 */
    const first = position === total + waiting.length + 1;
    return (
      <label
        htmlFor={inputId}
        aria-hidden={first ? undefined : true}
        className={`grid h-full w-full cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border-strong bg-surface text-2xl font-semibold text-muted ${
          first
            ? 'has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)]'
            : ''
        } ${busy ? 'cursor-progress opacity-60' : ''}`}
      >
        <span aria-hidden="true">+</span>
        {first && (
          <>
            <span className="sr-only">사진 올리기</span>
            <input
              id={inputId}
              type="file"
              multiple
              accept={PHOTO_TYPES.join(',')}
              disabled={busy}
              onChange={(event) => {
                void pick(event.target.files);
                event.target.value = '';
              }}
              className="sr-only"
            />
          </>
        )}
      </label>
    );
  };

  const slot = (position: number) => {
    const photo = shown[position - 1];
    if (photo !== undefined) return photoSlot(photo, position);
    const upload = waiting[position - total - 1];
    return upload === undefined ? emptySlot(position) : uploadSlot(upload);
  };

  /* 한 장이 끝나면 그 말이 잠깐 서고, 아직 남은 장이 있으면 다시 「올리는 중…」으로 돌아온다 */
  const status = undoable !== null ? '사진을 지웠어요' : done.note !== '' ? done.note : sending ? '올리는 중…' : '';

  return (
    <section className="flex flex-col gap-4 rounded-[2rem] bg-cream px-4 py-5 sm:px-6 sm:py-6">
      <div ref={gridRef} className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* 첫 칸 — 두 줄 두 칸을 차지한다 */}
        <div role="group" aria-label="대표 사진" className="col-span-2 row-span-2">
          {slot(1)}
        </div>
        {Array.from({ length: PHOTO_MAX_COUNT - 1 }, (_, index) => index + 2).map((position) => (
          <div key={position} className="aspect-[3/4]">
            {slot(position)}
          </div>
        ))}
      </div>

      {/*
        상태 한 줄 — 올리는 동안 · 끝난 뒤 잠깐 · 지운 뒤 되돌릴 수 있는 동안. 지운 뒤에는 매칭의 실행 취소 띠와 같은 모양이다
        (`app/me/matching/matching-experience.tsx` 의 `Feedback`). 상자는 늘 서 있어 바뀐 글자를 화면 읽기가 읽는다.
      */}
      <div
        className={`flex flex-wrap items-center justify-between gap-x-4 ${
          undoable !== null ? 'rounded-[1.25rem] bg-surface px-4 py-1 ring-1 ring-border' : ''
        }`}
      >
        <DoneNote className={`text-[14px] font-medium leading-5 text-foreground ${undoable !== null ? 'py-2' : ''}`}>
          {status}
          {overflowed && status !== '' && ' · '}
          {overflowed && PHOTO_LIMIT_NOTE}
        </DoneNote>
        {undoable !== null && (
          <button ref={undoRef} type="button" onClick={undo} className={BUTTON_TERTIARY}>
            {/* 매칭의 실행 취소 띠와 같은 글자다(대장 36) */}
            실행 취소
          </button>
        )}
      </div>

      <p className="text-[13px] leading-5 text-cream-ink">{PHOTO_NOTE}</p>
      {failure !== null && (
        <p role="alert" className="text-sm text-danger">
          {failure}
        </p>
      )}
    </section>
  );
}

/** 목록에서 그 판본의 자리(1부터) — 없으면 0 이라 `movedPhotos` 가 그대로 돌려준다 */
function positionOf(list: readonly MyPhoto[], version: number): number {
  return list.findIndex((photo) => photo.version === version) + 1;
}

/** 서버에서 그 장이 지금 몇 번째인가 — 서버가 지웠다고 답한 장은 목록이 새로 오기 전에도 뺀다 */
function serverPosition(list: readonly MyPhoto[], gone: ReadonlySet<number>, version: number): number | null {
  const position = positionOf(
    list.filter((photo) => !gone.has(photo.version)),
    version,
  );
  return position === 0 ? null : position;
}
