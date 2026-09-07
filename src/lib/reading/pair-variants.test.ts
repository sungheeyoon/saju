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

/** 10절만 떼어 본다 — 이 라운드가 재는 자리가 거기 하나다 */
const sectionTen = (assembly = CONTROL) =>
  pairSectionTexts('private', assembly).find((text) => text.startsWith('**10.')) ?? '';

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
const tenthSectionExperiments = experiments.filter(
  (variant) => variant.assembly.eachPersonJudgements !== CONTROL.eachPersonJudgements,
);
const shapeExperiments = experiments.filter(
  (variant) => variant.assembly.pairShape !== CONTROL.pairShape,
);

describe('실험판은 10절에만 선다', () => {
  it('기준판은 10절에 아무 규칙도 안 붙인다', () => {
    expect(sectionTen()).toBe(
      pairSectionTexts('private', CONTROL).find((text) => text.startsWith('**10.')),
    );
    expect(sectionTen()).not.toContain('analysis.');
  });

  it.each(tenthSectionExperiments)('$id — 움직인 절이 10절 하나다', (variant) => {
    const before = pairSectionTexts('private', CONTROL);
    const after = pairSectionTexts('private', variant.assembly);

    expect(after).toHaveLength(before.length);

    const moved = before
      .map((text, at) => (text === after[at] ? null : at))
      .filter((at) => at !== null);

    expect(moved).toHaveLength(1);
    expect(after[moved[0] as number].startsWith('**10.')).toBe(true);
  });

  /**
   * **두 사람 몫을 다 부른다.** 비공개 궁합에는 자료가 두 벌이라, 한쪽만 적으면 한
   * 사람은 시킨 대로 읽히고 다른 사람은 안 읽힌다 — `plain` 승격 때 `now.overlaps`
   * 지시가 두 판 중 한쪽에만 들어가 있던 것과 같은 자리다.
   */
  it.each(tenthSectionExperiments)('$id — `charts.a` 와 `charts.b` 를 모두 짚는다', (variant) => {
    const ten = sectionTen(variant.assembly);

    expect(ten).toContain('charts.a');
    expect(ten).toContain('charts.b');
  });

  /**
   * **없는 경로를 가리키는 규칙이 되면 안 된다.**
   *
   * 지시가 `analysis.X` 를 대면 그 X 는 두 사람 자료에 **실제로 있어야** 한다. 없으면
   * 모델은 그 자리를 지어내거나 「알 수 없다」를 적는데, 둘 다 우리가 시킨 것이 아니다.
   * 엔진이 판정 이름을 바꾸는 날 이 시험이 먼저 말한다 — 손으로 적은 경로는 엔진이
   * 자랄 때 안 따라오지만, 대보는 시험은 따라온다.
   */
  it.each(tenthSectionExperiments)('$id — 대는 경로가 두 사람 자료에 다 있다', (variant) => {
    const named = [...sectionTen(variant.assembly).matchAll(/analysis\.([A-Za-z]+)/g)].map(
      (found) => found[1],
    );

    expect(named.length, '경로를 하나도 안 대는 실험판은 잴 것이 없다').toBeGreaterThan(0);

    const { evidence } = pairEvidence('private');
    const charts = (evidence as unknown as { charts: Record<string, Record<string, unknown>> })
      .charts;

    for (const who of ['a', 'b']) {
      const analysis = charts[who].analysis as Record<string, unknown>;

      for (const key of named) {
        expect(analysis[key], `charts.${who}.analysis.${key}`).toBeDefined();
      }
    }
  });

  /**
   * **판정 이름을 부르지 않는다.** 「억부」·「종격」으로 적으면 그 낱말이 본문으로 샌다.
   * 지금 기준판은 분류명을 아예 안 부르는 판(`plain`)이라 더 그렇다 — 경로만 대고 뜻은
   * 사람 말로 적는다.
   */
  it.each(tenthSectionExperiments)('$id — 판정 이름을 본문에 안 들인다', (variant) => {
    const ten = sectionTen(variant.assembly);

    for (const name of ['억부', '조후', '종격', '격국', '통관', '신강', '신약', '십성']) {
      expect(ten, name).not.toContain(name);
    }
  });

  /** 1~9절과 11절은 한 글자도 안 바뀐다 — `changes` 가 그렇게 적고 있다 */
  it.each(tenthSectionExperiments)('$id — 나머지 절은 그대로다', (variant) => {
    const before = pairSectionTexts('private', CONTROL);
    const after = pairSectionTexts('private', variant.assembly);

    for (let at = 0; at < before.length; at += 1) {
      if (before[at].startsWith('**10.')) continue;

      expect(after[at], before[at].slice(0, 12)).toBe(before[at]);
    }
  });

  /** 공유 궁합은 이 축이 닿지 않는다 — 절 목록에 10절 자체가 없다 */
  it.each(experiments)('$id — 공유 궁합 프롬프트는 이 축으로 안 움직인다', (variant) => {
    expect(promptOf(variant.id, 'match')).toBe(promptOf('control', 'match'));
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

/**
 * **절을 걷어낸 판이 무엇을 놓고 무엇을 쥐고 있는가.**
 *
 * 이 판의 위험은 「너무 많이 놓는 것」이다. 구성과 해석을 넘기면서 근거·경계·말투까지
 * 함께 흘리면, 그것은 자율성이 아니라 **우리가 책임질 것을 모델에게 떠넘긴 것**이다.
 * 여기서 잠그는 것은 그 선이다 — 놓은 것과 쥔 것을 둘 다 값으로 센다.
 */
describe('절을 걷는 판은 구성만 놓는다', () => {
  it.each(shapeExperiments)('$id — 우리가 정한 절이 하나도 안 남는다', (variant) => {
    const prompt = promptOf(variant.id);

    expect(pairSectionTexts('private', variant.assembly)).toEqual([]);

    /* 절 번호가 남으면 목록이 그대로 절이 된다 — 이름만 바뀐 같은 글이 나온다 */
    for (const gone of ['**1. ', '**4. ', '**10. ', '**11. ']) {
      expect(prompt, gone).not.toContain(gone);
    }
  });

  /**
   * **「성격을 읽는 순서」도 함께 내려간다.** 절만 걷고 이 문단을 남기면 「해석은 네가
   * 하라」면서 읽는 순서는 시키는 꼴이라, 그 판이 재려던 것이 반쯤만 재어진다.
   */
  it.each(shapeExperiments)('$id — 성격 읽는 순서를 안 시킨다', (variant) => {
    expect(promptOf(variant.id)).not.toContain('## 성격을 읽는 순서');
    expect(promptOf('control')).toContain('## 성격을 읽는 순서');
  });

  it.each(shapeExperiments)('$id — 다룰 것 일곱을 다 든다', (variant) => {
    const prompt = promptOf(variant.id);

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
   * 판」이 아니라 **아무것도 안 시킨 판**이고, 그 둘을 견주는 것은 이 라운드가 묻는
   * 물음이 아니다.
   */
  it.each(shapeExperiments)('$id — 근거·경계·말투는 그대로 쥔다', (variant) => {
    const prompt = promptOf(variant.id);

    for (const kept of [
      '## 이 자료가 무엇인가',
      '## 사실에 관한 단 하나의 금지',
      '## 근거의 층',
      '## 얼마나 세게 말할까',
      '## 고객에게 말하는 말투',
      '## 본문 규칙',
      '## 이름 대신 그 이름이 가리키는 것을 쓴다',
      '## 두 사람을 부르는 말',
    ]) {
      expect(prompt, kept).toContain(kept);
    }

    /* 분량과 점수는 절이 아니라 계약이다 — 구조를 놔도 남는다 */
    expect(prompt).toContain('사용자 본문은 3500~5500자');
    expect(prompt).toContain('점수');
    /* 맨 끝 검사용 근거 절 — 이것이 없으면 경로 검사가 본문 전체를 재게 된다 */
    expect(prompt).toContain(PROMPT_PARTS.closing);
  });

  /** 공유 궁합은 동의 범위가 좁아 다룰 것의 목록 자체가 다르다 — 안 닿는다(ADR 0012) */
  it.each(shapeExperiments)('$id — 공유 궁합은 그대로다', (variant) => {
    expect(promptOf(variant.id, 'match')).toBe(promptOf('control', 'match'));
  });
});
