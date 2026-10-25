# Zweier-Split – Cybex Training

Mobile-first Web-App für persönliches Krafttraining mit genau zwei Einheiten:

- **Training A – Oberkörper und Bauch:** Brust, Rücken, Schultern, Bizeps, Trizeps, Bauch
- **Training B – Beine und Bauch:** Beine, Bauch

Trainings durchführen, Sätze erfassen, automatisch speichern, Fortschritt pro Übung und Gerät verfolgen. Oberfläche auf Deutsch (Schweizer Schreibweise), Dark Mode als Standard.

> **Wichtig:** Alle Daten liegen **nur lokal in diesem Browser auf diesem Gerät** (IndexedDB). Es gibt keine Cloud-Synchronisierung. Wird der Browserspeicher gelöscht – oder löscht Safari/iOS Website-Daten nach längerer Nichtnutzung –, sind die Daten weg. **Regelmässig unter Einstellungen → Datensicherung ein JSON-Backup erstellen.** Die App zum Home-Bildschirm hinzuzufügen und den „dauerhaften Speicher“ zu erlauben, senkt das Risiko.

## Start

Voraussetzung: Node.js ≥ 20.

```bash
npm install
npm run dev          # Entwicklung: http://localhost:3000
npm run build        # Statischer Export nach ./out
npm start            # ./out lokal ausliefern (http://localhost:3000)
```

Der Build ist eine rein statische Seite (`output: "export"`). `./out` kann auf jedem Webserver bzw. Static Hosting (Netlify, Vercel, GitHub Pages, eigener Server) liegen. Für die Installation als App auf dem Handy wird HTTPS benötigt.

### Hosting auf Cloudflare Workers

`wrangler.jsonc` liefert `./out` als statische Assets über den Worker `fitness` aus (kein Worker-Code).

- **Automatisch über GitHub (empfohlen):** Cloudflare-Dashboard → Workers & Pages → `fitness` → Settings → Build → Repository `fs1911/Fitness` verbinden. Build command `npm run build`, Deploy command `npx wrangler deploy`, Root directory `/`, Branch = der Branch, der live gehen soll.
- **Manuell:** `npx wrangler login`, danach `npm run deploy`.

Die Daten liegen pro Domain im Browser. Wechselst du später die Adresse (z. B. von `*.workers.dev` auf eine eigene Domain), startet die App dort leer → vorher Backup exportieren und danach importieren.

### Qualitätssicherung

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # Vitest: Domänenlogik + Datenschicht (fake-indexeddb)
npm run build && npm run test:e2e   # Playwright gegen den statischen Build
```

## Architektur

| Schicht | Ort | Inhalt |
|---|---|---|
| Domäne | `src/domain/` | Typen, Validierung (Komma-Dezimal, ganze Wdh.), Volumen, Bestleistungen, Vergleichsreihen, Scheibenrechner, Formatierung TT.MM.JJJJ / 24 h – reine Funktionen, ohne UI und DB |
| Daten | `src/data/` | Dexie-Schema (`db.ts`), Repositories (`repositories/*`), Seed (`seed/`) |
| UI | `src/app/`, `src/components/` | Next.js App Router (nur Client-Komponenten), Tailwind CSS v4, shadcn-artige Komponenten auf Radix (`components/ui`), Recharts |

Seiten: Start (`/`), Trainingsplan (`/plan`), Geräte (`/geraete`), Fortschritt (`/fortschritt`), Verlauf (`/verlauf`), Einstellungen (`/einstellungen`, über das Zahnrad), laufendes Training (`/training`).

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI, Dexie 4, Zod 4, Recharts 3, Vitest, Playwright.

## Datenhaltung

Die UI greift ausschliesslich über `repos` (`src/data/index.ts`) auf Daten zu. Für eine spätere Supabase-Synchronisierung kann dort eine zweite Implementierung bzw. ein Sync-Layer andocken; alle Datensätze haben stabile IDs (UUID bzw. feste Seed-IDs) und `createdAt`/`updatedAt`.

**Datenmodell (getrennte Konzepte):**

- `devices` – physisches Gerät inkl. Beladungsart (`selectorized` / `plate_loaded`), Gewichtsabstufung, Scheibengrössen, optional verifiziertes Startgewicht, Bild.
- `deviceImages` – hochgeladene Fotos als `ArrayBuffer` (persistent, im Backup enthalten).
- `exercises` – Übung mit genau einem zugeordneten Gerät. Mehrere Übungen können dasselbe Gerät nutzen (z. B. Butterfly und Reverse Butterfly an einer Kombimaschine).
- `exerciseSettings` – persönliche Einstellungen je **Übung + Gerät** (Sitzhöhe, Startposition, Rückenlehne, Griff, Notiz).
- `templates` / `templateSlots` – Trainingsvorlagen und Übungspositionen mit Zielsätzen, Wiederholungsbereich, optionaler Pause und alternativen Übungen (Beinpresse Block ↔ Scheiben, Latzug Pulldown-Maschine ↔ klassisch am Kabelzug).
- `sessions` – Trainingseinheit (läuft / pausiert / abgeschlossen / abgebrochen).
- `sessionExercises` – tatsächlich durchgeführte Übung mit dem **tatsächlich verwendeten Gerät** und einem **Snapshot** (Namen, Ziele, Einstellungen). Spätere Änderungen an Vorlagen, Übungen oder Geräten verändern die Historie nicht.
- `sets` – Satz mit Gewicht, Wiederholungen, Status, Aufwärm-Kennzeichen, Notiz und der **pro Satz gespeicherten Berechnungsgrundlage** (`weightBasis`: Gewichtsblock, Scheibengewicht gesamt oder Scheibenrechner mit Beladung links/rechts, inkl. ob ein Startgewicht eingerechnet wurde).
- `settings` – Benutzereinstellungen (Scheibengrössen, Pausentimer, Aufwärmsätze im Volumen).

**Rechenregeln:**

- Volumen = Σ Gewicht × Wiederholungen aller **abgeschlossenen Arbeitssätze**; Aufwärmsätze standardmässig ausgeschlossen.
- Bestleistungen und Diagramme nur aus abgeschlossenen Sätzen **abgeschlossener** Einheiten; abgebrochene Einheiten und offene Sätze fliessen nie ein.
- Vergleiche nur innerhalb derselben Übung + desselben Geräts + derselben Berechnungsgrundlage („Vergleichsreihe“). Beinpresse Block und Beinpresse Scheiben sind getrennte Geräte und Übungen.
- „Letztes Mal“ zeigt die letzte abgeschlossene Durchführung derselben Übung am selben Gerät – unabhängig davon, ob sie in Training A oder B stattfand (relevant für den Bauchcrunch).
- Für die scheibenbeladene Beinpresse wird standardmässig nur das **aufgelegte Scheibengewicht** dokumentiert. Die Kennzahl ist keine effektive Kraft und kein mechanischer Widerstand.

**Backup:** JSON-Export aller Tabellen inklusive eigener Fotos (Base64); Import mit Zod-Schema- und Referenzprüfung, nur nach Bestätigung und atomar (alles oder nichts). Zusätzlich CSV-Export (eine Zeile pro Satz, Semikolon, UTF-8).

## Echte Cybex-Geräte und Bilder ergänzen

Die 16 vorbereiteten Geräte sind **Gerätekategorien**, keine verifizierten Modelle. Sie tragen bewusst keine Modell- oder Seriennummern und zeigen „Konkretes Modell noch nicht hinterlegt“. Die Abbildungen sind eigene, schematische Strichillustrationen (je Gerät unterschiedlich) und als „Illustration – kein Produktfoto“ gekennzeichnet.

1. **Geräte → Gerät antippen.** Unter „Modell“ und „Serie“ die Bezeichnung eintragen, die tatsächlich am Gerät im Studio steht.
2. **Eigenes Foto:** „Eigenes Foto“ wählen (Kamera oder Galerie). Das Bild wird verkleinert, lokal gespeichert und ist im Backup enthalten. Erneutes Hochladen ersetzt es.
3. **Bild-URL:** Nur verwenden, wenn Quelle und Nutzungsrecht geklärt sind. Quelle ist ein Pflichtfeld, das Nutzungsrecht wird mitgespeichert. Externe Bilder werden online geladen und sind nicht im Backup enthalten. Bei Ladefehlern erscheint automatisch die Illustration.
4. **Kombimaschinen:** Adduktoren und Abduktoren sind bereits als zwei Übungen an einer gemeinsamen Maschine angelegt (getrennte Historien und Einstellungen). Gibt es im Studio zwei getrennte Geräte: neues Gerät anlegen und eine der Übungen im Trainingsplan diesem Gerät zuordnen.
   **Butterfly / Reverse Butterfly:** Trainingsplan → Training A → Reverse Butterfly → Bearbeiten → Gerät „Cybex Butterfly / Pec Fly“ wählen. Historien, Einstellungen und Bestleistungen bleiben je Übung getrennt. Das separate Rear-Delt-Gerät kann danach archiviert werden.
5. **Beinbeuger sitzend/liegend:** Die Ausführung beim Gerät unter „Ausführung / Variante“ eintragen. Für eine **zweite** Ausführung mit eigener Historie im Trainingsplan „Neue Übung anlegen“.
6. **Plate-loaded Startgewicht:** Nur einen gesicherten Wert eintragen und bewusst entscheiden, ob er in die Kennzahl einfliesst. Sätze mit und ohne Startgewicht bilden getrennte Vergleichsreihen; alte Sätze werden nicht umgerechnet.
7. **Neue Geräte:** Geräte → „+ Gerät“. Nicht mehr vorhandene Geräte **archivieren** statt löschen – die Historie zeigt sie weiterhin korrekt an.

Bei vorbereiteten Geräten den Code (`src/data/seed/seedData.ts`) nur für neue Installationen ändern; bestehende Installationen werden nicht erneut geseedet. Später ergänzte Inhalte (Schulterpresse, Adduktoren-/Abduktorenmaschine) kommen über einmalige Ergänzungen in `src/data/seed/seed.ts` (`SEED_ADDITIONS`, `applyMigrations`): Sie legen nur Fehlendes an, überschreiben keine eigenen Änderungen und fügen eine bewusst entfernte Übung nicht erneut ein. Nach dem Import eines älteren Backups laufen sie einmal über die importierten Daten.

## Bekannte Einschränkungen

- Nur lokal pro Browser und Gerät; keine Synchronisierung und kein Login. Datenübertragung zwischen Geräten nur per Backup-Datei.
- Keine verifizierten Cybex-Modelle und keine echten Produktfotos.
- Der Service Worker speichert die App-Dateien für Offline-Nutzung. Er ist bewusst minimal (Netzwerk zuerst, Cache als Fallback) und ohne Update-Hinweis.
- Pausentimer: Vibration nur auf Geräten, die die Vibration-API unterstützen (nicht iOS Safari). Läuft der Bildschirm gesperrt, gibt es keine Benachrichtigung.
- Datumseingaben im benutzerdefinierten Zeitraum nutzen den nativen Datumsdialog; dessen Darstellung bestimmt der Browser.
- Das Gesamtvolumen einer Einheit (Verlaufsdetail) summiert über verschiedene Geräte und dient nur als grobe Orientierung; aussagekräftig ist das Volumen pro Übung im Fortschritt.
