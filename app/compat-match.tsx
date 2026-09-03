'use client';

import Link from 'next/link';

import { buildMatchPreview } from '@/src/lib/matching';
import type { Compatibility, Saju } from '@/src/lib/saju';

import { MatchIndexCard } from './match-index';

/**
 * 익명·저장 궁합 화면의 `match-v0` 칸.
 *
 * **셈은 여기서 부르고 그리기는 `MatchIndexCard` 가 한다.** 이 화면은 두 명식을
 * 브라우저가 들고 있어도 되는 자리라(사용자가 스스로 넣었거나 자기 사람들이다)
 * 지표도 브라우저에서 난다. Match 결과 화면은 그럴 수 없으므로 서버에서 같은
 * 함수를 부르고 결과만 넘긴다(ADR 0010) — **부르는 자리가 둘이어도 부르는 함수는
 * 하나**라, 두 화면의 숫자가 갈릴 자리가 없다.
 */
export function MatchResult({
  charts,
  compat,
  names,
}: {
  charts: Record<'a' | 'b', Saju>;
  compat: Compatibility;
  names: Record<'a' | 'b', string>;
}) {
  const preview = buildMatchPreview(charts, compat, names);

  return (
    <MatchIndexCard preview={preview} names={names}>
      {/*
        **닿는 곳이 있는 자리에만 버튼을 세운다.**

        여기 「관심 있어요」가 서 있었다. 누르면 「지금은 신청을 받지 않고, 누른 것도
        남기지 않습니다」로 답했다 — 받지 않는다는 말은 정직했지만, 정직한 막다른 길도
        막다른 길이다. 그 사이에 `/me/discovery` 가 실제로 요청을 받게 되었으므로,
        같은 자리를 그 흐름으로 잇는다.

        `/auth` 를 거치는 것은 **두 상태를 한 링크로 덮기 위해서**다. 로그인한 사람은
        곧장 되돌려 보내지고(`SignInPage` 가 `next` 로 redirect 한다), 안 한 사람은
        로그인하고 나서 같은 자리에 닿는다. 여기서 세션을 물어 링크를 갈라 두면
        익명 화면이 로그인 상태를 아는 화면이 된다.
      */}
      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">상세 궁합 리포트</p>
          <p className="mt-1 text-xs text-muted">
            대화 방식 · 생활 리듬 · 마찰 지점 · 서로를 보완하는 방법
          </p>
        </div>
        <Link
          href="/auth?next=/me/discovery"
          className="grid h-10 shrink-0 place-items-center rounded-md bg-accent-strong px-5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          인연 찾기에서 요청하기
        </Link>
      </div>

      <p className="mt-3 text-xs text-muted">
        상세 궁합은 두 분이 서로 동의해야 열립니다. 인연 찾기에서 요청을 보내고 상대가
        수락하면 같은 결과를 함께 보게 됩니다.
      </p>
    </MatchIndexCard>
  );
}
