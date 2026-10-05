# Issue tracker: GitHub

Issues and PRDs for this repository live as GitHub Issues. Use the `gh` CLI for all operations.

## Conventions

- Create issues with `gh issue create --title "..." --body-file <file>`.
- Read an issue and its comments with `gh issue view <number> --comments`.
- List issues with `gh issue list`, including labels and comments when the task needs them.
- Comment with `gh issue comment <number> --body "..."`.
- Apply or remove labels with `gh issue edit <number> --add-label "..."` and
  `gh issue edit <number> --remove-label "..."`.
- Close an issue with `gh issue close <number> --comment "..."`.

Infer the repository from `git remote -v`; `gh` does this automatically inside the clone.

## Skill routing

When a skill says to publish to the issue tracker, create a GitHub Issue. When it says to fetch the
relevant ticket, read the corresponding GitHub Issue and its comments.

## Pull requests as a triage surface

**PRs as a request surface: no.** `/triage` reads this flag; this repository does not triage external PRs.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: one issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body
  (`gh issue create --label wayfinder:map`).
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where
  sub-issues are not enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the
  child body. Labels: `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`). Once claimed, the ticket is
  assigned to the driving dev.
- **Blocking**: GitHub's native issue dependencies. Add an edge with
  `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where
  `<blocker-db-id>` is the blocker's numeric database id (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, not the
  `#number` or `node_id`). Where dependencies are not available, put a `Blocked by: #<n>, #<n>` line at the top of the
  child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children, drop any with an open blocker or an assignee; first in map order
  wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer
  (gist + link) to the map's Decisions-so-far.

A child ticket that becomes code work is still delegated as this repository delegates issues — the nine fields and the
permission grades in `docs/agents/delegation.md` hold over the skill.
