import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { evidenceOf } from '@/src/lib/saju/evidence';
import { redactEvidence } from '@/src/lib/saju/evidence/redacted';
import {
  COMPARED_MATCH_INPUTS as MATCH_INPUTS,
  PILLAR_UNCERTAIN,
  WITHHELD_PATHS,
  shareEvidence,
  type MatchInput,
  type SharedEvidence,
} from '@/src/lib/saju/evidence/shared';

const VIEWED_AT = new Date('2026-08-25T13:00:00+09:00');

/**
 * 표본 둘 — **걸리는 자리가 있어야 잰다.**
 *
 * `A`·`B` 는 옛 시험의 짝이다. `C`·`D` 는 두 사람 사이 쟁합에 **원국 안 경쟁자**가 서고
 * 입춘 경계 경고가 붙는 짝이라, 제한형이 무엇을 빼는지가 실제로 갈린다.
 */
const A = computeSaju({ year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male' });
const B = computeSaju({ year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' });
const C = computeSaju({ year: 1988, month: 2, day: 4, hour: 23, minute: 30, second: 0, gender: 'male' });
const D = computeSaju({ year: 1994, month: 8, day: 9, hour: 7, minute: 0, second: 0, gender: 'female' });

const redactedOf = (a: typeof A, b: typeof A) => redactEvidence(evidenceOf({ a, b }, VIEWED_AT));
const shared = (input: MatchInput, a = C, b = D): SharedEvidence => shareEvidence(redactedOf(a, b), input)!;

/** JSON 이 실제로 드는 키 경로 전부 — 배열 칸은 `[]`, 사람 자리는 `*` 로 접는다 */
function pathsOf(value: unknown, prefix = ''): Set<string> {
  const out = new Set<string>();
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item, `${path}[]`);
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const [key, inner] of Object.entries(node)) {
        const segment = /^(a|b)$/.test(key) && /(charts|elementSupport|eokbuMatch|hourKnown)$/.test(path) ? '*' : key;
        const next = path === '' ? segment : `${path}.${segment}`;
        out.add(next);
        walk(inner, next);
      }
    }
  };
  walk(JSON.parse(JSON.stringify(value)), prefix);
  return out;
}

const underCharts = (paths: Set<string>) => [...paths].filter((path) => path.startsWith('charts.'));
const underCompat = (paths: Set<string>) => [...paths].filter((path) => path.startsWith('compatibility.'));

/** 제한형 명식에 설 수 있는 경로 — 여기 없는 것이 자료에 있으면 빨간불이다 */
const LIMITED_CHART = /^charts\.\*(\.(claims(\.(pillars|meta)(\.(presence|absence))?)?|pillars(\.(year|month|day|hour)(\.(index|stem|branch|name|ko))?|\.dayMaster|\.meta(\.hourKnown)?)?|meta(\.hourKnown)?))?$/;

const RELATION_KEYS =
  '(kind|tier|ko|name|scope|targetElement|full|participants(\\[\\]\\.(chartId|position|char))?|direction(\\.(from|to)(\\.(chartId|position|char))?)?|cycle(\\[\\]\\.(chartId|position|char))?|contested(\\[\\]\\.(over(\\.(chartId|position|char))?|rivals(\\[\\]\\.(chartId|position|char))?))?)';
const COMPAT_COMMON = [
  `relations(\\[\\]\\.${RELATION_KEYS})?`,
  `combinedFormations(\\[\\]\\.${RELATION_KEYS})?`,
  'elementSupport(\\.\\*(\\.(missing|supplied|stillMissing)(\\[\\])?)?)?',
  'tenGods(\\.(aSeesB|bSeesA))?',
  'hourKnown(\\.\\*)?',
  'warnings(\\[\\]\\.(kind|text))?',
  'claims(\\.(relations|combinedFormations|elementSupport|tenGods|hourKnown|warnings)(\\.(presence|absence))?)?',
];
const LIMITED_COMPAT = new RegExp(`^compatibility\\.(${COMPAT_COMMON.join('|')})$`);
const EXTENDED_COMPAT = new RegExp(
  `^compatibility\\.(${[
    ...COMPAT_COMMON,
    'elementSupport\\.\\*\\.weakest(\\.(element|partnerRatio))?',
    'eokbuMatch(\\.\\*(\\.(status|element|role|presentInPartner|partnerRatio|unresolved(\\[\\])?))?)?',
    'claims\\.eokbuMatch(\\.(presence|absence))?',
  ].join('|')})$`,
);
const EXTENDED_CHART_EXTRA =
  /^charts\.\*\.(claims\.analysis\.(elements|strength|eokbu)(\.(presence|absence))?|analysis(\.elements(\.(glyphCount|counts|ratios|strongest|weakest|missing)(\.[木火土金水]|\[\])?)?|\.strength(\.(verdict|ratio|metCount|criteria(\[\](\.(key|label|met))?)?))?|\.eokbu(\.(status|suggestedElement|role|confidence|presentInChart|unresolved(\[\])?))?)?)$/;

describe('인연 궁합 입력은 필드를 적어서 고른다', () => {
  it('제한형 — 명식은 여덟 글자와 시각 입력 여부만 든다', () => {
    const stray = underCharts(pathsOf(shared('limited-v1'))).filter((path) => !LIMITED_CHART.test(path));
    expect(stray).toEqual([]);
  });

  it('제한형 — 궁합은 사이 관계·글자 수 보완·십성·한계만 든다', () => {
    const stray = underCompat(pathsOf(shared('limited-v1'))).filter((path) => !LIMITED_COMPAT.test(path));
    expect(stray).toEqual([]);
  });

  it('확장형 — 더해지는 것은 신강신약·억부 후보·오행 세력과 그 보완뿐이다', () => {
    const paths = pathsOf(shared('extended-v1'));
    const strayChart = underCharts(paths).filter(
      (path) => !LIMITED_CHART.test(path) && !EXTENDED_CHART_EXTRA.test(path),
    );
    const strayCompat = underCompat(paths).filter((path) => !EXTENDED_COMPAT.test(path));

    expect(strayChart).toEqual([]);
    expect(strayCompat).toEqual([]);
  });

  /** 허용 목록만 보면 필드가 통째로 사라져도 초록이다 — 있어야 할 것을 거꾸로 잰다 */
  it('두 판 모두 설명에 쓰는 자리를 실제로 든다', () => {
    for (const input of MATCH_INPUTS) {
      const paths = pathsOf(shared(input));
      for (const required of [
        'charts.*.pillars.day.stem',
        'charts.*.pillars.dayMaster',
        'charts.*.meta.hourKnown',
        'compatibility.relations[].participants[].position',
        'compatibility.relations[].full',
        'compatibility.elementSupport.*.stillMissing',
        'compatibility.tenGods.aSeesB',
      ]) {
        expect(paths.has(required), `${input}/${required}`).toBe(true);
      }
    }

    const extended = pathsOf(shared('extended-v1'));
    for (const required of [
      'charts.*.analysis.strength.verdict',
      'charts.*.analysis.eokbu.role',
      'charts.*.analysis.elements.ratios',
      'compatibility.eokbuMatch.*.presentInPartner',
      'compatibility.elementSupport.*.weakest.partnerRatio',
    ]) {
      expect(extended.has(required), required).toBe(true);
    }
  });

  it('출생 입력·계산 옵션·경계 문장은 어느 판에도 없다', () => {
    for (const input of MATCH_INPUTS) {
      /* 계약의 `withheld` 는 뺀 자리의 **이름**을 든다 — 값이 실렸는지는 계약 밖에서 본다 */
      const text = JSON.stringify({ ...shared(input), contract: null });
      for (const banned of ['"gender"', 'lateNightRule', 'lateNightShiftApplied', 'sajuYear', 'monthTerm', 'nextTerm', '절입 시각', '조자시', '시지 경계']) {
        expect(text, `${input}/${banned}`).not.toContain(banned);
      }
    }
  });

  it('확장형도 개인 신살·격국·조후·운은 안 싣는다', () => {
    const analysis = (shared('extended-v1').charts.a as { analysis?: object }).analysis!;
    expect(Object.keys(analysis).sort()).toEqual(['elements', 'eokbu', 'strength']);
    expect(Object.keys(shared('extended-v1').charts.a).sort()).toEqual(['analysis', 'claims', 'meta', 'pillars']);
  });
});

describe('관계는 한 사실 그대로 간다', () => {
  it('참여자·완성·방향·순환이 원본과 같고 수가 늘거나 줄지 않는다', () => {
    const source = redactedOf(C, D).compatibility!;
    for (const input of MATCH_INPUTS) {
      const { relations, combinedFormations } = shared(input).compatibility;
      expect(relations).toHaveLength(source.relations.length);
      expect(combinedFormations).toHaveLength(source.combinedFormations.length);

      relations.forEach((relation, index) => {
        const original = source.relations[index];
        expect(relation.participants).toEqual(original.participants);
        expect([relation.full, relation.direction, relation.cycle]).toEqual([
          original.full,
          original.direction,
          original.cycle,
        ]);
      });
    }
  });

  /** 두 사람 글자가 함께 이룬 삼합은 참여자 셋을 든 **한** 관계다 */
  it('함께 이룬 세 글자 구조는 참여자 셋을 가진 하나로 남는다', () => {
    const a = computeSaju({ year: 1984, month: 1, day: 5, hour: 2, minute: 10, second: 0, gender: 'male' });
    const b = computeSaju({ year: 1986, month: 4, day: 5, hour: 15, minute: 10, second: 0, gender: 'female' });
    const { combinedFormations, relations } = shared('limited-v1', a, b).compatibility;
    const triple = combinedFormations.find((relation) => relation.full && relation.participants.length === 3);

    expect(triple).toBeDefined();
    expect(relations.filter((relation) => relation.ko === triple!.ko && relation.full)).toHaveLength(
      combinedFormations.filter((relation) => relation.ko === triple!.ko && relation.full).length,
    );
    expect(new Set(triple!.participants.map((p) => p.chartId)).size).toBe(2);
  });

  /**
   * **제한형의 쟁합** — 같은 원국의 경쟁자는 그 사람 원국 안 합이 있다는 뜻이라 뺀다.
   * 확장형은 그대로 둔다. 표본 짝에서 실제로 갈리는지부터 확인한다.
   */
  it('제한형은 원국 안 경쟁자를 빼고, 확장형은 남긴다', () => {
    const inner = (evidence: SharedEvidence) =>
      evidence.compatibility.relations.flatMap((relation) =>
        relation.contested.flatMap((contest) =>
          contest.rivals.filter((rival) => rival.chartId === contest.over.chartId),
        ),
      );

    expect(inner(shared('extended-v1')).length).toBeGreaterThan(0);
    expect(inner(shared('limited-v1'))).toEqual([]);

    /* 빈 쟁합 항목은 남기지 않는다 */
    for (const relation of shared('limited-v1').compatibility.relations) {
      for (const contest of relation.contested) expect(contest.rivals.length).toBeGreaterThan(0);
    }
  });
});

describe('한계와 계약', () => {
  it('명식 경고는 어느 경계인지 없이 한 문장으로 바뀐다', () => {
    const { limitations } = shared('limited-v1');
    const charts = limitations.filter((limitation) => limitation.where !== 'compatibility');

    expect(charts.length).toBeGreaterThan(0);
    for (const limitation of charts) expect(limitation.text).toBe(PILLAR_UNCERTAIN);
  });

  it('궁합 경고는 그대로 남는다 — 시각을 몰라 적게 보이는 것', () => {
    const hourless = computeSaju({ year: 1984, month: 7, day: 18, hour: null, gender: 'male' });
    const { limitations, compatibility } = shared('limited-v1', A, hourless);

    expect(compatibility.warnings.length).toBeGreaterThan(0);
    expect(limitations.filter((limitation) => limitation.where === 'compatibility')).toHaveLength(
      compatibility.warnings.length,
    );
  });

  it('무엇을 왜 뺐는지와 어느 판인지를 자료가 들고 나간다', () => {
    for (const input of MATCH_INPUTS) {
      const evidence = shared(input);
      expect(evidence.contract.withheld).toBe(WITHHELD_PATHS[input]);
      expect(evidence.contract.matchInput).toBe(input);
      expect(evidence.contract.scope).toBe('match-consent');
      // 앞선 컷도 그대로다 — 출생 원문은 여기서도 없다.
      expect(evidence.contract.redacted).toBe(redactedOf(C, D).contract.redacted);
    }
    expect(Object.keys(WITHHELD_PATHS['limited-v1'])).toContain('compatibility.eokbuMatch');
    expect(Object.keys(WITHHELD_PATHS['extended-v1'])).not.toContain('compatibility.eokbuMatch');
  });

  /** 운영 기본값은 제한형 A 다(2026-09-15). 옛 컷은 이름으로 부르면 한 글자도 안 바뀐 채 남는다 — 원복의 길이다 */
  it('기본값은 제한형 A 이고, 옛 컷은 이름으로 부르면 그대로다', () => {
    const pair = redactedOf(A, B);
    expect(shareEvidence(pair)!.contract.matchInput).toBe('limited-v1');
    const legacy = shareEvidence(pair, 'legacy-v0')!;

    expect(legacy.contract.matchInput).toBeUndefined();
    expect(legacy.compatibility).toEqual(pair.compatibility);
    expect(legacy.limitations).toEqual(pair.limitations);
    expect(Object.keys(legacy.charts.a).sort()).toEqual(['claims', 'meta', 'pillars']);
    expect(legacy.charts.a.pillars).toEqual(pair.charts.a.pillars);
    expect(legacy.contract.withheld).toBe(WITHHELD_PATHS['legacy-v0']);
    expect(Object.keys(WITHHELD_PATHS['legacy-v0']).sort()).toEqual(
      ['analysis', 'daeun', 'now', 'relations', 'sinsal', 'stages'],
    );
  });

  it('한 사람짜리 자료로는 공유 결과를 만들지 않는다', () => {
    expect(shareEvidence(redactEvidence(evidenceOf({ a: A }, VIEWED_AT)))).toBeNull();
  });
});
