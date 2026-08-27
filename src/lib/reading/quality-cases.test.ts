import { describe, expect, it } from 'vitest';

import { GOLDEN_CASES } from '../saju/golden/cases';
import {
  PROMPT_VARIANTS,
  SELF_QUALITY_CASE_SET,
  blindKeyForAll,
  blindLabelsFor,
  blindOrderFor,
  chartForQualityCase,
  inRound,
  roundCases,
  roundVariants,
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
 * **라운드는 값이다** — 「이번엔 이만큼만 돈다」가 코드에 없으면 화면이 다 세운다.
 *
 * 안 돌린 칸을 화면이 세우면 빈 칸이 기록에 `0자·소제목 0개`로 실리고, 그때 「안
 * 돌렸다」와 「0자로 나왔다」가 파일에서 같아 보인다.
 */
describe('이번 라운드', () => {
  it('가리킨 변형이 전부 실재한다', () => {
    expect(() => roundVariants()).not.toThrow();
    expect(roundVariants()).toHaveLength(SELF_QUALITY_CASE_SET.round.variants.length);
  });

  it('가리킨 사례가 전부 세트 안에 있다', () => {
    const known = new Set(SELF_QUALITY_CASE_SET.cases.map((one) => one.id));

    for (const id of roundCases()) expect(known.has(id)).toBe(true);
  });

  it('기준판이 반드시 함께 돈다 — 견줄 바탕이 없으면 나머지가 뜻이 없다', () => {
    expect(roundVariants().map((one) => one.id)).toContain('control');
  });

  /** 한 번씩만 돌리면 변형의 차이인지 그날 한 번의 운인지 못 가른다 */
  it('칸마다 두 번 이상 돌린다', () => {
    expect(SELF_QUALITY_CASE_SET.round.runsPerCell).toBeGreaterThanOrEqual(2);
  });

  /** 세트에 남아 있는 것과 이번에 도는 것은 다르다 */
  it('라운드 밖 사례는 세트에 남되 돌지 않는다', () => {
    const outside = SELF_QUALITY_CASE_SET.cases.filter((one) => !inRound(one.id));

    expect(outside.length).toBeGreaterThan(0);
    for (const one of outside) expect(roundCases()).not.toContain(one.id);
  });

  /**
   * **갈아엎기 전의 뼈대가 함께 서야 한다.**
   *
   * 새 뼈대만 돌리면 「나아졌다」를 기억으로만 말하게 된다. 옛 것이 같은 사례·같은 근거
   * 위에 나란히 서야 「어느 쪽이 읽히는가」가 한 번이라도 갈린다.
   */
  it('옛 뼈대가 견줄 바탕으로 함께 선다', () => {
    const shapes = roundVariants().map((one) => one.assembly.selfPresentation);

    expect(shapes).toContain('human-v2');
    expect(shapes).toContain('legacy-v1');
  });
});

/**
 * **가린 이름은 사례마다 차례가 달라야 하고, 같은 사례에는 늘 같아야 한다.**
 *
 * 차례가 늘 같으면 첫 사례에서 짝을 한 번 알아챈 뒤로는 가린 것이 아니다. 반대로
 * 무작위로 섞으면 어제의 `Q01-A` 와 오늘의 `Q01-A` 가 달라져 기록을 못 이어 붙인다.
 */
describe('가린 이름', () => {
  it('이번 라운드의 변형만 빠짐없이 한 번씩 세운다', () => {
    const standing = roundVariants().map((one) => one.id);

    for (const id of roundCases()) {
      const order = blindOrderFor(id);

      expect(order).toHaveLength(standing.length);
      expect(new Set(order).size).toBe(standing.length);
      expect([...order].sort()).toEqual([...standing].sort());
    }
  });

  /** 라운드 밖 변형이 한 자리라도 서면 그 칸은 아무도 안 돌린 칸이 된다 */
  it('라운드 밖 변형은 한 자리도 서지 않는다', () => {
    const standing = new Set(roundVariants().map((one) => one.id));
    const outside = PROMPT_VARIANTS.filter((one) => !standing.has(one.id));

    expect(outside.length).toBeGreaterThan(0);
    for (const id of roundCases()) {
      for (const one of outside) expect(blindOrderFor(id)).not.toContain(one.id);
    }
  });

  it('같은 사례에는 늘 같은 차례가 나온다', () => {
    for (const id of roundCases()) {
      expect(blindOrderFor(id)).toEqual(blindOrderFor(id));
    }
  });

  it('사례마다 차례가 한결같지는 않다', () => {
    const firsts = roundCases().map((id) => blindOrderFor(id)[0]);

    expect(new Set(firsts).size).toBeGreaterThan(1);
  });

  /**
   * **돌린 것이 아니라 섞은 것이다.**
   *
   * 회전이면 변형의 상대 차례가 늘 같아서, 한 사례에서 짝 하나만 알아채면 그 사례의
   * 나머지가 공짜로 따라온다. 가린 것이 아니라 잠깐 덮어 둔 것이 된다.
   */
  it('회전이 아니다 — 짝 하나가 나머지를 알려 주지 않는다', () => {
    const base = roundVariants().map((one) => one.id);
    const rotations = base.map((_, shift) => base.map((__, index) => base[(index + shift) % base.length]));

    const orders = roundCases().map((id) => blindOrderFor(id));
    const rotated = orders.filter((order) =>
      rotations.some((rotation) => rotation.every((id, index) => id === order[index])),
    );

    // 전부 회전이면 섞은 것이 아니다.
    expect(rotated.length).toBeLessThan(orders.length);
  });

  /** 전체 짝은 한 번에 열리되, 사례별 기록에는 들어가지 않는다 */
  it('전체 짝은 이번 라운드의 칸을 빠짐없이 낸다', () => {
    const all = blindKeyForAll();

    expect(all).toHaveLength(roundCases().length * roundVariants().length);
    expect(new Set(all.map((one) => one.blind)).size).toBe(all.length);
  });

  it('이름이 사례를 달고 A 부터 붙는다', () => {
    const labels = blindLabelsFor('Q01').map((one) => one.blind);

    expect(labels).toEqual(['Q01-A', 'Q01-B', 'Q01-C']);
  });
});
