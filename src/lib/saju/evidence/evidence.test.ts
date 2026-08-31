import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { analyzeCompatibility, type Compatibility } from '@/src/lib/saju/compat';
import { GOLDEN_CASES } from '@/src/lib/saju/golden/cases';
import {
  EVIDENCE_CONTRACT,
  EVIDENCE_DECIMALS,
  EXCLUDED_PATHS,
  INCLUDED_PATHS,
  evidenceOf,
  type ChartEvidence,
  type Evidence,
  type IncludedPath,
} from '@/src/lib/saju/evidence';
import {
  CLAIM_CEILING,
  CLAIM_PATHS,
  COMPAT_CLAIM_PATHS,
  HOUR_SENSITIVE_PATHS,
} from '@/src/lib/saju/text';

const KNOWN = computeSaju({
  year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male',
});
const OTHER = computeSaju({
  year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female',
});
const HOURLESS = computeSaju({ year: 1988, month: 7, day: 15, hour: null, gender: 'female' });

/** '지금' — 고정한다. 자료가 이 시각을 들고 나가는지까지 시험한다 */
const VIEWED_AT = new Date('2026-08-22T13:00:00+09:00');

/** 이 근거가 자료 안에 있는가 — `analysis.x` 는 `analysis` 밑을 본다 */
const carries = (chart: ChartEvidence, path: IncludedPath): boolean => {
  const [head, tail] = path.split('.');
  const target = tail
    ? (chart.analysis as unknown as Record<string, unknown>)
    : (chart as unknown as Record<string, unknown>);

  return Object.hasOwn(target, tail ?? head);
};

/** 자료를 통째로 훑는다 — 깊은 곳에 남은 것을 잡는 시험들이 쓴다 */
function* walk(value: unknown): Generator<unknown> {
  yield value;

  if (Array.isArray(value)) {
    for (const item of value) yield* walk(item);
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) yield* walk(inner);
  }
}

/**
 * 관계인가 — **`participants` 만으로는 못 가른다.** 암합(`HiddenCombination`)도
 * 참여자를 들고 다니고, 그쪽은 방향이라는 것이 없어 풀 것도 없다.
 */
const isRelation = (node: unknown): node is Record<string, unknown> =>
  node !== null &&
  typeof node === 'object' &&
  Object.hasOwn(node, 'participants') &&
  Object.hasOwn(node, 'direction');

describe('넘길 자료', () => {
  describe('빠짐없이 싣는다', () => {
    /**
     * **이 시험이 T5 의 요점이다.** L2 에 새 지표가 생기면 화면에는 안 붙어도
     * 티가 안 나고(고지가 좁아지는 것으로 잡는다) 자료에서 빠지면 **아무 데도
     * 티가 안 난다** — 받는 쪽은 그 지표가 있는 줄을 모른다.
     */
    it('모든 근거가 실리거나 이유와 함께 빠진다', () => {
      const chart = evidenceOf({ a: KNOWN }, VIEWED_AT).charts.a;

      for (const path of INCLUDED_PATHS) {
        expect(carries(chart, path), `${path} 이 자료에 없다`).toBe(true);
      }

      // 반대 방향 — 뺀다고 적어 놓고 실은 것도 걸린다.
      for (const path of Object.keys(EXCLUDED_PATHS)) {
        expect(CLAIM_PATHS as readonly string[], path).toContain(path);
        expect(carries(chart, path as IncludedPath), `${path} 은 뺀다고 적혀 있다`).toBe(false);
      }

      // 뺀 이유를 안 적은 것도 걸린다 — 빈 문자열은 안 적은 것이다.
      for (const reason of Object.values(EXCLUDED_PATHS)) {
        expect(reason.length).toBeGreaterThan(0);
      }
    });

    /** 자료가 근거 아닌 것을 싣고 있으면 그 값의 강도를 아무도 모른다 */
    it('근거 이름이 아닌 칸은 계약이 아는 것뿐이다', () => {
      const chart = evidenceOf({ a: KNOWN }, VIEWED_AT).charts.a;
      const paths = new Set<string>(CLAIM_PATHS);

      for (const key of Object.keys(chart)) {
        if (key === 'claims' || key === 'analysis') continue;
        expect(paths.has(key), `자료의 ${key} 이 근거 이름이 아니다`).toBe(true);
      }

      for (const key of Object.keys(chart.analysis)) {
        expect(paths.has(`analysis.${key}`), `자료의 analysis.${key} 이 근거 이름이 아니다`).toBe(
          true,
        );
      }
    });

    it('궁합 결과도 빠짐없이 실린다', () => {
      const compat = evidenceOf({ a: KNOWN, b: OTHER }, VIEWED_AT).compatibility!;
      const engine: Compatibility = analyzeCompatibility(KNOWN, OTHER);

      for (const key of Object.keys(engine)) {
        expect(Object.hasOwn(compat, key), `Compatibility.${key} 이 자료에 없다`).toBe(true);
        expect(Object.hasOwn(compat.claims, key), `${key} 의 상한이 없다`).toBe(true);
      }

      for (const key of Object.keys(COMPAT_CLAIM_PATHS)) {
        expect(Object.hasOwn(compat, key), `${key} 이 가리키는 값이 자료에 없다`).toBe(true);
      }
    });

    /**
     * **한동안 거꾸로 실었다.** `now` 를 빼고 대운·세운·월운 표를 통째로 실었는데,
     * 해석에 쓰이는 것은 열 해가 아니라 지금 도는 한 해다. 표만 받은 쪽은 어느 칸이
     * 지금인지 스스로 짚어야 하고, 그것은 우리가 안 하기로 한 판정을 떠넘기는 것이다.
     */
    it('운은 표가 아니라 지금 도는 칸으로 실린다', () => {
      const chart = evidenceOf({ a: KNOWN }, VIEWED_AT).charts.a;

      expect(chart.now.saeun.pillar.name).toBeTruthy();
      expect(chart.now.wolun.pillar.name).toBeTruthy();
      expect(chart.now.daeun?.pillar.name).toBeTruthy();

      // 표는 실리지 않는다 — 안 싣는다고 적어 둔 자리다.
      expect(Object.hasOwn(chart, 'saeun')).toBe(false);
      expect(Object.hasOwn(chart, 'wolun')).toBe(false);
    });

    /**
     * 대운만 반쪽이 남는다. 대운수·방향·그 방향을 정한 근거·거리를 잰 절기는
     * **칸이 아니라 이 사람에 대한 사실**이라 표가 빠져도 그대로다.
     */
    it('대운은 표만 빠지고 대운수와 방향은 남는다', () => {
      const daeun = evidenceOf({ a: KNOWN }, VIEWED_AT).charts.a.daeun;

      expect(Object.hasOwn(daeun, 'entries')).toBe(false);
      expect(daeun.startAge).toBe(KNOWN.daeun.startAge);
      expect(daeun.direction).toBe(KNOWN.daeun.direction);
      expect(daeun.directionReason).toBe(KNOWN.daeun.directionReason);
      expect(daeun.boundaryTerm.name).toBe(KNOWN.daeun.boundaryTerm.name);
    });

    /**
     * 자료가 **스스로 날짜를 든다.** 「지금은 네 번째 대운」은 언제 기준인지 없이는
     * 하루 뒤에 틀린 말이 된다 — 그것이 한동안 `now` 를 뺀 이유였고, 답은 빼는 것이
     * 아니라 기준을 함께 싣는 것이었다.
     */
    it('지금이 언제인지를 자료가 든다', () => {
      const evidence = evidenceOf({ a: KNOWN, b: OTHER }, VIEWED_AT);

      expect(evidence.viewedAt).toBe(VIEWED_AT.toISOString());
      expect(evidence.charts.a.now.viewedAt).toBe(VIEWED_AT.toISOString());
      expect(evidence.charts.b!.now.viewedAt).toBe(VIEWED_AT.toISOString());
    });

    it('시각이 다르면 지금 도는 칸도 다르다', () => {
      const now = evidenceOf({ a: KNOWN }, VIEWED_AT).charts.a.now;
      const later = evidenceOf({ a: KNOWN }, new Date('2036-08-22T13:00:00+09:00')).charts.a.now;

      expect(later.sajuYear).toBe(now.sajuYear + 10);
      expect(later.age).toBe(now.age + 10);
      expect(later.saeun.pillar.name).not.toBe(now.saeun.pillar.name);
    });

    it('한 사람이면 궁합이 없다고 말한다 — 칸을 빼지 않는다', () => {
      const evidence = evidenceOf({ a: KNOWN }, VIEWED_AT);

      expect(evidence.charts.b).toBeNull();
      expect(evidence.compatibility).toBeNull();
      // 키가 아예 없으면 「한 사람짜리」와 「빠뜨렸다」가 구별되지 않는다.
      expect(Object.hasOwn(evidence.charts, 'b')).toBe(true);
      expect(Object.hasOwn(evidence, 'compatibility')).toBe(true);
    });
  });

  describe('강도는 손으로 적히지 않는다', () => {
    /**
     * 자료가 `"strength": "fact"` 를 항목마다 박으면 화면과 이 자료가 같은 값을
     * 다른 강도로 말하게 된다. 표 하나가 계약에서 유도되고 항목은 이름으로 선다.
     */
    it('상한이 계약과 한 글자도 다르지 않다', () => {
      const claims = evidenceOf({ a: KNOWN }, VIEWED_AT).charts.a.claims;

      for (const path of INCLUDED_PATHS) {
        expect(claims[path].presence, path).toBe(CLAIM_CEILING[path]);
      }
    });

    it('시각을 모르면 흔들리는 근거만 내려간다', () => {
      const known = evidenceOf({ a: KNOWN }, VIEWED_AT).charts.a.claims;
      const hourless = evidenceOf({ a: HOURLESS }, VIEWED_AT).charts.a.claims;

      const moved = INCLUDED_PATHS.filter(
        (path) => hourless[path].presence !== known[path].presence,
      );

      expect(moved.length).toBeGreaterThan(0);
      for (const path of moved) {
        expect(HOUR_SENSITIVE_PATHS, `${path} 이 흔들린다고 적힌 적이 없다`).toContain(path);
      }
    });

    /**
     * 「없다」와 「있다」의 상한이 다르다. 한 방향만 실으면 받는 쪽이
     * 「金이 없습니다」를 「金이 있습니다」와 같은 세기로 쓴다.
     */
    it('없다는 주장은 시각을 모르면 잠긴다', () => {
      const hourless = evidenceOf({ a: HOURLESS }, VIEWED_AT).charts.a.claims;

      expect(hourless['analysis.elements'].presence).not.toBe('silent');
      expect(hourless['analysis.elements'].absence).toBe('silent');

      /**
       * 흔들리지 않는 근거는 두 방향이 같다 — **조후가 그 자리다.** 일간과 월지만
       * 보므로 시주가 아무것도 바꾸지 않는다.
       *
       * 한동안 이 줄이 `pillars` 를 들고 있었는데, 전수 감사에서 여덟 글자도
       * 목록이라는 것이 드러났다(`completeness.test.ts`) — 시주 두 글자가 없으면
       * 「이 명식에 그 글자가 없다」를 말할 수 없다. 「있다」는 그대로 `fact` 이고
       * 「없다」만 잠긴다.
       */
      expect(hourless['analysis.johu'].absence).toBe(hourless['analysis.johu'].presence);
      expect(hourless.pillars.presence).toBe('fact');
      expect(hourless.pillars.absence).toBe('silent');
    });

    it('궁합 상한은 두 사람 중 모르는 쪽이 있으면 함께 내려간다', () => {
      const both = evidenceOf({ a: KNOWN, b: OTHER }, VIEWED_AT).compatibility!.claims;
      const half = evidenceOf({ a: KNOWN, b: HOURLESS }, VIEWED_AT).compatibility!.claims;

      expect(both.elementSupport.absence).not.toBe('silent');
      expect(half.elementSupport.absence).toBe('silent');
    });
  });

  describe('넘어간 뒤에도 같은 자료다', () => {
    const evidence = evidenceOf({ a: KNOWN, b: HOURLESS }, VIEWED_AT);

    it('JSON 을 건너도 달라지지 않는다', () => {
      expect(JSON.parse(JSON.stringify(evidence))).toEqual(evidence);
    });

    /**
     * `Date` 는 JSON 이 되면 어차피 문자열이 된다. 남겨 두면 타입은 `Date` 라고
     * 적혀 있는데 받는 쪽에는 문자열이 도착한다 — 넘어간 뒤의 모양이 아무 데도
     * 안 적힌 자료가 된다.
     */
    it('Date 가 한 자리도 안 남았다', () => {
      for (const node of walk(evidence)) {
        expect(node).not.toBeInstanceOf(Date);
      }
    });

    it('시각은 ISO 문자열로 실린다', () => {
      expect(evidence.charts.a.meta.instant).toBe(KNOWN.meta.instant.toISOString());
      expect(evidence.charts.a.daeun.boundaryTerm.date).toBe(
        KNOWN.daeun.boundaryTerm.date.toISOString(),
      );
    });
  });

  describe('인덱스를 남기지 않는다', () => {
    const evidence = evidenceOf({ a: KNOWN, b: OTHER }, VIEWED_AT);

    /**
     * 원국 관계만 푸는 것으로는 모자란다 — 대운·세운·월운 칸이 저마다
     * `relations` 를 들고 있고 그것도 인덱스다. 깊이 훑어서 잡는다.
     */
    it('자료 어디에도 인덱스로 적힌 방향이 없다', () => {
      let seen = 0;

      for (const node of walk(evidence)) {
        if (!isRelation(node)) continue;
        seen += 1;

        // 풀린 꼴에만 있는 칸이다 — 날것이 섞여 있으면 여기서 걸린다.
        expect(node, `${String(node.ko)} 이 풀리지 않은 채로 실렸다`).toHaveProperty('id');

        if (node.direction !== null) {
          expect(node.direction, `${String(node.ko)} 의 방향이 글자가 아니다`).toHaveProperty(
            'from.char',
          );
        }
        if (node.cycle !== null) {
          expect((node.cycle as unknown[])[0], `${String(node.ko)} 의 순환이 글자가 아니다`)
            .toHaveProperty('char');
        }
      }

      expect(seen).toBeGreaterThan(0);
    });

    it('지금 도는 칸이 든 관계도 풀렸다', () => {
      const { now } = evidence.charts.a;
      const relations = [
        ...(now.daeun?.relations ?? []),
        ...now.saeun.relations,
        ...now.wolun.relations,
        ...now.relations,
      ];

      expect(relations.length).toBeGreaterThan(0);
      for (const relation of relations) {
        expect(relation).toHaveProperty('id');
      }
    });
  });

  /**
   * A·B 를 맞바꿔 넣어도 같은 자료여야 한다. 엔진 쪽은 이미 잠갔지만
   * (`compat.test.ts`) 자료를 만드는 길이 따로 있으므로 여기서도 본다 —
   * 두 길이 갈리면 화면은 대칭인데 넘긴 자료만 안 대칭인 모양이 된다.
   */
  it('A 와 B 를 맞바꿔도 같은 자료다', () => {
    const ab = evidenceOf({ a: KNOWN, b: HOURLESS }, VIEWED_AT);
    const ba = evidenceOf({ a: HOURLESS, b: KNOWN }, VIEWED_AT);

    expect(ba.charts.a).toEqual(ab.charts.b);
    expect(ba.charts.b).toEqual(ab.charts.a);

    expect(ba.compatibility!.hourKnown).toEqual({ a: false, b: true });
    expect(ab.compatibility!.hourKnown).toEqual({ a: true, b: false });
    expect(ba.compatibility!.claims).toEqual(ab.compatibility!.claims);

    const ids = (evidence: Evidence) =>
      evidence.compatibility!.relations.map((relation) => relation.ko).sort();
    expect(ids(ba)).toEqual(ids(ab));
  });

  it('좁게 읽어야 하는 사정이 어느 자리의 것인지 든다', () => {
    const limitations = evidenceOf({ a: KNOWN, b: HOURLESS }, VIEWED_AT).limitations;

    expect(limitations.some((limit) => limit.where === 'compatibility')).toBe(true);
    for (const limit of limitations) {
      expect(limit.text.length).toBeGreaterThan(0);
      // 궁합 경고만 종류를 든다. 시간 보정 경고는 아직 문장뿐이라 `null` 이다.
      expect(limit.kind === null || limit.where === 'compatibility').toBe(true);
    }
  });

  it('계약을 값과 함께 싣는다', () => {
    const contract = evidenceOf({ a: KNOWN }, VIEWED_AT).contract;

    expect(contract).toBe(EVIDENCE_CONTRACT);
    expect(contract.interpretation).toBe('none');
    expect(contract.scoring).toBe('not-scored');
    expect(contract.strength).toBe('derived-from-claim-ceiling');
    // 받는 쪽이 우리 문서를 안 읽는다는 것이 전제다 — 사다리도 자료 안에 있다.
    expect(contract.strengthLadder).toContain('candidate');
    expect(contract.strengthKo.candidate).toBe('후보');
  });
});

/**
 * 자료의 **모양**을 골든으로 잠근다 — 값은 잠그지 않는다.
 *
 * 계산 값은 `golden.snapshot.txt` 가 이미 잠근다. 여기서 조용히 어긋날 수 있는
 * 것은 계약 블록·상한 표·자료의 뼈대이고, 그것은 두 벌 다 실으면 몇 KB 다.
 * 값까지 찍으면 두 사람짜리가 460KB 라 무엇이 바뀌었는지 아무도 못 읽는다.
 *
 * **크기도 함께 찍는다.** 이 자료는 LLM 이 읽으라고 만든 것이라 바이트 수가
 * 성능이다. 재지 않으면 어느 커밋에서 두 배가 됐는지 알 수 없다.
 */
describe('자료의 모양', () => {
  const shapeOf = (value: unknown, depth = 0): string[] => {
    if (Array.isArray(value)) return [`[${value.length}]`];
    if (value === null || typeof value !== 'object') return [typeof value];
    if (depth >= 3) return [`{${Object.keys(value).length}}`];

    return Object.entries(value).flatMap(([key, inner]) => {
      const [head, ...rest] = shapeOf(inner, depth + 1);
      return rest.length === 0 ? [`${key}: ${head}`] : [`${key}:`, ...[head, ...rest].map((l) => `  ${l}`)];
    });
  };

  it('계약·상한·뼈대가 그대로다', async () => {
    const pair = evidenceOf({ a: KNOWN, b: OTHER }, VIEWED_AT);
    const single = evidenceOf({ a: HOURLESS }, VIEWED_AT);

    const claimTable = (chart: ChartEvidence) =>
      INCLUDED_PATHS.map(
        (path) =>
          `  ${path.padEnd(30)} 있다 ${chart.claims[path].presence.padEnd(10)} 없다 ${chart.claims[path].absence}`,
      );

    // **바이트로 센다.** `String.length` 는 UTF-16 칸 수라 한자·한글을 하나로 세는데,
    // 넘어가는 것은 UTF-8 이라 그 글자들이 세 배다. 두 자리에서 다르게 세면 화면이
    // 말하는 크기와 골든이 적는 크기가 갈린다.
    const sizeOf = (evidence: Evidence) =>
      `${Math.round(new TextEncoder().encode(JSON.stringify(evidence)).length / 1024)}KB`;

    const body = [
      '── 계약',
      JSON.stringify(EVIDENCE_CONTRACT, null, 2),
      '',
      '── 상한 · 시각을 아는 명식',
      ...claimTable(pair.charts.a),
      '',
      '── 상한 · 시간 미상',
      ...claimTable(single.charts.a),
      '',
      '── 궁합 상한 (두 사람 다 시각을 안다)',
      ...Object.entries(pair.compatibility!.claims).map(
        ([key, note]) => `  ${key.padEnd(20)} 있다 ${note.presence.padEnd(10)} 없다 ${note.absence}`,
      ),
      '',
      // 계약은 위에서 통째로 찍었으므로 뼈대에서는 뺀다.
      '── 뼈대 · 두 사람',
      `  viewedAt: ${pair.viewedAt}`,
      ...shapeOf({ charts: pair.charts, compatibility: pair.compatibility, limitations: pair.limitations }).map(
        (line) => `  ${line}`,
      ),
      '',
      // 운은 표가 아니라 이 칸으로 실린다 — 바뀌면 여기가 먼저 드러나야 한다.
      '── 지금 도는 운',
      ...shapeOf(pair.charts.a.now, 1).map((line) => `  ${line}`),
      '',
      '── 관계 하나의 모습',
      JSON.stringify(pair.compatibility!.relations[0], null, 2),
      '',
      '── 크기',
      `  한 사람  ${sizeOf(single)}`,
      `  두 사람  ${sizeOf(pair)}`,
    ].join('\n');

    await expect(`${body}\n`).toMatchFileSnapshot('./evidence.snapshot.txt');
  });
});

/**
 * 소수 자르기.
 *
 * **크기 때문에 자른 것이 아니다.** 재어 보면 1.4% 다. 자른 까닭은 이 자료가 제
 * 정밀도를 과장하지 않게 하려는 것이고, 그래서 잠글 것도 크기가 아니라 **두 가지**다 —
 * 찌꺼기가 정말 사라졌는가, 그리고 자르느라 없던 동점을 만들지 않았는가.
 */
describe('소수는 경계에서 잘린다', () => {
  const numbersIn = (value: unknown, path = ''): [string, number][] => {
    if (typeof value === 'number') return [[path, value]];
    if (Array.isArray(value)) return value.flatMap((item, i) => numbersIn(item, `${path}[${i}]`));
    if (value !== null && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, inner]) =>
        numbersIn(inner, path ? `${path}.${key}` : key),
      );
    }
    return [];
  };

  it('자료 어디에도 정해진 자리보다 긴 소수가 없다', () => {
    const evidence = evidenceOf({ a: KNOWN, b: OTHER }, VIEWED_AT);

    for (const [path, value] of numbersIn(evidence)) {
      const decimals = String(value).split('.')[1]?.length ?? 0;
      expect(decimals, `${path} = ${value}`).toBeLessThanOrEqual(EVIDENCE_DECIMALS);
    }
  });

  /**
   * **없는 동점을 만들면 긴 숫자보다 나쁘다.** 받는 쪽은 「土와 火가 같다」고 읽는데
   * 실제로는 다르다. 두 자리로 끊으면 골든에서 실제로 그 일이 일어난다.
   *
   * 그런데 「자르기 전에 달랐으니 자른 뒤에도 달라야 한다」로 시험할 수는 없다.
   * `dst-gap` 명식에서 火 는 `0.22916666666666666` 이고 土 는 `0.22916666666666669`
   * 인데, **둘 다 11/48 이고 더한 순서만 다르다.** 열일곱째 자리의 차이는 실재하는
   * 차이가 아니라 부동소수의 찌꺼기이고, 그것을 「구별」로 지키면 받는 쪽이 土 가
   * 火 보다 3e-17 만큼 세다고 읽게 된다. 자르기가 없애는 것이 아니라 드러낸다.
   *
   * 그래서 묻는 것을 바꾼다 — **합쳐진 짝이 원래 찌꺼기만큼만 달랐는가.**
   */
  it('잘라서 같아진 값은 원래 찌꺼기만큼만 달랐다', () => {
    /** 이보다 큰 차이가 합쳐지면 자리를 잘못 고른 것이다 */
    const NOISE = 1e-9;

    for (const golden of GOLDEN_CASES) {
      const saju = computeSaju(golden.input, golden.options);
      const evidence = evidenceOf({ a: saju }, VIEWED_AT);

      const before = Object.values(saju.analysis.elements.ratios);
      const after = Object.values(evidence.charts.a.analysis.elements.ratios);

      for (let i = 0; i < before.length; i += 1) {
        for (let j = i + 1; j < before.length; j += 1) {
          if (after[i] !== after[j]) continue;
          expect(
            Math.abs(before[i] - before[j]),
            `${golden.id}: ${before[i]} 와 ${before[j]} 가 합쳐졌다`,
          ).toBeLessThan(NOISE);
        }
      }
    }
  });

  it('정수는 건드리지 않는다', () => {
    const evidence = evidenceOf({ a: KNOWN }, VIEWED_AT);

    expect(evidence.charts.a.pillars.year.index).toBe(KNOWN.pillars.year.index);
    expect(EVIDENCE_CONTRACT.precision).toBe('non-integers-rounded-to-4-decimals');
  });
});
