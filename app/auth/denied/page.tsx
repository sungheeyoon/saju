import Link from 'next/link';

import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { Logo } from '../../ui/logo';
import { TYPE_TITLE } from '../../ui/surfaces';
import { withReturnPath } from '@/src/lib/consent';
import { HomeLink } from '../../home-link';

/**
 * 로그인이 끝나지 못한 자리.
 *
 * 초대 명단이 문을 지킬 때는 이 화면이 「초대된 주소가 아닙니다」였다. 명단을 걷고
 * 코드로 바꾸면서(ADR 0042) **여기서 막히는 일은 없어졌다** — 들어오는 문은 이제
 * `/signup` 이고, 그 문은 로그인한 다음에 선다.
 *
 * 그래도 화면을 남긴다. 구글 쪽에서 취소하거나 중간에 실패하면 여전히 이리로 오고,
 * 그때 흰 화면을 내놓을 수는 없다. **왜인지 모른다고 말하는 것**이 이 화면이 할 수
 * 있는 정직한 말의 전부다.
 */
export default async function DeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  /* 「다시 로그인」은 가려던 곳을 그대로 들고 간다(ADR 0128) — 밖으로 가는 값은 `withReturnPath` 가 버린다 */
  const { next } = await searchParams;
  const again = withReturnPath('/auth', Array.isArray(next) ? next[0] : next);

  return (
    <main className="app-shell grid flex-1 place-items-center py-12 sm:py-20">
      <section className="flex w-full max-w-lg flex-col gap-6 rounded-[2rem] bg-cream p-6 sm:p-10">
        <header className="flex flex-col gap-2">
          <span className="grid size-16 place-items-center rounded-full bg-surface shadow-card">
            <Logo className="size-10" />
          </span>
          <h1 className={`mt-3 ${TYPE_TITLE}`}>로그인하지 못했습니다</h1>
          <p className="text-[15px] leading-7 text-secondary">
            구글 로그인을 마치지 못했어요. 중간에 취소했거나 연결이 끊겼을 수 있어요. 아래
            「다시 로그인」을 눌러 주세요.
          </p>
        </header>

        <p className="text-sm leading-6 text-secondary">
          사주 계산은 로그인 없이 이용할 수 있어요. 궁합과 저장은 로그인한 뒤에 이용할 수 있어요.
        </p>

        <p className="flex flex-col gap-2 sm:flex-row">
          <Link href={again} className={BUTTON_PRIMARY}>
            다시 로그인
          </Link>
          <HomeLink className={BUTTON_SECONDARY}>
            사주 보러 가기
          </HomeLink>
        </p>
      </section>
    </main>
  );
}
