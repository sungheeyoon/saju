import { describe, expect, it } from 'vitest';

import { CHART_ENGINE_VERSION, chartSnapshotOf } from '@/src/lib/saju';

import { chartOf } from './chart';
import { DEFAULT_QUERY, type Query } from './query';
import {
  NOTE_MAX,
  managedPersonArgs,
  noteOrNull,
  revisionArgs,
  samePillarInput,
  selfPersonArgs,
  unsupportedForSaving,
} from './revision';

/**
 * **저장된 것을 되읽는 쪽은 여기 없다**(`stored.test.ts`).
 *
 * 이 파일이 재는 것은 「폼이 든 입력에서 저장하는 문에 실을 값을 어떻게 짓는가」
 * 하나다. 되읽기는 다른 문의 일이고, 그 둘이 한 파일에 있으면 어느 쪽이 깨진
 * 것인지가 이름만으로 안 갈린다.
 */

const submitted: Query = {
  ...DEFAULT_QUERY,
  name: '민수',
  date: '1990-05-15',
  time: '14:30',
  hourKnown: true,
  gender: 'male',
  city: '서울',
  rule: 'jo',
  basis: 'localMean',
};

describe('저장 전에 거절하는 것', () => {
  it('제대로 고른 입력은 통과한다', () => {
    expect(unsupportedForSaving(submitted)).toBeNull();
  });

  it('변환할 수 없는 음력은 저장 전에 거절한다', () => {
    // 2024년에는 윤달이 없다.
    const impossible: Query = { ...submitted, calendar: 'lunar_leap', date: '2024-04-01' };

    expect(unsupportedForSaving(impossible)).toMatch(/윤달이 없습니다/);
  });

  it.each([
    ['성별', { gender: 'X' as Query['gender'] }],
    ['출생지', { city: '평양' as Query['city'] }],
    ['자시 규칙', { rule: 'zz' as Query['rule'] }],
    ['시간 기준', { basis: 'sundial' as Query['basis'] }],
  ])('모르는 %s 은 기본값으로 고쳐 넣지 않고 거절한다', (_label, patch) => {
    expect(unsupportedForSaving({ ...submitted, ...patch })).not.toBeNull();
  });
});

describe('무엇이 새 판본을 만드는가', () => {
  it('이름만 고치면 같은 판본이다 — 이름은 여덟 글자를 바꾸지 않는다', () => {
    expect(samePillarInput(submitted, { ...submitted, name: '아빠' })).toBe(true);
  });

  it('세운을 어느 해부터 보는지도 판본을 가르지 않는다', () => {
    expect(samePillarInput(submitted, { ...submitted, saeunFrom: 2000 })).toBe(true);
  });

  it.each([
    ['생년월일', { date: '1990-05-16' }],
    ['출생시각', { time: '14:31' }],
    ['시각 모름', { hourKnown: false, time: '' }],
    ['성별', { gender: 'female' as const }],
    ['출생지', { city: '부산' as const }],
    ['자시 규칙', { rule: 'ya' as const }],
    ['시간 기준', { basis: 'record' as const }],
  ])('%s 이 달라지면 다른 판본이다', (_label, patch) => {
    expect(samePillarInput(submitted, { ...submitted, ...patch })).toBe(false);
  });

  it('수정 인자에는 부를 이름이 없다', () => {
    expect(Object.keys(revisionArgs('p-1', submitted))).not.toContain('p_local_label');
  });
});

describe('가족·친구를 등록할 때 함께 가는 것', () => {
  it('판본이 될 부분은 자기 사주를 저장할 때와 **같은 값**이다', () => {
    const { p_note, ...managed } = managedPersonArgs(submitted, '음력 생일만 아신다');

    expect(managed).toEqual(selfPersonArgs(submitted));
    expect(p_note).toBe('음력 생일만 아신다');
  });

  /**
   * **무슨 사이인가는 여기 없다.** 사람이 아니라 쌍에 붙는 값이고, 묻는 자리도
   * 사람을 등록하는 곳이 아니라 궁합을 보는 곳이다.
   */
  it('사람을 등록하는 인자에 관계가 없다', () => {
    expect(Object.keys(managedPersonArgs(submitted, ''))).not.toContain('p_relation');
  });

  /**
   * 없음은 **한 값**이다.
   *
   * 빈 칸을 `''` 로 저장하면 「메모 없음」이 두 값이 되고, 그때부터 화면은 두 가지를
   * 물어야 한다. DB 검사식도 같은 것을 든다(`note_is_absent_or_written`).
   */
  it.each(['', '   ', '\n'])('빈 메모는 %j 든 null 이다', (note) => {
    expect(noteOrNull(note)).toBeNull();
    expect(managedPersonArgs(submitted, note).p_note).toBeNull();
  });

  it('메모의 앞뒤 공백은 지운다 — 길이 상한이 공백을 세지 않게', () => {
    expect(noteOrNull('  엄마는 음력  ')).toBe('엄마는 음력');
    expect(NOTE_MAX).toBe(200);
  });
});

/**
 * 저장하는 문에 여덟 글자가 함께 간다(ADR 0071 · A2).
 *
 * 앱이 그것을 주장하는 자리는 **입력을 쓰는 문 하나**이고, 여기가 그 문에 실을 값을 짓는
 * 자리다. 그래서 화면이 그리는 것과 **같은 함수**로 세는지를 여기서 잠근다.
 */
describe('저장하는 문에는 여덟 글자가 함께 간다', () => {
  it('빌더 셋이 여덟 글자와 그것을 낸 판을 싣는다', () => {
    for (const args of [
      selfPersonArgs(submitted),
      revisionArgs('p-1', submitted),
      managedPersonArgs(submitted, ''),
    ]) {
      expect(args.p_chart).toEqual(chartSnapshotOf(chartOf(submitted).pillars));
      expect(args.p_chart_engine_version).toBe(CHART_ENGINE_VERSION);
    }
  });

  /** DB 가 빈 판을 거절한다(`reject_bad_chart`) — 여기서 빈 값을 지어 보내지 않는다 */
  it('판 이름은 비어 있지 않다', () => {
    expect(CHART_ENGINE_VERSION.trim()).not.toBe('');
  });

  it('일간은 일주의 천간이다 — DB 도 같은 것을 본다', () => {
    const { p_chart } = selfPersonArgs(submitted);

    expect(p_chart.dayMaster).toBe(p_chart.day.stem);
  });

  it('시각을 모르면 시주가 null 이다 — 문이 birth_time 과 대조한다', () => {
    const unknown: Query = { ...submitted, hourKnown: false, time: '' };

    expect(selfPersonArgs(unknown).p_chart.hour).toBeNull();
  });

  /**
   * **여덟 글자는 `chartFields` 에 안 들어간다.**
   *
   * 저것은 두 입력이 같은 판본인지를 키마다 `===` 로 견주는 데 쓰인다. 거기에 객체가
   * 끼면 같은 값을 넣어도 언제나 다르다고 답하고, 그 순간 「같은 값으로 저장하면 판본을
   * 쌓지 않는다」가 무너진다. 갈라 둔 것이 지켜지는지를 값으로 든다.
   */
  it('같은 판본인가를 견주는 데는 안 끼어든다', () => {
    expect(samePillarInput(submitted, { ...submitted, name: '다른 이름' })).toBe(true);
  });
});
