'use client';

import { useEffect, useState } from 'react';

import { supabaseInBrowser } from './browser-client';

/** 아직 모름 · 로그인함 · 안 함 — 모르는 동안은 어느 쪽 길도 세우지 않는다 */
export type BrowserSession = 'unknown' | 'in' | 'out';

/**
 * 브라우저가 아는 로그인 상태 — **길을 가리키는 값이지 문을 지키는 값이 아니다.**
 *
 * 쿠키를 그대로 읽고(`getSession`) 바뀌면 따라간다(`onAuthStateChange`). JWT 를 서버에 묻지 않는 것은 이 값으로
 * 무엇을 열고 닫지 않기 때문이다 — 볼 수 있는 것은 DB 정책이 정하고 `/me` 는 제 자리에서 다시 묻는다.
 *
 * 머리글(`site-header.tsx`)과 현관(`home-hero.tsx`)이 같은 읽기를 한 벌씩 따로 들고 있었다(2026-09-26). 한쪽만
 * 고쳐지면 두 자리가 잠깐 다른 답을 들고, 그 틈에 회원 화면에 「로그인」이 깜빡인다.
 */
export function useBrowserSession(): { session: BrowserSession; email: string | null } {
  const [state, setState] = useState<{ session: BrowserSession; email: string | null }>({
    session: 'unknown',
    email: null,
  });

  useEffect(() => {
    const supabase = supabaseInBrowser();
    let watching = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (watching) {
        setState({ session: data.session === null ? 'out' : 'in', email: data.session?.user.email ?? null });
      }
    });

    /* 톱니 메뉴나 계정 관리 화면에서 로그아웃하면 이 값을 읽는 자리가 바로 공개 모양으로 돌아간다 */
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setState({ session: next === null ? 'out' : 'in', email: next?.user.email ?? null });
    });

    return () => {
      watching = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
