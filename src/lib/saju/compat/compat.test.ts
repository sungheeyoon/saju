import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { tenGodOf } from '@/src/lib/saju/analysis';
import {
  COMPAT_CHART_ID,
  COMPAT_POLICY,
  analyzeCompatibility,
  compatSideOf,
  findCompatRelations,
} from '@/src/lib/saju/compat';
import { pillarOf, type Branch, type Stem } from '@/src/lib/saju/constants';
import { resolveRelation, type Participant, type Relation } from '@/src/lib/saju/relations';
import { findCompatUtterances } from '@/src/lib/saju/text';

function chart(year: string, month: string, day: string, hour: string | null) {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };

  return {
    year: parse(year),
    month: parse(month),
    day: parse(day),
    hour: hour === null ? null : parse(hour),
  };
}

const kosOf = (relations: readonly { ko: string }[]) => relations.map((r) => r.ko);

describe('두 원국 사이의 관계', () => {
  /**
   * 궁합의 몫은 **사이**에 성립하는 것뿐이다. 각자의 원국 안에서 닫힌 관계는
   * 각자의 원국 카드가 이미 보여줬으므로 여기서 또 세면 같은 사실이 두 번 읽힌다.
   */
  it('각자의 원국 안에서 닫힌 관계는 빼고 사이 것만 낸다', () => {
    // A 안에 자오충(년지 子 · 일지 午)이 이미 있다. 그것은 궁합이 아니다.
    const a = chart('丙子', '丁酉', '甲午', '乙丑');
    const b = chart('壬申', '癸卯', '己巳', '甲戌');

    const relations = findCompatRelations(a, b);

    expect(kosOf(relations)).not.toContain('자오충');
    expect(relations.every((relation) => relation.scope !== 'withinChart')).toBe(true);
  });

  it('두 사람의 글자가 짝지으면 누구의 어느 자리인지 함께 낸다', () => {
    // A 일지 午 ↔ B 일지 子 — 자오충. 양쪽에 子·午가 하나씩만 있게 골랐다.
    const relations = findCompatRelations(
      chart('壬申', '丙寅', '庚午', '丁丑'),
      chart('壬申', '丙寅', '庚子', '丁丑'),
    );
    const clash = relations.find((relation) => relation.ko === '자오충');

    expect(clash?.scope).toBe('betweenCharts');
    expect(clash?.participants).toEqual([
      { chartId: COMPAT_CHART_ID.a, position: 'day', char: '午' },
      { chartId: COMPAT_CHART_ID.b, position: 'day', char: '子' },
    ]);
  });

  /**
   * 두 사람의 기둥 사이에는 선형 거리라는 것이 없다. 0 이나 큰 수로 채우면 없는
   * 사실을 지어내는 것이라 `null` 이고, 화면은 거리 대신 자리로 말해야 한다.
   */
  it('계산판이 다르므로 거리와 인접은 언제나 null 이다', () => {
    const relations = findCompatRelations(
      chart('壬申', '丙寅', '庚午', '丁丑'),
      chart('壬申', '丙寅', '庚子', '丁丑'),
    );

    expect(relations.length).toBeGreaterThan(0);
    for (const relation of relations) {
      expect(relation.distance, relation.ko).toBeNull();
      expect(relation.adjacent, relation.ko).toBeNull();
    }
  });

  /**
   * 두 사람의 글자가 합쳐 세 글자 구조를 이루는 것은 쌍 관계와 무게가 다르고,
   * 인정할지 자체가 계통 선택이라 따로 모아 둔다.
   */
  it('두 사람의 글자가 합쳐 이룬 삼합은 따로 표시된다', () => {
    // A 가 申子, B 가 辰 — 셋이 모여야 申子辰 수국이 된다.
    const relations = findCompatRelations(
      chart('壬申', '丙寅', '庚子', '丙寅'),
      chart('甲辰', '丙寅', '甲寅', '丙寅'),
    );
    const combined = relations.find((relation) => relation.ko.includes('수국'));

    expect(combined?.scope).toBe('combinedFormation');
    expect(combined?.full).toBe(true);
    // 두 사람의 글자가 함께 들어가야 '합쳐서 이룸' 이다.
    expect(new Set(combined?.participants.map((participant) => participant.chartId)).size).toBe(2);
  });
});

describe('궁합 결과의 계약', () => {
  /** 실제 입력으로 사주 한 벌 — 시각을 주지 않으면 시간 미상이다 */
  const computeSajuOf = (year: number, month: number, day: number, hour: number | null) =>
    computeSaju(
      hour === null
        ? { year, month, day, hour: null, gender: 'female' }
        : { year, month, day, hour, minute: 0, second: 0, gender: 'female' },
    );

  it('합쳐서 이룬 것은 전체 목록에서 골라낸 것이지 따로 센 것이 아니다', () => {
    const compat = analyzeCompatibility(
      computeSajuOf(1990, 5, 15, 14),
      computeSajuOf(1992, 8, 20, 9),
    );

    for (const formation of compat.combinedFormations) {
      expect(compat.relations).toContain(formation);
      expect(formation.scope).toBe('combinedFormation');
    }
  });

  it('시간 미상이면 관계가 덜 나온다는 사실을 경고로 남긴다', () => {
    const known = computeSajuOf(1990, 5, 15, 14);
    const unknown = computeSajuOf(1988, 7, 15, null);

    expect(analyzeCompatibility(known, known).warnings).toEqual([]);
    expect(analyzeCompatibility(known, unknown).warnings[0].text).toContain('두 번째 사람');
    expect(analyzeCompatibility(unknown, known).warnings[0].text).toContain('첫 번째 사람');
    expect(analyzeCompatibility(unknown, unknown).warnings[0].text).toContain('두 사람 모두');
  });

  /**
   * 종류를 값으로 드는 이유는 **걸러 쓰는 곳이 생겼기** 때문이다. 화면이 L3 발화를
   * 함께 놓으면서 같은 말이 두 번 나오게 됐는데, 문장으로 걸러내면 새 경고가 생겼을
   * 때 조용히 지워지거나 조용히 두 번 나온다.
   */
  it('경고마다 종류가 붙는다', () => {
    const known = computeSajuOf(1990, 5, 15, 14);
    const unknown = computeSajuOf(1988, 7, 15, null);

    expect(analyzeCompatibility(known, unknown).warnings.map((w) => w.kind)).toEqual([
      'hour-unknown-relations',
      'hour-unknown-elements',
    ]);
  });

  /**
   * 甲이 본 辛은 정관이지만 辛이 본 甲은 정재다. 한 방향만 내면 누구 눈으로 본
   * 것인지 잃어버리므로 양쪽을 다 내고, 두 값이 실제로 다르다는 것을 못박는다.
   */
  it('십성은 양방향을 모두 내고 서로 다를 수 있다', () => {
    // 1990-05-15 일간 庚 · 1992-08-20 일간 己 (엔진이 뽑은 값)
    const a = computeSajuOf(1990, 5, 15, 14);
    const b = computeSajuOf(1992, 8, 20, 9);
    const compat = analyzeCompatibility(a, b);

    expect(compat.tenGods.aSeesB).toBe(tenGodOf(a.pillars.dayMaster, b.pillars.dayMaster));
    expect(compat.tenGods.bSeesA).toBe(tenGodOf(b.pillars.dayMaster, a.pillars.dayMaster));
    // 뒤집어 넣으면 값도 뒤집힌다 — 방향이 붙어 있다는 뜻이다.
    expect(analyzeCompatibility(b, a).tenGods.aSeesB).toBe(compat.tenGods.bSeesA);
  });

  it('오행 보완은 있고 없음만 세고 점수로 환산하지 않는다', () => {
    const a = computeSajuOf(1990, 5, 15, 14);
    const b = computeSajuOf(1992, 8, 20, 9);
    const { elementSupport } = analyzeCompatibility(a, b);

    for (const [side, mine, partner] of [
      ['a', a, b],
      ['b', b, a],
    ] as const) {
      const support = elementSupport[side];

      expect(support.missing).toEqual(mine.analysis.elements.missing);
      // 채워지는 것과 못 채우는 것이 합치면 없는 오행 전체다 — 빠뜨리는 칸이 없다.
      expect([...support.supplied, ...support.stillMissing].sort()).toEqual(
        [...support.missing].sort(),
      );
      for (const element of support.supplied) {
        expect(partner.analysis.elements.counts[element]).toBeGreaterThan(0);
      }
      for (const element of support.stillMissing) {
        expect(partner.analysis.elements.counts[element]).toBe(0);
      }
      expect(support.weakest.element).toBe(mine.analysis.elements.weakest);
      expect(support.weakest.partnerRatio).toBe(
        partner.analysis.elements.ratios[mine.analysis.elements.weakest],
      );
    }
  });

  /**
   * 궁합으로 넘어오면서 시험값 딱지가 떨어지면 근거 없는 확신이 결론으로 샌다.
   * 억부가 아직 못 본 것들까지 그대로 물려받는지 본다.
   */
  it('억부 부합은 각자의 억부 판정을 딱지째 물려받는다', () => {
    const a = computeSajuOf(1990, 5, 15, 14);
    const b = computeSajuOf(1992, 8, 20, 9);
    const { eokbuMatch } = analyzeCompatibility(a, b);

    expect(eokbuMatch.a.status).toBe('experimental');
    expect(eokbuMatch.a.element).toBe(a.analysis.eokbu.suggestedElement);
    expect(eokbuMatch.a.role).toBe(a.analysis.eokbu.role);
    expect(eokbuMatch.a.unresolved).toEqual(a.analysis.eokbu.unresolved);
    expect(eokbuMatch.a.unresolved.length).toBeGreaterThan(0);

    // 상대에게 그 오행이 있는지는 상대 원국에서 센다.
    expect(eokbuMatch.a.presentInPartner).toBe(
      b.analysis.elements.counts[a.analysis.eokbu.suggestedElement] > 0,
    );
    expect(eokbuMatch.b.element).toBe(b.analysis.eokbu.suggestedElement);
  });

  it('시간 미상이면 없는 오행이 부풀 수 있다는 것도 함께 경고한다', () => {
    const known = computeSajuOf(1990, 5, 15, 14);
    const unknown = computeSajuOf(1988, 7, 15, null);
    const { warnings } = analyzeCompatibility(known, unknown);

    expect(warnings).toHaveLength(2);
    expect(warnings[1].text).toContain('없는 오행');
  });

  /**
   * **「없다」와 「못 셌다」는 값만 보아서 구별되지 않는다.**
   *
   * 이 결과에서 없다고 말하는 자리가 넷인데(`missing`·`stillMissing`·
   * `presentInPartner: false`·관계 목록의 전체성) 여섯 글자로 세었으면 넷 다
   * 「못 셌다」다. 여태 그 사정은 `warnings` 의 **문장 안에만** 있었다 — 화면은
   * 사람이 읽으니 충분했지만, 값을 그대로 받는 쪽은 문장을 파싱해야 뜻을 알게 된다.
   */
  it('시각을 알았는가를 값으로 든다', () => {
    const known = computeSajuOf(1990, 5, 15, 14);
    const unknown = computeSajuOf(1988, 7, 15, null);

    expect(analyzeCompatibility(known, unknown).hourKnown).toEqual({ a: true, b: false });
    expect(analyzeCompatibility(unknown, known).hourKnown).toEqual({ a: false, b: true });
    expect(analyzeCompatibility(known, known).hourKnown).toEqual({ a: true, b: true });
  });

  /** 값과 문장이 같은 사정을 말해야 한다 — 갈리면 어느 쪽이 맞는지 알 수 없다 */
  it('경고는 값이 말하는 것과 같은 사정만 든다', () => {
    for (const pair of [
      [1990, 5, 15, 14, 1988, 7, 15, null],
      [1988, 7, 15, null, 1990, 5, 15, 14],
      [1988, 7, 15, null, 1991, 3, 2, null],
      [1990, 5, 15, 14, 1991, 3, 2, 9],
    ] as const) {
      const compat = analyzeCompatibility(
        computeSajuOf(pair[0], pair[1], pair[2], pair[3]),
        computeSajuOf(pair[4], pair[5], pair[6], pair[7]),
      );
      const allKnown = compat.hourKnown.a && compat.hourKnown.b;

      expect(compat.warnings.length === 0).toBe(allKnown);
    }
  });

  /**
   * L3 가 이 값을 읽는다. 전에는 호출부가 손으로 넘겼고(`CompatPerson.hourKnown`)
   * 다른 명식의 값을 적어도 아무것도 걸리지 않았다 — 걸렸다면 문장이 엉뚱한
   * 사람의 시주를 빠졌다고 부르는 모양이었다.
   */
  it('궁합 문장이 이름 말고 더 받을 것이 없다', () => {
    const compat = analyzeCompatibility(
      computeSajuOf(1990, 5, 15, 14),
      computeSajuOf(1988, 7, 15, null),
    );

    const said = findCompatUtterances(compat, { a: { label: '가온' }, b: { label: '나린' } });
    const coverage = said.find((request) => request.topic === 'relation.coverage');

    // 시주가 빠진 쪽만 부른다 — 이름은 호출부가 주고, 누구인지는 궁합이 안다.
    expect(coverage?.slots.who).toBe('나린');
    expect(coverage?.slots.who).not.toContain('가온');
  });

  it('두 사람을 서로 다른 이름으로 가리킨다', () => {
    expect(COMPAT_CHART_ID.a).not.toBe(COMPAT_CHART_ID.b);
    expect(compatSideOf(COMPAT_CHART_ID.a)).toBe('a');
    expect(compatSideOf(COMPAT_CHART_ID.b)).toBe('b');
    // 원국 하나짜리 계산의 이름과도 달라야 한다.
    expect(compatSideOf('natal')).toBeNull();
  });

  it('채택한 규칙 묶음을 결과 곁에 남긴다', () => {
    expect(COMPAT_POLICY).toEqual({
      ruleSet: 'compat-facts-v1',
      scoring: 'not-scored',
      combinedFormation: 'included-and-marked',
      detection: 'shared-with-natal-relations',
      elementSupport: 'facts-only',
      tenGods: 'both-directions',
      eokbu: 'inherits-experimental',
      spouseSeat: 'display-only',
    });
  });
});

/**
 * A·B 를 **맞바꿔 넣어도 같은 사실이 나오는가.**
 *
 * 궁합은 두 사람을 받는데 누가 먼저인지는 사실이 아니다 — 폼에 먼저 적은 쪽일
 * 뿐이다. 그런데 이 엔진 안에서 그 순서는 여러 곳에 남는다. `chartId` 가 갈리고,
 * 관계의 참여자 배열이 넣은 순서로 담기고, `direction`·`cycle` 이 그 배열의
 * 인덱스다. 어느 하나라도 순서를 사실인 척 들고 나가면 같은 두 사람이 폼을 어떻게
 * 채웠는가에 따라 다른 답을 받는다.
 *
 * 화면만 볼 때는 드러나지 않던 자리다. 화면은 인덱스를 읽지 않고 이름을 붙여
 * 보여주므로 뒤집혀도 뒤집힌 대로 맞게 읽힌다. **밖으로 내보내는 순간 달라진다** —
 * 받는 쪽은 배열이 어떤 순서로 담겼는지 알 도리가 없다.
 *
 * 그래서 여기서 두 가지를 함께 잠근다. 뒤집혀야 하는 것이 정확히 뒤집히는가,
 * 그리고 **뒤집히지 않는 것이 무엇인가**(`resolveRelation` 이 있는 이유다).
 */
describe('A 와 B 를 맞바꿔 넣으면', () => {
  const one = computeSaju({
    year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male',
  });
  const other = computeSaju({
    year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female',
  });

  const ab = analyzeCompatibility(one, other);
  const ba = analyzeCompatibility(other, one);

  const MIRRORED: Record<string, string> = {
    [COMPAT_CHART_ID.a]: COMPAT_CHART_ID.b,
    [COMPAT_CHART_ID.b]: COMPAT_CHART_ID.a,
  };

  /** 계산판 이름만 맞바꾼다 — 맞바꿔 넣었으면 이것 말고 달라질 것이 없어야 한다 */
  const mirror = (relation: Relation): Relation => ({
    ...relation,
    participants: relation.participants.map(
      (participant): Participant => ({
        ...participant,
        chartId: MIRRORED[participant.chartId] ?? participant.chartId,
      }),
    ),
  });

  const idsOf = (relations: readonly Relation[]) =>
    relations.map((relation) => resolveRelation(relation).id).sort();

  const tokenOf = (participant: Participant) =>
    `${participant.chartId}/${participant.position}/${participant.char}`;

  it('두 원국 사이의 관계는 계산판 이름만 맞바뀐다', () => {
    expect(ba.relations).not.toHaveLength(0);
    expect(idsOf(ba.relations.map(mirror))).toEqual(idsOf(ab.relations));
  });

  it('합쳐서 이룬 것도 그대로 맞바뀐다', () => {
    expect(idsOf(ba.combinedFormations.map(mirror))).toEqual(idsOf(ab.combinedFormations));
  });

  it('십성은 보는 쪽이 바뀌므로 양방향이 서로 자리를 바꾼다', () => {
    expect(ba.tenGods.aSeesB).toBe(ab.tenGods.bSeesA);
    expect(ba.tenGods.bSeesA).toBe(ab.tenGods.aSeesB);
  });

  it('오행 보완은 사람마다 한 벌이므로 통째로 자리를 바꾼다', () => {
    expect(ba.elementSupport.a).toEqual(ab.elementSupport.b);
    expect(ba.elementSupport.b).toEqual(ab.elementSupport.a);
  });

  it('억부 부합도 딱지째 자리를 바꾼다', () => {
    expect(ba.eokbuMatch.a).toEqual(ab.eokbuMatch.b);
    expect(ba.eokbuMatch.b).toEqual(ab.eokbuMatch.a);
  });

  /** 경고는 사람을 순서로 부른다 — 순서가 바뀌면 부르는 이름도 바뀌어야 한다 */
  it('시각을 알았는가도 자리를 바꾼다', () => {
    const unknown = computeSaju({ year: 1988, month: 7, day: 15, hour: null, gender: 'female' });

    expect(analyzeCompatibility(one, unknown).hourKnown).toEqual({ a: true, b: false });
    expect(analyzeCompatibility(unknown, one).hourKnown).toEqual({ a: false, b: true });
  });

  it('경고가 가리키는 사람도 바뀐다', () => {
    const unknown = computeSaju({ year: 1988, month: 7, day: 15, hour: null, gender: 'female' });

    const [known, unknownFirst] = [
      analyzeCompatibility(one, unknown),
      analyzeCompatibility(unknown, one),
    ];

    expect(known.warnings.map((w) => w.kind)).toEqual(unknownFirst.warnings.map((w) => w.kind));
    expect(known.warnings[0].text).toContain('두 번째 사람');
    expect(unknownFirst.warnings[0].text).toContain('첫 번째 사람');
  });

  /**
   * 형의 방향은 **사실이다.** 戌이 未를 형한다는 것은 누구를 먼저 적었는지와
   * 무관하다. 글자로 읽으면 그 사실이 그대로 남아야 한다.
   */
  it('형의 방향은 글자로 읽으면 같은 사실이다', () => {
    const arrowsOf = (relations: readonly Relation[]) =>
      relations
        .map(resolveRelation)
        .flatMap((relation) =>
          relation.direction
            ? [`${tokenOf(relation.direction.from)}→${tokenOf(relation.direction.to)}`]
            : [],
        )
        .sort();

    expect(arrowsOf(ab.relations)).not.toHaveLength(0);
    expect(arrowsOf(ba.relations.map(mirror))).toEqual(arrowsOf(ab.relations));
  });

  it('완전 삼형이 도는 순서도 같은 사실이다', () => {
    const cyclesOf = (relations: readonly Relation[]) =>
      relations
        .map(resolveRelation)
        .flatMap((relation) => (relation.cycle ? [relation.cycle.map(tokenOf).join('→')] : []))
        .sort();

    expect(cyclesOf(ab.relations)).not.toHaveLength(0);
    expect(cyclesOf(ba.relations.map(mirror))).toEqual(cyclesOf(ab.relations));
  });

  /**
   * **여기가 이 묶음의 요점이다.**
   *
   * 위 두 시험이 통과하는 것은 `resolveRelation` 이 인덱스를 풀어 주기 때문이지
   * 인덱스 자체가 대칭이어서가 아니다. 날것 그대로는 같은 형이 한 배치에서
   * `0→1`, 맞바꾼 배치에서 `1→0` 이다 — 사실은 그대로인데 숫자만 뒤집힌다.
   *
   * 이 줄이 빨개지면 인덱스가 대칭이 됐다는 뜻이고, 그때는 `resolveRelation` 이
   * 왜 있는지부터 다시 읽어야 한다. 지우기 전에 확인할 것: 관계 참여자를 넣은
   * 순서가 아니라 **정해진 순서**로 담게 됐는가.
   */
  it('그러나 direction 인덱스는 배치에 딸린 값이다', () => {
    const indicesOf = (relations: readonly Relation[]) =>
      relations
        .flatMap((relation) =>
          relation.direction ? [`${relation.ko}:${relation.direction.from}→${relation.direction.to}`] : [],
        )
        .sort();

    expect(indicesOf(ab.relations)).not.toHaveLength(0);
    expect(indicesOf(ba.relations)).not.toEqual(indicesOf(ab.relations));
  });
});
