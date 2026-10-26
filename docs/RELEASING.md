# Releases and application updates

LB-Portal uses semantic versions in `package.json` and Git tags in the form `vMAJOR.MINOR.PATCH`. The Windows installer is built as an NSIS installer and published as a GitHub Release. Packaged Windows installations check GitHub Releases for updates automatically at startup and can also check from the in-app update control.

## First release

1. Merge the intended release changes to `main` and confirm `package.json` has the version to publish.
2. Create and push a matching tag. For the current `0.1.0` package version:

   ```powershell
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. GitHub Actions builds the Windows installer, verifies that the tag matches `package.json`, and publishes the installer and updater metadata to the GitHub Release.

## Later versions

Run one of these commands from a clean checkout of `main`:

```powershell
npm run version:patch  # 0.1.0 -> 0.1.1: fixes
npm run version:minor  # 0.1.0 -> 0.2.0: backward-compatible features
npm run version:major  # 0.1.0 -> 1.0.0: breaking changes
```

`npm version` updates `package.json` and `package-lock.json`, commits the version change, and creates the matching `v...` Git tag. Push the commit and tag to start the release workflow:

```powershell
git push origin main --follow-tags
```

The Windows release must include the generated `latest.yml` alongside the installer and `.blockmap`. `electron-updater` reads `latest.yml` to discover the release version and installer URL; without it, installed applications cannot find updates.

Keep the release tag and package version identical. The workflow rejects mismatches. Pre-release versions and tags are not published by this workflow; stable releases are the update channel.

## GitHub configuration

The workflow uses the repository-provided `GITHUB_TOKEN` with `contents: write`; no personal token is needed. GitHub Actions must be enabled for the repository, and the repository or organization must allow Actions to create releases with the workflow token.

The current updater target is Windows x64 with NSIS. macOS auto-updates require signed application builds; the existing macOS packaging configuration does not include signing credentials. Linux is not currently a configured release target.
