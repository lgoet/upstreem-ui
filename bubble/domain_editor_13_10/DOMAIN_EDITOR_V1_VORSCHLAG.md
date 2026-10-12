# Domain-Drawer und Marken-Editor: Bestandsaufnahme, Prüfung, Vorschlag (13.10.2026)

Nichts geändert. Alle Tests liefen in Transaktionen, die danach zurückgerollt wurden, im Team 877c mit 7 Tagen. Die Rollen waren owner (7bedb728), admin (aea6e317), member (1fdb2924) und ein fremder Nutzer (b6f0e8a9). Rohdaten der Tests liegen in `_build/dom/inventar_result.json`.

## 0. Wichtigste Befunde

| # | Schwere | Befund |
|---|---|---|
| E1 | **kritisch** | **Die Erkennung arbeitet mit Teilstrings, nicht mit ganzen Wörtern.** Belege aus 30 Tagen: „Nokian Hakkapeliitta“ wird KIA zugeordnet, „Techdigitals“ und „HDITarif“ werden HDI zugeordnet, „World of Hyatt“ wird Hyatt zugeordnet. Ein Alias wie `a`, `the` oder `.*` geht heute ungeprüft durch (Test: alle `inserted`) und landet sofort in `get_team_companies_context_v2`, also bei n8n. Ab dem nächsten Lauf würde fast jede genannte Marke dieser Marke zugeschlagen. Das verfälscht Nennungen, Rang, Sichtbarkeit und Citations („erwähnt“) dauerhaft, denn alte Läufe werden nicht neu berechnet. |
| E2 | hoch | **Kollisionen werden nicht geprüft.** Den Alias „Mercedes“ bei BMW (Test: `inserted`) erkennt n8n bei beiden Marken. Einen Wettbewerber in „Mercedes Benz“ umzubenennen geht durch (`ok`); danach heißen zwei Marken im Team gleich. |
| E3 | hoch | **Text wird nicht geprüft.** Der Name nimmt 3.000 Zeichen, nur Zero-Width-Zeichen, Bidi-Umkehr (`U+202E`) und `=HYPERLINK(…)`. Der Alias nimmt 500 Zeichen und einen einzelnen `U+200B`. `trg_clean_text` entfernt nur Backtick, `${` und Backslash und fasst Leerraum zusammen. Unsichtbare Zeichen bleiben, NFKC fehlt. |
| E4 | mittel | **Fremde Firmen.** `add_company_alias_v1`, `set_company_color_override_v1` und `clear_…` nehmen Firmen, die das Team nicht verfolgt. Getestet mit Kompyte in 877c (beide `inserted`/`saved`) und mit BMW im Team upstreem. Es gibt kein Leck in fremde Teams, aber Datenmüll. |
| E5 | mittel | **Fehler und Grenzen.** `update_team_company_display_name_v1` gibt jeden Fehler als HTTP 200 mit `status: error` zurück (H1, bestätigt). Die anderen fünf werfen den Text-Fehler P0001 (`forbidden`, `alias not found`, `invalid hex color`).<br>Ratenlimit (alt, `check_rate_limit`, je Nutzer): `add_company_alias_v1` 20 je Minute (greift), `add_team_domain_override` 30 je Minute (greift). Umbenennen (50 in Folge: alle `ok`), Umschalten, Löschen und Farbe haben **keins**. |
| E6 | mittel | **Kein Protokoll, kein Cache-Leeren.** Keine der Editor-Aktionen schreibt in `brand_activity_log` (0 Einträge). Dessen Check kennt nur `add/activate/deactivate/delete`. Keine Aktion leert einen Cache, Folgen siehe A2.4 und B3.7. |
| D1 | hoch | **Den Domain-Override darf jedes Mitglied setzen und entfernen** (Test: member setzt `youtube.com` als „You“ und entfernt ihn). Es gibt kein Limit (3.000-Zeichen-Domain und `evil​.de` mit Zero-Width gingen durch) und kein Protokoll außer `created_by`, das beim Ändern überschrieben wird. Gesperrte Fälle gibt es nicht: eigene Domain als Competitor, BMW-Domain als „You“ und `youtube.com` als „You“ gehen alle durch. Allein `youtube.com` hebt den „You“-Anteil in 877c um 20 Prozentpunkte. |
| D2 | hoch | **Die alten Domain-RPCs sind für PUBLIC und anon ausführbar.** Betroffen sind `get_domain_detail_v14` und `v13`, `add/remove_team_domain_override` und das alte `cached_citation_domain_urls_v1`.<br>v14 und das alte `cached_citation_domain_urls_v1` haben keinen `search_path`.<br>v14 prüft keinen Zugang: Factory Bottrop bekommt Daten. Bei nie zitierten Domains liefert v14 `first_seen` aus der globalen Tabelle, also aus anderen Teams (nur ein Datum). |
| D3 | mittel | **`p_domain` in den Responses wird nicht normalisiert.** `www.adac.de` und `https://adac.de/` liefern 0 statt 710. `cached_citations_domain_urls_v1` und `export_citations_urls_v1` normalisieren richtig. v14 schneidet nur `www.` ab und liefert für `https://WWW.ADAC.de/test` leer. |
| D4 | niedrig | v14 dehnt im Wochen- und Monatsmodus den Zeitraum auf volle Kalenderwochen aus. Die große Zahl springt dann von 43,35 % (Tag) auf 42,15 % (Woche); die Citations-Seite rechnet anders. |

## Teil A: Domain-Drawer

### A1. Bestandsaufnahme
**`get_domain_detail_v14(p_team, p_domain, p_date_from, p_date_to, p_models, p_granularity='day', p_urlshare='no', p_share='domain', p_tag_ids, p_tagmode, p_markets)`**
- security definer **ohne** `search_path`; PUBLIC und authenticated; altes Ratenlimit `domain_detailed` mit 30 je Minute; Prüfung nur auf Mitgliedschaft.
- Ausgabe wie in den Run-JS-Vorlagen:
  - `header{id, domain, favicon, first_seen, last_seen, citation_type, current_citation_share, citation_share_prev, citation_share_delta_pct, total_citations_count/_prev/_delta_pct}`;
  - `granularity`;
  - `timeseries{citation_share_over_time, citations_over_time, runs_over_time}`;
  - `types_breakdown[{type, share_pct}]` (URL-Typen nach Zitaten);
  - `model_breakdown[{model, model_share_pct, model_logo_url, color_lightmode, color_darkmode}]`;
  - `source_presence_funnel{ai_searches_citing_domain, cited_urls_count, urls_with_tracked_brands, urls_without_tracked_brands, urls_mentioning_you, urls_mentioning_competitors, overlap_urls, competitor_only_urls, tracked_brand_presence_pct, your_url_presence_pct, competitor_url_presence_pct, competitor_only_share_pct, opportunity_gap_pct, opportunity_gap_urls, presence_gap_pct}`;
  - bei `p_urlshare='yes'` zusätzlich `url_share{points…}`.
- Filter: Zeitraum, Modelle, Märkte, Topics (or/and) und Granularität. Erwähnt-Filter gibt es keinen.
- Wirksamer Typ: Override, sonst Domain einer verfolgten Marke, sonst `source_domain.citation_type`. Die Citations-Seite nutzt dieselbe Reihenfolge.

**URL-Share:** Bubble ruft `get_domain_url_share_over_time_v6(p_team, p_domain, from, to, p_models, p_share)` auf (960 Aufrufe).
- Ausgabe: `{from, to, top_n: 5 (fest), domain, share_mode, points[{day, url, title, share_pct, url_runs_total, share_total_pct, global_share_total_pct, domain_share_total_pct}]}`.
- Märkte und Topics fehlen.
- Kein anon, aber auch keine Zugangsprüfung.

**Aufrufe seit Beginn der Statistik:**
- v14: 260 Aufrufe, Mittel 210 ms, höchstens 3,1 s. Daneben die alten Fassungen v3–v13.
- URL-Tabelle: Bubble nutzt `cached_citation_urls_v2` (1.467 Aufrufe, Mittel 354 ms, höchstens 14 s) und das alte `cached_citation_domain_urls_v1` (300).
- Das neue `cached_citations_domain_urls_v1` ist da und richtig gebaut: Normalisierung, Zugang, Cache.

**Override:** `add_team_domain_override(p_team, p_domain, p_role)` und `remove_team_domain_override(p_team, p_domain)`:
- Prüfung nur auf Mitgliedschaft; Domain über `_url_domain_norm` (Schema, Login, Pfad, Port und `www.` weg); Upsert setzt `created_by`/`created_at` neu.
- Remove löscht ohne Rückmeldung, ob es etwas gab.
- Kein Cache wird geleert.
- Bisher gibt es 15 Overrides in 6 Teams, alle von owner/admin gesetzt (eins von einem Nutzer, der nicht mehr Mitglied ist). Aufrufe: 57-mal setzen, 31-mal entfernen.

**Zahlen (adac.de, 7 Tage):**

| Wert | v14 | neue RPCs | gleich |
|---|---|---|---|
| Citation Share / Delta | 43,35 / +3,71 | `cached_citations_domains_v1` 43,35 / +3,71 | ja |
| Antworten mit Domain | 710 (`ai_searches_citing_domain`) | `domain_urls.meta.runs_with_domain` 710, Responses `p_domain` 710 | ja |
| URLs | 217 (`cited_urls_count`) | `domain_urls.total_count` 217, Export 217 | ja |
| Wochenmodus | 42,15 % (Zeitraum auf Mo–So gedehnt) | – | siehe D4 |

**Laufzeit:**
- v14 für adac.de: kalt 890 ms, warm 24 ms.
- v14 für eine kleine Domain (jw.org): 18 ms.
- URL-Share v6: 10–13 ms.
- `domain_urls`: 290 ms kalt.
- Responses mit `p_domain`: 820 ms kalt.

### A2. Prüfung
1. **Nie zitierte oder fremde Domain:**
   - v14 liefert eine leere Hülle mit 0 und `citation_type: null`, ohne Fehler.
   - Bei Domains, die das Team nicht zitiert, kommen `first_seen`/`last_seen` aus der globalen `source_domain` (D2). Das ist eine kleine Lücke: Man sieht, dass andere die Domain zitieren.
   - Für fremde Teams gibt es keine Zahlen.
2. **Eingabe:**
   - v14 kennt nur `lower`, `btrim` und `www.`.
   - 5.000 Zeichen gehen durch.
   - Punycode und Unicode werden nicht umgewandelt; die Rollups speichern, was die Quelle liefert.
   - `source_url.domain` ist praktisch ohne `www.` gespeichert: 1 von 270.444 Zeilen hat es.
   - **Vorschlag:** überall `_url_domain_norm`, höchstens 253 Zeichen, Muster `^[a-z0-9.-]+\.[a-z0-9-]{2,}$` (Unicode-Domains als Punycode), sonst `domain_invalid`. Das gilt auch für `p_domain` in `cached_dashboard_responses_v1` und `export_responses_v1` (D3).
3. **Override, Missbrauch:**
   - **Wer darf ihn setzen:** Heute jedes Mitglied. Vorschlag: owner/admin. In der Praxis haben bisher nur sie ihn gesetzt.
   - **Große Plattform als „You“:** Sie bläht alle eigenen Zahlen (Citations, Funnel, Opportunities) rückwirkend auf, weil der Typ erst beim Rechnen gilt. Vorschlag: eine Sperrliste großer Plattformen (youtube, google, wikipedia, reddit, amazon.*, facebook, instagram, linkedin, x/twitter, tiktok, pinterest, apple, microsoft), Fehler `domain_classify_invalid` mit hint `platform`.
   - **Eigene Markendomain als Competitor, Wettbewerber-Domain als „You“:** Beides ist ein Widerspruch zu den verfolgten Marken. Vorschlag: abweisen mit hint `tracked_brand` (dazu die Marke). Zurück auf Automatik geht immer.
   - **Anzahl:** Vorschlag höchstens 100 je Team (heute höchstens 8).
   - **Protokoll:** Heute nur `created_by` (wird überschrieben). Vorschlag: Protokolltabelle (siehe B4).
   - **Rückwirkend:** Ja. Der Override wirkt nur in der Rechnung, nicht in Rollups oder `response_source`, also auf alle Zeiträume.
4. **Override, Konsistenz:**
   - Die Citations-Version enthält Anzahl und letztes `created_at` der Overrides. Die Caches werden also ungültig, aber erst nach dem 15-Minuten-Fenster, in dem `_citations_f_cached_v1` auch veraltete Ergebnisse liefert.
   - Das Dashboard nutzt den Typ nicht.
   - Die Bubble-`rpc_cache` (`citation_*`) läuft nach eigener Zeit ab.
   - Vorschlag: `domain_classify_v1` löscht die Zeilen des Teams in `citations_cache` und `rpc_cache` sofort.
5. **Kosten:** v14 und v6 schreiben beim Lesen nur den Zähler des alten Ratenlimits (`rate_limit`).

### A3. Vorschlag
Wie im Auftrag, mit diesen Festlegungen:
- **`domain_detail_v1(p_team, p_domain)`** → `{meta, row}`:
  - `row`: `domain`, `favicon_url` (https), `citation_type`, `citation_type_auto`, `override`, `can_override` (owner/admin), `first_seen`/`last_seen` (**nur aus den Team-Rollups**, sonst null) und `company{company_id, name, role}` oder null.
  - `domain_not_found` (PT404) nur bei ungültiger Eingabe.
  - Ratenlimit `domain` mit 120 je Minute.
- **`domain_detail_stats_v1`:** dieselben Filter wie Citations, gecacht über `_citations_f_cached_v1`.
  - Die Rechnung baut auf den Kacheln der Citations-Seite auf, sodass `current_citation_share` = `share_pct` aus `cached_citations_domains_v1` in **jedem** Modus gilt. Die Granularität ändert nur die Kurve, nicht den Zeitraum (behebt D4).
  - Felder: `header`-Zahlen, `timeseries`, `types_breakdown`, `model_breakdown` und `source_presence_funnel` wie heute.
  - Im Funnel bezieht sich „mentioning you“ auf die eigene Marke.
- **`domain_url_share_v1`:**
  - Felder: `rows[{day, url, title, share_pct}]` und je URL `share_total_pct`.
  - `p_top_n` zwischen 1 und 10, Standard 7.
  - Kennt Märkte und Topics.
- **`domain_classify_v1(p_team, p_domain, p_role)`** wie beschrieben:
  - owner/admin;
  - Sperrliste, Widerspruchsprüfung, höchstens 100;
  - Ratenlimit 30 je Minute;
  - Protokoll;
  - Cache leeren;
  - Antwort ist die neue `domain_detail_v1`-Zeile.
  - `p_role = null` entfernt den Override und ist idempotent.
- **URL-Tabelle und Responses:**
  - Die URL-Tabelle bleibt bei `cached_citations_domain_urls_v1`.
  - Die Responses bleiben bei `cached_dashboard_responses_v1(p_domain)` mit Normalisierung (D3).
  - `export_citations_urls_v1` kennt `p_domain` schon (getestet: 217 Zeilen).
  - Geprüft: Responses `total_count` = `runs_with_domain` (710 = 710).
- **Absicherung der Altversionen** wie bei URL/Prompt/Brand:
  - v13/v14 bekommen Zugangsprüfung und `search_path`;
  - PUBLIC/anon raus bei v13/v14, beim alten `cached_citation_domain_urls_v1` und bei `add/remove_team_domain_override`;
  - die beiden Override-Funktionen nur noch für owner/admin.

## Teil B: Marken-Editor

### B1. Bestandsaufnahme

| Funktion | Rolle | Rechte | Fehlerform | Ratenlimit | schreibt |
|---|---|---|---|---|---|
| `get_company_edit_v2` | jedes Mitglied | authenticated (seit `brand_alt_absichern` ohne anon) | `brand_not_found` PT404 für fremde Marken | – | – |
| `update_team_company_display_name_v1` | owner/admin | **PUBLIC** | **200 + `status:error`** (fängt alles) | – | `team_brand_profile.name_override` (gleich dem globalen Namen → null) |
| `add_company_alias_v1` | owner/admin | **PUBLIC** | P0001 Text; Doppelung → `status: exists` | 20/min | `company_alias` (`exact_ci`, `priority` 100) |
| `toggle_company_alias_v1` | owner/admin | **PUBLIC** | P0001 | – | dreht `is_active` um (kein Zielwert) |
| `delete_company_alias_v1` | owner/admin | **PUBLIC** | P0001; zweites Löschen: `alias not found` | – | löscht |
| `set_company_color_override_v1` | owner/admin | **PUBLIC** | P0001 `invalid hex color` | – | `team_company_settings` (Upsert per Hand) |
| `clear_company_color_override_v1` | owner/admin | **PUBLIC** | – | – | setzt null |

- **Anzeigename:** `team_brand_profile.name_override`. Der Trigger `enforce_own_brand_only` verlangt, dass die Firma im Team ist. Gelesen wird überall `coalesce(name_override, company.name)`.
- **Aliase:** `company_alias(team_id, company_id, pattern, mode, priority, is_active)`. Eindeutig ist `(team, company, lower(pattern))`, **nicht** `(team, lower(pattern))`; deshalb sind Kollisionen möglich. Der Editor schreibt immer `exact_ci`/100.
- **Erkennung:**
  - n8n holt je Lauf `get_team_companies_context_v2` mit Namen und aktiven Aliasen.
  - Gematcht werden die von der KI genannten Markennamen (`recommendation.brand_name_raw`): Gleichheit, Präfix und auch Teilstrings mitten im Wort (E1).
  - Für Seiteninhalte setzt die Erkennung `url_company_mention` mit `name_exact`/`alias_exact`/`short_brand` (877c: 136k/47k/2k).
  - Nur künftige Läufe sind betroffen; alte werden nicht neu berechnet.
  - Priorität ist bei allen 100 und hat damit keine Wirkung.
- **Datenlage:**
  - 160 Aliase, alle `exact_ci`, alle aktiv.
  - Höchstens 8 je Marke, 2 bis 29 Zeichen; kürzeste: `NH`, `VW`, `A&O`, `ASH`, `AXA`, `HUK`, `R+V`.
  - Keine exakte Kollision mit einer anderen Marke im selben Team. 2 Aliase enthalten den Namen einer anderen Marke oder stecken in ihm.
  - 15 Aliase gehören zu Marken außerhalb des Teams. Alle 15 sind archivierte Marken; sie bleiben für eine Reaktivierung und sind gewollt.
  - 0 doppelte Namen im Team.
- **Member:** braucht nur das Lesen (`get_company_edit_v2`). Das geht heute.

### B2. Bekannte Befunde
- **H1:** bestätigt, aber nur `update_team_company_display_name_v1` schluckt alle Fehler (200 + `status:error`). Die anderen werfen P0001-Text. Ratenlimit siehe E5.
- **M3/E2/E4:** bestätigt (Alias und Farbe für Kompyte in 877c, Farbe für BMW im Team upstreem).
- **M3/E3:** bestätigt (Name 3.000, Alias 500 Zeichen).
- **H3:** bestätigt, kein Cache wird geleert.
- **`trg_clean_text`:** bestätigt.
  - Zero-Width, Bidi und Emoji bleiben.
  - Ein Name aus zwei `U+200B` wird gespeichert und angezeigt (leer).
  - Kein NFKC.

### B3. Missbrauchs- und Fehlerprüfung (Tests im Rollback)

| # | Prüfung | Ergebnis heute | Schwere | Vorschlag |
|---|---|---|---|---|
| 1 | Rolle | member: `forbidden` bzw. `status:error` (richtig); anon: `not authenticated`, ausführbar wegen PUBLIC | mittel | owner/admin bleibt; PUBLIC/anon raus |
| 1 | Fremdes Team | `forbidden` (richtig) | – | – |
| 1 | Fremde, archivierte oder nie verfolgte Firma | Alias und Farbe: angenommen; Name: abgelehnt | mittel | nur aktive Marken des Teams bearbeiten; archivierte nur lesen; fremd → `brand_not_found` |
| 2 | Alias `a`, `the`, `.*`, `U+200B` | alle `inserted`, sofort bei n8n | **kritisch** | Grenzen siehe unten |
| 2 | Kollision (`Mercedes` bei BMW) | `inserted` | hoch | `collides` mit Marke |
| 3 | Länge Name/Alias | 3.000/500 angenommen | hoch | Name 1–60, Alias 2–60 |
| 3 | Unsichtbare/Bidi/Steuerzeichen | gespeichert | hoch | abweisen (`characters`) |
| 3 | Formel `=HYPERLINK(…)` als Name | gespeichert; die Exporte schützen per `csv_safe_v1` (alle `export_*` mit Namen geprüft) | niedrig | so lassen; zusätzlich `=+-@` am Anfang abweisen |
| 4 | Gleicher Name wie andere Marke | `ok` | hoch | eindeutig im Team (ohne Groß-/Kleinschreibung, nach NFKC) → `taken` |
| 5 | Farbe `#FFF` | abgelehnt | – | bleibt; Fehler `brand_color_invalid` |
| 5 | Farbe `''` | als „zurücksetzen“ gespeichert | niedrig | `null` = zurücksetzen; `''` → `brand_color_invalid` |
| 5 | Farbe `AbCdEf` (ohne #, gemischt) | `#AbCdEf` gespeichert | niedrig | auf `#abcdef` normalisieren |
| 6 | Spam | Alias 20/min greift (21. Aufruf); Name, Umschalten, Löschen und Farbe ohne Limit (50 Umbenennungen `ok`) | mittel | `brand_edit` 30/min je Nutzer, höchstens 20 Aliase je Marke |
| 7 | Caches | Dashboard: Version enthält `team_brand_profile.updated_at`, liefert aber bis 2 h lang „stale“; Farbe nicht in der Version. Citations: Namen in `mentions` ohne Version, 15 min stale. Bubble-`rpc_cache`: eigene Zeit | mittel | Schreib-RPCs löschen die Team-Zeilen in `dashboard_cache`, `citations_cache`, `rpc_cache` |
| 7 | Discover | `cached_discover_brands_v1` blendet Namen aus, die zu Aliasen passen; ein neuer Alias wirkt dort beim nächsten Rechnen | niedrig | mitleeren |
| 8 | Protokoll | nichts | mittel | Protokoll je Aktion |
| 9 | Doppelklick „hinzufügen“ | `exists` (gut); echtes Rennen läuft auf den Unique-Index → 23505 als 500 | niedrig | `on conflict do nothing` → gleiche Antwort |
| 9 | Doppelklick „umschalten“ | zweiter Klick dreht zurück | mittel | Zielwert statt Umdrehen (`p_active`) |
| 9 | Zwei Tabs benennen um | letzter gewinnt | niedrig | so lassen; Antwort enthält den gespeicherten Stand |
| 9 | Löschen während Umschalten | `alias not found` | – | `brand_alias_not_found` |

**Grenzen für Aliase (Vorschlag):**
- **Text:**
  - NFKC, `btrim`, Leerraum zusammengefasst.
  - Unsichtbare und Steuerzeichen (Kategorien Cc/Cf, Bidi, Zero-Width, Variation Selectors) sowie Emoji → `characters`.
- **Länge:** 2–60 Zeichen.
  - Mindestens ein Buchstabe.
  - 2 Zeichen nur, wenn beide Großbuchstaben oder Ziffern sind (VW, NH); 3 Zeichen nur mit mindestens einem Großbuchstaben oder einem `&`/`+` (AXA, R+V, A&O).
  - Sonst `too_short`.
- **Sperrliste** allgemeiner Wörter (de/en, etwa 300: Artikel, Präpositionen, „auto“, „gut“, „bank“, „group“, „online“, „shop“, „hotel“, „versicherung“ …) → `generic`.
  - Wörter mit Zusatz bleiben erlaubt („Toyota Bank“).
- **Kollision:** Gleich (nach NFKC, ohne Groß-/Kleinschreibung) mit Name, globalem Name oder Alias einer **anderen** Marke des Teams → `collides` (hint mit Markenname).
  - Enthält der Alias einen fremden Markennamen als ganzes Wort, gilt das ebenfalls als Kollision (verhindert „BMW Mercedes“).
- **Obergrenze:** 20 je Marke → `brand_alias_limit`.
- **Kein Regex:** Modus immer `exact_ci`, Priorität nicht änderbar.
- **n8n (eigener Auftrag, nicht DB):** Die Erkennung braucht Wortgrenzen. Das behebt E1 auch für bestehende Kurz-Namen (KIA in „Nokian“, HDI in „Techdigitals“). In 30 Tagen betraf das 16 von 54.412 Zuordnungen.

**Name:**
- 1–60 Zeichen, gleiche Zeichenregeln wie beim Alias.
- Im Team eindeutig (`taken`).
- `null`/leer → zurück zum globalen Namen.
- Gleich dem globalen Namen → Override wird null (wie heute).

### B4. Vorschlag
Wie im Auftrag, mit diesen Festlegungen:
- **`brand_edit_v1`**
  - `meta.limits = {name_max: 60, alias_min: 2, alias_max: 60, aliases_max: 20}` und `can_edit`.
  - `row.status = 'inactive'` für archivierte Marken; dann `can_edit: false`.
  - `aliases` ohne `mode`/`priority`.
- **Schreib-RPCs:**
  - `brand_rename_v1`, `brand_alias_add_v1`, `brand_alias_set_v1` (Zielwert), `brand_alias_delete_v1` und `brand_color_set_v1` (null = zurücksetzen).
  - Jede antwortet mit der neuen `brand_edit_v1`-Antwort.
  - Alle nach Bauart: `_set_require_v1`, Zugang, Rolle, `_pi_rate_limit_v1('brand_edit', 30, 'brand_edit')`, Prüfung, Schreiben, Cache leeren, Protokoll.
  - Fehler sind echte Fehler mit den Codes aus dem Auftrag.
  - `brand_alias_add_v1` mit einem vorhandenen Alias derselben Marke ist kein Fehler; die Antwort zeigt ihn.
- **Protokoll (zu entscheiden, Frage 2):** Neue Tabelle `team_change_log(team_id, user_id, area 'brand'|'domain', action, company_id, domain, before jsonb, after jsonb, created_at)`, nur per RPC beschreibbar.
  - `brand_activity_log` hat einen Check auf vier Aktionen; den müsste ich erweitern.
- **Altversionen:**
  - Die sechs Schreib-RPCs bekommen dieselben Prüfungen über eine Absicherungsdatei wie bisher, sonst bleibt die Lücke über Bubble offen.
  - Konkret: Zeichen- und Längenprüfung, Sperrliste, Kollision, nur verfolgte Marken, PUBLIC/anon raus.
  - Die Antwortform für Bubble bleibt gleich.

## Zu entscheiden (Lukas)
1. **Alias-Regeln:** Mindestlänge mit der Ausnahme für kurze Großbuchstaben-Marken (VW, NH, AXA, R+V), eine Sperrliste allgemeiner Wörter, die Kollisionsprüfung und höchstens 20 Aliase je Marke. Einverstanden?
2. **Protokoll:** neue Tabelle `team_change_log` (Vorschlag) oder `brand_activity_log` erweitern?
3. **Domain-Override:** nur noch owner/admin, mit Sperrliste großer Plattformen und Widerspruchsprüfung gegen verfolgte Marken. Einverstanden?
4. **Altversionen sofort absichern** (eigene kleine Datei, wie bei URL/Prompt/Brand)? Sie betreffen auch Bubble heute: Alias `a` und anon-Zugriff.
5. **n8n Wortgrenzen:** als eigener Auftrag? Das liegt außerhalb der DB, wirkt aber am stärksten gegen falsche Zuordnungen.

Nach Freigabe baue ich in einem Durchgang, je mit Rückweg und echten Antworten: Domain (A3), Editor (B4), die Absicherung der Altversionen und die Normalisierung von `p_domain` in den Responses.

## Gebaut (13.10.2026, nach Freigabe)
**Entscheidungen (Lukas):**
- Alias: 2 Zeichen nur in Großbuchstaben, keine Sperrliste, Prüfung gegen die anderen Marken des Teams, höchstens 20 je Marke.
- Protokoll: `brand_activity_log` erweitert, dazu `brand_log_v1` mit Typ-Filtern wie das Team-Log.
- Domain-Override:
  - nur owner/admin;
  - **keine** Plattform-Sperrliste, weil es die eigenen Daten des Teams sind;
  - Widerspruchsprüfung nur gegen die Website-Domains verfolgter Marken. Eigene Overrides des Nutzers zählen nicht: bmw.de als Competitor-Override darf auf „You“ gestellt werden.
- Altversionen gleich mit absichern.
- n8n: siehe unten.

**Dateien** (je ein Block, mit Rückweg):
1. `domain_editor_v1.sql`:
   - Domain: `domain_detail_v1`, `domain_detail_stats_v1`, `domain_url_share_v1`, `domain_classify_v1`.
   - Editor: `brand_edit_v1`, `brand_rename_v1`, `brand_alias_add_v1`, `brand_alias_set_v1`, `brand_alias_delete_v1`, `brand_color_set_v1`.
   - Protokoll: `brand_log_v1`, dazu der erweiterte Check von `brand_activity_log`.
   - Normalisierung von `p_domain` in `cached_dashboard_responses_v1` und `export_responses_v1`.
2. `domain_editor_alt_absichern.sql` (danach):
   - `get_domain_detail_v13`/`v14`: Zugang und `search_path`.
   - `get_domain_url_share_over_time_v5`/`v6`: Zugang.
   - Override alt: nur owner/admin, mit Protokoll und Cache.
   - Die sechs alten Editor-RPCs bekommen dieselben Regeln wie die neuen, nur für Marken des Teams, mit Protokoll und Cache. Die Antwortform für Bubble bleibt gleich.
   - PUBLIC/anon sind bei 14 Alt-RPCs entzogen.

**Geprüft** (Rollback, `domain_editor_v1_echte_antworten.json`):
- Stats = `cached_citations_domains_v1` für adac.de in Tag, Woche und Monat (43,29 %, Delta +3,65). Der Funnel ist identisch mit v14 (217 URLs, 716 Antworten).
- Responses mit `www.adac.de` liefern 716 (vorher 0).
- Die Altversionen liefern nach der Absicherung dasselbe wie vorher (v14, v6, Export).
- Alle Fehlerformen geprüft; die Ratenlimits greifen beim 31. Aufruf.
- Nach `domain_classify_v1` ist der Citations-Cache des Teams leer (34 Zeilen auf 0).
- Bestand: Nach den neuen Regeln würden nur 2 Aliase im Team cf31a5d4 kollidieren („apple.uk“, „apple.es“ mit „Apple ABC“). Sie bleiben; abgewiesen würden sie erst beim erneuten Anlegen.
- md5: Alle 36 Fassungen entsprechen dem Test (`domain_editor_v1_md5.json`).

**n8n (zur Rückfrage):** Die Erkennung funktioniert. Belege dafür, dass sie auch Teilstrings mitten im Wort zuordnet (30 Tage, 16 von 54.412 Zuordnungen):
- „Nokian Hakkapeliitta“ wird KIA zugeordnet.
- „Techdigitals“ und „HDITarif“ werden HDI zugeordnet.
- „KiaHyundai“ wird KIA zugeordnet.

Heute ist das selten, weil Namen und Aliase meist lang sind. Kritisch wäre es nur mit sehr kurzen Aliasen; die verhindert jetzt die Datenbank. Eine Änderung an n8n ist deshalb nicht nötig.
