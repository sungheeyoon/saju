import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { gateFor, NOTICE_UNREAD, type GateAccount, type GateNotice } from '@consent/gate';

import { supabase } from '@/auth/client';
import { readSchedule } from '@/auth/schedule';
import { UNREACHABLE } from '@/auth/signup';
import { settled } from '@/ui/settled';

export type Gate =
  | { kind: 'checking' }
  | { kind: 'out' }
  /** 가입이 안 끝났다 — 무슨 말을 할지는 가입 화면이 안다 */
  | { kind: 'signup' }
  /** 테스트가 끝났다 — 주소마다 `gateFor` 를 다시 묻는다. 열린 것은 설정(철회 · 탈퇴 신청)뿐이다 */
  | { kind: 'closed'; account: GateAccount; notice: GateNotice | null | typeof NOTICE_UNREAD }
  | { kind: 'in'; email: string | null }
  | { kind: 'failed'; message: string };

/**
 * 답이 끝내 안 오면 이만큼 뒤에 닫는다 — 관문은 빈 화면에 머물지 않는다. 대화의 전송 시한(`SEND_DEADLINE_MS`)과 같은 값이다.
 * 서버가 답을 안 하면 끝없이 빈 화면이었고(가짜 서버로 35초까지 잼), 끊기면 GET 을 다시 묻느라 답이 늦다(39초 안).
 */
const GATE_DEADLINE_MS = 15_000;

type Settled = Exclude<Gate, { kind: 'checking' }>;

const closedGate = (): Settled => ({ kind: 'failed', message: UNREACHABLE });

/**
 * 세션과 가입을 본다 — 판정은 웹의 관문과 같은 `gateFor` 다. 계정을 못 읽으면 지나가지 않는다.
 * **던지지 않고, 답이 없어도 닫힌 쪽으로 끝난다** — 입구 · 소개 · 로그인 · 껍데기가 이 답 하나로 갈린다.
 */
export function readGate(): Promise<Settled> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<Settled>((resolve) => {
    timer = setTimeout(() => resolve(closedGate()), GATE_DEADLINE_MS);
  });
  return settled(Promise.race([askGate(), deadline]), 'readGate', closedGate).finally(() => clearTimeout(timer));
}

async function askGate(): Promise<Settled> {
  if (supabase === null) return { kind: 'out' };
  const { data } = await supabase.auth.getSession();
  if (data.session === null) return { kind: 'out' };

  const [found, schedule] = await Promise.all([
    supabase.from('app_user').select('signed_up_at, notice_version, notice_schedule_id').maybeSingle(),
    readSchedule(),
  ]);
  if (found.error !== null) console.error('account', found.error.code);
  if (found.error !== null || found.data === null) return closedGate();

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
