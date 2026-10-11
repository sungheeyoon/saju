/**
 * 말풍선 본문을 글과 링크로 나눈다 — **`http://` · `https://` 로 시작하는 주소만 링크다**(ADR 0155 「2026-10-11 덧 — 링크」).
 *
 * 본문은 여전히 글자로만 그린다(React 가 이스케이프한다) — 여기서 HTML 을 짓지 않고, 주소 조각만 `href` 를 단다. `javascript:` ·
 * `data:` 같은 다른 체계는 처음부터 주소로 읽히지 않는다. 주소 문자는 ASCII 만 받는다 — 「https://a.kr에서」의 「에서」는 글로
 * 남는다. 끝에 붙은 문장부호(마침표 · 쉼표 · 닫는 괄호 등)는 주소에서 뗀다 — 짝이 맞는 괄호는 남긴다.
 */
export type BodyPart = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'link'; readonly text: string; readonly href: string };

const ADDRESS = /https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/gi;
const TRAILING = /[.,!?;:'"\]]$/;

const count = (text: string, char: string) => text.split(char).length - 1;

/** 끝의 문장부호를 뗀다 — 괄호는 연 것보다 닫은 것이 많을 때만 */
function trimmed(raw: string): string {
  let text = raw;
  for (;;) {
    if (TRAILING.test(text)) text = text.slice(0, -1);
    else if (text.endsWith(')') && count(text, ')') > count(text, '(')) text = text.slice(0, -1);
    else return text;
  }
}

function hrefOf(text: string): string | null {
  try {
    const url = new URL(text);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.hostname === '') return null;
    return url.href;
  } catch {
    return null;
  }
}

export function bodyPartsOf(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let at = 0;
  const textUntil = (until: number) => {
    if (until > at) parts.push({ kind: 'text', text: body.slice(at, until) });
  };
  for (const match of body.matchAll(ADDRESS)) {
    const address = trimmed(match[0]);
    const href = hrefOf(address);
    if (href === null) continue;
    textUntil(match.index);
    parts.push({ kind: 'link', text: address, href });
    at = match.index + address.length;
  }
  textUntil(body.length);
  return parts;
}
