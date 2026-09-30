import { describe, expect, it } from 'vitest';

import { assembleText, computeSaju, type Utterance } from '../saju';

import { TASTE_KEYS, fallbackTasteOf, tasteKeyOf } from './taste';

/** 표의 검사식(`20261104090000` 의 `taste_passage_key_shape`)과 같은 꼴 */
const DB_KEY_SHAPE = /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]-[子丑寅卯辰巳午未申酉戌亥]$/;

const sajuOf = (date: string, time: string | null) => {
  const [year, month, day] = date.split('-').map(Number);
  if (time === null) return computeSaju({ year, month, day, hour: null, gender: 'female' });
  const [hour, minute] = time.split(':').map(Number);
  return computeSaju({ year, month, day, hour, minute, second: 0, gender: 'female' });
};

describe('로그인 전 사주 문단의 열쇠', () => {
  it('열쇠는 일주 두 글자 · 하이픈 · 월지 한 글자다', () => {
    const saju = sajuOf('1990-05-15', '14:30');
    const key = tasteKeyOf(saju.pillars);

    expect(key).toBe(`${saju.pillars.day.stem}${saju.pillars.day.branch}-${saju.pillars.month.branch}`);
    expect(key).toMatch(DB_KEY_SHAPE);
  });

  it('태어난 시각은 열쇠에 안 든다 — 시간 모름도 같은 칸을 읽는다', () => {
    expect(tasteKeyOf(sajuOf('1990-05-15', null).pillars)).toBe(tasteKeyOf(sajuOf('1990-05-15', '14:30').pillars));
    expect(tasteKeyOf(sajuOf('1990-05-15', '01:10').pillars)).toBe(tasteKeyOf(sajuOf('1990-05-15', '14:30').pillars));
  });

  it('칸은 720개이고 전부 다르며 표의 꼴을 지킨다', () => {
    expect(TASTE_KEYS).toHaveLength(720);
    expect(new Set(TASTE_KEYS).size).toBe(720);
    expect(TASTE_KEYS.filter((key) => !DB_KEY_SHAPE.test(key))).toEqual([]);
  });

  it('어느 사주의 열쇠든 720칸 안에 있다', () => {
    const keys = new Set<string>(TASTE_KEYS);
    for (const date of ['1950-01-01', '1975-08-08', '1990-05-15', '2001-02-04', '2024-12-31']) {
      expect(keys.has(tasteKeyOf(sajuOf(date, '12:00').pillars))).toBe(true);
    }
  });
});

describe('표가 비었을 때 대신 서는 문장', () => {
  it('엔진이 이 사주에서 낸 문장 가운데 뿌리 · 강약 · 가장 무거운 오행 차례로 셋까지 고른다', () => {
    const saju = sajuOf('1990-05-15', '14:30');
    const utterances = assembleText(saju);
    const chosen = fallbackTasteOf(utterances);

    expect(chosen.length).toBeGreaterThanOrEqual(2);
    expect(chosen.length).toBeLessThanOrEqual(3);
    /* 고른 문장은 전부 엔진이 낸 그대로다 — 화면이 지어낸 문장이 섞이지 않는다 */
    const texts = new Set(utterances.map((one) => one.text));
    expect(chosen.every((text) => texts.has(text))).toBe(true);
    /* 첫 문장은 뿌리다 */
    const root = utterances.find((one) => one.request.topic.startsWith('rootedness.'));
    expect(chosen[0]).toBe(root?.text);
  });

  it('조각이 없는 발화 · 말하지 않기로 한 발화는 건너뛴다', () => {
    const silent = (topic: Utterance['request']['topic'], text: string | null): Utterance => ({
      request: { topic, variant: 'x', slots: {}, grounded: [] },
      strength: 'fact',
      key: null,
      text,
      violations: [],
    });

    expect(
      fallbackTasteOf([
        silent('rootedness.rooted', null),
        silent('strength.verdict', '돕는 세력이 절반쯤이에요.'),
        silent('relation.present', '관계 문장은 고르지 않아요.'),
      ]),
    ).toEqual(['돕는 세력이 절반쯤이에요.']);
  });
});
