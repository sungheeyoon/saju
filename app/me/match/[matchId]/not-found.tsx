import Link from 'next/link';

import { BUTTON_PRIMARY } from '../../../ui/buttons';
import { NoticeScreen } from '../../../ui/notice-screen';

/**
 * **없는 인연 궁합과 못 보는 인연 궁합이 도착하는 같은 자리** — `../screen.tsx` 의 `notFound()`(제 주소의 한 화면).
 *
 * 문(`matchResultForViewer`)은 둘 다 `null` 로 답하고, 화면도 어느 쪽인지 말하지 않는다 — 가르면 그 차이만으로 어떤
 * Match 가 실재하는지 알아낼 수 있다(ADR 0007). 돌아갈 길은 인연 궁합이 열리는 탭이다. 앞서는 뿌리의 일반 404 로 떨어져
 * 어디로 돌아갈지 말하지 않았다(2026-10-09 화면 점검 A3).
 */
export default function MatchNotFound() {
  return (
    <NoticeScreen
      title="찾을 수 없어요"
      description={
        <p>
          주소에 적힌 인연 궁합을 찾지 못했어요.
          <br />
          인연 탭에서 다시 열어 주세요.
        </p>
      }
      actions={
        <Link href="/me/matching" className={BUTTON_PRIMARY}>
          인연 탭으로
        </Link>
      }
    />
  );
}
