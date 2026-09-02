import { describe, expect, it } from 'vitest';

import { NOTICE_VERSION, OPTIONAL_CONSENTS, noticeFor } from './notice';
import { scheduleFrom } from './schedule';

/**
 * 일정은 **표에서 온다.** 코드 상수였다가 옮겼다 — 상수는 바꾸려면 배포해야 하고,
 * 그건 「언제든」이 아니다. 날짜 계산(파기 기한)도 함께 DB 로 갔으므로 여기서 재는
 * 것은 **못 읽었을 때 무엇이 되는가**다.
 */
describe('지금 일정 읽기', () => {
  const answering = (data: unknown, error: unknown = null) => async () => ({ data, error });

  /** 못 읽으면 `null` — 「모른다」를 날짜인 척 흘려보내지 않는다 */
  it('못 읽으면 없는 것으로 답한다', async () => {
    expect(await scheduleFrom(answering(null, new Error('끊김')))).toBeNull();
    expect(await scheduleFrom(answering([]))).toBeNull();
    expect(await scheduleFrom(answering(null))).toBeNull();
  });

  /** 파기 기한을 **여기서 짓지 않는다** — DB 가 낸 값을 그대로 든다 */
  it('DB 가 낸 두 날짜를 그대로 든다', async () => {
    const dates = await scheduleFrom(
      answering([{ ends_on: '2026-10-31', purge_by: '2026-11-30', purge_within_days: 30 }]),
    );

    expect(dates).toEqual({ endsOn: '2026-10-31', purgeBy: '2026-11-30', purgeWithinDays: 30 });
  });
});

describe('안내 문구', () => {
  const dates = { endsOn: '2026-11-30', purgeBy: '2026-12-30', purgeWithinDays: 30 };
  const text = noticeFor(dates)
    .flatMap((section) => [section.title, ...section.lines])
    .join('\n');

  /** **날짜를 말한다.** 이것을 못 하면 안내를 세울 이유가 없다 */
  it('종료일과 파기 기한을 날짜로 말한다', () => {
    expect(text).toContain('2026년 11월 30일');
    expect(text).toContain('2026년 12월 30일');
  });

  /** 「추후」로 미루는 말이 들어오면 그 문장은 아무것도 약속하지 않는다 */
  it('미루는 말로 기간을 대신하지 않는다', () => {
    for (const vague of ['추후', '별도 공지', '목적 달성 시까지', '미정']) {
      expect(text, vague).not.toContain(vague);
    }
  });

  /**
   * **무엇이 나가고 무엇이 안 나가는지 갈라 말한다.**
   *
   * 「개인정보를 AI 에 보내지 않습니다」는 거짓이고 「AI 가 처리합니다」는 너무 넓다.
   * 코드가 실제로 자르는 것이 무엇인지 그대로 적는다(ADR 0008 · `redacted.ts`).
   */
  it('모델에 무엇이 가고 무엇이 안 가는지 함께 적는다', () => {
    expect(text).toContain('여덟 글자');
    expect(text).toContain('보내지 않습니다');
    expect(text).toContain('OpenAI');
  });

  /** 거부 효과 — 안 주시면 무엇이 안 되는지 */
  it('안 주시면 무엇이 안 되는지 말한다', () => {
    expect(text).toContain('제공하지 못합니다');
  });

  /** 국외 이전 — 맡기는 곳과 범위 */
  it('맡겨서 처리하는 곳을 이름으로 적는다', () => {
    expect(text).toContain('Supabase');
    expect(text).toContain('Vercel');
    expect(text).toContain('국외');
  });
});

describe('선택 항목', () => {
  /** 둘뿐이고 **거절해도 서비스는 그대로다** */
  it('둘이고 각자 무엇에 쓰는지 적혀 있다', () => {
    expect(OPTIONAL_CONSENTS.map((one) => one.key)).toEqual(['improvement', 'contact']);

    for (const one of OPTIONAL_CONSENTS) {
      expect(one.detail.length, one.key).toBeGreaterThan(30);
    }
  });

  /** 철회가 곧 지움이라는 것을 문구가 든다(ADR 0022) */
  it('개선 활용은 철회하면 지운다고 말한다', () => {
    const improvement = OPTIONAL_CONSENTS.find((one) => one.key === 'improvement');

    expect(improvement?.detail).toContain('지웁니다');
    expect(improvement?.detail).toContain('그대로');
  });

  /** 후속 연락은 **광고가 아니다** — 합치면 하나로 받아 둘 다 쓰게 된다 */
  it('후속 연락에 홍보를 섞지 않는다', () => {
    const contact = OPTIONAL_CONSENTS.find((one) => one.key === 'contact');

    expect(contact?.detail).toContain('광고나 홍보에는 쓰지 않습니다');
    expect(contact?.detail).toContain('1년');
  });
});

/** 문구가 바뀌면 판본도 바뀐다 — 「보여 준 적 있다」가 아니라 「무엇을 보여 줬나」다 */
it('안내 판본이 값으로 서 있다', () => {
  expect(NOTICE_VERSION).toMatch(/^notice-v\d+$/);
});
