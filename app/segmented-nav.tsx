import Link from 'next/link';

/**
 * 한 덩이 토글로 선 **화면 사이의 길** — 앱에 이 모양 하나다.
 *
 * 한 사람의 사주와 풀이(`ReadingTabs`)처럼 두 화면이 짝을 이루는 자리에 선다. **탭이 아니라 링크**다 — 각자 주소를
 * 가지므로 목록에서 곧장 들어올 수 있고 뒤로가기도 지나온 화면을 그대로 따른다.
 *
 * 모양을 여기 한 벌만 두는 것이 요점이다. 같은 뜻의 부품이 두 파일에 따로 있으면
 * 한쪽만 고쳐지는 날이 오고, 그때 사용자는 **같은 것을 두 모양으로** 본다.
 *
 * 모양은 머리글 메뉴와 같은 **알약 분할**이다 — 켜진 쪽이 먹색으로 채워진다(5차 warm). 색만으로 말하지
 * 않는다: 켜진 쪽은 `aria-current` 가 함께 든다.
 */
export function SegmentedNav({
  label,
  items,
}: {
  /** 보조기기가 읽는 이 줄의 이름 — 화면에는 안 선다 */
  label: string;
  items: readonly { readonly href: string; readonly text: string; readonly current: boolean }[];
}) {
  return (
    <nav
      aria-label={label}
      className={`grid gap-1 rounded-full bg-surface p-1 ring-1 ring-border ${
        items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
      }`}
    >
      {items.map((one) => (
        <Link
          key={one.href}
          href={one.href}
          aria-current={one.current ? 'page' : undefined}
          className={`flex min-h-11 flex-1 items-center justify-center rounded-full px-5 text-[15px] font-semibold transition-colors active:scale-[0.97] ${
            one.current ? 'bg-accent text-on-accent' : 'text-secondary hover:text-foreground'
          }`}
        >
          {one.text}
        </Link>
      ))}
    </nav>
  );
}
