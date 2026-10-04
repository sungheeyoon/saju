'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';

import type { BrowserSession } from './auth/browser-session';

/**
 * 로그인했는가 — **화면 하나가 한 번 읽어 아래로 흘려보내는 값.**
 *
 * 계산기의 버튼 · 안내 · 결과(`saju-calculator.tsx`)가 이 값으로 갈린다. 값은 그 계산기를 품은 화면(`/` 의 `home-hero.tsx` ·
 * `/saju` 의 `saju-hero.tsx`)이 한 번 읽어 내려보낸다 — 저마다 `getSession()` 을 부르면 잠깐 서로 다른 답을 들고, 그 틈에
 * 회원의 화면 위에 로그인 전 문구가 한 번 깜빡인다.
 *
 * ## 왜 prop 이 아니라 context 인가
 *
 * 계산기는 `Suspense` 뒤에 산다. 그 경계를 **서버 컴포넌트가 세워야** 한다 — 거기서
 * 세우면 미리 그려진 HTML 이 경계를 들고 오고, 브라우저는 그 자리를 이어받는다.
 * 경계를 클라이언트 컴포넌트 안으로 들이면 같은 나무를 양쪽이 한 번씩 세우게 되고,
 * 여럿이 한꺼번에 두드릴 때 **폼이 두 벌 서는 것을 실제로 봤다.**
 *
 * 그래서 계산기는 `page.tsx` 가 만든 그대로 두고, 값만 이 통로로 내려보낸다. prop 은
 * 만드는 쪽이 아는 값이어야 하는데 `page.tsx` 는 서버라 세션을 모른다 — 알면 안 되는
 * 쪽이기도 하다(이 화면은 빌드 때 미리 그려진다).
 *
 * **통로는 세 값을 든다** — 모름 · 로그인함 · 안 함(`useBrowserSession`). 모르는 동안 `useSignedIn()` 은 `false` 다. 이 값으로
 * 문을 열고 닫지 않는다. 정하는 것은 「어느 쪽으로 가는 길을 보일까」뿐이고, 모르는 동안 세우는 얼굴은 현관이다.
 *
 * **다만 서버로 무언가를 보내는 자리는 「모름」을 「안 함」으로 읽지 않는다** — `useSessionKnown()`. 로그인 전 사주
 * 문단(`taste.tsx`)은 입력을 서버로 보내 예약 · 모델 호출까지 가므로, 모르는 동안 세우면 회원의 입력이 한 번 나간다.
 * 한 시간이 지나 돌아온 회원은 브라우저가 토큰을 새로 받는 동안 세션을 모른다 — 그 틈에 실제로 나갔다(2026-10-03,
 * `e2e/signed-in.spec.ts`).
 *
 * 통로 밖(공급자 없음)의 기본값은 「안 함」이다 — 전과 같다.
 */
const SignedIn = createContext<BrowserSession>('out');

export const SignedInProvider = SignedIn.Provider;

/**
 * **붙기 전에는 참을 말하지 않는다.**
 *
 * `Suspense` 뒤는 늦게 붙는다. 그런데 붙을 때쯤이면 세션은 이미 정해져 있어서, 그냥
 * 통로 값을 읽으면 **첫 클라이언트 렌더가 서버 HTML 과 어긋난다** — 서버는 「내 사주
 * 먼저 살펴보기」를 찍어 보냈는데 브라우저는 「이 사람 명식 보기」를 그린다.
 *
 * 어긋나면 React 는 경고만 하고 마는 게 아니라 **그 경계의 DOM 을 버리고 다시 짓는다.**
 * 폼이 그 안에 있으므로, 붙기를 기다리지 않고 이름을 치기 시작한 사람은 **자기가 친
 * 글자를 잃는다.** 검사에서 먼저 걸렸지만 사람에게도 똑같이 일어나는 일이다.
 *
 * 그래서 첫 렌더는 서버가 보낸 답(`false`)을 그대로 되풀이하고, 붙고 나서 한 번 바꾼다.
 * 값이 늦게 오는 것은 이 화면이 이미 곳곳에서 치르는 값이다(`home-hero.tsx`).
 */
export function useSignedIn(): boolean {
  const session = useContext(SignedIn);
  return useSyncExternalStore(never, attached, notYet) && session === 'in';
}

/**
 * 로그인했는지 **안다** — 붙었고, 세션 읽기가 답했다. 서버로 무언가를 보내기 전에 본다(위 「다만 서버로…」).
 */
export function useSessionKnown(): boolean {
  const session = useContext(SignedIn);
  return useSyncExternalStore(never, attached, notYet) && session !== 'unknown';
}

/**
 * 붙었는가를 묻는 한 벌 — **바뀌지 않는 값이라 구독할 것이 없다.**
 *
 * `useSyncExternalStore` 는 서버용 답과 브라우저용 답을 따로 받는다. 하이드레이션
 * 동안에는 서버 쪽 답을 쓰고, 붙고 나서 브라우저 쪽으로 한 번 갈아탄다 — 우리가
 * 필요한 것이 정확히 그 한 번이다. 효과 안에서 `setState` 를 부르는 것보다 이쪽이
 * 맞는 연장이고(검사기도 그쪽을 막는다), 「한 번 바뀌고 끝」이라는 뜻이 코드에 남는다.
 */
const never = () => () => {};
const attached = () => true;
const notYet = () => false;
