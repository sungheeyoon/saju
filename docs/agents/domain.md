# Domain Docs

This is a single-context repository. Engineering skills must use the root domain glossary and the
root ADR directory when exploring, planning, testing, or changing the codebase.

## Read before working

- Read `CONTEXT.md` for the project's domain language.
- Read the relevant decisions under `docs/adr/` before working in an affected area.
- Read supporting product or analysis documents when an ADR or the glossary routes to them.

If a document does not exist, proceed without suggesting that it be created pre-emptively. Domain
documentation should grow only when a term or decision is actually resolved.

## Use the glossary vocabulary

Use terms exactly as `CONTEXT.md` defines them in issues, PRDs, implementation plans, tests, and code.
Do not replace them with synonyms that the glossary explicitly marks as ambiguous or discouraged.

If a necessary concept is missing, first check whether it is an accidental synonym. If it is a real
domain gap, flag it for resolution rather than silently inventing a competing term.

## Respect ADRs

Surface conflicts with an existing ADR explicitly. Do not silently override a recorded decision. A
change that reopens an ADR must explain why its original evidence or constraints no longer apply.

## Writing an ADR

Which ADR holds now, by area, is `docs/adr/README.md` — it points, it does not restate.

- **새 ADR 은 색인(`docs/adr/README.md`)에 줄을 더하고, 대체하는 ADR 의 머리에 후속 결정 줄을 단다.** 머리 줄은
  `> 후속 결정: ADR NNNN — <무엇이 대체됐나>` 이고 그 ADR 이 통째로 서지 않을 때다 — 그러면 색인에서 그 번호를 걷는다.
  일부만 대체됐으면 `> 후속 결정(일부): …` 로 달고 색인에 그대로 둔다. `scripts/code-rules.test.ts` 가 둘을 잰다.
