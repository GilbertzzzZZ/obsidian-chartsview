import test from "node:test";
import assert from "node:assert/strict";
import { installGlobals } from "./helpers/dom.mjs";
import { loadComponents } from "./helpers/bundle.mjs";
import { renderGuide, sha256 } from "../src/agent-guide/core.mjs";

installGlobals();
const { GuideInstaller, TFile } = await loadComponents();

function createHost({
	version = "1.1.6",
	guideFolder = "",
	guideInstalls = {},
	initialFiles = {},
	initialFolders = [],
	configDir = ".obsidian",
	processFailure,
	beforeProcess,
	saveFailure,
	beforeRead,
} = {}) {
	const files = new Map(Object.entries(initialFiles));
	const folders = new Set(["", ...initialFolders]);
	const stats = {
		fileReads: 0,
		fileWrites: 0,
		settingsSaves: 0,
		vaultCreates: 0,
		vaultProcesses: 0,
		adapterWrites: 0,
		adapterProcesses: 0,
	};
	const parent = (path) => path.split("/").slice(0, -1).join("/");
	const fileAt = (path) =>
		files.has(path) ? Object.assign(new TFile(), { path }) : null;
	const adapter = {
		async stat(path) {
			stats.fileReads++;
			const type = files.has(path)
				? "file"
				: folders.has(path)
					? "folder"
					: null;
			return type ? { type, size: 0, ctime: 0, mtime: 0 } : null;
		},
		async read(path) {
			stats.fileReads++;
			if (beforeRead) await beforeRead(path);
			if (!files.has(path)) throw new Error("File not found");
			return files.get(path);
		},
		async mkdir(path) {
			assert.ok(folders.has(parent(path)), `missing parent for ${path}`);
			folders.add(path);
		},
		async write(path, value) {
			if (!folders.has(parent(path))) throw new Error("Parent not found");
			files.set(path, value);
			stats.fileWrites++;
			stats.adapterWrites++;
		},
		async process(path, fn) {
			stats.adapterProcesses++;
			if (processFailure?.(path)) throw new Error(`Cannot process ${path}`);
			if (beforeProcess) await beforeProcess(path, files);
			const next = fn(await this.read(path));
			await this.write(path, next);
			return next;
		},
	};
	const vault = {
		adapter,
		configDir,
		getFileByPath: fileAt,
		getFolderByPath: (path) => (folders.has(path) ? { path } : null),
		getRoot: () => ({ path: "" }),
		read: (file) => adapter.read(file.path),
		async process(file, fn) {
			stats.vaultProcesses++;
			if (processFailure?.(file.path)) throw new Error(`Cannot process ${file.path}`);
			if (beforeProcess) await beforeProcess(file.path, files);
			const next = fn(await adapter.read(file.path));
			files.set(file.path, next);
			stats.fileWrites++;
			return next;
		},
		async createFolder(path) {
			assert.ok(folders.has(parent(path)), `missing parent for ${path}`);
			folders.add(path);
		},
		async create(path, value) {
			stats.vaultCreates++;
			if (files.has(path) || folders.has(path)) throw new Error("Path exists");
			if (!folders.has(parent(path))) throw new Error("Parent not found");
			files.set(path, value);
			stats.fileWrites++;
			return fileAt(path);
		},
	};
	const settings = { showExportBtn: true, guideFolder, guideInstalls };
	const host = {
		app: { vault },
		manifest: { version },
		settings,
		async saveSettings() {
			stats.settingsSaves++;
			if (saveFailure) throw new Error("Settings unavailable");
		},
	};
	return { files, folders, host, settings, stats };
}

test("only explicit installation creates a guide", async () => {
	const { files, host, stats } = createHost();
	const installer = new GuideInstaller(host, "# Mosaic Usage Guide\n");

	await installer.updateInstalled();
	assert.equal(stats.fileReads, 0);
	assert.equal(stats.fileWrites, 0);

	const result = await installer.install("agents");
	assert.equal(result.status, "installed");
	assert.equal(result.path, ".agents/skills/mosaic/SKILL.md");
	assert.match(files.get(result.path), /mosaic-version: "1\.1\.6"/);
	assert.equal(stats.adapterWrites, 1);
	assert.equal(stats.vaultCreates, 0);
	assert.match(host.settings.guideInstalls.agents.hash, /^[a-f0-9]{64}$/);
});

test("repeated installation leaves an owned guide untouched", async () => {
	const { files, host, stats } = createHost();
	const installer = new GuideInstaller(host, "# Guide");
	await installer.install("agents");
	const writes = stats.fileWrites;
	const saves = stats.settingsSaves;
	const original = files.get(".agents/skills/mosaic/SKILL.md");

	const result = await installer.install("agents");

	assert.equal(result.status, "unchanged");
	assert.equal(stats.fileWrites, writes);
	assert.equal(stats.settingsSaves, saves);
	assert.equal(files.get(result.path), original);
});

test("automatic update replaces only the previously installed content", async () => {
	const path = ".agents/skills/mosaic/SKILL.md";
	const previous = renderGuide("# Old guide", "1.1.6");
	const previousHash = await sha256(previous);
	const { files, host } = createHost({
		version: "1.1.7",
		guideInstalls: { agents: { path, version: "1.1.6", hash: previousHash } },
		initialFiles: { [path]: previous },
		initialFolders: [".agents", ".agents/skills", ".agents/skills/mosaic"],
	});
	const installer = new GuideInstaller(host, "# New guide");

	await installer.updateInstalled();

	assert.equal(installer.results.agents.status, "updated");
	assert.equal(files.get(path), renderGuide("# New guide", "1.1.7"));
	assert.equal(host.settings.guideInstalls.agents.version, "1.1.7");
});

test("an unowned same-name file is preserved", async () => {
	const path = ".agents/skills/mosaic/SKILL.md";
	const { files, host, stats } = createHost({
		initialFiles: { [path]: "# Personal notes" },
		initialFolders: [".agents", ".agents/skills", ".agents/skills/mosaic"],
	});
	const installer = new GuideInstaller(host, "# Guide");

	const result = await installer.install("agents");

	assert.equal(result.status, "conflict");
	assert.equal(files.get(path), "# Personal notes");
	assert.deepEqual(host.settings.guideInstalls, {});
	assert.equal(stats.fileWrites, 0);
});

test("local edits pause automatic updates", async () => {
	const path = ".claude/skills/mosaic/SKILL.md";
	const installed = renderGuide("# Old guide", "1.1.6");
	const record = { path, version: "1.1.6", hash: await sha256(installed) };
	const { files, host } = createHost({
		version: "1.1.7",
		guideInstalls: { claude: record },
		initialFiles: { [path]: `${installed}\nLocal note` },
		initialFolders: [".claude", ".claude/skills", ".claude/skills/mosaic"],
	});
	const installer = new GuideInstaller(host, "# New guide");

	await installer.updateInstalled();

	assert.equal(installer.results.claude.status, "conflict");
	assert.equal(files.get(path), `${installed}\nLocal note`);
	assert.deepEqual(host.settings.guideInstalls.claude, record);
});

test("renamed or deleted guides are not recreated automatically", async () => {
	const path = ".agents/skills/mosaic/SKILL.md";
	const record = { path, version: "1.1.6", hash: "a".repeat(64) };
	const { files, host, stats } = createHost({ guideInstalls: { agents: record } });
	const installer = new GuideInstaller(host, "# Guide");

	await installer.updateInstalled();

	assert.equal(installer.results.agents.status, "missing");
	assert.equal(files.has(path), false);
	assert.equal(stats.fileWrites, 0);
	assert.deepEqual(host.settings.guideInstalls.agents, record);
});

test("a newer installation record prevents downgrade without file access", async () => {
	const path = ".agents/skills/mosaic/SKILL.md";
	const record = { path, version: "1.10.0", hash: "a".repeat(64) };
	const { host, stats } = createHost({
		version: "1.9.9",
		guideInstalls: { agents: record },
	});
	const installer = new GuideInstaller(host, "# Guide");

	await installer.updateInstalled();

	assert.equal(installer.results.agents.status, "newer");
	assert.equal(stats.fileReads, 0);
	assert.equal(stats.fileWrites, 0);
});

test("one failed destination does not block another automatic update", async () => {
	const agents = ".agents/skills/mosaic/SKILL.md";
	const claude = ".claude/skills/mosaic/SKILL.md";
	const old = renderGuide("# Old", "1.1.6");
	const hash = await sha256(old);
	const { files, host } = createHost({
		version: "1.1.7",
		guideInstalls: {
			agents: { path: agents, version: "1.1.6", hash },
			claude: { path: claude, version: "1.1.6", hash },
		},
		initialFiles: { [agents]: old, [claude]: old },
		initialFolders: [
			".agents",
			".agents/skills",
			".agents/skills/mosaic",
			".claude",
			".claude/skills",
			".claude/skills/mosaic",
		],
		processFailure: (path) => path === agents,
	});
	const installer = new GuideInstaller(host, "# New");

	await installer.updateInstalled();

	assert.equal(installer.results.agents.status, "error");
	assert.equal(installer.results.claude.status, "updated");
	assert.equal(files.get(agents), old);
	assert.equal(files.get(claude), renderGuide("# New", "1.1.7"));
});

test("a settings save failure restores the old record but keeps the written file", async () => {
	const oldRecord = {
		path: ".claude/skills/mosaic/SKILL.md",
		version: "1.1.5",
		hash: "a".repeat(64),
	};
	const { files, host } = createHost({
		guideInstalls: { claude: oldRecord },
		saveFailure: true,
	});
	const installer = new GuideInstaller(host, "# Guide");

	const result = await installer.install("agents");

	assert.equal(result.status, "error");
	assert.match(result.message, /Settings unavailable/);
	assert.equal(files.has(".agents/skills/mosaic/SKILL.md"), true);
	assert.deepEqual(host.settings.guideInstalls, { claude: oldRecord });
});

test("switching the custom directory records the new guide and preserves the old one", async () => {
	const oldPath = "Reference/Mosaic-Usage-Guide.md";
	const old = renderGuide("# Old", "1.1.6");
	const { files, host, stats } = createHost({
		guideFolder: "Team/Guides",
		guideInstalls: {
			custom: { path: oldPath, version: "1.1.6", hash: await sha256(old) },
		},
		initialFiles: { [oldPath]: old },
		initialFolders: ["Reference"],
	});
	const installer = new GuideInstaller(host, "# New");

	const result = await installer.install("custom");

	assert.equal(result.status, "installed");
	assert.equal(result.path, "Team/Guides/Mosaic-Usage-Guide.md");
	assert.equal(files.get(oldPath), old);
	assert.equal(files.get(result.path), renderGuide("# New", "1.1.6"));
	assert.equal(host.settings.guideInstalls.custom.path, result.path);
	assert.equal(stats.vaultCreates, 1);
	assert.equal(stats.adapterWrites, 0);
});

test("a failed custom directory switch preserves the old record and both paths", async () => {
	const oldPath = "Reference/Mosaic-Usage-Guide.md";
	const old = renderGuide("# Old", "1.1.6");
	const oldRecord = { path: oldPath, version: "1.1.6", hash: await sha256(old) };
	const { files, host } = createHost({
		guideFolder: "Blocked/Guides",
		guideInstalls: { custom: oldRecord },
		initialFiles: { [oldPath]: old, Blocked: "not a folder" },
		initialFolders: ["Reference"],
	});
	const installer = new GuideInstaller(host, "# New");

	const result = await installer.install("custom");

	assert.equal(result.status, "error");
	assert.equal(files.get(oldPath), old);
	assert.equal(files.has("Blocked/Guides/Mosaic-Usage-Guide.md"), false);
	assert.deepEqual(host.settings.guideInstalls.custom, oldRecord);
});

test("the active vault config directory is never a guide destination", async () => {
	const { files, host, stats } = createHost({
		guideFolder: ".mosaic-config/Guides",
		configDir: ".mosaic-config",
	});
	const installer = new GuideInstaller(host, "# Guide");

	const result = await installer.install("custom");

	assert.equal(result.status, "error");
	assert.match(result.message, /config directory/);
	assert.equal(files.size, 0);
	assert.equal(stats.fileReads, 0);
	assert.equal(stats.fileWrites, 0);
});

test("invalid persisted fields are narrowed without changing existing settings", async () => {
	const { host, settings, stats } = createHost({
		guideFolder: "../Outside",
		guideInstalls: {
			agents: { path: "wrong.md", version: "v1", hash: "short" },
			unknown: { path: "note.md", version: "1.1.6", hash: "a".repeat(64) },
		},
	});
	new GuideInstaller(host, "# Guide");

	assert.equal(settings.guideFolder, "");
	assert.deepEqual(settings.guideInstalls, {});
	assert.equal(settings.showExportBtn, true);
	assert.equal(stats.settingsSaves, 0);
});

test("dispose during a read prevents the pending automatic write", async () => {
	const path = ".agents/skills/mosaic/SKILL.md";
	const old = renderGuide("# Old", "1.1.6");
	let releaseRead;
	const readStarted = new Promise((resolve) => {
		releaseRead = resolve;
	});
	let continueRead;
	const readBlocked = new Promise((resolve) => {
		continueRead = resolve;
	});
	const { files, host, stats } = createHost({
		version: "1.1.7",
		guideInstalls: {
			agents: { path, version: "1.1.6", hash: await sha256(old) },
		},
		initialFiles: { [path]: old },
		initialFolders: [".agents", ".agents/skills", ".agents/skills/mosaic"],
		beforeRead: async () => {
			releaseRead();
			await readBlocked;
		},
	});
	const installer = new GuideInstaller(host, "# New");
	const updating = installer.updateInstalled();
	await readStarted;
	installer.dispose();
	continueRead();
	await updating;

	assert.equal(installer.results.agents.status, "error");
	assert.equal(files.get(path), old);
	assert.equal(stats.fileWrites, 0);
});

test("an edit between validation and the atomic callback wins the race", async () => {
	const path = ".agents/skills/mosaic/SKILL.md";
	const old = renderGuide("# Old", "1.1.6");
	const record = { path, version: "1.1.6", hash: await sha256(old) };
	const { files, host, stats } = createHost({
		version: "1.1.7",
		guideInstalls: { agents: record },
		initialFiles: { [path]: old },
		initialFolders: [".agents", ".agents/skills", ".agents/skills/mosaic"],
		beforeProcess: async (processedPath, storedFiles) => {
			storedFiles.set(processedPath, "# User edit during update");
		},
	});
	const installer = new GuideInstaller(host, "# New");

	await installer.updateInstalled();

	assert.equal(installer.results.agents.status, "conflict");
	assert.equal(files.get(path), "# User edit during update");
	assert.deepEqual(host.settings.guideInstalls.agents, record);
	assert.equal(stats.fileWrites, 0);
});
