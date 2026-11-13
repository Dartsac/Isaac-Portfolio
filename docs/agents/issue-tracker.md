# Issue tracker: GitHub

Issues and specs live in Dartsac/Isaac-Portfolio. Use the `gh` CLI.

## Conventions

- Confirm the target with `gh repo view --json nameWithOwner` before
  the first issue creation of a session. It must be Dartsac/Isaac-Portfolio.
- Create: `gh issue create --title "..." --body "..."`.
  Use a heredoc for multiline bodies.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels`.
  Add label or state filters as needed.
- Comment: `gh issue comment <number> --body "..."`.
- Labels: `gh issue edit <number> --add-label "..."` or
  `--remove-label "..."`.
- Close: post an explanation with `gh issue comment`, then
  `gh issue close <number>`, including when the issue is already closed.
- Sub-issues: use native GitHub sub-issues when supported.
  Otherwise put `Part of #<parent>` at the top of the child body
  and add the child to a task list in the parent.
- Blocking: use native GitHub issue dependencies when supported.
  Otherwise put `Blocked by: #<n>, #<n>` at the top of the child body.
  A ticket is unblocked when all its blockers are closed.

## Skill operations

“Publish to the issue tracker” means create a GitHub issue.
“Fetch the relevant ticket” means read its issue, including comments.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding operations

- Map: one issue labelled `wayfinder:map`, containing
  Notes / Decisions-so-far / Fog.
- Children: link tickets as sub-issues, using the fallback above if needed.
  Label each `wayfinder:<type>`: research, prototype, grilling, or task.
- Frontier: consider open children in map order; skip assigned tickets
  and tickets with open blockers.
- Claim: `gh issue edit <n> --add-assignee @me` as the session's first write.
- Resolve: comment with the answer, close the child, then append
  a summary and link to the map's Decisions-so-far.
