'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  REPORT_DETAIL_MAX,
  REPORT_NOTE,
  REPORT_REASONS,
  type ReportReason,
} from '@/src/lib/account';
import {
  BLOCK_NOTE,
  MATCH_DISCLOSURE,
  REJECTION_IS_FINAL_NOTE,
  REQUEST_STATUS_TEXT,
  REVISION_BOUND_NOTE,
  type RequestStatus,
} from '@/src/lib/consent';

import {
  blockUser,
  cancelRequest,
  markNotificationsRead,
  reportUser,
  respondToRequest,
} from './actions';

const PRIMARY =
  'h-11 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-60 sm:h-10';

const QUIET =
  'h-11 rounded-lg border border-border px-4 text-sm text-secondary transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60 sm:h-10';

/**
 * Match 가 여는 범위 — **보내기 전과 수락 전이 같은 목록을 읽는다.**
 *
 * 두 화면에 따로 적으면 동의가 무엇에 대한 것인지 갈린다. 문장은 정책이 들고
 * (`MATCH_DISCLOSURE`), 여기서는 세우기만 한다.
 *
 * **결과 화면도 같은 목록을 읽는다**(ADR 0010). 갈리는 것은 아래에 붙는 한 줄뿐이라
 * 그것만 받는다 — 동의 전에는 「이 요청은 판본에 매여 있다」이고, 결과에서는 「이
 * 결과가 그 판본으로 났다」이다. 목록을 화면마다 따로 적는 대신 이 한 줄을 받는다.
 */
export function MatchScope({ intro, note = REVISION_BOUND_NOTE }: { intro: string; note?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-sunken p-3 text-sm">
      <p>{intro}</p>
      <dl className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted">서로에게 열리는 것</dt>
          {MATCH_DISCLOSURE.shown.map((line) => (
            <dd key={line}>{line}</dd>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted">열리지 않는 것</dt>
          {MATCH_DISCLOSURE.hidden.map((line) => (
            <dd key={line}>{line}</dd>
          ))}
        </div>
      </dl>
      <p className="text-xs text-muted">{note}</p>
    </div>
  );
}

/**
 * 받은 요청에 답하는 자리.
 *
 * **공개 범위는 이 버튼이 들고 있지 않다.** 카드가 열릴 때부터 위에 서 있다
 * (`page.tsx` 가 `MatchScope` 를 세운다) — 눌러야 나타나는 고지는 「읽고 눌렀다」를
 * 보장하지 못하고, 서버가 내려보낸 화면에 그 문장이 있는지 밖에서 잴 수도 없다.
 *
 * **결과를 상태로 받는다.** 수락을 눌렀는데 무효가 나오는 경우가 실재한다 — 그 사이에
 * 낀 판본 수정이다. 그때 「수락했습니다」라고 말하면 사용자는 없는 Match 를 찾는다.
 */
export function RespondButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [settled, setSettled] = useState<RequestStatus | null>(null);
  const [working, startWorking] = useTransition();

  const answer = (accept: boolean) => {
    setFailure(null);
    startWorking(async () => {
      const result = await respondToRequest(requestId, accept);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      // 무효로 끝났으면 그렇게 말한다. 「수락했습니다」로 뭉뚱그리면 없는 Match 를 찾게 된다.
      if (result.status !== 'accepted' && result.status !== 'rejected') {
        setSettled(result.status);
      }
      router.refresh();
    });
  };

  if (settled !== null) {
    return <p className="text-sm text-muted">{REQUEST_STATUS_TEXT[settled].received}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => answer(true)} disabled={working} className={PRIMARY}>
          {working ? '보내는 중…' : '수락하고 Match 만들기'}
        </button>
        <button type="button" onClick={() => answer(false)} disabled={working} className={QUIET}>
          거절
        </button>
      </div>

      {/* 거절이 되돌아오지 않는다는 것을 **누르기 전에** 읽힌다 */}
      <p className="text-xs text-muted">{REJECTION_IS_FINAL_NOTE}</p>

      {failure !== null && <p className="text-sm text-muted">답하지 못했습니다 — {failure}</p>}
    </div>
  );
}

/** 보낸 요청을 거둔다 — 상대에게 알리지 않는다 */
export function CancelButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const cancel = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await cancelRequest(requestId);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={cancel}
        disabled={working}
        className="text-sm text-secondary underline underline-offset-2 disabled:opacity-60"
      >
        {working ? '거두는 중…' : '요청 거두기'}
      </button>
      {failure !== null && <span className="text-xs text-muted">{failure}</span>}
    </span>
  );
}

/**
 * 차단 — **한 번 더 묻는다.**
 *
 * 「다시 보지 않기」와 달리 살아 있던 요청까지 거두고, 성립한 Match 도 목록에서
 * 내려간다. 되돌리기 쉬운 일이 아니므로 무엇이 일어나는지 읽고 누르게 한다.
 */
export function BlockButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const block = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await blockUser(userId);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-sm text-secondary underline underline-offset-2"
      >
        차단
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-3">
      <span className="text-xs text-muted">{BLOCK_NOTE}</span>
      <button type="button" onClick={block} disabled={working} className={QUIET}>
        {working ? '차단하는 중…' : '차단합니다'}
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
  );
}

/**
 * 신고 — **차단 옆에 서되 같은 무게로 읽히지 않게 한다.**
 *
 * 나란한 두 버튼이 같아 보이면 운영자가 봐야 할 일이 조용한 차단으로 끝나거나 그
 * 반대가 된다. 그래서 무엇이 다른지를 사유를 고르는 자리에서 먼저 읽힌다.
 */
export function ReportButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0].value);
  const [detail, setDetail] = useState('');
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const send = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await reportUser(userId, reason, detail);
      if (result.ok) {
        setDone(true);
        setAsking(false);
        router.refresh();
      } else {
        setFailure(result.message);
      }
    });
  };

  /*
    보낸 뒤에는 **무엇이 일어나는지**를 말한다. 「신고했습니다」로 끝내면 상대에게
    무슨 일이 났는지 모른 채 기다리게 된다 — 아무 일도 나지 않는 것이 답이다.
  */
  if (done) {
    return <span className="text-xs text-muted">신고를 접수했습니다. 운영자가 확인합니다.</span>;
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-sm text-secondary underline underline-offset-2"
      >
        신고
      </button>
    );
  }

  return (
    <span className="flex w-full flex-col gap-2">
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

/** 읽음 처리 — 새 알림과 이미 확인한 알림을 가른다(US 58) */
export function MarkAllRead({ unread }: { unread: number }) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  if (unread === 0) return null;

  const mark = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await markNotificationsRead();
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={mark}
        disabled={working}
        className="text-sm text-accent underline underline-offset-2 disabled:opacity-60"
      >
        {working ? '읽는 중…' : `${unread}개 읽음으로`}
      </button>
      {failure !== null && <span className="text-xs text-muted">{failure}</span>}
    </span>
  );
}

/**
 * 차단한 사람이 몇인지 — **누구인지는 적지 않는다.**
 *
 * 차단한 뒤에는 그 사람의 프로필을 읽을 이유가 없어서 별명을 붙들고 있지 않다
 * (「다시 보지 않기」와 같다). 푸는 버튼도 없다 — 차단은 되돌리지 않는다(용어집).
 */
export function BlockedCount({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <p className="text-xs text-muted">
      차단한 사람 {count}명. 누구인지는 여기 적지 않고, 차단은 되돌리지 않습니다.
    </p>
  );
}
