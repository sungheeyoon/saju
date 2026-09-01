import { checkReading, isScored, type BirthSecret, type ReadingKind } from '@/src/lib/reading';

import { keyedClient } from '../../keyed-client';
import type { StoredRevision } from '../../revision';

import { retrieveBackgroundReading } from './model';

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
export type CollectOutcome =
  | { done: 'saved' }
  | { done: 'failed'; code: string }
  | { done: 'pending' }
  | { done: 'skipped'; why: string };

const secretOf = (birth: StoredRevision): BirthSecret => ({
  originalDate: birth.original_date,
  solarDate: birth.solar_date,
  birthTime: birth.birth_time,
  city: birth.city,
});

type ClaimedJob = {
  run_id: string;
  kind: ReadingKind;
  revision_a: string;
  revision_b: string | null;
  prompt: string;
  evidence: string;
  prompt_version: string;
  requested_model: string;
  generation: Record<string, unknown>;
  viewed_at: string;
  birth_a: StoredRevision;
  birth_b: StoredRevision | null;
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
        const { data: adopted } = await keyed.rpc('adopt_reading_job', {
          p_run_id: runId,
          p_response_id: responseId,
        });
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
  const close = async (code: string, detail: string): Promise<CollectOutcome> => {
    await keyed.rpc('fail_reading_job', {
      p_run_id: job.run_id,
      p_failure_code: code,
      p_failure_detail: detail,
    });
    return { done: 'failed', code };
  };

  const retrieved = await retrieveBackgroundReading(responseId);

  /**
   * **아직 도는 중이면 그대로 둔다.** 집으면서 `retrieving` 으로 표시했으므로 되돌려
   * 놓아야 복구기가 다음 바퀴에 다시 집는다 — 안 되돌리면 그 일감은 영영 안 집힌다.
   */
  if (retrieved.ok === 'pending') {
    await keyed.rpc('release_reading_job', { p_run_id: job.run_id });
    return { done: 'pending' };
  }

  if (retrieved.ok === false) return close(retrieved.code, retrieved.detail);

  /**
   * **얼린 것으로 검사한다.** 그 사이 배포가 났어도 보낸 것을 기준으로 재고, 사용자가
   * 입력을 고쳤어도 붙들어 둔 판본으로 유출을 잰다.
   */
  const secrets = [job.birth_a, ...(job.birth_b === null ? [] : [job.birth_b])].map(secretOf);
  const verdict = checkReading({
    kind: job.kind,
    output: retrieved.output,
    evidenceText: job.evidence,
    secrets,
  });

  if (!verdict.ok) {
    return close(verdict.failures[0].code, verdict.failures.map((f) => f.detail).join(' · '));
  }

  const { error: saveError } = await keyed.rpc('save_reading', {
    p_run_id: job.run_id,
    p_revision_a: job.revision_a,
    p_revision_b: job.revision_b,
    p_output: retrieved.output.markdown,
    p_score: isScored(job.kind) ? retrieved.output.score : null,
    p_evidence: job.evidence,
    p_prompt: job.prompt,
    p_prompt_version: job.prompt_version,
    /** **응답한 모델을 적는다.** 요청한 이름과 다를 수 있고, 되짚을 때 필요한 것은 이쪽이다 */
    p_model: retrieved.modelId ?? job.requested_model,
    p_generation: { ...job.generation, usage: retrieved.usage },
    p_viewed_at: job.viewed_at,
  });

  if (saveError) return close('save-rejected', saveError.message);

  return { done: 'saved' };
}
