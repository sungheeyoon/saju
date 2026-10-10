'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

/** 끝난 일을 말하는 한 줄이 서 있는 동안 — 읽고 지나갈 만큼(설정 성별 칸이 먼저 쓰던 값, 대장 29) */
export const DONE_NOTE_SHOWN_MS = 2500;

/**
 * 끝난 일을 잠깐 말한다 — 「저장했어요」 · 「사진을 올렸어요」(대장 01 「완료 안내」, 2026-10-11).
 *
 * **토스트를 띄우지 않는다.** 말은 누른 단추 · 칸 곁의 한 줄(`DoneNote`)에 서고 `DONE_NOTE_SHOWN_MS` 뒤에 걷힌다. 같은 말을
 * 다시 해도(두 장째를 올렸다) 시계가 처음부터 다시 간다. `clear` 는 다음 누름이 시작될 때 부른다 — 끝난 말이 새 일 곁에
 * 남지 않게.
 */
export function useDoneNote(): { note: string; say: (text: string) => void; clear: () => void } {
  const [said, setSaid] = useState<{ text: string; at: number } | null>(null);

  useEffect(() => {
    if (said === null) return;
    const fading = setTimeout(() => setSaid(null), DONE_NOTE_SHOWN_MS);
    return () => clearTimeout(fading);
  }, [said]);

  const say = useCallback((text: string) => setSaid({ text, at: Date.now() }), []);
  const clear = useCallback(() => setSaid(null), []);

  return { note: said?.text ?? '', say, clear };
}

/**
 * 상태 한 줄의 상자 — **상자는 늘 서 있고 글자만 바뀐다.**
 *
 * `{saved && <p role="status">}` 꼴은 상자와 글자가 함께 생긴다 — 화면 읽기(특히 iOS VoiceOver)는 새로 생긴 알림 자리를
 * 못 읽고 지나갈 수 있다(2026-10-11 화면 감사).
 * 자리가 먼저 있어야 바뀐 글자를 읽어 준다. 비었을 때도 한 줄 높이를 지켜 글자가 서고 걷힐 때 아래가 밀리지 않는다.
 * 진행 중(「저장하는 중…」)과 끝(`useDoneNote` 의 말)을 같은 상자가 든다 — 부르는 쪽이 지금 무엇을 말할지 고른다.
 */
export function DoneNote({
  children,
  className = 'text-[13px] leading-5 text-secondary',
}: {
  children: ReactNode;
  /** 글자 모양 — 상자의 한 줄 높이(`min-h-5`)는 늘 붙는다 */
  className?: string;
}) {
  return (
    <p role="status" className={`min-h-5 ${className}`}>
      {children}
    </p>
  );
}
