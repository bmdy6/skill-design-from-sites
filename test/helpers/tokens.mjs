import { extractRaw } from "../../scripts/extract.mjs";
import { rawFixture } from "./raw.mjs";
export function inputs() {
  const evidence = ["a", "b", "c"].map((id) => extractRaw([rawFixture(id)]));
  const labels = evidence.map((e) => ({
    siteId: e.siteId,
    color: {
      primary: e.clusters.color.find((c) => c.members.includes("#2563eb")).id,
      surface: e.clusters.color.find((c) => c.value === "#ffffff").id,
      text: e.clusters.color.find((c) => c.value === "#172033").id,
      "text-muted": e.clusters.color.find((c) => c.value === "#bbbbbb").id,
    },
    fontFamily: {
      body: e.clusters.fontFamily[0].id,
      heading: e.clusters.fontFamily[0].id,
    },
    shadow: { card: e.clusters.shadow[0].id },
    components: { button: e.componentCandidates[0].id },
    styleSummary: "Clear and calm",
  }));
  return { evidence, labels };
}
