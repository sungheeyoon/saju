import type { DeckCard } from '../../../../matching/matching-experience';
import { ELEMENT_TONE } from '../../../../../element-tone';
import type { MatchingCopy } from './copy';
import type { MeMark } from './deck';
import { ELEMENT_ANGLE, ELEMENT_ORDER, ElementBead, Face, isElement, pointAt } from './orbit-art';

/*
  **다가오는 지도 — 데스크톱에서 카드 옆에 선다.**

  홈 지도의 두 궤도를 그대로 쓰되 뜻이 바뀐다. 안쪽 궤도는 **내 오행 다섯**(적은 기운은 점선 원),
  바깥 점선 궤도는 **오늘의 후보**다. 후보는 자기가 채워 주는 오행의 각도에 서고, 지금 보는 한 사람만 안쪽으로
  끌려 들어와 그 오행 자리에 점선을 댄다 — 선은 자료에 있는 관계(「이 기운을 채워 준다」)만 긋는다.

  자리는 상태에서 정해지고 `left/top` 전이로 옮긴다: 넘기면 바깥으로 튕겨 사라지고, 궁합을 요청하면 가운데로
  빨려 들어 사라진다. 누르는 자리는 없다(보조기기에는 숨긴다) — 같은 일을 카드와 단추가 한다.
*/

export type MapStatus = 'current' | 'waiting' | 'passed' | 'requested';

const RING = { element: 18, current: 36, waiting: 45, passed: 62 } as const;

/** 같은 오행을 채우는 후보가 겹치지 않게 ±24° 씩 벌린다. 보완 오행이 없는 후보는 빈 각도에 선다 */
function anglesOf(cards: readonly DeckCard[]): Record<string, number> {
  const used = new Map<number, number>();
  const spare = [-54, 162, 90, 18];
  const out: Record<string, number> = {};
  for (const card of cards) {
    const element = card.highlights[0]?.element;
    const base = isElement(element) ? ELEMENT_ANGLE[element] : (spare.shift() ?? 0);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    out[card.candidateUserId] = base + (seen === 0 ? 0 : (seen % 2 === 1 ? 1 : -1) * 24 * Math.ceil(seen / 2));
  }
  return out;
}

export function ApproachMap({
  me,
  cards,
  statusOf,
  copy,
  photoOf,
}: {
  me: MeMark;
  cards: readonly DeckCard[];
  statusOf: (card: DeckCard) => MapStatus;
  copy: MatchingCopy;
  photoOf: (card: DeckCard) => string | null;
}) {
  const angles = anglesOf(cards);
  const current = cards.find((card) => statusOf(card) === 'current') ?? null;
  const currentSupply = current?.highlights[0]?.element;

  return (
    <div aria-hidden="true" className="relative aspect-square w-full">
      <div className="pointer-events-none absolute inset-[6%] rounded-full bg-[radial-gradient(circle,var(--accent-wash)_0%,transparent_68%)]" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
        <circle cx="50" cy="50" r={RING.element} className="fill-none stroke-border-strong" strokeWidth="0.35" />
        <circle cx="50" cy="50" r={RING.waiting} className="fill-none stroke-border-strong" strokeWidth="0.35" strokeDasharray="1 2" />
        {current !== null && isElement(currentSupply) && (
          <SupplyLine
            key={current.candidateUserId}
            from={pointAt(angles[current.candidateUserId], RING.current)}
            to={pointAt(ELEMENT_ANGLE[currentSupply], RING.element)}
            tone={ELEMENT_TONE[currentSupply].text}
          />
        )}
      </svg>

      {/* 가운데 — 홈 지도의 나와 같은 원, 같은 글자 */}
      <span className={`absolute left-1/2 top-1/2 flex size-[19%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 bg-surface shadow-[var(--shadow-card)] ${ELEMENT_TONE[me.element].border}`}>
        <span className={`glyph text-[2.4rem] font-bold leading-none dark:brightness-[1.45] ${ELEMENT_TONE[me.element].text}`}>{me.stem}</span>
        <span className="mt-0.5 text-[11px] font-bold text-muted">{copy.me}</span>
      </span>

      {/* 안쪽 궤도 — 내 오행 다섯. 적은 기운은 점선 원이라 「빈 자리」로 읽힌다 */}
      {ELEMENT_ORDER.map((element) => {
        const at = pointAt(ELEMENT_ANGLE[element], RING.element);
        const mine = me.elements.find((one) => one.element === element);
        const lit = currentSupply === element;
        return (
          <span
            key={element}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${at.x}%`, top: `${at.y}%` }}
          >
            <ElementBead
              element={element}
              hollow={mine?.low ?? false}
              className={`size-11 text-lg transition ${lit ? 'scale-110 border-2 shadow-[0_0_0_4px_var(--surface)]' : ''}`}
            />
            <span className="absolute top-full mt-0.5 whitespace-nowrap text-[11px] font-bold tabular-nums text-muted">
              {mine?.ko} {mine?.count}
            </span>
          </span>
        );
      })}

      {/* 바깥 — 오늘의 후보. 자리는 상태가 정한다 */}
      {cards.map((card) => {
        const status = statusOf(card);
        const radius =
          status === 'current' ? RING.current : status === 'waiting' ? RING.waiting : status === 'passed' ? RING.passed : 0;
        const at = pointAt(angles[card.candidateUserId], radius);
        const gone = status === 'passed' || status === 'requested';
        const big = status === 'current';
        /* 위쪽 반에 선 사람은 이름표를 바깥(위)에 단다 — 아래에 달면 안쪽 궤도의 오행 자리에 얹힌다 */
        const above = Math.sin((angles[card.candidateUserId] * Math.PI) / 180) < -0.3;
        return (
          <span
            key={card.candidateUserId}
            className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${
              gone ? 'scale-50 opacity-0' : 'opacity-100'
            }`}
            style={{ left: `${at.x}%`, top: `${at.y}%` }}
          >
            <Face
              src={photoOf(card)}
              name={card.nickname}
              sizes="72px"
              className={`relative rounded-full transition-all duration-700 ${
                big ? 'size-[4.5rem] ring-4 ring-accent ring-offset-2 ring-offset-surface' : 'size-12 opacity-80 ring-2 ring-surface grayscale-[35%]'
              }`}
            />
            {card.exploration && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-surface text-accent shadow-sm ring-1 ring-accent/40">
                <Spark className="size-3" />
              </span>
            )}
            <span
              className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 font-bold ${above ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} ${
                big ? 'bg-accent text-[13px] leading-6 text-on-accent' : 'bg-surface/90 text-[11px] leading-5 text-secondary'
              }`}
            >
              {card.nickname}
              {big && <span className="ml-1 tabular-nums opacity-80">{card.previewScore}</span>}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** 후보 → 채워 줄 오행 자리. 사람이 바뀌면 `key` 로 새로 선다 */
function SupplyLine({ from, to, tone }: { from: { x: number; y: number }; to: { x: number; y: number }; tone: string }) {
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      className={`stroke-current ${tone}`}
      strokeWidth="0.7"
      strokeDasharray="1.2 1.6"
      strokeLinecap="round"
    />
  );
}

export function Spark({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0 fill-none stroke-current`} strokeWidth="1.8" strokeLinejoin="round">
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
    </svg>
  );
}
