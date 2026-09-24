import Image from 'next/image';

import { initialOf } from '@/src/lib/profile';
import type { Element } from '@/src/lib/saju';

import { ELEMENT_TONE } from '../../../../../element-tone';

/*
  **궤도 그림 조각 — 훅이 없어서 서버 화면과 카드 더미가 함께 쓴다.**

  좌표는 홈의 `placement.ts` 와 같은 약속이다: 상자의 백분율, 가운데 (50, 50). 다른 점은 **각도가 오행에서
  온다**는 것 — 안쪽 궤도의 다섯 자리는 상생 차례(木 → 火 → 土 → 金 → 水)로 정수리부터 시계 방향 72° 간격이고,
  후보는 자기가 채워 주는 오행의 각도로 바깥 궤도에 선다. 그래서 선이 짧고 지도를 가로지르지 않는다.
*/

export const ELEMENT_ANGLE: Record<Element, number> = { 木: -90, 火: -18, 土: 54, 金: 126, 水: 198 };

export const ELEMENT_ORDER: readonly Element[] = ['木', '火', '土', '金', '水'];

export const isElement = (value: string | undefined): value is Element =>
  value !== undefined && (ELEMENT_ORDER as readonly string[]).includes(value);

const round = (value: number) => Math.round(value * 100) / 100;

export function pointAt(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: round(50 + radius * Math.cos(rad)), y: round(50 + radius * Math.sin(rad)) };
}

/** 후보 사진 — 없으면 이름 첫 글자. 자리(`relative` 크기 · `absolute inset-0`)는 부르는 쪽이 준다 */
export function Face({ src, name, sizes, className = '' }: { src: string | null; name: string; sizes: string; className?: string }) {
  return (
    <span className={`block overflow-hidden bg-surface-sunken ${className}`}>
      {src !== null ? (
        <Image src={src} alt="" fill sizes={sizes} draggable={false} className="object-cover" />
      ) : (
        <span aria-hidden="true" className="grid size-full place-items-center text-[1.4em] font-bold text-secondary">
          {initialOf(name)}
        </span>
      )}
    </span>
  );
}

/** 오행 한 글자 딱지 — 색만으로 말하지 않게 한자가 늘 함께 선다 */
export function ElementBead({ element, hollow = false, className = '' }: { element: Element; hollow?: boolean; className?: string }) {
  const tone = ELEMENT_TONE[element];
  return (
    <span
      className={`grid place-items-center rounded-full border ${hollow ? 'border-dashed bg-surface' : tone.surface} ${tone.border} ${className}`}
    >
      <span aria-hidden="true" className={`glyph font-bold leading-none dark:brightness-[1.45] ${tone.text}`}>
        {element}
      </span>
    </span>
  );
}

/**
 * 카드 속 작은 궤도 — **폰에서 지도를 대신한다.**
 * 가운데 내 일간, 안쪽 실선이 내 궤도, 오른쪽 위 바깥 점선에서 후보가 들어와 제 기운 한 알을 내 궤도에 얹는다.
 */
export function MiniOrbit({
  meStem,
  meElement,
  supply,
  face,
  name,
}: {
  meStem: string;
  meElement: Element;
  supply: Element | null;
  face: string | null;
  name: string;
}) {
  const bead = pointAt(-40, 26);
  const guest = pointAt(-40, 54);
  return (
    <div aria-hidden="true" className="relative mr-2 mt-2 size-[7rem] shrink-0">
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
        <circle cx="50" cy="50" r="46" className="fill-none stroke-border-strong" strokeWidth="1" strokeDasharray="2.5 4" />
        <circle cx="50" cy="50" r="26" className="fill-none stroke-border-strong" strokeWidth="1" />
        {supply !== null && (
          <line
            x1={guest.x}
            y1={guest.y}
            x2={bead.x}
            y2={bead.y}
            className={`stroke-current ${ELEMENT_TONE[supply].text}`}
            strokeWidth="1.6"
            strokeDasharray="2 3"
            strokeLinecap="round"
          />
        )}
      </svg>
      <span
        className={`absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-surface ${ELEMENT_TONE[meElement].border}`}
      >
        <span className={`glyph text-[1.35rem] font-bold leading-none dark:brightness-[1.45] ${ELEMENT_TONE[meElement].text}`}>{meStem}</span>
      </span>
      {supply !== null && (
        <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${bead.x}%`, top: `${bead.y}%` }}>
          <ElementBead element={supply} className="size-7 text-[0.95rem] shadow-[0_0_0_3px_var(--surface)]" />
        </span>
      )}
      <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${guest.x}%`, top: `${guest.y}%` }}>
        <Face src={face} name={name} sizes="28px" className="relative size-8 rounded-full ring-2 ring-surface" />
      </span>
    </div>
  );
}

/** 빈 궤도 — 참여 전(가운데가 빈다)과 쉬는 중(가운데는 있지만 아무도 다가오지 않는다) */
export function EmptyOrbit({ filled, label }: { filled: boolean; label: string }) {
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[11rem] sm:max-w-[15rem]">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,var(--accent-wash)_0%,transparent_65%)]" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <circle cx="50" cy="50" r="46" className="fill-none stroke-border-strong" strokeWidth="0.6" strokeDasharray="1.5 3" />
        <circle cx="50" cy="50" r="28" className="fill-none stroke-border-strong" strokeWidth="0.6" />
      </svg>
      {ELEMENT_ORDER.map((element) => {
        const at = pointAt(ELEMENT_ANGLE[element], 28);
        return (
          <span key={element} className="absolute -translate-x-1/2 -translate-y-1/2 opacity-70" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
            <ElementBead element={element} className="size-7 text-sm" />
          </span>
        );
      })}
      <span
        className={`absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[15px] font-bold ${
          filled ? 'border-2 border-accent bg-surface text-accent' : 'border-2 border-dashed border-border-strong bg-surface text-muted'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
