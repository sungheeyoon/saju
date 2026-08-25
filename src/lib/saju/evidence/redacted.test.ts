import { describe, expect, it } from 'vitest';

import { CITY_LONGITUDES, computeSaju } from '@/src/lib/saju';
import { evidenceOf } from '@/src/lib/saju/evidence';
import {
  BLURRED_DISTANCE,
  REDACTED_PATHS,
  blurDistance,
  redactEvidence,
} from '@/src/lib/saju/evidence/redacted';

const VIEWED_AT = new Date('2026-08-25T13:00:00+09:00');

const chart = (longitude: number) =>
  computeSaju(
    { year: 1990, month: 5, day: 12, hour: 14, minute: 37, second: 0, gender: 'male' },
    { longitude, useLongitude: true },
  );

const SEOUL = chart(CITY_LONGITUDES.서울);
const OTHER = computeSaju(
  { year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' },
  { longitude: CITY_LONGITUDES.서울, useLongitude: true },
);

/** 입하 절입(1990-05-06 03:35 KST) 코앞 — 절입 경고가 분 수치를 들고 나오는 자리 */
const NEAR_BOUNDARY = computeSaju({
  year: 1990,
  month: 5,
  day: 6,
  hour: 3,
  minute: 33,
  second: 0,
  gender: 'female',
});

const redactedOf = (a: ReturnType<typeof computeSaju>, b?: ReturnType<typeof computeSaju>) =>
  redactEvidence(evidenceOf({ a, b }, VIEWED_AT));

/** 자료를 통째로 훑는다 — 깊은 곳에 남은 것을 잡는다(`evidence.test.ts` 와 같은 도구) */
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

const keysIn = (value: unknown): string[] =>
  [...walk(value)].flatMap((node) =>
    node !== null && typeof node === 'object' && !Array.isArray(node) ? Object.keys(node) : [],
  );

describe('넘길 자료는 출생 원문을 들지 않는다', () => {
  it('원문이 실리던 자리가 이름째로 없다', () => {
    const keys = keysIn(redactedOf(SEOUL, OTHER));

    for (const path of Object.keys(REDACTED_PATHS)) {
      const leaf = path.split('.').at(-1) as string;
      expect(keys, `${path} 가 남았다`).not.toContain(leaf);
    }
  });

  it('자른 자리는 자르기 전에는 있던 자리다 — 없는 것을 자른 척하지 않는다', () => {
    const keys = keysIn(evidenceOf({ a: SEOUL, b: OTHER }, VIEWED_AT));

    for (const path of Object.keys(REDACTED_PATHS)) {
      const leaf = path.split('.').at(-1) as string;
      expect(keys, `${path} 는 애초에 없었다`).toContain(leaf);
    }
  });

  it('입력한 값이 어떤 꼴로도 남지 않는다', () => {
    const serialized = JSON.stringify(redactedOf(SEOUL));

    // 분·초는 여덟 글자에서 나오지 않는다. 37 이 어딘가에 남았다면 원문이 샌 것이다.
    expect(serialized).not.toContain('"minute":37');
    expect(serialized).not.toContain('14:37');
    // 절대 시각도 마찬가지다.
    expect(serialized).not.toContain(SEOUL.meta.instant.toISOString());
  });

  it('출생지가 남지 않는다 — 도시가 달라도 자료가 같다', () => {
    const seoul = JSON.stringify(redactedOf(chart(CITY_LONGITUDES.서울)));
    const busan = JSON.stringify(redactedOf(chart(CITY_LONGITUDES.부산)));

    /**
     * 경도는 명식을 가를 수 있다. 이 시각은 경계에서 멀어 서울과 부산의 여덟 글자가
     * 같고, 그러면 **잘라 낸 자료도 한 글자까지 같아야 한다.** 다르면 그 차이가 곧
     * 출생지다 — 어느 필드가 그것을 들고 있는지 이 시험이 잡는다.
     */
    expect(busan).toBe(seoul);

    for (const longitude of Object.values(CITY_LONGITUDES)) {
      expect(seoul).not.toContain(String(longitude));
    }
  });

  it('분 단위 거리가 문장에 남지 않는다', () => {
    const before = JSON.stringify(evidenceOf({ a: NEAR_BOUNDARY }, VIEWED_AT));
    const after = JSON.stringify(redactedOf(NEAR_BOUNDARY));

    // 자르기 전에는 있어야 이 시험이 무언가를 재는 것이다.
    expect(before).toMatch(/\d+분 차이|1분 미만 차이/);
    expect(after).not.toMatch(/\d+분 차이|1분 미만 차이/);
    expect(after).toContain(BLURRED_DISTANCE);
  });

  it('한계는 그대로 선다 — 뭉갠 것은 수치뿐이다', () => {
    const evidence = evidenceOf({ a: NEAR_BOUNDARY }, VIEWED_AT);
    const redacted = redactEvidence(evidence);

    expect(redacted.limitations).toHaveLength(evidence.limitations.length);
    expect(redacted.limitations.map((one) => one.where)).toEqual(
      evidence.limitations.map((one) => one.where),
    );
  });

  it('무엇을 잘랐는지 자료가 들고 나간다', () => {
    const { contract } = redactedOf(SEOUL, OTHER);

    expect(contract.redacted).toBe(REDACTED_PATHS);
    expect(contract.blurred).toContain(BLURRED_DISTANCE);
    // 원래 계약도 그대로 실린다 — 자른 것이 계약을 대신하지 않는다.
    expect(contract.version).toBe('evidence-v0');
  });

  it('궁합 자료는 그대로 남는다 — 자르는 것은 명식 쪽이다', () => {
    const evidence = evidenceOf({ a: SEOUL, b: OTHER }, VIEWED_AT);
    const redacted = redactEvidence(evidence);

    expect(redacted.compatibility).toEqual(evidence.compatibility);
    expect(redacted.viewedAt).toBe(evidence.viewedAt);
  });

  it('한 사람이면 `b` 는 그대로 `null` 이다', () => {
    expect(redactedOf(SEOUL).charts.b).toBeNull();
  });
});

describe('분 단위 거리 뭉개기', () => {
  it('거리만 뭉갠다 — 다른 분 수치는 건드리지 않는다', () => {
    expect(blurDistance('입하 절입 시각과 3분 차이입니다.')).toBe(
      `입하 절입 시각과 ${BLURRED_DISTANCE}.`,
    );
    expect(blurDistance('시지 경계와 1분 미만 차이입니다.')).toBe(
      `시지 경계와 ${BLURRED_DISTANCE}.`,
    );
    expect(blurDistance('보정 총합은 32분입니다.')).toBe('보정 총합은 32분입니다.');
  });
});
