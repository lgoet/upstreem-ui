# Onboarding v1: Vertrag für die Oberfläche (13.10.2026)

Für Claude Code. Die Onboarding-Seite wird eine Komponente, die selbst lädt. Bubble liefert ihr keine Daten mehr. Echte Antworten: `onboarding_v1_echte_antworten.json`.

**Stand**
- Edge Functions: deployt.
- Datenbank: `onboarding_v1.sql`, Lukas spielt sie ein.
- n8n: zwei neue Workflows (`n8n/`), Lukas importiert sie.
- Die alte Bubble-Seite läuft unverändert weiter, bis die Komponente live ist.

**Aufrufe**
- **RPC:** `POST /rest/v1/rpc/<name>`, Header `Content-Profile: app`, Nutzer-JWT.
- **Edge:** `POST /functions/v1/<name>`, `Authorization: Bearer <Nutzer-JWT>`, `apikey`.
- **Fehler** kommen immer als echter HTTP-Fehler: `{code, message, hint, details}`.
  - `message` (bzw. `code` bei Edge) ist ein fester Code, `hint` der Grund.
  - Es gibt nie 200 mit `status: error`.

---

## 1. Ablauf und Phasen

| Phase | status | % | Bild | Wer setzt |
|---|---|---|---|---|
| 1 | submitted | 5 | Ladebild 1 | `onboarding-start` |
| 2 / 3 / 4 | processing | 20 / 45 / 70 | Ladebild 1 | n8n |
| 5 | ready | 100 | Auswahl Wettbewerber + Themen | n8n |
| 6 | processing | 60 | Ladebild 2 | `onboarding-prompts` |
| 7 | ready | 100 | Prompts, dann Plan | n8n |
| 7 | awaiting_billing | 100 | Kasse offen (`checkout_open: true`) | `onboarding-checkout` |
| 95 | finalizing | 95 | „Creating Workspace“ | Stripe-Webhook |
| 100 | completed | 100 | weiter ins Dashboard (`team_id`) | Stripe-Webhook |
| – | failed | – | Formular mit Fehlerband (`error_code`) | n8n / Aufräumer |

**Wohin beim Laden** (`onboarding_bundle_v1`):
- `row: null` → Formular.
- `submitted`/`processing` mit Phase 1–4 → Ladebild 1; Phase 6 → Ladebild 2.
- `ready` Phase 5 → Wettbewerber/Themen; Phase 7 → Prompts/Plan.
- `awaiting_billing` → Plan, Kasse offen.
- `finalizing` → „Creating Workspace“.
- `completed` → Dashboard.
- `failed` → Formular mit Fehlerband.

**Fehler eines Laufs** (`error_code`). Ein Promptlauf-Fehler setzt zurück auf `ready`, Phase 5 oder 7 (Auswahl bleibt).

| error_code | Satz (Vorschlag) |
|---|---|
| `website_unreachable` | Wir konnten die Website nicht erreichen. |
| `website_blocked` | Diese Adresse können wir nicht prüfen. |
| `website_empty` | Auf der Website haben wir keinen lesbaren Inhalt gefunden. |
| `website_invalid` | Die Adresse ist ungültig. |
| `analysis_failed` | Die Analyse ist fehlgeschlagen. Bitte noch einmal starten. |
| `prompts_failed` | Die Prompts konnten nicht erstellt werden. Bitte noch einmal versuchen. |
| `timeout` | Das hat zu lange gedauert. Bitte noch einmal starten. |
| `start_failed` | Der Start hat nicht geklappt. Bitte noch einmal versuchen. |
| `finalize_failed` / `finalize_state` | Zahlung erhalten, der Workspace wird gerade eingerichtet. Wir kümmern uns darum. |

- Ein Neustart nach `failed` zählt nicht als Neustart (`meta.restart.free_restart: true`).
- Hängende Läufe setzt ein Aufräumer nach 10 Minuten auf `timeout`.

## 2. Datenbank-RPCs (Nutzer)

### 2.1 `onboarding_bundle_v1()` → `{meta, row}`

**`meta`**
- `restart {has_onboarding, run_in_progress, allowed, reason, remaining, limit, window_hours, next_allowed_at, free_restart}`. Das ist das Tor „Continue / Start over“.
- `limits {name_max 60, website_max 255, competitors_max 5, topics_selected_max 8, own_topics_max 5, topic_max 40, prompts_selected_max 15, own_prompts_max 10, prompt_min 3, prompt_max 300, prompt_runs_per_day 5}`.
- `markets [{code, name, flag_url, language_code}]` (134).
- `timezones [IANA]` (488).
- `business_models [{code, label}]`; Codes `B2B`, `B2C`, `Hybrid`, `CitiesRegions`.

**`row`** (null ohne Onboarding)
- `project {onboarding_id, status, status_phase, progress_percent, error_code, company_name, website_input, website_url, website_domain, market, timezone, business_model (Code), industry, summary, selected_plan_id, billing_interval, checkout_open, team_id, created_at, updated_at}`.
- `competitors [{id, name, domain, favicon_url, selected}]` (bis 10).
- `topics [{id, name, description: null, hex_light, hex_dark, selected, is_own}]`, eigene Themen zuletzt.
- `prompts [{id, prompt_text, market, topic_ids, primary_topic_id, selected, is_own}]`, eigene zuletzt.

Altbestand (2025): Prompts ohne Thema kommen als `is_own: true`, `topic_ids: []`.

### 2.2 `onboarding_status_v1(p_onboarding)`
Antwort: `{meta: {data_as_of}, row: {onboarding_id, status, status_phase, progress_percent, error_code, team_id, checkout_open, updated_at}}`.

Nur zum Nachladen nach einem Wiederverbinden, nicht im Takt.

### 2.3 `onboarding_select_v1(p_onboarding, p_kind, p_ids uuid[])`
- `p_kind`: `competitors` (max 5), `topics` (max 8), `prompts` (max 15).
- Immer die **vollständige** Auswahl dieser Art. Fremde Ids fallen still heraus.
- Antwort: `{meta: {onboarding_id, kind, count, max}, rows: [ids]}`, also die gespeicherte Auswahl.
- Nur in `ready`/`awaiting_billing`, sonst `onboarding_busy`.
- Ändert die Auswahl bei offener Kasse nichts an der Kasse: Abgeschlossen wird mit dem Stand zum Zeitpunkt der Zahlung.

### 2.4 Eigene Prompts
- `onboarding_prompt_add_v1(p_onboarding, p_text, p_selected default true)`
  - nur in Phase 7;
  - 3–300 Zeichen, max. 10 eigene, Auswahl max. 15;
  - Antwort `{meta: {onboarding_id, own_count, own_max}, row: <Prompt wie im Bündel>}`.
- `onboarding_prompt_remove_v1(p_onboarding, p_prompt)`: nur eigene Prompts, sonst `onboarding_not_found` (hint `prompt`).

### 2.5 `onboarding_plans_v1()`
- Antwort: `{meta: {trial_eligible, currency}, rows: [{id, name, monthly_price_eur, yearly_price_eur, prompts_per_day, ai_responses_per_month, competitors_max_active, models_max_active, trial_days, trial_days_effective, sort_order}]}`.
- Anzeigen: `trial_days_effective`. Die Testphase gibt es nur monatlich und nur, wenn `trial_eligible`.

## 3. Edge Functions

CORS gilt für `https://app.upstreem.ai` und `https://llmoscout.bubbleapps.io`; `OPTIONS` antwortet 204.

### 3.1 `onboarding-start`
- **Body:** `{company_name, website, market, timezone, business_model}`.
  - `website` darf eine volle Adresse sein. Umlautdomains wandelt die Function selbst um.
  - `business_model` als Code.
- **Antworten:**
  - `202 {onboarding_id, status: "submitted", status_phase: 1, reused: false}`;
  - `200 {…, reused: true}`, wenn schon ein Lauf läuft.
- Danach Kanal `onboarding:<onboarding_id>` abonnieren.

### 3.2 `onboarding-prompts`
- **Body:** `{onboarding_id, new_topics?: string[]}`.
  - Vorher die Themenauswahl mit `onboarding_select_v1(…, 'topics', …)` speichern.
  - Eigene Themen (max 5 × 40) legt die Function ausgewählt an; ein vorhandener Name wird nur ausgewählt.
- **Antworten:**
  - `202 {…, status_phase: 6, reused: false}`;
  - `200 {…, reused: true}`, wenn die Auswahl gleich dem letzten fertigen Lauf ist (dann gleich zu den Prompts) oder schon ein Lauf läuft.
- **Fehler:**
  - `topics_empty`: kein Thema ausgewählt, daher 400;
  - `too_many_topics`, `too_many_own_topics`;
  - `onboarding_rate_limited` (hint `prompt_runs`: 5 Läufe je Tag).
- Eine offene Kasse wird dabei verworfen.

### 3.3 `onboarding-checkout`
- **Body:** `{onboarding_id, plan_id, billing_interval, return_path?}`; `return_path` ist `/onboarding` (Standard) oder `/version-test/onboarding`.
- **Antwort:** `200 {url, session_id, trial_days, plan_name, billing_interval}`. Danach `window.location = url`.
- Preis, Testphase und Auswahl kommen aus der Datenbank. Eine vorherige offene Kasse wird verworfen.
- **Rückkehr:**
  - `…/onboarding?checkout=success&session_id=cs_…` → Ladebild „Creating Workspace“, auf den Broadcast hören;
  - kommt binnen 20 s keine Phase 100, **einmal** `onboarding-checkout-status` rufen;
  - `…/onboarding?checkout=cancelled` → zurück zum Plan, Auswahl bleibt.

### 3.4 `onboarding-checkout-status`
- **Body:** `{session_id}`.
- **Antwort:** `200 {onboarding_id, status, status_phase, team_id, error_code, payment: "complete"|"open"|"expired"}`.
- Ist bezahlt, aber noch nicht abgeschlossen, schließt die Function selbst ab (dasselbe idempotente Finalize wie der Webhook).
- `status_phase: 100` mit `team_id` heißt: ins Dashboard dieses Teams.

## 4. Realtime
- **Kanal:** Broadcast `onboarding:<onboarding_id>`, Ereignis `onboarding_status`, öffentlich (die Id ist nicht erratbar).
- **Nutzlast lesen:** `status`, `status_phase`, `progress_percent`, `error_code`.
- `status_label`, `last_error`, `updated_at`, `onboarding_id` sind nur für die alte Bubble-Seite und fallen beim Aufräumen weg.

## 5. Fehler

| HTTP | code | hint |
|---|---|---|
| 401 | `onboarding_not_authenticated` | – |
| 404 | `onboarding_not_found` | – / `prompt` |
| 400 | `onboarding_invalid` | `name_empty`, `name_too_long`, `name_characters`, `website_invalid`, `website_blocked`, `website_unreachable`, `market`, `timezone`, `business_model`, `topic_empty`, `topic_too_long`, `topic_characters`, `too_many_own_topics`, `topics_empty`, `too_many_topics`, `too_many_competitors`, `too_many_prompts`, `too_many_prompts_selected`, `prompt_empty`, `prompt_too_long`, `prompt_characters`, `prompt_duplicate`, `prompts_empty`, `billing_interval`, `plan`, `kind` |
| 409 | `onboarding_busy` | status bzw. `state_changed` |
| 409 | `onboarding_checkout_open` | `paid` (die Kasse wurde bezahlt; nicht neu starten, Status abwarten) |
| 429 | `onboarding_rate_limited` | Sekunden, `global`, `website` oder `prompt_runs` |
| 429 | `onboarding_restart_limited` | `next_allowed_at` (ISO) |
| 400 | `edge_invalid_body` | Feldname |
| 502 | `edge_upstream_failed` | – / `stripe` |
| 503 | `edge_not_configured` | fehlende Secrets |

**Eingaberegeln** (die Oberfläche kann sie vorab prüfen, die DB prüft immer):
- **Name:** 1–60 Zeichen. Text wird NFKC-normalisiert; unsichtbare Zeichen werden entfernt. Abgewiesen werden `<` `>` Backtick, Backslash, `${`, Emoji und `=` `+` `-` `@` am Anfang.
- **Website:** nur http/https, Port 80/443, keine IP, keine internen Hosts.

## 6. Was Bubble danach nicht mehr tut
Folgende Bubble-Schritte entfallen:
- `onboarding_get_bundle`, `onboarding_start`, „RPC GetStatus“ (im Takt), „RPC Submit“, „RPC SaveStep1“, `get_billing_plans`;
- die drei `set_*_selected`;
- der API Connector zu beiden n8n-Webhooks;
- `create-onboarding-checkout`;
- die Seite `onboarding-success`;
- der direkte REST-INSERT eigener Prompts.

`get_my_teams_v4` bleibt (Dashboard-Knopf).
