import type { SupabaseClient } from '@supabase/supabase-js';

import { rpcArgs, type Database } from '@/src/lib/db';
import type { TasteKey } from '@/src/lib/reading/taste';

import { read, unread, type SkippableRead } from './db-error';

/**
 * **미리 만든 맛보기 한 칸을 읽는 문** — 로그인 전 첫 화면이 브라우저에서 부른다(ADR 0129).
 *
 * 보내는 것은 열쇠(`丙午-卯`) 하나다. 생년월일시 · 이름은 안 나간다 — 열쇠는 브라우저가 엔진으로 계산한다
 * (`src/lib/reading/taste.ts`). 문(`taste_passage`)은 익명에게 열려 있고 검사를 지난 글 하나만 낸다.
 *
 * 클라이언트를 **받기만** 한다 — `/` 는 빌드 때 미리 그려지는 공개 화면이라 브라우저가 부른다(`self-person-state.ts` 와 같은 결).
 *
 * @returns 글이 있으면 그 글, 아직 없으면 `null`. **못 읽었으면 `{ ok: false }`** — 맛보기는 부속 정보라(ADR 0078)
 *   화면은 오류를 세우지 않고 엔진의 문장으로 선다. 빈 칸과 같은 모양으로 서지만 실패는 기록에 남는다.
 */
export async function tastePassage(
  supabase: SupabaseClient<Database>,
  key: TasteKey,
): Promise<SkippableRead<string | null>> {
  const { data, error } = await supabase.rpc('taste_passage', rpcArgs<'taste_passage'>({ p_key: key }));
  if (error !== null) return unread(error, 'taste_passage');
  return read(data);
}
