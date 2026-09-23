import { describe, expect, it } from 'vitest';

import { matchesName, pickable, stepTo } from './pick';

const people = [
  { personId: 'me', label: '서연' },
  { personId: 'mom', label: '어머니' },
  { personId: 'dad', label: '아버지' },
  { personId: 'j', label: 'Jiyoung Kim' },
  { personId: 'm2', label: '민수 선배' },
];

/**
 * **이름을 쳐서 좁힌다** — 저장한 사람이 스물 · 백이어도 고르는 칸이 읽히게(ADR 0102).
 */
describe('이름으로 좁히기', () => {
  it('아무것도 안 쳤으면 모두가 선다', () => {
    expect(matchesName('어머니', '')).toBe(true);
    expect(matchesName('어머니', '   ')).toBe(true);
  });

  it('이름의 어느 자리든 이어진 글자가 맞으면 선다', () => {
    expect(matchesName('어머니', '머니')).toBe(true);
    expect(matchesName('어머니', '어머')).toBe(true);
    expect(matchesName('어머니', '니어')).toBe(false);
  });

  it('띄어쓰기와 영문 대소문자는 가르지 않는다', () => {
    expect(matchesName('민수 선배', '수선')).toBe(true);
    expect(matchesName('Jiyoung Kim', 'jiyoungk')).toBe(true);
  });

  it('초성만 쳐도, 치다 만 음절이 섞여도 맞는다', () => {
    expect(matchesName('어머니', 'ㅇㅁㄴ')).toBe(true);
    expect(matchesName('어머니', 'ㅁㄴ')).toBe(true);
    expect(matchesName('어머니', '어ㅁ')).toBe(true);
    expect(matchesName('어머니', 'ㅇㅂ')).toBe(false);
    expect(matchesName('아버지', 'ㅇㅂ')).toBe(true);
  });

  it('조합형으로 들어온 글자도 같은 글자로 읽는다', () => {
    expect(matchesName('어머니', '어머니'.normalize('NFD'))).toBe(true);
  });
});

describe('고를 수 있는 사람', () => {
  it('다른 칸에서 고른 사람은 빠진다 — 같은 사람 둘은 애초에 못 고른다', () => {
    expect(pickable(people, '', 'mom').map((one) => one.personId)).toEqual(['me', 'dad', 'j', 'm2']);
  });

  it('친 이름으로 좁히고 원래 차례를 지킨다', () => {
    expect(pickable(people, 'ㅇ', null).map((one) => one.personId)).toEqual(['me', 'mom', 'dad']);
    expect(pickable(people, 'ㅇ', 'me').map((one) => one.personId)).toEqual(['mom', 'dad']);
  });

  it('맞는 사람이 없으면 빈 목록이다', () => {
    expect(pickable(people, '없는이름', null)).toEqual([]);
  });

  it('백 명이어도 같은 답이다', () => {
    const many = Array.from({ length: 100 }, (_, index) => ({ personId: `p${index}`, label: `사람${index}` }));
    expect(pickable(many, '사람9', null)).toHaveLength(11);
    expect(pickable(many, '', 'p0')).toHaveLength(99);
  });
});

/** 키보드로 오르내린다 — 끝에서 한 번 더 누르면 반대 끝으로 돈다 */
describe('키보드로 옮기기', () => {
  it('아래로 가다 끝에서 처음으로 돈다', () => {
    expect(stepTo(-1, 3, 'next')).toBe(0);
    expect(stepTo(0, 3, 'next')).toBe(1);
    expect(stepTo(2, 3, 'next')).toBe(0);
  });

  it('위로 가다 처음에서 끝으로 돈다', () => {
    expect(stepTo(-1, 3, 'previous')).toBe(2);
    expect(stepTo(1, 3, 'previous')).toBe(0);
    expect(stepTo(0, 3, 'previous')).toBe(2);
  });

  it('처음과 끝으로 곧장 간다', () => {
    expect(stepTo(1, 3, 'first')).toBe(0);
    expect(stepTo(1, 3, 'last')).toBe(2);
  });

  it('목록이 비었으면 아무 데도 안 선다', () => {
    expect(stepTo(0, 0, 'next')).toBe(-1);
    expect(stepTo(-1, 0, 'last')).toBe(-1);
  });

  it('목록이 줄어 자리를 벗어났으면 처음부터 다시 센다', () => {
    expect(stepTo(7, 3, 'next')).toBe(0);
    expect(stepTo(7, 3, 'previous')).toBe(2);
  });
});
