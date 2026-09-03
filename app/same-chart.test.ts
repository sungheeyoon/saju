import { describe, expect, it } from 'vitest';

import { chartFingerprint, chartOf } from './chart';
import { DEFAULT_QUERY, type Query } from './query';

const query = (over: Partial<Query>): Query => ({ ...DEFAULT_QUERY, ...over });

const print = (over: Partial<Query>) => chartFingerprint(chartOf(query(over)));

/**
 * **견주는 것은 입력이 아니라 결과다.**
 *
 * 같은 사람을 두 번 저장하면 대상이 둘이 되고, 대상이 둘이면 풀이권도 둘이다
 * (ADR 0034). 그것을 막으려면 「같은 명식인가」에 답해야 하는데, 원문으로 답하면
 * 사용자가 자기가 이미 저장한 줄 모르는 바로 그 경우들을 놓친다.
 */
describe('명식 지문', () => {
  it('같은 입력은 같은 지문을 낸다', () => {
    const one = { date: '1990-05-15', time: '14:30', gender: 'male' } as const;
    expect(print(one)).toBe(print(one));
  });

  /** 이름은 나와 그 사람 사이에 붙는 값이지 명식이 아니다 */
  it('부를 이름이 달라도 같은 지문이다', () => {
    expect(print({ date: '1990-05-15', time: '14:30', name: '엄마' })).toBe(
      print({ date: '1990-05-15', time: '14:30', name: '어머니' }),
    );
  });

  /**
   * **양력으로 넣은 것과 그 날의 음력으로 넣은 것이 같아야 한다.**
   *
   * 이것이 정확히 사용자가 자기가 이미 저장한 줄 모르는 경우다 — 한 번은 주민등록의
   * 양력으로, 한 번은 어머니가 기억하는 음력으로 넣는다.
   */
  it('달력이 달라도 같은 날이면 같은 지문이다', () => {
    const solar = print({ calendar: 'solar', date: '1990-05-15', time: '14:30' });
    // 1990-05-15(양) = 1990-04-21(음)
    const lunar = print({ calendar: 'lunar', date: '1990-04-21', time: '14:30' });

    expect(lunar).toBe(solar);
  });

  it('다른 날이면 다른 지문이다', () => {
    expect(print({ date: '1990-05-15', time: '14:30' })).not.toBe(
      print({ date: '1990-05-16', time: '14:30' }),
    );
  });

  /** 시가 갈리면 시주가 갈린다 — 같은 날이어도 다른 명식이다 */
  it('시각이 다르면 다른 지문이다', () => {
    expect(print({ date: '1990-05-15', time: '14:30' })).not.toBe(
      print({ date: '1990-05-15', time: '02:30' }),
    );
  });

  /**
   * **시각을 모르는 여섯 글자는 여덟 글자와 다른 명식이다.**
   *
   * 같다고 하면 시주가 있는 쪽의 풀이를 없는 쪽에 붙이게 된다.
   */
  it('시각을 모르는 것은 어떤 시각과도 같지 않다', () => {
    const unknown = print({ date: '1990-05-15', hourKnown: false });

    for (const time of ['00:30', '14:30', '23:30']) {
      expect(print({ date: '1990-05-15', time }), time).not.toBe(unknown);
    }
  });

  it('시각을 모르는 둘끼리는 같은 날이면 같다', () => {
    expect(print({ date: '1990-05-15', hourKnown: false })).toBe(
      print({ date: '1990-05-15', hourKnown: false }),
    );
  });

  /**
   * **성별은 명식이 아니다.** 여덟 글자는 성별로 안 갈린다 — 갈리는 것은 대운의
   * 방향이고 그것은 지문이 드는 값이 아니다. 같은 여덟 글자를 성별만 바꿔 두 번
   * 저장하는 것은 실수일 가능성이 높으므로 여기서 묻는 편이 맞다.
   */
  it('성별이 달라도 여덟 글자가 같으면 같은 지문이다', () => {
    expect(print({ date: '1990-05-15', time: '14:30', gender: 'male' })).toBe(
      print({ date: '1990-05-15', time: '14:30', gender: 'female' }),
    );
  });

  /**
   * **계산 설정이 여덟 글자를 바꾸면 지문도 갈린다** — 견주는 것이 입력이 아니라 나온
   * 글자이기 때문이다.
   *
   * 23:30 이 아니라 23:40 인 것에 이유가 있다. 서울은 지방시 보정이 30분 남짓이라
   * 23:30 은 보정 뒤에도 아직 23시 전이고, 그때는 두 규칙이 **같은 답을 낸다.**
   * 경계를 재려면 보정 뒤에 넘어가는 시각이어야 한다.
   */
  it('경계를 넘는 시각은 자시 규칙에 따라 갈린다', () => {
    expect(print({ date: '1990-05-15', time: '23:40', rule: 'jo' })).not.toBe(
      print({ date: '1990-05-15', time: '23:40', rule: 'ya' }),
    );
  });

  /**
   * **그 반대도 참이다 — 설정이 달라도 글자가 같으면 같은 지문이다.**
   *
   * 서울과 부산은 경도가 다르지만 07:00 에는 같은 여덟 글자가 난다. 「출생지가 다르니
   * 다른 사람」이라고 하면 같은 사람을 두 번 저장하게 되고, 그것이 이 물음이 막으려는
   * 바로 그 일이다.
   */
  it('출생지가 달라도 나온 글자가 같으면 같은 지문이다', () => {
    expect(print({ date: '1990-05-15', time: '07:00', city: '서울' })).toBe(
      print({ date: '1990-05-15', time: '07:00', city: '부산' }),
    );
  });
});
