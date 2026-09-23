import { ELEMENTS } from '@/src/lib/saju';
import { activityBandOf, type ActivityBand } from '@/src/lib/presence';
import type { ElementSummary } from '@/src/lib/discovery/element-axes';
import {
  DISCOVERY_POLICY,
  DISCOVERY_TEASER,
  boardNotes,
  balanceBandOf,
  cardTextFor,
  knownElementsOf,
  previewSummaryFor,
  type CandidateHighlight,
} from '@/src/lib/discovery';

import { supabaseOnServer } from '../auth/server-client';
import { dbFailure } from '../db-error';
import type { RpcRow } from '@/src/lib/db';

/**
 * **후보가 브라우저로 내려가는 유일한 문.**
 *
 * `payloadForViewer` 와 같은 규율이다 — 묻지 않고 답만 낸다. 다만 **자르는 자리가 다르다.**
 * 후보 카드는 맛보기이므로 추천 이유는 적극적으로 나간다: 닉네임, 프로필 사진이 있는지,
 * 소개, **내게 없거나 적은 오행 중 어느 것을 가졌는지**, 함께 놓았을 때의 균형을
 * 말로 옮긴 한 줄.
 *
 * **자를 것은 이미 DB 에서 잘려 온다.** `my_discovery_board()` 가 스냅샷을 읽어 카드에 설
 * 값만 내준다 — 두 축의 원값과 상대의 전체 오행표는 반환형에 없고, 화면에 허용한
 * 오행 첫인상만 완성된 점수로 내준다. 그 셈을 하는 함수는 `authenticated` 가 직접
 * 부르지 못한다. 여기서 하는 일은 **말로 옮기는 것**뿐이다.
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
  /** 추천 이유 — 내게 없거나 적은 오행 중 후보가 가진 것. 없을 수도 있다 */
  readonly highlights: readonly CandidateHighlight[];
  /** 함께 놓았을 때의 균형 — 숫자가 아니라 말 */
  readonly balanceLabel: string;
  /** 점수를 그대로 말로 옮긴 한 줄 */
  readonly verdict: string;
  /** 그 점수가 왜 그 자리인지 — 두 축을 접속으로 묶은 한 줄 */
  readonly reason: string;
  /** 두 사람의 오행 구성을 단순 비교한 discovery-v1 참고값 */
  readonly previewScore: number;
  /** 접속 상태 — 구간 하나. 시각은 오지 않는다(ADR 0092). 모르는 값이면 안 세운다 */
  readonly activity: ActivityBand | null;
  readonly [granted]: true;
};

export type CandidateBoard = {
  readonly policyVersion: string;
  readonly teaser: string;
  readonly explorationNote: string | null;
  readonly notice: string | null;
  readonly cards: CandidateCard[];
};

/**
 * `my_discovery_board()` 가 내주는 한 줄 — **이름과 칸은 생성 타입이 든다**(ADR 0078).
 *
 * 두 축의 원값은 없고 합친 참고 점수만 있다. 앞서는 이 아홉 칸을 손으로 적어 두어,
 * SQL 쪽 이름이 바뀌어도 빨개지는 자리가 없었다.
 *
 * **다만 생성 타입은 반환의 `null` 허용을 말하지 않는다** — `intro`·`supplied_elements`
 * 를 `string`·`string[]` 로 적는다. 그래서 그 둘을 읽는 쪽은 여전히 없음을 견딘다
 * (`knownElementsOf` 가 `null` 을 받는 까닭이다).
 */
type BoardRow = RpcRow<'my_discovery_board'>;

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
  if (error) throw dbFailure(error, 'my_discovery_board');

  const cards = (data ?? []).map((row) => ({
    ...publicCardFromRow(row, mySummary),
    position: row.seat,
    exploration: row.exploration,
    activity: activityBandOf(row.activity),
    [granted]: true as const,
  }));

  const notes = boardNotes({
    viewerMissingCount: ELEMENTS.filter((element) => mySummary.counts[element] === 0).length,
    hasExploration: cards.some((card) => card.exploration),
  });

  return {
    policyVersion: DISCOVERY_POLICY.version,
    teaser: DISCOVERY_TEASER,
    ...notes,
    cards,
  };
}

/** 보관함의 한 장 — 카드가 아는 칸에 **지나친 때**만 더한다 */
export type PassedCard = Omit<CandidateCard, 'position' | 'exploration' | 'activity' | typeof granted> & {
  readonly passedAt: string;
};

/**
 * 내가 지나친 사람들 — **최근 스물**(ADR: `discovery_passed`).
 *
 * 자르는 일은 DB 가 한다. 스물이라는 수도, 자격을 잃은 사람을 빼는 일도 저쪽에 있고
 * 여기서 하는 것은 **말로 옮기는 것**뿐이다 — 후보 목록과 같은 규율이다.
 *
 * 점수는 지금 값으로 다시 센 것이다. 지나칠 때의 값이 아니다.
 */
export async function passedForViewer(mySummary: ElementSummary): Promise<PassedCard[]> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_passed_connections');
  if (error) throw dbFailure(error, 'my_passed_connections');

  /* 카드와 같은 칸에 **지나친 때**만 붙는다 — 칸 이름은 생성 타입이 든다 */
  return (data ?? []).map((row) => ({
    ...publicCardFromRow(row, mySummary),
    passedAt: row.passed_at,
  }));
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
  if (error) throw dbFailure(error, 'my_discovery_snapshot');

  const row = (data ?? [])[0];
  if (row === undefined) return null;

  return { generatedAt: row.generated_at, waitSeconds: row.wait_seconds };
}

/** RPC가 허용한 공개 행을 직렬화 가능한 카드로 옮긴다. 복원도 기존 점수 문구를 쓴다. */
export function publicCardFromRow(row: Pick<BoardRow, 'candidate_user_id' | 'nickname' | 'intro' | 'has_photo' | 'supplied_elements' | 'balance_band' | 'preview_score'>, mySummary: ElementSummary) {
  const suppliedElements = knownElementsOf(row.supplied_elements);
  const balanceBand = balanceBandOf(row.balance_band);
  const previewScore = Math.max(0, Math.min(100, Math.round(row.preview_score)));
  return {
    candidateUserId: row.candidate_user_id,
    nickname: row.nickname,
    intro: row.intro,
    hasPhoto: row.has_photo === true,
    exploration: false,
    previewScore,
    ...cardTextFor({ suppliedElements, balanceBand, viewerCounts: mySummary.counts }),
    ...previewSummaryFor({ previewScore, suppliedElements, balanceBand }),
  };
}
