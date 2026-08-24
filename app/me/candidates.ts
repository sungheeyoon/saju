import { ELEMENTS, type Element } from '@/src/lib/saju';
import type { ElementSummary } from '@/src/lib/matching/elementAxes';
import {
  DISCOVERY_CAVEAT,
  DISCOVERY_POLICY_V0,
  DISCOVERY_TEASER,
  boardNotes,
  cardTextFor,
  type BalanceBand,
  type CandidateHighlight,
} from '@/src/lib/discovery';

import { supabaseOnServer } from '../auth/server-client';

/**
 * **후보가 브라우저로 내려가는 유일한 문.**
 *
 * `payloadForViewer` 와 같은 규율이다 — 묻지 않고 답만 낸다. 다만 **자르는 자리가 다르다.**
 * 후보 카드는 맛보기이므로 추천 이유는 적극적으로 나간다: 별명, 소개, **어느 오행을
 * 채우는지와 그 뜻**, 함께 놓았을 때의 균형을 말로 옮긴 한 줄.
 *
 * **자를 것은 이미 DB 에서 잘려 온다.** `discovery_board()` 가 고르고·줄 세우고·기록하고
 * 카드에 설 값만 내준다 — 두 축의 숫자도 가중합도 그 반환형에 없고, 그 셈을 하는 함수는
 * `authenticated` 가 직접 부르지도 못한다. 여기서 하는 일은 **말로 옮기는 것**뿐이다.
 *
 * 그래서 이 파일에는 자를 것을 고르는 판단이 없다. 판단이 앱에 있으면 그 앱을 건너뛴
 * 경로에서 열린다 — RPC 는 로그인한 사람이 브라우저에서 그대로 부를 수 있다.
 */

/**
 * 밖에서 지을 수 없는 증표 — 이 모듈만 든다.
 *
 * 카드를 손으로 지어 화면에 넘길 수 있으면, 무엇을 말할지 정하는 자리가 둘이 된다.
 */
const granted = Symbol('candidatesForViewer');

export type CandidateCard = {
  readonly candidateUserId: string;
  readonly nickname: string;
  readonly intro: string | null;
  /** 0부터 — 화면의 차례이자 노출 기록이 든 자리 */
  readonly position: number;
  readonly exploration: boolean;
  /** 추천 이유 — 채우는 오행과 그 뜻. 없을 수도 있다 */
  readonly highlights: readonly CandidateHighlight[];
  /** 함께 놓았을 때의 균형 — 숫자가 아니라 말 */
  readonly balanceLabel: string;
  readonly [granted]: true;
};

export type CandidateBoard = {
  readonly policyVersion: string;
  readonly caveat: string;
  readonly teaser: string;
  readonly explorationNote: string | null;
  readonly notice: string | null;
  readonly cards: CandidateCard[];
};

/** `discovery_board()` 가 내주는 한 줄 — **두 축도 점수도 여기 없다** */
type BoardRow = {
  candidate_user_id: string;
  nickname: string;
  intro: string | null;
  seat: number;
  exploration: boolean;
  supplied_elements: string[] | null;
  balance_band: string;
};

const BANDS: readonly BalanceBand[] = ['even', 'mixed', 'skewed'];

/**
 * 지금 내 후보.
 *
 * 하드 제외도, 줄 세우기도, 탐색 배치도, 노출 기록도 **한 번의 호출 안에서** 끝난 채로
 * 온다(ADR 0003 「이행」). 부르면서 넣을 인자는 하나도 없다 — 자리나 후보 목록을 손으로
 * 적을 수 있으면 그것이 곧 위조할 자리다.
 */
export async function candidatesForViewer(mySummary: ElementSummary): Promise<CandidateBoard> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('discovery_board');

  // 「참여를 먼저 켜 주세요」 같은 거절은 DB 가 문장으로 낸다. 여기서 다시 판정하지 않는다.
  if (error) throw new Error(error.message);

  const cards = ((data ?? []) as BoardRow[]).map((row) => {
    const suppliedElements = (row.supplied_elements ?? []).filter((element): element is Element =>
      (ELEMENTS as readonly string[]).includes(element),
    );
    // 밴드 이름을 못 알아보면 가장 낮은 칸으로 읽는다 — 모르는 값을 좋은 쪽으로 눕히지 않는다.
    const balanceBand = BANDS.find((band) => band === row.balance_band) ?? 'skewed';

    return {
      candidateUserId: row.candidate_user_id,
      nickname: row.nickname,
      intro: row.intro,
      position: row.seat,
      exploration: row.exploration,
      ...cardTextFor({ suppliedElements, balanceBand }),
      [granted]: true as const,
    };
  });

  const notes = boardNotes({
    viewerMissingCount: ELEMENTS.filter((element) => mySummary.counts[element] === 0).length,
    hasExploration: cards.some((card) => card.exploration),
  });

  return {
    policyVersion: DISCOVERY_POLICY_V0.version,
    caveat: DISCOVERY_CAVEAT,
    teaser: DISCOVERY_TEASER,
    ...notes,
    cards,
  };
}
