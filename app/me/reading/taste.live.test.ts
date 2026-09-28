import { mkdirSync, writeFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import type { Database } from '@/src/lib/db';
import { loadLocalEnv } from '@/src/lib/local-env';
import { TASTE_KEYS, type TasteKey } from '@/src/lib/reading/taste';
import { makeTastePassages, type TasteAsk, type TasteRow } from '@/src/lib/reading/taste-maker';

import { GENERATION } from './generation';
import { callModel } from './model';

/**
 * **맛보기 표를 채우는 자리** — 운영자가 손으로 돌린다(실호출 · 토큰이 나간다, ADR 0131).
 *
 * `scripts/` 가 아니라 여기 서는 까닭: 모델을 부르는 유일한 자리(`model.ts`, ADR 0047)가 app 에 살고 `scripts/` 는
 * app 을 못 부른다(`scripts/layers.test.ts`). `call.live.test.ts` 와 같은 자리 · 같은 잠금이다 — 켜는 값이 없으면
 * 아무것도 안 부른다. 도는 차례와 거르는 규칙은 `src/lib/reading/taste-maker.ts` 가 들고 단위 시험이 모의 모델로 잰다.
 *
 * ## 돌리는 법
 *
 *   # 먼저 몇 칸만 — 표에 안 쓰고 `.taste-live/` 에 원문을 떨군다
 *   TASTE_LIVE=1 TASTE_KEYS=丙午-卯,壬子-亥 npx vitest run app/me/reading/taste.live.test.ts
 *
 *   # 읽어 보고 괜찮으면 전부 — 운영 표에 쓴다(이미 검사를 지난 칸은 건너뛴다)
 *   TASTE_LIVE=1 TASTE_WRITE=1 npx vitest run app/me/reading/taste.live.test.ts
 *
 * `TASTE_WRITE=1` 이 없으면 표에 안 쓴다. 쓰는 곳은 `.env.development.local` 의 `NEXT_PUBLIC_SUPABASE_URL`(운영)이고
 * 열쇠는 `SUPABASE_SECRET_KEY` 다 — 시작할 때 그 주소의 호스트를 찍는다. 칸은 차례대로 하나씩 부른다.
 * 720칸을 다 채우면 부름도 720번이다(규칙 검사에서 떨어진 칸은 다시 돌리면 그 칸만 다시 부른다).
 */

const live = process.env.TASTE_LIVE === '1';
const write = process.env.TASTE_WRITE === '1';
const OUTPUT_ROOT = '.taste-live';

/** 부를 칸 — 적으면 그 칸만, 안 적으면 720칸 전부 */
const chosenKeys = (): readonly TasteKey[] => {
  const listed = process.env.TASTE_KEYS?.split(',').map((key) => key.trim()).filter((key) => key !== '');
  if (listed === undefined || listed.length === 0) return TASTE_KEYS;
  const known = new Set<string>(TASTE_KEYS);
  const unknown = listed.filter((key) => !known.has(key));
  if (unknown.length > 0) throw new Error(`720칸에 없는 열쇠: ${unknown.join(', ')}`);
  return listed as TasteKey[];
};

describe.skipIf(!live)('맛보기 표를 채운다 (TASTE_LIVE=1)', () => {
  it(
    '칸마다 한 번 부르고 규칙 검사를 지난 글만 남긴다',
    async () => {
      loadLocalEnv();
      const keys = chosenKeys();

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
      const client =
        write && url !== undefined && secret !== undefined
          ? createClient<Database>(url, secret, { auth: { persistSession: false } })
          : null;
      if (write && client === null) throw new Error('TASTE_WRITE=1 인데 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SECRET_KEY 가 없다');
      console.log(write ? `쓰는 곳: ${new URL(url as string).host}` : `표에 안 쓴다 — ${OUTPUT_ROOT}/ 에 떨군다`);

      /* 이미 검사를 지난 칸 — 다시 안 부른다 */
      const done = new Set<string>();
      if (client !== null) {
        const { data, error } = await client.from('taste_passage').select('key').eq('checked', true);
        if (error) throw new Error(`이미 있는 칸을 못 읽었다: ${error.code}`);
        for (const row of data) done.add(row.key);
      }

      const ask: TasteAsk = async (prompt) => {
        const called = await callModel(prompt);
        return called.ok
          ? { ok: true, body: called.output.markdown, model: called.modelId ?? GENERATION.model }
          : { ok: false, detail: `${called.code}: ${called.detail}` };
      };

      const rows: TasteRow[] = [];
      const report = await makeTastePassages({
        keys,
        done,
        ask,
        write: async (row) => {
          rows.push(row);
          if (client === null) return;
          const { error } = await client.from('taste_passage').upsert({ ...row, made_at: new Date().toISOString() });
          if (error) throw new Error(`${row.key} 를 못 적었다: ${error.code}`);
        },
      });

      mkdirSync(OUTPUT_ROOT, { recursive: true });
      const file = `${OUTPUT_ROOT}/${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.json`;
      writeFileSync(file, JSON.stringify({ ...report, rows }, null, 2));
      console.log(
        `적음 ${report.written.length} · 검사 탈락 ${report.rejected.length} · 부름 실패 ${report.failed.length} · 건너뜀 ${report.skipped.length} — ${file}`,
      );

      expect(report.written.length + report.rejected.length + report.failed.length + report.skipped.length).toBe(keys.length);
    },
    /* 한 칸에 몇 초 — 720칸이면 한 시간 남짓이다 */
    4 * 60 * 60 * 1000,
  );
});
