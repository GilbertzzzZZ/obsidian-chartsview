import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink, readdir, stat } from "node:fs/promises";
import os from "node:os";
import { join, dirname } from "node:path";
import Module, { createRequire } from "node:module";
import { installGlobals } from "./helpers/dom.mjs";
import { loadComponents } from "./helpers/bundle.mjs";
import { renderGuide, sha256 } from "../src/agent-guide/core.mjs";

installGlobals();
const components = await loadComponents();
const { GuideInstaller } = components;
const require = createRequire(import.meta.url);

async function fixture(t, { desktop = true, saved = null, saveFailure = false } = {}) {
	const root = await mkdtemp(join(os.tmpdir(), "mosaic-guide-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	// Host facilities are external; filesystem operations below remain real.
	if (components.Platform) components.Platform.isDesktopApp = desktop;
	mock.method(os, "homedir", () => root);
	t.after(() => { mock.restoreAll(); if (components.Platform) components.Platform.isDesktopApp = false; });
	let local = saved;
	const host = {
		app: {
			vault: { configDir: ".obsidian" },
			loadLocalStorage() { return structuredClone(local); },
			saveLocalStorage(_key, value) {
				if (saveFailure) throw new Error("Local storage unavailable");
				local = structuredClone(value);
			},
		},
		manifest: { version: "1.1.6" },
		settings: { guideFolder: "docs/guides", skillFolder: ".agents/skills", guideInstalls: {} },
		async saveSettings() { throw new Error("Global data must not enter plugin settings"); },
	};
	return { root, host, installer: new GuideInstaller(host, "# Guide"), saved: () => local };
}

test("fresh desktop load and selecting global create no files", async (t) => {
	const { root, installer, saved } = await fixture(t);
	assert.equal(installer.global, false);
	await installer.updateInstalled();
	installer.setGlobal(true);
	assert.equal(installer.global, true);
	assert.deepEqual(await readdir(root), []);
	assert.equal(saved().global, true);
});

test("global skills use runtime home, stay device-local and do not share vault results", async (t) => {
	const { root, host, installer, saved } = await fixture(t);
	const denied = await installer.install("agents", "global");
	assert.equal(denied.status, "error");
	installer.setGlobal(true);
	const result = await installer.install("agents", "global");
	assert.equal(result.status, "installed");
	assert.equal(result.scope, "global");
	assert.equal(result.path, join(root, ".agents/skills/mosaic/SKILL.md"));
	assert.match(await readFile(result.path, "utf8"), /# Guide/);
	const before = await stat(result.path);
	assert.equal((await installer.install("agents", "global")).status, "unchanged");
	assert.equal((await stat(result.path)).mtimeMs, before.mtimeMs);
	assert.deepEqual(host.settings.guideInstalls, {});
	assert.equal(JSON.stringify(host.settings).includes(root), false);
	assert.equal(saved().installs.agents.path, result.path);
	assert.equal(installer.results.agents, undefined);
	assert.equal(installer.getRecord("agents", "vault"), undefined);
	assert.equal(installer.getResult("agents", "global").status, "unchanged");
	assert.equal((await installer.install("custom", "global")).status, "error");
});

test("global edits and deletion preserve the record without automatic recreation", async (t) => {
	const { installer, host } = await fixture(t);
	installer.setGlobal(true);
	const { path } = await installer.install("agents", "global");
	const record = installer.getRecord("agents", "global");
	await writeFile(path, "# Personal edit");
	host.manifest.version = "1.1.7";
	await installer.updateInstalled();
	assert.equal(installer.getResult("agents", "global").status, "conflict");
	assert.equal(await readFile(path, "utf8"), "# Personal edit");
	assert.deepEqual(installer.getRecord("agents", "global"), record);
	await rm(path);
	await installer.updateInstalled();
	assert.equal(installer.getResult("agents", "global").status, "missing");
	await assert.rejects(readFile(path), { code: "ENOENT" });
});

test("mobile never loads desktop modules or device-local global records", async (t) => {
	const { host } = await fixture(t, { desktop: false });
	host.app.loadLocalStorage = () => { throw new Error("Mobile local storage access"); };
	const original = Module._load;
	mock.method(Module, "_load", function (name, ...args) {
		if (["fs", "os", "path", "@electron/remote"].includes(name)) throw new Error("Desktop module loaded on mobile");
		return original.call(this, name, ...args);
	});
	const installer = new GuideInstaller(host, "# Guide");
	assert.equal(installer.global, false);
	await installer.updateInstalled();
	assert.equal((await installer.install("agents", "global")).status, "error");
	assert.equal(installer.getRecord("agents", "global"), undefined);
	assert.throws(() => installer.setGlobal(true), /desktop/i);
});

test("native picker cancellation does not change selection or records", async (t) => {
	const { installer, saved } = await fixture(t);
	const original = Module._load;
	mock.method(Module, "_load", function (name, ...args) {
		if (name === "@electron/remote") return { dialog: { async showOpenDialog(options) {
			assert.deepEqual(options.properties, ["openDirectory", "createDirectory"]);
			return { canceled: true, filePaths: [] };
		} } };
		return original.call(this, name, ...args);
	});
	const before = installer.globalSkillFolder;
	assert.equal(await installer.chooseGlobalSkillFolder(), null);
	assert.equal(installer.globalSkillFolder, before);
	assert.equal(saved(), null);
});

test("global final-file symlinks are refused even when bytes match", async (t) => {
	const { root, installer } = await fixture(t);
	installer.setGlobal(true);
	const outside = join(root, "personal.md");
	const path = join(root, ".agents/skills/mosaic/SKILL.md");
	await writeFile(outside, renderGuide("# Guide", "1.1.6"));
	await mkdir(dirname(path), { recursive: true });
	await symlink(outside, path);
	assert.equal((await installer.install("agents", "global")).status, "error");
	assert.equal(installer.getRecord("agents", "global"), undefined);
	assert.equal(await readFile(outside, "utf8"), renderGuide("# Guide", "1.1.6"));
});

test("a failed desktop replacement preserves old bytes and its ownership record", async (t) => {
	const { installer, host } = await fixture(t);
	installer.setGlobal(true);
	const { path } = await installer.install("agents", "global");
	const before = await readFile(path, "utf8");
	const record = installer.getRecord("agents", "global");
	host.manifest.version = "1.1.7";
	mock.method(require("fs").promises, "rename", async () => { throw new Error("Write denied"); });
	await installer.updateInstalled();
	assert.equal(installer.getResult("agents", "global").status, "error");
	assert.equal(await readFile(path, "utf8"), before);
	assert.deepEqual(installer.getRecord("agents", "global"), record);
	assert.deepEqual(await readdir(dirname(path)), ["SKILL.md"]);
});

test("global selection changes affect the next import, while recorded paths still update", async (t) => {
	const { root, installer, host } = await fixture(t);
	installer.setGlobal(true);
	installer.setGlobalSkillFolder(join(root, "first"));
	const first = await installer.install("skillPath", "global");
	assert.equal(first.path, join(root, "first/mosaic/SKILL.md"));
	installer.setGlobalSkillFolder(join(root, "next"));
	installer.setGlobal(false);
	host.manifest.version = "1.1.7";
	const reloaded = new GuideInstaller(host, "# New");
	await reloaded.updateInstalled();
	assert.equal(reloaded.global, false);
	assert.equal(reloaded.getResult("skillPath", "global").status, "updated");
	assert.match(await readFile(first.path, "utf8"), /# New/);
	await assert.rejects(stat(join(root, "next")), { code: "ENOENT" });
	reloaded.setGlobal(true);
	assert.equal((await reloaded.install("skillPath", "global")).path, join(root, "next/mosaic/SKILL.md"));
	assert.match(await readFile(first.path, "utf8"), /# New/);
});

test("local storage save failure preserves selection and installation records", async (t) => {
	const { root, installer, host, saved } = await fixture(t);
	installer.setGlobal(true);
	const first = await installer.install("agents", "global");
	const record = installer.getRecord("agents", "global");
	const previous = saved();
	host.app.saveLocalStorage = () => { throw new Error("Local storage unavailable"); };
	assert.throws(() => installer.setGlobal(false), /Local storage unavailable/);
	assert.equal(installer.global, true);
	assert.throws(() => installer.setGlobalSkillFolder(join(root, "other")), /Local storage unavailable/);
	assert.equal(installer.globalSkillFolder, join(root, ".agents/skills"));
	host.manifest.version = "1.1.7";
	await installer.updateInstalled();
	assert.equal(installer.getResult("agents", "global").status, "error");
	assert.deepEqual(installer.getRecord("agents", "global"), record);
	assert.deepEqual(saved(), previous);
	assert.match(await readFile(first.path, "utf8"), /1\.1\.7/);
});

test("local storage read failure is visible without breaking vault installer construction", async (t) => {
	const { host } = await fixture(t);
	host.app.loadLocalStorage = () => { throw new Error("Local storage unavailable"); };
	const installer = new GuideInstaller(host, "# Guide");
	assert.equal(installer.global, false);
	await installer.updateInstalled();
	const result = await installer.install("agents", "global");
	assert.equal(result.status, "error");
	assert.match(result.message, /Local storage unavailable/);
	assert.deepEqual(host.settings.guideInstalls, {});
});

test("malformed global records never authorize arbitrary file paths", async (t) => {
	const { root, host } = await fixture(t);
	const record = { version: "1.1.5", hash: await sha256("old") };
	const outside = join(root, "personal.md");
	await writeFile(outside, "old");
	host.app.loadLocalStorage = () => ({ global: true, installs: {
		agents: { ...record, path: outside },
		claude: { ...record, path: join(root, "other/.claude/skills/mosaic/SKILL.md") },
		skillPath: { ...record, path: `${root}/skills/../mosaic/SKILL.md` },
		custom: { ...record, path: outside },
	} });
	const installer = new GuideInstaller(host, "# Guide");
	await installer.updateInstalled();
	for (const target of ["agents", "claude", "skillPath", "custom"]) assert.equal(installer.getRecord(target, "global"), undefined);
	assert.equal(await readFile(outside, "utf8"), "old");
});

test("higher-version global records prevent downgrade before reading files", async (t) => {
	const { root, host } = await fixture(t);
	const path = join(root, ".agents/skills/mosaic/SKILL.md");
	host.app.loadLocalStorage = () => ({ global: true, installs: {
		agents: { path, version: "9.0.0", hash: "a".repeat(64) },
	} });
	const installer = new GuideInstaller(host, "# Guide");
	mock.method(require("fs").promises, "lstat", async () => { throw new Error("Unexpected file access"); });
	await installer.updateInstalled();
	assert.equal(installer.getResult("agents", "global").status, "newer");
});

test("another vault's matching desired bytes can be adopted without rewriting", async (t) => {
	const { root, installer } = await fixture(t);
	const path = join(root, ".claude/skills/mosaic/SKILL.md");
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, renderGuide("# Guide", "1.1.6"));
	const before = await stat(path);
	installer.setGlobal(true);
	assert.equal((await installer.install("claude", "global")).status, "unchanged");
	assert.equal((await stat(path)).mtimeMs, before.mtimeMs);
	assert.equal(installer.getRecord("claude", "global").path, path);
});

test("a file appearing during desktop creation is preserved", async (t) => {
	const { installer } = await fixture(t);
	installer.setGlobal(true);
	const fs = require("fs").promises;
	const original = fs.link;
	mock.method(fs, "link", async (temporary, target) => {
		await writeFile(target, "# New personal file");
		return original(temporary, target);
	});
	const result = await installer.install("agents", "global");
	assert.equal(result.status, "conflict");
	assert.equal(await readFile(result.path, "utf8"), "# New personal file");
	assert.equal(installer.getRecord("agents", "global"), undefined);
	assert.deepEqual(await readdir(dirname(result.path)), ["SKILL.md"]);
});

test("desktop replacement rechecks user edits after writing its temporary file", async (t) => {
	const { installer, host } = await fixture(t);
	installer.setGlobal(true);
	const { path } = await installer.install("agents", "global");
	const fs = require("fs").promises;
	const original = fs.open;
	mock.method(fs, "open", async (openedPath, ...args) => {
		const handle = await original(openedPath, ...args);
		if (openedPath.endsWith(".tmp")) {
			const close = handle.close.bind(handle);
			handle.close = async () => { await close(); await writeFile(path, "# Edited while updating"); };
		}
		return handle;
	});
	host.manifest.version = "1.1.7";
	await installer.updateInstalled();
	assert.equal(installer.getResult("agents", "global").status, "conflict");
	assert.equal(await readFile(path, "utf8"), "# Edited while updating");
	assert.equal(installer.getRecord("agents", "global").version, "1.1.6");
});

test("an incomplete temporary write never damages an existing global file", async (t) => {
	const { installer, host } = await fixture(t);
	installer.setGlobal(true);
	const { path } = await installer.install("agents", "global");
	const originalBytes = await readFile(path, "utf8");
	const fs = require("fs").promises;
	const original = fs.open;
	mock.method(fs, "open", async (openedPath, ...args) => {
		const handle = await original(openedPath, ...args);
		if (openedPath.endsWith(".tmp")) handle.writeFile = async () => { await handle.write("partial"); throw new Error("Disk full"); };
		return handle;
	});
	host.manifest.version = "1.1.7";
	await installer.updateInstalled();
	assert.equal(installer.getResult("agents", "global").status, "error");
	assert.equal(await readFile(path, "utf8"), originalBytes);
	assert.equal(installer.getRecord("agents", "global").version, "1.1.6");
	assert.deepEqual(await readdir(dirname(path)), ["SKILL.md"]);
});

test("one busy flag and unload guard protect a pending global import", async (t) => {
	const { installer, root } = await fixture(t);
	installer.setGlobal(true);
	const fs = require("fs").promises;
	const original = fs.mkdir;
	let start, resume;
	const started = new Promise((resolve) => { start = resolve; });
	const paused = new Promise((resolve) => { resume = resolve; });
	mock.method(fs, "mkdir", async (...args) => { start(); await paused; return original(...args); });
	const pending = installer.install("agents", "global");
	await started;
	assert.equal((await installer.install("claude", "global")).status, "busy");
	assert.equal((await installer.install("agents", "vault")).status, "busy");
	installer.dispose();
	resume();
	assert.equal((await pending).status, "error");
	assert.equal(installer.busy, false);
	assert.equal(installer.getRecord("agents", "global"), undefined);
	await assert.rejects(readFile(join(root, ".agents/skills/mosaic/SKILL.md")), { code: "ENOENT" });
});

test("absent native picker reports an English error and leaves selection unchanged", async (t) => {
	const { installer, saved } = await fixture(t);
	const original = Module._load;
	mock.method(Module, "_load", function (name, ...args) {
		if (name === "@electron/remote") throw new Error("Module unavailable");
		return original.call(this, name, ...args);
	});
	await assert.rejects(installer.chooseGlobalSkillFolder(), /Could not open the desktop folder picker.*Module unavailable/);
	assert.equal(saved(), null);
});

test("invalid saved folder does not prevent another recorded global target from updating", async (t) => {
	const { root, host } = await fixture(t);
	const path = join(root, ".agents/skills/mosaic/SKILL.md");
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, "old");
	const hash = await sha256("old");
	host.app.loadLocalStorage = () => ({ global: true, skillFolder: "../invalid", installs: {
		agents: { path, version: "1.1.5", hash },
	} });
	const installer = new GuideInstaller(host, "# Guide");
	await installer.updateInstalled();
	assert.equal(installer.getResult("agents", "global").status, "updated");
	assert.equal(installer.globalSkillFolder, join(root, ".agents/skills"));
});

test("successful native selection persists only the next custom skill parent", async (t) => {
	const { installer, root, saved } = await fixture(t);
	const selected = join(root, "selected");
	const original = Module._load;
	mock.method(Module, "_load", function (name, ...args) {
		if (name === "@electron/remote") return { dialog: { async showOpenDialog() {
			return { canceled: false, filePaths: [selected] };
		} } };
		return original.call(this, name, ...args);
	});
	assert.equal(await installer.chooseGlobalSkillFolder(), selected);
	assert.equal(installer.globalSkillFolder, selected);
	assert.deepEqual(saved().installs, {});
	assert.deepEqual(await readdir(root), []);
	installer.setGlobal(true);
	assert.equal((await installer.install("skillPath", "global")).path, join(selected, "mosaic/SKILL.md"));
});

test("missing desktop modules remain an operation error instead of a load failure", async (t) => {
	const { host } = await fixture(t);
	const original = Module._load;
	mock.method(Module, "_load", function (name, ...args) {
		if (["fs", "os", "path", "crypto"].includes(name)) throw new Error("Desktop capability unavailable");
		return original.call(this, name, ...args);
	});
	const installer = new GuideInstaller(host, "# Guide");
	await installer.updateInstalled();
	installer.setGlobal(true);
	const result = await installer.install("agents", "global");
	assert.equal(result.status, "error");
	assert.match(result.message, /Desktop capability unavailable/);
	assert.equal(installer.getRecord("agents", "global"), undefined);
});
