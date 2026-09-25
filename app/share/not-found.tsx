import Link from 'next/link';

import { SERVICE_NAME } from '@/src/lib/brand';

import { BUTTON_PRIMARY } from '../ui/buttons';
import { Logo } from '../ui/logo';
import { TYPE_TITLE } from '../ui/surfaces';

/**
 * 열리지 않는 공유 링크 — **세 주소(`readings` · `people` · `compat`)가 이 한 화면으로 온다.**
 *
 * 셋 다 같은 `SharedReadingView` 가 같은 조건(`sharedReadingOf` 가 `null`)에서
 * `notFound()` 를 던진다. 화면이 셋이면 문장만 맞춰 적는 셈이라 한 자리로 모았다.
 * 셋 다 **풀이**다 — 사람 공유도 「저장한 사람의 풀이」이고 궁합도 궁합풀이다.
 *
 * 이유를 넷으로 가르지 않는다 — 주소를 잘못 옮겨 적었든, 보낸 사람이 계정을
 * 지웠든, 애초에 없던 토큰이든 문은 0행으로 답한다. 그 이상을 말하려면 **없는
 * 토큰과 있는 토큰을 가르는 답**을 내줘야 하고, 그러면 주소를 찍어 보는 사람에게
 * 어느 것이 실재하는지 알려 주게 된다.
 *
 * 대신 **여기서 할 수 있는 일**을 남긴다. 링크를 받고 들어온 사람이니, 막다른 자리에
 * 세워 두지 않고 서비스로 가는 길을 준다.
 */
export default function SharedReadingNotFound() {
  return (
    <main className="app-shell flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center sm:py-24">
      <span className="grid size-16 place-items-center rounded-full bg-cream">
        <Logo className="size-10" />
      </span>
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className={TYPE_TITLE}>열 수 없는 링크입니다</h1>
        <p className="text-sm leading-6 text-secondary">
          주소가 잘못됐거나 더 이상 남아 있지 않은 풀이입니다. 보낸 분에게 링크를 다시
          받아 주세요.
        </p>
      </div>
      <Link
        href="/"
        className={BUTTON_PRIMARY}
      >
        {SERVICE_NAME} 둘러보기
      </Link>
    </main>
  );
}
