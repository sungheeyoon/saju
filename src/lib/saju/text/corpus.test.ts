import { describe, expect, it } from 'vitest';

import { computeSaju, type Saju } from '@/src/lib/saju';
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
  checkSentence,
  fragmentCoverage,
  keyOf,
  producibleStrengths,
  skeletonOf,
  type ClaimStrength,
  type Fragment,
} from '@/src/lib/saju/text';

/** 조후표가 상·하반월을 가르지 않는 흔한 칸(乙巳) — 조후 문장의 기본 자리다 */
const CHART = computeSaju(
  { year: 1990, month: 5, day: 20, hour: 14, minute: 30, second: 0, gender: 'male' },
  {},
);

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

        // 한 벌 안에서 비교해야 강도 차이가 아니라 변종 차이가 보인다. `fact` 로
        // 못박아 두면 사실을 내지 않는 주제(조후)가 조용히 빠져나간다 — 주제가
        // 낼 수 있는 가장 센 벌을 물어서 그 구멍을 막는다.
        const [strongest] = producibleStrengths(topic);

        const skeletons = FRAGMENTS.filter(
          (fragment) => fragment.topic === topic && fragment.strength === strongest,
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

  /**
   * 조후를 첫 주제로 고른 이유가 값을 내는 자리. 출처 의무는 계약을 세울 때부터
   * 있었지만 `analysis.johu` 를 읽는 주제가 없어 **프로덕션에서 한 번도 돌지
   * 않은 분기**였다. 조각이 아니라 실제 명식에서 확인한다 — 조각 검사는 슬롯을
   * 비운 뼈대를 보므로 조립까지 갔을 때도 출처가 남는지는 여기서만 보인다.
   */
  describe('옮겨 적은 표는 문장 안에서 출처를 부른다', () => {
    const johuOf = (saju: Saju) =>
      assembleText(saju).find(({ request }) => request.topic === 'johu.table');

    it('조후 문장이 궁통보감을 부르고 통과한다', () => {
      const johu = johuOf(CHART);

      expect(johu?.strength).toBe('reference');
      expect(johu?.text).toContain('궁통보감');
      expect(johu?.violations).toEqual([]);
    });

    it('출처를 지우면 걸린다', () => {
      const { paths } = FRAGMENT_TOPICS['johu.table'];
      const text = johuOf(CHART)?.text?.replace('궁통보감', '옛 표') ?? '';

      expect(text).not.toBe('');
      expect(checkSentence({ text, paths, strength: 'reference' }).map((v) => v.rule)).toEqual([
        'missing-attribution',
      ]);
    });

    /**
     * 시주 두 글자는 일간도 월지도 바꾸지 않는다(`JOHU_POLICY.basis`). 그래서
     * 조후는 시간 미상에 한 칸 내려가지 않는 유일한 주제이고, 억부가 같은 명식에서
     * `reference` 로 **내려앉아** 있는 것과 나란히 놓여야 그 차이가 보인다.
     */
    it('시간 미상에도 강도가 그대로다', () => {
      const hourless = computeSaju({ year: 1990, month: 5, day: 20, hour: null, gender: 'male' }, {});

      expect(producibleStrengths('johu.table')).toEqual(['reference']);
      expect(johuOf(hourless)?.strength).toBe('reference');
      expect(johuOf(hourless)?.text).not.toContain(HOUR_UNKNOWN_MARK);
    });
  });

  /**
   * 120칸 중 여섯만 상·하반월을 갈라 말한다. 갈리는 칸을 `whole-month` 문장으로
   * 덮으면 원문이 갈랐다는 사실 자체가 사라지므로 — 덜 말하는 것이 아니라 원문을
   * 요약해 버리는 것이라 — 변종이 갈린다.
   */
  describe('상·하반월', () => {
    const variantOf = (saju: Saju) =>
      assembleText(saju).find(({ request }) => request.topic === 'johu.table')?.request.variant;

    it('갈리지 않는 칸은 표의 천간을 그대로 든다', () => {
      expect(variantOf(CHART)).toBe('whole-month');
    });

    it('갈리는 칸에서 절반을 판정하면 한쪽만 든다', () => {
      const half = computeSaju(
        { year: 1985, month: 1, day: 13, hour: 14, minute: 30, second: 0, gender: 'male' },
        {},
      );

      expect(half.analysis.johu.halfMonth, '상·하반월이 갈리는 칸이어야 한다').toBeDefined();
      expect(variantOf(half)).toBe('half-month');
    });

    /**
     * 이 커밋에서 새로 내린 판단. 시간을 모르면 `resolvedTime` 이 정오로 채워지고
     * 절반은 그 정오가 정한다 — 중기가 그날 안에 있으면 진짜 시각이 뒤집는다.
     * 지어낸 문턱이 아니라 채워 넣은 값에서 그대로 유도되는 폭이다.
     */
    it('채워 넣은 정오가 절반을 정했을 수 있으면 고르지 않는다', () => {
      const unjudged = computeSaju({ year: 1985, month: 7, day: 23, hour: null, gender: 'male' }, {});
      const { johu } = unjudged.analysis;

      // 절반 자체는 L2 가 이미 냈다. 그것을 말하지 않기로 하는 것이 L3 의 몫이다.
      expect(johu.half).not.toBeNull();
      expect(variantOf(unjudged)).toBe('half-unjudged');

      // 같은 날 같은 칸인데 시각만 알면 절반을 말한다. 갈리는 것은 명식이
      // 아니라 **그 절반이 채워 넣은 값에서 나왔는가**뿐이다.
      const known = computeSaju(
        { year: 1985, month: 7, day: 23, hour: 14, minute: 30, second: 0, gender: 'male' },
        {},
      );

      expect(known.analysis.johu.monthBranch).toBe(johu.monthBranch);
      expect(variantOf(known)).toBe('half-month');
    });
  });

  it('정책은 납작한 문자열이라 스냅샷이 그대로 찍는다', () => {
    for (const [key, value] of Object.entries(CORPUS_POLICY)) {
      expect(typeof value, key).toBe('string');
    }
  });
});
