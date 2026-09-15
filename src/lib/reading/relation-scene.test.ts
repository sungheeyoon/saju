import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import type { Relation } from '../people';
import { CONTROL, readingEvidenceOf, readingPromptOf } from '.';

/**
 * **고른 사이가 운영 프롬프트까지 닿는가** — 인연 궁합은 성립 방식이, 비공개 궁합은 고른 값이 정한다.
 *
 * 사람·자리·방향 읽기는 사이와 상관없이 같고, 장면 한 줄과 궁금증 한 줄만 사이를 탄다.
 * 어느 사이든 연인으로 눕지 않는지를 운영 기본값(`CONTROL`)으로 잰다.
 */

const VIEWED_AT = new Date('2026-08-23T04:00:00Z');
const A = computeSaju({ year: 1988, month: 2, day: 4, hour: 23, minute: 30, second: 0, gender: 'male' });
const B = computeSaju({ year: 1994, month: 8, day: 9, hour: 7, minute: 0, second: 0, gender: 'female' });

const headOf = (prompt: string) => prompt.split('\n## 자료 (')[0];

const privatePrompt = (relation: Relation | null) =>
  headOf(
    readingPromptOf(readingEvidenceOf('private', { a: A, b: B }, VIEWED_AT), CONTROL, {
      names: { a: '나', b: '그 사람' },
      relation,
    }),
  );

const matchPrompt = headOf(
  readingPromptOf(readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT), CONTROL, {
    names: { a: '달빛', b: '바람' },
    relation: null,
  }),
);

describe('인연 궁합은 성립 방식이 사이를 정한다', () => {
  it('인연 찾기에서 만나 동의한, 아직 서로를 잘 모르는 두 사람이라고 싣는다', () => {
    expect(matchPrompt).toContain(
      '인연 찾기에서 만나 서로 상세 궁합에 동의한 사이다. 아직 서로를 잘 모르는 두 사람이다.',
    );
    expect(matchPrompt).toContain('알아 가는 장면으로 쓴다');
    expect(matchPrompt).not.toContain('처음에 서로의 무엇에 끌렸고');
    expect(matchPrompt).not.toContain('어디서 끌리고');
  });
});

describe('비공개 궁합은 고른 사이를 싣는다', () => {
  it('연인·배우자는 애정과 친밀감으로 읽는다', () => {
    const prompt = privatePrompt('partner');
    expect(prompt).toContain('연인이거나 배우자다.');
    expect(prompt).toContain('애정과 친밀감의 장면');
  });

  it('가족은 가족 안의 기대와 경계로 읽고 연애로 읽지 않는다', () => {
    const prompt = privatePrompt('family');
    expect(prompt).toContain('가족이다.');
    expect(prompt).toContain('가족 안의 기대와 경계');
    expect(prompt).not.toContain('애정과 친밀감의 장면');
    expect(prompt).not.toContain('처음에 서로의 무엇에 끌렸고');
  });

  it('친구·동료는 우정과 거리감, 협업과 의사결정으로 읽는다', () => {
    const prompt = privatePrompt('friend');
    expect(prompt).toContain('친구이거나 함께 일하는 사이다');
    expect(prompt).toContain('우정과 거리감');
    expect(prompt).toContain('협업과 의사결정');
    expect(prompt).not.toContain('애정과 친밀감의 장면');
  });

  it('안 골랐으면 모른다고 싣고 어느 사이로도 단정하지 않는다', () => {
    const prompt = privatePrompt(null);
    expect(prompt).toContain('무슨 사이인지 모른다. 연인·가족·동료 중 어느 쪽으로도 단정하지 말라.');
    expect(prompt).not.toContain('인연 찾기에서 만나');
    expect(prompt).not.toContain('애정과 친밀감의 장면');
  });

  it('장면 안내는 목차가 아니라고 말하고, 새 판의 공통 안내는 끌림을 전제하지 않는다', () => {
    for (const relation of [null, 'family', 'friend', 'partner'] as const) {
      const prompt = privatePrompt(relation);
      expect(prompt).toContain('이것은 채워야 할 목차가 아니다');
      expect(prompt).not.toContain('어디서 끌리고');
      expect(prompt).not.toContain('끌림이 어느 쪽에서');
      expect(prompt).not.toContain('끌림과 부딪힘이');
    }
  });
});
