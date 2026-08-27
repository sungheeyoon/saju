import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import {
  CONTROL,
  PROMPT_VARIANTS,
  READING_POLICY,
  readingEvidenceOf,
  readingPromptOf,
  selfSectionCount,
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
 * **모든 변형이 같은 자료를 읽어야 견줄 수 있다.**
 *
 * 변형마다 근거를 새로 지으면 운을 짚은 시각이 갈리고, 그때 견주는 것은 프롬프트가
 * 아니라 시각이다. 자료는 한 번 지어 모든 변형이 나눠 쓴다.
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

  it('기준 시각이 모든 변형에서 같다', () => {
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
 * 않는다 — 변형들은 형제이지 계단이 아니다.
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

  it('결론 먼저는 문단 순서만 바꾸고 판단 순서와 절 구성은 유지한다', () => {
    const prompt = promptOf('answer-first-v1');

    expect(prompt).toContain('**절마다 첫 문장에 결론을 써라.**');
    expect(prompt).toContain('판단은 아래 「성격을 읽는 순서」를 끝까지 거친 뒤 한다');
    expect(prompt).toContain('신살 하나로 바로 답하지 마라');
    expect(prompt).not.toContain('**문단마다 「그래서」로 닫아라.**');
    expect(prompt).toContain('**2. 타고난 결**');
    expect(prompt).toContain('**3. 잘하는 것 넷**');
    expect(prompt).toContain('**8. 지금**');
    expect(prompt).toContain('본문 1800~2600자');
    expect(prompt).not.toContain('## 제출 전 확인');
    expect(prompt).not.toContain('## 무엇을 남길 것인가');
  });

  it('근거만큼만은 강점·걸림의 개수 규칙만 바꾼다', () => {
    const prompt = promptOf('bounded-items-v1');

    expect(prompt).toContain('**3. 잘하는 것 — 최대 넷**');
    expect(prompt).toContain('**4. 걸리는 것 — 최대 셋**');
    expect(prompt).toContain('개수를 채우려고 일반론을 보태지 마라');
    expect(prompt).not.toContain('**3. 잘하는 것 넷**');
    expect(prompt).not.toContain('**4. 걸리는 것 셋**');
    expect(prompt).toContain('**문단마다 「그래서」로 닫아라.**');
    expect(prompt).toContain('**2. 타고난 결**');
    expect(prompt).toContain('**8. 지금**');
    expect(prompt).toContain('본문 1800~2600자');
  });

  it('지금 먼저는 절을 복제하지 않고 2번으로 옮기기만 한다', () => {
    const prompt = promptOf('now-first-v1');

    expect(prompt).toContain('**2. 지금**');
    expect(prompt).toContain('**3. 타고난 결**');
    expect(prompt).toContain('**4. 잘하는 것 넷**');
    expect(prompt).toContain('**5. 걸리는 것 셋**');
    expect(prompt).toContain('**8. 살림법**');
    expect(prompt).not.toContain('**8. 지금**');
    expect(prompt.match(/\*\*2\. 지금\*\*/g)).toHaveLength(1);
    expect(prompt).toContain('**문단마다 「그래서」로 닫아라.**');
    expect(prompt).toContain('본문 1800~2600자');
  });

  it('새 변형의 조립 옵션은 기준판에서 각자 한 축만 다르다', () => {
    const changedKeys = (id: string) => {
      const found = PROMPT_VARIANTS.find((variant) => variant.id === id);
      if (found === undefined) throw new Error(`없는 변형: ${id}`);

      return (Object.keys(CONTROL) as (keyof typeof CONTROL)[]).filter(
        (key) => found.assembly[key] !== CONTROL[key],
      );
    };

    expect(changedKeys('answer-first-v1')).toEqual(['paragraphOrder']);
    expect(changedKeys('bounded-items-v1')).toEqual(['selfItemCount']);
    expect(changedKeys('now-first-v1')).toEqual(['selfSectionOrder']);
  });

  /** 얹는 절은 「낼 것」 **앞**에 선다 — 무엇을 고를지 정한 뒤에 무엇을 쓸지 읽는다 */
  it('얹는 절이 낼 것 앞에 선다', () => {
    const prompt = promptOf('selection-bridge-v1');

    expect(prompt.indexOf('## 무엇을 남길 것인가')).toBeLessThan(prompt.indexOf('## 낼 것'));
  });
});

/**
 * **규칙 1을 시험이 센다.**
 *
 * 「변형은 control 에서 하나만 벗어난다」는 머리말 주석으로만 서 있었다. 주석은 아무것도
 * 잠그지 않는다 — 조립 옵션 둘을 함께 바꾼 변형을 넣어도 통과하고, 그 변형이 이기면
 * 무엇 덕에 이겼는지 아무도 모른 채 합치게 된다.
 *
 * 그래서 **바뀐 칸 수를 센다.** 둘 이상 바뀐 변형은 `confounded` 에 무엇이 함께
 * 움직였는지 적어야만 통과한다. 적는 것은 면제가 아니라 읽는 법이다.
 */
describe('변형은 한 곳만 벗어난다', () => {
  const changedKeys = (variant: (typeof PROMPT_VARIANTS)[number]) =>
    (Object.keys(CONTROL) as (keyof typeof CONTROL)[]).filter(
      (key) => JSON.stringify(variant.assembly[key]) !== JSON.stringify(CONTROL[key]),
    );

  it('기준판은 한 칸도 안 바꾼다', () => {
    const control = PROMPT_VARIANTS.find((one) => one.id === 'control');

    expect(control && changedKeys(control)).toEqual([]);
    expect(control?.confounded).toBeNull();
  });

  it('둘 이상 바꾼 변형은 무엇이 함께 움직였는지 적는다', () => {
    for (const variant of PROMPT_VARIANTS) {
      const changed = changedKeys(variant);
      if (changed.length <= 1) continue;

      expect(variant.confounded, `${variant.id} — ${changed.join('·')}`).not.toBeNull();
    }
  });

  it('한 곳만 바꾼 변형은 뒤섞였다고 적지 않는다', () => {
    for (const variant of PROMPT_VARIANTS) {
      if (changedKeys(variant).length > 1) continue;

      expect(variant.confounded, variant.id).toBeNull();
    }
  });

  /** 기준판 말고는 무엇이든 바꿔야 한다 — 안 바꾼 변형은 기준판의 사본이다 */
  it('기준판 아닌 변형은 반드시 무언가를 바꾼다', () => {
    for (const variant of PROMPT_VARIANTS) {
      if (variant.id === 'control') continue;

      expect(changedKeys(variant).length, variant.id).toBeGreaterThan(0);
    }
  });
});

/**
 * **범위를 좁힌 변형은 실제로 좁아져야 한다.**
 *
 * 절 목록만 줄이면 모델은 남은 절 안에 나머지를 밀어 넣는다. 그러면 좁힌 것이 아니라
 * 소제목만 줄인 것이 되고, 이 변형이 재려던 「출력의 단위」는 하나도 안 달라진다.
 * 프롬프트가 **안 쓸 것을 이름으로 말하는지**를 여기서 잠근다.
 */
describe('지금만 — 범위를 좁힌 변형', () => {
  const focus = () => {
    const found = PROMPT_VARIANTS.find((one) => one.id === 'focus-now-v1');
    if (found === undefined) throw new Error('focus-now-v1 이 없다');
    return found;
  };

  const promptOf = (variant: (typeof PROMPT_VARIANTS)[number]) =>
    readingPromptOf(evidence(), variant.assembly);

  it('기준판보다 절이 적다', () => {
    expect(selfSectionCount(focus().assembly)).toBeLessThan(selfSectionCount(CONTROL));
  });

  it('안 쓸 것을 이름으로 말한다 — 절만 지우지 않는다', () => {
    const prompt = promptOf(focus());

    for (const dropped of ['타고난 결', '일과 돈', '사람 관계', '살림법']) {
      expect(prompt, dropped).toContain(dropped);
    }
    expect(prompt).toContain('절로 세우지 마라');
  });

  it('빠진 것을 아쉬워하지 말라고 적는다', () => {
    expect(promptOf(focus())).toContain('아쉬워하지 마라');
  });

  /** 좁혔어도 근거 칸은 그대로다 — 근거 밀착성을 견주려면 같은 계약 위에 서야 한다 */
  it('근거 칸 계약은 기준판과 같다', () => {
    expect(promptOf(focus())).toContain('### 근거 (검사용)');
  });

  /** 자동 검사가 막으면 이 변형은 한 번도 채점대에 못 선다 */
  it('요구 분량이 저장 계약 안에 있다', () => {
    const { min, max } = focus().assembly.selfLength;

    expect(min).toBeGreaterThanOrEqual(READING_POLICY.markdownLength.min);
    expect(max).toBeLessThanOrEqual(READING_POLICY.markdownLength.max);
  });

  /** 실제로 보내는 것은 여전히 여덟 절이다 — 실험판이 기준판을 밀어내지 않았다 */
  it('기준판은 좁아지지 않았다', () => {
    expect(CONTROL.selfScope).toBe('whole');
    expect(readingPromptOf(evidence())).not.toContain('이 글이 답하는 것');
  });
});
