/**
 * 프로필의 모양 — **폼과 서버 액션과 DB 가 같은 수를 본다.**
 *
 * 버튼을 잠그는 쪽과 저장을 거절하는 쪽에 조건을 따로 적으면, 두 곳이 어긋나는 순간
 * 눌리는데 거절하거나 잠겼는데 저장은 되는 상태가 만들어진다. DB 검사식이 결국 막지만
 * 그때 나오는 말은 제약 위반 문장이다.
 *
 * 여기 있는 수는 `20260909120000_the_name_is_made_at_signup.sql` 의 것과 같아야 한다.
 * 한 자리에 모아 둔 것은 **갈리는 것을 막으려는 것이 아니라 갈렸을 때 보이게** 하려는
 * 것이다 — 두 언어에 각각 적어야 하는 자리라 없앨 수는 없다.
 */

/** 닉네임 길이 — DB 검사식과 같은 수(§5.1) */
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 8;

/** 소개 길이 상한 — DB 검사식과 같은 수 */
export const INTRO_MAX = 300;

/** 사진 상한 — `profile_photo.bytes` 의 검사식과 같은 수 */
export const PHOTO_MAX_BYTES = 512 * 1024;

/** 받아 주는 형식 — DB 검사식과 같은 목록 */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** 올린 사진을 이 변으로 줄여서 보낸다 — 카드와 프로필에 서는 크기 */
export const PHOTO_MAX_EDGE = 512;

/** 한 사람의 사진 장 수 — `profile_photo.position` 의 검사식(1..6)과 같은 수(G-60). 편집 칸도 여섯이다 */
export const PHOTO_MAX_COUNT = 6;

/**
 * 끌어다 놓은 뒤의 순서 — **사이의 장이 한 칸씩 밀린다.** 맞바꾸지 않는다(DB 의 `move_my_photo` 와 같은 뜻).
 *
 * `from` · `to` 는 1부터 세는 자리다. 자리 밖이면 그대로 돌려준다. 화면이 서버 답을 기다리지 않고
 * 먼저 옮겨 그리는 데 쓴다 — 두 셈이 어긋나면 새로 그릴 때 서버의 순서로 돌아간다.
 */
export function movedPhotos<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 1 || from > next.length || to < 1 || to > next.length || from === to) return next;
  const [lifted] = next.splice(from - 1, 1);
  next.splice(to - 1, 0, lifted);
  return next;
}

export type ProfileInput = {
  /** 앱 안의 모든 자리에서 부르는 이름(§5.2). 부를 이름(`local_label`)과 다른 값이다 */
  nickname: string;
  /** 사주와 무관한 소개. 비우면 카드에 그 줄이 서지 않는다 */
  intro: string;
};

/**
 * 이름 하나만 본다 — 없으면 `null`.
 *
 * **가입 폼에는 소개 칸이 없다**(ADR 0042). 그 자리에서 `missingInProfile` 을 부르면
 * 빈 소개를 함께 재게 되고, 재는 것과 화면에 선 것이 갈린다.
 */
export function missingNickname(nickname: string): string | null {
  const name = nickname.trim();
  if (name.length < NICKNAME_MIN || name.length > NICKNAME_MAX) {
    return `닉네임은 ${NICKNAME_MIN}자에서 ${NICKNAME_MAX}자까지입니다.`;
  }
  return null;
}

/** 아직 못 채운 칸 — 없으면 `null` */
export function missingInProfile(profile: ProfileInput): string | null {
  const missing = missingNickname(profile.nickname);
  if (missing !== null) return missing;
  if (profile.intro.trim().length > INTRO_MAX) return `소개는 ${INTRO_MAX}자까지입니다.`;
  return null;
}

/**
 * 두 이름이 같은가 — **DB 의 `nickname_key` 와 같은 규칙.**
 *
 * 화면이 이 값으로 하는 일은 하나다: 방금 확인한 이름과 지금 칸에 있는 이름이 같은지
 * 봐서, 다르면 확인 결과를 지운다. **판정은 여기서 하지 않는다** — 쓸 수 있는지는
 * DB 만 안다.
 */
export function nicknameKey(nickname: string): string {
  return nickname.trim().toLowerCase();
}

/**
 * 사진에 관해 사용자에게 하는 말 — **화면이 문장을 짓지 않는다.**
 *
 * 얼굴은 출생 원문과 다른 종류의 자료다. 낯선 사람의 카드에 서므로, 올리는 자리에서
 * 그 사실을 먼저 말한다.
 */
export const PHOTO_NOTE =
  '프로필 사진은 인연 찾기와 요청 화면에서 다른 사람에게 공개됩니다.';

/** 사진 없이 서는 자리 — 이름의 첫 글자 하나 */
export function initialOf(nickname: string): string {
  return [...nickname.trim()][0] ?? '';
}
