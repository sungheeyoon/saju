import { describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));

import { roomOf } from './rooms';

const row = {
  match_id: 'm-1',
  partner_user_id: 'u-1',
  partner_nickname: '상대',
  partner_has_photo: true,
  partner_left: false,
  partner_photo_focus: [10, 20, 50, 50],
  opened_at: '2026-10-11T00:00:00Z',
  closed_reason: null as string | null,
  closed_at: null as string | null,
  last_message_at: null as string | null,
  last_message_body: null as string | null,
  unread_count: 0,
  partner_activity: null as string | null,
} as unknown as Parameters<typeof roomOf>[0];

describe('roomOf — 상대 프로필 시트의 사진', () => {
  it('열린 방은 상대의 사진 전부 · 장마다의 자리를 싣는다', () => {
    const room = roomOf(row)!;
    expect(room.partnerPhotoUrls).toEqual(['/me/photo/u-1/1', '/me/photo/u-1/2']);
    expect(room.partnerPhotoFocuses).toEqual([{ x: 10, y: 20 }, { x: 50, y: 50 }]);
  });

  it('닫힌 방은 장 수 · 자리를 싣지 않고, 얼굴(대표 한 장)은 그대로다', () => {
    for (const closed of [{ closed_reason: 'block' }, { closed_reason: 'suspension' }, { closed_reason: 'deletion_request' }]) {
      const room = roomOf({ ...row, ...closed } as typeof row)!;
      expect(room.partnerPhotoUrls).toEqual([]);
      expect(room.partnerPhotoFocuses).toEqual([]);
      expect(room.partnerHasPhoto).toBe(true);
      expect(room.partnerPhotoFocus).toEqual({ x: 10, y: 20 });
    }
  });

  it('떠난 상대의 방도 싣지 않는다', () => {
    const room = roomOf({ ...row, partner_left: true } as typeof row)!;
    expect(room.partnerPhotoUrls).toEqual([]);
    expect(room.partnerPhotoFocuses).toEqual([]);
  });
});
