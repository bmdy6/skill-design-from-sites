# README artwork

Run `node scripts/readme-art.mjs` from the repository root after `npm ci`. The existing browser helper selects an available local browser; `node scripts/doctor.mjs --json` can install the bundled browser if needed.

All 16 PNGs are rendered at 1800 physical pixels from 900 CSS pixel layouts. Each of `hero`, `showcase`, `samples` and `workflow` has light, dark, light.zh-CN and dark.zh-CN variants. Both READMEs reference the complete set via theme-aware pictures. No network assets, external fonts or screenshot inputs are required.

The hero retains the token-to-CSS link design and runs a real extraction against the local fixture, including source verification. The other panels are purpose-made illustrations, not captures of the tool UI. Their four sites, names, writing, landscape and pottery artwork are original fictional demonstrations. The showcase shows an illustrative token excerpt, design rules and the corresponding journal style; it does not claim to be an end-to-end agent run.

The script waits for fonts and rejects horizontal content overflow. Inspect all images at 900px display width after changing copy or layout; the automated checks do not establish visual quality.
