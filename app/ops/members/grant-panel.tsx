'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition } from 'react';

import { ACTION_UNREACHED_NOTE, actionAnswer } from '../../ui/action-answer';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, SEGMENT, SEGMENT_ON, SEGMENTS } from '../../ui/buttons';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { DoneNote, useDoneNote } from '../../ui/done-note';
import { FailureLine } from '../../ui/failure-line';
import { FIELD } from '../../ui/fields';
import { oneAtATime } from '../orders/refund-confirm';
import { bookCreditGrant } from './actions';
import {
  afterFailure,
  GRANT_MAX,
  GRANT_REASONS,
  NOTE_MAX,
  NOT_REFUNDABLE,
  REVOKE_REASONS,
  grantPlan,
  memberLabel,
  revokeBlocked,
  samePlan,
  type GrantKind,
  type GrantLedger,
  type GrantPlan,
} from './credit-grant';

const ROW = 'flex flex-col gap-2';
const LABEL = 'text-xs font-semibold text-muted';
const FACTS = 'grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm';

/**
 * **무상 풀이권 지급 · 회수** — 회원 화면의 풀이권 칸 아래(G-111 ①, ADR 0187).
 *
 * 단추 둘 — 「무상 풀이권 지급」 · 「무상 지급분 회수」. 누르면 칸 안에 폼이 펼쳐진다(수량 · 사유 갈래 · 메모). 폼의 단추
 * 「3장 지급」 · 「2장 회수」를 누르면 확인창이 서고, 창을 여는 순간 값 · 읽은 버전 · 요청 번호를 고정해(`grantPlan`) 그 고정본을
 * 그대로 낸다. 처리 중에는 단추가 잠기고 두 번째 누름은 버린다(`oneAtATime`). 실패하면 창을 닫고 입력을 그대로 둔 채 실패 줄을
 * 세운다 — 응답을 못 받았으면 화면을 다시 읽고, 같은 값으로 다시 누르면 같은 요청 번호로 가서 한 번만 적힌다. 성공하면 서버가
 * 이 화면을 다시 읽어 그린다(새 장부 · 이력).
 */
export function GrantPanel({
  userId,
  nickname,
  ledger,
  reserved,
  reportId,
}: {
  readonly userId: string;
  readonly nickname: string | null;
  readonly ledger: GrantLedger;
  /** 지급 몫에서 예약 중인 수 — 회수 단추를 잠갔을 때 까닭에 든다 */
  readonly reserved: number;
  /** 신고 화면에서 넘어왔으면 그 신고 — 지급의 「관련 신고」로 따라간다 */
  readonly reportId: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<GrantKind | null>(null);
  const [credits, setCredits] = useState(1);
  const [reason, setReason] = useState<string>(GRANT_REASONS[0].value);
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<GrantPlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const guard = useRef(oneAtATime());
  const done = useDoneNote();
  const ids = useId();

  const blocked = revokeBlocked(ledger.revocable, reserved);
  const most = mode === 'revoke' ? ledger.revocable : GRANT_MAX;
  const chosen = Math.min(Math.max(credits, 1), Math.max(most, 1));
  const reasons = mode === 'revoke' ? REVOKE_REASONS : GRANT_REASONS;

  const openForm = (kind: GrantKind) => {
    setMode(kind);
    setCredits(1);
    setReason((kind === 'revoke' ? REVOKE_REASONS : GRANT_REASONS)[0].value);
    setNote('');
    setPlan(null);
    setFailure(null);
    done.clear();
  };

  const input = mode === null
    ? null
    : { kind: mode, userId, credits: chosen, reason, note, reportId: mode === 'grant' ? reportId : null };

  const open = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (input === null) return;
    setFailure(null);
    if (note.trim() === '') {
      setFailure('메모를 적어 주세요.');
      return;
    }
    // 같은 값으로 다시 여는 것이 응답이 끊긴 뒤라면 앞 고정본을 다시 낸다 — 서버가 같은 줄을 돌려준다. 분명히 거절된 고정본은
    // 이미 버렸으므로(`afterFailure`) 여기서는 새 읽은 버전 · 새 요청 번호로 연다
    setPlan(samePlan(plan, input) ? plan : grantPlan(ledger, input, crypto.randomUUID()));
    setConfirming(true);
  };

  const confirm = () => {
    if (plan === null) return;
    guard.current.run(
      () =>
        new Promise<void>((finish) => {
          startSaving(async () => {
            const answer = await actionAnswer(bookCreditGrant(plan.request));
            setConfirming(false);
            if (answer.ok) {
              const verb = plan.request.kind === 'grant' ? '지급' : '회수';
              setMode(null);
              setPlan(null);
              setNote('');
              done.say(answer.replayed ? `이미 ${verb}했습니다.` : `${verb}했습니다.`);
            } else {
              setFailure(answer.message);
              // 결과를 모르면 고정본을 지키고, 분명한 거절이면 버린다 — 둘 다 지금 장부를 다시 읽는다(`afterFailure`)
              if (afterFailure(answer.message, ACTION_UNREACHED_NOTE) === 'discard') setPlan(null);
              router.refresh();
            }
            finish();
          });
        }),
    );
  };

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => openForm('grant')} disabled={saving} className={BUTTON_PRIMARY}>
          무상 풀이권 지급
        </button>
        <button
          type="button"
          onClick={() => openForm('revoke')}
          disabled={saving || blocked !== null}
          className={BUTTON_SECONDARY}
        >
          무상 지급분 회수
        </button>
        <DoneNote>{saving ? '처리 중…' : done.note}</DoneNote>
      </div>
      {blocked !== null && <p className="text-xs text-secondary">{blocked}</p>}

      {mode !== null && input !== null && (
        <form onSubmit={open} className="flex flex-col gap-4 rounded-tile bg-surface-soft p-4" aria-label={mode === 'grant' ? '무상 풀이권 지급' : '무상 지급분 회수'}>
          <p className="text-sm font-semibold">
            {mode === 'grant' ? `무상 지급분은 ${NOT_REFUNDABLE}` : '무상 지급분만 회수합니다. 구매분 환불은 주문 화면에서.'}
          </p>

          <div className={ROW}>
            <label htmlFor={`${ids}-credits`} className={LABEL}>
              수량
            </label>
            <select
              id={`${ids}-credits`}
              value={chosen}
              onChange={(event) => setCredits(Number(event.target.value))}
              className={`${FIELD} w-full sm:w-40`}
            >
              {Array.from({ length: most }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}장
                </option>
              ))}
            </select>
          </div>

          <fieldset className={ROW}>
            <legend className={`${LABEL} mb-2`}>사유</legend>
            <div className={`${SEGMENTS} grid-flow-col auto-cols-fr sm:max-w-md`}>
              {reasons.map((one) => (
                <label key={one.value} className={`${one.value === reason ? SEGMENT_ON : SEGMENT} grid cursor-pointer place-items-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent`}>
                  <input
                    type="radio"
                    name={`${ids}-reason`}
                    value={one.value}
                    checked={one.value === reason}
                    onChange={() => setReason(one.value)}
                    className="sr-only"
                  />
                  {one.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className={ROW}>
            <label htmlFor={`${ids}-note`} className={LABEL}>
              메모
            </label>
            <textarea
              id={`${ids}-note`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={NOTE_MAX}
              rows={3}
              required
              className={`${FIELD} w-full py-3`}
            />
            <p className="flex justify-between gap-3 text-xs text-muted">
              <span>이용자에게는 보이지 않습니다. 이메일 · 실명 · 연락처는 적지 않습니다.</span>
              <span className="shrink-0 tabular-nums">
                {note.length}/{NOTE_MAX}
              </span>
            </p>
          </div>

          {mode === 'grant' && reportId !== null && (
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-accent-wash px-2.5 py-1 font-semibold text-foreground">관련 신고</span>
              <span className="break-all font-mono text-secondary">{reportId}</span>
            </p>
          )}

          {failure !== null && !confirming && <FailureLine>{failure}</FailureLine>}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className={BUTTON_PRIMARY}>
              {mode === 'grant' ? `${chosen}장 지급` : `${chosen}장 회수`}
            </button>
            <button type="button" onClick={() => setMode(null)} disabled={saving} className={BUTTON_SECONDARY}>
              취소
            </button>
          </div>
        </form>
      )}

      {plan !== null && (
        <ConfirmDialog
          open={confirming}
          onClose={() => setConfirming(false)}
          title={plan.title}
          confirmLabel={plan.confirmLabel}
          onConfirm={confirm}
          danger={plan.request.kind === 'revoke'}
          busy={saving}
        >
          <dl className={FACTS}>
            <dt className="text-muted">대상</dt>
            <dd>{memberLabel(nickname, userId)}</dd>
            <dt className="text-muted">수량</dt>
            <dd className="tabular-nums">{plan.amountLine}</dd>
            <dt className="text-muted">사유</dt>
            <dd className="break-words">{plan.reasonLine}</dd>
            {plan.request.reportId !== null && (
              <>
                <dt className="text-muted">관련 신고</dt>
                <dd className="break-all font-mono text-xs leading-5">{plan.request.reportId}</dd>
              </>
            )}
          </dl>
          <p>{plan.resultLine}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
