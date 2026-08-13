# ALUBALI — Implementation Roadmap

> Reihenfolge, in der das Projekt tatsächlich gebaut wird.
> Jeder Meilenstein ist einzeln lauffähig, einzeln testbar und einzeln vorzeigbar.
> Referenz: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`DATABASE.sql`](./DATABASE.sql)

**Regel für den gesamten Bau:** Jede Idee, die unterwegs entsteht und nicht im
aktuellen Meilenstein steht, wandert nach `LATER.md`. Nicht in den Code.

---

## M0 — Spikes · ~1–2 Tage

**Ziel:** Beweisen, dass die drei riskanten Annahmen tragen — *bevor* Produktcode entsteht.
Dies ist der wichtigste Meilenstein des gesamten Projekts.

### M0.1 — STT-Benchmark (Georgisch)
- 20 echte Sprachaufnahmen von ihr sammeln. Verteilung:
  - 8× Pflegerin beschreiben (Name, Alter, Erfahrung, Sprache, Datum)
  - 4× Familie/Fall beschreiben
  - 4× Änderung ("Nino kommt erst am 15.")
  - 4× freie Frage / Notiz
- Provider durchtesten: OpenAI (`whisper-1`, `gpt-4o-transcribe`), Google Chirp,
  Azure Speech `ka-GE`, ElevenLabs Scribe, Gemini nativ-Audio
- Jeweils mit und ohne `vocabulary`-Bias (Namensliste)
- **Metrik: Feldgenauigkeit**, nicht WER — wie oft sind Name, Zahl und Datum korrekt?
- Ergebnis in `docs/spikes/stt-benchmark.md` festhalten

**Akzeptanz:** Ein Provider ist gewählt und begründet. Feldgenauigkeit ≥ 85 %.
**Abbruchkriterium:** Unter 70 % → Produktstrategie anpassen (Formular-lastiger,
Voice als Ergänzung statt Primärweg), bevor gebaut wird.

### M0.2 — Extraktions-Spike
- Dieselben 20 Transkripte durch `nano`-Modelle mit dem Caregiver-Zod-Schema
- Prüfen: Werden `null` und "nicht gesagt" korrekt unterschieden? Wird halluziniert?
- **Akzeptanz:** ≥ 85 % korrekt befüllte Felder, **0 halluzinierte Werte**

### M0.3 — iOS/Android-Aufnahme-Spike
- Eine einzelne statische Seite, deployed, auf **ihrem echten Gerät** zum Homescreen hinzugefügt
- Aufnehmen → hochladen → transkribieren → Text anzeigen
- Prüfen: MediaRecorder-Verfügbarkeit, Codec, Mikrofonberechtigung nach App-Neustart
- **Akzeptanz:** Funktioniert auf ihrem Gerät. Kein Simulator, kein Desktop.

### M0.4 — Typografie-Spike
- Statische Seite mit echten georgischen Texten (Überschriften, Fließtext, Zahlen,
  gemischt Georgisch/Deutsch in einer Zeile) in FiraGO, Noto Sans Georgian,
  Noto Serif Georgian, BPG-Kandidaten
- Auf dem Gerät ansehen, nicht am Monitor
- **Akzeptanz:** Eine Body- und eine Display-Familie sind gewählt, Lizenz geklärt

### M0.5 — Vision-Spike
- Ein echter deutscher Behördenbrief, mit dem Handy fotografiert (schräg, mittelmäßiges Licht)
- Durch `vision`-Modell mit dem `DocumentExplanation`-Schema
- **Akzeptanz:** Absender, Anliegen und Frist korrekt; georgische Erklärung verständlich

---

## M1 — Fundament · ~2–3 Tage

- Next.js-Projekt, TypeScript `strict`, Tailwind v4
- ESLint + `eslint-plugin-boundaries` mit den Regeln aus ARCHITECTURE.md H
- `core/config/env.ts` — Zod-validierte Umgebungsvariablen, Build bricht bei fehlenden Keys
- Supabase-Projekt **Region EU (Frankfurt)** anlegen
- Auth: Google OAuth + Magic Link, `@supabase/ssr`, Middleware-Schutz
- `next-intl` mit `[locale]`-Segment, `ka` als Default, `de` als zweite Sprache
- Fonts lokal einbinden via `next/font/local` — keine externen Requests
- Sentry
- Deployment Vercel Region `fra1`, eigene Domain
- PWA-Grundgerüst: Manifest, Icons, Splash, Serwist

**Akzeptanz:** Sie kann sich auf ihrem Handy einloggen, die App zum Homescreen
hinzufügen und sieht einen leeren, aber korrekt lokalisierten Bildschirm.

---

## M2 — Datenbank & Sicherheit · ~2–3 Tage

- `DATABASE.sql` in nummerierte Migrationen aufteilen (`supabase/migrations/`)
- Alle Tabellen, Enums, Constraints, Indizes, Ausschluss-Constraints
- RLS auf **allen** Tabellen aktiv, Policies nach dem Muster in G.3
- Audit-Trigger auf allen Business-Tabellen, Redaction für `care_case_health`
- Event-Trigger auf `placements`
- Storage-Bucket `documents` **privat** anlegen (per Migration, nicht per Klick)
- Kataloge seeden: `skills` (~25 Einträge), `care_tasks` (~20 Einträge), zweisprachig
- `supabase gen types` → `core/db/types.generated.ts`, in CI aktualisiert

**Tests (Playwright/Vitest, verbindlich):**
- Nutzer aus Org A kann keine Zeile aus Org B lesen — für jede Tabelle
- `staff` kann `care_case_health` nicht lesen
- Anonymer Zugriff auf den Storage-Bucket schlägt fehl
- Überlappende Verfügbarkeiten werden von der DB abgelehnt
- Überlappende aktive Placements werden von der DB abgelehnt

**Akzeptanz:** Alle Sicherheitstests grün. Ohne diese Tests geht es nicht weiter.

---

## M3 — Design System · ~3–4 Tage

- `ui/tokens/` — Farben (Light/Dark), Typografie-Skala, Spacing, Radien, Schatten, Motion
- Globale Regel: **keine `uppercase`-Utility existiert im System**
- `ui/primitives/` — Button, IconButton, Field, TextField, Select, Card, Sheet,
  SegmentedControl, Chip, Avatar, Skeleton, Toast, StatusRail
- `ui/patterns/` — ConfirmationCard, VoiceButton, EmptyState, ScoreBadge, SectionHeader
- Home-Screen: 2×2-Raster (Business / Deutschland / Heute / Ich) + Voice-Button
- Zwei Themes: Business (kühl, strukturiert) und Persönlich (warm, luftig)
- Motion-Grundlagen mit `motion`, lazy geladen
- Alle Leerzustände mit Persönlichkeit statt "Keine Daten"

**Akzeptanz:** Die App sieht bereits aus wie das fertige Produkt. Nichts funktioniert.
**→ Das ist der Moment, an dem du ihr zum ersten Mal etwas zeigst.**

---

## M4 — Voice-Pipeline · ~4–5 Tage

Der architektonische Kern. Wenn dieser Meilenstein sauber ist, sind alle
folgenden Features nur noch neue Tools.

- `core/speech/` — Interface + Adapter für den in M0 gewählten Provider
- `core/ai/` — Provider-Interface, Adapter (Anthropic + ein Fallback), Model Router, Cache
- `modules/assistant/registry.ts` — Tool-Registry mit Zod-Schemas
- `modules/assistant/router.ts` — Intent-Routing mit Kontext-Prior
- `modules/assistant/context.ts` — Entity-Context-Stack (max. 10, LRU)
- **Erste drei Tools:** `createNote`, `createTask`, `answer`
- Recorder-Komponente: tap-to-start, Waveform, Timer, Auto-Stop bei Stille,
  iOS-Codec-Fallback, `<input capture>`-Fallback
- `POST /api/voice` — Upload → Transkript → Routing → Draft
- `assistant_drafts` + Bestätigungskarte end-to-end
- Fehlerkette: Schema-Fail → Retry → Klärungsfrage → manuelles Formular
- Offline-Outbox in IndexedDB + Retry
- `ai_interactions`-Telemetrie ab dem ersten Call

**Akzeptanz:** Sie spricht 20 Sekunden Georgisch, bekommt in unter 8 Sekunden
eine Bestätigungskarte, korrigiert ein Feld, tippt Speichern — und die Notiz steht.

---

## M5 — Deutschland-Assistent · ~4–5 Tage

**Ab hier ist die App verschenkbar.** Sie liefert echten Wert ohne eine einzige
Dateneingabe. Deshalb steht dieser Meilenstein vor dem Business-Teil.

### M5.1 — Dokumenten-Erklärer
- Foto/Datei-Upload mit clientseitiger Kompression (max. 2000 px, JPEG q0.82)
- Vision-Aufruf mit `DocumentExplanation`-Schema
- Dokument-Cache über `sha256(datei)`
- Erklärungs-UI: sichtbar getrennte Blöcke *Übersetzung / Zusammenfassung / Information*
- `advisoryLevel: 'sensitive'` → ruhiger Hinweis + Button "Erinnerung anlegen"
- Frist erkannt → `task` mit Fälligkeit
- Dokument optional einer Familie/Pflegerin zuordnen

### M5.2 — Schreib das für mich
- Voice- oder Texteingabe auf Georgisch
- Ein Call → vier Varianten (WhatsApp freundlich / WhatsApp geschäftlich / E-Mail formell / kurz)
- **Rückübersetzung ins Georgische, immer sichtbar** — nicht optional
- Kopieren + `wa.me`-Deep-Link mit vorbefülltem Text
- Speichern als `communication` mit Status `draft`

### M5.3 — Freie Übersetzung
- Georgisch ↔ Deutsch, mit Registerwahl (privat / geschäftlich / behördlich)
- Übersetzungs-Cache über `hash(text + ziel + register)`

**Akzeptanz:** Ein fotografierter echter Brief ist in unter 12 Sekunden auf
Georgisch erklärt. Eine gesprochene Bitte wird zu vier brauchbaren deutschen Texten.

---

## M6 — Pflegerinnen · ~4–5 Tage

- `modules/caregivers/` vollständig: schema / repository / service / actions / ui
- Listen-, Detail- und Bearbeitungsansicht
- Sprachen, Skills (Katalog-Chips), Verfügbarkeit (daterange-Picker, mobil bedienbar)
- Dokumente hochladen und ansehen (Signed URLs, 60 s)
- Notizen, Vollständigkeitsanzeige (Fortschritt, **kein** Pflichtfeld-Gate)
- Suche: `pg_trgm` für Namen + AI-Filter für Freitextanfragen
- **Neue Tools:** `captureCaregiver`, `updateCaregiver`, `searchRecords`, `checkAvailability`
- `vocabulary`-Bias: Namen aus der DB an den STT-Provider übergeben

**Akzeptanz:** Das Beispiel aus dem Konzept funktioniert wörtlich —
"Nino ist 47, hat acht Jahre Erfahrung, spricht A2, kennt sich mit Demenz aus,
könnte ab September anfangen" → korrekt strukturiertes Profil nach einer Bestätigung.

---

## M7 — Familien, Fälle & Matching · ~5–6 Tage

### M7.1 — Familien & Fälle
- `modules/families/` und `modules/cases/`
- `care_case_health` mit eigener Policy und eigenem UI-Bereich (visuell abgesetzt)
- Aufgabenkatalog-Auswahl
- Statusleiste mit impliziten Übergängen (kein Status-Dropdown)
- **Neue Tools:** `captureCase`, `updateCase`
- Deutscher Freitext (E-Mail einer Familie) → strukturierter Fall + georgische Zusammenfassung

### M7.2 — Matching Engine
- `modules/matching/filters.ts` — vier harte SQL-Filter
- `modules/matching/score.ts` — **reine Funktion**, sieben gewichtete Dimensionen,
  Coverage-Faktor. Vollständig unit-getestet, keine DB-Abhängigkeit
- `modules/matching/reasons.ts` — Score-Beiträge → i18n-Keys, **kein AI-Call**
- Kandidatenliste mit Score **und** Datensicherheit
- Fehlende Information → Button "Frage hinzufügen" → `task`
- Optionale AI-Begründung erst auf Tippen von "warum?", danach gecacht
- **Neues Tool:** `findMatches`

### M7.3 — Einsätze
- Vorschlag → `placement` mit eingefrorenem Score
- Statusverlauf, Zeitraum, Vergütung, Provision
- Verlauf pro Pflegerin und pro Fall

**Akzeptanz:** 20 Pflegerinnen, 5 Fälle → Matching liefert in unter 300 ms
plausible, erklärte Ergebnisse. Score-Funktion hat ≥ 90 % Testabdeckung.

---

## M8 — ჩემი, Heute & Easter Eggs · ~3–4 Tage

- `modules/personal/` — sechs Sammlungen, Karten, Favoriten, Sortierung
- Warmes Alternativ-Theme, spürbar anders als der Business-Bereich
- Bild-Upload für persönliche Items
- **Neues Tool:** `addPersonalItem`
- `is_locked`-Item (Easter Egg 5) beim Onboarding anlegen
- "Heute": offene Tasks, Fristen, fehlende Infos, startende/endende Einsätze,
  ablaufende Dokumente
- Event-Drainer (`modules/events/drainer.ts`) + Vercel Cron
- Notification-Erzeugung aus Events (In-App)
- Retention-Cronjobs (Audio, Drafts, Sessions, Cache, Papierkorb)
- Alle fünf Easter Eggs aus B.8

**Akzeptanz:** Der persönliche Bereich fühlt sich an wie eine andere App.

---

## M9 — Onboarding, Politur, Übergabe · ~3–4 Tage

- Onboarding-Flow: Splash → Name → Foto → **der Demo-Moment** → Home. Unter 60 Sekunden
- Alle Fehlerzustände auf einen Weg vorwärts prüfen — nirgends eine Sackgasse
- Datenexport (ZIP mit JSON + Dokumenten)
- Konto vollständig löschen
- Lighthouse: PWA, Performance, Accessibility
- Test auf ihrem echten Gerät, in echtem Mobilfunknetz, an einem echten Ort
- **Georgisches Sprachlektorat durch einen Muttersprachler** — nicht durch AI.
  Jede UI-Zeichenkette, jede Fehlermeldung, jede Frage des Assistenten.
- `LATER.md` aufräumen und für Phase 2 priorisieren

**Akzeptanz:** Sie öffnet die App, ohne dass jemand etwas erklärt, und kommt zurecht.

---

## Zeitplan

| Meilenstein | Aufwand | Kumuliert |
|---|---|---|
| M0 Spikes | 1–2 T | 2 T |
| M1 Fundament | 2–3 T | 5 T |
| M2 Datenbank & Sicherheit | 2–3 T | 8 T |
| M3 Design System | 3–4 T | 12 T |
| M4 Voice-Pipeline | 4–5 T | 17 T |
| M5 Deutschland-Assistent | 4–5 T | 22 T ← **erster verschenkbarer Zustand** |
| M6 Pflegerinnen | 4–5 T | 27 T |
| M7 Familien & Matching | 5–6 T | 33 T |
| M8 ჩემი & Heute | 3–4 T | 37 T |
| M9 Politur | 3–4 T | **~41 T** |

**~32–42 Arbeitstage.** Mit Claude Code als Umsetzungspartner und nebenberuflich:
realistisch **6–9 Wochen**.

---

## Qualitätsregeln für den gesamten Bau

1. **Kein Feature ohne Zod-Schema.** LLM-Output, Formulare und Server Actions
   nutzen dasselbe Schema.
2. **Kein AI-Call ohne `ai_interactions`-Eintrag.** Ab dem ersten Tag.
3. **Kein Business-Write ohne Service Layer.** Server Actions sind drei Zeilen:
   Auth-Check, Zod-Parse, Service-Call.
4. **Keine neue Tabelle ohne RLS-Policy und RLS-Test** in derselben Migration.
5. **Kein englischer oder deutscher String** in der georgischen UI — auch nicht
   in Fehlermeldungen, auch nicht "vorübergehend".
6. **Keine Modulgrenze aufweichen.** Wenn `caregivers` etwas aus `matching`
   braucht, wandert es nach `core` oder es war eine falsche Grenze.
7. **Jede Idee, die nicht im aktuellen Meilenstein steht, geht nach `LATER.md`.**

---

## Offene Punkte, die vor dem Bau entschieden werden müssen

| # | Frage | Blockiert |
|---|---|---|
| 1 | Freigabe der zwölf Korrekturen in ARCHITECTURE.md 0.1 — besonders K1, K3, K11 | alles |
| 2 | Name: ALUBALI oder Alternative | M1 (Domain, Manifest, Wortmarke) |
| 3 | **20 Sprachaufnahmen von ihr** | M0 — und damit alles |
| 4 | Ihr Gerät: iPhone oder Android? Welche OS-Version? | M0.3, PWA-Strategie |
| 5 | Muttersprachler für das Sprachlektorat verfügbar? | M9 |
| 6 | Datum für das Easter Egg (Jahrestag/Geburtstag) | M8 |
| 7 | Ist sie bereits georgisch-sprachig in ChatGPT unterwegs? (Erwartungshaltung) | Tonalität des Assistenten |
