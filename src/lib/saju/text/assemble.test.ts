import { describe, expect, it } from 'vitest';

import { computeSaju, type Saju } from '@/src/lib/saju';
import {
  ASSEMBLE_POLICY,
  FRAGMENT_TOPICS,
  MYEONGRI_LEXICON,
  SEED_INDEX,
  assembleText,
  findUtterances,
  groundedTermsOf,
  indexFragments,
  missingFragmentsOf,
  sentencesOf,
  type Utterance,
} from '@/src/lib/saju/text';

const male = (year: number, month: number, day: number, hour: number | null) =>
  computeSaju(
    hour === null
      ? { year, month, day, hour: null, gender: 'male' }
      : { year, month, day, hour, minute: 30, second: 0, gender: 'male' },
    {},
  );

/** 관계가 다섯 걸리는 명식 */
const RICH = male(1990, 5, 20, 14);
/** 지지충이 걸리는 명식 — 씨앗 조각이 덮는 유일한 관계 종류다 */
const CLASH = male(2000, 1, 1, 14);
/** 관계가 하나도 없는 명식 — 사실 없음이 어떻게 보이는지 */
const BARE = male(1989, 5, 11, 9);
/** 같은 명식의 시간 미상 판 */
const HOURLESS = male(1990, 5, 20, null);

const topicsOf = (saju: Saju) => findUtterances(saju).map((request) => request.topic);

const spoken = (utterances: Utterance[]) => utterances.filter((utterance) => utterance.text !== null);

describe('조립기', () => {
  describe('고르지 않는다', () => {
    /**
     * "중요한 관계 셋만" 은 근거 없이 나머지를 버리는 것이라
     * `distantRelations: 'detect-all'` 을 뒤집는 것과 같은 종류의 후퇴다.
     * 줄이는 것은 화면의 몫이고, 여기서는 사실의 수와 발화의 수가 같아야 한다.
     */
    it('관계는 하나도 빠짐없이 발화한다', () => {
      const relations = topicsOf(RICH).filter((topic) => topic === 'relation.present');

      expect(RICH.relations.length).toBeGreaterThan(3);
      expect(relations).toHaveLength(RICH.relations.length);
    });

    it('사실이 없으면 발화도 없다', () => {
      expect(BARE.relations).toHaveLength(0);
      expect(topicsOf(BARE)).not.toContain('relation.present');

      // 관계가 없다고 명식이 침묵하지는 않는다 — 강약·억부는 언제나 선다.
      expect(topicsOf(BARE)).toContain('strength.verdict');
      expect(topicsOf(BARE)).toContain('eokbu.candidate');
    });

    it('뿌리는 있다와 없다 중 하나만 선다', () => {
      for (const saju of [RICH, BARE, HOURLESS]) {
        const rootedness = topicsOf(saju).filter((topic) => topic.startsWith('rootedness.'));
        expect(rootedness).toHaveLength(1);
      }
    });

    it('주제가 없어 발화하지 않는 사실은 목록으로 남는다', () => {
      // 고른 것이 아니라 주제가 없는 것 — 둘을 구분하지 않으면 "안 중요해서 뺐다"가 섞인다.
      expect(ASSEMBLE_POLICY.coverage).toBe('uncovered-facts-listed');
      expect(topicsOf(RICH)).not.toContain('johu');
    });
  });

  describe('발화 판정은 말뭉치를 모른다', () => {
    it('조각이 하나도 없어도 같은 발화가 나온다', () => {
      const empty = indexFragments([]);

      expect(assembleText(RICH, empty).map(({ request }) => request.topic)).toEqual(topicsOf(RICH));
      expect(sentencesOf(assembleText(RICH, empty))).toHaveLength(0);
    });

    it('조각이 없어 침묵한 자리를 셀 수 있다', () => {
      const missing = missingFragmentsOf(assembleText(RICH));

      // 발화는 있는데 문장이 없는 자리 — 생성기의 다음 작업 목록이다.
      expect(missing.length).toBeGreaterThan(0);
      for (const key of missing) expect(SEED_INDEX.has(key)).toBe(false);
    });
  });

  describe('시간 미상', () => {
    /**
     * 계약의 `absence → silent` 한 줄이 런타임까지 이어지는지 보는 자리다.
     * 시지가 뿌리였다면 "무근입니다"는 그냥 틀린 문장이 된다.
     */
    it('무근 발화는 시간 미상에서 입을 닫는다', () => {
      const rootless = assembleText(HOURLESS).find(
        ({ request }) => request.topic === 'rootedness.rootless',
      );

      if (rootless) {
        expect(rootless.strength).toBe('silent');
        expect(rootless.key).toBeNull();
        expect(rootless.text).toBeNull();
      }
    });

    it('시각과 무관하게 서는 발화는 그대로 선다', () => {
      expect(topicsOf(HOURLESS)).toContain('strength.verdict');
      expect(topicsOf(HOURLESS)).toContain('eokbu.candidate');
    });

    it('시주에 기대는 발화는 강도가 한 칸 내려간다', () => {
      const strengthOf = (saju: Saju) =>
        assembleText(saju).find(({ request }) => request.topic === 'strength.verdict')!.strength;

      expect(strengthOf(RICH)).toBe('derived');
      expect(strengthOf(HOURLESS)).toBe('candidate');
    });

    it('여덟 글자가 여섯이 되므로 관계도 줄어든다', () => {
      // 없는 사실을 지어내지 않는다 — 시주가 빠진 만큼 발화도 준다.
      expect(topicsOf(HOURLESS).filter((topic) => topic === 'relation.present')).toHaveLength(
        HOURLESS.relations.length,
      );
      expect(HOURLESS.relations.length).toBeLessThan(RICH.relations.length);
    });
  });

  describe('근거는 명식 순회 한 번에서 나온다', () => {
    it('이 명식이 낸 것만 담는다', () => {
      const grounded = new Set(groundedTermsOf(RICH));

      for (const relation of RICH.relations) expect(grounded.has(relation.ko)).toBe(true);

      // 넉넉하게 담으면 대조가 통과할 뿐 아무것도 잡지 못한다.
      const absent = [...MYEONGRI_LEXICON].find(
        (term) => term.endsWith('충') && !RICH.relations.some((relation) => relation.ko === term),
      );
      expect(grounded.has(absent!)).toBe(false);
    });

    /**
     * 말하지 않기로 한 판정은 근거 목록에 이름을 올릴 자리도 없다.
     */
    it('종격 아님은 근거에도 넣지 않는다', () => {
      const notFollowing = [RICH, BARE, HOURLESS].find(
        (saju) => saju.analysis.following.verdict === 'not-following',
      );

      expect(notFollowing, '종격이 아닌 명식이 하나는 있어야 한다').toBeDefined();
      expect(groundedTermsOf(notFollowing!)).not.toContain('종격 아님');
    });

    it('발화마다 같은 근거 목록을 쥔다', () => {
      const [first, ...rest] = findUtterances(RICH);

      for (const request of rest) expect(request.grounded).toBe(first.grounded);
    });
  });

  describe('나온 문장은 계약을 지킨다', () => {
    it('위반이 하나도 없다', () => {
      for (const saju of [RICH, BARE, HOURLESS]) {
        for (const utterance of assembleText(saju)) {
          expect(utterance.violations, utterance.key ?? '(silent)').toHaveLength(0);
        }
      }
    });

    it('슬롯에 꽂힌 값은 문장에 그대로 나온다', () => {
      const clash = CLASH.relations.find((relation) => relation.kind === 'branchClash')!;
      const sentence = spoken(assembleText(CLASH)).find((utterance) =>
        utterance.text!.includes(clash.ko),
      );

      expect(sentence, `${clash.ko} 문장이 있어야 한다`).toBeDefined();
      // 씨앗이 덮지 못한 관계 종류는 발화하되 침묵한다 — 지어내지 않는다.
      expect(spoken(assembleText(CLASH)).length).toBeLessThan(CLASH.relations.length);
    });

    it('요청이 쓰는 슬롯은 주제가 선언한 것뿐이다', () => {
      for (const saju of [RICH, BARE, HOURLESS]) {
        for (const request of findUtterances(saju)) {
          const declared = FRAGMENT_TOPICS[request.topic].slots;

          for (const slot of Object.keys(request.slots)) {
            expect(declared, `${request.topic}.${slot}`).toContain(slot);
          }
        }
      }
    });
  });

  it('정책은 납작한 문자열이라 스냅샷이 그대로 찍는다', () => {
    for (const [key, value] of Object.entries(ASSEMBLE_POLICY)) {
      expect(typeof value, key).toBe('string');
    }
  });
});
