import test from "node:test";
import assert from "node:assert/strict";
import { installGlobals } from "./helpers/dom.mjs";
import { loadComponents } from "./helpers/bundle.mjs";

installGlobals();
const { MosaicPlugin, MosaicSettingTab, Notice } = await loadComponents();

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
		settings: { showExportBtn: false, guideFolder: "", guideInstalls: {} },
		guideInstaller: {
			busy: false,
			results: {},
			async install(target) {
				calls.push(target);
				const paths = {
					agents: ".agents/skills/mosaic/SKILL.md",
					claude: ".claude/skills/mosaic/SKILL.md",
					custom: "Reference/Mosaic-Usage-Guide.md",
				};
				return { target, path: paths[target], status: "installed" };
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
		guideFolder: "",
		guideInstalls: {},
	});
	assert.deepEqual(second.settings, {
		showExportBtn: false,
		guideFolder: "",
		guideInstalls: {},
	});
	assert.notEqual(first.settings.guideInstalls, second.settings.guideInstalls);
});

test("declarative guide controls target Agents, Claude, and the chosen folder", async () => {
	Notice.messages.length = 0;
	const { plugin, calls } = settingsPlugin();
	const tab = new MosaicSettingTab({}, plugin);
	const definitions = tab.getSettingDefinitions();
	const agentRow = settingRow();
	definitions.find((item) => item.name === "Agent skills").render(agentRow, null);

	assert.deepEqual(agentRow.buttons.map((button) => button.text), ["Agents", "Claude"]);
	await agentRow.buttons[0].click();
	await agentRow.buttons[1].click();
	assert.deepEqual(calls, ["agents", "claude"]);
	assert.equal(tab.updateCalls, 4);
	assert.deepEqual(Notice.messages, [
		"Installed .agents/skills/mosaic/SKILL.md.",
		"Installed .claude/skills/mosaic/SKILL.md.",
	]);

	const folder = definitions.find((item) => item.name === "Guide folder");
	assert.deepEqual(folder.control, {
		type: "folder",
		key: "guideFolder",
		defaultValue: "",
		includeRoot: true,
	});
	await tab.setControlValue("guideFolder", "Reference");
	assert.equal(plugin.settings.guideFolder, "Reference");
	assert.equal(plugin.previewRebuilds ?? 0, 0);

	const guideRow = settingRow();
	definitions.find((item) => item.name === "Usage guide").render(guideRow, null);
	assert.deepEqual(guideRow.buttons.map((button) => button.text), ["Write guide"]);
	await guideRow.buttons[0].click();
	assert.deepEqual(calls, ["agents", "claude", "custom"]);
	assert.equal(
		Notice.messages.at(-1),
		"Installed Reference/Mosaic-Usage-Guide.md. Ask your agent to read this file before creating Mosaic content.",
	);
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

	const definitions = new MosaicSettingTab({}, plugin).getSettingDefinitions();
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
	const { plugin } = settingsPlugin({
		guideInstaller: {
			busy: false,
			results: {},
			async install() {
				throw new Error("vault unavailable");
			},
		},
	});
	const tab = new MosaicSettingTab({}, plugin);
	const row = settingRow();
	tab.getSettingDefinitions().find((item) => item.name === "Agent skills").render(row, null);

	await assert.doesNotReject(row.buttons[0].click());
	assert.equal(tab.updateCalls, 2);
	assert.deepEqual(Notice.messages, ["Could not install Mosaic guidance: vault unavailable"]);
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
