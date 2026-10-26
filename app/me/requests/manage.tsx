'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { announceIfMoved } from '../credits/credits-signal';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { announceNotificationsUnreadMoved, announceRequestsToAnswerMoved } from './unread-signal';

import { REPORT_DONE, REPORT_NOTE } from '@/src/lib/account';
import {
  MATCH_ACCEPT_HEAD,
  MATCH_ACCEPT_HIDDEN,
  MATCH_ACCEPT_OPENS,
  REJECTION_IS_FINAL_NOTE,
  REQUEST_STATUS_TEXT,
  type RequestStatus,
} from '@/src/lib/consent';
import { CANCEL_REQUEST_LABEL, CANCEL_REQUEST_NOTE } from '@/src/lib/matching';
import { CANCEL_REQUEST_TITLE } from '@/src/lib/matching/copy';

import {
  cancelRequest,
  markNotificationsRead,
  reportUser,
  respondToRequest,
} from './actions';
import { BlockDialog, ReportForm } from './report-block';
import { cancelledNote } from './cancel-answer';
import { actionAnswer } from '../../ui/action-answer';
import { FailureLine } from '../../ui/failure-line';
import { showSnackbar } from '../../ui/snackbar-store';

/**
 * 카드 밑단의 조용한 누름(차단 · 신고 · 요청 취소) — 셋째 단추의 기하에 보조 글자색, **밑줄 없이**(운영자 2026-10-26).
 * 수락 · 거절보다 한 층 아래로 읽혀야 한다: 같은 무게로 서면 차단이 답처럼 보인다.
 *
 * **눌리는 자리는 글자보다 좌우로 8px 씩 넓다**(`after:`). 「차단」 · 「신고」는 글자 둘이라 폭이 32px 로
 * 손가락 과녁 44px 에 못 미쳤다. 여백을 키우면 글자가 옆으로 밀리므로 모양은 두고 투명한 덮개만 내민다 —
 * 나란히 선 둘 사이가 `gap-x-4`(16px)라 덮개 둘이 가운데서 맞닿고 겹치지 않는다.
 */
const QUIET_LINK =
  'relative inline-flex min-h-11 items-center rounded-cell px-1 text-sm font-semibold text-secondary after:absolute after:inset-y-0 after:-inset-x-2 hover:text-foreground active:opacity-70 disabled:opacity-55';

/**
 * 수락하면 무엇이 일어나는가 — **받은 요청 카드와 보내는 확인 창이 같은 한 벌을 읽는다**(ADR 0008, 운영자 결정 2026-10-26 A안).
 * 머리만 자리마다 다르다(`MATCH_ACCEPT_HEAD`) — 받은 카드는 「수락하면」, 보내는 창은 「상대가 수락하면」. 토스 TDS `BottomInfo` 처럼
 * 고지는 짧은 목록으로 둔다.
 */
export function MatchAcceptNotice({ side }: { side: keyof typeof MATCH_ACCEPT_HEAD }) {
  return (
    <div className="rounded-cell bg-cream px-4 py-3 text-sm leading-6 text-cream-ink">
      <p className="font-semibold">{MATCH_ACCEPT_HEAD[side]}</p>
      <ul className="mt-1 list-disc pl-5">
        {MATCH_ACCEPT_OPENS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-1 text-small">{MATCH_ACCEPT_HIDDEN}</p>
    </div>
  );
}

/**
 * 받은 요청에 답하는 자리.
 *
 * **동의 질문은 이 버튼이 들고 있지 않다.** 카드가 열릴 때부터 위에 서 있다
 * (인연 탭의 `requests-lead.tsx` 가 `MatchAcceptNotice` 를 세운다) — 눌러야 나타나는 고지는 「읽고 눌렀다」를
 * 보장하지 못하고, 서버가 내려보낸 화면에 그 문장이 있는지 밖에서 잴 수도 없다.
 *
 * **거절은 한 번 더 묻는다**(운영자 결정 2026-10-11) — 거절하면 그 사람은 다시 안 나타난다. 그 경고는 카드에 늘 서 있지 않고
 * 거절을 누른 그때 창에 선다(「경고는 되돌릴 수 없는 누름 직전에 선다」, `docs/context/copy.md` §8). 창의 첫 초점은 「취소」다.
 *
 * **결과를 상태로 받는다.** 수락을 눌렀는데 무효가 나오는 경우가 실재한다 — 그 사이에
 * 낀 판본 수정이다. 그때 「수락했습니다」라고 말하면 사용자는 없는 Match 를 찾는다.
 *
 * **수락이 성립하면 그 Match 의 채팅방으로 간다**(ADR 0130 「2026-10-11 저녁」) — 단추 이름이 약속한 대로. 궁합풀이는 그동안
 * 만들어지고 방 머리의 궁합 단추가 그 상태를 든다. 액션이 그 Match 를 못 찾았으면 옮기지 않고 카드만 내려간다.
 */
export function RespondButtons({ requestId, nickname }: { requestId: string; nickname: string }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [settled, setSettled] = useState<RequestStatus | null>(null);
  const [asking, setAsking] = useState(false);
  const [working, startWorking] = useTransition();
  const router = useRouter();

  const answer = (accept: boolean) => {
    setFailure(null);
    startWorking(async () => {
      const result = await actionAnswer(respondToRequest(requestId, accept));
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      setAsking(false);
      // 무효로 끝났으면 그렇게 말한다. 「수락했습니다」로 뭉뚱그리면 없는 Match 를 찾게 된다.
      if (result.status !== 'accepted' && result.status !== 'rejected') {
        setSettled(result.status);
      }
      // 인연 탭의 딱지는 주소가 안 바뀌면 다시 안 센다 — 답한 것을 바로 알린다(ADR 0130)
      announceRequestsToAnswerMoved();
      if (result.status === 'accepted' && result.matchId !== undefined) {
        router.push(`/me/chat/${result.matchId}`);
      }
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
          {working && !asking ? '보내는 중…' : '수락하고 대화하기'}
        </button>
        <button type="button" onClick={() => setAsking(true)} disabled={working} className={BUTTON_SECONDARY}>
          거절
        </button>
      </div>

      {failure !== null && !asking && (
        <FailureLine>답하지 못했어요. {failure}</FailureLine>
      )}

      <ConfirmDialog
        open={asking}
        onClose={() => {
          setAsking(false);
          setFailure(null);
        }}
        title={`${nickname} 님의 요청을 거절할까요?`}
        confirmLabel={working ? '보내는 중…' : '거절하기'}
        onConfirm={() => answer(false)}
        danger
        busy={working}
        failure={failure === null ? null : `답하지 못했어요. ${failure}`}
      >
        <p>{REJECTION_IS_FINAL_NOTE}</p>
      </ConfirmDialog>
    </div>
  );
}

/**
 * 보낸 요청을 취소한다(용어로는 **거둠**, `cancelled`) — 상대에게 알리지 않는다.
 *
 * **화면 글자는 「취소」다**(운영자 결정 2026-10-26 — 「거두다」는 한국 서비스에서 안 쓰는 말). 용어집의 개념 이름은 거둠 그대로다
 * (`docs/context/matching.md`).
 *
 * **한 번 더 묻는다**(2026-10-24). 취소한 요청은 서버에서 되살릴 길이 없다 — 문(`cancel_match_request`)은 끝 상태로만 옮기고, 같은
 * 사람에게 다시 보내면 풀이권을 새로 잡고 상대에게 「요청이 왔다」는 소식이 한 번 더 간다. 그래서 바닥 스낵바의 「되돌리기」로는 못
 * 무른다 — 되돌릴 수 없는 누름 앞의 확인 창(`ConfirmDialog`, 첫 초점은 닫기)이다. 실행이 「요청 취소」라 **닫기는 「닫기」다** —
 * 한 창에 「취소」 · 「요청 취소」가 함께 서면 어느 쪽이 무르는 것인지 헷갈린다(대장 01 의 예외, 운영 환불 창과 같은 꼴). 단추 둘은
 * 나란히 선다(`actions="row"`) — 당근 SEED Alert Dialog(가로 배열이 기본) · 토스 TDS `ConfirmDialog`(왼쪽 닫기 · 오른쪽 실행). 취소하면
 * 카드가 목록에서 빠지므로 끝난 말은 카드 곁이 아니라 바닥 스낵바에 선다(`cancelledNote`).
 */
export function CancelButton({ requestId }: { requestId: string }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [working, startWorking] = useTransition();

  const cancel = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await actionAnswer(cancelRequest(requestId));
      announceIfMoved(result);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      setAsking(false);
      const note = cancelledNote(result.status);
      if (note !== null) showSnackbar(note);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setAsking(true)} disabled={working} className={QUIET_LINK}>
        {CANCEL_REQUEST_LABEL}
      </button>
      {failure !== null && !asking && <FailureLine>{failure}</FailureLine>}

      <ConfirmDialog
        open={asking}
        onClose={() => {
          setAsking(false);
          setFailure(null);
        }}
        title={CANCEL_REQUEST_TITLE}
        confirmLabel={working ? '취소하는 중…' : CANCEL_REQUEST_LABEL}
        cancelLabel="닫기"
        onConfirm={cancel}
        danger
        busy={working}
        failure={failure}
        actions="row"
        irreversible={CANCEL_REQUEST_NOTE}
      >
        <p>
          임시로 차감된 <strong>풀이권 1장</strong>은 바로 돌려드려요.
        </p>
      </ConfirmDialog>
    </div>
  );
}

/**
 * 차단 — **한 번 더 묻는다.**
 *
 * 살아 있던 요청까지 거두고, 성립한 Match 도 목록에서 내려간다. **되돌릴 수 없으므로**
 * 무엇이 일어나는지 읽고 누르게 한다. 묻는 창은 「⋯」의 차단과 같은 창이다(`BlockDialog`).
 */
export function BlockButton({ userId, nickname }: { userId: string; nickname: string }) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAsking(true)} className={QUIET_LINK}>
        차단
      </button>
      <BlockDialog userId={userId} nickname={nickname} open={asking} onClose={() => setAsking(false)} />
    </>
  );
}

/**
 * 신고 — **차단 옆에 서되 같은 무게로 읽히지 않게 한다.**
 *
 * 나란한 두 버튼이 같아 보이면 운영자가 봐야 할 일이 조용한 차단으로 끝나거나 그
 * 반대가 된다. 그래서 무엇이 다른지를 사유를 고르는 자리에서 먼저 읽힌다. 칸은 「⋯」의 신고 창 · 대화방과 같은 폼이다(`ReportForm`).
 */
export function ReportButton({ userId }: { userId: string }) {
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <>
      {/*
        보낸 뒤에는 **무엇이 일어나는지**를 말한다. 「신고했습니다」로 끝내면 상대에게
        무슨 일이 났는지 모른 채 기다리게 된다 — 아무 일도 나지 않는 것이 답이다. 그 자리는 늘 있고 보낸 그때 글이 든다.
      */}
      <span role="status" className="text-small text-secondary empty:hidden">
        {done ? REPORT_DONE : ''}
      </span>
      {!done && !asking && (
        <button type="button" onClick={() => setAsking(true)} className={QUIET_LINK}>
          신고
        </button>
      )}
      {!done && asking && (
        <span className="flex w-full flex-col gap-3 py-2">
          <span className="text-small leading-5 text-secondary">{REPORT_NOTE}</span>
          <ReportForm
            send={(reason, detail) => actionAnswer(reportUser(userId, reason, detail))}
            onDone={() => {
              setDone(true);
              setAsking(false);
            }}
            onCancel={() => setAsking(false)}
          />
        </span>
      )}
    </>
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
      const result = await actionAnswer(markNotificationsRead());
      if (result.ok) {
        // 머리글의 종은 주소가 안 바뀌면 다시 안 센다 — 읽은 것을 바로 알린다
        announceNotificationsUnreadMoved();
      } else setFailure(result.message);
    })();
  }, [unread]);

  if (failure === null) return null;
  return <FailureLine retry>소식을 읽은 것으로 표시하지 못했어요.</FailureLine>;
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
    <p className="px-1 text-small leading-5 text-muted">
      차단한 사람 {count}명. 누구인지는 여기 적지 않고, 차단은 되돌리지 않습니다.
    </p>
  );
}
