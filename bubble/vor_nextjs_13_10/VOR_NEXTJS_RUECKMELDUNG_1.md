# Vor Next.js v1: Rückmeldung 1 an den DB-Chat (13.10.2026)

Danke, der Vertrag ist angenommen. Gebaut und gemessen gegen `vor_nextjs_v1_echte_antworten.json` (Prüfstände gr01, mira02, shopv2, adsv2, evv2). Alle Komponenten fallen auf den Bubble-Weg zurück, solange eine Funktion fehlt (404 PGRST202). Ein Pin vor der SQL schadet also nicht.

## Gebaut

| Abschnitt | Stand |
|---|---|
| 1 Shopping, Ads, Events | alle `_v2` direkt; Ads mit `p_team`/`p_tag_ids` |
| 2 Suche | `quick_search_v1` aus core, für Palette, Mira-„+“ und Event-Dialog; `query_folded`/`query_de` gehen nicht mehr hinaus |
| 3 Export | `export_columns_v1` + Blättern über `has_more` + CSV im Browser (BOM, jedes Feld in Anführungszeichen) |
| 4 Gate | `billing_plans_v1`, `create-team-checkout`, `team-billing-portal`; Knöpfe nur bei `can_manage_billing` |
| 6 Mira | `opportunity_from_mira_v1` (created/exists/no_data), Status über `opportunities_set_status_v1` |
| 7 Seitenleiste | `row.prompt_count`, Teil `counts` nach jedem Topics-/Märkte-Nachladen, Teil `teams` nach „Your Brand“ gespeichert |

## Vier Bitten

**1. Vorlieben (Abschnitt 5): bitte unsere Werte in `_app_settings_allowed_v1`.**

Die App schreibt diese Werte schon seit Wochen in den Browser. Ein Umrechnen geht nicht, weil zwei Datumsformate bei dir kein Gegenstück haben.

| Schlüssel | Werte der App | Anzeige |
|---|---|---|
| `locale` | `en`, `de` | wie bei dir |
| `number_format` | `en`, `de` | `1,234.56` bzw. `1.234,56` |
| `date_format` | `d-mon-y`, `mon-d-y`, `d-m-y`, `iso` | `12. Dec 2025`, `Dec 12, 2025`, `12.12.2025`, `2025-12-12` |
| `accent` | `default`, `standard-blau`, `azur`, `indigo`, `terrakotta` | Namen, keine Hex-Werte (die Farbe hängt am Thema) |

Bis du das bestätigst, ist das Speichern im Konto in core abgeschaltet (`VORLIEBEN_DB = false`). Gemessen mit eingeschaltetem Schalter gegen einen Stub:
- 3 Schlüssel gehen hinaus;
- `date_sync` nicht;
- der Start schreibt nichts zurück;
- Werte aus `meta.settings` werden übernommen.

**2. `export_prompts_v1`: bitte die Signatur.**
- Sie steht in keiner SQL-Datei im Repo.
- Die Komponente schickt `p_team, p_date_from, p_date_to, p_offset, p_limit`.
- Passt das nicht, findet PostgREST die Funktion nicht, und dieser eine Typ geht zurück an Bubble.
- Bitte bestätigen oder die Parameter nennen.

**3. Ads: große IDs als Text?** `campaign_id`, `ad_account_id`, `ad_id`, `ad_group_id`.
- Bisher hat der Bubble-Text sie geschützt.
- Jetzt parst der Browser das JSON selbst, und eine Zahl über 2^53 verliert Stellen.
- Bitte bestätigen, dass die `_v2` sie immer als Text schicken (wie `source_product_id` bei Shopping).

**4. `list_ads_prompts_v2`: kommen `limit` und `offset` immer mit?** Der Vertrag sagt `{items, …}`, Fall A5 hatte beide.

**5. Shopping: `source_product_id` immer als Text?** In S2 und S3 ist es so. Bitte für alle `_v2`-Antworten bestätigen (selber Grund wie bei 3).

**6. Events:**
- **a)** Die Komponente schickt Icon-Namen jetzt in deiner Form `[a-z0-9_-]` (`file-text` statt `fileText`) und eigene Typen als Schlüssel (`podcast_launch`). Bitte bestätigen, dass `_v2` beides annimmt. Alte Events mit camelCase-Icon werden nur angefasst, wenn sich das Feld ändert.
- **b)** Der `hint` bei einer ungültigen URL ist in E1b die URL selbst, in E6 `p_url`. Bitte in beiden Fällen den Feldnamen (der Client kommt mit beidem klar).
- **c)** Nimmt `p_color` Großbuchstaben? Der Client schickt klein.

## Aufräumen

Nach Einspielen der SQL und dem Pin werden diese Bubble-Wege nicht mehr ausgelöst:
- Shopping, Ads, Events: alle `_v1` mit Umschlag;
- Quick Actions: Suche über den Connector;
- Export: Edge `export` und die alten `export_*`;
- Gate: Tarife und Portal;
- Mira: `create_mira_source_recommendation_v3` aus Bubble;
- Seitenleiste: `get_team_brand_header_v9`.

Wie gehabt: eine Woche beobachten, dann in die Liste.
