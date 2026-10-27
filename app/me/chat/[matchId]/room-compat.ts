import type { SupabaseClient } from '@supabase/supabase-js';

import { rpcArgs, type Database } from '@/src/lib/db';

import { read, unread, type SkippableRead } from '../../../db-error';
import { readingTargetArgs } from '../../reading/target';

/**
 * **방 머리의 궁합 단추가 드는 상태** — 그 Match 의 인연 궁합이 지금 어디까지 왔나(ADR 0155 「2026-10-11 저녁 덧」).
 *
 * - `ready` — 글이 섰다. 점수는 인연 궁합 화면의 「궁합풀이 점수」와 **같은 칸**(`my_reading` 의 `score`)이다 — 지어내지 않는다
 * - `making` — 도는 시도가 있다(수락이 연 자동 생성 · 누가 다시 받기를 누른 것)
 * - `failed` — 글이 없고 마지막 시도가 실패했다. 인연 궁합 화면에 「궁합풀이 받기」가 서 있다(ADR 0038)
 * - `quiet` — 말할 것이 없다: 못 읽었거나, 글도 시도도 없는 옛 Match 이거나, 점수가 없는 글이다. 단추는 이름만 선다
 */
export type RoomCompat =
  | { readonly kind: 'ready'; readonly score: number }
  | { readonly kind: 'making' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'quiet' };

/**
 * **시트의 궁합 한 줄이 보이는 글자**(`CompatRow`) — 왼쪽 낱말들(「궁합」 · 「82점」 · 「만드는 중…」)과 오른쪽 끝 글자(볼 풀이가 있으면
 * 「궁합풀이 보기」, 실패면 「다시 받기」). 읽는 이름(`name`)은 보이는 글자를 차례대로 이은 것이다 — 음성으로 누르는 사람이 보이는 글자로
 * 부를 수 있게(WCAG 2.5.3). 아이콘 · 「›」는 글자가 아니다.
 */
export function compatRowParts(compat: RoomCompat): { lead: readonly string[]; tail: string | null; name: string } {
  const lead =
    compat.kind === 'ready' ? ['궁합', `${compat.score}점`] : compat.kind === 'making' ? ['궁합', '만드는 중…'] : ['궁합'];
  const tail = compat.kind === 'ready' ? '궁합풀이 보기' : compat.kind === 'failed' ? '다시 받기' : null;
  return { lead, tail, name: [...lead, ...(tail === null ? [] : [tail])].join(' ') };
}

/** 읽은 글 — 없으면 `null` */
type ReadingSeen = { readonly score: number | null } | null;

/** 마지막 시도의 상태 — 시도가 없으면 `null` */
type RunSeen = string | null;

/**
 * 두 읽기를 단추의 상태 하나로 접는다. **글이 이긴다** — 글이 있는 인연 궁합에는 다시 받기가 없어(ADR 0038) 뒤의 시도가 없다.
 * 글을 못 읽은 날은 시도만으로 「실패」를 말하지 않는다 — 글이 있는데 못 읽은 것일 수 있다.
 */
export function roomCompatOf(reading: SkippableRead<ReadingSeen>, run: SkippableRead<RunSeen>): RoomCompat {
  if (!reading.ok) return { kind: 'quiet' };
  if (reading.value !== null) {
    return reading.value.score === null ? { kind: 'quiet' } : { kind: 'ready', score: reading.value.score };
  }
  if (!run.ok) return { kind: 'quiet' };
  if (run.value === 'running') return { kind: 'making' };
  if (run.value === 'failed') return { kind: 'failed' };
  return { kind: 'quiet' };
}

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
