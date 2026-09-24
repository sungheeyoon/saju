import Link from 'next/link';

import { BRANCH_INFO, CALENDAR_KO, ELEMENTS, ELEMENT_KO, STEM_INFO, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { Icon } from './icons';
import styles from './night.module.css';
import { NIGHT_FILL, NIGHT_TONE, serif } from './tone';

/*
  **나 — 시계 화면처럼 한 판.** 이 화면에서 가장 먼저 읽히는 것은 여덟 글자다.

  1차의 요약 카드는 여덟 글자를 20px 칸에 담고 일주 이름 · 제목 · 출생 정보를 같은 무게로 늘어놓았다. 여기서는
  글자를 44px(폰) · 64px(데스크톱) 명조로 세로 네 기둥에 세우고, 글자마다 아래에 12px 로 읽는 법(「을목」)을
  단다 — 색만으로 오행을 말하지 않는다. 일주 칸만 금 테를 두르고, 「○○ 일주」 이름은 적지 않는다.
  오행은 막대 대신 가는 선 하나로 잇는다. 풀이의 비유 한 줄은 인용처럼 명조로 둔다 — 풀이가 이 판의 주 행동이다.
*/

export function SelfHero({ self }: { self: FixtureSelf }) {
  const { saju, reading } = self;

  return (
    <section aria-labelledby="night-self" className={`${styles.hero} rounded-[1.75rem] p-5 sm:p-8`}>
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-center md:gap-12">
        <div className="order-2 flex min-w-0 flex-col gap-6 md:order-1">
          <div className="hidden md:block">
            <Identity self={self} />
          </div>

          <ElementLine saju={saju} />

          {reading !== null && (
            <figure className="flex flex-col gap-2 border-l border-[color:var(--n-gold)]/50 pl-4">
              <figcaption className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.04em] text-[color:var(--n-text-3)]">
                사주풀이
                {!reading.fromCurrentChart && <PriorBadge />}
              </figcaption>
              {reading.metaphor !== null && (
                <blockquote className={`${serif.className} text-lg leading-[1.55] text-[color:var(--n-text)]`}>
                  {reading.metaphor}
                </blockquote>
              )}
            </figure>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={previewHref('/me/readings/self')}
              className={`${styles.primary} inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-bold`}
            >
              <Icon name="spark" className="size-4.5" />
              {reading === null ? '사주풀이 받기' : '사주풀이 보기'}
            </Link>
            <Link
              href={previewHref(`/me/people/${self.personId}`)}
              className={`${styles.secondary} inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold`}
            >
              사주 자세히 보기
              <Icon name="arrow" className="size-4" />
            </Link>
          </div>
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-6 md:order-2">
          <div className="md:hidden">
            <Identity self={self} />
          </div>
          <EightGlyphs saju={saju} />
        </div>
      </div>
    </section>
  );
}

/** 누구인가 — 이름은 명조 28px, 출생 정보는 한 단 아래 */
function Identity({ self }: { self: FixtureSelf }) {
  const { query } = self;
  return (
    <header className="flex flex-col gap-1">
      <p className="text-xs font-semibold tracking-[0.08em] text-[color:var(--n-gold)]">내 사주</p>
      <h2 id="night-self" className={`${serif.className} text-[1.75rem] font-semibold leading-tight tracking-[-0.02em]`}>
        {self.label}의 사주팔자
      </h2>
      <p className="text-sm tabular-nums text-[color:var(--n-text-2)]">
        {query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`}
        {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`}
      </p>
    </header>
  );
}

/** 여덟 글자 — 네 기둥을 세로로. 위가 천간, 아래가 지지 */
function EightGlyphs({ saju }: { saju: Saju }) {
  return (
    <ol className="grid grid-cols-4 gap-2 sm:gap-3" aria-label="네 기둥">
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = saju.pillars[key];
        const day = key === 'day';
        return (
          <li
            key={key}
            className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1 pb-3 pt-2.5 ${
              day ? styles.dayFrame : 'border border-transparent'
            }`}
          >
            <span
              className={`text-xs font-semibold tracking-[0.04em] ${
                day ? 'text-[color:var(--n-gold-strong)]' : 'text-[color:var(--n-text-3)]'
              }`}
            >
              {label}
            </span>
            {pillar === null ? (
              <span className="grid min-h-[9.5rem] w-full place-items-center rounded-xl border border-dashed border-[color:var(--n-line-strong)] px-1 text-center text-xs leading-snug text-[color:var(--n-text-3)] sm:min-h-[12rem]">
                {HOUR_UNKNOWN_LABEL}
              </span>
            ) : (
              <>
                <Glyph char={pillar.stem} element={STEM_INFO[pillar.stem].element} reading={STEM_INFO[pillar.stem].ko} />
                <Glyph
                  char={pillar.branch}
                  element={BRANCH_INFO[pillar.branch].element}
                  reading={BRANCH_INFO[pillar.branch].ko}
                />
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Glyph({ char, element, reading }: { char: string; element: (typeof ELEMENTS)[number]; reading: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span
        className={`${serif.className} ${styles.glow} ${NIGHT_TONE[element].text} text-[2.75rem] font-semibold leading-none sm:text-[4rem]`}
      >
        {char}
      </span>
      <span className="text-xs font-medium text-[color:var(--n-text-2)]">
        {reading}
        {ELEMENT_KO[element]}
      </span>
    </span>
  );
}

/**
 * 오행 분포 — 가는 선 하나. 점의 높이가 개수이고, 아래 칸이 글자 · 이름 · 개수를 적는다.
 * 선과 점은 백분율 좌표라 폭이 바뀌어도 글자 칸(5등분)과 어긋나지 않는다.
 */
function ElementLine({ saju }: { saju: Saju }) {
  const { counts, glyphCount } = saju.analysis.elements;
  const max = Math.max(3, ...ELEMENTS.map((element) => counts[element]));
  const points = ELEMENTS.map((element, index) => ({
    element,
    x: `${10 + index * 20}%`,
    y: 56 - (counts[element] / max) * 44,
    count: counts[element],
  }));

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-[0.04em] text-[color:var(--n-text-3)]">오행 분포</h3>
      <svg aria-hidden="true" className="h-16 w-full overflow-visible">
        <line x1="0" x2="100%" y1="56" y2="56" stroke="var(--n-line-strong)" strokeDasharray="2 4" />
        {points.slice(1).map((point, index) => (
          <line
            key={point.element}
            x1={points[index].x}
            y1={points[index].y}
            x2={point.x}
            y2={point.y}
            stroke="var(--n-gold)"
            strokeOpacity="0.55"
            strokeWidth="1.25"
          />
        ))}
        {points.map((point) => (
          <circle
            key={point.element}
            cx={point.x}
            cy={point.y}
            r={point.count === 0 ? 3 : 4.5}
            fill={point.count === 0 ? 'var(--n-bg)' : NIGHT_FILL[point.element]}
            stroke={NIGHT_FILL[point.element]}
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <ul className="grid grid-cols-5 text-center">
        {points.map(({ element, count }) => (
          <li key={element} className="flex flex-col items-center gap-0.5">
            <span className={`${serif.className} text-base leading-none ${count === 0 ? 'text-[color:var(--n-text-3)]' : NIGHT_TONE[element].text}`}>
              {element}
            </span>
            <span className="text-xs text-[color:var(--n-text-2)]">
              {ELEMENT_KO[element]} <span className="font-bold tabular-nums text-[color:var(--n-text)]">{count}</span>
            </span>
          </li>
        ))}
      </ul>
      {glyphCount !== 8 && (
        <p className="text-xs text-[color:var(--n-text-3)]">출생 시각을 몰라 시주는 제외했습니다</p>
      )}
    </div>
  );
}

export function PriorBadge() {
  return (
    <span className="rounded-full border border-[color:var(--n-amber)]/50 px-2 py-0.5 text-[11px] font-semibold tracking-normal text-[color:var(--n-amber)]">
      이전 명식
    </span>
  );
}

/** 내 사주 전 — 할 일이 이것 하나라 금 채움 단추 하나만 선다 */
export function RegisterSelf() {
  return (
    <section aria-labelledby="night-register" className={`${styles.hero} flex flex-col gap-6 rounded-[1.75rem] p-6 sm:p-8`}>
      <div aria-hidden="true" className="grid grid-cols-4 gap-2 sm:max-w-sm">
        {PILLAR_COLUMNS.map(({ key }) => (
          <span
            key={key}
            className={`${serif.className} grid h-24 place-items-center rounded-2xl border border-dashed border-[color:var(--n-line-strong)] text-3xl text-[color:var(--n-text-3)]`}
          >
            ·
          </span>
        ))}
      </div>
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-[0.08em] text-[color:var(--n-gold)]">내 사주</p>
        <h2 id="night-register" className={`${serif.className} text-[1.75rem] font-semibold leading-tight tracking-[-0.02em]`}>
          내 사주 등록
        </h2>
        <p className="max-w-prose text-[15px] leading-relaxed text-[color:var(--n-text-2)]">
          출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
        </p>
      </header>
      <Link
        href={previewHref('/me')}
        className={`${styles.primary} inline-flex min-h-12 items-center justify-center gap-2 self-stretch rounded-2xl px-6 text-[15px] font-bold sm:self-start`}
      >
        내 명식 등록
        <Icon name="arrow" className="size-4" />
      </Link>
    </section>
  );
}
