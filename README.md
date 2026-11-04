# skill-design-from-sites

Extract design tokens you can trace to a selector and CSS line.

[![CI](https://github.com/bmdy6/skill-design-from-sites/actions/workflows/ci.yml/badge.svg)](https://github.com/bmdy6/skill-design-from-sites/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[简体中文](README.zh-CN.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-dark.png">
  <img alt="Accent token linked to main.css" src="docs/readme/hero-light.png" width="900">
</picture>

Live extraction, verified CSS source.

## What you get

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/showcase-dark.png">
  <img alt="Tokens, design rules and a rendered journal page" src="docs/readme/showcase-light.png" width="900">
</picture>

Fictional demo: tokens, rules, rendered page.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/samples-dark.png">
  <img alt="Fictional journal, planner, pottery shop and terminal" src="docs/readme/samples-light.png" width="900">
</picture>

Four styles to explore your taste.

## Quick start

```sh
npx skills add bmdy6/skill-design-from-sites
```

Tell your agent:

> Use design-from-sites with `<url-1>` and `<url-2>`; draft a page.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/workflow-dark.png">
  <img alt="Vote, compare filled layouts, revise a headline" src="docs/readme/workflow-light.png" width="900">
</picture>

Vote → Compare → Revise, with your approval.

## Traceability in 10 lines

`sources.json` example; lines require accessible stylesheets.

```json
{
  "color.accent": {
    "value": "#a34f36",
    "evidence": [{
      "selector": ".cta",
      "stylesheet": "https://journal.example/main.css",
      "line": 42
    }]
  }
}
```

## Commands / options

[Command reference](docs/reference.md) · [Agent workflow](SKILL.md)

| Command / option | Result |
|---|---|
| `extract --url <url> --out <dir>` | Measure; hand off at `next.json` |
| `tokens --out <dir>` | Build from labeled evidence |
| `--mode personal` / `--mode company` | Explore / preserve baseline |
| `scripts/check.mjs --tokens <file> --paths src` | Find off-token CSS values |

## FAQ / limitations

- Runtime ≥ 20; local, no API key.
- Only collects public pages; copies no logos, fonts or images. [Copyright and trademark (not legal advice)](docs/reference.md#copyright-and-trademark-not-legal-advice).
- Unknown evidence IDs fail the build.
- Company mode: existing baseline, external inspiration off.

## License

[MIT](LICENSE).
