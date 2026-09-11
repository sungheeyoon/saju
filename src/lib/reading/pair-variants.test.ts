import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import { PROMPT_PARTS } from './parts';
import {
  CONTROL,
  PAIR_VARIANTS,
  READING_POLICY,
  pairSectionTexts,
  readingEvidenceOf,
  readingPromptOf,
  type PairVariant,
} from '.';

const VIEWED_AT = new Date('2026-08-26T04:00:00Z');

const chart = () =>
  computeSaju({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male' });
const other = () =>
  computeSaju({ year: 1992, month: 8, day: 20, hour: 9, minute: 0, second: 0, gender: 'female' });

const pairEvidence = (kind: 'private' | 'match') =>
  readingEvidenceOf(kind, { a: chart(), b: other() }, VIEWED_AT);

const promptOf = (id: PairVariant['id'], kind: 'private' | 'match' = 'private') => {
  const found = PAIR_VARIANTS.find((variant) => variant.id === id);
  if (found === undefined) throw new Error(`없는 변형: ${id}`);
  return readingPromptOf(pairEvidence(kind), found.assembly);
};

/**
 * **값은 실렸는데 읽으라는 줄이 없었다** — 이 라운드가 손대는 자리를 값으로 못박는다.
 *
 * 비공개 궁합은 두 사람 판정을 통째로 싣고 거기에 `precedence` 도 있다. 그런데
 * `JUDGEMENT_PRECEDENCE` 는 `solo` 일 때만 붙어서, private 은 **값을 치르면서 그것을
 * 읽으라는 규칙만 잃은 채로** 남아 있었다. 그 상태가 지금 기준판이고, 여기서 잠그는
 * 것은 「기준판이 그렇다」는 사실 자체다 — 고쳐졌는지는 실호출이 답한다.
 */
describe('비공개 궁합은 서열 값을 싣는다', () => {
  it('두 사람 몫의 precedence 가 자료에 실린다', () => {
    const { evidence } = pairEvidence('private');
    const charts = (evidence as unknown as { charts: Record<string, Record<string, unknown>> })
      .charts;

    for (const who of ['a', 'b']) {
      const analysis = charts[who].analysis as Record<string, unknown>;

      expect(analysis.precedence, who).toBeDefined();
    }
  });

  /** 공유 궁합은 `analysis` 가 통째로 빠진다 — 없는 경로를 가리키는 규칙이 되면 안 된다 */
  it('공유 궁합에는 그 값이 없다', () => {
    const { evidence } = pairEvidence('match');
    const charts = (evidence as unknown as { charts: Record<string, Record<string, unknown>> })
      .charts;

    expect(charts.a.analysis).toBeUndefined();
  });
});

/** 기준판 아닌 판들 — 목록을 손으로 옮겨 적지 않는다 */
const experiments = PAIR_VARIANTS.filter((variant) => variant.id !== 'control');

/**
 * **축마다 재는 자가 다르다.**
 *
 * 10절을 고치는 판(`eachPersonJudgements`)과 절을 통째로 걷는 판(`pairShape`)은 서로
 * 다른 것을 지켜야 한다 — 앞엣것은 「10절만 움직였나」이고 뒤엣것은 애초에 10절이 없다.
 * 한 자로 재려 들면 둘 중 하나는 틀린 것을 재게 된다.
 */
const shapeExperiments = experiments.filter(
  (variant) => variant.assembly.pairShape !== CONTROL.pairShape,
);

/**
 * **규칙 1을 궁합 쪽에서도 시험이 센다.**
 *
 * 자기 풀이 쪽 자(`selfSectionTexts`)만 있는 동안 궁합 변형은 절 단위로 세어지지
 * 않았다. 조립 칸으로만 세면 한 칸이 절 여럿을 다시 쓰는 변형이 「한 곳만 바꿨다」로
 * 통과한다 — `terminology` 한 칸이 절 여섯을 옮긴 전례가 있다.
 */
describe('궁합 변형도 한 곳만 벗어난다', () => {
  const changedKeys = (variant: PairVariant) =>
    (Object.keys(CONTROL) as (keyof typeof CONTROL)[]).filter(
      (key) => JSON.stringify(variant.assembly[key]) !== JSON.stringify(CONTROL[key]),
    );

  const changedSections = (variant: PairVariant) => {
    const before = pairSectionTexts('private', CONTROL);
    const after = pairSectionTexts('private', variant.assembly);
    const longer = Math.max(before.length, after.length);

    return Array.from({ length: longer }, (_, at) => at).filter((at) => before[at] !== after[at])
      .length;
  };

  const changedPlaces = (variant: PairVariant) =>
    Math.max(changedKeys(variant).length, changedSections(variant));

  it('첫 자리가 기준판이고 실제로 보내는 것과 같다', () => {
    const [first] = PAIR_VARIANTS;

    expect(first.id).toBe('control');
    expect(first.assembly).toBe(CONTROL);
    expect(promptOf('control')).toBe(readingPromptOf(pairEvidence('private')));
  });

  it('실험 id 가 저장되는 판본 이름을 사칭하지 않는다', () => {
    for (const variant of PAIR_VARIANTS) {
      expect(variant.id).not.toBe(READING_POLICY.version);
    }
  });

  it('둘 이상 바꾼 변형은 무엇이 함께 움직였는지 적는다', () => {
    for (const variant of PAIR_VARIANTS) {
      if (changedPlaces(variant) <= 1) continue;

      expect(
        variant.confounded,
        `${variant.id} — 칸 ${changedKeys(variant).join('·') || '없음'} · 절 ${changedSections(variant)}개`,
      ).not.toBeNull();
    }
  });

  it('한 곳만 바꾼 변형은 뒤섞였다고 적지 않는다', () => {
    for (const variant of PAIR_VARIANTS) {
      if (changedPlaces(variant) > 1) continue;

      expect(variant.confounded, variant.id).toBeNull();
    }
  });

  it('기준판 아닌 변형은 반드시 무언가를 바꾼다', () => {
    for (const variant of PAIR_VARIANTS) {
      if (variant.id === 'control') continue;

      expect(changedKeys(variant).length, variant.id).toBeGreaterThan(0);
    }
  });

  /** 같은 자료 위에 서야 견줄 수 있다 — 근거 JSON 은 한 번 지어 나눠 쓴다 */
  it('변형마다 같은 근거 JSON 을 정확히 한 번 싣는다', () => {
    const one = pairEvidence('private');
    const payload = JSON.stringify(one.evidence);

    for (const variant of PAIR_VARIANTS) {
      expect(readingPromptOf(one, variant.assembly).split(payload), variant.id).toHaveLength(2);
    }
  });
});

/**
 * **기준판이 무엇을 놓고 무엇을 쥐고 있는가.**
 *
 * 절을 걷은 판이 기준판이 됐다. 이 판의 위험은 「너무 많이 놓는 것」이다 — 구성과
 * 해석을 넘기면서 근거·경계·말투까지 함께 흘리면 그것은 자율성이 아니라 **우리가
 * 책임질 것을 떠넘긴 것**이다. 여기서 잠그는 것은 그 선이고, 놓은 것과 쥔 것을 둘 다
 * 값으로 센다.
 */
describe('기준판은 구성만 놓는다', () => {
  it('우리가 정한 절이 하나도 안 남는다', () => {
    const prompt = promptOf('control');

    expect(pairSectionTexts('private', CONTROL)).toEqual([]);

    /* 절 번호가 남으면 다룰 것의 목록이 그대로 절이 된다 — 이름만 바뀐 같은 글이 나온다 */
    for (const gone of ['**1. ', '**4. ', '**10. ', '**11. ']) {
      expect(prompt, gone).not.toContain(gone);
    }
  });

  /**
   * **「성격을 읽는 순서」도 함께 내려갔다.** 절만 걷고 그 문단을 남기면 「해석은 네가
   * 하라」면서 읽는 순서는 시키는 꼴이라, 이 판이 재려던 것이 반쯤만 재어진다.
   */
  it('성격 읽는 순서를 안 시킨다', () => {
    expect(promptOf('control')).not.toContain('## 성격을 읽는 순서');
    expect(promptOf('pair-sections-v1')).toContain('## 성격을 읽는 순서');
  });

  it('다룰 것 일곱을 다 든다', () => {
    const prompt = promptOf('control');

    for (const need of [
      '두 사람이 서로에게 어떤 사람인가',
      '어디가 맞고 어디서 부딪히는가',
      '서로 채워 주는 것과, 둘이 있어야 생기는 것',
      '실제 생활에서 반복될 장면',
      '오래 가려면 무엇이 필요한가',
      '각자가 가까운 사이에서 어떤 사람인가',
      '지금이 이 관계에 어떤 시기인가',
    ]) {
      expect(prompt, need).toContain(need);
    }
  });

  /**
   * **놓지 않은 것** — 근거·경계·말투·용어·분량·점수·근거 칸.
   *
   * 이것이 이 판의 계약이다. 하나라도 함께 흘러 나가면 그때 나오는 글은 「자율성을 준
   * 판」이 아니라 **아무것도 안 시킨 판**이다.
   *
   * 강도(`claimStrength`)가 특히 그렇다 — 한동안 「성격을 읽는 순서」와 한 문자열에
   * 살아서 구성을 내리는 판이 **경계까지 함께 내리고 있었다.** 갈라 둔 뒤로 이 줄이
   * 그것을 잰다.
   */
  it('근거·경계·말투는 그대로 쥔다', () => {
    const prompt = promptOf('control');

    for (const kept of [
      '## 이 자료가 무엇인가',
      '## 사실에 관한 단 하나의 금지',
      '## 근거의 층',
      '## 얼마나 세게 말할까',
      '## 고객에게 말하는 말투',
      '## 본문 규칙',
      '## 이름 대신 그 이름이 가리키는 것을 쓴다',
      '## 두 사람을 부르는 말',
      '## 한마디로 빗대면',
    ]) {
      expect(prompt, kept).toContain(kept);
    }

    /* 분량과 점수는 절이 아니라 계약이다 — 구조를 놔도 남는다 */
    expect(prompt).toContain('사용자 본문은 3500~5500자');
    expect(prompt).toContain('점수');
    /* 맨 끝 검사용 근거 절 — 이것이 없으면 경로 검사가 본문 전체를 재게 된다 */
    expect(prompt).toContain(PROMPT_PARTS.closing);
  });

  /** 공유 궁합도 같은 구성 원칙을 쓰되, 동의 범위 안의 물음만 둔다. */
  it.each(shapeExperiments)('$id — 공유 궁합도 같은 구성 축을 따른다', (variant) => {
    expect(promptOf(variant.id, 'match')).not.toBe(promptOf('control', 'match'));
  });
});

/**
 * **규칙 1을 궁합 쪽에서도 시험이 센다.**
 *
 * 자기 풀이 쪽 자(`selfSectionTexts`)만 있는 동안 궁합 변형은 절 단위로 세어지지
 * 않았다. 조립 칸으로만 세면 한 칸이 절 여럿을 다시 쓰는 변형이 「한 곳만 바꿨다」로
 * 통과한다 — `terminology` 한 칸이 절 여섯을 옮긴 전례가 있다.
 */
describe('궁합 변형도 한 곳만 벗어난다', () => {
  const changedKeys = (variant: PairVariant) =>
    (Object.keys(CONTROL) as (keyof typeof CONTROL)[]).filter(
      (key) => JSON.stringify(variant.assembly[key]) !== JSON.stringify(CONTROL[key]),
    );

  const changedSections = (variant: PairVariant) => {
    const before = pairSectionTexts('private', CONTROL);
    const after = pairSectionTexts('private', variant.assembly);
    const longer = Math.max(before.length, after.length);

    return Array.from({ length: longer }, (_, at) => at).filter((at) => before[at] !== after[at])
      .length;
  };

  const changedPlaces = (variant: PairVariant) =>
    Math.max(changedKeys(variant).length, changedSections(variant));

  it('첫 자리가 기준판이고 실제로 보내는 것과 같다', () => {
    const [first] = PAIR_VARIANTS;

    expect(first.id).toBe('control');
    expect(first.assembly).toBe(CONTROL);
    expect(promptOf('control')).toBe(readingPromptOf(pairEvidence('private')));
  });

  it('실험 id 가 저장되는 판본 이름을 사칭하지 않는다', () => {
    for (const variant of PAIR_VARIANTS) {
      expect(variant.id).not.toBe(READING_POLICY.version);
    }
  });

  it('둘 이상 바꾼 변형은 무엇이 함께 움직였는지 적는다', () => {
    for (const variant of PAIR_VARIANTS) {
      if (changedPlaces(variant) <= 1) continue;

      expect(
        variant.confounded,
        `${variant.id} — 칸 ${changedKeys(variant).join('·') || '없음'} · 절 ${changedSections(variant)}개`,
      ).not.toBeNull();
    }
  });

  it('한 곳만 바꾼 변형은 뒤섞였다고 적지 않는다', () => {
    for (const variant of PAIR_VARIANTS) {
      if (changedPlaces(variant) > 1) continue;

      expect(variant.confounded, variant.id).toBeNull();
    }
  });

  it('기준판 아닌 변형은 반드시 무언가를 바꾼다', () => {
    for (const variant of PAIR_VARIANTS) {
      if (variant.id === 'control') continue;

      expect(changedKeys(variant).length, variant.id).toBeGreaterThan(0);
    }
  });

  /** 같은 자료 위에 서야 견줄 수 있다 — 근거 JSON 은 한 번 지어 나눠 쓴다 */
  it('변형마다 같은 근거 JSON 을 정확히 한 번 싣는다', () => {
    const one = pairEvidence('private');
    const payload = JSON.stringify(one.evidence);

    for (const variant of PAIR_VARIANTS) {
      expect(readingPromptOf(one, variant.assembly).split(payload), variant.id).toHaveLength(2);
    }
  });
});
