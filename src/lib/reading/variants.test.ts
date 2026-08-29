import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import {
  CONTROL,
  PROMPT_VARIANTS,
  READING_POLICY,
  READING_PROMPTS,
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

    expect(prompt).toContain('본문은 8500~11000자');
    expect(prompt).not.toContain('본문은 5000~9000자');
    expect(prompt).toContain('**1. 이 사주의 핵심**');
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
    expect(prompt).not.toContain('이 사주의 핵심');
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

  /**
   * 여기서 재는 것은 **몸통**이라 자료를 안 붙인다.
   *
   * `readingPromptOf` 는 kind 와 자료가 짝인 값만 받는다(private 은 redacted, match 는
   * shared) — 타입이 그 짝을 강제하므로 자료를 지어 끼워 넣을 수가 없다. 몸통만 볼
   * 자리에서는 `READING_PROMPTS` 가 그대로 답이다.
   */
  const compatPrompt = (kind: 'private' | 'match') => READING_PROMPTS[kind];

  /** 「낼 것」이 세우는 절의 수 — `**1. …**` 꼴로 번호가 붙은 것만 센다 */
  const sectionCountOf = (prompt: string) => (prompt.match(/^\*\*\d+\. /gm) ?? []).length;

  /**
   * **궁합이 자기 풀이의 요약처럼 보이면 안 된다.**
   *
   * 분량이 문자열 안에 박혀 있는 동안 궁합은 1000~1600자였다. 자기 풀이가 5000~9000
   * 으로 올라갈 때 아무도 여기를 안 봤고, 같은 사람이 둘을 나란히 읽으면 궁합만
   * 요약문이었다. 조립 밖의 값은 조립을 고칠 때 안 고쳐진다 — 그래서 값으로 올렸고
   * 시험이 그 자리를 잡는다.
   */
  it('궁합 분량이 자기 풀이와 같은 자릿수에 선다', () => {
    const { selfLength, compatLength } = CONTROL;

    for (const kind of ['private', 'match'] as const) {
      // 자기 풀이의 절반 아래로 내려가면 나란히 읽었을 때 요약으로 보인다
      expect(compatLength[kind].min, kind).toBeGreaterThanOrEqual(selfLength.min / 2);
      expect(compatLength[kind].max, kind).toBeGreaterThanOrEqual(selfLength.max / 2);
    }

    // 저장 계약 안에 들어야 나온 글이 길이 때문에 버려지지 않는다
    for (const kind of ['private', 'match'] as const) {
      expect(compatLength[kind].max, kind).toBeLessThanOrEqual(READING_POLICY.markdownLength.max);
    }

    for (const kind of ['private', 'match'] as const) {
      const { min, max } = compatLength[kind];
      expect(compatPrompt(kind), kind).toContain(`사용자 본문은 ${min}~${max}자`);
    }
  });

  /**
   * **재료가 다르면 물어보는 것도 달라야 한다.**
   *
   * 공유 궁합은 여덟 글자와 관계 사실까지만 열린다(ADR 0012) — 각자의 성격·신살·운은
   * 없다. 그 절을 세우면 모델은 없는 자료로 답을 지어내거나 「알 수 없다」를 적는다.
   * **둘 다 동의 범위를 지킨 것이 아니다.** 물어보지 않는 것이 지키는 것이다.
   */
  it('공유 궁합에는 동의 범위 밖을 묻는 절을 세우지 않는다', () => {
    const shared = compatPrompt('match');
    const own = compatPrompt('private');

    for (const heading of ['각자 이 관계에서 어떤 사람인가', '지금 두 사람의 운']) {
      expect(own, heading).toContain(heading);
      expect(shared, heading).not.toContain(heading);
    }

    // 둘이 함께 쓰는 절은 양쪽에 다 선다
    for (const heading of ['둘이 만나야 생기는 것', '서로를 채우는 자리', '생활에서 반복될 장면']) {
      expect(shared, heading).toContain(heading);
      expect(own, heading).toContain(heading);
    }

    // 분량만 올리면 이미 한 말을 늘여 쓴다 — 절을 먼저 채웠는지 잡는다
    expect(sectionCountOf(shared)).toBeGreaterThanOrEqual(10);
    expect(sectionCountOf(own)).toBeGreaterThan(sectionCountOf(shared));
  });

  it('기준판은 개인 사주의 핵심 물음을 빠짐없이 다룬다', () => {
    expect(selfSectionCount(CONTROL)).toBe(9);
    expect(selfSectionCount(variant('legacy-v1').assembly)).toBe(8);

    const prompt = selfPrompt();
    for (const heading of [
      '이 사주의 핵심',
      '성격과 속마음',
      '강점과 타고난 복',
      '일과 돈',
      '연애와 인간관계',
      '귀인과 기회',
      '조심할 점과 몸',
      '지금 들어온 운',
      '궁금한 것 세 가지',
    ]) {
      expect(prompt, heading).toContain(heading);
    }
  });

  it('사주 용어를 금지하지 않고 뜻을 먼저 세우게 한다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('사주 용어를 금지어처럼 피하지 마라');
    expect(prompt).toContain('뜻이 먼저');
    expect(prompt).toContain('이름은 뒤에 따라온다');
  });

  /**
   * **이름을 먼저 놓는 것이 이 글이 안 읽히던 까닭이었다.**
   *
   * 「처음 나올 때 한 번 풀어라」는 이것을 못 막았다 — 이름을 앞에 놓고 뒤에 흐릿한
   * 설명을 붙이는 것도 그 규칙은 통과시킨다. 그래서 고친 것은 분량이 아니라 **순서**다.
   *
   * 세 갈래를 따로 잠근다. 십성·간지·관계는 서로 다른 방식으로 막히고, 하나로 뭉치면
   * 셋 중 둘은 조용히 안 고쳐진다.
   */
  it('용어를 뜻·그림·장면으로 옮기는 세 갈래를 다 세운다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('이름이 아니라 그림으로 말한다');
    expect(prompt).toContain('뜻 → 눈에 보이는 장면 → (이름)');

    // 십성 — 이름이 아니라 뜻이 프롬프트에 실린다
    expect(prompt).toContain('재물·현실 감각·성과');
    expect(prompt).toContain('규범·책임·남이 매기는 평가');

    // 간지 — 오행 이름을 **두 벌 다** 내주고 서로 무엇을 하는지까지
    expect(prompt).toContain('**목 · 나무** — 불을 살리고 흙을 이긴다');
    expect(prompt).toContain('**금 · 쇠** — 물을 살리고 나무를 이긴다');

    /*
      **한 벌로 못박지 않는다.** 「금이 셋이에요」는 자연스럽고 「쇠가 셋이에요」는
      어색한데, 「쇠가 나무를 자른다」는 자연스럽고 「금이 목을 극한다」는 안 읽힌다.
      어느 쪽이 맞는지가 문장마다 다르므로 고르는 일을 글 쓰는 쪽에 남긴다.
    */
    expect(prompt).toContain('그 문장에 맞는 쪽을 그때그때 골라라');

    // 관계 — 이름만 적지 말고 장면으로
    expect(prompt).toContain('충·형·해·합은 장면으로 풀어 쓴다');
    expect(prompt).toContain('그래서 삶에서 무엇이 흔들리는지');
  });

  /**
   * 고쳐야 할 문장을 **본보기로 함께 싣는다.** 규칙만 적으면 모델은 규칙을 지켰다고
   * 여기면서 같은 문장을 다시 낸다 — 실제로 나온 글이 그랬다.
   */
  it('실제로 나왔던 안 읽히는 문장을 고칠 짝과 함께 든다', () => {
    const prompt = selfPrompt();

    for (const bad of ['관성과 재성이 무겁게 자리해', '시주의 인목과 대운의 갑인', '인신충']) {
      expect(prompt, bad).toContain(bad);
    }
    expect(prompt).toContain('이렇게 쓰지 마라');
    expect(prompt).toContain('이렇게 써라');
  });

  it('사주 용어는 한글 이름으로 쓰고 생한자나 다른 외국 문자를 섞지 않는다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('사주 용어와 간지는 한글 이름으로 쓴다');
    expect(prompt).toContain('생한자와 한국어가 아닌 외국 문자는 사용자 본문에 쓰지 마라');
    expect(prompt).toContain('갑신 대운');
  });

  it('귀인과 신살을 근거가 있을 때 사용자 본문에 보여 준다', () => {
    const prompt = selfPrompt();

    for (const term of ['천을귀인', '문창귀인', '역마', '도화', '화개']) {
      expect(prompt, term).toContain(term);
    }
    expect(prompt).toContain('실제로 걸린 것은 이름을 숨기지 말고');
    expect(prompt).toContain('없는 귀인이나 신살은 만들지 마라');
  });

  it('좋은 것은 흐리지 않고 풍성하게 말한다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('좋은 것은 아끼지 말고 분명하고 풍성하게');
    expect(prompt).toContain('근거 여럿이 같은 장점을 가리키면');
    expect(prompt).toContain('같은 완충 표현을 붙이지 마라');
  });

  it('현재 운은 십 년·올해·이번 달을 나눠 충분히 푼다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('대운·세운·월운이라는 이름을 쓴다');
    expect(prompt).toContain('십 년짜리 큰 흐름');
    expect(prompt).toContain('올해의 흐름');
    expect(prompt).toContain('이번 달의 흐름');
  });

  it('생활 코칭이 해석을 덮지 않게 한다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('해석이 열이면 조언은 둘 정도');
    expect(prompt).toContain('모든 문단을 지시나 숙제로 닫지 마라');
  });

  it('나쁜 흐름도 숨기지 않고 결과·신호·예방법·좋은 전환까지 말한다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('흉한 가능성도 숨기지 말고 허심탄회하게');
    expect(prompt).toContain('방치하면 실제 생활에서 어디까지 번질 수 있는지');
    expect(prompt).toContain('초기에 보이는 신호');
    expect(prompt).toContain('미리 막는 법');
    expect(prompt).toContain('잘 다루면 어떤 좋은 모습으로 바뀌는지');
  });

  it('좋은 흐름은 잘 탔을 때 벌어지는 결과까지 보여 준다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('잘 흘렀을 때 실제로 벌어지는 좋은 결과');
    expect(prompt).not.toContain('겁주거나 특정 사건을 운명처럼 못박지는 않지만');
    expect(prompt).not.toContain('겁주');
    expect(prompt).not.toContain('못박지');
  });

  it('어색하거나 낡은 절 이름을 사용자 본문에 쓰지 않는다', () => {
    const prompt = selfPrompt();

    for (const heading of ['딱 나', '채울 것', '살림법']) {
      expect(prompt, heading).not.toContain(heading);
    }
  });

  it('불확실한 것만 낮추고 확실한 장점은 낮추지 않는다', () => {
    const prompt = selfPrompt();

    expect(prompt).toContain('근거가 약하거나 서로 엇갈리면 그 부분만');
    expect(prompt).toContain('확실한 장점까지 흐리지 마라');
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
    expect(prompt).toContain('> 일을 시작하는 속도보다 끝에서 시간을 더 쓰는 편이에요.');
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
    expect(CONTROL.selfPresentation).toBe('expert-v3');
    expect(selfPrompt()).toContain('이 사주의 핵심');
    expect(selfPrompt()).not.toContain('살림법');
  });
});
