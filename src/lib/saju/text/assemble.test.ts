import { describe, expect, it } from 'vitest';

import { computeSaju, type Saju } from '@/src/lib/saju';
import { ELEMENT_ROLE_KO, TEN_GOD_KO } from '@/src/lib/saju/analysis';
import { analyzeCompatibility } from '@/src/lib/saju/compat';
import { currentFortuneOf } from '@/src/lib/saju/now';
import { TWELVE_STAGE_KO } from '@/src/lib/saju/stages';
import {
  ASSEMBLE_POLICY,
  FRAGMENT_TOPICS,
  MYEONGRI_LEXICON,
  FRAGMENT_INDEX,
  STRENGTH_WORDING,
  assembleCompatText,
  assembleNowText,
  assembleText,
  findUtterances,
  groundedCompatTermsOf,
  groundedNowTermsOf,
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
     * **관계 행이 `fact` 로 남는 근거다.**
     *
     * 시주가 빠져도 여섯 글자에서 난 관계는 그대로 성립한다 — 흔들리는 것은
     * 항목이 아니라 목록의 전체성이고, 그것을 항목마다 나눠 지우면 관측된 사실을
     * 의심하는 것처럼 읽힌다(`INCOMPLETE_INPUT_RULE`).
     *
     * 그 전제를 480 쌍으로 세어 확인한다. 사라지는 것은 **절입일 명식뿐**인데
     * 그때는 월주가 통째로 바뀐 다른 명식이고, 그 불확실성은 관계만의 것이 아니라
     * 강약·조후까지 걸리므로 `meta.warnings` 가 든다.
     */
    it('시주가 붙어도 여섯 글자에서 난 관계는 사라지지 않는다', () => {
      const keysOf = (saju: Saju) =>
        saju.relations.map((r) => `${r.ko}@${r.participants.map((p) => p.position).join(',')}`);

      let checked = 0;
      const lost: string[] = [];

      for (let year = 1985; year <= 1994; year += 1) {
        for (let month = 1; month <= 12; month += 1) {
          const day = 3 + ((year + month) % 25);
          const hourless = male(year, month, day, null);

          // 절입일이면 시각에 따라 월주가 통째로 갈린다 — 다른 명식이 되는 것이라
          // "관계가 사라졌다"고 셀 수 없다. 그 경우는 경고가 이미 든다.
          if (hourless.meta.warnings.some((warning) => warning.includes('절입일'))) continue;

          const six = new Set(keysOf(hourless));

          for (const hour of [1, 7, 13, 19]) {
            const eight = new Set(keysOf(male(year, month, day, hour)));
            checked += 1;

            for (const key of six) {
              if (!eight.has(key)) lost.push(`${year}-${month}-${day} ${hour}시 · ${key}`);
            }
          }
        }
      }

      expect(checked).toBeGreaterThan(400);
      expect(lost).toEqual([]);
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
     * 목록의 한계 둘이 성질이 다르다. 대운 관계는 **우리 구현**이 못 센 것이라 시각을
     * 다 알아도 서고, 시주는 **입력**이 빠진 것이라 모를 때만 선다. 한 문장으로 묶으면
     * "시각을 알면 목록이 온전하다"가 조용히 들어온다.
     */
    it('대운 관계를 세지 않았다는 고지는 시각과 무관하게 선다', () => {
      for (const saju of [RICH, HOURLESS]) {
        const coverage = topicOf(nowTextOf(saju), 'now.coverage');

        expect(coverage?.strength).toBe('fact');
        expect(coverage?.text).toContain('대운');
      }
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
});
