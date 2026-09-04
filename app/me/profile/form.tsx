'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  INTRO_MAX,
  NICKNAME_MAX,
  NICKNAME_MIN,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_NOTE,
  PHOTO_TYPES,
  initialOf,
  missingInProfile,
  nicknameKey,
  type ProfileInput,
} from '@/src/lib/profile';

import { CARD } from '../../card';
import { checkNickname, clearPhoto, savePhoto, saveProfile } from './actions';

const FIELD =
  'h-11 rounded-md border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash sm:h-10';

const BUTTON =
  'h-11 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-60 sm:h-10';

/**
 * 올린 사진을 줄여서 보낸다 — **폰으로 찍은 사진은 그대로 못 올린다.**
 *
 * 요즘 사진 한 장이 3~5MB 다. 상한(512KB)에 걸려 거절하면 사용자가 할 수 있는 일이
 * 없다 — 「작게 만들어 오세요」는 브라우저가 할 수 있는 일을 사람에게 미루는 말이다.
 * 그래서 긴 변을 512px 로 줄이고 WebP 로 다시 굽는다. 카드와 프로필에 서는 크기가
 * 그만하다.
 *
 * **잘라 내지 않는다.** 비율을 지켜 줄이기만 한다 — 얼굴이 잘리는 자리를 우리가 고르면
 * 그것은 사용자가 고른 사진이 아니다. 동그란 자리에 담을 때만 CSS 가 가운데를 보인다.
 */
async function shrink(file: File): Promise<{ contentType: string; base64: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext('2d');
  if (context === null) throw new Error('사진을 줄이지 못했습니다.');
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
    throw new Error(`사진이 너무 큽니다 — ${Math.round(PHOTO_MAX_BYTES / 1024)}KB까지입니다.`);
  }

  const buffer = new Uint8Array(await chosen.arrayBuffer());
  let binary = '';
  for (const byte of buffer) binary += String.fromCharCode(byte);

  return { contentType, base64: btoa(binary) };
}

/**
 * 프로필을 짓고 고치는 자리 — **한 화면에서 셋을 다 만든다**(§5.1).
 *
 * 이름은 필수이고 사진과 소개는 선택이다. 그 차이가 화면에 보여야 한다 — 선택인 칸에
 * 별표를 안 붙이는 것으로는 부족해서, 필수인 칸에만 「저장하려면 필요합니다」가 붙는다.
 *
 * ## 사진은 따로 저장된다
 *
 * 이름·소개와 한 버튼에 묶지 않았다. 사진은 고르는 순간 결과가 보여야 하는 값이고
 * (줄여서 굽는 데 시간이 든다), 이름은 확인을 거쳐 저장하는 값이다. 한 버튼에 묶으면
 * 사진만 바꾸려는 사람이 이름 확인을 다시 지나야 한다.
 */
export function ProfileForm({
  current,
  hasPhoto,
  userId,
  /** 아직 이름이 없는 사람인가 — 저장한 뒤 어디로 보낼지가 갈린다 */
  naming,
}: {
  current: ProfileInput;
  hasPhoto: boolean;
  userId: string;
  naming: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  /** 마지막으로 확인한 이름과 그 답 — 칸이 바뀌면 답이 이 이름을 안 가리키므로 지운다 */
  const [checked, setChecked] = useState<{ key: string; available: boolean } | null>(null);
  const [checking, startChecking] = useTransition();

  const missing = missingInProfile(profile);
  const changed =
    profile.nickname.trim() !== current.nickname.trim() ||
    profile.intro.trim() !== current.intro.trim();

  const answer = checked?.key === nicknameKey(profile.nickname) ? checked : null;

  const check = () => {
    setFailure(null);
    startChecking(async () => {
      const result = await checkNickname(profile.nickname);
      if (result.ok) setChecked({ key: nicknameKey(profile.nickname), available: result.available });
      else setFailure(result.message);
    });
  };

  const save = () => {
    setFailure(null);
    setSaved(false);
    startSaving(async () => {
      const result = await saveProfile(profile);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      setSaved(true);
      /*
        이름을 짓고 온 사람은 원래 가려던 자리로 보낸다. 고치러 온 사람은 이 화면에
        그대로 둔다 — 고쳤다고 다른 데로 끌고 가면 방금 고친 것을 못 본다.
      */
      if (naming) router.replace('/me');
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <section className={`${CARD} flex flex-col gap-4`}>
        <div className="flex flex-col gap-1.5">
          {/*
            **버튼을 라벨 밖에 둔다.** 안에 넣으면 `<label>` 이 칸과 버튼 둘을 함께 물고,
            읽어 주는 도구가 「닉네임」을 어느 것의 이름으로 부를지 사람마다 달라진다.
          */}
          <label htmlFor="nickname" className="text-xs text-secondary">
            닉네임
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="nickname"
              type="text"
              value={profile.nickname}
              onChange={(event) =>
                setProfile({ ...profile, nickname: event.target.value.slice(0, NICKNAME_MAX) })
              }
              maxLength={NICKNAME_MAX}
              placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자`}
              className={`${FIELD} w-40`}
            />
            <button
              type="button"
              onClick={check}
              disabled={checking || missing !== null}
              className="h-11 rounded-lg border border-border px-3 text-sm text-secondary transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60 sm:h-10"
            >
              {checking ? '확인하는 중…' : '중복 확인'}
            </button>
          </div>
        </div>

        {/*
          **확인 결과는 그 이름에 붙는다.** 칸을 고치면 사라진다 — 「쓸 수 있습니다」가
          이미 바뀐 이름 옆에 남아 있으면 그 말이 무엇을 가리키는지 알 수 없다.
        */}
        {answer !== null && (
          <p className="text-sm text-secondary">
            {answer.available ? '쓸 수 있는 닉네임입니다.' : '이미 쓰고 있는 닉네임입니다.'}
          </p>
        )}

        <p className="text-xs text-muted">
          앱 안의 모든 자리에서 이 이름으로 불립니다. 저장한 가족·친구에게 붙인 부를 이름은
          내 목록 안에서만 쓰는 말이라 여기 들지 않습니다.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-secondary">소개</span>
          <textarea
            value={profile.intro}
            onChange={(event) =>
              setProfile({ ...profile, intro: event.target.value.slice(0, INTRO_MAX) })
            }
            maxLength={INTRO_MAX}
            rows={3}
            placeholder="사주와 무관한 소개입니다 — 비워 두셔도 됩니다"
            className="rounded-md border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={missing !== null || saving || (!changed && !naming)}
            className={BUTTON}
          >
            {saving ? '저장하는 중…' : naming ? '이 이름으로 시작하기' : '프로필 저장'}
          </button>
          {missing !== null && <span className="text-xs text-muted">{missing}</span>}
          {saved && !changed && <span className="text-xs text-muted">저장했습니다</span>}
        </div>

        {failure !== null && <p className="text-sm text-muted">저장하지 못했습니다 — {failure}</p>}
      </section>

      <PhotoField userId={userId} nickname={profile.nickname} hasPhoto={hasPhoto} />
    </div>
  );
}

/**
 * 사진 — **고르면 바로 올라간다.**
 *
 * 「고르기」와 「저장」을 갈라 두면 고르고 저장을 안 한 사람이 생기고, 그 사람은 사진을
 * 올렸다고 알고 있다. 미리 보여 주는 자리도 따로 안 만든다 — 올라간 사진이 곧 미리보기다.
 */
function PhotoField({
  userId,
  nickname,
  hasPhoto,
}: {
  userId: string;
  nickname: string;
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();
  /** 같은 주소를 다시 받게 한다 — 브라우저가 방금 올린 사진 대신 옛것을 그린다 */
  const [stamp, setStamp] = useState(0);

  const pick = (file: File | undefined) => {
    if (file === undefined) return;
    setFailure(null);
    startWorking(async () => {
      try {
        const photo = await shrink(file);
        const result = await savePhoto(photo);
        if (!result.ok) {
          setFailure(result.message);
          return;
        }
        setStamp(Date.now());
        router.refresh();
      } catch (thrown) {
        setFailure(thrown instanceof Error ? thrown.message : '사진을 읽지 못했습니다.');
      }
    });
  };

  const remove = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await clearPhoto();
      if (result.ok) {
        setStamp(Date.now());
        router.refresh();
      } else setFailure(result.message);
    });
  };

  return (
    <section className={`${CARD} flex flex-col gap-4`}>
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="inline-flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-sunken text-3xl font-semibold text-secondary"
        >
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- 바이트를 우리 라우트가 내준다
            <img
              src={`/me/photo/${userId}${stamp === 0 ? '' : `?v=${stamp}`}`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            initialOf(nickname)
          )}
        </span>

        <div className="flex flex-col gap-2">
          <label className="inline-flex">
            <span className="h-11 cursor-pointer rounded-lg border border-border px-3 text-sm leading-[2.75rem] text-secondary transition-colors hover:border-border-strong hover:text-foreground sm:h-10 sm:leading-10">
              {working ? '올리는 중…' : hasPhoto ? '사진 바꾸기' : '사진 올리기'}
            </span>
            <input
              type="file"
              accept={PHOTO_TYPES.join(',')}
              disabled={working}
              onChange={(event) => pick(event.target.files?.[0])}
              className="sr-only"
            />
          </label>
          {hasPhoto && (
            <button
              type="button"
              onClick={remove}
              disabled={working}
              className="self-start text-sm text-secondary underline underline-offset-2 disabled:opacity-60"
            >
              사진 지우기
            </button>
          )}
        </div>
      </div>

      <p className="text-xs leading-5 text-muted">{PHOTO_NOTE}</p>

      {failure !== null && <p className="text-sm text-muted">{failure}</p>}
    </section>
  );
}
