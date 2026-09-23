import { describe, expect, it } from 'vitest';

import {
  EMPTY_ANSWERS,
  IMPROVE_OPTIONS,
  LIKED_OPTIONS,
  SOLE_CHOICES,
  UNKNOWN_OPTIONS,
  WANT_NEW_OPTIONS,
  WANT_OPTIONS,
  afterPicking,
  choiceLabel,
  isAnswered,
  withoutHidden,
  type SurveyAnswers,
} from './index';

/**
 * 서비스 설문의 판단 넷 — 화면(`app/me/survey/form.tsx`)과 운영 화면(`app/ops/survey/page.tsx`)이
 * 부르고, `.tsx` 에는 vitest 가 안 닿으므로 판단은 여기서 잰다. 슬러그가 DB 검사식과 같은가는
 * pgTAP(`27_service_survey`)이, 폼을 실제로 누르는 것은 `e2e/signed-in.spec.ts` 가 든다.
 */
describe('단독 항목 — 마지막에 누른 것이 이긴다', () => {
  const sole = SOLE_CHOICES.liked;

  it('보통 항목은 고른 것 뒤에 붙는다', () => {
    expect(afterPicking(['self_reading'], 'discovery', sole)).toEqual(['self_reading', 'discovery']);
  });

  it('이미 고른 것을 다시 누르면 풀린다', () => {
    expect(afterPicking(['self_reading', 'discovery'], 'self_reading', sole)).toEqual(['discovery']);
  });

  it('단독 항목을 누르면 그것 하나만 남는다', () => {
    expect(afterPicking(['self_reading', 'discovery'], 'none', sole)).toEqual(['none']);
  });

  it('단독 항목이 있을 때 보통 항목을 누르면 단독 항목이 풀린다', () => {
    expect(afterPicking(['none'], 'self_reading', sole)).toEqual(['self_reading']);
  });

  it('단독 항목끼리도 서로를 푼다', () => {
    expect(afterPicking(['none'], 'not_enough', sole)).toEqual(['not_enough']);
  });

  it('단독 항목은 모두 그 문항의 선택지 안에 있다', () => {
    const options: Record<keyof typeof SOLE_CHOICES, readonly string[]> = {
      liked: LIKED_OPTIONS,
      unknown: UNKNOWN_OPTIONS,
      improve: IMPROVE_OPTIONS,
      wants: WANT_OPTIONS,
      wantsNew: WANT_NEW_OPTIONS,
    };
    for (const [question, soles] of Object.entries(SOLE_CHOICES)) {
      for (const one of soles) {
        expect(options[question as keyof typeof SOLE_CHOICES], `${question}.${one}`).toContain(one);
      }
    }
  });
});

describe('제출 버튼은 한 칸이라도 답해야 열린다', () => {
  it('빈 답 한 벌은 답하지 않은 것이다', () => {
    expect(isAnswered(EMPTY_ANSWERS)).toBe(false);
  });

  it('공백뿐인 글은 답이 아니다', () => {
    expect(isAnswered({ ...EMPTY_ANSWERS, improveText: '  \n ', freeText: '\t' })).toBe(false);
  });

  /** 칸 열 개 각각이 혼자서도 답이 된다 — 하나라도 빠지면 그 칸만 채운 사람은 제출을 못 한다 */
  const oneEach: [string, Partial<SurveyAnswers>][] = [
    ['liked', { liked: ['self_reading'] }],
    ['unknown', { unknown: ['all_known'] }],
    ['improve', { improve: ['none'] }],
    ['improveText', { improveText: '글' }],
    ['wants', { wants: ['unsure'] }],
    ['wantsNew', { wantsNew: ['none'] }],
    ['priceSolo', { priceSolo: 'free' }],
    ['pricePair', { pricePair: '4900' }],
    ['priceFactors', { priceFactors: ['depth'] }],
    ['freeText', { freeText: '글' }],
  ];

  it.each(oneEach)('%s 하나만 채워도 답이다', (_, part) => {
    expect(isAnswered({ ...EMPTY_ANSWERS, ...part })).toBe(true);
  });
});

describe('숨은 문항의 답은 보내기 전에 비운다', () => {
  const filled: SurveyAnswers = {
    ...EMPTY_ANSWERS,
    liked: ['self_reading'],
    priceSolo: '990',
    pricePair: '4900',
    priceFactors: ['depth'],
  };

  it('둘 다 보였으면 그대로다', () => {
    expect(withoutHidden(filled, { readSolo: true, readPair: true })).toEqual(filled);
  });

  it('풀이 값만 숨었으면 풀이 값만 비운다', () => {
    const out = withoutHidden(filled, { readSolo: false, readPair: true });
    expect(out.priceSolo).toBeNull();
    expect(out.pricePair).toBe(filled.pricePair);
    expect(out.priceFactors).toEqual(filled.priceFactors);
  });

  it('궁합 값만 숨었으면 궁합 값만 비운다', () => {
    const out = withoutHidden(filled, { readSolo: true, readPair: false });
    expect(out.priceSolo).toBe(filled.priceSolo);
    expect(out.pricePair).toBeNull();
    expect(out.priceFactors).toEqual(filled.priceFactors);
  });

  it('값 문항이 다 숨었으면 고려한 점도 비운다', () => {
    const out = withoutHidden(filled, { readSolo: false, readPair: false });
    expect(out).toEqual({ ...filled, priceSolo: null, pricePair: null, priceFactors: [] });
  });
});

describe('운영 화면은 열쇠를 말로 옮긴다', () => {
  it('아는 열쇠는 화면의 말이 된다', () => {
    expect(choiceLabel('liked', 'self_reading')).toBe('내 사주풀이');
  });

  it('모르는 선택지는 열쇠 그대로 선다', () => {
    expect(choiceLabel('liked', 'removed_option')).toBe('removed_option');
  });

  it('모르는 문항도 열쇠 그대로 선다', () => {
    expect(choiceLabel('gone', 'self_reading')).toBe('self_reading');
  });
});
