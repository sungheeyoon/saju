/**
 * 「만드는 중」의 말 — **아무것도 import 하지 않는다**(ADR 0157).
 *
 * 내 사주 카드는 브라우저에서도 그려진다(`app/save-for-reading.tsx`). 이 말을 `running-line.ts` 에 두면 카드가 그 파일을 거쳐
 * 프롬프트 원문까지 브라우저 묶음으로 끌고 간다(`scripts/layers.test.ts` 「브라우저로 가는 그래프」).
 */

/** 진행 중은 「~ 중…」 하나다(`docs/context/copy.md` 8). 확정(대장 15, 2026-10-09) */
export const READING_MAKING = '만드는 중…';

/**
 * 내 사주 카드 · 빈 표지가 「사주풀이 받기」 대신 드는 말 — 이미 시작한 일을 새로 시작하라고 하지 않는다. 확정(대장 15).
 *
 * `docs/context/copy.md` 8 의 예(「풀이 만드는 중…」) 그대로다. 「사주풀이 만드는 중…」은 폰에서 반반 단추(390px)와 빈 표지에
 * 안 들어 잘렸다(2026-10-09 로컬 그림).
 */
export const SELF_READING_MAKING = `풀이 ${READING_MAKING}`;

/**
 * 저장한 사람 타일(`person-tile.tsx`)의 단추만 드는 짧은 말. 타일은 폰 390px 에서 단추 칸이 「1fr + 궁합 단추」라
 * 「풀이 만드는 중…」이 잘렸다(2026-10-09 화면 점검). 무엇을 만드는지는 같은 타일의 한 줄이 `SELF_READING_MAKING` 으로 든다.
 * 운영자 결정 2026-10-09.
 */
export const TILE_READING_MAKING = '풀이 중…';
