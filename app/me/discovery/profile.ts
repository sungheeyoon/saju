/**
 * 인연에 내놓는 조건 — **이름과 소개는 여기 없다.**
 *
 * 그 둘은 계정의 것이고 프로필 화면이 든다(§5.1·§5.2). 여기 남는 것은 참여를 끄면 함께
 * 뜻을 잃는 값, 즉 **누구를 보고 싶은가**뿐이다.
 */

export const PREFER_GENDERS = ['any', 'female', 'male'] as const;
export type PreferGender = (typeof PREFER_GENDERS)[number];

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

/** 모르는 값은 가장 넓은 쪽으로 읽는다 — 좁은 쪽으로 눕히면 조용히 사람이 빠진다 */
export function preferGenderOf(value: string | null | undefined): PreferGender {
  return (PREFER_GENDERS as readonly string[]).includes(value ?? '')
    ? (value as PreferGender)
    : 'any';
}
