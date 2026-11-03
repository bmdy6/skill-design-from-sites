---
name: design-from-sites
description: Use when a user wants a design system grounded in reference pages, traceable design tokens, visual approval and focused revisions before building HTML and CSS.
---

# Design from sites

Only collect publicly accessible pages. Never reuse a logged-in browser profile or ask for cookies. Never download source artwork, fonts, logos, SVG or video. Use original gray placeholders and locally installed Lucide icons in previews. Runtime outputs belong in the user's `.design-from-sites/`; suggest adding that directory to `.gitignore`.

1. Confirm the purpose and reference URLs with the user. Run `scripts/doctor.mjs --json` to install dependencies and Chromium automatically.
2. Run `scripts/run.mjs extract --url URL --out DIR` once references are selected. It collects desktop and mobile measurements and stops at `next.json`.
3. Read `prompts/label.md`. Write the requested labels using only existing evidence IDs. **Never supply numerical design values.** `scripts/build-tokens.mjs` fills values from evidence. Unknown IDs fail with exit 2.
4. Run `scripts/run.mjs tokens --out DIR`. This builds, emits and reopens sources to verify declarations. Read `merge-report.json` and disclose any derived contrast fixes or low confidence records.
5. Read `prompts/design-md.md` and produce DESIGN.md using token names. Run `scripts/lint-design-md.mjs --file DIR/DESIGN.md --tokens DIR/tokens.json`.
6. Read `prompts/preview.md` and create local HTML and CSS drafts. Run `scripts/preview-prepare.mjs --file DIR/preview/x.html --tokens-css DIR/tokens.css`; no external resources. Serve previews with `scripts/preview-serve.mjs --dir DIR --feedback DIR/feedback.json`.
7. Obtain user approval before the final draft or build. A pending gate uses exit 3; approval must be explicit. Never infer approval from silence.
8. For local feedback, run `scripts/revise-extract.mjs --run DIR --feedback ID`, follow `prompts/revise.md`, then `scripts/revise-apply.mjs --run DIR --feedback ID`. Preserve the root ID; review before/after screenshots and the outside hash check.
9. After final approval, follow `prompts/build.md` to write HTML and CSS in the target project. Run `scripts/check.mjs --tokens DIR/tokens.json --paths PATH --format json`, plus the project's existing build/tests. Source verification is `scripts/verify-sources.mjs --run DIR --sample 10 --seed 1`.

If a gate is unresolved, stop the dependent action, write the next question and options to next.json, and continue only after the user answers. Reference evidence, labels and tokens are distinct; do not replace missing evidence with inferred values.
