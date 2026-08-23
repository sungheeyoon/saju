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
 * 프롬프트가 틀리는 방식은 하나다 — **계약이 바뀌었는데 프롬프트가 안 따라온다.**
 * 그러면 자료는 새 규칙을 들고 나가는데 받는 쪽은 옛 규칙을 읽는다. 여기서 잠그는
 * 것은 문장의 아름다움이 아니라 그 어긋남이다.
 */

const saju = () =>
  computeSaju({
    year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male',
  });

const other = () =>
  computeSaju({
    year: 1992, month: 11, day: 17, hour: 5, minute: 20, second: 0, gender: 'female',
  });

const KINDS: readonly PromptKind[] = ['reading', 'now', 'compat', 'audit'];

describe('계약을 되풀이하지 않고 가리킨다', () => {
  /**
   * 사다리에 칸이 하나 생기면 이 테스트가 먼저 실패한다. 말투를 안 적으면 타입이
   * 막고(`SPEAKING_RULE`), 적었는데 프롬프트에 안 실리면 여기가 막는다.
   */
  it('사다리의 모든 칸이 이름과 우리말로 프롬프트에 선다', () => {
    for (const kind of KINDS) {
      const body = promptBodyOf(kind);

      for (const strength of CLAIM_STRENGTH_ORDER) {
        expect(body).toContain(`\`${strength}\``);
        expect(body).toContain(CLAIM_STRENGTH_KO[strength]);
      }
    }
  });

  /** 계약의 값이 손으로 적힌 것이 아니라 계약에서 온 것임을 잠근다 */
  it('계약 값이 프롬프트 안에 그대로 실린다', () => {
    for (const kind of KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain(EVIDENCE_CONTRACT.version);
      expect(body).toContain(EVIDENCE_CONTRACT.scoring);
      expect(body).toContain(EVIDENCE_CONTRACT.fortune);
    }

    // 궁합만 규칙 묶음 이름을 든다 — 점수를 안 낸다는 말을 그 이름으로 못박는다.
    expect(promptBodyOf('compat')).toContain(EVIDENCE_CONTRACT.ruleSets.compatibility);
  });

  it('바뀔 수 있는 판단이 값으로 적혀 있다', () => {
    expect(PROMPT_POLICY.ruleSet).toBe('evidence-prompt-v0');
    expect(PROMPT_POLICY.payload).toBe('minified-json');
  });
});

describe('하지 않기로 한 것을 문장으로도 못박는다', () => {
  it('네 프롬프트가 모두 점수·길흉·용신 확정을 막는다', () => {
    for (const kind of KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('점수');
      expect(body).toContain('길흉');
      expect(body).toContain('용신');
      // 상한을 넘기지 말라는 말이 사다리와 함께 선다.
      expect(body).toContain('상한');
    }
  });

  /**
   * 궁합에서 가장 흔한 요구가 점수다. 자료가 `not-scored` 를 들고 나가도 물어보는
   * 사람이 있으므로, **거절하는 법**까지 적혀 있어야 한다.
   */
  it('궁합 프롬프트는 점수를 요구받았을 때 무엇을 할지까지 적는다', () => {
    const body = promptBodyOf('compat');

    expect(body).toContain('점수를 요구받아도 내지 마라');
    expect(body).toContain('몇 점이냐');
  });

  /** 검사 프롬프트는 붙여 넣을 자리가 있어야 쓸 수 있다 */
  it('검사 프롬프트가 붙여 넣을 자리를 둔다', () => {
    expect(promptBodyOf('audit')).toContain('<<<');
    expect(promptBodyOf('audit')).toContain('>>>');
  });

  /**
   * **못 쓴 것을 적게 하는 것이 실험의 본론이다.** 모델이 상한을 느꼈는지는 쓴 글이
   * 아니라 안 쓴 것에서 드러난다.
   */
  it('자료를 읽히는 셋은 답하지 못하는 것을 적게 한다', () => {
    for (const kind of ['reading', 'now', 'compat'] as const) {
      expect(promptBodyOf(kind)).toContain('상한에 막혀 못 쓴 것');
    }
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
    expect(PROMPTS.map((p) => p.kind).sort()).toEqual([...KINDS].sort());
  });
});
