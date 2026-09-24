import { ELEMENT_KO, STEM_INFO, type Saju } from '@/src/lib/saju';

import { ELEMENT_TONE } from '../../../../element-tone';

/**
 * 일간 한 글자와 그 오행 — 저장한 사람 카드(`ChartSummary`)의 일간 표식을 작게 옮긴 것.
 *
 * 이미 세운 값만 그린다. 두 일간의 좋고 나쁨은 여기서 판정하지 않는다 — 그 말은 궁합풀이가 한다.
 */
export function DayMark({ saju, size = 'md' }: { saju: Saju; size?: 'md' | 'lg' }) {
  const stem = saju.pillars.dayMaster;
  const info = STEM_INFO[stem];
  const tone = ELEMENT_TONE[info.element];
  const box = size === 'lg' ? 'size-14 text-[1.75rem]' : 'size-11 text-[1.4rem]';

  return (
    <span
      className={`glyph grid shrink-0 place-items-center rounded-2xl border font-bold leading-none ${box} ${tone.border} ${tone.surface} ${tone.text}`}
      aria-label={`일간 ${stem}, ${info.ko}${ELEMENT_KO[info.element]}`}
    >
      <span aria-hidden="true">{stem}</span>
    </span>
  );
}

/** 「갑목 일간」 — `ChartSummary` 의 칩과 같은 말이다 */
export function dayMasterName(saju: Saju): string {
  const info = STEM_INFO[saju.pillars.dayMaster];
  return `${info.ko}${ELEMENT_KO[info.element]} 일간`;
}

export function dayTone(saju: Saju) {
  return ELEMENT_TONE[STEM_INFO[saju.pillars.dayMaster].element];
}
