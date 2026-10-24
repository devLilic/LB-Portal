# Development Workflow

Versiunile și publicarea installerului Windows prin taguri Git sunt descrise în [ghidul de release](RELEASING.md).

## OnAir / CSV per proiect

Selectorul proiectului OnAir este și selectorul proiectului de execuție LiveBoard. Operatorul activează alegerea explicit din OnAir; Consola rămâne pentru stare runtime și diagnosticare. Activarea este blocată de aceleași condiții runtime și nu trimite comenzi. Contractul și scenariul QA sunt descrise în [proiecte MOS](CODEX_MOS_PROJECTS.md) și [OnAir CSV](CODEX_ONAIR_CSV.md).

Corecția PLAY pentru câmpuri compuse din 22 octombrie 2026 este descrisă în [contractul OnAir](CODEX_ONAIR_CSV.md#corecție-play-pentru-nume-și-funcție--22-octombrie-2026): PLAY și Resume folosesc valorile compuse de resolver, astfel încât `Nume` și `Nume_M` primesc același nume cu funcție. Cheia sursă CSV și numele contentului destinație LiveBoard se configurează separat.

Verificarea corecției: 92 teste în 15 fișiere trecute, inclusiv handlerul IPC PLAY/Resume cu controller real în simulare și testele TCP localhost cu permisiunile necesare. Detaliile și limitarea verificării video sunt în contractul OnAir.

TypeScript/Vite și installerul NSIS actualizat au trecut; împachetarea a necesitat reluare cu acces în afara sandboxului după eroarea DNS `github.com`. Artefact: `release/0.1.0/LB-Portal-0.1.0-x64.exe`, fără publicare de release.

[OnAir CSV](CODEX_ONAIR_CSV.md) descrie importul manual al celor patru exporturi per proiect, cu folder și prefix configurate per proiect (implicit `PA_`, de exemplu `ES_`); schimbarea prefixului rebazează cheile sursă OnAir care folosesc prefixul anterior. Selectorul unic alege sursa CSV și proiectul de execuție, iar snapshoturile se păstrează numai în sesiune. Activarea se face separat și explicit în OnAir; selecția singură nu schimbă proiectul activ și activarea nu trimite comenzi. Refresh citește și validează în main, apoi afișează grupurile în renderer prin IPC tipizat. Butoanele explicite per element folosesc mapările validate în main și controllerul LiveBoard, cu proiectul afișat deja activ. Citiți documentul înainte de modificarea parserului, memoriei, configurării sursei sau acțiunilor locale.

OnAir afișează grupurile în taburi cu Invitați (Platou) primul și supratitlul deasupra titlului. Setările per proiect includ mapări CSV → secțiuni/targeturi/câmpuri LiveBoard, cu chei tip + template sursă și previzualizarea valorilor pregătite. O mapare poate uni două câmpuri CSV într-un câmp destinație, cu separator configurabil și implicit `, `; textele păstrează casing-ul din CSV, iar valorile goale nu produc separatori rămași. Fiecare mapare OnAir configurează separat ieșirea manuală sau după durată; setările și schema MOS Telejurnal rămân nemodificate. Aceste mapări sunt separate de sursele MOS; resolverul și regulile de validare/duplicare sunt descrise în contractul OnAir și în [editor](CODEX_MOS_MAPPING_EDITOR.md).

Pentru locații și intervenții telefonice, setările includ template-uri implicite per proiect, folosite numai când CSV-ul nu furnizează un `Template` nevid. Catalogul și previzualizarea folosesc aceeași regulă; fișierele originale nu sunt modificate.

Titlurile folosesc o coloană comună pentru numărul original CSV, într-un chenar rotunjit cât înălțimea blocului, și aliniază supratitlul/titlul la aceeași margine. Bara fixă vizibilă din stânga ocupă viewportul și oferă Refresh 48 × 48 px. Butoanele PLAY/Resume sunt per element mapat; altă grafică activă permite trecerea A/B, iar Resume cere ca template-ul și valorile să corespundă elementului activ. Detaliile sunt în contractul OnAir.

Verificarea extinderii OnAir din 21 octombrie 2026: 141 teste relevante, 45 verificări Electron izolate, QA renderer la 640/1280/1920 px și build NSIS trecute. Documentul OnAir consemnează separat rezultatele etapei inițiale, limitările suitei generale, expirarea capturilor native Electron și comanda de împachetare cu distribuția Electron instalată pentru eroarea locală de redenumire `EPERM`.

Verificarea PLAY/Resume OnAir din 22 octombrie 2026: 33 teste relevante în 4 fișiere și `npx tsc --noEmit` au trecut. Compilarea TypeScript/Vite main/preload/renderer a trecut. NSIS nu s-a împachetat deoarece electron-builder a eșuat la rezolvarea DNS `github.com` (`ENOTFOUND`); nicio schemă sau setare Telejurnal nu a fost modificată.

Verificarea compunerii câmpurilor CSV în OnAir din 22 octombrie 2026: 12 teste unitare OnAir și `npx tsc --noEmit` au trecut; `git diff --check` a trecut. Schimbarea păstrează mapările existente cu o singură sursă și nu modifică schema setărilor Telejurnal/MOS.

## Plasma / LB-Portal ingress contract

The receiver keeps up to 100 recent requests in memory; the Console renders the newest 50 and formats a raw request body only when its details are opened. This is a renderer performance/display limit and does not change HTTP receipt or execution behavior.

The [automatic-duration acknowledgement](CODEX_PLASMA_INGRESS_CONTRACT.md#automatic-graphic-duration-in-the-acknowledgement) extends confirmed automatic PLAY responses with `automaticDurationSeconds` and `remainingDurationMs`. Plasma uses the remaining time for a per-section UI countdown back to default/PLAY; identical requests preserve the active deadline and expired/replaced instances report zero. Update LB-Portal first, then Plasma. Focused receiver/controller/TCP-mock and frontend timer regressions cover the shared contract.

Automatic-duration verification (19 October 2026): **75 relevant LB-Portal tests, 25 Plasma frontend tests and both production builds passed**, including the updated NSIS installer. The [ingress verification record](CODEX_PLASMA_INGRESS_CONTRACT.md#automatic-duration-verification--19-october-2026) details receiver-handler/TCP-mock coverage, duplicate timing, source snapshots and UI timer cleanup. Physical video output was not part of these checks.

Automatic-duration verification (19 October 2026): **75 relevant LB-Portal tests, 25 Plasma frontend tests and both production builds passed**, including the updated NSIS installer. The [ingress verification record](CODEX_PLASMA_INGRESS_CONTRACT.md#automatic-duration-verification--19-october-2026) details receiver-handler/TCP-mock coverage, duplicate timing, source snapshots and UI timer cleanup. Physical video output was not part of these checks.

The [automatic-duration acknowledgement](CODEX_PLASMA_INGRESS_CONTRACT.md#automatic-graphic-duration-in-the-acknowledgement) extends confirmed automatic PLAY responses with `automaticDurationSeconds` and `remainingDurationMs`. Plasma uses the remaining time for a per-section UI countdown back to default/PLAY; identical requests preserve the active deadline and expired/replaced instances report zero. Update LB-Portal first, then Plasma. Focused receiver/controller/TCP-mock and frontend timer regressions cover the shared contract.

The [section interactions contract](CODEX_SECTION_INTERACTIONS.md) describes project-scoped event/action rules, suspend/restore using the configured source duration, journal provenance, validation and the wider section/interaction editor. Rule actions do not recursively dispatch interactions, so reciprocal rules on separate PLAY triggers are independent; direct self-references remain invalid. Read it before changing cross-section execution or restoration timers.

Interaction-stage verification (15 October 2026): **90 focused LB-Portal tests, 12 Plasma contract tests, 159 isolated Electron checks and the TypeScript/Vite/NSIS build passed**. Separate compiled-renderer layout checks passed at 640/1280/1920 px, with seven screenshots and visual review. Electron used `npm run qa:liveboard -- --skip-captures`; `node scripts/qa-renderer-layout.cjs` supplied the screenshots independently. Tests used disposable settings and a TCP mock, without physical LiveBoard output verification. Detailed behavior, operator setup steps, tools and results are in the interactions contract.

LB-Portal starts maximized with standard window controls and DevTools disabled. Preserve the unsaved-settings close warning when changing window initialization.

The [projects contract](CODEX_MOS_PROJECTS.md) defines independent section sets, legacy migration into Telejurnal, and manual active-project selection. Only Telejurnal and Retrospectiva săptămânii accept Plasma execution; standalone projects block it. Editing a project does not activate it. Activation requires an idle controller with all sections OFF and sends no LiveBoard commands.

The editor supports section reordering with saved display order and project duplication into an independently named standalone copy. Duplication remaps all internal field/interaction references; order-only saves preserve active buffers and timers. See the projects and [editor contract](CODEX_MOS_MAPPING_EDITOR.md) for the operator flow and verification.

Editor extension verification (19 October 2026): 44 focused unit tests, compiled-renderer workflow/layout checks and the TypeScript/Vite/NSIS build passed. The general Electron probe stops at the existing hidden suspend-step list in expanded request details; the [projects verification record](CODEX_MOS_PROJECTS.md#extensia-editorului--19-octombrie-2026) records this limitation separately from the passing new-feature checks.

Editor extension verification (19 October 2026): 44 focused unit tests, compiled-renderer workflow/layout checks and the TypeScript/Vite/NSIS build passed. The general Electron probe stops at the existing hidden suspend-step list in expanded request details; the [projects verification record](CODEX_MOS_PROJECTS.md#extensia-editorului--19-octombrie-2026) records this limitation separately from the passing new-feature checks.

The editor supports section reordering with saved display order and project duplication into an independently named standalone copy. Duplication remaps all internal field/interaction references; order-only saves preserve active buffers and timers. See the projects and [editor contract](CODEX_MOS_MAPPING_EDITOR.md) for the operator flow and verification.

Project-stage verification: 68 focused LB-Portal tests, 11 Plasma contract tests and 110 isolated Electron checks passed; TypeScript/Vite/NSIS build passed. The projects contract records the scope and screenshot review.

The [MOS mapping editor](CODEX_MOS_MAPPING_EDITOR.md) configures template/field mappings, paired title buffers, data/transition delays and exit behavior. A source parameter can map to multiple destination fields, while source parameters without destinations are optional and ignored during PLAY. [Execution and A/B control](CODEX_LIVEBOARD_EXECUTION.md) document the controller, state, journal, recovery and major implementation stages. [LBC TCP commands and sources](CODEX_LIVEBOARD_PROTOCOL.md) define the four supported commands, framing and remaining physical checks. The [TCP mock server](LIVEBOARD_MOCK_SERVER.md) is a separate Node receiver for offline probes. Plasma reaches LiveBoard only through LB-Portal: HTTP is the Plasma-to-bridge ingress, and TCP LBControl is the only real LiveBoard transport. Default execution is simulated for offline verification; TCP requires configuration and manual connection. Do not use OSCon/OSC for this integration.

The execution contract records final verification results; `npm run qa:liveboard` exercises the compiled Electron app against the mock with disposable settings, including offline local resync and error recovery. Unknown mappings retain an explicit blocked execution report in the console.

The mapping editor contract also documents expected settings save restrictions: typed denials with localized messages and preserved drafts, without treating an active-section restriction as an Electron handler exception. Saving now stops affected sections through the controller and retries once. The runtime console folds its section list and buffer details; request cards keep a compact status line and expand to full mapping/execution reports. Section identity/destinations and timing share a row on wide editor columns, with each destination and timing control on a separate row; source mappings keep the full width. Plasma keeps PLAY available for another graphic mapped to the same section while a timed graphic is active. These changes do not alter the HTTP or TCP protocol. QA verifies blocked saving, unchanged persisted values, successful retry after STOP and absence of the corresponding main-process stack trace.

For the HTTP receiver shared with Plasma, follow [the ingress contract](CODEX_PLASMA_INGRESS_CONTRACT.md) and `C:\laragon\www\plasma\docs\codex\lb-portal-mos-play.md`. PLAY may omit `params` for graphic-only templates; RESUME uses `type: "mos-resume"`, requires no field mappings, and sends only the destination template name to LBControl. The receiver returns final execution status and post-command on-air state in the same HTTP response. LB-Portal is the only bridge to LiveBoard and uses TCP LBControl for real commands. Update both contracts and indexes after functional changes. TCP acknowledgement confirms protocol acceptance, not video output.

## Core Rules

The current stylesheet directives and PostCSS plugins use Tailwind CSS 3 (`@tailwind`, `tailwindcss/nesting`, `tailwindcss`, and `preflight: false`). Keep the manifest on the compatible 3.4 line until an explicit CSS migration is requested. Declaring Tailwind 4 with this configuration causes `npm run dev` and builds to fail with the missing `tailwindcss/nesting` export after a dependency installation. i18next uses the current `initAsync: false` option for synchronous initialization.

- Build the starter module by module.
- Within each module, work in small sequential tasks.
- Do not move to the next task until the current task meets its Definition of Done.
- Avoid unrelated refactors while implementing a task.
- Prefer explicit file boundaries and typed contracts over ad-hoc wiring.
- Prefer config-driven behavior when introducing optional functionality.

## TDD Expectations

- Use TDD for application logic.
- Start logic work by adding or updating a focused unit test when practical.
- Keep tests small, deterministic, and close to the logic they verify.
- Place unit tests under `tests/unit/`.
- Use `npm test` or `npm run test:unit` as the default validation path for logic.

## Testing Scope

- Prioritize unit tests for logic modules.
- Keep UI tests minimal and add them only when they are strictly necessary.
- Avoid E2E coverage unless there is no lower-cost way to protect the behavior.
- Do not introduce UI-heavy test infrastructure for simple logic changes.

## Task Execution

- Keep each task narrow and implementation-focused.
- Define the expected outcome before changing code.
- Verify the task with the minimum useful test coverage.
- Preserve existing behavior unless the task explicitly changes it.

## Definition of Done

- The requested task behavior is implemented.
- Relevant unit tests pass, or existing tests are updated safely.
- The app still builds or runs when the task affects runtime wiring.
- No accidental functionality loss is introduced.
- No unnecessary refactor is bundled into the task.

## Module Completion

- Finish all planned tasks for the module before closing it.
- Create one clear commit at the end of the module.
- Push the completed module changes to GitHub.
- Keep commit messages specific to the module outcome.
