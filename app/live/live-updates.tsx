'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { supabaseInBrowser } from '../auth/browser-client';
import { useBrowserSession } from '../auth/browser-session';
import { announceChatMoved } from '../me/chat/chat-signal';
import { ALL_SIGNALS, redrawsOn, redrawsOnResync, signalsOf, type LiveChange } from './changes';
import { closeUserChannel, openUserChannel } from './channel';
import { startRunner } from './runner';

/** 한 물결의 변경을 묶어 다시 그리는 간격 — 메시지 몇 개가 이어 와도 화면은 한 번 다시 그린다 */
const REDRAW_AFTER_MS = 400;

const shown = (): boolean => document.visibilityState === 'visible';

const announce = (signals: readonly string[]) => {
  for (const name of signals) window.dispatchEvent(new Event(name));
};

/**
 * **라이브 층 — 앱 전체에 채널 하나**(ADR 0156). 루트 레이아웃에 서고 그리는 것은 없다.
 *
 * 로그인이 확인되면 그 계정의 채널 하나를 열고, 계정이 바뀌거나 로그아웃하면 걷는다. 받은 「바뀌었다」를 지금 있는
 * 창 신호로 옮기고(머리글의 딱지 넷 · 방과 목록의 채팅 신호), 서버가 그리는 목록 화면은 그 갈래가 바뀌었을 때만
 * 묶어서 한 번 다시 그린다(`router.refresh()` — 쓰던 입력과 스크롤은 그대로다). 끊김 · 복귀 · 토큰 갱신의 다시
 * 대조와 대체 조회는 상태(`connection.ts`)가 정한다.
 */
export function LiveUpdates() {
  const { userId } = useBrowserSession();
  const router = useRouter();
  const pathname = usePathname();

  /* 채널은 주소가 바뀌어도 그대로다 — 다시 그릴지는 사건이 온 그때의 주소로 정한다 */
  const here = useRef(pathname);
  useEffect(() => {
    here.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (userId === null) return;

    const client = supabaseInBrowser();
    let channel: RealtimeChannel | null = null;
    /* 걷은 채널의 늦은 콜백(우리가 걷어 생긴 `CLOSED` 포함)을 버리는 표 */
    let generation = 0;
    let redrawTimer: ReturnType<typeof setTimeout> | null = null;

    const redraw = () => {
      // 숨은 화면은 다시 그리지 않는다 — 돌아오면 다시 대조가 한 번 그린다.
      if (!shown()) return;
      if (redrawTimer !== null) clearTimeout(redrawTimer);
      redrawTimer = setTimeout(() => {
        redrawTimer = null;
        /*
          끊긴 동안은 다시 그리지 않는다 — Next 는 화면 조각을 못 받으면 페이지 이동으로 물러서고, 끊긴 망에서 그 이동은
          브라우저의 오프라인 화면이 된다(2026-10-08 e2e 에서 잼). 망이 돌아오면(`online`) 다시 대조가 한 번 그린다.
        */
        if (!shown() || !navigator.onLine) return;
        router.refresh();
      }, REDRAW_AFTER_MS);
    };

    const heard = (change: LiveChange) => {
      announce(signalsOf(change.area));
      if (change.area === 'chat') announceChatMoved({ matchId: change.matchId, seq: change.seq });
      if (redrawsOn(change.area, here.current)) redraw();
    };

    const resync = () => {
      announce(ALL_SIGNALS);
      announceChatMoved({ matchId: null, seq: null });
      if (redrawsOnResync(here.current)) redraw();
    };

    const leave = () => {
      generation += 1;
      if (channel !== null) void closeUserChannel(client, channel);
      channel = null;
    };

    const join = () => {
      leave();
      const mine = generation;
      void openUserChannel(client, userId, {
        change: (change) => {
          if (mine === generation) heard(change);
        },
        status: (status) => {
          if (mine !== generation) return;
          runner.feed(status === 'SUBSCRIBED' ? { type: 'subscribed' } : { type: 'failed' });
        },
      }).then((opened) => {
        if (opened === null) return;
        if (mine === generation) channel = opened;
        else void closeUserChannel(client, opened);
      });
    };

    const runner = startRunner({ resync, rejoin: join }, shown());
    join();

    const onVisibility = () => runner.feed({ type: shown() ? 'visible' : 'hidden' });
    const onOnline = () => runner.feed({ type: 'online' });
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) runner.feed({ type: 'restored' });
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('pageshow', onPageShow);
    const { data: auth } = client.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') runner.feed({ type: 'token-refreshed' });
    });

    return () => {
      runner.stop();
      leave();
      if (redrawTimer !== null) clearTimeout(redrawTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onPageShow);
      auth.subscription.unsubscribe();
    };
  }, [userId, router]);

  return null;
}
