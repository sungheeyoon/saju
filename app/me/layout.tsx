import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../auth/server-client';
import { NOTICE_VERSION, scheduleFrom } from '@/src/lib/consent';

/**
 * `/me` 아래 전체의 관문 — **안내를 안 봤으면 여기서 돌려보낸다.**
 *
 * 화면마다 적지 않는다. 지금 여덟 화면이고 다음에 하나가 더 생기면 그 하나는 안
 * 고쳐진다 — **자리가 넷이면 하나는 안 고쳐진다.** 레이아웃 하나가 그 전부를 덮는다.
 *
 * ## 그래도 DB 에도 관문이 있다
 *
 * 화면만 막으면 주소나 RPC 로 지나간다. 이 저장소가 방금 그 자리를 하나 고쳤고
 * (대문자 UUID), 같은 실수를 여기서 되풀이하지 않는다. 되돌릴 수 없는 첫 쓰기인
 * `create_self_person` 이 안내 확인을 스스로 묻는다.
 *
 * 여기서 하는 일은 **길을 가리키는 것**이고, 막는 일은 DB 가 한다.
 *
 * ## 판본이 바뀌면 다시 보여 준다
 *
 * 「확인한 적 있다」가 아니라 **「이 판본을 확인했다」**를 본다. 문구가 바뀌면 이전
 * 확인은 지금 문구에 대한 것이 아니다.
 *
 * ## 로그인하지 않은 사람은 여기서 안 돌려보낸다
 *
 * 그 판정은 화면마다 이미 하고 있고(`redirect('/auth')`), 여기서 또 하면 판정하는
 * 자리가 둘이 된다. 이 레이아웃이 답하는 질문은 하나다 — **안내를 봤는가.**
 */
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user !== null) {
    const [{ data: account }, dates] = await Promise.all([
      supabase.from('app_user').select('notice_version, notice_ends_on').maybeSingle(),
      scheduleFrom((name) => supabase.rpc(name)),
    ]);

    /*
      계정을 못 읽은 것은 안내를 안 본 것과 다르다. 못 읽었을 때 돌려보내면 안내 화면이
      또 못 읽고 되돌이가 된다 — 그 자리는 각 화면이 「계정을 읽지 못했습니다」로 말한다.
    */
    /*
      **판본과 날짜 둘 다 본다.** 문구가 그대로여도 기간이 바뀌면 그 사람이 확인한 것은
      지금 약속이 아니다 — 11월에 지운다는 안내를 보고 확인했는데 이듬해까지 들고 있는
      일이 그렇게 생긴다.

      일정이 아직 없으면(`dates === null`) 그때도 보낸다. 그 화면이 「아직 시작할 수
      없습니다」를 말할 자리다.
    */
    const stale =
      account !== null &&
      (account.notice_version !== NOTICE_VERSION ||
        dates === null ||
        account.notice_ends_on !== dates.endsOn);

    if (stale) redirect('/welcome');
  }

  return children;
}
