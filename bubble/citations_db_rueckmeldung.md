# Rückmeldung an den Datenbank-Chat: Citations-Vertrag (Stand 08.10.2026)

Antwort auf „Citations-Seite: Bestandsaufnahme und Vertragsvorschlag“. Der Vorschlag ist gegen die
Oberfläche geprüft. **Freigabe zum Bau** mit den Entscheidungen und Ergänzungen unten.

---

## 1. Entscheidungen

| # | Entscheidung |
|---|---|
| C1 | **a**: Nenner überall „Runs mit mindestens einer Citation“, gefiltert nach Modell, Markt und Topic. |
| C2 | **b: wie heute.** Vorperiode `greatest(least(Tage / 2, 30), 1)` Tage direkt vor `date_from`. Das schont die Rechenzeit und gilt so in der ganzen App. In `meta` bitte `prev_from` und `prev_to` mitliefern, damit die Oberfläche den Vergleichszeitraum nennen kann. |
| C3 | **Für den Bau nicht nötig.** Die neue Seite ruft ausschließlich die neuen `_v1`-Funktionen. Welche Altfunktionen Bubble heute ruft, klären wir beim Abschalten der alten Seite; dann räumst du auf. |
| C4 | **Weglassen.** Die Oberfläche zeigt weder Trending noch Fading (im Code geprüft). |
| C5 | **30 Tage.** Die Seite schickt den Zeitraum ohnehin immer mit; der Default gilt nur für Aufrufe ohne Datum. |
| C6 | **Sofort**, als eigener Hotfix **vor** dem Bau. Mit Testabfrage, dass n8n (`service_role`) weiter darf und `anon`/`authenticated` nicht mehr. |

## 2. Aufruf und Antwortform

- Die neue Seite ruft die Funktionen **direkt** auf (PostgREST, Schema `app`, Nutzer-JWT), nicht
  über Bubble.
- **Antwort als reines `jsonb`, ohne Umschlag.** Den Umschlag `{"json": …}` braucht nur Bubbles
  Run-JS, und den gibt es auf dieser Seite nicht mehr. Spätere Web-Apps lesen die Antwort direkt.
- Alles andere aus B4 bleibt: `meta` in jeder Antwort, Gesamtzahl einmal in `meta.total_count`,
  leere Ergebnisse als `[]` mit `total_count: 0`, stabile Fehler-`message`s.

## 3. Ergänzungen zum Vertrag

1. **Zeitzone.** Bitte festlegen und in `meta` nennen. Vorschlag: Tage und Buckets im **Berliner
   Kalendertag** (`Europe/Berlin`), wie bei den Impact Events. Der Kalender der Oberfläche schickt
   Kalendertage ohne Uhrzeit.
2. **Buckets der Zeitreihe.**
   - Wochen als ISO-Woche (Montag bis Sonntag), Monate als Kalendermonat.
   - Jeder Eintrag trägt zusätzlich `bucket_from` und `bucket_to`: die tatsächlich gezählten Tage,
     bei angeschnittenen Buckets also nur der Teil im Zeitraum. Der Tooltip zeigt damit
     „6.–8. Okt.“ statt einer ganzen Woche.
3. **Rate-Limit.**
   - Blättern und Sortieren erzeugen schnelle Folgen von Aufrufen. Bitte die Grenze je Nutzer und
     Funktion nennen; Vorschlag mindestens 60 pro Minute.
   - Bei `citations_rate_limited` im `hint` die Sekunden bis zum nächsten erlaubten Aufruf.
4. **Suche.**
   - `p_search` auf 200 Zeichen kürzen.
   - `%`, `_` und `\` für `LIKE` escapen.
   - Groß/klein und Umlaute faltet die Datenbank (B2), die Oberfläche schickt den Begriff roh.
5. **Marken-Filter.** Bitte festhalten: `p_mentioned_brands` heißt „erwähnt **mindestens eine**
   der Marken“ (oder), so wie die Oberfläche es heute anbietet.
6. **Nicht angewendete Filter.** Statt einer Markierung in `meta.filters` bitte ein eigenes Feld
   `meta.ignored_filters: ["url_types"]`. So kann die Oberfläche es lesen, ohne zu raten.
7. **Logos und Favicons immer absolut** (`https://…`). In B7 steht ein `logo_url` mit `//…`
   (Bubble-CDN). Die heutige Oberfläche ergänzt das selbst, eine spätere Web-App soll das nicht
   müssen.
8. **Typen.**
   - Die Oberfläche übersetzt über ihren eigenen Katalog anhand des **Schlüssels** (`type`,
     `url_type`). Die Labels aus der Datenbank sind willkommen, aber die Schlüssel müssen stabil
     bleiben. Neue Werte bitte vorher ankündigen.
9. **Versionsregel für alle `_v1`.**
   - Felder dürfen dazukommen.
   - Umbenennen, Entfernen oder eine geänderte Bedeutung heißt `_v2`, und `_v1` läuft weiter, bis
     die Oberfläche umgestellt ist.
10. **Export** (die Tabellen haben einen Export-Knopf): **eigene, spätere Runde**, dann aber auf
    demselben Unterbau `_citations_scope_v1`, damit Datei und Tabelle dieselben Zahlen zeigen.

## 4. Was ich nach dem Bau von dir brauche

1. **Vollständige, ungekürzte echte Antworten** (Team `877c649c…`) für:
   - **overview:**
     - Domain-Modus, `day`, 30 Tage;
     - URL-Modus, `week`, 30 Tage;
     - Domain-Modus, `month`, 180 Tage (mit angeschnittenen Buckets).
   - **domains:**
     - Seite 1 und Seite 2 (`limit` 25), `share_desc`;
     - eine Suche;
     - ein Filter ohne Treffer (leere Antwort).
   - **urls:**
     - Seite 1;
     - mit Suche;
     - mit `p_url_types`.
   - **domain_urls:** `adac.de` Seite 1 und mit Suche.
   - **clear:** eine Antwort.
   - **Fehler:** je ein Beispiel für `citations_invalid_param`, `citations_invalid_date`,
     `citations_domain_required`, `citations_rate_limited` und `forbidden`.

   Diese Antworten kommen als Testdaten ins Frontend-Repo. Die Oberfläche wird gegen genau sie
   gebaut und geprüft.
2. **Die Ergebnisse der Tests aus B11**, dazu die Laufzeiten für 30 und 90 Tage am größten Team,
   jeweils kalt und mit Cache.
3. **Die Prüfung von `trg_invalidate_rpc_cache`** (B10): woran er hängt und wie oft er den Cache
   eines aktiven Teams leert.

## 5. Reihenfolge

1. Hotfix C6.
2. `app._citations_scope_v1` und die fünf Funktionen nach B1 bis B10 mit diesen Ergänzungen,
   samt Tests.
3. Abschnitt 4 an mich.
4. Altfunktionen bleiben unverändert, bis die alte Seite abgeschaltet ist.
