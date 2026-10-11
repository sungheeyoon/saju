import Link from 'next/link';

import type { Element } from '@/src/lib/saju';

import { BUTTON_SECONDARY_SMALL_FACE } from '../../../ui/buttons';
import { elementScope } from '../../../ui/element-tone';
import { Icon } from '../../../ui/icons';
import { LINK_PENDING_SPINNER } from '../../../ui/link-pending';
import type { RoomCompat } from './room-compat';

/**
 * 상대의 파스텔을 입은 알약 — 원본 시안의 궁합 알약이다. 보조 단추와 같은 44px · 같은 글자 크기이고, 면과 글자가
 * 한 오행 한 벌이라(글자 `--ink` · 면 `--tile`, 대비 5.6:1 이상) 어느 오행이어도 읽힌다. 면만 정한다 — 높이 · 옆 여백은
 * 아래 `size` 한 자리에서(겹치면 CSS 순서가 이겨 폰의 `px-3` 이 안 먹는다).
 */
const TONED_PILL =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--tile)] text-sm font-semibold text-[var(--ink)] ring-1 ring-[color-mix(in_srgb,var(--ink)_18%,transparent)] hover:ring-[var(--ink)] active:scale-[0.97]';

/**
 * 단추를 읽는 이름 — 보이는 글자를 품는다(폰에서 글자가 빠져도 이름은 같다). 글자는 운영자 시안(2026-10-11 저녁)이다 — 이 단추에는
 * 「인연」을 쓰지 않는다(G-104).
 */
function compatChipName(compat: RoomCompat): string {
  switch (compat.kind) {
    case 'ready':
      return `궁합 ${compat.score}점`;
    case 'making':
      return '궁합 만드는 중';
    case 'failed':
      return '궁합 다시 받기';
    case 'quiet':
      return '궁합';
  }
}

/**
 * **궁합 단추 — 그 인연 궁합이 지금 어디까지 왔나를 든다**(ADR 0155 「2026-10-11 저녁 덧」). 누르면 언제나 인연 궁합 화면이다 —
 * 실패면 거기 「궁합풀이 받기」가 있다(ADR 0038). 아이콘은 하단 탭 「궁합」과 같은 음양이고, 실패만 경고로 바뀐다.
 *
 * 두 일간을 아는 방은 상대의 파스텔 알약, 모르면 보조 단추다. 방 머리(`fill` 아님)는 폰에서 짧다 — 만드는 중은 아이콘과 작은
 * 고리, 실패는 경고 하나, 점수는 「72점」. 넓은 화면(sm)과 시트(`fill`)는 글자까지 선다.
 */
export function CompatChip({
  compat,
  href,
  tone,
  fill = false,
}: {
  compat: RoomCompat;
  href: string;
  /** 상대의 일간 오행 — 두 일간을 모르면 `null`(보조 단추) */
  tone: Element | null;
  /** 시트의 한 줄 단추 — 폭을 다 쓰고 글자가 늘 선다 */
  fill?: boolean;
}) {
  const shape = tone === null ? BUTTON_SECONDARY_SMALL_FACE : `${elementScope(tone)} ${TONED_PILL}`;
  const size = fill ? 'w-full min-h-12 px-4' : 'min-h-11 min-w-11 shrink-0 px-3 sm:px-4';
  /* 폰의 방 머리에서는 빠지는 글자 — 시트에서는 늘 선다 */
  const wideOnly = fill ? '' : 'hidden sm:inline';
  return (
    <Link href={href} aria-label={compatChipName(compat)} data-compat={compat.kind} className={`${shape} ${size}`}>
      {compat.kind === 'failed' ? (
        <Icon name="alert" className="size-[18px] text-danger" />
      ) : (
        <Icon name="taiji" className="size-[18px]" />
      )}
      {compat.kind === 'ready' && <span className="tabular-nums">{compat.score}점</span>}
      {compat.kind === 'making' && (
        <>
          {!fill && <span aria-hidden="true" className={`${LINK_PENDING_SPINNER} sm:hidden`} />}
          <span className={wideOnly}>궁합 만드는 중…</span>
        </>
      )}
      {compat.kind === 'failed' && <span className={wideOnly}>다시 받기</span>}
      {compat.kind === 'quiet' && <span className={wideOnly}>궁합</span>}
    </Link>
  );
}
