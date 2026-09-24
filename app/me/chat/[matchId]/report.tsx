'use client';

import { useState, useTransition } from 'react';

import {
  REPORT_DETAIL_MAX,
  REPORT_NOTE,
  REPORT_REASONS,
  type ReportReason,
} from '@/src/lib/account';

import { BUTTON_PRIMARY_SMALL, ICON_BUTTON } from '../../../ui/buttons';
import { Icon } from '../../../ui/icon';
import { reportChatMessage } from '../actions';
import { ChatIcon } from '../chat-icon';

const FIELD =
  'rounded-xl bg-surface px-3 text-[15px] text-foreground ring-1 ring-border outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]';

/**
 * 메시지 하나를 고른 신고 — 입력 자리에 선다. 소식 화면의 `ReportButton` 과 같은 폼이고, 다른 것은 **무엇을
 * 고르는가**뿐이다. 사람이 아니라 메시지를 고르고, DB 가 그 메시지와 앞뒤 문맥을 그때 그대로 베껴 신고 곁에
 * 남긴다(PRD §7.1 · ADR 0091). 사유 넷과 덧붙이는 말의 길이는 신고와 같다.
 *
 * 두 걸음이다 — 고르기 전에는 고르라는 말만(말풍선 곁에 깃발이 선다), 고르면 사유 칸이 선다.
 */
export function ReportPanel({
  messageId,
  onCancel,
  onDone,
}: {
  messageId: string | null;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0].value);
  const [detail, setDetail] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const send = () => {
    if (messageId === null) return;
    setFailure(null);
    startWorking(async () => {
      const result = await reportChatMessage(messageId, reason, detail);
      if (result.ok) onDone();
      else setFailure(result.message);
    });
  };

  return (
    <div className="flex max-h-[55dvh] flex-col gap-3 overflow-y-auto rounded-[1.5rem] bg-surface-soft p-4 ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 pt-2.5 text-[15px] font-bold text-foreground">
          <ChatIcon name="flag" className="size-[18px] text-danger" />
          {messageId === null ? '신고할 메시지를 골라 주세요' : '메시지 신고'}
        </p>
        <button type="button" aria-label="그만두기" onClick={onCancel} disabled={working} className={ICON_BUTTON}>
          <Icon name="close" className="size-[18px]" />
        </button>
      </div>
      <p className="text-[13px] leading-5 text-secondary">{REPORT_NOTE}</p>
      {messageId !== null && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-secondary">신고 사유</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason)}
              className={`${FIELD} min-h-11`}
            >
              {REPORT_REASONS.map((one) => (
                <option key={one.value} value={one.value}>
                  {one.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-secondary">덧붙일 말 (선택)</span>
            <textarea
              value={detail}
              onChange={(event) => setDetail(event.target.value.slice(0, REPORT_DETAIL_MAX))}
              maxLength={REPORT_DETAIL_MAX}
              rows={2}
              className={`${FIELD} py-2.5`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={send} disabled={working} className={BUTTON_PRIMARY_SMALL}>
              {working ? '보내는 중…' : '신고합니다'}
            </button>
            {failure !== null && <span className="text-[13px] text-danger">{failure}</span>}
          </div>
        </>
      )}
    </div>
  );
}
