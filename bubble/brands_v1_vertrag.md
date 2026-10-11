# Brands als Seiten-Komponente: Bestandsaufnahme, Befunde, Vertragsvorschlag

Stand 11.10.2026. Antwort auf den Auftrag vom 11.10. (`bubble/brands_db_auftrag.md`).

In dieser Runde habe ich nichts geändert. Ich habe nur gelesen und in zurückgerollten Transaktionen gemessen und getestet, in Prod mit Team 877c (Mercedes Benz, 10 Wettbewerber plus eigene Marke, Plan Legacy Free mit 10 Plätzen).

- **Aufrufer:** owner 7bedb728…, member f25d8f66… und admin aea6e317…. Fremder Aufrufer war Nutzer b6f0e8a9…, Mitglied von Team eee8727a (Allianz), nicht von 877c.
- **Definitionen:** Alle genannten Funktionen habe ich mit `pg_get_functiondef` gelesen. Gesichert liegen sie in `_build/brands/defs1–5.json`.
- **Rohdaten:** Die Testergebnisse stehen in `_build/brands/brt1.json` und `brt2.json`, der Zahlenvergleich in `cmp1.json`.

**Ausnahme vom „nichts ändern“:** Wie bei Prompt Insights schlage ich einen Sofort-Fix vor, unabhängig von der Seite (Befund K1).

- Dateien: `brands_sofort_rechte.sql` mit `brands_sofort_rechte_rueckweg.sql`.
- Beide sind im Rollback geprüft, inklusive Rückweg (md5 wieder gleich, Ergebnis siehe Abschnitt 8).
- Einspielen entscheidest du.

---

## 0 Kurzfassung

| Nr | Schwere | Befund |
|---|---|---|
| K1 | **kritisch** | Ohne Anmeldung lesbar. `get_team_companies_v1(uuid)` und `get_team_companies_context_v2(uuid)` sind security definer, prüfen weder Anmeldung noch Mitgliedschaft und sind für `anon` ausführbar.<br>Mit dem öffentlichen Schlüssel und einer Team-ID kommen alle Marken des Teams zurück, bei `context_v2` mit allen Aliasen (Test A1, A2: 11 Marken, 9 Aliase).<br>Die Überladung `get_team_companies_v1(uuid, uuid)` nimmt den Nutzer aus dem Parameter statt aus dem JWT (A3). |
| K2 | **kritisch** | Discover läuft ins Zeitlimit.<br>`get_untracked_brand_candidates_v8` braucht mit Domain-Abgleich 19,8 s (14 Tage) bzw. 39,0 s (30 Tage). Das Zeitlimit für angemeldete Nutzer liegt bei 30 s: Ab etwa 21 Tagen bricht der Aufruf ab.<br>Der 60-Minuten-Cache hilft nicht: Der Trigger `trg_invalidate_cache_on_run` löscht bei **jedem** neuen Lauf den ganzen `rpc_cache` des Teams, bei 877c rund 11-mal pro Stunde.<br>Über das Jahr: 150 Aufrufe, im Mittel 4,8 s, höchstens 36,6 s. |
| H1 | hoch | Schreiben meldet Fehler als Erfolg. `add_competitor_v4`, `deactivate_competitor_v5`, `reactivate_competitor_v2` und `update_team_company_display_name_v1` fangen alles mit `exception when others` und antworten mit HTTP 200 und `status: error`.<br>Selbst das Ratenlimit verschwindet so: Der 21. Aufruf pro Minute meldet „Something went wrong…“ (R21). |
| H2 | hoch | Das Planlimit ist nicht atomar: zählen, dann einfügen, ohne Sperre.<br>Allianz hat heute 12 aktive Wettbewerber bei 10 Plätzen.<br>Zwei gleichzeitige Anlagen derselben **neuen** Domain können zwei globale Firmen ergeben, weil die Domain nicht eindeutig ist (aus dem Code, nicht mit zwei Sitzungen getestet). |
| H3 | hoch | Nach Deaktivieren zeigt Tracked bis zu 5 Minuten den alten Stand. Keine Schreibfunktion leert einen Cache.<br>Test M4/M5: VW ist deaktiviert, die Tabelle zeigt VW aber weiter (`cached: true`, `stale: true`), bis der Hintergrundjob neu rechnet. |
| H4 | hoch | Discover zeigt getrackte Marken als „nicht getrackt“.<br>Der Schnellweg schließt getrackte Marken gar nicht aus, der Domain-Weg nur über die Domain.<br>30 Tage, alle Teams: 23 Schreibweisen, z. B. „Agentur für’s Handwerk“ (88 Erwähnungen, getrackt bei Team ca88…) und zweimal die **eigene** Marke („koeppern“ bei Team 420a…, „SAC Hub“ bei Team 664f…).<br>Eine frisch angelegte Marke bleibt in Discover stehen. Test N0/N9: Tesla ist angelegt, „Tesla“, „Tesla Model Y“ und „Tesla Model 3“ stehen weiter in der Liste. |
| H5 | hoch | Anlegen ohne Prüfung der Eingaben:<br>• Der Name ist unbegrenzt (5.000 Zeichen gespeichert, M17).<br>• Die Domain wird nicht geprüft: `backtick test.example` wird zu `https://backtick test.example` (M18).<br>• Ein Schema bleibt roh: `javascript://xss-test.example/%0Aalert(1)` steht als `company.url` in der **globalen** Firma (M16).<br>• Gleicher Name zweimal aktiv ist erlaubt (N7: „BMW“ zweimal). |
| H6 | hoch | `set_own_brand_settings_v5` hat keinen `search_path` und keine Rollenprüfung und nimmt jede verknüpfte Firma.<br>Ein `member` kann damit den Namen **und das Logo** jedes Wettbewerbers seines Teams setzen, auch `javascript:alert(1)` (E1).<br>`_citations_abs_url_v1` reicht solche Werte unverändert durch. |
| M1 | mittel | Die Planlimit-Prüfung kommt vor der Dublettenprüfung: Eine schon getrackte Domain meldet „limit reached“ statt „already tracked“ (M19, N10). |
| M2 | mittel | Keine Rollen beim Anlegen, Aktivieren und Deaktivieren (jedes Mitglied). Der Editor verlangt dagegen owner/admin. |
| M3 | mittel | Editor-Lücken (nur Befund):<br>• `add_company_alias_v1` und `set_company_color_override_v1` nehmen Firmen, die nicht im Team sind (E2, E4). Heute gibt es 13 verwaiste Aliase.<br>• Der Name im Editor ist unbegrenzt (3.000 Zeichen, E3).<br>• Der Alias ist unbegrenzt. |
| M4 | mittel | Discover-Namen aus Modelltext:<br>• 1 Name mit Backtick, `${` oder Backslash, 58 mit unsichtbaren Zeichen, 72 länger als 75 Zeichen (bis 143). Der eine Name tötet den Run-JS-Schritt von Discover.<br>• „Škoda“ und „Skoda“ sind zwei Zeilen, weil der Schlüssel nur ä, ö, ü und ß faltet. |
| M5 | mittel | Der Standardzeitraum von Discover ist `current_date - 14` nach Datenbank-Datum (UTC), also 15 Tage. Es gibt keine Obergrenze und keinen Suchparameter. |
| M6 | mittel | Fehlerform uneinheitlich: Die alten Funktionen antworten mit `status`/`status_message` und HTTP 200, die Discover-Funktion mit `raise 'forbidden'` (P0001). |
| N1 | niedrig | Die Inaktiv-Liste (`get_inactive_competitors_v1`) zeigt den globalen Namen statt des Team-Namens („Volkswagen“ statt „VW“, M7). Fremde Teams bekommen still `[]` (in Ordnung). |
| N2 | niedrig | Altlasten:<br>• `delete_company_hard_v1` ist für `anon` ausführbar. Heute ist das wirkungslos, weil die Tabellenrechte fehlen (A4).<br>• `add_team_competitor_v1` ist security invoker und für `anon` ausführbar, gibt `sqlerrm` zurück (A5).<br>• `get_competitors_with_visibility_ui` ist kaputt (`uuid = text`, A10). |
| N3 | niedrig | Der Export (`export_brands_v1`) hat den Formelschutz. Für 30 Tage stimmen die Zahlen genau mit Dashboard v1 überein. Über 30 Tage weicht Sentiment ab, weil die 30-Tage-Grenze fehlt (aus der Definition). |

**Was trägt:**

- **Tracked-Zahlen:** Für 30 Tage sind Chart und Tabelle aus Dashboard v1 in **allen** Feldern aller 11 Marken gleich wie heute `cached_competition_overview_v19` → `get_competition_overview_v24`. Einziger Unterschied: das Logo der eigenen Marke, `//…` bei v24 gegenüber `https://…` bei v1.
- **Zugriff:** Fremde Teams kommen bei allen Lese- und Schreibfunktionen der Ansicht nicht durch (F1–F9). Ausnahme ist K1.
- **Anlegen:** Backtick, Backslash und `${` entschärft heute schon der Trigger `trg_clean_text` beim Schreiben. In Firmennamen, Overrides und Aliasen steht keiner davon.

---

## 1 Bestand: Aufrufe der heutigen Brands-Ansicht

**Quelle für die Zuordnung:** Die Namen stehen in Bubble nicht dokumentiert. Ich habe sie so ermittelt:

1. `pg_stat_statements`: Funktionsname aus der PostgREST-Abfrage, Zähler seit 05.09.2025.
2. Edge-Logs: drei 24-Stunden-Fenster (06., 08., 09./10.10.) mit Rolle und User-Agent.
3. Die Kommentare in `brands_overview_bubble.html` und `discover_brands_bubble.html`.

| Teil der Ansicht | Funktion (neueste, die gerufen wird) | Aufrufe | Mittel / max | Zugang |
|---|---|---|---|---|
| Linienchart | `cached_competition_chart_v15` → `get_competition_chart_v16` | 3.848 (5–18 pro Tag) | 14 ms / 1,1 s | `require_team_access`, anon darf ausführen |
| Tabelle, Landscape | `cached_competition_overview_v19` → `get_competition_overview_v24` | 3.111 (5–18 pro Tag) | 201 ms / 7,9 s | `require_team_access`, anon darf ausführen |
| Aktualisieren Tracked | `clear_competition_overview_cache_v1`, `clear_competition_chart_cache_v1` | 195 / 37 | 1 ms | Mitgliedschaft, anon darf ausführen |
| Reiter Inactive | `get_inactive_competitors_v1(p_team, p_limit 50, p_offset)` | 148 | 4 ms | Mitgliedschaft (sonst `[]`) |
| Set inactive | `deactivate_competitor_v5(p_team, p_company)` | 57 | 25 ms | Mitgliedschaft, eigene Marke gesperrt |
| Activate | `reactivate_competitor_v2(p_team, p_company)` | 47 | 10 ms | Mitgliedschaft, Planlimit |
| Add Brand | `add_competitor_v4(p_team, p_name, p_domain, p_reachable)` | 65 | 25 ms | Mitgliedschaft, Planlimit, Rate 20/min |
| Explore Brands | `cached_get_untracked_brand_candidates_v8` → `get_untracked_brand_candidates_v8` | 150 | **4,8 s / 36,6 s** | Mitgliedschaft, Rate 30/min |
| Discover Aktualisieren | `clear_cached_get_untracked_brand_candidates_v5` | 25 | 1 ms | Mitgliedschaft |
| Marken-Ablage | `get_team_companies_v1(p_team)` | 35–64 pro Tag, davon 8–9 **ohne Nutzertoken** | 1 ms | **keine** |
| n8n (Erkennung im Lauf) | `get_team_companies_context_v2(p_team)` | 1.300–1.700 pro Tag, **nur** `service_role` (axios) | 2 ms | **keine** |
| Editor | `get_company_edit_v2`, `update_team_company_display_name_v1`, `add/toggle/delete_company_alias_v1`, `set/clear_company_color_override_v1` | 861 / 62 / 160 / 80 / 29 / 47 / 19 | ≤ 10 ms | Mitgliedschaft, Schreiben owner/admin |

Welche Parameter Bubble an Discover schickt, steht nirgends.

- **Matched = yes** ist laut Komponente „nur Marken mit zugeordneter Domain“, also `p_only_with_domain = 'yes'`.
- **Matched = no** ist „nur Abgleich über den Namen“, vermutlich `p_recognize = 'no'` (Schnellweg).
- Ob Zeitraum, Models, Markets oder Topics mitgehen, lässt sich aus der Datenbank nicht sehen. Die Cache-Einträge sind wegen K2 nie lange genug da.

**Was jede Funktion tut:**

- **`add_competitor_v4`:**
  1. Domain aus der Eingabe: Host bis zum ersten `/`, ohne `www.` und ohne Port.
  2. Planlimit: zählt die aktiven Wettbewerber, ohne Sperre.
  3. Sucht eine **globale** Firma mit gleichem Host.
  4. Gibt es sie und ist sie die eigene Marke → Fehler. Schon getrackt → Fehler. Im Archiv → wieder verknüpfen (Grund `reactivated`). Sonst nur verknüpfen.
  5. Gibt es sie nicht → neue Firma: Name, `url` (roh, wenn ein Schema dabei war, sonst `https://<host>`), Favicon von Google S2.
  6. Weicht der Name vom globalen Namen ab → `team_brand_profile.name_override`.
  7. Legt einen Domain-Alias `exact_ci` an und öffnet eine Tracking-Periode (`created`/`reactivated`).
  8. Leert keinen Cache, schreibt kein Protokoll, vergibt keine Farbe.
- **`deactivate_competitor_v5`:** schreibt einen Archiv-Eintrag, schließt die offene Periode (`end_reason = deactivated`) und löscht die Zeile in `team_company`. Die Historie (Rollups je Firma) bleibt, die Marke fällt aber aus allen Ansichten, weil diese über `team_company` laufen.
- **`reactivate_competitor_v2`:** nur aus dem Archiv. Prüft das Planlimit, fügt die Zeile in `team_company` wieder ein, öffnet eine neue Periode (`reactivated`) und löscht den Archiv-Eintrag. Die Lücke bleibt eine Lücke.
- **Erkennung im Lauf:** n8n holt pro Lauf die aktiven Marken mit Aliasen (`context_v2`) und schickt die `company_id` mit. Es gibt **keine** Nachberechnung alter Antworten. Eine neue Marke zählt ab dem nächsten Lauf und ab Beginn ihrer Periode. Erwähnungen in der Zeit, in der eine Marke inaktiv war, bleiben ohne `company_id`.

---

## 2 Datenlage (alle 14 Teams, 11.10.)

| Was | Wert |
|---|---|
| Planlimit Wettbewerber | Essential 5, Professional 10, Legacy Free 10, Enterprise 15. Die eigene Marke zählt nicht |
| Aktive Wettbewerber je Team | max 12, p95 12. Mit eigener Marke max 13 |
| Über dem Planlimit | 1 Team (Allianz: 12 von 10) |
| Inaktive je Team | max 6, p95 6 |
| Teams ohne Plan | 2 (Limit `null` = unbegrenzt im alten `add_competitor_v4`; `require_team_access` sperrt sie in v1 mit `no_plan`) |
| Firmen gesamt / ohne URL / ohne Team (verwaist) | 364 / 0 / 218 |
| Firmen, die mehrere Teams teilen | 1 (2 Teams) |
| Firmen mit gleicher Domain | 1 Paar (asus.com) |
| URL mit Pfad / nicht https | 7 / 0 |
| Favicons | 357 von Google S2, alle https |
| Namen mit Backtick, `${`, Backslash, Steuerzeichen oder unsichtbaren Zeichen | 0 |
| Namen länger als 75 Zeichen | 1 |
| Team-Overrides (Name / Logo) | 19 / 6. 2 Logos sind protokollrelativ (`//…cdn.bubble.io`) |
| Aliase gesamt / max je Marke / Regex / verwaist | 105 / 8 / 0 / 13 |
| Konsistenz | Archiv und aktiv zugleich: 0, aktive Marke ohne offene Periode: 0, offene Periode ohne Marke: 0 |

**Discover, Namen aus Modelltext:** 1,7 Mio. Erwähnungen ohne Marke.

- 1 Name mit Backtick, `${` oder Backslash, 58 mit unsichtbaren Zeichen, 72 länger als 75 Zeichen (max 143).
- 239 Namen mit `<`, `>` oder `"`, 7 mit Formelbeginn.
- Letzte 30 Tage: 28.066 verschiedene Marken-Schlüssel in 12 Teams.

---

## 3 Messungen (877c, zurückgerollt)

### 3.1 Tracked: heute gegen Dashboard v1, 30 Tage (12.09.–11.10.)

Beide habe ich in derselben Transaktion gerechnet. In allen 11 Marken sind `position`, `visibility_pct`, `_prev`, `_delta`, `avg_rank`, `_prev`, `_delta`, `sentiment`, `_prev`, `_delta`, `mentions` und `mentions_prev` gleich. Der Export (`export_brands_v1`) gibt für dieselben 30 Tage und für die 30 Tage bis gestern dieselben Werte.

Die ersten drei Zeilen (beide Funktionen gleich):

| position | Marke | visibility_pct | Δ | avg_rank | Δ | sentiment | Δ | mentions |
|---|---|---|---|---|---|---|---|---|
| 1 | VW | 42,34 | +0,83 | 5,08 | +0,16 | 75,71 | +1,67 | 3.497 |
| 2 | BMW | 36,17 | +0,54 | 4,89 | −0,16 | 76,56 | +0,36 | 2.987 |
| 3 | Mercedes Benz (eigene) | 30,83 | −0,77 | 4,89 | 0,00 | 78,13 | +0,53 | 2.546 |

`meta.runs_total` 8.259, `total_count` 11.

**Laufzeit** (direkt als postgres, ohne Cache):

| Funktion | Zeit |
|---|---|
| v24 | 2.111 ms |
| `_dash_overview_calc_v1` kalt | 1.744 ms |
| `cached_dashboard_overview_v1` aus dem Cache | 2,7 ms |

Der Chart ist laut Dashboard-Vertrag vom 08.10. in allen 210 Tageswerten gleich v16. Einzige gewollte Abweichung: v1 zeigt außerhalb des Tracking-Fensters `null` (Lücke), v16 zeigte dort noch `avg_rank`.

### 3.2 Discover (`get_untracked_brand_candidates_v8`, `p_limit 30`, ohne Cache)

| Stellung | Zeitraum | Zeit | Kandidaten | Zeilen mit Domain | Erste Zeile |
|---|---|---|---|---|---|
| `recognize no`, `only_with_domain no` | Vorgabe (15 Tage UTC) | 0,52 s | 2.749 | 0 | Tesla Model Y, 10,45 %, 412 von 3.941 |
| `yes`, `no` | Vorgabe | 12,1 s | 2.749 | 12 von 30 | Tesla Model Y, 10,45 % |
| `yes`, `yes` (Matched) | Vorgabe | **19,8 s** | 306 | 30 | ADAC, 8,48 %, adac.de |
| `yes`, `yes` (Matched) | 30 Tage | **39,0 s** | 418 | 30 | ADAC, 10,04 %, 829 von 8.257 |

**Die ersten drei Zeilen:**

- Matched = no: Tesla Model Y, ADAC, Hyundai Ioniq 5.
- Matched = yes: ADAC (adac.de), dann weitere Marken mit Domain.

Die volle Liste der 30 Namen (Matched = no) steht in `_build/brands`.

**Prototyp für den Vorschlag** (Abschnitt 6.4), Tagesverdichtung für 877c, 30 Tage:

| Schritt | Ergebnis |
|---|---|
| Verdichten | 35.717 Zeilen (Tag × Prompt × Model × Marke × Schreibweise) in 0,66 s |
| Top 30 lesen | **40 ms** |
| Domain-Abgleich (der teure Teil) | etwa 1,3 s je Team und Tag |

### 3.3 Schreiben (Tests M, N, E: Ergebnis in der Datenbank)

| Test | Aufruf | Ergebnis |
|---|---|---|
| M1 | Anlegen bei 10/10 | `You reached your competitor limit.` |
| M2 | Firma eines anderen Teams deaktivieren | `This company is not linked to your team.` |
| M3 | Eigene Marke deaktivieren | `You cannot deactivate your own brand.` |
| M4 | VW deaktivieren (member) | ok, 44 ms. `team_company` weg, Archiv-Eintrag, Periode geschlossen (`deactivated`) |
| M5 | Tabelle direkt danach | VW steht noch drin, `cached: true`, `stale: true` |
| M7 | Inaktiv-Liste | `[{"company_id":"666761a9…","name":"Volkswagen","favicon_url":"https://www.google.com/s2/favicons?domain=volkswagen.de&sz=64","deactivated_at":"2026-10-11T09:26:38Z"}]` |
| M8 | VW reaktivieren | ok. Perioden: alt (`created`, beendet `deactivated`) und neu (`reactivated`, offen) |
| M14 | Tesla anlegen (Firma gibt es schon, ohne Team) | ok. Verknüpft mit der bestehenden globalen Firma; Override „Tesla Motors“, Alias `tesla.com` |
| M15 | Tesla zweimal | `This competitor is already tracked for your team.` |
| M16 | Domain `javascript://xss-test.example/%0Aalert(1)` | ok. Neue globale Firma mit genau dieser `url` |
| M17 | Name mit 5.000 Zeichen | ok, 5.000 Zeichen gespeichert |
| M18 | Name ``Back`tick ${x} \ Ende``, Domain `backtick test.example` | ok. Name `Backtick $ {x} Ende` (still umgeschrieben), URL `https://backtick test.example` |
| N4 | Domain einer getrackten Marke (Platz frei) | `already tracked` |
| M19, N10 | Dasselbe bei 10/10 | `limit reached` (falsche Meldung) |
| N5 | Domain einer inaktiven Marke (Volvo) | ok. Reaktiviert, neue Periode `reactivated`, Override „Volvo Cars“ |
| N6 | Domain der eigenen Marke | `This domain is already set as your own brand.` |
| N7 | Name „BMW“ mit anderer Domain | ok. Zwei aktive „BMW“ |
| E1 | `set_own_brand_settings_v5` als member, für KIA | ok. KIA heißt im Team „Umbenannt durch member“, Logo `javascript:alert(1)` |
| E2 | Alias (admin) für eine Firma, die nicht im Team ist | `inserted` |
| E3 | Umbenennen (admin), 3.000 Zeichen | ok |
| E4 | Farbe (admin) für eine Firma, die nicht im Team ist | `saved` |
| E5 | Alias als member | `forbidden` (richtig) |
| R20, R21 | Anlegen, 20. und 21. Aufruf in einer Minute | 20.: Fachfehler. 21.: „Something went wrong…“ statt Ratenlimit |

### 3.4 Zugriff (Tests A ohne Anmeldung, F fremdes Team)

| Test | Aufruf | Ergebnis |
|---|---|---|
| A1 | anon `get_team_companies_v1(877c)` | **11 Marken** mit Name und Logo |
| A2 | anon `get_team_companies_context_v2(877c)` | **11 Marken, 9 Aliase** |
| A3 | anon `get_team_companies_v1(877c, beliebiger Nutzer)` | **11** |
| A4 | anon `delete_company_hard_v1` | 42501 (Tabellenrechte fehlen) |
| A5 | anon `add_team_competitor_v1` | `status: error, reason: permission denied for table team` |
| A6, A9 | anon anlegen / deaktivieren | `status: error` (abgewiesen) |
| A7 | anon Inaktiv-Liste | `[]` |
| A8 | anon Discover | `not authenticated` |
| F1–F3 | fremdes Team: anlegen, deaktivieren, reaktivieren | abgewiesen (`status: error`) |
| F4 | fremdes Team: Inaktiv-Liste | `[]` |
| F5, F7, F9 | Editor, Discover, Drawer | `forbidden` (P0001) |
| F8 | Overview v19 | `forbidden` (42501) |
| F6 | `get_company_edit_v2(eigenes Team, Firma von 877c)` | Liefert die globalen Daten der fremden Firma (Name, Domain, Favicon), aber keine Team-Daten. Niedrig |

**Mit curl über HTTP habe ich nicht geprüft.** Die Prüfung lief in der Datenbank mit derselben Rolle (`anon`), die PostgREST ohne Nutzertoken setzt. Zum Nachprüfen:

```bash
curl -s -X POST "https://tgdossbsevnonssyuewp.supabase.co/rest/v1/rpc/get_team_companies_v1" \
  -H "apikey: <ANON_KEY>" -H "Content-Profile: app" -H "Content-Type: application/json" \
  -d '{"p_team":"877c649c-f5f2-44e9-bb04-155f5bf44e70"}'
```

Heute kommen 11 Marken zurück, nach dem Sofort-Fix `[]`.

---

## 4 Befunde zu den Prüfpunkten aus Abschnitt 4 des Auftrags

### 4.1 Rechenfehler und Widersprüche

- **Brands gegen Dashboard gegen Performance:** gleich. Brands nimmt künftig dieselben Funktionen wie das Dashboard. Performance v1 rechnet über dieselben `_dash_*`-Helfer.
- **Nur im Tracking-Zeitraum:** ja.
  - `_dash_scope_v1` bildet je Marke Fenster aus den Perioden. Der Chart zeigt außerhalb `null`.
  - Deaktivieren schließt die Periode, Aktivieren öffnet eine neue. Die Lücke bleibt leer.
  - Erwähnungen in der Lücke sind ohnehin nicht der Marke zugeordnet: n8n kennt nur aktive Marken.
- **Getrackte Marke in Discover:** ja, Befund H4.
  - „Gleich“ heißt heute: Die Erwähnung hat keine `company_id` (Erkennung im Lauf). Im Domain-Weg zusätzlich: Die erkannte Domain ist keine Domain einer getrackten Marke.
  - Die eigene Marke taucht auf, wenn die Erkennung im Lauf sie verpasst hat („koeppern“).
- **`visibility_pct` in Discover:** gleiche Formel wie für getrackte Marken (Läufe mit Erwähnung ÷ alle Läufe), aber:
  - Nenner aus `daily_runs_by_prompt_model`, Dashboard aus `daily_runs_by_model`. Ohne Topic- und Markt-Filter ist das gleich.
  - Zeitraum nach UTC-Datum, nicht Berlin.
  - Ohne Tracking-Fenster, was hier richtig ist.
- **Reihenfolge bei Gleichstand:** Dashboard nach `position` (Name, dann `company_id`). Discover nach Visibility, dann Erwähnungen, dann Name. Stabil, weil jeder Schlüssel genau einen Namen hat.
- **Zeitzone:** Dashboard und Export rechnen mit Berlin. Discover rechnet die Vorgabe mit UTC (M5). Der Export rechnet Tracking-Perioden mit `::date` in UTC; das trifft nur Tage, an denen eine Marke kurz nach Mitternacht deaktiviert wurde.

### 4.2 Zugriff und Rollen

- **`anon`:** K1 (drei Funktionen ohne Prüfung). Alle anderen Brands-Funktionen weisen anon ab. Ausführen darf anon trotzdem alle alten Funktionen; das ziehen wir nach der Umstellung nach, wie beim Dashboard.
- **Fremde IDs:** Deaktivieren, Aktivieren und Lesen weisen fremde Firmen ab. Gemischte Listen gibt es heute nicht, jeder Aufruf hat eine ID. Der Editor nimmt fremde Firmen (M3).
- **Geteilte Firmen:**
  - Global sind Name, `url`, Favicon und Grundfarbe von `app.company`. Die setzt nur, wer die Firma **zuerst anlegt**. Keine Funktion ändert sie danach.
  - Pro Team sind Namens-Override, Logo-Override, Farbe und Aliase. Ein Team kann ein anderes darüber nicht verändern.
  - Das Risiko: Das erste Team bestimmt Name und `url` für alle späteren (M16).
- **Rollen:** heute keine beim Anlegen, Aktivieren und Deaktivieren, owner/admin im Editor. Dein Vorschlag (alle dürfen anlegen, aktivieren und deaktivieren, die eigene Marke niemand) ist im Vertrag umgesetzt; der Editor bleibt owner/admin.
- **RLS:**
  - `team_company`, `company_alias` und `team_company_settings` haben Team-Policies.
  - `company` hat RLS **ohne** Policy: `authenticated` sieht dort nichts.
  - `authenticated` hat auf diesen Tabellen nur `select`, kein Schreiben.
  - Eine security-invoker-Funktion käme also nicht weit; die neuen sind ohnehin security definer mit Prüfung.

### 4.3 Grenzen

Heute prüft die Datenbank nur: Domain nicht leer, eigene Marke, schon getrackt, Planlimit (nicht atomar), Rate 20 pro Minute (verschluckt). Was ich vorschlage, steht in 6.5.

### 4.4 Text, der Bubble noch erreicht

- **Firmennamen, Overrides, Aliase:** 0 mit Backtick, `${` oder Backslash. Der Trigger `trg_clean_text` (`clean_input`) entfernt sie beim Schreiben schon heute, meldet es aber nicht. Unsichtbare Zeichen und NFKC behandelt er nicht.
- **Domains:** 0 mit solchen Zeichen, aber ungeprüft (H5).
- **Discover-Namen:** M4. Vorschlag: dieselbe Regel wie bei Prompt Insights, beim Auslesen angewendet (`app.js_safe`-Regel), und Kennzeichnung `rewritten`.

### 4.5 Spam, Last, Kosten

- **Was eine Anlage kostet:** keinen n8n-Aufruf, kein Logo-Abruf (die Favicon-URL von Google ist nur Text) und keine Nachberechnung.
  - Der Aufwand entsteht danach: Jede getrackte Marke verlängert den Erkennungs-Kontext jedes Laufs etwas.
  - Missbrauch heißt hier vor allem Datenmüll in der globalen Firmentabelle (heute schon 218 verwaiste Firmen) und viele Kleinst-Perioden durch Hin und Her.
- **Discover:** heute bei jedem Öffnen, jedem Matched-Klick und nach jedem neuen Lauf kalt (K2). Vorschlag mit Zahlen in 6.4.
- **Doppelklick:** Dieselbe **bekannte** Domain ergibt keine zweite Marke (M15). Dieselbe **neue** Domain gleichzeitig kann zwei Firmen ergeben (H2).
- **Logos:** Favicons kommen aus Google S2 und sind alle https. Logo-Overrides sind frei (E1). Vorschlag: Ausgeliefert wird nur `https://…`, sonst das Favicon.
- **CSV-Export:** `export_brands_v1` nutzt `app.csv_safe_v1` (bestätigt in der Definition).

### 4.6 Konsistenz beim Schreiben

- **Deaktivieren** wirkt in allen Bereichen sofort, die `team_company` live lesen: Dashboard-Rechnung, Performance, Citations, Prompt Insights „Top Mentions“, Mira, Exporte. Was aus einem Cache kommt, zeigt den alten Stand:
  - Dashboard und Citations bis zum Hintergrundjob (5 Minuten, `stale: true`);
  - die alten Bubble-Caches (`rpc_cache`, Overview v19 und Chart v15) bis zu 5 Minuten oder bis zum nächsten Lauf.
  - Die Schreibfunktionen leeren heute nichts.
- **Aktivieren nach langer Pause:** Alte Antworten werden nicht nachgezählt. Die Marke hat Zahlen ab dem Moment der Aktivierung.
- **Editor:** Fremd-IDs bei Alias und Farbe, unbegrenzte Länge, Logo über `set_own_brand_settings_v5` (M3, H6). Backtick-Schutz ist über den Trigger da. Das ist ein eigener Auftrag.

---

## 5 Antworten auf die Fragen aus Abschnitt 2

| Frage | Antwort |
|---|---|
| Höchstzahl aktiver Marken | Plan bis 15 Wettbewerber + eigene = 16. Heute max 13. **`p_limit 100` reicht, kein Blättern.** |
| Liefert `cached_dashboard_overview_v1` nur aktive Marken? Eigene immer? | Ja: genau die Zeilen in `team_company` mit Rolle `own`/`competitor`, inaktive stehen dort nicht mehr. Die eigene Marke ist immer dabei, auch ohne Läufe (`visibility_pct: null`). `meta.total_count` = Zahl der Zeilen nach Suche/Auswahl, ohne Suche = alle aktiven inklusive eigener. |
| Zahlen gleich der heutigen Ansicht? | Ja, alle Felder aller Marken (3.1). |
| Inactive unter Filtern? | Nein. Inaktive Marken haben keine Kennzahlen; Zeitraum, Models, Markets und Topics ändern an der Liste nichts. Die Zähler kommen ohne Filter. |
| Deaktivieren | Beendet die Periode (`end_reason: deactivated`), Historie bleibt. Eigene Marke gesperrt. |
| Aktivieren | Planlimit, neue Periode (`reactivated`). Vorschlag: Endete die letzte Periode am selben Berliner Tag, wird sie wieder geöffnet statt einer neuen Kleinst-Periode. |
| Discover: Suchparameter? | Nein. Die Komponente filtert die 30 Zeilen im Browser; das Ereignis an Bubble ist wirkungslos. Vorschlag: `p_search` über alle Kandidaten. |
| Discover: Filter? | Die Funktion kennt Zeitraum, Models, Markets und Topics. Ob Bubble sie schickt, ist offen. Der Vorschlag unterstützt alle vier (6.4). |
| Add: leere Domain? | Die Datenbank lehnt sie ab (`Domain is required.`, M23). Vorschlag: bleibt Pflicht, weil die Domain der Schlüssel der globalen Firma, die Quelle des Favicons und des Domain-Alias ist. |
| Add: was passiert? | Abschnitt 1. Schon im Team inaktiv: wird reaktiviert (N5). Domain einer getrackten Marke: `already tracked` (N4). |
| Aktualisieren Tracked | `clear_dashboard_cache_v1` reicht (Dashboard- und Citations-Cache des Teams). |
| Aktualisieren Discover | Eigene Funktion (6.4), rechnet nur den heutigen Tag neu, 1–3 s. |
| Marken-Ablage | Heute `get_team_companies_v1` (ohne `role`, ohne Prüfung). Vorschlag: `brands_page_meta_v1.brands` liefert die Liste mit `role`; die Seite füllt die Ablage damit selbst. |
| Rolle | `team_member.role`: `owner`, `admin`, `member`. Kommt in `brands_page_meta_v1.meta.role`. |

---

## 6 Vertragsvorschlag (zum Prüfen, noch nicht gebaut)

Gleiche Regeln wie Dashboard v1 und Prompt Insights v1:

- POST `/rest/v1/rpc/<name>`, `Content-Profile: app`, Nutzer-JWT;
- reines jsonb mit `meta` und `rows`;
- security definer mit `search_path`, nur `authenticated` (und `service_role`), Zugang über `require_team_access`;
- kein `exception when others`;
- Ratenlimit über `_rl_hit_v1`.

Fehler kommen in PostgREST-Form `{code, message, details, hint}`.

| Funktion | Zweck | Neu? |
|---|---|---|
| `cached_dashboard_visibility_v1` | Linienchart | besteht |
| `cached_dashboard_overview_v1` | Tabelle und Landscape (aktive Marken), `p_limit 100` | besteht |
| `clear_dashboard_cache_v1` | Aktualisieren auf Tracked | besteht |
| `brands_page_meta_v1` | Rolle, Zähler, Kontingent, Tageskontingent, aktive Marken (für die Ablage), inaktive Marken | neu |
| `brands_set_status_v1` | Aktivieren/Deaktivieren, 1–50 IDs | neu |
| `brand_add_v1` | Anlegen bzw. Reaktivieren über Name und Domain | neu |
| `cached_discover_brands_v1` | Discover lesen, aus der Tagesverdichtung | neu |
| `discover_brands_refresh_v1` | Aktualisieren auf Discover: rechnet heute neu | neu |

### 6.1 Gemeinsame Filter

| Parameter | Tracked (Dashboard v1) | Discover |
|---|---|---|
| `p_date_from`, `p_date_to` | ja (Berliner Tag, höchstens 366 Tage) | ja, gleiche Regel, Vorgabe 30 Tage |
| `p_models` | ja | ja |
| `p_markets` | ja | ja |
| `p_tag_ids`, `p_tagmode` | ja | ja |
| Inactive | – | – |

Die Filterleiste muss auf Discover also nicht mehr ausgeblendet werden.

### 6.2 Lesen

**`brands_page_meta_v1(p_team)`**

```json
{
  "meta": {
    "team_id": "877c…", "role": "member", "generated_at": "…",
    "total_count": 11, "total_count_competitors": 10, "total_count_inactive": 0,
    "quota": {"used": 10, "total": 10, "remaining": 0, "plan": "Legacy Free"},
    "daily": {"tracked_left": 20, "deactivations_left": 50},
    "discover": {"data_as_of": "2026-10-11T09:15:00Z"}
  },
  "brands": [
    {"company_id": "87468f49…", "name": "Mercedes Benz", "logo_url": "https://49eaeb….cdn.bubble.io/…png",
     "role": "own", "domain": "mercedes-benz.de", "color": null},
    {"company_id": "666761a9…", "name": "VW", "logo_url": "https://www.google.com/s2/favicons?domain=volkswagen.de&sz=64",
     "role": "competitor", "domain": "volkswagen.de", "color": null}
  ],
  "inactive": [
    {"company_id": "…", "name": "VW", "logo_url": "https://…", "domain": "volkswagen.de", "deactivated_at": "2026-10-11T09:26:38Z"}
  ]
}
```

- `brands`: eigene Marke zuerst, dann nach Name. `inactive`: nach `deactivated_at` absteigend.
- Namen nach Team-Override (anders als heute `get_inactive_competitors_v1`).
- Logos immer absolut und nur `https://…`, sonst das Favicon.
- Keine Filter (siehe 5), Rate 60 pro Minute, kein Cache nötig (ein Lesezugriff, unter 10 ms).

**`cached_discover_brands_v1`**

Parameter: `p_team`, die gemeinsamen Filter, `p_matched` (`yes`/`no`, Vorgabe `yes`), `p_search` (höchstens 100 Zeichen, `%`, `_` und `\` sicher, Umlaute gefaltet), `p_limit` (Vorgabe 30, 1–100).

```json
{
  "meta": {"team_id": "877c…", "date_from": "2026-09-12", "date_to": "2026-10-11", "filters": {…},
           "matched": "yes", "search": null, "limit": 30, "total_count": 418, "total_responses": 8257,
           "data_as_of": "2026-10-11T09:15:00Z", "generated_at": "…"},
  "rows": [
    {"name": "ADAC", "brand_key": "adac", "visibility_pct": 10.04, "mentioned_count": 829, "mentioned_runs": 829,
     "runs_total": 8257, "rewritten": false, "inactive_company_id": null,
     "recognized_urls": [{"domain": "adac.de", "root_url": "https://adac.de",
                          "favicon_url": "https://www.google.com/s2/favicons?domain=adac.de&sz=128", "matched_runs": 805}]}
  ]
}
```

Die Zahlen in der Beispielzeile sind die heutigen echten Werte (3.2).

- **Ausgeschlossen** sind alle aktiven Marken des Teams inklusive der eigenen. Verglichen wird zum Zeitpunkt des Lesens mit:
  - Name, Team-Name und aktiven Aliasen, je auf den Marken-Schlüssel normalisiert;
  - der ersten Ebene der Domain;
  - den Domains (für `recognized_urls`).
  - Damit sind H4 und „frisch angelegt bleibt stehen“ behoben.
- **Inaktive Marken** bleiben sichtbar, mit `inactive_company_id`. „Track“ heißt dann reaktivieren; der Dialog kann das sagen.
- **Marken-Schlüssel** neu mit Akzent-Faltung (`unaccent` ist installiert): „Škoda“ und „Skoda“ sind dann eine Zeile.
- **Namen** nach der Prompt-Insights-Regel bereinigt. `rewritten: true`, wenn sich etwas geändert hat.
- **Reihenfolge:** Visibility, dann Erwähnungen, dann Name.

### 6.3 Schreiben

**`brands_set_status_v1(p_team, p_company_ids uuid[], p_status)`**, `p_status`: `active` oder `inactive`.

- 1–50 IDs, Dubletten werden entfernt.
- Alles oder nichts: Jede ID muss zum Team gehören (aktiv oder archiviert). Sonst `brands_not_found` (PT404), `hint` = erste fremde ID.
- Die eigene Marke in der Liste ergibt `brands_own_brand` (PT409, `hint` = company_id).
- Schon im Zielstatus: wird übersprungen und in `meta.skipped` gezählt, kein Fehler. Doppelklick ist also harmlos.
- **Aktivieren:**
  - Unter einer Sperre je Team: `aktive + neu ≤ Planlimit`, sonst `brands_limit_reached` (PT409, `hint` = freie Plätze).
  - Das Tageskontingent „neu getrackt“ wird geprüft.
  - Neue Periode `reactivated`. Endete die letzte am selben Berliner Tag, wird sie wieder geöffnet.
- **Deaktivieren:** wie heute (Archiv, Periode schließen, `team_company` löschen), Tageskontingent Deaktivierungen.
- **Danach:**
  - Eintrag in `app.brand_activity_log` (neue Tabelle: `team_id`, `user_id`, `action`, `company_ids`, `details`, `created_at`).
  - Leeren von `dashboard_cache` und `citations_cache` des Teams sowie des alten `rpc_cache`, solange Bubble ihn noch liest.
- **Antwort:** `{meta: {team_id, status, changed, skipped, quota, daily}, rows: [{company_id, name, logo_url, status, deactivated_at}]}`.

**`brand_add_v1(p_team, p_name, p_domain)`**

1. **Prüfen und bereinigen** (6.5), unter Sperre je Team und je Domain.
2. **Reihenfolge der Fälle:**
   1. Domain gehört zur eigenen Marke oder einer aktiven Marke des Teams → `brands_duplicate` (PT409, `hint` = company_id).
   2. Domain gehört zu einer inaktiven Marke des Teams → reaktivieren (`action: reactivated`, Planlimit).
   3. Normalisierter Name gleich einer aktiven Marke des Teams → `brands_duplicate` (`hint` = company_id).
   4. Globale Firma mit gleicher Domain → verknüpfen (`action: linked`).
   5. Sonst neue Firma (`action: created`): `url` immer `https://<host>`, nie roh; Favicon Google S2; Domain-Alias wie heute.

   Dubletten werden vor dem Planlimit geprüft (behebt M1).
3. **Planlimit** (`brands_limit_reached`) und **Tageskontingent** (`brands_daily_limit_reached`).
4. **Namens-Override**, wenn der Name vom globalen abweicht. Periode öffnen, Protokoll, Caches leeren wie oben.
5. **Antwort:** `{meta: {team_id, action, rewritten, quota, daily}, row: {company_id, name, logo_url, domain, role: "competitor", status: "active"}}`.

Eine zweite Anlage derselben Domain (Netzfehler, Doppelklick, Track und Kopf-Knopf gleichzeitig) ergibt `brands_duplicate` mit der vorhandenen ID. Die Oberfläche behandelt das wie Erfolg.

### 6.4 Discover: schnell und nie im Zeitlimit

**Weg:** eine Tagesverdichtung, die ein Job pflegt, und eine schnelle Lesefunktion darauf.

**Tabellen** (neu):

- `app.discover_brand_day`: `team_id`, `day`, `prompt_id`, `model`, `brand_key`, `name`, `mentioned_count`, `mentioned_runs`.
  - Läufe je Schlüssel werden getrennt gezählt, damit zwei Schreibweisen im selben Lauf nicht doppelt zählen.
  - Größe: etwa 36.000 Zeilen je großes Team und 30 Tage, alle Teams etwa 4.000 bis 6.000 pro Tag.
- `app.discover_brand_domain_day`: `team_id`, `day`, `prompt_id`, `model`, `brand_key`, `domain`, `favicon_url`, `matched_runs`, `matched_citations`.

**Job** (pg_cron alle 15 Minuten):

- Rechnet je Team nur die Tage neu, an denen seit dem letzten Mal Läufe dazukamen (praktisch heute, um Mitternacht auch gestern).
- Kosten etwa 1,3 s je Team und Tag. Bei 14 Teams sind das höchstens rund 40 s je Runde, verteilt über die 15 Minuten.
- Einmalige Nachrechnung von 90 Tagen in Paketen: etwa 30 Minuten.

**Lesen:**

- Summiert die Tage im Zeitraum mit allen Filtern und schließt getrackte Marken aus.
- Gemessen am Prototyp: **40 ms** für 30 Tage bei 877c, statt heute 12–39 s.
- Kein Cache nötig. Damit stört auch der Lauf-Trigger nicht mehr.

**Aktualisieren:** `discover_brands_refresh_v1(p_team)` rechnet den heutigen Tag des Teams sofort neu (1–3 s, synchron) und gibt `data_as_of` zurück. Rate 2 pro Minute je Nutzer, höchstens einmal pro Minute je Team.

**Warum nicht die anderen Wege:**

| Weg | Nachteil |
|---|---|
| Ein Ergebnis je Team und Tag | Feste Filter: Jeder andere Zeitraum oder Filter wäre wieder kalt. |
| Ein Auftrag mit Status | Ein Nutzer wartet 20–40 s auf etwas, das sich über den Tag kaum ändert. Dazu Realtime und Fehlerpfade. |

Die Tagesverdichtung ist bei jedem Filter in Millisekunden da, höchstens 15 Minuten alt, und „Aktualisieren“ holt den Rest.

### 6.5 Grenzen (alle in der Datenbank)

| Was | Regel | Fehler (`message`, `code`, `hint`) |
|---|---|---|
| Team | `require_team_access` | `forbidden` 42501 bzw. `team_access_*` P0403 |
| Rolle | Anlegen, Aktivieren, Deaktivieren: alle Mitglieder (offene Frage 1) | `brands_forbidden` PT403, `hint` `owner|admin` (nur falls eingeschränkt) |
| Aktive Marken | Planlimit atomar (Sperre je Team) | `brands_limit_reached` PT409, `hint` = freie Plätze |
| Inaktive Marken | höchstens 50 je Team | `brands_limit_reached` PT409, `hint` `inactive:50` |
| Name | Trimmen, NFKC, unsichtbare Zeichen weg, Leerraum zu einem Leerzeichen; Backtick und Backslash weg, `${` wird `$ {`; danach 1–75 Zeichen, mindestens ein Buchstabe oder eine Ziffer; vorher schon über 300 Zeichen roh wird abgelehnt | `brands_invalid_param` 22023, `hint` `p_name: 1-75 Zeichen, mindestens ein Buchstabe oder eine Ziffer` |
| Domain | Pflicht; Schema, Pfad, Port, `www.` und Punkt am Ende weg; klein; nur ASCII-Hostname (die Oberfläche wandelt Umlaut-Domains mit `new URL()` in Punycode); Labels 1–63 aus `a-z0-9-`, nicht mit `-` am Rand; mindestens ein Punkt; Endung aus Buchstaben oder `xn--…`; höchstens 253 Zeichen | `brands_invalid_param` 22023, `hint` `p_domain: gueltiger Hostname, z. B. apple.com` |
| Dubletten | gleiche Domain oder gleicher normalisierter Name im Team (aktiv oder eigene) | `brands_duplicate` PT409, `hint` = company_id |
| Inaktive Marke mit gleicher Domain | wird reaktiviert (offene Frage 2) | – (`action: reactivated`) |
| Eigene Marke | nicht deaktivierbar, nicht als Wettbewerber anlegbar | `brands_own_brand` PT409, `hint` = company_id |
| `p_company_ids` | 1–50 uuid | `brands_invalid_param`, `hint` `p_company_ids: 1-50` |
| Fremde ID | ganze Anfrage abgelehnt | `brands_not_found` PT404, `hint` = erste fremde ID |
| `p_status` | `active`, `inactive` | `brands_invalid_param`, `hint` `p_status: active, inactive` |
| `p_matched` | `yes`, `no` | `brands_invalid_param`, `hint` `p_matched: yes, no` |
| `p_search` (Discover) | höchstens 100 Zeichen, `%`, `_` und `\` als Text | `brands_invalid_param`, `hint` `p_search: max 100` |
| `p_limit` (Discover) | 1–100 | `brands_invalid_param`, `hint` `p_limit: 1-100` |
| Zeitraum | wie Dashboard | `brands_invalid_date` 22023, `hint` wie Dashboard |
| Fehlendes Team | – | `brands_team_required` 22023, `hint` `p_team` |

### 6.6 Ratenlimits und Tagesgrenzen

| Funktion | je Nutzer | Tagesgrenze je Team (Berliner Tag) |
|---|---|---|
| `brands_page_meta_v1` | 60 pro Minute | – |
| `cached_discover_brands_v1` | 60 pro Minute | – |
| `discover_brands_refresh_v1` | 2 pro Minute (+ 1 pro Minute je Team) | – |
| `brand_add_v1` | 10 pro Minute | „neu getrackt“ (Anlagen + Aktivierungen) höchstens `max(2 × Planlimit, 20)`, bei 10 Plätzen also 20 |
| `brands_set_status_v1` | 20 pro Minute | Aktivierungen zählen zu „neu getrackt“, Deaktivierungen höchstens 50 |
| Chart, Tabelle, Aktualisieren | wie Dashboard v1 (60 bzw. 10 pro Minute) | – |

- **Überschritten:** `brands_rate_limited` (PT429, `hint` = Sekunden) bzw. `brands_daily_limit_reached` (PT429, `hint` = Rest, z. B. `tracked:0`).
- **Zählung:** Die Tagesgrenze zählt aus `brand_activity_log`.

**Neue Fehlermeldungen für die Oberfläche:**

- `brands_team_required`, `brands_invalid_param`, `brands_invalid_date`;
- `brands_not_found`, `brands_forbidden`, `brands_own_brand`;
- `brands_duplicate`, `brands_limit_reached`;
- `brands_daily_limit_reached`, `brands_rate_limited`.

---

## 7 Offene Fragen (nur du kannst sie beantworten)

1. **Rollen:** Dürfen alle Mitglieder Marken anlegen, aktivieren und deaktivieren? Mein Vorschlag nach deinem: ja, nur der Editor bleibt owner/admin.
2. **Dubletten:** Domain einer **inaktiven** Marke → reaktivieren (wie heute) oder Fehler mit Hinweis? Mein Vorschlag: reaktivieren, mit `action: reactivated` in der Antwort.
3. **Gleicher Name, andere Domain** (z. B. zweimal „BMW“): Fehler `brands_duplicate`? Mein Vorschlag: ja.
4. **Sonderzeichen im Namen:** umschreiben und melden (`rewritten: true`) wie bei Prompt Insights, oder ablehnen? Mein Vorschlag: umschreiben.
5. **Discover-Aktualität:** 15 Minuten plus „Aktualisieren“ für heute. Reicht das?
6. **Discover und inaktive Marken:** mit Kennzeichen zeigen (Vorschlag) oder ausblenden?
7. **Sofort-Fix K1:** einspielen? Bubble bekommt aus `get_team_companies_v1` dann `[]`, wenn kein Nutzertoken mitkommt. Das betrifft heute 8–9 Aufrufe am Tag; die Ablage bleibt dann wie sie war, weil ein leerer Store nie überschreibt.

---

## 8 Sofort-Fix K1 (`brands_sofort_rechte.sql`, im Rollback geprüft)

**Was die Datei ändert:**

- `get_team_companies_context_v2`: nur noch `service_role`. n8n ruft sie ausschließlich so, 1.651 von 1.651 Aufrufen in 24 Stunden.
- `get_team_companies_v1(uuid)`: gleiche Antwort für Mitglieder und `service_role`, sonst `[]`.
- `get_team_companies_v1(uuid, uuid)`: `p_user` muss der angemeldete Nutzer sein.
- `delete_company_hard_v1`: anon und authenticated raus.

**Geprüft** im Rollback, vorher → nachher → nach Rückweg:

| Aufruf | vorher | nachher | Rückweg |
|---|---|---|---|
| anon `get_team_companies_v1(877c)` | 11 | **0** | 11 |
| member 877c | 11 | 11 | – |
| fremdes Team | 11 | **0** | – |
| `service_role` | 11 | 11 | – |
| anon mit fremder Nutzer-ID | 11 | **0** | – |
| member mit eigener ID | 11 | 11 | – |
| anon / member `context_v2` | 11 / 11 | **42501** / **42501** | 11 |
| `service_role` `context_v2` | 11 | 11 | – |
| anon `delete_company_hard_v1` | 42501 (Tabelle) | 42501 (Funktion) | – |

- md5 nach dem Rückweg: wieder `d7ff0aa5…` und `86e48f3d…`, Rechte wieder wie vorher.
- md5 nach dem Fix: `7ee6121c…` und `444530be…`.

**Danach**, mit der Umstellung der Seite, wie beim Dashboard: anon raus aus allen alten Brands-Funktionen, `set_own_brand_settings_v5` bekommt einen `search_path`, und der Editor wird ein eigener Auftrag.

---

## 9 Nach dem Bau

Ich liefere wie immer:

- Datei mit echten, ungekürzten Antworten (Team 877c, 30 Tage; Schreibaufrufe in zurückgerollten Transaktionen), jede Fehlerform einmal;
- Gleichheitsprüfung Discover-Verdichtung gegen `get_untracked_brand_candidates_v8` (bei Matched = no für dieselben 15 Tage, gleiche Schlüsselregel);
- `.sql` mit Rückweg, Kontrollausgabe am Ende.

---

## 10 Entscheidungen vom 11.10. (gehen vor)

| Nr | Frage | Entscheidung | Folge im Vertrag |
|---|---|---|---|
| 1 | Rollen | Alle Mitglieder dürfen anlegen, aktivieren und deaktivieren | wie 6.5. Der Editor bleibt owner/admin |
| 2 | Domain einer inaktiven Marke | Wird reaktiviert | `brand_add_v1` mit `action: reactivated` |
| 3 | Gleicher Name, andere Domain | Fehler | `brands_duplicate`, `hint` = vorhandene company_id |
| 4 | Sonderzeichen im Namen | Erlaubt: Ausrufezeichen, Ziffern, `+`, `-` und alles andere Lesbare | siehe 10.1 |
| 5 | Discover-Aktualität | Einmal pro Tag rechnen, „Aktualisieren“ holt die neuen Daten | siehe 10.2 |
| 6 | Inaktive Marken in Discover | Anzeigen, gekennzeichnet als inaktiv | siehe 10.3 |
| 7 | Sofort-Fix K1 | Eingespielt am 11.10. | siehe 10.4 |
| neu | Marken löschen | Nur die Team-Daten, nie die globalen Tabellen. Dürfen: owner und admin | siehe 10.5 |
| neu | Logo-Override | Nur für die eigene Marke. Für Wettbewerber nur der Name | siehe 10.6 |

### 10.1 Name (ersetzt die Zeile „Name“ in 6.5)

Erlaubt ist alles Lesbare: Buchstaben aller Sprachen, Ziffern, Leerzeichen, `! + - & . , ' " ( ) / : ? # @ %`, Emoji. Beispiele, die gehen: `Yahoo!`, `C&A`, `1&1`, `+Plus`, `Dr. Oetker`, `7-Eleven`, `L'Oréal`.

Nur diese Zeichen werden umgeschrieben und mit `rewritten: true` gemeldet. Es sind genau die, die Bubbles Run-JS töten, plus unsichtbare Zeichen:

| Zeichen | wird zu |
|---|---|
| Backtick, Backslash | entfernt |
| `${` | `$ {` |
| Zeilenumbruch, Tab, Steuerzeichen | ein Leerzeichen |
| unsichtbare Zeichen (Zero-Width, Richtungszeichen, weiches Trennzeichen) | entfernt |
| Vollbreite und ähnliche Formen (NFKC) | normale Form, z. B. `ＢＭＷ` → `BMW` |
| mehrfacher Leerraum | ein Leerzeichen, vorne und hinten getrimmt |

Danach muss der Name 1–75 Zeichen lang sein und mindestens einen Buchstaben oder eine Ziffer enthalten. Sonst kommt `brands_invalid_param`. Ein `+` oder `-` am Anfang ist erlaubt; im CSV-Export schützt `csv_safe_v1` davor, dass Excel daraus eine Formel macht.

### 10.2 Discover: einmal pro Tag, „Aktualisieren“ für neue Daten (ersetzt 6.4 „Job“ und „Aktualisieren“)

- **Nachtjob** (pg_cron, 03:30 Berlin): rechnet je Team den **gestrigen** Tag in die Tagesverdichtung.
  - Kosten: etwa 1,3 s je Team, bei 14 Teams also rund 20 s pro Nacht.
  - Fehlt ein Tag (Ausfall), holt der nächste Lauf ihn nach.
- **„Aktualisieren“** (`discover_brands_refresh_v1`): rechnet für das Team den heutigen Tag und jeden fehlenden Tag im Verdichtungsfenster.
  - Synchron, 1–3 s. Danach kommt `meta.data_as_of` mit der neuen Uhrzeit zurück.
  - Rate: 2 pro Minute je Nutzer, 1 pro Minute je Team.
- **Ohne Klick** zeigt Discover den Stand bis gestern plus das, was heute schon jemand aktualisiert hat. `meta.data_as_of` und `meta.today_included` (true/false) sagen es der Oberfläche.
- **Gespeichert** werden 366 Tage (wie der längste Zeitraum im Kalender). Ältere Tage räumt der Nachtjob weg. Die einmalige Nachrechnung von 366 Tagen läuft in Paketen in der ersten Nacht (etwa 14 × 366 × 1,3 s ≈ 1,8 Stunden, verteilt).

### 10.3 Inaktive Marken in Discover

Zeilen, die zu einer inaktiven Marke des Teams gehören, bleiben stehen und tragen:

```json
{"name": "Johanniter", "status": "inactive", "company_id": "…", "deactivated_at": "…", …}
```

Getrackte (aktive) Zeilen gibt es nicht, die sind ausgeschlossen. Alle anderen Zeilen haben `status: "untracked"` und `company_id: null`.

- „Track“ auf einer inaktiven Zeile ruft direkt `brands_set_status_v1` mit `p_status: active` und dieser `company_id`, ohne Dialog.
- Planlimit und Tageskontingent gelten wie immer.

### 10.4 Sofort-Fix K1: eingespielt

Die Kontrollausgabe vom 11.10. stimmt mit dem Rollback-Test überein:

| Funktion | md5 | anon | authenticated | service_role |
|---|---|---|---|---|
| `get_team_companies_v1(uuid)` | `7ee6121c…` (neu) | ja, bekommt aber `[]` | ja, nur das eigene Team | ja |
| `get_team_companies_v1(uuid, uuid)` | `444530be…` (neu) | ja, bekommt `[]` | ja, nur mit eigener Nutzer-ID | ja |
| `get_team_companies_context_v2(uuid)` | `354bc1cd…` (unverändert) | nein | nein | ja (n8n) |
| `delete_company_hard_v1(uuid)` | `0ac92535…` (unverändert) | nein | nein | ja |

### 10.5 Marken löschen (`brands_delete_v1`), neu

**Grundsatz:** Gelöscht wird nur, was dem Team gehört. **Nie** `app.company`, `app.source_domain`, `app.source_url`, `app.prompt_run` oder `app.response_run`; diese Tabellen sind global bzw. gehören allen Marken des Teams. Die Firma bleibt bestehen und kann jederzeit von diesem oder einem anderen Team wieder getrackt werden.

Gleiche Logik wie das Löschen von Prompts: sofort weg, Aufräumen im Hintergrund, für den Nutzer unsichtbar, keine Ladeanzeige.

**Aufruf:** `brands_delete_v1(p_team, p_company_ids uuid[])`, 1–50 IDs, aktive und inaktive Marken.

- Fremde ID → `brands_not_found`; eigene Marke → `brands_own_brand`; alles oder nichts.
- Rolle: owner und admin (wie Prompts löschen, entschieden 11.10.), sonst `brands_forbidden` (PT403, `hint` `owner|admin`). Den Knopf für `member` ausblenden. Die Rolle steht in `brands_page_meta_v1.meta.role`.
- Tagesgrenze: 20 gelöschte Marken je Team und Tag (`brands_daily_limit_reached`).
- Antwort: `{meta: {team_id, deleted, quota, daily}, rows: [{company_id, name}]}`. Die Antwort kommt sofort.

**Schritt 1 (im Aufruf, Sperre je Team, unter 100 ms):** Team-Zeilen der Marke löschen:

| Tabelle | Zeilen |
|---|---|
| `team_company` | die Zuordnung |
| `team_competitor_archive` | Archiv-Eintrag, falls inaktiv |
| `team_company_tracking_period` | alle Perioden |
| `team_brand_profile` | Name-Override |
| `team_company_settings` | Farbe |
| `company_alias` | Aliase des Teams für diese Firma |

Danach Protokoll in `brand_activity_log` (mit Name und Domain), Auftrag in `brand_purge_job`, Caches des Teams leeren.

Ab diesem Moment ist die Marke überall weg: Dashboard, Performance, Citations, Prompt Insights, Mira und Exporte gehen über `team_company`. n8n erkennt sie im nächsten Lauf nicht mehr. Ein freier Platz im Planlimit ist sofort frei.

**Schritt 2 (Hintergrundjob, wie `prompt_purge_job`):** in kleinen Paketen mit Commit, reihum zwischen Teams, mit Wiederholung bei Fehlern.

| Tabelle | Was | Gemessen bei VW / 877c (größte Marke) |
|---|---|---|
| 9 Rollup-Tabellen `daily/weekly/monthly_company_(prompt_/tag_)model_stats` | Team-Zeilen der Firma löschen | 50.679 Zeilen; die größte Tabelle in 1,7 s |
| `url_company_mention`, `staged_citation_mentions` | Team-Zeilen der Firma löschen | 23.988 + 371 Zeilen, 2,3 s |
| `response_company`, `response_source` (Altbestand, `response_run` des Teams) | Zeilen der Firma löschen | 3.868 + 12.019 |
| `prompt_run_ad`, `prompt_run_shopping_product` | `company_id` des Teams auf `null` | 0 |
| `recommendation` | `company_id` des Teams auf `null`: Die Erwähnungen bleiben als Text in den Antworten erhalten und gelten danach als „nicht getrackt“ | 42.801 Zeilen. 2.000 in 14 s (16 Indexe), in Paketen von 500 also etwa 5 Minuten im Hintergrund |
| Discover-Verdichtung | betroffene Tage des Teams neu rechnen, damit die Marke dort als Kandidat auftaucht | etwa 1,3 s je Tag |
| Caches | am Ende noch einmal leeren | – |

**Was sich an anderen Zahlen ändert: nichts.**

- `runs_total`, Visibility, Rang und Sentiment der übrigen Marken bleiben gleich: Jede Marke hat eigene Zeilen, Ränge stehen je Erwähnung fest.
- Nur die Feldwerte über alle Marken (`brand_count`, `avg_sentiment`, `best_rank`) ändern sich, weil eine Marke weniger da ist.
- `source_recommendation.mentioned_competitors` (Opportunities) behält den Namen als historischen Text (bei VW 6 Einträge). Vorschlag: so lassen.

**Wieder anlegen:**

- Solange der Hintergrundjob läuft, meist wenige Minuten, kommt `brands_delete_pending` (PT409, `hint` = Sekunden bis zum Ende). Sonst würde der Job die frischen Zahlen mitlöschen.
- Danach legt `brand_add_v1` die Marke neu an: neue Periode, Zahlen ab dann. Alte Antworten werden nicht nachgezählt (wie beim normalen Anlegen).

### 10.6 Logo nur für die eigene Marke (`brands_logo_nur_eigene.sql`, im Rollback geprüft)

**Regel:** Ein Logo-Override gibt es nur für die eigene Marke. Für Wettbewerber ändert ein Team nur den Namen (Tracking- bzw. Anzeigename). Heute halten sich alle 6 vorhandenen Logo-Overrides daran, durchgesetzt war es aber nicht (E1).

**Was die Datei ändert:**

- **In der Tabelle durchgesetzt:** Der bestehende Trigger `trg_enforce_own_brand_only` auf `team_brand_profile` prüft zusätzlich, nur wenn sich das Logo ändert:
  - Logo nur bei Rolle `own`, sonst Fehler `brands_logo_own_only` (42501);
  - Logo nur als `https://…` oder `//…` (Bubble-Upload), sonst `brands_invalid_param` (22023).
- `set_own_brand_settings_v5` bekommt einen festen `search_path`. Die Definition bleibt sonst gleich, Bubble merkt nichts.

**Geprüft** (zurückgerollt, member von 877c):

| Test | Ergebnis |
|---|---|
| KIA: Logo `javascript:alert(1)` | `brands_logo_own_only` |
| KIA: Logo `https://…` | `brands_logo_own_only` |
| eigene Marke: Logo `javascript:alert(1)` | `brands_invalid_param` |
| eigene Marke: Logo `https://…` | ok |
| eigene Marke: nur Name | ok |
| KIA: nur Name | ok |
| Umbenennen im Editor (admin) | ok |
| Anlegen mit Namens-Override | ok |
| md5 nach Rückweg | wieder `de912a1e…` bzw. `c3a43f0a…` ohne `search_path` |

md5 nach dem Fix: `enforce_own_brand_only` `ae81f504…`, `set_own_brand_settings_v5` `a364ddb5…`.

**In v1:** `logo_url` eines Wettbewerbers ist immer das Favicon der Firma, bei der eigenen Marke das Override, sonst das Favicon; immer `https://`. `brand_add_v1` und `brands_set_status_v1` nehmen kein Logo an.

### 10.7 Neue Fehlermeldungen (ergänzt 6.6)

`brands_delete_pending` (PT409) und `brands_logo_own_only` (42501). Alle anderen wie in 6.6.

### 10.8 Offen

Nichts mehr von Nutzerseite. Rolle beim Löschen: owner und admin (entschieden 11.10.).

Nächster Schritt: Claude Code prüft den Vertrag gegen die Oberfläche und gibt ihn abgestimmt zurück. Erst dann wird gebaut.

---

## 11 Gebaut (11.10.): endgültiger Vertrag

Gebaut nach Abschnitt 6 mit Abschnitt 10 und der Rückmeldung von Claude Code vom 11.10.

| Datei | Zweck |
|---|---|
| `brands_v1.sql` (+ `brands_v1_rueckweg.sql`) | Deploy, als ein Block |
| `brands_v1_echte_antworten.json` | echte, ungekürzte Antworten (Team 877c, Schreibaufrufe zurückgerollt), jede Fehlerform |
| `brands_logo_nur_eigene.sql` (+ Rückweg) | Logo nur für die eigene Marke (unabhängig einspielbar) |
| `rechte_bestand_brands.sql` (+ Rückweg) | anon aus 28 alten Brands-Funktionen, **erst nach der Umstellung** |

Reihenfolge: `brands_v1.sql`, dann `brands_logo_nur_eigene.sql`. `rechte_bestand_brands.sql` erst, wenn Bubble die alten Funktionen nicht mehr ruft.

### 11.1 Funktionen (alle POST `/rest/v1/rpc/<name>`, `Content-Profile: app`, nur `authenticated`)

| Funktion | Parameter | Rate je Nutzer |
|---|---|---|
| `brands_page_meta_v1` | `p_team` | 60/min |
| `cached_discover_brands_v1` | `p_team`, `p_date_from`, `p_date_to`, `p_models`, `p_markets`, `p_tag_ids`, `p_tagmode`, `p_matched` (Text `yes`/`no`, Vorgabe `yes`), `p_search` (≤ 100), `p_limit` (1–100, Vorgabe 30) | 60/min |
| `discover_brands_refresh_v1` | `p_team` | 2/min (im Team höchstens eine Rechnung pro Minute, danach `refreshed: false`, kein Fehler) |
| `brands_set_status_v1` | `p_team`, `p_company_ids` (1–50), `p_status` (`active`/`inactive`) | 20/min |
| `brand_add_v1` | `p_team`, `p_name`, `p_domain` | 10/min |
| `brands_delete_v1` | `p_team`, `p_company_ids` (1–50), nur owner/admin | 10/min |

Chart, Tabelle und „Aktualisieren“ auf Tracked bleiben `cached_dashboard_visibility_v1`, `cached_dashboard_overview_v1` (`p_limit 100`) und `clear_dashboard_cache_v1`.

### 11.2 Antwortformen (genau so in der JSON-Datei)

- **`brands_page_meta_v1`:**
  - `meta`: `team_id`, `role`, `generated_at`, `total_count` (aktive inkl. eigener), `total_count_competitors`, `total_count_inactive`, `quota {used, total, remaining, plan}`, `daily {tracked_limit, tracked_left, deactivations_left, deletions_left}`, `discover {data_as_of}`.
  - `brands[]`: `company_id`, `name` (Team-Name), `logo_url`, `role`, `domain`, `color`. Eigene Marke zuerst, dann nach Name. Immer alle aktiven Marken.
  - `inactive[]`: `company_id`, `name` (Team-Name), `logo_url`, `domain`, `deactivated_at`.
- **`cached_discover_brands_v1`:**
  - `meta`: `team_id`, `timezone`, `date_from`, `date_to`, `filters`, `matched`, `search`, `limit`, `total_count`, `total_responses`, `today_included`, `data_as_of`, `missing_days` (vergangene Tage im Zeitraum, die der Job noch nicht gerechnet hat; nach der ersten Nachrechnung 0), `generated_at`.
  - `rows[]`: `name`, `brand_key`, `visibility_pct`, `mentioned_count`, `mentioned_runs`, `runs_total`, `status` (`untracked`/`inactive`), `company_id` (nur bei `inactive`), `deactivated_at`, `rewritten`, `recognized_urls[]` (`domain`, `root_url`, `favicon_url`, `matched_runs`).
- **`discover_brands_refresh_v1`:** `meta`: `team_id`, `refreshed`, `days_computed`, `pending_days`, `today_included` (true), `data_as_of`, `generated_at`.
- **`brands_set_status_v1`:** `meta {team_id, status, changed, skipped, quota, daily}`, `rows[] {company_id, name, logo_url, domain, role, status, deactivated_at}`.
- **`brand_add_v1`:** `meta {team_id, action (created/linked/reactivated), rewritten, quota, daily}`, `row {company_id, name, logo_url, domain, role, status}`.
- **`brands_delete_v1`:** `meta {team_id, deleted, quota, daily}`, `rows[] {company_id, name}`.
- **`get_team_companies_v1`** (Bubble-Ablage): jede Zeile hat zusätzlich `role`.

### 11.3 Fehler (bestätigt, genau diese Formen)

| message | code | hint |
|---|---|---|
| `brands_team_required` | 22023 | `p_team` |
| `brands_invalid_param` | 22023 | beginnt mit dem Parameter: `p_name: …`, `p_domain: …`, `p_status: …`, `p_company_ids: 1-50`, `p_matched: yes, no`, `p_search: max 100`, `p_limit: 1-100`, `p_tagmode: or, and` |
| `brands_invalid_date` | 22023 | `date_from <= date_to, date_to <= heute, Zeitraum <= 366 Tage` |
| `brands_not_found` | PT404 | erste fremde ID |
| `brands_own_brand` | PT409 | company_id der eigenen Marke |
| `brands_duplicate` | PT409 | company_id der vorhandenen Marke |
| `brands_limit_reached` | PT409 | freie Plätze als Zahl, bzw. `inactive:50` |
| `brands_delete_pending` | PT409 | `60` (Sekunden, Schätzung) |
| `brands_forbidden` | PT403 | `owner\|admin` |
| `brands_daily_limit_reached` | PT429 | `tracked:<Rest>`, `deactivations:<Rest>`, beim Löschen **`deleted:<Rest>`** (bestätigt) |
| `brands_rate_limited` | PT429 | Sekunden bis zum nächsten Minutenfenster |
| `brands_logo_own_only` | 42501 | aus `brands_logo_nur_eigene.sql`, nur über „Brand settings“ erreichbar |
| `forbidden` | 42501 | aus `require_team_access` (fremdes Team) |

### 11.4 Messungen (Prod, zurückgerollt, 11.10.)

| Aufruf | Zeit |
|---|---|
| `brands_page_meta_v1` | 5 ms |
| `cached_discover_brands_v1`, 30 Tage, Matched yes / no | 358 / 630 ms (heute 12–39 s) |
| … mit Suche | 320–420 ms |
| … 7 Tage mit Model-Filter | 63 ms |
| `discover_brands_refresh_v1` (heute) | 316 ms |
| `brands_set_status_v1` | 2–15 ms |
| `brand_add_v1` | 6–16 ms |
| `brands_delete_v1` (Antwort an den Nutzer) | 5–31 ms |
| Löschen im Hintergrund, BYD (4.828 Erwähnungen) | 20 Ticks, rund 55 s, unsichtbar. VW (42.826) geschätzt 6 Minuten |
| Tagesverdichtung 877c | 0,9 s je Tag (max 1,2 s), 30 Tage in 27 s |

**Prüfungen:**

- Verdichtung gegen direkte Zählung aus den Antworten: 2.285 von 2.285 Marken-Schlüsseln gleich (10 Tage).
- Gegen das alte `get_untracked_brand_candidates_v8` (Top 200, 15 Tage): `runs_total` gleich (4.187), 170 Zeilen gleich. Die 30 abweichenden sind alle durch die neue Schlüsselregel erklärt (geprüft): „Škoda“ und „Skoda“ sind jetzt eine Marke, und der alte Schlüssel hatte „Citroën ë-C3“ mit „Citroën C3“ vermischt.
- Löschen: Die übrigen 10 Marken haben vorher und nachher dieselben Zahlen (Visibility, Rang, Sentiment, Erwähnungen), `runs_total` gleich. Die globale Firma bleibt. Danach steht BYD in Discover als Kandidat und lässt sich wieder anlegen (`linked`).
- Deaktivieren und Reaktivieren am selben Tag ergibt eine einzige Periode (keine Kleinst-Perioden).

### 11.5 Hintergrund

- **`brand-discover-rollup`** (alle 5 Minuten, je Lauf höchstens 60 s): rechnet jeden vergangenen Team-Tag **einmal**, und nur nochmal, wenn für diesen Tag nachträglich Läufe dazukamen. Ein Lauf ohne Arbeit kostet einen Millisekunden-Blick. Heute rechnet nur „Aktualisieren“.
  - Nach dem Einspielen holt der Job die letzten 366 Tage nach, neueste zuerst. Die letzten 30 Tage aller Teams sind nach etwa 15 Minuten da, alles nach etwa 3 Stunden. Bis dahin zeigt `meta.missing_days`, wie viele Tage im Zeitraum noch fehlen.
- **`brand-purge-worker`** (alle 10 s): tut nur etwas, wenn ein Löschauftrag offen ist.

### 11.6 Danach (nach der Umstellung)

- `rechte_bestand_brands.sql`: anon aus 28 alten Brands-Funktionen, authenticated bleibt. Gesichert und im Rollback geprüft, inklusive Rückweg.
- Nicht dabei, weil Bubble sie app-weit auch ohne Nutzertoken ruft: `get_team_companies_v1`, `get_team_brand_header_v9`. Die fallen mit Bubble weg.
