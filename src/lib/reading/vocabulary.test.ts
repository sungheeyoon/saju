import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import { CONTROL, MATCH_INPUT_VARIANTS, readingEvidenceOf, readingPromptOf } from '.';
import { OUT_OF_SCOPE_TERMS, PLAIN_FORBIDDEN_TERMS } from './check';
import { SAJU_TERMS, termNames } from './vocabulary';

const VIEWED_AT = new Date('2026-08-26T04:00:00Z');
const A = computeSaju({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male' });
const B = computeSaju({ year: 1992, month: 8, day: 20, hour: 9, minute: 0, second: 0, gender: 'female' });

/** 운영이 실제로 내보내는 인연 궁합 프롬프트 — 제한형 A + 읽는 법 4판 */
const productionMatchPrompt = (): string =>
  readingPromptOf(readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT), CONTROL);

/** 확장형은 실험 전용 조립이다 — 각자의 판정이 실리는 유일한 판이라 이름을 금지하는 절도 여기 선다 */
const extendedMatchPrompt = (): string => {
  const variant = MATCH_INPUT_VARIANTS.find((one) => one.assembly.matchInput === 'extended-v1');
  if (variant === undefined) throw new Error('확장형 판이 없다');
  return readingPromptOf(
    readingEvidenceOf('match', { a: A, b: B }, VIEWED_AT, 'extended-v1'),
    variant.assembly,
  );
};

const shared = [...new Set(Object.values(SAJU_TERMS).flat())].sort();
const plainOnly = PLAIN_FORBIDDEN_TERMS.filter((term) => !OUT_OF_SCOPE_TERMS.includes(term));
const outOnly = OUT_OF_SCOPE_TERMS.filter((term) => !PLAIN_FORBIDDEN_TERMS.includes(term));

/**
 * **한 파일 안에 두 표가 있었다.**
 *
 * 저장을 막는 표와 판을 재는 표는 겨누는 것이 달라 합칠 수 없다. 다만 **함께 드는
 * 낱말**은 손으로 두 번 적혀 있었고, 그러면 언젠가 한쪽만 늘어난다. 여기서 잠그는 것은
 * 그 하나다 — 둘이 함께 드는 것은 전부 `SAJU_TERMS` 에서 온다.
 */
describe('두 표가 함께 드는 낱말은 한 자리에서 온다', () => {
  it('겹치는 것과 갈래의 합이 정확히 같다', () => {
    const both = PLAIN_FORBIDDEN_TERMS.filter((term) => OUT_OF_SCOPE_TERMS.includes(term));

    expect([...both].sort()).toEqual(shared);
  });

  it('갈래는 두 표에 다 들어 있다', () => {
    for (const term of shared) {
      expect(PLAIN_FORBIDDEN_TERMS, term).toContain(term);
      expect(OUT_OF_SCOPE_TERMS, term).toContain(term);
    }
  });

  /**
   * 한쪽만 드는 것은 그 표 옆에 남는다 — **본보기 몇 개가 아니라 전부 본다.**
   *
   * 갈래로 올리는 실수는 한 낱말에서 난다. 손으로 고른 다섯만 재면 그 다섯이 아닌
   * 낱말이 올라간 날에 초록이 뜬다.
   */
  it('한쪽만 드는 낱말은 하나도 갈래에 없다', () => {
    expect(plainOnly.length + outOnly.length).toBeGreaterThan(0);

    for (const term of [...plainOnly, ...outOnly]) {
      expect(shared, term).not.toContain(term);
    }
  });

  /**
   * **저장을 막는 표만 드는 낱말은 손으로 적은 열다섯이다.**
   *
   * 이쪽이 넓어지는 것은 멀쩡한 글이 버려진다는 뜻이라 값을 적어 둔다. 판을 재는 표만
   * 드는 쪽(`plainOnly`)은 십성·관계 이름이 표에서 지어지므로 수를 안 박는다 — 엔진의
   * 표가 바뀌면 같이 움직여야 하는 값이다.
   */
  it('저장을 막는 표만 드는 낱말을 값으로 든다', () => {
    expect([...outOnly].sort()).toEqual(
      [
        '12운성',
        '고신',
        '과숙',
        '구신',
        '기신',
        '득령',
        '득세',
        '득지',
        '십이운성',
        '장생',
        '제왕',
        '종격',
        '통근',
        '한신',
        '희신',
      ].sort(),
    );
  });

  /** 판을 재는 표만 드는 쪽 — 손으로 적은 것만 짚는다. 나머지는 표에서 지어진다 */
  it('판을 재는 표만 드는 낱말에는 명식을 부르는 말과 귀인 둘이 있다', () => {
    for (const term of ['원국', '명식', '일간', '십성', '천덕귀인', '월덕귀인']) {
      expect(plainOnly, term).toContain(term);
    }
  });
});

/**
 * **검사가 막는 값은 프롬프트가 말해야 한다.**
 *
 * 한 줄 요약의 길이가 이 자리에서 한 번 떨어졌다 — 검사는 막고 프롬프트는 말하지 않아,
 * 다 만든 글이 통째로 버려졌다. 낱말도 같은 모양이라 여기서 둘을 맞물려 둔다.
 *
 * 재는 것은 「프롬프트가 부른 이름이 검사의 표 안에 있는가」다. 반대로 「표의 낱말을
 * 프롬프트가 다 부르는가」는 재지 않는다 — 금지 목록을 길게 세우면 모델이 먼저 읽는 것이
 * 그 목록이 되고, 글이 점검표처럼 굳는다.
 */
describe('프롬프트가 부르는 금지 이름은 검사의 표에서 온다', () => {
  it('확장형이 싣는 판정의 이름을 그대로 적고, 그 이름들을 검사가 막는다', () => {
    expect(extendedMatchPrompt()).toContain(
      `그 판정의 이름(${termNames('strength', 'eokbu')})은 본문에 쓰지 마라.`,
    );
    for (const term of [...SAJU_TERMS.strength, ...SAJU_TERMS.eokbu]) {
      expect(OUT_OF_SCOPE_TERMS, term).toContain(term);
    }
  });

  it('인연 궁합 자료에 없다고 적은 운 이름도 같은 표에서 온다', () => {
    expect(productionMatchPrompt()).toContain(`${termNames('luck')}은 이 자료에 없다`);

    for (const term of SAJU_TERMS.luck) {
      expect(OUT_OF_SCOPE_TERMS, term).toContain(term);
    }
  });
});
