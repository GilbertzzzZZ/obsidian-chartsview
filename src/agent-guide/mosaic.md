# Mosaic Usage Guide

Use this reference when authoring or repairing Mosaic charts, tables, metrics, timelines, decision records, and flow diagrams in Obsidian notes. It is independently usable without a source checkout, another reference file, or online documentation. All worked data below is invented for demonstration; use only supplied or approved data for an actual note.

Mosaic renders declarative blocks in **Reading view** in `.md` and `.mdx` notes. Live Preview is not supported. The `.mdx` extension does not enable executable MDX: do not generate imports, JSX expressions, JavaScript, callbacks, or chart-library configuration. Blocks describe data and supported presentation attributes only.

## Choose a block

Use ordinary Markdown for a sentence, list, or small static table when its meaning is already clear. Choose a visual component when it makes comparison, status, sequence, or connections easier to read.

| Block | Use it for | Choose another form when |
| --- | --- | --- |
| Chart | Numeric series over categories or periods | Readers need exact individual records: use DataTable |
| DataTable | Rows with aligned columns and adaptive width | A small ordinary Markdown table is sufficient |
| MetricGrid | Headline values with changes and context | Readers need historical trends: use Chart |
| Timeline | Milestones with dates, owners, and progress | Branches and dependencies matter: use FlowDiagram |
| DecisionBox | A decision with status, owner, rationale, and tradeoffs | The content is general prose without a decision |
| FlowDiagram | Directed steps, gates, branches, and outcomes | A plain ordered list explains the sequence |

Choose the block, identify the real field names and meanings, then choose inline data or an external dataset. Inline data suits a fixed snapshot. External datasets support Chart and DataTable only and suit repeated reports over shared, typed source files. The other four blocks require inline content.

---

## Write a block

### Fenced code blocks

Use lowercase `chart`, `datatable`, `metricgrid`, `timeline`, `decisionbox`, or `flowdiagram` as the fence language. `chartview` is an alias of `chart`. Start the content with `---`, write flat `key: value` attributes, close with another `---`, then put the payload directly below. The worked blocks in the next section can be copied into a note.

This attribute section is not general YAML: no nested maps, YAML arrays, multi-line values, or executable expressions. Values are strings; optional matching single or double quotes are removed. Use comma-separated text for lists. Lines beginning with `#` are comments. Indented lines, malformed lines, and `key:` without a value are skipped and reported. A section containing only unreadable attribute lines errors; an empty section is allowed. Both `---` boundaries are mandatory.

Write inline CSV or bare JSON/Markdown-table data directly after the second `---`, without another fence. An inner fence of the same length closes the outer block. For explicit TSV, use a paired tag with a `tsv` fence, or a four-backtick Mosaic fence containing a three-backtick `tsv` fence. Bare TSV is not detected automatically.

### Paired tags

Tag names are case-sensitive: `<Chart>`, `<DataTable>`, `<MetricGrid>`, `<Timeline>`, `<DecisionBox>`, `<FlowDiagram>`. Attribute values allow double quotes, single quotes, or unquoted words. Quote values containing spaces; do not put spaces around `=`. Attribute names must be ASCII; use code blocks for non-ASCII field names in dynamic attributes.

The opening tag must fit on one line. Put the matching closing tag alone on its own line. No blank lines inside the body and no unrelated text in the tag paragraph. Violating these host boundaries leaves the source visible instead of an error. Quoted `<` and `>` inside a paired tag attribute are allowed; unquoted values cannot contain whitespace, quotes, `>` or `/`.

Chart paired tags require a single CSV fence (language `csv` or no language). Bare CSV, JSON, TSV, or a Markdown table is not a Chart tag payload:

````text
<Chart title="Workshop attendance" type="bar" x="session" series="attendees">
```csv
session,attendees
Morning,24
Afternoon,18
```
</Chart>
````

The other five components accept fenced JSON/TSV/CSV or their bare row forms. This TSV example contains real tab separators:

````text
<DataTable title="Workshop stock">
```tsv
item	quantity
Notebook	24
Pencil	48
```
</DataTable>
````

### Self-closing tags

Self-closing tags are for external-dataset Chart and DataTable blocks only in authored content: `<Chart dataset="data/monthly.dataset.json" />` or `<DataTable dataset="data/monthly.dataset.json" />`. They have no body and may span lines. Do not use a literal `<` or `/>` inside their attribute values: ambiguous boundaries cause refusal. Do not generate self-closing cards or diagrams; DecisionBox technically renders an empty shell, while the others fail on empty data.

### Shared row payloads

DataTable, MetricGrid, Timeline, DecisionBox, and FlowDiagram's tabular form use these extraction paths in order:

1. A single fenced payload: `json` parses an array or an object with a `rows` array; `tsv` splits tab-separated records; every other language, including a typo or no language, parses CSV.
2. Bare text starting with `[` or `{` parses JSON with the same row shapes.
3. Other bare text containing `|` parses as a Markdown table. Include header, separator, and data rows beginning with `|`; the second row is always skipped. Escaped pipes and complex Markdown-table syntax are not supported.
4. Otherwise, parse CSV with a header and data rows.

Use flat JSON objects as rows. Malformed JSON raises an error, including in DecisionBox. CSV quotes protect commas and doubled quotes; keep records the same width as the header. For these five components, plain integers and decimals become numbers; dates, percentages, currency text, and grouped numbers remain strings. Empty cells stay empty; JSON preserves booleans and null. Chart has a stricter numeric contract below.

Aliases in card and flow rows select the first value that is **not null or missing**, not the first non-empty text. An explicit empty string blocks a later alias. Prefer canonical fields and omit unused aliases.

---

## Inline examples

Every block below is independently runnable, with synthetic data. Choose the example matching the information to communicate, then adapt its fields and values.

### Line: trends, gaps, labels, and a highlighted period

Use a line for change over ordered categories. The blank February value is a missing observation, not zero. `highlight` names x values exactly; line charts mark them with a vertical guide, bold x text when visible, and higher value-label priority.

```chart
---
title: Library visits
type: line
x: month
series: ReadingRoom,Workshop
ReadingRoomLabel: Reading room
ReadingRoomColor: "#3B82F6"
WorkshopLabel: Workshop
WorkshopColor: "#D97706"
unit: visits
labels: all
highlight: 2026-03
note: February workshop attendance was not recorded; the gap is intentional.
---
month,ReadingRoom,Workshop
2026-01,120,48
2026-02,135,
2026-03,160,72
2026-04,148,60
```

### Bar: one categorical comparison

Use bars for separate categories. Zero and negative values are supported; the baseline is always zero-inclusive.

```chart
---
title: Workshop seats by session
type: bar
x: session
series: Seats
SeatsColor: "#0F766E"
unit: seats
labels: true
---
session,Seats
Morning,24
Afternoon,18
Evening,30
```

### Grouped bars: compare series within each category

`bar` and `grouped-bar` both place multiple series side by side. Use a shared unit. Hiding value labels keeps a dense comparison readable without removing tooltips.

```chart
---
title: Workshop registrations
type: grouped-bar
x: session
series: Reserved,Attended
ReservedLabel: Reserved seats
AttendedLabel: Actual attendance
ReservedColor: "#94A3B8"
AttendedColor: "#2563EB"
labels: off
highlight: Afternoon
unit: people
---
session,Reserved,Attended
Morning,24,22
Afternoon,30,26
Evening,20,18
```

### Stacked bars: contributions to a total

Stack only when adding series is meaningful. Positive and negative contributions stack separately; negative adjustments do not reduce the positive stack used to size the axis.

```chart
---
title: Net book movements
type: stacked-bar
x: month
series: Donations,Purchases,Withdrawals
DonationsColor: "#059669"
PurchasesColor: "#2563EB"
WithdrawalsColor: "#DC2626"
unit: books
highlight: 2026-03
note: Withdrawals are recorded as negative movements.
---
month,Donations,Purchases,Withdrawals
2026-01,40,24,-8
2026-02,32,36,-12
2026-03,48,20,-10
```

### Combo: bars and lines with the same unit

Both roles are required. Actual completions and a target share the same scale; target values already exist in the CSV, they are not computed by Mosaic.

```chart
---
title: Reading challenge completions
type: combo
x: month
bars: Completed
lines: Target
CompletedLabel: Completed readers
TargetLabel: Monthly target
CompletedColor: "#2563EB"
TargetColor: "#D97706"
unit: readers
labels: all
---
month,Completed,Target
2026-01,42,50
2026-02,56,55
2026-03,64,60
```

### Dual-axis combo: two explicitly different units

Bars always use the left axis; lines always use the right. Use independent axes when units differ and label them clearly: a line crossing a bar is not numerical equality. Both axes include zero.

```chart
---
title: Workshop income and occupancy
type: combo-dual-axis
x: month
bars: Income
lines: Occupancy
IncomeLabel: Ticket income
OccupancyLabel: Seat occupancy
IncomeColor: "#2563EB"
OccupancyColor: "#16A34A"
leftUnit: $
rightUnit: %
labels: all
highlight: 2026-03
note: Occupancy is stored in percentage points; 75 means 75%.
---
month,Income,Occupancy
2026-01,1200,60
2026-02,1680,70
2026-03,2100,75
```

### DataTable: exact values and mixed cell types

JSON avoids ambiguity between formatted text and numbers. `columns` selects and orders fields; no field aliasing occurs. Numeric zero and boolean false are visible; null is blank.

```datatable
---
title: Workshop inventory
columns: item,available,reserved,checked,note
---
[
  {"item":"Notebooks","available":1200,"reserved":24,"checked":true,"note":"Stored upstairs"},
  {"item":"Brushes","available":0,"reserved":0,"checked":false,"note":null},
  {"item":"Paper packs","available":"1,250","reserved":12,"checked":true,"note":"Grouped quantity kept as text"}
]
```

A bare Markdown table is also a complete payload. Include its separator row:

```datatable
---
title: Session readiness
columns: Session,Owner,State
---
| Session | Owner | State |
| --- | --- | --- |
| Morning | Facilitator | Ready |
| Evening | Coordinator | Awaiting supplies |
```

### MetricGrid: values with meaning and direction

Keep display values exactly as intended. The component does not calculate deltas or infer whether a higher number is desirable. Set status explicitly when a negative change is good or a positive change is bad.

```metricgrid
---
title: Workshop snapshot
---
[
  {"label":"Attendance","value":"72%","delta":"+8%","note":"Compared with the previous session","status":"good"},
  {"label":"Supply cost","value":"$1,200","delta":"+12%","note":"Above the approved budget","status":"risk"},
  {"label":"Waiting list","value":18,"delta":"0","note":"Review before opening another session","status":"watch"},
  {"label":"Open seats","value":0,"note":"Fully booked"}
]
```

### Timeline: ownership and progress

Rows render in input order. Dates are display text and do not sort milestones. Status belongs in each row, not in a block-level attribute.

```timeline
---
title: Community workshop preparation
---
[
  {"date":"2026-04-02","title":"Outline approved","body":"Two sessions confirmed","owner":"Coordinator","status":"done"},
  {"date":"2026-04-05","title":"Supplies delayed","body":"Confirm replacement brushes","owner":"Purchasing lead","status":"blocked"},
  {"date":"2026-04-08","title":"Room setup","body":"Check seating and accessibility","owner":"Facilitator","status":"active"},
  {"date":"After setup","title":"Open doors","body":"Welcome registered visitors","owner":"Host"}
]
```

### DecisionBox: a structured decision record

Use attributes for status, owner, and source; use label/value rows for the decision. Values support bold and inline code, not general Markdown.

```decisionbox
---
title: Workshop booking policy
status: accepted
owner: Coordinator
source: Planning note 07
---
[
  {"label":"Decision","value":"Reserve **four seats** for walk-in visitors."},
  {"label":"Reason","value":"Keep access available to visitors without advance registration."},
  {"label":"Implementation","value":"Set the booking sheet field `advance_limit` to 20."},
  {"label":"Review","value":"Revisit after three sessions using the attendance records."}
]
```

When no usable label/value rows exist, DecisionBox renders minimal prose. Use a code block for multiple paragraphs and lists; blank lines would break a paired tag:

```decisionbox
---
title: Rainy-day workshop fallback
status: proposed
owner: Session host
---
Move the outdoor activity to the **reading room** when the garden is closed.

- Keep the same start time.
- Use the `indoor` checklist for materials.

The coordinator confirms the room before participants arrive.
```

### FlowDiagram: explicit branches and edge labels

Use graph JSON when arrows need labels. Give every node a stable unique id; edges refer to ids, not display labels. Node `note` is its hover tooltip; block `note` is a visible caption.

```flowdiagram
---
title: Workshop admission
note: A full session sends visitors to the waiting list.
---
{
  "nodes": [
    {"id":"arrive","label":"Visitor arrives","type":"start"},
    {"id":"check","label":"Seat available?","type":"decision","note":"Check reserved and walk-in allocations."},
    {"id":"admit","label":"Confirm admission","type":"gate"},
    {"id":"wait","label":"Join waiting list","type":"risk"},
    {"id":"seat","label":"Show the seat","type":"action"},
    {"id":"finish","label":"Ready to begin","type":"end"}
  ],
  "edges": [
    {"from":"arrive","to":"check"},
    {"from":"check","to":"admit","label":"Yes"},
    {"from":"check","to":"wait","label":"No"},
    {"from":"admit","to":"seat"},
    {"from":"seat","to":"finish"}
  ]
}
```

Use tabular nodes for simple connections without edge labels. Quote a CSV `next` list containing commas:

```flowdiagram
---
title: Workshop preparation tasks
---
id,label,type,next,note
plan,Confirm the plan,start,"room,supplies",Two tasks can proceed together
room,Prepare the room,action,ready,Check the seating plan
supplies,Pack the supplies,action,ready,Use the materials list
ready,Ready to open,end,,Both preparations connect here
```

---

## Chart rules

### Attribute contract

Attributes are optional except the data source: inline Chart needs CSV; external Chart needs `dataset` and an empty body. Supported `type` values are `line`, `bar`, `grouped-bar`, `stacked-bar`, `combo`, and `combo-dual-axis`.

| Attribute | Value and default |
| --- | --- |
| `title`, `note` | Text; absent means no title or definition note |
| `type` | One of six types; absent defaults to bar with one series, line with several. Unknown type falls back the same way and adds a warning |
| `x` | Exact field name; inline defaults to the first CSV column. External defaults to the manifest time field and permits only that field or `period` |
| `series` (alias `y`) | Comma-separated numeric fields; inline defaults to non-x fields, external to numeric fields with a rollup |
| `bars`, `lines` (aliases `bar`, `line`) | Comma-separated role fields. For combo types, omit both to use the first selected series as bars and the rest as lines. Supplying only one role does not infer the other |
| `leftSeries`, `rightSeries` | External field-selection compatibility aliases, with fallbacks left/leftAxis/leftY and right/rightAxis/rightY. They select query columns only; they do not assign chart axes. Use bars/lines for actual roles |
| `unit` | Single-axis unit; absent means plain numeric formatting |
| `leftUnit`, `rightUnit` | Dual-axis units; left falls back to `unit`, right defaults to none. Bars use left, lines right |
| `labels` | On by default; `0`, `false`, `hide`, `hidden`, `no`, `none`, `off` disable them case-insensitively. Other values keep them on |
| `<field>Label` | Exact field name plus `Label`; series display name. Default is dataset field label, otherwise raw field name |
| `<field>Color` | Exact field name plus `Color`; accepts `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`. Invalid values use the six-color palette in display order |
| `highlight` | Comma-separated exact displayed x values; none by default. Duplicates removed, missing categories ignored |
| `dataset` | Note-relative `.dataset.json` path inside the vault; exclusive with inline data |
| `from`, `to` | External only: inclusive `YYYY-MM-DD` source-period starts; omitted endpoints use observed data extent |
| `granularity` | External only: `auto` (default), day, week, month, quarter; case-insensitive |
| `granularityOptions` | External only: comma-separated candidates; default `day,week,month,quarter`, intersected with source compatibility and chart density |

For non-combo charts, selection uses the union of `series`, `bars`, and `lines`. Combo roles come from `bars` and `lines`; an extra field in `series` does not automatically acquire a role. Prefer explicit roles and do not assign one field to both. Canonical plural names take precedence over singular aliases. Combo legend order follows role attribute order; write `lines` before `bars` to put line series first.

### Numeric data, units, and visual limits

Inline Chart requires a header row and at least one data row. Every named field must exist. Every non-x column is validated as numeric even if omitted from `series`; remove unrelated text columns from the chart CSV. Empty numeric cells mean missing observations: lines break and bars are absent. Inline Chart rejects non-empty cells beyond the CSV header width, but permits empty trailing cells. Write `1234`, not `1,234` or a quoted grouped numeral, in numeric cells; quoted commas remain valid in x text.

Use `unit` for a single-axis chart. `%` adds a suffix; `元`, `¥`, `cny`, `rmb` give a `¥` prefix; `$`, `usd` give a `$` prefix. Currency aliases ignore case. Other units appear beside the title without changing numbers. Use `leftUnit` and `rightUnit` for `combo-dual-axis`. Units do not convert currencies, divide by 100, or rescale series: 24 with `%` displays as 24%. Dataset `fields[].unit` records meaning but does not automatically set chart units; write presentation units explicitly.

Use `labels` for value-label visibility and `<field>Label` for names. Values use thousands grouping and at most two decimals. Collision avoidance hides labels; not every value label is guaranteed to appear. Highlighted periods get higher priority. Highlight makes visible x text bold and adds a vertical guide on line charts or a background band on bar/combo charts. It does not force hidden x labels to appear or color the background behind axis text. Dataset highlights must use displayed bucket labels (`2026-01`, `2026-Q1`, or full day/week dates), not necessarily the source date spelling.

Every Y axis includes zero. Nonnegative data starts at zero, negative-only data ends at zero, mixed signs span both, and all-zero data uses 0–1. Positive maxima receive 8% headroom before outward rounding; stacked positive and negative extents are considered separately. Manual bounds are unsupported. Do not generate `yMin` or `yMax`, nested scale configuration, arbitrary chart types, or callbacks. Assign dual-axis roles with `bars` and `lines`, not the compatibility field selectors.

Tooltip text is plain text, not HTML. Charts adapt to container width and Obsidian light/dark themes. Export controls belong to plugin settings, not block attributes. Inline charts have no provenance footnote or granularity switcher. External charts show both, including a switcher with only one surviving option.

---

## Card, table, and flow contracts

### DataTable

| Attribute | Value and default |
| --- | --- |
| `title` | Optional text; no title by default |
| `columns` | Comma-separated exact keys in display order. Inline defaults to union of row keys in first-appearance order; external to time field followed by fields with rollups |
| `dataset` | Note-relative manifest path; absent means inline mode |
| `from`, `to` | External inclusive date range; no explicit bounds by default |
| `granularity` | External granularity, default `auto` |
| `granularityOptions` | External candidates, default `day,week,month,quarter` |

Inline tables require a data row and column. No field-alias normalization occurs. Numeric cells matching `^-?\d+(?:\.\d+)?$` become numbers; grouped numerals, dates, and `12%` stay literal text. JSON booleans display `true`/`false`, zero displays `0`, and null/missing cells are blank. Inline `columns` can display an empty column for a missing key; external columns must be declared fields or generated `period`.

Width adapts between fitting, wrapping, and internal scrolling. There are no `search`, `freeze`, `copyCsv`, `sticky`, or `complexity` controls. Do not add `columnLabels`: external headers come from `fields[].label`; inline headers use payload keys. External mode requires an empty body. There is no `query` body, `where` filter, or per-field computation syntax.

### MetricGrid

Only optional `title` is a block attribute. Row aliases select the first non-null/missing value:

| Canonical field | Alias priority | Default |
| --- | --- | --- |
| `label` | label → metric → name → title | Empty |
| `value` | value → current → amount → count | Empty |
| `delta` | delta → change → mom → yoy | Empty |
| `note` | note → description → source → body | Empty |
| `status` | status → trend → delta → change | Neutral styling |

Rows with neither a label nor a value are omitted. Keep a label on zero-valued metrics. No parsed rows is an error; all parsed rows filtered out yields an empty grid. Values, deltas, and notes are display content: no calculations or automatic unit formatting.

| Normalized status | Input, case-insensitive |
| --- | --- |
| `good` | good, up, positive, success, active, or text beginning with `+` |
| `risk` | risk, warning, blocked, down, negative, or text beginning with `-` |
| `watch` | watch, flat, neutral |
| `neutral` | Missing or any other input |

The literal word `neutral` maps to **watch**; omitted/unrecognized status uses neutral styling. A delta alone can color a card. For a desirable decrease, give that row explicit `status: good`. No dataset, block-level status, grid-column count, or granularity attributes exist.

### Timeline

Only optional `title` is a block attribute. Rows preserve input order. Dates are display text. No individual field is required; a row with no recognized fields creates an empty milestone. At least one parsed row is required.

| Canonical field | Alias priority | Default |
| --- | --- | --- |
| `date` | date → time → month | Empty |
| `title` | title → name → event | Empty |
| `body` | body → description → summary → note | Empty |
| `owner` | owner → assignee | Empty |
| `status` | status only | default |

Status trims and ignores case: done/complete/completed/success → done; blocked/risk/warning → blocked; active/doing/progress/in-progress → active; all others → default. Dots carry status color; active uses the theme accent. MetricGrid's delta rules do not apply.

### DecisionBox

| Attribute | Value and default |
| --- | --- |
| `title` | Optional text; no title by default |
| `status` | Optional raw badge text controlling normalized border styling |
| `decisionStatus` | Alias; canonical `status` takes precedence |
| `owner`, `source` | Optional literal badge text; neither creates a link |

Structured `label` falls back through key/name/item; `value` through text/body/description/summary. Empty label/value rows are removed. At least one surviving row selects the definition-list view. Otherwise the entire original body is used as minimal rich text; an empty body is allowed. Invalid JSON errors before fallback.

Values and fallback prose support `**bold**` and single-backtick inline code. Fallback additionally supports blank-line paragraphs and flat `- ` / `* ` bullet lists. Other Markdown, HTML, links, italics, headings, ordered or nested lists are not interpreted. Prose with commas or pipes can accidentally look like CSV/a table: prefer structured JSON when ambiguity exists.

Accepted/proposed/rejected/superseded statuses map to green/accent/red/grey borders. Done/complete/completed map to accepted. Other non-empty words use default styling; empty/missing status has no badge. Matching trims and ignores case; the badge preserves the original text. The header kicker `Decision` is not configurable.

### FlowDiagram

Only optional `title` and `note` are attributes. Title labels the block and SVG (default accessibility label `Flow diagram`); note is a caption. No direction, layout, width, shape, or dataset attribute is provided. Narrow containers scroll horizontally.

Supply a JSON object with a `nodes` array and optional `edges` array, or tabular rows with `next`. Graph `links` is an alias for `edges` (edges wins). Keep these arrays as arrays of objects.

| Node field | Alias/default |
| --- | --- |
| `id` | id → key → 1-based row index; trimmed empty ids removed. Author stable unique ids |
| `label` | label → title → name → id; ordinary text |
| `type` | type → kind → status; default action |
| `note` | note → description; empty by default; hover tooltip |
| `next` | next → to; comma-separated target ids; none by default |

| Edge field | Alias/default |
| --- | --- |
| `from` | from → source; source node id |
| `to` | to → target; target node id |
| `label` | label → title; empty by default |

Node types: start, end, action, decision, gate, risk. Question/branch/condition normalize to decision; warning/blocked/error to risk; anything else to action. Matching trims and ignores case. All nodes are rounded rectangles distinguished by type styling; decision does not create a diamond. Arbitrary node shapes are unsupported.

Explicit edges and node `next` references combine without deduplication; choose one way for each connection. Missing-node edges are silently dropped, so verify all endpoints. At least one non-empty node id must survive. Nodes layer downward by edge direction; cycles go into successive fallback layers rather than a compact loop. Keep labels short because long text wraps and truncates. Prefer an acyclic graph when ordering matters.

---

## External dataset

Place the note at the vault root, create both files below, then copy either note block. A dataset is a typed data file plus a manifest declaring meaning and aggregation, not executable code.

### `data/monthly.dataset.json`

```json
{
  "schemaVersion": 1,
  "id": "monthly-output",
  "title": "Monthly workshop output",
  "data": "monthly.csv",
  "grain": ["Date"],
  "primaryKey": ["Date"],
  "time": { "field": "Date", "sourceGranularity": "month" },
  "fields": [
    { "name": "Date", "type": "date", "required": true },
    { "name": "Amount", "label": "Completed items", "type": "integer", "rollup": "sum", "required": true }
  ]
}
```

### `data/monthly.csv`

```csv
Date,Amount
2026-01-01,80
2026-02-01,120
```

### Note references

```chart
---
dataset: data/monthly.dataset.json
type: line
x: Date
series: Amount
title: Monthly workshop output
unit: items
granularity: month
granularityOptions: month
---
```

```datatable
---
dataset: data/monthly.dataset.json
columns: Date,Amount
title: Monthly workshop output
granularity: month
granularityOptions: month
---
```

`dataset` is relative to the **note directory**. From `reports/spring.md`, use `../data/monthly.dataset.json`. The manifest's `data` is relative to the **manifest directory**: `monthly.csv` resolves beside it. Both paths must stay inside the vault; no absolute paths, URLs, or escaping above the root. Dataset mode cannot include an inline body.

The same root-level note can use these self-closing references instead:

```text
<Chart dataset="data/monthly.dataset.json" type="line" x="Date" series="Amount" unit="items" granularity="month" granularityOptions="month" />
```

```text
<DataTable dataset="data/monthly.dataset.json" columns="Date,Amount" granularity="month" granularityOptions="month" />
```

### Manifest contract

The manifest, `time`, fields, and rollup objects reject unknown keys.

| Top-level key | Type and contract |
| --- | --- |
| `schemaVersion` | Required integer 1 |
| `id` | Required non-empty identifier, at most 128 characters |
| `title` | Optional text, at most 256 characters; provenance falls back to id |
| `description` | Optional definition, at most 2,000 characters |
| `data` | Required relative file path, at most 512 characters |
| `format` | Optional csv/tsv/json; otherwise inferred from extension |
| `grain` | Required non-empty unique array of declared fields describing one record; includes time |
| `primaryKey` | Required non-empty unique array of declared fields; includes time and every key field sets `required: true`. Combined key values must be unique across all rows |
| `time` | Required object, below |
| `fields` | Required array of 1–100 field definitions |
| `skipBlankRows` | Boolean, default false; true drops rows whose declared non-time fields are all blank before validation. Requires a non-time field |

| `time` key | Type and contract |
| --- | --- |
| `field` | Required declared field name; field type must be date |
| `sourceGranularity` | Required day/week/month/quarter |
| `type` | Optional date; timestamps unsupported |
| `timezone` | Optional text, default UTC; metadata, not timestamp conversion |
| `weekStartsOn` | monday (default) or sunday |
| `calendar` | calendar (default) or weekdays; weekdays excludes weekends from expected daily coverage, not from source rows |

| Field key | Type and contract |
| --- | --- |
| `name` | Required unique non-empty name, at most 128 characters; no commas/control characters. `period` is reserved |
| `type` | Required string/integer/decimal/number/boolean/date |
| `required` | Boolean, default false; true rejects null, missing, blank cells |
| `label` | Optional display name, at most 256 characters |
| `description` | Optional definition, at most 1,000 characters |
| `unit` | Optional semantic unit, at most 64 characters; set chart units separately |
| `rollup` | Optional aggregation string or ratioOfSums object; omitted means no aggregation definition |
| `sourceColumn` | Optional **1-based** physical column, integer 1–10,000; CSV/TSV only. If one field uses it, all must use distinct indices within header width |
| `numberFormat` | Optional comma-grouped, numeric fields only; parses values such as `1,234.50` |

### Typed data and missing values

CSV/TSV normally use unique, non-empty headers matching manifest names. Every source key must be declared. JSON accepts an array or `{ "rows": [...] }` with flat objects and no undeclared keys. All formats need at least one data row. Optional empty/missing/whitespace-only values become null; required ones error. Zero is not a missing marker.

Integers must be finite whole numbers; decimal/number fields finite numbers. Booleans accept JSON booleans or case-insensitive true/false and 1/0. Dates must be valid complete `YYYY-MM-DD` values. String fields accept scalars, not nested objects. Without numberFormat, avoid grouped numerals; with comma-grouped, group in threes and quote CSV commas. No currency symbols or percent signs in numeric cells.

Time must land on a source-period start: any valid day for daily data, declared Monday/Sunday for weekly, first of month for monthly, January/April/July/October 1 for quarterly. Validation checks the entire file before range filtering; bad rows outside from/to still fail.

---

## Mapped dataset and rollups

This complete example imports a CSV with repeated headers, grouped numbers, and an empty metric row. Quarterly conversion is defined as **sum of bookings / sum of visits × 100**, not the average of monthly percentages.

### `data/attendance.dataset.json`

```json
{
  "schemaVersion": 1,
  "id": "workshop-conversion",
  "title": "Workshop booking conversion",
  "description": "Bookings divided by visits; quarter conversion is weighted by visits.",
  "data": "attendance.csv",
  "format": "csv",
  "skipBlankRows": true,
  "grain": ["Date"],
  "primaryKey": ["Date"],
  "time": {
    "field": "Date",
    "type": "date",
    "timezone": "UTC",
    "weekStartsOn": "monday",
    "calendar": "calendar",
    "sourceGranularity": "month"
  },
  "fields": [
    {"name":"Date","type":"date","required":true,"sourceColumn":1},
    {"name":"Orders","label":"Bookings","type":"integer","required":true,"sourceColumn":2,"rollup":"sum"},
    {"name":"Visits","label":"Visits","type":"integer","required":true,"sourceColumn":3,"numberFormat":"comma-grouped","rollup":"sum"},
    {"name":"Conversion","label":"Booking conversion","description":"Sum of bookings divided by sum of visits, in percentage points.","type":"decimal","unit":"%","sourceColumn":4,"rollup":{"op":"ratioOfSums","numerator":"Orders","denominator":"Visits","scale":100}}
  ]
}
```

### `data/attendance.csv`

```csv
Period,Count,Count,Rate,Comment
2026-01-01,60,"1,200",5,Winter session
2026-02-01,120,"1,800",6.6666666667,Extra workshop
2026-03-01,20,"1,000",2,Short session
2026-04-01,,,,Not yet reported
```

All fields use unique 1-based sourceColumn indices. Unmapped columns including Comment are ignored. Header text is not used for mapping, so repeated Count is acceptable. April is skipped because all mapped non-time fields are blank; its unmapped comment does not keep it. Without mapping, repeated headers and undeclared source fields fail.

### Note references

```chart
---
title: Bookings and conversion
dataset: data/attendance.dataset.json
type: combo-dual-axis
x: period
bars: Orders
lines: Conversion
OrdersColor: "#2563EB"
ConversionColor: "#16A34A"
leftUnit: bookings
rightUnit: %
from: 2026-01-01
to: 2026-03-01
granularity: month
granularityOptions: month,quarter
highlight: 2026-02
note: Quarterly conversion is weighted by visit count.
---
```

```datatable
---
title: Quarterly conversion reconciliation
dataset: data/attendance.dataset.json
columns: Date,Orders,Visits,Conversion
from: 2026-01-01
to: 2026-03-01
granularity: quarter
granularityOptions: month,quarter
---
```

The quarter row is `2026-Q1`, 200 bookings, 4,000 visits, and conversion 5. Chart units add the percent sign; DataTable does not automatically append manifest units. A January–March source window ends at **March 1** because the range selects monthly anchors, not every calendar day.

### Aggregation definitions

| `rollup` | Meaning and constraint |
| --- | --- |
| `sum` | Sum non-null numbers; additive counts or amounts |
| `avg` | Arithmetic mean of non-null numbers; equally weighted observations |
| `min`, `max` | Minimum/maximum non-null number |
| `count` | Count non-null field values, not distinct values or necessarily all rows; zero if none |
| `first`, `last` | First/last non-null value after sorting by time/key; require at most one row per date in the bucket |
| `{"op":"ratioOfSums","numerator":"A","denominator":"B","scale":1}` | Sum A / sum B × scale (default 1). Result and inputs must be declared numeric fields; zero summed denominator yields null |

Simple rollups are strings, not `{ "op": "sum" }`. Sum/avg/min/max require numeric fields. First/last/count also accept other types. Except count and the ratio rule, no non-null values yields null. Missing observations are excluded from averages rather than treated as zero.

Rollups run even at source granularity. A field without a rollup is displayable only when view equals source granularity **and exactly one row occupies the bucket**. With multiple dimension rows on a date, even a day view needs aggregation. Grain/key validate record identity; they do not create separate chart series or a group-by interface. Prepare wide series columns or separately prepared data for distinct dimension lines. There is no note-side filter to disambiguate first/last with duplicate dates.

The manifest is not a formula engine. Required source values must exist. A ratio result field may be optional and blank when its defined ratio is calculated from numerator/denominator fields, but arbitrary totals/expressions are unsupported. For different aggregation definitions, use separate manifests pointing to the same file.

An average of daily active visitors describes average daily activity, not distinct monthly visitors. Mean percentages need not equal a ratio of totals. Obtain the field definition before choosing an aggregation; do not change meaning for convenience.

### Time range, granularity, and provenance

| Source | Supported views |
| --- | --- |
| day | day, week, month, quarter |
| week | week, month, quarter |
| month | month, quarter |
| quarter | quarter |

No year, hour, custom, or finer-than-source view exists. Explicit granularity must be in granularityOptions and compatible with source. Auto chooses the finest available view. Chart removes choices exceeding 120 buckets when a coarser readable choice exists; if all exceed 120, it retains the coarsest. A density-excluded explicit choice falls back to an available one. DataTable has no 120-bucket density rule, but both queries have a 5,000-output-bucket limit and a 10,000-day range limit.

From/to are inclusive source anchors, from must not exceed to, and the range must return data. Missing endpoints use first/last observed dates. Daily/weekly buckets display full dates, monthly `YYYY-MM`, quarterly `YYYY-QN`. Weeks use the declared start day. Weekly records are assigned to months/quarters using their middle date (start plus three days). Weekly-to-month/quarter incomplete boundary periods are omitted; other partial boundaries remain with a warning. Missing expected periods warn too; no rows or zeros are invented.

The generated footnote is `dataset title · from → to · granularity · N/M source rows · data through <date>`. Inspect coverage before comparing values. A failed granularity switch keeps the last successful view and displays its reason. Data files are limited to 20 MB and 250,000 rows; manifests to 256 KB. Narrowing a query does not bypass whole-file validation or file-size limits.

---

## Limits and troubleshooting

A recognized invalid block shows a red `Mosaic:` box. A host-rejected tag stays source text. Unsupported attributes or chart types can leave a rendering plus a notice/warning; a visible component alone does not establish correctness.

| Symptom | Cause to check | Fix |
| --- | --- | --- |
| Source in Live Preview | Only Reading view supported | Switch to Reading view |
| Tag stays source | Multi-line opening, blank body line, bad closing tag, mixed paragraph, non-ASCII attribute name | Repair boundaries or use a Mosaic code block |
| Chart tag stays source | Bare CSV/non-CSV body | Use its single CSV fence or a chart code block with bare CSV |
| Error about `---` | Missing attribute boundary | Supply opening and closing delimiters |
| Skipped-attribute notice | Typo, indentation, nesting, empty value, spaces around tag `=` | Use supported flat names and scalar values |
| Wrong chart shape and warning | Unsupported type fell back | Select one of six supported types |
| CSV row error | Text/grouped numeral in numeric column or extra unquoted comma | Use raw numeric values and correct header width |
| Missing line point/bar | Blank numeric cell | Preserve missingness; insert a real observation only when available |
| Missing value labels | Collision avoidance or disabled labels | Reduce density or highlight key periods; do not promise forced labels |
| Color unchanged | Invalid hex or field mismatch | Correct exact fieldColor and hex spelling |
| No highlight marker | Highlight differs from displayed x label | Match the category/month/quarter label |
| Combo error | One role missing | Supply both bars and lines with real fields |
| Dataset/body error | Competing sources | Remove the body or dataset attribute |
| External card error | Unsupported component | Put its approved rows inline |
| File not found | Wrong relative base directory | Resolve note-to-manifest and manifest-to-data separately |
| Undefined field/duplicate header | Source differs from schema | Declare exact fields or use all-field sourceColumn mapping |
| Missing required cell | Blank/null data or incomplete mapping | Correct source/mapping; mark optional only if definition permits |
| Invalid/alignment date | Incomplete date or wrong source anchor anywhere in file | Correct all rows before changing the query |
| Duplicate primary key | Same tuple appears twice | Correct duplicates or declare actual identifying dimensions |
| No rows | Window excludes observations | Select existing source anchors |
| Unavailable granularity | Finer than source or option mismatch | Choose supported options and a value in them |
| Field needs rollup | Coarser view or several rows per date | Obtain and declare the real aggregation definition |
| No complete periods | Weekly boundary omission removes all periods | Extend coverage or use weekly view |
| Desired total missing | No source field/supported ratio definition | Add an approved precomputed column |
| Table header unchanged | columnLabels ignored | Set manifest fields[].label or rename inline keys |
| Wrong metric color | Delta inference or neutral maps to watch | Set explicit row status |
| Timeline not chronological | Input order preserved | Order source rows explicitly |
| Literal decision formatting | Unsupported Markdown | Use bold/code/simple fallback lists or ordinary Markdown |
| Missing flow arrow | Endpoint id absent | Match exact node ids, not labels |
| Loop becomes chain | Cycle fallback | Use an acyclic explanation or accept fallback; no circular-layout option |

### Deliberately invalid examples

These are negative examples, not templates. Inline Chart cannot use dataset-only granularity; a card cannot load a dataset:

```chart invalid
---
type: bar
granularity: month
---
month,value
2026-01,12
```

```metricgrid invalid
---
dataset: data/monthly.dataset.json
---
```

### Authoring and verification checklist

1. Confirm Reading view; choose the smallest useful block or ordinary Markdown.
2. If required data, field meaning, or aggregation is missing or unclear, ask the user before writing the block. Never invent user data or an aggregation definition.
3. Match exact fields, required rows/keys, zero versus missing, and explicit units/roles where interpretation depends on them.
4. Supply correct fence boundaries or obey all tag paragraph rules. Do not generate executable MDX/JS or unsupported attributes.
5. For external data, supply complete manifest/source files; verify paths, all dates/keys, and supported source/view/rollup combinations.
6. Check Reading view: no red errors, skipped-attribute notices, or unexplained warnings. Reconcile totals/ratios with definitions; inspect provenance and missing periods.
7. Confirm labels, units, statuses, and connections; scroll when needed. Exercise every offered external granularity, not just the initial view.
