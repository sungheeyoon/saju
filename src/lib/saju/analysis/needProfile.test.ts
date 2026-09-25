import { describe, expect, it } from 'vitest';

import { computeSaju } from '..';
import { BRANCHES, pillarOf, type Branch, type Stem } from '../constants';
import { COMPAT_POLICY } from '../compat';
import { hourPillarOf } from '../pillars/hour';
import { randomInputs, withoutHour } from '../population';
import { eokbuJudgementOf } from './eokbuJudgement';
import { johuJudgementOf } from './johuJudgement';
import { eokbuJohuRelationOf, needProfileOf } from './needProfile';
import { NEED_PROFILE_POLICY, type Grade, type NeedEntry, type NeedProfile } from './needProfileTypes';
import { EOKBU_EXTERNAL_CASES } from './validation/eokbuExternalCases';

/** 표본 1000건(시 있음)과 시 미상 100건이 열두 시를 다 돈다 — 기본 5초로는 모자란다 */
const POPULATION_TIMEOUT_MS = 30_000;

const GRADE_RANK: Record<Grade, number> = { low: 0, medium: 1, high: 2 };

/** 간지 넷으로 명식을 짓는다 — 반월을 안 보는 자리에서만 */
const chart = (year: string, month: string, day: string, hour: string | null) => {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };
  const parsedDay = parse(day);
  return {
    year: parse(year),
    month: parse(month),
    day: parsedDay,
    hour: hour === null ? null : parse(hour),
    dayMaster: parsedDay.stem,
  };
};

/** 외부 억부 사례의 원국 — 출처가 실은 실제 명식이다 */
const externalChart = (id: string) => {
  const testCase = EOKBU_EXTERNAL_CASES.find((entry) => entry.id === id);
  if (testCase === undefined) throw new Error(`외부 사례가 없다: ${id}`);
  const { year, month, day, hour } = testCase.pillars;
  return chart(year, month, day, hour);
};

const targetOf = (entry: NeedEntry) =>
  entry.target.kind === 'element' ? entry.target.element : entry.target.stem;

const entryOf = (profile: NeedProfile, target: string) => {
  const found = profile.entries.find((entry) => targetOf(entry) === target);
  if (!found) throw new Error(`프로필에 ${target} 이 없다`);
  return found;
};

describe('관계 — 억부와 조후가 같은 쪽을 가리키는가', () => {
  /**
   * 乙巳 辛巳 乙酉 癸未(무작위 표본 `randomInputs` 201번, 乙木 일간 · 巳월) — 신약에 억부 1순위가
   * 인성 水이고, 乙巳 조후는 癸 하나를 권한다. 癸는 시간에 드러났다. 조후 칸에 판정 안 한 조건이
   * 없고 종격도 안 서므로 두 길이 같은 쪽을 가리킨다는 말까지 선다(`reinforced`).
   */
  it('조후 활성 글자가 모두 억부 1순위 오행이면 같은 쪽이고 서열은 reinforced 다', () => {
    const profile = needProfileOf(chart('乙巳', '辛巳', '乙酉', '癸未'));

    expect(profile.relation).toEqual({
      kind: 'same-direction',
      precedence: 'reinforced',
      signals: ['both-point-same-way'],
      unresolvedBecause: [],
    });
    expect(profile.entries.map((entry) => `${entry.action}:${targetOf(entry)}:${entry.seat}`)).toEqual([
      'reinforce:水:revealed',
      'johu:癸:revealed',
    ]);
    // 같은 쪽이어도 세기를 올리지 않는다 — 억부 세기는 억부 불균형 그대로, 조후 글자는 조후 급함 그대로다.
    expect(entryOf(profile, '水').strength).toBe(profile.eokbu.imbalance);
    expect(entryOf(profile, '水').sources).toEqual(['eokbu']);
    expect(entryOf(profile, '癸').strength).toBe('unresolved');
    expect(entryOf(profile, '癸').sources).toEqual(['johu']);
  });

  /**
   * `8ja-145`(癸卯 丙辰 戊申 甲寅, 戊土 일간) — 신약에 관성 木이 가장 무겁고 억부 1순위는 인성 火다.
   * 戊辰 조후는 甲 · 丙 · 癸를 권하는데 甲이 바로 그 무거운 木이다. 조후가 억부가 덜고 싶은 쪽을
   * 보태므로 `conflict` 이고 서열은 못 정한다.
   */
  it('조후 글자 하나라도 억부의 가장 무거운 쪽이면 conflict 이고 신뢰도는 low 다', () => {
    const profile = needProfileOf(externalChart('8ja-145-weak-muto'));

    expect(profile.relation.kind).toBe('conflict');
    expect(profile.relation.precedence).toBe('unresolved');
    expect(profile.aggravating).toEqual(['木']);
    expect(profile.entries.map(targetOf)).toEqual(['火', '甲', '丙', '癸']);
    expect(profile.relation.unresolvedBecause).toContain(
      '조후 글자가 억부의 가장 무거운 쪽을 보탬 — 어느 쪽을 따를지 정한 규칙이 없음',
    );
    expect(profile.confidence).toBe('low');
  });

  /**
   * 乙酉 辛巳 乙巳 辛巳(무작위 표본 12번) — 위의 乙巳 명식처럼 억부 水 · 조후 癸로 같은 쪽을
   * 가리키지만 종격 판정이 선다. 그 쪽 자체가 뒤집힐 수 있어 `reinforced` 가 못 된다.
   * `8ja-149`(己未 丙子 戊辰 丙辰)는 외부 사례 쪽 — 종격이 `true-following` 으로 서는 명식이다.
   */
  it('종격이 억부를 뒤집을 수 있으면 같은 쪽이어도 서열은 unresolved 이고 그 까닭을 든다', () => {
    const profile = needProfileOf(chart('乙酉', '辛巳', '乙巳', '辛巳'));

    expect(profile.relation.kind).toBe('same-direction');
    expect(profile.relation.signals).toEqual(['following-may-reverse', 'both-point-same-way']);
    expect(profile.relation.precedence).toBe('unresolved');
    expect(profile.relation.unresolvedBecause).toContain('종격이 억부를 뒤집을 수 있음');

    const stagnant = externalChart('8ja-149-stagnant-muto');
    const relation = eokbuJohuRelationOf(eokbuJudgementOf(stagnant), johuJudgementOf(stagnant), {
      verdict: 'true-following',
    });
    expect(relation.signals).toContain('following-may-reverse');
    expect(relation.precedence).toBe('unresolved');
    expect(relation.unresolvedBecause).toContain(
      '종격이 억부를 뒤집을 수 있음(종격 판정 true-following)',
    );
  });
});

describe('자리 — 쓸 수 있는 글자인가', () => {
  /**
   * 乙丑은 丙 하나를 권한다. 丁卯 丁丑 乙卯 丁亥 에는 丙이 없고 같은 불인 丁만 셋 드러났다 —
   * 丙 칸의 자리는 `absent` 다. 해의 기둥만 바꾸면 같은 丙의 자리가 丙寅(드러남) · 丁巳(巳의 본기) ·
   * 戊寅(寅의 중기)으로 갈린다. 조후 판정의 `presence` 는 뒤 둘을 다 `hidden` 이라 하지만 프로필은
   * 본기와 숨은 글자를 가른다.
   */
  it('조후 글자 자체가 있는가로 자리를 세고 같은 오행의 다른 글자로 대신 세지 않는다', () => {
    const seatOfBing = (year: string) => {
      const profile = needProfileOf(chart(year, '丁丑', '乙卯', '丁亥'));
      return { seat: entryOf(profile, '丙').seat, presence: profile.johu.stems[0].presence };
    };

    expect(seatOfBing('丁卯')).toEqual({ seat: 'absent', presence: 'absent' });
    expect(seatOfBing('丙寅')).toEqual({ seat: 'revealed', presence: 'revealed' });
    expect(seatOfBing('丁巳')).toEqual({ seat: 'branch-main', presence: 'hidden' });
    expect(seatOfBing('戊寅')).toEqual({ seat: 'hidden-only', presence: 'hidden' });

    const onlyDing = needProfileOf(chart('丁卯', '丁丑', '乙卯', '丁亥'));
    expect(onlyDing.johu.stems[0].sameElementOthers).toEqual([{ stem: '丁', presence: 'revealed' }]);
  });

  /**
   * `dtsm-shuaiwang-mok-wang-geuk`(癸卯 乙卯 甲寅 乙亥, 旺極의 甲木) — 줄은 여섯(억부 火 · 조후
   * 庚丙丁戊己)인데 하나도 천간에 드러나지 않았고 지지 본기도 아니다. 권하는 것이 많은 것과
   * 쓸 글자가 있는 것은 다르다.
   */
  it('줄이 많아도 전부 숨었거나 없으면 그 자리를 그대로 말한다', () => {
    const profile = needProfileOf(externalChart('dtsm-shuaiwang-mok-wang-geuk'));

    expect(profile.entries.map((entry) => `${targetOf(entry)}:${entry.seat}`)).toEqual([
      '火:hidden-only',
      '庚:absent',
      '丙:hidden-only',
      '丁:absent',
      '戊:hidden-only',
      '己:absent',
    ]);
  });
});

describe('합화 · 국과 시 미상', () => {
  /**
   * `qlmg-jiang`(丁亥 庚戌 己巳 庚午, 己土 일간) — 실효 분포로 보면 신강에 인성 火가 가장 무거워
   * 억부 1순위가 재성 水이고, 조후 丙이 그 무거운 火를 보태 `conflict` 다. 합화 · 국을 끄면
   * 1순위가 관성 木으로 바뀌고 조후 甲이 그 木이라 `partial` 로 넘어간다. 조후 줄은 그대로다.
   */
  it('합화 · 국을 끄면 억부 줄과 관계가 바뀌고 조후 줄은 그대로다', () => {
    const jiang = externalChart('qlmg-jiang-unstated-gito');
    const effective = needProfileOf(jiang);
    const literal = needProfileOf(jiang, { distribution: 'literal', strength: { basis: 'literal' } });

    expect(effective.relation.kind).toBe('conflict');
    expect(literal.relation.kind).toBe('partial');
    expect(effective.entries.map(targetOf)).toEqual(['水', '甲', '丙', '癸']);
    expect(literal.entries.map(targetOf)).toEqual(['木', '甲', '丙', '癸']);
    expect(effective.johu).toEqual(literal.johu);
  });

  /**
   * `qlmg-chen`(壬子 丙午 癸亥 戊午) — 시를 알면 억부 1순위 水에 조후 壬 · 癸가 겹쳐 `partial`,
   * 시를 지우면 1순위가 土로 바뀌어 `conflict` 다. 시 미상의 신뢰도는 어느 시를 넣은 것보다도
   * 높지 않다.
   */
  it('시를 모르면 관계가 바뀔 수 있고 신뢰도는 시를 넣은 어느 판정보다도 높지 않다', () => {
    const known = externalChart('qlmg-chen-weak-gyesu');
    const hourless = needProfileOf({ ...known, hour: null });

    expect(needProfileOf(known).relation.kind).toBe('partial');
    expect(hourless.relation.kind).toBe('conflict');
    expect(hourless.eokbu.hour).toMatchObject({ hourKnown: false });

    for (const branch of BRANCHES) {
      const completed = needProfileOf({ ...known, hour: hourPillarOf(known.dayMaster, branch) });
      expect(GRADE_RANK[hourless.confidence]).toBeLessThanOrEqual(GRADE_RANK[completed.confidence]);
    }
  });

  it(
    '표본 100건에서 시 미상 프로필의 신뢰도는 열두 시 어느 것보다도 높지 않다',
    () => {
      for (const input of randomInputs(100)) {
        const { pillars } = computeSaju(withoutHour(input));
        const hourless = needProfileOf(pillars);
        for (const branch of BRANCHES) {
          const completed = needProfileOf({ ...pillars, hour: hourPillarOf(pillars.dayMaster, branch) });
          expect(GRADE_RANK[hourless.confidence]).toBeLessThanOrEqual(GRADE_RANK[completed.confidence]);
        }
      }
    },
    POPULATION_TIMEOUT_MS,
  );
});

describe('한 사람만 본다', () => {
  /**
   * 다음 일(A→B · B→A 보완 계산)이 사람마다 한 번씩 부른다. 부르는 순서가 값을 바꾸면 A→B 와
   * B→A 가 다른 사람을 보게 된다.
   */
  it('두 사람의 프로필은 어느 쪽을 먼저 계산해도 같다', () => {
    const a = externalChart('8ja-145-weak-muto');
    const b = chart('乙巳', '辛巳', '乙酉', '癸未');

    const aFirst = [needProfileOf(a), needProfileOf(b)];
    const bFirst = [needProfileOf(b), needProfileOf(a)];

    expect(aFirst[0]).toEqual(bFirst[1]);
    expect(aFirst[1]).toEqual(bFirst[0]);
    expect(needProfileOf(a)).toEqual(aFirst[0]);
  });
});

describe('무작위 표본 1000건 (시드 20260821)', () => {
  /**
   * 관계의 갈래 · 서열 · 신호를 한 바퀴로 센다. 기존 대조 `yongsinAgreementOf`(`aligned`)와 견준
   * 표도 함께 든다 — `aligned` 는 「조후 글자 중 억부 오행짜리가 **있는가**」라 조후가 무거운 쪽을
   * 함께 보태는 명식(여기서는 `conflict`)도 `true` 로 센다.
   */
  it(
    '관계 갈래 · 서열의 분포와 yongsinAgreement 와의 교차표가 잠긴 값이다',
    () => {
      const kinds: Record<string, number> = {};
      const precedence: Record<string, number> = {};
      const cross: Record<string, number> = {};
      const signals: Record<string, number> = {};
      let unresolvedWithoutReason = 0;
      let primaryMismatch = 0;

      for (const input of randomInputs(1000)) {
        const saju = computeSaju(input);
        const profile = needProfileOf(saju.pillars, { instant: saju.meta.instant });
        const { kind } = profile.relation;

        kinds[kind] = (kinds[kind] ?? 0) + 1;
        precedence[profile.relation.precedence] = (precedence[profile.relation.precedence] ?? 0) + 1;
        const key = `${kind}:${saju.analysis.yongsinAgreement.aligned ? 'aligned' : 'apart'}`;
        cross[key] = (cross[key] ?? 0) + 1;
        for (const signal of profile.relation.signals) signals[signal] = (signals[signal] ?? 0) + 1;

        if (profile.relation.precedence === 'unresolved' && profile.relation.unresolvedBecause.length === 0) {
          unresolvedWithoutReason += 1;
        }
        const primary = profile.entries[0];
        if (primary.target.kind !== 'element' || primary.target.element !== saju.analysis.eokbu.suggestedElement) {
          primaryMismatch += 1;
        }
        // 조후 급함은 아직 단계가 없다 — 그러면 서열 `eokbu` · `johu` 도 서지 않는다.
        expect(profile.relation.precedence).not.toBe('eokbu');
        expect(profile.relation.precedence).not.toBe('johu');
        expect(profile.confidence).toBe('low');
      }

      expect(unresolvedWithoutReason).toBe(0);
      expect(primaryMismatch).toBe(0);
      expect(kinds).toEqual({ conflict: 373, partial: 390, 'not-comparable': 199, 'same-direction': 38 });
      expect(precedence).toEqual({ unresolved: 975, reinforced: 25 });
      expect(cross).toEqual({
        'conflict:aligned': 188,
        'conflict:apart': 185,
        'partial:aligned': 352,
        'partial:apart': 38,
        'not-comparable:apart': 199,
        'same-direction:aligned': 38,
      });
      expect(signals['johu-urgent']).toBeUndefined();
      expect(signals['both-point-same-way']).toBe(38);
    },
    POPULATION_TIMEOUT_MS,
  );
});

describe('외부 억부 사례 회귀 (억부 논리 20건)', () => {
  const scored = EOKBU_EXTERNAL_CASES.filter(
    (testCase) =>
      testCase.chartConstruction === 'consistent' &&
      (testCase.yongsinDoctrine ?? 'eokbu') === 'eokbu',
  ).map((testCase) => ({ testCase, profile: needProfileOf(externalChart(testCase.id)) }));

  /**
   * 프로필은 억부 판정을 그대로 싣는다 — 억부 줄로 센 일치가 억부 판정의 10/20 · 15/20 과 같아야
   * 한다. 조후가 같은 쪽을 가리키는 사례는 스물 중 없다.
   */
  it('억부 줄의 일치는 1순위 10/20 · 1순위 또는 대안 15/20 그대로다', () => {
    expect(scored).toHaveLength(20);
    const eokbuEntries = (profile: NeedProfile) =>
      profile.entries.filter((entry) => entry.sources.includes('eokbu'));

    expect(
      scored.filter(({ testCase, profile }) => targetOf(eokbuEntries(profile)[0]) === testCase.claim.suggestedElement)
        .length,
    ).toBe(10);
    expect(
      scored.filter(({ testCase, profile }) =>
        eokbuEntries(profile).some((entry) => targetOf(entry) === testCase.claim.suggestedElement),
      ).length,
    ).toBe(15);
  });

  it('관계는 conflict 4 · partial 7 · not-comparable 9 이고 서열은 스물 다 unresolved 다', () => {
    const kinds: Record<string, number> = {};
    for (const { profile } of scored) kinds[profile.relation.kind] = (kinds[profile.relation.kind] ?? 0) + 1;

    expect(kinds).toEqual({ conflict: 4, partial: 7, 'not-comparable': 9 });
    expect(scored.every(({ profile }) => profile.relation.precedence === 'unresolved')).toBe(true);
  });

  /** 프로필은 점수가 아니다 — 궁합 계산의 정책이 이 일로 움직이지 않았다 */
  it('궁합은 여전히 점수를 내지 않는다', () => {
    expect(COMPAT_POLICY.scoring).toBe('not-scored');
    expect(NEED_PROFILE_POLICY.scoring).toBe(COMPAT_POLICY.scoring);
  });
});
