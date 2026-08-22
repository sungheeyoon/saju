import { describe, expect, it } from 'vitest';

import { computeSaju, currentFortuneOf, type Saju } from '@/src/lib/saju';
import { analyzeCompatibility } from '@/src/lib/saju/compat';
import {
  FAVOR_ROLE_KO,
  FOLLOWING_PATTERN_POLICY,
  STRUCTURE_FACTOR_NAMES,
  FOLLOWING_PATTERN_STATUS_KO,
  TEN_GOD_KO,
  type FollowingPatternStatus,
} from '@/src/lib/saju/analysis';
import {
  ATTRIBUTION_PATHS,
  CLAIM_CEILING,
  CLAIM_PATHS,
  COMPAT_CLAIM_PATHS,
  FRAGMENT_TOPICS,
  findCompatUtterances,
  CLAIM_STRENGTH_ORDER,
  DISCLOSABLE,
  FORBIDDEN_CLAIMS,
  KNOWN_UNCONTRACTED_TEXT,
  MYEONGRI_LEXICON,
  OFF_CHART_PATHS,
  TEXT_POLICY,
  ceilingFor,
  FOLLOWING_SILENT_VERDICTS,
  checkSentence,
  groundedTermsOf,
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
        if (OFF_CHART_PATHS.includes(path)) continue;

        const [head, tail] = path.split('.');
        const target = tail ? (CHART.analysis as Record<string, unknown>) : (CHART as Record<string, unknown>);
        expect(Object.hasOwn(target, tail ?? head), `${path} 이 가리키는 결과가 없다`).toBe(true);
      }
    });

    /**
     * **주석이 잠그던 자리다.**
     *
     * 계약은 "궁합은 남의 근거를 빌려 쓰므로 새 칸이 필요 없다"고 적어 두었고
     * 그것은 지금도 맞는 말이다. 맞는 말이 **아무것도 강제하지 않았다는 것**이
     * 문제였다 — `Compatibility` 에 필드가 하나 늘어도 위의 양방향 검사는 `Saju`
     * 만 훑으므로 걸리지 않는다. 근거를 안 정한 값이 조용히 밖으로 나갈 수 있었다.
     */
    it('궁합이 내는 모든 결과도 근거를 가리킨다', () => {
      const compat = analyzeCompatibility(CHART, HOURLESS);

      for (const key of Object.keys(compat)) {
        expect(Object.hasOwn(COMPAT_CLAIM_PATHS, key), `Compatibility.${key} 에 근거가 없다`).toBe(
          true,
        );
      }

      // 반대 방향 — 없어진 필드를 가리키는 줄이 남아 있으면 안 된다.
      for (const [key, paths] of Object.entries(COMPAT_CLAIM_PATHS)) {
        expect(Object.hasOwn(compat, key), `${key} 이 가리키는 결과가 없다`).toBe(true);
        expect(paths.length, `${key} 이 근거를 하나도 안 든다`).toBeGreaterThan(0);

        for (const path of paths) {
          expect(CLAIM_PATHS as readonly string[], `${key} → ${path}`).toContain(path);
        }
      }
    });

    /**
     * 궁합 문장이 드는 근거와 궁합 결과가 가진 근거가 **같은 집합이어야 한다.**
     *
     * 한쪽이 넓으면 결과에 없는 것을 근거라고 말하는 문장이 생기고, 좁으면
     * 근거를 가진 값을 아무도 말하지 않는다. 둘 다 조용히 일어난다 — 문장은
     * 나오고 검사는 통과한다.
     */
    it('궁합 문장은 궁합 결과가 가진 근거만 든다', () => {
      const compat = analyzeCompatibility(CHART, HOURLESS);
      const declared = new Set(Object.values(COMPAT_CLAIM_PATHS).flat());

      const spoken = new Set(
        findCompatUtterances(compat, { a: { label: '첫' }, b: { label: '둘' } }).flatMap(
          (request) => FRAGMENT_TOPICS[request.topic].paths,
        ),
      );

      expect(spoken.size).toBeGreaterThan(0);
      for (const path of spoken) {
        expect([...declared], `문장이 드는 ${path} 을 궁합 결과가 안 든다`).toContain(path);
      }
    });

    /**
     * **계약은 근거가 전부 `Saju` 의 필드라고 전제하고 있었다.** 궁합이 그 전제를
     * 깨지 않은 것은 남의 근거를 빌려 썼기 때문이다 — 궁합 문장이 읽는 억부·오행·
     * 십성은 전부 각자의 원국에서 나온 값이라 `analysis.*` 로 적힌다.
     *
     * 현재운이 처음으로 명식 밖의 것을 근거로 든다. 위 반대 방향 검사를 그냥
     * 건너뛰면 **아무것도 가리키지 않는 상한**이 조용히 남을 수 있으므로, 예외로
     * 뺀 근거는 여기서 실재하는 L2 결과를 가리키는지 따로 확인한다.
     */
    it('명식 밖의 근거도 실재하는 L2 결과를 가리킨다', () => {
      expect(OFF_CHART_PATHS).toEqual(['now']);

      const now = currentFortuneOf(CHART, new Date('2026-08-17T21:00:00+09:00'));
      expect(now.viewedAt).toBeInstanceOf(Date);
      expect(now.sajuYear).toBe(2026);

      // 보는 시각은 흔들리지 않는다 — 브라우저가 알려 준 값이다.
      expect(CLAIM_CEILING.now).toBe('fact');
      expect(ceilingFor({ paths: ['now'], hourKnown: false })).toBe('fact');
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

    /**
     * 계약은 **어느 판정이 침묵하는지**까지만 적는다. 그것을 강도로 바꾸는 일은
     * 여기 없다 — 한동안 `ceilingForFollowing` 이 있었지만 부르는 곳이 이 테스트
     * 뿐이었다. 판정값별 침묵은 근거와 시각만으로는 낼 수 없는 값이라, 지금은
     * 주제가 이 목록을 읽어 스키마에서 값이 난다(`fragment.test.ts`).
     */
    it('종격 아님만 문장을 만들지 않는다', () => {
      expect(FOLLOWING_SILENT_VERDICTS).toEqual(['not-following']);

      const speakable: FollowingPatternStatus[] = ['candidate', 'pseudo-following', 'true-following'];
      for (const verdict of speakable) {
        expect(
          FOLLOWING_SILENT_VERDICTS.includes(verdict),
          FOLLOWING_PATTERN_STATUS_KO[verdict],
        ).toBe(false);
      }
    });

    it('말하지 않기로 한 근거로 문장을 만들면 걸린다', () => {
      expect(rules('종격은 아닙니다.', 'silent')).toContain('must-be-silent');
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

    /**
     * **자리 이름은 판정이 아니다.**
     *
     * 오신 배정은 고른 용신 하나에서 상생상극으로 곧장 나오는 표 조회이고
     * (`FAVORABILITY_POLICY.derivation`), 막아야 하는 것은 그 자리에 온 오행을
     * 이 명식의 병과 **동일시**하는 말이다. 낱말째 막던 동안은 그 둘이 한
     * 덩어리라 오신을 화면에 세우는 길이 통째로 닫혀 있었다.
     */
    it('오신 이름은 자리로 부를 때만 선다', () => {
      expect(rules('토 쪽이 기신 자리에 옵니다.', 'fact', [])).toHaveLength(0);
      expect(rules('금 쪽이 희신 자리에 옵니다.', 'fact', [])).toHaveLength(0);

      // 동일시는 그대로 막힌다 — 한 낱말 차이다.
      expect(rules('토가 기신입니다.', 'fact', [])).toContain('forbidden-claim');
      expect(rules('기신 쪽이 무겁습니다.', 'fact', [])).toContain('forbidden-claim');
      expect(rules('희신은 금입니다.', 'fact', [])).toContain('forbidden-claim');
    });

    /**
     * 통로를 여는 것은 근거가 아니라 **문형**이다.
     *
     * `insideGroundedTerm` 은 오미합화 같은 이름을 살리려고 낸 길인데, 오신
     * 이름을 근거 목록에 올리면 그 길이 '기신' 을 통째로 풀어 버린다. 그래서
     * `FAVOR_ROLE_KO` 는 `MYEONGRI_LEXICON` 에도 `groundedTermsOf` 에도 없다 —
     * 근거로 들이밀어도 동일시는 여전히 걸려야 한다.
     */
    it('근거 목록에 올려도 동일시는 풀리지 않는다', () => {
      expect(groundedTermsOf(CHART)).not.toContain(FAVOR_ROLE_KO.adversary);
      expect(MYEONGRI_LEXICON.has(FAVOR_ROLE_KO.adversary)).toBe(false);
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

    /**
     * **공협은 어느 쪽으로도 안 잡히고 있었다.**
     *
     * 관계 목록에 없으니 근거 대조에 안 걸리고, 이름이 `partialName` 으로 그 자리에
     * 조합되니 그물에도 없었다. 두 글자만 모인 형(申刑寅 → '신인형')에서 이미 겪은
     * 자리인데 국은 빠져 있었다 — 이제 `BUREAU_NAMES` 가 정적 목록을 낸다.
     */
    it('국 이름을 근거 없이 말하면 걸린다', () => {
      for (const name of ['신자진 수국', '자진 반합', '신진 공협', '인묘 반방합']) {
        expect(MYEONGRI_LEXICON.has(name), name).toBe(true);
        expect(rules(`${name}이 있습니다.`, 'fact', []), name).toContain('ungrounded-term');
        expect(rules(`${name}이 있습니다.`, 'fact', [name]), name).toHaveLength(0);
      }
    });

    /**
     * **그물에도 같은 통로가 필요했다.**
     *
     * 오미합화를 살리려고 낸 「근거가 이긴다」가 여태 금지 목록에만 걸려 있었다.
     * 성패 조건 이름 '식상생재' 안의 '식상'이 근거 없는 용어로 잡히면서 드러났다 —
     * 엔진이 낸 이름 안에 있는 낱말은 따로 말한 것이 아니다.
     *
     * 이름 밖에 서면 여전히 걸린다. 자리를 견주므로 같은 낱말이 한 문장에서 한 번은
     * 통과하고 한 번은 걸릴 수 있고, 그것이 맞다.
     */
    it('엔진이 낸 이름 안의 용어는 따로 말한 것이 아니다', () => {
      expect(rules('식상생재 쪽이 걸립니다.', 'fact', [])).toContain('ungrounded-term');
      expect(rules('식상생재 쪽이 걸립니다.', 'fact', ['식상생재'])).toHaveLength(0);

      // 이름 밖에서 말하면 근거가 있어도 걸린다.
      expect(rules('식상생재 쪽이 걸려 식상이 무겁습니다.', 'fact', ['식상생재'])).toContain(
        'ungrounded-term',
      );
    });

    /**
     * 성패 조건 스물 중 둘이 금지 표현이다. 그 조건이 걸린 명식에서만 열린다 —
     * 합화의 판정 이름과 같은 통로이고, 근거로 담기지 않으면 그대로 막힌다.
     */
    it('성패 조건 이름은 그 조건이 걸린 명식에서만 선다', () => {
      for (const name of ['식신제살', '관인상생']) {
        expect(rules(`${name} 쪽이 걸립니다.`, 'fact', []), name).toContain('forbidden-claim');
        expect(rules(`${name} 쪽이 걸립니다.`, 'fact', [name]), name).toHaveLength(0);
      }

      /*
        나머지를 지키는 것은 **금지 목록이 아니라 근거 목록의 좁음**이다. 근거로
        들이밀면 어느 이름이든 통로가 열리므로(`insideGroundedTerm`), 실제 방벽은
        `groundedTermsOf` 가 **그 명식이 낸 것만** 담는다는 쪽에 있다
        (`ASSEMBLE_POLICY.groundedScope: 'chart-produced-only'`). 그래서 여기서
        확인할 것은 「막히는가」가 아니라 「열 열쇠가 없는가」다.
      */
      for (const name of ['재다신약', '살중용인', '군겁쟁재']) {
        expect(STRUCTURE_FACTOR_NAMES, name).not.toContain(name);
        expect(rules(`${name} 사주로 봅니다.`, 'derived', []), name).toContain('forbidden-claim');
      }

      for (const saju of [CHART, HOURLESS]) {
        for (const name of ['재다신약', '살중용인', '군겁쟁재']) {
          expect(groundedTermsOf(saju), name).not.toContain(name);
        }
      }
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
      // 조후표를 여는 열쇠는 일간과 월지뿐이다.
      expect(ceilingFor({ paths: ['analysis.johu'], hourKnown: false })).toBe('reference');
      // 세운의 해와 월운의 달은 시주 두 글자가 바꾸지 않는다.
      expect(ceilingFor({ paths: ['saeun'], hourKnown: false })).toBe('fact');
      expect(ceilingFor({ paths: ['wolun'], hourKnown: false })).toBe('fact');
    });

    /**
     * 이 자리에 한동안 **틀린 단정이 있었다** — `daeun` 을 "시주와 무관한 근거"의
     * 예로 들고 `fact` 를 기대했다. 대운수는 절입까지의 거리에서 나오고 시각을
     * 모르면 그 거리가 채워 넣은 정오에서 재어진다. 대운 모듈은 처음부터 그것을
     * `approximate` 로 말하고 있었고 그 값이 `!hourKnown` 과 정확히 같다.
     *
     * **아무도 이 근거를 읽지 않아서 아무도 안 봤다.** 계약이 죽은 값을 들고 있으면
     * 그 값은 검증되지 않는다 — `ceilingForFollowing`(부르는 곳이 테스트뿐이었다)과
     * `ATTRIBUTION_PATHS`(읽는 주제가 없어 프로덕션에서 죽어 있었다)와 같은 자리다.
     */
    it('대운은 시주에 걸린다 — 대운수가 정오에서 재어진다', () => {
      expect(CLAIM_CEILING.daeun).toBe('derived');
      expect(ceilingFor({ paths: ['daeun'], hourKnown: false })).toBe('candidate');

      // 대운 모듈이 흔들린다고 말하는 조건이 곧 시각을 모르는 것이다.
      expect(HOURLESS.daeun.approximate).toBe(!HOURLESS.meta.hourKnown);
      expect(CHART.daeun.approximate).toBe(false);
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
