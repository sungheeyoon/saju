import { describe, expect, it } from 'vitest';

import { computeSaju } from '..';
import { NATAL_CHART_ID } from '../relations';
import { randomInputs } from '../population';
import { currentFortuneOf, NOW_POLICY } from '.';

const VIEWED_AT = new Date('2026-09-05T12:00:00+09:00');

const nowOf = (input: Parameters<typeof computeSaju>[0]) =>
  currentFortuneOf(computeSaju(input), VIEWED_AT);

describe('지금 겹치는 것', () => {
  /**
   * **이 값을 만든 까닭이 이 명식이다.**
   *
   * 원국에 인신충이 있는 사람에게 이번 달 申이 또 온다. 두 사실은 목록에 다 있었지만
   * 서로 다른 칸에 있었고, 운 관계가 열아홉 줄이라 **가장 중요한 한 줄이 그 안에
   * 파묻혔다.** 겹침을 세면 그 줄이 먼저 선다.
   */
  it('원국에 이미 있던 충을 이번 달 글자가 다시 밟는 것을 짚는다', () => {
    const now = nowOf({
      year: 1992,
      month: 11,
      day: 17,
      hour: 4,
      minute: 43,
      second: 0,
      gender: 'male',
    });

    const monthly = now.overlaps.filter((overlap) => overlap.from.chartId.startsWith('monthly:'));
    const clash = monthly.find((overlap) => overlap.ko === '인신충');

    expect(clash).toBeDefined();
    expect(clash!.from.char).toBe('申');
    // 원국의 인신충이 걸려 있던 두 자리를 그대로 든다.
    expect([...clash!.natalSeats].sort()).toEqual(['hour', 'year']);
  });

  /**
   * **관계를 새로 세지 않는다.** 겹침에 선 이름은 지금 목록에도 반드시 있다 — 세는
   * 자리가 둘이 되면 표와 카드가 어긋나는 날 어느 쪽이 맞는지 알 수 없다.
   */
  it('겹침은 지금 목록에 이미 있는 것만 가리킨다', () => {
    for (const input of randomInputs(200)) {
      const now = nowOf(input);
      const names = now.relations.map((relation) => relation.ko);

      for (const overlap of now.overlaps) {
        expect(names).toContain(overlap.ko);
        // 치는 쪽은 원국 밖의 글자다 — 원국끼리의 관계를 겹침으로 세지 않는다.
        expect(overlap.from.chartId).not.toBe(NATAL_CHART_ID);
        expect(overlap.natalSeats.length).toBeGreaterThan(0);
      }
    }

    expect(NOW_POLICY.overlaps).toBe('matched-by-kind-and-seat');
  });

  /**
   * **종류를 함께 본다.** 자리만 맞추면 「이 자리에 뭔가 또 걸렸다」가 되어 거의 모든
   * 달이 참이 되고, 그때 이 값은 아무것도 가리키지 않는다. 원국이 그 종류를 실제로
   * 들고 있는지 되짚는다.
   */
  it('같은 종류가 원국에 실제로 있을 때만 겹쳤다고 한다', () => {
    for (const input of randomInputs(200)) {
      const saju = computeSaju(input);
      const now = currentFortuneOf(saju, VIEWED_AT);

      for (const overlap of now.overlaps) {
        const natal = saju.relations.filter((relation) => relation.kind === overlap.kind);

        expect(natal.length).toBeGreaterThan(0);
        for (const seat of overlap.natalSeats) {
          expect(
            natal.some((relation) =>
              relation.participants.some((participant) => participant.position === seat),
            ),
          ).toBe(true);
        }
      }
    }
  });
});
