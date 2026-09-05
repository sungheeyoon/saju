import { describe, expect, it } from 'vitest';

import { computeSaju, type Saju } from '..';
import { randomInputs, withoutHour } from '../population';
import { HOUR_SENSITIVE_PATHS, type ClaimPath } from '../text/policy';

/**
 * **시주 두 글자가 무엇을 바꾸는지 재는 자리.**
 *
 * `HOUR_SENSITIVE_PATHS` 는 손으로 적는 목록이고, 손으로 적는 목록은 엔진이
 * 자랄 때 따라오지 않는다 — 2026-08-21 에 판정 일곱이 들어오는 동안 이 목록은
 * 그대로였다. 이제 목록에 이름을 올리려면 **여기서 뒤집히는 것이 보여야 한다.**
 *
 * ## 재는 법
 *
 * 시각을 지우면 `computeSaju` 는 정오를 채워 넣는다. 그러면 경도 보정과 절입
 * 비교가 함께 움직여 **연·월·일주까지 갈리는 표본이 섞인다**(3000건에 36건).
 * 그 표본에서는 여덟 글자 중 여섯이 달라진 것이라 무엇이든 뒤집히고, 그것은
 * 시주 두 글자의 몫이 아니다. 그래서 세 기둥이 같은 것만 센다.
 *
 * ## 잰 값 (2026-08-21, 세 기둥이 같은 표본에서)
 *
 * | 자리 | 무엇을 보았나 | 뒤집힘 |
 * | --- | --- | ---: |
 * | `analysis.rootQuality` | 일간 뿌리의 세기 | 64.6% |
 * | `analysis.bureaus` | 선 국(局)의 종류 집합 | 39.7% |
 * | `analysis.effectiveElements` | 가장 무거운 오행 | 31.4% |
 * | `analysis.structure` | 성패 | 26.5% |
 * | `analysis.favorability` | 다섯 자리 배정 | 25.4% |
 * | `analysis.structure` | 무슨 격인가 | 8.7% |
 * | `analysis.hiddenCombinations` | 암합 짝 | **0%** |
 *
 * ## 뒤에 들어온 자리 (2026-09-05, 같은 방식)
 *
 * | 자리 | 무엇을 보았나 | 뒤집힘 |
 * | --- | --- | ---: |
 * | `analysis.tonggwan` | 가장 팽팽한 쌍 | 42.2% |
 * | `analysis.yongsinAgreement` | 억부와 조후가 같은 것을 가리키는가 | 16.3% |
 * | `analysis.precedence` | 어느 판정이 억부와 어긋나는가 | 34.2% |
 */

/** 시주만 지운 짝. 세 기둥이 갈린 표본은 시주의 몫이 아니라 빼고 낸다 */
function pairsWithSameThreePillars(count: number): { withHour: Saju; hourless: Saju }[] {
  const pairs: { withHour: Saju; hourless: Saju }[] = [];

  for (const input of randomInputs(count)) {
    const withHour = computeSaju(input);
    const hourless = computeSaju(withoutHour(input));

    const three = (saju: Saju) =>
      (['year', 'month', 'day'] as const)
        .map((position) => `${saju.pillars[position]!.stem}${saju.pillars[position]!.branch}`)
        .join(' ');

    if (three(withHour) === three(hourless)) pairs.push({ withHour, hourless });
  }

  return pairs;
}

/**
 * 자리마다 **무엇을 값으로 볼 것인가.**
 *
 * 통째로 견주면 시주 칸이 빠진 것까지 「뒤집혔다」로 세어져 100% 가 나온다.
 * 그것은 값이 흔들린 것이 아니라 목록이 짧아진 것이고, 인식 규칙이 둘을 다르게
 * 다룬다(`INCOMPLETE_INPUT_RULE`). 그래서 자리마다 판정 하나를 짚는다.
 */
const OBSERVED: Partial<Record<ClaimPath, (saju: Saju) => string>> = {
  'analysis.structure': (saju) =>
    `${saju.analysis.structure.kind} ${saju.analysis.structure.outcome}`,
  'analysis.favorability': (saju) => JSON.stringify(saju.analysis.favorability.byRole),
  'analysis.rootQuality': (saju) => String(saju.analysis.rootQuality.dayMaster.strength),
  'analysis.bureaus': (saju) =>
    saju.analysis.bureaus.map((bureau) => `${bureau.kind}:${bureau.element}`).sort().join(','),
  'analysis.effectiveElements': (saju) =>
    Object.entries(saju.analysis.effectiveElements.distribution.ratios).sort(
      (a, b) => b[1] - a[1],
    )[0][0],
  /**
   * 통관은 **어느 쌍이 가장 팽팽한가**로 본다. 몫 자체를 견주면 소수점이 조금만
   * 움직여도 뒤집힌 것으로 세어져 100% 가 나오고, 그것은 값이 흔들렸다는 말이
   * 아니라 실수를 견줬다는 말이다.
   */
  'analysis.tonggwan': (saju) =>
    `${saju.analysis.tonggwan.tightest.controller}${saju.analysis.tonggwan.tightest.controlled}`,
  /** 대조의 답 하나만 본다 — 겹치는 글자 목록까지 견주면 조후 칸의 흔들림을 두 번 센다 */
  'analysis.yongsinAgreement': (saju) => String(saju.analysis.yongsinAgreement.aligned),
  /**
   * 서열은 정책에서 오므로 명식이 바꾸지 못한다 — **어긋남만 본다.** 서열까지 견주면
   * 언제나 같아서 「안 흔들린다」가 나오고, 그것은 이 자리가 무엇을 재는지 흐린다.
   */
  'analysis.precedence': (saju) =>
    saju.analysis.precedence.rows.map((row) => `${row.key}:${String(row.disagrees)}`).join(','),
};

describe('시주 민감도는 잰 값이다', () => {
  const pairs = pairsWithSameThreePillars(600);

  it('세 기둥이 같은 표본이 충분히 모인다', () => {
    expect(pairs.length).toBeGreaterThan(550);
  });

  it.each(Object.keys(OBSERVED) as ClaimPath[])(
    '%s 는 시주 두 글자로 판정이 뒤집힌다',
    (path) => {
      const observe = OBSERVED[path]!;
      const flipped = pairs.filter(
        ({ withHour, hourless }) => observe(withHour) !== observe(hourless),
      ).length;

      // 계약이 「흔들린다」고 적은 자리는 실제로 흔들려야 한다. 자릿수만 잠근다 —
      // 정확한 비율은 표본이 바뀌면 움직이고, 여기서 지킬 것은 방향이다.
      expect(flipped / pairs.length).toBeGreaterThan(0.05);
      expect(HOUR_SENSITIVE_PATHS).toContain(path);
    },
  );

  /**
   * 암합만 목록에 없다. 시주를 지우면 **짝이 줄기만 하고 남은 짝은 그대로다** —
   * 「이것이 전부다」가 흔들리는 것이지 「이것이 있다」가 흔들리는 것이 아니라,
   * 행은 `fact` 로 서고 한계는 목록이 따로 든다(`relation.coverage` 와 같은 자리).
   */
  it('암합은 흔들리지 않는다 — 짧아질 뿐이다', () => {
    const pairOf = (saju: Saju) =>
      new Set(saju.analysis.hiddenCombinations.map((combination) => JSON.stringify(combination)));

    let shorter = 0;
    for (const { withHour, hourless } of pairs) {
      const [full, partial] = [pairOf(withHour), pairOf(hourless)];

      for (const combination of partial) expect(full).toContain(combination);
      if (partial.size < full.size) shorter += 1;
    }

    expect(shorter / pairs.length).toBeGreaterThan(0.9);
    expect(HOUR_SENSITIVE_PATHS).not.toContain('analysis.hiddenCombinations');
  });
});
