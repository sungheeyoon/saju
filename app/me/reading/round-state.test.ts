import { describe, expect, it } from 'vitest';

import { GENERATION } from './generation';
import {
  EMPTY_RUN,
  nowGeneration,
  overLength,
  runRecordFrom,
  runsOf,
  sameGeneration,
  scoresFrom,
  withRun,
} from './round-state';

/**
 * 이 계산들은 채점 화면 안에 있었다. 그동안은 **30건을 넣어 보고 나서야** 저장·복원이
 * 도는지 알 수 있었다 — 틀렸다면 한 시간 채점한 것을 잃고 알게 된다.
 */

describe('저장한 것을 되살린다', () => {
  it('없던 자리는 빈 회차로 메워 받는다', () => {
    const restored = scoresFrom(JSON.stringify({ 'Q01-A': { runs: [{ output: '가' }] } }));

    expect(restored['Q01-A'].runs[0]).toEqual({ ...EMPTY_RUN, output: '가' });
  });

  /** 복원하다 던지면 화면이 안 서고, 그 상태에서 한 칸만 적어도 빈 것으로 덮인다 */
  it('깨진 것과 없는 것은 빈 기록이 된다', () => {
    for (const broken of [null, '', '{', '[]', 'null', '{"Q01-A":null}']) {
      expect(() => scoresFrom(broken === '' ? null : broken), broken ?? 'null').not.toThrow();
    }
    expect(scoresFrom('{')).toEqual({});
  });

  it('옛 형식(회차 없음)도 던지지 않는다', () => {
    expect(scoresFrom(JSON.stringify({ 'Q01-A': { output: '옛 형식' } }))).toEqual({
      'Q01-A': { runs: [] },
    });
  });
});

describe('회차', () => {
  it('저장된 것이 모자라도 늘 회차 수만큼 낸다', () => {
    const runs = runsOf({ 'Q01-A': { runs: [{ ...EMPTY_RUN, output: '1회' }] } }, 'Q01-A', 2);

    expect(runs).toHaveLength(2);
    expect(runs[0].output).toBe('1회');
    expect(runs[1]).toEqual(EMPTY_RUN);
  });

  it('아무것도 없는 칸도 회차 수만큼 낸다', () => {
    expect(runsOf({}, 'Q01-A', 2)).toEqual([EMPTY_RUN, EMPTY_RUN]);
  });

  /** 2회차를 적다가 1회차가 지워지면 그 자리를 다시 채점해야 한다 */
  it('한 회차를 고쳐도 다른 회차가 안 흔들린다', () => {
    const one = withRun({}, 'Q01-A', 0, { output: '1회', grounding: '4' }, 2);
    const both = withRun(one, 'Q01-A', 1, { output: '2회' }, 2);

    expect(both['Q01-A'].runs[0].output).toBe('1회');
    expect(both['Q01-A'].runs[0].grounding).toBe('4');
    expect(both['Q01-A'].runs[1].output).toBe('2회');
  });

  it('한 칸을 고쳐도 다른 칸이 안 흔들린다', () => {
    const before = withRun({}, 'Q01-A', 0, { output: '가' }, 2);
    const after = withRun(before, 'Q01-B', 0, { output: '나' }, 2);

    expect(after['Q01-A'].runs[0].output).toBe('가');
    expect(after['Q01-B'].runs[0].output).toBe('나');
  });

  /** 저장한 것을 되살렸을 때 적은 것이 그대로여야 한다 */
  it('적고 저장하고 되살리면 같은 것이 나온다', () => {
    const written = withRun({}, 'Q01-A', 1, { output: '2회', usefulness: '5' }, 2);
    const restored = scoresFrom(JSON.stringify(written));

    expect(runsOf(restored, 'Q01-A', 2)).toEqual(runsOf(written, 'Q01-A', 2));
  });
});

describe('라운드 설정 기록', () => {
  const record = { id: 'r1', model: 'm', provider: 'p', settings: 's' };

  it('온전히 적힌 것만 기록으로 받는다', () => {
    expect(runRecordFrom(JSON.stringify(record))).toEqual(record);
  });

  /** 반쪽 설정으로 기록을 지으면 「무엇으로 돌렸는가」가 반만 참이 된다 */
  it('반쯤 적힌 것·빈 id·깨진 것은 없는 것으로 본다', () => {
    for (const bad of [
      JSON.stringify({ id: 'r1', model: 'm' }),
      JSON.stringify({ id: '', model: 'm', provider: 'p', settings: 's' }),
      JSON.stringify({ model: 'm', provider: 'p', settings: 's' }),
      'null',
      '{',
      'r1',
    ]) {
      expect(runRecordFrom(bad), bad).toBeNull();
    }
    expect(runRecordFrom(null)).toBeNull();
  });

  it('지금 설정은 코드가 든 값 그대로다', () => {
    expect(nowGeneration().model).toBe(GENERATION.model);
    expect(nowGeneration().provider).toBe(GENERATION.provider);
  });

  /** 도중에 설정이 바뀐 것은 옛 값을 지킬 일이 아니라 그 라운드가 깨졌다는 사실이다 */
  it('한 칸이라도 다르면 다른 설정이다', () => {
    expect(sameGeneration(record, { ...record })).toBe(true);
    expect(sameGeneration(record, { ...record, model: '다른 모델' })).toBe(false);
    expect(sameGeneration(record, { ...record, settings: 'store=true' })).toBe(false);
  });
});

describe('분량이 얼마나 벗어났는가', () => {
  const band = { min: 600, max: 900 };

  /** 「안 벗어났다」와 「0만큼 벗어났다」를 같은 칸에 적으면 세는 쪽이 둘을 못 가른다 */
  it('안 벗어났으면 아무 말도 하지 않는다', () => {
    for (const length of [600, 750, 900]) expect(overLength(length, band)).toBeNull();
  });

  it('넘친 것과 모자란 것을 갈라 말한다', () => {
    expect(overLength(1147, band)).toBe('27% 초과');
    expect(overLength(300, band)).toBe('50% 모자람');
  });
});
