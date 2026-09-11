import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBlockSource } from "../src/parse/block-source.mjs";
import { COMPONENT_NAMES } from "../src/parse/chart-tag.mjs";
import {
	parseDatasetData,
	parseDatasetManifest,
} from "../src/parse/dataset-loader.mjs";
import {
	document,
	flush,
	installGlobals,
	query,
} from "./helpers/dom.mjs";

installGlobals();
const { loadComponents } = await import("./helpers/bundle.mjs");
const { BLOCK_LANGUAGES, createBlockProcessor } = await loadComponents();

const readGuide = () =>
	readFileSync(new URL("../src/agent-guide/mosaic.md", import.meta.url), "utf8");

function section(body, heading) {
	const start = body.indexOf(`## ${heading}\n`);
	assert.notEqual(start, -1, `missing ${heading} section`);
	const contentStart = start + `## ${heading}\n`.length;
	const end = body.indexOf("\n---\n\n## ", contentStart);
	return body.slice(contentStart, end === -1 ? undefined : end);
}

function blockExamples(body) {
	return [
		...body.matchAll(
			/^```(chart|datatable|metricgrid|timeline|decisionbox|flowdiagram)\n([\s\S]*?)^```$/gm,
		),
	];
}

test("the shipped guide contains valid examples for every block", () => {
	const examples = blockExamples(section(readGuide(), "Inline examples"));
	assert.deepEqual(
		[...new Set(examples.map((match) => match[1]))].sort(),
		COMPONENT_NAMES.map((name) => name.toLowerCase()).sort(),
	);
	for (const [, language, source] of examples) {
		const parsed = parseBlockSource(source);
		assert.deepEqual(parsed.unrecognized, [], language);
		assert.ok(Object.keys(parsed.attributes).length > 0, language);
	}
});

test("the guide states the bounded generation rules agents must follow", () => {
	const body = readGuide();
	const requiredRules = [
		/`line`, `bar`, `grouped-bar`, `stacked-bar`, `combo`, and `combo-dual-axis`/,
		/Inline Chart requires a header row and at least one data row/,
		/Use `unit` for a single-axis chart/,
		/Use `leftUnit` and `rightUnit` for `combo-dual-axis`/,
		/`labels`.*`<field>Label`/,
		/Every Y axis includes zero/,
		/Do not generate `yMin` or `yMax`/,
		/Self-closing tags are for external-dataset Chart and DataTable blocks only/,
		/non-empty cells beyond the CSV header width/,
		/ask the user before writing the block/,
		/Never invent user data or an aggregation definition/,
	];
	for (const rule of requiredRules) assert.match(body, rule);
});

test("every inline guide example renders its intended block", async () => {
	const selectors = {
		chart: "[data-plot]",
		datatable: "table",
		metricgrid: ".mosaic-metric-item",
		timeline: ".mosaic-timeline-item",
		decisionbox: ".mosaic-decision-list",
		flowdiagram: "svg",
	};
	const examples = blockExamples(section(readGuide(), "Inline examples"));

	for (const [, language, source] of examples) {
		const el = document.createElement("div");
		document.body.appendChild(el);
		const teardowns = [];
		const plugin = {
			isUnloading: false,
			settings: { showExportBtn: false },
			manifest: { version: "1.0.0" },
			registerTeardown(teardown) {
				teardowns.push(teardown);
				return teardown;
			},
			app: {},
		};
		const ctx = {
			sourcePath: "guide-example.md",
			addChild() {},
			getSectionInfo: () => null,
		};

		try {
			await createBlockProcessor(plugin, BLOCK_LANGUAGES[language], language)(
				source,
				el,
				ctx,
			);
			await flush();
			assert.equal(query(el, ".mosaic-error"), null, language);
			assert.equal(
				query(el, ".mosaic-figure-warning"),
				null,
				`${language} produced a semantic warning`,
			);
			assert.notEqual(query(el, selectors[language]), null, language);
		} finally {
			for (const teardown of teardowns) teardown();
			el.remove();
		}
	}
});

test("the external dataset example is complete and used without inline data", () => {
	const external = section(readGuide(), "External dataset");
	const manifests = [...external.matchAll(/^```json\n([\s\S]*?)^```$/gm)];
	const dataFiles = [...external.matchAll(/^```csv\n([\s\S]*?)^```$/gm)];
	assert.equal(manifests.length, 1);
	assert.equal(dataFiles.length, 1);

	const manifest = parseDatasetManifest(
		manifests[0][1],
		"data/monthly.dataset.json",
	);
	const rows = parseDatasetData(manifest, dataFiles[0][1]);
	assert.equal(rows.length, 2);
	assert.deepEqual(
		rows.map((row) => row.Amount),
		[80, 120],
	);

	const references = blockExamples(external);
	assert.deepEqual(
		references.map(([, language]) => language).sort(),
		["chart", "datatable"],
	);
	for (const [, language, source] of references) {
		const parsed = parseBlockSource(source);
		assert.equal(parsed.attributes.dataset, "data/monthly.dataset.json", language);
		assert.equal(parsed.body, null, language);
	}
});
