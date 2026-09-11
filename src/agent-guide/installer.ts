import { App, normalizePath, Platform, TFile } from "obsidian";
import {
	absoluteFolder, DesktopConflictError, globalGuidePath, globalSkillParent,
	pickGlobalSkillFolder, readDesktopFile, validGlobalPath, writeDesktopFile,
} from "./desktop";
import {
	decideGuideWrite,
	guideTargetPath,
	renderGuide,
	sha256,
} from "./core.mjs";

export type GuideScope = "vault" | "global";
export type GuideTarget = "agents" | "claude" | "skillPath" | "custom";
export type InstallRecord = { path: string; version: string; hash: string };
export type GuideInstalls = Partial<Record<GuideTarget, InstallRecord>>;
export type GuideStatus =
	| "installed"
	| "updated"
	| "unchanged"
	| "missing"
	| "conflict"
	| "newer"
	| "busy"
	| "error";
export type GuideResult = {
	target: GuideTarget;
	scope: GuideScope;
	path: string;
	status: GuideStatus;
	message?: string;
};

export interface GuideHost {
	app: App;
	manifest: { version: string };
	settings: {
		guideFolder: string;
		skillFolder: string;
		guideInstalls: GuideInstalls;
	};
	saveSettings(): Promise<void>;
}

type GuideMode = "manual" | "auto";
type PathState = { exists: boolean; file: TFile | null; content: string | null };

const TARGETS: GuideTarget[] = ["agents", "claude", "skillPath", "custom"];
const SKILL_TARGETS: GuideTarget[] = ["agents", "claude", "skillPath"];
const LOCAL_KEY = "mosaic:guide-imports";
type LocalState = { global: boolean; skillFolder?: string; installs: GuideInstalls };
const VERSION = /^\d+\.\d+\.\d+$/;
const HASH = /^[a-f0-9]{64}$/i;

class GuideConflictError extends Error {}
class GuideDisposedError extends Error {}

function normalizeFolder(folder: unknown, fallback: string): string {
	if (typeof folder !== "string") return fallback;
	try {
		const path = guideTargetPath("custom", folder);
		const suffix = "Mosaic-Usage-Guide.md";
		return path === suffix ? "" : path.slice(0, -(suffix.length + 1));
	} catch {
		return "";
	}
}

function validRecord(target: GuideTarget, value: unknown, scope: GuideScope = "vault"): InstallRecord | null {
	if (!value || typeof value !== "object") return null;
	const candidate = value as Partial<InstallRecord>;
	if (
		typeof candidate.path !== "string" ||
		typeof candidate.version !== "string" ||
		typeof candidate.hash !== "string" ||
		!VERSION.test(candidate.version) ||
		!HASH.test(candidate.hash)
	) {
		return null;
	}
	try {
		if (scope === "global") {
			if (!validGlobalPath(target, candidate.path)) return null;
		} else if (target === "custom" || target === "skillPath") {
			const suffix = target === "skillPath" ? "mosaic/SKILL.md" : "Mosaic-Usage-Guide.md";
			const folder =
				candidate.path === suffix
					? ""
					: candidate.path.endsWith(`/${suffix}`)
						? candidate.path.slice(0, -(suffix.length + 1))
						: null;
			if (folder === null || guideTargetPath(target, folder) !== candidate.path) {
				return null;
			}
		} else if (guideTargetPath(target, "") !== candidate.path) {
			return null;
		}
	} catch {
		return null;
	}
	return {
		path: candidate.path,
		version: candidate.version,
		hash: candidate.hash.toLowerCase(),
	};
}

function recordsEqual(left: InstallRecord | undefined, right: InstallRecord): boolean {
	return (
		left?.path === right.path &&
		left.version === right.version &&
		left.hash === right.hash
	);
}

export class GuideInstaller {
	busy = false;
	results: Partial<Record<GuideTarget, GuideResult>> = {};

	private disposed = false;
	private readonly host: GuideHost;
	private readonly body: string;
	private local: LocalState = { global: false, installs: {} };
	private localError: string | undefined;
	private globalResults: Partial<Record<GuideTarget, GuideResult>> = {};

	constructor(host: GuideHost, body: string) {
		this.host = host;
		this.body = body;
		host.settings.guideFolder = normalizeFolder(host.settings.guideFolder, "docs/guides");
		host.settings.skillFolder = normalizeFolder(host.settings.skillFolder, ".agents/skills");
		const source = host.settings.guideInstalls;
		const installs: GuideInstalls = {};
		if (source && typeof source === "object") {
			for (const target of TARGETS) {
				const record = validRecord(target, source[target]);
				if (record) installs[target] = record;
			}
		}
		host.settings.guideInstalls = installs;
		if (Platform.isDesktopApp && !Platform.isMobile) {
			try {
				const saved = host.app.loadLocalStorage(LOCAL_KEY) as Partial<LocalState> | null;
				if (saved && typeof saved === "object") {
					this.local.global = saved.global === true;
					if (typeof saved.skillFolder === "string") {
						try { this.local.skillFolder = absoluteFolder(saved.skillFolder); }
						catch (error) {
							this.remember({ target: "skillPath", scope: "global", path: "", status: "error",
								message: error instanceof Error ? error.message : String(error) });
						}
					}
					for (const target of SKILL_TARGETS) {
						const record = validRecord(target, saved.installs?.[target], "global");
						if (record) this.local.installs[target] = record;
					}
				}
			} catch (error) {
				this.localError = error instanceof Error ? error.message : String(error);
				this.local = { global: false, installs: {} };
				for (const target of SKILL_TARGETS) this.remember({ target, scope: "global", path: "", status: "error", message: this.localError });
			}
		}
	}

	get global(): boolean { return Platform.isDesktopApp && !Platform.isMobile && this.local.global; }

	get globalSkillFolder(): string {
		if (!Platform.isDesktopApp || Platform.isMobile) return "";
		try { return this.local.skillFolder ?? globalSkillParent(); }
		catch { return ""; }
	}

	getResult(target: GuideTarget, scope: GuideScope = "vault"): GuideResult | undefined {
		return (scope === "vault" ? this.results : this.globalResults)[target];
	}

	getRecord(target: GuideTarget, scope: GuideScope = "vault"): InstallRecord | undefined {
		return scope === "vault" ? this.host.settings.guideInstalls[target] :
			Platform.isDesktopApp && !Platform.isMobile ? this.local.installs[target] : undefined;
	}

	setGlobal(enabled: boolean): void {
		this.assertGlobal();
		this.saveLocal({ ...this.local, global: enabled });
	}

	setGlobalSkillFolder(folder: string): void {
		this.assertGlobal();
		this.saveLocal({ ...this.local, skillFolder: absoluteFolder(folder) });
	}

	async chooseGlobalSkillFolder(): Promise<string | null> {
		this.assertGlobal();
		const folder = await pickGlobalSkillFolder();
		this.assertActive();
		if (folder !== null) this.setGlobalSkillFolder(folder);
		return folder;
	}

	async install(target: GuideTarget, scope: GuideScope = "vault"): Promise<GuideResult> {
		let path = "";
		try {
			if (scope === "global") {
				this.assertGlobal();
				if (!this.global) throw new Error("Enable Global before importing a global skill.");
				path = globalGuidePath(target, this.local.skillFolder);
			} else {
				path = guideTargetPath(target, target === "custom" ? this.host.settings.guideFolder :
					target === "skillPath" ? this.host.settings.skillFolder : "");
			}
		} catch (error) {
			return this.remember({
				target,
				scope,
				path,
				status: "error",
				message: error instanceof Error ? error.message : String(error),
			});
		}
		if (this.busy) return this.remember({ target, scope, path, status: "busy" });
		if (this.disposed) {
			return this.remember({
				target,
				scope,
				path,
				status: "error",
				message: "Guide installer is no longer active.",
			});
		}
		this.busy = true;
		try {
			return await this.runTarget(target, scope, "manual", path);
		} finally {
			this.busy = false;
		}
	}

	async updateInstalled(): Promise<void> {
		if (this.busy || this.disposed) return;
		const scopes: GuideScope[] = Platform.isDesktopApp && !Platform.isMobile ? ["vault", "global"] : ["vault"];
		const installed = scopes.flatMap((scope) => TARGETS
			.filter((target) => this.getRecord(target, scope))
			.map((target) => ({ target, scope })));
		if (installed.length === 0) return;
		this.busy = true;
		try {
			for (const { target, scope } of installed) {
				const record = this.getRecord(target, scope);
				if (!record) continue;
				await this.runTarget(target, scope, "auto", record.path);
				if (this.disposed) break;
			}
		} finally {
			this.busy = false;
		}
	}

	dispose(): void {
		this.disposed = true;
	}

	private async runTarget(
		target: GuideTarget,
		scope: GuideScope,
		mode: GuideMode,
		rawPath: string,
	): Promise<GuideResult> {
		const record = this.getRecord(target, scope);
		const desired = renderGuide(this.body, this.host.manifest.version);
		try {
			const desiredHash = await sha256(desired);
			this.assertActive();
			const preflight = decideGuideWrite({
				mode,
				exists: false,
				currentHash: null,
				desiredHash,
				installedHash: record?.hash ?? null,
				installedVersion: record?.version ?? null,
				currentVersion: this.host.manifest.version,
			});
			if (preflight === "newer") {
				return this.remember({ target, scope, path: rawPath, status: "newer" });
			}

			if (scope === "global") {
				this.assertGlobal();
				if (!validGlobalPath(target, rawPath)) throw new Error("Invalid global skill destination.");
			}
			const path = scope === "vault" ? this.hostPath(rawPath) : rawPath;
			const hidden = path.split("/").some((part) => part.startsWith("."));
			const state: PathState = scope === "vault" ? await this.readPath(path, hidden) :
				{ ...await readDesktopFile(path), file: null };
			const currentHash = state.content === null ? null : await sha256(state.content);
			this.assertActive();
			const sameInstallation = record?.path === path ? record : undefined;
			const decision = decideGuideWrite({
				mode,
				exists: state.exists,
				currentHash,
				desiredHash,
				installedHash: sameInstallation?.hash ?? null,
				installedVersion: sameInstallation?.version ?? null,
				currentVersion: this.host.manifest.version,
			});
			if (decision === "missing" || decision === "conflict") {
				return this.remember({ target, scope, path, status: decision });
			}
			if (decision === "not-installed") {
				return this.remember({ target, scope, path, status: "missing" });
			}
			if (decision === "write") {
				if (scope === "global") {
					await writeDesktopFile(path, state.content, desired, () => this.assertActive());
				} else if (state.exists) {
					await this.updateFile(path, hidden, state, desired);
				} else {
					await this.createFile(path, hidden, desired);
				}
			}
			this.assertActive();

			const nextRecord = {
				path,
				version: this.host.manifest.version,
				hash: desiredHash,
			};
			if (!recordsEqual(record, nextRecord)) {
				await this.saveRecord(target, scope, nextRecord);
			}
			const status: GuideStatus =
				decision === "unchanged" ? "unchanged" : state.exists ? "updated" : "installed";
			return this.remember({ target, scope, path, status });
		} catch (error) {
			if (error instanceof GuideConflictError || error instanceof DesktopConflictError) {
				return this.remember({ target, scope, path: rawPath, status: "conflict" });
			}
			return this.remember({
				target,
				scope,
				path: rawPath,
				status: "error",
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private hostPath(path: string): string {
		const normalized = normalizePath(path);
		const configDir = normalizePath(this.host.app.vault.configDir);
		if (normalized === configDir || normalized.startsWith(`${configDir}/`)) {
			throw new Error("Guide destination must be outside the vault config directory.");
		}
		return normalized;
	}

	private async readPath(path: string, hidden: boolean): Promise<PathState> {
		if (hidden) {
			const stat = await this.host.app.vault.adapter.stat(path);
			this.assertActive();
			if (!stat) return { exists: false, file: null, content: null };
			if (stat.type !== "file") throw new Error(`Guide destination is a folder: ${path}`);
			const content = await this.host.app.vault.adapter.read(path);
			this.assertActive();
			return { exists: true, file: null, content };
		}
		if (this.host.app.vault.getFolderByPath(path)) {
			throw new Error(`Guide destination is a folder: ${path}`);
		}
		const file = this.host.app.vault.getFileByPath(path);
		if (!file) return { exists: false, file: null, content: null };
		const content = await this.host.app.vault.read(file);
		this.assertActive();
		return { exists: true, file, content };
	}

	private async createFile(path: string, hidden: boolean, desired: string): Promise<void> {
		await this.ensureParents(path, hidden);
		this.assertActive();
		if (hidden) {
			await this.host.app.vault.adapter.write(path, desired);
		} else {
			await this.host.app.vault.create(path, desired);
		}
	}

	private async updateFile(
		path: string,
		hidden: boolean,
		state: PathState,
		desired: string,
	): Promise<void> {
		this.assertActive();
		const replace = (current: string): string => {
			this.assertActive();
			if (current !== state.content) throw new GuideConflictError();
			return desired;
		};
		if (hidden) {
			await this.host.app.vault.adapter.process(path, replace);
		} else if (state.file) {
			await this.host.app.vault.process(state.file, replace);
		}
	}

	private async ensureParents(path: string, hidden: boolean): Promise<void> {
		const parts = path.split("/").slice(0, -1);
		let parent = "";
		for (const part of parts) {
			parent = parent ? `${parent}/${part}` : part;
			if (hidden) {
				const stat = await this.host.app.vault.adapter.stat(parent);
				this.assertActive();
				if (stat?.type === "file") throw new Error(`Guide parent is a file: ${parent}`);
				if (!stat) {
					await this.host.app.vault.adapter.mkdir(parent);
				}
			} else {
				if (this.host.app.vault.getFileByPath(parent)) {
					throw new Error(`Guide parent is a file: ${parent}`);
				}
				if (!this.host.app.vault.getFolderByPath(parent)) {
					this.assertActive();
					await this.host.app.vault.createFolder(parent);
				}
			}
		}
	}

	private async saveRecord(target: GuideTarget, scope: GuideScope, record: InstallRecord): Promise<void> {
		if (scope === "global") {
			this.saveLocal({ ...this.local, installs: { ...this.local.installs, [target]: record } });
			return;
		}
		const previous = this.host.settings.guideInstalls;
		this.host.settings.guideInstalls = { ...previous, [target]: record };
		try {
			await this.host.saveSettings();
		} catch (error) {
			this.host.settings.guideInstalls = previous;
			throw error;
		}
	}

	private assertActive(): void {
		if (this.disposed) throw new GuideDisposedError("Guide installer is no longer active.");
	}

	private assertGlobal(): void {
		this.assertActive();
		if (!Platform.isDesktopApp || Platform.isMobile) throw new Error("Global imports require the desktop app.");
		if (this.localError) throw new Error(`Device-local settings unavailable: ${this.localError}`);
	}

	private saveLocal(next: LocalState): void {
		this.assertGlobal();
		this.host.app.saveLocalStorage(LOCAL_KEY, next);
		this.local = next;
	}

	private remember(result: GuideResult): GuideResult {
		(result.scope === "vault" ? this.results : this.globalResults)[result.target] = result;
		return result;
	}
}
