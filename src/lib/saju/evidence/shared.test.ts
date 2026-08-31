import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { evidenceOf } from '@/src/lib/saju/evidence';
import { redactEvidence } from '@/src/lib/saju/evidence/redacted';
import { WITHHELD_PATHS, shareEvidence } from '@/src/lib/saju/evidence/shared';

const VIEWED_AT = new Date('2026-08-25T13:00:00+09:00');

const A = computeSaju({ year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male' });
const B = computeSaju({ year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' });

const pair = redactEvidence(evidenceOf({ a: A, b: B }, VIEWED_AT));
const shared = shareEvidence(pair);

describe('공유 자료는 상대 원국 전체 판정을 들지 않는다', () => {
  it('빠지기로 한 자리가 하나도 없다', () => {
    expect(shared).not.toBeNull();

    for (const chart of [shared!.charts.a, shared!.charts.b]) {
      for (const path of Object.keys(WITHHELD_PATHS)) {
        expect(Object.keys(chart), `${path} 가 남았다`).not.toContain(path);
      }
    }
  });

  /**
   * **목록이 엔진을 따라오는지 되묻는다.**
   *
   * 위 시험은 목록에 적힌 것이 잘렸는지만 본다. 그래서 새 자리가 엔진에
   * 들어오면 `shareChart` 가 고르기만 하므로 조용히 잘리는데, 계약이 들고
   * 나가는 목록에는 이름이 없다 — 받는 쪽은 그런 자리가 있었다는 것조차 모른다.
   * `UNCOVERED_FACTS_BY_PATH` 가 여섯 줄에 멈춰 있던 것과 같은 자리라 방향을
   * 뒤집어 한 번 더 잰다.
   */
  it('잘린 자리는 빠짐없이 목록에 적혀 있다', () => {
    const dropped = Object.keys(pair.charts.a).filter(
      (path) => !Object.keys(shared!.charts.a).includes(path),
    );

    expect(dropped.sort()).toEqual(Object.keys(WITHHELD_PATHS).sort());
  });

  it('빠진 자리는 자르기 전에는 있던 자리다', () => {
    for (const path of Object.keys(WITHHELD_PATHS)) {
      expect(Object.keys(pair.charts.a)).toContain(path);
    }
  });

  it('여덟 글자는 그대로 선다 — 동의가 연 것이 그 글자다', () => {
    expect(shared!.charts.a.pillars.year.name).toBe(pair.charts.a.pillars.year.name);
    expect(shared!.charts.b.pillars.day.name).toBe(pair.charts.b!.pillars.day.name);
  });

  it('궁합은 통째로 남는다', () => {
    expect(shared!.compatibility).toEqual(pair.compatibility);
    expect(shared!.limitations).toEqual(pair.limitations);
  });

  it('상한 표도 남는 자리만큼만 든다', () => {
    expect(Object.keys(shared!.charts.a.claims).sort()).toEqual(['meta', 'pillars']);
  });

  it('무엇을 왜 뺐는지 자료가 들고 나간다', () => {
    expect(shared!.contract.withheld).toBe(WITHHELD_PATHS);
    expect(shared!.contract.scope).toBe('match-consent');
    // 앞선 컷도 그대로다 — 출생 원문은 여기서도 없다.
    expect(shared!.contract.redacted).toBe(pair.contract.redacted);
  });

  it('한 사람짜리 자료로는 공유 결과를 만들지 않는다', () => {
    expect(shareEvidence(redactEvidence(evidenceOf({ a: A }, VIEWED_AT)))).toBeNull();
  });
});
