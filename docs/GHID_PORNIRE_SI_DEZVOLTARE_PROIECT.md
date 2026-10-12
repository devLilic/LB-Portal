# Ghid De Pornire Si Dezvoltare Proiect

## Scop

Acest document explică practic cum se folosește acest starter pentru:
- inițierea unei aplicații noi
- configurarea modulelor
- rularea în development
- rularea testelor
- build pentru producție
- activarea feature-urilor de producție înainte de build

Documentul este orientat pe lucru real în proiect, nu pe prezentare generală.

## Ce Este Acest Starter

Acest repository este un starter modular pentru aplicații desktop construite cu:
- Electron
- React
- TypeScript
- Tailwind CSS
- Vite

Arhitectura este:
- config-driven
- modulară
- cu boundary clar între `main`, `preload` și `renderer`
- bazată pe IPC tipizat

Paradigma de dezvoltare este:
- TDD pentru logica aplicației
- teste unitare pentru logică
- teste UI minime
- E2E doar dacă sunt strict necesare

## Structura Principală

```text
config/                  configurația aplicației
electron/main/           bootstrap, module, IPC, securitate
electron/preload/        API-uri sigure expuse către renderer
src/app/                 bootstrap și providers pentru renderer
src/features/            module UI și integrare renderer
src/i18n/                setup i18n și resurse traduceri
src/shared/              tipuri, contracte și logică pură
tests/unit/              teste unitare pentru logică
scripts/init/            inițializare proiect nou din starter
docs/                    documentație operațională
```

## Flux Recomandat Pentru Un Proiect Nou

Ordinea recomandată:

1. Clonezi starterul.
2. Rulezi `npm install`.
3. Inițializezi metadatele proiectului cu `npm run init:starter`.
4. Verifici `config/base.ts`, `config/development.ts`, `config/production.ts`.
5. Confirmi ce module sunt active și ce module rămân dezactivate.
6. Rulezi aplicația în dev.
7. Rulezi testele de bază.
8. Dezvolți aplicația modul cu modul.
9. Activezi feature-urile de producție doar înainte de build.

Nu începe prin a modifica aleator multe fișiere înainte să fixezi metadatele proiectului și modulul/config-ul țintă.

## Inițializarea Unei Aplicații Noi

Scriptul de inițializare disponibil este:

```bash
npm run init:starter -- 
  --app-name=my-desktop-app \
  --app-id=com.mycompany.desktop \
  --package-name=@mycompany/desktop \
  --display-name="My Desktop App" \
  --update-owner=mygithubuser \
  --update-repo=my-desktop-app-releases \
  --update-visibility=private \
  --default-language=ro \
  --modules=logging,i18n,licensing,appProtection
```
intr-o linie: 
```bash
npm run init:starter --  --app-name=my-desktop-app  --app-id=com.mycompany.desktop  --package-name=@mycompany/desktop  --display-name="My Desktop App"  --update-owner=mygithubuser  --update-repo=my-desktop-app-releases  --update-visibility=private  --default-language=ro  --modules=logging,i18n,licensing,appProtection
```

### Parametrii Pentru Inițiere

Script:
- `npm run init:starter -- ...`

Parametri:
- `--app-name`
  - numele intern al aplicației
  - este folosit în config
  - exemplu: `acme-desktop`
- `--app-id`
  - identificator Electron Builder
  - de regulă format reverse-domain
  - exemplu: `com.acme.desktop`
- `--package-name`
  - numele pachetului din `package.json`
  - exemplu: `@acme/desktop`
- `--display-name`
  - numele afișat utilizatorului
  - exemplu: `Acme Desktop`
- `--modules`
  - lista modulelor activate inițial
  - format: valori separate prin virgulă
  - exemplu: `logging,i18n,database`

### Module Acceptate La Inițiere

Valorile acceptate în `--modules` sunt:
- `i18n`
- `autoUpdate`
- `appProtection`
- `licensing`
- `database`
- `logging`

### Ce Modifică Scriptul De Inițiere

Scriptul actualizează valorile starter-ului în:
- `package.json`
- `electron-builder.json`
- `config/base.ts`

După inițiere, trebuie să verifici manual:
- descrierea proiectului
- autorul
- repository-ul
- icon-urile
- eventuale placeholder-e vizuale

## Configurația Aplicației

Config-ul se rezolvă din:
- `config/base.ts`
- `config/development.ts`
- `config/production.ts`
- variabile de mediu citite în `config/loadConfig.ts`

Zonele principale din config:
- `features`
- `update`
- `i18n`
- `appProtection`
- `licensing`
- `database`
- `logging`

### Feature Flags

Flags-urile principale sunt:

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

Regulă:
- dacă un modul este dezactivat, rămâne dezactivat curat din config
- nu se elimină haotic codul pentru el dacă nu este cerut explicit

## Modul De Lucru În Development

Pentru development:
- `licensing` trebuie să rămână OFF
- `appProtection` trebuie să rămână OFF
- `autoUpdate` nu trebuie să blocheze flow-ul local

Development trebuie să rămână:
- rapid
- predictibil
- fără blocaje de producție

Dar trebuie păstrate limitele arhitecturale:
- API tipizat în preload
- fără expunere brută a `ipcRenderer` către renderer
- fără încălcarea separării dintre `main` și `renderer`

## Modul De Lucru În Producție

În producție:
- `licensing` poate fi activat înainte de build
- `appProtection` poate fi activat înainte de build
- `autoUpdate` poate fi activat înainte de build

Aceste feature-uri nu trebuie forțate în development.

Activarea trebuie făcută:
- din `config/production.ts`
- sau din variabile de mediu la build

## Variabile De Mediu Suportate

`config/loadConfig.ts` suportă override-uri prin variabile de mediu.

### Environment General

- `APP_ENV`
  - `development` sau `production`
- `APP_NAME`

### Feature Flags

- `APP_FEATURE_I18N`
- `APP_FEATURE_AUTO_UPDATE`
- `APP_FEATURE_APP_PROTECTION`
- `APP_FEATURE_LICENSING`
- `APP_FEATURE_DATABASE`
- `APP_FEATURE_LOGGING`

Valorile booleene acceptate:
- `true`
- `false`
- `1`
- `0`
- `yes`
- `no`
- `on`
- `off`

### i18n

- `APP_I18N_ENABLED`
- `APP_I18N_DEFAULT_LANGUAGE`
- `APP_I18N_SUPPORTED_LANGUAGES`
- `APP_I18N_NAMESPACES`

Exemplu:

```powershell
$env:APP_I18N_ENABLED = "true"
$env:APP_I18N_DEFAULT_LANGUAGE = "ro"
$env:APP_I18N_SUPPORTED_LANGUAGES = "en,ro,ru"
```

### Auto Update

- `APP_UPDATE_ENABLED`
- `APP_UPDATE_CHANNEL`
- `APP_UPDATE_AUTO_CHECK`
- `APP_UPDATE_AUTO_DOWNLOAD`
- `APP_UPDATE_ALLOW_PRERELEASE`
- `APP_UPDATE_PROVIDER`
- `APP_UPDATE_OWNER`
- `APP_UPDATE_REPO`
- `APP_UPDATE_VISIBILITY`

Exemplu:

```powershell
$env:APP_FEATURE_AUTO_UPDATE = "true"
$env:APP_UPDATE_ENABLED = "true"
$env:APP_UPDATE_PROVIDER = "github"
$env:APP_UPDATE_OWNER = "acme"
$env:APP_UPDATE_REPO = "desktop-app"
$env:APP_UPDATE_VISIBILITY = "private"
```

### App Protection

- `APP_APP_PROTECTION_ENABLED`
- `APP_APP_PROTECTION_PROFILE`
- `APP_APP_PROTECTION_ALLOW_DEVTOOLS`

Profiluri acceptate:
- `standard`
- `commercial`

### Licensing

- `APP_LICENSING_ENABLED`
- `APP_LICENSING_PUBLIC_KEY`
- `APP_LICENSING_GRACE_PERIOD_DAYS`
- `APP_LICENSING_HEARTBEAT_INTERVAL_MS`
- `APP_LICENSING_DEGRADED_MODE`
- `APP_LICENSING_PROVIDER`
- `APP_LICENSING_API_BASE_URL`
- `APP_LICENSING_TIMEOUT_MS`
- `APP_LICENSING_ENDPOINT_STATUS`
- `APP_LICENSING_ENDPOINT_ACTIVATE`
- `APP_LICENSING_ENDPOINT_VALIDATE`
- `APP_LICENSING_ENDPOINT_HEARTBEAT`
- `APP_LICENSING_ENDPOINT_ENTITLEMENTS`

Valori acceptate:
- provider: `noop`, `mock`, `http`
- degraded mode: `readonly`, `limited`, `blocked`

### Database

- `APP_DATABASE_ENABLED`
- `APP_DATABASE_PROVIDER`
- `APP_DATABASE_ORM`
- `APP_DATABASE_FILE_NAME`
- `APP_DATABASE_IN_MEMORY_FOR_TESTS`

Valori acceptate:
- provider: `sqlite`
- orm: `drizzle`

### Logging

- `APP_LOGGING_ENABLED`
- `APP_LOG_LEVEL`

Valori acceptate pentru log level:
- `silent`
- `error`
- `warn`
- `info`
- `debug`

## Cum Rulezi Proiectul În Dev

Comandă:

```bash
npm run dev
```

Ce face:
- pornește Vite în mod development
- pornește Electron prin integrarea cu `vite-plugin-electron`
- reconstruiește bundle-urile necesare pentru `main`, `preload` și `renderer`

Când o folosești:
- în dezvoltarea zilnică
- pentru verificare rapidă locală

Ce trebuie să știi:
- dacă ai procese Electron vechi sau build-uri blocate, trebuie închise înainte de rerulare
- dacă lucrezi la feature-uri de producție, nu le activa implicit în dev

## Cum Rulezi Testele

### `npm test`

Alias pentru:

```bash
npm run test:unit
```

Ce face:
- rulează toată suita de teste unitare configurată în `vitest.config.ts`

Când o folosești:
- înainte de commit
- după modificări de logică
- ca verificare minimă de stabilitate

### `npm run test:unit`

Comandă:

```bash
npm run test:unit
```

Ce face:
- rulează testele unitare o singură dată

Folosește această comandă pentru:
- validare CI-like locală
- verificare rapidă a unui task

### `npm run test:unit:watch`

Comandă:

```bash
npm run test:unit:watch
```

Ce face:
- pornește Vitest în watch mode
- rerulează testele la modificări

Folosește această comandă pentru:
- TDD
- dezvoltare iterativă pe logică

## Cum Funcționează TDD În Acest Proiect

Regula de bază:
- logica se dezvoltă cu TDD

Asta înseamnă:
- scrii sau actualizezi testele pentru logică
- implementezi schimbarea minimă necesară
- rulezi testele afectate
- apoi rulezi suita minimă relevantă

Ce se testează de regulă:
- config
- activarea modulelor
- helpere pure
- mapping de state
- politici de licensing
- update state mapping
- repositories
- services
- logică DB

Ce se evită:
- teste UI grele fără nevoie reală
- E2E dacă există opțiune mai ieftină

## Cum Faci Build

Comandă:

```bash
npm run build
```

Ce face:
- rulează `tsc`
- rulează `vite build`
- rulează `electron-builder`

Rezultatul:
- build renderer în `dist/`
- build Electron în `dist-electron/`
- pachet pentru distribuție în `release/`

Când o folosești:
- după ce ai terminat un milestone de produs
- înainte de testare manuală de packaging
- înainte de publicare

## Ce Trebuie Setat Înainte De Build Pentru Producție

### Auto Update

Trebuie verificat:
- `features.autoUpdate=true`
- `update.enabled=true`
- `update.provider.provider=github`
- `update.provider.owner`
- `update.provider.repo`
- `update.provider.visibility`

Flow-ul implementat este:
- detect update
- notify user
- manual download

### App Protection

Trebuie verificat:
- `features.appProtection=true`
- `appProtection.enabled=true`
- `appProtection.profile=standard|commercial`

### Licensing

Trebuie verificat:
- `features.licensing=true`
- `licensing.enabled=true`
- provider-ul ales
- endpoint-urile backend
- cheia publică
- intervalele și politicile de fallback

### Database

Trebuie verificat:
- `features.database=true`
- `database.enabled=true`
- `database.provider=sqlite`
- `database.orm=drizzle`
- `database.fileName`

## Exemple Practice

### Inițiere Aplicație Nouă

```bash
npm run init:starter -- --app-name=crm-desktop --app-id=com.acme.crm --package-name=@acme/crm-desktop --display-name="Acme CRM" --modules=logging,i18n,autoUpdate
```

### Development Cu i18n Activ

```powershell
$env:APP_FEATURE_I18N = "true"
$env:APP_I18N_ENABLED = "true"
npm run dev
```

### Build De Producție Cu Auto Update

```powershell
$env:APP_ENV = "production"
$env:APP_FEATURE_AUTO_UPDATE = "true"
$env:APP_UPDATE_ENABLED = "true"
$env:APP_UPDATE_PROVIDER = "github"
$env:APP_UPDATE_OWNER = "acme"
$env:APP_UPDATE_REPO = "crm-desktop"
$env:APP_UPDATE_VISIBILITY = "private"
npm run build
```

### Build De Producție Cu Licensing

```powershell
$env:APP_ENV = "production"
$env:APP_FEATURE_LICENSING = "true"
$env:APP_LICENSING_ENABLED = "true"
$env:APP_LICENSING_PROVIDER = "http"
$env:APP_LICENSING_API_BASE_URL = "https://licensing.acme.com"
$env:APP_LICENSING_PUBLIC_KEY = "PUBLIC_KEY_HERE"
npm run build
```

## Ce Înseamnă Toate Scripturile Din `npm run`

Scripturile curente din `package.json` sunt:

### `npm run dev`

- pornește aplicația în development
- folosește Vite + integrarea Electron
- pentru lucru zilnic local

### `npm run build`

- construiește tot proiectul pentru producție
- include packaging cu Electron Builder
- generează executabile în `release/`

### `npm run init:starter`

- inițializează metadatele proiectului nou pornit din starter
- actualizează placeholder-ele principale
- trebuie rulat cu parametri după `--`

### `npm run preview`

- pornește preview pentru partea Vite
- util în principal pentru verificarea build-ului renderer
- nu este fluxul principal pentru Electron

### `npm test`

- alias pentru `npm run test:unit`
- rulează toate testele unitare

### `npm run test:unit`

- rulează o singură dată testele unitare

### `npm run test:unit:watch`

- rulează testele unitare în watch mode
- recomandat pentru TDD

## Cum Să Lucrezi Corect În Acest Proiect

Reguli practice:
- lucrează modul cu modul
- sparge munca în task-uri mici
- validează DoD înainte să treci mai departe
- nu face refactorizări fără legătură cu task-ul
- păstrează boundary-ul Electron curat
- păstrează DB doar în main process
- expune către renderer doar API-uri tipizate prin preload
- adaugă teste de logică atunci când modifici logică

Flux recomandat pentru fiecare task:

1. Identifici modulul afectat.
2. Identifici fișierele de config sau contractele implicate.
3. Scrii sau actualizezi testele de logică.
4. Implementezi schimbarea minimă necesară.
5. Rulezi testele relevante.
6. Rulezi validarea mai largă dacă task-ul o cere.

## Checklist Minim Pentru Un Proiect Nou

- metadatele aplicației sunt actualizate
- modulele active sunt confirmate
- modulele inactive rămân dezactivate curat
- development merge local
- testele unitare merg
- build-ul merge
- configurarea de producție este explicită
- documentația proiectului este actualizată

## Documente Asociate

- `README.md`
- `docs/DEVELOPMENT_WORKFLOW.md`
- `docs/CODEX_PROJECT_INIT_WORKFLOW.md`
- `docs/LICENSING_BACKEND_API_CONTRACT.md`
