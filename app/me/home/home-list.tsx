import { STEM_INFO, type Element, type Stem } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import { StemSymbol } from '../../ui/stem-symbol';
import { CARD_FRAME } from '../../ui/surfaces';

/*
  **홈의 목록 한 벌**(2026-10-25 홈 위계 정리) — 주인공(내 사주 카드) 아래의 것은 모두 흰 판 한 장 안의 구분선 줄이다.

  고치기 전 홈은 한 화면에 판 모양이 다섯 벌이었다 — 진행 띠 · 오행 파스텔 큰 판 · 검색 줄 카드 · 색띠 표지 가로 줄 · 오행 타일 2열과
  점선 「사람 추가」. 토스 · 카카오뱅크 홈은 맨 위 하나만 색 면이고 그 아래는 흰 판 안의 줄 목록이며, 줄 왼쪽의 작은 동그라미가
  무엇인지를 말한다. 그 문법을 따른다 — 오행 파스텔은 주인공 판에만, 줄은 흰 면 위 작은 오행 표시(`HomeMark`)만 색을 입는다.

  줄의 경계는 위 테다(`-mt-px border-t`). 판이 `overflow-hidden` 이라 맨 윗줄의 테는 판 밖으로 밀려 잘린다 — 넓은 화면에서
  두 열로 서도(저장한 사람) 첫 줄 둘의 테가 함께 잘려 줄 사이에만 선이 남는다.
*/

/** 줄을 드는 흰 판 — `<ul>` 에 단다 */
export const HOME_LIST = `${CARD_FRAME} flex flex-col`;

/** 판 안의 줄 하나 — 위 테가 구분선이다 */
export const HOME_ROW = '-mt-px border-t border-border';

/** 줄 안쪽의 배치 — 표시 · 글 · 끝(화살표나 단추) */
export const HOME_ROW_INNER = 'flex min-h-16 items-center gap-3 px-4 py-3';

/** 줄 전체가 링크일 때 — 누르면 면이 한 단 가라앉는다 */
export const HOME_ROW_LINK = `${HOME_ROW_INNER} text-foreground hover:bg-surface-sunken active:bg-surface-sunken`;

/**
 * 줄 끝의 작은 단추 — 흰 면 위의 회색 알약(토스 홈의 「송금」 · 카카오톡 친구 줄의 「선물하기」 꼴). 주 단추(먹색)는 홈에 하나 —
 * 내 사주 카드의 사주풀이 단추 — 만 선다. 누를 자리는 44px 이다
 */
export const HOME_ROW_ACTION =
  'inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-surface-sunken px-3 text-small font-semibold text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_10%,var(--surface-sunken))] active:scale-[0.96]';

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
