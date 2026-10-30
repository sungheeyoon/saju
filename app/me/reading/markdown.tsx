import type { ReactNode } from 'react';

import { CHIP_LABELS, chipsOf, inlineParts, markdownBlocks, type MarkdownBlock } from '@/src/lib/reading/markdown-blocks';

export { CHIP_LABELS, markdownBlocks, type MarkdownBlock };

/**
 * 결과 원문을 그대로 세운다 — **화면은 글의 절 구조를 알지 않는다.**
 *
 * 프롬프트가 어떤 소제목을 몇 개 내라고 했는지 화면은 모른다. 아는 것은 Markdown 의
 * 문법뿐이라, 프롬프트 판본이 바뀌어도 이 파일은 그대로다(`prd-archive` 9단계).
 *
 * **`dangerouslySetInnerHTML` 을 쓰지 않는다.** 모델이 낸 글을 HTML 로 해석하면
 * 모델 출력이 곧 이 사이트의 마크업이 된다. 여기서 짓는 것은 React 요소뿐이고,
 * 문법에 없는 것은 **글자 그대로** 선다.
 *
 * 세우는 것은 프롬프트가 쓰라고 한 것과 같다 — 소제목·문단·목록·굵게·인라인 코드.
 * 표를 안 세우는 것은 게을러서가 아니라 **쓰지 말라고 적었기 때문**이고, 둘이 갈리면
 * 사용자에게 파이프 문자가 그대로 보인다.
 *
 * ## 에세이처럼 읽힌다 (5차 warm)
 *
 * 짜임은 모델이 낸 그대로이고 **글자의 단만** 에세이 앱의 것이다 — 본문 17px · 행간 1.85, 한 줄은
 * 36rem(약 34자)에서 끊는다. 한국어 긴 글은 한 줄이 40자를 넘으면 다음 줄 머리를 찾는 눈이 헤맨다.
 * 첫 문단은 리드로 한 단 크게, 소제목은 둥근 서체에 오행 색 막대가 붙는다 — 막대의 색은 감싼 판의
 * `--mid` 이고(`panel.tsx` 가 대상의 일간을 입힌다), 판이 없는 자리(공유본)에서는 테 색이다.
 */

/**
 * **풀이 한 편의 열** — 본문이 36rem 에서 끊기므로 그 위아래에 서는 것(궁합 머리 · 기다리는 동안의 목차 · 설문)도
 * 같은 폭 · 같은 시작선에 선다. 한 풀이 안에서 왼쪽 시작선이 셋이던 것을(본문 36rem · 설문 40rem · 진행 띠 전폭) 하나로
 * 모았다(화면 갤러리 감사 2026-10-09). 맨 위 표지(비유 한 줄)만 일부러 판 폭을 다 쓴다 — 에세이 앱의 표지다.
 */
export const READING_COLUMN = 'mx-auto w-full max-w-[36rem]';

/** `**굵게**` 와 `` `코드` `` 만 — 나머지는 글자 그대로 */
function inline(text: string, key: string): ReactNode[] {
  return inlineParts(text).map((part, index) =>
    part.kind === 'text' ? (
      part.text
    ) : part.kind === 'strong' ? (
      <strong key={`${key}-${index}`} className="font-semibold">
        {part.text}
      </strong>
    ) : (
      <code key={`${key}-${index}`} className="rounded-cell bg-surface-sunken px-1 py-0.5 text-[0.9em]">
        {part.text}
      </code>
    ),
  );
}

export function Markdown({ source }: { source: string }) {
  const parsed = markdownBlocks(source);
  const nodes: ReactNode[] = [];
  let points: (MarkdownBlock & { kind: 'point' })[] = [];

  const flushPoints = () => {
    if (points.length === 0) return;
    const at = nodes.length;
    nodes.push(
      <ol key={`points-${at}`} className="flex flex-col gap-2.5">
        {points.map((point) => (
          <li key={point.number} className="grid grid-cols-[1.5rem_1fr] gap-2.5 rounded-cell bg-surface px-3.5 py-3">
            <span aria-hidden="true" className="font-semibold leading-7 tabular-nums text-[var(--ink,var(--foreground))]">
              {point.number}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="sr-only">{point.number}. </span>
              {/* 풀이 글은 프리텐다드다 — 고운돋움은 맨 위 비유 카드에만(운영자 2026-10-28) */}
              {point.title !== '' && (
                <span className="font-semibold leading-7 text-foreground">{inline(point.title, `p-${point.number}-t`)}</span>
              )}
              <span className={point.title !== '' ? 'text-body leading-7 text-secondary' : 'leading-7 text-foreground'}>
                {inline(point.text, `p-${point.number}`)}
              </span>
            </div>
          </li>
        ))}
      </ol>,
    );
    points = [];
  };

  parsed.forEach((block, at) => {
    const key = `${block.kind}-${at}`;
    if (block.kind === 'point') {
      points.push(block);
      return;
    }
    flushPoints();

    switch (block.kind) {
      case 'rule':
        nodes.push(<hr key={key} className="my-4 border-border" />);
        return;

      case 'summary':
        /* 소제목 바로 아래 — 보통 굵기 회색 한 줄. 소제목 · 굵은 구절과 강조가 세 겹이 되지 않게 굵게 두지 않는다 */
        nodes.push(
          <p key={key} className="-mt-5 text-body leading-7 text-secondary">
            {inline(block.text, key)}
          </p>,
        );
        return;

      case 'labels': {
        const chips = block.rows.length === 1 && CHIP_LABELS.includes(block.rows[0].label);
        nodes.push(
          chips ? (
            <div key={key} className="flex flex-col gap-2">
              <span className="text-small text-secondary">{block.rows[0].label}</span>
              <ul className="flex flex-wrap gap-1.5">
                {chipsOf(block.rows[0].text).map((chip) => (
                  <li key={chip} className="rounded-cell border border-border px-2.5 py-0.5 text-note leading-6 text-foreground">
                    {chip}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <dl key={key} className="-mt-2 grid grid-cols-[4rem_1fr] gap-x-2 gap-y-1.5 rounded-cell border border-border p-3.5 text-body leading-7">
              {block.rows.map((row, index) => (
                <div key={index} className="contents">
                  <dt className="pt-0.5 text-fine text-secondary">{row.label}</dt>
                  <dd>{inline(row.text, `${key}-${index}`)}</dd>
                </div>
              ))}
            </dl>
          ),
        );
        return;
      }

      case 'bullets':
        nodes.push(
          <ul key={key} className="flex list-disc flex-col gap-2.5 pl-5 marker:text-[var(--ink,var(--text-muted))]">
            {block.items.map((item, index) => (
              <li key={index}>{inline(item, `${key}-${index}`)}</li>
            ))}
          </ul>,
        );
        return;

      case 'paragraph':
        /* 글의 첫 문단이 리드다 — 이 글이 무엇을 말하려는지를 한 단 크게 먼저 건넨다 */
        nodes.push(
          <p
            key={key}
            className={block.lead ? 'text-heading font-medium leading-[1.75] tracking-[-0.01em] text-foreground' : undefined}
          >
            {inline(block.text, key)}
          </p>,
        );
        return;

      case 'heading':
        nodes.push(
          block.depth <= 2 ? (
            <h3
              key={key}
              className={`flex items-center gap-2.5 text-heading font-bold leading-[1.45] tracking-[-0.01em] text-foreground ${at === 0 ? '' : 'mt-6'}`}
            >
              <span aria-hidden="true" className="h-6 w-1.5 shrink-0 rounded-full bg-[var(--mid,var(--border-strong))]" />
              <span>{inline(block.text, key)}</span>
            </h3>
          ) : (
            /* 작은 머리 — 강점 · 조심할 점의 갈래. 바로 아래 글과 붙어 한 덩이로 읽히게 그 아래 간격을 줄인다(감싼 열의 `h4+*`) */
            <h4 key={key} className={`flex items-center gap-2 text-lead font-semibold text-foreground ${at === 0 ? '' : 'mt-2'}`}>
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--mid,var(--border-strong))]" />
              {inline(block.text, key)}
            </h4>
          ),
        );
        return;
    }
  });
  flushPoints();

  /*
    **문단 사이 32px** — 줄 사이(17px × 1.85 ≈ 31px)보다 좁으면 문단이 갈려 보이지 않아 글자 벽이 된다(2026-10-28 조사,
    `docs/notes/2026-10-28-research-reading-readability.md`). 전에는 20px 였다
  */
  return (
    <div
      className={`${READING_COLUMN} flex flex-col gap-8 text-lead leading-[1.85] text-foreground/90 [&_strong]:text-foreground [&>h4+*]:-mt-6`}
    >
      {nodes}
    </div>
  );
}
