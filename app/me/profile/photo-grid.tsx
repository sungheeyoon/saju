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

import { addPhoto, movePhoto, removePhoto } from './actions';
import type { MyPhoto } from './photos';

/** 길게 누름 — 이만큼 손가락이 머물면 사진이 들린다 */
const LIFT_AFTER_MS = 350;
/** 들리기 전에 이만큼 움직이면 스크롤로 본다 — 들지 않는다 */
const SCROLL_SLOP_PX = 10;

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
  if (context === null) return { ok: false, message: '사진을 줄이지 못했습니다.' };
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((done) =>
    canvas.toBlob(done, 'image/webp', 0.85),
  );

  /*
    WebP 를 못 굽는 브라우저가 있으면 `toBlob` 이 다른 형식으로 내주거나 아무것도 안
    내준다. 그때는 원본을 그대로 보낸다 — 상한은 아래에서 다시 본다.
  */
  const chosen = blob ?? file;
  const contentType = (PHOTO_TYPES as readonly string[]).includes(chosen.type)
    ? chosen.type
    : 'image/jpeg';

  if (chosen.size > PHOTO_MAX_BYTES) {
    return {
      ok: false,
      message: `사진이 너무 큽니다 — ${Math.round(PHOTO_MAX_BYTES / 1024)}KB까지입니다.`,
    };
  }

  const buffer = new Uint8Array(await chosen.arrayBuffer());
  let binary = '';
  for (const byte of buffer) binary += String.fromCharCode(byte);

  return { ok: true, contentType, base64: btoa(binary) };
}

/** 들린 사진 하나 — 어디서 들었고, 지금 어느 칸 위에 있고, 손가락이 얼마나 움직였나 */
type Lift = { from: number; over: number; dx: number; dy: number };

/**
 * 사진 여섯 칸 — **첫 칸이 두 배라 대표 사진으로 읽힌다**(G-60, 운영자 2026-09-25 시안).
 *
 * - 사진 칸을 **길게 누르면 들리고**, 끌어 다른 사진 칸에 두면 그 자리로 옮겨 앉는다 — 사이의 장이
 *   한 칸씩 밀린다(`movedPhotos` · DB 의 `move_my_photo` 가 같은 뜻). 키보드는 ← → 로 한 칸씩.
 * - × 가 그 장을 내린다. 뒤의 장이 당겨 앉는다.
 * - 빈 칸의 + 가 올린다. 어느 빈 칸을 눌러도 **맨 뒤에** 앉는다 — 자리는 빈틈없이 1..k 다.
 *
 * **고르면 바로 올라간다.** 「고르기」와 「저장」을 갈라 두면 고르고 저장을 안 한 사람이 생기고,
 * 그 사람은 사진을 올렸다고 알고 있다. 올라간 사진이 곧 미리보기다.
 *
 * 순서는 서버 답을 기다리지 않고 먼저 옮겨 그린다(`useOptimistic`). 서버가 거절하면 서버가 준 순서로
 * 돌아가고, 받아들이면 새로 받은 순서가 그 자리를 잇는다.
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
    (current: readonly MyPhoto[], step: { from: number; to: number }) => movedPhotos(current, step.from, step.to),
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();
  const [lift, setLift] = useState<Lift | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /** 옮긴 뒤 초점을 둘 자리 — 그린 뒤에 옮긴다 */
  const focusAfter = useRef<number | null>(null);
  /** 누르기 시작한 자리와 시각을 재는 타이머 — 그리기와 상관없는 값이라 상태에 안 둔다 */
  const press = useRef<{ position: number; x: number; y: number; timer: number | null } | null>(null);
  /** 들린 동안 페이지가 스크롤되지 않게 — 비수동 `touchmove` 가 읽는다 */
  const lifted = useRef(false);

  const total = order.length;
  const inputId = `photo-upload-${userId}`;

  useEffect(() => {
    if (focusAfter.current === null) return;
    slotRefs.current[focusAfter.current - 1]?.focus();
    focusAfter.current = null;
  }, [order]);

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

  const move = (from: number, to: number) => {
    if (from === to || to < 1 || to > total) return;
    setFailure(null);
    focusAfter.current = to;
    startWorking(async () => {
      moveInView({ from, to });
      const result = await movePhoto(from, to);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      router.refresh();
    });
  };

  const remove = (position: number) => {
    setFailure(null);
    startWorking(async () => {
      const result = await removePhoto(position);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      router.refresh();
    });
  };

  const pick = (files: FileList | null) => {
    const chosen = [...(files ?? [])].slice(0, PHOTO_MAX_COUNT - total);
    if (chosen.length === 0) return;
    setFailure(null);
    startWorking(async () => {
      try {
        for (const file of chosen) {
          const shrunk = await shrink(file);
          if (!shrunk.ok) {
            setFailure(shrunk.message);
            break;
          }
          const result = await addPhoto({ contentType: shrunk.contentType, base64: shrunk.base64 });
          if (!result.ok) {
            setFailure(result.message);
            break;
          }
        }
      } catch {
        /*
          여기 닿는 것은 우리가 안 쓴 문장이다 — 브라우저가 못 읽은 사진(`createImageBitmap`)이나
          액션이 던진 오류(운영의 Next 는 영어 안내로 바꿔 보낸다). 우리 문장 하나로 선다
          (`app/db-error.boundary.test.ts`).
        */
        setFailure('사진을 읽지 못했습니다.');
      }
      router.refresh();
    });
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
    if (working || event.button !== 0) return;
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
    const done = lift;
    endPress();
    if (done !== null && done.over !== done.from) move(done.from, done.over);
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
            if (event.key === 'ArrowLeft' && position > 1) {
              event.preventDefault();
              move(position, position - 1);
            } else if (event.key === 'ArrowRight' && position < total) {
              event.preventDefault();
              move(position, position + 1);
            }
          }}
          className={`block h-full w-full cursor-grab touch-manipulation select-none rounded-2xl bg-surface outline-none [-webkit-touch-callout:none] focus-visible:ring-4 focus-visible:ring-accent-soft ${
            target ? 'ring-4 ring-accent' : ''
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none block h-full w-full transition-transform duration-150 motion-reduce:transition-none ${
              lifting ? 'relative z-20 rounded-2xl shadow-[0_18px_36px_-12px_rgba(0,0,0,0.5)]' : ''
            }`}
            style={lifting && lift !== null ? { transform: `translate(${lift.dx}px, ${lift.dy}px) scale(1.05)` } : undefined}
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
          disabled={working}
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

  const emptySlot = (position: number) => {
    /* 첫 빈 칸만 올리기 칸으로 읽힌다 — 나머지 빈 칸도 누르면 같은 칸을 연다. 앉는 자리는 맨 뒤다 */
    const first = position === total + 1;
    return (
      <label
        htmlFor={inputId}
        aria-hidden={first ? undefined : true}
        className={`grid h-full w-full cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border-strong bg-surface text-2xl font-semibold text-muted ${
          first
            ? 'has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-soft'
            : ''
        } ${working ? 'cursor-progress opacity-60' : ''}`}
      >
        <span aria-hidden="true">+</span>
        {first && (
          <>
            <span className="sr-only">{working ? '올리는 중…' : '사진 올리기'}</span>
            <input
              id={inputId}
              type="file"
              multiple
              accept={PHOTO_TYPES.join(',')}
              disabled={working}
              onChange={(event) => {
                pick(event.target.files);
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
    const photo = order[position - 1];
    return photo === undefined ? emptySlot(position) : photoSlot(photo, position);
  };

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

      <p className="text-[13px] leading-5 text-cream-ink">{PHOTO_NOTE}</p>
      {failure !== null && (
        <p role="alert" className="text-sm text-danger">
          {failure}
        </p>
      )}
    </section>
  );
}
