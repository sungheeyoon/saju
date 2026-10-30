import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { supabase } from '@/auth/client';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

/**
 * **사진 한 장** — 앱의 사진 문(`/api/mobile/photo/{id}`, ADR 0211)을 그 사람의 토큰으로 연다. 볼 수 있는가는 서버의 `photo_at` 이 답한다.
 *
 * **기기에 담아 두지 않는다**(`cachePolicy="none"`). 주소로 담으면 차단 · 계정 바꿈 뒤에도 그 얼굴이 남는다 — 웹처럼 쓸 때마다 묻는다.
 * 토큰은 지금 세션에서 읽고, 세션이 바뀌면 따라간다. 답이 거절이면 한 번 새로 읽어 토큰이 바뀌었을 때만 다시 묻는다.
 *
 * 못 받으면(없는 장 · 볼 수 없는 사람 · 망 · 세션 없음) `fallback` 이 선다 — 색과 첫 글자처럼 부르는 쪽이 이미 그리는 얼굴이다.
 * 웹의 `Avatar` 처럼 `hasPhoto` 가 거짓이면 왕복을 안 쓴다.
 */
export function Photo({
  userId,
  size,
  fallback,
  hasPhoto = true,
  position = 1,
  variant = 'card',
}: {
  userId: string;
  size: number;
  fallback: ReactNode;
  hasPhoto?: boolean;
  position?: number;
  /** 작은 자리(아바타)는 `card`, 크게 보는 자리는 `large` */
  variant?: 'card' | 'large';
}) {
  const [token, setToken] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const uri = `${SITE_URL}/api/mobile/photo/${userId}?n=${position}${variant === 'card' ? '&s=card' : ''}`;
  const tokenNow = useRef<string | null>(null);

  const readToken = useCallback(async (): Promise<string | null> => {
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    return data.session?.access_token ?? null;
  }, []);

  const hold = useCallback((next: string | null) => {
    tokenNow.current = next;
    setToken(next);
  }, []);

  useEffect(() => {
    let live = true;
    void readToken().then((next) => {
      if (live) hold(next);
    });
    const listening = supabase?.auth.onAuthStateChange((_event, session) => {
      setFailedFor(null);
      hold(session?.access_token ?? null);
    });
    return () => {
      live = false;
      listening?.data.subscription.unsubscribe();
    };
  }, [uri, readToken, hold]);

  const failed = async () => {
    const next = await readToken();
    if (next !== null && next !== tokenNow.current) hold(next);
    else setFailedFor(uri);
  };

  if (!hasPhoto || !SITE_URL || token === null || failedFor === uri) return <>{fallback}</>;

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <Image
        source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
        cachePolicy="none"
        contentFit="cover"
        style={{ width: size, height: size }}
        onError={() => void failed()}
      />
    </View>
  );
}
