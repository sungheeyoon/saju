'use server';

import { FEEDBACK_UNEXPECTED_NOTE } from '@/src/lib/reading';

import { beginReading, type ReadingStart } from './pipeline';
import { readingPathsOf, type ReadingTarget } from './target';
import { lastReadingRun, type LastRun } from './current';
import { refreshPaths } from '../../refresh';
import type { SaveResult } from '../../save-result';
import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';
import { rpcArgs } from '@/src/lib/db';
import { forgetTasteClaim } from '../../taste-visitor';

/**
 * **사용자가 누른 그 순간에만 도는 문.**
 *
 * 화면 조회에는 이 길이 없다. 그래서 배포도, 새로고침도, 정책 변경도 현재 결과를
 * 바꾸지 못한다 — 바꾸는 것은 이 액션이 성공했을 때뿐이다(ADR 0013).
 *
 * **결과를 기다리지 않는다.** 시도를 열고 곧바로 답한다. 만드는 일은 응답 뒤에
 * 돌고(`beginReading`), 화면은 `readingRunState` 로 그 시도를 지켜본다.
 */
export async function generateReading(
  target: ReadingTarget,
  /** 누름 하나를 가리키는 값 — 브라우저가 짓는다(`pipeline.ts` 가 이유를 든다) */
  requestKey?: string,
): Promise<ReadingStart> {
  return beginReading(target, requestKey);
}

/**
 * 그 대상의 시도가 지금 어떤가 — **화면이 기다리며 묻는 자리.**
 *
 * 읽기만 한다. 이 문을 두드리는 것으로는 모델이 불리지 않고 현재 결과도 안 바뀐다.
 *
 * 다시 그리는 일도 여기서 한다. 끝난 것을 본 화면이 스스로 `router.refresh()` 를
 * 부르지만, 그 왕복이 캐시된 화면을 받으면 **끝난 줄 알면서 옛 글을 세운다.**
 * 끝난 것을 확인한 자리에서 무르게 하는 것이 한 자리다.
 */
export async function readingRunState(target: ReadingTarget): Promise<LastRun | null> {
  const run = await lastReadingRun(target);

  if (run !== null && run.status !== 'running') {
    refreshPaths(readingPathsOf(target));
  }

  /*
    **이어 쓴 풀이가 섰으면 귀속 표를 걷는다**(ADR 0143) — 그 세션은 다 쓰였다. 남겨 두면 다음 「다시 받기」가 그 풀이를
    여는 것으로 끝난다(`pipeline.ts` 의 `pressCarry`). 기다리던 시도는 그 표가 이은 시도다 — 이 화면의 누름이 열었다.
  */
  if (target.kind === 'self' && run?.status === 'succeeded') await forgetTasteClaim();

  return run;
}

/**
 * **이어 보기를 그만둔다 — 「전체 풀이만 보기」**(ADR 0143 「덧」). 귀속 표(쿠키)를 걷어 내 사주풀이의 다음 누름이 보통 풀이가
 * 되게 한다. 두 자리가 부른다: 「이어오지 못했어요.」의 탈출구(`app/save-for-reading.tsx`)와, 잇기가 막혀(`taste-link-failed`)
 * 실패한 내 사주풀이 화면의 탈출구(`panel.tsx`).
 *
 * **DB 의 귀속된 세션은 건드리지 않는다.** 누름이 세션을 찾는 길은 이 표 하나다(`pipeline.ts` 의 `pressCarry` 는 표가 없으면
 * 보통 풀이로 간다). 화면의 「아까 보던 내용」도 표가 없으면 그 글을 만든 시도에 이어진 것만 보고(`taste-carry.ts`), 탭의 id 는
 * 붙은 뒤에 지워졌다 — 표를 걷으면 그 세션으로 돌아오는 길이 없다. 남은 세션은 붙이고 누르지 않은 세션과 같은 모양이라(회원과
 * 함께 지워진다, `claimed_by` 의 cascade) 버리는 문을 새로 열지 않는다(마이그레이션 없음).
 * 사용자가 고르는 일이라 던지지 않는다 — 쿠키를 걷는 데는 DB 가 없다.
 */
export async function skipTasteCarry(): Promise<void> {
  await forgetTasteClaim();
  refreshPaths(readingPathsOf({ kind: 'self' }));
}

/**
 * 읽은 글에 대한 답을 남긴다.
 *
 * **답은 글이 아니라 그 글을 만든 시도에 매인다**(`reading_feedback`). 현재 결과는
 * 새 생성이 성공하면 통째로 갈리므로, 글에 매달면 다음 글이 남의 답을 물려받는다.
 *
 * 자격을 여기서 묻지 않는다. 「이 글을 볼 수 있는가」는 DB 가 답하고(`reading_scope_for`),
 * 앱이 한 번 더 판정하면 판정하는 자리가 둘이 된다 — 둘은 언젠가 어긋나고, 어긋났을
 * 때 열려 있는 쪽은 언제나 더 바깥이다.
 */
export async function submitReadingFeedback(
  target: ReadingTarget,
  answer: {
    runId: string;
    usefulness: number;
    perceivedFit: number;
    feltLength: string;
    issueTags: readonly string[];
    comment: string | null;
  },
): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('leave_reading_feedback', rpcArgs<'leave_reading_feedback'>({
    p_run_id: answer.runId,
    p_usefulness: answer.usefulness,
    p_perceived_fit: answer.perceivedFit,
    p_felt_length: answer.feltLength,
    p_issue_tags: [...answer.issueTags],
    p_comment: answer.comment,
  }));

  /** 안내 문장은 DB 것을 그대로, 예상 밖 오류는 기록으로 — `pipeline.ts` 와 같은 자리 */
  if (error) {
    return {
      ok: false,
      message: userFacingDbMessage(error, 'leave_reading_feedback', FEEDBACK_UNEXPECTED_NOTE),
    };
  }

  /*
    답한 뒤에 화면이 「답해 주셔서 고맙습니다」로 서려면 `feedback_given` 이 다시
    읽혀야 한다. 그 값은 `my_reading` 이 들고 오므로 이 화면을 무르게 한다.
  */
  refreshPaths(readingPathsOf(target));

  return { ok: true };
}

/** 완성 소식을 읽음으로 바꾼 답 — 바꾼 수가 실려야 머리글의 종을 다시 세울지 안다 */
export type ReadingNewsRead = { ok: true; marked: number } | { ok: false; message: string };

/**
 * 결과 화면이 보인 **그 풀이의 완성 소식**을 읽음으로 바꾼다(ADR 0157 「2026-10-10 덧」).
 *
 * 어느 소식이 그 풀이의 것인지 · 내 것인지 · 이미 읽었는지는 DB 가 답한다(`mark_reading_ready_read`) — 다른 풀이의 소식과
 * 남의 소식은 안 바뀌고, 이미 읽은 것은 다시 안 적는다. 그래서 같은 풀이를 몇 번 열어도 바뀌는 것은 처음 한 번이다.
 *
 * 화면을 무르지 않는다 — 결과 화면에는 소식이 안 서고, 머리글의 종은 부른 쪽이 창 신호로 다시 센다(`news-read.ts`).
 * 소식 화면과 홈은 계정 채널의 `notifications` 가 다시 그린다(ADR 0155).
 */
export async function markReadingReadyRead(readingId: string): Promise<ReadingNewsRead> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('mark_reading_ready_read', { p_reading_id: readingId });
  if (error) return { ok: false, message: userFacingDbMessage(error, 'mark_reading_ready_read') };

  return { ok: true, marked: data ?? 0 };
}
