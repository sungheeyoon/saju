export { SERVICE_FEATURES, SIGNED_OUT_EXIT, SIGNED_OUT_REACH } from '@/src/lib/brand/guide';

/**
 * 궁합으로 들어가는 단추 · 표지의 이름 — PRD §3.2 「다른 기능으로 진입」. 사람 목록 · 사람 상세 · 관계 지도의 사람 카드 ·
 * 궁합 결과의 ← · 없는 궁합 · 사주풀이 책장의 빈 표지 · 인연이 빈 날의 바로가기가 같이 쓴다. 표지 · 바로가기는 이 이름을
 * 속성 · 표로 넘기므로 문구 상수 파일(`src/lib/<영역>/copy.ts`, ADR 0159)이 아니라 여기 산다
 */
export const COMPAT_ENTRY_LABEL = '궁합 보러 가기';
