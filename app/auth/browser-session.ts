'use client';

import { useEffect, useState } from 'react';

import { supabaseInBrowser } from './browser-client';

/** 아직 모름 · 로그인함 · 안 함 — 모르는 동안은 어느 쪽 길도 세우지 않는다 */
export type BrowserSession = 'unknown' | 'in' | 'out';

/**
 * `userId` 는 라이브 층(`app/live/`)이 계정의 채널을 고르는 값이다 — 바뀌면(계정 전환 · 로그아웃) 채널을 걷는다.
 */
export type BrowserSessionState = {
  readonly session: BrowserSession;
  readonly email: string | null;
  readonly userId: string | null;
};

const stateOf = (session: { user: { id: string; email?: string } } | null): BrowserSessionState => ({
  session: session === null ? 'out' : 'in',
  email: session?.user.email ?? null,
  userId: session?.user.id ?? null,
});

/**
 * 브라우저가 아는 로그인 상태 — **길을 가리키는 값이지 문을 지키는 값이 아니다.**
 *
 * 쿠키를 그대로 읽고(`getSession`) 바뀌면 따라간다(`onAuthStateChange`). JWT 를 서버에 묻지 않는 것은 이 값으로
 * 무엇을 열고 닫지 않기 때문이다 — 볼 수 있는 것은 DB 정책이 정하고 `/me` 는 제 자리에서 다시 묻는다.
 *
 * 머리글(`site-header.tsx`)과 현관(`home-hero.tsx`)이 같은 읽기를 한 벌씩 따로 들고 있었다(2026-09-26). 한쪽만
 * 고쳐지면 두 자리가 잠깐 다른 답을 들고, 그 틈에 회원 화면에 「로그인」이 깜빡인다.
 */
export function useBrowserSession(): BrowserSessionState {
  const [state, setState] = useState<BrowserSessionState>({ session: 'unknown', email: null, userId: null });

  useEffect(() => {
    const supabase = supabaseInBrowser();
    let watching = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (watching) {
        setState(stateOf(data.session));
      }
    });

    /* 톱니 메뉴나 계정 관리 화면에서 로그아웃하면 이 값을 읽는 자리가 바로 공개 모양으로 돌아간다 */
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setState((now) => {
        const after = stateOf(next);
        // 토큰만 새로 났으면 같은 값이다 — 이 값을 읽는 자리(라이브 층의 채널)가 다시 열리지 않게 그대로 둔다.
        return after.session === now.session && after.email === now.email && after.userId === now.userId ? now : after;
      });
    });

    return () => {
      watching = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
