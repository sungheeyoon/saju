import { baselineIn, checkReading, isScored, type BirthSecret, type ReadingKind } from '@/src/lib/reading';
import { checkContinuation, continuedMarkdownOf } from '@/src/lib/reading/continuation';

import { keyedClient } from '../../keyed-client';
import { countTasteStep } from '../../keyed-taste';
import type { StoredInput } from '@/src/lib/input/stored';

import type { ModelUsage } from './generator';
import { retrieveBackgroundReading } from './model';
import { rpcArgs } from '@/src/lib/db';

/**
 * 떠나보낸 일을 **가져와 닫는다** — 성공이든 실패든 (ADR 0020).
 *
 * webhook 이 응답을 보낸 뒤에 돌고, 복구기도 같은 자리를 부른다. 두 길이 같은 함수를
 * 지나는 것이 요점이다 — 갈라 두면 webhook 쪽만 고쳐지는 날이 온다.
 *
 * ## 여기서 던지지 않는다
 *
 * 부르는 쪽이 둘 다 「응답은 이미 갔거나 아무도 안 듣는」 자리다. 던지면 시도가 열린 채
 * 남고, 그 대상이 만료까지 잠긴다. 그래서 무엇이 되든 값으로 낸다.
 *
 * ## 못 집으면 아무 일도 안 한다
 *
 * 이미 누가 집었거나 시도가 끝난 것이다. **그때 실패로 닫으면 안 된다** — 방금 성공으로
 * 닫힌 것을 뒤따라 실패로 덮을 수 있다.
 */
type CollectOutcome =
  | { done: 'saved' }
  | { done: 'failed'; code: string }
  | { done: 'pending' }
  | { done: 'skipped'; why: string };

const secretOf = (birth: StoredInput): BirthSecret => ({
  originalDate: birth.original_date,
  solarDate: birth.solar_date,
  birthTime: birth.birth_time,
  city: birth.city,
});

type ClaimedJob = {
  run_id: string;
  kind: ReadingKind;
  prompt: string;
  evidence: string;
  prompt_version: string;
  requested_model: string;
  generation: Record<string, unknown>;
  viewed_at: string;
  birth_a: StoredInput;
  birth_b: StoredInput | null;
};

export async function collectReadingResult(responseId: string): Promise<CollectOutcome> {
  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('결과 회수');
  } catch {
    return { done: 'skipped', why: '열쇠가 없습니다' };
  }

  const claim = async (): Promise<ClaimedJob | undefined> => {
    const { data, error } = await keyed.rpc('claim_reading_job', { p_response_id: responseId });
    if (error) throw new Error(error.message);
    return ((data ?? []) as ClaimedJob[])[0];
  };

  let job: ClaimedJob | undefined;
  try {
    job = await claim();

    /**
     * **이름표를 잃은 일감을 되찾는다.**
     *
     * 제출은 됐는데 `response_id` 를 적기 전에 끊기면 이 이름으로는 못 찾는다. 그때
     * 쓰라고 요청에 `metadata.reading_run_id` 를 실어 보냈다(ADR 0020) — 결과에 붙여
     * 보낸 이름표가 우리 쪽 기록보다 먼저다.
     *
     * 회수를 한 번 더 하게 되지만 그 값을 치를 자리가 여기다. 안 하면 그 작업은 돈만
     * 나가고 결과가 아무 데도 안 붙는다.
     */
    if (job === undefined) {
      const orphan = await retrieveBackgroundReading(responseId);
      const runId = orphan.ok === true ? orphan.runId : null;

      if (runId !== null) {
        const { data: adopted, error: adoptError } = await keyed.rpc('adopt_reading_job', {
          p_run_id: runId,
          p_response_id: responseId,
        });
        /* 되찾기가 터진 것은 「되찾을 것이 없다」가 아니다 — 집기와 같이 까닭을 싣고 건너뛴다(ADR 0078) */
        if (adoptError) throw new Error(adoptError.message);
        if (adopted === true) job = await claim();
      }
    }
  } catch (failure) {
    return { done: 'skipped', why: failure instanceof Error ? failure.message : String(failure) };
  }

  if (job === undefined) return { done: 'skipped', why: '집을 일감이 없습니다' };

  /**
   * **실패는 한 자리에서 닫는다.** 갈래가 넷인데(회수 실패·모델 실패·검사 실패·저장
   * 실패) 자리를 나누면 하나는 알림을 안 넣는다.
   */
  const close = async (
    code: string,
    detail: string,
    /** 쓴 토큰 — **실패에도 나간 돈이 있다**(ADR 0039). 모르면 `null` 이고 안 적는다 */
    usage: ModelUsage | null = null,
  ): Promise<CollectOutcome> => {
    /* 못 닫아도 기한이 지나면 복구기가 닫는다 — 그래도 조용히 넘기지 않고 기록에 남긴다(ADR 0078) */
    const { error: notClosed } = await keyed.rpc('fail_reading_job', {
      p_run_id: job.run_id,
      p_failure_code: code,
      p_failure_detail: detail,
      p_usage: usage,
    });
    if (notClosed) console.error('collect: fail_reading_job', notClosed.code, notClosed.message);
    return { done: 'failed', code };
  };

  const retrieved = await retrieveBackgroundReading(responseId);

  /**
   * **아직 도는 중이면 그대로 둔다.** 집으면서 `retrieving` 으로 표시했으므로 되돌려
   * 놓아야 복구기가 다음 바퀴에 다시 집는다 — 안 되돌리면 그 일감은 영영 안 집힌다.
   */
  if (retrieved.ok === 'pending') {
    const { error: notReleased } = await keyed.rpc('release_reading_job', { p_run_id: job.run_id });
    if (notReleased) console.error('collect: release_reading_job', notReleased.code, notReleased.message);
    return { done: 'pending' };
  }

  if (retrieved.ok === false) return close(retrieved.code, retrieved.detail, retrieved.usage);

  /**
   * **얼린 것으로 검사한다.** 그 사이 배포가 났어도 보낸 것을 기준으로 재고, 사용자가
   * 입력을 고쳤어도 붙들어 둔 판본으로 유출을 잰다.
   */
  /**
   * **이어쓰기면 답을 먼저 잰다**(ADR 0143 의 2) — 맛보기를 되풀이하거나 · 미루거나 · 첫 절에 1번을 또 쓰면 실패다. 지나면
   * 첫 절 1번 본문으로 답을 **한 번만** 끼운다(`continuedMarkdownOf`). 아래 기본 검사와 저장은 그 끼운 글로 한다 — 저장하는
   * 글이 검사한 글이다. 이어쓰기가 없는 풀이는 지금과 한 글자도 같다.
   */
  const continuation = continuationOf(job.generation);
  let markdown = retrieved.output.markdown;
  if (continuation !== null) {
    const answer = retrieved.output.continuationAnswer;
    const continued = checkContinuation({ answer, preview: continuation.preview, markdown });
    if (!continued.ok || answer === undefined) {
      return close('continuation-out-of-contract', continued.ok ? 'continuationAnswer 가 없다' : continued.reasons.join(' · '), retrieved.usage);
    }
    markdown = continuedMarkdownOf(answer, markdown);
  }
  const output = { score: retrieved.output.score, metaphor: retrieved.output.metaphor, markdown };

  const secrets = [job.birth_a, ...(job.birth_b === null ? [] : [job.birth_b])].map(secretOf);
  const verdict = checkReading({
    kind: job.kind,
    output,
    evidenceText: job.evidence,
    secrets,
    // 얼린 프롬프트에서 되읽는다 — 그때 실제로 시킨 수다(ADR 0060)
    baseline: baselineIn(job.prompt) ?? undefined,
  });

  if (!verdict.ok) {
    // 모델은 다 돌았다 — 검사가 문 것이라 토큰은 이미 나갔다.
    return close(verdict.failures[0].code, verdict.failures.map((f) => f.detail).join(' · '), retrieved.usage);
  }

  /**
   * **판본을 인자로 안 보낸다**(ADR 0071). 무엇으로 계산했는지는 시도를 열 때 이미
   * 얼었고, 저장하는 문이 그 얼린 작업에서 직접 읽는다 — 앱이 그 값을 대는 자리가
   * 있으면 DB 는 그것이 이 시도의 것인지 알 수 없다.
   */
  const { error: saveError } = await keyed.rpc('save_reading', rpcArgs<'save_reading'>({
    p_run_id: job.run_id,
    p_output: output.markdown,
    p_score: isScored(job.kind) ? output.score : null,
    p_metaphor: output.metaphor,
    p_evidence: job.evidence,
    p_prompt: job.prompt,
    p_prompt_version: job.prompt_version,
    /** **응답한 모델을 적는다.** 요청한 이름과 다를 수 있고, 되짚을 때 필요한 것은 이쪽이다 */
    p_model: retrieved.modelId ?? job.requested_model,
    p_generation: { ...job.generation, usage: retrieved.usage },
    p_viewed_at: job.viewed_at,
  }));

  if (saveError) return close('save-rejected', saveError.message, retrieved.usage);

  /* 퍼널의 끝 — 이어 쓴 풀이가 섰다. 날짜와 단계만 센다(ADR 0143 의 8). 못 세도 저장은 그대로다 */
  if (continuation !== null) await countTasteStep('reading_succeeded');

  return { done: 'saved' };
}

/**
 * 얼린 작업이 이어쓰기였는가 — 제출이 `generation.continuation` 에 맛보기 원문을 실어 둔다(`pipeline.ts`). 없거나 모양이
 * 아니면 이어쓰기가 아니다.
 */
export function continuationOf(generation: Record<string, unknown> | null | undefined): { preview: string } | null {
  const carried = generation?.continuation;
  if (carried === null || typeof carried !== 'object') return null;
  const preview = (carried as Record<string, unknown>).preview;
  return typeof preview === 'string' && preview.trim() !== '' ? { preview } : null;
}
