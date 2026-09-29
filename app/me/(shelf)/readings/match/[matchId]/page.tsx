import { MatchScreen } from '../../../../match/screen';

/** 풀이 생성은 응답 뒤에서 돌 수 있다(`/me/match/[id]` 와 같은 까닭). */
export const maxDuration = 300;

export const metadata = {
  title: '인연 궁합',
  description: '서로 동의한 두 사람의 궁합과 그 위에 선 사주풀이를 봅니다.',
};

/**
 * **보관함에서 연 인연 궁합** — 사주풀이처럼 책장 옆 칸에 선다(ADR 0134, 2026-09-29 운영자). 결과는 `/me/match/[id]` 와
 * **같은 부품**이다(`MatchScreen`) — 동의로 열린 것만 보이는 문 · 방으로 가기 · 차단이 그대로다. 이 주소는 보관함 표지만 연다.
 */
export default async function ShelfMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ from?: string | string[]; kind?: string | string[] }>;
}) {
  const [{ matchId }, query] = await Promise.all([params, searchParams]);
  return <MatchScreen matchId={matchId} query={query} frame="shelf" />;
}
