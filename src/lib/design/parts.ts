import { COLOR, ELEVATION, RADIUS, TEXT } from './tokens.generated';

/**
 * **면 · 칸 · 단추의 값** — 웹 `app/ui/surfaces.ts` · `buttons.ts` · `fields.ts` 의 같은 이름 상수를 앱 스타일로 옮긴 것이다(ADR 0109 추기 2026-10-31).
 * 웹은 클래스 글자라 생성하지 않고, `scripts/mobile-design-tokens.test.ts` 가 그 글자를 읽어 같은지 잰다. 폰 폭의 값이다(`sm:` 은 앱에 없다).
 */

/** 누를 자리 — 웹의 `min-h-11` */
export const CONTROL = 44;

export const SURFACE = {
  CARD: { borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, padding: 20, boxShadow: ELEVATION.card },
  CARD_FRAME: { overflow: 'hidden', borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  PAPER: { borderRadius: RADIUS.card, backgroundColor: COLOR.cream, padding: 24 },
  TILE: { borderRadius: RADIUS.card, padding: 16 },
  MENU_PANEL: { borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, boxShadow: ELEVATION.float },
  ROW_CARD: { borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, paddingHorizontal: 16, paddingVertical: 12 },
  ROW_LINE: { borderRadius: RADIUS.cell, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLOR.border, paddingHorizontal: 8, paddingVertical: 16 },
  EMPTY_SLOT: { borderRadius: RADIUS.card, borderWidth: 2, borderStyle: 'dashed', borderColor: COLOR.borderStrong, padding: 24 },
  DIALOG: { borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, padding: 24, boxShadow: ELEVATION.float },
} as const;

/** 아래에서 올라오는 판 — 웹은 상수 없이 `rounded-t-card bg-background` 다(`app/ui/sheet.tsx` · `action-sheet.tsx`) */
export const SHEET = { borderTopLeftRadius: RADIUS.card, borderTopRightRadius: RADIUS.card, backgroundColor: COLOR.background } as const;

/** 칸 — 웹은 상수 없이 `rounded-cell` 에 그 자리의 면을 붙인다. 가장 많이 쓰는 면(`rounded-cell bg-surface-soft p-3`)이 기본이다 */
export const CELL = { borderRadius: RADIUS.cell, backgroundColor: COLOR.surfaceSoft, padding: 12 } as const;

/** 글을 받는 칸 — `FIELD` */
export const FIELD = {
  minHeight: 48,
  borderRadius: RADIUS.cell,
  borderWidth: 1,
  borderColor: COLOR.borderStrong,
  backgroundColor: COLOR.surface,
  paddingHorizontal: 16,
  fontSize: TEXT.field,
} as const;

export const BUTTON = {
  BUTTON_PRIMARY: { minHeight: 48, borderRadius: RADIUS.pill, backgroundColor: COLOR.accent, paddingHorizontal: 20, fontSize: TEXT.body, color: COLOR.onAccent, boxShadow: ELEVATION.lift },
  BUTTON_SECONDARY: { minHeight: 48, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, paddingHorizontal: 20, fontSize: TEXT.body, color: COLOR.foreground },
  BUTTON_TERTIARY: { minHeight: CONTROL, borderRadius: RADIUS.cell, paddingHorizontal: 4, fontSize: TEXT.note, color: COLOR.foreground },
  BUTTON_TERTIARY_DANGER: { minHeight: CONTROL, borderRadius: RADIUS.cell, paddingHorizontal: 4, fontSize: TEXT.note, color: COLOR.danger },
  BUTTON_PRIMARY_SMALL: { minHeight: CONTROL, borderRadius: RADIUS.pill, backgroundColor: COLOR.accent, paddingHorizontal: 16, fontSize: TEXT.note, color: COLOR.onAccent },
  BUTTON_SECONDARY_SMALL: { minHeight: CONTROL, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, paddingHorizontal: 16, fontSize: TEXT.note, color: COLOR.foreground },
  BUTTON_DANGER: { minHeight: 48, borderRadius: RADIUS.pill, backgroundColor: COLOR.danger, paddingHorizontal: 20, fontSize: TEXT.body, color: COLOR.surface },
  ICON_BUTTON: { width: CONTROL, height: CONTROL, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, color: COLOR.foreground },
  ICON_BUTTON_QUIET: { width: CONTROL, height: CONTROL, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, color: COLOR.secondary },
  ICON_BUTTON_ACTIVE: { width: CONTROL, height: CONTROL, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.accent, backgroundColor: COLOR.accent, color: COLOR.onAccent },
  ICON_BUTTON_GHOST: { width: CONTROL, height: CONTROL, borderRadius: RADIUS.pill, color: COLOR.foreground },
} as const;

/** 주 단추가 못 눌릴 때 — 웹의 `PRIMARY_OFF`. 그림자가 없다 */
export const BUTTON_PRIMARY_OFF = { backgroundColor: COLOR.surfaceSunken, color: COLOR.muted } as const;
/** 나머지 단추가 못 눌릴 때의 흐림 · 누를 때 줄어듦 — 웹의 `PRESS` */
export const BUTTON_OFF_OPACITY = 0.55;
export const BUTTON_PRESSED_SCALE = 0.97;
