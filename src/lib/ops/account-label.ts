import { NO_NICKNAME } from './report-labels';

/**
 * 운영자 화면이 가리키는 계정 — 「닉네임 · 계정 id 앞 8자」. 앞 8자가 닉네임이 같거나 비슷한 다른 사람과 가른다
 * (신고 처분 · 이용 정지 · 무상 지급의 확인창, 주문 줄과 환불 확인창이 함께 쓴다).
 *
 * 주문 문은 계정 id 를 통째로 내리지 않고 앞 8자(`owner_ref`)만 내린다 — 이미 자른 값을 받아도 같은 글자다.
 */
export const accountLabel = (nickname: string | null, id: string): string => `${nickname ?? NO_NICKNAME} · ${id.slice(0, 8)}`;
