# Rendering `plan.html`

Load this when executing step 5 of `SKILL.md` — turning a validated
`dag.json` into `docs/sprints/NN-<slug>/plan.md` / `plan.html`.

## Structure, from `templates/plan.md`

The template has four sections; fill each from the validated `dag.json`:

- **Waves.** The output of `sage dag plan`, one line per wave, node ids in
  execution order: `wave 1: n1, n2, n3` / `wave 2: n4, n5`. This is the
  concurrency plan the gate must surface.
- **Nodes.** One entry per node: id, title, role, `owns`, `depends_on`,
  acceptance criteria (as a bullet list, verbatim — do not summarize an
  acceptance criterion, the exact observable wording is what `/sage-build`'s
  Implementer and Reviewer are held to), `verify` command, `risk` level.
- **Verify: none.** Every node whose `verify` field is literally `"none"`,
  listed by id and title. This section exists specifically so it can't be
  missed at the gate — an empty section here is a claim, not an omission, so
  render it even when empty ("No nodes ship without verification this
  sprint.").
- **High-risk nodes.** Every `risk: high` node, listed by id, title, and which
  wave it's in — so the gate reviewer can see at a glance whether D7's
  "no more than two others in the wave" bound is being used at its limit.

## The mermaid DAG

Render the dependency graph as a mermaid `graph TD` (top-down) or `graph LR`
(left-right, often more readable for wide waves) block, one node per `dag.json`
node, edges from `depends_on`. Label each node with its id and a short title
fragment — not the full acceptance text, that belongs in the Nodes table
below the diagram, not crowded into the graph. Color or shape high-risk nodes
distinctly (e.g. a `risk` CSS class or a `:::risk` mermaid class) so the
concurrency plan and the risk list are visually consistent with each other —
a reader should be able to find a high-risk node in the diagram and in the
table without cross-referencing ids by hand.

Keep the diagram to the DAG structure only. Verify commands, exact acceptance
wording, and `owns` globs stay in the tables — a diagram trying to hold all of
that stops being readable at a glance, which defeats the point of rendering
one.

## What NOT to do

Do not render `plan.html` before `sage dag validate` and `sage dag lanes` both
pass clean for every wave. A rendered plan implies "this is presentable" —
rendering a graph that later needs a re-consult wastes the render and risks
the user seeing a stale version if the file isn't regenerated after the fix.
