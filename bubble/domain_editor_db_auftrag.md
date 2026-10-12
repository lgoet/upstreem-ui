# Auftrag an den Datenbank-Chat: Domain-Drawer und Marken-Editor (Stand 13.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig.

**Diese Runde ist eine BESTANDSAUFNAHME mit FEHLERSUCHE, MISSBRAUCHSPRÜFUNG und VORSCHLAG. Du
änderst nichts.** Es sind die zwei letzten Drawer. Vorbild ist die letzte Runde (`brand_detail_v1`
mit `p_brand`). Dafür gelten dieselbe Bauart und dieselben Regeln:
- `security definer` mit festem `search_path`;
- kein anon;
- der Nutzer kommt aus `auth.uid()`;
- Antworten als `{meta, row}`;
- stabile Fehler-`message`;
- `_pi_rate_limit_v1`;
- nichts außerhalb der Transaktion.

**Der Marken-Editor schreibt.** Dort ist die Missbrauchs- und Fehlerprüfung (Abschnitt B3) der
wichtigste Teil des Auftrags. Lukas: „Ganz wichtig, da sensibles Thema.“

---

# Teil A: Domain-Drawer

## A0. Worum es geht

Ein Drawer der ersten Ebene, geöffnet mit dem Domain-Namen (`?detail=domain:<domain>`).
- Geöffnet wird er aus Citations, Top Citations, URL- und Brand-Drawer, Quick Actions und Mira.
- Heute baut Bubble ihn aus `get_domain_detail_v14` und weiteren, im Repo nicht dokumentierten RPCs.

Neuer Aufbau:

| Teil | Daten | Vorschlag |
|---|---|---|
| Kopf | „Domain / {domain}“, ein Menü „Diese Domain zählt als …“ (siehe A4), Ask Mira, Anheften, Schließen | `domain_detail_v1` |
| Titel | Favicon, Domain, daneben ein Chip mit dem Citation Type | `domain_detail_v1` |
| Filterzeile | Kalender, Modelle, Märkte, Topics | – |
| Domain Detail | Citation Share über die Zeit mit großer Zahl und Delta. Umschalter „URL Share“ (Anteil je URL der Domain über die Zeit). Dazu Source Funnel, URL-Type-Verteilung, Modell-Verteilung. | `domain_detail_stats_v1` (neu) und `domain_url_share_v1` (neu) |
| Umschalter | „Unterseiten / URLs“ oder „KI-Antworten“ | – |
| URLs | die URLs dieser Domain | `cached_citations_domain_urls_v1` (gibt es) |
| Responses | Antworten, die die Domain zitieren | `cached_dashboard_responses_v1` mit `p_domain` (gibt es seit URL Detail) |

## A1. Bestandsaufnahme (bitte mit Definition und Beispiel)

1. **`get_domain_detail_v14`:**
   - Definition, Parameter, Rechte, Ausgabe.
   - Laut Run-JS-Vorlagen liefert er:
     - `header`: `id`, `domain`, `favicon`, `first_seen`, `last_seen`, `citation_type`, `current_citation_share`, `citation_share_delta_pct`, `citation_share_prev`, `total_citations_count`/`_prev`/`_delta_pct`;
     - `granularity`, `timeseries.citation_share_over_time[{day, share_pct}]`, `types_breakdown[{type, share_pct}]`, `model_breakdown[{model, model_share_pct, model_logo_url}]`;
     - `source_presence_funnel{cited_urls_count, urls_with_tracked_brands, tracked_brand_presence_pct, urls_mentioning_you, your_url_presence_pct}`;
     - teils auch `ai_searches_citing_domain`, `competitor_*`, `opportunity_gap_*`.
   - Stimmt das? Welche Filter kennt er?
2. **Die URL-Share-Kurve:** Welcher RPC? Vermutet: `get_domain_url_share_over_time_v5/v6(uuid, text, date, date, text[], text)`.
3. **Welche RPCs ruft Bubble heute im Domain-Drawer** (`pg_stat_statements`, Aufrufe mit einer Domain)? Was füllt die URL-Tabelle dort: `cached_citation_urls_v2` mit `p_domain` oder `cached_citation_domain_urls_v1`?
4. **Domain-Override:**
   - Definition von `add_team_domain_override` und `remove_team_domain_override`: Parameter, Rechte, Rollenprüfung, was sie schreiben.
   - Leeren sie Caches?
   - Wer hat sie in den letzten Monaten wie oft aufgerufen?
5. Zahlen und Rechnung:
   - Passen `current_citation_share` und das Delta zu `share_pct` dieser Domain in `cached_citations_domains_v1` für denselben Zeitraum?
   - Passt die Summe des Funnels zu `cached_citations_domain_urls_v1`?
6. Laufzeiten kalt und warm (877c) für eine große Domain (z. B. `adac.de`) und eine kleine. Ratenlimit heute?

## A2. Prüfung (Befund, Schwere, Vorschlag)

1. **Fremde oder unbekannte Domain:** Was liefern die RPCs für eine Domain, die das Team nie zitiert hat? Das soll leer sein, nicht ein Fehler. Werden beim Lesen fremde Teamdaten sichtbar?
2. **Eingabe:**
   - Die Domain kommt aus der Adresse (`?detail=domain:…`), ist also frei eingebbar. Wie werden Länge, Großschreibung, `www.`, Pfad, Schema, Punycode und Leerzeichen behandelt?
   - Achtung: `p_domain` in `cached_dashboard_responses_v1` entfernt `www.` nicht, die Citations-RPCs schon. Bitte vereinheitlichen.
3. **Override, Missbrauch:**
   - Wer darf ihn setzen (member? owner/admin?)?
   - Was passiert mit einer großen Plattform (z. B. `youtube.com`) als „You“? Sie bläht die eigenen Zahlen auf.
   - Was passiert mit der Domain der eigenen Marke als „Competitor“?
   - Und mit der Domain eines verfolgten Wettbewerbers als „You“?
   - Wie viele Overrides darf ein Team haben?
   - Wird protokolliert, wer was wann gesetzt hat?
   - Wirkt der Override rückwirkend auf alle Zeiträume, also nur über die Rechnung und nicht beim Speichern?
4. **Override, Konsistenz:** Welche Caches müssen danach leer sein: Citations und Dashboard (Responses, Overview)? Wo steht der wirksame Typ sonst noch (Rollups, `response_source`)?
5. **Kosten:** Schreibt einer der alten RPCs beim Lesen?

## A3. Vorschlag (noch nicht bauen)

**`domain_detail_v1(p_team uuid, p_domain text)`** → `{meta, row}`:
- Ohne Zeitraum.
- `row` enthält:
  - `domain` (normalisiert) und `favicon_url` (nur https);
  - `citation_type` (wirksam, mit Override) und `citation_type_auto` (ohne Override, also was die App von sich aus erkennt);
  - `override`: `null` | `'own'` | `'competitor'`;
  - `can_override` (darf der Nutzer ihn setzen);
  - `first_seen` und `last_seen` (letzte Zitation für das Team);
  - `company`: `{company_id, name, role}`, wenn die Domain zu einer verfolgten Marke gehört, sonst `null`.
- Fehler:
  - `domain_not_found` (PT404) nur bei einer ungültigen Domain;
  - nie zitiert heißt `last_seen: null`, kein Fehler.

**`domain_detail_stats_v1(p_team, p_domain, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode, p_granularity)`** (gecacht):
- `meta` mit Zeitraum, Filtern und `granularity`.
- `row`: dieselben Felder wie heute `header` (Zahlen), `timeseries`, `types_breakdown`, `model_breakdown`, `source_presence_funnel`.
- Ohne Zitationen im Zeitraum: leer bzw. `null`, kein Fehler.

**`domain_url_share_v1(…dieselben Filter…, p_granularity, p_top_n default 7)`**:
- `rows[{day, url, title, share_pct}]`, dazu je URL `share_total_pct`.
- Das ist die Form, die die Komponente heute liest (`points`).

**`domain_classify_v1(p_team uuid, p_domain text, p_role text)`**:
- `p_role`: `'own'` | `'competitor'` | `null` (zurück zur Automatik).
- Ersetzt `add_`/`remove_team_domain_override`.
- Rollenprüfung nach deinem Befund aus A2.3, Ratenlimit, Protokoll.
- Leert in derselben Transaktion die Caches aus A2.4.
- Antwortet mit der neuen `domain_detail_v1`-Zeile, damit der Drawer ohne zweiten Aufruf weiterzeichnen kann.
- Fehler:
  - `domain_classify_forbidden` (Rolle);
  - `domain_classify_invalid` (hint: Grund);
  - `domain_classify_rate_limited`;
  - dazu die üblichen (`team_forbidden`, `team_access_<state>`, `team_deleted`, `settings_not_authenticated`, `team_invalid_param`).

Die URL-Tabelle und die Responses bleiben bei den bestehenden RPCs. Bitte prüfen:
- Stimmt `total_count` der Responses mit `p_domain` mit `runs_with_domain` aus `cached_citations_domain_urls_v1` überein?
- **Export der URL-Tabelle im Drawer:** Die Export-Nutzlast trägt `domain`. Kennt `export_citations_urls_v1` einen Domain-Filter (`p_domain`, dieselbe Normalisierung)? Falls nicht, bitte ergänzen. Sonst exportiert der Knopf alle URLs statt der dieser Domain.

---

# Teil B: Marken-Editor (Bubble: `companysettings`)

## B0. Worum es geht

Ein Drawer der dritten Ebene, geöffnet mit der `company_id` (Stift im Brand-Drawer, Brands-Seite, Settings „Your Brand“). Je verfolgter Marke lassen sich dort einstellen:
- der **Anzeigename** im Team;
- **Aliase**: weitere Schreibweisen oder Produkte, unter denen die Marke in KI-Antworten erkannt wird; hinzufügen, an/aus, löschen;
- die **Markenfarbe**: setzen und zurücksetzen.

Darunter stehen die **Beobachtungszeiträume** (nur lesen).

Heute läuft das über:
- Lesen: `get_company_edit_v2(p_team, p_company)`;
- Schreiben: `update_team_company_display_name_v1`, `add_company_alias_v1`, `toggle_company_alias_v1`, `delete_company_alias_v1`, `set_company_color_override_v1`, `clear_company_color_override_v1`.

Lukas hat einen Screenshot mit der vollständigen Liste angekündigt. Bitte ergänze, falls Bubble dort mehr ruft.

## B1. Bestandsaufnahme

1. Definition aller sieben Funktionen: Parameter, Rechte, Rollenprüfung, Ausgabeform und was sie im Fehlerfall tun (siehe H1: `exception when others` gibt HTTP 200 mit `status: error` zurück).
2. Welche Tabellen schreiben sie? Wie hängt der Anzeigename an `team_company` (`name_override`)? Wie hängen die Aliase an der Erkennung (`get_team_companies_context_v2`, n8n, `mode` `exact_ci`, `priority`)?
3. **Wirkung eines Alias:**
   - Gilt er nur für künftige Läufe?
   - Wird er gegen Antworttext und gegen Zitations-URLs gematcht?
   - Wortgrenzen oder Teilstring?
   - Was passiert bei einem Alias, der auch zu einer anderen Marke des Teams passt?
4. Datenlage: Wie viele Aliase pro Marke (heute max. 8)? Kürzester Alias? Gibt es Aliase, die zu einer anderen Marke passen? Die 13 verwaisten Aliase?
5. Was davon braucht ein Nicht-Admin (member) heute zum Lesen?

## B2. Bekannte Befunde aus der Brands-Runde (bitte bestätigen oder schließen)

- **H1:** Die Schreib-RPCs schlucken Fehler, auch das Ratenlimit.
- **M3 / E2 / E4:** `add_company_alias_v1` und `set_company_color_override_v1` nehmen Firmen außerhalb des Teams.
- **M3 / E3:** Der Name ist unbegrenzt (3.000 Zeichen angenommen), der Alias ebenso.
- **H3:** Schreibaktionen leeren keinen Cache.
- `trg_clean_text` entfernt Backtick, `${` und Backslash still. Unsichtbare Zeichen und NFKC behandelt er nicht.

## B3. Missbrauchs- und Fehlerprüfung (Schwerpunkt dieser Runde)

Bitte jeden Punkt mit Test im Rollback, Befund und Schwere.

1. **Rechte:**
   - Wer darf schreiben (owner/admin, nicht member)?
   - Darf man eine Marke eines fremden Teams, eine archivierte (inaktive) oder eine nie verfolgte Firma bearbeiten?
   - Verrät eine fremde `company_id` irgendetwas?
2. **Erkennung vergiften (wichtigster Punkt):**
   - Ein Alias wie „a“, „the“, „auto“, „gut“, eine Zahl oder ein Satzzeichen trifft fast jede Antwort.
   - Ein Alias, der dem Namen oder Alias einer **anderen** Marke des Teams gleicht (z. B. bei einem Wettbewerber „Mercedes“ eintragen), schiebt deren Nennungen in falsche Zahlen.
   - Vorschlag:
     - Mindestlänge;
     - Sperrliste für allgemeine Wörter;
     - Kollisionsprüfung gegen alle Namen und Aliase des Teams;
     - Obergrenze je Marke (z. B. 20);
     - kein Regex.
   - Bitte bewerte das und schlage die Grenzen vor.
3. **Text:**
   - Länge von Name und Alias.
   - Steuerzeichen, unsichtbare Zeichen, Zero-Width, Bidi, Homoglyphen, Emoji.
   - Führende und folgende Leerzeichen, nur Leerzeichen.
   - Vorschlag: NFKC, `btrim`, unsichtbare Zeichen entfernen; abweisen statt still kürzen.
   - Der Anzeigename erscheint in Exporten, also Formelschutz (`csv_safe_v1`) prüfen.
4. **Namens-Spoofing:** Darf ein Wettbewerber genauso heißen wie die eigene Marke oder wie ein anderer Wettbewerber? Vorschlag: eindeutig im Team (ohne Groß- und Kleinschreibung).
5. **Farbe:** nur `#rrggbb`. Darf man `null` und `''` übergeben? Was passiert mit `#FFF`?
6. **Spam und Last:**
   - Ratenlimit je Nutzer und Team für Schreibaktionen.
   - Was passiert bei 500 Aliasen in einer Minute (Erkennung in n8n, Kosten)?
7. **Konsistenz:**
   - Welche Caches müssen nach einer Änderung leer sein (Dashboard, Brands, Discover, Citations)?
   - Wo erscheinen Name und Farbe gecacht?
   - Ändert ein Alias Discover (Namen, die zu Aliasen passen, werden ausgeblendet)?
8. **Protokoll:** Wird festgehalten, wer was wann geändert hat (`brand_activity_log`)?
9. **Doppelte Klicks und Rennen:**
   - Zweimal derselbe Alias.
   - Gleichzeitiges Umbenennen von zwei Tabs.
   - Löschen eines Alias, den ein anderer gerade umschaltet.

## B4. Vorschlag (noch nicht bauen)

**Lesen: `brand_edit_v1(p_team uuid, p_company uuid)`** → `{meta, row}`:
- `meta`:
  - `team_id`, `company_id`;
  - `can_edit` (bool, aus der Rolle);
  - `limits{name_max, alias_min, alias_max, aliases_max}`, damit die Oberfläche dieselben Grenzen prüft wie die DB.
- `row`:
  - `company_id`, `name` (Anzeigename), `global_name`;
  - `domain`, `favicon_url` (nur https);
  - `role` (`own` | `competitor`), `status` (`active` | `inactive`);
  - `default_color`, `color_override`, `effective_color`;
  - `aliases[{alias_id, pattern, is_active, created_at}]`;
  - `tracking_periods[{started_at, ended_at, start_reason}]`.

**Schreiben:** je Aktion eine Funktion. Jede antwortet bei Erfolg mit der **neuen** `brand_edit_v1`-Antwort, damit der Drawer ohne zweiten Aufruf weiterzeichnet. Echte Fehler gehen als Fehler hinaus (kein 200 mit `status: error`).
- `brand_rename_v1(p_team, p_company, p_name)`: `null` oder leer heißt zurück zum globalen Namen.
- `brand_alias_add_v1(p_team, p_company, p_pattern)`
- `brand_alias_set_v1(p_team, p_company, p_alias_id, p_active boolean)`
- `brand_alias_delete_v1(p_team, p_company, p_alias_id)`
- `brand_color_set_v1(p_team, p_company, p_color)`: `null` heißt zurücksetzen.

**Fehler** (`message` = Code, `hint` = Grund):

| SQLSTATE | message | hint |
|---|---|---|
| 28000 | `settings_not_authenticated` | – |
| 42501 | `team_forbidden` / `brand_edit_forbidden` (Rolle) | – |
| PT404 | `brand_not_found` (auch fremd) / `brand_alias_not_found` | – |
| PT402 | `team_access_<state>` | Zustand |
| 22023 | `brand_name_invalid` | `empty` / `too_long` / `characters` / `taken` |
| 22023 | `brand_alias_invalid` | `too_short` / `too_long` / `characters` / `generic` / `duplicate` / `collides` (dann auch, mit welcher Marke) |
| 22023 | `brand_alias_limit` | Grenze |
| 22023 | `brand_color_invalid` | – |
| PT429 | `brand_edit_rate_limited` | Sekunden |

Die Caches aus B3.7 leeren die Funktionen selbst. Protokolliert wird in `brand_activity_log`.

---

## Dazu bitte

1. die Antworten auf A1, A2, B1, B2 und B3, Befunde nach Schwere;
2. nach dem Bau eine Datei mit **echten, ungekürzten Antworten** (Team 877c, 7 Tage).
   - **Domain:**
     - `domain_detail_v1` für eine Domain mit Override, eine ohne, eine nie zitierte und die Domain der eigenen Marke;
     - Stats und URL-Share (Tag und Woche);
     - URLs und Responses mit `p_domain`;
     - jeder Override-Wechsel (own, competitor, `null`) mit Antwort.
   - **Editor:**
     - `brand_edit_v1` für die eigene Marke und einen Wettbewerber;
     - jede Schreibaktion einmal im Erfolg;
     - jede Fehlerform aus B4 einmal, inklusive Alias „a“, „the“, einer Kollision und Rolle `member`.
