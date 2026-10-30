import { describe, expect, it } from 'vitest';

import { read, type SkippableRead } from '../../../db-error';
import { compatRowParts, roomCompatOf, type RoomCompat } from '@/src/lib/chat/room/compat';

const missed: SkippableRead<never> = { ok: false, reason: '못 읽었어요' };

describe('roomCompatOf', () => {
  it('글이 있으면 그 글의 점수가 선다 — 시도가 무엇이든', () => {
    expect(roomCompatOf(read({ score: 72 }), read('failed'))).toEqual({ kind: 'ready', score: 72 });
    expect(roomCompatOf(read({ score: 0 }), missed)).toEqual({ kind: 'ready', score: 0 });
  });

  it('점수가 없는 글은 이름만 선다 — 점수를 지어내지 않는다', () => {
    expect(roomCompatOf(read({ score: null }), read('succeeded'))).toEqual({ kind: 'quiet' });
  });

  it('글이 없고 시도가 돌면 만드는 중, 실패했으면 실패다', () => {
    expect(roomCompatOf(read(null), read('running'))).toEqual({ kind: 'making' });
    expect(roomCompatOf(read(null), read('failed'))).toEqual({ kind: 'failed' });
  });

  it('글도 시도도 없으면 이름만 선다', () => {
    expect(roomCompatOf(read(null), read(null))).toEqual({ kind: 'quiet' });
  });

  it('글을 못 읽은 날은 시도가 실패여도 실패라 말하지 않는다 — 글이 있는데 못 읽은 것일 수 있다', () => {
    expect(roomCompatOf(missed, read('failed'))).toEqual({ kind: 'quiet' });
    expect(roomCompatOf(read(null), missed)).toEqual({ kind: 'quiet' });
  });
});

describe('compatRowParts — 시트의 궁합 한 줄', () => {
  const states: RoomCompat[] = [{ kind: 'ready', score: 82 }, { kind: 'making' }, { kind: 'failed' }, { kind: 'quiet' }];

  it.each(states)('읽는 이름이 보이는 글자를 차례대로 다 품고 「궁합」으로 시작한다 (WCAG 2.5.3) — %o', (compat) => {
    const { lead, tail, name } = compatRowParts(compat);
    const shown = [...lead, ...(tail === null ? [] : [tail])];
    let from = 0;
    for (const word of shown) {
      const at = name.indexOf(word, from);
      expect(at, `「${word}」`).toBeGreaterThanOrEqual(from);
      from = at + word.length;
    }
    expect(name).toMatch(/^궁합/);
  });

  it('볼 풀이가 있을 때만 「궁합풀이 보기」, 실패면 「다시 받기」, 그 밖에는 끝 글자가 없다', () => {
    expect(compatRowParts({ kind: 'ready', score: 82 }).name).toBe('궁합 82점 궁합풀이 보기');
    expect(compatRowParts({ kind: 'failed' }).name).toBe('궁합 다시 받기');
    expect(compatRowParts({ kind: 'making' }).tail).toBeNull();
    expect(compatRowParts({ kind: 'quiet' }).name).toBe('궁합');
  });
});

