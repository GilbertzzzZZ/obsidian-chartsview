# Code Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five reproduced rendering and input-handling defects without expanding Mosaic's feature set or dependency surface.

**Architecture:** Keep the entry → parse/render direction and repair each defect at its existing boundary. Render tooltip content as text, retain the last accepted chart result, and correct scalar display and two input checks locally. Reuse the existing test harness and isolated Obsidian vault.

**Tech Stack:** TypeScript, JavaScript ES modules, React via Preact compat, `@ant-design/plots`, its locked AntV dependencies, Node's test runner, and esbuild.

**Spec:** The five repair contracts below, constrained by [[AGENTS|AGENTS.md]], [[docs/design/architecture|architecture.md]], [[docs/design/chart|chart.md]], and [[docs/design/data-table|data-table.md]].

## Global Constraints

> This is a bounded repair of a small local plugin, not a framework or tooling project.
> All implementation tasks inherit these constraints.

- **Review baseline:** `main` at `0b2c1359fd7fd11ec46cc171b02f0b21a3bbfc6b`, Mosaic `1.1.5`.
- **Baseline evidence:** 340 tests passed and the production build passed during the audit. These results do not constitute verification of the future fixes.
- **Process scope:** One local Obsidian application session per user/vault, with host-owned section rendering and lifecycle callbacks. No server or cross-process coordination.
- **Users:** The note author/reader encounters rendering behavior. The maintainer owns tests and releases. No centralized multi-user service.
- **Frequency:** Rendering is triggered by note opening, edits, section materialization, theme changes, and width changes. Granularity selection and tooltip hovering are user-paced interactions.
- **Failure cost:** Untrusted note text can execute script in the host, incorrect charts can misrepresent values, and valid content can disappear. Repairs must never alter source notes or dataset files.
- **Dependency limit:** Add zero runtime or development dependencies. Preserve `package.json`, `package-lock.json`, and the existing locked installation workflow.
- **Version floor:** Keep `engines.node` at `>=22`. Retain the existing Node 22/24 CI matrix and `npm ci` installation.
- **Architecture limit:** Do not introduce a sanitizer package, renderer registry, shared state framework, generic CSV abstraction, or new configuration option.
- **Frozen layer:** Do not refactor `src/parse/blocks/`. These repairs do not require changing it.
- **Host invariants:** Preserve `whenHostReady`, stale/unloaded cancellation, in-place theme events, width guards, observer cleanup, and source-view geometry.
- **Chart invariants:** Preserve zero-inclusive domains, negative values, signed stacks, positive headroom, units, series ordering, crosshairs, and hover highlighting.
- **Upstream scope:** Do not change the recorded OpenGlance release baseline. These are local correctness and safety fixes, not an upstream upgrade.
- **Build budget:** Keep `main.js` below the existing 1,800 KiB limit. Do not track generated release assets.
- **Documentation:** This plan is English-only. User guide changes must update English first and then the Chinese mirror with identical code examples. Do not translate existing design documents wholesale.
- **Portability:** All tracked paths are repository-relative. Local vault and deployment paths are supplied through environment variables, never committed.
- **Authority:** Authoring this plan does not authorize implementation, commits, pushes, Issues, pull requests, or releases. Execute the remaining checkboxes only after an implementation instruction.

---

## Repair Contracts and File Map

> Each finding has one independently testable repair and a bounded maintenance cost.
> The plan creates no production modules or new permanent test infrastructure.

### Finding 1: Tooltip text executes as HTML — P1

- **Reproduction:** An image error handler placed in a series label executed on real mouse hover in an isolated Obsidian session. The dependency also assigns tooltip titles through `innerHTML`.
- **Required result:** Tooltip title, name, and formatted value remain literal text for ordinary and combined charts. No note-controlled HTML reaches the dependency's default template.
- **Beneficiary and trigger:** Readers hovering charts containing imported or hand-written labels.
- **Cost boundary:** One private tooltip renderer in `Chart.tsx`, reusing the dependency's existing class names and styles.
- **Review decision (2026-09-07):** Accepted as a security repair, not a demonstrated performance improvement. Display all note-supplied tooltip text literally instead of maintaining a file or executable-content allowlist.
- **Modify:** `src/render/components/Chart.tsx`.
- **Test:** `tests/block-chrome.test.mjs` and actual Obsidian mouse-hover verification.
- **Document:** `docs/design/chart.md`, `docs/guides/chart.md`, `docs/guides/chart-zh.md`.

### Finding 2: Failed granularity selection restores the initial chart — P2

- **Reproduction:** Weekly data → successful monthly view → failed quarterly query restores weekly data while the quarter button stays selected.
- **Required result:** Retain the last successfully built chart, its active granularity, units, warning, and footnote. Show the error locally and clear it after a successful rebuild.
- **Beneficiary and trigger:** Readers switching granularity on a dataset without a complete coarser period.
- **Cost boundary:** Replace the existing requested-granularity/epoch state with an accepted result and a local rebuild callback. Do not modify dataset aggregation.
- **Review decision (2026-09-07):** Accepted as a correctness repair. A rejected selection must retain both the last successful chart and its selected granularity, with a local error message.
- **Performance evidence:** The current component harness recorded two initial builder calls and one plot render. The plan removes the duplicate builder call and avoids passing an unchanged plot configuration through the adapter after a rejected selection. These are planned reductions in work, not measured elapsed-time improvements.
- **Modify:** `src/render/components/ChartFigure.tsx`.
- **Test:** `tests/block-chrome.test.mjs` using the real dataset query and builder.
- **Document:** `docs/design/chart.md`, `docs/guides/chart.md`, `docs/guides/chart-zh.md`.

### Finding 3: Boolean table cells disappear — P2

- **Reproduction:** JSON cells containing `true` and `false` become empty table cells. External boolean dataset fields reach the same view.
- **Required result:** Display `true` and `false` as text, preserve `0`, and keep null or missing cells empty.
- **Beneficiary and trigger:** Readers of JSON tables or typed external datasets containing booleans.
- **Cost boundary:** Convert scalar values to display text at the existing table cell. Do not add badges, switches, or nested-object formatting.
- **Review decision (2026-09-07):** Accepted as a correctness repair, not a performance optimization. Convert boolean values to literal `true` and `false` at the display boundary, preserving numeric zero and empty cells without adding a setting.
- **Modify:** `src/render/components/blocks/DataTableView.tsx`.
- **Test:** `tests/block-chrome.test.mjs` for inline and external inputs.
- **Document:** `docs/guides/data-table.md`, `docs/guides/data-table-zh.md`. Read the existing design contract without adding a duplicate design section.

### Finding 4: Paired tags mishandle single-quoted attributes — P2

- **Reproduction:** `<DataTable title='A > B'>` is not recognized although the attribute parser accepts single quotes. Double quotes inside a single-quoted value also confuse the opening-tag scanner.
- **Required result:** In paired tags, the matching quote character controls where an attribute value ends. Quoted `<` or `>` must remain literal attribute text and must not reject or end the opening tag.
- **Beneficiary and trigger:** Authors using the documented single-quoted attribute syntax.
- **Cost boundary:** Update `matchPaired` quote tracking and restrict the blanket `<` rejection in `parseAttrs` to self-closing tags. Preserve CommonMark paragraph restrictions and all self-closing boundaries.
- **Review decision (2026-09-07):** Accepted with the missing `parseAttrs` adjustment. A scanner-only probe still rejected quoted `<` values, while the combined candidate passed 38 focused parser cases. This is a correctness repair, not a performance improvement, and the probe does not replace implementation or host verification.
- **Modify:** `src/parse/chart-tag.mjs`.
- **Test:** `tests/chart-tag.test.mjs`, `tests/block-entry.test.mjs`.
- **Document:** `docs/guides/tag-syntax.md`, `docs/guides/tag-syntax-zh.md`, `docs/guides/chart.md`, `docs/guides/chart-zh.md`.

### Finding 5: Inline chart CSV silently drops excess cells — P2

- **Reproduction:** Header `period,value` with row `April,1,234` renders the number `1` instead of rejecting the extra field. The external dataset loader's named-header mode already rejects non-empty excess fields; its positional `sourceColumn` mode uses a different projection path and is outside this repair.
- **Required result:** Reject non-empty cells beyond the header width with a row-specific error. Continue accepting empty trailing cells and missing numeric cells.
- **Beneficiary and trigger:** Authors pasting CSV with a missing quote or delimiter mistake.
- **Cost boundary:** Add one guard to `buildChartFromInline`. Do not change the shared delimited parser or the other five block payload contracts.
- **Review decision (2026-09-07):** Accepted as a correctness repair. Reject non-empty excess cells with a row-specific error instead of inferring the author's intended number. Eight focused candidate cases passed without changing production files; no performance gain is claimed.
- **Modify:** `src/render/chart-tag-config.mjs`.
- **Test:** `tests/chart-tag-config.test.mjs`, `tests/block-entry.test.mjs`.
- **Document:** `docs/guides/chart.md`, `docs/guides/chart-zh.md`.

### Integration-only files

- **Create:** `docs/plans/2026-09-07-code-quality-fixes.md`, the implementation scope and execution checklist.
- **Modify after testing:** `AGENTS.md`, only its two test-count mentions.
- **Unchanged:** `tests/helpers/entry.tsx` already exports `unmountRoot`, so the tests only need to import it through the existing harness.
- **Outside this repository:** Existing capability notes and their `.mdx` mirrors in the dedicated test vault. No host fixture paths or environment state enter the public repository.

---

## Execution Preparation

> Verify the checkout and baseline before changing production code.
> Execute Tasks 1–5 in order so shared test and guide edits stay easy to review.

### Step 1: Verify scope and branch

- [ ] Read `AGENTS.md` and its rendering traps, the design documents named in the header, and the affected user guides.
- [ ] Read the four existing files in `docs/policies/` before changing rendered UI. Follow the repository's archived policy constraints without installing a separate lint toolchain.
- [ ] Inspect the checkout and distinguish the main checkout from a linked worktree:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --git-dir --git-common-dir
git worktree list
```

- [ ] Preserve unrelated changes. If already on the named implementation branch, continue there. Otherwise create the task branch from the reviewed base or the committed plan branch:

```bash
git switch -c codex/code-quality-fixes
```

- Do not switch a linked worktree to `main`. If isolation is needed, load `superpowers:using-git-worktrees` before creating a worktree.
- If the base moved, inspect changes to the mapped files and reconcile the plan before running its fixes.

### Step 2: Confirm the baseline

- [ ] Install from the existing lockfile and run the repository's gates:

```bash
npm ci
npm test
npm run build
```

- Expected at the recorded baseline: 340 tests pass, TypeScript checking succeeds, and production bundling succeeds.
- Record the actual Node/npm versions and test count. Stop to identify a pre-existing failure instead of folding unrelated repairs into this plan.
- New test cases increase the baseline count. Update the two numeric test-count mentions in `AGENTS.md` once, during final integration, to the actual final count.

---

## Task 1: Render Tooltip Content as Text

> Close the HTML execution path at the shared chart rendering boundary.
> Keep raw dataset values and canvas labels unchanged.

### Step 1: Add the failing renderer contract test

- **Consumes:** `ChartFigure` and captured plot configurations from the existing `loadComponents()` harness.
- **Produces:** A private `renderTooltipContent(event: unknown, content: TooltipContent): HTMLElement` callback in `Chart.tsx`. It is not exported as a public helper.
- [ ] Add `unmountRoot` to the existing `loadComponents()` destructuring in `tests/block-chrome.test.mjs`, then append this test:

```javascript
test("chart tooltip renders every text field without HTML", async () => {
  const probe = '<img src=data:image/png;base64,invalid onerror=window.__mosaicTooltipProbe=1>';
  for (const chartType of ["Line", "Column", "DualAxes"]) {
    const interaction = {
      tooltip: { shared: true, crosshairs: false, css: { ".g2-tooltip": { color: "red" } } },
      elementHighlight: { background: true },
    };
    const host = chartFigure({ builtExtra: { chartType, config: { interaction } } });
    try {
      await flush();
      const applied = renders.at(-1).config.interaction;
      assert.equal(typeof applied.tooltip.render, "function");
      const { render, ...options } = applied.tooltip;
      assert.deepEqual(options, interaction.tooltip);
      assert.deepEqual(applied.elementHighlight, interaction.elementHighlight);
      const root = render({}, {
        title: probe,
        items: [{ name: probe, value: probe, color: "#123456" }],
      });
      assert.equal(root.nodeType, 1);
      assert.equal(query(root, ".g2-tooltip-title").textContent, probe);
      assert.equal(query(root, ".g2-tooltip-list-item-name-label").textContent, probe);
      assert.equal(query(root, ".g2-tooltip-list-item-value").textContent, probe);
      assert.equal(queryAll(root, "img").length, 0);
      assert.equal(query(root, ".g2-tooltip-list-item-marker").style.backgroundColor, "#123456");
      const values = [0, -2, "12%", "$1,234.50", "A < B & C"];
      const formatted = render({}, {
        title: 0,
        items: values.map((value) => ({ name: "Value", value })),
      });
      assert.equal(query(formatted, ".g2-tooltip-title").textContent, "0");
      assert.deepEqual(
        queryAll(formatted, ".g2-tooltip-list-item-value").map((cell) => cell.textContent),
        values.map(String),
      );
      assert.equal(render({}, { title: "", items: [] }).nodeType, 1);
      assert.equal("render" in interaction.tooltip, false);
    } finally {
      unmountRoot(host);
      host.remove();
    }
  }
});
```

- [ ] Run `node --test --test-name-pattern='chart tooltip renders' tests/block-chrome.test.mjs`.
- Expected failure: the captured configuration has no `interaction.tooltip.render` function.
- The minimal DOM harness does not parse `innerHTML`. Passing this test is necessary, but does not prove the security fix works in Obsidian.

### Step 2: Add one private DOM renderer

- [ ] Add a local input type and callback in `Chart.tsx`. Build elements with `createElement`, write text with `textContent`, and assign colors through a style property:

```typescript
interface TooltipContent {
  title?: unknown;
  items: { name?: unknown; value?: unknown; color?: string }[];
}

function renderTooltipContent(_event: unknown, { title, items }: TooltipContent): HTMLElement {
  const root = document.createElement("div");
  if (title !== undefined && title !== null && title !== "") {
    const heading = document.createElement("div");
    heading.className = "g2-tooltip-title";
    heading.textContent = String(title);
    root.appendChild(heading);
  }
  const list = document.createElement("ul");
  list.className = "g2-tooltip-list";
  for (const item of items) {
    const row = document.createElement("li");
    row.className = "g2-tooltip-list-item";
    const name = document.createElement("span");
    name.className = "g2-tooltip-list-item-name";
    const marker = document.createElement("span");
    marker.className = "g2-tooltip-list-item-marker";
    marker.style.backgroundColor = item.color ?? "black";
    const label = document.createElement("span");
    label.className = "g2-tooltip-list-item-name-label";
    label.textContent = String(item.name ?? "");
    label.title = label.textContent;
    const value = document.createElement("span");
    value.className = "g2-tooltip-list-item-value";
    value.textContent = String(item.value ?? "");
    value.title = value.textContent;
    name.appendChild(marker);
    name.appendChild(label);
    row.appendChild(name);
    row.appendChild(value);
    list.appendChild(row);
  }
  root.appendChild(list);
  return root;
}
```

- Return an element even for an empty tooltip. A string uses HTML parsing, and an absent custom element falls back to the unsafe default template.
- Preserve the `g2-tooltip-*` classes so the dependency applies the existing layout and theme styles to custom content.
- Do not add a second `.g2-tooltip` container, interpolate markup, or escape source labels before they reach the canvas.

### Step 3: Attach the renderer without replacing interaction settings

- [ ] Import `useMemo` in `Chart.tsx` and extend its local `ConfigProps` interface with the interaction shape it actually consumes:

```typescript
interaction?: Record<string, unknown> & {
  tooltip?: Record<string, unknown>;
};
```

- [ ] Inside `Chart`, derive the plot configuration and spread `plotConfig` instead of `config` into `PlotComponent`:

```typescript
const plotConfig = useMemo(() => ({
  ...config,
  interaction: {
    ...config.interaction,
    tooltip: {
      ...config.interaction?.tooltip,
      render: renderTooltipContent,
    },
  },
}), [config]);
```

- Keep `onReady`, `attachSizeGuard`, instance cleanup, and the error boundary unchanged.
- Leave `valueTooltip`, `labelFor`, `toLong`, and combo child mark tooltip definitions unchanged. The callback receives already formatted values and must not reformat them.

### Step 4: Verify and document the boundary

- [ ] Rerun the focused test, then `npm test` and `npm run build`.
- [ ] Complete the real-hover safety checks in Final Integration before declaring this task security-verified.
- [ ] Add this user contract to `docs/guides/chart.md`, then translate the same statement into `chart-zh.md`: “Tooltip titles, series names, and values are displayed as plain text. HTML markup in data or labels is not rendered.”
- [ ] Add a short design rule to `docs/design/chart.md`: HTML tooltip construction belongs at the renderer boundary, while source values and canvas labels remain unchanged. Keep the existing document language.
- [ ] Commit and push only this task's tested files when implementation has been authorized:

```bash
git add src/render/components/Chart.tsx tests/block-chrome.test.mjs docs/design/chart.md docs/guides/chart.md docs/guides/chart-zh.md
git commit -m "fix: render chart tooltips as plain text" -m "Build tooltip content with DOM text nodes at the shared chart boundary.
Preserve interaction styling and formatted values without interpreting labels as HTML."
git push -u origin HEAD
```

---

## Task 2: Keep the Last Accepted Chart on Query Failure

> The accepted chart result determines both the displayed data and selected button.
> A failed query must not re-submit an already consumed configuration to the plot library.

### Step 1: Reproduce the failure using real aggregation

- **Consumes:** The unchanged `buildChartFromTag({ manifest, rows, attributes, granularity })` builder and `ChartFigure`'s existing `initial`/`build` interface.
- **Produces:** Local `rebuild(candidate?: string): boolean`, returning true only when a fresh chart result has been accepted. No new exported interface.
- [ ] Add imports to `tests/block-chrome.test.mjs`:

```javascript
import { parseDatasetManifest, parseDatasetData } from "../src/parse/dataset-loader.mjs";
import { buildChartFromTag } from "../src/render/chart-tag-config.mjs";
```

- [ ] Append a test using one complete month but no complete quarter:

```javascript
test("failed chart granularity keeps the last accepted frame", async () => {
  const manifest = parseDatasetManifest(JSON.stringify({
    schemaVersion: 1, id: "weekly", data: "weekly.csv",
    grain: ["date"], primaryKey: ["date"],
    time: { field: "date", sourceGranularity: "week", weekStartsOn: "monday" },
    fields: [
      { name: "date", type: "date", required: true },
      { name: "value", type: "number", rollup: "sum" },
    ],
  }));
  const rows = parseDatasetData(manifest, [
    "date,value", "2026-03-30,10", "2026-04-06,20", "2026-04-13,30",
    "2026-04-20,40", "2026-04-27,50", "2026-05-04,60",
  ].join("\n"));
  let buildCalls = 0;
  const build = (granularity) => {
    buildCalls += 1;
    return buildChartFromTag({
      manifest, rows, granularity,
      attributes: { type: "line", series: "value", granularityOptions: "week,month,quarter" },
    });
  };
  const host = chartFigure({
    initial: build("week"), build, options: ["week", "month", "quarter"],
  });
  const select = async (value) => {
    queryAll(host, ".mosaic-granularity-btn").find((b) => b.textContent === value).click();
    await flush();
  };
  const active = () => queryAll(host, ".mosaic-granularity-btn")
    .find((b) => b.className.includes("mod-cta")).textContent;
  try {
    await flush();
    assert.equal(buildCalls, 1, "first display must use the already built initial result");
    assert.equal(renders.at(-1).config.data.length, 6);
    await select("month");
    assert.equal(buildCalls, 2);
    const accepted = renders.at(-1).config;
    const footnote = query(host, ".mosaic-figure-footnote").textContent;
    const renderedCount = renders.length;
    assert.deepEqual(accepted.data.map((row) => row.value), [150]);
    await select("quarter");
    assert.equal(buildCalls, 3, "the rejected query is attempted only once");
    assert.equal(active(), "month");
    assert.match(query(host, ".mosaic-error").textContent, /no complete quarter periods/);
    assert.equal(query(host, ".mosaic-figure-footnote").textContent, footnote);
    assert.equal(renders.length, renderedCount);
    assert.equal(renders.at(-1).config, accepted);
    toggle(host, "Copy block report");
    assert.match(clipboard.text, /- granularity: month/);
    assert.match(clipboard.text, /- status: error/);
    toggle(host, "Show source");
    await flush();
    toggle(host, "Show rendered block");
    await flush();
    assert.equal(buildCalls, 4, "returning from source must build a fresh config");
    assert.equal(active(), "month");
    assert.equal(query(host, ".mosaic-error"), null);
    assert.deepEqual(renders.at(-1).config.data.map((row) => row.value), [150]);
    assert.notEqual(renders.at(-1).config.data, accepted.data);
    await select("week");
    assert.equal(buildCalls, 5);
    assert.equal(active(), "week");
    assert.equal(renders.at(-1).config.data.length, 6);
  } finally {
    unmountRoot(host);
    host.remove();
  }
});
```

- [ ] Run `node --test --test-name-pattern='failed chart granularity' tests/block-chrome.test.mjs`.
- Expected failures: the initial builder count is two rather than one, and the later rejected selection activates `quarter` and restores the initial weekly data. Run past the initial-count assertion when isolating the state regression.
- [ ] Cover the guarded source-return failure in `tests/block-chrome.test.mjs`: after entering source view, make the test builder throw on the next rebuild. Assert that source and a local error remain visible with no new plot render. Allow the next rebuild to succeed and assert that a fresh plot appears and clears the error.
- Do not replace this fixture with an oversized day query. The density algorithm can choose a readable granularity instead of throwing.

### Step 2: Store one accepted result

- [ ] Import `useCallback` in `ChartFigure.tsx`. Replace `granularity`, `rebuildEpoch`, and the builder `useMemo` fallback with this state and callback before the effects:

```typescript
const [result, setResult] = useState<{ built: BuiltChart; error?: string }>(
  () => ({ built: initial }),
);
const { built, error } = result;
const rebuild = useCallback((candidate = built.granularity): boolean => {
  try {
    const next = build(candidate);
    setResult({ built: next });
    return true;
  } catch (e) {
    const message = `Mosaic: ${String((e as Error)?.message ?? e)}`;
    setResult((previous) => ({ ...previous, error: message }));
    return false;
  }
}, [build, built.granularity]);
```

- Use the already built, fresh `initial` for first render. Never restore `initial` after a failed interaction.
- [ ] Replace the granularity button props:

```tsx
active={built.granularity}
onSelect={rebuild}
```

### Step 3: Preserve lifecycle rebuilds and the accepted plot

- [ ] In the theme effect use `const onThemeChange = () => { rebuild(); };` and dependency list `[rebuild]`.
- [ ] Replace the width debounce's epoch increment with `rebuild()` and give the width effect dependency list `[rebuild]`. Preserve the 150 ms debounce, 2 px threshold, zero-width guards, and cleanup.
- [ ] Replace `toggleSource` with the following guarded transition:

```typescript
const toggleSource = () => {
  if (showSource) {
    if (rebuild()) setShowSource(false);
    return;
  }
  const measured = contentRef.current?.offsetHeight;
  setSourceHeight(measured && measured > 0 ? measured : undefined);
  setShowSource(true);
};
```

- [ ] Memoize the chart element on the accepted result and source context. Define it before the figure's return and use `plot` in the rendered branch instead of the existing inline `<Chart>`:

```tsx
const plot = useMemo(() => (
  <Chart
    type={built.chartType}
    config={built.config}
    onInstance={(instance) => { plotRef.current = instance; }}
    renderError={(message) => (
      <BlockErrorBox
        message={message}
        onCopy={() => copyToClipboard(formatBlockReport({
          context,
          granularity: built.granularity,
          availableGranularities: built.availableGranularities,
          status: "error",
          error: message,
        }))}
      />
    )}
  />
), [built, context]);
```

- An error-only update retains this element and does not run the plot adapter again. A successful rebuild creates a new `built` and fresh config. Returning from source view also requires a successful fresh build.
- Keep the existing toolbar report, warning, units, footnote, export behavior, and local error box. Correct comments that describe the removed epoch/fallback mechanism.

### Step 4: Verify transitions and update the existing contract

- [ ] Run the new test and the existing “switching back hands the engine a freshly built config” test:

```bash
node --test --test-name-pattern='failed chart granularity|freshly built config' tests/block-chrome.test.mjs
npm test
npm run build
```

- [ ] Complete the theme/width/source/lifecycle checks in Final Integration. A DOM stub cannot validate canvas labels or real observer geometry.
- [ ] Update the existing controlled-rebuild paragraph in `docs/design/chart.md` to state that the accepted result also owns the active button and that errors do not re-consume plot configuration.
- [ ] Add to `docs/guides/chart.md`, then its Chinese mirror: “If a granularity change fails, the last successful chart and its selected granularity remain visible. The block shows the reason, and the next successful rebuild clears the error.”
- [ ] Commit and push this tested task:

```bash
git add src/render/components/ChartFigure.tsx tests/block-chrome.test.mjs docs/design/chart.md docs/guides/chart.md docs/guides/chart-zh.md
git commit -m "fix: retain the last successful chart view" -m "Commit chart data and active granularity only after a successful build.
Keep failed selections local and preserve fresh configs for lifecycle rebuilds."
git push -u origin HEAD
```

---

## Task 3: Display Boolean Table Cells

> The table view displays scalar values without changing source or query data.
> Booleans must not disappear through React's child-rendering semantics.

### Step 1: Add inline and external regression cases

- **Consumes:** Existing `mountBlock`, `renderComponentInto`, `TFile`, and `fakePlugin` helpers in `tests/block-chrome.test.mjs`.
- **Produces:** No new interface. The existing table cells display scalar text.
- [ ] Append these tests:

```javascript
test("DataTable displays inline boolean and zero cells", async () => {
  const host = await mountBlock({ name: "DataTable", body: JSON.stringify([
    { name: "Alpha", enabled: true, amount: 0, note: null },
    { name: "Beta", enabled: false, amount: -2 },
  ]) }, { columns: "name,enabled,amount,note" });
  try {
    assert.deepEqual(queryAll(host, "td").map((cell) => cell.textContent),
      ["Alpha", "true", "0", "", "Beta", "false", "-2", ""]);
  } finally {
    unmountRoot(host);
    host.remove();
  }
});

test("DataTable displays external typed boolean cells", async () => {
  const files = {
    "notes/flags.dataset.json": JSON.stringify({
      schemaVersion: 1, id: "flags", data: "flags.csv",
      grain: ["date"], primaryKey: ["date"],
      time: { field: "date", sourceGranularity: "day" },
      fields: [
        { name: "date", type: "date", required: true },
        { name: "enabled", type: "boolean", rollup: "last" },
      ],
    }),
    "notes/flags.csv": "date,enabled\n2026-04-01,true\n2026-04-02,false",
  };
  const plugin = fakePlugin({ app: { vault: {
    getAbstractFileByPath: (path) => path in files ? Object.assign(new TFile(), { path }) : null,
    cachedRead: (file) => Promise.resolve(files[file.path]),
  } } });
  const host = mountHost();
  try {
    await renderComponentInto(plugin, host, { ...CONTEXT, sourcePath: "notes/report.md" }, {
      name: "DataTable", body: null,
      attributes: { dataset: "flags.dataset.json", columns: "enabled", granularity: "day" },
    });
    await flush();
    assert.equal(query(host, ".mosaic-error"), null);
    assert.deepEqual(queryAll(host, "td").map((cell) => cell.textContent), ["true", "false"]);
  } finally {
    unmountRoot(host);
    host.remove();
  }
});
```

- [ ] Run `node --test --test-name-pattern='DataTable displays' tests/block-chrome.test.mjs`.
- Expected failure: boolean cell text is empty in both cases.

### Step 2: Convert only at the display boundary

- [ ] Replace the table cell expression in `DataTableView.tsx`:

```tsx
<td key={col}>{String(row[col] ?? "")}</td>
```

- Do not mutate `rows`, change CSV number sniffing, or add coercion in the loader. Nested objects remain outside the flat scalar payload contract.
- [ ] Rerun the focused test, `npm test`, and `npm run build`.
- [ ] Add to the payload contract in `data-table.md`, then its Chinese mirror: “Boolean cells from JSON or typed datasets display as `true` or `false`. Null and missing cells remain empty. Numeric zero displays as `0`.”
- [ ] Commit and push this tested task:

```bash
git add src/render/components/blocks/DataTableView.tsx tests/block-chrome.test.mjs docs/guides/data-table.md docs/guides/data-table-zh.md
git commit -m "fix: display boolean table values" -m "Convert scalar table cells to text at the shared display boundary.
Cover inline JSON and typed datasets while preserving zero and empty cells."
git push -u origin HEAD
```

---

## Task 4: Track the Actual Attribute Quote

> Paired-tag recognition must honor the same single- and double-quote syntax as attribute parsing.
> Host paragraph boundaries remain unchanged.

### Step 1: Pin quote parity and malformed boundaries

- **Consumes:** `findComponentTags(source)` and the legacy CSV-only `findChartTags(source)` wrapper.
- **Produces:** No API change. `matchPaired` tracks the active quote character and guards unquoted `<`; `parseAttrs` retains the blanket `<` guard only for self-closing tags.
- [ ] Append to `tests/chart-tag.test.mjs`:

```javascript
test("paired tags preserve both quote styles and quoted delimiters", () => {
  for (const name of COMPONENT_NAMES) {
    for (const [attribute, title] of [
      ["title='A > B'", "A > B"],
      ['title="A > B"', "A > B"],
      ['title=\'A "quoted" < B\'', 'A "quoted" < B'],
      ['title="A \'quoted\' < B"', "A 'quoted' < B"],
      ['title=\'A " > B\'', 'A " > B'],
    ]) {
      const source = `<${name} ${attribute}>\nvalue\n</${name}>`;
      const tags = findComponentTags(source);
      assert.equal(tags.length, 1, source);
      assert.equal(tags[0].attributes.title, title);
      assert.equal(tags[0].end, source.length);
    }
  }
  const chart = "<Chart title='A > B'>\n```csv\nperiod,value\nApril,1\n```\n</Chart>";
  assert.equal(findChartTags(chart)[0].csv, "period,value\nApril,1");
});

test("paired quote tracking still rejects malformed boundaries", () => {
  for (const source of [
    "<DataTable title='unfinished>\nvalue\n</DataTable>",
    '<DataTable title="unfinished>\nvalue\n</DataTable>',
    "<DataTable < title='A'>\nvalue\n</DataTable>",
    "<DataTable title='A > B'>\nvalue",
  ]) assert.deepEqual(findComponentTags(source), []);
});

test("paired quote repair preserves self-closing boundaries", () => {
  for (const attribute of ["title='A > B'", 'title="A > B"']) {
    const tags = findComponentTags(`<DataTable ${attribute} />`);
    assert.equal(tags.length, 1);
    assert.equal(tags[0].attributes.title, "A > B");
    assert.equal(tags[0].body, null);
  }
  for (const source of [
    "<DataTable title='A < B' />",
    '<DataTable title="A < B" />',
    "<DataTable title='A /> B' />",
    '<DataTable title="A /> B" />',
  ]) assert.deepEqual(findComponentTags(source), []);
});
```

- [ ] Append to `tests/block-entry.test.mjs` to exercise takeover, not just parsed attributes:

```javascript
test("single quoted paired table title matches double quoted rendering", async () => {
  for (const title of ["A > B", "A < B"]) {
    const single = await renderTag(`<DataTable title='${title}'>\nname,value\nAlpha,1\n</DataTable>`);
    const double = await renderTag(`<DataTable title="${title}">\nname,value\nAlpha,1\n</DataTable>`);
    assert.equal(queryAll(single, "table").length, 1);
    assert.equal(query(single, ".mosaic-block-title").textContent, title);
    assert.equal(shape(single), shape(double));
  }
});
```

- [ ] Run `node --test tests/chart-tag.test.mjs tests/block-entry.test.mjs`.
- Expected failure: single-quoted delimiter cases yield no tags, and the single-quoted table does not render.

### Step 2: Replace the boolean quote toggle

- [ ] In `matchPaired`, replace `quoted` and the scanner conditions with:

```javascript
let quote = null;
for (; i < source.length; i += 1) {
  const ch = source[i];
  if (quote !== null) {
    if (ch === quote) quote = null;
  } else if (ch === '"' || ch === "'") {
    quote = ch;
  } else if (ch === ">") {
    break;
  } else if (ch === "<") {
    return null;
  }
}
```

- [ ] In `parseAttrs`, replace its initial unconditional `<` guard with:

```javascript
if (selfClosing && inner.includes("<")) return null;
```

- The paired scanner already rejects unquoted `<`. Keeping the unconditional guard would also reject quoted `<` and leave the repair incomplete. Update the comments describing the two boundary checks to match their responsibilities.
- Keep all other malformed-tag checks and `matchSelfClosing` unchanged. Do not introduce escaped-quote syntax or multiline host takeover.
- [ ] Run both focused files, `npm test`, and `npm run build`.
- [ ] In `tag-syntax.md`, clarify that the same quote character closes a paired-tag value and that quoted `<`/`>` remain literal text in paired tags. State that self-closing tags still reject literal `<` and `/>` inside attribute values. Translate the update into `tag-syntax-zh.md`.
- [ ] Correct the contradictory Chart guide note that claims `>` only works in double quotes. Single and double quotes both work. Preserve the separate self-closing `<` and `/>` limitations. Update both Chart guide languages.
- [ ] Commit and push this tested task:

```bash
git add src/parse/chart-tag.mjs tests/chart-tag.test.mjs tests/block-entry.test.mjs docs/guides/tag-syntax.md docs/guides/tag-syntax-zh.md docs/guides/chart.md docs/guides/chart-zh.md
git commit -m "fix: honor paired tag quote boundaries" -m "Track the active attribute quote instead of toggling only double quotes.
Cover parser and entry behavior and align the shared and Chart guides."
git push -u origin HEAD
```

---

## Task 5: Reject Non-Empty Excess Chart CSV Cells

> Invalid inline CSV must produce a local error instead of a plausible but incorrect chart.
> Match the external loader's named-header extra-cell rule without sharing or restructuring its implementation.

### Step 1: Add failing and compatibility cases

- **Consumes:** `buildChartFromInline({ attributes, csv })`, unchanged signature.
- **Produces:** Error `Inline CSV row N contains more values than headers.` with the existing inline row-number convention, including the header row.
- [ ] Append to `tests/chart-tag-config.test.mjs`:

```javascript
test("inline chart rejects non-empty cells beyond header width", () => {
  for (const csv of [
    "period,value\nApril,1,234",
    "period,value\nApril,1,,extra",
  ]) {
    assert.throws(() => buildChartFromInline({
      attributes: { type: "line", series: "value" }, csv,
    }), /Inline CSV row 2 contains more values than headers\./);
  }
  assert.throws(() => buildChartFromInline({
    attributes: { type: "line", series: "value" },
    csv: "period,value\nApril,1\nMay,2,extra",
  }), /Inline CSV row 3 contains more values than headers\./);
});

test("inline chart keeps valid quoting and empty-cell behavior", () => {
  const build = (csv) => buildChartFromInline({
    attributes: { type: "line", series: "value" }, csv,
  });
  assert.deepEqual(build("period,value\nApril,1,, ").config.data.map((d) => d.value), [1]);
  const quoted = build('period,value\n"April, revised",1').config.data[0];
  assert.equal(quoted.period, "April, revised");
  assert.equal(quoted.value, 1);
  assert.deepEqual(build("period,value\nApril\nMay,0\nJune,").config.data.map((d) => d.value),
    [null, 0, null]);
  assert.throws(() => build('period,value\nApril,"1,234"'), /is not a number/);
});
```

- [ ] Append to `tests/block-entry.test.mjs`:

```javascript
test("extra chart CSV cells produce local errors in both entry forms", async () => {
  const csv = "period,value\nApril,1,234";
  const block = await renderCodeBlock("chart", `---\ntype: line\nseries: value\n---\n${csv}`);
  const tag = await renderTag(`<Chart type="line" series="value">\n\`\`\`csv\n${csv}\n\`\`\`\n</Chart>`);
  for (const host of [block, tag]) {
    assert.match(query(host, ".mosaic-error").textContent,
      /Mosaic: Inline CSV row 2 contains more values than headers\./);
    assert.equal(queryAll(host, "[data-plot]").length, 0);
  }
  const valid = await renderCodeBlock("chart", "---\ntype: line\nseries: value\n---\nperiod,value\nApril,1234");
  assert.equal(query(valid, ".mosaic-error"), null);
  assert.equal(queryAll(valid, "[data-plot]").length, 1);
});
```

- [ ] Run `node --test tests/chart-tag-config.test.mjs tests/block-entry.test.mjs`.
- Expected failure: the builder does not throw, and both malformed entry forms render a chart.

### Step 2: Check row width before projecting columns

- [ ] At the start of `dataRecords.map((record, index) => ...)` in `buildChartFromInline`, add:

```javascript
if (record.slice(columns.length).some((value) => String(value).trim() !== "")) {
  throw new Error(`Inline CSV row ${index + 2} contains more values than headers.`);
}
```

- Do not silently truncate, join excess cells, or infer that `1,234` means `1234`. A numeric CSV field must still satisfy the existing numeric contract.
- [ ] Run both focused files, `npm test`, and `npm run build`.
- [ ] Add the exact error and correction to both Chart guide languages: an unquoted `April,1,234` row has an extra cell, and the numeric value should be written `1234`. Explicitly preserve quoted commas in text fields and empty trailing fields.
- [ ] Commit and push this tested task:

```bash
git add src/render/chart-tag-config.mjs tests/chart-tag-config.test.mjs tests/block-entry.test.mjs docs/guides/chart.md docs/guides/chart-zh.md
git commit -m "fix: reject excess inline chart CSV cells" -m "Reject non-empty values beyond the header width before projecting rows.
Preserve empty cells and surface the same local error through both entry forms."
git push -u origin HEAD
```

---

## Final Integration and Verification

> Unit tests prove input and state contracts, while Obsidian proves actual tooltip safety and canvas behavior.
> Do not report unperformed host or platform checks as passed.

### Step 1: Prepare the isolated host checks

- [ ] Locate an existing dedicated test vault and read its `README.md`. Set `MOSAIC_TEST_VAULT` to that vault and `MOSAIC_PLUGIN_DIR` to its Mosaic plugin directory outside this repository.
- [ ] Inspect the vault worktree before changing fixtures:

```bash
git -C "$MOSAIC_TEST_VAULT" status --short
```

- Preserve unrelated notes and `.obsidian/` state. Never deploy test probes into the daily-use vault.
- [ ] Install the tested build using `npm run install:vault`, then reload only Mosaic in the isolated vault using `disablePluginAndSave("mosaic")` and `enablePluginAndSave("mosaic")`.
- [ ] Extend the existing capability notes rather than creating a second fixture hierarchy. Keep each changed `.md` and `.mdx` byte-identical through the vault's existing `sync-mdx.sh` workflow.
- For Chart and DataTable capabilities, retain the four established sections: `代码块 · 内联`, `代码块 · 外部`, `标签 · 内联`, and `标签 · 外部`. Mark source-specific cases explicitly instead of inventing unsupported input forms.
- Do not duplicate pure parser/data tests in the vault. Add only real-hover, canvas-state, boolean visibility, and host takeover assertions.

### Step 2: Prove tooltip safety with real mouse hover

- [ ] Use this synthetic inline probe in the isolated vault. It writes only two in-memory flags and makes no network request:

````text
```chart
---
title: Literal tooltip text
type: bar
series: revenue
revenueLabel: <img src=data:image/png;base64,invalid onerror=window.__mosaicTooltipNameProbe=1>
---
period,revenue
"<img src=data:image/png;base64,invalid onerror=window.__mosaicTooltipTitleProbe=1>",100
May,120
```
````

- [ ] Reset both flags in the isolated host's developer console before each hover:

```javascript
window.__mosaicTooltipNameProbe = 0;
window.__mosaicTooltipTitleProbe = 0;
```

- [ ] Hover the first bar using the real mouse path. Confirm that the tooltip becomes visible and shows the literal title and label strings. An absent tooltip is not a pass.
- [ ] Inspect the actual tooltip and flags:

```javascript
({
  nameProbe: window.__mosaicTooltipNameProbe,
  titleProbe: window.__mosaicTooltipTitleProbe,
  tooltips: [...document.querySelectorAll(".g2-tooltip")].map((element) => ({
    visibility: getComputedStyle(element).visibility,
    text: element.textContent,
    injectedImages: element.querySelectorAll("img").length,
  })),
});
```

- Expected: both flags remain `0`, visible tooltip text contains the literal probe, and `injectedImages` is `0`.
- [ ] Repeat in `.md` and `.mdx`, then in the paired Chart form with a fenced CSV body and a single-line opening tag. Do not put blank lines inside the paired tag.
- [ ] Repeat for `combo` and `combo-dual-axis` by using `bars: revenue`, `lines: rate`, a synthetic numeric `rate` column, and the same label/title probes. Both bar and line items must be safe and visible.
- [ ] Exercise an external dataset label by placing the name probe in a numeric field's `label` in its manifest. Keep the time field valid. Check both the external code block and external self-closing tag forms.
- [ ] Check ordinary, non-probe charts in light and dark themes for marker colors, spacing, shared hover, crosshairs, units, and `%`/currency formatting.
- Delete the two flags from the isolated host console after verification. Do not claim that the stub test or direct callback invocation proves the real hover path.

### Step 3: Verify state, takeover, and lifecycle visually

- [ ] Use Task 2's weekly fixture in the external chart capability note. Select week → month → quarter. Confirm one monthly point with value `150`, the month button still active, and a local incomplete-quarter error.
- [ ] Toggle source → rendered, then select week. Confirm the successful transitions clear the error and restore six weekly values without losing numeric labels.
- [ ] Repeat the accepted monthly view under light/dark changes and narrow/wide note panes. Confirm the active granularity and data stay consistent, and the canvas width follows its visible container.
- [ ] Scroll the chart out of view and back before counting elements. Confirm no permanent empty section, duplicate chart, or lost labels.
- [ ] Disable and enable Mosaic three times in the isolated vault. Confirm the chart returns and registered teardowns do not accumulate.
- [ ] Open a DataTable boolean fixture in both entry forms and file extensions. Confirm `true`, `false`, and `0` are readable, while null/missing cells remain empty.
- [ ] Open single- and double-quoted `A > B` and `A < B` paired-table fixtures in both file extensions. Confirm identical takeover and titles without relaxing the existing single-line/no-blank-line host rules.
- [ ] Check the malformed Chart CSV in both entry forms. Confirm its error box stays at that block and adjacent valid content still renders.

### Step 4: Close automated gates and documentation

- [ ] Run the complete test suite and production build after all five repairs:

```bash
npm test
npm run build
node --input-type=module -e 'import { statSync } from "node:fs"; const bytes = statSync("main.js").size; console.log({ bytes, limit: 1800 * 1024 }); if (bytes > 1800 * 1024) process.exit(1);'
git diff --check
```

- [ ] Update the two test-count mentions in `AGENTS.md` to the measured total. Do not treat the historical count as a quota.
- [ ] Confirm `package.json`, `package-lock.json`, version files, dependency baselines, and unrelated blocks have no changes.
- [ ] Review English/Chinese guide pairs for identical examples and no contradictory quote, tooltip, granularity, boolean, or CSV statements.
- [ ] Confirm all implementation changes are committed before exporting `HEAD`. Only the integration documentation may remain uncommitted:

```bash
git diff HEAD --exit-code -- src tests scripts styles.css esbuild.config.mjs tsconfig.json package.json package-lock.json manifest.json versions.json
```

- [ ] Run a clean locked-install build in a disposable checkout and compare all three release-asset checksums. The temporary directory is local-only and must not be recorded in tracked documents:

```bash
MOSAIC_REPRO_DIR="$(mktemp -d)"
git archive HEAD | tar -x -C "$MOSAIC_REPRO_DIR"
(
  cd "$MOSAIC_REPRO_DIR" || exit 1
  npm ci && npm test && npm run build
)
```

- [ ] After that build succeeds, compare the assets using Node's portable checksum implementation:

```bash
node --input-type=module - "$MOSAIC_REPRO_DIR" <<'JS'
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
const clean = process.argv[2];
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  const actual = hash(file);
  const expected = hash(join(clean, file));
  console.log({ file, actual, expected, equal: actual === expected });
  if (actual !== expected) process.exitCode = 1;
}
JS
```

- Record mismatches rather than substituting an unverified artifact. Do not change the dependency lock to make a comparison pass.
- [ ] Record results in this plan's completed checkboxes and final delivery, without creating another quality report or version-mapping file. Preserve only portable evidence and synthetic examples.
- [ ] After `npm test` and `npm run build` pass, commit/push the final `AGENTS.md` count update and verified plan status as one integration documentation commit. Keep pending review or host checkboxes unchecked:

```bash
git add AGENTS.md docs/plans/2026-09-07-code-quality-fixes.md
git commit -m "docs: record quality repair verification" -m "Update the measured regression-test count and implementation checklist.
Keep host and review evidence distinct from checks that remain unverified."
git push -u origin HEAD
```

### Step 5: Review and delivery gate

- [ ] Run the `review` skill (`/gstack-review`) against the implementation diff. Fix accepted in-scope findings and rerun the affected tests plus full build before proceeding.
- [ ] Apply the small-plugin filter to review findings: identify an actual reader/maintainer, a reachable failure, and a repair whose ongoing cost is justified. Do not expand this plan into speculative infrastructure work.
- [ ] Once implementation and review are approved for shipping, use the `ship` skill (`/gstack-ship`) for commit/push and PR creation. Do not infer permission to merge, tag, or publish a release.
- [ ] Report the branch, verified commit, five repair outcomes, automated test/build results, host version and checks, and every unverified platform or behavior.
- [ ] Apply the repository's completed-plan archival policy only after implementation and verification finish. Do not mark this plan complete merely because the document has been written.

---

## Execution Handoff

> The executor receives this plan as the sole implementation scope, together with the repository rules and an immutable starting point.
> Cross-machine execution requires the plan-containing commit to be pushed first.

- **Recommended:** Use `superpowers:subagent-driven-development` for task-by-task execution and review within this task.
- **Alternative:** Use `superpowers:executing-plans` for inline execution with checkpoints.
- **Another Agent:** First commit and push this plan when authorized, then prepare a handoff prompt containing the actual repository, branch, full plan-containing commit SHA, and `docs/plans/2026-09-07-code-quality-fixes.md`.
- The handoff must require reading `AGENTS.md`, use this plan as the sole implementation scope, and avoid restating its implementation details.
- The handoff must require `/gstack-review`, resolution of accepted findings, and retesting before `/gstack-ship` handles commit/push and PR creation.
- The executor should use the skills' recommended choices within the authorized scope and report the PR, review, tests, and unresolved or unverified items.
- Do not issue a cross-machine handoff with an uncommitted plan or invent a plan-containing commit identifier.

---

## What Already Exists

> Reuse the plugin's existing boundaries, rendering lifecycle, and verification tools.

- **Tooltip integration:** The locked AntV dependency accepts a DOM element through `interaction.tooltip.render`. Reuse that callback and its CSS classes without replacing the plotting library.
- **Accepted table state:** `DataTableFigure` already demonstrates keeping a successful result after a rejected query. Keep Chart's repair local because Chart also owns consumed plot configurations and canvas lifecycle.
- **Input processing:** `scanAttrs` already understands both quote styles. The dataset loader's named-header path already checks excess CSV cells. Repair the missing callers without extracting a shared parser framework.
- **Verification:** Reuse Node's test runner, the existing component/entry harness, and the dedicated Obsidian vault. Keep the Node 22/24 locked-install CI matrix and bundle-size gate unchanged.
- **Delivery:** Reuse existing implementation review and release workflows. This plan produces no new package, deployment process, or version mapping.

---

## NOT in Scope

> These boundaries keep the five approved repairs small and independently verifiable.

- Upstream upgrades, dependency changes, and chart-axis changes are outside the approved local repair scope.
- File allowlists, sanitizer dependencies, shared state infrastructure, new settings, and table widgets are unnecessary for the accepted fixes.
- Self-closing tag expansion, escaped-quote syntax, positional dataset loading changes, and automatic numeric repair are not part of these input contracts.
- Release publication and cross-machine handoff require separate authorization. No new Issues or TODO document are needed for work already captured here.

---

## Review Evidence and Coverage

> The five defects are confirmed, and the user approved each repair individually.
> Planned regression coverage is not executed implementation coverage.

### Factual evidence

- **Finding 1 (confidence 10/10):** `src/render/chart-tag-config.mjs:833` returns ``attributes[`${key}Label`] || key``. The locked tooltip implementation uses `createDOM(substitute(template.item!, datum))` for items and `innerHTML = title` for titles. The earlier isolated Obsidian 1.13.7 audit demonstrated the series-label handler on actual hover.
- **Finding 2 (confidence 10/10):** `src/render/components/ChartFigure.tsx:118` returns `{ built: initial, error: ... }` on failure while the button follows requested granularity. The component replay produced six weekly values, then monthly `150`, then six weekly values with quarter selected and a local error.
- **Finding 3 (confidence 10/10):** `src/render/components/blocks/DataTableView.tsx:96` renders `{row[col] ?? ""}`. Replays of both inline JSON and external typed booleans produced empty cells for `true` and `false` without an error.
- **Finding 4 (confidence 10/10):** `src/parse/chart-tag.mjs:86` toggles only double quotes, while line 172 rejects every `<` in attribute text. The entry replay rendered zero tables for the single-quoted `A > B` and one for its double-quoted equivalent. The approved two-part candidate passed 38 focused parser cases.
- **Finding 5 (confidence 10/10):** `src/render/chart-tag-config.mjs:1245` iterates `columns.forEach` without checking the remaining row cells. Both entry replays rendered value `1` for `April,1,234` without an error. Eight candidate cases verified rejection and compatibility boundaries.

### Code paths and reader flows

- **Legend:** `[EXISTING]` means an existing test or guard, `[PLANNED]` means required implementation coverage, and `[HOST]` means actual Obsidian verification is required.
- **Test map:** Each numbered branch corresponds to its Task above. No coverage percentage is claimed.

```text
Code block / paired tag / external dataset
|
+-- chart-tag.mjs: paired opening-tag scan
|   +-- matching single/double quote -> literal text       [PLANNED T4]
|   +-- quoted < or > -> retain full attribute value       [PLANNED T4]
|   +-- malformed boundary -> decline takeover            [PLANNED T4]
|   +-- self-closing path -> retain its old boundaries    [PLANNED T4]
|   `-- reader opens .md/.mdx -> identical visible title   [HOST T4]
|
+-- chart-tag-config.mjs: inline CSV row projection
|   +-- non-empty extra cell -> local row error, no plot   [PLANNED T5]
|   `-- valid / empty / quoted comma -> existing values   [PLANNED T5]
|
+-- DataTableView.tsx: cell output
|   +-- true / false -> literal text                      [PLANNED T3]
|   `-- zero / null / missing -> 0 / empty / empty         [PLANNED T3]
|
`-- ChartFigure.tsx: accepted chart state
    +-- first display -> consume fresh initial once       [PLANNED T2]
    +-- selection succeeds -> replace chart and button   [PLANNED T2]
    +-- selection fails -> retain accepted frame + error [PLANNED T2]
    +-- source return fails -> retain source + error      [PLANNED T2]
    +-- source return succeeds -> fresh config            [EXISTING + T2]
    +-- theme / width / detach / unload -> safe lifecycle [HOST T2]
    `-- Chart.tsx: tooltip callback
        +-- title present / empty -> heading / no heading [PLANNED T1]
        +-- items / empty list -> always a DOM element    [PLANNED T1]
        +-- marker / formatted value -> preserve display [PLANNED T1]
        `-- actual hover with note-supplied markup        [HOST T1]
```

- **Coverage assessment:** Five defect-specific regression groups are required. The quote repair includes the previously missing second guard and its compatibility checks. The Chart state test also asserts initial build counts and the rejected source-return path.
- **Existing protection:** Tests already cover source round trips, unit visibility, local render errors, retained source context, and scalar/parser boundaries. They did not detect the five audited defects.
- **Scope fit:** There are no LLM calls, servers, database queries, or cross-user operations in these repairs. No evaluations, load-testing service, or additional testing framework is required.
- **Diagram ownership:** Keep the accepted-state flow in this plan. Update existing lifecycle and parser comments where their facts change instead of copying this diagram into five source files.

### Failure modes and performance

- **Tooltip callback:** A missing/string custom result would fall back to HTML interpretation. Task 1 requires an element for every return path, literal text assertions, and real-hover checks. An invisible tooltip is not a passing result.
- **Chart state:** Reusing a consumed configuration can lose labels, and a rejected selection can leave mismatched data and controls. Task 2 tests state/report/config identity and requires host checks for theme, width, and unload behavior.
- **Table output:** Truthy coercion would erase `false` or zero. Task 3 keeps the nullish empty-cell rule and checks both input sources.
- **Tag boundaries:** Fixing only the scanner leaves quoted `<` rejected, while changing the self-closing path would expand scope. Task 4 includes both paired checks and self-closing regression assertions.
- **CSV width:** Silent truncation produces a plausible but incorrect plot, while overly strict width equality rejects accepted empty cells. Task 5 asserts both the local error and retained valid behavior.
- **Performance conclusion:** Only Task 2 removes confirmed duplicate work: two initial builder calls become one, and rejected selections must not rerun the plot adapter. No elapsed-time or memory improvement has been measured for the proposed implementation.
- **Other repairs:** Tooltip DOM creation, scalar conversion, quote tracking, and excess-cell validation are correctness/safety work. They do not justify speedup claims or new caches.
- **Failure coverage status:** No known critical failure path is left without a verification requirement. All implementation and real-host repair checks remain pending.

---

## Implementation Tasks

> Execute the five approved Tasks above without adding another implementation workstream.
> Effort ranges are planning estimates, not measured execution times or performance results.

- [ ] **T1 (P1, human 1-3 hours / agent 20-60 minutes)** — Close the tooltip HTML boundary using Task 1's source, test, and host checks. Surfaced by architecture/security review.
- [ ] **T2 (P2, human 1-3 hours / agent 20-60 minutes)** — Retain the accepted chart and verify build counts using Task 2. Surfaced by architecture/state and performance review.
- [ ] **T3 (P2, human 20-40 minutes / agent 5-15 minutes)** — Display boolean cells using Task 3. Surfaced by code-quality review.
- [ ] **T4 (P2, human 30-60 minutes / agent 10-25 minutes)** — Repair both paired-tag checks and preserve self-closing behavior using Task 4. Surfaced by code-quality and test review.
- [ ] **T5 (P2, human 20-40 minutes / agent 5-15 minutes)** — Reject non-empty excess chart cells using Task 5. Surfaced by code-quality review.
- **Execution lane:** One sequential lane, T1 through T5, followed by Final Integration. The tasks share renderer tests and user guides, so parallel implementation would introduce overlapping edits without removing a dependency.
- **Additional tasks:** None beyond the five approved repairs and their existing integration gate.

---

## GSTACK REVIEW REPORT

> Plan review completed on 2026-09-07 against the recorded baseline.
> Approval of the repair plan does not resolve the existing code defects or authorize release.

| Review | Trigger | Runs | Status | Findings |
| --- | --- | --- | --- | --- |
| Engineering plan | `plan-eng-review` | 1 | CLEAR (PLAN) | Five defects confirmed and five repair decisions accepted, with the incomplete quote repair corrected |
| Baseline code audit | `review` | 1 | ISSUES OPEN (CODE) | One P1 and four P2 defects remain to be implemented |
| Independent plan review | Optional outside voice | 0 | Not run | No independent-review claim |
| Design review | `plan-design-review` | 0 | Not run | Existing appearance is preserved, with real-host checks required |
| Product/DX review | Optional plan reviews | 0 | Not run | No new product or developer workflow introduced |

- **Scope challenge:** Keep all five reproduced repairs, limited to their mapped files and regression checks. No feature or infrastructure expansion.
- **Architecture:** Two accepted contracts, covering the tooltip trust boundary and last-successful chart state.
- **Code quality:** Three accepted input/display repairs, covering booleans, paired quotes, and excess CSV cells.
- **Tests:** Coverage diagram produced for five regression groups. Corrected the incomplete quote repair and made the initial-build and source-return assertions explicit. No unassigned critical verification gap remains in the plan.
- **Performance:** One confirmed duplicate-work opportunity is covered by Task 2. No implementation timing or memory improvement has been measured.
- **Required outputs:** Existing-mechanism and scope sections are present. Five implementation tasks and a QA test-plan artifact were recorded in the review tooling's local project artifacts. No TODO document or Issue was created.
- **Parallelization:** One sequential implementation lane because the repairs share tests and guides.
- **Decision summary:** All five repair contracts were explicitly accepted by the user. The decisions concern repair behavior, not competing coverage levels, so no completeness score is assigned.
- **Fresh baseline validation:** `npm test` passed 340/340 and `npm run build` passed on Node `26.8.1`, npm `11.19.0`. The unchanged bundle is `1,653,514` bytes, below the `1,843,200`-byte limit. The plan's 21 JavaScript/TypeScript/TSX snippets passed syntax checks with interface/JSX fragments placed in their intended enclosing syntax.
- **Verification boundary:** These are baseline results and focused review probes, not results for an implemented repair. The new regression suite, repaired real-hover/canvas behavior, Node 22/24 CI, clean-build equivalence for the repairs, and macOS/Windows/mobile behavior remain unverified.
- **Delivery state:** Only this plan has changed in the repository. It is uncommitted, and no production source, dependency, version, or release was modified. The subsequent implementation must pass its own code review and verification gates.
- **VERDICT:** Engineering plan CLEARED for the five approved repairs, pending an implementation instruction. Code safety and release readiness are not cleared by this plan review.

NO UNRESOLVED DECISIONS
