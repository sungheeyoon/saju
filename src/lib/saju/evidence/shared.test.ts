import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { evidenceOf } from '@/src/lib/saju/evidence';
import { redactEvidence } from '@/src/lib/saju/evidence/redacted';
import {
  COMPARED_MATCH_INPUTS,
  MATCH_INPUTS,
  MATCH_INPUT_FIELDS,
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

/**
 * 셋째 짝 — **두 사람 글자가 함께 삼합을 이룬다.**
 *
 * 표를 잠그는 데 짝 하나로는 모자란다. `C`·`D` 는 `combinedFormations` 가 비어서, 표가
 * 「싣는다」고 적은 줄이 **빈 배열인지 안 싣는 것인지** 갈리지 않는다. 빈 자리를 근거로
 * 표의 줄을 지우면 자료가 조용히 좁아진다.
 */
const E = computeSaju({ year: 1984, month: 1, day: 5, hour: 2, minute: 10, second: 0, gender: 'male' });
/** 시각 미상 — 시주가 `null` 인 자료가 무엇을 드는지도 함께 잠근다 */
const HOURLESS = computeSaju({ year: 1988, month: 7, day: 15, hour: null, gender: 'female' });
const F = computeSaju({ year: 1986, month: 4, day: 5, hour: 15, minute: 10, second: 0, gender: 'female' });

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

/**
 * 표를 맞대는 **자료의 자리 전부** — 짝 셋을 합쳐 본다.
 *
 * 짝 하나로는 모자란다. `C`·`D` 는 `combinedFormations` 가 비어 있고, 시각을 아는 짝만
 * 보면 시주가 `null` 인 자료가 어떤 자리를 드는지 안 본 채로 표를 잠그게 된다.
 *
 * `contract` 는 뺀다. 거기 실리는 것은 컷이 **무엇을 했는지**이지 자료의 필드가 아니다 —
 * 넣으면 `contract.withheld.…` 가 「자료에 실린 자리」로 세어져, 뺐다고 적은 것이 실린
 * 것으로 읽힌다.
 */
const SAMPLE_PAIRS: readonly (readonly [typeof A, typeof A])[] = [
  [C, D],
  [E, F],
  [A, HOURLESS],
];

const fieldPathsOf = (input: MatchInput): Set<string> =>
  new Set(SAMPLE_PAIRS.flatMap(([a, b]) => [...pathsOf({ ...shared(input, a, b), contract: undefined })]));

/**
 * 표의 키를 경로로 편다 — **표기법은 `MATCH_INPUT_FIELDS` 의 주석이 적은 그대로다.**
 *
 * `{a,b}` 는 갈래, ` · ` 는 한 줄에 적은 여러 경로, 끝의 `.**` 는 **그 아래를 통째로
 * 연다**는 표시다. 여기가 표기를 읽는 유일한 자리라, 표에 없는 문법을 쓰면 갈래가 안
 * 닫혔다고 멈춘다 — 조용히 통과해서 「아무것도 안 덮는 줄」이 되는 것보다 낫다.
 */
function expandBraces(key: string): string[] {
  const open = key.indexOf('{');
  if (open === -1) return [key];

  const parts: string[] = [];
  let depth = 0;
  let start = open + 1;
  let close = -1;

  for (let i = open; i < key.length; i += 1) {
    const char = key[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        parts.push(key.slice(start, i));
        close = i;
        break;
      }
    } else if (char === ',' && depth === 1) {
      parts.push(key.slice(start, i));
      start = i + 1;
    }
  }

  if (close === -1) throw new Error(`갈래가 안 닫혔다: ${key}`);
  const [head, tail] = [key.slice(0, open), key.slice(close + 1)];
  return parts.flatMap((part) => expandBraces(`${head}${part}${tail}`));
}

/** 표의 한 줄이 가리키는 자리 — `open` 이면 그 아래를 통째로 연다 */
type Field = { path: string; open: boolean };

const OPEN_MARK = '.**';

const fieldsOf = (key: string): Field[] =>
  key
    .split(' · ')
    .flatMap(expandBraces)
    .map((path) =>
      path.endsWith(OPEN_MARK)
        ? { path: path.slice(0, -OPEN_MARK.length), open: true }
        : { path, open: false },
    );

const fieldsIn = (table: Readonly<Record<string, string>>): Field[] =>
  Object.keys(table).flatMap(fieldsOf);

/** `path` 가 `ancestor` 의 **밑**인가 */
const isUnder = (path: string, ancestor: string): boolean =>
  path.startsWith(`${ancestor}.`) || path.startsWith(`${ancestor}[`);

/**
 * 표가 안 덮는 자리 — **잎은 적힌 것만, 컨테이너는 내려가는 길로만.**
 *
 * 세 갈래로 통과한다. ① 표에 그대로 적힌 자리, ② `.**` 로 **열어 둔** 자리의 아래,
 * ③ 적힌 잎으로 **내려가는 길**(컨테이너). ③ 이 그 자리에 새로 생긴 형제까지 통과시키지
 * 않는 것이 요점이다 — `charts.*.pillars.year` 가 길이라고 해서 그 밑에 엔진이 얹은 새
 * 필드가 열리지는 않는다.
 */
const strayIn = (paths: Iterable<string>, fields: readonly Field[]): string[] =>
  [...paths].filter(
    (path) =>
      !fields.some(
        (field) =>
          field.path === path ||
          (field.open && isUnder(path, field.path)) ||
          isUnder(field.path, path),
      ),
  );

/**
 * 표가 적었는데 **담을 칸조차 없는** 자리 — 설명하는 척만 하는 줄을 잡는다.
 *
 * 자리가 자료에 그대로 서면 통과다. 안 서더라도 **그 자리를 담을 칸이 비어 있으면**
 * 통과한다 — `cycle` 이 `null` 이거나 `contested` 가 `[]` 인 짝만 모였을 때가 그렇고,
 * 그것은 표가 틀린 것이 아니라 표본이 그 자리를 안 채운 것이다.
 *
 * 비어 있다는 것은 **자료 어디에서도 그 아래로 내려간 적이 없다**는 뜻으로 읽는다. 그래서
 * `compatibility.bogus.x` 같은 가짜 줄은 통과하지 못한다 — 가장 가까운 조상이
 * `compatibility` 이고 그 밑은 비어 있지 않다.
 */
const phantomIn = (paths: Set<string>, fields: readonly Field[]): string[] => {
  const all = [...paths];
  const stands = (field: Field) =>
    paths.has(field.path) || (field.open && all.some((path) => isUnder(path, field.path)));

  const holderIsEmpty = (field: Field) => {
    const ancestors = all.filter((path) => isUnder(field.path, path));
    if (ancestors.length === 0) return false;
    const nearest = ancestors.reduce((longest, path) => (path.length > longest.length ? path : longest));
    return !all.some((path) => isUnder(path, nearest));
  };

  return fields.filter((field) => !stands(field) && !holderIsEmpty(field)).map((field) => field.path);
};

/**
 * `WITHHELD_PATHS` 에서 **부재를 기계로 못 재는 키** — 이름과 왜 못 재는지.
 *
 * 둘뿐이고, 둘 다 다른 시험이 값으로 잰다. 여기 없는 키는 전부 경로로 읽혀 자료에서
 * 사라졌는지 확인된다 — 새로 못 재는 키가 생기면 이 표에 적어야 초록이 뜬다.
 */
const WITHHELD_NOT_MEASURED: Record<string, string> = {
  'limited-v1/compatibility.relations[].contested[].rivals (같은 원국)':
    '경로가 아니라 「같은 원국의 경쟁자」라는 조건이다 — 아래 쟁합 시험이 그 경쟁자를 세어 잰다',
  'extended-v1/analysis':
    '「`analysis` **밖의** 판정」이라는 뜻이라 이 경로 자체는 실린다 — 무엇이 실렸는지는 필드 표가 잰다',
};

/** 베낀 자료에 새 필드를 얹을 때 쓰는 얕은 모양 — 실제 타입은 판마다 다르다 */
type Node = Record<string, unknown>;
type Participant = Node;
type StampedRelation = {
  participants: Participant[];
  direction: { from: Node; to: Node } | null;
  contested: { over: Node; rivals: Node[] }[];
};
type StampedChart = {
  pillars: { year: Node };
  claims: { pillars: Node };
  analysis?: { eokbu: Node };
};
type Stamped = {
  charts: { a: StampedChart };
  compatibility: Node & {
    relations: StampedRelation[];
    tenGods: Node;
    elementSupport: { a: Node };
  };
  limitations: Node[];
};

describe('인연 궁합 입력은 필드를 적어서 고른다', () => {
  /**
   * **표가 안 덮는 자리가 자료에 있으면 빨간불이다.**
   *
   * 전에는 이 자리를 시험이 손으로 쓴 정규식 셋이 쟀다. 그러면 「무엇이 실리나」가 표와
   * 정규식 두 곳에 적히고, 엔진에 필드가 느는 날 따라오는 것은 한쪽뿐이다. 이제 표가
   * 잠근다 — 자료가 넓어지면 **표를 고치기 전에는 초록이 안 뜬다.**
   */
  it.each(MATCH_INPUTS)('%s — 자료의 모든 자리를 표가 덮는다', (input) => {
    expect(strayIn(fieldPathsOf(input), fieldsIn(MATCH_INPUT_FIELDS[input]))).toEqual([]);
  });

  /**
   * 반대 방향 — **표가 적은 자리는 자료가 담을 수 있는 자리다.**
   *
   * 덮는 쪽만 보면 필드가 통째로 사라져도 초록이다. 표가 「싣는다」고 적은 자리를 담을
   * 칸조차 없으면 그 줄은 동의 범위를 설명하는 척만 하는 것이고, 프롬프트가 그 경로를
   * 가리킨다.
   */
  it.each(MATCH_INPUTS)('%s — 표가 적은 자리는 자료에 담긴다', (input) => {
    expect(phantomIn(fieldPathsOf(input), fieldsIn(MATCH_INPUT_FIELDS[input]))).toEqual([]);
  });

  /**
   * **뺐다고 적은 자리는 실제로 없다** — `WITHHELD_PATHS` 의 방향.
   *
   * 이 표는 계약에 실려 **모델까지 간다.** 자료와 다른 말을 적으면 모델이 없는 것을
   * 찾거나 있는 것을 못 본 척한다 — ADR 0067 이 고친 것이 정확히 그 어긋남이었고,
   * 그때까지 이 표를 재던 시험은 「같은 객체인가」뿐이었다.
   *
   * 키는 명식 기준이다(`analysis` = `charts.*.analysis`). `compatibility.` 로 시작하는
   * 것만 자료의 뿌리에서 읽는다.
   */
  it.each(MATCH_INPUTS)('%s — 뺐다고 적은 자리는 자료에 없다', (input) => {
    const paths = [...fieldPathsOf(input)];
    const present = Object.keys(WITHHELD_PATHS[input])
      .filter((key) => !(`${input}/${key}` in WITHHELD_NOT_MEASURED))
      .flatMap(fieldsOf)
      .map(({ path }) => (path.startsWith('compatibility.') ? path : `charts.*.${path}`))
      .filter((field) => paths.some((path) => path === field || isUnder(path, field)));

    expect(present).toEqual([]);
  });

  /** 안 재는 것은 값으로 남긴다 — 사라진 키를 적어 두면 여기서 걸린다 */
  it('경로가 아닌 `withheld` 키는 이름과 이유로 적혀 있다', () => {
    for (const key of Object.keys(WITHHELD_NOT_MEASURED)) {
      const [input, path] = [key.slice(0, key.indexOf('/')), key.slice(key.indexOf('/') + 1)];
      expect(Object.keys(WITHHELD_PATHS[input as MatchInput]), key).toContain(path);
    }
  });

  /**
   * **엔진이 중첩 객체에 필드를 하나 얹는 날** — 표를 한 줄도 안 고쳤는데 그것이 모델까지
   * 가는가.
   *
   * 이 시험이 처음 판에는 없었고, 그래서 처음 판은 **이 회귀를 놓아 줬다.** 표에 적힌
   * 경로가 자기 밑을 다 덮게 두었더니 `pillars.year` 나 관계 참여자 아래에 새 필드가
   * 생겨도 초록이었다 — 옛 정규식은 잎을 늘어놓아 그것을 잡고 있었다.
   *
   * 자료를 베껴 실제로 한 자리에 `hidden` 을 얹고, 그 경로가 걸리는지 본다.
   */
  const stamped = (input: MatchInput, at: (evidence: Stamped) => Node | undefined): string[] => {
    const clone = JSON.parse(JSON.stringify({ ...shared(input), contract: undefined })) as Stamped;
    const target = at(clone);
    expect(target, '얹을 자리를 못 찾았다').toBeDefined();
    target!.hidden = 1;
    return strayIn(pathsOf(clone), fieldsIn(MATCH_INPUT_FIELDS[input]));
  };

  const withDirection = (evidence: Stamped) =>
    evidence.compatibility.relations.find((relation) => relation.direction !== null)?.direction ?? undefined;
  const withContest = (evidence: Stamped) =>
    evidence.compatibility.relations.find((relation) => relation.contested.length > 0)?.contested[0];

  it.each([
    ['기둥', 'limited-v1', (e: Stamped) => e.charts.a.pillars.year, 'charts.*.pillars.year.hidden'],
    ['상한', 'limited-v1', (e: Stamped) => e.charts.a.claims.pillars, 'charts.*.claims.pillars.hidden'],
    ['관계 참여자', 'limited-v1', (e: Stamped) => e.compatibility.relations[0]?.participants[0], 'compatibility.relations[].participants[].hidden'],
    ['관계 방향', 'limited-v1', (e: Stamped) => withDirection(e)?.from, 'compatibility.relations[].direction.from.hidden'],
    ['쟁합', 'extended-v1', (e: Stamped) => withContest(e)?.over, 'compatibility.relations[].contested[].over.hidden'],
    ['쟁합 경쟁자', 'extended-v1', (e: Stamped) => withContest(e)?.rivals[0], 'compatibility.relations[].contested[].rivals[].hidden'],
    ['십성', 'limited-v1', (e: Stamped) => e.compatibility.tenGods, 'compatibility.tenGods.hidden'],
    ['오행 보완', 'limited-v1', (e: Stamped) => e.compatibility.elementSupport.a, 'compatibility.elementSupport.*.hidden'],
    ['한계', 'limited-v1', (e: Stamped) => e.limitations[0], 'limitations[].hidden'],
    ['억부 후보', 'extended-v1', (e: Stamped) => e.charts.a.analysis?.eokbu, 'charts.*.analysis.eokbu.hidden'],
  ] as const)('%s 아래에 새 필드가 생기면 걸린다', (_label, input, at, expected) => {
    expect(stamped(input, at as (evidence: Stamped) => Node | undefined)).toEqual([expected]);
  });

  /**
   * **열어 둔 자리는 열려 있다** — 그리고 그것은 `.**` 를 적은 판에서만이다.
   *
   * 옛 컷은 `compatibility` 를 통째로 싣는 것이 정의라 새 필드가 따라 들어가는 것까지가
   * 그 판의 뜻이다. 같은 자리를 제한형에 얹으면 걸린다 — 여는 것과 안 적은 것이 구별된다.
   */
  it('통째로 연 자리(`.**`)는 새 필드를 받고, 안 연 판에서는 걸린다', () => {
    expect(stamped('legacy-v0', (e) => e.compatibility)).toEqual([]);
    expect(stamped('limited-v1', (e) => e.compatibility)).toEqual(['compatibility.hidden']);
  });

  /** 허용 목록만 보면 필드가 통째로 사라져도 초록이다 — 있어야 할 것을 거꾸로 잰다 */
  it('두 판 모두 설명에 쓰는 자리를 실제로 든다', () => {
    for (const input of COMPARED_MATCH_INPUTS) {
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
    for (const input of COMPARED_MATCH_INPUTS) {
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
    for (const input of COMPARED_MATCH_INPUTS) {
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
    const { combinedFormations, relations } = shared('limited-v1', E, F).compatibility;
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
    for (const input of COMPARED_MATCH_INPUTS) {
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
