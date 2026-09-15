import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import { redactEvidence } from '../saju/evidence/redacted';
import { evidenceOf } from '../saju/evidence';
import { RELATION_FROM_MATCH, relationSentence } from '../people';
import { guideFor, MATCH_READING_GUIDE } from './match-reading-guide';
import {
  COMPARED_MATCH_INPUTS,
  CONTROL,
  LEGACY_PAIR_ASSEMBLY,
  MATCH_INPUT_VARIANTS,
  NOTHING_KNOWN,
  READING_PROMPTS,
  readingEvidenceOf,
  readingPromptOf,
} from '.';

/**
 * 인연 궁합 입력 두 판 — **자료·요약·지시가 같은 범위를 말하는가**(ADR 0067).
 *
 * 자료만 재면 점수표가 없는 근거를 가리켜도 초록이고, 지시만 재면 자료가 몰래 넓어져도
 * 초록이다. 같은 짝을 두 판으로 지어 셋을 한자리에서 맞춘다.
 */

const VIEWED_AT = new Date('2026-08-23T04:00:00Z');
const A = computeSaju({ year: 1988, month: 2, day: 4, hour: 23, minute: 30, second: 0, gender: 'male' });
const B = computeSaju({ year: 1994, month: 8, day: 9, hour: 7, minute: 0, second: 0, gender: 'female' });

const built = MATCH_INPUT_VARIANTS.filter((variant) => variant.round === 1).map((variant) => {
  const reading = readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT, variant.assembly.matchInput);
  if (reading.kind !== 'match') throw new Error('인연 궁합이 아니다');
  const prompt = readingPromptOf(reading, variant.assembly);
  const json = JSON.stringify(reading.evidence);
  const [head] = prompt.split('\n## 자료 (');
  return { variant, reading, prompt, json, head };
});

const blockOf = (text: string, heading: string) => {
  const start = text.indexOf(heading);
  expect(start, heading).toBeGreaterThan(-1);
  return text.slice(start, text.indexOf('\n## ', start + 1));
};

describe('두 판이 제각기 앞뒤가 맞는다', () => {
  it('변형 목록은 두 판을 다 들고, 조립은 `matchInput` 한 칸만 다르다', () => {
    const round3 = MATCH_INPUT_VARIANTS.filter((variant) => variant.round === 3);
    expect(round3.map((variant) => variant.assembly.matchInput)).toEqual(['limited-v1', 'limited-v1']);
    expect({ ...round3[1].assembly, pairWriting: round3[0].assembly.pairWriting }).toEqual(round3[0].assembly);

    for (const round of [1, 2] as const) {
      const pair = MATCH_INPUT_VARIANTS.filter((variant) => variant.round === round);
      expect(pair.map((variant) => variant.assembly.matchInput), `라운드 ${round}`).toEqual([...COMPARED_MATCH_INPUTS]);
      expect({ ...pair[1].assembly, matchInput: pair[0].assembly.matchInput }).toEqual(pair[0].assembly);
    }

    const [limited, extended] = MATCH_INPUT_VARIANTS;
    expect({ ...extended.assembly, matchInput: limited.assembly.matchInput }).toEqual(limited.assembly);
    expect(limited.assembly).toEqual({ ...CONTROL, matchInput: 'limited-v1', pairReading: 'plain-v1', pairWriting: 'direct-v1' });
  });

  it.each(built)('$variant.id — 점수표와 절이 가리키는 억부 근거가 자료에 있을 때만 선다', ({ json, head }) => {
    const carried = json.includes('"eokbuMatch"');
    expect(head.includes('eokbuMatch')).toBe(carried);
    expect(head.includes('용신을 상대가 가졌다')).toBe(carried);
  });

  it.each(built)('$variant.id — 점수표가 가리키는 자료 이름은 전부 자료에 있다', ({ json, head }) => {
    const rows = blockOf(head, '## 점수').split('\n').filter((line) => line.startsWith('| '));
    const names = rows.flatMap((row) => [...row.matchAll(/`([A-Za-z.]+)`/g)].map((match) => match[1]));

    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      for (const key of name.split('.')) expect(json, name).toContain(`"${key}"`);
    }
  });

  it.each(built)('$variant.id — 범위 절이 실린 판정을 제대로 말한다', ({ variant, head }) => {
    const scope = blockOf(head, '## 이 자료의 범위');

    expect(scope).toContain('이 글은 두 사람 사이에 대한 글이다');
    if (variant.assembly.matchInput === 'extended-v1') {
      expect(scope).toContain('신강신약·억부 후보·');
      expect(scope).toContain('사이를 설명하는 근거로만');
    } else {
      expect(scope).toContain('각자의 원국 하나에 대한 판정은');
      expect(scope).not.toContain('억부');
    }
  });

  /** 요약의 쟁합 줄은 자료의 쟁합과 같은 수다 — 요약이 자료보다 넓거나 좁지 않다 */
  it.each(built)('$variant.id — 자리 목록의 관계 줄과 쟁합은 자료와 같다', ({ reading, head }) => {
    const facts = blockOf(head, '## 자리가 붙은 사실');
    const lines = facts.split('\n').filter((line) => line.startsWith('- '));
    const { relations } = reading.evidence.compatibility;

    expect(lines).toHaveLength(relations.length);
    const rivalsInJson = relations.flatMap((relation) => relation.contested.flatMap((c) => c.rivals)).length;
    const rivalsInFacts = lines
      .flatMap((line) => [...line.matchAll(/쟁합: [^)/]+? 을 ([^)/]+?) 도 함께 문다/g)])
      .flatMap((match) => match[1].split(' · ')).length;
    expect(rivalsInFacts).toBe(rivalsInJson);
    expect(facts).not.toContain('신살\n');
  });

  it.each(built)('$variant.id — 한눈에는 자료에 없는 절입·사주년을 안 적는다', ({ head }) => {
    const summary = blockOf(head, '## 한눈에');
    expect(summary).not.toContain('절입');
    expect(summary).not.toContain('사주년');
    expect(summary).toContain('일간');
  });

  it('제한형 요약에는 원국 안 경쟁자가 없고, 확장형에는 있다', () => {
    const [limited, extended] = built;
    expect(blockOf(limited.head, '## 자리가 붙은 사실')).not.toContain('B 월간 壬 을 B 일간 丁');
    expect(blockOf(extended.head, '## 자리가 붙은 사실')).toContain('B 월간 壬 을 B 일간 丁');
  });

  it('자료와 지시의 판이 어긋나면 짓지 않는다', () => {
    const [limited, extended] = built;
    expect(() => readingPromptOf(limited.reading, extended.variant.assembly)).toThrow('판이 다르다');
    expect(() => readingPromptOf(extended.reading, limited.variant.assembly)).toThrow('판이 다르다');
  });

  it('두 판의 기준점은 같다', () => {
    const [limited, extended] = built;
    expect(limited.reading.baseline).toBe(extended.reading.baseline);
  });
});

/**
 * **운영은 제한형 A 와 읽는 법 4판이다**(2026-09-15). 옛 컷은 원복용 조립으로 그대로 재현된다.
 */
describe('운영 기본값은 제한형 A 와 읽는 법 4판이다', () => {
  const reading = readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT);
  if (reading.kind !== 'match') throw new Error('인연 궁합이 아니다');
  const legacy = readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT, 'legacy-v0');
  if (legacy.kind !== 'match') throw new Error('인연 궁합이 아니다');

  it('기본 자료는 제한형 A 다 — 옛 컷은 이름으로 불러야 나온다', () => {
    const full = redactEvidence(evidenceOf({ a: A, b: B }, VIEWED_AT));
    expect(CONTROL.matchInput).toBe('limited-v1');
    expect(CONTROL.pairReading).toBe('guide-v4');
    expect(reading.evidence.contract.matchInput).toBe('limited-v1');
    expect(legacy.evidence.contract.matchInput).toBeUndefined();
    expect(legacy.evidence.compatibility).toEqual(full.compatibility);
  });

  it('기본 지시는 4판이고, 원복 조립은 옛 범위 문장과 용신 줄을 그대로 든다', () => {
    expect(readingPromptOf(reading)).toBe(readingPromptOf(reading, CONTROL));
    expect(READING_PROMPTS.match).toContain('## 글을 나누는 법');
    expect(READING_PROMPTS.match).not.toContain('용신을 상대가 가졌다');

    const old = readingPromptOf(legacy, LEGACY_PAIR_ASSEMBLY);
    expect(old).toContain('두 원국\n사이의 사실은 있지만 각자의 원국 하나에 대한 판정은 없다');
    expect(old).toContain('용신을 상대가 가졌다');
    expect(old).not.toContain('## 글을 나누는 법');
  });

  it('판이 다른 자료와 지시를 붙이면 멈춘다', () => {
    expect(() => readingPromptOf(legacy, CONTROL)).toThrow('판이 다르다');
    expect(() => readingPromptOf(reading, LEGACY_PAIR_ASSEMBLY)).toThrow('판이 다르다');
  });
});

/** 견주는 실험은 사이를 연인으로 고정한다 — 넘기면 지시에 실리고, 안 넘기면 운영 문장이다 */
describe('인연 궁합의 사이', () => {
  const [limited] = built;

  it('사이를 넘기면 그 문장이 선다', () => {
    const prompt = readingPromptOf(limited.reading, limited.variant.assembly, { names: null, relation: 'partner' });
    expect(prompt).toContain(relationSentence('partner'));
    expect(prompt).not.toContain(RELATION_FROM_MATCH);
  });

  it('안 넘기면 성립 방식 문장 그대로다', () => {
    expect(readingPromptOf(limited.reading, limited.variant.assembly, NOTHING_KNOWN)).toContain(RELATION_FROM_MATCH);
  });
});

describe('다른 kind 는 그대로다', () => {
  it('비공개 궁합 자료는 여전히 두 원국을 통째로 든다', () => {
    const reading = readingEvidenceOf('private', { a: A, b: B }, VIEWED_AT, 'limited-v1');
    const full = redactEvidence(evidenceOf({ a: A, b: B }, VIEWED_AT));

    expect(reading.evidence).toEqual(full);
    expect(READING_PROMPTS.private).toContain('용신을 상대가 가졌다');
    expect(READING_PROMPTS.private).not.toContain('## 이 자료의 범위');
  });

  it('자기 풀이 자료도 판 인자와 무관하다', () => {
    const one = readingEvidenceOf('self', { a: A }, VIEWED_AT, 'extended-v1');
    const two = readingEvidenceOf('self', { a: A }, VIEWED_AT, 'limited-v1');
    expect(one).toEqual(two);
  });
});

/** 자료 JSON 의 경로 이름 — 두 사람 자리(`a`·`b`)는 `*` 로 접는다 */
const pathsOf = (value: unknown): Set<string> => {
  const out = new Set<string>();
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) return node.forEach((item) => walk(item, `${path}[]`));
    if (node !== null && typeof node === 'object') {
      for (const [key, inner] of Object.entries(node)) {
        const segment = /^(a|b)$/.test(key) && /(charts|elementSupport|eokbuMatch)$/.test(path) ? '*' : key;
        const next = path === '' ? segment : `${path}.${segment}`;
        out.add(next);
        walk(inner, next);
      }
    }
  };
  walk(JSON.parse(JSON.stringify(value)), '');
  return out;
};

/**
 * **2라운드 — 읽는 법.** 경로마다 뜻을 적었으면 그 경로가 그 판의 JSON 에 실제로 있어야 하고, 판에 있는
 * 비교 핵심 경로는 빠짐없이 설명돼야 한다. 1라운드와 운영은 한 글자도 안 바뀐다.
 */
describe('읽는 법 (2라운드)', () => {
  const round2 = MATCH_INPUT_VARIANTS.filter((variant) => variant.round === 2).map((variant) => {
    const reading = readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT, variant.assembly.matchInput);
    if (reading.kind !== 'match') throw new Error('인연 궁합이 아니다');
    const [head] = readingPromptOf(reading, variant.assembly).split('\n## 자료 (');
    return { variant, paths: pathsOf(reading.evidence), head };
  });

  it.each(round2)('$variant.id — 설명한 경로는 전부 이 판의 자료에 있다', ({ variant, paths, head }) => {
    const guide = guideFor(variant.assembly.matchInput);
    expect(guide.length).toBeGreaterThan(0);
    for (const entry of guide) {
      expect(paths.has(entry.path), entry.path).toBe(true);
      expect(head).toContain(`\`${entry.path}\``);
    }
  });

  it.each(round2)('$variant.id — 이 판에 없는 경로는 설명하지 않는다', ({ variant, paths, head }) => {
    for (const entry of MATCH_READING_GUIDE.filter((one) => !one.inputs.includes(variant.assembly.matchInput))) {
      expect(paths.has(entry.path), entry.path).toBe(false);
      expect(head).not.toContain(`\`${entry.path}\``);
    }
  });

  it('가중 비율 규칙은 가중 비율이 실린 판에만 선다', () => {
    const [limited, extended] = round2;
    expect(limited.head).not.toContain('가중 비율이 0보다 크다는 것만으로');
    expect(extended.head).toContain('가중 비율이 0보다 크다는 것만으로');
  });

  it('확장형 2라운드는 「시험값이라 단정하지 않는다」를 싣지 않는다', () => {
    const [, extended] = round2;
    expect(extended.head).not.toContain('시험값\n(`status: "experimental"`)이라 단정하지 않는다');
    const oldExtended = built[1].head;
    expect(oldExtended).toContain('단정하지 않는다');
  });

  it('1라운드와 원복 조립에는 읽는 법이 없고, 운영 두 궁합에는 있다', () => {
    for (const { head } of built) expect(head).not.toContain('## 이 자료를 읽는 법');
    const legacyMatch = readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT, 'legacy-v0');
    const own = readingEvidenceOf('private', { a: A, b: B }, VIEWED_AT);
    expect(readingPromptOf(legacyMatch, LEGACY_PAIR_ASSEMBLY)).not.toContain('## 이 자료를 읽는 법');
    expect(readingPromptOf(own, LEGACY_PAIR_ASSEMBLY)).not.toContain('## 이 자료를 읽는 법');
    expect(READING_PROMPTS.match).toContain('## 이 자료를 읽는 법');
    expect(READING_PROMPTS.private).toContain('## 이 자료를 읽는 법');
  });
});

/**
 * **3라운드 — 쓰는 방식만 다르다.** 직접 작성판은 2라운드 A 와 같은 프롬프트이고, 주장·근거판에만 한 절이 선다.
 */
describe('주장·근거 연결 (3라운드)', () => {
  const promptOf = (id: string) => {
    const variant = MATCH_INPUT_VARIANTS.find((one) => one.id === id)!;
    const reading = readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT, variant.assembly.matchInput);
    if (reading.kind !== 'match') throw new Error('인연 궁합이 아니다');
    return readingPromptOf(reading, variant.assembly);
  };

  it('직접 작성판은 2라운드 A 와 프롬프트가 같다', () => {
    expect(promptOf('match-limited-direct-v3')).toBe(promptOf('match-limited-v2'));
  });

  it('주장·근거 절은 그 판에만 선다', () => {
    expect(promptOf('match-limited-claims-v3')).toContain('## 쓰기 전에 주장과 근거를 잇는다');
    for (const id of ['match-limited-direct-v3', 'match-limited-v2', 'match-extended-v2', 'match-limited-v1']) {
      expect(promptOf(id), id).not.toContain('## 쓰기 전에 주장과 근거를 잇는다');
    }
    expect(READING_PROMPTS.match).not.toContain('## 쓰기 전에 주장과 근거를 잇는다');
    expect(READING_PROMPTS.private).not.toContain('## 쓰기 전에 주장과 근거를 잇는다');
  });
});

/**
 * **4라운드 — 읽는 법 2판.** 자료 안내는 1판과 같고, 억제 규칙 절 대신 정확성 최소선과 종합 해석 안내가 선다.
 * 운영과 다른 라운드의 프롬프트는 안 바뀐다.
 */
describe('읽는 법 2판 (4라운드)', () => {
  const variant = MATCH_INPUT_VARIANTS.find((one) => one.id === 'match-limited-guide2-v4')!;
  const reading = readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT, variant.assembly.matchInput);
  if (reading.kind !== 'match') throw new Error('인연 궁합이 아니다');
  const [head] = readingPromptOf(reading, variant.assembly).split('\n## 자료 (');

  it('자료 안내(경로별 뜻)는 1판과 같다', () => {
    for (const entry of guideFor('limited-v1')) expect(head).toContain(`\`${entry.path}\` — ${entry.meaning}`);
  });

  it('억제 규칙 절은 없고, 정확성 최소선·관계 안내·본문 규칙이 선다', () => {
    expect(head).not.toContain('## 결론은 근거가 닿는 데까지만');
    expect(head).not.toContain('누가 행동하는 사람이고 누가 판단하는 사람인지 정하지 마라');
    expect(head).not.toContain('부족하면 그 주장을 뺀다');
    for (const heading of ['## 틀리면 안 되는 것', '## 관계를 읽는 안내', '## 본문에 옮기지 않는 것']) {
      expect(head).toContain(heading);
    }
    expect(head).toContain('정답표가 아니라');
  });

  it('운영·다른 라운드에는 2판 절이 없다', () => {
    expect(READING_PROMPTS.match).not.toContain('## 관계를 읽는 안내');
    expect(READING_PROMPTS.private).not.toContain('## 관계를 읽는 안내');
    for (const other of MATCH_INPUT_VARIANTS.filter((one) => one.round !== 4)) {
      const r = readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT, other.assembly.matchInput);
      if (r.kind !== 'match') throw new Error('x');
      expect(readingPromptOf(r, other.assembly), other.id).not.toContain('## 관계를 읽는 안내');
    }
  });
});

/**
 * **5라운드 — 부딪히던 공통 지시를 인연 궁합 v3 에서만 갈아 끼웠다.** 걷은 문장이 v3 에 없고, 운영·다른 라운드에는
 * 그대로 있는지 양쪽으로 잰다.
 */
describe('읽는 법 3판 (5라운드)', () => {
  const variant = MATCH_INPUT_VARIANTS.find((one) => one.id === 'match-limited-guide3-v5')!;
  const reading = readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT, variant.assembly.matchInput);
  if (reading.kind !== 'match') throw new Error('인연 궁합이 아니다');
  const [head] = readingPromptOf(reading, variant.assembly).split('\n## 자료 (');

  const REMOVED = [
    '「자료 밖」이라고 먼저 적어라',
    '`decade:n`(대운)',
    '읽는 사람이 알아야 바뀌는 것만',
    '즉각적인 반응을 원하고 두 번째 분은 속으로 따져 본 뒤',
    '금이 셋이에요. 그래서 판단할 때 기준이 분명하고',
    '재성이 강해서 현실적인 성향이 있습니다',
    '천을귀인이 있어서',
    '연락 속도가 어긋나 서로를 오해한다',
    '속도만 맞추면 시작과 완성을 함께 가져가는 사이',
    '다 다루되 고르게 나누지는 마라',
    '얕은 것은 「…쪽으로 보인다」',
  ];

  it('새 안내와 부딪히던 문장이 v3 에는 없다', () => {
    for (const phrase of REMOVED) expect(head, phrase).not.toContain(phrase);
  });

  it('원복 조립에는 그 문장들이 그대로 있고, 운영 두 궁합에는 없다', () => {
    const legacyMatch = readingPromptOf(readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT, 'legacy-v0'), LEGACY_PAIR_ASSEMBLY);
    const legacyPrivate = readingPromptOf(readingEvidenceOf('private', { a: A, b: B }, VIEWED_AT), LEGACY_PAIR_ASSEMBLY);
    for (const phrase of ['「자료 밖」이라고 먼저 적어라', '즉각적인 반응을 원하고 두 번째 분은 속으로 따져 본 뒤', '속도만 맞추면 시작과 완성을 함께 가져가는 사이']) {
      expect(legacyMatch, phrase).toContain(phrase);
      expect(legacyPrivate, phrase).toContain(phrase);
      expect(READING_PROMPTS.match, phrase).not.toContain(phrase);
      expect(READING_PROMPTS.private, phrase).not.toContain(phrase);
    }
  });

  it('고르는 안내·본문 뒤 요약·자료 안내·정확성 최소선이 선다', () => {
    expect(head).toContain('다 답해야 하는 목차가 아니다');
    expect(head).toContain('**본문을 다 쓴 뒤에** 쓴다');
    expect(head).toContain('`markdown` 에 본문을 끝까지 쓰고');
    expect(head).toContain('## 틀리면 안 되는 것');
    expect(head).toContain('시각을 모르는 명식의 반쪽 합은 사라질 수 있다');
    for (const entry of guideFor('limited-v1')) expect(head).toContain(`\`${entry.path}\` — ${entry.meaning}`);
  });

  it('4라운드와 다른 라운드 프롬프트는 안 바뀐다', () => {
    const r4 = MATCH_INPUT_VARIANTS.find((one) => one.id === 'match-limited-guide2-v4')!;
    const [head4] = readingPromptOf(reading, r4.assembly).split('\n## 자료 (');
    expect(head4).toContain('「자료 밖」이라고 먼저 적어라');
    expect(head4).not.toContain('다 답해야 하는 목차가 아니다');
  });
});

/**
 * **비공개 궁합은 두 사람 분석 자료를 그대로 싣는다** — 4판의 읽는 법은 실제로 실린 경로만 설명한다.
 */
describe('비공개 궁합 4판의 읽는 법', () => {
  const reading = readingEvidenceOf('private', { a: A, b: B }, VIEWED_AT);
  const paths = pathsOf(reading.evidence);
  const [head] = readingPromptOf(reading).split('\n## 자료 (');

  it('설명한 경로는 전부 비공개 궁합 자료에 있고 프롬프트에 선다', () => {
    const guide = guideFor('private');
    expect(guide.length).toBeGreaterThan(guideFor('limited-v1').length);
    for (const entry of guide) {
      expect(paths.has(entry.path), entry.path).toBe(true);
      expect(head).toContain(`\`${entry.path}\``);
    }
  });

  it('제한형 A 로 줄이지 않는다 — 각자의 판정과 지금의 운이 실린다', () => {
    for (const path of ['charts.*.relations', 'charts.*.now']) expect(paths.has(path), path).toBe(true);
    expect(head).toContain('## 글을 나누는 법');
  });
});
