/* 지은 파일이다 — 손대지 말고 `src/lib/design/tokens.json` 을 고친 뒤 `node scripts/design-tokens.mjs` 를 돈다. */

/** 밝은 화면의 색 — Tailwind 의 `--color-*` 이름 */
export const COLOR = {
  "background": "#faf6ef",
  "foreground": "#26241f",
  "surface": "#fffdf9",
  "surfaceRaised": "#ffffff",
  "surfaceSunken": "#f2ece2",
  "surfaceSoft": "#f6f0e7",
  "border": "rgba(60, 48, 30, 0.1)",
  "borderStrong": "rgba(60, 48, 30, 0.22)",
  "secondary": "#5c564d",
  "muted": "#6b6459",
  "accent": "#26241f",
  "accentStrong": "#45413a",
  "onAccent": "#fffaf2",
  "accentWash": "#fff4e6",
  "accentSoft": "#f3e3cc",
  "danger": "#a3473f",
  "dangerWash": "#faeae7",
  "warning": "#8a6320",
  "warningWash": "#fbf0d8",
  "success": "#2e5b3f",
  "track": "rgba(60, 48, 30, 0.09)",
  "cream": "#fff4e6",
  "creamInk": "#6b4a2b",
  "badge": "#c0442c",
  "onBadge": "#ffffff"
} as const;

/** 어두운 화면의 색 — 앱은 아직 안 쓴다 */
export const COLOR_DARK = {
  "background": "#161513",
  "foreground": "#f2efe8",
  "surface": "#1e1d1a",
  "surfaceRaised": "#25231f",
  "surfaceSunken": "#121110",
  "surfaceSoft": "#221f1b",
  "border": "rgba(242, 236, 222, 0.12)",
  "borderStrong": "rgba(242, 236, 222, 0.24)",
  "secondary": "#bdb7ab",
  "muted": "#a39d91",
  "accent": "#f4efe4",
  "accentStrong": "#d8d1c2",
  "onAccent": "#1d1b17",
  "accentWash": "#2b2620",
  "accentSoft": "#3a3229",
  "danger": "#ef9a8e",
  "dangerWash": "#462925",
  "warning": "#e8bf74",
  "warningWash": "#44371f",
  "success": "#b3dfbf",
  "track": "rgba(242, 236, 222, 0.1)",
  "cream": "#2b2620",
  "creamInk": "#eed6b8",
  "badge": "#f09a84",
  "onBadge": "#22120d"
} as const;

/** 오행 한 벌 — 글자 · 면 · 상징의 속. `none` 은 오행을 모를 때 */
export const TONE = {
  "wood": {
    "ink": "#2e5b3f",
    "soft": "#e3f1dc",
    "mid": "#8cc49a"
  },
  "fire": {
    "ink": "#9c3b27",
    "soft": "#fde4da",
    "mid": "#f0957a"
  },
  "earth": {
    "ink": "#72500f",
    "soft": "#f8ecd2",
    "mid": "#deb35f"
  },
  "metal": {
    "ink": "#444d59",
    "soft": "#e9ecf1",
    "mid": "#a9b4c4"
  },
  "water": {
    "ink": "#2a5575",
    "soft": "#dfecf7",
    "mid": "#86b4db"
  },
  "none": {
    "ink": "#5f645d",
    "soft": "#efede6",
    "mid": "#c9c6bc"
  }
} as const;

/** 어두운 화면의 오행 — 앱은 아직 안 쓴다 */
export const TONE_DARK = {
  "wood": {
    "ink": "#b3dfbf",
    "soft": "#1f3326",
    "mid": "#5f9c72"
  },
  "fire": {
    "ink": "#f6bba9",
    "soft": "#3c2520",
    "mid": "#c56a52"
  },
  "earth": {
    "ink": "#ecd197",
    "soft": "#372d1c",
    "mid": "#b08a45"
  },
  "metal": {
    "ink": "#d2dae5",
    "soft": "#2a2f36",
    "mid": "#7f8a9b"
  },
  "water": {
    "ink": "#b0d3f0",
    "soft": "#1d2e3c",
    "mid": "#5689b3"
  },
  "none": {
    "ink": "#b5b9b2",
    "soft": "#242824",
    "mid": "#545a53"
  }
} as const;

/** 그림자 다섯 단 — 웹 문법 글자 그대로. React Native 의 `boxShadow` 가 받는다 */
export const ELEVATION = {
  "card": "0 1px 2px rgba(60, 48, 30, 0.04), 0 12px 32px -12px rgba(60, 48, 30, 0.14)",
  "float": "0 18px 50px -12px rgba(60, 48, 30, 0.28)",
  "soft": "0 2px 8px -4px rgba(60, 48, 30, 0.45)",
  "lift": "0 8px 18px -10px rgba(60, 48, 30, 0.6)",
  "raise": "0 12px 28px -12px rgba(60, 48, 30, 0.5)"
} as const;

/** 어두운 화면의 그림자 — 앱은 아직 안 쓴다 */
export const ELEVATION_DARK = {
  "card": "0 1px 2px rgba(0, 0, 0, 0.16), 0 16px 44px rgba(0, 0, 0, 0.14)",
  "float": "0 18px 50px rgba(0, 0, 0, 0.45)",
  "soft": "0 2px 8px -4px rgba(0, 0, 0, 0.5)",
  "lift": "0 8px 18px -10px rgba(0, 0, 0, 0.6)",
  "raise": "0 12px 28px -12px rgba(0, 0, 0, 0.55)"
} as const;

/** 글자 크기의 단(px) */
export const TEXT = {
  "tag": 11,
  "fine": 12,
  "small": 13,
  "body": 15,
  "field": 16,
  "lead": 17,
  "heading": 20,
  "title": 26,
  "display": 30,
  "figure": 40,
  "note": 14
} as const;

/** 모서리 세 단(px) — 카드 · 칸 · 알약 */
export const RADIUS = {
  "card": 20,
  "cell": 12,
  "pill": 999
} as const;

/** 간격의 단(px) */
export const SPACE = [
  4,
  8,
  12,
  16,
  24,
  32,
  48
] as const;
