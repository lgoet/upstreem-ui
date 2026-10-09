# Fünf Ansichten – Vertragsvorschlag v1, Fassung 2

Stand 09.10.2026. Ersetzt Fassung 1 (im Repo `bubble/seiten_db_vorschlag_1.md`) vollständig.

Eingearbeitet sind Rückmeldung 1 von Claude Code mit den Entscheidungen des Nutzers (Abschnitt N) und Rückmeldung 2 (CORS, Teamprüfung bei `mira-send`, ungültiges Pin-Team, n8n). In der Datenbank ist nur `prompt_research_haenger.sql` gelaufen (freigegeben, ausgeführt, siehe 0.2).

Stand A Performance: in Prod eingespielt (09.10., 11:24) und danach in Prod geprüft. Alle Vergleiche mit v7, v4 und v2 stimmen, die echten Antworten stehen in Abschnitt 11. Die Funktionen können genutzt werden.

Gemessen wurde in Prod (Projekt kyra.ai) mit Team 877c (Mercedes Benz) und Nutzer aea6e317… (die meisten Mira-Chats). Für die Messungen war `app.warming = on` gesetzt, damit lief kein Rate-Limit-Zähler mit. Die Werte für Mittel und Maximum stammen aus pg_stat_statements.

Die Oberfläche übersetzt Namen im Datenmodul je Bereich, zum Beispiel `cells` statt `rows`. Die Form `meta` + `rows` bleibt deshalb überall gleich.

---

## 0 Was sich gegenüber Fassung 1 geändert hat

### 0.1 Übersicht

| Ansicht | Neue Funktionen | Wiederverwendet | Cache | Langläufer |
|---|---|---|---|---|
| A Performance | `performance_radar_v1`, `performance_company_chart_v1`, `performance_brand_variations_v1` | `cached_citations_urls_v1`, `dashboard_cache` mit `_dash_cached_v1`, `_dash_refresh_v1` und `clear_dashboard_cache_v1` | Radar, Varianten | – |
| B Opportunities | `opportunities_set_status_v1`, `opportunities_own_urls_v1`, `opportunities_create_v1`, `opportunities_search_start_v1`, `opportunities_search_status_v1` | `dashboard_opportunities_v1` | – | „Look for new“: Edge Function `start-job` führt aus |
| E Teams | `teams_portfolio_v1` | – | – (bewusst) | – |
| C Prompt Research | `prompt_research_jobs_v1`, `prompt_research_result_v1`, `prompt_research_decide_v1`, `prompt_research_delete_v1`, `prompt_research_start_v1`, `prompt_research_job_update_v1` (nur n8n) | Märkte und Tags zentral | – | Edge Function `start-job` stößt n8n an |
| D Mira | `mira_sessions_v1`, `mira_messages_v1`, `mira_session_update_v1`, `mira_session_delete_v1`, `mira_project_save_v1`, `mira_project_delete_v1`, `mira_turn_status_v1`, `mira_message_check_v1`, `mira_settings_v1`, `mira_settings_set_v1` | `cached_mira_yesterday_top_entities_v1`, `dashboard_chats_v1`, n8n-Funktionen `start/finish/fail_mira_chat_turn` | – | Edge Functions `mira-send` und `mira-export-pdf` |

### 0.2 Ausgeführt: `prompt_research_haenger.sql`

- **Ergebnis:** 92 Jobs auf `error` gesetzt.
  - Vorher: `running` 92, `success` 30.
  - Nachher: `error` 92, `success` 30.
- **Nichts gelöscht:** Keiner der 92 Jobs hatte Vorschläge oder ein `result`.
- **Wiederherstellbar:** Die alten Werte stehen in `error.previous`. Der Rückweg dafür ist `prompt_research_haenger_rueckweg.sql`.
- **Abweichung von der Freigabe:** Freigegeben war „auf failed“. Die Tabelle erlaubt aber nur `queued`, `running`, `success` und `error` (Constraint `prompt_research_job_status_check`). Deshalb heißt der Endstatus `error`. Die Bedeutung ist dieselbe, und die Tabelle wurde dafür nicht geändert.
- **Folge für den Vertrag:** Überall gilt die Statusfolge `queued → running → success | error`. Prompt Research, `view_job` und Mira benutzen damit dieselben Wörter. `failed` gibt es nirgends.

### 0.3 Neue Befunde aus dieser Runde

1. **Gelöschte Teams in der Teams-Tabelle.**
   - `get_team_portfolio_overview_v4` liefert auch gelöschte Teams, weil es nur über `team_member` geht.
   - Beim Testnutzer sind 4 von 11 gelöscht: upstreem, digitallotsen, Der Sanitätscoach und MotelOne. Ein Klick darauf endet in `team_access_deleted`.
   - Über alle 14 Teams in Prod: 8 `active`, 2 `no_plan`, 4 `deleted`.
   - Vorschlag in 5.2. Das ist Rückfrage R1.
2. **PDF-Export.**
   - `get_mira_message_export_payload_v1(p_team, p_assistant_message_id, p_session_id)` ist nur für service_role freigegeben und prüft keinen Nutzer.
   - Auf der Datenbankseite reichen Team-ID und Nachrichten-ID.
   - Was der n8n-Workflow selbst prüft, kann ich von hier nicht sehen.
   - Der Datenbankanteil des Exports braucht 11 ms im Mittel und höchstens 39 ms (64 Aufrufe).
   - Die eigentliche Laufzeit entsteht beim Rendern in n8n. Kalt messen kann ich sie nicht: Die Datenbank hat kein HTTP (kein `pg_net`), und den Webhook mit einem echten Chat rufe ich nicht auf. Messung: in den n8n-Executions von `mira-message-export-pdf` die Dauer ablesen. Die Grenze der Edge Function (150 s bis zur Antwort) reicht, solange der Export darunter bleibt.
3. **Opportunity-Felder geprüft.**
   - Geprüft wurden 100 Karten aus 7 Teams.
   - Alle 25 Felder, die die Oberfläche liest, sind in jeder Karte vorhanden und nie `null`.
   - `mentioned_competitors[]`: 174 Einträge, alle mit `name`, `company_id` und `favicon_url`.
   - `topics[]`: 267 Einträge, alle mit `name`, `emoji`, `hex_light` und `hex_dark`.
   - `source_scope` kommt nur mit den Werten `all` und `external_only` vor.
4. **Teams je Nutzer:** Der Nutzer mit den meisten Teams hat 11. Kein Nutzer hat mehr als 24.
5. **Prompt-Research-Jobs:** Alle 122 Jobs haben `created_by = null`. n8n schreibt sie direkt in die Tabelle; mit `prompt_research_start_v1` wird das behoben.

---

## 1 Gemeinsame Regeln (freigegeben)

- **Aufruf:**
  - `POST /rest/v1/rpc/<name>`, Header `Content-Profile: app`, Body mit benannten Parametern.
  - Die Antwort ist immer `jsonb` mit `meta` und `rows`; zusätzliche Blöcke sind einzeln genannt.
- **Zugriff:**
  - Der Nutzer kommt aus dem JWT (`auth.uid()`), es gibt kein `p_user`.
  - Funktionen laufen als `security definer` mit festem `search_path`. `anon` hat keinen Zugriff.
  - Die Teamprüfung läuft über `app.require_team_access`.
- **Rate-Limit** über `_rl_hit_v1`, ohne exception-Block: Lesen 60, Schreiben 30, Job-Start 5 pro Minute.
- **Zeitraum:**
  - Gezählt werden Tage nach Europe/Berlin. Standard sind die letzten 30 Tage, die Vorperiode wird wie im Dashboard v1 bestimmt.
  - Sentiment wird nie über mehr als 30 Tage gerechnet.
- **Fehler:**

  | Fehler | errcode | Bedeutung |
  |---|---|---|
  | `<bereich>_invalid_param` | 22023 | `hint`: Parameter und erlaubte Werte |
  | `<bereich>_team_required` | 22023 | `p_team` fehlt |
  | `<bereich>_not_found` | PT404 | gehört nicht zum Team oder Nutzer |
  | `<bereich>_rate_limited` | PT429 | `hint`: Sekunden |
  | `prompt_research_limit_reached` | PT409 | `hint`: freie Plätze als reine Zahl |
  | Zugriff | wie `require_team_access` (42501 `forbidden`, P0403 `team_access_<state>`) | |

- **XX000 einmal wiederholen (gilt für alle RPCs, auch die alten):**
  - Liefert ein Aufruf `code = "XX000"` mit `pldbgapi2` in der Meldung, ruft das Datenmodul ihn **einmal** nach rund 300 ms erneut auf. Die Edge Functions machen es bei ihren Datenbankaufrufen genauso.
  - Die Wiederholung ist immer sicher, auch bei Schreibaufrufen: Der Fehler bricht die ganze Transaktion ab, es wurde also nichts gespeichert.
  - Ursache ist ein Fehler in der Datenbank-Erweiterung plpgsql_check 2.7 (von Supabase vorgeladen, von uns nicht genutzt). Er tritt zufällig auf, in Prod rund 5- bis 9-mal am Tag, quer durch alle Funktionen, auch bei Bubble. Siehe Abschnitt 12.
- **Freitext:** läuft durch `app.js_safe`, das Backtick, `${` und Backslash entfernt. Echte Zeilenumbrüche bleiben erhalten.
- **Bestand:** Für Bubble bleibt alles bestehen. Die anon-Rechte der alten Funktionen fallen erst weg, wenn Bubble sie nicht mehr ruft.

---

## 2 Bestandsaufnahme (unverändert gegenüber Fassung 1, gekürzt)

| Heute → Funktion | kalt / warm | Prod Mittel / Max | anon | Befund |
|---|---|---|---|---|
| `cached_topic_heatmap_v1` → `get_topic_heatmap_v7` | v7 30 T 2.336 / 2.295 ms; Wrapper 90 T 3.013 / 1 ms | 1.108 / 8.484 ms | nein | Sentiment über den ganzen Zeitraum. Standardzeitraum 7 Tage nach UTC. `p_metric` hat keine Wirkung. |
| `get_company_detailed_chart_v4` | 15 / 5 ms | 8 / 70 ms | ja | liefert 0 statt null |
| `get_company_brand_name_variations_v2` | 3.984 / 61 ms | 142 / 7.311 ms | ja | schneidet bei 100 von 390 ab |
| `cached_citation_urls_v2` | – | 359 / 14.396 ms | – | → `cached_citations_urls_v1` |
| `cached_list_source_recommendations_v1` | 28 / 1 ms | 10 / 30 ms | nein | → `dashboard_opportunities_v1` (7 ms) |
| `update_source_recommendation_status_v1` / `_bulk_v1` | – | 4 / 118 und 7 / 45 ms | ja | |
| `get_you_urls_v1` | 906 / 97 ms | 199 / 845 ms | ja | 69 URLs für 877c |
| `create_mira_source_recommendation_v3` | – | 3.435 / 4.899 ms | nein | nimmt `p_user`, liefert Text |
| `build_source_recommendations_v11` | – | 5.355 / 23.235 ms (v10 max 59.696) | – | läuft synchron |
| `cached_get_team_portfolio_overview_v4` → v4 | 13 / 4 ms | 10 / 32 ms | ja | Wrapper ohne Cache, wirkungslose Filter, heftet still an, liefert gelöschte Teams |
| `list_prompt_research_jobs_v1` / `get_prompt_research_result_v1` | 17 / 16 ms | 10 / 84 und 7 / 64 ms | ja | |
| `manage_suggested_prompts_v1` | – | 14 / 99 ms | – | exception-Block (XX000-Risiko) |
| `get_mira_chat_sessions_v3` / `get_mira_chat_messages_v2` | 22 / 32 ms | 4 / 65 und 17 / 230 ms | nein | `\` + `n` im Text, Zeit ohne `T` |
| Mira-Antwort (n8n) | – | Median 44,6 s, p95 119,9 s | – | bleibt asynchron |

---

## 3 Edge Functions (N.1, neu)

### 3.1 Gemeinsames

- **Aufruf und Rechte:**
  - Aufruf mit `POST /functions/v1/<name>` und Header `Authorization: Bearer <Nutzer-JWT>`.
  - Die Edge Function ruft die Datenbank mit dem Nutzer-JWT auf, damit `auth.uid()` und `require_team_access` greifen.
  - Nur die internen Lauf- und Status-Funktionen (`_..._v1`, `prompt_research_job_update_v1`) laufen mit service_role.
- **Geheimnisse:** Webhook-Adressen und der n8n-Header stehen nur in den Supabase-Secrets (`N8N_PROMPT_RESEARCH_URL`, `N8N_MIRA_SEND_URL`, `N8N_MIRA_VOICE_URL`, `N8N_MIRA_PDF_URL`, `N8N_SHARED_SECRET`). n8n bekommt den Header `X-Upstreem-Secret`.
- **Fehler:** Fehler der Datenbank gibt die Edge Function unverändert weiter, mit HTTP-Status und JSON `{"code": "...", "message": "...", "hint": "..."}`. Eigene Fehler sind:
  - `edge_unauthorized` (401);
  - `edge_invalid_body` (400);
  - `edge_upstream_failed` (502).
- **CORS (Rückmeldung 2, Nr. 1)** gilt für alle drei Functions:
  - `OPTIONS` antwortet mit 204, ohne JWT-Prüfung.
  - `Access-Control-Allow-Origin` ist genau die anfragende Herkunft aus der Liste `https://app.upstreem.ai` (dazu eine `*.bubbleapps.io`-Adresse, falls es sie gibt; das prüfe ich beim Bau), nie `*`. Dazu kommt `Vary: Origin`.
  - `Access-Control-Allow-Headers: authorization, apikey, content-type, x-client-info`.
  - `Access-Control-Allow-Methods: POST, OPTIONS`.
  - Bei `mira-export-pdf` zusätzlich `Access-Control-Expose-Headers: Content-Disposition`.
  - Die CORS-Kopfzeilen stehen an **jeder** Antwort, auch an 400, 401, 404, 429 und 502.
- **Grenzen von Supabase:**
  - 150 s bis zur Antwort;
  - Laufzeit insgesamt 150 s (Free) bzw. 400 s (bezahlt);
  - 2 s CPU (Warten auf Datenbank oder n8n zählt nicht).

  Alle Rechnungen hier passen hinein.

### 3.2 `start-job`

Body: `{"kind": "opportunities_search" | "prompt_research", "team_id": "…", "params": {…}}`

Antwort sofort (HTTP 202): `{"job_id": "…", "kind": "…", "status": "queued", "reused": false}`

`reused: true` heißt: Es lief schon ein Job dieser Art im Team, und genau der kommt zurück. Dann wird nichts neu gestartet.

**kind = opportunities_search** (`params: {}`), Ablauf:

1. `opportunities_search_start_v1(p_team)` mit dem Nutzer-JWT legt den Job an.
2. Danach läuft in `EdgeRuntime.waitUntil` mit service_role:
   - `_job_claim_v1(job_id)`: setzt `running`, `started_at` und `heartbeat_at` und wird sofort sichtbar.
   - `_opportunities_search_run_v1(job_id)`: setzt intern den Nutzer des Jobs, ruft `build_source_recommendations_v11` und schreibt `success` mit `result`.
   - Wirft die Rechnung einen Fehler, ruft die Edge Function `_job_fail_v1(job_id, code, message)` auf. Das `try`/`catch` liegt in TypeScript, die Datenbank braucht deshalb keinen exception-Block.

**Wie die Rechnung bis 60 s ohne die 30-s-Grenze läuft:**

- `_opportunities_search_run_v1` bekommt `set statement_timeout = '55s'` an der Funktion.
- PostgREST übernimmt Einstellungen auf Funktionsebene für genau diesen Aufruf. Das steht so in der Supabase-Doku „Timeouts → Function level“. Die Rollengrenze von `authenticated`/`service_role` (30 s) gilt dann nicht.
- Über REST erlaubt Supabase höchstens 60 s, deshalb 55 s.
- Heute braucht v11 höchstens 23 s, es bleibt also mehr als doppelter Puffer.
- Bräuchte eine Rechnung einmal mehr als 55 s, wäre der Weg eine direkte Datenbankverbindung aus der Edge Function (`SUPABASE_DB_URL`, `set local statement_timeout`). Das baue ich nur auf Nachfrage.
- Beim Bau prüfe ich mit einem Probeaufruf über REST, dass die Einstellung auf Funktionsebene wirkt (`pg_sleep(35)` in einer Testfunktion).

**kind = prompt_research**, Parameter in `params: {"keywords": [...], "market": "DE", "business_model": "b2c", "persona": null}`. Ablauf:

1. `prompt_research_start_v1(...)` mit dem Nutzer-JWT legt den Job an.
2. Danach ruft die Edge Function in `waitUntil` den Webhook `N8N_PROMPT_RESEARCH_URL` mit `{job_id, team_id, user_id (aus dem JWT), keywords, market, business_model, persona}`. Wie die Nutzlast auf n8n-Seite aussieht, steht noch aus (N.2).
3. Antwortet n8n nicht mit 2xx, setzt die Edge Function den Job über `prompt_research_job_update_v1(job_id, 'error', …)` auf `error`.

### 3.3 `mira-send` (Text und Sprache)

Body Text: `{"team_id": "…", "chat_id": "" | "…", "message": "…", "answer_detail": "Medium" | "High" | "Ultra", "model": "pro" | "flash"}`

Body Sprache: `{"team_id": "…", "type": "voice", "message_id": "voice_<ts>", "chat_id": null | "…", "audio_base64": "…", "mime_type": "…", "duration_ms": 1234}`

Ablauf:

1. Die Edge Function prüft mit dem Nutzer-JWT:
   - immer `mira_message_check_v1(p_team, p_session_id)`: Das Team wird geprüft (`require_team_access`), auch bei einem neuen Chat. Ein vorhandener Chat muss dem Nutzer und diesem Team gehören, sonst `mira_not_found`;
   - der Text darf höchstens 8.000 Zeichen haben, die Sprachaufnahme höchstens 10 MB.
2. Sie gibt die Anfrage an n8n weiter. `user_id` und `team_id` kommen dabei aus der Prüfung, nicht aus dem Body.
3. Antwort 202: `{"accepted": true, "chat_id": "…" | null}`.

Alles Weitere kommt über Realtime: `mira_turn_started` mit `is_new_session` und danach die übrigen Ereignisse. Ob `mira-send` die id eines neuen Chats sofort zurückgeben kann, hängt von N.2 ab. Dafür müsste die Edge Function den Chat vorher anlegen und n8n dessen id übernehmen. Bis das geklärt ist, steht in `chat_id` bei neuen Chats `null`.

### 3.4 `mira-export-pdf` (ohne Job)

Body: `{"team_id": "…", "session_id": "…", "assistant_message_id": "…"}`

Ablauf:

1. `mira_message_check_v1(p_team, p_session_id, p_message_id)` mit dem Nutzer-JWT prüft, dass Team, Chat und Nachricht zum Nutzer gehören und die Nachricht eine Antwort von Mira ist. Sonst kommt `mira_not_found` (404). Body daher: `{"team_id": "…", "session_id": "…", "assistant_message_id": "…"}`.
   - Eine eigene Prüffunktion statt `mira_messages_v1`, weil `mira_messages_v1` höchstens 200 Nachrichten liefert und eine ältere Antwort sonst fälschlich als „nicht gefunden“ gälte.
2. Die Edge Function ruft `N8N_MIRA_PDF_URL` mit `team_id` (aus der Prüfung), `session_id` und `assistant_message_id` auf, mit Header `X-Upstreem-Secret`.
3. Antwort: die Datei als `application/pdf` mit `Content-Disposition: attachment; filename="mira-<datum>.pdf"`. Bei Fehlern kommt JSON wie in 3.1.

Erst nach der Umstellung bekommt der n8n-Webhook Header-Auth. Vorher nicht, weil der Bubble-Weg keinen Header schickt.

### 3.5 Aufräumen ohne Worker (N.3)

- Es gibt keinen 5-s-Worker. Einmal pro Minute läuft per pg_cron `call app._job_reaper_v1()`. Die Prozedur arbeitet in Millisekunden und bleibt weit unter 12 s.
- Sie setzt auf `error` mit `error.code = 'timeout'`:
  - `view_job`-Einträge, die `queued` oder `running` sind und deren `heartbeat_at` bzw. `created_at` älter als 3 min ist;
  - `prompt_research_job`-Einträge, die `queued` oder `running` sind und seit über 10 min nicht aktualisiert wurden.
- Das Cron-Protokoll wächst damit um rund 1.440 Zeilen pro Tag. Das ist so wenig, dass kein Aufräum-Job nötig ist.

### 3.6 Tabelle `app.view_job`

```
id uuid pk default gen_random_uuid(), team_id uuid not null, created_by uuid not null,
kind text not null check (kind in ('opportunities_search')),
status text not null default 'queued' check (status in ('queued','running','success','error')),
status_message text, params jsonb, result jsonb, error jsonb,
created_at timestamptz default now(), started_at timestamptz, finished_at timestamptz, heartbeat_at timestamptz
unique (team_id, kind) where status in ('queued','running')
RLS an, keine Rechte für anon/authenticated
```

---

## 4 A Performance

### 4.1 `performance_radar_v1` (Cache über `dashboard_cache`)

Im Radar sind die **Topics die Zeilen** und die **Marken die Spalten**. Die Rechnung ist eine Kopie von v7. Geändert wird:

- Sentiment wird höchstens über 30 Tage gerechnet, die Vorperiode ebenso.
- Die Tage gelten nach Europe/Berlin, Standard sind 30 Tage.
- `p_metric` fällt weg.
- `topic_emoji` kommt in `rows`, `topics` und `available_topics` (`null`, wenn ein Topic keins hat).

| Parameter | Typ | Standard | Regeln |
|---|---|---|---|
| p_team | uuid | – | Pflicht |
| p_date_from / p_date_to | date | letzte 30 Tage | von ≤ bis, höchstens 366 Tage |
| p_models, p_markets, p_tag_ids, p_tagmode | | alle / `or` | `p_markets` ohne Rücksicht auf Groß- und Kleinschreibung |
| p_companies | uuid[] | – | Ist die Liste gesetzt, gelten **genau diese** (1–25), unabhängig von `p_company_limit`. `selected_position` folgt der Reihenfolge der Liste. |
| p_topics | uuid[] | – | Gleiche Regel wie bei `p_companies`. |
| p_company_limit / p_topic_limit | int | **12 / 12** | 1–25. Gilt nur, wenn keine Liste übergeben wird. |
| p_domain | text | – | nur Läufe, in denen diese Domain zitiert wurde. Wie in v7 gilt dann ein Zeitraum von höchstens 7 Tagen (die letzten 7 bis `p_date_to`), ohne Vorperiode (`*_prev` und `*_delta` sind `null`). Performance braucht `p_domain` nicht. |

Antwort (877c, 30 Tage, 12 × 12, gekürzt):

```json
{
  "meta": {"team_id": "877c649c-…", "date_from": "2026-09-10", "date_to": "2026-10-09", "prev_from": "…", "prev_to": "…",
           "sentiment_from": "2026-09-10", "sentiment_prev_from": "…", "timezone": "Europe/Berlin",
           "selection": {"company_limit": 12, "topic_limit": 12, "total_company_count": 11, "total_topic_count": 13,
                         "selected_company_count": 11, "selected_topic_count": 12, "companies_explicit": false, "topics_explicit": false},
           "ranges": {"visibility_min": 0.00, "visibility_max": 93.37, "rank_min": 3.31, "rank_max": 14.93, "sentiment_min": 55.58, "sentiment_max": 86.62},
           "filters": {"models": [], "markets": [], "tag_ids": [], "tagmode": "or", "domain": null},
           "generated_at": "…", "cached": true, "stale": false},
  "rows": [
    {"topic_id": "8daee9bb-…", "topic_name": "SUV", "topic_emoji": null, "topic_position": 1, "topic_hex_light": "#6d28d9", "topic_hex_dark": "#6d28d9",
     "company_id": "666761a9-…", "company_name": "VW", "role": "competitor", "company_position": 1, "logo_url": "…",
     "visibility_pct": 40.68, "visibility_prev_pct": 41.78, "visibility_delta_pct": -1.10,
     "avg_rank": 4.64, "avg_rank_prev": 4.50, "avg_rank_delta": 0.14,
     "sentiment": 75.44, "sentiment_prev": 72.87, "sentiment_delta": 2.57,
     "mentions": 975, "mentions_prev": 460, "total_runs_topic_company_now": 2397, "total_runs_topic_company_prev": 1101,
     "heat_value_visibility": 0.4357, "heat_value_rank": 0.8855, "heat_value_sentiment": 0.6398}
  ],
  "companies": [{"company_id": "666761a9-…", "name": "VW", "role": "competitor", "position": 1, "is_selected": true, "selected_position": 1, "visibility_pct": 42.63, "…": "…"}],
  "topics": [{"topic_id": "8daee9bb-…", "name": "SUV", "emoji": null, "position": 1, "is_selected": true, "selected_position": 1, "topic_share_pct": 28.65, "hex_light": "#6d28d9", "hex_dark": "#6d28d9", "…": "…"}],
  "available_companies": ["… höchstens 50"],
  "available_topics": ["… höchstens 50, mit emoji"]
}
```

Hinweis zum Beispiel: Die Werte in `companies` stammen aus dem 90-Tage-Lauf; beim Bau ersetze ich sie durch die 30-Tage-Werte.

### 4.2 `performance_company_chart_v1` (ohne Cache)

| Parameter | Standard | Regeln |
|---|---|---|
| p_team, p_company | – | Pflicht. Die Marke muss zum Team gehören, sonst `performance_not_found`. |
| p_mode | `visibility` | `visibility`, `rank` oder `sentiment`. Heute nutzt die Oberfläche nur `visibility`. |
| p_granularity | `day` | `day`, `week` oder `month`. Heute nutzt die Oberfläche nur `day`. |
| p_tag_ids | – | Topic-Fall: `[topic_id]` |
| Zeitraum und Filter | wie 4.1 | |

Tage ohne Läufe liefern `null`. Echte Werte (877c, eigene Marke, visibility, day):

```json
{"meta": {"team_id": "877c…", "company_id": "87468f49-…", "mode": "visibility", "granularity": "day", "date_from": "2026-09-10", "date_to": "2026-10-09", "points": 30, "…": "…"},
 "rows": [{"day": "2026-09-10", "value": 28.42}, {"day": "2026-09-11", "value": 30.00}, {"day": "2026-09-12", "value": 29.09}]}
```

### 4.3 `performance_brand_variations_v1` (Cache)

| Parameter | Standard | Regeln |
|---|---|---|
| p_team, p_company | – | Pflicht |
| Zeitraum und Filter | wie 4.1 | |
| p_limit / p_offset | **1000** / 0 | 1–1000 / ≥ 0 |

Sortiert wird nach `mentioned_count` absteigend, dann nach `name` aufsteigend. `meta.total_count` ist 390 und `meta.mentions_total` 3282. Jede Zeile enthält `name`, `mentioned_count`, `mentioned_runs` und `share_of_voice_pct`. Erste Zeile: Mercedes-Benz 568 / 568 / 17.31.

### 4.4 URLs

Die URLs kommen aus `cached_citations_urls_v1`, aufgerufen mit `p_tag_ids = [topic_id]` und `p_mentioned_brands = [company_id]`. Eine neue Funktion braucht es dafür nicht. Getestet: 1.875 Treffer, kalt 637 ms, warm 9 ms.

### 4.5 Cache leeren

`clear_dashboard_cache_v1(p_team)` leert auch den Radar und die Varianten.

---

## 5 B Opportunities

### 5.1 Liste

`dashboard_opportunities_v1` wird ohne Umbenennung durchgereicht. Alle Felder sind geprüft (0.3 Nr. 3). Gefiltert wird nur im Browser.

### 5.2 `opportunities_set_status_v1(p_team, p_ids, p_status)`

- **Parameter:**
  - `p_ids`: 1–**500** Einträge.
  - `p_status`: `Created`, `In Progress`, `Ignored` oder `Done`.
- **Fremde und unbekannte Ids:**
  - Ids, die nicht zum Team gehören oder nicht (mehr) existieren, werden **übersprungen** und in `meta.skipped_ids` gemeldet.
  - Geändert werden nur Karten des Teams.
  - Sind alle Ids fremd oder unbekannt, kommt trotzdem eine normale Antwort mit `changed: 0`.

```json
{"meta": {"team_id": "877c…", "new_status": "Done", "changed": 1, "unchanged": 0, "skipped_ids": [],
          "status_counts": {"created_count": 13, "in_progress_count": 1, "ignored_count": 0, "done_count": 1, "active_count": 14}, "generated_at": "…"},
 "rows": [{"id": "519100ab-…", "old_status": "Created", "new_status": "Done", "changed": true, "updated_at": "…"}]}
```

### 5.3 `opportunities_own_urls_v1(p_team, p_search, p_limit 50 [1–200], p_offset)`

Unverändert. `meta.total_count` ist für 877c 69. Jede Zeile enthält `url`, `title` und `favicon`.

### 5.4 `opportunities_create_v1(p_team, p_lead_url, p_title, p_reason, …)`

- **Pflicht:** nur `p_lead_url` (http oder https, höchstens 2.000 Zeichen).
- **Längen:** `p_title` wird auf 300 Zeichen gekürzt, `p_reason` auf 2.000. Zu lange Texte führen also nicht zu einem Fehler.
- **Optional:** `p_tag_ids`, `p_tagmode`, `p_models`, `p_markets`, `p_date_from` und `p_date_to`. Ein `recommendation_type` gibt es nicht.
- **Antwort:** `meta.status` ist `Created` oder `AlreadyExists`. `rows` enthält eine Karte mit den Feldern aus 5.1.

### 5.5 „Look for new“

- `opportunities_search_start_v1(p_team)` wird nur von der Edge Function `start-job` aufgerufen (3.2). Antwort: `{"meta": {"job_id": "…", "status": "queued", "reused": false}, "rows": []}`.
- `opportunities_search_status_v1(p_team, p_job_id default null)`:
  - Ohne `p_job_id` kommt der laufende Job des Teams; läuft keiner, der zuletzt beendete.
  - Gibt es noch keinen Job, kommt `meta.status = null`.

```json
{"meta": {"job_id": "…", "kind": "opportunities_search", "status": "running", "status_message": "Looking for new opportunities",
          "error": null, "created_at": "…", "started_at": "…", "finished_at": null},
 "rows": []}
```

- **Fehler:** Bei `error` steht in `meta.error` der Wert `{"code": "timeout" | "build_failed" | "rate_limited" | …, "message": "…"}`.
- **Ergebnis:** Bei `success` steht die Rückgabe von v11 unverändert in `meta.result`. Die Oberfläche lädt danach `dashboard_opportunities_v1` neu.
- **Abbruch:** Nach 3 min ohne Abschluss setzt der Aufräumer den Job auf `error`.

---

## 6 E Teams

### 6.1 `teams_portfolio_v1(p_search, p_pinned_team_id, p_limit, p_offset, p_order)`

- **Parameter und Standards:**
  - `p_limit` ist standardmäßig **100**, erlaubt 1–100; `p_offset` ≥ 0.
  - `p_order` ist `created_at_desc` (Standard) oder `created_at_asc`.
  - `p_search` ist optional, die Oberfläche schickt es nicht.
- **Anheften:** `p_pinned_team_id` ist das aktive Team aus dem Team-Store. Ohne Angabe wird nichts angeheftet. Ist es kein (nicht gelöschtes) Team des Nutzers, wird es **ignoriert**: Es gibt keinen Fehler, nichts wird angeheftet, und `meta.pinned_team_id` ist `null` (Rückmeldung 2, Nr. 3).
- **Teams:** kommen aus der Mitgliedschaft des Nutzers. Es gibt keine Kennzahlen und keinen Cache.
- **Neue Felder:**
  - `access_state` aus `app.team_access`: `active`, `no_plan`, `past_due`, `trialing`, `trial_ended`, `unpaid` oder `ended`;
  - `has_access`;
  - `is_pinned`.
- **Gelöschte Teams (R1, entschieden):** Teams mit `team.is_deleted` werden nicht ausgeliefert und nicht gezählt.

Echte Werte mit `p_pinned_team_id = 877c`:

```json
{"meta": {"total_count": 7, "pinned_team_id": "877c649c-…", "search": null, "limit": 100, "offset": 0, "order": "created_at_desc", "generated_at": "…", "cached": false, "stale": false},
 "rows": [
   {"team_id": "877c649c-…", "team_name": "Mercedes Benz", "domain": "mercedes-benz.de", "logo_url": "//…cdn.bubble.io/…png", "created_at": "2026-01-20T10:43:39.93472+00:00",
    "is_pinned": true, "access_state": "active", "has_access": true, "billing_plan": "Legacy Free", "active_billing_plan": "yes",
    "prompts_active": 102, "prompts_limit": 150, "prompts_remaining": 48, "competitors_tracked": 10, "competitors_limit": 10, "competitors_remaining": 0},
   {"team_id": "e6037cb1-…", "team_name": "CloudNine", "domain": "go-cloud-nine.de", "is_pinned": false, "access_state": "active", "has_access": true,
    "billing_plan": "Professional", "prompts_active": 14, "prompts_limit": 150, "prompts_remaining": 136, "competitors_tracked": 10, "competitors_limit": 10, "competitors_remaining": 0, "…": "…"}
 ]}
```

`total_count` ist 7, weil die 4 gelöschten Teams nicht mitkommen. Mit ihnen wären es 11 wie heute.

Offen, nicht zu bauen: `user_set_active_team_v1(p_team)` auf `last_team_id`. Das kommt erst mit Next.js; bis dahin wechselt Bubble das Team (`usnTeam`).

---

## 7 C Prompt Research

### 7.1 `prompt_research_start_v1(p_team, p_keywords, p_market, p_business_model, p_persona)`

Wird nur von der Edge Function `start-job` aufgerufen.

| Parameter | Regeln |
|---|---|
| p_keywords | `text[]`, 1–20 Einträge, jeder getrimmt und nicht leer, zusammen höchstens 300 Zeichen |
| p_market | alpha2, Groß- und Kleinschreibung egal (wird groß gespeichert), muss in den Märkten existieren |
| p_business_model | `b2c`, `b2b` oder `hybrid` |
| p_persona | `student`, `entrepreneur`, `smb_owner`, `parent_family`, `tech_enthusiast`, leer wird `null` |

- **Vorabprüfungen:**
  - Rate-Limit 5 pro Minute.
  - Pro Team läuft höchstens ein Job; sonst kommt der laufende zurück (`reused`).
  - Das Planlimit wird geprüft, bevor n8n etwas kostet. Ist kein Platz frei, kommt `prompt_research_limit_reached` (PT409).
- **Anlage:** Der Job wird mit `queued`, `created_by = auth.uid()` und `input_keywords` angelegt. `input_keywords` bleibt eine Textspalte, die Begriffe werden mit Komma verbunden.

### 7.2 `prompt_research_job_update_v1(p_job_id, p_status, p_step, p_progress, p_message, p_error)` (nur service_role)

- Erlaubte Übergänge: `queued → running → success | error`, außerdem direkt `queued → error`.
- Bei `success` und `error` wird `finished_at` gesetzt.
- Die Vorschläge schreibt n8n weiter über `insert_suggested_prompts_with_tags_v2`.

### 7.3 `prompt_research_jobs_v1(p_team, p_limit 5 [1–20])`

- **Inhalt:**
  - die letzten erfolgreichen Jobs mit offenen Vorschlägen;
  - laufende Jobs;
  - Jobs mit `error` aus den letzten 24 h.
- **`keywords`** kommt als `text[]`. Alte Jobs werden dafür am Komma geteilt.

```json
{"meta": {"team_id": "877c…", "running_count": 0, "limit": 5, "generated_at": "…"},
 "rows": [{"job_id": "46aeee80-…", "status": "success", "step": "Complete", "progress": 100, "status_message": null,
           "keywords": ["Automatikgetriebe"], "market": "DE", "market_name": "Germany", "market_alpha2": "DE", "market_alpha3": "DEU",
           "flag_url": "https://flagcdn.com/de.svg", "business_model": "b2c", "persona": null, "prompt_count": 11, "error": null,
           "created_at": "2026-08-29T16:03:28.861552+00:00", "started_at": "…", "finished_at": "2026-08-29T16:03:41.439+00:00"}]}
```

### 7.4 `prompt_research_result_v1(p_team, p_job_id)`

`meta` enthält den Job inklusive `keywords` (als `text[]`), `market_name` und `persona`. `rows` enthält die Vorschläge. Für einen gelöschten Job kommt `prompt_research_not_found`.

```json
{"meta": {"job_id": "46aeee80-…", "status": "success", "keywords": ["Automatikgetriebe"], "market": "DE", "market_name": "Germany",
          "business_model": "b2c", "persona": null, "prompt_count": 11, "created_at": "…", "finished_at": "…"},
 "rows": [{"id": "aecf95e2-…", "prompt_text": "Automatikgetriebe Probleme und welche Marken am wenigsten Ärger machen", "estimated_volume": 65,
           "market": "DE", "prompt_focus": null, "created_at": "2026-08-29T16:03:40.770757+00:00",
           "tags": [{"tag_id": "597a287b-…", "name": "Automatikgetriebe", "emoji": null, "hex_light": "#9145e8", "hex_dark": "#9145e8"}]}]}
```

### 7.5 `prompt_research_decide_v1(p_team, p_action, p_ids, p_with_tags default true)`

- **Parameter:**
  - `p_action`: `accept` oder `ignore`. „Delete all Prompts“ wird zu `ignore`.
  - `p_ids`: 1–100 Einträge.
  - `p_with_tags = false`: Es werden keine Topics verknüpft.
- **Ablauf:**
  - Es gibt keinen exception-Block. Der Insights-Cache wird ohne Abfangen geleert.
  - Reicht das Limit nicht, kommt PT409 mit `hint` = Zahl der freien Plätze, und es wird nichts angelegt.
- **Antwort:**
  - `meta`: `action`, `accepted`, `ignored`, `skipped`, `prompts_active`, `prompts_limit`, `prompts_remaining`.
  - `rows`: je Vorschlag `suggestion_id`, `prompt_id` und `result`.

### 7.6 `prompt_research_delete_v1(p_team, p_job_id)`

Löscht hart wie heute: Job, Vorschläge und Tags.

### 7.7 Märkte und Tags

Hier baue ich nichts. Die Daten liegen zentral in `setUpstreemMarkets`, `setUpstreemTopics` und `setUpstreemQuota`.

---

## 8 D Mira

### 8.1 `mira_sessions_v1(p_team, p_limit 50 [1–200], p_offset)`

- **Sortierung:** `is_pinned desc, updated_at desc, id desc`.
- **Gelöschte Chats** kommen nie mit.
- **Aufteilung:** `rows` enthält die Chats ohne Projekt, `projects[].sessions` die Chats in Projekten (alle).

### 8.2 `mira_messages_v1(p_team, p_session_id, p_limit 200 [1–200], p_before_id)`

- Sortiert aufsteigend.
- Echte Zeilenumbrüche, Zeiten im ISO-Format.
- Die Felder sind dieselben wie in v2.

### 8.3 Schreibaktionen

| Funktion | Parameter |
|---|---|
| `mira_session_update_v1` | p_team, p_session_id, p_title, p_is_pinned, p_project_id, p_clear_project (alle außer Team und Chat optional) |
| `mira_session_delete_v1` | p_team, p_session_id (setzt `status = 'deleted'`) |
| `mira_project_save_v1` | p_team, p_project_id (null = neu), p_title (Standard „New project“), p_session_id (optional: verschiebt den Chat in das Projekt) |
| `mira_project_delete_v1` | p_team, p_project_id |

### 8.4 Einstellungen

- **Speicherort:** neues Feld `user_settings.mira_settings jsonb`.
- **Lesen:** `mira_settings_v1()` gibt alle drei Schlüssel zurück, fehlende mit ihrem Standardwert.
- **Schreiben:** `mira_settings_set_v1(p_brand, p_citation, p_response)`. Jeder Parameter ist optional, nur übergebene Werte werden geändert, und andere Schlüssel werden nicht gespeichert.

| Schlüssel | Werte | Standard |
|---|---|---|
| brand | logo, icon, none | logo |
| citation | favicon, icon, none | icon |
| response | logo, icon, none | logo |

### 8.5 Status und Prüfung

- `mira_turn_status_v1(p_team, p_session_id)` liefert die letzte Antwort mit `queued`, `running`, `success` oder `error`.
- `mira_message_check_v1(p_team, p_session_id default null, p_message_id default null)` ist für die Edge Functions gedacht (3.3, 3.4).
  - Die Funktion ruft immer `require_team_access(p_team)` auf.
  - Mit `p_session_id` muss der Chat dem Nutzer und `p_team` gehören. Mit `p_message_id` muss die Nachricht zusätzlich in diesem Chat liegen und eine Antwort von Mira sein. Sonst kommt `mira_not_found`.
  - An n8n geht nur das geprüfte Team.
  - Antwort: `{"meta": {"team_id": "…", "session_id": "…", "message_id": "…" | null, "role": "assistant" | null}, "rows": []}`.

### 8.6 Realtime (N.5)

- **Kanäle:**
  - Alle Mira-Ereignisse gehen privat an `user:<uid>`.
  - `mira:<session_id>` kommt zusätzlich dazu.
  - Job-Ereignisse gehen an `team:<team_id>`.
- **Nutzlast:** Der Inhalt jeder Meldung enthält `event` und `session_id`.
- **Ereignisnamen** bleiben wie heute: `mira_turn_started` (mit `is_new_session`), `mira_message_success`, `mira_message_error`, `mira_title_updated`, `mira_user_transcript` und die Werkzeug-Ereignisse mit `tool`.
- **Policy auf `realtime.messages`** für authenticated: Zugriff auf `user:<uid>` nur, wenn `uid = auth.uid()`; auf `mira:<id>` nur, wenn der Chat dem Nutzer gehört; auf `team:<id>` nur für Mitglieder des Teams.
- **Öffentliche Kanäle** laufen parallel weiter, bis Bubble nicht mehr zuhört.

---

## 9 Offen

| Nr | Punkt | Wer |
|---|---|---|
| R1 | Entschieden: gelöschte Teams werden nicht ausgeliefert. | erledigt |
| N.2 | n8n baut der Datenbank-Chat (Rückmeldung 2, Nr. 5). Die Exporte liegen vor: Ask Mira Agent 20 (Senden und Sprache), Mira Error Handler, Prompt_Creator und Mira Message PDF Export. Alle Schlüssel stehen in Credentials, im Klartext steht keiner in einem Knoten. Je Workflow kommt eine geänderte JSON mit Änderungsliste, Prompt_Creator mit C, die drei Mira-Workflows mit D. Claude Code prüft sie vor dem Einspielen. | Datenbank-Chat |
| N.2 | PDF: n8n antwortet weiter direkt mit der Datei (bestätigt). Die Laufzeit liest der Nutzer in den n8n-Executions ab. | erledigt |
| R2 | Entschieden: Der Datenbank-Chat schreibt **neue** Edge Functions und deployt sie selbst. Bestehende Edge Functions fasst er nicht an. | erledigt |
| – | `user_set_active_team_v1` erst mit Next.js | später |

---

## 10 Bauplan

- **Reihenfolge:** A → B → E → C → D, wie freigegeben.
- **Dateien je Ansicht:** `<ansicht>_v1.sql`, `<ansicht>_v1_rueckweg.sql` und `<ansicht>_v1_prod_test.sql`, jede als ein Block ausführbar.
- **Vor dem Bau:**
  - Ich lese den Bestand neu mit `pg_get_functiondef`.
  - Eine md5-Prüfung bricht ab, wenn sich etwas geändert hat.
- **Tests:**
  - in Prod mit Rollback, ohne exception-Blöcke;
  - höchstens 3 Testdateien pro Runde.
- **Wann was dazukommt:**
  - Mit B kommen dazu: `view_job`, `_job_claim_v1`, `_job_fail_v1`, `_job_reaper_v1` (Cron jede Minute) und der Code für die Edge Function `start-job`.
  - Mit D kommen die Realtime-Policy und die Edge Functions `mira-send` und `mira-export-pdf` dazu.

---

## 11 Nachtrag A Performance: echte Antworten (Prod, 877c, Test mit Rollback am 09.10.)

| Prüfung | Ergebnis |
|---|---|
| Radar 30 T gegen v7 (gleiche Tage, 12/12): `rows`, `companies`, `topics`, `available_*`, `ranges` | identisch, 132 Zellen |
| Radar 30 T Zeit | kalt 5,8 s (erster Aufruf in einer frischen Sitzung, inkl. Übersetzen der Funktion), aus dem Cache 6 ms |
| Radar 90 T gegen v7 90 T (alles außer Sentiment, Vorperiode eingeschlossen) | 0 Abweichungen in 132 Zellen, kalt 3,9 s |
| Radar 90 T: Sentiment von Zellen und Marken gegen v7 mit den letzten 30 Tagen | 0 Abweichungen |
| `p_companies`, 3 Marken umgekehrt, `p_company_limit` 1 | genau diese 3, in der übergebenen Reihenfolge; `companies_explicit` true |
| `p_domain` `[www.ADAC.de](https://www.ADAC.de)` | wird zu `adac.de` normalisiert, `date_from` = heute − 6, `prev_from` null, 132 Zellen, 3,0 s |
| Kurve visibility/day 30 T gegen v4 | 0 Abweichungen, 30 Punkte (im Zeitraum gab es keine Tage ohne Läufe), 7 ms |
| Kurve Topic-Fall gegen v4 | 0 Abweichungen |
| Kurve sentiment/week 90 T gegen v4 | identisch, 14 Punkte |
| Varianten gegen v2 (v2 schneidet bei 100 ab) | erste 100 identisch; `total_count` 392 und alle 392 geliefert; `mentions_total` 3295; kalt 3,9 s, Seite 2 aus dem Cache 2 ms |
| `clear_dashboard_cache_v1(877c)` | 5 Einträge von Radar und Varianten vorher, 0 danach |
| Rechte | anon bei allen 10 Funktionen gesperrt; authenticated nur bei den 3 öffentlichen; kein exception-Block |

`performance_radar_v1(877c)`, meta (echt):

```json
{"team_id": "877c649c-…", "timezone": "Europe/Berlin", "date_from": "2026-09-10", "date_to": "2026-10-09",
 "prev_from": "2026-08-26", "prev_to": "2026-09-09",
 "sentiment_from": "2026-09-10", "sentiment_to": "2026-10-09", "sentiment_prev_from": "2026-08-26", "sentiment_prev_to": "2026-09-09",
 "selection": {"company_limit": 12, "topic_limit": 12, "total_company_count": 11, "total_topic_count": 13,
               "selected_company_count": 11, "selected_topic_count": 12, "companies_explicit": false, "topics_explicit": false},
 "ranges": {"…": "…"},
 "filters": {"models": [], "markets": [], "tag_ids": [], "tagmode": "or", "domain": null, "companies": [], "topics": []},
 "generated_at": "2026-10-09T10:58:36Z", "cached": false, "stale": false}
```

Erste Zeile (echt): Topic SUV, Marke VW.

```json
{"topic_id": "8daee9bb-…", "topic_name": "SUV", "topic_emoji": null, "topic_position": 1, "topic_hex_light": "#6d28d9", "topic_hex_dark": "#6d28d9",
 "company_id": "666761a9-…", "company_name": "VW", "role": "competitor", "company_position": 1,
 "logo_url": "https://www.google.com/s2/favicons?domain=volkswagen.de&sz=64",
 "visibility_pct": 40.78, "visibility_prev_pct": 41.78, "visibility_delta_pct": -1.00,
 "avg_rank": 4.64, "avg_rank_prev": 4.50, "avg_rank_delta": 0.14,
 "sentiment": 75.46, "sentiment_prev": 72.87, "sentiment_delta": 2.59,
 "mentions": 984, "mentions_prev": 460, "total_runs_topic_company_now": 2413, "total_runs_topic_company_prev": 1101,
 "heat_value_visibility": 0.4368, "heat_value_rank": 0.8855, "heat_value_sentiment": 0.6405}
```

Bei 90 Tagen zeigt `meta`: `date_from` 2026-07-12, `prev_from` 2026-06-12, `prev_to` 2026-07-11, `sentiment_from` 2026-09-10 und `sentiment_prev_from` 2026-06-12. Die Vorperiode ist also 30 Tage lang, das Sentiment läuft über die letzten 30 Tage.

`performance_company_chart_v1(877c, eigene Marke)`, echt:

```json
{"meta": {"team_id": "877c…", "company_id": "87468f49-…", "mode": "visibility", "granularity": "day", "timezone": "Europe/Berlin",
          "date_from": "2026-09-10", "date_to": "2026-10-09", "points": 30,
          "filters": {"models": [], "markets": [], "tag_ids": [], "tagmode": "or"},
          "generated_at": "2026-10-09T10:58:52Z", "cached": false, "stale": false},
 "rows": [{"day": "2026-09-10", "value": 28.42}, {"day": "2026-09-11", "value": 30.00}, {"day": "2026-09-12", "value": 29.09}]}
```

`performance_brand_variations_v1(877c, eigene Marke)`, echt:

```json
{"meta": {"team_id": "877c…", "company_id": "87468f49-…", "timezone": "Europe/Berlin", "date_from": "2026-09-10", "date_to": "2026-10-09",
          "filters": {"models": [], "markets": [], "tag_ids": [], "tagmode": "or"},
          "total_count": 392, "mentions_total": 3295, "order": "mentioned_count_desc,name_asc", "limit": 1000, "offset": 0,
          "generated_at": "2026-10-09T10:58:56Z", "cached": false, "stale": false},
 "rows": [{"name": "Mercedes-Benz", "mentioned_count": 570, "mentioned_runs": 570, "share_of_voice_pct": 17.30},
          {"name": "Mercedes", "mentioned_count": 172, "mentioned_runs": 172, "share_of_voice_pct": 5.22},
          {"name": "Mercedes E-Klasse T-Modell", "mentioned_count": 152, "mentioned_runs": 152, "share_of_voice_pct": 4.61}]}
```

---

## 12 XX000 „cannot find parent statement on pldbgapi2 call stack“

**Befund** aus den Postgres-Logs der letzten 24 h:

- 9 Fälle, verteilt auf:
  - PostgREST: `ingest_citations_batch_v6` (n8n) und `cached_citations_urls_v1`;
  - pg_cron: `warm_rpc_cache` und `_dash_refresh_v1`;
  - SQL-Editor und MCP: Tests.
- Bei 5 der 9 Fälle lief in der Nähe kein DDL, der Fehler tritt also nicht nur nach Deployments auf.
- Er hängt nicht an exception-Blöcken. Diese Annahme aus `rate_limit_fix_v1` war nur ein Teil der Wahrheit.
- Dieselbe Testfolge lief in Prod mehrfach fehlerfrei durch, der Fehler kommt also zufällig.

**Ursache:** Der Fehler entsteht in `plpgsql_check` 2.7. Supabase lädt die Erweiterung über `shared_preload_libraries` vor, in der Datenbank ist sie nicht einmal angelegt (`installed_version` null). Ihre Debug-Schicht pldbgapi2 verliert bei verschachtelten PL/pgSQL-Aufrufen gelegentlich den Überblick und bricht dann mit XX000 ab. Selbst beheben können wir das nicht: Die Einstellung lässt sich auf der gehosteten Plattform nicht ändern.

**Vorgehen:**

1. **Sofort:** Das Datenmodul und die Edge Functions wiederholen XX000 einmal (Abschnitt 1). Das ist sicher, weil die Transaktion abgebrochen wurde.
2. **Dauerhaft:** Ein Ticket an den Supabase-Support (Text unten), damit `plpgsql_check` aus `shared_preload_libraries` entfernt oder aktualisiert wird.
3. **Cron:** Die Refresh-Jobs springen bei einem Fehler zum nächsten Eintrag. Der übersprungene Eintrag wird im nächsten Lauf eine Minute später gerechnet.

Text für den Support (Englisch, Projekt `tgdossbsevnonssyuewp`):

> Our project intermittently fails with `XX000: cannot find parent statement on pldbgapi2 call stack` (also `pldbgapi2 statement call stack is broken`), about 5–9 times per day, in PostgREST RPCs, pg_cron jobs and the SQL editor, in PL/pgSQL functions without exception blocks. The message comes from plpgsql_check (2.7), which is in `shared_preload_libraries` although the extension is not installed in our database and we do not use it. Could you please remove `plpgsql_check` from `shared_preload_libraries` for this project, or upgrade it to a version that fixes the pldbgapi2 call stack handling? Postgres 17.6. Example log timestamps (UTC, 2026-10-09): 07:10:07, 07:10:18, 09:37:28, 10:06:02, 11:25:03.
