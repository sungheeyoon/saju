import { describe, expect, it } from 'vitest';

import {
  DEFAULT_QUERY,
  mergeSearchParams,
  queryFromSearchParams,
  toSearchParams,
  type Query,
} from './query';

const query: Query = {
  date: '1990-05-15',
  time: '14:30',
  hourUnknown: false,
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

  it('시각 미상은 시각과 같은 칸을 쓴다 — 둘이 동시에 켜질 수 없다', () => {
    const params = toSearchParams({ ...query, hourUnknown: true });

    expect(params.get('hour')).toBe('unknown');
    expect(read(params.toString())).toMatchObject({ hourUnknown: true, time: '' });
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
