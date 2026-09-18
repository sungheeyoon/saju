import { MatchingExperience } from './matching-experience';

export const metadata = {
  title: '오늘의 인연 — 만세력',
  description: '내 귀인은 내가 찾는다. 예측 궁합 점수와 서로 보완하는 기운으로 나에게 맞는 인연을 발견하세요.',
  robots: { index: false, follow: false },
};

// UI preview only: profiles and reactions are local, with no matching API calls.
export default function MatchingPage() {
  return <MatchingExperience />;
}
