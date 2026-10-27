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
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { DoneNote, useDoneNote } from '../../ui/done-note';
import { movePhoto } from './actions';
import { PHOTO_FRAME_TITLE, PhotoFramer } from './photo-framer';
import type { ActionChoice } from '../../ui/action-sheet';
import { PhotoMenu } from './photo-menu';
import { PhotoViewer } from './photo-viewer';
import { positionOf } from './photo-positions';
import { answerRemoval, PHOTO_REMOVE_CONFIRM, PHOTO_REMOVE_NOTE, PHOTO_REMOVE_TITLE, PHOTO_REMOVED } from './photo-removal';
import type { MyPhoto } from './photos';
import { usePhotoDrag } from './use-photo-drag';
import { usePhotoRemoval } from './use-photo-removal';
import { usePhotoUploads, type Upload } from './use-photo-uploads';
import { FailureLine } from '../../ui/failure-line';
import { Icon } from '../../ui/icons';

/** 빈 칸보다 많이 골랐을 때 — 앞의 장만 올리고 이 한 줄을 남긴다 */
const PHOTO_LIMIT_NOTE = `${PHOTO_MAX_COUNT}장까지 올릴 수 있어요`;
/** 사진 판의 첫 줄 — 저장 단추가 사진을 안 든다는 말(대장 40) */
const PHOTO_SAVES_ITSELF = '사진은 바로 저장돼요';
/** 사진 판의 이름 — 닉네임 · 소개 칸의 이름과 같은 자리(대장 settings-07) */
const PHOTO_SECTION_TITLE = '프로필 사진';
/** 두 장 이상일 때 격자 아래 — 길게 눌러 옮기는 길이 눈에 안 보였다(대장 settings-07) */
const PHOTO_REORDER_HINT = '사진을 길게 눌러 순서를 바꿀 수 있어요';

/**
 * 사진 여섯 칸 — **첫 칸이 두 배라 대표 사진으로 읽힌다**(G-60, 운영자 2026-09-25 시안).
 *
 * - 사진 칸을 **길게 누르면 들리고**, 끌어 다른 사진 칸에 두면 그 자리로 옮겨 앉는다 — 사이의 장이
 *   한 칸씩 밀린다(`movedPhotos` · DB 의 `move_my_photo` 가 같은 뜻). 키보드는 ← → 로 한 칸씩.
 * - 사진 칸을 **누르면 그 장을 크게 본다**(`PhotoViewer` — 폰은 전체 화면, 넓은 화면은 가운데 큰 판, 운영자 2026-10-24). 머리는 왼쪽
 *   위 × · 가운데 「2 / 3」(첫 장이면 「대표」) · 오른쪽 위 「⋯」이고, 좌우로 쓸어넘기면 다른 장이다. 「⋯」가 아래 판(`ActionSheet`)을
 *   연다 — 「대표로 설정」(대표가 아닐 때) · 「사진 변경」 · 「위치 조정」, 선 하나 뒤에 붉은 「삭제」. 누름과 길게 누름을 가른다 —
 *   들린 뒤에 손을 떼면 보기가 안 열린다.
 * - 사진 귀퉁이의 작은 × 는 메뉴의 「삭제」와 같은 일이다 — 둘 다 확인 창을 먼저 연다(ADR 0205). 사진 위에 얹는 단추 꼴
 *   (`ICON_BUTTON_ON_PHOTO_FACE` 와 같은 반투명 검정, 크기만 작게)이라 먹색 큰 원처럼 사진보다 먼저 눈에 띄지 않는다.
 * - 빈 칸의 + 가 올린다. 어느 빈 칸을 눌러도 **맨 뒤에** 앉는다 — 자리는 빈틈없이 1..k 다.
 * - 첫 칸에 「대표」 딱지가 선다. 판 머리에 「프로필 사진」과 찬 장 수(3/6), 두 장 이상이면 격자 아래에 길게 눌러 옮기는 법이 선다.
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
 * ## 지우기는 묻고 나서 한다
 *
 * × · 메뉴의 「삭제」는 확인 창(`ConfirmDialog`, 첫 초점 「취소」)을 연다 — 「사진을 삭제할까요?」 · 「삭제한 사진은 되돌릴 수
 * 없어요.」 · [취소] [삭제] 나란히(운영자 2026-10-23, ADR 0205 · 추기 2026-10-24). 「삭제」를 누르면 창이 「삭제 중…」으로 선 채 서버에서 지우고, 지우면 창이 닫히고 상태 줄이 「사진을 지웠어요」를
 * 잠깐 말한다. 거절되면 창 안에 까닭이 선다. 실행 취소 띠는 없다 — 묻고 나서 또 되돌리기를 세우면 겹친다(ADR 0165 의 3 을 걷었다).
 *
 * 순서는 서버 답을 기다리지 않고 먼저 옮겨 그린다(`useOptimistic`). 서버가 거절하면 서버가 준 순서로
 * 돌아가고, 받아들이면 새로 받은 순서가 그 자리를 잇는다. 옮기기 · 지우기가 서버에 보내는 자리는 화면의 칸 번호가 아니라
 * **그 장(판본)이 서버 목록에서 몇 번째인가**로 짓는다 — 다른 탭이 목록을 바꿨을 수 있어서다.
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
   * 올리기의 길 — DB 의 스위치(G-120, ADR 0203). `s3` 면 저장소로, `db` 면 지금처럼 DB 로 보낸다(`usePhotoUploads`).
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

  const { remove: removeOnServer, serverPhotos, serverPositionOf, serverVersions } = usePhotoRemoval({ photos });
  /** 지울지 묻는 장 — 창이 열려 있는 동안 */
  const [asking, setAsking] = useState<MyPhoto | null>(null);
  /** 묻는 창 안의 실패 줄 — 창은 열린 채 선다 */
  const [askFailure, setAskFailure] = useState<string | null>(null);
  const shown = order;
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
    removal: { serverPositionOf, serverVersions },
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
      const server = serverPhotos();
      const result = await actionAnswer(
        movePhoto(positionOf(server, photo.version), positionOf(server, onto.version), photo.version),
      );
      if (!result.ok) failed(result.message);
    });
  };

  /** × · 메뉴의 「삭제」 — 지우지 않고 먼저 묻는다 */
  const remove = (position: number) => {
    const photo = shown[position - 1];
    if (busy || photo === undefined) return;
    setFailure(null);
    setAskFailure(null);
    forgetOverflow();
    done.clear();
    settle();
    setAsking(photo);
  };

  /** 묻는 창의 답 — 「취소」 · Esc · 바깥 누름은 아무것도 안 보내고, 「삭제」는 그 장을 곧바로 지운다 */
  const answer = (choice: 'cancel' | 'confirm') => {
    if (choice === 'cancel') {
      if (working) return;
      setAsking(null);
      setAskFailure(null);
      return;
    }
    setAskFailure(null);
    startWorking(async () => {
      const result = await answerRemoval(asking?.version ?? null, 'confirm', removeOnServer);
      if (result.open) {
        setAskFailure(result.failure);
        router.refresh();
        return;
      }
      setAsking(null);
      if (result.removed) done.say(PHOTO_REMOVED);
    });
  };

  /** 크게 보는 장의 칸 번호 — 사진 칸을 누르면 선다 */
  const [viewing, setViewing] = useState<number | null>(null);
  /** 크게 보기의 「⋯」 판 — 자주 하는 일이 위(대표로 올리기 · 바꾸기 · 자리 맞추기), 지우기는 선 뒤 맨 아래 */
  const choicesFor = (photo: MyPhoto, position: number): ActionChoice[] => [
    ...(position > 1 ? [{ icon: 'spark' as const, label: '대표로 설정', run: () => move(position, 1) }] : []),
    ...(paused ? [] : [{ icon: 'pencil' as const, label: '사진 변경', run: () => chooseReplacement(photo) }]),
    { icon: 'move', label: PHOTO_FRAME_TITLE, run: () => void adjust(photo) },
    { icon: 'remove', label: '삭제', tone: 'danger' as const, run: () => remove(position) },
  ];

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
    return (
      <div data-photo-slot={position} className="relative h-full w-full">
        <PhotoMenu
          onOpen={() => setViewing(position)}
          opener={{
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
              /* 들었다 놓은 누름 · 처리하는 동안의 누름은 크게 보기를 안 연다 */
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
            className: `block h-full w-full cursor-grab touch-manipulation select-none rounded-cell bg-surface outline-none [-webkit-touch-callout:none] focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent)_55%,transparent)] ${
              target ? 'ring-4 ring-accent' : ''
            }`,
          }}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none relative block h-full w-full transition-transform duration-150 motion-reduce:transition-none ${
              lifting ? 'z-20 rounded-cell shadow-float' : ''
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
                className="h-full w-full rounded-cell object-cover"
                style={{ objectPosition: focusPosition(focus) }}
              />
            )}
            {covering !== null && covering.next === null && (
              <span className="absolute inset-0 grid place-items-center rounded-cell bg-[color-mix(in_srgb,var(--foreground)_45%,transparent)] text-small font-semibold text-surface">
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
        {/* 귀퉁이의 × — 누름 자리는 44px, 보이는 원은 26px 로 사진 안쪽에 앉는다(밖으로 삐져나와 옆 칸과 겹치지 않게) */}
        <button
          type="button"
          onClick={() => remove(position)}
          disabled={busy}
          aria-label="사진 지우기"
          className="absolute right-0 top-0 z-10 grid size-11 place-items-center rounded-full disabled:opacity-55"
        >
          <span
            aria-hidden="true"
            className="grid size-[1.625rem] place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/40 backdrop-blur-sm"
          >
            <Icon name="close" className="size-3.5" />
          </span>
        </button>
      </div>
    );
  };

  /** 올라가는 중인 장 — 기기의 사진 위에 「저장 중…」 덮개. 끝나면 덮개만 걷히고, 서버의 장이 오면 그 장으로 바뀐다 */
  const uploadSlot = (upload: Upload) => (
    <div
      aria-hidden="true"
      className="relative h-full w-full overflow-hidden rounded-cell bg-surface bg-cover"
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
    <div aria-hidden="true" className="h-full w-full rounded-cell border-2 border-dashed border-border bg-surface" />
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
        className={`grid h-full w-full cursor-pointer place-items-center rounded-cell border-2 border-dashed border-border-strong bg-surface text-muted hover:border-accent hover:text-foreground ${
          first
            ? 'has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)]'
            : ''
        } ${busy ? 'cursor-progress opacity-60' : ''}`}
      >
        <span className="flex flex-col items-center gap-2">
          {/* + 는 동그란 면 위에 — 빈 칸이 「누르는 자리」로 읽힌다. 다음에 찰 칸만 먹색, 나머지는 옅게 */}
          <span
            aria-hidden="true"
            className={`grid place-items-center rounded-full ${first ? 'bg-accent text-surface' : 'bg-surface-sunken text-secondary'} ${bare ? 'size-12' : 'size-8'}`}
          >
            <Icon name="plus" className={bare ? 'size-6' : 'size-4.5'} />
          </span>
          {bare && <span className="text-body font-semibold text-secondary">{PHOTO_ADD}</span>}
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
  const status = done.note !== '' ? done.note : sending ? '사진 저장 중…' : '';

  return (
    <section className="flex flex-col gap-4 rounded-card bg-cream px-4 py-5 sm:px-6 sm:py-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-body font-semibold text-foreground">{PHOTO_SECTION_TITLE}</h2>
          {/* 찬 장 수 — 소개 칸의 글자 수(12/300)와 같은 꼴 */}
          <p className="text-small font-medium leading-5 tabular-nums text-cream-ink">
            {total}/{PHOTO_MAX_COUNT}
          </p>
        </div>
        {/* 아래 저장 단추는 닉네임 · 소개만 저장한다 — 사진은 고르는 순간 서버에 간다(대장 40) */}
        {paused ? (
          /* 올리기가 멈춘 동안 — 첫 줄이 그 까닭이다(대장 settings-05). DB 의 거절도 같은 글자다 */
          <p className="text-small font-medium leading-5 text-cream-ink">{PHOTO_UPLOADS_PAUSED}</p>
        ) : (
          <p className="text-small font-medium leading-5 text-cream-ink">{PHOTO_SAVES_ITSELF}</p>
        )}
      </header>
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
          <div key={position} className="aspect-[4/5]">
            {slot(position)}
          </div>
        ))}
      </div>
      {total >= 2 && <p className="-mt-1 text-small leading-5 text-cream-ink">{PHOTO_REORDER_HINT}</p>}

      {/* 상태 한 줄 — 올리는 동안 · 끝난 뒤 잠깐. 상자는 늘 서 있어 바뀐 글자를 화면 읽기가 읽는다 */}
      <DoneNote className="text-note font-medium leading-5 text-foreground">
        {status}
        {overflowed && status !== '' && ' · '}
        {overflowed && PHOTO_LIMIT_NOTE}
      </DoneNote>

      <p className="text-small leading-5 text-cream-ink">{PHOTO_NOTE}</p>
      <PhotoViewer
        userId={userId}
        photos={shown}
        at={viewing}
        onAt={setViewing}
        onClose={() => setViewing(null)}
        choicesFor={choicesFor}
      />
      <PhotoFramer {...framer} />
      {/*
        지울지 묻는 창 — 첫 초점은 「취소」, Esc · 바깥 누름도 「취소」다(ADR 0166). 지우는 동안은 안 닫힌다. 그림 없이 제목 · 한 줄 ·
        나란한 두 단추다 — 카카오톡 · 토스 · 당근 · iOS · 안드로이드의 삭제 확인 창이 다 그 꼴이다(ADR 0205 추기, 2026-10-24)
      */}
      <ConfirmDialog
        open={asking !== null}
        onClose={() => answer('cancel')}
        title={PHOTO_REMOVE_TITLE}
        actions="row"
        confirmLabel={working ? '삭제 중…' : PHOTO_REMOVE_CONFIRM}
        onConfirm={() => answer('confirm')}
        danger
        busy={working}
        failure={askFailure}
        irreversible={PHOTO_REMOVE_NOTE}
      />
      {failure !== null && (
        <FailureLine>{failure}</FailureLine>
      )}
    </section>
  );
}
