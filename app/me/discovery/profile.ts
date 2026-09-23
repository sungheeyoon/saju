/**
 * 인연에 내놓는 조건의 **화면 쪽** — 값의 목록과 뜻은 `src/lib/discovery` 의 `DiscoveryProfile` 이 든다.
 *
 * 이름과 소개는 여기 없다. 그 둘은 계정의 것이고 프로필 화면이 든다(§5.1·§5.2).
 */

import type { PreferGender } from '@/src/lib/discovery';

export const PREFER_GENDER_KO: Record<PreferGender, string> = {
  any: '상관없음',
  female: '여성',
  male: '남성',
};

/**
 * 화면에 서는 차례 — **넓은 쪽이 먼저다.**
 *
 * `PREFER_GENDERS` 는 저장되는 값의 목록이라 차례를 바꿀 수 없다(값의 순서로 읽는 자리가
 * 있다). 고르는 칸의 차례는 그것과 다른 물음이다: 기본값이 맨 앞에 서고, 좁히는 것이
 * 사용자가 여기서 하는 일이다.
 */
export const PREFER_GENDER_ORDER = ['any', 'male', 'female'] as const;
