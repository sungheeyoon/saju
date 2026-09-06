import { describe, expect, it } from 'vitest';

import {
  CONTROL,
  PROMPT_VARIANTS,
  measureMarkdown,
  outputDeviations,
  selfSectionCount,
  type PromptAssembly,
} from '.';

/**
 * 이 계산은 채점 화면 안에 있었다. 그 자리에 있는 동안은 시험이 한 줄도 안 닿았고,
 * 실호출 검사도 같은 자를 못 썼다. 채점 화면은 사라졌지만 자는 남는다 — 실호출
 * 검사가 변형의 계약을 대는 것이 이 값이다.
 */

const body = (sections: number, filler: number) =>
  Array.from({ length: sections }, (_, at) => `## ${at + 1}. 절\n\n${'가'.repeat(filler)}`).join('\n\n');

describe('무엇을 세는가', () => {
  /** 「안 받았다」와 「0자로 나왔다」는 다르다 — 값이 그것을 구별해서 든다 */
  it('빈 글은 받지 않은 것이다', () => {
    for (const nothing of ['', '   ', '\n\n']) {
      expect(measureMarkdown(nothing).received, JSON.stringify(nothing)).toBe(false);
    }
    expect(measureMarkdown('## 1. 한 줄로').received).toBe(true);
  });

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

/**
 * **저장해도 되는가와 시킨 대로 나왔는가는 다른 물음이다.**
 *
 * `checkReading` 의 문턱은 kind 하나에 하나뿐이라 변형마다 다른 지시를 못 잰다.
 */
describe('조립이 시킨 대로 나왔는가', () => {
  /**
   * 기준판과 **계약이 다른** 조립 하나 — 눈금이 하나로 못박히지 않았음을 잰다.
   *
   * 한동안 `legacy-v1` 변형을 여기 끌어다 썼다. 그 판을 지우면서(ADR 0049) 드러난 것은
   * **이 시험이 필요로 한 것이 변형이 아니라 계약 하나**였다는 것이다 —
   * `outputDeviations` 는 `(measured, assembly)` 만 보고 그 조립이 목록에 있는지는
   * 묻지 않는다. 여기서 지어 쓰면 판본 목록이 바뀌어도 이 시험은 안 흔들린다.
   */
  const shorter = (): PromptAssembly => ({ ...CONTROL, selfLength: { min: 1800, max: 2600 } });

  /**
   * **절 수를 여기 다시 적지 않는다.** 조립이 절을 하나 더 세우면 이 숫자도 따라
   * 움직여야 하는데, 손으로 적어 두면 그날 시험이 「고쳐진 것」을 고장이라 부른다.
   */
  const ok = (assembly: PromptAssembly) => selfSectionCount(assembly);

  /**
   * 그 계약이 원하는 **한가운데**로 지은 글. 분량도 손으로 적지 않는다 — 절이 하나
   * 늘면 같은 채움값이 같은 총량을 뜻하지 않는다.
   */
  const onTarget = (assembly: PromptAssembly) => {
    const count = ok(assembly);
    const { min, max } = assembly.selfLength;
    return body(count, Math.floor((min + max) / 2 / count));
  };

  it('시킨 대로면 아무 말도 하지 않는다', () => {
    expect(outputDeviations(measureMarkdown(onTarget(CONTROL)), CONTROL)).toEqual([]);
    expect(outputDeviations(measureMarkdown(onTarget(shorter())), shorter())).toEqual([]);
  });

  /** 절도 모자라고 분량도 짧으면 **둘 다** 짚는다 — 하나가 다른 하나를 가리지 않는다 */
  it('절과 분량이 함께 어긋나면 둘 다 짚는다', () => {
    const codes = outputDeviations(measureMarkdown(body(8, 270)), CONTROL).map((one) => one.code);

    expect(codes).toContain('length-off-target');
    expect(codes).toContain('section-count-mismatch');
  });

  /**
   * **눈금은 계약마다 다시 읽힌다.** 같은 글이 한 계약에서는 짧고 다른 계약에서는 맞다.
   *
   * 절 수로도 이것을 재고 있었는데, 그러려면 절 수가 다른 조립이 있어야 한다.
   * `legacy-v1` 을 지우면서(ADR 0049) 남은 판은 전부 10절이라 **그 축으로는 더 못
   * 잰다.** 분량 축은 그대로 잰다 — 눈금이 조립에서 온다는 것이 여기서 지켜진다.
   */
  it('같은 글이 다른 계약에는 맞을 수 있다', () => {
    const short = measureMarkdown(onTarget(shorter()));

    expect(outputDeviations(short, CONTROL).map((one) => one.code)).toEqual(['length-off-target']);
    expect(outputDeviations(short, shorter())).toEqual([]);
  });

  it('절 수는 맞고 분량만 어긋난 것을 갈라 짚는다', () => {
    const codes = outputDeviations(measureMarkdown(body(ok(CONTROL), 20)), CONTROL)
      .map((one) => one.code);

    expect(codes).toEqual(['length-off-target']);
  });

  /**
   * **막는 것과 적는 것을 값이 스스로 말한다.**
   *
   * 어느 코드가 막는 것인지 호출부가 기억해야 하면, 부르는 자리가 늘어난 만큼 갈린다 —
   * 한 자리에서만 분량을 막게 되는 날이 온다.
   */
  it('절 수는 계약이고 분량은 목표다', () => {
    const both = outputDeviations(measureMarkdown(body(8, 270)), CONTROL);
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

  /**
   * **이름을 안 부르기로 한 판에서 이름이 몇 개나 남았는가.**
   *
   * 막지 않는다. 하나 새어 나왔다고 그 글이 다른 변형의 글이 되지는 않고, 막으면 그 판은
   * 한 번도 채점대에 못 선다 — 그러면 「절과 본보기를 갈랐더니 정말 달라졌는가」에 영영
   * 답이 안 나온다.
   */
  describe('이름을 안 부르는 판만 분류명을 센다', () => {
    /** 이름을 안 부르는 판이 이제 기준판이다 */
    const plain = () => CONTROL;
    /** 견줄 짝 — 이름을 달아 부르던 앞 기준판 */
    const annotated = () => {
      const found = PROMPT_VARIANTS.find((one) => one.id === 'annotated-terms-v1');
      if (found === undefined) throw new Error('annotated-terms-v1 이 없다');
      return found.assembly;
    };

    const withTerms = (assembly: PromptAssembly) => {
      const count = ok(assembly);
      const filler = Math.floor(((assembly.selfLength.min + assembly.selfLength.max) / 2) / count);
      return `${body(count, filler)}\n\n재성이 무겁고 대운이 곧 바뀝니다.`;
    };

    const codesOf = (assembly: PromptAssembly) =>
      outputDeviations(measureMarkdown(withTerms(assembly)), assembly).map((one) => one.code);

    it('이름을 다는 판에서는 아예 서지 않는다', () => {
      expect(codesOf(annotated())).not.toContain('plain-terms-exposed');
    });

    it('이름을 안 부르는 판에서는 남은 것을 적는다', () => {
      expect(codesOf(plain())).toContain('plain-terms-exposed');
    });

    it('적기만 하고 막지는 않는다', () => {
      const found = outputDeviations(measureMarkdown(withTerms(plain())), plain()).find(
        (one) => one.code === 'plain-terms-exposed',
      );

      expect(found?.kind).toBe('target');
      // 무엇이 남았는지 세지 않으면 어디를 고칠지 알 수 없다
      expect(found?.detail).toContain('재성');
      expect(found?.detail).toContain('대운');
    });

    it('시킨 대로 나온 글에는 아무 말도 하지 않는다', () => {
      expect(outputDeviations(measureMarkdown(onTarget(plain())), plain())).toEqual([]);
    });
  });
});
