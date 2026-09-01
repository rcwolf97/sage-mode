# Plan Document Reviewer Prompt Template

Use this template when dispatching a plan document reviewer subagent.

**Purpose:** Verify this phase's tickets match the spec section they cover, and that later phases were not smuggled in.

**Dispatch after:** The ticket set for the current phase is written.

```
Subagent (general-purpose):
  description: "Review plan document"
  prompt: |
    You are reviewing this phase's tickets against the spec. Verify they are complete and ready for implementation.

    **Tickets to review:** [TICKET_INDEX_PATH]
    **Spec for reference:** [SPEC_FILE_PATH]
    **Current phase:** [PHASE_ID] in [PLAN_PATH]

    ## What to Check

    | Category | What to Look For |
    |----------|------------------|
    | Completeness | TODOs, placeholders, incomplete tasks, missing steps |
    | Spec Alignment | Tickets cover this phase's spec requirements, not later phases |
    | Task Decomposition | Tickets have clear boundaries, steps are actionable |
    | Buildability | Could an engineer follow this plan without getting stuck? |

    ## Calibration

    **Only flag issues that would cause real problems during implementation.**
    An implementer building the wrong thing or getting stuck is an issue.
    Minor wording, stylistic preferences, and "nice to have" suggestions are not.

    Approve unless there are serious gaps — missing requirements from the spec,
    contradictory steps, placeholder content, or tasks so vague they can't be acted on.

    ## Output Format

    ## Plan Review

    **Status:** Approved | Issues Found

    **Issues (if any):**
    - [Task X, Step Y]: [specific issue] - [why it matters for implementation]

    **Recommendations (advisory, do not block approval):**
    - [suggestions for improvement]
```

**Reviewer returns:** Status, Issues (if any), Recommendations
