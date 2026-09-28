import { CONSENT_FLOW_CAVEAT, CONSENT_FLOW_STEPS, REQUEST_STATUS_TEXT } from '@/src/lib/consent';

import { Icon } from '../../ui/icons';
import { BADGE, CARD, ROW_CARD, TYPE_META, TYPE_NAME, TYPE_SECTION } from '../../ui/surfaces';
import { Avatar } from '../avatar';
import type { InboxRequest, Requests } from '../requests/inbox';
import {
  BlockButton,
  BlockedCount,
  CancelButton,
  MatchConsentQuestion,
  ReportButton,
  RespondButtons,
} from '../requests/manage';
import { when } from '../requests/when';

/** 요청을 읽은 결과 — 못 읽었으면 까닭 한 줄이 선다. 덱은 그대로 선다 */
export type RequestsRead = { readonly ok: true; readonly value: Requests } | { readonly ok: false; readonly message: string };

/**
 * 인연 탭 맨 위의 요청 — **후보 카드만 본 것은 궁합 동의가 아니다**(ADR 0038 · 0129).
 *
 * 여기가 동의가 일어나는 자리다. 받은 요청은 무엇이 열리는지 읽은 뒤에만 수락되고,
 * 그 수락은 판본을 다시 확인한 뒤에야 Match 가 된다(전부 `respond_to_match_request`
 * 안에서 한 트랜잭션으로).
 *
 * 이 자리가 요청에 대해 아는 것은 별명·소개·상태·채우는 오행·균형뿐이다. 여덟 글자도
 * 생년월일시도 점수도 `my_match_requests()` 의 반환형에 없다.
 *
 * ## 답할 일만 펼치고, 나머지는 한 줄로 접는다 (ADR 0129)
 *
 * 전에는 종의 「소식」 화면에 받은 요청 · 보낸 요청 · 새 소식이 함께 살았다. 요청은 인연에서 난 일이라 인연 탭으로
 * 왔고, 종에는 소식만 남았다. 이 탭의 본체는 덱이라 **빈 칸이 덱을 밀어내지 않는다** — 받은 요청은 있을 때만 크게
 * 서고, 보낸 요청 · 끝난 요청 · 차단 수는 한 줄 접이칸에 든다. 요청이 하나도 없으면 아무것도 안 선다.
 */
export function RequestsLead({ loaded }: { loaded: RequestsRead }) {
  if (!loaded.ok) {
    return <p className="text-sm text-muted">요청을 읽지 못했습니다 — {loaded.message}</p>;
  }

  const { requests, blocked } = loaded.value;
  const received = requests.filter((request) => request.direction === 'received' && request.status === 'pending');
  const sent = requests.filter((request) => request.direction === 'sent' && request.status === 'pending');
  const decided = requests.filter((request) => request.status !== 'pending');

  if (received.length === 0 && sent.length === 0 && decided.length === 0 && blocked === 0) return null;

  return (
    <div id="requests-lead" className="flex flex-col gap-3">
      {received.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHead title="받은 요청" count={received.length} />
          <ul className="flex flex-col gap-4">
            {received.map((request) => (
              <li key={request.requestId} className={`flex flex-col gap-4 ${CARD}`}>
                <RequestHead request={request} large />
                {/*
                  **동의 화면이다.** 무엇이 열리는지는 눌러야 나타나는 것이 아니라
                  카드가 열릴 때부터 버튼 위에 서 있다 — 읽지 않고 누른 수락은 동의가
                  아니고, 눌러야 나타나는 고지는 밖에서 잴 수도 없다.
                */}
                <MatchConsentQuestion />
                <RespondButtons requestId={request.requestId} />
                {/*
                  신고는 **상대가 나에게 한 일**이 있는 자리에만 둔다 — 받은 요청과
                  성립한 Match. 내가 보낸 요청 카드에는 두지 않는다.
                */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2">
                  <BlockButton userId={request.counterpartUserId} />
                  <ReportButton userId={request.counterpartUserId} />
                </div>
              </li>
            ))}
          </ul>
          <ConsentGuide />
        </section>
      )}

      {(sent.length > 0 || decided.length > 0 || blocked > 0) && (
        <RequestLog sent={sent} decided={decided} blocked={blocked} guide={received.length === 0} />
      )}
    </div>
  );
}

/** 절 제목 — 수는 딱지로 */
function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className={TYPE_SECTION}>{title}</h2>
      {count > 0 && <span className={BADGE}>{count}</span>}
    </div>
  );
}

/** 접이칸 한 줄 — 제목 줄이 44px 을 넘고 끝의 셰브론이 펴지면 아래를 본다 */
const FOLD = `${ROW_CARD} group py-0`;
const FOLD_SUMMARY =
  'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden';

function FoldMark() {
  return (
    <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">
      <Icon name="chevron" className="size-4" />
    </span>
  );
}

/**
 * 보낸 요청 · 끝난 요청 · 차단 수 — **한 줄로 접힌다.** 답할 일이 아니라 기다리거나 지나간 일이라 덱보다 앞에 펼치지
 * 않는다. 제목 줄이 수를 말하므로 열지 않아도 무엇이 있는지 보인다.
 */
function RequestLog({
  sent,
  decided,
  blocked,
  guide,
}: {
  sent: readonly InboxRequest[];
  decided: readonly InboxRequest[];
  blocked: number;
  /** 받은 요청이 없으면 진행 안내가 여기 든다 — 있으면 받은 요청 아래에 이미 선다 */
  guide: boolean;
}) {
  const parts = [
    sent.length > 0 ? `보낸 요청 ${sent.length}개` : null,
    decided.length > 0 ? `끝난 요청 ${decided.length}개` : null,
  ].filter((part) => part !== null);

  return (
    <details className={FOLD}>
      <summary className={`${FOLD_SUMMARY} text-secondary`}>
        {parts.length > 0 ? parts.join(' · ') : '요청 기록'}
        <FoldMark />
      </summary>
      <div className="flex flex-col gap-5 border-t border-border py-4">
        {sent.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className={TYPE_SECTION}>보낸 요청</h2>
            <ul className="flex flex-col gap-2">
              {sent.map((request) => (
                <li key={request.requestId} className={`${ROW_CARD} flex flex-col gap-2`}>
                  <RequestHead request={request} />
                  <p className="text-sm leading-6 text-secondary">{REQUEST_STATUS_TEXT.pending.sent}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-1">
                    <CancelButton requestId={request.requestId} />
                    <BlockButton userId={request.counterpartUserId} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/*
          끝난 요청도 남긴다. **왜 사라졌는지**를 말할 수 있어야 하기 때문이다 —
          무효와 거둠은 둘 다 「성립하지 않았다」지만 이유가 다르다(US 43).
        */}
        {decided.length > 0 && <DecidedRequests requests={decided} />}

        {guide && <ConsentGuide />}
        <BlockedCount count={blocked} />
      </div>
    </details>
  );
}

function ConsentGuide() {
  return (
    <details className={FOLD}>
      <summary className={FOLD_SUMMARY}>
        궁합 요청은 어떻게 진행되나요?
        <FoldMark />
      </summary>
      <ol className="flex flex-col gap-4 border-t border-border py-4">
        {CONSENT_FLOW_STEPS.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[1.75rem_1fr] gap-3">
            <span className="grid size-7 place-items-center rounded-full bg-cream text-[13px] font-bold text-cream-ink">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="mt-1 text-[13px] leading-5 text-secondary">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-border py-4 text-[13px] leading-5 text-muted">{CONSENT_FLOW_CAVEAT}</p>
    </details>
  );
}

function DecidedRequests({ requests }: { requests: readonly InboxRequest[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={TYPE_SECTION}>끝난 요청</h2>
      <ul className="flex flex-col divide-y divide-border text-sm">
        {requests.map((request) => (
          <li key={request.requestId} className="flex flex-col gap-1 py-3">
            <span className="flex flex-wrap items-center gap-2">
              <strong className="font-semibold">{request.nickname}</strong>
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[12px] font-medium text-secondary">
                {REQUEST_STATUS_TEXT[request.status].label}
              </span>
              <span className={`ml-auto ${TYPE_META}`}>{when(request.decidedAt ?? request.createdAt)}</span>
            </span>
            <span className="text-[13px] leading-5 text-secondary">
              {request.direction === 'sent'
                ? REQUEST_STATUS_TEXT[request.status].sent
                : REQUEST_STATUS_TEXT[request.status].received}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 요청 한 장의 머리 — 닉네임·사진·소개와 **양쪽 방향의 오행** */
function RequestHead({ request, large = false }: { request: InboxRequest; large?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar
          userId={request.counterpartUserId}
          nickname={request.nickname}
          hasPhoto={request.hasPhoto}
          size={large ? 52 : 40}
        />
        <div className="min-w-0 flex-1">
          <h3 className={large ? TYPE_NAME : 'text-base font-semibold'}>{request.nickname}</h3>
          <time dateTime={request.createdAt} className={`block ${TYPE_META}`}>
            {when(request.createdAt)}
          </time>
        </div>
      </div>

      {request.intro !== null && <p className="text-sm leading-6 text-secondary">{request.intro}</p>}

      {/* 내 자리 기준이다 — 방향은 DB 가 뒤집어 준다 */}
      <div className="flex flex-wrap gap-2">
        {request.suppliedToMe !== null && <InfoChip>{request.suppliedToMe}</InfoChip>}
        {request.suppliedToThem !== null && <InfoChip>{request.suppliedToThem}</InfoChip>}
        <InfoChip>{request.balanceLabel}</InfoChip>
      </div>
    </div>
  );
}

function InfoChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-xl bg-surface-sunken px-3 py-1.5 text-[13px] font-medium leading-5 text-secondary">
      {children}
    </span>
  );
}
