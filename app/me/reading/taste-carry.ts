import { selfPersonIdOf } from '@/src/lib/account';
import { storedChartOf } from '@/src/lib/input/stored';
import type { TasteRunCarry } from '@/src/lib/reading/continuation';

import { supabaseOnServer } from '../../auth/server-client';
import { claimTasteSession, tasteContinuationOfRun, type TasteClaim } from '../keyed-taste-claims';
import { tasteFingerprintOfSaju } from '../../taste-run';
import { browserHmacNow, claimedTasteSessionId } from '../../taste-visitor';
import { readAccount } from '../account';
import { storedInputOf } from '../person-input';
import type { CurrentReading } from './current';

/**
 * **가입 뒤 자기 풀이가 맛보기를 잇는 자리** — 「아까 보던 내용」을 무엇으로 세우고, 누름이 어느 세션을 잇는가(ADR 0143 의 2 · 4).
 *
 * 귀속은 「이 사주가 내 사주 맞나요?」가 했다(`claimTaste`, `app/actions.ts`). 그때 선 표(`TASTE_CLAIM_COOKIE`)가 「다음 누름은
 * 이 세션을 잇는다」이고, 여기서 그 표를 DB 에 다시 맞춰 본다 — **지금 저장된 내 사주**로 지문을 다시 재서. 입력을 그 사이에
 * 고쳤으면 DB 가 버림(`discarded`)으로 답하고 이어쓰기는 없다.
 *
 * 이어진 풀이가 서면 그 뒤로는 표가 아니라 **풀이 시도**가 답한다 — 결과 화면은 그 글을 만든 시도에 이어진 스냅숏을 읽는다
 * (`taste_continuation_of_run`). 그래서 다른 기기에서 열어도 완성된 글 위의 「아까 보던 내용」은 선다.
 */

/**
 * 화면에 서는 「아까 보던 내용」 — 글은 **저장된 스냅숏 원문**이다.
 *
 * - `next` — 붙인 세션이 아직 풀이에 안 이어졌다(또는 이어진 풀이가 실패했다). 다음 누름이 잇는다
 * - `running` — 이어진 풀이가 만들어지는 중이다
 * - `shown` — 지금 서 있는 글이 그 세션을 이은 풀이다. 새로 받으면(다시 받기) 그 풀이는 보통 풀이라 이 칸이 내려간다
 */
export type TasteCarryView = { readonly preview: string; readonly state: 'next' | 'running' | 'shown' };

/**
 * 지금 저장된 내 사주의 근거 지문 — 못 읽으면 `null`. 귀속(`claimTaste`, `app/actions.ts`)과 이 파일의 다시 맞추기가 같은
 * 길로 잰다 — 클라이언트가 들고 온 입력이 아니라 서버에 저장된 입력이다.
 */
export async function selfTasteFingerprint(): Promise<string | null> {
  const supabase = await supabaseOnServer();
  const { state } = await readAccount(supabase);
  const personId = selfPersonIdOf(state);
  if (personId === null) return null;
  const stored = await storedInputOf(supabase, personId);
  if (stored === null) return null;
  const chart = storedChartOf(stored.input, '나');
  return chart.ok ? tasteFingerprintOfSaju(chart.saju) : null;
}

/**
 * 귀속 표가 가리키는 세션을 다시 맞춰 본 답 — 표가 없으면 `null`.
 *
 * - `TasteClaim` — DB 가 답했다
 * - `gone` — 이 브라우저의 쿠키나 서버의 비밀이 없다. 다시 물어도 안 생긴다 — 이을 길이 끊겼다
 * - `unreachable` — **답이 안 났다**: 내 사주 · DB · 로그인 세션을 그 순간 못 읽었다. 다음 물음에서는 날 수 있다
 */
export type ClaimedTaste = { sessionId: string; claim: TasteClaim | 'gone' | 'unreachable' };

/** 귀속 표가 가리키는 세션을 다시 맞춰 본다 — 표가 없으면 `null`. 던진 것도 `unreachable` 이다 */
export async function claimedTaste(): Promise<ClaimedTaste | null> {
  const sessionId = await claimedTasteSessionId();
  if (sessionId === null) return null;
  const browserHmac = await browserHmacNow();
  if (browserHmac === null) return { sessionId, claim: 'gone' };
  try {
    /* 내 사주가 있는 사람만 자기 풀이를 받는다 — 지문이 `null` 이면 계정 · 사람을 그 순간 못 읽은 것이다(`readAccount`) */
    const fingerprint = await selfTasteFingerprint();
    if (fingerprint === null) return { sessionId, claim: 'unreachable' };
    const claim = await claimTasteSession({ sessionId, browserHmac, fingerprint });
    return { sessionId, claim: claim ?? 'unreachable' };
  } catch (thrown) {
    console.error('taste carry: 귀속 표를 못 맞췄다', thrown instanceof Error ? thrown.message : thrown);
    return { sessionId, claim: 'unreachable' };
  }
}

/**
 * 자기 풀이 화면의 「아까 보던 내용」 — 없으면 `null`. **부속 정보다** — 못 읽어도 풀이 화면은 그대로 선다.
 */
export async function tasteCarryOfPage(reading: CurrentReading | null): Promise<TasteCarryView | null> {
  try {
    return await carryOf(reading);
  } catch (thrown) {
    /* 내 사주를 못 읽은 것 — 원문은 문이 이미 기록에 남겼다. 이 칸만 비운다 */
    console.error('taste carry: 아까 보던 내용을 못 세웠다', thrown instanceof Error ? thrown.message : thrown);
    return null;
  }
}

async function carryOf(reading: CurrentReading | null): Promise<TasteCarryView | null> {
  const claimed = await claimedTaste();
  if (claimed !== null && typeof claimed.claim === 'object' && claimed.claim.outcome === 'claimed') {
    const { carry, readingRunStatus } = claimed.claim;
    if (readingRunStatus === 'running') return { preview: carry.previewMarkdown, state: 'running' };
    if (readingRunStatus === null || readingRunStatus === 'failed') return { preview: carry.previewMarkdown, state: 'next' };
  }

  if (reading?.sourceRunId == null) return null;
  const shown: TasteRunCarry | null = await tasteContinuationOfRun(reading.sourceRunId);
  return shown === null ? null : { preview: shown.previewMarkdown, state: 'shown' };
}
