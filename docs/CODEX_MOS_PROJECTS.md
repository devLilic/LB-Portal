# Proiecte și secțiuni grafice

## Scop

Secțiunile sunt organizate în proiecte independente. Numai **Telejurnal** și **Retrospectiva săptămânii** primesc PLAY din Plasma. Celelalte emisiuni sunt proiecte pentru operare directă în LB-Portal; interfața de operare directă se dezvoltă într-o etapă ulterioară. Această etapă organizează configurația lor și nu introduce un nou buton PLAY pentru ele.

Operatorul alege manual proiectul activ în consola LB-Portal. Cererile Plasma nu indică un proiect și nu aleg automat altul. Dacă proiectul activ este unul pentru operare directă, cererea HTTP se înregistrează, însă execuția este blocată, fără setări de câmpuri sau comenzi LiveBoard. Nu există fallback la Telejurnal.

## Proiecte incluse și proiecte noi

- Telejurnal și Retrospectiva sunt proiecte incluse, cu identificatori și roluri stabile. Sunt păstrate la salvare și nu pot fi transformate în proiecte ale altor emisiuni prin modificarea numelui sau rolului.
- Operatorul poate crea, redenumi și șterge proiecte suplimentare pentru operare directă.
- Fiecare proiect are propria listă de secțiuni și destinații. Aceleași nume tehnice de template MOS sau LiveBoard se pot repeta în proiecte diferite; conflictele dintre secțiuni sunt verificate în interiorul proiectului.
- Secțiunile proiectelor pentru operare directă pot exista fără surse Plasma. Nu se inventează surse sau parametri MOS pentru a salva un asemenea proiect.
- Conexiunea LiveBoard rămâne o setare comună aplicației. Proiectele nu pornesc conexiuni TCP separate.

### Duplicarea și ordinea secțiunilor

În Setări, „Duplică proiectul” copiază proiectul editat într-un proiect independent și selectează copia pentru editare. Numele inițial indică sursa și poate fi schimbat în câmpul „Numele proiectului”. Pot fi duplicate atât proiectele incluse, cât și proiectele independente; copia are rolul `standalone`. Telejurnal și Retrospectiva își păstrează identitatea și rolul Plasma.

Copia păstrează ordinea secțiunilor, destinațiile, sursele, mapările de câmpuri, timpii și regulile de interacțiune. Toți identificatorii interni sunt noi, iar referințele regulilor și cheile mapărilor de câmpuri sunt refăcute către elementele copiate. Editarea copiei nu modifică originalul. Duplicarea și redenumirea sunt modificări de draft, salvate prin „Salvează setările”; proiectul activ nu se schimbă.

Butoanele ↑ și ↓ din lista secțiunilor mută secțiunea cu o poziție. Se păstrează selecția și identificatorii, inclusiv referințele din interacțiuni. După salvare, ordinea este folosită în editor și consolă și se păstrează după repornire. Schimbarea exclusivă a ordinii secțiunilor este o modificare de afișare: păstrează stările, bufferele și temporizările active și nu trimite comenzi LiveBoard. Modificările funcționale și operațiile în curs păstrează protecțiile existente.

## Proiect editat și proiect activ

Fiecare proiect poate salva și [reguli de interacțiune între secțiuni](CODEX_SECTION_INTERACTIONS.md). Regulile folosesc identificatorii secțiunilor din același proiect, se editează separat de mapări și nu introduc rutare Plasma pentru proiectele independente. Configurațiile mai vechi fără reguli rămân valide.

Selectarea unui proiect în Setări schimbă numai proiectul editat. Modificările se salvează explicit și avertizarea pentru drafturi nesalvate rămâne aplicabilă. Selectarea în editor nu activează proiectul și nu transmite comenzi.

Activarea se face explicit din consolă, printr-o operație main/preload tipizată. Main recitește configurația salvată curentă înainte de activare; consola nu trimite înapoi o copie veche a întregii configurații.

Schimbarea proiectului este blocată cât timp există o operație în curs/coadă sau o secțiune activă ori incertă. Operatorul oprește sau resincronizează secțiunile înainte de schimbare. Restricțiile sunt răspunsuri operaționale cu mesaje localizate, fără excepții de handler pentru cazurile așteptate. Nu există STOP automat la schimbarea selectorului.

După o schimbare permisă, controllerul pornește starea noului proiect de la OFF, fără a refolosi bufferul activ sau valorile altui proiect. Activarea nu trimite PLAY. Editarea unui proiect inactiv nu resetează grafica proiectului activ.

## Persistență și migrare

Proiectele pot include opțional `onAirCsv: { format: 'pa-csv', folderPath: string }`, conform [contractului OnAir CSV](CODEX_ONAIR_CSV.md). Sursa se salvează în proiect și se păstrează la redenumire, duplicare și actualizarea mapărilor prin adaptorul legacy. Versiunea configurației rămâne 2; proiectele fără sursă rămân valide. Datele importate sunt separate după ID și trăiesc numai în memoria sesiunii. Selectorul OnAir inspectează un proiect fără să schimbe proiectul activ al controllerului.

Proprietatea opțională `onAirMappings` leagă tipurile și template-urile CSV de secțiunile, targeturile și câmpurile LiveBoard. Configurația se validează și se salvează în proiect; duplicarea remapează ID-urile și referințele, iar adaptorul v1 o păstrează. Aceste mapări de date sunt independente de sursele MOS și nu constituie o activare sau execuție LiveBoard.

`onAirDefaultTemplates` configurează opțional câte un nume pentru locații și intervenții telefonice fără template în CSV. Valorile CSV au prioritate. Configurația se păstrează la scrierile legacy și se copiază independent la duplicare, fără schimbarea snapshotului sau a runtime-ului.

Setarea locală `mosMappings` are configurația canonică versionată `2`: `activeProjectId` și lista `projects`. Fiecare proiect conține `id`, `name`, `kind` și propriul obiect `mappings`, cu structura existentă de secțiuni versionată `1`.

Citirea unei configurații vechi, plate, o adaptează în memorie: toate secțiunile și identificatorii lor devin mapările proiectului Telejurnal; Retrospectiva este goală. Numele tehnice, câmpurile, valorile și timpii nu sunt rescriși. Configurația în formatul nou este păstrată la salvare. Un fișier corupt nu este înlocuit prin presupunerea unei configurații goale.

API-urile vechi pentru mapări plate rămân adaptoare pentru proiectul activ. Salvarea unei asemenea mapări nu elimină proiectele vecine. Editorul de proiecte folosește API-ul pentru întreaga configurație. Validarea și accesul la fișier rămân în main; rendererul folosește numai preload-ul.

## Cereri și jurnal

Maparea este capturată la recepție împreună cu identitatea proiectului. Raportul istoric nu își schimbă proiectul după activare sau editare. Cererile sunt deduplicate în contextul proiectului; aceeași valoare `requestId` într-un alt proiect nu selectează un rezultat vechi al primului proiect.

Separarea rezultatelor rămâne valabilă: HTTP 200 confirmă recepția, raportul poate indica o execuție blocată, iar un răspuns TCP OK nu confirmă output-ul video. Nu se adaugă OSC sau un alt dialect TCP.

## Întreținere și verificare

### Etapele și instrumentele implementate

| Etapă | Instrument / fișier | Rol |
| --- | --- | --- |
| Model și migrare | `src/shared/settings/mosProjects.ts` | Configurație v2, proiecte incluse, adaptare v1 și validare per proiect. |
| Persistență și API | `settingsStore.ts`, `settingsApi.ts`, `liveboard:set-active-project` | Citire/salvare în main, adaptoare compatibile și activare din configurația salvată curentă. |
| Execuție și diagnostic | `controller.ts`, `mosMappingResolution.ts` | Stare A/B a proiectului activ, protecții la schimbare, blocarea Plasma pentru proiecte directe și identitate capturată. |
| Editor și consolă | `MosMappingsSettings.tsx`, `LiveBoardConsole.tsx` | Proiect editat separat de proiect activ, proiecte directe cu secțiuni proprii, mesaje RO/EN/RU. |
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

Păstrează sincronizate acest document, contractul de ingress, editorul, execuția, indexul workflow și documentația/indexul Plasma. Verifică migrarea, izolarea mapărilor, selecția manuală, interdicția Plasma pentru proiecte directe, protecția la schimbare, persistența după restart și lipsa comenzilor la activare. Folosește teste unitare, build și instanța Electron izolată cu receiverul TCP mock; compatibilitatea LiveBoard reală cere verificare separată.
