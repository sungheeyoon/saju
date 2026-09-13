/**
 * 공유본이 사는 주소 — **한 자리에서만 짓는다.**
 *
 * 이 문자열을 아는 자리가 넷이다: 주소를 내주는 서버 액션, 링크를 만드는 버튼,
 * 화면 자신, 그리고 헤더(공유 화면에서는 회원 메뉴를 안 세운다). 손으로 네 번 적으면
 * 옮기는 날 하나가 남는다.
 */
export const SHARE_ROOT = '/share/readings';

export function sharePath(token: string): string {
  return `${SHARE_ROOT}/${token}`;
}

/** 지금 보고 있는 화면이 공유본인가 — 헤더가 묻는다 */
export function isSharePath(pathname: string): boolean {
  return pathname === SHARE_ROOT || pathname.startsWith(`${SHARE_ROOT}/`);
}
