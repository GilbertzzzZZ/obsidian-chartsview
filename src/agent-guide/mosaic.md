# Mosaic Usage Guide

> Use Mosaic to turn declarative Markdown blocks into charts, tables, metrics, timelines, decision records, and flow diagrams in Obsidian Reading view.

## Choose a block

> Pick the smallest block that matches the information you need to communicate.

- **Chart** visualizes numeric series over a category or time axis.
- **DataTable** displays rows and columns without chart semantics.
- **MetricGrid** presents a compact set of headline values.
- **Timeline** orders milestones vertically.
- **DecisionBox** records a decision as label/value rows or minimal rich text.
- **FlowDiagram** lays out nodes and directed edges as an SVG diagram.

---

## Write a block

> A fenced code block is the most reliable form for generated content because its attributes can span lines and its payload can contain blank lines.

- Start every Mosaic code block with an opening `---` attribute boundary.
- Write flat `key: value` attributes, one per line.
- Close the attribute section with another `---`.
- Write inline data directly after the closing boundary, without another code fence.
- Use the lowercase block name as the fence language.

**Tag form**

- Keep the opening tag on one line.
- Put the matching, case-sensitive closing tag alone on a line.
- Do not put blank lines inside the body.
- Do not mix unrelated text into the tag paragraph.
- Use ASCII attribute names.
- Do not put spaces around `=`.

---

## Inline examples

> These minimal inputs are complete Mosaic code blocks that can be copied into a note.

### Chart

- `type` selects the chart shape, `x` selects the category field, and `series` selects numeric fields.

```chart
---
type: line
x: month
series: amount
title: Monthly output
---
month,amount
2026-01,80
2026-02,120
```

### DataTable

- Inline tables accept CSV, TSV, JSON rows, or a Markdown table.

```datatable
---
title: Work items
---
item,amount
Draft,2
Review,1
```

### MetricGrid

- Rows use `label` and `value`.
- Optional `delta`, `note`, and `status` fields add context and status color.

```metricgrid
---
title: Key metrics
---
label,value
Completed,12
Remaining,3
```

### Timeline

- Rows may include `date`, `title`, `body`, `owner`, and `status`.

```timeline
---
title: Delivery timeline
---
date,title
2026-01-01,Draft
2026-02-01,Launch
```

### DecisionBox

- Structured rows use `label` and `value`.
- `status`, `owner`, and `source` are optional attributes.

```decisionbox
---
title: Delivery decision
status: accepted
---
label,value
Choice,Ship a small first version
```

### FlowDiagram

- Graph JSON contains `nodes` and `edges`.
- Tabular rows with an `id` and `next` field are also supported.

```flowdiagram
---
title: Delivery flow
---
{"nodes":[{"id":"draft","label":"Draft"},{"id":"review","label":"Review"}],"edges":[{"from":"draft","to":"review"}]}
```

---

## External dataset

> Chart and DataTable can share a typed external dataset while the note stays at the vault root.

### Data files

- Create `data/monthly.dataset.json` with this manifest.

```json
{
  "schemaVersion": 1,
  "id": "monthly-output",
  "data": "monthly.csv",
  "grain": ["Date"],
  "primaryKey": ["Date"],
  "time": { "field": "Date", "sourceGranularity": "month" },
  "fields": [
    { "name": "Date", "type": "date", "required": true },
    { "name": "Amount", "type": "integer", "rollup": "sum", "required": true }
  ]
}
```

- Create `data/monthly.csv` with this data.

```csv
Date,Amount
2026-01-01,80
2026-02-01,120
```

### Note references

- Reference the manifest from a Chart.

```chart
---
dataset: data/monthly.dataset.json
type: line
x: Date
series: Amount
title: Monthly output
---
```

- Reference the same manifest from a DataTable.

```datatable
---
dataset: data/monthly.dataset.json
columns: Date,Amount
title: Monthly output
---
```

- `dataset` paths are relative to the note and must end in `.dataset.json`.
- The manifest's `data` path is relative to the manifest itself.
- Dataset mode cannot include an inline body.
- Use `from`, `to`, `granularity`, and `granularityOptions` to select an aligned time range and supported roll-up.
- Only fields with a `rollup` can be shown above the source granularity.

---

## Limits and troubleshooting

> Keep generated blocks inside Mosaic's supported syntax and let an in-place error identify invalid input.

- Mosaic renders in Reading view, not Live Preview.
- External datasets support Chart and DataTable only.
- Chart inline mode accepts CSV only and cannot use dataset-only range or granularity attributes.
- DataTable, MetricGrid, Timeline, DecisionBox, and FlowDiagram accept CSV, TSV, JSON rows, or Markdown tables through their shared row parser.
- FlowDiagram also accepts a graph object with `nodes` and `edges`.
- FlowDiagram ignores edges pointing to missing nodes.
- FlowDiagram lays cycles out as a chain rather than a loop.
- DecisionBox alone accepts empty or unstructured content. Multi-paragraph rich text requires the code-block form.
- MetricGrid, Timeline, and FlowDiagram need inline rows. They do not support `dataset`.
- Dataset dates must be complete `YYYY-MM-DD` values aligned to the source period start. Roll-ups can move to a coarser granularity, never a finer one.
- A dataset manifest is limited to 256 KB, its data file to 20 MB, and parsed data to 250,000 rows.
- Chart drops granularities that would exceed 120 plotted buckets. DataTable has no equivalent display-density limit.
- A missing `---` boundary makes a code block invalid. Malformed attribute lines are skipped and reported when at least one valid attribute remains.
- A red `Mosaic:` box reports a recognized block with invalid data. A tag that violates host paragraph boundaries remains visible as source.
