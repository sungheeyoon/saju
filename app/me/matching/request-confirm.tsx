'use client';

import { MATCH_CONSENT_NOTICE } from '@/src/lib/consent';
import { REQUEST_RESERVES_NOTE } from '@/src/lib/reading/notes';

import { ConfirmDialog } from '../../ui/confirm-dialog';
import { elementScope } from '../../ui/element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icons';
import { CandidatePhoto } from './candidate-photo';
import { supplyOf, type DeckCard } from './deck-card';

/**
 * 인연 요청을 보내기 직전의 확인 창.
 *
 * **받는 쪽 카드와 같은 두 문장을 읽는다**(`MATCH_CONSENT_NOTICE`, ADR 0008 「같은 한 벌」) — 문구가 화면마다 갈리면 어느 쪽이
 * 실제로 나가는 약속인지 알 수 없다. 본문은 그 두 문장과 풀이권 한 줄뿐이다(운영자 2026-10-26 「글이 너무 길다」, 대장 `matching-10`).
 * 풀이권은 값을 치르는 사실이라 누르기 전에 남겼고(ADR 0038), 차감의 확정 · 궁합풀이 · 대화방은 「궁합 요청은 어떻게 진행되나요?」가 든다.
 */
export function RequestConfirm({
  profile,
  open,
  onClose,
  onConfirm,
  busy,
}: {
  profile: DeckCard;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      /* 풀이권 확인 창과 같은 판 · 같은 단추 줄이다(확인 창 한 벌 — 첫 초점은 「취소」, ADR 0166) */
      className={elementScope(supplyOf(profile))}
      lead={
        <div className="flex items-center gap-3">
          <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-[var(--tile)] text-heading ring-2 ring-[var(--tile)]">
            <CandidatePhoto card={profile} />
          </span>
          <span className="grid size-10 place-items-center rounded-full bg-[var(--tile)]">
            <ElementSymbol element={supplyOf(profile)} className="size-6" />
          </span>
        </div>
      }
      title={`${profile.nickname} 님에게 상세 궁합을 요청할까요?`}
      confirmLabel={
        <>
          <Icon name="taiji" className="size-[18px]" />
          요청 보내기
        </>
      }
      onConfirm={onConfirm}
      busy={busy}
    >
      <p>
        {MATCH_CONSENT_NOTICE.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
      <p>
        <strong>풀이권 1장</strong>을 써요. {REQUEST_RESERVES_NOTE}
      </p>
    </ConfirmDialog>
  );
}
