import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/auth/client';
import { readSignup } from '@/auth/signup';

export type Gate =
  | { kind: 'checking' }
  | { kind: 'out' }
  /** 가입이 안 끝났거나 테스트가 끝났다 — 무슨 말을 할지는 가입 화면이 안다 */
  | { kind: 'signup' }
  | { kind: 'in'; email: string | null }
  | { kind: 'failed'; message: string };

/** 세션과 가입을 본다 — 웹의 관문과 같은 판정(`readSignup`)이다. 못 읽으면 지나가지 않는다 */
export async function readGate(): Promise<Exclude<Gate, { kind: 'checking' }>> {
  if (supabase === null) return { kind: 'out' };
  const { data } = await supabase.auth.getSession();
  if (data.session === null) return { kind: 'out' };

  const signup = await readSignup();
  if (signup.kind === 'failed') return { kind: 'failed', message: signup.message };
  if (signup.kind !== 'done') return { kind: 'signup' };
  return { kind: 'in', email: data.session.user.email ?? null };
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
