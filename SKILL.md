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

## Taste first

Read `prompts/intake.md` and generate brief.json. `scripts/run.mjs taste --out DIR` chooses existing references or metadata discovery; execute capture, vote and build phases in next.json order. Inspiration may load assets for rendering in a temporary context; screenshots live only in the external cache, never in the project. Discovery reads gallery metadata only, checks robots and limits requests. Low-confidence votes prepare another round automatically.

Read `prompts/taste.md`; rules may cite only existing axes and voted IDs. Confirm the **taste** gate with the user's answer before extracting selected references. Each later prompt reads taste.json. Run `scripts/taste-check.mjs --taste DIR/taste.json --tokens DIR/tokens.json`, and repeat with `--html` for drafts because layout axes cannot all be checked from tokens.

`scripts/preview-variants.mjs --run DIR --stage wire` creates the **wire** gate. After approval, `--stage variants` creates three distinct layouts. Personal mode may explicitly skip wire. `--stage pick --pick v1` creates the **variant** gate; after approval `--stage hifi` creates the **hifi** gate. Approve only on a real user answer using `scripts/run.mjs approve --out DIR --gate NAME`. Pending dependent actions exit 3. Final build also requires hifi approval.

Use `scripts/inspire-board.mjs` for local votes and `scripts/taste-share.mjs` for link-and-swatch materials. Never put external screenshots in share documents. Record directional revision feedback in taste history without editing original votes.

## Company owner preferences

First ask the user whether their host agent has owner-preference memory and whether they want a draft. Only the host may prepare that draft, with an explicit source on every item. This skill never reads agent memory files and never accesses external or internal systems for owner preferences. If the user declines, ask them directly using the next-question approach in `prompts/grill.md`.

`scripts/boss-taste.mjs confirm --draft FILE --decisions "1=keep;2=edit:TEXT;3=drop" --out DIR/boss-taste.json` records the user's decisions. Only confirmed entries affect taste, previews, revisions and automatic checks. Preserve unresolved or ambiguous statements as text for the user's review. Confirmed owner preferences take priority over votes; disclose conflicts in taste.md.

## Start by mode

Start with `scripts/run.mjs intake --mode personal|company --out DIR`. `scripts/grill.mjs` persists one answer at a time. Company intake creates the **spec** gate; require its explicit confirmation before baseline, inspiration, tokens or drafts. Then record confirmed owner preferences (or the user's explicit choice of none), run `scripts/baseline-from-code.mjs` through the baseline step when the baseline is local, and derive taste with the existing page fixed as primary. External inspiration is opt-in and can influence only allowed categories.

Run `scripts/consistency-check.mjs --baseline DIR/tokens.base.json --tokens DIR/tokens.json` in company mode and require exact value approval for new values. Preserve `basis` records in merge reports and variants. No external screenshots belong in company specifications, final drafts or share documents. Host intake may use only materials the user supplied; this skill does not search other systems for missing owner opinions.

When revising, re-read the current page and feedback. A changed root ID, duplicate ID, outside-subtree mutation, remote resource or hardcoded design value must fail without applying the fragment. A failed browser or screenshot step leaves the page unapplied and feedback open. Always report failed or unavailable source and visual checks.
