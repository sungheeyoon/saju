import Link from 'next/link';

import { TAB_ACTION_SECONDARY } from './tab-hero';

/**
 * 사주 화면에서 궁합으로 가는 길 — **「로그인 필요」는 로그인 안 한 사람에게만 참이다.**
 *
 * 이 꼬리표는 붙박이 글자였다. 그래서 로그인한 사람이 남의 생년월일시를 한 번 계산해
 * 보려고 `/` 에 오면, 지금 그대로 눌리는 버튼이 자기에게 「로그인 필요」라고 말하고
 * 있었다 — 화면이 사용자의 세션이 풀렸다고 거짓말하는 셈이다. **늘 참이 아닌 문장은
 * 참인 사람에게만 세운다.**
 *
 * **세션은 스스로 안 읽는다.** 한동안 이 파일이 브라우저에서 직접 물었는데, 이제 같은
 * 화면의 얼굴이 그것으로 갈린다(`home-hero.tsx`). 두 자리가 따로 물으면 잠깐 서로 다른
 * 답을 들고, 그 틈에 **회원 전용 얼굴 위에 「로그인 필요」가 한 번 깜빡인다** — 이 파일이
 * 없애려던 바로 그 거짓말이 자리만 옮겨 다시 서는 것이다. 묻는 자리를 둘로 만들지 않는다.
 *
 * **모르는 동안에는 자리만 잡아 둔다**(`signedIn === null`). 먼저 세우면 로그인한 사람이
 * 한 번 깜빡이는 거짓말을 보고, 아예 안 세우면 로그인 안 한 사람 쪽이 같은 깜빡임을 본다.
 * 자리를 비워 두면 글자가 늦게 오는 것으로 끝난다.
 */
export function CompatEntry({ signedIn }: { signedIn: boolean | null }) {
  return (
    <Link
      href="/compat"
      className={TAB_ACTION_SECONDARY}
    >
      <span>궁합 보러 가기</span>
      {signedIn !== true && (
        <span className={`text-xs opacity-75${signedIn === null ? ' invisible' : ''}`}>로그인 필요</span>
      )}
    </Link>
  );
}
