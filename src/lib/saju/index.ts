import { analyzePillars, type Analysis, type AnalysisOptions } from './analysis';
import type { CivilDateTime } from './civilTime';
import {
  getFourPillars,
  type FourPillars,
  type LateNightRule,
  type PillarOptions,
} from './pillars';
import {
  correctTime,
  type Correction,
  type CorrectedTime,
  type TimeCorrectionOptions,
} from './timeCorrection';

export * from './analysis';
export * from './civilTime';
export * from './constants';
export * from './pillars';
export * from './solarTerms';
export * from './timeCorrection';

/**
 * 만세력 엔진의 입구 — 시간 보정과 4주 도출을 이어 붙인다.
 *
 * 파이프라인은 두 단계다.
 *   1. 벽시계 + 출생지 → 절대 시각 + 지방시 보정  (timeCorrection)
 *   2. 절대 시각 + 보정 → 4주                      (pillars)
 *
 * 두 단계 모두 순수 함수라 서버 없이 브라우저에서 그대로 돈다.
 */

export type SajuOptions = TimeCorrectionOptions & {
  lateNightRule?: LateNightRule;
  analysis?: AnalysisOptions;
};

export type Saju = {
  pillars: FourPillars;
  /** 오행 분포·십성·신강신약 — L2 관계 연산이 먹고 들어가는 재료 */
  analysis: Analysis;
  meta: {
    /** 입력한 벽시계 시각 그대로 */
    inputTime: CivilDateTime;
    /** 그 벽시계가 가리키는 실제 절대 시각 */
    instant: Date;
    /** 적용된 보정 내역 — 다른 만세력과 결과가 다른 이유가 여기 남는다 */
    corrections: Correction[];
    /** 보정 총합(분) */
    totalCorrectionMinutes: number;
    warnings: string[];
  };
};

export function computeSaju(inputTime: CivilDateTime, options: SajuOptions = {}): Saju {
  const { lateNightRule, analysis: analysisOptions, ...correctionOptions } = options;

  const corrected: CorrectedTime = correctTime(inputTime, correctionOptions);

  const pillarOptions: PillarOptions = {
    lateNightRule,
    zoneOffsetMinutes: corrected.zoneOffsetMinutes,
    solarTimeOffsetMinutes: corrected.solarTimeOffsetMinutes,
  };

  const pillars = getFourPillars(corrected.instant, pillarOptions);

  const totalCorrectionMinutes = corrected.corrections.reduce(
    (sum, correction) => sum + correction.minutes,
    0,
  );

  return {
    pillars,
    analysis: analyzePillars(pillars, analysisOptions),
    meta: {
      inputTime,
      instant: corrected.instant,
      corrections: corrected.corrections,
      totalCorrectionMinutes,
      // 보정 단계의 경고가 먼저, 4주 도출의 경계 경고가 뒤에 온다.
      warnings: [...corrected.warnings, ...pillars.meta.warnings],
    },
  };
}
