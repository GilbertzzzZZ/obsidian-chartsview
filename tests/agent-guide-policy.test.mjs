import test from "node:test";
import assert from "node:assert/strict";
import {
	decideGuideWrite,
	guideTargetPath,
	renderGuide,
	sha256,
} from "../src/agent-guide/core.mjs";

test("three destinations use the agreed names", () => {
	assert.equal(guideTargetPath("agents", ""), ".agents/skills/mosaic/SKILL.md");
	assert.equal(guideTargetPath("claude", ""), ".claude/skills/mosaic/SKILL.md");
	assert.equal(
		guideTargetPath("custom", "Reference"),
		"Reference/Mosaic-Usage-Guide.md",
	);
	assert.equal(guideTargetPath("custom", ""), "Mosaic-Usage-Guide.md");
});

test("automatic updates never recreate a missing guide", () => {
	assert.equal(
		decideGuideWrite({
			mode: "auto",
			exists: false,
			currentHash: null,
			desiredHash: "next",
			installedHash: "previous",
			installedVersion: "1.1.6",
			currentVersion: "1.1.7",
		}),
		"missing",
	);
});

test("locally edited files are preserved", () => {
	assert.equal(
		decideGuideWrite({
			mode: "auto",
			exists: true,
			currentHash: "user-edit",
			desiredHash: "next",
			installedHash: "previous",
			installedVersion: "1.1.6",
			currentVersion: "1.1.7",
		}),
		"conflict",
	);
});

test("custom folders normalize separators and redundant current segments", () => {
	assert.equal(
		guideTargetPath("custom", " ./Reference\\agents//./ "),
		"Reference/agents/Mosaic-Usage-Guide.md",
	);
});

test("custom folders reject paths outside the vault", () => {
	for (const folder of [
		"/Reference",
		"\\\\server\\share",
		"C:\\Reference",
		"file:Reference",
		"../Reference",
		"Reference/../Other",
		"~/Reference",
		"~someone/Reference",
		"Reference\u0000",
	]) {
		assert.throws(() => guideTargetPath("custom", folder), /vault-relative/);
	}
});

test("guide wrapper uses the plugin version and one managed body", () => {
	assert.equal(
		renderGuide("\n# Mosaic usage\n", "1.2.3"),
		[
			"---",
			"name: mosaic",
			"description: Create and edit Mosaic charts, tables, metric cards, timelines, decision records, and flow diagrams in Obsidian notes.",
			"metadata:",
			'  mosaic-version: "1.2.3"',
			"---",
			"",
			"<!-- Managed by Mosaic. Local edits pause automatic updates. Rename or remove this file to stop updates at this path. -->",
			"",
			"# Mosaic usage",
			"",
		].join("\n"),
	);
});

test("sha256 returns the browser-compatible digest", async () => {
	assert.equal(
		await sha256("Mosaic"),
		"6a7777b75458adf9a824414623537e137d8442f314dc6dc5e711e5e9329aa748",
	);
});

test("write decisions follow installation ownership before content state", () => {
	const common = {
		currentHash: "previous",
		desiredHash: "next",
		installedHash: "previous",
		installedVersion: "1.9.9",
		currentVersion: "1.10.0",
	};
	assert.equal(decideGuideWrite({ ...common, mode: "manual", exists: false }), "write");
	assert.equal(decideGuideWrite({ ...common, mode: "auto", exists: true }), "write");
	assert.equal(
		decideGuideWrite({ ...common, mode: "auto", exists: true, currentHash: "next" }),
		"unchanged",
	);
	assert.equal(
		decideGuideWrite({
			...common,
			mode: "auto",
			exists: true,
			installedHash: null,
			installedVersion: null,
		}),
		"not-installed",
	);
	assert.equal(
		decideGuideWrite({
			...common,
			mode: "auto",
			exists: false,
			installedVersion: "1.10.0",
			currentVersion: "1.9.9",
		}),
		"newer",
	);
});
