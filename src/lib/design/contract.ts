/**
 * **공용 부품의 약속 표** — 웹 `app/ui/` 와 앱 `mobile/src/ui/` 가 같은 이름 · 같은 변형을 갖는다(ADR 0109 추기 2026-10-31).
 * 웹은 상수 · 함수의 이름으로, 앱은 부품 이름과 변형 낱말로 든다. `scripts/design-contract.test.ts` 가 두 쪽 파일을 글자로 읽어 잰다.
 * 이름이 다르면 앱을 웹에 맞춘다 — 웹 쪽 글자 · 동작은 이 표 때문에 바꾸지 않는다.
 *
 * `pending` 은 앱에 아직 그 이름으로 서지 않은 부품이고, 값은 그 까닭이다. 이 줄은 앱 쪽 이름을 재지 않는다 — 나란히 도는 PR 이 그 부품을 세워도 main 이 붉어지지 않게 한다(#912 · #913). 서고 나면 그 줄을 지운다.
 */
export type PartContract = {
  name: string;
  web: { file: string; symbols: readonly string[] };
  app: { file: string; symbol: string };
  /** 앱의 변형 낱말(`variant="primary"`) → 웹 상수 */
  variants?: Readonly<Record<string, string>>;
  /** 두 쪽이 같은 이름으로 드는 속성 · 상태 */
  props?: readonly string[];
  pending?: string;
};

const WEB_SURFACES = 'app/ui/surfaces.ts';
const WEB_BUTTONS = 'app/ui/buttons.ts';
const APP_SURFACES = 'mobile/src/ui/surfaces.tsx';
const APP_BUTTONS = 'mobile/src/ui/buttons.tsx';

export const PARTS: readonly PartContract[] = [
  { name: 'Card', web: { file: WEB_SURFACES, symbols: ['CARD'] }, app: { file: APP_SURFACES, symbol: 'Card' } },
  { name: 'CardFrame', web: { file: WEB_SURFACES, symbols: ['CARD_FRAME'] }, app: { file: APP_SURFACES, symbol: 'CardFrame' } },
  { name: 'Paper', web: { file: WEB_SURFACES, symbols: ['PAPER'] }, app: { file: APP_SURFACES, symbol: 'Paper' } },
  { name: 'Tile', web: { file: WEB_SURFACES, symbols: ['TILE'] }, app: { file: APP_SURFACES, symbol: 'Tile' } },
  { name: 'Cell', web: { file: 'app/globals.css', symbols: ['--radius-cell'] }, app: { file: APP_SURFACES, symbol: 'Cell' } },
  { name: 'MenuPanel', web: { file: WEB_SURFACES, symbols: ['MENU_PANEL'] }, app: { file: APP_SURFACES, symbol: 'MenuPanel' } },
  { name: 'RowCard', web: { file: WEB_SURFACES, symbols: ['ROW_CARD'] }, app: { file: APP_SURFACES, symbol: 'RowCard' } },
  { name: 'RowLine', web: { file: WEB_SURFACES, symbols: ['ROW_LINE'] }, app: { file: APP_SURFACES, symbol: 'RowLine' } },
  { name: 'EmptySlot', web: { file: WEB_SURFACES, symbols: ['EMPTY_SLOT'] }, app: { file: APP_SURFACES, symbol: 'EmptySlot' } },
  {
    name: 'Button',
    web: { file: WEB_BUTTONS, symbols: ['BUTTON_PRIMARY', 'BUTTON_SECONDARY', 'BUTTON_TERTIARY', 'BUTTON_DANGER'] },
    app: { file: APP_BUTTONS, symbol: 'Button' },
    variants: {
      primary: 'BUTTON_PRIMARY',
      secondary: 'BUTTON_SECONDARY',
      tertiary: 'BUTTON_TERTIARY',
      'tertiary-danger': 'BUTTON_TERTIARY_DANGER',
      danger: 'BUTTON_DANGER',
      'primary-small': 'BUTTON_PRIMARY_SMALL',
      'secondary-small': 'BUTTON_SECONDARY_SMALL',
    },
  },
  {
    name: 'IconButton',
    web: { file: WEB_BUTTONS, symbols: ['ICON_BUTTON', 'ICON_BUTTON_GHOST'] },
    app: { file: APP_BUTTONS, symbol: 'IconButton' },
    variants: { plain: 'ICON_BUTTON', quiet: 'ICON_BUTTON_QUIET', active: 'ICON_BUTTON_ACTIVE', ghost: 'ICON_BUTTON_GHOST' },
  },
  { name: 'Field', web: { file: 'app/ui/fields.ts', symbols: ['FIELD'] }, app: { file: 'mobile/src/ui/parts.tsx', symbol: 'Field' } },
  { name: 'Switch', web: { file: 'app/ui/switch.tsx', symbols: ['Switch'] }, app: { file: 'mobile/src/ui/switch.tsx', symbol: 'Switch' }, props: ['checked', 'busy'] },
  {
    name: 'ConfirmDialog',
    web: { file: 'app/ui/confirm-dialog.tsx', symbols: ['ConfirmDialog'] },
    app: { file: 'mobile/src/ui/confirm-dialog.tsx', symbol: 'ConfirmDialog' },
    props: ['title', 'confirmLabel', 'danger', 'busy', 'failure', 'irreversible', 'lead', 'cancelLabel'],
  },
  {
    name: 'DetailSheet',
    web: { file: 'app/ui/sheet.tsx', symbols: ['DetailSheet'] },
    app: { file: 'mobile/src/ui/sheet.tsx', symbol: 'DetailSheet' },
    props: ['menu', 'onClose', 'children'],
  },
  {
    name: 'TopBar',
    web: { file: 'app/ui/top-bar.tsx', symbols: ['TopBar'] },
    app: { file: 'mobile/src/ui/top-bar.tsx', symbol: 'TopBar' },
  },
  { name: 'NoticeScreen', web: { file: 'app/ui/notice-screen.tsx', symbols: ['NoticeScreen'] }, app: { file: 'mobile/src/ui/notice-screen.tsx', symbol: 'NoticeScreen' } },
  { name: 'Icon', web: { file: 'app/ui/icons.tsx', symbols: ['Icon'] }, app: { file: 'mobile/src/ui/icons.tsx', symbol: 'Icon' } },
  { name: 'ElementSymbol', web: { file: 'app/ui/element-symbol.tsx', symbols: ['ElementSymbol'] }, app: { file: 'mobile/src/ui/element-symbol.tsx', symbol: 'ElementSymbol' } },
  {
    name: 'StemSymbol',
    web: { file: 'app/ui/stem-symbol.tsx', symbols: ['StemSymbol'] },
    app: { file: 'mobile/src/ui/stem-symbol.tsx', symbol: 'StemSymbol' },
  },
  { name: 'EmptyState', web: { file: 'app/ui/empty-state.tsx', symbols: ['EmptyState'] }, app: { file: 'mobile/src/ui/empty-state.tsx', symbol: 'EmptyState' }, props: ['icon', 'art', 'title', 'action'] },
  { name: 'Logo', web: { file: 'app/ui/logo.tsx', symbols: ['Logo'] }, app: { file: 'mobile/src/ui/logo.tsx', symbol: 'Logo' } },
];

/** 나란히 재는 그림의 차례(`scripts/design-compare.mjs`) — 두 쪽이 같은 글자 · 같은 차례로 그린다 */
export const GALLERY: readonly { web: string; app: string; text: string }[] = [
  { web: 'CARD', app: 'Card', text: '카드 한 장' },
  { web: 'CARD_FRAME', app: 'CardFrame', text: '카드의 테만' },
  { web: 'PAPER', app: 'Paper', text: '크림 종이' },
  { web: 'TILE', app: 'Tile', text: '오행 타일' },
  { web: 'CELL', app: 'Cell', text: '칸' },
  { web: 'MENU_PANEL', app: 'MenuPanel', text: '띄움 메뉴 판' },
  { web: 'ROW_CARD', app: 'RowCard', text: '줄 카드' },
  { web: 'ROW_LINE', app: 'RowLine', text: '선 줄' },
  { web: 'EMPTY_SLOT', app: 'EmptySlot', text: '빈 자리' },
  { web: 'DIALOG', app: 'DialogPanel', text: '확인 창의 판' },
  { web: 'BUTTON_PRIMARY', app: 'primary', text: '주 단추' },
  { web: 'BUTTON_SECONDARY', app: 'secondary', text: '보조 단추' },
  { web: 'BUTTON_TERTIARY', app: 'tertiary', text: '셋째 단추' },
  { web: 'BUTTON_TERTIARY_DANGER', app: 'tertiary-danger', text: '셋째 위험' },
  { web: 'BUTTON_DANGER', app: 'danger', text: '위험 단추' },
  { web: 'BUTTON_PRIMARY_SMALL', app: 'primary-small', text: '작은 주' },
  { web: 'BUTTON_SECONDARY_SMALL', app: 'secondary-small', text: '작은 보조' },
  { web: 'FIELD', app: 'Field', text: '글 칸' },
];

/**
 * **앱 화면이 면을 손으로 쓰는 예외**(`scripts/mobile-surfaces.test.ts`) — 면 부품으로 못 세우는 자리만, 사유와 함께. 웹도 그 자리에서 상수를 안 쓴다.
 */
export const SURFACE_EXCEPTIONS: readonly { file: string; found: string; why: string }[] = [
  { file: 'mobile/src/matching/today.tsx', found: 'boxShadow:', why: '오늘의 인연 사진 카드 — 웹 `today-card.tsx` 가 `TILE` 에 없는 `shadow-float` 를 그 자리에서 입힌다' },
  { file: 'mobile/src/chat/room.tsx', found: 'RADIUS.card', why: '말풍선 — 면이 아니라 글자의 모양이고 위 한 귀만 다르다(웹 `bubble-row.tsx` 의 `rounded-card rounded-t*-md`)' },
  { file: 'mobile/src/chat/room.tsx', found: 'borderTopRightRadius: 6', why: '내 말 묶음의 첫 말 — 웹 `rounded-tr-md`' },
  { file: 'mobile/src/chat/room.tsx', found: 'borderTopLeftRadius: 6', why: '상대 말 묶음의 첫 말 — 웹 `rounded-tl-md`' },
  { file: 'mobile/src/app/me/chat/index.tsx', found: 'RADIUS.card', why: '대화방 줄 — 면 없는 줄의 눌림 모양이다(웹 `room-list.tsx` 의 `rounded-card`)' },
];
