'use client';

import { useState, useTransition } from 'react';

import { actionAnswer } from '../../ui/action-answer';
import { DoneNote, useDoneNote } from '../../ui/done-note';

import {
  SETTINGS_PRIMARY,
  SETTINGS_QUIET,
  SETTINGS_ROW,
  SettingsCard,
  SettingsRow,
} from '../settings/card';
import { savePreferGender, setDiscoveryParticipation } from './actions';
import { saveLatest } from './save-latest';
import type { PreferGender } from '@/src/lib/discovery';
import { PREFER_GENDER_KO } from '@/src/lib/discovery/copy';
import { FEEDBACK_UNEXPECTED_NOTE } from '@/src/lib/reading/notes';

import { PREFER_GENDER_ORDER } from './profile';
import { FailureLine } from '../../ui/failure-line';

/**
 * 보고 싶은 상대 — **이 화면에 남은 유일한 칸.**
 *
 * 별명과 소개는 계정으로 옮겨 갔다(PRD 「앱 안에서 나는 닉네임이다」). 그 둘이 여기 있었을 때는 「인연 찾기에
 * 참여해야 이름이 생기는」 상태였고, 참여하지 않는 사람은 이름 없는 사람이었다.
 *
 * 나이·거리 칸이 없는 이유는 **화면이 말하지 않는다.** 한동안 「나이 조건은 두지
 * 않았습니다…」를 세 줄로 적어 두었는데, 칸이 하나뿐인 폼에서 그것은 **없는 기능을
 * 변호하는 문단**이다. 나이를 못 쓰는 이유는 ADR 0005 가 든다 — 실제로 그 칸이 생기는
 * 날 설명도 칸과 함께 선다.
 *
 * **고르면 곧 저장한다** — 바로 아래 인연 찾기 칸과 같은 방식이라 한 화면에 저장 방식이 하나다. 저장하는 동안 또 고르면
 * 마지막 값이 이기고, 실패하면 서버가 든 마지막 값으로 되돌리고 까닭을 보인다 — 차례는 `save-latest.ts`.
 */
export function PreferenceForm({ current }: { current: PreferGender }) {
  const [preferGender, setPreferGender] = useState(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** 마지막으로 고른 값까지 저장된 뒤 잠깐 서는 「저장했어요」 — 서 있는 시간은 `app/ui/done-note.tsx` 가 든다 */
  const done = useDoneNote();
  /** 차례는 `save-latest.ts` 가 든다 — 한 번만 짓는다(상태 세터는 렌더마다 같다) */
  const [save] = useState(() =>
    saveLatest(
      current,
      savePreferGender,
      {
        busy: setSaving,
        saved: () => done.say('저장했어요'),
        failed: (back, message) => {
          setPreferGender(back);
          setFailure(message);
        },
      },
      /* 문이 값 대신 던지면(연결이 끊기면) 까닭을 모른다 — 할 수 있는 일만 말한다 */
      FEEDBACK_UNEXPECTED_NOTE,
    ),
  );
  const choose = (value: PreferGender) => {
    setFailure(null);
    done.clear();
    setPreferGender(value);
    save(value);
  };

  const progress = saving ? '저장하는 중…' : done.note;

  return (
    <SettingsCard title="어떤 상대를 만나볼까요?">
      {/*
        **셋을 한 번에 보인다.** 접힌 고르는 칸이었는데, 고를 것이 셋뿐이고 그중 하나가
        기본값이라 **열어 보지 않으면 무엇을 고를 수 있는지 모르는** 자리였다.

        **한 덩이 토글로 세운다.** 앱의 다른 두 갈래 고르기와 같은 모양이다
        (`compat-picker.tsx` 의 「저장한 사람 / 직접 입력」) — 떨어진 동그라미 셋보다
        「이 중 하나」가 눈에 먼저 온다. 라디오는 그대로 있고(`sr-only`) 화살표로도
        고를 수 있다.

        **묻는 것의 이름을 적는다**(「성별」). 제목이 「어떤 상대를」이라고만 말하므로,
        고르는 값이 무엇에 대한 것인지는 줄이 들어야 한다 — 나이·거리 칸이 생기는 날
        이 이름이 그 자리를 가른다.
      */}
      <fieldset className={SETTINGS_ROW} aria-describedby={failure !== null ? 'prefer-gender-failure' : undefined}>
        <legend className="contents">
          <span className="text-sm font-semibold sm:flex-1">성별</span>
        </legend>
        {/*
          **칸 셋이 같은 폭이다.** 글자 길이대로 두면 「상관없음」이 「남자」의 두 배가
          되어, 고를 것이 셋인데 하나가 더 중요한 것처럼 보인다. 격자로 나누면 가장 긴
          글자가 폭을 정하고 나머지가 그것을 따른다.

          **눌리는 자리는 칸보다 위아래로 4px 씩 넓다**(`after:`). 칸은 36px 이고 손가락 과녁은
          44px 이다. 칸을 키우면 고른 칸의 흰 바탕도 커지므로, 모양은 두고 투명한 덮개만 격자의
          안쪽 여백(`p-1`)까지 내민다.
        */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-sunken p-1 sm:shrink-0">
          {PREFER_GENDER_ORDER.map((value) => (
            <label
              key={value}
              className="relative flex min-h-9 cursor-pointer items-center justify-center rounded-lg px-3 text-sm font-medium text-secondary transition-colors after:absolute after:inset-x-0 after:-inset-y-1 hover:text-foreground has-checked:bg-surface has-checked:text-foreground has-checked:shadow-soft has-focus-visible:ring-2 has-focus-visible:ring-accent"
            >
              <input
                type="radio"
                name="prefer-gender"
                className="sr-only"
                checked={preferGender === value}
                onChange={() => choose(value)}
              />
              <span>{PREFER_GENDER_KO[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/*
        마지막 줄이 이 카드의 꼬리다 — 왼쪽은 고른 값이 어떻게 쓰이는지(양쪽 조건이 다 맞아야 소개된다), 오른쪽은 저장이
        가는 동안의 「저장하는 중…」과, 마지막으로 고른 값까지 저장된 뒤 잠깐 서는 「저장했어요」. 그 상자(`DoneNote`)는 늘 서
        있고 글자만 바뀌어 화면 읽기도 바뀐 말을 읽는다.
      */}
      <SettingsRow note="서로 고른 성별이 맞는 사람끼리 소개돼요.">
        <DoneNote className="text-xs text-muted">{progress}</DoneNote>
      </SettingsRow>

      {failure !== null && (
        <FailureLine id="prefer-gender-failure" className="border-t border-border pt-4">
          저장하지 못했어요. {failure}
        </FailureLine>
      )}
    </SettingsCard>
  );
}

/**
 * 매칭 참여를 켜고 끄는 자리 — **이제 여기가 켜는 자리가 아니다.**
 *
 * 참여는 기본으로 켜져 있고(PRD 「추천은 여섯 자리 덱이다」), 무엇이 나가는지는 가입 관문이 읽힌다
 * (`notice-v4`). 여기 남은 일은 **끄는 것과, 껐던 것을 되돌리는 것** 둘이다.
 *
 * 그래도 목록은 양쪽에 그대로 선다. 끄기 직전에도 무엇을 거두는지 보여야 하고, 되돌리기
 * 직전에도 무엇이 다시 나가는지 보여야 한다 — 두 누름 다 남에게 보이는 범위를 바꾼다.
 */
export function ParticipationToggle({ resting }: { resting: boolean }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const toggle = (on: boolean) => {
    setFailure(null);
    startWorking(async () => {
      const result = await actionAnswer(setDiscoveryParticipation(on));
      if (!result.ok) setFailure(result.message);
    });
  };

  if (!resting) {
    return (
      <SettingsCard title="인연 찾기">
        {/*
          **제목은 기능의 이름이고, 상태는 줄이 든다.** 「인연 찾기 참여 중」·「인연 찾기
          쉬는 중」으로 제목이 갈려 있었다. 같은 칸이 상태마다 다른 이름을 쓰니 설정을
          찾아온 사람이 **두 개의 다른 칸**으로 읽는다.
        */}
        <SettingsRow
          help="현재 다른 사람에게 내 프로필이 소개되고 있어요."
          note="내 프로필과 오행 요약이 인연을 찾는 다른 사람에게 보여요."
        >
          <button
            type="button"
            onClick={() => toggle(false)}
            disabled={working}
            className={SETTINGS_QUIET}
          >
            {working ? '끄는 중…' : '인연 찾기 쉬기'}
          </button>
        </SettingsRow>
        {failure !== null && (
          <FailureLine className="border-t border-border pt-4">{failure}</FailureLine>
        )}
      </SettingsCard>
    );
  }

  /*
    **쉬는 중인 사람에게만 서는 자리다.** 「아직 안 켠 사람」이 없어졌으므로 여기 설 수
    있는 것은 직접 끈 사람뿐이고, 그래서 문장이 권유가 아니라 **지금 상태의 설명**이다.
  */
  return (
    <SettingsCard title="인연 찾기">
      <SettingsRow
        help="지금은 다른 사람에게 내 프로필이 소개되지 않고 있어요."
        note="다시 시작하면 내 프로필과 오행 요약이 인연을 찾는 다른 사람에게 보여요."
      >
        <button
          type="button"
          onClick={() => toggle(true)}
          disabled={working}
          className={SETTINGS_PRIMARY}
        >
          {working ? '켜는 중…' : '인연 찾기 다시 시작'}
        </button>
      </SettingsRow>
      {failure !== null && (
        <FailureLine className="border-t border-border pt-4">{failure}</FailureLine>
      )}
    </SettingsCard>
  );
}
