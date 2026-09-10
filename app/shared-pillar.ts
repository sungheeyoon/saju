import type { Gender, Pillar, Pillars } from '@/src/lib/saju';

type SharedPillar = Pick<Pillar, 'stem' | 'branch'>;

/**
 * 공유 궁합 화면이 브라우저에 내보내는 명식 모양.
 *
 * 정확한 생년월일시·출생지·보정값이 든 `Saju.meta`와 `Pillars.meta`는 이 타입에 없고,
 * 런타임에서도 아래 변환 함수가 새 객체를 만들어 잘라 낸다.
 */
export type SharedPillarChart = {
  readonly year: SharedPillar;
  readonly month: SharedPillar;
  readonly day: SharedPillar;
  readonly hour: SharedPillar | null;
  readonly dayMaster: Pillars['dayMaster'];
  /** 본인이 관리하는 사람의 비공개 궁합 화면에서만 표시한다. */
  readonly gender?: Gender;
};

const sharedPillar = (pillar: Pillar): SharedPillar => ({
  stem: pillar.stem,
  branch: pillar.branch,
});

/** 여덟 글자만 복사한다. 원본 객체를 그대로 넘기면 `Pillars.meta`까지 직렬화될 수 있다. */
export function sharedPillarChartOf(pillars: Pillars): SharedPillarChart {
  return {
    year: sharedPillar(pillars.year),
    month: sharedPillar(pillars.month),
    day: sharedPillar(pillars.day),
    hour: pillars.hour === null ? null : sharedPillar(pillars.hour),
    dayMaster: pillars.dayMaster,
  };
}
