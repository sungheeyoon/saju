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
