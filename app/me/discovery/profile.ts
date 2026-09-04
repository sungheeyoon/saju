/**
 * 인연에 내놓는 조건 — **이름과 소개는 여기 없다.**
 *
 * 그 둘은 계정의 것이고 프로필 화면이 든다(§5.1·§5.2). 여기 남는 것은 참여를 끄면 함께
 * 뜻을 잃는 값, 즉 **누구를 보고 싶은가**뿐이다.
 */

export const PREFER_GENDERS = ['any', 'female', 'male'] as const;
export type PreferGender = (typeof PREFER_GENDERS)[number];

export const PREFER_GENDER_KO: Record<PreferGender, string> = {
  any: '가리지 않음',
  female: '여성만',
  male: '남성만',
};

/** 모르는 값은 가장 넓은 쪽으로 읽는다 — 좁은 쪽으로 눕히면 조용히 사람이 빠진다 */
export function preferGenderOf(value: string | null | undefined): PreferGender {
  return (PREFER_GENDERS as readonly string[]).includes(value ?? '')
    ? (value as PreferGender)
    : 'any';
}
