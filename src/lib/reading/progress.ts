import { GROUNDING_HEADING } from './display';

/**
 * **쓰는 중인 응답에서 절 머리만 센다** — 글은 한 자도 안 남긴다(ADR 0127).
 *
 * 모델은 구조화 출력(JSON)으로 낸다. 스트림의 조각은 그 JSON 글자 그대로라 본문의 줄바꿈이 `\n` 두 글자로 오고,
 * 조각의 경계는 아무 데나 떨어진다 — `\` 와 `n` 사이에서도, `#` 와 ` ` 사이에서도. 그래서 조각을 이어 붙인 글에
 * 정규식을 거는 대신, **`markdown` 문자열 하나를 한 글자씩 풀어 읽는다.** 경계가 어디에 떨어져도 같은 답이다.
 *
 * 세는 것은 둘이다.
 *
 * - `begun` — 줄머리 `## ` 로 시작한 줄의 수. 소제목 하나가 곧 절 하나다(프롬프트가 「소제목은 `##` 로 단다」).
 *   `### ` 는 안 센다 — 본문 안의 작은 제목과 맨 끝 검사용 근거 절이 그 자리다.
 * - `bodyWritten` — 사용자 본문을 다 썼다. 검사용 근거 절(`### 근거`)이 섰거나 `markdown` 문자열이 닫혔다.
 *
 * 줄은 **끝났을 때** 잰다(줄바꿈이나 문자열 끝). 머리 한 줄은 짧아 늦어 봐야 한 조각이고, 덜 온 줄을 재면 `##` 와
 * `###` 를 가를 수 없다.
 */
export type SectionCount = { readonly begun: number; readonly bodyWritten: boolean };

/** `markdown` 값이 시작하는 자리 — 키 이름과 여는 따옴표. 앞의 칸(점수 · 한 줄 요약)은 건너뛴다 */
const MARKDOWN_OPENS = /"markdown"\s*:\s*"/;

/** 줄머리를 가르는 데 필요한 만큼만 든다 — 본문을 쌓지 않는다 */
const LINE_HEAD = 40;

/** 키를 찾기 전까지 쌓아 두는 상한 — 앞 칸은 점수와 한 줄 요약뿐이다. 넘으면 세기를 그만둔다 */
const BEFORE_BODY = 4_000;

const SECTION_HEAD = /^## /;

export function sectionCounter(): { feed(chunk: string): SectionCount; readonly count: SectionCount } {
  let before = '';
  let phase: 'seeking' | 'body' | 'closed' | 'gave-up' = 'seeking';
  /** 이스케이프 읽는 중 — `\` 다음 글자, 또는 `\u` 뒤의 네 자리 */
  let escape: null | { readonly kind: 'next' } | { kind: 'unicode'; hex: string } = null;
  let line = '';
  let begun = 0;
  let bodyWritten = false;

  const endLine = () => {
    if (SECTION_HEAD.test(line)) begun += 1;
    if (GROUNDING_HEADING.test(line)) bodyWritten = true;
    line = '';
  };

  const put = (char: string) => {
    if (char === '\n') {
      endLine();
      return;
    }
    if (char === '\r') return;
    if (line.length < LINE_HEAD) line += char;
  };

  const readBody = (text: string) => {
    for (const char of text) {
      if (phase !== 'body') return;

      if (escape !== null) {
        if (escape.kind === 'unicode') {
          escape.hex += char;
          if (escape.hex.length === 4) {
            put(String.fromCharCode(Number.parseInt(escape.hex, 16) || 0x20));
            escape = null;
          }
          continue;
        }
        escape = null;
        if (char === 'u') {
          escape = { kind: 'unicode', hex: '' };
          continue;
        }
        put(char === 'n' ? '\n' : char === 'r' ? '\r' : char === 't' ? '\t' : char);
        continue;
      }

      if (char === '\\') {
        escape = { kind: 'next' };
        continue;
      }
      if (char === '"') {
        endLine();
        bodyWritten = true;
        phase = 'closed';
        return;
      }
      put(char);
    }
  };

  const snapshot = (): SectionCount => ({ begun, bodyWritten });

  return {
    feed(chunk: string): SectionCount {
      if (phase === 'seeking') {
        before += chunk;
        const opened = MARKDOWN_OPENS.exec(before);
        if (opened === null) {
          if (before.length > BEFORE_BODY) phase = 'gave-up';
          return snapshot();
        }
        phase = 'body';
        const rest = before.slice(opened.index + opened[0].length);
        before = '';
        readBody(rest);
        return snapshot();
      }
      if (phase === 'body') readBody(chunk);
      return snapshot();
    },
    get count() {
      return snapshot();
    },
  };
}
