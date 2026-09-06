import { describe, expect, it } from 'vitest';

import { chartOf } from './chart';
import { DEFAULT_QUERY, type Query } from './query';
import {
  NOTE_MAX,
  UnreadableRevisionError,
  managedPersonArgs,
  noteOrNull,
  queryFromRevision,
  revisionArgs,
  samePillarInput,
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
    ['모르는 달력', { calendar: 'lunisolar' }, 'calendar'],
    ['모르는 출생지', { city: '평양' }, 'city'],
    ['모르는 성별', { gender: 'X' }, 'gender'],
    ['모르는 자시 규칙', { late_night_rule: 'zz' }, 'late_night_rule'],
    ['모르는 시간 기준', { time_basis: 'sundial' }, 'time_basis'],
    ['날짜 아닌 것', { solar_date: '1990/05/15' }, 'solar_date'],
    ['원본 날짜 아닌 것', { original_date: '90-5-15' }, 'original_date'],
    ['표 밖의 음력', { calendar: 'lunar', original_date: '1905-03-12', solar_date: '1905-04-12' }, 'original_date'],
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

  /**
   * 저장된 양력과 지금 표의 답이 갈리는 경우는 하나뿐이다 — 변환표가 바뀐 것.
   *
   * 조용히 새 값으로 계산하면 저장 전후의 사주가 달라지고, 조용히 옛 값을 쓰면 표가
   * 왜 바뀌었는지 아무도 모른다. 둘 다 말고 못 읽는다고 한다.
   */
  it('저장할 때 잡은 양력이 지금 표의 답과 다르면 못 읽는다', () => {
    const drifted: StoredRevision = {
      ...stored,
      calendar: 'lunar',
      original_date: '1965-03-12',
      // 진짜 답은 1965-04-13 이다. 하루 밀린 값이 저장돼 있다고 치자.
      solar_date: '1965-04-14',
    };

    expect(() => queryFromRevision(drifted, '엄마')).toThrowError(/1965-04-14.*1965-04-13/);
  });
});

describe('음력 판본', () => {
  const lunar: StoredRevision = {
    ...stored,
    calendar: 'lunar',
    original_date: '1965-03-12',
    // 1965년 정월 초하루가 양력 2월 2일이고 1월이 29일, 2월이 30일이다.
    solar_date: '1965-04-13',
  };

  it('사용자가 적은 원본을 그대로 되돌린다 — 양력으로 바꿔 놓지 않는다', () => {
    const back = queryFromRevision(lunar, '엄마');

    expect(back.calendar).toBe('lunar');
    expect(back.date).toBe('1965-03-12');
  });

  it('계산은 저장된 양력으로 한다', () => {
    // 되읽은 입력으로 계산한 명식이 저장된 양력으로 계산한 것과 같다.
    const back = queryFromRevision(lunar, '엄마');
    const asSolar: Query = { ...back, calendar: 'solar', date: '1965-04-13' };

    expect(chartOf(back).pillars).toEqual(chartOf(asSolar).pillars);
  });

  it('평달과 윤달은 다른 판본이다', () => {
    const leap: StoredRevision = { ...lunar, calendar: 'lunar_leap' };

    // 1965년의 윤달은 없다 — 그래서 못 읽는다. 평달과 같은 값으로 읽히지 않는다.
    expect(() => queryFromRevision(leap, '엄마')).toThrowError(UnreadableRevisionError);
  });

  it('저장 인자로 나갔다가 판본으로 돌아오면 같은 입력이다', () => {
    const entered: Query = { ...submitted, calendar: 'lunar', date: '1965-03-12' };
    const args = selfPersonArgs(entered);

    expect(args.p_calendar).toBe('lunar');
    expect(args.p_original_date).toBe('1965-03-12');
    expect(args.p_solar_date).toBe('1965-04-13');

    expect(
      queryFromRevision(
        {
          calendar: args.p_calendar,
          original_date: args.p_original_date,
          solar_date: args.p_solar_date,
          birth_time: `${args.p_birth_time}:00`,
          gender: args.p_gender,
          city: args.p_city,
          late_night_rule: args.p_late_night_rule,
          time_basis: args.p_time_basis,
        },
        '민수',
      ),
    ).toEqual(entered);
  });

  it('변환할 수 없는 음력은 저장 전에 거절한다', () => {
    // 2024년에는 윤달이 없다.
    const impossible: Query = { ...submitted, calendar: 'lunar_leap', date: '2024-04-01' };

    expect(unsupportedForSaving(impossible)).toMatch(/윤달이 없습니다/);
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

describe('무엇이 새 판본을 만드는가', () => {
  it('이름만 고치면 같은 판본이다 — 이름은 여덟 글자를 바꾸지 않는다', () => {
    expect(samePillarInput(submitted, { ...submitted, name: '아빠' })).toBe(true);
  });

  it('세운을 어느 해부터 보는지도 판본을 가르지 않는다', () => {
    expect(samePillarInput(submitted, { ...submitted, saeunFrom: 2000 })).toBe(true);
  });

  it.each([
    ['생년월일', { date: '1990-05-16' }],
    ['출생시각', { time: '14:31' }],
    ['시각 모름', { hourKnown: false, time: '' }],
    ['성별', { gender: 'female' as const }],
    ['출생지', { city: '부산' as const }],
    ['자시 규칙', { rule: 'ya' as const }],
    ['시간 기준', { basis: 'record' as const }],
  ])('%s 이 달라지면 다른 판본이다', (_label, patch) => {
    expect(samePillarInput(submitted, { ...submitted, ...patch })).toBe(false);
  });

  it('수정 인자에는 부를 이름이 없다', () => {
    expect(Object.keys(revisionArgs('p-1', submitted))).not.toContain('p_local_label');
  });
});

describe('가족·친구를 등록할 때 함께 가는 것', () => {
  it('판본이 될 부분은 자기 사주를 저장할 때와 **같은 값**이다', () => {
    const { p_note, ...managed } = managedPersonArgs(submitted, '음력 생일만 아신다');

    expect(managed).toEqual(selfPersonArgs(submitted));
    expect(p_note).toBe('음력 생일만 아신다');
  });

  /**
   * **무슨 사이인가는 여기 없다.** 사람이 아니라 쌍에 붙는 값이고, 묻는 자리도
   * 사람을 등록하는 곳이 아니라 궁합을 보는 곳이다.
   */
  it('사람을 등록하는 인자에 관계가 없다', () => {
    expect(Object.keys(managedPersonArgs(submitted, ''))).not.toContain('p_relation');
  });

  /**
   * 없음은 **한 값**이다.
   *
   * 빈 칸을 `''` 로 저장하면 「메모 없음」이 두 값이 되고, 그때부터 화면은 두 가지를
   * 물어야 한다. DB 검사식도 같은 것을 든다(`note_is_absent_or_written`).
   */
  it.each(['', '   ', '\n'])('빈 메모는 %j 든 null 이다', (note) => {
    expect(noteOrNull(note)).toBeNull();
    expect(managedPersonArgs(submitted, note).p_note).toBeNull();
  });

  it('메모의 앞뒤 공백은 지운다 — 길이 상한이 공백을 세지 않게', () => {
    expect(noteOrNull('  엄마는 음력  ')).toBe('엄마는 음력');
    expect(NOTE_MAX).toBe(200);
  });
});
