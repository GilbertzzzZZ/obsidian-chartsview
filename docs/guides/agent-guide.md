# Import Mosaic guidance

<p align="center"><b>English</b> | <a href="agent-guide-zh.md">简体中文</a></p>

> Mosaic can import a complete English authoring reference as an agent skill or as an ordinary Markdown guide.
> Each imported artifact is independently usable; it does not depend on this repository or another installed copy.

Importing guidance is optional and does not change how Mosaic renders notes. Open Mosaic's settings when you want to create a copy.

## Import a skill

> Use the native `Import skill` group. The default scope is `Current vault`.

Mosaic shows the active scope and includes the destination in every result. On desktop, turn on `Global` to change the scope to `User home (global)`. Turning the switch on or off does not write, move or delete anything; click a button to perform an import. Mobile does not show the `Global` switch and imports skills only into the current vault.

| Button | Current vault destination | User home (global) destination |
| --- | --- | --- |
| `to .agents` | `.agents/skills/mosaic/SKILL.md` | `.agents/skills/mosaic/SKILL.md` under the current user's home directory |
| `to .claude` | `.claude/skills/mosaic/SKILL.md` | `.claude/skills/mosaic/SKILL.md` under the current user's home directory |
| `to path` | The selected skill parent plus `mosaic/SKILL.md` | The selected desktop directory plus `mosaic/SKILL.md` |

In vault scope, the native folder control for `to path` defaults to `.agents/skills`. You may select any folder in the current vault, including the vault root. In global scope, the selected parent defaults to the current user's `.agents/skills` directory. Use `Choose folder` to open the operating system's directory picker, then click `to path` to import into that selection. Selecting another global parent affects only the next custom import. Canceling the picker does not write a file, change the current selection or change an installation record.

The three buttons create skill files only. Clients differ in how and when they load skills; consult the chosen client's documentation if a newly imported or updated skill is not available in an existing session.

Previously imported skills can coexist across `.agents`, `.claude`, custom parents, vaults and the global scope. Changing the current scope or parent alone does not remove, relocate or stop tracking an earlier installation. After a new custom import succeeds for the same scope, the old file remains in place and the new destination becomes the recorded custom target.

## Import an ordinary guide

> Use the separate native `Import guides` group. Ordinary guides always stay inside the current vault.

The folder control defaults to `docs/guides`. Without changing it, click `Import` to create:

```text
docs/guides/Mosaic-Usage-Guide.md
```

The folder control uses Obsidian's native vault folder selector and accepts the vault root. An existing saved folder is preserved, including an explicitly selected root; only a missing setting adopts `docs/guides`. Changing the folder alone does not write anything.

The ordinary guide is independent of the skill `Global` switch. It remains vault-relative even when the skill scope reads `User home (global)`. It is a plain Markdown document, so tell an agent to read that exact file before creating Mosaic content.

## What import changes

> No file is created until you click one of the skill buttons or the guide `Import` button.

- Vault imports write only to the displayed vault-relative destination.
- On desktop, a global skill import writes outside the vault only after you enable `Global` and click a skill button. It writes the selected `mosaic/SKILL.md`; it does not change global client configuration.
- Global scope, the selected global parent and successful global installation records are device-local to the current vault. They are not stored in synchronized plugin data and do not authorize global access on another device.
- Guide import adds no network request, telemetry, agent launch, script or symbolic link. Mosaic does not upload note content.
- A failure stays local to that destination and does not affect rendering or another import.

## How updates work

> Mosaic checks only recorded destinations once per plugin load and replaces only content it still owns.

- There is no timer, vault scan or search for moved files.
- If a recorded file still matches the content Mosaic last installed, a plugin update can replace the complete file with the new guide.
- If a file already contains the desired bytes, Mosaic leaves it unchanged.
- If you edit a file, Mosaic preserves the entire file and pauses automatic updates for that destination. It does not merge text or create a backup copy.
- If you rename, move or delete a file, Mosaic does not search for it or recreate it automatically.
- A guide recorded by a newer Mosaic version is never downgraded by an older plugin version.
- Vault and global records are independent. An update or failure in one scope cannot overwrite the other scope's result.
- If another vault has already updated the same global skill to the desired content, Mosaic accepts it unchanged. If the content differs from the recorded owned copy, Mosaic preserves it.

To restore a clean managed copy, keep any edited copy under another name and click the intended destination button again. Importing to a new custom parent preserves the old file; the successful new destination becomes the one maintained for that target and scope.

## Retry a failed import

> Fix the displayed path or permission problem, then repeat the same button action.

- If an unrelated or modified file already occupies the destination, Mosaic keeps it. Rename or move that file before retrying.
- If a folder cannot be written, restore access or select another permitted folder.
- Mosaic records an installation only after the file write succeeds. If the file was written but saving the record failed, repeat the same import; Mosaic can recognize the complete file and record it without rewriting identical bytes.
- If desktop global facilities are unavailable, Mosaic reports a readable error. Vault imports and rendering remain available.

## Use the imported guidance

- Ask the agent for a Mosaic block and provide the real data, field meanings and aggregation rules it should use.
- Require the agent to ask when required facts are missing instead of inventing data or rollup definitions.
- Switch the resulting note to Reading view to see Mosaic render the block.
- If you imported the ordinary guide, explicitly provide its vault-relative path to the agent.

For human-facing syntax and troubleshooting, use the [Mosaic block guides](../../README.md#documentation).
