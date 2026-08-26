import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import {
  CONTROL,
  PROMPT_VARIANTS,
  READING_POLICY,
  readingEvidenceOf,
  readingPromptOf,
} from '.';

const VIEWED_AT = new Date('2026-08-26T04:00:00Z');

const chart = () =>
  computeSaju({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male' });

const evidence = () => readingEvidenceOf('self', { a: chart() }, VIEWED_AT);

/**
 * **실험판이 실제로 보내는 것을 흔들지 않는가.**
 *
 * 프롬프트를 갈라 쓸 수 있게 만든 순간, 갈라진 쪽이 조용히 기준판이 되는 길이 열린다.
 * 여기서 잠그는 것은 그 하나다 — 인자 없이 부른 것과 기준판이 **바이트까지 같은가.**
 */
describe('기준판은 실제로 보내는 것과 같다', () => {
  it('인자 없이 부른 것과 control 이 같은 문자열이다', () => {
    const one = evidence();

    expect(readingPromptOf(one, CONTROL)).toBe(readingPromptOf(one));
  });

  it('목록의 첫 자리가 기준판이고 조립 옵션도 그대로다', () => {
    const [first] = PROMPT_VARIANTS;

    expect(first.id).toBe('control');
    expect(first.assembly).toBe(CONTROL);
    expect(readingPromptOf(evidence(), first.assembly)).toBe(readingPromptOf(evidence()));
  });

  /**
   * 손으로 만든 판을 저장된 판본 이름으로 부르면, 나중에 결과를 보고 무엇으로 만든
   * 것인지 되짚을 수 없다. 실험 id 는 `READING_POLICY.version` 과 따로 산다.
   */
  it('실험 id 가 저장되는 판본 이름을 사칭하지 않는다', () => {
    for (const variant of PROMPT_VARIANTS) {
      expect(variant.id).not.toBe(READING_POLICY.version);
    }
  });
});

/**
 * **넷이 같은 자료를 읽어야 견줄 수 있다.**
 *
 * 변형마다 근거를 새로 지으면 운을 짚은 시각이 갈리고, 그때 견주는 것은 프롬프트가
 * 아니라 시각이다. 자료는 한 번 지어 넷이 나눠 쓴다.
 */
describe('변형은 같은 자료 위에 선다', () => {
  it('같은 근거 JSON 을 저마다 정확히 한 번 싣는다', () => {
    const one = evidence();
    const payload = JSON.stringify(one.evidence);

    for (const variant of PROMPT_VARIANTS) {
      const prompt = readingPromptOf(one, variant.assembly);

      expect(prompt.split(payload), variant.id).toHaveLength(2);
    }
  });

  it('기준 시각이 넷에서 같다', () => {
    const one = evidence();
    const stamps = PROMPT_VARIANTS.map(
      (variant) => /viewedAt` = (\S+)/.exec(readingPromptOf(one, variant.assembly))?.[1],
    );

    expect(new Set(stamps).size).toBe(1);
    expect(stamps[0]).toBe(VIEWED_AT.toISOString());
  });
});

/**
 * **변형 하나가 정확히 한 곳만 바꾼다.**
 *
 * 둘을 함께 바꾸면 이긴 변형이 무엇 덕에 이겼는지 알 수 없다. 그리고 서로 쌓이지
 * 않는다 — 넷은 형제이지 계단이 아니다.
 */
describe('변형은 기준판에서 하나씩만 벗어난다', () => {
  const promptOf = (id: string) => {
    const found = PROMPT_VARIANTS.find((variant) => variant.id === id);
    if (found === undefined) throw new Error(`없는 변형: ${id}`);
    return readingPromptOf(evidence(), found.assembly);
  };

  it('확인 목록은 자료 뒤에 서고 새 규칙을 더하지 않는다', () => {
    const prompt = promptOf('recency-check-v1');
    const control = readingPromptOf(evidence());

    // 자료 뒤다 — 그 자리가 이 변형이 재려는 것이다.
    expect(prompt.indexOf('## 자료')).toBeLessThan(prompt.indexOf('## 제출 전 확인'));
    expect(prompt.startsWith(control)).toBe(true);
    expect(prompt).toContain('여기서 새로 정하는 규칙은 없다');
  });

  it('분량 변형은 분량만 바꾼다', () => {
    const prompt = promptOf('length-v1');

    expect(prompt).toContain('본문 2200~3000자');
    expect(prompt).not.toContain('본문 1800~2600자');
    expect(prompt).not.toContain('## 제출 전 확인');
    expect(prompt).not.toContain('## 무엇을 남길 것인가');
  });

  it('골라 남기기는 세 정책을 얹되 분량과 꼬리는 그대로 둔다', () => {
    const prompt = promptOf('selection-bridge-v1');

    expect(prompt).toContain('## 무엇을 남길 것인가');
    expect(prompt).toContain('## 이 사람의 글인가');
    expect(prompt).toContain('## 오행에서 행동으로');
    // 세 갈래에서 다섯 갈래 — 「전부 해석하되」의 반대편에 서는 문장이다.
    expect(prompt).toContain('가장 중요한 세 가지에서 다섯 가지 갈래');
    expect(prompt).toContain('본문 1800~2600자');
    expect(prompt).not.toContain('## 제출 전 확인');
  });

  /** 얹는 절은 「낼 것」 **앞**에 선다 — 무엇을 고를지 정한 뒤에 무엇을 쓸지 읽는다 */
  it('얹는 절이 낼 것 앞에 선다', () => {
    const prompt = promptOf('selection-bridge-v1');

    expect(prompt.indexOf('## 무엇을 남길 것인가')).toBeLessThan(prompt.indexOf('## 낼 것'));
  });
});
