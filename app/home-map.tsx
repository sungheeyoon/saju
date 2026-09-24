import type { Element } from '@/src/lib/saju';

import { elementScope } from './element-tone';
import { ElementSymbol } from './ui/element-symbol';
import { Icon } from './ui/icon';

/**
 * 현관의 그림 — **점으로 이루어지는 관계**를 한 장으로 보여 준다(5차, 부드러움).
 *
 * 로그인한 홈의 관계 지도(나를 가운데 두고 사람이 두 궤도에 점으로 앉는 그림)를 처음 온 사람에게 미리 보인다.
 * 이름 「점점」과 로고가 같은 그림이라, 첫 화면에서 로고 · 그림 · 로그인한 뒤의 지도가 한 줄로 이어진다.
 *
 * **아무 사람의 자료도 아니다.** 점 안에는 글자 대신 오행 상징만 두고, 이름 · 점수 · 한자를 안 적는다 —
 * 적는 순간 예시 명식이 되고, 예시 명식은 이 화면이 일부러 안 세우는 것이다(`saju-calculator.tsx`).
 * 그래서 늘 `aria-hidden` 이고 누를 것이 없다. 무엇을 하는 서비스인지는 곁의 제목과 한 줄 소개가 말한다.
 *
 * 좌표는 정사각 상자의 0~100 이다. 선은 warm 지도의 연필 선(2차 베지어 두 겹)을 손으로 옮겨 적었다.
 */
type Dot = { readonly element: Element | null; readonly x: number; readonly y: number; readonly size: 'md' | 'sm' };

const INNER = 25;
const OUTER = 41;

const DOTS: readonly Dot[] = [
  { element: '木', x: 50 + INNER * Math.cos(-2.2), y: 50 + INNER * Math.sin(-2.2), size: 'md' },
  { element: '水', x: 50 + INNER * Math.cos(0.5), y: 50 + INNER * Math.sin(0.5), size: 'md' },
  { element: '金', x: 50 + OUTER * Math.cos(-0.75), y: 50 + OUTER * Math.sin(-0.75), size: 'sm' },
  { element: '土', x: 50 + OUTER * Math.cos(2.35), y: 50 + OUTER * Math.sin(2.35), size: 'sm' },
  { element: null, x: 50 + OUTER * Math.cos(1.45), y: 50 + OUTER * Math.sin(1.45), size: 'sm' },
];

const round = (value: number) => Math.round(value * 100) / 100;

/** 두 점 사이를 살짝 휜 선 — `bend` 는 길이에 대한 옆 밀기 비율(부호가 방향) */
function pencil(a: { x: number; y: number }, b: { x: number; y: number }, bend: number): string {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const cx = (a.x + b.x) / 2 - ((b.y - a.y) / length) * length * bend;
  const cy = (a.y + b.y) / 2 + ((b.x - a.x) / length) * length * bend;
  return `M ${round(a.x)} ${round(a.y)} Q ${round(cx)} ${round(cy)} ${round(b.x)} ${round(b.y)}`;
}

const CENTER = { x: 50, y: 50 };

export function HomeMap({ className = '' }: { className?: string }) {
  const [wood, water, metal] = DOTS;
  const between = { x: (metal.x + water.x) / 2 + 6, y: (metal.y + water.y) / 2 - 2 };

  return (
    <div aria-hidden="true" className={`relative aspect-square w-full ${className}`}>
      <svg viewBox="0 0 100 100" className="tone-fire absolute inset-0 size-full overflow-visible">
        {/* 가운데의 번짐 — 나의 색이 종이에 스민다 */}
        <circle cx="50" cy="50" r="17" className="fill-[var(--tile)]" />
        {/* 안쪽 궤도 — 옅은 띠 */}
        <circle
          cx="50"
          cy="50"
          r={INNER}
          fill="none" className="stroke-[color-mix(in_srgb,var(--cream-ink)_11%,transparent)]"
          strokeWidth="7"
        />
        {/* 바깥 궤도 — 동글동글한 점선 */}
        <circle
          cx="50"
          cy="50"
          r={OUTER}
          fill="none" className="stroke-[color-mix(in_srgb,var(--cream-ink)_40%,transparent)]"
          strokeWidth="1"
          strokeDasharray="0 2.8"
          strokeLinecap="round"
        />
        {/* 나와 이어진 두 사람 — 연필로 두 번 그은 선 */}
        {[wood, water].map((dot, index) => (
          <g key={dot.element} fill="none" className="stroke-[var(--cream-ink)]" strokeLinecap="round">
            <path d={pencil(CENTER, dot, index === 0 ? 0.12 : -0.12)} strokeWidth="0.8" opacity="0.6" />
            <path d={pencil(CENTER, dot, index === 0 ? 0.18 : -0.18)} strokeWidth="0.4" opacity="0.3" />
          </g>
        ))}
        {/* 둘레의 두 사람 사이 — 바깥으로 휜 점선 */}
        <path
          d={pencil(water, metal, 0.28)}
          fill="none" className="stroke-[color-mix(in_srgb,var(--cream-ink)_70%,transparent)]"
          strokeWidth="0.8"
          strokeDasharray="0 2"
          strokeLinecap="round"
        />
        {/* 흩어진 작은 점 — 아직 이어지지 않은 인연 */}
        {[
          [18, 30, 1.1],
          [83, 70, 0.9],
          [30, 86, 0.8],
          [74, 14, 1.2],
          [9, 60, 0.7],
        ].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} className="fill-[color-mix(in_srgb,var(--cream-ink)_45%,transparent)]" />
        ))}
      </svg>

      {/* 가운데의 나 — 로고와 같은 큰 점 */}
      <span className="tone-fire absolute left-1/2 top-1/2 grid size-[22%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[var(--ink)] bg-[var(--tile)] shadow-[0_12px_28px_-14px_rgba(60,48,30,0.6)] ring-[5px] ring-surface">
        <ElementSymbol element="火" className="size-[52%]" />
      </span>

      {DOTS.map((dot) => (
        <span
          key={dot.element ?? 'none'}
          style={{ left: `${round(dot.x)}%`, top: `${round(dot.y)}%` }}
          className={`${elementScope(dot.element)} absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ring-2 ring-surface ${
            dot.size === 'md' ? 'size-[15%]' : 'size-[11%]'
          } ${
            dot.element === null
              ? 'border-2 border-dashed border-[color-mix(in_srgb,var(--ink)_35%,transparent)] bg-surface'
              : 'bg-[var(--tile)] shadow-[0_8px_18px_-10px_rgba(60,48,30,0.55)]'
          }`}
        >
          <ElementSymbol element={dot.element} className="size-[58%]" />
        </span>
      ))}

      {/* 두 사람 사이의 궁합 — 점수 없이 하트만 */}
      <span
        style={{ left: `${round(between.x)}%`, top: `${round(between.y)}%` }}
        className="absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface text-fire shadow-sm ring-1 ring-[color-mix(in_srgb,var(--cream-ink)_30%,transparent)]"
      >
        <Icon name="heart" className="size-3.5" />
      </span>
    </div>
  );
}
