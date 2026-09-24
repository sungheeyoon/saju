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

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.split('\n');
  let bullets: string[] = [];
  let paragraph: string[] = [];
  let ledOff = false;

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="flex list-disc flex-col gap-2.5 pl-5 marker:text-[var(--ink,var(--muted))]">
        {items.map((item, at) => (
          <li key={at}>{inline(item, `li-${blocks.length}-${at}`)}</li>
        ))}
      </ul>,
    );
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    paragraph = [];
    /* 글의 첫 문단이 리드다 — 이 글이 무엇을 말하려는지를 한 단 크게 먼저 건넨다 */
    const lead = !ledOff;
    ledOff = true;
    blocks.push(
      <p
        key={`p-${blocks.length}`}
        className={lead ? 'text-[1.1875rem] font-medium leading-[1.75] tracking-[-0.01em] text-foreground' : undefined}
      >
        {inline(text, `p-${blocks.length}`)}
      </p>,
    );
  };

  const flush = () => {
    flushBullets();
    flushParagraph();
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flush();
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      flush();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-4 border-border" />);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      const depth = heading[1].length;
      const separation = blocks.length === 0 ? '' : 'mt-8';
      blocks.push(
        depth <= 2 ? (
          <h3
            key={`h-${blocks.length}`}
            className={`flex items-center gap-2.5 font-rounded text-[1.5rem] leading-[1.35] text-foreground ${separation}`}
          >
            <span aria-hidden="true" className="h-6 w-1.5 shrink-0 rounded-full bg-[var(--mid,var(--border-strong))]" />
            <span>{inline(heading[2], `h-${blocks.length}`)}</span>
          </h3>
        ) : (
          <h4 key={`h-${blocks.length}`} className={`text-[17px] font-bold text-foreground ${blocks.length === 0 ? '' : 'mt-3'}`}>
            {inline(heading[2], `h-${blocks.length}`)}
          </h4>
        ),
      );
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
      continue;
    }

    flushBullets();
    paragraph.push(trimmed);
  }

  flush();

  return (
    <div className="mx-auto flex w-full max-w-[36rem] flex-col gap-5 text-[17px] leading-[1.85] text-foreground/90 [&_strong]:text-foreground">
      {blocks}
    </div>
  );
}
