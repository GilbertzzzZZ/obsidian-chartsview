// tests/helpers/obsidian-stub.mjs
// 打包测试用的 `obsidian` 替身：宿主包本身只发布 .d.ts，运行期没有任何实现。
// 只提供本仓库真正调用到的那几个符号。
export const apiVersion = "1.13.7";

// 图标注入：真身把一段 lucide svg 写进 innerHTML。这里落成一个属性，断言看得见
// 「哪个按钮挂了哪个图标」，又不必真的搬一套 svg 进来。
export function setIcon(el, icon) {
	el.setAttribute("data-icon", icon);
}

export function normalizePath(path) {
	return String(path);
}

export class Component {
	constructor() {
		this.registeredEvents = [];
	}
	registerEvent(event) {
		this.registeredEvents.push(event);
		return event;
	}
	onunload() {}
	onload() {}
}
export class MarkdownRenderChild extends Component {
	constructor(containerEl) {
		super();
		this.containerEl = containerEl;
	}
}
export class Plugin extends Component {
	constructor(app, manifest = { version: "1.1.6" }) {
		super();
		this.app = app;
		this.manifest = manifest;
		this.data = null;
		this.savedData = [];
		this.settingTabs = [];
		this.codeBlockProcessors = [];
		this.postProcessors = [];
		this.extensions = [];
	}
	async loadData() {
		return this.data;
	}
	async saveData(data) {
		this.savedData.push(data);
	}
	addSettingTab(tab) {
		this.settingTabs.push(tab);
	}
	registerMarkdownCodeBlockProcessor(language, processor) {
		this.codeBlockProcessors.push({ language, processor });
	}
	registerMarkdownPostProcessor(processor) {
		this.postProcessors.push(processor);
	}
	registerExtensions(extensions, viewType) {
		this.extensions.push({ extensions, viewType });
	}
}
export class PluginSettingTab {
	constructor(app, plugin) {
		this.app = app;
		this.plugin = plugin;
		this.updateCalls = 0;
	}
	update() {
		this.updateCalls++;
	}
}
export class Setting {
	constructor() {}
	setName() {
		return this;
	}
	setDesc() {
		return this;
	}
	addToggle() {
		return this;
	}
}
export class MarkdownView {}
export class TFile {}
export class App {}
export class WorkspaceLeaf {}

export class Notice {
	static messages = [];
	constructor(message) {
		this.message = String(message);
		Notice.messages.push(this.message);
	}
}
