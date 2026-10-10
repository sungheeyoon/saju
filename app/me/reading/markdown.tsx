import type { ReactNode } from 'react';

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
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let found: RegExpExecArray | null;
  let index = 0;

  while ((found = pattern.exec(text)) !== null) {
    if (found.index > last) parts.push(text.slice(last, found.index));

    parts.push(
      found[1] !== undefined ? (
        <strong key={`${key}-${index}`} className="font-semibold">
          {found[1]}
        </strong>
      ) : (
        <code key={`${key}-${index}`} className="rounded-md bg-surface-sunken px-1 py-0.5 text-[0.9em]">
          {found[2]}
        </code>
      ),
    );

    last = found.index + found[0].length;
    index += 1;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** 원문 한 덩이 — 그리기 전의 짜임. 그리는 일(`Markdown`)과 나눠 두어 짜임을 그대로 잰다(`markdown.test.ts`) */
export type MarkdownBlock =
  | { readonly kind: 'heading'; readonly depth: number; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string; readonly lead: boolean }
  | { readonly kind: 'bullets'; readonly items: readonly string[] }
  | { readonly kind: 'rule' };

/** 번호 붙인 항목의 머리 — `1. ` */
const NUMBERED = /^\d+\.\s/;

/**
 * 원문을 덩이로 나눈다.
 *
 * - 빈 줄이 문단을 끊고, 빈 줄 없이 이어진 줄은 한 문단으로 붙는다.
 * - **번호 붙인 항목(`1. `)은 빈 줄이 없어도 새 문단이다** — 한 항목이 한 문단이다. 번호 목록을 따로 세우지 않고 문단으로
 *   그리므로, 줄머리의 번호가 그 문단의 머리다.
 * - 글의 첫 문단이 리드다. **번호 항목은 리드 자리를 쓰되 크게 서지 않는다** — 셋을 나란히 보이는 자리에서 첫 항목만 한 단
 *   크면 셋이 다른 무게로 읽히고, 리드를 아래 절로 넘기면 글 한가운데의 문단이 크게 선다.
 */
export function markdownBlocks(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let bullets: string[] = [];
  let paragraph: string[] = [];
  let ledOff = false;

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push({ kind: 'bullets', items: bullets });
    bullets = [];
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    paragraph = [];
    const lead = !ledOff && !NUMBERED.test(text);
    ledOff = true;
    blocks.push({ kind: 'paragraph', text, lead });
  };

  const flush = () => {
    flushBullets();
    flushParagraph();
  };

  for (const line of source.split('\n')) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flush();
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      flush();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', depth: heading[1].length, text: heading[2] });
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
      continue;
    }

    flushBullets();
    if (NUMBERED.test(trimmed)) flushParagraph();
    paragraph.push(trimmed);
  }

  flush();
  return blocks;
}

export function Markdown({ source }: { source: string }) {
  const blocks = markdownBlocks(source).map((block, at): ReactNode => {
    const key = `${block.kind}-${at}`;
    switch (block.kind) {
      case 'rule':
        return <hr key={key} className="my-4 border-border" />;

      case 'bullets':
        return (
          <ul key={key} className="flex list-disc flex-col gap-2.5 pl-5 marker:text-[var(--ink,var(--muted))]">
            {block.items.map((item, index) => (
              <li key={index}>{inline(item, `${key}-${index}`)}</li>
            ))}
          </ul>
        );

      case 'paragraph':
        /* 글의 첫 문단이 리드다 — 이 글이 무엇을 말하려는지를 한 단 크게 먼저 건넨다 */
        return (
          <p
            key={key}
            className={block.lead ? 'text-[1.1875rem] font-medium leading-[1.75] tracking-[-0.01em] text-foreground' : undefined}
          >
            {inline(block.text, key)}
          </p>
        );

      case 'heading':
        return block.depth <= 2 ? (
          <h3
            key={key}
            className={`flex items-center gap-2.5 font-rounded text-[1.5rem] leading-[1.35] text-foreground ${at === 0 ? '' : 'mt-8'}`}
          >
            <span aria-hidden="true" className="h-6 w-1.5 shrink-0 rounded-full bg-[var(--mid,var(--border-strong))]" />
            <span>{inline(block.text, key)}</span>
          </h3>
        ) : (
          <h4 key={key} className={`text-[17px] font-bold text-foreground ${at === 0 ? '' : 'mt-3'}`}>
            {inline(block.text, key)}
          </h4>
        );
    }
  });

  return (
    <div className={`${READING_COLUMN} flex flex-col gap-5 text-[17px] leading-[1.85] text-foreground/90 [&_strong]:text-foreground`}>
      {blocks}
    </div>
  );
}
