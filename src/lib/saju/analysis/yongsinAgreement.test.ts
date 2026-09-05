import { describe, expect, it } from 'vitest';

import { STEM_INFO } from '../constants';
import { computeSaju } from '../index';
import { randomInputs } from '../population';
import { YONGSIN_POLICY } from './yongsin';

/** 화면이 읽는 것과 같은 값을 보려면 `computeSaju` 를 그대로 지난다 */
const analysisOf = (input: Parameters<typeof computeSaju>[0]) => computeSaju(input).analysis;

describe('억부와 조후의 대조', () => {
  /**
   * 대조는 **화면이 읽는 목록과 같은 목록**을 본다 — 상·하반월이 정해졌으면
   * 그 절반이다. 다른 목록을 보면 화면은 「어긋난다」는데 근거 칸에는 겹치는
   * 글자가 서 있는 일이 생긴다.
   */
  it('견주는 목록이 조후 칸이 세우는 목록과 같다', () => {
    for (const input of randomInputs(200)) {
      const { johu, yongsinAgreement } = computeSaju(input).analysis;

      expect(yongsinAgreement.johuStems).toEqual(johu.halfStems ?? johu.stems);
    }
  });

  it('겹치는 글자는 억부가 권한 오행짜리뿐이다', () => {
    for (const input of randomInputs(200)) {
      const { yongsinAgreement: agreement } = computeSaju(input).analysis;

      for (const stem of agreement.sharedStems) {
        expect(STEM_INFO[stem].element).toBe(agreement.eokbuElement);
        expect(agreement.johuStems).toContain(stem);
      }
      expect(agreement.aligned).toBe(agreement.sharedStems.length > 0);
    }
  });

  /**
   * 丙火 일간의 子월 — 조후는 壬·戊·己 를 보라 하고, 억부는 신약한 이 명식에
   * 인성(木)을 권한다. **두 길이 다른 것을 가리키는 자리다.**
   */
  it('어긋나면 겹치는 글자가 없다고 적는다', () => {
    const { yongsinAgreement: agreement } = analysisOf({
      year: 1984,
      month: 12,
      day: 20,
      hour: 4,
      minute: 30,
      second: 0,
      gender: 'male',
    });

    if (!agreement.aligned) {
      expect(agreement.sharedStems).toEqual([]);
      for (const stem of agreement.johuStems) {
        expect(STEM_INFO[stem].element).not.toBe(agreement.eokbuElement);
      }
    }
  });

  /**
   * **우선순위를 말하지 않는다.** 한랭·조열이 급하면 조후가 억부를 제친다는 것이
   * 여러 계통의 말이지만 「얼마나 급해야」를 재는 자리가 이 엔진에 없다. 없는
   * 판정에 이름만 붙이면 화면이 자기 근거보다 세게 말하게 된다.
   */
  it('어느 쪽이 우선인지는 말하지 않는다', () => {
    const { yongsinAgreement: agreement } = analysisOf({
      year: 1990,
      month: 5,
      day: 15,
      hour: 14,
      minute: 30,
      second: 0,
      gender: 'female',
    });

    expect(agreement.status).toBe('fact');
    expect(YONGSIN_POLICY.johuAgainstEokbu).toBe('compared-not-ranked');
    expect(Object.keys(agreement)).toEqual([
      'status',
      'eokbuElement',
      'johuStems',
      'sharedStems',
      'aligned',
    ]);
  });

  /** 3000건짜리 보정값은 `calibration.test.ts` 가 한 바퀴로 다 잰다 — 세 번 돌지 않는다 */
});
