# Brief for node {{id}}

Read this file. Do not expect the contents to be pasted into your prompt.

- DAG: {{dag}}
- Node: {{id}} — {{title}}
- Role: {{role}}
- Owns: {{owns}}
- Reads: {{reads}}
- Acceptance:
{{acceptance}}
- Verify: `{{verify}}`
- Risk: {{risk}}

Constraints bind every node in this DAG, not just this one. They are not
optional and they are not the acceptance list above — treat them as
non-negotiable ground rules for anything you write here.

- Constraints:
{{constraints}}

Interfaces are the contracts this node has with the rest of the DAG. Each
`consumes` line below names the identifier and the node id that produces it —
check that node's brief or diff before you rely on it, do not assume the
shape. A `produces` entry is a promise other nodes are depending on — do not
change its shape without checking who consumes it first.

- Consumes (identifier — produced by):
{{consumes}}
- Produces: {{produces}}

Write a failing test first. Code written before its test is deleted, not adapted.
Run `sage evidence run --label {{id}} -- {{verify}}`.
Commit per acceptance criterion.
Write `reports/{{id}}.md`.
If you need a file outside owns, write `board/{{id}}.blocker.md` and exit.
