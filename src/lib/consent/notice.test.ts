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

  const full = {
    ends_on: '2026-10-31',
    purge_by: '2026-11-30',
    purge_within_days: 30,
    operator_name: '만세력 운영자',
    operator_officer: '홍길동',
    operator_contact: 'ops@example.com',
  };

  /** 못 읽으면 `null` — 「모른다」를 날짜인 척 흘려보내지 않는다 */
  it('못 읽으면 없는 것으로 답한다', async () => {
    expect(await scheduleFrom(answering(null, new Error('끊김')))).toBeNull();
    expect(await scheduleFrom(answering([]))).toBeNull();
    expect(await scheduleFrom(answering(null))).toBeNull();
  });

  /** 파기 기한을 **여기서 짓지 않는다** — DB 가 낸 값을 그대로 든다 */
  it('DB 가 낸 값을 그대로 든다', async () => {
    expect(await scheduleFrom(answering([full]))).toEqual({
      dates: { endsOn: '2026-10-31', purgeBy: '2026-11-30', purgeWithinDays: 30 },
      operator: { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
    });
  });

  /**
   * **반쪽은 안 낸다.** 날짜만 있고 연락처가 없으면 열람·정정·삭제를 어디에 요구하는지
   * 말할 수 없다 — 그런 안내는 지키는 것이 없는 문장만 남는다.
   */
  it('운영자가 비어 있으면 안내가 안 선다', async () => {
    expect(await scheduleFrom(answering([{ ...full, operator_contact: null }]))).toBeNull();
    expect(await scheduleFrom(answering([{ ...full, operator_name: null }]))).toBeNull();
  });
});

describe('안내 문구', () => {
  const dates = { endsOn: '2026-11-30', purgeBy: '2026-12-30', purgeWithinDays: 30 };
  const operator = { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' };
  const text = noticeFor(dates, operator)
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

/**
 * 처리방침이 갖춰야 하는 것들 — **없으면 지키는 것이 없는 문장만 남는다.**
 *
 * 「무엇을 받는다」만 적고 누구에게 무엇을 요구하는지 안 적으면, 열람·정정·삭제는
 * 적혀만 있는 권리가 된다. 국외로 나가는데 어디로 얼마나 가는지 안 적으면 「보냅니다」가
 * 아무것도 알리지 않는다.
 */
describe('처리방침이 갖춰야 하는 것', () => {
  const operator = { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' };
  const dates = { endsOn: '2026-10-31', purgeBy: '2026-11-30', purgeWithinDays: 30 };
  const text = noticeFor(dates, operator)
    .flatMap((section) => [section.title, ...section.lines])
    .join('\n');

  it('누구에게 말하면 되는지 적는다', () => {
    expect(text).toContain(operator.name);
    expect(text).toContain(operator.officer);
    expect(text).toContain(operator.contact);
  });

  it('권리와 행사 방법을 적는다', () => {
    for (const right of ['열람', '정정', '삭제', '처리정지']) {
      expect(text, right).toContain(right);
    }
  });

  it('파기 절차와 방법을 적는다', () => {
    expect(text).toContain('파기 절차와 방법');
    expect(text).toContain('복구할 수 없습니다');
  });

  /** 국외 이전은 **항목·국가·시기·목적·기간·거부**가 다 있어야 한다 */
  it('국외로 나가는 곳마다 여섯 가지를 다 적는다', () => {
    for (const where of ['Supabase', 'Vercel', 'OpenAI']) {
      expect(text, where).toContain(where);
    }
    expect(text).toContain('미국');
    expect(text).toContain('이전 항목');
    expect(text).toContain('이전 시기와 방법');
    expect(text).toContain('보유기간');
    expect(text).toContain('거부하실 수 있습니다');
  });

  /**
   * **거부의 효과를 숨기지 않는다.** 「거부할 수 있습니다」만 적고 그러면 무엇이
   * 안 되는지 안 적으면, 고를 수 있는 것처럼 보이는 것을 고르게 된다.
   */
  it('거부하면 무엇이 안 되는지도 적는다', () => {
    expect(text).toContain('이용하실 수 없습니다');
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
