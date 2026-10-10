'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** 가장자리 흐림의 폭 — 칸 하나의 반쯤이라 「더 있다」만 말하고 글을 가리지 않는다 */
const FADE = '1.75rem';

/**
 * 운 표의 가로 칸 — **열 때 지금 칸이 보이고, 더 밀 쪽의 가장자리가 흐리다.**
 *
 * 표가 폰 폭보다 넓어(`min-w-[52rem]`) 첫 칸부터 열면 올해 · 지금 대운은 화면 밖이었다. 표를 처음 펼 때 한 번
 * `data-current` 칸을 가운데로 민다 — 그 뒤에는 사람이 민 자리를 건드리지 않는다. 접이칸(`<details>`)이 닫힌 채
 * 그려지면 폭이 0 이라 밀 수 없으므로, 폭이 처음 생길 때 민다.
 *
 * 흐림은 `mask-image` 다 — 바탕색을 덮는 그림이 아니라서 어느 바탕 · 어느 테마에서도 같다. 문구를 더하지 않는다.
 */
export function CurrentScroll({ children }: { readonly children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const scroller = ref.current;
    if (scroller === null) return;
    let placed = false;

    const measure = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      setEdges({ start: scroller.scrollLeft > 1, end: scroller.scrollLeft < max - 1 });
    };
    const place = () => {
      if (placed || scroller.clientWidth === 0) return;
      placed = true;
      const current = scroller.querySelector<HTMLElement>('[data-current]');
      if (current === null) return;
      const box = scroller.getBoundingClientRect();
      const cell = current.getBoundingClientRect();
      scroller.scrollLeft += cell.left - box.left - (box.width - cell.width) / 2;
    };

    const observer = new ResizeObserver(() => {
      place();
      measure();
    });
    observer.observe(scroller);
    scroller.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', measure);
    };
  }, []);

  const mask =
    edges.start || edges.end
      ? `linear-gradient(to right, ${edges.start ? 'transparent' : '#000'}, #000 ${FADE}, #000 calc(100% - ${FADE}), ${
          edges.end ? 'transparent' : '#000'
        })`
      : undefined;

  return (
    <div
      ref={ref}
      className="mt-4 snap-x snap-proximity overflow-x-auto"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  );
}
