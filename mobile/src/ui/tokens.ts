import type { Element } from '@saju';
import { COLOR as DESIGN_COLOR, RADIUS as DESIGN_RADIUS, TEXT, TONE } from '@design';

/**
 * 앱의 디자인 토큰 — 값의 원본은 `src/lib/design/tokens.json` 이다(웹 CSS 와 한 원본에서 난다, ADR 0109 추기 2026-10-31). 여기는 앱의 이름만 든다.
 * 어두운 화면은 아직 없다(`app.json` 의 `userInterfaceStyle`). 글씨는 부산단디명조 하나다(M · B). 한자는 그 글꼴에 없어 웹의 `.glyph` 처럼 기기 서체로 둔다.
 */
export const COLOR = {
  ...DESIGN_COLOR,
  /** 웹의 `border-warning/25` */
  warningBorder: 'rgba(138, 99, 32, 0.25)',
  none: TONE.none.ink,
  noneSoft: TONE.none.soft,
  noneMid: TONE.none.mid,
} as const;

export const ELEMENT_TONE: Record<Element, { ink: string; soft: string; mid: string }> = {
  木: TONE.wood,
  火: TONE.fire,
  土: TONE.earth,
  金: TONE.metal,
  水: TONE.water,
};

export const FONT = { medium: 'BusanDandiMyeongjoM', bold: 'BusanDandiMyeongjoB' } as const;

export const TYPE = TEXT;

export const CONTROL = 44;

export const RADIUS = DESIGN_RADIUS;
