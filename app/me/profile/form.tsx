'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  INTRO_MAX,
  NICKNAME_MAX,
  NICKNAME_MIN,
  missingInProfile,
  nicknameKey,
  type ProfileInput,
} from '@/src/lib/profile';

import { checkNickname } from '../../nickname';
import { BUTTON_PRIMARY, BUTTON_SECONDARY_SMALL } from '../../ui/buttons';
import { saveProfile } from './actions';
import { PhotoGrid } from './photo-grid';
import type { MyPhoto } from './photos';

/** 입력 칸 — 48px, 크림 바탕 위에서도 칸임이 보이게 흰 면과 테 */
const FIELD =
  'min-h-12 rounded-2xl border border-border-strong bg-surface px-4 text-[15px] outline-none placeholder:text-muted focus:border-foreground focus:ring-2 focus:ring-accent-soft';

/** 판 한 장 — 무리 지은 목록과 같은 흰 판 */
const PANEL = 'flex flex-col gap-5 rounded-[1.5rem] border border-border bg-surface p-5 sm:p-6';

const LABEL = 'text-[13px] font-semibold text-secondary';

/**
 * 프로필을 고치는 자리 — **셋이 한 화면에 있다**(§5.1).
 *
 * 이름은 가입 폼이 이미 받았고(`/signup`, ADR 0042), 사진과 소개는 거기 없다. 그래서
 * 이 화면이 실제로 하는 일은 **이름을 고치는 것과 나머지 둘을 채우는 것**이다.
 *
 * ## 사진은 따로 저장된다
 *
 * 이름·소개와 한 버튼에 묶지 않았다. 사진은 고르는 순간 결과가 보여야 하는 값이고
 * (줄여서 굽는 데 시간이 든다), 이름은 확인을 거쳐 저장하는 값이다. 한 버튼에 묶으면
 * 사진만 바꾸려는 사람이 이름 확인을 다시 지나야 한다.
 */
export function ProfileForm({
  current,
  photos,
  userId,
}: {
  current: ProfileInput;
  photos: readonly MyPhoto[];
  userId: string;
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
      /* 고친 사람은 이 화면에 그대로 둔다 — 다른 데로 끌고 가면 방금 고친 것을 못 본다 */
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/*
        사진이 맨 위다 — 프로필을 여는 사람이 먼저 보는 것이 얼굴이고, 고르면 바로 올라간다.
        칸은 서버가 새로 준 사진을 그대로 따른다(`useOptimistic`) — 새로 세우지 않아 초점을 잃지 않는다
      */}
      <PhotoGrid
        userId={userId}
        photos={photos}
      />

      <section className={PANEL}>
        <div className="flex flex-col gap-1.5">
          {/*
            **버튼을 라벨 밖에 둔다.** 안에 넣으면 `<label>` 이 칸과 버튼 둘을 함께 물고,
            읽어 주는 도구가 「닉네임」을 어느 것의 이름으로 부를지 사람마다 달라진다.
          */}
          <label htmlFor="nickname" className={LABEL}>
            닉네임
          </label>
          <div className="flex items-center gap-2">
            <input
              id="nickname"
              type="text"
              value={profile.nickname}
              onChange={(event) =>
                setProfile({ ...profile, nickname: event.target.value.slice(0, NICKNAME_MAX) })
              }
              maxLength={NICKNAME_MAX}
              placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자`}
              className={`${FIELD} min-w-0 flex-1 sm:max-w-64`}
            />
            <button
              type="button"
              onClick={check}
              disabled={checking || missing !== null}
              className={`${BUTTON_SECONDARY_SMALL} min-h-12 shrink-0`}
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
          <p role="status" className={`-mt-3 text-sm ${answer.available ? 'text-secondary' : 'text-danger'}`}>
            {answer.available ? '쓸 수 있는 닉네임입니다.' : '이미 쓰고 있는 닉네임입니다.'}
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>소개 (선택)</span>
          <textarea
            value={profile.intro}
            onChange={(event) =>
              setProfile({ ...profile, intro: event.target.value.slice(0, INTRO_MAX) })
            }
            maxLength={INTRO_MAX}
            rows={3}
            placeholder="간단한 소개를 입력해 주세요"
            className={`${FIELD} py-3 leading-6`}
          />
        </label>

        <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={save}
            disabled={missing !== null || saving || !changed}
            className={BUTTON_PRIMARY}
          >
            {saving ? '저장하는 중…' : '프로필 저장'}
          </button>
          {missing !== null && <span className="text-[13px] text-muted">{missing}</span>}
          {saved && !changed && (
            <span role="status" className="text-[13px] text-secondary">
              저장했습니다
            </span>
          )}
        </div>

        {failure !== null && (
          <p role="alert" className="text-sm text-danger">
            저장하지 못했습니다 — {failure}
          </p>
        )}
      </section>
    </div>
  );
}
