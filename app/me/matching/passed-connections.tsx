'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { elementScope } from '../../element-tone';
import { BUTTON_SECONDARY_SMALL, BUTTON_TERTIARY } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icons';
import type { DeckCard } from './matching-experience';
import { supplyOf } from './orbit-map';

/*
  **지나친 인연 — 「오늘의 인연」 옆의 두 번째 보기.**

  옛 화면은 오른쪽 위 단추가 미닫이 패널을 열었고, 한 사람을 고르면 그 안에서 한 번 더 들어가야 「다시 만나보기」가
  섰다(세 번 누름). 이제는 제목 아래 알약 둘로 나란히 선다 — 지나친 사람이 몇 명인지가 늘 보이고, 타일마다
  「다시 만나보기」가 있어 두 번이면 카드 맨 앞으로 돌아온다. 넘긴 사람들이 아직 바깥 궤도에 머무는 띠가 목록 위에
  선다 — 「다시 만나보기」가 안으로 불러들이는 그림이다.

  복원은 여기서 하지 않는다 — 덱의 공용 흐름(`restoreCard`)에 맡기고, 실패 문장은 덱이 한 자리에 세운다(`feedback`).
*/
export function PassedConnections({
  cards,
  preview,
  working,
  onRestore,
  onBack,
  faceOf,
  map,
  feedback,
}: {
  cards: readonly DeckCard[];
  preview: boolean;
  working: boolean;
  onRestore: (card: DeckCard) => Promise<string | null>;
  onBack: () => void;
  faceOf: (card: DeckCard) => ReactNode;
  map: ReactNode;
  feedback: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  // 보기가 바뀌면 초점을 제목으로 — 화면 낭독기가 어디로 왔는지 먼저 읽는다
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section aria-labelledby="passed-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="passed-title" ref={heading} tabIndex={-1} className="font-rounded flex items-baseline gap-2 text-[1.5rem] leading-8 text-foreground outline-none">
          지나친 인연
          {cards.length > 0 && <span className="font-sans text-[13px] font-semibold tabular-nums text-secondary">{cards.length} / 20</span>}
        </h2>
        {cards.length > 0 && <p className="text-[15px] text-secondary">잠깐 지나쳤어도, 다시 궁금해질 수 있으니까요.</p>}
      </div>

      {map !== null && (
        <div className="w-full overflow-hidden rounded-[2rem] bg-cream px-2 pt-4 lg:max-w-xl">
          <div className="mx-auto max-w-[28rem]">{map}</div>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[1.75rem] border-2 border-dashed border-border-strong p-6">
          <span className="grid size-12 place-items-center rounded-full bg-cream text-cream-ink">
            <UndoIcon />
          </span>
          <h3 className="font-rounded text-[1.25rem] text-foreground">지나친 인연이 여기에 모여요</h3>
          <p className="text-[15px] leading-6 text-secondary">다시 궁금해진 사람을 살펴보고, 한 번 더 알아갈 수 있는 자리예요.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <li key={card.candidateUserId} className="flex flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-[var(--shadow-card)]">
              <span className="relative block aspect-square text-[3rem]">
                {faceOf(card)}
                <span className={`${elementScope(supplyOf(card))} absolute bottom-2 left-2 grid size-9 place-items-center rounded-full bg-[var(--tile)] ring-2 ring-surface`}>
                  <ElementSymbol element={supplyOf(card)} className="size-5" />
                </span>
              </span>
              <span className="flex flex-1 flex-col gap-2 p-3">
                <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-rounded truncate text-[1.25rem] text-foreground">{card.nickname}</span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-foreground">궁합 {card.previewScore}점</span>
                </span>
                <span className="line-clamp-2 text-[13px] leading-5 text-secondary">{card.highlights[0]?.text ?? card.reason}</span>
                <button
                  type="button"
                  disabled={working}
                  onClick={async () => {
                    setRestoring(card.candidateUserId);
                    await onRestore(card);
                    setRestoring(null);
                  }}
                  className={`${BUTTON_SECONDARY_SMALL} mt-auto w-full disabled:opacity-55`}
                >
                  <UndoIcon className="size-4" />
                  {restoring === card.candidateUserId ? '복원하는 중…' : '다시 만나보기'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">{feedback}</div>

      <div className="flex flex-col items-start gap-1">
        <button type="button" onClick={onBack} className={BUTTON_TERTIARY}>
          오늘의 인연 계속 보기
          <Icon name="arrow" className="size-4" />
        </button>
        <p className="text-[12px] leading-5 text-secondary">
          {preview
            ? '미리보기에서는 실제 보관 기록을 바꾸지 않아요.'
            : '최근 20명을 보관해요. 목록에서 빠진 인연은 마지막으로 넘긴 뒤 하루가 지나면 다시 추천될 수 있어요.'}
        </p>
      </div>
    </section>
  );
}

/** 되돌리기 — 아이콘 한 벌(`app/ui/icons.tsx`)에 없는 그림이라 이 화면이 든다 */
export function UndoIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4.5 9.5 9 5" />
      <path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" />
    </svg>
  );
}
