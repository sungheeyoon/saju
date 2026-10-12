import type { ReactNode } from 'react';

import type { LegalBlock, LegalDocument, LegalSection, LegalTable } from '@/src/lib/brand/legal-text';

import { CARD, TYPE_NAME } from './ui/surfaces';

/**
 * 이용약관 · 환불정책의 몸 — `LegalDocument` 를 그리기만 한다(ADR 0171). 글자는 `src/lib/brand/terms.ts` · `refund.ts` 에 있다.
 *
 * 읽는 모양은 처리방침(`app/privacy/page.tsx`)의 것이다 — 카드 · 둥근 제목 · 15px 본문. 장이 있는 글(약관)은 장마다 카드 한 장이고
 * 조는 그 안의 작은 제목이다 — 조마다 카드면 서른 장이 넘는다. 장이 없는 글(환불정책)은 절마다 카드 한 장이다.
 */
export function LegalBody({ document, children }: { document: LegalDocument; children?: ReactNode }) {
  return (
    <>
      {document.parts.map((part, index) =>
        part.title === null ? (
          part.sections.map((section) => (
            <section key={section.title} className={`${CARD} flex flex-col gap-3`}>
              <h2 className={TYPE_NAME}>{section.title}</h2>
              <Blocks blocks={section.blocks} />
            </section>
          ))
        ) : (
          <section key={part.title || index} className={`${CARD} flex flex-col gap-5`}>
            <h2 className={TYPE_NAME}>{part.title}</h2>
            {part.sections.map((section) => (
              <Clause key={section.title || 'body'} section={section} />
            ))}
          </section>
        ),
      )}
      {children}
    </>
  );
}

function Clause({ section }: { section: LegalSection }) {
  return (
    <div className="flex flex-col gap-2">
      {section.title ? <h3 className="text-[15px] font-semibold text-foreground">{section.title}</h3> : null}
      <Blocks blocks={section.blocks} />
    </div>
  );
}

const TEXT = 'text-[15px] leading-7 text-secondary';

function Blocks({ blocks }: { blocks: readonly LegalBlock[] }) {
  return blocks.map((block, index) => {
    switch (block.kind) {
      case 'para':
        return (
          <p key={index} className={TEXT}>
            {block.text}
          </p>
        );
      case 'bullets':
        return <Bullets key={index} items={block.items} />;
      case 'table':
        return <Table key={index} table={block.table} />;
      case 'numbered':
        return (
          <ol key={index} className={`flex list-decimal flex-col gap-2 pl-6 marker:text-muted ${TEXT}`}>
            {block.items.map((item) => (
              <li key={item.text} className="pl-1">
                {item.text}
                {item.bullets ? <Bullets items={item.bullets} className="mt-2" /> : null}
                {item.table ? <Table table={item.table} className="mt-3" /> : null}
                {item.after ? <p className="mt-2">{item.after}</p> : null}
              </li>
            ))}
          </ol>
        );
    }
  });
}

/** 점 목록 — 처리방침의 점 줄과 같은 모양이다 */
function Bullets({ items, className = '' }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={`flex flex-col gap-2 ${className}`}>
      {items.map((item) => (
        <li
          key={item}
          className={`relative pl-4 ${TEXT} before:absolute before:left-0.5 before:top-[0.8rem] before:size-1.5 before:rounded-full before:bg-border-strong before:content-['']`}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/** 표 — 폰에서 넘치면 표만 옆으로 민다(페이지는 가로로 안 민다) */
function Table({ table, className = '' }: { table: LegalTable; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[18rem] border-collapse text-left text-[14px] leading-6">
        <thead>
          <tr className="border-b border-border-strong">
            {table.head.map((cell, index) => (
              <th
                key={cell}
                scope="col"
                className={`py-2 pr-3 font-semibold text-foreground ${index > 0 ? 'whitespace-nowrap' : ''}`}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.join('|')} className="border-b border-border">
              {row.map((cell, index) => (
                <td key={index} className={`py-2 pr-3 tabular-nums text-secondary ${index > 0 ? 'whitespace-nowrap' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
