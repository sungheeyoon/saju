import type { ReactNode } from 'react';

/**
 * **탭을 누른 순간 서는 뼈대** — 홈(`/me`) · 오늘의 인연 · 책장 · 채팅의 `loading.tsx` 가 이 두 조각으로 짓는다(ADR 0116).
 *
 * 네 탭은 모두 로그인을 읽는 동적 화면이고 `loading.tsx` 가 없었다. Next 16 은 그런 화면을 미리 받지 않고, 누른 뒤
 * 서버 응답이 다 올 때까지 지금 화면에 머문다 — 2026-09-27 에 재어 보니 한 번 누를 때 서버가 DB 를 5~10 번 차례로
 * 불렀다(관문의 로그인 확인 · 계정 · 화면의 로그인 확인 · 계정 · 본문). 뼈대가 있으면 Next 가 그것까지 미리 받아 두고
 * 누르는 즉시 그 자리로 넘어간다.
 *
 * **글자가 없다.** 모양만 그 화면을 닮는다 — 글자를 세우면 곧 바뀔 말을 읽게 한다. 반짝임은 풀이를 기다리는 자리와 같은
 * `reading-skeleton` 이고, 줄인 움직임을 고른 사람에게는 `globals.css` 가 멈춰 세운다.
 */
export function SkeletonMain({ name, className, children }: { name: string; className: string; children: ReactNode }) {
  return (
    <>
      <noscript>
        <style>{WITHOUT_SCRIPT}</style>
      </noscript>
      <main aria-busy="true" data-skeleton={name} className={className}>
        {children}
      </main>
    </>
  );
}

/**
 * **자바스크립트가 없어도 화면이 선다.** 뼈대가 있으면 서버는 뼈대를 먼저 보내고 본문을 문서 끝에 숨겨 흘린 뒤, 인라인
 * 스크립트로 둘을 바꿔 끼운다(`<div hidden id="S:0">` — React 의 스트리밍 표식). 스크립트가 없으면 그 바꿔 끼우기가 안 돌아
 * 뼈대만 남았다 — 홈의 「자바스크립트 없이 여는 홈」 e2e 가 붉어져 찾았다(2026-09-27). 그 경우에만 뼈대를 걷고 숨은 본문을
 * 제자리처럼 세운다. 숨김은 Tailwind 가 `@layer base` 에서 `!important` 로 걸어 두어, 이긴 쪽이 되려면 그보다 앞 층
 * (`theme`)의 `!important` 여야 한다. React 가 그 표식을 바꾸면 이 줄이 조용히 안 먹는다 — 그 e2e 가 든다.
 */
const WITHOUT_SCRIPT =
  '@layer theme { div[hidden][id^="S:"] { display: contents !important; } } main[data-skeleton] { display: none !important; }';

/** 글자 한 줄이나 그림 한 칸이 설 자리 — 모양은 부르는 쪽이 `className` 으로 준다 */
export function Bone({ className }: { className: string }) {
  return <span aria-hidden="true" className={`reading-skeleton block ${className}`} />;
}
