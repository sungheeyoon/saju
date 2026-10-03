'use client';

import { useEffect } from 'react';

/**
 * 주소의 `#` 이 가리키는 물음을 **펴서** 연다.
 *
 * 다른 화면이 `/help#credits` 처럼 물음 하나를 가리켜 올 수 있다. `<details>` 는 앵커로 와도 닫힌 채라, 물음 한 줄만 보이고
 * 답은 한 번 더 눌러야 한다. 스크립트가 없으면 닫힌 채로 그 줄까지만 내려간다 — 그것도 길은 된다.
 */
export function OpenHashed() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id === '') return;
      const details = document.getElementById(id)?.querySelector('details');
      if (details) details.open = true;
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
