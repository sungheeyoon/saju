/**
 * 공개용 프로필의 모양 — 폼과 서버 액션이 **같은 답을 본다.**
 *
 * 버튼을 잠그는 쪽과 저장을 거절하는 쪽에 조건을 따로 적으면, 두 곳이 어긋나는 순간
 * 눌리는데 거절하거나 잠겼는데 저장은 되는 상태가 만들어진다(`missingAnswer` 와 같은
 * 규율). DB 검사식이 결국 막지만 그때 나오는 말은 제약 위반 문장이다.
 */

/** 별명 길이 상한 — DB 검사식과 같은 수 */
export const NICKNAME_MAX = 12;
/** 소개 길이 상한 — DB 검사식과 같은 수 */
export const INTRO_MAX = 300;

export const PREFER_GENDERS = ['any', 'female', 'male'] as const;
export type PreferGender = (typeof PREFER_GENDERS)[number];

export const PREFER_GENDER_KO: Record<PreferGender, string> = {
  any: '가리지 않음',
  female: '여성만',
  male: '남성만',
};

export type DiscoveryProfileInput = {
  /** 후보 카드에 서는 이름 — 부를 이름(`local_label`)과 다른 값이다 */
  nickname: string;
  intro: string;
  /** 사주와 무관한 명시적 조건. 나이는 여기 없다(ADR 0005) */
  preferGender: PreferGender;
};

/** 아직 답하지 않은 칸 — 없으면 `null` */
export function missingInProfile(profile: DiscoveryProfileInput): string | null {
  if (profile.nickname.trim() === '') return '공개용 별명을 입력해 주세요.';
  if (profile.nickname.trim().length > NICKNAME_MAX) {
    return `별명은 ${NICKNAME_MAX}자까지입니다.`;
  }
  if (profile.intro.trim().length > INTRO_MAX) return `소개는 ${INTRO_MAX}자까지입니다.`;
  if (!(PREFER_GENDERS as readonly string[]).includes(profile.preferGender)) {
    return '보고 싶은 상대를 다시 골라 주세요.';
  }
  return null;
}
