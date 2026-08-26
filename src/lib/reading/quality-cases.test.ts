import { describe, expect, it } from 'vitest';

import { GOLDEN_CASES } from '../saju/golden/cases';
import {
  PROMPT_VARIANTS,
  SELF_QUALITY_CASE_SET,
  blindKeyForAll,
  blindLabelsFor,
  blindOrderFor,
  chartForQualityCase,
} from '.';

/**
 * **고정 사례는 골든을 가리킬 뿐 베끼지 않는다.**
 *
 * 베끼면 골든이 고쳐졌을 때 두 벌이 조용히 갈리고, 그때 「같은 사례로 비교했다」가
 * 거짓이 된다. 가리키는 이상 **가리킨 것이 실제로 있는지**는 시험이 봐야 한다 — 없으면
 * 화면을 열어야만 알게 된다.
 */
describe('고정 사례는 골든을 가리킨다', () => {
  it('가리킨 골든이 전부 있다', () => {
    const known = new Set(GOLDEN_CASES.map((one) => one.id));

    for (const one of SELF_QUALITY_CASE_SET.cases) {
      expect(known.has(one.golden), `${one.id} → ${one.golden}`).toBe(true);
      expect(() => chartForQualityCase(one.id)).not.toThrow();
    }
  });

  it('사례 id 가 겹치지 않는다', () => {
    const ids = SELF_QUALITY_CASE_SET.cases.map((one) => one.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * **시각만 다른 짝이 있어야 한다.**
   *
   * 「시각을 모르면 무엇이 사라지고 무엇이 완충되는가」는 두 글을 나란히 놓아야 보인다.
   * 날짜가 다른 둘로는 그 차이가 시각 때문인지 명식 때문인지 가를 수 없다.
   */
  it('같은 날짜에 시각만 다른 반사실 짝을 든다', () => {
    const goldenOf = (id: string) => GOLDEN_CASES.find((one) => one.id === id);

    const known = goldenOf('dst-1988-on');
    const unknown = goldenOf('unknown-hour-dst-day');

    expect(known?.input.year).toBe(unknown?.input.year);
    expect(known?.input.month).toBe(unknown?.input.month);
    expect(known?.input.day).toBe(unknown?.input.day);
    expect(known?.input.hour).not.toBeNull();
    expect(unknown?.input.hour).toBeNull();
    // 계산 옵션까지 같아야 시각 하나만 다른 짝이 된다.
    expect(known?.options).toEqual(unknown?.options);
  });

  /** 기준 시각을 못박지 않으면 어제 잰 것과 오늘 잰 것이 다른 운을 읽는다 */
  it('기준 시각이 값으로 못박혀 있다', () => {
    expect(new Date(SELF_QUALITY_CASE_SET.viewedAt).toISOString()).toBe(
      SELF_QUALITY_CASE_SET.viewedAt,
    );
  });
});

/**
 * **가린 이름은 사례마다 차례가 달라야 하고, 같은 사례에는 늘 같아야 한다.**
 *
 * 차례가 늘 같으면 첫 사례에서 짝을 한 번 알아챈 뒤로는 가린 것이 아니다. 반대로
 * 무작위로 섞으면 어제의 `Q01-A` 와 오늘의 `Q01-A` 가 달라져 기록을 못 이어 붙인다.
 */
describe('가린 이름', () => {
  it('네 변형을 빠짐없이 한 번씩 세운다', () => {
    for (const one of SELF_QUALITY_CASE_SET.cases) {
      const order = blindOrderFor(one.id);

      expect(order).toHaveLength(PROMPT_VARIANTS.length);
      expect(new Set(order).size).toBe(PROMPT_VARIANTS.length);
    }
  });

  it('같은 사례에는 늘 같은 차례가 나온다', () => {
    for (const one of SELF_QUALITY_CASE_SET.cases) {
      expect(blindOrderFor(one.id)).toEqual(blindOrderFor(one.id));
    }
  });

  it('사례마다 차례가 한결같지는 않다', () => {
    const firsts = SELF_QUALITY_CASE_SET.cases.map((one) => blindOrderFor(one.id)[0]);

    expect(new Set(firsts).size).toBeGreaterThan(1);
  });

  /**
   * **돌린 것이 아니라 섞은 것이다.**
   *
   * 회전이면 넷의 상대 차례가 늘 같아서, 한 사례에서 짝 하나만 알아채면 그 사례의
   * 나머지 셋이 공짜로 따라온다. 가린 것이 아니라 잠깐 덮어 둔 것이 된다.
   */
  it('회전이 아니다 — 짝 하나가 나머지를 알려 주지 않는다', () => {
    const base = PROMPT_VARIANTS.map((one) => one.id);
    const rotations = base.map((_, shift) => base.map((__, index) => base[(index + shift) % base.length]));

    const orders = SELF_QUALITY_CASE_SET.cases.map((one) => blindOrderFor(one.id));
    const rotated = orders.filter((order) =>
      rotations.some((rotation) => rotation.every((id, index) => id === order[index])),
    );

    // 다섯이 전부 회전이면 섞은 것이 아니다.
    expect(rotated.length).toBeLessThan(orders.length);
  });

  /** 전체 짝은 한 번에 열리되, 사례별 기록에는 들어가지 않는다 */
  it('전체 짝은 사례마다 넷씩 빠짐없이 낸다', () => {
    const all = blindKeyForAll();

    expect(all).toHaveLength(SELF_QUALITY_CASE_SET.cases.length * PROMPT_VARIANTS.length);
    expect(new Set(all.map((one) => one.blind)).size).toBe(all.length);
  });

  it('이름이 사례를 달고 A~D 로 붙는다', () => {
    const labels = blindLabelsFor('Q01').map((one) => one.blind);

    expect(labels).toEqual(['Q01-A', 'Q01-B', 'Q01-C', 'Q01-D']);
  });
});
