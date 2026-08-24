import { describe, expect, it } from 'vitest';

import { chartOf } from './chart';
import { DEFAULT_QUERY, type Query } from './query';
import {
  UnreadableRevisionError,
  queryFromRevision,
  selfPersonArgs,
  unsupportedForSaving,
  type StoredRevision,
} from './revision';

const stored: StoredRevision = {
  calendar: 'solar',
  original_date: '1990-05-15',
  solar_date: '1990-05-15',
  birth_time: '14:30:00',
  gender: 'male',
  city: '서울',
  late_night_rule: 'jo',
  time_basis: 'localMean',
};

const submitted: Query = {
  ...DEFAULT_QUERY,
  name: '민수',
  date: '1990-05-15',
  time: '14:30',
  hourKnown: true,
  gender: 'male',
  city: '서울',
  rule: 'jo',
  basis: 'localMean',
};

describe('저장한 것을 그대로 되읽는다', () => {
  it('저장 인자로 나갔다가 판본으로 돌아오면 같은 입력이다', () => {
    const args = selfPersonArgs(submitted);

    const back = queryFromRevision(
      {
        calendar: args.p_calendar,
        original_date: args.p_original_date,
        solar_date: args.p_solar_date,
        // Postgres 는 `time` 을 초까지 붙여 돌려준다
        birth_time: args.p_birth_time === null ? null : `${args.p_birth_time}:00`,
        gender: args.p_gender,
        city: args.p_city,
        late_night_rule: args.p_late_night_rule,
        time_basis: args.p_time_basis,
      },
      args.p_local_label,
    );

    expect(back).toEqual(submitted);
  });

  /**
   * 이게 이 파일에서 제일 중요한 한 건이다.
   *
   * 값이 같은지가 아니라 **여덟 글자가 같은지**를 잰다. 되읽기가 한 칸이라도
   * 흘리면 「저장하기 전에 본 사주」와 「저장한 뒤에 보는 사주」가 달라지는데,
   * 그건 사용자가 알아채기 전에는 아무도 모르는 종류의 어긋남이다.
   */
  it('저장 전과 저장 후의 여덟 글자가 같다', () => {
    const before = chartOf(submitted);
    const after = chartOf(queryFromRevision(stored, '민수'));

    expect(after.pillars).toEqual(before.pillars);
  });

  it('시각을 모르는 판본은 모른 채로 돌아온다', () => {
    const back = queryFromRevision({ ...stored, birth_time: null }, '지영');

    expect(back.hourKnown).toBe(false);
    expect(back.time).toBe('');
    // 「아직 안 골랐다」가 아니다. 판본에 도착한 시점에는 이미 답한 것이다.
    expect(back.hourKnown).not.toBeNull();
  });

  it('부를 이름은 판본이 아니라 엣지에서 온다', () => {
    expect(queryFromRevision(stored, '아빠').name).toBe('아빠');
    expect(queryFromRevision(stored, '민수').name).toBe('민수');
  });

  it('세운 시작 연도는 저장하지 않는다 — 보기 설정이지 명식이 아니다', () => {
    expect(queryFromRevision(stored, '민수').saeunFrom).toBe(DEFAULT_QUERY.saeunFrom);
    expect(Object.keys(selfPersonArgs(submitted))).not.toContain('p_saeun_from');
  });
});

describe('못 읽는 판본은 메우지 않고 못 읽는다고 한다', () => {
  const cases: [string, Partial<StoredRevision>, keyof StoredRevision][] = [
    ['음력', { calendar: 'lunar' }, 'calendar'],
    ['모르는 출생지', { city: '평양' }, 'city'],
    ['모르는 성별', { gender: 'X' }, 'gender'],
    ['모르는 자시 규칙', { late_night_rule: 'zz' }, 'late_night_rule'],
    ['모르는 시간 기준', { time_basis: 'sundial' }, 'time_basis'],
    ['날짜 아닌 것', { solar_date: '1990/05/15' }, 'solar_date'],
    ['시각 아닌 것', { birth_time: '오후 두시' }, 'birth_time'],
  ];

  it.each(cases)('%s 은 던진다', (_label, patch, field) => {
    expect(() => queryFromRevision({ ...stored, ...patch }, '민수')).toThrowError(
      UnreadableRevisionError,
    );

    try {
      queryFromRevision({ ...stored, ...patch }, '민수');
    } catch (error) {
      // 어느 칸이 문제인지 값으로 든다 — 문장을 다시 파싱하게 하지 않는다.
      expect((error as UnreadableRevisionError).field).toBe(field);
    }
  });

  it('모르는 출생지를 서울로 치지 않는다', () => {
    // 조용히 메우면 저장할 때 본 사주와 다른 사주가 같은 화면에 나온다.
    expect(() => queryFromRevision({ ...stored, city: '평양' }, '민수')).toThrowError(/평양/);
  });
});

describe('저장 전에 거절하는 것', () => {
  it('제대로 고른 입력은 통과한다', () => {
    expect(unsupportedForSaving(submitted)).toBeNull();
  });

  it.each([
    ['성별', { gender: 'X' as Query['gender'] }],
    ['출생지', { city: '평양' as Query['city'] }],
    ['자시 규칙', { rule: 'zz' as Query['rule'] }],
    ['시간 기준', { basis: 'sundial' as Query['basis'] }],
  ])('모르는 %s 은 기본값으로 고쳐 넣지 않고 거절한다', (_label, patch) => {
    expect(unsupportedForSaving({ ...submitted, ...patch })).not.toBeNull();
  });
});
