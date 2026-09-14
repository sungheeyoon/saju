import { SegmentedNav } from '../segmented-nav';

/**
 * 한 사람을 보는 두 자리 — **사주와 풀이를 같은 화면에 쌓지 않는다.**
 *
 * 탭은 현재 화면을 숨겼다 보이는 클라이언트 상태가 아니라 각각 주소를 가진 링크다.
 * 그래서 사람 목록이나 풀이 목록에서 원하는 자리로 곧장 들어올 수 있고, 뒤로가기도
 * 사용자가 지나온 두 화면을 그대로 따른다.
 *
 * **모양은 `SegmentedNav` 가 든다.** 사주·궁합을 오가는 토글과 같은 것을 써야 앱에
 * 이 부품이 하나로 남는다.
 *
 * **사주가 먼저다.** 풀이는 사주 위에서 나는 것이라, 차례가 뒤집혀 있으면 처음 온
 * 사람이 결과를 먼저 보고 근거를 나중에 찾는다. 왼쪽에서 오른쪽으로 읽는 순서가 곧
 * 만들어지는 순서다.
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
      label={`${label}의 사주와 사주풀이`}
      items={[
        { href: chartHref, text: '사주', current: current === 'chart' },
        { href: readingHref, text: '사주풀이', current: current === 'reading' },
      ]}
    />
  );
}
