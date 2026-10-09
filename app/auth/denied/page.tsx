import Link from 'next/link';

import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { NoticeScreen } from '../../ui/notice-screen';
import { SIGNED_OUT_EXIT, SIGNED_OUT_REACH } from '../../service-features';
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
    <NoticeScreen
      title="로그인하지 못했어요"
      description={
        <p>
          구글 로그인을 마치지 못했어요. 중간에 취소했거나 연결이 끊겼을 수 있어요. 아래
          「다시 로그인」을 눌러 주세요.
        </p>
      }
      actions={
        <>
          <Link href={again} className={BUTTON_PRIMARY}>
            다시 로그인
          </Link>
          <HomeLink className={BUTTON_SECONDARY}>{SIGNED_OUT_EXIT}</HomeLink>
        </>
      }
      /*
        로그인 없이 되는 것은 로그인 화면과 같은 한 줄이다 — 전에는 「궁합과 저장은 로그인한 뒤에」라고 적어, 첫 화면이
        로그인 없이 여는 궁합 첫 신호와 어긋났다(2026-10-09 화면 점검 A6)
      */
      note={<p>{SIGNED_OUT_REACH}</p>}
    />
  );
}
