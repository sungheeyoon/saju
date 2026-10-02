import { describe, expect, it } from 'vitest';

import {
  RESERVE_OUTCOMES,
  answerOfReserve,
  answerOfView,
  ipSubjectOf,
  isReserveOutcome,
  seoulDateOf,
} from './taste-visit';

describe('예약 갈래 → 화면 상태 (ADR 0143)', () => {
  it('한도 넷은 화면에서 하나의 「한도」다 — 어느 한도인지 안 알린다', () => {
    for (const outcome of ['limited_request', 'limited_browser', 'limited_ip', 'limited_global'] as const) {
      expect(answerOfReserve(outcome)).toEqual({ state: 'limited' });
    }
  });

  it('세 번 실패한 입력은 다시 읽기를 안 연다 — 가입 경로만 남는다', () => {
    expect(answerOfReserve('retries_exhausted')).toEqual({ state: 'failed', retry: false });
  });

  it('부르기 · 재사용 · 기다림은 세션을 따로 간다', () => {
    expect(answerOfReserve('call_model')).toBeNull();
    expect(answerOfReserve('reuse_succeeded')).toBeNull();
    expect(answerOfReserve('wait_running')).toBeNull();
  });

  it('갈래 이름은 DB 의 여덟 그대로이고, 모르는 값은 갈래가 아니다', () => {
    expect(RESERVE_OUTCOMES).toHaveLength(8);
    expect(isReserveOutcome('call_model')).toBe(true);
    expect(isReserveOutcome('limited_everything')).toBe(false);
  });
});

describe('세션 읽기 → 화면 상태', () => {
  const id = '00000000-0000-4000-8000-000000000001';

  it('성공은 글과 세션 id 를 함께 낸다', () => {
    expect(answerOfView({ state: 'succeeded', retryable: false, preview: '글' }, id)).toEqual({
      state: 'ready',
      sessionId: id,
      preview: '글',
    });
  });

  it('도는 중이면 기다린다 · 실패면 DB 가 센 다시 읽기 여부를 따른다 · 시간 초과를 가른다', () => {
    expect(answerOfView({ state: 'running', retryable: false, preview: null }, id)).toEqual({ state: 'waiting', sessionId: id });
    expect(answerOfView({ state: 'failed', retryable: true, preview: null }, id)).toEqual({ state: 'failed', retry: true });
    expect(answerOfView({ state: 'failed', retryable: false, preview: null }, id)).toEqual({ state: 'failed', retry: false });
    expect(answerOfView({ state: 'failed', retryable: true, preview: null }, id, 'timeout')).toEqual({ state: 'timeout', retry: true });
  });

  it('못 읽은 세션 · 이미 귀속된 세션 · 빈 글은 다시 읽기를 연다 — 남의 글을 세우지 않는다', () => {
    expect(answerOfView(null, id)).toEqual({ state: 'failed', retry: true });
    expect(answerOfView({ state: 'claimed', retryable: false, preview: null }, id)).toEqual({ state: 'failed', retry: true });
    expect(answerOfView({ state: 'succeeded', retryable: false, preview: '  ' }, id)).toEqual({ state: 'failed', retry: true });
  });
});

describe('서울 날짜 — IP 키가 바뀌는 자정', () => {
  it('UTC 14:59:59 는 그날, 15:00 은 서울의 다음 날이다', () => {
    expect(seoulDateOf(new Date('2026-10-03T14:59:59.999Z'))).toBe('2026-10-03');
    expect(seoulDateOf(new Date('2026-10-03T15:00:00.000Z'))).toBe('2026-10-04');
  });

  it('UTC 자정은 서울로는 이미 아홉 시 — 날이 바뀌지 않는다', () => {
    expect(seoulDateOf(new Date('2026-10-04T00:00:00.000Z'))).toBe('2026-10-04');
  });
});

describe('IP 의 이름', () => {
  it('헤더의 첫 칸만 읽는다', () => {
    expect(ipSubjectOf('203.0.113.7, 10.0.0.1')).toBe('203.0.113.7');
    expect(ipSubjectOf(' 203.0.113.7 ')).toBe('203.0.113.7');
  });

  it('IPv6 는 /64 로 접는다 — 같은 가입자가 주소를 바꿔도 같은 이름이다', () => {
    expect(ipSubjectOf('2001:db8:1:2:aaaa::1')).toBe('2001:0db8:0001:0002::/64');
    expect(ipSubjectOf('2001:db8:1:2:bbbb:cccc:dddd:eeee')).toBe('2001:0db8:0001:0002::/64');
    expect(ipSubjectOf('::1')).toBe('0000:0000:0000:0000::/64');
  });

  it('IPv4 를 품은 IPv6 는 그 IPv4 다', () => {
    expect(ipSubjectOf('::ffff:198.51.100.4')).toBe('198.51.100.4');
  });

  it('IP 가 아니면 `null` — 그 자리를 닫는다', () => {
    expect(ipSubjectOf(null)).toBeNull();
    expect(ipSubjectOf('')).toBeNull();
    expect(ipSubjectOf('unknown')).toBeNull();
    expect(ipSubjectOf('999.1.1.1')).toBeNull();
    expect(ipSubjectOf('1:2:3')).toBeNull();
  });
});
