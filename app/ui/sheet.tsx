'use client';

import { useRef, useState, type ReactNode, type RefObject } from 'react';

import { Icon } from './icons';
import { reducedMotion } from './motion';

/*
  **아래에서 올라오는 시트 한 벌** — 오늘의 인연 ⓘ · 받은 요청 · 지나친 인연 · 상대 프로필이 같은 판을 연다.
  오늘의 인연 카드(`app/me/matching/today-card.tsx`)에 살다가 여러 화면이 불러 공용 부품으로 왔다(2026-10-12). 모양은 그대로다.
*/

/**
 * ⓘ 시트 — 폰에서 사진 위에 못 둔 것(까닭 · 기운의 문장 · 소개 전문 · 궤도 · 참고 점수 고지)을 아래에서 올려 보인다.
 * 제 안에서 스크롤하고, 손잡이를 아래로 끌거나 바깥을 누르거나 Esc 로 닫힌다. 넓은 화면은 같은 것을 옆 열이 든다.
 *
 * **넓은 화면(lg)에서는 가운데 대화상자다**(화면 점검 2026-10-09 C15). 바닥에 붙은 판과 끌 손잡이는 엄지의 모양이라, 1280 폭에서는
 * 화면 아래로 이어지는 폰 시트로 읽혔다. 거기서는 손잡이가 없고 끌어 닫지 않으며, 아래에서 올라오지 않고 제자리에서 떠오른다.
 * ⓘ 자체는 넓은 화면에 안 선다(내용이 옆 열에 있다) — 넓은 화면에서 이 판을 여는 것은 「받은 요청 N」 띠다(`app/me/matching/requests-band.tsx`).
 */
export function DetailSheet({
  sheet,
  nickname,
  label,
  menu,
  nameInBody = false,
  onClose,
  children,
}: {
  sheet: RefObject<HTMLDialogElement | null>;
  /** 시트 머리의 제목 */
  nickname: string;
  /** 보조기기가 읽는 시트 이름 — 없으면 「○○ 님 자세히」. 받은 요청 시트(`app/me/matching/requests-band.tsx`)가 제 이름을 준다 */
  label?: string;
  /** 머리의 닫기(X) 왼쪽에 서는 것 — 오늘의 인연은 신고 · 차단 「⋯」를 둔다 */
  menu?: ReactNode;
  /**
   * 이름이 머리가 아니라 본문(사진 아래)에 선다 — 상대 프로필 시트(`app/me/partner-sheet.tsx`). 머리의 제목은 보조기기에만
   * 읽히고, 본문의 이름은 보이기만 한다(한 이름을 두 번 읽지 않게)
   */
  nameInBody?: boolean;
  /** 판이 닫힌 뒤 — 어느 길(X · Esc · 바깥 · 끌기)로 닫혀도 한 번 */
  onClose?: () => void;
  children: ReactNode;
}) {
  const press = useRef<number | null>(null);
  /** 손잡이를 아래로 끈 만큼(px) */
  const [drag, setDrag] = useState(0);

  const close = () => closeSheet(sheet.current, drag, () => setDrag(0));

  return (
    <dialog
      ref={sheet}
      aria-label={label ?? `${nickname} 님 자세히`}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClose={onClose}
      style={drag > 0 ? { transform: `translateY(${drag}px)` } : undefined}
      /*
        폭은 40rem 에서 멈추고 가운데 선다 — ⓘ 는 `lg` 아래에서 열리므로 640~1023px 에서 시트가 화면 끝까지 늘어나 한 줄이
        너무 길었다(화면 감사 2026-10-09). 폰 폭에서는 그대로 꽉 찬다.
      */
      className={`mx-auto mb-0 mt-auto max-h-[85dvh] w-full ${nameInBody ? 'max-w-[28rem]' : 'max-w-[40rem]'} overflow-y-auto overscroll-contain rounded-t-paper bg-background p-0 text-foreground backdrop:bg-black/40 lg:my-auto lg:max-h-[min(85dvh,48rem)] lg:rounded-paper lg:shadow-float`}
    >
      <div className="flex flex-col gap-4 px-5 pb-10 lg:px-6 lg:pb-6">
        <div
          className={`sticky top-0 z-10 -mx-5 flex touch-none select-none flex-col ${nameInBody ? 'gap-1' : 'gap-2'} bg-background px-5 pb-1 pt-3 lg:-mx-6 lg:touch-auto lg:px-6 lg:pt-5`}
          onPointerDown={(event) => {
            if (wideSheet()) return;
            press.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => { if (press.current !== null) setDrag(Math.max(0, event.clientY - press.current)); }}
          onPointerUp={() => {
            press.current = null;
            if (drag > 90) close();
            else setDrag(0);
          }}
          onPointerCancel={() => { press.current = null; setDrag(0); }}
        >
          <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-border-strong lg:hidden" />
          <div className="flex items-center justify-between gap-3">
            <h2 className={nameInBody ? 'sr-only' : 'min-w-0 truncate font-rounded text-section'}>{nickname}</h2>
            <span className="ml-auto flex shrink-0 items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
              {menu}
              {/* 보는 판을 닫는 것은 오른쪽 위 X 한 벌이다 — 관계 지도 카드 · 신고 창과 같은 모양, 이름은 「닫기」(ADR 0166) */}
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="grid size-11 shrink-0 place-items-center rounded-full text-secondary hover:bg-surface-soft hover:text-foreground"
              >
                <Icon name="close" className="size-5" />
              </button>
            </span>
          </div>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** 넓은 화면인가 — 시트가 가운데 대화상자로 서는 폭(`lg`, 클래스의 `lg:` 와 같은 문턱) */
const wideSheet = (): boolean => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

/**
 * 시트를 닫는다 — 폰은 아래로 내려가고(끈 만큼에서 이어), 넓은 화면은 제자리에서 옅어진다. 시트 안의 단추가 다른 칸으로
 * 넘길 때도(상대 프로필 시트의 「⋯」) 이 길로 닫는다. `settled` 는 닫힌 뒤 한 번
 */
export function closeSheet(dialog: HTMLDialogElement | null, drag = 0, settled?: () => void) {
  if (dialog === null || !dialog.open) return;
  const settle = () => { dialog.close(); settled?.(); };
  if (reducedMotion()) { settle(); return; }
  const frames = wideSheet()
    ? [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(12px)' }]
    : [{ transform: `translateY(${drag}px)` }, { transform: 'translateY(100%)' }];
  dialog.animate(frames, { duration: wideSheet() ? 160 : 240, easing: 'cubic-bezier(.4,0,1,1)' }).onfinish = settle;
}

/** 시트를 연다 — 폰은 아래에서 올라오고, 넓은 화면은 제자리에서 떠오른다 */
export function openSheet(sheet: HTMLDialogElement | null) {
  if (sheet === null || sheet.open) return;
  sheet.showModal();
  if (reducedMotion()) return;
  if (wideSheet()) {
    sheet.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
    return;
  }
  sheet.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
