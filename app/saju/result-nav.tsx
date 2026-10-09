'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from '../ui/icons';
import { reducedMotion } from '../ui/motion';

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
 *
 * **칸은 적어도 44px 폭이다**(`min-w-11`). 「운」은 글자 하나라 여백을 더해도 39.9px 이었다 — 손가락
 * 과녁에 못 미친다. 글자는 칸 가운데에 선다.
 *
 * **넘겨 볼 것이 남았으면 오른쪽 끝이 흐려진다.** 폰에서는 줄이 「운」 언저리에서 잘리는데 넘길 수 있다는 표시가
 * 없었다(2026-10-09 화면 갤러리 감사). 끝까지 넘기면 흐림이 걷힌다. **넓은 화면에서는 띠가 링크만큼의 폭이다** — 전폭
 * 띠에 링크가 왼쪽에 몰려 오른쪽이 빈 띠로 남았다.
 *
 * **흐림 끝에 셰브론이 선다**(2026-10-10 화면 점검 B14). 390px 에서 띠는 356px 인데 칸 일곱이 430px 이라 「운」 · 「보정」이
 * 넘치고, 흐림만으로는 「운」이 통째로 덮여 「관계」 뒤가 빈 끝으로 보였다. 흐림은 단색 띠 없이 옅어지기만 하고, 그 끝에 오른쪽
 * 셰브론을 세워 넘길 것이 있다고 말한다. **칸을 좁혀 한 줄에 우겨 넣지 않는다** — 그렇게 하면(#579) 칸이 꼭 44px 이 되어
 * 이웃 칸과 맞붙고, 손가락이 닿는 넓이가 44px 아래로 내려가 과녁 시험(`e2e/saju.spec.ts`)이 붉었다(#581).
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
  /* `behavior` 를 적으면 CSS 의 `scroll-behavior` 가 안 듣는다 — 줄인 움직임을 고른 사람은 여기서 묻는다 */
  place.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start' });
}

export function ResultNav() {
  const scroller = useRef<HTMLElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const nav = scroller.current;
    if (nav === null) return;
    /* 1px 는 반올림 몫이다 — 끝까지 넘겨도 소수점 폭 때문에 0 이 안 되는 브라우저가 있다 */
    const measure = () => setMore(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1);
    measure();
    nav.addEventListener('scroll', measure, { passive: true });
    const resized = new ResizeObserver(measure);
    resized.observe(nav);
    return () => {
      nav.removeEventListener('scroll', measure);
      resized.disconnect();
    };
  }, []);

  return (
    <div className="sticky top-20 z-20 -my-2 max-w-full sm:w-fit">
      <nav
        ref={scroller}
        aria-label="결과 바로가기"
        className="overflow-x-auto rounded-full border border-border bg-surface/95 p-1 shadow-card backdrop-blur"
      >
        <ul className="flex min-w-max items-center gap-0.5">
          {RESULT_LINKS.map(([target, label]) => (
            <li key={target}>
              <a
                href={`#${target}`}
                onClick={(event) => go(event, target)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full px-3.5 text-sm font-semibold text-secondary hover:bg-surface-sunken hover:text-foreground"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-px right-px flex w-12 items-center justify-end rounded-r-full bg-[linear-gradient(to_left,var(--surface)_40%,transparent)] pr-2.5 text-secondary transition-opacity duration-200 motion-reduce:transition-none ${
          more ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Icon name="chevron" className="size-4" />
      </span>
    </div>
  );
}
