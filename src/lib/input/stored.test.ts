import { describe, expect, it, vi } from 'vitest';

/**
 * **달력이 터지면 어떻게 되는가.**
 *
 * 평소에는 진짜 달력이 돈다(`boom` 이 꺼져 있다). 한 시험만 그 자리를 터뜨려서,
 * 표 밖의 음력이 아닌 **진짜 버그**가 「못 읽는 입력」으로 둔갑하지 않는지 잰다.
 */
const calendar = vi.hoisted(() => ({ boom: false }));

vi.mock('./chart', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./chart')>();

  return {
    ...actual,
    solarDateOf: (query: Parameters<typeof actual.solarDateOf>[0]) => {
      if (calendar.boom) throw new TypeError('달력 표가 깨졌다');
      return actual.solarDateOf(query);
    },
  };
});

import { chartOf } from './chart';
import { DEFAULT_QUERY, type Query } from './query';
import { selfPersonArgs } from './edit';
import { storedChartOf, type StoredInput } from './stored';

const stored: StoredInput = {
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

/** 세워진 것을 집는다 — 못 세웠으면 시험을 거기서 멈춘다 */
function stood(input: StoredInput, label = '민수') {
  const result = storedChartOf(input, label);
  if (!result.ok) throw new Error(`세우지 못했다: ${result.message}`);
  return result;
}

describe('저장한 것을 그대로 되읽는다', () => {
  it('저장 인자로 나갔다가 돌아오면 같은 입력이다', () => {
    const args = selfPersonArgs(submitted);

    const back = stood(
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

    expect(back.query).toEqual(submitted);
  });

  /**
   * 이게 이 파일에서 제일 중요한 한 건이다.
   *
   * 값이 같은지가 아니라 **여덟 글자가 같은지**를 잰다. 되읽기가 한 칸이라도
   * 흘리면 「저장하기 전에 본 사주」와 「저장한 뒤에 보는 사주」가 달라지는데,
   * 그건 사용자가 알아채기 전에는 아무도 모르는 종류의 어긋남이다.
   */
  it('저장 전과 저장 후의 여덟 글자가 같다', () => {
    expect(stood(stored).saju.pillars).toEqual(chartOf(submitted).pillars);
  });

  /**
   * **명식을 이 문이 함께 세운다.**
   *
   * 입력만 내주면 `chartOf` 호출이 화면마다 흩어지고, 그러면 한쪽만 다른 인자로
   * 세는 날이 온다. 여기서 나온 명식이 같은 입력을 직접 센 것과 같은지를 잠근다.
   */
  it('함께 나오는 명식은 그 입력을 직접 센 것과 같다', () => {
    const one = stood(stored);

    expect(one.saju.pillars).toEqual(chartOf(one.query).pillars);
  });

  it('시각을 모르는 입력은 모른 채로 돌아온다', () => {
    const back = stood({ ...stored, birth_time: null }, '지영').query;

    expect(back.hourKnown).toBe(false);
    expect(back.time).toBe('');
    // 「아직 안 골랐다」가 아니다. 저장된 입력에 도착한 시점에는 이미 답한 것이다.
    expect(back.hourKnown).not.toBeNull();
  });

  it('부를 이름은 입력이 아니라 엣지에서 온다', () => {
    expect(stood(stored, '아빠').query.name).toBe('아빠');
    expect(stood(stored, '민수').query.name).toBe('민수');
  });

  it('세운 시작 연도는 저장하지 않는다 — 보기 설정이지 명식이 아니다', () => {
    expect(stood(stored).query.saeunFrom).toBe(DEFAULT_QUERY.saeunFrom);
    expect(Object.keys(selfPersonArgs(submitted))).not.toContain('p_saeun_from');
  });
});

describe('못 읽는 입력은 메우지 않고 못 읽는다고 한다', () => {
  const cases: [string, Partial<StoredInput>, keyof StoredInput][] = [
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

  /**
   * **던지지 않고 값으로 낸다.**
   *
   * 앞서는 이 자리가 예외였고 호출부 일곱이 각자 여섯 모양으로 받았다 — 그중 둘은
   * 계산 오류까지 함께 삼켰다. 못 읽는 것은 이 문이 아는 사실이지 예외적인 사건이
   * 아니므로, 받는 것을 잊을 수 없는 모양으로 낸다.
   */
  it.each(cases)('%s 은 값으로 낸다', (_label, patch, field) => {
    const result = storedChartOf({ ...stored, ...patch }, '민수');

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.kind).toBe('unreadable-input');
    // 어느 칸이 문제인지 값으로 든다 — 문장을 다시 파싱하게 하지 않는다.
    expect(result.field).toBe(field);
  });

  it('모르는 출생지를 서울로 치지 않는다', () => {
    // 조용히 메우면 저장할 때 본 사주와 다른 사주가 같은 화면에 나온다.
    const result = storedChartOf({ ...stored, city: '평양' }, '민수');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/평양/);
  });

  /**
   * 저장된 양력과 지금 표의 답이 갈리는 경우는 하나뿐이다 — 변환표가 바뀐 것.
   *
   * 조용히 새 값으로 계산하면 저장 전후의 사주가 달라지고, 조용히 옛 값을 쓰면 표가
   * 왜 바뀌었는지 아무도 모른다. 둘 다 말고 못 읽는다고 한다.
   */
  it('저장할 때 잡은 양력이 지금 표의 답과 다르면 못 읽는다', () => {
    const drifted: StoredInput = {
      ...stored,
      calendar: 'lunar',
      original_date: '1965-03-12',
      // 진짜 답은 1965-04-13 이다. 하루 밀린 값이 저장돼 있다고 치자.
      solar_date: '1965-04-14',
    };

    const result = storedChartOf(drifted, '엄마');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/1965-04-14.*1965-04-13/);
  });

  /**
   * **계산 오류는 값으로 안 바꾼다 — 그대로 던진다.**
   *
   * 가르는 기준은 사용자가 할 수 있는 일이 있는가다. 모르는 출생지는 고치면 풀리고,
   * 지원 범위 밖의 해는 고칠 수도 없고 앱의 저장 문 셋이 이미 막는다(`missingAnswer`).
   * 그러니 그 값이 저장돼 있다면 앱 밖에서 쓴 행이고, 그것이 정확히 우리가 알아야 할
   * 일이다 — 「못 읽습니다」로 얌전히 적으면 아무도 안 묻는다.
   *
   * DB 에 연도 범위 검사식이 없다는 것이 이 시험이 가짜가 아닌 이유다.
   */
  it('지원 범위 밖의 해는 삼키지 않고 던진다', () => {
    const tooOld: StoredInput = { ...stored, original_date: '1850-05-15', solar_date: '1850-05-15' };

    expect(() => storedChartOf(tooOld, '민수')).toThrowError(/1900~2100/);
  });
});

describe('음력으로 저장된 입력', () => {
  const lunar: StoredInput = {
    ...stored,
    calendar: 'lunar',
    original_date: '1965-03-12',
    // 1965년 정월 초하루가 양력 2월 2일이고 1월이 29일, 2월이 30일이다.
    solar_date: '1965-04-13',
  };

  it('사용자가 적은 원본을 그대로 되돌린다 — 양력으로 바꿔 놓지 않는다', () => {
    const back = stood(lunar, '엄마').query;

    expect(back.calendar).toBe('lunar');
    expect(back.date).toBe('1965-03-12');
  });

  it('계산은 저장된 양력으로 한다', () => {
    // 되읽은 입력으로 계산한 명식이 저장된 양력으로 계산한 것과 같다.
    const back = stood(lunar, '엄마');
    const asSolar: Query = { ...back.query, calendar: 'solar', date: '1965-04-13' };

    expect(back.saju.pillars).toEqual(chartOf(asSolar).pillars);
  });

  it('평달과 윤달은 다른 입력이다', () => {
    const leap: StoredInput = { ...lunar, calendar: 'lunar_leap' };

    // 1965년의 윤달은 없다 — 그래서 못 읽는다. 평달과 같은 값으로 읽히지 않는다.
    expect(storedChartOf(leap, '엄마').ok).toBe(false);
  });

  it('저장 인자로 나갔다가 돌아오면 같은 입력이다', () => {
    const entered: Query = { ...submitted, calendar: 'lunar', date: '1965-03-12' };
    const args = selfPersonArgs(entered);

    expect(args.p_calendar).toBe('lunar');
    expect(args.p_original_date).toBe('1965-03-12');
    expect(args.p_solar_date).toBe('1965-04-13');

    expect(
      stood(
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
      ).query,
    ).toEqual(entered);
  });
});

/**
 * **규칙을 적은 자리에서 그 규칙이 지켜지는가.**
 *
 * 이 모듈은 「못 읽는 입력은 값이고 그 밖은 예외」라고 적어 뒀다. 그런데 달력 변환 자리가
 * 모든 오류를 `UnreadableInputError` 로 바꾸고 있었다 — 달력 코드의 진짜 버그가 사용자에게
 * 「저장된 출생 정보를 읽지 못했습니다」로 서고, 아무도 그 버그를 안 묻게 된다.
 */
describe('달력이 터진 것은 못 읽는 입력이 아니다', () => {
  it('표 밖의 음력이 아닌 오류는 값으로 안 바꾸고 던진다', () => {
    calendar.boom = true;

    try {
      expect(() => storedChartOf(stored, '민수')).toThrowError(TypeError);
      expect(() => storedChartOf(stored, '민수')).toThrowError('달력 표가 깨졌다');
    } finally {
      calendar.boom = false;
    }
  });

  /** 터뜨리기 전으로 돌아오면 다시 세워진다 — 위 시험이 뒷자리를 오염시키지 않았다 */
  it('꺼 두면 그대로 세워진다', () => {
    expect(storedChartOf(stored, '민수').ok).toBe(true);
  });
});
