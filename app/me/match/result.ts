import type { CompatSide } from '@/src/lib/saju';
import { balanceBandOf, cardTextFor, knownElementsOf } from '@/src/lib/discovery';
import { suppliedText } from '@/src/lib/consent';

import { supabaseOnServer } from '../../auth/server-client';
import { storedPillarChart, type SharedPillarChart } from '../../shared-pillar';
import { UUID } from '../../uuid';
import { dbFailure } from '../../db-error';

/**
 * **공유 결과가 브라우저로 내려가는 유일한 문.**
 *
 * `payloadForViewer` · `candidatesForViewer` · `inboxForViewer` 와 같은 규율이다 —
 * 묻지 않고 답만 낸다.
 *
 * ## 자르는 자리가 없어졌다 (ADR 0071)
 *
 * 앞서는 여기가 **자르는 자리**였다. 서버가 열쇠로 상대의 계산 입력을 읽어
 * (`match_calculation_inputs`) 두 명식을 세우고, 여덟 글자만 새 객체로 잘라 내보냈다.
 *
 * 이제 그 여덟 글자는 **동의하던 그 트랜잭션에서 이미 베껴져 있다.** 읽어서 그대로
 * 내보내면 되므로 자를 것이 없고, **상대의 계산 입력을 읽는 열쇠 문이 이 길에서 빠진다**
 * (ADR 0010 개정). 출생 원문·출생지·성별은 애초에 이 함수에 도착하지 않는다.
 *
 * 나가는 것이 넓어지지 않았다 — 여덟 글자는 동의로 열린 바로 그 값이다(ADR 0012).
 *
 * ## 관계 판정이 여기서 없어졌다
 *
 * `analyzeCompatibility` 를 부르고 그 결과를 `compat` 으로 실어 보냈는데 **이 화면은 그
 * 값을 한 번도 안 썼다** — 결과 화면이 세우는 것은 풀이와 명식 보드뿐이고, 엔진 중간
 * 관계표는 공유 결과에 안 선다(ADR 0035·0058). 자료를 못 읽게 된 김에 함께 걷는다.
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
   * 갈리는 것은 부르는 말뿐이라, 읽는 사람이 자기를 어디에 놓아야 할지 헤매지 않도록
   * 자기 자리를 앞에 둔다.
   */
  readonly names: { readonly a: string; readonly b: string };
  /** **동의 당시** 여덟 글자 — 지금 다시 세지 않는다(ADR 0071) */
  readonly charts: Record<CompatSide, SharedPillarChart>;
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
 * 둘을 가른다. **없거나 못 보는 Match** 는 `null` 이고(그 둘은 갈리지 않는다 — 갈리면
 * 응답 차이만으로 실재를 알아낼 수 있다), **여덟 글자가 없는 Match** 는 자기 말을 든다.
 * 뒤엣것을 `null` 로 합치면 성립한 Match 를 두고 「그런 것 없습니다」라고 말하게 된다.
 *
 * 「못 읽는 판본」 갈래는 없어졌다 — 이 길에서 판본을 안 읽는다.
 */
export type ResultOutcome =
  | { kind: 'ok'; result: SharedResult }
  | { kind: 'closed'; message: string };

/** `my_match_scope()` 가 내주는 한 줄 — **여기 없는 것이 안 나가는 것이다** */
type ScopeRow = {
  match_id: string;
  partner_user_id: string;
  partner_nickname: string | null;
  partner_intro: string | null;
  my_chart: unknown;
  partner_chart: unknown;
  supplied_to_me: string[] | null;
  supplied_to_them: string[] | null;
  balance_band: string;
  created_at: string;
};

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
  if (error) throw dbFailure(error, 'my_match_scope');

  const scope = ((data ?? []) as ScopeRow[])[0];
  if (scope === undefined) return null;

  const names = { a: '나', b: scope.partner_nickname ?? '상대' } as const;

  const mine = storedPillarChart(scope.my_chart);
  const theirs = storedPillarChart(scope.partner_chart);

  /**
   * **동의 당시 여덟 글자가 없다.**
   *
   * 백필이 아직 안 닿은 옛 Match 다. 지금 값으로 메우면 두 사람이 동의한 적 없는 명식이
   * 보드에 서므로, 메우지 않고 그렇게 말하고 멈춘다.
   */
  if (mine === null || theirs === null) {
    const message = '동의 당시의 여덟 글자를 찾지 못했습니다';
    console.error('공유 결과를 닫는다', matchId, message);
    return { kind: 'closed', message };
  }

  return {
    kind: 'ok',
    result: {
      matchId: scope.match_id,
      partnerUserId: scope.partner_user_id,
      partnerNickname: names.b,
      partnerIntro: scope.partner_intro,
      names,
      charts: { a: mine, b: theirs },
      suppliedToMe: suppliedText(knownElementsOf(scope.supplied_to_me), 'toMe'),
      suppliedToThem: suppliedText(knownElementsOf(scope.supplied_to_them), 'toThem'),
      balanceLabel: cardTextFor({
        suppliedElements: [],
        balanceBand: balanceBandOf(scope.balance_band),
      }).balanceLabel,
      createdAt: scope.created_at,
      [granted]: true,
    },
  };
}
