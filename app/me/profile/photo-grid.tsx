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
  FOCUS_CENTER,
  focusPosition,
  movedPhotos,
  type PhotoFocus,
} from '@/src/lib/profile';

import { PHOTO_ADD } from '@/src/lib/account/copy';

import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_TERTIARY } from '../../ui/buttons';
import { useDetailsMenu } from '../../ui/details-menu';
import { DoneNote, useDoneNote } from '../../ui/done-note';
import { Icon, type IconName } from '../../ui/icons';
import { addPhoto, movePhoto, removePhoto, replacePhoto, setPhotoFocus } from './actions';
import { PHOTO_FRAME_TITLE, PhotoFramer } from './photo-framer';
import type { MyPhoto } from './photos';
import { FailureLine } from '../../ui/failure-line';
import { MENU_PANEL } from '../../ui/surfaces';

/** 길게 누름 — 이만큼 손가락이 머물면 사진이 들린다 */
const LIFT_AFTER_MS = 350;
/** 들리기 전에 이만큼 움직이면 스크롤로 본다 — 들지 않는다 */
const SCROLL_SLOP_PX = 10;
/** 지운 장을 되돌릴 수 있는 동안 — 이 시간이 지나야 서버에서 지운다 */
const UNDO_MS = 5000;
/** 빈 칸보다 많이 골랐을 때 — 앞의 장만 올리고 이 한 줄을 남긴다 */
const PHOTO_LIMIT_NOTE = `${PHOTO_MAX_COUNT}장까지 올릴 수 있어요`;
/** 사진 판의 첫 줄 — 저장 단추가 사진을 안 든다는 말(대장 40) */
const PHOTO_SAVES_ITSELF = '사진은 바로 저장돼요';
/** 사진 올리기를 막은, 우리가 안 쓴 문장 — 우리 문장 하나로 선다(`app/db-error.boundary.test.ts`) */
const UNREADABLE_PHOTO = '사진을 열지 못했어요. 다른 사진을 골라 주세요.';
/** 바꾸려던 장이 그 사이 서버 목록에서 빠졌다 — DB 가 낡은 누름에 내는 문장과 같은 글자(`20261202090000`) */
const REPLACE_FAILED = '사진을 바꾸지 못했어요. 다시 시도해 주세요.';
/** 맞추려던 장이 그 사이 서버 목록에서 빠졌다 — DB 가 낡은 누름에 내는 문장과 같은 글자(`20261203090000`) */
const FOCUS_FAILED = '위치를 저장하지 못했어요. 다시 시도해 주세요.';

/** 「위치 조정」이 끝난 말 — 사진 저장의 말과 같은 꼴(대장 settings-01) */
const FOCUS_SAVED = '위치를 저장했어요';

/**
 * 올린 사진을 줄여서 보낸다 — **폰으로 찍은 사진은 그대로 못 올린다.**
 *
 * 요즘 사진 한 장이 3~5MB 다. 상한(512KB)에 걸려 거절하면 사용자가 할 수 있는 일이
 * 없다 — 「작게 만들어 오세요」는 브라우저가 할 수 있는 일을 사람에게 미루는 말이다.
 * 그래서 긴 변을 512px 로 줄이고 WebP 로 다시 굽는다. 카드와 프로필에 서는 크기가
 * 그만하다.
 *
 * **잘라 내지 않는다.** 비율을 지켜 줄이기만 한다 — 얼굴이 잘리는 자리를 우리가 고르면
 * 그것은 사용자가 고른 사진이 아니다. 칸에 담을 때 CSS 가 사람이 고른 자리를 보인다(G-98, `object-position`).
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
type Upload = { key: number; url: string; done: boolean; focus: PhotoFocus };

/**
 * 그 자리에서 바꾸는 장 — `version` 은 바꾸기 전의 장, `next` 는 서버가 답한 새 판본(답 전에는 `null`). 기기의 사진이 옛 장의
 * 칸을 덮고, 새 판본의 장이 서면 그 뒤에 깔린다
 */
type Replacing = { version: number; url: string; next: number | null; focus: PhotoFocus };

/** 열린 위치 조정 창 — 맞출 사진과 지금 자리. 닫히면 `settle` 이 고른 자리(「취소」면 `null`)를 한 번 돌려준다 */
type Framing = { src: string; focus: PhotoFocus; settle: (focus: PhotoFocus | null) => void };

/**
 * 사진 여섯 칸 — **첫 칸이 두 배라 대표 사진으로 읽힌다**(G-60, 운영자 2026-09-25 시안).
 *
 * - 사진 칸을 **길게 누르면 들리고**, 끌어 다른 사진 칸에 두면 그 자리로 옮겨 앉는다 — 사이의 장이
 *   한 칸씩 밀린다(`movedPhotos` · DB 의 `move_my_photo` 가 같은 뜻). 키보드는 ← → 로 한 칸씩.
 * - 사진 칸을 **누르면 메뉴**가 열린다 — 「사진 변경」 · 「대표로 설정」(대표가 아닐 때) · 「삭제」(조율자 지시 2026-10-11).
 *   누름과 길게 누름을 가른다 — 들린 뒤에 손을 떼면 메뉴가 안 열린다. 메뉴는 `<details>` 한 벌(`useDetailsMenu`)이다.
 * - × 가 그 장을 내린다(메뉴의 「삭제」와 같은 일). 뒤의 장이 당겨 앉는다.
 * - 빈 칸의 + 가 올린다. 어느 빈 칸을 눌러도 **맨 뒤에** 앉는다 — 자리는 빈틈없이 1..k 다.
 * - 첫 칸에 「대표」 딱지가 선다.
 *
 * ## 사진 변경은 그 칸에서 바뀐다
 *
 * 기기의 사진을 하나 고르면 그 칸에 미리보기가 「저장 중…」 덮개를 쓰고 서고, 서버가 그 자리의 바이트를 갈아 끼우면
 * (`replace_my_photo`, 한 트랜잭션) 상태 줄이 「사진을 변경했어요」를 잠깐 말한다. 여섯 장이 차도 된다 — 지우고 올리지 않는다.
 * 하루 올리기 한도는 올리기와 같이 한 번 센다. 고른 뒤 올리기 전에 위치 조정 창(`frame`)을 지난다 — 새 사진을 한 장 골랐을 때도 같다(G-98).
 *
 * ## 보일 자리
 *
 * 사진 칸 메뉴의 「위치 조정」이 이미 있는 장의 자리만 다시 맞춘다(`set_my_photo_focus` — 바이트 · 판본 · 하루 한도는 그대로).
 * 고른 자리는 이 칸과 인연 카드 · 아바타가 같이 보인다(`focusPosition`).
 *
 * **고르면 바로 올라간다.** 「고르기」와 「저장」을 갈라 두면 고르고 저장을 안 한 사람이 생기고,
 * 그 사람은 사진을 올렸다고 알고 있다.
 *
 * ## 올렸는지 눈으로 안다 (운영자 2026-10-11 「올라간 건지 애매하다」)
 *
 * - **고른 순간 그 칸에 기기의 사진이 미리보기로 선다** — 「저장 중…」 덮개를 쓰고. 한 장이 끝나면 덮개가 걷히고 아래
 *   상태 줄이 「사진을 저장했어요」를 잠깐 말한다(`app/ui/done-note.tsx`). 여러 장이면 **장마다 따로** 걷힌다 — 올리기는
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
  /** 열린 위치 조정 창 */
  const [framing, setFraming] = useState<Framing | null>(null);
  /**
   * 「위치 조정」으로 고른 자리(판본별) — 서버 목록보다 먼저 그린다. 서버 목록도 곧 같은 자리를 들고 오므로 걷지 않는다 — 실패면
   * 그 장만 걷는다. 판본은 장마다 하나라(바꾸면 새 판본) 다른 장에 번지지 않는다
   */
  const [placed, setPlaced] = useState<ReadonlyMap<number, PhotoFocus>>(() => new Map());
  const [working, startWorking] = useTransition();
  const [lift, setLift] = useState<Lift | null>(null);
  const done = useDoneNote();

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
  const slotRefs = useRef<(HTMLElement | null)[]>([]);
  /** 옮긴 뒤 초점을 둘 자리 — 그린 뒤에 옮긴다 */
  const focusAfter = useRef<number | null>(null);
  /** 누르기 시작한 자리와 시각을 재는 타이머 — 그리기와 상관없는 값이라 상태에 안 둔다 */
  const press = useRef<{ position: number; x: number; y: number; timer: number | null } | null>(null);
  /** 들린 동안 페이지가 스크롤되지 않게 — 비수동 `touchmove` 가 읽는다 */
  const lifted = useRef(false);
  /** 들었다 놓은 뒤의 누름(`click`)은 메뉴를 안 연다 — 길게 누름은 옮기기다 */
  const swallowClick = useRef(false);

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
      return upload?.done ? [[photo.version, { url: upload.url, focus: upload.focus }] as const] : [];
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
  const settleUploads = () => {
    setUploads([]);
    setReplacing(null);
  };

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
    setFailure(null);
    setOverflowed(false);
    done.clear();
    settleUploads();
    const chosen = await frame(`/me/photo/${userId}/${photo.position}?v=${photo.version}`, focusOfPhoto(photo));
    if (chosen === null) return;
    setPlaced((was) => new Map(was).set(photo.version, chosen));
    setSending(true);
    await sendRemoval();
    const position = serverPosition(latest.current, gone.current, photo.version);
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
    setFailure(null);
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
    setBefore(new Set(latest.current.map((photo) => photo.version)));
    setUploads(batch.map(({ key, url, focus }) => ({ key, url, focus, done: false })));
    setSending(true);

    /* 지운 장이 아직 서버에 있으면 여섯 칸이 찼다고 거절된다 — 먼저 보낸다 */
    await sendRemoval();

    let sent = 0;
    for (const [index, { file, key, focus }] of batch.entries()) {
      let message: string | null = null;
      try {
        const shrunk = await shrink(file);
        if (!shrunk.ok) message = shrunk.message;
        else {
          const result = await actionAnswer(addPhoto({ contentType: shrunk.contentType, base64: shrunk.base64, focus }));
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
    setFailure(null);
    setOverflowed(false);
    done.clear();
    settleUploads();

    for (const old of previews.current) URL.revokeObjectURL(old);
    const url = URL.createObjectURL(file);
    previews.current = [url];
    const focus = await frame(url, FOCUS_CENTER);
    if (focus === null) return;

    setReplacing({ version, url, next: null, focus });
    setSending(true);

    /* 지운 장이 아직 서버에 있으면 그 장 뒤의 자리가 하나 밀려 있다 — 먼저 보낸다 */
    await sendRemoval();

    let message: string | null = null;
    let next: number | null = null;
    try {
      const shrunk = await shrink(file);
      const position = serverPosition(latest.current, gone.current, version);
      if (!shrunk.ok) message = shrunk.message;
      else if (position === null) message = REPLACE_FAILED;
      else {
        const result = await actionAnswer(
          replacePhoto({ position, version, contentType: shrunk.contentType, base64: shrunk.base64, focus }),
        );
        if (result.ok) next = result.version;
        else message = result.message;
      }
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

  const photoSlot = (photo: MyPhoto, position: number) => {
    const lifting = lift?.from === position;
    const target = lift !== null && !lifting && lift.over === position;
    /* 바꾸는 중인 칸 — 옛 장 대신 기기의 사진이 서고, 새 판본의 장이 서면 그 뒤에 깔린다 */
    const covering = replacing !== null && replacing.version === photo.version ? replacing : null;
    const replaced = replacing !== null && (replacing.next === photo.version || covering !== null) ? replacing : null;
    const under = replaced?.url ?? backdrop.get(photo.version)?.url;
    const underFocus = replaced?.focus ?? backdrop.get(photo.version)?.focus ?? FOCUS_CENTER;
    const focus = focusOfPhoto(photo);
    const items: MenuChoice[] = [
      { icon: 'pencil', label: '사진 변경', run: () => chooseReplacement(photo) },
      { icon: 'move', label: PHOTO_FRAME_TITLE, run: () => void adjust(photo) },
      ...(position > 1 ? [{ icon: 'spark' as const, label: '대표로 설정', run: () => move(position, 1) }] : []),
      { icon: 'remove', label: '삭제', tone: 'danger' as const, run: () => remove(position) },
    ];
    return (
      <div data-photo-slot={position} className="relative h-full w-full">
        <PhotoMenu
          align={menuAlign(position)}
          items={items}
          summary={{
            ref: (element) => {
              slotRefs.current[position - 1] = element;
            },
            'aria-label': `사진 ${position} / ${total}, 길게 눌러 옮기기`,
            'aria-keyshortcuts': 'ArrowLeft ArrowRight',
            onPointerDown: onPointerDown(position),
            onPointerMove,
            onPointerUp,
            onPointerCancel: endPress,
            onContextMenu: (event) => event.preventDefault(),
            onClick: (event) => {
              /* 들었다 놓은 누름 · 처리하는 동안의 누름은 메뉴를 안 연다 */
              if (swallowClick.current || busy) event.preventDefault();
              swallowClick.current = false;
            },
            onKeyDown: (event) => {
              /* 처리하는 동안은 ← → 도 안 받는다 — 끌기와 같은 문턱 */
              if (busy) return;
              if (event.key === 'ArrowLeft' && position > 1) {
                event.preventDefault();
                move(position, position - 1);
              } else if (event.key === 'ArrowRight' && position < total) {
                event.preventDefault();
                move(position, position + 1);
              }
            },
            className: `block h-full w-full cursor-grab list-none touch-manipulation select-none rounded-2xl bg-surface outline-none [-webkit-touch-callout:none] [&::-webkit-details-marker]:hidden focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent)_55%,transparent)] ${
              target ? 'ring-4 ring-accent' : ''
            }`,
          }}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none relative block h-full w-full transition-transform duration-150 motion-reduce:transition-none ${
              lifting ? 'z-20 rounded-2xl shadow-float' : ''
            }`}
            style={{
              ...(lifting && lift !== null ? { transform: `translate(${lift.dx}px, ${lift.dy}px) scale(1.05)` } : {}),
              ...(under !== undefined
                ? {
                    backgroundImage: `url(${under})`,
                    backgroundSize: 'cover',
                    backgroundPosition: focusPosition(underFocus),
                    borderRadius: '1rem',
                  }
                : {}),
            }}
          >
            {covering === null && (
              /* eslint-disable-next-line @next/next/no-img-element -- 바이트를 우리 라우트가 내준다 */
              <img
                src={`/me/photo/${userId}/${photo.position}?v=${photo.version}`}
                alt=""
                draggable={false}
                className="h-full w-full rounded-2xl object-cover"
                style={{ objectPosition: focusPosition(focus) }}
              />
            )}
            {covering !== null && covering.next === null && (
              <span className="absolute inset-0 grid place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--foreground)_45%,transparent)] text-[13px] font-semibold text-surface">
                저장 중…
              </span>
            )}
            {position === 1 && (
              /* 대표 딱지 — 화면 읽기에는 첫 칸 무리의 이름(「대표 사진」)이 말한다 */
              <span className="absolute left-2 top-2 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-soft">
                대표
              </span>
            )}
          </span>
        </PhotoMenu>
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

  /** 올라가는 중인 장 — 기기의 사진 위에 「저장 중…」 덮개. 끝나면 덮개만 걷히고, 서버의 장이 오면 그 장으로 바뀐다 */
  const uploadSlot = (upload: Upload) => (
    <div
      aria-hidden="true"
      className="relative h-full w-full overflow-hidden rounded-2xl bg-surface bg-cover"
      style={{ backgroundImage: `url(${upload.url})`, backgroundPosition: focusPosition(upload.focus) }}
    >
      {!upload.done && (
        <span className="absolute inset-0 grid place-items-center bg-[color-mix(in_srgb,var(--foreground)_45%,transparent)] text-[13px] font-semibold text-surface">
          저장 중…
        </span>
      )}
    </div>
  );

  const emptySlot = (position: number) => {
    /* 첫 빈 칸만 올리기 칸으로 읽힌다 — 나머지 빈 칸도 누르면 같은 칸을 연다. 앉는 자리는 맨 뒤다 */
    const first = position === total + waiting.length + 1;
    /* 한 장도 없으면 큰 대표 칸에 「+」 아래 「사진 추가」가 눈에도 선다 — 권유 화면 · 알림 없이 길만 보인다(대장 47) */
    const bare = position === 1 && total === 0 && waiting.length === 0;
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
        <span className={bare ? 'flex flex-col items-center gap-1' : undefined}>
          <span aria-hidden="true">+</span>
          {bare && <span className="text-[15px] text-secondary">{PHOTO_ADD}</span>}
        </span>
        {first && (
          <>
            {!bare && <span className="sr-only">{PHOTO_ADD}</span>}
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

  /* 한 장이 끝나면 그 말이 잠깐 서고, 아직 남은 장이 있으면 다시 「사진 저장 중…」으로 돌아온다 */
  const status = undoable !== null ? '사진을 지웠어요' : done.note !== '' ? done.note : sending ? '사진 저장 중…' : '';

  return (
    <section className="flex flex-col gap-4 rounded-[2rem] bg-cream px-4 py-5 sm:px-6 sm:py-6">
      {/* 아래 저장 단추는 닉네임 · 소개만 저장한다 — 사진은 고르는 순간 서버에 간다(대장 40) */}
      <p className="text-[13px] font-medium leading-5 text-cream-ink">{PHOTO_SAVES_ITSELF}</p>
      {/* 「사진 변경」의 기기 사진 창 — 한 장만. 메뉴의 누름이 연다 */}
      <input
        ref={replaceInput}
        type="file"
        accept={PHOTO_TYPES.join(',')}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void replace(event.target.files?.[0]);
          event.target.value = '';
        }}
        className="sr-only"
      />
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
      <PhotoFramer
        open={framing !== null}
        src={framing?.src ?? null}
        focus={framing?.focus ?? FOCUS_CENTER}
        onFocus={(focus) => setFraming((was) => (was === null ? was : { ...was, focus }))}
        onSave={() => framing?.settle(framing.focus)}
        onCancel={() => framing?.settle(null)}
      />
      {failure !== null && (
        <FailureLine>{failure}</FailureLine>
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

/** 사진 칸 메뉴의 한 줄 */
type MenuChoice = { icon: IconName; label: string; tone?: 'danger'; run: () => void };

/**
 * 메뉴 판이 서는 쪽 — 칸이 화면 오른쪽 끝에 있으면 판이 밖으로 안 나가게 오른쪽에 붙인다. 대표 칸은 그 칸 안 왼쪽 위다.
 * 칸의 자리는 세 칸 격자(대표가 두 줄 두 칸)로 정해져 있다 — 2 · 3 은 셋째 열, 4 · 5 · 6 은 셋째 줄.
 */
function menuAlign(position: number): string {
  if (position === 1) return 'left-3 top-3';
  if (position === 4) return 'left-0 top-full mt-1.5';
  if (position === 5) return 'left-1/2 top-full mt-1.5 -translate-x-1/2';
  return 'right-0 top-full mt-1.5';
}

/**
 * 사진 칸 하나의 메뉴 — **사진 자체가 여는 자리다**(`<summary>`). 계정 메뉴 · 사람 관리 메뉴와 같은 `<details>` 한 벌이라
 * 바깥 누름 · Esc 로 닫히고 Esc 면 초점이 그 사진으로 돌아온다(`useDetailsMenu`). 고르면 먼저 닫고 그 일을 한다.
 */
function PhotoMenu({
  summary,
  items,
  align,
  children,
}: {
  summary: Omit<React.ComponentProps<'summary'>, 'ref'> & { ref: (element: HTMLElement | null) => void };
  items: readonly MenuChoice[];
  align: string;
  children: React.ReactNode;
}) {
  const { menu, close } = useDetailsMenu();
  return (
    <details ref={menu} className="group relative h-full w-full">
      <summary {...summary}>{children}</summary>
      <div
        className={`${MENU_PANEL} absolute z-40 flex w-44 flex-col p-1.5 ${align}`}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              close();
              item.run();
            }}
            className={`flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3 text-left text-[15px] font-semibold hover:bg-surface-sunken ${
              item.tone === 'danger' ? 'text-danger' : 'text-foreground'
            }`}
          >
            <Icon name={item.icon} className="size-4.5" />
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}
