<!-- Antwort des Datenbank-Chats vom 08.10.2026 auf citations_db_auftrag.md, unverändert abgelegt.
     Die Entscheidungen zu Teil C und die Ergänzungen stehen in citations_db_rueckmeldung.md. -->

# Citations-Seite: Bestandsaufnahme und Vertragsvorschlag (Stand 08.10.2026)

Grundlage: `citations_bestand_1.sql`, ausgeführt in Prod am 08.10.2026.
Testteam `877c649c-f5f2-44e9-bb04-155f5bf44e70` mit 8.336 erfolgreichen Runs in 30 Tagen; das ist das größte Team.
Zeitraum 09.09.–08.10.2026.

**In dieser Runde wird nichts geändert.** Teil A beschreibt den heutigen Stand und beantwortet die Fragen aus Abschnitt 4. Teil B ist der Vertragsvorschlag. Teil C listet die Entscheidungen, die vor dem Bau fallen müssen.

---

## Teil A – Bestandsaufnahme

### A1. Welche Funktionen die Seite heute nutzt

Die Datenbank sieht nicht, welche Bubble-Elemente was aufrufen. `pg_stat_statements` zählt seit dem letzten Reset kumuliert, daher stehen alte Versionen weit oben. Diese Zuordnung ergibt sich aus Signaturen und Feldnamen und **muss bestätigt werden**.

| Bereich der Seite | Wrapper (PostgREST) | rechnet in | Cache-Name in `rpc_cache` |
|---|---|---|---|
| Combo-Chart (Zeitreihe, Typ-Verteilung, Top 7) | `cached_citations_insights_v2` | `get_citations_insights_bundle_v18` | `citations_insights_v3` |
| Kopf/Übersicht (Top 7 + Typ-Verteilung + Summe) | `cached_citation_overview_v14` | `get_citation_overview_bundle_v26` | `citation_overview_v26` |
| Domains-Tabelle | `cached_citation_domains_v2` | `get_citation_domains_v17` | `citation_domains_v3` |
| URLs-Tabelle **und** Drilldown (mit `p_domain`) | `cached_citation_urls_v2` | `get_citation_urls_v33` | `citation_urls_v3` |
| Drilldown (Alternative) | `cached_citation_domain_urls_v1` | `get_citation_domain_urls_v5` | `citation_domain_urls_v2` |

Ein Indiz für den Drilldown: Die Komponente liest dort `domainshare_pct`. Dieses Feld liefert nur `cached_citation_urls_v2` mit `p_domain`. `cached_citation_domain_urls_v1` heißt das Feld `domain_share`.

Daneben liegen viele Altversionen, die nichts mehr aufruft:

- `get_citation_domains_v13`–`v16`
- `get_citation_urls_v29`–`v32`
- `get_citation_overview_bundle_v20`–`v25`
- `get_citations_insights_bundle_v11`–`v17` samt `_timed`
- `cached_citation_overview_v11`–`v13`
- `cached_citation_domains_v1`
- `cached_citation_urls_v1`, die **kaputt** ist: Sie ruft `get_citation_urls_v32` mit einer Signatur auf, die es nicht mehr gibt.

Die Altversionen werden später aufgeräumt, nicht in dieser Runde.

### A2. Wie Filter heute ankommen

| Filter | Parameter | Typ | Default | „leer“ bedeutet |
|---|---|---|---|---|
| Zeitraum | `p_date_from`, `p_date_to` | date | **letzte 7 Tage** (`current_date - 6` bis heute) | – |
| Models | `p_models` | text[] | null | null oder `[]` = alle |
| Markets | `p_markets` | text[] | null | null oder `[]` = alle |
| Topics | `p_tag_ids` + `p_tagmode` | uuid[], text `or`/`and` | null, `or` | null oder `[]` = alle |
| Brand mentioned | `p_mentioned` | text `all`/`yes`/`no` | `all` | – |
| Marken-Filter | `p_mentioned_brands` | uuid[] | null | null oder `[]` = kein Filter |
| Citation Types | `p_citation_types` | `app.citation_type[]` | null | null oder `[]` = alle |
| URL Types | `p_url_types` | text[] (`uncategorized` = ohne Typ) | null | null oder `[]` = alle |
| Suche | `p_search` | text | null | leer = keine Suche |
| Sortierung | `p_order` | text | Domains `last_used_desc` (intern → `share_desc`), URLs `share_desc` | unbekannt → `share_desc` |
| Blättern | `p_limit`, `p_offset` | int | 15, 0 | max. 100 |
| Chart | `p_mode` (`domain`/`url`), `p_granularity` (`day`/`week`/`month`) | text | `domain`, `day` | – |

Dazu einige Abweichungen:

- **Suche:**
  - Die UI schickt `query`, `query_folded` und `query_de`, die Datenbank nutzt nur einen Wert.
  - Domains suchen im Domainnamen.
  - URLs (v33) suchen **nur in der URL, nicht im Titel**.
  - Der Drilldown (v5) sucht in URL **und** Titel.
- **Brand mentioned:**
  - Bei Domains heißt es: mindestens eine zitierte URL der Domain erwähnt die eigene Marke.
  - Bei URLs heißt es: die URL selbst erwähnt die eigene Marke.
- **Citation-Type-Filter auf der URL-Tabelle:** Er wirkt über den Typ der Domain.

### A3. Zugriff und Rechte

- Alle `cached_citation*`-Wrapper lehnen fremde Nutzer ab (`forbidden`, geprüft).
- Nur `overview_v14` und `get_citation_urls_v33` nutzen schon `require_team_access`. Die anderen prüfen selbst über `team_member`.
- **Aufgerufen wird mit dem Nutzer-JWT** (Rolle `authenticated` in `pg_stat_statements`). Den Schlüssel `service_role` nutzt die Seite nicht.
- Mängel an den Lese-Funktionen (kein Datenleck, weil `auth.uid()` geprüft wird):
  - `anon` hat `execute` auf allen Wrappern und Basisfunktionen.
  - Fast alle sind `security definer` **ohne** gesetzten `search_path`.
  - Die Basisfunktionen (`get_citation_*`) sind direkt aufrufbar und umgehen damit Cache und teils das Rate-Limit.

> **Sicherheitsbefund, unabhängig von dieser Seite.** Diese Funktionen sind `security definer`, prüfen kein Team und sind für `anon` und `authenticated` ausführbar:
>
> - `set_citation_type(p_domain, p_type)`
> - `apply_citation_types`
> - `finalize_citation_types`
> - `citation_type_job_next`, `citation_type_job_claim`, `citation_type_job_complete`
> - `prepare_urls_for_scrape_v3`
>
> Damit kann jeder mit dem öffentlichen anon-Key den **globalen** Citation Type beliebiger Domains ändern oder die Klassifizierungs-Queue manipulieren. Gehören sollten diese Funktionen nur `service_role` (n8n). Ich empfehle einen eigenen kleinen Hotfix mit `revoke`. Er ist nicht Teil dieser Runde.

### A4. Was doppelt gerechnet wird

1. **Top 7, Typ-Verteilung und Summe der Citations rechnen zwei Funktionen getrennt:** `overview_bundle_v26` und `insights_bundle_v18`. Heute stimmen die Ergebnisse überein (adac.de 44,23 % in beiden), aber die Wege sind unabhängig. Bei Wochen und Monaten weichen sie ab, siehe A5.4.
2. **Die URLs einer Domain liefern zwei Funktionen:** `get_citation_urls_v33` mit `p_domain` und `get_citation_domain_urls_v5`. Die Wege unterscheiden sich in Suche, Sortierung und Feldnamen.
3. **Der URL-Typ liegt doppelt:** in `source_url.url_type` und in `source_url_type.url_type`. Ein Trigger (`trg_source_url_type_sync`) gleicht beide ab, heute sind sie identisch. v26 liest die eine Spalte, v33 die andere.
4. **Der Effektiv-Typ einer Domain** (You/Competition/Typ) steckt als eigener Code-Block in jeder Funktion. Bisher sind die Ergebnisse gleich.

### A5. Antworten auf die Fragen aus Abschnitt 4

**1. Liefern Chart und Tabelle für dieselben Filter dieselben Anteile?**

Bei **Domains ja**. Tabelle, Kopf und Chart rechnen *Runs mit Domain ÷ Runs mit mindestens einer Citation*. Beispiele: carwow.de 37,01 % überall, adac.de 44,23 % in Kopf und Chart.

Bei **URLs nein**. Dieselbe URL hat zwei verschiedene Globalanteile:

| Stelle | adac.de/…/elektro-familienautos-2026 | Nenner |
|---|---|---|
| Kopf, Chart (v26, v18) | **6,51 %** | 7.974 = Runs mit mind. einer Citation |
| URL-Tabelle **mit** `p_domain` (v33, Pfad A = Drilldown) | **6,23 %** | ≈ 8.331 = **alle** Runs (`daily_runs_by_model`) |
| URL-Tabelle ohne `p_domain` (v33, Pfad B) | 6,51 % (gleiche Formel wie Kopf) | 7.974 |

Im Pfad A kommt dazu: Der Nenner beachtet die **Markt- und Topic-Filter nicht**, nur die Modelle. Mit Marktfilter ist der Drilldown-Anteil also falsch.

Weitere Unterschiede:

- Fehlt die Vorperiode, liefern URL-Funktionen `share_prev_pct = 0`, Domain-Funktionen `null`.
- Die **Typ-Verteilung** misst etwas anderes als die Tabellen: Anteil an *Citations* (`used_total`, Zeilen Run × URL), nicht an *Runs*. Das ist kein Fehler, muss aber so benannt sein.

**2. Was ist `share_delta_pct` genau?**

Es ist **kein** Vergleich mit dem gleich langen Zeitraum davor. Die Vorperiode ist `greatest(least(Tage / 2, 30), 1)` Tage lang und liegt direkt vor `date_from`. Bei 30 Tagen sind das also die 15 Tage davor, bei 90 Tagen die 30 Tage davor.

`share_delta_pct` = Anteil jetzt − Anteil Vorperiode, in **Prozentpunkten**. Beide Anteile haben ihren eigenen Nenner. Die Vorperiode wird immer aus Tages-Rollups gerechnet.

**3. Wie teuer sind die Abfragen, lohnt ein Cache?**

Gemessen am größten Team, kalt und ohne Cache:

| Basisfunktion | 30 Tage | 90 Tage |
|---|---|---|
| `get_citation_overview_bundle_v26` | 281 ms | 407 ms |
| `get_citations_insights_bundle_v18` (domain) | 723 ms | 1.725 ms |
| `get_citation_domains_v17` | 177 ms | 1.403 ms |
| `get_citation_urls_v33` (mit Domain) | 49 ms | 1.166 ms |
| `get_citation_domain_urls_v5` | 17 ms | 1.972 ms |

Die Wrapper brauchen beim ersten Aufruf zwischen 98 ms (URLs mit Domain) und 819 ms (Chart im URL-Modus). Im Alltag liegen die Spitzen laut `pg_stat_statements` bei 11–17 s. Das waren die Altversionen und vermutlich kalte Caches bei langen Zeiträumen.

**Ein Cache lohnt sich.** Es gibt ihn schon: `rpc_cache` mit Warming, die ersten 100 Zeilen je Filter-Kombination. Er trifft aber selten. In `rpc_cache` liegen je Funktion nur 2 gültige Einträge, insgesamt 21–26 Treffer.

Ein Grund dafür: `trg_invalidate_rpc_cache` löscht bei jedem Auslösen **den gesamten Cache des Teams**. Bei aktiven Teams passiert das ständig. An welcher Tabelle der Trigger hängt, prüfe ich vor dem Bau.

**4. Woher kommen die Typen und die Favicons?**

- **Citation Type:**
  - Global je Domain in `source_domain.citation_type`, Enum `app.citation_type` mit den Werten Editorial, UGC_Community, Knowledge_Base, Brand_Platform, Institutional, Misc, Competition, You.
  - Gesetzt wird er über die Queue `citation_type_job` (n8n klassifiziert) und `finalize_citation_types`/`set_citation_type`.
  - Je Team überschrieben in dieser Reihenfolge:
    1. `team_domain_override.role` (own → You, competitor → Competition)
    2. Host von `company.url` der Team-Firmen
    3. sonst der globale Typ
  - Lesbare Namen liefert `app.citation_type_label`.
- **URL Type:**
  - Enum `app.url_type` in `source_url.url_type` (gespiegelt in `source_url_type`), gesetzt von n8n über `finalize_url_types`.
  - **104.321 von 265.650 URLs (39 %) haben keinen Typ** und erscheinen als `uncategorized`.
  - Lesbare Namen liefert `app.url_type_label`.
- **Favicons:**
  - `source_domain.favicon` und `source_url.favicon`, zu 100 % befüllt, meist Google-s2-Favicon-URLs.
  - Markenlogos in den Erwähnungen: `team_brand_profile.logo_override_url`, sonst `company.favicon_url`.

**5. Was tut „Aktualisieren“ heute in der Datenbank?**

Das ist offen, weil die Datenbank nicht sieht, was der Button aufruft. Die einzige passende Funktion, `clear_citation_overview_cache_v1`, löscht nur Einträge mit `fn_name = 'citation_overview_v22'`. Der aktuelle Wrapper schreibt aber `citation_overview_v26`. **Falls der Button diese Funktion ruft, leert er nichts.** Die Caches von Domains, URLs und Chart fasst er ohnehin nicht an.

### A6. Weitere Befunde

- **Chart: Trending und Fading sind seit v18 immer leer.** In v18 werden `trending_domains` und `fading_domains` angelegt, aber nie befüllt (im Prod-Lauf `[]`; v15 lieferte sie noch). Falls die UI sie zeigt, ist das ein Fehler.
- **Chart: Wochen und Monate verschieben den Zeitraum.** Bei `week` und `month` erweitert v18 den Zeitraum auf volle Kalenderwochen bzw. -monate. Die KPIs im Chart passen dann nicht mehr zur Tabelle mit denselben Filtern.
- **`total_count` auf jeder Zeile.** Die Domains-Tabelle liefert 4.910, die URL-Tabelle 17.561, der Drilldown für adac.de 756.
- **Cache-Fenster.** Gecacht werden nur die ersten 100 Zeilen. Ab `offset + limit > 100` wird ungecacht gerechnet.
- **Tabellengrößen.** Die Daten kommen ausschließlich aus Rollups, die täglich, wöchentlich und monatlich in Kacheln vorliegen:
  - `daily_citation_url_rollup` 2,3 Mio. Zeilen
  - `daily_citation_domain_rollup` 2,0 Mio. Zeilen
  - `staged_citation_urls` 2,3 Mio. Zeilen (nur im Fallback-Pfad)

---

## Teil B – Vertragsvorschlag

### B1. Schnitt: 4 Lese-Funktionen und 1 Aktualisieren

| Funktion | Zweck | ändert sich mit |
|---|---|---|
| `app.cached_citations_overview_v1` | Kopf-KPIs, Combo-Chart (Zeitreihe Top N), Typ-Verteilung | Filter, Modus, Granularität |
| `app.cached_citations_domains_v1` | Domains-Tabelle | Filter, Suche, Sortierung, Seite |
| `app.cached_citations_urls_v1` | URLs-Tabelle | Filter, Suche, Sortierung, Seite |
| `app.cached_citations_domain_urls_v1` | Drilldown: URLs einer Domain | Filter, Domain, Suche, Sortierung, Seite |
| `app.clear_citations_cache_v1` | Button „Aktualisieren“ | – |

**Warum so geschnitten:**

- **Kopf und Chart in einer Funktion.** Heute rechnen zwei Funktionen dieselben Top 7 und dieselbe Typ-Verteilung. Eine Funktion heißt ein Weg zu den Zahlen.
- **Drilldown als eigene Funktion.** Er hat eigene Sortierungen (Domain-Anteil) und eine Pflicht-Domain. Deshalb ist er nicht `urls` mit `p_domain`.
- **Ein gemeinsamer Unterbau.** Alle vier lesen aus demselben internen Scope-Helfer `app._citations_scope_v1`, nach dem Muster von `_shopping_scope_v1`: Prompt-Filter, Kacheln, Nenner und Effektiv-Typ werden genau einmal definiert. So ist gesichert, dass gleiche Filter gleiche Anteile liefern. Ein Test prüft das: Chart-Serie = erste N Zeilen der Tabelle.
- **„Aktualisieren“** leert den Citations-Cache des Teams und erzwingt beim nächsten Aufruf frische Zahlen.

Für alle Funktionen gilt:

- `security definer`, `set search_path = app, public, pg_temp`
- `revoke` von `public` und `anon`; `grant` an `authenticated` und `service_role`
- Zugriff über `app.require_team_access(p_team)`
- Rate-Limit über `app.check_rate_limit`, ausgesetzt bei `app.warming = 'on'`

### B2. Gemeinsame Parameter (alle vier Funktionen)

| Parameter | Typ | Default | leer bedeutet | Fehler |
|---|---|---|---|---|
| `p_team` | uuid | Pflicht | – | Fehler von `require_team_access` |
| `p_date_from` | date | heute − 29 | – | `citations_invalid_date` |
| `p_date_to` | date | heute | – | `citations_invalid_date` (bei `from > to`, Zeitraum > 366 Tage oder Zukunft) |
| `p_models` | text[] | null | null oder `[]` = alle | – |
| `p_markets` | text[] | null | null oder `[]` = alle | – |
| `p_tag_ids` | uuid[] | null | null oder `[]` = alle | – |
| `p_tagmode` | text | `or` | – | `citations_invalid_param` (Hinweis `p_tagmode`) |
| `p_mentioned` | text | `all` | – | `citations_invalid_param` (`all`/`yes`/`no`) |
| `p_mentioned_brands` | uuid[] | null | null oder `[]` = kein Filter | – |
| `p_citation_types` | text[] | null | null oder `[]` = alle | `citations_invalid_param` bei unbekanntem Wert |
| `p_url_types` | text[] | null | null oder `[]` = alle; `uncategorized` = ohne Typ | `citations_invalid_param` bei unbekanntem Wert |

Zusätzliche Parameter der **Tabellen** (domains, urls, domain_urls):

| Parameter | Typ | Default | Hinweis |
|---|---|---|---|
| `p_search` | text | null | **Ein** Suchbegriff. Die Datenbank faltet selbst: Kleinschreibung, getrimmt; Umlaut-Faltung, wenn `unaccent` verfügbar ist. Domains: Domainname. URLs und Drilldown: URL **und** Titel. |
| `p_order` | text | siehe je Funktion | unbekannter Wert → `citations_invalid_param` (kein stilles Umdeuten mehr) |
| `p_limit` | int | 25 | 1–100 |
| `p_offset` | int | 0 | ≥ 0 |

Die UI schickt heute `page`. Daraus wird `p_offset = (page − 1) × limit`. Das rechnet die Komponente, die Datenbank bekommt nur `limit` und `offset`. `request_id` bleibt in der Komponente: Sie verwirft Antworten auf veraltete Anfragen.

### B3. Definitionen (gelten in allen vier Funktionen gleich)

- **N (Nenner).** Runs mit **mindestens einer Citation** im Zeitraum, gefiltert nach Modell, Markt und Topic. → Entscheidung C1.
- **Domain-Anteil** `share_pct` = Runs mit Domain ÷ N × 100.
- **URL-Globalanteil** `global_share_pct` = Runs mit URL ÷ N × 100.
- **URL-Domainanteil** `domainshare_pct` = Runs mit URL ÷ Runs mit Domain × 100.
- **Vorperiode.** **Gleich lang**, direkt vor `date_from`. → Entscheidung C2.
  - `share_prev_pct` hat den eigenen Nenner der Vorperiode.
  - `share_delta_pct` = jetzt − vorher, in Prozentpunkten.
  - Hat die Vorperiode keine Runs, sind beide `null`, überall gleich.
- **Effektiv-Typ einer Domain:** `team_domain_override` → Host der Team-Firmen → `source_domain.citation_type` → `Misc`.
- **Brand mentioned.**
  - URL: Die URL erwähnt eine eigene Marke (`role = 'own'`).
  - Domain: Mindestens eine im Zeitraum zitierte URL der Domain erwähnt sie.
- **Typ-Verteilung.**
  - `count` = Anzahl Citations (Run × URL) je Typ.
  - `share_pct` = `count` ÷ Summe × 100.
  - Die Summe aller `share_pct` ist 100 (Rest-Ausgleich auf den größten Eintrag).
- **Zeitreihe.**
  - Je Bucket: Runs mit Domain bzw. URL im Bucket ÷ Runs mit Citation im Bucket.
  - Wochen und Monate werden **nicht** über den Zeitraum hinaus erweitert. Angeschnittene Buckets tragen `partial: true`.
  - Die Serie besteht aus den Top N nach Periodenanteil. Das sind genau die ersten N Zeilen der Tabelle bei `share_desc` mit denselben Filtern.
- **Sortierungen sind stabil.** Letzter Schlüssel ist immer `domain` bzw. `url`, damit beim Blättern nichts springt.

### B4. Antwortform

- Wie bei Shopping: `returns jsonb`, Umschlag `{"json": "<Text>"}` über `app.js_json_envelope`. Damit sind Backtick und `${` entfernt und Backslashes verdoppelt.
  - In Bubble: ``JSON.parse(`<json>`)``.
  - In einer normalen Web-App: Den Umschlag auspacken, in `json` die Backslashes halbieren, dann `JSON.parse`.
- Jede Antwort hat einen `meta`-Block.
- Die Gesamtzahl zum Blättern steht **einmal** in `meta.total_count`, nicht auf jeder Zeile.
- Leere Ergebnisse liefern `[]` und `total_count: 0`, keinen Fehler.
- Stabile Fehler-Messages:
  - `citations_invalid_date`
  - `citations_invalid_param` (im Hinweis der Parametername)
  - `citations_domain_required`
  - `citations_rate_limited` (errcode `P0429`)
  - von `require_team_access`: `not authenticated`, `forbidden`, `team_access_*`

**Gemeinsamer `meta`-Block:**

```json
{
  "team_id": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
  "date_from": "2026-09-09",
  "date_to": "2026-10-08",
  "prev_from": "2026-08-10",
  "prev_to": "2026-09-08",
  "filters": { "models": [], "markets": [], "tag_ids": [], "tagmode": "or", "mentioned": "all",
               "mentioned_brands": [], "citation_types": [], "url_types": [] },
  "runs_with_any": 7974,
  "runs_with_any_prev": null,
  "generated_at": "2026-10-08T09:14:02Z",
  "cached": true
}
```

`runs_with_any_prev` ist hier `null`, weil die gleich lange Vorperiode (C2) heute noch nicht gerechnet wird; der echte Wert kommt mit dem Bau. `generated_at` ist ein Beispielzeitpunkt.

Tabellen ergänzen `total_count`, `limit`, `offset`, `order` und `search`.

### B5. `app.cached_citations_overview_v1`

**Zusätzliche Parameter:**

| Parameter | Typ | Default |
|---|---|---|
| `p_mode` | text | `domain` (`domain` oder `url`) |
| `p_granularity` | text | `day` (`day`, `week` oder `month`) |
| `p_series_limit` | int | 7 (1–10) |

**Beispiel** (Domain-Modus, Tag, 30 Tage, Team 877c…):

```json
{
  "meta": { "...": "siehe B4", "mode": "domain", "granularity": "day", "series_limit": 7 },
  "kpis": {
    "runs_with_any": 7974,
    "citations_total": 76293,
    "domains_total": 4910,
    "urls_total": 17561
  },
  "series": [
    { "key": "adac.de",     "domain": "adac.de",     "favicon": "https://www.google.com/s2/favicons?domain=adac.de&sz=128",
      "citation_type": "Institutional",  "citation_type_label": "Institutional", "share_pct": 44.23 },
    { "key": "carwow.de",   "domain": "carwow.de",   "favicon": "https://www.google.com/s2/favicons?domain=carwow.de&sz=128",
      "citation_type": "Brand_Platform", "citation_type_label": "Brand Platform", "share_pct": 37.01 },
    { "key": "finn.com",    "domain": "finn.com",    "favicon": "https://www.google.com/s2/favicons?domain=finn.com&sz=128",
      "citation_type": "Brand_Platform", "citation_type_label": "Brand Platform", "share_pct": 28.83 }
  ],
  "timeseries": [
    { "bucket": "2026-09-09", "partial": false, "key": "adac.de",   "share_pct": 50.00 },
    { "bucket": "2026-09-09", "partial": false, "key": "carwow.de", "share_pct": 44.26 },
    { "bucket": "2026-09-09", "partial": false, "key": "finn.com",  "share_pct": 33.78 }
  ],
  "types": [
    { "type": "Brand_Platform", "label": "Brand Platform", "count": 41778, "share_pct": 54.76 },
    { "type": "Editorial",      "label": "Editorial",      "count": 15518, "share_pct": 20.34 },
    { "type": "Institutional",  "label": "Institutional",  "count": 10795, "share_pct": 14.15 }
  ]
}
```

Hinweise zum Beispiel:

- Gekürzt auf 3 von 7 Serien und 3 von 7 Typen.
- Anteile und KPIs sind echte Prod-Werte vom 08.10.
- `count` ist aus `share_pct` × 76.293 zurückgerechnet und gerundet, weil die heutige Funktion keinen Count liefert.
- Die Labels liefert `app.citation_type_label`; die genaue Schreibweise kommt beim Bau aus der Funktion.

**URL-Modus:**

- `series[]` trägt zusätzlich `url`, `title`, `url_type`, `url_type_label`.
- `key` ist die URL.
- `types[]` enthält URL-Typen.

```json
{ "key": "https://www.adac.de/rund-ums-fahrzeug/elektromobilitaet/elektroauto/elektro-familienautos-2026",
  "url": "https://www.adac.de/rund-ums-fahrzeug/elektromobilitaet/elektroauto/elektro-familienautos-2026",
  "title": "Elektro-Familienautos 2026: Marktübersicht und Preise", "domain": "adac.de",
  "favicon": "https://www.google.com/s2/favicons?domain=adac.de&sz=128",
  "citation_type": "Institutional", "url_type": "listicle", "url_type_label": "Listicle", "share_pct": 6.51 }
```

Typ-Verteilung im URL-Modus (echte Anteile): `listicle` 39,17 %, `product_service` 11,67 %, `marketplace` 10,32 %, … `uncategorized` 0,81 %.

Trending und Fading nehme ich **nicht** auf, solange die UI sie nicht zeigt (siehe C4).

### B6. `app.cached_citations_domains_v1`

- `p_order`: `share_desc` (Default), `share_asc`, `share_delta_desc`, `share_delta_asc`, `last_used_desc`, `last_used_asc`, `domain_asc`, `domain_desc`, `urls_count_desc`, `urls_count_asc`.
- Filter `p_url_types` wirkt hier nicht. Wird er übergeben, wird er ignoriert und in `meta.filters` als nicht angewendet markiert.

**Beispiel** (`share_desc`, Seite 1, `limit` 25; gekürzt auf 3 Zeilen, echte Werte, Delta noch nach heutiger Vorperiode):

```json
{
  "meta": { "...": "siehe B4", "total_count": 4910, "limit": 25, "offset": 0, "order": "share_desc", "search": null },
  "rows": [
    { "domain": "adac.de", "favicon": "https://www.google.com/s2/favicons?domain=adac.de&sz=128",
      "citation_type": "Institutional", "citation_type_label": "Institutional",
      "share_pct": 44.23, "share_prev_pct": 46.59, "share_delta_pct": -2.36,
      "runs_with_domain": 3527, "urls_count": 756, "is_mentioned": true,
      "last_used_at": "2026-10-08T00:16:13Z" },
    { "domain": "carwow.de", "favicon": "https://www.google.com/s2/favicons?domain=carwow.de&sz=128",
      "citation_type": "Brand_Platform", "citation_type_label": "Brand Platform",
      "share_pct": 37.01, "share_prev_pct": 44.19, "share_delta_pct": -7.18,
      "runs_with_domain": 2951, "urls_count": 209, "is_mentioned": true,
      "last_used_at": "2026-10-08T00:16:23Z" },
    { "domain": "finn.com", "favicon": "https://www.google.com/s2/favicons?domain=finn.com&sz=128",
      "citation_type": "Brand_Platform", "citation_type_label": "Brand Platform",
      "share_pct": 28.83, "share_prev_pct": 34.30, "share_delta_pct": -5.47,
      "runs_with_domain": 2299, "urls_count": 98, "is_mentioned": false,
      "last_used_at": "2026-10-08T00:16:23Z" }
  ]
}
```

Herkunft der Werte:

- `runs_with_domain` von adac.de ist aus 44,23 % × 7.974 berechnet.
- `urls_count` von adac.de ist der `total_count` aus dem Drilldown.
- Die `is_mentioned`-Werte sind Beispiele für die Form, keine Prod-Werte.

Gegenüber heute ändert sich in der Zeile:

- `runs_with_any` und `total_count` entfallen, sie stehen in `meta`.
- `is_mentioned` und `citation_type_label` kommen hinzu.

### B7. `app.cached_citations_urls_v1`

- `p_order`: `share_desc` (Default), `share_asc`, `share_delta_desc`, `share_delta_asc`, `last_used_desc`, `last_used_asc`, `domain_asc`, `url_asc`.
- **Beispiel:** gekürzt auf 1 Zeile, echte Werte; Erwähnungen aus dem Prod-Lauf (v33).

```json
{
  "meta": { "...": "siehe B4", "total_count": 17561, "limit": 25, "offset": 0, "order": "share_desc", "search": null },
  "rows": [
    { "url": "https://www.adac.de/rund-ums-fahrzeug/elektromobilitaet/elektroauto/elektro-familienautos-2026",
      "title": "Elektro-Familienautos 2026: Marktübersicht und Preise",
      "domain": "adac.de", "favicon": "https://www.google.com/s2/favicons?domain=adac.de&sz=128",
      "citation_type": "Institutional", "citation_type_label": "Institutional",
      "url_type": "listicle", "url_type_label": "Listicle",
      "global_share_pct": 6.51, "share_prev_pct": 5.77, "share_delta_pct": 0.74,
      "domainshare_pct": 14.72, "runs_with_url": 519,
      "is_mentioned": true,
      "mentions": [
        { "company_id": "87468f49-3d44-4259-98a8-c65714f883c4", "name": "Mercedes Benz", "role": "own",
          "logo_url": "//49eaeb540a500f6e4ee0dfc1266fad7e.cdn.bubble.io/f1782914188332x829122730841226800/mercedes-logo-mercedes-benz-logo-png-transparent-svg-vector-bie-13.png" },
        { "company_id": "6da83f4f-7a95-4079-82ba-ac1b0f481fa1", "name": "BMW", "role": "competitor",
          "logo_url": "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://bmw.de&size=128" },
        { "company_id": "0a88bbf1-9874-45ef-9d72-eb3edd9cb731", "name": "BYD", "role": "competitor",
          "logo_url": "https://www.google.com/s2/favicons?domain=www.byd.com&sz=64" },
        { "company_id": "cc618697-74db-4dd5-bf6a-0efbad9b0403", "name": "KIA", "role": "competitor",
          "logo_url": "https://www.google.com/s2/favicons?domain=www.kia.de&sz=64" }
      ],
      "mentions_total": 8,
      "last_used_at": "2026-10-08T00:16:13Z" }
  ]
}
```

Gegenüber heute ändert sich in der Zeile:

- `is_mentioned` wird ein Boolean statt `'yes'`/`'no'`.
- `last_seen` heißt `last_used_at`, wie bei Domains.
- `used_total` heißt `runs_with_url`.
- `mentions_totalcount` heißt `mentions_total`.
- In `mentions[]` heißt `favicon_url` jetzt `logo_url`; `match_type` (immer null) und `count` (immer 1) entfallen.

Es gilt weiterhin: höchstens 4 Erwähnungen, die eigene Marke zuerst.

### B8. `app.cached_citations_domain_urls_v1`

- Pflichtparameter `p_domain`. Ohne ihn kommt `citations_domain_required`.
- Die Domain wird normalisiert: Kleinschreibung, `www.` entfernt.
- `p_order`: `domainshare_desc` (Default), `domainshare_asc`, `share_delta_desc`, `share_delta_asc`, `last_used_desc`, `url_asc`.
- Die Zeile hat dieselbe Form wie in B7. **Gleicher Nenner wie die URL-Tabelle:** Dieselbe URL hat überall 6,51 %, nicht 6,23 %.

```json
{
  "meta": { "...": "siehe B4", "domain": "adac.de", "runs_with_domain": 3527,
            "total_count": 756, "limit": 25, "offset": 0, "order": "domainshare_desc", "search": null },
  "rows": [
    { "url": "https://www.adac.de/rund-ums-fahrzeug/elektromobilitaet/elektroauto/elektro-familienautos-2026",
      "title": "Elektro-Familienautos 2026: Marktübersicht und Preise", "url_type": "listicle",
      "domainshare_pct": 14.72, "global_share_pct": 6.51, "runs_with_url": 519, "...": "wie B7" },
    { "url": "https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/auto/suv-kaufberatung-2026",
      "title": "SUV-Modelle im Vergleich: Welche sind die besten? Was ist zu beachten?", "url_type": "comparison",
      "domainshare_pct": 11.77, "global_share_pct": 5.20, "runs_with_url": 415, "...": "wie B7" },
    { "url": "https://www.adac.de/rund-ums-fahrzeug/elektromobilitaet/elektroauto/elektro-kombis-2026",
      "title": "Elektrokombis 2026: Diese Modelle gibt es aktuell", "url_type": "listicle",
      "domainshare_pct": 7.80, "global_share_pct": 3.45, "runs_with_url": 275, "...": "wie B7" }
  ]
}
```

Probe für die Konsistenz der Werte: 519 ÷ 3.527 = 14,72 % und 519 ÷ 7.974 = 6,51 %. Beides passt zu Kopf, Chart und Domains-Tabelle.

### B9. `app.clear_citations_cache_v1(p_team uuid)`

- Löscht alle Einträge des Teams in `rpc_cache` mit `fn_name like 'citations\_%\_v1'`.
- Rate-Limit: 10 pro Minute.
- Antwort im Umschlag: `{"deleted": 4}`.
- Die alten Clear-Funktionen bleiben unverändert, bis die alte Seite abgeschaltet ist.

### B10. Cache

- Wie bei Shopping: Je Filter-Kombination wird das **Rohergebnis** in `rpc_cache` gespeichert, mit `params` und `recompute_sql` für das Warming. Der Umschlag wird erst bei der Ausgabe gebaut.
- **Tabellen:** Gecacht wird die sortierte Gesamtliste bis 500 Zeilen je Kombination aus Filter, Suche und Sortierung. Seiten werden daraus geschnitten. Darüber wird ohne Cache gerechnet.
- **TTL:** `app.cache_ttl_for_team`.
- **Vor dem Bau zu klären:** Woran `trg_invalidate_rpc_cache` hängt. Löscht er bei jedem neuen Run den ganzen Team-Cache, bringt der Cache für aktive Teams wenig. Ein kurzer Check folgt mit dem Bau-Auftrag.

### B11. Tests, die mitgeliefert werden

Nach dem Muster der Shopping- und Ads-Prod-Tests:

- Unabhängig nachgerechnete KPIs und Anteile.
- Gleiche Anteile für gleiche Entitäten über alle vier Funktionen.
- Chart-Serie = erste N Tabellenzeilen.
- Typ-Summe = 100.
- Paging stabil.
- Fehlercodes greifen, fremder Nutzer wird abgewiesen.
- Laufzeiten für 30 und 90 Tage am größten Team.

---

## Teil C – Entscheidungen vor dem Bau

| # | Frage | Optionen | Empfehlung |
|---|---|---|---|
| C1 | Nenner N für alle Anteile | a) Runs mit mind. einer Citation (Domains, Kopf, Chart heute) · b) alle erfolgreichen Runs (Drilldown heute) | **a**: Domain-Werte bleiben gleich, nur der Drilldown ändert sich |
| C2 | Vorperiode für das Delta | a) gleich lang direkt davor · b) wie heute halbe Länge, max. 30 Tage | **a**: entspricht der Erwartung in deinem Auftrag; alle Deltas ändern sich einmalig |
| C3 | Welche Bubble-Calls lösen die fünf Elemente und „Aktualisieren“ heute aus? | Liste aus dem Bubble-Editor | bestätigt A1 und A5.5 |
| C4 | Zeigt die UI Trending/Fading-Domains? | ja → in `overview_v1` aufnehmen und reparieren · nein → weglassen | weglassen, falls nicht im Design |
| C5 | Default-Zeitraum, wenn die UI keinen schickt | 30 Tage (Vorschlag) · 7 Tage (heute) | 30 Tage |
| C6 | Sicherheitsbefund aus A3 (`set_citation_type` usw. für anon) | eigener Hotfix sofort · später | **sofort**, eigene Datei, unabhängig von dieser Seite |
