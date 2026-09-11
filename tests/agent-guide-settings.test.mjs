import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installGlobals } from "./helpers/dom.mjs";
import { loadComponents } from "./helpers/bundle.mjs";

installGlobals();
const { MosaicPlugin, MosaicSettingTab, Notice, Platform } = await loadComponents();
const initialSkillParent = join(tmpdir(), "mosaic-settings-skills");
const chosenSkillParent = join(tmpdir(), "mosaic-settings-chosen");

function rows(tab) {
	return tab.getSettingDefinitions().flatMap((item) => item.items ?? [item]);
}

function settingRow() {
	const buttons = [];
	return {
		buttons,
		addButton(configure) {
			const button = {
				text: "",
				disabled: false,
				setButtonText(text) {
					this.text = text;
					return this;
				},
				setDisabled(disabled) {
					this.disabled = disabled;
					return this;
				},
				onClick(click) {
					this.click = click;
					return this;
				},
			};
			configure(button);
			buttons.push(button);
			return this;
		},
	};
}

function settingsPlugin(overrides = {}) {
	const calls = [];
	const plugin = {
		settings: { showExportBtn: false, guideFolder: "docs/guides", skillFolder: ".agents/skills", guideInstalls: {} },
		guideInstaller: {
			busy: false,
			global: false,
			globalSkillFolder: initialSkillParent,
			results: {},
			globalResults: {},
			getResult(target, scope) {
				assert.ok(scope === "vault" || scope === "global");
				return (scope === "vault" ? this.results : this.globalResults)[target];
			},
			getRecord(target, scope) {
				assert.ok(scope === "vault" || scope === "global");
				return scope === "vault" ? plugin.settings.guideInstalls[target] : undefined;
			},
			setGlobal(value) { this.global = value; },
			async chooseGlobalSkillFolder() { return null; },
			async install(target, scope) {
				calls.push([target, scope]);
				const paths = {
					agents: ".agents/skills/mosaic/SKILL.md",
					claude: ".claude/skills/mosaic/SKILL.md",
					skillPath: `${plugin.settings.skillFolder}/mosaic/SKILL.md`,
					custom: `${plugin.settings.guideFolder}/Mosaic-Usage-Guide.md`,
				};
				return { target, scope, path: paths[target], status: "installed" };
			},
		},
		async saveSettings() {},
		rerenderOpenPreviews() {
			this.previewRebuilds = (this.previewRebuilds ?? 0) + 1;
		},
		...overrides,
	};
	return { plugin, calls };
}

test("legacy settings receive independent guide defaults", async () => {
	const app = { workspace: {} };
	const first = new MosaicPlugin(app, { version: "1.1.6" });
	const second = new MosaicPlugin(app, { version: "1.1.6" });
	first.data = { showExportBtn: true };
	second.data = { showExportBtn: false };

	await first.loadSettings();
	await second.loadSettings();

	assert.deepEqual(first.settings, {
		showExportBtn: true,
		guideFolder: "docs/guides",
		skillFolder: ".agents/skills",
		guideInstalls: {},
	});
	assert.deepEqual(second.settings, {
		showExportBtn: false,
		guideFolder: "docs/guides",
		skillFolder: ".agents/skills",
		guideInstalls: {},
	});
	assert.notEqual(first.settings.guideInstalls, second.settings.guideInstalls);
});

test("native groups route all vault skill buttons and the ordinary guide separately", async () => {
	Notice.messages.length = 0;
	const { plugin, calls } = settingsPlugin();
	const tab = new MosaicSettingTab({}, plugin);
	assert.deepEqual(tab.getSettingDefinitions().filter((item) => item.type === "group")
		.map((item) => item.heading), ["Import skill", "Import guides"]);
	const definitions = rows(tab);
	const agentRow = settingRow();
	definitions.find((item) => item.name === "Agent skills").render(agentRow, null);

	assert.deepEqual(agentRow.buttons.map((button) => button.text), ["to .agents", "to .claude", "to path"]);
	await agentRow.buttons[0].click();
	await agentRow.buttons[1].click();
	await agentRow.buttons[2].click();
	assert.deepEqual(calls, [["agents", "vault"], ["claude", "vault"], ["skillPath", "vault"]]);
	assert.equal(tab.updateCalls, 6);
	assert.match(Notice.messages[0], /Current vault.*\.agents\/skills\/mosaic\/SKILL.md/);

	const folder = definitions.find((item) => item.name === "Guide folder");
	assert.equal(folder.control.type, "folder");
	assert.equal(folder.control.key, "guideFolder");
	assert.equal(folder.control.defaultValue, "docs/guides");
	assert.equal(folder.control.includeRoot, true);
	await tab.setControlValue("guideFolder", "Reference");
	assert.equal(plugin.settings.guideFolder, "Reference");
	assert.equal(plugin.previewRebuilds ?? 0, 0);

	const guideRow = settingRow();
	definitions.find((item) => item.name === "Usage guide").render(guideRow, null);
	assert.deepEqual(guideRow.buttons.map((button) => button.text), ["Import"]);
	await guideRow.buttons[0].click();
	assert.deepEqual(calls.at(-1), ["custom", "vault"]);
	assert.match(Notice.messages.at(-1), /Current vault.*Reference\/Mosaic-Usage-Guide.md.*Ask your agent/);
	assert.equal(plugin.previewRebuilds ?? 0, 0);

	await tab.setControlValue("showExportBtn", true);
	assert.equal(plugin.previewRebuilds, 1);
});

test("guide descriptions show saved and current results without claiming a client loaded them", () => {
	const { plugin } = settingsPlugin();
	plugin.settings.guideInstalls.agents = {
		path: ".agents/skills/mosaic/SKILL.md",
		version: "1.1.6",
		hash: "a".repeat(64),
	};
	plugin.guideInstaller.results.claude = {
		target: "claude",
		path: ".claude/skills/mosaic/SKILL.md",
		status: "conflict",
	};
	plugin.guideInstaller.results.custom = {
		target: "custom",
		path: "Reference/Mosaic-Usage-Guide.md",
		status: "installed",
	};

	const definitions = rows(new MosaicSettingTab({}, plugin));
	const agentsDescription = definitions.find((item) => item.name === "Agent skills").desc;
	const guideDescription = definitions.find((item) => item.name === "Usage guide").desc;

	assert.match(agentsDescription, /Agents: installed at \.agents\/skills\/mosaic\/SKILL\.md\./);
	assert.match(agentsDescription, /Claude: local changes kept at \.claude\/skills\/mosaic\/SKILL\.md\./);
	assert.doesNotMatch(agentsDescription, /loaded/i);
	assert.match(guideDescription, /Reference\/Mosaic-Usage-Guide\.md/);
	assert.match(
		guideDescription,
		/Ask your agent to read this file before creating Mosaic content\./,
	);
});

test("a rejected install is caught, reported, and refreshes the settings twice", async () => {
	Notice.messages.length = 0;
	const { plugin } = settingsPlugin();
	plugin.guideInstaller.install = async () => { throw new Error("vault unavailable"); };
	const tab = new MosaicSettingTab({}, plugin);
	const row = settingRow();
	rows(tab).find((item) => item.name === "Agent skills").render(row, null);

	await assert.doesNotReject(row.buttons[0].click());
	assert.equal(tab.updateCalls, 2);
	assert.deepEqual(Notice.messages, ["Could not install Mosaic guidance: vault unavailable"]);
});

test("a returned guide error reports its target path and operation result", async () => {
	Notice.messages.length = 0;
	const result = {
		target: "agents",
		scope: "vault",
		path: ".agents/skills/mosaic/SKILL.md",
		status: "error",
		message: "permission denied",
	};
	const { plugin } = settingsPlugin();
	plugin.guideInstaller.install = async function () {
		this.results.agents = result;
		return result;
	};
	const tab = new MosaicSettingTab({}, plugin);
	const row = settingRow();
	rows(tab).find((item) => item.name === "Agent skills").render(row, null);

	await row.buttons[0].click();

	const description = rows(tab)
		.find((item) => item.name === "Agent skills").desc;
	assert.match(
		description,
		/Guide operation failed at \.agents\/skills\/mosaic\/SKILL\.md: permission denied\./,
	);
	assert.equal(Notice.messages.length, 1);
	assert.match(Notice.messages[0], /Current vault.*Guide operation failed at \.agents\/skills\/mosaic\/SKILL.md: permission denied\./);
});

test("desktop global selection routes skills globally while default guides remain in the vault", async () => {
	Platform.isDesktopApp = true;
	try {
		const { plugin, calls } = settingsPlugin();
		let saves = 0;
		plugin.saveSettings = async () => { saves++; };
		const tab = new MosaicSettingTab({}, plugin);
		const globalControl = rows(tab).find((item) => item.name === "Global").control;
		assert.equal(globalControl.type, "toggle");
		assert.equal(globalControl.defaultValue, false);
		assert.equal(tab.getControlValue(globalControl.key), false);
		assert.match(rows(tab).find((item) => item.name === "Agent skills").desc, /Current vault/);
		await tab.setControlValue(globalControl.key, true);
		assert.equal(tab.getControlValue(globalControl.key), true);
		assert.equal(saves, 0);
		assert.deepEqual(calls, []);
		assert.match(rows(tab).find((item) => item.name === "Agent skills").desc, /User home \(global\)/);
		const skillRow = settingRow();
		rows(tab).find((item) => item.name === "Agent skills").render(skillRow);
		for (const button of skillRow.buttons) await button.click();
		assert.deepEqual(calls, [["agents", "global"], ["claude", "global"], ["skillPath", "global"]]);
		const guideRow = settingRow();
		rows(tab).find((item) => item.name === "Usage guide").render(guideRow);
		await guideRow.buttons[0].click();
		assert.deepEqual(calls.at(-1), ["custom", "vault"]);
		assert.match(Notice.messages.at(-1), /docs\/guides\/Mosaic-Usage-Guide.md/);
		assert.equal(plugin.previewRebuilds ?? 0, 0);
	} finally { Platform.isDesktopApp = false; }
});

test("vault folder controls include root, persist choices only, and show the skill destination", async () => {
	const { plugin, calls } = settingsPlugin();
	let saves = 0;
	plugin.saveSettings = async () => { saves++; };
	const tab = new MosaicSettingTab({}, plugin);
	const folder = rows(tab).find((item) => item.control?.key === "skillFolder");
	assert.ok(folder, "vault custom skill folder must be selectable");
	assert.equal(folder.control.type, "folder");
	assert.equal(folder.control.includeRoot, true);
	assert.equal(folder.control.defaultValue, ".agents/skills");
	await tab.setControlValue("skillFolder", "Team skills");
	assert.equal(tab.getControlValue("skillFolder"), "Team skills");
	assert.match(rows(tab).find((item) => item.control?.key === "skillFolder").desc, /Team skills\/mosaic\/SKILL.md/);
	await tab.setControlValue("skillFolder", "");
	await tab.setControlValue("guideFolder", "");
	assert.equal(tab.getControlValue("skillFolder"), "");
	assert.equal(tab.getControlValue("guideFolder"), "");
	assert.equal(saves, 3);
	assert.deepEqual(calls, []);
	assert.equal(plugin.previewRebuilds ?? 0, 0);
});

test("global picker selection and cancellation never import and preserve a separate to path action", async () => {
	Platform.isDesktopApp = true;
	try {
		const { plugin, calls } = settingsPlugin();
		plugin.guideInstaller.global = true;
		let selections = 0;
		plugin.guideInstaller.chooseGlobalSkillFolder = async function () {
			if (selections++ === 0) return null;
			this.globalSkillFolder = chosenSkillParent;
			return this.globalSkillFolder;
		};
		const tab = new MosaicSettingTab({}, plugin);
		const picker = () => {
			const row = settingRow();
			rows(tab).find((item) => item.name === "Skill folder").render(row);
			return row.buttons.find((button) => button.text === "Choose folder");
		};
		assert.ok(picker(), "global mode needs a separate directory picker");
		await picker().click();
		assert.equal(plugin.guideInstaller.globalSkillFolder, initialSkillParent);
		await picker().click();
		assert.ok(rows(tab).find((item) => item.name === "Skill folder").desc.includes(`${chosenSkillParent}/mosaic/SKILL.md`));
		assert.deepEqual(calls, []);
		assert.equal(plugin.previewRebuilds ?? 0, 0);
	} finally { Platform.isDesktopApp = false; }
});

test("mobile never exposes or reads global controls and statuses", () => {
	const { plugin } = settingsPlugin();
	Object.defineProperty(plugin.guideInstaller, "global", { get() { throw new Error("desktop state accessed"); } });
	const definitions = rows(new MosaicSettingTab({}, plugin));
	assert.equal(definitions.some((item) => item.name === "Global"), false);
	assert.match(definitions.find((item) => item.name === "Agent skills").desc, /Current vault/);
});

test("desktop mobile emulation hides Global and routes all imports to the vault", async () => {
	Platform.isDesktopApp = true;
	Platform.isMobile = true;
	try {
		const { plugin, calls } = settingsPlugin();
		const tab = new MosaicSettingTab({}, plugin);
		assert.equal(rows(tab).some((item) => item.name === "Global"), false);
		plugin.guideInstaller.setGlobal = () => { throw new Error("desktop state written"); };
		Object.defineProperty(plugin.guideInstaller, "global", { get() { throw new Error("desktop state accessed"); } });
		Notice.messages.length = 0;
		assert.equal(tab.getControlValue("global"), false);
		await tab.setControlValue("global", true);
		assert.deepEqual(Notice.messages, []);
		const definitions = rows(tab);
		assert.ok(definitions.find((item) => item.control?.key === "skillFolder"));
		assert.match(definitions.find((item) => item.name === "Agent skills").desc, /Current vault/);
		for (const name of ["Agent skills", "Usage guide"]) {
			const row = settingRow();
			definitions.find((item) => item.name === name).render(row);
			for (const button of row.buttons) await button.click();
		}
		assert.deepEqual(calls, [["agents", "vault"], ["claude", "vault"], ["skillPath", "vault"], ["custom", "vault"]]);
	} finally {
		Platform.isDesktopApp = false;
		Platform.isMobile = false;
	}
});

test("selected scope status never leaks another scope and ordinary guide status stays vault scoped", () => {
	Platform.isDesktopApp = true;
	try {
		const { plugin } = settingsPlugin();
		plugin.guideInstaller.results.agents = { target: "agents", scope: "vault", path: "vault-only", status: "conflict" };
		plugin.guideInstaller.globalResults.agents = { target: "agents", scope: "global", path: "global-only", status: "updated" };
		plugin.guideInstaller.results.custom = { target: "custom", scope: "vault", path: "guide-only", status: "installed" };
		plugin.guideInstaller.global = true;
		const definitions = rows(new MosaicSettingTab({}, plugin));
		const status = definitions.find((item) => item.name === "Agent skills").desc;
		assert.match(status, /global-only/);
		assert.doesNotMatch(status, /vault-only/);
		assert.match(definitions.find((item) => item.name === "Usage guide").desc, /Current vault.*guide-only/);
	} finally { Platform.isDesktopApp = false; }
});

test("busy disables all import controls but leaves the export toggle available", async () => {
	Platform.isDesktopApp = true;
	try {
		const { plugin, calls } = settingsPlugin();
		plugin.guideInstaller.busy = true;
		const tab = new MosaicSettingTab({}, plugin);
		for (const global of [false, true]) {
			plugin.guideInstaller.global = global;
			for (const item of rows(tab)) {
				if (item.control?.key === "showExportBtn") {
					assert.ok(!item.control.disabled);
				} else if (item.control) {
					const disabled = item.control.disabled;
					assert.equal(typeof disabled === "function" ? disabled() : disabled, true);
				}
				if (item.render) {
					const row = settingRow();
					item.render(row);
					assert.ok(row.buttons.every((button) => button.disabled));
				}
			}
		}
		await tab.setControlValue("skillFolder", "Ignored");
		await tab.setControlValue("guideFolder", "Ignored");
		await tab.setControlValue("global", false);
		assert.equal(plugin.settings.skillFolder, ".agents/skills");
		assert.equal(plugin.settings.guideFolder, "docs/guides");
		assert.equal(plugin.guideInstaller.global, true);
		assert.deepEqual(calls, []);
	} finally { Platform.isDesktopApp = false; }
});

test("failed global setting and picker operations each report one readable notice", async () => {
	Platform.isDesktopApp = true;
	try {
		Notice.messages.length = 0;
		const { plugin } = settingsPlugin();
		plugin.guideInstaller.setGlobal = () => { throw new Error("local storage unavailable"); };
		const tab = new MosaicSettingTab({}, plugin);
		await assert.doesNotReject(tab.setControlValue("global", true));
		assert.equal(Notice.messages.length, 1);
		assert.match(Notice.messages[0], /local storage unavailable/);
		assert.equal(plugin.guideInstaller.global, false);
		plugin.guideInstaller.global = true;
		plugin.guideInstaller.chooseGlobalSkillFolder = async () => { throw new Error("native picker unavailable"); };
		const row = settingRow();
		rows(tab).find((item) => item.name === "Skill folder").render(row);
		await assert.doesNotReject(row.buttons[0].click());
		assert.equal(Notice.messages.length, 2);
		assert.match(Notice.messages[1], /native picker unavailable/);
		assert.equal(plugin.previewRebuilds ?? 0, 0);
	} finally { Platform.isDesktopApp = false; }
});

function pluginApp(layoutCallbacks, writes) {
	return {
		workspace: {
			onLayoutReady(callback) {
				layoutCallbacks.push(callback);
			},
			on() {
				return {};
			},
			iterateAllLeaves() {},
		},
		vault: {
			configDir: ".obsidian",
			adapter: {},
			getFolderByPath() {
				return null;
			},
			getFileByPath() {
				return null;
			},
			async create(path) {
				writes.push(path);
			},
		},
	};
}

test("plugin lifecycle defers one guide check, preserves registrations, and disposes the captured service", async () => {
	const layoutCallbacks = [];
	const writes = [];
	const plugin = new MosaicPlugin(
		pluginApp(layoutCallbacks, writes),
		{ version: "1.1.6" },
	);
	plugin.data = { showExportBtn: false };

	await plugin.onload();

	assert.deepEqual(
		plugin.codeBlockProcessors.map(({ language }) => language).sort(),
		["chart", "chartview", "datatable", "decisionbox", "flowdiagram", "metricgrid", "timeline"],
	);
	assert.equal(plugin.postProcessors.length, 1);
	assert.equal(plugin.settingTabs.length, 1);
	assert.equal(layoutCallbacks.length, 1);

	const firstInstaller = plugin.guideInstaller;
	let firstChecks = 0;
	const firstUpdate = firstInstaller.updateInstalled.bind(firstInstaller);
	firstInstaller.updateInstalled = async () => {
		firstChecks++;
		await firstUpdate();
	};
	assert.equal(firstChecks, 0);
	layoutCallbacks[0]();
	await Promise.resolve();
	assert.equal(firstChecks, 1);

	plugin.onunload();
	const afterUnload = await firstInstaller.install("custom");
	assert.equal(afterUnload.status, "error");
	assert.deepEqual(writes, []);

	await plugin.onload();
	const secondInstaller = plugin.guideInstaller;
	let secondChecks = 0;
	const secondUpdate = secondInstaller.updateInstalled.bind(secondInstaller);
	secondInstaller.updateInstalled = async () => {
		secondChecks++;
		await secondUpdate();
	};
	layoutCallbacks[0]();
	await Promise.resolve();
	assert.equal(firstChecks, 2);
	assert.equal(secondChecks, 0);
	layoutCallbacks[1]();
	await Promise.resolve();
	assert.equal(secondChecks, 1);
});
