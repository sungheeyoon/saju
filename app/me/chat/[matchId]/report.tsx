'use client';

import { REPORT_NOTE } from '@/src/lib/account';

import { ICON_BUTTON } from '../../../ui/buttons';
import { Icon } from '../../../ui/icons';
import { reportUser } from '../../requests/actions';
import { ReportForm } from '../../requests/report-block';
import { reportChatMessage } from '../actions';

/**
 * 대화방의 신고 — 입력 자리에 선다. **메시지 고르기는 선택이다**(운영자 결정 2026-10-09, ADR 0158).
 *
 * 예전에는 고르기 전에 「신고할 메시지를 골라 주세요」만 섰다. 상대 말이 없거나 · 보이는 200건 밖이거나 · 떠난 사람이면
 * 고를 것이 없어 막다른 길이었다(화면 감사 2026-10-09 C1). 이제 사유 칸이 곧장 서고, 상대 말풍선 곁의 깃발로 하나를
 * 고르면 그 메시지와 앞뒤 문맥을 DB 가 그때 그대로 베껴 신고 곁에 남긴다(`report_chat_message`, ADR 0091). 안 고르면
 * 그 사람을 신고한다(`report_user` — 소식 화면 · 인연 궁합과 같은 문). 둘 다 운영자 신고 화면의 같은 목록에 선다.
 */
export function ReportPanel({
  partnerUserId,
  messageId,
  canPick,
  onCancel,
  onDone,
  onBlock,
}: {
  partnerUserId: string;
  /** 깃발로 고른 상대 메시지 — 안 골랐으면 `null` */
  messageId: string | null;
  /** 고를 상대 말이 화면에 있다 — 없으면 고르는 길을 말하지 않는다 */
  canPick: boolean;
  onCancel: () => void;
  onDone: () => void;
  /** 열린 방에만 — 「차단으로 넘어가기」 */
  onBlock?: () => void;
}) {
  return (
    <div className="flex max-h-[55dvh] flex-col gap-3 overflow-y-auto rounded-[1.5rem] bg-surface-soft p-4 ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 pt-2.5 text-[15px] font-bold text-foreground">
          <Icon name="flag" className="size-[18px] text-danger" />
          {messageId === null ? '신고' : '메시지 신고'}
        </p>
        {/* 닫으면 이 판이 내려가며 적은 사유와 덧붙인 말이 사라진다 — 「작성 그만두기」다(docs/context/copy.md §8) */}
        <button type="button" aria-label="작성 그만두기" onClick={onCancel} className={ICON_BUTTON}>
          <Icon name="close" className="size-[18px]" />
        </button>
      </div>
      <p className="text-[13px] leading-5 text-secondary">{REPORT_NOTE}</p>
      {canPick && (
        <p className="text-[13px] leading-5 text-secondary">
          {messageId === null
            ? '문제가 된 메시지가 있으면 말풍선 곁의 깃발로 골라 주세요. 고르지 않아도 신고할 수 있어요.'
            : '고른 메시지와 앞뒤 대화가 함께 전달돼요. 깃발을 다시 누르면 고르기가 풀려요.'}
        </p>
      )}
      <ReportForm
        send={(reason, detail) =>
          messageId === null ? reportUser(partnerUserId, reason, detail) : reportChatMessage(messageId, reason, detail)
        }
        onDone={onDone}
        onBlock={onBlock}
      />
    </div>
  );
}
