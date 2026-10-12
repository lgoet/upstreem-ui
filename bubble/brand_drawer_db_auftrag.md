# Auftrag an den Datenbank-Chat: Brand-Drawer als selbstladender Drawer (Stand 12.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig.

**Diese Runde ist eine BESTANDSAUFNAHME mit FEHLERSUCHE, MISSBRAUCHSPRÜFUNG und VORSCHLAG. Du
änderst nichts.** Vorbild ist die letzte Runde (`prompt_detail_v1` mit `p_prompt_id` in den
Dashboard-RPCs). Dafür gelten dieselbe Bauart und dieselben Regeln:
- `security definer` mit festem `search_path`;
- kein anon;
- der Nutzer kommt aus `auth.uid()`;
- Antworten als `{meta, row}`;
- stabile Fehler-`message`;
- `_pi_rate_limit_v1`;
- nichts außerhalb der Transaktion.

---

## 0. Worum es geht

Nach Response, URL und Prompt wird der **Brand-Drawer** eine Komponente, die ihre Daten selbst holt.

- Er ist ein Drawer der ersten Ebene und wird mit der `company_id` geöffnet (`?detail=brand:<id>`).
- Geöffnet wird er aus Brands, dem Visibility Chart (Zeilenklick), Response Detail (Markenchips), Quick Actions, Mira und den Pins der Seitenleiste.

**Heute in Bubble:**
- **Kopf und Kennzahlen:** `get_company_detailed_overview_v4`.
- **Kurve:** `…chart_v4`, je Modus (Visibility, Rank, Sentiment) und Stufe (Tag, Woche, Monat).
- **Varianten:** ein eigener RPC.
- Der Drawer zeigt die Komponente Brand Detail (`brand-detail.js`). Ob Top Citations und Responses heute darin stehen, weißt du aus den Aufrufen.

## 1. Was der neue Drawer zeigt (Layout wie Prompt)

| Teil | Daten | RPC (Vorschlag) |
|---|---|---|
| Kopf | „Brand / {Name}“, Bearbeiten, Ask Mira, an die Seitenleiste heften, Schließen | `brand_detail_v1` (neu, siehe 4A) |
| Titel | Logo links, daneben Name, darunter Domain | `brand_detail_v1` |
| Filterzeile | Kalender, Modelle, Märkte, Topics | – |
| Brand Detail | Umschalter Visibility, Ranking, Sentiment, Variations. Dazu die große Zahl mit Delta, die Kurve mit Tag/Woche/Monat und die Variantenliste | Kennzahlen: `cached_dashboard_overview_v1` mit `p_companies = [id]`.<br>Kurve: `performance_company_chart_v1` mit `p_mode` und `p_granularity`.<br>Varianten: `performance_brand_variations_v1`. |
| Top Citations | Ring der Typen und Liste (Domains oder URLs) aus den Antworten, die diese Marke nennen | `cached_citations_overview_v1`, `_domains_v1`, `_urls_v1` mit `p_mentioned_brands = [id]` |
| Responses | die Antworten, die diese Marke nennen, mit Suche, Sortierung, Seiten und Filtern wie im Dashboard | `cached_dashboard_responses_v1` mit `p_brand = id` (neu, siehe 4B) |

Kurve und Varianten bekommen alle Filter der Zeile:
- Zeitraum: `p_date_from`, `p_date_to`;
- `p_models`, `p_markets`, `p_tag_ids`, `p_tagmode`;
- ohne `p_tag_ids` gilt das über alle Topics.

Laut deinem Vertrag A (4.2/4.3) kennen beide RPCs das schon, und die Kurve kennt `rank` und `sentiment`. Bitte bestätigen (siehe 2.3).

## 2. Bestandsaufnahme (bitte mit Definition und Beispiel)

1. `get_company_detailed_overview_v4` und `…chart_v4`: Definition, Parameter, Rechte, Ausgabeform.
   Was liefern sie, und was davon braucht der Kopf? Gibt es Felder, die der neue Weg verlieren würde?
2. **Welche RPCs füllt Bubble heute im Brand-Drawer**, mit welchen Parametern
   (`pg_stat_statements`, Aufrufe mit einer `company_id`)? Gibt es dort Top Citations oder Responses?
3. **Performance v1 für eine Marke über alle Topics:**
   - Stimmt `performance_company_chart_v1(p_team, p_company, p_mode 'rank'|'sentiment', p_granularity 'week'|'month', p_tag_ids null)` für 30 Tage mit den Zahlen von heute (`…chart_v4`) überein? Dasselbe für `performance_brand_variations_v1` gegen den heutigen Varianten-RPC.
   - Was liefert die Kurve bei `sentiment` an Tagen ohne Erwähnung: `null` oder 0?
4. **Kennzahlen:** Liefert `cached_dashboard_overview_v1(p_companies = [id], p_limit 1)` dieselben
   Werte wie `get_company_detailed_overview_v4` (Visibility, Rang, Sentiment, jeweils `_prev` und `_delta`)?
   Ist die eigene Marke dann in `rows` oder nur in `own`?
5. **Domain und Logo:**
   - Woher kommen Domain und Logo der Marke? Gibt es pro Team einen Anzeigenamen (`display_name`)?
   - Logo-Regel wie überall: Logo-Override nur für die eigene Marke, Wettbewerber immer Favicon.
6. **Responses:** `p_company_ids` heißt „nennt mindestens eine davon“ und gehört dem Markenfilter
   der Tabelle. Der Drawer braucht ein festes „nennt diese Marke“ **zusätzlich**, sonst überschreibt
   der Filter der Tabelle den Drawer. Gibt es so etwas schon?
7. Laufzeiten kalt und warm (877c) für die eigene Marke und für einen großen Wettbewerber. Wie ist das Ratenlimit heute?

## 3. Prüfung (Befund, Schwere, Vorschlag)

1. **Fremde Kennung:** Was passiert mit der `company_id` einer Marke, die nicht zum Team gehört, bei eigenem `p_team`? Kommt „nicht gefunden“, ohne zu verraten, ob es die Firma gibt (vgl. F6 aus der Brands-Runde: `get_company_edit_v2` verriet globale Daten)? Was passiert bei fremdem `p_team`?
2. **Inaktive Marken:**
   - Ein alter Pin kann auf eine Marke zeigen, die das Team deaktiviert hat (Archiv, nicht mehr in `team_company`). Was liefern die heutigen RPCs, was sollen die neuen liefern?
   - Vorschlag: `brand_detail_v1` liefert sie mit `status: 'inactive'`, die Zahlenteile liefern leer. Der Drawer zeigt dann einen Hinweis statt Nullen.
3. **Fremder Text:** Markenname und Domain sind Nutzertext (Anzeigename, Alias). Wie lang dürfen sie werden, und sind Steuerzeichen möglich? Ist das Logo nur `http(s)` (vgl. H6: `javascript:` als Logo)?
4. **Zugang:** wie Prompt (`team_access_<state>`)?
5. **Kosten:** Schreibt einer der alten RPCs beim Lesen? Liegen Kurve und Varianten im Cache, und mit welchem Schlüssel?

## 4. Vorschlag (noch nicht bauen)

**A. `brand_detail_v1(p_team uuid, p_company uuid)`** → `{meta, row}` als reines jsonb:
- `meta`: `team_id`, `company_id`, `data_as_of`.
- `row`:
  - `company_id`, `name` (Anzeigename des Teams, sonst der globale);
  - `domain` (ohne Schema, ohne `www.`);
  - `logo_url` (nach der Logo-Regel, nur `http(s)`) und `favicon_url`;
  - `role` (`own` | `competitor`) und `status` (`active` | `inactive`);
  - `color` (Markenfarbe des Teams oder `null`);
  - `tracked_since` (Beginn der laufenden Periode);
  - alles, was der Kopf aus 2.1 sonst Sinnvolles hat.
- Fehler:
  - `brand_not_found` (PT404), auch bei fremder Marke;
  - `team_forbidden` (42501), `team_deleted` (PT404), `team_access_<state>` (PT402);
  - `brand_rate_limited` (PT429, hint Sekunden);
  - `team_invalid_param` (22023, hint Feld), `settings_not_authenticated` (28000).

**B. `p_brand uuid default null` in `cached_dashboard_responses_v1` und `export_responses_v1`.** Er hat dieselbe Bauart wie `p_url` und `p_prompt_id`:
- immer der letzte, optionale Parameter;
- Bedeutung: „die Antwort nennt diese Marke“, **UND** mit `p_company_ids`;
- der Cache-Schlüssel enthält ihn;
- `meta.filters.brand` gesetzt.

**C. Export der Citations im Drawer:** Die Export-Nutzlast bekommt `brand_id`. Bubble reicht es weiter:
- als `p_mentioned_brands = [brand_id]` an die Domain- und URL-Exporte;
- als `p_brand` an `export_responses_v1`.

Kennen die Domain- und URL-Exporte `p_mentioned_brands`?

**D. Prüfe bitte:**
- Passt `total_count` der Responses mit `p_brand` zur Zahl der Läufe, in denen die Marke genannt wird? Das ist dieselbe Zahl wie `mentions` in der Overview.
- Passt `runs_with_any` bzw. die Summe im Ring der Citations mit `p_mentioned_brands` dazu?

`get_company_detailed_overview_v4` und `…chart_v4` bleiben, bis Bubble nichts mehr daraus liest.

Dazu bitte:
1. die Antworten auf Abschnitt 2 und 3, Befunde nach Schwere;
2. nach dem Bau eine Datei mit **echten, ungekürzten Antworten** (Team 877c, 7 Tage), jeweils für die eigene Marke und einen großen Wettbewerber:
   - `brand_detail_v1`;
   - Overview mit `p_companies`;
   - Kurve in allen drei Modi (Tag) und einmal Woche;
   - Varianten;
   - Citations: Overview Domain und URL, Domains, URLs;
   - Responses mit `p_brand`, erste Seite und mit Suche;
   - Export;
   - dazu eine inaktive Marke, eine Marke ohne Erwähnung im Zeitraum und jede Fehlerform einmal.
