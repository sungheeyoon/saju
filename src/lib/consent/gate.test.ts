import { describe, expect, it } from 'vitest';

import { NOTICE_VERSION } from './notice';
import { betaIsOver, gateFor, type GateAccount, type GateNotice } from './gate';

/**
 * 관문 — **브라우저 없이 전부 밟는다.**
 *
 * 이 규칙들은 레이아웃 안에 있었고, 그래서 시험이 화면을 열어야만 닿았다. 화면을 여는
 * 시험은 전체 적재로 다니므로 **앱 안 이동에서 관문이 아예 안 돈다는 사실을 한 번도
 * 못 재고 있었다**(2026-09-04). 규칙을 함수로 꺼낸 값이 이 파일이다.
 *
 * 묻는 것이 **둘로 줄었다**(ADR 0042) — 베타가 끝났나, 가입이 끝났나. 이름과 안내가
 * 각자 문을 세우던 것을 「가입」 하나가 든다.
 */
const dates = { endsOn: '2026-10-31', purgeBy: '2026-11-30', purgeWithinDays: 30 };
const notice: GateNotice = { scheduleId: 7, dates };
const during = new Date('2026-09-04T12:00:00+09:00');
const after = new Date('2026-11-01T12:00:00+09:00');

const ready: GateAccount = {
  signedUp: true,
  noticeVersion: NOTICE_VERSION,
  noticeScheduleId: 7,
};

/** 구글 로그인만 하고 아무것도 안 한 사람 — 이제 이런 계정이 실재한다 */
const fresh: GateAccount = { signedUp: false, noticeVersion: null, noticeScheduleId: null };

describe('종료일', () => {
  /** 날짜만 견주면 종료일 당일 오전에 이미 끝난 것이 된다 */
  it('종료일 당일은 아직 끝난 것이 아니다', () => {
    expect(betaIsOver(dates, new Date('2026-10-31T23:00:00+09:00'))).toBe(false);
    expect(betaIsOver(dates, new Date('2026-11-01T00:30:00+09:00'))).toBe(true);
  });
});

describe('관문이 서는 자리', () => {
  it('`/me` 밖은 안 묻는다', () => {
    for (const path of ['/', '/compat', '/privacy', '/signup', '/closed', '/auth']) {
      expect(gateFor(path, null, notice, during), path).toBeNull();
      expect(gateFor(path, fresh, notice, during), path).toBeNull();
    }
  });

  /**
   * **가입 화면 자신은 관문 밖이다.** 안에 두면 관문이 그 화면으로 보내고 그 화면이
   * 다시 관문을 지나 되돌이가 된다 — `/me` 밖에 세운 이유가 그것이다.
   */
  it('가입 화면으로는 안 튕긴다', () => {
    expect(gateFor('/signup', fresh, notice, during)).toBeNull();
  });

  /**
   * **사진은 튕기지 않는다.** 그림을 내주는 자리라 튕기면 사진이 깨지고, 하필 깨지는
   * 곳이 이름과 사진을 정하는 화면이다.
   */
  it('사진 주소는 관문 밖이다', () => {
    expect(gateFor('/me/photo/abc', fresh, notice, during)).toBeNull();
    expect(gateFor('/me/photo/abc', ready, null, during)).toBeNull();
  });

  /**
   * 계정을 못 읽은 것은 가입을 안 한 것과 **다르다.** 돌려보내면 그 화면도 못 읽어
   * 되돌이가 된다 — 화면마다 「계정을 읽지 못했습니다」라고 말할 자리가 있다.
   */
  it('계정을 못 읽으면 아무 데도 안 보낸다', () => {
    expect(gateFor('/me', null, notice, during)).toBeNull();
    expect(gateFor('/me', null, null, during)).toBeNull();
  });
});

describe('가입', () => {
  /**
   * **구글 로그인만으로는 아무 데도 못 간다.**
   *
   * 이메일 명단이 문을 지킬 때는 `auth.users` 에 아무나 못 들어왔다. 명단을 걷은 뒤로는
   * 이 상태가 실재하고, 그 사람이 갈 곳은 가입 화면 하나다.
   */
  it('가입을 안 끝냈으면 가입 화면으로 보낸다', () => {
    expect(gateFor('/me', fresh, notice, during)).toBe('/signup');
    expect(gateFor('/me/people', fresh, notice, during)).toBe('/signup');
    expect(gateFor('/me/profile', fresh, notice, during)).toBe('/signup');
    expect(gateFor('/me/settings', fresh, notice, during)).toBe('/signup');
  });

  /**
   * **가입 완료에는 「지금 안내를 확인했나」가 들어 있다.**
   *
   * 빼면 「11월에 지운다」를 읽고 확인한 사람을 이듬해까지 들고 있게 된다. 그때 폼은
   * 코드와 이름을 다시 안 묻고 확인만 받는다.
   */
  it('판본이 다르면 이미 가입한 사람도 다시 보낸다', () => {
    expect(gateFor('/me', { ...ready, noticeVersion: 'notice-v1' }, notice, during)).toBe('/signup');
  });

  /**
   * **판본과 그 줄을 둘 다 본다.** 날짜만 견주면 같은 날짜로 운영자 정보만 바꿔도
   * 안 잡힌다 — 어느 칸이 바뀌든 새 줄이 되므로 줄을 견준다.
   */
  it('본 줄이 다르면 판본이 같아도 다시 보낸다', () => {
    expect(gateFor('/me', { ...ready, noticeScheduleId: 6 }, notice, during)).toBe('/signup');
  });

  it('일정을 못 읽으면 가입 화면으로 보낸다 — 그 화면이 말할 자리다', () => {
    expect(gateFor('/me', ready, null, during)).toBe('/signup');
  });

  it('다 맞으면 안 보낸다', () => {
    expect(gateFor('/me', ready, notice, during)).toBeNull();
    expect(gateFor('/me/people', ready, notice, during)).toBeNull();
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
   * **끝난 뒤에는 가입도 안 받는다.** 끝난 서비스에 새로 들어올 이유가 없고, DB 도 그
   * 확인을 거절한다 — 물으면 `/signup` 과 `/closed` 사이를 돈다.
   */
  it('끝났으면 가입 안 한 사람도 종료 화면으로 간다', () => {
    expect(gateFor('/me', { ...ready, noticeVersion: 'notice-v1' }, notice, after)).toBe('/closed');
    expect(gateFor('/me', fresh, notice, after)).toBe('/closed');
  });
});
