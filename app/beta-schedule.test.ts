import { describe, expect, it } from 'vitest';

import { currentSchedule } from './beta-schedule';

/**
 * **일정을 읽는 문이 무엇을 `null` 로 내는가.**
 *
 * 관문과 세 화면이 이 `null` 하나로 갈래를 짓는다 — 못 읽었을 때 관문은 아무 데도 안 보내고,
 * 가입 화면은 폼을 안 세운다(ADR 0024). 문을 lib 에서 옮겨 오면서(2026-09-25) 그 셋이 그대로인지를
 * 여기서 잰다. 부른 이름까지 잰다 — 문 이름을 틀리면 PostgREST 가 오류로 답하고, 그것도 `null` 이라
 * 결과만 봐서는 안 보인다.
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

describe('지금 일정 읽기', () => {
  /** 못 읽으면 `null` — 「모른다」를 날짜인 척 흘려보내지 않는다 */
  it('못 읽으면 없는 것으로 답한다', async () => {
    expect(await currentSchedule(answering(null, { message: '끊김' }).client)).toBeNull();
    expect(await currentSchedule(answering([ROW], { message: '끊김' }).client)).toBeNull();
  });

  it('줄이 없으면 없는 것으로 답한다', async () => {
    expect(await currentSchedule(answering([]).client)).toBeNull();
    expect(await currentSchedule(answering(null).client)).toBeNull();
  });

  it('운영자 칸이 하나라도 비면 없는 것으로 답한다', async () => {
    expect(await currentSchedule(answering([{ ...ROW, operator_contact: null }]).client)).toBeNull();
    expect(await currentSchedule(answering([{ ...ROW, operator_officer: '' }]).client)).toBeNull();
    // 마이그레이션보다 앱이 먼저 배포되면 칸 자체가 없다
    expect(await currentSchedule(answering([{ ...ROW, operator_name: undefined }]).client)).toBeNull();
  });

  it('다 찬 줄은 도메인의 말로 옮겨 낸다 — 첫 줄만 본다', async () => {
    const { client, called } = answering([ROW, { ...ROW, schedule_id: 8 }]);

    expect(await currentSchedule(client)).toEqual({
      scheduleId: 7,
      dates: { endsOn: '2026-10-31', purgeBy: '2026-11-30', purgeWithinDays: 30 },
      operator: { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
    });
    expect(called).toEqual(['current_beta_schedule']);
  });
});
