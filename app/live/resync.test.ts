import { describe, expect, it, vi } from 'vitest';

import { ALL_SIGNALS } from './changes';
import { opened, step } from './connection';
import { resyncScreen } from './resync';

const hands = () => ({ announce: vi.fn(), chatMoved: vi.fn(), redraw: vi.fn() });

describe('다시 대조', () => {
  it('채널이 처음 선 때도 목록 화면을 다시 그린다 — 서버가 그린 뒤 서기 전의 변경을 놓치지 않는다', () => {
    const h = hands();
    for (const effect of step(opened(true), { type: 'subscribed' }).effects) if (effect.type === 'resync') resyncScreen('/me/chat', h);
    expect(h.redraw).toHaveBeenCalledTimes(1);
    expect(h.announce).toHaveBeenCalledWith(ALL_SIGNALS);
    expect(h.chatMoved).toHaveBeenCalledTimes(1);
  });

  it('인연 탭 · 소식도 다시 그리고, 다시 그릴 것이 없는 화면은 딱지와 방만 다시 읽는다', () => {
    for (const path of ['/me/matching', '/me/requests', '/me']) {
      const h = hands();
      resyncScreen(path, h);
      expect(h.redraw).toHaveBeenCalledTimes(1);
    }
    const h = hands();
    resyncScreen('/me/settings', h);
    expect(h.redraw).not.toHaveBeenCalled();
    expect(h.announce).toHaveBeenCalledTimes(1);
  });
});
