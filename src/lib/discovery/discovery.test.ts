import { describe, expect, it } from 'vitest';

import type { Element } from '../saju';

import { DISCOVERY_POLICY_V0, ELEMENT_MEANING, rankCandidates, type CandidateFacts } from './index';

/**
 * 후보 열둘 — 점수가 겹치지 않게 벌려 둔다. 순서를 재는 시험이라 동점은 따로 본다.
 */
const SUPPLIED: Element[][] = [[], ['木'], ['木', '金']];

const pool = (count: number): CandidateFacts[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `c${String(index).padStart(2, '0')}`,
    complement: 100 - index * 5,
    combinedBalance: 100 - index * 5,
    suppliedForViewer: SUPPLIED[index % 3],
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
      { id: 'zero', complement: 0, combinedBalance: 0, suppliedForViewer: [] },
      { id: 'high', complement: 100, combinedBalance: 100, suppliedForViewer: ['木', '金'] },
    ]);

    expect(page.entries.map((entry) => entry.id).sort()).toEqual(['high', 'zero']);
  });
});

describe('줄 세우기', () => {
  it('두 축의 가중합으로 내림차순이다', () => {
    const page = rank([
      { id: 'b', complement: 50, combinedBalance: 50, suppliedForViewer: ['木'] },
      { id: 'a', complement: 90, combinedBalance: 10, suppliedForViewer: ['木', '金'] },
      { id: 'c', complement: 10, combinedBalance: 90, suppliedForViewer: [] },
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
      suppliedForViewer: ['木'],
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

describe('추천 이유 — 맛보기는 적극적으로 말한다', () => {
  it('어느 오행을 채우는지 이름과 뜻을 말한다', () => {
    const page = rank(
      [{ id: 'a', complement: 80, combinedBalance: 60, suppliedForViewer: ['木', '金'] }],
      's',
      3,
    );

    expect(page.entries[0].highlights).toEqual([
      {
        element: '木',
        meaning: ELEMENT_MEANING.木,
        text: '당신에게 부족한 목(木) 기운을 채워 성장과 확장을 돕는 조합입니다.',
      },
      {
        element: '金',
        meaning: ELEMENT_MEANING.金,
        text: '당신에게 부족한 금(金) 기운을 채워 안정감과 결단력을 돕는 조합입니다.',
      },
    ]);
  });

  it('채우는 오행이 없으면 이유가 비고 균형만 남는다', () => {
    const page = rank([{ id: 'a', complement: 20, combinedBalance: 90, suppliedForViewer: [] }], 's', 2);

    expect(page.entries[0].highlights).toEqual([]);
    expect(page.entries[0].balanceLabel).toContain('고르게 잡히는 편');
  });

  /**
   * 82점과 79점은 절대적인 궁합 차이로 읽히지만 「고른 편」과 「대체로 고른 편」은
   * 그렇지 않다. 그래서 밖으로 나가는 것은 말이고, 경계는 정책이 값으로 든다.
   */
  it('균형은 숫자가 아니라 말로 나간다', () => {
    const at = (combinedBalance: number) =>
      rank([{ id: 'a', complement: 50, combinedBalance, suppliedForViewer: [] }]).entries[0]
        .balanceLabel;

    expect(at(DISCOVERY_POLICY_V0.balanceBands.even)).toContain('고르게 잡히는 편');
    expect(at(DISCOVERY_POLICY_V0.balanceBands.mixed)).toContain('대체로 고른 편');
    expect(at(DISCOVERY_POLICY_V0.balanceBands.mixed - 1)).toContain('한쪽으로 기우는 편');
  });

  it('빠진 오행이 없는 사람에게는 목록이 그렇게 말한다', () => {
    expect(rank(pool(3), 's', 0).notice).toContain('빠진 오행이 없어');
    expect(rank(pool(3), 's', 2).notice).toBeNull();
  });

  it('탐색 후보가 실제로 섰을 때만 그 말이 붙는다', () => {
    expect(rank(pool(30)).explorationNote).toContain('탐색 후보');
    // 후보가 둘뿐이면 탐색 자리가 없다 — 없는 것을 설명하지 않는다.
    expect(rank(pool(2)).explorationNote).toBeNull();
  });

  /** 여기서 멈추는 이유와 다음 — 상세 궁합은 서로 동의한 뒤다(US 36) */
  it('상세 궁합은 서로 동의한 뒤라고 목록이 말한다', () => {
    const page = rank(pool(3));

    expect(page.teaser).toContain('서로 동의하면');
    expect(page.teaser).toContain('형충회합');
  });

  /** 상위가 정답이 아니라는 말은 목록이 든다(US 31) */
  it('목록은 순서가 좋고 나쁨이 아니라는 말을 함께 든다', () => {
    const page = rank(pool(3));

    expect(page.caveat).toContain('궁합의 좋고 나쁨이 아닙니다');
    expect(page.policyVersion).toBe('discovery-v0');
    expect(page.status).toBe('beta');
  });

  /**
   * 무엇을 열고 무엇을 닫는지 **값으로** 든다. 주석으로 적으면 화면마다 조금씩 넓어진다.
   */
  it('공개 범위를 값으로 선언한다', () => {
    expect(DISCOVERY_POLICY_V0.discloses).toContain('supplied-elements');
    expect(DISCOVERY_POLICY_V0.discloses).toContain('element-meaning');

    for (const closed of ['birth-input', 'pillars', 'relations', 'element-counts', 'score']) {
      expect(DISCOVERY_POLICY_V0.withholds).toContain(closed);
    }
  });
});
