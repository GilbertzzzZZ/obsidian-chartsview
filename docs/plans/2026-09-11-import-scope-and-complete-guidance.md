# Mosaic Import Scope and Complete Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Make the destination of every import explicit, keep vault imports as the default, offer optional desktop global skills, and distribute a complete Mosaic authoring reference.

**Architecture:** Extend the existing guide installer and ownership policy with an explicit scope and a custom skill destination. Keep vault IO on Obsidian APIs; isolate desktop-only directory selection and filesystem operations in one module. Retain a single English source body shared by skill and ordinary-document outputs.

**Tech Stack:** Existing TypeScript, Obsidian 1.13.0 APIs, desktop-gated Node APIs and native folder dialog, Web Crypto, esbuild and node:test; no added dependencies.

**Spec:** The user-approved behavior contract below supersedes the installation UI, vault-only scope and concise-content assumptions in `docs/plans/2026-09-10-agent-guide-installation.md`. Existing file-protection and update guarantees remain binding. The user approved desktop-only global import while mobile retains vault import.

## Global Constraints

> These requirements bind every task and its review.

- One plugin instance per open vault; one local operator per instance. Different vaults can encounter the same global skill; no distributed locks or background services.
- Imports run on a user click; automatic maintenance runs once per plugin load on recorded destinations only, at most seven target/scope pairs. No timers or scans.
- A failed import preserves existing content and does not prevent rendering or other imports. Overwriting user edits is unacceptable.
- Default scope is the current vault. Global import requires the desktop-only switch and a subsequent button click. Switching scope alone never writes, moves or deletes files.
- Global scope selection, custom global directory and global installation records stay in vault-specific, device-local `App.loadLocalStorage` / `App.saveLocalStorage`, not synchronized plugin data.
- Vault paths remain relative. Runtime desktop paths are resolved on the current device, never copied into public source, documentation or fixtures.
- Keep `minAppVersion: 1.13.0`, `isDesktopOnly: false`, esbuild target `es2017`, and the existing package manager and dependency set. Node/Electron modules may only load behind a desktop guard.
- Do not modify parse/render semantics or `src/parse/blocks/`. Describe only capabilities verified in Mosaic, not unsupported upstream features.
- One complete English body in `src/agent-guide/mosaic.md`, independently usable outside the development repository. Installation docs remain paired English/Chinese; engineering docs English only.
- No network requests, telemetry, scripts in generated guidance, global client configuration edits, automatic agent launch, new registries or generic plugin framework.
- All public examples are newly invented English data. Do not copy private repository text, business data, paths, identities or organization-specific rules.
- Before each commit run the full tests and production build. Deliver via task branch, local merge to main, push and verified CI. No PR, tag or release unless explicitly requested.

---

## Approved Behavior Contract

> Import controls must make the root directory and artifact type unambiguous.

### Skill imports

- Use a native settings group heading `Import skill`.
- Provide a `Global` switch, default off, desktop only. The visible scope explanation says `Current vault` or `User home (global)` and each result includes its destination.
- Buttons are exactly `to .agents`, `to .claude`, `to path`.
- Vault standard destinations: `.agents/skills/mosaic/SKILL.md` and `.claude/skills/mosaic/SKILL.md`.
- Global standard destinations: the current user's home directory plus those same relative suffixes. Do not use the process working directory or the development repository as the root.
- `to path` imports into a selected skill parent directory, appending `mosaic/SKILL.md`. A vault-relative folder control is used in vault mode; a native desktop directory picker is used in global mode. Cancellation causes no write or record change.
- The vault custom skill parent defaults to `.agents/skills`. The global custom skill parent defaults to the current home directory's `.agents/skills`; selecting a different folder affects only the next custom import.
- Previously imported vault and global skills may coexist. Changing the selection does not revoke prior installation records or relocate existing files.

### Ordinary guide imports

- Use a native settings group heading `Import guides`.
- The folder field defaults to `docs/guides`; clicking `Import` without prior configuration creates `docs/guides/Mosaic-Usage-Guide.md` inside the current vault.
- The folder field uses Obsidian's native folder control, including vault root. Changing the field alone does not write.
- Guides always stay vault-relative, independent of the skill Global switch.
- Existing saved guide folders and installation records remain valid, including an explicitly chosen empty/root folder. Only absent configuration adopts the new default.

### Ownership and lifecycle

- Preserve the original behavior: no import before opt-in; manual-only creation; no automatic recreation after delete/rename; no overwrite of modified/unowned files; exact bytes cause no rewrite; higher-version records prevent downgrades; one busy flag; unload guards; failures stay local to their destination.
- Add scope to results and record lookup so vault/global results cannot overwrite each other's status.
- Existing `agents`, `claude`, `custom` records in plugin data remain vault records; `custom` continues to mean the ordinary guide. Add `skillPath` for the custom skill parent.
- Device-local global state has records only for the three skill targets. Synced plugin data cannot authorize global access on a new device.
- Validate standard global records against their fixed target in the current device's home. Validate custom global records as normalized absolute paths ending in `mosaic/SKILL.md`; the device-local successful record is the authorized previous destination, independently of the next selected parent. Do not add a duplicate saved-parent field or rebuild an old destination from the new selection.
- Desktop creation must not overwrite a file that appeared after checking. Desktop replacement checks current content and commits a completed temporary sibling file; failure preserves the original. Do not follow a final-file symlink as an owned file.
- If another vault updated a shared skill, unchanged desired bytes are accepted; otherwise preserve differing unowned content. No attempt to coordinate independent vault processes.
- Missing native desktop facilities produce a readable error, not a plugin-load failure. Mobile never loads desktop modules, visits global records, or exposes the Global switch.

### Complete authoring content

- Both artifact types carry the full reference, not a short skill that depends on another file or a developer-only link.
- Explain when ordinary Markdown is sufficient and when each of the six components adds value.
- Cover every supported user-facing attribute, aliases where useful, required fields, defaults, accepted data forms, empty values, status semantics and unsupported combinations.
- Include runnable examples for all chart types, multi-series, grouped/stacked bars, combo, dual-axis, series labels/colors, units, value labels and highlight behavior actually supported by Mosaic.
- Give worked card/table/timeline/decision/flow examples beyond minimal rows, including formatting, status, notes, graph connections and fallbacks.
- Explain code blocks, paired tags, self-closing external references and host paragraph boundaries; distinguish inline Chart CSV from external data and other block payloads.
- Provide complete external manifest/data/note examples, paths, dates, grain/key rules, numeric formats, source-column mapping, missing values, range selection, aggregation meaning and unsupported granularities.
- Include symptom/cause/fix troubleshooting and an authoring/verification checklist. Explain zero-inclusive Y bounds, unsupported manual limits, no invented data or rollup definitions, no executable MDX/JS.
- Use local public Mosaic guides and actual parser/render behavior as authority. A private reference was consulted for explanatory depth only and is not a copied source or public dependency.

---

## Implementation Tasks

> Tasks 1 and 2 have disjoint source/test ownership and can run in parallel. Task 3 consumes Task 1's interface. Task 4 follows their integrated behavior.

### Task 1: Scoped installation and desktop boundary

**Files:**
- Modify: `src/agent-guide/core.mjs`, `src/agent-guide/installer.ts`, `src/settings.tsx` (types/defaults only), `esbuild.config.mjs` (desktop external only if needed).
- Create: `src/agent-guide/desktop.ts`.
- Test: `tests/agent-guide-policy.test.mjs`, `tests/agent-guide-installation.test.mjs`, `tests/agent-guide-desktop.test.mjs`.
- Test helpers: `tests/helpers/bundle.mjs`, `tests/helpers/entry.tsx`, `tests/helpers/obsidian-stub.mjs` only where this task needs a real boundary substitute.

**Interfaces:**

```ts
type GuideScope = "vault" | "global";
type GuideTarget = "agents" | "claude" | "skillPath" | "custom";
// Preserve existing InstallRecord fields and GuideStatus values.
type GuideResult = { target: GuideTarget; scope: GuideScope; path: string;
  status: GuideStatus; message?: string };
// Existing guideFolder, guideInstalls and showExportBtn remain.
// Add settings.skillFolder (vault-relative).
class GuideInstaller {
  global: boolean;       // backed by device-local state; false on mobile
  globalSkillFolder: string; // device-local, never synced
  busy: boolean;
  install(target: GuideTarget, scope?: GuideScope): Promise<GuideResult>;
  getResult(target: GuideTarget, scope?: GuideScope): GuideResult | undefined;
  getRecord(target: GuideTarget, scope?: GuideScope): InstallRecord | undefined;
  setGlobal(enabled: boolean): void;
  setGlobalSkillFolder(folder: string): void;
  chooseGlobalSkillFolder(): Promise<string | null>;
  updateInstalled(): Promise<void>;
  dispose(): void;
}
```

- `scope` defaults to `vault` for backward compatibility; UI always passes it explicitly. `custom` with `global` returns an error.
- Keep legacy `results` available for vault results until Task 3 migrates UI consumers; no duplicated decision logic.
- `desktop.ts` owns runtime-only home resolution, native picker and safe file IO. It does not choose UI scope or update persisted records.

- [x] **Step 1: Extend policy and service tests first.** Cover these literal outcomes, using the existing in-memory vault fixture and actual temporary directories for desktop IO:

```js
assert.equal(guideTargetPath("skillPath", "skills"), "skills/mosaic/SKILL.md");
assert.equal(guideTargetPath("custom", "docs/guides"),
  "docs/guides/Mosaic-Usage-Guide.md");
// Service scenarios: global false after fresh load; no startup IO without records;
// vault imports retain relative roots; selecting global alone writes no files;
// desktop global import uses a temporary home, not the real user's directories;
// mobile cannot import global or require desktop dependencies;
// local storage state is separate from saveSettings/plugin data;
// existing root guide records survive; absent folder defaults to docs/guides;
// user edits, missing targets, save failure, higher version, unload and busy retain protection.
```

- [x] **Step 2: Run focused tests and retain expected failure evidence.** `node --test tests/agent-guide-policy.test.mjs tests/agent-guide-installation.test.mjs tests/agent-guide-desktop.test.mjs`.
- [x] **Step 3: Implement the interfaces and concrete desktop IO boundary.** Reuse the existing hash/decision policy. Use `App.loadLocalStorage` / `saveLocalStorage` for desktop state. Gate runtime `require` with `Platform.isDesktopApp`. Native picker: dynamically load `@electron/remote` and call `dialog.showOpenDialog({properties:["openDirectory","createDirectory"]})`; handle absent module/cancel gracefully. Declare this host-supplied module external, not a dependency. Keep IO and local-storage failures visible and records unchanged on failure.
- [x] **Step 4: Verify the real filesystem boundary.** Test temporary-root creation, repeat import, modified file preservation, final-file symlink refusal, canceled picker, write failure preserving old bytes, and that plugin data contains no global path/authorization. Test runtime loading with desktop capabilities unavailable.
- [x] **Step 5: Run full tests/build, self-review and commit only owned files.** Report new interface details to the controller before Task 3 starts. Do not push or merge from a worker.

### Task 2: Complete independent authoring reference

**Files:**
- Modify: `src/agent-guide/mosaic.md`, `tests/agent-guide-content.test.mjs`.
- Read: the eight English guides `chart.md`, `data-table.md`, `metric-grid.md`, `timeline.md`, `decision-box.md`, `flow-diagram.md`, `dataset-guide.md`, `tag-syntax.md`, plus exact implementation where a guide omits or contradicts a contract.

**Interfaces:**
- Consumes: the existing Markdown text loader and `createBlockProcessor` test fixture.
- Produces: one complete English Markdown body, kept compatible with `renderGuide(body, version)` for every target/scope.
- No loader/helper or installer changes in this task. Preserve the existing recognizable section names where tests use them, or update the extraction in this test file only.

- [x] **Step 1: Add behavior-oriented example coverage before expansion.** Use extracted actual examples rather than separately handwritten substitutes. Prove initially missing advanced scenarios with literal expectations:

```js
const types = new Set(chartExamples.map(source => parseBlockSource(source).attributes.type));
for (const type of ["line", "bar", "grouped-bar", "stacked-bar", "combo", "combo-dual-axis"])
  assert.ok(types.has(type), `guide has no runnable ${type} example`);
// Render every runnable component example from the body with the existing real entry.
// Assert expected component exists, .mosaic-error absent and .mosaic-figure-warning absent.
// External examples use their actual bundled manifest/data, never an unrelated test fixture.
```

- [x] **Step 2: Run `node --test tests/agent-guide-content.test.mjs` and record missing-scenario failures.** Keep tests of executable examples and meaningful generated behavior; avoid adding brittle verbatim-prose snapshots.
- [x] **Step 3: Write the complete reference described in the approved contract.** Cover attribute names/types/defaults and realistic worked examples; explain choice/tradeoffs and diagnose common mistakes. Reuse only public Mosaic semantics, invent all example data, and keep all paths relative. Skills must teach complete supported capability without source-repository access.
- [x] **Step 4: Run extracted examples through actual parsing/rendering and verify dataset references.** Label deliberate negative examples separately so they are asserted as failures, not silently skipped. Preserve unsupported-bound protection; ensure the guide cannot teach `yMin`, `yMax`, executable JS or unsupported external cards.
- [x] **Step 5: Run full tests/build, self-review coverage and commit only the body/test.** Include an exact coverage map in the private task report: requested topic, body section, example/test evidence. No public duplicate reference file.

### Task 3: Explicit import controls

**Files:**
- Modify: `src/settings.tsx`, `tests/agent-guide-settings.test.mjs`.
- Test helpers only if needed: `tests/helpers/obsidian-stub.mjs` after Task 1 has completed ownership.

**Interfaces:**
- Consumes: Task 1's `GuideScope`, installer accessors, local scope setters, native global picker, and persisted vault skill/guide folders.
- Produces: two native settings groups and scope-specific status/messages; existing export button remains unchanged.

- [x] **Step 1: Add failing settings tests for these exact UI contracts.** Native group structure:

```ts
{ type: "group", heading: "Import skill", items: [/* Global, folder, actions */] }
{ type: "group", heading: "Import guides", items: [/* folder, Import */] }
```

- Verify `to .agents`, `to .claude`, `to path` route their correct target plus chosen scope; `Import` always uses `custom`/`vault`. Verify absent settings import to `docs/guides` without first editing the folder.
- Verify changing scope/folders writes settings only, scope text distinguishes `Current vault`/`User home (global)`, global control is absent on mobile, busy disables import controls and exceptions produce one notice without preview rerender.
- [x] **Step 2: Run `node --test tests/agent-guide-settings.test.mjs` and record expected failures.**
- [x] **Step 3: Implement using `getSettingDefinitions()` and native groups.** No `display()`, HTML headings or hardcoded styling. Use native folder controls for vault folders. Make the global path field/picker select a parent directory and display the final skill destination; cancel must not import. Keep selected-target status visible and preserve readable failures.
- [x] **Step 4: Run focused tests, full tests/build, self-review and commit only owned files.**

### Task 4: Documentation, integration and acceptance

**Files:**
- Modify: `docs/guides/agent-guide.md`, `docs/guides/agent-guide-zh.md`, `README.md`, `docs/README-zh.md`, `docs/design/architecture.md`, `AGENTS.md`.
- Modify: this plan's completion/evidence fields and the older plan's status block only, by the controller.

**Interfaces:**
- Consumes: the implemented scope/UI contract and the complete distributed body.
- Produces: bilingual installation instructions and explicit external-file disclosure; no copied guide body in README or installation docs.

- [x] **Step 1: Update English installation docs then Chinese mirror.** Cover both groups, three skill buttons, default docs/guides, custom parents, device-local global authorization, desktop/mobile differences, automatic maintenance and preserved old files. Do not claim Claude discovery or platform checks not actually executed.
- [x] **Step 2: Update README disclosure and minimal architecture/AGENTS rules.** Explain opt-in files outside the vault, native group headings replacing the prior no-heading statement, desktop-gated host modules, full shared guide and actual final test count. Do not change manifest/version or dependency declarations.
- [x] **Step 3: Run full tests/build and budget check.** `npm test`, `npm run build`, `wc -c main.js`; keep the bundle below 1,843,200 bytes. Verify Node 22/24 via the existing CI.
- [x] **Step 4: Verify in an isolated Obsidian test vault.** Confirm two headings/buttons, default Current vault, default guide import, native vault folder selection, canceled global picker, actual desktop files in an isolated temporary home, independent scopes, no global IO with mobile emulation, and modification/update protections. Do not write real user-global skills during agent testing.
- [x] **Step 5: Validate an actual available agent using only the installed complete guide and synthetic data.** Exercise combo/dual-axis, labeled colored series, richer cards and external dataset instructions; parse/render outputs and record failures accurately. Keep client login/platform limitations explicit.
- [x] **Step 6: Finish scoped and whole-branch reviews, fix real findings, run final verification and deliver under repository Git rules.** No extra review pipeline or release. Keep incomplete acceptance explicit instead of archiving a falsely completed plan.

---

## Execution and Evidence

> The current session executes the approved change. Another agent can also be handed the plan without duplicating requirements.

- Baseline: `f6ac2c6`, 387 tests and production build passed before implementation.
- No matching open issues were returned by preflight; none created.
- Desktop `App.loadLocalStorage`, `App.saveLocalStorage`, native settings groups and directory dialog were verified against installed types/runtime before defining their use.
- Alternative handoff: provide the repository, task branch, pushed plan commit and this plan path; require AGENTS compliance, completed review/fixes/retests and repository-default local merge/push. No PR unless explicitly requested.
- Implementation commits: `0287b3c` (scope/desktop boundary), `3d09fa2` and `e588ff9` (complete reference and chart-order clarification), `919be3f` (native import groups), `7ecc59b` and `91e83fa` (mobile-emulation gates), `67608c2` (installation documentation).
- Scoped reviews: installer, complete reference and UI approved. The reference review clarified single-axis combo legend ordering. Real-host acceptance found that mobile emulation retains the Electron flag while disabling plugin desktop modules; both service and UI now also exclude mobile UI mode, with regression tests.
- Final local verification: 423/423 tests passed, typecheck and production build passed, and `main.js` is 1,717,239 bytes against the 1,843,200-byte budget. No dependency, manifest, rendering or upstream baseline change.
- Distributed reference: one full English body, 18 runnable fenced examples, four tag examples and two explicit negative examples. Tests consume actual examples and bundled data, including weighted quarterly aggregation and every offered granularity.
- Actual isolated Obsidian 1.13.7 acceptance passed: native headings and all three skill buttons, default vault scope, preserved legacy root, fresh default guide import, native vault folder selection, independent vault/global results, device-local authorization, real files under an isolated temporary home, custom Unicode parent, preserved edits and previous custom destination.
- The real desktop directory dialog opened and canceled without changing local state. Selection-return behavior was also verified through the dialog boundary; successful manual global-directory selection was not established.
- Actual mobile emulation passed after the fix: Global absent, scope fixed to vault, no global state reads, no exposed global record and global imports rejected. Vault guide import remained usable. Emulation reloads the renderer and is not a physical-mobile test.
- Actual Codex 0.154.0 fresh sessions used only installed guidance and synthetic data. Generated dual-axis Chart, MetricGrid and FlowDiagram passed real parsing/rendering without errors or semantic warnings. A separate generated mapped CSV/manifest and Chart/DataTable produced quarterly Orders 200, Visits 4,000 and Conversion 5, with four successful granularity switches.
- Client environment limitation: Codex emitted a skill-context-budget warning unrelated to Mosaic. Claude was not logged in, so actual Claude discovery/invocation remains unverified. Physical macOS, Windows and mobile devices were not tested.
- Test-vault settings were restored after acceptance. Temporary test-home authorization was removed; no real user-global skills were written.
- Final whole-branch review approved `7894164` with no blocking findings. That commit was merged locally to main and pushed; local main, origin/main and the remote branch matched. Both Node 22 and Node 24 passed in [main CI run 34592326713](https://github.com/GilbertzzzZZ/obsidian-mosaic/actions/runs/34592326713).
- Status: implementation, review and main delivery complete. The client/platform limitations above remain explicitly unverified, so this plan stays available for acceptance follow-up. No tag or release was created.
