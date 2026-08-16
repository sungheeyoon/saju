import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import {
  CORPUS_POLICY,
  FRAGMENTS,
  FRAGMENT_INDEX,
  FRAGMENT_TOPICS,
  FRAGMENT_TOPIC_IDS,
  HOUR_UNKNOWN_MARK,
  RELATION_WORDINGS,
  STRENGTH_WORDING,
  assembleText,
  ceilingFor,
  checkFragment,
  fragmentCoverage,
  keyOf,
  skeletonOf,
  type ClaimStrength,
  type Fragment,
} from '@/src/lib/saju/text';

/**
 * 말뭉치 — **조각이 실제로 문장을 받아 내는가.**
 *
 * `fragment.test.ts` 가 스키마의 규칙을 지어낸 조각으로 시험한다면 여기는 진짜
 * 내용물을 시험한다. 이 묶음의 목적이 칸을 채우는 것 자체가 아니라 **강도 사다리
 * 네 칸이 전부 문장을 받아 내는지 보는 것**이라, 그 확인이 첫 테스트다.
 */

const strengthsIn = (fragments: readonly Fragment[]) =>
  new Set(fragments.map((fragment) => fragment.strength));

/** 이 조각이 시간 미상에서 내려앉은 벌인가 */
const isHourUnknownRung = (fragment: Fragment): boolean => {
  const { paths, polarity } = FRAGMENT_TOPICS[fragment.topic];

  return (
    ceilingFor({ paths, polarity, hourKnown: false }) === fragment.strength &&
    ceilingFor({ paths, polarity, hourKnown: true }) !== fragment.strength
  );
};

describe('말뭉치', () => {
  it('모든 조각이 스키마와 계약을 통과한다', () => {
    for (const fragment of FRAGMENTS) {
      expect(checkFragment(fragment), keyOf(fragment)).toEqual([]);
    }
  });

  /**
   * 이 묶음을 세 주제로 고른 이유다. 사실·유도·후보·참고가 한 번씩 나오지
   * 않으면 사다리의 어느 칸은 아직 한 번도 문장이 되어 본 적이 없다는 뜻이고,
   * 특히 `reference` 는 출처 의무를 강도에서 떼어 낸 뒤로 아직 시험되지 않았다.
   */
  it('강도 사다리 네 칸이 전부 문장을 받아 낸다', () => {
    expect(strengthsIn(FRAGMENTS)).toEqual(
      new Set<ClaimStrength>(['fact', 'derived', 'candidate', 'reference']),
    );
  });

  describe('강도마다 표지가 하나다', () => {
    /**
     * `REQUIRED_HEDGES` 는 "이 중 하나"라는 하한이라 같은 강도의 문장이 '여지'·
     * '가능성'·'검토'로 갈릴 수 있다. 그러면 읽는 사람에게 사다리가 보이지 않고,
     * 보이지 않는 사다리는 유지할 이유도 없어진다.
     */
    it('조각은 제 강도의 표지만 품는다', () => {
      for (const fragment of FRAGMENTS) {
        const worn = Object.entries(STRENGTH_WORDING)
          .filter(([, mark]) => fragment.template.includes(mark))
          .map(([strength]) => strength);

        expect(worn, keyOf(fragment)).toEqual(fragment.strength === 'fact' ? [] : [fragment.strength]);
      }
    });

    /**
     * 사실 문장이 "…쪽으로 봅니다"로 끝나는 것은 근거보다 **약하게** 말하는
     * 것이다. 안전해 보이지만 강도 체계를 장식으로 만든다 — 위 테스트가 이미
     * 잡지만, 왜 잡는지를 남겨 둔다.
     */
    it('사실은 아래 칸의 말투를 쓰지 않는다', () => {
      const facts = FRAGMENTS.filter((fragment) => fragment.strength === 'fact');

      expect(facts.length).toBeGreaterThan(0);
      for (const fragment of facts) {
        for (const mark of Object.values(STRENGTH_WORDING)) {
          expect(fragment.template.includes(mark), `${keyOf(fragment)} 에 ${mark}`).toBe(false);
        }
      }
    });
  });

  /**
   * 주제마다 조각이 두 벌인 것은 시간 미상 때문이고, 약한 쪽은 시주 두 글자를
   * 빼고 센 값이다. 문장이 그것을 밝히지 않으면 독자에게는 그냥 말끝이 흐린
   * 문장으로 보인다 — 경고는 `meta.warnings` 로 따로 나가고 문장 옆에 없다.
   */
  it('한 칸 내려앉은 벌은 시주가 빠졌다는 것을 밝힌다', () => {
    const downgraded = FRAGMENTS.filter(isHourUnknownRung);

    expect(downgraded.length).toBeGreaterThan(0);
    for (const fragment of downgraded) {
      expect(fragment.template, keyOf(fragment)).toContain(HOUR_UNKNOWN_MARK);
    }
  });

  describe('변종은 갈릴 근거가 있을 때만 가른다', () => {
    /**
     * 변종이 문장을 하나도 가르지 못하면 변종 축은 장식이고, 그럴 바에는 슬롯
     * 하나로 충분하다. 억부 다섯 자리가 같은 문장을 다섯 벌 갖는 것을 막는다.
     */
    it('변종이 여럿인 주제는 문장도 여럿이다', () => {
      for (const topic of FRAGMENT_TOPIC_IDS) {
        if (FRAGMENT_TOPICS[topic].variants.length < 2) continue;

        const skeletons = FRAGMENTS.filter(
          (fragment) => fragment.topic === topic && fragment.strength === 'fact',
        ).map((fragment) => skeletonOf(fragment.template));

        if (skeletons.length < 2) continue;
        expect(new Set(skeletons).size, topic).toBeGreaterThan(1);
      }
    });

    /**
     * 거꾸로, 나눌 근거가 없는데 나누면 **없는 구별을 지어내는 것**이다.
     * 해·파·원진·귀문에 대해 이 엔진이 아는 것은 짝이 성립한다는 것뿐이라 넷이
     * 한 문장을 나눠 쓴다. 겹친 문장의 수가 선언한 벌 수와 같은지로 잠근다 —
     * 복붙으로 늘어난 겹침은 여기서 드러난다.
     */
    it('관계의 문장 수는 선언한 벌 수와 같다', () => {
      const skeletons = FRAGMENTS.filter(
        (fragment) => fragment.topic === 'relation.present' && fragment.strength === 'fact',
      ).map((fragment) => skeletonOf(fragment.template));

      expect(skeletons).toHaveLength(FRAGMENT_TOPICS['relation.present'].variants.length);
      expect(new Set(skeletons).size).toBe(RELATION_WORDINGS.length);
    });

    it('한 종류는 한 벌에만 적혀 있다', () => {
      const kinds = RELATION_WORDINGS.flatMap((wording) => wording.kinds);

      expect(new Set(kinds).size).toBe(kinds.length);
      expect(new Set(kinds)).toEqual(new Set(FRAGMENT_TOPICS['relation.present'].variants));
    });
  });

  /**
   * 지시서를 다 채운 것이 **할 말을 다 했다는 뜻은 아니다.** 조후·종격·신살·
   * 대운은 여전히 침묵하고, 그것은 조각이 없어서가 아니라 주제가 없어서다.
   * 두 공백은 다른 자리에 적힌다 — 섞으면 "안 중요해서 뺐다"가 조용히 들어온다.
   */
  it('지시서에 빈칸이 없다', () => {
    const coverage = fragmentCoverage(FRAGMENT_INDEX);

    expect(coverage.missing).toEqual([]);
    expect(coverage.filled).toBe(coverage.expected);
    expect(coverage.filled).toBe(FRAGMENTS.length);
  });

  /**
   * 계약 → 조각 → 조립기를 한 줄로 지나가는 자리. `reference` 는 조후가 아니라
   * **시간 미상의 억부**에서 나오고, 출처를 요구받지 않는다 — 강도가 아니라 읽은
   * 근거에 출처 의무를 건 판단이 여기서 값을 낸다.
   */
  it('시간 미상 명식에서 참고 강도가 실제로 발화한다', () => {
    const hourless = computeSaju({ year: 1990, month: 5, day: 20, hour: null, gender: 'male' }, {});

    const eokbu = assembleText(hourless).find(({ request }) => request.topic === 'eokbu.candidate');

    expect(eokbu?.strength).toBe('reference');
    expect(eokbu?.text).toContain(STRENGTH_WORDING.reference);
    expect(eokbu?.text).toContain(HOUR_UNKNOWN_MARK);
    expect(eokbu?.violations).toEqual([]);
  });

  it('정책은 납작한 문자열이라 스냅샷이 그대로 찍는다', () => {
    for (const [key, value] of Object.entries(CORPUS_POLICY)) {
      expect(typeof value, key).toBe('string');
    }
  });
});
