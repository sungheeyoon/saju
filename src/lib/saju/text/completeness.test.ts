import { describe, expect, it } from 'vitest';

import { computeSaju, type Saju } from '@/src/lib/saju';
import { analyzeCompatibility } from '@/src/lib/saju/compat';
import { currentFortuneOf } from '@/src/lib/saju/now';
import { absorbableByUnknownHour } from '@/src/lib/saju/relations';
import { randomInputs, withoutHour } from '@/src/lib/saju/population';
import { CLAIM_PATHS, ceilingFor, type ClaimPath } from '@/src/lib/saju/text/policy';

const VIEWED_AT = new Date('2026-08-31T00:00:00Z');

/**
 * **자리별 목록 전수 감사** — 시주가 붙으면 항목이 늘어나는 자리는 어디인가.
 *
 * 늘어난다면 시간 미상에서 「이것이 없다」는 **틀린 문장이 될 수 있다.** 얼마나
 * 자주 늘어나는지는 심각도의 문제이고, 「없다」를 말해도 되는가는 **반례 하나로
 * 정해진다.** 그래서 여기서 재는 것은 비율이 아니라 반례의 존재다.
 *
 * 이 표가 `CLAIM_PATHS` 를 전부 덮지 않으면 아래 첫 시험이 걸린다. 새 근거가
 * 들어오면 「목록인가 아닌가」를 그때 정하게 하려는 것이다 — 목록이 엔진을 못
 * 따라오는 것이 이 저장소가 되풀이해 겪은 실패다.
 */
const ITEMS: Partial<Record<ClaimPath, (saju: Saju) => string[]>> = {
  pillars: (saju) =>
    ['year', 'month', 'day', 'hour']
      .map((position) => saju.pillars[position as 'year'])
      .filter((pillar) => pillar !== null)
      .flatMap((pillar) => [`stem:${pillar.stem}`, `branch:${pillar.branch}`]),

  relations: (saju) =>
    saju.relations.map((r) => `${r.ko}@${r.participants.map((p) => p.position).join()}`),

  stages: (saju) =>
    Object.entries(saju.stages).flatMap(([basis, byPosition]) =>
      typeof byPosition === 'object' && byPosition !== null
        ? Object.entries(byPosition)
            .filter(([, stage]) => stage !== null)
            .map(([position, stage]) => `${basis}@${position}=${String(stage)}`)
        : [],
    ),

  sinsal: (saju) => [
    ...saju.sinsal.stars.flatMap((star) => star.hits.map((hit) => `${star.id}@${hit.position}`)),
    ...saju.sinsal.emptiness.flatMap((one) =>
      one.positions.map((position) => `empty:${one.basis}@${position}`),
    ),
    ...saju.sinsal.twelveSpirits.flatMap((chart) =>
      Object.entries(chart.byPosition)
        .filter(([, spirit]) => spirit !== null)
        .map(([position, spirit]) => `spirit:${chart.basis}@${position}=${String(spirit)}`),
    ),
  ],

  'analysis.tenGods': (saju) =>
    Object.entries(saju.analysis.tenGods).flatMap(([tier, byPosition]) =>
      typeof byPosition === 'object' && byPosition !== null
        ? Object.entries(byPosition)
            .filter(([, god]) => god !== null)
            .map(([position, god]) => `${tier}@${position}=${String(god)}`)
        : [],
    ),

  'analysis.hiddenCombinations': (saju) =>
    saju.analysis.hiddenCombinations.map((one) => JSON.stringify(one)),

  daeun: (saju) =>
    saju.daeun.entries.flatMap((entry) =>
      (entry.relations ?? []).map((r) => `${entry.index}:${r.ko}`),
    ),

  saeun: (saju) =>
    saju.saeun.entries.flatMap((entry) =>
      (entry.relations ?? []).map((r) => `${entry.year}:${r.ko}`),
    ),

  wolun: (saju) =>
    saju.wolun.entries.flatMap((entry) =>
      (entry.relations ?? []).map((r) => `${entry.monthOrder}:${r.ko}`),
    ),

  now: (saju) => {
    const now = currentFortuneOf(saju, VIEWED_AT);
    return (now.relations ?? []).map((r) => `now:${r.ko}`);
  },
};

/**
 * 목록이 아닌 자리 — 판정 하나이거나 값 하나라, 「늘어난다」가 뜻을 갖지 않는다.
 *
 * 값이 **달라지는** 것은 다른 축이고 `HOUR_SENSITIVE_PATHS` 가 든다.
 */
const NOT_A_LIST: readonly ClaimPath[] = [
  'meta',
  'analysis.elements',
  'analysis.effectiveElements',
  'analysis.bureaus',
  'analysis.tenGodCounts',
  'analysis.strength',
  'analysis.eokbu',
  'analysis.johu',
  'analysis.rootedness',
  'analysis.rootQuality',
  'analysis.followingCandidacy',
  'analysis.following',
  'analysis.structure',
  'analysis.favorability',
  /**
   * 통관 재료는 목록처럼 생겼지만 **늘어나지 않는다.** 극 관계는 명식과 무관하게
   * 언제나 다섯이라 시주가 붙어도 항목 수가 그대로다. 흔들리는 것은 순서와 몫이고,
   * 그 축은 `HOUR_SENSITIVE_PATHS` 가 든다(가장 팽팽한 쌍이 42.2% 에서 갈린다).
   */
  'analysis.tonggwan',
  /** 대조 하나다. 조후 후보 목록이 길어지는 것은 저쪽(`analysis.johu`)의 몫이다 */
  'analysis.yongsinAgreement',
  /**
   * 줄이 여럿이지만 **목록이 아니다.** 판정의 수는 명식이 아니라 엔진이 정하므로
   * 시주가 붙어도 줄이 늘지 않는다 — 늘어나는 것은 판정을 새로 만드는 날이다.
   */
  'analysis.precedence',
];

describe('자리별 목록의 완전성', () => {
  it('모든 근거 자리가 목록인지 아닌지 정해져 있다', () => {
    const decided = new Set<string>([...Object.keys(ITEMS), ...NOT_A_LIST]);

    expect(CLAIM_PATHS.filter((path) => !decided.has(path))).toEqual([]);
  });

  /**
   * **반례 하나면 정해진다.** 시주를 붙여 항목이 하나라도 늘어나는 자리를 찾고,
   * 그 자리에서 「없다」가 잠기는지 계약에 묻는다. 어느 목록이 그 일을 하는지는
   * 여기서 따지지 않는다 — `HOUR_SENSITIVE_PATHS` 든 `LIST_COMPLETENESS_PATHS`
   * 든 결과가 `silent` 이기만 하면 된다.
   */
  it('시주가 붙어 늘어나는 자리는 시간 미상에서 「없다」를 못 한다', { timeout: 30_000 }, () => {
    const grows = new Set<ClaimPath>();

    for (const input of randomInputs(400)) {
      const withHour = computeSaju(input);
      const hourless = computeSaju(withoutHour(input));

      // 세 기둥이 갈린 표본은 다른 명식이라 시주 두 글자의 몫이 아니다.
      const three = (saju: Saju) =>
        (['year', 'month', 'day'] as const).map((p) => saju.pillars[p].name).join(' ');
      if (three(withHour) !== three(hourless)) continue;

      for (const [path, itemsOf] of Object.entries(ITEMS)) {
        const before = new Set(itemsOf(hourless));
        if (itemsOf(withHour).some((item) => !before.has(item))) grows.add(path as ClaimPath);
      }
    }

    // 목록이랍시고 적어 놓고 한 번도 안 늘어나면 이 시험이 헛돈다.
    expect([...Object.keys(ITEMS)].filter((path) => !grows.has(path as ClaimPath))).toEqual([]);

    // 한 자리에서 멈추면 나머지가 안 보인다 — 다 모아서 한 번에 든다.
    const loud = [...grows].filter(
      (path) => ceilingFor({ paths: [path], polarity: 'absence', hourKnown: false }) !== 'silent',
    );

    expect(loud, '늘어나는데 「없다」를 fact 로 말하는 자리').toEqual([]);
  });

  /**
   * **반대 방향** — 늘어나는 것만 보면 절반만 본 것이다.
   *
   * 「480 쌍에서 0 건」이 그렇게 틀렸다. 늘어나는 쪽만 재고 줄어드는 쪽을 안 재서
   * 「행은 언제나 참」이 통과하고 있었다. 여기서는 **사라지는 것도 세고, 그것이
   * 아는 갈래를 넘지 않는지** 묻는다.
   */
  it('사라지는 것은 반쪽 삼합·방합뿐이다', { timeout: 30_000 }, () => {
    const beyond: string[] = [];
    let vanished = 0;

    for (const input of randomInputs(600)) {
      const withHour = computeSaju(input);
      const hourless = computeSaju(withoutHour(input));

      const three = (saju: Saju) =>
        (['year', 'month', 'day'] as const).map((p) => saju.pillars[p].name).join(' ');
      if (three(withHour) !== three(hourless)) continue;

      const after = new Set(
        withHour.relations.map((r) => `${r.ko}@${r.participants.map((p) => p.position).join()}`),
      );

      for (const relation of hourless.relations) {
        const key = `${relation.ko}@${relation.participants.map((p) => p.position).join()}`;
        if (after.has(key)) continue;

        vanished += 1;
        if (!absorbableByUnknownHour(relation, false)) beyond.push(key);
      }
    }

    // 반례가 없으면 아래 줄이 아무것도 재지 않는다.
    expect(vanished).toBeGreaterThan(0);
    expect(beyond, '흡수로 설명되지 않는데 사라진 관계').toEqual([]);
  });

  /**
   * 두 판이 합쳐 이룬 것은 **정의상 완성된 구조**라 흡수될 수 없다. 그 전제 위에
   * `combined-absorbable` 변종을 두지 않았으므로(`relationVariant`) 여기서 센다 —
   * 언젠가 반쪽 combined 가 생기면 문장이 하나 빠진 채로 나간다.
   */
  it('두 판이 합쳐 이룬 것에 반쪽은 없다', { timeout: 30_000 }, () => {
    const inputs = randomInputs(600);
    let counted = 0;

    for (let i = 0; i + 1 < inputs.length; i += 2) {
      const compat = analyzeCompatibility(
        computeSaju(withoutHour(inputs[i])),
        computeSaju(withoutHour(inputs[i + 1])),
      );

      for (const relation of compat.combinedFormations) {
        counted += 1;
        expect(relation.full, relation.ko).toBe(true);
      }
    }

    expect(counted).toBeGreaterThan(0);
  });

  it('「있다」는 내려가지 않는다 — 늘어나는 것과 흔들리는 것은 다른 축이다', () => {
    // 목록이 길어져도 적힌 항목은 그대로 참이다. `HOUR_SENSITIVE_PATHS` 가
    // 따로 잡는 자리(값이 달라지는 것)만 내려간다.
    for (const path of ['relations', 'sinsal', 'stages'] as const) {
      expect(ceilingFor({ paths: [path], polarity: 'presence', hourKnown: false })).toBe('fact');
    }
  });
});
