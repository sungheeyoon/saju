import { STEM_INFO, type Element, type Stem } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import { StemSymbol } from '../../ui/stem-symbol';
import { CARD_FRAME } from '../../ui/surfaces';

/*
  **홈의 목록 한 벌**(2026-10-25 홈 위계 정리 · 2026-10-26 2차) — 주인공(내 사주 카드) 아래의 것은 모두 흰 판 한 장 안의 줄이다.

  고치기 전 홈은 한 화면에 판 모양이 다섯 벌이었다 — 진행 띠 · 오행 파스텔 큰 판 · 검색 줄 카드 · 색띠 표지 가로 줄 · 오행 타일 2열과
  점선 「사람 추가」. 토스 · 카카오뱅크 홈은 맨 위 하나만 색 면이고 그 아래는 흰 판 안의 줄 목록이며, 줄 왼쪽의 작은 동그라미가
  무엇인지를 말한다. 그 문법을 따른다 — 오행 파스텔은 주인공 판에만, 줄은 흰 면 위 작은 오행 표시(`HomeMark`)만 색을 입는다.

  **줄 사이에 선이 없다**(2026-10-26 운영자 「줄 표시는 굳이 있어야 하나」) — 토스 홈의 계좌 목록 · 토스증권의 주식 목록 · 카카오톡
  친구 목록은 구분선 없이 줄 높이와 간격으로 나눈다. 판 위아래에 8px 를 두고, 누르면 줄이 둥근 칸으로 가라앉는다(토스 목록의 누름).
  글이 시작하는 자리는 판 안쪽 16px + 표시 40px + 틈 12px = 68px 로 판마다 같다.
*/

/** 줄을 드는 흰 판 — `<ul>` 에 단다 */
export const HOME_LIST = `${CARD_FRAME} flex flex-col py-2`;

/** 판 안의 줄 하나(`<li>`) — 선 없이 높이로 나눈다 */
export const HOME_ROW = 'min-w-0';

/** 줄 안쪽의 배치 — 표시 · 글 · 끝(화살표나 단추). 누름 칸이 판 가장자리에서 8px 안쪽의 둥근 칸이라 글은 판에서 16px 에 선다 */
export const HOME_ROW_INNER = 'mx-2 flex min-h-16 items-center gap-3 rounded-cell px-2 py-2.5';

/** 줄 전체가 링크일 때 — 누르면 둥근 칸이 한 단 가라앉는다 */
export const HOME_ROW_LINK = `${HOME_ROW_INNER} text-foreground hover:bg-surface-sunken active:bg-surface-sunken`;

/**
 * 줄 끝의 작은 단추 — 흰 면 위의 회색 알약(토스 홈 계좌 줄의 「송금」 · 카카오톡 생일인 친구 줄의 「선물하기」 꼴). 주 단추(먹색)는
 * 홈에 하나 — 내 사주 카드의 사주풀이 단추 — 만 선다. 누를 자리는 44px 이다.
 *
 * **폭이 고정이다**(76px) — 토스의 「송금」 단추는 줄마다 같은 폭이라 세로로 한 줄에 선다. 「풀이 보기」 · 「풀이 받기」 · 「풀이 중…」 ·
 * 「자세히」가 섞여도 단추의 왼쪽 끝이 한 줄에 선다.
 */
export const HOME_ROW_ACTION =
  'inline-flex min-h-11 w-19 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-surface-sunken text-small font-semibold text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_10%,var(--surface-sunken))] active:scale-[0.96]';

/**
 * 줄 맨 끝의 값 칸 — 토스증권 주식 목록의 가격 칸처럼 **폭이 고정이고 오른쪽 끝에 선다**(48px). 본 궁합이면 「84점」 글자, 안 봤으면
 * 태극 표시 — 어느 쪽이든 칸 폭이 같아 위 단추와 함께 세로로 한 줄이다. 누를 자리는 44px.
 */
export const HOME_ROW_VALUE =
  'inline-flex min-h-11 w-12 shrink-0 items-center justify-end rounded-cell text-body font-semibold tabular-nums text-foreground hover:underline';

/*
  **구역 머리** — 제목 · 개수 · 오른쪽 링크가 **한 기준선**에 선다(카카오톡 「생일인 친구 2」 · 토스증권 「내 계좌 … 16:50 기준 >」).
  링크는 밑줄 없는 회색 글자와 꺾쇠(>)다 — 토스증권 「보기 >」 꼴. 누를 자리 44px 는 위아래 음수 여백으로 머리 높이를 늘이지 않는다.
*/

/** 머리 한 줄 — 제목 묶음과 링크가 글자의 기준선으로 맞선다 */
export const HOME_HEAD = 'flex items-baseline justify-between gap-4';

/** 제목 옆 개수 — 「3개」 · 「5/10명」 */
export const HOME_HEAD_COUNT = 'font-sans text-small font-semibold tabular-nums text-secondary';

/** 머리 오른쪽 링크 — 회색 글자 + 꺾쇠 */
export const HOME_HEAD_LINK =
  '-my-3 inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-cell text-small font-medium text-secondary hover:text-foreground';

/**
 * 줄 왼쪽의 작은 표시 — **오행 색은 여기만 입는다.** 사람이면 그 일간의 천간 그림, 모르면 회색 오행 기호다. 색만으로 말하지 않게
 * 이름(「햇빛」)은 줄의 글이나 읽는 이름이 든다.
 */
export function HomeMark({ stem, element = null }: { stem?: Stem | null; element?: Element | null }) {
  const tone = stem != null ? STEM_INFO[stem].element : element;
  return (
    <span
      aria-hidden="true"
      className={`${elementScope(tone)} grid size-10 shrink-0 place-items-center rounded-full bg-[var(--tile)] text-[var(--ink)]`}
    >
      {stem != null ? <StemSymbol stem={stem} className="size-6" /> : <ElementSymbol element={tone} className="size-6" />}
    </span>
  );
}
