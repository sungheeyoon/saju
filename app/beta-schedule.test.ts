import { describe, expect, it } from 'vitest';

import { currentSchedule } from './beta-schedule';

/**
 * **일정을 읽는 문이 무엇을 「못 읽음」으로, 무엇을 「없음」으로 내는가.**
 *
 * 관문과 세 화면이 이 둘로 갈래를 짓는다 — 못 읽었을 때 관문은 아무 데도 안 보내고, 없을 때는
 * 가입 화면으로 보낸다. 가입 화면은 둘 다 폼을 안 세운다(ADR 0024). 부른 이름까지 잰다 — 문 이름을
 * 틀리면 PostgREST 가 오류로 답하고, 결과만 봐서는 까닭이 안 보인다.
 */
const answering = (data: unknown, error: unknown = null) => {
  const called: string[] = [];
  const client = {
    rpc: async (name: string) => {
      called.push(name);
      return { data, error };
    },
  } as never;
  return { client, called };
};

const ROW = {
  schedule_id: 7,
  ends_on: '2026-10-31',
  purge_by: '2026-11-30',
  purge_within_days: 30,
  operator_name: '만세력 운영자',
  operator_officer: '홍길동',
  operator_contact: 'ops@example.com',
};

/** 읽었는데 없다 — 못 읽은 것과 다른 값 */
const NONE = { ok: true, value: null };

describe('지금 일정 읽기', () => {
  /**
   * 못 읽은 것은 **없는 것과 다른 값**이다(ADR 0078) — 관문은 못 읽었으면 아무 데도 안 보내고,
   * 없으면 가입 화면으로 보낸다. 둘을 한 `null` 로 합치면 일정 문 한 번의 실패가 가입한 사람
   * 전원을 가입 화면으로 튕긴다. 까닭은 사용자에게 보일 말로 옮겨 싣는다.
   */
  it('못 읽으면 못 읽었다고 답한다', async () => {
    expect(await currentSchedule(answering(null, { message: 'boom' }).client)).toEqual({
      ok: false,
      reason: '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    });
    expect((await currentSchedule(answering([ROW], { message: 'boom' }).client)).ok).toBe(false);
  });

  it('줄이 없으면 없는 것으로 답한다', async () => {
    expect(await currentSchedule(answering([]).client)).toEqual(NONE);
    expect(await currentSchedule(answering(null).client)).toEqual(NONE);
  });

  it('운영자 칸이 하나라도 비면 없는 것으로 답한다', async () => {
    expect(await currentSchedule(answering([{ ...ROW, operator_contact: null }]).client)).toEqual(NONE);
    expect(await currentSchedule(answering([{ ...ROW, operator_officer: '' }]).client)).toEqual(NONE);
    // 마이그레이션보다 앱이 먼저 배포되면 칸 자체가 없다
    expect(await currentSchedule(answering([{ ...ROW, operator_name: undefined }]).client)).toEqual(NONE);
  });

  it('다 찬 줄은 도메인의 말로 옮겨 낸다 — 첫 줄만 본다', async () => {
    const { client, called } = answering([ROW, { ...ROW, schedule_id: 8 }]);

    expect(await currentSchedule(client)).toEqual({
      ok: true,
      value: {
        scheduleId: 7,
        dates: { endsOn: '2026-10-31', purgeBy: '2026-11-30', purgeWithinDays: 30 },
        operator: { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
      },
    });
    expect(called).toEqual(['current_beta_schedule']);
  });
});
