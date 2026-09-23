import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import {
  CONTROL,
  LEGACY_PAIR_ASSEMBLY,
  MATCH_INPUT_VARIANTS,
  NOTHING_KNOWN,
  PAIR_VARIANTS,
  isSolo,
  promptSlotsOf,
  readingEvidenceOf,
  readingPromptOf,
  type PromptAssembly,
  type PromptSlot,
  type ReadingKind,
} from '.';

/**
 * **어느 세대의 지시가 어느 자리에 서는가** — 표가 잠근다.
 *
 * 이 파일에는 지시가 세 벌 산다(개인 풀이 · 옛 궁합 · 읽는 법 4판). 세 벌이 자리마다
 * 골라 서는데, 그 고르는 일이 한동안 **자리마다 따로** 일어났다 — 술어 다섯이 열두
 * 자리에서 각각 답을 냈고 **그래서 한 번 틀렸다**(비공개 궁합이 판정 서열 절을 `solo`
 * 문에 함께 잘려 잃었다).
 *
 * 그래서 재는 것이 둘이다.
 *
 * 1. **표가 적은 자리와 실제로 선 자리가 같은가** — 양방향. 표가 「안 선다」고 적은 절이
 *    글에 있으면 빨간불이고, 「선다」고 적은 절이 글에 없어도 빨간불이다.
 * 2. **한 글에 두 세대가 섞이지 않는가** — 한 자리만 다른 세대로 갈리는 것이 위 사고의
 *    모양이다. 이음매 넷(규칙 · 말투 · 근거 칸 · 한 줄 요약)을 세대별 표식으로 잰다.
 *
 * **글자는 안 잰다.** 프롬프트 본문이 바뀌었는지는 실호출 전에 따로 재고(ADR 0073·0074),
 * 여기서 잠그는 것은 **무엇이 서고 무엇이 안 서는가**뿐이다.
 */

const VIEWED_AT = new Date('2026-08-25T13:00:00+09:00');
const A = computeSaju({ year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male' });
const B = computeSaju({ year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' });

const promptFor = (kind: ReadingKind, assembly: PromptAssembly): string =>
  readingPromptOf(
    readingEvidenceOf(kind, isSolo(kind) ? { a: A } : { a: A, b: B }, VIEWED_AT, assembly.matchInput),
    assembly,
    NOTHING_KNOWN,
  );

/** 자료 앞까지 — 뒤에 붙는 JSON 안의 글자를 절로 세지 않는다 */
const headOf = (prompt: string) => prompt.split('\n## 자료 (')[0];

type Case = {
  readonly id: string;
  readonly kind: ReadingKind;
  readonly assembly: PromptAssembly;
  readonly slots: readonly PromptSlot[];
};

/**
 * 도달하는 조합 전부 — 운영 넷 · 원복 둘 · 견줄 짝 셋, 그리고 **아직 아무 목록에도 없는 하나.**
 *
 * 마지막 것(`private/guided+sections`)은 변형 목록에 없지만 타입이 막지 않아 **지을 수는
 * 있다.** 그 자리에서 「성격을 읽는 순서」가 서는 것이 지금의 판단이고, 세대 하나로
 * 뭉뚱그리면 조용히 사라질 자리라 값으로 든다.
 */
const CASES: readonly Case[] = [
  {
    id: 'self/control',
    kind: 'self',
    assembly: CONTROL,
    slots: ['role', 'rules', 'voice', 'personality', 'claimStrength', 'precedence', 'body', 'summary', 'output'],
  },
  {
    id: 'person/control',
    kind: 'person',
    assembly: CONTROL,
    slots: ['role', 'rules', 'voice', 'personality', 'claimStrength', 'precedence', 'body', 'summary', 'output'],
  },
  {
    id: 'private/control',
    kind: 'private',
    assembly: CONTROL,
    slots: ['role', 'rules', 'guide', 'voice', 'body', 'summary', 'output'],
  },
  {
    id: 'match/control',
    kind: 'match',
    assembly: CONTROL,
    slots: ['role', 'rules', 'scope', 'guide', 'voice', 'body', 'summary', 'output'],
  },
  {
    id: 'private/legacy',
    kind: 'private',
    assembly: LEGACY_PAIR_ASSEMBLY,
    slots: ['role', 'rules', 'voice', 'claimStrength', 'body', 'summary', 'output'],
  },
  {
    id: 'match/legacy',
    kind: 'match',
    assembly: LEGACY_PAIR_ASSEMBLY,
    slots: ['role', 'rules', 'scope', 'voice', 'body', 'summary', 'output'],
  },
  {
    id: 'private/sections',
    kind: 'private',
    assembly: PAIR_VARIANTS[1].assembly,
    slots: ['role', 'rules', 'voice', 'personality', 'claimStrength', 'body', 'summary', 'output'],
  },
  {
    id: 'match/limited',
    kind: 'match',
    assembly: MATCH_INPUT_VARIANTS[0].assembly,
    slots: ['role', 'rules', 'scope', 'voice', 'body', 'summary', 'output'],
  },
  {
    id: 'match/extended',
    kind: 'match',
    assembly: MATCH_INPUT_VARIANTS[1].assembly,
    slots: ['role', 'rules', 'scope', 'voice', 'body', 'summary', 'output'],
  },
  {
    id: 'private/guided+sections',
    kind: 'private',
    assembly: { ...CONTROL, pairShape: 'sections-v1' },
    slots: ['role', 'rules', 'guide', 'voice', 'personality', 'body', 'summary', 'output'],
  },
  {
    id: 'match/legacy-v0+guide-v4',
    kind: 'match',
    assembly: { ...CONTROL, matchInput: 'legacy-v0', pairReading: 'guide-v4' },
    slots: ['role', 'rules', 'scope', 'voice', 'body', 'summary', 'output'],
  },
];

/**
 * **설지 말지가 술어로 갈리는 자리와 그 자리의 표식.**
 *
 * 늘 서는 자리(`role`·`rules`·`voice`·`body`·`summary`·`output`)는 여기 없다 — 그쪽은
 * 「섰는가」가 아니라 「어느 세대인가」가 갈리므로 아래 이음매 표가 잰다.
 *
 * `extra`(`extraSections`)에는 표식이 없다. 실험이 끼우는 임의의 문자열이라 소제목이 있을
 * 것도 정해져 있지 않고, 지금 어느 조립도 안 쓴다 — **없는 표식을 지어 적지 않는다.**
 */
const OPTIONAL_MARKERS = {
  scope: '## 이 자료의 범위',
  guide: '## 이 자료를 읽는 법',
  personality: '## 성격을 읽는 순서',
  claimStrength: '## 얼마나 세게 말할까',
  precedence: '## 무엇을 쓰면 좋은지가 갈릴 때',
} as const satisfies Partial<Record<PromptSlot, string>>;

/**
 * **이음매마다 두 세대의 표식** — 한 자리가 다른 세대로 갈리면 여기서 잡힌다.
 *
 * 넷을 고른 까닭은 그 넷이 **세대마다 다른 글을 드는 자리**이기 때문이다. 규칙은 근거의
 * 층(옛 벌)과 말의 세기(4판)로, 말투는 개인 풀이 전용 절로, 근거 칸과 한 줄 요약은 각
 * 벌의 고유한 줄로 갈린다.
 */
const SEAMS = [
  { seam: '규칙', legacy: '## 근거의 층', guided: '## 말의 세기' },
  { seam: '근거 칸', legacy: '`넘어간 것` 을 `없음` 으로 채우고 싶은 유혹을 이겨라', guided: '여기 적은 한계와 기준 설명을 본문으로 옮기지 않는다' },
  { seam: '한 줄 요약', legacy: '비유하지 말고 직접 요약한다', guided: '**본문을 다 쓴 뒤에** 쓴다' },
  { seam: '출력 계약', legacy: '프롬프트에서 JSON 모양을 되풀이하지 않는다', guided: '**`markdown` 에 본문을 끝까지 쓰고**' },
] as const;

const guidedIn = (one: Case) => one.slots.includes('guide');

describe('판마다 서는 자리를 표가 든다', () => {
  it.each(CASES)('$id', (one) => {
    expect(promptSlotsOf(one.kind, one.assembly)).toEqual(one.slots);
  });

  /**
   * **표 대 글, 양방향.** 표가 적은 자리는 글에 실제로 있어야 하고, 표에 없는 자리는
   * 글에도 없어야 한다. 한쪽만 재면 표가 넓어지는 것과 글이 좁아지는 것 중 하나를 놓친다.
   */
  it.each(CASES)('$id — 선다고 적힌 자리만 실제로 선다', (one) => {
    const head = headOf(promptFor(one.kind, one.assembly));

    for (const [slot, marker] of Object.entries(OPTIONAL_MARKERS)) {
      expect(head.includes(marker), `${one.id} · ${slot}`).toBe(
        one.slots.includes(slot as PromptSlot),
      );
    }
  });
});

describe('한 글에 두 세대가 섞이지 않는다', () => {
  it.each(CASES)('$id', (one) => {
    const head = headOf(promptFor(one.kind, one.assembly));
    const guided = guidedIn(one);

    for (const { seam, legacy, guided: fourth } of SEAMS) {
      expect(head.includes(fourth), `${one.id} · ${seam} · 4판`).toBe(guided);
      expect(head.includes(legacy), `${one.id} · ${seam} · 옛 벌`).toBe(!guided);
    }
  });

  /**
   * 개인 풀이 전용 절은 **개인 풀이에만** — 옛 궁합은 같은 조각을 여럿 쓰지만 이 둘은 안 쓴다.
   */
  it.each(CASES)('$id — 개인 풀이 전용 절은 한 사람짜리에만 선다', (one) => {
    const head = headOf(promptFor(one.kind, one.assembly));

    for (const selfOnly of ['## 누구에게 쓰는가', '## 마지막 규칙']) {
      expect(head.includes(selfOnly), `${one.id} · ${selfOnly}`).toBe(isSolo(one.kind));
    }
  });
});

/**
 * **범위 절도 고른 세대를 따른다** — 옛 컷에 읽는 법 4판을 걸어도 세대는 옛 벌이다.
 *
 * `usesPairGuide` 는 인연 궁합의 옛 컷 입력에 4판을 안 건다(원복 조립은 옛 지시를 그대로
 * 내야 한다). 그런데 범위 절만은 한동안 `pairReading` 을 **따로 읽고** 있었다 — 지금은
 * `matchScope` 가 옛 컷에서 먼저 돌아서므로 두 식이 같은 글을 내지만, 같은 사실을 두 자리에서
 * 세는 동안은 **갈릴 수 있는 자리**다. 고른 값을 넘기게 고치고 그것을 여기서 잠근다.
 *
 * **오늘은 안 문다** — 고치기 전에도 이 시험은 초록이었다. 여기 서 있는 까닭은 옛 컷의
 * 범위 문장이 4판을 타기 시작하는 날 그것이 조용히 지나가지 않게 하는 것이다.
 */
describe('옛 컷에 4판을 걸어도 세대는 옛 벌이다', () => {
  it('통째로 원복 조립과 같은 글이다', () => {
    const combo = promptFor('match', { ...CONTROL, matchInput: 'legacy-v0', pairReading: 'guide-v4' });

    expect(combo).toBe(promptFor('match', LEGACY_PAIR_ASSEMBLY));
  });
});

/**
 * **운영 네 판의 소제목 차례** — 무엇이 서는지에 더해 **어디에 서는지**까지 값으로 든다.
 *
 * 자리 표(`SLOT_ORDER`)를 고쳐 순서만 바꾸는 변경은 위의 시험들을 다 지나간다. 사용자에게
 * 가는 넷은 그 차례까지 잠근다.
 */
describe('운영 네 판의 소제목 차례', () => {
  const headingsOf = (kind: ReadingKind) =>
    (headOf(promptFor(kind, CONTROL)).match(/^## .*$/gm) ?? []).map((line) => line.slice(3));

  const SELF_HEADINGS = [
    '한눈에',
    '자리가 붙은 사실',
    '이 자료가 무엇인가',
    '사실에 관한 단 하나의 금지',
    '근거의 층 — 입을 막는 눈금이 아니라 딱지다',
    '문장을 어떻게 닫을 것인가',
    '고객에게 말하는 말투',
    '누구에게 쓰는가',
    '본문 규칙',
    '이름 대신 그 이름이 가리키는 것을 쓴다',
    '마지막 규칙',
    '성격을 읽는 순서',
    '얼마나 세게 말할까',
    '무엇을 쓰면 좋은지가 갈릴 때',
    '낼 것',
    '한 줄 요약',
    '구조화 출력의 뜻',
  ];

  /** 두 궁합은 「이 자료의 범위」 한 줄만 다르다 — 인연 궁합에만 선다 */
  const pairHeadings = (scope: boolean) => [
    '한눈에',
    '자리가 붙은 사실',
    '이 자료가 무엇인가',
    '사실에 관한 단 하나의 금지',
    '말의 세기',
    ...(scope ? ['이 자료의 범위'] : []),
    '이 자료를 읽는 법',
    '틀리면 안 되는 것',
    '이 두 사람에게서 두드러지는 이야기를 고른다',
    '글을 나누는 법',
    '본문에 옮기지 않는 것',
    '문장을 어떻게 닫을 것인가',
    '고객에게 말하는 말투',
    '본문 규칙',
    '이름 대신 그 이름이 가리키는 것을 쓴다',
    '두 사람을 부르는 말',
    '두 사람은 무슨 사이인가',
    '무엇을 쓸까',
    '낼 것',
    '점수',
    '한 줄 요약',
    '구조화 출력의 뜻',
    '기준점',
  ];

  it('자기 풀이와 저장된 사람 풀이는 같은 차례다', () => {
    expect(headingsOf('self')).toEqual(SELF_HEADINGS);
    expect(headingsOf('person')).toEqual(SELF_HEADINGS);
  });

  it('비공개 궁합은 범위 절 없이 선다', () => {
    expect(headingsOf('private')).toEqual(pairHeadings(false));
  });

  it('인연 궁합은 같은 차례에 범위 절이 하나 더 선다', () => {
    expect(headingsOf('match')).toEqual(pairHeadings(true));
  });
});
