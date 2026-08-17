import { describe, expect, it } from 'vitest';

import { computeSaju, type Saju } from '..';
import { yearPillarOf } from '../pillars/year';
import { twelveStageOf } from '../stages';
import { NOW_POLICY, RESTATED_RELATIONS, UNCOVERED_NOW_FACTS, currentFortuneOf } from '.';

/**
 * 현재운 — **경계가 셋이고 재는 방법이 둘이다.**
 *
 * 여기서 잡으려는 것은 계산이 아니라 **어느 칸이 지금인가**다. 간지는 세운·월운·
 * 대운이 이미 냈고 그것들은 각자 테스트가 있다. 이 파일이 지키는 것은 세 경계
 * (입춘 · 절입 · 만 나이)와, 그 셋을 우리가 새로 세지 않는다는 규율이다.
 */

/** 서울 1990-05-20 14:30 남 — 癸未 乙酉 辛巳 庚午, 순행 대운수 6 */
const chart = (options: Parameters<typeof computeSaju>[1] = {}): Saju =>
  computeSaju(
    { year: 1990, month: 5, day: 20, hour: 14, minute: 30, second: 0, gender: 'male' },
    options,
  );

const at = (iso: string) => new Date(iso);

describe('현재운 — 세운의 경계는 입춘이다', () => {
  const saju = chart();

  it('양력 1월은 아직 전 해의 세운이다', () => {
    const now = currentFortuneOf(saju, at('2026-01-20T12:00:00+09:00'));

    // 세운에서 가장 자주 틀리는 자리다. 달력으로는 2026년인데 입춘이 안 지났다.
    expect(now.sajuYear).toBe(2025);
    expect(now.saeun.year).toBe(2025);
    expect(now.saeun.pillar).toEqual(yearPillarOf(2025));
  });

  it('입춘이 지나면 그 해의 세운이다', () => {
    const now = currentFortuneOf(saju, at('2026-03-03T12:00:00+09:00'));

    expect(now.sajuYear).toBe(2026);
    expect(now.saeun.pillar).toEqual(yearPillarOf(2026));
  });
});

describe('현재운 — 월운의 경계는 절입이다', () => {
  const saju = chart();

  it('3월 초는 아직 인월이다 — 달력 월이 아니다', () => {
    const now = currentFortuneOf(saju, at('2026-03-03T12:00:00+09:00'));

    expect(now.monthTerm.name).toBe('입춘');
    expect(now.wolun.monthOrder).toBe(1);
  });

  it('경칩이 지나면 묘월이다', () => {
    const now = currentFortuneOf(saju, at('2026-03-20T12:00:00+09:00'));

    expect(now.monthTerm.name).toBe('경칩');
    expect(now.wolun.monthOrder).toBe(2);
  });

  /**
   * 2026 년 경칩은 3월 5일 22:58(KST)이다. **같은 날짜에 두 답이 있다** — 그래서
   * 기준 시각을 날짜로만 들면 문장이 무엇을 보고 한 말인지 되짚을 수 없고,
   * `CurrentFortune.viewedOn` 이 시·분까지 드는 이유가 여기다.
   */
  it('절입일에는 같은 날짜 안에서 달이 갈린다', () => {
    const morning = currentFortuneOf(saju, at('2026-03-05T09:00:00+09:00'));
    const night = currentFortuneOf(saju, at('2026-03-05T23:30:00+09:00'));

    expect(morning.viewedOn.day).toBe(night.viewedOn.day);
    expect(morning.wolun.monthOrder).toBe(1);
    expect(night.wolun.monthOrder).toBe(2);
  });

  it('소한 뒤의 1월은 전 해 사주년의 열두 번째 달이다', () => {
    const now = currentFortuneOf(saju, at('2026-01-20T12:00:00+09:00'));

    expect(now.wolun.year).toBe(2025);
    expect(now.wolun.monthOrder).toBe(12);
  });
});

describe('현재운 — 대운의 경계는 만 나이다', () => {
  const saju = chart();

  /**
   * 대운만 달력 날짜로 잰다. 대운 칸의 경계가 정수 나이라서다 — 절대 시각의
   * 차이를 365.25 로 나누면 생일 당일이 하루 어긋나고, 그 하루가 여기서 보인다.
   */
  it('생일 하루 전과 당일에 대운 칸이 갈린다', () => {
    const before = currentFortuneOf(saju, at('2026-05-19T12:00:00+09:00'));
    const on = currentFortuneOf(saju, at('2026-05-20T12:00:00+09:00'));

    expect([before.age, on.age]).toEqual([35, 36]);
    expect(before.daeun?.index).toBe(3);
    expect(on.daeun?.index).toBe(4);
  });

  it('같은 날 세운·월운은 갈리지 않는다 — 경계가 생일이 아니다', () => {
    const before = currentFortuneOf(saju, at('2026-05-19T12:00:00+09:00'));
    const on = currentFortuneOf(saju, at('2026-05-20T12:00:00+09:00'));

    expect(on.saeun.year).toBe(before.saeun.year);
    expect(on.wolun.monthOrder).toBe(before.wolun.monthOrder);
  });

  /**
   * 못 짚는 두 이유를 구분한다. **앞은 이 사람의 사실이고 뒤는 우리 표의 한계다** —
   * 한 값으로 묶으면 문장이 우리 옵션(`DaeunOptions.count`)을 사실처럼 말한다.
   */
  it('첫 대운 전이면 before-first', () => {
    const baby = computeSaju(
      { year: 2024, month: 3, day: 15, hour: 10, minute: 0, second: 0, gender: 'female' },
      {},
    );
    const now = currentFortuneOf(baby, at('2026-08-17T12:00:00+09:00'));

    expect(now.age).toBeLessThan(baby.daeun.startAge);
    expect(now.daeun).toBeNull();
    expect(now.daeunAbsence).toBe('before-first');
  });

  it('뽑은 칸을 넘어서면 beyond-table', () => {
    const old = computeSaju(
      { year: 1925, month: 3, day: 15, hour: 10, minute: 0, second: 0, gender: 'female' },
      {},
    );
    const now = currentFortuneOf(old, at('2026-08-17T12:00:00+09:00'));

    expect(now.daeun).toBeNull();
    expect(now.daeunAbsence).toBe('beyond-table');
  });

  it('칸을 더 뽑으면 그 사람도 짚힌다 — 표의 한계였다는 증거다', () => {
    const old = computeSaju(
      { year: 1925, month: 3, day: 15, hour: 10, minute: 0, second: 0, gender: 'female' },
      { daeun: { count: 12 } },
    );
    const now = currentFortuneOf(old, at('2026-08-17T12:00:00+09:00'));

    expect(now.daeun).not.toBeNull();
    expect(now.daeunAbsence).toBeNull();
  });
});

describe('현재운 — 아무것도 새로 세지 않는다', () => {
  it('표 안의 해면 표의 칸을 그대로 쓴다', () => {
    const saju = chart();
    // 기본 세운 표는 출생한 사주년부터 열 해다 — 1995 는 그 안이다.
    const now = currentFortuneOf(saju, at('1995-08-17T12:00:00+09:00'));

    expect(now.saeun).toBe(saju.saeun.entries.find((entry) => entry.year === 1995));
  });

  it('표 밖의 해도 같은 함수로 뽑는다 — 간지가 연주 도출과 어긋나지 않는다', () => {
    const saju = chart();
    const now = currentFortuneOf(saju, at('2050-08-17T12:00:00+09:00'));

    expect(saju.saeun.entries.some((entry) => entry.year === 2050)).toBe(false);
    expect(now.saeun.pillar).toEqual(yearPillarOf(2050));
  });

  /**
   * 표 밖의 해를 새로 뽑을 때 **12운성 계통을 표에서 물려받는다.** 물려받지 않으면
   * 현재운 카드만 기본 계통으로 서서, 양포태로 본 사람의 화면에서 운 칸만 음양순역이
   * 된다. 계통이 화면 안에서 갈리는 것이 가장 나쁜 실패다.
   */
  it('12운성 계통을 표에서 물려받는다', () => {
    const yangPoTae = chart({ stages: { yinReverse: false } });
    const now = currentFortuneOf(yangPoTae, at('2026-08-17T12:00:00+09:00'));

    const dayMaster = yangPoTae.pillars.dayMaster;
    const branch = now.saeun.pillar.branch;

    expect(now.saeun.stage).toBe(twelveStageOf(dayMaster, branch, { yinReverse: false }));
    // 일간이 음간이라 계통이 실제로 갈린다 — 갈리지 않으면 위 단정이 아무것도 안 지킨다.
    expect(twelveStageOf(dayMaster, branch, { yinReverse: true })).not.toBe(now.saeun.stage);
  });

  it('관계는 대운·세운·월운 칸에서 옮겨 담기만 한다', () => {
    const saju = chart();
    const now = currentFortuneOf(saju, at('2026-08-17T12:00:00+09:00'));

    expect(now.relations).toEqual([
      ...(now.daeun?.relations ?? []),
      ...now.saeun.relations,
      ...now.wolun.relations,
    ]);
    expect(RESTATED_RELATIONS).toBe('restated-from-daeun-saeun-and-wolun');
  });

  /**
   * 대운 칸이 관계를 들게 된 것이 이 자리에서 값을 낸다 — 그 전에는 대운이 원국과
   * 무엇을 하는지가 현재운 어디에도 없었고, 문장이 그것을 고지로 대신 말했다.
   */
  it('대운이 낀 관계가 목록에 있다', () => {
    const saju = chart();
    const now = currentFortuneOf(saju, at('2026-08-17T12:00:00+09:00'));

    expect(now.daeun).not.toBeNull();
    expect(now.daeun!.relations.length).toBeGreaterThan(0);

    const fromDaeun = now.relations.filter((relation) =>
      relation.participants.some((participant) => participant.chartId === now.daeun!.chartId),
    );
    expect(fromDaeun).toEqual(now.daeun!.relations);
  });

  /** 첫 대운 전이면 담을 대운 칸이 없다 — 없는 판의 관계를 지어내지 않는다 */
  it('대운을 못 짚으면 대운 관계도 없다', () => {
    const baby = computeSaju(
      { year: 2024, month: 3, day: 15, hour: 10, minute: 0, second: 0, gender: 'female' },
      {},
    );
    const now = currentFortuneOf(baby, at('2026-08-17T12:00:00+09:00'));

    expect(now.daeun).toBeNull();
    expect(now.relations).toEqual([...now.saeun.relations, ...now.wolun.relations]);
  });

  /**
   * 겹치지 않는다는 것이 옮겨 담기의 전제다. 세운 칸은 원국·세운 두 판만 놓고
   * 세었으므로 월운 글자가 낀 관계를 담을 수 없다 — 담을 수 있게 되는 날 같은
   * 관계가 카드에 두 줄로 선다.
   */
  it('두 칸의 관계가 겹치지 않는다', () => {
    const saju = chart();
    const now = currentFortuneOf(saju, at('2026-08-17T12:00:00+09:00'));

    const chartIdsOf = (relations: typeof now.relations) =>
      new Set(relations.flatMap((r) => r.participants.map((p) => p.chartId)));

    expect(chartIdsOf(now.saeun.relations)).not.toContain(now.wolun.chartId);
    expect(chartIdsOf(now.wolun.relations)).toContain(now.wolun.chartId);
  });
});

describe('현재운 — 지금을 엔진이 묻지 않는다', () => {
  it('같은 시각을 두 번 넘기면 같은 값이 나온다', () => {
    const saju = chart();
    const instant = at('2026-08-17T12:00:00+09:00');

    const a = currentFortuneOf(saju, instant);
    const b = currentFortuneOf(saju, instant);

    expect(a.sajuYear).toBe(b.sajuYear);
    expect(a.daeun).toEqual(b.daeun);
    expect(a.wolun.pillar).toEqual(b.wolun.pillar);
    expect(a.viewedAt).toEqual(b.viewedAt);
  });

  it('기준 시각을 값으로 들고 있다 — 문장이 그것을 적어야 한다', () => {
    const saju = chart();
    const now = currentFortuneOf(saju, at('2026-08-17T12:00:00+09:00'));

    expect(now.viewedAt.toISOString()).toBe('2026-08-17T03:00:00.000Z');
    // 시·분까지 든다 — 절입일에는 그 시각이 달을 가른다.
    expect(now.viewedOn).toEqual({
      year: 2026,
      month: 8,
      day: 17,
      hour: 12,
      minute: 0,
      second: 0,
    });
  });
});

describe('현재운 — 시간 미상', () => {
  /**
   * 대운수는 절입까지의 거리에서 나오고, 시각을 모르면 그 거리가 정오에서 재어진다.
   * ±0.5일 ÷ 3 ≈ ±2개월이 흔들리므로 반올림 경계에 걸리면 **지금이 어느 대운인지가
   * 한 칸 어긋난다.** 대운이 시주에 걸리는 근거인 까닭이고, 세운·월운은 걸리지 않는다.
   */
  it('대운수가 흔들린다는 것을 값으로 든다', () => {
    const unknown = computeSaju({ year: 1990, month: 5, day: 20, hour: null, gender: 'male' }, {});
    const now = currentFortuneOf(unknown, at('2026-08-17T12:00:00+09:00'));

    expect(now.hourKnown).toBe(false);
    expect(now.daeunApproximate).toBe(true);
  });

  it('세운·월운의 간지는 시주와 무관하다', () => {
    const known = currentFortuneOf(chart(), at('2026-08-17T12:00:00+09:00'));
    const unknown = currentFortuneOf(
      computeSaju({ year: 1990, month: 5, day: 20, hour: null, gender: 'male' }, {}),
      at('2026-08-17T12:00:00+09:00'),
    );

    expect(unknown.saeun.pillar).toEqual(known.saeun.pillar);
    expect(unknown.wolun.pillar).toEqual(known.wolun.pillar);
  });

  it('시주가 빠지면 관계가 줄어든다 — 목록의 전체성이 흔들리는 자리다', () => {
    const known = currentFortuneOf(chart(), at('2026-08-17T12:00:00+09:00'));
    const unknown = currentFortuneOf(
      computeSaju({ year: 1990, month: 5, day: 20, hour: null, gender: 'male' }, {}),
      at('2026-08-17T12:00:00+09:00'),
    );

    expect(unknown.relations.length).toBeLessThan(known.relations.length);
  });
});

describe('현재운 정책', () => {
  it('바뀔 수 있는 판단이 값으로 적혀 있다', () => {
    expect(NOW_POLICY.viewingInstant).toBe('passed-in-never-read-from-the-clock');
    expect(NOW_POLICY.boundaries).toBe('terms-by-instant-daeun-by-age');
    expect(NOW_POLICY.counting).toBe('reuses-saeun-wolun-daeun');
  });

  /**
   * **고지가 좁아지는 것이 채워졌다는 증거다.** 대운 관계가 들어오면서 그 줄이
   * 사라지고, 그 자리에서 더 좁은 공백이 드러났다 — 세 칸이 저마다 원국과의 관계만
   * 내고 운끼리는 아무도 안 본다.
   */
  it('아직 내지 않는 사실을 목록으로 남긴다', () => {
    expect(UNCOVERED_NOW_FACTS.some((fact) => fact.startsWith('daeun.relations'))).toBe(false);
    expect(UNCOVERED_NOW_FACTS.some((fact) => fact.startsWith('saeun × daeun'))).toBe(true);
    expect(UNCOVERED_NOW_FACTS.some((fact) => fact.startsWith('wolun × daeun'))).toBe(true);
  });
});
