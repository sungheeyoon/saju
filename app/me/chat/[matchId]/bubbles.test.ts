import { describe, expect, it } from 'vitest';

import { bubbleDaysOf, flaggable, reportableOf } from './bubbles';
import type { ChatMessage } from './messages';

const message = (seq: number, createdAt: string, mine: boolean, fromLeftPartner = false): ChatMessage => ({
  messageId: `m${seq}`,
  seq,
  mine,
  fromLeftPartner,
  clientId: null,
  body: `본문 ${seq}`,
  createdAt,
});

describe('bubbleDaysOf', () => {
  it('같은 사람이 3분 안에 이어 보낸 말은 한 묶음이고 시각은 끝 말에 선다', () => {
    const [day] = bubbleDaysOf([
      message(1, '2026-09-22T11:00:00Z', false),
      message(2, '2026-09-22T11:02:00Z', false),
      message(3, '2026-09-22T11:02:30Z', true),
    ]);
    expect(day.bubbles.map((b) => [b.id, b.first, b.last])).toEqual([
      ['m1', true, false],
      ['m2', false, true],
      ['m3', true, true],
    ]);
    expect(day.bubbles[1].time).toBe('오후 8:02');
  });

  it('3분이 넘게 벌어지면 같은 사람이어도 새 묶음이다', () => {
    const [day] = bubbleDaysOf([
      message(1, '2026-09-22T11:00:00Z', true),
      message(2, '2026-09-22T11:03:01Z', true),
    ]);
    expect(day.bubbles.map((b) => b.first)).toEqual([true, true]);
  });

  it('날짜는 한국 시간으로 나뉜다 — UTC 15시는 다음 날이다', () => {
    const days = bubbleDaysOf([
      message(1, '2026-09-22T14:59:00Z', false),
      message(2, '2026-09-22T15:00:00Z', false),
    ]);
    expect(days.map((d) => d.label)).toEqual(['2026년 9월 22일', '2026년 9월 23일']);
    expect(days[1].bubbles[0].first).toBe(true);
  });

  it('떠난 사람의 말과 남은 사람의 말은 한 묶음이 되지 않는다', () => {
    const [day] = bubbleDaysOf([
      message(1, '2026-09-22T11:00:00Z', false, true),
      message(2, '2026-09-22T11:00:10Z', false, false),
    ]);
    expect(day.bubbles.map((b) => b.first)).toEqual([true, true]);
  });
});

describe('flaggable', () => {
  it('상대의 말에만 깃발이 선다 — 내 말 · 떠난 사람의 말은 아니다', () => {
    expect(flaggable({ mine: false, fromLeftPartner: false })).toBe(true);
    expect(flaggable({ mine: true, fromLeftPartner: false })).toBe(false);
    expect(flaggable({ mine: false, fromLeftPartner: true })).toBe(false);
  });
});

describe('reportableOf', () => {
  it('신고 창의 목록은 상대의 말만, 최근 것부터 선다 — 내 말 · 떠난 사람의 말은 빠진다', () => {
    const list = reportableOf([
      message(1, '2026-10-17T11:00:00Z', false),
      message(2, '2026-10-17T11:01:00Z', true),
      message(3, '2026-10-17T11:02:00Z', false, true),
      message(4, '2026-10-17T11:13:00Z', false),
    ]);
    expect(list.map((one) => one.id)).toEqual(['m4', 'm1']);
    expect(list[0]).toEqual({ id: 'm4', body: '본문 4', time: '오후 8:13' });
  });

  it('고를 말이 없으면 빈 목록이다 — 창은 목록 없이 사람 신고로 선다', () => {
    expect(reportableOf([message(1, '2026-10-17T11:00:00Z', true)])).toEqual([]);
  });
});
