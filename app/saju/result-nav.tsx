'use client';

/**
 * 결과 바로가기 — **화면에 선 차례와 같다.**
 *
 * 다르면 이 줄은 목차가 아니라 또 하나의 메뉴가 된다. 신살이 위로 올라갔으므로 여기서도 위로 온다.
 *
 * ## 왜 브라우저로 가나
 *
 * 둘이다. 하나는 **주소의 `#` 뒤가 이 화면의 입력**이라는 것이다(`app/hash-query.ts`). 링크를 그대로 따라가면
 * 주소가 `#stars` 가 되고, 계산기는 그것을 빈 입력으로 읽어 방금 선 결과를 걷는다. 다른 하나는 5차에서 분석
 * 표가 **접혀 선다**는 것이다(`fold.tsx`) — 접힌 칸으로 옮기기만 하면 제목 한 줄에 닿고 끝난다. 그래서 누르면
 * 목적지 안의 접이칸을 열고, 주소를 건드리지 않고 스크롤만 한다. 자바스크립트가 없으면 링크가 제 일을 한다.
 */
const RESULT_LINKS = [
  ['chart', '여덟 글자'],
  ['stars', '신살'],
  ['analysis', '분석'],
  ['yongsin', '용신'],
  ['relations', '관계'],
  ['fortune', '운'],
  ['corrections', '보정'],
] as const;

function go(event: React.MouseEvent<HTMLAnchorElement>, target: string) {
  const place = document.getElementById(target);
  if (place === null) return;
  event.preventDefault();
  const folds =
    place instanceof HTMLDetailsElement
      ? [place]
      : [...place.querySelectorAll<HTMLDetailsElement>('details[data-fold]')];
  for (const fold of folds) fold.open = true;
  place.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function ResultNav() {
  return (
    <nav
      aria-label="결과 바로가기"
      className="sticky top-20 z-20 -my-2 overflow-x-auto rounded-full border border-border bg-surface/95 p-1 shadow-[var(--shadow-card)] backdrop-blur"
    >
      <ul className="flex min-w-max items-center gap-0.5">
        {RESULT_LINKS.map(([target, label]) => (
          <li key={target}>
            <a
              href={`#${target}`}
              onClick={(event) => go(event, target)}
              className="flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold text-secondary hover:bg-surface-sunken hover:text-foreground"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
