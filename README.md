# ALUBALI · ალუბალი

> Sie spricht Georgisch. Die App liefert deutsche Realität zurück —
> als Text, als Struktur, als Entscheidung.

Ein persönlicher georgisch-deutscher Assistent, unter dem ein Vermittlungssystem
für Betreuungskräfte liegt. Mobile-first, Georgisch als Primärsprache,
installierbar als PWA.

**Status: V1.** Läuft ohne eine einzige Konfigurationsvariable.

---

## Die vier Momente, um die herum V1 gebaut ist

| | Was sie tut | Was passiert |
|---|---|---|
| **1** | Fotografiert einen deutschen Brief | Erklärung auf Georgisch: wer schreibt, was sie wollen, bis wann, was jetzt zu tun ist — plus Erinnerung anlegen |
| **2** | Sagt auf Georgisch, was sie mitteilen will | Drei deutsche Varianten, georgische Rückübersetzung, Kopieren oder direkt in WhatsApp |
| **3** | Spricht über eine Pflegerin | Strukturierter Entwurf, unsichere Werte gold markiert, fehlende Angaben als Frage — sie bestätigt und es ist gespeichert |
| **4** | Öffnet einen Pflegefall | Passende Kandidatinnen mit Score, Datensicherheit und einer Begründung, die jede Zahl erklärt |

---

## Schnellstart

```bash
npm install --legacy-peer-deps
npm run dev
```

Öffnen: http://localhost:3000

Das war alles. Kein Supabase, kein API-Key, kein Setup. Beim ersten Start legt
die App realistische Demo-Daten an (5 Betreuungskräfte, 3 Familien mit
Pflegefällen, Einsätze, Aufgaben, persönliche Einträge) und ist sofort in jedem
Flow bedienbar.

> **Warum `--legacy-peer-deps`:** `eslint-config-next` zieht `typescript-eslint`
> mit engen Peer-Ranges nach. Ohne das Flag läuft npm in eine
> Backtracking-Schleife und lädt Paket-Metadaten minutenlang im Kreis.

---

## Voraussetzungen

| | |
|---|---|
| Node.js | ≥ 20.9 (entwickelt auf 24) |
| npm | ≥ 10 |
| Browser | Chrome/Safari/Edge aktuell; Sprachaufnahme braucht HTTPS oder `localhost` |

---

## Betriebsmodi

ALUBALI läuft in zwei Modi. Der Anwendungscode kennt den Unterschied nicht —
er sieht in beiden Fällen dieselben Schnittstellen.

### Demo-Modus (Standard, ohne Konfiguration)

* **Daten** in `.data/store.json` — ein vollwertiger Treiber, keine Attrappe
* **AI** über den Mock-Provider: leitet Namen, Zahlen, Daten und Stichworte aus
  der tatsächlichen Eingabe ab, statt Konserven auszugeben
* **Speech** über Mock-Transkripte (rotierende georgische Beispielsätze)
* **Anmeldung** entfällt — es gibt immer eine Sitzung

### Produktivmodus (mit Keys)

Sobald `NEXT_PUBLIC_SUPABASE_URL` gesetzt ist, wechselt die Datenhaltung auf
PostgreSQL mit Row Level Security; sobald ein AI-Key gesetzt ist, laufen die
Modellaufrufe echt. Beides ist unabhängig voneinander schaltbar.

---

## Umgebungsvariablen

`cp .env.example .env.local` und ausfüllen, was gebraucht wird. **Alles ist optional.**

### Supabase

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # nur für Seed/Cron, nie im Client
```

Projekt in der **Region EU (Frankfurt)** anlegen. Schema und RLS-Policies:
[`docs/DATABASE.sql`](docs/DATABASE.sql).

Bucket `documents` **privat** anlegen. Es gibt keinen öffentlichen Zugriffspfad;
Dateien werden ausschließlich über kurzlebige Signed URLs ausgeliefert.

### AI-Provider

```env
AI_PROVIDER=anthropic          # anthropic | openai | mock
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...          # optional, dient als Fallback
```

Der Router bildet Aufgaben auf Modell-Tiers ab — der Anwendungscode nennt nie
einen Anbieter:

| Tier | Aufgaben | Standardmodell |
|---|---|---|
| `nano` | Intent-Routing, Feldextraktion, Suchfilter | `claude-haiku-4-5-20251001` |
| `standard` | Deutsche Textentwürfe, Übersetzung | `claude-sonnet-5` |
| `vision` | Brief-Foto verstehen (kein separates OCR) | `claude-sonnet-5` |

Überschreibbar via `AI_MODEL_NANO`, `AI_MODEL_STANDARD`, `AI_MODEL_VISION`.
Opus wird bewusst nie verwendet — keine Aufgabe rechtfertigt die Kosten.

### Speech-Provider

```env
SPEECH_PROVIDER=openai
SPEECH_MODEL=gpt-4o-transcribe
```

Georgisch ist eine ressourcenarme Sprache; welcher Anbieter am besten
transkribiert, ist eine empirische Frage. Deshalb liegt STT hinter einem
Adapter — ein Wechsel ist Konfiguration, kein Refactoring. Namen aus der
eigenen Datenbank werden als Vokabular-Bias mitgegeben, damit aus „Nino" nicht
„Nina" wird.

Text-to-Speech ist in V1 absichtlich **nicht** implementiert (siehe `LATER.md`).

---

## Demo-Daten

Werden beim ersten Start angelegt, wenn der Speicher leer ist. Steuerbar über:

```env
SEED_DEMO_DATA=false
```

Jede Demo-Zeile trägt `is_demo: true`. **Einstellungen → Demo-Daten entfernen**
löscht sie restlos; echte Einträge bleiben unberührt.

Zurücksetzen im Demo-Modus:

```bash
rm -rf .data
```

---

## Befehle

```bash
npm run dev         # Entwicklungsserver
npm run build       # Produktionsbuild
npm run start       # Produktionsserver
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
npm run test        # Vitest (Matching, Normalisierung, Mock-Extraktion)
npm run verify      # typecheck + lint + test + build
```

Icons neu erzeugen (nur nötig, wenn sich die Marke ändert):

```bash
node scripts/generate-icons.mjs
```

---

## Deployment

Empfohlen: **Vercel, Region `fra1`** + **Supabase EU (Frankfurt)**.

1. Repository verbinden, Framework wird als Next.js erkannt
2. Umgebungsvariablen setzen (siehe oben)
3. `NEXT_PUBLIC_APP_URL` auf die echte Domain setzen — wird für
   OAuth-Redirects gebraucht
4. In Supabase unter *Authentication → URL Configuration* die Callback-URL
   `https://deine-domain/auth/callback` eintragen
5. Migrationen aus `docs/DATABASE.sql` einspielen

Schriften werden zur Bauzeit heruntergeladen und selbst ausgeliefert. Zur
Laufzeit stellt die App **keinen einzigen externen Request** außer zu den
konfigurierten API-Anbietern.

---

## Projektstruktur

```
src/
  app/            Routen (App Router). Dünn — Seiten laden Daten und rendern.
  modules/        Domäne. Ein Ordner pro Fachbereich, mit eigenem Service.
    assistant/      Intent-Routing, Extraktion, Normalisierung, Entwürfe
    caregivers/     Pflegerinnen
    families/       Familien und Pflegefälle
    matching/       Score-Engine (rein, deterministisch, getestet)
    placements/     Einsätze inkl. eingefrorenem Score-Snapshot
    documents/      Brief verstehen
    messages/       Schreib das für mich, Übersetzung
    tasks/          Aufgaben und Notizen
    personal/       ჩემი
    today/          Was heute zählt
    demo/           Seed und Entfernen
    audit/          Änderungsprotokoll und Kostentelemetrie
  core/           Querschnitt, kennt keine Domäne
    ai/             Provider-Adapter, Model Router, Cache
    speech/         STT-Adapter
    db/             Store-Port, lokaler Treiber, Supabase-Treiber
    auth/  storage/  i18n/  config/
  ui/             Design System, kennt keine Domäne
```

**Abhängigkeitsrichtung:** `app → modules → core`, und alle dürfen `ui` nutzen.
`core` und `ui` importieren niemals aus `modules`.

---

## Architektur in fünf Sätzen

1. **Ein Sprachmodell schreibt nie in eine Business-Tabelle.** Es erzeugt einen
   `assistant_draft`; erst die Bestätigung der Nutzerin macht daraus einen
   Datensatz.
2. **Jede Modellausgabe wird gegen ein Zod-Schema validiert**, danach
   normalisiert — Werte außerhalb des Erlaubten werden verworfen, nicht gekappt.
3. **Matching ist deterministisch.** Vier harte Filter, sieben gewichtete
   Dimensionen, Begründungen aus i18n-Schlüsseln. Kein AI-Aufruf, voll testbar.
4. **Gesundheitsdaten liegen isoliert** (`care_case_health`): eigene Zeile,
   eigene Zugriffsregel, keine Wertdiffs im Audit-Log.
5. **Etwa zwei Drittel der Funktionalität kommen ohne AI aus** — deshalb bleibt
   der Betrieb im einstelligen Dollarbereich pro Monat.

Ausführlich: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Was V1 bewusst nicht kann

Buchhaltung · Lohnabrechnung · Dienstplanung · Arbeitszeiterfassung ·
WhatsApp Business API · Familien-/Pflegerinnen-Portal · native Apps ·
Text-to-Speech · Push-Benachrichtigungen · Machine Learning im Matching

Die ersten vier fehlen nicht aus Zeitgründen: Sie würden das Geschäftsmodell
faktisch als Arbeitgeberverhältnis ausgestalten. Begründung in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), Abschnitt K11.

Alles Weitere steht in [`LATER.md`](LATER.md).

---

## Dokumente

| Datei | Inhalt |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Vollständiges Architekturkonzept inkl. Abweichungen der Umsetzung |
| [`docs/DATABASE.sql`](docs/DATABASE.sql) | Postgres-Schema, RLS-Policies, Retention |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Meilensteine M0–M9 |
| [`LATER.md`](LATER.md) | Zurückgestelltes — nicht implementieren |
