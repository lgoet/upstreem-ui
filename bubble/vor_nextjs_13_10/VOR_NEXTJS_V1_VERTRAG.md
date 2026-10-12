# Vor Next.js v1: Vertrag für Claude Code (13.10.2026)

Antwort auf den „DB-Auftrag: die große Runde vor Next.js“. Abschnittsnummern wie im Auftrag.

- **Echte Antworten:** `vor_nextjs_v1_echte_antworten.json`, 70 Fälle, ungekürzt, mit Fehlerfällen.
  - Die Datei `vor_nextjs_v1.sql` lief in Produktion in einer Transaktion. Danach lief der Rückweg, dann wurde alles zurückgerollt; es wurde nichts gespeichert.
  - Rückweg geprüft: Alle 721 Funktionen sind wieder exakt gleich (md5), nichts fehlt, nichts bleibt übrig.
- **Alle Aufrufe:** `POST /rest/v1/rpc/<name>` mit `Content-Profile: app` und dem Nutzer-Token aus der Plugin-Sitzung.
  - Nur `authenticated` darf ausführen; anon bekommt 401.
  - Es gibt keinen Umschlag `{json}` mehr, keine Backslash-Verdopplung und kein `js_safe`. Texte kommen als normales JSON.
  - **Texte aus Daten** (Anzeigentitel, Seitentitel, Namen, Event-Texte) **immer als Text rendern, nie als HTML.**
- **Fehler:** HTTP-Fehler, `message` = Code, `hint` = Feld bzw. Zustand.

| HTTP | SQLSTATE | wann |
|---|---|---|
| 400 | 22023 / P0001 | falscher Parameter (`*_invalid_param`, `hint` = Feld) |
| 401 | 42501 | ohne Token |
| 402 | PT402 | Team ohne Zugang (`team_access_<state>`) → Gate |
| 403 | 42501 | fremdes Team (`forbidden` / `team_forbidden`), fehlendes Recht (`impact_event_forbidden`) |
| 403 | PT403 | Rolle fehlt (`team_role_required`, `hint` = `owner,admin`) |
| 404 | PT404 | nicht gefunden |
| 409 | PT409 | Konflikt (doppelt, Grenze erreicht) |
| 429 | PT429 | Ratenlimit (`<bereich>_rate_limited`) |

---

## 1 Shopping, Ads, Events ohne Umschlag

Ich habe neue Namen (`_v2`) gebaut statt eines Schalters. Die v1 bleiben für Bubble, bis umgestellt ist.

### Shopping
| neu | Parameter | Antwort (Fall) |
|---|---|---|
| `cached_shopping_overview_v2` | wie v1 | `{meta, kpis, chart, brands, brands_page, brands_other, brands_summary, top_products, movement, merchant_distribution}` (S1) |
| `cached_shopping_products_v2` | wie v1 | `{meta, rows, limit, offset, total_count, segment_counts}` (S2) |
| `cached_shopping_product_detail_v2` | wie v1 (`p_source_product_id` als Text) | `{meta, product, kpis, trend, models, markets, topics, merchants, appearances}` (S3) |
| `cached_shopping_merchants_v2` | wie v1 | `{meta, summary, merchants, limit, offset, total_count}` (S4) |

- **Inhalt:** genau der Inhalt des v1-Umschlags (S1b: `gleich: true`). v2 nutzt denselben Cache wie v1.
- **Ratenlimit:** 30/min je Funktion.
- **Unbekannte Produkt-ID:** `shopping_product_not_found` (400, S7).

### Ads (jetzt mit `p_team` und `p_tag_ids`)
| neu | Parameter | Antwort (Fall) |
|---|---|---|
| `get_ads_overview_v2` | p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_advertisers, p_ad_formats | `{kpis, trend, topics, recent_ads, advertiser_share}` (A1) |
| `list_ads_advertisers_v2` | Grundkörper + p_search, p_limit, p_offset, p_sort | `{items, limit, offset, total_count}` (A2) |
| `get_ads_advertiser_detail_v2` | Grundkörper + p_advertiser_name | `{advertiser, summary, trend, ads, prompts}` (A3) |
| `list_ads_library_v2` | Grundkörper + p_search, p_limit, p_offset | `{items, limit, offset, total_count}` (A4) |
| `list_ads_prompts_v2` | Grundkörper + p_search, p_limit, p_offset, p_sort | `{items, …}` (A5) |
| `get_ads_filter_options_v2` | p_team, p_date_from, p_date_to | `{models, markets, topics, advertisers, ad_formats}` (A6) |

- **Inhalt:** wie v1 (A1b: `gleich: true`).
- **Ratenlimit:** 30/min je Funktion. Falsches `p_sort` → 400 `ads_invalid_param` (A7).
- **Anzeigen-URLs** sind die echten Ziel-URLs der Werbetreibenden. Links nur mit `rel="noopener noreferrer"` öffnen.

### Events
| neu | Antwort |
|---|---|
| `get_impact_event_v2(p_team, p_event_id)` | Detail |
| `cached_impact_event_analysis_v2(p_team, p_event_id, p_window_days, p_models, p_markets)` | `{event_id, event_date, windows, cohort, affected, comparison, comparison_delta, competitors, urls, trend, overlaps}` (E9) |
| `preview_impact_event_scope_v2(p_team, p_scope_mode, p_tag_ids)` | `{affected_prompt_count}` |
| `create_impact_event_v2(…wie v1…)` | Detail (E1) |
| `update_impact_event_v2(…wie v1…)` | Detail; `null` = unverändert, `""` = leeren (E3) |
| `add_impact_event_url_v2(p_team, p_event_id, p_url)` | Detail (E4) |
| `remove_impact_event_url_v2(p_team, p_event_id, p_url_id)` | Detail (E7) |
| `delete_impact_event_v2(p_team, p_event_id)` | `{ok, deleted_event_id}` (E14) |

**Detail** (E1–E7): `id, team_id, name, description, event_type, event_date, icon, color, cover, scope_mode, created_by, created_at, updated_at, can_delete, topics[{id,name,deleted}], selected_topic_count, affected_prompt_count, comparison_prompt_count, affected_url_count, urls[{id,url,url_input,team_kannte_url,created_at}]`.

Neu geprüft (früher frei):

| Feld | Regel |
|---|---|
| `p_name` | 1–120 Zeichen |
| `p_description` | höchstens 2000 Zeichen |
| `p_event_type` | `[a-z0-9_]`, höchstens 40 Zeichen |
| `p_icon` | `[a-z0-9_-]`, höchstens 40 Zeichen |
| `p_color` | `#RRGGBB` |
| `p_cover` | Kürzel wie `wave_blue` oder `https://…` (höchstens 2048 Zeichen) |
| URLs | ohne `javascript:` (E1b, E6) |

Fehlerfälle:

| Fall | Code |
|---|---|
| Fremdes Thema | `impact_event_invalid_topics` (E1d) |
| Doppelte URL | 409 `impact_event_url_duplicate` (E5) |
| Unbekanntes Event | 404 `impact_event_not_found` (E13) |
| Löschen durch jemand anderen als Ersteller/Owner/Admin | 403 `impact_event_forbidden` (E10) |

**Antworten auf die Fragen:**
- **a)** Erledigt: `p_team` und `p_tag_ids` überall.
- **b)** Bleibt so: Die schreibenden Funktionen antworten mit dem Detail.
- **c)** Ja, mit diesen Grenzen:
  - Schreiben 30/min, Anlegen zusätzlich 10/min.
  - Höchstens **200 Events je Team** (409 `impact_event_limit_reached`) und **100 URLs je Event** (409 `impact_event_too_many_urls`).
  - Lesen 120/min, Vorschau 60/min, Analyse 30/min.
- **d)** Ja, das reicht. Der Teil `events` in `team_context_v1` hat jetzt alle Felder der alten `list_impact_events_v1`: zusätzlich `description, cover, scope_mode, selected_topic_count, affected_prompt_count, comparison_prompt_count, affected_url_count, created_by, created_at, can_delete` (E11).

## 2 Quick-Actions-Suche: `quick_search_v1`

- **a)** `search_quick_actions_v2` war direkt aufrufbar und prüfte das Team. Es teilte sich aber das Ratenlimit `you_urls` (60/min) mit Create with AI. Beim Tippen brauchte es **1,7–3 s je Abfrage**, weil es jedes Mal alle URLs des Teams (877c: 65.837) einzeln faltete.
  - Neu ist `quick_search_v1` mit einem Suchindex je Team: **90–180 ms**.
  - In 20 Vergleichsabfragen kamen genau dieselben Treffer heraus wie beim alten Weg.
  - Gefilterte und gerankte Suchen (`p_rank`, `p_citation_type`, `p_url_type`, `p_market`, `p_mentioning`) laufen wie bisher (Q3).
- **b)** Parameter:

  | Komponente | Parameter | wirkt |
  |---|---|---|
  | query | `p_query` | ja, höchstens 200 Zeichen; Groß-/Kleinschreibung, Akzente, Leerzeichen, `_ / & ( ) -` werden gefaltet |
  | query_folded, query_de | – | **entfallen**; die DB bildet die Umlaut-Varianten selbst („mueller“ findet „Müller“ und umgekehrt, Q2b) |
  | scope | `p_scope` | `url`, `domain`, `brand`, `prompt` oder leer |
  | rank | `p_rank` | `top`, `trending` oder leer (mit Bereich `url`/`domain`) |
  | citation_type | `p_citation_type` | ja |
  | url_type | `p_url_type` | ja |
  | market | `p_market` | ja, 2 Buchstaben |
  | mentioning | `p_mentioning` | ja, UUID einer Marke |
  | limit | `p_limit` | 1–25 je Typ, Standard 5 |

  Antwort: Liste von Treffern `{type:'brand',id,name,logo}`, `{type:'domain',domain,favicon[,share_pct,trend_pct]}`, `{type:'url',url,title,favicon}`, `{type:'prompt',id,prompt_text,market}`. Weniger als 2 Zeichen ergeben `[]`.
- **c)** **300/min je Nutzer.** Bei 250 ms Drosselung tippt man höchstens 240/min. Der 301. Aufruf bekommt 429 `search_rate_limited` (R1).
- **d)** Bestätigt: Titel kommen als normales JSON, ohne `js_safe`.

## 3 Exporte (aus `export-data.js`)

| Typ | Funktion | Seite max | Formelschutz auf |
|---|---|---|---|
| Prompts | `export_prompts_v1` | 5000 | prompt_text, tags_text, top_mentions_text |
| Responses | `export_responses_v1` | 2000 | prompt_text, response_text, companies |
| Domains | `export_citations_domains_v1` | 10000 | domain |
| URLs | `export_citations_urls_v1` | 5000 | url, title, domain, mentions_all |
| Brands | **`export_brands_v2`** (neu) | 500 | name |

- **a)** `export_brands_v2(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode, p_search, p_order, p_offset, p_limit)`.
  - Gleiche Bauart wie die übrigen: `_ex_require_v1`, Blättern, `csv_safe_v1`, Ratenlimit.
  - Rechnung wie die Brands-Seite (`cached_competition_overview_v19`), Zeitraum höchstens 366 Tage (X1).
  - Den Namen `export_brands_v1` gibt es schon (alt, Edge `export`), daher `v2`.
- **b)** **Antwortform aller fünf:** `{meta: {…, offset, limit, total_count, has_more}, rows}`.
  - Weiterblättern mit `offset + limit`, solange `has_more` gilt.
  - Spalten in CSV-Reihenfolge mit englischer Kopfzeile liefert **`export_columns_v1(p_export)`** für `prompts | responses | domains | urls | brands` (X2): `rows: [{key, header, type}]`.
  - Für die CSV nur diese Schlüssel benutzen, nicht die Rohfelder (z. B. `tags_text` statt `tags`).
- **c)** Bestätigt: Jede Spalte mit `type: "text"` ist in der Funktion mit `csv_safe_v1` geschützt. Die übrigen Spalten sind Zahlen, Datumswerte, Ja/Nein, IDs oder feste Kürzel (Markt, Modell, Typ-Label). Beim Schreiben der CSV trotzdem jedes Feld in Anführungszeichen setzen und `"` verdoppeln.
- **d)** 60 Seiten je Minute, Nutzer und Export-Typ (`exports_rate_limited`, 429).
- **e)** Ist auf der Aufräumliste.

## 4 Gate
- **a)** Bestätigt: `billing_plans_v1`, `create-team-checkout` (`billing_checkout_prepare_v1`) und `team-billing-portal` (`billing_portal_prepare_v1`) prüfen nur Mitgliedschaft und Rolle, nicht den Zugang.
  - Getestet mit dem Team ohne Plan: Tarife und Kasse liefern 200 (G1, G2).
  - Portal ohne Stripe-Kunde liefert 409 `billing_no_customer` mit hint `checkout`. Dann zeigt das Gate die Kasse statt des Portals (G3).
  - **Zustände der DB** (nicht trial_expired/canceled/paused): `trial_ended`, `ended`, `past_due`, `unpaid`, `no_plan`, `deleted`. Dazu `canceling` mit Zugang (siehe APP_START_V1_VERTRAG, Abschnitt 3). Ein „paused“ gibt es nicht.
- **b)** Ja. Kasse und Portal erlauben nur owner und admin; ein Mitglied bekommt 403 `team_role_required` (G5). `app_start_v1.row.access.can_manage_billing` sagt vorher, ob ein Knopf gezeigt wird. Die Tarifliste dürfen alle Mitglieder lesen (G4).
- **c)** Siehe Aufräumliste: `get_billing_plans_v1`, Edge `create-billing-portal-session`, `get_team_billing_status_v1` (wenn Bubble-Gate weg), `get_team_plan_quota_v3`.

## 5 Vorlieben
- **a)** `user_settings_set_v1` kennt jetzt diese Schlüssel. `p_value: null` setzt einen Schlüssel auf den Standard zurück (P6).

  | Schlüssel | erlaubte Werte |
  |---|---|
  | `theme` | wie bisher |
  | `locale` | `en`, `de` |
  | `number_format` | `1,234.56`, `1.234,56`, `1 234,56`, `1'234.56` |
  | `date_format` | `DD.MM.YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD` |
  | `accent` | `#RRGGBB` (gespeichert klein) |

  - Die Antwort enthält alle Einstellungen (P1–P3).
  - **Die erlaubten Werte stehen an genau einer Stelle** (`_app_settings_allowed_v1`). Wenn deine Werte anders sind, schick sie mir; dann ist es eine Zeile.
- **b)** `app_start_v1.meta.settings` = `{theme, locale, number_format, date_format, accent}`; nicht gesetzte Werte sind `null` (P7).

## 6 Mira
- **a)** Heute ruft Bubble `create_mira_source_recommendation_v3(p_team, p_user, p_lead_url, p_title, p_reason, …)`.
  - Neu ist `opportunity_from_mira_v1(p_team, p_action_id, p_lead_url, p_title, p_reason)`.
  - Antwort: `{meta:{team_id, action_id, lead_url}, status: 'created'|'exists'|'no_data', recommendation}`. `recommendation` ist die Karte in der Form des Opportunity-Bretts.
  - Die URL kommt aus der gespeicherten Aktion (`mira_chat_message_action`, Typ `create_opportunity`). Weicht `p_lead_url` davon ab → 400 (M5). `p_lead_url` darf auch fehlen.
  - `p_title` und `p_reason` überschreiben die Vorschläge der Aktion.
  - Doppelklick und eine schon vorhandene Karte ergeben `exists` (M2, M3). Eine Aktion eines anderen Teams ergibt 404 (M4).
  - `no_data` heißt: Für diese URL gibt es keine Zitationsdaten im Zeitraum. Dann wird keine Karte angelegt.
  - Laufzeit beim ersten Anlegen ca. 7 s (wie heute in Bubble); Ladezustand zeigen. Ratenlimit 20/min.
- **b)** Ja. `opportunities_set_status_v1(p_team, p_ids: [recommendation.id], p_status)` mit `Created | In Progress | Ignored | Done` (M6). `previous_status` braucht die DB nicht; die Antwort nennt `old_status`.

## 7 Seitenleiste
- **a)** `app_start_v1.row.prompt_count` (aktive Prompts, P7). `team_context_v1(team, ['counts'])` → `{counts: {prompt_count, prompt_count_inactive}}` (T1). `counts` ist auch im Standard (ohne `p_parts`) dabei.
- **b)** Den neuen Teil `teams` gibt es jetzt: `team_context_v1(team, ['teams'])` liefert dieselbe Liste wie `app_start_v1.meta.teams`.
  - Er funktioniert **auch für ein Team ohne Zugang** (T2), solange nur `['teams']` angefragt wird.
  - Zusammen mit anderen Teilen gilt die Zugangsprüfung (T3).
- **c)** Zur Kenntnis genommen.

## 8 Beobachten → Aufräumliste
Steht in `AUFRAEUMEN_NACH_UMBAU.md`, Abschnitt „Vor Next.js“, mit den heutigen Aufrufzahlen als Grundstand.

---

## Einspielen (Lukas, ein Block)
`vor_nextjs_v1.sql` nach den `app_start_*.sql`. Die Datei baut den Suchindex für alle Teams auf; das dauert ca. 20 s.

Testabfrage am Ende:

| Spalte | erwarteter Wert |
|---|---|
| `neue_funktionen` | 32 |
| `sicherungen` | 4 |
| `prefs_spalte` | 1 |
| `anon_darf` | 0 |
| `suchindex_zeilen` | > 0 (heute ca. 340.000) |

Rückweg: `vor_nextjs_v1_rueckweg.sql`.
