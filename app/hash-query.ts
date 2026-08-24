'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';

/**
 * 제출된 입력을 주소창의 **`#` 뒤**에 싣는다.
 *
 * 여태 쿼리스트링이었다. 그러면 두 사람의 이름·생년월일시·성별·출생지가 HTTP 요청
 * 라인에 실려 **매 요청마다 서버 로그에 남고**, 카카오톡·슬랙에 링크를 붙여 넣으면
 * 그 서비스의 미리보기 크롤러가 URL 을 fetch 하면서 통째로 가져가고, 결과 화면에서
 * 외부 링크를 하나만 눌러도 `Referer` 로 새어 나간다.
 *
 * **fragment 는 HTTP 요청에 아예 포함되지 않는다.** 브라우저가 로컬에서만 쓴다.
 * 링크 공유는 그대로 되고 — 받은 쪽 브라우저가 `#` 뒤를 읽어 똑같이 계산한다 —
 * 서버도 크롤러도 못 본다. 익명 흐름은 브라우저가 계산하므로 서버는 이 값이 애초에
 * 필요 없다.
 *
 * 코덱(`app/query.ts`)은 한 줄도 바뀌지 않는다. 그쪽은 `URLSearchParams` 하나만
 * 알고, 그것이 `?` 에서 왔는지 `#` 에서 왔는지 모른다.
 *
 * ## 왜 `useSearchParams` 를 못 쓰나
 *
 * Next 라우터는 fragment 를 보지 않는다 — 서버로 가지 않는 값이므로 당연하다.
 * 그래서 구독을 직접 든다. `history.pushState`·`replaceState` 는 `popstate` 도
 * `hashchange` 도 **일으키지 않으므로**, 우리가 부른 것은 우리가 알린다(`notify`).
 * 밖에서 바뀌는 것(뒤로가기·주소창 편집)은 두 이벤트가 알린다.
 */

const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  window.addEventListener('hashchange', notify);
  window.addEventListener('popstate', notify);

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener('hashchange', notify);
    window.removeEventListener('popstate', notify);
  };
};

/**
 * 지금 주소가 든 입력 — **옛 `?` 링크도 읽는다.**
 *
 * `#` 이 비어 있고 `?` 에 값이 있으면 그것을 읽는다. 이미 뿌려진 링크를 깨뜨리지
 * 않으려는 것이지 **프라이버시를 위한 것이 아니다** — 그 링크가 열리는 한 번의
 * 요청에서 값은 이미 서버에 닿았고, 그건 되돌릴 수 없다.
 */
const readParams = (): string => {
  const hash = window.location.hash.slice(1);
  if (hash !== '') return hash;
  return window.location.search.slice(1);
};

/** 서버에는 주소창이 없다. 첫 렌더는 언제나 빈 입력이고 수화 뒤에 채워진다 */
const readNothing = (): string => '';

export function useHashParams(): URLSearchParams {
  const raw = useSyncExternalStore(subscribe, readParams, readNothing);

  /**
   * 옛 `?` 링크로 들어왔으면 주소만 `#` 으로 갈아 놓는다.
   *
   * 읽은 값이 같으므로 화면은 깜빡이지 않는다 — `readParams` 가 이미 `?` 를 읽어
   * 같은 문자열을 냈고, 바뀌는 것은 주소의 모양뿐이다. 그래서 이 사용자가 다음에
   * 복사하는 링크부터는 `#` 이다.
   */
  useEffect(() => {
    if (window.location.search === '' || window.location.hash !== '') return;
    const params = window.location.search.slice(1);
    window.history.replaceState(null, '', `${window.location.pathname}#${params}`);
  }, [raw]);

  return useMemo(() => new URLSearchParams(raw), [raw]);
}

/**
 * 제출된 입력을 주소에 싣는다.
 *
 * 첫 계산은 `push`, 이후 수정은 `replace` 다. 첫 계산에는 "빈 화면으로 되돌아간다"는
 * 뒤로가기가 있어야 하지만, 세운 연도를 몇 번 옮겼다고 뒤로가기를 그만큼 눌러야 하는
 * 것은 아니다.
 *
 * `?` 를 지운다 — 옛 링크에서 넘어온 경우 `pathname` 만 남기고 `#` 을 붙이므로,
 * 제출 한 번이면 주소에 쿼리스트링이 남지 않는다.
 */
export function writeParams(params: string, mode: 'push' | 'replace'): void {
  const url = `${window.location.pathname}#${params}`;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
  notify();
}
