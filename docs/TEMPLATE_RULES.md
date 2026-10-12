# Template Rules

This repository is the default template for building new Electron desktop applications.

## Architecture Invariants

These rules should normally remain unchanged across products:

- Electron main owns privileged logic.
- Preload exposes only narrow typed APIs.
- Renderer never accesses privileged Node/Electron capabilities directly.
- Feature activation is config-driven.
- Production-only modules must not be treated as complete just because development works.
- Shared contracts and pure logic belong in `src/shared/`.
- Business logic should be tested with unit tests first.

## What Changes Per Product

The following values are expected to change when initializing a new app:

- package name
- display name
- internal app name
- Electron Builder app id
- update repository owner/repo
- enabled starter modules
- default language
- production licensing provider values
- production API endpoints
- branding assets and UI theme

## What Should Stay Stable

These parts should stay stable unless the template itself is being improved:

- folder structure
- config model
- typed IPC pattern
- preload boundary rules
- module registration pattern
- licensing handled in main
- update flow handled in main
- renderer access only through preload
- TDD-first workflow for logic
- minimal UI-heavy testing strategy

## Default Production Rules

- `appProtection` should remain disabled in development.
- `licensing` should remain disabled in development.
- `autoUpdate` should only run in packaged production mode.
- DevTools should be blocked in protected production builds.
- Sensitive feature access should depend on runtime license state, not only UI visibility.

## Update Rules

- Standard update source is GitHub Releases.
- Default user flow is detect -> notify -> manual download -> install.
- Release metadata must match `electron-updater` expectations.
- Real release repository values must be configured per product.

## Licensing Rules

- Licensing state is resolved in Electron main.
- Renderer consumes only derived license state.
- Grace-period behavior is preferred over hard failure on temporary backend outages.
- Entitlements are the standard mechanism for feature gating.

## i18n Rules

- New user-facing text should not be hardcoded in components.
- New modules should add their own namespace when needed.
- Errors shown to users should be localizable.

## Anti-Copy / App Protection Rules

- No secrets in renderer.
- Protection is layered, not absolute.
- Use hardened runtime behavior plus licensing checks.
- Treat obfuscation as a secondary barrier, not the main protection strategy.