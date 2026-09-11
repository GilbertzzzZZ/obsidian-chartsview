import { App, Notice, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type MosaicPlugin from "./main";
import type {
	GuideInstalls,
	GuideResult,
	GuideTarget,
} from "./agent-guide/installer";

export interface MosaicPluginSettings {
	showExportBtn: boolean;
	guideFolder: string;
	skillFolder: string;
	guideInstalls: GuideInstalls;
}

export const DEFAULT_SETTINGS: MosaicPluginSettings = {
	showExportBtn: false,
	guideFolder: "docs/guides",
	skillFolder: ".agents/skills",
	guideInstalls: {},
};

// 控件 key 就是设置字段名。写成常量而不是各处重复字面量：改字段名时
// getControlValue / setControlValue 会跟着编译期报错，不会只改一半。
const SHOW_EXPORT_BTN = "showExportBtn" satisfies keyof MosaicPluginSettings;
const GUIDE_FOLDER = "guideFolder" satisfies keyof MosaicPluginSettings;

const CUSTOM_GUIDE_PROMPT =
	"Ask your agent to read this file before creating Mosaic content.";

function guideOperationFailure(result: GuideResult): string {
	const location = result.path ? ` at ${result.path}` : "";
	const detail = result.message ? `: ${result.message}` : "";
	return `Guide operation failed${location}${detail}.`;
}

function targetDescription(
	label: string,
	target: GuideTarget,
	plugin: MosaicPlugin,
): string | undefined {
	const result = plugin.guideInstaller.results[target];
	if (!result) {
		const record = plugin.settings.guideInstalls[target];
		return record ? `${label}: installed at ${record.path}.` : undefined;
	}
	const path = result.path ? ` at ${result.path}` : "";
	switch (result.status) {
		case "installed":
			return `${label}: installed${path}.`;
		case "updated":
			return `${label}: updated${path}.`;
		case "unchanged":
			return `${label}: current${path}.`;
		case "missing":
			return `${label}: installed guide missing${path}.`;
		case "conflict":
			return `${label}: local changes kept${path}.`;
		case "newer":
			return `${label}: newer guide kept${path}.`;
		case "busy":
			return `${label}: another guide operation is running.`;
		case "error":
			return guideOperationFailure(result);
	}
}

function resultNotice(result: GuideResult): string {
	const path = result.path ? ` ${result.path}` : "";
	let message: string;
	switch (result.status) {
		case "installed":
			message = `Installed${path}.`;
			break;
		case "updated":
			message = `Updated${path}.`;
			break;
		case "unchanged":
			message = `Mosaic guidance is current at${path}.`;
			break;
		case "missing":
			message = `Installed guide is missing at${path}.`;
			break;
		case "conflict":
			message = `Local changes kept at${path}.`;
			break;
		case "newer":
			message = `Newer guide kept at${path}.`;
			break;
		case "busy":
			message = "Another guide operation is already running.";
			break;
		case "error":
			message = guideOperationFailure(result);
			break;
	}
	if (
		result.target === "custom" &&
		(result.status === "installed" ||
			result.status === "updated" ||
			result.status === "unchanged")
	) {
		return `${message} ${CUSTOM_GUIDE_PROMPT}`;
	}
	return message;
}

// 声明式设置（1.13.0 起）而不是 display()：只有声明出来的设置项才进得了 Obsidian
// 设置页的搜索索引，用 display() 手工画的那份对搜索是隐形的。本插件的 minAppVersion
// 就是 1.13.0，所以不保留 display() 那条向下兼容的老路——它已被官方标记废弃，且
// getSettingDefinitions 返回非空时宿主根本不会调用它。
export class MosaicSettingTab extends PluginSettingTab {
	private readonly plugin: MosaicPlugin;

	constructor(app: App, plugin: MosaicPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const agentStatus = [
			targetDescription("Agents", "agents", this.plugin),
			targetDescription("Claude", "claude", this.plugin),
		].filter(Boolean);
		const customStatus = targetDescription("Guide", "custom", this.plugin);
		return [
			{
				name: "Show export button",
				desc: "Add a PNG export button to the controls above each chart.",
				control: {
					type: "toggle",
					key: SHOW_EXPORT_BTN,
					defaultValue: DEFAULT_SETTINGS.showExportBtn,
				},
			},
			{
				name: "Agent skills",
				desc: [
					"Install Mosaic guidance in this vault. Unmodified installed files follow plugin updates.",
					...agentStatus,
				].join(" "),
				render: (setting) => {
					setting.addButton((button) =>
						button
							.setButtonText("Agents")
							.setDisabled(this.plugin.guideInstaller.busy)
							.onClick(() => this.installAndRefresh("agents")),
					);
					setting.addButton((button) =>
						button
							.setButtonText("Claude")
							.setDisabled(this.plugin.guideInstaller.busy)
							.onClick(() => this.installAndRefresh("claude")),
					);
				},
			},
			{
				name: "Guide folder",
				desc: "Choose a folder in this vault for Mosaic-Usage-Guide.md.",
				control: {
					type: "folder",
					key: GUIDE_FOLDER,
					defaultValue: DEFAULT_SETTINGS.guideFolder,
					includeRoot: true,
				},
			},
			{
				name: "Usage guide",
				desc: [
					"Write the same guidance as a document for your agent to read.",
					customStatus,
					CUSTOM_GUIDE_PROMPT,
				].filter(Boolean).join(" "),
				render: (setting) => {
					setting.addButton((button) =>
						button
							.setButtonText("Write guide")
							.setDisabled(this.plugin.guideInstaller.busy)
							.onClick(() => this.installAndRefresh("custom")),
					);
				},
			},
		];
	}

	private async installAndRefresh(target: GuideTarget): Promise<void> {
		try {
			const install = this.plugin.guideInstaller.install(target);
			this.update();
			const result = await install;
			new Notice(resultNotice(result));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Could not install Mosaic guidance: ${message}`);
		} finally {
			this.update();
		}
	}

	// 基类的默认实现读写宿主自己的配置存储；本插件的设置在 plugin.settings 里，
	// 两个方向都要接管，否则开关读到的和写下去的不是同一份数据。
	getControlValue(key: string): unknown {
		if (key === SHOW_EXPORT_BTN) return this.plugin.settings.showExportBtn;
		if (key === GUIDE_FOLDER) return this.plugin.settings.guideFolder;
		return undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === GUIDE_FOLDER) {
			this.plugin.settings.guideFolder = typeof value === "string" ? value : "";
			await this.plugin.saveSettings();
			return;
		}
		if (key === SHOW_EXPORT_BTN) {
			this.plugin.settings.showExportBtn = Boolean(value);
			await this.plugin.saveSettings();
			// 已经渲染出来的图表读的是渲染那一刻的设置值。不重建的话，开关只对之后才
			// 打开的笔记生效，看上去就是「开了没反应」。
			this.plugin.rerenderOpenPreviews();
		}
	}
}
