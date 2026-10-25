# Execuția MOS → LiveBoard și grupurile A/B

## Etape și instrumente dezvoltate

1. **Editorul de mapări** — secțiuni persistente, una/două destinații și mapări independente per sursă și buffer; validare în main.
2. **Diagnosticul la recepție** — secțiunea și mapările sunt capturate din setările salvate la PLAY. Cererea HTTP este confirmată separat de execuție.
3. **Controllerul de execuție** — serializează operațiile, pregătește câmpurile, alternează grupurile și păstrează starea locală.
4. **Transportul LBC** — simulare internă și client TCP cu framing, escaping, confirmări și timeout; conexiune configurabilă și manuală.
5. **Consola operațională** — buffer ales, buffer anterior/următor, pași și răspunsuri, RESUME manual, STOP de recuperare și resincronizare locală.
6. **Receiverul TCP simulat** — proces Node pornit prin `npm run mock:liveboard`, pentru probe fără LiveBoard.
7. **Verificarea** — teste concentrate, aplicație Electron izolată prin `npm run qa:liveboard` și build. Instrumentul QA folosește setări temporare și receiverul TCP mock; validarea video pe ClassX rămâne o probă separată.

Vezi [protocolul și sursele](CODEX_LIVEBOARD_PROTOCOL.md), [receiverul simulat](LIVEBOARD_MOCK_SERVER.md) și [editorul](CODEX_MOS_MAPPING_EDITOR.md).

## Fișierele instrumentelor

| Componentă | Implementare |
| --- | --- |
| Model și validare mapări | `src/shared/settings/mosMappings.ts` |
| Editor și setări de conexiune | `src/features/mos-mappings/MosMappingsSettings.tsx` |
| Persistența locală | `electron/main/modules/settings/settingsStore.ts` |
| Rezultatul salvării prin IPC | `electron/main/modules/settings/settingsSave.ts` — returnează restricțiile operaționale ca date tipizate înainte de scriere |
| Rezolvarea mapării la recepție | `src/shared/ingress/mosMappingResolution.ts` |
| Receiver și legătura cu execuția | `electron/main/ingress/LBPortalReceiver.ts`, `registerLBPortalIngress.ts` |
| Stare A/B, coadă, recuperare și jurnal | `electron/main/liveboard/controller.ts` |
| Codec LBC și transport simulat/TCP | `electron/main/liveboard/transport.ts` |
| Protecția setărilor în timpul execuției | `electron/main/liveboard/settingsGuard.ts` |
| Contracte de conexiune și runtime | `src/shared/liveboard/connection.ts`, `runtime.ts` |
| API-ul rendererului | `electron/preload/modules/createLBPortalApiPreloadModule.ts` |
| Consolă și rapoarte | `src/features/liveboard/LiveBoardConsole.tsx`, `src/features/ingress/MosMappingReport.tsx` |
| Receiver TCP de test | `scripts/mock-liveboard.mjs` — `npm run mock:liveboard` |
| Verificare Electron izolată | `scripts/qa-liveboard.cjs` — `npm run qa:liveboard` |

## Două grupuri complete

Prima destinație este A, a doua B. Fiecare conține întregul set de câmpuri al graficii, chiar dacă numele câmpurilor diferă. Toate sursele Plasma dintr-o secțiune folosesc aceeași pereche și stare.

- Din OFF: se scriu toate câmpurile în A → pauză de propagare → PLAY A.
- Din ON_A: se scriu toate câmpurile în B, fără modificarea valorilor A → pauză de propagare → RESUME A → pauză de tranziție → PLAY B.
- Din ON_B: aceeași secvență, cu A și B inversate.

Pauza pentru propagarea datelor este implicit 250 ms, configurabilă per secțiune din `0, 100, 250, 500, 1000`. Pauza RESUME → PLAY este implicit 100 ms, cu opțiunile existente ale editorului. Pauzele sunt bariere locale; nu dovedesc că rendererul ClassX a terminat o animație.

O secțiune cu o singură destinație nu are un buffer ascuns: modificările câmpurilor se aplică acelei destinații înainte de noul PLAY. Pentru schimbarea textelor fără rescrierea grupului activ, configurează două destinații complete.

O cerere identică pentru sursa și valorile mapate deja active nu retrimite comenzile. Parametrii lipsă blochează execuția înainte de scriere; șirul gol este o valoare primită validă. Parametrii suplimentari fără mapare rămân diagnostice. Template-urile fără parametri trimit PLAY fără settere inventate.

## Stare și ieșire

Răspunsul HTTP pentru un PLAY automat confirmat include `automaticDurationSeconds` și `remainingDurationMs`, conform [contractului de ingress](CODEX_PLASMA_INGRESS_CONTRACT.md#automatic-graphic-duration-in-the-acknowledgement). Timpul rămas se citește din temporizatorul instanței executate, inclusiv la `noop` și la retrimiterea aceluiași requestId. Refolosirea unui buffer pentru o grafică nouă nu reactivează durata unei cereri vechi; instanțele expirate sau înlocuite au timp rămas zero. Calculul metadatelor nu trimite comenzi și nu rearmează temporizatorul.

Răspunsul HTTP pentru un PLAY automat confirmat include `automaticDurationSeconds` și `remainingDurationMs`, conform [contractului de ingress](CODEX_PLASMA_INGRESS_CONTRACT.md#automatic-graphic-duration-in-the-acknowledgement). Timpul rămas se citește din temporizatorul instanței executate, inclusiv la `noop` și la retrimiterea aceluiași requestId. Refolosirea unui buffer pentru o grafică nouă nu reactivează durata unei cereri vechi; instanțele expirate sau înlocuite au timp rămas zero. Calculul metadatelor nu trimite comenzi și nu rearmează temporizatorul.

[Regulile configurabile](CODEX_SECTION_INTERACTIONS.md) extind ieșirea cu interacțiuni între secțiunile proiectului. O suspendare păstrează bufferul și valorile pentru revenire; durata automată este cea deja configurată pentru sursa executată. Acțiunile sunt serializate și jurnalizate, fără declanșare recursivă a altor reguli. Documentul dedicat precizează anularea revenirilor și protecția secțiunilor suspendate.

Ordinea secțiunilor este o preferință de afișare salvată în proiect. La compararea setărilor funcționale, secțiunile sunt comparate după identificator, fără a considera ordinea listei; ordinea destinațiilor A/B și a regulilor/acțiunilor rămâne semnificativă. Salvarea unei reordonări păstrează runtime-ul, câmpurile, bufferul și temporizările fiecărei secțiuni și actualizează ordinea snapshotului consolei fără comenzi. Duplicarea unui proiect creează o configurație independentă cu identificatori noi, fără activare sau transfer de stare runtime.

Ordinea secțiunilor este o preferință de afișare salvată în proiect. La compararea setărilor funcționale, secțiunile sunt comparate după identificator, fără a considera ordinea listei; ordinea destinațiilor A/B și a regulilor/acțiunilor rămâne semnificativă. Salvarea unei reordonări păstrează runtime-ul, câmpurile, bufferul și temporizările fiecărei secțiuni și actualizează ordinea snapshotului consolei fără comenzi. Duplicarea unui proiect creează o configurație independentă cu identificatori noi, fără activare sau transfer de stare runtime.

Stările locale sunt OFF, ON_A, ON_B, ON_SINGLE, SUSPENDED și NEEDS_RESYNC. SUSPENDED păstrează bufferul și valorile pentru revenirea configurată, fără a declara grafica activă în emisie. În simulare stările sunt explicit simulate; după OK în TCP sunt confirmări de protocol, nu observații video. Starea de pornire OFF este o presupunere locală, nu rezultatul unei interogări LiveBoard.

RESUME manual scoate destinația activă conform timeline-ului template-ului. Pentru sursele automate, durata salvată permite estimarea locală a ieșirii; animația și ieșirea reală sunt responsabilitatea template-ului LiveBoard. Expirarea duratei nu trimite RESUME sau STOP pe grafica automată. Restaurarea altor secțiuni se face numai prin regulile de interacțiune configurate explicit.

Pregătirea eșuată a bufferului ascuns păstrează identitatea bufferului anterior; o pregătire ulterioară trebuie să rescrie setul complet. Un eșec după trimiterea unei comenzi de tranziție sau pierderea conexiunii cu grafica activă poate lăsa rezultatul necunoscut: NEEDS_RESYNC blochează PLAY-urile ulterioare. Nu există retry automat.

STOP-ul de recuperare încearcă toate destinațiile secțiunii. Resincronizarea manuală OFF/A/B/single modifică numai presupunerea controllerului, după verificarea operatorului; nu trimite comenzi și nu confirmă starea fizică. Este disponibilă și cu TCP deconectat, astfel încât operatorul să poată restabili presupunerea locală după verificarea instalației și apoi modifica o conexiune indisponibilă. În NEEDS_RESYNC, bufferul păstrat este afișat drept ultimul cunoscut, fără marcajul verde ACTIV. Editarea mapărilor funcționale sau schimbarea conexiunii cere secțiunile oprite; salvarea în timpul operațiilor este blocată. Redenumirea unei secțiuni nu schimbă destinațiile.

## Istoric, securitate și întreținere

[Proiectele](CODEX_MOS_PROJECTS.md) izolează secțiunile, starea A/B, cache-ul cererilor și jurnalul. Instalarea nouă nu are proiect activ; operatorul creează proiecte și alege manual proiectul activ. Orice proiect configurat pentru Plasma poate executa cereri; proiectele CSV sau lipsa proiectului activ blochează execuția fără comenzi. Activarea altui proiect este permisă numai fără operații în curs/coadă și cu toate secțiunile OFF. Nu există STOP, PLAY sau reconectare automată la activare. Editarea unui proiect inactiv nu resetează starea proiectului activ; istoricul păstrează proiectul capturat.

HTTP păstrează autentificarea, CORS și envelope-ul existent. Confirmarea 200 înseamnă recepție; raportul ulterior poate fi blocat sau eșuat. Rendererul primește actualizări tipizate ale istoricului și snapshotului; socketul, configurația și execuția rămân în main. Ștergerea istoricului nu resetează starea graficii și nu retrimite cereri.

Păstrează documentele pereche Plasma/LB-Portal și indexurile în aceeași intervenție. Modificările în controller, transport sau schema raportului cer teste de ordine A/B, erori, persistență și ingress. Nu introduce OSC sau dialecte StealthCG în fluxul LBC din această etapă.

## Verificări automate — 13 octombrie 2026

- **47 teste LB-Portal: PASS** — setări, validarea mapărilor, sugestii, capturarea mapării la ingress, controller și transport.
- TCP loopback: A/B/A cu seturi complete, eroare în bufferul ascuns fără tranziție, rescriere completă la următoarea încercare, eroare la RESUME, STOP pe ambele destinații chiar când prima eșuează, pierdere de conexiune, anularea estimării de ieșire și lipsa replay-ului la reconectare.
- Codec: numai cele patru comenzi LBC, escaping, UTF-8, limita de 65.536 bytes, răspunsuri fragmentate, reconectare fără callbacks vechi, timeout și răspunsuri duplicate.
- **11 teste ale contractului frontend Plasma: PASS** — envelope cu/fără `params`, control LIVE și recepție HTTP. Codul fluxului ENPS/import nu a fost modificat în această etapă.

Aceste rezultate verifică logica locală și transportul simulat. Nu sunt verificări ale output-ului unei instalații LiveBoard.

## Finalizare — 15 octombrie 2026

- **48 teste LB-Portal: PASS**, inclusiv testul de redare a raportului blocat pentru un template nemapat. Consola păstrează vizibile statutul, pașii și eroarea chiar dacă nu există o mapare validă.
- **11 teste frontend Plasma: PASS**, repetate la reluarea lucrului.
- Corecțiile vizuale separă etichetele raportului, permit citirea comenzilor pe ecrane înguste și păstrează bara de salvare în fluxul paginii, fără acoperirea controalelor. În starea incertă, bufferul anterior este marcat „ultimul cunoscut”.

Verificarea Electron izolată a trecut **61 de verificări**: HTTP și rapoarte în progres, A/B/A în simulare și TCP, parametri lipsă/invalizi, template nemapat, grafică fără parametri, estimarea de 6 secunde fără RESUME automat, protecția setărilor active, erori și STOP de recuperare, resincronizare offline, persistență, lipsa reconectării/replay-ului automat și afișare pe desktop/ecran îngust. Include verificări automate ale contrastului textului comenzilor în runtime și jurnalul manual; capturile actualizate au fost inspectate vizual. Capturile sunt descrise în ghidul receiverului simulat.

**Build final: PASS** — `npm run build -- --publish never` a finalizat TypeScript, bundle-urile Vite main/preload/renderer, dependențele native Electron și installerul NSIS x64. Fișierul generat este `release/0.1.0/Default Electron App-0.1.0-x64.exe`. Publicarea online și instalarea peste aplicația operatorului nu fac parte din această verificare.

Codul a fost scris cu agenți specialiști GPT-6-Luna; integrarea, revizia capturilor și documentația etapelor au fost finalizate în chatul principal. Modificările existente necomise au fost păstrate. Nu există o instalație LiveBoard locală pentru validarea video, a animațiilor sau a diacriticelor pe ClassX.

### Corecția salvărilor blocate — 15 octombrie 2026

Restricțiile de salvare pentru secțiuni active sau comenzi în curs sunt rezultate operaționale tipizate. Handlerul `settings:set` returnează codul și secțiunile afectate, fără să arunce o excepție pentru aceste cazuri. Editorul folosește metodele preload `trySaveMosMappings` și `trySaveLiveBoardConnection`, afișează instrucțiuni localizate și păstrează draftul. Protecția OFF rămâne activă, iar o setare refuzată nu este scrisă/aplicată. Erorile neașteptate și validarea senderului continuă să fie propagate; nu există suprimare globală a logurilor Electron.

- **56 teste relevante: PASS** — include refuzul tipizat înainte de persistență, lipsa notificării runtime, salvarea permisă după OFF, restricția în timpul operațiilor, păstrarea erorilor reale și traducerile RO/EN/RU.
- **67 verificări Electron izolate: PASS** — refuz de conexiune tipizat, avertizare localizată cu numele secțiunii, draftul de 500 ms păstrat și salvarea anterioară de 250 ms intactă, butonul disponibil pentru reîncercare, lipsa excepției de handler `settings:set` în stderr și salvare reușită după STOP.
- **Build NSIS x64: PASS** — `npm run build -- --publish never`. Installerul de la aceeași cale include corecția.

Captura avertizării este `%TEMP%\lbportal-settings-save-denied.png`; testul utilizează numai date temporare și nu modifică setările operatorului.

### Organizarea în proiecte — 15 octombrie 2026

Etapa este documentată în [contractul proiectelor](CODEX_MOS_PROJECTS.md): configurație v2 cu migrare, selecție activă manuală, Telejurnal/Retrospectiva pentru Plasma, proiecte independente și istoric izolat. **68 teste relevante LB-Portal, 11 teste Plasma și 110 verificări Electron: PASS**. Build-ul TypeScript/Vite/NSIS x64 este generat la aceeași cale. Capturile editorului și rapoartelor au fost revizuite; nicio setare a operatorului și nicio instalație LiveBoard reală nu au fost folosite în QA.

### Interacțiuni între secțiuni — 15 octombrie 2026

[Contractul interacțiunilor](CODEX_SECTION_INTERACTIONS.md) documentează regulile per proiect, evenimentele și acțiunile ordonate, suspendarea/revenirea pe același buffer, durata sursei executate și anularea la oprire sau stare incertă. Include pașii de configurare a exemplului Nume → Titluri și instrumentele dezvoltate. Editorul folosește lățimea ferestrei; aplicația pornește maximizată cu DevTools dezactivat.

**90 teste relevante LB-Portal, 12 teste frontend Plasma și 159 verificări Electron izolate: PASS. Build TypeScript/Vite/NSIS x64: PASS.** Cele două cazuri STOP cu rezultate mixte verifică jurnalizarea separată a fiecărei destinații. Proba Electron finală a folosit `--skip-captures`; rendererul compilat a fost verificat separat la 640/1280/1920 px, fără scroll orizontal, cu șapte capturi și revizie vizuală. Verificările folosesc HTTP real, TCP mock și setări temporare; output-ul video/animațiile pe LiveBoard real rămân de verificat pe instalație.
