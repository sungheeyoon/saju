import type { Element } from '@/src/lib/saju';

/*
  **궤도 지도 둘의 같은 문법** — 매칭 「내 궤도로 다가오는 인연」(`app/me/matching/orbit-map.tsx`)과 홈의 관계 지도
  (`app/me/home/map/`)는 한 그림의 형제다. 오행의 방향 · 글자 받침 · 그림자 · 가운데 빛 · 얼굴 테 · 범례의 선 그림을 두 파일이
  글자까지 같게 따로 적고 있었다(2026-09-26 에 잰 것 — 같은 것 열셋). 한쪽만 고치면 두 지도가 다른 말을 하게 된다.

  자리 계산(누가 어디에 앉는가)은 두 지도가 다르다 — 매칭은 채워 주는 기운 · 두 모양(`round` · `arc`)이고, 홈은 일간
  오행 · 한 궤도다. 그래서 계산은 각자 두고, 같은 것만 여기 모은다.
*/

/** 오행 다섯의 방향(도) — 정수리의 木 부터 시계 방향으로 72° 씩, 상생 차례(木 → 火 → 土 → 金 → 水) */
export const ELEMENT_ANGLE: Record<Element, number> = { 木: -90, 火: -18, 土: 54, 金: 126, 水: 198 };

/** 오행을 모르는 사람이 설 오행 사이의 빈 방향 — 앞에서부터 쓴다 */
export const SPARE_ANGLES: readonly number[] = [-54, 162, 90, 18];

/** 좌표는 소수 둘째 자리로 자른다 — 서버와 브라우저가 같은 글자를 써야 하이드레이션이 안 어긋난다 */
export const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * 글자 받침 — 지도의 글자(오행 자리 · 사람 이름) 밑에 지도 바탕색(`--cream`)을 한 겹 깐다. 선이 글자를 지나가도 받침 뒤로
 * 숨어 글자가 끊기지 않는다(지도 제작의 글자 후광과 같은 일, 2026-09-25). 지도는 어디서나 크림 판 위에 선다.
 */
export const ORBIT_LABEL_PAD = 'rounded-full bg-[color-mix(in_srgb,var(--cream)_90%,transparent)] px-1.5 leading-5';

/** 고른 사람의 이름표 — 흰 알약. 위 · 아래 어느 쪽에 달지는 지도가 정한다 */
export const ORBIT_NAME_TAG =
  'absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--surface)] px-3 leading-7 text-foreground ring-1 ring-[var(--border)]';

/** 그림자 — 새 색을 짓지 않고 글자색을 옅게 쓴다 */
const SHADOW = 'color-mix(in srgb, var(--foreground) 45%, transparent)';

/** 얼굴 · 이름표의 그림자와 테(`box-shadow`) — 테는 면(`--surface`) 한 겹, 고른 사람은 그 오행(`--mid`) 한 겹 더 */
export const ORBIT_RING = {
  /** 가운데의 나 */
  me: `0 0 0 4px var(--surface), 0 16px 30px -14px ${SHADOW}`,
  /** 지금 고른 사람 */
  chosen: `0 0 0 3px var(--surface), 0 0 0 7px var(--mid), 0 14px 30px -10px ${SHADOW}`,
  /** 궤도에 가만히 선 사람 */
  resting: `0 0 0 2.5px var(--surface), 0 6px 14px -8px ${SHADOW}`,
  /** 고른 사람의 이름표 */
  tag: `0 6px 14px -8px ${SHADOW}`,
} as const;

/** 가운데에서 번지는 빛 — 이 판을 입은 오행의 파스텔(`--tile`) */
export const ORBIT_GLOW = 'radial-gradient(closest-side, color-mix(in srgb, var(--tile) 70%, transparent), transparent)';

/** 범례의 빛 한 줄 — 지도의 휜 선(파스텔 번짐 위에 먹 선)을 줄인 것. 색은 둘레의 `tone-*` 이 정한다 */
export function ThreadMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 22 10" className="h-2.5 w-[22px] overflow-visible">
      <path d="M1 8 Q 11 -2 21 6" fill="none" stroke="var(--mid)" strokeWidth="4" strokeOpacity="0.5" strokeLinecap="round" />
      <path d="M1 8 Q 11 -2 21 6" fill="none" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** 범례의 점선 한 줄 — 궤도 · 사람끼리의 선처럼 둥근 점이 이어진 것. 글자색을 따른다 */
export function DotsMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 22 10" className="h-2.5 w-[22px] overflow-visible">
      <path d="M1 5 H 21" fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray="0.01 4.5" strokeLinecap="round" />
    </svg>
  );
}
