import { describe, expect, it } from 'vitest';

import { CONTROL, PROMPT_VARIANTS, measureMarkdown, measureText, outputDeviations } from '.';

/**
 * 이 계산은 채점 화면 안에 있었다. 그 자리에 있는 동안은 시험이 한 줄도 안 닿았고,
 * 실호출 검사도 같은 자를 못 썼다. 여기서 잠그는 것이 그 둘이다.
 */

const body = (sections: number, filler: number) =>
  Array.from({ length: sections }, (_, at) => `## ${at + 1}. 절\n\n${'가'.repeat(filler)}`).join('\n\n');

describe('받은 것과 안 받은 것', () => {
  /** 안 돌린 칸이 기록에 `0자`로 실리면 실패인지 공백인지 나중에 못 가린다 */
  it('빈 칸은 받지 않은 것이다', () => {
    for (const nothing of ['', '   ', '\n\n', undefined]) {
      expect(measureText(nothing).received, JSON.stringify(nothing)).toBe(false);
    }
  });

  it('본문이 비어 있어도 받은 것은 받은 것이다', () => {
    const measured = measureText('{"score":null,"markdown":""}');

    expect(measured.received).toBe(true);
    expect(measured.length).toBe(0);
  });
});

describe('무엇을 세는가', () => {
  /** 프롬프트가 「근거 칸은 분량에 넣지 않는다」고 적었으므로 세는 쪽도 빼야 한다 */
  it('근거 칸을 본문 길이에서 뺀다', () => {
    const text = `## 1. 한 줄로\n\n${'가'.repeat(100)}\n\n### 근거 (검사용)\n\n${'나'.repeat(500)}`;
    const measured = measureMarkdown(text);

    expect(measured.length).toBeLessThan(150);
    expect(measured.whole).toBeGreaterThan(600);
  });

  it('근거 칸이 없으면 두 길이가 같아진다', () => {
    const measured = measureMarkdown(`## 1. 한 줄로\n\n${'가'.repeat(100)}`);

    expect(measured.whole).toBe(measured.markdown.length);
    expect(measured.length).toBeGreaterThan(100);
  });

  /** `### 근거` 는 `##` 뒤가 `#` 이라 본문 소제목에 안 걸린다 */
  it('본문 소제목만 센다', () => {
    expect(measureMarkdown(body(8, 10)).headings).toBe(8);
    expect(measureMarkdown(`${body(4, 10)}\n\n### 근거 (검사용)\n\n한 줄`).headings).toBe(4);
  });

  it('첫 절만 재고 둘째 절에서 끊는다', () => {
    const measured = measureMarkdown(`## 1. 한 줄로\n\n${'가'.repeat(30)}\n\n## 2. 무슨 때인가\n\n${'나'.repeat(400)}`);

    expect(measured.lead).toBe(30);
  });

  it('소제목이 하나뿐이면 끝까지가 첫 절이다', () => {
    expect(measureMarkdown(`## 1. 한 줄로\n\n${'가'.repeat(30)}`).lead).toBe(30);
  });

  /** 「못 셌다」를 0자로 적으면 그 줄은 조용히 거짓이 된다 */
  it('소제목이 없으면 첫 절을 0으로 둔다', () => {
    expect(measureMarkdown('소제목 없이 그냥 쓴 글').lead).toBe(0);
  });
});

describe('붙여 넣은 것을 읽는다', () => {
  it('구조화 출력이면 본문을 꺼내고 score 를 본다', () => {
    const measured = measureText('{"score":null,"markdown":"## 1. 한 줄로\\n\\n가나다"}');

    expect(measured.markdown.startsWith('## 1.')).toBe(true);
    expect(measured.scoreIsNull).toBe('yes');
  });

  it('점수가 붙어 나온 것을 「null 아님」으로 적는다', () => {
    expect(measureText('{"score":72,"markdown":"본문"}').scoreIsNull).toBe('no');
  });

  /** 「안 봤다」를 「null 이 아니었다」로 적지 않는다 */
  it('본문만 붙여 넣으면 score 는 모르는 것이다', () => {
    expect(measureText('## 1. 한 줄로\n\n가나다').scoreIsNull).toBe('unknown');
  });

  it('JSON 처럼 시작했지만 아니면 통째로 본문으로 본다', () => {
    const measured = measureText('{ 이건 JSON 이 아니다');

    expect(measured.scoreIsNull).toBe('unknown');
    expect(measured.markdown).toContain('JSON 이 아니다');
  });
});

/**
 * **저장해도 되는가와 시킨 대로 나왔는가는 다른 물음이다.**
 *
 * `checkReading` 의 문턱은 kind 하나에 하나뿐이라 변형마다 다른 지시를 못 잰다.
 */
describe('조립이 시킨 대로 나왔는가', () => {
  /** 기준판과 **절 수가 다른** 변형이 있어야 눈금이 하나로 못박히지 않았음을 잰다 */
  const legacy = () => {
    const found = PROMPT_VARIANTS.find((one) => one.id === 'legacy-v1');
    if (found === undefined) throw new Error('legacy-v1 이 없다');
    return found.assembly;
  };

  it('시킨 대로면 아무 말도 하지 않는다', () => {
    expect(outputDeviations(measureMarkdown(body(9, 650)), CONTROL)).toEqual([]);
    expect(outputDeviations(measureMarkdown(body(8, 280)), legacy())).toEqual([]);
  });

  /** 새 뼈대가 옛 뼈대처럼 길고 많은 절을 쓰면 저장은 되지만 채점 대상이 아니다 */
  it('기준판이 여덟 절 긴 글을 내면 둘 다 짚는다', () => {
    const codes = outputDeviations(measureMarkdown(body(8, 280)), CONTROL).map((one) => one.code);

    expect(codes).toContain('length-off-target');
    expect(codes).toContain('section-count-mismatch');
  });

  it('같은 글이 옛 뼈대 계약에는 맞을 수 있다', () => {
    expect(outputDeviations(measureMarkdown(body(8, 280)), legacy())).toEqual([]);
  });

  it('절 수는 맞고 분량만 어긋난 것을 갈라 짚는다', () => {
    const codes = outputDeviations(measureMarkdown(body(9, 20)), CONTROL).map((one) => one.code);

    expect(codes).toEqual(['length-off-target']);
  });

  /**
   * **막는 것과 적는 것을 값이 스스로 말한다.**
   *
   * 어느 코드가 막는 것인지 호출부가 기억해야 하면, 부르는 자리가 늘어난 만큼 갈린다 —
   * 한 자리에서만 분량을 막게 되는 날이 온다.
   */
  it('절 수는 계약이고 분량은 목표다', () => {
    const both = outputDeviations(measureMarkdown(body(8, 280)), CONTROL);
    const kindOf = (code: string) => both.find((one) => one.code === code)?.kind;

    expect(kindOf('section-count-mismatch')).toBe('contract');
    expect(kindOf('length-off-target')).toBe('target');
  });

  it('막는 것은 절 수 하나뿐이다', () => {
    const contracts = outputDeviations(measureMarkdown(body(8, 280)), CONTROL).filter(
      (one) => one.kind === 'contract',
    );

    expect(contracts.map((one) => one.code)).toEqual(['section-count-mismatch']);
  });
});
