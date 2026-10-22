'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type ReactNode } from 'react';

import { actionAnswer, afterFailure } from '../../../ui/action-answer';
import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  BUTTON_TERTIARY,
  SEGMENT,
  SEGMENT_ON,
  SEGMENTS,
} from '../../../ui/buttons';
import { ConfirmDialog } from '../../../ui/confirm-dialog';
import { FailureLine } from '../../../ui/failure-line';
import { FIELD } from '../../../ui/fields';
import { useOneAtATime } from '../../../ui/one-at-a-time';
import { accountLabel } from '../../account-label';
import { writeReview } from '../actions';
import { reviewOutcomeLabel } from '../labels';
import {
  NOTE_MAX,
  OUTCOMES,
  SIDE_NAME,
  WARNING_CATEGORIES,
  actionLabel,
  doneNote,
  reviewPlan,
  samePlan,
  sanctions,
  suspensionBlocked,
  warningSentence,
  type Outcome,
  type Party,
  type ReportNow,
  type ReviewPlan,
} from '../review';

const ROW = 'flex flex-col gap-2';
const LABEL = 'text-xs font-semibold text-muted';
const FACTS = 'grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm';
const SEGMENT_FOCUS = 'grid cursor-pointer place-items-center text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent';

/**
 * **신고 처분** — 신고 상세의 오른쪽 칸(G-111 ②, ADR 0188).
 *
 * 처리 필요면 처분 폼이 서고, 처리 완료면 반영 결과(`children` — 서버가 그린다)와 「처분 바꾸기」가 선다. 폼은 결과 넷 · 제재 대상 ·
 * 경고 갈래 · 판단 근거다. 처분 단추를 누르는 순간 값 · 읽은 처리 버전 · 요청 번호를 고정하고(`reviewPlan`), 경고 · 이용 정지
 * 결정과 처분 바꾸기는 확인창을 거쳐 그 고정본을 그대로 낸다. 처리 중에는 단추가 잠기고 두 번째 누름은 버린다(`useOneAtATime`).
 * 실패하면 창을 닫고 입력을 그대로 둔 채 실패 줄을 세운다 — 응답을 못 받았으면 화면을 다시 읽고, 같은 값으로 다시 누르면 같은
 * 요청 번호로 가서 한 번만 적힌다. 성공하면 서버가 이 화면을 다시 읽어 그린다(새 결과 · 버전 · 이력).
 */
export function ReviewPanel({
  now,
  parties,
  children,
}: {
  readonly now: ReportNow;
  /** 대상 요약 — 못 읽었으면 빈 목록이고, 경고 · 정지는 고를 수 없다 */
  readonly parties: readonly Party[];
  /** 처리 완료일 때의 반영 결과 */
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(now.isOpen);
  const [outcome, setOutcome] = useState<Outcome>('no_action');
  const [side, setSide] = useState<Party['side']>('reported');
  const [category, setCategory] = useState(now.reason);
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<ReviewPlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { saving, run } = useOneAtATime();
  const ids = useId();

  // 처리 필요로 돌아온 신고(다른 운영자가 추가 확인으로 바꿨다)는 폼이 다시 선다 — 그 밖에는 누른 사람이 연다
  const showForm = now.isOpen || editing;
  const target = parties.find((party) => party.side === side);
  const blocked = outcome === 'suspension' ? suspensionBlocked(target) : null;
  const noParties = sanctions(outcome) && parties.length === 0;
  const input = { outcome, side, warningCategory: category, note };

  const submit = (frozen: ReviewPlan) => {
    run(async () => {
      const answer = await actionAnswer(writeReview(frozen.request));
      setConfirming(false);
      if (answer.ok) {
        setPlan(null);
        setNote('');
        setOutcome('no_action');
        setEditing(false);
        setDone(doneNote(!now.isOpen, frozen.request.outcome, answer.replayed));
      } else {
        setFailure(answer.message);
        // 결과를 모르면 고정본을 지키고 화면을 다시 읽는다. 분명한 거절이면 고정본을 버린다 — 액션이 이미 지금 화면을 다시
        // 그려 실었으므로 다음 누름은 새 버전 · 새 요청 번호다
        if (afterFailure(answer) === 'discard') setPlan(null);
        else router.refresh();
      }
    });
  };

  const open = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    setDone(null);
    if (note.trim() === '') {
      setFailure('판단 근거를 적어 주세요.');
      return;
    }
    if (blocked !== null) {
      setFailure(blocked);
      return;
    }
    // 같은 값으로 다시 내는 것이 응답이 끊긴 뒤라면 앞 고정본(요청 번호 · 읽은 버전)을 다시 낸다
    const frozen = samePlan(plan, now, parties, input) && plan !== null ? plan : reviewPlan(now, parties, input, crypto.randomUUID());
    setPlan(frozen);
    if (frozen.confirm) setConfirming(true);
    else submit(frozen);
  };

  if (!showForm) {
    return (
      <div className="flex flex-col gap-4">
        {done !== null && <p className="text-sm font-semibold text-foreground">{done}</p>}
        {failure !== null && <FailureLine>{failure}</FailureLine>}
        {children}
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setFailure(null);
            setDone(null);
          }}
          className={`${BUTTON_TERTIARY} self-start`}
        >
          처분 바꾸기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {done !== null && <p className="text-sm font-semibold text-foreground">{done}</p>}
      {!now.isOpen && children}
      <form onSubmit={open} aria-label="처분" className="flex flex-col gap-4">
        <fieldset className={ROW}>
          <legend className={`${LABEL} mb-2`}>결과</legend>
          <div className={`${SEGMENTS} grid-cols-2`}>
            {OUTCOMES.map((one) => (
              <label key={one} className={`${one === outcome ? SEGMENT_ON : SEGMENT} ${SEGMENT_FOCUS}`}>
                <input
                  type="radio"
                  name={`${ids}-outcome`}
                  value={one}
                  checked={one === outcome}
                  onChange={() => setOutcome(one)}
                  className="sr-only"
                />
                {reviewOutcomeLabel(one)}
              </label>
            ))}
          </div>
        </fieldset>

        {sanctions(outcome) && parties.length > 0 && (
          <fieldset className={ROW}>
            <legend className={`${LABEL} mb-2`}>제재 대상</legend>
            <div className={`${SEGMENTS} grid-cols-2`}>
              {parties.map((party) => (
                <label key={party.side} className={`${party.side === side ? SEGMENT_ON : SEGMENT} ${SEGMENT_FOCUS} py-1`}>
                  <input
                    type="radio"
                    name={`${ids}-side`}
                    value={party.side}
                    checked={party.side === side}
                    onChange={() => setSide(party.side)}
                    className="sr-only"
                  />
                  <span className="flex flex-col leading-5">
                    <span>{SIDE_NAME[party.side]}</span>
                    <span className="text-xs font-normal text-muted">{accountLabel(party.nickname, party.userId)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {noParties && <FailureLine>대상 회원을 읽지 못해 경고 · 이용 정지를 고를 수 없습니다.</FailureLine>}

        {outcome === 'warning' && target !== undefined && (
          <div className={ROW}>
            <label htmlFor={`${ids}-category`} className={LABEL}>
              경고 갈래
            </label>
            <select
              id={`${ids}-category`}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={`${FIELD} w-full`}
            >
              {WARNING_CATEGORIES.map((one) => (
                <option key={one.value} value={one.value}>
                  {one.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-secondary">{warningSentence(target)}</p>
          </div>
        )}
        {outcome === 'suspension' && blocked !== null && <p className="text-sm text-danger">{blocked}</p>}

        <div className={ROW}>
          <label htmlFor={`${ids}-note`} className={LABEL}>
            판단 근거
          </label>
          <textarea
            id={`${ids}-note`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={NOTE_MAX}
            rows={4}
            required
            className={`${FIELD} w-full py-3`}
          />
          <p className="flex justify-between gap-3 text-xs text-muted">
            <span>이메일 · 실명 · 연락처는 적지 않습니다.</span>
            <span className="shrink-0 tabular-nums">
              {note.length}/{NOTE_MAX}
            </span>
          </p>
        </div>

        {failure !== null && !confirming && <FailureLine>{failure}</FailureLine>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || noParties}
            className={outcome === 'suspension' ? BUTTON_DANGER : BUTTON_PRIMARY}
          >
            {saving ? '처리 중…' : actionLabel(now, outcome)}
          </button>
          {!now.isOpen && (
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className={BUTTON_SECONDARY}>
              취소
            </button>
          )}
        </div>
      </form>

      {plan !== null && plan.confirm && (
        <ConfirmDialog
          open={confirming}
          onClose={() => setConfirming(false)}
          title={plan.title}
          confirmLabel={saving ? '처리 중…' : plan.confirmLabel}
          onConfirm={() => submit(plan)}
          danger={plan.danger}
          busy={saving}
        >
          <dl className={FACTS}>
            <dt className="text-muted">신고</dt>
            <dd className="font-mono">{plan.reportLine}</dd>
            {plan.targetLine !== null && (
              <>
                <dt className="text-muted">대상</dt>
                <dd className="break-words">{plan.targetLine}</dd>
              </>
            )}
            <dt className="text-muted">처분</dt>
            <dd>{plan.changeLine}</dd>
            <dt className="text-muted">근거</dt>
            <dd className="break-words">{plan.reasonLine}</dd>
          </dl>
          {plan.resultLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </ConfirmDialog>
      )}
    </div>
  );
}
