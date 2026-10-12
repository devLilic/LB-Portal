# Electron Starter

Electron application starter built for modular desktop apps with a strict typed boundary between Electron main, preload, and renderer.

This starter is intended to be cloned and initialized into a new product, not used as a demo app. The default architecture favors:
- Electron main-process ownership for privileged logic
- typed IPC contracts
- config-driven feature enablement
- TDD for application logic
- minimal UI-heavy testing

## What Is Included

### Stack
- Electron
- React
- TypeScript
- Tailwind CSS
- Vite
- Vitest

### Included Modules
- typed app config
- module registry for main, preload, and renderer
- typed IPC boundary
- optional i18n
- local settings store
- optional GitHub Releases auto-update flow
- optional app protection hooks
- optional licensing module
- optional Drizzle + SQLite database module
- structured logging
- starter init/scaffold script

## Prerequisites

- Node.js 20+
- npm 10+
- Git

For native dependencies such as `better-sqlite3`, use a normal local Node toolchain that can install native modules on your OS.

## Install And Run

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm test
npm run test:unit:watch
npm run build
```

## Start A New Project From This Starter

1. Clone this repository.
2. Install dependencies with `npm install`.
3. Run the starter init script with your project values.

Example:

```bash
npm run init:starter -- --app-name=acme-desktop --app-id=com.acme.desktop --package-name=@acme/desktop --display-name="Acme Desktop" --modules=logging,i18n,database
```

Init inputs:
- `app-name`: internal app/config name
- `app-id`: Electron Builder app identifier
- `package-name`: `package.json` package name
- `display-name`: product name shown to users
- `modules`: comma-separated starter modules to enable initially

The init script updates starter-owned values in:
- `package.json`
- `electron-builder.json`
- `config/base.ts`

## Template Rules

This repository is a reusable Electron application template.

What should normally change per project:
- package name
- product display name
- app id
- update repository owner/repo
- enabled starter modules
- default language
- production licensing endpoints

What should normally remain stable:
- main / preload / renderer separation
- typed IPC contracts
- config-driven module enablement
- TDD-first logic workflow
- production-only activation for protection and update flows
- licensing checks handled in Electron main
- renderer access only through safe preload APIs

## Project Structure

```text
config/                  Typed app configuration
electron/main/           Main-process bootstrap, modules, IPC, security
electron/preload/        Safe preload APIs exposed through contextBridge
src/app/                 Renderer app bootstrap/providers
src/features/            Renderer feature modules
src/i18n/                Translation setup and locale resources
src/shared/              Shared contracts, types, and pure logic
tests/unit/              Logic-first unit tests
docs/                    Contributor and backend contract docs
scripts/init/            Starter initialization logic
```

## Config System Overview

The app config is resolved from:
- `config/base.ts`
- `config/development.ts`
- `config/production.ts`
- build-time environment overrides through `config/loadConfig.ts`

Main config areas:
- `features`
- `update`
- `i18n`
- `appProtection`
- `licensing`
- `database`
- `logging`

The config model is typed in `config/types.ts`. Keep feature decisions in config instead of scattering conditionals through the app.

Build-time overrides are applied from environment variables when the config is loaded. Use them to switch production options without permanently editing the base defaults before every build.

## Module Enable Or Disable Overview

Feature flags are kept in `config/base.ts` and environment overrides:

```ts
features: {
  i18n: false,
  autoUpdate: false,
  appProtection: false,
  licensing: false,
  database: false,
  logging: true,
}
```

General rule:
- renderer modules only use safe preload APIs
- preload only exposes narrow typed contracts
- Electron main owns privileged capabilities
- modules should be registered only when enabled by config

## Development Mode Vs Production

Development defaults are intentionally relaxed for iteration:
- `licensing` is off
- `appProtection` is off
- auto-update runtime behavior is production-gated

Development config lives in `config/development.ts`.

Production is explicit and config-driven:
- `licensing` can be enabled before build
- `appProtection` can be enabled before build
- `autoUpdate` can be enabled before build

Production config lives in `config/production.ts`.

Do not treat dev behavior as proof that a production-only module is fully configured. Production features must be prepared in config before packaging.

## TDD And Tests

This starter uses TDD for application logic.

Expectations:
- add or update unit tests for logic changes
- keep tests under `tests/unit/`
- avoid UI-heavy tests unless they are strictly necessary
- avoid E2E unless there is no practical lower-cost alternative

Commands:

```bash
npm test
npm run test:unit:watch
```

Contributor workflow rules are also documented in [DEVELOPMENT_WORKFLOW.md](./docs/DEVELOPMENT_WORKFLOW.md).

## Build

Create a production package with:

```bash
npm run build
```

This runs TypeScript compilation, Vite builds, and Electron Builder packaging.

## Prepare Production Features Before Build

Before packaging a real product, review and update:

### Development Defaults
- `features.licensing=false`
- `features.appProtection=false`
- `features.autoUpdate=false`
- auto-update runtime checks stay inactive in normal dev runs

### Production Activation Path
1. Enable the feature in `config/production.ts` or through build-time environment overrides.
2. Set the corresponding module config block to `enabled: true` where applicable.
3. Fill the provider-specific values needed by that module.
4. Run `npm run build`.

### Build-Time Override Pattern

The loader in `config/loadConfig.ts` supports environment overrides for feature flags and nested module config. In practice, you can either edit `config/production.ts` directly or set environment variables before `npm run build`.

Example PowerShell session:

```powershell
$env:APP_ENV = "production"
$env:APP_FEATURE_AUTO_UPDATE = "true"
$env:APP_FEATURE_APP_PROTECTION = "true"
$env:APP_FEATURE_LICENSING = "true"
npm run build
```

Use the same pattern for nested production values such as update provider details or licensing endpoints when you do not want to hardcode product-specific values in the starter defaults.

### Auto Update
- development: inactive unless you deliberately wire internal logic around it
- production: enable `features.autoUpdate` and `update.enabled`
- enable `features.autoUpdate`
- set `update.enabled`
- set the GitHub Releases provider values in `update.provider`
- confirm `owner`, `repo`, and repository visibility
- optionally set build-time overrides for provider values before `npm run build`

### App Protection
- development: off by default and not enforced
- production: enable `features.appProtection` and `appProtection.enabled`
- enable `features.appProtection`
- set `appProtection.enabled`
- choose `appProtection.profile`
- optionally use build-time env overrides to switch the profile before packaging

### Licensing
- development: off by default and resolved to no-op behavior
- production: enable `features.licensing` and `licensing.enabled`
- enable `features.licensing`
- set provider and endpoint values in `licensing`
- configure public key and runtime intervals as needed
- optionally provide endpoint and key values through build-time env overrides

### Database
- enable `features.database`
- confirm SQLite file name and runtime expectations

## i18n Usage

i18n is optional and config-driven.

Current language support:
- `en`
- `ro`
- `ru`

Translation resources use JSON namespaces under `src/i18n/locales/<lang>/`:
- `common.json`
- `settings.json`
- `updater.json`
- `errors.json`

To enable i18n:
- set `features.i18n` to `true`
- set `i18n.enabled` to `true`

Language selection is exposed through the typed preload boundary and persisted through the settings store.

## Auto-Update Overview

The update flow is designed for:
- detect update
- notify user
- manual download

High-level behavior:
- production-only runtime activation
- GitHub Releases provider support
- renderer reads typed update state from preload
- renderer can trigger `checkForUpdates`, `downloadUpdate`, and `quitAndInstall`
- auto-download is off by default

### GitHub Releases Usage

This starter expects GitHub Releases as the production update source.

Practical setup:
- enable `features.autoUpdate` and `update.enabled`
- set `update.provider.provider` to GitHub configuration values
- set `update.provider.owner`
- set `update.provider.repo`
- set `update.provider.visibility`

Practical runtime flow:
- packaged production app checks for updates when enabled
- if an update is available, the renderer can notify the user
- the user manually starts the download
- after download completes, the app can call `quitAndInstall`

Release publishing expectations:
- publish packaged application artifacts to a GitHub Release
- keep release metadata and files compatible with `electron-updater`
- point the production config at the repository that owns those releases

## Database Integration Overview

Database support is optional and stays in Electron main only.

Intended usage:
- enable the database module in config
- keep SQLite and Drizzle setup inside `electron/main/modules/database`
- expose only typed IPC operations to the renderer
- organize real app access through repositories and services

The starter includes:
- SQLite connection planning
- Drizzle integration
- starter schema
- repository example
- service example
- in-memory helpers for unit tests

Do not import database internals directly into the renderer.

## Related Docs

- [DEVELOPMENT_WORKFLOW.md](./docs/DEVELOPMENT_WORKFLOW.md)
- [LICENSING_BACKEND_API_CONTRACT.md](./docs/LICENSING_BACKEND_API_CONTRACT.md)
- [TEMPLATE_RULES.md](./docs/TEMPLATE_RULES.md)