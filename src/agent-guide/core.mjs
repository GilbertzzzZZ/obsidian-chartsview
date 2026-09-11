/** @typedef {"agents" | "claude" | "custom"} GuideTarget */
/** @typedef {"manual" | "auto"} GuideMode */
/** @typedef {"write" | "unchanged" | "missing" | "conflict" | "not-installed" | "newer"} GuideWriteDecision */

/**
 * @param {GuideTarget} target
 * @param {string} folder
 * @returns {string}
 */
export function guideTargetPath(target, folder) {
	if (target === "agents") return ".agents/skills/mosaic/SKILL.md";
	if (target === "claude") return ".claude/skills/mosaic/SKILL.md";
	if (target === "custom") {
		const source = String(folder ?? "").trim();
		if (
			/^[\\/]/.test(source) ||
			/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(source) ||
			/^~/.test(source) ||
			/[\u0000-\u001f\u007f]/.test(source)
		) {
			throw new Error("Guide folder must be a vault-relative path.");
		}
		const parts = source.replaceAll("\\", "/").split("/");
		if (parts.includes("..")) {
			throw new Error("Guide folder must be a vault-relative path.");
		}
		const prefix = parts.filter((part) => part && part !== ".").join("/");
		return prefix ? `${prefix}/Mosaic-Usage-Guide.md` : "Mosaic-Usage-Guide.md";
	}
	throw new Error(`Unknown guide target: ${String(target)}`);
}

/**
 * @param {string} body
 * @param {string} version
 * @returns {string}
 */
export function renderGuide(body, version) {
	return [
		"---",
		"name: mosaic",
		"description: Create and edit Mosaic charts, tables, metric cards, timelines, decision records, and flow diagrams in Obsidian notes.",
		"metadata:",
		`  mosaic-version: "${version}"`,
		"---",
		"",
		"<!-- Managed by Mosaic. Local edits pause automatic updates. Rename or remove this file to stop updates at this path. -->",
		"",
		body.trim(),
		"",
	].join("\n");
}

/**
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function sha256(text) {
	const bytes = new TextEncoder().encode(text);
	const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

/** @param {string} left @param {string} right @returns {number} */
function compareVersions(left, right) {
	const a = left.split(".").map(Number);
	const b = right.split(".").map(Number);
	for (let index = 0; index < 3; index++) {
		if (a[index] !== b[index]) return a[index] - b[index];
	}
	return 0;
}

/**
 * @param {{
 *   mode: GuideMode,
 *   exists: boolean,
 *   currentHash: string | null,
 *   desiredHash: string,
 *   installedHash: string | null,
 *   installedVersion: string | null,
 *   currentVersion: string,
 * }} input
 * @returns {GuideWriteDecision}
 */
export function decideGuideWrite(input) {
	if (input.mode === "auto" && (!input.installedHash || !input.installedVersion)) {
		return "not-installed";
	}
	if (
		input.installedVersion &&
		compareVersions(input.installedVersion, input.currentVersion) > 0
	) {
		return "newer";
	}
	if (!input.exists) return input.mode === "manual" ? "write" : "missing";
	if (input.currentHash === input.desiredHash) return "unchanged";
	return input.currentHash === input.installedHash ? "write" : "conflict";
}
