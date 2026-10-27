import {
  baselineIn,
  blockingFindingsOf,
  checkReading,
  findingForRecord,
  isScored,
  metaphorToStore,
  withoutLeakedPaths,
  type BirthSecret,
  type CheckFinding,
  type ReadingKind,
} from '@/src/lib/reading';
import { checkContinuation, continuedMarkdownOf, firstSectionItemNumbersOf } from '@/src/lib/reading/continuation';

import { recordDbFailure } from '../../db-error';
import { keyedClient } from '../../keyed-client';
import { countTasteStep } from '../../taste/keyed-taste';
import type { StoredInput } from '@/src/lib/input/stored';

import { failReadingJob } from './fail-job';
import type { ModelUsage } from './generator';
import { DB_CALL_MS } from './lease';
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
 *
 * **건너뜀의 까닭(`why`)은 부르는 쪽이 안 읽는다** — webhook 은 처리 표시만 하고 복구기는 세지 않는다. 그래서 집기 ·
 * 되찾기의 DB 실패는 그 자리에서 기록에 남긴다(`recordDbFailure`, 자리 이름과 작업 식별자만 — 출생 정보는 안 싣는다).
 * 실패한 문은 일감의 상태를 안 바꿨으므로 복구기가 다음 바퀴에 그 일감을 다시 본다.
 *
 * ## 집은 일감은 임대다 (ADR 0201)
 *
 * 집을 때마다 새 임대 식별자를 짓고, 놓기 · 저장 · 실패에 그것을 싣는다 — DB 가 지금 쥔 작업자일 때만 한다. 여기서 죽거나
 * 놓기를 못 해도 임대(150초)가 지나면 다음 바퀴가 다시 집는다. **일시 장애는 닫지 않고 놓는다**(`released`) — 조회가 안
 * 닿았거나(`unreachable`) DB 가 답하지 못한 것(`passingDbFailure`). 모델이 낸 실패 · 검사가 막음 · DB 의 실제 거절은 지금처럼 닫는다.
 * 망을 지나는 부름마다 상한이 있다(`app/me/reading/lease.ts`).
 */
type CollectOutcome =
  | { done: 'saved' }
  | { done: 'failed'; code: string }
  | { done: 'pending' }
  | { done: 'released'; why: string }
  | { done: 'skipped'; why: string };

/**
 * **DB 가 답하지 못한 실패인가** — 그러면 일감을 놓고 다음 바퀴에 다시 한다. 닿지 못함 · 끊음(코드 없음), PostgREST 가 DB 에
 * 못 닿음(`PGRST000`~`003`), 연결 · 자원 · 종료(`08` · `53` · `57P`), 시간 상한 · 직렬화 · 교착 · 잠금(`57014` · `40001` ·
 * `40P01` · `55P03`). 모두 트랜잭션이 되돌아갔거나 · 됐는지 모르는 것이다 — 됐으면 DB 가 두 번째 저장을 막는다(「이미 끝난
 * 시도입니다」). 그 밖(우리가 쓴 거절 · 검사식 · 권한)은 다시 해도 같으므로 닫는다.
 */
export function passingDbFailure(error: { readonly code?: string | null }): boolean {
  const code = error.code ?? '';
  if (code === '') return true;
  if (/^PGRST00[0-3]$/.test(code)) return true;
  if (/^(08|53|57P)/.test(code)) return true;
  return ['57014', '40001', '40P01', '55P03'].includes(code);
}

/** 망을 지나는 DB 부름 하나의 상한 — 부를 때마다 새로 잰다 */
const bound = (): AbortSignal => AbortSignal.timeout(DB_CALL_MS);

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

  /** 이 회수의 임대 식별자 — 집기 · 놓기 · 저장 · 실패가 같은 값을 싣는다 */
  const lease = crypto.randomUUID();

  const claim = async (): Promise<ClaimedJob | undefined> => {
    const { data, error } = await keyed
      .rpc('claim_reading_job', { p_response_id: responseId, p_lease_id: lease })
      .abortSignal(bound());
    if (error) {
      recordDbFailure(error, `collect: claim_reading_job ${responseId}`);
      throw new Error(error.message);
    }
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
        const { data: adopted, error: adoptError } = await keyed
          .rpc('adopt_reading_job', { p_run_id: runId, p_response_id: responseId })
          .abortSignal(bound());
        /* 되찾기가 터진 것은 「되찾을 것이 없다」가 아니다 — 집기와 같이 기록에 남기고 건너뛴다(ADR 0078) */
        if (adoptError) {
          recordDbFailure(adoptError, `collect: adopt_reading_job ${runId} ${responseId}`);
          throw new Error(adoptError.message);
        }
        if (adopted === true) job = await claim();
      }
    }
  } catch (failure) {
    return { done: 'skipped', why: failure instanceof Error ? failure.message : String(failure) };
  }

  if (job === undefined) return { done: 'skipped', why: '집을 일감이 없습니다' };

  /**
   * **실패는 한 자리에서 닫는다.** 갈래가 넷인데(회수 실패·모델 실패·검사가 막음·저장
   * 실패) 자리를 나누면 하나는 알림을 안 넣는다.
   *
   * 못 닫았으면(남이 다시 집었거나 · 이미 끝났거나 · 부름이 안 닿았다) 닫았다고 말하지 않는다.
   */
  const close = async (
    code: string,
    detail: string,
    /** 쓴 토큰 — **실패에도 나간 돈이 있다**(ADR 0039). 모르면 `null` 이고 안 적는다 */
    usage: ModelUsage | null = null,
  ): Promise<CollectOutcome> => {
    const closed = await failReadingJob(keyed, 'collect', { runId: job.run_id, code, detail, usage, leaseId: lease }, bound());
    return closed ? { done: 'failed', code } : { done: 'skipped', why: `닫지 못했습니다: ${code}` };
  };

  /**
   * **놓는다** — 집으면서 `retrieving` 으로 표시했으므로 되돌려 놓아야 다음 바퀴가 곧바로 다시 집는다. 못 놓아도(부름이 안 닿음 ·
   * 남이 이미 다시 집음 · 그 사이 끝남) 임대가 지나면 풀린다 — 그래서 기록에만 남긴다.
   */
  const release = async (): Promise<void> => {
    const { error } = await keyed
      .rpc('release_reading_job', { p_run_id: job.run_id, p_lease_id: lease })
      .abortSignal(bound());
    if (error) recordDbFailure(error, `collect: release_reading_job ${job.run_id}`);
  };

  const retrieved = await retrieveBackgroundReading(responseId);

  /** **아직 도는 중이면 그대로 둔다** — 놓고 다음 바퀴를 기다린다 */
  if (retrieved.ok === 'pending') {
    await release();
    return { done: 'pending' };
  }

  /** 조회가 안 닿았다 — 결과는 provider 에 그대로 있다. 닫지 않고 놓는다 */
  if (retrieved.ok === 'unreachable') {
    await release();
    return { done: 'released', why: retrieved.detail };
  }

  if (retrieved.ok === false) return close(retrieved.code, retrieved.detail, retrieved.usage);

  /**
   * **얼린 것으로 검사한다.** 그 사이 배포가 났어도 보낸 것을 기준으로 재고, 사용자가
   * 입력을 고쳤어도 붙들어 둔 판본으로 유출을 잰다.
   *
   * **막는 것만 막는다**(ADR 0163) — 출생 원문 누출 · 동의 범위 밖 판정 · 그릴 수 없는 꼴(`blockingFindingsOf`). 나머지
   * 검사는 걸려도 저장하고, 걸린 것은 성공이든 실패든 시도마다 적는다(`noteChecks`). **저장하는 글이 검사한 글이다** — 이어쓰기
   * 답을 끼우고 샌 경로를 걷은 뒤의 글로 잰다.
   */
  const findings: CheckFinding[] = [];
  const noteChecks = async (): Promise<void> => {
    /* 부속이다 — 못 적어도 저장 · 실패는 그대로다. 원문만 기록에 남긴다(ADR 0078) */
    const { error: notNoted } = await keyed
      .rpc('note_reading_checks', { p_run_id: job.run_id, p_findings: findings.map(findingForRecord) })
      .abortSignal(bound());
    if (notNoted) console.error('collect: note_reading_checks', notNoted.code, notNoted.message);
  };

  /**
   * **이어쓰기면 답을 먼저 잰다**(ADR 0143 의 2). 지나면 첫 절 1번 본문으로 답을 **한 번만** 끼운다(`continuedMarkdownOf`).
   * 계약을 어겨도 버리지 않는다(ADR 0163) — 답이 있고 첫 절이 2 · 3 으로 비어 있으면 그대로 끼우고, 아니면(답이 없다 · 모델이
   * 1번까지 썼다) 이어쓰기 없이 본 풀이를 세운다. 어느 쪽이든 걸린 까닭을 적는다. 이어쓰기가 없는 풀이는 지금과 한 글자도 같다.
   */
  const continuation = continuationOf(job.generation);
  let markdown = retrieved.output.markdown;
  if (continuation !== null) {
    const answer = retrieved.output.continuationAnswer;
    const continued = checkContinuation({ answer, preview: continuation.preview, markdown });
    const fits = (answer ?? '').trim() !== '' && firstSectionItemNumbersOf(markdown).join(',') === '2,3';
    if (fits && answer !== undefined) markdown = continuedMarkdownOf(answer, markdown);
    if (!continued.ok) {
      findings.push({
        code: 'continuation-out-of-contract',
        detail: `${fits ? '답을 끼움' : '답 없이 세움'} — ${continued.reasons.join(' · ')}`,
      });
    }
  }

  const unleaked = withoutLeakedPaths(markdown, job.evidence);
  markdown = unleaked.markdown;
  if (unleaked.stripped.length > 0) {
    findings.push({ code: 'evidence-path-stripped', detail: `괄호째 걷음: ${unleaked.stripped.join('·')}` });
  }

  const metaphor = retrieved.output.metaphor;
  const output = { score: retrieved.output.score, metaphor, markdown };

  const secrets = [job.birth_a, ...(job.birth_b === null ? [] : [job.birth_b])].map(secretOf);
  const verdict = checkReading({
    kind: job.kind,
    output,
    evidenceText: job.evidence,
    secrets,
    // 얼린 프롬프트에서 되읽는다 — 그때 실제로 시킨 수다(ADR 0060)
    baseline: baselineIn(job.prompt) ?? undefined,
  });
  if (!verdict.ok) findings.push(...verdict.failures);

  const blocking = blockingFindingsOf(findings);
  if (blocking.length > 0) {
    // 모델은 다 돌았다 — 검사가 문 것이라 토큰은 이미 나갔다.
    const closed = await close(blocking[0].code, findings.map((f) => f.detail).join(' · '), retrieved.usage);
    await noteChecks();
    return closed;
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
    /* 빈 비유 · 본보기를 옮긴 비유는 비유가 없는 것이다 — 화면은 비유 없는 풀이를 그린다(`metaphor-out-of-contract` 로 적었다, ADR 0207) */
    p_metaphor: metaphorToStore(metaphor),
    p_evidence: job.evidence,
    p_prompt: job.prompt,
    p_prompt_version: job.prompt_version,
    /** **응답한 모델을 적는다.** 요청한 이름과 다를 수 있고, 되짚을 때 필요한 것은 이쪽이다 */
    p_model: retrieved.modelId ?? job.requested_model,
    p_generation: { ...job.generation, usage: retrieved.usage },
    p_viewed_at: job.viewed_at,
    p_lease_id: lease,
  })).abortSignal(bound());

  /**
   * **DB 가 답하지 못했으면 닫지 않고 놓는다** — 저장이 됐을 수도 있다(답만 끊김). 됐으면 일감은 이미 지워져 놓기 · 다음 집기가
   * 아무것도 안 하고, 안 됐으면 다음 바퀴가 다시 가져와 저장한다. 실제 거절(검사식 · 대상 없음 · 남이 쥠 · 끝난 시도)은 닫는다.
   */
  if (saveError && passingDbFailure(saveError)) {
    recordDbFailure(saveError, `collect: save_reading ${job.run_id}`);
    await release();
    return { done: 'released', why: saveError.message };
  }
  if (saveError) return close('save-rejected', saveError.message, retrieved.usage);
  await noteChecks();

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
