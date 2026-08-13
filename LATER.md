# LATER

Ideen, die während des Baus entstehen, landen hier — **nicht im Code**.
Das ist die einzige wirksame Maßnahme gegen Scope Creep bei einem Projekt
ohne Deadline.

Format: `- [Bereich] Idee — warum sie interessant ist`

---

## Aus der Architekturphase bereits zurückgestellt

- [Assistent] Georgische Text-to-Speech — erst wenn eine Stimme gefunden ist, die gut genug klingt (ARCHITECTURE.md K8)
- [Assistent] Live-Teiltranskript während der Aufnahme — braucht Streaming-STT
- [Assistent] Ganze WhatsApp-Konversation einfügen → zusammenfassen + antworten
- [Assistent] Deutscher Brief → deutscher Antwortentwurf
- [Business] Dokumenten-Ablaufwarnungen (Pass, A1, Versicherung)
- [Business] Rotationsplanung — Nachfolgerin für endenden Einsatz vorschlagen
- [Business] Kennzahlen: aktive Einsätze, offene Fälle, Provisionen, Auslastung
- [Plattform] Web Push (VAPID) — iOS-PWA-Push ist zu fragil für V1
- [Plattform] E-Mail-Benachrichtigungen via Resend
- [Plattform] Englisch als dritte Sprache
- [Plattform] Rolle `staff` im UI aktivieren (im Datenmodell bereits vorhanden)
- [ჩემი] Web Share Target — aus Instagram/Browser direkt in eine Sammlung teilen
- [ჩემი] Preis-Tracking für Wunschlisten-Items
- [Phase 3] Pflegerinnen-Portal
- [Phase 3] Familien-Portal
- [Phase 3] Öffentliches Anfrageformular für Familien
- [Phase 3] WhatsApp Business API
- [Phase 3] AI-Soft-Signal im Matching aus Placement-Historie
- [Phase 3] Mandantenfähigkeit im UI (Datenmodell trägt es bereits)

## Bewusst dauerhaft ausgeschlossen

- Buchhaltung, Lohnabrechnung, Arbeitszeiterfassung — verändert die Rechtsnatur des Geschäftsmodells (ARCHITECTURE.md K11)
- Bewertungs-/Rating-System für Pflegerinnen
- Öffentlicher Kandidatinnen-Marktplatz
- Allgemeiner AI-Chatbot ohne Kontext
- Prompt- oder AI-Einstellungs-UI jeder Art

---

## Während des V1-Baus entstanden

- [Plattform] Dark Mode — V1 committet sich auf ein warmes Lichtthema. Ein halbgares Dark Mode sieht schlechter aus als keines; richtig gemacht braucht es eine zweite vollständige Token-Ebene
- [Plattform] Persistenter AI-Cache in der Datenbank statt prozesslokal (Architektur V6) — lohnt erst bei mehreren Instanzen
- [Plattform] Offline-Outbox für Sprachaufnahmen (IndexedDB + Background Sync) — im Service Worker vorbereitet, aber nicht angeschlossen
- [Plattform] Retention-Cronjobs anschließen (Audio nach 30 Tagen, Entwürfe nach 24 h, Papierkorb nach 30 Tagen) — Felder und Fristen stehen im Datenmodell, der Job fehlt
- [Plattform] Datenexport als ZIP und vollständige Kontolöschung — im Löschkonzept beschrieben, in V1 nicht gebaut
- [Business] Manuelles Formular als gleichwertiger zweiter Weg zum Anlegen — V1 erfasst über Beschreibung, Feineinstellung über die Detailansicht
- [Business] Dokumenten-Upload an Pflegerinnen und Fällen (Pass, A1, Zertifikate) — Storage-Schicht und Tabelle sind fertig, die Oberfläche fehlt
- [Business] Suche über Pflegerinnen mit natürlichsprachigem Filter — `search.filter` ist im Router vorgesehen, aber nicht angebunden
- [Assistent] PDF-Briefe: aktuell werden PDFs gespeichert, aber nicht analysiert (Vision braucht Bilder). Nötig wäre eine Seitenrasterung
- [Assistent] Entity-Context-Stack aktiv nutzen („Nino kommt doch erst am 15.") — Tabelle und Konzept stehen, die Auflösung fehlt
- [Matching] Kandidatinnenliste über die ersten sechs hinaus, mit Filter und Sortierung

## Neu (während des Baus ergänzen)

<!-- hier anfügen -->
