import { createClient } from '@supabase/supabase-js';

import { needSummaryOf } from '../src/lib/discovery/need-summary';
import type { ChartSnapshot } from '../src/lib/saju';

/**
 * 기존 참여자의 **필요한 기운 요약**을 한 번에 채운다 — `v2-beta` 전환 백필 (ADR 0113 개정 3b).
 *
 * 카드 점수의 「서로 채우는 기운」 축은 억부 1순위와 가장 무거운 기운을 쓰고, 그 요약이 없는 참여자는 풀에서
 * 빠진다(가운데 값을 넣지 않는다). 앱을 열면 저절로 채워지지만 그때까지 빠져 있으므로, 전환 때 한 번 채운다.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… npx jiti scripts/backfill-need-summary.ts           # 셈만
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… npx jiti scripts/backfill-need-summary.ts --apply   # 적는다
 *
 * - **기본은 셈만 한다**(dry-run). `--apply` 를 붙여야 적는다.
 * - **여덟 글자에서만 만든다**(`person.current_chart`) — 생년월일시 · 출생지는 읽지도 않는다. 억부는 기둥 넷만 본다.
 * - **멱등이다.** 대상은 요약이 없거나 지금 입력 · 엔진의 것이 아닌 사람뿐이고(`need_summary_backfill_targets`),
 *   다 채우면 여덟 글자가 없는 사람만 남는다. 적는 문(`set_discovery_need_summary`)은 읽은 뒤 입력이 바뀐 사람에게
 *   안 적는다 — 그 사람은 다음에 앱을 열 때 채운다.
 * - **찍는 것은 수뿐이다** — 채움 · 건너뜀 · 실패. 여덟 글자 · 요약 · id 는 한 줄도 안 찍는다.
 * - 열쇠는 환경변수에서만 읽는다. 파일(`.env.*`)을 스스로 읽지 않는다 — 어디를 치는지는 부르는 사람이 적는다.
 *
 * 여덟 글자가 없어 셀 수 없는 사람은 **건너뜀**이고, 풀에서 빠진 채로 남는다(낡은 요약과 같은 규칙).
 */

type Target = {
  user_id: string;
  chart: ChartSnapshot | null;
  input_version: number;
  chart_engine_version: string | null;
};

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 와 SUPABASE_SECRET_KEY 를 환경변수로 적어야 합니다.');
  }

  const keyed = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await keyed.rpc('need_summary_backfill_targets');
  if (error) throw new Error(`대상을 읽지 못했습니다 (${error.code ?? 'unknown'})`);
  const targets = (data ?? []) as Target[];

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of targets) {
    if (target.chart === null) {
      skipped += 1;
      continue;
    }

    let need;
    try {
      need = needSummaryOf(target.chart);
    } catch {
      failed += 1;
      continue;
    }

    if (!apply) {
      updated += 1;
      continue;
    }

    const { data: written, error: writeError } = await keyed.rpc('set_discovery_need_summary', {
      p_user_id: target.user_id,
      p_need: need,
      p_input_version: target.input_version,
      p_chart_engine_version: target.chart_engine_version ?? '',
    });
    if (writeError) failed += 1;
    else if (written === true) updated += 1;
    else skipped += 1;
  }

  process.stdout.write(
    [
      `mode: ${apply ? 'apply' : 'dry-run'}`,
      `targets: ${targets.length}`,
      `${apply ? 'updated' : 'would-update'}: ${updated}`,
      `skipped: ${skipped}`,
      `failed: ${failed}`,
      '',
    ].join('\n'),
  );

  if (failed > 0) process.exitCode = 1;
}

main().catch((thrown: unknown) => {
  process.stderr.write(`${thrown instanceof Error ? thrown.message : '백필이 멈췄습니다'}\n`);
  process.exitCode = 1;
});
