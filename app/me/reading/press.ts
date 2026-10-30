import {
  TASTE_CARRY_UNREAD,
  TASTE_LINK_FAILED,
  TASTE_WRONG_RUN_DETAIL,
} from '@/src/lib/reading/taste-visit';

import { supabaseOnServer } from '../../auth/server-client';
import { linkTasteReadingRun, tasteContinuationOfRun, type TasteLinkAnswer } from '../../taste/keyed-taste-claims';
import { claimedTaste } from '../../taste/taste-carry';
import { forgetTasteClaim } from '../../taste/taste-visitor';
import { openAndSend, type LinkedRun, type ReadingStart } from './pipeline';
import type { ReadingTarget } from './target';

/**
 * **웹의 누름** — 쿠키가 있는 자리에서만 되는 일을 든다: 쿠키의 사람과, 그 쿠키의 귀속 표로 맛보기를 잇는 일(ADR 0143).
 *
 * 시도를 열고 떠나보내는 몸통은 `pipeline.ts` 이고 앱의 문(`app/api/mobile`)도 그리로 간다. 이 파일을 거기서 떼어 둔 것은 잇기가 로그인을
 * `signedInUser` 로 묻기 때문이다 — 그 함수는 관문 안에서만 돈다(`app/auth/signed-in.boundary.test.ts`). 관문 밖의 앱 문이 그 import 를
 * 끌고 가지 않는다(ADR 0211).
 */

/**
 * 이 누름이 맛보기를 잇는가(ADR 0143 의 4) — 귀속 표가 가리키는 세션을 DB 에 다시 맞춰 본다.
 *
 * - `continue` — 붙인 세션이 아직 풀이에 안 이어졌거나 이어진 풀이가 실패했다. 이 누름이 연 시도에 잇는다
 * - `opened` — 이어진 풀이가 섰거나 도는 중이다. **새로 만들지 않는다** — 화면은 그 풀이를 기다리거나 연다. 섰으면 표를
 *   걷는다 — 다음 누름부터는 보통 「다시 받기」다
 * - `unreachable` — 표는 있는데 **답이 안 났다**(내 사주 · DB · 로그인 세션을 그 순간 못 읽음). 보통 풀이로 가지 않는다 —
 *   연 시도를 실패로 닫고 표를 둔다. 다음 누름이 다시 맞춘다(`taste-link-failed`)
 * - `null` — 이을 것이 없다(표가 없음 · 버림 · 남의 것 · 지남 · 쿠키 없음). 표를 걷고 보통 풀이로 간다
 */
async function pressCarry(): Promise<
  { kind: 'continue'; sessionId: string } | { kind: 'opened' } | { kind: 'unreachable' } | null
> {
  let claimed: Awaited<ReturnType<typeof claimedTaste>>;
  try {
    claimed = await claimedTaste();
  } catch (thrown) {
    /* 귀속 표(쿠키)조차 못 읽었다 — 표가 있는지 모르는 채 모든 자기 풀이를 닫을 수는 없다. 보통 풀이로 간다 */
    console.error('begin: 맛보기 표를 못 읽었다', thrown instanceof Error ? thrown.message : thrown);
    return null;
  }
  if (claimed === null) return null;
  const { claim, sessionId } = claimed;
  if (claim === 'unreachable') return { kind: 'unreachable' };
  if (claim === 'gone' || claim.outcome !== 'claimed') {
    await forgetTasteClaim();
    return null;
  }
  if (claim.readingRunStatus === 'succeeded') {
    await forgetTasteClaim();
    return { kind: 'opened' };
  }
  if (claim.readingRunStatus === 'running') return { kind: 'opened' };
  return { kind: 'continue', sessionId };
}

/**
 * 연 시도에 세션을 잇고 이어 쓸 스냅숏을 집는다 — **잇기의 답마다 할 일이 다르다**(ADR 0143 「덧」).
 *
 * - `carry` — 이었고 스냅숏을 읽었다. 이어쓰기로 보낸다
 * - `plain` — 이 시도는 보통 풀이가 맞다:
 *   - `not_claimed` — 세션이 이제 이 회원 것이 아니다(그 사이 입력을 고쳐 버려졌다 등). 표를 걷는다 — 다시 이을 것이 없다
 *   - `already_succeeded` · `already_running` — 다른 누름(다른 탭)이 그 사이에 이었다. 지금 그대로 둔다
 * - `fail` — 이 시도를 **보내지 않고 실패로 닫는다.** 풀이권은 안 쓰이고(실패한 시도는 안 쓴 것이다) 다음 누름이 같은 맛보기로
 *   다시 잇는다:
 *   - 답이 안 났다(`unreachable` · 던짐) — `taste-link-failed`. 보통 풀이로 내면 세션은 안 이어진 채 풀이권 한 번이 이어쓰기 없는
 *     글에 쓰이고, 사용자는 그 사실을 모른다
 *   - `run_taken` — 방금 연 시도를 다른 세션이 쥐었다. 새 시도 id 는 겹치지 않으니 다음 누름은 이어진다 — 이 시도만 닫는다
 *   - 이었는데 스냅숏을 못 읽었다 — `taste-carry-unread`. 세션은 이미 이 시도에 이어졌으므로 보통 풀이로 서면 그 맛보기는 다시
 *     안 이어진다(성공한 시도를 바꿔 잇지 않는다)
 *   - `wrong_run` — 방금 연 시도가 이 회원의 자기 풀이가 아니라는 답이다. 이 누름이 방금 `self` 로 연 시도라 **정상에서는 날 수
 *     없는 불변식 위반**이다 — 무엇이 틀렸는지 모르는 채 보통 풀이로 내면 풀이권 한 번이 이어쓰기 없는 글에 조용히 쓰인다.
 *     그래서 `taste-link-failed` 로 닫고 **운영자에게 알린다**(`alert`). 누를 때마다 같은 답이면 사용자가 막히므로, 실패한 풀이
 *     화면에 「전체 풀이만 보기」가 선다 — 귀속 표를 걷어 다음 누름이 보통 풀이가 된다(`skipTasteCarry`, 운영자 요청 2026-10-03)
 */
async function linkCarry(sessionId: string, runId: string): Promise<LinkedRun> {
  let link: TasteLinkAnswer;
  try {
    link = await linkTasteReadingRun(sessionId, runId);
  } catch (thrown) {
    console.error('begin: 맛보기를 잇다가 던졌다', thrown instanceof Error ? thrown.message : thrown);
    link = { answered: false };
  }
  if (!link.answered) return { kind: 'fail', code: TASTE_LINK_FAILED, detail: '맛보기를 시도에 잇는 답이 안 났다' };

  switch (link.outcome) {
    case 'linked': {
      const carry = await tasteContinuationOfRun(runId);
      return carry === null
        ? { kind: 'fail', code: TASTE_CARRY_UNREAD, detail: '이어진 맛보기의 스냅숏을 못 읽었다' }
        : { kind: 'carry', carry };
    }
    case 'run_taken':
      return { kind: 'fail', code: TASTE_LINK_FAILED, detail: '연 시도가 이미 다른 맛보기에 이어졌다' };
    case 'not_claimed':
      await forgetTasteClaim();
      return { kind: 'plain' };
    case 'wrong_run':
      console.error('begin: 연 시도가 이 회원의 자기 풀이가 아니라는 답(wrong_run) — 그 시도를 실패로 닫고 운영자에게 알린다');
      return { kind: 'fail', code: TASTE_LINK_FAILED, detail: TASTE_WRONG_RUN_DETAIL, alert: true };
    case 'already_succeeded':
    case 'already_running':
      return { kind: 'plain' };
  }
}

export async function beginReading(
  target: ReadingTarget,
  requestKey?: string,
): Promise<ReadingStart> {
  const carry = target.kind === 'self' ? await pressCarry() : null;
  if (carry?.kind === 'opened') return { ok: true, started: false };

  const link =
    carry?.kind === 'continue'
      ? (runId: string) => linkCarry(carry.sessionId, runId)
      : carry?.kind === 'unreachable'
        ? async (): Promise<LinkedRun> => ({ kind: 'fail', code: TASTE_LINK_FAILED, detail: '귀속 표를 다시 못 맞췄다' })
        : null;

  return openAndSend(await supabaseOnServer(), target, requestKey, link);
}
