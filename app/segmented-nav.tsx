import Link from 'next/link';

/**
 * 한 덩이 토글로 선 **화면 사이의 길** — 앱에 이 모양 하나다.
 *
 * 두 화면이 짝을 이루는 자리가 둘 있다. 한 사람의 사주와 풀이(`ReadingTabs`), 그리고
 * 사주와 궁합(`SajuCompatTabs`). 둘 다 **탭이 아니라 링크**다 — 각자 주소를 가지므로
 * 목록에서 곧장 들어올 수 있고 뒤로가기도 지나온 화면을 그대로 따른다.
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

/**
 * 사주와 궁합 — **한 탭의 두 화면을 오가는 자리.**
 *
 * 여기 버튼이 있었다. `/` 의 머리에 「궁합 보러 가기」가 서고 `/compat` 의 머리에는
 * 「사주 보러 가기」가 섰는데, 궁합 쪽을 걷으면서(입력칸 바로 위에서 사람을 다른
 * 화면으로 내보내는 길이었다) **돌아오는 길도 함께 없어졌다.**
 *
 * 버튼으로 되돌리지 않는다. 두 화면은 위아래가 아니라 **나란한 짝**이고, 그 관계를
 * 말하는 부품은 「가는 버튼」이 아니라 **지금 어디에 있는지 함께 보여 주는 토글**이다.
 * 한 사람의 사주와 풀이가 이미 같은 모양으로 서 있다(`ReadingTabs`).
 *
 * **회원에게만 세운다.** 궁합은 로그인이 필요하므로(PRD §3.1) 로그인하지 않은 사람에게
 * 이 토글은 누를 수 없는 반쪽을 들고 서는 줄이 된다. 그 사람에게는 현관이 「궁합 보러
 * 가기 · 로그인 필요」로 말한다(`compat-entry.tsx`).
 */
export function SajuCompatTabs({ current }: { current: 'saju' | 'compat' }) {
  return (
    <SegmentedNav
      label="사주와 궁합"
      items={[
        { href: '/', text: '사주', current: current === 'saju' },
        { href: '/compat', text: '궁합', current: current === 'compat' },
      ]}
    />
  );
}
