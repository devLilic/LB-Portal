# Codex instructions for LB-Portal

## Plasma HTTP ingress and future LiveBoard control

Before changing the Plasma receiver, its authentication/security rules, IPC wiring, console, or request schema, read [the ingress contract](docs/CODEX_PLASMA_INGRESS_CONTRACT.md) and the paired Plasma document at `C:\laragon\www\plasma\docs\codex\lb-portal-mos-play.md`.

After each functional change to this shared integration, record the important decisions, current scope, payload fields, security constraints, and verification steps in both projects' Codex documents in the same change. Keep the documentation index current. Do not conflate accepting a Plasma HTTP request with sending a LiveBoard TCP command; when that later stage is implemented, update both contracts and the affected tests together.

Preserve Electron's main/preload/renderer security boundary. The HTTP server, access key file, and request validation remain in Electron main; expose only narrow typed IPC operations to the renderer.