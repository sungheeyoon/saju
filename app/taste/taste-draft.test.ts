import { describe, expect, it } from 'vitest';

import { DEFAULT_QUERY, queryFromSearchParams, toSearchParams } from '@/src/lib/input/query';

import { tasteDraftOf } from './taste-draft';

describe('첫 화면 문단의 요청', () => {
  const named = { ...DEFAULT_QUERY, date: '1990-05-17', time: '08:30', hourKnown: true, name: '민수' };

  it('이름을 싣지 않는다', () => {
    const sent = tasteDraftOf(named);
    expect(new URLSearchParams(sent).has('name')).toBe(false);
    /* 견본이 정말 이름을 싣는 입력인지 — 이름을 빼지 않은 모양에는 있다 */
    expect(new URLSearchParams(toSearchParams(named).toString()).get('name')).toBe('민수');
  });

  /** 빼는 것은 이름뿐이다 — 서버가 다시 읽으면 같은 명식의 입력이다 */
  it('이름 말고는 주소 모양 그대로다', () => {
    expect(queryFromSearchParams(new URLSearchParams(tasteDraftOf(named)))).toEqual(
      queryFromSearchParams(new URLSearchParams(toSearchParams({ ...named, name: '' }).toString())),
    );
    expect(tasteDraftOf(named)).toBe(toSearchParams({ ...named, name: '' }).toString());
  });
});
