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

  it('더 길게는 분량만 바꾼다', () => {
    const prompt = promptOf('longer-v1');

    expect(prompt).toContain('본문은 1400~2000자');
    expect(prompt).not.toContain('본문은 900~1400자');
    expect(prompt).toContain('**1. 딱 나**');
    expect(prompt).not.toContain('## 제출 전 확인');
  });

  /**
   * **옛 뼈대는 통째로 옛 뼈대여야 한다.**
   *
   * 절만 여덟으로 돌려놓고 말투 규칙은 새것을 쓰면, 견주는 것이 「옛 뼈대」가 아니라
   * 「이름만 옛 뼈대인 잡종」이 된다. 그러면 어느 쪽이 나은지 물어도 답이 안 나온다.
   */
  it('옛 뼈대는 절도 말투도 옛것이다', () => {
    const prompt = promptOf('legacy-v1');

    expect(prompt).toContain('**7. 살림법**');
    expect(prompt).toContain('본문은 1800~2600자');
    // 옛 말투 규칙이 서고 새 고객 말투는 안 선다.
    expect(prompt).toContain('**문단마다 「그래서」로 닫아라.**');
    expect(prompt).not.toContain('## 고객에게 말하는 말투');
    expect(prompt).not.toContain('딱 나');
  });

  it('기준판은 옛 절 이름을 하나도 들고 오지 않는다', () => {
    const prompt = readingPromptOf(evidence());

    for (const gone of ['타고난 결', '잘하는 것 넷', '걸리는 것 셋', '살림법']) {
      expect(prompt, gone).not.toContain(gone);
    }
  });

  it('조립 옵션이 기준판에서 각자 한 축만 다르다', () => {
    const changedKeys = (id: string) => {
      const found = PROMPT_VARIANTS.find((variant) => variant.id === id);
      if (found === undefined) throw new Error(`없는 변형: ${id}`);

      return (Object.keys(CONTROL) as (keyof typeof CONTROL)[]).filter(
        (key) => JSON.stringify(found.assembly[key]) !== JSON.stringify(CONTROL[key]),
      );
    };

    expect(changedKeys('longer-v1')).toEqual(['selfLength']);
    expect(changedKeys('recency-check-v1')).toEqual(['tail']);
    // 옛 뼈대만 둘을 함께 바꾼다 — 그래서 `confounded` 를 적는다.
    expect(changedKeys('legacy-v1').sort()).toEqual(['selfLength', 'selfPresentation']);
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
 * **사용자에게 나가는 글의 계약** — 갈아엎으면서 정한 것들.
 *
 * 앞판이 낸 글은 한자와 판정 이름으로 차 있었고, 근거를 증명하느라 지면을 썼다.
 * 여기서 잠그는 것은 그 재발이다. 문구는 손대도 되지만 **무엇을 막고 무엇을 여는지**는
 * 시험이 든다.
 */
describe('고객이 읽는 글의 계약', () => {
  const variant = (id: string) => {
    const found = PROMPT_VARIANTS.find((one) => one.id === id);
    if (found === undefined) throw new Error(`없는 변형: ${id}`);
    return found;
  };

  const selfPrompt = (assembly = CONTROL) => readingPromptOf(evidence(), assembly);

  it('기준판은 네 절이고 옛 뼈대는 여덟 절이다', () => {
    expect(selfSectionCount(CONTROL)).toBe(4);
    expect(selfSectionCount(variant('legacy-v1').assembly)).toBe(8);
  });

  it('본문에 한자를 못 쓰게 한다', () => {
    expect(selfPrompt()).toContain('한자를 한 글자도 쓰지 않는다');
  });

  it('판정 이름을 본문에서 막는다', () => {
    const prompt = selfPrompt();

    for (const term of ['정관', '용신', '억부', '격국', '신살']) {
      expect(prompt, term).toContain(term);
    }
    expect(prompt).toContain('본문에 쓰지 않는다');
  });

  /**
   * **다섯 기운은 막지 않는다.**
   *
   * 「나무 기운이 모자라 배우는 일이 힘이 된다」는 이 제품에서 사람들이 가장 좋아한
   * 대목이다. 판정 이름을 막다가 이것까지 막으면, 조언과 근거를 잇는 다리가 사라져
   * 남은 것이 근거 없는 잔소리가 된다.
   */
  it('다섯 기운은 예외로 열어 둔다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('나무·불·흙·쇠·물 다섯 기운은 예외');
    expect(prompt).toContain('다리');
  });

  /**
   * **완충을 통째로 막지 않는다.**
   *
   * 근거가 약할 때 세게 말하지 않는 것은 이 저장소의 규율이다(검증 수준보다 세게 말하지
   * 않기). 완충 어미를 전부 금지하면 그 규율과 정면으로 부딪히고, 모델은 확신 없는 것을
   * 확신하는 말투로 쓰게 된다. 막는 것은 **장면 없이 완충만 있는 문장**이다.
   */
  it('완충 어미를 통째로 금지하지 않는다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('완충하는 말 자체는 괜찮다');
    expect(prompt).toContain('장면 없이 완충만 있는 문장');
  });

  /** 규칙이 이기면 글이 딱딱해진다 — 그때 무엇을 고르는지도 프롬프트가 말해야 한다 */
  it('규칙보다 읽히는 글을 고르라고 적는다', () => {
    expect(selfPrompt()).toContain('규칙이 진 것이다');
  });

  it('고객에게 말하는 존댓말을 지정한다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('~해요');
    expect(prompt).toContain('해라체');
  });

  /**
   * **지시문의 말투가 곧 출력의 말투가 된다.**
   *
   * 이 지시문 전체가 `~한다`체인데 본문은 `~해요`로 내라고 시킨다. 금지어를 늘려도
   * 모델은 눈앞의 문장을 따라가므로, 규칙 대신 **본보기**를 준다 — 규칙을 줄이면서
   * 더 잘 듣는 쪽이다.
   */
  it('낼 글의 말투를 본보기로 보여 준다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('지시문을\n따라 쓰지 말고 본보기를 따라 써라');
    // 본보기 자체가 규칙을 지키고 있어야 한다 — 판정 이름 없이 장면으로.
    expect(prompt).toContain('> 마무리에서 자꾸 걸려요.');
  });

  /** 본문에서 뺀 것은 없앤 것이 아니라 옮긴 것이다 */
  it('근거는 검사용 절로 옮겨 두고 계약은 그대로다', () => {
    expect(selfPrompt()).toContain('### 근거 (검사용)');
    expect(selfPrompt(variant('legacy-v1').assembly)).toContain('### 근거 (검사용)');
  });

  /** 자동 검사가 막으면 그 변형은 한 번도 채점대에 못 선다 */
  it('모든 변형의 요구 분량이 저장 계약 안에 있다', () => {
    for (const one of PROMPT_VARIANTS) {
      const { min, max } = one.assembly.selfLength;

      expect(min, one.id).toBeGreaterThanOrEqual(READING_POLICY.markdownLength.min);
      expect(max, one.id).toBeLessThanOrEqual(READING_POLICY.markdownLength.max);
    }
  });

  /** 실제로 보내는 것은 새 뼈대다 — 옛판이 기준판 자리로 되돌아오지 않았다 */
  it('기준판은 새 뼈대다', () => {
    expect(CONTROL.selfPresentation).toBe('human-v2');
    expect(selfPrompt()).toContain('딱 나');
    expect(selfPrompt()).not.toContain('살림법');
  });
});
