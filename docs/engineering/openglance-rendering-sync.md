---
upstream_repository: https://github.com/openglance/openglance
reviewed_ref: v3.2.0
reviewed_commit: 2a8aa91c5a5f89b8f06ac13849096b5122af7db5
---

# OpenGlance rendering sync guide

> OpenGlance is the upstream reference for the shared Chart and content-card rendering contract.
> Mosaic follows observable component behavior and visual semantics while preserving its Obsidian-specific runtime and renderer.

## Scope

> Follow the shared reading experience, not the complete OpenGlance application.

**Follow**

- Keep the six shared component names aligned: `Chart`, `DataTable`, `Timeline`, `DecisionBox`, `MetricGrid`, and `FlowDiagram`.
- Review chart types, series roles, axis roles, units, value labels, highlights, hover feedback, legend semantics, and density limits whenever the upstream renderer changes them.
- Review card hierarchy, spacing, typography, status accents, badge treatment, and empty-state behavior whenever the upstream renderer or component styles change them.
- Review FlowDiagram geometry, edge and arrow treatment, node semantics, text wrapping, minimum canvas width, and overflow behavior.
- Review DataTable layout heuristics and external-dataset display semantics when they change the visible result.

**Adapt to Mosaic**

- Keep AntV as Mosaic's chart renderer instead of copying OpenGlance's static SVG implementation.
- Translate upstream visual tokens to Obsidian CSS variables and preserve light-theme, dark-theme, mobile, and custom-theme behavior.
- Keep Mosaic's tag and code-block entry forms equivalent even though OpenGlance uses MDX-lite tags.
- Preserve Obsidian host-readiness, theme-change, virtualisation, source-view, error-report, and toolbar behavior.
- Preserve documented Mosaic improvements unless an upstream change exposes a real behavioral conflict.

**Exclude**

- Do not follow OpenGlance document tabs, repository navigation, Sync, sharing, desktop packaging, update delivery, or Live editor controls.
- Do not treat an OpenGlance version bump as a rendering change unless one of the watched files or its tests changes the shared visible contract.
- Do not copy files byte for byte. Port the behavior through Mosaic's entry, parse, and render boundaries.

---

## Local upstream checkout

> Use one local clone so every review compares against the same repository and history.

**Location contract**

- The default clone location is `$PROJECTS_ROOT/openglance`; `PROJECTS_ROOT` defaults to `$HOME/projects` and can be overridden on macOS or Linux.
- Reuse an existing clone by setting `OPENGLANCE_REPO`, including one found at `$PROJECTS_ROOT/references/openglance`. Check for an existing clone before creating another; migration does not require moving it to the default location.
- Use repository-relative paths for files inside each repository and `OPENGLANCE_REPO` for the upstream root. Keep machine-specific absolute paths and usernames out of documentation, command examples, and handoff instructions.
- Clone `https://github.com/openglance/openglance.git` into the selected location only when no existing clone is available.

**Refresh commands**

Run the snippets with Bash on macOS or Linux. Set `PROJECTS_ROOT` or `OPENGLANCE_REPO` for the current machine before running them; keep the quoted path variables so directories containing spaces work.

```bash
set -euo pipefail

PROJECTS_ROOT="${PROJECTS_ROOT:-$HOME/projects}"
OPENGLANCE_REPO="${OPENGLANCE_REPO:-$PROJECTS_ROOT/openglance}"

if [ ! -d "$OPENGLANCE_REPO/.git" ]; then
  git clone https://github.com/openglance/openglance.git "$OPENGLANCE_REPO"
fi

test -z "$(git -C "$OPENGLANCE_REPO" status --porcelain)"
test "$(git -C "$OPENGLANCE_REPO" symbolic-ref --short HEAD)" = "main"
test "$(git -C "$OPENGLANCE_REPO" remote get-url origin)" = \
  "https://github.com/openglance/openglance.git"
git -C "$OPENGLANCE_REPO" fetch origin
git -C "$OPENGLANCE_REPO" merge-base --is-ancestor HEAD origin/main
git -C "$OPENGLANCE_REPO" pull --ff-only origin main
```

- Stop before `pull` when the checkout is dirty, detached, or not an ancestor of `origin/main`.
- Confirm the remote URL before updating an existing clone whose origin is not already known.

---

## Authority map

> Compare behavior through these source pairs instead of searching both repositories broadly on every review.

**Chart rendering**

- OpenGlance contract and renderer: `docs/mdx-lite-guide.md`, `src/content/mdx-lite.mjs`, `public/chart-tooltip.js`, and the `.mdx-chart*` rules in `public/styles.css`.
- Mosaic implementation: `src/render/chart-tag-config.mjs`, `src/render/components/Chart.tsx`, `src/render/components/ChartFigure.tsx`, and the `.mosaic-figure*` rules in `styles.css`.
- Mosaic verification: `tests/chart-tag-config.test.mjs` and `tests/block-chrome.test.mjs`.

**Content cards**

- OpenGlance contract and renderer: the DataTable, Timeline, DecisionBox, MetricGrid, and FlowDiagram sections of `src/content/mdx-lite.mjs` plus their `.mdx-*` rules in `public/styles.css`.
- Mosaic implementation: `src/render/components/blocks/`, `src/render/render-component.tsx`, and the matching `.mosaic-*` rules in `styles.css`.
- Mosaic verification: `tests/payload.test.mjs`, `tests/flow.test.mjs`, `tests/table-layout.test.mjs`, and `tests/block-chrome.test.mjs`.

**Data-backed display**

- OpenGlance contract: `src/content/dataset-granularity.mjs`, `src/content/dataset-query.mjs`, `src/server/dataset-loader.mjs`, and `public/dataset-view.js`.
- Mosaic implementation: `src/parse/dataset-granularity.mjs`, `src/parse/dataset-query.mjs`, `src/parse/dataset-loader.mjs`, `src/parse/obsidian-dataset.ts`, and the Chart and DataTable figure components.
- The manifest schema, safe rollups, readable-chart density cap, and visible warnings are shared behavior. File access, caching, and host integration remain runtime-specific.

---

## Current baseline

> The `v3.2.0` review closed existing Mosaic visual gaps; the release delta itself did not change the shared component contract.

**Aligned in Mosaic**

- Chart and shared card headings use the upstream title size, weight, and line height; notes use the upstream readable line height.
- MetricGrid uses the upstream label, value, delta, and note hierarchy.
- Timeline uses the upstream marker alignment, content spacing, heading rhythm, and secondary body color.
- DecisionBox uses the upstream bordered badges and definition-list typography.
- FlowDiagram uses the upstream minimum canvas width, two-axis overflow, arrow color, edge-label weight, node-text spacing, and note rhythm.

**Adapted or retained**

- Chart remains responsive through AntV and Mosaic's width listener instead of inheriting OpenGlance's static SVG minimum width.
- Colors continue to use Obsidian theme variables; typed FlowDiagram nodes retain Mosaic's theme-safe color mixing.
- Mosaic retains the shared outer frame, normal-flow toolbar, source view, warning treatment, and host lifecycle behavior documented in its design guides.

---

## Review procedure

> A review ends only after every upstream rendering change is adopted, adapted, or explicitly excluded by the scope above.

**Compare from the tracked baseline**

```bash
set -euo pipefail

PROJECTS_ROOT="${PROJECTS_ROOT:-$HOME/projects}"
OPENGLANCE_REPO="${OPENGLANCE_REPO:-$PROJECTS_ROOT/openglance}"
REVIEWED_REF="v3.2.0"

git -C "$OPENGLANCE_REPO" diff --name-status "$REVIEWED_REF"..origin/main -- \
  docs/mdx-lite-guide.md \
  docs/mdx-lite-components-demo.mdx \
  src/content/mdx-lite.mjs \
  src/content/mdx-lite-syntax.mjs \
  src/content/table-layout.mjs \
  src/content/table-complexity.mjs \
  src/content/dataset-granularity.mjs \
  src/content/dataset-query.mjs \
  src/server/dataset-loader.mjs \
  public/chart-tooltip.js \
  public/dataset-view.js \
  public/styles.css \
  test/mdx-lite.test.mjs \
  test/chart-tooltip.test.mjs \
  test/table-layout.test.mjs \
  test/table-complexity.test.mjs \
  test/dataset-granularity.test.mjs \
  test/dataset-query.test.mjs \
  test/dataset-loader.test.mjs \
  test/dataset-view.test.mjs
```

**Classify each change**

- Adopt an observable contract when the same author input should produce the same reading meaning in both products.
- Adapt markup, renderer calls, colors, dimensions, and interactions when the host or rendering engine differs.
- Exclude application-shell changes that do not affect a shared component.
- Treat changed upstream tests and fixtures as evidence of intent. Do not infer a contract from a CSS diff alone when the source and tests say otherwise.

**Update the baseline**

- Change `reviewed_ref` and `reviewed_commit` only after all watched changes have a completed disposition.
- Keep the ref in the comparison command identical to the frontmatter value.
- Maintain this engineering guide in English only.

---

## Completion gates

> Rendering alignment requires automated checks and real host evidence in proportion to the change.

**Required**

- Run `npm test`.
- Run `npm run build`.
- Update the affected user guide when supported attributes or visible behavior changes.
- Update the affected design document when the reason for a local adaptation changes.

**Host-visible changes**

- Deploy through `npm run install:vault` only when `MOSAIC_PLUGIN_DIR` points to the isolated test vault.
- Compare the affected Chart or card in light and dark themes at wide and narrow reading-view widths.
- Check scrolling, hover feedback, labels, status colors, and error placement that unit tests cannot prove.
- Do not use a daily-use vault when the isolated test-vault path is unavailable.
