# Interacțiuni configurabile între secțiuni

## Scop

Fiecare proiect poate defini reguli între propriile secțiuni. Regulile nu sunt legate de numele „Titluri” sau „Nume” în cod. Configurația inițială nu introduce interacțiuni presupuse; operatorul le creează și le salvează explicit.

Exemplu pentru Retrospectiva săptămânii: înainte de PLAY pe secțiunea Nume, suspendă secțiunea Titluri prin RESUME, așteaptă pauza configurată și continuă PLAY Nume. La ieșirea automată a graficii Nume, readuce titlul suspendat prin PLAY.

**Revenirea folosește durata deja configurată pentru sursa MOS executată.** Dacă acea grafică are 6 secunde, evenimentul de ieșire este programat după 6 secunde de la acceptarea PLAY. Regula nu conține altă durată. LiveBoard execută ieșirea propriei animații; LB-Portal nu trimite RESUME sau STOP la expirarea unei grafici automate. Nu există o regulă specială pentru nume consecutive.

## Editor

La pornire, fereastra LB-Portal este maximizată, cu controalele normale ale sistemului de operare. DevTools este dezactivat și nu se deschide la lansare. Suprafața de lucru folosește lățimea disponibilă, cu spații laterale și adaptare pentru ecrane înguste; nu forțează modul kiosk.

În Setări, operatorul alege proiectul de editat, apoi Secțiuni sau Interacțiuni. Alegerea proiectului de editat nu activează proiectul în consolă. Draftul cuprinde secțiunile, regulile și conexiunea, cu salvare explicită și avertizare la abandonare.

Editorul secțiunilor separă identitatea secțiunii, destinațiile/grupurile A/B, timpii și sursele MOS cu mapările și modul de ieșire. Durata rămâne lângă sursa cu ieșire automată, unde se configurează și înainte de această etapă.

O regulă are denumire, activare/dezactivare, secțiune declanșatoare, eveniment și acțiuni în ordinea configurată. Acțiunile selectează secțiuni și destinații existente prin identificatori stabili; redenumirea nu rupe legăturile.

### Configurarea exemplului Nume → Titluri

1. În Setări, selectează proiectul Retrospectiva săptămânii și configurează secțiunile Nume și Titluri cu destinațiile și mapările lor.
2. La sursa MOS pentru Nume, selectează ieșirea automată și durata dorită, de exemplu 6 secunde.
3. În fila Interacțiuni, adaugă o regulă activată, cu secțiunea declanșatoare Nume și evenimentul „Înainte de PLAY”.
4. Adaugă acțiunea „Suspendă temporar”, secțiunea vizată Titluri și revenirea la „Ieșire automată”. Întârzierea în milisecunde este doar pauza după suspendare; nu introduce aici cele 6 secunde.
5. Salvează setările. În consolă, activează proiectul potrivit, pornește un titlu, apoi trimite PLAY pentru Nume din Plasma.

LB-Portal scoate titlul activ, pornește Nume și readuce titlul pe același buffer după durata configurată. Nu este necesară o a doua regulă PLAY pentru această revenire. Dacă Titluri era OFF, nu apare un titlu inventat. Pentru probe fără instalație LiveBoard, folosește simularea sau receiverul TCP mock descris în [ghidul de verificare](LIVEBOARD_MOCK_SERVER.md).

| Eveniment | Moment |
| --- | --- |
| Înainte de PLAY | Înaintea pornirii graficii cerute, după validarea datelor necesare. |
| După RESUME manual | După scoaterea reușită a graficii secțiunii. |
| După STOP | După oprirea reușită a secțiunii. |
| După ieșirea automată | La expirarea duratei configurate pentru sursa executată. |

| Acțiune | Comportament |
| --- | --- |
| RESUME | Scoate grafica activă a secțiunii vizate. |
| STOP | Oprește destinațiile secțiunii vizate. |
| Suspendare cu revenire | Memorează grafica activă, o scoate prin RESUME și o readuce la evenimentul de ieșire selectat al secțiunii declanșatoare. Disponibilă înainte de PLAY. |
| PLAY | Pornește destinația selectată a secțiunii vizate, fără a inventa valori pentru câmpuri necunoscute. |

Pauza unei acțiuni este intervalul până la continuarea secvenței. Nu reprezintă durata graficii. Regulile permit ordine explicită de acțiuni, fără JavaScript sau alte scripturi introduse de operator.

## Stare și revenire

Un titlu suspendat păstrează destinația, bufferul și valorile sale. Revenirea aceluiași titlu folosește PLAY pe acel buffer; nu reprezintă o alternare A/B. Consola îl arată suspendat, cu secțiunea care l-a suspendat și revenirea în așteptare, fără a-l marca activ în emisie.

Pe o secțiune suspendată, butonul „Anulează revenirea” anulează local revenirea și cererea în așteptare; nu trimite un al doilea RESUME către grafica deja ascunsă. STOP continuă să trimită comanda de oprire către destinațiile secțiunii. Cererile înlocuite sau anulate primesc un rezultat final explicit în jurnal, nu rămân permanent în coadă.

Dacă secțiunea vizată era OFF, nu se inventează un titlu de readus. Un PLAY nou pentru titlul suspendat pregătește conținutul de afișat la revenire. Oprirea sau resincronizarea explicită a titlului anulează revenirea lui. Ieșirea automată nu blochează coada globală pe durata celor 6 secunde: la expirare, operația se execută în aceeași coadă serializată ca celelalte comenzi.

Schimbarea proiectului, resetarea, închiderea aplicației, pierderea conexiunii sau o eroare care face tranziția incertă nu trebuie să lase o revenire întârziată activă. Recuperarea cere starea locală potrivită; nu există replay automat. Secțiunile suspendate și revenirile în așteptare protejează setările și schimbarea proiectului la fel ca secțiunile active.

Acțiunile generate de reguli nu declanșează recursiv alte reguli. Jurnalul identifică regula, secțiunea declanșatoare, secțiunea afectată și comenzile/răspunsurile, inclusiv revenirea automată. HTTP 200 rămâne numai confirmarea recepției cererii Plasma; acceptarea TCP rămâne distinctă de output-ul video observat.

## Validare și compatibilitate

Regulile sunt salvate în proiect, în configurația canonică v2 existentă. Configurațiile fără reguli rămân valide și nu își schimbă comportamentul. Adaptoarele vechi de mapări plate păstrează regulile proiectului; ștergerea unei secțiuni referite nu elimină regula în tăcere.

Reordonarea listei secțiunilor păstrează identificatorii și referințele regulilor. Duplicarea proiectului copiază regulile și acțiunile în aceeași ordine, cu identificatori noi și referințe către secțiunile/destinațiile copiate; nu creează legături către proiectul original. Fluxul editorului este descris în [contractul proiectelor](CODEX_MOS_PROJECTS.md#duplicarea-și-ordinea-secțiunilor).

Validarea în main verifică numele și identificatorii, referințele către secțiuni/destinații, pauzele, compatibilitatea acțiunilor și evenimentelor, conflictele și autoreferințele. Acțiunile unei reguli nu declanșează alte reguli, deci traseele reciproce între reguli nu formează un ciclu de execuție. De exemplu, două reguli „Înainte de PLAY” care fac fiecare RESUME pe cealaltă secțiune sunt valide și rămân independente. Referințele între proiecte și acțiunile asupra propriei secțiuni declanșatoare nu sunt permise. Rendererul prezintă problemele înainte de salvare, însă nu este autoritatea pentru validare sau execuție.

## Întreținere

### Instrumente și etape

| Componentă | Implementare |
| --- | --- |
| Model și validare | `src/shared/settings/mosInteractions.ts` — evenimente, acțiuni, referințe, ordonare, conflicte și autoreferințe. |
| Proiect și persistență | `src/shared/settings/mosProjects.ts` și settings store — reguli opționale, compatibilitate cu v2 și păstrare la editarea mapărilor plate. |
| Execuție | `electron/main/liveboard/controller.ts` — evenimente primare, suspendare, revenire și anularea operațiilor întârziate. |
| Contractul consolei | `src/shared/liveboard/runtime.ts` — stare SUSPENDED, revenire în așteptare și proveniența operațiilor. |
| Editor și jurnal | `MosMappingsSettings.tsx`, `LiveBoardConsole.tsx`, `MosMappingReport.tsx` — configurare și explicații RO/EN/RU. |
| Layout | `src/features/mos-mappings/mos-mappings.css`, `src/features/ingress/console.css` — conținut pe lățimea ferestrei și rearanjare pe ecrane înguste. |
| Pornire Electron | `electron/main/bootstrap/createMainWindow.ts` — maximizare și DevTools dezactivat. |
| Verificare | Testele unitare de setări/controller și `scripts/qa-liveboard.cjs` — instanță Electron izolată, receiver HTTP real, TCP mock și capturi. |
| Verificare vizuală fără fereastră | `scripts/qa-renderer-layout.cjs` — rendererul compilat în Chromium headless, cu date fictive și API-uri preload simulate, pentru layout și capturi la 640/1280/1920 px. Nu înlocuiește testul de execuție Electron/TCP. |

Scrierea codului și extinderea instrumentelor de verificare sunt realizate cu agenți GPT-6-Luna. Integrarea, revizia și documentarea etapelor sunt gestionate în chatul principal. Setările operatorului nu sunt folosite pentru probele automate.

Păstrează sincronizate modelul regulilor, controllerul, editorul, jurnalul și testele. Actualizează acest document, contractele de execuție/ingress/editor, indexul LB-Portal și documentul/indexul Plasma în aceeași intervenție. Nu schimba envelope-ul HTTP, autentificarea sau transportul LBC pentru această funcție.

Verifică durata configurată, revenirea exactă A/B, acțiunile și evenimentele, lipsa recursivității, anularea temporizărilor, erorile, izolarea proiectelor, persistența și editorul pe ecrane de 640, 1280 și 1920 px. Receiverul TCP mock permite verificarea offline a comenzilor; animația și output-ul LiveBoard real necesită verificare pe instalație.

### Verificări ale implementării — 15 octombrie 2026

- **90 teste relevante LB-Portal: PASS**, în 16 fișiere. Include validarea/persistența regulilor, durata exactă de 6 secunde, păstrarea bufferului și câmpurilor, cereri de titlu în așteptare, anulare locală fără RESUME suplimentar, STOP pe toate destinațiile, evenimente și acțiuni generice fără recursivitate, date lipsă și prevalidare înainte de efecte, refuzul editării cu secțiuni active/suspendate, anularea revenirilor la STOP/resincronizare și eșec după suspendare. Două regresii verifică răspunsurile separate ale destinațiilor STOP când prima reușește/a doua eșuează și invers; un rezultat agregat eșuat nu rescrie confirmarea corectă a altei destinații.
- **12 teste frontend ale contractului Plasma: PASS.** Codul ENPS și importul HTM nu au fost modificate pentru această etapă; modificările existente sunt păstrate.
- **Build TypeScript/Vite/NSIS x64: PASS**, `npm run build -- --publish never`. Installerul rezultat este `release/0.1.0/Default Electron App-0.1.0-x64.exe`.
- **Renderer compilat și revizie vizuală: PASS.** Editorul Secțiuni și Interacțiuni la 640/1280/1920 px și consola la 1280 px au deplasare orizontală maximă 0. Cele șapte capturi finale au fost generate cu `scripts/qa-renderer-layout.cjs`; au fost revizuite editorul larg și îngust, mapările A/B și consola cu titlu suspendat. Etichetele de stare/acțiune/proveniență sunt traduse și jurnalul arată denumirea salvată a secțiunii sursă. Capturile de referință se află local în `node_modules/.cache/lbportal-renderer-layout-final/`; datele sunt fictive.
- **159 verificări Electron izolate: PASS**, `npm run qa:liveboard -- --skip-captures`, pe bundle-urile finale. Include pornirea maximizată, refuzul deschiderii DevTools, creare/editare/ordonare/activare și persistență a regulilor din editor, revenirea exactă pe B după 6 secunde cu aceleași câmpuri, ținta OFF fără revenire inventată, anularea la STOP și prin „Anulează revenirea”, pierderea conexiunii fără PLAY întârziat, proiecte, restricții de salvare, HTTP/TCP mock, recuperare și restart fără replay. Capturile Electron au fost omise explicit din cauza limitării compositorului pentru fereastra ascunsă; proba headless de mai sus furnizează capturile separat. Setările operatorului și o instalație LiveBoard reală nu au fost folosite.
