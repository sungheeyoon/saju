import { toSearchParams, type Query } from '@/src/lib/input/query';

/**
 * 첫 화면 문단을 받으러 서버에 보내는 입력 — **이름을 뺀다**(ADR 0180).
 *
 * 서버는 이름을 안 쓴다(`sajuOfDraft` 는 명식만 짓는다). 그런데 주소 `#` 뒤 모양(`toSearchParams`)은 이름이 있으면 싣는다 —
 * 그대로 보내면 쓰지도 않는 이름이 서버를 지난다. 가입 왕복이 들고 가는 입력(`SignInCarrying`)과 화면의 카드는 이름을 그대로
 * 쓴다 — 빼는 것은 이 요청 하나다.
 */
export const tasteDraftOf = (query: Query): string => toSearchParams({ ...query, name: '' }).toString();
