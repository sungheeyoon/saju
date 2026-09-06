import { describe, expect, it } from 'vitest';

import { CITY_LONGITUDES, computeSaju } from '../saju';
import {
  READING_KINDS,
  isSolo,
  readingEvidenceOf,
  readingPromptOf,
  type ReadingKind,
} from '.';

/**
 * 자료 앞에 서는 머리(`withSummary`)를 잰다.
 *
 * **재는 대상이 바뀌었다**(ADR 0047). 전에는 `promptWithEvidence` 로 지은, OpenAI 로는
 * 한 번도 안 가는 프롬프트를 재고 있었다. 이제 `readingPromptOf` 로 **실제로 나가는
 * 것**을 잰다 — 같은 함수가 머리를 끼우므로 재는 값은 같고, 안 나가는 것을 재던
 * 자리만 없어졌다.
 */

const VIEWED_AT = new Date('2026-08-23T04:00:00Z');

const A = computeSaju(
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male' },
  { longitude: CITY_LONGITUDES.부산, useLongitude: true },
);
const B = computeSaju({ year: 1992, month: 11, day: 17, hour: 5, minute: 20, second: 0, gender: 'female' });

const evidenceFor = (kind: ReadingKind) =>
  readingEvidenceOf(kind, isSolo(kind) ? { a: A } : { a: A, b: B }, VIEWED_AT);

const promptFor = (kind: ReadingKind) => readingPromptOf(evidenceFor(kind));

describe('자료와 한 덩어리로 나간다', () => {
  it('역할 · 한눈에 · 규칙 · 자료 순서로 선다', () => {
    const text = promptFor('self');

    const order = ['# 역할', '## 한눈에', '## 사실에 관한 단 하나의 금지', '## 자료', '```json'];
    const at = order.map((mark) => text.indexOf(mark));

    for (const index of at) expect(index).toBeGreaterThan(-1);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
  });

  /**
   * 머리를 끼우는 자리가 **암묵**이다 — 역할 문단과 첫 절 사이. 프롬프트를 새로 쓰면서
   * `# 역할` 로 안 열면 머리가 엉뚱한 데 들어가는데, 그것은 눈으로만 보인다.
   */
  it('모든 풀이가 역할 문단으로 열고 그다음이 절이다', () => {
    for (const kind of READING_KINDS) {
      const [role, ...rest] = promptFor(kind).split(/\n\n(?=## )/);

      expect(role.startsWith('# 역할'), kind).toBe(true);
      expect(rest.length, kind).toBeGreaterThan(0);
    }
  });

  /**
   * 머리는 **다시 세지 않는다.** 여기서 간지를 새로 구하면 머리와 자료가 언젠가
   * 어긋나고, 어긋난 날 어느 쪽이 맞는지 알 수 없다.
   */
  it('한눈에가 자료의 값을 그대로 옮긴다', () => {
    const reading = readingEvidenceOf('self', { a: A }, VIEWED_AT);
    const text = readingPromptOf(reading);
    /* `match` 만 운이 빠진 컷을 쓴다 — 자기 풀이는 `now` 를 든다 */
    if (reading.kind === 'match') throw new Error('자기 풀이가 공유 컷으로 왔다');
    const { pillars, now } = reading.evidence.charts.a;

    for (const pillar of [pillars.year, pillars.month, pillars.day, pillars.hour]) {
      expect(text).toContain(pillar!.name);
    }
    expect(text).toContain(`일간 ${pillars.dayMaster}`);
    expect(text).toContain(pillars.meta.monthTerm.name);
    expect(text).toContain(now.saeun.pillar.name);
    expect(text).toContain(reading.evidence.viewedAt);
    // 사람을 이름으로 부르지 않는다 — 모델이 아래 JSON 에서 찾아갈 이름을 적는다.
    expect(text).toContain('`charts.a`');
  });

  /** 두 사람이면 두 벌이 서고, 한 사람이면 한 벌이다 */
  it('한눈에가 사람 수를 따라간다', () => {
    expect(promptFor('self')).not.toContain('`charts.b`');
    expect(promptFor('private')).toContain('`charts.b`');
  });

  /** 시각을 모르면 시주 자리가 비었다고 적힌다 — 빈칸으로 두면 안 적은 것과 같다 */
  it('시간 미상이면 시주 자리가 그렇다고 말한다', () => {
    const hourless = computeSaju({ year: 1990, month: 5, day: 15, hour: null, gender: 'male' });
    const text = readingPromptOf(readingEvidenceOf('self', { a: hourless }, VIEWED_AT));

    expect(text).toContain('시간 미상');
  });

  /**
   * 들여쓰면 두 사람짜리가 네 배가 된다. 붙여 넣는 자리에서 그것은 읽기 좋음이 아니라
   * 무게다 — 자료를 눈으로 볼 자리는 화면에 따로 있다.
   */
  it('자료는 들여쓰지 않고 실린다', () => {
    const reading = evidenceFor('private');
    const text = readingPromptOf(reading);

    expect(text).toContain(JSON.stringify(reading.evidence));
    expect(text).not.toContain(JSON.stringify(reading.evidence, null, 2));
  });
});
