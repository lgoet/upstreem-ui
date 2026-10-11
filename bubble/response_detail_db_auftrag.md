# Auftrag an den Datenbank-Chat: Response Detail als selbstladender Drawer (Stand 11.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig.

**Diese Runde ist eine BESTANDSAUFNAHME mit FEHLERSUCHE, MISSBRAUCHSPRÜFUNG und VORSCHLAG. Du
änderst nichts.** Vorbilder: die Seiten-Verträge (Settings v1 zuletzt) — dieselbe Bauart, dieselben
Regeln (`security definer`, fester `search_path`, kein anon, Nutzer aus `auth.uid()`, `{meta, row}`,
stabile Fehler-`message`, Ratenlimit, nichts außerhalb der Transaktion).

---

## 0. Worum es geht

Die Detail-Drawer der App werden Komponenten, die ihre Daten **selbst** holen (PostgREST,
`POST /rest/v1/rpc/<funktion>`, Schema `app`, Nutzer-JWT) statt über einen Bubble-Workflow. Der
erste ist **Response Detail**: eine einzelne KI-Antwort zu einem Prompt. Geöffnet wird er mit der
`prompt_run_id` aus vielen Stellen: Responses-Liste (Dashboard, Prompt Insights), Shopping
(„View Response“), Ads, Events, Mira-Belege, ein Link mit `?detail=response:<id>`.

Heute ruft Bubble `get_mention_detail_v8(p_prompt_run_id, p_team)` und reicht die Antwort durch.
v8 liefert ein Objekt **im Umschlag** `{"json": "<Text>"}`, dessen Backslashes für Bubble
verdoppelt sind. Für einen direkten Aufruf ist das der falsche Weg: die Seite müsste einen
JSON-Text in einem JSON auspacken und Backslashes zurückrechnen.

## 1. Was der Drawer zeigt (neues Layout)

| Teil | Felder heute aus v8 |
|---|---|
| Kopf | „Response / {Modell}, {Datum}“, Blitz (öffnet den Prompt: `prompt_id`), Schließen |
| Meta-Zeile | Modell (`model`, Anzeige über den Modell-Store), Markt (`market`, Flagge), Zeitpunkt (`run_at`) |
| Titel | `prompt_text` (vollständig) |
| Topics | `tags[]` (`id, name, emoji, hex_light, hex_dark`) |
| Brands mentioned | `companies[]` (`company_id, name, rank, sentiment, favicon_url, brand_name_raw`) — Zahl und je Marke eine Pill mit Logo, Klick öffnet den Brand-Drawer |
| Products | `shopping_products_count`, `shopping_products[]` |
| Ads | `ads[]` |
| Full response | `response_json.text` mit Zitat-Chips (`citations[]`), Markenauszeichnung (`companies[]`), Produkten im Text |
| Citations | `citations[]` (`url, title, domain, favicon, description, mentions[]{company_id, name, role, count, favicon_url}`) |

## 2. Bestandsaufnahme (bitte mit Definition und Beispiel)

1. `pg_get_functiondef('app.get_mention_detail_v8'::regproc)` und Rechte (anon, authenticated).
2. Woher kommen `companies[]`? Nur **getrackte** Marken des Teams (eigene und Wettbewerber), oder
   auch andere? Welche Reihenfolge (`rank`)? Ist die eigene Marke daran erkennbar?
3. `favicon_url` bei der **eigenen** Marke: Die Regel der App ist „Logo nur für die eigene Marke,
   Wettbewerber zeigen immer ihr Favicon“. Liefert v8 für die eigene Marke ihr Logo-Override?
4. `citations[].mentions[].role`: welche Werte (`own`, `competitor`, …)? Die Oberfläche braucht die
   Rolle für „Your brand only“ und den Marken-Filter der Quellen.
5. Laufzeit kalt/warm für eine lange Antwort (viele Quellen, Produkte, Ads) im Team 877c.
6. Ratenlimit (`mention_detail`): wie viele Aufrufe je Minute? Der Drawer kann beim schnellen
   Durchklicken einer Liste viele Aufrufe in Folge erzeugen.

## 3. Prüfung (Befund, Schwere, Vorschlag)

1. **Fremde Kennung:** `p_prompt_run_id` eines anderen Teams, mit eigenem `p_team` — kommt
   `mention_not_found`, ohne zu verraten, ob es den Lauf gibt? Und mit fremdem `p_team`?
2. **Inhalt aus dem Sprachmodell** (`response_json.text`, `citations[].title/description`,
   `shopping_products[].title/listing_title/merchant_name`, `ads[].title/description`): Das ist
   fremder Text. Die Oberfläche maskiert ihn; bitte trotzdem sagen, ob irgendwo HTML oder
   Steuerzeichen gespeichert werden, und ob es Grenzen der Länge gibt (größte Antwort im Bestand).
3. **Adressen** (`citations[].url`, `favicon`, `shopping_products[].image_url(s)`, `ads[].url`,
   Logos): nur `https://`? Was steht im Bestand an anderen Schemata (`http:`, `javascript:`,
   `data:`)? Die Oberfläche öffnet Links nur bei http(s) und zeigt Bilder nur bei https.
4. **Zugang:** v8 hat `require_team_access`. Ein Team ohne Zugang bekommt also keinen Drawer —
   gewollt? (Settings, Billing gehen ohne; eine einzelne Antwort ansehen eher nicht.)
5. **Kosten:** Holt v8 etwas außerhalb der Datenbank (Bilder, Favicons) oder schreibt beim Lesen?

## 4. Vorschlag (noch nicht bauen)

`response_detail_v1(p_team uuid, p_prompt_run_id uuid)` → `{meta, row}` als **reines jsonb, ohne
Umschlag und ohne verdoppelte Backslashes**:

- `meta`: `team_id`, `prompt_run_id`, `data_as_of`.
- `row`: alle Felder von v8 **unverändert** (die Oberfläche liest sie schon so), dazu:
  - `companies[].role` (`own` / `competitor`) und `companies[].logo_url` nach der Logo-Regel
    (eigene Marke: Logo-Override, sonst Favicon; Wettbewerber: Favicon);
  - `model_display_name` nur, falls die Tabelle der Modelle ihn hat (sonst nimmt die Oberfläche
    den Modell-Store).
- Fehler: `response_not_found` (PT404), `team_forbidden` (42501), `team_access_<state>` (PT402),
  `response_rate_limited` (PT429, hint Sekunden), `team_invalid_param` (22023, hint Feld).
- v8 bleibt, bis Bubble nichts mehr daraus liest.

Dazu bitte:
1. die Antworten auf Abschnitt 2 und 3, Befunde nach Schwere;
2. nach dem Bau eine Datei mit **echten, ungekürzten Antworten** von `response_detail_v1`
   (Team 877c, je eine Antwort von ChatGPT, Google AIO und Perplexity, eine mit Produkten und
   Ads, eine ohne Quellen) und jede Fehlerform einmal.
