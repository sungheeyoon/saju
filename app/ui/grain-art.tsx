/**
 * **결 그림 — 이름 「결」의 일러스트 두 장**(2026-10-03 브랜드 시안).
 *
 * 로고(`logo.tsx`)의 나이테를 크게 편 그림이다. 손으로 그은 듯 고르지 않은 동심원이 가운데 감물빛 점(나)을 두르고, 가운데가
 * 한쪽으로 치우쳐 바깥 겹일수록 한쪽이 넓다 — 진짜 나이테처럼. 색은 토큰만 쓴다(먹 · 감물빛 · 오행의 중간색) — 다크 화면에서
 * 저절로 바뀐다. 둘 다 장식이라 `aria-hidden` 이고 글자를 품지 않는다.
 *
 * - `GrainRings` — 현관 종이의 오른쪽 위에 깔리는 큰 결. 결 위에 곁의 사람 셋이 오행의 점으로 앉는다
 * - `LostGrain` — 길을 잃은 화면(404 · 열 수 없는 링크). 결의 한 겹이 끊기고, 점 하나가 결 밖으로 떨어져 있다
 *
 * 흔들림은 각도의 사인 셋을 섞어 늘 같은 모양으로 선다 — 그릴 때마다 바뀌면 서버와 브라우저의 그림이 갈린다.
 * 공유 그림을 굽는 도구(`scripts/brand-share-images.mjs` 의 `grain`)와 같은 식이다.
 */

function grainPath(cx: number, cy: number, r: number, seed: number, from = 0, to = 360, wobble = 0.05): string {
  const steps = 72;
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    const k = 1 + wobble * (Math.sin(3 * a + seed) * 0.6 + Math.sin(5 * a + seed * 1.7) * 0.3 + Math.sin(2 * a - seed) * 0.4);
    points.push(`${(cx + r * k * Math.cos(a)).toFixed(1)} ${(cy + r * k * Math.sin(a)).toFixed(1)}`);
  }
  return `M${points.join('L')}`;
}

/** 결 겹 — 가운데가 왼아래로 치우쳐 바깥 겹일수록 오른위로 넓다 */
const RINGS = [18, 34, 52, 72, 94].map((r, i) => ({
  d: grainPath(100 + i * 3, 100 - i * 3, r, i * 1.3 + 0.4),
  opacity: 0.55 - i * 0.08,
}));

export function GrainRings({ className = '', peopleClassName = '' }: { className?: string; peopleClassName?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {RINGS.map(({ d, opacity }) => (
        <path key={d} d={d} stroke="var(--foreground)" strokeOpacity={opacity * 0.6} strokeWidth="1.4" />
      ))}
      <circle cx="100" cy="100" r="8" fill="var(--brand)" />
      {/* 곁의 사람 셋 — 결 위에 앉은 오행의 점. 좁은 폭에서는 글 옆에 걸려 걷는다(`peopleClassName`) */}
      <g className={peopleClassName}>
        <circle cx="139" cy="66" r="4.5" fill="var(--wood-mid)" stroke="var(--foreground)" strokeWidth="1.2" />
        <circle cx="58" cy="148" r="3.5" fill="var(--water-mid)" stroke="var(--foreground)" strokeWidth="1.2" />
        <circle cx="176" cy="122" r="5.5" fill="var(--earth-mid)" stroke="var(--foreground)" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

const LOST = {
  inner: grainPath(60, 64, 14, 0.7),
  middle: grainPath(62, 62, 28, 2.1),
  /* 바깥 겹은 끊겼다 — 오른아래 한 토막이 비어 있다 */
  outer: grainPath(64, 60, 44, 3.4, 60, 340),
};

export function LostGrain({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 140 130" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={LOST.outer} stroke="var(--foreground)" strokeOpacity="0.3" strokeWidth="2" />
      <path d={LOST.middle} stroke="var(--foreground)" strokeOpacity="0.5" strokeWidth="2" />
      <path d={LOST.inner} stroke="var(--foreground)" strokeOpacity="0.7" strokeWidth="2" />
      <circle cx="60" cy="64" r="5.5" fill="var(--brand)" />
      {/* 결 밖으로 떨어진 점 하나와, 거기까지 흐릿하게 남은 발자국 */}
      <circle cx="98" cy="96" r="1.6" fill="var(--foreground)" fillOpacity="0.3" />
      <circle cx="108" cy="104" r="1.6" fill="var(--foreground)" fillOpacity="0.3" />
      <circle cx="124" cy="110" r="6" fill="var(--brand-mid)" stroke="var(--foreground)" strokeWidth="1.6" />
    </svg>
  );
}
