'use client';

import { useState, useTransition } from 'react';

import {
  NOTICE_ACK_LABEL,
  NOTICE_ACK_NOTE,
  OPTIONAL_CONSENTS,
  OPTIONAL_CONSENT_NOTE,
  SIGNUP_CODE_NOTE,
} from '@/src/lib/consent';
import { NICKNAME_MAX, NICKNAME_MIN, missingNickname, nicknameKey } from '@/src/lib/profile';

import { checkNickname, completeSignup } from './actions';

const FIELD =
  'h-11 rounded-md border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash sm:h-10';

const BOX =
  'flex cursor-pointer gap-3 rounded-2xl border border-border bg-surface p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-soft';

/**
 * 가입 폼 — **한 번 눌러 셋을 적는다** (ADR 0042).
 *
 * 코드 · 이름 · 안내 확인이 한 요청으로 나간다. 갈라 보내면 그 사이에서 멈춘 계정이
 * 생기고, 관문이 그런 사람을 어디로 보낼지 다시 정해야 한다 — 그 자리를 없애려고 폼을
 * 합친 것이다.
 *
 * ## 두 칸은 **없을 때만 선다**
 *
 * 안내가 새 판본이 되면 이미 가입한 사람도 이 화면으로 돌아온다. 그때 코드와 이름을 다시
 * 물으면 두 번째 코드를 어디서 구하라는 말이 된다. 그 사람에게 남는 것은 확인 하나다.
 *
 * ## 사진과 소개는 여기 없다
 *
 * 필수가 아닌 것을 첫 화면에 세우면 사용자는 그것도 채워야 하는 줄 안다. 둘 다 프로필
 * 화면에 그대로 있고, 언제든 채울 수 있다(PRD §5.1).
 */
export function SignupForm({
  needsCode,
  needsName,
  version,
  scheduleId,
}: {
  needsCode: boolean;
  needsName: boolean;
  version: string;
  scheduleId: number;
}) {
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [chosen, setChosen] = useState<Record<string, boolean>>({
    improvement: false,
    contact: false,
  });
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  /** 마지막으로 확인한 이름과 그 답 — 칸이 바뀌면 답이 이 이름을 안 가리키므로 지운다 */
  const [checked, setChecked] = useState<{ key: string; available: boolean } | null>(null);
  const [checking, startChecking] = useTransition();

  const missing = needsName ? missingNickname(nickname) : null;
  const answer = checked?.key === nicknameKey(nickname) ? checked : null;

  const blocked =
    !acknowledged ||
    missing !== null ||
    (needsCode && code.trim().length === 0) ||
    working;

  const check = () => {
    setFailure(null);
    startChecking(async () => {
      const result = await checkNickname(nickname);
      if (result.ok) setChecked({ key: nicknameKey(nickname), available: result.available });
      else setFailure(result.message);
    });
  };

  const send = () => {
    setFailure(null);
    startWorking(async () => {
      /*
        **성공하면 이 줄 아래로 안 온다.** 서버 액션이 스스로 `/me` 로 보낸다 — 여기서
        보내면 관문이 한 번 더 튕기고, 그 두 번째 튕김이 화면을 비운다.
      */
      const failed = await completeSignup({
        code,
        nickname,
        version,
        /* 이 사람이 **본 안내의 줄**이다. 그 사이에 바뀌었으면 DB 가 거절한다 */
        scheduleId,
        improvement: chosen.improvement === true,
        contact: chosen.contact === true,
      });

      setFailure(failed.message);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {needsCode && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-code" className="text-sm font-semibold">
            테스트 코드
          </label>
          <input
            id="signup-code"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            value={code}
            /* 대문자 하나로만 산다 — DB 검사식과 같은 규칙이라 여기서 미리 맞춘다 */
            onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 24))}
            placeholder="예: SAJU1001"
            className={`${FIELD} w-56 tracking-[0.08em]`}
          />
          <p className="text-xs leading-5 text-muted">{SIGNUP_CODE_NOTE}</p>
        </div>
      )}

      {needsName && (
        <div className="flex flex-col gap-1.5">
          {/*
            **버튼을 라벨 밖에 둔다.** 안에 넣으면 `<label>` 이 칸과 버튼 둘을 함께 물고,
            읽어 주는 도구가 「닉네임」을 어느 것의 이름으로 부를지 사람마다 달라진다.
          */}
          <label htmlFor="signup-nickname" className="text-sm font-semibold">
            닉네임
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="signup-nickname"
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value.slice(0, NICKNAME_MAX))}
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

          {/*
            **확인 결과는 그 이름에 붙는다.** 칸을 고치면 사라진다 — 「쓸 수 있습니다」가
            이미 바뀐 이름 옆에 남아 있으면 그 말이 무엇을 가리키는지 알 수 없다.
          */}
          {answer !== null && (
            <p className="text-sm text-secondary">
              {answer.available ? '쓸 수 있는 닉네임입니다.' : '이미 쓰고 있는 닉네임입니다.'}
            </p>
          )}

          <p className="text-xs leading-5 text-muted">
            앱 안의 모든 자리에서 이 이름으로 불립니다. 프로필 사진과 소개는 선택이고,
            가입하신 뒤 프로필에서 채우실 수 있습니다.
          </p>
        </div>
      )}

      <label htmlFor="notice-ack" className={BOX}>
        <input
          type="checkbox"
          id="notice-ack"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
        />
        <span>
          <span className="block text-sm font-semibold">{NOTICE_ACK_LABEL}</span>
          <span className="mt-1 block text-sm leading-6 text-secondary">{NOTICE_ACK_NOTE}</span>
        </span>
      </label>

      {/*
        **기본값은 꺼짐이다.** 미리 켜 두면 고른 것이 아니라 안 끈 것이 되고, 그것을
        동의라고 부를 수 없다.
      */}
      <fieldset className="flex flex-col gap-3">
        <legend className="float-left w-full text-sm font-semibold">고르실 수 있는 것</legend>
        <p className="mt-1 text-sm leading-6 text-secondary">{OPTIONAL_CONSENT_NOTE}</p>

        {OPTIONAL_CONSENTS.map((one) => (
          <label key={one.key} htmlFor={`consent-${one.key}`} className={BOX}>
            <input
              type="checkbox"
              id={`consent-${one.key}`}
              checked={chosen[one.key] === true}
              onChange={(event) =>
                setChosen((current) => ({ ...current, [one.key]: event.target.checked }))
              }
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-semibold">{one.label}</span>
              <span className="mt-1 block text-sm leading-6 text-secondary">{one.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {failure !== null && (
        <p role="alert" className="text-sm leading-6 text-danger">
          {failure}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={blocked}
          className="h-11 rounded-xl bg-accent px-6 text-sm font-semibold text-on-accent shadow-sm hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {working ? '가입하는 중…' : needsCode ? '가입하고 시작하기' : '확인하고 계속하기'}
        </button>
        {missing !== null && <span className="text-xs text-muted">{missing}</span>}
      </div>
    </div>
  );
}
