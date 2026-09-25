'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import {
  EMPTY_ANSWERS,
  IMPROVE_LABEL,
  IMPROVE_OPTIONS,
  LIKED_LABEL,
  LIKED_OPTIONS,
  PRICE_FACTORS,
  PRICE_FACTOR_LABEL,
  PRICE_LABEL,
  PRICE_NOTE,
  PRICE_OPTIONS,
  PRICE_STEM,
  PRICE_SUBJECT_LABEL,
  QUESTION,
  SOLE_CHOICES,
  SURVEY_COPY,
  TEXT_LIMIT,
  UNKNOWN_LABEL,
  UNKNOWN_OPTIONS,
  WANT_LABEL,
  WANT_NEW_LABEL,
  WANT_NEW_NOTE,
  WANT_NEW_OPTIONS,
  WANT_OPTIONS,
  afterPicking,
  isAnswered,
  withoutHidden,
  type PriceOption,
  type PriceSubject,
  type SurveyAnswers,
} from '@/src/lib/survey';

import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { saveServiceSurvey } from './actions';
import type { MySurvey, SurveyContext } from './read';
import { TYPE_SECTION } from '../../ui/surfaces';

/**
 * 서비스 설문 폼 — **쓰는 동안 저절로 남고, 제출은 손으로 한다.**
 *
 * ## 자동 임시 저장이 줄이는 것
 *
 * 다음에 들어왔을 때 **다시 처음부터 쓰는 부담**이다. 그것 말고 다른 뜻은 없다 —
 * 끝내 제출하지 않은 사람의 문장을 의견으로 세는 데 쓰지 않는다. 그 규율은 화면의
 * 약속이 아니라 함수의 조건이다: 운영자가 읽는 자리는 `submitted_at is not null` 만
 * 센다(ADR 0062).
 *
 * ## 숨은 문항은 보내기 전에 비운다
 *
 * 화면을 열어 둔 사이에 마지막 풀이권을 쓰면 Q3 이 사라진다. 남아 있던 값을 그대로
 * 보내면 안 물어본 문항의 답이 저장된다. 서버도 같은 것을 하지만(그쪽이 진짜 문이다)
 * 여기서도 하는 것은, 화면에 안 보이는 값이 요청에 실려 나가지 않게 하기 위해서다.
 */
/** 문항 한 장 — 무리 지은 목록과 같은 흰 판 */
const PANEL = 'flex flex-col gap-3 rounded-[1.5rem] border border-border bg-surface p-5 sm:p-6';

/** 문항의 물음 — 본문보다 확실히 크고 굵게. 긴 문장이라 둥근 서체 대신 Pretendard 다 */
const ASK = 'block text-[17px] font-bold leading-7 text-foreground';

/**
 * 고르는 줄 — 줄 전체가 누를 자리(48px)이고, 고르면 먹색 테와 크림 면이 선다. 상자 자체도 남아
 * 있어 고른 것이 색만으로 말해지지 않는다.
 */
const CHOICE =
  'flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-2.5 text-[15px] leading-6 hover:border-border-strong has-checked:border-foreground has-checked:bg-cream has-focus-visible:outline has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-soft';

export function SurveyForm({ context, given }: { context: SurveyContext; given: MySurvey | null }) {
  const [answers, setAnswers] = useState<SurveyAnswers>(given?.answers ?? EMPTY_ANSWERS);
  const [submittedAt, setSubmittedAt] = useState<string | null>(given?.submittedAt ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  /** 마지막으로 서버에 넣은 것 — 안 바뀐 답을 되풀이해 보내지 않는다 */
  const saved = useRef(JSON.stringify(given?.answers ?? EMPTY_ANSWERS));
  const shown = { readSolo: context.readSolo, readPair: context.readPair };
  const open = submittedAt === null || editing;

  useEffect(() => {
    if (!open) return;

    const next = JSON.stringify(answers);
    if (next === saved.current) return;

    /* 손이 멈춘 뒤에 보낸다 — 글자마다 보내면 저장이 타자를 따라다닌다 */
    const timer = setTimeout(() => {
      setDraft('saving');
      void saveServiceSurvey(withoutHidden(answers, shown), false).then((result) => {
        if (result.ok) {
          saved.current = next;
          setDraft('saved');
          return;
        }
        setDraft('failed');
      });
    }, 1200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, open]);

  const send = () => {
    setFailure(null);
    startSending(async () => {
      const result = await saveServiceSurvey(withoutHidden(answers, shown), true);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      saved.current = JSON.stringify(answers);
      setSubmittedAt(result.submittedAt);
      setDraft('idle');
      setEditing(false);
    });
  };

  if (!open) {
    return (
      <section className="flex flex-col gap-4 rounded-[1.5rem] border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className={TYPE_SECTION}>{SURVEY_COPY.thanks}</h2>
          <p className="text-sm leading-6 text-secondary">{SURVEY_COPY.editable}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`${BUTTON_SECONDARY} self-stretch sm:self-start`}
        >
          답 고치기
        </button>
      </section>
    );
  }

  const pick = <K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) =>
    setAnswers((now) => ({ ...now, [key]: value }));

  const asked: PriceSubject[] = [
    ...(context.readSolo ? (['solo'] as const) : []),
    ...(context.readPair ? (['pair'] as const) : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Picks
        question={QUESTION.liked}
        hint={SURVEY_COPY.multiple}
        options={LIKED_OPTIONS}
        label={LIKED_LABEL}
        sole={SOLE_CHOICES.liked}
        picked={answers.liked}
        onPick={(next) => pick('liked', next)}
      />

      <Picks
        question={QUESTION.unknown}
        hint={`${SURVEY_COPY.multiple} · ${SURVEY_COPY.optional}`}
        options={UNKNOWN_OPTIONS}
        label={UNKNOWN_LABEL}
        sole={SOLE_CHOICES.unknown}
        picked={answers.unknown}
        onPick={(next) => pick('unknown', next)}
      />

      <Picks
        question={QUESTION.improve}
        hint={SURVEY_COPY.multiple}
        options={IMPROVE_OPTIONS}
        label={IMPROVE_LABEL}
        sole={SOLE_CHOICES.improve}
        picked={answers.improve}
        onPick={(next) => pick('improve', next)}
      >
        <Writing
          label={QUESTION.improveText}
          limit={TEXT_LIMIT.improve}
          value={answers.improveText}
          onChange={(next) => pick('improveText', next)}
        />
      </Picks>

      <Picks
        question={QUESTION.wants}
        hint={SURVEY_COPY.multiple}
        options={WANT_OPTIONS}
        label={WANT_LABEL}
        sole={SOLE_CHOICES.wants}
        picked={answers.wants}
        onPick={(next) => pick('wants', next)}
      >
        {/*
          **없는 것은 갈라 세운다.** 섞어 두면 곧 나온다고 읽히고, 그것은 우리가 한 적
          없는 약속이 된다 — 안내 한 줄로는 그 읽힘을 못 막는다.
        */}
        <Picks
          question={QUESTION.wantsNew}
          hint={`${SURVEY_COPY.multiple} · ${SURVEY_COPY.optional}`}
          note={WANT_NEW_NOTE}
          options={WANT_NEW_OPTIONS}
          label={WANT_NEW_LABEL}
          sole={SOLE_CHOICES.wantsNew}
          picked={answers.wantsNew}
          onPick={(next) => pick('wantsNew', next)}
          nested
        />
      </Picks>

      {/*
        **읽어 본 종류만 묻는다.** 안 써 본 것의 값은 값이 아니라 인상이다.

        묻는 문장은 **한 번만** 선다. 상품마다 온전한 문장을 세웠더니 서른 자 넘는 같은
        문장에서 낱말 하나만 갈려서 **같은 질문이 두 번 서 있는 것으로 읽혔다.**
      */}
      {asked.length > 0 && (
        <section className={PANEL}>
          <p className={ASK}>{PRICE_STEM}</p>
          <p className="text-[13px] leading-5 text-secondary">{PRICE_NOTE}</p>
          {asked.map((subject) => (
            <fieldset key={subject} className="flex flex-col gap-2 border-t border-border pt-4">
              <legend className="contents">
                <span className="block text-[15px] font-semibold">{PRICE_SUBJECT_LABEL[subject]}</span>
              </legend>
              {PRICE_OPTIONS.map((option) => (
                <label key={option} className={CHOICE}>
                  <input
                    type="radio"
                    checked={
                      (subject === 'solo' ? answers.priceSolo : answers.pricePair) === option
                    }
                    onChange={() =>
                      pick(subject === 'solo' ? 'priceSolo' : 'pricePair', option as PriceOption)
                    }
                    /* 잘못 고른 값을 지울 길 — 같은 것을 다시 누르면 풀린다 */
                    onClick={() => {
                      const now = subject === 'solo' ? answers.priceSolo : answers.pricePair;
                      if (now === option) pick(subject === 'solo' ? 'priceSolo' : 'pricePair', null);
                    }}
                    className="size-5 shrink-0 accent-[var(--accent)]"
                  />
                  <span>{PRICE_LABEL[option]}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </section>
      )}

      {asked.length > 0 && (
        <Picks
          question={QUESTION.priceFactors}
          hint={`${SURVEY_COPY.multiple} · ${SURVEY_COPY.optional}`}
          options={PRICE_FACTORS}
          label={PRICE_FACTOR_LABEL}
          sole={[]}
          picked={answers.priceFactors}
          onPick={(next) => pick('priceFactors', next)}
        />
      )}

      <section className={PANEL}>
        <Writing
          label={QUESTION.freeText}
          limit={TEXT_LIMIT.free}
          value={answers.freeText}
          onChange={(next) => pick('freeText', next)}
        />
      </section>

      <section className="flex flex-col gap-3 px-1">
        <p className="text-[13px] leading-5 text-muted">{SURVEY_COPY.drafting}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={send}
            disabled={sending || !isAnswered(answers)}
            className={BUTTON_PRIMARY}
          >
            {submittedAt === null ? SURVEY_COPY.submit : SURVEY_COPY.resubmit}
          </button>
          <DraftMark state={draft} />
        </div>
        {failure !== null && (
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * 임시 저장이 어디까지 갔나 — **성공도 말한다.**
 *
 * 실패만 말하면 사용자는 저장이 도는지 아닌지를 모른 채 창을 닫는다. 반대로 늘 서
 * 있으면 안 바뀐 화면에 「저장됨」이 박혀 있게 되므로, 한 번이라도 저장한 뒤에만 선다.
 */
function DraftMark({ state }: { state: 'idle' | 'saving' | 'saved' | 'failed' }) {
  if (state === 'idle') return null;

  if (state === 'failed') {
    return (
      <span role="status" className="text-[13px] font-semibold text-danger">
        {SURVEY_COPY.draftFailed} 다시 고치시면 한 번 더 시도합니다.
      </span>
    );
  }

  return (
    <span role="status" className="text-[13px] text-muted">
      {state === 'saving' ? '임시 저장하는 중…' : SURVEY_COPY.draftSaved}
    </span>
  );
}

/** 여러 개 고르는 문항. 단독 항목의 규칙은 `afterPicking` 하나가 든다 */
function Picks<T extends string>({
  question,
  hint,
  note,
  options,
  label,
  sole,
  picked,
  onPick,
  nested = false,
  children,
}: {
  question: string;
  hint: string;
  note?: string;
  options: readonly T[];
  label: Record<T, string>;
  sole: readonly string[];
  picked: readonly T[];
  onPick: (next: T[]) => void;
  nested?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <fieldset className={nested ? 'flex flex-col gap-3 border-t border-border pt-4' : PANEL}>
      <legend className="contents">
        <span className={nested ? 'block text-[15px] font-bold leading-6' : ASK}>{question}</span>
      </legend>
      <p className="text-[13px] text-muted">{hint}</p>
      {note !== undefined && <p className="text-[13px] leading-5 text-secondary">{note}</p>}
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label key={option} className={CHOICE}>
            <input
              type="checkbox"
              checked={picked.includes(option)}
              onChange={() => onPick(afterPicking(picked, option, sole))}
              className="size-5 shrink-0 accent-[var(--accent)]"
            />
            <span>{label[option]}</span>
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}

/** 자유 입력 — **둘뿐이다.** 문항마다 칸을 달면 끝까지 채울 분량이 아니게 된다 */
function Writing({
  label,
  limit,
  value,
  onChange,
}: {
  label: string;
  limit: number;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4 first:border-0 first:pt-0">
      <label className="text-[15px] font-semibold leading-6" htmlFor={`writing-${limit}`}>
        {label}
      </label>
      <p className="text-[13px] text-muted">
        {SURVEY_COPY.optional} · 최대 {limit}자
      </p>
      <textarea
        id={`writing-${limit}`}
        value={value}
        maxLength={limit}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-[15px] leading-6 outline-none focus:border-foreground focus:ring-2 focus:ring-accent-soft"
      />
    </div>
  );
}
