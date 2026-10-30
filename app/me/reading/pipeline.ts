import { randomUUID } from 'node:crypto';

import { after } from 'next/server';

import { promptVersionOf, READING_UNEXPECTED_NOTE } from '@/src/lib/reading';

import { supabaseOnServer } from '../../auth/server-client';
import { recordDbFailure, userFacingDbMessage } from '../../db-error';
import { NoKeyError, keyedClient } from '../../keyed-client';
import { failReadingJob } from './fail-job';
import { GENERATION } from './generation';
import { submitFrozen, type FrozenJob } from './submit';
import { readingTargetArgs, type ReadingTarget } from './target';
import { claimedTaste } from '../../taste/taste-carry';
import { linkTasteReadingRun, tasteContinuationOfRun, type TasteLinkAnswer } from '../../taste/keyed-taste-claims';
import { forgetTasteClaim } from '../../taste/taste-visitor';
import { reportRequestError } from '../../request-error';
import type { TasteRunCarry } from '@/src/lib/reading/continuation';
import {
  TASTE_CARRY_UNREAD,
  TASTE_LINK_FAILED,
  TASTE_WRONG_RUN_ALERT,
  TASTE_WRONG_RUN_DETAIL,
} from '@/src/lib/reading/taste-visit';
import { rpcArgs } from '@/src/lib/db';
import { refusedForCredits, type OutOfCreditsRefusal } from '../credits/refusal';

/**
 * **결과 생성 요청** — 사용자가 눌렀을 때만 도는 길.
 *
 * 누르면 시도를 열고(`beginReading`), 응답이 나간 뒤에 **얼린 입력을 집어** 근거를
 * 자르고 · 프롬프트를 짓고 · 떠나보낸다(`sendRun`). 완성본을 가져와 검사하고 통째로
 * 교체하는 일은 webhook 과 복구기가 한다(`collect.ts`, ADR 0020). 실패하면 **직전 성공
 * 결과를 건드리지 않고** 실패만 남긴다(ADR 0017).
 *
 * ## 입력은 **시도를 여는 그 트랜잭션에서** 언다 (ADR 0071)
 *
 * 앞서는 이 파일이 응답 뒤에 판본을 읽어 입력을 정했다. 그 틈에 사용자가 입력을 고치면
 * **동의한 것과 계산한 것이 갈렸다.** 이제 `start_reading_run` 이 시도를 열면서 같은
 * 문장 안에서 계산 입력을 값으로 얼린다.
 *
 * 그래서 이 파일이 **읽는 자리가 하나로 줄었다** — 얼린 작업 하나다. `person` 도 판본도
 * 여기서 다시 안 읽고, kind 마다 갈리던 「어디서 입력을 읽는가」도 없어졌다. 공유 궁합의
 * 계산 입력을 열쇠로 읽던 문(`match_calculation_inputs`)도 이 길에서 빠진다.
 *
 * ## 집는 일은 **원자적이다**
 *
 * `take_reading_job`(수동)과 `match_run_awaiting_send`(수락)는 조회가 아니라 **전이**다 —
 * `frozen` 을 `preparing` 으로 옮기면서 그 행을 내준다. 복구기와 겹치거나 같은 누름이
 * 재전송돼도 **먼저 부른 쪽 하나만** 작업을 받고, 두 번째는 0행이다. 조회와 전이가
 * 갈리면 두 프로세스가 같은 작업을 들고 두 번 제출한다.
 *
 * 집은 쪽이 죽으면 복구기가 다시 집는다(`resendStalledRun`, ADR 0210). 그때 식별자가 바뀌므로 돌아온 옛 작업자는 제출 직전 문에서 선다.
 *
 * ## 두 번 눌러도 한 번만 바뀐다 — 막는 것이 셋이다
 *
 * 1. **브라우저가 짓는 열쇠** — 같은 누름의 재전송이면 같은 값이라 두 번째가 0행이다.
 * 2. **대상별 잠금**(DB) — 다른 창, 다른 기기, **Match 의 상대**까지 같은 대상이면
 *    줄을 선다. 잠금이 사람별이면 두 당사자가 서로의 시도를 못 보고 둘 다 돈다.
 * 3. **늦게 돌아온 호출 거절**(DB) — 그 사이 새 시도가 열렸으면 저장이 거절된다.
 *
 * 화면의 버튼이 눌린 동안 잠기는 것은 거들 뿐이다 — 창이 둘이면 그 잠금은 없는 것과 같다.
 *
 * ## 저장은 **열쇠로** 한다
 *
 * `save_reading` 은 `authenticated` 에게 닫혀 있다(ADR 0013). 열어 두면 로그인한 사람이
 * 이 파이프라인을 통째로 건너뛰고 임의의 글을 저장할 수 있고, Match 에서는 그 글이
 * 상대에게 간다. 열쇠가 여는 것은 **시도 하나**이고, 그 시도는 사용자 JWT 로 자격이
 * 확인된 채 기록된 것이다.
 */

/** `start_reading_run` 이 내주는 한 줄 — 이 파일이 쓰는 것은 **시도 id 하나**다 */
type StartedRun = { run_id: string };

/**
 * 시도를 **연다** — 모델은 아직 안 부른다.
 *
 * 여는 일과 만드는 일을 가르는 것이 비동기 생성의 전부다. 여기까지는 밀리초짜리
 * DB 왕복 하나라 응답을 붙들지 않고, 만드는 일은 응답이 나간 뒤에 돈다.
 *
 * **입력은 이 왕복 안에서 언다**(ADR 0071). 그래서 이 함수가 돌아온 뒤에 사용자가 입력을
 * 고쳐도 이미 시작된 생성은 동결값으로 끝난다.
 *
 * @returns 열었으면 그 시도, 이미 도는 것이 있으면 `null`, 못 열면 거절 문장.
 */
async function openRun(
  target: ReadingTarget,
  requestKey: string | undefined,
): Promise<{ ok: true; started: StartedRun | null } | { ok: false; message: string } | OutOfCreditsRefusal> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('start_reading_run', rpcArgs<'start_reading_run'>({
    /* 대상을 인자로 푸는 일은 `target.ts` 하나가 한다 — 여기서 또 풀면 두 벌이 된다 */
    ...readingTargetArgs(target),
    /** 같은 누름의 재전송을 알아보는 값. 무엇을 막는지는 위 주석이 든다 */
    p_idempotency_key: requestKey ?? randomUUID(),
    p_model: GENERATION.model,
    p_prompt_version: promptVersionOf(target.kind),
  }));

  /**
   * **거절은 DB 가 문장으로 낸다.** 그 문장은 그대로 세우고, 우리가 쓰지 않은 오류
   * (스키마·정책·PostgREST)는 기록으로 보낸다 — 사용자가 할 수 있는 것이 없고 우리
   * 스키마의 속만 말한다(`userFacingDbMessage`).
   */
  if (error) {
    const message = userFacingDbMessage(error, 'start_reading_run', READING_UNEXPECTED_NOTE);
    /* 잔액을 본 뒤 다른 탭에서 마지막 풀이권을 썼다 — 화면은 오류 줄 대신 풀이권 창을 연다(ADR 0171 「덧」) */
    return refusedForCredits(error) ? { ok: false, message, outOfCredits: true } : { ok: false, message };
  }

  // 0행은 「같은 요청이 이미 돌았다」다. 모델을 부르지 않는다.
  return { ok: true, started: ((data ?? []) as StartedRun[])[0] ?? null };
}

/**
 * 방금 연 시도를 집어 떠나보낸다.
 *
 * **0행이면 아무 일도 안 한다** — 이미 누가 집었거나 그 사이 시도가 닫힌 것이다. 그때
 * 또 제출하면 같은 시도에 두 번 나간다.
 */
async function sendRun(runId: string, continuation: TasteRunCarry | null = null): Promise<void> {
  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('결과 제출');
  } catch (failure) {
    /* 열쇠가 없는 배포다 — 시도는 열린 채 남고 10분 만료가 닫는다. 사용자 권한으로 닫는 문은 없다(ADR 0120) */
    console.error('send: 열쇠 없음', failure instanceof NoKeyError ? failure.message : failure);
    return;
  }

  const leaseId = randomUUID();
  const { data, error } = await keyed.rpc('take_reading_job', { p_run_id: runId, p_lease_id: leaseId });
  if (error) {
    await failReadingJob(keyed, 'send', { runId, code: 'unexpected', detail: error.message, usage: null });
    return;
  }

  const job = ((data ?? []) as unknown as FrozenJob[])[0];
  if (job === undefined) return;

  await submitFrozen(keyed, job, continuation, leaseId);
}

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
async function linkCarry(
  sessionId: string,
  runId: string,
): Promise<
  | { kind: 'carry'; carry: TasteRunCarry }
  | { kind: 'plain' }
  | { kind: 'fail'; code: string; detail: string; alert?: true }
> {
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

/**
 * 연 시도를 **보내지 않고** 실패로 닫는다 — 기존 실패 닫기 문(`fail_reading_job`, 열쇠)이다. 시도는 `running` 일 때만 닫히고
 * 실패 알림이 서며, 화면은 다음 물음에서 실패와 다시 누를 단추를 본다.
 */
async function closeUnsent(runId: string, code: string, detail: string): Promise<void> {
  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('보내지 않은 시도를 닫을');
  } catch (failure) {
    /* 열쇠가 없는 배포다 — 시도는 열린 채 남고 만료가 닫는다(`sendRun` 과 같다) */
    console.error('close: 열쇠 없음', failure instanceof NoKeyError ? failure.message : failure);
    return;
  }
  await failReadingJob(keyed, 'close', { runId, code, detail, usage: null });
}

/** 눌렀을 때 화면이 곧바로 받는 답 — **결과가 아니라 시작 여부다.** */
export type ReadingStart =
  /** 이 누름이 시도를 열었다. 만드는 일은 응답 뒤에 돈다 */
  | { ok: true; started: true }
  /** 이미 도는 시도가 있다. 아무것도 새로 열지 않았다 */
  | { ok: true; started: false }
  | { ok: false; message: string }
  /** 풀이권이 없어 막혔다 — 화면은 풀이권 창을 연다 */
  | OutOfCreditsRefusal;

/**
 * **응답을 먼저 보내고 만드는 일은 뒤에 돈다.**
 *
 * 앞서는 누름 하나가 모델 호출까지 붙들고 있었다. 그래서 새로고침이나 탭 닫기가
 * 요청을 끊으면 **만들던 것이 함께 끊겼고**, 열린 시도가 남아 그 대상이 10분간
 * 잠겼다. 사용자가 한 일은 새로고침 하나인데 대가가 그것이었다.
 *
 * `after` 는 응답이 나간 **뒤에** 콜백을 돌린다(라우트의 `maxDuration` 안에서).
 * 그러면 브라우저가 끊어도 만들던 것은 안 끊긴다 — 응답은 이미 갔으니 끊을 것이 없다.
 * 화면은 시도의 상태를 물어 보며 기다리고, 다른 기기에서 열어도 같은 상태를 본다.
 *
 * **시도를 여는 일은 여기서 기다린다.** `after` 안에서 열면 「눌렀는데 아무 일도 안
 * 일어난 것처럼 보이는」 창이 생기고, 그 사이에 한 번 더 누르면 잠금이 아직 없어서
 * 두 번 돈다. 여는 것은 밀리초짜리 DB 왕복 하나라 응답을 붙들지 않는다.
 */
export async function beginReading(
  target: ReadingTarget,
  requestKey?: string,
): Promise<ReadingStart> {
  const carry = target.kind === 'self' ? await pressCarry() : null;
  if (carry?.kind === 'opened') return { ok: true, started: false };

  const opened = await openRun(target, requestKey);
  if (!opened.ok) return opened;
  if (opened.started === null) return { ok: true, started: false };

  const runId = opened.started.run_id;

  /**
   * **세션 하나 = 시도 하나.** 연 시도에 세션을 잇고, 이어졌으면 그 스냅숏을 DB 에서 다시 읽어 싣는다 — 귀속 때 받은 글을
   * 들고 다니지 않는다. 잇기의 답마다 할 일은 `linkCarry` 가 든다. 풀이권은 시도를 여는 규칙 그대로다.
   */
  const linked =
    carry?.kind === 'continue'
      ? await linkCarry(carry.sessionId, runId)
      : carry?.kind === 'unreachable'
        ? ({ kind: 'fail', code: TASTE_LINK_FAILED, detail: '귀속 표를 다시 못 맞췄다' } as const)
        : ({ kind: 'plain' } as const);

  if (linked.kind === 'fail') {
    after(async () => {
      try {
        await closeUnsent(runId, linked.code, linked.detail);
      } catch (thrown) {
        // 못 닫았으면 복구기가 deadline 에 닫는다 — 까닭만 기록에 남긴다.
        console.error('begin: closeUnsent', thrown);
      }
      /* 알림은 던지지 않는다 — Production 에서만 보내고 실패는 기록에 남긴다(`reportRequestError`) */
      if ('alert' in linked && linked.alert) await reportRequestError(TASTE_WRONG_RUN_ALERT, 'action', null);
    });
    return { ok: true, started: true };
  }
  const continuation: TasteRunCarry | null = linked.kind === 'carry' ? linked.carry : null;

  after(async () => {
    /**
     * **여기서 던지면 아무도 못 듣는다.** 응답은 이미 나갔고 부르는 쪽이 없다. 그래도
     * `sendRun` 이 시도를 닫아 두므로 화면은 다음 물음에서 실패를 본다 — 열린 채
     * 남는 것만은 막아야 그 대상이 10분간 잠기지 않는다.
     */
    try {
      await sendRun(runId, continuation);
    } catch (thrown) {
      // 여기까지 온 것은 우리가 못 적은 경우다. 복구기가 deadline 에 닫는다 — 까닭만 기록에 남긴다.
      console.error('begin: sendRun', thrown);
    }
  });

  return { ok: true, started: true };
}

/**
 * 동의가 연 시도를 **떠나보낸다** (ADR 0038).
 *
 * 수락은 시도를 열고 입력을 얼리기만 한다 — 자르기·프롬프트·제출은 Node 의 일이고,
 * DB 트랜잭션 안에서 할 수 있는 것이 아니다. 그래서 수락한 사람의 응답 뒤(`after`)에
 * 이 함수가 돈다.
 *
 * ## 누른 사람이 아니라 열쇠로 집는다
 *
 * 시도는 **청한 사람** 것으로 서 있고 `reading_run` 은 당사자에게도 안 열린다. 수락을
 * 부른 사람은 받은 쪽이라 그 행을 볼 길이 없다 — 그래서 열쇠가 여는 문 하나로 찾는다
 * (`match_run_awaiting_send`). 그 문은 **아직 아무도 안 집은 것만** 내주므로 두 번
 * 부르거나 복구기와 겹쳐도 같은 시도가 두 번 나가지 않는다.
 *
 * ## 못 보내도 막다른 길이 아니다
 *
 * 여기서 실패하면 시도는 `submitFrozen` 이 닫거나(실패로) — 제출이 답을 못 받았으면 열어 두었다가 webhook 이 되찾거나
 * 복구기가 기한에 닫는다 — 닫힌 뒤 결과 화면에는 만드는 버튼이 돌아온다. 「누를 버튼이 없다」는 성공 경로의 약속이지 실패 경로의 약속이 아니다.
 */
export async function sendAcceptedMatchReading(requestId: string): Promise<void> {
  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('동의가 연 시도를 제출할');
  } catch (failure) {
    // 열쇠가 없는 배포다. 시도는 열린 채로 남고 만료 때 닫힌다 — 화면에 버튼이 돌아온다. 까닭만 기록에 남긴다(`sendRun` 과 같다).
    console.error('send match: 열쇠 없음', failure instanceof NoKeyError ? failure.message : failure);
    return;
  }

  const leaseId = randomUUID();
  const { data, error } = await keyed.rpc('match_run_awaiting_send', { p_request_id: requestId, p_lease_id: leaseId });
  if (error) {
    /* 못 찾았어도 시도는 열린 채 남고 복구기 · 만료가 닫는다 — 답은 그대로, 원문만 기록에 */
    recordDbFailure(error, 'send match: match_run_awaiting_send');
    return;
  }

  const job = ((data ?? []) as unknown as FrozenJob[])[0];
  // 0행은 「보낼 것이 없다」다 — 수락이 시도를 못 열었거나 이미 떠났다.
  if (job === undefined) return;

  await submitFrozen(keyed, job, null, leaseId);
}
