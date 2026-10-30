/**
 * 풀이 원문을 **덩이로 읽는 규칙** — 웹(`app/me/reading/markdown.tsx`)과 앱(`mobile/src/reading/markdown.tsx`)이 함께 쓴다(ADR 0211).
 * 그리는 일은 각자 한다. 두 벌이면 같은 글의 절이 두 기기에서 다르게 갈린다.
 */

/** 한 줄 안의 조각 — `**굵게**` 와 `` `코드` `` 만, 나머지는 글자 그대로 */
export type InlinePart = { readonly kind: 'text' | 'strong' | 'code'; readonly text: string };

export function inlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let found: RegExpExecArray | null;

  while ((found = pattern.exec(text)) !== null) {
    if (found.index > last) parts.push({ kind: 'text', text: text.slice(last, found.index) });
    parts.push(found[1] !== undefined ? { kind: 'strong', text: found[1] } : { kind: 'code', text: found[2] });
    last = found.index + found[0].length;
  }

  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

/** 원문 한 덩이 — 그리기 전의 짜임. 그리는 일(`Markdown`)과 나눠 두어 짜임을 그대로 잰다(`markdown.test.ts`) */
export type MarkdownBlock =
  | { readonly kind: 'heading'; readonly depth: number; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string; readonly lead: boolean }
  | { readonly kind: 'bullets'; readonly items: readonly string[] }
  | { readonly kind: 'rule' }
  /** 절 요약 — 소제목 바로 아래의 `> 한 줄`(글의 모양, ADR 0208) */
  | { readonly kind: 'summary'; readonly text: string }
  /** 번호 카드 — `1. **제목** — 설명` */
  | { readonly kind: 'point'; readonly number: string; readonly title: string; readonly text: string }
  /** 라벨 행 — 모든 항목이 `라벨: 내용`(라벨 6자 이하)인 목록 */
  | { readonly kind: 'labels'; readonly rows: readonly { readonly label: string; readonly text: string }[] };

/** 번호 카드의 꼴 — `1. **제목** — 설명`(줄표 앞뒤 띄어쓰기는 느슨하게) */
const POINT = /^(\d+)\.\s+\*\*([^*]+)\*\*\s*[—–-]\s*(.+)$/;

/** 라벨 행의 꼴 — 짧은 라벨과 쌍점. 라벨이 길면 그냥 문장이다 */
const LABELED = /^([^:：*]{1,6})[:：]\s+(.+)$/;

/** 이 라벨의 행은 낱말 칩으로 선다 — 「일과 돈」의 첫 줄 */
export const CHIP_LABELS: readonly string[] = ['잘 맞는 일'];

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
    const rows = bullets.flatMap((item) => {
      const found = LABELED.exec(item);
      return found ? [{ label: found[1].trim(), text: found[2] }] : [];
    });
    if (rows.length === bullets.length) {
      blocks.push({ kind: 'labels', rows });
    } else {
      blocks.push({ kind: 'bullets', items: bullets });
    }
    bullets = [];
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    paragraph = [];
    const lead = !ledOff && !NUMBERED.test(text);
    ledOff = true;
    const point = POINT.exec(text);
    if (point) {
      blocks.push({ kind: 'point', number: point[1], title: point[2].trim(), text: point[3].trim() });
      return;
    }
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

    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flush();
      if (quote[1].trim() !== '') blocks.push({ kind: 'summary', text: quote[1].trim() });
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
  /*
    이어쓰기(ADR 0143)는 첫 절 1번에 제목 없는 답을 끼운다(`continuedMarkdownOf`) — 바로 뒤가 번호 카드면 그 1번도 제목 없는
    카드로 세워 셋이 한 묶음으로 선다
  */
  return blocks.map((block, at) => {
    const next = blocks[at + 1];
    const numbered = block.kind === 'paragraph' ? /^(\d+)\.\s+(.+)$/.exec(block.text) : null;
    return numbered && next?.kind === 'point' ? { kind: 'point', number: numbered[1], title: '', text: numbered[2] } : block;
  });
}

/** 「라벨: 내용」을 낱말로 — 칩 줄은 쉼표로 가른다(「금융·보험」처럼 가운뎃점은 한 낱말 안이다) */
export const chipsOf = (text: string): string[] =>
  text
    .split(/[,，]\s*/)
    .map((one) => one.trim())
    .filter((one) => one !== '');
