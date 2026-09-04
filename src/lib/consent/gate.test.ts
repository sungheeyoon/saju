import { describe, expect, it } from 'vitest';

import { NOTICE_VERSION } from './notice';
import { betaIsOver, gateFor, type GateAccount, type GateNotice } from './gate';

/**
 * 관문 — **브라우저 없이 전부 밟는다.**
 *
 * 이 규칙들은 레이아웃 안에 있었고, 그래서 시험이 화면을 열어야만 닿았다. 화면을 여는
 * 시험은 전체 적재로 다니므로 **앱 안 이동에서 관문이 아예 안 돈다는 사실을 한 번도
 * 못 재고 있었다**(2026-09-04). 규칙을 함수로 꺼낸 값이 이 파일이다.
 */
const dates = { endsOn: '2026-10-31', purgeBy: '2026-11-30', purgeWithinDays: 30 };
const notice: GateNotice = { scheduleId: 7, dates };
const during = new Date('2026-09-04T12:00:00+09:00');
const after = new Date('2026-11-01T12:00:00+09:00');

const ready: GateAccount = {
  nickname: '민수',
  noticeVersion: NOTICE_VERSION,
  noticeScheduleId: 7,
};

describe('종료일', () => {
  /** 날짜만 견주면 종료일 당일 오전에 이미 끝난 것이 된다 */
  it('종료일 당일은 아직 끝난 것이 아니다', () => {
    expect(betaIsOver(dates, new Date('2026-10-31T23:00:00+09:00'))).toBe(false);
    expect(betaIsOver(dates, new Date('2026-11-01T00:30:00+09:00'))).toBe(true);
  });
});

describe('관문이 서는 자리', () => {
  it('`/me` 밖은 안 묻는다', () => {
    for (const path of ['/', '/compat', '/privacy', '/welcome', '/closed', '/auth']) {
      expect(gateFor(path, null, notice, during), path).toBeNull();
      expect(gateFor(path, { ...ready, nickname: null }, notice, during), path).toBeNull();
    }
  });

  /**
   * **사진은 튕기지 않는다.** 그림을 내주는 자리라 튕기면 사진이 깨지고, 하필 깨지는
   * 곳이 이름과 사진을 정하는 화면이다.
   */
  it('사진 주소는 관문 밖이다', () => {
    expect(gateFor('/me/photo/abc', { ...ready, nickname: null }, notice, during)).toBeNull();
    expect(gateFor('/me/photo/abc', ready, null, during)).toBeNull();
  });

  /**
   * 계정을 못 읽은 것은 안내를 안 본 것과 **다르다.** 돌려보내면 그 화면도 못 읽어
   * 되돌이가 된다 — 화면마다 「계정을 읽지 못했습니다」라고 말할 자리가 있다.
   */
  it('계정을 못 읽으면 아무 데도 안 보낸다', () => {
    expect(gateFor('/me', null, notice, during)).toBeNull();
    expect(gateFor('/me', null, null, during)).toBeNull();
  });
});

describe('안내', () => {
  it('판본이 다르면 안내로 보낸다', () => {
    expect(gateFor('/me', { ...ready, noticeVersion: 'notice-v1' }, notice, during)).toBe('/welcome');
  });

  /**
   * **판본과 그 줄을 둘 다 본다.** 날짜만 견주면 같은 날짜로 운영자 정보만 바꿔도
   * 안 잡힌다 — 어느 칸이 바뀌든 새 줄이 되므로 줄을 견준다.
   */
  it('본 줄이 다르면 판본이 같아도 안내로 보낸다', () => {
    expect(gateFor('/me', { ...ready, noticeScheduleId: 6 }, notice, during)).toBe('/welcome');
  });

  it('일정을 못 읽으면 안내로 보낸다 — 그 화면이 말할 자리다', () => {
    expect(gateFor('/me', ready, null, during)).toBe('/welcome');
  });

  it('다 맞으면 안 보낸다', () => {
    expect(gateFor('/me', ready, notice, during)).toBeNull();
  });
});

describe('이름', () => {
  it('이름이 없으면 짓는 화면으로 보낸다', () => {
    expect(gateFor('/me', { ...ready, nickname: null }, notice, during)).toBe('/me/profile');
    expect(gateFor('/me/people', { ...ready, nickname: null }, notice, during)).toBe('/me/profile');
  });

  /**
   * 예외는 둘이다 — 이름을 짓는 화면 자신과, 나가는 길. 이름을 안 지었다는 이유로
   * **로그아웃과 삭제 요청까지 막으면** 들어오지도 나가지도 못한다.
   */
  it('이름 짓는 화면과 계정 관리는 열린다', () => {
    expect(gateFor('/me/profile', { ...ready, nickname: null }, notice, during)).toBeNull();
    expect(gateFor('/me/settings', { ...ready, nickname: null }, notice, during)).toBeNull();
  });

  /** 안내가 먼저다 — 안내를 안 본 사람에게 이름부터 물으면 순서가 뒤집힌다 */
  it('안내가 이름보다 앞선다', () => {
    expect(
      gateFor('/me', { nickname: null, noticeVersion: 'notice-v1', noticeScheduleId: 7 }, notice, during),
    ).toBe('/welcome');
  });
});

describe('종료', () => {
  it('끝났으면 끝났다고 말하는 자리로 보낸다', () => {
    expect(gateFor('/me', ready, notice, after)).toBe('/closed');
    expect(gateFor('/me/people', ready, notice, after)).toBe('/closed');
  });

  /**
   * **끝나도 계정 관리는 연다.** 종료일과 파기 사이는 자료가 아직 남아 있는 기간이고,
   * 그때야말로 철회와 삭제 요청이 필요하다.
   */
  it('끝나도 계정 관리는 열린다', () => {
    expect(gateFor('/me/settings', ready, notice, after)).toBeNull();
  });

  /**
   * **끝난 뒤에는 안내를 다시 안 묻는다.** 끝난 서비스의 안내를 새로 확인받을 이유가
   * 없고, DB 도 그 확인을 거절한다 — 물으면 `/welcome` 과 `/closed` 사이를 돈다.
   */
  it('끝났으면 낡은 판본도 안내로 안 보낸다', () => {
    expect(gateFor('/me', { ...ready, noticeVersion: 'notice-v1' }, notice, after)).toBe('/closed');
    expect(gateFor('/me', { ...ready, nickname: null }, notice, after)).toBe('/closed');
  });
});
