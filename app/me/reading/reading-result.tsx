import type { ReactNode } from 'react';

import { READING_STALE_LABEL, READING_STALE_NOTE } from '@/src/lib/reading/notes';
import { namedMatchBody } from '@/src/lib/reading/display';
import { ELEMENTS, type Element } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import { FaceSymbol } from '../../ui/stem-symbol';
import { Icon } from '../../ui/icons';
import { TYPE_SECTION } from '../../ui/surfaces';
import type { CurrentReading } from '@/src/lib/reading';
import { coverFace, readingMinutes } from './essay';
import { Markdown, READING_COLUMN } from './markdown';
import type { ReadingTarget } from './target';
import { when } from '../requests/when';

/** 다 된 글 — 표지(비유 · 점수) · 수정 전 경고 · 본문 */
export function Result({
  reading,
  target,
  isMock,
  tones,
  betweenSummaryAndBody,
  matchNames,
}: {
  reading: CurrentReading;
  target: ReadingTarget;
  isMock: boolean;
  tones: readonly (Element | null)[] | undefined;
  betweenSummaryAndBody?: ReactNode;
  matchNames?: { readonly me: string; readonly partner: string };
}) {
  const body =
    target.kind === 'match' && matchNames !== undefined
      ? namedMatchBody(reading.output, reading.viewerIsFirst, matchNames)
      : reading.output;

  /*
    **표지의 색은 부르는 화면이 정한다** — 대상의 일간이다. 모르면(부르는 화면이 안 넘기면) 크림 한 장이다:
    회색 표지는 「못 읽은 명식」의 뜻이라, 몰라서 안 넘긴 자리에 쓰면 거짓말이 된다.
  */
  const face = tones === undefined ? null : coverFace(tones);
  const firstTone = tones?.[0] ?? null;

  const meta = (
    <>
      {isMock && (
        <span className="rounded-full bg-warning-wash px-2.5 py-1 text-tag font-semibold text-warning">
          예시 결과
        </span>
      )}
      <time dateTime={reading.createdAt} className="tabular-nums">
        {when(reading.createdAt)} 생성
      </time>
      <span aria-hidden="true">·</span>
      <span>읽는 데 약 {readingMinutes(body)}분</span>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      {/*
        **비유 한 줄이 이 글의 표지다** — 에세이 앱의 표지처럼 가장 크게 세운다(시안 3차 warm). 점수는 표지의
        오른쪽 아래, 비유가 흐르는 자리를 밀어내지 않는 곳에 선다. 비유는 길이가 들쭉날쭉하다(마흔 자 안팎을
        시키지만 막는 자리는 120자) — 한 줄을 전제하지 않고 `text-pretty` 로 고르게 나눈다.
      */}
      {reading.score !== null || reading.metaphor !== null ? (
        <figure
          className={`${elementScope(firstTone)} relative overflow-hidden rounded-paper px-6 pb-6 pt-7 sm:px-10 sm:pb-8 sm:pt-10 ${face === null ? 'bg-cream' : ''}`}
          style={face === null ? undefined : { background: face.background }}
        >
          {/* 한 사람 풀이의 표지 — 그 사람의 천간 그림(저장한 사람 카드의 딱지와 같은 것). 일간을 모르면 오행 상징 */}
          {tones !== undefined && tones.length === 1 && (
            <FaceSymbol
              stem={reading.dayMasterA}
              element={firstTone}
              className="pointer-events-none absolute -right-10 -top-10 size-48 opacity-20 sm:size-64"
            />
          )}
          {reading.metaphor !== null ? (
            <>
              <span aria-hidden="true" className="relative block h-10 font-rounded text-[5rem] leading-none text-[var(--ink)] opacity-70">
                “
              </span>
              <blockquote className="relative mt-2 max-w-[18em] text-pretty font-rounded text-title leading-[1.4] tracking-[-0.02em] text-foreground sm:text-figure">
                {reading.metaphor}
              </blockquote>
            </>
          ) : (
            <p className="relative text-small font-semibold text-secondary">풀이 결과</p>
          )}
          <figcaption className="relative mt-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-[color-mix(in_srgb,var(--foreground)_12%,transparent)] pt-4">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-small text-secondary">{meta}</span>
            {reading.score !== null && (
              <span className="flex flex-col items-end">
                <span className="text-small font-semibold text-secondary">궁합풀이 점수</span>
                <span className="flex items-baseline gap-1">
                  <span className="text-figure font-bold leading-none tabular-nums text-foreground">{reading.score}</span>
                  <span className="text-small font-semibold text-secondary">/ 100</span>
                </span>
              </span>
            )}
          </figcaption>
        </figure>
      ) : (
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-small text-secondary">{meta}</p>
      )}
      {/*
        **늘 참인 사실은 여기 안 적는다.** 여기 서는 것은 **실제로 갈리는** 한 줄뿐이다 — 지금과 다른
        명식으로 만든 글. 새로 만들면 지금 것이 사라진다는 경고는 되돌릴 수 없는 누름 **직전**에 필요한
        말이라 확인 창이 든다. 색만으로 말하지 않는다 — 「수정 전」 낱말이 함께 선다.
      */}
      {target.kind !== 'match' && !reading.fromCurrentChart && (
        <p className="flex gap-2.5 rounded-row bg-warning-wash px-4 py-3.5 text-note leading-6 text-foreground">
          <Icon name="alert" className="mt-0.5 size-5 text-warning" />
          <span>
            <span className="mr-1.5 font-semibold text-warning">{READING_STALE_LABEL}</span>
            {READING_STALE_NOTE}
          </span>
        </p>
      )}
      {betweenSummaryAndBody}
      <div className={`${elementScope(firstTone)} flex flex-col gap-2 pt-4 sm:pt-8`}>
        {target.kind === 'match' && (
          <header className={READING_COLUMN}>
            <p className="text-small font-semibold text-secondary">두 사람의 풀이</p>
            <h2 className={`mt-1 ${TYPE_SECTION}`}>궁합풀이 결과</h2>
          </header>
        )}
        <article id={`reading-${reading.id}`}>
          <Markdown source={body} />
        </article>
        {/* 글의 끝 — 다섯 상징이 마침표 자리에 선다 */}
        <span aria-hidden="true" className="mt-12 flex justify-center gap-3 opacity-80">
          {ELEMENTS.map((element) => (
            <ElementSymbol key={element} element={element} className="size-5" />
          ))}
        </span>
      </div>
    </div>
  );
}
