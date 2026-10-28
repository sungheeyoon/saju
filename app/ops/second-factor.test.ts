import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error('not-found');
  },
}));

import {
  backTo,
  opsReturnPath,
  secondFactorGate,
  secondFactorHref,
  secondFactorOf,
  writeWithoutSecondFactor,
} from './second-factor';

/**
 * 운영자 문 앞의 두 번째 요소(ADR 0209 · 0123) — 이 자리가 Auth 의 답을 **어떻게 읽는가**를 잰다.
 *
 * 서명 확인과 요소 목록은 라이브러리의 것이다. 재는 것 셋: aal2 만 통과다 · aal1 이면 확인을 마친 TOTP 가 있을
 * 때만 확인 화면이다(없으면 운영자가 아닌 사람과 같은 거절) · 목록을 못 읽으면 통과가 아니다.
 */
const client = (
  aal: string | null,
  factors: { totp: unknown[] } | 'fails',
) => {
  const listFactors = vi.fn(async () =>
    factors === 'fails'
      ? { data: null, error: new Error('auth down') }
      : { data: { all: factors.totp, totp: factors.totp, phone: [], webauthn: [] }, error: null },
  );
  const getClaims = vi.fn(async () =>
    aal === null
      ? { data: null, error: new Error('invalid') }
      : { data: { claims: { sub: 'u-1', aal }, header: {}, signature: new Uint8Array() }, error: null },
  );
  const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<{ data: null; error: null }>>(async () => ({
    data: null,
    error: null,
  }));
  return { listFactors, rpc, supabase: { auth: { getClaims, mfa: { listFactors } }, rpc } as never };
};

const REPORT = '0f8c2a3e-1b4d-4c5e-8f6a-7b8c9d0e1f2a';

describe('secondFactorOf', () => {
  it('서명이 확인된 토큰의 aal 이 aal2 면 통과이고, 요소 목록은 묻지 않는다', async () => {
    const { supabase, listFactors } = client('aal2', { totp: [] });
    expect(await secondFactorOf(supabase)).toBe('passed');
    expect(listFactors).not.toHaveBeenCalled();
  });

  it('aal1 이고 확인을 마친 TOTP 가 있으면 확인 화면이다', async () => {
    const { supabase } = client('aal1', { totp: [{ id: 'f-1' }] });
    expect(await secondFactorOf(supabase)).toBe('challenge');
  });

  it('aal1 이고 확인을 마친 TOTP 가 없으면 등록이다 — 운영자 문 앞에서는 거절이다', async () => {
    const { supabase } = client('aal1', { totp: [] });
    expect(await secondFactorOf(supabase)).toBe('enroll');
  });

  it('서명을 확인 못 하면 aal2 로 읽지 않는다', async () => {
    const { supabase } = client(null, { totp: [] });
    expect(await secondFactorOf(supabase)).toBe('enroll');
  });

  it('요소 목록을 못 읽으면 통과가 아니다', async () => {
    const { supabase } = client('aal1', 'fails');
    expect(await secondFactorOf(supabase)).toBe('unread');
  });
});

describe('secondFactorGate — 운영 화면의 머리', () => {
  it('aal2 면 돌아오고, 거절을 적지 않는다', async () => {
    const { supabase, rpc } = client('aal2', { totp: [] });
    await expect(secondFactorGate(supabase, 'today.figures', '/ops/today')).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('aal1 이고 인증 앱이 있으면 돌아올 자리를 싣고 확인 화면으로 보낸다 — 운영자 문 · 거절 기록은 안 부른다', async () => {
    const { supabase, rpc } = client('aal1', { totp: [{ id: 'f-1' }] });
    await expect(secondFactorGate(supabase, 'members.find', '/ops/members?q=kim')).rejects.toThrow(
      'redirect:/ops/mfa?next=%2Fops%2Fmembers%3Fq%3Dkim',
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('aal1 이고 인증 앱이 없으면 운영자가 아닌 사람과 같은 404 이고, 거절을 그 화면의 머리 문 이름으로 적는다', async () => {
    const { supabase, rpc } = client('aal1', { totp: [] });
    await expect(secondFactorGate(supabase, 'reports.detail', `/ops/reports/${REPORT}`, { reportId: REPORT })).rejects.toThrow(
      'not-found',
    );
    expect(rpc.mock.calls).toEqual([['note_operator_denial', { p_action: 'reports.detail', p_report_id: REPORT }]]);
  });

  it('요소 목록을 못 읽어도 404 다', async () => {
    const { supabase } = client('aal1', 'fails');
    await expect(secondFactorGate(supabase, 'survey.overview', '/ops/survey')).rejects.toThrow('not-found');
  });
});

describe('writeWithoutSecondFactor — 운영 액션의 맨 앞', () => {
  it('aal2 면 null 이다', async () => {
    const { supabase, rpc } = client('aal2', { totp: [] });
    expect(await writeWithoutSecondFactor(supabase, 'members.suspend')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('aal1 이면 인증 앱이 있어도 거절하고, 운영자가 아닌 사람의 쓰기와 같은 줄로 적는다', async () => {
    const { supabase, rpc } = client('aal1', { totp: [{ id: 'f-1' }] });
    const answer = await writeWithoutSecondFactor(supabase, 'reports.review', { reportId: REPORT });
    expect(answer?.ok).toBe(false);
    expect(rpc.mock.calls).toEqual([['note_operator_denial', { p_action: 'reports.review', p_report_id: REPORT }]]);
  });
});

describe('backTo', () => {
  it('주소 값의 첫 글자 값만 잇는다', () => {
    expect(backTo('/ops/members', { q: 'kim', history: ['grant', 'x'], none: undefined })).toBe(
      '/ops/members?q=kim&history=grant',
    );
    expect(backTo('/ops/orders')).toBe('/ops/orders');
  });
});

describe('opsReturnPath', () => {
  it('운영 화면 아래의 주소는 거르기까지 그대로 돌아간다', () => {
    expect(opsReturnPath('/ops/reports?review=open&page=2')).toBe('/ops/reports?review=open&page=2');
    expect(opsReturnPath(['/ops/survey'])).toBe('/ops/survey');
  });

  it('운영 화면 밖 · 바깥 주소 · 확인 화면 자신은 오늘의 숫자로 간다', () => {
    for (const bad of [
      undefined,
      null,
      '',
      '/me',
      '//evil.example/ops/',
      'https://evil.example/ops/reports',
      '/ops/../me',
      '/ops/mfa',
      '/ops/mfa?next=/ops/survey',
      '/opsx',
    ]) {
      expect(opsReturnPath(bad)).toBe('/ops/today');
    }
  });

  it('확인 화면으로 가는 주소는 돌아올 자리를 싣는다', () => {
    expect(secondFactorHref('/ops/reports/abc')).toBe('/ops/mfa?next=%2Fops%2Freports%2Fabc');
  });
});
