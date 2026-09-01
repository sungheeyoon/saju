'use client';

import { useState, useTransition } from 'react';

import {
  FEEDBACK_COMMENT,
  FEEDBACK_QUESTIONS,
  FEEDBACK_SCALE,
  FEEDBACK_SCOPE_NOTE,
  FEEDBACK_THANKS,
  FELT_LENGTHS,
  FELT_LENGTH_LABEL,
  ISSUE_TAGS,
  ISSUE_TAG_LABEL,
  type FeedbackScore,
  type FeltLength,
  type IssueTag,
  type ReadingAnswer,
} from '@/src/lib/reading';

import { submitReadingFeedback } from './actions';
import type { ReadingTarget } from './pipeline';

/**
 * 읽고 나서 답하는 자리 — **글 바로 아래**다.
 *
 * 시점이 값을 정한다. 다 읽은 직후가 기억이 가장 선명하고, 여기를 떠난 뒤에 묻는
 * 설문은 「대체로 괜찮았다」를 받는다. 그래서 링크로 내보내지 않고 이 자리에 세운다.
 *
 * **바깥 폼으로 내보내지 않는 것이 요점이기도 하다.** 답을 풀이·프롬프트 판본·모델과
 * 이으려면 그 식별자를 어딘가에 실어야 하는데, 바깥으로 보내면 그것이 곧 사용자를
 * 가리키는 값이 되어 나간다. 안에서 받으면 서버가 이미 알고 있어서 아무것도 안 싣는다.
 */
export function ReadingFeedback({
  target,
  runId,
  /**
   * 이미 남긴 답 — **고치는 화면이 이 값으로 열린다.**
   *
   * 「답했는가」만 받으면 칸이 전부 빈 채로 열리고, 거기서 다시 보내면 적어 두었던
   * 글까지 지워진다. 고치는 것과 지우는 것이 같은 버튼이 되는 것이다.
   */
  given,
}: {
  target: ReadingTarget;
  runId: string;
  given: ReadingAnswer | null;
}) {
  const [answer, setAnswer] = useState(given);
  const [open, setOpen] = useState(given === null);
  const [usefulness, setUsefulness] = useState<FeedbackScore | null>(given?.usefulness ?? null);
  const [fit, setFit] = useState<FeedbackScore | null>(given?.perceivedFit ?? null);
  const [feltLength, setFeltLength] = useState<FeltLength | null>(given?.feltLength ?? null);
  const [tags, setTags] = useState<IssueTag[]>([...(given?.issueTags ?? [])]);
  const [comment, setComment] = useState(given?.comment ?? '');
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (answer !== null && !open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-sunken px-5 py-4">
        <p className="text-sm text-secondary">{FEEDBACK_THANKS}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-accent underline underline-offset-4"
        >
          답 고치기
        </button>
      </div>
    );
  }

  /*
    **셋을 다 골라야 보낼 수 있다.** 눈금을 비운 채 보내게 두면 「안 고른 것」이 어느
    값으로든 저장되고, 그 값은 실제 답과 구별되지 않는다. 아쉬운 점과 적는 칸은
    비워도 된다 — 아쉬운 것이 없는 것도 답이다.
  */
  const ready = usefulness !== null && fit !== null && feltLength !== null;

  const send = () => {
    if (!ready) return;
    setFailure(null);

    startSaving(async () => {
      const sent: ReadingAnswer = {
        usefulness,
        perceivedFit: fit,
        feltLength,
        issueTags: tags,
        comment: comment.trim() === '' ? null : comment.trim(),
      };

      const result = await submitReadingFeedback(target, { runId, ...sent });

      if (result.ok) {
        /*
          **보낸 값을 여기서 든다.** `revalidatePath` 가 새 `given` 을 밀어 주기는
          하지만, 그것을 기다려 화면을 바꾸면 무르는 왕복이 늦은 순간에 「보냈는데
          아무 일도 안 일어난」 화면이 선다. 방금 보낸 것이 무엇인지는 이 자리가 안다.
        */
        setAnswer(sent);
        setOpen(false);
        return;
      }
      setFailure(result.message);
    });
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-surface-sunken px-5 py-5">
      <div>
        <p className="text-sm font-bold">이 풀이는 어떠셨어요?</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">{FEEDBACK_SCOPE_NOTE}</p>
      </div>

      <Scale
        name={`useful-${runId}`}
        question={FEEDBACK_QUESTIONS.usefulness}
        value={usefulness}
        onChange={setUsefulness}
      />
      <Scale
        name={`fit-${runId}`}
        question={FEEDBACK_QUESTIONS.perceivedFit}
        value={fit}
        onChange={setFit}
      />

      <fieldset>
        <legend className="float-left w-full text-sm font-semibold">분량은 어땠나요?</legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {FELT_LENGTHS.map((choice) => (
            <Chip
              key={choice}
              id={`length-${runId}-${choice}`}
              name={`length-${runId}`}
              type="radio"
              picked={feltLength === choice}
              onPick={() => setFeltLength(choice)}
            >
              {FELT_LENGTH_LABEL[choice]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="float-left w-full text-sm font-semibold">아쉬운 점이 있다면요?</legend>
        <p className="mt-1 text-xs leading-5 text-muted">
          여러 개 고를 수 있고, 없으면 안 골라도 됩니다.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {ISSUE_TAGS.map((tag) => (
            <Chip
              key={tag}
              id={`tag-${runId}-${tag}`}
              name={`tag-${runId}-${tag}`}
              type="checkbox"
              picked={tags.includes(tag)}
              onPick={() =>
                setTags((current) =>
                  current.includes(tag) ? current.filter((one) => one !== tag) : [...current, tag],
                )
              }
            >
              {ISSUE_TAG_LABEL[tag]}
            </Chip>
          ))}
        </div>
      </fieldset>

      {/*
        **사람이 읽는 유일한 칸.** 설문 전체가 동의 뒤에 있으므로 여기까지 온 사람은
        이미 동의했고, 이 칸만 따로 잠글 일이 없다.
      */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`comment-${runId}`} className="text-sm font-semibold">
          {FEEDBACK_COMMENT.label}
        </label>
        <p className="text-xs leading-5 text-muted">{FEEDBACK_COMMENT.hint}</p>
        <textarea
          id={`comment-${runId}`}
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, FEEDBACK_COMMENT.limit))}
          maxLength={FEEDBACK_COMMENT.limit}
          rows={3}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-soft"
        />
        <p className="text-xs tabular-nums text-muted">
          {comment.length} / {FEEDBACK_COMMENT.limit}자
        </p>
      </div>

      {failure !== null && (
        <p role="alert" className="text-sm leading-6 text-danger">
          답을 남기지 못했습니다. {failure}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={!ready || saving}
          className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? '보내는 중이에요…' : '답 보내기'}
        </button>
        {!ready && <p className="text-xs text-muted">위 세 가지를 골라 주시면 보낼 수 있어요.</p>}
      </div>
    </div>
  );
}

/** 1~5 눈금 — **양 끝의 말이 함께 선다.** 숫자만 있으면 5가 좋은 쪽인지 알 수 없다 */
function Scale({
  name,
  question,
  value,
  onChange,
}: {
  name: string;
  question: { label: string; low: string; high: string };
  value: FeedbackScore | null;
  onChange: (next: FeedbackScore) => void;
}) {
  return (
    <fieldset>
      <legend className="float-left w-full text-sm font-semibold">{question.label}</legend>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {FEEDBACK_SCALE.map((score) => (
          <Chip
            key={score}
            id={`${name}-${score}`}
            name={name}
            type="radio"
            picked={value === score}
            onPick={() => onChange(score)}
            /* 숫자만 읽어 주면 무엇을 매기는지 안 들린다 — 양 끝은 이름으로 읽힌다 */
            label={
              score === 1
                ? `1 — ${question.low}`
                : score === 5
                  ? `5 — ${question.high}`
                  : String(score)
            }
          >
            <span className="tabular-nums">{score}</span>
          </Chip>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>{question.low}</span>
        <span>{question.high}</span>
      </div>
    </fieldset>
  );
}

/**
 * 고르는 칸 하나.
 *
 * 입력이 칸 전체를 덮는다 — `sr-only` 로 숨기면 글자만 누를 수 있는 칸이 되고, 라벨을
 * 못 짚는 손에는 **누를 것이 없는 칸**이 된다(`relation-choice.tsx` 와 같은 규율).
 */
function Chip({
  id,
  name,
  type,
  picked,
  onPick,
  label,
  children,
}: {
  id: string;
  name: string;
  type: 'radio' | 'checkbox';
  picked: boolean;
  onPick: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={`relative min-w-11 cursor-pointer rounded-full border px-3.5 py-1.5 text-center text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-soft ${
        picked
          ? 'border-accent bg-accent-wash font-medium text-accent'
          : 'border-border bg-surface text-secondary hover:border-accent'
      }`}
    >
      <input
        type={type}
        id={id}
        name={name}
        checked={picked}
        onChange={onPick}
        aria-label={label}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      />
      {children}
    </label>
  );
}
