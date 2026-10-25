# Plasma Ingress Contract for Codex

This document defines the HTTP ingress contract shared by Plasma and LB-Portal. Read it together with Plasma's `docs/codex/lb-portal-mos-play.md` before changing either side of the integration.

## Current scope

Project model update (24 October 2026): fresh installations contain no built-in MOS projects. Operators create, edit, export, import, activate and remove every project, including any former Telejurnal or weekly retrospective configuration. An empty project list has no active project; HTTP requests are still received, but no mapping or LiveBoard command is produced. `.lbproject.json` transfer files are validated and imported with fresh IDs. This changes local project management only; the Plasma envelope, HTTP acknowledgement/authentication/CORS and TCP LBControl route remain unchanged. The paired Plasma documentation records the same decision.

The [OnAir CSV workspace](CODEX_ONAIR_CSV.md) reads PA exports manually from a folder saved per project. Its single project selector chooses the CSV source and the project that may be activated; a separate explicit activation button is required, and changing selection alone does not change runtime state. CSV source templates are retained as keys for explicit per-project mappings. This workspace adds typed local IPC, without changing the Plasma HTTP envelope, authentication, CORS, acknowledgements or TCP LBC protocol.

OnAir now configures explicit per-project CSV mappings by graphic type and source template. The mapping resolver prepares existing section/target templates and field values for preview; it does not submit a MOS request, activate a project or run the controller. These data mappings remain separate from MOS source mappings. Custom projects can independently choose CSV or Plasma ingress mode in Settings.

Locations and phone interventions may use a per-project default template when their CSV row has no nonblank `Template`. A nonblank CSV value takes precedence and is preserved exactly. This local default is applied consistently in the mapping catalog and value preview; it does not change the Plasma request schema.

OnAir also has a separate explicit local PLAY/Resume operation per CSV item through the typed `onAirApi.playItem` IPC. Main re-resolves the saved project mapping and calls the existing LiveBoard controller; it does not create a MOS request or change the Plasma HTTP envelope. Any configured project may use these manual OnAir actions when selected as the active execution project. A project configured for CSV blocks Plasma execution; any project configured for Plasma uses the same active-project ingress. See [the OnAir CSV contract](CODEX_ONAIR_CSV.md) for request fields, active-item Resume checks, and template-duration behavior.

Projects may also contain optional fixed graphics such as logos or presenter lower-thirds. OnAir renders these independently of CSV snapshots and sends only a project/graphic ID over typed local IPC; Electron main resolves the saved values and destinations and runs the existing controller. This local feature does not alter Plasma's HTTP envelope or the receiver contract.

Projects may also contain optional fixed graphics such as logos or presenter lower-thirds. OnAir renders these independently of CSV snapshots and sends only a project/graphic ID over typed local IPC; Electron main resolves the saved values and destinations and runs the existing controller. This local feature does not alter Plasma's HTTP envelope or the receiver contract.

LB-Portal is the bridge between Plasma and LiveBoard: Plasma sends authenticated HTTP requests to LB-Portal, and real LiveBoard commands use only TCP with the four LBControl `LBC_` commands documented in [the protocol contract](CODEX_LIVEBOARD_PROTOCOL.md), after manual connection. The default no-socket simulation is for offline verification only. Plasma must not connect directly to LiveBoard; OSCon/OSC is retired and must not be used for this integration. HTTP receipt remains distinct from execution and on-air output.

## Process and listener

OnAir composition fix (22 October 2026): local PLAY/RESUME use the destination values already composed by the shared CSV resolver, including the configured second field and separator. Mapping `Nume` + `Functie` to both `Nume` and `Nume_M` writes the same complete string to both fields. Separate rules sharing a primary CSV column retain independent controller parameters. This fixes the local OnAir adapter; the Plasma HTTP envelope, authentication, acknowledgement and TCP protocol remain unchanged. See [the OnAir correction](CODEX_ONAIR_CSV.md#corecție-play-pentru-nume-și-funcție--22-octombrie-2026).

Verification: 92 focused tests across 15 files passed, including the registered OnAir IPC handler with the real controller in simulation and localhost TCP regressions. TypeScript/Vite compilation and the updated NSIS installer passed; packaging required a permitted retry after sandbox DNS failure. Physical LiveBoard output was not tested.

Mappings belong to operator-created [projects](CODEX_MOS_PROJECTS.md). A fresh installation has no projects or active project; the operator creates and configures projects in Settings, then manually activates one from the OnAir tab. Every project can be removed. With no active project, authenticated HTTP receipt remains successful but mapping/execution is unavailable and no LiveBoard commands are sent. CSV-mode projects block Plasma execution with `project-disabled`. The envelope has no project selector and does not trigger automatic project switching. Receipt snapshots and execution reports retain their project context; deduplication is scoped to that project. Activation requires no running/queued operations and all sections OFF, and sends no commands. Console shows runtime status and diagnostics. Projects can be exported/imported as validated `.lbproject.json` files; imports receive fresh internal IDs. The HTTP payload, authentication, CORS, receipt acknowledgement and TCP protocol are unchanged.

The settings editor can reorder sections and duplicate an existing project's full configuration into a named custom draft. Duplicated section/target/field/rule IDs and references are independent; copies start in CSV mode, and the active project is unchanged. Saving only a section-order change preserves active playback and timers and sends no commands. These editor operations retain the project ingress roles above and the existing HTTP envelope.

- The receiver belongs to Electron main: `electron/main/ingress/LBPortalReceiver.ts`, registered through `registerLBPortalIngress.ts`.
- It listens on `0.0.0.0:47835`; the UI presents loopback and local IPv4 URLs so the operator can configure the Plasma machine.
- The renderer communicates with main through the narrow typed preload API and IPC contracts. Do not expose the raw HTTP server, filesystem access, or Node APIs to the renderer.
- Receiver state is in memory and retains up to the newest 100 requests; the Console displays the newest 50. Clearing/restarting the app removes receiver history. Raw request JSON is formatted only when its details are opened.

## Authentication and browser policy

- A random 32-byte hex bearer key is created once and stored in `app.getPath('userData')/lb-portal-receiver.json`; it is not project configuration and must not be committed or printed to logs.
- Requests must use `Authorization: Bearer <key>`. The receiver compares key digests with `timingSafeEqual`.
- Only `http://plasma.test` and `https://plasma.test` are accepted browser origins. OPTIONS preflight allows GET/POST and only Authorization/Content-Type headers, including Private Network Access.
- The HTTP Host must be a supported local/IPv4 host on port 47835. Do not broaden the origin or host policy casually; update the paired Plasma docs and tests if the deployment origin changes.

## HTTP contract

Authenticated health check:

- `GET /v1/health`
- JSON response includes `ok`, `service: "lb-portal"`, and `protocolVersion: 1`.

Request ingress:

- `POST /v1/requests`, with no query string and `Content-Type: application/json`.
- Body limit: 65,536 bytes. Body must be a JSON object containing string properties `requestId`, `source`, and `type`. The receiver records the complete object. Accepted `mos-play` and `mos-resume` requests receive a mapping snapshot and the final execution result in the same response. Missing mappings block either command; PLAY requires values only for parameters mapped to fields in the selected destination. Parameters without destination fields are ignored. RESUME requires a matched source template, and its execution uses only the resolved LiveBoard template name.
- Success response includes `{ok: true, requestId, receivedAt}`. MOS commands also include `execution: {status, sectionId, playbackState, onAir, confirmation, error}`. Plasma treats receipt as confirmed only if HTTP succeeds and the returned request ID matches; it updates a graphic's local on-air state only after the execution result confirms the transition.
- Rejections for invalid Host/origin, bearer key, route, content type, malformed/oversized JSON, or missing envelope fields are recorded with status and acceptance state where possible.

### Automatic graphic duration in the acknowledgement

For a confirmed automatic `mos-play` (`completed` or `noop`), `execution` also includes two optional numeric members: `automaticDurationSeconds` is the configured duration of the executed MOS source, and `remainingDurationMs` is the nonnegative time remaining on that playback instance's active controller timer. Seconds retain the source configuration, including fractional values; the remaining time is expressed in milliseconds. The source duration comes from the receipt/execution snapshot, not from a template-name convention or a later settings edit.

Identical active PLAYs and same-request-ID replays within the existing request cache do not restart the graphic or its timer. Their remaining time is recalculated for each acknowledgement. An expired or replaced playback instance returns zero, even when a later graphic reuses its section, source template or A/B target. Manual sources, `mos-resume`, blocked and failed execution results omit both members. Simulated execution follows the same duration contract while retaining `confirmation: "simulated"`.

Plasma starts its local countdown after validating the HTTP response, matching request ID and successful execution. At expiry it returns the corresponding MOS item from green/RESUME to its default appearance/PLAY and clears its last-played highlight. Expiry updates local UI only. A fresh confirmed PLAY replaces the section's local timer; `noop` preserves or shortens an existing deadline, confirmed RESUME cancels it, and failed requests preserve it. A zero remaining duration clears the local active state immediately. Other sections have independent timers. These values are a local timing estimate and do not confirm observed video output.

The response extension is additive: older Plasma clients ignore the extra members, and newer Plasma clients keep the existing behavior when an older LB-Portal response has no valid timing metadata. The PLAY/RESUME request envelope, authentication, CORS and LBC transport do not change. Deploy LB-Portal before the updated Plasma frontend.

For cached responses, the execution report still describes the original command; timing metadata is recalculated separately. A zero `remainingDurationMs` prevents Plasma from reactivating an expired or replaced graphic even when that historical report originally recorded an ON state.

### Automatic-duration verification — 19 October 2026

- **75 relevant LB-Portal tests passed** across 11 files: ingress, controller, interactions, transport, projects and interaction validation. The new contract spec runs the real receiver handler and controller against a local ephemeral TCP mock; it verifies confirmed six-second metadata, shorter no-op/replay values, original source settings after resolver changes, replacement/expiry zero, omission for manual/RESUME/blocked/failed requests and the absence of commands at expiry. A fake-clock controller test covers simulation.
- **25 Plasma frontend tests passed**: six-second local expiry without another HTTP request, valid no-op deadlines that never extend, shortening/ownership transfer, replacement, independent sections, manual/legacy/invalid metadata, immediate zero, confirmed RESUME, rejected/mismatched responses and unmount/late-response cleanup.
- **Both production builds passed**: Plasma `npm run build`; LB-Portal `npm run build -- --publish never`, including the NSIS x64 installer at `release/0.1.0/Default Electron App-0.1.0-x64.exe`. Generated-output/cache permission restrictions required running the builds with the necessary permissions.
- Verification used fictional request data and local mocks. It did not access the operator's settings or verify physical LiveBoard video output. The previously documented general Electron report-visibility limitation is separate from these passing focused checks.

For cached responses, the execution report still describes the original command; timing metadata is recalculated separately. A zero `remainingDurationMs` prevents Plasma from reactivating an expired or replaced graphic even when that historical report originally recorded an ON state.

### Automatic-duration verification — 19 October 2026

- **75 relevant LB-Portal tests passed** across 11 files: ingress, controller, interactions, transport, projects and interaction validation. The new contract spec runs the real receiver handler and controller against a local ephemeral TCP mock; it verifies confirmed six-second metadata, shorter no-op/replay values, original source settings after resolver changes, replacement/expiry zero, omission for manual/RESUME/blocked/failed requests and the absence of commands at expiry. A fake-clock controller test covers simulation.
- **25 Plasma frontend tests passed**: six-second local expiry without another HTTP request, valid no-op deadlines that never extend, shortening/ownership transfer, replacement, independent sections, manual/legacy/invalid metadata, immediate zero, confirmed RESUME, rejected/mismatched responses and unmount/late-response cleanup.
- **Both production builds passed**: Plasma `npm run build`; LB-Portal `npm run build -- --publish never`, including the NSIS x64 installer at `release/0.1.0/Default Electron App-0.1.0-x64.exe`. Generated-output/cache permission restrictions required running the builds with the necessary permissions.
- Verification used fictional request data and local mocks. It did not access the operator's settings or verify physical LiveBoard video output. The previously documented general Electron report-visibility limitation is separate from these passing focused checks.

### Automatic graphic duration in the acknowledgement

For a confirmed automatic `mos-play` (`completed` or `noop`), `execution` also includes two optional numeric members: `automaticDurationSeconds` is the configured duration of the executed MOS source, and `remainingDurationMs` is the nonnegative time remaining on that playback instance's active controller timer. Seconds retain the source configuration, including fractional values; the remaining time is expressed in milliseconds. The source duration comes from the receipt/execution snapshot, not from a template-name convention or a later settings edit.

Identical active PLAYs and same-request-ID replays within the existing request cache do not restart the graphic or its timer. Their remaining time is recalculated for each acknowledgement. An expired or replaced playback instance returns zero, even when a later graphic reuses its section, source template or A/B target. Manual sources, `mos-resume`, blocked and failed execution results omit both members. Simulated execution follows the same duration contract while retaining `confirmation: "simulated"`.

Plasma starts its local countdown after validating the HTTP response, matching request ID and successful execution. At expiry it returns the corresponding MOS item from green/RESUME to its default appearance/PLAY and clears its last-played highlight. Expiry updates local UI only. A fresh confirmed PLAY replaces the section's local timer; `noop` preserves or shortens an existing deadline, confirmed RESUME cancels it, and failed requests preserve it. A zero remaining duration clears the local active state immediately. Other sections have independent timers. These values are a local timing estimate and do not confirm observed video output.

The response extension is additive: older Plasma clients ignore the extra members, and newer Plasma clients keep the existing behavior when an older LB-Portal response has no valid timing metadata. The PLAY/RESUME request envelope, authentication, CORS and LBC transport do not change. Deploy LB-Portal before the updated Plasma frontend.

The current Plasma PLAY envelope has `requestId`, `source: "plasma.test"`, `type: "mos-play"`, and `template` from `MosObject.slug`. `params` is optional: Plasma includes a name/value map when the template has text values and omits it entirely for graphic-only templates (for example, `09_impact_emotional`). RESUME uses the same envelope metadata and template with `type: "mos-resume"`; it omits `params`. Its source template must resolve to a saved section, but field mappings and parameter validation apply only to PLAY. In LB-Portal each source parameter may map to multiple fields in each destination, and source parameters with no destination mapping are ignored and are not required. The controller resolves the active LiveBoard buffer and sends `LBC_RESUMECONTENT` with only that destination template name. Requests omit timestamps, article metadata, internal MOS identifiers, and a duplicate `fields` representation. The controller maps PLAY values into LBC object setters; it does not forward the JSON envelope as a TCP command. The full HTTP schema is defined in Plasma's paired contract.

## Maintenance instructions for Codex

Project-scoped [interaction rules](CODEX_SECTION_INTERACTIONS.md) may execute ordered actions on other sections around a primary PLAY/RESUME/STOP/automatic exit. Suspension retains the exact buffer and uses the executing source's existing duration for automatic return; there is no separate rule duration or name-specific extension policy. Rules do not alter the HTTP envelope, authentication or receipt acknowledgement. Their commands and automatic restoration are logged separately with rule/section context and retain the existing distinction between receipt, TCP acceptance and video output.

Mapping diagnostics are resolved in main from saved settings at receipt and remain immutable. A separate execution report updates through typed preload events: queued/running/completed/noop/blocked/failed, selected buffer, previous and next buffer, commands, replies and errors. Two destinations alternate as complete groups: prepare hidden fields, wait for propagation, RESUME the previous destination, wait the transition delay, then PLAY the prepared destination. Missing parameters block before writes only when they map to fields in the selected destination; repeated rows for a source parameter combine during execution. RESUME does not consume mapped field values, and empty PLAY values remain valid. Rejected requests and non-MOS traffic do not execute. Clearing history does not stop graphics or reset the controller. See the execution contract for failure recovery and duplicate handling.

The console also shows a blocked execution report when the mapping is unknown, malformed or unavailable; no destination or field mapping is invented. The HTTP response carries the final status and post-command section state for a Plasma PLAY/RESUME, while the console retains step replies and diagnostics. Local resync remains available while TCP is disconnected and sends no command. A section in NEEDS_RESYNC displays its last known buffer rather than claiming it is currently active.

Expected settings restrictions (active sections or ongoing operations) resolve as typed save-denial data across main/preload. The settings editor displays localized instructions while retaining the draft; a denied setting is not persisted or applied, and it does not produce an Electron `settings:set` handler stack trace. Unexpected failures are still propagated. This changes settings error handling only; the Plasma HTTP acknowledgement and LiveBoard command sequence are unchanged.

When saving is blocked by active sections, the editor stops each affected section through the normal controller path and retries once. Failed STOP commands or a remaining busy operation preserve the draft and show the reason. The Plasma HTTP acknowledgement and LiveBoard command sequence are unchanged.

In Plasma LIVE, RESUME is tied to a graphic this session confirmed active from an LB-Portal response. Other graphics mapped to the same section remain available for PLAY, so a new timed graphic can replace the current one before its duration expires. Initial MOS playback flags do not disable these PLAY actions because they are not LB-Portal runtime state. The console folds configured sections and buffer detail; request cards show a compact status/time/context line and expand to full mapping and execution details.

Whenever a change affects listener address/port, route, health response, body validation/limit, auth, origins/CORS/PNA, request acknowledgement, in-memory history, or interpretation of the Plasma payload:

1. Update this document and Plasma's paired `docs/codex/lb-portal-mos-play.md` in the same change.
2. Update the documentation entry in `docs/DEVELOPMENT_WORKFLOW.md` and any user-facing setup instructions affected by the change.
3. Add or update focused unit tests for the receiver and run them with the project build. Keep renderer/main/preload boundaries intact.
4. Keep HTTP acknowledgement, simulated execution, TCP protocol acceptance and physically observed output distinct. Update both contracts when execution semantics change.

Do not change the receiver or payload contract as an incidental part of another task. Preserve the paired-document rule even after the project advances to LiveBoard mapping and TCP execution.
