import { signupDone } from '@consent/gate';
import { scheduleOf } from '@consent/schedule';

import { supabase } from './client';

export type SignInAnswer =
  | { kind: 'signed-in' }
  | { kind: 'needs-signup' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

const NOT_READY = '이 빌드에서는 로그인할 수 없어요.';
/** 네이티브 모듈 · 설정이 없는 개발 환경(Expo Go)에서는 로그인을 건너뛴다 — 출시 빌드에는 `__DEV__` 가 없다 */
const notReady = (): SignInAnswer => (__DEV__ ? { kind: 'signed-in' } : { kind: 'failed', message: NOT_READY });
const FAILED = '로그인을 끝내지 못했어요. 잠시 뒤 다시 시도해 주세요.';

/**
 * 구글로 로그인하고 가입을 마쳤는지 본다. 세션이 이미 있으면 구글을 다시 안 부른다.
 *
 * 패키지를 여기서 불러들인다 — 맨 위에서 부르면 네이티브 모듈이 없는 Expo Go 에서 화면 전체가 죽는다.
 */
export async function signInWithGoogle(): Promise<SignInAnswer> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (supabase === null || !webClientId) return notReady();

  const { data: current } = await supabase.auth.getSession();
  if (current.session === null) {
    let google: typeof import('@react-native-google-signin/google-signin');
    try {
      google = require('@react-native-google-signin/google-signin');
    } catch {
      return notReady();
    }

    try {
      google.GoogleSignin.configure({ webClientId });
      await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await google.GoogleSignin.signIn();
      if (!google.isSuccessResponse(response)) return { kind: 'cancelled' };
      const token = response.data.idToken;
      if (token === null) return { kind: 'failed', message: FAILED };

      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
      if (error !== null) {
        console.error('signInWithIdToken', error.code, error.message);
        return { kind: 'failed', message: FAILED };
      }
    } catch (thrown) {
      console.error('google sign-in', thrown);
      return { kind: 'failed', message: FAILED };
    }
  }

  return accountAnswer();
}

/** 웹의 관문과 같은 판정이다(`signupDone`) — 못 읽으면 가입한 것으로 치지 않는다 */
async function accountAnswer(): Promise<SignInAnswer> {
  if (supabase === null) return { kind: 'failed', message: NOT_READY };

  const [account, schedule] = await Promise.all([
    supabase.from('app_user').select('signed_up_at, notice_version, notice_schedule_id').maybeSingle(),
    supabase.rpc('current_beta_schedule'),
  ]);
  if (account.error !== null || schedule.error !== null) {
    console.error('account', account.error?.code, schedule.error?.code);
    return { kind: 'failed', message: FAILED };
  }

  const row = (schedule.data ?? [])[0];
  const done =
    account.data !== null &&
    signupDone(
      {
        signedUp: account.data.signed_up_at !== null,
        noticeVersion: account.data.notice_version,
        noticeScheduleId: account.data.notice_schedule_id,
      },
      row === undefined
        ? null
        : scheduleOf({
            scheduleId: row.schedule_id,
            endsOn: row.ends_on,
            purgeBy: row.purge_by,
            purgeWithinDays: row.purge_within_days,
            operatorName: row.operator_name,
            operatorOfficer: row.operator_officer,
            operatorContact: row.operator_contact,
          }),
    );
  return done ? { kind: 'signed-in' } : { kind: 'needs-signup' };
}
