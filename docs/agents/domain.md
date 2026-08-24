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
