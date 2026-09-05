import { describe, expect, it } from 'vitest';

import { computeSaju } from '../index';
import { randomInputs } from '../population';
import { FOLLOWING_PATTERN_POLICY } from './followingPatterns';
import { JUDGEMENT_KO, type JudgementKey } from './precedence';
import { STRUCTURE_POLICY } from './structure';
import { TONGGWAN_POLICY } from './tonggwan';
import { YONGSIN_POLICY } from './yongsin';

const chart = () =>
  computeSaju({ year: 1992, month: 11, day: 17, hour: 4, minute: 43, second: 0, gender: 'male' });

describe('판정 사이의 서열', () => {
  /**
   * **판정이 늘면 줄이 는다.** 서열에 안 선 판정은 받는 쪽에서 서열 없이 읽히고,
   * 그것이 이 값을 만든 까닭이다. 새 판정을 만든 사람이 여기서 걸린다.
   */
  it('서열에 서는 판정을 하나도 빠뜨리지 않는다', () => {
    const rows = chart().analysis.precedence.rows;

    expect(rows.map((row) => row.key)).toEqual(Object.keys(JUDGEMENT_KO) as JudgementKey[]);
    for (const row of rows) expect(row.ko).toBe(JUDGEMENT_KO[row.key]);
  });

  /**
   * **기준 하나만 이긴다.**
   *
   * 지금은 억부뿐이다. 어느 판정의 스위치가 켜지는 날 이 시험이 먼저 걸리고, 그때
   * 고칠 것은 시험이 아니라 **서열을 다시 정하는 일**이다 — 두 판정이 동시에 이기면
   * 어긋날 때 무엇을 보는지가 다시 없어진다.
   */
  it('기준이 아닌 판정은 하나도 억부를 뒤집지 않는다', () => {
    const { primary, rows } = chart().analysis.precedence;

    expect(primary).toBe('eokbu');
    for (const row of rows) {
      expect(row.overrides, row.ko).toBe(row.key === primary);
      expect(row.reason === 'primary', row.ko).toBe(row.key === primary);
    }
  });

  /**
   * **스위치를 다시 적지 않는다.** 표가 정책과 갈리면 자료를 받는 쪽은 갈렸다는 것도
   * 모른다 — 화면이 종격 대조 성적을 손으로 적고 있다가 v1 의 숫자에 멈춰 있던 것과
   * 같은 자리다. 여기서는 정책 상수와 값을 직접 맞춘다.
   */
  it('각 줄이 그 판정의 정책 스위치를 그대로 읽는다', () => {
    const rows = chart().analysis.precedence.rows;
    const overrideOf = (key: JudgementKey) => rows.find((row) => row.key === key)!.overrides;

    expect(overrideOf('following')).toBe(FOLLOWING_PATTERN_POLICY.eokbuOverride !== 'disabled');
    expect(overrideOf('structure')).toBe(STRUCTURE_POLICY.yongsinOverride !== 'disabled');
    expect(overrideOf('tonggwan')).toBe(TONGGWAN_POLICY.eokbuOverride !== 'disabled');
    expect(overrideOf('johu')).toBe(YONGSIN_POLICY.johuAgainstEokbu !== 'compared-not-ranked');
  });

  /**
   * `null` 은 「어긋나지 않는다」가 아니라 **견줄 수 없다**는 뜻이다. 격국은 상신을
   * 오행으로 내지 않고 통관은 판정이 없다 — 안 재 본 것을 잰 것처럼 적으면 안 된다.
   */
  it('견줄 수 없는 자리는 어긋남을 거짓이 아니라 빈 값으로 둔다', () => {
    const rows = chart().analysis.precedence.rows;
    const disagreeOf = (key: JudgementKey) => rows.find((row) => row.key === key)!.disagrees;

    expect(disagreeOf('structure')).toBeNull();
    expect(disagreeOf('tonggwan')).toBeNull();
    expect(disagreeOf('eokbu')).toBe(false);
  });

  it('어긋남은 새로 판정하지 않고 이미 나온 값을 읽는다', () => {
    for (const input of randomInputs(200)) {
      const { precedence, yongsinAgreement, following } = computeSaju(input).analysis;
      const row = (key: JudgementKey) => precedence.rows.find((one) => one.key === key)!;

      expect(row('johu').disagrees).toBe(!yongsinAgreement.aligned);
      expect(row('following').disagrees).toBe(following.verdict !== 'not-following');
    }
  });

  /** 3000건짜리 보정값은 `calibration.test.ts` 가 한 바퀴로 다 잰다 — 세 번 돌지 않는다 */
});
