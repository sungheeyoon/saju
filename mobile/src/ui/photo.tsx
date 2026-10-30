import { useEffect, useState, type ReactNode } from 'react';
import { Image, View } from 'react-native';

import { supabase } from '@/auth/client';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

/**
 * **사진 한 장** — 앱의 사진 문(`/api/mobile/photo/{id}`, ADR 0211)을 그 사람의 토큰으로 연다. 볼 수 있는가는 서버의 `photo_at` 이 답한다.
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

  useEffect(() => {
    let live = true;
    void supabase?.auth.getSession().then(({ data }) => {
      if (live) setToken(data.session?.access_token ?? null);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!hasPhoto || !SITE_URL || token === null || failedFor === uri) return <>{fallback}</>;

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
        style={{ width: size, height: size }}
        resizeMode="cover"
        onError={() => setFailedFor(uri)}
      />
    </View>
  );
}
