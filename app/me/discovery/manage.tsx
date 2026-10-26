'use client';

import { useOptimistic, useState, useTransition } from 'react';

import { actionAnswer } from '../../ui/action-answer';
import { DoneNote, useDoneNote } from '../../ui/done-note';

import { SettingsSwitchRow } from '../settings/card';
import { savePreferGender, setDiscoveryParticipation } from './actions';
import { saveLatest } from './save-latest';
import type { PreferGender } from '@/src/lib/discovery';
import { PREFER_GENDER_KO } from '@/src/lib/discovery/copy';
import { FEEDBACK_UNEXPECTED_NOTE } from '@/src/lib/reading/notes';

import { PREFER_GENDER_ORDER } from './profile';
import { FailureLine } from '../../ui/failure-line';

/**
 * 소개받을 성별 — **「인연」 무리의 둘째 줄이다**(무리는 `app/me/settings/view.tsx` 가 세운다).
 *
 * 별명과 소개는 계정으로 옮겨 갔다(PRD 「앱 안에서 나는 닉네임이다」). 그 둘이 여기 있었을 때는 「인연 찾기에
 * 참여해야 이름이 생기는」 상태였고, 참여하지 않는 사람은 이름 없는 사람이었다.
 *
 * 나이·거리 칸이 없는 이유는 **화면이 말하지 않는다.** 한동안 「나이 조건은 두지
 * 않았습니다…」를 세 줄로 적어 두었는데, 칸이 하나뿐인 폼에서 그것은 **없는 기능을
 * 변호하는 문단**이다. 나이를 못 쓰는 이유는 ADR 0005 가 든다 — 실제로 그 칸이 생기는
 * 날 설명도 칸과 함께 선다.
 *
 * **고르면 곧 저장한다** — 바로 위 「인연 찾기」 스위치와 같은 방식이라 한 화면에 저장 방식이 하나다. 저장하는 동안 또 고르면
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
    <>
      {/*
        **셋을 한 번에 보인다** — 고를 것이 셋뿐이고 하나가 기본값이라 접어 두면 열어 보기 전에는 무엇을 고를 수 있는지 모른다.
        한 덩이 토글이고(`compat-picker.tsx` 의 두 갈래 고르기와 같은 모양) 라디오는 그대로 있다(`sr-only`, 화살표로도 고른다).

        **줄 이름이 묻는 것을 말한다**(「소개받을 성별」) — 무리 이름이 「인연」이라 이 칸이 무엇에 대한 것인지는 줄이 든다. 칸은
        이름 아래 줄 폭을 다 쓴다 — 폰 폭에서 이름 옆에 세우면 칸 셋이 좁아진다.
      */}
      <fieldset
        className="flex flex-col gap-2 px-6 py-3"
        aria-describedby={failure !== null ? 'prefer-gender-failure prefer-gender-help' : 'prefer-gender-help'}
      >
        <legend className="contents">
          <span className="flex items-center justify-between gap-3">
            <span className="text-body font-semibold leading-6 text-foreground">소개받을 성별</span>
            {/*
              저장이 가는 동안의 「저장하는 중…」과, 마지막으로 고른 값까지 저장된 뒤 잠깐 서는 「저장했어요」. 상자(`DoneNote`)는 늘
              서 있고 글자만 바뀌어 화면 읽기도 바뀐 말을 읽는다.
            */}
            <DoneNote className="shrink-0 text-xs text-muted">{progress}</DoneNote>
          </span>
        </legend>
        {/*
          **칸 셋이 같은 폭이다** — 글자 길이대로 두면 하나가 더 중요한 것처럼 보인다. **눌리는 자리는 칸보다 위아래로 4px 씩
          넓다**(`after:`) — 칸은 36px 이고 손가락 과녁은 44px 이다.
        */}
        <div className="grid grid-cols-3 gap-1 rounded-cell bg-surface-sunken p-1">
          {PREFER_GENDER_ORDER.map((value) => (
            <label
              key={value}
              className="relative flex min-h-9 cursor-pointer items-center justify-center rounded-cell px-3 text-sm font-medium text-secondary transition-colors after:absolute after:inset-x-0 after:-inset-y-1 hover:text-foreground has-checked:bg-surface-raised has-checked:text-foreground has-checked:shadow-soft has-focus-visible:ring-2 has-focus-visible:ring-accent"
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
        {/* 고른 값이 어떻게 쓰이는지 — 양쪽 조건이 다 맞아야 소개된다 */}
        <p id="prefer-gender-help" className="text-small leading-5 text-secondary">
          서로 고른 성별이 맞을 때 소개돼요.
        </p>
      </fieldset>

      {failure !== null && (
        <FailureLine id="prefer-gender-failure" className="px-6 pb-3">
          저장하지 못했어요. {failure}
        </FailureLine>
      )}
    </>
  );
}

/**
 * 인연 찾기 참여를 켜고 끄는 자리 — **스위치 하나다**(2026-10-25 설정 목록 재배치).
 *
 * 참여는 기본으로 켜져 있고(PRD 「추천은 여섯 자리 덱이다」), 무엇이 나가는지는 가입 관문이 읽힌다(`notice-v4`). 여기 남은 일은
 * **쉬는 것과, 쉬던 것을 다시 시작하는 것** 둘이고 누르면 곧 적용된다 — 알약 둘(「인연 찾기 쉬기」 · 「인연 찾기 다시 시작」)이던
 * 것을 스위치 하나로 세운다. 스위치의 이름은 보이는 줄 이름 「인연 찾기」다(「인연」 무리의 첫 줄).
 *
 * 설명은 한 줄이고 양쪽 다 **무엇이 남에게 나가는지**(내 프로필과 오행 요약)를 말한다 — 쉬기 직전에도, 다시 켜기 직전에도 그 범위가
 * 보여야 한다. 두 줄이던 것(상태 한 줄 · 범위 한 줄)을 레퍼런스 설정의 한 줄 설명처럼 줄였다(2026-10-26, #838). **제목은 기능의 이름이고 상태는 줄의 글이 든다** — 상태마다 제목이 갈리면(「참여 중」 · 「쉬는 중」)
 * 설정을 찾아온 사람이 두 칸으로 읽는다.
 *
 * 누르면 스위치가 곧 넘어가고(`useOptimistic`), 거절되면 서버가 든 값으로 돌아오며 까닭이 선다.
 */
export function ParticipationToggle({ resting }: { resting: boolean }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();
  const [on, show] = useOptimistic(!resting, (_now: boolean, next: boolean) => next);

  const toggle = (next: boolean) => {
    setFailure(null);
    startWorking(async () => {
      show(next);
      const result = await actionAnswer(setDiscoveryParticipation(next));
      if (!result.ok) setFailure(result.message);
    });
  };

  return (
    <>
      <SettingsSwitchRow
        label="인연 찾기"
        help={
          on
            ? '내 프로필과 오행 요약이 다른 사람에게 소개되고 있어요.'
            : '켜면 내 프로필과 오행 요약이 다른 사람에게 소개돼요.'
        }
        checked={on}
        onChange={toggle}
        busy={working}
      />
      {failure !== null && <FailureLine className="px-6 pb-3">{failure}</FailureLine>}
    </>
  );
}
