# Prompt-eval checklist

Dispatched whenever the diff touches prompts, agent logic, or model-calling
code (the same scope `implementer-ai` builds against). Judges a prompt/eval
change the way `correctness` judges code — against evidence, not against
whether the new wording merely *sounds* like an improvement.

- Does the diff include a baseline eval score recorded before the change, or
  is the "improvement" claimed with nothing to compare against?
  `implementer-ai`'s own Notes rule applies here too: "it felt better" is
  not evidence.
- Was the eval run against the same representative input set before and
  after, or does the after-run use a cherry-picked or narrower set that
  would inflate the score?
- A prompt change that improves the eval's target metric but plausibly
  regresses something the eval suite doesn't measure (tone, refusal rate,
  latency, token cost) — flag the gap, not just the number that moved.
- Hardcoded few-shot examples or magic phrases added to pass a specific eval
  case, rather than a change that generalizes past the exact cases in the
  suite.
- Does the diff change what a downstream caller can assume about output
  shape (a schema, a required field) in a way nothing else in the diff
  updates to match?
- Cost/latency delta from a model or prompt-length change: is it named, or
  did the diff silently make every call slower/more expensive?
