import { describe, expect, it } from 'vitest';

import { sharedReadingOfRow, sharedTitle } from './shared';

type Row = NonNullable<Parameters<typeof sharedReadingOfRow>[0]>;

const row = (over: Partial<Row> = {}) =>
  ({ kind: 'self', name_a: '민수', name_b: null, metaphor: null, score: null, body: '## 본문', ...over }) as Row;

describe('받은 공유본의 판정', () => {
  it('행이 없거나 주소가 맡은 갈래와 다르면 안 연다', () => {
    expect(sharedReadingOfRow(undefined, 'self')).toBeNull();
    expect(sharedReadingOfRow(row(), 'private')).toBeNull();
    expect(sharedReadingOfRow(row(), 'self')?.body).toBe('## 본문');
  });

  it('궁합 글의 자리 호칭은 얼린 두 이름으로, 이름이 하나라도 없으면 호칭 그대로다', () => {
    const body = '첫번째님과 두번째님';
    expect(sharedReadingOfRow(row({ kind: 'private', name_b: '지영', body }), 'private')?.body).toBe('민수님과 지영님');
    expect(sharedReadingOfRow(row({ kind: 'private', body }), 'private')?.body).toBe(body);
  });
});

describe('공유본의 제목', () => {
  it('이름이 있으면 누구의 무엇인지, 없으면 갈래 이름만', () => {
    expect(sharedTitle('self', '민수', null)).toBe('민수님의 사주풀이');
    expect(sharedTitle('person', null, null)).toBe('사주풀이');
    expect(sharedTitle('private', '민수', '지영')).toBe('민수님 × 지영님 궁합풀이');
    expect(sharedTitle('private', '민수', null)).toBe('두 사람의 궁합풀이');
  });
});
