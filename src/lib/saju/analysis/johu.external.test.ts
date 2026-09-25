import { describe, expect, it } from 'vitest';
import {
  HIDDEN_STEMS,
  pillarOf,
  STEM_INFO,
  type Branch,
  type Element,
  type Stem,
} from '../constants';
import { hourPillarOf } from '../pillars/hour';
import { monthPillarOf } from '../pillars/month';
import { eokbuJudgementOf } from './eokbuJudgement';
import { johuJudgementOf } from './johuJudgement';
import { needProfileOf } from './needProfile';
import { rootednessOf } from './rootedness';
import { JOHU_EXTERNAL_CASES, type JohuVerdict } from './validation/johuExternalCases';

/**
 * 조후 외부 대조 — **관찰만 한다.** 엔진 규칙을 이 자료에 맞추지 않는다(ADR 0111 「정한 것」 5).
 *
 * 세 저자의 서열 판단이 서로 다르다. 2026-09-25 CN-1 조사가 현대 중국 사례 열둘(`modern-chinese`)을
 * 더했다(`docs/notes/2026-09-25-research-cn-johu.md`) — 아래 잠긴 수가 44 건에서 56 건으로 바뀐 까닭이다.
 * 수는 「지금 엔진이 저자들의 말과 어디서 만나고 갈리는가」를
 * 고정해, 뒤에 급함 · 서열 규칙을 넣을 때 무엇이 움직였는지 보이게 하려는 것이다.
 */

type Case = (typeof JOHU_EXTERNAL_CASES)[number];

function chartOf(pillars: Case['pillars']) {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };
  const day = parse(pillars.day);
  return {
    year: parse(pillars.year),
    month: parse(pillars.month),
    day,
    hour: parse(pillars.hour),
    dayMaster: day.stem,
  };
}

/** 서열을 말한 사례 — 진단만 한 것은 뺀다 */
const RANKED: readonly JohuVerdict[] = [
  'johu-first',
  'johu-auxiliary',
  'johu-declined',
  'not-invoked',
];

/**
 * 청목서원 「용신해법」 5(5)의 셈 — **한 계통(현대 한국)의 체크리스트를 시험 안에서만** 옮긴다.
 * 엔진 규칙이 아니다. 원문은 「추운 글자」를 두 목록으로 적어(추운: 壬癸亥子 · 차가운: 庚辛己申酉丑辰)
 * 지지 셋 · 넷을 셀 때 어느 쪽인지 갈린다 — 두 읽기를 다 잰다.
 *
 * ① 亥子丑寅월이고 지지 셋 이상이 추운 글자 → 木火 용신
 * ② 巳午未申월이고 지지 셋 이상이 더운 글자 → 金水 용신
 * 둘 다 아니면: 지지에 셋 이상 · 여덟 글자에 다섯 이상이면 火 / 水 용신
 * (丑辰월 습 · 戌未월 조 규칙은 이 표본에서 丑월만 걸리고 결론이 ①과 같아 따로 세지 않는다.)
 */
const COLD_MONTHS: readonly Branch[] = ['亥', '子', '丑', '寅'];
const HOT_MONTHS: readonly Branch[] = ['巳', '午', '未', '申'];
const CHEONGMOK = {
  strict: {
    cold: new Set<string>(['壬', '癸', '亥', '子']),
    hot: new Set<string>(['丙', '丁', '巳', '午']),
  },
  broad: {
    cold: new Set<string>(['壬', '癸', '亥', '子', '庚', '辛', '己', '申', '酉', '丑', '辰']),
    hot: new Set<string>(['丙', '丁', '巳', '午', '甲', '乙', '戊', '寅', '卯', '戌', '未']),
  },
} as const;

function cheongmokJohuOf(
  pillars: Case['pillars'],
  reading: keyof typeof CHEONGMOK,
): 'cold' | 'hot' | null {
  const { cold, hot } = CHEONGMOK[reading];
  const all = [pillars.year, pillars.month, pillars.day, pillars.hour];
  const branches = all.map((p) => p[1]);
  const glyphs = all.flatMap((p) => [p[0], p[1]]);
  const month = pillars.month[1] as Branch;
  const count = (set: Set<string>, list: readonly string[]) =>
    list.filter((g) => set.has(g)).length;

  if (COLD_MONTHS.includes(month) && count(cold, branches) >= 3) return 'cold';
  if (HOT_MONTHS.includes(month) && count(hot, branches) >= 3) return 'hot';
  if (count(cold, branches) >= 3 && count(cold, glyphs) >= 5) return 'cold';
  if (count(hot, branches) >= 3 && count(hot, glyphs) >= 5) return 'hot';
  return null;
}

/**
 * 저자가 적은 처방 오행이 원국 어디에 있는가 — **오행으로** 본다. 저자들은 寒金에 丙 · 丁을 섞어
 * 쓴다(아래 `remedyStemActive` 가 갈리는 까닭). 뿌리의 뜻은 `rootedness.ts`(같은 오행의 지장간)다.
 */
function remedySeatOf(
  testCase: Case,
): 'revealed-rooted' | 'revealed-unrooted' | 'hidden-only' | 'absent' | null {
  const remedy = testCase.claim.remedy;
  if (remedy === null) return null;
  const chart = chartOf(testCase.pillars);
  const revealed = rootednessOf(chart).stems.filter(
    (rooting) => rooting.element === remedy.element && rooting.position !== 'day',
  );
  if (revealed.some((rooting) => rooting.rooted)) return 'revealed-rooted';
  if (revealed.length > 0) return 'revealed-unrooted';
  const hidden = [chart.year, chart.month, chart.day, chart.hour].some((pillar) =>
    HIDDEN_STEMS[pillar.branch].some((h) => STEM_INFO[h.stem].element === remedy.element),
  );
  return hidden ? 'hidden-only' : 'absent';
}

function measure(testCase: Case) {
  const chart = chartOf(testCase.pillars);
  const johu = johuJudgementOf(chart);
  const eokbu = eokbuJudgementOf(chart);
  const profile = needProfileOf(chart);
  const active = johu.stems.filter((need) => need.active);
  const activeElements = new Set<Element>(active.map((need) => need.element));
  const remedy = testCase.claim.remedy;

  return {
    id: testCase.id,
    verdict: testCase.claim.verdict,
    season: johu.season.temperature,
    johuActive: active.map((need) => need.stem).join(''),
    /** 저자가 천간으로 말한 처방 중 하나라도 엔진 활성 글자에 있는가. 오행으로만 말했으면 `null` */
    remedyStemActive:
      remedy === null || remedy.stems === null
        ? null
        : remedy.stems.some((stem) => active.some((need) => need.stem === stem)),
    remedyElementActive: remedy === null ? null : activeElements.has(remedy.element),
    eokbuPrimary: eokbu.candidates[0].element,
    yongsin: testCase.claim.yongsinElement,
    eokbuMatchesYongsin:
      testCase.claim.yongsinElement === null
        ? null
        : eokbu.candidates[0].element === testCase.claim.yongsinElement,
    remedySeat: remedySeatOf(testCase),
    relation: profile.relation.kind,
    precedence: profile.relation.precedence,
  };
}

describe('조후 외부 대조 데이터셋', () => {
  it('계통이 다른 자료의 완전한 네 기둥만 싣고, 마흔일곱 건이 서열을 말한다', () => {
    expect(new Set(JOHU_EXTERNAL_CASES.map(({ id }) => id)).size).toBe(JOHU_EXTERNAL_CASES.length);
    expect(new Set(JOHU_EXTERNAL_CASES.map(({ lineage }) => lineage))).toEqual(
      new Set(['classical-chinese', 'republican-chinese', 'modern-chinese']),
    );
    for (const testCase of JOHU_EXTERNAL_CASES) {
      expect(() => chartOf(testCase.pillars), testCase.id).not.toThrow();
      expect(testCase.source.locator.length).toBeGreaterThan(0);
      // 처방을 천간으로 적었으면 그 천간들의 오행이 처방 오행과 같다
      const remedy = testCase.claim.remedy;
      if (remedy?.stems) {
        for (const stem of remedy.stems)
          expect(STEM_INFO[stem].element, testCase.id).toBe(remedy.element);
      }
    }

    const byVerdict = Object.fromEntries(
      (
        [
          'johu-first',
          'johu-auxiliary',
          'johu-declined',
          'climate-diagnosis',
          'not-invoked',
        ] as const
      ).map((verdict) => [
        verdict,
        JOHU_EXTERNAL_CASES.filter((c) => c.claim.verdict === verdict).length,
      ]),
    );
    expect(byVerdict).toEqual({
      'johu-first': 27,
      'johu-auxiliary': 8,
      'johu-declined': 8,
      'climate-diagnosis': 9,
      'not-invoked': 4,
    });
    // 서열을 말한 사례가 마흔일곱 — 진단 아홉은 서열 대조에서 뺀다
    // (현대 중국 열둘: 우선 7 · 물림 2 · 진단 2 · 강약만 1)
    expect(JOHU_EXTERNAL_CASES.filter((c) => RANKED.includes(c.claim.verdict))).toHaveLength(47);
    expect(JOHU_EXTERNAL_CASES.filter((c) => c.lineage === 'classical-chinese')).toHaveLength(27);
    expect(JOHU_EXTERNAL_CASES.filter((c) => c.lineage === 'republican-chinese')).toHaveLength(17);
    expect(JOHU_EXTERNAL_CASES.filter((c) => c.lineage === 'modern-chinese')).toHaveLength(12);
  });

  /** 월간은 연간에서, 시간은 일간에서 — 실재할 수 있는 명식만 싣는다 */
  it('네 기둥이 모두 오호둔 · 오자둔에 맞는다', () => {
    for (const testCase of JOHU_EXTERNAL_CASES) {
      const { year, month, day, hour } = testCase.pillars;
      const derivedMonth = monthPillarOf(year[0] as Stem, month[1] as Branch);
      const derivedHour = hourPillarOf(day[0] as Stem, hour[1] as Branch);
      expect(`${derivedMonth.stem}${derivedMonth.branch}`, testCase.id).toBe(month);
      expect(`${derivedHour.stem}${derivedHour.branch}`, testCase.id).toBe(hour);
    }
  });

  /**
   * 사례마다 한 줄: `엔진 활성 조후 글자 · 억부 1순위 오행 · 관계 · 처방 오행의 자리 · 처방 대조`.
   * 처방 대조는 `stem`(저자 천간이 활성 글자에 있다) · `element-only`(오행만 같다) · `-`(저자가
   * 천간을 안 적었거나 처방이 없다). 오행이 어긋난 사례는 없다(아래 시험).
   *
   * 월지 ×2 · 60:30:10(ADR 0114)에서 쉰여섯 중 일곱 줄이 바뀌었다 — 조후 글자와 처방 자리는 한 줄도 안
   * 움직였고, 억부 1순위가 바뀐 다섯 줄과 1순위는 같은데 관계만 달라진 두 줄(`dtsm-joseup-jeongmi` ·
   * `xy-sinyu-sinchuk`)이다. 옛 줄은 그 위에 적었다.
   */
  it('엔진의 조후 · 억부 · 관계를 사례마다 고정한다', () => {
    const lines = Object.fromEntries(
      JOHU_EXTERNAL_CASES.map((testCase) => {
        const row = measure(testCase);
        const match =
          row.remedyStemActive === null ? '-' : row.remedyStemActive ? 'stem' : 'element-only';
        return [
          row.id,
          `${row.johuActive || '-'} ${row.eokbuPrimary} ${row.relation} ${row.remedySeat ?? '-'} ${match}`,
        ];
      }),
    );

    expect(lines).toEqual({
      'dtsm-handan-gapsin': '丁甲丙 土 not-comparable revealed-rooted stem',
      'dtsm-handan-giyu': '丁甲丙 土 not-comparable revealed-unrooted stem',
      'dtsm-handan-jeongchuk': '壬庚 水 partial revealed-rooted stem',
      'dtsm-handan-gyemi': '壬癸庚 水 partial revealed-unrooted stem',
      'dtsm-joseup-byeongjin': '丙丁甲 火 partial revealed-unrooted stem',
      // ADR 0114 전: 丁甲丙 土 conflict revealed-rooted stem
      'dtsm-joseup-jeongmi': '丁甲丙 土 not-comparable revealed-rooted stem',
      'dtsm-joseup-gyemi': '癸庚丁 水 conflict revealed-unrooted stem',
      'dtsm-joseup-gyechuk': '癸庚丁 水 conflict revealed-rooted stem',
      'dtsm-gasin-byeongja': '壬丙 土 conflict revealed-unrooted stem',
      'dtsm-jindae-sinyu': '丁庚丙 土 not-comparable revealed-rooted stem',
      'dtsm-bucheo-gyemyo': '丙丁甲 火 partial revealed-unrooted stem',
      // ADR 0114 전: 丁丙 木 not-comparable revealed-rooted stem
      'dtsm-hajijang-byeongsin': '丁丙 土 not-comparable revealed-rooted stem',
      'dtsm-yeomyeong-jeongmi': '丙丁甲 土 not-comparable revealed-rooted stem',
      'dtsm-yeomyeong-jeongchuk': '丙丁甲 土 not-comparable revealed-unrooted stem',
      'dtsm-bangug-gapsin': '丙 水 conflict revealed-rooted stem',
      'dtsm-seongjeong-gichuk': '戊丙 金 conflict revealed-unrooted stem',
      'dtsm-seongjeong-gapja': '丁甲丙 土 not-comparable revealed-unrooted stem',
      'dtsm-seongjeong-jeongsa': '丙戊壬甲 土 conflict revealed-rooted element-only',
      // ADR 0114 전: 癸丙 水 conflict hidden-only -
      'dtsm-jilbyeong-jeonghae': '癸丙 火 partial hidden-only -',
      'dtsm-jilbyeong-gichuk': '丙戊壬甲 土 conflict revealed-unrooted stem',
      'dtsm-chulsin-jeonghae': '丁甲丙 土 not-comparable revealed-rooted stem',
      'dtsm-hajijang-sinchuk': '丙丁 火 same-direction - -',
      // ADR 0114 전: 丙甲戊 火 conflict revealed-rooted stem
      'dtsm-jaedeok-byeongin': '丙甲戊 土 partial revealed-rooted stem',
      'dtsm-jaedeok-byeongsul': '丙甲戊 火 conflict revealed-rooted stem',
      'dtsm-bunul-gyechuk': '丙丁 金 not-comparable - -',
      'dtsm-jilbyeong-imjin': '丙戊壬甲 土 conflict - -',
      'dtsm-jilbyeong-gichuk-2': '丙甲戊 木 conflict revealed-unrooted element-only',
      'qlmg-yuk-gyemi': '壬戊 木 conflict - -',
      'qlmg-jin-imja': '庚辛壬癸 水 partial - -',
      'qlmg-ma-eulyu': '丙甲戊 土 partial revealed-unrooted element-only',
      'qlmg-gaek-jeonghae': '丙丁甲 土 not-comparable revealed-unrooted stem',
      'qlmg-gonmyeong-gisa': '丙 水 not-comparable revealed-rooted element-only',
      'qlmg-byeongsul-eulmi': '壬庚 木 not-comparable absent -',
      // ADR 0114 전: 丁甲丙 火 partial revealed-rooted stem
      'qlmg-sinhae-gyeongja': '丁甲丙 土 not-comparable revealed-rooted stem',
      'qlmg-musul-muo': '壬庚癸 土 not-comparable absent -',
      'qlmg-muja-eulchuk': '丙壬戊己 木 conflict absent -',
      'qlmg-gabo-jeongchuk': '丙壬戊己 火 partial - -',
      'zpzq-gyeongin-muja': '丁庚丙 金 partial revealed-rooted stem',
      'zpzq-byeongja-sinchuk': '丙甲 土 partial revealed-unrooted stem',
      'zpzq-gapsin-byeongja': '丁甲丙 土 not-comparable revealed-unrooted stem',
      'zpzq-gyeongjin-imo': '癸庚丁 水 conflict revealed-rooted element-only',
      'zpzq-gapja-byeongja': '丙辛 土 not-comparable revealed-unrooted stem',
      'zpzq-gimi-eulhae': '庚辛戊丁 土 partial revealed-rooted element-only',
      // ADR 0114 전: 癸庚丁 木 not-comparable absent -
      'zpzq-musul-jeongsa': '癸庚丁 水 conflict absent -',
      // 현대 중국(CN-1)
      'zzx-sinhae-sinchuk': '丙甲戊 火 partial hidden-only -',
      'zzx-byeongo-gihae': '丁丙 土 conflict revealed-rooted -',
      // ADR 0114 전: 丙丁甲 金 conflict absent stem
      'xy-sinyu-sinchuk': '丙丁甲 金 not-comparable absent stem',
      'xy-jeongyu-gyechuk': '丙丁 土 not-comparable revealed-unrooted -',
      'xy-musul-muo': '壬甲丙 木 partial absent -',
      'zyh-gihae-jeongchuk': '甲庚 木 partial revealed-rooted -',
      'zyh-jeongmi-imja': '甲庚 木 partial - -',
      'zyh-jeongmi-sinhae': '丙戊 水 conflict revealed-rooted -',
      'sz-gyemi-jeongsa': '壬癸庚 水 partial revealed-unrooted stem',
      'sz-eulmyo-gimyo': '庚丙丁戊己 火 partial revealed-rooted stem',
      'sz-jeongsa-byeongo': '壬庚 水 partial revealed-rooted stem',
      'sz-imja-sinhae': '戊丙庚 土 partial revealed-rooted stem',
    });
  });

  it('엔진은 급함 · 서열을 하나도 정하지 않는다 — 저자의 말과 견줄 값이 아직 없다', () => {
    for (const testCase of JOHU_EXTERNAL_CASES) {
      const chart = chartOf(testCase.pillars);
      expect(johuJudgementOf(chart).urgency, testCase.id).toBe('unresolved');
      expect(needProfileOf(chart).relation.precedence, testCase.id).toBe('unresolved');
    }
  });

  /**
   * 사례는 한 건만 빼고 亥子丑 · 巳午未 달이고, 월지 계절표(`JOHU_SEASON_BY_MONTH`)는 그 사례들에서
   * 저자가 적은 한 · 열과 늘 같다. 그런데 같은 달의 `not-invoked` 넷은 조후를 말하지 않는다 —
   * **달만으로는 조후를 부를지 못 가른다.**
   *
   * 예외 하나(CN-1): 算準網이 卯월 甲木에 「寒气未除，先丙后庚」로 조후를 앞세운다. 엔진은 卯를
   * `mild` 로 둔다 — 謝咏 · 張永紅의 「春秋不用调候」 쪽이다. 두 현대 계통이 봄을 두고 갈린다.
   */
  it('월지 계절은 저자의 한 · 열과 같지만 조후를 부를지는 못 가른다', () => {
    const mild = JOHU_EXTERNAL_CASES.filter(
      (c) => johuJudgementOf(chartOf(c.pillars)).season.temperature === 'mild',
    ).map((c) => c.id);
    expect(mild).toEqual(['sz-eulmyo-gimyo']);
    for (const testCase of JOHU_EXTERNAL_CASES.filter((c) => !mild.includes(c.id))) {
      const season = johuJudgementOf(chartOf(testCase.pillars)).season.temperature;
      expect(['cold', 'hot'], testCase.id).toContain(season);
      const climate = testCase.claim.climate;
      if (climate !== null) expect(climate.startsWith(season), testCase.id).toBe(true);
    }
    expect(
      JOHU_EXTERNAL_CASES.filter((c) => c.claim.verdict === 'not-invoked').map(
        (c) => johuJudgementOf(chartOf(c.pillars)).season.temperature,
      ),
    ).toEqual(['cold', 'hot', 'cold', 'cold']);
  });

  /**
   * 조후표(窮通寶鑑)는 저자의 처방과 **오행으로는** 늘 만난다. 천간으로는 여섯이 갈린다 — 저자들은
   * 丁 · 壬을 쓴 자리에서 표는 丙 · 癸를 권한다(ADR 0111 「조후는 천간으로 말한다」의
   * 대가). 그리고 표는 서열과 무관하게 같은 글자를 권한다 — 저자가 조후를 물린 여섯에도 처방
   * 오행이 활성이다. **표만으로는 급함을 못 읽는다.**
   */
  it('조후표는 처방 오행을 늘 맞히지만 서열을 가르지 못한다', () => {
    const withRemedy = JOHU_EXTERNAL_CASES.map(measure).filter(
      (row) => row.remedyElementActive !== null,
    );
    expect(withRemedy).toHaveLength(49);
    // CN-1 에서 처음 갈렸다: 張永紅은 丑월 丁火에 「暖」을 처방하고, 표(丁丑)는 甲庚만 권한다 —
    // 저자는 丁이 기대는 寅木이 춥다는 까닭으로 불을 부르는데 표는 나무 자체를 준다.
    expect(
      withRemedy.filter((row) => row.remedyElementActive === false).map((row) => row.id),
    ).toEqual(['zyh-gihae-jeongchuk']);
    expect(withRemedy.filter((row) => row.remedyStemActive === false).map((row) => row.id)).toEqual(
      [
        'dtsm-seongjeong-jeongsa',
        'dtsm-jilbyeong-gichuk-2',
        'qlmg-ma-eulyu',
        'qlmg-gonmyeong-gisa',
        'zpzq-gyeongjin-imo',
        'zpzq-gimi-eulhae',
      ],
    );
    expect(
      withRemedy.filter((row) => row.verdict === 'johu-declined' && row.remedyElementActive),
    ).toHaveLength(8);
  });

  /**
   * 억부 1순위가 저자의 용신 오행과 같은 몫을 판정마다 센다. 조후를 앞세운 사례에서 가장 낮다 —
   * 조후가 억부를 이긴 자리라는 저자들의 말과 같은 쪽이다. 관계 종류는 판정을 가르지 못한다.
   */
  it('억부 1순위는 조후 우선 사례에서 저자의 용신과 가장 덜 만난다', () => {
    const rows = JOHU_EXTERNAL_CASES.map(measure);
    const tally = (verdict: JohuVerdict) => {
      const named = rows.filter(
        (row) => row.verdict === verdict && row.eokbuMatchesYongsin !== null,
      );
      return [named.filter((row) => row.eokbuMatchesYongsin).length, named.length];
    };
    expect(Object.fromEntries(RANKED.map((verdict) => [verdict, tally(verdict)]))).toEqual({
      // CN-1 전 5/18 · 1/3 이었다. 현대 중국 우선 넷 중 셋이 억부와 같은 오행이다 — 현대 저자들은
      // 조후와 억부가 겹치는 명식을 골라 싣는 경향이 있다(`docs/notes/2026-09-25-research-cn-johu.md` 3).
      // 월지 ×2 · 60:30:10(ADR 0114) 전 8/22 — `dtsm-jilbyeong-jeonghae` 의 억부 1순위가 水 → 火 로 옮겨
      // 저자의 용신(水)에서 멀어졌다.
      'johu-first': [7, 22],
      'johu-auxiliary': [3, 7],
      'johu-declined': [2, 4],
      'not-invoked': [2, 2],
    });

    const relations = (verdict: JohuVerdict) => {
      const counts: Record<string, number> = {};
      for (const row of rows.filter((r) => r.verdict === verdict)) {
        counts[row.relation] = (counts[row.relation] ?? 0) + 1;
      }
      return counts;
    };
    expect(Object.fromEntries(RANKED.map((verdict) => [verdict, relations(verdict)]))).toEqual({
      // ADR 0114 전: 우선 n-c 9 · partial 11 · conflict 7 / 보조 n-c 4 · conflict 3 · partial 1 /
      // 물림 n-c 2 · partial 3 · conflict 3. 위 행렬의 일곱 줄이 옮긴 몫이다.
      'johu-first': { 'not-comparable': 11, partial: 12, conflict: 4 },
      'johu-auxiliary': { 'not-comparable': 5, conflict: 3 },
      'johu-declined': { 'not-comparable': 1, partial: 3, conflict: 4 },
      'not-invoked': { conflict: 1, partial: 3 },
    });
  });

  /**
   * 처방 오행이 천간에 드러나 뿌리를 두었는가(문턱 없는 사실). CN-1 전에는 조후를 물린 여섯이 **하나도**
   * 뿌리 있게 드러나지 않았다 — 任鐵樵의 「寒甚而暖無氣」 · 「寒無根」, 徐樂吾의 「四柱無印」과 같다.
   * 거꾸로는 서지 않는다: 뿌리 없는 처방으로도 조후를 앞세운 사례가 여섯이다(대개 「필요하나
   * 채워지지 않았다」는 진단).
   *
   * CN-1 이 반례 하나를 더했다: 朱祖夏의 丙午 己亥 庚寅 丙戌 은 처방 火가 뿌리 있게 드러났는데 조후를
   * 물린다 — 불이 이미 넘쳐 「火上浇油」라서다. 물림의 까닭이 둘이다: **못 쓴다**(뿌리 없음 · 원국에
   * 없음, 7/8)와 **이미 넘친다**(1/8). 앞쪽만 「드러나 뿌리 둠」이 가른다.
   */
  it('조후를 물린 사례는 대개 뿌리 있게 드러난 처방이 없다 — 넘쳐서 물린 한 건만 예외다', () => {
    const rows = JOHU_EXTERNAL_CASES.map(measure);
    const seats = (verdict: JohuVerdict) => {
      const counts: Record<string, number> = {};
      for (const row of rows.filter((r) => r.verdict === verdict && r.remedySeat !== null)) {
        counts[row.remedySeat as string] = (counts[row.remedySeat as string] ?? 0) + 1;
      }
      return counts;
    };
    expect({
      first: seats('johu-first'),
      auxiliary: seats('johu-auxiliary'),
      declined: seats('johu-declined'),
    }).toEqual({
      first: {
        'revealed-rooted': 17,
        'revealed-unrooted': 6,
        'hidden-only': 2,
        absent: 2,
      },
      auxiliary: { 'revealed-rooted': 3, 'revealed-unrooted': 4, absent: 1 },
      declined: { 'revealed-rooted': 1, 'revealed-unrooted': 6, absent: 1 },
    });
    expect(
      rows
        .filter((r) => r.verdict === 'johu-declined' && r.remedySeat === 'revealed-rooted')
        .map((r) => r.id),
    ).toEqual(['zzx-byeongo-gihae']);
  });

  /**
   * 현대 한국 한 계통의 셈 체크리스트(청목서원)를 사례에 대 본다. 좁게 읽으면(壬癸亥子 · 丙丁巳午)
   * 거의 안 걸리고, 넓게 읽으면 조후를 말한 사례에 대부분 걸리지만 **조후를 물린 여덟에 여덟 다**
   * 걸린다 — 셈이 많을수록 극단이고, 극단은 任鐵樵에게 순세(順勢)의 자리다. 셈은 「조후를 말할
   * 명식인가」에 가깝고 「조후가 앞서는가」를 가르지 못한다.
   */
  it('셈 체크리스트는 조후를 부를 명식을 고르지만 서열은 못 가른다', () => {
    const fired = (reading: keyof typeof CHEONGMOK) =>
      Object.fromEntries(
        (
          [
            'johu-first',
            'johu-auxiliary',
            'johu-declined',
            'not-invoked',
            'climate-diagnosis',
          ] as const
        ).map((verdict) => [
          verdict,
          JOHU_EXTERNAL_CASES.filter(
            (c) => c.claim.verdict === verdict && cheongmokJohuOf(c.pillars, reading) !== null,
          ).length,
        ]),
      );
    expect(fired('strict')).toEqual({
      'johu-first': 3,
      'johu-auxiliary': 1,
      'johu-declined': 4,
      'not-invoked': 0,
      'climate-diagnosis': 0,
    });
    // CN-1 뒤: 물림 8/8 이 다 걸린다(넘쳐서 물린 朱祖夏 한 건까지). 강약만 넷은 여전히 0.
    expect(fired('broad')).toEqual({
      'johu-first': 21,
      'johu-auxiliary': 7,
      'johu-declined': 8,
      'not-invoked': 0,
      'climate-diagnosis': 7,
    });
    // 넓은 읽기는 寅 · 戌 · 未를 「따뜻한 글자」로 세어 겨울 명식 둘을 「덥다」로 뒤집는다
    expect(
      JOHU_EXTERNAL_CASES.filter(
        (c) =>
          c.claim.verdict === 'johu-first' &&
          cheongmokJohuOf(c.pillars, 'broad') === 'hot' &&
          johuJudgementOf(chartOf(c.pillars)).season.temperature === 'cold',
      ).map((c) => c.id),
    ).toEqual(['dtsm-joseup-jeongmi', 'zpzq-gyeongin-muja']);
  });
});
