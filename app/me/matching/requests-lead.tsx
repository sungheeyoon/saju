import Link from 'next/link';

import { CONSENT_FLOW_CAVEAT, CONSENT_FLOW_STEPS, REQUEST_STATUS_TEXT } from '@/src/lib/consent';

import type { SkippableRead } from '../../db-error';
import { Icon } from '../../ui/icons';
import { CARD, ROW_CARD, ROW_CARD_FACE, TYPE_META } from '../../ui/surfaces';
import type { InboxRequest, Requests } from '../requests/inbox';
import {
  BlockButton,
  BlockedCount,
  CancelButton,
  MatchAcceptNotice,
  ReportButton,
  RespondButtons,
} from '../requests/manage';
import { when } from '../requests/when';
import type { DecidedRequest, PastRequests } from './history';
import { ElementExchange } from './element-exchange';
import { RequestFace } from './request-face';
import { RequestsBand } from './requests-band';
import { FailureLine } from '../../ui/failure-line';

/** 요청을 읽은 결과 — 못 읽었으면 까닭 한 줄이 선다. 덱은 그대로 선다 */
export type RequestsRead = SkippableRead<Requests>;

/**
 * 인연 탭 맨 위의 요청 — **후보 카드만 본 것은 궁합 동의가 아니다**(ADR 0038 · 0130).
 *
 * 여기가 동의가 일어나는 자리다. 받은 요청은 무엇이 열리는지 읽은 뒤에만 수락되고,
 * 그 수락은 판본을 다시 확인한 뒤에야 Match 가 된다(전부 `respond_to_match_request`
 * 안에서 한 트랜잭션으로).
 *
 * 이 자리가 요청에 대해 아는 것은 별명·소개·상태·채우는 오행·균형뿐이다. 여덟 글자도
 * 생년월일시도 점수도 `my_match_requests()` 의 반환형에 없다.
 *
 * ## 답할 일은 탭 맨 위 띠 한 줄, 지나간 일은 인연 기록 (ADR 0130 「2026-09-29 u2」)
 *
 * 요청은 인연에서 난 일이라 종의 「소식」에서 인연 탭으로 왔다. 이 탭의 본체는 덱이라 **빈 칸이 덱을 밀어내지 않는다** —
 * 받은 요청은 있을 때만 덱 위에 띠 한 줄로 서고 누르면 그 자리에서 카드 시트가 올라온다(`ReceivedRequests` →
 * `requests-band.tsx`). 보낸 요청 · 끝난 요청 · 차단 수는 탭 첫 화면에 안 서고 인연 기록(`/me/matching/history`)에
 * 펼쳐 선다(`PastRequestList`). 요청이 하나도 없으면 둘 다 아무것도 안 선다.
 *
 * 두 자리는 저마다 id 를 든다(`#requests-lead` · `#requests-log`) — 흐름 검사(`scripts/check-match.mjs`)가 요청이
 * 브라우저에 내주는 글자를 그 두 요소의 마크업으로만 잰다. 같은 응답에 덱과 궤도 지도가 함께 서기 때문이다.
 */
export function ReceivedRequests({ loaded }: { loaded: RequestsRead }) {
  if (!loaded.ok) {
    return <FailureLine retry>요청을 불러오지 못했어요. {loaded.reason}</FailureLine>;
  }

  const received = receivedOf(loaded.value.requests);
  if (received.length === 0) return null;

  return (
    <RequestsBand count={received.length} names={received.map((request) => request.nickname).join(' · ')}>
      <ul className="flex flex-col gap-4">
        {received.map((request) => (
          <li key={request.requestId} className={`flex flex-col gap-4 ${CARD}`}>
            <RequestHead request={request} large />
            {/*
              **동의 화면이다.** 무엇이 열리는지는 눌러야 나타나는 것이 아니라
              카드가 열릴 때부터 버튼 위에 서 있다 — 읽지 않고 누른 수락은 동의가
              아니고, 눌러야 나타나는 고지는 밖에서 잴 수도 없다.
            */}
            <MatchAcceptNotice side="received" />
            <RespondButtons requestId={request.requestId} nickname={request.nickname} />
            {/*
              신고는 **상대가 나에게 한 일**이 있는 자리에만 둔다 — 받은 요청과
              성립한 Match. 내가 보낸 요청 카드에는 두지 않는다.
            */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2">
              <BlockButton userId={request.counterpartUserId} nickname={request.nickname} />
              <ReportButton userId={request.counterpartUserId} />
            </div>
          </li>
        ))}
      </ul>
      <ConsentGuide />
    </RequestsBand>
  );
}

/**
 * 지난 요청 — 보낸 요청 · 끝난 요청 · 차단 수. 인연 기록 화면에 **펼쳐** 선다(접이칸이던 것, 2026-09-29 u2).
 *
 * 받은 요청이 없으면 진행 안내가 여기 든다 — 있으면 받은 요청 시트 아래에 이미 선다.
 */
export function PastRequestList({ past, guide }: { past: PastRequests; guide: boolean }) {
  const { sent, decided, blocked } = past;
  if (sent.length === 0 && decided.length === 0 && blocked === 0) return null;

  return (
    <div id="requests-log" className="flex flex-col gap-5">
      {sent.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-body font-bold text-secondary">보낸 요청</h3>
          <ul className="flex flex-col gap-2">
            {sent.map((request) => (
              <li key={request.requestId} className={`${ROW_CARD} flex flex-col gap-2`}>
                <RequestHead request={request} />
                <p className="text-sm leading-6 text-secondary">{REQUEST_STATUS_TEXT.pending.sent}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-1">
                  <CancelButton requestId={request.requestId} />
                  <BlockButton userId={request.counterpartUserId} nickname={request.nickname} />
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
  );
}

export const receivedOf = (requests: readonly InboxRequest[]) =>
  requests.filter((request) => request.direction === 'received' && request.status === 'pending');

/** 접이칸 한 줄 — 제목 줄이 44px 을 넘고 끝의 셰브론이 펴지면 아래를 본다 */
const FOLD = `${ROW_CARD_FACE} group px-4`;
const FOLD_SUMMARY =
  'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden';

function FoldMark() {
  return (
    <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">
      <Icon name="chevron" className="size-4" />
    </span>
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
            <span className="grid size-7 place-items-center rounded-full bg-cream text-small font-bold text-cream-ink">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="mt-1 text-small leading-5 text-secondary">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-border py-4 text-small leading-5 text-muted">{CONSENT_FLOW_CAVEAT}</p>
    </details>
  );
}

/**
 * 끝난 요청 — 상태와 날짜, 왜 끝났는지 한 줄.
 *
 * **성립한 줄은 줄 전체가 그 인연 궁합으로 가는 링크다**(ADR 0130 「2026-10-11」) — 새 글자 없이 끝의 셰브론이 「간다」를 말한다
 * (인연 기록 한 줄 · 설정 목록과 같은 모양). 그 Match 를 지금 못 열면(차단 · 정지) 줄은 글자로만 선다(`matchHref` 가 `null`).
 */
function DecidedRequests({ requests }: { requests: readonly DecidedRequest[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body font-bold text-secondary">끝난 요청</h3>
      <ul className="flex flex-col divide-y divide-border text-sm">
        {requests.map((request) => (
          <li key={request.requestId}>
            {request.matchHref === null ? (
              <div className="py-3">
                <DecidedLine request={request} />
              </div>
            ) : (
              <Link
                href={request.matchHref}
                className="group -mx-2 flex min-h-11 items-center gap-3 rounded-cell px-2 py-3 active:opacity-70"
              >
                <span className="min-w-0 flex-1">
                  <DecidedLine request={request} />
                </span>
                <Icon name="chevron" className="size-4 shrink-0 text-muted" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DecidedLine({ request }: { request: DecidedRequest }) {
  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <strong className="font-semibold group-hover:underline">{request.nickname}</strong>
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-fine font-medium text-secondary">
          {REQUEST_STATUS_TEXT[request.status].label}
        </span>
        <span className={`ml-auto ${TYPE_META}`}>{when(request.decidedAt ?? request.createdAt)}</span>
      </span>
      <span className="text-small leading-5 text-secondary">
        {request.direction === 'sent'
          ? REQUEST_STATUS_TEXT[request.status].sent
          : REQUEST_STATUS_TEXT[request.status].received}
      </span>
    </span>
  );
}

/**
 * 요청 한 장의 머리 — 닉네임·사진·소개와 **양쪽 방향의 오행**. 얼굴 · 이름 줄을 누르면 상대 프로필 시트가 열린다(`RequestFace`, G-103)
 */
function RequestHead({ request, large = false }: { request: InboxRequest; large?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <RequestFace
        large={large}
        partner={{
          userId: request.counterpartUserId,
          nickname: request.nickname,
          intro: request.intro,
          photoUrls: request.photoUrls,
          photoFocus: request.photoFocuses,
          tone: null,
        }}
        meta={
          <time dateTime={request.createdAt} className={`block ${TYPE_META}`}>
            {when(request.createdAt)}
          </time>
        }
      />

      {request.intro !== null && <p className="text-sm leading-6 text-secondary">{request.intro}</p>}

      {/* 내 자리 기준이다 — 방향은 DB 가 뒤집어 준다 */}
      <ElementExchange exchange={request} partner={{ nickname: request.nickname }} />
    </div>
  );
}
