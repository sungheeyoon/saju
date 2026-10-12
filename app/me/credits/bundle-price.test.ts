import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { READING_BUNDLES } from '@/src/lib/reading/bundle';

const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations');
const DEFINITION = 'function public.reading_bundle_price(';

/** `reading_bundle_price` 의 가장 최근 정의 — 마이그레이션은 이름(시각) 차례로 서므로 마지막 파일의 것이다 */
const latestDefinition = (): string => {
  const last = readdirSync(MIGRATIONS)
    .filter((one) => one.endsWith('.sql'))
    .sort()
    .filter((one) => readFileSync(resolve(MIGRATIONS, one), 'utf8').includes(DEFINITION))
    .at(-1);
  expect(last).toBeDefined();
  const source = readFileSync(resolve(MIGRATIONS, last ?? ''), 'utf8');
  const start = source.lastIndexOf(DEFINITION);
  const end = source.indexOf('$$;', start);
  return source.slice(start, end);
};

/**
 * 주문 금액은 DB 의 `reading_bundle_price` 가 정하고, 화면 · 약관 · 환불정책은 `READING_BUNDLES` 를 말한다(ADR 0176).
 * 둘이 갈리면 사람이 본 값과 카드에 걸리는 값이 다르다 — 여기서 붉다. 가격을 바꾸면 둘을 같은 PR 에서 고친다.
 */
describe('묶음 가격 — DB 와 상수', () => {
  it('reading_bundle_price 의 마지막 정의가 READING_BUNDLES 와 같은 회차 · 가격만 든다', () => {
    const body = latestDefinition();
    const pairs = [...body.matchAll(/when\s+(\d+)\s+then\s+(\d+)/g)].map((match) => ({
      credits: Number(match[1]),
      price: Number(match[2]),
    }));
    expect(pairs).toEqual(READING_BUNDLES.map(({ credits, price }) => ({ credits, price })));
    expect(body).not.toMatch(/\belse\b/);
  });
});
