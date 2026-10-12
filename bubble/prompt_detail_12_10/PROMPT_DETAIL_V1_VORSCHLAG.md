# Prompt Detail als selbstladender Drawer: Bestandsaufnahme, Prüfung, Vorschlag (12.10.2026)

Nichts geändert. Tests liefen in Transaktionen, die danach zurückgerollt wurden, im Team 877c als Owner. Beilage: `get_prompt_detail_bundle_v6_definition.sql` (vollständige Definition).

Prompt mit den meisten Läufen in 877c: `b3d6c14b-166c-4b05-894e-2656ec246d6a` („beste Limousine für Familien mit viel Komfort und Sicherheit …“, DE, 3 Topics). Er hat 86 Läufe in 30 Tagen; mehr hat kein Prompt, denn jeder Prompt läuft je Modell einmal am Tag.

## 1. Befunde nach Schwere

| # | Schwere | Befund | Vorschlag |
|---|---|---|---|
| P1 | **hoch** | `get_prompt_detail_bundle_v6` prüft **keinen Zugang**. Ein Team ohne Plan (Factory Bottrop) bekommt Kopf und Kennzahlen. Die Funktion ist für **PUBLIC** ausführbar; `anon` scheitert erst an „not authenticated“. Dasselbe gilt für `get_prompt_detail_bundle` ohne Nummer. | v1 nach Bauart. Absicherung der Altversionen wie bei der URL in einer eigenen kleinen Datei: v6 prüft Zugang, PUBLIC/anon raus. |
| P2 | mittel | **Kein „nicht gefunden“.** Ein fremder Prompt mit eigenem Team liefert `header: null` und lauter Nullen. Der Text wird **nicht** verraten, aber man kann leer und fremd nicht unterscheiden. | `prompt_not_found` (PT404). |
| P3 | mittel | **Altes Ratenlimit** `check_rate_limit('prompt_detail', 30)` (Deadlocks), Fehler als P0001-Text. | `_pi_rate_limit_v1('prompt_detail', 120, 'prompt')` → `prompt_rate_limited`. |
| P4 | mittel | **Zeitraum anders als überall sonst:** ohne Angabe 7 Tage (Dashboard: 30). Die Stimmung (`avg_sentiment_30d`) gilt fest für die letzten 30 Tage, egal welcher Zeitraum gewählt ist. | Kennzahlen kommen künftig aus den Dashboard-RPCs mit `p_prompt_id` (gleiche Regeln, 30 Tage). |
| P5 | niedrig | Der Name der eigenen Marke für die Rangsuche ohne `company_id` ist der Firmenname, nicht der Override. Wirkt nur, wenn ein Team keine eigene Marke als Firma hat. | In v1 entfällt diese Rechnung (siehe B). |
| P6 | niedrig | v6 liefert weder letzten Lauf noch Status (aktiv/pausiert) noch Modelle. `p_limit`/`p_offset` sind Parameter, werden aber nicht benutzt. | v1 liefert sie. |
| P7 | info | Gelöschte Prompts: Im Bestand gibt es **keine** Zeile mit `deleted_at`. Gelöscht wird endgültig (Prompt-Löschjob); ein alter Pin zeigt dann auf nichts. v6 würde einen Prompt mit `deleted_at` normal zeigen. | v1: `deleted_at` gesetzt oder Zeile fehlt → `prompt_not_found`. |

**Fremder Text:**
- Prompt-Texte: höchstens 166 Zeichen, keine Steuerzeichen, kein HTML, kein Backtick/`${`/Backslash.
- Topic-Namen: höchstens 29 Zeichen, sauber.

**Schreiben beim Lesen:** nur der Zähler des alten Ratenlimits.

## 2. Bestandsaufnahme

**v6:** `get_prompt_detail_bundle_v6(p_team, p_prompt_id, p_date_from, p_date_to, p_models text[], p_limit, p_offset)` → reines `jsonb`, **kein Umschlag**, keine verdoppelten Backslashes.

| Teil | Inhalt | Für den neuen Kopf |
|---|---|---|
| `header` | prompt_id, prompt_text, market, created_at, tags[] | ja |
| `timeseries` | Sichtbarkeit der **eigenen** Marke je Tag | nein, kommt aus Visibility |
| `trend` | Sichtbarkeit jetzt / Vorperiode / Delta | nein, kommt aus Overview |
| `model_split` | Anteil der Nennungen je Modell | nein |
| `rank_summary` | r1–r5, Ø-Rang | nein, kommt aus Overview |
| `avg_sentiment_30d` | Ø-Stimmung, fest 30 Tage | nein, kommt aus Overview |

Die Tags sind sauber: Ohne Topics kommt `[]`, nicht `[{id:null}]`.

**Bubble-Komponenten im Prompt-Drawer** (`pg_stat_statements`, Aufrufe mit `p_prompt_id`):

| Komponente | RPC | Laufzeit (30 Tage, kalt) |
|---|---|---|
| Visibility Chart | `cached_competition_chart_v15(p_prompt_id, …)` | 26 ms |
| Top Citations | `cached_citation_overview_v14(p_prompt_id, …)` | 825 ms |
| Responses | `cached_mentions_overview_v1(p_prompt_id, …)` | 366 ms |

Die Bubble-Komponenten nehmen ebenfalls Kalender und Modelle.

**Prompt-Einschränkung in den neuen RPCs:**
- **Responses:** Die Basis `_dash_responses_base_v1` kennt `p_prompt_id` schon. `_dash_responses_calc_v1` reicht `null` durch, genau wie damals bei `p_url`.
- **Dashboard Visibility / Overview und Citations Overview / Domains / URLs:** Es gibt keinen Parameter, aber jede Rechnung holt ihre Prompts aus einem von drei Helfern:

  | Helfer | genutzt von |
  |---|---|
  | `_dash_scope_v1` | Temp-Tabelle `_dd_prompts`, Schalter `has_pf` |
  | `_citations_f_scope_v1` | Temp-Tabelle `_cs_prompts` |
  | `_citations_g_prompts_v1` | Array für Domains und URLs |

  Dort reicht eine zusätzliche Bedingung `p0.id = prompt_id`. Bei `has_pf` muss zusätzlich `prompt_id` gelten, damit Sichtbarkeit und Rang aus den Prompt-Tabellen gerechnet werden.
- **Export:** `export_responses_v1` braucht einen Filter `pr.prompt_id = p_prompt_id`.

**Zeitraum und Modelle:**
- Dashboard und Citations: `_dash_params_v1`. Ohne Angabe gelten die letzten 30 Tage (Berlin); der Zeitraum ist höchstens 366 Tage lang. Modelle `null` heißt alle.
- v6: ohne Angabe 7 Tage (P4).

**Market und Topics:**
- Beides kommt aus dem **heutigen** Prompt (`prompt.market`, `prompt_tag`). Ein Lauf speichert keinen Markt.
- Ein Prompt hat genau **einen** Markt (Text, z. B. `DE`).

**Laufzeit:** v6 kalt 415 ms, warm 14 ms.

**Ratenlimit:** 30 je Minute (alt).

**Fremde Kennungen:**
- Fremdes `p_team` → `forbidden`.
- Fremder Prompt → leeres Ergebnis ohne Text (P2).

## 3. Vorschlag

### A. `prompt_detail_v1(p_team, p_prompt_id)` → `{meta, row}`
Bauart wie `url_detail_v1`: `_set_require_v1`, dann Zugang (PT402), dann `_pi_rate_limit_v1('prompt_detail', 120, 'prompt')`.
```
{ meta: { team_id, prompt_id, data_as_of },
  row:  { prompt_id, prompt_text, market,
          tags[]: { id, name, emoji, hex_light, hex_dark },     // [] ohne Topics
          created_at, last_run_at, next_run_at,
          status: 'active' | 'paused',                         // gelöscht → prompt_not_found
          paused_reason: null | 'plan_limit',                  // Plan-Limit-Pause (plan_paused_at)
          models[]: { model_key, display_name }                // aktive Modelle des Teams
} }
```
**Kennzahlen:** Kopf-Kennzahlen (Sichtbarkeit, Ø-Rang, Stimmung mit Delta) kommen nicht aus `prompt_detail_v1`, sondern aus `cached_dashboard_overview_v1` mit `p_prompt_id` (Zeile der eigenen Marke). So gelten dieselben Regeln wie im Dashboard und der Kalender wirkt überall gleich.

**Fehler:**

| SQLSTATE | message | hint |
|---|---|---|
| 28000 | `settings_not_authenticated` | – |
| 42501 | `team_forbidden` | – |
| PT404 | `team_deleted` | – |
| PT402 | `team_access_<state>` | Zustand |
| 22023 | `team_invalid_param` | `p_prompt_id` |
| PT404 | `prompt_not_found` | – (auch fremd oder gelöscht) |
| PT429 | `prompt_rate_limited` | Sekunden |

### B. `p_prompt_id uuid default null` in sieben RPCs
Gemeint sind `cached_dashboard_visibility_v1`, `_overview_v1`, `_responses_v1`, `cached_citations_overview_v1`, `_domains_v1`, `_urls_v1` und `export_responses_v1`. Bauart wie bei `p_url`:
- Der Parameter kommt am Ende dazu. Die alte Signatur wird in derselben Transaktion ersetzt, damit PostgREST eindeutig bleibt. Bisherige Aufrufe laufen unverändert.
- `prompt_id` kommt nur in die Parameter (und damit in den Cache-Schlüssel), wenn er gesetzt ist. Die Cache-Einträge des Dashboards bleiben gleich.
- Ein Prompt eines fremden Teams ergibt leere Ergebnisse (kein Fehler), denn die Scope-Helfer filtern ohnehin auf `team_id`.
- Die drei Scope-Helfer bekommen die Prompt-Bedingung, die Responses-Rechnung reicht `prompt_id` durch, und der Export filtert auf `pr.prompt_id`.

### C. Prüfung nach dem Bau
- `total_count` der Responses mit `p_prompt_id` = Läufe des Prompts im Zeitraum, aus `daily_runs_by_prompt_model`. Für 877c/b3d6c14b sind das 86 in 30 Tagen.
- Der Export liefert dieselbe Zahl.

**`get_prompt_detail_bundle_v6` bleibt** für Bubble und wird nur abgesichert.

## 4. Zu entscheiden (Lukas)
1. **Kopf-Kennzahlen** aus `cached_dashboard_overview_v1` mit `p_prompt_id` statt aus einem eigenen Bundle? Vorschlag: ja, eine Quelle für alle Zahlen.
2. **Ohne Zeitraum** 30 Tage wie überall (Bubble-v6 nahm 7)? Vorschlag: ja.
3. **B:** sieben Signaturen in einem Schritt ersetzen (mit Rückweg), wie bei `p_url`?

Nach Freigabe baue ich in einem Durchgang, je mit Rückweg und echten Antworten:
- `prompt_detail_v1.sql`;
- die Erweiterung der sieben RPCs;
- die Absicherung von v6 und `get_prompt_detail_bundle`.

## 5. Gebaut (12.10.2026, nach Freigabe)
**Entscheidungen:**
- Kopf-Kennzahlen aus `cached_dashboard_overview_v1` mit `p_prompt_id`.
- Der Zeitraum kommt immer vom Kalender (Standard dort: 7 Tage); an den Standards der RPCs ändert sich nichts.
- Sieben Signaturen werden in einem Schritt ersetzt.

**Dateien** (je ein Block, mit Rückweg):
1. `prompt_detail_v1.sql`:
   - `prompt_detail_v1`;
   - die Prompt-Bedingung in `_dash_scope_v1`, `_citations_f_scope_v1` und `_citations_g_prompts_v1` (nur aktiv, wenn `prompt_id` gesetzt ist);
   - `_dash_responses_calc_v1` reicht `prompt_id` an die Basis durch;
   - `p_prompt_id` in sieben RPCs.
2. `prompt_alt_absichern.sql`: v6 und `get_prompt_detail_bundle` prüfen den Zugang; PUBLIC/anon raus.

**Geprüft** (Rollback; `prompt_detail_v1_echte_antworten.json`):
- C: Responses = Export = Läufe: 18 in 7 Tagen, 86 in 30 Tagen.
- Ohne Läufe im Zeitraum und mit fremdem Prompt ist alles leer, ohne Fehler.
- Alle Fehlerformen geprüft, Ratenlimit greift beim 121. Aufruf.
- v6 ohne Zugang wird abgelehnt.
