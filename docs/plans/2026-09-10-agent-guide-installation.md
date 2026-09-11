# Mosaic Agent Guide Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户在插件设置中安装供 agent（智能体）使用的精简 Mosaic 指导，指导随插件更新，不覆盖用户自行维护的文件。

**Architecture:** 一个英文 Markdown 正文源稿，通过两个标准技能入口和一个自定义目录出口分发。纯函数决定目标路径、生成内容和写入条件，独立的 Obsidian 文件操作模块执行安装与同步。设置页和插件加载生命周期调用该模块，渲染链路不参与。

**Tech Stack:** TypeScript、原生 Web Crypto、Obsidian 1.13.0 设置与文件接口、esbuild 文本加载、现有 `node --test` 与宿主替身。

**Spec:** 本文「范围与行为契约」承载本次用户需求，不另建一份重复设计稿。正文内容以八篇英文用户指南为权威，维护操作遵守 [[AGENTS|AGENTS.md]]。

**Status:** 用户已确认实施与标准技能入口。自定义文档文件名使用 `Mosaic-Usage-Guide.md`，正文标题保留空格。

## Global Constraints

> 本节约束全部任务，也必须包含在子任务交接中。

- **进程数：** 每个打开的笔记库内一个 Mosaic 插件实例，不建立跨进程锁或后台服务。
- **用户数：** 每个实例由一名本地操作者使用，不做账号、权限角色或团队安装管理。
- **调用频率：** 用户手动安装时执行，插件每次加载后检查一次已安装目标，最多三个目标，不定时轮询，不遍历笔记库。
- **失败代价：** 指导文件不可用时保留原文件并提示，不影响打开笔记、图表或卡片。覆盖用户正文属于不可接受的数据损失。
- **运行范围：** 首版采用当前 Obsidian 笔记库内的相对目录。不访问用户全局技能目录，不查找父级 Git 仓库，不提供库外路径选择。
- **跨设备：** 不协调同步服务的并发写入，但旧插件不得根据更高版本的安装记录把指导降级。
- **兼容底线：** 保持 `minAppVersion: 1.13.0`、`isDesktopOnly: false`、esbuild `target: es2017`。不引入 Node/Electron 运行时依赖。
- **依赖与构建：** 零新增依赖，复用现有测试与构建，不更换包管理器，不修改发布三件套。
- **源码边界：** 不修改 `src/parse/blocks/`，不改变任何内容块语法、渲染语义或上游基线。
- **语言：** 设置界面用英文 sentence case（句首大写）。分发给智能体的正文仅一份英文，安装使用说明按用户指南规则提供中英文。
- **公开内容：** 本计划、实现、示例和验收记录只使用仓库相对路径和虚构数据，不记录本机目录、用户笔记或私有工具配置。
- **交付边界：** 用户已授权实施。提交在任务分支完成，通过验收后按仓库规则本地合并并推送主分支。不授权打标签或发版。

---

## 范围与行为契约

> 三个出口只解决本插件的指导安装，不扩展成通用技能管理器。

### 命名门槛与范围解释

- 用户要求 Agents、Claude 两个按钮，并保留指定目录指导文档的命名要求。本计划据此保留两个技能按钮和一个指定目录的写入按钮，不增加更多客户端预设。
- 用户提出技能文件名 `mosaic.md`。标准客户端要求入口是 `SKILL.md`，直接安装 `skills/mosaic.md` 不满足自动发现格式。
- 推荐技能名和目录名为 `mosaic`，源稿为 `src/agent-guide/mosaic.md`，安装入口按标准命名为 `SKILL.md`。
- 推荐自定义目录的固定文件名为 `Mosaic-Usage-Guide.md`，正文标题为 `Mosaic Usage Guide`。
- 用户已确认标准入口 `mosaic/SKILL.md`，并要求自定义文档文件名用连字符连接单词：`Mosaic-Usage-Guide.md`。
- 库内目录是本计划采用的首版范围。若用户要求库外目录，须先重新审查平台兼容、授权和公开说明，再修订计划。

### 安装出口

- **Agents：** 写入笔记库根目录下的 `.agents/skills/mosaic/SKILL.md`。
- **Claude：** 写入笔记库根目录下的 `.claude/skills/mosaic/SKILL.md`。
- **自定义目录：** 写入所选库内目录的 `Mosaic-Usage-Guide.md`，不创建技能子目录。
- 三个出口的完整文件字节相同，不维护三份内容或三套版本号。
- 两个技能都安装时分别维护，不修改客户端配置，不建立符号链接，不主动启动任何智能体。
- 自定义目录的普通文档不承诺自动加载。设置页展示实际安装路径和读取提示，用户自行交给智能体。
- 技能正文被客户端加载后的会话更新由客户端负责。文件写入成功不等于旧会话已经重新读取。

### 精简内容

- 只讲如何用 Mosaic 写笔记，不带开发流程、仓库发版规则、内部工程说明或代码执行脚本。
- 用途选择覆盖 Chart、DataTable、MetricGrid、Timeline、DecisionBox、FlowDiagram 六类内容块。
- 每类给出一个最小完整代码块，属性区与数据区都能直接使用。
- 代码块作为默认推荐写法，补充成对标签与自闭合标签的用途和边界，不重复列出所有写法组合。
- 必须覆盖支持的图表类型、必要字段、单位与系列标签、外部数据清单、相对路径和聚合限制。
- 明确阅读视图才渲染、标签开头单行及无空行、代码块内不嵌套同长围栏、数值不能夹带多余非空列。
- 明确 Y 轴包含零且不支持手动上下界，不能让智能体编造 `yMin` / `yMax`。
- 明确只在 Chart 与 DataTable 使用外部数据，不为其余四类编造 `dataset` 能力。
- 遇到缺失数据或定义不明确时要求确认，不捏造用户数据或聚合口径。
- 指导必须脱离插件源码仓库独立可读，不能依赖用户电脑不存在的 `docs/` 相对链接。

### 安装与更新状态

- 默认无安装记录，启动不写任何指导文件。
- 手动按钮只负责自身出口。另一个出口失败不撤销已成功安装的出口。
- 文件不存在时，只有手动安装可以创建。
- 文件已经等于本版完整内容时不重写。手动点击可登记为已安装，补齐上次保存失败的记录。
- 首次遇到其他同名文件时拒绝覆盖，提示用户改名或移走原文件后重试，不增加强制覆盖按钮。
- 自动更新只处理已有安装记录的固定路径，不自动接管碰巧存在的同名文件。
- 自动更新前对实际文件计算 SHA-256（内容校验值），只有等于上次成功安装的校验值才允许替换。
- 用户改过正文时保留全文，状态为 `Modified — not updated`，不做文本合并或自动备份副本。
- 文件删除、改名或移动后，原路径显示 `Not installed`，不搜索新位置、不重建文件。保留安装记录只用于识别原路径，不用它授权重新创建。
- 更高插件版本的安装记录返回 `Newer version — not updated`，本次不写文件，不倒退记录。
- 修改自定义目录输入只修改候选目录。再次点击写入并成功后才切换该出口的安装记录，旧文件保留但不再维护。
- 写入成功后才保存新的安装路径、版本与校验值。写入失败时不推进安装记录。
- 设置保存失败时回退内存记录并显示错误。文件若已经写成新内容，下次手动操作或自动检查可以通过完整内容相等补齐记录。
- 更新失败只影响对应指导状态，不能让插件加载失败或阻止内容块注册。

### 最小设置界面

- 保留 `Show export button` 的原行为。
- 增加 `Agent skills` 设置行，两个按钮文字精确为 `Agents`、`Claude`。
- 增加 `Guide folder` 文件夹输入，初始为空，允许选择笔记库根目录。
- 增加 `Usage guide` 设置行，按钮为 `Write guide`。
- 设置行说明展示每个目标的安装路径和结果，不新增状态面板或弹窗向导。
- 手动成功使用一次简短提示。后台成功不弹提示，失败保留在设置状态中。
- 操作进行中禁用安装按钮，通过一个实例级 `busy` 状态防止自动更新与重复点击重叠，不引入任务队列或锁文件。
- 用 `getSettingDefinitions()` 返回的 `render` 设置行配合 `Setting.addButton()`，不恢复 `display()`。

---

## 文件与接口划分

> 文件按正文、写入策略、宿主操作三项职责拆分，设置和加载入口保持薄层。

### 新增文件

- `src/agent-guide/mosaic.md`：唯一英文指导正文，不包含安装路径或机器信息。
- `src/agent-guide/core.mjs`：目标路径、统一文件生成、内容校验和写入决策，不依赖 Obsidian。
- `src/agent-guide/installer.ts`：安装记录类型、具体 Obsidian 文件读写、逐目标失败隔离和生命周期控制。
- `src/markdown.d.ts`：声明 `.md` 文本导入。
- `tests/agent-guide-content.test.mjs`：直接提取源稿中的示例并通过现有解析与渲染入口验证。
- `tests/agent-guide-policy.test.mjs`：路径、生成内容、校验值、更新决策。
- `tests/agent-guide-installation.test.mjs`：带内存笔记库的真实安装服务行为。
- `tests/agent-guide-settings.test.mjs`：设置按钮、目录输入和加载接线。
- `docs/guides/agent-guide.md` 与 `docs/guides/agent-guide-zh.md`：面向用户的安装、使用、自动更新和停止维护说明。

### 修改文件

- `esbuild.config.mjs` 和 `tests/helpers/bundle.mjs`：增加 `.md` 文本加载，不改其他编译设置。
- `src/settings.tsx`：新增设置字段与三个出口的控件，保留原开关分支。
- `src/main.tsx`：创建安装服务，在布局就绪后检查已安装文件，在卸载时关闭该服务。
- `tests/helpers/entry.tsx`：按任务顺序导出安装服务、设置页和插件类供测试使用。
- `tests/helpers/obsidian-stub.mjs`：只补新调用需要的 `Notice`、按钮与设置刷新能力，不模拟整套宿主。
- `docs/design/architecture.md`：增加指导分发与渲染管线独立、文件所有权保护的设计理由。
- `README.md`、`docs/README-zh.md`：增加用户指南入口与本地文件写入说明，不复制指导全文。
- `AGENTS.md`：记录正文源稿、示例验证命令和新模块边界，按真实测试结果更新测试数量。

### 固定接口

```ts
type GuideTarget = 'agents' | 'claude' | 'custom';
type InstallRecord = { path: string; version: string; hash: string };
type GuideInstalls = Partial<Record<GuideTarget, InstallRecord>>;
type GuideStatus = 'installed' | 'updated' | 'unchanged' | 'missing'
  | 'conflict' | 'newer' | 'busy' | 'error';
type GuideResult = {
  target: GuideTarget;
  path: string;
  status: GuideStatus;
  message?: string;
};

// 在 installer.ts 导出，供 settings.tsx 导入类型。
interface GuideHost {
  app: App; // 类型导入来自 obsidian。
  manifest: { version: string };
  settings: { guideFolder: string; guideInstalls: GuideInstalls };
  saveSettings(): Promise<void>;
}

class GuideInstaller {
  constructor(host: GuideHost, body: string);
  busy: boolean;
  results: Partial<Record<GuideTarget, GuideResult>>;
  install(target: GuideTarget): Promise<GuideResult>;
  updateInstalled(): Promise<void>;
  dispose(): void;
}
```

- `core.mjs` 导出 `guideTargetPath(target, folder)`、`renderGuide(body, version)`、`sha256(text)` 和 `decideGuideWrite(input)`，用 JSDoc（类型注释）明确字符串联合与返回类型。
- `decideGuideWrite` 输入包含 `mode`、`exists`、`currentHash`、`desiredHash`、`installedHash`、`installedVersion`、`currentVersion`。
- 决策返回 `write | unchanged | missing | conflict | not-installed | newer`。错误由宿主操作层转为 `GuideResult`，不塞进纯函数。
- 服务的 `dispose()` 设置自身不可逆的关闭标记。每次异步读取之后、写入之前检查该标记，避免同一插件实例重新加载时旧服务恢复工作。

---

## Phase 1：英文指导与可执行示例

> Task 1 交付一份独立可用的正文和直接验证正文的测试。

### Task 1 · 正文源稿与打包

**Files**

- Create：`src/agent-guide/mosaic.md`、`src/markdown.d.ts`、`tests/agent-guide-content.test.mjs`。
- Modify：`esbuild.config.mjs`、`tests/helpers/bundle.mjs`。
- Read：八篇英文用户指南，重点为 `chart.md`、`data-table.md`、`dataset-guide.md`、`tag-syntax.md`，以及其余四类区块指南。

**Interfaces**

- Consumes：现有 `parseBlockSource`、`BLOCK_LANGUAGES`、`createBlockProcessor`、`parseDatasetManifest`、`parseDatasetData`。
- Produces：无元数据包装的英文正文，以及 `.md` 导入得到字符串的构建能力。
- 与 Task 2 独立，可同时实施，双方不修改同一个文件。Task 3 等待两者完成。

- [ ] **Step 1 · 先写读取实际正文的失败测试。** 六类示例必须从 Markdown 文件提取，不能在测试里复制六份另行维护的样例。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBlockSource } from '../src/parse/block-source.mjs';
import { COMPONENT_NAMES } from '../src/parse/chart-tag.mjs';

test('the shipped guide contains valid examples for every block', () => {
  const body = readFileSync(new URL('../src/agent-guide/mosaic.md', import.meta.url), 'utf8');
  const examples = [...body.matchAll(/^```(chart|datatable|metricgrid|timeline|decisionbox|flowdiagram)\n([\s\S]*?)^```$/gm)];
  assert.deepEqual(
    [...new Set(examples.map(match => match[1]))].sort(),
    COMPONENT_NAMES.map(name => name.toLowerCase()).sort(),
  );
  for (const [, language, source] of examples) {
    const parsed = parseBlockSource(source);
    assert.deepEqual(parsed.unrecognized, [], language);
    assert.ok(Object.keys(parsed.attributes).length > 0, language);
  }
});
```

- [ ] **Step 2 · 运行失败测试。** `node --test tests/agent-guide-content.test.mjs` 应因正文文件不存在失败，不能因测试导入错误失败。
- [ ] **Step 3 · 写入英文正文。** 用 `# Mosaic Usage Guide` 为标题，按用途选择、写法、六类示例、外部数据、排错组织，保持无脚本、无本机信息。
- [ ] **Step 4 · 六个内联示例使用以下最小输入。** 将每个输入写入相应语言的真实代码围栏，不把这段 JavaScript 数组作为分发内容。

```js
const examples = [
  ['chart', '---\ntype: line\nx: month\nseries: amount\ntitle: Monthly output\n---\nmonth,amount\n2026-01,80\n2026-02,120'],
  ['datatable', '---\ntitle: Work items\n---\nitem,amount\nDraft,2\nReview,1'],
  ['metricgrid', '---\ntitle: Key metrics\n---\nlabel,value\nCompleted,12\nRemaining,3'],
  ['timeline', '---\ntitle: Delivery timeline\n---\ndate,title\n2026-01-01,Draft\n2026-02-01,Launch'],
  ['decisionbox', '---\ntitle: Delivery decision\nstatus: accepted\n---\nlabel,value\nChoice,Ship a small first version'],
  ['flowdiagram', '---\ntitle: Delivery flow\n---\n{"nodes":[{"id":"draft","label":"Draft"},{"id":"review","label":"Review"}],"edges":[{"from":"draft","to":"review"}]}'],
];
```

- [ ] **Step 5 · 补齐一个完整外部数据例子。** 源文件为 `data/monthly.csv`，清单为 `data/monthly.dataset.json`，示例笔记位于库根。Chart 与 DataTable 的示例均使用 `dataset: data/monthly.dataset.json`，不附内联 body。

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

```csv
Date,Amount
2026-01-01,80
2026-02-01,120
```

- [ ] **Step 6 · 补强测试到语义与渲染。** 复用 `tests/helpers/dom.mjs` 与 `loadComponents()`，将正文里提取的六类内联输入交给真实 `createBlockProcessor`。断言 `.mosaic-error` 不存在，并分别存在 `[data-plot]`、`table`、`.mosaic-metric-item`、`.mosaic-timeline-item`、`.mosaic-decision-list`、`svg`。调用捕获的 teardown（卸载回调）清理每个测试块。
- [ ] **Step 7 · 验证正文里的数据清单。** 从 `## External dataset` 一节提取唯一的 `json` 清单和 `csv` 数据，调用现有两个数据解析函数，断言得到两行、Amount 为 80 和 120。不要用另一份硬编码清单代替分发正文。
- [ ] **Step 8 · 配置文本打包。** 在生产和测试 esbuild 配置各增加同一条 loader，不引入运行时读包内文件的逻辑。

```ts
// src/markdown.d.ts
declare module '*.md' {
  const text: string;
  export default text;
}
```

```js
// 两处 esbuild 配置新增同一项。
loader: { '.md': 'text' },
```

- [ ] **Step 9 · 验证并提交该逻辑单元。** 先运行正文测试，再运行 `npm test` 和 `npm run build`。提交信息使用 `feat: bundle concise agent guidance`，正文说明独立指导及真实示例验证；不改版本号。

---

## Phase 2：安装策略与文件维护

> Task 2 交付可独立测试的安装服务，不依赖设置界面，也不自动写入任何真实用户目录。

### Task 2 · 路径、所有权与更新服务

**Files**

- Create：`src/agent-guide/core.mjs`、`src/agent-guide/installer.ts`、`tests/agent-guide-policy.test.mjs`、`tests/agent-guide-installation.test.mjs`。
- Modify：`tests/helpers/entry.tsx`，仅导出 `GuideInstaller`。
- Read：`src/parse/vault-path.mjs` 的路径边界，不修改它或复用其 Dataset 专用错误文案。

**Interfaces**

- Consumes：`GuideHost` 与字符串正文，正文可以在测试中直接传入，不依赖 Task 1 的文件存在。
- Produces：「固定接口」列出的纯函数、类型和 `GuideInstaller`。

- [ ] **Step 1 · 先写策略测试。** 固定标准目录、自定义文件名，以及自动模式不创建缺失文件的行为。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { guideTargetPath, decideGuideWrite } from '../src/agent-guide/core.mjs';

test('three destinations use the agreed names', () => {
  assert.equal(guideTargetPath('agents', ''), '.agents/skills/mosaic/SKILL.md');
  assert.equal(guideTargetPath('claude', ''), '.claude/skills/mosaic/SKILL.md');
  assert.equal(guideTargetPath('custom', 'Reference'), 'Reference/Mosaic-Usage-Guide.md');
  assert.equal(guideTargetPath('custom', ''), 'Mosaic-Usage-Guide.md');
});

test('automatic updates never recreate a missing guide', () => {
  assert.equal(decideGuideWrite({
    mode: 'auto', exists: false, currentHash: null,
    desiredHash: 'next', installedHash: 'previous',
    installedVersion: '1.1.6', currentVersion: '1.1.7',
  }), 'missing');
});

test('locally edited files are preserved', () => {
  assert.equal(decideGuideWrite({
    mode: 'auto', exists: true, currentHash: 'user-edit',
    desiredHash: 'next', installedHash: 'previous',
    installedVersion: '1.1.6', currentVersion: '1.1.7',
  }), 'conflict');
});
```

- [ ] **Step 2 · 运行失败测试。** `node --test tests/agent-guide-policy.test.mjs`，确认缺少实现导致失败。
- [ ] **Step 3 · 实现路径规则。** 先拒绝绝对路径、盘符、URL scheme（地址协议）、控制字符、`..` 路径段和 `~` 展开写法，再统一分隔符与冗余 `.`。接受空目录为库根。宿主层另拒绝写入实际 `vault.configDir` 及其子目录，不能只硬编码 `.obsidian`。
- [ ] **Step 4 · 实现内容生成和校验。** 三个目标调用同一个函数，元数据使用插件自身版本，不维护单独递增的技能版本。

```js
export function renderGuide(body, version) {
  return [
    '---',
    'name: mosaic',
    'description: Create and edit Mosaic charts, tables, metric cards, timelines, decision records, and flow diagrams in Obsidian notes.',
    'metadata:',
    `  mosaic-version: "${version}"`,
    '---',
    '',
    '<!-- Managed by Mosaic. Local edits pause automatic updates. Rename or remove this file to stop updates at this path. -->',
    '',
    body.trim(),
    '',
  ].join('\n');
}

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 5 · 按固定顺序实施决策。** 自动模式先查安装记录；不存在则 `not-installed`。已有记录版本更高则 `newer`。路径不存在则手动 `write`、自动 `missing`。内容等于预期则 `unchanged`。其余情况下只有实际校验值等于已记录校验值才 `write`，否则 `conflict`。版本比较按三个数值段进行，不按字符串字典序。
- [ ] **Step 6 · 实现具体文件操作。** 普通可见 Markdown 文件使用 `Vault.create` / `Vault.process`。包含隐藏路径段的技能文件或自定义文档使用 `app.vault.adapter`：首次手动创建使用 `write`，修改现有文件使用其原生 `process`。父目录使用对应接口逐层创建，不通过 `getFiles()` 寻找隐藏文件。
- [ ] **Step 7 · 将读写保护落到实际写入点。** `Vault.process` 与 `DataAdapter.process` 的同步回调都核对本次读到的原文仍与校验时一致，不一致则抛出冲突。自动模式遇到缺失文件不回退到 `write`。路径处是文件夹或父路径处是文件时报告错误，不清理用户路径。不自行实现临时文件替换、备份目录或第二套原子写入机制。
- [ ] **Step 8 · 管理状态。** 一次操作只持有一个 `busy` 标志，`finally` 释放。`updateInstalled()` 在同一次操作内逐目标执行，单目标出错仍检查其余目标。默认没有记录时立即返回，不做文件访问。
- [ ] **Step 9 · 管理记录。** 服务构造时仅收窄新增字段：目标必须是三个已知键、路径符合该目标规范、版本是三段数字、校验值是 64 位十六进制。无效 `guideFolder` 回到空字符串，无效记录不参与自动写入。旧 `showExportBtn` 值保持原样，不重构整套设置读取逻辑。
- [ ] **Step 10 · 写入后保存。** 新记录为 `{path, version: host.manifest.version, hash: desiredHash}`，替换对应出口记录后 `await host.saveSettings()`。失败时恢复旧内存记录，返回带英文错误消息的结果。不删除已写入文件，不通过删除数据来回滚。
- [ ] **Step 11 · 测试真实服务调用。** 将 `GuideInstaller` 导出到现有测试打包入口，使用本文件内的 Map（内存映射）构造笔记库替身，记录每次创建、读取、写入与保存。不要创建长期文件系统模拟框架。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { installGlobals } from './helpers/dom.mjs';
import { loadComponents } from './helpers/bundle.mjs';

installGlobals();
const { GuideInstaller, TFile } = await loadComponents();

test('only explicit installation creates a guide', async () => {
  const files = new Map();
  const folders = new Set(['']);
  const stats = { fileReads: 0, fileWrites: 0, settingsSaves: 0 };
  const parent = path => path.split('/').slice(0, -1).join('/');
  const fileAt = path => files.has(path) ? Object.assign(new TFile(), { path }) : null;
  const adapter = {
    async stat(path) {
      stats.fileReads++;
      const type = files.has(path) ? 'file' : folders.has(path) ? 'folder' : null;
      return type ? { type, size: 0, ctime: 0, mtime: 0 } : null;
    },
    async read(path) {
      stats.fileReads++;
      if (!files.has(path)) throw new Error('File not found');
      return files.get(path);
    },
    async mkdir(path) {
      assert.ok(folders.has(parent(path)));
      folders.add(path);
    },
    async write(path, value) {
      assert.ok(folders.has(parent(path)));
      files.set(path, value);
      stats.fileWrites++;
    },
    async process(path, fn) {
      const next = fn(await this.read(path));
      await this.write(path, next);
      return next;
    },
  };
  const vault = {
    adapter, configDir: '.obsidian', getFileByPath: fileAt,
    getFolderByPath: path => folders.has(path) ? { path } : null,
    getRoot: () => ({ path: '' }),
    read: file => adapter.read(file.path),
    process: (file, fn) => adapter.process(file.path, fn),
    createFolder: path => adapter.mkdir(path),
    async create(path, value) {
      assert.equal(files.has(path), false);
      await adapter.write(path, value);
      return fileAt(path);
    },
  };
  const host = {
    app: { vault }, manifest: { version: '1.1.6' },
    settings: { guideFolder: '', guideInstalls: {} },
    async saveSettings() { stats.settingsSaves++; },
  };
  const installer = new GuideInstaller(host, '# Mosaic Usage Guide\n');
  await installer.updateInstalled();
  assert.equal(stats.fileReads, 0);
  assert.equal(stats.fileWrites, 0);
  const result = await installer.install('agents');
  assert.equal(result.status, 'installed');
  assert.equal(result.path, '.agents/skills/mosaic/SKILL.md');
  const writes = stats.fileWrites;
  await installer.updateInstalled();
  assert.equal(stats.fileWrites, writes);
  assert.match(host.settings.guideInstalls.agents.hash, /^[a-f0-9]{64}$/);
});
```

- [ ] **Step 12 · 覆盖维护边界。** 为首次安装、重复点击、新版本更新、已有同名文件、正文改动、改名/删除、较新记录、一个出口写入失败、设置保存失败、目录切换成功/失败、卸载期间暂停各写一条行为测试。断言真实文件内容和旧记录未被破坏，不只断言状态文案。
- [ ] **Step 13 · 验证并提交。** 执行 `node --test tests/agent-guide-policy.test.mjs tests/agent-guide-installation.test.mjs`，再执行 `npm test`、`npm run build`。提交信息使用 `feat: manage installed agent guidance`，正文说明显式安装、更新保护及失败隔离。

---

## Phase 3：设置与插件生命周期

> Task 3 将已验证的内容和安装服务接入插件，不改变现有渲染启动顺序。

### Task 3 · 按钮、目录和加载接线

**Files**

- Modify：`src/settings.tsx`、`src/main.tsx`、`tests/helpers/entry.tsx`、`tests/helpers/obsidian-stub.mjs`。
- Create：`tests/agent-guide-settings.test.mjs`。
- Read：`docs/policies/` 四篇规范与 Obsidian 类型中的 `SettingDefinitionRender`、`SettingFolderControl`、`PluginSettingTab.update`。

**Interfaces**

- Consumes：Task 1 的 Markdown 字符串导入、Task 2 的 `GuideInstaller` / `GuideInstalls` / `GuideTarget`。
- Produces：`MosaicPlugin.guideInstaller`、`guideFolder: string`、`guideInstalls: GuideInstalls` 和设置操作。
- 依赖 Task 1 与 Task 2 完成，不与它们并行修改共享测试文件。

- [ ] **Step 1 · 为真实设置定义写失败测试。** 从测试打包入口导出 `MosaicSettingTab`，调用 `getSettingDefinitions()`，驱动返回设置行的 `render` 回调。用可记录按钮文字和回调的 `Setting` 替身点击按钮，断言调用正确目标。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { installGlobals } from './helpers/dom.mjs';
import { loadComponents } from './helpers/bundle.mjs';
import { guideTargetPath } from '../src/agent-guide/core.mjs';

installGlobals();
const { MosaicSettingTab } = await loadComponents();

test('install buttons target the correct client without rebuilding notes', async () => {
  const installerCalls = [];
  let previewRebuilds = 0;
  const plugin = {
    settings: { showExportBtn: false, guideFolder: '', guideInstalls: {} },
    guideInstaller: {
      busy: false, results: {},
      async install(target) {
        installerCalls.push(target);
        return { target, path: guideTargetPath(target, ''), status: 'installed' };
      },
    },
    async saveSettings() {},
    rerenderOpenPreviews() { previewRebuilds++; },
  };
  const tab = new MosaicSettingTab({}, plugin);
  const buttons = [];
  const row = {
    addButton(configure) {
      const button = {
        setButtonText(text) { this.text = text; return this; },
        setDisabled(disabled) { this.disabled = disabled; return this; },
        onClick(click) { this.click = click; return this; },
      };
      configure(button);
      buttons.push(button);
      return this;
    },
  };
  tab.getSettingDefinitions().find(item => item.name === 'Agent skills').render(row, null);
  assert.deepEqual(buttons.map(button => button.text), ['Agents', 'Claude']);
  await buttons[0].click();
  await buttons[1].click();
  assert.deepEqual(installerCalls, ['agents', 'claude']);
  await tab.setControlValue('guideFolder', 'Reference');
  assert.equal(plugin.settings.guideFolder, 'Reference');
  assert.equal(previewRebuilds, 0);
  await tab.setControlValue('showExportBtn', true);
  assert.equal(previewRebuilds, 1);
});
```

- [ ] **Step 2 · 运行失败测试。** `node --test tests/agent-guide-settings.test.mjs`，确认缺少新字段或控件而失败。
- [ ] **Step 3 · 增加设置字段。** 默认 `guideFolder: ''`、`guideInstalls: {}`，每个实例创建独立的安装记录对象。读取旧版只带 `showExportBtn` 的设置必须成功。
- [ ] **Step 4 · 接入声明式按钮与文件夹输入。** 在 `MosaicSettingTab` 增加 `installAndRefresh(target)`：调用服务、显示一次结果提示、刷新设置状态，并捕获错误。该方法不重建笔记预览。

```ts
{
  name: 'Agent skills',
  desc: 'Install Mosaic guidance in this vault. Unmodified installed files follow plugin updates.',
  render: setting => {
    setting.addButton(button => button.setButtonText('Agents')
      .setDisabled(this.plugin.guideInstaller.busy)
      .onClick(() => this.installAndRefresh('agents')));
    setting.addButton(button => button.setButtonText('Claude')
      .setDisabled(this.plugin.guideInstaller.busy)
      .onClick(() => this.installAndRefresh('claude')));
  },
},
{
  name: 'Guide folder',
  desc: 'Choose a folder in this vault for Mosaic-Usage-Guide.md.',
  control: { type: 'folder', key: 'guideFolder', defaultValue: '', includeRoot: true },
},
{
  name: 'Usage guide',
  desc: 'Write the same guidance as a document for your agent to read.',
  render: setting => {
    setting.addButton(button => button.setButtonText('Write guide')
      .setDisabled(this.plugin.guideInstaller.busy)
      .onClick(() => this.installAndRefresh('custom')));
  },
},
```

- [ ] **Step 5 · 显示状态。** 设置描述以服务的 `results` 和已保存记录生成，按钮操作开始和结束都刷新界面。安装成功显示相对文件路径，不能声称智能体已经加载。自定义文档提示为 `Ask your agent to read this file before creating Mosaic content.`。
- [ ] **Step 6 · 接入加载和卸载。** Markdown 文本静态打进发布包，服务不在启动时读取插件目录里的附加资源。

```ts
import guideBody from './agent-guide/mosaic.md';
import { GuideInstaller } from './agent-guide/installer';

// loadSettings() 完成后、注册设置页前，捕获本次加载的服务：
const guideInstaller = new GuideInstaller(this, guideBody);
this.guideInstaller = guideInstaller;

// 在已有 onLayoutReady 回调中保留原预览重建，再追加：
void guideInstaller.updateInstalled();

// onunload() 开头，在其他清理前：
this.guideInstaller?.dispose();
```

- [ ] **Step 7 · 做接线测试。** 使用插件类和最小宿主替身调用 `onload()`，捕获布局回调，证明布局就绪前未检查指导、就绪后恰好检查一次，原内容块注册照常发生。调用 `onunload()` 后证明旧服务不再继续新写入。
- [ ] **Step 8 · 验证并提交。** 新设置测试全绿后运行 `npm test`、`npm run build`，确认 `.md` 进入 `main.js` 且没有第四个发布附件。提交信息使用 `feat: add agent guide install controls`。

---

## Phase 4：用户说明与验收

> Task 4 验证实际使用效果和交付完整性，不把解析测试冒充客户端发现测试。

### Task 4 · 文档、宿主与客户端验证

**Files**

- Create：`docs/guides/agent-guide.md`、`docs/guides/agent-guide-zh.md`。
- Modify：`README.md`、`docs/README-zh.md`、`docs/design/architecture.md`、`AGENTS.md`。
- Test：前述四个测试文件与独立测试笔记库，不使用个人日常笔记库。

**Interfaces**

- Consumes：Task 1–3 的完整安装流程与稳定文件命名。
- Produces：用户指南、宿主验收记录、真实测试数量与完成状态。

- [ ] **Step 1 · 写用户说明。** 英文先行、中文镜像，说明三个出口、库内目录范围、自动更新时机、正文改动暂停更新、改名/删除不重建、设置保存失败如何重试。
- [ ] **Step 2 · 写最小设计说明。** 在总体设计中补充指导分发独立于渲染管线、一份正文三个出口、选择校验后替换而不做合并的理由，不复述用户操作步骤。
- [ ] **Step 3 · 更新项目入口。** README 双语增加新指南链接，公开说明只按用户选择写入当前库内的固定文件，不新增网络访问或遥测。AGENTS 记录源稿位置和内容测试门槛，不新增一份来源映射表。
- [ ] **Step 4 · 核验双语与源码。** 对比双语指南中的路径、按钮标签和示例字节，确认正文只维护一份，没有第二份生成逻辑。
- [ ] **Step 5 · 在独立测试笔记库验证三个出口。** 分别点击 Agents、Claude、Write guide，检查实际文件、状态、重复点击和按内容保护。安装 Agents 和 Claude 后同时保留两份，不自动清理其中任何一份。
- [ ] **Step 6 · 验证升级和撤销。** 在测试库用夹具生成较旧版本的指导内容及其有效安装记录，再加载本次构建，确认未修改的文件更新，不要求不存在的旧版插件具有安装功能。分别编辑正文、改名、删除文件，再重载插件，确认没有覆盖或重建。故意让一个目录不可写，确认另一个目标仍能更新，图表仍正常。
- [ ] **Step 7 · 验证真实客户端发现。** 在测试库根目录启动 Codex 与 Claude Code 的新会话，分别确认技能 `mosaic` 被发现并可显式调用。没有登录或没有客户端时如实记录未验证，不能用文件存在代替此项成功。
- [ ] **Step 8 · 验证指导可用性。** 给每个可用客户端仅提供该指导和同一份虚构数据，请其生成六类内容块。对产出运行现有解析/渲染验证，检查无未知属性、错误框和虚构字段。验收使用模拟数据，不上传用户笔记。
- [ ] **Step 9 · 验证自定义文档模式。** 将 `Mosaic-Usage-Guide.md` 的路径明确交给一个测试会话，确认无需开发仓库即可生成合法内容块，不将这个测试报告为自动发现。
- [ ] **Step 10 · 执行完整门槛。** `npm test`、`npm run build`，检查 `main.js` 仍低于 1,843,200 字节。Node 22 / 24 的既有持续集成保持通过，不追加独立流水线。
- [ ] **Step 11 · 如实记录平台范围。** 已执行的 Linux、macOS、Windows、移动端测试分别列出。尚未执行的平台不标为通过，不能仅凭 `isDesktopOnly: false` 声称已经验证移动端。
- [ ] **Step 12 · 文档提交与完整审查。** 文档提交信息使用 `docs: explain agent guide installation`，随后执行 review（代码审查），修复实际问题并复测。完成后归档本计划，记录最终提交与被修正的设计项。

---

## 完成标准与交接

> 安装可发现、内容可使用、更新不破坏用户文件，三者同时成立才算功能完成。

- 命名门槛已获得用户确认，最终文件路径与按钮说明一致。
- 未安装用户的启动路径不访问指导文件，不创建目录。
- 三个出口的内容一致，重复安装和同版重载不重复写入。
- 新版自动维护、改动保护、缺失不重建和失败隔离都有行为测试。
- 六类最小示例和完整数据清单来自分发正文并通过语义验证。
- 客户端发现与指导使用的实际验收结果单独记录，不与单元测试混淆。
- 模块没有网络请求、脚本执行、全局目录写入、新依赖或渲染管线改造。
- 全套测试、生产构建与包体积检查通过，双语用户说明完整。
- 计划执行建议：Task 1 与 Task 2 可并行，Task 3 等待前两项，Task 4 等待完整功能。
- 交付可选项：由本会话按任务执行，或整理提示词交给其他 Agent。交接以本计划为实施依据，不重复复制实现细节。
- 交给其他机器前须先提交并推送包含本计划的分支，提示词记录仓库、分支、实际提交和计划路径，不编造尚不存在的提交。
- 执行提示词要求阅读 AGENTS、完成计划后审查修复并复测，再按 ship（交付）规范处理提交。仓库默认本地合并主分支并推送，不创建 PR（合并请求）；只有用户明确改为 PR 流程时才创建。
- 本计划不授权发布新版本。打标签和发版仍需用户明确要求。

---

## 核验依据

> 外部格式约束与本地接口都已检查，实施前只复核确实发生变化的部分。

- 代码基线：`7a3b6ce598187419f73473f29a1dd6a1edd5ac8b`，插件版本 `1.1.6`。
- `src/settings.tsx` 使用 `getSettingDefinitions()`，尚无指导安装字段或控件。
- `src/main.tsx` 已有设置读取、布局就绪和卸载入口，可增量接入而不重构生命周期。
- 已安装 Obsidian 类型包含 `SettingDefinitionRender.render`、`SettingFolderControl.includeRoot`，均标注自 1.13.0 可用。
- 已安装 Obsidian 类型的 `DataAdapter.process` 提供原子的读、改、存回调，可用于隐藏文件的更新检查，无需自建原子写入协议。
- `tests/helpers/bundle.mjs`、`tests/helpers/entry.tsx` 和宿主替身可复用，不需要新的测试依赖。
- [Codex 技能格式与目录](https://learn.chatgpt.com/docs/build-skills)：技能目录使用 `SKILL.md`，项目目录为 `.agents/skills`。
- [Claude Code 技能格式与目录](https://code.claude.com/docs/en/skills)：项目目录为 `.claude/skills`，技能入口使用 `SKILL.md`。
- 本节外部文档核验日期：2026-09-10。客户端发现支持以真实客户端验收为准。
