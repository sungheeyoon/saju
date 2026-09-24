'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { announceIfMoved } from '../reading/credits-signal';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { SETTINGS_DANGER } from '../settings/card';
import { announceNotificationsUnreadMoved } from './unread-signal';

import {
  REPORT_DETAIL_MAX,
  REPORT_NOTE,
  REPORT_REASONS,
  type ReportReason,
} from '@/src/lib/account';
import {
  BLOCK_NOTE,
  MATCH_CONSENT_QUESTION,
  REJECTION_IS_FINAL_NOTE,
  REQUEST_STATUS_TEXT,
  type RequestStatus,
} from '@/src/lib/consent';

import {
  blockUser,
  cancelRequest,
  markNotificationsRead,
  reportUser,
  respondToRequest,
} from './actions';

/**
 * 카드 밑단의 조용한 누름(차단 · 신고 · 거두기 · 그만두기) — 셋째 단추의 기하에 보조 글자색.
 * 수락 · 거절보다 한 층 아래로 읽혀야 한다: 같은 무게로 서면 차단이 답처럼 보인다.
 *
 * **눌리는 자리는 글자보다 좌우로 8px 씩 넓다**(`after:`). 「차단」 · 「신고」는 글자 둘이라 폭이 32px 로
 * 손가락 과녁 44px 에 못 미쳤다. 여백을 키우면 글자가 옆으로 밀리므로 모양은 두고 투명한 덮개만 내민다 —
 * 나란히 선 둘 사이가 `gap-x-4`(16px)라 덮개 둘이 가운데서 맞닿고 겹치지 않는다.
 */
const QUIET_LINK =
  'relative inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold text-secondary underline decoration-border-strong decoration-2 underline-offset-[6px] after:absolute after:inset-y-0 after:-inset-x-2 hover:text-foreground hover:decoration-foreground active:opacity-70 disabled:opacity-55';

/**
 * 신고의 사유 · 덧붙임 칸. **`outline-none` 을 안 단다** — 초점에 두르는 것이 옅은 `ring`(`accent-soft`)과 한 단계 짙은
 * 테두리뿐이라 그것만으로는 초점이 거의 안 보인다. 전역 초점 테두리(`globals.css` 의 `@layer base`)가 선다.
 */
const FIELD =
  'min-h-11 rounded-xl border border-border bg-surface px-3 text-sm focus:border-border-strong focus:ring-2 focus:ring-accent-soft';

/** 받은 요청 카드의 동의 질문 — 공개 범위 목록 대신 결정에 필요한 한 문장만 둔다. */
export function MatchConsentQuestion() {
  return (
    <p className="rounded-2xl bg-cream px-4 py-3 text-sm leading-6 text-cream-ink">
      {MATCH_CONSENT_QUESTION}
    </p>
  );
}

/**
 * 받은 요청에 답하는 자리.
 *
 * **동의 질문은 이 버튼이 들고 있지 않다.** 카드가 열릴 때부터 위에 서 있다
 * (`page.tsx` 가 `MatchConsentQuestion` 을 세운다) — 눌러야 나타나는 고지는 「읽고 눌렀다」를
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
    return <p className="text-sm text-secondary">{REQUEST_STATUS_TEXT[settled].received}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 폰에서는 주 단추가 위에 한 줄을 다 갖는다 — 엄지가 먼저 닿는 자리다 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button type="button" onClick={() => answer(true)} disabled={working} className={BUTTON_PRIMARY}>
          {working ? '보내는 중…' : '수락하고 궁합 열기'}
        </button>
        <button type="button" onClick={() => answer(false)} disabled={working} className={BUTTON_SECONDARY}>
          거절
        </button>
      </div>

      {/* 거절이 되돌아오지 않는다는 것을 **누르기 전에** 읽힌다 */}
      <p className="text-[13px] leading-5 text-muted">{REJECTION_IS_FINAL_NOTE}</p>

      {failure !== null && (
        <p role="alert" className="text-sm text-danger">
          답하지 못했습니다 — {failure}
        </p>
      )}
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
      announceIfMoved(result);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <span className="flex items-center gap-2">
      <button type="button" onClick={cancel} disabled={working} className={QUIET_LINK}>
        {working ? '거두는 중…' : '요청 거두기'}
      </button>
      {failure !== null && <span className="text-[13px] text-danger">{failure}</span>}
    </span>
  );
}

/**
 * 차단 — **한 번 더 묻는다.**
 *
 * 살아 있던 요청까지 거두고, 성립한 Match 도 목록에서 내려간다. **되돌릴 수 없으므로**
 * 무엇이 일어나는지 읽고 누르게 한다.
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
      <button type="button" onClick={() => setAsking(true)} className={QUIET_LINK}>
        차단
      </button>
    );
  }

  return (
    <span className="flex w-full flex-col gap-2 py-2">
      <span className="text-[13px] leading-5 text-secondary">{BLOCK_NOTE}</span>
      <span className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={block}
          disabled={working}
          className={SETTINGS_DANGER}
        >
          {working ? '차단하는 중…' : '차단합니다'}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={working}
          className={QUIET_LINK}
        >
          그만두기
        </button>
      </span>
      {failure !== null && <span className="text-[13px] text-danger">{failure}</span>}
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
    return (
      <span role="status" className="text-[13px] text-secondary">
        신고를 접수했습니다. 운영자가 확인합니다.
      </span>
    );
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={QUIET_LINK}>
        신고
      </button>
    );
  }

  return (
    <span className="flex w-full flex-col gap-3 py-2">
      <span className="text-[13px] leading-5 text-secondary">{REPORT_NOTE}</span>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-secondary">신고 사유</span>
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value as ReportReason)}
          className={FIELD}
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
          rows={3}
          className={`${FIELD} py-2.5 leading-6`}
        />
      </label>

      <span className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={working}
          className={SETTINGS_DANGER}
        >
          {working ? '보내는 중…' : '신고합니다'}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={working}
          className={QUIET_LINK}
        >
          그만두기
        </button>
        {failure !== null && <span className="text-[13px] text-danger">{failure}</span>}
      </span>
    </span>
  );
}

/**
 * 소식 화면에 실제로 들어오면 읽음으로 바꾼다.
 *
 * 서버에서 처리하면 `Link` 의 미리 가져오기만으로도 읽은 셈이 된다. 브라우저에 이
 * 화면이 마운트된 뒤에만 실행해, 내 사주의 버튼·상단 내비게이션·직접 주소 입력 중
 * 어느 길로 왔든 같은 사건으로 남긴다.
 */
export function ReadNotificationsOnVisit({ unread }: { unread: number }) {
  const router = useRouter();
  const started = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (unread === 0) {
      started.current = false;
      return;
    }
    // 개발 모드의 이중 effect 와 같은 화면의 재렌더가 RPC 를 거듭 부르지 않게 한다.
    if (started.current) return;
    started.current = true;

    void (async () => {
      const result = await markNotificationsRead();
      if (result.ok) {
        // 머리글의 종은 주소가 안 바뀌면 다시 안 센다 — 읽은 것을 바로 알린다
        announceNotificationsUnreadMoved();
        router.refresh();
      } else setFailure(result.message);
    })();
  }, [router, unread]);

  if (failure === null) return null;
  return <p className="text-[13px] text-danger">읽음 처리하지 못했습니다 — {failure}</p>;
}

/**
 * 차단한 사람이 몇인지 — **누구인지는 적지 않는다.**
 *
 * 차단한 뒤에는 그 사람의 프로필을 읽을 이유가 없어서 별명을 붙들고 있지 않다.
 * 푸는 버튼도 없다 — 차단은 되돌리지 않는다(용어집).
 */
export function BlockedCount({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <p className="px-1 text-[13px] leading-5 text-muted">
      차단한 사람 {count}명. 누구인지는 여기 적지 않고, 차단은 되돌리지 않습니다.
    </p>
  );
}
