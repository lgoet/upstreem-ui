# App-Start der Hauptseite: Bestandsaufnahme, Befunde, Aufräumliste, Vorschlag v1 (13.10.2026)

Antwort auf den Auftrag „App-Start der Hauptseite“. Ich habe nur gelesen und in Transaktionen mit Rollback getestet; Prod ist unverändert.

- Team: 877c (Merced Benz).
- Owner: `7bedb728`, Mitglied in 7 Teams.
- Mitglieder: `f25d8f66`, `b4b37c59`, `1fdb2924`.
- Nutzer ohne Team: `4a3601b2`.

**Aufrufzahlen:** `pg_stat_statements` zählt seit dem **05.09.2025** (letzter Reset). Ein echtes 30-Tage-Fenster gibt es nicht. Die Zahlen unten sind Summen seit dann und zeigen nur die Größenordnung.

---

## A. Befunde nach Schwere

### A1. Sofort (Vorschlag: eigener kleiner Schritt vor dem Umbau)
| Nr | Befund | Test | Vorschlag |
|---|---|---|---|
| **S1** | **`get_team_brand_header(uuid)`** (alte Fassung ohne Nummer) ist `security definer` **ohne jede Prüfung**. Jeder, auch ohne Login, liest für jede Team-Id: Teamname, eigene Marke, Favicon, Geschäftsmodell, Branche, freigeschaltete Modelle. 3.326 Aufrufe. | anon und Nicht-Mitglied: Daten von 877c geliefert | Mitgliedsprüfung wie v9 einbauen (Rückweg: alte Definition). anon und PUBLIC entziehen. |
| **S2** | **`user_settings` per REST frei beschreibbar:** `authenticated` (und anon) haben INSERT/UPDATE auf alle Spalten. Ein Nutzer setzt `last_team_id` auf ein fremdes Team und `mira_settings` auf beliebiges JSON. Fremde Daten sieht er dadurch nicht, aber jede Stelle, die `last_team_id` ohne Prüfung übernimmt, bekommt eine fremde Id. | `last_team_id` = 877c von einem Nicht-Mitglied gesetzt | Rechte auf Spalten beschränken: `authenticated` nur `SELECT` und `UPDATE (theme)`. Bubble schreibt per REST nur `theme` (1.600 Aufrufe). anon raus. |
| **S3** | **`get_team_plan_quota_v3`:** `security definer` **ohne `search_path`** (das Gate liest ihn). | Definition | `search_path` fest setzen (Rückweg: alte Definition) |
| **S4** | **`prepare_urls_for_scrape_v3`** ist `security definer` ohne Prüfung und für anon ausführbar. Ohne Login liest es die globalen Daten zu beliebigen URLs (Titel, Beschreibung, Favicon) und **schreibt** dabei für ein beliebiges Team (`last_seen`, `seen_count`). Gemeint ist es nur für n8n. | anon, im Rollback: Antwort mit Daten zu `adac.de` für Team 877c | Für anon, PUBLIC und authenticated sperren, nur service_role (n8n nutzt laut Export `prepare_urls_for_scrape_v6`). |

### A2. Vor dem Umbau
| Nr | Befund | Beleg |
|---|---|---|
| **V1** | **Zugang wird fast nirgends geprüft.** `team_access`/`require_team_access` (Abo-Zustand) nutzen nur die v1-Funktionen der letzten Runden (Dashboard, Citations, Brands, Prompt Insights, Mira, Drawer, Exporte v1, Shopping, Ads, Settings). **219 Funktionen mit `p_team` prüfen nur die Mitgliedschaft.** Ein Team ohne Zugang (abgelaufen, `past_due`, gelöscht, ohne Plan) liest über direkte RPC-Aufrufe alles, was diese Funktionen liefern. Darunter alles, was Bubble heute ruft: `get_tags*`, `get_markets_v2`, `get_team_companies_v1`, `get_team_brand_header_v9`, alte `get_competition_*`, `get_citation_*`, `get_mentions_overview_*`, `export_*_v1/_v2` (die `export`-Edge-Function nutzt sie) sowie Schreibfunktionen wie `create_prompt_with_tags*`, `set_prompts_active`, `create_tag`. **Vollständige Liste in Abschnitt E.** | Analyse der Definitionen; im Rollback getestet: gelöschtes Team liefert über `get_tags_v2` 13 Themen, über `get_team_brand_header_v9` alle Kopfdaten |
| **V2** | **Gelöschte Teams im Start:** `get_my_teams_v4` filtert `is_deleted` nicht und gibt `last_team_id` ungeprüft zurück. Ein gelöschtes Team (30 Tage Frist) erscheint in der Seitenleiste und kann aktiv werden. Dessen Daten liefern die alten Funktionen weiter (V1). | Rollback: 877c gelöscht, steht weiter an erster Stelle, `last_team_id` zeigt darauf |
| **V3** | **Lesen schreibt:** `get_team_brand_header_v9` schreibt bei jedem Lesen `user_settings.last_team_id` (15.351 Aufrufe). Zwei Tabs mit verschiedenen Teams überschreiben sich gegenseitig; der zuletzt geladene Tab „gewinnt“ beim nächsten Start. `get_team_model_settings_v1` legt beim ersten Lesen Modell-Zeilen an (auch Lesen mit Schreiben). | Definition |
| **V4** | **anon darf ausführen:** Über 150 dieser Funktionen sind für anon freigegeben. Im Test liefert anon fast überall Fehler oder leere Listen. Ausnahmen: S1 (Daten), `get_team_companies_v1(uuid)` (`[[]]`), `get_markets_v2`/`get_tags` (0 Zeilen). Kein Datenleck außer S1, aber das Recht gehört weg. | Tests 1–14 |
| **V5** | **Spam ohne Ratenlimit:** Nur `get_team_plan_quota*` (60/min) und `get_team_model_settings_v1` (30/min) haben eines. Die drei `clear_*_cache` (Mitglied genügt, anon ausführbar) leeren auf Zuruf den Cache des ganzen Teams; in einer Schleife erzwingt das ständige Neuberechnung (Last). Wegklicken (`dismiss_user_notification_v1`) und `get_my_teams_v4` haben keine Grenze. | Definitionen |
| **V6** | **Gate-Zustände unvollständig:** siehe A4.4. `no_plan` liefert gar kein Gate (Fehler vor dem Gate). Ein abgelaufener Trial mit Stripe-Status `trialing` gilt als `active`. `trial_ended` kommt nie vor (falsche Reihenfolge im `case`). Gekündigt mit Restlaufzeit heißt `ended`, obwohl `has_access: true`. | Rollback-Tests A4.4 |
| **V7** | **Benachrichtigungen:** `cta_url` wird nicht geprüft (`javascript:` und fremde Ziele möglich). Anlegen kann nur `service_role`, das Risiko ist daher klein, die Prüfung gehört trotzdem in die Lese-Funktion. Wegklicken geht für jede existierende Id (schreibt nur die eigene Zeile, unkritisch). | Definition |
| **V8** | **Profil aus `raw_user_meta_data`:** `display_name` und `avatar_url` kann der Nutzer selbst über GoTrue setzen. Die Oberfläche muss sie als Text behandeln; `avatar_url` nur mit `https`. Eine Tabelle `app.user_profile` gibt es nicht (die Dateien `profil_schritt*` sind nie eingespielt). | Datenlage: 92 von 108 Nutzern mit `display_name`, 5 mit `avatar_url`, 4 mit `picture` |

### A3. Mit dem Umbau
- Das JWT im Run-JS (`setUpstreemAuth`) entfällt. core nimmt das Token aus der Plugin-Sitzung.
- Die Edge Function **`export`**:
  - prüft das Token (`auth.getUser`) und ruft die Export-RPCs mit dem Nutzer-JWT, also mit Mitgliedsprüfung, **ohne** Zugangsprüfung (V1);
  - hat CORS `*`;
  - legt die Datei unter `exports/<team_id>/<user_id>/` ab, mit signierter URL für 5 Minuten.

  Mit dem Umbau auf `export_*` mit `_ex_require_v1` umstellen (gibt es seit 10.10.) und CORS auf die App-Herkünfte begrenzen.
- Alle übrigen Edge Functions (start-job, mira-*, onboarding-*, team-*) prüfen das Token selbst; Bubble gibt ihnen kein Token mehr mit.

---

## B. Bestandsaufnahme (Abschnitt 1)

### B1. Funktionen des Seitenaufbaus (Bubble-Name → Version, Rechte, Aufrufe, Laufzeit 877c)
Laufzeit gemessen in der Datenbank, Owner 7bedb728. Kalt = erster Aufruf in der Sitzung, warm = zweiter.

| Bubble | Funktion | anon | Aufrufe seit 09/2025 | kalt / warm | liest / schreibt |
|---|---|---|---|---|---|
| Tabelle `user_settings` (Data API) | REST SELECT, Filter `user_id` | (ja) | 21.016 SELECT, 1.600 UPDATE `theme` | 0,2 ms | `theme` |
| `get_my_teams` | `get_my_teams_v4()` | nein (seit Onboarding-Runde vorbereitet) | 20.576 (+3.536 alte Namen) | 5,8 / 1,6 ms | Teams, Rolle, Name-Override, Favicon, `last_team_id` |
| `get_team_brand_header` | `get_team_brand_header_v9(uuid)` | ja (Fehler) | 15.351 (alt ohne Nr. 3.326; v5 3.222; v6 1.131) | 4,5 / 3,5 ms | Team, eigene Marke, Standardmarkt, Modelle (aus dem **Plan**), Farbe, Summary; **schreibt `last_team_id`** |
| `get_team_plan_quota` | `get_team_plan_quota(uuid)` | ja (Fehler) | 32.664 | 3,4 / 1,0 ms | Plan, Zähler; **keine Gate-Felder** |
| (Gate) | `get_team_plan_quota_v3(uuid)` | nein | 534 | 3,1 / 1,6 ms | Zähler + `team_access` + `can_manage_billing`, `billing_interval` |
| `get_active_user_notification` | `get_active_user_notification_v1(uuid)` | ja (Fehler) | 6.920 | 1,4 / 0,4 ms | eine aktive, nicht weggeklickte Karte |
| `dismiss_user_notification` | `dismiss_user_notification_v1(uuid)` | ja | 22 | – | schreibt `user_notification_dismissal` |
| `get_markets` | `get_markets_v2(p_team, …, p_fulllist false)` | ja (0) | 6.726 | 2,2 / 1,6 ms | Märkte mit Prompts |
| „get_markets FULL“ | `get_markets_v2(…, p_fulllist true)` | ja (0) | (in obiger Zahl) | 2,5 / 2,5 ms | alle 134 Märkte (global, für alle Teams gleich) |
| `get_tags` | `get_tags_v2` (8.836) und `get_tags` (6.128) | v2 nein, alt ja | 14.964 | 2,6 / 1,3 ms | Themen mit Zähler |
| `get_team_companies` | `get_team_companies_v1(p_team, p_user)` | ja (`[]`) | 4.857 | 1,1 / 0,6 ms | `{id, name, logo}`; **ohne role, domain, color** |
| `list_impact_events` | `list_impact_events_v1(uuid,date,date)` | nein | 370 | 2,7 / 1,0 ms | prüft Zugang (`require_team_access`) |
| Modelle (Schritt 23) | aus `get_team_brand_header_v9.models` (Plan) bzw. `get_team_model_settings_v1` (2.441) | ja | – | 2,3 / 1,1 ms | v9: Modelle **des Plans**; Settings: Team-Einstellung. **Schreibt beim ersten Lesen.** |
| `team_portfolio_overview` | `cached_get_team_portfolio_overview_v4` (120), alt v1–v3 | ja | – | – | Teams-Seite; ersetzt durch `teams_portfolio_v1` (Teams-Runde) |
| `clear_prompt_insights_cache` / `clear_competition_overview_cache` / `clear_citation_overview_cache` | `*_v1(uuid)` | ja | 468 / 195 / 25 | <1 ms | leeren den Cache des Teams; Bubble ruft sie nach Änderungen (Prompt angelegt, Marke geändert), **nicht** beim Seitenaufbau |
| `search_quick_actions` | `search_quick_actions_v2` (347, Ø 973 ms) / v1 (274) | v2 nein / v1 ja | – | – | eigene Runde |
| `get_billing_plans` | `get_billing_plans_v1()` | nein | 120 | 1,2 ms | ersetzt durch `onboarding_plans_v1` / `billing_plans_v1(team)` |

**Kosten eines Starts heute:**
- 12–14 HTTP-Aufrufe: Tabelle, Teams, Header, Quota, Notification, 2 × Märkte, Themen, Marken, Events, Modelle, dazu Gate (Quota v3).
- In der Datenbank zusammen rund 30 ms kalt und 15 ms warm.
- Die Zeit geht in die Rundreisen. Bubble ruft die Schritte nacheinander, also 12–14 × Netz (je 50–150 ms).

### B2. `user_settings`
- **Spalten:** `user_id` (PK), `theme` (Enum dark|light|system), `last_team_id`, `mira_settings` jsonb, `created_at`, `updated_at`. 84 Zeilen.
- **RLS:** Eigene Zeile lesen, anlegen und ändern (Rolle `public`). Grants an **anon und authenticated** INSERT, SELECT, UPDATE (S2).
- **Lesen:** Bubble Data API (`theme`), `get_my_teams_v4` (`last_team_id`), `mira_settings_v1`.
- **Schreiben:**

  | Spalte | Wer |
  |---|---|
  | `theme` | Bubble REST |
  | `last_team_id` | `get_team_brand_header_v9`, `onboarding_finalize_after_billing_v1`, `_set_next_team_v1`, `team_member_remove_v1`, `delete_team_v2/_v3`, `_tp_*` (Purge), `admin_delete_team_hard_v1` |
  | `mira_settings` | `mira_settings_set_v1` |

- Ein ausdrücklicher Teamwechsel (`usnTeam`) schreibt heute **nicht selbst**. Er wirkt nur, weil der danach geladene Header `last_team_id` setzt.

### B3. Aktives Team heute
- `get_my_teams_v4` liefert alle Mitgliedschaften (auch gelöschte Teams), sortiert nach `created_at`, und in jeder Zeile dieselbe `last_team_id`.
- **Die Auswahl trifft Bubble:**
  - `?teamid=` vor `last_team_id` (wenn in der Liste), sonst das erste Team;
  - die Prüfung „existiert noch“ ist die Liste selbst.
- Fremde `?teamid=` oder `last_team_id` stehen nicht in der Liste und werden daher übergangen. Alle Datenfunktionen prüfen die Mitgliedschaft. Eine fremde Id liefert überall `forbidden`/`not a member` (gleicher Text für unbekannt und fremd, kein Unterschied in der Laufzeit messbar).
- **Gelöschte Teams** und **verlassene Teams:** Gelöschte stehen in der Liste (V2), verlassene nicht. **Offene Einladungen** gewähren nichts, solange sie nicht angenommen sind.

### B4. Zugang (Gate) je Zustand (`get_team_plan_quota_v3`, echte Antworten im Rollback)
| Zustand | `has_access` | `access_state` | Bemerkung |
|---|---|---|---|
| Plan ohne Stripe (877c, „Legacy Free“; alle Teams seit `teams_plan_legacy`) | true | `active` | `billing_interval: null` |
| ohne Plan (cf32814c) | – | – | **Fehler `no_billing_plan`**, kein Gate (V6). `require_team_access` sagt korrekt `team_access_no_plan`. |
| `past_due` | false | `past_due` | |
| `trialing`, Trial vorbei | **true** | **`active`** | V6. Stripe stellt den Status selbst um; bis dahin offen. |
| gekündigt, Ende vorbei | false | `ended` | `access_ended_at` gesetzt |
| gekündigt, Ende in 5 Tagen | true | **`ended`** | Bezeichnung irreführend (V6) |
| `incomplete` | false | `ended` | |
| gelöscht | false | `deleted` | `access_ended_at` = Löschzeitpunkt |

`trial_ended` und `unpaid` (als eigener Zustand) kommen nie vor.

### B5. Benachrichtigungen
- **Tabellen:**
  - `user_notification`: id, title, body, color, cta_label, cta_url, notification_type, priority, is_active, starts_at, ends_at, target_plan_ids, target_team_ids, created_at, updated_at. 1 Zeile, abgelaufen am 09.09.
  - `user_notification_dismissal`: user_id, notification_id, dismissed_at. 4 Zeilen.
  - RLS an, nur `service_role`. Anlegen nur über die Datenbank (kein RPC).
- **Auswahl:** aktiv, gestartet, nicht beendet, nicht weggeklickt; optional nach Team oder Plan gefiltert; die neueste zuerst; höchstens eine.
- **Wegklicken:** schreibt `(user_id, notification_id)`, doppelt ohne Wirkung. `priority` wird nicht beachtet (nur `starts_at`).

### B6. Modelle
- **Zwei Quellen:**
  - Header v9: alle Modelle **des Plans** (`billing_plan_model`), mit `is_active` aus dem Katalog als Text `'yes'/'no'`.
  - Settings: `team_model_setting` (welche das Team eingeschaltet hat).
- Der Filter „Modelle“ in der App braucht die **eingeschalteten** Modelle des Teams. Katalog: 5 Modelle; je Team 3–4 eingeschaltet.

### B7. Größe
| Teil | Ø je Team | Max | 877c |
|---|---|---|---|
| Themen | 6,1 | 14 | 13 |
| Märkte mit Prompts | 1,3 | 2 | 2 |
| Marken | 9,1 | 13 | 11 |
| Events | 0,1 | 1 | 0 |
| Modelle (eingeschaltet) | 3,2 | 4 | 3 |
| Teams je Nutzer | – | 11 | – |
| alle Märkte | 134 (global) | | |

Eine Startantwort für das größte Team liegt bei etwa 6–8 KB (ohne die globale Marktliste, die allein etwa 15 KB hat).

---

## C. Prüfung (Abschnitt 2), zusammengefasst
| Punkt | Ergebnis | Schwere |
|---|---|---|
| Fremdes Team über `?teamid=`, `last_team_id`, `p_team` | Lesen: überall `forbidden`. **Schreiben in `last_team_id`: ja, per REST** (S2) | S2 |
| Gelöschte Teams | erscheinen in der Liste und bleiben lesbar | V2, V1 |
| Lesen schreibt | Header v9, Modell-Settings | V3 |
| ohne Token | alte Header-Fassung liefert Daten | **S1** |
| Token im Browser | `export` prüft das Token; RPCs ohne Zugangsprüfung | A3 |
| Gate nur Anzeige | 219 Funktionen ohne Zugangsprüfung | **V1** |
| Spam | kaum Ratenlimits, `clear_*_cache` als Lasthebel | V5 |
| Fraud über „New Team“/Teamwechsel | **nein**: Ein neues Team entsteht nur über das Onboarding mit Kasse (v1, Testphase je Nutzer/Domain/Karte). Ein Teamwechsel gibt nur den Zugang des Ziel-Teams. | – |
| Abo abgelaufen, Start gecacht | Kein Cache überdauert den Zugangszustand (alles live). Aber V1: Die alten Funktionen liefern trotzdem. | V1 |
| `cta_url` | ungeprüft | V7 |
| Gelöschtes/verlassenes Team in offener Sitzung | Verlassen: nächster Aufruf `forbidden`. Gelöscht: bleibt lesbar bis zum Purge (V2). | V2 |

---

## D. Aufräumliste (Abschnitt 3, nur Vorschlag)
**Regel:** Löschen erst nach der Umstellung und einer Woche ohne Aufrufe, mit Sicherung in `_aufraeumen_fn_backup` und Rückweg.

| Name | Zustand | Aufrufe seit 09/2025 | ersetzt durch | Vorschlag |
|---|---|---|---|---|
| `get_team_brand_header(uuid)` (alt) | offen für alle (S1) | 3.326 | `app_start_v1` | sofort absichern, nach Umbau löschen |
| `get_team_brand_header_v9` | in Gebrauch, schreibt | 15.351 | `app_start_v1` | nach Umbau löschen |
| `get_my_teams_v4` | in Gebrauch | 20.576 | `app_start_v1.meta.teams` | nach Umbau löschen (Onboarding-Seite liest es noch, mit umstellen) |
| `get_team_plan_quota`, `_v2` | in Gebrauch / alt | 32.664 / – | `app_start_v1.row.quota` | nach Umbau löschen |
| `get_team_plan_quota_v3` | Gate | 534 | `app_start_v1.row.access` | `search_path` sofort (S3), nach Umbau löschen |
| `get_active_user_notification_v1`, `dismiss_user_notification_v1` | in Gebrauch | 6.920 / 22 | `user_notification_v1`, `user_notification_dismiss_v1` | nach Umbau löschen |
| `get_markets_v2` | in Gebrauch | 6.726 | `team_context_v1` (markets), `markets_all_v1` | nach Umbau löschen |
| `get_tags`, `get_tags_v2` | in Gebrauch | 6.128 / 8.836 | `team_context_v1` (topics) | nach Umbau löschen |
| `get_team_companies_v1` (2×), `get_companies`, `get_team_companies_context` (invoker) | in Gebrauch / alt | 4.857 / – | `team_context_v1` (brands) | nach Umbau löschen; `_context_v2` bleibt (n8n) |
| `get_team_model_settings_v1` | Settings | 2.441 | `team_context_v1` (models); Settings-Runde | nach Umbau der Settings löschen |
| `list_impact_events_v1` | in Gebrauch (Events-Seite) | 370 | `team_context_v1` (events) für den Speicher | **bleibt** (Events-Seite) |
| `clear_prompt_insights_cache_v1`, `clear_competition_overview_cache_v1`, `clear_citation_overview_cache_v1`, `clear_competition_chart_cache_v1` | Bubble nach Änderungen | 468 / 195 / 25 / 37 | v1-Caches leeren sich selbst (Trigger der letzten Runden) | nach Umbau löschen; bis dahin anon entziehen |
| `get_team_portfolio_overview_v1`–`v4`, `cached_…_v3/_v4` | Teams-Seite alt | 144 / 35 / 56 / – / 91 / 120 | `teams_portfolio_v1` | nach Umbau Teams löschen |
| `search_quick_actions_v1`, `_v2` | in Gebrauch | 274 / 347 | eigene Runde | – |
| `get_billing_plans_v1` | Onboarding alt | 120 | `onboarding_plans_v1`, `billing_plans_v1` | nach Umbau Onboarding löschen |
| `user_settings` REST | in Gebrauch | 21.016 / 1.600 | `app_start_v1.meta.settings`, `user_settings_set_v1` | Spaltenrechte sofort (S2), Tabellenrechte nach Umbau entziehen |
| `tg_user_settings_on_signup` | Trigger | – | – | bleibt (anon-Recht entziehen, wirkungslos) |
| `team_access`, `require_team_access` | Kern | – | – | bleiben; `require_team_access` bekommt `search_path` |
| 219 Funktionen ohne Zugangsprüfung (Abschnitt E) | alt/aktiv gemischt | – | v1 der jeweiligen Runden | Gruppe A: absichern; Gruppe B: nach den Umbauten löschen |

---

## E. Funktionen mit `p_team` ohne Zugangsprüfung (V1)
Die vollständige Liste (219, mit anon-Recht) steht in `zugang_ohne_pruefung.txt`.

**Gruppe A, heute aktiv genutzt** (Absicherung mit `require_team_access` vor dem Umbau sinnvoll):
- **Lesen:** `get_tags`, `get_tags_v2`, `get_markets_v2`, `get_team_companies_v1`, `get_team_brand_header_v9`, `get_team_model_settings_v1`, `get_active_user_notification_v1` (Team-Filter), `get_inactive_competitors_v1`, `list_suggested_prompts_v2`, `list_prompt_research_jobs_v1`, `get_prompt_research_result_v1`, `get_you_urls_v1`, `cached_get_untracked_brand_candidates_v8`, `get_team_organisation_v4`, `get_team_audit_log_v1`.
- **Schreiben:** `create_prompt_with_tags*`, `set_prompts_active/_inactive`, `delete_prompts_v2/_v3`, `create_tag`, `update_tag`, `delete_tag`, `assign_tags_bulk`, `activate_suggested_prompts*`, `insert_suggested_prompts_with_tags_v2`, `manage_suggested_prompts_v1`, `update_team_model_setting_v1`, `manage_team_models_v1`, `reactivate_competitor_v1/_v2`, `deactivate_competitor_v5`, `add_competitor_v4`.
- **Exporte (Edge `export`):** `export_brands_v1`, `export_domains_v1`, `export_prompt_runs_v1`, `export_prompts_full_v2`, `export_urls_v1`.

**Gruppe B, alte Versionen:**
- `get_citation_*_v13…v24`, `get_citations_insights_bundle*`, `get_competition_*_v14…v24`, `get_mentions_overview_v15…v20`, `get_topic_heatmap_v3…v6`;
- `get_url_bundle_v1…v6`, `get_domain_detail_v9…v11`, `get_mention_detail(_v6)`, `get_prompt_insights_alltime_v19`;
- `get_team_portfolio_overview_v1…v4`, `get_untracked_brand_candidates_v7/v8`, `get_competitors_with_visibility*`, `get_top_domains`, `get_top_urls_for_domain*`, `get_team_timezone`.

  Manche davon laufen gar nicht mehr (fehlende View, Typfehler).

**Nur `service_role` gemeint, aber für alle ausführbar** (invoker; scheitern heute an Tabellenrechten, gehören trotzdem gesperrt): `get_due_prompts_with_budget_v4/_v5`, `prepare_urls_for_scrape_v3…v5`, `cc_claim_and_load` (prüft die Rolle selbst).

**Vorschlag:**
- Gruppe A in einem eigenen Schritt auf `require_team_access` umstellen, als vollständiges `create or replace` mit Rückweg je Funktion und vorher geprüft, ob Bubble daran hängt.
- Gruppe B: anon und PUBLIC sofort entziehen, Löschen im Aufräumen.

---

## F. Vorschlag v1 (Abschnitt 4, angepasst)
Ein Aufruf für das erste Bild, ein zweiter für die Speicher des Teams. Beide lesen nur.

### F1. `app_start_v1(p_team_hint uuid default null)` → `{meta, row}`
```
meta: {
  user:     { id, email, display_name, avatar_url },        // avatar_url nur https, sonst null
  settings: { theme },                                       // dark | light | system
  teams:    [{ id, name, domain, favicon_url, role, has_access, access_state }],   // ohne gelöschte, außer für owner (zum Wiederherstellen)
  active_team_id, active_reason: 'hint' | 'last' | 'first' | 'none',
  data_as_of
}
row: null | {                                               // null -> Onboarding
  team_id, team_name, role,
  own_brand: { company_id, name, logo_url, domain, color },
  default_market: { alpha2, name, flag_url },
  access: { team_id, team_name, has_access, access_state, access_ended_at, can_manage_billing,
            plan_id, plan_name, billing_interval, monthly_price_eur, yearly_price_eur },
  quota:  { used, total, plan, competitors_used, competitors_total, models_used, models_total }
}
```
- **Wahl des aktiven Teams:**
  1. `p_team_hint`, wenn Mitglied und nicht gelöscht;
  2. sonst `last_team_id`, wenn Mitglied und nicht gelöscht;
  3. sonst das erste Team **mit Zugang**;
  4. sonst das erste Team;
  5. sonst `none`.
- Ein fremder, unbekannter oder gelöschter Hinweis wird **still übergangen**, nie ein Fehler, nie fremde Daten.
- **Schreibt nichts.** Ratenlimit 60/min je Nutzer.
- **Gate-Zustände** werden hier richtig gerechnet (V6):

  | Zustand | wann |
  |---|---|
  | `no_plan` | ohne Plan |
  | `trial_ended` | Trial vorbei ohne Zahlung |
  | `canceling` | gekündigt, Zugang läuft noch (`has_access: true`) |
  | `ended` | gekündigt, Zugang vorbei |
  | `past_due`, `deleted` | wie bisher |

  Dafür eine neue Hilfsfunktion `_team_access_v2` (die alte `team_access` bleibt unverändert, viele Funktionen hängen daran).
- **Ziel:** unter 30 ms in der Datenbank (gemessen: die Einzelteile zusammen 15 ms warm).

### F2. `team_context_v1(p_team uuid, p_parts text[] default null)` → `{meta, row}`
- **`p_parts`** ⊂ `brands`, `topics`, `markets`, `models`, `events`; null = alle.
- **Zugang:** `require_team_access`; ohne Zugang `PT402 team_access_<state>`.
- **Formen:** genau die aus 0.1.
  - brands: `company_id, name, logo_url, role, domain, color`;
  - topics: `id, name, emoji, hex_light, hex_dark, is_active, prompt_count, created_at`;
  - markets: `alpha2, name, flag_url, region, subregion, prompt_count, last_used_at`;
  - models: **eingeschaltete** Modelle des Teams `key, display_name, logo_url, provider, is_active`;
  - events: `id, event_date, name, event_type, color, icon`.
- Nach einem „Changed“-Signal lädt core nur den Teil neu. Ein Teamwechsel braucht `team_switch_v1` und `team_context_v1`.
- Ratenlimit 120/min.

### F3. `markets_all_v1()`
Die globale Liste (134), unabhängig vom Team, lange cachebar (core hält sie für die Sitzung). Kein `p_team`.

### F4. `team_switch_v1(p_team uuid)`
- Der **einzige** Weg, der `last_team_id` schreibt.
- Prüft die Mitgliedschaft (fremd → `team_forbidden`) und erlaubt auch Teams ohne Zugang (damit das Gate „Billing“ zeigen kann). Gelöschte Teams nur für den Owner.
- Ratenlimit 30/min.
- Antwort wie `app_start_v1` mit diesem Team.
- Ab dann schreibt `get_team_brand_header_v9` nicht mehr: Beim Umbau als vollständiges `create or replace` ohne den Schreibteil, mit Rückweg.

### F5. Benachrichtigung
- **`user_notification_v1(p_team uuid default null)`** → `{meta, row}`:
  - `row: {id, title, body, cta_label, cta_url, notification_type, priority, created_at} | null`;
  - Reihenfolge `priority desc, starts_at desc`;
  - `cta_url` nur `https://` (sonst null);
  - `p_team` fremd → wie ohne Team.
- **`user_notification_dismiss_v1(p_id uuid, p_reason text)`:**
  - `close | secondary | primary`; dazu eine neue Spalte `reason` in `user_notification_dismissal`;
  - nur Ids, die dem Nutzer gezeigt werden dürfen, sonst `app_invalid_param`;
  - Ratenlimit 30/min.

### F6. `user_settings_set_v1(p_key text, p_value text)`
- Zunächst nur `theme`, sonst `app_invalid_param`. Ratenlimit 30/min.
- Danach entziehen wir die REST-Rechte auf `user_settings`.

### F7. Fehler
| SQLSTATE | message | hint |
|---|---|---|
| 28000 | `app_not_authenticated` | – |
| 42501 | `team_forbidden` | – |
| PT402 | `team_access_<state>` | Zustand (nur `team_context_v1`, nie Start und Teamwechsel) |
| PT429 | `app_rate_limited` | Sekunden |
| 22023 | `app_invalid_param` | Feld |

### F8. Bauplan (nach deiner Freigabe)
1. **Sofort-Schritt** (`app_start_sofort.sql`, mit Rückweg):
   - S1, S2, S3, S4;
   - anon und PUBLIC raus aus allen Funktionen in Abschnitt E;
   - `require_team_access` mit `search_path`.
2. **`app_start_v1.sql`:** F1–F6 und `_team_access_v2`, mit Rückweg und echten Antworten in diesen Fällen:
   - 877c als Owner und als Member;
   - ein Nutzer ohne Team;
   - ein Team ohne Zugang (cf32814c);
   - ein fremdes `p_team_hint`;
   - ein gelöschtes Team als `last_team_id`.
3. **Gruppe A der Zugangsprüfung** als eigener Schritt (Abschnitt E).
4. **`export`-Edge-Function:** auf `_ex_require_v1`-Exporte und eine CORS-Liste umstellen.
