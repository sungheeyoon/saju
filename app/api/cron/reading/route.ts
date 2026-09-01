import { keyedClient } from '@/app/keyed-client';

import { collectReadingResult } from '../../../me/reading/collect';

/**
 * **webhook 이 흘린 것을 줍는다** (ADR 0020).
 *
 * 그물이 하나면 webhook 이 안 온 날 그 시도는 만료까지 잠긴 채로 남는다. 두 가지를
 * 한다 — 아직 안 끝난 것을 가져와 보고, 너무 오래된 것을 닫는다.
 *
 *   Supabase 복구 1분  <  우리 deadline 8분  <  DB 실행 만료 10분
 *   화면 폴링 3초 = 표시용
 *   Vercel 하루 cron = 최후 청소
 *
 * **깨우는 쪽이 둘이다.** 1분짜리는 Supabase 의 `pg_cron` 이 두드리고(`wake_reading_recovery`),
 * Vercel 은 하루 한 번 청소만 한다 — Hobby 요금제의 cron 이 하루 한 번이기 때문이고,
 * 그것을 모르고 분 단위로 적었다가 고쳤다.
 *
 * provider 회수 가능 시간은 그 줄에 없다. 「약 10분」이라고만 알려진 값이라 우리 숫자와
 * 나란히 세우면 보장 안 되는 것을 보장인 척 쓰게 된다.
 *
 * ## 왜 화면이 아니라 여기가 줍는가
 *
 * 앞서는 「아무도 다시 안 누르면 그 실패는 조용한 채로 남는다 — 그것을 말하려면 사람
 * 없이 도는 자리가 있어야 하고, 지금 그런 자리는 없다」고 적어 두었다(ADR 0017).
 * **이제 그 자리가 생겼다.**
 */

/** 여러 일감을 차례로 집는다. 하나가 오래 걸려도 다음 바퀴가 있다 */
export const maxDuration = 300;

type OpenJob = { run_id: string; response_id: string | null; overdue: boolean };

export async function GET(request: Request): Promise<Response> {
  /**
   * **올바른 `CRON_SECRET` 을 든 스케줄러만 부를 수 있다.**
   *
   * 이 주소는 로그인 관문 밖이라 아무나 두드릴 수 있고, 두드리면 남의 시도를 닫는다.
   * 두드리는 쪽이 둘이므로(Supabase 1분 · Vercel 하루) 자격도 그 둘이 같은 값을 든다 —
   * Vercel 환경변수와 Supabase Vault 에 같은 문자열을 넣는다.
   *
   * **`OPENAI_WEBHOOK_SECRET` 과 같은 값을 쓰지 않는다.** 하는 일이 다르고, 하나로 쓰면
   * 한쪽이 새는 순간 둘 다 샌다.
   */
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('forbidden', { status: 403 });
  }

  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('결과 복구');
  } catch {
    return new Response('not configured', { status: 503 });
  }

  const { data, error } = await keyed.rpc('open_reading_jobs');
  if (error) return new Response('could not list', { status: 503 });

  const jobs = (data ?? []) as OpenJob[];
  let collected = 0;
  let closed = 0;

  for (const job of jobs) {
    /**
     * **deadline 을 넘겼으면 닫는다.** 8분 뒤의 회수 가능성에 기대지 않기로 했으므로
     * 여기서 더 기다리지 않는다 — 기다리면 DB 만료가 먼저 와서 이유 없는 실패가 된다.
     */
    if (job.overdue) {
      await keyed.rpc('fail_reading_job', {
        p_run_id: job.run_id,
        p_failure_code: 'model-timeout',
        p_failure_detail: '만드는 데 너무 오래 걸렸습니다',
      });
      closed += 1;
      continue;
    }

    /**
     * 이름표가 없으면 가져올 길이 없다. 제출과 기록 사이에서 끊긴 것이고, deadline 이
     * 오면 위에서 닫힌다 — 그때까지는 webhook 이 `metadata` 로 되찾아 줄 수 있다.
     */
    if (job.response_id === null) continue;

    const outcome = await collectReadingResult(job.response_id);
    if (outcome.done === 'saved' || outcome.done === 'failed') collected += 1;
  }

  return Response.json({ open: jobs.length, collected, closed });
}
