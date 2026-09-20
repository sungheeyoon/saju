import { redirect } from 'next/navigation';

import { DISCOVERY_TEASER } from '@/src/lib/discovery';

import { supabaseOnServer } from '../../../auth/server-client';
import { EXAMPLE_CARDS } from '../examples';
import { MatchingExperience } from '../matching-experience';

export const metadata = {
  title: '오늘의 인연 (예시) — 만세력',
  description: '카드 디자인을 확인하는 예시 화면입니다.',
  robots: { index: false, follow: false },
};

/**
 * 카드 디자인을 확인하는 자리 — **같은 컴포넌트, 가짜 사람.**
 *
 * `/me/matching` 과 화면을 나눠 갖지 않는다. 디자인 확인용 화면이 따로 만들어지면
 * 그 화면만 예뻐지고 진짜 화면은 안 고쳐진다 — 같은 컴포넌트를 세워야 여기서 본 것이
 * 곧 사용자가 보는 것이다.
 *
 * **요청은 나가지 않는다**(`preview`). 얼굴이 가짜인 자리에서 진짜 요청이 나가면
 * 받을 사람이 없는 요청이 표에 남는다.
 */
export default async function MatchingPreviewPage() {
  /*
    **이 화면도 스스로 묻는다.** `/me` 아래의 규약이다 — 관문(`proxy.ts`)은 길만
    가리키고 로그인 판정은 하지 않는다. 안 물으면 주소를 아는 누구에게나 열린다.
  */
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  return (
    <MatchingExperience
      cards={EXAMPLE_CARDS}
      teaser={DISCOVERY_TEASER}
      notice={null}
      explorationNote={null}
      waitSeconds={0}
      preview
    />
  );
}
