import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import { CONTROL, FALLBACK_NAMES, READING_PROMPTS, readingEvidenceOf, readingPromptOf } from '.';
import { SEAT_NAMES, calledName, namedMatchBody, readingBody, readingGrounding } from './display';

describe('옛 공유 궁합의 자리 호칭', () => {
  const names = { me: '나', partner: '지영' } as const;

  it('내가 첫 자리면 나와 상대 이름으로 바꾼다', () => {
    expect(namedMatchBody('첫 번째 분은 빠르고 두 번째 분은 차분해요.', true, names)).toBe(
      '나는 빠르고 지영님은 차분해요.',
    );
  });

  it('내가 둘째 자리면 저장된 글의 차례를 뒤집지 않고 이름만 맞춘다', () => {
    expect(namedMatchBody('첫 번째 분은 빠르고 두 번째 분은 차분해요.', false, names)).toBe(
      '지영님은 빠르고 나는 차분해요.',
    );
  });

  it('새 풀이처럼 자리 호칭이 없으면 손대지 않는다', () => {
    const body = '민수님은 빠르고 지영님은 차분해요.';
    expect(namedMatchBody(body, true, names)).toBe(body);
  });
});

/**
 * **프롬프트가 쓰라고 한 자리 이름을 화면이 빠짐없이 되읽는가**(G-44).
 *
 * 두 자리가 각자 글자를 들던 때가 있었다 — 프롬프트는 `FALLBACK_NAMES` 에, 화면은 정규식
 * 안의 `'첫 번째'` 에. 이제 말은 `SEAT_NAMES` 하나이지만 프롬프트 본문에는 그 값을 안 읽고
 * **손으로 적은 자리 이름**이 더 있다(이름을 모를 때 지시문 셋 · 자료 설명 둘, 이름을 알 때
 * 금하는 문장 하나). 그래서 값만 견주지 않고 **보내는 프롬프트를 통째로 화면에 돌려** 남는
 * 자리 이름이 없는지 잰다 — 한쪽만 고치면 여기서 빨개진다.
 */
describe('프롬프트의 자리 이름과 화면이 되읽는 자리 이름', () => {
  const names = { me: '나', partner: '지영' } as const;
  const seats = [SEAT_NAMES.first, SEAT_NAMES.second];
  const viewedAt = new Date('2026-08-26T04:00:00Z');
  const chart = (year: number) =>
    computeSaju({ year, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male' });
  const unnamed = (kind: 'match' | 'private') =>
    readingPromptOf(readingEvidenceOf(kind, { a: chart(1990), b: chart(1992) }, viewedAt), CONTROL);

  it('프롬프트가 이름 대신 쓰는 말이 화면이 찾는 말이다', () => {
    expect(FALLBACK_NAMES).toEqual({ a: SEAT_NAMES.first, b: SEAT_NAMES.second });
  });

  it('이름을 모르는 두 사람 프롬프트에 서는 자리 이름을 화면이 하나도 안 남긴다', () => {
    for (const prompt of [READING_PROMPTS.match, unnamed('match'), unnamed('private')]) {
      for (const seat of seats) expect(prompt).toContain(seat);

      const shown = namedMatchBody(prompt, true, names);
      for (const seat of seats) expect(shown).not.toContain(seat);
      /* 값과 다른 글자로 적힌 자리 이름 — 「첫째 분」처럼 한쪽만 고친 것 — 도 남기지 않는다 */
      expect(shown).not.toMatch(/째 분/);
    }
  });

  /** 이름을 아는 프롬프트는 자리 이름으로 부르지 말라고 한다 — 그때 드는 말도 같은 값이다 */
  it('이름을 아는 프롬프트가 금하는 자리 이름이 같은 말이다', () => {
    const named = readingPromptOf(
      readingEvidenceOf('match', { a: chart(1990), b: chart(1992) }, viewedAt),
      CONTROL,
      { names: { a: '동생', b: '형' }, relation: null },
    );

    expect(named).toContain(`「${SEAT_NAMES.first}」·「${SEAT_NAMES.second}」처럼 자리 이름으로`);
  });
});

describe('사용자가 읽는 사주풀이 본문', () => {
  it('내부 검토용 근거 절을 화면 본문에서 뺀다', () => {
    const markdown = `## 한 줄로

지금은 기준을 세울 때입니다.

### 근거 (검사용)

한 줄로 — analysis.strength [유도]`;

    expect(readingBody(markdown)).toBe('## 한 줄로\n\n지금은 기준을 세울 때입니다.');
  });

  it('근거 절이 없으면 원문 내용은 그대로 둔다', () => {
    expect(readingBody('  ## 한 줄로\n\n본문  ')).toBe('## 한 줄로\n\n본문');
  });

  it('본문 문장 안의 근거라는 말은 자르지 않는다', () => {
    const markdown = '## 한 줄로\n\n이 판단의 근거는 두 흐름이 겹친다는 점입니다.';

    expect(readingBody(markdown)).toBe(markdown);
  });
});

/**
 * **잘라 낸 쪽도 읽을 수 있어야 검수가 된다.**
 *
 * 이 절은 프롬프트가 시켜서 만들어지고 DB 에 저장까지 되는데 어디에도 안 서 있었다.
 * 그러면 「이 문장이 왜 이렇게 나왔나」의 답이 사람의 짐작이 된다.
 */
describe('되짚는 자리가 읽는 근거 절', () => {
  const markdown = `## 한 줄로

지금은 기준을 세울 때입니다.

### 근거 (검사용)

한 줄로 — analysis.strength [유도]`;

  it('본문이 버린 쪽을 그대로 준다', () => {
    expect(readingGrounding(markdown)).toBe(
      '### 근거 (검사용)\n\n한 줄로 — analysis.strength [유도]',
    );
  });

  /** 자르는 자리가 하나여야 한다 — 둘이면 본문에서 뺀 줄이 여기에도 없는 날이 온다 */
  it('본문과 근거를 합치면 잘린 것이 없다', () => {
    const body = readingBody(markdown);
    const grounding = readingGrounding(markdown) ?? '';

    expect(`${body}\n\n${grounding}`).toBe(markdown);
  });

  /** 「모델이 안 썼다」와 「비어 있다」는 다른 사실이고, 안 쓴 것 자체가 검수 대상이다 */
  it('근거 절이 없으면 null 이다', () => {
    expect(readingGrounding('## 한 줄로\n\n본문뿐입니다.')).toBeNull();
    expect(readingGrounding('## 한 줄로\n\n본문\n\n### 근거 (검사용)\n\n   ')).toBeNull();
  });

  it('본문 문장 안의 근거라는 말에 걸리지 않는다', () => {
    expect(readingGrounding('## 한 줄로\n\n이 판단의 근거는 겹침입니다.')).toBeNull();
  });
});

describe('화면에서 사람을 부르는 말', () => {
  it('이름에는 님을 붙인다 — 안 붙이면 사람을 품평하는 글이 된다', () => {
    expect(calledName('지영')).toBe('지영님');
    expect(calledName('김철수')).toBe('김철수님');
    expect(calledName('Anna')).toBe('Anna님');
  });

  /**
   * 가족 호칭에도 붙인다. 목록을 두고 「엄마」를 빼던 판이 있었는데 사람이 걷기로
   * 정했다 — 이름표에 친구 이름 세 글자를 적는 일이 더 잦고, **예외를 위해 둔 판정은
   * 한국어의 호칭을 다 셀 수 없어 언제나 모자란다.**
   */
  it('가족 호칭에도 붙인다 — 예외를 두지 않는다', () => {
    expect(calledName('엄마')).toBe('엄마님');
    expect(calledName('동생')).toBe('동생님');
    expect(calledName('우리 형')).toBe('우리 형님');
  });

  /** 기계적으로 틀리는 자리만 막는다 */
  it('이미 님으로 끝나면 두 번 안 붙인다', () => {
    expect(calledName('어머님')).toBe('어머님');
    expect(calledName('선생님')).toBe('선생님');
  });

  it('자기를 가리키는 말에는 안 붙인다', () => {
    expect(calledName('나')).toBe('나');
  });

  /** 빈 자리를 「님」 한 글자로 만들지 않는다 */
  it('빈 이름은 빈 채로 둔다', () => {
    expect(calledName('   ')).toBe('');
  });
});
