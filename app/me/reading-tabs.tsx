import { SegmentedNav } from '../segmented-nav';

/**
 * 한 사람을 보는 두 자리 — **사주풀이와 만세력을 같은 화면에 쌓지 않는다.**
 *
 * 탭은 현재 화면을 숨겼다 보이는 클라이언트 상태가 아니라 각각 주소를 가진 링크다(`?tab=chart`). 그래서 목록에서 원하는 자리로
 * 곧장 들어올 수 있고, 뒤로가기도 사용자가 지나온 두 화면을 그대로 따른다.
 *
 * **사주풀이가 먼저이고 기본이다**(운영자 2026-10-26) — 이 사람에게서 받은 것(사주풀이 · 궁합)이 첫 화면이고, 만세력 표는 둘째 탭이다.
 * 모양은 **밑줄 탭**이다(`SegmentedNav` 의 `underline`).
 */
export function ReadingTabs({
  current,
  chartHref,
  readingHref,
  label,
}: {
  current: 'chart' | 'reading';
  chartHref: string;
  readingHref: string;
  label: string;
}) {
  return (
    <SegmentedNav
      label={`${label}의 사주풀이와 만세력`}
      look="underline"
      items={[
        { href: readingHref, text: '사주풀이', current: current === 'reading' },
        /* 「만세력」 — 홈 카드의 「만세력 보기」와 같은 이름(운영자 결정 2026-10-26, 대장 home-03) */
        { href: chartHref, text: '만세력', current: current === 'chart' },
      ]}
    />
  );
}
