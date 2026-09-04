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
 * 후보 카드는 맛보기이므로 추천 이유는 적극적으로 나간다: 닉네임, 프로필 사진이 있는지,
 * 소개, **어느 오행을 채우는지와 그 뜻**, 함께 놓았을 때의 균형을 말로 옮긴 한 줄.
 *
 * **자를 것은 이미 DB 에서 잘려 온다.** `my_discovery_board()` 가 스냅샷을 읽어 카드에 설
 * 값만 내준다 — 두 축의 숫자도 가중합도 그 반환형에 없고, 그 셈을 하는 함수는
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
  /** 사진이 있는가 — **바이트는 여기 없다.** 그림은 주소로 받아 간다 */
  readonly hasPhoto: boolean;
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

/** `my_discovery_board()` 가 내주는 한 줄 — **두 축도 점수도 여기 없다** */
type BoardRow = {
  candidate_user_id: string;
  nickname: string;
  intro: string | null;
  has_photo: boolean;
  seat: number;
  exploration: boolean;
  supplied_elements: string[] | null;
  balance_band: string;
};

const BANDS: readonly BalanceBand[] = ['even', 'mixed', 'skewed'];

/**
 * 지금 내 후보 — **만들어 둔 목록을 읽는다**(ADR 0037).
 *
 * 고르는 일은 스냅샷을 만들 때 끝났다. 이 호출이 하는 일은 그것을 읽고, 그 열 명이
 * 지금도 자격이 있는지 다시 묻는 것뿐이다. 없거나 하루가 지났으면 DB 가 그 자리에서
 * 새로 만든다 — **낡음을 판정하는 자리는 하나여야 한다.**
 *
 * 부르면서 넣을 인자는 하나도 없다 — 자리나 후보 목록을 손으로 적을 수 있으면 그것이
 * 곧 위조할 자리다.
 */
export async function candidatesForViewer(mySummary: ElementSummary): Promise<CandidateBoard> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_discovery_board');

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
      hasPhoto: row.has_photo === true,
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

/** 목록을 언제 받았고 몇 초 뒤에 다시 받을 수 있나 — **두 값 다 DB 가 센다** */
export type BoardStamp = { generatedAt: string; waitSeconds: number };

/**
 * 새로고침 버튼이 언제 눌리는지를 **여기서 세지 않는다.**
 *
 * 5분도, 지금 시각과의 뺄셈도 DB 안에 있다. 시각만 받아 여기서 빼면 그 뺄셈이 두 곳에
 * 생기고, 서버와 브라우저의 시계가 어긋난 만큼 버튼이 잘못 눌린다.
 *
 * **목록을 읽은 뒤에 부른다.** 읽는 함수가 24시간 갱신을 일으킬 수 있으므로, 먼저 물으면
 * 방금 만들어진 목록의 시각이 아니라 그 전의 시각을 든다.
 */
export async function boardStamp(): Promise<BoardStamp | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_discovery_snapshot');
  if (error) throw new Error(error.message);

  const row = (data ?? [])[0] as { generated_at: string; wait_seconds: number } | undefined;
  if (row === undefined) return null;

  return { generatedAt: row.generated_at, waitSeconds: row.wait_seconds };
}
