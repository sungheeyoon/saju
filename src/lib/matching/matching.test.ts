import {
  DISCOVERY_POLICY,
  SCORE_POLICIES,
  legacyPreviewScoreOf,
  previewScoreOf,
  scoreSideOf,
} from '@/src/lib/discovery';

import { describe, expect, it } from 'vitest';

import { analyzeCompatibility, computeSaju } from '../saju';
import { buildMatchPreview, matchBasisOf, type MatchBasis } from '.';

const ROMANTIC: MatchBasis = { version: 'v2-beta', policy: 'romantic' };
const GENERAL: MatchBasis = { version: 'v2-beta', policy: 'general' };
const LEGACY: MatchBasis = { version: 'discovery-v1' };

const chart = (year: number, month: number, day: number, hour: number | null) =>
  computeSaju(
    hour === null
      ? { year, month, day, hour: null, gender: 'female' }
      : { year, month, day, hour, minute: 0, second: 0, gender: 'female' },
    { longitude: 126.98, useLongitude: true },
  );

describe('궁합 베타 지표', () => {
  it('정책마다 공개한 가중치의 합이 1이다', () => {
    for (const policy of SCORE_POLICIES) {
      expect(
        Object.values(DISCOVERY_POLICY.weights[policy]).reduce((sum, weight) => sum + weight, 0),
      ).toBeCloseTo(1);
    }
  });

  it('사주 사실을 두 영역의 버전된 베타 지표로 바꾼다', () => {
    const charts = {
      a: chart(1990, 5, 15, 14),
      b: chart(1992, 8, 20, 9),
    };
    const preview = buildMatchPreview(
      charts,
      analyzeCompatibility(charts.a, charts.b),
      { a: '민수', b: '지영' },
      ROMANTIC,
    );

    expect(preview.policyVersion).toBe('v2-beta');
    expect(preview.policy).toBe('romantic');
    expect(preview.status).toBe('beta');

    /** 연인용은 축 셋이고 저마다 제 무게를 든다 — 화면이 `점수 반영 40%` 로 옮긴다 */
    expect(preview.dimensions.map((d) => [d.key, d.label, d.weight])).toEqual([
      ['dayPillar', '생활의 맞물림', 0.4],
      ['needComplement', '서로 채우는 기운', 0.4],
      ['combinedBalance', '함께 놓은 균형', 0.2],
    ]);
    expect(preview.index).toBeGreaterThanOrEqual(0);
    expect(preview.index).toBeLessThanOrEqual(100);

    /**
     * **이 수가 곧 풀이 점수의 기준점이다**(ADR 0060). 한 화면에 서로 다른 축의
     * 점수가 둘 서 있으면 무엇을 믿을지 사용자가 정해야 한다(PRD §1.4) — 카드에서
     * 74를 보고 풀이권을 쓴 사람이 65를 받는 어긋남이 그것이다.
     */
    expect(preview.index).toBe(
      previewScoreOf(scoreSideOf(charts.a), scoreSideOf(charts.b), { policy: 'romantic' }),
    );
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

    /**
     * **내부 판본 이름은 사용자에게 닿는 어디에도 없다**(CONTEXT.md · ADR 0026).
     * `policyVersion` 은 값으로 실려 화면이 안 쓰는 자리에서만 읽힌다.
     */
    const shown = [...preview.highlights, preview.caveat, ...preview.dimensions.map((d) => `${d.label} ${d.description}`)].join(' ');
    expect(shown).not.toContain('match-v0');
    expect(shown).not.toContain('discovery-v1');
    expect(shown).not.toContain('v2');
  });

  it('일반 정책은 축 둘 — 서로 채우는 기운 60 · 함께 놓은 균형 40 — 이다', () => {
    const charts = { a: chart(1990, 5, 15, 14), b: chart(1992, 8, 20, 9) };
    const preview = buildMatchPreview(
      charts,
      analyzeCompatibility(charts.a, charts.b),
      { a: '민수', b: '지영' },
      GENERAL,
    );

    expect(preview.policy).toBe('general');
    expect(preview.dimensions.map((d) => [d.key, d.weight])).toEqual([
      ['needComplement', 0.6],
      ['combinedBalance', 0.4],
    ]);
    expect(preview.index).toBe(
      previewScoreOf(scoreSideOf(charts.a), scoreSideOf(charts.b), { policy: 'general' }),
    );
  });

  /**
   * **옛 풀이 옆에는 옛 판을 세운다**(ADR 0113 「이미 저장된 궁합풀이의 점수는 그대로다」). 새 판의 수를 옛
   * 풀이 옆에 세우면 한 화면에 눈금이 둘이다.
   */
  it('옛 판은 오행 보완 30 · 함께 놓은 균형 70 을 옛 셈으로 그린다', () => {
    const charts = { a: chart(1990, 5, 15, 14), b: chart(1992, 8, 20, 9) };
    const preview = buildMatchPreview(
      charts,
      analyzeCompatibility(charts.a, charts.b),
      { a: '민수', b: '지영' },
      LEGACY,
    );

    expect(preview.policyVersion).toBe('discovery-v1');
    expect(preview.policy).toBeNull();
    expect(preview.dimensions.map((d) => [d.key, d.label, d.weight])).toEqual([
      ['complement', '오행 보완', 0.3],
      ['combinedBalance', '함께 놓은 균형', 0.7],
    ]);
    expect(preview.index).toBe(
      legacyPreviewScoreOf(charts.a.analysis.elements, charts.b.analysis.elements),
    );
  });

  /** 풀이가 들고 있는 기준점이 곧 지표다 — 지금 다시 재지 않는다 */
  it('저장된 기준점이 오면 그 수를 세운다', () => {
    const charts = { a: chart(1990, 5, 15, 14), b: chart(1992, 8, 20, 9) };
    const compat = analyzeCompatibility(charts.a, charts.b);
    const names = { a: '민수', b: '지영' };

    expect(buildMatchPreview(charts, compat, names, { ...ROMANTIC, index: 71 }).index).toBe(71);
    expect(buildMatchPreview(charts, compat, names, { ...LEGACY, index: 64 }).index).toBe(64);
  });

  /**
   * **두 사람이 같은 숫자를 본다**(US 47).
   *
   * 공유 결과 화면은 보는 사람을 언제나 `a` 에 놓는다 — 관계 한 줄에서 어느 글자가
   * 누구 것인지를 「나」로 읽게 하려는 것이다. 그러면 같은 Match 를 두 사람이 서로
   * 뒤집힌 순서로 계산하게 되므로, **지표가 자리에 흔들리지 않아야** 두 사람이 같은
   * 값을 공유한다. 두 축이 다 자리 대칭이라는 것을 값으로 못박는다.
   */
  it('어느 쪽을 앞에 놓든 지표가 같다', () => {
    const one = chart(1990, 5, 15, 14);
    const other = chart(1992, 8, 20, null);

    const forward = buildMatchPreview(
      { a: one, b: other },
      analyzeCompatibility(one, other),
      { a: '민수', b: '지영' },
      ROMANTIC,
    );
    const backward = buildMatchPreview(
      { a: other, b: one },
      analyzeCompatibility(other, one),
      { a: '지영', b: '민수' },
      ROMANTIC,
    );

    expect(backward.index).toBe(forward.index);
    expect(backward.dimensions.map((dimension) => dimension.score)).toEqual(
      forward.dimensions.map((dimension) => dimension.score),
    );
  });
});

/**
 * **옛 풀이 옆에 새 판을 재지 않는다** — 풀이가 있으면 그 풀이의 판, 없을 때만 지금 잰다(ADR 0113).
 */
describe('지표의 판은 풀이가 정한다', () => {
  it('풀이가 없으면 지금의 판을 사이로 고른다', () => {
    expect(matchBasisOf(null, { matched: false, relation: 'partner' })).toEqual(ROMANTIC);
    expect(matchBasisOf(null, { matched: false, relation: null })).toEqual(GENERAL);
    expect(matchBasisOf(null, { matched: true, relation: null })).toEqual(ROMANTIC);
  });

  it('새 판 풀이는 그때의 사이와 기준점으로 그린다 — 지금 고친 사이를 따르지 않는다', () => {
    expect(
      matchBasisOf(
        { version: 'v2-beta', baseline: 58, relation: 'family' },
        { matched: false, relation: 'partner' },
      ),
    ).toEqual({ ...GENERAL, index: 58 });
    expect(
      matchBasisOf({ version: 'v2-beta', baseline: 70, relation: null }, { matched: true, relation: null }),
    ).toEqual({ ...ROMANTIC, index: 70 });
  });

  it('판이 안 적힌 풀이는 옛 판이다', () => {
    for (const version of [null, 'discovery-v1', 'unknown']) {
      expect(
        matchBasisOf({ version, baseline: null, relation: null }, { matched: false, relation: 'partner' }),
        String(version),
      ).toEqual(LEGACY);
    }
  });
});
