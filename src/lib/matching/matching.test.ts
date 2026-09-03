import { describe, expect, it } from 'vitest';

import { analyzeCompatibility, computeSaju } from '../saju';
import {
  buildMatchPreview,
  MATCH_POLICY_V0,
} from '.';

const chart = (year: number, month: number, day: number, hour: number | null) =>
  computeSaju(
    hour === null
      ? { year, month, day, hour: null, gender: 'female' }
      : { year, month, day, hour, minute: 0, second: 0, gender: 'female' },
    { longitude: 126.98, useLongitude: true },
  );

describe('match-v0', () => {
  it('공개한 가중치의 합이 1이다', () => {
    expect(
      Object.values(MATCH_POLICY_V0.weights).reduce((sum, weight) => sum + weight, 0),
    ).toBeCloseTo(1);
  });

  it('사주 사실을 네 영역의 버전된 베타 지표로 바꾼다', () => {
    const charts = {
      a: chart(1990, 5, 15, 14),
      b: chart(1992, 8, 20, 9),
    };
    const preview = buildMatchPreview(charts, analyzeCompatibility(charts.a, charts.b), {
      a: '민수',
      b: '지영',
    });

    expect(preview.policyVersion).toBe('match-v0');
    expect(preview.status).toBe('beta');
    expect(preview.dimensions.map((dimension) => dimension.key)).toEqual([
      'complement',
      'combinedBalance',
      'connectionDensity',
      'dataCompleteness',
    ]);
    expect(preview.index).toBeGreaterThanOrEqual(0);
    expect(preview.index).toBeLessThanOrEqual(100);
    /**
     * **신호는 실제로 난 것만 선다** — 셋을 채우지 않는다.
     *
     * 모자라면 「억부·종격·격국처럼 검증 중인 판정은 제외했어요」로 자리를 메우고
     * 있었다. 그건 신호가 아니라 안내문이고, 같은 카드의 머리 딱지와 각주가 이미
     * 하는 말이라 한 카드가 같은 말을 세 번 했다. 이 두 사람은 서로의 빈 오행을
     * 채우지 않아 신호가 둘이고, **둘이면 둘이 맞다.**
     */
    expect(preview.highlights).toHaveLength(2);
    for (const highlight of preview.highlights) {
      expect(highlight).not.toContain('검증 중인 판정');
    }

    /** 각주가 답하는 물음은 「이 숫자가 무엇인가」다 — 제외 사실은 딱지가 든다 */
    expect(preview.caveat).toContain('궁합의 정답이 아니라');
    expect(preview.caveat).not.toContain('검증 중인 판정');
  });

  /**
   * **두 사람이 같은 숫자를 본다**(US 47).
   *
   * 공유 결과 화면은 보는 사람을 언제나 `a` 에 놓는다 — 관계 한 줄에서 어느 글자가
   * 누구 것인지를 「나」로 읽게 하려는 것이다. 그러면 같은 Match 를 두 사람이 서로
   * 뒤집힌 순서로 계산하게 되므로, **지표가 자리에 흔들리지 않아야** 두 사람이 같은
   * 값을 공유한다. 네 축이 다 자리 대칭이라는 것을 값으로 못박는다.
   */
  it('어느 쪽을 앞에 놓든 지표가 같다', () => {
    const one = chart(1990, 5, 15, 14);
    const other = chart(1992, 8, 20, null);

    const forward = buildMatchPreview(
      { a: one, b: other },
      analyzeCompatibility(one, other),
      { a: '민수', b: '지영' },
    );
    const backward = buildMatchPreview(
      { a: other, b: one },
      analyzeCompatibility(other, one),
      { a: '지영', b: '민수' },
    );

    expect(backward.index).toBe(forward.index);
    expect(backward.dimensions.map((dimension) => dimension.score)).toEqual(
      forward.dimensions.map((dimension) => dimension.score),
    );
  });
});
