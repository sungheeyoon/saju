'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition } from 'react';

import { ACTION_UNREACHED_NOTE, actionAnswer } from '../../ui/action-answer';
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_TERTIARY, BUTTON_TERTIARY_DANGER, SEGMENT, SEGMENT_ON, SEGMENTS } from '../../ui/buttons';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { DoneNote, useDoneNote } from '../../ui/done-note';
import { FailureLine } from '../../ui/failure-line';
import { FIELD } from '../../ui/fields';
import { accountLabel } from '../account-label';
import { oneAtATime } from '../orders/refund-confirm';
import { changeMemberStatus } from './actions';
import { afterFailure } from './credit-grant';
import {
  NOTE_MAX,
  doneNote,
  isStatusReason,
  reasonsOf,
  samePlan,
  statusPlan,
  type StatusKind,
  type StatusPlan,
} from './suspension';

const ROW = 'flex flex-col gap-2';
const LABEL = 'text-xs font-semibold text-muted';
const FACTS = 'grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm';

/**
 * **이용 정지 · 해제** — 회원 화면의 계정 칸 안(G-111 ③, ADR 0189).
 *
 * 단추 하나 — 이용 중이면 「이용 정지」(붉은 글자), 이용 정지면 「정지 해제」. 운영자 계정 · 탈퇴 대기는 부르는 쪽이 단추 대신 딱지
 * · 한 줄을 세운다(`statusAction`). 누르면 칸 안에 폼(사유 갈래 · 메모)이 펼쳐지고, 폼의 단추를 누르면 확인창이 선다. 창을 여는 순간
 * 값 · 읽은 버전 · 요청 번호를 고정해(`statusPlan`) 그 고정본을 그대로 낸다. 실패 · 재시도의 규율은 무상 지급(`grant-panel.tsx`)과
 * 같다 — 결과를 모를 때만 같은 요청 번호를 다시 쓰고, 분명한 거절이면 고정본을 버린다. 성공하면 서버가 이 화면을 다시 읽어 그린다
 * (새 상태 딱지 · 처분 이력의 새 줄).
 */
export function StatusPanel({
  kind,
  userId,
  nickname,
  version,
}: {
  readonly kind: StatusKind;
  readonly userId: string;
  readonly nickname: string | null;
  /** 처분 이력 문이 낸 읽은 버전 — 그 계정의 상태 이력 줄 수 */
  readonly version: number;
}) {
  const reasons = reasonsOf(kind);
  const [opened, setOpened] = useState(false);
  const [reason, setReason] = useState<string>(reasons[0].value);
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<StatusPlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const router = useRouter();
  const guard = useRef(oneAtATime());
  const done = useDoneNote();
  const ids = useId();

  const title = kind === 'suspend' ? '이용 정지' : '정지 해제';
  // 화면을 다시 그려 상태가 바뀌었으면(다른 운영자가 먼저 바꿨다) 고른 갈래가 그 단추의 것이 아닐 수 있다 — 그때는 첫 갈래다.
  // 이 칸은 상태가 바뀌어도 새로 세우지 않는다 — 성공의 완료 줄이 새 상태 위에 남는다
  const chosen = isStatusReason(kind, reason) ? reason : reasons[0].value;
  const input = { kind, userId, reason: chosen, note };

  const openForm = () => {
    setOpened(true);
    setReason(reasons[0].value);
    setNote('');
    setPlan(null);
    setFailure(null);
    done.clear();
  };

  const open = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    if (note.trim() === '') {
      setFailure('메모를 적어 주세요.');
      return;
    }
    setPlan(samePlan(plan, input) ? plan : statusPlan({ version }, input, crypto.randomUUID()));
    setConfirming(true);
  };

  const confirm = () => {
    if (plan === null) return;
    guard.current.run(
      () =>
        new Promise<void>((finish) => {
          startSaving(async () => {
            const answer = await actionAnswer(changeMemberStatus(plan.request));
            setConfirming(false);
            if (answer.ok) {
              setOpened(false);
              setPlan(null);
              setNote('');
              done.say(doneNote(plan.request.kind, answer.replayed));
            } else {
              setFailure(answer.message);
              // 분명한 거절이면 고정본을 버린다 — 액션이 거절이어도 지금 화면을 다시 그려 실었다. 결과를 모르면(응답이 끊겼다)
              // 고정본을 지키고 화면을 다시 읽는다 — 액션의 응답이 안 왔으니 다시 그린 화면도 안 왔다
              if (afterFailure(answer.message, ACTION_UNREACHED_NOTE) === 'discard') setPlan(null);
              else router.refresh();
            }
            finish();
          });
        }),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {!opened && (
          <button
            type="button"
            onClick={openForm}
            disabled={saving}
            className={kind === 'suspend' ? BUTTON_TERTIARY_DANGER : BUTTON_TERTIARY}
          >
            {title}
          </button>
        )}
        <DoneNote>{saving ? '처리 중…' : done.note}</DoneNote>
      </div>
      {!opened && failure !== null && <FailureLine>{failure}</FailureLine>}

      {opened && (
        <form onSubmit={open} className="flex flex-col gap-4 rounded-tile bg-surface-soft p-4" aria-label={title}>
          <fieldset className={ROW}>
            <legend className={`${LABEL} mb-2`}>사유</legend>
            <div className={`${SEGMENTS} grid-cols-2 sm:max-w-lg sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none`}>
              {reasons.map((one) => (
                <label
                  key={one.value}
                  className={`${one.value === chosen ? SEGMENT_ON : SEGMENT} grid cursor-pointer place-items-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent`}
                >
                  <input
                    type="radio"
                    name={`${ids}-reason`}
                    value={one.value}
                    checked={one.value === chosen}
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

          {failure !== null && !confirming && <FailureLine>{failure}</FailureLine>}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className={kind === 'suspend' ? BUTTON_DANGER : BUTTON_PRIMARY}>
              {title}
            </button>
            <button type="button" onClick={() => setOpened(false)} disabled={saving} className={BUTTON_SECONDARY}>
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
          danger={plan.request.kind === 'suspend'}
          busy={saving}
        >
          <dl className={FACTS}>
            <dt className="text-muted">대상</dt>
            <dd>{accountLabel(nickname, userId)}</dd>
            <dt className="text-muted">처분</dt>
            <dd>{plan.changeLine}</dd>
            <dt className="text-muted">사유</dt>
            <dd className="break-words">{plan.reasonLine}</dd>
          </dl>
          <p>{plan.resultLine}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
