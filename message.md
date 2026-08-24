My notes: 

1. I like the written artifact (spec) -> approval -> plan -> test first -> review

# Superpowers

I generally like the glow of the repo skills of brainstorm -> Write plan -> development -> review -> merge. But the issue that I have it that in one run, we can never build more than a small amount. Its too simple. For a pull product build, we would need to run 10s of different plans to iteratively add complexity rather than doing a complex product build. Additionally, it also assumes each of the plans are generated for junior engineers but I want to use Cursor's agentic capabilities to leverage a team of engineers working together rather than one junior engineer going through each step. I generally like the simplicity of the flow. 

# gstack

I personally haven't used this repo but I like that it turns Cursor/Claude Code's agents into a full engineering organization underneath the user. To me, this is the ideal set up, where I work with an intake agent/chief of staff and it routes and runs plans based on the request. I want to build an organization of agents under me but I want the organization to be written to be token efficient and high quality, which i don't know if this repo is. "boil the ocean" is a concept that the rich can use but I want the org to be build to give me high quality outputs as if we have a team of google engineers. This is where I think the structure and guards looks right but we can learn from other skills. 

# sage-mode architecture

I like building the idea of building a notebook but makes sense on a project scope only, not an organization scope. When we work on a project, the first step should be an intake (like the `office-hours` skill) to align on the goal of the project from a business stand point. This should also run when we do refactors or any major changes. 

I dont want to do "Ceremony is chosen by time budget, not task class." - the goal of the repo is to scale the speed of developing products that we can ship, not to put a timeline on it. 

Actually, I really like the following flow as well.

- `sage-shape`: basically like office-hours but improved. IT asks a question at a time to align on the problem we are trying to solve and what we are trying to build. Imagine this runs at the beginning of a project of when we create a completely new feature. It is a technical -PM interrogation where with one question at a time, really think about what we are building and why. How uses it? What is the ideal flow / user stories? Write it into a doc. This document is a timeline and feature map for the entire project from start to shipping and forms the map of the work we need to do. Every time we write a plan, this document needs to be updates with links to the spec, plans. 
- `sage-plan`: this is a focused version of sage-shape which is focused on a feature itself. This to me is more focused on the feature we are building - think about this as a sprint plan that guides a disciplinary team to build and ship all of the work in a one week sprint. Assume here that we are trying to emulate an engineering organization working in a 1 week sprint where Monday the product team and engineering managers come up with a list of features and bugs they want to fix. The engineering and product org spend Tuesday - Thursday building and testing the feature set and Friday we deploy the changes to prod. So `sage-plan` is meant to emulate the conversation between the product manager and engineering managers to work through the plan for what we need to build. Like office-hours and brainstorm skills, its a one question at the time with the technical PM, senior engineering architect (think Jeff Dean) and myself on trying to figure out what we are trying to build in this chat (think about each chat representing a week). The output, when everyone is aligned, is a written spec document (HTML) and any updates we need to make. 
- `sage-dag` : once we have a spec written, the next job is to come up with the technical spec and sprint plan for our team of coding agents to take on for the rest of the "sprint-week". The goal is another plan document of all of the potential tasks that need to be accomplished and who is responsible as a DAG where tasks in parallel vs tasks that must run in sequence are defined. For each task, one implementer subagent per node with a **file-based brief**, ledger that survives compaction, join-point merges with integration verify.
- `sage-build` : This is like `subagent-driven-development` where the DAG plan gets executed with worktrees per parallel branch and then merge as the tasks get completed with oversite from the manager. Keep track of progress and keep going until the week is done. Think of this as the week of engineering team building and testing the plan. The agents have specialties, they can communicate with each other and get feedback from the manager. They keep building and reviewing until all of the tasks are done and the entire week long features are ready to QA and ship.
- `sage-verify` : This is the post development QA and testing phase where we ensure that everything we have built is ready to ship to production and be in front of active users. If something is not right, give feedback and we can run `sage-build` again to fix it.
- `sage-ship` : Re-verify, changelog/version, PR (don't deploy - we do this manually). Just get the PR with all the notes up. 
- `sage-retro` : at the end of the shipping of a week, do a retrospective to add learnings and update documents. The goal of this step is to make our system better and learn so we are better for the next week of work.

Based on all of this, lets add a couple new pages to the document. 

1. Lets do a deep dive into what the latest version of cursor can do - what are the capabilities and whats possible?
2. Write up a v2 design spec based on my feedback and use cases.

