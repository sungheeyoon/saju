import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { gateFor, NOTICE_UNREAD, type GateAccount, type GateNotice } from '@consent/gate';

import { supabase } from '@/auth/client';
import { readSchedule } from '@/auth/schedule';
import { FAILED } from '@/auth/signup';

export type Gate =
  | { kind: 'checking' }
  | { kind: 'out' }
  /** 가입이 안 끝났다 — 무슨 말을 할지는 가입 화면이 안다 */
  | { kind: 'signup' }
  /** 테스트가 끝났다 — 주소마다 `gateFor` 를 다시 묻는다. 열린 것은 설정(철회 · 탈퇴 신청)뿐이다 */
  | { kind: 'closed'; account: GateAccount; notice: GateNotice | null | typeof NOTICE_UNREAD }
  | { kind: 'in'; email: string | null }
  | { kind: 'failed'; message: string };

/** 세션과 가입을 본다 — 판정은 웹의 관문과 같은 `gateFor` 다. 계정을 못 읽으면 지나가지 않는다 */
export async function readGate(): Promise<Exclude<Gate, { kind: 'checking' }>> {
  if (supabase === null) return { kind: 'out' };
  const { data } = await supabase.auth.getSession();
  if (data.session === null) return { kind: 'out' };

  const [found, schedule] = await Promise.all([
    supabase.from('app_user').select('signed_up_at, notice_version, notice_schedule_id').maybeSingle(),
    readSchedule(),
  ]);
  if (found.error !== null) console.error('account', found.error.code);
  if (found.error !== null || found.data === null) return { kind: 'failed', message: FAILED };

  const account: GateAccount = {
    signedUp: found.data.signed_up_at !== null,
    noticeVersion: found.data.notice_version,
    noticeScheduleId: found.data.notice_schedule_id,
  };
  const notice = schedule.ok ? schedule.value : NOTICE_UNREAD;

  const to = gateFor('/me', account, notice, new Date());
  if (to === null) return { kind: 'in', email: data.session.user.email ?? null };
  return to === '/closed' ? { kind: 'closed', account, notice } : { kind: 'signup' };
}

/** 앱을 다시 앞으로 가져올 때도 다시 본다 — 웹은 요청마다 보고, 레이아웃은 화면을 옮겨도 다시 안 돈다 */
export function useGate(): { gate: Gate; retry: () => void } {
  const [gate, setGate] = useState<Gate>({ kind: 'checking' });

  const check = useCallback(() => {
    void readGate().then(setGate);
  }, []);

  useEffect(() => {
    check();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const auth = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setGate({ kind: 'out' });
    });
    return () => {
      foreground.remove();
      auth?.data.subscription.unsubscribe();
    };
  }, [check]);

  return { gate, retry: check };
}
