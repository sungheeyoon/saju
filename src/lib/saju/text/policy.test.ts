import { describe, expect, it } from 'vitest';

import { computeSaju, type Saju } from '@/src/lib/saju';
import {
  FOLLOWING_PATTERN_POLICY,
  FOLLOWING_PATTERN_STATUS_KO,
  TEN_GOD_KO,
  type FollowingPatternStatus,
} from '@/src/lib/saju/analysis';
import {
  ATTRIBUTION_PATHS,
  CLAIM_CEILING,
  CLAIM_PATHS,
  CLAIM_STRENGTH_ORDER,
  DISCLOSABLE,
  FORBIDDEN_CLAIMS,
  KNOWN_UNCONTRACTED_TEXT,
  MYEONGRI_LEXICON,
  TEXT_POLICY,
  ceilingFor,
  ceilingForFollowing,
  checkSentence,
  weakerClaim,
  type ClaimPath,
  type TextViolationRule,
} from '@/src/lib/saju/text';

const CHART = computeSaju(
  { year: 1990, month: 5, day: 20, hour: 14, minute: 30, second: 0, gender: 'male' },
  {},
);

const HOURLESS = computeSaju({ year: 1990, month: 5, day: 20, hour: null, gender: 'male' }, {});

/** 이 명식에서 실제로 나온 관계 이름 */
const relationNames = (saju: Saju) => saju.relations.map((relation) => relation.ko);

/**
 * 근거를 안 적은 테스트는 사실 근거 하나로 둔다 — 금지 표현·완충 표현을 보는
 * 자리는 무엇을 읽었는지가 답을 바꾸지 않는다. 바뀌는 것은 출처 의무뿐이라
 * 그 테스트만 `paths` 를 직접 적는다.
 */
const rules = (
  text: string,
  strength: Parameters<typeof checkSentence>[0]['strength'],
  grounded?: string[],
  paths: readonly ClaimPath[] = ['pillars'],
) => checkSentence({ text, paths, strength, grounded }).map((violation) => violation.rule);

describe('문장 계약', () => {
  describe('강도는 근거에서 나온다', () => {
    /**
     * L2 에 새 결과가 생기면 여기서 걸린다. 상한을 정하지 않은 결과는 L3 가
     * 읽을 수 없다 — 강도를 안 정한 채로 문장부터 나오는 것을 막는 유일한 자리다.
     */
    it('L2 가 내는 모든 결과에 상한이 있다', () => {
      const paths = new Set<string>(CLAIM_PATHS);

      for (const key of Object.keys(CHART)) {
        if (key === 'analysis') continue;
        expect(paths.has(key), `Saju.${key} 에 상한이 없다`).toBe(true);
      }

      for (const key of Object.keys(CHART.analysis)) {
        expect(paths.has(`analysis.${key}`), `Analysis.${key} 에 상한이 없다`).toBe(true);
      }

      // 반대 방향도 본다 — 없어진 필드를 가리키는 상한이 남아 있으면 안 된다.
      for (const path of CLAIM_PATHS) {
        const [head, tail] = path.split('.');
        const target = tail ? (CHART.analysis as Record<string, unknown>) : (CHART as Record<string, unknown>);
        expect(Object.hasOwn(target, tail ?? head), `${path} 이 가리키는 결과가 없다`).toBe(true);
      }
    });

    it('여럿을 읽으면 가장 낮은 강도를 따른다', () => {
      // 뿌리는 사실이지만 억부와 함께 말하면 억부보다 세게 말할 수 없다.
      expect(ceilingFor({ paths: ['analysis.rootedness'] })).toBe('fact');
      expect(ceilingFor({ paths: ['analysis.rootedness', 'analysis.eokbu'] })).toBe('candidate');
      expect(ceilingFor({ paths: ['analysis.strength', 'analysis.johu'] })).toBe('reference');
      expect(ceilingFor({ paths: [] })).toBe('silent');
    });

    it('사다리는 낮은 쪽이 먼저다', () => {
      expect(weakerClaim('fact', 'candidate')).toBe('candidate');
      expect(weakerClaim('reference', 'candidate')).toBe('reference');
      expect(CLAIM_STRENGTH_ORDER.indexOf('silent')).toBe(0);
    });
  });

  describe('종격 문장은 외부 대조 게이트에 묶여 있다', () => {
    /**
     * 게이트를 열면서 문장 쪽을 고치는 것을 잊는 일이 없어야 한다. 반대로
     * 게이트를 닫아 둔 채 문장만 세게 하는 것도 여기서 막힌다.
     */
    it('게이트가 닫혀 있는 동안은 후보를 넘지 못한다', () => {
      expect(FOLLOWING_PATTERN_POLICY.dominance.externalCheck.passed).toBe(false);
      expect(FOLLOWING_PATTERN_POLICY.eokbuOverride).toBe('disabled');
      expect(CLAIM_CEILING['analysis.following']).toBe('candidate');

      // 억부보다 세게 말할 수 없다 — 억부를 뒤집지 못한다는 정책과 같은 말이다.
      expect(weakerClaim(CLAIM_CEILING['analysis.following'], CLAIM_CEILING['analysis.eokbu'])).toBe(
        CLAIM_CEILING['analysis.following'],
      );
    });

    it('종격 아님은 문장을 만들지 않는다', () => {
      expect(ceilingForFollowing('not-following')).toBe('silent');

      const speakable: FollowingPatternStatus[] = ['candidate', 'pseudo-following', 'true-following'];
      for (const verdict of speakable) {
        expect(ceilingForFollowing(verdict), FOLLOWING_PATTERN_STATUS_KO[verdict]).toBe('candidate');
      }
    });

    it('말하지 않기로 한 근거로 문장을 만들면 걸린다', () => {
      expect(rules('종격은 아닙니다.', ceilingForFollowing('not-following'))).toContain('must-be-silent');
    });
  });

  describe('근거보다 세게 말하면 걸린다', () => {
    it('후보를 확정형으로 말하면 걸린다', () => {
      const strength = ceilingFor({ paths: ['analysis.eokbu'] });

      expect(rules('억부 관점에서 목이 필요합니다.', strength)).toContain('missing-hedge');
      expect(rules('억부 관점에서 목을 후보로 봅니다.', strength)).not.toContain('missing-hedge');
    });

    it('유도값을 사실처럼 말하면 걸린다', () => {
      const strength = ceilingFor({ paths: ['analysis.strength'] });

      expect(strength).toBe('derived');
      expect(rules('신약합니다.', strength)).toContain('missing-hedge');
      expect(rules('신약 쪽으로 봅니다.', strength)).not.toContain('missing-hedge');
    });

    it('옮겨 적은 표는 출처를 밝혀야 한다', () => {
      const johu: readonly ClaimPath[] = ['analysis.johu'];
      const strength = ceilingFor({ paths: johu });

      expect(strength).toBe('reference');
      expect(rules('조후로는 병화를 참고합니다.', strength, [], johu)).toContain('missing-attribution');
      expect(rules('《궁통보감》 표는 병화를 참고로 듭니다.', strength, [], johu)).toHaveLength(0);
    });

    /**
     * 출처 의무를 강도로 걸었다가 걸린 자리다. **시간 미상이면 억부가 한 칸
     * 내려와 조후와 같은 칸에 앉는다** — 그때 출처를 요구하면 억부 문장은 인용할
     * 표가 없어서 통째로 막히고, "시간을 모르면 억부를 말하지 않는다"는 결정을
     * 내린 적이 없는데 그렇게 굳는다. 사다리는 주장의 세기고 출처 의무는 읽은
     * 근거라 두 축이다.
     */
    it('같은 칸에 앉아도 옮겨 적은 표가 아니면 출처를 요구하지 않는다', () => {
      const eokbu: readonly ClaimPath[] = ['analysis.eokbu'];
      const strength = ceilingFor({ paths: eokbu, hourKnown: false });

      expect(strength).toBe(ceilingFor({ paths: ['analysis.johu'] }));
      expect(rules('억부 관점의 후보로 참고만 합니다.', strength, [], eokbu)).toHaveLength(0);

      // 같은 문장·같은 강도라도 조후를 읽었다면 출처를 대야 한다.
      expect(
        rules('억부 관점의 후보로 참고만 합니다.', strength, [], ['analysis.johu']),
      ).toContain('missing-attribution');
    });

    it('종격도 시간 미상에서 출처를 요구받지 않는다', () => {
      const following: readonly ClaimPath[] = ['analysis.following'];

      expect(
        rules('종격은 후보로 참고만 합니다.', ceilingFor({ paths: following, hourKnown: false }), [], following),
      ).toHaveLength(0);
    });

    it('출처를 요구하는 근거는 상한 표에 있는 것뿐이다', () => {
      // 근거 이름이 바뀌면 여기서 걸린다 — 조용히 아무도 요구받지 않게 되는 것을 막는다.
      for (const path of ATTRIBUTION_PATHS) {
        expect(CLAIM_PATHS as readonly string[], path).toContain(path);
      }
    });

    it('사실 문장은 완충 표현을 요구하지 않는다', () => {
      expect(rules('일간은 지지에 뿌리를 두고 있습니다.', ceilingFor({ paths: ['analysis.rootedness'] }))).toHaveLength(0);
    });
  });

  describe('없는 근거를 말하면 걸린다', () => {
    /**
     * 이 검사가 있어야 생성기를 믿을 수 있다. 문자열 하나를 금지하는 것과 달리
     * **근거 목록과 대조**하므로, 어떤 관계 이름이 새로 생겨도 규칙을 안 고친다.
     */
    it('이 명식에 없는 관계를 말하면 걸린다', () => {
      const grounded = relationNames(CHART);
      const absent = [...MYEONGRI_LEXICON].find(
        (term) => term.endsWith('형') && !grounded.includes(term),
      );

      expect(absent, '이 명식에 없는 형이 하나는 있어야 한다').toBeDefined();
      expect(rules(`${absent}으로 인해 흔들립니다.`, 'fact', grounded)).toContain('ungrounded-term');
    });

    it('실제로 나온 관계는 통과한다', () => {
      const grounded = relationNames(CHART);

      expect(grounded.length, '관계가 하나는 있는 명식이어야 한다').toBeGreaterThan(0);
      expect(rules(`${grounded[0]}이 있습니다.`, 'fact', grounded)).toHaveLength(0);
    });

    it('두 글자만 모인 형의 이름도 그물에 있다', () => {
      // 표에 없는 이름이라 따로 만들어 넣는다. 빠지면 그냥 통과한다.
      expect(MYEONGRI_LEXICON.has('인신형')).toBe(true);
      expect(MYEONGRI_LEXICON.has('신인형')).toBe(true);
    });

    it('십성도 근거 없이 쓸 수 없다', () => {
      expect(rules('편관이 무겁습니다.', 'fact', [])).toContain('ungrounded-term');
      expect(rules('편관이 무겁습니다.', 'fact', [TEN_GOD_KO.偏官])).toHaveLength(0);
    });
  });

  describe('판정하지 않기로 한 것', () => {
    it('금지 표현은 어느 강도로도 못 쓴다', () => {
      expect(rules('기신은 화입니다.', 'fact', [])).toContain('forbidden-claim');
      expect(rules('재다신약 사주로 봅니다.', 'derived', [])).toContain('forbidden-claim');
      expect(rules('정임합화 목이 되어 강해집니다.', 'fact', [])).toContain('forbidden-claim');
      expect(rules('충으로 뿌리가 상합니다.', 'fact', [])).toContain('forbidden-claim');
      expect(rules('반드시 그렇습니다.', 'fact', [])).toContain('forbidden-claim');
    });

    /**
     * 이 통로가 없으면 "기신은 내지 않습니다" 같은 고지가 함께 막힌다. 다른
     * 만세력에 있는 항목이 통째로 없으면 빠뜨린 것처럼 보인다 —
     * 귀문·원진을 신살 표에 다시 적은 것과 같은 이유다.
     */
    it('"판정하지 않는다"는 고지는 통과한다', () => {
      expect(rules(`${DISCLOSABLE.unfavorableElement}은 내지 않습니다.`, 'fact', [])).toHaveLength(0);
      expect(rules('격국은 판정하지 않습니다.', 'fact', [])).toHaveLength(0);
      expect(rules('합화 여부는 보지 않습니다.', 'fact', [])).toHaveLength(0);
      expect(rules(`${DISCLOSABLE.compatScore}는 내지 않습니다.`, 'fact', [])).toHaveLength(0);
    });

    it('고지 문형을 흉내만 내면 통과하지 못한다', () => {
      // 항목과 "판정하지 않는다" 사이에 다른 절이 끼면 고지가 아니다.
      expect(
        rules('기신은 화이고, 이런 것은 보통 판정하지 않습니다.', 'fact', []),
      ).toContain('forbidden-claim');
    });

    /**
     * 육합 午未合火 의 이름이 '오미합화'다. 한글로는 合火 와 合化 가 같은 글자라
     * 화(化) 판정을 막는 규칙이 멀쩡한 관계 이름을 통째로 잡았다. 근거가 이긴다.
     */
    it('데이터에서 온 이름은 금지 표현이 아니다', () => {
      expect(rules('오미합화가 있습니다.', 'fact', [])).toContain('forbidden-claim');
      expect(rules('오미합화가 있습니다.', 'fact', ['오미합화'])).toHaveLength(0);

      // 이름 밖에서 화(化)를 말하면 근거가 있어도 걸린다.
      expect(rules('오미합화가 있어 합화합니다.', 'fact', ['오미합화'])).toContain('forbidden-claim');
    });

    it('이 명식의 관계 이름이 금지 표현에 걸리지 않는다', () => {
      const grounded = relationNames(CHART);

      for (const name of grounded) {
        expect(rules(`${name}이 있습니다.`, 'fact', grounded), name).toHaveLength(0);
      }
    });

    it('금지 표현마다 어느 정책에서 왔는지 적혀 있다', () => {
      for (const claim of FORBIDDEN_CLAIMS) {
        expect(claim.terms.length, claim.id).toBeGreaterThan(0);
        expect(claim.why.length, claim.id).toBeGreaterThan(10);
        expect(claim.source.length, claim.id).toBeGreaterThan(0);
      }
    });
  });

  describe('시간 미상', () => {
    it('없다는 주장은 시주가 뒤집을 수 있어 막는다', () => {
      expect(HOURLESS.meta.hourKnown).toBe(false);

      const absence = { paths: ['analysis.rootedness'] as ClaimPath[], polarity: 'absence' as const };
      expect(ceilingFor({ ...absence, hourKnown: true })).toBe('fact');
      expect(ceilingFor({ ...absence, hourKnown: false })).toBe('silent');
    });

    it('있는 것을 말할 때는 한 칸만 내린다', () => {
      // 여섯 글자에서 찾은 뿌리는 시주가 있어도 그대로 뿌리다.
      expect(ceilingFor({ paths: ['analysis.rootedness'], hourKnown: false })).toBe('derived');
      expect(ceilingFor({ paths: ['analysis.eokbu'], hourKnown: false })).toBe('reference');
    });

    it('시주와 무관한 근거는 내리지 않는다', () => {
      expect(ceilingFor({ paths: ['analysis.johu'], hourKnown: false })).toBe('reference');
      expect(ceilingFor({ paths: ['daeun'], hourKnown: false })).toBe('fact');
    });
  });

  describe('이미 나가고 있는 문장', () => {
    /**
     * 지우지 않고 표시한다 — 실재하지 않는 외부 명조를 `unrealizable` 로 적되
     * 지우지 않은 것과 같은 취급이다. 고치는 것은 골든 스냅샷과 화면 문구가
     * 함께 움직이는 일이라 계약을 세우는 이 커밋에서 하지 않는다.
     */
    it('L2 의 억부 설명이 계약을 어기는 것을 값으로 남긴다', () => {
      const known = KNOWN_UNCONTRACTED_TEXT.find(({ id }) => id === 'legacy-eokbu-reason');
      expect(known).toBeDefined();

      const strength = ceilingFor({ paths: known!.paths });
      const violated: TextViolationRule[] = rules(CHART.analysis.eokbu.reason, strength, [], known!.paths);

      expect(violated).toContain(known!.violates);
    });
  });

  it('정책은 납작한 문자열이라 스냅샷이 그대로 찍는다', () => {
    for (const [key, value] of Object.entries(TEXT_POLICY)) {
      expect(typeof value, key).toBe('string');
    }
  });
});
