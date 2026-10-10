import { describe, expect, it } from 'vitest';

import { refusedField } from './refusal';

/** `complete_signup` 의 거절 문장(`20261105090000`) 그대로 — 칸을 고르는 말이 문장 안에 있는지 잰다 */
describe('가입 거절은 그 칸 곁에 선다', () => {
  it('닉네임 중복 · 길이는 닉네임 칸', () => {
    expect(refusedField('23505', '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.')).toBe('nickname');
    expect(refusedField('22023', '닉네임을 2~8자로 입력해 주세요.')).toBe('nickname');
  });

  it('빈 코드 · 못 쓰는 코드 · 여러 번 틀림 · 정원은 코드 칸', () => {
    expect(refusedField('22023', '테스트 코드를 넣어 주세요.')).toBe('code');
    expect(refusedField('42501', '사용할 수 없는 코드예요. 코드를 다시 확인해 주세요.')).toBe('code');
    expect(refusedField('42501', '코드를 여러 번 잘못 입력했어요. 한 시간 뒤 다시 시도해 주세요.')).toBe('code');
    expect(refusedField('42501', '오늘 이 코드로 들어올 수 있는 인원이 다 찼어요.')).toBe('code');
  });

  it('정지 · 안내가 바뀜 · 알 수 없는 오류는 칸이 없다', () => {
    expect(refusedField('42501', '이용이 정지된 계정입니다.')).toBeNull();
    expect(refusedField('23514', '안내가 바뀌었어요. 새로고침한 뒤 다시 확인해 주세요.')).toBeNull();
    expect(refusedField(undefined, '요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')).toBeNull();
  });
});
