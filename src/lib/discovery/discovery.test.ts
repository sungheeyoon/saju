import { describe, expect, it } from 'vitest';

import { DISCOVERY_POLICY_V0, rankCandidates, type CandidateFacts } from './index';

/**
 * 후보 열둘 — 점수가 겹치지 않게 벌려 둔다. 순서를 재는 시험이라 동점은 따로 본다.
 */
const pool = (count: number): CandidateFacts[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `c${String(index).padStart(2, '0')}`,
    complement: 100 - index * 5,
    combinedBalance: 100 - index * 5,
    suppliedForViewer: index % 3,
  }));

const rank = (candidates: CandidateFacts[], seed = 'seed', viewerMissingCount = 2) =>
  rankCandidates(candidates, { seed, viewerMissingCount });

describe('discovery-v0 는 축과 가중치를 값으로 든다', () => {
  /**
   * `match-v0` 의 두 축(0.35 · 0.30)을 남기고 합이 1이 되게 다시 나눈 값이다.
   * **거기서 왔을 뿐 지금부터는 따로 산다** — 이 시험은 그 출처를 적어 두는 자리이지
   * 두 정책을 묶어 두는 자리가 아니다. `match-v0` 가 가중치를 고치면 이 기대값은
   * 그대로 두고 `discovery-v1` 을 만들지 말지를 따로 정한다.
   */
  it('가중치는 match-v0 의 남은 두 축을 다시 나눈 비율이다', () => {
    expect(DISCOVERY_POLICY_V0.weights).toEqual({ complement: 0.54, combinedBalance: 0.46 });
    expect(DISCOVERY_POLICY_V0.weights.complement + DISCOVERY_POLICY_V0.weights.combinedBalance).toBe(1);

    // 뺀 둘이 값으로 적혀 있다 — 「안 쓴다」가 주석이 아니라 값이어야 한다.
    expect(DISCOVERY_POLICY_V0.excluded).toContain('dataCompleteness');
    expect(DISCOVERY_POLICY_V0.excluded).toContain('connectionDensity');
  });

  it('정렬만 한다 — 문턱이 없다', () => {
    expect(DISCOVERY_POLICY_V0.behavior).toBe('rank-only');
    expect(DISCOVERY_POLICY_V0.hardThreshold).toBe('none');
  });

  /** 사주 점수가 낮다는 이유로 사라지는 후보는 없다(US 33) */
  it('점수가 0이어도 목록에서 빠지지 않는다', () => {
    const page = rank([
      { id: 'zero', complement: 0, combinedBalance: 0, suppliedForViewer: 0 },
      { id: 'high', complement: 100, combinedBalance: 100, suppliedForViewer: 2 },
    ]);

    expect(page.entries.map((entry) => entry.id).sort()).toEqual(['high', 'zero']);
  });
});

describe('줄 세우기', () => {
  it('두 축의 가중합으로 내림차순이다', () => {
    const page = rank([
      { id: 'b', complement: 50, combinedBalance: 50, suppliedForViewer: 1 },
      { id: 'a', complement: 90, combinedBalance: 10, suppliedForViewer: 2 },
      { id: 'c', complement: 10, combinedBalance: 90, suppliedForViewer: 0 },
    ]);

    // a = 90*0.54 + 10*0.46 = 53.2 · b = 50 · c = 10*0.54 + 90*0.46 = 46.8
    expect(page.entries.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
    expect(page.entries[0].score).toBe(53.2);
    expect(page.entries[2].score).toBe(46.8);
  });

  /**
   * 동점이면 입력 순서가 아니라 id 로 가른다.
   *
   * 안 가르면 DB 가 돌려준 차례가 순위인 척 따라 나간다 — 배치에 딸린 값이 사실인
   * 얼굴을 하는 자리다.
   */
  it('동점은 id 로 가른다 — 입력 순서를 따르지 않는다', () => {
    const same = (id: string): CandidateFacts => ({
      id,
      complement: 60,
      combinedBalance: 60,
      suppliedForViewer: 1,
    });

    const forward = rank([same('b'), same('a'), same('c')]);
    const backward = rank([same('c'), same('b'), same('a')]);

    expect(forward.entries.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
    expect(backward.entries.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('자리는 0부터 빈틈없이 매겨진다', () => {
    const page = rank(pool(12));
    expect(page.entries.map((entry) => entry.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('탐색 후보', () => {
  it('같은 씨앗이면 같은 목록이 나온다', () => {
    const first = rank(pool(12), 'kim:2026-08-24');
    const second = rank(pool(12), 'kim:2026-08-24');

    expect(second).toEqual(first);
  });

  it('씨앗이 다르면 섞이는 사람이 달라진다', () => {
    const explorersOf = (seed: string) =>
      rank(pool(30), seed)
        .entries.filter((entry) => entry.exploration)
        .map((entry) => entry.id);

    // 서른 명 중 둘을 뽑으므로 씨앗이 다르면 갈릴 여지가 넉넉하다.
    expect(explorersOf('a')).not.toEqual(explorersOf('b'));
  });

  it('목록의 20% 가 탐색이고 상위 밖에서 온다', () => {
    const page = rank(pool(30));
    const explorers = page.entries.filter((entry) => entry.exploration);

    expect(explorers).toHaveLength(2);
    // 상위 여덟은 점수순 상위 여덟(c00~c07)이고, 탐색은 그 밖에서 온다.
    for (const explorer of explorers) {
      expect(Number(explorer.id.slice(1))).toBeGreaterThanOrEqual(8);
    }
  });

  it('탐색 자리는 앞뒤에 몰리지 않는다', () => {
    const positions = rank(pool(30))
      .entries.filter((entry) => entry.exploration)
      .map((entry) => entry.position);

    expect(positions).toEqual([2, 5]);
  });

  /**
   * 후보가 몇 없는 날 목록이 통째로 탐색이 되면, 「정렬했다」는 말이 화면에서 거짓이 된다.
   */
  it('후보가 적으면 탐색 자리를 만들지 않는다', () => {
    const page = rank(pool(2));

    expect(page.entries).toHaveLength(2);
    expect(page.entries.every((entry) => !entry.exploration)).toBe(true);
  });

  it('후보가 없으면 빈 목록이다', () => {
    expect(rank([]).entries).toEqual([]);
  });

  it('한 사람도 빠뜨리지 않고 한 사람도 두 번 세우지 않는다', () => {
    const ids = rank(pool(30)).entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('제한된 설명', () => {
  it('상대의 오행을 이름으로 적지 않는다 — 개수로만 말한다', () => {
    const page = rank([{ id: 'a', complement: 80, combinedBalance: 60, suppliedForViewer: 2 }], 's', 3);

    expect(page.entries[0].reason).toBe('당신에게 없는 오행 3개 중 2개를 채웁니다.');
    expect(page.entries[0].reason).not.toMatch(/[木火土金水]/);
  });

  it('채우는 것이 없으면 없다고 말한다 — 균형으로 섰다고 적는다', () => {
    const page = rank([{ id: 'a', complement: 20, combinedBalance: 90, suppliedForViewer: 0 }], 's', 2);

    expect(page.entries[0].reason).toContain('채우지는 않습니다');
    expect(page.entries[0].reason).toContain('균형');
  });

  it('빠진 오행이 없는 사람에게는 보완으로 견줄 것이 없다고 말한다', () => {
    const page = rank([{ id: 'a', complement: 70, combinedBalance: 70, suppliedForViewer: 0 }], 's', 0);

    expect(page.entries[0].reason).toContain('빠진 오행이 없어');
  });

  it('탐색 후보는 왜 거기 있는지를 말한다', () => {
    const explorer = rank(pool(30)).entries.find((entry) => entry.exploration);

    expect(explorer?.reason).toContain('탐색 후보');
  });

  /** 상위가 정답이 아니라는 말은 목록이 든다(US 31) */
  it('목록은 순서가 좋고 나쁨이 아니라는 말을 함께 든다', () => {
    const page = rank(pool(3));

    expect(page.caveat).toContain('궁합의 좋고 나쁨이 아닙니다');
    expect(page.policyVersion).toBe('discovery-v0');
    expect(page.status).toBe('beta');
  });
});
