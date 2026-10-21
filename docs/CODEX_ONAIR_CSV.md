# OnAir: importul CSV per proiect

## Rol și sursă

OnAir este a treia zonă de lucru din LB-Portal, alături de Consolă și Setări. Selectorul său de proiect este independent de proiectul activ pentru execuție: consultarea datelor unui proiect nu îl activează și nu trimite comenzi LiveBoard.

În Setări, fiecare proiect poate salva o sursă `onAirCsv` opțională, cu formatul `pa-csv` și `folderPath`. Alegerea unui folder modifică draftul; salvarea este explicită. Ștergerea căii dezactivează sursa. Configurațiile v2 existente și scrierile prin adaptorul v1 rămân compatibile. Copierea unui proiect copiază configurația sursei într-un obiect independent; datele deja încărcate nu se copiază.

Grupurile sunt prezentate în taburi. „Invitați (Platou)” este primul și selectat inițial; apoi urmează beta-urile în ordinea exportului. Dacă exportul nu are grup de invitați, interfața păstrează un tab gol pentru platou, fără să inventeze înregistrări în snapshot. Alegerea manuală a unui beta se păstrează la Refresh dacă grupul continuă să existe. Supratitlul este afișat deasupra titlului.

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

`Template` este cheia sursă a graficii, păstrată exact din CSV. În Setări → proiect → Mapări CSV OnAir, operatorul selectează un tip și template detectat în importul deja încărcat, alege secțiunea LiveBoard și configurează câmpurile pentru fiecare destinație A/B existentă. Consultarea catalogului folosește numai memoria; exporturile se citesc în continuare exclusiv prin Refresh în OnAir. Nu se presupune că numele template-ului CSV este și numele contentului LiveBoard.

Mapările sunt salvate în proprietatea opțională `onAirMappings` a proiectului. Cheia unei mapări este perechea tip de element + nume template efectiv; destinațiile sunt referințe la secțiunile și targeturile proiectului. Parametrii disponibili sunt `Titlu`/`Supratitlu`, `Nume`/`Functie`, `Locatie`, respectiv `Nume`/`Functie`/`Image`. O valoare sursă poate alimenta mai multe câmpuri destinație. Șirurile goale se păstrează ca valori valide. Resolverul comun produce template-urile și valorile câmpurilor LiveBoard, afișate în OnAir pentru verificare.

Mapările nu sunt surse MOS și nu modifică resolverul receiverului Plasma. Proiectele existente fără această proprietate rămân valide; adaptorul legacy o păstrează. Duplicarea proiectului copiază configurația cu identificatori noi și referințe refăcute către propriile secțiuni/targeturi. Destinațiile referite nu pot fi eliminate lăsând mapări orfane. Salvarea exclusivă a mapărilor OnAir păstrează runtime-ul și temporizatoarele existente.

Pentru locații și intervenții, proiectul poate configura `onAirDefaultTemplates: { locations?: string, phones?: string }` în setările sursei CSV. Aceste nume manuale se folosesc când înregistrarea nu furnizează un `Template` nevid. Un nume primit din CSV are prioritate și se păstrează exact. Parserul acceptă și coloana suplimentară `Template` la finalul antetului acestor exporturi, păstrând compatibilitatea cu fișierele vechi. Dacă lipsesc și valoarea CSV, și configurația implicită, se afișează un diagnostic explicit; nu se inventează nume.

Template-ul efectiv este folosit atât în catalogul editorului, cât și în badge-ul elementului și în resolver. Înregistrările din snapshot păstrează valorile originale ale CSV-ului; modificarea template-ului implicit nu recitește fișierele și nu invalidează importul. Configurația implicită aparține proiectului și se copiază independent la duplicare.

OnAir nu produce cereri MOS simulate și nu activează proiecte. Contractul HTTP Plasma, autentificarea, CORS, confirmările, controllerul și comenzile TCP LBC rămân cele descrise în [contractul ingress](CODEX_PLASMA_INGRESS_CONTRACT.md). Nu se introduce OSCon/OSC.

## Verificare

Testele acoperă parserul, grupurile, izolarea proiectelor, păstrarea snapshotului la eșec, schimbarea sursei și răspunsurile întârziate, configurația salvată și navigarea cu draft nesalvat. Build-ul verifică integrarea main/preload/renderer. Probele nu confirmă output video fizic pe LiveBoard.

### Extindere: taburi, mapări și template-uri implicite — 21 octombrie 2026

- **141 teste relevante trecute în 22 fișiere**, pentru OnAir, setări, LiveBoard, ingress și i18n. Include maparea după tip/template exact, validarea referințelor, duplicarea independentă, valori goale și multiple câmpuri destinație, prioritizarea CSV față de template-ul implicit și persistența configurației. Regresia de controller confirmă că salvarea exclusivă a sursei/mapărilor/defaulturilor păstrează grafica ON, câmpurile și temporizarea, fără comenzi suplimentare.
- **QA renderer Edge trecut** la 640/1280/1920 px: Invitați primul și selectat inițial, ordinea și navigarea din tastatură a taburilor, păstrarea selecției la Refresh, supratitlu deasupra titlului, cele patru tipuri de valori pregătite, template implicit pentru locații/intervenții și prioritatea valorii CSV. Capturile Invitați și Beta au fost revizuite vizual, fără scroll orizontal. Fișierele sunt în cache-ul ignorat `node_modules/.cache/onair-qa/`.
- **45 verificări Electron izolate trecute**: include salvarea/redeschiderea mapărilor per proiect, introducerea cu Enter a mai multor câmpuri destinație, template-ul implicit pentru locații și valorile pregătite în OnAir. Verificările de lățime la 640/1280 px au trecut. Captura nativă Electron a expirat în acest mediu; capturarea este opțională și nu este raportată ca succes nativ.
- Editorul de mapări a fost revizuit separat la 640/1280 px în Edge, folosind DOM-ul serializat din proba Electron și CSS-ul compilat, cu valorile formularelor păstrate. Capturile `settings-mappings-{640,1280}.png` includ destinații simple și A/B; grila se adaptează la numărul destinațiilor. `node scripts/qa-onair-electron.cjs --capture-only` reface aceste capturi din fixture-ul HTML salvat în cache, fără pornirea aplicației native. Această probă statică verifică afișarea, iar proba Electron verifică interacțiunile și persistența.
- **Build TypeScript/Vite/NSIS trecut**, cu distribuția Electron instalată și comanda documentată mai jos. Installerul actualizat este `release/0.1.0/LB-Portal-0.1.0-x64.exe`. Probele folosesc configurații și exporturi fictive în profil temporar.

### Rezultate — 21 octombrie 2026

- **130 teste relevante trecute**, în 21 fișiere, pentru OnAir, setări, LiveBoard, ingress și i18n. Probele TCP folosesc socketuri localhost și necesită un mediu care le permite. Cele 12 teste backend OnAir includ parserul, proveniența, duplicatele, izolarea, păstrarea datelor la eșec, citirea stabilă, schimbarea A→B→A, coalescența Refresh și verificarea expeditorului IPC.
- **32 verificări Electron izolate trecute**, prin `node scripts/qa-onair-electron.cjs`: main/preload reale, fixture PA fictiv 9/8/1/1, lipsa citirii CSV la pornire, remount, erori, sursă schimbată, proiect activ nemodificat, draft nesalvat și repornire. Proba folosește profil temporar și port local separat.
- **QA renderer Edge trecut**, inclusiv răspunsuri întârziate între proiecte, observarea repetată a unui import deja pornit și diagnostic de CSV invalid. Capturile finale de la 640/1280/1920 px au fost revizuite vizual: grupuri pe lățimea disponibilă, coloane care se suprapun vertical pe ecran îngust, căi lizibile pe fundal întunecat și lipsa scrollului orizontal.
- Citirea read-only a exporturilor reale a confirmat 9 titluri, 8 persoane, o locație și o intervenție, în grupurile `beta 1 - Nato`, `beta 2 - Sedința Parlament`, `INVITATI`. Fișierele sursă nu au fost modificate.
- O rulare a întregii suite a trecut 238/242 verificări. Cele patru eșecuri sunt în zone nemodificate: două teste SQLite folosesc Node 24 (ABI 137) cu binarul compilat pentru Electron (ABI 130), lista veche de canale IPC nu include două canale existente de licențiere, iar un fixture de licențiere cu date calendaristice fixe nu mai satisface așteptarea perioadei de grație. Acestea nu sunt raportate ca teste trecute.

`node scripts/qa-onair-renderer.cjs` folosește distribuția instalată Edge, un server static peste `dist` și API-uri fictive. Verifică selecția independentă, răspunsurile întârziate, lipsa Refresh-ului implicit, invalidarea sursei, observarea repetată a stării unei operații deja pornite și layoutul la 640/1280/1920 px. Citirile repetate ale snapshotului cât timp acesta este `busy` nu inițiază un nou import. Capturile sunt în `node_modules/.cache/onair-qa/` și nu se comit.

Pe acest calculator, împachetarea standard a întâmpinat `EPERM` la redenumirea directorului temporar al arhivei Electron. Împachetarea a reușit folosind distribuția deja instalată, aceeași versiune 33.4.11: `npm run build -- --publish never --config.electronDist=node_modules/electron/dist`. Nu se schimbă versiunea runtime și nu se publică un release GitHub.
