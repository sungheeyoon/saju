import type { Element } from '@saju';

/**
 * 디자인 토큰 — 값은 웹의 `app/globals.css` 밝은 화면과 같다. 어두운 화면은 아직 없다(`app.json` 의 `userInterfaceStyle`).
 * 글씨는 기기 서체다 — 부산단디명조 원본(TTF)이 들어오면 여기서 바꾼다.
 */
export const COLOR = {
  background: '#faf6ef',
  foreground: '#26241f',
  surface: '#fffdf9',
  surfaceSunken: '#f2ece2',
  border: 'rgba(60, 48, 30, 0.1)',
  borderStrong: 'rgba(60, 48, 30, 0.22)',
  secondary: '#5c564d',
  muted: '#6b6459',
  accent: '#26241f',
  onAccent: '#fffaf2',
  accentWash: '#fff4e6',
  cream: '#fff4e6',
  creamInk: '#6b4a2b',
  danger: '#a3473f',
  none: '#5f645d',
  noneSoft: '#efede6',
} as const;

export const ELEMENT_TONE: Record<Element, { ink: string; soft: string }> = {
  木: { ink: '#2e5b3f', soft: '#e3f1dc' },
  火: { ink: '#9c3b27', soft: '#fde4da' },
  土: { ink: '#72500f', soft: '#f8ecd2' },
  金: { ink: '#444d59', soft: '#e9ecf1' },
  水: { ink: '#2a5575', soft: '#dfecf7' },
};

export const TYPE = { fine: 12, small: 13, body: 15, field: 16, lead: 17, heading: 20, title: 26, figure: 40 } as const;

export const CONTROL = 44;
export const RADIUS = { control: 12, panel: 20, pill: 999 } as const;
