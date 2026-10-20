# LiveBoard TCP: comenzi și surse

## Etapa din 13 octombrie 2026

LB-Portal folosește exclusiv dialectul **LBControl (`LBC_`)** pentru contenturi LiveBoard încărcate de operator. Numele destinației din editor este numele contentului adresabil în LiveBoard, iar câmpul este numele exact al obiectului text. Aplicația nu încarcă și nu modifică fișiere `.ccg`.

| Operație | Linie TCP exemplu |
| --- | --- |
| Valoare obiect | `LBC_SETTEMPLATEOBJECTVALUE "01_Titlu-1", "Titlu", "Text de probă"` |
| PLAY | `LBC_PLAYCONTENT "01_Titlu-1"` |
| RESUME | `LBC_RESUMECONTENT "01_Titlu-1"` |
| STOP | `LBC_STOPCONTENT "01_Titlu-1"` |

Fiecare comandă se termină cu newline. Argumentele sunt între ghilimele; backslash, ghilimele și newline/CR/tab din valori sunt escapate. Celelalte caractere de control sunt respinse. Numele tehnice nu sunt convertite la litere mici și nu sunt normalizate. Transportul folosește UTF-8; compatibilitatea diacriticelor trebuie verificată pe instalația ClassX.

## Dovezi consultate

- [SPEC_LBSCRIPTING_EN.pdf](SPEC_LBSCRIPTING_EN.pdf), rev. 1.5, pp. 2–4: LBControl prin TCP, separarea față de Script/TemplateActions și exemplul `LBC_PLAYCONTENT "graphics"` cu răspuns `OK`. JavaDoc-ul complet indicat de PDF nu este instalat pe acest calculator.
- [LiveBoard_scg_EN.pdf](LiveBoard_scg_EN.pdf), secțiunea Remote connection: porturi configurabile pentru controlul TCP.
- `C:\Projects\liveboard-tcp-lab\docs\FEASIBILITY_REPORT.md`: consemnează probe din 8–9 octombrie 2026 pe ClassX. PLAY/RESUME/STOP cu prefix LBC au primit `Ok`; setterul cu trei argumente între ghilimele, separate prin virgule, a primit `Ok`, iar readback-ul `TXT_VISIBLE` a întors valoarea setată. Acesta este un raport al unei probe anterioare, nu o verificare a LB-Portal pe LiveBoard în această intervenție.
- `C:\Projects\liveboard-tcp-lab\docs\CLASSX_REFERENCES.md` și builder-ele locale `contentControlCommands.ts` / `templateObjectCommands.ts`: framing, escaping și diferențierea dialectelor.


Raportul LAB arată că ID-urile contenturilor StealthCG/MOS pot necesita alte comenzi decât contenturile LiveBoard direct. LB-Portal nu face fallback automat la `EDITTEMPLATEOBJECT`, `PLAYCONTENTS` sau alte dialecte. În prima etapă se folosesc numai comenzile LBC configurate mai sus.

## Conexiune și răspunsuri

Modul inițial este **Simulare**, folosit numai pentru verificări offline. Pentru comenzi reale către LiveBoard, operatorul salvează hostul și portul TCP din preferințele instalației și apasă Conectare. Nu există port TCP real presupus, conectare automată, retry sau replay după reconectare. Endpointul HTTP Plasma este distinct de socketul TCP LiveBoard.

Clientul așteaptă bannerul Welcome și procesează linii fragmentate sau reunite de TCP. Trimite o singură comandă în așteptarea unui răspuns. `Ok`/`OK` confirmă acceptarea protocolului; `Error` este o eroare, iar timeout-ul închide sesiunea pentru a evita atribuirea unui răspuns întârziat altei comenzi. Main păstrează socketul; rendererul are numai API-uri tipizate prin preload.

**Acceptarea HTTP**, **simularea locală**, **confirmarea TCP** și **efectul video real** sunt rezultate distincte. LB-Portal nu citește în această etapă canalul de evenimente și nu confirmă prin video că o grafică este în emisie. Intervențiile manuale în LiveBoard nu sunt detectate automat; operatorul trebuie să sincronizeze starea locală.

## Verificarea pe instalația reală

Cu două contenturi de test încărcate și câmpurile configurate exact: verifică setterul și readback-ul în LAB, diacriticele și escaping-ul, apoi PLAY A → pregătire B → RESUME A → PLAY B și revenirea la A. Compară pauzele cu output-ul video și ajustează-le. Verifică separat durata template-urilor automate, deconectarea și recuperarea prin STOP. Nu interpreta `Ok` singur ca dovadă a tranziției vizuale.
