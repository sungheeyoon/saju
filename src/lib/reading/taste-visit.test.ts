import { describe, expect, it } from 'vitest';

import {
  RESERVE_OUTCOMES,
  TASTE_CLOSED,
  answerOfReserve,
  answerOfView,
  ipSubjectOf,
  isReserveOutcome,
  seoulDateOf,
  tasteFirstSectionOf,
} from './taste-visit';

describe('예약 갈래 → 화면 상태 (ADR 0143)', () => {
  it('한도 넷은 화면에서 하나의 「한도」다 — 어느 한도인지 안 알린다', () => {
    for (const outcome of ['limited_request', 'limited_browser', 'limited_ip', 'limited_global'] as const) {
      expect(answerOfReserve(outcome)).toEqual({ state: 'limited' });
    }
  });

  it('세 번 실패한 입력은 다시 시도를 안 연다 — 가입 경로만 남는다', () => {
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

  it('도는 중이면 기다린다 · 실패면 DB 가 센 다시 시도 여부를 따른다 · 시간 초과를 가른다', () => {
    expect(answerOfView({ state: 'running', retryable: false, preview: null }, id)).toEqual({ state: 'waiting', sessionId: id });
    expect(answerOfView({ state: 'failed', retryable: true, preview: null }, id)).toEqual({ state: 'failed', retry: true });
    expect(answerOfView({ state: 'failed', retryable: false, preview: null }, id)).toEqual({ state: 'failed', retry: false });
    expect(answerOfView({ state: 'failed', retryable: true, preview: null }, id, 'timeout')).toEqual({ state: 'timeout', retry: true });
  });

  it('못 읽은 세션 · 이미 귀속된 세션 · 빈 글은 다시 시도를 연다 — 남의 글을 세우지 않는다', () => {
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

  it('IPv6 는 /56 으로 접는다 — 한 /56 안에서 /64 를 돌려 가며 바꿔도 같은 이름이다', () => {
    expect(ipSubjectOf('2001:db8:1:2:aaaa::1')).toBe('2001:0db8:0001:0000::/56');
    expect(ipSubjectOf('2001:db8:1:2:bbbb:cccc:dddd:eeee')).toBe('2001:0db8:0001:0000::/56');
    /* 흔한 VPS 할당 /56 하나 안의 /64 둘 — /64 로 접던 때는 두 이름이었다 */
    expect(ipSubjectOf('2001:db8:1:ab01::1')).toBe(ipSubjectOf('2001:db8:1:abff::1'));
    expect(ipSubjectOf('2001:db8:1:ab01::1')).toBe('2001:0db8:0001:ab00::/56');
    expect(ipSubjectOf('::1')).toBe('0000:0000:0000:0000::/56');
  });

  it('/56 밖은 다른 이름이다 — 옆 /56 과 묶지 않는다', () => {
    expect(ipSubjectOf('2001:db8:1:ab00::1')).not.toBe(ipSubjectOf('2001:db8:1:ac00::1'));
    expect(ipSubjectOf('2001:db8:1::1')).not.toBe(ipSubjectOf('2001:db8:2::1'));
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

describe('잠긴 목차 첫 절의 모양 (운영자 결정 2026-10-10, ADR 0143 「2026-10-10 덧」)', () => {
  it('답이 없거나 누가 쓰고 있으면 「작성 중」 · 글이 섰으면 글이다', () => {
    expect(tasteFirstSectionOf(null)).toBe('writing');
    expect(tasteFirstSectionOf({ state: 'waiting', sessionId: 's' })).toBe('writing');
    expect(tasteFirstSectionOf({ state: 'ready', sessionId: 's', preview: '글' })).toBe('ready');
  });

  it('실패 · 시간 초과는 다음 시도가 열려 있을 때만 「다시 시도하기」가 선다', () => {
    expect(tasteFirstSectionOf({ state: 'failed', retry: true })).toBe('retry');
    expect(tasteFirstSectionOf({ state: 'timeout', retry: true })).toBe('retry');
    expect(tasteFirstSectionOf({ state: 'failed', retry: false })).toBe('closed');
    expect(tasteFirstSectionOf({ state: 'timeout', retry: false })).toBe('closed');
  });

  it('한도 · 서버가 닫은 자리는 단추 없이 닫힌다 — 눌러도 같다', () => {
    expect(tasteFirstSectionOf({ state: 'limited' })).toBe('closed');
    expect(tasteFirstSectionOf(TASTE_CLOSED)).toBe('closed');
  });
});
