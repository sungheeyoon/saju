import { MatchScreen } from '../screen';

/** 모델 240초 뒤 실패를 적을 60초를 남기되 DB 의 10분 만료보다 짧게 둔다. */
export const maxDuration = 300;

export const metadata = {
  title: '인연 궁합',
  description: '서로 동의한 두 사람의 궁합과 그 위에 선 사주풀이를 봅니다.',
};

/**
 * 인연 궁합 — **제 주소의 한 화면.** 인연 탭 · 인연 기록 · 채팅 · 소식이 여는 자리다. 보관함에서 연 인연 궁합은 같은
 * 부품이 보관함 틀 안(`/me/readings/match/[id]`)에 선다(ADR 0134). 무엇을 읽고 그리는지는 `../screen.tsx` 한 벌이다.
 */
export default async function MatchResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ from?: string | string[]; kind?: string | string[] }>;
}) {
  const [{ matchId }, query] = await Promise.all([params, searchParams]);
  return <MatchScreen matchId={matchId} query={query} frame="page" />;
}
