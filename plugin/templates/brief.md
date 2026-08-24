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

Write a failing test first. Code written before its test is deleted, not adapted.
Run `sage evidence run --label {{id}} -- {{verify}}`.
Commit per acceptance criterion.
Write `reports/{{id}}.md`.
If you need a file outside owns, write `board/{{id}}.blocker.md` and exit.
