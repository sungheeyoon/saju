import { describe, expect, it } from 'vitest';
import { computeSaju } from '.';
import { positionOverlapsOf } from './overlap';
import { randomInputs, withoutHour } from './population';
import { PILLAR_POSITIONS } from './position';

const chart = (input: Parameters<typeof computeSaju>[0]) => computeSaju(input);

const SAMPLE = {
  year: 2065,
  month: 9,
  day: 4,
  hour: 0,
  minute: 0,
  second: 0,
  gender: 'female',
} as const;

describe('자리 색인', () => {
  /**
   * **이 시험이 색인을 두 벌로 만들지 않는 장치다.**
   *
   * 색인은 `relations` 에서 유도된다. 유도한 것을 표로 들고 있으면 언젠가
   * 어긋나고 어긋난 쪽을 알 수 없게 되는데, 여기서 원본으로 다시 세어 맞대면
   * 어긋나는 날 이 줄에서 걸린다.
   */
  it('관계표에서 다시 세어도 같다 — 이름과 종류를 함께 맞댄다', { timeout: 30_000 }, () => {
    for (const input of randomInputs(500)) {
      const saju = chart(input);

      for (const overlap of saju.overlaps) {
        for (const tier of ['stem', 'branch'] as const) {
          // **`ko` 만 맞대면 `kind` 가 통째로 잘못 실려도 통과한다.** 색인의 계약은
          // 「이 payload 가 전부 원본에서 왔다」이므로 쌍으로 맞댄다.
          const again = new Set(
            saju.relations
              .filter(
                (relation) =>
                  relation.tier === tier &&
                  relation.participants.some((p) => p.position === overlap.position),
              )
              .map((relation) => `${relation.kind}|${relation.ko}`),
          );

          expect(
            new Set(overlap[tier].map((one) => `${one.kind}|${one.ko}`)),
            `${overlap.position}/${tier}`,
          ).toEqual(again);
        }
      }
    }
  });

  /**
   * 칸이 곧 tier 라는 말은 이제 타입이 지킨다(`StemRelationKind`). 그 타입은
   * `kind` 의 이름으로 좁힌 것이라, **이름과 원본의 `tier` 가 어긋나는 날**에는
   * 컴파일이 아니라 여기서 걸려야 한다.
   */
  it('칸에 담긴 이름과 원본의 tier 가 어긋나지 않는다', () => {
    for (const input of randomInputs(300)) {
      const saju = chart(input);
      const tierOf = new Map(saju.relations.map((relation) => [relation.kind, relation.tier]));

      for (const overlap of saju.overlaps) {
        expect(overlap.stem.every((one) => tierOf.get(one.kind) === 'stem')).toBe(true);
        expect(overlap.branch.every((one) => tierOf.get(one.kind) === 'branch')).toBe(true);
      }
    }
  });

  /**
   * **접는 것도 계약이라 기준을 잰다.** 2000건에서 1537번 실제로 접힌다 —
   * 지어낸 걱정이 아니다.
   */
  it('같은 자리의 같은 이름은 한 번만 선다', () => {
    // 년지 卯와 시지 卯가 각각 월지 未와 반합해 「묘미 반합」이 원본에 두 줄이다.
    const saju = chart({
      year: 1915,
      month: 7,
      day: 14,
      hour: 7,
      minute: 0,
      second: 0,
      gender: 'female',
    });

    const twice = saju.relations.filter(
      (relation) =>
        relation.ko === '묘미 반합' && relation.participants.some((p) => p.position === 'month'),
    );
    expect(twice).toHaveLength(2);

    const month = saju.overlaps.find((one) => one.position === 'month')!;
    expect(month.branch.filter((one) => one.ko === '묘미 반합')).toHaveLength(1);
    // 접은 것은 이름뿐이다 — 몇 짝인지가 필요하면 원본을 본다.
    expect(month.branch.map((one) => one.ko)).toEqual(['오미합화', '묘미 반합', '오미 반방합']);
  });

  it('공망도 공망표에서 다시 세어 같다', () => {
    for (const input of randomInputs(300)) {
      const saju = chart(input);

      for (const overlap of saju.overlaps) {
        const again = saju.sinsal.emptiness
          .filter((one) => one.positions.includes(overlap.position))
          .map((one) => one.basis);

        expect(overlap.emptiness).toEqual(again);
      }
    }
  });

  it('천간 칸이 언제나 비어 있지는 않다 — 위 시험들이 헛돌지 않는지', () => {
    const sawStem = randomInputs(300).some((input) =>
      chart(input).overlaps.some((overlap) => overlap.stem.length > 0),
    );

    expect(sawStem).toBe(true);
  });

  it('겹친 것이 없는 자리도 선다 — 「쟀는데 없다」와 「안 쟀다」는 다르다', () => {
    const saju = chart(SAMPLE);

    expect(saju.overlaps.map((one) => one.position)).toEqual([...PILLAR_POSITIONS]);
    expect(saju.overlaps.every((one) => Array.isArray(one.stem))).toBe(true);
  });

  it('시간 미상이면 시주 자리를 아예 내지 않는다 — 빈 배열로 세우지 않는다', () => {
    const saju = chart(withoutHour(SAMPLE));

    expect(saju.overlaps.map((one) => one.position)).toEqual(['year', 'month', 'day']);
    expect(saju.overlaps.some((one) => one.position === 'hour')).toBe(false);
  });

  /**
   * 실제로 이 색인을 만든 이유 — **양인이 걸린 일지가 충을 맞았다.**
   *
   * 자료에는 여태 두 사실이 나란히 있었다. 신살은 자기가 일지에 걸린 것을 알고
   * (`hits[].position`) 관계표는 자기 참여자가 일지인 것을 아는데, 둘을 맞춰
   * 보는 곳이 없었다. 읽는 쪽이 산문으로 조인해야 했고 거기서 틀린다.
   */
  it('양인·도화가 걸린 일지에 자오충과 공망이 함께 선다', () => {
    const saju = chart(SAMPLE);

    expect(saju.pillars.day.name).toBe('丙午');

    const atDay = saju.sinsal.stars
      .filter((star) => star.hits.some((hit) => hit.position === 'day'))
      .map((star) => star.id);
    expect(atDay).toContain('yangin');
    expect(atDay).toContain('dohwa:year');

    const day = saju.overlaps.find((one) => one.position === 'day')!;

    expect(day.branch.map((one) => one.ko)).toEqual(['자오충']);
    expect(day.branch.map((one) => one.kind)).toEqual(['branchClash']);
    // 일주 기준으로는 안 비고 년주 기준으로만 빈다 — 어느 기준인지까지 적는다.
    expect(day.emptiness).toEqual(['year']);
  });

  it('겹친 것이 무엇을 뜻하는지는 말하지 않는다 — 이름과 자리까지다', () => {
    const day = chart(SAMPLE).overlaps.find((one) => one.position === 'day')!;

    expect(Object.keys(day).sort()).toEqual(['branch', 'emptiness', 'position', 'stem']);
    expect(Object.keys(day.branch[0]).sort()).toEqual(['kind', 'ko']);
  });

  it('관계도 공망도 없으면 자리만 서고 전부 빈다', () => {
    // 인자에 기본값을 두지 않은 것은 타입이 지킨다 — 호출부가 잊으면 컴파일이
    // 막힌다. 여기서 재는 것은 정말로 아무것도 없을 때의 모양이다.
    expect(positionOverlapsOf({ relations: [], emptiness: [], hourKnown: true })).toEqual(
      PILLAR_POSITIONS.map((position) => ({ position, stem: [], branch: [], emptiness: [] })),
    );
  });
});
