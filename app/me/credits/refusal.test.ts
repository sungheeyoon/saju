import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { OUT_OF_CREDITS_REFUSALS, refusedForCredits } from './refusal';

const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations');

describe('refusedForCredits', () => {
  it('풀이를 여는 문이 잔액으로 막은 거절을 알아본다', () => {
    expect(refusedForCredits({ code: '23514', message: '풀이권을 다 쓰셨습니다. 테스트 기간에는 5번까지 만들 수 있어요.' })).toBe(true);
  });

  it('인연 요청이 잔액으로 막힌 거절을 알아본다', () => {
    expect(
      refusedForCredits({
        code: '23514',
        message: '풀이권이 없어 요청할 수 없습니다. 요청 한 건이 풀이권 한 번을 잡고, 동의가 나면 그 한 번으로 궁합 풀이가 만들어집니다.',
      }),
    ).toBe(true);
  });

  it('같은 코드의 다른 거절은 풀이권 창이 아니다 — 보낸 요청이 잡은 몫은 거두거나 기다릴 일이다', () => {
    expect(refusedForCredits({ code: '23514', message: '보낸 인연 요청이 풀이권을 잡고 있어요. 요청을 거두거나 상대의 답을 기다려 주세요.' })).toBe(false);
  });

  it('문장이 같아도 코드가 다르면 아니다', () => {
    expect(refusedForCredits({ code: 'P0001', message: '풀이권을 다 쓰셨습니다.' })).toBe(false);
    expect(refusedForCredits({ code: null, message: null })).toBe(false);
  });

  /** 앞머리는 DB 가 쓴 문장이다 — 마이그레이션이 그 문장을 바꾸면 여기서 붉다 */
  it('앞머리마다 그 문장을 check_violation 으로 던지는 마이그레이션이 있다', () => {
    const sources = readdirSync(MIGRATIONS)
      .filter((one) => one.endsWith('.sql'))
      .map((one) => readFileSync(resolve(MIGRATIONS, one), 'utf8'));
    for (const lead of OUT_OF_CREDITS_REFUSALS) {
      expect(sources.some((source) => source.includes(`raise exception '${lead}`)), lead).toBe(true);
    }
  });
});
