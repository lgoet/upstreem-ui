# Aufräumen nach dem Umbau (Bubble → Next.js)

Stand 10.10.2026. Grundlage sind:

- der Chatverlauf seit 28.09.;
- alle SQL-Dateien seit 02.10.;
- ein Abgleich mit der Prod-Datenbank am 10.10.

Die Liste wird bei jedem Bauschritt ergänzt.

**Grundregel:** Gelöscht wird erst, wenn Bubble abgeschaltet ist **und** die Messung in Abschnitt 10 zeigt, dass niemand mehr aufruft. Ausnahmen sind ausdrücklich markiert.

**Datenbank auf einen Blick (10.10.):**

- 531 Funktionen in `app`, davon 90 mit einer neueren Version;
- 113 Tabellen;
- 6 Cron-Jobs: `analyze-daily-tables`, `citations-cache-refresh`, `dashboard-cache-refresh`, `refresh-periodic-rollups`, `view-job-reaper`, `warm-rpc-cache`. Mit `prompt_insights_v1.sql` kommt `prompt-purge-worker` dazu (alle 10 Sekunden).

---

## 1 Schon vorbereitete Dateien, noch nicht ausgeführt

Geprüft am 10.10.: Die betroffenen Funktionen gibt es in Prod noch.

| Datei | Was sie tut | Wann |
|---|---|---|
| `rechte_bestand_dashboard.sql` (+ Rückweg) | Sperrt die direkten Aufrufe von `get_competition_overview_v24` und `get_competition_chart_v16` für anon und authenticated. Nimmt anon aus den alten Dashboard-Wrappern (`cached_competition_overview_v19`, `cached_competition_chart_v15`, `cached_citation_overview_v14`, `cached_mentions_overview_v1`, drei `clear_*_cache_v1`) und aus `get_power_dashboard_v1`. Sichert die Rechte vorher. | sobald Bubble das Dashboard nicht mehr nutzt |
| `mira_chat_sessions_v2_drop.sql` | löscht `get_mira_chat_sessions_v2` (seit 28.09. durch v3 ersetzt) | nach Prüfung der Aufrufe |
| `mentions_overview_v20_drop.sql` | löscht `get_mentions_overview_v20` (Wrapper nutzt v21); bricht ab, wenn noch etwas v20 ruft | jederzeit |
| `drop_old_topic_heatmaps.sql` / `topic_heatmap_v6_drop.sql` | löschen `get_topic_heatmap_v3` bis `v6` (aktuell ist v7) | nach Prüfung der Aufrufe |
| `shopping_5_altdaten.sql` | löscht die 157 Shopping-Altzeilen ohne Produkt-ID und ohne Quelle (Stand 02.10.) | Status offen: prüfen, ob schon gelaufen |
| `prompt_insights_v1.sql` (+ Rückweg) | neue Prompt-Insights-Seite, Löschen mit Hintergrundlauf (10.10.) | eingespielt 10.10. |
| `csv_export_schutz_v1.sql` (+ Rückweg) | Formelschutz in den fünf CSV-Exporten (10.10.) | eingespielt 10.10. |
| `prompt_insights_v1_fix_1.sql` (+ Rückweg) | Ergebnisse der Missbrauchstests: Unicode, Grabstein, Tagesgrenzen, Sperren, Schutz gelöschter Prompts, Löschlauf reihum (10.10.) | zum Einspielen bereit |
| `exports_v1.sql` (+ Rückweg) | neue Exporte auf der Rechnung der Oberfläche (10.10.) | zum Einspielen bereit |
| `ignore_prompt_run_v2_drop.sql` (+ Rückweg) | löscht `ignore_prompt_run_v2`, sichert vorher in `_aufraeumen_fn_backup` | jederzeit (laut Lukas ungenutzt) |
| `brands_sofort_rechte.sql` (+ Rückweg) | K1 Brands (11.10.): `get_team_companies_context_v2` nur noch service_role (n8n), `get_team_companies_v1` (beide Fassungen) nur für Mitglieder bzw. den eigenen Nutzer, sonst `[]`; anon/authenticated raus aus `delete_company_hard_v1` | eingespielt 11.10. |
| `brands_v1.sql` (+ Rückweg) | Brands-Seite: 6 neue Funktionen, Discover-Tagesverdichtung (4 Tabellen + Cron `brand-discover-rollup`), Marken löschen mit Hintergrundjob (`brand_purge_job` + Cron `brand-purge-worker`), Protokoll `brand_activity_log`; `get_team_companies_v1` liefert `role` (11.10.) | zum Einspielen bereit |
| `brands_v1_fix_1.sql` (+ Rückweg) | Discover: Zähler und Nenner aus denselben Tagen (neue Tabelle `discover_brand_runs_day`); Cron `brand-discover-rollup` alle 30 s mit 9 s Budget, Lösch-Jobs 7 s (DB-Timeout 12 s gilt für den ganzen CALL); Fehler-Tage nach 15 min erneut (11.10.) | zum Einspielen bereit |
| `rechte_bestand_brands.sql` (+ Rückweg) | anon aus 28 alten Brands-Funktionen, sichert Rechte in `_rechte_backup_brands` (im Rollback geprüft, 11.10.) | **später**, erst wenn Brands-Seite, Marken-Drawer, Marken-Editor und „Brand settings“ nicht mehr über Bubble laufen. Bubble ruft u. a. `get_company_detailed_overview_v4`/`_chart_v4` auch ohne Nutzertoken; vorher eingespielt bliebe der Drawer leer |
| `brands_logo_nur_eigene.sql` (+ Rückweg) | Logo-Override nur für die eigene Marke, nur `https://` oder `//` (Trigger `trg_enforce_own_brand_only`); `set_own_brand_settings_v5` bekommt `search_path` (11.10.) | eingespielt 11.10. |
| `settings_sofort.sql` (+ Rückweg) | Settings K2/K4/K5/K6 (11.10.): `create_team_with_brand`/`create_or_get_team` gesichert und entfernt; Rechte `delete_team_v2`, `team_access`, `check_rate_limit` nur intern; `delete_team_v3` löscht weich + `team_purge_job` (30 Tage, Cron `team-purge-worker`), Stripe-Kündigung (Cron `team-billing-cancel`, pg_net); `billing_checkout_prepare_v1` + `billing_team_customer`; `create_team_invite_v1` mit Mengen und stabilen Meldungen; neue Protokoll-Ereignisse | eingespielt 11.10. (geprüft) |
| `teams_wiederherstellen.sql` (+ Rückweg) | stellt die 4 am 11.10. gelöschten Teams wieder auf „nicht gelöscht“ (Zugang bleibt `ended`, Abos gekündigt) | eingespielt 11.10. |

Bereits ausgeführt (die Funktionen sind weg): `mentions_overview_v19_drop`, `url_bundle_v6_drop`, `create_mira_source_recommendation_v2_drop`, `shopping_resolver_reste_drop`, `aufraeumen_audit_1` (Merchant-Resolver-Reste), `aufraeumen_citations_tests` (11 Zwischenstände der Citations-Funktionen).

## 2 Bubble-Funktionen, die durch neue Fassungen ersetzt sind

| Bereich | Alt (Bubble) | Neu (Next.js) | Achtung |
|---|---|---|---|
| Dashboard | `get_power_dashboard_v1`, `cached_competition_overview_v19`, `cached_competition_chart_v15`, `cached_mentions_overview_v1` | `cached_dashboard_overview_v1`, `cached_dashboard_visibility_v1`, `cached_dashboard_responses_v1`, `dashboard_chats_v1`, `dashboard_opportunities_v1`, `clear_dashboard_cache_v1` | `get_competition_overview_v24`, `get_competition_chart_v16`, `get_mentions_overview_v21` und `get_citation_overview_bundle_v26` sind die Rechenbasis bzw. Vergleichsbasis. Vor dem Löschen prüfen, ob `dashboard_*` sie aufruft. |
| Citations | `cached_citation_overview_v14`, `cached_citation_domains_v2`, `cached_citation_urls_v2`, `cached_citation_domain_urls_v1`, `cached_citations_insights_v1`/`v2` (beide noch mit anon) | `cached_citations_overview_v1`, `_domains_v1`, `_urls_v1`, `_domain_urls_v1`, `clear_citations_cache_v1` | die 23 internen `_citations_*` bleiben (Live-Weg und Cron) |
| A Performance | `get_topic_heatmap_v7`, `cached_topic_heatmap_v1`, `get_company_detailed_chart_v4`, `get_company_brand_name_variations_v2` | `performance_radar_v1`, `performance_company_chart_v1`, `performance_brand_variations_v1` | `_perf_radar_base_v1` ist eine Kopie von v7 und bleibt |
| B Opportunities | `update_source_recommendation_status_v1`, `…_bulk_v1`, `get_you_urls_v1`, `cached_list_source_recommendations_v1`, `list_source_recommendations_v3` | `opportunities_*_v1`, `dashboard_opportunities_v1` | `create_mira_source_recommendation_v3` und `build_source_recommendations_v11` **bleiben**, weil die neuen Funktionen sie aufrufen |
| E Teams | `get_team_portfolio_overview_v4`, `cached_…_v3`, `cached_…_v4` | `teams_portfolio_v1` | |
| C Prompt Research | `list_prompt_research_jobs_v1`, `get_prompt_research_result_v1`, `manage_suggested_prompts_v1`, `delete_prompt_research_job_v1` | `prompt_research_*_v1` | `insert_suggested_prompts_with_tags_v2` und `prune_prompt_research_jobs_v1` **bleiben** (n8n v2) |
| Exporte (10.10.) | `export_brands_v1`, `export_domains_v1`, `export_urls_v1`, `export_prompt_runs_v1`, `export_prompts_full_v2` (rechnen anders als die Oberfläche, siehe `EXPORT_AUDIT_10_10.md`; nutzen den alten `check_rate_limit`) | `export_citations_domains_v1`, `export_citations_urls_v1`, `export_prompts_v1`, `export_responses_v1` | Für `export_brands_v1` gibt es noch keine neue Fassung (nicht Teil des Audits). |
| Prompt Insights (10.10.) | `cached_prompt_insights_alltime_v17`/`v18`, `get_prompt_insights_alltime_v19`/`v20`, `cached_prompt_topics_grouped_v1`, `get_prompt_topics_grouped_v1`, `resolve_prompt_ids_v1`, `create_prompt_with_tags` (ohne Nummer, `v3`, `v4`), `create_tag`, `update_tag`, `delete_tag`, `assign_tags_bulk`, `set_prompts_active`, `set_prompts_inactive`, **`delete_prompts_v2` und `delete_prompts_v3`**, `get_tags`/`get_tags_v2`, `get_team_plan_quota`/`_v2`, `clear_prompt_insights_cache_v1`, `rpc_cache`-Einträge `prompt_insights_v20`/`prompt_topics_grouped_v1` | `cached_prompts_list_v1`, `cached_prompts_groups_v1`, `prompts_page_meta_v1`, `prompts_add_v1`, `prompt_topics_set_v1`, `prompts_bulk_v1`, `topic_save_v1`, `topic_delete_v1`, `prompts_refresh_v1`, `prompts_purge_status_v1` | Die neuen Schreibfunktionen leeren noch die Bubble-Caches (`rpc_cache`). Diese Zeilen in `_pi_clear_caches_v1` fallen mit Bubble weg. `get_markets_v2` prüfen, ob Next.js es noch braucht. |
| D Mira | `get_mira_chat_sessions_v2`/`v3`, `cached_mira_chat_sessions_v1`, `get_mira_chat_messages_v2`, `set_mira_chat_session_pinned_v1`, `rename_mira_chat_session_title_v1`, `delete_mira_chat_session_v1`, `create_`/`rename_`/`delete_mira_chat_project_v1`, `move_mira_chat_session_project_v1`, `get_mira_yesterday_top_entities_v1` + cached | `mira_*_v1` | Die n8n-Funktionen **bleiben**: `start_mira_chat_turn_v1`, `finish_mira_chat_turn_v2`, `fail_mira_chat_turn_from_error_v1`, `get_mira_chat_context_v1`, `update_mira_chat_session_title_v1`, `save_mira_chat_tool_call_v1`, `get_mira_message_export_payload_v1` und alle Werkzeuge `get_mira_*` |
| Response Detail | `get_mention_detail_v6`, `get_mention_detail_v7` (beide mit anon) | `get_mention_detail_v8` | v7 bleibt laut Absprache bis zur Umstellung |
| Einladungen | `get_team_invite_by_token_v1`/`v2`, `accept_team_invite_by_token_v1` | `get_team_invite_by_token_v3`, `accept_team_invite_by_token_v2` | v3 bleibt für anon (Landing-Page ohne Login) |
| Suche | `search_quick_actions_v1` (mit anon) | `search_quick_actions_v2` | v2 ist eine Hülle um `search_quick_actions_v2_raw` (Titel-Fix 06.10.) |
| Shopping, Ads | Umschlag `{"json": "<Text>"}`: `cached_shopping_*_v1` (4), `get_ads_*`/`list_ads_*` (6), `_ads_out_v1`, `js_json_envelope` | Next.js-Fassungen ohne Umschlag (noch zu bauen) | Der Umschlag existiert nur wegen Bubble Run-JS |
| Impact Events | Bubble-Connector mit Umschlag-Antworten | Next.js-Fassung prüfen | Die Funktionen selbst bleiben |
| Settings (Vorschlag 11.10., noch nicht gebaut) | `get_team_organisation_v4`, `get_team_invites_v1`, `get_team_audit_log_v1`, `get_team_model_settings_v1`, `update_team_model_setting_v1`, `manage_team_models_v1`, `set_own_brand_settings_v5`, `get_team_brand_header_v9` (für Your Brand), `create_team_invite_v1`, `resend_team_invite_v1`, `revoke_team_invite_v1`, `kick_team_member_v1`, `set_team_member_role_v1`, `leave_team_v1`, `delete_team_v2`/`v3`, `get_team_billing_status_v1`, `get_billing_plans_v1`; Edge `send-team-invite`, `create-billing-portal-session` | `settings_*_v1`, `team_*_v1`, `billing_*_v1`; Edge `team-invite-send`, `team-billing-portal`, `team-checkout`, `team-billing-cancel` | `get_team_brand_header_v9` nutzt auch der App-Kopf, erst prüfen. Nach der Umstellung den Hash-Pfad in `_invite_find_id_v1` entfernen (Link-Token = gespeicherter Hash). `create-onboarding-checkout` und `stripe-webhook` bleiben. Siehe `SETTINGS_V1_VORSCHLAG.md`. |
| Brands (gebaut 11.10.) | `cached_competition_overview_v19`/`chart_v15` (für die Brands-Ansicht), `get_inactive_competitors_v1`, `deactivate_competitor_v5`, `reactivate_competitor_v1`/`v2`, `add_competitor_v4`, `add_team_competitor_v1`, `cached_get_untracked_brand_candidates_v7`/`v8`, `get_untracked_brand_candidates_v7`/`v8`, `clear_cached_get_untracked_brand_candidates_v5`, `get_team_companies_v1` (beide), `get_companies`, `get_competitors_with_visibility`/`_ui` (kaputt) | Dashboard v1 für Chart/Tabelle, `brands_page_meta_v1`, `brands_set_status_v1`, `brand_add_v1`, `brands_delete_v1`, `cached_discover_brands_v1`, `discover_brands_refresh_v1` | `get_team_companies_context_v2` **bleibt** (n8n). `delete_company_hard_v1` bleibt für service_role. Der Editor (`get_company_edit_v2`, Alias-, Farb- und Namensfunktionen, `set_own_brand_settings_v5`) ist ein eigener Auftrag. |

## 3 Ältere Versionen (unabhängig von Bubble)

Gefunden am 10.10. Wenn kein Hinweis dabei steht, ist die neueste Version die aktuelle.

| Familie | alte Versionen in Prod | aktuell |
|---|---|---|
| `get_citation_domains_v` | v13, v14, v15, v16 (alle mit anon) | v17 |
| `get_citation_overview_bundle_v` | v20–v24 (mit anon), v25 | v26 |
| `get_competition_overview_v` | v19–v23 (mit anon) | v24 |
| `get_competition_chart_v` | v14, v15 | v16 |
| `get_mentions_overview_v` | v15–v20 | v21 |
| `get_topic_heatmap_v` | v3–v6 | v7 |
| `get_team_portfolio_overview_v` | v1–v3 | v4 |
| `get_company_detailed_chart_v` | v3 | v4 |
| `build_source_recommendations_v` | v10 (mit anon) | v11 |
| `ingest_prompt_run_v` | v6, v9 | v10. Mit n8n abgleichen, welche Version die Läufe schreibt. |
| `create_prompt_with_tags` | ohne Nummer, v3 | v4 |
| `onboarding_save_step1` | ohne Nummer | v2 |
| Citation-Type | `set_citation_type`, `apply_citation_types`, `finalize_citation_types`, `citation_type_job_next`/`_claim`/`_complete` | Laut Statistik (08.10.) ohne Aufrufe; Rechte seit 08.10. nur service_role. Kandidaten zum Löschen, wenn der Klassifizierer sie nicht nutzt. |

## 4 Übergangsbrücken, die nur wegen Bubble existieren

- **n8n, öffentliche Realtime-Kanäle:**
  - Ask Mira: die Knoten „Realtime …“ und „Payload … User“ (`mira_chat_<id>`, `mira_user_<id>`).
  - Error Handler: „Realtime Status1“, „Payload Error User“, „Realtime Error User“.
  - Prompt_Creator v2: „Realtime Status“ und „Realtime Error“ (`prompt_research_done`). Next.js nutzt `prompt_research_status` aus der DB.
- **`mira_emit_progress`, Blöcke 1 und 2** (öffentliche Kanäle). Block 3 (privat) bleibt.
- **n8n-Webhooks ohne Auth:**
  - `ask-mira-agent` und `mira-message-export-pdf`: Header-Auth einschalten (Schlüssel wird schon mitgeschickt).
  - Alten Workflow `Prompt_Creator` (Webhook `llm_prompt_analysis_18072025`) abschalten. Er hat dieselbe Parser-Schwäche wie v2 vor dem Fix.
- **CORS:** `https://llmoscout.bubbleapps.io` aus `start-job`, `mira-send` und `mira-export-pdf` entfernen.
- **Template-Escapes für Bubble:** `tpl_escape`, `js_safe_lite`, `js_json_envelope` und die doppelte Härtung in `_ads_out_v1`. `js_safe`, `js_safe_text` und `clean_title` **bleiben**.
- **anon-Rechte auf alten Funktionen:** Sie entfallen mit der Abschaltung (siehe Abschnitt 1, `rechte_bestand_dashboard.sql`).

## 5 Sicherungs- und Hilfstabellen

| Tabelle | Inhalt | Wann weg |
|---|---|---|
| `_titel_backup` (2.868 Zeilen, 4 MB) | Titel/Beschreibungen vor dem Titel-Aufräumen (06.10.) | sobald die Titel ein paar Tage unauffällig sind; schon jetzt möglich |
| `_titel_cleanup_result` | Ergebnis des einmaligen Aufräum-Jobs | jetzt |
| `_mira_fn_backup` | alte Mira-Funktionsdefinitionen | laut 02.10. „kann weg“ |
| `_onb_fix_backup` | Sicherung der manuellen CloudNine-Aktivierung (08.10.) | wenn CloudNine sicher läuft |
| `_aufraeumen_backup`, `_aufraeumen_fn_backup` | Definitionen und Rechte der bisherigen Aufräumrunden (Resolver, Citations, Citation-Type-Rechte) | erst ganz am Ende; das sind die Rückwege |

## 6 Struktur (eigene Runde, unabhängig von Bubble)

- **Doppelte Fremdschlüssel auf `recommendation_citation`:** `fk_rc_reco` und `recommendation_citation_recommendation_id_fkey` zeigen beide auf `recommendation(id)`, `fk_rc_url` und `recommendation_citation_url_fkey` beide auf `source_url(url)`. Jede Schreibung prüft doppelt.
- **16 doppelte Indexe:**
  - `source_domain`: 3 identische auf `domain_normalized`;
  - `source_url`: 2 auf `domain_normalized`;
  - `recommendation_citation`: 2 Paare;
  - `mira_chat_tool_call`: 2 Paare;
  - `rpc_cache`: expires;
  - je ein Paar auf `company`, `prompt`, `prompt_tag`, `daily_runs_by_model`, `prompt_run_ignore_log`, `staged_citation_urls`, `team_billing`, `team_brand_profile`, `user_notification_dismissal`.
  - Kosten: Speicher und Schreibzeit. Vor dem Löschen einzeln mit `pg_stat_user_indexes` prüfen.
- **Später, eigener Umbau:** Fragmente in URLs schon beim Ingest entfernen (Notiz vom 02.10.).

## 7 Sicherheit: nicht bis zur Abschaltung warten

Diese Funktionen kann heute jeder mit dem öffentlichen Schlüssel (anon) aufrufen:

- `ingest_prompt_run_v6`, `ingest_prompt_run_v9`, `ingest_prompt_run_v10`, `ingest_citations_batch_v6` (schreiben Läufe und Citations);
- `check_rate_limit`;
- `create_prompt_with_tags` (alle drei Fassungen).

Vor einer Änderung prüfen, mit welchem Schlüssel n8n schreibt. Ist es service_role, kann anon sofort weg.

- **Brands (gefunden 11.10., kritisch):** `get_team_companies_v1` und `get_team_companies_context_v2` gaben jedem mit dem öffentlichen Schlüssel Marken und Aliase eines Teams. Fix: `brands_sofort_rechte.sql` (eingespielt 11.10.). Außerdem: `set_own_brand_settings_v5` ohne `search_path` und ohne Rollenprüfung (setzt Name und Logo jeder Teamfirma, auch `javascript:`). Fix: `brands_logo_nur_eigene.sql`. Siehe `BRANDS_V1_VORSCHLAG.md`.
- **Settings (gefunden 11.10.):**
  - **kritisch:** `create_team_with_brand` und `create_or_get_team` sind für anon und authenticated offen. Jeder Angemeldete legt damit ohne Bezahlung ein Team an (er wird Owner) und schreibt in die globale `company`. 0 Aufrufe seit 05.09.2025.
  - **kritisch:** `send-team-invite` baut den Link aus `base_url` im Body und setzt den Teamnamen ungeschützt ins HTML. Damit lässt sich Phishing von der upstreem-Domain verschicken.
  - **hoch:** `delete_team_v2` ist für anon offen. `delete_team_v3` kündigt Stripe nicht und bricht bei Teams mit Läufen an FKs ab.
  - **niedrig:** `team_access` liefert jedem Angemeldeten den Zugangsstatus fremder Teams. `check_rate_limit` ist direkt aufrufbar.
  - Fix: Sofortdatei nach Freigabe, siehe `SETTINGS_V1_VORSCHLAG.md` Abschnitt 0 und 7.
  - `brands_logo_nur_eigene.sql` ist eingespielt (11.10., md5 geprüft).
- **RLS (gefunden 10.10., kritisch):** 19 Policies auf 16 Tabellen prüfen `tm.team_id = tm.team_id`, jeder angemeldete Nutzer liest damit `prompt`, `prompt_run`, `recommendation`, `tag`, `team_company` und Rollups aller Teams. Fix: `rls_fix_team_policies.sql` (im Rollback geprüft).

## 8 Was bleibt (nicht löschen)

- `view_job`, `_job_*`, Cron-Job `view-job-reaper`, Edge Functions `start-job`, `mira-send`, `mira-export-pdf`;
- alle Trigger mit `_broadcast_v1` und die Policy `mira_user_can_receive`;
- `user_settings.mira_settings`;
- `dashboard_cache`, `citations_cache`, `rpc_cache`, `rate_limit_hit` (räumen sich selbst auf);
- die Trigger mit `clean_title` auf `source_url` und `response_source`;
- aus `prompt_insights_v1`:
  - Tabellen `prompt_activity_log` (Protokoll, auch Originaltexte gelöschter Prompts) und `prompt_purge_job`;
  - Feld `prompt.deleted_at`;
  - Cron-Job `prompt-purge-worker`, Prozedur `_pi_purge_worker_v1` und Trigger `prompt_purge_job_broadcast_v1`;
  - alle `_pi_*` (auch `_pi_norm_v1`, `_pi_strip_invisible_v1`, `_pi_daily_v1`, `_pi_purge_tick_v1`) und der Trigger `prompt_deleted_guard_v1`;
- `csv_safe_v1`, `_ex_require_v1` und die neuen `export_*_v1`.
- aus `brands_v1`: Tabellen `brand_activity_log`, `brand_purge_job`, `discover_brand_day`, `discover_brand_runs_day` (fix_1), `discover_brand_name_day`, `discover_brand_domain_day`, `discover_brand_state`; alle `_br_*`; Cron-Jobs `brand-discover-rollup` und `brand-purge-worker`.

Testreste: keine. Alle Prod-Tests liefen in zurückgerollten Transaktionen. Die Dateien in `_build/` und die `check_*.sql` liegen nur im Ordner, nicht in der Datenbank.

## 9 Bei Bedarf prüfen

- `rate_limit` (78 Zeilen, alter Rate-Limiter `check_rate_limit`) neben `rate_limit_hit` (neu, `_rl_hit_v1`): Wer nutzt noch den alten?
- `get_mira_yesterday_top_entities_v1` und `cached_…`: von Next.js gebraucht?
- **`ignore_prompt_run_v2`:** wird laut Lukas nicht mehr genutzt (10.10.). Löschdatei `ignore_prompt_run_v2_drop.sql` mit Sicherung und Rückweg liegt bereit, im Rollback geprüft. Sie war für anon ausführbar und hätte wegen eines nicht vorhandenen `updated_at` abgebrochen. `ignore_prompt_run` ohne Nummer gibt es auch noch, ebenfalls für anon ausführbar.
- **Alte Exporte** (`export_*`) nutzen noch den alten Rate-Limiter `check_rate_limit` (der mit den Deadlocks). Beim Umbau der Exporte auf `_rl_hit_v1` umstellen.
- **Prompt-Löschen:** `last_seen_run_at` in den Team-Rollups wird nicht zurückgerechnet. Die Topic-Rollups werden über die aktuellen Topics des Prompts abgezogen, wie bei `ignore_prompt_run_v2`. Hatte ein Prompt früher andere Topics, bleiben dort Reste. Sie verschwinden beim nächsten `refresh_periodic_rollups` für Wochen und Monate; Tage bleiben.
- **`prompt_purge_job`:** alte Aufträge mit `success` nach ein paar Monaten löschen (Inhalt: nur IDs und Zähler).

- **plpgsql_check (Plattform):** wird von Supabase vorgeladen und verursacht seit 08.10. sporadisch `XX000 … pldbgapi2 …`. Support-Ticket (Text in `NACHTRAG_1_BRANDS_DASHBOARD.md`): aus `shared_preload_libraries` nehmen oder aktualisieren.
- **Einladungen:** 4 Einladungen stehen auf `pending`, obwohl sie abgelaufen sind. Der Status wird nie auf `expired` gesetzt. Sie sperren eine neue Einladung an dieselbe Adresse (eindeutiger Index auf pending). Mit `team_invite_create_v1` erledigt.
- **FKs auf auth.users ohne on delete** (`team_audit_log`, `team_invite`): Ein Konto lässt sich nicht löschen, sobald es eingeladen oder protokolliert wurde. Beim Thema „Konto löschen“ lösen.
- **DB-Timeout 12 s** (`statement_timeout` der Datenbank) gilt auch für Cron-`CALL`s: Hintergrund-Jobs immer mit Budget unter 10 s planen.

- **Läufe ohne Zugang:** entschieden 11.10.: keine Läufe. `laeufe_nur_mit_zugang.sql` (+ Rückweg) filtert in `claim_due_prompt_model_jobs_v1`.
- **`claim_due_prompt_model_jobs_v1` ist für anon und authenticated ausführbar:** Ein Aufruf mit dem öffentlichen Schlüssel legt Jobs an (Kosten) und gibt Prompt-Texte aller Teams zurück. Erst prüfen, mit welchem Schlüssel n8n aufruft; ist es service_role, anon/authenticated entziehen (gilt auch für `claim_retry_…`, `mark_*`, `ingest_*`, siehe oben).
- **Edge-Rückwege:** `edge/orig/send-team-invite_v31.ts`, `edge/orig/stripe-webhook_v7.ts`.
- **Storage:** Das endgültige Löschen eines Teams entfernt `mira_knowledge_file`-Zeilen, aber keine Dateien im Storage-Bucket.

## 10 Vorgehen beim Aufräumen

1. Bubble abschalten und die Statistik zurücksetzen (`select pg_stat_statements_reset();`). Die heutigen Aufrufzahlen laufen seit 05.09.2025 und taugen nicht für „wird noch genutzt“.
2. **14 Tage messen.** Danach erzeuge ich die Liste der Funktionen ohne Aufruf. Abgeglichen wird sie mit den Abhängigkeiten: Wer ruft wen auf, welcher Trigger, welcher Cron-Job und welcher n8n-Workflow.
3. **Sicherung zuerst:** Jede Funktion wird vorher mit `pg_get_functiondef` in `_aufraeumen_fn_backup` geschrieben. Der Rückweg stellt sie daraus wieder her.
4. **In kleinen Stufen löschen**, je Bereich eine Datei mit Rückweg, dazwischen ein paar Tage Betrieb.
5. Tabellen, Spalten, Fremdschlüssel und Indexe nur nach ausdrücklicher Freigabe, Tabellen vorher als Kopie gesichert.

## Settings v1 Schritte 3–6 (11.10.2026)
- **Neu ersetzt alt (alt bleibt, bis Bubble aus ist):**
  - `team-invite-send` ersetzt `create_team_invite_v1` + `send-team-invite`.
  - `team-billing-portal` ersetzt `create-billing-portal-session`.
  - `team_member_remove_v1`/`team_member_role_v1` ersetzen die alten Bubble-Workflows (direkte Tabellenzugriffe).
  - `team_leave_v1`/`team_delete_v1` ersetzen `delete_team_v3` direkt aus der Seite.
- **`team_invite.send_tracked`:** false bei allen alten Einladungen (alter Weg), gilt als versendet. Nach dem Abschalten von Bubble bleibt das Feld; es zeigt dann nur noch den Altbestand.
- **Status-Check `team_invite`:** hat jetzt `send_failed`. Der Rückweg setzt den alten Check als NOT VALID.
- **Edge-Rückwege:** neue Functions einfach nicht mehr aufrufen; Quellen in `edge/team-invite-send`, `edge/team-billing-portal`.

## Response Detail (11.10.2026)
- **`response_detail_v1`** ersetzt `get_mention_detail_v8` für die neue Oberfläche. v8 bleibt, bis Bubble nichts mehr daraus liest.
- **`get_mention_detail`, `_v6` (keine Referenz im Repo), `_v2`–`_v5`:** nach dem Abschalten von Bubble löschen. Vorher mit `_aufraeumen_fn_backup` sichern.
- **`get_mention_detail_v7`:** wird von Shopping und Events in Bubble genutzt. Fällt weg, wenn diese Drawer umgebaut sind.
- **`require_team_access`:** ist `security definer` ohne `search_path`. Beim Aufräumen durch `_set_require_v1` + Zugangsprüfung ersetzen.

## URL Detail (12.10.2026)
- **`url_detail_v1`** ersetzt `get_url_bundle_v7`, `get_url_detailed_v*` und `get_url_citation_conversion_v*` für die neue Oberfläche. Diese bleiben, bis Bubble sie nicht mehr ruft; danach mit Sicherung löschen.
- **Die Responses im URL-Drawer** laufen in Bubble über `cached_mentions_overview_v1` mit `p_url`, neu über `cached_dashboard_responses_v1` mit `p_url`.
- **`reset_team_url_v1`:** Jedes Mitglied kann eine neue Analyse auslösen (Kosten). Beim Umbau auf owner/admin plus Ratenlimit umstellen oder entfernen.

## Prompt Detail (12.10.2026)
- **`prompt_detail_v1`** und die Seiten-RPCs mit `p_prompt_id` ersetzen `get_prompt_detail_bundle_v6`/`get_prompt_detail_bundle`, `cached_competition_chart_v15`, `cached_citation_overview_v14` und `cached_mentions_overview_v1` im Prompt-Drawer. Die alten bleiben, bis Bubble sie nicht mehr ruft.

## Brand Detail (12.10.2026)
- **`brand_detail_v1`** und die Seiten-RPCs mit `p_companies` (Overview) bzw. `p_brand` (Responses, Export, Citations) ersetzen im Brand-Drawer `get_company_detailed_overview_v4`, `get_company_detailed_chart_v3/v4`, `get_company_brand_name_variations_v2` und `get_citation_overview_bundle_v26` mit `p_company`. Die alten bleiben, bis Bubble sie nicht mehr ruft; danach mit Sicherung löschen. Bis dahin sind sie abgesichert (`brand_alt_absichern.sql`).
- **Marken-Kopien der Citations-Rechnung:** `_citations_fb_scope_v1`, `_citations_fb_overview_calc_v1`, `_citations_gb_domains_calc_v1`, `_citations_gb_urls_calc_v1`, `_citations_gb_n_v1` und `_citations_gb_tiles_v1` sind Textkopien der Originale.
  - Unterschiede: Sie lesen Temp-Tabellen statt der Rollups, und „erwähnt“ bezieht sich auf die Drawer-Marke.
  - **Wer die Originale ändert, muss die Kopien neu erzeugen** (`_build/brd/reps.py`, Paare in `COPIES`).
  - Beim Aufräumen prüfen, ob eine gemeinsame Fassung mit Tabellen-Schalter besser ist.
- **`_dash_responses_base_v1`:** `p_company` ist jetzt ein UND-Filter und die Messmarke, statt mit `p_company_ids` ODER-verknüpft zu sein. Einziger Aufrufer ist `_dash_responses_calc_v1`.
- **`get_company_edit_v2`:** liefert für fremde Marken `brand_not_found`. Falls Bubble es beim Hinzufügen neuer Wettbewerber vor dem Anlegen ruft, fällt das hier auf; Rückweg: `brand_alt_absichern_rueckweg.sql`.

## Domain-Drawer und Marken-Editor (13.10.2026)
- **Neu ersetzt alt:**
  - `domain_detail_v1`, `domain_detail_stats_v1` und `domain_url_share_v1` ersetzen `get_domain_detail_v3`–`v14` und `get_domain_url_share_over_time_v1`–`v6`.
  - `domain_classify_v1` ersetzt `add/remove_team_domain_override`.
  - `brand_edit_v1` und `brand_*_v1` ersetzen `get_company_edit_v1/v2`, `update_team_company_display_name_v1`, `add/toggle/delete_company_alias_v1` und `set/clear_company_color_override_v1`.
  - Die Altversionen bleiben, bis Bubble sie nicht mehr ruft; danach mit Sicherung löschen.
- **Altes `cached_citation_domain_urls_v1`** (ohne s) und `cached_citation_urls_v2`: Bubble-URL-Tabelle im Domain-Drawer. Neu ist `cached_citations_domain_urls_v1`.
- **Direkte Tabellenzugriffe aus Bubble** (`company_alias`, `team_brand_profile`, `team_company_settings`, `team_domain_override`, `v_company_alias_enriched`): Ohne Grant bzw. Policy liefern sie nichts. Nach dem Umbau prüfen, ob noch etwas liest.
- **Rückweg-Reihenfolge:** erst `domain_editor_alt_absichern_rueckweg.sql`, dann `domain_editor_v1_rueckweg.sql`, weil die Altversionen die neuen Helfer nutzen.
- **`brand_log_v1`:** live, die Oberfläche fehlt noch. Nicht entfernen. (n8n-Matching bleibt wie es ist, Entscheidung Lukas.)

## Onboarding (13.10.2026)
- Volle Liste: `onboarding_13_10/ONBOARDING_V1_VORSCHLAG.md`, Abschnitt D.
- **Gebaut 13.10.:** `onboarding_13_10/onboarding_v1.sql` (Rückweg `onboarding_v1_rueckweg.sql`), Vertrag `ONBOARDING_V1_VERTRAG.md`.
  - Edge `onboarding-start`, `onboarding-prompts`, `onboarding-checkout`, `onboarding-checkout-status` sind deployt.
  - `stripe-webhook` v9 ist deployt; Rückweg-Quelle `edge/stripe-webhook_v8_rueckweg.ts`.
  - n8n `ONBOARDING_V1`, `ONBOARDING_PROMPTS_V1` (Import nach `n8n/AENDERUNGEN_UND_IMPORT.md`).
  - Cron `onboarding-reaper` (jede Minute).
  - Die Hotfix-Dateien sind ersetzt und können gelöscht werden.
- **Nach der Umstellung abschalten:** Edge `create-onboarding-checkout`, n8n `ONBOARDING` und `ONBOARDING_PROMPTS` (alte, offene Webhooks), Bubble-Seite `onboarding-success`.
- **Beim Aufräumen:** Im Broadcast `onboarding_status` die Felder `status_label`, `last_error`, `updated_at` und `onboarding_id` entfernen (nur Bubble liest sie).
- **Nach dem Umbau löschen** (mit Sicherung):
  - `onboarding_get_bundle`, `onboarding_start_v1`, die drei `onboarding_set_*_selected_v1`, `get_billing_plans_v1`, `get_onboarding_completion_status_v1`;
  - `app.`/`public.onboarding_get_status`, `app.`/`public.onboarding_submit`, `app.onboarding_save_step1`/`_v2`, `public.onboarding_save_step1`/`_debug`;
  - nach der n8n-Umstellung `onboarding_prompts_claim_v1`, `onboarding_get_prompt_context_v1`, `onboarding_insert_prompts_v1` (Token optional).
- **Bleibt:** `onboarding_finalize_after_billing_v1` (Prompt-Planlimit ergänzen), `onboarding_restart_policy`, `onboarding_reset_limits_admin`, `get_my_teams_v4`, Trigger, alle sechs Tabellen.
- **In Bubble entfernen:** Aufrufe auf `onboarding_finalize*`, `onboarding_save_selection`, `get_my_teams`/`_v2`/`_v3` (gibt es nicht mehr).
- **Add Brand (13.10.):** Auftrag `add_brand_db_auftrag.md`. Sobald der Dialog überall `brand_add_v1` nutzt und `add_competitor_v4` eine Woche ohne Aufrufe ist: Bubble-Workflow „uabAddBrand“ und den n8n-Workflow zum Anlegen von Marken abschalten. Danach `add_competitor_v1`–`v4` und `add_team_competitor_v1` mit Sicherung löschen. `add_competitor_v4` trägt heute noch PUBLIC/anon-EXECUTE; anon bekommt nur eine Fehlermeldung.
- **Nach dem Umbau:** SELECT auf `onboarding_project` und INSERT auf `onboarding_suggested_prompt` für `authenticated` entziehen; 5 hängende Läufe aus 2025 prüfen.
