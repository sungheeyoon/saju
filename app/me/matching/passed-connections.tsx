'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { elementScope } from '../../ui/element-tone';
import { BUTTON_PRIMARY, BUTTON_TERTIARY } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { FailureLine } from '../../ui/failure-line';
import { Icon } from '../../ui/icons';
import { CandidatePhoto } from './candidate-photo';
import { supplyOf, type DeckCard } from './deck-card';
import { PASSED_LIMIT } from './deck-state';
import { DetailSheet, openSheet } from '../../ui/sheet';
import { TYPE_NAME, TYPE_SECTION } from '../../ui/surfaces';

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
  working,
  onRestore,
  onBack,
  map,
  feedback,
  detail,
}: {
  cards: readonly DeckCard[];
  working: boolean;
  onRestore: (card: DeckCard) => Promise<string | null>;
  onBack: () => void;
  map: ReactNode;
  feedback: ReactNode;
  /** 시트가 펴는 그 사람의 까닭 · 기운 · 소개 — 오늘의 인연 시트와 같은 것 */
  detail: (card: DeckCard) => ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  /** 시트가 펴고 있는 사람 */
  const [looking, setLooking] = useState<DeckCard | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (looking !== null) openSheet(sheet.current);
  }, [looking]);

  // 보기가 바뀌면 초점을 제목으로 — 화면 낭독기가 어디로 왔는지 먼저 읽는다
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section aria-labelledby="passed-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="passed-title" ref={heading} tabIndex={-1} className={`flex items-baseline gap-2 outline-none ${TYPE_SECTION}`}>
          지나친 인연
          {cards.length > 0 && <span className="font-sans text-small font-semibold tabular-nums text-secondary">{cards.length} / {PASSED_LIMIT}</span>}
        </h2>
        {cards.length > 0 && <p className="text-body text-secondary">잠깐 지나쳤어도, 다시 궁금해질 수 있으니까요.</p>}
      </div>

      {map !== null && (
        <div className="w-full overflow-hidden rounded-card bg-cream px-2 pt-4 lg:max-w-xl">
          <div className="mx-auto max-w-[28rem]">{map}</div>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card border-2 border-dashed border-border-strong p-6">
          <span className="grid size-12 place-items-center rounded-full bg-cream text-cream-ink">
            <Icon name="undo" />
          </span>
          <h3 className={TYPE_NAME}>지나친 인연이 여기에 모여요</h3>
          <p className="text-body leading-6 text-secondary">다시 궁금해진 사람을 살펴보고, 한 번 더 알아갈 수 있는 자리예요.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <li key={card.candidateUserId}>
              <button
                type="button"
                onClick={() => {
                  setFailure(null);
                  setLooking(card);
                  if (looking?.candidateUserId === card.candidateUserId) openSheet(sheet.current);
                }}
                className="flex size-full flex-col overflow-hidden rounded-card border border-border bg-surface text-left shadow-card hover:border-border-strong active:scale-[0.98]"
              >
                <span className="relative block aspect-square text-[3rem]">
                  <CandidatePhoto card={card} />
                  <span className={`${elementScope(supplyOf(card))} absolute bottom-2 left-2 grid size-9 place-items-center rounded-full bg-[var(--tile)] ring-2 ring-surface`}>
                    <ElementSymbol element={supplyOf(card)} className="size-5" />
                  </span>
                </span>
                <span className="flex flex-1 flex-col gap-2 p-3">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className={`truncate ${TYPE_NAME}`}>{card.nickname}</span>
                    <span className="shrink-0 text-small font-bold tabular-nums text-foreground">궁합 {card.previewScore}점</span>
                  </span>
                  <span className="line-clamp-2 text-small leading-5 text-secondary">{card.highlights[0]?.text ?? card.reason}</span>
                </span>
              </button>
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
        <p className="text-fine leading-5 text-secondary">
          최근 {PASSED_LIMIT}명을 보관해요. 목록에서 빠진 인연은 마지막으로 넘긴 뒤 하루가 지나면 다시 추천될 수 있어요.
        </p>
      </div>

      {looking !== null && (
        <DetailSheet sheet={sheet} nickname={looking.nickname}>
          <div className={`${elementScope(supplyOf(looking))} flex flex-col gap-4`}>
            {detail(looking)}
            {failure !== null && <FailureLine>{failure}</FailureLine>}
            <button
              type="button"
              disabled={working || restoring}
              onClick={async () => {
                setRestoring(true);
                setFailure(null);
                const message = await onRestore(looking);
                setRestoring(false);
                if (message === null) sheet.current?.close();
                else setFailure(message);
              }}
              className={`${BUTTON_PRIMARY} w-full`}
            >
              <Icon name="undo" className="size-5" />
              {restoring ? '복원하는 중…' : '다시 만나보기'}
            </button>
          </div>
        </DetailSheet>
      )}
    </section>
  );
}
