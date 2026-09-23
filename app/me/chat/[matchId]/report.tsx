'use client';

import { useState, useTransition } from 'react';

import {
  REPORT_DETAIL_MAX,
  REPORT_NOTE,
  REPORT_REASONS,
  type ReportReason,
} from '@/src/lib/account';

import { reportChatMessage } from '../actions';

const QUIET =
  'h-11 rounded-lg border border-border px-4 text-sm text-secondary transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60 sm:h-10';

/**
 * 메시지 하나를 고른 신고 — 소식 화면의 `ReportButton` 과 같은 폼이고, 다른 것은 **무엇을
 * 고르는가**뿐이다. 사람이 아니라 메시지를 고르고, DB 가 그 메시지와 앞뒤 문맥을 그때 그대로
 * 베껴 신고 곁에 남긴다(PRD §7.1 · ADR 0091). 사유 넷과 덧붙이는 말의 길이는 신고와 같다.
 */
export function ReportMessageButton({ messageId }: { messageId: string }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0].value);
  const [detail, setDetail] = useState('');
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const send = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await reportChatMessage(messageId, reason, detail);
      if (result.ok) {
        setDone(true);
        setAsking(false);
      } else {
        setFailure(result.message);
      }
    });
  };

  /* 보낸 뒤에는 무엇이 일어나는지를 말한다 — 아무 일도 나지 않는 것이 답이다 */
  if (done) {
    return <span className="text-[11px] text-muted">신고를 접수했습니다. 운영자가 확인합니다.</span>;
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-[11px] text-secondary underline underline-offset-2"
      >
        신고
      </button>
    );
  }

  return (
    <span className="flex w-full min-w-64 flex-col gap-2 text-sm">
      <span className="text-xs text-muted">{REPORT_NOTE}</span>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-secondary">신고 사유</span>
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value as ReportReason)}
          className="h-11 rounded-md border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash sm:h-10"
        >
          {REPORT_REASONS.map((one) => (
            <option key={one.value} value={one.value}>
              {one.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-secondary">덧붙일 말 (선택)</span>
        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value.slice(0, REPORT_DETAIL_MAX))}
          maxLength={REPORT_DETAIL_MAX}
          rows={3}
          className="rounded-md border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash"
        />
      </label>
      <span className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={send} disabled={working} className={QUIET}>
          {working ? '보내는 중…' : '신고합니다'}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={working}
          className="text-sm text-secondary underline underline-offset-2"
        >
          그만두기
        </button>
        {failure !== null && <span className="text-xs text-muted">{failure}</span>}
      </span>
    </span>
  );
}
