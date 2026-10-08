# Citations v1 – Vertrag (gebaut, Stand 08.10.2026)

> Wortgleich vom Datenbank-Chat übernommen (08.10.). Prüfung gegen die Oberfläche und offene
> Punkte: `citations_db_rueckmeldung.md`, Abschnitt „Rückmeldung 2“.
>
> **Gegen Prod gemessen (08.10., 20 Fälle, `testdaten/citations_v1/lauf1_team_e6037cb1.json`).**
> Laufzeiten 42–334 ms, aus dem Cache um 60 ms. Drei Abweichungen, an den DB-Chat gemeldet:
> 1. `meta.stale` fehlt in allen Antworten.
> 2. Ohne `p_domain` kommt nicht `citations_domain_required`, sondern HTTP 404 von PostgREST
>    („Could not find the function …“), weil `p_domain` keinen Default hat.
> 3. `citations_rate_limited` kommt als HTTP 500 (`P0429` kennt PostgREST nicht; `PT429` gäbe 429).
>
> Die Oberfläche liest Fehler über `message`, nicht über den Status. Keiner der drei Punkte
> blockiert sie.

Dieser Vertrag ersetzt Teil B von `CITATIONS_BACKEND_VERTRAG.md`. Eingearbeitet sind die Rückmeldung vom 08.10. und die Bestandsaufnahmen 2 und 3.

| Datei | Zweck |
|---|---|
| `citations_v1.sql` | Deploy |
| `citations_v1_rueckweg.sql` | Rückweg |
| `citations_v1_prod_test.sql` | Tests B11 + Laufzeiten |
| `citations_v1_beispiele.sql` | Echte, ungekürzte Antworten (Abschnitt 4) |

**Bestand bleibt unverändert.** Es entstehen nur neue Objekte. Keine bestehende Funktion, Tabelle, kein Trigger und keine Berechtigung wird angefasst.

## 1. Aufruf

- PostgREST, Schema `app`, mit dem Nutzer-JWT: `POST /rest/v1/rpc/<funktion>` mit dem Header `Content-Profile: app`.
- Die Antwort ist **reines jsonb**, ohne Umschlag.
- Die Funktionen laufen als `security definer` mit `search_path = app, public, pg_temp`.
- Zugriff hat nur `authenticated` (und `service_role`). `anon` und `public` sind gesperrt. Interne Helfer sind auch für `authenticated` gesperrt.
- Der Zugang wird über `app.require_team_access(p_team)` geprüft.

| Funktion | Zweck | Rate-Limit je Nutzer |
|---|---|---|
| `cached_citations_overview_v1` | KPIs, Zeitreihe Top N, Typ-Verteilung | 60 pro Minute |
| `cached_citations_domains_v1` | Domains-Tabelle | 60 pro Minute |
| `cached_citations_urls_v1` | URLs-Tabelle | 60 pro Minute |
| `cached_citations_domain_urls_v1` | Drilldown: URLs einer Domain | 60 pro Minute |
| `clear_citations_cache_v1` | „Aktualisieren“ | 10 pro Minute |

Das Rate-Limit zählt je Funktion in festen Minutenfenstern.

## 2. Parameter

### Gemeinsame Parameter

| Parameter | Typ | Default | „leer“ bedeutet |
|---|---|---|---|
| `p_team` | uuid | Pflicht | – |
| `p_date_from`, `p_date_to` | date (Berliner Kalendertag) | bis heute, ab `date_to − 6` (wie die bestehenden Citations-Funktionen) | – |
| `p_models`, `p_markets` | text[] | null | null oder `[]` = alle |
| `p_tag_ids` | uuid[] | null | null oder `[]` = alle |
| `p_tagmode` | text `or` / `and` | `or` | – |
| `p_mentioned` | text `all` / `yes` / `no` | `all` | – |
| `p_mentioned_brands` | uuid[] | null | null oder `[]` = kein Filter |
| `p_citation_types` | text[] (Enum-Schlüssel) | null | null oder `[]` = alle |
| `p_url_types` | text[] (Enum-Schlüssel + `uncategorized`) | null | null oder `[]` = alle |

Weitere Regeln:

- **Marken-Filter:** Eine URL zählt, wenn sie **mindestens eine** der gewählten Marken erwähnt (oder). Eine Domain zählt, wenn mindestens eine ihrer URLs im Zeitraum das tut.
- **Brand mentioned:** Bei einer URL heißt es, sie erwähnt eine eigene Marke. Bei einer Domain heißt es, mindestens eine ihrer URLs im Zeitraum tut das.
- **Arrays:** Sie werden sortiert und von Dubletten bereinigt. Für den Cache ist die Reihenfolge deshalb egal.

### Parameter der Tabellen

| Parameter | Typ | Default | Regel |
|---|---|---|---|
| `p_search` | text | null | getrimmt, auf 200 Zeichen gekürzt, `%`, `_` und `\` werden maskiert |
| `p_order` | text | siehe unten | ein unbekannter Wert ergibt `citations_invalid_param` |
| `p_limit` | int | 25 | 1–100 |
| `p_offset` | int | 0 | ≥ 0 |

- **Suche (ab `citations_v1_perf_4.sql`):** Groß- und Kleinschreibung spielen keine Rolle, Umlaute und Akzente werden gefaltet. Ein Feld trifft, wenn eine dieser Bedingungen gilt:
  - `_suche_norm(feld)` enthält `_suche_norm(p_search)` (lower, ä→ae, ö→oe, ü→ue, ß→ss, dann `unaccent`),
  - `unaccent(lower(feld))` enthält `unaccent(lower(p_search))`,
  - bisheriges `ilike` (darum findet die Suche nie weniger als vorher).

  Beispiele: „fuer“ findet „für“, „für“ findet „fuer“ und „fur“, „strasse“ findet „Straße“, „creme“ findet „Crème“. „muller“ findet „Mueller“ **nicht**. Die Escape-Regel für `%`, `_` und `\` bleibt.
- Domains durchsucht die Suche im Domainnamen. URLs und Drilldown durchsucht sie in URL **und** Titel.

**Sortierungen:**

- domains: `share_desc` (Default), `share_asc`, `share_delta_desc`, `share_delta_asc`, `last_used_desc`, `last_used_asc`, `domain_asc`, `domain_desc`, `urls_count_desc`, `urls_count_asc`
- urls: `share_desc` (Default), `share_asc`, `share_delta_desc`, `share_delta_asc`, `last_used_desc`, `last_used_asc`, `domain_asc`, `url_asc`
- domain_urls: `domainshare_desc` (Default), `domainshare_asc`, `share_delta_desc`, `share_delta_asc`, `last_used_desc`, `url_asc`

Für alle Sortierungen gilt: Null-Werte stehen am Ende, gleiche Werte werden nach `domain` bzw. `url` aufsteigend geordnet. Damit bleibt das Blättern stabil.

### Parameter der einzelnen Funktionen

- **overview:**
  - `p_mode` `domain` (Default) oder `url`
  - `p_granularity` `day` (Default), `week` oder `month`
  - `p_series_limit` 1–10, Default 7
- **domain_urls:** `p_domain` ist Pflicht. Der Wert wird kleingeschrieben und von `www.` befreit.

## 3. Definitionen

- **Zeitzone:** Europe/Berlin. Tage und Buckets sind Berliner Kalendertage, genau wie die Rollups (`ingest_prompt_run`: `now() at time zone 'Europe/Berlin'`). In `meta.timezone` steht `"Europe/Berlin"`.
- **N** = Runs mit mindestens einer Citation, gefiltert nach Modell, Markt und Topic. Die Quelle sind die Citation-Run-Rollups. Ein Abgleich mit den Rohdaten der letzten 7 Tage stimmte exakt.
- **Domain-Anteil** `share_pct` = Runs mit Domain ÷ N.
- **URL-Globalanteil** `global_share_pct` = Runs mit URL ÷ N.
- **URL-Domainanteil** `domainshare_pct` = Runs mit URL ÷ Runs mit Domain.
- **Vorperiode:** `greatest(least(Tage / 2, 30), 1)` Tage direkt vor `date_from`, so wie heute in der App. Die Grenzen stehen in `meta.prev_from` und `meta.prev_to`.
  - `share_prev_pct` hat den eigenen Nenner `meta.runs_with_any_prev`.
  - `share_delta_pct` = `share_pct − share_prev_pct` in Prozentpunkten.
  - Gibt es in der Vorperiode keine Runs, sind beide Werte `null`.
- **Effektiv-Typ einer Domain:** Es gilt der erste vorhandene Wert:
  1. `team_domain_override` (own → `You`, competitor → `Competition`)
  2. Host von `company.url` einer Team-Firma
  3. `source_domain.citation_type`
  4. `Misc`
  - Domains ohne `source_domain`-Eintrag zählen als `Misc` mit. Die alte Seite hat sie weggelassen.
- **Domain-Normalisierung:**
  - Domains und URLs kommen bereits normalisiert aus den Rollups (`domain_norm` beim Ingest). Beim Lesen wird nichts nachnormalisiert.
  - `source_domain` und `team_domain_override` werden mit demselben Ausdruck verglichen wie in allen bestehenden Citation-Funktionen (`regexp_replace(lower(domain), '^www\.', '')`, mit Ausdrucks-Index).
  - Der Host der Firmen-URL und die Eingabe `p_domain` laufen über `app._url_domain_norm`, dieselbe Funktion wie bei `team_domain_override`.
  - URL-Eingaben gibt es nicht, deshalb wird `url_norm_v1` nicht gebraucht.
- **Zeitreihe:**
  - Wochen sind ISO-Wochen (Montag bis Sonntag), Monate sind Kalendermonate.
  - `bucket` ist der Start der Woche bzw. des Monats. `bucket_from` und `bucket_to` sind die tatsächlich gezählten Tage innerhalb des Zeitraums.
  - `partial: true` markiert angeschnittene Buckets.
  - Ein Bucket-Anteil = Runs mit dem Eintrag in den gezählten Tagen ÷ Runs mit Citation in den gezählten Tagen (`runs_with_any`).
- **Serien:** Die Serien sind die ersten N Zeilen der Domains- bzw. URL-Tabelle mit denselben Filtern und `share_desc`. Ihr `share_pct` ist identisch mit der Tabelle.
- **Typ-Verteilung:**
  - `count` = Anzahl Citations (Run × URL), `share_pct` = `count` ÷ Summe. Die Summe ergibt genau 100; der Rundungsrest geht auf den größten Eintrag.
  - Der Filter auf den **angezeigten** Typ wirkt hier nicht: Im Domain-Modus wird `p_citation_types` ignoriert, im URL-Modus `p_url_types`. So zeigt die Verteilung weiter alle Typen.
  - Ohne Typ-Filter gilt: Σ `count` = `kpis.citations_total`.
- **Gleiche Zahlen über die Funktionen hinweg:**
  - `kpis.domains_total` = `total_count` der Domains-Tabelle.
  - `kpis.urls_total` = `total_count` der URL-Tabelle, bei gleichen Filtern.
- **Nicht angewendete Filter** stehen in `meta.ignored_filters`, z. B. `["url_types"]`:
  - bei domains immer, wenn `p_url_types` gesetzt ist;
  - im Domain-Modus der overview ebenso.
- **Logos und Favicons** sind immer absolut. Werte mit `//…` (Bubble-CDN) bekommen `https:` vorangestellt.
- **Typ-Schlüssel sind stabil:**
  - `citation_type`: `Editorial`, `UGC_Community`, `Knowledge_Base`, `Brand_Platform`, `Institutional`, `Misc`, `Competition`, `You`.
  - `url_type`: die 15 Enum-Werte plus `uncategorized`.
  - Die Labels kommen aus `app.citation_type_label` und `app.url_type_label`. `Misc` und `uncategorized` haben das Label `null`; dafür braucht die Oberfläche einen eigenen Text.
  - Neue Werte kündige ich vorher an.

## 4. Antwortform

Jede Antwort hat einen `meta`-Block:

```json
{
  "team_id": "877c649c-…", "timezone": "Europe/Berlin",
  "date_from": "2026-09-09", "date_to": "2026-10-08",
  "prev_from": "2026-08-25", "prev_to": "2026-09-08",
  "filters": { "models": [], "markets": [], "tag_ids": [], "tagmode": "or", "mentioned": "all",
               "mentioned_brands": [], "citation_types": [], "url_types": [] },
  "ignored_filters": [],
  "runs_with_any": 7974, "runs_with_any_prev": 4012,
  "generated_at": "2026-10-08T09:14:02Z", "cached": false, "stale": false
}
```

Die Zahlenwerte sind nur zur Illustration; die echten stehen in den Beispielantworten.

| Funktion | zusätzlich in `meta` | Body |
|---|---|---|
| overview | `mode`, `granularity`, `series_limit` | `kpis`, `series[]`, `timeseries[]`, `types[]` |
| domains | `total_count`, `limit`, `offset`, `order`, `search` | `rows[]` |
| urls | wie domains | `rows[]` |
| domain_urls | wie domains + `domain`, `runs_with_domain` | `rows[]` |
| clear | – (kein `meta`) | `{"team_id": …, "deleted": n}` |

**Felder:**

- `kpis`: `runs_with_any`, `citations_total`, `domains_total`, `urls_total`
- `series[]`: `key`, `domain`, `favicon`, `citation_type`, `citation_type_label`, `share_pct`, `runs_with`. Im URL-Modus zusätzlich `url`, `title`, `url_type`, `url_type_label`.
- `timeseries[]`: `bucket`, `bucket_from`, `bucket_to`, `partial`, `key`, `share_pct`, `runs_with`, `runs_with_any`
- `types[]`: `type`, `label`, `count`, `share_pct`
- Domains-Zeile: `domain`, `favicon`, `citation_type`, `citation_type_label`, `share_pct`, `share_prev_pct`, `share_delta_pct`, `runs_with_domain`, `used_total`, `urls_count`, `is_mentioned`, `first_used_at`, `last_used_at`
- URL-Zeile (urls und domain_urls):
  - `url`, `title`, `domain`, `favicon`, `citation_type`, `citation_type_label`, `url_type`, `url_type_label`
  - `global_share_pct`, `share_prev_pct`, `share_delta_pct`, `domainshare_pct`, `runs_with_url`
  - `is_mentioned`, `mentions[]` (höchstens 4, eigene Marke zuerst: `company_id`, `name`, `role`, `logo_url`), `mentions_total`
  - `first_used_at`, `last_used_at`

**Leere Ergebnisse** liefern `rows: []` und `total_count: 0`, keinen Fehler.

**Fehler** kommen so, wie PostgREST sie ausgibt: `{code, message, details, hint}`.

| message | code | hint |
|---|---|---|
| `citations_invalid_param` | 22023 | Parametername, bei Typen mit den unbekannten Werten |
| `citations_invalid_date` | 22023 | Regel (`date_from <= date_to`, `date_to <=` heute + 1, höchstens 366 Tage) |
| `citations_domain_required` | 22023 | `p_domain` |
| `citations_rate_limited` | P0429 | Sekunden bis zum nächsten Minutenfenster |
| `not authenticated`, `forbidden` (42501), `team_access_*` (P0403) | | aus `require_team_access` |

## 5. Cache

Das Verhalten nach außen bleibt gleich. Neu ist nur das Feld `meta.stale`; Felder dürfen laut Versionsregel dazukommen.

- **Eigene Cache-Tabelle `app.citations_cache`.** Der Trigger, der bei jedem neuen Run `rpc_cache` für das ganze Team leert, berührt diese Tabelle nicht. Gecacht wird das Rohergebnis je Kombination aus Filter, Suche und Sortierung. Bei Tabellen ist das die sortierte Liste bis 500 Zeilen; die Seiten werden daraus geschnitten. Ab `offset + limit > 500` wird direkt gerechnet.
- **Versioniert.** Jeder Eintrag trägt den Datenstand, aus dem er gerechnet wurde. Der Datenstand setzt sich zusammen aus:
  - der letzten Änderung der Citation-Rollups im Zeitraum inklusive Vorperiode;
  - den Domain-Overrides;
  - den Team-Firmen.

  Kommt ein neuer Run, wird der Eintrag dadurch nur „veraltet“ und nicht gelöscht.
- **Stale-while-revalidate.** Bis 15 Minuten nach einer Datenänderung kommt die Antwort sofort aus dem Cache, mit `meta.cached: true` und `meta.stale: true`. Ein Hintergrund-Job (`citations-cache-refresh`, alle 5 Minuten) rechnet genutzte Einträge neu. Die nächste Antwort ist dann wieder frisch (`stale: false`).
  - Die Oberfläche kann `stale` dezent anzeigen, etwa mit „wird aktualisiert“, muss es aber nicht.
  - Ist ein Eintrag länger als 15 Minuten veraltet oder älter als 6 Stunden, wird beim Aufruf neu gerechnet.
- **Request-Coalescing.** Rufen mehrere Nutzer gleichzeitig dieselbe Ansicht auf, wird sie nur einmal berechnet; die anderen warten kurz und lesen das Ergebnis.
- **Aufräumen.** Einträge, die 7 Tage nicht genutzt wurden, entfernt der Hintergrund-Job.
- **Aufruf per POST.** Die Funktionen schreiben in den Cache. Deshalb per `POST /rest/v1/rpc/...` aufrufen; ein GET läuft bei PostgREST schreibgeschützt.
- **„Aktualisieren“.** `clear_citations_cache_v1` löscht die Citations-Cache-Einträge des Teams. `deleted` zählt die gelöschten Einträge.

## 6. Versionsregel

- Felder dürfen dazukommen.
- Umbenennen, Entfernen oder eine geänderte Bedeutung heißt `_v2`. `_v1` läuft weiter, bis die Oberfläche umgestellt ist.
- Der Export kommt in einer späteren Runde und nutzt denselben Unterbau (`_citations_scope_v1` / `_citations_sets_v1`).
