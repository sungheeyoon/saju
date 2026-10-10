'use client';

import { useRef, useState, useTransition } from 'react';

import {
  INTRO_MAX,
  NICKNAME_AVAILABLE_NOTE,
  NICKNAME_MAX,
  NICKNAME_MIN,
  NICKNAME_TAKEN_NOTE,
  missingInProfile,
  nicknameKey,
  type ProfileInput,
} from '@/src/lib/profile';
import { FEEDBACK_UNEXPECTED_NOTE } from '@/src/lib/reading/notes';

import { checkNickname } from '../../nickname';
import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_PRIMARY, BUTTON_SECONDARY_SMALL } from '../../ui/buttons';
import { DoneNote, useDoneNote } from '../../ui/done-note';
import { saveProfile } from './actions';
import { PhotoGrid } from './photo-grid';
import type { MyPhoto } from './photos';
import { FailureLine } from '../../ui/failure-line';

/** 입력 칸 — 48px, 크림 바탕 위에서도 칸임이 보이게 흰 면과 테 */
const FIELD =
  'min-h-12 rounded-2xl border border-border-strong bg-surface px-4 text-[16px] outline-none placeholder:text-muted focus:border-foreground focus:ring-2 focus:ring-accent-soft';

/** 판 한 장 — 무리 지은 목록과 같은 흰 판 */
const PANEL = 'flex flex-col gap-5 rounded-[1.5rem] border border-border bg-surface p-5 sm:p-6';

const LABEL = 'text-[13px] font-semibold text-secondary';

/**
 * 프로필을 고치는 자리 — **셋이 한 화면에 있다**(PRD 「이름과 얼굴」).
 *
 * 이름은 가입 폼이 이미 받았고(`/signup`, ADR 0042), 사진과 소개는 거기 없다. 그래서
 * 이 화면이 실제로 하는 일은 **이름을 고치는 것과 나머지 둘을 채우는 것**이다.
 *
 * ## 사진은 따로 저장된다
 *
 * 이름·소개와 한 버튼에 묶지 않았다. 사진은 고르는 순간 결과가 보여야 하는 값이고
 * (줄여서 굽는 데 시간이 든다), 이름은 확인을 거쳐 저장하는 값이다. 한 버튼에 묶으면
 * 사진만 바꾸려는 사람이 이름 확인을 다시 지나야 한다.
 *
 * ## 단추를 잠그지 않는다 (ADR 0160, 2026-10-11)
 *
 * 「중복 확인」 · 「프로필 저장」은 이름이 비었거나 고친 것이 없어도 누름을 받는다 — 모양만 가라앉고(`aria-disabled`),
 * 누르면 무엇이 빠졌는지 경고 색으로 말하고 닉네임 칸에 초점을 둔다. 채워지면 그 말은 스스로 걷힌다. 고친 것이 없는 저장은
 * 아무 일도 안 한다 — 할 말이 없다. 닉네임 칸에서 Enter 가 저장을 누른다(`<form>`).
 *
 * ## 망이 끊겨도 이 화면에 머문다
 *
 * 액션이 값 대신 던지면(연결이 끊기면) 화면째 오류 경계로 가지 않고 단추 곁에 「잠시 뒤 다시 시도해 주세요.」를 세운다 —
 * 적던 이름과 소개가 그대로 남는다(`app/ui/action-answer.ts`).
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
  const [profile, setProfile] = useState(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const done = useDoneNote();
  /** 이름이 빠진 채로 단추를 눌렀나 — 그 뒤에만 무엇이 빠졌는지 말한다 */
  const [tried, setTried] = useState(false);
  const nicknameRef = useRef<HTMLInputElement>(null);

  /** 마지막으로 확인한 이름과 그 답 — 칸이 바뀌면 답이 이 이름을 안 가리키므로 지운다 */
  const [checked, setChecked] = useState<{ key: string; available: boolean } | null>(null);
  const [checking, startChecking] = useTransition();

  const missing = missingInProfile(profile);
  const changed =
    profile.nickname.trim() !== current.nickname.trim() ||
    profile.intro.trim() !== current.intro.trim();

  const answer = checked?.key === nicknameKey(profile.nickname) ? checked : null;

  /** 빠진 것이 있으면 말하고 그 칸으로 데려간다 — 누름을 받은 뒤에 거절한다 */
  const refused = () => {
    if (missing === null) return false;
    setTried(true);
    nicknameRef.current?.focus();
    return true;
  };

  const check = () => {
    if (checking || refused()) return;
    setFailure(null);
    startChecking(async () => {
      const result = await actionAnswer(checkNickname(profile.nickname));
      if (result.ok) setChecked({ key: nicknameKey(profile.nickname), available: result.available });
      else setFailure(result.message);
    });
  };

  const save = () => {
    if (saving || refused() || !changed) return;
    setFailure(null);
    done.clear();
    startSaving(async () => {
      /* 부름이 던지면(망이 끊김) 「저장하지 못했어요.」 뒤에 할 수 있는 일만 — 같은 말이 두 번 서지 않게 */
      const result = await actionAnswer(saveProfile(profile), () => ({ ok: false, message: FEEDBACK_UNEXPECTED_NOTE }));
      if (!result.ok) {
        setFailure(`저장하지 못했어요. ${result.message}`);
        return;
      }
      /* 고친 사람은 이 화면에 그대로 둔다 — 다른 데로 끌고 가면 방금 고친 것을 못 본다 */
      setTried(false);
      done.say('저장했어요');
    });
  };

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      {/*
        사진이 맨 위다 — 프로필을 여는 사람이 먼저 보는 것이 얼굴이고, 고르면 바로 올라간다.
        **넓은 화면에서는 사진이 왼쪽, 닉네임 · 소개 · 저장이 오른쪽에 나란히 선다** — 사진 여섯 칸이 위에 쌓이면 화면 폭을
        다 먹어 820px 높이가 되고 저장이 첫 화면 밖으로 밀렸다(2026-10-09).
        칸은 서버가 새로 준 사진을 그대로 따른다(`useOptimistic`) — 새로 세우지 않아 초점을 잃지 않는다
      */}
      <PhotoGrid
        userId={userId}
        photos={photos}
      />

      <form
        className={PANEL}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
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
              ref={nicknameRef}
              id="nickname"
              type="text"
              value={profile.nickname}
              onChange={(event) =>
                setProfile({ ...profile, nickname: event.target.value.slice(0, NICKNAME_MAX) })
              }
              maxLength={NICKNAME_MAX}
              placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자`}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={tried && missing !== null ? true : undefined}
              aria-describedby="nickname-note"
              className={`${FIELD} min-w-0 flex-1 sm:max-w-64`}
            />
            <button
              type="button"
              onClick={check}
              aria-disabled={checking || missing !== null ? true : undefined}
              className={`${BUTTON_SECONDARY_SMALL} min-h-12 shrink-0 aria-disabled:opacity-55`}
            >
              {checking ? '확인하는 중…' : '중복 확인'}
            </button>
          </div>
          {/*
            **확인 결과는 그 이름에 붙는다.** 칸을 고치면 사라진다 — 「쓸 수 있습니다」가
            이미 바뀐 이름 옆에 남아 있으면 그 말이 무엇을 가리키는지 알 수 없다. 빠진 것을 말하는 줄도 여기다 — 단추를
            누른 뒤에만, 경고 색으로. 상자는 늘 서 있어 바뀐 글자를 화면 읽기가 읽는다.
          */}
          <p
            id="nickname-note"
            role="status"
            className={`text-sm ${tried && missing !== null ? 'text-danger' : answer?.available === false ? 'text-danger' : 'text-secondary'}`}
          >
            {tried && missing !== null
              ? missing
              : answer !== null
                ? answer.available
                  ? NICKNAME_AVAILABLE_NOTE
                  : NICKNAME_TAKEN_NOTE
                : ''}
          </p>
        </div>

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
            type="submit"
            aria-disabled={missing !== null || saving || !changed ? true : undefined}
            className={BUTTON_PRIMARY}
          >
            {saving ? '저장하는 중…' : '프로필 저장'}
          </button>
          {/* 저장이 성공한 뒤에만 잠깐 — 다시 고치기 시작하면 걷힌다(대장 31) */}
          <DoneNote>{changed ? '' : done.note}</DoneNote>
        </div>

        {failure !== null && (
          <FailureLine>{failure}</FailureLine>
        )}
      </form>
    </div>
  );
}
