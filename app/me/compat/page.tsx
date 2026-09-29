import { CompatScreen, type CompatQuery } from './screen';

/**
 * 모델 240초 상한이 먼저 끝나 실패를 기록하고, DB 600초 만료보다는 먼저 닫는다.
 *
 * **결과 칸이 서는 화면은 다 이 값을 든다.** 생성은 응답 뒤에 도는데(`after`), 그
 * 콜백이 사는 시간은 그것을 부른 라우트의 상한이다. 여기 없으면 플랫폼 기본값에서
 * 잘리고, 그러면 시도가 열린 채 남아 이 대상이 10분간 잠긴다.
 */
export const maxDuration = 300;

export const metadata = {
  title: '궁합',
  description: '저장해 둔 두 사람을 골라 사이에 성립하는 관계를 봅니다.',
};

/**
 * 두 사람의 궁합 — **제 주소의 한 화면.** 궁합 탭 · 채팅 · 소식이 여는 자리다. 보관함에서 연 궁합은 같은 부품이
 * 보관함 틀 안(`/me/readings/compat`)에 선다(ADR 0134). 무엇을 읽고 그리는지는 `screen.tsx` 한 벌이다.
 */
export default async function ManagedCompatPage({ searchParams }: { searchParams: Promise<CompatQuery> }) {
  return <CompatScreen params={await searchParams} frame="page" />;
}
