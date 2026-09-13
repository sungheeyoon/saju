'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import {
  CREDIT_INTENTS,
  CREDIT_INTENT_LABEL,
  CREDIT_REASONS,
  CREDIT_REASON_LABEL,
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
  PRICE_QUESTION,
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
  type CreditIntent,
  type PriceOption,
  type PriceSubject,
  type SurveyAnswers,
} from '@/src/lib/survey';

import { CARD } from '../../card';
import { saveServiceSurvey } from './actions';
import type { MySurvey, SurveyContext } from './read';

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
export function SurveyForm({ context, given }: { context: SurveyContext; given: MySurvey | null }) {
  const [answers, setAnswers] = useState<SurveyAnswers>(given?.answers ?? EMPTY_ANSWERS);
  const [submittedAt, setSubmittedAt] = useState<string | null>(given?.submittedAt ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  /** 마지막으로 서버에 넣은 것 — 안 바뀐 답을 되풀이해 보내지 않는다 */
  const saved = useRef(JSON.stringify(given?.answers ?? EMPTY_ANSWERS));
  const shown = { creditsLeft: context.creditsLeft, readSolo: context.readSolo, readPair: context.readPair };
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
      <section className={`${CARD} flex flex-col gap-4`}>
        <div>
          <h2 className="text-base font-bold">{SURVEY_COPY.thanks}</h2>
          <p className="mt-1 text-sm text-secondary">{SURVEY_COPY.editable}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="h-11 self-start rounded-xl border border-border-strong px-4 text-sm font-semibold hover:border-accent hover:text-accent"
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

      {/* **잔액이 0이면 안 선다.** 다 쓴 사람에게 「더 쓸 생각이 있나」는 물을 것이 없다 */}
      {context.creditsLeft > 0 && (
        <One
          question={QUESTION.creditIntent}
          options={CREDIT_INTENTS}
          label={CREDIT_INTENT_LABEL}
          picked={answers.creditIntent}
          onPick={(next) => {
            /* 「더 쓰겠다」로 돌리면 이유 칸이 사라진다 — 남은 값을 데리고 가지 않는다 */
            setAnswers((now) => ({
              ...now,
              creditIntent: next as CreditIntent | null,
              creditReasons: next === 'will_use' || next === null ? [] : now.creditReasons,
            }));
          }}
        >
          {answers.creditIntent !== null && answers.creditIntent !== 'will_use' && (
            <Picks
              question={QUESTION.creditReasons}
              hint={SURVEY_COPY.multiple}
              options={CREDIT_REASONS}
              label={CREDIT_REASON_LABEL}
              sole={[]}
              picked={answers.creditReasons}
              onPick={(next) => pick('creditReasons', next)}
              nested
            />
          )}
        </One>
      )}

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

      {/* **읽어 본 종류만 묻는다.** 안 써 본 것의 값은 값이 아니라 인상이다 */}
      {asked.map((subject) => (
        <One
          key={subject}
          question={PRICE_QUESTION[subject]}
          note={PRICE_NOTE}
          options={PRICE_OPTIONS}
          label={PRICE_LABEL}
          picked={subject === 'solo' ? answers.priceSolo : answers.pricePair}
          onPick={(next) =>
            pick(subject === 'solo' ? 'priceSolo' : 'pricePair', next as PriceOption | null)
          }
        />
      ))}

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

      <section className={`${CARD} flex flex-col gap-3`}>
        <Writing
          label={QUESTION.freeText}
          limit={TEXT_LIMIT.free}
          value={answers.freeText}
          onChange={(next) => pick('freeText', next)}
        />
      </section>

      <section className={`${CARD} flex flex-col gap-3`}>
        <p className="text-xs leading-5 text-muted">{SURVEY_COPY.drafting}</p>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={send}
            disabled={sending || !isAnswered(answers)}
            className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-60"
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
      <span role="status" className="text-xs font-semibold text-danger">
        {SURVEY_COPY.draftFailed} 다시 고치시면 한 번 더 시도합니다.
      </span>
    );
  }

  return (
    <span role="status" className="text-xs text-muted">
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
    <fieldset className={nested ? 'flex flex-col gap-3 border-t border-border pt-4' : `${CARD} flex flex-col gap-3`}>
      <legend className="contents">
        <span className="block text-base font-bold">{question}</span>
      </legend>
      <p className="text-xs text-muted">{hint}</p>
      {note !== undefined && <p className="text-xs leading-5 text-secondary">{note}</p>}
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-sm hover:border-accent has-checked:border-accent has-checked:bg-accent-wash"
          >
            <input
              type="checkbox"
              checked={picked.includes(option)}
              onChange={() => onPick(afterPicking(picked, option, sole))}
              className="size-4 accent-[var(--accent)]"
            />
            <span>{label[option]}</span>
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}

/** 하나만 고르는 문항 — 같은 것을 다시 누르면 풀린다 */
function One<T extends string>({
  question,
  note,
  options,
  label,
  picked,
  onPick,
  children,
}: {
  question: string;
  note?: string;
  options: readonly T[];
  label: Record<T, string>;
  picked: T | null;
  onPick: (next: T | null) => void;
  children?: React.ReactNode;
}) {
  return (
    <fieldset className={`${CARD} flex flex-col gap-3`}>
      <legend className="contents">
        <span className="block text-base font-bold">{question}</span>
      </legend>
      {note !== undefined && <p className="text-xs leading-5 text-secondary">{note}</p>}
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-sm hover:border-accent has-checked:border-accent has-checked:bg-accent-wash"
          >
            <input
              type="radio"
              checked={picked === option}
              onChange={() => onPick(option)}
              onClick={() => picked === option && onPick(null)}
              className="size-4 accent-[var(--accent)]"
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
      <label className="text-sm font-semibold" htmlFor={`writing-${limit}`}>
        {label}
      </label>
      <p className="text-xs text-muted">
        {SURVEY_COPY.optional} · 최대 {limit}자
      </p>
      <textarea
        id={`writing-${limit}`}
        value={value}
        maxLength={limit}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-sm leading-6 focus:border-accent focus:outline-none"
      />
    </div>
  );
}
