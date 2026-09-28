import { describe, expect, it } from 'vitest';

import { STEMS, TEN_GOD_KO, tenGodOf, type TenGod } from '@/src/lib/saju';

import { FLOW_DAYS_AFTER, FLOW_DAYS_BEFORE, TEN_GOD_DAY_LINE, dayFlowOf, seoulDateOf } from './day-flow';

describe('이번 달 흐름 — 날짜 → 일진 → 십성 → 한 줄', () => {
  it('서울 자정에서 하루가 갈린다 — UTC 14:59 는 아직 그날, 15:00 은 다음 날', () => {
    expect(seoulDateOf(new Date('2026-09-28T14:59:59Z'))).toEqual({ year: 2026, month: 9, day: 28 });
    expect(seoulDateOf(new Date('2026-09-28T15:00:00Z'))).toEqual({ year: 2026, month: 9, day: 29 });

    const before = dayFlowOf('丙', new Date('2026-09-28T14:59:59Z'));
    const after = dayFlowOf('丙', new Date('2026-09-28T15:00:00Z'));
    expect(before.today.iso).toBe('2026-09-28');
    expect(after.today.iso).toBe('2026-09-29');
    /* 일진은 하루에 한 칸씩 60갑자를 걷는다 — 천간이 한 칸 넘어간다 */
    expect(STEMS.indexOf(after.today.stem)).toBe((STEMS.indexOf(before.today.stem) + 1) % 10);
  });

  it('그날의 일진은 엔진의 일주와 같다 — 2024-01-01 은 갑자일, 2000-01-01 은 무오일', () => {
    /* 서울 정오 = UTC 03:00 */
    expect(dayFlowOf('甲', new Date('2024-01-01T03:00:00Z')).today.stem).toBe('甲');
    expect(dayFlowOf('甲', new Date('2000-01-01T03:00:00Z')).today.stem).toBe('戊');
  });

  it('십성은 내 일간에서 본 그날 천간이고, 한 줄은 그 십성의 줄이다', () => {
    /* 2024-01-01 甲子일 — 병화 일간에게 甲은 편인, 을목 일간에게는 겁재 */
    const byun = dayFlowOf('丙', new Date('2024-01-01T03:00:00Z'));
    expect(byun.today.tenGod).toBe('偏印');
    expect(byun.today.line).toBe(TEN_GOD_DAY_LINE['偏印']);
    expect(dayFlowOf('乙', new Date('2024-01-01T03:00:00Z')).today.tenGod).toBe('劫財');
    expect(byun.today.element).toBe('木');
  });

  it('띠는 앞 엿새 · 오늘 · 뒤 이레의 열나흘이고, 달이 넘어가도 날짜가 이어진다', () => {
    const flow = dayFlowOf('壬', new Date('2026-09-29T03:00:00Z'));
    expect(flow.days).toHaveLength(FLOW_DAYS_BEFORE + 1 + FLOW_DAYS_AFTER);
    expect(flow.days.filter((day) => day.today)).toEqual([flow.days[FLOW_DAYS_BEFORE]]);
    expect(flow.days[0].iso).toBe('2026-09-23');
    expect(flow.days.at(-1)?.iso).toBe('2026-10-06');
    expect(flow.days.map((day) => day.tenGod)).toEqual(flow.days.map((day) => tenGodOf('壬', day.stem)));
    expect(flow.today.label).toBe('9월 29일 화요일');
  });

  it('십성 열 가지가 모두 제 줄을 갖고, 같은 줄이 두 번 서지 않는다', () => {
    const gods = Object.keys(TEN_GOD_KO) as TenGod[];
    expect(Object.keys(TEN_GOD_DAY_LINE).sort()).toEqual([...gods].sort());
    expect(new Set(Object.values(TEN_GOD_DAY_LINE)).size).toBe(gods.length);
    /* 설명문이라 마침표로 끝난다(CONTEXT.md 「화면 문구 규칙」) */
    for (const line of Object.values(TEN_GOD_DAY_LINE)) expect(line).toMatch(/\.$/);
  });
});
