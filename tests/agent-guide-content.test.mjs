import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBlockSource } from "../src/parse/block-source.mjs";
import { COMPONENT_NAMES, findComponentTags } from "../src/parse/chart-tag.mjs";
import { queryDataset } from "../src/parse/dataset-query.mjs";
import { extractRows, metricItem, timelineItem, decisionItems, parseRichBlocks } from "../src/parse/blocks/payload.mjs";
import { extractFlowDiagram } from "../src/parse/blocks/flow.mjs";
import {
	parseDatasetData,
	parseDatasetManifest,
} from "../src/parse/dataset-loader.mjs";
import {
	document,
	flush,
	installGlobals,
	query,
	queryAll,
} from "./helpers/dom.mjs";

installGlobals();
const { loadComponents } = await import("./helpers/bundle.mjs");
const { BLOCK_LANGUAGES, createBlockProcessor, createChartTagProcessor, TFile } = await loadComponents();

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

test("the guide demonstrates every supported chart type with runnable data", () => {
	const types = new Set(blockExamples(readGuide())
		.filter(([, language]) => language === "chart")
		.map(([, , source]) => parseBlockSource(source).attributes.type));
	for (const type of ["line", "bar", "grouped-bar", "stacked-bar", "combo", "combo-dual-axis"]) {
		assert.ok(types.has(type), `guide has no runnable ${type} example`);
	}
});

test("the worked card examples carry statuses, context, formatting and connected branches", () => {
	const examples = blockExamples(section(readGuide(), "Inline examples"));
	const payloads = (language) => examples.filter(([, name]) => name === language)
		.map(([, , source]) => parseBlockSource(source).body);
	const metrics = payloads("metricgrid").flatMap((body) => extractRows(body).map(metricItem));
	assert.ok(metrics.some((item) => item.delta && item.note && item.status === "good"), "missing contextual metric");
	assert.ok(metrics.some((item) => item.status === "risk"), "missing risk metric");
	const milestones = payloads("timeline").flatMap((body) => extractRows(body).map(timelineItem));
	assert.ok(milestones.some((item) => item.owner && item.body && item.status === "blocked"), "missing owned blocked milestone");
	const decisions = payloads("decisionbox");
	assert.ok(decisions.some((body) => decisionItems(extractRows(body)).some((item) => String(item.value).includes("**"))), "missing formatted decision");
	assert.ok(decisions.some((body) => decisionItems(extractRows(body)).length === 0 && parseRichBlocks(body).length >= 3), "missing rich-text fallback");
	const graphs = payloads("flowdiagram").map(extractFlowDiagram);
	assert.ok(graphs.some((graph) => graph.nodes.some((node) => node.type === "decision" && node.note)
		&& graph.edges.filter((edge) => edge.label).length >= 2), "missing labeled decision branches");
});

test("the mapped dataset example produces a weighted quarterly ratio from its own source", () => {
	const body = section(readGuide(), "Mapped dataset and rollups");
	const manifest = parseDatasetManifest([...body.matchAll(/^```json\n([\s\S]*?)^```$/gm)][0][1]);
	const rows = parseDatasetData(manifest, [...body.matchAll(/^```csv\n([\s\S]*?)^```$/gm)][0][1]);
	assert.equal(rows.length, 3);
	assert.deepEqual(rows.map((row) => row.Visits), [1200, 1800, 1000]);
	const result = queryDataset({ manifest, rows, component: "DataTable", attributes: { columns: "Date,Orders,Visits,Conversion" }, granularity: "quarter", granularityOptions: ["month", "quarter"] });
	assert.deepEqual(result.rows, [{ Date: "2026-Q1", Orders: 200, Visits: 4000, Conversion: 5 }]);
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

test("every runnable guide block renders from its actual inline or bundled external data", async () => {
	const selectors = {
		chart: "[data-plot]",
		datatable: "table",
		metricgrid: ".mosaic-metric-item",
		timeline: ".mosaic-timeline-item",
		decisionbox: ".mosaic-decision-list",
		flowdiagram: "svg",
	};
	const body = readGuide();
	const examples = blockExamples(body);
	const negativeExamples = [...body.matchAll(/^```(chart|metricgrid) invalid\n([\s\S]*?)^```$/gm)];
	assert.equal(negativeExamples.length, 2, "the deliberate failures must remain testable");
	for (const [raw, language, source] of negativeExamples) examples.push([raw, language, source, "invalid"]);
	const tagExamples = [...body.matchAll(/^(`{3,4})text\n(<[\s\S]*?)^\1$/gm)];
	assert.equal(tagExamples.length, 4, "paired CSV/TSV and both external references are demonstrated");
	for (const [, , source] of tagExamples) {
		const tags = findComponentTags(source);
		assert.equal(tags.length, 1, "tag example must parse as one complete component");
		examples.push([source, tags[0].name.toLowerCase(), source, "tag"]);
	}
	const files = new Map([...body.matchAll(/^### `(data\/[^`]+)`\n\n```(?:json|csv)\n([\s\S]*?)^```$/gm)]
		.map(([, path, contents]) => [path, contents]));

	for (const [, language, source, kind] of examples) {
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
			app: { vault: {
				getAbstractFileByPath(path) { return files.has(path) ? Object.assign(new TFile(), { path }) : null; },
				async cachedRead(file) { return files.get(file.path); },
			} },
		};
		const ctx = {
			sourcePath: "guide-example.md",
			addChild() {},
			getSectionInfo: () => kind === "tag" ? { text: source, lineStart: 0, lineEnd: source.split("\n").length - 1 } : null,
		};

		try {
			if (kind === "tag") await createChartTagProcessor(plugin)(el, ctx);
			else await createBlockProcessor(plugin, BLOCK_LANGUAGES[language], language)(source, el, ctx);
			await flush();
			if (kind === "invalid") {
				const error = query(el, ".mosaic-error")?.textContent ?? "";
				assert.match(error, language === "chart" ? /Inline data does not support the "granularity" attribute/ : /External datasets support Chart and DataTable/);
				assert.equal(query(el, selectors[language]), null, "negative example must not render a success view");
				continue;
			}
			assert.equal(query(el, ".mosaic-error")?.textContent, undefined, language);
			assert.equal(
				query(el, ".mosaic-figure-warning"),
				null,
				`${language} produced a semantic warning`,
			);
			const parsed = kind === "tag" ? findComponentTags(source)[0] : parseBlockSource(source);
			const selector = language === "decisionbox" && decisionItems(extractRows(parsed.body)).length === 0
				? ".mosaic-decision-body" : selectors[language];
			assert.notEqual(query(el, selector), null, `${language}: ${parsed.attributes.title}`);
			if (language === "decisionbox") {
				assert.notEqual(query(el, "strong"), null, "decision example must render emphasis");
				assert.notEqual(query(el, "code"), null, "decision example must render inline code");
			}
			if (parsed.attributes.dataset) {
				const buttons = queryAll(el, ".mosaic-granularity-btn");
				assert.ok(buttons.length > 0, "external example must offer its granularity");
				for (const button of buttons) {
					button.click();
					await flush();
					assert.equal(button.getAttribute("aria-pressed"), "true", "requested granularity becomes active");
					assert.equal(query(el, ".mosaic-error"), null, "dataset switch must succeed");
					assert.equal(query(el, ".mosaic-figure-warning"), null, "dataset switch must preserve complete coverage");
				}
			}
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
