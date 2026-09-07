---
upstream_repository: https://github.com/openglance/openglance
reviewed_ref: v3.2.0
reviewed_commit: 2a8aa91c5a5f89b8f06ac13849096b5122af7db5
reviewed_track: internal
reviewed_channel: internal-stable
adopted_ref: v3.2.0
adopted_commit: 2a8aa91c5a5f89b8f06ac13849096b5122af7db5
adoption_status: adopted
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

## Release provenance

> This guide is the source record for behavior porting, not a package dependency or a promise of pixel-identical rendering.

Mosaic adapts OpenGlance rendering behavior in its own implementation; it neither imports an OpenGlance package nor vendors a source snapshot. Do not add a synthetic dependency or a second version map. The guide saved in each downstream commit identifies the inspected release and, separately, the adopted baseline. Commits predating this record remain unverified unless historical evidence establishes their source.

**Official evidence checked on 2026-09-07**

- Repository: [openglance/openglance](https://github.com/openglance/openglance).
- Release policy: [the release guide at v3.2.0](https://github.com/openglance/openglance/blob/v3.2.0/docs/release.md) defines separate `public` / `stable` and `internal` / `internal-stable` tracks. Both are stable channels; they are not interchangeable.
- Inspected version: `3.2.0`, track `internal`, channel `internal-stable`. The public `stable` channel still reports `3.0.1`; this review does not describe `3.2.0` as the latest public release.
- Official manifests: [macOS universal](https://updates.mangofuture.com/git-leaf/internal-stable/darwin-universal/latest.json) and [Windows x64](https://updates.mangofuture.com/git-leaf/internal-stable/win32-x64/latest.json). Both reported version `3.2.0`, commit `2a8aa91c5a5f`, build ID `2a8aa91c5a5f.20260906T080733Z.internal`, and publication time `2026-09-06T08:07:33.106Z`. These are mutable channel endpoints; the values recorded here preserve what was checked.
- The manifest commit resolves unambiguously to `2a8aa91c5a5f89b8f06ac13849096b5122af7db5`, exactly matching the peeled `v3.2.0` tag. Its annotated tag object is `d2a218e9c0615b72dacaebaba96ae99410f62b28`.
- A GitHub Release for `v3.2.0` does not exist, and upstream's `package.json` sets `private: true`. Neither GitHub Releases nor npm is a required distribution channel under the upstream release policy; the official stable manifests and source tag provide the release evidence instead.
- Consumed upstream artifact checksum: **not applicable**. No installer or published package is incorporated into Mosaic. The manifests advertise installer checksums, but the installer bytes and signatures were not verified; advertised hashes alone are not download verification.

**Rules for the next upgrade**

- Only adopt an exact version published through an official stable channel. Recheck the upstream release policy and both platform manifests; do not substitute an unpublished branch or commit.
- Resolve the official manifest's commit to a full, unambiguous source commit and compare it with the final tag commit, including annotated-tag peeling. Missing or conflicting evidence blocks adoption; record the unresolved item instead of claiming consistency.
- If integration changes to a package dependency, use an exact direct version, the ecosystem lockfile and its artifact integrity value, and locked installation. If actual upstream files are copied or merged, record their paths, full source commit and local modifications here. Verify any consumed release artifact against its official checksum.
- Record the upstream version, full source commit and verification outcome in the upgrade commit and pull request. Multiple downstream commits can retain one baseline; only an actual adoption changes `adopted_ref` and `adopted_commit`.
- Keep `reviewed_*` as inspection evidence. Advance `adopted_*` only after the watched changes have dispositions and the completion gates pass. A failed or incomplete inspection must not overwrite the last verified adopted baseline.

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
if [ -z "${OPENGLANCE_REPO:-}" ]; then
  if [ -e "$PROJECTS_ROOT/openglance/.git" ]; then
    OPENGLANCE_REPO="$PROJECTS_ROOT/openglance"
  elif [ -e "$PROJECTS_ROOT/references/openglance/.git" ]; then
    OPENGLANCE_REPO="$PROJECTS_ROOT/references/openglance"
  else
    OPENGLANCE_REPO="$PROJECTS_ROOT/openglance"
  fi
fi

if [ ! -e "$OPENGLANCE_REPO/.git" ]; then
  git clone https://github.com/openglance/openglance.git "$OPENGLANCE_REPO"
fi

case "$(git -C "$OPENGLANCE_REPO" remote get-url origin)" in
  https://github.com/openglance/openglance.git|git@github.com:openglance/openglance.git) ;;
  *) echo "Confirm the official upstream remote before continuing." >&2; exit 1 ;;
esac
git -C "$OPENGLANCE_REPO" fetch origin --tags
```

- Fetching preserves the checked-out branch and local edits. Review with `git show` and `git diff` at verified commits; a checkout of `main` is not required.
- If a local tag conflicts with the remote tag, stop and investigate rather than force-updating it. If running the upstream application is necessary, first confirm a clean checkout and use the verified release tag; do not discard local changes.

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

## Inspected rendering changes

> The `v3.2.0` review identified older Mosaic visual gaps; the release delta itself did not change the shared component contract. Adoption status is recorded separately above.

The initial inspection compared `45f61a94873d81eaa9bd18aa97d31239f300080d` with the verified release commit. Among the watched files, only `public/styles.css` changed, and its changes concerned document tabs and the Sync interface, outside Mosaic's scope. The earlier checkout was an inspection starting point, not a previously adopted stable baseline.

**Implemented in Mosaic**

- Chart and shared card headings use the upstream title size, weight, and line height; notes use the upstream readable line height.
- MetricGrid uses the upstream label, value, delta, and note hierarchy.
- Timeline uses the upstream marker alignment, content spacing, heading rhythm, and secondary body color.
- DecisionBox uses the upstream bordered badges and definition-list typography.
- FlowDiagram uses the upstream minimum canvas width, two-axis overflow, arrow color, edge-label weight, node-text spacing, and note rhythm.

**Adapted or retained**

- Chart remains responsive through AntV and Mosaic's width listener instead of inheriting OpenGlance's static SVG minimum width.
- Colors continue to use Obsidian theme variables; typed FlowDiagram nodes retain Mosaic's theme-safe color mixing.
- Mosaic retains the shared outer frame, normal-flow toolbar, source view, warning treatment, and host lifecycle behavior documented in its design guides.
- FlowDiagram canvas sizing is scoped to `.mosaic-flow-scroll > svg`; the shared toolbar's native SVG icons must not inherit the canvas minimum width.
- Card title selectors must outrank Obsidian's `.markdown-rendered h3` rule. Verify computed typography in the host, not just the values declared in the plugin stylesheet.

---

## Review procedure

> A review ends only after every upstream rendering change is adopted, adapted, or explicitly excluded by the scope above.

**Resolve the candidate, then compare fixed commits**

Use the last adopted full commit as `BASE_COMMIT`; for the first review, use the previous inspected full commit and explicitly record that it was not an adopted baseline. Obtain `MANIFEST_COMMIT` from the official metadata, not from the tag itself. The values below reproduce this candidate's source check; replace them together for the next release.

```bash
set -euo pipefail

PROJECTS_ROOT="${PROJECTS_ROOT:-$HOME/projects}"
OPENGLANCE_REPO="${OPENGLANCE_REPO:-$PROJECTS_ROOT/openglance}"
BASE_COMMIT="2a8aa91c5a5f89b8f06ac13849096b5122af7db5"
TARGET_TAG="v3.2.0"
MANIFEST_COMMIT="2a8aa91c5a5f"
TARGET_COMMIT="$(git -C "$OPENGLANCE_REPO" rev-parse --verify "refs/tags/$TARGET_TAG^{commit}")"
RELEASE_COMMIT="$(git -C "$OPENGLANCE_REPO" rev-parse --verify "$MANIFEST_COMMIT^{commit}")"
test "$RELEASE_COMMIT" = "$TARGET_COMMIT"

# Compare remote tag identities too; ^{} peels annotated tags, while a
# lightweight tag already names its commit. Never force a moved local tag.
git -C "$OPENGLANCE_REPO" ls-remote origin \
  "refs/tags/$TARGET_TAG" "refs/tags/$TARGET_TAG^{}"
git -C "$OPENGLANCE_REPO" rev-parse "refs/tags/$TARGET_TAG" "$TARGET_COMMIT"

git -C "$OPENGLANCE_REPO" diff --name-status "$BASE_COMMIT" "$TARGET_COMMIT" -- \
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

- Record the inspected candidate in `reviewed_ref` and `reviewed_commit`, even when adoption is blocked. Keep the last adopted baseline intact until all completion gates pass.
- On adoption, set `adopted_ref`, `adopted_commit` and `adoption_status`, and record host evidence and remaining platform limits below. Keep the fixed comparison example aligned with the adopted commit for the next review.
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

---

## Verification record · 2026-09-07

> The adopted baseline covers the rendering scope above, with the following measured host coverage and explicit limits.

- Rendering revision: `f6ccf0ae112769631b4716e23e1aa64b6d9c3286`. The subsequent provenance-only commit does not change the verified runtime files.
- Locked installation: `npm ci` succeeded without changing the lockfile. All 333 tests passed, including regressions for canvas/icon selector isolation and host heading specificity. TypeScript checking and the production build passed.
- Host: actual Obsidian `1.13.7` on Linux, default light and dark themes, an isolated application profile and a separate synthetic-data test vault. No daily-use vault was used.
- Display matrix: 48 scenarios passed — six component types × `.md` / `.mdx` × two themes × 1200 / 420 px window widths. Chart and DataTable each exercised code-block/tag and inline/external forms; the other cards exercised both entry forms. Fixtures had byte-identical `.md` and `.mdx` pairs.
- Computed titles were `15px`, weight `760`, line height `20.25px` throughout. Native toolbar icons remained `18px`. FlowDiagram retained a `720px` canvas inside a `266px` narrow scroll container; scrolling reached `454px` without widening the page. Status accents, timeline spacing, badges, diagram labels, arrows and node notes were inspected in the rendered output.
- Chart hover displayed the expected date, series and value in both themes. In-place theme switching retained the same figure with four chart canvases and no error boxes. Source/rendered toggles preserved titles and units and restored the rendered content. A deliberate invalid block showed one local error followed by a healthy card in both file formats and both themes.
- Limits: no macOS, Windows, mobile-device or custom-theme runtime verification; no exhaustive pixel comparison with the OpenGlance application. Upstream installer bytes/signatures were not checked because no installer is consumed. No Mosaic release was published, so release-tag/build-commit equality remains a publishing gate rather than a completed release verification.
