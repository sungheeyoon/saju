import Link from 'next/link';

/**
 * 한 사람을 보는 두 자리 — **명식과 풀이를 같은 화면에 쌓지 않는다.**
 *
 * 탭은 현재 화면을 숨겼다 보이는 클라이언트 상태가 아니라 각각 주소를 가진 링크다.
 * 그래서 사람 목록이나 풀이 목록에서 원하는 자리로 곧장 들어올 수 있고, 뒤로가기도
 * 사용자가 지나온 두 화면을 그대로 따른다.
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
  const tab = (selected: boolean) =>
    `flex min-h-10 flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
      selected
        ? 'bg-surface text-accent shadow-sm'
        : 'text-secondary hover:bg-surface/70 hover:text-foreground'
    }`;

  return (
    <nav
      aria-label={`${label}의 명식과 사주풀이`}
      className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface-sunken p-1"
    >
      <Link href={readingHref} aria-current={current === 'reading' ? 'page' : undefined} className={tab(current === 'reading')}>
        사주풀이
      </Link>
      <Link href={chartHref} aria-current={current === 'chart' ? 'page' : undefined} className={tab(current === 'chart')}>
        명식 보기
      </Link>
    </nav>
  );
}
