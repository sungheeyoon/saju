import { describe, expect, it } from 'vitest';

import { computeSaju, type Saju } from '@/src/lib/saju';
import { ELEMENT_ROLE_KO, TEN_GOD_KO } from '@/src/lib/saju/analysis';
import { analyzeCompatibility } from '@/src/lib/saju/compat';
import { currentFortuneOf } from '@/src/lib/saju/now';
import { absorbableByUnknownHour, type Relation } from '@/src/lib/saju/relations';
import { randomInputs, withoutHour } from '@/src/lib/saju/population';
import { TWELVE_STAGE_KO } from '@/src/lib/saju/stages';
import {
  ASSEMBLE_POLICY,
  CLAIM_PATHS,
  FRAGMENT_TOPICS,
  MYEONGRI_LEXICON,
  FRAGMENT_INDEX,
  STRENGTH_WORDING,
  assembleCompatText,
  assembleNowText,
  assembleText,
  checkSentence,
  findUtterances,
  producibleStrengths,
  groundedCompatTermsOf,
  groundedNowTermsOf,
  groundedTermsOf,
  indexFragments,
  missingFragmentsOf,
  sentencesOf,
  UNCOVERED_FACTS_BY_PATH,
  type Utterance,
} from '@/src/lib/saju/text';

const male = (year: number, month: number, day: number, hour: number | null) =>
  computeSaju(
    hour === null
      ? { year, month, day, hour: null, gender: 'male' }
      : { year, month, day, hour, minute: 30, second: 0, gender: 'male' },
    {},
  );

const female = (year: number, month: number, day: number, hour: number | null = 9) =>
  computeSaju(
    hour === null
      ? { year, month, day, hour: null, gender: 'female' }
      : { year, month, day, hour, minute: 0, second: 0, gender: 'female' },
    {},
  );

/** 두 일간이 같은 오행이라 양방향이 같은 십성이 되는 짝 */
const MUTUAL = female(1992, 1, 9);
/** 같은 짝인데 시각만 지웠다 — "없다"는 주장이 어디서 입을 닫는지 */
const MUTUAL_HOURLESS = female(1992, 1, 9, null);
/** 한쪽이 관성이면 다른 쪽은 재성이다 — 비대칭이 가장 잘 보이는 짝 */
const OFFICER = female(1992, 1, 5);
/** 같은 짝의 시간 미상 판 — 양쪽 억부 문장이 함께 내려앉는 것을 본다 */
const OFFICER_HOURLESS = female(1992, 1, 5, null);

const compatOf = (a: Saju, b: Saju) => analyzeCompatibility(a, b);

const peopleOf = (a: Saju, b: Saju) => ({
  a: { label: '민수', hourKnown: a.meta.hourKnown },
  b: { label: '지영', hourKnown: b.meta.hourKnown },
});

const compatText = (a: Saju, b: Saju) => assembleCompatText(compatOf(a, b), peopleOf(a, b));

const compatOn = (a: Saju, b: Saju, topic: string) =>
  compatText(a, b).filter(({ request }) => request.topic === topic);

/** 관계가 다섯 걸리는 명식 */
const RICH = male(1990, 5, 20, 14);
/** 지지충이 걸리는 명식 — 말뭉치가 덮는 유일한 관계 종류다 */
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

    /**
     * 지금 말뭉치에는 빈칸이 없어서 이 수가 0이다. 그래서 세는 장치는 **말뭉치를
     * 비워서** 시험한다 — 주제가 늘면 다시 0이 아니게 되고, 그때 이 목록이
     * 생성기의 작업 지시서가 된다.
     */
    it('조각이 없어 침묵한 자리를 셀 수 있다', () => {
      expect(missingFragmentsOf(assembleText(RICH))).toEqual([]);

      const missing = missingFragmentsOf(assembleText(RICH, indexFragments([])));

      expect(missing.length).toBeGreaterThan(0);
      for (const key of missing) expect(FRAGMENT_INDEX.has(key)).toBe(true);
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

    /**
     * **관계 행이 `fact` 로 남는 근거 — 그리고 그 근거의 정확한 한계.**
     *
     * 이 자리에는 「시주가 붙어도 여섯 글자에서 난 관계는 사라지지 않는다」가
     * 서 있었고 480 쌍으로 0 건임을 확인했다고 적혀 있었다. **틀린 시험이었다.**
     * 1985~1994년의 열두 날만 훑어 반례를 만나지 못했을 뿐이고, 무작위 표본에서는
     * 2961건 중 129건(4.4%)에서 관계가 사라진다.
     *
     * 사라지는 것은 **`full: false` 인 삼합·방합뿐이다.** 세 글자가 다 모이면 그
     * 안의 두 글자 조합을 버리기 때문이고(`absorbedPairs`), 시주가 셋째 글자를
     * 들고 오면 반쪽 줄이 완전한 줄로 바뀐다. 그래서 행은 여전히 `fact` 이되
     * **그 행만 흡수될 수 있다고 함께 말한다**(`row-absorbable`).
     *
     * 시험도 방향을 둘로 든다 — 반례가 **있다**는 것과, 사라진 것이 그 갈래를
     * **넘지 않는다**는 것.
     */
    // 1200 명식을 시각 있는 짝과 없는 짝으로 두 번 세는 측정이라 기본 5초를 넘길 수
    // 있다. 표본을 줄이면 반례를 못 만나는 판이 생긴다 — 그것이 이 시험의 앞판이었다.
    it('사라지는 관계는 반쪽 삼합·방합뿐이다', { timeout: 30_000 }, () => {
      const keysOf = (saju: Saju) =>
        new Map(
          saju.relations.map((r) => [
            `${r.ko}@${r.participants.map((p) => p.position).join(',')}`,
            r,
          ]),
        );

      let checked = 0;
      const lost: { key: string; relation: Relation }[] = [];

      for (const input of randomInputs(1200)) {
        const hourless = computeSaju(withoutHour(input));
        const withHour = computeSaju(input);

        // 세 기둥이 갈리면 다른 명식이라 "관계가 사라졌다"고 셀 수 없다.
        const three = (saju: Saju) =>
          (['year', 'month', 'day'] as const).map((p) => saju.pillars[p].name).join(' ');
        if (three(hourless) !== three(withHour)) continue;

        checked += 1;
        const eight = keysOf(withHour);

        for (const [key, relation] of keysOf(hourless)) {
          if (!eight.has(key)) lost.push({ key, relation });
        }
      }

      expect(checked).toBeGreaterThan(1000);

      // 반례가 없으면 이 시험은 아무것도 재지 않는다 — 앞선 시험이 그랬다.
      expect(lost.length).toBeGreaterThan(0);

      // 그리고 사라진 것은 그 갈래를 넘지 않는다.
      const beyond = lost.filter(({ relation }) => !absorbableByUnknownHour(relation, false));
      expect(beyond.map(({ key }) => key)).toEqual([]);
    });

    /** 고정 반례 하나 — 무작위 표본이 언젠가 못 만날 수 있다 */
    it('壬申 癸卯 丁酉 에 시주 庚戌 이 붙으면 신유 반방합이 금방으로 흡수된다', () => {
      const input = {
        year: 2052,
        month: 3,
        day: 7,
        hour: 20,
        minute: 0,
        second: 0,
        gender: 'male',
      } as const;

      const hourless = computeSaju(withoutHour(input));
      const withHour = computeSaju(input);

      expect(withHour.pillars.hour?.name).toBe('庚戌');
      expect(hourless.relations.map((r) => r.ko)).toContain('신유 반방합');
      expect(withHour.relations.map((r) => r.ko)).not.toContain('신유 반방합');
      expect(withHour.relations.map((r) => r.ko)).toContain('신유술 금방');

      // 그 행은 지워지지도 내려가지도 않고, 단서를 달고 선다.
      const row = assembleText(hourless).find(
        ({ request }) =>
          request.topic === 'relation.present' && request.slots.name === '신유 반방합',
      );
      expect(row?.request.variant).toBe('row-absorbable');
      expect(row?.strength).toBe('fact');
      expect(row?.text).toContain('시주에 따라 완전한 합으로 흡수될 수 있음');
    });

    /**
     * 목록의 한계는 목록이 든다. **행이 못 하던 말을 여기서 한다** — 궁합에서
     * 행의 단서만 보고는 민수 쪽인지 지영 쪽인지 알 수 없었다.
     */
    it('목록이 스스로 무엇을 빼고 셌는지 말한다', () => {
      const coverage = assembleText(HOURLESS).find(
        ({ request }) => request.topic === 'relation.coverage',
      );

      expect(coverage?.strength).toBe('fact');
      expect(coverage?.text).toContain('시주');
      expect(coverage?.violations).toEqual([]);

      // 시각을 알면 뺀 것이 없으므로 이 발화 자체가 서지 않는다.
      expect(topicsOf(RICH)).not.toContain('relation.coverage');
    });
  });

  /**
   * 격국 성패 — **접지 않고 목록을 문장 안에 둔다.**
   */
  describe('성패는 조건을 이름으로 든다', () => {
    /**
     * 엔진의 `outcome` 은 「섞였거나 둘 다 없다」를 `unresolved` 한 칸에 담는데
     * 둘은 뜻이 정반대다(3000건에서 22.5% 대 15.5%). 값을 하나 더 만들지 않고
     * **두 목록의 길이**를 읽어 가른다 — 밖에서 보이는 사실이라 그럴 수 있다.
     */
    it('미정 한 칸이 섞임과 둘 다 없음으로 갈린다', () => {
      const seen = new Map<string, number>();

      for (const input of randomInputs(400)) {
        const saju = computeSaju(input);
        const request = findUtterances(saju).find(
          (candidate) => candidate.topic === 'structure.outcome',
        )!;
        const { structure } = saju.analysis;

        if (structure.outcome !== 'unresolved') continue;
        seen.set(request.variant, (seen.get(request.variant) ?? 0) + 1);
      }

      expect([...seen.keys()].sort()).toEqual(['mixed', 'none']);
    });

    /**
     * 네 문장이 전부 「확인되지 않았다」에 기대고 조건 대부분이 천간 투출을 보므로
     * 시주 두 글자가 그것을 뒤집는다(같은 표본에서 26.5%). **격 이름은 그대로
     * 말하고 성패만 입을 닫는 것**이 이 주제의 값이다.
     */
    it('시각을 모르면 격 이름은 말하고 성패만 입을 닫는다', () => {
      const said = assembleText(HOURLESS);
      const kind = said.find((utterance) => utterance.request.topic === 'structure.kind')!;
      const outcome = said.find((utterance) => utterance.request.topic === 'structure.outcome')!;

      expect(kind.text).not.toBeNull();
      expect(outcome.strength).toBe('silent');
      expect(outcome.text).toBeNull();

      // 시각을 알면 둘 다 선다 — 잠그는 것이 시주라는 뜻이다.
      const known = assembleText(RICH);
      expect(
        known.find((utterance) => utterance.request.topic === 'structure.outcome')!.text,
      ).not.toBeNull();
    });

    /**
     * 조건 이름 스물 중 둘이 금지 표현이다(`식신제살`·`관인상생`). 그 조건이 걸린
     * 명식에서만 근거가 되어 열리므로, 근거에 담기지 않으면 조각이 통째로 위반을
     * 낸다 — 무작위 3000건의 13% 가 그 자리였다.
     */
    it('금지 표현인 조건 이름이 그 명식의 근거로 담긴다', () => {
      let opened = 0;

      for (const input of randomInputs(400)) {
        const saju = computeSaju(input);
        const { structure } = saju.analysis;
        const names = [...structure.formingFactors, ...structure.breakingFactors].map(
          (factor) => factor.name,
        );

        for (const name of ['식신제살', '관인상생']) {
          if (!names.includes(name)) {
            expect(groundedTermsOf(saju), name).not.toContain(name);
            continue;
          }
          opened += 1;
          expect(groundedTermsOf(saju), name).toContain(name);
        }
      }

      expect(opened).toBeGreaterThan(0);
    });
  });

  /**
   * 뿌리의 질 — **사실 문장과 판정 문장이 같은 뿌리를 두고 갈린다.**
   */
  describe('뿌리에서 덜어 본 몫', () => {
    /**
     * `effectivelyRootless` 는 「질의 합이 문턱 아래」라는 뜻이라 **뿌리가 0개일
     * 때도 참**이다. 그 자리는 뽑힌 것이 아니라 애초에 없는 것이고
     * `rootedness.rootless` 가 이미 말한다 — 안 가르면 무근 명식이 「세어지기는
     * 해도 남지 않았다」는 거짓말을 듣는다.
     *
     * 조립기에 그것을 막는 줄을 따로 세웠다가 지웠다. 뿌리가 없으면 깎일 것도
     * 없어서 「깎인 것이 하나라도 있는가」가 이미 막고 있었고, 떼어 봐도 아무
     * 시험이 안 깨졌다. **막는 줄이 바뀌어도 막힌다는 것은 여기가 잠근다.**
     */
    it('무근이면 뽑혔다고 말하지 않는다', () => {
      let rootless = 0;

      for (const input of randomInputs(400)) {
        const saju = computeSaju(input);
        if (saju.analysis.rootedness.dayMaster.rooted) continue;

        rootless += 1;
        expect(saju.analysis.rootQuality.dayMaster.effectivelyRootless).toBe(true);
        expect(topicsOf(saju)).not.toContain('rootQuality.pulled');
        expect(topicsOf(saju)).not.toContain('rootQuality.damaged');
      }

      expect(rootless).toBeGreaterThan(0);
    });

    /**
     * **문턱이 혼자 발화하는 일이 없다.** `EFFECTIVE_ROOT_FLOOR` 아래로 내려간
     * 명식은 무작위 3000건에서 전부 충이나 국에 깎인 자리였다 — 가장 얕은 뿌리
     * (여기 · 같은 오행 · 고지 · 시지)가 0.105 로 문턱 바로 위이기 때문이다.
     *
     * 변종이 원인으로 갈리는 것이 이 사실에 기대고 있다. 깎이지 않고 뽑히는
     * 명식이 하나라도 생기면 조립기가 고를 변종이 없어진다.
     */
    it('뽑힌 뿌리는 언제나 충이나 국에 깎여 있다', () => {
      let pulled = 0;

      for (const input of randomInputs(600)) {
        const saju = computeSaju(input);
        const quality = saju.analysis.rootQuality.dayMaster;
        if (!saju.analysis.rootedness.dayMaster.rooted || !quality.effectivelyRootless) continue;

        pulled += 1;
        expect(
          quality.roots.some((graded) => graded.clashed || graded.defected > 0),
          JSON.stringify(input),
        ).toBe(true);
      }

      expect(pulled).toBeGreaterThan(0);
    });

    /**
     * 「없다」는 주장이라 시주가 뒤집는다 — 세 기둥이 같은 표본에서 8.7% 가
     * 실제로 뒤집힌다. `rootedness.rootless` 와 같은 자리다.
     */
    it('뽑혔다는 말은 시각을 모르면 입을 닫는다', () => {
      const pulled = randomInputs(600)
        .map((input) => computeSaju(input))
        .find(
          (saju) =>
            saju.analysis.rootedness.dayMaster.rooted &&
            saju.analysis.rootQuality.dayMaster.effectivelyRootless,
        );

      expect(pulled).toBeDefined();
      expect(producibleStrengths('rootQuality.pulled')).toEqual(['derived']);
      // 깎였지만 남은 쪽은 있다는 주장이라 한 칸 내려가기만 한다.
      expect(producibleStrengths('rootQuality.damaged')).toEqual(['derived', 'candidate']);
    });

    /**
     * 뽑힘은 3000건의 3.8% 이고 그것이 다시 원인 셋으로 갈린다. 400건짜리 표본은
     * 그중 하나를 통째로 못 밟고 지나가서, 아무도 조회하지 않는 조각이 지시서에
     * 빈칸 없이 앉아 있어도 보이지 않는다 — 표본을 그 자리가 나올 만큼 늘렸다.
     */
    it('여섯 좌표가 모두 실제로 조회된다', () => {
      const seen = new Set(
        randomInputs(900)
          .map((input) => computeSaju(input))
          .flatMap((saju) =>
            findUtterances(saju)
              .filter((request) => request.topic.startsWith('rootQuality.'))
              .map((request) => `${request.topic}/${request.variant}`),
          ),
      );

      expect([...seen].sort()).toEqual([
        'rootQuality.damaged/both',
        'rootQuality.damaged/clashed',
        'rootQuality.damaged/defected',
        'rootQuality.pulled/both',
        'rootQuality.pulled/clashed',
        'rootQuality.pulled/defected',
      ]);
    });
  });

  /**
   * 합화 — **금지 표현을 판정이 연다.**
   */
  describe('합화는 판정한 자리에서만 그 이름을 쓴다', () => {
    /** 갑기합토가 化한다(己卯 甲戌 戊申 癸亥). 문장 골든의 `transformation-true` 와 같은 명식 */
    const TRANSFORMED = male(1999, 10, 23, 22);
    /** 무계합화가 조건부인데 일간이 물려 있다(戊午 癸酉 己卯 庚午) */
    const DAY_MASTER = male(1990, 3, 9, 13);

    /**
     * **담는 것이 금지를 푸는 것이 아니다.** `unfavorable-element` 는 자리 이름이
     * 언제나 나오므로 근거로 열면 금지가 죽어 문형을 좁혀야 했는데(`onlyBefore`),
     * 이쪽은 판정 이름이 **化한 명식에서만** 근거가 된다. 무작위 3000건의 합
     * 1774건 중 化는 34건뿐이라 대부분의 명식에서 '합화'는 그대로 막혀 있다.
     */
    it('化한 명식에서만 판정 이름이 근거에 담긴다', () => {
      expect(groundedTermsOf(TRANSFORMED)).toContain('합화');

      // 化가 없으면 담기지 않고, 그래서 그 낱말을 쓰면 계약이 잡는다.
      expect(groundedTermsOf(BARE)).not.toContain('합화');
      expect(
        checkSentence({
          text: '천간 둘을 합화 자리로 봅니다.',
          paths: ['analysis.effectiveElements'],
          strength: 'derived',
          grounded: groundedTermsOf(BARE),
        }).map((violation) => violation.rule),
      ).toContain('forbidden-claim');
    });

    /**
     * 일간이 물린 합은 등급이 나도 무게를 안 옮긴다
     * (`EFFECTIVE_ELEMENTS_POLICY.dayMasterCombination`). 판정만 보고 변종을
     * 고르면 **옮기지도 않은 무게를 옮겼다고 적는다.**
     */
    it('일간이 물리면 등급이 나도 옮겼다고 말하지 않는다', () => {
      const said = spoken(assembleText(DAY_MASTER)).map((utterance) => utterance.text ?? '');
      const line = said.find((text) => text.includes('무계합화'));

      expect(line).toBeDefined();
      expect(line).toContain('무게를 옮기지 않은');
      expect(line).toContain('화격');

      // 그 명식에서 실제로 옮긴 것이 없어야 이 문장이 참이다.
      expect(DAY_MASTER.analysis.effectiveElements.shifts).toHaveLength(0);
    });

    it('다섯 변종이 모두 실제로 조회된다', () => {
      const variantsOf = (saju: Saju) =>
        findUtterances(saju)
          .filter((request) => request.topic === 'transformation.verdict')
          .map((request) => request.variant);

      const seen = new Set([
        ...variantsOf(TRANSFORMED),
        ...variantsOf(DAY_MASTER),
        ...randomInputs(200).flatMap((input) => variantsOf(computeSaju(input))),
      ]);

      expect([...seen].sort()).toEqual([
        'bound',
        'conditional',
        'contested',
        'day-master',
        'transformed',
      ]);
    });
  });

  /**
   * 국 — **변종이 기대는 사실을 모집단에 물어본다.**
   */
  describe('국이 무게를 기울인다', () => {
    /**
     * `span` 변종의 문장은 「관계 표에는 싣지 않는다」고 말한다. 그 말이 참인지는
     * 말뭉치가 아니라 **관계 열거**가 정하고, 두 모듈은 서로를 모른다 —
     * `bureau.ts` 가 주석으로 적어 둔 약속일 뿐이라 관계 표에 공협이 하나 들어오는
     * 날 문장이 조용히 거짓이 된다. 모집단이 그것을 지킨다.
     *
     * 무작위 3000건에서 공협 406건은 **전부** 관계 목록에 없고, 나머지 국 2570건은
     * **전부** 있다. 축이 정확히 갈린다는 뜻이라 변종 둘이 여기서 값을 얻는다.
     */
    it('공협만 관계 목록에 없다 — 변종이 갈리는 자리다', () => {
      let span = 0;
      let inTable = 0;

      for (const input of randomInputs(400)) {
        const saju = computeSaju(input);
        const names = new Set(saju.relations.map((relation) => relation.ko));

        for (const bureau of saju.analysis.bureaus) {
          if (bureau.kind === 'spanTriple') {
            span += 1;
            expect(names.has(bureau.ko), `공협이 관계 표에 있다: ${bureau.ko}`).toBe(false);
          } else {
            inTable += 1;
            expect(names.has(bureau.ko), `국이 관계 표에 없다: ${bureau.ko}`).toBe(true);
          }
        }
      }

      // 둘 다 실제로 돌았는지 본다 — 표본이 한쪽만 스치면 위 단언이 공짜로 통과한다.
      expect(span).toBeGreaterThan(0);
      expect(inTable).toBeGreaterThan(0);
    });

    /**
     * 공협 이름은 관계 목록에 없으므로 근거 목록에도 없었다. 슬롯에 꽂기만 하고
     * 근거에 안 담으면 `ungrounded-term` 으로 걸린다 — 걸리는 것이 맞고, 담아야
     * 걸리지 않는다. 담는 것이 규율을 푸는 것이 아닌 이유는 **명식이 실제로 낸
     * 이름**이기 때문이다(`groundedScope: 'chart-produced-only'`).
     */
    it('국 이름이 근거 목록에 담긴다', () => {
      for (const input of randomInputs(200)) {
        const saju = computeSaju(input);
        const grounded = groundedTermsOf(saju);

        for (const bureau of saju.analysis.bureaus) {
          expect(grounded, bureau.ko).toContain(bureau.ko);
        }
      }
    });

    /**
     * 옮긴 것이 없으면 두 분포가 같은 값이라 견줄 것이 없다. **말하지 않기로 한
     * 것이 아니라 사실이 없는 것**이라, 요청 자체가 나오지 않아야 한다.
     */
    it('무게가 안 움직인 명식은 두 셈을 견주지 않는다', () => {
      let moved = 0;
      let still = 0;

      for (const input of randomInputs(200)) {
        const saju = computeSaju(input);
        const said = topicsOf(saju).includes('elements.heaviest');

        expect(said, JSON.stringify(input)).toBe(saju.analysis.effectiveElements.adjusted);
        if (saju.analysis.effectiveElements.adjusted) moved += 1;
        else still += 1;
      }

      expect(moved).toBeGreaterThan(0);
      expect(still).toBeGreaterThan(0);
    });

    /**
     * 두 셈의 답이 갈리는 것이 이 주제를 만든 이유다(움직인 명식의 11.2%).
     * 표본이 그 자리를 한 번도 안 밟으면 `differs` 조각은 아무도 조회하지 않는
     * 칸이 되고, 골든의 손으로 고른 명식만으로는 밟는지 알 수 없다.
     */
    it('모집단이 갈리는 쪽도 밟는다', () => {
      const variants = new Set(
        randomInputs(400)
          .map((input) => computeSaju(input))
          .flatMap((saju) =>
            findUtterances(saju)
              .filter((request) => request.topic === 'elements.heaviest')
              .map((request) => request.variant),
          ),
      );

      expect([...variants].sort()).toEqual(['differs', 'same']);
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

      // 관계는 이제 전부 문장이 된다 — 발화한 수와 사실의 수가 같다.
      const relationSentences = spoken(assembleText(CLASH)).filter(
        ({ request }) => request.topic === 'relation.present',
      );
      expect(relationSentences).toHaveLength(CLASH.relations.length);
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

  /**
   * 궁합에서 처음 생기는 값은 **일간과 일간 사이** 하나다. 원국의 십성은 이미
   * 사주팔자 표에 여덟 자리 전부 있고, 표에 없던 자리가 이것뿐이다.
   */
  describe('궁합 십성', () => {
    const rowsOf = (a: Saju, b: Saju) => compatOn(a, b, 'tenGods.between');

    /**
     * 방향이 변종이 아니라 슬롯이라는 것의 결과다. 값이 같으면 두 행이 같은 말을
     * 하는데 **접지 않는다** — 접으면 엔진이 양방향으로 들고 있는 값을 문장이
     * 하나로 만드는 것이고, 접었다는 사실이 어디에도 남지 않는다.
     */
    it('양방향이 같은 값이어도 두 행이 선다', () => {
      const rows = rowsOf(RICH, MUTUAL);

      expect(rows).toHaveLength(2);
      expect(rows[0].key).toBe(rows[1].key);
      expect(rows[0].text).not.toBe(rows[1].text);
    });

    it('누구 눈으로 본 것인지가 행에 있다', () => {
      const [aSeesB, bSeesA] = rowsOf(RICH, OFFICER);

      expect(aSeesB.text).toContain('민수의 눈으로 본 지영');
      expect(bSeesA.text).toContain('지영의 눈으로 본 민수');

      // 비대칭이므로 변종도 갈린다 — 한쪽이 관성이면 다른 쪽은 재성이다.
      expect(aSeesB.key).not.toBe(bSeesA.key);
    });

    /**
     * 십성을 여는 열쇠는 두 일간뿐이고 일주는 시각을 몰라도 나온다. 시주 두
     * 글자가 값을 바꾸지 않으므로 강도가 내려갈 이유가 없다 — 조후와 같다.
     */
    it('시간 미상에도 사실 그대로다', () => {
      for (const row of rowsOf(HOURLESS, OFFICER)) {
        expect(row.strength).toBe('fact');
        expect(row.text).not.toBeNull();
      }
    });

    it('행에는 강도 표지가 없다', () => {
      for (const row of rowsOf(RICH, OFFICER)) {
        for (const mark of Object.values(STRENGTH_WORDING)) {
          expect(row.text!.includes(mark), `${row.key} 에 ${mark}`).toBe(false);
        }
      }
    });

    /**
     * 십성 이름은 명리 용어라 근거 목록에 없으면 걸려야 한다. 슬롯에 꽂은 값을
     * 근거로 흘려보내면 꽂은 값이 스스로를 근거로 삼아 대조가 언제나 통과한다.
     */
    it('근거는 엔진이 낸 십성만 담는다', () => {
      const compat = compatOf(RICH, OFFICER);
      const grounded = new Set(groundedCompatTermsOf(compat));

      for (const tenGod of Object.values(compat.tenGods)) {
        expect(grounded.has(TEN_GOD_KO[tenGod])).toBe(true);
      }

      const absent = Object.values(TEN_GOD_KO).find((ko) => !grounded.has(ko));
      expect(absent, '담기지 않은 십성이 있어야 대조가 무엇이라도 잡는다').toBeDefined();
    });

  });

  /**
   * 궁합의 **첫 산문**이다. 그 전까지 궁합이 낸 발화는 전부 `fact` 였고(관계 행 ·
   * 목록 · 십성), 그래서 `hourKnown` 도 궁합에서는 아무 일도 하지 않는 값이었다.
   */
  describe('궁합 억부 부합', () => {
    const matchesOf = (a: Saju, b: Saju) =>
      compatText(a, b).filter(({ request }) => request.topic.startsWith('eokbuMatch.'));

    it('궁합에서 처음으로 사실이 아닌 강도가 선다', () => {
      const strengths = new Set(compatText(RICH, OFFICER).map((utterance) => utterance.strength));

      expect(strengths.has('candidate')).toBe(true);

      // 나머지는 전부 행이다 — 이 주제가 붙기 전에는 사실 하나뿐이었다.
      expect([...strengths].sort()).toEqual(['candidate', 'fact']);
    });

    /**
     * 억부는 각자의 원국에서 이미 시험값이고, 궁합으로 넘어오며 딱지가 떨어지면
     * 근거 없는 확신이 결론으로 새어 나간다(`COMPAT_POLICY.eokbu`).
     */
    it('시험값 딱지를 물려받는다', () => {
      for (const utterance of matchesOf(RICH, OFFICER)) {
        expect(utterance.strength).toBe('candidate');
        expect(utterance.text).toContain('후보');
      }
    });

    /**
     * 상대의 시지가 그 오행이었을 수 있으므로 "없습니다"는 그냥 틀린 문장이 된다.
     * 내리는 것이 아니라 입을 닫는다 — 무근과 같은 자리다.
     */
    it('없다는 주장은 상대의 시주가 빠지면 입을 닫는다', () => {
      const spoke = matchesOf(RICH, MUTUAL).find(
        ({ request }) => request.topic === 'eokbuMatch.missing',
      );
      expect(spoke?.text, '시각을 알면 말한다').not.toBeNull();

      const silent = matchesOf(RICH, MUTUAL_HOURLESS).find(
        ({ request }) => request.topic === 'eokbuMatch.missing',
      );

      // 발화 자체는 선다. 걸러 버리면 "사실이 없다"와 한 덩어리가 된다.
      expect(silent, '요청은 그대로 있어야 한다').toBeDefined();
      expect(silent!.strength).toBe('silent');
      expect(silent!.key).toBeNull();
    });

    /**
     * 원국에서는 '시주' 한 마디로 충분했다 — 명식이 하나뿐이라 누구 것인지 물을
     * 일이 없었다. 궁합에서는 그것으로 못 가린다.
     */
    it('강등된 문장이 누구의 시주를 뺐는지 부른다', () => {
      const downgraded = matchesOf(RICH, OFFICER_HOURLESS);

      expect(downgraded.length).toBeGreaterThan(0);
      for (const utterance of downgraded) {
        expect(utterance.strength).toBe('reference');
        expect(utterance.text).toContain('지영의 시주');
      }
    });

    /**
     * 한쪽 시주만 빠져도 두 문장이 함께 내려간다. 비중은 **상대의** 여덟 글자에서
     * 나오므로 내 억부 문장도 상대의 시주에 걸린다 — 관계 행이 시주와 무관하게
     * 사실로 남는 것과 갈리는 자리다.
     */
    it('한쪽만 몰라도 양쪽 문장이 함께 내려간다', () => {
      const rungs = matchesOf(RICH, OFFICER_HOURLESS).map((utterance) => utterance.strength);

      expect(rungs).toEqual(['reference', 'reference']);

      // 같은 짝인데 시각을 알면 둘 다 후보다.
      expect(matchesOf(RICH, OFFICER).map((utterance) => utterance.strength)).toEqual([
        'candidate',
        'candidate',
      ]);
    });

    /**
     * 자리 이름은 명리 용어라 근거 목록에 없으면 걸린다. 오행 이름은 한 글자라
     * 그물에서 빠져 있고(`MYEONGRI_LEXICON`) 그것을 막는 것은 `vocabulary` 쪽이다.
     */
    it('근거에 억부 자리 이름이 담긴다', () => {
      const compat = compatOf(RICH, OFFICER);
      const grounded = new Set(groundedCompatTermsOf(compat));

      for (const match of Object.values(compat.eokbuMatch)) {
        expect(grounded.has(ELEMENT_ROLE_KO[match.role])).toBe(true);
      }
    });

    /** 궁합 점수를 내지 않기로 한 결정이 산문에서 풀리는지 보는 자리다 */
    it('채워 준다고 말하지 않는다', () => {
      for (const utterance of matchesOf(RICH, OFFICER)) {
        for (const word of ['채워', '보완', '도움', '잘 맞']) {
          expect(utterance.text!.includes(word), `${utterance.key} 에 ${word}`).toBe(false);
        }
      }
    });
  });

  /**
   * 타입이 먼저 말한다 — `EokbuMatch` 에는 `status: 'experimental'` 이 있는데
   * `ElementSupport` 에는 없다. 물려받을 판정이 없으니 행이다.
   */
  describe('궁합 오행 보완', () => {
    /** 둘 다 금이 없는 짝 */
    const BOTH_A = male(1988, 1, 3, 10);
    const BOTH_B = female(1988, 2, 19, 10);

    const supportOf = (a: Saju, b: Saju) =>
      compatText(a, b).filter(({ request }) => request.topic.startsWith('elementSupport.'));

    it('행이라 강도 표지를 품지 않는다', () => {
      for (const row of supportOf(BOTH_A, BOTH_B)) {
        for (const mark of Object.values(STRENGTH_WORDING)) {
          expect(row.text!.includes(mark), `${row.key} 에 ${mark}`).toBe(false);
        }
      }
    });

    /**
     * `weakest` 는 argmin 이라 없는 오행이 있으면 그것을 가리킨다. 0 인 자리를
     * "가장 얇다"고 부르면 있는 것처럼 읽히고, 그 자리는 위 행이 이미 없다고 말했다.
     */
    it('없는 오행이 있으면 최약 행은 서지 않는다', () => {
      const compat = compatOf(BOTH_A, BOTH_B);

      expect(compat.elementSupport.a.missing.length).toBeGreaterThan(0);
      expect(supportOf(BOTH_A, BOTH_B).map(({ request }) => request.topic)).not.toContain(
        'elementSupport.weakest',
      );

      // 다섯이 다 있는 쪽에서는 선다 — 그때가 이 주제의 자리다.
      const rich = compatOf(RICH, OFFICER);
      expect(rich.elementSupport.a.missing).toEqual([]);
      expect(supportOf(RICH, OFFICER).map(({ request }) => request.variant)).toContain('pair');
    });

    /**
     * 둘 다 없는 것은 사람마다가 아니라 짝의 성질이고 두 쪽의 집합이 정의상 같다.
     * 사람마다 내면 같은 행이 두 벌 찍혀 다른 값인 줄 알고 두 번 읽게 된다.
     */
    it('둘 다 없는 오행은 한 번만 선다', () => {
      const compat = compatOf(BOTH_A, BOTH_B);

      expect(new Set(compat.elementSupport.a.stillMissing)).toEqual(
        new Set(compat.elementSupport.b.stillMissing),
      );

      const rows = supportOf(BOTH_A, BOTH_B).filter(
        ({ request }) => request.variant === 'still-missing',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].text).toContain('민수와 지영');
    });

    /**
     * 주장의 앞머리가 "내게 그 오행이 없다"라서 시지가 그 오행이었다면 행 전체가
     * 틀린다. 최약은 그렇지 않다 — 다른 오행이 그 자리에 올 뿐이라 한 칸 내려간다.
     */
    it('없다는 행은 침묵하고 최약 행은 내려앉는다', () => {
      const absent = supportOf(BOTH_A, female(1988, 2, 19, null)).filter(
        ({ request }) => request.topic === 'elementSupport.absent',
      );
      expect(absent.length).toBeGreaterThan(0);
      for (const row of absent) expect(row.strength).toBe('silent');

      const weakest = supportOf(RICH, OFFICER_HOURLESS).filter(
        ({ request }) => request.topic === 'elementSupport.weakest',
      );
      expect(weakest.length).toBeGreaterThan(0);
      for (const row of weakest) {
        expect(row.strength).toBe('derived');
        expect(row.text).toContain('지영의 시주');
      }
    });

    /** 채우는 쪽이 좋다는 읽기는 계통 갈림이다 — 행에는 실을 서술어가 없다 */
    it('보완이라 부르지 않는다', () => {
      for (const row of supportOf(BOTH_A, BOTH_B)) {
        for (const word of ['보완', '채워', '도움', '잘 맞', '좋']) {
          expect(row.text!.includes(word), `${row.key} 에 ${word}`).toBe(false);
        }
      }
    });
  });

  it('궁합 발화는 전부 계약을 지킨다', () => {
    for (const partner of [MUTUAL, MUTUAL_HOURLESS, OFFICER]) {
      for (const a of [RICH, HOURLESS]) {
        for (const utterance of compatText(a, partner)) {
          expect(utterance.violations, utterance.key ?? '(silent)').toHaveLength(0);
        }
      }
    }
  });

  /**
   * 현재운 — **강도가 행과 산문을 한 묶음 안에서 가른다.**
   *
   * 세운·월운은 해와 달에서 나온 사실이라 행이고, 대운은 우리가 고른 대운수 위에
   * 서 있어 산문이다. `ClaimForm` 이 "완충 표현이 필요하다는 것이 곧 산문이어야
   * 한다는 뜻"이라고 적어 둔 것을 한 카드에서 확인하는 자리다.
   */
  describe('현재운', () => {
    const VIEWED_AT = new Date('2026-08-17T21:06:00+09:00');

    const nowTextOf = (saju: Saju, viewedAt: Date = VIEWED_AT) =>
      assembleNowText(currentFortuneOf(saju, viewedAt));

    const topicOf = (utterances: Utterance[], topic: string) =>
      utterances.find(({ request }) => request.topic === topic);

    it('기준 시각 발화가 조건 없이 맨 앞에 선다', () => {
      for (const saju of [RICH, HOURLESS]) {
        const [first] = nowTextOf(saju);

        expect(first.request.topic).toBe('now.asOf');
        expect(first.strength).toBe('fact');
        // 슬롯에 꽂힌 값이 그대로 문장에 있어야 스크린샷이 거짓말하지 않는다.
        expect(first.text).toContain('2026년 8월 17일 21시 6분');
      }
    });

    /**
     * 나머지 발화가 '지금'·'이번'을 쓰므로 좌표 없이는 전부 기준점 없는 문장이 된다.
     * **화면이 이 발화를 빼면 나머지가 거짓이 되고 그것을 테스트가 못 본다** — 여기서
     * 잠글 수 있는 것은 조립기가 언제나 낸다는 것까지다.
     */
    it('상대 표현을 쓰는 발화가 실제로 있다', () => {
      const texts = sentencesOf(nowTextOf(RICH));

      expect(texts.some((text) => text.includes('지금'))).toBe(true);
      expect(ASSEMBLE_POLICY.viewingInstant).toBe('as-of-line-always-first');
    });

    it('세운·월운은 행이고 대운은 산문이다', () => {
      const utterances = nowTextOf(RICH);

      for (const topic of ['now.saeun', 'now.wolun'] as const) {
        const row = topicOf(utterances, topic);

        expect(FRAGMENT_TOPICS[topic].form, topic).toBe('row');
        expect(row?.strength, topic).toBe('fact');
        // 행은 마침표로 끝나지 않고 강도 표지도 품지 않는다 — 강도는 옆 칸이 든다.
        expect(row?.text?.endsWith('.'), topic).toBe(false);
        for (const mark of Object.values(STRENGTH_WORDING)) {
          expect(row?.text?.includes(mark), `${topic} 에 ${mark}`).toBe(false);
        }
      }

      const daeun = topicOf(utterances, 'now.daeun');
      expect(FRAGMENT_TOPICS['now.daeun'].form).toBeUndefined();
      expect(daeun?.strength).toBe('derived');
      expect(daeun?.text).toContain(STRENGTH_WORDING.derived);
    });

    /**
     * 대운수는 절입까지의 거리를 사흘에 한 살로 셈한 뒤 정수로 만드는데 그 정수화가
     * 계통마다 다르다. 우리가 고른 것을 밝히지 않으면 독자는 답이 하나뿐인 줄 안다 —
     * 조후가 판정하지 않은 조건을 밝히는 것과 같은 의무이고 방향만 반대다.
     */
    it('대운 문장이 고른 계통을 밝힌다', () => {
      for (const saju of [RICH, HOURLESS]) {
        const daeun = topicOf(nowTextOf(saju), 'now.daeun');

        expect(daeun?.text).toContain('반올림');
        expect(daeun?.text).toContain('버림');
      }
    });

    /**
     * 대운만 내려앉는다. 세운의 해와 월운의 달은 시주 두 글자가 바꾸지 않고,
     * 흔들리는 것은 그것들이 원국과 맺는 관계 목록의 전체성이라 목록이 따로 든다.
     */
    it('시간 미상이면 대운만 한 칸 내려앉는다', () => {
      const utterances = nowTextOf(HOURLESS);
      const daeun = topicOf(utterances, 'now.daeun');

      expect(daeun?.strength).toBe('candidate');
      expect(daeun?.text).toContain('시주');

      for (const topic of ['now.saeun', 'now.wolun'] as const) {
        expect(topicOf(utterances, topic)?.strength, topic).toBe('fact');
      }

      // 목록의 한계는 목록이 든다 — 행이 아니라 이 발화가 시주를 부른다.
      expect(topicOf(utterances, 'relation.coverage')?.request.variant).toBe('natal');
      expect(topicOf(nowTextOf(RICH), 'relation.coverage')).toBeUndefined();
    });

    /**
     * 목록의 한계 둘이 성질이 다르다. 어느 대운을 기준으로 골랐는지는 **우리가 고른
     * 것**이라 시각을 다 알아도 서고, 시주는 **입력**이 빠진 것이라 모를 때만 선다.
     * 한 문장으로 묶으면 "시각을 알면 목록이 온전하다"가 조용히 들어온다.
     */
    it('어느 대운을 기준으로 셌는지가 시각과 무관하게 선다', () => {
      for (const saju of [RICH, HOURLESS]) {
        const coverage = topicOf(nowTextOf(saju), 'now.coverage');

        expect(coverage?.strength).toBe('fact');
        expect(coverage?.text).toContain('지금 도는 대운을 기준으로만');
        // 덜어 낸 것이 어디 있는지까지 적는다 — 세지 않은 것과 성질이 다르다.
        expect(coverage?.text).toContain('세운·월운 표에 있습니다');
      }
    });

    /**
     * **고지가 좁아진 것이 채워졌다는 증거다.** 대운 칸이 관계를 들게 되면서 "대운이
     * 낀 관계는 아직 세지 않았다"가 거짓이 됐다 — 지금은 대운 행이 실제로 선다.
     */
    it('대운 관계가 행으로 선다', () => {
      const rows = nowTextOf(RICH).filter(({ request }) => request.topic === 'relation.present');

      expect(rows.some(({ text }) => text?.includes('대운'))).toBe(true);
    });

    it('관계 행은 원국과 같은 주제·같은 조각이고 어느 판인지만 더 든다', () => {
      const rows = nowTextOf(RICH).filter(({ request }) => request.topic === 'relation.present');

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some(({ text }) => text?.includes('세운'))).toBe(true);
      expect(rows.some(({ text }) => text?.includes('월운'))).toBe(true);

      // 같은 조각을 쓴다 — 원국 화면의 행과 키가 같아야 한다.
      const natal = assembleText(RICH).find(({ request }) => request.topic === 'relation.present');
      expect(rows[0].key).toBe(natal?.key);
    });

    /**
     * 첫 대운 전은 **이 사람에 대한 사실**이라 말한다. 표 밖은 우리가 뽑은 칸 수의
     * 한계라 발화 자체가 없다 — 침묵이 아니다. 침묵은 값이 있는데 말하지 않기로 한
     * 것이고, 이쪽은 남의 한계를 사실처럼 말하지 않는 것이다.
     */
    describe('대운을 못 짚을 때', () => {
      const BABY = computeSaju(
        { year: 2024, month: 3, day: 15, hour: 10, minute: 0, second: 0, gender: 'female' },
        {},
      );
      const OLD = computeSaju(
        { year: 1925, month: 3, day: 15, hour: 10, minute: 0, second: 0, gender: 'female' },
        {},
      );

      it('첫 대운 전이면 그렇다고 말한다', () => {
        const pending = topicOf(nowTextOf(BABY), 'now.daeunPending');

        expect(pending?.strength).toBe('derived');
        expect(pending?.text).toContain('아직');
        expect(topicOf(nowTextOf(BABY), 'now.daeun')).toBeUndefined();
      });

      /** "아직 없다"는 대운수가 한 살 어긋나면 그냥 틀린 문장이 된다 */
      it('시간 미상이면 첫 대운 전이라는 말도 입을 닫는다', () => {
        const hourless = computeSaju(
          { year: 2024, month: 3, day: 15, hour: null, gender: 'female' },
          {},
        );
        const pending = topicOf(nowTextOf(hourless), 'now.daeunPending');

        expect(pending?.strength).toBe('silent');
        expect(pending?.text).toBeNull();
      });

      it('표 밖이면 발화 자체가 없다', () => {
        const utterances = nowTextOf(OLD);

        expect(topicOf(utterances, 'now.daeun')).toBeUndefined();
        expect(topicOf(utterances, 'now.daeunPending')).toBeUndefined();
        expect(ASSEMBLE_POLICY.daeunBeyondTable).toBe('no-utterance-not-silence');
      });
    });

    /**
     * 근거 목록은 이 현재운이 낸 것만 담는다. 12운성·12신살은 세운·월운 칸이 계산해
     * 두었지만 주제가 없어 문장이 되지 않으므로 넣지 않는다 — 넉넉히 담으면 대조가
     * 통과할 뿐 아무것도 잡지 못한다.
     */
    it('근거 목록에 말하지 않는 용어를 담지 않는다', () => {
      const now = currentFortuneOf(RICH, VIEWED_AT);
      const grounded = groundedNowTermsOf(now);

      for (const relation of now.relations) expect(grounded).toContain(relation.ko);
      expect(grounded).toContain(TEN_GOD_KO[now.saeun.tenGods.stem]);

      // 12운성 이름은 담지 않는다 — 그것을 말하는 주제가 아직 없다.
      expect(grounded).not.toContain(TWELVE_STAGE_KO[now.saeun.stage]);
    });

    it('현재운 발화는 전부 계약을 지킨다', () => {
      for (const saju of [RICH, HOURLESS, MUTUAL, OFFICER_HOURLESS]) {
        for (const viewedAt of [VIEWED_AT, new Date('2026-01-20T12:00:00+09:00')]) {
          for (const utterance of nowTextOf(saju, viewedAt)) {
            expect(utterance.violations, utterance.key ?? '(silent)').toHaveLength(0);
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

  /**
   * **고지가 엔진을 따라오게 만드는 자물쇠.**
   *
   * `CLAIM_PATHS` 는 이미 `Saju` 의 키에 양방향으로 묶여 있다 — L2 에 필드가
   * 생기면 상한을 정하지 않고는 못 지나간다. 그런데 상한만 정하고 주제를 안
   * 만들면 그 자리는 **아무 데도 안 적힌 채 조용히 침묵했다.** 실제로 격국·오신·
   * 암합·국·합화가 그렇게 지나갔다.
   *
   * 이제 자리마다 둘 중 하나여야 한다 — 읽는 주제가 있거나, 없다고 고지되거나.
   * 새 판정을 화면에 붙이는 일의 진도도 이 목록이 줄어드는 것으로 잰다.
   */
  /**
   * **모집단에서도 계약을 지키는가.**
   *
   * 위 시험들은 손으로 고른 명식 몇 벌만 본다. 그 표본이 안 닿는 자리가 있고,
   * 실제로 격국 문장이 거기서 샜다 — 巳월 庚 일간처럼 투출한 것이 비겁뿐인
   * 자리에서 `{kind}` 슬롯이 안 채워진 채 화면까지 갔다(무작위 3000건의 3.8%).
   * 계약은 그것을 `unfilled-slot` 으로 잡을 줄 알았는데 **아무도 모집단에
   * 물어보지 않았다.**
   *
   * 시간 미상 벌도 함께 돈다. 강등된 조각은 명식이 갖춰졌을 때 한 번도 조회되지
   * 않으므로, 시각 있는 쪽만 돌리면 절반이 그대로 안 보인다.
   */
  it('무작위 모집단의 발화가 모두 계약을 지킨다', () => {
    for (const input of randomInputs(400)) {
      for (const saju of [computeSaju(input), computeSaju(withoutHour(input))]) {
        for (const utterance of assembleText(saju)) {
          expect(utterance.violations, `${JSON.stringify(input)} ${utterance.key}`).toHaveLength(0);
        }
      }
    }
  });

  it('주제가 없는 근거 자리는 빠짐없이 고지된다', () => {
    const read = new Set(Object.values(FRAGMENT_TOPICS).flatMap((topic) => topic.paths));
    const declared = new Set(UNCOVERED_FACTS_BY_PATH.flatMap((entry) => entry.paths));

    expect(CLAIM_PATHS.filter((path) => !read.has(path) && !declared.has(path))).toEqual([]);
  });

  /**
   * 반대 방향. 주제가 생겨 자리를 덮었는데 고지가 남아 있으면 화면이 없는 공백을
   * 계속 말한다 — 그것은 좁아지지 않는 고지의 다른 얼굴이다. 통째로 덮은 자리만
   * 걸리고, 일부만 말하는 자리는 `note` 가 어디까지가 공백인지 적으므로 남는다.
   */
  it('고지된 자리는 실제로 비어 있거나 어디까지가 공백인지 적는다', () => {
    const read = new Set(Object.values(FRAGMENT_TOPICS).flatMap((topic) => topic.paths));

    for (const { paths, note } of UNCOVERED_FACTS_BY_PATH) {
      if (paths.every((path) => !read.has(path))) continue;
      expect(note, paths.join(' · ')).toBeDefined();
    }
  });
});
