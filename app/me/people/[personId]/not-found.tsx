import Link from 'next/link';

import { BUTTON_PRIMARY } from '../../../ui/buttons';
import { NoticeScreen } from '../../../ui/notice-screen';

/**
 * **없는 사람과 못 보는 사람이 도착하는 같은 자리** — 사람 상세(`./page.tsx`)의 `notFound()`.
 *
 * 문(`payloadForViewer`)은 둘 다 `null` 로 답하고, 화면도 둘 중 어느 쪽인지 말하지 않는다 — 가르면 그 차이만으로
 * 어떤 Person 이 실재하는지 알아낼 수 있다(ADR 0007). 궁합의 같은 자리(`../../compat/not-found.tsx`)와 같은 문장 ·
 * 같은 틀이고, 돌아갈 길만 이 화면이 온 목록이다. 앞서는 뿌리의 일반 404(「페이지를 찾을 수 없어요」 · 「홈으로」)로
 * 떨어져 어디로 돌아갈지 말하지 않았다(2026-10-09 화면 점검 A3).
 */
export default function PersonDetailNotFound() {
  return (
    <NoticeScreen
      title="찾을 수 없어요"
      description={
        <p>
          주소에 적힌 사람을 찾지 못했어요.
          <br />
          목록에서 다시 골라 주세요.
        </p>
      }
      actions={
        <Link href="/me/people" className={BUTTON_PRIMARY}>
          사람 목록으로
        </Link>
      }
    />
  );
}
