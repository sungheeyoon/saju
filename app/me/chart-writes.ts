import 'server-only';

import type { Query } from '@/src/lib/input/query';

import { supabaseOnServer } from '../auth/server-client';
import { signedInUser } from '../auth/signed-in';
import * as keyed from './keyed-chart-writes';
import type { SelfSummary } from './summary';

/**
 * **웹이 부르는 풀 쓰기 — 쿠키의 사람으로.** 열쇠와 문 넷은 `keyed-chart-writes.ts` 하나가 들고, 여기는 세션을 묻는 길만 잇는다.
 * 앱의 문은 토큰으로 같은 함수를 부른다(`app/api/mobile`, ADR 0211). 이 파일은 관문 안에서만 닿는다(`app/auth/signed-in.boundary.test.ts`).
 */
export async function chartWriterOfCookies(): Promise<keyed.ChartWriter> {
  const client = await supabaseOnServer();
  return { client, sessionUserId: async () => (await signedInUser(client))?.id ?? null };
}

export const createSelfPerson = async (query: Query) => keyed.createSelfPerson(await chartWriterOfCookies(), query);

export const editPersonInput = async (personId: string, query: Query) =>
  keyed.editPersonInput(await chartWriterOfCookies(), personId, query);

export const setParticipation = async (on: boolean) => keyed.setParticipation(await chartWriterOfCookies(), on);

export const openParticipation = async (self: SelfSummary) => keyed.openParticipation(await chartWriterOfCookies(), self);
