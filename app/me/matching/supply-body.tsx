import { ELEMENT_PICTURE_KO } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icons';
import { elementOf, type DeckCard } from './deck-card';

/** 채워 주는 기운 — 상징 + 이름 + 문장. 색 혼자 말하지 않고, 색은 상징의 동그라미에만 둔다 */
export function SupplyBody({ card, explorationNote }: { card: DeckCard; explorationNote: string | null }) {
  return (
    <>
      <p className="text-small font-bold text-foreground">이 사람이 채워 주는 기운</p>
      {card.highlights.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {card.highlights.map((highlight) => (
            <Supply key={highlight.element} element={highlight.element} text={highlight.text} />
          ))}
        </ul>
      ) : (
        <p className="text-body leading-6 text-foreground">{card.reason}</p>
      )}
      <p className="text-small leading-5 text-secondary">{card.balanceLabel}</p>
      {card.exploration && explorationNote !== null && (
        <p className="flex gap-1.5 border-t border-border pt-3 text-fine leading-5 text-secondary">
          <Icon name="spark" className="mt-0.5 size-3.5 shrink-0 text-foreground" />
          {explorationNote}
        </p>
      )}
    </>
  );
}

function Supply({ element, text }: { element: string; text: string }) {
  const known = elementOf(element);
  return (
    <li className={`${elementScope(known)} flex items-center gap-3`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--tile)] ring-1 ring-[color-mix(in_srgb,var(--ink)_20%,transparent)]">
        <ElementSymbol element={known} className="size-6" />
      </span>
      <span className="flex min-w-0 flex-col">
        {known !== null && <span className="font-rounded text-lead leading-tight text-[var(--ink)]">{ELEMENT_PICTURE_KO[known]}</span>}
        <span className="text-note leading-5 text-foreground">{text}</span>
      </span>
    </li>
  );
}
