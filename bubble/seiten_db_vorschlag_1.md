# Fünf Ansichten – Bestandsaufnahme und Vertragsvorschlag v1

Stand 09.10.2026. Nur Bestandsaufnahme und Vorschlag, in der Datenbank wurde nichts geändert. Gebaut wird erst, wenn du (und Claude Code) die Verträge freigebt.
Gemessen direkt in Prod (Projekt kyra.ai) mit Team 877c (Mercedes Benz) und dem Nutzer mit den meisten Mira-Chats (aea6e317…). Die Aufrufe liefen mit `app.warming = on`, also ohne Rate-Limit-Zählung. Die Mittel- und Höchstwerte stammen aus pg_stat_statements (alle echten Aufrufe seit dem letzten Reset).

---

## 0 Kurzfassung

| Ansicht | Neue Funktionen | Wiederverwendet (gibt es schon) | Cache | Langläufer |
|---|---|---|---|---|
| A Performance | `performance_radar_v1`, `performance_company_chart_v1`, `performance_brand_variations_v1` | `cached_citations_urls_v1` (URLs), `dashboard_cache` + `_dash_cached_v1` + `_dash_refresh_v1` + `clear_dashboard_cache_v1` | Radar, Varianten | – |
| B Opportunities | `opportunities_set_status_v1`, `opportunities_own_urls_v1`, `opportunities_create_v1`, `opportunities_search_start_v1`, `opportunities_search_status_v1` | `dashboard_opportunities_v1` (Liste) | – | „Look for new“ als Job, ausgeführt in der Datenbank |
| E Teams | `teams_portfolio_v1` (optional `teams_portfolio_kpis_v1`) | `cached_dashboard_overview_v1` für Kennzahlen, falls gewünscht | – (bewusst, siehe 5.2) | – |
| C Prompt Research | `prompt_research_jobs_v1`, `prompt_research_result_v1`, `prompt_research_decide_v1`, `prompt_research_delete_v1`, `prompt_research_start_v1`, `prompt_research_job_update_v1` (nur n8n) | Märkte und Tags: zentral (Liste von Claude Code) | – | Job, ausgeführt von n8n |
| D Mira | `mira_sessions_v1`, `mira_messages_v1`, `mira_session_update_v1`, `mira_session_delete_v1`, `mira_project_save_v1`, `mira_project_delete_v1`, `mira_turn_status_v1` | `cached_mira_yesterday_top_entities_v1`, `dashboard_chats_v1`, n8n-Funktionen `start/finish/fail_mira_chat_turn` | – | gibt es schon (n8n), neu: private Realtime-Kanäle |

Zusammengelegt werden zwei Gruppen zu je einer Funktion:

- Einzel- und Sammel-Statuswechsel;
- die Session-Aktionen (umbenennen, anpinnen, verschieben).

---

## 1 Gemeinsame Regeln (gleich wie Dashboard v1 und Citations v1)

- Aufruf: `POST /rest/v1/rpc/<name>`, Header `Content-Profile: app`, Body JSON mit benannten Parametern.
- Antwort: immer `jsonb` mit `meta` und `rows`. Zusätzliche Blöcke sind im Vertrag einzeln genannt (z. B. `companies`, `topics`).
- Der Nutzer kommt immer aus dem JWT (`auth.uid()`). Kein v1-Endpunkt nimmt `p_user`.
- Zugriff: `security definer` mit festem `search_path`. `anon` hat keinen Zugriff. Die Teamprüfung läuft über `app.require_team_access`.
- Rate-Limit über `_rl_hit_v1`, ohne exception-Block: Lesen 60 pro Minute, Schreiben 30, Job-Start 5.
- Datumsangaben: Tage nach Europe/Berlin, Standard sind die letzten 30 Tage (heute eingeschlossen), die Vorperiode wird wie im Dashboard v1 berechnet (`_dash_params_v1`). Sentiment wird nie über mehr als 30 Tage gerechnet.
- Fehler (HTTP-Status über PostgREST):

  | Fehler | errcode | Bedeutung |
  |---|---|---|
  | `<bereich>_invalid_param` | 22023 | `hint` nennt Parameter und erlaubte Werte |
  | `<bereich>_team_required` | 22023 | `p_team` fehlt |
  | `<bereich>_not_found` | PT404 | Objekt gehört nicht zum Team oder Nutzer |
  | `<bereich>_rate_limited` | PT429 | `hint` = Sekunden bis zur nächsten Minute |
  | `<bereich>_limit_reached` | PT409 | Planlimit erreicht (nur Prompt Research) |
  | Zugriff verweigert | wie `require_team_access` heute | |

  `<bereich>` ist jeweils `performance`, `opportunities`, `teams`, `prompt_research` oder `mira`.
- Freitext läuft durch `app.js_safe`: Backtick, `${` und Backslash werden entfernt. Echte Zeilenumbrüche bleiben erhalten (im JSON als `\n`).
- Für Bubble bleibt alles bestehen, die neuen Funktionen kommen daneben. Die anon-Rechte der alten Funktionen entziehen wir erst, wenn Bubble sie nicht mehr nutzt (eigene Datei, wie `rechte_bestand_dashboard.sql`).

---

## 2 Bestandsaufnahme: gemessene Funktionen

Die Spalte „anon“ zeigt, ob die Funktion heute ohne Login aufrufbar ist.

| Bubble-Aufruf → Funktion | kalt / warm | Prod Mittel / Max | anon | Befund |
|---|---|---|---|---|
| get topic heatmap → `cached_topic_heatmap_v1` → `get_topic_heatmap_v7` | v7 30 T: 2.336 / 2.295 ms (ohne Cache). Wrapper 90 T: 3.013 / 1 ms | Wrapper: 1.108 / 8.484 ms | nein | Sentiment über den ganzen Zeitraum (verstößt gegen die 30-Tage-Regel). Standard 7 Tage nach `current_date` (UTC). `p_metric` wird nur geprüft und zurückgegeben, rechnet nichts. `p_domain` filtert auf Läufe, in denen die Domain zitiert wurde. |
| get company detailed chart → `get_company_detailed_chart_v4` | 15 / 5 ms (30 T Tag), 56 ms (90 T Woche) | 8 / 70 ms | **ja** | Tage ohne Läufe liefern 0 statt null; beim Rang heißt 0 „besser als Platz 1“. Prüft nur Teammitgliedschaft. |
| Markenvarianten → `get_company_brand_name_variations_v2` | 3.984 / 61 ms | 142 / 7.311 ms | **ja** | Schneidet still bei 100 Zeilen ab, `total_count` sagt aber 390. `mentioned_runs` und `mentioned_count` waren in allen Stichproben gleich. Nutzt das alte `check_rate_limit`. |
| get citation urls → `cached_citation_urls_v2` | – | 359 / 14.396 ms | – | Wird durch `cached_citations_urls_v1` ersetzt (gemessen 637 / 9 ms mit Tag + Marke). |
| list source recommendations → `cached_list_source_recommendations_v1` | 28 / 1 ms | 10 / 30 ms | nein | Gleiche Felder wie `dashboard_opportunities_v1` (7 ms). |
| update status (+ bulk) → `update_source_recommendation_status_v1` / `_bulk_v1` | – | 4 / 118 ms und 7 / 45 ms | **ja** | Status `Created`, `In Progress`, `Ignored`, `Done`. |
| get you urls → `get_you_urls_v1` | 906 / 97 ms | 199 / 845 ms | **ja** | 69 URLs für 877c, ohne Limit. |
| Create with AI → `create_mira_source_recommendation_v3` | – | 3.435 / 4.899 ms (v1: max 31 s) | nein | Nimmt `p_user` und setzt die JWT-Claims selbst. Liefert JSON als Text. |
| Look for new → `build_source_recommendations_v11` | – | 5.355 / 23.235 ms (v10: max 59.696 ms) | – | Synchron, nah an der 30-s-Grenze der Rolle `authenticated`. |
| Teams → `cached_get_team_portfolio_overview_v4` → `get_team_portfolio_overview_v4` | 13 / 4 ms | 10 / 32 ms | **ja** | Der Wrapper hat keinen Cache, er reicht nur durch. v4 hat keinen `search_path`, prüft aber die Mitgliedschaft (`forbidden`). Fünf Filter sind wirkungslos. Ohne Angabe wird das erste Team angeheftet. Der alte `cached_…_v3` mit Kennzahlen: 2.289 / 1 ms, Mittel 2.295 ms, Maximum 17.720 ms. Details in 5.1. |
| Prompt Research Liste → `list_prompt_research_jobs_v1` | 17 ms | 10 / 84 ms | **ja** | Nur erfolgreiche Jobs; laufende sind nicht sichtbar. |
| Prompt Research Ergebnis → `get_prompt_research_result_v1` | 16 ms | 7 / 64 ms | **ja** | |
| annehmen/ignorieren → `manage_suggested_prompts_v1` | – | 14 / 99 ms | – | **Fängt Fehler ab** (`exception when … raise warning`), das ist das pldbgapi2-Risiko (XX000). Payload ist Text, aus dem UUIDs herausgesucht werden. |
| löschen → `delete_prompt_research_job_v1` | – | – | – | Löscht Job, Vorschläge und Tags endgültig. |
| Märkte / Tags → `get_markets_v2` / `get_tags_v2` | 3 ms / 3 ms | – | ja / nein | Laut dir zentral vorhanden, siehe offene Frage 10. |
| Mira Sessions → `cached_mira_chat_sessions_v1` → `get_mira_chat_sessions_v3` | 22 ms | 4 / 65 ms | nein | Das Limit gilt nur für Chats ohne Projekt, Projekt-Chats kommen immer alle mit (Limit 3 ergab 4 Zeilen). |
| Mira Nachrichten → `get_mira_chat_messages_v2` | 32 ms | 17 / 230 ms | nein | `created_at` als Text ohne `T`. Im `content` stehen Zeilenumbrüche als zwei Zeichen `\` und `n` (tpl_escape). |
| Mira gestern → `cached_mira_yesterday_top_entities_v1` | 2 / 0 ms | – | nein | Kann bleiben. |

Weitere Befunde:

- **Prompt-Research-Jobs:**
  - 92 Jobs stehen auf `running`, alle älter als 1 Stunde; der jüngste ist vom 07.10. Dem stehen 30 Jobs mit `success` gegenüber.
  - Eine erfolgreiche Recherche dauert im Median 16,7 s, höchstens 75,4 s.
  - Keine Datenbankfunktion legt Jobs an oder setzt ihren Status. Das macht n8n direkt in der Tabelle (Rechte für service_role), im Beispiel mit `created_by = null`.
  - Wenn n8n abbricht, setzt niemand `failed`.
- **Mira-Antwortzeit:** Median 44,6 s, p95 119,9 s. Daraus folgt: das Senden bleibt asynchron über n8n. `start_mira_chat_turn_v1` legt Nachrichten mit `queued`/`running` an, darauf kann ein Status-Abruf aufbauen.
- **Realtime:**
  - `mira_emit_progress` sendet öffentlich an `mira_chat_<session>` und `mira_user_<uid>`.
  - Nutzer-IDs stehen in API-Antworten (z. B. `created_by` bei Opportunities). Jeder mit dem anon-Key, der eine solche ID kennt, kann diesen Kanal mithören.
  - Auf `realtime.messages` gibt es nur die Onboarding-Policy.
- **Technische Ausgangslage:**
  - `pg_net` ist nicht installiert. Verfügbar sind pg_cron 1.6.4 (Sekunden-Takt möglich) und supabase_vault.
  - Es gibt keine `net.http_post`-Aufrufe in `app`.
  - Bestehende Job-Tabellen: `prompt_research_job`, `scrape_job`, `prompt_model_run_job`, `citation_type_job`.
- **Aktives Team:** steht in `user_settings.last_team_id`. Geschrieben wird es heute nebenbei von `get_team_brand_header_v9` (15.233 Aufrufe). Beim Testnutzer zeigt es auf Parookaville (e7755829…).

---

## 3 A Performance (Radar + Detail)

### 3.1 `performance_radar_v1` – Heatmap Marken × Topics (mit Cache)

Ersetzt `cached_topic_heatmap_v1` → `get_topic_heatmap_v7`. Die Rechnung wird aus v7 kopiert (`_perf_radar_calc_v1`), mit diesen Änderungen:

1. Sentiment wird höchstens über die letzten 30 Tage gerechnet, die Vorperiode ebenso (gleiche Regel wie Dashboard v1, sichtbar in `meta.sentiment_from` und `meta.sentiment_prev_from`).
2. Tage nach Europe/Berlin, Standard 30 Tage.
3. Kein `p_metric`: Jede Zelle hat schon `heat_value_visibility`, `heat_value_rank` und `heat_value_sentiment`, das Frontend schaltet nur um. Ein Umschalten kostet damit keinen neuen Aufruf.
4. Cache über `app.dashboard_cache` und `_dash_cached_v1` mit eigenem `calc`. Damit gelten automatisch Versionierung, Stale-while-revalidate (6 h frisch, 2 h stale), der Cron-Refresh `_dash_refresh_v1` und `clear_dashboard_cache_v1`.

| Parameter | Typ | Standard | Regeln |
|---|---|---|---|
| p_team | uuid | – | Pflicht |
| p_date_from / p_date_to | date | heute − 29 / heute (Berlin) | von ≤ bis, höchstens 366 Tage |
| p_models | text[] | alle | |
| p_markets | text[] | alle | alpha2 |
| p_tag_ids | uuid[] | alle | Rahmen (welche Prompts zählen) |
| p_tagmode | text | `or` | `or` oder `and` |
| p_companies | uuid[] | Top nach Sichtbarkeit | Auswahl der Zeilen |
| p_topics | uuid[] | Top nach Anteil | Auswahl der Spalten |
| p_company_limit / p_topic_limit | int | 10 / 10 | 1–25 |
| p_domain | text | – | nur Läufe, in denen diese Domain zitiert wurde (Citations-Detail) |

Antwort (echte Werte, 877c, 30 Tage, 12 × 12, gekürzt):

```json
{
  "meta": {
    "team_id": "877c649c-…", "date_from": "2026-09-10", "date_to": "2026-10-09",
    "prev_from": "…", "prev_to": "…", "sentiment_from": "2026-09-10", "sentiment_prev_from": "…",
    "timezone": "Europe/Berlin",
    "selection": {"company_limit": 12, "topic_limit": 12, "total_company_count": 11, "total_topic_count": 13,
                  "selected_company_count": 11, "selected_topic_count": 12},
    "ranges": {"visibility_min": 0.00, "visibility_max": 93.37, "rank_min": 3.31, "rank_max": 14.93,
               "sentiment_min": 55.58, "sentiment_max": 86.62},
    "filters": {"models": [], "markets": [], "tag_ids": [], "tagmode": "or", "domain": null},
    "generated_at": "2026-10-09T09:31:02Z", "cached": true, "stale": false
  },
  "rows": [
    {"company_id": "666761a9-…", "company_name": "VW", "role": "competitor", "company_position": 1,
     "topic_id": "8daee9bb-…", "topic_name": "SUV", "topic_position": 1, "topic_hex_light": "#6d28d9", "topic_hex_dark": "#6d28d9",
     "visibility_pct": 40.68, "visibility_prev_pct": 41.78, "visibility_delta_pct": -1.10,
     "avg_rank": 4.64, "avg_rank_prev": 4.50, "avg_rank_delta": 0.14,
     "sentiment": 75.44, "sentiment_prev": 72.87, "sentiment_delta": 2.57,
     "mentions": 975, "mentions_prev": 460,
     "total_runs_topic_company_now": 2397, "total_runs_topic_company_prev": 1101,
     "heat_value_visibility": 0.4357, "heat_value_rank": 0.8855, "heat_value_sentiment": 0.6398,
     "logo_url": "https://www.google.com/s2/favicons?domain=volkswagen.de&sz=64"}
  ],
  "companies": [
    {"company_id": "666761a9-…", "name": "VW", "role": "competitor", "position": 1, "is_selected": true, "selected_position": 1,
     "visibility_pct": 42.63, "visibility_delta_pct": -0.90, "avg_rank": 5.10, "sentiment": 74.58, "mentions": 10261, "logo_url": "…"}
  ],
  "topics": [
    {"topic_id": "8daee9bb-…", "name": "SUV", "position": 1, "is_selected": true, "selected_position": 1,
     "topic_share_pct": 28.65, "topic_share_prev_pct": 28.60, "topic_share_delta_pct": 0.05, "hex_light": "#6d28d9", "hex_dark": "#6d28d9"}
  ],
  "available_companies": [ "… höchstens 50, gleiche Felder ohne Kennzahlen" ],
  "available_topics": [ "… höchstens 50" ]
}
```

Die Zellenfelder stammen 1:1 aus v7. Das Beispiel für `companies` ist der echte 90-Tage-Wert (der Lauf lief mit 90 Tagen); beim Bau wird es durch den 30-Tage-Wert ersetzt.

Zeiten: kalt rund 2,3–3,0 s, aus dem Cache 1 ms. Fehler: `performance_invalid_param`, `performance_team_required`, `performance_rate_limited`.

### 3.2 `performance_company_chart_v1` – Verlauf einer Marke (ohne Cache)

Ersetzt `get_company_detailed_chart_v4`. Ein Cache lohnt sich nicht (Mittel 8 ms, Maximum 70 ms).

| Parameter | Typ | Standard | Regeln |
|---|---|---|---|
| p_team | uuid | – | Pflicht |
| p_company | uuid | – | Pflicht, muss zum Team gehören, sonst `performance_not_found` |
| p_mode | text | `visibility` | `visibility`, `rank` oder `sentiment` |
| p_granularity | text | `day` | `day`, `week` (Montag) oder `month` |
| p_date_from / p_date_to | date | letzte 30 Tage | wie 3.1 |
| p_models, p_markets, p_tag_ids, p_tagmode | | | wie 3.1 |

Änderung gegenüber v4: Tage ohne Läufe liefern `null` statt 0 (deine Entscheidung beim Dashboard). Beim Rang wäre 0 falsch.

```json
{
  "meta": {"team_id": "877c…", "company_id": "87468f49-…", "mode": "visibility", "granularity": "day",
           "date_from": "2026-09-10", "date_to": "2026-10-09", "timezone": "Europe/Berlin", "points": 30,
           "filters": {"models": [], "markets": [], "tag_ids": [], "tagmode": "or"},
           "generated_at": "…", "cached": false, "stale": false},
  "rows": [
    {"day": "2026-09-10", "value": 28.42},
    {"day": "2026-09-11", "value": 30.00},
    {"day": "2026-09-12", "value": 29.09}
  ]
}
```

Weitere echte Werte:

- `sentiment`, Woche, 90 Tage: 14 Punkte, beginnend mit 2026-07-06 = 75.98 und 2026-07-13 = 75.47.
- `rank`, Tag, Tag SUV: 5.96, 5.18, 7.53.

### 3.3 `performance_brand_variations_v1` – Namensvarianten einer Marke (mit Cache)

Ersetzt `get_company_brand_name_variations_v2`. Mit Cache, weil kalt bis zu 4–7 s. Änderungen gegenüber v2:

- echtes Paging statt still bei 100 Zeilen abzuschneiden;
- Summen stehen in `meta` statt in jeder Zeile.

| Parameter | Typ | Standard | Regeln |
|---|---|---|---|
| p_team, p_company | uuid | – | Pflicht, Marke muss zum Team gehören |
| p_date_from / p_date_to, p_models, p_markets, p_tag_ids, p_tagmode | | | wie 3.1 |
| p_limit / p_offset | int | 25 / 0 | 1–100 / ≥ 0 |

```json
{
  "meta": {"team_id": "877c…", "company_id": "87468f49-…", "total_count": 390, "mentions_total": 3282,
           "limit": 25, "offset": 0, "order": "mentioned_count_desc,name_asc", "date_from": "2026-09-10", "date_to": "2026-10-09",
           "generated_at": "…", "cached": true, "stale": false},
  "rows": [
    {"name": "Mercedes-Benz", "mentioned_count": 568, "mentioned_runs": 568, "share_of_voice_pct": 17.31},
    {"name": "Mercedes", "mentioned_count": 171, "mentioned_runs": 171, "share_of_voice_pct": 5.21},
    {"name": "Mercedes E-Klasse T-Modell", "mentioned_count": 152, "mentioned_runs": 152, "share_of_voice_pct": 4.63}
  ]
}
```

`share_of_voice_pct` = `mentioned_count` / `mentions_total` × 100, gleich wie in v2.

### 3.4 URLs im Detail: keine neue Funktion

`cached_citations_urls_v1` kann bereits alles, was gebraucht wird: `p_tag_ids` und `p_mentioned_brands`. Getestet mit 877c, 30 Tagen, Tag SUV und der eigenen Marke: 1.875 Treffer, kalt 637 ms, warm 9 ms. Erste Zeile:

```json
{"url": "https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/auto/suv-kaufberatung-2026",
 "domain": "adac.de", "title": "SUV-Modelle im Vergleich: Welche sind die besten? Was ist zu beachten?",
 "citation_type": "Institutional", "url_type": "comparison", "runs_with_url": 414,
 "global_share_pct": 17.97, "share_prev_pct": 20.44, "share_delta_pct": -2.47, "domainshare_pct": 41.65,
 "is_mentioned": true, "mentions_total": 11,
 "mentions": [{"company_id": "87468f49-…", "name": "Mercedes Benz", "role": "own", "logo_url": "…"}, {"name": "Audi", "role": "competitor", "…": "…"}]}
```

### 3.5 Cache leeren

Es gibt keine neue Clear-Funktion. `clear_dashboard_cache_v1(p_team)` leert alles in `dashboard_cache` für das Team, also auch Radar und Varianten. Der Citations-Cache wird dort ebenfalls schon geleert.

---

## 4 B Opportunities

### 4.1 Liste: `dashboard_opportunities_v1` wiederverwenden

Die Funktion gibt es schon (alle Status, `meta.status_counts`, gleiche Felder wie `list_source_recommendations_v3`), sie läuft in 7 ms. 877c hat 15 Einträge, davon 14 `Created` und 1 `In Progress`. „Look for new“ hält höchstens 10 aktive Karten. Filter wie Status oder Topic kann das Frontend lokal setzen. Eine eigene `opportunities_list_v1` mit Server-Filtern baue ich nur, wenn du das willst (offene Frage 3).

### 4.2 `opportunities_set_status_v1` – einzeln und gesammelt

Ersetzt `update_source_recommendation_status_v1` und `_bulk_v1`.

| Parameter | Typ | Regeln |
|---|---|---|
| p_team | uuid | Pflicht |
| p_ids | uuid[] | 1–100 Einträge, alle müssen zum Team gehören, sonst `opportunities_not_found` (dann wird nichts geändert) |
| p_status | text | `Created`, `In Progress`, `Ignored` oder `Done` |

```json
{
  "meta": {"team_id": "877c…", "new_status": "Done", "changed": 1, "unchanged": 0,
           "status_counts": {"created_count": 13, "in_progress_count": 1, "ignored_count": 0, "done_count": 1, "active_count": 14},
           "generated_at": "…"},
  "rows": [{"id": "519100ab-…", "old_status": "Created", "new_status": "Done", "changed": true, "updated_at": "…"}]
}
```

Das Beispiel ist erfunden, weil es eine Schreibaktion ist; die Zahlen entsprechen dem Stand 14/1. Beim Bau teste ich in einer Transaktion mit Rollback.

### 4.3 `opportunities_own_urls_v1` – eigene URLs für „Create with AI“

Ersetzt `get_you_urls_v1`. Gleiche Quelle (eigene Domain, letzte 14 Tage), dazu Limit und Suche.

| Parameter | Typ | Standard | Regeln |
|---|---|---|---|
| p_team | uuid | – | Pflicht |
| p_search | text | – | Teil der URL oder des Titels, höchstens 200 Zeichen |
| p_limit / p_offset | int | 50 / 0 | 1–200 / ≥ 0 |

```json
{"meta": {"team_id": "877c…", "total_count": 69, "limit": 50, "offset": 0, "days": 14, "generated_at": "…"},
 "rows": [
   {"url": "https://www.mercedes-benz.de/passengercars/services/warranty.html", "title": "Service- und Garantie-Pakete | Mercedes-Benz", "favicon": "https://www.google.com/s2/favicons?domain=mercedes-benz.de&sz=128"},
   {"url": "https://www.mbusa.com/en/owners/service-maintenance/prepaid", "title": "Prepaid Maintenance | Mercedes-Benz USA", "favicon": "…"},
   {"url": "https://www.mbusa.com/en/financial-services/protection-plans/premier-prepaid-maintenance", "title": "Mercedes-Benz Premier Prepaid Maintenance | Mercedes-Benz USA", "favicon": "…"}
 ]}
```

Zeit: kalt 0,9 s, warm 0,1 s. Kein Cache.

### 4.4 `opportunities_create_v1` – Karte aus einer URL anlegen

Hülle um `create_mira_source_recommendation_v3`. Der Nutzer kommt aus dem JWT, die Antwort ist echtes JSON statt Text. Läuft synchron (Mittel 3,4 s, Maximum 4,9 s).

| Parameter | Typ | Regeln |
|---|---|---|
| p_team | uuid | Pflicht |
| p_lead_url | text | Pflicht, http/https, höchstens 2.000 Zeichen |
| p_title, p_reason | text | optional, höchstens 300 bzw. 2.000 Zeichen |
| p_tag_ids, p_tagmode, p_models, p_markets, p_date_from, p_date_to | | wie v3 |

Antwort: `meta.status` ist `Created` oder `AlreadyExists`; `rows` enthält genau eine Karte mit den Feldern aus `dashboard_opportunities_v1`.

### 4.5 „Look for new“ als Job

Siehe Abschnitt 8. Der Ablauf:

1. `opportunities_search_start_v1(p_team)` legt einen Job an und antwortet sofort mit `job_id`. Pro Team läuft höchstens ein Job; ein zweiter Klick bekommt den laufenden zurück (`meta.reused = true`).
2. Ein Worker in der Datenbank (pg_cron alle 5 s) ruft `build_source_recommendations_v11` mit dem Nutzer des Jobs auf.
3. `opportunities_search_status_v1(p_team, p_job_id)` liefert den Stand. Ist der Job fertig, enthält `rows` die neuen Karten.

---

## 5 E Teams

### 5.1 Bestand: `cached_get_team_portfolio_overview_v4` → `get_team_portfolio_overview_v4`

- **Wrapper ohne Cache:** `cached_get_team_portfolio_overview_v4` reicht den Aufruf nur an v4 durch (LANGUAGE sql, ein `select *`). In Prod 119 Aufrufe, Mittel 10 ms, Maximum 32 ms; gemessen 13 ms kalt, 4 ms warm.
- **Zwei Arten von Cache:**
  - Der alte Wrapper `cached_get_team_portfolio_overview_v3` hat einen echten Cache: `rpc_cache`, 6 h, Schlüssel ohne Datenversion.
  - Die Kennzahlen Sichtbarkeit, Rang und Sentiment kommen aus v3 (91 Aufrufe, Mittel 2,3 s, Maximum 17,7 s). Laut Kommentar im Code wurden sie in v4 entfernt.
  - Weil der Cache keine Datenversion kennt, sind Prompt- und Konkurrenten-Zahlen in v3 bis zu 6 h alt.
- **Rechte und Prüfung:**
  - v4 hat keinen `search_path`, und anon darf beide Funktionen ausführen.
  - Ohne Login bricht v4 mit `not authenticated` ab.
  - v4 prüft, ob alle `p_team_ids` Teams des Nutzers sind; sonst bricht es mit `forbidden` ab.
- **Wirkungslose Parameter:** `p_tag_ids`, `p_models`, `p_markets`, `p_prompt_id`, `p_tagmode` und das Datum (bis auf die Prüfung von < bis) verändern das Ergebnis nicht. Getestet mit Tag SUV und 400 Tagen: gleiche Zeilen.
- **Ungewolltes Anheften:** v4 heftet ohne Angabe still das erste Team aus `p_team_ids` an (`coalesce(p_pinned_team_id, p_active_team_id, p_team_ids[1])`). Ohne Parameter steht so Mercedes Benz oben, obwohl nach `created_at_desc` sortiert wird. Angeheftet wird nur, wenn keine Suche aktiv ist.
- **Bestätigte Sortierung:**
  - `visibility_desc` und `visibility_asc` werden angenommen, fallen aber auf `created_at_desc` zurück.
  - `total_count` zählt die Treffer nach der Suche: Suche „de“ ergibt 6 von 11.

### 5.2 `teams_portfolio_v1` – Teams-Tabelle (ohne Cache)

Ersetzt `cached_get_team_portfolio_overview_v4` und v4. Die Teams kommen aus der Mitgliedschaft des Nutzers (`auth.uid()`), es gibt also kein `p_team_ids` mehr. Die wirkungslosen Filter fallen weg.

| Parameter | Typ | Standard | Regeln |
|---|---|---|---|
| p_search | text | – | Teil von Name oder Domain, höchstens 200 Zeichen |
| p_pinned_team_id | uuid | – | muss ein Team des Nutzers sein, sonst `teams_not_found`. Steht ganz oben, solange keine Suche aktiv ist. **Ohne Angabe wird nichts angeheftet** (anders als v4). |
| p_limit / p_offset | int | 24 / 0 | 1–100 / ≥ 0 |
| p_order | text | `created_at_desc` | `created_at_desc` oder `created_at_asc` |

Die Felder sind dieselben wie in v4. Neu ist `is_pinned`, und `total_count` steht in `meta` statt in jeder Zeile.

Echte Werte mit `p_pinned_team_id` = 877c und `p_limit` 3; Reihenfolge laut Prod: Mercedes Benz, CloudNine, Der Sanitätscoach:

```json
{"meta": {"total_count": 11, "pinned_team_id": "877c649c-…", "search": null, "limit": 3, "offset": 0, "order": "created_at_desc",
          "generated_at": "…", "cached": false, "stale": false},
 "rows": [
   {"team_id": "877c649c-…", "team_name": "Mercedes Benz", "domain": "mercedes-benz.de", "logo_url": "//…cdn.bubble.io/…png",
    "created_at": "2026-01-20T10:43:39.93472+00:00", "is_pinned": true,
    "billing_plan": "Legacy Free", "active_billing_plan": "yes",
    "prompts_active": 102, "prompts_limit": 150, "prompts_remaining": 48,
    "competitors_tracked": 10, "competitors_limit": 10, "competitors_remaining": 0},
   {"team_id": "e6037cb1-…", "team_name": "CloudNine", "domain": "go-cloud-nine.de", "logo_url": "https://www.google.com/s2/favicons?domain=go-cloud-nine.de&sz=64",
    "created_at": "2026-10-08T11:12:30.482934+00:00", "is_pinned": false, "billing_plan": "Professional", "active_billing_plan": "yes",
    "prompts_active": 14, "prompts_limit": 150, "prompts_remaining": 136, "competitors_tracked": 10, "competitors_limit": 10, "competitors_remaining": 0},
   {"team_id": "f95f59c3-…", "team_name": "Der Sanitätscoach", "domain": "sanitaetscoach.de", "logo_url": "https://www.google.com/s2/favicons?domain=sanitaetscoach.de&sz=64",
    "created_at": "2026-07-09T11:00:28.777259+00:00", "is_pinned": false, "billing_plan": "Professional", "active_billing_plan": "yes",
    "prompts_active": 32, "prompts_limit": 150, "prompts_remaining": 118, "competitors_tracked": 7, "competitors_limit": 10, "competitors_remaining": 3}
 ]}
```

**Cache:** keiner, und das mit Absicht. Die Abfrage braucht 4–32 ms. Ein Cache würde die Zählerstände (`prompts_remaining` nach dem Annehmen von Prompts) bis zur Ablaufzeit falsch anzeigen, wie heute bei v3. Damit entfällt auch eine Clear-Funktion.

Kommen die Kennzahlen zurück (offene Frage 9), schlage ich eine zweite Funktion `teams_portfolio_kpis_v1(p_team_ids uuid[] [1–24])` vor. Sie liest Sichtbarkeit, Rang und Sentiment je Team aus `dashboard_cache` (über `cached_dashboard_overview_v1`, gleiche Zahlen wie im Dashboard, Sentiment höchstens 30 Tage). Das Frontend lädt sie nach der Tabelle für die sichtbare Seite. So bremst die langsame Rechnung (2–3 s je Team, kalt) die Tabelle nicht aus.

Fehler: `teams_invalid_param`, `teams_not_found`, `teams_rate_limited`.

---

## 6 C Prompt Research

### 6.1 `prompt_research_jobs_v1(p_team, p_limit 5 [1–20])`

Wie `list_prompt_research_jobs_v1`: die letzten erfolgreichen Jobs mit offenen Vorschlägen. Neu kommen dazu:

- laufende und fehlgeschlagene Jobs der letzten 24 h, damit das Frontend nach einem Neuladen den Fortschritt wieder anzeigen kann;
- die Felder `step`, `progress` und `status_message`.

```json
{"meta": {"team_id": "877c…", "running_count": 0, "limit": 5, "generated_at": "…"},
 "rows": [
   {"job_id": "46aeee80-…", "status": "success", "step": null, "progress": 100, "status_message": null,
    "keywords": "Automatikgetriebe", "market": "DE", "market_name": "Germany", "market_alpha2": "DE", "market_alpha3": "DEU",
    "flag_url": "https://flagcdn.com/de.svg", "business_model": "b2c", "persona": null, "prompt_count": 11,
    "created_at": "2026-08-29T16:03:28.861552+00:00", "started_at": "2026-08-29T16:03:28.825+00:00", "finished_at": "2026-08-29T16:03:41.439+00:00"},
   {"job_id": "e277d836-…", "status": "success", "keywords": "Luxury, Sedans", "prompt_count": 19, "…": "…"},
   {"job_id": "5c50d309-…", "status": "success", "keywords": "Safety", "prompt_count": 20, "…": "…"}
 ]}
```

### 6.2 `prompt_research_result_v1(p_team, p_job_id)`

Wie `get_prompt_research_result_v1`: `meta` = Job, `rows` = Vorschläge.

```json
{"meta": {"job_id": "46aeee80-…", "status": "success", "keywords": "Automatikgetriebe", "market": "DE", "business_model": "b2c", "prompt_count": 11, "…": "…"},
 "rows": [
   {"id": "aecf95e2-…", "prompt_text": "Automatikgetriebe Probleme und welche Marken am wenigsten Ärger machen", "estimated_volume": 65,
    "market": "DE", "prompt_focus": null, "created_at": "2026-08-29T16:03:40.770757+00:00",
    "tags": [{"tag_id": "597a287b-…", "name": "Automatikgetriebe", "emoji": null, "hex_light": "#9145e8", "hex_dark": "#9145e8"}]},
   {"id": "9ac2b68a-…", "prompt_text": "welche Automatikautos haben die geringsten Wartungskosten?", "estimated_volume": 65, "…": "…"},
   {"id": "c20ff183-…", "prompt_text": "beste Gebrauchtwagen mit Automatikgetriebe und niedrigem Verbrauch", "estimated_volume": 80, "…": "…"}
 ]}
```

Fehler: `prompt_research_not_found`.

### 6.3 `prompt_research_decide_v1(p_team, p_action, p_ids)`

Ersetzt `manage_suggested_prompts_v1`. Gleiche Logik (Planlimit, Prompt mit Schedule anlegen, höchstens 5 Tags, Insights-Cache leeren), aber:

- `p_ids` ist ein echtes `uuid[]` (1–50) statt Text;
- es gibt keinen exception-Block mehr.

| Parameter | Regeln |
|---|---|
| p_action | `accept` oder `ignore` |
| p_ids | Vorschläge des Teams, offen |

```json
{"meta": {"action": "accept", "accepted": 3, "ignored": 0, "skipped": 0,
          "prompts_active": 105, "prompts_limit": 150, "prompts_remaining": 45},
 "rows": [{"suggestion_id": "aecf95e2-…", "prompt_id": "…", "result": "accepted"}]}
```

Reicht das Limit nicht, kommt `prompt_research_limit_reached` (PT409); `hint` nennt die Zahl der freien Plätze, und es wird nichts angelegt.

### 6.4 `prompt_research_delete_v1(p_team, p_job_id)`

Gleiches Verhalten wie heute: Job, Vorschläge und Tags werden endgültig gelöscht. Alternative ist ein weiches Löschen (offene Frage 6).

### 6.5 Start und Fortschritt (Job, ausgeführt von n8n)

1. `prompt_research_start_v1(p_team, p_keywords text[] [1–10], p_market text, p_business_model 'b2b'|'b2c', p_persona text)`:
   - prüft vorher das Planlimit und dass höchstens ein Job pro Team läuft;
   - legt den Job mit `queued` und `created_by = auth.uid()` an;
   - antwortet mit `{"meta": {"job_id": "…", "status": "queued", "reused": false}, "rows": []}`.
2. Eine Next.js-Server-Route (das Secret bleibt auf dem Server) ruft den n8n-Webhook mit `job_id` auf. In der Datenbank gibt es kein `pg_net`, darum kann sie n8n nicht selbst anstoßen.
3. n8n meldet den Stand über `prompt_research_job_update_v1(p_job_id, p_status, p_step, p_progress, p_message, p_error)`. Die Funktion ist nur für service_role und prüft erlaubte Übergänge: `queued → running → success|failed`. Die Vorschläge schreibt n8n weiter mit `insert_suggested_prompts_with_tags_v2`.
4. Das Frontend fragt `prompt_research_jobs_v1` ab oder hört auf den Realtime-Kanal (Abschnitt 9).
5. Der Aufräumer im Worker (Abschnitt 8) setzt Jobs, die über 10 min auf `queued` oder `running` stehen, auf `failed` mit `error.code = 'timeout'`. Für die 92 alten Hänger gebe ich dir eine eigene Datei. Sie setzt nur den Status um und löscht nichts.

### 6.6 Märkte und Tags

Hier baue ich nichts, solange Claude Code bestätigt, dass zentrale Funktionen dafür existieren (offene Frage 10). Echte Werte für 877c: 2 Märkte (DE 79 Prompts, US 23); Tags z. B. Automatikgetriebe (6), Komfort (2), Luxury (18).

---

## 7 D Mira

### 7.1 `mira_sessions_v1(p_team, p_limit 50 [1–200], p_offset 0)`

Wie `get_mira_chat_sessions_v3`, aber ohne `p_user`. Das Limit gilt weiter nur für Chats ohne Projekt; Projekt-Chats kommen vollständig in `projects[].sessions` (heute stehen sie gemischt in `sessions`).

```json
{"meta": {"team_id": "877c…", "limit": 3, "offset": 0, "has_more": true, "next_offset": 3, "generated_at": "…"},
 "rows": [
   {"id": "3a7d7f7c-…", "title": "Python Skript für Email Sortierung", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-09-23T12:58:00.730424+00:00"},
   {"id": "0fd13317-…", "title": "Begrüßung", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-09-23T09:35:35.631696+00:00"},
   {"id": "531eedb7-…", "title": "Aktive Aufgaben auflisten", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-09-22T08:30:31.07256+00:00"}
 ],
 "projects": [
   {"id": "6736898a-…", "title": "Project 1", "status": "active", "updated_at": "2026-07-01T11:04:36.780247+00:00", "session_count": 1,
    "sessions": [{"id": "902c0b1e-…", "title": "KI-Sichtbarkeitsreport 30 Tage", "is_pinned": false, "updated_at": "2026-07-01T13:47:44.821819+00:00"}]}
 ]}
```

Die kurze Chatliste im Dashboard bleibt `dashboard_chats_v1`.

### 7.2 `mira_messages_v1(p_team, p_session_id, p_limit 50 [1–200], p_before_id uuid)`

Felder wie `get_mira_chat_messages_v2`, mit diesen Änderungen:

- `created_at` als ISO-Zeit;
- `content` mit echten Zeilenumbrüchen statt der Zeichen `\` und `n` (heute kommt es aus tpl_escape);
- Paging nach hinten über `p_before_id`;
- aufsteigend sortiert.

Die Session muss dem Nutzer gehören, sonst `mira_not_found`.

```json
{"meta": {"session_id": "3a7d7f7c-…", "limit": 50, "has_more": false, "generated_at": "…"},
 "rows": [
   {"id": "619665f7-…", "role": "user", "status": "success", "created_at": "2026-09-23T12:57:54.269722+00:00", "latency_ms": 0,
    "content": "Ich würde wirklich gerne einen Visiblity Report erstellen, …", "content_html": "",
    "evidence": [], "evidence_items": [], "opportunities": [], "actions": []},
   {"id": "18832857-…", "role": "assistant", "status": "success", "created_at": "2026-09-23T12:57:54.270722+00:00", "latency_ms": 6503,
    "content": "Gerne würde ich dir helfen – …\nLass uns direkt weitermachen mit dem Visibility Report – …",
    "content_html": "<p>Gerne würde ich dir helfen – …</p><p><strong>Lass uns direkt weitermachen …</strong></p><ul><li>…</li></ul>",
    "evidence": [], "evidence_items": [], "opportunities": [], "actions": []}
 ]}
```

### 7.3 Schreibaktionen der Oberfläche (zusammengefasst)

| Funktion | Ersetzt | Parameter |
|---|---|---|
| `mira_session_update_v1` | umbenennen, anpinnen, verschieben | p_team, p_session_id, p_title (optional), p_is_pinned (optional), p_project_id (optional), p_clear_project bool |
| `mira_session_delete_v1` | `delete_mira_chat_session_v1` | p_team, p_session_id. Setzt `status = 'deleted'` wie heute (kein echtes Löschen). |
| `mira_project_save_v1` | Projekt anlegen und umbenennen | p_team, p_project_id (null = neu), p_title |
| `mira_project_delete_v1` | Projekt löschen | p_team, p_project_id. Chats bleiben ohne Projekt erhalten (wie heute, prüfe ich beim Bau). |

Alle antworten mit `meta` und der geänderten Zeile in `rows`.

### 7.4 Senden, Sprache, PDF (n8n bleibt Ausführer)

- **Senden:**
  - Die Next.js-Server-Route ruft den n8n-Webhook wie Bubble heute auf. n8n ruft weiter `start_mira_chat_turn_v1`, `finish_mira_chat_turn_v2` und `fail_mira_chat_turn_from_error_v1` auf; dort ändert sich nichts.
  - Die Antwort dauert im Median 45 s, im p95 120 s. Darum kein synchroner Datenbankaufruf.
  - Neu ist `mira_turn_status_v1(p_team, p_session_id)`. Sie liefert die letzte Nachricht mit `queued`/`running`/`success`/`error`, als Ersatz falls Realtime ausfällt (Abfrage alle 3 s).
- **Sprache und PDF:** Ablauf wie beim Senden. Die Workflow-Namen fehlen mir noch (offene Frage 7).
- **Mira-Einstellungen:** liegen heute nicht in der Datenbank (offene Frage 8).
- **Gestern-Kennzahlen:** `cached_mira_yesterday_top_entities_v1` bleibt (2 ms, nicht anon).

---

## 8 Gemeinsames Job-Muster

Neue Tabelle `app.view_job` für Jobs, die die Datenbank selbst ausführt (zunächst nur „Look for new“). Prompt Research behält die eigene Tabelle, bekommt aber dieselbe Statuslogik.

```
app.view_job (
  id uuid pk default gen_random_uuid(), team_id uuid not null, created_by uuid not null,
  kind text not null,                -- 'opportunities_search'
  status text not null default 'queued',  -- queued | running | success | failed
  step text, progress smallint default 0, status_message text,
  params jsonb, result jsonb, error jsonb,
  created_at timestamptz default now(), started_at timestamptz, finished_at timestamptz,
  heartbeat_at timestamptz, attempts smallint default 0
)
unique (team_id, kind) where status in ('queued','running')   -- ein Job je Team und Art
RLS an, keine Rechte für anon/authenticated; Zugriff nur über die v1-Funktionen
```

- **Start:** `<bereich>_start_v1` legt den Job an oder gibt den laufenden zurück (Rate-Limit 5 pro Minute).
- **Worker:** `app._job_worker_v1()` ist eine Procedure ohne `security definer`, damit COMMIT möglich ist. pg_cron ruft sie alle 5 s auf: `set statement_timeout = '120s'; call app._job_worker_v1()`. Ablauf:
  1. holt einen Job mit `for update skip locked`;
  2. setzt `running` und schreibt COMMIT (damit der Status sofort sichtbar ist);
  3. setzt die JWT-Claims auf `created_by`, ruft die Rechnung auf und schreibt `success` mit `result`.
- **Fehler ohne exception-Block (pldbgapi2):** Bricht die Rechnung ab, bleibt der Job auf `running`. Der Aufräumer am Anfang jedes Worker-Laufs setzt dann Jobs ohne Heartbeat seit über 3 min auf `failed` mit `error.code = 'timeout'`. Für Prompt Research gilt eine Grenze von 10 min.
- **Status:** `<bereich>_status_v1(p_team, p_job_id)` liefert `{"meta": {"job_id", "kind", "status", "step", "progress", "status_message", "created_at", "started_at", "finished_at", "error"}, "rows": [Ergebnis]}`.
- **Benachrichtigung:** Zusätzlich sendet der Worker ein Realtime-Ereignis `job` an `team:<team_id>` (privat, siehe 9). Das Frontend fragt zur Sicherheit alle 3 s den Status ab, bis `success` oder `failed` kommt.
- **Folge des 5-s-Takts:** rund 17.000 Einträge pro Tag in `cron.job_run_details`. Ein täglicher Aufräum-Job löscht Protokolleinträge, die älter als 3 Tage sind. Das betrifft nur das Protokoll; die Datei dafür gebe ich dir separat.

---

## 9 Realtime: private Kanäle

- **Kanäle:**
  - `mira:<session_id>` für Fortschritt und Antwort;
  - `user:<uid>` für Nutzer-Ereignisse;
  - `team:<team_id>` für Job-Ereignisse.

  Alle drei sind private Kanäle (`private = true`).
- **Policy:**
  - `realtime.messages` bekommt eine SELECT-Policy für authenticated über `app.realtime_topic_allowed_v1(realtime.topic())` (security definer).
  - Die Funktion prüft: Die Session gehört `auth.uid()`, die uid ist `auth.uid()`, oder der Nutzer ist Mitglied im Team.
  - Die Onboarding-Policy bleibt unverändert.
- **`mira_emit_progress`:**
  - sendet zusätzlich privat; die öffentlichen Kanäle bleiben für Bubble bestehen;
  - erst nach der Umstellung schalten wir die öffentlichen ab (eigene Datei).
- **Frontend:** `supabase.channel('mira:<id>', { config: { private: true } })` nach dem Login.

---

## 10 Offene Fragen (mit meiner Empfehlung)

1. **Sentiment im Verlauf (3.2):** Gilt die 30-Tage-Regel nur für Kennzahlen (Radar, Übersicht) und nicht für einzelne Punkte im Verlauf? Empfehlung: Tages- und Wochenpunkte wie gehabt; Monatspunkte rechnen nur über die letzten 30 Tage des Monats.
2. **Markenvarianten:** `mentioned_runs` und `mentioned_count` waren in jeder Stichprobe gleich. Empfehlung: beide behalten (gleiche Namen wie heute), Claude Code nutzt `mentioned_count`.
3. **Opportunities-Liste:** Reicht `dashboard_opportunities_v1` (alle Karten, Filter im Frontend)? Empfehlung: ja, solange ein Team unter etwa 200 Karten bleibt.
4. **„Look for new“:** Einverstanden mit dem Worker in der Datenbank (pg_cron alle 5 s, Aufräumen des Cron-Protokolls)? Die Alternative wäre ein synchroner Aufruf (max 23 s heute, Grenze 30 s), ohne Fortschritt und mit Abbruchrisiko.
5. **Prompt-Research-Start:**
   - Darf n8n die `job_id` übernehmen und den Stand über `prompt_research_job_update_v1` melden, statt direkt in die Tabelle zu schreiben?
   - Wie heißt der Webhook, und welche Felder erwartet er?
6. **Prompt Research löschen:** endgültig wie heute, oder weich (neuer Status `deleted`, Vorschläge bleiben)? Empfehlung: weich.
7. **Mira senden, Sprache, PDF:** n8n-Workflow-Namen und Payloads, damit ich sie im Vertrag festhalte. Ruft die Next.js-Server-Route n8n direkt auf? Empfehlung: ja.
8. **Mira-Einstellungen:** Wo sollen sie liegen? Empfehlung: neues Feld `user_settings.mira_settings jsonb` plus `mira_settings_get_v1` und `mira_settings_set_v1` mit fester Liste erlaubter Schlüssel.
9. **Teams-Tabelle:**
   - Bleibt sie ohne Kennzahlen wie v4? Empfehlung: ja. Falls doch Kennzahlen gewünscht sind: `teams_portfolio_kpis_v1`, nachgeladen (siehe 5.2).
   - Woher kommt `p_pinned_team_id`? Heute gibt Bubble den Wert mit. Speichert die Datenbank ihn künftig, wäre das ein neues Feld `user_settings.pinned_team_id` plus eine Setz-Funktion.
   - Löst ein Klick auf eine Zeile einen Teamwechsel aus? Das läuft vermutlich zentral bei Claude Code; falls nicht, wäre eine Funktion nötig, die `user_settings.last_team_id` setzt.
10. **Märkte und Tags:** Claude Code schickt die Liste der zentral vorhandenen Funktionen; dann streiche ich hier alles Doppelte.
11. **Realtime:** Einverstanden mit privaten Kanälen, wobei die öffentlichen parallel laufen, bis Bubble abgeschaltet ist?
12. **Fehler bei vollem Planlimit:** `prompt_research_limit_reached` mit PT409 (HTTP 409) in Ordnung?

---

## 11 Bauplan nach Freigabe

Reihenfolge A → B → E → C → D, je Ansicht drei Dateien, jede als ein Block ausführbar:

- `<ansicht>_v1.sql`
- `<ansicht>_v1_rueckweg.sql`
- `<ansicht>_v1_prod_test.sql`

Vorgehen bei jeder Ansicht:

- Vor jeder Datei lese ich die Definitionen erneut aus (pg_get_functiondef). Eine md5-Prüfung bricht ab, wenn sich der Bestand geändert hat.
- Tests laufen in Prod mit Rollback, ohne exception-Blöcke, höchstens 3 Testdateien pro Runde. Geprüft werden:
  - Gleichheit mit der alten Funktion (außer bei den genannten Änderungen);
  - Rechte (anon gesperrt);
  - Grenzwerte der Parameter;
  - Zeiten kalt und warm.
- Danach ergänze ich den Vertrag für Claude Code mit echten Beispielantworten (wie DASHBOARD_V1_VERTRAG.md).

Separat und nur auf dein Zeichen:

- `prompt_research_haenger.sql`: 92 Jobs auf `failed` setzen;
- Aufräumen des Cron-Protokolls;
- Entzug der anon-Rechte der alten Funktionen, sobald Bubble sie nicht mehr nutzt.
