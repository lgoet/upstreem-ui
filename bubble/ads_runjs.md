# Ads: Workflows und Run-JS-Schritte (Stand 05.10.)

Hausform nach CLAUDE.md 2a: ein Backtick je Ausdruck, beide Ersetzungen, `window.<name>`, je ein
`try`. Zu jedem Schritt die **statische Fassung mit den echten Rohantworten** aus `ads_expected/`
(Uebergabe 05.10., woertlich) zum Testen ohne RPC. Die Instanz heisst ueberall `ads_page` (Vorlage:
`bubble/ads_bubble.html`). Alle sechs statischen Fassungen sind am 05.10. gegen die Komponente
gelaufen (Pruefstand, 0 Fehler): Kennzahlen 11.4% / 6 / 81 / 13, Advertiser HOLY 28 Auftritte,
`Herbst HOLY "Sale"` im Drawer genau so.

## 0. Einmal einrichten

**Sechs Elemente "JavaScript to Bubble"** auf der Seite (z.B. in der Gruppe `view-ads`), je mit
*Trigger event* an, *Publish value* an, Typ **text**:

| Element (Name)         | Attribut am Wurzel-Div                              | RPC (Schema `app`)             | Setter                   |
|------------------------|-----------------------------------------------------|--------------------------------|--------------------------|
| `adsOverview`          | `data-overview-fn="bubble_fn_adsOverview"`          | `get_ads_overview_v1`          | `setAdsOverview`         |
| `adsAdvertisers`       | `data-advertisers-fn="bubble_fn_adsAdvertisers"`    | `list_ads_advertisers_v1`      | `setAdsAdvertisers`      |
| `adsAdvertiserDetail`  | `data-advertiser-fn="bubble_fn_adsAdvertiserDetail"`| `get_ads_advertiser_detail_v1` | `setAdsAdvertiserDetail` |
| `adsLibrary`           | `data-library-fn="bubble_fn_adsLibrary"`            | `list_ads_library_v1`          | `setAdsLibrary`          |
| `adsPrompts`           | `data-prompts-fn="bubble_fn_adsPrompts"`            | `list_ads_prompts_v1`          | `setAdsPrompts`          |
| `adsFilterOptions`     | `data-options-fn="bubble_fn_adsFilterOptions"`      | `get_ads_filter_options_v1`    | `setAdsFilterOptions`    |

Optional ein siebtes, `view_first_ads`, ohne Workflow: showView ruft es beim ersten Oeffnen der
Ansicht, ohne das Element steht dafuer eine Warnung in der Konsole. Ads laedt seine Daten selbst.

**API Connector, sechs Calls** -- eingerichtet wie die Shopping-Calls (derselbe Supabase-Server,
dieselben Header, Schema `app`, Nutzer-JWT), je:

- Methode **POST**, Pfad `rest/v1/rpc/<RPC aus der Tabelle>`
- Body-Typ JSON, Body genau `<body>` -- ein Parameter mit dem Schluessel **`body`**
- **"Include errors in response and allow workflow actions to continue" an.** Dann gibt es
  `Result of step 1's error body`, und der Workflow laeuft bei einem Fehler weiter in Schritt 2.
- Antwort: jede RPC liefert **eine Zeile mit einer Spalte `json`** (Vertrag Abschnitt 2), PostgREST
  also `[{"json": "..."}]` -- eine Liste mit einem Eintrag. In Bubble heisst das Feld darum
  **`Result of step 1:first item's json`** (Text). Es geht unveraendert in den Backtick. Zum
  Initialisieren den Beispiel-Body des jeweiligen Abschnitts unten einsetzen.

Jedes Ereignis traegt den FERTIGEN Body als Text: `p_team_id` und alle Filter schon drin (Zeitraum,
Modelle, Maerkte, Topics, Advertiser, Formate), nicht gesetzte Werte als `null`, dazu die Parameter
der RPC. Nichts davon in Bubble zusammensetzen.

**Was die Komponente in Bubble NICHT braucht:** keinen Seitenaufbau-Schritt, kein "Only when", keinen
Lade-Setter, keinen zweiten Aufruf zum Blaettern, kein Drawer-Element fuer das Ad Detail.

**Empfohlen fuer die RPCs (DB, nicht noetig fuer den Start):** der Text in `json` geht roh in ein
Backtick. Drei Dinge sind darin gefaehrlich (CLAUDE.md 2a): ein Backtick und ein `${` in einem Wert
toeten den ganzen Schritt (gemessen: "x is not defined", danach greift nach 25s die Warte-Uhr der
Komponente), und ein Backslash geht verloren (gemessen: `C:\Daten` kommt als `C:Daten` an; `\"` und
`\n` repariert core). Wie bei den Events am Ende jeder Ads-RPC:

```sql
-- t = der fertige JSON-Text
return query select replace(replace(replace(t, chr(92), chr(92) || chr(92)), chr(96), ''), '${', '$ {');
```

Kommt das so, bleibt der Schritt unten wie er ist; die statischen Fassungen hier enthalten dann
genau denselben Text wie die RPC.

---
## 1. Overview: `adsOverview` → `get_ads_overview_v1` → `setAdsOverview`

Ein Aufruf je Zeitraum und Filterstand. Kennzahlen, Ad Coverage je Tag, Advertiser Share (Top 10), Topics und die sechs neuesten Ads.

**Body, wie er kommt** (Kalender "Last 7 Days", ohne Filter):

```json
{"p_team_id":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-29","p_date_to":"2026-10-05","p_models":null,"p_markets":null,"p_topic_ids":null,"p_advertisers":null,"p_ad_formats":null}
```

**Body** (Topic "Hydration" aus "Topics with Ads", Advertiser HOLY in der Ad Library gewaehlt):

```json
{"p_team_id":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-29","p_date_to":"2026-10-05","p_models":null,"p_markets":null,"p_topic_ids":["e1f2a3b4-0000-4000-8000-000000000004"],"p_advertisers":["HOLY"],"p_ad_formats":null}
```

**Workflow:** *When `adsOverview` event* →

- **Schritt 1:** API Connector `get_ads_overview_v1`, Parameter `body` = *This JavascriptToBubble's value*.
- **Schritt 2:** Run javascript, OHNE "Only when":

```javascript
(function () {
  var ROH = `[Result of step 1:first item's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setAdsOverview) window.setAdsOverview("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch zum Testen** (die echte Rohantwort, Backslashes verdoppelt, damit nach dem Backtick genau der Text der RPC steht; erst ausfuehren, wenn die Ads-Ansicht offen ist):

```javascript
(function () {
  var ROH = `{"kpis": {"advertisers": 6, "ad_appearances": 81, "ad_coverage_pct": 11.40, "tracked_prompts": 14, "prompts_with_ads": 13}, "trend": [{"date": "2026-09-22", "total_runs": 28, "runs_with_ads": 8, "ad_appearances": 16, "ad_coverage_pct": 28.57}, {"date": "2026-09-23", "total_runs": 28, "runs_with_ads": 3, "ad_appearances": 6, "ad_coverage_pct": 10.71}, {"date": "2026-09-24", "total_runs": 28, "runs_with_ads": 2, "ad_appearances": 4, "ad_coverage_pct": 7.14}, {"date": "2026-09-25", "total_runs": 28, "runs_with_ads": 3, "ad_appearances": 4, "ad_coverage_pct": 10.71}, {"date": "2026-09-26", "total_runs": 28, "runs_with_ads": 3, "ad_appearances": 4, "ad_coverage_pct": 10.71}, {"date": "2026-09-27", "total_runs": 28, "runs_with_ads": 4, "ad_appearances": 7, "ad_coverage_pct": 14.29}, {"date": "2026-09-28", "total_runs": 28, "runs_with_ads": 1, "ad_appearances": 2, "ad_coverage_pct": 3.57}, {"date": "2026-09-29", "total_runs": 28, "runs_with_ads": 3, "ad_appearances": 6, "ad_coverage_pct": 10.71}, {"date": "2026-09-30", "total_runs": 22, "runs_with_ads": 0, "ad_appearances": 0, "ad_coverage_pct": 0.00}, {"date": "2026-10-01", "total_runs": 28, "runs_with_ads": 3, "ad_appearances": 5, "ad_coverage_pct": 10.71}, {"date": "2026-10-02", "total_runs": 28, "runs_with_ads": 2, "ad_appearances": 4, "ad_coverage_pct": 7.14}, {"date": "2026-10-03", "total_runs": 28, "runs_with_ads": 2, "ad_appearances": 4, "ad_coverage_pct": 7.14}, {"date": "2026-10-04", "total_runs": 28, "runs_with_ads": 5, "ad_appearances": 12, "ad_coverage_pct": 17.86}, {"date": "2026-10-05", "total_runs": 28, "runs_with_ads": 5, "ad_appearances": 7, "ad_coverage_pct": 17.86}], "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration", "ad_appearances": 33, "ad_coverage_pct": 15.45, "advertiser_count": 6}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks", "ad_appearances": 28, "ad_coverage_pct": 10.87, "advertiser_count": 6}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte", "ad_appearances": 25, "ad_coverage_pct": 12.73, "advertiser_count": 6}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000003", "topic_name": "Sportnahrung", "ad_appearances": 21, "ad_coverage_pct": 9.42, "advertiser_count": 6}], "recent_ads": [{"id": "84401c20-9156-4641-a3bb-b43aef4509bf", "url": "https://www.morenutrition.de/angebot?utm_source=chatgpt", "ad_id": "4837", "model": "chatgpt", "price": null, "title": "More Nutrition Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/137.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000003", "company_id": "8a1f4f0b-39af-413d-a165-79aa18da816a", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-137", "campaign_id": "90071992547401037", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T14:37:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind gut", "utm_content": "banner", "utm_campaign": null, "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000565", "landing_domain": "morenutrition.de", "advertiser_name": "More Nutrition"}, {"id": "2805cab2-a511-4457-9fe2-3aea953cf897", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": 29.99, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": "u135", "currency": "EUR", "utm_term": null, "ad_format": "product_card_v2", "image_url": "https://cdn.example/ads/135.jpg", "price_str": "29,99 €", "prompt_id": "c0a80101-0000-4000-8000-000000000011", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-135", "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T14:27:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": "banner", "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000581", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "1c10ef36-d32b-4735-a2fe-d1fbc47360f6", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4836", "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte Probierset", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": "u136", "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/136.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000011", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-136", "campaign_id": "90071992547401036", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T14:27:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": null, "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": null, "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000581", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "bf9e907d-a287-461f-ad91-6c3234c70539", "url": "https://www.morenutrition.de/angebot?utm_source=chatgpt", "ad_id": "4833", "model": "chatgpt", "price": null, "title": "More Nutrition Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/133.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000012", "company_id": "8a1f4f0b-39af-413d-a165-79aa18da816a", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-133", "campaign_id": "90071992547401033", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T12:40:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": null, "utm_campaign": null, "ad_account_id": null, "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000583", "landing_domain": "morenutrition.de", "advertiser_name": "More Nutrition"}, {"id": "6f5c903c-e884-4694-9f46-f762fb64dac5", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4834", "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/134.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000012", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-134", "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T12:40:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": null, "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000583", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "9b80d49a-886f-423d-b400-7777ed43f0e1", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte Probierset", "market": "AT", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000003", "topic_name": "Sportnahrung"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/132.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000014", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": null, "campaign_id": "90071992547401032", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T11:38:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind guenstig", "utm_content": "banner", "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000587", "landing_domain": "holy.com", "advertiser_name": "HOLY"}], "advertiser_share": [{"company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "ad_share_pct": 34.57, "ad_appearances": 28, "advertiser_name": "HOLY"}, {"company_id": "8a1f4f0b-39af-413d-a165-79aa18da816a", "ad_share_pct": 30.86, "ad_appearances": 25, "advertiser_name": "More Nutrition"}, {"company_id": null, "ad_share_pct": 11.11, "ad_appearances": 9, "advertiser_name": "MyProtein"}, {"company_id": null, "ad_share_pct": 8.64, "ad_appearances": 7, "advertiser_name": "Amazon"}, {"company_id": "5c282ab4-4af1-4a7d-ab36-9a5e25e7767d", "ad_share_pct": 8.64, "ad_appearances": 7, "advertiser_name": "Waterdrop"}, {"company_id": null, "ad_share_pct": 6.17, "ad_appearances": 5, "advertiser_name": "Rossmann"}]}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = ``;
  try { if (window.setAdsOverview) window.setAdsOverview("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

---

## 2. Advertisers: `adsAdvertisers` → `list_ads_advertisers_v1` → `setAdsAdvertisers`

Der Reiter Advertisers: Suche, Sortierung (Spaltenkoepfe) und Blaettern feuern das Ereignis mit dem neuen Body. `p_sort` ist immer einer der sieben Werte des Vertrags.

**Body, wie er kommt** (Vorgabe: 15 Zeilen, nach Auftritten):

```json
{"p_team_id":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-29","p_date_to":"2026-10-05","p_models":null,"p_markets":null,"p_topic_ids":null,"p_advertisers":null,"p_ad_formats":null,"p_search":null,"p_limit":15,"p_offset":0,"p_sort":"ad_appearances_desc"}
```

**Body** (Suche "nutri", Seite 2, nach Name):

```json
{"p_team_id":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-29","p_date_to":"2026-10-05","p_models":null,"p_markets":null,"p_topic_ids":null,"p_advertisers":null,"p_ad_formats":null,"p_search":"nutri","p_limit":15,"p_offset":15,"p_sort":"advertiser_name_asc"}
```

**Workflow:** *When `adsAdvertisers` event* →

- **Schritt 1:** API Connector `list_ads_advertisers_v1`, Parameter `body` = *This JavascriptToBubble's value*.
- **Schritt 2:** Run javascript, OHNE "Only when":

```javascript
(function () {
  var ROH = `[Result of step 1:first item's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setAdsAdvertisers) window.setAdsAdvertisers("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch zum Testen** (die echte Rohantwort, Backslashes verdoppelt, damit nach dem Backtick genau der Text der RPC steht; erst ausfuehren, wenn die Ads-Ansicht offen ist):

```javascript
(function () {
  var ROH = `{"items": [{"markets": ["AT", "DE"], "logo_url": "https://www.google.com/s2/favicons?domain=holy.com", "last_seen": "2026-10-05T14:27:00+00:00", "ad_formats": ["image_card_v2", "product_card_v2"], "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "first_seen": "2026-09-22T07:48:00+00:00", "topic_count": 4, "ad_share_pct": 34.57, "prompt_count": 12, "relationship": "you", "ad_appearances": 28, "advertiser_name": "HOLY"}, {"markets": ["DE"], "logo_url": "https://www.google.com/s2/favicons?domain=morenutrition.de", "last_seen": "2026-10-05T14:37:00+00:00", "ad_formats": ["image_card_v2", "product_card_v2"], "company_id": "8a1f4f0b-39af-413d-a165-79aa18da816a", "first_seen": "2026-09-22T07:48:00+00:00", "topic_count": 4, "ad_share_pct": 30.86, "prompt_count": 11, "relationship": "competitor", "ad_appearances": 25, "advertiser_name": "More Nutrition"}, {"markets": ["AT", "DE"], "logo_url": null, "last_seen": "2026-10-05T10:28:00+00:00", "ad_formats": ["image_card_v2", "product_card_v2"], "company_id": null, "first_seen": "2026-09-22T10:30:00+00:00", "topic_count": 4, "ad_share_pct": 11.11, "prompt_count": 6, "relationship": null, "ad_appearances": 9, "advertiser_name": "MyProtein"}], "limit": 3, "offset": 0, "total_count": 6}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = ``;
  try { if (window.setAdsAdvertisers) window.setAdsAdvertisers("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

---

## 3. Advertiser Detail: `adsAdvertiserDetail` → `get_ads_advertiser_detail_v1` → `setAdsAdvertiserDetail`

Ein Klick auf einen Advertiser (Tabelle, Balken der Overview, Advertiser im Drawer). `p_advertiser_name` ist der Name, wie er in den Daten steht. `p_advertisers` geht mit, die RPC ignoriert ihn hier (Vertrag).

**Body, wie er kommt**:

```json
{"p_team_id":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-29","p_date_to":"2026-10-05","p_models":null,"p_markets":null,"p_topic_ids":null,"p_advertisers":null,"p_ad_formats":null,"p_advertiser_name":"HOLY"}
```

**Workflow:** *When `adsAdvertiserDetail` event* →

- **Schritt 1:** API Connector `get_ads_advertiser_detail_v1`, Parameter `body` = *This JavascriptToBubble's value*.
- **Schritt 2:** Run javascript, OHNE "Only when":

```javascript
(function () {
  var ROH = `[Result of step 1:first item's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setAdsAdvertiserDetail) window.setAdsAdvertiserDetail("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch zum Testen** (die echte Rohantwort, Backslashes verdoppelt, damit nach dem Backtick genau der Text der RPC steht; erst ausfuehren, wenn die Ads-Ansicht offen ist):

```javascript
(function () {
  var ROH = `{"ads": [{"id": "2805cab2-a511-4457-9fe2-3aea953cf897", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": 29.99, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": "u135", "currency": "EUR", "utm_term": null, "ad_format": "product_card_v2", "image_url": "https://cdn.example/ads/135.jpg", "price_str": "29,99 €", "prompt_id": "c0a80101-0000-4000-8000-000000000011", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-135", "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T14:27:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": "banner", "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000581", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "1c10ef36-d32b-4735-a2fe-d1fbc47360f6", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4836", "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte Probierset", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": "u136", "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/136.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000011", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-136", "campaign_id": "90071992547401036", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T14:27:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": null, "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": null, "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000581", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "6f5c903c-e884-4694-9f46-f762fb64dac5", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4834", "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/134.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000012", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-134", "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T12:40:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": null, "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000583", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "9b80d49a-886f-423d-b400-7777ed43f0e1", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte Probierset", "market": "AT", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000003", "topic_name": "Sportnahrung"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/132.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000014", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": null, "campaign_id": "90071992547401032", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T11:38:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind guenstig", "utm_content": "banner", "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000587", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "e7dedb13-57dc-4915-8460-5e36ade66d5a", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4827", "model": "chatgpt", "price": 14.99, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}], "utm_id": null, "currency": "EUR", "utm_term": null, "ad_format": "product_card_v2", "image_url": "https://cdn.example/ads/127.jpg", "price_str": "14,99 €", "prompt_id": "c0a80101-0000-4000-8000-000000000005", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-127", "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-04T11:32:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind \\"empfehlenswert\\"", "utm_content": null, "utm_campaign": null, "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000541", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "97293691-fa27-4bd5-95bf-7833d1bf9de3", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4824", "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte Probierset", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}], "utm_id": "u124", "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/124.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000012", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-124", "campaign_id": "90071992547401024", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-04T07:40:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": "banner", "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000555", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "01400177-70f6-4219-8533-4fe9d6b22357", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4821", "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": "u121", "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/121.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000011", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": null, "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-04T06:04:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": null, "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000553", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "368bf39e-9339-40d2-a22b-f593d5e8ac67", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000003", "topic_name": "Sportnahrung"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/113.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000010", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-113", "campaign_id": "90071992547401013", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-02T17:56:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind vegan", "utm_content": null, "utm_campaign": null, "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000495", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "c5b4a861-aa19-490c-9e6e-785bd41034b8", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}], "utm_id": "u111", "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/111.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000004", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-111", "campaign_id": "90071992547401011", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-02T11:24:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind vegan", "utm_content": "banner", "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000483", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "46a60353-fd09-46a6-9aa0-07d41e5b6865", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4810", "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/110.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000011", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-110", "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-01T17:28:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": "banner", "utm_campaign": null, "ad_account_id": null, "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000469", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "1e3194c6-c502-402b-904d-0d680dea5bbd", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4806", "model": "chatgpt", "price": 25.99, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": null, "currency": "EUR", "utm_term": null, "ad_format": "product_card_v2", "image_url": "https://cdn.example/ads/106.jpg", "price_str": "25,99 €", "prompt_id": "c0a80101-0000-4000-8000-000000000007", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": null, "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-01T10:54:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind ohne Zucker", "utm_content": "banner", "utm_campaign": null, "ad_account_id": null, "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000461", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "25310d6b-ad08-4aac-811d-bfe3369a39db", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte Probierset", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/108.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000007", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": null, "campaign_id": "90071992547401008", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-01T10:54:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind ohne Zucker", "utm_content": null, "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000461", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "f2ce8e4e-1f66-408b-9e8f-e5da7fd2e08a", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte Probierset", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}], "utm_id": "u96", "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/96.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000001", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-96", "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-09-29T16:43:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Sport", "utm_content": "banner", "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000393", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "da957579-f435-44b1-8635-25be93228704", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}], "utm_id": "u97", "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/97.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000001", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-97", "campaign_id": "9007199254740997", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-09-29T16:43:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Sport", "utm_content": null, "utm_campaign": null, "ad_account_id": null, "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000393", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "ff944406-5a3d-46f5-b664-63376fc8abb3", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4787", "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/87.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000007", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": null, "campaign_id": "9007199254740987", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-09-27T14:00:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind ohne Zucker", "utm_content": null, "utm_campaign": null, "ad_account_id": null, "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000349", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "a9cacf04-a4e2-43ea-b332-106527aa1524", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4785", "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": "u85", "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/85.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000011", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-85", "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-09-27T09:18:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": null, "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000357", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "4c3dc784-9cf2-4a87-89db-b464f20409f8", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000003", "topic_name": "Sportnahrung"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/83.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000006", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-83", "campaign_id": "9007199254740983", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-09-27T06:54:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind vegan", "utm_content": null, "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000347", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "eb1101ea-d733-4637-a2fb-a05bb4cd1d99", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": 36.99, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000003", "topic_name": "Sportnahrung"}], "utm_id": null, "currency": "EUR", "utm_term": null, "ad_format": "product_card_v2", "image_url": "https://cdn.example/ads/79.jpg", "price_str": "36,99 €", "prompt_id": "c0a80101-0000-4000-8000-000000000010", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-79", "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-09-26T08:13:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind vegan", "utm_content": null, "utm_campaign": null, "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000327", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "3164925c-6c79-4a65-a8e4-8fa8dbc6e4e4", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4774", "model": "chatgpt", "price": 18.99, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}], "utm_id": null, "currency": "EUR", "utm_term": null, "ad_format": "product_card_v2", "image_url": "https://cdn.example/ads/74.jpg", "price_str": "18,99 €", "prompt_id": "c0a80101-0000-4000-8000-000000000012", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": null, "campaign_id": "9007199254740974", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-09-24T14:25:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": "banner", "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000275", "landing_domain": "holy.com", "advertiser_name": "HOLY"}, {"id": "c46aa3bd-ae93-4850-9fc2-727479eedce6", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": "4773", "model": "chatgpt", "price": null, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/73.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000003", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-73", "campaign_id": "9007199254740973", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-09-24T11:49:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind gut", "utm_content": null, "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000257", "landing_domain": "holy.com", "advertiser_name": "HOLY"}], "trend": [{"date": "2026-09-22", "ad_share_pct": 31.25, "ad_appearances": 5}, {"date": "2026-09-23", "ad_share_pct": 50.00, "ad_appearances": 3}, {"date": "2026-09-24", "ad_share_pct": 50.00, "ad_appearances": 2}, {"date": "2026-09-25", "ad_share_pct": 0.00, "ad_appearances": 0}, {"date": "2026-09-26", "ad_share_pct": 25.00, "ad_appearances": 1}, {"date": "2026-09-27", "ad_share_pct": 42.86, "ad_appearances": 3}, {"date": "2026-09-28", "ad_share_pct": 0.00, "ad_appearances": 0}, {"date": "2026-09-29", "ad_share_pct": 33.33, "ad_appearances": 2}, {"date": "2026-09-30", "ad_share_pct": null, "ad_appearances": 0}, {"date": "2026-10-01", "ad_share_pct": 60.00, "ad_appearances": 3}, {"date": "2026-10-02", "ad_share_pct": 50.00, "ad_appearances": 2}, {"date": "2026-10-03", "ad_share_pct": 0.00, "ad_appearances": 0}, {"date": "2026-10-04", "ad_share_pct": 25.00, "ad_appearances": 3}, {"date": "2026-10-05", "ad_share_pct": 57.14, "ad_appearances": 4}], "prompts": [{"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "last_seen": "2026-10-05T14:27:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000011", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "ad_appearances": 6, "organic_mentioned": true, "organic_visibility_pct": 60.71}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "last_seen": "2026-10-01T10:54:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000007", "prompt_text": "Welche Elektrolyt-Pulver sind ohne Zucker", "ad_appearances": 4, "organic_mentioned": true, "organic_visibility_pct": 21.43}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}], "last_seen": "2026-10-05T12:40:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000012", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "ad_appearances": 3, "organic_mentioned": true, "organic_visibility_pct": 42.86}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}], "last_seen": "2026-09-29T16:43:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000001", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Sport", "ad_appearances": 3, "organic_mentioned": true, "organic_visibility_pct": 29.63}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000003", "topic_name": "Sportnahrung"}], "last_seen": "2026-10-05T11:38:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000014", "prompt_text": "Welche Elektrolyt-Pulver sind guenstig", "ad_appearances": 2, "organic_mentioned": true, "organic_visibility_pct": 28.57}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000003", "topic_name": "Sportnahrung"}], "last_seen": "2026-10-02T17:56:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000010", "prompt_text": "Welche Elektrolyt-Pulver sind vegan", "ad_appearances": 2, "organic_mentioned": true, "organic_visibility_pct": 39.29}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}], "last_seen": "2026-09-22T14:08:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000008", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Sport", "ad_appearances": 2, "organic_mentioned": true, "organic_visibility_pct": 17.86}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000003", "topic_name": "Sportnahrung"}], "last_seen": "2026-09-22T10:39:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000009", "prompt_text": "Welche Elektrolyt-Pulver sind \\"empfehlenswert\\"", "ad_appearances": 2, "organic_mentioned": true, "organic_visibility_pct": 39.29}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000002", "topic_name": "Energy Drinks"}], "last_seen": "2026-10-04T11:32:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000005", "prompt_text": "Welche Elektrolyt-Pulver sind \\"empfehlenswert\\"", "ad_appearances": 1, "organic_mentioned": true, "organic_visibility_pct": 29.63}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}], "last_seen": "2026-10-02T11:24:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000004", "prompt_text": "Welche Elektrolyt-Pulver sind vegan", "ad_appearances": 1, "organic_mentioned": true, "organic_visibility_pct": 33.33}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000003", "topic_name": "Sportnahrung"}], "last_seen": "2026-09-27T06:54:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000006", "prompt_text": "Welche Elektrolyt-Pulver sind vegan", "ad_appearances": 1, "organic_mentioned": true, "organic_visibility_pct": 40.74}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "last_seen": "2026-09-24T11:49:00+00:00", "prompt_id": "c0a80101-0000-4000-8000-000000000003", "prompt_text": "Welche Elektrolyt-Pulver sind gut", "ad_appearances": 1, "organic_mentioned": true, "organic_visibility_pct": 33.33}], "summary": {"topic_count": 4, "ad_share_pct": 34.57, "prompt_count": 12, "ad_appearances": 28}, "advertiser": {"logo_url": "https://www.google.com/s2/favicons?domain=holy.com", "last_seen": "2026-10-05T14:27:00+00:00", "ad_formats": ["image_card_v2", "product_card_v2"], "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "first_seen": "2026-09-22T07:48:00+00:00", "relationship": "you", "advertiser_name": "HOLY", "landing_domains": ["holy.com"]}}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = ``;
  try { if (window.setAdsAdvertiserDetail) window.setAdsAdvertiserDetail("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

---

## 4. Ad Library: `adsLibrary` → `list_ads_library_v1` → `setAdsLibrary`

Die Ad Library im Modus Ads (Raster und Liste). Dieselbe RPC holt beim Aufklappen eines Prompts im Modus Prompts dessen Ads: Suche = Prompttext, 100 Zeilen; die Komponente filtert danach auf `prompt_id` (die RPC kennt keinen Prompt-Filter).

**Body, wie er kommt** (Vorgabe: 25 je Seite):

```json
{"p_team_id":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-29","p_date_to":"2026-10-05","p_models":null,"p_markets":null,"p_topic_ids":null,"p_advertisers":null,"p_ad_formats":null,"p_search":null,"p_limit":25,"p_offset":0}
```

**Body** (Advertisers HOLY und MyProtein, Format Product Ad, Suche "sale"):

```json
{"p_team_id":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-29","p_date_to":"2026-10-05","p_models":null,"p_markets":null,"p_topic_ids":null,"p_advertisers":["HOLY","MyProtein"],"p_ad_formats":["product_card_v2"],"p_search":"sale","p_limit":25,"p_offset":0}
```

**Body** (aufgeklappter Prompt):

```json
{"p_team_id":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-29","p_date_to":"2026-10-05","p_models":null,"p_markets":null,"p_topic_ids":null,"p_advertisers":null,"p_ad_formats":null,"p_search":"Welche Elektrolyt-Pulver sind fuer Kinder","p_limit":100,"p_offset":0}
```

**Workflow:** *When `adsLibrary` event* →

- **Schritt 1:** API Connector `list_ads_library_v1`, Parameter `body` = *This JavascriptToBubble's value*.
- **Schritt 2:** Run javascript, OHNE "Only when":

```javascript
(function () {
  var ROH = `[Result of step 1:first item's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setAdsLibrary) window.setAdsLibrary("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch zum Testen** (die echte Rohantwort, Backslashes verdoppelt, damit nach dem Backtick genau der Text der RPC steht; erst ausfuehren, wenn die Ads-Ansicht offen ist):

```javascript
(function () {
  var ROH = `{"items": [{"id": "84401c20-9156-4641-a3bb-b43aef4509bf", "url": "https://www.morenutrition.de/angebot?utm_source=chatgpt", "ad_id": "4837", "model": "chatgpt", "price": null, "title": "More Nutrition Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": null, "currency": null, "utm_term": null, "ad_format": "image_card_v2", "image_url": "https://cdn.example/ads/137.jpg", "price_str": null, "prompt_id": "c0a80101-0000-4000-8000-000000000003", "company_id": "8a1f4f0b-39af-413d-a165-79aa18da816a", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-137", "campaign_id": "90071992547401037", "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T14:37:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind gut", "utm_content": "banner", "utm_campaign": null, "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000565", "landing_domain": "morenutrition.de", "advertiser_name": "More Nutrition"}, {"id": "2805cab2-a511-4457-9fe2-3aea953cf897", "url": "https://www.holy.com/angebot?utm_source=chatgpt", "ad_id": null, "model": "chatgpt", "price": 29.99, "title": "HOLY Elektrolyte jetzt testen", "market": "DE", "topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "utm_id": "u135", "currency": "EUR", "utm_term": null, "ad_format": "product_card_v2", "image_url": "https://cdn.example/ads/135.jpg", "price_str": "29,99 €", "prompt_id": "c0a80101-0000-4000-8000-000000000011", "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c", "utm_medium": "cpc", "utm_source": "chatgpt", "ad_group_id": "ag-135", "campaign_id": null, "description": "Kostenloser Versand ab 29 €", "observed_at": "2026-10-05T14:27:00+00:00", "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "utm_content": "banner", "utm_campaign": "Herbst HOLY \\"Sale\\"", "ad_account_id": "100000000000000000000", "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000581", "landing_domain": "holy.com", "advertiser_name": "HOLY"}], "limit": 2, "offset": 0, "total_count": 81}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = ``;
  try { if (window.setAdsLibrary) window.setAdsLibrary("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

---

## 5. Prompts: `adsPrompts` → `list_ads_prompts_v1` → `setAdsPrompts`

Die Ad Library im Modus Prompts. Sortiert ueber die Spaltenkoepfe (`p_sort`, einer der sieben Werte des Vertrags).

**Body, wie er kommt**:

```json
{"p_team_id":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-29","p_date_to":"2026-10-05","p_models":null,"p_markets":null,"p_topic_ids":null,"p_advertisers":null,"p_ad_formats":null,"p_search":null,"p_limit":15,"p_offset":0,"p_sort":"ad_coverage_desc"}
```

**Workflow:** *When `adsPrompts` event* →

- **Schritt 1:** API Connector `list_ads_prompts_v1`, Parameter `body` = *This JavascriptToBubble's value*.
- **Schritt 2:** Run javascript, OHNE "Only when":

```javascript
(function () {
  var ROH = `[Result of step 1:first item's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setAdsPrompts) window.setAdsPrompts("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch zum Testen** (die echte Rohantwort, Backslashes verdoppelt, damit nach dem Backtick genau der Text der RPC steht; erst ausfuehren, wenn die Ads-Ansicht offen ist):

```javascript
(function () {
  var ROH = `{"items": [{"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "prompt_id": "c0a80101-0000-4000-8000-000000000011", "total_runs": 28, "prompt_text": "Welche Elektrolyt-Pulver sind fuer Kinder", "last_ad_seen": "2026-10-05T14:27:00+00:00", "runs_with_ads": 7, "ad_appearances": 13, "ad_coverage_pct": 25.00, "advertiser_count": 4}, {"topics": [{"topic_id": "e1f2a3b4-0000-4000-8000-000000000001", "topic_name": "Elektrolyte"}, {"topic_id": "e1f2a3b4-0000-4000-8000-000000000004", "topic_name": "Hydration"}], "prompt_id": "c0a80101-0000-4000-8000-000000000003", "total_runs": 27, "prompt_text": "Welche Elektrolyt-Pulver sind gut", "last_ad_seen": "2026-10-05T14:37:00+00:00", "runs_with_ads": 4, "ad_appearances": 7, "ad_coverage_pct": 14.81, "advertiser_count": 4}], "limit": 2, "offset": 0, "total_count": 14}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = ``;
  try { if (window.setAdsPrompts) window.setAdsPrompts("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

---

## 6. Filter-Optionen: `adsFilterOptions` → `get_ads_filter_options_v1` → `setAdsFilterOptions`

Die Eintraege und Zahlen der zwei Auswahlen in der Ad Library (Advertisers, Ad Format). Haengt nur am Zeitraum.

**Body, wie er kommt**:

```json
{"p_team_id":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-29","p_date_to":"2026-10-05"}
```

**Workflow:** *When `adsFilterOptions` event* →

- **Schritt 1:** API Connector `get_ads_filter_options_v1`, Parameter `body` = *This JavascriptToBubble's value*.
- **Schritt 2:** Run javascript, OHNE "Only when":

```javascript
(function () {
  var ROH = `[Result of step 1:first item's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setAdsFilterOptions) window.setAdsFilterOptions("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch zum Testen** (die echte Rohantwort, Backslashes verdoppelt, damit nach dem Backtick genau der Text der RPC steht; erst ausfuehren, wenn die Ads-Ansicht offen ist):

```javascript
(function () {
  var ROH = `{"models": [{"count": 196, "label": "perplexity", "value": "perplexity"}, {"count": 190, "label": "chatgpt", "value": "chatgpt"}], "topics": [{"count": 110, "label": "Elektrolyte", "value": "e1f2a3b4-0000-4000-8000-000000000001"}, {"count": 138, "label": "Energy Drinks", "value": "e1f2a3b4-0000-4000-8000-000000000002"}, {"count": 110, "label": "Hydration", "value": "e1f2a3b4-0000-4000-8000-000000000004"}, {"count": 138, "label": "Sportnahrung", "value": "e1f2a3b4-0000-4000-8000-000000000003"}], "markets": [{"count": 330, "label": "DE", "value": "DE"}, {"count": 56, "label": "AT", "value": "AT"}], "ad_formats": [{"count": 64, "label": "Image Ad", "value": "image_card_v2"}, {"count": 17, "label": "Product Ad", "value": "product_card_v2"}], "advertisers": [{"count": 28, "label": "HOLY", "value": "HOLY"}, {"count": 25, "label": "More Nutrition", "value": "More Nutrition"}, {"count": 9, "label": "MyProtein", "value": "MyProtein"}, {"count": 7, "label": "Amazon", "value": "Amazon"}, {"count": 7, "label": "Waterdrop", "value": "Waterdrop"}, {"count": 5, "label": "Rossmann", "value": "Rossmann"}]}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = ``;
  try { if (window.setAdsFilterOptions) window.setAdsFilterOptions("ads_page", ROH, FEHLER); } catch (e) {}
})();
```

---

