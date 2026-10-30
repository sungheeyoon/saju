import { describe, expect, it } from 'vitest';

import { OPTIONAL_CONSENTS } from './index';

import { IMPROVEMENT_OFF_CONFIRM, IMPROVEMENT_OFF_TITLE, asksBeforeTurningOff } from './off';

/**
 * **끄면 지워지는 동의만 묻는다**(ADR 0022 「2026-10-25 덧」).
 *
 * 스위치는 누르면 곧 적용된다. 묻는 자리가 늘면 「켜고 끄는」 손잡이가 매번 창을 띄우는 손잡이가 되고, 줄면 손이 스친 한 번에
 * 남긴 답이 지워진다 — 갈래 넷을 다 적어 둔다.
 */
describe('선택 동의를 끄기 전에 묻는가', () => {
  it('개선 활용을 끌 때만 묻는다 — 남긴 설문 답변이 같은 트랜잭션에서 지워진다', () => {
    expect(asksBeforeTurningOff('improvement', false)).toBe(true);
  });

  it('켜는 쪽과 테스트 소식은 묻지 않는다 — 지우는 것이 없다', () => {
    expect(asksBeforeTurningOff('improvement', true)).toBe(false);
    expect(asksBeforeTurningOff('contact', false)).toBe(false);
    expect(asksBeforeTurningOff('contact', true)).toBe(false);
  });

  /** 창이 묻는 것은 줄의 이름 그대로다 — 줄과 창이 다른 이름을 쓰면 무엇을 끄는지 다시 짝지어야 한다 */
  it('창의 제목은 줄의 이름을 들고, 실행 단추는 결과(끄고 지움)를 말한다', () => {
    const improvement = OPTIONAL_CONSENTS.find((one) => one.key === 'improvement');
    expect(IMPROVEMENT_OFF_TITLE.startsWith(improvement?.label ?? '—')).toBe(true);
    expect(IMPROVEMENT_OFF_CONFIRM).toContain('삭제');
    expect(improvement?.erasure).toContain('삭제합니다');
  });
});
