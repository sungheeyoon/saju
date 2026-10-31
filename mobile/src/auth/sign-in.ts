import { supabase } from './client';
import { FAILED, NOT_READY, readSignup } from './signup';

export type SignInAnswer =
  | { kind: 'signed-in' }
  | { kind: 'needs-signup' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

/** 네이티브 모듈 · 설정이 없는 개발 환경(Expo Go)에서는 로그인을 건너뛴다 — 출시 빌드에는 `__DEV__` 가 없다 */
const notReady = (): SignInAnswer => (__DEV__ ? { kind: 'signed-in' } : { kind: 'failed', message: NOT_READY });

/**
 * 구글로 로그인하고 가입을 마쳤는지 본다. 세션이 이미 있으면 구글을 다시 안 부른다.
 *
 * 패키지를 여기서 불러들인다 — 맨 위에서 부르면 네이티브 모듈이 없는 Expo Go 에서 화면 전체가 죽는다.
 */
export async function signInWithGoogle(): Promise<SignInAnswer> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (supabase === null || !webClientId) return notReady();

  /* 세션 저장소 · 가입 읽기가 던져도 답이다 — 부르는 화면들이 「이동하는 중」을 이 답을 받아 내린다 */
  try {
    const { data: current } = await supabase.auth.getSession();
    if (current.session === null) {
      let google: typeof import('@react-native-google-signin/google-signin');
      try {
        google = require('@react-native-google-signin/google-signin');
      } catch {
        return notReady();
      }

      /* iOS 는 이 값이 없으면 부를 때 던진다(`GoogleService-Info.plist` 를 안 쓴다). 안드로이드는 안 읽는다 */
      google.GoogleSignin.configure({ webClientId, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID });
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
    }

    return await accountAnswer();
  } catch (thrown) {
    console.error('google sign-in', thrown);
    return { kind: 'failed', message: FAILED };
  }
}

/** 가입 화면이 끝난 사람만 지나간다 — 일정이 없거나 테스트가 끝났을 때의 말도 가입 화면이 한다 */
async function accountAnswer(): Promise<SignInAnswer> {
  const signup = await readSignup();
  if (signup.kind === 'failed') return { kind: 'failed', message: signup.message };
  return signup.kind === 'done' ? { kind: 'signed-in' } : { kind: 'needs-signup' };
}

/** 다른 구글 계정으로 들어오는 길 — 구글 쪽도 끊어야 다음 로그인에서 계정을 고른다 */
export async function signOut(): Promise<boolean> {
  if (supabase === null) return true;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error !== null) {
    console.error('signOut', error.code, error.message);
    return false;
  }
  try {
    const google: typeof import('@react-native-google-signin/google-signin') = require('@react-native-google-signin/google-signin');
    await google.GoogleSignin.signOut();
  } catch (thrown) {
    /* 네이티브 모듈이 없는 Expo Go · 구글 쪽 실패 — 우리 세션은 이미 끊겼다 */
    console.error('google sign-out', thrown);
  }
  return true;
}
