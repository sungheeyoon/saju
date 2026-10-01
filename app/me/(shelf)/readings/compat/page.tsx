import { CompatScreen, type CompatQuery } from '../../../compat/screen';
// 임시 — CI 계획 증거용(#398), 곧 revert 한다

/** 풀이 생성은 응답 뒤에서 최대 240초 동안 돌 수 있다(`/me/compat` 과 같은 까닭). */
export const maxDuration = 300;

export const metadata = {
  title: '궁합',
  description: '저장해 둔 두 사람을 골라 사이에 성립하는 관계를 봅니다.',
};

/**
 * **보관함에서 연 궁합풀이** — 사주풀이처럼 책장 옆 칸에 선다(ADR 0134, 2026-09-29 운영자). 넓은 화면은 왼쪽 책장이
 * 그대로 서고 이 화면이 오른쪽 칸을 채운다. 폰은 이 화면만 서고 ← 가 들어온 칩의 보관함으로 돌아간다.
 *
 * 결과는 `/me/compat` 과 **같은 부품**이다(`CompatScreen`) — 관계 질문(ADR 0019) · 풀이권 확인 · 만드는 버튼이 그대로다.
 * 이 주소는 보관함 표지만 연다(`withCameFrom` 이 보관함의 궁합 링크를 여기로 옮긴다).
 */
export default async function ShelfCompatPage({ searchParams }: { searchParams: Promise<CompatQuery> }) {
  return <CompatScreen params={await searchParams} frame="shelf" />;
}
