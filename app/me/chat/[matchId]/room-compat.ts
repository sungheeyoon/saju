import type { SupabaseClient } from '@supabase/supabase-js';

import { roomCompatOf, type ReadingSeen, type RoomCompat, type RunSeen } from '@/src/lib/chat/room/compat';
import { rpcArgs, type Database } from '@/src/lib/db';

import { read, unread, type SkippableRead } from '../../../db-error';
import { readingTargetArgs } from '../../reading/target';

/**
 * 그 방의 궁합 상태 — **꾸밈이다.** 못 읽으면 단추는 이름만 서고 방은 그대로 열린다(ADR 0078). 결과 화면과 같은 두 문
 * (`my_reading` · `my_last_reading_run`)을 같은 대상으로 부른다 — 열린 방은 결과 화면도 열 수 있는 Match 다(`visible_matches()`).
 *
 * 대화 중에 시작하거나 끝나면 새로 읽힌다 — 시도가 서거나 끝나면 두 사람의 채널에 `requests` 가 오고
 * (`tell_match_reading_started` · `tell_match_reading_settled`), 라이브 층이 대화방을 다시 그린다(`app/live/changes.ts` 의 `redrawsOn`).
 *
 * 방은 말 한 통마다 다시 그려지므로 `my_reading` 은 **점수 칸만** 받는다 — 글 본문 · 피드백을 실어 나르지 않는다. 문 안의
 * 계산은 그대로다(`security definer` 라 바깥 select 가 문 안으로 내려가지 않는다).
 */
export async function roomCompatForViewer(supabase: SupabaseClient<Database>, matchId: string): Promise<RoomCompat> {
  const target = readingTargetArgs({ kind: 'match', matchId });
  const [reading, run] = await Promise.all([
    supabase.rpc('my_reading', rpcArgs<'my_reading'>(target)).select('score'),
    supabase.rpc('my_last_reading_run', rpcArgs<'my_last_reading_run'>(target)),
  ]);

  const row = (reading.data ?? [])[0];
  const readingSeen: SkippableRead<ReadingSeen> = reading.error
    ? unread(reading.error, 'my_reading')
    : read(row === undefined ? null : { score: row.score ?? null });
  const runSeen: SkippableRead<RunSeen> = run.error
    ? unread(run.error, 'my_last_reading_run')
    : read((run.data ?? [])[0]?.status ?? null);

  return roomCompatOf(readingSeen, runSeen);
}

export type { RoomCompat };
