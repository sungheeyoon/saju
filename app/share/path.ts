/**
 * 공유본이 사는 주소 — **갈래마다 하나씩, 그리고 한 자리에서만 짓는다.**
 *
 * ## 왜 주소가 셋인가
 *
 * 링크 미리보기의 그림은 받은 사람이 **열기 전에 보는 유일한 것**이라 무엇이 열릴지를
 * 그림이 말해 줘야 하고, 그 그림은 첫 HTML 에 **상수로** 실려야 한다(ADR 0063 —
 * 동적으로 계산한 메타데이터는 수집기가 놓친다). 한 주소가 세 갈래를 다 맡으면 그림이
 * 토큰에 따라 달라져야 하고, 그러면 상수일 수가 없다.
 *
 * 그래서 갈래가 주소를 가른다. 토큰은 여전히 아무것도 안 말한다 — 주소가 말하는 것은
 * 「사주풀이인가 궁합인가」까지이고, 그건 열면 어차피 보이는 사실이다.
 */
export const SHARE_ROOTS = {
  /** 내 사주풀이 — **이 주소는 안 바꾼다.** 이미 뿌려진 링크가 여기 있다 */
  self: '/share/readings',
  /** 저장한 사람의 사주풀이 */
  person: '/share/people',
  /** 내가 고른 두 사람의 궁합 */
  private: '/share/compat',
} as const;

export type ShareKind = keyof typeof SHARE_ROOTS;

export function sharePath(kind: ShareKind, token: string): string {
  return `${SHARE_ROOTS[kind]}/${token}`;
}

/** 지금 보고 있는 화면이 공유본인가 — 헤더가 묻는다 */
export function isSharePath(pathname: string): boolean {
  return Object.values(SHARE_ROOTS).some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}
