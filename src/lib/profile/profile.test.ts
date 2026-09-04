import { describe, expect, it } from 'vitest';

import {
  INTRO_MAX,
  NICKNAME_MAX,
  NICKNAME_MIN,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  initialOf,
  missingInProfile,
  nicknameKey,
} from './index';

/**
 * **여기서 재는 것은 폼과 DB 가 같은 수를 보는가**다.
 *
 * 규칙은 두 언어에 하나씩 적혀 있다 — 버튼을 잠그는 쪽(TypeScript)과 저장을 거절하는
 * 쪽(SQL). 없앨 수 없는 중복이라, 갈리면 여기서 보이게 한다.
 */
describe('프로필의 규칙 — 마이그레이션과 같은 수', () => {
  it('닉네임은 2자에서 8자다', () => {
    expect(NICKNAME_MIN).toBe(2);
    expect(NICKNAME_MAX).toBe(8);
  });

  it('소개는 300자, 사진은 512KB 까지다', () => {
    expect(INTRO_MAX).toBe(300);
    expect(PHOTO_MAX_BYTES).toBe(524288);
  });

  it('받는 형식은 셋이다', () => {
    expect([...PHOTO_TYPES]).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });
});

describe('아직 못 채운 칸', () => {
  const 이름 = (nickname: string) => missingInProfile({ nickname, intro: '' });

  it('한 자짜리도 아홉 자짜리도 아직 못 낸다', () => {
    expect(이름('김')).not.toBeNull();
    expect(이름('아홉글자짜리인이름')).not.toBeNull();
  });

  it('앞뒤 공백은 세지 않는다 — 깎은 뒤의 길이가 규칙이다', () => {
    expect(이름('  지영  ')).toBeNull();
    expect(이름('  김  ')).not.toBeNull();
  });

  it('소개는 비워도 되고, 넘치면 못 낸다', () => {
    expect(missingInProfile({ nickname: '지영', intro: '' })).toBeNull();
    expect(missingInProfile({ nickname: '지영', intro: 'ㄱ'.repeat(INTRO_MAX) })).toBeNull();
    expect(missingInProfile({ nickname: '지영', intro: 'ㄱ'.repeat(INTRO_MAX + 1) })).not.toBeNull();
  });
});

/**
 * **DB 의 `nickname_key` 와 같은 규칙이어야 한다.**
 *
 * 화면이 이 값으로 하는 일은 「방금 확인한 이름이 지금 칸에 있는 이름과 같은가」뿐이다.
 * 갈리면 확인 결과가 이미 바뀐 이름 옆에 남아 있게 된다.
 */
describe('두 이름이 같은가', () => {
  it('앞뒤 공백과 대소문자를 접는다', () => {
    expect(nicknameKey('  지영 ')).toBe(nicknameKey('지영'));
    expect(nicknameKey('MINA')).toBe(nicknameKey('mina'));
  });

  it('가운데 공백은 안 접는다 — 다른 이름이다', () => {
    expect(nicknameKey('지 영')).not.toBe(nicknameKey('지영'));
  });
});

describe('사진이 없는 자리', () => {
  it('이름의 첫 글자가 선다', () => {
    expect(initialOf('지영')).toBe('지');
    expect(initialOf('  mina ')).toBe('m');
  });

  /** 이모지 한 자가 둘로 쪼개지면 그 자리에 깨진 글자가 선다 */
  it('코드포인트가 둘인 글자도 한 자로 센다', () => {
    expect(initialOf('🌙달')).toBe('🌙');
  });

  it('이름이 없으면 빈 자리로 둔다 — 물음표를 세우지 않는다', () => {
    expect(initialOf('   ')).toBe('');
  });
});
