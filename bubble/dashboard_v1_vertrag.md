# Dashboard v1 – Vertrag (in Prod, Stand 08.10.2026)

Die echten, ungekürzten Antworten sind die Ausgabe von `dashboard_v1_beispiele.sql` vom 08.10.2026 (19 Beispiele: overview, visibility, responses, clear und alle Fehler). Gib sie Claude Code zusammen mit diesem Vertrag.

Hinweis zu Fehlern: Ohne Hinweis kommt `hint` von PostgREST als `null`; in der SQL-Ausgabe steht dafür `""`.

Grundlage: Rückmeldung vom 08.10. (Entscheidungen 1–4, Zuschnitt ohne `cached_dashboard_agentic_v1`). Vorbild: `CITATIONS_V1_VERTRAG.md`. Was dort gilt und hier nicht anders steht, gilt auch hier.

| Datei | Zweck |
|---|---|
| `dashboard_v1.sql` | Deploy |
| `dashboard_v1_rueckweg.sql` | Rückweg |
| `dashboard_v1_prod_test.sql` | Gleichheit mit v24 / v16 / v21 und Laufzeiten, 30 Tage |
| `dashboard_v1_prod_test_2.sql` | 90 / 180 Tage, Top Citations mit `p_series_limit: 0` |
| `dashboard_v1_beispiele.sql` | Echte, ungekürzte Antworten (Team 877c) |
| `rechte_bestand_dashboard.sql` (+ `_rueckweg`) | Rechtekorrektur der alten RPCs, erst nach der Bubble-Umstellung |

**Bestand bleibt unverändert:** v24, v16, v21, `get_power_dashboard_v1` und alle Bubble-RPCs. Eine einzige Änderung ist abwärtskompatibel: `cached_citations_overview_v1` akzeptiert jetzt `p_series_limit: 0`.

## 1. Aufruf

- PostgREST, Schema `app`, Nutzer-JWT, **`POST`** `/rest/v1/rpc/<funktion>`, Header `Content-Profile: app`.
  - POST ist nötig, weil die Funktionen in den Cache schreiben.
- Die Antwort ist reines jsonb.
- Nur `authenticated` (und `service_role`) darf die Funktionen ausführen. `anon` ist gesperrt, interne Helfer `_dash_*` sind auch für `authenticated` gesperrt.
- Der Zugang wird über `app.require_team_access(p_team)` geprüft. Der Nutzer kommt immer aus dem JWT.

| Funktion | Zweck | Rate-Limit je Nutzer |
|---|---|---|
| `cached_dashboard_overview_v1` | Kennzahlen `own` / `field`, Markentabelle | 60 pro Minute |
| `cached_dashboard_visibility_v1` | Visibility-Chart | 60 pro Minute |
| `cached_dashboard_responses_v1` | Responses | 60 pro Minute |
| `clear_dashboard_cache_v1` | „Aktualisieren“ | 10 pro Minute |
| `cached_citations_overview_v1` (besteht) | Top Citations: `kpis`, `types` mit `p_series_limit: 0` | 60 pro Minute |
| `cached_citations_domains_v1` / `_urls_v1` (bestehen) | Top-Domains / Top-URLs | 60 pro Minute |

**Was die Oberfläche je Ansicht aufruft (parallel):**

| Ansicht | Aufrufe |
|---|---|
| Analytic | overview (Tabelle), visibility, `cached_citations_overview_v1` (`p_series_limit: 0`) + domains/urls (`p_limit: 7`), responses |
| Agentic | overview (`p_limit: 5`, `visibility_desc`), domains/urls (`p_limit: 5`, `p_order: share_delta_desc`) |

Die Oberfläche hängt die eigene Marke (`own`) selbst an die Top-Liste an. Chats kommen weiter aus Ask Mira, Opportunities aus ihrer eigenen Komponente.

## 2. Parameter

### Gemeinsam (alle Dashboard-Funktionen)

| Parameter | Typ | Default | „leer“ bedeutet |
|---|---|---|---|
| `p_team` | uuid | `null` → `dashboard_team_required` | – |
| `p_date_from`, `p_date_to` | date (Berliner Kalendertag) | bis heute, ab `date_to − 29` | – |
| `p_models`, `p_markets` | text[] | null | null oder `[]` = alle |
| `p_tag_ids` | uuid[] | null | null oder `[]` = alle |
| `p_tagmode` | `or` / `and` | `or` | – |

- Einen Prompt-Filter gibt es nicht.
- Arrays werden sortiert und von Dubletten bereinigt.
- Für dieselben Zahlen wie in Top Citations schickt die Oberfläche denselben Zeitraum und dieselben Filter auch an die Citations-Funktionen.

### `cached_dashboard_overview_v1`

| Parameter | Typ | Default | Regel |
|---|---|---|---|
| `p_order` | text | `visibility_desc` | `visibility`, `rank`, `sentiment`, `mentions`, `name` je mit `_asc` / `_desc`; bei Gleichstand gilt `position` |
| `p_limit` | int | 25 | 1–100 |
| `p_offset` | int | 0 | ≥ 0 |
| `p_search` | text | null | Markenname; getrimmt, höchstens 200 Zeichen. Groß-/Kleinschreibung egal, Umlaute gefaltet wie in der Citations-Suche („mueller“ findet „Müller“) |
| `p_companies` | uuid[] | null | nur diese Marken in `rows` |

### `cached_dashboard_visibility_v1`

| Parameter | Typ | Default | Regel |
|---|---|---|---|
| `p_granularity` | `day` / `week` / `month` | `day` | – |
| `p_companies` | uuid[] | null | höchstens 10; genau diese Marken (eigene Marke nur, wenn enthalten) |
| `p_series_limit` | int | 7 | 1–10, nur ohne `p_companies`: Top N nach `position`. Ist die eigene Marke nicht dabei, sind es Top N−1 plus die eigene Marke |

### `cached_dashboard_responses_v1`

| Parameter | Typ | Default | Regel |
|---|---|---|---|
| `p_order` | text | `run_at_desc` | `run_at_desc`, `run_at_asc`, `rank_asc`, `rank_desc`, `sentiment_asc`, `sentiment_desc` |
| `p_limit` | int | 15 | 1–50 |
| `p_offset` | int | 0 | ≥ 0 |
| `p_mentioned` | `all` / `yes` / `no` | `all` | eigene Marke erwähnt |
| `p_company_ids` | uuid[] | null | Response erwähnt mindestens eine davon |
| `p_sentiment_min`, `p_sentiment_max` | int 0–100 | null | Sentiment der eigenen Marke, min ≤ max |
| `p_rank_min`, `p_rank_max` | int ≥ 1 | null | Rang der eigenen Marke, min ≤ max; „20+“ schickt kein `p_rank_max` |
| `p_search` | text | null | Prompt-Text, wie v21 |

### `cached_citations_overview_v1` (Zusatz)

`p_series_limit` darf jetzt `0` sein: Dann sind `series: []` und `timeseries: []`, und `kpis` und `types` sind unverändert. Alles andere bleibt wie im Citations-Vertrag.

## 3. Definitionen

- **Zeitzone:** Europe/Berlin.
- **Visibility** `visibility_pct` = Runs mit Erwähnung ÷ alle Runs im Zeitraum, nach Modell, Markt und Topic gefiltert.
  - Gezählt wird je Marke nur innerhalb ihres Tracking-Fensters.
  - Gewichtet über alle Runs, kein Mittel von Tageswerten.
  - Zahlen gleich mit `get_competition_overview_v24`.
- **Position** = Platz in der Liste aller Marken des Teams nach `visibility_pct` absteigend. Bei Gleichstand entscheidet der Name aufsteigend.
  - Die Position hängt nicht von `p_order`, `p_search` oder `p_companies` ab.
- **Rang** `avg_rank` = Summe der Ränge ÷ Anzahl Runs mit Rang. Kleiner ist besser, ein positives Delta ist also eine Verschlechterung.
- **Sentiment** `sentiment` = Mittel des Sentiments (0–100) aller Recommendations der Marke im Tracking-Fenster.
  - **Höchstens die letzten 30 Tage** des Zeitraums (Regel wie in der ganzen App). In der Vorperiode gilt dasselbe für ihre letzten 30 Tage.
  - Der tatsächliche Beginn steht in `meta.sentiment_from` bzw. `meta.sentiment_prev_from`. Bei 90 Tagen ist `sentiment_from` = `date_to − 29`.
  - Gleich wie v24 in allen Zeiträumen.
- **Vorperiode:** `greatest(least(Tage / 2, 30), 1)` Tage direkt vor `date_from`; die Grenzen stehen in `meta.prev_from` und `meta.prev_to`.
  - Deltas sind Differenzen in Prozent- bzw. Rangpunkten.
  - Fehlen Runs in der Vorperiode, sind `*_prev` und `*_delta` `null`.
  - `mentions_prev` ist eine absolute Zahl über den kürzeren Zeitraum.
- **`own`** = die Zeile der eigenen Marke (unabhängig von Suche, Auswahl und Seite), zusätzlich mit `runs_with_sentiment` und `runs_with_sentiment_prev`.
  - Gibt es keine eigene Marke, ist `own` `null` und `meta.has_own_brand` `false`.
- **`field`:**
  - `brand_count` = Zahl der Marken;
  - `best_rank` = kleinster `avg_rank`;
  - `avg_sentiment` = ungewichtetes Mittel der Marken-Sentiments.
  - Alle Werte mit 2 Nachkommastellen; runden soll die Oberfläche.
- **`meta.runs_total`** = alle Runs im Zeitraum mit den Filtern (ohne Tracking-Fenster), `runs_total_prev` dasselbe für die Vorperiode.
- **Chart-Buckets:**
  - ISO-Wochen bzw. Kalendermonate, `bucket` ist der Start.
  - `bucket_from` und `bucket_to` sind die gezählten Tage im Zeitraum, `partial: true` markiert angeschnittene Buckets. Es wird nichts aufgefüllt und nichts ausgedünnt.
  - Bucket-Wert = Erwähnungen ÷ Runs in den gezählten Tagen, je Marke im Tracking-Fenster.
  - Ohne Runs (oder außerhalb des Tracking-Fensters) sind `visibility_pct` und `avg_rank` `null`; die Oberfläche zeichnet dort eine Lücke.
  - Die Summe von `runs_with` über alle Buckets einer Marke ist gleich `mentions` in der Overview.
  - `companies[].visibility_pct` und `avg_rank` sind dieselben Werte wie in der Overview.
  - Abweichung von v16: v16 zeigte `avg_rank` auch an Tagen außerhalb des Tracking-Fensters.
- **Farben:**
  - Zuerst die Team-Einstellung, dann die Firmenfarbe, sonst eine Palette nach Reihenfolge: `#14b8a6`, `#0ea5e9`, `#6366f1`, `#d946ef`, `#f97316`, `#f43f5e`, `#84cc16`, `#eab308`, `#8b5cf6`, `#64748b`.
  - Bis Platz 7 gleich wie v16.
- **Responses:**
  - Felder und Reihenfolge wie `get_mentions_overview_v21`. Gleichheit gemessen für alle Filter und Sortierungen.
  - `has_user_brand` bleibt `"yes"`/`"no"`, neu ist `own_mentioned` (boolean).
  - `total_count` steht nur in `meta`. `matched_event_url_ids` entfällt.
  - `sources_preview` hat höchstens 5 Einträge, `response_preview` höchstens 100 Zeichen.
- **Logos und Favicons** sind immer absolut (`//…` bekommt `https:`). Das gilt in `rows`, `own`, `companies`, `companies_preview` und `sources_preview`.

## 4. Antwortform

`meta` (alle Funktionen):

- `team_id`, `timezone`, `date_from`, `date_to`, `filters`, `ignored_filters` (`[]`), `generated_at`, `cached`, `stale`.
- overview und visibility zusätzlich: `prev_from`, `prev_to`, `has_own_brand`, `runs_total`, `runs_total_prev`, `sentiment_from`, `sentiment_prev_from`.

| Funktion | zusätzlich in `meta` | Body |
|---|---|---|
| overview | `total_count` (Treffer nach Suche/Auswahl), `limit`, `offset`, `order`, `search`, `companies` | `own`, `field`, `rows[]` |
| visibility | `granularity`, `series_limit`, `companies_selected` (`auto` / `manual`) | `companies[]`, `series[]` |
| responses | `total_count`, `limit`, `offset`, `order`; `filters` mit allen Response-Filtern | `rows[]` |
| clear | – (kein `meta`) | `{"team_id": …, "deleted": n}` |

**Felder:**

- overview `rows[]` und `own`: `position`, `company_id`, `name`, `logo_url`, `is_own`, `visibility_pct`, `visibility_prev_pct`, `visibility_delta_pct`, `avg_rank`, `avg_rank_prev`, `avg_rank_delta`, `sentiment`, `sentiment_prev`, `sentiment_delta`, `mentions`, `mentions_prev`
- visibility `companies[]`: `company_id`, `name`, `logo_url`, `is_own`, `position`, `color`, `visibility_pct`, `avg_rank`
- visibility `series[]`: `bucket`, `bucket_from`, `bucket_to`, `partial`, `company_id`, `visibility_pct`, `avg_rank`, `runs_with`, `runs_total`. Vollständiges Raster: jede Marke × jeder Bucket, sortiert nach Marke, dann Bucket.
- responses `rows[]`: `prompt_run_id`, `run_at`, `model`, `prompt_id`, `prompt_text`, `user_rank`, `user_sentiment`, `has_user_brand`, `own_mentioned`, `companies_preview[]` (`company_id`, `name`, `rank`, `brand_name_raw`, `favicon_url`), `companies_preview_totalcount`, `sources_preview[]` (`pos`, `url`, `title`, `domain`, `favicon`), `sources_totalcount`, `response_preview`

**Leere Ergebnisse:** `rows: []` mit `meta.total_count: 0`, kein Fehler. Bei leerer Suche bleibt `own` gefüllt.

Die echten, ungekürzten Antworten liefert `dashboard_v1_beispiele.sql`.

**Fehler** in PostgREST-Form `{code, message, details, hint}`:

| message | code | hint |
|---|---|---|
| `dashboard_team_required` | 22023 | `p_team` |
| `dashboard_invalid_param` | 22023 | Parametername und erlaubte Werte, z. B. `p_order: visibility_desc, …` |
| `dashboard_invalid_date` | 22023 | `date_from <= date_to, date_to <= heute, Zeitraum <= 366 Tage` |
| `dashboard_rate_limited` | **PT429** (HTTP 429) | Sekunden bis zum nächsten Minutenfenster |
| `not authenticated`, `forbidden` (42501), `team_access_*` (P0403) | | aus `require_team_access` |

Die Oberfläche prüft auf `message` `*_rate_limited`; Citations bleibt bei `P0429`.

## 5. Cache

- **Eigene Tabelle `app.dashboard_cache`.** Sie hat dieselben Spalten wie `app.citations_cache`; der Run-Trigger auf `rpc_cache` berührt sie nicht.
  - Overview: ganze Markenliste je Filter, Suche und Sortierung.
  - Visibility: je Filter, Granularität und Auswahl.
  - Responses: die ersten 50 Zeilen je Filter und Sortierung. Ab `offset + limit > 50` wird direkt gerechnet; `total_count` kommt dann trotzdem aus dem Cache.
- **Datenstand** eines Teams:
  - letzter Run;
  - letzte Rollup-Änderung im Zeitraum und in der Vorperiode;
  - Firmen und Rollen;
  - Tracking-Perioden;
  - Markenprofile.
- **Stale-while-revalidate:**
  - Bei gleichem Datenstand kommt die Antwort aus dem Cache (bis 6 Stunden).
  - Hat sich der Datenstand geändert und ist der Eintrag jünger als 2 Stunden, kommt die Antwort sofort mit `meta.cached: true, meta.stale: true`. Der Hintergrund-Job `dashboard-cache-refresh` (alle 5 Minuten, versetzt zu Citations) rechnet ihn neu.
  - Sonst wird beim Aufruf gerechnet.
  - Ein neuer Run führt also nicht zu kalten Zeiten.
- **Coalescing:** Rufen mehrere Nutzer gleichzeitig dieselbe Ansicht auf, wird sie nur einmal gerechnet.
- **Aufräumen:** Einträge, die 7 Tage nicht genutzt wurden, entfernt der Job.
- **„Aktualisieren“:** `clear_dashboard_cache_v1` löscht den Dashboard- **und** den Citations-Cache des Teams. `deleted` ist die Summe der gelöschten Einträge. Regel für die Oberfläche: Cache leeren, dann frisch laden.
- Grenze: Kommt ein Sentiment erst nach dem Run, wird es mit dem nächsten Run übernommen, spätestens nach 6 Stunden oder über „Aktualisieren“.

## 6. Laufzeiten

Gemessen in Prod am 08.10.2026, Team 877c (ms). „Kalt“ heißt: der Cache des Teams war vorher geleert.

| Teil | alt (ohne Cache) | v1 kalt | v1 Cache |
|---|---|---|---|
| Overview 30 Tage | 281–340 (v24) | 441 | 2 |
| Overview 90 Tage | 349–706 (v24) | 1104 | 2 |
| Chart Tag 30 Tage | 11–39 (v16) | 89 | 2 |
| Chart Woche 90 Tage | 8–15 (v16) | 76 | 2 |
| Chart Monat 180 Tage | – | 84 | 2 |
| Responses 30 Tage | 28–380 (v21) | 462 | 4 |
| Responses 90 Tage | 59–396 (v21) | 404 | 3 |
| Top Citations `p_series_limit: 0`, 30 Tage | 2029 (mit Zeitreihe) | 1163 | 6 |
| Top Citations `p_series_limit: 0`, 90 Tage | 5393 (mit Zeitreihe) | 1865 | 17 |

Kalt ist v1 etwas langsamer als die alten RPCs, weil die Kennzahlen zusätzlich mitkommen (gemessen noch mit Sentiment über den ganzen Zeitraum; mit der 30-Tage-Grenze wird es bei langen Zeiträumen schneller). Kalt kommt aber nur noch selten vor, weil ein neuer Run den Eintrag nicht löscht. Der Hintergrund-Job rechnet ihn innerhalb von 5 Minuten neu.

**Gleichheit in Prod geprüft:**

- Overview (30 Tage) ist in allen Feldern aller 11 Marken gleich v24.
- Bei 90 Tagen sind Visibility, Rang, Mentions und Position gleich v24. Sentiment mit der 30-Tage-Grenze ebenfalls gleich v24 (`dashboard_v1_sentiment_30.sql`).
- Chart: Auswahl, Farben, Fensterwerte und alle 210 Tageswerte gleich v16.
- Bei Woche und Monat ist die Summe der Buckets je Marke gleich `mentions` in der Overview.
- Responses: 50 Zeilen in Reihenfolge und `total_count` gleich v21.
- Top Citations: `kpis` und `types` mit `p_series_limit: 0` gleich wie mit 7.

## 7. Sicherheit des Bestands

`rechte_bestand_dashboard.sql` spielst du ein, sobald Bubble umgestellt ist:

- `get_competition_overview_v24` und `get_competition_chart_v16` sind dann nicht mehr direkt aufrufbar, die Wrapper rufen sie weiter auf.
- anon kommt aus den alten `cached_*`- und `clear_*`-RPCs heraus.
- `get_power_dashboard_v1` bekommt einen festen `search_path`.
- Rechte und Einstellungen werden vorher gesichert; der Rückweg stellt sie wieder her.

## 8. Versionsregel

Felder dürfen dazukommen. Umbenennen, Entfernen oder eine geänderte Bedeutung heißt `_v2`; `_v1` läuft weiter.

## 9. Nachtrag 09.10.2026

- Neu für Agentic, Regeln wie die übrigen Dashboard-Funktionen (POST, `p_team` Pflicht, PT429, `meta`):
  - `dashboard_chats_v1(p_team, p_limit = 15 [1–50], p_offset = 0)`: `rows: [{id, title, updated_at}]`, die Chats des angemeldeten Nutzers mit und ohne Projekt, sortiert `is_pinned desc, updated_at desc, id desc`. `meta.total_count` für weitere Seiten.
  - `dashboard_opportunities_v1(p_team)`: alle Opportunities, Zeilen mit genau den Feldern wie bisher aus `get_power_dashboard_v1 → opportunities`, sortiert nach Priorität; dazu `meta.status_counts`.
  - Status-Werte: `Created` (= pending), `In Progress`, `Done`, `Ignored`.
  - Backticks und `${` kommen bei beiden Funktionen nicht mehr vor.
- `cached_dashboard_responses_v1`: `p_limit` jetzt 1–100.
- Chart-Farben richten sich nach `position`, auch mit `p_companies`.
- Rate-Limit: Gleichzeitige Aufrufe blockieren sich nicht mehr gegenseitig. Meldungen und Codes bleiben gleich.
