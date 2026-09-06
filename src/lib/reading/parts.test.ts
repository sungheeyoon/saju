import { describe, expect, it } from 'vitest';

import { EVIDENCE_CONTRACT } from '../saju/evidence';
import { CLAIM_STRENGTH_KO, CLAIM_STRENGTH_ORDER } from '../saju/text/policy';
import { PROMPT_PARTS } from './parts';
import { READING_KINDS, READING_PROMPTS } from '.';

/**
 * 지시문 조각을 잰다 — **이 시험이 재는 대상이 바뀌었다**(ADR 0047).
 *
 * 전에는 `promptBodyOf` 로 지은, OpenAI 로 한 번도 안 가는 프롬프트 다섯 벌을 재고
 * 있었다. 그것들이 사라졌으므로 여기서는 둘로 나눠 잰다.
 *
 * 1. **조각 자체가 무엇을 시키는가** — 조각에 대고 직접 잰다.
 * 2. **그 조각이 실제로 나가는 글에 닿는가** — `READING_PROMPTS` 에 대고 잰다.
 *
 * 둘을 갈라 두는 까닭은 조각마다 닿는 자리가 다르기 때문이다. `voice` 는 기준판에
 * 안 닿는다(아래).
 */

describe('계약을 되풀이하지 않고 가리킨다', () => {
  /**
   * 사다리에 칸이 하나 생기면 이 시험이 먼저 실패한다. 말투를 안 적으면 타입이 막고,
   * 적었는데 지시문에 안 실리면 여기가 막는다.
   */
  it('사다리의 모든 칸이 이름과 우리말로 선다', () => {
    for (const strength of CLAIM_STRENGTH_ORDER) {
      expect(PROMPT_PARTS.rules).toContain(`\`${strength}\``);
      expect(PROMPT_PARTS.rules).toContain(CLAIM_STRENGTH_KO[strength]);
    }
  });

  /** 계약의 값이 손으로 적힌 것이 아니라 계약에서 온 것임을 잠근다 */
  it('계약 값이 지시문 안에 그대로 실린다', () => {
    expect(PROMPT_PARTS.rules).toContain(EVIDENCE_CONTRACT.version);
  });
});

describe('해석용은 막지 않고 딱지만 붙인다', () => {
  /**
   * **이 저장소가 가장 되돌리기 쉬운 자리다.** 상한을 지키는 습관이 손에 배어 있어서
   * 「말하지 마라」가 한 줄씩 흘러든다. 그러면 모델이 입을 닫고 자료를 넘길 이유가
   * 사라진다.
   */
  it('끝까지 읽으라고 말한다', () => {
    expect(PROMPT_PARTS.rules).toContain('막지 않는다');
    expect(PROMPT_PARTS.rules).toContain('끝까지');
    expect(PROMPT_PARTS.rules).toContain('얕');
  });

  /** 딱 하나만 금지다 — 조심성이 아니라 참·거짓의 문제라서다 */
  it('금지하는 것은 지어내는 것 하나뿐이다', () => {
    expect(PROMPT_PARTS.rules).toContain('없는 것을 지어내지 마라');
    expect(PROMPT_PARTS.rules).toContain('참·거짓의 문제');
    expect(PROMPT_PARTS.rules).toContain('길흉도');
  });

  /**
   * **딱지는 사라지지 않고 자리를 옮긴다.** 문장마다 `[사실 · charts.a.pillars]` 가
   * 붙은 글은 읽히지 않는다 — 그렇다고 없애면 어디서 온 말인지 알 수 없어 실험의
   * 절반이 날아간다. 본문에서 빼고 맨 끝에 모은다.
   */
  it('딱지를 본문에서 빼고 맨 끝에 모은다', () => {
    expect(PROMPT_PARTS.rules).toContain('본문에 달지 말고');
    expect(PROMPT_PARTS.closing).toContain('### 근거 (검사용)');
  });

  /**
   * **경로만 적게 하면 「어디를 봤는지」만 남는다.** 사다리를 출처에 달아 놓으면
   * 정작 문장이 주장한 것은 아무 딱지도 없이 지나간다.
   */
  it('근거 줄이 결론과 출처와 넘어간 것을 갈라 적게 한다', () => {
    expect(PROMPT_PARTS.closing).toContain('결론 「…」');
    expect(PROMPT_PARTS.closing).toContain('넘어간 것');
    expect(PROMPT_PARTS.closing).toContain('**층은 자료 칸에만 단다.**');
  });

  /** 이름을 못 대는 절은 그 관계에서 나온 결론이 아닐 가능성이 크다 */
  it('관계를 근거로 들 때 이름을 대게 한다', () => {
    expect(PROMPT_PARTS.closing).toContain('관계를 들 때는 이름을 댄다');
  });
});

describe('조각이 실제로 나가는 글에 닿는다', () => {
  it('규칙과 끝자리는 모든 풀이에 선다', () => {
    for (const kind of READING_KINDS) {
      expect(READING_PROMPTS[kind], kind).toContain(PROMPT_PARTS.rules);
      expect(READING_PROMPTS[kind], kind).toContain(PROMPT_PARTS.closing);
    }
  });

  /** 공유 궁합은 성격을 안 읽는다 — 동의 범위 밖이다 */
  it('성격 절은 공유 궁합에만 안 선다', () => {
    for (const kind of READING_KINDS) {
      if (kind === 'match') {
        expect(READING_PROMPTS[kind]).not.toContain(PROMPT_PARTS.personality);
      } else {
        expect(READING_PROMPTS[kind], kind).toContain(PROMPT_PARTS.personality);
      }
    }
  });

  /**
   * **`voice` 는 기준판에 안 닿는다 — 값으로 적어 둔다.**
   *
   * `CONTROL.selfPresentation` 이 `expert-v4` 라 자기 풀이는 `selfCustomerVoice` 를,
   * 궁합은 `relationshipCustomerVoice` 를 쓴다(ADR 0029·0044). 이 조각은 `legacy-v1`
   * 판본으로만 선다.
   *
   * 지우지 않는 까닭은 되돌릴지 판단하려면 **그 판이 무엇을 시켰는지가 남아 있어야**
   * 하기 때문이다(ADR 0046 이 `annotated` 를 남긴 것과 같다). 다만 그것이 안 나간다는
   * 사실은 어딘가에 적혀 있어야 하고, 여기가 그 자리다.
   */
  it('말투 조각은 기준판에 안 선다', () => {
    for (const kind of READING_KINDS) {
      expect(READING_PROMPTS[kind], kind).not.toContain(PROMPT_PARTS.voice);
    }
  });
});
