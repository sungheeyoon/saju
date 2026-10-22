import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PRICE_OPTIONS } from '@/src/lib/survey';

const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations');
const DEFINITION = /function public\.save_service_survey\(/i;

/**
 * 화면(`app/me/survey/form.tsx`)은 `PRICE_OPTIONS` 를 보이고, 「무엇을 보여 줬나」의 기록은 `save_service_survey` 가 스스로 적는다 —
 * 앱은 목록을 보내지 않는다(2026-10-22). 둘이 갈리면 기록이 화면과 다른 목록을 말한다 — 여기서 붉다. 목록을 바꾸면 둘을 같은
 * PR 에서 고친다. 마이그레이션은 이름(시각) 차례로 서므로 그 함수를 적은 마지막 파일의 것이 지금의 정의다.
 */
describe('보여 준 금액 목록 — DB 와 상수', () => {
  it('save_service_survey 의 마지막 정의가 PRICE_OPTIONS 를 그 차례대로 싣는다', () => {
    const last = readdirSync(MIGRATIONS)
      .filter((one) => one.endsWith('.sql'))
      .sort()
      .filter((one) => DEFINITION.test(readFileSync(resolve(MIGRATIONS, one), 'utf8')))
      .at(-1);
    expect(last).toBeDefined();
    const source = readFileSync(resolve(MIGRATIONS, last ?? ''), 'utf8');
    const shown = /shown text\[\] := array\[([^\]]*)\]/.exec(source);
    expect(shown).not.toBeNull();
    const listed = [...(shown?.[1] ?? '').matchAll(/'([^']*)'/g)].map((match) => match[1]);
    expect(listed).toEqual([...PRICE_OPTIONS]);
  });
});
