import { describe, expect, it } from 'vitest';
import {
  pillarOf,
  principalStem,
  STEM_INFO,
  type Branch,
  type Element,
  type Stem,
} from '../constants';
import { hourPillarOf } from '../pillars/hour';
import { monthPillarOf } from '../pillars/month';
import {
  needComplementOf,
  providerSeatsOfElement,
  type ProviderChart,
  type ProviderPresence,
} from './needComplement';
import { needProfileOf } from './needProfile';
import {
  COMPAT_EXTERNAL_CASES,
  type CasePerson,
  type CasePillars,
  type CompatVerdict,
} from './validation/compatExternalCases';

/**
 * 궁합 외부 사례(`compatExternalCases.ts`)의 모양과, 전문가 판정 × 주는 쪽 자리의 **관찰**.
 *
 * 규칙을 잠그지 않는다. 방향별 필요 보완(ADR 0112)이 등급을 열어 둔 채로, 전문가가 「채운다」고 한 방향과
 * 「못 채운다 · 해친다」고 한 방향에서 주는 쪽 자리가 어떻게 갈리는지를 수로 적어 둔다. 사례가 늘거나
 * 엔진이 바뀌면 이 수가 움직이고, 그때 무엇이 움직였는지 드러난다.
 */

const parse = (name: string) => {
  const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
  if (!pillar) throw new Error(`간지가 아니다: ${name}`);
  return pillar;
};

const chartOf = (pillars: CasePillars): ProviderChart => {
  const day = parse(pillars.day);
  return {
    year: parse(pillars.year),
    month: parse(pillars.month),
    day,
    hour: pillars.hour === null ? null : parse(pillars.hour),
    dayMaster: day.stem,
  };
};

const PRESENCE_RANK: Record<ProviderPresence, number> = {
  'day-master': 0,
  'other-stem': 1,
  'branch-main': 2,
  'hidden-only': 3,
  absent: 4,
};

/** 받는 쪽이 바란 오행들 중 주는 쪽에서 가장 센 자리 — `presences[0]` 의 최소 */
function strongestPresence(provider: ProviderChart, needs: readonly Element[]): ProviderPresence {
  const ranked = needs.map((element) => providerSeatsOfElement(provider, element).presences[0]);
  return ranked.reduce((best, next) => (PRESENCE_RANK[next] < PRESENCE_RANK[best] ? next : best));
}

/** 드러난 글자(천간 넷 · 지지 본기 넷, 시를 모르면 여섯) 중 그 오행들인 것의 수 */
function visibleCount(provider: ProviderChart, elements: readonly Element[]): number {
  const pillars = [provider.year, provider.month, provider.day, provider.hour].flatMap((p) =>
    p === null ? [] : [p],
  );
  const stems = pillars.map((p) => p.stem);
  const mains = pillars.map((p) => principalStem(p.branch));
  return [...stems, ...mains].filter((stem) => elements.includes(STEM_INFO[stem].element)).length;
}

const personOf = (people: readonly [CasePerson, CasePerson], label: string): CasePerson => {
  const person = people.find((p) => p.label === label);
  if (!person) throw new Error(`이름표가 없다: ${label}`);
  return person;
};

/** 판정이 선 방향마다 한 줄 */
const MEASURED = COMPAT_EXTERNAL_CASES.flatMap((testCase) =>
  testCase.directions
    .filter((direction) => direction.verdict !== 'unstated')
    .map((direction) => {
      const receiver = personOf(testCase.people, direction.receiver);
      const provider = personOf(testCase.people, direction.provider);
      const receiverChart = chartOf(receiver.pillars);
      const providerChart = chartOf(provider.pillars);
      const complement = needComplementOf(needProfileOf(receiverChart), providerChart);
      const primary = complement.matched.eokbuPrimary.element;
      const monthMain = STEM_INFO[principalStem(providerChart.month.branch)].element;
      return {
        id: `${testCase.id}:${direction.receiver}←${direction.provider}`,
        practitioner: testCase.practitioner,
        credibility: testCase.credibility,
        verdict: direction.verdict,
        cited: direction.cited,
        strongest: strongestPresence(providerChart, receiver.needs),
        needVisible: visibleCount(providerChart, receiver.needs),
        avoidVisible:
          receiver.avoids.length > 0 ? visibleCount(providerChart, receiver.avoids) : null,
        monthIsNeed: receiver.needs.includes(monthMain),
        enginePrimaryInNeeds: receiver.needs.includes(primary),
        relation: complement.relationByBasis,
      };
    }),
);

const VERDICTS: readonly CompatVerdict[] = ['supplies', 'partial', 'does-not', 'harms', 'mixed'];

describe('궁합 외부 사례 — 모양', () => {
  // 2026-09-25 CN-2 보충으로 31 → 34 쌍(蒲云星命 1 · 奇门风水刘老师 1 · 吉言网 1).
  it('id 는 겹치지 않고 두 계통 · 서른네 쌍이다', () => {
    const ids = COMPAT_EXTERNAL_CASES.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(34);
    const byLineage = COMPAT_EXTERNAL_CASES.reduce<Record<string, number>>((acc, c) => {
      acc[c.lineage] = (acc[c.lineage] ?? 0) + 1;
      return acc;
    }, {});
    expect(byLineage).toEqual({
      'chinese-modern-consult': 31,
      'korean-modern-forum': 3,
    });
    // 같은 글쓴이의 글은 서로 독립이 아니다 — 글쓴이로도 센다.
    expect(new Set(COMPAT_EXTERNAL_CASES.map((c) => c.practitioner)).size).toBe(9);
  });

  /**
   * 공신력(`SourceCredibility`). 34 쌍이 모두 상담 블로그 · 카페 글(`B`)이고 서명 없는 업체 글 하나가 `C` 다.
   * **S · A 는 0** — 고전 · 출간 저서 · 논문에서 두 명식을 놓고 방향별 공급을 판정한 예를 못 찾았다. 그래서
   * 「S · A 만 남긴 교차표」는 빈 표이고, 아래 관찰은 전부 B · C 의 것이다.
   */
  it('공신력은 B 33 · C 1 이고 S · A 는 없다', () => {
    const byTier = COMPAT_EXTERNAL_CASES.reduce<Record<string, number>>((acc, c) => {
      acc[c.credibility] = (acc[c.credibility] ?? 0) + 1;
      return acc;
    }, {});
    expect(byTier).toEqual({ B: 33, C: 1 });
    expect(MEASURED.filter((m) => m.credibility === 'S' || m.credibility === 'A')).toHaveLength(0);
  });

  /** 글쓴이 몰림 — 판정이 선 64 방향 중 두 사람(剑桥 22 · 华人易 20)이 42 다 */
  it('판정이 선 방향의 글쓴이별 수', () => {
    const byPractitioner = MEASURED.reduce<Record<string, number>>((acc, m) => {
      acc[m.practitioner] = (acc[m.practitioner] ?? 0) + 1;
      return acc;
    }, {});
    expect(byPractitioner).toEqual({
      剑桥易学文化: 22,
      华人易: 20,
      '조은(원리학당)': 6,
      一德老师: 4,
      奇门风水刘老师: 4,
      '史老师(一玄堂)': 2,
      三生石: 2,
      蒲云星命: 2,
      '吉言网(서명 없음)': 2,
    });
  });

  it('모든 기둥은 육십갑자이고 시를 모르는 명식은 둘뿐이다', () => {
    let unknownHours = 0;
    for (const testCase of COMPAT_EXTERNAL_CASES) {
      for (const person of testCase.people) {
        expect(() => chartOf(person.pillars), testCase.id).not.toThrow();
        if (person.pillars.hour === null) unknownHours += 1;
      }
    }
    expect(unknownHours).toBe(2);
  });

  /** 월간은 연간에서(오호둔), 시간은 일간에서(오자둔) 정해진다 — 출처가 지은 조합인지 저장소 규칙으로 다시 센다 */
  it('예순여덟 명식이 모두 오호둔 · 오자둔과 맞는다', () => {
    const unrealizable: string[] = [];
    for (const testCase of COMPAT_EXTERNAL_CASES) {
      for (const person of testCase.people) {
        const { year, month, day, hour } = person.pillars;
        const derivedMonth = monthPillarOf(year[0] as Stem, month[1] as Branch);
        const monthOk = `${derivedMonth.stem}${derivedMonth.branch}` === month;
        const derivedHour = hour === null ? null : hourPillarOf(day[0] as Stem, hour[1] as Branch);
        const hourOk = derivedHour === null || `${derivedHour.stem}${derivedHour.branch}` === hour;
        if (!monthOk || !hourOk) unrealizable.push(`${testCase.id}:${person.label}`);
      }
    }
    expect(unrealizable).toEqual([]);
  });

  it('방향마다 받는 쪽 · 주는 쪽이 쌍 안의 이름표이고 인용이 있다', () => {
    for (const testCase of COMPAT_EXTERNAL_CASES) {
      const labels = testCase.people.map((p) => p.label);
      expect(new Set(labels).size, testCase.id).toBe(2);
      expect(testCase.directions.length, testCase.id).toBeGreaterThan(0);
      for (const direction of testCase.directions) {
        expect(labels, testCase.id).toContain(direction.receiver);
        expect(labels, testCase.id).toContain(direction.provider);
        expect(direction.receiver, testCase.id).not.toBe(direction.provider);
        expect(direction.quote.length, testCase.id).toBeGreaterThan(0);
        // 판정이 선 방향은 받는 쪽의 필요가 적혀 있어야 잴 수 있다.
        if (direction.verdict !== 'unstated') {
          expect(
            personOf(testCase.people, direction.receiver).needs.length,
            testCase.id,
          ).toBeGreaterThan(0);
        }
      }
      expect(testCase.source.url.startsWith('https://'), testCase.id).toBe(true);
    }
  });
});

describe('궁합 외부 사례 — 전문가 판정과 주는 쪽 자리(관찰)', () => {
  const ofVerdict = (verdict: CompatVerdict) => MEASURED.filter((m) => m.verdict === verdict);
  const NEGATIVE = MEASURED.filter((m) => m.verdict === 'harms' || m.verdict === 'does-not');
  const SUPPLIES = ofVerdict('supplies');

  // CN-2 보충: 58 → 64 방향. 「채운다」 +2 · 「조금」 +3 · 「못 채운다」 +1.
  it('판정이 선 방향은 64 이고 「채운다」가 38 · 「해친다」가 16 이다', () => {
    expect(MEASURED).toHaveLength(64);
    expect(Object.fromEntries(VERDICTS.map((v) => [v, ofVerdict(v).length]))).toEqual({
      supplies: 38,
      partial: 7,
      'does-not': 2,
      harms: 16,
      mixed: 1,
    });
  });

  /**
   * 받는 쪽이 바란 오행들 중 주는 쪽에서 가장 센 자리(`presences[0]` 의 최소).
   *
   * 「채운다」 38 방향은 **하나도** 숨은 자리(`hidden-only`)나 없음에서 서지 않았다 — 37 이 천간(일간 16 ·
   * 다른 천간 21)이다. 거꾸로 「해친다 · 못 채운다」 18 방향 중 15 도 바란 오행이 천간이나 본기에 드러나 있다.
   * **드러났는가는 「채운다」의 필요조건처럼 보이지만 충분조건이 아니다.**
   */
  it('「채운다」는 모두 드러난 자리에서 섰고, 숨은 자리에만 있으면 「채운다」가 0 이다', () => {
    const tally = (rows: typeof MEASURED) =>
      Object.fromEntries(
        (Object.keys(PRESENCE_RANK) as ProviderPresence[]).map((p) => [
          p,
          rows.filter((m) => m.strongest === p).length,
        ]),
      );
    expect(tally(SUPPLIES)).toEqual({
      'day-master': 16,
      'other-stem': 21,
      'branch-main': 1,
      'hidden-only': 0,
      absent: 0,
    });
    expect(tally(NEGATIVE)).toEqual({
      'day-master': 5,
      'other-stem': 8,
      'branch-main': 2,
      'hidden-only': 3,
      absent: 0,
    });
    // 지장간을 공급 근거로 든 전문가는 64 방향에 한 번도 없다. 거꾸로 「천간에 안 드러났다(不现)」를
    // 공급 부정의 근거로 든 방향이 하나 있다(`jq-yfeh`).
    expect(MEASURED.filter((m) => m.cited.includes('hidden'))).toHaveLength(0);
    expect(MEASURED.filter((m) => m.cited.includes('not-revealed')).map((m) => m.id)).toEqual([
      'jq-yfeh:M←F',
    ]);
  });

  /**
   * 개수 — 주는 쪽의 드러난 글자(천간 넷 · 지지 본기 넷) 중 받는 쪽이 바란 오행인 것의 수.
   *
   * 「채운다」의 가운데값은 4, 「해친다 · 못 채운다」는 2 다. 넷 이상이 「채운다」 38 중 32, 부정 18 중 4.
   * 전문가 39 방향이 「旺 · 多 · 林立」을 근거로 든 것과 같은 쪽이다 — 그들은 자리보다 **양**을 말한다.
   * 다만 CN-2 보충의 `puyun-sohu-224270400:M←F` 는 드러난 셋으로 「채운다」, 같은 쌍의 반대 방향은 셋이어도
   * 「조금」이다 — 출처는 개수가 아니라 **주는 쪽 원국에서 그 오행이 우세한가**를 말한다.
   */
  it('바란 오행의 드러난 글자 수가 넷 이상인 방향이 「채운다」에 몰린다', () => {
    const atLeast = (rows: typeof MEASURED, n: number) =>
      rows.filter((m) => m.needVisible >= n).length;
    expect([atLeast(SUPPLIES, 3), atLeast(SUPPLIES, 4), SUPPLIES.length]).toEqual([35, 32, 38]);
    expect([atLeast(NEGATIVE, 3), atLeast(NEGATIVE, 4), NEGATIVE.length]).toEqual([7, 4, 18]);
    // 기신 쪽 — 받는 쪽이 꺼린다고 적은 오행이 주는 쪽에 넷 이상 드러난 방향
    const avoidHeavy = (rows: typeof MEASURED) => [
      rows.filter((m) => m.avoidVisible !== null && m.avoidVisible >= 4).length,
      rows.filter((m) => m.avoidVisible !== null).length,
    ];
    expect(avoidHeavy(SUPPLIES)).toEqual([7, 19]);
    expect(avoidHeavy(ofVerdict('harms'))).toEqual([9, 13]);
  });

  /** 계절 — 주는 쪽 월지 본기의 오행이 받는 쪽이 바란 오행인가 */
  it('주는 쪽 월령이 바란 오행인 방향은 「채운다」 38 중 27, 부정 18 중 3 이다', () => {
    const monthHits = (rows: typeof MEASURED) => rows.filter((m) => m.monthIsNeed).length;
    expect(monthHits(SUPPLIES)).toBe(27);
    expect(monthHits(NEGATIVE)).toBe(3);
    // 출처가 월령 · 계절을 **말로** 든 방향은 여섯뿐이다 — 대부분은 「旺」 한 마디에 월령이 묻혀 있다.
    expect(MEASURED.filter((m) => m.cited.includes('month-command'))).toHaveLength(6);
  });

  it('출처가 든 근거는 「왕하다(abundance)」가 39 로 가장 많고, 일간 · 일주를 든 것은 여덟이다', () => {
    const cited = MEASURED.flatMap((m) => m.cited).reduce<Record<string, number>>((acc, basis) => {
      acc[basis] = (acc[basis] ?? 0) + 1;
      return acc;
    }, {});
    expect(cited).toEqual({
      abundance: 39,
      'month-command': 6,
      'day-master': 5,
      'day-pillar': 3,
      stem: 4,
      branch: 3,
      'not-revealed': 1,
      combination: 1,
      clash: 1,
    });
    expect(MEASURED.filter((m) => m.cited.length === 0)).toHaveLength(14);
  });

  /**
   * 엔진의 세 기준(ADR 0112)과 전문가 판정. `any` 는 64 중 63 이 `mixed` 라 판정과 무관하다.
   * `stems` 의 `supportive` 는 「채운다」 38 중 14, 「해친다」 16 중 1 이다.
   */
  it('엔진의 any 기준은 판정을 가르지 못하고 stems 기준만 조금 기운다', () => {
    const relationTally = (rows: typeof MEASURED, basis: 'any' | 'visible' | 'stems') =>
      rows.reduce<Record<string, number>>((acc, m) => {
        acc[m.relation[basis]] = (acc[m.relation[basis]] ?? 0) + 1;
        return acc;
      }, {});
    expect(MEASURED.filter((m) => m.relation.any === 'mixed')).toHaveLength(63);
    expect(relationTally(SUPPLIES, 'stems')).toEqual({
      supportive: 14,
      mixed: 21,
      conflicting: 2,
      'not-comparable': 1,
    });
    expect(relationTally(ofVerdict('harms'), 'stems')).toEqual({
      mixed: 13,
      conflicting: 2,
      supportive: 1,
    });
    expect(relationTally(SUPPLIES, 'visible')).toEqual({
      mixed: 31,
      supportive: 5,
      conflicting: 1,
      'not-comparable': 1,
    });
    // 엔진의 억부 1순위 오행이 출처가 적은 필요 오행 안에 드는 방향 — 필요 자체가 64 중 26 에서 어긋난다.
    expect(MEASURED.filter((m) => m.enginePrimaryInNeeds)).toHaveLength(38);
  });
});
