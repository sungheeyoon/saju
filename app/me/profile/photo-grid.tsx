'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';

import {
  PHOTO_MAX_COUNT,
  PHOTO_NOTE,
  PHOTO_TYPES,
  FOCUS_CENTER,
  focusPosition,
  movedPhotos,
  type PhotoUploadMode,
} from '@/src/lib/profile';

import { PHOTO_ADD, PHOTO_UPLOADS_PAUSED } from '@/src/lib/account/copy';

import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_TERTIARY } from '../../ui/buttons';
import { DoneNote, useDoneNote } from '../../ui/done-note';
import { movePhoto } from './actions';
import { PHOTO_FRAME_TITLE, PhotoFramer } from './photo-framer';
import { PhotoMenu, type MenuChoice } from './photo-menu';
import { menuAlign, positionOf } from './photo-positions';
import type { MyPhoto } from './photos';
import { usePhotoDrag } from './use-photo-drag';
import { usePhotoRemoval } from './use-photo-removal';
import { usePhotoUploads, type Upload } from './use-photo-uploads';
import { FailureLine } from '../../ui/failure-line';

/** 빈 칸보다 많이 골랐을 때 — 앞의 장만 올리고 이 한 줄을 남긴다 */
const PHOTO_LIMIT_NOTE = `${PHOTO_MAX_COUNT}장까지 올릴 수 있어요`;
/** 사진 판의 첫 줄 — 저장 단추가 사진을 안 든다는 말(대장 40) */
const PHOTO_SAVES_ITSELF = '사진은 바로 저장돼요';

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
export function PhotoGrid({
  userId,
  photos,
  uploads,
}: {
  userId: string;
  photos: readonly MyPhoto[];
  /**
   * 올리기의 길 — DB 의 스위치(G-120, ADR 0204). `s3` 면 저장소로, `db` 면 지금처럼 DB 로 보낸다(`usePhotoUploads`).
   * `paused` 면 첫 줄이 안내로 바뀌고 올리는 자리(빈 칸의 + · 「사진 변경」)가 안 선다 — 옮기기 · 위치 조정 · 지우기는 그대로다.
   * 화면의 값이 낡아도 DB 가 거절하고, 실패를 받은 화면은 목록을 다시 읽어 새 길로 선다(`failed`)
   */
  uploads: PhotoUploadMode;
}) {
  const paused = uploads === 'paused';
  const router = useRouter();
  const [order, moveInView] = useOptimistic(
    photos,
    (current: readonly MyPhoto[], step: { version: number; onto: number }) =>
      movedPhotos(current, positionOf(current, step.version), positionOf(current, step.onto)),
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();
  const done = useDoneNote();

  const slotRefs = useRef<(HTMLElement | null)[]>([]);
  /** 옮긴 뒤 초점을 둘 자리 — 그린 뒤에 옮긴다 */
  const focusAfter = useRef<number | null>(null);

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

  const { hidden, undoable, undoRef, hide, undo, sendRemoval, serverPhotos, serverPositionOf, serverVersions } =
    usePhotoRemoval({ photos, failed });
  const shown = order.filter((photo) => !hidden.has(photo.version));
  const total = shown.length;
  const {
    busy,
    sending,
    overflowed,
    forgetOverflow,
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
    framer,
  } = usePhotoUploads({
    userId,
    stored: uploads === 's3',
    photos,
    total,
    working,
    removal: { sendRemoval, serverPositionOf, serverVersions },
    done,
    clearFailure: () => setFailure(null),
    failed,
  });
  const inputId = `photo-upload-${userId}`;

  useEffect(() => {
    if (focusAfter.current === null) return;
    slotRefs.current[focusAfter.current - 1]?.focus();
    focusAfter.current = null;
  }, [order]);

  /** `from` · `to` 는 화면의 칸 번호다 */
  const move = (from: number, to: number) => {
    const photo = shown[from - 1];
    const onto = shown[to - 1];
    if (busy || photo === undefined || onto === undefined || from === to) return;
    setFailure(null);
    done.clear();
    settle();
    focusAfter.current = to;
    startWorking(async () => {
      moveInView({ version: photo.version, onto: onto.version });
      await sendRemoval();
      const server = serverPhotos();
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
    forgetOverflow();
    done.clear();
    settle();
    hide(photo.version);
  };

  const { lift, gridRef, onPointerDown, onPointerMove, onPointerUp, endPress, takeSwallowedClick } = usePhotoDrag({
    busy,
    total,
    move,
  });

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
      ...(paused ? [] : [{ icon: 'pencil' as const, label: '사진 변경', run: () => chooseReplacement(photo) }]),
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
              if (takeSwallowedClick() || busy) event.preventDefault();
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
                src={`/me/photo/${userId}/${photo.position}?v=${photo.version}&s=card`}
                alt=""
                draggable={false}
                className="h-full w-full rounded-2xl object-cover"
                style={{ objectPosition: focusPosition(focus) }}
              />
            )}
            {covering !== null && covering.next === null && (
              <span className="absolute inset-0 grid place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--foreground)_45%,transparent)] text-small font-semibold text-surface">
                저장 중…
              </span>
            )}
            {position === 1 && (
              /* 대표 딱지 — 화면 읽기에는 첫 칸 무리의 이름(「대표 사진」)이 말한다 */
              <span className="absolute left-2 top-2 rounded-full bg-surface px-2 py-0.5 text-tag font-semibold text-foreground shadow-soft">
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
            className="grid size-7 place-items-center rounded-full bg-foreground text-body leading-none text-surface ring-2 ring-surface"
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
        <span className="absolute inset-0 grid place-items-center bg-[color-mix(in_srgb,var(--foreground)_45%,transparent)] text-small font-semibold text-surface">
          저장 중…
        </span>
      )}
    </div>
  );

  /** 멈춘 동안의 빈 칸 — 누를 것이 없다. 자리만 선다 */
  const restingSlot = () => (
    <div aria-hidden="true" className="h-full w-full rounded-2xl border-2 border-dashed border-border bg-surface" />
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
          {bare && <span className="text-body text-secondary">{PHOTO_ADD}</span>}
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
    if (upload !== undefined) return uploadSlot(upload);
    return paused ? restingSlot() : emptySlot(position);
  };

  /* 한 장이 끝나면 그 말이 잠깐 서고, 아직 남은 장이 있으면 다시 「사진 저장 중…」으로 돌아온다 */
  const status = undoable !== null ? '사진을 지웠어요' : done.note !== '' ? done.note : sending ? '사진 저장 중…' : '';

  return (
    <section className="flex flex-col gap-4 rounded-paper bg-cream px-4 py-5 sm:px-6 sm:py-6">
      {/* 아래 저장 단추는 닉네임 · 소개만 저장한다 — 사진은 고르는 순간 서버에 간다(대장 40) */}
      {paused ? (
        /* 올리기가 멈춘 동안 — 첫 줄이 그 까닭이다(대장 settings-05). DB 의 거절도 같은 글자다 */
        <p className="text-small font-medium leading-5 text-cream-ink">{PHOTO_UPLOADS_PAUSED}</p>
      ) : (
        <p className="text-small font-medium leading-5 text-cream-ink">{PHOTO_SAVES_ITSELF}</p>
      )}
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
          undoable !== null ? 'rounded-row bg-surface px-4 py-1 ring-1 ring-border' : ''
        }`}
      >
        <DoneNote className={`text-note font-medium leading-5 text-foreground ${undoable !== null ? 'py-2' : ''}`}>
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

      <p className="text-small leading-5 text-cream-ink">{PHOTO_NOTE}</p>
      <PhotoFramer {...framer} />
      {failure !== null && (
        <FailureLine>{failure}</FailureLine>
      )}
    </section>
  );
}
