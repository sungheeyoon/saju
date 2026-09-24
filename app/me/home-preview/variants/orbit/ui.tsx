import type { Element } from '@/src/lib/saju';

import { ELEMENT_TONE } from '../../../../element-tone';
import type { GlyphCell } from './model';

/*
  **버튼 세 단과 아이콘 — 이 시안의 모든 눌리는 것이 여기서 옷을 입는다.**

  1차 시안들의 단추는 테두리 알약 하나가 주 · 보조 · 링크를 다 했고, 누름은 호버 색 하나뿐이었다.
  여기서는 모양이 곧 위계다: 주 = 채운 48px 판 · 보조 = 테두리 48px 판 · 셋째 = 밑줄 글자.
  셋 다 누르면 1px 가라앉고(`active:`), 키보드로 오면 2px 고리가 선다(`focus-visible:`).
*/

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export const BUTTON = {
  primary: `inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-[15px] font-semibold text-on-accent shadow-[0_8px_20px_-10px_var(--accent)] transition hover:brightness-110 active:translate-y-px active:brightness-95 ${FOCUS}`,
  secondary: `inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border-strong bg-surface px-5 text-[15px] font-semibold text-foreground shadow-[0_1px_0_var(--border)] transition hover:border-accent hover:text-accent active:translate-y-px active:bg-surface-sunken ${FOCUS}`,
  /** 목록 줄 안의 작은 보조 — 높이만 44px 로 줄였다 */
  compact: `inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3.5 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent active:translate-y-px active:bg-surface-sunken ${FOCUS}`,
  tertiary: `inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-semibold text-accent underline decoration-accent/35 decoration-1 underline-offset-4 transition hover:decoration-accent active:opacity-70 ${FOCUS}`,
} as const;

export function Arrow({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={`${className} shrink-0 fill-none stroke-current`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function Plus({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={`${className} shrink-0 fill-none stroke-current`} strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

/** 두 원이 겹친 표 — 「나와 궁합」 */
export function PairIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0 fill-none stroke-current`} strokeWidth="1.8">
      <circle cx="9" cy="12" r="5.5" />
      <circle cx="15" cy="12" r="5.5" />
    </svg>
  );
}

/** 펼친 책 — 「사주풀이」 */
export function BookIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0 fill-none stroke-current`} strokeWidth="1.7" strokeLinejoin="round">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2.5Z" />
    </svg>
  );
}

/**
 * 여덟 글자 한 줄 — 이 화면의 시각적 주인공.
 * 칸 이름(시주 · 일주 …)은 11px 보조 라벨이고, 글자는 `size` 가 정한다. 일주 칸만 옅은 판을 깐다.
 */
export function EightGlyphs({ cells, size, hourUnknown }: { cells: GlyphCell[]; size: 'hero' | 'panel'; hourUnknown: string }) {
  const glyph = size === 'hero' ? 'text-[2.25rem] sm:text-[2.75rem]' : 'text-[1.75rem] sm:text-[2rem]';
  return (
    <ol className="grid grid-cols-4 gap-2">
      {cells.map((cell) => (
        <li
          key={cell.key}
          className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 pb-2 pt-1.5 ${
            cell.key === 'day' ? 'bg-accent-wash ring-1 ring-accent/25' : 'bg-surface-soft'
          }`}
        >
          <span className={`text-[11px] font-semibold tracking-[0.02em] ${cell.key === 'day' ? 'text-accent' : 'text-muted'}`}>
            {cell.column}
          </span>
          {cell.pillar === null ? (
            <span className={`grid place-items-center text-center text-xs font-medium leading-tight text-muted ${size === 'hero' ? 'min-h-[5.5rem]' : 'min-h-[4.5rem]'}`}>
              {hourUnknown}
            </span>
          ) : (
            <span aria-label={`${cell.column} ${cell.pillar.name}`} className="flex flex-col items-center leading-[1.05]">
              <Glyph char={cell.pillar.stem} element={cell.pillar.stemElement} className={glyph} />
              <Glyph char={cell.pillar.branch} element={cell.pillar.branchElement} className={glyph} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Glyph({ char, element, className }: { char: string; element: Element; className: string }) {
  return (
    <span aria-hidden="true" className={`glyph font-bold dark:brightness-[1.45] ${className} ${ELEMENT_TONE[element].text}`}>
      {char}
    </span>
  );
}
