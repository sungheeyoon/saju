import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { LIVE_EVENT, liveChangeOf, userTopic, type LiveChange } from '@live/changes';
import { startRunner } from '@live/runner';

import { supabase } from '@/auth/client';
import { settled } from '@/ui/settled';

/**
 * 라이브 신호 — 채널의 한 건이거나, 무엇이 바뀌었는지 모르는 다시 대조(`resync`). 화면은 이것을 듣고 읽는 문을 다시 부른다.
 */
export type LiveSignal = { readonly kind: 'change'; readonly change: LiveChange } | { readonly kind: 'resync' };

const listeners = new Set<(signal: LiveSignal) => void>();

export function listenLive(listener: (signal: LiveSignal) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const tell = (signal: LiveSignal) => {
  for (const listener of listeners) listener(signal);
};

const shown = (): boolean => AppState.currentState === 'active';

/**
 * **계정 채널 하나** — 웹의 `app/live/live-updates.tsx` 를 앱으로 옮겼다(ADR 0155). 재접속 · 뒤물림 · 30초 대체 조회는 웹과 같은 상태(`@live/connection`)가
 * 정한다. 문서의 보임 대신 `AppState` 다 — 앞으로 돌아오면 `visible` 이 들어가 끊겼으면 다시 붙고, 어느 쪽이든 다시 맞춘다. 망이 돌아온 신호는
 * 기기 망 패키지 없이 뒤물림과 대체 조회가 메운다.
 *
 * 구독 전에 `realtime.setAuth()` 를 부른다 — 비공개 채널의 권한은 구독할 때의 토큰으로 판정한다.
 */
export function LiveChannel() {
  useEffect(() => {
    const client = supabase;
    if (client === null) return;
    let stopped = false;
    let stop = () => {};

    void settled(client.auth.getSession(), 'live session', () => null).then((answer) => {
      const userId = answer?.data.session?.user.id;
      if (stopped || userId === undefined) return;

      let channel: RealtimeChannel | null = null;
      /* 걷은 채널의 늦은 콜백(우리가 걷어 생긴 `CLOSED` 포함)을 버리는 표 */
      let generation = 0;

      const leave = () => {
        generation += 1;
        if (channel !== null) void client.removeChannel(channel);
        channel = null;
      };

      const join = () => {
        leave();
        const mine = generation;
        void client.realtime
          .setAuth()
          .then(() => {
            if (mine !== generation) return;
            channel = client
              .channel(userTopic(userId), { config: { private: true } })
              .on('broadcast', { event: LIVE_EVENT }, (message: { payload?: unknown }) => {
                const change = liveChangeOf(message.payload);
                if (change !== null && mine === generation) tell({ kind: 'change', change });
              })
              .subscribe((status) => {
                if (mine !== generation) return;
                runner.feed(status === 'SUBSCRIBED' ? { type: 'subscribed' } : { type: 'failed' });
              });
          })
          .catch(() => {
            /* 토큰을 못 얻었다 — 구독해도 거절된다. 실패로 세고 뒤물림이 다시 연다 */
            if (mine === generation) runner.feed({ type: 'failed' });
          });
      };

      const runner = startRunner({ resync: () => tell({ kind: 'resync' }), rejoin: join }, shown());
      join();

      const appState = AppState.addEventListener('change', () => runner.feed({ type: shown() ? 'visible' : 'hidden' }));
      const { data: auth } = client.auth.onAuthStateChange((event) => {
        if (event === 'TOKEN_REFRESHED') runner.feed({ type: 'token-refreshed' });
      });

      stop = () => {
        runner.stop();
        leave();
        appState.remove();
        auth.subscription.unsubscribe();
      };
    });

    return () => {
      stopped = true;
      stop();
    };
  }, []);

  return null;
}
