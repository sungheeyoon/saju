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

  **줄 사이에 안쪽 구분선이 있다**(2026-10-26 운영자 「줄 있는 버전」 — 2차에서 걷었다가 되살렸다). 선은 글이 시작하는 자리(판 안쪽
  16px + 표시 40px + 틈 12px = 68px)에서 시작해 판 안쪽 16px 앞에서 끝난다 — 토스 · 카카오톡 목록의 안쪽 구분선(표시 아래로는 선이
  안 지난다). 첫 줄 위에는 없다. 판 위아래에 8px 를 두고, 누르면 줄이 둥근 칸으로 가라앉는다(토스 목록의 누름).
*/

/** 줄을 드는 흰 판 — `<ul>` 에 단다 */
export const HOME_LIST = `${CARD_FRAME} flex flex-col py-2`;

/** 판 안의 줄 하나(`<li>`) — 둘째 줄부터 위에 안쪽 구분선(글 시작선 68px ~ 오른쪽 16px 앞) */
export const HOME_ROW =
  "relative min-w-0 not-first:before:absolute not-first:before:top-0 not-first:before:left-[4.25rem] not-first:before:right-4 not-first:before:h-px not-first:before:bg-border not-first:before:content-['']";

/** 줄 안쪽의 배치 — 표시 · 글 · 끝(화살표나 단추). 누름 칸이 판 가장자리에서 8px 안쪽의 둥근 칸이라 글은 판에서 16px 에 선다 */
export const HOME_ROW_INNER = 'mx-2 flex min-h-16 items-center gap-3 rounded-cell px-2 py-2.5';

/** 줄 전체가 링크일 때 — 누르면 둥근 칸이 한 단 가라앉는다 */
export const HOME_ROW_LINK = `${HOME_ROW_INNER} text-foreground hover:bg-surface-sunken active:bg-surface-sunken`;

/**
 * 줄 끝의 작은 단추 — 흰 면 위의 회색 알약(토스 홈 계좌 줄의 「송금」 · 카카오톡 생일인 친구 줄의 「선물하기」 꼴). 주 단추(먹색)는
 * 홈에 하나 — 내 사주 카드의 사주풀이 단추 — 만 선다. 누를 자리는 44px 이다.
 *
 * **폭이 고정이고 줄의 맨 끝이다**(76px) — 토스의 「송금」 단추는 줄마다 같은 폭 · 같은 자리라 세로로 한 줄에 선다. 「풀이 보기」 ·
 * 「풀이 받기」 · 「풀이 중…」 · 「자세히」가 섞여도 단추의 양 끝이 한 줄에 선다.
 */
export const HOME_ROW_ACTION =
  'inline-flex min-h-11 w-19 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-surface-sunken text-small font-semibold text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_10%,var(--surface-sunken))] active:scale-[0.96]';

/**
 * **본 궁합의 값** — 단추 왼쪽의 값 칸(56px). 「84점」 위 · 「궁합」 아래, 오른쪽 끝 맞춤이다 — 토스 홈 계좌 줄이 금액(값)을 글로 세우고
 * 그 오른쪽에 「송금」 단추를 두는 꼴, 토스증권 · 뱅크샐러드 목록의 오른쪽 값(굵은 수 위 · 작은 이름 아래). 면이 없어 값으로 읽히고,
 * 누르면 그 궁합풀이로 간다(누를 자리 44px).
 */
export const HOME_ROW_VALUE =
  'inline-flex min-h-11 w-14 shrink-0 flex-col items-end justify-center rounded-cell tabular-nums hover:underline';

/**
 * **안 본 궁합의 단추** — 값 칸과 같은 폭(56px)의 테두리 알약. 「풀이 보기/받기」(채운 알약)보다 한 단 가볍다 — 두 단추가 다 누르는 것으로
 * 보이되 주인은 풀이다(카카오톡 친구 줄 끝의 「선물하기」 같은 테두리 단추).
 */
export const HOME_ROW_GHOST =
  'inline-flex min-h-11 w-14 shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-full border border-border bg-surface text-small font-semibold text-foreground hover:border-border-strong active:scale-[0.96]';

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
