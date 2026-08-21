import { describe, expect, it } from 'vitest';

import {
  FOLLOWING_PATTERN_POLICY,
  followingAssessmentOf,
  followingCandidacyOf,
} from '@/src/lib/saju/analysis/followingPatterns';
import { bureausOf } from '@/src/lib/saju/analysis/bureau';
import { effectiveElementsOf } from '@/src/lib/saju/analysis/effectiveElements';
import { elementDistributionOf } from '@/src/lib/saju/analysis/fiveElements';
import { rootednessOf } from '@/src/lib/saju/analysis/rootedness';
import { rootQualityOf } from '@/src/lib/saju/analysis/rootQuality';
import { pillarOf, type Branch, type Stem } from '@/src/lib/saju/constants';

function candidacy(year: string, month: string, day: string, hour: string | null) {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };

  const parsedDay = parse(day);
  const pillars = {
    year: parse(year),
    month: parse(month),
    day: parsedDay,
    hour: hour === null ? null : parse(hour),
    dayMaster: parsedDay.stem,
  };

  return followingCandidacyOf(pillars, elementDistributionOf(pillars), rootednessOf(pillars));
}

describe('종격 후보 — 조건이 되는 사실', () => {
  /**
   * 종의 가장 앞 조건은 일간이 뿌리가 없다는 것이다. 판정을 미루더라도 이 사실은
   * 문턱과 무관하게 정해진다.
   */
  it('일간이 무근인지는 통근 계산에서 그대로 온다', () => {
    // 甲 일간에 木이 든 지지가 없다 — 무근.
    expect(candidacy('庚申', '乙酉', '甲申', '丁丑').dayMasterRootless).toBe(true);
    // 월지 寅에 통근한다.
    expect(candidacy('丙子', '庚寅', '甲午', '丙寅').dayMasterRootless).toBe(false);
  });

  it('가장 무거운 세력과 그 비중을 낸다', () => {
    // 金이 넷, 土가 둘 — 甲 일간에게 金은 관성이다.
    const found = candidacy('庚申', '乙酉', '甲申', '丁丑');

    expect(found.dominant.role).toBe('官星');
    expect(found.dominant.element).toBe('金');
    expect(found.dominant.ratio).toBeGreaterThan(0.35);
    // 세력 비중은 오행 분포를 그대로 쓴다 — 여기서 따로 세지 않는다.
    expect(found.dominant.ratio).toBeCloseTo(
      elementDistributionOf({
        year: pillarOf('庚', '申')!,
        month: pillarOf('乙', '酉')!,
        day: pillarOf('甲', '申')!,
        hour: pillarOf('丁', '丑')!,
      }).ratios['金'],
    );
  });

  it('월령을 그 세력이 잡았는지 짚는다', () => {
    // 월지 酉의 정기는 辛(金) — 가장 무거운 金과 같다.
    expect(candidacy('庚申', '乙酉', '甲申', '丁丑').monthCommandsDominant).toBe(true);
    // 월지 寅의 정기는 甲(木) — 여기서 가장 무거운 것은 木이 아니다.
    expect(candidacy('庚午', '壬午', '丙午', '甲午').monthCommandsDominant).toBe(true);
  });

  /**
   * 생부가 천간에 드러나 있으면 종이 어려워진다는 것이 계통 공통분모다. 다만
   * 몇 자까지 봐주는지가 가종 문턱이라 세기만 한다.
   */
  it('천간에 드러난 생부를 세되 일간 자신은 빼고 센다', () => {
    // 甲 일간, 년간 乙(비겁)·시간 癸(인성). 일간 자신은 목록에 없다.
    const found = candidacy('乙酉', '庚辰', '甲申', '癸酉');

    expect(found.supportStems.map((support) => [support.position, support.stem])).toEqual([
      ['year', '乙'],
      ['hour', '癸'],
    ]);
    expect(found.supportStems.map((support) => support.role)).toEqual(['比劫', '印星']);
  });

  it('생부가 하나도 드러나지 않으면 빈 배열이다', () => {
    expect(candidacy('庚申', '丙戌', '甲申', '戊辰').supportStems).toEqual([]);
  });

  /**
   * 판정을 하지 않는다는 것이 이 층의 계약이다. 값이 늘어나도 결론을 내는
   * 필드가 생기면 안 된다.
   */
  it('판정하지 않는다 — 성립 여부나 격 이름을 내지 않는다', () => {
    const found = candidacy('庚申', '乙酉', '甲申', '丁丑');

    expect(found.status).toBe('facts-only');
    expect(Object.keys(found).sort()).toEqual([
      'dayMasterRootless',
      'dominant',
      'monthCommandsDominant',
      'opposingStems',
      'status',
      'supportRatio',
      'supportStems',
    ]);
    expect(FOLLOWING_PATTERN_POLICY.status).toBe('experimental');
    expect(FOLLOWING_PATTERN_POLICY.candidacy).toBe('facts-only-no-verdict');
    expect(FOLLOWING_PATTERN_POLICY.eokbuOverride).toBe('disabled');
  });
});

describe('종격 판정 — 실험 규칙 v2', () => {
  const assess = (year: string, month: string, day: string, hour: string | null) => {
    const parse = (name: string) => {
      const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
      if (!pillar) throw new Error(`간지가 아니다: ${name}`);
      return pillar;
    };
    const parsedDay = parse(day);
    const pillars = {
      year: parse(year),
      month: parse(month),
      day: parsedDay,
      hour: hour === null ? null : parse(hour),
      dayMaster: parsedDay.stem,
    };
    const rootedness = rootednessOf(pillars);
    const bureaus = bureausOf(pillars);
    const quality = rootQualityOf(rootedness, pillars, bureaus);

    // 판정은 국·합화를 반영한 실효 분포와 뿌리의 질 위에서 나온다.
    return followingAssessmentOf(
      pillars,
      effectiveElementsOf(pillars).distribution,
      rootedness,
      quality.dayMaster,
    );
  };

  /**
   * 축은 자당(비겁+인성) 몫 하나다. 종에는 방향이 둘이라 두 비율이 아니라 한
   * 축의 양끝으로 잰다 — 자당과 이당은 합이 1 이기 때문이다.
   */
  it('축은 자당 몫 하나이고 그것이 곧 supportRatio 다', () => {
    const found = assess('庚申', '乙酉', '甲申', '丁丑');
    expect(found.selfShare).toBeCloseTo(found.facts.supportRatio);

    // 자당이 바닥이면 밖으로, 천장이면 안으로 — 같은 축의 양끝이다.
    expect(assess('戊午', '己未', '癸未', '己未').direction).toBe('outward');
    expect(assess('丙寅', '甲午', '丙午', '癸巳').direction).toBe('inward');
  });

  it('두 문턱 사이에 있으면 방향이 없고 종격도 아니다', () => {
    // 일간 편도 이당도 압도하지 못하는 흔한 명식.
    const found = assess('丙子', '庚寅', '甲午', '丙寅');

    expect(found.selfShare).toBeGreaterThan(0.3);
    expect(found.selfShare).toBeLessThan(0.7);
    expect(found.direction).toBeNull();
    expect(found.verdict).toBe('not-following');
  });

  /**
   * 안으로 종(從强·從旺)은 조건이 거울처럼 뒤집힌다 — 일간이 뿌리가 **있어야**
   * 하고, 막아서는 것은 생부가 아니라 천간에 드러난 이당이다.
   */
  it('안으로 종은 조건이 뒤집힌다', () => {
    // 《적천수천미》 體用 의 從强 명례.
    const found = assess('丙寅', '甲午', '丙午', '癸巳');

    expect(found.direction).toBe('inward');
    expect(found.facts.dayMasterRootless).toBe(false);
    // 천간 癸水 하나가 이당으로 남아 진종이 아니라 가종 쪽이다.
    expect(found.facts.opposingStems.map((s) => s.stem)).toEqual(['癸']);
    expect(found.verdict).toBe('pseudo-following');
  });

  /**
   * 무근이고 투간한 생부가 없고 구조적 증거가 있어야 진종이다. 셋 중 하나만
   * 빠져도 아래로 내려간다 — 억지로 진종에 밀어 넣지 않는다.
   */
  it('무근·생부 없음·구조적 증거가 다 모이면 진종이다', () => {
    // 甲 일간에 木이 든 지지가 하나도 없고 천간에도 비겁·인성이 없다.
    const found = assess('己巳', '己丑', '甲申', '丙戌');

    expect(found.facts.dayMasterRootless).toBe(true);
    expect(found.facts.supportStems).toEqual([]);
    expect(found.structuralEvidence).toBe(true);
    expect(found.selfShare).toBeLessThanOrEqual(0.3);
    expect(found.verdict).toBe('true-following');
  });

  /**
   * 《적천수천미》 假從 편의 첫 명례 — 저자도 假從이라 못박은 자리다.
   *
   * 己土의 뿌리는 巳와 亥의 **여기(餘氣) 戊** 둘뿐이고, 그 둘은 서로 충하며
   * 목국에 조금씩 끌려간다. 개수로 세면 뿌리 둘이지만 남은 것은 0.12 다.
   */
  it('약한 뿌리가 남아 있으면 가종 쪽이다', () => {
    const found = assess('癸巳', '乙卯', '己亥', '癸酉');

    expect(found.facts.dayMasterRootless).toBe(false);
    expect(found.effectivelyRootless).toBe(false);
    expect(found.rootScore).toBeLessThanOrEqual(
      FOLLOWING_PATTERN_POLICY.classification.pseudoMaxRootScore,
    );
    expect(found.verdict).toBe('pseudo-following');
  });

  /**
   * **뿌리는 개수가 아니라 질로 잰다.**
   *
   * 같은 「뿌리 하나」라도 월지 정기에 걸린 것과 시지 고지의 여기에 걸린 것이
   * 같을 수 없다. v1 은 같은 글자 1 · 같은 오행 0.5 로만 갈라, 여기(餘氣)에
   * 걸린 뿌리 둘을 정기 둘과 같은 무게로 세었다 — 假從 명조가 문턱 밖으로
   * 밀려나던 것이 그 때문이다.
   */
  it('같은 개수의 뿌리라도 걸린 자리에 따라 무게가 다르다', () => {
    // 년지만 다르다. 未에는 중기 乙 하나(고지), 卯에는 여기 甲·정기 乙(왕지).
    const shallow = assess('己未', '丙寅', '甲申', '丙戌');
    const deep = assess('己卯', '丙寅', '甲申', '丙戌');

    const shallowYear = shallow.facts;
    const deepYear = deep.facts;
    expect(shallowYear.dayMasterRootless).toBe(false);
    expect(deepYear.dayMasterRootless).toBe(false);

    // 둘 다 월지 寅에 같은 뿌리를 두고 있으므로 차이는 년지에서만 온다.
    expect(deep.rootScore - shallow.rootScore).toBeGreaterThan(0.5);
  });

  /**
   * 무근은 **세어진 뿌리가 아니라 남은 뿌리**로 본다.
   *
   * 《적천수천미》가 「丙火之根已拔」이라 적은 명조 — 丙의 뿌리는 년지 寅의
   * 丙 하나뿐인데, 그 寅이 申 셋에게 충을 맞고 있다. 사실 층은 「통근함」이라
   * 세고 판정 층은 「남은 것이 없다」고 본다. 둘이 갈리는 자리다.
   */
  it('충을 맞은 뿌리는 세어지되 얕아진다', () => {
    // 丙의 뿌리는 년지 寅의 丙 하나뿐인데, 그 寅이 申 셋에게 충을 맞고 있다.
    const clashed = assess('戊寅', '庚申', '丙申', '丙申');
    // 충하는 申을 뺀 짝. 뿌리는 같은 자리에 같은 글자로 하나다.
    const intact = assess('戊寅', '己未', '丙申', '丙申');

    expect(clashed.facts.dayMasterRootless).toBe(false);
    expect(clashed.rootScore).toBeLessThan(intact.rootScore);
    expect(FOLLOWING_PATTERN_POLICY.rootless.by).toBe('root-quality-strength');
  });

  it('사실 층은 판정 아래에 그대로 남는다', () => {
    const found = assess('庚申', '乙酉', '甲申', '丁丑');

    expect(found.status).toBe('experimental');
    expect(found.facts.status).toBe('facts-only');
    expect(found.facts.dominant.role).toBe('官星');
  });
});
