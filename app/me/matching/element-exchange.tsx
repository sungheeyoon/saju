import { ELEMENT_EXCHANGE_LABEL } from '@/src/lib/consent';
import { ELEMENT_PICTURE_KO, type Element } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icons';

/** 요청 한 장이 주고받는 것 — 오행은 **내 자리 기준**이다. 문장은 보조기기가 읽는다 */
export type Exchange = {
  readonly elementsToMe: readonly Element[];
  readonly elementsToThem: readonly Element[];
  readonly suppliedToMe: string | null;
  readonly suppliedToThem: string | null;
  readonly balanceShort: string;
};

type Partner = { nickname: string };

/**
 * 요청 카드의 **오행 주고받기** — 상대가 나에게 채우는 기운과 내가 상대에게 채우는 기운.
 *
 * 회색 알약 세 줄(문장 둘 + 균형)이던 자리다. 운영자 피드백(2026-10-26 「요청 자체가 직관적이지 않다」)으로 그림이 먼저 말하게
 * 바꿨다. 오행은 늘 상징 + 이름(`ELEMENT_PICTURE_KO`)으로 서고 색은 상징의 면에만 둔다 — 색 혼자 말하지 않는다. 눈에 보이는
 * 그림은 `aria-hidden` 이고, 보조기기는 같은 사실을 원래 문장(`suppliedText`)으로 읽는다.
 */
export function ElementExchange({ exchange, partner }: { exchange: Exchange; partner: Partner }) {
  const { elementsToMe, elementsToThem } = exchange;
  const said = [exchange.suppliedToMe, exchange.suppliedToThem].filter((line): line is string => line !== null);

  return (
    <div className="flex flex-col gap-2">
      {(elementsToMe.length > 0 || elementsToThem.length > 0) && (
        <>
          {said.map((line) => (
            <p key={line} className="sr-only">
              {line}
            </p>
          ))}
          <div aria-hidden="true">
            <Pair toMe={elementsToMe} toThem={elementsToThem} partner={partner} />
          </div>
        </>
      )}
      <p className="flex items-center gap-1.5 text-small leading-5 text-secondary">
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-fine font-semibold text-secondary">{ELEMENT_EXCHANGE_LABEL.balance}</span>
        {exchange.balanceShort}
      </p>
    </div>
  );
}

/**
 * 두 칸 맞교환 — 송금 확인의 「보내는 쪽 → 받는 쪽」처럼 칸 머리가 방향(「이웃 → 나」)을 글자로 말하고, 가운데 ⇄ 가 둘이
 * 맞바꾸는 일임을 그림으로 말한다. 세 안(두 줄 장부 · 두 사람 사이 화살표 · 두 칸) 중 운영자가 고른 꼴이다(2026-10-26, #848).
 * 넓은 화면에서도 칸이 늘어지지 않게 폭을 묶는다.
 */
function Pair({ toMe, toThem, partner }: { toMe: readonly Element[]; toThem: readonly Element[]; partner: Partner }) {
  const cells = [
    { key: 'toMe', label: ELEMENT_EXCHANGE_LABEL.toMe, from: partner.nickname, to: '나', elements: toMe },
    { key: 'toThem', label: ELEMENT_EXCHANGE_LABEL.toThem, from: '나', to: partner.nickname, elements: toThem },
  ];
  return (
    <div className="relative grid max-w-md grid-cols-2 gap-2">
      {cells.map((cell) => (
        <div key={cell.key} className="flex min-w-0 flex-col gap-2 rounded-cell bg-surface-sunken px-3 py-2.5">
          <span className="flex flex-col">
            <span className="text-small font-bold text-foreground">{cell.label}</span>
            <span className="flex min-w-0 items-center gap-0.5 text-fine text-secondary">
              <span className="truncate">{cell.from}</span>
              <Icon name="arrow" className="size-3 shrink-0" />
              <span className="truncate">{cell.to}</span>
            </span>
          </span>
          {cell.elements.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {cell.elements.map((element) => (
                <Mark key={element} element={element} />
              ))}
            </span>
          ) : (
            <span className="text-small text-muted">{ELEMENT_EXCHANGE_LABEL.none}</span>
          )}
        </div>
      ))}
      <span className="absolute left-1/2 top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface text-secondary ring-1 ring-border">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8.5h13.5M15 5l3.5 3.5L15 12M19 15.5H5.5M9 12l-3.5 3.5L9 19" />
        </svg>
      </span>
    </div>
  );
}

/** 상징 동그라미 아래 이름 — 좁은 칸에서 셋까지 한 줄에 선다 */
function Mark({ element }: { element: Element }) {
  return (
    <span className={`${elementScope(element)} flex flex-col items-center`}>
      <span className="grid size-8 place-items-center rounded-full bg-[var(--tile)] ring-1 ring-[color-mix(in_srgb,var(--ink)_20%,transparent)]">
        <ElementSymbol element={element} className="size-5" />
      </span>
      <span className="text-tag font-bold leading-4 text-[var(--ink)]">{ELEMENT_PICTURE_KO[element]}</span>
    </span>
  );
}
