# OnAir: importul CSV per proiect

## Rol și sursă

OnAir este a treia zonă de lucru din LB-Portal, alături de Consolă și Setări. Selectorul său de proiect este independent de proiectul activ pentru execuție: consultarea datelor unui proiect nu îl activează și nu trimite comenzi LiveBoard.

În Setări, fiecare proiect poate salva o sursă `onAirCsv` opțională, cu formatul `pa-csv` și `folderPath`. Alegerea unui folder modifică draftul; salvarea este explicită. Ștergerea căii dezactivează sursa. Configurațiile v2 existente și scrierile prin adaptorul v1 rămân compatibile. Copierea unui proiect copiază configurația sursei într-un obiect independent; datele deja încărcate nu se copiază.

Folderul de pe calculatorul de dezvoltare pentru Punctul pe Azi este `C:\Projects\_CSV\PA\Export`. Calea este o setare locală a proiectului, nu o constantă de import și nu o cale implicită pentru celelalte proiecte.

## Cele patru exporturi PA

| Fișier | Coloane necesare | Semnificație |
| --- | --- | --- |
| `PA_titles.csv` | `Nr`, `Titlu`, `Supratitlu`, `Template` | Titluri în ordinea exportată, numerotate în interiorul grupului. |
| `PA_persons.csv` | `Sectiune`, `Nume`, `Functie`, `Template` | Persoane fără fotografie, grupate editorial. |
| `PA_locations.csv` | `Locatie` | Locațiile grupului INVITAȚI. |
| `PA_phones.csv` | `Nume`, `Functie`, `Image` | Intervenții telefonice din INVITAȚI: persoană și cale fotografie; nu numere telefonice. |

Semantica a fost verificată în exportatorul csvEditor-PA (`paEntityExportMapper.ts`). Rândurile `--- ... ---` sunt markeri de grup în prima coloană a exporturilor de titluri/persoane. Titlurile și persoanele sunt liste independente; nu se corelează după poziție sau număr. Grupurile comune se reunesc după marker și se păstrează ordinea sursei, inclusiv duplicatele valide. Locațiile și intervențiile apar la INVITAȚI. Grupurile repetate nu trebuie comprimate accidental.

Importul folosește UTF-8 și delimitatorul `;`, cu suport pentru BOM, ghilimele escapate, delimitatori și newline-uri în celule. Textele și numele template-urilor se păstrează. Un fișier cu numai antet reprezintă o listă goală validă. Fiecare element păstrează fișierul și poziția sursă pentru diagnostic.

## Refresh și memorie

Citirea CSV-urilor începe exclusiv la Refresh. Deschiderea OnAir, schimbarea proiectului și alegerea/salvarea folderului nu citesc exporturile. Snapshoturile sunt separate după ID-ul proiectului și rămân în memorie în sesiunea curentă, inclusiv la navigare. Repornirea aplicației cere un nou Refresh.

Un snapshot se publică după citirea și validarea tuturor celor patru fișiere. O eroare de citire/parsare păstrează ultimul import reușit al aceleiași surse și este afișată alături de el. Schimbarea folderului invalidează datele sursei anterioare. Răspunsurile întârziate nu trebuie să publice date în alt proiect sau într-o sursă schimbată între timp.

Importatorul verifică metadatele fișierelor înainte și după citire și reia limitat operația dacă sursa se modifică. Exportatorul nu furnizează un identificator comun de lot sau un manifest tranzacțional: stabilitatea fișierelor reduce riscul de citire în timpul scrierii, dar nu dovedește că toate fișierele sunt din aceeași generație.

## Securitate și pregătirea pentru LiveBoard

Filesystemul și parserul aparțin Electron main. Preload expune numai operații tipizate pentru lista proiectelor, alegerea folderului, snapshot și Refresh după ID de proiect. Main rezolvă calea din setările salvate și validează expeditorul IPC. Rendererul nu primește API Node sau citire arbitrară de fișiere. Fotografiile sunt deocamdată reprezentate prin calea text, fără încărcare de URL-uri din CSV.

Această etapă încarcă și afișează datele. `Template` este păstrat ca valoare sursă; nu reprezintă automat un content LiveBoard sau o mapare validată. Operarea ulterioară necesită mapări explicite ale tipului/template-ului sursă către secțiuni, destinații și câmpuri. Locațiile și intervențiile nu au template în export.

OnAir nu produce cereri MOS simulate și nu activează proiecte. Contractul HTTP Plasma, autentificarea, CORS, confirmările, controllerul și comenzile TCP LBC rămân cele descrise în [contractul ingress](CODEX_PLASMA_INGRESS_CONTRACT.md). Nu se introduce OSCon/OSC.

## Verificare

Testele acoperă parserul, grupurile, izolarea proiectelor, păstrarea snapshotului la eșec, schimbarea sursei și răspunsurile întârziate, configurația salvată și navigarea cu draft nesalvat. Build-ul verifică integrarea main/preload/renderer. Probele nu confirmă output video fizic pe LiveBoard.

### Rezultate — 21 octombrie 2026

- **130 teste relevante trecute**, în 21 fișiere, pentru OnAir, setări, LiveBoard, ingress și i18n. Probele TCP folosesc socketuri localhost și necesită un mediu care le permite. Cele 12 teste backend OnAir includ parserul, proveniența, duplicatele, izolarea, păstrarea datelor la eșec, citirea stabilă, schimbarea A→B→A, coalescența Refresh și verificarea expeditorului IPC.
- **32 verificări Electron izolate trecute**, prin `node scripts/qa-onair-electron.cjs`: main/preload reale, fixture PA fictiv 9/8/1/1, lipsa citirii CSV la pornire, remount, erori, sursă schimbată, proiect activ nemodificat, draft nesalvat și repornire. Proba folosește profil temporar și port local separat.
- **QA renderer Edge trecut**, inclusiv răspunsuri întârziate între proiecte, observarea repetată a unui import deja pornit și diagnostic de CSV invalid. Capturile finale de la 640/1280/1920 px au fost revizuite vizual: grupuri pe lățimea disponibilă, coloane care se suprapun vertical pe ecran îngust, căi lizibile pe fundal întunecat și lipsa scrollului orizontal.
- Citirea read-only a exporturilor reale a confirmat 9 titluri, 8 persoane, o locație și o intervenție, în grupurile `beta 1 - Nato`, `beta 2 - Sedința Parlament`, `INVITATI`. Fișierele sursă nu au fost modificate.
- O rulare a întregii suite a trecut 238/242 verificări. Cele patru eșecuri sunt în zone nemodificate: două teste SQLite folosesc Node 24 (ABI 137) cu binarul compilat pentru Electron (ABI 130), lista veche de canale IPC nu include două canale existente de licențiere, iar un fixture de licențiere cu date calendaristice fixe nu mai satisface așteptarea perioadei de grație. Acestea nu sunt raportate ca teste trecute.

`node scripts/qa-onair-renderer.cjs` folosește distribuția instalată Edge, un server static peste `dist` și API-uri fictive. Verifică selecția independentă, răspunsurile întârziate, lipsa Refresh-ului implicit, invalidarea sursei, observarea repetată a stării unei operații deja pornite și layoutul la 640/1280/1920 px. Citirile repetate ale snapshotului cât timp acesta este `busy` nu inițiază un nou import. Capturile sunt în `node_modules/.cache/onair-qa/` și nu se comit.

Pe acest calculator, împachetarea standard a întâmpinat `EPERM` la redenumirea directorului temporar al arhivei Electron. Împachetarea a reușit folosind distribuția deja instalată, aceeași versiune 33.4.11: `npm run build -- --publish never --config.electronDist=node_modules/electron/dist`. Nu se schimbă versiunea runtime și nu se publică un release GitHub.
