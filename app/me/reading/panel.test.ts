import { describe, expect, it } from 'vitest';

import type { CurrentReading, ReadingCredits } from './current';
import { panelChrome } from './panel';

const reading = (over: Partial<CurrentReading> = {}): CurrentReading => ({
  id: 'r1',
  score: null,
  metaphor: null,
  output: '## 지금의 핵심',
  model: 'gpt-5.6-luna',
  viewedAt: '2026-09-20T00:00:00.000Z',
  createdAt: '2026-09-20T00:00:00.000Z',
  viewerIsFirst: true,
  fromCurrentChart: true,
  sourceRunId: 'run-1',
  myFeedback: null,
  dayMasterA: null,
  dayMasterB: null,
  scoreScale: { baseline: null, version: null, relation: null },
  ...over,
});

const credits = (over: Partial<ReadingCredits> = {}): ReadingCredits => ({
  limit: 3,
  used: 0,
  reserved: 0,
  requested: 0,
  available: 3,
  ...over,
});

type View = Parameters<typeof panelChrome>[0];

/** 글도 없고 도는 것도 없는, 상세 화면에 막 들어온 자리 */
const view = (over: Partial<View> = {}): View => ({
  kind: 'self',
  noun: '사주풀이',
  loading: false,
  reading: null,
  isMock: false,
  credits: credits(),
  automatic: false,
  onPage: true,
  expanded: false,
  consented: true,
  ...over,
});

describe('만드는 버튼이 서는 자리와 닫히는 자리', () => {
  /**
   * **다 쓴 것과 기다리는 것은 다르다.** 도는 시도가 자리를 잡고 있는 동안에는 버튼을
   * 닫지 않는다 — 그 사람이 누르면 DB 가 이유를 붙여 답하고, 그 이유는 이 화면이
   * 대신 말해 줄 수 없다(다른 대상을 만들고 있을 수도 있다).
   */
  it('남은 자리가 없어도 잡고 있는 자리가 있으면 안 닫는다', () => {
    expect(panelChrome(view({ credits: credits({ available: 0 }) })).makeDisabled).toBe(true);
    expect(
      panelChrome(view({ credits: credits({ available: 0, reserved: 1 }) })).makeDisabled,
    ).toBe(false);
  });

  /** 못 물은 숫자로 버튼을 닫지 않는다 — 모르는 것은 막는 근거가 아니다 */
  it('풀이권을 못 물었으면 버튼은 열려 있다', () => {
    expect(panelChrome(view({ credits: null })).makeDisabled).toBe(false);
  });

  it('만드는 중에는 닫힌다', () => {
    expect(panelChrome(view({ loading: true })).makeDisabled).toBe(true);
  });

  /**
   * 동의가 만드는 글(ADR 0038)은 성공 경로에 누를 것이 없다. **실패 경로에서까지
   * 없애지는 않는다** — 글도 없고 도는 것도 없으면 그 자리는 막다른 골목이 된다.
   */
  it('동의가 만드는 글은 글이 있거나 만드는 중일 때만 버튼이 사라진다', () => {
    const automatic = { automatic: true };

    expect(panelChrome(view({ ...automatic })).hideMake).toBe(false);
    expect(panelChrome(view({ ...automatic, reading: reading() })).hideMake).toBe(true);
    expect(panelChrome(view({ ...automatic, loading: true })).hideMake).toBe(true);
    /* 누르는 글에서는 어느 쪽이든 버튼이 남는다 */
    expect(panelChrome(view({ reading: reading() })).hideMake).toBe(false);
  });

  it('글을 읽으러 온 화면에 이미 글이 있으면 버튼은 머리로 올라간다', () => {
    expect(panelChrome(view({ reading: reading() })).makeInHeader).toBe(true);
    /* 아직 글이 없으면 권하는 말과 함께 칸 안에 선다 */
    expect(panelChrome(view()).makeInHeader).toBe(false);
    /* 카드로 설 때는 다른 것들 사이라 머리가 없다 */
    expect(panelChrome(view({ reading: reading(), onPage: false })).makeInHeader).toBe(false);
    /* 아예 안 서는 버튼은 올라갈 자리도 없다 */
    expect(
      panelChrome(view({ reading: reading(), automatic: true })).makeInHeader,
    ).toBe(false);
  });

  /** 「보기」가 아니라 「받기」다 — 누르면 풀이권 한 번이 나간다(`docs/prd.md` §3.2) */
  it('버튼 글자는 대상의 낱말을 따르고 세 자리를 가른다', () => {
    expect(panelChrome(view()).makeLabel).toBe('사주풀이 받기');
    expect(panelChrome(view({ reading: reading() })).makeLabel).toBe('사주풀이 다시 받기');
    expect(panelChrome(view({ loading: true })).makeLabel).toBe('사주풀이 받는 중…');
    expect(panelChrome(view({ noun: '궁합풀이', kind: 'private' })).makeLabel).toBe('궁합풀이 받기');
  });
});

describe('공유 버튼이 붙는 글', () => {
  /**
   * 인연 궁합은 링크로 못 내보낸다(ADR 0063·0012). 거기 있는 상대가 동의한 것은
   * 「이 사람에게 내 여덟 글자를 연다」이지 「누구에게든 연다」가 아니다.
   */
  it('인연 궁합에는 안 붙고 나머지 셋에는 붙는다', () => {
    const done = { reading: reading() };

    expect(panelChrome(view({ ...done, kind: 'self' })).canShare).toBe(true);
    expect(panelChrome(view({ ...done, kind: 'person' })).canShare).toBe(true);
    expect(panelChrome(view({ ...done, kind: 'private' })).canShare).toBe(true);
    expect(panelChrome(view({ ...done, kind: 'match' })).canShare).toBe(false);
  });

  /** 예시 글은 저장된 원문에 없다 — 세우면 사용자가 이유를 모르는 실패를 본다 */
  it('빈 링크가 될 자리에는 안 선다', () => {
    expect(panelChrome(view()).canShare).toBe(false);
    expect(panelChrome(view({ loading: true })).canShare).toBe(false);
    expect(panelChrome(view({ reading: reading(), isMock: true })).canShare).toBe(false);
  });
});

describe('설문이 붙는 글', () => {
  it('다 읽은 진짜 글에만 붙는다', () => {
    expect(panelChrome(view({ reading: reading() })).asksFeedback).toBe(true);
    expect(panelChrome(view()).asksFeedback).toBe(false);
    expect(panelChrome(view({ reading: reading(), loading: true })).asksFeedback).toBe(false);
    expect(panelChrome(view({ reading: reading(), isMock: true })).asksFeedback).toBe(false);
  });

  /** 거절한 사람에게 거절을 다시 보여 주지 않는다 — 통째로 안 선다 */
  it('동의하지 않았으면 안 선다', () => {
    expect(panelChrome(view({ reading: reading(), consented: false })).asksFeedback).toBe(false);
  });

  /**
   * 이 값이 생기기 전에 저장된 글들이 있다. 어느 시도가 만들었는지 되짚어 지어 넣지
   * 않았다 — **매달 자리가 없으면 안 묻는다.**
   */
  it('어느 시도가 만들었는지 모르는 옛 글에는 안 붙는다', () => {
    expect(
      panelChrome(view({ reading: reading({ sourceRunId: null }) })).asksFeedback,
    ).toBe(false);
  });

  /** 카드로 설 때는 접혀 있는 글 아래에 설문만 서면 묻는 자리가 글보다 먼저 보인다 */
  it('카드로 설 때는 펼친 뒤에만 붙는다', () => {
    const card = { reading: reading(), onPage: false };

    expect(panelChrome(view({ ...card })).asksFeedback).toBe(false);
    expect(panelChrome(view({ ...card, expanded: true })).asksFeedback).toBe(true);
  });
});
