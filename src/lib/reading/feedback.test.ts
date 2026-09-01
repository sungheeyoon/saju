import { describe, expect, it } from 'vitest';

import {
  FEEDBACK_COMMENT,
  FEEDBACK_QUESTIONS,
  FEEDBACK_SCALE,
  FELT_LENGTHS,
  FELT_LENGTH_LABEL,
  ISSUE_TAGS,
  ISSUE_TAG_LABEL,
} from './feedback';

/**
 * 설문이 묻는 말은 **값이다.** 무엇을 물었는지가 답이 무엇을 뜻하는지를 정하므로,
 * 문구가 흔들리면 이미 받아 둔 답의 뜻도 함께 흔들린다.
 */
describe('설문이 묻는 말', () => {
  /**
   * **「정확도」라고 묻지 않는다.**
   *
   * 사주 해석의 객관적 정확도를 우리가 잰 적이 없다. 그 낱말로 물으면 잰 적 없는 것을
   * 쟀다고 말하는 셈이고, 답한 사람도 자기가 무엇을 매겼는지 오해한다. PRD 가 쓰는
   * 낱말은 **체감 적합성**이다.
   */
  it('잰 적 없는 것을 쟀다고 말하지 않는다', () => {
    const asked = Object.values(FEEDBACK_QUESTIONS)
      .flatMap((one) => [one.label, one.low, one.high])
      .join(' ');

    for (const overclaim of ['정확도', '맞았는지', '정답']) {
      expect(asked, overclaim).not.toContain(overclaim);
    }
    expect(FEEDBACK_QUESTIONS.perceivedFit.label).toContain('비슷');
  });

  /**
   * **양 끝에 말이 붙어 있다.** 숫자만 있으면 5가 좋은 쪽인지 나쁜 쪽인지 알 수 없고,
   * 그러면 사람마다 반대로 매긴 값이 한 열에 쌓인다.
   */
  it('눈금의 양 끝을 말로 세운다', () => {
    expect(FEEDBACK_SCALE).toEqual([1, 2, 3, 4, 5]);

    for (const [name, question] of Object.entries(FEEDBACK_QUESTIONS)) {
      expect(question.low, name).not.toBe('');
      expect(question.high, name).not.toBe('');
      expect(question.low, name).not.toBe(question.high);
    }
  });
});

/**
 * **총평이 아니라 항목으로 받는다**(`matching-beta.md`). 별 몇 개는 오행 보완 공식의
 * 문제인지, 관계 신호의 해석 문제인지, 문장 표현의 문제인지 안 알려 준다.
 */
describe('아쉬운 점의 이름들', () => {
  /**
   * DB 의 `tags_are_known` 과 **같은 집합이어야 한다.** 한 낱말을 두 언어에 적었으므로
   * 어긋날 수 있고, 흐름 검사가 여섯을 다 넣어 보는 것으로 그 어긋남을 잡는다.
   */
  it('DB 가 아는 여섯 이름과 같다', () => {
    expect([...ISSUE_TAGS]).toEqual([
      'abstract',
      'repetitive',
      'assertive',
      'jargon',
      'mismatch',
      'ui',
    ]);
  });

  /** 이름만 있고 말이 없으면 화면에 빈 칸이 선다 */
  it('모든 이름에 사람 말이 붙어 있다', () => {
    for (const tag of ISSUE_TAGS) {
      expect(ISSUE_TAG_LABEL[tag], tag).toBeTruthy();
    }
    for (const felt of FELT_LENGTHS) {
      expect(FELT_LENGTH_LABEL[felt], felt).toBeTruthy();
    }
  });

  /**
   * **「바넘 같다」를 둘로 나눠 받는다.** 근거를 안 쓴 것(`abstract`)과 같은 근거를
   * 되풀이한 것(`repetitive`)은 다른 고장이고, 한 낱말로 합치면 글이 왜 헐거운지가
   * 안 갈린다.
   */
  it('헐거움의 두 갈래를 갈라 둔다', () => {
    expect(ISSUE_TAGS).toContain('abstract');
    expect(ISSUE_TAGS).toContain('repetitive');
    expect(ISSUE_TAG_LABEL.abstract).not.toBe(ISSUE_TAG_LABEL.repetitive);
  });
});

/**
 * 자유 입력은 **좁게 묻는다.** 넓게 물으면 사연을 쓰고, 사연에는 남의 생년월일이
 * 들어온다 — 그 사람은 동의한 적이 없다.
 */
describe('적는 칸', () => {
  it('사연이 아니라 대목을 묻는다', () => {
    expect(FEEDBACK_COMMENT.label).toContain('대목');

    /* 「있다면 자유롭게」처럼 열어 두는 말이 들어오면 이 칸은 다시 넓어진다 */
    for (const wide of ['자유롭게', '무엇이든', '있다면']) {
      expect(FEEDBACK_COMMENT.label, wide).not.toContain(wide);
    }
  });

  /**
   * **길이 제한은 문을 막지 못한다** — 막는 것은 좁은 질문과 동의 관문이다. 그래도
   * 사연이 안 들어갈 만큼은 좁아야 한다.
   */
  it('사연이 안 들어갈 만큼만 받는다', () => {
    expect(FEEDBACK_COMMENT.limit).toBe(200);
  });

  /** 경고 한 줄은 남기되 그것이 통제라고 믿지 않는다 */
  it('남의 생년월일을 적지 말라고 한 줄 말한다', () => {
    expect(FEEDBACK_COMMENT.hint).toContain('생년월일');
  });
});
