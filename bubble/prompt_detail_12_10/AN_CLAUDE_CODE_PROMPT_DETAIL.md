# An Claude Code: Prompt Detail v1 ist gebaut (12.10.2026)

Lukas spielt `prompt_detail_v1.sql` ein, danach `prompt_alt_absichern.sql`. Echte, ungekürzte Antworten liegen in `prompt_detail_v1_echte_antworten.json` (Team 877c, Prompt `b3d6c14b-…`, 7 Tage): Kopf, Visibility, Overview, Citations (Overview Domain und URL, Domains, URLs), Responses (erste Seite und Suche), Export, ohne Topics, ohne Läufe im Zeitraum und jede Fehlerform.

## 1. Kopf: `prompt_detail_v1`
`POST /rest/v1/rpc/prompt_detail_v1` mit `{ p_team, p_prompt_id }` (Header `Content-Profile: app`, Nutzer-JWT)
```
{ meta: { team_id, prompt_id, data_as_of },
  row:  { prompt_id, prompt_text, market,
          tags[]: { id, name, emoji, hex_light, hex_dark },   // [] ohne Topics
          created_at, last_run_at, next_run_at,               // next_run_at nur bei aktiv
          status: 'active' | 'paused', paused_reason: null | 'plan_limit',
          models[]: { model_key, display_name } } }           // Modelle, mit denen das Team läuft
```
Der Kopf hat keinen Zeitraum. Sichtbarkeit, Ø-Rang und Stimmung (jeweils mit Delta) kommen aus der Overview, siehe 2.

## 2. Komponenten: dieselben RPCs wie Dashboard und Citations, mit `p_prompt_id`
| Komponente | RPC | Hinweis |
|---|---|---|
| Kennzahlen im Kopf | `cached_dashboard_overview_v1(…, p_prompt_id)` | Objekt `own`: `visibility_pct`, `avg_rank`, `sentiment`, jeweils mit `_prev` und `_delta` |
| Visibility Chart + Tabelle | `cached_dashboard_visibility_v1(…, p_prompt_id)` und `cached_dashboard_overview_v1(…, p_prompt_id)` | wie im Dashboard |
| Top Citations | `cached_citations_overview_v1(…, p_mode, p_prompt_id)` für den Ring, `cached_citations_domains_v1` / `_urls_v1(…, p_prompt_id)` für die Liste | wie in Citations |
| Responses | `cached_dashboard_responses_v1(…, p_prompt_id)` | `meta.filters.prompt_id` gesetzt |
| Export | `export_responses_v1(…, p_prompt_id)` | Bubble-Workflow: `prompt_id` als `p_prompt_id` durchreichen, leer heißt `null` |

**Regeln:**
- `p_prompt_id` ist überall der letzte, optionale Parameter. Ohne ihn ist alles wie bisher; das Dashboard ist unverändert.
- Mitgeben: Kalender (`p_date_from`, `p_date_to`) und Modelle (`p_models`). Märkte und Topics nicht.
- Geprüft: Die Responses zählen genau die Läufe des Prompts im Zeitraum. In 7 Tagen sind das 18, in 30 Tagen 86; Export und Läufe zeigen jeweils dieselbe Zahl.
- Ohne Läufe im Zeitraum: Alle Komponenten liefern leer bzw. 0, ohne Fehler. Den Leerzustand zeigen.
- Ein fremder Prompt in diesen RPCs liefert leer, ohne Fehler. Nur `prompt_detail_v1` sagt `prompt_not_found`.

## Fehler von `prompt_detail_v1` (`message` = Code)
| SQLSTATE | message | hint | Drawer |
|---|---|---|---|
| 28000 | `settings_not_authenticated` | – | Anmeldung |
| 42501 | `team_forbidden` | – | kein Zugriff |
| PT404 | `team_deleted` | – | Team gelöscht |
| PT402 | `team_access_<state>` | Zustand | Hinweis auf Abo |
| 22023 | `team_invalid_param` | `p_prompt_id` | – |
| PT404 | `prompt_not_found` | – | „Dieser Prompt existiert nicht mehr.“ (auch fremd oder gelöscht; alte Pins) |
| PT429 | `prompt_rate_limited` | Sekunden | kurz warten |

## Laufzeit (7 Tage, kalt)
- `prompt_detail_v1`: um 40 ms.
- Overview: 85 ms.
- Responses: 25 ms.
- Citations Overview: 100–140 ms.
- Citations-URLs: 130 ms.
- Visibility: 880 ms.
- Citations-Domains: 1,6 s.

Warm kommen alle Komponenten aus dem Cache.

## Alt bleibt
`get_prompt_detail_bundle_v6` bleibt für Bubble und prüft nach `prompt_alt_absichern.sql` zusätzlich den Zugang.
