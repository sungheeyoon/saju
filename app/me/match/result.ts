import { ELEMENTS, analyzeCompatibility, type Compatibility, type Element } from '@/src/lib/saju';
import { buildMatchPreview, type MatchPreview } from '@/src/lib/matching';
import { cardTextFor, type BalanceBand } from '@/src/lib/discovery';
import { suppliedText } from '@/src/lib/consent';

import { supabaseOnServer } from '../../auth/server-client';
import { chartOf } from '../../chart';
import { UnreadableRevisionError, queryFromRevision } from '../../revision';
import { ResultClosedError, pinnedInputs } from './inputs';

/**
 * **공유 결과가 브라우저로 내려가는 유일한 문.**
 *
 * `payloadForViewer` · `candidatesForViewer` · `inboxForViewer` 와 같은 규율이다 —
 * 묻지 않고 답만 낸다. 다만 **자르는 자리가 여기다.**
 *
 * 다른 셋은 자를 것이 이미 DB 에서 잘려 왔다. 여기는 아니다: 관계 판정이
 * TypeScript 엔진에 있어서 DB 가 잘라 줄 수 없고(ADR 0010), 그래서 서버가 두 명식을
 * 실제로 들고 계산한 뒤 잘라 내보낸다. **두 `Saju` 는 이 함수 안에서 나고 이 함수
 * 안에서 죽는다** — 나가는 것은 `Compatibility` 와 `MatchPreview` 와 말뿐이다.
 *
 * 판정은 여전히 앱에 없다. 「누가 볼 수 있는가」는 `my_match_scope` 가 `auth.uid()`
 * 로 답하고, 그 답이 없으면 여기서는 아무것도 읽지 않는다.
 */

/**
 * 밖에서 지을 수 없는 증표 — 이 모듈만 든다.
 *
 * 결과를 손으로 지어 화면에 넘길 수 있으면, 무엇이 나가는지 정하는 자리가 둘이 된다.
 */
const granted = Symbol('matchResultForViewer');

export type SharedResult = {
  readonly matchId: string;
  /** 차단하는 문이 하나이려면 필요하다 — 요청함이 이미 내주는 것과 같은 값이다 */
  readonly partnerUserId: string;
  readonly partnerNickname: string;
  readonly partnerIntro: string | null;
  /**
   * 두 사람을 부르는 말 — **`a` 가 언제나 보는 사람이다.**
   *
   * 사실은 어느 쪽을 `a` 로 넣든 같다(`match-v0` 의 네 축은 다 자리 대칭이고 관계는
   * 양쪽을 함께 본다). 갈리는 것은 부르는 말뿐이라, 읽는 사람이 자기를 어디에 놓아야
   * 할지 헤매지 않도록 자기 자리를 앞에 둔다.
   */
  readonly names: { readonly a: string; readonly b: string };
  /** 두 원국 **사이**의 사실 — 각자의 원국 안에서 닫힌 것은 여기 없다 */
  readonly compat: Compatibility;
  /** 고정된 `match-v0` — 셈은 익명 화면과 **같은 함수**가 한다 */
  readonly preview: MatchPreview;
  /** 요청이 잡아 둔 그때의 두 축 — 지금 다시 세지 않는다 */
  readonly suppliedToMe: string | null;
  readonly suppliedToThem: string | null;
  readonly balanceLabel: string;
  readonly createdAt: string;
  readonly [granted]: true;
};

/**
 * 결과를 그리기 **전에** 나오는 답.
 *
 * 셋을 가르는 것이 요점이다. **없거나 못 보는 Match** 는 `null` 이고(그 둘은 갈리지
 * 않는다 — 갈리면 응답 차이만으로 실재를 알아낼 수 있다), **못 읽는 판본**과 **열지
 * 못한 결과**는 각자의 말을 든다. 뒤의 둘을 `null` 로 합치면 성립한 Match 를 두고
 * 「그런 것 없습니다」라고 말하게 된다.
 */
export type ResultOutcome =
  | { kind: 'ok'; result: SharedResult }
  | { kind: 'unreadable'; message: string }
  | { kind: 'closed'; message: string };

/** `my_match_scope()` 가 내주는 한 줄 — **여기 없는 것이 안 나가는 것이다** */
type ScopeRow = {
  match_id: string;
  partner_user_id: string;
  partner_nickname: string | null;
  partner_intro: string | null;
  my_revision_id: string;
  partner_revision_id: string;
  supplied_to_me: string[] | null;
  supplied_to_them: string[] | null;
  balance_band: string;
  created_at: string;
};

/** 주소로 들어온 값이라 모양부터 본다 — 형식이 틀린 것도 「없는 Match」와 같은 답이다 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BANDS: readonly BalanceBand[] = ['even', 'mixed', 'skewed'];

/** 모르는 오행 글자는 버린다. 모르는 값을 그럴듯한 것으로 눕히지 않는다 */
const elementsOf = (raw: string[] | null): Element[] =>
  (raw ?? []).filter((element): element is Element =>
    (ELEMENTS as readonly string[]).includes(element),
  );

/**
 * 그 Match 의 공유 결과.
 *
 * @returns 없거나 못 보는 Match 면 `null`. 그 밖에는 무엇이 됐는지를 값으로 낸다.
 */
export async function matchResultForViewer(matchId: string): Promise<ResultOutcome | null> {
  if (!UUID.test(matchId)) return null;

  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_match_scope', { p_match_id: matchId });

  /**
   * 「중지된 계정입니다」 같은 거절은 DB 가 문장으로 낸다. 여기서 다시 판정하지 않는다.
   * 다만 그 문장을 결과 화면의 말로 옮기지는 않는다 — 이 자리에서는 못 보는 것과
   * 없는 것이 같은 답이어야 한다.
   */
  if (error) return null;

  const scope = ((data ?? []) as ScopeRow[])[0];
  if (scope === undefined) return null;

  let inputs;
  try {
    inputs = await pinnedInputs(matchId);
  } catch (failure) {
    if (failure instanceof ResultClosedError) return { kind: 'closed', message: failure.message };
    throw failure;
  }

  const mine = inputs.get(scope.my_revision_id);
  const theirs = inputs.get(scope.partner_revision_id);

  /**
   * DB 가 매어 둔 판본과 열쇠가 내준 판본이 어긋났다. 일어날 수 없는 자리지만,
   * 일어난다면 **다른 사람의 사주로 결과를 그리는 것**이라 여기서 멈춘다.
   */
  if (mine === undefined || theirs === undefined) {
    return { kind: 'closed', message: '공유 결과를 열지 못했습니다 — 매인 판본을 찾지 못했습니다' };
  }

  const names = { a: '나', b: scope.partner_nickname ?? '상대' } as const;

  let charts;
  try {
    charts = {
      // 이름은 계산에 들어가지 않는다. 부를 말은 위에서 정한 것을 쓴다.
      a: chartOf(queryFromRevision(mine, names.a)),
      b: chartOf(queryFromRevision(theirs, names.b)),
    };
  } catch (failure) {
    /**
     * 못 읽는 판본은 **기본값으로 메우지 않는다.** 저장된 값은 그대로 있고 읽는
     * 쪽이 못 읽는 것이므로, 그렇게 말하고 멈춘다(`/me` · `/me/compat` 과 같은 규율).
     */
    if (failure instanceof UnreadableRevisionError) {
      return { kind: 'unreadable', message: failure.message };
    }
    throw failure;
  }

  const compat = analyzeCompatibility(charts.a, charts.b);

  return {
    kind: 'ok',
    result: {
      matchId: scope.match_id,
      partnerUserId: scope.partner_user_id,
      partnerNickname: names.b,
      partnerIntro: scope.partner_intro,
      names,
      compat,
      // 익명 화면이 부르는 것과 **같은 함수**다. 부르는 자리가 둘이어도 정책은 하나다.
      preview: buildMatchPreview(charts, compat, names),
      suppliedToMe: suppliedText(elementsOf(scope.supplied_to_me), 'toMe'),
      suppliedToThem: suppliedText(elementsOf(scope.supplied_to_them), 'toThem'),
      balanceLabel: cardTextFor({
        suppliedElements: [],
        // 밴드 이름을 못 알아보면 가장 낮은 칸으로 읽는다 — 좋은 쪽으로 눕히지 않는다.
        balanceBand: BANDS.find((band) => band === scope.balance_band) ?? 'skewed',
      }).balanceLabel,
      createdAt: scope.created_at,
      [granted]: true,
    },
  };
}
