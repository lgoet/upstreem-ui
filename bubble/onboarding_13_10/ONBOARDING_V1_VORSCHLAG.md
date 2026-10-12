# Onboarding: Bestandsaufnahme, Befunde, Aufräumliste und Vorschlag v1 (13.10.2026)

Antwort auf `onboarding_db_auftrag.md` und `onboarding_db_nachtrag_1.md`. Ich habe nur gelesen und in Transaktionen mit Rollback getestet; Prod ist unverändert.

**Dateien in diesem Ordner**

| Datei | Inhalt |
|---|---|
| `ONBOARDING_V1_VORSCHLAG.md` | dieses Dokument |
| `onboarding_get_bundle_echte_antworten.json` | echte, ungekürzte Antworten von `onboarding_get_bundle` für die Fälle a–g und einen Altbestand |
| `onboarding_hotfix_1.sql` | kleiner Sofort-Schritt (S1, S2, S5), ein Block, mit Testabfrage. **Lukas entscheidet.** |
| `onboarding_hotfix_1_rueckweg.sql` | Rückweg dazu (stellt md5 `5d883157…` und die alten Rechte wieder her) |

---

## A. Nachtrag 1 (Vorrang): „Onboarding wird nach der Kasse nie abgeschlossen“

### A1. `get_onboarding_completion_status_v1(p_onboarding_id uuid)`
- **Rechte:** `security definer`, nur `authenticated`; md5 `ed99ee117ae04cdd46af9ffadc5281b9`.
- **Sie liest nur.** Sie schreibt nichts: keinen Status, keine Phase, kein Team.
- **Antwort:** `{onboarding_id, status, status_phase, status_label, progress_percent, team_id, is_completed, last_error}`.
  - `is_completed = (status = 'completed' and team_id is not null)`.
- **Fremdes oder unbekanntes Onboarding:** Fehler P0001 „Onboarding not found or not owned by user“.
- **Aufrufe:** 18 seit dem letzten Statistik-Reset, alle `authenticated`.
- **Getestet im Rollback** an Onboarding `4aae98d9` (awaiting_billing):
  - vor Finalize: `is_completed: false`, `status: awaiting_billing`;
  - nach Finalize: `is_completed: true`, `status: completed`, `team_id` gesetzt.

### A2. Wer setzt den Abschluss?
- **Nur der Server.** `app.onboarding_finalize_after_billing_v1(…)` darf nur `service_role` ausführen; md5 `632136ef…`.
- **Aufrufer ist die Edge Function `stripe-webhook`** (v8, Signatur geprüft) beim Ereignis `checkout.session.completed`. Danach gleicht sie das Abo ab (`syncSubscriptionToSupabase`).
- **Finalize:**
  - sperrt die Zeile und ist idempotent: `completed` liefert `idempotent: true` und legt nichts doppelt an;
  - nimmt nur Onboardings in `awaiting_billing`, `billing_completed` oder `finalizing`;
  - setzt Phase 95 (`finalizing`) und legt dann an: Team, Owner, `team_billing`, Modelle nach Plan, Tags, eigene Firma, Wettbewerber (gekappt auf `competitors_max_active`), Tracking-Zeiträume, alle ausgewählten Prompts und `user_settings`;
  - endet mit Phase 100 (`completed`).
- **Die Kasse trägt alles, was der Webhook braucht:**
  - `metadata` auf Sitzung und Abo: `onboarding_id`, `user_id`, `billing_plan_id`, `billing_plan_name`, `billing_interval`, `source: 'onboarding'`;
  - `client_reference_id` fehlt, wird aber nicht gebraucht.
- **Abonnierte Ereignisse:** In Test ist `checkout.session.completed` eingerichtet; es kam am 08.10. an. Live kann ich nicht prüfen, weil es **keine einzige Live-Sitzung** gibt (alle `cs_test_…`).

### A3. Die echten Fälle
**In den letzten 30 Tagen gab es genau ein bezahltes Onboarding:** CloudNine `79c18838`, Nutzer `3c8b76c7`, Testmodus, 08.10.2026. Ablauf aus `onboarding_status_log` und den Function-Logs:

| Zeit (UTC) | Was |
|---|---|
| 10:48–10:51 | Neustart, Lauf Phase 1→5, Promptlauf 6→7 |
| 10:53:01 | Kasse geöffnet (`awaiting_billing`) |
| 10:53:39–56 | Webhook kommt an, Signatur gültig. Finalize bricht zweimal ab mit **`DELETE requires a WHERE clause`** (safeupdate in API-Sitzungen). Webhook antwortet 500; der Rohtext steht in `last_error` und ging per Broadcast an den Nutzer. |
| 11:05 | Lukas spielt `onboarding_fix_finalize_1.sql` ein (`delete … where true`) |
| 11:12:30 | Lukas schließt von Hand ab (`onboarding_aktivieren_79c18838.sql`): Phase 95 → 100 |

- **Seitdem gab es keinen bezahlten Checkout mehr.**
- **Der Fehler, den Lukas gesehen hat, ist dieser safeupdate-Abbruch; er ist seit 08.10. 11:05 behoben.** Im Rollback läuft Finalize heute durch:
  - Team, 5 Wettbewerber, 4 Prompts, `team_billing` aktiv, Zugang aktiv;
  - ein zweiter Aufruf ist idempotent.
- **Hängende bezahlte Onboardings: keine.**
  - `4aae98d9` (Zet Casino) steht seit 29.08. auf `awaiting_billing`. Das ist eine abgebrochene Test-Kasse, nicht bezahlt.
  - Die fünf `submitted`/`processing` aus 2025 sind nie bis zur Kasse gekommen.

**Was trotzdem schiefgehen kann (und vermutlich den Eindruck „nie abgeschlossen“ verstärkt):**
1. **Die Erfolgsseite liest einmal.** Stripe leitet sofort weiter, der Webhook kommt aber Sekunden später (am 08.10.: rund 38 s nach dem Öffnen der Kasse, nach dem Bezahlen wenige Sekunden). Liest die Seite `get_onboarding_completion_status_v1` nur einmal, sieht sie `awaiting_billing` und `is_completed: false`. Sie muss auf den Broadcast `onboarding:<id>` hören; der liefert Phase 95 und 100 schon heute.
2. **Rohtext:** Bei jedem Fehler in Finalize schreibt der Webhook die Postgres-Meldung in `last_error`. Die Seite zeigt sie wörtlich.
3. **Neustart bei offener Kasse** (Befund V4): Bezahlt der Nutzer danach die alte Kasse, scheitert Finalize. Dann ist bezahlt, aber kein Team da.
4. **`onboarding_submit`** setzt jeden Status auf `submitted`, auch `awaiting_billing` (Befund S2). Ruft Bubble „RPC Submit“ nach der Kasse noch einmal, scheitert Finalize genauso.

### A4. `success_url` / `cancel_url` (create-onboarding-checkout v9)
```
success_url = ${APP_URL}/onboarding-success?session_id={CHECKOUT_SESSION_ID}&onboarding_id=<id>
cancel_url  = ${APP_URL}/onboarding?onboarding_id=<id>&checkout_cancelled=1
```
- `APP_URL` ist **ein** Secret der Function; es gibt keinen Unterschied zwischen `version-test` und Live.
- Wer aus `version-test` bezahlt, landet auf der Seite, auf die `APP_URL` zeigt. Den Wert kann ich nicht lesen: bitte in Supabase → Edge Functions → Secrets nachsehen.
- **Vor dem Livegang** braucht es: Live-`STRIPE_SECRET_KEY`, einen Live-Webhook-Endpunkt mit `checkout.session.completed`, `customer.subscription.updated/deleted` und `invoice.payment_succeeded/failed` sowie dessen Signing-Secret, und die Live-Preis-IDs in `billing_plan`.

### A5. Missbrauch: Abschluss ohne Zahlung? **Nein** (Rollback-Test)
| Versuch | Ergebnis |
|---|---|
| `update onboarding_project set status='completed'` als Nutzer (REST) | 42501, kein UPDATE-Recht |
| `onboarding_finalize_after_billing_v1` als Nutzer | 42501, nur `service_role` |
| alte `onboarding_finalize`, `_v2`, `_v6`, `_v7` | existieren nicht mehr |
| `get_onboarding_completion_status_v1` | liest nur |

### A6. Hotfix (Lukas entscheidet)
- **DB:** `onboarding_hotfix_1.sql`, Teil B (`onboarding_submit` ändert nur noch `draft`/`failed`), zusammen mit Teil A und C, siehe B1.
- **Bubble-Seite `onboarding-success`:**
  - beim Laden `get_onboarding_completion_status_v1` einmal lesen;
  - dann den Kanal `onboarding:<onboarding_id>` (Ereignis `onboarding_status`) abonnieren;
  - bei `status_phase = 100` ins Dashboard des neuen Teams (`team_id` aus einem erneuten Lesen);
  - bei `status_phase` 95 ein Ladebild;
  - kommt nach 60 s nichts, einmal neu lesen und „Wir richten deinen Workspace ein, das dauert noch einen Moment“ zeigen.

  Das ist kein Takt-Abfragen, sondern Lesen beim Wiederverbinden.
- **stripe-webhook (Vorschlag, nicht deployt, weil bestehende Function):** in `last_error` statt `error.message` nur `finalize_failed` schreiben; den Rohtext nur in `console.error`.
- **Ein Testkauf jetzt** (Testmodus, Monatsplan mit Testphase) bestätigt den reparierten Weg. Prüfen: `status completed`, `team_id` gesetzt, Team im Team-Wechsler.

---

## B. Befunde nach Schwere

### B1. Sofort (Hotfix 1, getestet)
| Nr | Befund | Test (Rollback) | Maßnahme |
|---|---|---|---|
| **S1** | **Prompt- und Plan-Umgehung über REST.** `authenticated` hat INSERT/UPDATE/DELETE auf `onboarding_suggested_prompt` (Owner-Policies). Ein Nutzer fügte 60 Prompts mit beliebigem Text (`<script>`, `=HYPERLINK(…)`) ein, alle `selected`. Finalize übernahm alle 64 ins Team, auch beim kleinsten Plan. Die Grenze 15 aus `set_prompt_selected` greift dort nicht. | gelungen | **Hotfix A:** UPDATE und DELETE entzogen (0 Aufrufe aus Bubble). INSERT bleibt für die 51 Bubble-Aufrufe (eigene Prompts). Ein neuer Trigger prüft nur direkte REST-Einfügungen: Status `ready`/`awaiting_billing`, 3–300 Zeichen, kein `<` `>`, kein Formel-Anfang, keine unsichtbaren Zeichen, höchstens 10 eigene Prompts, höchstens 15 ausgewählte. |
| **S2** | **`app.onboarding_submit` setzt jeden Status auf `submitted`**, auch `awaiting_billing` oder `completed`. Danach scheitert Finalize nach der Zahlung, und das Ladebild sperrt 15 Minuten. Eigenes Onboarding nur, also kein Fremdzugriff. | gelungen | **Hotfix B:** nur `draft`/`failed` → `submitted`; sonst bleibt der Status und wird zurückgegeben (kein neuer Fehler für Bubble). |
| **S3** | **`last_error` als Rohtext** im Bild und im öffentlichen Broadcast. Am 08.10. sah der Nutzer „DELETE requires a WHERE clause“. | Log | stripe-webhook: Code statt Text (Vorschlag A6). Für n8n: mit dem Umbau. |
| **S4** | **Erfolgsseite liest einmal** (Rennen mit dem Webhook) | Ablauf | Bubble: Broadcast hören (A6) |
| **S5** | **anon/PUBLIC darf ausführen:** `public.onboarding_get_status`, `public.onboarding_save_step1`, `_debug`, `public.onboarding_submit`, `app.get_my_teams_v4`, `fn_onboarding_project_log`. anon bekommt nur leere Antworten oder Fehlertexte mit dem eigenen Input, aber das Recht gehört weg. | anon: 0 Zeilen / `ok:false` | **Hotfix C:** EXECUTE von anon und PUBLIC entzogen; `authenticated`/`service_role` behalten ihr Recht |

**Hotfix 1 im Rollback geprüft:**
- Bubble-Einfügung geht.
- `<script>`, Formel, unsichtbares Zeichen und 400 Zeichen werden abgewiesen.
- 60 auf einmal: abgewiesen. 9 gehen, der 10. eigene Prompt nicht.
- REST-UPDATE/DELETE: 42501.
- `set_prompt_selected` (RPC) und `onboarding_insert_prompts_v1` (n8n) laufen unverändert.
- Fremdes Onboarding: `onboarding_not_found`; Status `submitted`: `onboarding_busy`.
- `submit` auf `awaiting_billing` bleibt `awaiting_billing`, auf `draft` wird es `submitted`.
- `get_my_teams_v4` als Nutzer: 11 Teams.
- **Rückweg im selben Test:** md5 wieder `5d883157…`, Trigger weg, Rechte wie vorher.
- md5 nach dem Einspielen: `onboarding_submit` `c05b129335b8faa3f3752637bfa9c35e`, `_onb_prompt_guard_v1` `43e2e1e075f6cab9ac041636d38dceec`.

### B2. Vor dem Umbau (Entscheidung Lukas, noch nichts gebaut)
| Nr | Befund | Beleg | Vorschlag |
|---|---|---|---|
| **V1** | **Testphasen-Missbrauch:** Jede Monats-Kasse bekommt `trial_days` des Plans (14 Tage). Es gibt keine Prüfung je Nutzer, Website-Domain oder Karte. Neues Konto → neue Testphase; „Create new team“ → neue Testphase. Stripe-Kunde nur über `customer_email`, also jedes Mal ein neuer Kunde. | Code v9 | `trial_eligible` in der DB: keine frühere Testphase für Nutzer **und** `website_domain`. Die Kasse setzt `trial_period_days` nur dann. Kartenprüfung: Webhook `checkout.session.completed` liest `payment_method.card.fingerprint`; ist er schon bekannt, Testphase sofort beenden (`trial_end: now`). Das ist der einzige Weg gegen neue Konten. |
| **V2** | **Kosten-Spam im Promptlauf:** `onboarding_prompts_claim_v1` erlaubt einen neuen Lauf aus Phase 5 und 7 beliebig oft. Jeder Themenwechsel startet einen Modellaufruf. Keine Grenze je Nutzer oder Stunde. | Code | Grenze in der neuen Edge Function `onboarding-prompts`: höchstens 5 Promptläufe je Onboarding und Tag; gleiche Themenauswahl wie beim letzten fertigen Lauf → kein neuer Lauf. |
| **V3** | **SSRF-Eingaben werden angenommen:** `169.254.169.254`, `metadata.google.internal`, `10.0.0.1`, `tgdossbsevnonssyuewp.supabase.co` gehen durch `onboarding_start_v1` (nur „hat einen Punkt“). Abgewiesen wird nur `localhost`. Was der Crawler daraus macht, sehe ich erst im n8n-Export. | getestet | Prüfung in `onboarding-start` (Edge): nur Hostnamen mit gültiger TLD, keine IP, keine `*.internal`/`*.local`/`*.supabase.co`, DNS-Auflösung gegen private Netze. Im Crawler: keine Weiterleitung auf IPs/private Netze, Größen- und Zeitgrenze. |
| **V4** | **Neustart bei offener Kasse:** Aus `awaiting_billing` ist ein Neustart erlaubt. Er setzt `stripe_checkout_session_id` auf null, verwirft die Stripe-Sitzung aber nicht. Bezahlt der Nutzer im anderen Tab die alte Kasse, scheitert Finalize (falscher Status): bezahlt, kein Team, Webhook wiederholt 3 Tage lang mit 500. | Code | `onboarding-start` verwirft die offene Sitzung vor dem Neustart. Zusätzlich im Webhook: scheitert Finalize am Status, Code `finalize_state` schreiben und Lukas benachrichtigen statt 500 (sonst 3 Tage Wiederholungen). |
| **V5** | **Keine Fristen für hängende Läufe:** 5 Läufe hängen seit 2025 in `submitted`/`processing`. Das Ladebild dreht ewig. Nach 15 Minuten erlaubt die Policy einen Neustart, **zählt ihn aber**: Nicht zahlende Nutzer haben dann 7 Tage keinen weiteren. | Daten, Test | Aufräumer im `_job_reaper_v1`-Muster: Phase 1–4 nach 10 min, Phase 6 nach 10 min → `failed`, `error_code: timeout`. Ein Neustart nach `timeout` zählt nicht. |
| **V6** | **`run_token`:** steht im Browser (Rückgabe von `onboarding_start_v1`, lesbar per REST-SELECT auf die eigene Zeile). `onboarding_prompts_claim_v1`, `onboarding_get_prompt_context_v1` und `onboarding_insert_prompts_v1` nehmen `p_run_token = null` an und prüfen dann nichts. Nur `service_role` darf sie ausführen, das begrenzt den Schaden. | Test (`claim` ohne Token: ok) | Mit dem Umbau: Token Pflicht, nie im Browser. |
| **V7** | **Markenname ohne Grenze:** 5000 Zeichen wurden gespeichert. `<script>` und `=HYPERLINK(` bleiben stehen (`clean_input` entfernt nur Steuerzeichen, Backslash, Backtick). Geschäftsmodell und Zeitzone sind frei (`Evil`, `Mars/Phobos` gespeichert). Ein unbekannter Markt liefert den rohen FK-Fehler 23503. | getestet | Prüfung in `onboarding-start`/DB (Abschnitt G). Bis dahin ist die Oberfläche die einzige Grenze. |

### B3. Mit dem Umbau
- n8n-Auth und Schreibwege (Abschnitt F).
- Broadcast nur mit `{status, status_phase, progress_percent, error_code}`. Heute gehen `last_error`, `status_label` und `updated_at` öffentlich hinaus. Die Id ist nicht erratbar, aber Rohtext gehört nicht hinein.
- Eigene Themen als `text[]` statt Komma-Text.
- Finalize: Prompts auf `prompts_per_day` des Plans kappen (heute nur Wettbewerber gekappt). Nach Hotfix 1 kommen höchstens 15 + 10 eigene an; beim kleinsten Plan (50/Tag) passt das, aber die Grenze gehört in Finalize.
- `onboarding_project`: SELECT für `authenticated` entziehen, sobald alles über `onboarding_bundle_v1` läuft (Bubble liest heute ~2000-mal direkt).

---

## C. Bestandsaufnahme (Abschnitt 1)

### C1. Tabellen
| Tabelle | Schlüssel / FK | RLS und Rechte | Trigger |
|---|---|---|---|
| `onboarding_project` | PK `id`; **eine Zeile je Nutzer** (`onboarding_project_user_uniq`); `user_id` → `auth.users` ON DELETE CASCADE; `market` → `markets(alpha2)`; `team_id` → `team`; `selected_billing_plan_id` → `billing_plan`; `billing_interval` CHECK monthly/yearly | `authenticated` nur SELECT; Policies select own (zweifach) und `onboarding_ins_self` (INSERT, ohne Grant wirkungslos) | `trg_clean_text` (company_name, website_input, summary, brand_industry, business_model, timezone); `onboarding_project_broadcast_status`; `trg_onboarding_project_log`; in Publikation `supabase_realtime` |
| `onboarding_candidate_competitor` | FK onboarding | `authenticated` SELECT, RLS own | `trg_clean_text(name)` |
| `onboarding_candidate_topic` | FK onboarding; `id, name, hex_light, hex_dark, sort_order, selected` | RLS an, **keine Policy, kein Grant** (nur über RPCs) | `trg_clean_text(name)` |
| `onboarding_suggested_prompt` | FK onboarding, `onboarding_candidate_topic_id` (Haupt-Thema); `prompt_text, market, selected, estimated_volume, sort_order` | `authenticated` SELECT/INSERT/UPDATE/DELETE über Owner-Policies (**S1**) | `trg_clean_text(prompt_text)` |
| `onboarding_suggested_prompt_topic` | Prompt ↔ Thema (bis 3, `is_primary`), ON DELETE CASCADE | nur RPCs | – |
| `onboarding_status_log` | jede Status-/Phasenänderung; `note` = `last_error` oder `'restart'` (Zähler der Neustart-Grenze) | – | – |

**Verbindungen:**
- Ein gelöschtes Konto löscht das Onboarding (CASCADE).
- Nach dem Abschluss: `onboarding_project.team_id` → neues Team. Firma, Wettbewerber, Tags, Prompts und Zeitpläne legt Finalize als normale Team-Daten an; sie hängen danach nicht mehr am Onboarding.
- Es gibt kein Archiv: Ein Neustart überschreibt dieselbe Zeile.

### C2. Funktionen
Alle Definitionen mit md5 und Rechten liegen in `_build/onb/old/` (Arbeitsordner). Kurzfassung:

| Funktion | Art | anon | auth | Aufrufe* | liest / schreibt |
|---|---|---|---|---|---|
| `app.onboarding_get_bundle()` | definer | – | ✓ | 157 | liest alles (s. C3) |
| `app.onboarding_start_v1(name, website, market, business_model, timezone, mode)` | definer | – | ✓ | 36 | Upsert Projekt, löscht Kandidaten/Themen/Prompts, Log `restart`; gibt `run_token` zurück |
| `app.onboarding_restart_policy(uuid)` | definer, nur postgres | – | – | intern | rechnet `restart` |
| `app.onboarding_set_candidate_selected_v1(uuid, uuid, bool)` | definer | – | ✓ | 134 | max 5, Rate 120/min, Status ready/awaiting_billing |
| `app.onboarding_set_topic_selected_v1(text, jsonb, text)` | definer | – | ✓ | 60 | max 8 |
| `app.onboarding_set_prompt_selected_v1(text, text, text)` | definer | – | ✓ | 137 | max 15 |
| `app.get_billing_plans_v1()` | definer | – | ✓ | 120 | `billing_plan` aktiv |
| `app.billing_plans_v1(uuid)` | definer | – | ✓ | – | Settings-Fassung (Team) |
| `app.get_onboarding_completion_status_v1(uuid)` | definer | – | ✓ | 18 | liest (A1) |
| `app.onboarding_get_status(uuid)` | definer | – | ✓ | 19 170 | Status der eigenen Zeile (Bubble „RPC GetStatus“, im Takt) |
| `public.onboarding_get_status(uuid)` | definer | ✓ | ✓ | (in obiger Zahl enthalten) | Hülle |
| `app.onboarding_finalize_after_billing_v1(9 Parameter)` | definer, nur service_role | – | – | 13 | A2 |
| `app.onboarding_prompts_claim_v1(uuid, uuid)` | service_role | – | – | 7 | Phase 6; Token optional |
| `app.onboarding_get_prompt_context_v1(uuid, uuid)` | service_role | – | – | – | Kontext für den Prompt-WF; Token optional |
| `app.onboarding_insert_prompts_v1(uuid, jsonb, uuid)` | service_role | – | – | 7 | ersetzt Prompts, max 500 Zeichen, nur eigene Themen |
| `app.onboarding_reset_limits_admin(uuid)` | nur postgres | – | – | 0 | Neustart-Zähler löschen (Support) |
| `app.onboarding_submit(uuid)` / `public.onboarding_submit(jsonb)` | definer | –/✓ | ✓ | wenige | **S2** |
| `app.onboarding_save_step1`, `_v2` / `public.onboarding_save_step1(jsonb)`, `_debug` | definer | –/✓ | ✓ | 127/121/59 (alt) | alter Entwurfs-Ablauf; scheitert heute an `onboarding_project_user_uniq`, sobald es eine Zeile gibt |
| `app.get_my_teams_v4()` | definer | ✓ | ✓ | 20 574 | Teams des Nutzers; ohne Team 0 Zeilen |
| `app.onboarding_broadcast_status()` | Trigger | – | – | – | `realtime.send(…, 'onboarding:'||id, private=false)` |
| `app.fn_onboarding_project_log()` | Trigger | ✓ | ✓ | – | Log |

\* `pg_stat_statements` seit dem letzten Reset (kein festes 30-Tage-Fenster).

**Gibt es nicht mehr** (nur noch in der Statistik): `onboarding_finalize`, `_v2`, `_v6`, `_v7` (v7: 35 Aufrufe), `onboarding_save_selection_v1` (97), `onboarding_set_selection`, `get_my_teams`, `_v2`, `_v3`. Bubble-Aufrufe dorthin schlagen mit 404 fehl.

**Bubble-Namen aus 0.3:**

| Bubble | Funktion |
|---|---|
| `get_my_teams`, `get_my_teams copy 2` | `get_my_teams_v4` (zweiter Aufruf derselben Funktion) |
| `onboarding_start` | `onboarding_start_v1` |
| „RPC GetStatus“ | `onboarding_get_status` (19 170 Aufrufe: Takt-Abfrage) |
| „RPC SaveStep1“ | `public.onboarding_save_step1` (alt, tot im neuen Ablauf) |
| „RPC Submit“ | `onboarding_submit` (**S2**) |
| „RPC finalize_onboarding“ | existiert nicht mehr |
| `onboarding_save_selection` | existiert nicht mehr |

### C3. `onboarding_get_bundle` (echte Antworten: JSON-Datei)
- **Form:** `{project, industry, summary, restart, competitors[], topics[], prompts[]}`.
  - `project` ist die ganze Zeile ohne `run_token`, mit Stripe-URL und Session-Id.
  - Ohne Onboarding ist `project` null.
  - `prompts[].topics[]` sind die verknüpften Themen.
- **`restart` kommt aus `onboarding_restart_policy(auth.uid())`:**
  - zahlend (`user_has_paying_team`): 5 Neustarts je 24 h, sonst 1 je 7 Tage;
  - `used` = Einträge `note='restart'` im Fenster, `remaining = limit − used`;
  - `next_allowed_at` = ältester Eintrag + Fenster, nur wenn das Limit erreicht ist;
  - `run_in_progress` = `submitted`/`processing` und letzte Änderung < 15 min;
  - `allowed` = weder laufend noch Limit;
  - der erste Start zählt nicht.
- **Hinweis:** Der Altbestand (2025) hat Prompts ohne Thema, `market` null und `market_focus` gesetzt. Die Komponente muss beides vertragen, bis die Altzeilen weg sind.

### C4. `onboarding_start_v1`
- **Anlegen oder Zurücksetzen** derselben Zeile (Upsert auf `user_id`):
  - Status `submitted`, Phase 1, 5 %, `run_token = gen_random_uuid()`;
  - Kasse, Plan und `team_id` werden geleert;
  - Kandidaten, Themen und Prompts werden gelöscht;
  - ein Neustart schreibt `restart` ins Log.
- **Sperren:** Advisory-Lock je Nutzer, dadurch keine Doppelstarts. Neustart nach Policy (C3).
- **`run_token`:**
  - gilt, bis der nächste Start ihn ersetzt (kein Ablauf);
  - geprüft wird er nur, wenn n8n ihn mitschickt (V6).
- **Nutzer mit Teams** („Create new team“): dieselbe Zeile, dieselben Regeln, aber das Zahler-Limit (5/24 h). Das alte Team bleibt; `team_id` wird gelöst.
- **URL:** wird auf `https://<host>/` gekürzt; Port, Pfad und Zugangsdaten fallen weg. Der Host braucht nur einen Punkt (V3).

### C5/C6. n8n
- **Ohne Export kann ich nur sagen, was die DB sieht:**
  - n8n schreibt **direkt mit dem Service-Key** in die Tabellen: 1176 Schreibzugriffe von `service_role`, darunter INSERT in `onboarding_candidate_topic`, Kandidaten und `onboarding_project` (Phasen, `last_error`, `summary`, `brand_industry`);
  - Promptlauf über `prompts_claim_v1` → `get_prompt_context_v1` → `insert_prompts_v1` (je 7 Aufrufe).
- Ob n8n den Token mitschickt, steht nicht in der Statistik.
- Crawler, Modelle, Grenzen, Kosten und Weiterleitungen: siehe Export-Liste (Abschnitt H).
- Bubble ruft beide Webhooks über den API Connector. Ob der Aufruf serverseitig läuft (Adresse nicht im Browser), sieht Lukas im Connector („Private key in header“/„Use as Action“).
- **Laufzeit aus dem Log** (CloudNine 08.10.): großer Lauf 45 s (Phase 1→5), Promptlauf 77 s (6→7).

### C7. Realtime
- **Broadcast** aus dem Trigger, Thema `onboarding:<id>`, Ereignis `onboarding_status`, **öffentlich** (`private=false`).
- **Nutzlast:** `onboarding_id, status, status_phase, status_label, progress_percent, last_error, updated_at`.
- **Mithören:** Wer die Id kennt, hört mit. Die Id ist eine zufällige UUID, also nicht erratbar; sie steht aber in der Erfolgs-URL.
- Die Policy `onboarding_owner_can_receive` für private Kanäle existiert, wird aber nicht genutzt.
- Die Tabelle steht zusätzlich in der Publikation `supabase_realtime`. Postgres Changes sind wegen RLS nur für den Eigentümer sichtbar, werden aber nicht gebraucht.

### C8. Auswahl
- **Alle drei `set_*_selected` prüfen**, dass das Onboarding dem Nutzer gehört (sonst P0001) und dass die Ids zum Onboarding gehören. Fremde Ids fallen still heraus (`changed_count: 0`).
- **Grenzen:** 5 Wettbewerber, 8 Themen, 15 Prompts; Status `ready`/`awaiting_billing`.
- **Kein Planlimit** bei den Prompts.
- `onboarding_save_selection` war die alte Sammel-Speicherung; sie existiert nicht mehr.

### C9. Tarife und Kasse
- **`get_billing_plans_v1`:** aktive Zeilen aus `billing_plan`, nur `authenticated`.

  | Plan | €/Monat | Wettbewerber | Prompts/Tag | Testphase |
  |---|---|---|---|---|
  | Essential | 89 | 5 | 50 | 14 Tage |
  | Professional | 205 | 10 | 150 | 14 Tage |
  | Enterprise | 429 | 15 | 350 | keine |

- **`create-onboarding-checkout` liest aus dem Body nur** `onboarding_id`, `billing_plan_id`, `billing_interval`.
  - **`trial`, `brand_ids`, `topic_ids`, `prompt_ids` aus Bubble werden ignoriert.** Preis und Testphase kommen aus der DB, die Auswahl liest Finalize aus der DB.
  - Prüfungen: Eigentümer, Status `ready`/`awaiting_billing`, Phase ≥ 7, ≤ 5 Wettbewerber, ≥ 1 Prompt, gültiger Markt.
  - Eine offene alte Sitzung wird verworfen; der Status wird mit optimistischem Lock gesetzt.
- **Nach der Zahlung:** siehe A2/A3.
- **Abbruch:** zurück auf `/onboarding?…&checkout_cancelled=1`. Status bleibt `awaiting_billing`; Auswahl und Planwechsel sind möglich.

### C10. `get_my_teams_v4`
- Liefert die Teams des Nutzers mit Rolle, Favicon und `last_team_id`.
- Die Seite braucht es für den Dashboard-Knopf (nur mit Team) und die Weiterleitung.
- Ohne Team: 0 Zeilen.

### C11. Datenlage
| Frage | Zahl |
|---|---|
| Onboardings je Status | completed 32, ready 17, submitted 4, processing 1, awaiting_billing 1; draft 0, failed 0 |
| hängen > 1 h in laufender Phase | 5 (`7ac3fa5e`, `4395e1d7`, `41f98642`, `446c44f8`, `2e759767`, alle Sept./Okt. 2025) |
| mehr als ein Onboarding je Nutzer | unmöglich (eine Zeile je Nutzer); Neustarts gesamt 4, davon 1 in 30 Tagen |
| abgeschlossene mit Monatsplan (Testphase) | 3; Jahresplan 1; 28 aus dem Alt-Ablauf ohne Kasse |
| ohne Nutzer | 0 (CASCADE) |

---

## D. Aufräumliste (Abschnitt 2, nur Vorschlag)
**Regeln:**
- Löschen nur mit Sicherung in `_aufraeumen_fn_backup` und Rückweg.
- „Sofort“ heißt: 0 Aufrufe und kein Verweis aus Funktionen, Triggern, Cron oder Edge.

| Name | Zustand | Aufrufe | ersetzt durch | Vorschlag |
|---|---|---|---|---|
| `app.onboarding_get_bundle()` | in Gebrauch | 157 | `onboarding_bundle_v1` | nach Umbau löschen |
| `app.onboarding_start_v1` | in Gebrauch | 36 | Edge `onboarding-start` + `_onboarding_start_v2` | nach Umbau löschen |
| `app.onboarding_restart_policy` | intern | – | bleibt (von `onboarding-start` genutzt) | bleibt |
| `app.onboarding_set_candidate/topic/prompt_selected_v1` | in Gebrauch | 134/60/137 | `onboarding_select_v1` | nach Umbau löschen |
| `app.get_billing_plans_v1()` | in Gebrauch | 120 | `billing_plans_v1()` (neue Überladung ohne Team) | nach Umbau löschen |
| `app.billing_plans_v1(uuid)` | Settings | – | – | bleibt |
| `app.get_onboarding_completion_status_v1` | nur Bubble (Erfolgsseite) | 18 | `onboarding_status_v1` | nach Umbau löschen |
| `app.onboarding_get_status` + `public.onboarding_get_status` | nur Bubble (Takt) | 19 170 | Broadcast + `onboarding_status_v1` | nach Umbau löschen |
| `app.onboarding_submit` + `public.onboarding_submit` | nur Bubble | wenige | – (Start macht das) | nach Umbau löschen (vorher Hotfix B) |
| `app.onboarding_save_step1`, `_v2`, `public.onboarding_save_step1`, `public.onboarding_save_step1_debug` | tot im neuen Ablauf (scheitern an Unique) | Altzahlen | – | nach Umbau löschen; Verweise nur untereinander |
| `app.onboarding_finalize_after_billing_v1` | in Gebrauch (Webhook) | 13 | bleibt; Planlimit für Prompts ergänzen | bleibt |
| `app.onboarding_prompts_claim_v1`, `get_prompt_context_v1`, `insert_prompts_v1` | n8n | 7/–/7 | Token-Pflicht-Fassungen `_v2` | nach Umstellung n8n löschen |
| `app.onboarding_reset_limits_admin` | Support | 0 | – | bleibt |
| `app.get_my_teams_v4` | in Gebrauch, ganze App | 20 574 | – | bleibt |
| `app.onboarding_broadcast_status` | Trigger | – | neue Nutzlast | bleibt, mit Umbau ändern |
| `app.fn_onboarding_project_log` | Trigger | – | – | bleibt |
| `onboarding_finalize*`, `onboarding_save_selection_v1`, `onboarding_set_selection`, `get_my_teams`/`_v2`/`_v3` | existieren nicht | – | – | in Bubble entfernen |
| Tabellen (6) | in Gebrauch | – | – | bleiben; Altzeilen ohne Themen (`ready`, 2025) nach Umbau prüfen |
| Bubble-Kanal `onboarding_realtime` | in Gebrauch | – | `kanal('onboarding:<id>')` der Komponente | mit Umbau |

Tote Funktionen mit anon-Recht: `public.onboarding_save_step1_debug` → Befund S5 (Hotfix C).

---

## E. Missbrauchs- und Fehlerprüfung (Abschnitt 3)
Alle Tests in Transaktionen mit Rollback, mit echten Nutzern und JWT-Claims.

| # | Prüfung | Ergebnis | Schwere |
|---|---|---|---|
| 1 | fremde `onboarding_id` in `set_*`, `submit`, `completion_status` | P0001, gleicher Text für fremd und unbekannt (verrät nichts) | ok |
| 1 | fremde Ids per REST lesen/einfügen | 0 Zeilen / 42501 RLS | ok |
| 1 | fremde Kandidaten-/Prompt-Id im eigenen Onboarding | still ignoriert | ok |
| 1 | Realtime | öffentlich, Id nicht erratbar; Rohtext in der Nutzlast | S3 / mit Umbau |
| 2 | `run_token` | im Browser; n8n-Funktionen nehmen null | V6 |
| 2 | Webhook mit fremder Id | hängt von n8n ab (Export) | offen |
| 3 | Kosten großer Lauf | 2 Läufe je Konto und Woche (Start + 1 Neustart; zahlend 6/Tag). Neue Konten unbegrenzt. | V1/V2 |
| 3 | Kosten Promptlauf | unbegrenzt je Onboarding | **V2** |
| 4 | Testphasen | unbegrenzt über neue Konten/Teams; `trial` aus dem Browser wird ignoriert (gut) | **V1** |
| 5 | Name 5000 Zeichen, `<script>`, Formel | gespeichert | V7 |
| 5 | Website IP/Metadaten/intern/Supabase | angenommen; nur `localhost` abgewiesen | **V3** |
| 5 | Markt `XX` | roher FK-Fehler 23503 | V7 |
| 5 | Zeitzone/Geschäftsmodell frei | gespeichert | V7 |
| 6 | Prompt-Injection über Website/Name | Modelle bekommen Name und Website-Text; Prüfung der Prompts nur im Export möglich. `insert_prompts_v1` kappt 500 Zeichen, prüft aber keine Zeichen; Kandidaten schreibt n8n direkt. | mit Umbau |
| 6 | eigene Prompts per REST | beliebiger Text, beliebig viele | **S1** (Hotfix A) |
| 7 | `last_error` | Rohtext sichtbar (08.10. echt passiert) | **S3** |
| 8 | hängende Läufe | kein Aufräumer, Neustart zählt | V5 |
| 9 | Doppelstart / zwei Tabs | Advisory-Lock, zweiter Start `run_in_progress` | ok |
| 9 | Auswahl während Promptlauf | `set_*` erlaubt nur `ready`/`awaiting_billing` | ok |
| 9 | Neustart während Lauf | DB sperrt 15 min (nicht nur Browser) | ok |
| 9 | Neustart bei offener Kasse | erlaubt, alte Kasse bleibt bezahlbar | **V4** |
| 9 | Kasse zweimal | alte Sitzung wird verworfen | ok |
| 9 | Finalize zweimal | idempotent | ok |
| 9 | `submit` nach Kasse | setzt `submitted`, Finalize scheitert | **S2** (Hotfix B) |
| 10 | Finalize legt nur Eigenes an, liest Auswahl aus der DB | ja | ok |
| 10 | Planlimit Wettbewerber | gekappt | ok |
| 10 | Planlimit Prompts | nicht gekappt | S1 / mit Umbau |
| 11 | Konto gelöscht | Onboarding per CASCADE weg. Ein laufender n8n-Lauf schreibt dann ins Leere (Fehler in n8n). Team verlassen: Onboarding unberührt. | ok |

---

## F. n8n: Auth und Anbindung neu (Abschnitt 4)
1. **Edge `onboarding-start`** (CORS, Nutzer-JWT):
   - prüft das Formular (Regeln in G);
   - ruft `app._onboarding_start_v2(p_user, …)` (service_role, atomar: Policy, Upsert, Token, offene Stripe-Sitzung merken);
   - verwirft eine offene Kasse;
   - ruft den n8n-Webhook mit Header `X-Upstreem-Secret` (Function-Secret) und Body `{onboarding_id, run_token}`;
   - antwortet `{onboarding_id, status, status_phase, reused}`, ohne Token. Läuft schon einer: der laufende mit `reused: true`.
2. **Edge `onboarding-prompts`:**
   - liest die Themenauswahl aus der DB, eigene Themen als `text[]` (max 5 × 40, gleiche Zeichenprüfung);
   - gleiche Auswahl wie der letzte fertige Lauf → kein neuer Lauf (`reused: true`);
   - Grenze 5 Läufe je Onboarding und Tag;
   - ruft n8n wie oben.
3. **Rückmeldung von n8n** nur über `service_role`-Funktionen mit **Pflicht-Token** und erlaubten Übergängen:
   - `onboarding_run_update_v1(p_onboarding, p_run_token, p_phase, p_error_code)`;
   - `onboarding_write_candidates_v1(…, p_rows jsonb)`;
   - `onboarding_write_topics_v1(…)`;
   - `onboarding_insert_prompts_v2(…)`;
   - jede mit Zeichenprüfung der Modell-Ausgabe (Länge, keine Links/HTML, NFKC). Kein direkter Tabellenzugriff mehr.
4. **n8n-Webhooks:**
   - Header-Auth;
   - n8n ruft vor der Arbeit `onboarding_run_check_v1(id, token)`;
   - der alte offene Webhook bleibt, bis Bubble umgestellt ist, und wird dann abgeschaltet.
5. **Realtime:**
   - weiter **öffentlich** `onboarding:<id>`, Ereignis `onboarding_status`;
   - Nutzlast nur `{status, status_phase, progress_percent, error_code}`.

   Öffentlich reicht, weil die Id nicht erratbar ist und keine Inhalte mehr mitgehen; privat würde zusätzlich Realtime-Auth in der Komponente verlangen.

---

## G. Vorschlag v1 (Abschnitt 5, angepasst)
Wie im Auftrag, mit diesen Änderungen:
- **`onboarding_bundle_v1()`:**
  - wie beschrieben; `project` ohne Stripe-URL/Session-Id, dafür `checkout_open: bool`;
  - `meta.limits` zusätzlich mit `own_prompts_max: 10`, `prompts_selected_max: 15`, `competitors_max: 5`, `topics_selected_max: 8`;
  - `meta.restart` zusätzlich mit `reason`;
  - Listen der Märkte (aus `markets`), Zeitzonen (`pg_timezone_names`) und Geschäftsmodelle (`B2B`, `B2C`, `Hybrid`, `CitiesRegions`).
- **`onboarding_status_v1(p_onboarding)`** ersetzt `onboarding_get_status` und `get_onboarding_completion_status_v1`: `{status, status_phase, progress_percent, error_code, team_id}`.
- **`onboarding_select_v1(p_onboarding, p_kind, p_ids uuid[])`:**
  - `p_kind` ist `competitors`, `topics` oder `prompts`;
  - vollständige Auswahl, Grenzen wie oben; antwortet mit der gespeicherten Auswahl.
- **`onboarding_prompt_add_v1(p_onboarding, p_text)`** ersetzt den direkten REST-INSERT (gleiche Regeln wie Hotfix A). Danach INSERT für `authenticated` entziehen.
- **`billing_plans_v1()`** (Überladung ohne Team): Felder wie im Auftrag plus `trial_eligible` und `trial_days_effective` für diesen Nutzer.
- **Edge `create-onboarding-checkout` (überarbeitet):**
  - Body `{onboarding_id, plan_id, billing_interval}`; `billing_plan_id` wird übergangsweise weiter angenommen;
  - Testphase nur bei `trial_eligible`;
  - `success_url` → `/onboarding?checkout=success&session_id={CHECKOUT_SESSION_ID}`, `cancel_url` → `/onboarding?checkout=cancelled`;
  - Antwort `{url}`, Fehler als Codes.
- **Edge `onboarding-checkout-status` `{session_id}`:**
  - fragt Stripe;
  - ist die Sitzung bezahlt bzw. die Testphase angelegt und gehört sie dem Nutzer, ruft sie dasselbe idempotente Finalize;
  - Antwort `{status, status_phase, team_id}`.

  Damit ist die eigene Erfolgsseite überflüssig.
- **Eingaberegeln** (DB und Edge gleich):
  - Name: 1–60 Zeichen, NFKC, keine unsichtbaren/Bidi-Zeichen, kein `<>`, kein Formel-Anfang;
  - Website: `http(s)`, max 255, Host mit gültiger TLD, keine IP, keine internen Hosts, Punycode erlaubt;
  - Markt aus `markets`, Zeitzone aus `pg_timezone_names`, Geschäftsmodell aus der Liste;
  - abweisen statt kürzen.
- **Fehlercodes:**
  - wie im Auftrag;
  - zusätzlich `onboarding_invalid` mit hint `prompt_empty`, `prompt_too_long`, `prompt_characters`, `too_many_prompts`, `too_many_selected` (wie Hotfix A);
  - `PT409 onboarding_checkout_open` beim Neustart mit offener Kasse, falls die Kasse nicht verworfen werden kann.
- **`error_code` der Läufe:** `website_unreachable`, `website_blocked`, `website_empty`, `website_invalid`, `analysis_failed`, `prompts_failed`, `timeout`, `finalize_failed`, `finalize_state`.

---

## H. n8n-Exporte, die ich von Lukas brauche (1 und 2 sind am 13.10. gekommen, Auswertung in I)
1. **Onboarding-Start-Workflow** (Webhook `onboarding_start_workflow`): Crawler, Modelle, alle Supabase-Knoten.
2. **Prompt-Workflow** (Webhook `onboarding_prompts`): inklusive Anlegen eigener Themen.
3. **Unter-Workflows**, die diese beiden aufrufen (Crawler/Scraper, Favicon, Themenfarben), falls ausgelagert.
4. **Fehler-Workflow** (Error Trigger), falls einer `last_error` schreibt.
5. **Aus Bubble:** Screenshot der beiden API-Connector-Einträge (Methode, Header, „Private“-Haken). Werte und Schlüssel bitte schwärzen.
6. **Aus Bubble:** Screenshot der Seite `onboarding-success` (ist angekündigt).

Für den Abschluss nach der Kasse brauche ich keinen n8n-Export: Den macht allein `stripe-webhook`.

---

## I. Auswertung der n8n-Exporte (13.10.): `ONBOARDING` und `ONBOARDING_PROMPTS`

### I1. Was die Workflows tun
**ONBOARDING** (Webhook `POST /scrape_website_17062025`, antwortet sofort):

| Schritt | Was |
|---|---|
| `get_onboarding` | liest die Zeile per REST mit dem Service-Key (`supabaseApi`), auch `run_token` |
| `Guard` | Status muss `submitted`/`processing` sein. Token: **nur geprüft, wenn er mitkommt** („Security später scharf schalten“) |
| `Map: Links` | Firecrawl `/v1/map` auf `website_url` (15 s, bei Fehler 60 s) |
| `Filter Links` | max 150 Zeichen je URL, Tiefe ≤ 3, ohne Login/Checkout/Dateien. **Nicht** auf den eigenen Host begrenzt. |
| `Status: 2` | PATCH direkt auf `onboarding_project` |
| `Pick Top URLs` | DeepSeek v4 flash (Rückfall gpt-4o-mini) wählt ≤ 20 URLs |
| `CF Markdown` | Cloudflare Browser Rendering, bis zu 20 Seiten, je 60 s |
| `Build Page Text` | ein Textblock, max 40 000 Zeichen |
| `Status: 3` | PATCH |
| `Onboarding Analysis` | gpt-5.6-terra (Rückfall DeepSeek v4 pro). Nutzereingaben (Name, Modell, Markt) und Website-Text stehen in der User-Nachricht, die Regeln im System-Prompt. |
| `Status: 4` | PATCH |
| `Parse Competitors` → `Check Reachability` | **n8n selbst** ruft jede vom Modell genannte Domain per GET auf: Weiterleitungen an, TLS-Prüfung aus, 5 s |
| `post_competitors`, `post_topics`, `post_summary` | INSERT/PATCH direkt in die Tabellen |
| `Status: 5` | `ready` |

**ONBOARDING_PROMPTS** (Webhook `POST /onboarding_prompts`, antwortet sofort `accepted`):
1. `Claim Run` → `onboarding_prompts_claim_v1`; Token aus dem Body, sonst `null`.
2. `get_context` → `onboarding_get_prompt_context_v1`, liest die **ausgewählten Themen aus der DB**.
3. `Prompt Generation`: DeepSeek v4 flash über OpenRouter, Rückfall DeepSeek v4 pro.
4. `Parse Prompts`: 15 Stück, Themen-Ids gegen die Liste geprüft.
5. `onboarding_insert_prompts_v1`.
6. `Status: 7` per PATCH.

`topic_ids` und `new_topics` aus dem Bubble-Aufruf liest der Workflow **nicht**.

### I2. Neue Befunde
| Nr | Befund | Schwere |
|---|---|---|
| **N1** | **Eigene Themen gehen verloren.** Bubble schickt `new_topics` an `onboarding_prompts`, aber kein Knoten liest das Feld. Auch keine RPC legt Themen an: `set_topic_selected` ändert nur vorhandene, und `authenticated` hat kein INSERT auf `onboarding_candidate_topic`. Die 15 INSERTs in dieser Tabelle kommen alle aus dem ONBOARDING-Workflow. Getippte Themen erscheinen also nie und bekommen keine Prompts. | **live, sofort** (fachlich) |
| **N2** | **Hängt bei Phase 6 ohne Meldung.** `Claim Run` setzt Phase 6 **vor** der Kontext-Prüfung. Sind keine Themen ausgewählt (z. B. nur eigene, siehe N1), wirft `Guard` einen Fehler, und das Onboarding bleibt bei „Creating prompts“ stehen. Dasselbe passiert bei jedem Modell- oder Netzfehler. Beide Workflows schreiben nie `failed` und haben keinen Fehler-Workflow. Daher steht in der DB kein einziges `failed`, während 5 Läufe seit 2025 hängen. | **hoch** |
| **N3** | **Keine Auth an beiden Webhooks.** Der Token wird nur geprüft, wenn er mitkommt. Bubble schickt ihn an `onboarding_prompts` gar nicht (nur `topic_ids`, `new_topics`). Wer die Adresse und eine Onboarding-Id hat, startet Läufe. Die Ids sind nicht erratbar; das begrenzt es auf eigene Onboardings, also Kosten-Spam (V2). | hoch (mit Umbau) |
| **N4** | **Blinde SSRF aus n8n:** `Check Reachability` ruft vom Modell gelieferte Hosts direkt aus dem n8n-Netz auf, folgt Weiterleitungen und prüft kein TLS. Eine präparierte Website kann das Modell zu einer Domain bringen, die per Weiterleitung auf interne Ziele zeigt (Docker-Dienste wie `gotenberg:3000`, Metadaten-Adressen). Die Antwort wird nicht gespeichert, nur `reachable`; es bleibt bei GET-Aufrufen ins interne Netz. Die Website des Nutzers selbst holen Firecrawl und Cloudflare aus **deren** Netz; V3 ist dadurch kleiner als befürchtet. | mittel |
| **N5** | **Modell-Ausgaben ungeprüft gespeichert:** Wettbewerber-Namen haben **keine Längengrenze** (Themen 25, Summary 800, Industry 30). Prompt-Texte prüft nur die DB (500). Keine Zeichenprüfung gegen `<`, `>`, Formel-Anfang oder Links. Website-Text steht als Rohtext in der User-Nachricht, ohne Abgrenzung als Daten. | mittel |
| **N6** | **Doppelter Start:** Ein zweiter Aufruf von ONBOARDING während eines Laufs läuft parallel. Wettbewerber werden doppelt eingefügt (kein Unique auf Domain). Themen scheitern am Unique-Index (Fehler wird ignoriert). | mittel |
| **N7** | **Link-Filter ohne Host-Grenze:** Firecrawl-Links fremder Hosts können in die 20 gerenderten Seiten rutschen (Kosten, Fremdtext im Prompt). | niedrig |
| **N8** | **Status per Direkt-PATCH ohne Übergangsprüfung.** Ein später Lauf kann ein bereits neu gestartetes Onboarding auf `ready` setzen. Es wird nur nach Id gefiltert, nicht nach Token. | mittel (mit Umbau) |

**Kosten je Lauf** (Einheiten, nicht Euro):
- **Großer Lauf:** 1–2 Firecrawl-Map; bis zu 20 Cloudflare-Renderings (je bis 60 s); 1 kleiner Modellaufruf (URL-Liste); 1 großer (bis 40 000 Zeichen Seitentext plus 16 000 Zeichen System-Prompt); bis zu 16 GET-Prüfungen.
- **Promptlauf:** 1 Modellaufruf.
- **Gemessene Laufzeit** (CloudNine 08.10.): großer Lauf 45 s, Promptlauf 77 s.

### I3. Was sich am Vorschlag ändert
- **Sofort möglich, nur n8n, kein DB-Umbau:**
  1. Prompt-Workflow: `Claim Run` **nach** `get_context`/`Guard`.
  2. Fehlerpfad in beiden Workflows: bei jedem Fehler `status = 'failed'`, `last_error` = Code (`analysis_failed`, `prompts_failed`, `website_unreachable`, `timeout`), sonst nichts.
  3. In `Check Reachability`: `followRedirect: false` (oder jede Weiterleitung prüfen), `rejectUnauthorized: true`, keine IP-Literale, keine Hosts ohne öffentliche TLD.
  4. Wettbewerber-Namen auf 60 Zeichen kappen; `<`, `>` und Formel-Anfang entfernen.

  Das liefere ich als geänderte JSON, sobald du willst.
- **N1 braucht eine Entscheidung:**
  - **(a)** Eigene Themen legt die DB an: neue RPC `onboarding_topics_add_v1(p_onboarding, p_names text[])`, max 5 × 40, Zeichenprüfung, `selected = true`. Bubble ruft sie vor dem Webhook. Klein, sofort möglich.
  - **(b)** Erst mit dem Umbau über die Edge Function `onboarding-prompts` (Abschnitt F2), die genau das tut.

  Empfehlung (a), weil es heute live fehlt.
- **Mit dem Umbau (Abschnitt F)** fallen N3, N6 und N8 weg: Token Pflicht, Schreiben nur über `service_role`-RPCs mit Übergangsprüfung, Start und Prompts über Edge Functions mit geheimem Header.
- **Export-Liste (H):**
  - erledigt: 1 und 2;
  - Fehler-Workflow (4): gibt es laut Export nicht (kein `errorWorkflow` in den Einstellungen);
  - offen: 5 (API-Connector-Screenshots) und 6 (Erfolgsseite).
