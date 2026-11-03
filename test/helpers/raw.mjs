// Synthetic measurements, authored by this project, not captured from any website.
export function rawFixture(siteId = "a") {
  const step = siteId === "b" ? 8 : 4,
    ratio = siteId === "b" ? 1.2 : 1.25;
  const values = {
    "background-color": [
      "rgb(255, 255, 255)",
      "rgb(37, 99, 235)",
      "rgb(37, 100, 235)",
      "rgba(0, 0, 0, 0.5)",
    ],
    color: ["rgb(23, 32, 51)", "rgb(187, 187, 187)"],
    "font-family": ["Arial, sans-serif"],
    "font-size": ["16px", `${16 * ratio}px`, `${16 * ratio * ratio}px`, "13px"],
    "font-weight": ["400", "600"],
    "line-height": ["24px"],
    "padding-top": [`${step * 2}px`, `${step * 3}px`, `${step * 4}px`],
    "border-top-left-radius": ["8px", "12px"],
    "box-shadow": ["rgba(0, 0, 0, 0.1) 0px 4px 16px 0px"],
  };
  let id = 0;
  const elements = [],
    decls = [];
  for (const [property, vs] of Object.entries(values))
    for (const value of vs) {
      const eid = id++,
        sid = `desktop-s${id}`;
      elements.push({
        eid,
        tag: property === "background-color" ? "button" : "div",
        role: property === "background-color" ? "button" : "",
        selector: `#e${eid}`,
        bbox: [0, eid * 20, 100, 20],
        textLen: 10,
        hasBgImage: false,
        parentBackground: "rgb(255, 255, 255)",
        styles: { [property]: value },
      });
      decls.push({
        key: property + "|" + value,
        count: 1,
        area: 2000,
        samples: [
          {
            sid,
            eid,
            origin: "regular",
            ruleSelector: `#e${eid}`,
            authoredValue: value,
            stylesheet: "http://fixture.invalid/main.css",
            line: eid + 1,
            column: 1,
          },
        ],
      });
    }
  return {
    schemaVersion: 1,
    siteId,
    url: `http://${siteId}.invalid`,
    finalUrl: `http://${siteId}.invalid`,
    collectedAt: "2026-01-01T00:00:00Z",
    browser: { name: "synthetic", version: "1" },
    viewport: { name: "desktop", width: 1440, height: 900 },
    blocked: { image: 0, font: 0, media: 0 },
    cssVars:
      siteId === "a"
        ? [
            {
              name: "--color-primary",
              value: "#2563eb",
              scope: ":root",
              source: { stylesheet: "main.css", line: 1, column: 1 },
            },
          ]
        : [],
    fonts: [],
    elements,
    decls,
  };
}
