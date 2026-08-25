import type { ReactNode } from 'react';

/**
 * 결과 원문을 그대로 세운다 — **화면은 글의 절 구조를 알지 않는다.**
 *
 * 프롬프트가 어떤 소제목을 몇 개 내라고 했는지 화면은 모른다. 아는 것은 Markdown 의
 * 문법뿐이라, 프롬프트 판본이 바뀌어도 이 파일은 그대로다(PRD 9단계).
 *
 * **`dangerouslySetInnerHTML` 을 쓰지 않는다.** 모델이 낸 글을 HTML 로 해석하면
 * 모델 출력이 곧 이 사이트의 마크업이 된다. 여기서 짓는 것은 React 요소뿐이고,
 * 문법에 없는 것은 **글자 그대로** 선다.
 *
 * 세우는 것은 프롬프트가 쓰라고 한 것과 같다 — 소제목·문단·목록·굵게·인라인 코드.
 * 표를 안 세우는 것은 게을러서가 아니라 **쓰지 말라고 적었기 때문**이고, 둘이 갈리면
 * 사용자에게 파이프 문자가 그대로 보인다.
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
        <code key={`${key}-${index}`} className="rounded bg-surface-sunken px-1 py-0.5 text-[0.9em]">
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

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="flex list-disc flex-col gap-1.5 pl-5">
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
    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-relaxed">
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
      blocks.push(<hr key={`hr-${blocks.length}`} className="border-border" />);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      const depth = heading[1].length;
      const size = depth <= 2 ? 'text-lg font-semibold' : 'text-base font-semibold';
      blocks.push(
        <h3 key={`h-${blocks.length}`} className={`${size} mt-1`}>
          {inline(heading[2], `h-${blocks.length}`)}
        </h3>,
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

  return <div className="flex flex-col gap-3 text-sm">{blocks}</div>;
}
