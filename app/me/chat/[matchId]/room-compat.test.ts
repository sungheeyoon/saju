import { describe, expect, it } from 'vitest';

import { read, type SkippableRead } from '../../../db-error';
import { roomCompatOf } from './room-compat';

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
