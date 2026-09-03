import { describe, expect, it } from 'vitest';

import { CITY_LONGITUDES, computeSaju } from '@/src/lib/saju';
import {
  READING_KINDS,
  SOLO_KINDS,
  isSolo,
  READING_POLICY,
  READING_PROMPTS,
  ReadingEvidenceError,
  checkReading,
  isScored,
  readingEvidenceOf,
  readingPromptOf,
  type ReadingKind,
} from '@/src/lib/reading';
import {
  PLAIN_FORBIDDEN_TERMS,
  plainTermsIn,
  secretForms,
  type BirthSecret,
} from '@/src/lib/reading/check';

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

/* `self` 와 `person` 은 한 사람짜리다 — kind 이름이 아니라 계열로 가른다 */
const evidenceFor = (kind: ReadingKind) =>
  readingEvidenceOf(kind, isSolo(kind) ? { a: A } : { a: A, b: B }, VIEWED_AT);

describe('kind 는 근거 범위에서만 갈린다', () => {
  it('한 사람짜리 풀이는 두 번째 사람을 받지 않는다', () => {
    for (const kind of SOLO_KINDS) {
      expect(() => readingEvidenceOf(kind, { a: A, b: B }, VIEWED_AT)).toThrow(
        ReadingEvidenceError,
      );
    }
  });

  /**
   * **`person` 은 `self` 와 같은 자료를 받는다.**
   *
   * 갈리는 것은 접근 판정 하나뿐이고 그것은 DB 에 있다. 여기서 갈리기 시작하면 남의
   * 명식에는 다른 컷이 적용되는 셈이 되고, 그 차이는 화면에서 안 보인다.
   */
  it('저장한 사람의 풀이는 자기 풀이와 같은 컷을 받는다', () => {
    expect(evidenceFor('person').evidence).toEqual(evidenceFor('self').evidence);
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
      넣거나. 그중 앞의 둘은 이제 **스키마가 막는다**(`required: ['score','markdown']`,
      `type: ['integer','null']`). 그래서 프롬프트는 JSON 꼴을 되풀이하지 않고 **어느
      값이어야 하는지**만 말한다 — 한 자리에서 막는 것을 두 자리에서 적으면 언젠가 갈린다.

      자기 풀이에 점수가 붙어 나오는 것은 스키마가 못 막으므로 `checkReading` 이 든다.
    */
    expect(READING_PROMPTS.self).toContain('`score`는 반드시 `null`');
    expect(READING_PROMPTS.self).toContain('Structured Outputs');
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

  /**
   * **실제 호출이 여기서 떨어졌다.** 프롬프트 9절이 「문답 형식」만 시키니 모델이
   * `**Q. 공부나 자격증은 잘 맞나요?**` 로 썼고, 자기 풀이 본문의 라틴 문자 한 종
   * (`Q`)에 `non-korean-self-body` 가 걸렸다.
   *
   * 프롬프트를 한국어 형식으로 못박았으니(`질문 1.`) 그 형식이 실제로 지나가는지도
   * 함께 잠근다 — 시킨 형식이 검사에 걸리면 고친 것이 아니다.
   */
  it('문답 절을 「질문 1.」로 쓰면 지나가고 「Q.」로 쓰면 걸린다', () => {
    const withQuestion = `${OK_MARKDOWN}\n\n## 궁금한 것\n\n**질문 1. 공부나 자격증은 잘 맞나요?**\n\n잘 맞습니다.`;
    const withLatin = `${OK_MARKDOWN}\n\n## 궁금한 것\n\n**Q. 공부나 자격증은 잘 맞나요?**\n\n잘 맞습니다.`;

    const self = (markdown: string) => ({ ...ok('self'), output: { score: null, markdown } });

    expect(codesOf(checkReading(self(withQuestion)))).toEqual([]);
    expect(codesOf(checkReading(self(withLatin)))).toContain('non-korean-self-body');
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

  it('자료에 있는 간지는 지어낸 간지로 잡히지 않는다', () => {
    const base = ok('private');
    const result = checkReading({
      ...base,
      output: { ...base.output, markdown: `${OK_MARKDOWN}\n일주는 ${A.pillars.day.name} 이다.` },
    });

    expect(result).toEqual({ ok: true });
  });

  it.each(['일주는 甲申입니다.', '조건이 अस्पष्ट합니다.', 'MBTI처럼 보세요.'])(
    '개인 풀이 화면에 한글 아닌 글자를 섞으면 hard fail 이다 — %s',
    (sentence) => {
      const base = ok('self');
      const result = checkReading({
        ...base,
        output: { ...base.output, markdown: `${OK_MARKDOWN}\n${sentence}` },
      });

      expect(codesOf(result)).toContain('non-korean-self-body');
    },
  );

  it('검사용 근거의 원문 한자는 사용자 본문 검사에서 제외한다', () => {
    const base = ok('self');
    const result = checkReading({
      ...base,
      output: {
        ...base.output,
        markdown: `${OK_MARKDOWN}\n### 근거 (검사용)\n- 일주: ${A.pillars.day.name}`,
      },
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

  /**
   * **`억부` 도 지나가야 한다 — 첫 실호출에서야 드러났다.**
   *
   * `shareEvidence` 는 `compatibility` 를 통째로 남기고 그 안에 `eokbuMatch` 가 있다.
   * 게다가 궁합 6절이 그것을 읽으라고 시킨다. 목록에 넣어 둔 동안 **시키는 대로 쓴 글이
   * hard fail 났고**, match 는 프로덕션에서 한 번도 안 불렸으므로 아무도 몰랐다.
   */
  it('억부는 공유 궁합에서도 걸리지 않는다 — 자료에 있고 절이 그것을 시킨다', () => {
    const base = ok('match');
    const result = checkReading({
      ...base,
      output: {
        ...base.output,
        markdown: `${OK_MARKDOWN}\n억부 쪽의 맞물림은 아직 후보로만 볼 수 있어요.`,
      },
    });

    expect(result).toEqual({ ok: true });
  });

  /** 조후는 다르다 — 그 값은 `analysis` 에 있고 공유 자료에서 통째로 빠진다 */
  it('조후는 그대로 hard fail 이다 — 공유 자료에 값이 없다', () => {
    const base = ok('match');
    const result = checkReading({
      ...base,
      output: { ...base.output, markdown: `${OK_MARKDOWN}\n조후로 보면 둘 다 메마릅니다.` },
    });

    expect(codesOf(result)).toContain('out-of-scope-judgment');
  });

  /**
   * **맨 끝 근거 칸은 세지 않는다.**
   *
   * 화면이 거기서 끊으므로 상대에게 안 간다. 그리고 그 절은 계약을 대라고 시킨 자리인데
   * 공유 자료의 `contract.withheld` 가 「대운은 동의 범위 밖이다」처럼 그 낱말을 산문으로
   * 들고 있다 — 통째로 세면 **모델이 「그건 안 썼습니다」라고 적는 것까지 위반이 된다.**
   * 첫 실호출이 정확히 그렇게 떨어졌다.
   */
  it('안 썼다고 근거 칸에 적은 것은 위반이 아니다', () => {
    const base = ok('match');
    const grounding =
      '### 근거 (검사용)\n\n점수 — 결론 「68점」 | 자료: compatibility.eokbuMatch [후보] | ' +
      '넘어간 것: 세운·월운과 대운은 contract.excluded·withheld라 반영하지 않음';

    const result = checkReading({
      ...base,
      output: { ...base.output, markdown: `${OK_MARKDOWN}\n\n${grounding}` },
    });

    expect(result).toEqual({ ok: true });
  });

  /** 무뎌지지는 않았다 — 본문에 서면 그대로 걸린다 */
  it('같은 낱말이 본문에 서면 그대로 걸린다', () => {
    const base = ok('match');
    const result = checkReading({
      ...base,
      output: {
        ...base.output,
        markdown: `${OK_MARKDOWN}\n지금 대운이 두 분을 함께 밀어 줍니다.\n\n### 근거 (검사용)\n\n한 줄`,
      },
    });

    expect(codesOf(result)).toContain('out-of-scope-judgment');
  });

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

/**
 * **쉬운 말 판이 실제로 되었는지 재는 자.**
 *
 * `checkReading` 과 겨누는 것이 다르다. 저쪽은 저장을 막는 일이고 이쪽은 「그 판이 시킨
 * 대로 나왔는가」를 세는 일이라, 여기서 하나가 걸렸다고 글이 버려지지는 않는다. 그래서
 * **놓치는 것보다 멀쩡한 글을 잡는 쪽이 더 나쁘다** — 잡히면 판 자체가 실패로 읽힌다.
 */
describe('쉬운 말 판에 남은 분류명을 센다', () => {
  it('분류명은 잡고 오행 이름은 잡지 않는다', () => {
    expect(plainTermsIn('재성이 강해서 현실적입니다.')).toEqual(['재성']);
    expect(plainTermsIn('대운이 바뀌는 시기예요.')).toEqual(['대운']);

    // 「금이 셋이에요」는 한국어에서 자연스러운 말이고, 세는 것이 이 제품이 하는 일이다
    expect(plainTermsIn('금이 셋이라 기준이 분명하고, 물이 약한 편이에요.')).toEqual([]);
    expect(plainTermsIn('나무 기운이 들어오면 다시 붙습니다.')).toEqual([]);
  });

  /** 관계 이름은 손으로 적지 않는다 — 표가 짝을 들고, 뒤에 붙는 한 글자만 짓는다 */
  it('관계 이름을 표에서 지어 잡는다', () => {
    for (const name of ['인신충', '묘유충', '자미해', '사술원진', '자유귀문', '자묘형']) {
      expect(PLAIN_FORBIDDEN_TERMS, name).toContain(name);
    }

    expect(plainTermsIn('타고난 자리에 인신충이 있어요.')).toEqual(['인신충']);
  });

  /** 소리가 같은 일상어를 잡으면 그 판은 되지도 않았는데 실패로 읽힌다 */
  it.each([
    '그건 저와 상관없어요.',
    '인성이 좋은 사람을 만나면 편해집니다.',
    '도화지를 펼쳐 놓고 시작하는 편이에요.',
    '먼저 인사해 보세요.',
    '둘이 함께 세운 규칙이 오래갑니다.',
  ])('일상어 「%s」는 분류명이 아니다', (sentence) => {
    expect(plainTermsIn(sentence)).toEqual([]);
  });

  /**
   * 맨 끝 근거 칸은 **경로와 관계 이름을 대라고 시킨 자리**다. 통째로 세면 시킨 대로 쓴
   * 근거 칸이 어긴 것으로 잡히고, 그때 이 자는 판이 아니라 자기 자신을 잰다.
   */
  it('검사용 근거 절은 세지 않는다', () => {
    const markdown = [
      '## 먼저 볼 핵심 세 가지',
      '',
      '앞으로 몇 년은 하던 방식을 바꾸게 되는 일이 생기기 쉬워요.',
      '',
      '### 근거 (검사용)',
      '',
      '핵심 — 결론 「방식이 바뀐다」 | 자료: relations 묘유충 [사실] · analysis.tenGods 재성 [사실] | 넘어간 것: 없음',
    ].join('\n');

    expect(plainTermsIn(markdown)).toEqual([]);
  });
});
