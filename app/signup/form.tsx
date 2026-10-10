'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';

import {
  NOTICE_ACK_LABEL,
  NOTICE_ACK_NOTE,
  OPTIONAL_CONSENTS,
  OPTIONAL_CONSENT_NOTE,
  SIGNUP_CODE_NOTE,
  asKoreanDay,
} from '@/src/lib/consent';
import {
  NICKNAME_AVAILABLE_NOTE,
  NICKNAME_MAX,
  NICKNAME_MIN,
  NICKNAME_TAKEN_NOTE,
  missingNickname,
  nicknameKey,
} from '@/src/lib/profile';

import { checkNickname } from '../nickname';
import { BUTTON_PRIMARY, BUTTON_SECONDARY_SMALL } from '../ui/buttons';
import { completeSignup } from './actions';
import type { SignupField } from './refusal';
import { actionAnswer } from '../ui/action-answer';
import { FAILURE_TEXT, FailureLine } from '../ui/failure-line';

/** 입력 칸 — 48px, 프로필 화면과 같은 칸 */
const FIELD =
  'min-h-12 rounded-2xl border border-border-strong bg-surface px-4 text-[16px] outline-none placeholder:text-muted focus:border-foreground focus:ring-2 focus:ring-accent-soft aria-invalid:border-danger';

/**
 * 확인 상자 한 줄 — 줄 전체가 누를 자리이고, 고르면 먹색 테와 크림 면이 선다(상자도 그대로 남는다). 초점 테는 전역 초점 테두리와
 * 같은 섞음(accent 55%, `globals.css`)이다 — `accent-soft` 는 크림 바탕에서 거의 안 보였다
 */
const BOX =
  'flex cursor-pointer gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-border-strong has-checked:border-foreground has-checked:bg-cream has-[[aria-invalid=true]]:border-danger has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)]';

const LABEL = 'text-[15px] font-semibold';

/** 눌렀을 때 코드 칸이 비어 있으면 — 닉네임은 `missingNickname` 이 제 말을 든다 */
const CODE_MISSING = '테스트 코드를 입력해 주세요.';

/** 눌렀을 때 안내 확인을 안 했으면 — 무엇에 표시하는지는 그 칸의 글자를 그대로 부른다 */
const ACK_MISSING = `‘${NOTICE_ACK_LABEL}’에 표시해 주세요.`;

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
 * 화면에 그대로 있고, 언제든 채울 수 있다(PRD 「이름과 얼굴」).
 */
export function SignupForm({
  returnTo,
  needsCode,
  needsName,
  version,
  scheduleId,
  endsOn,
  purgeBy,
}: {
  /** 가입을 마치고 갈 곳 — 관문이 `next` 로 들려 보낸 목적지(ADR 0128) */
  returnTo: string;
  needsCode: boolean;
  needsName: boolean;
  version: string;
  scheduleId: number;
  endsOn: string;
  purgeBy: string;
}) {
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [chosen, setChosen] = useState<Record<string, boolean>>({
    improvement: false,
    contact: false,
  });
  /** 서버의 거절 — 어느 칸의 것인지 알면 그 칸 곁에, 모르면 단추 곁에 선다(`refusal.ts`) */
  const [failure, setFailure] = useState<{ message: string; field: SignupField | null } | null>(null);
  const [working, startWorking] = useTransition();

  /** 마지막으로 확인한 이름과 그 답 — 칸이 바뀌면 답이 이 이름을 안 가리키므로 지운다 */
  const [checked, setChecked] = useState<{ key: string; available: boolean } | null>(null);
  const [checking, startChecking] = useTransition();

  const missing = needsName ? missingNickname(nickname) : null;
  const answer = checked?.key === nicknameKey(nickname) ? checked : null;

  /*
    **단추를 잠그지 않고, 누르면 거절한다** — 내 사주 등록(`app/saju-calculator.tsx`)과 같은 방식이다. 잠근 단추 옆에
    닉네임 규칙만 서 있어, 코드가 비었거나 확인을 안 한 사람은 왜 안 눌리는지 몰랐다(2026-10-09 화면 점검).
    눌렀을 때 **위에서부터 처음 걸린 칸 하나**를 말하고 그 칸으로 초점을 옮긴다. 칸을 고치면 말도 다음 칸으로 넘어간다.
  */
  const [tried, setTried] = useState(false);
  const codeField = useRef<HTMLInputElement>(null);
  const nicknameField = useRef<HTMLInputElement>(null);
  const ackField = useRef<HTMLInputElement>(null);
  const gap: { field: 'code' | 'nickname' | 'ack'; message: string } | null =
    needsCode && code.trim().length === 0
      ? { field: 'code', message: CODE_MISSING }
      : missing !== null
        ? { field: 'nickname', message: missing }
        : !acknowledged
          ? { field: 'ack', message: ACK_MISSING }
          : null;
  const shownGap = tried ? gap : null;
  /** 「중복 확인」을 눌렀는데 닉네임이 규칙에 안 맞았나 — 그 말이 닉네임 칸 아래에 선다 */
  const [checkTried, setCheckTried] = useState(false);
  const refusedHere = (field: SignupField) => failure !== null && failure.field === field;
  const invalid = (field: 'code' | 'nickname' | 'ack') =>
    shownGap?.field === field
      ? { 'aria-invalid': true, 'aria-describedby': 'signup-gap' }
      : field !== 'ack' && refusedHere(field)
        ? { 'aria-invalid': true, 'aria-describedby': `signup-${field}-refused` }
        : field === 'nickname' && checkTried && missing !== null
          ? { 'aria-invalid': true, 'aria-describedby': 'signup-nickname-check' }
          : {};

  /**
   * **「중복 확인」도 잠그지 않는다** — 닉네임이 규칙에 안 맞으면 누른 그때 그 칸 아래에 말하고 칸으로 초점을 옮긴다
   * (`docs/context/copy.md` §8 「거절은 누른 뒤에 말한다」, ADR 0160). 잠가 두면 왜 안 눌리는지를 묻게 된다.
   */
  const check = () => {
    if (missing !== null) {
      setCheckTried(true);
      nicknameField.current?.focus();
      return;
    }
    setCheckTried(false);
    setFailure(null);
    startChecking(async () => {
      const result = await actionAnswer(checkNickname(nickname));
      if (result.ok) setChecked({ key: nicknameKey(nickname), available: result.available });
      else setFailure({ message: result.message, field: 'nickname' });
    });
  };

  const send = () => {
    setFailure(null);
    if (gap !== null) {
      setTried(true);
      ({ code: codeField, nickname: nicknameField, ack: ackField })[gap.field].current?.focus();
      return;
    }
    setTried(false);
    startWorking(async () => {
      /*
        **성공하면 이 줄 아래로 안 온다.** 서버 액션이 스스로 목적지로 보낸다 — 여기서
        보내면 관문이 한 번 더 튕기고, 그 두 번째 튕김이 화면을 비운다.
      */
      const failed = await actionAnswer(
        completeSignup({
          returnTo,
          code,
          nickname,
          version,
          /* 이 사람이 **본 안내의 줄**이다. 그 사이에 바뀌었으면 DB 가 거절한다 */
          scheduleId,
          improvement: chosen.improvement === true,
          contact: chosen.contact === true,
        }),
      );

      const field = 'field' in failed ? failed.field : null;
      setFailure({ message: failed.message, field });
      if (field !== null) ({ code: codeField, nickname: nicknameField })[field].current?.focus();
    });
  };

  return (
    /* 폼이다 — 칸에서 Enter · 자판의 「이동」이 곧 가입이다. 「중복 확인」은 제출이 아니다(`type="button"`) */
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!working) send();
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {needsCode && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-code" className={LABEL}>
            테스트 코드
          </label>
          <input
            id="signup-code"
            ref={codeField}
            {...invalid('code')}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            value={code}
            /* 대문자 하나로만 산다 — DB 검사식과 같은 규칙이라 여기서 미리 맞춘다 */
            onChange={(event) => {
              setCode(event.target.value.toUpperCase().slice(0, 24));
              /* 칸을 고치면 그 칸의 거절은 걷힌다 — 고친 값에 대한 말이 아니다 */
              if (failure?.field === 'code') setFailure(null);
            }}
            placeholder="예: SAJU1001"
            className={`${FIELD} w-full tracking-[0.08em] sm:max-w-64`}
          />
          {refusedHere('code') && (
            <p id="signup-code-refused" role="alert" className={`${FAILURE_TEXT} font-medium`}>
              {failure?.message}
            </p>
          )}
          <p className="text-[13px] leading-5 text-muted">{SIGNUP_CODE_NOTE}</p>
        </div>
      )}

      {needsName && (
        <div className="flex flex-col gap-1.5">
          {/*
            **버튼을 라벨 밖에 둔다.** 안에 넣으면 `<label>` 이 칸과 버튼 둘을 함께 물고,
            읽어 주는 도구가 「닉네임」을 어느 것의 이름으로 부를지 사람마다 달라진다.
          */}
          <label htmlFor="signup-nickname" className={LABEL}>
            닉네임
          </label>
          <div className="flex items-center gap-2">
            <input
              id="signup-nickname"
              ref={nicknameField}
              {...invalid('nickname')}
              type="text"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value.slice(0, NICKNAME_MAX));
                if (failure?.field === 'nickname') setFailure(null);
              }}
              maxLength={NICKNAME_MAX}
              /* 닉네임은 낱말이 아니다 — 자판이 고치거나 첫 글자를 키우거나 밑줄을 긋지 않게 */
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자`}
              className={`${FIELD} min-w-0 flex-1 sm:max-w-64`}
            />
            <button
              type="button"
              onClick={check}
              disabled={checking}
              aria-disabled={missing !== null || undefined}
              className={`${BUTTON_SECONDARY_SMALL} min-h-12 shrink-0`}
            >
              {checking ? '확인하는 중…' : '중복 확인'}
            </button>
          </div>

          {/*
            **확인 결과는 그 이름에 붙는다.** 칸을 고치면 사라진다 — 「쓸 수 있습니다」가
            이미 바뀐 이름 옆에 남아 있으면 그 말이 무엇을 가리키는지 알 수 없다.
          */}
          <p
            role="status"
            className={`text-sm empty:hidden ${answer === null || answer.available ? 'text-secondary' : 'text-danger'}`}
          >
            {answer === null ? '' : answer.available ? NICKNAME_AVAILABLE_NOTE : NICKNAME_TAKEN_NOTE}
          </p>
          {checkTried && missing !== null && (
            <p id="signup-nickname-check" role="alert" className={`${FAILURE_TEXT} font-medium`}>
              {missing}
            </p>
          )}
          {refusedHere('nickname') && (
            <p id="signup-nickname-refused" role="alert" className={`${FAILURE_TEXT} font-medium`}>
              {failure?.message}
            </p>
          )}

          <p className="text-[13px] leading-5 text-muted">
            앱에서는 이 닉네임으로 불려요. 프로필 사진과 소개는 가입한 뒤에 추가할 수
            있어요.
          </p>
        </div>
      )}

      <div className="rounded-[1.25rem] bg-surface-sunken p-4 sm:p-5" aria-labelledby="signup-notice">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <h2 id="signup-notice" className="text-[15px] font-bold">
            가입 전에 확인해 주세요
          </h2>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center text-[13px] font-semibold text-foreground underline decoration-border-strong decoration-2 underline-offset-[6px] hover:decoration-foreground"
          >
            개인정보 처리방침
          </Link>
        </div>
        <ul className="mt-1 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-secondary marker:text-muted">
          <li>구글 이메일과 닉네임, 직접 저장한 사주 정보는 서비스 제공에 사용합니다.</li>
          <li>
            베타는{' '}
            <strong className="font-semibold text-foreground">{asKoreanDay(endsOn)}</strong>에 종료되며,
            저장된 정보는 늦어도{' '}
            <strong className="font-semibold text-foreground">{asKoreanDay(purgeBy)}</strong>까지 삭제합니다.
          </li>
          <li>
            내 사주를 저장하면 인연 찾기에 참여합니다. 참여는 설정에서 언제든 끌 수
            있습니다.
          </li>
        </ul>
      </div>

      <label htmlFor="notice-ack" className={BOX}>
        <input
          type="checkbox"
          id="notice-ack"
          ref={ackField}
          {...invalid('ack')}
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
        <legend className={`float-left w-full ${LABEL}`}>선택 항목</legend>
        <p className="text-[13px] leading-5 text-secondary">{OPTIONAL_CONSENT_NOTE}</p>

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
              {/* 끄면 어떻게 되는지는 **켜기 전에도** 읽힌다 — 세 화면이 같은 줄을 쓴다 */}
              <span className="mt-1 block text-[13px] leading-5 text-muted">{one.erasure}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* 칸을 모르는 거절(안내가 바뀜 · 테스트가 끝남 등)만 여기 — 칸의 거절은 그 칸 아래에 선다 */}
      {failure !== null && failure.field === null && (
        <FailureLine>{failure.message}</FailureLine>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="submit"
          disabled={working}
          aria-describedby={shownGap !== null ? 'signup-gap' : undefined}
          className={BUTTON_PRIMARY}
        >
          {working ? '가입하는 중…' : needsCode ? '가입하고 시작하기' : '확인하고 계속하기'}
        </button>
        {/* 눌렀는데 못 간 이유를 단추 옆에서 말한다 — 누르기 전에는 이 자리가 비어 있다 */}
        {shownGap !== null && (
          <p id="signup-gap" role="alert" className={`${FAILURE_TEXT} font-medium`}>
            {shownGap.message}
          </p>
        )}
      </div>
    </form>
  );
}
