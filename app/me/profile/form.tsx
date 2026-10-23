'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import {
  INTRO_MAX,
  NICKNAME_AVAILABLE_NOTE,
  NICKNAME_MAX,
  NICKNAME_MIN,
  NICKNAME_TAKEN_NOTE,
  missingInProfile,
  missingNickname,
  nicknameKey,
  type PhotoUploadMode,
  type ProfileInput,
} from '@/src/lib/profile';
import { FEEDBACK_UNEXPECTED_NOTE } from '@/src/lib/reading/notes';

import { checkNickname } from '../../nickname';
import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_PRIMARY } from '../../ui/buttons';
import { DoneNote, useDoneNote } from '../../ui/done-note';
import { useLeaveGuard } from '../../ui/leave-guard';
import { saveProfile } from './actions';
import { PhotoGrid } from './photo-grid';
import type { MyPhoto } from './photos';
import { FailureLine } from '../../ui/failure-line';
import { FIELD } from '../../ui/fields';

/** 판 한 장 — 무리 지은 목록과 같은 흰 판 */
const PANEL = 'flex flex-col gap-5 rounded-tile border border-border bg-surface p-5 sm:p-6';

const LABEL = 'text-small font-semibold text-secondary';

/** 닉네임을 이만큼 안 고치면 쓸 수 있는지 스스로 묻는다 — 한 글자마다 묻지 않는다 */
const NICKNAME_CHECK_AFTER_MS = 500;

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
 * 그래서 저장 단추의 이름이 「닉네임 · 소개 저장」이고 사진 판 첫 줄이 「사진은 바로 저장돼요」다(대장 40, 2026-10-11).
 *
 * ## 닉네임은 스스로 확인한다 (2026-10-11)
 *
 * 「중복 확인」 단추를 걷었다 — 눌러야 하는지 헷갈렸다. 닉네임을 고치고 `NICKNAME_CHECK_AFTER_MS` 동안 멈추면 그 이름을 묻고
 * 칸 아래에 답을 세운다(「확인하는 중…」 → 「사용할 수 있는 닉네임입니다.」 · 「이미 사용 중인 닉네임입니다.」). 저장도 그 답을
 * 기다린다 — 답이 아직이면 저장이 먼저 묻고, 쓰는 이름이면 저장하지 않고 닉네임 칸에 초점을 둔다. 그래도 막는 것은 DB 다.
 *
 * ## 단추를 잠그지 않는다 (ADR 0160, 2026-10-11)
 *
 * 저장 단추는 이름이 비었거나 고친 것이 없어도 누름을 받는다 — 모양만 가라앉고(`aria-disabled`),
 * 누르면 무엇이 빠졌는지 경고 색으로 말하고 닉네임 칸에 초점을 둔다. 채워지면 그 말은 스스로 걷힌다. 고친 것이 없는 저장은
 * 아무 일도 안 한다 — 할 말이 없다. 닉네임 칸에서 Enter 가 저장을 누른다(`<form>`).
 *
 * ## 고친 채 떠나면 묻는다
 *
 * 닉네임 · 소개를 고치고 저장하지 않은 채 탭을 닫거나 새로고침하면 브라우저가 한 번 묻는다(`useLeaveGuard`, ADR 0166 — 메모 ·
 * 신고와 같은 방식).
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
  uploads,
}: {
  current: ProfileInput;
  photos: readonly MyPhoto[];
  userId: string;
  /** 사진 올리기의 길 — DB 의 스위치(G-120, ADR 0203) */
  uploads: PhotoUploadMode;
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
  const nicknameChanged = nicknameKey(profile.nickname) !== nicknameKey(current.nickname);
  const changed =
    profile.nickname.trim() !== current.nickname.trim() ||
    profile.intro.trim() !== current.intro.trim();

  const answer = nicknameChanged && checked?.key === nicknameKey(profile.nickname) ? checked : null;

  useLeaveGuard(changed);

  /* 고친 이름을 멈춘 뒤에 한 번 묻는다 — 답은 그 이름(`key`)에 붙어 칸이 바뀌면 안 보인다 */
  useEffect(() => {
    if (!nicknameChanged || missingNickname(profile.nickname) !== null) return;
    const name = profile.nickname;
    const timer = window.setTimeout(() => {
      startChecking(async () => {
        const result = await actionAnswer(checkNickname(name));
        if (result.ok) setChecked({ key: nicknameKey(name), available: result.available });
        else setFailure(result.message);
      });
    }, NICKNAME_CHECK_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [profile.nickname, nicknameChanged]);

  /** 빠진 것이 있으면 말하고 그 칸으로 데려간다 — 누름을 받은 뒤에 거절한다 */
  const refused = () => {
    if (missing === null) return false;
    setTried(true);
    nicknameRef.current?.focus();
    return true;
  };

  const save = () => {
    if (saving || refused() || !changed) return;
    /* 쓰는 이름이라고 이미 답했다 — 칸 아래 그 말이 서 있다 */
    if (answer?.available === false) {
      nicknameRef.current?.focus();
      return;
    }
    setFailure(null);
    done.clear();
    startSaving(async () => {
      /* 확인이 아직이면 저장이 먼저 묻는다 — 확인이 끝나야 저장한다 */
      if (nicknameChanged && answer === null) {
        /* 부름이 던져도 아래 저장과 같은 한 문장이다 — 「저장하지 못했어요. 처리하지 못했어요.」로 겹치지 않게 */
        const asked = await actionAnswer(checkNickname(profile.nickname), () => ({
          ok: false as const,
          message: FEEDBACK_UNEXPECTED_NOTE,
        }));
        if (!asked.ok) {
          setFailure(`저장하지 못했어요. ${asked.message}`);
          return;
        }
        setChecked({ key: nicknameKey(profile.nickname), available: asked.available });
        if (!asked.available) {
          nicknameRef.current?.focus();
          return;
        }
      }
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
        uploads={uploads}
      />

      <form
        className={PANEL}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nickname" className={LABEL}>
            닉네임
          </label>
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
            aria-invalid={(tried && missing !== null) || answer?.available === false ? true : undefined}
            aria-describedby="nickname-note"
            className={`${FIELD} min-w-0 sm:max-w-64`}
          />
          {/*
            **확인 결과는 그 이름에 붙는다.** 칸을 고치면 사라진다 — 「쓸 수 있습니다」가
            이미 바뀐 이름 옆에 남아 있으면 그 말이 무엇을 가리키는지 알 수 없다. 빠진 것을 말하는 줄도 여기다 — 단추를
            누른 뒤에만, 경고 색으로. 고치지 않은 이름에는 아무 말도 안 선다. 상자는 늘 서 있어 바뀐 글자를 화면 읽기가 읽는다.
          */}
          <p
            id="nickname-note"
            role="status"
            className={`min-h-5 text-sm ${tried && missing !== null ? 'text-danger' : answer?.available === false ? 'text-danger' : 'text-secondary'}`}
          >
            {tried && missing !== null
              ? missing
              : answer !== null
                ? answer.available
                  ? NICKNAME_AVAILABLE_NOTE
                  : NICKNAME_TAKEN_NOTE
                : checking && nicknameChanged
                  ? '확인하는 중…'
                  : ''}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="intro" className={LABEL}>
            소개 (선택)
          </label>
          <textarea
            id="intro"
            value={profile.intro}
            onChange={(event) =>
              setProfile({ ...profile, intro: event.target.value.slice(0, INTRO_MAX) })
            }
            maxLength={INTRO_MAX}
            rows={3}
            placeholder="간단한 소개를 입력해 주세요"
            aria-describedby="intro-count"
            className={`${FIELD} py-3 leading-6`}
          />
          {/* 쓴 글자 수 — 칸이 상한에서 글자를 더 안 받으므로 그 까닭이 여기 보인다 */}
          <p id="intro-count" className="self-end text-small leading-5 tabular-nums text-secondary">
            {profile.intro.length}/{INTRO_MAX}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:gap-3">
          <button
            type="submit"
            aria-disabled={missing !== null || saving || !changed ? true : undefined}
            className={BUTTON_PRIMARY}
          >
            {/* 사진은 따로 바로 저장된다 — 이 단추가 드는 둘만 이름에 적는다(대장 40) */}
            {saving ? '저장하는 중…' : '닉네임 · 소개 저장'}
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
