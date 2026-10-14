import type { Stem } from '../saju';

import type { ReadingKind } from './policy';

/**
 * 내가 만든 글 하나 — **결과가 아니라 결과로 가는 길이다.**
 *
 * kind 넷을 다 든다. 본문도 근거도 없다 — 목록에 본문을 실으면 그 목록이 곧 두 번째
 * 결과 화면이 된다(ADR 0008·0033). DB 의 줄을 이 모양으로 옮기는 문은 `app/me/reading/current.ts` 의 `myReadings` 다.
 */
export type ReadingEntry = {
  readonly kind: ReadingKind;
  /** `match` 는 `null` — 가는 길이 `matchId` 다 */
  readonly personA: string | null;
  readonly personB: string | null;
  readonly matchId: string | null;
  /** `self` 는 `null` — 대상이 나라서 부를 이름이 없다 */
  readonly labelA: string | null;
  readonly labelB: string | null;
  readonly score: number | null;
  readonly metaphor: string | null;
  readonly createdAt: string;
  /** 그 글의 여덟 글자가 아직 지금 명식인가(ADR 0071) */
  readonly fromCurrentChart: boolean;
  /**
   * 표지 앞자리의 일간 — `self` · `person` 은 그 사람, `private` 은 `personA`, **`match` 는 나**다.
   * 내가 주인인 글은 그 글을 만들 때의 사본, `match` 는 동의 당시 사본에서 난다(G-59). 모르면 `null`(회색 표지).
   */
  readonly dayMasterA: Stem | null;
  /** 뒷자리 — `private` 은 `personB`, `match` 는 상대. 한 사람짜리는 `null` */
  readonly dayMasterB: Stem | null;
};
