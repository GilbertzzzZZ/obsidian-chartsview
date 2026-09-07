# Publishing to the Obsidian plugin directory

> Maintainer instructions for publishing Mosaic to the Community plugins directory.
> Submit through community.obsidian.md with an Obsidian account, rather than opening a pull request against `obsidianmd/obsidian-releases`.

## One-time setup

> Prepare the accounts and repository metadata required for directory submission.

**Accounts**

- A GitHub account.
- An Obsidian account registered separately at obsidian.md.

**Required files at the repository root**

- `README.md`: the directory listing extracts its content and rewrites relative links and image paths to point to the repository.
- `LICENSE`: declare the license explicitly. Mosaic uses MIT.
- `manifest.json`: the directory reads the copy at the default branch's HEAD.

**Manifest requirements**

- Use a globally unique `id` that does not contain `obsidian`. Mosaic's ID is `mosaic`.
- Use the three-part `x.y.z` format for `version`.
- Set `minAppVersion` to the lowest Obsidian version actually verified.
- Omit `fundingUrl` when not accepting donations.

---

## Release procedure

> Complete local verification, create the version tag, and publish the release assets.
> Directory submission is required only for the first release.

### Step 1 · Local verification

```bash
npm ci          # Install the committed lockfile without changing it
npm test        # All tests must pass
npm run build   # TypeScript checking and the production bundle must pass
```

- Increment `manifest.json`'s `version` according to [Semantic Versioning](https://semver.org/).
- Commit the version change to the default branch before tagging.

### Step 2 · Create the tag

- Match the tag name exactly to `manifest.json`'s `version`, without a `v` prefix.
- Replace `1.0.0` in the example with the version being released.

```bash
git tag -a 1.0.0 -m "1.0.0"
git push origin 1.0.0
```

- Use `-a` to create an annotated tag.
- Use the same version for the annotation message passed to `-m`.

### Step 3 · Publish the release

- `.github/workflows/release.yml` runs on tag pushes, builds the plugin, and creates a draft release with these assets:
  - `main.js`
  - `manifest.json`
  - `styles.css`
- Before publishing the draft, confirm that the workflow checked out the release tag's final commit and built that same commit. Peel annotated tags with `git rev-parse "refs/tags/<version>^{commit}"`; compare the full commit with the workflow checkout log and build attestation. A matching version string alone is insufficient.
- Read `docs/engineering/openglance-rendering-sync.md` at that release commit for its upstream baseline and verification status. Do not substitute the latest branch copy or describe a pending adoption as verified.
- When the workflow finishes, open the repository's Releases page, edit the draft, add release notes, and select **Publish release**.
- Attach the three files individually. Obsidian downloads them from the release whose tag matches the manifest version.
- Do not substitute the source archive for the assets. The source archive does not contain the untracked build output `main.js`.
- If the workflow fails and a manual build is necessary, use a clean checkout of the exact release tag, run `npm ci`, `npm test`, and `npm run build`, and record the full build commit. Confirm it equals the tag's final commit before uploading all three assets. Never upload a bundle built from a different branch or a dirty working tree.

### Step 4 · Submit to the directory

1. Open [community.obsidian.md](https://community.obsidian.md) and sign in with the Obsidian account.
2. Link the GitHub account so the directory can verify repository ownership.
3. Select **Add a plugin**, enter the repository URL, and submit.

- Review the findings from the automatic review on the directory page.
- For each correction, update the repository, increment the version, and publish a new GitHub release.
- Resolve all review errors before the plugin can be installed through Obsidian.
- After approval, announcements can be posted to the forum's [Share & showcase](https://forum.obsidian.md/c/share-showcase/9) category and the Discord `#updates` channel.

---

## Troubleshooting

> Check repository metadata, version matching, and release assets when publication or installation fails.

- **Incorrect directory metadata:** keep the default branch's `manifest.json` aligned with the release asset. The directory reads the default branch copy.
- **Installation fails:** confirm that the release tag matches the manifest version and all three assets are attached.
- **Plugin ID rejected:** remove `obsidian` from the ID.
- **Review findings persist:** publish each correction as a new version, rather than leaving the correction only in the repository.

---

## Related documents

> Read the archived official policies before changing the UI, settings, or manifest.

- [[docs/policies/obsidian-developer-policies|obsidian-developer-policies.md]]
- [[docs/policies/obsidian-submission-requirements|obsidian-submission-requirements.md]]
- [[docs/policies/obsidian-plugin-guidelines|obsidian-plugin-guidelines.md]]
- [[docs/policies/obsidian-plugin-self-critique-checklist|obsidian-plugin-self-critique-checklist.md]]
- [[AGENTS|AGENTS.md]]: repository rules and marketplace compliance requirements.
