import { ELEMENTS, koreaDateOf, type Element } from '@/src/lib/saju';
import type { ElementSummary } from '@/src/lib/matching/elementAxes';
import {
  DISCOVERY_POLICY_V0,
  rankCandidates,
  type CandidateFacts,
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
 * 나가지 않는 것(정책의 `withholds`): 생년월일시·출생지, 여덟 글자, 천간·지지,
 * 십성·신살·형충회합, 운, Evidence, **상대의 전체 오행 구성(개수표)**, 그리고 점수.
 *
 * - 원문과 요약 전체는 애초에 이 서버에도 오지 않는다. DB 가 두 축과 **채우는 오행**
 *   으로 바꿔서 내준다(`discovery_candidates`) — 벡터를 받아 와 화면에서 접는 것은
 *   접은 척일 뿐이다.
 * - 점수는 받아 놓고 안 보낸다. 82점과 79점은 절대적인 궁합 차이로 읽힌다. 줄 세우는
 *   데는 쓰고, 밖으로는 말로 바꿔 낸다.
 * - 형충회합과 상세 근거는 **서로 동의한 뒤**에 열린다. 여기서는 그것이 다음이라는
 *   것만 말한다.
 */

/**
 * 밖에서 지을 수 없는 증표 — 이 모듈만 든다.
 *
 * 카드를 손으로 지어 화면에 넘길 수 있으면, 무엇을 자를지 정하는 자리가 둘이 된다.
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

/** `discovery_candidates` 가 내주는 한 줄 — **오행 요약은 여기 없다** */
type CandidateRow = {
  candidate_user_id: string;
  nickname: string;
  intro: string | null;
  complement: number | string;
  combined_balance: number | string;
  /** 내게 없는 오행 중 이 후보가 가진 것 — 상대의 전체 구성이 아니다 */
  supplied_for_viewer: string[] | null;
};

/**
 * 지금 내가 볼 수 있는 후보.
 *
 * 하드 제외는 DB 가 끝낸 상태로 온다(ADR 0003 — 사주와 무관한 것뿐이다). 여기서 하는
 * 일은 정책대로 줄을 세우고, 탐색 후보를 섞고, 무엇을 보여줬는지 남기는 것뿐이다.
 *
 * @param now 목록을 보는 시각(ms). 엔진과 같은 규율로 **넘겨받는다** — 씨앗이 이
 *   시각의 날짜에서 나므로, 여기서 `Date.now()` 를 부르면 같은 요청 안에서도 목록이
 *   달라질 수 있다.
 */
export async function candidatesForViewer(
  viewerUserId: string,
  mySummary: ElementSummary,
  now: number,
): Promise<CandidateBoard> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('discovery_candidates', {
    p_limit: 200,
  });

  // 「참여를 먼저 켜 주세요」 같은 거절은 DB 가 문장으로 낸다. 여기서 다시 판정하지 않는다.
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as CandidateRow[];

  const facts: CandidateFacts[] = rows.map((row) => ({
    id: row.candidate_user_id,
    // `numeric` 은 자리에 따라 문자열로 오기도 한다. 숫자로 좁히는 자리를 하나 둔다.
    complement: Number(row.complement),
    combinedBalance: Number(row.combined_balance),
    suppliedForViewer: (row.supplied_for_viewer ?? []).filter((element): element is Element =>
      (ELEMENTS as readonly string[]).includes(element),
    ),
  }));

  const profiles = new Map(
    rows.map((row) => [row.candidate_user_id, { nickname: row.nickname, intro: row.intro }] as const),
  );

  /**
   * 씨앗은 **나와 오늘**이다.
   *
   * 새로고침마다 탐색 후보가 뒤집히면 방금 본 사람을 다시 찾지 못하고, 노출 기록도
   * 무엇을 잰 것인지 말할 수 없게 된다. 날짜가 바뀌면 새로 섞인다.
   */
  const today = koreaDateOf(new Date(now));
  const seed = `${viewerUserId}:${today.year}-${today.month}-${today.day}`;

  const page = rankCandidates(facts, {
    seed,
    viewerMissingCount: ELEMENTS.filter((element) => mySummary.counts[element] === 0).length,
  });

  const cards = page.entries.map((entry) => {
    const profile = profiles.get(entry.id);

    return {
      candidateUserId: entry.id,
      nickname: profile?.nickname ?? '',
      intro: profile?.intro ?? null,
      position: entry.position,
      exploration: entry.exploration,
      highlights: entry.highlights,
      balanceLabel: entry.balanceLabel,
      [granted]: true as const,
    };
  });

  /**
   * 무엇을 보여줬는지 남긴다 — **오행 요약 두 벌은 DB 가 채운다.**
   *
   * 실패해도 화면을 막지 않는다. 노출 기록은 운영자가 정책을 평가하는 자리이지
   * 사용자가 후보를 보기 위한 조건이 아니다. 대신 조용히 삼키지 않고 서버 로그에 남긴다 —
   * 기록이 안 쌓이고 있는 것을 아무도 모르는 것이 가장 나쁘다.
   */
  if (cards.length > 0) {
    const { error: logError } = await supabase.rpc('log_discovery_impressions', {
      /**
       * 앱이 주는 것은 **자리와 탐색 여부 둘**뿐이다. 그 둘만 정렬이 앱에서 일어나
       * 앱만 아는 값이고, 나머지는 DB 가 그 자리에서 계산한다 — 후보 id 가 정말 지금
       * 내 후보인지도 DB 가 같은 함수에 다시 묻는다.
       */
      p_rows: page.entries.map((entry) => ({
        candidateUserId: entry.id,
        position: entry.position,
        exploration: entry.exploration,
      })),
    });

    if (logError) console.error('노출 기록을 남기지 못했습니다', logError.message);
  }

  return {
    policyVersion: DISCOVERY_POLICY_V0.version,
    caveat: page.caveat,
    teaser: page.teaser,
    explorationNote: page.explorationNote,
    notice: page.notice,
    cards,
  };
}
