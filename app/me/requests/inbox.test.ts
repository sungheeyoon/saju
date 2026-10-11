import { beforeEach, describe, expect, it, vi } from 'vitest';

import { inboxForViewer, matchOfAcceptedRequest } from './inbox';

vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));

import { supabaseOnServer } from '../../auth/server-client';

/**
 * **성립은 그 인연 궁합으로 간다**(ADR 0130 「2026-10-11」) — 수락한 사람도, 성립 소식을 누른 사람도.
 * 다른 요청 소식은 인연 탭이다.
 */

const answering = (answers: Record<string, { data: unknown; error: unknown }>) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({ rpc: async (name: string) => answers[name] } as never);

const notification = (over: Record<string, unknown>) => ({
  notification_id: 'n',
  kind: 'request_accepted',
  counterpart_nickname: '다온',
  request_id: 'r1',
  match_id: null,
  reading_kind: null,
  reading_person_a: null,
  reading_person_b: null,
  created_at: '2026-10-11T00:00:00Z',
  read_at: null,
  reading_label_a: null,
  reading_label_b: null,
  ...over,
});

const requestRow = (over: Record<string, unknown>) => ({
  request_id: 'r1',
  direction: 'received',
  counterpart_user_id: 'u-daon',
  counterpart_nickname: '다온',
  counterpart_intro: null,
  counterpart_has_photo: false,
  status: 'accepted',
  supplied_to_me: null,
  supplied_to_them: null,
  balance_band: 'balanced',
  created_at: '2026-10-11T00:00:00Z',
  decided_at: '2026-10-11T00:01:00Z',
  counterpart_photo_focus: [],
  ...over,
});

const matchRow = (over: Record<string, unknown>) => ({
  match_id: 'm1',
  partner_user_id: 'u-daon',
  partner_nickname: '다온',
  partner_intro: null,
  partner_has_photo: false,
  supplied_to_me: null,
  balance_band: 'balanced',
  created_at: '2026-10-11T00:01:00Z',
  partner_photo_focus: [],
  ...over,
});

beforeEach(() => vi.mocked(supabaseOnServer).mockReset());

describe('소식이 가는 곳', () => {
  it('성립 소식은 그 Match 의 채팅방으로 간다 — 수락한 쪽이 도착한 그 방이다', async () => {
    answering({ my_notifications: { data: [notification({ match_id: 'm1' })], error: null } });

    const { notifications } = await inboxForViewer();
    expect(notifications.map((one) => one.href)).toEqual(['/me/chat/m1']);
  });

  it('Match 를 안 든 성립 소식과 다른 요청 소식은 인연 탭이다', async () => {
    answering({
      my_notifications: {
        data: [
          notification({ notification_id: 'a', match_id: null }),
          notification({ notification_id: 'b', kind: 'request_rejected' }),
          notification({ notification_id: 'c', kind: 'request_received' }),
        ],
        error: null,
      },
    });

    const { notifications } = await inboxForViewer();
    expect(notifications.map((one) => one.href)).toEqual(['/me/matching', '/me/matching', '/me/matching']);
  });
});

describe('방금 수락한 요청의 인연 궁합', () => {
  it('그 요청의 상대와 맺어진 Match 다', async () => {
    answering({
      my_match_requests: { data: [requestRow({ request_id: 'r0', counterpart_user_id: 'u-other' }), requestRow({})], error: null },
      my_matches: { data: [matchRow({ match_id: 'm0', partner_user_id: 'u-other' }), matchRow({})], error: null },
    });

    expect(await matchOfAcceptedRequest('r1')).toBe('m1');
  });

  it('지금 볼 수 있는 Match 가 없으면 `null` 이다 — 옮기지 않는다', async () => {
    answering({
      my_match_requests: { data: [requestRow({})], error: null },
      my_matches: { data: [], error: null },
    });

    expect(await matchOfAcceptedRequest('r1')).toBeNull();
  });

  it('못 읽으면 던진다 — 액션이 받아 옮기지 않고 답한다', async () => {
    answering({
      my_match_requests: { data: [requestRow({})], error: null },
      my_matches: { data: null, error: { message: 'fetch failed' } },
    });

    await expect(matchOfAcceptedRequest('r1')).rejects.toThrow();
  });
});
