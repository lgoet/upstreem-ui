# An Claude Code: Domain-Drawer, Marken-Editor und Marken-Protokoll v1 (13.10.2026)

Lukas spielt `domain_editor_v1.sql` ein, danach `domain_editor_alt_absichern.sql`. Echte, ungekürzte Antworten (Team 877c, 7 Tage) liegen in `domain_editor_v1_echte_antworten.json`. Alle RPCs: `POST /rest/v1/rpc/<name>`, Header `Content-Profile: app`, Nutzer-JWT. Fehler kommen immer als echter Fehler, `message` = Code, `hint` = Grund.

## 1. Domain-Drawer
| Teil | RPC | Hinweis |
|---|---|---|
| Kopf, Titel, Menü | `domain_detail_v1(p_team, p_domain)` | ohne Zeitraum |
| Große Zahl, Kurve, Funnel, URL-Typen, Modelle | `domain_detail_stats_v1(p_team, p_domain, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode, p_granularity)` | gecacht |
| URL Share | `domain_url_share_v1(…dieselben…, p_granularity, p_top_n 1–10, Standard 7)` | gecacht |
| „Diese Domain zählt als …“ | `domain_classify_v1(p_team, p_domain, p_role)` | `'own'` / `'competitor'` / `null` (= Automatik) |
| Unterseiten | `cached_citations_domain_urls_v1(…, p_domain)` | unverändert |
| KI-Antworten | `cached_dashboard_responses_v1(…, p_domain)` | `p_domain` wird jetzt normalisiert |
| Export Unterseiten | `export_citations_urls_v1(p_team, p_domain, …)` | kennt `p_domain` schon |
| Export Antworten | `export_responses_v1(…, p_domain)` | normalisiert |

**`p_domain`** darf roh aus der Adresse kommen (`https://WWW.ADAC.de/test?x=1`): Schema, Pfad, Port und `www.` werden überall entfernt. Ungültig sind Eingaben ohne Punkt oder über 253 Zeichen:
- `domain_detail_v1`: `domain_not_found` (PT404);
- Stats/URL Share: `citations_invalid_param` (hint `p_domain`);
- Responses: `dashboard_invalid_param` (hint `p_domain`).

**`domain_detail_v1` → `{meta: {team_id, domain, data_as_of}, row}`**
```
row: { domain, favicon_url (https oder null),
       citation_type, citation_type_label,            // wirksam (mit Override)
       citation_type_auto, citation_type_auto_label,  // was die App ohne Override erkennt
       override: null | 'own' | 'competitor', override_set_at,
       can_override,                                  // owner/admin
       first_seen, last_seen,                         // erste/letzte Zitation fürs Team, null wenn nie
       company: null | { company_id, name, role } }   // Domain einer verfolgten Marke
```
- Eine nie zitierte Domain liefert `last_seen: null`, `citation_type: 'Misc'` und keinen Fehler.
- Das Menü zeigt „Automatisch (<citation_type_auto_label>)“, „You“ und „Competitor“; angehakt ist `override`, null heißt Automatik. Bei `can_override: false` ist es nur lesbar.

**`domain_detail_stats_v1` → `{meta, row}`**
- `meta`: wie Citations (`runs_with_any`, `prev_from`/`prev_to`, `filters`), dazu `domain` und `granularity`.
- `row`:
  - `current_citation_share`, `citation_share_prev`, `citation_share_delta_pct` (Prozentpunkte). Sie sind **gleich `share_pct` der Domain in `cached_citations_domains_v1`**, auch bei Woche und Monat; der Zeitraum wird nicht mehr gedehnt.
  - `runs_with_domain(_prev)`, `total_citations_count/_prev/_delta_pct`, `first_used_at`, `last_used_at`.
  - `timeseries[{day, bucket_from, bucket_to, partial, share_pct, runs_with, citations, runs_with_any}]`. `day` ist der Bucket-Anfang; angeschnittene Buckets haben `partial: true`.
  - `model_breakdown[{model, model_label, model_logo_url, color_lightmode, color_darkmode, runs_with, model_share_pct}]`, Summe 100.
  - `types_breakdown[{type, label, citations, share_pct}]` (URL-Typen nach Zitaten, Summe 100).
  - `source_presence_funnel` mit denselben Feldern wie heute (`ai_searches_citing_domain`, `cited_urls_count`, `urls_mentioning_you`, …). Geprüft gegen den alten RPC: identisch.

**`domain_url_share_v1` → `{meta, urls, rows}`**
- `urls[{url, title, runs_with, share_total_pct, domain_share_total_pct}]`: die Top N, sortiert.
- `rows[{day, bucket_from, bucket_to, url, share_pct, domain_share_pct, runs_with}]`.
- `share_pct` ist der Anteil an allen Antworten mit Quellen, `domain_share_pct` der Anteil an den Antworten mit dieser Domain.

**`domain_classify_v1`** antwortet wie `domain_detail_v1`, dazu `meta.changed`. Danach weiterzeichnen ohne zweiten Aufruf und die übrigen Bausteine neu laden: Die Caches des Teams sind geleert.

| SQLSTATE | message | hint | Text |
|---|---|---|---|
| 42501 | `domain_classify_forbidden` | owner,admin | Nur Owner/Admin können das ändern. |
| 22023 | `domain_classify_invalid` | `domain` / `role` | – |
| 22023 | `domain_classify_invalid` | `tracked_competitor` (detail = Marke) | „Diese Domain gehört zu {detail}, einem Wettbewerber.“ |
| 22023 | `domain_classify_invalid` | `own_brand` (detail = Marke) | „Das ist die Domain deiner Marke {detail}.“ |
| 22023 | `domain_classify_invalid` | `limit` (detail 100) | Höchstens 100 eigene Zuordnungen. |
| PT429 | `domain_classify_rate_limited` | Sekunden | – |

## 2. Marken-Editor
| Aktion | RPC |
|---|---|
| Lesen | `brand_edit_v1(p_team, p_company)` |
| Name | `brand_rename_v1(p_team, p_company, p_name)`: null/leer = zurück zum globalen Namen |
| Alias hinzufügen | `brand_alias_add_v1(p_team, p_company, p_pattern)` |
| Alias an/aus | `brand_alias_set_v1(p_team, p_company, p_alias_id, p_active)`: Zielwert, Doppelklick harmlos |
| Alias löschen | `brand_alias_delete_v1(p_team, p_company, p_alias_id)` |
| Farbe | `brand_color_set_v1(p_team, p_company, p_color)`: `#rrggbb` (ohne `#` geht auch); null = zurücksetzen |

Jede Schreibaktion antwortet mit der neuen `brand_edit_v1`-Antwort.
```
meta: { team_id, company_id, can_edit, limits: { name_max: 60, alias_min: 2, alias_max: 60, aliases_max: 20 }, data_as_of }
row:  { company_id, name, name_override, global_name, domain, favicon_url, role, status: 'active'|'inactive',
        default_color, color_override, effective_color,
        aliases[{ alias_id, pattern, is_active, created_at }], tracking_periods[{ started_at, ended_at, start_reason, end_reason }] }
```
**Regeln** (die Oberfläche kann sie vorab prüfen, die DB prüft immer):
- Name: 1–60 Zeichen, im Team eindeutig.
- Alias: 2–60 Zeichen, mindestens ein Buchstabe. 2 Zeichen nur in Großbuchstaben oder Ziffern (VW, X5).
- Höchstens 20 Aliase je Marke.
- Kein Alias darf einer anderen Marke des Teams gehören, gleich als Name, Alias oder ganzes Wort davon. Beispiele: „Mercedes“ bei BMW, „BMW vs Mercedes Benz“.
- Unsichtbare oder Steuerzeichen, Emoji, Backtick, Backslash, `${` und `=` `+` `-` `@` am Anfang werden abgewiesen. Text wird NFKC-normalisiert; „ＢＭＷ“ wird zu „BMW“.
- Ein Alias gilt ab dem nächsten Lauf.

| SQLSTATE | message | hint |
|---|---|---|
| 28000 | `settings_not_authenticated` | – |
| 42501 | `team_forbidden` | – |
| 42501 | `brand_edit_forbidden` | `owner,admin` oder `inactive` (archivierte Marke nur lesen) |
| PT404 | `team_deleted` / `brand_not_found` (auch fremd) / `brand_alias_not_found` | – |
| PT402 | `team_access_<state>` | Zustand |
| 22023 | `brand_name_invalid` | `empty` / `too_long` / `characters` / `taken` (detail = Marke) |
| 22023 | `brand_alias_invalid` | `too_short` / `too_long` / `characters` / `duplicate` (= eigener Name) / `collides` (detail = Marke) |
| 22023 | `brand_alias_limit` | `20` |
| 22023 | `brand_color_invalid` | `#rrggbb` |
| 22023 | `team_invalid_param` | `p_company` / `p_active` |
| PT429 | `brand_edit_rate_limited` | Sekunden (30 Schreibaktionen je Minute) |

Einen vorhandenen Alias derselben Marke noch einmal hinzuzufügen ist kein Fehler: keine Änderung, die Antwort zeigt den Stand. Name und Farbe leeren die Caches des Teams; Dashboard und Citations zeigen den neuen Namen sofort.

## 3. Protokoll (Settings, wie Team-Log)
`brand_log_v1(p_team, p_limit 1–100, p_before, p_types)`, nur owner/admin (sonst `team_role_required` PT403).
- `p_types`: Teilmenge von `status`, `name`, `alias`, `color`, `domain`; null = alle. Das sind die Filter-Chips.
- Weiter blättern mit `meta.next_before`.
```
meta: { team_id, limit, types, available_types, next_before }
rows[{ log_id, created_at, action, type, actor_user_id, actor_email, actor_display_name, by_system, n,
       companies[{ company_id, name, favicon_url }], details }]
```
| action | type | details |
|---|---|---|
| `add` / `activate` / `deactivate` / `delete` | status | wie bisher (`by_system: true` bei Plan-Limit, `details.reason`) |
| `rename` | name | `before`, `after` |
| `alias_add` / `alias_activate` / `alias_deactivate` / `alias_delete` | alias | `alias`, `alias_id` |
| `color_set` / `color_reset` | color | `before`, `after` |
| `domain_own` / `domain_competitor` / `domain_auto` | domain | `domain`, `before`, `after` |

Auch die alten Bubble-RPCs schreiben ins Protokoll.

## Laufzeit (kalt, im Test)
| RPC | Laufzeit |
|---|---|
| `domain_detail_v1` | 13 ms |
| Stats | 410 ms bei 7 Tagen (Tag); Woche oder Monat danach je etwa 70 ms; warm aus dem Cache |
| URL Share | 90–140 ms bei 7 Tagen, 1,5 s bei 30 Tagen |
| Editor | unter 40 ms je Aktion |
| `brand_log_v1` | unter 10 ms |

## Nachtrag 1: `brand_log_v1` je Marke
`brand_log_v1(p_team, p_limit, p_before, p_types, p_company)`. `p_company` ist der letzte, optionale Parameter; ohne ihn bleibt alles wie bisher.
- Mit `p_company` kommen die Einträge, deren `companies` die Marke enthält, dazu die Domain-Einträge zu ihrer Website-Domain (z. B. `mercedes-benz.de` bei Mercedes). Domain-Einträge haben `companies: []`.
- Fremde oder unbekannte Marke: leere `rows`, kein Fehler, wie die übrigen Lese-RPCs.
- `meta.company_id` ist gesetzt. Rolle, `p_types` und `next_before` bleiben wie bisher.
- Echte Antworten: `brand_log_v1_firma_echte_antworten.json`.
