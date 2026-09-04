import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../auth/server-client';
import { CARD } from '../card';
import { NOTICE_VERSION, betaOverNote, scheduleFrom } from '@/src/lib/consent';

/**
 * `/me` 아래 전체의 관문 — **안내를 안 봤으면 돌려보내고, 끝났으면 끝났다고 말한다.**
 *
 * 화면마다 적지 않는다. 지금 여덟 화면이고 다음에 하나가 더 생기면 그 하나는 안
 * 고쳐진다 — **자리가 넷이면 하나는 안 고쳐진다.** 레이아웃 하나가 그 전부를 덮는다.
 *
 * ## 그래도 DB 에도 관문이 있다
 *
 * 화면만 막으면 주소나 RPC 로 지나간다. 여기서 하는 일은 **길을 가리키는 것**이고,
 * 막는 일은 DB 가 한다 — 되돌릴 수 없는 첫 쓰기(`create_self_person`)와 돈이 나가는
 * 문(`start_reading_run`)과 새 자료를 받는 문(`leave_reading_feedback`)이 각자 묻는다.
 *
 * ## 로그인하지 않은 사람은 여기서 안 돌려보낸다
 *
 * 그 판정은 화면마다 이미 하고 있고(`redirect('/auth')`), 여기서 또 하면 판정하는
 * 자리가 둘이 된다.
 */
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) return children;

  const [{ data: account }, notice] = await Promise.all([
    supabase.from('app_user').select('nickname, notice_version, notice_schedule_id').maybeSingle(),
    scheduleFrom((name) => supabase.rpc(name)),
  ]);

  /*
    계정을 못 읽은 것은 안내를 안 본 것과 다르다. 못 읽었을 때 돌려보내면 안내 화면이
    또 못 읽고 되돌이가 된다 — 그 자리는 각 화면이 「계정을 읽지 못했습니다」로 말한다.
  */
  if (account === null) return children;

  /**
   * **끝나도 계정 관리는 연다.**
   *
   * 처음에는 `/me` 아래 전체를 종료 화면으로 덮었다. 그러면 종료일과 파기 사이에
   * 사용자가 **선택 동의를 철회하거나 삭제를 요청할 길이 사라진다** — 그 기간은 자료가
   * 아직 남아 있는 기간이고, 그때야말로 그 둘이 필요하다. 「끝났다」가 「이제 아무것도
   * 못 한다」가 되면 안 된다.
   *
   * 경로는 `proxy.ts` 가 실어 준다. 레이아웃은 자기 아래 어느 화면이 열렸는지 모른다.
   * 못 읽으면 **닫는 쪽으로** 기운다 — 열어 두는 쪽으로 기울면 헤더 하나가 사라지는 날
   * 종료가 통째로 풀린다.
   */
  const here = (await headers()).get('x-pathname') ?? '';
  const managing = here.startsWith('/me/settings');

  /**
   * **끝났으면 여기서 끝난다.**
   *
   * 막는 것은 DB 다 — `is_active_account()` 가 종료일을 보므로 discovery·요청·수락이
   * 이미 닫혀 있다. 화면이 하는 일은 **왜 닫혔는지 말하는 것**이다. 안 말하면 사용자는
   * 빈 목록과 안 도는 버튼만 보고 고장으로 읽는다.
   *
   * 중지된 계정과 다른 말을 쓴다. 「중지되었습니다」는 그 사람에 대한 판단이고 이것은
   * 서비스가 끝난 것이다.
   */
  const over =
    notice !== null && new Date(`${notice.dates.endsOn}T23:59:59+09:00`) < new Date();

  if (over && !managing) {
    return (
      <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
        <section className={`${CARD} flex flex-col gap-3`}>
          <h1 className="text-xl font-bold">비공개 테스트가 끝났습니다</h1>
          <p className="text-sm leading-6 text-secondary">{betaOverNote(notice!.dates)}</p>
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

  /**
   * **판본과 그 줄을 둘 다 본다.**
   *
   * 날짜만 견주던 때가 있었다. 그러면 같은 날짜로 **운영자 정보만** 바꿔도 안 잡힌다 —
   * 안내의 내용은 표의 한 줄이 들고, 어느 칸이 바뀌든 새 줄이 되므로 줄을 견준다.
   *
   * 일정이 아직 없으면(`notice === null`) 그때도 보낸다. 그 화면이 「아직 시작할 수
   * 없습니다」를 말할 자리다.
   *
   * **끝난 뒤에는 다시 안 묻는다.** 끝난 서비스의 안내를 새로 확인받을 이유가 없고,
   * DB 도 그 확인을 거절한다.
   */
  const stale =
    !over &&
    (account.notice_version !== NOTICE_VERSION ||
      notice === null ||
      account.notice_schedule_id !== notice.scheduleId);

  if (stale) redirect('/welcome');

  /**
   * **안내 다음이 이름이다**(PRD §5.1).
   *
   * 이름은 앱 안의 모든 자리에서 사람을 부르는 말이라, 없는 채로 지나가면 소식과 요청
   * 목록이 이름 자리에 빈 칸을 세운다. 그래서 첫 입력보다 앞에 선다.
   *
   * 예외는 둘이다. 이름을 짓는 화면 자신과, 계정 관리 — 뒤엣것은 베타가 끝난 뒤에도
   * 열어 두는 자리와 같은 까닭이다. 이름을 안 지었다는 이유로 **로그아웃과 삭제 요청까지
   * 막으면** 들어오지도 나가지도 못한다.
   *
   * 여기서 하는 일은 길을 가리키는 것이고, 막는 일은 DB 가 한다 —
   * `create_self_person` 이 이름을 묻고, `the_name_comes_before_the_chart` 가 그 뒤를
   * 받는다.
   */
  const naming = here.startsWith('/me/profile');

  if (account.nickname === null && !naming && !managing) redirect('/me/profile');

  return children;
}
