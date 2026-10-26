import type { ReactNode } from 'react';

import { ELEMENT_EXCHANGE_LABEL } from '@/src/lib/consent';
import { ELEMENT_PICTURE_KO } from '@/src/lib/saju';
import type { Element, Stem } from '@/src/lib/saju';
import { READING_STALE_LABEL } from '@/src/lib/reading/notes';

import { elementScope } from '../../../ui/element-tone';
import { BUTTON_SECONDARY_SMALL } from '../../../ui/buttons';
import { ElementSymbol } from '../../../ui/element-symbol';
import { FaceSymbol, STEM_PICTURE, StemSymbol } from '../../../ui/stem-symbol';
import { Icon } from '../../../ui/icons';
import { EmptyState } from '../../../ui/empty-state';
import { EMPTY_SLOT_FACE, STALE_CHIP, TYPE_SECTION } from '../../../ui/surfaces';
import { Avatar } from '../../avatar';
import { READING_CONTINUE_NOTE, READING_MAKING } from '../../home/making';
import { coverFace } from '../../reading/essay';
import flow from '../../reading/flow.module.css';
import type { InboxMatch } from '../../requests/inbox';
import type { CameFrom } from '../../../came-from';
import type { Book } from './book';
import { CoverLink, ShelfItem } from './frame';
import type { DayMaster } from './subject';

/**
 * **책장** — 만든 글이 한 권씩 꽂힌다(시안 3차 warm · 2026-10-26 안 D).
 *
 * 한 편이 한 줄이고, 줄 왼쪽의 작은 표지가 그 글의 색(대상의 일간 오행)을 든다. 묶음은 「인연 궁합」 → 「사주풀이」 → 「궁합풀이」이고
 * 아직 도는 것은 묶음과 상관없이 맨 위에 모인다(`layout.tsx`). 줄은 **제 주소로 가는 링크**다 — 한 사람 풀이는 `/me/readings/[subject]`
 * 라 넓은 화면에서는 책장 옆 칸에 펼쳐지고(`frame.tsx`), 궁합도 보관함 틀 안의 주소로 연다(ADR 0134).
 *
 * 누를 자리는 줄 전체다. 줄 안에 단추를 따로 두면 한 권에 손잡이가 둘이 된다.
 */

/**
 * 표지 한 권(궁합) — 인연 기록(`app/me/matching/history/page.tsx`)이 아직 이 꼴로 세운다. 보관함은 줄(`ShelfRow`)이다.
 */
const COVER =
  'group relative flex h-full min-h-[14rem] flex-col gap-3 overflow-hidden rounded-card py-4 pl-6 pr-4 text-left shadow-lift transition-transform hover:-translate-y-0.5 active:scale-[0.97]';

/**
 * 칸이 하나도 안 보이는 구역은 통째로 숨는다 — 보관함의 찾는 칸이 그 구역의 권을 다 숨겼을 때(`ShelfItem`). 찾지 않을 때는
 * 구역마다 적어도 점선 한 권이 서므로 걸리지 않는다.
 */
const FOUND_NONE_HIDES = '[&:not(:has(li:not([hidden])))]:hidden';

/**
 * **책장의 한 묶음** — 머리(제목 + 설명 한 줄)와 그 아래 한 열의 줄(2026-10-26 운영자 결정 「안 D」).
 *
 * 폰에서 표지 2열이던 것을 한 열의 줄로 눕혔다 — 2열에서는 비유가 넷째 줄에서 잘렸고 열 권이면 다섯 줄을 내려야 했다. 줄 왼쪽의
 * 작은 책 표지(`MiniCover`)가 표지의 색 · 등 · 일간 그림을 그대로 든다(Kindle · Apple Books 라이브러리의 목록 보기). 칩으로 한 종류만
 * 고르면 머리 없이 줄만 선다(`title` 없음) — 칩이 이미 무엇을 보는지 말한다.
 */
export function Shelf({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-2 ${FOUND_NONE_HIDES}`}>
      {title !== undefined && (
        <div>
          <h2 className={TYPE_SECTION}>{title}</h2>
          {description !== undefined && <p className="mt-0.5 text-small leading-5 text-secondary">{description}</p>}
        </div>
      )}
      <ul className={SHELF_ROWS}>{children}</ul>
    </section>
  );
}

/**
 * 줄 사이의 선 — 위 테로 긋고 맨 윗줄만 걷는다. 찾는 칸이 숨긴 줄(`hidden`)은 세지 않는다 — 숨은 맨 윗줄 아래의 줄이 머리에
 * 선을 달지 않게 「보이는 첫 줄」을 고른다.
 */
const SHELF_ROWS = 'flex flex-col [&>li:not([hidden])~li:not([hidden])]:border-t [&>li]:border-border';

/** **만드는 중** — 책장 맨 위의 묶음 머리(안 D). 무엇이든 도는 동안만 선다. 확정 문구(대장 home-08, 운영자 승인 2026-10-26) */
export const SHELF_MAKING_HEAD = '만드는 중';

/**
 * **맨 위의 「만드는 중」** — 한 사람 풀이 · 궁합풀이 · 인연 궁합 가운데 아직 도는 것은 종류와 상관없이 칩 · 찾기 바로 아래에 모인다
 * (2026-10-26 운영자 결정 「안 D」). 머리를 두는 것은 그 줄이 바로 아래 「인연 궁합」 묶음의 첫 줄로 읽히지 않게 하려는 것이다 —
 * 작은 회색 글자라 묶음 머리(구역 제목)보다 한 단 낮다. 칩으로 한 종류만 볼 때는 이 묶음이 안 서고, 그 종류의 줄이 그 목록 맨 위에
 * 붙는다(`layout.tsx`).
 */
export function MakingGroup({ children }: { children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-1 ${FOUND_NONE_HIDES}`}>
      <h2 className="text-small font-semibold text-secondary">{SHELF_MAKING_HEAD}</h2>
      <ul className={SHELF_ROWS}>{children}</ul>
    </section>
  );
}

/** 한 줄 — 왼쪽 작은 표지, 오른쪽 종류 · 이름 · 요약 · 날짜. 줄 전체가 그 풀이로 가는 링크다(표지 한 권과 같은 길) */
const ROW = 'flex gap-4 rounded-cell px-1 py-4 text-left transition-colors hover:bg-surface-sunken active:bg-surface-sunken';
/** 지금 펼친 글의 줄 — 넓은 화면에서 옆 칸에 펼친 그 권이다(`CoverLink`). 테 대신 면으로 */
const ROW_CURRENT = 'bg-surface-sunken';

const KIND_TAG = 'text-fine font-semibold text-secondary';

/**
 * 한 권의 줄 — 한 사람 풀이도, 직접 본 궁합도, 인연 궁합도 같은 꼴이다. 인연 궁합이면 상대가 나에게 채워 주는 기운과 균형 한 줄이
 * 요약 아래에 선다(`match`, #849).
 *
 * `kind` 는 그 줄이 어느 종류인지 글자로 단다 — 묶음 밖(맨 위의 「만드는 중」)에서만 준다. 묶음 안에서는 머리가 같은 말을 한다.
 */
export function ShelfRow({ book, match = null, from, kind }: { book: Book; match?: InboxMatch | null; from?: CameFrom; kind?: string }) {
  const [a = null, b = null] = book.subjects;
  return (
    <CoverLink href={book.href} from={from} className={ROW} current={ROW_CURRENT}>
      <MiniCover subjects={book.single ? [a] : [a, b]} score={book.score} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {kind !== undefined && <span className={KIND_TAG}>{kind}</span>}
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-body font-semibold text-foreground">{book.title}</span>
          {book.stale && <StaleChip />}
        </span>
        <span className="line-clamp-2 text-small leading-5 text-secondary">{book.metaphor ?? READING_CONTINUE_NOTE}</span>
        {match !== null && <Supplied match={match} />}
        <time dateTime={book.dateTime} className="text-fine tabular-nums text-muted">
          {book.date}
        </time>
      </span>
    </CoverLink>
  );
}

/**
 * **만드는 중인 한 권** — 한 사람 풀이 · 궁합풀이가 아직 도는 동안(2026-10-10 화면 점검 B3). 홈에서 「만드는 중」을 보고 보관함에 오면
 * 그 풀이가 사라진 것처럼 읽혔다. 표지는 크림 면 · 흐르는 띠이고, 누르면 그 풀이 화면으로 가서 같은 목차를 본다. 이름은 홈의 줄과
 * 같은 말이다(`runningName`).
 */
export function MakingRow({ href, name, kind, from }: { href: string; name: string; kind?: string; from?: CameFrom }) {
  return (
    <CoverLink href={href} from={from} className={ROW} current={ROW_CURRENT}>
      <MakingMini />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {kind !== undefined && <span className={KIND_TAG}>{kind}</span>}
        <span className="truncate text-body font-semibold text-foreground">{name}</span>
        <span className="text-small font-semibold text-cream-ink">{READING_MAKING}</span>
      </span>
    </CoverLink>
  );
}

/**
 * **만드는 중인 인연 궁합** — 동의가 만들고 있는 글 한 장(ADR 0038). 받는 기운 · 균형이 이 줄에도 선다(#849 — 앞서 편지는 기운
 * 그림이 한 번도 안 섰다).
 */
export function MakingMatchRow({ match, href, kind }: { match: InboxMatch; href: string; kind?: string }) {
  return (
    <CoverLink href={href} className={ROW} current={ROW_CURRENT}>
      <MakingMini />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {kind !== undefined && <span className={KIND_TAG}>{kind}</span>}
        <span className="truncate text-body font-semibold text-foreground">{match.nickname} 님과의 궁합풀이</span>
        <span className="text-small font-semibold text-cream-ink">궁합풀이 {READING_MAKING}</span>
        <Supplied match={match} />
      </span>
    </CoverLink>
  );
}

/**
 * **받는 기운 · 균형 한 줄**(#849) — 상대가 나에게 채워 주는 오행을 그림 + 이름으로, 그 뒤에 균형의 짧은 꼴. 말은 요청 카드와 같다
 * (「받는 기운」 · 흙 · 쇠 … · 「균형이 고른 편이에요」, 대장 matching-10). 그림은 보조기기에 숨기고 원래 문장(`suppliedToMe`)을 읽힌다.
 * 채워 주는 기운이 없으면 균형만 선다.
 */
function Supplied({ match }: { match: InboxMatch }) {
  const elements = match.elementsToMe;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-small text-secondary">
      {match.suppliedToMe !== null && <span className="sr-only">{match.suppliedToMe}</span>}
      {elements.length > 0 && (
        <span aria-hidden="true" className="flex items-center gap-2">
          <span className="text-fine font-semibold">{ELEMENT_EXCHANGE_LABEL.toMe}</span>
          <span className="flex items-center gap-1.5">
            {elements.map((element) => (
              <span key={element} className={`${elementScope(element)} flex items-center gap-0.5`}>
                <span className="grid size-5 place-items-center rounded-full bg-[var(--tile)]">
                  <ElementSymbol element={element} className="size-3.5" />
                </span>
                <span className="text-fine font-bold text-[var(--ink)]">{ELEMENT_PICTURE_KO[element]}</span>
              </span>
            ))}
          </span>
          <span className="text-muted">·</span>
        </span>
      )}
      <span>{match.balanceShort}</span>
    </span>
  );
}

const MINI = 'relative flex h-[5.5rem] w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-cell shadow-lift';

/** 작은 책 표지 — 색은 일간(두 사람이면 비스듬히 만난다), 왼쪽 등, 한 사람이면 천간 그림 · 두 사람이면 두 얼굴과 점수 */
function MiniCover({ subjects, score }: { subjects: readonly (DayMaster | null)[]; score: number | null }) {
  const face = coverFace(subjects.map((one) => one?.element ?? null));
  const single = subjects.length === 1;
  return (
    /* `data-stem` — 표지가 어느 일간으로 섰는지(그 글을 만들 때의 사본, G-59). 흐름 검사가 「수정 전」 책의 표지를 이것으로 잰다 */
    <span
      aria-hidden="true"
      data-stem={single ? (subjects[0]?.stem ?? undefined) : undefined}
      className={`${elementScope(subjects[0]?.element ?? null)} ${MINI}`}
      style={{ background: face.background }}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: face.spine }} />
      {single ? (
        <FaceSymbol stem={subjects[0]?.stem} element={subjects[0]?.element ?? null} className="size-8" />
      ) : (
        <>
          <span className="flex -space-x-1.5">
            {subjects.map((one, index) => (
              <span
                key={index}
                className={`${elementScope(one?.element ?? null)} grid size-6 place-items-center rounded-full bg-[var(--tile)] ring-2 ring-surface`}
              >
                <FaceSymbol stem={one?.stem} className="size-4" />
              </span>
            ))}
          </span>
          {score !== null && <span className="mt-1 text-note font-bold tabular-nums text-foreground">{score}</span>}
        </>
      )}
    </span>
  );
}

/** 만드는 중의 작은 표지 — 크림 면 · 반짝임 · 흐르는 띠(인연 궁합의 편지와 같은 면) */
function MakingMini() {
  return (
    <span aria-hidden="true" className={`${MINI} bg-cream`}>
      <span className="absolute inset-y-0 left-0 w-1.5 bg-cream-ink" />
      <Icon name="spark" className="size-5 text-cream-ink" />
      <span className="absolute inset-x-3 bottom-3 block h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cream-ink)_14%,transparent)]">
        <span className={`${flow.flow} block h-full rounded-full`} />
      </span>
    </span>
  );
}


/**
 * 궁합 = 두 사람의 색이 비스듬히 만나는 표지. 점수가 크게 선다.
 *
 * `source` 는 궁합 탭의 보관함만 단다(ADR 0129) — 직접 본 궁합과 인연 궁합이 한 줄에 섞여 서므로 어디서 왔는지 작은
 * 딱지로 가른다. 책장은 제목(「… 님과의 궁합풀이」)이 이미 말하므로 안 단다.
 */
export function PairCover({
  book,
  source,
  from,
}: {
  book: Book;
  source?: string;
  /** 이 표지가 선 자리(ADR 0134) — 보관함이면 켠 칩도 함께 싣고, 보관함 틀 안의 주소로 연다(`CoverLink`) */
  from?: CameFrom;
}) {
  const [a = null, b = null] = book.subjects;
  const face = coverFace([a?.element ?? null, b?.element ?? null]);
  return (
    <CoverLink href={book.href} from={from} className={COVER} style={{ background: face.background }}>
      <Spine background={face.spine} />

      <span className="relative flex items-center justify-between gap-2">
        <span className="flex -space-x-2">
          {[a, b].map((one, index) => (
            <span
              key={index}
              className={`${elementScope(one?.element ?? null)} grid size-8 place-items-center rounded-full bg-surface ring-2 ring-[var(--tile)]`}
            >
              <FaceSymbol stem={one?.stem} className="size-5" />
            </span>
          ))}
        </span>
        {book.score !== null && (
          <span className="flex items-baseline gap-0.5 text-foreground">
            <span className="text-title font-bold leading-none tabular-nums">{book.score}</span>
            <span className="text-fine font-semibold text-secondary">점</span>
          </span>
        )}
      </span>

      <span className="relative flex min-w-0 flex-col items-start gap-1">
        {source !== undefined && (
          <span className="rounded-full bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-2 py-0.5 text-tag font-semibold text-secondary">
            {source}
          </span>
        )}
        <span className="max-w-full truncate text-body font-semibold text-foreground">{book.title}</span>
      </span>

      <Metaphor text={book.metaphor} lines="line-clamp-3" />

      <span className="relative flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          {book.stale && <StaleChip />}
          <time dateTime={book.dateTime} className="text-fine tabular-nums text-secondary">
            {book.date}
          </time>
        </span>
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] text-foreground transition-transform group-hover:translate-x-0.5"
        >
          <Icon name="arrow" className="size-4" />
        </span>
      </span>
    </CoverLink>
  );
}

/**
 * 빈 자리 한 권 — 같은 크기의 점선 표지라 「한 권 더」로 읽힌다.
 *
 * `wide` 는 **그 구역에 한 권도 없을 때의 한 줄**이다(2026-10-09) — 궁합풀이 구역이 비면 반폭의 키 큰 점선 상자 하나가
 * 덩그러니 서서 어색했다. 꽂힌 책이 없으니 「한 권 더」가 아니라 「여기서 시작」이다 — 줄 폭으로 낮게 눕힌다.
 */
export function BlankBook({
  href,
  element,
  label,
  row = false,
  wide = false,
  from,
  className,
}: {
  href: string;
  element: Element;
  label: string;
  row?: boolean;
  wide?: boolean;
  /** 이 권이 선 칸의 모양 — 홈의 폰 가로 줄(`received-readings.tsx`)이 칸 폭을 준다 */
  className?: string;
  /** 결과로 가는 빈 표지(「내 사주풀이」)만 싣는다 — 만드는 자리로 가는 표지에는 `CoverLink` 가 안 붙인다 */
  from?: CameFrom;
}) {
  const shape = wide
    ? 'flex-row justify-start gap-4 px-5 py-4 text-left'
    : `${row ? 'min-h-[9rem] px-2 py-4 sm:min-h-[14rem] sm:p-4' : 'min-h-[14rem] p-4'} flex-col justify-center gap-3 text-center`;
  return (
    <ShelfItem href={null} className={wide ? 'col-span-full' : className}>
      <CoverLink
        href={href}
        from={from}
        className={`${elementScope(element)} flex h-full ${shape} items-center rounded-card border-2 border-dashed border-[color-mix(in_srgb,var(--ink)_28%,transparent)] hover:bg-surface active:scale-[0.98]`}
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--tile)]">
          <ElementSymbol element={element} className="size-7" />
        </span>
        {/* 홈의 한 줄 셋(`row`)은 폰에서 표지 폭이 110px 남짓이라 「사주풀이 받기」가 두 줄로 접혔다 — 그 자리만 14px 한 줄이다 */}
        <span className={`font-semibold text-foreground ${row ? 'whitespace-nowrap text-note sm:text-body' : 'text-body'}`}>{label}</span>
      </CoverLink>
    </ShelfItem>
  );
}

/**
 * 「인연 궁합」 — 동의가 만들고 있는 글 한 장.
 *
 * 크림 편지 한 장이 통째로 결과 화면으로 가는 링크다. 「함께 보기」는 그 링크의 모양일 뿐 따로 눌리는
 * 단추가 아니다(한 장에 손잡이 하나).
 */
export function MakingShelf({
  matches,
  hrefOf = (matchId) => `/me/match/${matchId}`,
  titled = true,
}: {
  matches: readonly InboxMatch[];
  /** 결과 화면으로 가는 길 — 인연 기록은 `?from=history`, 보관함은 `?from=shelf` 와 칩을 단다(ADR 0134) */
  hrefOf?: (matchId: string) => string;
  /** 절 제목 줄 — 인연 기록은 제 「인연 궁합」 제목 아래에 세우므로 안 단다 */
  titled?: boolean;
}) {
  return (
    <section className={`flex flex-col gap-4 ${FOUND_NONE_HIDES}`}>
      {titled && (
        <div>
          <h2 className={TYPE_SECTION}>인연 궁합</h2>
          <p className="mt-0.5 text-small leading-5 text-secondary">서로 동의해 두 사람이 함께 보는 궁합풀이예요.</p>
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {matches.map((match) => {
          /* 기운은 값으로 온다(#849) — 앞서는 기운 이름 하나와 문장 전체를 견줘 늘 맞지 않았다 */
          const supplied = match.elementsToMe;
          return (
            <ShelfItem key={match.matchId} href={`/me/match/${match.matchId}`}>
              {/* 보관함 옆 칸에 펼친 편지에도 테가 선다 — 표지와 같은 링크(`CoverLink`)다 */}
              <CoverLink
                href={hrefOf(match.matchId)}
                className="group flex h-full flex-col gap-4 rounded-card bg-cream p-5 transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <span className="flex items-center gap-3.5">
                  <Avatar userId={match.partnerUserId} nickname={match.nickname} hasPhoto={match.hasPhoto} focus={match.photoFocus} size={56} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lead font-semibold text-foreground">
                      {match.nickname} 님과의 궁합풀이
                    </span>
                    {supplied.length > 0 && (
                      <span className="mt-0.5 flex items-center gap-1 text-small text-cream-ink">
                        {supplied.map((element: Element) => (
                          <ElementSymbol key={element} element={element} className="size-4" />
                        ))}
                        <span className="truncate">{match.balanceLabel}</span>
                      </span>
                    )}
                  </span>
                </span>

                <span className="flex flex-col gap-2">
                  <span
                    aria-hidden="true"
                    className="block h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cream-ink)_14%,transparent)]"
                  >
                    <span className={`${flow.flow} block h-full rounded-full`} />
                  </span>
                  <span className="text-small font-semibold text-cream-ink">궁합풀이 만드는 중…</span>
                </span>

                <span className={`${BUTTON_SECONDARY_SMALL} self-start`}>
                  함께 보기
                  <Icon name="arrow" className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CoverLink>
            </ShelfItem>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * 아직 한 권도 없을 때 — **어디서 만드는지를 말한다.** 빈 화면만 남으면 고장으로 읽힌다.
 *
 * 빈 상태 한 벌(`EmptyState`)이다 — 그림 · 제목 · 한 줄 · 단추 하나. 단추는 가장 가까운 첫 풀이(내 사주풀이, 내 사주가 없으면 등록)로
 * **곧장** 간다. 저장한 사람 · 궁합은 한 줄이 어디서 시작하는지 말하고 아래 탭이 그 길을 든다(ADR 0126) — 표지 셋(2026-10-10 화면 점검
 * A10)을 단추 하나로 줄였다(2026-10-24 빈 상태 한 벌).
 */
export function Nothing({ hasSelf }: { hasSelf: boolean }) {
  return (
    <EmptyState
      icon="reading"
      title="아직 만든 풀이가 없어요"
      action={
        hasSelf
          ? { href: '/me/readings/self', label: '사주풀이 받기', icon: 'reading' }
          : { href: '/me', label: '내 사주 등록하기', trailingIcon: 'arrow' }
      }
    >
      {/* 쉼표에서 꺾는다 — 가운데 정렬의 두 줄이 「…홈 탭에서, 두 / 사람의…」로 낱말 하나를 윗줄에 남겼다(2026-10-26 390px) */}
      내 사주와 저장한 사람의 풀이는 홈 탭에서,{' '}
      <br />두 사람의 궁합은 궁합 탭에서 시작할 수 있어요.
    </EmptyState>
  );
}

function Spine({ background }: { background: string }) {
  return (
    <>
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-2.5" style={{ background }} />
      <span aria-hidden="true" className="absolute inset-y-0 left-2.5 w-px bg-[color-mix(in_srgb,var(--foreground)_14%,transparent)]" />
    </>
  );
}

function Metaphor({ text, lines, small = false }: { text: string | null; lines: string; small?: boolean }) {
  return (
    <span
      className={`font-rounded relative ${lines} flex-1 text-foreground ${small ? 'text-note leading-[1.35] sm:text-lead sm:leading-[1.5]' : 'text-lead leading-[1.5]'}`}
    >
      {text === null ? (
        <span className="font-sans text-small text-secondary">{READING_CONTINUE_NOTE}</span>
      ) : (
        <>
          <span aria-hidden="true">“</span>
          {text}
          <span aria-hidden="true">”</span>
        </>
      )}
    </span>
  );
}

/** 일간 딱지 — 천간 그림 + 그 이름(「햇빛」). 한자 · 오행 이름은 얼굴 자리에서 걷었다(`app/ui/stem-symbol.tsx`) */
export function SubjectTag({ subject }: { subject: DayMaster | null }) {
  if (subject === null) return null;
  return (
    <span className={`${elementScope(subject.element)} flex items-center gap-1 text-fine font-semibold text-[var(--ink)]`}>
      <StemSymbol stem={subject.stem} className="size-4" />
      <span>{STEM_PICTURE[subject.stem as Stem]}</span>
    </span>
  );
}

function StaleChip() {
  return <span className={STALE_CHIP}>{READING_STALE_LABEL}</span>;
}

/**
 * 넓은 화면에서 목록 주소만 열었고 켠 칩에 펼칠 글이 한 편도 없을 때의 오른쪽 칸 — 비워 두면 고장으로 읽힌다.
 * 한 편이라도 있으면 이 칸은 서지 않는다(`frame.tsx` 가 그 칩에서 마지막으로 연 글이나 기본 글로 옮긴다, `opening.ts`).
 */
export function EmptyReader() {
  return (
    <div className={`${EMPTY_SLOT_FACE} grid min-h-80 place-items-center p-8 text-center`}>
      <p className="text-body leading-6 text-secondary">표지를 누르면 여기에 풀이가 펼쳐져요.</p>
    </div>
  );
}
