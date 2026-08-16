import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { ELEMENT_KO, PILLAR_POSITION_KO } from '@/src/lib/saju';
import { ELEMENT_ROLE_KO } from '@/src/lib/saju/analysis';
import {
  FRAGMENT_POLICY,
  FRAGMENT_TOPICS,
  FRAGMENT_TOPIC_IDS,
  MYEONGRI_LEXICON,
  SEED_FRAGMENTS,
  SEED_INDEX,
  checkFragment,
  expectedFragmentKeys,
  fragmentCoverage,
  fragmentKey,
  indexFragments,
  keyOf,
  producibleStrengths,
  renderFragment,
  sampleSentence,
  skeletonOf,
  type Fragment,
  type FragmentRequest,
} from '@/src/lib/saju/text';

/** 지지충이 있는 명식 — 관계 조각을 실제 데이터로 돌려 보려면 하나는 있어야 한다 */
const CHART = computeSaju(
  { year: 2000, month: 1, day: 1, hour: 14, minute: 30, second: 0, gender: 'male' },
  {},
);

/** 이 명식이 실제로 낸 관계 이름들 */
const relationNames = CHART.relations.map((relation) => relation.ko);

const clash = CHART.relations.find((relation) => relation.kind === 'branchClash');

const render = (request: FragmentRequest) => renderFragment(request, SEED_INDEX);

const rulesOf = (fragment: Fragment) => checkFragment(fragment).map((violation) => violation.rule);

describe('조각 스키마', () => {
  describe('근거와 방향은 주제가 적는다', () => {
    /**
     * 조각이 `paths` 를 직접 들면 억부 문장에 `paths: ['pillars']` 를 적어 상한을
     * `fact` 로 올릴 수 있다 — 손으로 `strength` 를 적는 것과 같은 구멍이 한 겹
     * 위로 옮겨 온 것뿐이다. 조각의 필드를 세어 그것을 막는다.
     */
    it('조각은 근거도 방향도 들고 있지 않다', () => {
      for (const fragment of SEED_FRAGMENTS) {
        expect(Object.keys(fragment).sort(), keyOf(fragment)).toEqual([
          'strength',
          'template',
          'topic',
          'variant',
        ]);
      }
    });

    it('주제마다 근거·방향·변종·슬롯이 적혀 있다', () => {
      for (const topic of FRAGMENT_TOPIC_IDS) {
        const spec = FRAGMENT_TOPICS[topic];

        expect(spec.paths.length, topic).toBeGreaterThan(0);
        expect(spec.variants.length, topic).toBeGreaterThan(0);
        expect(spec.note.length, topic).toBeGreaterThan(0);
        // 변종이 유한해야 생성기가 전수로 돈다.
        expect(new Set(spec.variants).size, topic).toBe(spec.variants.length);
      }
    });
  });

  describe('강도는 표현을 고르는 좌표다', () => {
    /**
     * 조각이 하나뿐이면 시간 미상에서 내려간 강도까지 감당해야 해서 가장 약한
     * 표현으로 써야 하고, 그러면 시각을 아는 흔한 경우까지 눌린다. 강도를 키에
     * 넣는 이유가 이것이라 주제마다 벌 수가 둘인 것이 정상이다.
     */
    it('한 주제가 강도 두 벌을 요구한다', () => {
      expect(producibleStrengths('strength.verdict')).toEqual(['derived', 'candidate']);
      expect(producibleStrengths('relation.present')).toEqual(['fact', 'derived']);
      expect(producibleStrengths('eokbu.candidate')).toEqual(['candidate', 'reference']);
    });

    /**
     * 시지가 뿌리였다면 "무근입니다"는 그냥 틀린 문장이다. 계약이 `absence` 를
     * `silent` 으로 막아 둔 것이 여기서 **조각 한 벌**이라는 값으로 나온다.
     */
    it('없다고 하는 주제는 시간 미상에서 한 벌뿐이다', () => {
      expect(producibleStrengths('rootedness.rootless')).toEqual(['fact']);
      expect(producibleStrengths('rootedness.rooted')).toEqual(['fact', 'derived']);
    });

    it('낼 수 없는 강도의 조각은 아무도 조회하지 못한다', () => {
      const orphan: Fragment = {
        topic: 'rootedness.rootless',
        variant: 'day-master',
        strength: 'derived',
        template: '{dayMaster} 일간은 뿌리가 없는 것으로 봅니다.',
      };

      expect(rulesOf(orphan)).toContain('unproducible-strength');
    });
  });

  describe('용어는 데이터에서만 온다', () => {
    /**
     * 정적 검사의 핵심 — **슬롯을 비운 뼈대를 근거 하나 없이 검사기에 넣는다.**
     * 뼈대에 명리 용어가 있으면 근거 목록이 비었으니 그 자리에서 걸린다.
     */
    it('문장 틀에 명리 용어를 타이핑하면 걸린다', () => {
      const typed: Fragment = {
        topic: 'relation.present',
        variant: 'branchClash',
        strength: 'fact',
        template: '{positions} 자리에서 자오충 관계가 성립합니다.',
      };

      expect(rulesOf(typed)).toContain('ungrounded-term');
      // 이름을 슬롯으로 빼면 통과한다 — 조각 안에 관계 이름이 없어야 한다.
      expect(rulesOf(SEED_FRAGMENTS.find((f) => f.topic === 'relation.present')!)).toHaveLength(0);
    });

    it('씨앗 조각의 뼈대에는 명리 용어가 없다', () => {
      for (const fragment of SEED_FRAGMENTS) {
        const skeleton = skeletonOf(fragment.template);

        for (const term of MYEONGRI_LEXICON) {
          expect(skeleton.includes(term), `${keyOf(fragment)} 에 ${term}`).toBe(false);
        }
      }
    });

    it('선언하지 않은 슬롯은 채울 값이 어디서 오는지 아무도 모른다', () => {
      const stray: Fragment = {
        topic: 'strength.verdict',
        variant: 'strong',
        strength: 'derived',
        template: '{tenGod} 때문에 신강 쪽으로 봅니다.',
      };

      expect(rulesOf(stray)).toContain('undeclared-slot');
    });
  });

  /**
   * 이/가·을/를·(으)로는 앞 글자의 받침을 따르는데 슬롯 값은 런타임에 정해진다.
   * `{element}를` 은 화·토·수에서만 맞고 목·금에서 틀린다.
   */
  describe('조사는 슬롯 뒤에 붙이지 않는다', () => {
    it('슬롯 바로 뒤의 조사는 걸린다', () => {
      const bad: Fragment = {
        topic: 'eokbu.candidate',
        variant: '財星',
        strength: 'candidate',
        template: '억부 관점에서는 {role} 자리의 {element}를 후보로 봅니다.',
      };

      expect(rulesOf(bad)).toContain('slot-particle');
    });

    it('씨앗 조각은 전부 조사를 피해 쓴다', () => {
      for (const fragment of SEED_FRAGMENTS) {
        expect(rulesOf(fragment), keyOf(fragment)).toHaveLength(0);
      }
    });
  });

  /**
   * `slots: ['positions']` 는 "positions 라는 값이 있다"까지만 말한다. 그 값이
   * `'월주·일주'` 인지 모르면 생성기가 문장 틀을 쓸 수 없다.
   */
  describe('슬롯 표본은 계약이지 근거가 아니다', () => {
    it('주제가 선언한 슬롯마다 표본이 있다', () => {
      for (const topic of FRAGMENT_TOPIC_IDS) {
        const spec = FRAGMENT_TOPICS[topic];

        for (const slot of spec.slots) {
          expect(Object.keys(spec.samples), `${topic}.${slot}`).toContain(slot);
        }
      }
    });

    it('표본으로 렌더하면 읽을 수 있는 문장이 된다', () => {
      for (const fragment of SEED_FRAGMENTS) {
        const sample = sampleSentence(fragment);

        expect(sample, keyOf(fragment)).not.toMatch(/\{|\s{2}/);
        expect(sample.endsWith('.'), keyOf(fragment)).toBe(true);
      }
    });

    it('표본을 빠뜨리면 걸린다', () => {
      const noSample: Fragment = {
        topic: 'strength.verdict',
        variant: 'strong',
        strength: 'derived',
        // `ratio` 는 표본이 있지만 `tenGod` 은 선언도 표본도 없다.
        template: '{ratio} 이고 {tenGod} 이라 신강 쪽으로 봅니다.',
      };

      expect(rulesOf(noSample)).toContain('missing-sample');
    });

    /**
     * 표본을 근거로 흘려보내면 꽂은 값이 스스로를 근거로 삼는 셈이라
     * "없는 관계를 말하면 걸린다"가 통째로 무력해진다. 표본에 일부러 명리
     * 용어를 넣어 두고, 그것이 근거 없이 렌더되면 걸린다는 것을 잠근다.
     */
    it('표본 값을 그대로 꽂아도 근거가 없으면 걸린다', () => {
      const { samples } = FRAGMENT_TOPICS['relation.present'];

      const rendered = render({
        topic: 'relation.present',
        variant: 'branchClash',
        slots: samples,
        grounded: [],
      });

      expect(rendered.text).toContain(samples.name);
      expect(rendered.violations.map((violation) => violation.rule)).toContain('ungrounded-term');
    });
  });

  describe('조회와 조립', () => {
    it('강도를 받지 않고 근거와 시각 여부로 스스로 잰다', () => {
      const request: FragmentRequest = {
        topic: 'strength.verdict',
        variant: 'weak',
        slots: { ratio: '38%' },
        grounded: [],
      };

      expect(render(request).strength).toBe('derived');
      expect(render(request).text).toBe('일간을 돕는 세력이 38% 정도라 신약 쪽으로 봅니다.');

      // 시간 미상이면 한 칸 내려가고, 그 칸의 조각이 아직 없어서 말하지 않는다.
      const hourless = render({ ...request, hourKnown: false });
      expect(hourless.strength).toBe('candidate');
      expect(hourless.key).toBe(fragmentKey('strength.verdict', 'weak', 'candidate'));
      expect(hourless.text).toBeNull();
    });

    it('말하지 않기로 한 자리는 조회조차 하지 않는다', () => {
      const silent = render({
        topic: 'rootedness.rootless',
        variant: 'day-master',
        slots: { dayMaster: '갑' },
        grounded: [],
        hourKnown: false,
      });

      expect(silent.strength).toBe('silent');
      expect(silent.key).toBeNull();
      expect(silent.text).toBeNull();
    });

    it('요청이 슬롯을 빠뜨리면 걸린다', () => {
      const rendered = render({
        topic: 'strength.verdict',
        variant: 'strong',
        slots: {},
        grounded: [],
      });

      expect(rendered.violations.map((violation) => violation.rule)).toContain('unfilled-slot');
    });

    it('같은 키가 둘이면 세우는 자리에서 막는다', () => {
      expect(() => indexFragments([...SEED_FRAGMENTS, SEED_FRAGMENTS[0]])).toThrow();
    });
  });

  /**
   * 로드맵이 조각 다음 자리에 적어 둔 검사다. 검사기는 계약을 세울 때부터
   * 있었고 조각이 없어서 못 붙였을 뿐이라, 이제 조각을 거쳐 돈다.
   */
  describe('없는 관계를 말하면 걸린다', () => {
    it('이 명식에 있는 관계는 통과한다', () => {
      expect(clash, '지지충이 있는 명식이어야 한다').toBeDefined();

      const rendered = render({
        topic: 'relation.present',
        variant: 'branchClash',
        slots: {
          name: clash!.ko,
          positions: clash!.participants.map((p) => PILLAR_POSITION_KO[p.position]).join('·'),
        },
        grounded: relationNames,
      });

      expect(rendered.text).toContain(clash!.ko);
      expect(rendered.violations).toHaveLength(0);
    });

    it('이 명식에 없는 관계를 꽂으면 걸린다', () => {
      const absent = [...MYEONGRI_LEXICON].find(
        (term) => term.endsWith('충') && !relationNames.includes(term),
      );

      expect(absent, '이 명식에 없는 충이 하나는 있어야 한다').toBeDefined();

      const rendered = render({
        topic: 'relation.present',
        variant: 'branchClash',
        slots: { name: absent!, positions: '년·일' },
        grounded: relationNames,
      });

      expect(rendered.violations.map((violation) => violation.rule)).toContain('ungrounded-term');
    });

    /**
     * 슬롯 값을 자동으로 근거에 넣으면 꽂은 값이 스스로를 근거로 삼는 셈이라
     * 이 검사가 언제나 통과한다. 조회하는 쪽이 명식에서 읽어 온 것을 적어야 한다.
     */
    it('억부 후보의 이름도 근거 없이는 못 쓴다', () => {
      const request: FragmentRequest = {
        topic: 'eokbu.candidate',
        variant: '財星',
        slots: { role: ELEMENT_ROLE_KO['財星'], element: ELEMENT_KO['火'] },
        grounded: [],
      };

      expect(render(request).violations.map((violation) => violation.rule)).toContain('ungrounded-term');
      expect(
        render({ ...request, grounded: [ELEMENT_ROLE_KO['財星']] }).violations,
      ).toHaveLength(0);
    });
  });

  describe('생성기의 작업 지시서', () => {
    it('채워야 할 자리를 셀 수 있다', () => {
      const coverage = fragmentCoverage();

      expect(coverage.filled).toBe(SEED_FRAGMENTS.length);
      expect(coverage.expected).toBeGreaterThan(coverage.filled);
      expect(coverage.missing).toHaveLength(coverage.expected - coverage.filled);
    });

    it('씨앗은 전부 지시서 안의 자리다', () => {
      const expected = new Set<string>(expectedFragmentKeys());

      for (const fragment of SEED_FRAGMENTS) {
        expect(expected.has(keyOf(fragment)), keyOf(fragment)).toBe(true);
      }
    });

    it('키가 겹치지 않는다', () => {
      const keys = expectedFragmentKeys();
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  it('정책은 납작한 문자열이라 스냅샷이 그대로 찍는다', () => {
    for (const [key, value] of Object.entries(FRAGMENT_POLICY)) {
      expect(typeof value, key).toBe('string');
    }
  });
});
