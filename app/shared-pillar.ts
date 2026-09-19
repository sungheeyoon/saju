import { chartSnapshotOf, type ChartSnapshot, type Gender, type Pillars } from '@/src/lib/saju';

/**
 * 공유 궁합 화면이 브라우저에 내보내는 명식 모양.
 *
 * **엔진의 여덟 글자 스냅샷과 같은 모양이다**(`ChartSnapshot`, ADR 0071). 한동안 이
 * 파일이 그 모양을 따로 들고 있었는데, 같은 것이 두 벌이면 한쪽만 고쳐지는 날이 온다.
 * 정확한 생년월일시·출생지·보정값이 든 `Saju.meta` 와 `Pillars.meta` 는 여기 없고,
 * 런타임에서도 아래 변환 함수가 새 객체를 만들어 잘라 낸다.
 *
 * 갈리는 칸이 하나 있다 — **성별**. 본인이 관리하는 사람의 비공개 궁합 화면에서만
 * 서고, 저장되는 스냅샷에는 안 실린다(동의 범위가 여덟 글자까지다, ADR 0012).
 */
export type SharedPillarChart = ChartSnapshot & {
  /** 본인이 관리하는 사람의 비공개 궁합 화면에서만 표시한다. */
  readonly gender?: Gender;
};

/** 여덟 글자만 복사한다 — 짓는 일은 엔진 쪽 한 자리가 한다 */
export function sharedPillarChartOf(pillars: Pillars): SharedPillarChart {
  return chartSnapshotOf(pillars);
}
