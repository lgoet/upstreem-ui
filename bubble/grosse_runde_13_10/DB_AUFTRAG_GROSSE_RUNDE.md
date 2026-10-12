# DB-Auftrag: die große Runde vor Next.js (13.10.2026)

Diesen Text in den Datenbank-Chat geben. Es ist **ein** Auftrag für alles, was in der App noch über Bubble-Workflows läuft. Danach hängt die Hauptseite nur noch an Bubble für: Anmeldung (Plugin), Abmelden, Navigation, „New Team“ (→ Onboarding). Das wandert mit Next.js.

Gleiches Spiel wie immer, je Abschnitt:
1. **Bestand:** Was gibt es, wer ruft es heute, welche Rechte?
2. **Prüfung:**
   - Missbrauch: fremdes Team, fremde IDs, Rollen.
   - Spam und Rate-Limits.
   - Kaputte und übergroße Eingaben, Injection, Formeln in CSV.
   - Datenleck über Fehlertexte.
3. **Aufräumliste:** Was wird nach der Umstellung nicht mehr gerufen? Erst beobachten, dann absichern, dann löschen, wie gehabt.
4. **Vertrag** mit echten Antworten (JSON-Datei, mit Fehlerfällen), wie bei `APP_START_V1`.

Alle Funktionen sind `authenticated`, Schema `app`, und prüfen das Team selbst (`_require_team_member` o. ä.). **Kein Umschlag `{json: …}`, keine Backslash-Verdopplung, keine Härtung für Backticks.** Die Komponenten rufen direkt über PostgREST; der Umschlag war nur für Bubbles Run-JS da. Fehler als HTTP-Fehler mit `message` = Code (wie überall).

---

## 1. Shopping, Ads, Impact Events: dieselben RPCs ohne Umschlag

Heute: JS → Bubble-Workflow → API Connector → Run-JS-Setter. Die Bodies baut die Komponente schon fertig, Bubble reicht sie nur durch.

**Bitte je Funktion eine Fassung ohne Umschlag** (neuer Name `_v2` oder ein Schalter, deine Wahl). Gleiche Parameter, Antwort als `jsonb`:

| Modul | heute (mit Umschlag) | Parameter (wie heute) |
|---|---|---|
| Shopping | `cached_shopping_overview_v1` | `p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode, p_brand_search, p_brand_order, p_brand_limit, p_brand_offset` |
| | `cached_shopping_products_v1` | Grundkörper + `p_segment, p_search, p_merchant, p_company_id, p_order, p_limit, p_offset` |
| | `cached_shopping_product_detail_v1` | Grundkörper + `p_source_product_id` (Text, 19-stellig), `p_limit, p_offset` |
| | `cached_shopping_merchants_v1` | Grundkörper + `p_search, p_order, p_limit, p_offset` |
| Ads | `get_ads_overview_v1` | `p_team_id, p_date_from, p_date_to, p_models, p_markets, p_topic_ids, p_advertisers, p_ad_formats` |
| | `list_ads_advertisers_v1` | Grundkörper + `p_search, p_limit, p_offset, p_sort` |
| | `get_ads_advertiser_detail_v1` | Grundkörper + `p_advertiser_name` |
| | `list_ads_library_v1` | Grundkörper + `p_search, p_limit, p_offset` |
| | `list_ads_prompts_v1` | Grundkörper + `p_search, p_limit, p_offset, p_sort` |
| | `get_ads_filter_options_v1` | `p_team_id, p_date_from, p_date_to` |
| Events | `get_impact_event_v1` | `p_team, p_event_id` |
| | `cached_impact_event_analysis_v1` | `p_team, p_event_id, p_window_days, p_models, p_markets` |
| | `preview_impact_event_scope_v1` | `p_team, p_scope_mode, p_tag_ids` |
| | `create_impact_event_v1` | `p_team, p_name, p_event_date, p_scope_mode, p_tag_ids, p_urls, p_description, p_event_type, p_icon, p_color, p_cover` |
| | `update_impact_event_v1` | `p_team, p_event_id, p_name, p_description, p_event_type, p_icon, p_color, p_cover` (null = unverändert, "" = leeren) |
| | `add_impact_event_url_v1` | `p_team, p_event_id, p_url` |
| | `remove_impact_event_url_v1` | `p_team, p_event_id, p_url_id` |
| | `delete_impact_event_v1` | `p_team, p_event_id` |

**Fragen:**
- **a)** Ads heißt `p_team_id`/`p_topic_ids`, Shopping und Events `p_team`/`p_tag_ids`. Bitte in den neuen Fassungen einheitlich `p_team`/`p_tag_ids`. Die Komponente stellt um.
- **b)** Die schreibenden Event-Funktionen antworten heute mit dem Detail. Bitte so lassen: Die Seite zeichnet direkt aus der Antwort.
- **c)** Rate-Limit für `create_impact_event` und `add_impact_event_url`? Ein Nutzer kann heute per Schleife beliebig viele anlegen.
- **d)** Nach Create/Update/Delete lädt core die Eventliste über `team_context_v1(team, ['events'])` nach. Bitte bestätigen, dass das reicht.

## 2. Quick-Actions-Suche: `search_quick_actions_v2` direkt

Heute: `bubble_fn_quick_actions_search` → Bubble → `search_quick_actions_v2` → `MiraQuickActions.setResults`. Dieselbe Suche nutzen auch der „+“-Picker in Mira und die URL-Vorschläge im Event-Dialog.

- **a)** Ist `search_quick_actions_v2` für `authenticated` direkt aufrufbar und prüft das Team selbst? Sonst bitte `quick_search_v1` mit demselben Ergebnis.
- **b)** Diese Felder schickt die Komponente heute: `query, query_folded, query_de, scope, rank, citation_type, url_type, market, mentioning, limit`. Bitte die Parameternamen der Funktion dazu nennen und sagen, was davon die DB wirklich auswertet. `query_folded`/`query_de` rechnet heute der Client vor; wenn die DB selbst faltet, fliegen sie raus.
- **c)** Rate-Limit: Die Suche feuert beim Tippen (gedrosselt auf 250 ms). Bitte ein Limit pro Nutzer, das normales Tippen nicht trifft.
- **d)** `js_safe` und die Binärtitel (Auftrag vom 06.10.): ohne Run-JS nicht mehr nötig. Bitte nur bestätigen, dass Titel als normales JSON kommen.

## 3. Exporte: aus der Komponente statt aus Bubble

Heute: Dialog → `bubble_fn_upstreemExport` → Bubble ruft die Export-RPC mit dem Nutzer-Token, baut die Datei, lädt herunter, meldet `upstreemExportResolve`. Künftig ruft `export-data.js` selbst, blättert, baut CSV im Browser und lädt herunter.

| Typ im Dialog | v1 (seit Brand/URL/Prompt-Detail) | Filter |
|---|---|---|
| Prompts | `export_prompts_v1` | Zeitraum |
| Responses | `export_responses_v1` | Zeitraum, `p_brand`, `p_url`, `p_domain`, `p_prompt_id` |
| Domains | `export_citations_domains_v1` | Zeitraum, `p_brand` |
| URLs | `export_citations_urls_v1` | Zeitraum, `p_brand`, `p_domain` |
| Brands | **fehlt** (heute Edge `export` → `export_brands_v1`) | Zeitraum |

- **a)** Bitte `export_brands_v1` in derselben Bauart (`_ex_require_v1`, Blättern, `csv_safe_v1`).
- **b)** Vertrag für alle fünf: Parameter, Spalten in Reihenfolge mit Kopfzeile (englisch, wie die App), Seitengröße und Höchstzahl, Antwortform (`{meta:{total, next_offset}, rows}`?).
- **c)** Formelschutz: `csv_safe_v1` auf jeder Textspalte? Bitte bestätigen, dass kein Feld ohne Schutz rausgeht.
- **d)** Rate-Limit pro Nutzer und Team (Export ist die teuerste Abfrage).
- **e)** Die Edge-Funktion `export` und die alten `export_*` (`export_prompts_full_v2`, `export_prompt_runs_v1`, `export_domains_v1`, `export_urls_v1`, `export_brands_v1`) kommen auf die Aufräumliste.

## 4. Gate: Tarife, Kasse, Portal wie in den Einstellungen

Die Einstellungen machen das schon selbst: `billing_plans_v1`, Edge `create-team-checkout`, `team-billing-portal`. Das Gate (Team ohne Zugang) soll dieselben drei nehmen statt der Bubble-Workflows `uagPlans`/`uagSelectPlan`/`uagManage`.

- **a)** Das Gate erscheint genau dann, wenn der Zugang fehlt. Bitte bestätigen, dass diese drei bei `has_access:false` **nicht** mit 402 `team_access_*` antworten (sonst sperrt das Gate sich selbst aus). Alle Zustände: `trial_expired`, `canceled`, `past_due`, `no_plan`, `paused`.
- **b)** Wer darf im Gate kaufen? Vorschlag: Owner und Admin. Ein Mitglied sieht „Ask the owner of this team“, ohne Knopf.
- **c)** Welche Bubble-Funktionen fallen dann weg? (Tarifliste des Gates, `create-billing-portal-session`, …)

## 5. Einstellungen-Popup: Vorlieben im Nutzerkonto

Sprache, Zahlenformat, Datumsformat und Akzentfarbe liegen heute nur im `localStorage`, also pro Gerät. Das Thema speichert core schon über `user_settings_set_v1('theme', …)`.

- **a)** Bitte `user_settings_set_v1` für die Schlüssel `locale` (`en|de`), `number_format`, `date_format`, `accent` freigeben, mit Whitelist der Werte. Die Werte schicke ich mit dem Bau.
- **b)** `app_start_v1` liefert sie in `meta.settings` mit, damit ein neues Gerät sie sofort hat.

## 6. Mira: Opportunity aus dem Chat

Zwei Knöpfe in Mira-Antworten laufen noch über Bubble:
- „Create opportunity“ → `bubble_fn_ask_mira_create_opportunity {action_id, lead_url, title?, reason?}` → RPC **unbekannt** → `askMiraOpportunityResult`.
- Status-Menü auf einer Opportunity-Karte im Chat → `bubble_fn_ask_mira_move_opportunity_status {opportunity_id, recommendation_id, status, previous_status}`.

**Fragen:**
- **a)** Welche RPC legt heute die Opportunity aus einer Mira-Aktion an? Bitte als `opportunity_from_mira_v1(p_team, p_action_id, p_lead_url, p_title, p_reason)` mit Antwort `{status:'created'|'exists', recommendation}`. Doppelklick = `exists`, kein zweiter Eintrag.
- **b)** Status: Reicht `opportunities_set_status_v1` (das Brett nutzt es schon) mit derselben ID?

## 7. Seitenleiste: zwei Werte, die heute nur Bubble liefert

- **a) Zähler an „Prompt Insights“** (`data-prompt-count`): bitte als `prompt_count` (aktive Prompts) in `app_start_v1.row` und in `team_context_v1` (Teil `meta` oder eigener Teil `counts`), damit er nach Hinzufügen und Löschen nachgeladen werden kann.
- **b) Kopf der Seitenleiste nach dem Speichern in „Your Brand“:** Heute feuert die Einstellungen-Seite `account_updated` an Bubble, Bubble lädt `get_team_brand_header_v9`. Ich will stattdessen den Teil `teams` (Name und Logo der Teams des Nutzers, wie in `app_start_v1.meta.teams`) über `team_context_v1(team, ['teams'])` nachladen. Gibt es den Teil, oder kommt er dazu?
- **c)** `app_start_v1.meta.teams` ist nach `created_at` sortiert, ohne Kennzeichen für das aktive Team. Das löse ich im Client über `row.team_id`. Nur zur Info, nichts zu tun.

## 8. Aufräumliste (zum Beobachten)

Nach dem Pin dieser Runde werden diese Bubble-Wege nicht mehr ausgelöst. Bitte eine Woche beobachten, dann in die Liste:
- Shopping/Ads/Events: die `_v1` mit Umschlag aus Abschnitt 1, außerdem `list_impact_events_v1` (Liste kommt aus `team_context_v1`).
- Quick Actions: Aufrufe von `search_quick_actions_v2` über den Bubble-Connector (bleibt als Funktion, falls 2a ja).
- Export: Edge `export`, alte `export_*`.
- Gate: Tarifliste und Portal über Bubble.
- Mira: die Opportunity-RPC aus Bubble (nach 6a).
- Seitenleiste: `get_team_brand_header_v9` (nach 7b), sofern sonst niemand ruft.
- Prompts aus Quick Actions: `create_prompt_with_tags` (Quick Actions speichert künftig über `prompts_add_v1`, wie die Prompts-Seite).
- Create with AI: `get_you_urls_v1` (künftig `opportunities_own_urls_v1`, auch außerhalb der Opportunities-Seite).

---

**Was du von mir bekommst:** die Rückmeldung mit den gemessenen Fällen, sobald die Komponenten gegen deine echten Antworten laufen. Bis dahin baue ich alles, was keine DB-Änderung braucht.
