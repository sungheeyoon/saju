'use server';

import { TOO_LONG_TEXT, checkBody, sendOutcomeOf, type SendOutcome } from '@/src/lib/chat';
import { rpcArgs } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';
import { refreshPaths } from '../../refresh';
import type { SaveResult } from '../../save-result';

/**
 * 채팅의 누름 셋 — 보내기 · 메시지를 고른 신고 · 읽음.
 *
 * **한도는 여기서 세지 않는다.** `send_chat_message` 가 계정 행을 잠그고 센다(ADR 0039 · 0091).
 * 함수가 값으로 내는 셋(`sent` · `closed` · `rate_limited`)은 방의 상태와 내 흐름이라 화면이
 * 사람에게 말해야 하므로 값 그대로 올리고, 던지는 것(로그인 · 정지 · 남의 방 · 본문의 모양)은
 * `userFacingDbMessage` 가 우리 문장만 옮긴다(ADR 0078).
 */

export type SendResult = { ok: true; outcome: SendOutcome } | { ok: false; message: string };

/** 방 안의 주소는 방마다 다르다 — 표에 미리 못 적고 목록과 그 방을 함께 무른다 */
const chatPaths = (matchId: string): readonly string[] => ['/me/chat', `/me/chat/${matchId}`];

export async function sendChatMessage(matchId: string, body: string): Promise<SendResult> {
  /*
    빈 본문과 너무 긴 본문은 앱이 먼저 막는다 — DB 도 막지만(`22023`) 그 문장은 일반 문장으로
    바뀌어 사람에게 뜻이 없다. 화면이 같은 검사를 하므로 여기 오는 일은 드물다.
  */
  const shape = checkBody(body);
  if (shape === 'too_long') return { ok: false, message: TOO_LONG_TEXT };
  if (shape === 'blank') {
    // DB 가 던지는 것과 같은 토막 — 우리 문장이 아니므로 일반 문장으로 바뀐다.
    return { ok: false, message: userFacingDbMessage({ message: 'chat: the body is blank', code: '22023' }, 'send_chat_message') };
  }

  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('send_chat_message', {
    p_match_id: matchId,
    p_body: body,
  });
  if (error) return { ok: false, message: userFacingDbMessage(error, 'send_chat_message') };

  const outcome = sendOutcomeOf(data);
  // 모르는 값은 성공으로 세우지 않는다 — 보냈다고 말했는데 목록에 없는 편이 더 나쁘다.
  if (outcome === null) return { ok: false, message: userFacingDbMessage({ message: `chat: unknown outcome ${String(data)}` }, 'send_chat_message') };

  refreshPaths(chatPaths(matchId));
  return { ok: true, outcome };
}

export async function reportChatMessage(
  messageId: string,
  reason: string,
  detail: string,
): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc(
    'report_chat_message',
    rpcArgs<'report_chat_message'>({
      p_message_id: messageId,
      p_reason: reason,
      // 빈 칸은 「안 적었다」다. 빈 문자열로 넘기면 「없음」이 두 값이 된다.
      p_detail: detail.trim() || null,
    }),
  );
  if (error) return { ok: false, message: userFacingDbMessage(error, 'report_chat_message') };

  /* 신고는 방을 닫지 않는다(PRD §7.1) — 새로고침할 화면이 없다 */
  return { ok: true };
}

export async function markChatRead(matchId: string): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('mark_chat_read', { p_match_id: matchId });
  if (error) return { ok: false, message: userFacingDbMessage(error, 'mark_chat_read') };

  refreshPaths(chatPaths(matchId));
  return { ok: true };
}
