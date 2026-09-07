import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
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

describe('P1 은 10절에만 선다', () => {
  it('기준판(P0)은 10절에서 서열을 안 부른다', () => {
    expect(sectionTen()).not.toContain('precedence');
  });

  it('P1 은 10절 안에서만 그 문단을 든다', () => {
    const before = pairSectionTexts('private', CONTROL);
    const after = pairSectionTexts(
      'private',
      { ...CONTROL, eachPersonJudgements: 'precedence-v1' },
    );

    expect(after).toHaveLength(before.length);

    const moved = before.map((text, at) => (text === after[at] ? null : at)).filter((at) => at !== null);

    // 절 하나만 움직인다 — 그 하나가 10절이다.
    expect(moved).toHaveLength(1);
    expect(after[moved[0] as number].startsWith('**10.')).toBe(true);
  });

  /**
   * **두 사람 몫을 다 부른다.** 비공개 궁합에는 `precedence` 가 두 벌이라, 한쪽만 적으면
   * 한 사람은 서열대로 읽히고 다른 사람은 안 읽힌다 — `plain` 승격 때 `now.overlaps`
   * 지시가 두 판 중 한쪽에만 들어가 있던 것과 같은 자리다.
   */
  it('a 와 b 의 경로를 모두 적는다', () => {
    const ten = sectionTen({ ...CONTROL, eachPersonJudgements: 'precedence-v1' });

    expect(ten).toContain('charts.a.analysis.precedence');
    expect(ten).toContain('charts.b.analysis.precedence');
  });

  /**
   * **판정 이름을 부르지 않는다.** 「억부」·「종격」으로 적으면 그 낱말이 본문으로 샌다.
   * 지금 기준판은 분류명을 아예 안 부르는 판(`plain`)이라 더 그렇다.
   */
  it('판정 이름을 본문에 안 들인다', () => {
    const ten = sectionTen({ ...CONTROL, eachPersonJudgements: 'precedence-v1' });

    for (const name of ['억부', '조후', '종격', '격국', '통관']) {
      expect(ten, name).not.toContain(name);
    }
  });

  /** 1~9절과 11절은 한 글자도 안 바뀐다 — `changes` 가 그렇게 적고 있다 */
  it('나머지 절은 그대로다', () => {
    const before = pairSectionTexts('private', CONTROL);
    const after = pairSectionTexts(
      'private',
      { ...CONTROL, eachPersonJudgements: 'precedence-v1' },
    );

    for (let at = 0; at < before.length; at += 1) {
      if (before[at].startsWith('**10.')) continue;

      expect(after[at], before[at].slice(0, 12)).toBe(before[at]);
    }
  });

  /** 공유 궁합은 이 축이 닿지 않는다 — 절 목록에 10절 자체가 없다 */
  it('공유 궁합 프롬프트는 이 축으로 안 움직인다', () => {
    expect(promptOf('pair-precedence-v1', 'match')).toBe(promptOf('control', 'match'));
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
