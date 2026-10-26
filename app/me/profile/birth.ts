import { storedChartOf } from '@/src/lib/input/stored';
import type { Query } from '@/src/lib/input/query';

import type { supabaseOnServer } from '../../auth/server-client';
import { myEdge } from '../home/circle';
import { storedInputOf } from '../person-input';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/**
 * 프로필 수정 화면의 **출생 정보** — 저장된 내 사주의 입력(2026-10-26 운영자 「생일 · 닉네임 등 고치기를 프로필 고치기 한 곳에」).
 *
 * 홈 카드가 읽는 것과 같은 두 문이다 — 내 엣지(부를 이름)와 내 Person 의 입력(`storedInputOf`), 그 둘로 같은 함수(`storedChartOf`)가
 * 고칠 폼의 지금 값(`Query`)을 짓는다. 고치는 일은 홈 카드의 연필이 열던 폼(`EditInputForm`, 확인 창 · 재계산 안내 그대로)이 한다.
 *
 * - `none` — 아직 내 사주를 등록하지 않았다(온보딩 전). 이 화면은 그 칸을 안 세운다 — 등록은 홈이 이끈다
 * - `unreadable` — 저장된 값을 이 앱이 못 읽는다. 메우지 않고 그렇게 말한다(홈 카드와 같은 문장)
 */
export type MyBirth =
  | { readonly kind: 'none' }
  | { readonly kind: 'unreadable'; readonly message: string }
  | { readonly kind: 'ready'; readonly personId: string; readonly query: Query };

export async function myBirth(supabase: ServerClient, selfPersonId: string | null): Promise<MyBirth> {
  if (selfPersonId === null) return { kind: 'none' };
  const [edge, stored] = await Promise.all([myEdge(supabase, selfPersonId), storedInputOf(supabase, selfPersonId)]);
  if (edge === null || stored === null) return { kind: 'none' };
  const stood = storedChartOf(stored.input, edge.label);
  return stood.ok ? { kind: 'ready', personId: selfPersonId, query: stood.query } : { kind: 'unreadable', message: stood.message };
}
