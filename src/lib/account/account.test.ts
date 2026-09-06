import { describe, expect, it } from 'vitest';

import {
  accountNoticeOf,
  accountStateOf,
  haltedText,
  type AccountState,
} from '.';

describe('accountStateOf — 다섯 자리를 전부 밟는다', () => {
  it('살아 있고 자기 사주가 있으면 active', () => {
    expect(accountStateOf({ ok: true, account: { status: 'active', selfPersonId: 'p1' } })).toEqual({
      kind: 'active',
      selfPersonId: 'p1',
    });
  });

  it('살아 있는데 자기 사주가 없으면 onboarding', () => {
    expect(accountStateOf({ ok: true, account: { status: 'active', selfPersonId: null } })).toEqual({
      kind: 'onboarding',
    });
  });

  it('중지는 까닭을 그대로 들고 간다 — 문구가 상태마다 다르기 때문이다', () => {
    expect(accountStateOf({ ok: true, account: { status: 'suspended' } })).toEqual({
      kind: 'halted',
      status: 'suspended',
    });
    expect(accountStateOf({ ok: true, account: { status: 'deletion_requested' } })).toEqual({
      kind: 'halted',
      status: 'deletion_requested',
    });
  });

  it('행이 없는 것과 못 물어본 것을 가른다', () => {
    expect(accountStateOf({ ok: false, reason: 'missing' })).toEqual({ kind: 'missing' });
    expect(accountStateOf({ ok: false, reason: 'unreachable' })).toEqual({ kind: 'unreachable' });
  });

  /**
   * 정책이 `id = auth.uid()` 하나라 정지된 계정도 자기 행을 읽는다. 못 읽었다는 것은
   * 정지의 증거가 될 수 없다 — 한 화면이 이 둘을 섞어서 틀린 말을 하고 있었다(ADR 0048).
   */
  it('못 읽은 것을 중지로 말하지 않는다', () => {
    for (const state of [
      accountStateOf({ ok: false, reason: 'missing' }),
      accountStateOf({ ok: false, reason: 'unreachable' }),
    ]) {
      expect(state.kind).not.toBe('halted');
      expect(accountNoticeOf(state)?.title).not.toBe(haltedText('suspended')?.title);
    }
  });

  /**
   * 온보딩을 안 묻는 화면(설정·풀이 목록·프로필)은 `self_person_id` 를 select 하지
   * 않는다. 안 물은 것에 답이 나오면 그 화면은 자기가 그릴 줄 모르는 상태를 받는다.
   */
  it('자기 사주를 안 읽은 화면에는 onboarding 이 안 나온다', () => {
    expect(accountStateOf({ ok: true, account: { status: 'active' } })).toEqual({
      kind: 'active',
      selfPersonId: null,
    });
  });
});

describe('accountNoticeOf — 막힌 자리마다 할 말이 있다', () => {
  it('active 와 onboarding 은 할 말이 없다', () => {
    expect(accountNoticeOf({ kind: 'active', selfPersonId: 'p1' })).toBeNull();
    expect(accountNoticeOf({ kind: 'onboarding' })).toBeNull();
  });

  it('나머지 셋은 반드시 말한다 — 빈 화면이 되지 않게', () => {
    const blocked: AccountState[] = [
      { kind: 'halted', status: 'suspended' },
      { kind: 'halted', status: 'deletion_requested' },
      { kind: 'missing' },
      { kind: 'unreachable' },
    ];
    for (const state of blocked) {
      const notice = accountNoticeOf(state);
      expect(notice, JSON.stringify(state)).not.toBeNull();
      expect(notice!.title.length).toBeGreaterThan(0);
      expect(notice!.detail.length).toBeGreaterThan(0);
    }
  });

  /**
   * DB 가 잠긴 사람에게 「다시 로그인해 주세요」는 들어올 곳이 없는 데로 보내는 말이다.
   * 둘을 가른 까닭이 이 한 줄이라, 문구가 도로 같아지면 가른 값이 사라진다.
   */
  it('못 읽은 까닭 둘이 서로 다른 지시를 준다', () => {
    const missing = accountNoticeOf({ kind: 'missing' })!;
    const unreachable = accountNoticeOf({ kind: 'unreachable' })!;
    expect(missing.detail).not.toBe(unreachable.detail);
    expect(missing.detail).toContain('로그인');
    expect(unreachable.detail).not.toMatch(/^다시 로그인/);
  });

  /** 제목은 마침표를 안 찍고 설명문은 찍는다 — CONTEXT.md 화면 문구 규칙 */
  it('마침표는 자리가 정한다', () => {
    for (const state of [{ kind: 'missing' }, { kind: 'unreachable' }] as AccountState[]) {
      const notice = accountNoticeOf(state)!;
      expect(notice.title.endsWith('.')).toBe(false);
      expect(notice.detail.endsWith('.')).toBe(true);
    }
  });
});
