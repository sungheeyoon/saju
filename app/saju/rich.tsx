import { Fragment } from 'react';

import type { Rich as RichParts, RichPart } from '@/src/lib/saju/view/notes';

function Part({ part }: { readonly part: RichPart }) {
  if (typeof part === 'string') return part;
  if ('b' in part) return <strong className="font-medium">{part.b}</strong>;
  if ('m' in part) return <span className="font-medium">{part.m}</span>;
  if ('g' in part) return <span className="glyph">{part.g}</span>;
  if ('n' in part) return <span className="tabular-nums">{part.n}</span>;
  if ('s' in part) return <span className="text-secondary">{part.s}</span>;
  return <span className="text-muted">{part.u}</span>;
}

/** 명식 결과의 문단을 그린다 — 글자는 `src/lib/saju/view/notes.ts` 가 든다. 앱은 같은 값을 제 부품으로 그린다 */
export function Rich({ parts }: { readonly parts: RichParts }) {
  return parts.map((part, index) => (
    <Fragment key={index}>
      <Part part={part} />
    </Fragment>
  ));
}
