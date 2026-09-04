import { describe, expect, it } from 'vitest';

import type { ReadingEntry } from './current';
import { readingHref, readingTitle } from './line';

/**
 * 목록 한 줄 — **제목과 주소는 한 갈래에서 함께 난다.**
 *
 * 네 kind 를 두 번 가르는 자리라, 갈래 하나가 늘면 두 곳을 고쳐야 한다. 여기서
 * 붙들어 두는 것은 **그 짝**이다: 어떤 kind 든 제목이 서고 주소가 그 대상의 화면을
 * 가리키는가.
 */
const entry = (over: Partial<ReadingEntry>): ReadingEntry => ({
  kind: 'self',
  personA: null,
  personB: null,
  matchId: null,
  labelA: null,
  labelB: null,
  score: null,
  createdAt: '2026-09-03T00:00:00Z',
  fromCurrentRevision: true,
  ...over,
});

describe('줄에 적히는 말', () => {
  it('내 사주는 이름을 안 쓴다', () => {
    expect(readingTitle(entry({ kind: 'self' }))).toBe('내 사주');
  });

  it('저장한 사람은 내가 부르는 이름으로 선다', () => {
    expect(readingTitle(entry({ kind: 'person', personA: 'p1', labelA: '어머니' }))).toBe(
      '어머니 사주',
    );
  });

  it('두 사람 궁합은 둘을 함께 부른다', () => {
    expect(
      readingTitle(
        entry({ kind: 'private', personA: 'p1', personB: 'p2', labelA: '어머니', labelB: '철수' }),
      ),
    ).toBe('어머니 × 철수 궁합');
  });

  /** `match` 의 이름은 상대의 공개 별명이다 — `local_label` 은 매칭 상대에게 없다 */
  it('함께 보는 궁합은 상대의 별명으로 선다', () => {
    expect(readingTitle(entry({ kind: 'match', matchId: 'm1', labelA: '바람' }))).toBe('바람 궁합');
  });
});

describe('누르면 가는 곳', () => {
  it('네 kind 가 저마다 제 대상의 화면으로 간다', () => {
    expect(readingHref(entry({ kind: 'self' }))).toBe('/me');
    expect(readingHref(entry({ kind: 'person', personA: 'p1' }))).toBe('/me/people/p1');
    expect(readingHref(entry({ kind: 'private', personA: 'p1', personB: 'p2' }))).toBe(
      '/me/compat?a=p1&b=p2',
    );
    expect(readingHref(entry({ kind: 'match', matchId: 'm1' }))).toBe('/me/match/m1');
  });

  /**
   * **목록은 본문을 싣지 않는다**(ADR 0008·0033). 그래서 가는 곳이 목록 안의 칸이
   * 아니라 그 글이 원래 사는 화면이다 — 주소에 결과를 여는 조각이 붙으면 그 순간
   * 이 목록이 두 번째 결과 화면이 된다.
   */
  it('목록 안에서 결과를 여는 주소를 만들지 않는다', () => {
    for (const one of [
      entry({ kind: 'self' }),
      entry({ kind: 'person', personA: 'p1' }),
      entry({ kind: 'private', personA: 'p1', personB: 'p2' }),
      entry({ kind: 'match', matchId: 'm1' }),
    ]) {
      expect(readingHref(one).startsWith('/me/readings')).toBe(false);
    }
  });
});
