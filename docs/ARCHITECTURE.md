# ALUBALI — Architekturkonzept

> Persönlicher georgischer Assistent + Vermittlungssystem
> Stand: 2026-08-12 · Version 1.0 · Status: Architektur, **noch keine Implementierung**

---

## 0. Executive Summary

**Was wir bauen:** Eine mobile PWA, die es einer georgischen Pflegerin in Deutschland erlaubt, ihr komplettes Berufs- und Alltagsleben **durch Sprechen auf Georgisch** zu erledigen. Darunter liegt — unsichtbar — ein sauber modelliertes Vermittlungssystem für georgische Betreuungskräfte und deutsche Pflegefamilien.

**Der Produktkern in einem Satz:**
> Sie spricht Georgisch. Die App liefert deutsche Realität zurück — als Text, als Struktur, als Entscheidung.

**Die 10 wichtigsten Architekturentscheidungen:**

| # | Entscheidung | Warum |
|---|---|---|
| 1 | **Next.js 16 App Router + TypeScript + Tailwind v4 + Supabase (EU)** | Ein Deployment, ein Sprachraum, RLS als Sicherheitsrückgrat, minimale Betriebskosten |
| 2 | **Modularer Monolith mit `modules/` + `core/`** | Domänenklarheit ohne Microservice-Overhead; Module haben Public APIs |
| 3 | **AI schreibt nie direkt in die DB** | LLM → Zod-validiertes Tool-Argument → Service Layer → RLS. Immer. |
| 4 | **Matching ist deterministisch, nicht AI** | SQL-Hardfilter + gewichteter Score. AI erklärt höchstens das Ergebnis. Nachvollziehbar & kostenlos. |
| 5 | **Kein `matches`-Table** | Ein Vorschlag *ist* ein `placement` mit Status `proposed`. Eine Entity weniger. |
| 6 | **Bestätigungskarte statt Auto-Speichern** | Jeder Business-Write geht über eine Karte, die sie antippt. Löst Trust, Human-in-the-Loop und STT-Fehler in einem Muster. |
| 7 | **WhatsApp-MVP = `wa.me` Deep Link + Clipboard** | Keine Business-Verifizierung, keine Template-Freigabe, keine Kosten, kein Vendor Lock-in. Sie drückt "Senden" selbst. |
| 8 | **Provider-Adapter für STT/TTS/LLM ab Tag 1** | Georgisches STT ist das größte technische Risiko — Austauschbarkeit ist keine Option, sondern Pflicht. |
| 9 | **Gesundheitsdaten (Art. 9 DSGVO) architektonisch isoliert** | Freitext-Diagnosen in eigener Tabelle mit eigener Policy, eigener Retention, ohne Audit-Diff |
| 10 | **"Deutschland" wird zuerst gebaut, nicht das CRM** | Es liefert Wert am Tag 1 ohne jede Dateneingabe. Das CRM hat ein Kaltstartproblem. |

**Erwartete Betriebskosten MVP:** 0–15 €/Monat (Details → Abschnitt C.9)
**Realistischer MVP-Umfang:** 6 Features, kein Feature-Bloat (→ Abschnitt I)

---

## 0.1 Kritische Korrekturen an deinem Konzept

Du hast ausdrücklich gesagt, ich soll widersprechen, wo dein Konzept schwach ist. Hier sind die Punkte, die ich ändere. Alles Weitere baut darauf auf. (Das ist der vorgezogene Abschnitt **M**.)

### K1 — Der Homescreen hat einen Kachel-Konflikt

**Dein Vorschlag:** BUSINESS / DEUTSCHLAND / PFLEGERINNEN / ICH.

**Problem:** "Pflegerinnen" ist eine Teilmenge von "Business". Sie wird jedes Mal überlegen müssen: *"Ist eine neue Pflegerin jetzt Business oder Pflegerinnen?"* Genau diese Mikro-Entscheidung ist bei einer nicht-technischen Nutzerin der Punkt, an dem eine App sich "kompliziert" anfühlt.

**Korrektur:** Das 2×2-Raster bleibt (es ist visuell richtig), aber die vierte Kachel wird **დღეს / HEUTE** — das, was heute ansteht: Rückrufe, Fristen, unvollständige Profile, startende Einsätze.

```
┌─────────────────┬─────────────────┐
│   ბიზნესი       │   გერმანია      │
│   Business      │   Deutschland   │
├─────────────────┼─────────────────┤
│   დღეს          │   ჩემი          │
│   Heute         │   Ich           │
└─────────────────┴─────────────────┘
          ◉  „უბრალოდ მითხარი“
             (Sag es mir einfach)
```

Pflegerinnen und Familien leben **innerhalb** von Business — dort ist genau eine Umschaltung (Segmented Control: *Pflegerinnen | Familien | Einsätze*). Das ist ein Klick mehr für einen dauerhaft weniger verwirrenden Mentalmodell-Baum.

### K2 — Voice-Intent-Erkennung braucht Kontext, sonst kippt das Vertrauen

**Dein Vorschlag:** Ein Mikrofon erkennt frei 11 Intents.

**Problem:** Freie Intent-Klassifikation über 11 Klassen bei georgischem STT mit erhöhter Wortfehlerrate ist ein Vertrauens-Killer. Ein falscher Treffer ("Notiz" statt "Neue Pflegerin") kostet nicht Zeit, sondern *Glauben an die App*. Und Glaube ist bei einem Geschenk die einzige Währung.

**Korrektur — dreistufig:**

1. **Kontextuelles Mikrofon.** Auf dem Pflegerinnen-Screen ist der Kontext `caregiver`. In einem geöffneten Fall ist der Kontext dieser Fall. Das Modell bekommt den Kontext als Prior und muss nur noch bestätigen oder überstimmen. Trefferquote steigt dramatisch, Prompt wird kürzer, Kosten sinken.
2. **Globales Mikrofon nur auf Home** macht echtes Routing — und zeigt *immer* eine Bestätigungskarte.
3. **Es gibt keinen Fehlerzustand.** Wenn das Routing scheitert: Transkript wird als Notiz gespeichert (nie verloren) + eine Rückfrage auf Georgisch: *„რა გავაკეთო ამით?"* mit 3 Buttons. Nie eine leere Fehlermeldung.

### K3 — Das CRM ist nicht der Hook. „Deutschland" ist der Hook.

**Problem:** Der Business-Bereich hat ein **Kaltstartproblem**. Am Tag 1 ist die Datenbank leer. Eine leere Vermittlungsplattform kann nichts. Sie müsste erst 20 Pflegerinnen eintippen, um Wert zu sehen — genau das wird nicht passieren.

Der Deutschland-Assistent dagegen liefert **beim ersten Antippen** Wert: Brief fotografieren → in 8 Sekunden versteht sie ihn auf Georgisch. Null Setup. Null Dateneingabe.

**Korrektur:** Baureihenfolge im MVP wird umgedreht. `Voice-Notiz + Deutschland-Assistent + Schreib-das-für-mich` zuerst, `Pflegerinnen/Familien/Matching` danach. Das ändert deinen MVP nicht im Umfang, aber massiv im Risiko — nach 2 Wochen existiert schon etwas Verschenkbares.

Und der emotionale Effekt, den du in §38 beschreibst, entsteht genau hier: Sie fotografiert einen Krankenkassenbrief und bekommt eine Antwort auf Georgisch. *Das* ist der „Was zur Hölle"-Moment. Nicht ein Kandidatenprofil.

### K4 — `matches` als Tabelle ist eine unnötige Entity

**Problem:** Ein gespeicherter Match veraltet sofort (Pflegerin sagt woanders zu → Score falsch). Dann brauchst du Invalidierungslogik für Daten, die du in 40 ms neu berechnen kannst.

**Korrektur:** Matching wird **on-the-fly** berechnet. Persistiert wird erst, wenn sie einen Vorschlag *macht* — und das ist dann bereits ein `placement` mit Status `proposed`, inklusive eingefrorenem Score und Begründung. Eine Tabelle weniger, ein ganzes Konsistenzproblem weniger.

### K5 — `case_requirements` als eigene Tabelle: nein

**Problem:** Ein 1:1-Table ohne eigene Lebensdauer ist reine Normalisierungs-Kosmetik und kostet bei jeder Query einen Join.

**Korrektur:** Anforderungen sind Spalten auf `care_cases`. Nur *Aufgaben* (Kochen, Waschen, Einkaufen, Begleitung …) werden Junction-Table gegen einen Katalog, weil sie eine echte n:m-Liste sind.

**Aber die Gegenrichtung:** Freitext-**Diagnosen und Medikation** kommen in eine eigene Tabelle `care_case_health`. Nicht aus Normalisierungs-, sondern aus **DSGVO-Gründen** (Art. 9). Eigene Policy, eigene Löschfrist, keine Audit-Diffs. → G.4

### K6 — Kein ORM. Supabase-Client + SQL-Migrationen.

**Problem:** Drizzle/Prisma über den Supabase-Pooler verbindet als DB-Rolle und **umgeht RLS**. Damit wäre dein Sicherheitsrückgrat aus §17 dekorativ. Zusätzlich hättest du zwei Schema-Wahrheiten (Migration + ORM-Schema).

**Korrektur:** `supabase-js` mit User-JWT (RLS greift), SQL-Migrationen versioniert in `supabase/migrations/`, TypeScript-Typen generiert via `supabase gen types`. Komplexe Matching-Queries als Postgres-Funktion (`security invoker`) per RPC. Service-Role-Key existiert **nur** in zwei explizit benannten Server-Modulen (Event-Drainer, Cron) — nirgends sonst.

### K7 — Georgisches STT ist Risiko Nr. 1 und braucht ein Spike, kein Vertrauen

Georgisch ist eine Low-Resource-Sprache. Whisper unterstützt `ka`, aber die Wortfehlerrate liegt deutlich über Deutsch/Englisch, besonders bei Eigennamen, Zahlen und Datumsangaben — also **exakt bei den Feldern, die wir extrahieren wollen**.

**Korrektur:** Vor dem UI-Bau ein 1-Tages-Spike (→ Roadmap M0): 20 echte Sprachaufnahmen von ihr, gegen mindestens 3 Provider gebenchmarkt (OpenAI Whisper / `gpt-4o-transcribe`, Google Chirp, Azure Speech `ka-GE`, ElevenLabs Scribe, Gemini nativ-Audio). Messgröße ist nicht WER, sondern **Feld-Genauigkeit**: Wie oft ist „Nino, 47, ab 1. September" korrekt extrahiert?

Die UX kompensiert den Rest: Die Bestätigungskarte macht STT-Fehler **billig** — sie tippt ein Feld an und korrigiert es, statt neu zu sprechen.

### K8 — Text-to-Speech ist explizit *kein* MVP-Feature

Georgische TTS-Stimmen sind rar und qualitativ uneinheitlich (Azure führt `ka-GE` neuronale Stimmen, die großen Multilingual-Anbieter decken Georgisch nur teilweise oder gar nicht ab — **muss verifiziert werden**). Eine schlechte Roboterstimme in ihrer Muttersprache würde die Premium-Wirkung sofort zerstören.

**Korrektur:** MVP ist **voice-in / text-out**. Der `textToSpeech()`-Adapter wird definiert, aber nicht implementiert. Wird nachgerüstet, wenn eine Stimme gefunden ist, die gut genug ist.

### K9 — Typografie: Georgisch hat keine Großbuchstaben

Mkhedruli (მხედრული) ist unikameral. `text-transform: uppercase` auf georgischem Text ist entweder wirkungslos oder erzeugt Mtavruli-Formen, die wie **Schreien** oder wie ein Behördenformular wirken. Genau der Look, den du in §20 ausschließt.

**Korrektur, verbindlich:**
- Keine `uppercase`-Utility im Design System, global verboten
- Hierarchie über Gewicht, Größe und Farbe — nie über Versalien
- `letter-spacing` auf georgischem Text ≤ 0; Latin-Tracking-Tricks kaputt machen die Schrift
- `line-height` mindestens 1.55 für Fließtext (Georgisch hat lange Ober-/Unterlängen)
- Eine Schriftfamilie, die **beide Skripte** abdeckt, sonst wirkt jede gemischte Zeile billig

### K10 — Auth: Passwörter sind für sie die falsche Antwort

**Korrektur:** Google OAuth (One Tap) als Primärweg + Magic Link als Fallback + sehr lange Session (Refresh Token), sodass sie sich faktisch nie einloggt. Zusätzlich optionaler 6-stelliger **App-Lock-PIN**, lokal gespeichert — nicht als Sicherheitsmaßnahme, sondern weil er das Gefühl erzeugt: *„Das ist meins."*

### K11 — Rechtlicher Rahmen des Geschäftsmodells muss die Architektur formen

Das ist kein Nebensatz, sondern eine Architekturgrenze. 24-Stunden-Betreuung in Deutschland hat scharfe rechtliche Kanten: Entsendung und A1-Bescheinigungen, das BAG-Urteil zur Vergütung von Bereitschaftszeit (2021), Scheinselbstständigkeit, und AGG-Fragen bei Auswahlkriterien wie Geschlecht, Nationalität oder Raucherstatus.

**Korrektur — zwei harte Konsequenzen:**

1. **Die App ist ein Vermittlungs- und Anbahnungswerkzeug, kein Arbeitgebersystem.** Wir bauen bewusst **keine** Lohnabrechnung, keine Dienstplanung, keine Arbeitszeiterfassung — denn diese Features würden das Geschäftsmodell faktisch als Arbeitgeberverhältnis ausgestalten. Dein §31 hatte das intuitiv richtig, ich mache den *Grund* explizit.
2. **Sensible Auswahlkriterien werden als "Wunsch der Familie" modelliert, nicht als System-Filter.** Geschlechtspräferenz und Raucherstatus sind im Datenmodell `preference`-Felder mit Herkunftsvermerk, keine harten Ausschlusskriterien der Engine. Die Engine gewichtet sie weich und protokolliert sie. Kostet nichts, verändert die Haftungslage.

Ich bin kein Anwalt und das ist keine Rechtsberatung — vor dem Schritt zum echten Geschäft (Phase 3) gehört ein Fachanwalt für Arbeitsrecht in die Schleife.

### K12 — Was ich aus dem Konzept ersatzlos streiche

| Gestrichen | Grund |
|---|---|
| `matches`-Tabelle | → K4 |
| `case_requirements`-Tabelle | → K5 |
| Prompt-/Einstellungs-UI jeder Art | Sie soll nie prompten. Ein Settings-Screen mit AI-Optionen wäre Verrat am Kernversprechen |
| Kanban-Board | Auf 390 px Breite ist Kanban unbedienbar. → B.5 |
| Vollständige Offline-DB | Kosten/Nutzen katastrophal. Stattdessen: Offline-**Outbox** für Aufnahmen → C.8 |
| Realtime (Supabase) | Ein Nutzer. Es gibt nichts zu synchronisieren. |
| Vector-Search im MVP | SQL kann alles, was sie im ersten Jahr braucht. → F.6 |
| Web Push im MVP | iOS-PWA-Push ist fragil. In-App „Heute" reicht. → C.10 |

---

## 0.2 Abweichungen der V1-Umsetzung

Die Umsetzung hat an sieben Stellen begründet vom Konzept abweichen müssen.
Alle sind bewusst und rückbaubar.

| # | Konzept | V1-Umsetzung | Grund |
|---|---|---|---|
| **V1** | Locale als URL-Segment (`/ka/...`) | Locale im Cookie, Routen ohne Präfix | Ein Nutzer, ein Gerät. Ein Sprachsegment in der URL bringt hier keinen Nutzen und kostet Middleware-Komplexität. i18n selbst ist unverändert vollständig — kein einziger UI-String steht im Code. |
| **V2** | `next-intl` | Eigenes typisiertes Wörterbuch (~90 Zeilen) | `MessageKey` wird aus dem georgischen Wörterbuch abgeleitet; eine fehlende deutsche Übersetzung ist damit ein **Compile-Fehler**. Das ist strenger als die Bibliothek. |
| **V3** | Junction-Tabellen für Skills, Sprachen, Aufgaben | Typisierte Arrays auf der Hauptzeile | Der eigentliche Grund für Junctions war Datenqualität — die kommt hier aus festen Schlüssel-Enums, nicht aus Freitext. Der Weg zu Junctions ist eine reine Datenwanderung. |
| **V4** | Alle Filter und Scores in SQL | Matching in TypeScript über geladene Listen | V1 arbeitet mit Dutzenden Zeilen, nicht Millionen. Dadurch ist die Engine eine reine Funktion und vollständig unit-testbar. Der Übergang zu SQL-Funktionen betrifft nur die Repository-Schicht. |
| **V5** | Serwist als Service Worker | Handgeschriebener Service Worker (~70 Zeilen) | Der benötigte Umfang ist App-Shell-Caching. Eine Build-Integration mit eigener Konfigurationsebene wäre mehr Abhängigkeit als Nutzen. |
| **V6** | Persistenter AI-Cache in der Datenbank | Prozesslokaler Cache mit TTL | Deckt die teuren Wiederholungen (gleicher Brief, gleiche Übersetzung) ab. Ein persistenter Cache steht in `LATER.md`. |
| **V7** | Nur Supabase als Datenhaltung | Zusätzlicher lokaler Dateitreiber hinter demselben Port | Damit ist die App ohne jede Konfiguration vollständig bedienbar — entscheidend, um sie zeigen zu können, bevor Infrastruktur existiert. |

**Nicht abgewichen wurde bei:** der Entwurfs-Zwischenstufe vor jedem Write, der
Zod-Validierung jeder Modellausgabe, der Isolation der Gesundheitsdaten, dem
Snapshot des Match-Scores am Placement, der Provider-Neutralität von AI und
Speech, und dem Verzicht auf Arbeitgeber-Funktionen.

**Technische Randnotizen aus der Umsetzung:**

* **ESLint 9, nicht 10.** Das in `eslint-config-next@16` gebündelte
  `typescript-eslint` unterstützt ESLint 10 noch nicht (`scopeManager.addGlobals`).
* **TypeScript 6, nicht 7.** `typescript-eslint` lehnt die TS-7-API ab. Der
  Anwendungscode ist mit beiden übersetzbar.
* **`npm install --legacy-peer-deps`.** Ohne das Flag läuft npm in eine
  Backtracking-Schleife und lädt Paket-Metadaten minutenlang im Kreis.

---

## A. Product Architecture

### A.1 Produktdefinition

**ALUBALI** (ალუბალი — georgisch für *Sauerkirsche*) ist ein persönlicher zweisprachiger Assistent, der zufällig auch ein Vermittlungssystem ist.

Namensbegründung: Es klingt nach einer Boutique-Marke, nicht nach Software. Es ist georgisch und positiv besetzt (Alubali-Saft, Alubali-Marmelade sind Kindheit). Und es trägt die Kirsche — dein Mon-Chéri-Motiv — **im Namen selbst**, ohne dass irgendjemand es kitschig finden könnte. Der Easter Egg ist damit nicht aufgesetzt, sondern die Wurzel.

Alternativen, falls du sie vorziehst:

| Name | Bedeutung | Charakter |
|---|---|---|
| **ალუბალი / ALUBALI** | Sauerkirsche | warm, persönlich, trägt das Motiv — **Empfehlung** |
| ბროლი / BROLI | Kristall | kühler, luxuriöser, „Premium Banking" |
| ხიდი / KHIDI | Brücke | konzeptuell exakt, aber etwas korporativ |
| ია / IA | Veilchen | sehr feminin, sehr kurz, evtl. zu zart |

### A.2 Die vier Kernjobs

Formuliert als Jobs-to-be-done, aus ihrer Perspektive:

**J1 — „Ich verstehe Deutschland nicht schnell genug."**
Briefe, Formulare, Behördendeutsch, Arztauskünfte. Sie versteht es irgendwie, aber langsam, unsicher und mit dem ständigen Gefühl, etwas zu übersehen.
→ *Deutschland-Assistent, Dokumenten-Erklärer, Übersetzung*

**J2 — „Ich klinge auf Deutsch nicht so kompetent, wie ich bin."**
Sie ist erfahren und souverän. Auf Deutsch klingt sie einfacher, als sie ist — und das kostet sie Aufträge und Respekt.
→ *„Schreib das für mich"*

**J3 — „Alles ist in meinem Kopf und in WhatsApp."**
Sie weiß, wer verfügbar ist. Aber sie weiß es *im Kopf*, verteilt über 40 Chats. Es skaliert nicht und es lässt sich nicht abgeben.
→ *Voice-Erfassung, Pflegerinnen, Familien*

**J4 — „Ich finde nicht schnell genug die richtige Frau für die richtige Familie."**
Der eigentliche Wertschöpfungsmoment ihres Geschäfts — heute reine Kopfarbeit.
→ *Matching Engine*

**Und der fünfte, unausgesprochene:**

**J5 — „Ich will etwas, das mir gehört."**
Der Bereich *ჩემი*. Er hat keinen Business-Nutzen. Er ist der Grund, warum die App als Geschenk funktioniert und nicht als Werkzeug.

### A.3 Was bewusst NICHT im Produkt ist

| Nicht enthalten | Begründung |
|---|---|
| Buchhaltung, Rechnungen, Lohn | → K11: verändert die Rechtsnatur des Geschäfts |
| Dienst-/Schichtplanung | dito |
| Vertragsgenerator | Rechtsrisiko ohne anwaltliche Grundlage |
| Chat-Client / Messenger-Ersatz | WhatsApp gewinnt. Wir liefern zu, wir ersetzen nicht |
| Kalender-Ersatz | Google Calendar gewinnt. Wir erzeugen höchstens Termine |
| Allgemeiner AI-Chatbot | ChatGPT gewinnt. Unser Vorteil ist *Kontext*, nicht Konversation |
| Öffentliche Kandidatenprofile / Marktplatz | DSGVO-Albtraum + völlig anderes Produkt |
| Bewertungs-/Rating-System für Pflegerinnen | Menschenwürde, AGG, und es macht das Produkt hässlich |

### A.4 Positionierungsachse

```
  persönlich
      ▲
      │        ● ALUBALI
      │
      │                    ● Salesforce/Pflege-CRM
      │  ● ChatGPT
      └──────────────────────────► geschäftsfähig
```

Wir sind bewusst oben rechts. Kein anderes Produkt in diesem Feld ist das — weil kein Produkt für **eine** Person gebaut wird. Das ist unser unfairer Vorteil und der Grund, warum es sich nicht wie Software anfühlen darf.

---

## B. UX Architecture

### B.1 Grundprinzipien

1. **Sprechen ist immer möglich, Tippen ist immer möglich.** Nie ein Zwang zu Voice. Wenn sie im Bus sitzt, tippt sie.
2. **Nichts wird geschrieben, was sie nicht gesehen hat.** Jeder Business-Write geht durch eine Bestätigungskarte.
3. **Nie ein Dead End.** Jeder Fehlerzustand hat einen Weg vorwärts und speichert mindestens die Rohdaten.
4. **Kein Feld ist Pflicht.** Ein Profil mit nur „Nino, Demenz, ab September" ist ein gültiges Profil. Vollständigkeit ist ein Fortschrittsbalken, kein Gate.
5. **Maximal 2 Ebenen Tiefe.** Home → Bereich → Detail. Nie tiefer.
6. **Deutsche Datumsformate, georgische Sprache.** Sie lebt hier. `01.09.2026`, nicht `2026-09-01`.

### B.2 Screen-Inventar (MVP)

```
/                        Home — 2×2 Raster + Voice
/capture                 Voice-Overlay (modal, über allem)
/confirm/:draftId        Bestätigungskarte

/business                Segmented: Pflegerinnen | Familien | Einsätze
/business/caregivers/:id Pflegerin — Profil, Verfügbarkeit, Dokumente, Notizen
/business/families/:id   Familie + ihre Fälle
/business/cases/:id      Pflegefall — Bedarf, Kandidatinnen, Verlauf
/business/cases/:id/matches   Kandidatenliste mit Score
/business/placements/:id Einsatz

/germany                 Deutschland-Hub
/germany/document        Brief fotografieren / hochladen → Erklärung
/germany/document/:id    Erklärung + Handlungsoptionen
/germany/write           „Schreib das für mich"
/germany/translate       Freie Übersetzung

/today                   Aufgaben, Fristen, fehlende Infos
/me                      ჩემი — Wunschlisten & Persönliches
/me/:collection

/onboarding              Erstöffnung
/settings                Sprache, Konto, Daten (minimal, versteckt)
```

**19 Routen im MVP.** Zum Vergleich: ein typisches Pflege-CRM hat 60+.

### B.3 Navigationsmodell

Keine Tab-Bar. Eine Tab-Bar würde die App sofort wie eine App aussehen lassen — wir wollen, dass sie wie ein *Objekt* aussieht.

- **Home ist ein Ort**, kein Menü. Immer über Logo-Tap erreichbar.
- **Bereiche sind Vollbild** und haben eine große Zurück-Geste (Swipe von links, Standard-iOS-Verhalten).
- **Der Voice-Button ist persistent** — auf Home groß und zentral, in Unterseiten als schwebender FAB unten rechts, kleiner, kontextgebunden.
- **Kein Hamburger-Menü.** Settings sind über das Profilbild oben rechts erreichbar, sonst nirgends.

### B.4 Der Voice-Flow (das Herzstück)

```
   Tap ◉
     ↓
 ┌───────────────────────────────────┐
 │  Aufnahme läuft                   │   Live-Waveform
 │  ●●●●●▂▄▆█▆▄▂●●●●●                │   Timer
 │  0:07                             │   Auto-Stop nach 2,5 s Stille
 │            [ დასრულება ]           │   Großer Stop-Button
 └───────────────────────────────────┘
     ↓  Upload (Opus 16 kHz mono, ~24 kbps)
 ┌───────────────────────────────────┐
 │  ⠋ ვამუშავებ…                     │   Skeleton, nie ein Spinner allein
 └───────────────────────────────────┘
     ↓  STT + Intent + Extraktion (1 LLM-Call)
 ┌───────────────────────────────────┐
 │  ახალი მომვლელი                   │   ← Was verstanden wurde
 │  ─────────────────────────────    │
 │  სახელი      Nino            ✓    │
 │  ასაკი       47              ✓    │
 │  გამოცდილება 8 წელი          ✓    │
 │  გერმანული   A2              ⚠    │   ← unsicher, gold markiert
 │  დემენცია    კი              ✓    │
 │  თავისუფალია 01.09.2026      ✓    │
 │  ─────────────────────────────    │
 │  ❓ ავტომობილის მართვის მოწმობა?   │   ← fehlende Info als Frage
 │     [ კი ]  [ არა ]  [ არ ვიცი ]  │
 │  ─────────────────────────────    │
 │  [ შენახვა ]        [ გაუქმება ]  │
 │  ⌄ ორიგინალი ტექსტი               │   ← Transkript ausklappbar
 └───────────────────────────────────┘
     ↓  Speichern
 ┌───────────────────────────────────┐
 │  ✓ ნინო შენახულია                 │
 │  2 ოჯახი შეიძლება შეესაბამებოდეს  │   ← proaktiv, aber nicht aufdringlich
 │  [ ნახვა ]                        │
 └───────────────────────────────────┘
```

**Warum tap-to-start statt hold-to-talk:** Sie beschreibt eine Pflegerin — das dauert 30–50 Sekunden. Ein Daumen, der 50 Sekunden gedrückt hält, ist eine Zumutung und produziert Abbrüche.

**Warum die Karte editierbar ist:** Das ist die zentrale Kompensation für STT-Ungenauigkeit (→ K7). Ein falsch erkanntes „A2" korrigiert sie in 2 Sekunden per Tap. Neu sprechen würde 40 Sekunden kosten. Diese eine UX-Entscheidung macht Georgisch-STT von einem Blocker zu einem Detail.

**Warum das Transkript sichtbar bleibt:** Vertrauen. Sie muss jederzeit prüfen können, was die App gehört hat. Und das Transkript wird als Notiz mitgespeichert — Rohdaten gehen nie verloren.

### B.5 Pipeline statt Kanban

Kanban auf 390 px ist unbedienbar. Stattdessen: **Statusleiste im Kopf des Detail-Screens** + eine gefilterte Liste.

```
 Familie Müller
 ●───●───●───○───○───○
 neu bedarf kand. vorg. gespr. zusage

 aktuell: Kandidatinnen gesucht
 [ nächster Schritt: 3 Kandidatinnen ansehen → ]
```

Statuswechsel passiert **implizit durch Handlung**, nicht durch Dropdown. Sie schlägt eine Kandidatin vor → Status springt auf „vorgeschlagen". Kein Nutzer der Welt pflegt gerne Status-Felder.

### B.6 Onboarding (Time-to-Value < 60 Sekunden)

```
 1  [Splash]      ალუბალი                          ~3 s
                  Ein sehr kurzer, sehr persönlicher Satz von dir.

 2  [Name]        „როგორ დაგიძახო?"                 ~8 s
                  Ein Feld. Weiter.

 3  [Foto]        optional, überspringbar            ~5 s

 4  [Der Moment]  „მითხარი, როგორი იყო შენი დღე"     ~25 s
                  Sie spricht 20 Sekunden auf Georgisch.
                  → App zeigt: schön gesetzte Notiz + deutsche Übersetzung
                  → „ასე მუშაობს. ყველგან."

 5  [Enthüllung]  Home erscheint mit den 4 Kacheln.  ~5 s
                  Keine Tour. Keine Tooltips. Keine Coach Marks.
```

**Warum der Demo-Moment persönlich und nicht geschäftlich ist:** Ein Business-Onboarding („Lege deine erste Pflegerin an") sagt *„mein Freund hat mir ein CRM gebaut"*. Ein persönlicher Moment sagt *„das ist meine App"*. Das Business entdeckt sie 10 Minuten später von selbst. Reihenfolge ist hier alles.

### B.7 Der Bereich ჩემი (Ich)

Visuell **spürbar anders**: wärmerer Hintergrund, größere Bilder, weniger Struktur, mehr Weißraum. Er soll sich anfühlen, als hätte man eine andere App geöffnet.

MVP: Sammlungen mit Karten. `Restaurants · Schmuck · Beauty · Serien · Orte · Wünsche`. Ein Item = Bild, Titel, Notiz, optional Link/Preis, Favoritenstern. Anlegbar per Voice („დაამატე ეს რესტორანი") oder per Share-Sheet aus dem Browser (Web Share Target API — funktioniert in installierter PWA auf Android; iOS eingeschränkt).

Kein Business-Vokabular hier. Keine Status. Kein „hinzufügen". Nur „+".

### B.8 Easter Eggs (Mon Chéri)

Regeln: **niemals** im Business-Bereich, **niemals** als Popup, **niemals** öfter als selten.

1. **Der Name selbst.** ალუბალი. Sie wird irgendwann fragen, warum. Das ist der beste Easter Egg — er ist unsichtbar, bis er erzählt wird.
2. **Long-Press auf das Logo (1,5 s)** → eine Kirsche fällt langsam von oben, und ein kurzer, handgeschriebener Text von dir erscheint. Immer verfügbar, aber nur, wenn man danach sucht.
3. **Pull-to-Refresh, ca. 1 von 30 Malen** → statt des Ladeindikators ein kleines 🍒, das kurz aufblitzt. Nie erklärt.
4. **Ein Datum** (ihr Jahrestag, ihr Geburtstag) → der Header-Verlauf trägt an diesem Tag einen wärmeren Kirschton, und die Begrüßung ist eine andere. Einen Tag lang. Konfiguriert in einer Konstante, nicht in Settings.
5. **Ein Item in ჩემი, das nicht löschbar ist.** In der Sammlung „Wünsche" liegt von Anfang an ein Eintrag. Der Löschen-Button fehlt dort. Sie wird es merken.

---

## C. Technical Architecture

### C.1 Stack-Bewertung (deine Vorschläge, geprüft)

| Komponente | Dein Vorschlag | Urteil | Anmerkung |
|---|---|---|---|
| Next.js App Router | ✅ | **Ja** | Server Actions + RSC passen exakt zu „dünner Client, Logik am Server" |
| TypeScript | ✅ | **Ja** | `strict: true`, keine Ausnahmen |
| Tailwind | ✅ | **Ja, v4** | CSS-first Tokens sind für ein eigenes Design System besser als v3-Config |
| shadcn/ui | „selektiv" | **Ja, sehr selektiv** | Nur Radix-basierte Verhaltens-Primitives (Dialog, Popover, Select, Sheet). Der Default-Look wird **komplett** ersetzt — sonst sieht die App aus wie jede zweite AI-App 2026 |
| Framer Motion (`motion`) | ✅ | **Ja, lazy** | ~50 kB. Nur für Voice-Overlay, Karten-Übergänge, Easter Eggs. Alles andere: CSS-Transitions |
| PWA | ✅ | **Ja, Serwist** | `next-pwa` ist nicht mehr gepflegt; Serwist ist der Nachfolger |
| Supabase | ✅ | **Ja, EU-Region** | Postgres + Auth + Storage + RLS in einem. Für ein Ein-Personen-Produkt unschlagbar |
| Zod | ✅ | **Ja** | Einzige Wahrheit für LLM-Output, Formulare und Server Actions |
| Server Actions | ✅ | **Ja, mit Regel** | Server Action = Auth-Check → Zod-Parse → Service-Call. Nie Geschäftslogik in der Action |
| ORM | offen | **Nein** | → K6 |
| Realtime | „nur wenn nötig" | **Nicht nötig** | Ein Nutzer |

**Ergänzungen, die fehlen:**

| Ergänzung | Zweck |
|---|---|
| `next-intl` | i18n mit App-Router-Support, Locale-Segment, Typsicherheit für Keys |
| `@supabase/ssr` | Cookie-basierte Sessions in RSC + Server Actions |
| `zod` + `@t3-oss/env-nextjs` | Env-Validierung beim Build — verhindert fehlende Keys in Prod |
| Sentry (oder Axiom) | Ohne Error-Tracking baust du blind für jemanden, der dir keine Bugreports schickt |
| Vitest + Playwright | Kernlogik (Matching, Extraktion, RLS) muss getestet sein |
| `eslint-plugin-boundaries` | Erzwingt die Modulgrenzen aus H maschinell |

### C.2 Systemübersicht

```
┌──────────────────────────────────────────────────────┐
│  PWA (Installiert, iOS/Android)                      │
│  React Server Components · Client Islands            │
│  Service Worker: App-Shell, Offline-Outbox           │
└───────────────┬──────────────────────────────────────┘
                │ HTTPS, Session-Cookie
┌───────────────▼──────────────────────────────────────┐
│  Next.js @ Vercel (Region fra1)                      │
│                                                       │
│  Server Actions  ·  Route Handlers  ·  Cron          │
│  ┌─────────────────────────────────────────────┐     │
│  │  modules/ — Domänenlogik                     │     │
│  │  caregivers · families · matching ·          │     │
│  │  placements · documents · assistant ·        │     │
│  │  communication · personal · notifications    │     │
│  └─────────────────────────────────────────────┘     │
│  ┌─────────────────────────────────────────────┐     │
│  │  core/ — Adapter (austauschbar)              │     │
│  │  ai · speech · db · auth · storage · i18n    │     │
│  └─────────────────────────────────────────────┘     │
└───┬──────────────────────┬───────────────────┬───────┘
    │                      │                   │
┌───▼──────────┐  ┌────────▼────────┐  ┌──────▼───────┐
│ Supabase EU  │  │ AI-Provider     │  │ Speech       │
│ Postgres+RLS │  │ Anthropic /     │  │ Whisper /    │
│ Auth         │  │ OpenAI /        │  │ Azure /      │
│ Storage      │  │ Google          │  │ Google       │
│ (private)    │  │ (via Adapter)   │  │ (via Adapter)│
└──────────────┘  └─────────────────┘  └──────────────┘
```

### C.3 Datenfluss: Voice → Datensatz

```
 1  Client   MediaRecorder → Opus/mp4 Blob
 2  Client   POST /api/voice  (multipart)
 3  Server   Auth-Check → Upload nach Storage (privat, 30 Tage TTL)
 4  Server   speech.transcribe({ audio, hint: 'ka' })  → transcript
 5  Server   assistant.route({ transcript, context })  → 1 LLM-Call, Tool-Choice
 6  Server   Zod.parse(toolArgs)  ── fail ──► 1 Retry mit Fehlertext
 7  Server   Draft in `assistant_drafts` speichern (kein Business-Write!)
 8  Client   Bestätigungskarte rendern
 9  User     korrigiert / ergänzt / bestätigt
10  Server   Server Action → service.createCaregiver() → RLS-Insert
11  Server   `domain_events` Outbox-Row in derselben Transaktion
12  Cron     Event-Drainer → Notifications, Folgeaufgaben
```

**Der entscheidende Schritt ist 7.** Der Draft ist keine Business-Entity. Er ist ein Vorschlag mit eigener Lebensdauer (24 h), eigener Tabelle und **keinerlei** Referenzen aus dem Businessmodell. Damit kann die AI nie „aus Versehen" etwas anlegen — architektonisch, nicht durch Disziplin.

### C.4 AI-Provider-Abstraktion

```ts
// core/ai/types.ts  — Contract, keine Implementierung
export interface LLMProvider {
  readonly id: 'anthropic' | 'openai' | 'google'
  complete(req: CompletionRequest): Promise<CompletionResult>
  completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>
  supportsVision: boolean
  supportsToolUse: boolean
}

export type ModelTier = 'nano' | 'standard' | 'vision'
```

Der **Model Router** mappt Aufgabe → Tier → konkretes Modell. Der Business Code sagt nie „Claude" oder „GPT", sondern:

```ts
ai.run('caregiver.extract', { transcript })   // Router wählt: nano
ai.run('document.explain', { imageUrl })      // Router wählt: vision
ai.run('message.draft',   { brief })          // Router wählt: standard
```

| Tier | Aufgaben | Kandidaten | Warum |
|---|---|---|---|
| `nano` | Intent-Routing, Feldextraktion, Suchanfrage→Filter, Klassifikation | Claude Haiku 4.5 · Gemini Flash-Lite · GPT-mini | Strukturierte Extraktion braucht kein Frontier-Modell. Faktor 10–20 günstiger |
| `standard` | Deutsche Textentwürfe, Dokumenterklärung, Übersetzung mit Register | Claude Sonnet 5 · GPT-Klasse mittel | Hier ist Sprachqualität der Produktwert. Nicht sparen |
| `vision` | Brief-Foto → Text + Verständnis | Claude Sonnet 5 Vision · Gemini Flash Vision | **Kein separates OCR.** Vision-LLM liest deutsche Briefköpfe, Tabellen und Fristen in einem Schritt besser als OCR+LLM |

**Opus wird in dieser App nie verwendet.** Keine Aufgabe rechtfertigt die Kosten.

Fallback-Kette: Primärprovider → Timeout (12 s) oder 5xx → Sekundärprovider (anderer Anbieter, gleiches Tier) → Schema-Fail nach 1 Retry → **manuelles Formular mit vorbefülltem Transkript**. Nie ein toter Zustand.

### C.5 Speech-Abstraktion

```ts
// core/speech/types.ts
export interface SpeechProvider {
  transcribe(req: {
    audio: Blob | ArrayBuffer
    languageHint?: 'ka' | 'de' | 'ru' | 'en'
    vocabulary?: string[]     // ← Namen aus ihrer DB als Prompt-Bias
  }): Promise<{ text: string; language: string; confidence?: number; durationSec: number }>
}
```

**`vocabulary` ist der wichtigste Parameter.** Die Namen der Pflegerinnen und Familien aus ihrer eigenen Datenbank werden als Bias an den STT-Provider übergeben (Whisper: `prompt`; Azure/Google: Phrase Lists). Damit wird aus „Nino" nicht „Nina" und aus „Müller" nicht „Miller". Das ist der billigste Qualitätssprung im ganzen System — und der Grund, warum ein eigener Adapter statt einer Fertiglösung nötig ist.

TTS-Interface wird definiert, aber im MVP nicht implementiert (→ K8).

### C.6 Auth

- **Supabase Auth**, Google OAuth primär, Magic Link als Fallback
- Sessions über `@supabase/ssr` in httpOnly-Cookies, Refresh-Token lang gültig
- Middleware schützt alles außer `/onboarding` und `/auth/*`
- Optionaler lokaler App-Lock-PIN (WebCrypto-Hash in IndexedDB, **kein** Serverbezug — es ist ein Komfort-Lock, kein Sicherheitsfeature, und wird auch so kommuniziert)
- Rollen liegen in `organization_members.role`, nicht in JWT-Claims → keine Token-Invalidierung nötig bei Rollenwechsel

### C.7 Storage

- Ein privater Bucket: `documents`
- Pfadkonvention: `{org_id}/{owner_kind}/{owner_id}/{uuid}.{ext}` — der erste Pfadsegment ist die Org, darauf greift die Storage-Policy
- **Nie** öffentliche URLs. Signed URLs mit 60 s TTL, ausschließlich serverseitig erzeugt
- Client-seitige Bildkompression vor Upload (Canvas, max 2000 px Kante, JPEG q0.82) — spart Bandbreite, Storage und Vision-Tokens
- Audio: separater Pfad `voice/{org_id}/{uuid}.opus`, automatische Löschung nach 30 Tagen per Cron

### C.8 PWA & Offline

**Umfang bewusst klein:**

| Offline-fähig | Nicht offline |
|---|---|
| App-Shell, Fonts, Icons | Matching |
| Zuletzt gesehene Listen (SWR-Cache) | AI-Aufgaben jeder Art |
| **Sprachaufnahmen (Outbox)** | Dokumenten-Upload |
| Notiz-Entwürfe | Suche |

Die **Outbox** ist das eine Offline-Feature, das wirklich zählt: Sie steht im Keller einer Pflegefamilie ohne Netz und will schnell etwas festhalten. Aufnahme landet in IndexedDB, wird bei Netzrückkehr verarbeitet. Background Sync auf Android, Retry-on-Visibility als iOS-Fallback.

**iOS-Fallstricke, die eingeplant sind:**
- `MediaRecorder` in iOS Safari erst ab 14.3 und mit anderen Codecs (`audio/mp4`, nicht `webm/opus`) → Feature-Detection + Fallback auf `<input type="file" accept="audio/*" capture>`
- `getUserMedia` braucht HTTPS + User-Geste
- Web Push nur ab iOS 16.4 **und nur** in der zum Homescreen hinzugefügten PWA → deshalb kein Push im MVP
- Keine Vibration API auf iOS → Haptik ist Progressive Enhancement, nie Teil des Feedbacks

### C.9 Kostenmodell

Kalkulation für realistische Nutzung: 150 Sprachaufnahmen, 30 Dokumente, 100 Textentwürfe pro Monat.

| Posten | Menge | Einheitskosten (Größenordnung) | Monat |
|---|---|---|---|
| STT | 150 × 40 s ≈ 100 min | ~$0,006/min | ~$0,60 |
| Extraktion (nano) | 150 × ~1,5 k Tokens | Cent-Bruchteile | ~$0,20 |
| Dokumenterklärung (vision) | 30 × ~3 k Tokens | | ~$0,50 |
| Textentwürfe (standard) | 100 × ~1,5 k Tokens | | ~$1,50 |
| Übersetzungen (cached) | ~200, davon 60 % Cache-Hit | | ~$0,30 |
| **AI gesamt** | | | **~$3–6** |
| Supabase | Free bis ~500 MB DB / 1 GB Storage | | **$0**, später $25 |
| Vercel | Hobby | | **$0**, später $20 |
| Domain | | | ~$1 |
| **Gesamt MVP** | | | **~$5–10 / Monat** |

**Kostenkontrollen, fest eingebaut:**
1. Maximal **ein** LLC-Call pro Nutzeraktion. Keine Agent-Schleifen, keine Reflexionsrunden.
2. Übersetzungs-Cache: `hash(text + zielsprache + register)` → Ergebnis. Wiederholte Phrasen kosten null.
3. Dokument-Cache: `sha256(datei)` → Erklärung. Zweimal derselbe Brief = einmal bezahlt.
4. `ai_interactions` protokolliert Tokens und Kosten pro Call → Monatsbudget sichtbar.
5. Soft-Cap bei 80 % des Budgets (Warnung), Hard-Cap bei 100 % (nur noch essenzielle Calls).
6. Kein Streaming-TTS, kein Vision auf Bilder, die kein Dokument sind (Client-seitige Vorprüfung).

### C.10 Notifications

Entkoppelt über `notifications` + Channel-Adapter.

| Phase | Kanal | Grund |
|---|---|---|
| MVP | **In-App** (`/today` + Badge) | Kostenlos, zuverlässig, kein iOS-Risiko |
| Phase 2 | Web Push (VAPID) | Wenn PWA installiert und iOS ≥ 16.4 |
| Phase 2 | E-Mail (Resend) | Für Fristen, die wirklich wichtig sind |
| Phase 3 | WhatsApp Business API | Erst wenn Geschäft real ist |

### C.11 WhatsApp — die pragmatische Lösung

Die WhatsApp Cloud API verlangt Business-Verifizierung, Template-Freigaben und kostet pro Konversation. Für den MVP völlig unverhältnismäßig.

**MVP-Lösung:** Der generierte deutsche Text bekommt zwei Buttons — *Kopieren* und *In WhatsApp öffnen* (`https://wa.me/{nummer}?text={encoded}`). Das öffnet WhatsApp mit vorgefülltem Text. **Sie drückt Senden.**

Das ist kein Kompromiss, sondern besser: Es kostet nichts, funktioniert heute, und erzwingt die Human-in-the-Loop-Regel aus §29 auf natürliche Weise. Die App protokolliert nur, dass ein Entwurf erzeugt wurde (`communications`), nicht ob er gesendet wurde — mit optionalem „Gesendet?"-Häkchen.

---

## D. Domain Model

### D.1 Entitäten und Beziehungen

```
                    ┌──────────────┐
                    │ organization │
                    └──────┬───────┘
                           │ 1:n (alles ist org-scoped)
        ┌──────────────────┼──────────────────┬───────────────┐
        │                  │                  │               │
   ┌────▼─────┐      ┌─────▼────┐       ┌─────▼─────┐  ┌──────▼──────┐
   │ caregiver│      │  family  │       │   task    │  │personal_item│
   └────┬─────┘      └─────┬────┘       └───────────┘  └─────────────┘
        │                  │ 1:n
        │            ┌─────▼──────┐         ┌──────────────────┐
        │            │ care_case  │────1:1──│ care_case_health │  ← Art. 9
        │            └─────┬──────┘         └──────────────────┘
        │                  │
        │  ┌───────────────┘
        │  │
   ┌────▼──▼─────┐
   │  placement  │  ← ersetzt „match"; Status proposed→…→ended
   └─────────────┘

   caregiver ──1:n── caregiver_language
   caregiver ──1:n── caregiver_skill ──n:1── skill (Katalog)
   caregiver ──1:n── caregiver_availability  (daterange, überlappungsfrei)
   care_case ──1:n── care_case_task ──n:1── care_task (Katalog)

   document      ──polymorph──► caregiver | family | care_case | placement
   note          ──polymorph──► dito, oder freistehend
   communication ──polymorph──► dito
```

### D.2 Zentrale Modellierungsentscheidungen

**`family` ≠ `care_case`.** Die Familie ist die *Kontakt- und Vertragspartei*. Der Pflegefall ist die *zu betreuende Person mit ihren Anforderungen*. Eine Familie kann zwei Fälle haben (Vater und Mutter), und ein Fall lebt über Jahre und viele Rotationen weiter. Das zu vermischen wäre der klassische CRM-Fehler.

**`placement` ist die Kern-Transaktion.** Eine Rotation = ein Placement. Nino im September–November und wieder im März = zwei Placement-Rows auf demselben Fall. Damit ergibt sich Historie, Umsatz und Zuverlässigkeit *kostenlos* aus dem Modell.

**Skills und Sprachen als Katalog + Junction.** Nicht als `text[]`. Grund: Sie werden wachsen, brauchen zweisprachige Labels, und Matching muss sie effizient joinen. Ein `text[]` mit georgischen Freitext-Werten wäre nach 3 Monaten Datenmüll.

**Verfügbarkeit als `daterange` mit Ausschluss-Constraint.** Postgres kann das nativ:
```sql
EXCLUDE USING gist (caregiver_id WITH =, period WITH &&) WHERE (kind = 'available')
```
Damit sind überlappende Verfügbarkeiten **datenbankseitig unmöglich**. Dasselbe für aktive Placements pro Pflegerin. Keine Anwendungslogik, kein Race Condition.

**Deutschniveau als `smallint 0–6`**, nicht als Enum. Grund: Es muss vergleichbar sein (`german_level >= required_level`). Ein Enum bräuchte eine Mapping-Funktion in jeder Query. Label-Mapping (`0=keine, 1=A1 … 6=C2`) lebt in i18n.

**Polymorphe Referenzen bei `document`/`note`/`communication`.** Bewusste Entscheidung gegen 4 separate Tabellen. Diese Objekte sind homogen, verhalten sich identisch und werden immer über `(owner_kind, owner_id)` abgefragt. Der Preis: keine FK-Integrität. Der Gegenwert: ein Viertel des Codes. Bei drei Entity-Typen wäre ich anderer Meinung — bei vier gleichartigen Anhängen ist Polymorphie richtig.

---

## E. Database Schema

Vollständiges DDL inklusive Enums, Constraints, Indizes, RLS-Policies und Trigger:
→ **[`DATABASE.sql`](./DATABASE.sql)**

Kurzüberblick über die Tabellen und die Abweichungen von deiner Liste:

| Tabelle | Zweck | Änderung ggü. §34 |
|---|---|---|
| `profiles` | User-Stammdaten | — |
| `organizations` | Mandant | — |
| `organization_members` | User ↔ Org ↔ Rolle | — |
| `caregivers` | Betreuungskräfte | — |
| `caregiver_languages` | Sprachen + Niveau | — |
| `caregiver_skills` | Fachkenntnisse | war `caregiver_skills` |
| `skills` | Katalog (ka/de-Labels) | **neu** — sonst Datenmüll |
| `caregiver_availability` | Zeiträume, überlappungsfrei | — |
| `families` | Kontakt-/Vertragspartei | — |
| `care_cases` | Pflegefall + Anforderungen | `case_requirements` **eingefaltet** |
| `care_case_health` | Diagnosen, Medikation (Art. 9) | **neu** — DSGVO-Isolation |
| `care_tasks` | Aufgabenkatalog | **neu** |
| `care_case_tasks` | Fall ↔ Aufgaben | **neu** |
| `placements` | Vorschlag → Einsatz → Ende | ersetzt `matches` + `placements` |
| `documents` | Dateien, polymorph | — |
| `communications` | Entwürfe & Verlauf | — |
| `tasks` | To-dos, Fristen | — |
| `notes` | Notizen, polymorph | — |
| `personal_items` | ჩემი | — |
| `voice_recordings` | Audio + Transkript, 30 T. Retention | **neu** — war implizit |
| `assistant_drafts` | AI-Vorschläge vor Bestätigung | **neu** — Kern von C.3 |
| `assistant_sessions` | Kontext-Stack, 30 T. Retention | ersetzt „AI Conversation Memory" |
| `ai_interactions` | Telemetrie **ohne Inhalte** | — |
| `domain_events` | Outbox | **neu** |
| `notifications` | In-App/Push-Queue | — |
| `audit_logs` | wer/was/wann | — |
| `app_settings` | Org-Einstellungen | war `settings` |
| ~~`matches`~~ | | **gestrichen** → K4 |
| ~~`case_requirements`~~ | | **gestrichen** → K5 |

**26 Tabellen.** Das ist für die Domäne angemessen — sechs davon sind Infrastruktur (Events, Audit, Telemetrie, Drafts, Sessions, Notifications), fünf sind Kataloge und Junctions.

---

## F. AI Architecture

### F.1 Die eiserne Regel

```
User Input
   → AI Interpretation
      → Zod Schema Validation        ← hier scheitert es, wenn überhaupt
         → Draft (eigene Tabelle, keine Business-Referenzen)
            → Menschliche Bestätigung ← nur bei Writes
               → Service Layer (Business-Logik, Invarianten)
                  → RLS
                     → Datenbank
```

Die AI erzeugt **niemals** SQL, **niemals** einen DB-Call, **niemals** eine finale Aktion. Sie erzeugt ausschließlich validierte Tool-Argumente. Das ist keine Vorsichtsmaßnahme — es ist die Architektur.

### F.2 Tool-Registry

```ts
export interface AssistantTool<TInput, TOutput> {
  name: string
  description: string                   // Modell-lesbar, kurz, präzise
  input: z.ZodType<TInput>
  effect: 'read' | 'draft' | 'write'
  confirmation: 'none' | 'undo' | 'card'
  summarize(input: TInput, t: Translator): ConfirmationCard   // rein deterministisch
  execute(ctx: RequestContext, input: TInput): Promise<TOutput>
}
```

| Tool | Intent | Effect | Bestätigung |
|---|---|---|---|
| `captureCaregiver` | CREATE_CAREGIVER | write | **Karte** |
| `updateCaregiver` | UPDATE_CAREGIVER | write | **Karte** (nur geänderte Felder) |
| `captureCase` | CREATE_FAMILY | write | **Karte** |
| `updateCase` | — | write | **Karte** |
| `findMatches` | SEARCH_MATCHES | read | keine |
| `searchRecords` | — | read | keine |
| `checkAvailability` | CHECK_AVAILABILITY | read | keine |
| `draftMessage` | WRITE_MESSAGE | draft | keine (Senden ist manuell) |
| `explainDocument` | EXPLAIN_DOCUMENT | read | keine |
| `translateText` | TRANSLATE | read | keine |
| `createTask` | CREATE_TASK | write | Undo-Toast |
| `createNote` | ADD_NOTE | write | Undo-Toast |
| `addPersonalItem` | — | write | Undo-Toast |
| `answer` | GENERAL_ASSISTANT | read | keine |

**Neue Intents hinzufügen** = eine Datei in `modules/assistant/tools/` + ein Registry-Eintrag. Der Router liest die Registry, der Prompt wird aus ihr generiert. Es gibt keine zweite Stelle zu ändern.

**Warum `summarize()` deterministisch ist:** Die Bestätigungskarte darf niemals von einem zweiten LLM-Call abhängen — das wäre langsam, teuer, und im Fehlerfall würde sie etwas bestätigen, das nicht dem entspricht, was gespeichert wird.

### F.3 Kontext & Speicher

Sie sagt: *„ნინო მაინც 15-ში მოვა"* („Nino kommt doch erst am 15.").

Die App muss wissen, welche Nino. Aber **nicht** durch Übergabe des Chatverlaufs — das ist teuer, unzuverlässig und vermischt Konversation mit Wahrheit.

**Lösung: Entity-Context-Stack.**

```ts
// assistant_sessions.context_stack — jsonb, max 10 Einträge, LRU
[
  { kind: 'caregiver', id: '…', label: 'ნინო', touchedAt: '2026-08-12T10:04:00Z' },
  { kind: 'care_case', id: '…', label: 'ოჯახი Müller', touchedAt: '…' }
]
```

Jede Ansicht und jede Speicherung schiebt ihre Entity auf den Stack. Bei der nächsten Äußerung gehen nur diese 10 kompakten Referenzen in den Prompt — nicht der Verlauf. Das Modell löst „Nino" gegen den Stack auf. Bei Mehrdeutigkeit (zwei Ninos) **fragt es nach**, statt zu raten.

**Businessdaten sind die einzige Wahrheit.** Sessions haben 30 Tage Retention und werden hart gelöscht. Kein Feature darf jemals von einer Session-Row abhängen.

### F.4 Fehlerbehandlung — dreistufig

```
Stufe 1  Schema-Fail        → 1 Retry, Validierungsfehler wird angehängt
Stufe 2  Immer noch Fail    → Klärungsfrage auf Georgisch, genau EINE Frage
Stufe 3  Weiterhin unklar   → Transkript als Notiz speichern
                              + manuelles Formular, vorbefüllt mit allem,
                                was extrahiert werden konnte
```

Nie eine Fehlermeldung. Nie ein Datenverlust. Nie „Etwas ist schiefgelaufen".

### F.5 Welche Funktionen brauchen AI — und welche nicht

Das war eine explizite Frage aus §22.

| Funktion | AI? | Womit sonst |
|---|---|---|
| Sprache → Text | **Ja** | — |
| Intent-Erkennung | **Ja** (nano) | — |
| Feldextraktion aus Sprache | **Ja** (nano) | — |
| Deutscher Textentwurf | **Ja** (standard) | — |
| Dokument verstehen | **Ja** (vision) | — |
| Übersetzung mit Register | **Ja** (standard, gecacht) | — |
| Freitext-Suche → Filter | **Ja** (nano) | — |
| **Matching-Score** | **Nein** | Gewichtete Funktion in TS/SQL |
| **Match-Begründung** | **Nein** | i18n-Keys aus den Score-Beiträgen |
| **Verfügbarkeitsprüfung** | **Nein** | `daterange` Overlap in SQL |
| **Pipeline-Status** | **Nein** | Zustandsmaschine |
| **Fehlende Felder erkennen** | **Nein** | Schema-Diff |
| **Fristen aus Datum berechnen** | **Nein** | date-fns |
| **Statistiken** | **Nein** | SQL Aggregat |
| **Suche nach Name** | **Nein** | `pg_trgm` |
| **Erinnerungen** | **Nein** | Cron + `tasks` |
| **UI-Texte** | **Nein** | i18n-Dateien |

Etwa **zwei Drittel der Produktfunktionalität kommt ohne AI aus.** Das ist der Grund, warum der Betrieb unter 10 $/Monat bleibt.

### F.6 Suche

```
„მაჩვენე ყველა, ვინც სექტემბრიდან თავისუფალია და დემენციის გამოცდილება აქვს"
                          ↓  nano-Modell
{ availableFrom: "2026-09-01", skills: ["dementia"], status: ["available","new"] }
                          ↓  Zod
                          ↓  SQL — deterministisch, indexiert
```

Ein LLM-Call übersetzt Sprache in Filter. Danach ist es normales SQL. **Keine Vector Search** — sie ist für Daten, die klassisch filterbar sind, teurer, langsamer und ungenauer.

Namenssuche über `pg_trgm`, nicht über `tsvector`: Postgres-Volltextsuche hat keine georgische Sprachkonfiguration, Trigramme funktionieren skriptunabhängig und decken Tippfehler mit ab.

### F.7 Der Dokumenten-Erklärer

```ts
const DocumentExplanation = z.object({
  documentType: z.enum(['krankenkasse','rente','finanzamt','auslaenderbehoerde',
                        'arbeitsagentur','vermieter','versicherung','rechnung',
                        'mahnung','arzt','sonstiges']),
  sender:       z.string(),
  subject_ka:   z.string(),
  summary_ka:   z.string(),
  whatTheyWant_ka: z.string(),
  deadline:     z.object({ date: z.string().date(), what_ka: z.string() }).nullable(),
  actionRequired: z.boolean(),
  nextSteps_ka: z.array(z.string()).max(4),
  advisoryLevel: z.enum(['information','sensitive']),   // ← s.u.
  amounts:      z.array(z.object({ label_ka: z.string(), amountEur: z.number() })),
})
```

**`advisoryLevel: 'sensitive'`** wird gesetzt bei rechtlichen, steuerlichen, aufenthaltsrechtlichen oder medizinischen Inhalten. Dann zeigt die UI zusätzlich einen ruhigen, nicht-alarmierenden Hinweis auf Georgisch:

> *„ეს ოფიციალური წერილია. მე გითარგმნე და ავხსენი — მაგრამ გადაწყვეტილებამდე ჯობია სპეციალისტს გაესაუბრო."*
> („Das ist ein offizieller Brief. Ich habe ihn übersetzt und erklärt — aber vor einer Entscheidung sprichst du besser mit einer Fachperson.")

Und darunter: `[ Erinnerung anlegen ]`. Der Hinweis erzeugt eine Handlung statt Angst.

**Klare Trennung im UI**, wie in §8 gefordert: Übersetzung / Zusammenfassung / allgemeine Information sind drei sichtbar getrennte Blöcke. Es gibt keinen Block „Beratung".

### F.8 „Schreib das für mich"

Eingabe: Georgische Sprachnachricht + optional Empfängerkontext.
Ausgabe: **immer vier Varianten**, nie eine.

```
┌──────────────────────────────────────┐
│  ● WhatsApp, freundlich    ← Default │
│  ○ WhatsApp, geschäftlich            │
│  ○ E-Mail, formell                   │
│  ○ Ganz kurz                         │
├──────────────────────────────────────┤
│  Guten Tag Frau Müller,              │
│  Nino könnte am Montag anfangen.     │
│  Eine Frage hätte sie noch: …        │
├──────────────────────────────────────┤
│  ⌄ რას ნიშნავს ეს ქართულად          │  ← Rückübersetzung!
├──────────────────────────────────────┤
│  [ კოპირება ]  [ WhatsApp ]          │
└──────────────────────────────────────┘
```

**Die Rückübersetzung ist nicht optional.** Sie muss verstehen, was in ihrem Namen gesagt wird, bevor sie es sendet. Ohne diesen Block ist das Feature ein Vertrauensproblem. Vier Varianten in einem Call (strukturierte Ausgabe), nicht vier Calls.

### F.9 Matching Engine

**Stufe 1 — Harte Filter (SQL, `WHERE`):**
```sql
status IN ('available','new')
AND deleted_at IS NULL
AND EXISTS (verfügbarer Zeitraum überschneidet Einsatzbeginn ± 21 Tage)
AND NOT EXISTS (aktives Placement im selben Zeitraum)
AND (NOT case.driver_license_required OR caregiver.driver_license)
AND (case.smoking_allowed OR caregiver.smoker IS NOT TRUE)
```

Nur **vier** harte Kriterien. Alles andere ist weich. Grund: Harte Filter verstecken Kandidatinnen, und eine versteckte Kandidatin ist schlimmer als eine schlecht bewertete — sie kann nicht diskutiert werden.

**Stufe 2 — Gewichteter Score (0–100, TypeScript, testbar):**

| Dimension | Punkte | Berechnung |
|---|---|---|
| Verfügbarkeitspassung | 25 | Abstand zum Wunschstart, linear abfallend über 30 Tage |
| Pflegekompetenz | 25 | Deckung der benötigten Skills (Demenz, Bettlägerigkeit, Mobilisation …) |
| Deutschniveau | 15 | `min(1, level / required)`, Bonus bei Übererfüllung gedeckelt |
| Erfahrung | 10 | `log(1 + jahre) / log(11)`, gedeckelt bei 10 Jahren |
| Aufgabendeckung | 10 | Kochen, Haushalt, Fahren gegen `care_case_tasks` |
| Präferenzpassung | 10 | Wünsche beider Seiten, Tiere, Nachtarbeit, Rotation |
| Verlässlichkeit | 5 | aus Placement-Historie; ohne Historie neutral 60 % |

**Coverage-Faktor:** Fehlende Daten senken den Score nicht auf 0, sondern reduzieren die *Sicherheit*. Die UI zeigt zwei Zahlen:

```
  ნინო → ოჯახი Müller
  ┌─────────────────────────────────────┐
  │  91 %      სანდოობა: 70 %           │   Score / Datensicherheit
  │  ✓ თავისუფალია 01.09-დან            │
  │  ✓ დემენციის გამოცდილება 4 წელი     │
  │  ✓ გერმანული A2 (საჭიროა A1)        │
  │  ⚠ ავტომობილი — არ ვიცით            │   ← fehlende Info
  │     [ დაამატე კითხვა ]              │   ← wird zu einem Task
  └─────────────────────────────────────┘
```

Fehlende Information wird zur **Handlung**, nicht zum Malus. Das ist der Mechanismus, der die Datenqualität über die Zeit von selbst verbessert — ohne dass sie jemals ein leeres Formular ausfüllen muss.

**Begründungen kosten kein AI.** Jeder Score-Beitrag mappt auf einen i18n-Key mit Parametern. Ein natürlichsprachiger Absatz wird nur auf Tippen von *„რატომ?"* generiert — und dann gecacht.

**Kein AI-Score, jetzt und in Phase 2 nicht.** Ein LLM, das „87 %" sagt, ist eine Zahl ohne Bedeutung, nicht reproduzierbar und im Streitfall nicht erklärbar. Erst in Phase 3, mit echter Historie, kommt eine zusätzliche Soft-Signal-Schicht dazu — als *separater, sichtbarer Summand*, nie als Ersatz.

---

## G. Security Model

### G.1 Bedrohungsmodell

Realistisch, nicht theatralisch:

| Bedrohung | Wahrscheinlichkeit | Maßnahme |
|---|---|---|
| Verlorenes/entwendetes Handy mit offener Session | **hoch** | App-Lock-PIN, kurze Signed-URL-TTL, keine sensiblen Daten in Push |
| Fehlkonfigurierter Storage-Bucket | **hoch** | Bucket privat per Migration, Test in CI, nie „public" |
| Datenabfluss über Logs | **mittel** | Strukturiertes Logging mit Redaction-Allowlist; nie Payloads loggen |
| Leck des Service-Role-Keys | mittel | Nur in 2 Server-Modulen, nie in Client-Bundles, Env-Validierung |
| AI-Provider als Datenempfänger | **sicher** (per Design) | AVV, EU-Endpunkt, Minimierung des gesendeten Kontexts |
| Prompt Injection aus hochgeladenem Dokument | mittel | → G.6 |
| Gezielter Angriff auf die App | niedrig | Standard-Härtung reicht |

### G.2 Auth & Autorisierung

Drei Schichten, alle drei aktiv:

1. **Middleware** — kein Zugriff ohne Session
2. **Service Layer** — jede Funktion erhält `RequestContext { userId, orgId, role }` und prüft die Rolle explizit
3. **RLS** — die Datenbank verweigert unabhängig davon, was der Code tut

RLS ist die Rückfalllinie, nicht die einzige Linie. Eine Anwendung, die sich allein auf RLS verlässt, hat keine Autorisierungslogik, nur Glück.

### G.3 RLS-Muster

Ein Muster für alle Tabellen:

```sql
create or replace function app.current_org_ids()
returns setof uuid language sql stable security definer
set search_path = public as $$
  select org_id from organization_members where user_id = (select auth.uid());
$$;

alter table caregivers enable row level security;

create policy caregivers_select on caregivers for select
  using (org_id in (select app.current_org_ids()));

create policy caregivers_modify on caregivers for all
  using (org_id in (select app.current_org_ids())
         and app.has_role(org_id, array['owner','staff']::org_role[]))
  with check (org_id in (select app.current_org_ids())
         and app.has_role(org_id, array['owner','staff']::org_role[]));
```

**Performance-Detail:** `(select auth.uid())` statt `auth.uid()` — die Subquery wird als InitPlan einmal ausgewertet statt pro Zeile. Bei 5.000 Zeilen ist das der Unterschied zwischen 3 ms und 300 ms.

### G.4 Besondere Kategorien (Art. 9 DSGVO)

Gesundheitsdaten der zu betreuenden Person sind **besondere Kategorien**. Umgang:

| Maßnahme | Umsetzung |
|---|---|
| Isolation | Freitext-Diagnosen und Medikation in `care_case_health`, eigene Tabelle |
| Minimierung | `care_cases` trägt nur die *operativ* nötigen groben Merkmale (Pflegegrad, Mobilität, Demenzstufe) — das Matching braucht nichts Feineres |
| Zugriff | Eigene Policy: nur `owner` (in Phase 2 auch `staff` mit explizitem Recht) |
| Audit | **Keine Feld-Diffs** in `audit_logs` für diese Tabelle — nur „wurde geändert", nie „von X auf Y" |
| Retention | Eigene, kürzere Löschfrist als der Rest des Falls |
| AI | Nur der minimal nötige Ausschnitt geht an ein LLM; nie der komplette Fall |
| Keine Spaltenverschlüsselung im MVP | pgsodium-Spaltenverschlüsselung macht Suche und Matching unmöglich; das Kosten-Nutzen-Verhältnis stimmt bei Supabase-Disk-Encryption + strenger RLS + EU-Region nicht. Die Isolation macht es **später nachrüstbar**, ohne Refactoring |

### G.5 AI-Provider als Auftragsverarbeiter

Sobald personenbezogene (und erst recht Gesundheits-) Daten an ein LLM gehen, ist der Anbieter Auftragsverarbeiter. Notwendig:

- **AVV/DPA** mit dem Anbieter (existiert bei allen großen)
- **Keine Nutzung zu Trainingszwecken** (API-Tiers der großen Anbieter erfüllen das)
- **EU-Verarbeitung bevorzugen**, sobald es geschäftlich wird → AWS Bedrock `eu-central-1`, Google Vertex `europe-west`, Azure OpenAI EU
- **Datenminimierung im Prompt:** kein „gib den ganzen Fall mit" — nur die Felder, die die Aufgabe braucht

Genau deshalb ist die Provider-Abstraktion aus C.4 kein Luxus: Der Wechsel von einer direkten Anbieter-API auf einen EU-gehosteten Endpunkt darf eine Konfigurationsänderung sein, kein Refactoring.

### G.6 Prompt Injection über hochgeladene Dokumente

Ein hochgeladener Brief ist **fremder Text**. Er kann Anweisungen enthalten („Ignoriere vorherige Anweisungen und …"). Das ist bei Behördenbriefen unwahrscheinlich, bei weitergeleiteten Mails aber nicht.

Maßnahmen:
- Dokumentinhalt wird im Prompt **als Daten markiert** und nie mit Systemanweisungen vermischt
- Der Dokumenten-Erklärer hat **keine Tools**. Er kann nur strukturierten Text zurückgeben. Selbst eine perfekte Injection kann nichts auslösen.
- Ausgabe wird gegen Zod validiert — freie Textfelder werden beim Rendern escaped, nie als HTML interpretiert

### G.7 Audit Log

Generischer Trigger, einmal geschrieben, auf allen Business-Tabellen aktiv:

```
audit_logs(id, org_id, actor_id, table_name, row_id, op, changed_fields jsonb, at)
```

- `changed_fields` enthält nur die tatsächlich geänderten Spalten als `{ spalte: [alt, neu] }`
- **Redaction-Liste** pro Tabelle: `care_case_health` loggt Spaltennamen, aber keine Werte
- Keine IP, kein User-Agent — nicht nötig, und Datensparsamkeit ist ein Prinzip, kein Slogan
- Darstellung im UI auf Georgisch: *„გერმანულის დონე A1 → A2, 12.08.2026"*

### G.8 Löschkonzept

| Objekt | Soft Delete | Hard Delete |
|---|---|---|
| Pflegerin / Familie / Fall | 30 Tage Papierkorb | Cron, kaskadierend, inkl. Storage-Objekten |
| Dokumente | sofort aus UI | 7 Tage, dann Storage-Objekt |
| Sprachaufnahmen | — | 30 Tage automatisch (Transkript bleibt) |
| Assistant-Sessions | — | 30 Tage automatisch |
| `ai_interactions` | — | 12 Monate (enthält keine Inhalte) |
| Audit Logs | — | 24 Monate |
| Konto vollständig löschen | — | Ein Button in Settings. Vollständig, kaskadierend, mit Bestätigung |

**Datenexport:** Ein Button erzeugt ein ZIP mit JSON aller Business-Daten + allen Dokumenten. Nicht nur DSGVO-Pflicht — es ist auch die Zusicherung, dass ihre Daten ihr gehören.

---

## H. Folder Structure

```
alubali/
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ DATABASE.sql
│  └─ ROADMAP.md
├─ supabase/
│  ├─ migrations/                    # nummeriert, versioniert, unveränderlich
│  └─ seed/                          # skills, care_tasks Kataloge
├─ public/
│  ├─ icons/                         # PWA, alle Größen
│  └─ fonts/                         # selbst gehostet — keine externen Requests
└─ src/
   ├─ app/
   │  ├─ [locale]/
   │  │  ├─ (app)/
   │  │  │  ├─ page.tsx              # Home
   │  │  │  ├─ business/…
   │  │  │  ├─ germany/…
   │  │  │  ├─ today/…
   │  │  │  ├─ me/…
   │  │  │  └─ layout.tsx
   │  │  ├─ onboarding/
   │  │  └─ layout.tsx
   │  ├─ api/
   │  │  ├─ voice/route.ts
   │  │  ├─ documents/route.ts
   │  │  └─ cron/[job]/route.ts
   │  └─ auth/
   │
   ├─ modules/                       # ── Domäne. Jedes Modul hat index.ts als Public API
   │  ├─ caregivers/
   │  │  ├─ index.ts                 # ← einziger erlaubter Importpfad von außen
   │  │  ├─ schema.ts                # Zod: Domäne + Formulare
   │  │  ├─ repository.ts            # DB-Zugriff, nur hier
   │  │  ├─ service.ts               # Geschäftslogik, Invarianten, Events
   │  │  ├─ actions.ts               # Server Actions (dünn)
   │  │  └─ ui/
   │  ├─ families/
   │  ├─ cases/
   │  ├─ matching/
   │  │  ├─ score.ts                 # rein, deterministisch, 100 % testbar
   │  │  ├─ filters.ts
   │  │  └─ reasons.ts
   │  ├─ placements/
   │  ├─ documents/
   │  ├─ assistant/
   │  │  ├─ router.ts                # Intent → Tool
   │  │  ├─ registry.ts
   │  │  ├─ tools/                   # ein File pro Tool
   │  │  ├─ context.ts               # Entity-Context-Stack
   │  │  └─ drafts.ts
   │  ├─ communication/
   │  ├─ personal/
   │  ├─ tasks/
   │  ├─ notifications/
   │  ├─ events/
   │  └─ audit/
   │
   ├─ core/                          # ── Querschnitt. Kennt KEINE Domäne
   │  ├─ ai/{types,router,cache,adapters/}
   │  ├─ speech/{types,adapters/}
   │  ├─ db/{server,client,types.generated.ts}
   │  ├─ auth/
   │  ├─ storage/
   │  ├─ i18n/{config,messages/{ka,de,en}}
   │  ├─ config/env.ts
   │  ├─ logging/
   │  └─ errors/
   │
   ├─ ui/                            # ── Design System. Kennt KEINE Domäne
   │  ├─ tokens/                     # Farben, Typo, Spacing, Motion
   │  ├─ primitives/                 # Button, Sheet, Field, Card…
   │  └─ patterns/                   # ConfirmationCard, VoiceButton, StatusRail…
   │
   └─ test/
```

**Abhängigkeitsregel, per ESLint erzwungen:**

```
app  →  modules  →  core
 ↓         ↓         ↓
 └───────► ui ◄──────┘

modules dürfen NICHT untereinander importieren, außer über index.ts.
core und ui dürfen NIEMALS modules importieren.
```

Das ist der einzige Grund, warum ein modularer Monolith nicht nach 6 Monaten zum Big Ball of Mud wird. Ohne maschinelle Durchsetzung ist es eine Absichtserklärung.

---

## I. MVP (V1)

### I.1 Umfang — genau sechs Features

| # | Feature | Enthält | Nicht enthalten |
|---|---|---|---|
| **1** | **Home + Voice-Erfassung** | 2×2-Raster, Voice-Overlay, Intent-Routing, Bestätigungskarte, Offline-Outbox | TTS, Streaming-Transkript |
| **2** | **Deutschland: Dokumenten-Erklärer** | Foto/Upload, Vision-Erklärung auf Georgisch, Fristen, Handlungsschritte, Erinnerung anlegen | Automatische Antwortbriefe |
| **3** | **Deutschland: Schreib das für mich** | 4 Varianten, Rückübersetzung, Kopieren, `wa.me`-Deep-Link | WhatsApp-API, Versandprotokoll |
| **4** | **Pflegerinnen** | Anlegen (Voice/Formular), Profil, Skills, Sprachen, Verfügbarkeit, Dokumente, Notizen, Suche | Kandidatinnen-Portal, Massenimport |
| **5** | **Familien & Fälle** | Anlegen, Bedarf strukturieren, Statusleiste, Dokumente, Notizen | Familien-Portal |
| **6** | **Matching + Einsätze** | Score, Begründungen, Kandidatenliste, Vorschlag → Placement, Statusverlauf | AI-Score, Lernen aus Historie |
| **+** | **ჩემი** | 6 Sammlungen, Karten, Favoriten, Voice-Erfassung | Preis-Tracking, Teilen |
| **+** | **Heute** | Aufgaben, Fristen, fehlende Infos, startende Einsätze | Kalendersync |
| **+** | **Fundament** | PWA, i18n (ka/de), Auth, RLS, Audit, Events, Kosten-Telemetrie, Export | Push, E-Mail |

### I.2 Explizit nicht im MVP

Buchhaltung · Lohn · Verträge · WhatsApp-API · Familien-Portal · Pflegerinnen-Portal · native Apps · ML · Microservices · Push · TTS · Englisch · Team-Funktionen · Vector Search · Realtime · Kalendersync · Massenimport

### I.3 Definition of Done für V1

- [ ] Auf ihrem tatsächlichen Handy installiert, mit Icon und Splash Screen
- [ ] Eine georgische Sprachaufnahme erzeugt in **unter 8 Sekunden** eine korrekte Bestätigungskarte
- [ ] Ein fotografierter deutscher Brief ist in **unter 12 Sekunden** auf Georgisch erklärt
- [ ] Feldgenauigkeit der Extraktion **≥ 85 %** auf 20 echten Testaufnahmen
- [ ] Matching liefert bei 20 Pflegerinnen / 5 Fällen plausible Ergebnisse in **< 300 ms**
- [ ] Kein einziger englischer oder deutscher String in der georgischen UI
- [ ] Alle RLS-Policies durch automatisierte Tests abgedeckt (Zugriff aus fremder Org schlägt fehl)
- [ ] Lighthouse PWA-Check bestanden, installierbar auf iOS **und** Android
- [ ] Vollständiger Datenexport funktioniert
- [ ] Sie bedient es **ohne jede Erklärung** — das ist der einzige Test, der wirklich zählt

---

## J. Phase 2 — Tiefe

Nach 4–8 Wochen realer Nutzung, priorisiert nach dem, was sie tatsächlich vermisst.

| Bereich | Feature |
|---|---|
| Business | Dokumenten-Ablaufwarnungen (Pass, A1, Versicherung) |
| Business | Rotationsplanung — Nachfolgerin für endenden Einsatz vorschlagen |
| Business | Einfache Kennzahlen: aktive Einsätze, offene Fälle, Provisionen, Auslastung |
| Business | Kommunikationsverlauf pro Familie/Pflegerin |
| Assistent | Georgische TTS — **wenn** eine gute Stimme gefunden ist |
| Assistent | Live-Teiltranskript während der Aufnahme |
| Assistent | Dokumenten-Antwortentwurf (deutscher Brief → deutscher Antwortentwurf) |
| Assistent | Ganze WhatsApp-Konversation einfügen → zusammenfassen + antworten |
| Plattform | Web Push |
| Plattform | E-Mail-Benachrichtigungen (Resend) |
| Plattform | Zweiter Nutzer: Rolle `staff` mit eingeschränkten Rechten |
| Plattform | Englisch als dritte Sprache |
| ჩემი | Web Share Target (Instagram/Browser → direkt in eine Sammlung) |
| ჩემი | Bilder-Upload und schönere Galerie |

---

## K. Phase 3 — Vom Geschenk zum Geschäft

Der Übergang ist bewusst so gestaltet, dass **nichts umgebaut** werden muss — nur ergänzt.

**Was schon da ist und den Übergang trägt:**
`organizations` + `organization_members` + Rollen · Audit Log · Event-Outbox · Provider-Adapter · RLS-Muster · Löschkonzept

**Was dazukommt:**

| Baustein | Inhalt |
|---|---|
| **Pflegerinnen-Portal** | Eigener Login mit Rolle `caregiver`, sieht nur sich selbst: Profil pflegen, Verfügbarkeit melden, Dokumente hochladen. Löst das größte operative Problem — Datenpflege delegieren |
| **Familien-Portal** | Rolle `family`, sieht nur den eigenen Fall: vorgeschlagene Kandidatinnen ansehen, Rückmeldung geben |
| **Öffentliches Anfrageformular** | Familie füllt aus → landet als `care_case` mit Status `new`. Der Kaltstart des Vertriebs |
| **WhatsApp Business API** | Erst wenn Volumen es rechtfertigt: Templates, Statusupdates, Erinnerungen |
| **Vertrags-/Dokumentenmappe** | Anwaltlich geprüfte Vorlagen, Ausfüllen aus Falldaten, Signatur extern |
| **Provisions- und Umsatzübersicht** | Aus Placements ableitbar, keine Buchhaltung |
| **Team** | Mehrere `staff`, Zuweisung von Fällen, Aktivitätsübersicht |
| **AI-Soft-Signal im Matching** | Erst jetzt, mit echter Historie: Embedding-Ähnlichkeit erfolgreicher Paarungen als **zusätzlicher, sichtbarer** Summand — nie als Ersatz für die Regeln |
| **Mandantenfähigkeit** | Falls sie das System an andere Vermittlerinnen lizenziert: bereits vorhanden, nur UI fehlt |

**Voraussetzungen, bevor Phase 3 startet:** Fachanwalt für Arbeits-/Entsenderecht, AVV mit allen Auftragsverarbeitern, Verzeichnis von Verarbeitungstätigkeiten, Datenschutzerklärung, Auftragsverarbeitungsverträge mit Kundenfamilien. → K11

---

## L. Risiken

### L.1 Technisch

| Risiko | Schwere | Gegenmaßnahme |
|---|---|---|
| **Georgisches STT zu ungenau** | **kritisch** | Spike M0 vor UI-Bau · Vocabulary-Bias aus DB · editierbare Bestätigungskarte macht Fehler billig · Provider-Adapter erlaubt Wechsel in Stunden |
| **iOS-Audioaufnahme in PWA** | hoch | Feature-Detection · `audio/mp4`-Pfad · Fallback auf `capture`-Input · **früh auf ihrem echten Gerät testen, nicht im Simulator** |
| Vision-Qualität bei schlechten Fotos | mittel | Client-Vorschau mit Qualitätshinweis · Kantenerkennung optional · Wiederholen ist billig |
| LLM-Schemafehler | mittel | Zod + Retry + Klärung + manuelles Fallback-Formular |
| Vercel-Timeout bei Vision | mittel | Route Handler mit `maxDuration` · asynchrones Muster mit Polling ab Phase 2 |
| Supabase Free Tier Pause bei Inaktivität | niedrig | Cron-Ping oder direkt Pro-Plan |

### L.2 UX

| Risiko | Schwere | Gegenmaßnahme |
|---|---|---|
| **Sie benutzt es nach 2 Wochen nicht mehr** | **kritisch** | Deutschland-Assistent zuerst (Wert ohne Setup) · ჩემი als emotionaler Anker · Nutzungstelemetrie **anonym**, damit du siehst, was tot ist |
| Bestätigungskarten fühlen sich wie Arbeit an | hoch | Nur bei Business-Writes · Notizen/Tasks laufen mit Undo durch · Karte muss schön sein, nicht funktional |
| Voice funktioniert an lauten Orten nicht | mittel | Tippen ist immer gleichberechtigt sichtbar · Rauschunterdrückung im `getUserMedia`-Constraint |
| Zu viele Felder wirken wie ein Formular | mittel | Bestätigungskarte zeigt nur erkannte Felder + max. 1 Nachfrage. Nie das ganze Schema |
| Sie traut den deutschen Texten nicht | mittel | Rückübersetzung ist Pflichtbestandteil, nicht optional |

### L.3 Datenschutz

| Risiko | Schwere | Gegenmaßnahme |
|---|---|---|
| **Art.-9-Daten unzureichend geschützt** | **hoch** | Isolation in eigener Tabelle · eigene Policy · Audit ohne Werte · Minimierung im Prompt |
| Übermittlung an AI-Anbieter ohne Rechtsgrundlage | hoch | AVV · kein Training · EU-Endpunkt spätestens ab Phase 3 · minimaler Prompt-Kontext |
| Dokumente im falschen Bucket | hoch | Bucket-Privatheit per Migration + CI-Test |
| Sensible Inhalte in Logs | mittel | Logging-Wrapper mit Allowlist; Payloads niemals |
| Kein Löschkonzept in der Praxis | mittel | Cron-Jobs ab Tag 1, nicht „später" |

### L.4 AI

| Risiko | Schwere | Gegenmaßnahme |
|---|---|---|
| **Halluzinierte Pflegedaten** | **hoch** | Schema erlaubt `null` überall · Prompt-Regel „nur was gesagt wurde" · Transkript immer einsehbar · unsichere Felder gold markiert |
| Erklärung wirkt wie Rechtsberatung | hoch | `advisoryLevel` · sichtbare Trennung Übersetzung/Zusammenfassung/Information · nie ein Block „Beratung" |
| Falsche Entity-Auflösung („welche Nino?") | mittel | Context-Stack statt Verlauf · bei Mehrdeutigkeit **fragen**, nie raten |
| Prompt Injection aus Dokumenten | mittel | Erklärer hat keine Tools · Inhalt als Daten markiert · Zod + Escaping |
| Kostenexplosion | niedrig | 1 Call pro Aktion · Caches · Budget-Cap |

### L.5 Produkt

| Risiko | Schwere | Gegenmaßnahme |
|---|---|---|
| **„Mein Freund hat mir ein CRM gebaut"** | **kritisch** | Persönliches Onboarding · ჩემი gleichberechtigt · Design ohne jeden Software-Look · Business erst beim zweiten Blick |
| Scope-Explosion, nie fertig | hoch | 6 Features. Roadmap mit harten Phasengrenzen. Alles andere in eine Datei `LATER.md`, nicht in den Code |
| Rechtliche Kanten des Geschäftsmodells | hoch | Keine Arbeitgeber-Features · sensible Kriterien als Präferenz · Anwalt vor Phase 3 |
| Sie will Features, die du nicht vorhergesehen hast | mittel | **Das ist kein Risiko, das ist der Plan.** Modularer Aufbau, damit ein neues Tool ein neues File ist |

---

## M. Weitere Verbesserungen

Die zwölf substanziellen Korrekturen stehen in **0.1**. Ergänzend:

**M1 — Nutze ihre eigenen Daten als STT-Verbesserung.** Der `vocabulary`-Parameter (→ C.5) ist der billigste Qualitätshebel im System und existiert in keinem Standardprodukt.

**M2 — Fehlende Information ist ein Feature.** Statt Pflichtfelder erzeugt jede Lücke eine Frage in „Heute". Datenqualität wächst durch Benutzung, nicht durch Zwang. (→ F.9)

**M3 — Zeige zwei Zahlen beim Match, nicht eine.** Score und Datensicherheit. Ein 95-%-Match auf Basis von drei bekannten Feldern ist gefährlicher als ein ehrliches „91 %, Sicherheit 70 %".

**M4 — Die Rückübersetzung bei „Schreib das für mich" ist nicht verhandelbar.** Ohne sie unterschreibt sie blind.

**M5 — Baue die Kosten-Telemetrie am Tag 1, nicht am Tag 100.** `ai_interactions` ist 20 Zeilen Code und erspart dir später ein Rätselraten über Rechnungen.

**M6 — Selbst gehostete Fonts, keine externen Requests.** Google Fonts als CDN ist in Deutschland datenschutzrechtlich umstritten und außerdem langsamer. `next/font/local`, fertig.

**M7 — Anonyme Nutzungstelemetrie über Feature-Nutzung.** Nur Ereignisnamen und Zeitstempel, keine Inhalte. Sonst weißt du nie, welche Hälfte der App tot ist — und sie wird es dir nicht sagen.

**M8 — Ein `LATER.md` im Repo.** Jede Idee, die während des Baus kommt, wandert dorthin statt in den Code. Das ist die einzige wirksame Maßnahme gegen Scope Creep bei einem Projekt ohne Deadline.

---

## Final Recommended Architecture

Die verbindlichen Entscheidungen.

### Stack

| Ebene | Entscheidung |
|---|---|
| **Framework** | Next.js (aktuelle stabile Version), App Router, React Server Components |
| **Sprache** | TypeScript, `strict: true` |
| **Styling** | Tailwind CSS v4 mit CSS-first Design Tokens |
| **Komponenten** | Eigenes Design System auf Radix-Primitives. shadcn/ui **nur** als Codequelle für Dialog/Sheet/Popover/Select, vollständig umgestylt |
| **Motion** | `motion` (Framer Motion), lazy geladen, nur Voice-Overlay + Karten + Easter Eggs |
| **Formulare** | React Hook Form + Zod Resolver |
| **i18n** | `next-intl`, `[locale]`-Segment, Default `ka`, dann `de`, später `en` |
| **PWA** | Serwist |
| **Fehler** | Sentry |
| **Tests** | Vitest (Matching, Extraktion, Schemas) + Playwright (Voice-Flow, RLS) |

### Datenbank

| Aspekt | Entscheidung |
|---|---|
| **DB** | Supabase PostgreSQL, **Region EU (Frankfurt)** |
| **Zugriff** | `supabase-js` mit User-JWT — RLS greift immer. **Kein ORM** |
| **Migrationen** | SQL in `supabase/migrations/`, versioniert, in Git |
| **Typen** | `supabase gen types typescript` → `core/db/types.generated.ts` |
| **Komplexe Queries** | Postgres-Funktionen (`security invoker`) via RPC |
| **Service Role** | Ausschließlich in `modules/events/drainer.ts` und `app/api/cron/*` |
| **Erweiterungen** | `pg_trgm` (Namenssuche), `btree_gist` (Ausschluss-Constraints), `pgcrypto` |

### Auth

Supabase Auth · Google OAuth primär · Magic Link Fallback · `@supabase/ssr` Cookie-Sessions · lange Refresh-Tokens · optionaler lokaler App-Lock-PIN · Rollen in `organization_members`, nicht im JWT

### AI

| Aspekt | Entscheidung |
|---|---|
| **Architektur** | Provider-Adapter + Model Router. Business Code kennt keinen Anbieter |
| **`nano`** | Claude Haiku 4.5 (primär) → Gemini Flash-Lite (Fallback) |
| **`standard`** | Claude Sonnet 5 (primär) → GPT-Klasse mittel (Fallback) |
| **`vision`** | Claude Sonnet 5 Vision (primär) → Gemini Flash Vision (Fallback) |
| **Opus** | **Nie.** Keine Aufgabe rechtfertigt es |
| **Strukturierte Ausgabe** | Tool Use / Function Calling, immer Zod-validiert |
| **OCR** | Keines. Vision-LLM direkt |
| **Kontext** | Entity-Context-Stack (max. 10), nie Chatverlauf |
| **Budget** | 1 Call pro Aktion · Übersetzungs- und Dokument-Cache · Telemetrie · Soft-/Hard-Cap |
| **EU** | Ab Phase 3 auf Bedrock `eu-central-1` bzw. Vertex `europe-west` umstellen — Konfigurationsänderung |

### Speech

| Aspekt | Entscheidung |
|---|---|
| **STT** | Adapter-Interface. Providerwahl **nach Spike M0** entschieden, nicht vorher |
| **Kandidaten** | OpenAI (`whisper-1` / `gpt-4o-transcribe`) · Google Chirp · Azure Speech `ka-GE` · ElevenLabs Scribe · Gemini nativ-Audio |
| **Bias** | Namen aus der DB als `vocabulary` an jeden Provider |
| **Format** | Opus 16 kHz mono ~24 kbps; iOS-Fallback `audio/mp4` |
| **TTS** | Interface definiert, **im MVP nicht implementiert** |
| **Übersetzung** | Über LLM (`standard`), nicht über einen separaten MT-Dienst — Register und Kontext zählen mehr als Rohqualität |

### Storage

Supabase Storage · ein privater Bucket `documents` · Pfad `{org_id}/{owner_kind}/{owner_id}/{uuid}.{ext}` · Signed URLs 60 s, nur serverseitig · Client-Kompression vor Upload · Audio in `voice/` mit 30-Tage-Cron-Löschung

### Hosting

Vercel, Region `fra1` · Supabase EU Frankfurt · eigene Domain · alle Fonts selbst gehostet · keine externen Laufzeit-Requests

### Design System

| Element | Entscheidung |
|---|---|
| **Grundton** | Warmes Off-White `#FAF7F3` / tiefes Warmschwarz `#12100F` |
| **Primärakzent** | Tiefes Weinrot / Alubali `#7A1F2B` — trägt das Motiv, ohne es auszusprechen |
| **Sekundär** | Gedämpftes Gold `#C6A667` — nur für Hairlines, Fokus, Hervorhebung. Nie flächig |
| **Business-Bereich** | Kühler, strenger, mehr Struktur, Gold nur als Linie |
| **ჩემი-Bereich** | Wärmer, Champagner-Rosé `#E8CFC5`, größere Bilder, weniger Struktur |
| **Typografie Body** | Eine Familie mit Latin **und** Georgisch. Kandidaten: **FiraGO**, Noto Sans Georgian |
| **Typografie Display** | Noto Serif Georgian oder eine BPG-Familie (Lizenz prüfen) |
| **Verboten** | `text-transform: uppercase` global · positives Tracking auf Georgisch · `line-height` < 1.5 im Fließtext |
| **Motion** | 280–420 ms, `ease-out-expo`, keine Federn, kein Bounce, keine Rotation |
| **Radien** | Großzügig (16–24 px), konsistent — der wichtigste Einzelfaktor gegen den Admin-Template-Look |
| **Schatten** | Sehr weich, sehr niedrig deckend. Nie mehr als zwei Ebenen |
| **Icons** | Eine Familie, dünnes Gewicht (Lucide, angepasst) |

### Projektstruktur

Wie in **H**. Verbindlich, per `eslint-plugin-boundaries` durchgesetzt.

### MVP-Umfang

Wie in **I**. **Sechs Features.** Alles Weitere geht in `LATER.md`.

---

## Implementation Roadmap

Reihenfolge für den tatsächlichen Bau. Jeder Meilenstein ist einzeln lauffähig und einzeln überprüfbar.

### M0 — Spikes (vor jeder Zeile Produktcode) · ~1–2 Tage

Der wichtigste Meilenstein. Er verhindert, dass ein Monat Arbeit auf einer falschen Annahme steht.

1. **STT-Benchmark.** 20 echte Sprachaufnahmen von ihr (typische Sätze: Pflegerin beschreiben, Termin ändern, Frage stellen). Gegen mindestens 3 Provider. Metrik: **Feldgenauigkeit**, nicht WER. → Providerentscheidung
2. **Feldextraktion.** Dieselben 20 Transkripte durch `nano`-Modelle. Metrik: korrekt befüllte Felder in Prozent. Ziel ≥ 85 %.
3. **iOS-Aufnahme.** Minimale Seite, auf **ihrem** iPhone/Android installiert. Aufnehmen, hochladen, transkribieren. Muss funktionieren, bevor irgendein UI existiert.
4. **Georgische Typografie.** Ein statisches Muster mit echten georgischen Texten in den Font-Kandidaten. Auf dem Gerät ansehen. Entscheidung: Fontfamilie.
5. **Vision auf echtem Brief.** Ein echter deutscher Behördenbrief, abfotografiert. Erklärung prüfen.

**Abbruchkriterium:** Wenn Feldgenauigkeit unter 70 % liegt, wird die Produktstrategie angepasst (mehr Formular, weniger Voice), bevor gebaut wird — nicht danach.

### M1 — Fundament · ~2–3 Tage
Repo, Next.js, TypeScript strict, Tailwind v4, ESLint mit Boundaries · Env-Validierung · Supabase-Projekt EU · Auth (Google + Magic Link) · Middleware · `next-intl` mit `ka`/`de` · Fonts lokal · Sentry · Deployment auf Vercel `fra1`
→ *Ergebnis: Leere, aber installierbare, eingeloggte App auf ihrem Handy.*

### M2 — Datenbank & Sicherheit · ~2–3 Tage
Alle Migrationen aus `DATABASE.sql` · Enums, Constraints, Indizes, Ausschluss-Constraints · RLS auf allen Tabellen · Audit-Trigger · Storage-Bucket privat + Policies · Kataloge seeden (Skills, Aufgaben) · **Playwright-Tests: Zugriff aus fremder Org schlägt fehl**
→ *Ergebnis: Ein sicheres, leeres Datenmodell mit beweisbaren Policies.*

### M3 — Design System · ~3–4 Tage
Tokens · Primitives (Button, Field, Card, Sheet, Segmented, StatusRail) · Bestätigungskarten-Pattern · Voice-Button · Home mit 2×2-Raster · Motion-Grundlagen · PWA (Manifest, Icons, Splash, Serwist)
→ *Ergebnis: Die App sieht bereits aus wie das Endprodukt. Nichts funktioniert.*

**Hier zeigst du ihr zum ersten Mal etwas.** Nicht früher.

### M4 — Voice-Pipeline · ~4–5 Tage
`core/speech` Adapter (Provider aus M0) · `core/ai` Adapter + Model Router + Cache · Recorder mit iOS-Fallback · `/api/voice` · Tool-Registry · Router · **Tools: `createNote`, `createTask`, `answer`** · `assistant_drafts` · Bestätigungskarte end-to-end · Offline-Outbox · `ai_interactions`-Telemetrie
→ *Ergebnis: Sie spricht Georgisch, es entsteht eine strukturierte Notiz. Die Kernmechanik lebt.*

### M5 — Deutschland-Assistent · ~4–5 Tage
Dokument-Upload + Client-Kompression · Vision-Erklärer mit `DocumentExplanation`-Schema · Dokument-Cache · Erklärungs-UI mit getrennten Blöcken + `advisoryLevel` · Frist → Task · „Schreib das für mich" mit 4 Varianten + Rückübersetzung · Kopieren + `wa.me` · Freie Übersetzung
→ *Ergebnis: **Die App ist ab hier bereits verschenkbar.** Sie liefert echten Wert ohne eine einzige Dateneingabe.*

### M6 — Pflegerinnen · ~4–5 Tage
CRUD + Formulare · Skills, Sprachen, Verfügbarkeit (daterange-UI) · Dokumente · Notizen · Suche (trgm + AI-Filter) · Vollständigkeitsanzeige · **Tools: `captureCaregiver`, `updateCaregiver`, `searchRecords`, `checkAvailability`**
→ *Ergebnis: Voice-Erfassung einer Pflegerin funktioniert vollständig.*

### M7 — Familien, Fälle & Matching · ~5–6 Tage
Familien + Fälle CRUD · `care_case_health` mit eigener Policy · Aufgabenkatalog · Statusleiste · **Matching-Engine** (Filter + Score + Reasons, vollständig unit-getestet) · Kandidatenliste mit Score und Sicherheit · Vorschlag → `placement` · Placement-Verlauf · **Tools: `captureCase`, `updateCase`, `findMatches`**
→ *Ergebnis: Das Geschäft läuft in der App.*

### M8 — ჩემი, Heute & Easter Eggs · ~3–4 Tage
Sammlungen + Karten + Favoriten · Voice-Erfassung persönlicher Items · warmes Alternativ-Theme · „Heute" aus Tasks, Fristen, Lücken, startenden Einsätzen · Event-Outbox-Drainer + Cron · alle fünf Easter Eggs
→ *Ergebnis: Es ist ein Geschenk, nicht ein Werkzeug.*

### M9 — Onboarding, Politur, Übergabe · ~3–4 Tage
Onboarding-Flow (< 60 s) · alle Leerzustände mit Persönlichkeit statt „Keine Daten" · alle Fehlerzustände mit Weg vorwärts · Löschungs-Cronjobs · Datenexport · Konto löschen · Lighthouse · echter Gerätetest · **georgisches Sprachlektorat durch einen Muttersprachler** (nicht durch AI)
→ *Ergebnis: V1.*

### Gesamtaufwand

**~32–42 Arbeitstage** bei fokussierter Arbeit. Realistisch mit Claude Code als Umsetzungspartner: **6–9 Wochen** nebenher.

**Der erste verschenkbare Zustand ist nach M5** — das ist bewusst so gelegt.

---

### Was als Nächstes passiert

Bevor Code entsteht, brauche ich von dir:

1. **Freigabe oder Widerspruch** zu den zwölf Korrekturen in 0.1 — besonders K1 (Kacheln), K3 (Baureihenfolge) und K11 (rechtliche Grenzen des Funktionsumfangs)
2. **Namensentscheidung** — ALUBALI oder eine Alternative
3. **Start von M0** — dafür brauche ich 20 Sprachaufnahmen von ihr. Das ist der einzige Punkt, der ohne dich nicht vorangeht, und er ist der wichtigste.
