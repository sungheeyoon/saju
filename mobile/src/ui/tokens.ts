import type { Element } from '@saju';

/**
 * 디자인 토큰 — 값은 웹의 `app/globals.css` 밝은 화면과 같다. 어두운 화면은 아직 없다(`app.json` 의 `userInterfaceStyle`).
 * 글씨는 부산단디명조 하나다(M · B). 한자는 그 글꼴에 없어 웹의 `.glyph` 처럼 기기 서체로 둔다.
 */
export const COLOR = {
  background: '#faf6ef',
  foreground: '#26241f',
  surface: '#fffdf9',
  surfaceSunken: '#f2ece2',
  surfaceSoft: '#f6f0e7',
  surfaceRaised: '#ffffff',
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
  warningWash: '#fbf0d8',
  warningBorder: 'rgba(138, 99, 32, 0.25)',
  track: 'rgba(60, 48, 30, 0.09)',
  none: '#5f645d',
  noneSoft: '#efede6',
  noneMid: '#c9c6bc',
} as const;

export const ELEMENT_TONE: Record<Element, { ink: string; soft: string; mid: string }> = {
  木: { ink: '#2e5b3f', soft: '#e3f1dc', mid: '#8cc49a' },
  火: { ink: '#9c3b27', soft: '#fde4da', mid: '#f0957a' },
  土: { ink: '#72500f', soft: '#f8ecd2', mid: '#deb35f' },
  金: { ink: '#444d59', soft: '#e9ecf1', mid: '#a9b4c4' },
  水: { ink: '#2a5575', soft: '#dfecf7', mid: '#86b4db' },
};

export const FONT = { medium: 'BusanDandiMyeongjoM', bold: 'BusanDandiMyeongjoB' } as const;

export const TYPE = { fine: 12, small: 13, sm: 14, body: 15, field: 16, lead: 17, heading: 20, title: 26, figure: 40 } as const;

export const CONTROL = 44;
export const RADIUS = { control: 12, panel: 20, pill: 999 } as const;
