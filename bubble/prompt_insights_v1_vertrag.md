# Prompt Insights als Seiten-Komponente: Bestandsaufnahme, Befunde, Vertragsvorschlag

Stand 10.10.2026. Antwort auf den Auftrag vom 10.10.

In dieser Runde wurde nichts geändert, nur gelesen und in zurückgerollten Transaktionen gemessen. Gemessen wurde in Prod mit Team 877c (Mercedes Benz, 102 aktive und 23 inaktive Prompts) und Nutzer aea6e317…. Die Definitionen aller genannten Funktionen sind mit `pg_get_functiondef` gelesen.

Eine Ausnahme vom „nichts ändern“ schlage ich vor, unabhängig von dieser Seite: Abschnitt 0, Befund K1. Die Datei dafür liegt bei (`rls_fix_team_policies.sql`). Einspielen entscheidet der Nutzer.

---

## 0 Kurzfassung

| Nr | Schwere | Befund |
|---|---|---|
| K1 | **kritisch** | 19 RLS-Policies auf 16 Tabellen prüfen `tm.team_id = tm.team_id` (immer wahr). Jeder angemeldete Nutzer liest über PostgREST (`GET /rest/v1/prompt`, `Accept-Profile: app`) die Zeilen **aller** Teams: `prompt`, `prompt_run` (mit `response_json`), `recommendation`, `tag`, `team_company`, `daily_company_prompt_model_stats`, `daily_runs_by_prompt_model`. Geprüft: Ein Nutzer, der in genau einem Team ist, sieht 623 Prompts aus 14 Teams und 86 Topics aus 11 Teams. Fix im Rollback geprüft: danach 3 Prompts aus 1 Team. |
| H1 | hoch | `create_prompt_with_tags_v4` fängt jeden Fehler mit `exception when others` und gibt den Fehlertext mit HTTP 200 zurück. Bei ungültigem Markt, Dublette, kaputter Topic-ID oder Planlimit wird nichts gespeichert, aber der Aufruf „gelingt“. |
| H2 | hoch | Das Planlimit ist nicht atomar (Anlage und Aktivieren). Zwei gleichzeitige Aufrufe können es gemeinsam überschreiten. `set_prompts_active` aktiviert stillschweigend nur einen Teil. |
| H3 | hoch | Der Prompt-Insights-Cache ist praktisch wirkungslos: Der Trigger `trg_invalidate_rpc_cache` löscht bei **jedem** neuen Lauf den ganzen `rpc_cache` des Teams. 877c hat rund 30 Läufe pro Stunde. Die Tabelle wird deshalb fast immer kalt gerechnet (1,1 s bei 30 Tagen, 1,4 s bei 90 Tagen). |
| H4 | hoch | Prompt löschen ist endgültig und unvollständig: Läufe, Antworten, Empfehlungen und Rollups **pro Prompt** werden gelöscht, die Team- und Topic-Rollups (`daily_runs_by_model`, `daily_company_model_stats`, `daily_*_tag_*`) aber nicht. Danach widersprechen sich Ansichten über die Vergangenheit. Caches werden nicht geleert. |
| H5 | hoch | Gruppen: Eine eigene Gruppierung mit demselben Namen wie ein Topic verschmilzt mit ihm, die Zahlen verdoppeln sich. Gemessen: „SUV“ eigene Gruppe + Topic „SUV“ ergibt je 58 Prompts und 4.816 Läufe statt 29 und 2.408. |
| M1 | mittel | „Alle N auswählen“: `resolve_prompt_ids_v1` kennt **alle** Filter (Zeitraum, Models, Markets, Topics, ohne Topic, Marke erwähnt, Marken, `excluded_ids`). Bubble schickt sie nur nicht. Die Lücke liegt im Workflow, nicht in der Funktion. Eine Obergrenze gibt es nicht. |
| M2 | mittel | Kennzahlen weichen von den Dashboard-Regeln ab: Sentiment läuft über den ganzen Zeitraum (nicht höchstens 30 Tage), heißt aber `avg_sentiment_30d`. Prompts ohne Lauf zeigen Visibility **0** statt „keine Daten“. Der Standardzeitraum ist 7 Tage nach Datenbank-Datum (UTC) statt 30 Tage Berlin. |
| M3 | mittel | `total_count` (aktiv) ignoriert den Topic-Filter, `total_count_inactive` beachtet ihn. Die Kopfzahlen passen deshalb nicht zu den Zeilen. |
| M4 | mittel | Rate-Limit: Alle Lese-Aufrufe teilen sich den Schlüssel `prompt_inisghts` (Tippfehler) mit 30 pro Minute. Die Gruppen zählen doppelt (Hülle und innere Funktion). Mit aufgeklappten Gruppen sind 30 schnell erreicht. Er läuft zudem über den alten `check_rate_limit` (Ursache der Deadlocks vom 09.10.). |
| M5 | mittel | Nach Schreibaktionen leert `clear_prompt_insights_cache_v1` nur die Tabelle, **nicht** die Gruppen (`prompt_topics_grouped_v1`). Die Gruppen zeigen bis zu 10 Minuten den alten Stand. |
| M6 | mittel | Keine Rollenprüfung: Jedes Mitglied (auch `member`) darf löschen, aktivieren und Topics löschen. |
| M7 | mittel | Logos in `top_mentions` sind teils protokollrelativ (`//…cdn.bubble.io/…`), nicht absolut. Das Dashboard liefert dieselben Logos mit `https:`. |
| N1 | niedrig | Suche: `ilike '%' || p_search || '%'` ohne Escape von `%` und `_` und ohne Akzent-Faltung. `unaccent` und `pg_trgm` sind installiert. |
| N2 | niedrig | `p_limit` ist nur nach oben begrenzt. Negative Werte ergeben einen SQL-Fehler statt einer klaren Meldung. `p_untagged` zusammen mit `p_tag_ids` ergibt still eine leere Menge. |
| N3 | niedrig | Topic-Name ohne Längengrenze, Emoji ohne Grenze. Die Farben sind in `create_tag`/`update_tag` und per Check geprüft (`^#?[0-9a-f]{6}$`, also auch ohne `#`). |

**Datenlage (gut):**

- In keinem Prompt steht heute ein Backtick, `${`, Backslash, Steuerzeichen oder Formelbeginn (`= + - @`). Ein Prompt hat einen Zeilenumbruch, er stammt aus der Zeit vor dem Bereinigungs-Trigger.
- Es gibt keine Dubletten, keine Zuordnung über Teamgrenzen und keine Topics mit mehr als 5 Zuordnungen je Prompt.

---

## 1 Bestand: Aufrufe der heutigen Seite

| Aufruf in Bubble | Funktion dahinter (Aufrufe seit 05.09.2025) | Team-Prüfung | anon | fängt Fehler |
|---|---|---|---|---|
| `get_prompt_insights_alltime` | `cached_prompt_insights_alltime_v18` (3.368), rechnet mit `get_prompt_insights_alltime_v20` | Hülle: nur Mitgliedschaft; v20: `require_team_access` | ja (Hülle bricht ohne Login ab) | nein |
| `cached_prompt_topics_grouped` | `cached_prompt_topics_grouped_v1` (1.333), rechnet mit `get_prompt_topics_grouped_v1` | wie oben | ja | nein |
| `get_tags` | `get_tags_v2` (8.786) | Mitgliedschaft | nein | nein |
| `create_prompt_with_tags` | `create_prompt_with_tags_v4` (Nutzlast passt). Daneben `create_prompt_with_tags` (72) und `_v3` (40) | Mitgliedschaft | ja | **ja** |
| `clear_prompt_insights_cache` | `clear_prompt_insights_cache_v1` (467) | Mitgliedschaft | ja | nein |
| `get_team_plan_quota` | `get_team_plan_quota` (32.659); `_v3` (487) liefert zusätzlich Zugang und Rolle | Mitgliedschaft | ja / v3 nein | nein |
| `create_tag`, `update_tag`, `delete_tag` | gleichnamig (217 / 119 / 35) | Mitgliedschaft | ja | nein |
| `assign_tags_bulk` | gleichnamig (263) | Mitgliedschaft, Prompts und Tags je Team | ja | nein |
| `set_prompts_active`, `set_prompts_inactive` | gleichnamig (23 / 72) | Mitgliedschaft, Prompts je Team | ja | nein |
| `delete_prompts` | **[BITTE BESTÄTIGEN]** `delete_prompts_v3` (4) oder `_v2` (3); beide löschen nur inaktive | Mitgliedschaft, Prompts je Team | ja | nein |
| `resolve_prompt_ids` | `resolve_prompt_ids_v1` (11) | Mitgliedschaft | ja | nein |
| Responses-Element | `cached_mentions_overview_v1` → `get_mentions_overview_v21` | `require_team_access` | nein | nein |

`remove_prompt_tags_v1` (23 Aufrufe) entfernt einzelne Topics eines Prompts; vermutlich aus dem Prompt-Drawer.

**Antworten auf die Einzelfragen:**

- **`create_tag` antwortet `created = no`**, wenn es im Team schon ein Topic mit diesem Namen gibt (ohne Groß/Klein). Dann kommt die ID des bestehenden zurück.
- **`resolve_prompt_ids_v1` kennt:** Suche, Topics mit `or`/`and`, ohne Topic, Status, Models, Markets, Zeitraum, eigene Marke erwähnt, erwähnte Marken, `excluded_ids`. `p_limit`, `p_offset` und `p_order` werden ignoriert, die Menge ist unbegrenzt.
- **`get_tags_v2.prompt_count`** zählt aktive **und** inaktive Prompts. `p_only_active` bezieht sich auf das Topic, nicht auf die Prompts. Mit Nutzer-JWT aufrufbar, anon nicht.
- **`get_markets_v2`:** mit Nutzer-JWT aufrufbar (auch anon, dann leer). `prompt_count` je Markt, wahlweise nur aktive.
- **Anlage (v4):**
  - Leerer Markt → Team-Standardmarkt → `US`. Ein ungültiger Markt bricht den ganzen Stapel ab.
  - Topics: höchstens 5 für den Stapel; fremde oder inaktive werden still ignoriert.
  - Der Trigger `trg_prompt_sync_schedule` legt sofort einen Plan an, der erste Lauf ist 4 Minuten nach der Anlage fällig. Der Abrufer (`claim_due_prompt_model_jobs_v1`) holt ihn. Ein Trigger mit n8n-Aufruf existiert nicht.
  - Der Trigger `trg_clean_text_columns('prompt_text')` schreibt den Text beim Speichern um: Backslash und Backtick weg, `${` wird `$ {`, alle Leerzeichen, Zeilenumbrüche und Steuerzeichen werden zu einem Leerzeichen.
  - Laut Tabelle gilt `unique (team_id, prompt_text)` (exakt, ohne Markt) und höchstens 500 Zeichen (Check `NOT VALID`, gilt für neue Zeilen).
  - `count` und `input_method` werden nicht ausgewertet. Der Topic-Zähler ist kein gespeichertes Feld; er wird beim Lesen gezählt.
- **Topic löschen:** Es löscht die Zuordnungen, die Topic-Rollups (`daily_runs_by_tag_model`, `daily_company_tag_model_stats`) und das Topic. Endgültig. Eigene Gruppierungen im Browser behalten die tote ID, ihre Gruppe zählt dann 0 Prompts.
- **Prompt löschen (v3):** nur inaktive. Gelöscht werden:
  - Topics und Plan;
  - Rollups pro Prompt und Citation-Rollups;
  - Staging;
  - Jobs und Versuche;
  - Empfehlungen samt Zitaten;
  - Ignore-Log;
  - Chat-Sitzungen zum Lauf;
  - Citation-Typ-Jobs;
  - die Läufe selbst;
  - zuletzt der Prompt.

  Nicht gelöscht werden die Team- und Topic-Rollups. Kein Cache wird geleert.
- **Aktivieren:** `set_prompts_active` prüft das Planlimit, aktiviert nur bis zur freien Zahl und antwortet `Partial`/`LimitReached`, ohne Fehler. Ohne Plan kommt ein Fehler. Der Trigger setzt den Plan wieder auf „fällig in 4 Minuten“.
- **Deaktivieren:** weiche Grenze von 1.000 inaktiven Prompts je Team.

## 2 Datenlage (alle Teams, 10.10.)

| Wert | Ergebnis |
|---|---|
| Prompts gesamt / Teams | 623 / 14; aktiv je Team max 102, p95 95; inaktiv max 23 |
| Topics gesamt / je Team max | 86 / 14; 1 Topic ohne Prompt; keine inaktiven |
| Topics je Prompt max | 5 |
| Prompt-Länge max / p99 | 166 / 145 Zeichen; keiner > 500, keiner < 3 |
| mit Zeilenumbruch / Backtick / `${` / Backslash / Steuer- oder Nullbreiten-Zeichen | 1 / 0 / 0 / 0 / 0 |
| Formelbeginn `= + - @` | 0 |
| Topic-Namen mit Backtick, `"` oder Backslash; länger als 60; Dubletten (Groß/Klein) | 0; 0; 0 |
| Dubletten Text (normalisiert), mit oder ohne Markt | 0 |
| aktive Prompts ohne Topic | 103 |
| Märkte | DE 558, US 65 |
| Teams über dem Planlimit | 0 |
| Rollen | owner 16, admin 10, member 19 |

## 3 Messungen (877c, zurückgerollt)

**Laufzeiten:**

| Aufruf | Laufzeit |
|---|---|
| Tabelle 30 Tage, 25 Zeilen, kalt / warm | 1.126 ms / 3 ms |
| Tabelle 90 Tage, 100 Zeilen, kalt | 1.444 ms |
| Tabelle direkt (ohne Hülle): alle 125 Prompts, 30 Tage | 87 ms |
| Tabelle 180 Tage, Suche „a“, 100 Zeilen, Sortierung Sentiment | 2.719 ms |
| Tabelle 365 Tage, 200 Zeilen, Markenfilter mit allen 11 Marken | 789 ms |
| Gruppen 30 Tage kalt / warm; 90 Tage; 365 Tage | 51 ms / 1 ms; 84 ms; 208 ms |
| Gruppen 365 Tage mit 200 eigenen Gruppierungen | 269 ms |
| Responses heute (`cached_mentions_overview_v1`) 30 Tage, `run_at_desc` | 456 ms |
| `cached_dashboard_responses_v1` 30 Tage `run_at_desc` / `rank_asc` + yes | 554 ms / 2.863 ms (kalt) |

Die kalte Hülle ist rund zehnmal langsamer als die Rechnung direkt (1,1 s gegen 87 ms). Die Zeit geht dort in die Zeilenausgabe einer Tabellenfunktion über `row_to_json`/`jsonb_array_elements` und in die erste Planung. Ein jsonb-Ergebnis (wie Dashboard v1) vermeidet das.

**Gleichheit:**

- **Gruppe gegen Liste:** Topic „SUV“, 30 Tage. Die Gruppe hat 29 aktive Prompts, 2.408 Läufe, Visibility 25,71 %. Die Summe der 29 Listenzeilen ergibt 2.408 Läufe, 619 Erwähnungen, 25,71 %. **Gleich.** Die Gruppe gewichtet über Läufe, wie das Dashboard.
- **Liste gegen Dashboard v1:** Alle Prompts, 30 Tage. Die Liste summiert 8.411 Läufe und 2.580 Erwähnungen, das ergibt 30,67 %. `cached_dashboard_overview_v1` meldet für die eigene Marke 30,67 % bei 8.411 Läufen. **Gleich.**
- **Rang und Sentiment:** Der Rang je Prompt ist `sum_rank / count_rank` aus denselben Rollups wie das Dashboard. Sentiment je Prompt ist der Mittelwert über den **ganzen** Zeitraum; das Dashboard begrenzt auf höchstens 30 Tage. Ab 31 Tagen weichen die Werte deshalb ab.
- **Responses:** `cached_mentions_overview_v1` und `cached_dashboard_responses_v1` liefern für dieselben Filter **dieselben Zeilen in derselben Reihenfolge** (geprüft für `run_at_desc` und für `rank_asc` mit `mentioned = yes`). Unterschiede in den Feldern:
  - Dashboard v1 hat `total_count` in `meta` statt auf jeder Zeile und zusätzlich `own_mentioned`.
  - `response_preview` ist Modelltext (Markdown). Beide Funktionen schicken ihn durch `js_safe`, Backtick und Backslash sind also schon raus.
- **Prompt ohne Lauf im Zeitraum:** Er erscheint, mit `runs_total` 0, `visibility_pct` **0**, `avg_rank` null, `avg_sentiment_30d` null. Bei Sortierung nach Visibility landet er am Ende (eigene Regel). Es gibt einen zweiten Sortierschlüssel (`created_at desc, id`), die Reihenfolge ist stabil.
- **Zeitzone:** Läufe nach `run_day_berlin`, Rollups nach Berliner Tag. Nur der Standardzeitraum benutzt `current_date` (UTC).

## 4 Befunde im Einzelnen (nach Schwere)

### K1 RLS-Policies lassen jedes Team alles lesen
- **Stelle:** `pg_policies`: `prompt_all`, `pr_all`, `reco_all`, `tag_all`, `tc_all`, `d_select1`–`7`, `ps_all`, `alias_all`, `tcs_all`, `sugg_*`. Bedingung jeweils `exists (select 1 from app.team_member tm where tm.team_id = tm.team_id and tm.user_id = auth.uid())`.
- **Wirkung:** Gelesen werden kann alles, wo `authenticated` ein SELECT-Recht hat: `prompt`, `prompt_run` (komplette KI-Antworten), `recommendation`, `tag`, `prompt_tag`, `team_company`, `daily_company_prompt_model_stats`, `daily_runs_by_prompt_model`. `prompt_tag` selbst ist richtig geschützt. Schreiben ist nicht möglich, weil `authenticated` dort kein INSERT/UPDATE/DELETE hat.
- **Vorschlag:** `rls_fix_team_policies.sql` (19 × `alter policy`, Name und Rolle bleiben, Bedingung `tm.team_id = <tabelle>.team_id`). Die RPCs sind nicht betroffen (security definer). Im Rollback geprüft: Ein Nutzer mit einem Team sieht danach nur sein Team, ein Nutzer mit 11 Teams seine 11. **Bitte zeitnah einspielen**, unabhängig von dieser Seite.

### H1 Anlage meldet Fehler als Erfolg
- **Stelle:** `create_prompt_with_tags_v4` und `create_prompt_with_tags`: `exception when others then return sqlerrm`.
- **Vorschlag:** `prompts_add_v1` wirft echte Fehler ohne exception-Block und meldet je Zeile das Ergebnis (Abschnitt 6.4).

### H2 Planlimit nicht atomar
- **Stelle:**
  - v4 zählt die aktiven Prompts, dann wird eingefügt.
  - `set_prompts_active` rechnet freie Plätze aus und aktiviert dann.
  - Beides ohne Sperre.
- **Vorschlag:** Wie bei `prompt_research_decide_v1`: `pg_advisory_xact_lock` je Team, gemeinsam für Anlage, Aktivieren und Annehmen aus Prompt Research. Reicht der Platz nicht, kommt PT409 `prompts_limit_reached` mit `hint` = freie Plätze, und es wird nichts geändert (kein Teil-Aktivieren).

### H3 Cache wird bei jedem Lauf gelöscht
- **Stelle:** `trg_invalidate_rpc_cache` auf `prompt_run` (`after insert`) löscht `rpc_cache where team_id = NEW.team_id`.
- **Vorschlag:** Die neuen Lesefunktionen nutzen `app.dashboard_cache` mit Stale-While-Revalidate und den Hintergrund-Job `dashboard-cache-refresh`, wie Dashboard v1 und das Performance-Radar. Der Trigger bleibt für die Bubble-Funktionen unverändert.

### H4 Löschen verändert die Vergangenheit uneinheitlich
- **Stelle:** `delete_prompts_v3` (siehe Abschnitt 1).
- **Folge:** Dashboard-Werte ohne Prompt-Filter kommen teils aus Team-Rollups (`get_competition_overview_v24` liest `daily_company_model_stats` und `daily_runs_by_model`). Sie behalten die Läufe gelöschter Prompts; die Prompt-Ansichten nicht. Performance-Radar, Citations und Topic-Heatmap verlieren die Historie des Prompts.
- **Vorschlag:** **Entscheidung des Nutzers** (Abschnitt 8, Frage 3). Technisch sauber sind zwei Wege:
  - (a) „Löschen“ = endgültig wie heute, aber zusätzlich die Team- und Topic-Rollups der betroffenen Tage neu berechnen und alle Caches des Teams leeren.
  - (b) Weiches Löschen (`deleted_at`): Prompt verschwindet aus allen Listen, Historie bleibt; Speicher wird später per Job aufgeräumt.

  (b) ist sicherer, aber jede Lesefunktion muss gelöschte Prompts ausfiltern.

### H5 Gruppen-Schlüssel kollidieren
- **Stelle:** `get_prompt_topics_grouped_v1`: `group_key` = Topic-Name bzw. eigener Schlüssel; die Mitgliedschaft wird über `group_key` zusammengefasst.
- **Vorschlag:** Getrennte Schlüssel: `topic:<tag_id>`, `custom:<key>`, `untagged`. Dazu Feld `group_type`.

### M1 Auswahl „Alle N“
- **Vorschlag:** `prompts_bulk_v1` mit `p_target = 'filter'` nimmt **genau dieselben Filterparameter** wie die Liste, dazu `p_excluded_ids` und Pflicht-`p_expected_count`.
  - Die Zielmenge rechnet dieselbe interne Funktion wie die Liste.
  - Weicht die tatsächliche Zahl ab, kommt PT409 `prompts_selection_changed` mit `hint` = tatsächliche Zahl, und es wird nichts geändert.
  - Obergrenze 1.000.

### M2 Kennzahlen-Regeln
- **Vorschlag:**
  - Standardzeitraum = letzte 30 Berliner Tage (wie Dashboard).
  - Sentiment = letzte höchstens 30 Tage des Fensters; Feld `avg_sentiment`, Fenster in `meta.sentiment_from`.
  - `visibility_pct` = null, wenn `runs_total` = 0.
  - Wiederverwendung: Dieselben Rollups und Tracking-Fenster wie `_perf_radar_base_v1` / v24. Die Rechnung wird nicht neu erfunden, sondern aus v20 übernommen und an diesen drei Stellen angepasst.

### M3 Kopfzahlen
- **Vorschlag:** `meta.counts` = {`active`, `inactive`, `untagged_active`, `untagged_inactive`}, alle unter **denselben** Filtern wie die Zeilen (außer dem Status). Für das Blättern dazu `meta.total_count` = Zeilen unter allen Filtern inklusive Status.

### M4 Rate-Limit
- **Vorschlag:** `_rl_hit_v1` mit eigenem Schlüssel je Funktion, ohne exception-Block. Zahlen in Abschnitt 6.5.

### M5 Gruppen-Cache wird nicht geleert
- **Vorschlag:** Jede schreibende `_v1` leert selbst alle Prompt-Insights-Einträge des Teams in `dashboard_cache`. Zusätzlich für Bubble die alten `rpc_cache`-Einträge `prompt_insights_v20` und `prompt_topics_grouped_v1`.

### M6 Rollen
- **Vorschlag:** Entscheidung des Nutzers (Abschnitt 8, Frage 1). Vorbereitet wird eine Prüfung `_prompts_require_role_v1(p_team, p_min_role)`.

### M7 Logos
- **Vorschlag:** Wie Dashboard v1: protokollrelativ → `https:`; fehlt das Logo, das Google-Favicon der Domain.

### N1–N3
- **Suche:** `%`, `_` und `\` escapen; beide Seiten mit `unaccent(lower(...))` falten. Die Oberfläche schickt nur noch `p_search` (rohe Eingabe); `query_folded` und `query_de` werden überflüssig.
- **Parameter:** Bereichsprüfungen mit `prompts_invalid_param`. `p_untagged = true` zusammen mit `p_tag_ids` → Fehler.
- **Topics:** Grenzen wie in Abschnitt 6.4.

---

## 5 Abgrenzung und Wiederverwendung

- **Responses:** `cached_dashboard_responses_v1` unverändert wiederverwenden (gleiche Zeilen bestätigt). Fürs Aktualisieren reicht `clear_dashboard_cache_v1(p_team)`. Es leert Dashboard- und Citations-Cache des Teams; der Hintergrund-Job rechnet nach, für den Nutzer kostet das nur einmal die kalte Zeit. Eine eigene Fassung nur für Responses lohnt sich nicht.
- **Prompt Research:** `prompt_research_decide_v1` bekommt beim Bau dieselbe interne Anlage-Funktion `_prompts_create_v1` (gleicher Lock, gleiche Prüfungen, gleiche Cache-Leerung). Die Antwortform von decide bleibt.
- **Export, Drawer:** nicht berührt. Zur Kenntnis: `export_prompts_full_v2` maskiert keine Formel-Anfänge. Heute beginnt kein Prompt so, und `prompts_add_v1` weist solche Texte ab (Abschnitt 6.4). Damit ist das Risiko für neue Prompts gelöst.
- **Eigene Gruppierungen:** bleiben im Browser. Option für später: Tabelle `prompt_group(team_id, created_by, key, tag_ids[], shared bool)` mit zwei Funktionen (Liste, Speichern/Löschen), Aufwand rund ein halber Bautag. Vorteil: geräteübergreifend und im Team teilbar. Entscheidung des Nutzers.

---

## 6 Vertragsvorschlag

Bauart wie Dashboard v1 und A–E:

- reines `jsonb` mit `meta` und `rows` (bzw. benannten Abschnitten);
- `security definer` mit festem `search_path`;
- `revoke` von public und anon;
- Zugang über `require_team_access`, der Nutzer kommt aus dem JWT;
- Freitext durch `js_safe`;
- keine exception-Blöcke;
- XX000 einmal wiederholen (Abschnitt 1 der Fassung 2).

### 6.1 Gemeinsame Filter (Liste, Gruppen, Sammelaktion im Filter-Modus)

| Parameter | Typ | Vorgabe | leer bedeutet |
|---|---|---|---|
| `p_team` | uuid | – (Pflicht) | `prompts_team_required` |
| `p_date_from`, `p_date_to` | date (Berlin) | letzte 30 Tage bis heute (Berlin) | Vorgabe; `from > to` → Fehler; höchstens 400 Tage |
| `p_models` | text[] | null | alle Modelle des Teams |
| `p_markets` | text[] (alpha2) | null | alle; unbekannte Werte → Fehler |
| `p_tag_ids` | uuid[] (≤ 20) | null | kein Topic-Filter; fremde IDs → `prompts_invalid_param` |
| `p_tagmode` | `or` \| `and` | `or` | – |
| `p_untagged` | boolean | false | true = nur Prompts ohne aktives Topic; nicht zusammen mit `p_tag_ids` |
| `p_search` | text (≤ 200) | null | keine Suche; gefaltet (Akzente, Groß/Klein) |
| `p_mentioned` | `all` \| `yes` \| `no` | `all` | eigene Marke im Zeitraum erwähnt |
| `p_company_ids` | uuid[] (≤ 50) | null | erwähnte Marken (oder); nur Marken des Teams |
| `p_status` | `active` \| `inactive` \| `all` | `active` | ersetzt `p_only_active` |

### 6.2 Lesen

**`cached_prompts_list_v1`** = gemeinsame Filter + `p_order`, `p_limit` [1–100, Vorgabe 25], `p_offset` [≥ 0].

- `p_order`: `visibility_desc` (Vorgabe), `visibility_asc`, `rank_asc`, `rank_desc`, `sentiment_desc`, `sentiment_asc`, `name_asc`, `name_desc`, `created_at_desc`, `created_at_asc`. Danach immer `created_at desc, prompt_id`. Null-Werte immer ans Ende.
- Cache: `dashboard_cache` je Filtersatz (ohne Blättern), die vollständige sortierte Liste (höchstens einige hundert Zeilen je Team). Geblättert wird aus dem Cache.

```json
{"meta": {"team_id": "877c…", "date_from": "2026-09-11", "date_to": "2026-10-10", "sentiment_from": "2026-09-11",
          "timezone": "Europe/Berlin", "total_count": 102, "limit": 25, "offset": 0, "order": "visibility_desc",
          "counts": {"active": 102, "inactive": 23, "untagged_active": 23, "untagged_inactive": 2},
          "filters": {…wie übergeben, normalisiert…}, "cached": true, "stale": false, "generated_at": "…"},
 "rows": [{"prompt_id": "c52d2710-…", "prompt_text": "beste Automatikautos für lange Autobahnfahrten mit Komfort",
           "market": "DE", "is_active": true, "source": "user_generated", "created_at": "2026-08-29T16:03:54Z",
           "runs_total": 81, "mentioned_runs": 77, "visibility_pct": 95.06, "avg_rank": 4.94, "avg_sentiment": 88.22,
           "last_seen_run_at": "2026-10-09T13:11:35Z",
           "tags": [{"tag_id": "597a287b-…", "name": "Automatikgetriebe", "emoji": null, "hex_light": "#9145e8", "hex_dark": "#9145e8"}],
           "top_mentions": [{"company_id": "87468f49-…", "name": "Mercedes Benz", "logo_url": "https://49eaeb540a500f6e4ee0dfc1266fad7e.cdn.bubble.io/…/mercedes-logo….png", "mention_runs": 77, "mentioned_pct": 95.06}],
           "companies_mentioned_count": 10}]}
```

Die Werte der Zeile sind echt (877c, 30 Tage, erste Zeile von heute). `meta.counts` stammt aus den Kopfzahlen und der Gruppe „ohne Topic“ desselben Laufs. Die vollständigen echten Antworten kommen nach dem Bau.

Feldnamen gegenüber heute:

- `avg_sentiment_30d` → `avg_sentiment`;
- `companies_preview_totalcount` → `companies_mentioned_count`;
- `favicon` → `logo_url` (absolut);
- in Topics `id` → `tag_id`;
- `total_count`/`total_count_inactive`/`group_total_count` je Zeile entfallen, dafür `meta.counts`.

**`cached_prompts_groups_v1`** = gemeinsame Filter + `p_mode` (`both` \| `custom` \| `topics`) + `p_groups`.

- `p_groups`: höchstens 10 Gruppierungen; `key` 1–60 Zeichen, eindeutig; 1–3 `tag_ids` des Teams.
- Unbekannte oder gelöschte Topic-IDs werden aus der Gruppierung entfernt und in `meta.dropped_tag_ids` gemeldet. Eine Gruppierung ohne gültige Topics entfällt.
- Gruppen laden immer mit denselben Filtern wie die Liste, auch Suche und Marken. Gemessen ist das billig (30 Tage 51 ms, 365 Tage 208 ms, 200 Gruppierungen 269 ms, alles kalt).

```json
{"meta": {"team_id": "877c…", "date_from": "…", "date_to": "…", "status": "active", "mode": "both", "dropped_tag_ids": [], …},
 "rows": [{"group_key": "topic:8daee9bb-…", "group_type": "topic", "tag_id": "8daee9bb-…", "name": "SUV", "emoji": null,
           "hex_light": "#6d28d9", "hex_dark": "#6d28d9", "tag_ids": ["8daee9bb-…"],
           "prompts_count": 29, "prompts_count_inactive": 4, "runs_total": 2408,
           "visibility_pct": 25.71, "avg_rank": 5.61, "avg_sentiment": 76.72},
          {"group_key": "custom:SUV & Hybrid", "group_type": "custom", "tag_ids": ["…", "…"], …},
          {"group_key": "untagged", "group_type": "untagged", …}]}
```

Sortierung wie heute: „ohne Topic“ zuletzt, sonst nach Visibility absteigend, dann Name. Zahlen über Läufe gewichtet; geprüft gleich der Summe der Liste.

**`prompts_page_meta_v1(p_team)`**, ein Aufruf für Kopf und Ablagen (ersetzt `get_tags`, `get_markets_v2` und `get_team_plan_quota` auf dieser Seite):

```json
{"meta": {"team_id": "877c…", "generated_at": "…"},
 "quota": {"plan": "Legacy Free", "prompts_limit": 150, "prompts_active": 102, "prompts_remaining": 48, "inactive_limit": 1000},
 "topics": [{"tag_id": "…", "name": "SUV", "emoji": null, "hex_light": "#6d28d9", "hex_dark": "#6d28d9",
             "prompt_count_active": 29, "prompt_count_inactive": 4, "created_at": "…"}],
 "markets": [{"alpha2": "DE", "name": "Germany", "flag_url": "https://flagcdn.com/de.svg", "prompt_count_active": 79, "prompt_count_inactive": 16},
             {"alpha2": "US", "name": "…", "flag_url": "…", "prompt_count_active": 23, "prompt_count_inactive": 7}]}
```

Werte für 877c echt (Plan, Kontingent, Märkte, Topic „SUV“). `prompt_count` ist überall getrennt nach aktiv und inaktiv, damit Topic-Liste, Gruppen und Kennzahlkarte dieselbe Zahl zeigen.

**Responses:** `cached_dashboard_responses_v1` unverändert.

### 6.3 Schreiben

Alle Schreibfunktionen:

- prüfen Team, Besitz jeder ID und alle Grenzen;
- sperren das Team (`pg_advisory_xact_lock`), wo das Planlimit betroffen ist;
- leeren selbst die Caches (Abschnitt 6.6);
- antworten mit `meta.quota` (`prompts_limit`, `prompts_active`, `prompts_remaining`);
- enthalten keinen exception-Block.

Fremde IDs in Listen werden **nicht** still übergangen: Ist eine ID nicht aus dem Team, kommt `prompts_not_found` (PT404) mit `hint` = Parameter, und es wird nichts geändert.

| Funktion | Parameter | Antwort |
|---|---|---|
| `prompts_add_v1` | `p_team`, `p_items` jsonb `[{"text": "…", "market": "DE" \| null}]` (1–100), `p_tag_ids` uuid[] (≤ 5), `p_input_method` `manual`\|`csv` | `rows`: je Eingabe `{index, result: created \| skipped, reason, prompt_id, prompt_text, market, rewritten}`. `meta`: `created`, `skipped`, `quota` |
| `prompt_topics_set_v1` | `p_team`, `p_prompt_id`, `p_tag_ids` (0–5, vollständige neue Menge) | `meta`: `prompt_id`, `tags` (neuer Stand), `added`, `removed` |
| `prompts_bulk_v1` | `p_team`, `p_action` `add_topics`\|`set_active`\|`set_inactive`\|`delete`, `p_tag_ids` (nur `add_topics`, 1–5), `p_target` `ids`\|`filter`, `p_ids` (1–500, bei `ids`), bei `filter` alle Parameter aus 6.1 + `p_excluded_ids` (≤ 500) + `p_expected_count` (Pflicht) | `meta`: `action`, `target_count`, `changed`, `unchanged`, `quota`; `rows`: je Prompt `{prompt_id, result, reason}` (bei mehr als 500 Zielen nur die Zähler) |
| `topic_save_v1` | `p_team`, `p_tag_id` (null = neu), `p_name`, `p_emoji`, `p_hex_light`, `p_hex_dark` | `meta`: `created`, `topic` (wie in `page_meta`) |
| `topic_delete_v1` | `p_team`, `p_tag_id` | `meta`: `tag_id`, `removed_prompt_links` |
| `clear_prompt_insights_cache_v1` (neu als `prompts_refresh_v1`) | `p_team` | `meta`: `cleared` (Zahl der Cache-Einträge) |

**Verhalten im Einzelnen:**

- **`prompts_add_v1`:**
  - Der Text wird getrimmt und mit denselben Regeln wie der Trigger umgeschrieben. `rewritten = true`, wenn sich etwas geändert hat (Entscheidung zu Sonderzeichen: Abschnitt 8, Frage 2).
  - Dubletten: normalisiert (klein, Leerzeichen zusammengefasst) im Stapel und gegen den Bestand des Teams (aktiv **und** inaktiv). Grund: Die Tabelle erlaubt denselben Text nur einmal je Team, auch in anderem Markt.
  - Skip-Gründe: `duplicate_in_batch`, `exists_active`, `exists_inactive`, `invalid_market`, `too_short`, `too_long`, `invalid_text`.
  - Eine wiederholte Anlage (Doppelklick, Netzfehler) erzeugt dadurch keine Dubletten. Sie liefert `skipped` mit `exists_active` und der vorhandenen `prompt_id`.
  - Planlimit für die Zahl der neuen Prompts, atomar. Reicht es nicht, PT409 `prompts_limit_reached` und nichts wird angelegt.
  - Plan und erster Lauf wie heute über den Trigger (fällig nach 4 Minuten).
- **`prompts_bulk_v1`:**
  - `set_active`: ganz oder gar nicht (kein `Partial`), atomar.
  - `set_inactive`: Grenze 1.000 inaktive Prompts.
  - `delete`: nur inaktive (aktive in der Zielmenge → `prompts_invalid_param`). Ob endgültig oder weich: Abschnitt 8, Frage 3.
  - `add_topics`: füllt bis 5 Topics je Prompt auf, nie entfernen. Ein Prompt mit schon 5 Topics ergibt `unchanged`, Grund `topic_limit`.
- **`topic_delete_v1`:** wie `delete_tag` (Zuordnungen und Topic-Rollups weg). Leert die Caches.

### 6.4 Grenzen (alle in der Datenbank)

| Was | Grenze | Fehler (`message`, errcode, `hint`) |
|---|---|---|
| Prompts je Anlage | 1–100 | `prompts_invalid_param` 22023, `p_items: 1-100` |
| Länge eines Prompts | 3–500 Zeichen nach Trimmen | Zeile `skipped`, Grund `too_short`/`too_long` |
| Formelbeginn `= + - @` | nicht erlaubt | Zeile `skipped`, Grund `invalid_text` |
| Dubletten | normalisiert, Stapel und Bestand | Zeile `skipped`, `duplicate_in_batch`/`exists_*` |
| Planlimit | Anlage, Aktivieren, Prompt Research: atomar | `prompts_limit_reached` PT409, `hint` = freie Plätze |
| inaktive Prompts je Team | 1.000 | `prompts_limit_reached` PT409, `hint` = `inactive:<frei>` |
| Topics je Prompt | 5 (alle Wege) | `prompts_invalid_param` bzw. `unchanged` + `topic_limit` |
| Topics je Team | 50 (heute max 14) | `topics_limit_reached` PT409, `hint` = 50 |
| Topic-Name | 1–60 Zeichen nach Trimmen, eindeutig je Team ohne Groß/Klein | `topics_invalid_param` 22023 / `topics_duplicate_name` PT409 mit `hint` = vorhandene `tag_id` |
| Topic-Farbe | genau `^#[0-9a-fA-F]{6}$` | `topics_invalid_param` 22023, `p_hex_light`/`p_hex_dark` |
| Emoji | leer oder ≤ 8 Zeichen, keine Buchstaben, Ziffern, Leer- oder Steuerzeichen | `topics_invalid_param` 22023, `p_emoji` |
| Eigene Gruppierungen | ≤ 10, `key` 1–60, 1–3 Topics des Teams | `prompts_invalid_param` 22023, `p_groups` |
| Markt | nur aus `app.markets` | Zeile `skipped`, `invalid_market` (Anlage) bzw. `prompts_invalid_param` (Filter) |
| Sammelaktion | Ziel ≤ 1.000 Prompts; `p_ids` ≤ 500; `p_excluded_ids` ≤ 500 | `prompts_invalid_param` 22023 |
| Auswahl verändert | tatsächliche Zielmenge ≠ `p_expected_count` | `prompts_selection_changed` PT409, `hint` = tatsächliche Zahl |
| Löschen | nur inaktive | `prompts_invalid_param` 22023, `hint` = `delete: only inactive` |
| Zeitraum | ≤ 400 Tage, `from ≤ to` | `prompts_invalid_param` 22023 |

### 6.5 Ratenlimits (je Nutzer und Funktion, `_rl_hit_v1`)

| Funktion | pro Minute |
|---|---|
| `cached_prompts_list_v1`, `cached_prompts_groups_v1`, `prompts_page_meta_v1` | je 60 |
| `prompts_refresh_v1` | 10 |
| `prompts_add_v1` | 10 |
| `prompts_bulk_v1`, `prompt_topics_set_v1` | je 30 |
| `topic_save_v1`, `topic_delete_v1` | je 30, dazu höchstens 50 Topics je Team |

Überschritten: `prompts_rate_limited` bzw. `topics_rate_limited`, PT429, `hint` = Sekunden.

### 6.6 Caches, die Schreibaktionen leeren

| Aktion | Prompt-Insights (`dashboard_cache`) | Bubble `rpc_cache` (`prompt_insights_v20`, `prompt_topics_grouped_v1`) | Dashboard, Performance-Radar | Citations |
|---|---|---|---|---|
| Anlage, Aktivieren, Deaktivieren | ja | ja | nein (betrifft erst künftige Läufe) | nein |
| Topics zuweisen/ersetzen, Topic speichern | ja | ja | ja (Topic-Filter, Radar) | nein |
| Topic löschen | ja | ja | ja | ja (Topic-Filter) |
| Prompt löschen | ja | ja | ja | ja |

---

## 7 Offene Fragen an den Nutzer

1. **Rollen:** Dürfen alle Mitglieder alles (wie heute)? Oder Löschen von Prompts und Topics nur `owner`/`admin`?
2. **Sonderzeichen bei der Anlage:** Heute schreibt der Trigger still um (Backtick und Backslash weg, `${` wird `$ {`, Zeilenumbrüche werden Leerzeichen). Soll das so bleiben, mit Hinweis `rewritten` je Zeile? Oder sollen solche Texte abgewiesen werden (`invalid_text`)? Empfehlung: umschreiben und melden.
3. **Prompt löschen:** (a) endgültig wie heute, plus Neuberechnung der Team- und Topic-Rollups; oder (b) weich (`deleted_at`), die Historie bleibt in allen Ansichten gleich. Empfehlung: (b).
4. **Topic-Grenze je Team:** 50 in Ordnung?
5. **Eigene Gruppierungen:** im Browser lassen oder in die Datenbank (geräteübergreifend, im Team teilbar)?
6. **`delete_prompts`:** Welche Fassung ruft Bubble heute, `_v2` oder `_v3`?
7. **Sicherheitsfix K1:** Einspielen jetzt (empfohlen), unabhängig von dieser Seite?

## 8 Nebenbei

- Die Adresse `localhost:8099/rauch21/rauch.html` am Ende des Auftrags liegt auf deinem Rechner; die kann ich nicht öffnen.
- In `AUFRAEUMEN_NACH_UMBAU.md` gehören nach dem Bau dazu:
  - `cached_prompt_insights_alltime_v17`/`v18`, `get_prompt_insights_alltime_v19`/`v20`, `cached_prompt_topics_grouped_v1`/`get_prompt_topics_grouped_v1`, `resolve_prompt_ids_v1`;
  - `create_prompt_with_tags` (alle drei), `create_`/`update_`/`delete_tag`, `assign_tags_bulk`, `set_prompts_active`/`inactive`, `delete_prompts_v2`/`v3`;
  - `get_tags`/`_v2`, `get_team_plan_quota`/`_v2`, `clear_prompt_insights_cache_v1` (Bubble).

---

## 9 Gebaut (10.10.): endgültiger Vertrag

Grundlage sind Abschnitt 6 und die Rückmeldung von Claude Code inklusive Zusatz 1c (asynchrones Löschen). Dieser Abschnitt geht vor, wo er Abschnitt 6 widerspricht.

Dateien:

- `prompt_insights_v1.sql` + `prompt_insights_v1_rueckweg.sql`;
- `prompt_insights_v1_echte_antworten.json` (echte, ungekürzte Antworten, Team 877c, 30 Tage, alle Aufrufe zurückgerollt);
- `csv_export_schutz_v1.sql` + Rückweg.

### 9.1 Änderungen gegenüber Abschnitt 6

| Punkt | Abschnitt 6 | gebaut |
|---|---|---|
| Topics bei der Sammelaktion | `p_tag_ids` | **`p_add_tag_ids`** (1–5). `p_tag_ids` ist in `prompts_bulk_v1` der Topic-**Filter** (Ziel `filter`), wie in Liste und Gruppen. |
| Formelbeginn bei der Anlage | `invalid_text` | erlaubt. Ein Prompt darf mit `-` beginnen („- Leasing für Familien …“ wird angelegt). Geschützt wird beim CSV-Export (9.6). |
| Sonderzeichen | offen | umschreiben und melden: Backtick und Backslash weg, `${` → `$ {`, Zeilenumbruch → Leerzeichen, unsichtbare Zeichen (U+200B–U+200D, U+2060, U+FEFF) weg. Zeile meldet `rewritten: true`. Reines Zusammenfassen von Leerzeichen zählt nicht als `rewritten`. |
| Emoji | ≤ 8 Zeichen | ≤ 16 Codepunkte (zusammengesetzte Emojis wie 👩🏽‍❤️‍💋‍👨🏻 passen), keine Buchstaben, Ziffern, Leer- oder Steuerzeichen |
| Rollen | offen | `delete` in `prompts_bulk_v1` und `topic_delete_v1` nur `owner`/`admin`, sonst `prompts_forbidden` bzw. `topics_forbidden` PT403, `hint` = `owner|admin`. Alles andere dürfen alle Mitglieder. `prompts_page_meta_v1` liefert `meta.role`. |
| Prompt löschen | offen | sofortiger Teil + Hintergrundlauf (9.3) |
| Neu | – | `prompts_purge_status_v1`, Realtime `prompt_purge_status` |
| `page_meta` | ohne | zusätzlich `quota.prompts_inactive` und `markets_all` (alle 134 Märkte für die Anlage) |

### 9.2 Funktionen (alle `Content-Profile: app`, POST `/rest/v1/rpc/<name>`)

| Funktion | Zweck |
|---|---|
| `cached_prompts_list_v1` | Tabelle (Filter 6.1 + `p_order`, `p_limit` 1–100, `p_offset`) |
| `cached_prompts_groups_v1` | Gruppenköpfe (`p_mode`, `p_groups`) |
| `prompts_page_meta_v1(p_team)` | Rolle, Kontingent, Topics, Märkte mit Zählern, alle Märkte |
| `prompts_add_v1` | Anlage |
| `prompt_topics_set_v1` | Topics eines Prompts ersetzen (0–5) |
| `prompts_bulk_v1` | `add_topics` \| `set_active` \| `set_inactive` \| `delete`, Ziel `ids` oder `filter` |
| `topic_save_v1`, `topic_delete_v1` | Topic anlegen/ändern, löschen |
| `prompts_refresh_v1(p_team)` | Aktualisieren |
| `prompts_purge_status_v1(p_team, p_job_id)` | Stand eines Löschauftrags; ohne `p_job_id` der letzte des Teams |

Antwortformen, Grenzen, Fehler und Ratenlimits wie Abschnitt 6.2–6.5 mit den Änderungen aus 9.1. Die echten Antworten aller Fälle stehen in der JSON-Datei (Lauf A: Lesen, Schreiben, Fehler; Lauf B: Löschen und Messung).

### 9.3 Löschen (Zusatz 1c)

**Sofort, in `prompts_bulk_v1` mit `p_action = 'delete'`:**

- nur `owner`/`admin`, nur inaktive Prompts;
- Originaltexte und Markt landen im Protokoll (`prompt_activity_log`, Aktion `prompts_delete_requested`);
- der Prompt bekommt `deleted_at`. Der Text wird zu `[deleted <id>] <alter Text>`. Damit ist derselbe Text sofort wieder anlegbar (Tabelle erlaubt einen Text nur einmal je Team);
- ein Löschauftrag wird angelegt; die Antwort enthält `meta.job_id`;
- der Prompt verschwindet sofort aus allen neuen Funktionen: Liste, Gruppen, Kopfzahlen, Kontingent, Dubletten-Prüfung.

**Danach, Hintergrundlauf** (Cron `prompt-purge-worker`, alle 10 Sekunden, je Lauf höchstens 40 Sekunden). Er arbeitet in Teilen, jeder Teil ist eine eigene Transaktion:

1. `rollups`: Team-, Topic-, Wochen- und Monatswerte um die Werte des Prompts verringern, Prompt-Rollups löschen;
2. `citations`: Citation-Rollups des Prompts in Blöcken zu 20.000;
3. `runs`: Läufe in Blöcken zu 300, mit Empfehlungen, Citations, Kosten (abgezogen), Chats, Jobs;
4. `finish`: Reste (Pläne, Topics-Zuordnung, Ignore-Log), der Prompt selbst, alle Caches des Teams.

Bricht ein Teil ab, versucht der nächste Lauf ihn erneut (jeder Teil ist wiederholbar). Nach 5 Fehlversuchen steht der Auftrag auf `error`, mit `error.message`.

**Für den Nutzer unsichtbar:** Der Klick auf Löschen antwortet sofort, die Prompts sind sofort weg. Es gibt keine Ladeanzeige und keinen Fortschritt. Der Hintergrundjob leert am Ende selbst die Caches; beim nächsten Laden stimmen Dashboard und Citations.

**Nur für Technik und Fehlersuche:**

- Realtime, öffentlicher Kanal `prompt_purge_job:<job_id>`, Event `prompt_purge_status`;
  - Payload wie `prompts_purge_status_v1.meta`;
  - gesendet bei Anlage und bei jedem Wechsel von `status` oder `step`.
- Optional im Frontend: Ist das Dashboard gerade offen, bei `success` still nachladen.
- `prompts_purge_status_v1` für Support; bei `error` steht der Grund in der Tabelle `prompt_purge_job`. Ich schaue dort nach, der Nutzer sieht davon nichts.

### 9.4 Messungen (Prod, zurückgerollt, 10.10.)

| Was | Zeit |
|---|---|
| Sofortiger Teil, 1 Prompt (764 Läufe) | 18 ms |
| Sofortiger Teil, 1.000 Prompts über `filter` | 493 ms |
| Hintergrund, Prompt mit der meisten Historie (764 Läufe, 16.826 Citation-Rollup-Zeilen), Rechenzeit gesamt | 13,8 s |
| davon `rollups` | 1,8 s |
| davon `citations` | 1,1 s |
| davon `runs` (3 Blöcke à 300) | 9,9 s |
| davon `finish` | 0,9 s |
| `topic_delete_v1` (SUV, 36 Zuordnungen, mit Topic-Rollups) | 194 ms |

Der Auftrag passt damit in einen Lauf von 40 Sekunden. Nach dem Klick ist er spätestens nach rund 25 Sekunden fertig (bis 10 Sekunden Wartezeit auf den nächsten Lauf).

**Prüfsumme:**

- Team-Rollups gegen die Summe der Prompt-Rollups, 90 Tage, Läufe und Marken, dazu Wochen gegen Tage;
- vor dem Löschen 0 Abweichungen, nachher 0 Abweichungen.

**Dashboard vor/nach (30 Tage):**

| Wert | vorher | nachher |
|---|---|---|
| eigene Marke, Erwähnungen | 2.612 | 2.609 |
| eigene Marke, Visibility | 30,77 % | 31,05 % |
| VW, Erwähnungen | 3.571 | 3.559 |

**Lesen, kalt (877c, 30 Tage):**

| Aufruf | Zeit |
|---|---|
| Liste, Vorgabe | 514 ms |
| Liste mit Markenfilter | 344 ms |
| Gruppen | 125 ms |
| Seitenkopf | 11 ms |
| Blättern aus dem Cache | 9 ms |

Der Hintergrundlauf selbst (Prozedur mit COMMIT) lässt sich nicht in einer Transaktion testen. Nach dem Einspielen prüfe ich ihn über `cron.job_run_details` und die Tabelle `prompt_purge_job`.

### 9.5 Antworten auf die offenen Punkte der Rückmeldung

- **RLS:** Die 19 Policies sind korrigiert und live geprüft (`rls_fix_team_policies.sql`, 19 Zeilen, `noch_offen` = false).
- **Planlimit atomar über alle Wege:**
  - Anlage, Aktivieren und Prompt Research sperren mit demselben Schlüssel (`prompts_quota|<team>`);
  - `prompt_research_decide_v1` ändert dafür nur die Sperrzeile, alter Stand im Rückweg;
  - geprüft: Anlage und Aktivieren über dem Limit liefern `prompts_limit_reached`, `hint` = `0`; es wird nichts geändert.
- **`p_add_tag_ids`:** siehe 9.1.
- **Bubble während der Übergangszeit:**
  - Die alten Funktionen kennen `deleted_at` nicht.
  - Ein gelöschter Prompt erscheint dort bis zum Ende des Hintergrundlaufs als inaktiver Prompt mit dem Text `[deleted …]`, also Sekunden.
  - Bubble selbst löscht weiter über `delete_prompts_v2`/`v3`.

### 9.6 CSV-Exporte (`csv_export_schutz_v1.sql`)

Neue Hilfsfunktion `app.csv_safe_v1(text)`: Beginnt eine Zelle mit `=`, `+`, `-`, `@`, Tab oder CR, wird ein `'` vorangestellt.

Betroffene Exporte und Spalten (nur Freitext und Fremdtext; Zahlen, Datum, IDs, jsonb unverändert):

| Export | Spalten |
|---|---|
| `export_brands_v1` | `brand` |
| `export_domains_v1` | `domain` |
| `export_prompt_runs_v1` | `prompt_text`, `model_response` |
| `export_prompts_full_v2` | `prompt_text` |
| `export_urls_v1` | `url`, `domain`, `title`, `mentions` |

Geprüft (zurückgerollt):

- `export_prompt_runs_v1` mit einem Lauf `=HYPERLINK(…)` und einer Antwort `-2+3 …` ergibt `'=HYPERLINK(…)` und `'-2+3 …`;
- `export_brands_v1` und `export_domains_v1` (30 Tage, 1,2 s) laufen;
- bei `export_prompts_full_v2` und `export_urls_v1` sind alle umhüllten Spalten vom Typ `text`.

Die Namen in jsonb-Spalten (`tags`, `top_mentions`) sind nicht umhüllt. Sie beginnen in der CSV-Zelle mit `[` und sind damit keine Formel.

### 9.7 Einspielen

1. `prompt_insights_v1.sql` als ein Block. Die Kontrolle am Ende listet die Funktionen (anon überall false), die beiden Tabellen, das Feld `deleted_at` und den Cron-Job.
2. `csv_export_schutz_v1.sql` als ein Block. Die Kontrolle zeigt je Export die md5 „ist = soll“ und den Test der Hilfsfunktion.
3. Danach sage ich Bescheid: Ich prüfe den ersten echten Löschauftrag in `prompt_purge_job` und `cron.job_run_details`.
