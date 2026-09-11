# 安装 Mosaic agent 指导

<p align="center"><a href="agent-guide.md">English</a> | <b>简体中文</b></p>

> Mosaic 可以把精简的用法指导放到当前 vault（笔记库）内最多三个固定位置。
> 安装是 opt-in（主动选择）功能，不改变 Mosaic 渲染笔记的方式。

## 选择目标

> 打开 Mosaic 设置，只安装你的 agent（智能体）所使用的目标。

| 设置操作 | vault 内文件 | agent 如何使用 |
| --- | --- | --- |
| 点击 `Agents` | `.agents/skills/mosaic/SKILL.md` | 兼容 Agents 的客户端可以发现 `mosaic` skill（技能）。 |
| 点击 `Claude` | `.claude/skills/mosaic/SKILL.md` | Claude Code 可以发现 `mosaic` skill。 |
| 选择 `Guide folder`，再点击 `Write guide` | `<chosen-folder>/Mosaic-Usage-Guide.md` | 让 agent 在创建 Mosaic 内容前明确读取这个文件。 |

- `Guide folder` 留空时，`Mosaic-Usage-Guide.md` 写到 vault 根目录。
- 自定义文档是普通 Markdown 文件，不是可以自动发现的 skill。
- Agents、Claude 与自定义副本可以同时保留。安装其中一个不会删除其他副本。
- 所有安装副本都包含同一份英文指导，包括六类 Mosaic 内容块的最小示例。

---

## 安装会改变什么

> 指导安装仅在用户主动选择后发生，范围不超出当前 vault。

- 点击三个安装按钮之一以前，Mosaic 不创建任何指导文件。
- 每个按钮只写入当前 vault 内对应的固定文件。
- Mosaic 不写入全局 skill 目录，不修改客户端配置，不启动 agent，也不创建符号链接。
- 安装指导不会增加网络请求或 telemetry（遥测），也不会上传笔记内容。
- 一个目标失败不会撤销或阻塞另一个已成功的目标。

---

## 自动更新方式

> Mosaic 每次加载插件时只检查已有安装记录，并且只替换仍由 Mosaic 管理的内容。

- 插件不设置定时任务，不扫描 vault，也不搜索被移动的文件。
- 已记录的文件仍与 Mosaic 上次安装的内容一致时，插件更新可以用新指导替换整个文件。
- 文件已经是本插件版本的完整指导时，Mosaic 保持文件不变。
- 用户编辑文件后，Mosaic 保留完整文件，并暂停该目标的自动更新。插件不合并文本，也不创建备份副本。
- 用户改名、移动或删除文件后，Mosaic 把记录的路径显示为缺失。插件不搜索文件，也不自动重建。
- 如需恢复由插件管理的干净副本，先用其他名称保留编辑版，再次点击该目标的安装按钮。
- 修改 `Guide folder` 只会改变下一个自定义目标。新目录的 `Write guide` 成功后，旧文档仍保留，但不再更新。
- 较新 Mosaic 版本记录的指导不会被较旧插件版本降级。
- 已加载 skill 的 agent 会话由客户端自行刷新。会话看不到更新文件时，请新建会话或使用该客户端的重载方式。

---

## 重试失败的安装

> 修复提示中的路径或权限问题，再次执行同一个按钮操作。

- 目标位置已有无关文件时，Mosaic 会保留它。重试前先改名或移动该文件。
- 文件夹不可写时，恢复写入权限，或先选择 vault 内的另一个文件夹。
- Mosaic 只在文件写入成功后记录安装。
- 文件已经写入、但安装记录保存失败时，再次点击同一个按钮。Mosaic 会识别完整文件并补记安装，不替换文件内容。
- 操作结果和路径会保留在 Mosaic 设置中，手动操作还会显示一条简短提示。

---

## 使用已安装的指导

> 让所选客户端加载 skill，或把自定义文档路径明确交给 agent。

- 请求 agent 创建 Mosaic 内容块，并提供应使用的真实数据和定义。
- 要求 agent 在缺少数据或聚合规则时先确认，不得自行编造。
- 把生成后的笔记切换到阅读视图，查看 Mosaic 渲染结果。
- 完整的用户语法与排错说明见仓库 README 中的 [Mosaic 内容块指南](../README-zh.md#文档)。
