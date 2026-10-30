# OnAir: importul CSV per proiect

## Rol și sursă

OnAir este zona de lucru pentru operatori, alături de Consolă și Setări. Selectorul unic din bara OnAir alege proiectul ale cărui CSV-uri sunt consultate și proiectul care poate fi activat pentru execuție. Alegerea nu schimbă singură proiectul activ; operatorul apasă explicit „Activează proiectul”. Activarea nu trimite comenzi LiveBoard.

În Setări, proiectul salvează opțional folderul `onAirCsv.folderPath`. Pentru fiecare secțiune se poate alege o categorie grafică, un fișier CSV detectat în acel folder și coloana detectată care furnizează fiecare câmp semantic al categoriei. Antetele sunt citite în Electron main; UI nu cere tastarea numelor de coloane. Secțiunile fără sursă CSV sunt permise. Aplicația citește numai fișierele selectate de secțiuni și deduplică citirea când același fișier este folosit de mai multe secțiuni. Numele fișierelor și antetele nu sunt impuse de aplicație. Salvarea configurației nu citește fișierele; Refresh în OnAir le citește. Ștergerea folderului dezactivează sursa. Configurațiile v2 vechi fără sursă per secțiune rămân valide, însă nu mai declanșează citirea exporturilor până când secțiunile sunt configurate.

Grupurile sunt prezentate în taburi. „Invitați (Platou)” este primul și selectat inițial; apoi urmează beta-urile în ordinea exportului. Dacă exportul nu are grup de invitați, interfața păstrează un tab gol pentru platou, fără să inventeze înregistrări în snapshot. Alegerea manuală a unui beta se păstrează la Refresh dacă grupul continuă să existe. Supratitlul este afișat deasupra titlului.

Titlurile au o coloană comună pentru numărul `Nr` și un bloc de text cu supratitlul deasupra titlului, ambele aliniate la aceeași margine stângă. Numărul este afișat o singură dată pentru întregul set, exact cum vine din CSV, inclusiv zerourile inițiale, într-un chenar cu colțuri rotunjite întins pe întreaga înălțime a blocului de text. Cifra este centrată în chenar; lipsa numărului nu este înlocuită cu poziția din listă și nu afișează un chenar gol.

OnAir include o bară îngustă de instrumente fixată în stânga viewportului, cu buton pătrat Refresh CSV reprezentat prin icon. Butonul rămâne accesibil la derularea listelor lungi și apelează aceeași operație pentru proiectul selectat ca butonul din antet. Stările indisponibil/încărcare sunt comune; bara are etichete accesibile și spațiu rezervat pentru a nu acoperi conținutul. Refresh-ul rămâne explicit și păstrează tabul selectat când acesta există în noul import.

Lista lungă de titluri are propriul scroll vertical, limitat la spațiul disponibil deasupra barei fixe de jos. Containerul folosește dimensionare `border-box` și spațiu suplimentar după ultimul card, astfel încât derularea până la capăt să lase ultimul titlu complet vizibil, fără să fie decupat de panoul grupului. Verificarea rendererului acoperă acest caz cu 20 de titluri.

Folderul de pe calculatorul de dezvoltare pentru Punctul pe Azi este `C:\Projects\_CSV\PA\Export`. Calea este o setare locală a proiectului, nu o constantă de import și nu o cale implicită pentru celelalte proiecte.

## Categorii grafice și coloane CSV

| Fișier | Coloane necesare | Semnificație |
| --- | --- | --- |
| Categorie | Câmpuri semantice configurabile | Semnificație |
| --- | --- | --- |
| `titles` | `Nr`, `Titlu`, `Supratitlu`, `Template` | Titluri în ordinea exportată, numerotate în interiorul grupului. |
| `persons` | `Sectiune`, `Nume`, `Functie`, `Template` | Persoane grupate editorial. |
| `locations` | `Locatie`; opțional `Template` | Locațiile grupului INVITAȚI. |
| `phones` | `Nume`, `Functie`, `Image`; opțional `Template` | Intervenții telefonice din INVITAȚI. |
| `waitTitlesLocations` | `Titlu`, `Locatie`, `Template` | O singură grafică cu titlul și locația de așteptare. |

Valorile de template din rânduri sunt păstrate exact. Mapările OnAir folosesc cheia `sourceTemplate` exactă. Numele fișierelor, numele coloanelor și template-urile sunt configurate și păstrate separat.

Fiecare secțiune indică exact fișierul și asocierile dintre câmpurile categoriei și antetele CSV. Pot exista mai multe fișiere cu aceeași categorie; rândurile lor se reunesc în categoria graficii. Fișiere nealese nu sunt căutate, verificate sau citite. Pentru grafica combinată, template-ul comun este cheia unică pentru ambele valori; maparea oferă câmpurile `Titlu` și `Locatie`.

Semantica a fost verificată în exportatorul csvEditor-PA (`paEntityExportMapper.ts`). Rândurile `--- ... ---` sunt markeri de grup în prima coloană a exporturilor de titluri/persoane. Titlurile și persoanele sunt liste independente; nu se corelează după poziție sau număr. Grupurile comune se reunesc după marker și se păstrează ordinea sursei, inclusiv duplicatele valide. Locațiile și intervențiile apar la INVITAȚI. Grupurile repetate nu trebuie comprimate accidental.

Importul folosește UTF-8 și delimitatorul `;`, cu suport pentru BOM, ghilimele escapate, delimitatori și newline-uri în celule. Textele și numele template-urilor se păstrează. Un fișier cu numai antet reprezintă o listă goală validă. Fiecare element păstrează fișierul și poziția sursă pentru diagnostic.

## Refresh și memorie

Citirea CSV-urilor începe exclusiv la Refresh. Deschiderea OnAir, schimbarea proiectului și alegerea/salvarea folderului nu citesc exporturile. Snapshoturile sunt separate după ID-ul proiectului și rămân în memorie în sesiunea curentă, inclusiv la navigare. Repornirea aplicației cere un nou Refresh.

Un snapshot se publică după citirea și validarea tuturor fișierelor distincte selectate în secțiuni. Dacă nu este selectat niciun fișier, Refresh publică un snapshot gol fără acces la folder. O eroare de citire/parsare păstrează ultimul import reușit al aceleiași surse și este afișată alături de el. Schimbarea folderului, a unui nume de fișier, a categoriei sau a coloanelor invalidează snapshotul sursei anterioare. Răspunsurile întârziate nu trebuie să publice date în alt proiect sau într-o sursă schimbată între timp.

Importatorul verifică metadatele fișierelor înainte și după citire și reia limitat operația dacă sursa se modifică. Exportatorul nu furnizează un identificator comun de lot sau un manifest tranzacțional: stabilitatea fișierelor reduce riscul de citire în timpul scrierii, dar nu dovedește că toate fișierele sunt din aceeași generație.

## Securitate și pregătirea pentru LiveBoard

Filesystemul și parserul aparțin Electron main. Preload expune numai operații tipizate pentru lista proiectelor, alegerea folderului, listarea fișierelor CSV și citirea antetelor, snapshot, Refresh și PLAY/RESUME de element OnAir după ID de proiect. Main validează expeditorul IPC și limitează listarea la fișiere CSV, iar antetele sunt citite numai pentru un nume simplu aflat în folderul ales. Rendererul nu primește API Node sau citire arbitrară de fișiere. Fotografiile sunt deocamdată reprezentate prin calea text, fără încărcare de URL-uri din CSV.

`Template` este cheia sursă a graficii, păstrată exact din CSV. În Setări → proiect → Mapări CSV OnAir, operatorul selectează un tip și template detectat în importul deja încărcat, alege secțiunea LiveBoard și configurează câmpurile pentru fiecare destinație A/B existentă. Fila este disponibilă numai pentru proiectele configurate în modul Fișiere CSV. Consultarea catalogului folosește numai memoria; exporturile se citesc în continuare exclusiv prin Refresh în OnAir. Nu se presupune că numele template-ului CSV este și numele contentului LiveBoard.

Mapările sunt salvate în proprietatea opțională `onAirMappings` a proiectului. Cheia unei mapări este perechea tip de element + nume template efectiv; destinațiile sunt referințe la secțiunile și targeturile proiectului. Parametrii disponibili sunt `Titlu`/`Supratitlu`, `Nume`/`Functie`, `Locatie`, `Nume`/`Functie`/`Image`, respectiv `Titlu`/`Locatie` pentru grafica de așteptare combinată. O mapare poate utiliza un câmp CSV sau două câmpuri CSV unite într-o singură valoare destinație. Al doilea câmp este opțional; separatorul este configurabil și implicit `, `. Dacă una dintre valori este goală, cealaltă este trimisă fără separator. Textele își păstrează forma și majusculele din CSV, fără transformare de casing. O valoare compusă poate alimenta mai multe câmpuri destinație. Resolverul comun produce template-urile și valorile câmpurilor LiveBoard, afișate în OnAir pentru verificare.

Mapările nu sunt surse MOS și nu modifică resolverul receiverului Plasma. Proiectele existente fără această proprietate rămân valide; adaptorul legacy o păstrează. Duplicarea proiectului copiază configurația cu identificatori noi și referințe refăcute către propriile secțiuni/targeturi. Destinațiile referite nu pot fi eliminate lăsând mapări orfane. Salvarea exclusivă a mapărilor OnAir păstrează runtime-ul și temporizatoarele existente.

Fiecare element poate fi executat explicit cu PLAY și, cât timp este chiar elementul activ, cu Resume. Preload-ul expune `onAirApi.playItem({ projectId, kind, itemId, sourceTemplate, values, action })`; răspunsul întoarce aceleași `itemId`, `kind`, `sourceTemplate` și raportul controllerului. Rendererul trimite numai valorile PA; main validează expeditorul, verifică proiectul activ și rezolvă din nou maparea salvată înainte de a folosi controllerul LiveBoard existent. Proiectele standalone permit aceste acțiuni manuale OnAir; restricția pentru cererile Plasma rămâne neschimbată.

PLAY folosește destinațiile A/B, câmpurile, propagarea datelor și întârzierile secțiunii configurate. Durata și modul de ieșire provin din sursa secțiunii al cărei template coincide exact cu template-ul OnAir efectiv; fără o astfel de sursă configurată, elementul este manual. Resume verifică în main că proiectul, sursa, bufferul activ și valorile bufferului corespund elementului cerut. Resume-ul manual este blocat pentru o grafică activă cu durată automată configurată. Aceste comenzi folosesc numai transportul TCP LBC al controllerului; nu schimbă contractul HTTP Plasma și nu introduc OSCon/OSC.

Template-ul trebuie furnizat de coloana `Template` pentru categoria respectivă. Nu există template implicit de proiect pentru locații sau intervenții telefonice.

OnAir nu produce cereri HTTP către Plasma. Din selectorul unic OnAir se poate activa explicit orice proiect creat sau importat; schimbarea selecției singură nu activează proiectul. Dacă nu există niciun proiect activ, acțiunile de execuție așteaptă activarea unuia. Activarea folosește verificările runtime existente și nu trimite comenzi LiveBoard. Pentru PLAY/RESUME explicit, proiectul selectat în OnAir trebuie să fie și proiectul activ în LiveBoard. Butonul fiecărui element trimite către Electron main doar ID-ul proiectului, tipul/template-ul și valorile CSV, iar main revalidează maparea salvată și execută prin coada și controllerul LiveBoard existente, cu A/B, pauzele și regulile de durată configurate. În modul simulare comenzile nu folosesc socket; în modul TCP sunt trimise prin LBControl. Câmpurile destinație nu sunt acceptate de la renderer. Resume este permis numai pentru grafica acelui element, identificată prin template și valorile bufferului activ. Dacă în secțiune este activ alt element, PLAY rămâne disponibil pentru trecerea la destinația A/B următoare. Fiecare mapare OnAir își salvează separat modul de ieșire manual sau prin durată de template și durata. Ieșirea automată nu poate fi închisă manual din butonul OnAir. Contractul HTTP Plasma, autentificarea și CORS nu se schimbă. Nu se introduce OSCon/OSC.

## Verificare

### Surse configurabile per secțiune — 27 octombrie 2026

Setarea proiectului păstrează folderul de lucru; prefixul global, bifa pentru fișierul combinat și template-urile implicite pentru locații/intervenții au fost eliminate. Fiecare secțiune CSV indică opțional categoria graficii, fișierul ales din lista folderului și antetele detectate pentru câmpurile semantice ale categoriei. Unicitatea fișierelor se deduplică la Refresh, iar fișierele neselectate nu sunt inspectate. Secțiunile fără sursă produc liste goale. Configurațiile v2 vechi rămân valide, dar nu mai încarcă automat fișierele PA.

Verificare: **32 teste OnAir/setări trecute**, `npx tsc --noEmit` și buildurile Vite pentru renderer/main/preload trecute. `node --check` pentru QA scripts a trecut. Proba browser Edge și proba Electron nu au pornit în acest mediu (`Process failed to launch`/Crashpad). Împachetarea NSIS a oprit la rezolvarea DNS `github.com` (`ENOTFOUND`), chiar cu distribuția Electron locală; nu s-a publicat și nu s-a creat release.

### Selectare fișier și antete detectate — 27 octombrie 2026

Editorul de surse per secțiune enumeră numai fișierele `.csv` din folderul proiectului. După selectarea fișierului, UI afișează antetele citite de Electron main ca opțiuni pentru câmpurile semantice ale categoriei. Nu mai cere tastarea numelui fișierului sau a antetelor. Maparea semantică a valorilor către câmpurile LiveBoard rămâne în fila separată **Mapări CSV OnAir**. Fișierele și antetele sunt citite de operații IPC înguste; rendererul nu primește acces direct la sistemul de fișiere.

Verificare: `npx tsc --noEmit` a trecut după conectarea API-urilor listare fișiere/antete și a selecțiilor din editor. Testele automate nu au fost rulate în această intervenție.

### Corecție PLAY pentru nume și funcție — 22 octombrie 2026

Ruta locală PLAY/RESUME folosește valorile destinație deja compuse de resolverul comun, inclusiv al doilea câmp CSV și separatorul salvat. Nu reconstruiește valoarea numai din primul câmp. Pentru `Nume` + `Functie`, separator `, ` și destinațiile `Nume`/`Nume_M`, ambele câmpuri primesc exact `IRINA BEJENARU, jurnalist TVR Moldova`. Regulile distincte care pornesc din aceeași coloană CSV pot avea compoziții diferite fără conflict între parametrii interni ai controllerului. Resume verifică aceleași valori compuse ca PLAY.

Configurare: cheia sursă rămâne template-ul exact din CSV (`02_Nume` în exportul PA verificat); contentul destinație trebuie configurat cu numele exact încărcat în LiveBoard (`PA_02_Nume` dacă acesta este numele real). O singură regulă trimite aceeași valoare compusă către ambele destinații text. După salvare și repornirea versiunii actualizate LB-Portal, se reîncarcă CSV și se execută din nou PLAY; bufferul deja activ nu se rescrie prin simpla salvare a mapării.

Verificare: **92 teste trecute în 15 fișiere**, pentru OnAir, ingress, controller/transport LiveBoard și setările sursei CSV. Regresia nouă `tests/unit/onair/registeredPlayback.spec.ts` a reprodus pierderea funcției înainte de corecție și verifică handlerul IPC înregistrat cu controllerul real în simulare: valorile compuse egale în `Nume`/`Nume_M`, trecerea A/B, separator alternativ, reguli cu aceeași sursă primară, câmp sursă gol, mapare simplă și Resume. Testele TCP folosesc numai servere localhost; sandboxul a blocat inițial conexiunile cu `EACCES`, apoi aceeași suită a trecut cu permisiunile necesare. Nu s-a verificat output video fizic.

Compilarea TypeScript și bundle-urile Vite renderer/main/preload au trecut. Împachetarea inițială a eșuat la DNS `github.com`; reluarea `npx electron-builder --publish never --config.electronDist=node_modules/electron/dist` cu accesul necesar a trecut și a generat installerul actualizat `release/0.1.0/LB-Portal-0.1.0-x64.exe`. Nu s-a publicat release și nu s-au modificat setările operatorului ori fișierele CSV.

Testele acoperă parserul, grupurile, izolarea proiectelor, păstrarea snapshotului la eșec, schimbarea sursei și răspunsurile întârziate, configurația salvată și navigarea cu draft nesalvat. Build-ul verifică integrarea main/preload/renderer. Probele nu confirmă output video fizic pe LiveBoard.

### Acțiuni locale PLAY/RESUME și instrumente fixe — 22 octombrie 2026

Bara OnAir ocupă înălțimea viewportului, iar Refresh CSV are 48 × 48 px. Fiecare element mapat oferă PLAY sau Resume după starea secțiunii LiveBoard și dacă bufferul activ conține exact template-ul și valorile acelui element. Un alt element activ permite PLAY cu tranziția A/B. Proiectul greșit, ocuparea secțiunii, resincronizarea necesară ori durata automată a elementului curent dezactivează acțiunea cu un indiciu explicativ. Modul de ieșire și durata sunt configurate per mapare OnAir, separat de schema/setările MOS Telejurnal. PLAY/RESUME folosește numai controllerul LiveBoard existent din Electron main; această operație locală nu este o cerere Plasma și nu schimbă payloadul HTTP sau bridge-ul de ingress. Proiectele standalone sunt acceptate numai pe ruta OnAir explicită.

Verificare la 22 octombrie 2026: **33 teste relevante în 4 fișiere trecute**, `npx tsc --noEmit` și verificarea whitespace au trecut. Compilările TypeScript și bundle-urile Vite pentru renderer/main/preload au trecut. Împachetarea NSIS s-a oprit când electron-builder a încercat accesul la `github.com` și DNS a răspuns `ENOTFOUND`; pachetul instalabil nu a fost generat. Testele includ modul de ieșire configurat OnAir, template-uri cu mapare numai în B, Resume doar pe elementul activ, protecția duratei automate și execuția manuală standalone fără a permite cererile Plasma în proiecte standalone.

### Ajustări vizuale: număr comun și instrumente fixe — 21 octombrie 2026

Compilarea TypeScript/Vite și împachetarea NSIS au trecut pentru afișarea numărului comun și bara fixă Refresh CSV. Bara are lățimea de 28 px, buton de 24 × 24 px și spațiu rezervat de 32 px în OnAir. Numărul folosește o coloană de 3,5 caractere și este centrat pe înălțimea blocului supratitlu/titlu. Citirea CSV, mapările, IPC și controllerul folosesc fluxurile existente. Rezultatele testelor de mai jos aparțin extinderii anterioare cu taburi și mapări.

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

`node scripts/qa-onair-renderer.cjs` folosește distribuția instalată Edge, un server static peste `dist` și API-uri fictive. Verifică selectorul unic de proiect, activarea explicită și separarea selecției de activare, răspunsurile întârziate, lipsa Refresh-ului implicit, invalidarea sursei, observarea repetată a stării unei operații deja pornite și layoutul la 640/1280/1920 px. Citirile repetate ale snapshotului cât timp acesta este `busy` nu inițiază un nou import. Capturile sunt în `node_modules/.cache/onair-qa/` și nu se comit.

Pe acest calculator, împachetarea standard a întâmpinat `EPERM` la redenumirea directorului temporar al arhivei Electron. Împachetarea a reușit folosind distribuția deja instalată, aceeași versiune 33.4.11: `npm run build -- --publish never --config.electronDist=node_modules/electron/dist`. Nu se schimbă versiunea runtime și nu se publică un release GitHub.

Actualizare 24 octombrie 2026: proiectele pot salva opțional grafici fixe precum logo sau burtieră cu nume/funcție constante. Acestea sunt definite în Setări pentru o secțiune LiveBoard, cu valori și câmpuri destinație pe template A/B. OnAir le afișează separat de datele CSV și permite PLAY chiar fără snapshot încărcat. Main verifică proiectul activ și citește graficul salvat; apelul folosește controllerul existent și nu trimite cerere Plasma sau CSV.
OnAir afișează directorul de export lipsă numai pentru proiectele CSV. Pentru proiectele în modul `plasma.test`, zona de date arată mesajul „Proiect controlat din Plasma”; grafica fixă configurată în proiect rămâne disponibilă în OnAir.
