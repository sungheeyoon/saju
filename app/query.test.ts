import { describe, expect, it } from 'vitest';

import {
  DEFAULT_QUERY,
  NAME_MAX,
  mergeSearchParams,
  BIRTH_YEAR_MAX,
  birthYearRefusal,
  missingAnswer,
  missingForCalculation,
  queryFromSearchParams,
  toSearchParams,
  type Query,
} from './query';

const query: Query = {
  name: '',
  calendar: 'solar',
  date: '1990-05-15',
  time: '14:30',
  hourKnown: true,
  gender: 'male',
  city: '부산',
  rule: 'ya',
  saeunFrom: 2030,
  basis: 'trueSolar',
};

const read = (search: string) => queryFromSearchParams(new URLSearchParams(search));

describe('주소창에 실은 입력', () => {
  it('싣고 읽으면 그대로 돌아온다', () => {
    expect(queryFromSearchParams(toSearchParams(query))).toEqual(query);
  });

  /**
   * 자시 규칙 하나로 일주가, 시간 기준으로 시주가 바뀐다. 기본값이라고 빼두면
   * 나중에 기본값을 옮기는 순간 이미 나눠 준 링크가 다른 사주를 가리킨다.
   */
  it('기본값도 빼지 않고 전부 적는다', () => {
    const params = toSearchParams({ ...DEFAULT_QUERY, date: '2000-01-01', time: '00:30' });

    expect([...params.keys()].sort()).toEqual([
      'basis',
      'city',
      'date',
      'gender',
      'hour',
      'rule',
      'saeun',
    ]);
  });

  /**
   * 달력 형식은 양력일 때만 빠진다 — 위 규칙의 예외로 보이지만 아니다. 두려운
   * 것은 「기본값을 옮기면 옛 링크가 다른 사주를 가리키는 것」인데, 양력은
   * 기본값이기 이전에 **`cal` 이 생기기 전에 나눠 준 모든 링크의 뜻**이다.
   */
  describe('달력 형식', () => {
    it('음력이면 싣고, 싣고 읽으면 그대로 돌아온다', () => {
      const lunar: Query = { ...query, calendar: 'lunar_leap', date: '1984-10-05' };

      expect(toSearchParams(lunar).get('cal')).toBe('lunar_leap');
      expect(queryFromSearchParams(toSearchParams(lunar))).toEqual(lunar);
    });

    it('`cal` 이 없는 옛 링크는 양력으로 읽는다', () => {
      expect(read('date=1990-05-15&hour=14:30')?.calendar).toBe('solar');
    });

    it('모르는 값은 양력으로 되돌린다 — 링크를 잘못 고쳤다고 빈 화면을 주지 않는다', () => {
      expect(read('date=1990-05-15&hour=14:30&cal=음력')?.calendar).toBe('solar');
    });

    it('접두사를 따라간다 — 한 사람만 음력일 수 있다', () => {
      const params = mergeSearchParams(
        toSearchParams({ ...query, calendar: 'lunar' }, 'a.'),
        toSearchParams(query, 'b.'),
      );

      expect(queryFromSearchParams(params, 'a.')?.calendar).toBe('lunar');
      expect(queryFromSearchParams(params, 'b.')?.calendar).toBe('solar');
    });
  });

  /**
   * 이름만은 비어 있으면 뺀다. 위 규칙의 예외가 아니라 **다른 종류의 값**이라서다
   * — 기본값을 빼지 않는 이유는 그것이 여덟 글자를 바꾸기 때문인데, 이름은 바꾸지
   * 않는다. 빈 이름을 실으면 이름을 쓰지 않는 원국 링크마다 `name=` 이 붙는다.
   */
  describe('이름은 계산이 아니라 이름표다', () => {
    it('비어 있으면 주소에 싣지 않는다', () => {
      expect(toSearchParams(query).has('name')).toBe(false);
      expect(read(toSearchParams(query).toString())?.name).toBe('');
    });

    it('넣으면 그대로 실리고 그대로 돌아온다', () => {
      const named = { ...query, name: '민수' };

      expect(toSearchParams(named).get('name')).toBe('민수');
      expect(queryFromSearchParams(toSearchParams(named))).toEqual(named);
    });

    it('접두사를 따라간다 — 한 주소에 두 사람이 실린다', () => {
      const params = mergeSearchParams(
        toSearchParams({ ...query, name: '민수' }, 'a.'),
        toSearchParams({ ...query, name: '지영' }, 'b.'),
      );

      expect(params.get('a.name')).toBe('민수');
      expect(params.get('b.name')).toBe('지영');
      expect(queryFromSearchParams(params, 'b.')?.name).toBe('지영');
    });

    /**
     * 주소로 들어온 값이라 길이만 자른다. 정상값으로 되돌릴 대상이 없는 대신
     * 화면을 밀어내지 못할 만큼만 남긴다 — 관계 한 줄에 두 사람이 들어간다.
     */
    it('너무 길면 자른다', () => {
      const long = read(`date=2000-01-01&name=${'가'.repeat(50)}`);

      expect(long?.name).toHaveLength(NAME_MAX);
    });
  });

  it('시각 미상은 시각과 같은 칸을 쓴다 — 둘이 동시에 켜질 수 없다', () => {
    const params = toSearchParams({ ...query, hourKnown: false, time: '' });

    expect(params.get('hour')).toBe('unknown');
    expect(read(params.toString())).toMatchObject({ hourKnown: false, time: '' });
  });

  /**
   * 고르지 않은 것과 "모른다"고 답한 것은 다르다. 하나로 묶으면 아무것도 고르지
   * 않은 사람에게 "시각을 안다"를 기본값으로 씌우게 되는데, 그것은 엔진이 정오를
   * 채워 넣을 때 경계한 것과 같은 실수다 — 모르는 것을 아는 것처럼 만들지 않는다.
   */
  describe('시각은 세 가지 상태다', () => {
    /**
     * 폼은 「시간 입력」에서 시작한다. 두 칸이 다 꺼져 있으면 고를 것이 있다는 것을
     * 사용자가 못 알아본다 — 대신 **켜진 쪽이 답이 아니라 요구**라서 위험이 없다:
     * 시각을 안 적으면 버튼이 잠긴 채로 남는다. 「시간 모름」을 기본으로 뒀다면
     * 아무 말 없이 시주 없는 명식이 나갔을 것이다.
     */
    it('시각을 적으라는 쪽에서 시작하되, 안 적으면 계산하지 않는다', () => {
      expect(DEFAULT_QUERY.hourKnown).toBe(true);
      expect(DEFAULT_QUERY.time).toBe('');
      expect(missingAnswer({ ...DEFAULT_QUERY, name: '민수', date: '1990-05-15' })).toContain(
        '출생시각',
      );
    });

    /** 「아직 안 골랐다」는 이제 주소에서만 온다 — 그때는 두 갈래를 다 말한다 */
    it('고르지 않은 상태는 두 갈래를 함께 말한다', () => {
      const unanswered = { ...DEFAULT_QUERY, name: '민수', date: '1990-05-15', hourKnown: null };
      expect(missingAnswer(unanswered)).toContain('시간 모름');
    });

    it('주소에 시각 칸이 없으면 고르지 않은 것으로 읽는다', () => {
      expect(read('date=1990-05-15')?.hourKnown).toBeNull();
      expect(read('date=1990-05-15&hour=unknown')?.hourKnown).toBe(false);
      expect(read('date=1990-05-15&hour=14:30')?.hourKnown).toBe(true);
    });
  });

  /**
   * 버튼을 잠그는 쪽과 계산하는 쪽이 **같은 답**을 본다. 조건을 화면에 따로
   * 적으면 두 곳이 어긋나는 순간 눌리는데 거절하거나 잠겼는데 계산은 되는
   * 상태가 만들어진다.
   */
  describe('답하지 않은 칸이 있으면 계산을 시작하지 않는다', () => {
    const filled: Query = { ...query, name: '민수' };

    it('전부 답하면 없다', () => {
      expect(missingAnswer(filled)).toBeNull();
      expect(missingAnswer({ ...filled, hourKnown: false, time: '' })).toBeNull();
    });

    it('아무도 대신 답할 수 없는 셋을 묻는다', () => {
      expect(missingAnswer({ ...filled, name: '  ' })).toContain('이름');
      expect(missingAnswer({ ...filled, date: '' })).toContain('생년월일');
      expect(missingAnswer({ ...filled, hourKnown: null })).toContain('출생시각');
      expect(missingAnswer({ ...filled, time: '' })).toContain('출생시각');
    });

    /** 기본값이 있는 칸은 이미 답이 있다 — 다시 묻지 않는다 */
    it('기본값이 있는 칸은 묻지 않는다', () => {
      expect(missingAnswer({ ...filled, gender: 'female', city: '부산', rule: 'ya' })).toBeNull();
    });

    /**
     * 폼은 이름까지 묻지만 **계산은 이름 없이도 된다.** 이름은 계산에 들어가지
     * 않으므로, 이름 칸이 생기기 전에 나눠 준 링크가 여기서 막히면 안 된다.
     */
    it('이름 없는 옛 링크는 그대로 열린다', () => {
      const old = read('date=1990-05-15&hour=14:30&gender=male');

      expect(old?.name).toBe('');
      expect(missingForCalculation(old!)).toBeNull();
      expect(missingAnswer(old!)).toContain('이름');
    });

    /** 둘이 어긋날 수 없다 — 폼 쪽이 계산 쪽을 그대로 부르고 이름만 얹는다 */
    it('이름을 넣으면 두 답이 같아진다', () => {
      for (const query of [filled, { ...filled, date: '' }, { ...filled, hourKnown: null }]) {
        expect(missingAnswer(query), JSON.stringify(query.date)).toBe(missingForCalculation(query));
      }
    });
  });

  /**
   * 태어난 해의 위 끝은 **자료가 아니라 제품이 정한다.**
   *
   * 엔진은 2100년까지 세지만 그 범위는 세운·대운처럼 앞으로 올 해를 짚기 위한
   * 것이다. 두 범위를 합쳐 두면 생년 칸이 아직 오지 않은 80년을 받는다.
   *
   * **막는 자리는 하나여야 한다.** 폼이 못 적게 하는 것만으로는 부족하다 — 입력은
   * 주소의 `#` 뒤에서도 들어오고, 저장은 서버 액션도 이 함수를 지난다.
   */
  describe('태어난 해는 범위 밖이면 거절한다', () => {
    const filled: Query = { ...query, name: '민수' };
    const on = (date: string, calendar: Query['calendar'] = 'solar') => ({
      ...filled,
      calendar,
      date,
    });

    it('경계는 열려 있다', () => {
      expect(birthYearRefusal(on(`${BIRTH_YEAR_MAX}-01-01`))).toBeNull();
      expect(birthYearRefusal(on('1900-01-01'))).toBeNull();
    });

    it('아직 오지 않은 해는 거절하고 어느 범위인지 말한다', () => {
      const refused = birthYearRefusal(on(`${BIRTH_YEAR_MAX + 1}-01-01`));
      expect(refused).toContain(String(BIRTH_YEAR_MAX));
      expect(refused).toContain(String(BIRTH_YEAR_MAX + 1));
    });

    /** 아래 끝은 달력마다 다르다 — 음력 표는 1912년부터다 */
    it('아래 끝은 달력이 정한다', () => {
      expect(birthYearRefusal(on('1905-04-01'))).toBeNull();
      expect(birthYearRefusal(on('1905-04-01', 'lunar'))).toContain('1912');
      expect(birthYearRefusal(on('1899-12-31'))).toContain('1900');
    });

    /** 거절은 버튼도 잠근다 — 두 자리에 따로 적혀 있지 않다는 뜻이다 */
    it('거절한 해는 계산도 시작하지 않는다', () => {
      const future = on(`${BIRTH_YEAR_MAX + 1}-01-01`);
      expect(missingForCalculation(future)).toBe(birthYearRefusal(future));
      expect(missingAnswer(future)).toBe(birthYearRefusal(future));
    });

    /** 아직 다 안 적힌 해는 날짜가 아니다 — 거절할 것도 없다 */
    it('빈 날짜에는 할 말이 없다', () => {
      expect(birthYearRefusal({ ...filled, date: '' })).toBeNull();
      expect(missingForCalculation({ ...filled, date: '' })).toContain('생년월일');
    });
  });

  it('날짜가 없으면 아직 아무것도 계산하지 않은 상태다', () => {
    expect(read('')).toBeNull();
    expect(read('date=&gender=male')).toBeNull();
    expect(read('gender=male&city=부산')).toBeNull();
  });

  /**
   * 링크를 잘못 편집했다고 빈 화면을 주지 않는다. 무엇으로 계산했는지는 폼과
   * '적용된 보정' 표에 그대로 나오므로 사용자가 어긋남을 눈으로 본다.
   */
  it('열거값과 연도가 망가지면 기본값으로 되돌린다', () => {
    expect(read('date=1990-05-15&gender=X&city=평양&rule=hmm&basis=lunar&saeun=abc')).toEqual({
      ...DEFAULT_QUERY,
      date: '1990-05-15',
      /*
        **주소의 침묵은 폼의 출발점과 다른 사실이다.**

        폼은 「시간 입력」에서 시작하지만(`DEFAULT_QUERY.hourKnown === true`), `hour=` 가
        없는 링크는 그 사람이 시각에 대해 **아무 말도 안 한 것**이다. 그것을 폼의
        기본값으로 메우면 시각 칸이 생기기 전에 나눠 준 링크가 「시각을 안다」고
        주장하게 된다 — 우리가 지어낸 말이다.
      */
      hourKnown: null,
    });

    expect(read('date=1990-05-15&saeun=1800')?.saeunFrom).toBe(1900);
    expect(read('date=1990-05-15&saeun=3000')?.saeunFrom).toBe(2100);
    expect(read('date=1990-05-15&saeun=2026.5')?.saeunFrom).toBe(DEFAULT_QUERY.saeunFrom);
  });

  /**
   * 날짜·시각의 형식은 여기서 따지지 않는다. 검증은 엔진(`input.ts`) 한 곳에만
   * 두고, 사용자는 직접 입력했을 때와 같은 메시지를 본다.
   */
  it('날짜와 시각은 형식을 따지지 않고 그대로 넘긴다', () => {
    expect(read('date=1990-02-30&hour=25:99')).toMatchObject({
      date: '1990-02-30',
      time: '25:99',
    });
  });

  /**
   * 궁합은 한 주소에 입력 두 벌을 싣는다. 접두사가 서로 섞이면 상대의 생일로
   * 내 사주가 나오므로, 한쪽만 있을 때 다른 쪽이 null 인 것까지 못박는다.
   */
  it('접두사를 붙이면 한 주소에 두 벌이 섞이지 않고 들어간다', () => {
    const a: Query = { ...query, date: '1990-05-15', city: '서울' };
    const b: Query = { ...query, date: '2000-01-02', city: '부산' };
    const params = mergeSearchParams(toSearchParams(a, 'a.'), toSearchParams(b, 'b.'));

    expect(params.get('a.date')).toBe('1990-05-15');
    expect(params.get('b.date')).toBe('2000-01-02');
    expect(queryFromSearchParams(params, 'a.')).toEqual(a);
    expect(queryFromSearchParams(params, 'b.')).toEqual(b);
    // 접두사 없는 자리는 비어 있다 — 원국 화면이 궁합 주소를 잘못 읽지 않는다.
    expect(queryFromSearchParams(params)).toBeNull();
  });

  it('한 사람만 적힌 주소는 나머지 한 사람이 null 이다', () => {
    const params = toSearchParams({ ...query, date: '1990-05-15' }, 'a.');

    expect(queryFromSearchParams(params, 'a.')).not.toBeNull();
    expect(queryFromSearchParams(params, 'b.')).toBeNull();
  });

  it('접두사 없는 기존 주소는 그대로 읽힌다', () => {
    // 이미 나눠 준 링크가 깨지면 안 된다.
    expect(read('date=1990-05-15&hour=14:30&gender=male')).toMatchObject({
      date: '1990-05-15',
      time: '14:30',
      gender: 'male',
    });
  });
});
