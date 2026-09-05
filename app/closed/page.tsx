import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../auth/server-client';
import { CARD } from '../card';
import { betaIsOver, betaOverNote, scheduleFrom } from '@/src/lib/consent';

export const metadata = {
  title: '비공개 테스트가 끝났습니다 — 만세력',
  description: '언제 끝났고 언제까지 파기하는지 알려 드립니다.',
};

/**
 * 끝났다고 말하는 자리 — **`/me` 밖에 선다.**
 *
 * `/signup` 이 밖에 선 것과 같은 까닭이다. 안에 두면 관문이 이 화면 자신도 막는다.
 * 그리고 관문이 `proxy.ts` 로 옮겨 가면서(레이아웃은 앱 안 이동에 안 돈다) **둘 다
 * 튕김이 됐다** — 하나만 「그리는 것」으로 남기면 그 하나는 앱 안에서 걸어 다니는
 * 사람에게 안 선다.
 *
 * ## 여기서도 한 번 묻는다
 *
 * 끝나지 않았는데 이 주소로 들어오면 돌려보낸다. 안 물으면 링크 하나로 「끝났습니다」를
 * 아무 때나 띄울 수 있고, 그것은 거짓말이다.
 *
 * 계정 관리로 가는 길을 낸다. 종료일과 파기 사이는 자료가 아직 남아 있는 기간이고,
 * 그때야말로 철회와 삭제 요청이 필요하다.
 */
export default async function ClosedPage() {
  const supabase = await supabaseOnServer();
  const notice = await scheduleFrom((name) => supabase.rpc(name));

  if (notice === null || !betaIsOver(notice.dates, new Date())) redirect('/me');

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
      <section className={`${CARD} flex flex-col gap-3`}>
        <h1 className="text-xl font-bold">비공개 테스트가 끝났습니다</h1>
        <p className="text-sm leading-6 text-secondary">{betaOverNote(notice.dates)}</p>
        <p className="text-sm leading-6 text-secondary">
          함께해 주셔서 고맙습니다. 남은 문의는{' '}
          <Link href="/privacy" className="font-semibold text-accent underline underline-offset-4">
            처리방침
          </Link>
          에 적힌 연락처로 알려 주세요.
        </p>
        {/* 파기 전까지는 자료가 아직 남아 있다. 그동안 철회와 삭제 요청이 닿아야 한다 */}
        <p className="text-sm leading-6 text-secondary">
          선택 동의 철회와 계정 삭제 요청은{' '}
          <Link
            href="/me/settings"
            className="font-semibold text-accent underline underline-offset-4"
          >
            계정 관리
          </Link>
          에서 계속하실 수 있습니다.
        </p>
      </section>
    </main>
  );
}
