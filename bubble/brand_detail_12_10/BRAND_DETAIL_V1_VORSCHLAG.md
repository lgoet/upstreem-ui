# Brand-Drawer als selbstladender Drawer: Bestandsaufnahme, Prüfung, Vorschlag (12.10.2026)

In dieser Runde wurde nichts geändert. Die Tests liefen in Transaktionen, die danach zurückgerollt wurden, im Team 877c als Owner.

Verwendete Marken:
- eigene Marke: Mercedes Benz `87468f49-…`;
- großer Wettbewerber: BMW `6da83f4f-…`;
- inaktive Marke: Kompyte im Team upstreem, archiviert. 877c hat keine archivierte Marke.

## 1. Befunde nach Schwere

| # | Schwere | Befund | Vorschlag |
|---|---|---|---|
| M1 | **hoch** | `get_company_detailed_overview_v4`, `…chart_v3/v4`, `get_company_brand_name_variations_v2` prüfen **keinen Zugang**. Ein Team ohne Plan (Factory Bottrop) bekommt Kopf, Aliase und Zahlen. Alle sind für **PUBLIC** ausführbar; `anon` scheitert erst an „not authenticated“. `chart_v4` ist `security definer` **ohne** `search_path`. Dasselbe gilt für `export_domains_v1` und `export_urls_v1` (alte Exporte). | Absicherungsdatei wie bei URL und Prompt: Zugang plus `search_path` für die von Bubble genutzten, PUBLIC/anon raus. |
| M2 | **hoch** (offen seit Brands, F6) | `get_company_edit_v2` liefert für eine **fremde** Firma Name, Domain und Favicon aus der globalen Tabelle (geprüft mit Kompyte in 877c). | In der Absicherungsdatei: Firma muss im Team getrackt oder archiviert sein, sonst `brand_not_found`. |
| M3 | mittel | **Responses:** In der Basis `_dash_responses_base_v1` ist `p_company` mit `p_company_ids` per **ODER** verknüpft, nicht per UND. Der Tabellenfilter würde den Drawer also aufweichen. Zusätzlich macht `p_company` die Marke zur „Messmarke“: `user_rank` und `user_sentiment` der Zeilen gelten dann für diese Marke statt für die eigene. | `p_brand` als **UND**-Bedingung. Messmarke = `p_brand`, siehe Entscheidung 2. |
| M4 | mittel | **Citations:** `p_mentioned_brands` bedeutet „die **zitierte Seite** erwähnt die Marke“ (`url_company_mention`), **nicht** „die Antwort nennt die Marke“. Der Ring (`cached_citations_overview_v1`) ignoriert den Filter ganz und rechnet ungefiltert; Domains und URLs filtern danach. Das Layout verlangt „aus den Antworten, die diese Marke nennen“; das gibt es heute nicht. | Entscheidung 1. |
| M5 | mittel | **Altes Ratenlimit** `check_rate_limit` (30/min, Deadlocks) in v4 und den Varianten v2. Fehler kommen als P0001-Text. | Neue Wege nutzen `_pi_rate_limit_v1` bzw. `_perf_rate_limit_v1`. |
| M6 | niedrig | **Kopf in v4:** Das Logo der eigenen Marke beginnt mit `//`, also ohne `https:` (Mercedes). Die Domain kommt mit `www.` (`www.mercedes-benz.de`). Wettbewerber zeigen das Favicon (Regel erfüllt). | `brand_detail_v1`: `https:` ergänzen, Domain ohne Schema und ohne `www.`. |
| M7 | niedrig | **Variationen:** v2 liefert höchstens 100 Zeilen, `performance_brand_variations_v1` alle (BMW, 30 Tage: 307). Kalt dauert das 3,8 s, danach kommt es aus dem Cache. | Drawer: `p_limit` 25–50 und nachladen. |
| M8 | niedrig | `avg_rank_delta` rundet in v4 anders als in der Overview (BMW: −0,16 gegenüber −0,17). v4 rechnet mit ungerundeten Werten. | Unkritisch; der Drawer nimmt die Overview. |

**Fremde Kennung:**

| Aufruf | Ergebnis |
|---|---|
| v4 mit fremder Marke, eigenes Team | **leeres Ergebnis** (keine Zeile, kein Fehler, nichts verraten) |
| `performance_*` mit fremder Marke | `PT404 performance_not_found` |
| v4 mit fremdem `p_team` | `forbidden` |
| inaktive Marke (upstreem/Kompyte) | v4 leer, `performance_*` → `performance_not_found` |

**Fremder Text:**
- Firmenname höchstens 85 Zeichen, Team-Override höchstens 20, ohne Steuerzeichen oder HTML.
- Favicons und Firmen-URLs sind alle `https`.
- Team-Logos: 2 beginnen mit `//`. Ein Logo mit `javascript:` ist durch den Speicherweg aus Brands v1 bereits verhindert (nur `https://`).

**Schreiben beim Lesen:** v4 und die Varianten v2 nur den Zähler des alten Ratenlimits; die Varianten v1 schreiben in den Cache.

## 2. Bestandsaufnahme

**Bubble im Brand-Drawer** (`pg_stat_statements`, Aufrufe mit `p_company`):
- `get_company_detailed_overview_v4`: Kopf und Kennzahlen.
- `get_company_detailed_chart_v4` (davor v3): Kurve.
- `get_company_brand_name_variations_v2`: Varianten.
- `cached_citation_overview_v14(p_company)`: Top Citations.
- `cached_mentions_overview_v1(p_company)`: Responses.

Top Citations und Responses gibt es also schon im Bubble-Drawer. Dort ist `p_company` die „Messmarke“ mit ODER, also nicht dasselbe wie das Layout.

**`get_company_detailed_overview_v4(p_team, p_company, p_tag_ids, p_tagmode, p_markets, p_models, p_date_from, p_date_to, p_prompt_id)`:**
- Liefert eine Tabelle mit einer Zeile, kein jsonb.
- Felder: name, role, color, domain, aliases[] (id, pattern, mode, priority), logo_url, `avg_visibility_pct`, `avg_rank`, `avg_sentiment` mit `_prev`/`_delta`, `mentions_now`/`_prev`, `total_runs_now`/`_prev`, `last_seen_run_at`, `overall_rank_visibility` (Platz unter allen Marken) und `overall_companies_count`.
- Der neue Weg verliert nichts:

  | v4 | neuer Weg |
  |---|---|
  | Kennzahlen | Overview |
  | Platz | `position` in der Overview |
  | Anzahl Marken | `field.brand_count` |
  | `last_seen_run_at` | `brand_detail_v1.last_mentioned_at` |
  | Aliase | Bearbeiten (Brands v1) |

**Kennzahlen gegen die Overview** (30 Tage): `cached_dashboard_overview_v1(p_companies=[BMW], p_limit 1)` ergibt **dieselben Werte**.

| | Overview | v4 |
|---|---|---|
| Sichtbarkeit | 36,35 | 36,35 |
| Rang | 4,89 | 4,89 |
| Stimmung | 76,53 | 76,53 |
| Nennungen | 2.997 | 2.997 |
| Läufe | 8.245 | 8.245 |

Prev-Werte gleich, Deltas bis auf M8. Mercedes stimmt ebenso.

Wo die Marke steht:
- Mit `p_companies=[BMW]` steht BMW in `rows`. Die **eigene Marke steht immer in `own`**, auch wenn sie nicht in `p_companies` ist.
- Mit `p_companies=[eigene]` steht sie in `own` und in `rows`.

**Kurve:** `performance_company_chart_v1` = `…chart_v4`, **Wert für Wert gleich**. Geprüft für BMW mit Rang je Woche (30 Tage), Stimmung je Monat (30 Tage) und Stimmung je Tag (7 Tage).
- Alle Filter (Zeitraum, Modelle, Märkte, Topics und Tagmode) sind da.
- Ohne Topics gilt alles.
- **Tage ohne Nennung:**
  - Stimmung und Rang: `null`.
  - Sichtbarkeit: `0`, wenn es Läufe gab; `null`, wenn es keine Läufe gab.
- Die Kurve ist **nicht** gecacht (6–45 ms).

**Varianten:** `performance_brand_variations_v1` = v2 für dieselben Zeilen (BMW: 857 Läufe, 20,77 %, Summe 4.127). v1 liefert alle Zeilen statt höchstens 100.

**Domain und Logo:**
- Domain: Host aus `company.url` (alle https, max. 69 Zeichen).
- Anzeigename: `team_brand_profile.name_override`, sonst `company.name`.
- Logo: eigene Marke `logo_override_url`, sonst `company.favicon_url`; Wettbewerber `company.favicon_url`.
- Farbe: `team_company_settings.color_override`, sonst `company.default_color`. In 877c ist beides leer.

**Ratenlimit:**

| Funktion | Grenze |
|---|---|
| v4, Varianten v2 | 30 je Minute (alt) |
| `performance_*` | 60 je Minute |
| Dashboard | 60 je Minute |

## 3. Vorschlag

### A. `brand_detail_v1(p_team, p_company)` → `{meta, row}`
Bauart wie `prompt_detail_v1`.
```
row: { company_id, name, domain, logo_url, favicon_url, role, status: 'active'|'inactive',
       color, tracked_since, last_mentioned_at, deactivated_at (bei inaktiv) }
```
- `status 'inactive'`, wenn die Marke im Archiv des Teams steht; dann `role 'competitor'`.
- Fremd oder unbekannt → `brand_not_found` (PT404), ohne Unterschied.
- Fehler wie beim Prompt: `brand_rate_limited`, `team_*`, `settings_not_authenticated`.

### B. `p_brand uuid` in `cached_dashboard_responses_v1` und `export_responses_v1`
- „Die Antwort nennt diese Marke“, **UND** mit `p_company_ids`.
- Messmarke für Rang und Stimmung der Zeilen ist `p_brand`, siehe Entscheidung 2.
- Wie `p_prompt_id`: letzter Parameter, Signatur ersetzen, nur bei Angabe in den Cache-Schlüssel, `meta.filters.brand` gesetzt.
- Technisch:
  - Die Basis bekommt eine eigene UND-Bedingung; das ODER von `p_company` bleibt unberührt. `p_company` übergibt heute nur `null`.
  - Der Export filtert über `recommendation`.

### C. Citations, siehe Entscheidung 1
- **(a)** Die vorhandenen Parameter nehmen: `p_mentioned_brands=[id]` in Domains und URLs (und in deren Exporten, die ihn schon kennen). Bedeutung: „Seiten, die die Marke erwähnen“. Der Ring bliebe ungefiltert.
- **(b)** Neu `p_brand` in `cached_citations_overview_v1`, `_domains_v1`, `_urls_v1` und den beiden Exporten. Bedeutung: „Quellen in Antworten, die die Marke nennen“, wie im Layout. Das ist eine neue Rechnung über die Läufe statt über die Rollups.
  - BMW hat in 30 Tagen rund 3.000 Läufe mit Nennung und etwa 30.000 zitierte Adressen.
  - Gecacht wie die übrigen Citations.
  - Kalt dauert sie voraussichtlich länger als die Rollups, unter 1 s.
  - `runs_with_any` ist dann die Zahl der Läufe mit Nennung und mindestens einer Quelle.

### D. Prüfung nach dem Bau
- `total_count` Responses mit `p_brand` = `mentions` der Overview (Läufe mit Nennung).
- Bei (b): `runs_with_any` ≤ `mentions`. Die Differenz sind Läufe ohne Quelle.

**v4 und chart_v4 bleiben** für Bubble und werden nur abgesichert (M1, M2).

## 4. Zu entscheiden (Lukas)
1. **Top Citations: (a) oder (b)?** Vorschlag: **(b)**. Nur so zeigt der Ring, was die KI für diese Marke zitiert. (a) zeigt, wer über die Marke schreibt; das ist eine andere Frage. Mit (a) bliebe der Ring ungefiltert.
2. **Responses:** Sollen Rang und Stimmung in der Tabelle die der **Marke des Drawers** sein statt der eigenen? Vorschlag: ja, so liest man „wo steht BMW in dieser Antwort“.
3. **Inaktive Marken:** `brand_detail_v1` liefert sie mit `status 'inactive'`. Die Zahlenteile antworten mit `performance_not_found` (Kurve, Varianten) bzw. leer. Der Drawer zeigt einen Hinweis. Einverstanden?

Nach Freigabe baue ich in einem Durchgang, je mit Rückweg und echten Antworten (eigene Marke und BMW, inaktiv, ohne Nennung, alle Fehler):
- `brand_detail_v1`;
- `p_brand` in Responses und Export;
- C nach Entscheidung;
- die Absicherung.

## 5. Gebaut (12.10.2026, nach Freigabe)
**Entscheidungen:**
- Citations (b): Die Rechnung läuft über die Antworten, die die Marke nennen. Die „mentioned“-Checkbox meint die Drawer-Marke.
- Responses: UND-Filter. Rang und Stimmung sind die der Drawer-Marke. Die Checkbox steht angehakt und ausgegraut da (Lukas).
- Inaktive Marken: Der Kopf liefert `inactive`; die Zahlenteile sind leer bzw. liefern `performance_not_found`.

**Dateien** (je ein Block, mit Rückweg):
1. `brand_detail_v1.sql`:
   - `brand_detail_v1`;
   - `p_brand` in sieben RPCs: Responses, Export und die fünf Citations-RPCs bzw. -Exporte;
   - `_citations_brand_build_v1` (Temp-Tabellen aus den Läufen mit Nennung) mit den Marken-Kopien `_citations_fb_*`/`_gb_*`;
   - `_dash_responses_base_v1`: `p_company` ist jetzt ein UND-Filter und die Messmarke.
2. `brand_alt_absichern.sql`:
   - v4, chart_v3/v4 und variations_v2 prüfen den Zugang;
   - chart_v4 bekommt einen festen `search_path`;
   - `get_company_edit_v2` liefert für fremde Marken `brand_not_found`;
   - PUBLIC/anon sind bei allen sieben entzogen.

**Geprüft** (Rollback, `brand_detail_v1_echte_antworten.json`):
- **D:** Responses = Export = Overview-`mentions` = Läufe mit Nennung. Mercedes 503/2.562, BMW 596/3.004 (7/30 Tage). Citations `runs_with_any` ist kleiner oder gleich (BMW 591/2.982).
- **Ohne `p_brand` unverändert:** Responses-Rechnung (3 Varianten), Responses-Export (2), Citations-Exporte (2) und chart_v4 gleichen dem Stand vorher.
- **Marken-Temp-Tabellen:**
  - Rechnung wie `backfill_citation_rollups_v3`.
  - Die schnellere Endfassung ist identisch zur ersten Fassung (VW, Volvo; 7 und 30 Tage; 0 Abweichungen).
- **Rest:** Alle Fehlerformen geprüft. Das Ratenlimit greift beim 121. Aufruf. Inaktiv, ohne Nennung und fremd verhalten sich wie beschrieben.
- **md5:** Alle 22 erzeugten Fassungen entsprechen dem Test (`_build/brd/test_md5.json`).
