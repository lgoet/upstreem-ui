# Bubble abschalten: was danach raus kann (Sammlung, angelegt 14.10.)

Lebendes Dokument. Was beim Arbeiten als "nur für Bubble" auffällt, kommt hier dazu – mit Fundstelle,
wer handelt und was passiert, wenn es zu früh geht. Erste Fassung aus einem Durchgang über beide
Repos und die DB-Dokumente vom 14.10.

**Wichtig vorweg:** `bubble/` ist NICHT nur Bubble. Die Next-App baut daraus `public/wirt/`
(`upstreem-app/werkzeug/wirt_bauen.py` liest `kopf_skript_stand_13_10.html`,
`page_header_preload_ohne_kommentare.html`, `ladebild_udl_stand_13_10.html`,
`ansichten_dateien.json`), und die `.*_markup.py` füllen die Seiten aus 19 `*_bubble.html` plus 4
Seitenkopf-Vorlagen. Diese Quellen erst umbenennen bzw. nach upstreem-app verschieben, nie
pauschal löschen.

**Reihenfolge laut `settings_11_10/AUFRAEUMEN_NACH_UMBAU.md` §10:** Bubble aus →
`pg_stat_statements_reset()` → 14 Tage messen → `_aufraeumen_fn_backup` sichern → stufenweise löschen.

---

## 1. Sofort nach dem Abschalten löschbar (upstreem-ui, Code)

Risiko bei zu frühem Löschen: die laufenden Bubble-Elemente laden ins Leere.

- **Dateien, die keine Next-Ansicht lädt** (nicht in `ansichten_dateien.json`, nicht im Vorlade-Snippet,
  nicht in `landing-boot.js`): `skeleton.js/.css` (`bubble/skeleton_bubble.html:121`),
  `drawer-topbar.js/.css` (den Drawer-Kopf baut core, `prompt-detail.js:296`),
  `page-headers/brands|citations|settings-page-header.*` samt `page-headers/bubble/*.html`
  (die Landing lädt nur Dashboard-, Prompts-, Opportunities- und Performance-Kopf).
- **44 `*_bubble.html` ohne Abnehmer** (kein `.*_markup.py` liest sie): access_gate, add_prompts, ads,
  auth_page, brand_detail, brand_editor, brands/citations/dashboard/mira/opportunities/performance/
  prompts/prompt_research/settings/teams-Seiten, check_email, create_with_ai, drawer_topbar, events,
  export_data, forgot/reset_password, invite_page, not_found, notification_card, onboarding_page,
  power_dashboard, response_detail, settings_billing/brand, skeleton, team_orga, teams, url_detail,
  view_switch, `filters/bubble/*` (5), die drei Seitenköpfe oben.
- **Run-JS:** `bubble/runjs/` (13), `ads_runjs.md`, `events_runjs.md`, `events_runjs_charts.md`,
  `shopping_runjs.md`, `power_dashboard_runjs_test.js`, `page_theme_preload*.html`.
- **Archivieren statt löschen:** `*_bubble_inventar.md` (Citations, Prompts, Settings),
  `drawer_inventar.md`, `STATISCHES_MARKUP_PFLICHT.md`, `signup_code_setup.md`,
  `signup_invite_setup.md`.
- **Prüfstände im Repo:** 458 getrackte `_h_*` (378 HTML, 4,1 MB), seit 02.10. keine neuen (die
  laufen aus /private/tmp). 153 davon Bubble-spezifisch (`bubble_fn_`, Run-JS, `bubble-element`) plus
  rund 55 dem Namen nach (`*runjs*`, `_h_bubblesim`, `_h_preload*`, `_h_park*`, `_h_grp*`, `_h_uob_*`).
  BEHALTEN: `_h_pin_purge.html`, `_h_pin_check2.html` (Next lädt ebenfalls per Pin, bis die UI über
  die eigene Domain kommt). Löschen: `_m_*` (5).
- **108 öffentliche Setter, die nur Bubble-Run-JS ruft** (statisch ermittelt, `window[name]` könnte
  durchrutschen): `setOnboarding*` (11), `setEvent*`/`setEventsLoading`/`resetEvents`,
  `setAds*`/`resetAds`, `setResponseDetail*`, `setUrlDetail*`, `setAuthPage{Done,Invite,Loading,Mode}`,
  `setInvitePage*`, `set{Markets,Models}Filter*`, `reset*Page`, `setUpstreemSupabaseKey/Url`,
  `addBrandSuccess/Error`, `setShoppingMerchants/Products`. ACHTUNG: 11 weitere braucht die Landing.

## 2. Nach dem Abschalten vereinfachbar (Code)

**Bubble-Rückfälle hinter einer Bedingung** – der Bubble-Zweig fällt weg:
- nach `appStartAktiv()`: `sidebar.js:1371-1375` (usnTeam), `teams.js:765-769`,
  `notification-card.js:351-355` (uncDismiss), `core.js:20057-20060`, die vier Changed-Signale
  (`core.js:20393-20400`, `20591`, `20760`, `21004`);
- nach "RPC fehlt" (PGRST202): `export-data.js` (`fireExportBubble` 735-760, `resolveBubbleFn` 92,
  `BUBBLE_TYP`, `upstreemExportResolve` mit 90-s-Notuhr ~600), `ads.js:534-682`,
  `shopping.js:23/71/772`, `events.js:30/706-739`, `ask-mira.js:1180` (`OPP_DB.bubble`),
  `core.js:8287-8324` (`bubble_fn_quick_actions_search`), `quick-actions.js:567-690`;
- sonst: `sidebar.js:1437` (usnPinned), `664-690` (usnState, 20 × 150 ms), `core.js:12855-12910`
  (`upstreemSignal`, einziger Aufrufer `settings-page.js:496`).

**Nur für den Bubble-Gastgeber:**
- `core.js:11945-11978` (`kopfPolsterDurchlassen`/`kopfRahmen` über `.bubble-element`/`.Group`),
  `core.css:5574-5579` – Next nutzt `data-up-kopfrahmen`;
- `core.js:16790-16860` (`ansichtHalten`/`adresseNeuLesen`);
- `filters/date-range.js:1709-1745`, `~2015-2040` (umwickeln `bubble_fn_view_first_*`/`drawer_*`);
- `core.js:19647-19656` (leere `bubble_fn_drawer_<art>`) – nur zusammen mit `_notifyBubble` in kopf.js;
- `core.js:19518` (Bubble-Floating-Group vor core-Drawer);
- `#content-<art>`: `response-detail.js:409/1636/1900`, `access-gate.css:61`, kopf.js `CONTENT_DELAY`;
- core-Kopien/Pin-Mischung: `core.js:13850`, `13975-13995`, Pin-Warnung `25844-25890`,
  Window-Speicher `13824/18345/20293/20715` (Window-Speicher je instanceId NICHT blind entfernen);
- `/version-test`: `core.js:19891`, `onboarding-page.js:4342/4756`, `settings-page.js:149/773`,
  `settings-data.js:173`;
- `makeFire`: Iframe-Suche `core.js:4509-4560`, vorangestellte team_id, Rohwerte, Toolbox-Warnungen
  `12530-12620`, `feuerRoh` `23844`; in Next `data-name-fn`/`data-password-fn`
  (`app/signup/page.tsx:22`);
- `themeParam`/`data-isdark` (`core.js:21247`) – nur vereinfachen (Platzhalter `__UDS_DARK__` u. a.);
- `ncgSupabaseURL/PublishableKey/APIKey` (Zeroqode-Namen, `core.js:21709-21713`, `layout.tsx`) –
  nur gemeinsam umbenennen;
- `core.css` 4614-4632 (Alias-Klassen für Bubble-Markup), 3032-3039 (`--up-surface` an Bubble-
  Seitenfarbe), 6196/6595.

**Vertragsprüfung:** `contract.json`, `.contract_snapshot.py`/`.contract_diff.py` decken "alles, was
Bubble sieht oder ruft" (183 Events, 132 fn-Attribute, 228 Globals, 2527 Klassen). Danach auf die
Brücken der Next-App und das Seiten-Markup kürzen; "0 Entfernungen" entfällt.

**Dokumentation:** CLAUDE.md §2/§2a (Run-JS-Hausform), §4.3 (Bubble-seitige Schritte), README.md,
Bubble-Erinnerungen im Gedächtnis.

## 3. upstreem-app (Code)

- Stumme Empfänger `app/page.tsx:61` (usnState, usnTheme, theme_pref, view_changed, 13 × view_first_*)
  und `uauMode`.
- `layout.tsx`: `ncgSupabase*`, Schalter `__upAnsichtenLazy`/`__upLazyDrawer` (Lazy wird Standard).
- `public/wirt/` vom Generator lösen: Quellen nach upstreem-app übernehmen, dann streichen:
  kopf.js `_notifyBubble` (163-195), `content-`/`CONTENT_DELAY`, `drawersReady` samt 30-s-Notnetz,
  `_viewRuf`/`viewCheck`, Loader-Abbau per ResizeObserver (startet in Next nie,
  `lib/ladebild_abbau.ts:12-13`); preload.js Früh-Stubs `UP_API`/`__upFrueh` (98-127),
  Warteschlangen (84-97), `welle2`/`VORRAT`, `pinWaechter` (`data-cdn-pin`, 338-356), `doppelWaechter`.
- `appStart`-Brücke (`page.tsx:52`) bleibt als Ladesignal.

## 4. Datenbank und Backend (DB-Chat / Lukas)

- **Rechte:** `rechte_bestand_dashboard.sql` (§1 Z.27), `rechte_bestand_brands.sql` (28 alte
  Funktionen ohne anon, Z.40) – zu früh eingespielt wäre der Bubble-Drawer leer.
- **Ersetzte Bubble-RPCs (§2 Z.49-66):** Dashboard, Citations, Performance, Opportunities, Teams,
  Prompt Research, Exporte, Prompt Insights (u. a. `delete_prompts_v2/v3`), Mira,
  `get_mention_detail_v2-v8`, Einladungen v1/v2, `search_quick_actions_v1/v2`, Settings-Altfunktionen,
  Brands (`add_competitor_v1-v4` mit anon).
- **Drawer (Z.199-230):** alte Detail-RPCs; direkte Tabellenzugriffe aus Bubble (`company_alias`,
  `team_brand_profile`, `team_company_settings`, `team_domain_override`, `v_company_alias_enriched`).
- **App-Start (Z.259-277):** `get_team_brand_header_v9` (schreibt `last_team_id`), UPDATE/SELECT auf
  `user_settings` für authenticated entziehen, `get_team_plan_quota*`, `get_my_teams_v4`,
  `get_active_user_notification_v1`/`dismiss_*`, `get_markets_v2`, `get_tags*`, `clear_*_cache`,
  `get_billing_plans_v1`; `team_access`-Zustandswörter erst umstellen, wenn Bubble
  `get_team_plan_quota_v3`/`get_team_billing_status_v1` nicht mehr liest.
- **Vor Next.js (Z.310-323):** Shopping/Ads/Events v1 mit `{json}`-Umschlag, `list_impact_events_v1`,
  Edge `export` + `export_*_v1`/`full_v2`, Edge `create-billing-portal-session`, `get_billing_plans_v1`,
  `create_mira_source_recommendation_v1/v2`, `create_prompt_with_tags*`, `get_you_urls_v1`; Hilfen
  `js_json_envelope`, `_ads_out_v1`, `tpl_escape`, `js_safe_lite`, `impact_event_detail_v1`,
  `shopping_rate_limit_v1`, `impact_rate_limit_v1` (bleiben: `js_safe`, `js_safe_text`, `clean_title`).
- **Prompt Research (Z.392/399):** `list_suggested_prompts*`, `activate_*`, `ignore_suggested_prompts`,
  `manage_suggested_prompts_v1`, `get_prompt_research_result_v1`, `list_prompt_research_jobs_v1`;
  `insert_suggested_prompts_with_tags_v2` für authenticated entziehen; Bubble-`rpc_cache`-Zeilen in
  `_pi_clear_caches_v1` (Z.58).
- **Onboarding (Z.241-250):** Edge `create-onboarding-checkout`, n8n `ONBOARDING`/`ONBOARDING_PROMPTS`
  (offene Webhooks), Bubble-Seite `onboarding-success`, Broadcast-Felder nur für Bubble, Grants auf
  `onboarding_project`/`onboarding_suggested_prompt`.
- **n8n/Realtime (Z.90-97):** öffentliche Kanäle (Mira, Error Handler, Prompt_Creator v2),
  `mira_emit_progress` Blöcke 1/2, alter `Prompt_Creator` (Webhook `llm_prompt_analysis_18072025`).
- **CORS:** `https://llmoscout.bubbleapps.io` in `start-job` (`audit_14_10/edge/start-job_index.ts:57`,
  `missbrauch_14_10/...:59`), `mira-send`, `mira-export-pdf`, `onboarding_13_10/edge/_onb.ts:23`
  (alle vier `onboarding-*`); alte Funktionen mit `*`: `export`, `send-team-invite`,
  `create-billing-portal-session`, `create-onboarding-checkout`.
- **Einladungen:** `create_team_invite_v1` liefert Link auf `llmoscout.bubbleapps.io/version-test`
  (`settings_v1_vorschlag.md:485`), Hash-Pfad in `_invite_find_id_v1`, `team-invite-send` lässt
  `/version-test` zu.

## 5. NICHT bis zur Abschaltung warten (Sicherheit, sofort)

- anon-Rechte auf `ingest_*`, `check_rate_limit`, `create_prompt_with_tags`,
  `claim_due_prompt_model_jobs_v1` (AUFRAEUMEN §7) – vorher prüfen, mit welchem Schlüssel n8n schreibt.
- n8n-Webhooks ohne Auth: `ask-mira-agent`, `mira-message-export-pdf`.

## 6. Unklar / vorher messen

- `unclipAncestors`: ob Next es braucht.
- Window-Speicher je instanceId (Bubble-Neuaufbau beim Themenwechsel) – nicht blind entfernen.
- `{json}`-Entpacken in `rpc()` – nötig, bis die Umschlag-RPCs weg sind.
- Supabase-Redirect-/Site-URLs und Mail-Vorlagen mit Bubble-Pfaden (nicht aus dem Repo prüfbar).
