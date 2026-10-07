import { describe, expect, it } from 'vitest';

import { CHAT_UNREAD_MOVED } from '../me/chat/unread-signal';
import { READING_CREDITS_MOVED } from '../me/reading/credits-signal';
import { NOTIFICATIONS_UNREAD_MOVED, REQUESTS_TO_ANSWER_MOVED } from '../me/requests/unread-signal';
import { ALL_SIGNALS, liveChangeOf, redrawsOn, redrawsOnResync, signalsOf } from './changes';

const MATCH = '6b3f1d6e-1c7a-4b8e-9a1f-2c3d4e5f6a7b';

describe('채널이 실어 온 한 건', () => {
  it('갈래 · 방 · 차례를 읽고, 차례는 글자로 와도 받는다', () => {
    expect(liveChangeOf({ area: 'chat', match_id: MATCH, seq: 42 })).toEqual({ area: 'chat', matchId: MATCH, seq: 42 });
    expect(liveChangeOf({ area: 'chat', match_id: MATCH, seq: '42' })).toEqual({ area: 'chat', matchId: MATCH, seq: 42 });
    expect(liveChangeOf({ area: 'credits', match_id: null, seq: null })).toEqual({ area: 'credits', matchId: null, seq: null });
    expect(liveChangeOf({ area: 'notifications' })).toEqual({ area: 'notifications', matchId: null, seq: null });
  });

  it('모르는 모양은 버린다', () => {
    expect(liveChangeOf(null)).toBeNull();
    expect(liveChangeOf('chat')).toBeNull();
    expect(liveChangeOf({ area: 'presence' })).toBeNull();
    expect(liveChangeOf({ area: 'chat', match_id: 7 })).toBeNull();
    expect(liveChangeOf({ area: 'chat', match_id: MATCH, seq: 'x' })).toBeNull();
  });
});

describe('갈래 → 신호', () => {
  it('채팅은 채팅 딱지, 요청은 인연 딱지와 종, 소식은 종, 풀이권은 잔액을 다시 센다', () => {
    expect(signalsOf('chat')).toEqual([CHAT_UNREAD_MOVED]);
    expect(signalsOf('requests')).toEqual([REQUESTS_TO_ANSWER_MOVED, NOTIFICATIONS_UNREAD_MOVED]);
    expect(signalsOf('notifications')).toEqual([NOTIFICATIONS_UNREAD_MOVED]);
    expect(signalsOf('credits')).toEqual([READING_CREDITS_MOVED]);
  });

  it('다시 대조는 넷을 다 다시 센다', () => {
    expect([...ALL_SIGNALS].sort()).toEqual(
      [CHAT_UNREAD_MOVED, NOTIFICATIONS_UNREAD_MOVED, READING_CREDITS_MOVED, REQUESTS_TO_ANSWER_MOVED].sort(),
    );
  });
});

describe('갈래 → 다시 그릴 화면', () => {
  it('채팅은 대화방 목록과 방에서만 다시 그린다', () => {
    expect(redrawsOn('chat', '/me/chat')).toBe(true);
    expect(redrawsOn('chat', `/me/chat/${MATCH}`)).toBe(true);
    expect(redrawsOn('chat', '/me')).toBe(false);
    expect(redrawsOn('chat', '/me/chatty')).toBe(false);
  });

  it('요청은 인연 탭 · 소식 · 인연 궁합 · 홈 · 보관함 · 대화방에서 다시 그린다', () => {
    for (const path of ['/me', '/me/matching', '/me/matching/history', '/me/requests', `/me/match/${MATCH}`, '/me/readings', '/me/chat']) {
      expect(redrawsOn('requests', path), path).toBe(true);
    }
    expect(redrawsOn('requests', '/me/profile')).toBe(false);
    expect(redrawsOn('requests', '/')).toBe(false);
  });

  it('소식은 소식 화면과 홈, 풀이권은 어디서도 다시 그리지 않는다(머리글만 든다)', () => {
    expect(redrawsOn('notifications', '/me/requests')).toBe(true);
    expect(redrawsOn('notifications', '/me')).toBe(true);
    expect(redrawsOn('notifications', '/me/chat')).toBe(false);
    expect(redrawsOn('credits', '/me')).toBe(false);
  });

  it('다시 대조는 어느 갈래로든 다시 그리는 화면에서만 다시 그린다', () => {
    expect(redrawsOnResync('/me/chat')).toBe(true);
    expect(redrawsOnResync('/me/settings')).toBe(false);
    expect(redrawsOnResync('/')).toBe(false);
  });
});
