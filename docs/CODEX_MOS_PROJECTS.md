# Proiecte și secțiuni grafice

## Scop

Secțiunile sunt organizate în proiecte independente, create și administrate de operator. Instalarea nouă începe fără proiecte; numele emisiunilor, mapările și interacțiunile sunt create de la zero. Pentru fiecare proiect, operatorul alege în Setări modul **Fișiere CSV** sau **plasma.test**. Modul se salvează per proiect și determină dacă proiectul activ acceptă cereri Plasma ori folosește fluxul CSV local din OnAir.

Operatorul alege și activează manual proiectul din selectorul unic al tabului OnAir din LB-Portal. Selectorul alege și sursa CSV pentru OnAir; simpla schimbare a selecției nu activează proiectul. Cererile Plasma nu indică un proiect și nu aleg automat altul. Dacă proiectul activ folosește CSV, cererea HTTP se înregistrează, însă execuția este blocată, fără setări de câmpuri sau comenzi LiveBoard. Nu există fallback la Telejurnal.

## Proiecte incluse și proiecte noi

- Nu există proiecte incluse sau obligatorii. Operatorul poate crea, redenumi și șterge orice proiect; la ștergerea proiectului activ, selecția activă devine goală și alt proiect poate fi activat explicit ulterior din OnAir.
- Proiectele noi pornesc în modul CSV și pot fi configurate pentru `plasma.test` din selectorul „Mod de lucru”. Fără proiect activ, cererile Plasma sunt înregistrate ca recepționate, dar nu sunt mapate și nu trimit comenzi.
- Proiectul selectat pentru editare nu devine automat activ. Salvarea configurației și activarea din OnAir rămân acțiuni distincte.
- Butonul **Exportă proiectul** descarcă un fișier JSON `.lbproject.json` cu mapări, interacțiuni și setările proiectului. **Importă proiect** validează fișierul și creează o copie independentă cu identificatori noi; proiectul importat rămâne draft până la salvare. Calea locală CSV este inclusă și poate necesita actualizare pe alt calculator.
- Fiecare proiect poate avea opțional `staticGraphics`: grafici cu valori și câmpuri destinație fixe, legate de o secțiune LiveBoard. Pot fi folosite pentru logo-uri sau burtiere constante, apar separat în OnAir și nu depind de snapshotul CSV ori de cereri Plasma. Redarea cere activarea proiectului și trece prin controllerul LiveBoard local; valorile și destinațiile sunt recitite din setările salvate în main. Elementele se copiază și se exportă/importă odată cu proiectul, cu ID-uri și referințe refăcute.
- Fiecare proiect are propria listă de secțiuni și destinații. Aceleași nume tehnice de template MOS sau LiveBoard se pot repeta în proiecte diferite; conflictele dintre secțiuni sunt verificate în interiorul proiectului.
- Secțiunile proiectelor pot exista fără surse Plasma, de exemplu pentru grafici fixe; cererile MOS fără o mapare sursă validă rămân nemapate. Proiectele în modul `plasma.test` folosesc mapările sursă MOS normale unde sunt configurate.
- Conexiunea LiveBoard rămâne o setare comună aplicației. Proiectele nu pornesc conexiuni TCP separate.

### Duplicarea și ordinea secțiunilor

În Setări, „Duplică proiectul” copiază proiectul editat într-un proiect independent și selectează copia pentru editare. Numele inițial indică sursa și poate fi schimbat în câmpul „Numele proiectului”. Toate proiectele au rolul `standalone` și pot fi duplicate.

Copia păstrează ordinea secțiunilor, destinațiile, sursele, mapările de câmpuri, timpii și regulile de interacțiune, dar pornește în modul CSV; modul poate fi schimbat în `plasma.test`. Toți identificatorii interni sunt noi, iar referințele regulilor și cheile mapărilor de câmpuri sunt refăcute către elementele copiate. Editarea copiei nu modifică originalul. Duplicarea și redenumirea sunt modificări de draft, salvate prin „Salvează setările”; proiectul activ nu se schimbă.

Butoanele ↑ și ↓ din lista secțiunilor mută secțiunea cu o poziție. Se păstrează selecția și identificatorii, inclusiv referințele din interacțiuni. După salvare, ordinea este folosită în editor și consolă și se păstrează după repornire. Schimbarea exclusivă a ordinii secțiunilor este o modificare de afișare: păstrează stările, bufferele și temporizările active și nu trimite comenzi LiveBoard. Modificările funcționale și operațiile în curs păstrează protecțiile existente.

## Proiect editat și proiect activ

Fiecare proiect poate salva și [reguli de interacțiune între secțiuni](CODEX_SECTION_INTERACTIONS.md). Regulile folosesc identificatorii secțiunilor din același proiect, se editează separat de mapări și nu introduc rutare Plasma pentru proiectele independente. Configurațiile mai vechi fără reguli rămân valide.

Selectarea unui proiect în Setări schimbă numai proiectul editat. Modificările se salvează explicit și avertizarea pentru drafturi nesalvate rămâne aplicabilă. Selectarea în editor nu activează proiectul și nu transmite comenzi.

Activarea se face explicit din OnAir, prin aceeași operație main/preload tipizată. Main recitește configurația salvată curentă înainte de activare; interfața nu trimite înapoi o copie veche a întregii configurații. Consola rămâne pentru starea runtime și diagnosticare.

Schimbarea proiectului este blocată cât timp există o operație în curs/coadă sau o secțiune activă ori incertă. Operatorul oprește sau resincronizează secțiunile înainte de schimbare. Restricțiile sunt răspunsuri operaționale cu mesaje localizate, fără excepții de handler pentru cazurile așteptate. Nu există STOP automat la schimbarea selectorului.

După o schimbare permisă, controllerul pornește starea noului proiect de la OFF, fără a refolosi bufferul activ sau valorile altui proiect. Activarea nu trimite PLAY. Editarea unui proiect inactiv nu resetează grafica proiectului activ.

## Persistență și migrare

Proiectele pot include opțional `onAirCsv: { format: 'pa-csv', folderPath: string, filePrefix?: string, includeWaitTitlesLocations?: boolean }`, conform [contractului OnAir CSV](CODEX_ONAIR_CSV.md). Câmpul opțional `includeWaitTitlesLocations` este implicit fals, iar fișierul combinat nu este inspectat decât dacă proiectul îl activează explicit. Sursa se salvează în proiect și se păstrează la redenumire, duplicare și actualizarea mapărilor prin adaptorul legacy. Versiunea configurației rămâne 2; proiectele fără sursă rămân valide. Datele importate sunt separate după ID și trăiesc numai în memoria sesiunii. Selectorul OnAir alege proiectul CSV, iar schimbarea lui activează runtime-ul numai la acționarea explicită a butonului dedicat.

Proprietatea opțională `onAirMappings` leagă tipurile și template-urile CSV de secțiunile, targeturile și câmpurile LiveBoard. Fila de editare **Mapări CSV OnAir** este vizibilă numai când modul proiectului este **Fișiere CSV**. Configurația se validează și se salvează în proiect; duplicarea remapează ID-urile și referințele, iar adaptorul v1 o păstrează. Aceste mapări de date sunt independente de sursele MOS și nu constituie o execuție LiveBoard.

Proprietatea opțională `staticGraphics` definește elemente fixe proiectului: nume afișat, secțiune LiveBoard, durată/ieșire și câmpuri cu etichetă, valoare fixă și una sau mai multe destinații pentru fiecare template A/B. De exemplu, eticheta `Nume`, valoarea `Irina Bejenaru` și destinațiile `Nume` și `Nume_M`; pentru `Funcție` se configurează un rând separat. Lista de câmpuri poate fi goală pentru template-uri grafice care nu cer valori suplimentare. Editorul nu adaugă elemente predefinite. OnAir le afișează fără a cere fișiere CSV și le lansează prin API local tipizat; main verifică proiectul activ și preia definiția salvată înainte de a apela controllerul. Banda de jos este mereu vizibilă și include **Oprește toate** chiar și când proiectul nu are `staticGraphics`; butonul se activează numai când proiectul selectat este proiectul LiveBoard activ. STOP-ul trimite `LBC_STOPCONTENT` fiecărei destinații din toate secțiunile proiectului activ și nu declanșează restaurările `after-stop`. Contractul HTTP Plasma nu este schimbat.

`onAirDefaultTemplates` configurează opțional câte un nume pentru locații și intervenții telefonice fără template în CSV. Valorile CSV au prioritate. Configurația se păstrează la scrierile legacy și se copiază independent la duplicare, fără schimbarea snapshotului sau a runtime-ului.

Setarea locală `mosMappings` are configurația canonică versionată `2`: `activeProjectId` și lista `projects`; ambele pot fi goale când nu este activ niciun proiect. Fiecare proiect conține `id`, `name`, `kind`, `mode` (`plasma` sau `csv`) și propriul obiect `mappings`, cu structura existentă de secțiuni versionată `1`. Pentru datele v2 mai vechi, proiectele Telejurnal/Retrospectiva sunt convertite în proiecte `standalone` editabile în modul Plasma, iar proiectele standalone fără mod salvat primesc modul CSV.

Citirea unei configurații vechi, plate, o adaptează în memorie într-un proiect obișnuit editabil, în modul `plasma`; secțiunile și identificatorii existenți sunt păstrați. Configurațiile v2 mai vechi convertesc proiectele Telejurnal și Retrospectiva în proiecte obișnuite, cu datele și rolul Plasma păstrate. Ele pot fi redenumite sau șterse. Configurația în formatul nou este păstrată la salvare. Un fișier corupt nu este înlocuit prin presupunerea unei configurații goale.

API-urile vechi pentru mapări plate rămân adaptoare pentru proiectul activ. Salvarea unei asemenea mapări nu elimină proiectele vecine. Editorul de proiecte folosește API-ul pentru întreaga configurație. Validarea și accesul la fișier rămân în main; rendererul folosește numai preload-ul.

## Cereri și jurnal

Maparea este capturată la recepție împreună cu identitatea proiectului. Raportul istoric nu își schimbă proiectul după activare sau editare. Cererile sunt deduplicate în contextul proiectului; aceeași valoare `requestId` într-un alt proiect nu selectează un rezultat vechi al primului proiect.

Separarea rezultatelor rămâne valabilă: HTTP 200 confirmă recepția, raportul poate indica o execuție blocată, iar un răspuns TCP OK nu confirmă output-ul video. Nu se adaugă OSC sau un alt dialect TCP.

## Întreținere și verificare

### Etapele și instrumentele implementate

Actualizare 24 octombrie 2026: nu mai există proiecte incluse obligatorii. Instalările noi pornesc cu zero proiecte; proiectele vechi Telejurnal/Retrospectiva rămân date migrabile și devin proiecte obișnuite editabile. Proiectele se pot exporta/importa prin fișiere `.lbproject.json`, cu validare și ID-uri noi la import. Lipsa proiectului activ blochează maparea fără a afecta confirmarea recepției HTTP Plasma. Contractul HTTP, autentificarea, CORS și ruta TCP LiveBoard nu se schimbă.

| Etapă | Instrument / fișier | Rol |
| --- | --- | --- |
| Model și migrare | `src/shared/settings/mosProjects.ts` | Configurație v2, proiecte incluse, adaptare v1 și validare per proiect. |
| Persistență și API | `settingsStore.ts`, `settingsApi.ts`, `liveboard:set-active-project` | Citire/salvare în main, adaptoare compatibile și activare din configurația salvată curentă. |
| Execuție și diagnostic | `controller.ts`, `mosMappingResolution.ts` | Stare A/B a proiectului activ, protecții la schimbare, blocarea Plasma pentru proiecte CSV și identitate capturată. |
| Editor și consolă | `MosMappingsSettings.tsx`, `LiveBoardConsole.tsx` | Proiect editat separat de proiect activ, selectarea modului CSV/Plasma pentru proiecte noi, mesaje RO/EN/RU. |
| Verificare | `mosProjects.spec.ts`, testele controllerului/ingress și `scripts/qa-liveboard.cjs` | Migrare, izolare, persistență, controale Electron și receiver TCP mock fără modificarea setărilor operatorului. |

Codul acestei etape este realizat cu agenții specialiști GPT-6-Luna; integrarea, revizia capturilor și documentația sunt gestionate în chatul principal. Nu se creează o aplicație Electron separată pentru simulator: instrumentul TCP rămâne procesul Node documentat în `LIVEBOARD_MOCK_SERVER.md`.

### Extensia editorului — 19 octombrie 2026

- **44 teste unitare relevante: PASS** — proiecte, interacțiuni și controller; includ copia independentă cu referințe refăcute, persistența numelui/ordinii și salvarea reordonării cu buffer și temporizare active păstrate.
- **Renderer compilat: PASS**, `node scripts/qa-renderer-layout.cjs` — reordonare cu selecție păstrată, duplicare/redenumire/salvare/reîncărcare, original nemodificat, referințe și identificatori independenți. Editorul a fost verificat la 640/1280/1920 px, iar copia la 640/1920 px, fără scroll orizontal. Cele nouă capturi sunt în `node_modules/.cache/lbportal-project-editing-20261019/`; au fost revizuite vizual editorul și copia pe ecran îngust.
- **Build TypeScript/Vite/NSIS x64: PASS**, `npm run build -- --publish never`. Sandboxul a refuzat curățarea/scrierea fișierelor generate din `dist`; aceeași comandă a reușit cu permisiunile necesare. Installer: `release/0.1.0/Default Electron App-0.1.0-x64.exe`.
- Codul și verificările au fost scrise cu specialiști GPT-6-Luna. Datele probelor sunt fictive; setările operatorului și instalația LiveBoard nu au fost folosite.
- Proba Electron generală `npm run qa:liveboard -- --skip-captures` nu s-a încheiat cu PASS. Au fost adaptate verificările la cardurile/controalele pliate și la fluxul documentat STOP → reîncercare la salvare. Proba se oprește la afișarea pasului de suspendare din raport: regula CSS existentă `.portal .request-detail .lb-step-list{display:none}` ascunde lista și când detaliile sunt deschise (`src/features/liveboard/liveboard-console.css`). CSS-ul consolei nu a fost schimbat în această intervenție. Verificările funcțiilor noi rămân cele unitare și ale rendererului compilat de mai sus; nu se declară un PASS pentru întreaga probă Electron.
- Proba Electron generală `npm run qa:liveboard -- --skip-captures` nu s-a încheiat cu PASS. Au fost adaptate verificările la cardurile/controalele pliate și la fluxul documentat STOP → reîncercare la salvare. Proba se oprește la afișarea pasului de suspendare din raport: regula CSS existentă `.portal .request-detail .lb-step-list{display:none}` ascunde lista și când detaliile sunt deschise (`src/features/liveboard/liveboard-console.css`). CSS-ul consolei nu a fost schimbat în această intervenție. Verificările funcțiilor noi rămân cele unitare și ale rendererului compilat de mai sus; nu se declară un PASS pentru întreaga probă Electron.

### Rezultate inițiale — 15 octombrie 2026

- **68 teste relevante LB-Portal: PASS** — include migrarea, validarea, persistarea proiectelor, secțiuni independente fără surse, adaptoare plate, protecțiile controllerului și diagnosticele cu proiect capturat.
- **11 teste frontend ale contractului Plasma: PASS**; codul Plasma/ENPS/HTM nu a fost modificat de această etapă.
- **110 verificări Electron izolate: PASS** — migrare reală la citire, același template și requestId în două proiecte, câmpuri/destinații distincte, lipsa fallback-ului, editarea unui proiect inactiv fără resetarea runtime-ului activ, refuz localizat la activare cu grafica activă, creare/redenumire/ștergere de proiecte independente, recepție HTTP cu execuție Plasma blocată fără trafic TCP și istoric păstrat după redenumire/ștergere. Restartul păstrează configurația v2, proiectul Retrospectiva activ, destinațiile/câmpurile și pauza de propagare editată la 500 ms; runtime-ul revine OFF, TCP rămâne deconectat și nu există replay. Refuzurile așteptate nu generează excepții `settings:set` în stderr.
- **Build TypeScript/Vite/NSIS x64: PASS** — `npm run build -- --publish never`; installerul este `release/0.1.0/Default Electron App-0.1.0-x64.exe`.
- Capturile desktop/ecran îngust au fost inspectate vizual, inclusiv editorul independent, selectorul activ, jurnalul cu proiecte istorice și raportul blocat. Capturile suplimentare sunt `%TEMP%\lbportal-project-standalone-runtime.png` și `%TEMP%\lbportal-project-standalone-report.png`.

Verificările folosesc setări temporare și receiverul TCP mock. Nu confirmă grafica video, animațiile sau diacriticele pe o instalație LiveBoard reală. Modificările existente necomise sunt păstrate.

Păstrează sincronizate acest document, contractul de ingress, editorul, execuția, indexul workflow și documentația/indexul Plasma. Verifică migrarea, izolarea mapărilor, selecția manuală, blocarea Plasma pentru proiecte CSV, rutarea proiectelor Plasma personalizate, protecția la schimbare, persistența după restart și lipsa comenzilor la activare. Folosește teste unitare, build și instanța Electron izolată cu receiverul TCP mock; compatibilitatea LiveBoard reală cere verificare separată.

### Moduri de proiect și mapare pe rânduri — 24 octombrie 2026

- Proiectele personalizate au `mode: "csv" | "plasma"`; noile proiecte și copiile pornesc în CSV. Datele v2 deja salvate se normalizează la Plasma pentru proiectele incluse și CSV pentru proiectele `standalone`.
- Receiverul folosește în continuare exclusiv proiectul activ. Modul Plasma permite o emisiune personalizată cu mapări MOS; modul CSV păstrează recepția HTTP, dar blochează execuția înaintea oricărei comenzi LiveBoard. Envelope-ul, autentificarea, CORS și protocolul LBC nu s-au schimbat.
- Editorul MOS afișează un singur câmp destinație per rând. Parametrul Plasma poate fi repetat pentru câmpuri precum `Titlu` și `Titlu_M`; valorile se rezolvă la aceeași valoare recepționată. Setările istorice cu liste multiple sunt afișate ca rânduri separate.
- **45 teste focalizate: PASS** pentru proiecte, rezolvare ingress, controller, snapshot și raport. **Build TypeScript/Vite/NSIS x64: PASS**, inclusiv installerul local `release/0.1.0/LB-Portal-0.1.0-x64.exe`. Verificarea folosește simulare/TCP mock; nu confirmă output video pe LiveBoard real.

### Grafici fixe opționale — 24 octombrie 2026

Elementele `staticGraphics` sunt opționale și nu se creează automat la proiect nou. Pot rula doar template-ul sau pot seta valori fixe pe una ori mai multe destinații din secțiunea legată. Câmpurile destinație se introduc în textarea, câte unul pe linie, iar valoarea fixă se transmite fiecăruia. Duplicarea și transferul `.lbproject.json` păstrează definiția cu identificatori refăcuți. OnAir le afișează și fără CSV, iar PLAY/Resume local folosește controllerul după validarea în main a proiectului activ. Plasma și HTTP receiverul nu primesc modificări de payload sau rutare.

Verificare: `npx tsc --noEmit` și cele 14 teste din `tests/unit/settings/mosProjects.spec.ts` au trecut; output-ul video pe un LiveBoard fizic nu a fost verificat.
