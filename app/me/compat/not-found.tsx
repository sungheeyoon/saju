import Link from 'next/link';

import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { NoticeScreen } from '../../ui/notice-screen';

/**
 * **없는 사람과 못 보는 사람이 도착하는 같은 자리.**
 *
 * 「그런 사람이 없습니다」와 「볼 수 없습니다」를 가르면, 그 차이만으로 어떤 Person 이
 * 실재하는지 알아낼 수 있다. 그래서 두 경우가 이 한 화면으로 온다 — 화면이 둘인데
 * 문장만 맞춰 적는 것이 아니라, 애초에 **한 화면**이다(ADR 0007 「이행」).
 *
 * 문장도 둘 중 어느 쪽인지 말하지 않는다. 사용자가 할 수 있는 일만 적는다. 사람 상세
 * (`../people/[personId]/not-found.tsx`)와 인연 궁합(`../match/[matchId]/not-found.tsx`)도 같은 규율 · 같은 틀
 * (`app/ui/notice-screen.tsx`)이다.
 */
export default function PersonNotFound() {
  return (
    <NoticeScreen
      title="찾을 수 없어요"
      description={<p>주소에 적힌 사람을 찾지 못했어요. 목록에서 다시 골라 주세요.</p>}
      actions={
        <>
          <Link href="/compat" className={BUTTON_PRIMARY}>
            궁합 보러 가기
          </Link>
          <Link href="/me/people" className={BUTTON_SECONDARY}>
            저장한 사람
          </Link>
        </>
      }
    />
  );
}
