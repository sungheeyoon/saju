import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import {
  CONTROL,
  READING_PROMPTS,
  readingEvidenceOf,
  readingPromptOf,
  selfSectionTitlesOf,
} from '.';
import {
  GROUNDING_HEADING,
  SEAT_NAMES,
  calledName,
  pairSeatsOf,
  readingBody,
  readingGrounding,
  seatNicknamesOf,
  withNicknames,
} from './display';
import { PROMPT_VARIANTS } from '@/src/lab/reading/variants';

/**
 * **글은 자리 호칭으로 오고 화면이 지금의 닉네임으로 바꾼다**(운영자 2026-10-15).
 *
 * 닉네임은 갈래를 안 나눈다 — 내 궁합의 이름표 · 인연 궁합의 닉네임 · 나 자신 모두 「그 사람의 닉네임」이다.
 */
describe('자리 호칭을 닉네임으로', () => {
  const seats = { first: '민수', second: '지영' } as const;

  it('새 호칭을 두 자리의 닉네임으로 바꾸고 님을 붙인다', () => {
    expect(withNicknames('첫번째님은 빠르고 두번째님은 차분해요.', seats)).toBe('민수님은 빠르고 지영님은 차분해요.');
  });

  /** 2026-10-15 전 풀이 — 이름을 몰랐던 글 · 옛 공유 궁합은 「첫 번째 분」으로 났다 */
  it('옛 호칭도 같은 자리로 바꾼다', () => {
    expect(withNicknames('첫 번째 분은 빠르고 두 번째 분에게 기대요.', seats)).toBe('민수님은 빠르고 지영님에게 기대요.');
  });

  it('띄어쓰기가 흔들려도 받는다', () => {
    expect(withNicknames('첫 번째님과 두번째 분의 속도', seats)).toBe('민수님과 지영님의 속도');
  });

  it('받침 쪽 조사는 그대로 둔다 — 「님」 이 받침으로 끝난다', () => {
    const text = '첫번째님이 먼저 묻고 두번째님을 기다려요. 두번째님으로서는 첫번째님이에요.';
    expect(withNicknames(text, seats)).toBe('민수님이 먼저 묻고 지영님을 기다려요. 지영님으로서는 민수님이에요.');
  });

  /** 받침 없이 끝나는 이름 — `calledName` 이 님을 안 붙이는 자리(「나」·「저」) */
  it('받침 없는 이름이면 조사를 옮긴다', () => {
    const text = '첫번째님은 빠르고 첫번째님이 먼저 말하고 첫번째님을 기다리고 첫번째님과 걷고 첫번째님으로 끝나요. 첫번째님이에요.';
    expect(withNicknames(text, { first: '나', second: '지영' })).toBe(
      '나는 빠르고 나가 먼저 말하고 나를 기다리고 나와 걷고 나로 끝나요. 나예요.',
    );
  });

  it('님으로 끝나는 닉네임에는 님을 겹쳐 붙이지 않는다', () => {
    expect(withNicknames('첫번째님은 두번째님을 챙겨요.', { first: '어머님', second: '선생님' })).toBe(
      '어머님은 선생님을 챙겨요.',
    );
  });

  it('호칭이 없는 옛 글(이름이 박힌 풀이)은 손대지 않는다', () => {
    const body = '민수님은 빠르고 지영님은 차분해요.';
    expect(withNicknames(body, { first: '바뀐이름', second: '다른이름' })).toBe(body);
  });

  it('닉네임이 비었으면 그 자리는 호칭으로 남긴다', () => {
    expect(withNicknames('첫번째님은 두번째님과 달라요.', { first: '  ', second: '지영' })).toBe('첫번째님은 지영님과 달라요.');
  });

  it('이름을 바꾸면 같은 글이 새 이름으로 선다', () => {
    const stored = '첫번째님은 두번째님을 챙겨요.';
    expect(withNicknames(stored, { first: '엄마', second: '아빠' })).toBe('엄마님은 아빠님을 챙겨요.');
    expect(withNicknames(stored, { first: '어머니', second: '아빠' })).toBe('어머니님은 아빠님을 챙겨요.');
  });
});

describe('누가 첫 자리인가', () => {
  it('인연 궁합 — 보는 사람이 첫 자리면 나 · 상대 차례다', () => {
    expect(seatNicknamesOf({ viewer: '달빛', partner: '바람' }, true)).toEqual({ first: '달빛', second: '바람' });
  });

  it('인연 궁합 — 보는 사람이 둘째 자리면 저장된 글의 차례를 뒤집지 않고 이름만 맞춘다', () => {
    expect(seatNicknamesOf({ viewer: '달빛', partner: '바람' }, false)).toEqual({ first: '바람', second: '달빛' });
    expect(withNicknames('첫번째님은 빠르고 두번째님은 차분해요.', seatNicknamesOf({ viewer: '달빛', partner: '바람' }, false))).toBe(
      '바람님은 빠르고 달빛님은 차분해요.',
    );
  });

  it('내 궁합 — 두 자리를 아는 쪽은 보는 사람 차례를 안 읽는다', () => {
    expect(seatNicknamesOf({ first: '엄마', second: '아빠' }, false)).toEqual({ first: '엄마', second: '아빠' });
  });

  /** DB 가 `least`·`greatest` 로 줄 세운다 — `uuid` 비교는 소문자 표기의 사전 순과 같다 */
  it('내 궁합 — Person id 가 작은 쪽이 첫 자리다(고른 차례와 상관없이 · 대소문자 상관없이)', () => {
    const low = { personId: '0f6c1e8a-0000-4000-8000-000000000001', name: '엄마' };
    const high = { personId: 'A1000000-0000-4000-8000-000000000000', name: '아빠' };

    expect(pairSeatsOf(low, high)).toEqual({ first: '엄마', second: '아빠' });
    expect(pairSeatsOf(high, low)).toEqual({ first: '엄마', second: '아빠' });
  });
});

/**
 * **프롬프트가 쓰라고 한 자리 이름을 화면이 빠짐없이 되읽는가**(G-44).
 *
 * 두 자리가 각자 글자를 들던 때가 있었다 — 프롬프트는 값에, 화면은 정규식 안의 글자에. 이제 말은
 * `SEAT_NAMES` 하나지만 프롬프트 본문이 그 값을 안 읽고 **손으로 적은 자리 이름**이 생길 수 있다. 그래서 값만
 * 견주지 않고 **보내는 프롬프트를 통째로 화면에 돌려** 남는 자리 이름이 없는지 잰다 — 한쪽만 고치면 빨개진다.
 */
describe('프롬프트의 자리 이름과 화면이 되읽는 자리 이름', () => {
  const seats = [SEAT_NAMES.first, SEAT_NAMES.second];
  const viewedAt = new Date('2026-08-26T04:00:00Z');
  const chart = (year: number) =>
    computeSaju({ year, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male' });
  const pairPrompt = (kind: 'match' | 'private') =>
    readingPromptOf(readingEvidenceOf(kind, { a: chart(1990), b: chart(1992) }, viewedAt), CONTROL);

  it('두 사람 프롬프트에 서는 자리 이름을 화면이 하나도 안 남긴다', () => {
    for (const prompt of [READING_PROMPTS.match, READING_PROMPTS.private, pairPrompt('match'), pairPrompt('private')]) {
      for (const seat of seats) expect(prompt).toContain(seat);

      const shown = withNicknames(prompt, { first: '민수', second: '지영' });
      for (const seat of seats) expect(shown).not.toContain(seat);
      /* 값과 다른 글자로 적힌 자리 이름 — 「첫째 분」처럼 한쪽만 고친 것 — 도 남기지 않는다(금지 예시의 「첫째 분」 하나는 빼고) */
      expect(shown.replace('「첫째 분」', '')).not.toMatch(/(째|번째)\s?(분|님)/);
    }
  });

  /** 사이를 고르면 프롬프트가 다시 지어진다 — 그 길도 호칭만 싣는다 */
  it('사이를 알아도 부르는 말은 자리 호칭이다', () => {
    const told = readingPromptOf(
      readingEvidenceOf('private', { a: chart(1990), b: chart(1992) }, viewedAt, CONTROL.matchInput, 'family'),
      CONTROL,
      { relation: 'family' },
    );

    expect(told).toContain(`\`charts.a\` 는 **${SEAT_NAMES.first}**, \`charts.b\` 는 **${SEAT_NAMES.second}**이다.`);
  });
});

describe('사용자가 읽는 사주풀이 본문', () => {
  it('내부 검토용 근거 절을 화면 본문에서 뺀다', () => {
    const markdown = `## 한 줄로

지금은 기준을 세울 때입니다.

### 근거 (검사용)

한 줄로 — analysis.strength [유도]`;

    expect(readingBody(markdown)).toBe('## 한 줄로\n\n지금은 기준을 세울 때입니다.');
  });

  it('근거 절이 없으면 원문 내용은 그대로 둔다', () => {
    expect(readingBody('  ## 한 줄로\n\n본문  ')).toBe('## 한 줄로\n\n본문');
  });

  it('본문 문장 안의 근거라는 말은 자르지 않는다', () => {
    const markdown = '## 한 줄로\n\n이 판단의 근거는 두 흐름이 겹친다는 점입니다.';

    expect(readingBody(markdown)).toBe(markdown);
  });
});

/**
 * **근거 절 제목은 `##` 로도 온다(2026-09-30, 운영자 답).** 모델이 가끔 `### 근거 (검사용)` 대신
 * `## 근거 (검사용)` 로 쓴다 — 실호출 원문 33편 중 1편(`person`). 프롬프트는 그대로 두고 받는 쪽을 넓혔다.
 */
describe('근거 절 제목의 `#` 개수', () => {
  const PERSON_LIKE = `## 먼저 볼 핵심 세 가지

1. 혼자 판단할 때 강점이 드러나요.

## 조심할 점과 몸

무리하지 않는 편이 좋아요.

## 근거 (검사용)

먼저 볼 핵심 세 가지 — 결론 「혼자 판단」 | 자료: analysis.strength [유도]
조심할 점과 몸 — 결론 「무리하지 않기」 | 자료: charts.a.analysis.elements [사실]`;

  it('`## 근거 (검사용)` 앞에서 본문을 끊고 뒤를 근거로 준다', () => {
    const body = readingBody(PERSON_LIKE);
    const grounding = readingGrounding(PERSON_LIKE);

    expect(body).not.toContain('근거 (검사용)');
    expect(body).not.toContain('analysis.strength');
    expect(body.endsWith('무리하지 않는 편이 좋아요.')).toBe(true);
    expect(grounding?.startsWith('## 근거 (검사용)\n')).toBe(true);
    expect(`${body}\n\n${grounding}`).toBe(PERSON_LIKE);
  });

  it('`## 근거` 만 있어도 끊는다', () => {
    expect(readingBody('## 한 줄로\n\n본문\n\n## 근거\n\n줄')).toBe('## 한 줄로\n\n본문');
  });

  it.each(['# 근거 (검사용)', '#### 근거 (검사용)', '## 근거의 층', '## 근거 있는 선택'])(
    '`%s` 는 근거 절이 아니다',
    (heading) => {
      const markdown = `## 한 줄로\n\n본문\n\n${heading}\n\n줄`;

      expect(readingBody(markdown)).toBe(markdown);
      expect(readingGrounding(markdown)).toBeNull();
    },
  );

  it('자기 풀이 절 제목 가운데 근거 절로 읽히는 것이 없다', () => {
    const assemblies = [CONTROL, ...PROMPT_VARIANTS.map((variant) => variant.assembly)];
    for (const assembly of assemblies) {
      for (const title of selfSectionTitlesOf(assembly)) {
        expect(GROUNDING_HEADING.test(`## ${title}`), title).toBe(false);
      }
    }
  });
});

/**
 * **잘라 낸 쪽도 읽을 수 있어야 검수가 된다.**
 *
 * 이 절은 프롬프트가 시켜서 만들어지고 DB 에 저장까지 되는데 어디에도 안 서 있었다.
 * 그러면 「이 문장이 왜 이렇게 나왔나」의 답이 사람의 짐작이 된다.
 */
describe('되짚는 자리가 읽는 근거 절', () => {
  const markdown = `## 한 줄로

지금은 기준을 세울 때입니다.

### 근거 (검사용)

한 줄로 — analysis.strength [유도]`;

  it('본문이 버린 쪽을 그대로 준다', () => {
    expect(readingGrounding(markdown)).toBe(
      '### 근거 (검사용)\n\n한 줄로 — analysis.strength [유도]',
    );
  });

  /** 자르는 자리가 하나여야 한다 — 둘이면 본문에서 뺀 줄이 여기에도 없는 날이 온다 */
  it('본문과 근거를 합치면 잘린 것이 없다', () => {
    const body = readingBody(markdown);
    const grounding = readingGrounding(markdown) ?? '';

    expect(`${body}\n\n${grounding}`).toBe(markdown);
  });

  /** 「모델이 안 썼다」와 「비어 있다」는 다른 사실이고, 안 쓴 것 자체가 검수 대상이다 */
  it('근거 절이 없으면 null 이다', () => {
    expect(readingGrounding('## 한 줄로\n\n본문뿐입니다.')).toBeNull();
    expect(readingGrounding('## 한 줄로\n\n본문\n\n### 근거 (검사용)\n\n   ')).toBeNull();
  });

  it('본문 문장 안의 근거라는 말에 걸리지 않는다', () => {
    expect(readingGrounding('## 한 줄로\n\n이 판단의 근거는 겹침입니다.')).toBeNull();
  });
});

describe('화면에서 사람을 부르는 말', () => {
  it('이름에는 님을 붙인다 — 안 붙이면 사람을 품평하는 글이 된다', () => {
    expect(calledName('지영')).toBe('지영님');
    expect(calledName('김철수')).toBe('김철수님');
    expect(calledName('Anna')).toBe('Anna님');
  });

  /**
   * 가족 호칭에도 붙인다. 목록을 두고 「엄마」를 빼던 판이 있었는데 사람이 걷기로
   * 정했다 — 이름표에 친구 이름 세 글자를 적는 일이 더 잦고, **예외를 위해 둔 판정은
   * 한국어의 호칭을 다 셀 수 없어 언제나 모자란다.**
   */
  it('가족 호칭에도 붙인다 — 예외를 두지 않는다', () => {
    expect(calledName('엄마')).toBe('엄마님');
    expect(calledName('동생')).toBe('동생님');
    expect(calledName('우리 형')).toBe('우리 형님');
  });

  /** 기계적으로 틀리는 자리만 막는다 */
  it('이미 님으로 끝나면 두 번 안 붙인다', () => {
    expect(calledName('어머님')).toBe('어머님');
    expect(calledName('선생님')).toBe('선생님');
  });

  it('자기를 가리키는 말에는 안 붙인다', () => {
    expect(calledName('나')).toBe('나');
  });

  /** 빈 자리를 「님」 한 글자로 만들지 않는다 */
  it('빈 이름은 빈 채로 둔다', () => {
    expect(calledName('   ')).toBe('');
  });
});
