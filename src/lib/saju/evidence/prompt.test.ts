import { describe, expect, it } from 'vitest';

import { computeSaju } from '..';
import { CLAIM_STRENGTH_KO, CLAIM_STRENGTH_ORDER } from '../text/policy';
import { EVIDENCE_CONTRACT, evidenceOf } from '.';
import {
  PROMPTS,
  PROMPT_POLICY,
  promptBodyOf,
  promptWithEvidence,
  type PromptKind,
} from './prompt';

/**
 * 프롬프트 테스트.
 *
 * 틀리는 방식이 둘이다.
 *
 * 1. **계약이 바뀌었는데 프롬프트가 안 따라온다.** 자료는 새 규칙을 들고 나가는데
 *    받는 쪽은 옛 규칙을 읽는다.
 * 2. **해석용이 조용히 다시 조여진다.** 상한을 눈금으로 쓰는 문장은 한 줄만 흘러
 *    들어와도 모델이 입을 닫고, 그러면 넘길 이유가 사라진다. 해석용과 엄격용이
 *    **서로 반대 방향인지**를 여기서 잠근다.
 */

const saju = () =>
  computeSaju({
    year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male',
  });

const other = () =>
  computeSaju({
    year: 1992, month: 11, day: 17, hour: 5, minute: 20, second: 0, gender: 'female',
  });

const KINDS: readonly PromptKind[] = ['reading', 'now', 'compat', 'strict', 'audit'];

/** 자료를 읽히는 셋 — 조이는 쪽(`strict`)과 되짚는 쪽(`audit`)은 성질이 다르다 */
const READING_KINDS = ['reading', 'now', 'compat'] as const;

describe('계약을 되풀이하지 않고 가리킨다', () => {
  /**
   * 사다리에 칸이 하나 생기면 이 테스트가 먼저 실패한다. 말투를 안 적으면 타입이
   * 막고(`SPEAKING_RULE`), 적었는데 프롬프트에 안 실리면 여기가 막는다.
   */
  it('사다리의 모든 칸이 이름과 우리말로 프롬프트에 선다', () => {
    // 되짚기(`audit`)는 사다리 대신 세 갈래(자료·읽기·자료 밖)를 쓴다 — 무엇을
    // 말해도 되는가가 아니라 어디서 왔는가를 묻는 자리라서다.
    for (const kind of [...READING_KINDS, 'strict'] as const) {
      const body = promptBodyOf(kind);

      for (const strength of CLAIM_STRENGTH_ORDER) {
        expect(body).toContain(`\`${strength}\``);
        expect(body).toContain(CLAIM_STRENGTH_KO[strength]);
      }
    }
  });

  /** 계약의 값이 손으로 적힌 것이 아니라 계약에서 온 것임을 잠근다 */
  it('계약 값이 프롬프트 안에 그대로 실린다', () => {
    for (const kind of [...READING_KINDS, 'strict'] as const) {
      expect(promptBodyOf(kind)).toContain(EVIDENCE_CONTRACT.version);
    }

    // 점수를 다루는 둘만 규칙 묶음 이름을 든다 — 한쪽은 막으려고, 한쪽은
    // "우리가 안 하는 것이지 네가 못 할 일이 아니다" 를 말하려고.
    expect(promptBodyOf('compat')).toContain(EVIDENCE_CONTRACT.ruleSets.compatibility);
    expect(promptBodyOf('compat')).toContain(EVIDENCE_CONTRACT.scoring);
    expect(promptBodyOf('strict')).toContain(EVIDENCE_CONTRACT.scoring);
    expect(promptBodyOf('strict')).toContain(EVIDENCE_CONTRACT.fortune);
  });

  it('바뀔 수 있는 판단이 값으로 적혀 있다', () => {
    expect(PROMPT_POLICY.ruleSet).toBe('evidence-prompt-v1');
    expect(PROMPT_POLICY.ceiling).toBe('label-in-reading-limit-in-strict');
    expect(PROMPT_POLICY.hardRule).toBe('no-invented-facts');
  });
});

describe('해석용은 막지 않고 딱지만 붙인다', () => {
  /**
   * **이 저장소가 가장 되돌리기 쉬운 자리다.** 상한을 지키는 습관이 손에 배어 있어서,
   * 해석용 프롬프트에도 「말하지 마라」가 한 줄씩 흘러든다. 그러면 모델이 입을 닫고
   * 자료를 넘길 이유가 사라진다.
   */
  it('해석용 셋은 끝까지 읽으라고 말한다', () => {
    for (const kind of READING_KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('막지 않는다');
      expect(body).toContain('끝까지');
      // 얕은 근거에서 멈추지 않게 한다 — 여기서 멈추면 넘긴 보람이 없다.
      expect(body).toContain('얕');
    }
  });

  /** 딱 하나만 금지다 — 조심성이 아니라 참·거짓의 문제라서다 */
  it('해석용이 금지하는 것은 지어내는 것 하나뿐이다', () => {
    for (const kind of READING_KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('없는 것을 지어내지 마라');
      expect(body).toContain('참·거짓의 문제');
      // 길흉·조언을 막지 않는다고 명시한다.
      expect(body).toContain('길흉도');
    }
  });

  /**
   * 점수는 이제 거절이 아니라 **분해**를 요구한다. 자료가 안 내는 것을 모델이 내는
   * 것 자체는 실험이고, 숨기는 것이 문제다.
   */
  it('궁합은 점수를 내되 배점의 출처를 밝히게 한다', () => {
    const body = promptBodyOf('compat');

    expect(body).toContain('점수를 내 봐라');
    expect(body).toContain('한 덩어리 숫자로 내지 마라');
    expect(body).toContain('네가 만든 것이다');
  });

  /** 층은 사라지지 않는다 — 말하지 말라는 눈금에서 어디서 온 말인지 딱지로 바뀐다 */
  it('층을 문장마다 달게 한다', () => {
    for (const kind of READING_KINDS) {
      expect(promptBodyOf(kind)).toContain('[층 · 근거경로]');
    }
    // 조이는 쪽은 여전히 강도로 부른다 — 두 프롬프트가 같은 말을 하면 견줄 것이 없다.
    expect(promptBodyOf('strict')).toContain('[강도 · 근거경로]');
  });
});

describe('견줄 짝과 되짚는 자리', () => {
  /** 조인 것과 푼 것을 같은 자료로 돌려 봐야 무엇이 상한 덕인지 갈린다 */
  it('엄격용은 옛 규율을 그대로 든다', () => {
    const body = promptBodyOf('strict');

    expect(body).toContain('점수도 등급도 만들지 않는다');
    expect(body).toContain('길흉을 말하지 않는다');
    expect(body).toContain('용신을 확정하지 않는다');
    expect(body).toContain('상한에 막혀 못 쓴 것');
  });

  it('되짚기는 붙여 넣을 자리를 두고 해석 자체를 문제 삼지 않는다', () => {
    const body = promptBodyOf('audit');

    expect(body).toContain('<<<');
    expect(body).toContain('>>>');
    // 세 갈래로 가른다 — 「틀렸다」가 아니라 「어디서 왔나」다.
    expect(body).toContain('자료 밖');
    expect(body).toContain('없는 문제를 만들지 마라');
  });
});

describe('자료와 한 덩어리로 나간다', () => {
  it('규칙이 먼저 오고 자료가 뒤에 온다', () => {
    const evidence = evidenceOf({ a: saju() }, new Date('2026-08-23T04:00:00Z'));
    const text = promptWithEvidence('reading', evidence);

    expect(text.indexOf('## 반드시 지킬 것')).toBeLessThan(text.indexOf('## 자료'));
    expect(text.indexOf('## 자료')).toBeLessThan(text.indexOf('```json'));
  });

  /**
   * 들여쓰면 두 사람짜리가 네 배가 된다. 붙여 넣는 자리에서 그것은 읽기 좋음이
   * 아니라 무게다 — 자료를 눈으로 볼 자리는 화면에 따로 있다.
   */
  it('자료는 들여쓰지 않고 실린다', () => {
    const evidence = evidenceOf({ a: saju(), b: other() }, new Date('2026-08-23T04:00:00Z'));
    const text = promptWithEvidence('compat', evidence);

    expect(text).toContain(JSON.stringify(evidence));
    expect(text).not.toContain(JSON.stringify(evidence, null, 2));
  });

  /** 궁합만 두 사람이 있어야 뜻이 있다 — 화면이 그 값으로 고른다 */
  it('두 사람이 필요한 프롬프트가 값으로 표시된다', () => {
    const byKind = Object.fromEntries(PROMPTS.map((p) => [p.kind, p.needsTwo]));

    expect(byKind.compat).toBe(true);
    expect(byKind.reading).toBe(false);
    expect(byKind.strict).toBe(false);
    expect(PROMPTS.map((p) => p.kind).sort()).toEqual([...KINDS].sort());
  });
});
