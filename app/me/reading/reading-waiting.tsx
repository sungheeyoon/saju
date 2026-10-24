import { READING_LEAVE_SAFE_NOTE, READING_OUTLINE_STATE, readingWaitNote } from '@/src/lib/reading/notes';

import { Icon } from '../../ui/icons';
import { GENERATION } from './generation';
import { READING_COLUMN } from './markdown';
import type { OutlineRow } from './outline';
import flow from './flow.module.css';

/**
 * **멈춘 화면이 아니라는 것을 무엇이 말하는가** — 서버가 적은 진행이다(ADR 0127).
 *
 * 스피너는 서버가 죽어도 계속 돈다. 그래서 오래 걸리는 일에서 스피너는 「살아 있다」를 말하지 못한다. 한동안 여기서
 * 초를 셌다 — 서버가 어느 단계인지 몰랐고, 시간만 보고 단계를 지어 보이면 그건 **꾸며 낸 진행**이기 때문이다.
 *
 * 이제 서버가 안다. 제출한 응답을 따라 읽으며 소제목이 설 때마다 절 번호를 적고(`note_reading_progress`), 이 칸은
 * 그 값으로 목차 줄을 칠한다(`readingOutline`). **시간으로 채우는 자리는 여전히 없다** — 첫 머리가 서기 전에는 아무
 * 줄도 안 움직이고, 흐르는 띠(`flow.module.css`)는 차오르지 않는다. 끝을 모른다는 말은 그대로다.
 */
export function LoadingState({ rows }: { rows: readonly OutlineRow[] }) {
  return (
    <div role="status" aria-live="polite" className="rounded-card bg-cream p-5 sm:p-7">
      {/*
        **띠 · 목차 · 안내가 한 열이다.** 띠만 카드 폭을 다 쓰고 목차는 36rem 에서 멈춰, 넓은 화면에서 띠가 목차보다
        길게 뻗었다(화면 갤러리 감사 2026-10-09). 열의 폭은 본문과 같다 — 기다린 자리에 글이 그 폭으로 선다.
      */}
      <div className={READING_COLUMN}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-cream-ink" aria-hidden="true">
            <Icon name="spark" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-lead font-semibold text-foreground">사주의 흐름을 이어 읽고 있어요</p>
            <p className="text-small leading-5 text-cream-ink">근거를 확인하고, 단정하지 않는 문장으로 옮기고 있어요.</p>
          </div>
        </div>
        {/*
          **얼마나 걸리고 떠나도 되는지가 머리 바로 아래다**(2026-10-10 화면 점검 B11). 목차 열 줄 아래에 두었더니 폰에서는
          내려가야 보였다 — 기다리는 사람에게 가장 쓸모 있는 말이다.
        */}
        <p className="mt-3 text-small leading-5 text-cream-ink">
          {readingWaitNote(GENERATION.settings.timeout)} {READING_LEAVE_SAFE_NOTE}
        </p>
        <div aria-hidden="true" className="mt-5 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cream-ink)_14%,transparent)]">
          <div className={`${flow.flow} h-full rounded-full`} />
        </div>
        {/*
          **줄마다 서버가 적은 상태 하나.** 목록이라 화면 낭독기가 몇 줄 중 몇째인지 읽는다. 기다리는 줄의 말줄임표는
          읽어 주지 않는다 — 「점점점」이 아홉 번 낭독되면 목차를 들을 수 없다.
        */}
        <ol aria-label="풀이 목차" className="mt-5 flex flex-col gap-2">
          {rows.map((row, at) => (
            <li
              key={`${at}-${row.label}`}
              className="flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 text-note"
            >
              <span className={row.state === 'waiting' ? 'text-secondary' : 'text-foreground'}>{row.label}</span>
              <OutlineMark state={row.state} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function OutlineMark({ state }: { state: OutlineRow['state'] }) {
  switch (state) {
    case 'done':
      return (
        <span className="shrink-0 rounded-full bg-wood-soft px-2 py-0.5 text-fine font-semibold text-wood">
          {READING_OUTLINE_STATE.done}
        </span>
      );
    case 'writing':
    case 'reviewing':
      return (
        <span className="shrink-0 animate-pulse text-fine font-semibold text-fire motion-reduce:animate-none">
          {READING_OUTLINE_STATE[state]}
        </span>
      );
    case 'waiting':
      return (
        <span aria-hidden="true" className="shrink-0 text-muted">
          {READING_OUTLINE_STATE.waiting}
        </span>
      );
  }
}
