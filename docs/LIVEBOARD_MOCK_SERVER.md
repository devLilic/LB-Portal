# Receiver TCP simulat LiveBoard

## Pornire

Receiverul este un proces Node separat, fără o altă aplicație Electron. Din `C:\Projects\LB-Portal`:

```powershell
npm run mock:liveboard
```

Ascultă pe `127.0.0.1:9010`. În Setările LB-Portal selectează TCP, host `127.0.0.1`, port `9010`, salvează și apasă Conectare în consolă. Oprește procesul cu Ctrl+C. Portul `9010` este numai convenția simulatorului, nu portul presupus al LiveBoard.

```powershell
npm run mock:liveboard -- --port 9011 --response-delay 200
npm run mock:liveboard -- --fail-match LBC_RESUMECONTENT
npm run mock:liveboard -- --fail-match LBC_RESUMECONTENT --fail-after 2
```

`--response-delay` întârzie răspunsurile în milisecunde; `--fail-match` produce un răspuns Error pentru comenzile care conțin textul dat. `--fail-after N` permite mai întâi N comenzi potrivite, apoi provoacă erori la următoarele; contorul aparține procesului mock. Exemplul cu `2` permite două schimbări A/B înaintea erorii la RESUME. Pentru un timeout, configurează o întârziere mai mare decât timeout-ul LB-Portal.

## Ce verifică

Receiverul emite Welcome, citește comenzile LBC, afișează în terminal argumentele decodate și răspunde OK sau Error. Permite verificarea transportului TCP real pe loopback, mapărilor, ordinii setterelor, PLAY/RESUME/STOP și reacției la erori. Nu redă grafica, animațiile Castalia sau output-ul video.

Simularea internă din LB-Portal este separată: execută mecanismul local și înregistrează comenzile fără niciun socket, cu răspunsuri marcate `SIMULATED OK`. Receiverul extern verifică suplimentar socketul și parserul clientului.

## Probă A/B

Alege mai întâi în consola LB-Portal proiectul Telejurnal sau Retrospectiva săptămânii. Selectarea proiectului în editorul de mapări nu îl activează. Un proiect pentru operare directă blochează execuția Plasma chiar dacă are destinații cu aceleași nume; receiverul mock nu trebuie să primească vreo comandă de la acea cerere.

1. Creează o secțiune cu două destinații și mapări distincte pentru câmpurile lor.
2. Trimite trei PLAY-uri Plasma cu valori diferite. Urmărește selecția A, B, A.
3. La schimbare, verifică setterele numai pe bufferul ascuns, pauza de propagare, RESUME pe bufferul vechi, pauza de tranziție și PLAY pe cel pregătit.
4. Repetă exact aceleași valori: raportul trebuie să indice că nu este necesară o nouă execuție.
5. Omite un parametru mapat: execuția trebuie blocată înainte de trimiterea câmpurilor.
6. Injectează Error la RESUME: secțiunea necesită resincronizare. STOP-ul de recuperare trebuie să încerce ambele destinații.

Pentru testele automate folosește `npm run test:unit -- tests/unit/liveboard tests/unit/ingress tests/unit/settings tests/unit/mosMappings`. Testele de loopback au nevoie de permisiunea de a deschide socketuri locale.

## Verificare Electron izolată

### Execuție și capturi independente

Pe sistemele unde compositorul Electron nu finalizează capturi ale ferestrei ascunse maximizate, rulează verificarea funcțională astfel:

```powershell
npm run qa:liveboard -- --skip-captures
node scripts/qa-renderer-layout.cjs
```

Prima comandă verifică aplicația Electron reală, HTTP/TCP, setările, temporizările și restartul; opțiunea indică explicit în rezultat că nu a scris capturi. A doua verifică rendererul compilat din `dist` într-un browser Chromium headless, cu configurație fictivă și API-uri preload simulate, pentru capturi și măsurători de layout. Nu contactează LiveBoard sau setările operatorului și nu constituie dovadă de execuție TCP.

Proba vizuală folosește Chrome instalat; calea poate fi schimbată prin `LBPORTAL_BROWSER_EXE`. Nu descarcă browserul sau alte pachete. Scriptul afișează directorul absolut al capturilor. Verificarea overflow-ului măsoară și deplasarea orizontală reală prin `scrollTo`, nu doar diferența dintre `innerWidth` și `clientWidth`.

Capturile probei headless sunt `settings-sections-{640,1280,1920}.png`, `settings-interactions-{640,1280,1920}.png` și `console-suspended-fixture-1280.png`. Referințele revizuite pentru etapa de interacțiuni sunt copiate local în `node_modules/.cache/lbportal-renderer-layout-final/`. Ele folosesc date fictive; cheia afișată nu este cheia operatorului. Verificarea finală a confirmat deplasare orizontală 0 și lipsa cheilor brute de traducere din consola interacțiunilor.

Etapa de interacțiuni extinde instrumentul cu reguli create în editor, ordonare și activare/dezactivare, validare locală și păstrarea draftului. Verifică suspendarea unui titlu pe bufferul B, revenirea pe exact același buffer după durata existentă de 6 secunde, păstrarea câmpurilor, ținta OFF fără revenire inventată și anularea la STOP ori pierderea socketului. Verifică și pornirea maximizată cu DevTools dezactivat, selectorul proiectului și layout-ul la 640/1280/1920 px.

Capturile suplimentare sunt `%TEMP%\lbportal-interactions-wide.png`, `%TEMP%\lbportal-interactions-narrow.png`, `%TEMP%\lbportal-section-editor-wide.png` și `%TEMP%\lbportal-interactions-runtime.png`. Detaliile comportamentului sunt în [contractul interacțiunilor](CODEX_SECTION_INTERACTIONS.md). Aceste probe folosesc instanța Electron izolată și setări temporare.

Etapa de proiecte extinde același instrument cu migrarea configurației plate, izolarea acelorași template-uri între proiecte, activare explicită, refuzul schimbării cu secțiuni active/comenzi în curs, creare–redenumire–ștergere de proiecte directe și secțiuni fără surse Plasma. Verifică și blocarea Plasma fără trafic TCP, contextul istoric după redenumire/ștergere și persistența proiectului activ la restart fără replay. Captura `%TEMP%\lbportal-project-settings-narrow.png` prezintă editorul unui proiect pentru operare directă.

După build, `npm run qa:liveboard` pornește o instanță Electron cu userData temporar, un port HTTP local separat și receiverul TCP mock. Instrumentul `scripts/qa-liveboard.cjs` verifică A/B/A, rapoartele, erorile, recuperarea, setările și restartul; păstrează setările operatorului intacte. Verifică și resincronizarea locală când TCP este deconectat, fără trimiterea vreunei comenzi. Ferestrele de verificare sunt ascunse, iar capturile de UI sunt salvate în `%TEMP%`:

- `lbportal-liveboard-report-desktop.png` și `lbportal-liveboard-report-narrow.png` — raportul unei execuții cu pași, nu doar al unei cereri identice omise.
- `lbportal-liveboard-runtime.png` — starea care necesită resincronizare.
- `lbportal-liveboard-manualjournal.png` — jurnalul comenzilor manuale.
- `lbportal-liveboard-settings-desktop.png` și `lbportal-liveboard-settings-narrow.png` — editorul și conexiunea.

Datele temporare ale instanței sunt șterse la final; capturile rămân în `%TEMP%`. Instrumentul cere dependențele locale Playwright/Electron și permisiunea socketurilor loopback; nu se conectează la o instalație LiveBoard reală și nu afișează cheia HTTP.

Verificarea din 15 octombrie 2026 a trecut **61 de verificări**, inclusiv contrastul comenzilor, rapoartele blocate fără mapare și resincronizarea locală offline. Build-ul și installerul au fost generate cu succes; vezi [rezultatele etapei](CODEX_LIVEBOARD_EXECUTION.md#finalizare--15-octombrie-2026).

După corecția tratării salvărilor blocate, instrumentul trece **67 de verificări**. Verifică și mesajul localizat, păstrarea draftului și a setărilor salvate, reîncercarea după STOP și absența excepției Electron `settings:set` din stderr. Captura suplimentară este `%TEMP%\lbportal-settings-save-denied.png`.

După etapa de proiecte, instrumentul trece **110 verificări**. Rezultatele detaliate sunt în [contractul proiectelor](CODEX_MOS_PROJECTS.md#rezultate--15-octombrie-2026). Capturile suplimentare ale proiectului independent sunt `%TEMP%\lbportal-project-standalone-runtime.png` și `%TEMP%\lbportal-project-standalone-report.png`; includ avertizarea de blocare Plasma și identitatea istorică a proiectelor.

După etapa de interacțiuni, verificarea finală trece **159 verificări Electron**, cu `--skip-captures`. Proba separată a rendererului compilat trece la 640/1280/1920 px și furnizează cele șapte capturi revizuite. **90 teste relevante LB-Portal, 12 teste Plasma și build-ul TypeScript/Vite/NSIS: PASS.** Rezultatele și delimitarea față de verificarea video reală sunt în [contractul interacțiunilor](CODEX_SECTION_INTERACTIONS.md#verificări-ale-implementării--15-octombrie-2026).
