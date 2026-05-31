# CS DM QA Workflow

This document defines the commit and QA workflow for `games/cs-dm/`.

## Commit rules

- Keep every commit atomic and self-contained.
- Make one logical change per commit.
- Verify the change after each commit before starting the next one.
- Do not bundle gameplay, UI, screenshot, and documentation updates into a single commit.

## Required commit trailers

Every commit message must end with these trailers, using real newline-separated lines:

- `LLM-Model: gpt-5.5 (GPT-5.5)`
- `Co-authored-by: @openai <noreply@openai.com>`
- `Co-authored-by: OpenCode <noreply@opencode.ai>`

## Evidence naming

Store task evidence under `.sisyphus/evidence/task-*`.

Use filenames like these:

- `.sisyphus/evidence/task-1-scaffold-load.png`
- `.sisyphus/evidence/task-{N}-{scenario-slug}.txt`
- `.sisyphus/evidence/task-{N}-{scenario-slug}.png`
- `.sisyphus/evidence/task-{N}-{scenario-slug}.mp4`

Keep the task number and scenario slug stable so evidence is easy to audit.

## PR evidence flow

1. Finish one logical commit.
2. Run QA for that commit.
3. Save the evidence under `.sisyphus/evidence/task-*`.
4. Add screenshots or recordings for any visual change.
5. Include the evidence references in the PR description.

## Screenshot requirement

Any visual change must include screenshots or a screen recording in the PR.

Use the screenshots folder for rendered captures when needed:

- `games/cs-dm/screenshots/`

## After-each-commit checklist

- [ ] Commit is atomic and self-contained.
- [ ] QA was run for the exact commit.
- [ ] Evidence was saved under `.sisyphus/evidence/task-*`.
- [ ] Visual changes include screenshots or a recording.
- [ ] PR notes mention the evidence path.
