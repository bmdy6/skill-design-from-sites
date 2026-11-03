import { grill } from "./grill.mjs";
import { baselineFromCode } from "./baseline-from-code.mjs";
import { buildTokens } from "./build-tokens.mjs";
import { applyBoss } from "./boss-taste.mjs";
import { consistencyCheck } from "./consistency-check.mjs";
import fs from "node:fs/promises";
import { readJSON, exists } from "./lib/io.mjs";
import { validateBrief } from "./lib/brief.mjs";
import { discover } from "./inspire-discover.mjs";
import { capture } from "./inspire-capture.mjs";
import { board } from "./inspire-board.mjs";
import { tasteBuildFile } from "./taste-build.mjs";
import { requireGate, pendingGate, approveGate } from "./lib/gates.mjs";
import { variants } from "./preview-variants.mjs";
import { checkPaths } from "./check.mjs";
import path from "node:path";
import { cli, writeJSON, fail } from "./lib/io.mjs";
import { doctor } from "./doctor.mjs";
import { collect } from "./collect.mjs";
import { extract } from "./extract.mjs";
import { build } from "./build-tokens.mjs";
import { emit } from "./emit.mjs";
import { verifySources } from "./verify-sources.mjs";
export async function run(o) {
  const step = o._[0],
    out = o.out || ".design-from-sites";
  if (step === "intake") {
    const result = await grill({
      mode: o.mode,
      state: path.join(out, "grill.json"),
      answer: o.answer,
      inferred: o.inferred,
    });
    if (!result.done) {
      const next = { step: "intake", ...result };
      await writeJSON(path.join(out, "next.json"), next);
      return next;
    }
    if (result.brief.mode === "company")
      return pendingGate(
        out,
        "spec",
        "Confirm the specification before design work.",
        ["approve", "revise"],
        "boss",
      );
    const next = { step: "taste", prompt: "prompts/intake.md" };
    await writeJSON(path.join(out, "next.json"), next);
    return next;
  }
  if (step === "boss") {
    const brief = await readJSON(path.join(out, "brief.json"));
    if (brief.mode !== "company")
      fail("Owner preferences are for company mode");
    await requireGate(
      out,
      "spec",
      "Confirm the specification.",
      ["approve", "revise"],
      "boss",
    );
    if (o.none) {
      await writeJSON(path.join(out, "boss-taste.json"), {
        items: [],
        decision: { by: "user", choice: "none" },
      });
      const next = { step: "baseline" };
      await writeJSON(path.join(out, "next.json"), next);
      return next;
    }
    if (!(await exists(path.join(out, "boss-taste.json"))))
      return pendingGate(
        out,
        "boss-taste",
        "Would you like the host to draft owner preferences from its own memory, supply preferences yourself, or proceed without them?",
        ["host draft", "ask me", "none"],
      );
    const next = { step: "baseline" };
    await writeJSON(path.join(out, "next.json"), next);
    return next;
  }
  if (step === "baseline") {
    const brief = await readJSON(path.join(out, "brief.json"));
    if (brief.mode !== "company") fail("Company mode required");
    await requireGate(
      out,
      "spec",
      "Confirm the specification.",
      ["approve", "revise"],
      "boss",
    );
    if (!(await exists(path.join(out, "boss-taste.json"))))
      return pendingGate(
        out,
        "boss-taste",
        "Confirm owner preferences or choose none.",
        ["host draft", "ask me", "none"],
      );
    const source = brief.company.existingPages;
    let e;
    if (o.labels) {
      e = await readJSON(path.join(out, "evidence/baseline.json"));
    } else if (/^https?:\/\//.test(source)) {
      const raws = await collect({ url: source, "site-id": "baseline", out });
      const { extractRaw } = await import("./extract.mjs");
      e = extractRaw(raws);
    } else e = await baselineFromCode({ dir: source });
    await writeJSON(path.join(out, "evidence/baseline.json"), e);
    const color = {};
    for (const role of ["primary", "surface", "text", "text-muted", "border"]) {
      const c =
        e.clusters.color.find((c) => c.cssVar === "--color-" + role) ||
        e.clusters.color.find(
          (c) => role === "text-muted" && c.cssVar === "--color-text",
        );
      if (c) color[role] = c.id;
    }
    if (!Object.keys(color).length)
      for (const [i, c] of e.clusters.color.entries())
        color["value-" + (i + 1)] = c.id;
    const labels = o.labels
      ? await readJSON(o.labels)
      : {
          siteId: "baseline",
          color,
          fontFamily: e.clusters.fontFamily.length
            ? { body: e.clusters.fontFamily[0].id }
            : {},
          shadow: e.clusters.shadow.length
            ? { card: e.clusters.shadow[0].id }
            : {},
          components: {},
          styleSummary: "Existing product baseline",
        };
    await writeJSON(path.join(out, "labels/baseline.json"), labels);
    if (["primary", "surface", "text"].some((role) => !labels.color?.[role])) {
      const next = {
        step: "label-baseline",
        prompt: "prompts/label.md",
        inputs: ["evidence/baseline.json"],
        outputs: ["labels/baseline.json"],
        command: "run.mjs baseline --labels DIR/labels/baseline.json --out DIR",
      };
      await writeJSON(path.join(out, "next.json"), next);
      return next;
    }
    const base = buildTokens(
      [e],
      [labels],
      {},
      { company: brief.company, skipContrast: true },
    );
    await writeJSON(path.join(out, "tokens.base.json"), base.tokens);
    const next = {
      step: "taste",
      inputs: ["evidence/baseline.json", "boss-taste.json"],
    };
    await writeJSON(path.join(out, "next.json"), next);
    return next;
  }
  if (step === "approve") {
    if (!o.gate) fail("--gate required");
    return approveGate(out, o.gate, o.choice);
  }
  if (step === "taste") {
    const brief = validateBrief(
      await readJSON(o.brief || path.join(out, "brief.json")),
    );
    if (brief.mode === "company") {
      await requireGate(
        out,
        "spec",
        "Confirm the specification.",
        ["approve", "revise"],
        "boss",
      );
      if (!brief.company.externalInspiration) {
        const baseline = await readJSON(
          path.join(out, "evidence/baseline.json"),
        );
        let taste = {
          schemaVersion: 1,
          owner: "boss",
          rounds: 0,
          likes: [],
          dislikes: [],
          axes: {},
          references: ["primary", "color", "type"].map((role) => ({
            cid: "baseline",
            url: baseline.url,
            role,
          })),
          rules: [],
          confidence: "medium",
          history: [],
        };
        taste = applyBoss(
          taste,
          await readJSON(path.join(out, "boss-taste.json")),
        );
        await writeJSON(path.join(out, "taste.json"), taste);
        return pendingGate(
          out,
          "taste",
          "Confirm the baseline and owner direction.",
          ["approve", "revise"],
        );
      }
    }
    const dir = path.join(out, "inspire"),
      phase = o.phase || "discover";
    await fs.mkdir(dir, { recursive: true });
    if (phase === "capture") {
      await capture({
        candidates: path.join(dir, "candidates.json"),
        out: path.join(dir, "captures.json"),
      });
      const next = {
        step: "vote",
        prompt: "prompts/taste.md",
        inputs: [path.join(dir, "captures.json")],
        outputs: [path.join(dir, "votes.json")],
      };
      await writeJSON(path.join(out, "next.json"), next);
      return next;
    }
    if (phase === "vote")
      return board({
        captures: path.join(dir, "captures.json"),
        votes: path.join(dir, "votes.json"),
        vote: o.vote,
      });
    if (phase === "build") {
      const taste = await tasteBuildFile({
        captures: path.join(dir, "captures.json"),
        votes: path.join(dir, "votes.json"),
        out: path.join(out, "taste.json"),
        owner: brief.owner,
        boss:
          brief.mode === "company"
            ? path.join(out, "boss-taste.json")
            : undefined,
      });
      if (brief.mode === "company") {
        const baseline = await readJSON(
          path.join(out, "evidence/baseline.json"),
        );
        taste.references = taste.references.map((r) =>
          r.role === "primary" ||
          (r.role === "type" &&
            !brief.company.allowedChanges.includes("fontFamily")) ||
          (r.role === "color" &&
            !brief.company.allowedChanges.some(
              (a) => a === "color" || a.startsWith("color."),
            ))
            ? { cid: "baseline", url: baseline.url, role: r.role }
            : r,
        );
        await writeJSON(path.join(out, "taste.json"), taste);
      }
      if (taste.confidence === "low") {
        const previous = path.join(dir, "candidates.json");
        const saved = await readJSON(previous);
        await writeJSON(path.join(dir, "previous.json"), saved);
        await discover({
          brief: o.brief || path.join(out, "brief.json"),
          sources: o.sources,
          round: taste.rounds + 1,
          "from-votes": path.join(dir, "votes.json"),
          previous: path.join(dir, "previous.json"),
          out: previous,
        });
        const next = {
          step: "capture",
          round: taste.rounds + 1,
          reason: "Low confidence: another round is ready",
        };
        await writeJSON(path.join(out, "next.json"), next);
        return next;
      }
      return pendingGate(
        out,
        "taste",
        "Confirm the inferred design direction.",
        ["approve", "another round"],
      );
    }
    if (brief.references.length) {
      await writeJSON(path.join(dir, "candidates.json"), {
        round: 1,
        sources: [],
        candidates: brief.references.map((r, i) => ({
          cid: "k" + (i + 1),
          siteUrl: r.url,
          host: new URL(r.url).hostname,
          title: r.note || r.url,
          tags: [],
          from: "user",
          galleryUrl: "",
          pickedBy: "reference",
        })),
      });
    } else
      await discover({
        brief: o.brief || path.join(out, "brief.json"),
        sources: o.sources,
        out: path.join(dir, "candidates.json"),
      });
    const next = {
      step: "capture",
      prompt: "prompts/taste.md",
      inputs: [path.join(dir, "candidates.json")],
      outputs: [path.join(dir, "captures.json")],
    };
    await writeJSON(path.join(out, "next.json"), next);
    return next;
  }
  if (step === "preview") {
    if ((await readJSON(path.join(out, "brief.json"))).mode === "company")
      await requireGate(
        out,
        "spec",
        "Confirm specification.",
        ["approve", "revise"],
        "boss",
      );
    return variants({ ...o, run: out, taste: path.join(out, "taste.json") });
  }
  if (step === "build") {
    await requireGate(out, "hifi", "Approve the final draft before building.", [
      "approve",
      "revise",
    ]);
    if (o.paths) {
      const report = await checkPaths(
        [o.paths].flat(),
        await readJSON(path.join(out, "tokens.json")),
      );
      if (report.summary.findings) fail("Code check failed", 1);
      return report;
    }
    const next = {
      step: "build",
      prompt: "prompts/build.md",
      inputs: ["taste.json", "DESIGN.md", "preview/hifi.html"],
      outputs: ["HTML+CSS in target project"],
    };
    await writeJSON(path.join(out, "next.json"), next);
    return next;
  }
  if (step === "extract") {
    if (
      (await exists(path.join(out, "brief.json"))) &&
      (await readJSON(path.join(out, "brief.json"))).mode === "company"
    )
      await requireGate(
        out,
        "spec",
        "Confirm the specification.",
        ["approve", "revise"],
        "boss",
      );
    if (await exists(path.join(out, "taste.json")))
      await requireGate(out, "taste", "Confirm design direction.", [
        "approve",
        "another round",
      ]);
    await doctor();
    const urls = o.url
      ? [o.url].flat()
      : (await readJSON(path.join(out, "taste.json"))).references
          .filter(
            (r, i, a) =>
              a.findIndex((x) => x.url === r.url) === i &&
              /^https?:/.test(r.url),
          )
          .map((r) => r.url);
    if (!urls.length) fail("--url required");
    const ids = [];
    for (const [i, url] of urls.entries()) {
      const id =
        (await exists(path.join(out, "brief.json"))) &&
        (await readJSON(path.join(out, "brief.json"))).company
          ?.existingPages === url
          ? "baseline"
          : String.fromCharCode(97 + i);
      ids.push(id);
      await collect({ url, "site-id": id, out });
      await extract({
        raw: path.join(out, "raw", id),
        out: path.join(out, "evidence", id + ".json"),
      });
    }
    const next = {
      step: "label",
      prompt: "prompts/label.md",
      inputs: ids.map((id) => path.join(out, "evidence", id + ".json")),
      outputs: ids.map((id) => path.join(out, "labels", id + ".json")),
    };
    await writeJSON(path.join(out, "next.json"), next);
    return next;
  }
  if (step === "tokens") {
    const briefFile = path.join(out, "brief.json"),
      brief = (await exists(briefFile)) ? await readJSON(briefFile) : null;
    if (brief?.mode === "company")
      await requireGate(
        out,
        "spec",
        "Confirm the specification.",
        ["approve", "revise"],
        "boss",
      );
    if (await exists(path.join(out, "taste.json")))
      await requireGate(out, "taste", "Confirm the design direction.", [
        "approve",
        "revise",
      ]);
    const built = await build({
      evidence: path.join(out, "evidence"),
      labels: path.join(out, "labels"),
      brief: brief ? briefFile : undefined,
      overrides: o.overrides,
      taste: (await exists(path.join(out, "taste.json")))
        ? path.join(out, "taste.json")
        : undefined,
      out,
    });
    if (!built.ok) fail("Taste checks failed", 1);
    if (brief?.mode === "company") {
      const c = consistencyCheck(
        await readJSON(path.join(out, "tokens.base.json")),
        await readJSON(path.join(out, "tokens.json")),
        o.approved ? await readJSON(o.approved) : [],
      );
      await writeJSON(path.join(out, "consistency-report.json"), c);
      if (!c.ok) fail("New company values require exact approval", 1);
    }
    await emit({ tokens: path.join(out, "tokens.json"), out });
    const r = await verifySources({ run: out, sample: 10, seed: 1 });
    if (r.failures.length || r.sampled < 10)
      fail("Source verification incomplete", 1);
    const next = {
      step: "design",
      prompt: "prompts/design-md.md",
      inputs: ["tokens.json", "sources.json"],
      outputs: ["DESIGN.md"],
    };
    await writeJSON(path.join(out, "next.json"), next);
    return next;
  }
  fail("Expected taste, extract, tokens, preview, approve or build");
}
cli(import.meta.url, run);
