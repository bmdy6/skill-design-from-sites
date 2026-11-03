import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFragment, outsideHash } from "../scripts/revise-apply.mjs";
const html =
  '<!doctype html><html><head><title>Fixture</title></head><body><main data-ds-id="ds-1"><section data-ds-id="ds-2"><p>Old</p></section><aside>Keep me</aside></main></body></html>';
test("local replacement keeps all external nodes and rejects wrong root or literals", () => {
  const r = applyFragment(
    html,
    "ds-2",
    '<section data-ds-id="ds-2"><p>New</p></section>',
    {},
  );
  assert.equal(r.hashCheck, true);
  assert.equal(outsideHash(html, "ds-2"), outsideHash(r.html, "ds-2"));
  assert.match(r.html, /<aside>Keep me<\/aside>/);
  assert.throws(
    () =>
      applyFragment(html, "ds-2", '<div data-ds-id="ds-other">New</div>', {}),
    (e) => e.exitCode === 2,
  );
  assert.throws(
    () =>
      applyFragment(
        html,
        "ds-2",
        '<section data-ds-id="ds-2" style="color:#ff0000">New</section>',
        {},
      ),
    (e) => e.exitCode === 1,
  );
});
test("revision cannot add remote resources or collide with an outside ID", () => {
  assert.throws(
    () =>
      applyFragment(
        html,
        "ds-2",
        '<section data-ds-id="ds-2"><img src="https://fixture.invalid/a.png"></section>',
        {},
      ),
    (e) => e.exitCode === 2,
  );
  assert.throws(
    () =>
      applyFragment(
        html,
        "ds-2",
        '<section data-ds-id="ds-2"><p data-ds-id="ds-1">Collision</p></section>',
        {},
      ),
    (e) => e.exitCode === 2,
  );
});

test("revision applies only after both screenshots exist", async () => {
  const fs = await import("node:fs/promises"),
    os = await import("node:os"),
    path = await import("node:path");
  const { write, writeJSON, readJSON, exists } =
    await import("../scripts/lib/io.mjs");
  const { reviseApply } = await import("../scripts/revise-apply.mjs");
  const run = await fs.mkdtemp(
    path.join(os.tmpdir(), "dfs-revise-integration-"),
  );
  try {
    await write(path.join(run, "preview/x.html"), html);
    await writeJSON(path.join(run, "tokens.json"), {});
    await writeJSON(path.join(run, "feedback.json"), {
      items: [
        {
          id: "fb1",
          page: "x.html",
          viewport: "desktop",
          targetIds: ["ds-2"],
          rect: null,
          comment: "Update the copy",
          status: "open",
        },
      ],
    });
    await write(
      path.join(run, "revise/fb1/fragment.new.html"),
      '<section data-ds-id="ds-2"><p>New</p></section>',
    );
    const r = await reviseApply({ run, feedback: "fb1" });
    assert.equal(r.hashCheck, true);
    assert.equal(await exists(r.before), true);
    assert.equal(await exists(r.after), true);
    assert.equal(
      (await readJSON(path.join(run, "feedback.json"))).items[0].status,
      "done",
    );
    assert.equal(
      outsideHash(
        await fs.readFile(path.join(run, "preview/x.html"), "utf8"),
        "ds-2",
      ),
      outsideHash(html, "ds-2"),
    );
  } finally {
    await fs.rm(run, { recursive: true, force: true });
  }
});
