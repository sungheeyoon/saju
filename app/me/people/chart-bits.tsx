import { STEM_INFO, BRANCH_INFO, type Branch, type Stem } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { ELEMENT_TONE, elementScope } from '../../ui/element-tone';
import { PILLAR_COLUMNS } from '../../saju/shared';
import { STEM_PICTURE, StemSymbol } from '../../ui/stem-symbol';

/*
  **사람 한 명을 알아보는 두 조각** — 일간 딱지와 네 기둥 띠. 사람 목록의 타일과 궁합의 두 면이 같은 것을 쓴다.

  같은 한 사람이 목록에서는 네모 타일 · 궁합에서는 동그란 원으로 서던 때가 있었다. 두 화면을 오가는 사람에게
  같은 것이 두 번 다르게 서지 않도록 모양을 한 벌로 둔다. 훅이 없어 서버 · 브라우저 어느 쪽 화면에서도 쓴다.
*/

/**
 * 일간 딱지 — **천간 그림과 그 이름(「햇빛」)이 함께 선다.** 한자(丙)와 오행 이름(불)은 얼굴 자리에서 걷었다 — 한국 유저
 * 대부분이 한자를 못 읽고, 그림 이름이 앱 어디서나 같은 사람을 가리킨다(운영자 2026-09-26, `app/ui/stem-symbol.tsx`).
 * 한자는 네 기둥 띠(`PillarStrip`) 같은 자료 자리에 남는다. 딱지는 제 오행의 색을 스스로 입는다.
 */
export function DayMasterChip({ stem, className = '' }: { stem: Stem; className?: string }) {
  const element = STEM_INFO[stem].element;

  return (
    <span
      className={`${elementScope(element)} inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] py-1 pl-1 pr-2.5 text-[12px] font-semibold text-[var(--ink)] ${className}`}
    >
      <span className="sr-only">일간 {STEM_PICTURE[stem]}</span>
      <StemSymbol stem={stem} className="size-5" />
      <span aria-hidden="true">{STEM_PICTURE[stem]}</span>
    </span>
  );
}

type PillarKey = (typeof PILLAR_COLUMNS)[number]['key'];
type Pillar = { readonly stem: Stem; readonly branch: Branch } | null;

/**
 * 네 기둥 띠 — 시주 · 일주 · 월주 · 년주가 한 줄의 칸 넷으로 선다. **글자마다 제 오행의 색**이고 일주 칸만
 * 테로 짚는다(「○○ 일주」라고 이름을 붙이지 않는다). 칸은 반투명 흰 면이라 파스텔 타일 위에서도 글자가 읽힌다.
 *
 * 시각을 모르면 그 칸은 비워 두고 보조기기에만 「출생 시각 모름」을 말한다 — 좁은 칸에 네 글자를 욱여넣으면
 * 폰 폭에서 줄이 넘친다.
 */
export function PillarStrip({
  pillars,
  name,
  size = 'md',
}: {
  pillars: Record<PillarKey, Pillar>;
  /** 누구의 기둥인가 — 표의 이름이 된다 */
  name: string;
  size?: 'md' | 'lg';
}) {
  const glyph = size === 'lg' ? 'text-[1.4rem]' : 'text-[1.15rem]';

  return (
    <div role="group" aria-label={`${name}의 네 기둥`} className="grid grid-cols-4 gap-1.5">
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = pillars[key];
        return (
          <div
            key={key}
            className={`flex flex-col items-center gap-0.5 rounded-xl bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] px-1 pb-1.5 pt-1 ${
              key === 'day' ? 'ring-2 ring-[color-mix(in_srgb,var(--foreground)_22%,transparent)]' : ''
            }`}
          >
            <span className="text-[11px] font-semibold tracking-[0.04em] text-secondary">{label}</span>
            {pillar === null ? (
              <span className={`glyph ${glyph} leading-tight text-secondary`}>
                <span aria-hidden="true">··</span>
                <span className="sr-only">{HOUR_UNKNOWN_LABEL}</span>
              </span>
            ) : (
              <span className={`glyph ${glyph} font-semibold leading-tight`}>
                <span className={ELEMENT_TONE[STEM_INFO[pillar.stem].element].text}>{pillar.stem}</span>
                <span className={ELEMENT_TONE[BRANCH_INFO[pillar.branch].element].text}>{pillar.branch}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
