import { describe, expect, it } from 'vitest';

import { CITY_LONGITUDES, computeSaju } from '../saju';
import {
  READING_KINDS,
  isSolo,
  readingEvidenceOf,
  readingPromptOf,
  type ReadingKind,
} from '.';
import { withSummary } from './summary';

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

/**
 * 한 사람 명식의 사실 줄 — **목록 자체**를 잰다. 개인 풀이 프롬프트는 목록을 싣지 않으므로
 * (`withSummary` 의 `positionFacts`) 운영 프롬프트가 아니라 목록을 짓는 자리를 부른다.
 */
const factsOf = (saju: ReturnType<typeof computeSaju>) =>
  withSummary('# 역할\n\n## 사실에 관한 단 하나의 금지', readingEvidenceOf('self', { a: saju }, VIEWED_AT).evidence);

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

/**
 * 자리가 붙은 사실 목록(`reading-prompt-v11`, PRD §8.5).
 *
 * 재는 것은 셋이다 — 천간과 지지가 줄에서 갈리는가, 공유 궁합에서 자료가 자른 것을 목록이
 * 뒷문으로 싣지 않는가, 경로 이름이 줄에 안 실리는가.
 */
describe('자리가 붙은 사실', () => {
  const blockOf = (text: string): string => {
    const start = text.indexOf('## 자리가 붙은 사실');
    expect(start).toBeGreaterThan(-1);
    return text.slice(start, text.indexOf('\n## ', start + 1));
  };

  it('한눈에 다음, 규칙 앞에 선다 — 두 궁합에만 선다', () => {
    expect(promptFor('self')).not.toContain('## 자리가 붙은 사실');
    expect(promptFor('person')).not.toContain('## 자리가 붙은 사실');
    const text = promptFor('private');

    expect(text.indexOf('## 한눈에')).toBeLessThan(text.indexOf('## 자리가 붙은 사실'));
    expect(text.indexOf('## 자리가 붙은 사실')).toBeLessThan(
      text.indexOf('## 사실에 관한 단 하나의 금지'),
    );
  });

  /** 천간에 걸린 신살을 같은 기둥 지지의 일과 묶는 것이 옛 실험의 대표 오조인이었다 */
  it('천간과 지지를 갈라 적는다', () => {
    const block = blockOf(factsOf(A));

    expect(block).toContain('- 년지 午 ↔ 시지 未 : 오미합화');
    expect(block).toContain('- 천덕귀인 [기준 월지 巳] : 월간 辛');
    expect(block).toContain('- 괴강 : 일주 庚辰');
    expect(block).not.toMatch(/(^|\s)A /);
  });

  /** 판정에 쓴 글자와 걸린 자리가 뒤바뀌면 「일지 기준」이 「일지에 걸림」으로 읽힌다 */
  it('신살은 기준과 걸린 자리를 갈라 한 사실에 한 줄로 적는다', () => {
    const block = blockOf(factsOf(A));

    expect(block).toContain('- 월덕귀인 [기준 월지 巳] : 년간 庚 · 일간 庚');

    /* 같은 이름이라도 기준이 다르면 다른 사실이다 — 합치지 않는다 */
    const twice = computeSaju({ year: 1960, month: 2, day: 19, hour: 9, minute: 0, second: 0, gender: 'male' });
    const text = blockOf(factsOf(twice));
    expect(text).toContain('- 화개살 [기준 년지 子] : 시지 辰');
    expect(text).toContain('- 화개살 [기준 일지 丑] : 일지 丑');
  });

  it('공망은 기준 기둥과 실제로 놓인 자리를 갈라 적는다', () => {
    const reading = evidenceFor('private');
    if (reading.kind === 'match') throw new Error('비공개 궁합이 공유 컷으로 왔다');
    const block = blockOf(readingPromptOf(reading));
    const lines = block.split('\n').filter((line) => line.startsWith('- 공망'));

    const expected = (['a', 'b'] as const).flatMap((key) =>
      reading.evidence.charts[key]!.sinsal.emptiness.filter((empty) => empty.positions.length > 0),
    );
    expect(lines).toHaveLength(expected.length);
    for (const empty of expected) {
      expect(lines.some((line) => line.includes(empty.basisPillar))).toBe(true);
    }
  });

  /** 세 글자 관계를 자리마다 쪼개면 한 사실이 세 번 세어진다 */
  it('삼형은 참여자 셋을 든 한 줄이고, 도는 차례와 이름을 잃지 않는다', () => {
    const triple = computeSaju({ year: 1960, month: 2, day: 11, hour: 17, minute: 0, second: 0, gender: 'male' });
    const lines = blockOf(factsOf(triple))
      .split('\n')
      .filter((line) => line.includes('인사신 삼형'));

    expect(lines).toEqual([
      '- 월지 寅 ↔ 일지 巳 ↔ 시지 申 : 인사신 삼형(무은지형) (도는 차례 월지 寅 → 일지 巳 → 시지 申 → 월지 寅)',
    ]);
  });

  it('쟁합을 잃지 않는다', () => {
    const contested = computeSaju({ year: 1960, month: 1, day: 3, hour: 5, minute: 0, second: 0, gender: 'male' });
    const block = blockOf(factsOf(contested));

    expect(block).toContain('인해합목 (쟁합: 년지 亥 을 시지 寅 도 함께 문다)');
  });

  it('자료의 관계와 신살 자리를 빠짐없이 옮긴다', () => {
    const reading = evidenceFor('private');
    if (reading.kind === 'match') throw new Error('비공개 궁합이 공유 컷으로 왔다');
    const block = blockOf(readingPromptOf(reading));
    const { charts, compatibility } = reading.evidence;

    const [relationPart, sinsalPart] = block.split('\n신살\n');
    const items = (part: string) => part.split('\n').filter((line) => line.startsWith('- '));

    expect(items(relationPart)).toHaveLength(
      charts.a.relations.length + charts.b!.relations.length + compatibility!.relations.length,
    );
    expect(items(sinsalPart).length).toBeGreaterThan(0);

    /* 같은 글자가 다른 자리에 있으면 줄이 갈린다 */
    expect(new Set(items(relationPart)).size).toBe(items(relationPart).length);

    /* 사람 표시가 섞이지 않는다 — 원국 안은 그 사람만, 사이는 둘 다 */
    const [, inA, inB, between] = relationPart.split(/\n\((?:A 원국 안|B 원국 안|두 사람 사이)\)\n/);
    for (const line of items(`\n${inA}`)) expect(line.match(/B /)).toBeNull();
    for (const line of items(`\n${inB}`)) expect(line.match(/A /)).toBeNull();
    for (const line of items(`\n${between}`)) expect(line).toMatch(/A .*B |B .*A /);
    for (const hit of charts.b!.sinsal.stars.flatMap((star) => star.hits)) {
      expect(block).toContain(`B ${{ year: '년', month: '월', day: '일', hour: '시' }[hit.position]}`);
    }
    expect(block).toContain('(두 사람 사이)');
  });

  /** 목록이 자료보다 넓으면 동의 범위를 이 자리로 넘는다 */
  it('공유 궁합에는 두 사람 사이의 관계만 싣는다', () => {
    const reading = evidenceFor('match');
    if (reading.kind !== 'match') throw new Error('공유 궁합이 아니다');
    const block = blockOf(readingPromptOf(reading));

    expect(block).not.toContain('신살\n');
    expect(block).not.toContain('원국 안');
    const lines = block.split('\n').filter((line) => line.startsWith('- '));
    expect(lines).toHaveLength(reading.evidence.compatibility.relations.length);
    for (const line of lines) {
      expect(line, line).toMatch(/A .* B |B .* A /);
    }
  });

  it('줄에 자료 경로 이름을 싣지 않는다', () => {
    for (const kind of READING_KINDS.filter((one) => !isSolo(one))) {
      const facts = blockOf(promptFor(kind)).split('\n').filter((line) => line.startsWith('- '));
      for (const line of facts) expect(line, kind).not.toMatch(/[a-z.`]/);
    }
  });
});
