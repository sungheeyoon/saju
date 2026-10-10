'use client';

import { useRef, useState, useTransition, type ReactNode } from 'react';

import {
  REPORT_DETAIL_MAX,
  REPORT_DONE,
  REPORT_NOTE,
  REPORT_REASONS,
  type ReportReason,
} from '@/src/lib/account';
import { BLOCK_NOTE } from '@/src/lib/consent';

import type { SaveResult } from '../../save-result';
import { BUTTON_DANGER, BUTTON_PRIMARY_SMALL, BUTTON_SECONDARY, BUTTON_TERTIARY, ICON_BUTTON } from '../../ui/buttons';
import { useDetailsMenu } from '../../ui/details-menu';
import { Icon } from '../../ui/icons';
import { DIALOG } from '../../ui/surfaces';
import { blockUser, reportUser } from './actions';
import { announceRequestsToAnswerMoved } from './unread-signal';

/**
 * **신고 · 차단 한 벌 — 대화방 머리 · 인연 궁합 머리 · 오늘의 인연 카드가 같은 「⋯」를 연다**(ADR 0158).
 *
 * 차단은 인연 궁합 글 끝(설문 뒤 약 3000px)에 혼자 있었고, 후보 카드에는 신고도 차단도 없었다(화면 감사 2026-10-09 C2).
 * 셋이 같은 모양을 쓰도록 대화방의 「⋯」를 여기로 옮겼다. 신고는 사람에게 건다(`report_user`) — 대화방만 메시지를 골라
 * 근거를 붙일 수 있고, 그것도 고르지 않아도 된다(C1).
 */

/** 머리의 아이콘 단추 — 판 위에 테 없이 선다. 누를 자리는 44px 그대로다 */
const GHOST_ICON =
  'grid size-11 shrink-0 place-items-center rounded-full text-foreground hover:bg-surface-soft active:scale-95';

/** 사진 위의 단추 — 카드의 ⓘ 와 같은 반투명 검정 동그라미. 사진이 희어도 읽힌다 */
const ON_PHOTO_ICON =
  'grid size-11 place-items-center rounded-full bg-black/50 text-white shadow-[0_2px_8px_rgb(0_0_0/0.25)] ring-1 ring-white/30 backdrop-blur-sm';

const FIELD =
  'rounded-xl bg-surface px-3 text-[16px] text-foreground ring-1 ring-border outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]';

/** 「⋯」가 서는 판 — 흰 판 위(`plain`)인가 사진 위(`photo`)인가 */
export type MenuLook = 'plain' | 'photo';

/**
 * 「⋯」 — 신고 · 차단. `canBlock` 이 거짓이면(닫힌 방 — 이미 끊겼다) 신고만 남는다.
 *
 * 여는 방식은 계정 메뉴 · 사람 관리 메뉴와 같다 — `<details>` 하나에 바깥 누름과 Esc 로 닫는 자리를 단다
 * (`useDetailsMenu`). Esc 로 닫으면 초점이 「⋯」로 돌아온다. 고르면 먼저 닫고 그 칸을 세운다.
 */
export function ReportBlockMenu({
  canBlock,
  onReport,
  onBlock,
  look = 'plain',
  className = '',
}: {
  canBlock: boolean;
  onReport: () => void;
  onBlock: () => void;
  look?: MenuLook;
  className?: string;
}) {
  const { menu, close } = useDetailsMenu();
  const item = 'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-semibold hover:bg-surface-soft active:bg-surface-sunken';

  return (
    <details ref={menu} className={`${className || 'relative'} shrink-0`}>
      <summary
        aria-label="신고 · 차단"
        className={`${look === 'photo' ? ON_PHOTO_ICON : GHOST_ICON} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        <Icon name="more" />
      </summary>
      <div className="absolute right-0 top-12 z-20 flex w-48 flex-col rounded-[1.25rem] bg-surface p-1.5 shadow-float ring-1 ring-border">
        <button
          type="button"
          className={`${item} text-foreground`}
          onClick={() => {
            close();
            onReport();
          }}
        >
          <Icon name="flag" className="size-[18px]" />
          신고
        </button>
        {canBlock && (
          <button
            type="button"
            className={`${item} text-danger`}
            onClick={() => {
              close();
              onBlock();
            }}
          >
            <Icon name="block" className="size-[18px]" />
            차단
          </button>
        )}
      </div>
    </details>
  );
}

/**
 * 신고의 사유 · 덧붙일 말 칸과 보내는 단추 — 어디서 서든 같은 폼이다. **누구에게 무엇으로 거는지는 부르는 쪽이 정한다**
 * (`send`) — 대화방은 메시지를 골랐으면 메시지 신고, 아니면 사람 신고다. 사유 넷과 덧붙이는 말의 길이는 신고와 같다.
 *
 * `onBlock` 이 오면 「차단으로 넘어가기」가 선다 — 신고만으로는 그 사람이 안 사라진다(`REPORT_NOTE`).
 */
export function ReportForm({
  send,
  onDone,
  onBlock,
}: {
  send: (reason: ReportReason, detail: string) => Promise<SaveResult>;
  onDone: () => void;
  onBlock?: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0].value);
  const [detail, setDetail] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const submit = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await send(reason, detail);
      if (result.ok) onDone();
      else setFailure(result.message);
    });
  };

  return (
    <div className="flex flex-col gap-3">
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
          rows={3}
          className={`${FIELD} py-2.5 leading-6`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={submit} disabled={working} className={BUTTON_PRIMARY_SMALL}>
          {working ? '보내는 중…' : '신고하기'}
        </button>
        {onBlock !== undefined && (
          <button type="button" onClick={onBlock} disabled={working} className={`${BUTTON_TERTIARY} text-danger`}>
            차단으로 넘어가기
          </button>
        )}
      </div>
      {failure !== null && <p role="alert" className="text-[13px] text-danger">{failure}</p>}
    </div>
  );
}

/**
 * 차단 — 두 걸음: 알림 글과 확인 단추. 되돌릴 수 없어서 위험 색의 주 단추다.
 *
 * 차단은 그 사람의 요청을 거둔다 — 답할 요청 수가 줄 수 있어 인연 탭의 딱지에 알린다(`BlockButton` 과 같다).
 */
export function BlockConfirm({
  userId,
  onCancel,
  onBlocked,
}: {
  userId: string;
  onCancel: () => void;
  onBlocked?: () => void;
}) {
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const block = () => {
    setFailure(null);
    startWorking(async () => {
      // 액션의 응답이 이 화면을 다시 그린다(`requests-changed` 의 `THIS_SCREEN`) — 방은 닫히고, 궁합은 닫힌다
      const result = await blockUser(userId);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      announceRequestsToAnswerMoved();
      onBlocked?.();
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-danger-wash p-4 ring-1 ring-danger/30">
      <p className="flex items-center gap-2 text-[15px] font-bold text-danger">
        <Icon name="block" className="size-[18px]" />
        차단
      </p>
      <p className="text-[14px] leading-6 text-foreground">{BLOCK_NOTE}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={block} disabled={working} className={BUTTON_DANGER}>
          {working ? '차단하는 중…' : '차단하기'}
        </button>
        <button type="button" onClick={onCancel} disabled={working} className={BUTTON_SECONDARY}>
          취소
        </button>
        {failure !== null && <span role="alert" className="text-[13px] text-danger">{failure}</span>}
      </div>
    </div>
  );
}

type Step = 'report' | 'block' | 'reported';

/**
 * **한 사람을 신고 · 차단하는 「⋯」와 그 창** — 인연 궁합 머리와 오늘의 인연 카드가 쓴다. 대화방은 입력 자리에 칸을
 * 세우므로(`room.tsx`) 메뉴와 폼만 빌려 간다.
 *
 * 신고는 사람에게 건다(`report_user`) — 마주친 적 있는 사람이어야 하고(후보로 봤거나 · 요청을 주고받았거나 · 매칭),
 * 그 판정은 DB 가 한다. 신고가 끝나면 접수 문장과 「차단하기」가 함께 선다 — 신고만으로는 그 사람이 안 사라진다.
 */
export function ReportBlock({
  userId,
  nickname,
  look = 'plain',
  className,
  onBlocked,
}: {
  userId: string;
  nickname: string;
  look?: MenuLook;
  className?: string;
  /** 차단이 끝났다 — 카드는 덱에서 그 사람을 뺀다. 화면이 다시 그려지는 자리(인연 궁합)는 안 넘긴다 */
  onBlocked?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>('report');
  /* 폼은 열 때마다 새로 선다 — 지난번에 적다 만 사유가 남지 않게 */
  const [round, setRound] = useState(0);

  const open = (next: Step) => {
    setStep(next);
    setRound((now) => now + 1);
    if (dialog.current !== null && !dialog.current.open) dialog.current.showModal();
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <ReportBlockMenu canBlock look={look} className={className} onReport={() => open('report')} onBlock={() => open('block')} />
      <dialog
        ref={dialog}
        aria-label={step === 'block' ? `${nickname} 님 차단` : `${nickname} 님 신고`}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
          if (event.target === event.currentTarget && outside) close();
        }}
        className={`${DIALOG} max-h-[85dvh] overflow-y-auto`}
      >
        <div key={round} className="flex flex-col gap-3">
          {step === 'block' ? (
            <BlockConfirm
              userId={userId}
              onCancel={close}
              onBlocked={() => {
                close();
                onBlocked?.();
              }}
            />
          ) : (
            <>
              <DialogHead title={`${nickname} 님 신고`} onClose={close} closeLabel={step === 'reported' ? '닫기' : '작성 그만두기'} />
              {step === 'reported' ? (
                <>
                  <p role="status" className="text-[14px] leading-6 text-secondary">{REPORT_DONE}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button type="button" onClick={close} className={BUTTON_PRIMARY_SMALL}>
                      닫기
                    </button>
                    <button type="button" onClick={() => setStep('block')} className={`${BUTTON_TERTIARY} text-danger`}>
                      차단으로 넘어가기
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] leading-5 text-secondary">{REPORT_NOTE}</p>
                  <ReportForm
                    send={(reason, detail) => reportUser(userId, reason, detail)}
                    onDone={() => setStep('reported')}
                    onBlock={() => setStep('block')}
                  />
                </>
              )}
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

function DialogHead({ title, onClose, closeLabel }: { title: ReactNode; onClose: () => void; closeLabel: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="flex items-center gap-2 pt-2.5 text-[15px] font-bold text-foreground">
        <Icon name="flag" className="size-[18px] text-danger" />
        {title}
      </p>
      <button type="button" aria-label={closeLabel} onClick={onClose} className={ICON_BUTTON}>
        <Icon name="close" className="size-[18px]" />
      </button>
    </div>
  );
}
