'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { findStatus, findsInList, pickable } from '@/src/lib/people/pick';

import { NO_MATCH, PLACEHOLDER } from '../../person-combobox';
import { Icon } from '../../ui/icons';

/**
 * 사람 목록 위의 **찾는 칸** — 이름(초성도)을 치면 목록이 그 사람들로 좁혀진다(ADR 0102, G-21).
 *
 * 2026-09-24 에 0 · 1 · 10 · 26 · 100 명을 넣고 쟀다. 카드가 커서(데스크톱 254px · 휴대폰 334px)
 * 첫 화면에 온전히 서는 카드는 수와 상관없이 하나였고, 끝의 사람에 닿으려면 휴대폰에서 스물여섯이면
 * 열세 번, 백이면 마흔여덟 번 화면을 내려야 했다. 서버 읽기는 수와 상관없이 같았다(자리 · 목록 · 풀이 ·
 * 사람 표를 한 번씩) — 모자란 것은 찾는 길이었다. 이 칸이 서면 칸을 누르고 이름 몇 글자를 치는 것으로 닿는다.
 *
 * **카드는 서버가 그린 그대로다.** 좁히기는 줄을 숨길 뿐(`hidden`) 카드를 다시 그리지 않는다 —
 * 열어 둔 관리 메뉴와 메모 칸이 치는 동안 닫히지 않게. 판단(좁히기 · 몇 명부터 칸이 서는가 ·
 * 무엇을 말하는가)은 궁합 칸과 같은 `src/lib/people/pick.ts` 에 있다.
 */

type Findable = { personId: string; label: string; card: ReactNode };

export function PeopleFinder({ people }: { people: Findable[] }) {
  const base = useId();
  const inputId = `${base}-input`;
  const statusId = `${base}-status`;
  const [typed, setTyped] = useState('');

  /* 칸이 안 서는 목록은 좁히지도 않는다 — 여섯에서 치다가 다섯이 되어 칸이 사라져도 전부가 선다 */
  const finds = findsInList(people.length);
  const wanted = finds ? typed : '';
  const shown = new Set(pickable(people, wanted, null).map((one) => one.personId));
  const status = findStatus(wanted, shown.size);

  const list = useRef<HTMLUListElement>(null);
  const [columns, setColumns] = useState(1);
  const [opened, setOpened] = useState<readonly string[]>([]);
  /* 그려진 판 줄들 — 줄이 붙고 떨어질 때만 바뀐다(사람마다 늘 같은 ref 함수라 다시 그려도 안 불린다) */
  const [targets, setTargets] = useState<ReadonlyMap<string, HTMLElement>>(() => new Map());
  const [refs] = useState(() => new Map<string, (node: HTMLElement | null) => void>());
  const slotRef = (personId: string) => {
    let ref = refs.get(personId);
    if (ref === undefined) {
      ref = (node) =>
        setTargets((now) => {
          const next = new Map(now);
          if (node === null) next.delete(personId);
          else next.set(personId, node);
          return next;
        });
      refs.set(personId, ref);
    }
    return ref;
  };

  /* 그려진 격자가 몇 칸인가 — 폭이 바뀌면 다시 센다 */
  useLayoutEffect(() => {
    const grid = list.current;
    if (grid === null) return;
    const count = () => setColumns(Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length));
    count();
    const watch = new ResizeObserver(count);
    watch.observe(grid);
    return () => watch.disconnect();
  }, []);

  /* 늘 같은 함수다 — 카드 쪽 효과가 이것에 걸려 있어 바뀌면 닫는 정리가 돈다 */
  const toggle = useCallback(
    (personId: string, open: boolean) =>
      setOpened((now) =>
        open === now.includes(personId) ? now : open ? [...now, personId] : now.filter((one) => one !== personId),
      ),
    [],
  );
  const slots = useMemo<Slots>(
    () => ({
      opened,
      targets,
      toggle,
    }),
    [opened, targets, toggle],
  );

  /*
    판이 선 줄을 어느 카드 뒤에 둘까 — 보이는 카드들 가운데 그 사람이 선 줄의 마지막 카드 뒤. 좁혀서 숨은 사람의 판은
    제 카드 바로 뒤에 숨긴 채 둔다(쓰던 글이 안 날아가게).
  */
  const after = new Map<string, Findable[]>();
  const visible = people.filter((one) => shown.has(one.personId));
  for (const owner of people.filter((one) => opened.includes(one.personId))) {
    const at = visible.indexOf(owner);
    const anchor =
      at === -1 ? owner : visible[Math.min(visible.length - 1, Math.floor(at / columns) * columns + columns - 1)];
    after.set(anchor.personId, [...(after.get(anchor.personId) ?? []), owner]);
  }

  return (
    <div className="flex flex-col gap-4">
      {finds && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="sr-only">
            {PLACEHOLDER}
          </label>
          <div className="relative w-full sm:max-w-sm">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-secondary" />
            {/*
              **`outline-none` 을 안 단다** — 초점에 두르는 것이 옅은 `ring`(`accent-wash`)과 한 단계 짙은 테두리뿐이라
              그것만으로는 초점이 거의 안 보인다. 전역 초점 테두리(`globals.css` 의 `@layer base`)가 선다.
            */}
            <input
              id={inputId}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={PLACEHOLDER}
              aria-describedby={statusId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="h-12 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-[16px] placeholder:text-secondary focus:border-border-strong focus:ring-2 focus:ring-accent-wash"
            />
          </div>
          {/*
            결과는 **늘 마운트된 칸**이 말한다 — 새로 붙은 live 영역은 화면낭독기가 흘려보내는 일이 있다.
            안 쳤으면 비어 있다.
          */}
          <p id={statusId} role="status" className={status.kind === 'idle' ? 'sr-only' : 'px-2 text-[13px] text-secondary'}>
            {status.kind === 'none' ? NO_MATCH : status.kind === 'some' ? `검색 결과 ${status.count}명` : ''}
          </p>
        </div>
      )}

      {/*
        폰은 한 줄에 한 장, 넓어지면 둘 — 화면이 가운데 기둥(`COLUMN`)이라 셋째 칸은 안 든다.

        **관리 메뉴가 연 판(고치는 칸 · 메모 칸)은 카드 밖, 그 카드가 선 줄 아래의 제 줄에 선다**(G-87). 판이 카드 안에 서서
        카드에 줄 전부(`col-span-full`)를 주던 때는 오른쪽 칸 카드가 다음 줄로 내려가고 왼쪽 옆이 비었다(3열도 같았다).
        `grid-flow-dense` 는 뒤 카드를 그 빈칸에 끌어와 차례를 바꿔 안 썼다. 그래서 판은 줄 끝 카드 **뒤**의 `<li>` 로
        들어가고(`usePanelSlot`), 카드들은 판을 열어도 제 차례 · 제 자리에 그대로 선다. 줄 끝은 그려진 격자의 칸 수로
        센다 — 중단점을 여기 다시 적지 않으려고.
      */}
      <PanelSlots.Provider value={slots}>
        <ul ref={list} className="grid gap-3 sm:grid-cols-2">
          {people.flatMap((one) => [
            <li
              key={one.personId}
              hidden={!shown.has(one.personId)}
              data-panel-open={opened.includes(one.personId) || undefined}
              className="min-w-0 rounded-[1.5rem] data-[panel-open]:outline-[3px] data-[panel-open]:outline-[color-mix(in_srgb,var(--accent)_45%,transparent)] data-[panel-open]:outline-solid"
            >
              {one.card}
            </li>,
            ...(after.get(one.personId) ?? []).map((owner) => (
              <li
                key={`panel:${owner.personId}`}
                ref={slotRef(owner.personId)}
                hidden={!shown.has(owner.personId)}
                role="group"
                aria-label={owner.label}
                className="col-span-full min-w-0"
              />
            )),
          ])}
        </ul>
      </PanelSlots.Provider>
    </div>
  );
}

type Slots = {
  /** 판이 열린 사람들 — 연 차례대로 */
  opened: readonly string[];
  /** 그려진 판 줄 — 사람마다 */
  targets: ReadonlyMap<string, HTMLElement>;
  toggle: (personId: string, open: boolean) => void;
};

const PanelSlots = createContext<Slots | null>(null);

/**
 * 카드의 관리 메뉴가 연 판을 **목록이 마련한 제 줄**에 세우는 자리(G-87).
 *
 * `open` 이 참이면 목록에 그 사람의 줄을 달라고 하고, 그 줄의 요소를 돌려준다 — 판은 거기로 `createPortal` 한다.
 * 목록 밖(이 목록을 안 쓰는 화면)이면 `inline` 이 참이고 판은 예전처럼 카드 안에 선다. 줄이 아직 안 그려졌으면
 * `null` 이다 — 줄이 붙는 즉시(칠하기 전) 다시 그린다.
 */
export function usePanelSlot(personId: string, open: boolean): { inline: boolean; target: HTMLElement | null } {
  const slots = useContext(PanelSlots);
  const toggle = slots?.toggle;

  /* 칠하기 전에 줄을 받는다 — 판이 한 장면 비었다가 서지 않게 */
  useLayoutEffect(() => {
    toggle?.(personId, open);
  }, [toggle, personId, open]);

  /* 카드가 사라지면(목록에서 빼기) 그 줄도 거둔다 */
  useEffect(() => () => toggle?.(personId, false), [toggle, personId]);

  return { inline: slots === null, target: open ? (slots?.targets.get(personId) ?? null) : null };
}
