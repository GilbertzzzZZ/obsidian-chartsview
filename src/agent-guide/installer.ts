import { App, normalizePath, TFile } from "obsidian";
import {
	decideGuideWrite,
	guideTargetPath,
	renderGuide,
	sha256,
} from "./core.mjs";

export type GuideTarget = "agents" | "claude" | "custom";
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
	path: string;
	status: GuideStatus;
	message?: string;
};

export interface GuideHost {
	app: App;
	manifest: { version: string };
	settings: {
		guideFolder: string;
		guideInstalls: GuideInstalls;
	};
	saveSettings(): Promise<void>;
}

type GuideMode = "manual" | "auto";
type PathState = { exists: boolean; file: TFile | null; content: string | null };

const TARGETS: GuideTarget[] = ["agents", "claude", "custom"];
const VERSION = /^\d+\.\d+\.\d+$/;
const HASH = /^[a-f0-9]{64}$/i;

class GuideConflictError extends Error {}
class GuideDisposedError extends Error {}

function normalizeFolder(folder: unknown): string {
	if (typeof folder !== "string") return "";
	try {
		const path = guideTargetPath("custom", folder);
		const suffix = "Mosaic-Usage-Guide.md";
		return path === suffix ? "" : path.slice(0, -(suffix.length + 1));
	} catch {
		return "";
	}
}

function validRecord(target: GuideTarget, value: unknown): InstallRecord | null {
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
		if (target === "custom") {
			const suffix = "Mosaic-Usage-Guide.md";
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

	constructor(host: GuideHost, body: string) {
		this.host = host;
		this.body = body;
		host.settings.guideFolder = normalizeFolder(host.settings.guideFolder);
		const source = host.settings.guideInstalls;
		const installs: GuideInstalls = {};
		if (source && typeof source === "object") {
			for (const target of TARGETS) {
				const record = validRecord(target, source[target]);
				if (record) installs[target] = record;
			}
		}
		host.settings.guideInstalls = installs;
	}

	async install(target: GuideTarget): Promise<GuideResult> {
		let path = "";
		try {
			path = guideTargetPath(
				target,
				target === "custom" ? this.host.settings.guideFolder : "",
			);
		} catch (error) {
			return this.remember({
				target,
				path,
				status: "error",
				message: error instanceof Error ? error.message : String(error),
			});
		}
		if (this.busy) return this.remember({ target, path, status: "busy" });
		if (this.disposed) {
			return this.remember({
				target,
				path,
				status: "error",
				message: "Guide installer is no longer active.",
			});
		}
		this.busy = true;
		try {
			return await this.runTarget(target, "manual", path);
		} finally {
			this.busy = false;
		}
	}

	async updateInstalled(): Promise<void> {
		if (this.busy || this.disposed) return;
		const installed = TARGETS.filter(
			(target) => this.host.settings.guideInstalls[target],
		);
		if (installed.length === 0) return;
		this.busy = true;
		try {
			for (const target of installed) {
				const record = this.host.settings.guideInstalls[target];
				if (!record) continue;
				await this.runTarget(target, "auto", record.path);
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
		mode: GuideMode,
		rawPath: string,
	): Promise<GuideResult> {
		const record = this.host.settings.guideInstalls[target];
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
				return this.remember({ target, path: rawPath, status: "newer" });
			}

			const path = this.hostPath(rawPath);
			const hidden = path.split("/").some((part) => part.startsWith("."));
			const state = await this.readPath(path, hidden);
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
				return this.remember({ target, path, status: decision });
			}
			if (decision === "not-installed") {
				return this.remember({ target, path, status: "missing" });
			}
			if (decision === "write") {
				if (state.exists) {
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
				await this.saveRecord(target, nextRecord);
			}
			const status: GuideStatus =
				decision === "unchanged" ? "unchanged" : state.exists ? "updated" : "installed";
			return this.remember({ target, path, status });
		} catch (error) {
			if (error instanceof GuideConflictError) {
				return this.remember({ target, path: rawPath, status: "conflict" });
			}
			return this.remember({
				target,
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

	private async saveRecord(target: GuideTarget, record: InstallRecord): Promise<void> {
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

	private remember(result: GuideResult): GuideResult {
		this.results[result.target] = result;
		return result;
	}
}
