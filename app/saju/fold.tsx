import type { ReactNode } from 'react';

import { Icon } from '../ui/icons';
import { TYPE_NAME } from '../ui/surfaces';

/**
 * **분석 표 한 장 — 접힌 채 선다**(5차, 부드러움).
 *
 * 2026-09-24 에 재어 보니 명식 결과는 카드 아홉 장이 모두 펴진 채 폰에서 스무 화면 가까이 이어졌다. 사람이
 * 먼저 보는 것은 여덟 글자와 오행이고, 신살 · 강약 · 용신 · 관계 · 운 · 보정은 「무엇이 걸렸나」를 찾으러
 * 들어가는 표다. 그래서 주인공(여덟 글자)과 오행만 펴 두고 나머지는 이 접이칸에 담는다.
 *
 * **머리만 봐도 무엇이 들었는지 안다.** 제목(`h2`)과 한 줄 요약(`meta` — 「신살 5개」 · 「신강 · 세 기준 중
 * 2개 충족」 같은 값)이 접힌 머리에 선다. 제목이 `summary` 안에 있으므로 접힌 동안에도 제목 목록에 남는다.
 *
 * **자바스크립트가 없어도 열린다** — 브라우저의 `<details>` 다. 결과 바로가기는 목적지가 접혀 있으면 열고
 * 나서 옮긴다(`result-nav.tsx`). 표시 `data-fold` 가 그 짝이다.
 */
const FOLD_CARD = 'group/fold rounded-[1.75rem] border border-border bg-surface shadow-card';

export function Fold({
  id,
  title,
  meta,
  note,
  open = false,
  children,
}: {
  /** 바로가기가 짚는 자리 — 없으면 안 건다 */
  readonly id?: string;
  readonly title: ReactNode;
  /** 제목 곁의 짧은 값 — 접힌 채로도 무엇이 들었는지 말한다 */
  readonly meta?: ReactNode;
  /** 제목 아래 한 줄 — 이 표가 무엇을 보는가 */
  readonly note?: ReactNode;
  readonly open?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <details id={id} data-fold="" open={open} className={`${FOLD_CARD} ${id === undefined ? '' : 'scroll-mt-36'}`}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-[1.75rem] px-5 py-4 hover:bg-surface-soft group-open/fold:rounded-b-none sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2 className={TYPE_NAME}>{title}</h2>
            {meta !== undefined && <span className="text-sm font-semibold text-secondary">{meta}</span>}
          </span>
          {note !== undefined && <span className="text-[13px] leading-5 text-secondary">{note}</span>}
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-secondary transition-transform group-open/fold:rotate-180">
          <Icon name="chevron" className="size-4 rotate-90" />
        </span>
      </summary>
      <div className="border-t border-border px-5 pb-5 pt-5 sm:px-6 sm:pb-6">{children}</div>
    </details>
  );
}

/** 펴진 채 서는 카드의 머리 — 접이칸과 같은 제목 단을 쓴다(여덟 글자 · 오행) */
export function SectionTitle({ children, meta }: { readonly children: ReactNode; readonly meta?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <h2 className={TYPE_NAME}>{children}</h2>
      {meta !== undefined && <span className="text-sm font-semibold text-secondary">{meta}</span>}
    </div>
  );
}
