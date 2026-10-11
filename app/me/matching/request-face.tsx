'use client';

import type { ReactNode } from 'react';

import { Icon } from '../../ui/icons';
import { TYPE_NAME } from '../../ui/surfaces';
import { Avatar } from '../avatar';
import { PartnerSheet, partnerSheetName, usePartnerSheet, type PartnerProfile } from '../partner-sheet';

/**
 * 요청 카드 머리의 얼굴 · 이름 줄 — **누르면 상대 프로필 시트가 열린다**(G-103, 운영자 2026-10-11).
 *
 * 대화방 머리와 같은 몸짓이다(`../chat/[matchId]/room.tsx`) — 이름이 단추이고 끝에 셰브론이 서며, 단추의 누르는 자리가 줄 전체(얼굴까지)로
 * 번진다. 시트는 대화방 · 인연 궁합 머리가 여는 `PartnerSheet` 그대로다. 아직 맺어지지 않아 궁합 단추는 없고(`toMatch` 가 `null`),
 * 「⋯」(신고 · 차단)도 안 단다 — 같은 카드의 머리 바로 아래에 차단 · 신고가 이미 선다. 일간을 모르는 문이라 사진 없는 동그라미는 회색이다.
 */
export function RequestFace({
  partner,
  large,
  meta,
}: {
  partner: PartnerProfile;
  large: boolean;
  /** 이름 아래 한 줄 — 요청 시각(서버가 한국 시간으로 그린다) */
  meta: ReactNode;
}) {
  const control = usePartnerSheet();
  return (
    <>
      <div className="relative flex items-center gap-3">
        <Avatar
          userId={partner.userId}
          nickname={partner.nickname}
          hasPhoto={partner.photoUrls.length > 0}
          focus={partner.photoFocus[0]}
          size={large ? 52 : 40}
        />
        <div className="min-w-0 flex-1">
          <h3 className={large ? TYPE_NAME : 'text-base font-semibold'}>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={partnerSheetName(partner.nickname)}
              onClick={control.open}
              className="inline-flex max-w-full items-center gap-0.5 text-left after:absolute after:inset-0 after:rounded-2xl"
            >
              <span className="truncate">{partner.nickname}</span>
              <Icon name="chevron" className="size-4 shrink-0 text-secondary" />
            </button>
          </h3>
          {meta}
        </div>
      </div>
      <PartnerSheet control={control} partner={partner} toMatch={null} />
    </>
  );
}
