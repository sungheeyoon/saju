import { describe, expect, it } from 'vitest';

import { EVIDENCE_CONTRACT } from '../saju/evidence';
import { CLAIM_STRENGTH_KO, CLAIM_STRENGTH_ORDER } from '../saju/text/policy';
import { PROMPT_PARTS } from './parts';
import { READING_KINDS, READING_POLICY, READING_PROMPTS, isSolo } from '.';

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

/**
 * **조각은 앞뒤로 빈 줄을 물지 않는다.**
 *
 * 조립기가 `'\n\n'` 으로 잇는다. 조각이 제 끝에 줄바꿈을 하나 더 들고 있으면 그 자리에만
 * 빈 줄이 둘이 되는데, **눈으로는 안 보이고 글자 수로만 드러난다.**
 *
 * 실제로 겪었다. `PERSONALITY` 에서 강도 절을 떼어 낼 때 남은 꼬리 줄바꿈 하나가 그대로
 * 붙어서, **기준판 프롬프트가 한 글자 길어진 채로** 통과할 뻔했다. 「기준판은 안 바뀐다」가
 * 그 라운드의 전제였는데 그것이 조용히 거짓이 되는 자리였다.
 */
describe('조각은 이음매를 더럽히지 않는다', () => {
  it.each(Object.keys(PROMPT_PARTS))('%s — 앞뒤에 군더더기 공백이 없다', (name) => {
    const part = PROMPT_PARTS[name as keyof typeof PROMPT_PARTS];

    expect(part).toBe(part.trim());
  });
});

describe('조각이 실제로 나가는 글에 닿는다', () => {
  it('규칙과 끝자리는 모든 풀이에 선다', () => {
    for (const kind of READING_KINDS) {
      expect(READING_PROMPTS[kind], kind).toContain(PROMPT_PARTS.rules);
      expect(READING_PROMPTS[kind], kind).toContain(PROMPT_PARTS.closing);
    }
  });

  /**
   * **성격 읽는 순서가 서는 자리는 이제 자기 풀이뿐이다.**
   *
   * 공유 궁합은 동의 범위 밖이라 처음부터 안 섰다. 비공개 궁합은 절을 걷으면서 함께
   * 내렸다 — 「해석은 네가 하라」면서 읽는 순서는 시키는 것이 앞뒤가 안 맞기 때문이다.
   *
   * **강도(`claimStrength`)는 넷 중 셋에 그대로 선다.** 한동안 이 문자열에 같이 살던
   * 것을 갈랐다 — 그쪽은 근거가 몇 갈래냐로 말의 세기를 정하는 **경계**라 구성 지시와
   * 함께 내려가면 안 된다.
   */
  it('성격 읽는 순서는 자기 풀이에만 서고 강도는 궁합에도 선다', () => {
    for (const kind of READING_KINDS) {
      if (isSolo(kind)) {
        expect(READING_PROMPTS[kind], kind).toContain(PROMPT_PARTS.personality);
      } else {
        expect(READING_PROMPTS[kind], kind).not.toContain(PROMPT_PARTS.personality);
      }

      if (kind !== 'match') {
        expect(READING_PROMPTS[kind], kind).toContain(PROMPT_PARTS.claimStrength);
      }
    }
  });

});

/**
 * **검사가 막는 값은 프롬프트가 말해야 한다.**
 *
 * 프로덕션에서 자기 풀이가 떨어졌다 — 검사는 비유를 60자로 막고 있었는데 **지시문에는
 * 길이가 한 줄도 없었다.** 모델이 63자를 쓰자 다 만든 글이 버려졌다. 지킬 방법이 없는
 * 계약이었고, 토큰은 나가고 글은 안 남았다.
 *
 * 「계약이 엔진을 안 따라오면 그 값은 검증되지 않는다」의 새 얼굴이다 — 이번에는
 * **계약이 프롬프트를 안 따라왔다.** 그래서 여기서 그 짝을 잰다: 시키는 값이 실제로
 * 네 kind 의 지시문에 적혀 있는가.
 *
 * 그리고 **시키는 값과 막는 값이 다르다는 것**도 함께 못박는다. 같으면 「한 자 넘었다」가
 * 곧 실패가 되고, 그것이 방금 겪은 그 일이다.
 */
describe('시키는 값과 막는 값', () => {
  it('비유 길이를 네 kind 모두에게 말한다', () => {
    const { target } = READING_POLICY.metaphorLength;

    for (const kind of READING_KINDS) {
      expect(READING_PROMPTS[kind], kind).toContain(`${target}자 안팎`);
    }
  });

  it('막는 값이 시키는 값보다 넉넉하다 — 한 자 넘었다고 버리지 않는다', () => {
    const { target, max } = READING_POLICY.metaphorLength;

    expect(max).toBeGreaterThan(target);
    /* 「조금 길다」가 아니라 「한 문장이 아니다」를 막는 자리다 — 두 배는 떨어져 있어야 한다 */
    expect(max).toBeGreaterThanOrEqual(target * 2);
  });

  it('한 줄 요약은 비유 없이 대상 고유의 작동 방식을 직접 말한다', () => {
    expect(READING_PROMPTS.self).toContain('이 사람의 핵심 작동 방식');
    expect(READING_PROMPTS.private).toContain('이 관계의 핵심 작동 방식');

    for (const kind of READING_KINDS) {
      expect(READING_PROMPTS[kind], kind).toContain('## 한 줄 요약');
      expect(READING_PROMPTS[kind], kind).toContain('비유하지 말고 직접 요약한다');
      expect(READING_PROMPTS[kind], kind).toContain('자연 풍경이나 오행의 물상');
      expect(READING_PROMPTS[kind], kind).toContain('누구에게나 붙는 운세 문구는 실패다');
      expect(READING_PROMPTS[kind], kind).not.toContain('## 한마디로 빗대면');
      expect(READING_PROMPTS[kind], kind).not.toContain('비유의 소재와 문장 꼴은 자유롭게 고른다');
    }
  });

  /**
   * **뒤집힌 시험이다.** 전에는 후보 카드의 점수가 프롬프트에 **드는 것을 막았다** —
   * 「넣으면 모델 점수가 앞선 숫자를 따라가고, 그러면 AI 가 스스로 종합하면 무엇이
   * 나오는가를 못 잰다」가 까닭이었다.
   *
   * 그 실험은 돌았고 답이 나왔다(ADR 0052: 열한 번 전부 62~68). 이제 「앞선 숫자를
   * 따라간다」는 막을 것이 아니라 **노리는 것**이다 — 카드에서 74 를 본 사람이 풀이권을
   * 쓰고 65 를 받으면 안 된다.
   *
   * 몸통에 드는 것은 **규칙과 조정표**뿐이다. 짝마다 다른 기준점 한 수는 몸통에 못 굽고
   * `readingPromptOf` 가 붙이므로, `READING_PROMPTS` 는 그대로 캐시된다.
   */
  it('궁합 몸통은 기준점 위에서 항목별로 움직이라고 시킨다', () => {
    for (const kind of ['private', 'match'] as const) {
      const prompt = READING_PROMPTS[kind];
      expect(prompt, kind).toContain('## 점수');
      expect(prompt, kind).toContain('기준점에서 시작해 항목별로 더하고 뺀다');
      // 조정표의 여덟 항목이 다 선다 — 하나가 빠지면 모델은 그 자료를 안 본다
      for (const item of [
        '육합·삼합·방합',
        '두 사람이 함께 이룬 삼합·방합',
        '형·해·파·원진·귀문',
        '함께 이룬 삼형',
        '십성이 한쪽으로만 기운 자리',
        '용신을 상대가 가졌다',
        '둘 다 없는 오행',
      ]) {
        expect(prompt, `${kind}/${item}`).toContain(item);
      }
    }
  });

  /**
   * **막는 값을 프롬프트가 말한다.** 이 저장소가 겪은 실패가 「검사가 60자를 막는데
   * 프롬프트는 길이를 한 번도 안 말한 것」이었다 — 지킬 방법이 없는 계약이었고 토큰은
   * 나가고 글은 버려졌다. 상한을 손으로 적지 않고 정책에서 꽂는지 함께 붙든다.
   */
  it('조정 상한은 검사가 무는 수를 그대로 적는다', () => {
    for (const kind of ['private', 'match'] as const) {
      expect(READING_PROMPTS[kind], kind).toContain(
        `조정의 합은 -${READING_POLICY.scoreAdjustment} ~ +${READING_POLICY.scoreAdjustment} 를 넘지 않는다`,
      );
    }
  });

  /**
   * **기준점을 그대로 뱉으면 풀이권이 아무것도 안 산다.** 앵커가 세면 모델은 움직이지
   * 않는다 — 그 자리를 규칙으로 막는지 본다.
   */
  it('적어도 한 항목은 움직이라고 시킨다', () => {
    for (const kind of ['private', 'match'] as const) {
      expect(READING_PROMPTS[kind], kind).toContain('적어도 한 항목은 움직인다');
      expect(READING_PROMPTS[kind], kind).toContain('기준점을 그대로 내지 마라');
    }
  });

  /**
   * 점수가 **본문에서 빠졌다.** 전에는 「맨 마지막 대목은 점수다」로 본문 절을 시켰는데,
   * `readingBody()` 가 `### 근거` 앞에서만 자르므로 그 절이 사용자에게 그대로 나갔다 —
   * 화면이 세우는 `score` 와 같은 수가 두 번 서고 둘이 갈려도 검사는 필드만 봤다.
   */
  it('점수 대목을 본문에 세우지 않는다', () => {
    for (const kind of ['private', 'match'] as const) {
      expect(READING_PROMPTS[kind], kind).not.toContain('맨 마지막 대목은 **점수**다');
      expect(READING_PROMPTS[kind], kind).toContain('본문에 점수 대목을 따로 세우지 말고');
    }
  });
});
