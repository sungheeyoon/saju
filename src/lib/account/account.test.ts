import { describe, expect, it } from 'vitest';

import {
  accountFailureOf,
  accountNoticeOf,
  accountStateOf,
  haltedText,
  type AccountState,
} from '.';

const EMAIL = 'help@example.com';

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
      expect(accountNoticeOf(state, EMAIL)?.title).not.toBe(haltedText('suspended', EMAIL)?.title);
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
    expect(accountNoticeOf({ kind: 'active', selfPersonId: 'p1' }, EMAIL)).toBeNull();
    expect(accountNoticeOf({ kind: 'onboarding' }, EMAIL)).toBeNull();
  });

  it('나머지 셋은 반드시 말한다 — 빈 화면이 되지 않게', () => {
    const blocked: AccountState[] = [
      { kind: 'halted', status: 'suspended' },
      { kind: 'halted', status: 'deletion_requested' },
      { kind: 'missing' },
      { kind: 'unreachable' },
    ];
    for (const state of blocked) {
      const notice = accountNoticeOf(state, EMAIL);
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
    const missing = accountNoticeOf({ kind: 'missing' }, EMAIL)!;
    const unreachable = accountNoticeOf({ kind: 'unreachable' }, EMAIL)!;
    expect(missing.detail).not.toBe(unreachable.detail);
    expect(missing.detail).toContain('로그인');
    expect(unreachable.detail).not.toMatch(/^다시 로그인/);
  });

  /** 제목은 마침표를 안 찍고 설명문은 찍는다 — docs/context/copy.md 화면 문구 규칙 */
  it('마침표는 자리가 정한다', () => {
    for (const state of [{ kind: 'missing' }, { kind: 'unreachable' }] as AccountState[]) {
      const notice = accountNoticeOf(state, EMAIL)!;
      expect(notice.title.endsWith('.')).toBe(false);
      expect(notice.detail.endsWith('.')).toBe(true);
    }
  });
});

describe('정지 화면의 본문 — 운영자 확정 문구 그대로다 (G-111-8, 2026-10-17)', () => {
  const detailOf = (reason: string | null, nickname: string | null = '하늘') =>
    accountNoticeOf({ kind: 'halted', status: 'suspended', suspension: { nickname, reason } }, EMAIL)!.detail;

  it('갈래 다섯은 확정 낱말로 선다', () => {
    expect(detailOf('report')).toBe(
      '하늘 님은 신고 내용 확인 사유로 이용제한 중이에요. 저장된 자료는 그대로 있어요. 이의가 있으면 help@example.com으로 소명해 주세요.',
    );
    expect(detailOf('policy')).toContain('하늘 님은 운영정책 위반 사유로 이용제한 중이에요.');
    expect(detailOf('payment')).toContain('하늘 님은 결제 부정 이용 사유로 이용제한 중이에요.');
    expect(detailOf('eligibility')).toContain('하늘 님은 이용 자격(만 19세 이상) 미충족 사유로 이용제한 중이에요.');
    expect(detailOf('other')).toContain('하늘 님은 기타 운영 사유로 이용제한 중이에요.');
  });

  it('갈래가 없으면 갈래 구만 빠진다 — 직접 UPDATE · 이력 전의 정지 · 모르는 갈래', () => {
    const bare =
      '하늘 님은 이용제한 중이에요. 저장된 자료는 그대로 있어요. 이의가 있으면 help@example.com으로 소명해 주세요.';
    expect(detailOf(null)).toBe(bare);
    expect(detailOf('deletion_withdrawn')).toBe(bare);
  });

  it('문을 못 읽었으면 닉네임 · 갈래 구를 빼고도 소명 경로는 선다', () => {
    const notice = accountNoticeOf({ kind: 'halted', status: 'suspended', suspension: null }, EMAIL)!;
    expect(notice.detail).toBe('이용제한 중이에요. 저장된 자료는 그대로 있어요. 이의가 있으면 help@example.com으로 소명해 주세요.');
    expect(accountNoticeOf({ kind: 'halted', status: 'suspended' }, EMAIL)!.detail).toBe(notice.detail);
  });

  it('제목은 「이용이 제한된 계정이에요」다 — 운영자 답 2026-10-17', () => {
    expect(haltedText('suspended', EMAIL)?.title).toBe('이용이 제한된 계정이에요');
  });

  it('탈퇴 대기의 문장은 정지 안내를 싣지 않는다', () => {
    const leaving = accountNoticeOf(
      { kind: 'halted', status: 'deletion_requested', suspension: { nickname: '하늘', reason: 'policy' } },
      EMAIL,
    )!;
    expect(leaving.title).toBe('탈퇴를 신청한 계정입니다');
    expect(leaving.detail).not.toContain('이용제한');
  });

  it('탈퇴 대기의 본문은 3일 안에 지워진다고 말한다 — 운영자 확정 2026-10-17, 크론이 신청 하루 뒤부터 처분한다', () => {
    expect(haltedText('deletion_requested', EMAIL)?.detail).toBe(
      '탈퇴 신청이 접수되었어요. 인연 찾기 노출과 새 요청·풀이 생성은 멈췄고, 저장된 자료는 3일 안에 지워져요. 되돌리려면 운영자에게 알려 주세요.',
    );
  });

  it('정지를 읽은 상태는 그 값을 그대로 들고 간다', () => {
    expect(
      accountStateOf({ ok: true, account: { status: 'suspended', suspension: { nickname: '하늘', reason: 'payment' } } }),
    ).toEqual({ kind: 'halted', status: 'suspended', suspension: { nickname: '하늘', reason: 'payment' } });
  });
});

describe('accountFailureOf — 못 읽은 계정은 실패 줄로 선다 (G-100)', () => {
  it('못 읽은 까닭 둘만 줄이 서고, 다음 길이 다르다', () => {
    expect(accountFailureOf({ kind: 'missing' })?.next).toBe('signIn');
    expect(accountFailureOf({ kind: 'unreachable' })?.next).toBe('retry');
  });

  it('정지 · 활성 · 온보딩에는 줄이 없다 — 다시 해도 안 풀리거나 막힌 것이 아니다', () => {
    expect(accountFailureOf({ kind: 'halted', status: 'suspended' })).toBeNull();
    expect(accountFailureOf({ kind: 'active', selfPersonId: 'p1' })).toBeNull();
    expect(accountFailureOf({ kind: 'onboarding' })).toBeNull();
  });
});
