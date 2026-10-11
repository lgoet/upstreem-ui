# URL Detail als selbstladender Drawer: Bestandsaufnahme, Prüfung, Vorschlag (12.10.2026)

In dieser Runde wurde nichts geändert. Die Tests liefen in Transaktionen, die danach zurückgerollt wurden, im Team 877c als Owner. Beilage: `get_url_bundle_v7_definition.sql` mit der vollständigen Definition.

## 1. Befunde nach Schwere

| # | Schwere | Befund | Vorschlag |
|---|---|---|---|
| U1 | **hoch** | **Kein Zugangs-Check und für PUBLIC ausführbar.** `get_url_bundle_v7` (und v1–v6) prüft nur die Mitgliedschaft, nicht `team_access`; ein Team ohne Plan (Factory Bottrop) bekommt Titel, Beschreibung und Zusammenfassung. Sie ist für `PUBLIC` ausführbar; `anon` scheitert erst an „not authenticated“. Sie ist `security definer` **ohne `search_path`**. | v1 nach Bauart. Die Altversionen wie bei Response Detail absichern (eigene kleine Datei): v7 bekommt Zugang und `search_path`, v1–v6 sind nicht mehr für PUBLIC/anon ausführbar. |
| U2 | **hoch** | **Fremde URL wird verraten.** v7 sucht die Adresse in der globalen `source_url`, egal ob das eigene Team sie je zitiert hat. Beispiel: `http://archives.cpajournal.com/old/14468037.htm` zitiert nur HUBie; 877c bekommt Titel und Beschreibung. Daran sieht man, dass ein anderer Kunde diese Seite in seinen Antworten hat. | v1: `url_not_found`, wenn das Team die Adresse nie zitiert hat. Grundlage sind `staged_citation_urls` oder die URL-Rollups des Teams, über die ganze Historie. |
| U3 | mittel | **Kein „nicht gefunden“.** Eine Fantasie-Adresse liefert ein leeres Objekt mit `global_rank` 17540 (Anzahl aller URLs + 1) und Shares 0. | `url_not_found` (PT404). |
| U4 | mittel | **Exakter Vergleich, keine Normalisierung.** 5.969 Adressen gibt es in mehreren Schreibweisen: mit und ohne `/` am Ende, `www.`, `http`/`https`. Beispiel `https://089dj.com/…-musik/` und `…-musik`. Ein Link mit anderer Schreibweise findet nichts. `utm_*` ist beim Einlesen schon entfernt (nur 4 Reste). 9.445 Adressen haben eine Raute (`#:~:text=` u. ä.). | v1: erst exakt; sonst dieselbe Adresse ohne Schema, `www.`, `/` am Ende und Raute, unter den **vom Team zitierten** Schreibweisen. Bei mehreren gewinnt die mit den meisten Läufen. `meta.url` = gefundene Schreibweise, `meta.url_requested` = Eingabe. Die Zahlen gelten nur für die gefundene Schreibweise, Varianten werden nicht zusammengezählt. |
| U5 | mittel | **`markdown_summary` ist JSON im JSON.** Gespeichert ist `jsonb {"summary": "…"}` (222.567 Zeilen, immer ein String, nie leer, max. 1.500 Zeichen). v7 macht daraus mit `::text` den Text `{"summary": "…"}`. 47.406 Seiten haben keine Zusammenfassung (null). | v1: `summary` = `markdown_summary->>'summary'` als Klartext, sonst `null`. |
| U6 | mittel | **Logo-Regel nicht eingehalten:** `companies[]` und `conversion[]` nehmen `coalesce(logo_override_url, favicon_url)` auch für Wettbewerber. In `companies[]` fehlt `role`; sortiert wird nach Name, nicht eigene Marke zuerst. | `brands[]` mit `role`, `logo_url` nach Regel (eigene Marke: Override mit `https:`-Ergänzung, sonst Favicon), eigene Marke zuerst. |
| U7 | mittel | **„zuletzt gesehen“ ist falsch belegt:** `last_seen` = `team_url_state.last_scraped_at` (wann die Seite für das Team zuletzt gelesen wurde), sonst `source_url.last_seen` (global). Wann das Team sie zuletzt zitiert hat, steht nicht drin. `first_seen` ist immer `null`. | `last_cited_at` / `first_cited_at` aus den Rollups des Teams (`last_used_at`/`first_used_at`); `last_scraped_at` getrennt. |
| U8 | mittel | **Langsam kalt, altes Ratenlimit.** 30 Tage, viel zitierte URL: kalt 2,9 s, warm 136 ms; 90 Tage kalt 4,7 s. Seltene URL ~105 ms. Ratenlimit `check_rate_limit('url_detailed', 30)` (alt, Deadlocks), Meldung P0001. | v1 mit `_pi_rate_limit_v1('url_detail', 120, 'url')`. Laufzeit: dieselbe Rechnung; ein Cache lohnt erst, wenn kalt zu oft vorkommt. |
| U9 | mittel | **`reset_team_url_v1` (PUBLIC, `security definer`):** Jedes Mitglied, auch `member`, löscht Zustand und Erwähnungen einer URL. Die Seite wird dann neu analysiert, das kostet. Es gibt kein Ratenlimit, und Fehler kommen als `{status:'error'}` mit `SQLERRM`. `reset_team_url_state_v1` (owner/admin, löscht alle URL-Zustände des Teams) ist ebenfalls PUBLIC. | Mit der Absicherungsdatei: anon raus, Ratenlimit, `member` nicht. Ob die Oberfläche das braucht, sagt Claude Code. |
| U10 | niedrig | `description`: 21.245 Beschreibungen und 6.803 Titel enthalten HTML-Entities (`&amp;`, `&quot;`, `&#39;`, `&nbsp;` …). v7 kürzt die Beschreibung auf 5.000, den Titel auf 100 Zeichen. | v1 dekodiert die gängigen Entities zu Klartext. Gekürzt wird wie v7. |
| U11 | niedrig | Fehlerformen: `forbidden`/`not authenticated`/`invalid date range` als P0001, ohne stabile Codes. | Codes wie Abschnitt 4. |
| U12 | info | **Conversion:** `cited_runs` kommt aus den URL-Rollups, `mentioned_runs` aus `staged_citation_urls` + `recommendation`. Zwei Quellen, im Bestand aber stimmig: adac.de 523 Läufe, VW 420 = 80,3 %. Aufgeführt werden nur Marken, die **auf der Seite** erwähnt werden (`url_company_mention`), nicht alle Marken der Antworten. | So lassen und im Vertrag vermerken. |

**Fremde Kennungen:** Fremdes `p_team` → `forbidden` (gut). Fremde URL mit eigenem Team → **Daten statt „nicht gefunden“** (U2).

**Schreiben beim Lesen:** nur der Zähler des alten Ratenlimits. Nichts von außen.

## 2. Bestandsaufnahme

**Signatur:** `get_url_bundle_v7(p_team, p_url, p_models text[], p_date_from, p_date_to, p_tag_ids uuid[], p_tagmode, p_markets text[])` → `jsonb {url_detailed, conversion}`.
- `js_safe` ist angewandt, es gibt **keinen Umschlag** und keine verdoppelten Backslashes. Der „JSON im JSON“-Eindruck kommt allein von `markdown_summary` (U5).
- Rechte: PUBLIC + authenticated (U1).

**Zeitraum und Filter:**
- Ohne Angabe gelten die letzten 30 Tage.
- Shares, Rang und Conversion gelten für den Zeitraum.
- Gefiltert wird nach Modellen, Märkten und Topics (`or`/`and`).
- Gerechnet wird aus Tages-, Wochen- und Monats-Rollups (Kacheln); fehlende Wochen und Monate fallen auf Tage zurück.
- Der Kalender im Drawer geht als `p_date_from`/`p_date_to` ein.

**Responses-Tabelle in Bubble:**
- `cached_mentions_overview_v1` → `get_mentions_overview_v21` mit `p_url`, exakter Vergleich gegen `staged_citation_urls.url`.
- `get_url_bundle_v7` liefert keine Antworten mit.
- `cached_dashboard_responses_v1` ruft dieselbe Basis (`_dash_responses_base_v1`). Die kennt `p_url` und `p_domain` schon, bekommt sie vom Wrapper aber als `null`.

**Wie die URL gefunden wird:**
- Exakter Text-Vergleich `source_url.url = p_url` und in allen Rollups `url = p_url`.
- `http` und `https` sind verschieden, ebenso Groß- und Kleinschreibung im Pfad und `/` am Ende.
- Die Domain wird kleingeschrieben und ohne `www.` verglichen.

**`companies[]`:**
- Kommen aus `url_company_mention` mit `url = p_url` und `team_id` des Teams oder `null` (global).
- Nur heute getrackte Marken (own/competitor), nach Name sortiert, ohne `role`.

**Kennzahlen** (je Zeitraum und Filter):
- `domain_share`: Läufe, die diese URL zitieren ÷ Läufe, die irgendeine URL dieser Domain zitieren, in %.
- `global_share`: Läufe, die diese URL zitieren ÷ Läufe mit mindestens einer Quelle, in %.
- `global_rank`: Platz der URL unter allen URLs des Teams nach Anzahl zitierender Läufe. Bei Gleichstand entscheidet die Domain, dann die URL alphabetisch.

**`citation_type`:**
1. Override des Teams für die Domain (`team_domain_override`).
2. Sonst Domain der eigenen Marke bzw. eines Wettbewerbers (`You`/`Competition`).
3. Sonst `source_domain.citation_type`.

**Adressen:**

| Feld | Befund |
|---|---|
| `source_url.url` | 778 mit `http:`, 5 ohne Schema, 1 Zeile mit dem Text `null` |
| `source_url.favicon` | 110 mit `http:` |
| Logos | 2 mit `//` (Mercedes) |

Kein `javascript:` und kein `data:`.

**Fremder Text** (`title`, `description`, `summary`):
- Kein `<script>`, kein `on…=`, kein `javascript:`.
- 20 Zusammenfassungen enthalten HTML-Reste.
- 5 Zusammenfassungen enthalten Steuerzeichen.
- Titel und Beschreibungen haben Entities (U10).
- 13.069 Seiten haben keinen Titel.

**Laufzeit (877c):**

| URL | Zeitraum | kalt | warm |
|---|---|---|---|
| adac.de (523 Läufe) | 30 Tage | 2.932 ms | 136 ms |
| adac.de | 90 Tage | 4.726 ms | – |
| selten, 1 Lauf | 30 Tage | 107 ms | – |

## 3. Vorschlag

### A. `url_detail_v1(p_team, p_url, p_date_from default null, p_date_to default null, p_models text[] default null, p_markets text[] default null, p_tag_ids uuid[] default null, p_tagmode text default 'or')`
Die Filter laufen mit, damit die Kennzahlen zur Tabelle darunter passen; sie sind optional.

**Bauart** wie `response_detail_v1`:
- `_set_require_v1`, dann Zugangsprüfung → PT402, dann `_pi_rate_limit_v1('url_detail', 120, 'url')`.
- Zeitraum über `_dash_params_v1` (gleiche Regeln wie das Dashboard).

**Antwort:**
```
{ meta: { team_id, url, url_requested, date_from, date_to, data_as_of },
  row:  { url, title, domain, favicon, url_type, citation_type,
          first_cited_at, last_cited_at, last_scraped_at,
          domain_share, global_share, global_rank, cited_runs,
          description,            // Entities dekodiert, Klartext
          summary,                // Klartext oder null
          brands[]:  { company_id, name, role, logo_url, favicon_url }   // eigene zuerst
          conversion[]: wie v7 + role, logo_url nach Regel } }
```

**Fehler:**

| SQLSTATE | message | hint |
|---|---|---|
| 28000 | `settings_not_authenticated` | – |
| 42501 | `team_forbidden` | – |
| PT404 | `team_deleted` | – |
| PT402 | `team_access_<state>` | Zustand |
| 22023 | `team_invalid_param` | `p_team` / `p_url` |
| 22023 | `dashboard_invalid_date` | Zeitraum |
| PT404 | `url_not_found` | – (auch für fremde URLs) |
| PT429 | `url_rate_limited` | Sekunden |

### B. Responses: `cached_dashboard_responses_v1` um `p_url` und `p_domain` erweitern. Das ist gut so.
- Die Basis kennt beide Parameter schon. Es fehlen nur:
  - die Durchreichung in `_dash_responses_calc_v1`;
  - die Aufnahme in die Cache-Parameter. Damit ist `url`/`domain` Teil des Cache-Schlüssels, und die Meta-Filter zeigen sie.
- `p_url` wird vorher mit derselben Suche wie A aufgelöst, also dieselbe gefundene Schreibweise.
- **Technisch:** Die Funktion bekommt zwei Parameter am Ende dazu. Damit PostgREST nicht zwei Überladungen findet („could not choose the best candidate“), wird die alte Signatur in derselben Transaktion entfernt und die neue angelegt. Rechte werden neu gesetzt, und der Rückweg stellt die alte Signatur her. Bestehende Aufrufe ohne `p_url` funktionieren unverändert.
- `p_domain` kommt gleich mit, für den Domain-Drawer.

### C. Export: ja.
- Der App-Export der Tabelle ist `export_responses_v1`, nicht `export_prompt_runs_v1`; letzterer ist alt und PUBLIC, er kommt in die Absicherungsdatei.
- `export_responses_v1` bekommt `p_url` und `p_domain` auf dieselbe Weise (Signatur ersetzen) und filtert über `staged_citation_urls`.
- Danach kann der Knopf wieder gezeigt werden.

**`get_url_bundle_v7` bleibt** für Bubble.

## 4. Zu entscheiden (Lukas)
1. **U2:** „Nicht gefunden“, wenn das Team die URL nie zitiert hat, auch wenn die Seite global bekannt ist? Vorschlag ja. Ausnahme wären Quellen, die Mira oder Opportunities zeigen, ohne dass das Team sie zitiert hat; solche Wege gibt es nach meinem Bestand nicht.
2. **U4:** Schreibweisen nur zum Finden normalisieren und nicht zusammenzählen? Vorschlag ja.
3. **U7:** „zuletzt gesehen“ = zuletzt vom Team zitiert? Vorschlag ja.
4. **B und C:** Signatur von `cached_dashboard_responses_v1` und `export_responses_v1` in einem Schritt ersetzen (mit Rückweg)?

Nach Freigabe baue ich in einem Durchgang:
- `url_detail_v1.sql`;
- die Erweiterung von B und C;
- die Absicherung der Altversionen.

Jeweils mit Rückweg, dazu die echten Antworten: viel zitierte URL mit Zusammenfassung und Conversion, YouTube, ohne Zusammenfassung, `http://`, Responses mit `p_url` (erste Seite und Suche) und jede Fehlerform.

## 5. Gebaut (12.10.2026, nach Freigabe)
**Entscheidungen:**
- Nicht gefunden nur, wenn das Team die Adresse nie zitiert hat.
- Schreibweisen nur zum Finden angleichen, nicht zusammenzählen. Das war auch bisher so: Die Zahlen gelten je exakter Schreibweise.
- „zuletzt gesehen“ = `last_cited_at`.
- B und C mit ersetzter Signatur.

**„Nicht im Zeitraum“ (wie Analytics-Tools):**
- Die Seite öffnet trotzdem, mit `in_range:false` und Hinweis plus „Zeitraum anpassen“, statt mit leeren Zahlen oder einer Fehlermeldung.
- Kennzahlen und Rang werden dann nicht gerechnet: unter 100 ms statt bis zu 5 s.

**Dateien (je ein Block, mit Rückweg):**
1. `url_detail_v1.sql`:
   - neue Funktionen `url_detail_v1`, `_url_metrics_v1`, `_url_resolve_v1`, `_url_variants_v1`, `_html_decode_v1`;
   - `cached_dashboard_responses_v1` und `export_responses_v1` + `p_url`/`p_domain`;
   - `_dash_responses_calc_v1` reicht beides durch.
2. `url_alt_absichern.sql`:
   - `get_url_bundle_v7` prüft den Zugang und hat einen festen `search_path`.
   - 14 Altfunktionen sind nicht mehr für PUBLIC/anon ausführbar: `get_url_bundle_v1`–`v7`, `get_url_detailed_v8`, `get_url_citation_conversion_v3`, `get_domain_url_share_over_time_v5`/`v6`, `reset_team_url_v1`, `reset_team_url_state_v1`, `export_prompt_runs_v1`.

**Getestet** (im Rollback; Ergebnisse in `url_detail_v1_echte_antworten.json`):
- Responses-Tabelle, Export und `cited_runs` zählen gleich (523).
- Das Dashboard ohne `p_url` ist unverändert (8.504).
- Fremde und erfundene URL ergeben `url_not_found`.
- Ratenlimit greift beim 121. Aufruf.
- v7 ohne Zugang wird abgelehnt.

**Offen:**
- `reset_team_url_v1` darf weiter jedes Mitglied aufrufen. Ob die Oberfläche das braucht, klärt der Umbau.
