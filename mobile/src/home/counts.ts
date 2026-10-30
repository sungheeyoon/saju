import { useEffect, useRef, useState } from 'react';

import { answerCount, bellCount } from '@consent/counts';
import { readingCreditsLabel } from '@reading/notes';

import { supabase } from '@/auth/client';
import { listenLive } from '@/chat/live';

export type Counts = { chat: number; requests: number; news: number; credits: string | null };

const NONE: Counts = { chat: 0, requests: 0, news: 0, credits: null };

/**
 * 탭의 딱지와 남은 풀이권 — 웹 머리글과 같은 문이다. 못 읽었으면 안 세운다(모르는 수를 세어 보게 하지 않는다).
 * 화면을 옮길 때마다, 그리고 계정 채널이 무엇이 바뀌었다고 할 때마다 다시 센다 — 어느 탭에 있든 딱지가 따라온다.
 */
export function useCounts(pathname: string, enabled: boolean): Counts {
  const [counts, setCounts] = useState(NONE);
  /* 늦게 온 답이 새 답을 덮지 않게 — 마지막 물음의 답만 받는다 */
  const asked = useRef(0);

  useEffect(() => {
    if (!enabled || supabase === null) return;
    const client = supabase;
    const count = () => {
      const mine = ++asked.current;
      void Promise.all([
        client.rpc('unread_chat_count'),
        client.rpc('my_match_requests'),
        client.rpc('my_notifications'),
        client.rpc('my_reading_credits'),
      ]).then(([chat, requests, news, credits]) => {
        if (mine !== asked.current) return;
        const left = credits.data?.[0]?.available;
        setCounts({
          chat: chat.error === null ? Number(chat.data ?? 0) : 0,
          requests: requests.error === null ? answerCount(requests.data ?? []) : 0,
          news: news.error === null ? bellCount((news.data ?? []).map((row) => ({ kind: row.kind, unread: row.read_at === null }))) : 0,
          credits: credits.error === null && left !== undefined ? readingCreditsLabel({ available: left }) : null,
        });
      });
    };

    count();
    const stop = listenLive(count);
    return () => {
      stop();
      asked.current += 1;
    };
  }, [pathname, enabled]);

  return counts;
}
