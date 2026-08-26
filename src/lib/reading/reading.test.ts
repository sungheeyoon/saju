import { describe, expect, it } from 'vitest';

import { CITY_LONGITUDES, computeSaju } from '@/src/lib/saju';
import {
  READING_KINDS,
  READING_POLICY,
  READING_PROMPTS,
  ReadingEvidenceError,
  checkReading,
  isScored,
  readingEvidenceOf,
  readingPromptOf,
  type ReadingKind,
} from '@/src/lib/reading';
import { secretForms, type BirthSecret } from '@/src/lib/reading/check';

const VIEWED_AT = new Date('2026-08-25T13:00:00+09:00');

const A = computeSaju(
  { year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male' },
  { longitude: CITY_LONGITUDES.부산, useLongitude: true },
);
const B = computeSaju({ year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' });

const SECRET: BirthSecret = {
  originalDate: '1990-05-12',
  solarDate: '1990-05-12',
  birthTime: '14:30:00',
  city: '부산',
};

const evidenceFor = (kind: ReadingKind) =>
  readingEvidenceOf(kind, kind === 'self' ? { a: A } : { a: A, b: B }, VIEWED_AT);

describe('kind 는 근거 범위에서만 갈린다', () => {
  it('자기 풀이는 두 번째 사람을 받지 않는다', () => {
    expect(() => readingEvidenceOf('self', { a: A, b: B }, VIEWED_AT)).toThrow(ReadingEvidenceError);
  });

  it('궁합은 한 사람으로 만들지 않는다', () => {
    for (const kind of ['private', 'match'] as const) {
      expect(() => readingEvidenceOf(kind, { a: A }, VIEWED_AT)).toThrow(ReadingEvidenceError);
    }
  });

  it('비공개 궁합은 두 원국을 다 들고, 공유 궁합은 사이의 사실만 든다', () => {
    const priv = evidenceFor('private');
    const match = evidenceFor('match');

    expect(Object.keys(priv.evidence.charts.a)).toContain('analysis');
    expect(Object.keys(match.evidence.charts.a)).not.toContain('analysis');
    expect(match.evidence.compatibility).not.toBeNull();
  });
});

describe('프롬프트는 출생 원문을 들고 나가지 않는다', () => {
  it.each(READING_KINDS)('%s — 보내는 것 전체에 원문이 없다', (kind) => {
    const prompt = readingPromptOf(evidenceFor(kind));

    for (const form of secretForms(SECRET)) {
      expect(prompt, `${form} 이 프롬프트에 있다`).not.toContain(form);
    }
  });

  it('자료는 규칙 뒤에 붙는다', () => {
    const prompt = readingPromptOf(evidenceFor('self'));

    expect(prompt.indexOf('# 역할')).toBeLessThan(prompt.indexOf('## 자료'));
    expect(prompt).toContain('```json');
  });

  it('한눈에 보이는 머리가 역할 바로 뒤에 선다', () => {
    const prompt = readingPromptOf(evidenceFor('self'));

    expect(prompt.indexOf('## 한눈에')).toBeGreaterThan(prompt.indexOf('# 역할'));
    expect(prompt.indexOf('## 한눈에')).toBeLessThan(prompt.indexOf('## 이 자료가 무엇인가'));
    expect(prompt).toContain(A.pillars.day.name);
  });

  it('공유 궁합 프롬프트는 범위를 적고 성격 읽는 순서를 빼고 온다', () => {
    expect(READING_PROMPTS.match).toContain('## 이 자료의 범위');
    expect(READING_PROMPTS.match).not.toContain('## 성격을 읽는 순서');
    expect(READING_PROMPTS.private).toContain('## 성격을 읽는 순서');
  });

  it('점수 계약은 궁합에만 붙는다', () => {
    /*
      **비운다는 말은 세 갈래로 읽힌다** — 자리를 빼거나, 빈 문자열을 넣거나, `null` 을
      넣거나. 계약이 받는 것은 `null` 하나뿐이고 스키마도 두 자리를 다 요구한다
      (`required: ['score','markdown']`). 프롬프트가 그 꼴을 그대로 적어야 갈릴 자리가 없다.
    */
    expect(READING_PROMPTS.self).toContain('"score": null');
    expect(READING_PROMPTS.self).toContain('빼거나 빈 문자열로 내지 마라');
    for (const kind of ['private', 'match'] as const) {
      expect(READING_PROMPTS[kind]).toContain('## 점수');
      expect(isScored(kind)).toBe(true);
    }
    expect(isScored('self')).toBe(false);
  });

  it('머리는 운이 없는 자료에서도 선다 — 없는 줄을 지어 적지 않는다', () => {
    const prompt = readingPromptOf(evidenceFor('match'));

    expect(prompt).toContain('## 한눈에');
    expect(prompt).not.toContain('- 지금 만 ');
  });
});

const OK_MARKDOWN = `## 한 줄로\n${'두 사람 사이에 성립하는 것을 적는 글이다. '.repeat(30)}`;

const ok = (kind: ReadingKind) => ({
  kind,
  output: { score: isScored(kind) ? 72 : null, markdown: OK_MARKDOWN },
  evidenceText: JSON.stringify(evidenceFor(kind).evidence),
  secrets: [SECRET],
});

const codesOf = (result: ReturnType<typeof checkReading>): string[] =>
  result.ok ? [] : result.failures.map((failure) => failure.code);

describe('나온 글을 저장하기 전에 검사한다', () => {
  it.each(READING_KINDS)('%s — 멀쩡한 글은 지나간다', (kind) => {
    expect(checkReading(ok(kind))).toEqual({ ok: true });
  });

  it('자료에 없는 간지는 hard fail 이다', () => {
    const base = ok('match');
    const absent = [...'甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥'].find(
      (character) => !base.evidenceText.includes(character),
    );

    /**
     * 공유 자료는 여덟 글자와 사이의 관계뿐이라 **없는 간지가 반드시 있다.** 이
     * 시험이 무언가를 재려면 그 사실이 먼저 참이어야 한다.
     */
    expect(absent).toBeDefined();

    const result = checkReading({
      ...base,
      output: { ...base.output, markdown: `${OK_MARKDOWN}\n${absent} 이 서 있다.` },
    });

    expect(codesOf(result)).toContain('invented-characters');
  });

  it('한 사람의 자료는 간지를 거의 다 들고 있다 — 이 검사가 어디서 무는지', () => {
    const { evidenceText } = ok('self');
    const absent = [...'甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥'].filter(
      (character) => !evidenceText.includes(character),
    );

    /**
     * 지장간·지금 도는 운·관계 참여자까지 실리므로 스물두 자가 거의 다 나온다. 그래서
     * 이 검사는 자기 풀이에서 걸러 내는 것이 적고 **공유 궁합에서 가장 세게 문다.**
     * 범위가 좁을수록 지어낸 것이 드러난다 — 감춘 것이 검사를 대신하는 자리다.
     */
    expect(absent.length).toBeLessThan(6);
  });

  it('자료에 있는 간지는 걸리지 않는다', () => {
    const base = ok('self');
    const result = checkReading({
      ...base,
      output: { ...base.output, markdown: `${OK_MARKDOWN}\n일주는 ${A.pillars.day.name} 이다.` },
    });

    expect(result).toEqual({ ok: true });
  });

  it('출생 원문이 어떤 꼴로든 나오면 hard fail 이다', () => {
    for (const form of ['1990년 5월 12일', '1990-05-12', '14:30', '오후 2시 30분', '부산']) {
      const base = ok('self');
      const result = checkReading({
        ...base,
        output: { ...base.output, markdown: `${OK_MARKDOWN}\n${form} 에 태어났습니다.` },
      });

      expect(codesOf(result), `${form} 이 안 걸렸다`).toContain('birth-input-leaked');
    }
  });

  it('실패 기록에 샌 값 자체를 적지 않는다', () => {
    const base = ok('self');
    const result = checkReading({
      ...base,
      output: { ...base.output, markdown: `${OK_MARKDOWN}\n1990-05-12 에 태어났습니다.` },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    for (const failure of result.failures) {
      expect(failure.detail).not.toContain('1990');
    }
  });

  it('절기 날짜는 걸리지 않는다 — 자료에 있는 값이다', () => {
    const base = ok('self');
    const result = checkReading({
      ...base,
      output: { ...base.output, markdown: `${OK_MARKDOWN}\n입하 절입은 1990년 5월 6일입니다.` },
    });

    expect(result).toEqual({ ok: true });
  });

  it('공유 궁합에서 원국 판정을 지어내면 hard fail 이다', () => {
    const base = ok('match');
    const result = checkReading({
      ...base,
      output: { ...base.output, markdown: `${OK_MARKDOWN}\n첫 번째 분은 신약합니다.` },
    });

    expect(codesOf(result)).toContain('out-of-scope-judgment');
  });

  it('같은 낱말이 비공개 궁합에서는 걸리지 않는다 — 거기서는 자료에 있다', () => {
    const base = ok('private');
    const result = checkReading({
      ...base,
      output: { ...base.output, markdown: `${OK_MARKDOWN}\n첫 번째 분은 신약합니다.` },
    });

    expect(result).toEqual({ ok: true });
  });

  /**
   * **십성과 관계 이름은 공유 궁합에서도 지나가야 한다.**
   *
   * 서로를 무엇으로 보는가(`compatibility.tenGods`)와 두 원국 **사이의** 관계는 동의
   * 범위 안이고 프롬프트가 그것을 쓰라고 절을 배정한다. 목록에 넣으면 시키는 대로
   * 쓴 글이 hard fail 난다.
   */
  it.each(['정관', '편재', '원진', '귀문', '삼형'])(
    '%s 은 공유 궁합에서도 걸리지 않는다',
    (word) => {
      const base = ok('match');
      const result = checkReading({
        ...base,
        output: { ...base.output, markdown: `${OK_MARKDOWN}\n둘 사이에 ${word} 이 있습니다.` },
      });

      expect(result).toEqual({ ok: true });
    },
  );

  it.each(['둘이 함께 세운 규칙을 지킵니다.', '두 사람의 통근 거리를 먼저 맞춰야 합니다.'])(
    '일상어는 원국 판정으로 잡지 않는다 — %s',
    (sentence) => {
      const base = ok('match');
      const result = checkReading({
        ...base,
        output: { ...base.output, markdown: `${OK_MARKDOWN}\n${sentence}` },
      });

      expect(result).toEqual({ ok: true });
    },
  );

  /** 신살과 12운성은 공유 자료에 값이 없다 — 이름이 나오면 지어낸 것이다 */
  it.each([
    '백호',
    '천을귀인',
    '공망',
    '역마',
    '대운',
    '올해 세운의 흐름',
    '일간이 월지에 통근합니다',
  ])(
    '%s 은 공유 궁합에서 hard fail 이다',
    (word) => {
      const base = ok('match');
      const result = checkReading({
        ...base,
        output: { ...base.output, markdown: `${OK_MARKDOWN}\n첫 번째 분에게 ${word} 이 있습니다.` },
      });

      expect(codesOf(result)).toContain('out-of-scope-judgment');
    },
  );

  it('점수는 있어야 할 때 있고 없어야 할 때 없다', () => {
    const withScore = checkReading({ ...ok('self'), output: { score: 70, markdown: OK_MARKDOWN } });
    expect(codesOf(withScore)).toContain('score-out-of-contract');

    const without = checkReading({ ...ok('match'), output: { score: null, markdown: OK_MARKDOWN } });
    expect(codesOf(without)).toContain('score-out-of-contract');
  });

  it.each([-1, 101, 72.5])('점수 %s 는 범위 밖이다', (score) => {
    const result = checkReading({ ...ok('match'), output: { score, markdown: OK_MARKDOWN } });
    expect(codesOf(result)).toContain('score-out-of-contract');
  });

  it('빈 글은 지나가지 못한다', () => {
    const result = checkReading({ ...ok('self'), output: { score: null, markdown: '   ' } });
    expect(codesOf(result)).toContain('length-out-of-contract');
  });

  it('길이 계약은 정책에서 읽는다', () => {
    expect(READING_POLICY.markdownLength.min).toBeGreaterThan(0);
    expect(READING_POLICY.scoreRange).toEqual({ min: 0, max: 100 });
  });
});
