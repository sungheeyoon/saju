'use client';

import { useState } from 'react';

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
  const [asked, setAsked] = useState(false);

  return (
    <MatchIndexCard preview={preview} names={names}>
      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">상세 궁합 리포트</p>
          <p className="mt-1 text-xs text-muted">
            대화 방식 · 생활 리듬 · 마찰 지점 · 서로를 보완하는 방법
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAsked(true)}
          className="h-10 shrink-0 rounded-md bg-accent-strong px-5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          관심 있어요
        </button>
      </div>

      {/*
        아직 아무것도 받지 않기로 했으므로 화면도 그렇게 말한다. 신청을 받는 것처럼
        보이는 버튼이 실제로는 아무 데도 닿지 않는 상태를 만들지 않는다.
      */}
      {asked && (
        <p role="status" className="mt-3 rounded-lg bg-accent-wash px-4 py-3 text-sm text-accent">
          아직 만들고 있습니다. 지금은 신청을 받지 않고, 누른 것도 남기지 않습니다.
        </p>
      )}
    </MatchIndexCard>
  );
}
