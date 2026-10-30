import { useEffect, useState } from 'react';

import { answerCount, bellCount } from '@consent/counts';
import { readingCreditsLabel } from '@reading/notes';

import { supabase } from '@/auth/client';

export type Counts = { chat: number; requests: number; news: number; credits: string | null };

const NONE: Counts = { chat: 0, requests: 0, news: 0, credits: null };

/**
 * 탭의 딱지와 남은 풀이권 — 웹 머리글과 같은 문이다. 못 읽었으면 안 세운다(모르는 수를 세어 보게 하지 않는다).
 * 화면을 옮길 때마다 다시 센다.
 */
export function useCounts(pathname: string, enabled: boolean): Counts {
  const [counts, setCounts] = useState(NONE);

  useEffect(() => {
    if (!enabled || supabase === null) return;
    let watching = true;
    void Promise.all([
      supabase.rpc('unread_chat_count'),
      supabase.rpc('my_match_requests'),
      supabase.rpc('my_notifications'),
      supabase.rpc('my_reading_credits'),
    ]).then(([chat, requests, news, credits]) => {
      if (!watching) return;
      const left = credits.data?.[0]?.available;
      setCounts({
        chat: chat.error === null ? Number(chat.data ?? 0) : 0,
        requests: requests.error === null ? answerCount(requests.data ?? []) : 0,
        news: news.error === null ? bellCount((news.data ?? []).map((row) => ({ kind: row.kind, unread: row.read_at === null }))) : 0,
        credits: credits.error === null && left !== undefined ? readingCreditsLabel({ available: left }) : null,
      });
    });
    return () => {
      watching = false;
    };
  }, [pathname, enabled]);

  return counts;
}
