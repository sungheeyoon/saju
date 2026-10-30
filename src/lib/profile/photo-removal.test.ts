import { describe, expect, it, vi } from 'vitest';

import { answerRemoval } from './photo-removal';

describe('사진 지우기는 묻고 나서 지운다', () => {
  it('취소하면 안 지운다 — 서버에 아무것도 안 보낸다', async () => {
    const remove = vi.fn(async () => ({ ok: true as const }));
    expect(await answerRemoval(20, 'cancel', remove)).toEqual({ open: false, removed: false });
    expect(remove).not.toHaveBeenCalled();
  });

  it('확인하면 그 장을 지운다', async () => {
    const remove = vi.fn(async () => ({ ok: true as const }));
    expect(await answerRemoval(20, 'confirm', remove)).toEqual({ open: false, removed: true });
    expect(remove).toHaveBeenCalledExactlyOnceWith(20);
  });

  it('서버가 거절하면 창이 열린 채 까닭을 세운다', async () => {
    const remove = vi.fn(async () => ({ ok: false as const, message: '처리하지 못했어요. 다시 시도해 주세요.' }));
    expect(await answerRemoval(20, 'confirm', remove)).toEqual({
      open: true,
      failure: '처리하지 못했어요. 다시 시도해 주세요.',
    });
  });

  it('묻는 장이 없으면 아무것도 안 한다', async () => {
    const remove = vi.fn(async () => ({ ok: true as const }));
    expect(await answerRemoval(null, 'confirm', remove)).toEqual({ open: false, removed: false });
    expect(remove).not.toHaveBeenCalled();
  });
});
