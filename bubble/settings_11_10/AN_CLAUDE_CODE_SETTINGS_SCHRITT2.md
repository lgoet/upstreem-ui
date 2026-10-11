# An Claude Code: Settings v1, Schritt 2 (Your Brand speichern) ist gebaut (11.10.2026)

Datei `settings_v1_brand.sql`, spielt Lukas ein. Vertrag: `SETTINGS_V1_VORSCHLAG.md` Abschnitt 12. Echte Antworten: `settings_v1_brand_echte_antworten.json`.

| Funktion | Aufruf | Antwort |
|---|---|---|
| `settings_brand_save_v1` | `{p_team, p_market_id?, p_business_model?, p_industry?, p_summary?, p_name?}` | wie `settings_brand_v1`, dazu `meta.changed[]` und `meta.unchanged` |
| `settings_brand_logo_v1` | `{p_team, p_logo_url}` | wie `settings_brand_v1`, dazu `meta.unchanged` |
| `team_models_set_v1` | `{p_team, p_model_keys: ['chatgpt', …]}` | `meta.changed{on[], off[]}`, `rows` in Modellzeilenform |

**Wichtig für die Seite:**
- Nur geänderte Felder schicken: weglassen bzw. `null` heißt unverändert, `''` heißt leeren.
- `p_name` ist neu und optional: Override des Markennamens, `''` setzt ihn zurück.
- Das Geschäftsmodell geht als `b2b`, `b2c` oder `hybrid` hinaus, der Markt als Code, z. B. `DE`.
- Das Logo muss mit `https://` anfangen.
- Ohne Zugang (Abo beendet, kein Plan) kommt PT402 `team_access_<state>`. Dazu passt `settings_page_meta_v1.row.reasons.can_edit_brand = 'no_access'`.
- Fehlercodes stehen in Abschnitt 12. `settings_too_long` trägt im hint `feld:max`.

Als Nächstes Schritt 3: Einladungen über `team-invite-send` (10.4).
