import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from '@db';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** 없으면 `null` — 설정 전에도 계산 화면은 선다. 로그인 자리가 까닭을 말한다 */
export const supabase =
  url && publishableKey
    ? createClient<Database>(url, publishableKey, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

/* 앱이 앞에 있을 때만 토큰을 갱신한다 — Supabase React Native 안내와 같다 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase?.auth.startAutoRefresh();
  else supabase?.auth.stopAutoRefresh();
});
