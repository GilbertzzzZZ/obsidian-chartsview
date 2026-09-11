# Install the Mosaic agent guide

<p align="center"><b>English</b> | <a href="agent-guide-zh.md">简体中文</a></p>

> Mosaic can place its concise usage guide at up to three fixed locations inside the current vault.
> Installation is optional and does not change how Mosaic renders notes.

## Choose a destination

> Open Mosaic's settings and install only the destinations used by your agent.

| Setting action | File inside the vault | How an agent uses it |
| --- | --- | --- |
| Click `Agents` | `.agents/skills/mosaic/SKILL.md` | Agents-compatible clients can discover the `mosaic` skill. |
| Click `Claude` | `.claude/skills/mosaic/SKILL.md` | Claude Code can discover the `mosaic` skill. |
| Choose `Guide folder`, then click `Write guide` | `<chosen-folder>/Mosaic-Usage-Guide.md` | Tell the agent to read this exact file before it creates Mosaic content. |

- Leaving `Guide folder` empty writes `Mosaic-Usage-Guide.md` at the vault root.
- The custom document is a plain Markdown file. It is not an automatically discovered skill.
- You can keep the Agents, Claude, and custom copies together. Installing one never removes another.
- All installed copies contain the same English guidance, including minimal examples for all six Mosaic block types.

---

## What installation changes

> Guide installation is opt-in and stays within the current vault.

- Mosaic creates no guide file until you click one of the three installation buttons.
- Each button writes only its fixed file inside the current vault.
- Mosaic does not write to global skill directories, change client configuration, start an agent, or create symbolic links.
- Guide installation adds no network request or telemetry and does not upload note content.
- A failure for one destination does not undo or block another successful destination.

---

## How updates work

> Mosaic checks only recorded installations once per plugin load and replaces only content it still owns.

- There is no timer, vault scan, or search for moved files.
- If a recorded file still matches the content Mosaic last installed, a plugin update can replace the complete file with the new guide.
- If the file already contains the complete guide for this plugin version, Mosaic leaves it unchanged.
- If you edit the file, Mosaic preserves the entire file and pauses automatic updates for that destination. It does not merge text or create a backup copy.
- If you rename, move, or delete the file, Mosaic reports the recorded path as missing. It does not search for the file or recreate it automatically.
- To restore a clean managed copy, keep any edited copy under another name and click the destination's installation button again.
- Changing `Guide folder` only changes the next custom destination. The old document stays in place and stops receiving updates after `Write guide` succeeds for the new folder.
- A guide recorded by a newer Mosaic version is never downgraded by an older plugin version.
- An agent session that already loaded a skill controls its own refresh. Start a new session or use that client's reload behavior when it does not see an updated file.

---

## Retry a failed installation

> Fix the reported path or permission problem, then repeat the same button action.

- If an unrelated file already occupies the destination, Mosaic keeps it. Rename or move that file before retrying.
- If the folder cannot be written, restore write access or select another vault folder before retrying.
- Mosaic records an installation only after the file write succeeds.
- If the file was written but saving the installation record failed, click the same button again. Mosaic recognizes the complete file and records it without replacing its content.
- The result and path remain visible in Mosaic's settings, while manual actions also show a short notice.

---

## Use the installed guide

> Let the chosen client load the skill, or explicitly provide the custom document path to the agent.

- Ask for a Mosaic block and provide the real data and definitions it should use.
- Require the agent to ask when data or aggregation rules are missing instead of inventing them.
- Switch the resulting note to Reading view to see Mosaic render the block.
- For complete human-facing syntax and troubleshooting, use the [Mosaic block guides](../../README.md#documentation) through the repository README.
