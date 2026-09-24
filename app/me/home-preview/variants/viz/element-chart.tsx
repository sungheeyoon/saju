import { ELEMENTS, ELEMENT_KO, type Element } from '@/src/lib/saju';

import { ELEMENT_TONE } from '../../../../element-tone';
import styles from './viz.module.css';

/*
  **오행 분포를 칸으로 센다 — 한 칸이 글자 하나다.**

  값은 `saju.analysis.elements.counts` 하나뿐이다(글자의 단순 개수, 지지는 본기). 점수(`scores`)나 강약은
  안 쓴다 — 이 홈은 판정을 보이는 자리가 아니다. 칸으로 그리는 까닭: 여덟 글자를 나눈 값이라 0~8 의 정수이고,
  정수는 막대 길이보다 **셀 수 있는 칸**이 정확하다(「2와 3」을 눈으로 가를 수 있다).

  **같은 눈금.** 화면에 선 모든 사람(나 포함)의 최댓값을 눈금 끝으로 삼는다(`scaleOf`). 사람마다 눈금이
  다르면 작은 배수가 비교가 아니라 모양 맞추기가 된다.

  **나는 선이다.** 다른 사람의 칸 위에 내 개수를 전경색 가로선으로 긋는다 — 차트에서 가장 진한 선이
  언제나 나다. 선이 칸보다 위면 그 사람이 나보다 적고, 아래면 많다.
*/

export type Counts = Record<Element, number>;

/** 한 칸의 높이 7px + 틈 2px */
const STEP = 9;
const UNIT = 7;

/** 눈금 끝 — 가장 많은 개수, 그래도 4칸 아래로는 안 줄인다(한두 칸짜리 차트는 납작해 못 읽는다) */
export function scaleOf(all: readonly Counts[]): number {
  return Math.max(4, ...all.flatMap((counts) => ELEMENTS.map((element) => counts[element])));
}

const spoken = (counts: Counts) => ELEMENTS.map((element) => `${ELEMENT_KO[element]} ${counts[element]}`).join(', ');

/** 차트 칸 머리 — 오행 한자(색) 위, 한글 이름 아래. 색이 혼자 말하지 않는다 */
export function ElementHeads() {
  return (
    <div className="flex gap-2" aria-hidden="true">
      {ELEMENTS.map((element) => (
        <span key={element} className="flex w-5 flex-col items-center leading-none lg:w-6">
          <span className={`${styles.glyph} text-[15px] ${ELEMENT_TONE[element].text}`}>{element}</span>
          <span className="mt-1 text-[11px] font-medium text-muted">{ELEMENT_KO[element]}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * 작은 배수 한 칸 — 다섯 기둥, 칸으로 쌓는다. `reference` 가 있으면 내 개수를 가로선으로 긋는다.
 * 바닥 아래에 개수 숫자를 둔다: 칸은 모양을, 숫자는 값을 든다.
 */
export function UnitColumns({
  counts,
  reference,
  max,
  who,
}: {
  counts: Counts;
  /** 내 개수 — 내 사주가 없거나 이 줄이 나이면 `null` */
  reference: Counts | null;
  max: number;
  who: string;
}) {
  return (
    <figure
      role="img"
      aria-label={`${who}의 오행 분포 — ${spoken(counts)}${reference === null ? '' : ` (나: ${spoken(reference)})`}`}
      className="m-0 flex flex-col gap-1.5"
    >
      <div className="flex items-end gap-2 border-b border-[var(--viz-axis)]" style={{ height: max * STEP }}>
        {ELEMENTS.map((element) => (
          <span key={element} className="relative flex h-full w-5 lg:w-6 flex-col-reverse gap-[2px]">
            {Array.from({ length: max }, (_, index) => (
              <span
                key={index}
                className={`w-full shrink-0 rounded-[1.5px] ${index < counts[element] ? ELEMENT_TONE[element].bar : 'bg-[var(--viz-grid)]'}`}
                style={{ height: UNIT }}
              />
            ))}
            {reference !== null && (
              <span
                aria-hidden="true"
                className="absolute -inset-x-[3px] h-[2px] rounded-full bg-[var(--viz-ref)]"
                style={{ bottom: reference[element] * STEP - 2 }}
              />
            )}
          </span>
        ))}
      </div>
      <div className="flex gap-2" aria-hidden="true">
        {ELEMENTS.map((element) => (
          <span
            key={element}
            className={`w-5 text-center text-[12px] lg:w-6 leading-none tabular-nums ${counts[element] === 0 ? 'text-muted' : 'font-bold text-foreground'}`}
          >
            {counts[element]}
          </span>
        ))}
      </div>
    </figure>
  );
}

/**
 * 나의 오행 — 가로 칸 막대, 같은 눈금. 이 화면에서 개수가 가장 크게 서는 자리다(24px).
 * 비교 표의 작은 배수와 **같은 `max`** 를 받는다 — 위에서 본 칸 길이가 아래 표의 칸 높이와 같은 뜻이다.
 */
export function SelfBars({ counts, max, glyphCount }: { counts: Counts; max: number; glyphCount: number }) {
  return (
    <figure role="img" aria-label={`나의 오행 분포 — ${spoken(counts)}`} className="m-0 flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5" aria-hidden="true">
        {ELEMENTS.map((element) => {
          const count = counts[element];
          const tone = ELEMENT_TONE[element];
          return (
            <li key={element} className="grid grid-cols-[3.25rem_minmax(0,1fr)_2rem] items-center gap-3">
              <span className="flex items-baseline gap-1.5">
                <span className={`${styles.glyph} text-[20px] leading-none ${count === 0 ? 'text-muted' : tone.text}`}>
                  {element}
                </span>
                <span className="text-[12px] font-medium text-secondary">{ELEMENT_KO[element]}</span>
              </span>
              <span className="flex gap-1">
                {Array.from({ length: max }, (_, index) => (
                  <span
                    key={index}
                    className={`h-4 max-w-9 flex-1 rounded-[3px] ${index < count ? tone.bar : 'bg-[var(--viz-grid)]'}`}
                  />
                ))}
              </span>
              <span
                className={`text-right text-2xl font-bold leading-none tracking-[-0.03em] tabular-nums ${count === 0 ? 'text-muted' : 'text-foreground'}`}
              >
                {count}
              </span>
            </li>
          );
        })}
      </ul>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-3 rounded-[2px] bg-[var(--viz-axis)]" />
          한 칸 = 글자 하나
        </span>
        <span className="tabular-nums">{glyphCount}글자 중</span>
      </figcaption>
    </figure>
  );
}
