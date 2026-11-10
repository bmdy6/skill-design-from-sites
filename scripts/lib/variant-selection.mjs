import path from "node:path";
import { exists, readJSON, writeJSON, fail } from "./io.mjs";

// Both the command and the voting board must retire approvals before saving a new pick.
export async function selectVariant(run, state, picked) {
  if (!state.variants.some((v) => v.id === picked)) fail("Unknown variant");
  if (state.picked !== picked) {
    const file = path.join(run, "gates.json");
    if (await exists(file)) {
      const gates = await readJSON(file);
      gates.items = gates.items.filter((g) => !["variant", "hifi"].includes(g.step));
      await writeJSON(file, gates);
    }
    state.hifi = { file: null, approved: false };
  }
  state.picked = picked;
}
