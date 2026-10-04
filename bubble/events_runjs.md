# Events: die Run-JS-Schritte (Stand 04.10.)

Hausform nach CLAUDE.md 2a: ein Backtick je Ausdruck, beide Ersetzungen, `window.<name>`, je ein `try`. Zu jedem Schritt die **statische Fassung mit den Daten des Backend-Vertrags** (`bubble/events_backend_vertrag.md`), zum Testen ohne RPC. Die Instanz heisst in allen Beispielen `events_page`, die Responses-Tabelle `responses_events`.

Jedes Ereignis der Komponente traegt den fertigen RPC-Body als Text. Im Workflow: API Connector mit Body = Wert des Ereignisses, danach der Schritt unten -- EIN Schritt ohne "Only when", der Erfolg und Fehler zugleich uebergibt (seit 04.10., siehe 0).

## 0. Die Antwort als EIN Feld (03.10.)

Kein Zuordnen einzelner Felder in Bubble. Jede RPC liefert ihre Antwort in genau der Struktur dieses
Vertrags, aber als **ein einziger Text-Schluessel** -- und verdoppelt darin die Backslashes:

```sql
-- am Ende jeder RPC (r = die bisherige jsonb-Antwort):
return jsonb_build_object('json', replace(r::text, chr(92), chr(92) || chr(92)));
```

In Bubble kennt der API Connector dann nur das Feld `json` (Text), und es geht unveraendert in den
Backtick: `` var ROH = `[Result of step 1's json]`; `` -- so stehen die Schritte unten.

**Ausnahme: `cached_mentions_overview_v1` (Schritt 10) NICHT umstellen.** Sie ist die gemeinsame RPC
aller Responses-Tabellen der App; im Ein-Feld-Format braechen die anderen Seiten. Ihr Schritt bleibt
wie auf jeder Seite.

**Fehler (04.10.): die Komponente prueft selbst.** Im API Connector "Include errors in response and
allow workflow actions to continue" anhaken. Dann bekommt jeder Setter als DRITTEN Wert
`[Result of step 1's error body]` in einem eigenen Backtick. Bei Erfolg ist der leer und es zaehlt
die Antwort; ist er gefuellt, zeigt die Komponente den Fehler dort, wo gewartet wird (Popup,
Zaehler, Skelett des Details, Analyse, Responses-Tabelle). Kein zweiter Schritt, kein "Only when".
Gemessen am 04.10. fuer Detail, Analyse, Zaehler, Bearbeiten, Loeschen und Responses; dabei auch,
dass ein Fehler auf eine ANDERE Anfrage ein wartendes Loeschen nicht abbricht.
Fuer die Liste (Schritt 1) braucht es den dritten Wert nicht: schlaegt sie fehl, ist `json` leer,
und ein leerer Text ergibt "Could not load events" (gemessen), nicht "No events yet".

**Liste nachziehen: `upEventsChanged` (04.10.)**, wie `upBrandsChanged`, `upMarketsChanged` und
`upTopicsChanged`. Nach jedem GELUNGENEN Anlegen, Bearbeiten, URL hinzufuegen/entfernen und Loeschen
ruft die Komponente `upstreemEventsChanged()`, das feuert `bubble_fn_upEventsChanged`. Auf der
Hauptseite steht dafuer EIN Toolbox-Element "JavaScript to Bubble" namens `upEventsChanged`
(Trigger event an); sein Workflow ist Schritt 1 (Liste + `setUpstreemEvents`). Die fuenf aendernden
Workflows brauchen damit KEINEN zweiten RPC-Aufruf. Bei einem Fehler und im Klick-Dummy feuert
nichts (gemessen). Fehlt das Element, sagt die Konsole es einmal.

Warum verdoppelt: im Backtick ist ein Backslash ein Steuerzeichen. Aus `\"` (ein Anfuehrungszeichen in
einem Wert, so schreibt JSON es) und `\n` (ein Zeilenumbruch) wuerde ein rohes `"` und ein echter
Umbruch -- kaputtes JSON. Verdoppelt bleibt nach dem Backtick genau das `\"` uebrig, das JSON braucht.
Gemessen am 03.10. mit einer Beschreibung `Zeile 1\nZeile 2 mit "Zitat"`: verdoppelt liest `JSON.parse`
sie sauber, unverdoppelt stirbt es ("Expected ',' or '}'"). `UC.readBubble` flickt den zweiten Fall
zwar meistens, aber Raten bleibt Raten.

## 1. Liste und Pins: `list_impact_events_v1` → `setUpstreemEvents`

Zwei Ausloeser, dieselben zwei Schritte: der Seitenaufbau (fuettert die Uebersicht UND die Pins in allen Liniendiagrammen der App) und das Ereignis `upEventsChanged` (siehe 0). Keine Chart-RPC wird dafuer angefasst. Seit Pin 2d61ace steht `setUpstreemEvents` im Vorlade-Snippet: ein Aufruf vor core wird gemerkt und nachgeholt.

**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setUpstreemEvents) window.setUpstreemEvents(ROH); } catch (e) {}
})();
```

**Statisch (Vertragsdaten):**

```javascript
(function () {
  var ROH = `[
 {
  "id": "7a3f2e5d-cccc-4b80-9c9d-0000000000c3",
  "event_date": "2026-10-01",
  "name": "Produktlaunch Speicher X",
  "description": "Launch des neuen Heimspeichers Speicher X mit eigener Landingpage und Pressemitteilung.",
  "event_type": "product_launch",
  "icon": "🚀",
  "color": "#7c3aed",
  "scope_mode": "topics",
  "selected_topic_count": 1,
  "affected_prompt_count": 9,
  "comparison_prompt_count": 52,
  "affected_url_count": 1,
  "created_by": "3f2a9c1e-7b44-4d0a-9e61-2c8d5f1a0b77",
  "created_at": "2026-10-01T16:22:09.101+00:00",
  "can_delete": true
 },
 {
  "id": "8b4a3f6e-dddd-4c91-8dae-0000000000d4",
  "event_date": "2026-09-08",
  "name": "PR-Kampagne Herbst",
  "description": "Drei Gastbeiträge in Fachmagazinen zum Thema Eigenverbrauch.",
  "event_type": "pr_campaign",
  "icon": "📰",
  "color": "#f59e0b",
  "scope_mode": "topics",
  "selected_topic_count": 2,
  "affected_prompt_count": 14,
  "comparison_prompt_count": 47,
  "affected_url_count": 3,
  "created_by": "51d0e2aa-90c3-4b1f-8a77-6e2b9c4d1f08",
  "created_at": "2026-09-09T07:45:00.000+00:00",
  "can_delete": false
 },
 {
  "id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1",
  "event_date": "2026-09-01",
  "name": "Website Relaunch",
  "description": "Neue Website mit überarbeiteten Produkt- und Preisseiten, neue Ratgeber-Sektion.",
  "event_type": "website_relaunch",
  "icon": "🌐",
  "color": "#22aa55",
  "scope_mode": "topics",
  "selected_topic_count": 3,
  "affected_prompt_count": 24,
  "comparison_prompt_count": 38,
  "affected_url_count": 5,
  "created_by": "3f2a9c1e-7b44-4d0a-9e61-2c8d5f1a0b77",
  "created_at": "2026-09-03T08:14:22.512+00:00",
  "can_delete": true
 },
 {
  "id": "6f2e1d4c-bbbb-4a7f-8b8c-0000000000b2",
  "event_date": "2026-03-25",
  "name": "Markenkampagne TV",
  "description": null,
  "event_type": "brand_campaign",
  "icon": "📣",
  "color": null,
  "scope_mode": "all",
  "selected_topic_count": null,
  "affected_prompt_count": 61,
  "comparison_prompt_count": 0,
  "affected_url_count": 0,
  "created_by": "3f2a9c1e-7b44-4d0a-9e61-2c8d5f1a0b77",
  "created_at": "2026-04-02T12:00:00.000+00:00",
  "can_delete": true
 }
]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setUpstreemEvents) window.setUpstreemEvents(ROH); } catch (e) {}
})();
```

## 2. Detail: `uevDetail` → `get_impact_event_v1` → `setEventDetail`

Dieselbe Antwortform kommt von Create, Update, Add-URL und Remove-URL -- dort derselbe Schritt (3, 5, 6).

**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setEventDetail) window.setEventDetail("events_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch (Vertragsdaten):**

```javascript
(function () {
  var ROH = `{
 "id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1",
 "team_id": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
 "name": "Website Relaunch",
 "description": "Neue Website mit überarbeiteten Produkt- und Preisseiten, neue Ratgeber-Sektion.",
 "event_type": "website_relaunch",
 "event_date": "2026-09-01",
 "icon": "🌐",
 "color": "#22aa55",
 "scope_mode": "topics",
 "created_by": "3f2a9c1e-7b44-4d0a-9e61-2c8d5f1a0b77",
 "created_at": "2026-09-03T08:14:22.512+00:00",
 "updated_at": "2026-09-10T15:02:41.097+00:00",
 "can_delete": true,
 "topics": [
  {
   "id": "e1f2a3b4-0001-4c5d-8e6f-000000000001",
   "name": "Photovoltaik Kosten",
   "deleted": false
  },
  {
   "id": "e1f2a3b4-0002-4c5d-8e6f-000000000002",
   "name": "Solaranbieter Vergleich",
   "deleted": false
  },
  {
   "id": "e1f2a3b4-0003-4c5d-8e6f-000000000003",
   "name": "Stromspeicher",
   "deleted": true
  }
 ],
 "selected_topic_count": 3,
 "affected_prompt_count": 24,
 "comparison_prompt_count": 38,
 "affected_url_count": 5,
 "urls": [
  {
   "id": "9c8b7a6d-0001-4e5f-8a9b-000000000001",
   "url": "https://www.sonnenkraft.de/preise",
   "url_input": "https://www.sonnenkraft.de/preise/?utm_source=newsletter",
   "team_kannte_url": true,
   "created_at": "2026-09-03T08:14:22.512+00:00"
  },
  {
   "id": "9c8b7a6d-0002-4e5f-8a9b-000000000002",
   "url": "https://www.sonnenkraft.de/ratgeber/photovoltaik-kosten",
   "url_input": "sonnenkraft.de/ratgeber/photovoltaik-kosten",
   "team_kannte_url": false,
   "created_at": "2026-09-03T08:14:22.512+00:00"
  },
  {
   "id": "9c8b7a6d-0003-4e5f-8a9b-000000000003",
   "url": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
   "url_input": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
   "team_kannte_url": true,
   "created_at": "2026-09-03T08:14:22.512+00:00"
  },
  {
   "id": "9c8b7a6d-0004-4e5f-8a9b-000000000004",
   "url": "https://www.energie-magazin.de/test/solaranbieter-2026",
   "url_input": "https://www.energie-magazin.de/test/solaranbieter-2026#fazit",
   "team_kannte_url": false,
   "created_at": "2026-09-12T10:41:05.330+00:00"
  },
  {
   "id": "9c8b7a6d-0005-4e5f-8a9b-000000000005",
   "url": "https://www.sonnenkraft.de/stromspeicher",
   "url_input": "https://www.sonnenkraft.de/stromspeicher",
   "team_kannte_url": true,
   "created_at": "2026-09-15T09:00:13.774+00:00"
  }
 ]
}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setEventDetail) window.setEventDetail("events_page", ROH); } catch (e) {}
})();
```

## 3. Anlegen: `uevCreate` → `create_impact_event_v1` → `setEventDetail`

Die Antwort ist das Detail-Objekt; die Komponente schliesst das Popup, oeffnet das neue Event und ruft `upEventsChanged` -- damit erscheint es in der Liste und als Pin.

**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setEventDetail) window.setEventDetail("events_page", ROH, FEHLER); } catch (e) {}
})();
```

## 4. Analyse: `uevAnalysis` → `cached_impact_event_analysis_v1` → `setEventAnalysis`



**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setEventAnalysis) window.setEventAnalysis("events_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch (Vertragsdaten):**

```javascript
(function () {
  var ROH = `{
 "event_id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1",
 "event_date": "2026-09-01",
 "windows": {
  "window_days": 30,
  "event_date": "2026-09-01",
  "requested_before_from": "2026-08-02",
  "requested_before_to": "2026-08-31",
  "requested_after_from": "2026-09-02",
  "requested_after_to": "2026-10-01",
  "effective_after_to": "2026-10-01",
  "after_complete": true,
  "actual_first_before": "2026-08-02",
  "actual_last_before": "2026-08-31",
  "actual_first_after": "2026-09-02",
  "actual_last_after": "2026-10-01",
  "before_observed_days": 30,
  "after_observed_days": 30,
  "limited_baseline": false,
  "sentiment_before_from": "2026-08-02",
  "sentiment_after_from": "2026-09-02"
 },
 "cohort": {
  "affected_prompt_count": 24,
  "affected_in_filter_count": 24,
  "comparable_prompt_count": 21,
  "post_only_prompt_count": 2,
  "no_data_prompt_count": 1,
  "deleted_prompt_count": 0,
  "comparable_models": [
   "chatgpt",
   "gemini",
   "google_ai_overview"
  ],
  "comparison_prompt_count": 38,
  "comparison_comparable_prompt_count": 36,
  "comparison_comparable_models": [
   "chatgpt",
   "gemini",
   "google_ai_overview"
  ]
 },
 "affected": {
  "visibility": {
   "before": 32.14,
   "after": 39.87,
   "delta": 7.73
  },
  "rank": {
   "before": 4.21,
   "after": 3.34,
   "delta": -0.87
  },
  "sentiment": {
   "before": 72.4,
   "after": 76.15,
   "delta": 3.75
  },
  "mention_runs": {
   "before": 567,
   "after": 702
  },
  "total_runs": {
   "before": 1764,
   "after": 1761
  },
  "company_id": "a1c3e5f7-1111-4a2b-8c9d-000000000001",
  "name": "SonnenKraft",
  "logo_url": "https://www.google.com/s2/favicons?domain=sonnenkraft.de&sz=64"
 },
 "comparison": {
  "visibility": {
   "before": 35.02,
   "after": 37.11,
   "delta": 2.09
  },
  "rank": {
   "before": 3.88,
   "after": 3.79,
   "delta": -0.09
  },
  "sentiment": {
   "before": 70.1,
   "after": 70.62,
   "delta": 0.52
  },
  "mention_runs": {
   "before": 1060,
   "after": 1121
  },
  "total_runs": {
   "before": 3027,
   "after": 3021
  }
 },
 "comparison_delta": {
  "visibility": 5.64,
  "rank": -0.78,
  "sentiment": 3.23
 },
 "competitors": [
  {
   "visibility": {
    "before": 41.5,
    "after": 43.92,
    "delta": 2.42
   },
   "rank": {
    "before": 2.71,
    "after": 2.65,
    "delta": -0.06
   },
   "sentiment": {
    "before": 68.3,
    "after": 69.0,
    "delta": 0.7
   },
   "mention_runs": {
    "before": 732,
    "after": 773
   },
   "total_runs": {
    "before": 1764,
    "after": 1761
   },
   "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
   "name": "HelioTech",
   "logo_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64"
  },
  {
   "visibility": {
    "before": 28.06,
    "after": 26.3,
    "delta": -1.76
   },
   "rank": {
    "before": 3.95,
    "after": 4.12,
    "delta": 0.17
   },
   "sentiment": {
    "before": 74.9,
    "after": 73.4,
    "delta": -1.5
   },
   "mention_runs": {
    "before": 495,
    "after": 463
   },
   "total_runs": {
    "before": 1764,
    "after": 1761
   },
   "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
   "name": "SolarPlus",
   "logo_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64"
  },
  {
   "visibility": {
    "before": null,
    "after": 12.4,
    "delta": null
   },
   "rank": {
    "before": null,
    "after": 5.6,
    "delta": null
   },
   "sentiment": {
    "before": null,
    "after": 66.0,
    "delta": null
   },
   "mention_runs": {
    "before": 0,
    "after": 218
   },
   "total_runs": {
    "before": 0,
    "after": 1761
   },
   "company_id": "d4f6b8ca-4444-4d5e-9f20-000000000004",
   "name": "Voltaro",
   "logo_url": null
  }
 ],
 "urls": [
  {
   "id": "9c8b7a6d-0001-4e5f-8a9b-000000000001",
   "url": "https://www.sonnenkraft.de/preise",
   "url_input": "https://www.sonnenkraft.de/preise/?utm_source=newsletter",
   "team_kannte_url": true,
   "global_share": {
    "before": 3.12,
    "after": 8.74,
    "delta": 5.62
   },
   "runs_with_url": {
    "before": 43,
    "after": 121
   },
   "observation": {
    "status": "first_observed_after_event",
    "first_observed_day": "2026-09-02",
    "first_observed_at": "2026-09-02T06:41:12.338+00:00",
    "first_observed_prompt_run_id": "f0e1d2c3-0101-4b5a-9c8d-000000000101",
    "day_number": 1,
    "observed_before_event": true,
    "search_until": "2026-10-02"
   }
  },
  {
   "id": "9c8b7a6d-0002-4e5f-8a9b-000000000002",
   "url": "https://www.sonnenkraft.de/ratgeber/photovoltaik-kosten",
   "url_input": "sonnenkraft.de/ratgeber/photovoltaik-kosten",
   "team_kannte_url": false,
   "global_share": {
    "before": 0.0,
    "after": 4.33,
    "delta": 4.33
   },
   "runs_with_url": {
    "before": 0,
    "after": 60
   },
   "observation": {
    "status": "first_observed_after_event",
    "first_observed_day": "2026-09-11",
    "first_observed_at": "2026-09-11T08:14:03.912+00:00",
    "first_observed_prompt_run_id": "f0e1d2c3-0102-4b5a-9c8d-000000000102",
    "day_number": 10,
    "observed_before_event": false,
    "search_until": "2026-10-02"
   }
  },
  {
   "id": "9c8b7a6d-0003-4e5f-8a9b-000000000003",
   "url": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
   "url_input": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
   "team_kannte_url": true,
   "global_share": {
    "before": 11.85,
    "after": 12.03,
    "delta": 0.18
   },
   "runs_with_url": {
    "before": 164,
    "after": 167
   },
   "observation": {
    "status": "observed_on_event_day",
    "first_observed_day": "2026-09-01",
    "first_observed_at": "2026-09-01T05:58:47.120+00:00",
    "first_observed_prompt_run_id": "f0e1d2c3-0103-4b5a-9c8d-000000000103",
    "day_number": 0,
    "observed_before_event": true,
    "search_until": "2026-10-02"
   }
  },
  {
   "id": "9c8b7a6d-0004-4e5f-8a9b-000000000004",
   "url": "https://www.energie-magazin.de/test/solaranbieter-2026",
   "url_input": "https://www.energie-magazin.de/test/solaranbieter-2026#fazit",
   "team_kannte_url": false,
   "global_share": {
    "before": 0.0,
    "after": 0.0,
    "delta": 0.0
   },
   "runs_with_url": {
    "before": 0,
    "after": 0
   },
   "observation": {
    "status": "not_observed_since_event",
    "first_observed_day": null,
    "first_observed_at": null,
    "first_observed_prompt_run_id": null,
    "day_number": null,
    "observed_before_event": false,
    "search_until": "2026-10-02"
   }
  },
  {
   "id": "9c8b7a6d-0005-4e5f-8a9b-000000000005",
   "url": "https://www.sonnenkraft.de/stromspeicher",
   "url_input": "https://www.sonnenkraft.de/stromspeicher",
   "team_kannte_url": true,
   "global_share": {
    "before": 1.94,
    "after": 1.88,
    "delta": -0.06
   },
   "runs_with_url": {
    "before": 27,
    "after": 26
   },
   "observation": {
    "status": "first_observed_after_event",
    "first_observed_day": "2026-09-04",
    "first_observed_at": "2026-09-04T07:02:55.006+00:00",
    "first_observed_prompt_run_id": "f0e1d2c3-0104-4b5a-9c8d-000000000104",
    "day_number": 3,
    "observed_before_event": true,
    "search_until": "2026-10-02"
   }
  }
 ],
 "trend": [
  {
   "day": "2026-08-02",
   "is_event_day": false,
   "affected_visibility": 33.15,
   "affected_rank": 4.18,
   "affected_sentiment": 71.88,
   "affected_runs": 56,
   "comparison_visibility": 36.41,
   "comparison_rank": 3.87,
   "comparison_sentiment": 71.03,
   "comparison_runs": 100
  },
  {
   "day": "2026-08-03",
   "is_event_day": false,
   "affected_visibility": 33.08,
   "affected_rank": 4.12,
   "affected_sentiment": 71.21,
   "affected_runs": 56,
   "comparison_visibility": 36.19,
   "comparison_rank": 3.86,
   "comparison_sentiment": 69.39,
   "comparison_runs": 102
  },
  {
   "day": "2026-08-04",
   "is_event_day": false,
   "affected_visibility": 33.23,
   "affected_rank": 4.26,
   "affected_sentiment": 72.25,
   "affected_runs": 56,
   "comparison_visibility": 35.39,
   "comparison_rank": 3.77,
   "comparison_sentiment": 69.76,
   "comparison_runs": 103
  },
  {
   "day": "2026-08-05",
   "is_event_day": false,
   "affected_visibility": 32.08,
   "affected_rank": 4.24,
   "affected_sentiment": 73.45,
   "affected_runs": 58,
   "comparison_visibility": 34.3,
   "comparison_rank": 3.96,
   "comparison_sentiment": 69.35,
   "comparison_runs": 97
  },
  {
   "day": "2026-08-06",
   "is_event_day": false,
   "affected_visibility": 31.05,
   "affected_rank": 4.22,
   "affected_sentiment": 72.02,
   "affected_runs": 55,
   "comparison_visibility": 33.93,
   "comparison_rank": 3.92,
   "comparison_sentiment": 70.04,
   "comparison_runs": 104
  },
  {
   "day": "2026-08-07",
   "is_event_day": false,
   "affected_visibility": 30.13,
   "affected_rank": 4.11,
   "affected_sentiment": 72.82,
   "affected_runs": 56,
   "comparison_visibility": 33.75,
   "comparison_rank": 3.87,
   "comparison_sentiment": 70.75,
   "comparison_runs": 98
  },
  {
   "day": "2026-08-08",
   "is_event_day": false,
   "affected_visibility": 30.83,
   "affected_rank": 4.09,
   "affected_sentiment": 72.49,
   "affected_runs": 56,
   "comparison_visibility": 34.22,
   "comparison_rank": 3.87,
   "comparison_sentiment": 69.87,
   "comparison_runs": 101
  },
  {
   "day": "2026-08-09",
   "is_event_day": false,
   "affected_visibility": 31.51,
   "affected_rank": 4.06,
   "affected_sentiment": 71.42,
   "affected_runs": 58,
   "comparison_visibility": 34.07,
   "comparison_rank": 3.78,
   "comparison_sentiment": 70.3,
   "comparison_runs": 104
  },
  {
   "day": "2026-08-10",
   "is_event_day": false,
   "affected_visibility": 31.95,
   "affected_rank": 4.23,
   "affected_sentiment": 72.54,
   "affected_runs": 59,
   "comparison_visibility": 34.76,
   "comparison_rank": 3.8,
   "comparison_sentiment": 69.8,
   "comparison_runs": 98
  },
  {
   "day": "2026-08-11",
   "is_event_day": false,
   "affected_visibility": 32.78,
   "affected_rank": 4.23,
   "affected_sentiment": 71.94,
   "affected_runs": 57,
   "comparison_visibility": 35.11,
   "comparison_rank": 3.98,
   "comparison_sentiment": 69.45,
   "comparison_runs": 98
  },
  {
   "day": "2026-08-12",
   "is_event_day": false,
   "affected_visibility": 33.07,
   "affected_rank": 4.26,
   "affected_sentiment": 72.82,
   "affected_runs": 58,
   "comparison_visibility": 35.59,
   "comparison_rank": 4.0,
   "comparison_sentiment": 71.02,
   "comparison_runs": 100
  },
  {
   "day": "2026-08-13",
   "is_event_day": false,
   "affected_visibility": 32.22,
   "affected_rank": 4.15,
   "affected_sentiment": 72.41,
   "affected_runs": 59,
   "comparison_visibility": 36.21,
   "comparison_rank": 3.82,
   "comparison_sentiment": 70.22,
   "comparison_runs": 100
  },
  {
   "day": "2026-08-14",
   "is_event_day": false,
   "affected_visibility": 33.06,
   "affected_rank": 4.28,
   "affected_sentiment": 72.36,
   "affected_runs": 58,
   "comparison_visibility": 34.62,
   "comparison_rank": 3.82,
   "comparison_sentiment": 69.68,
   "comparison_runs": 101
  },
  {
   "day": "2026-08-15",
   "is_event_day": false,
   "affected_visibility": 31.32,
   "affected_rank": 4.17,
   "affected_sentiment": 73.29,
   "affected_runs": 58,
   "comparison_visibility": 35.48,
   "comparison_rank": 3.94,
   "comparison_sentiment": 70.06,
   "comparison_runs": 99
  },
  {
   "day": "2026-08-16",
   "is_event_day": false,
   "affected_visibility": 30.51,
   "affected_rank": 4.25,
   "affected_sentiment": 73.39,
   "affected_runs": 57,
   "comparison_visibility": 33.77,
   "comparison_rank": 3.81,
   "comparison_sentiment": 70.78,
   "comparison_runs": 104
  },
  {
   "day": "2026-08-17",
   "is_event_day": false,
   "affected_visibility": 31.59,
   "affected_rank": 4.23,
   "affected_sentiment": 72.22,
   "affected_runs": 56,
   "comparison_visibility": 34.01,
   "comparison_rank": 3.89,
   "comparison_sentiment": 69.65,
   "comparison_runs": 104
  },
  {
   "day": "2026-08-18",
   "is_event_day": false,
   "affected_visibility": 30.22,
   "affected_rank": 4.26,
   "affected_sentiment": 73.49,
   "affected_runs": 60,
   "comparison_visibility": 34.07,
   "comparison_rank": 3.84,
   "comparison_sentiment": 69.6,
   "comparison_runs": 97
  },
  {
   "day": "2026-08-19",
   "is_event_day": false,
   "affected_visibility": 31.53,
   "affected_rank": 4.25,
   "affected_sentiment": 73.0,
   "affected_runs": 59,
   "comparison_visibility": 34.23,
   "comparison_rank": 3.78,
   "comparison_sentiment": 69.29,
   "comparison_runs": 99
  },
  {
   "day": "2026-08-20",
   "is_event_day": false,
   "affected_visibility": 32.66,
   "affected_rank": 4.29,
   "affected_sentiment": 71.37,
   "affected_runs": 55,
   "comparison_visibility": 35.4,
   "comparison_rank": 3.79,
   "comparison_sentiment": 70.18,
   "comparison_runs": 98
  },
  {
   "day": "2026-08-21",
   "is_event_day": false,
   "affected_visibility": 32.84,
   "affected_rank": 4.32,
   "affected_sentiment": 72.69,
   "affected_runs": 57,
   "comparison_visibility": 35.11,
   "comparison_rank": 3.85,
   "comparison_sentiment": 70.52,
   "comparison_runs": 99
  },
  {
   "day": "2026-08-22",
   "is_event_day": false,
   "affected_visibility": 33.76,
   "affected_rank": 4.23,
   "affected_sentiment": 72.41,
   "affected_runs": 59,
   "comparison_visibility": 36.13,
   "comparison_rank": 3.76,
   "comparison_sentiment": 70.03,
   "comparison_runs": 97
  },
  {
   "day": "2026-08-23",
   "is_event_day": false,
   "affected_visibility": 32.93,
   "affected_rank": 4.22,
   "affected_sentiment": 73.25,
   "affected_runs": 55,
   "comparison_visibility": 35.26,
   "comparison_rank": 3.93,
   "comparison_sentiment": 69.73,
   "comparison_runs": 100
  },
  {
   "day": "2026-08-24",
   "is_event_day": false,
   "affected_visibility": 32.09,
   "affected_rank": 4.1,
   "affected_sentiment": 72.94,
   "affected_runs": 55,
   "comparison_visibility": 35.71,
   "comparison_rank": 3.95,
   "comparison_sentiment": 70.08,
   "comparison_runs": 101
  },
  {
   "day": "2026-08-25",
   "is_event_day": false,
   "affected_visibility": 31.09,
   "affected_rank": 4.23,
   "affected_sentiment": 72.42,
   "affected_runs": 59,
   "comparison_visibility": 35.48,
   "comparison_rank": 3.83,
   "comparison_sentiment": 70.5,
   "comparison_runs": 102
  },
  {
   "day": "2026-08-26",
   "is_event_day": false,
   "affected_visibility": 31.65,
   "affected_rank": 4.11,
   "affected_sentiment": 72.68,
   "affected_runs": 59,
   "comparison_visibility": 35.12,
   "comparison_rank": 3.85,
   "comparison_sentiment": 69.74,
   "comparison_runs": 102
  },
  {
   "day": "2026-08-27",
   "is_event_day": false,
   "affected_visibility": 30.2,
   "affected_rank": 4.07,
   "affected_sentiment": 71.38,
   "affected_runs": 58,
   "comparison_visibility": 34.29,
   "comparison_rank": 3.99,
   "comparison_sentiment": 70.46,
   "comparison_runs": 104
  },
  {
   "day": "2026-08-28",
   "is_event_day": false,
   "affected_visibility": 30.97,
   "affected_rank": 4.21,
   "affected_sentiment": 72.13,
   "affected_runs": 60,
   "comparison_visibility": 33.78,
   "comparison_rank": 3.77,
   "comparison_sentiment": 70.42,
   "comparison_runs": 103
  },
  {
   "day": "2026-08-29",
   "is_event_day": false,
   "affected_visibility": 31.18,
   "affected_rank": 4.26,
   "affected_sentiment": 73.16,
   "affected_runs": 55,
   "comparison_visibility": 34.66,
   "comparison_rank": 3.82,
   "comparison_sentiment": 69.87,
   "comparison_runs": 103
  },
  {
   "day": "2026-08-30",
   "is_event_day": false,
   "affected_visibility": 31.88,
   "affected_rank": 4.32,
   "affected_sentiment": 72.77,
   "affected_runs": 58,
   "comparison_visibility": 35.13,
   "comparison_rank": 3.88,
   "comparison_sentiment": 70.53,
   "comparison_runs": 97
  },
  {
   "day": "2026-08-31",
   "is_event_day": false,
   "affected_visibility": 33.51,
   "affected_rank": 4.24,
   "affected_sentiment": 73.02,
   "affected_runs": 56,
   "comparison_visibility": 35.19,
   "comparison_rank": 3.98,
   "comparison_sentiment": 69.87,
   "comparison_runs": 101
  },
  {
   "day": "2026-09-01",
   "is_event_day": true,
   "affected_visibility": 33.08,
   "affected_rank": 4.21,
   "affected_sentiment": 72.91,
   "affected_runs": 59,
   "comparison_visibility": 35.24,
   "comparison_rank": 3.81,
   "comparison_sentiment": 70.85,
   "comparison_runs": 97
  },
  {
   "day": "2026-09-02",
   "is_event_day": false,
   "affected_visibility": 33.11,
   "affected_rank": 4.15,
   "affected_sentiment": 71.66,
   "affected_runs": 60,
   "comparison_visibility": 35.94,
   "comparison_rank": 3.84,
   "comparison_sentiment": 70.62,
   "comparison_runs": 101
  },
  {
   "day": "2026-09-03",
   "is_event_day": false,
   "affected_visibility": 34.7,
   "affected_rank": 3.97,
   "affected_sentiment": 72.78,
   "affected_runs": 55,
   "comparison_visibility": 35.41,
   "comparison_rank": 3.89,
   "comparison_sentiment": 69.55,
   "comparison_runs": 102
  },
  {
   "day": "2026-09-04",
   "is_event_day": false,
   "affected_visibility": 34.5,
   "affected_rank": 3.95,
   "affected_sentiment": 72.62,
   "affected_runs": 55,
   "comparison_visibility": 35.86,
   "comparison_rank": 3.86,
   "comparison_sentiment": 69.68,
   "comparison_runs": 99
  },
  {
   "day": "2026-09-05",
   "is_event_day": false,
   "affected_visibility": 33.27,
   "affected_rank": 3.91,
   "affected_sentiment": 74.54,
   "affected_runs": 60,
   "comparison_visibility": 34.93,
   "comparison_rank": 3.84,
   "comparison_sentiment": 70.57,
   "comparison_runs": 104
  },
  {
   "day": "2026-09-06",
   "is_event_day": false,
   "affected_visibility": 33.39,
   "affected_rank": 3.84,
   "affected_sentiment": 73.21,
   "affected_runs": 60,
   "comparison_visibility": 35.7,
   "comparison_rank": 3.78,
   "comparison_sentiment": 69.98,
   "comparison_runs": 100
  },
  {
   "day": "2026-09-07",
   "is_event_day": false,
   "affected_visibility": 35.52,
   "affected_rank": 3.88,
   "affected_sentiment": 72.87,
   "affected_runs": 60,
   "comparison_visibility": 35.13,
   "comparison_rank": 3.82,
   "comparison_sentiment": 70.21,
   "comparison_runs": 97
  },
  {
   "day": "2026-09-08",
   "is_event_day": false,
   "affected_visibility": 36.69,
   "affected_rank": 3.64,
   "affected_sentiment": 75.43,
   "affected_runs": 55,
   "comparison_visibility": 35.69,
   "comparison_rank": 3.92,
   "comparison_sentiment": 70.09,
   "comparison_runs": 100
  },
  {
   "day": "2026-09-09",
   "is_event_day": false,
   "affected_visibility": 37.37,
   "affected_rank": 3.81,
   "affected_sentiment": 74.41,
   "affected_runs": 56,
   "comparison_visibility": 36.07,
   "comparison_rank": 3.8,
   "comparison_sentiment": 71.15,
   "comparison_runs": 97
  },
  {
   "day": "2026-09-10",
   "is_event_day": false,
   "affected_visibility": 38.01,
   "affected_rank": 3.71,
   "affected_sentiment": 75.67,
   "affected_runs": 56,
   "comparison_visibility": 37.41,
   "comparison_rank": 3.7,
   "comparison_sentiment": 70.59,
   "comparison_runs": 104
  },
  {
   "day": "2026-09-11",
   "is_event_day": false,
   "affected_visibility": 39.32,
   "affected_rank": 3.66,
   "affected_sentiment": 76.29,
   "affected_runs": 55,
   "comparison_visibility": 36.73,
   "comparison_rank": 3.81,
   "comparison_sentiment": 70.51,
   "comparison_runs": 100
  },
  {
   "day": "2026-09-12",
   "is_event_day": false,
   "affected_visibility": 40.13,
   "affected_rank": 3.48,
   "affected_sentiment": 76.11,
   "affected_runs": 59,
   "comparison_visibility": 36.8,
   "comparison_rank": 3.72,
   "comparison_sentiment": 70.07,
   "comparison_runs": 102
  },
  {
   "day": "2026-09-13",
   "is_event_day": false,
   "affected_visibility": 40.22,
   "affected_rank": 3.55,
   "affected_sentiment": 74.63,
   "affected_runs": 60,
   "comparison_visibility": 36.67,
   "comparison_rank": 3.7,
   "comparison_sentiment": 71.19,
   "comparison_runs": 98
  },
  {
   "day": "2026-09-14",
   "is_event_day": false,
   "affected_visibility": 39.46,
   "affected_rank": 3.23,
   "affected_sentiment": 74.82,
   "affected_runs": 57,
   "comparison_visibility": 36.51,
   "comparison_rank": 3.86,
   "comparison_sentiment": 70.36,
   "comparison_runs": 104
  },
  {
   "day": "2026-09-15",
   "is_event_day": false,
   "affected_visibility": 39.12,
   "affected_rank": 3.43,
   "affected_sentiment": 76.29,
   "affected_runs": 55,
   "comparison_visibility": 36.16,
   "comparison_rank": 3.71,
   "comparison_sentiment": 71.51,
   "comparison_runs": 103
  },
  {
   "day": "2026-09-16",
   "is_event_day": false,
   "affected_visibility": 38.75,
   "affected_rank": 3.4,
   "affected_sentiment": 75.51,
   "affected_runs": 58,
   "comparison_visibility": 36.71,
   "comparison_rank": 3.81,
   "comparison_sentiment": 70.87,
   "comparison_runs": 97
  },
  {
   "day": "2026-09-17",
   "is_event_day": false,
   "affected_visibility": 39.05,
   "affected_rank": 3.36,
   "affected_sentiment": 76.19,
   "affected_runs": 60,
   "comparison_visibility": 36.97,
   "comparison_rank": 3.77,
   "comparison_sentiment": 69.64,
   "comparison_runs": 99
  },
  {
   "day": "2026-09-18",
   "is_event_day": false,
   "affected_visibility": 40.49,
   "affected_rank": 3.22,
   "affected_sentiment": 76.87,
   "affected_runs": 57,
   "comparison_visibility": 37.44,
   "comparison_rank": 3.75,
   "comparison_sentiment": 71.48,
   "comparison_runs": 98
  },
  {
   "day": "2026-09-19",
   "is_event_day": false,
   "affected_visibility": 41.42,
   "affected_rank": 3.15,
   "affected_sentiment": 75.84,
   "affected_runs": 60,
   "comparison_visibility": 37.37,
   "comparison_rank": 3.84,
   "comparison_sentiment": 70.89,
   "comparison_runs": 101
  },
  {
   "day": "2026-09-20",
   "is_event_day": false,
   "affected_visibility": 40.98,
   "affected_rank": 3.44,
   "affected_sentiment": 76.2,
   "affected_runs": 56,
   "comparison_visibility": 37.2,
   "comparison_rank": 3.9,
   "comparison_sentiment": 70.71,
   "comparison_runs": 103
  },
  {
   "day": "2026-09-21",
   "is_event_day": false,
   "affected_visibility": 42.32,
   "affected_rank": 3.41,
   "affected_sentiment": 75.87,
   "affected_runs": 58,
   "comparison_visibility": 37.45,
   "comparison_rank": 3.8,
   "comparison_sentiment": 70.3,
   "comparison_runs": 98
  },
  {
   "day": "2026-09-22",
   "is_event_day": false,
   "affected_visibility": 42.34,
   "affected_rank": 3.26,
   "affected_sentiment": 75.31,
   "affected_runs": 60,
   "comparison_visibility": 38.32,
   "comparison_rank": 3.89,
   "comparison_sentiment": 71.11,
   "comparison_runs": 97
  },
  {
   "day": "2026-09-23",
   "is_event_day": false,
   "affected_visibility": 41.69,
   "affected_rank": 3.37,
   "affected_sentiment": 75.51,
   "affected_runs": 60,
   "comparison_visibility": 37.99,
   "comparison_rank": 3.78,
   "comparison_sentiment": 69.85,
   "comparison_runs": 102
  },
  {
   "day": "2026-09-24",
   "is_event_day": false,
   "affected_visibility": 40.82,
   "affected_rank": 3.33,
   "affected_sentiment": 76.11,
   "affected_runs": 56,
   "comparison_visibility": 37.35,
   "comparison_rank": 3.82,
   "comparison_sentiment": 70.11,
   "comparison_runs": 104
  },
  {
   "day": "2026-09-25",
   "is_event_day": false,
   "affected_visibility": 40.45,
   "affected_rank": 3.22,
   "affected_sentiment": 76.15,
   "affected_runs": 58,
   "comparison_visibility": 36.65,
   "comparison_rank": 3.77,
   "comparison_sentiment": 69.67,
   "comparison_runs": 97
  },
  {
   "day": "2026-09-26",
   "is_event_day": false,
   "affected_visibility": 39.67,
   "affected_rank": 3.39,
   "affected_sentiment": 76.77,
   "affected_runs": 57,
   "comparison_visibility": 37.08,
   "comparison_rank": 3.75,
   "comparison_sentiment": 70.39,
   "comparison_runs": 100
  },
  {
   "day": "2026-09-27",
   "is_event_day": false,
   "affected_visibility": 40.12,
   "affected_rank": 3.41,
   "affected_sentiment": 75.71,
   "affected_runs": 55,
   "comparison_visibility": 36.03,
   "comparison_rank": 3.71,
   "comparison_sentiment": 71.07,
   "comparison_runs": 104
  },
  {
   "day": "2026-09-28",
   "is_event_day": false,
   "affected_visibility": 40.44,
   "affected_rank": 3.16,
   "affected_sentiment": 77.2,
   "affected_runs": 58,
   "comparison_visibility": 36.76,
   "comparison_rank": 3.77,
   "comparison_sentiment": 70.38,
   "comparison_runs": 99
  },
  {
   "day": "2026-09-29",
   "is_event_day": false,
   "affected_visibility": 40.76,
   "affected_rank": 3.37,
   "affected_sentiment": 75.17,
   "affected_runs": 60,
   "comparison_visibility": 37.54,
   "comparison_rank": 3.75,
   "comparison_sentiment": 70.1,
   "comparison_runs": 101
  },
  {
   "day": "2026-09-30",
   "is_event_day": false,
   "affected_visibility": 42.05,
   "affected_rank": 3.43,
   "affected_sentiment": 75.48,
   "affected_runs": 58,
   "comparison_visibility": 38.14,
   "comparison_rank": 3.68,
   "comparison_sentiment": 70.22,
   "comparison_runs": 102
  },
  {
   "day": "2026-10-01",
   "is_event_day": false,
   "affected_visibility": 41.21,
   "affected_rank": 3.38,
   "affected_sentiment": 77.24,
   "affected_runs": 60,
   "comparison_visibility": 38.06,
   "comparison_rank": 3.73,
   "comparison_sentiment": 70.04,
   "comparison_runs": 98
  }
 ],
 "overlaps": [
  {
   "event_id": "8b4a3f6e-dddd-4c91-8dae-0000000000d4",
   "event_date": "2026-09-08",
   "name": "PR-Kampagne Herbst",
   "icon": "📰",
   "color": "#f59e0b",
   "event_type": "pr_campaign",
   "shared_affected_prompt_count": 11
  }
 ]
}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setEventAnalysis) window.setEventAnalysis("events_page", ROH); } catch (e) {}
})();
```

## 5. Bearbeiten: `uevUpdate` → `update_impact_event_v1` → `setEventDetail`



**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setEventDetail) window.setEventDetail("events_page", ROH, FEHLER); } catch (e) {}
})();
```

## 6. URL hinzufuegen / entfernen: `uevAddUrl` / `uevRemoveUrl` → `add_/remove_impact_event_url_v1` → `setEventDetail`

Die Komponente fordert Analyse und Responses danach selbst neu an.

**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setEventDetail) window.setEventDetail("events_page", ROH, FEHLER); } catch (e) {}
})();
```

## 7. Zahl im Anlegen-Popup: `uevScopePreview` → `preview_impact_event_scope_v1` → `setEventScopePreview`



**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setEventScopePreview) window.setEventScopePreview("events_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch (Vertragsdaten):**

```javascript
(function () {
  var ROH = `{
 "affected_prompt_count": 47
}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setEventScopePreview) window.setEventScopePreview("events_page", ROH); } catch (e) {}
})();
```

## 8. Loeschen: `uevDelete` → `delete_impact_event_v1` → `setEventDeleted`



**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setEventDeleted) window.setEventDeleted("events_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch (Vertragsdaten):**

```javascript
(function () {
  var ROH = `{
 "ok": true,
 "deleted_event_id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1"
}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setEventDeleted) window.setEventDeleted("events_page", ROH); } catch (e) {}
})();
```

## 9. Fehler einzeln: `setEventError` (nur noch fuer bestehende Workflows)

Seit dem 04.10. nicht mehr noetig -- der dritte Wert der Setter (siehe 0) ersetzt diesen Schritt.
Er bleibt, damit bereits gebaute Workflows mit "Only when" weiter funktionieren.
Der ganze Fehler-Body, wie Bubble ihn liefert (der nackte Code geht weiter). Die Komponente liest `message` daraus und zeigt den Satz dort, wo gerade gewartet wird (Popup, Zaehler) -- sonst als Toast. Gemessen: `{"code":"P0001","message":"impact_event_url_duplicate"}` ergibt "This URL is already part of the event.".

**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's error body]`;
  try { if (window.setEventError) window.setEventError("events_page", ROH); } catch (e) {}
})();
```

## 10. Responses: `uevResponses` → `cached_mentions_overview_v1` → `setEventResponses`

Die Responses-Tabelle `responses_events` unter der Events-Komponente (Form aus `responses_table_bubble.html`).

Die RPC bleibt die gemeinsame (kein Umschlag, Antwort ein Array). Weil die Komponente den ganzen
Body als EINEN Text schickt, braucht es im API Connector einen **zweiten Call** auf dieselbe RPC,
dessen Body nur `<body>` ist -- der bestehende Call der anderen Seiten bleibt unberuehrt.

`setEventResponses` (04.10.) reicht die Antwort an `renderResponsesTable` durch und bringt bei einem
Fehler-Body die Tabelle in ihren Lesefehler -- ohne das liefe ihr Skelett weiter, denn die Tabelle
hat keine eigene Warte-Uhr. Gemessen: 120 Skelett-Teile vorher, 0 danach, "Could not load responses".
`rows` ist derselbe Ausdruck wie im Responses-Schritt der anderen Seiten, nur auf dieses Ergebnis.

**Dynamisch:**

```javascript
(function () {
  var ROH = `{
    "instanceId": "responses_events",
    "rows": [Ergebnis von cached_mentions_overview_v1],
    "totalCount": [Ergebnis:first item's total_count]
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setEventResponses) window.setEventResponses("events_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch (Vertragsdaten):**

```javascript
(function () {
  var ROH = `{
    "instanceId": "responses_events",
    "rows": [
 {
  "prompt_run_id": "f0e1d2c3-0201-4b5a-9c8d-000000000201",
  "run_at": "2026-09-30T07:12:44.120+00:00",
  "model": "chatgpt",
  "prompt_id": "0a1b2c3d-0011-4e5f-8a9b-000000000011",
  "prompt_text": "Was kostet eine Photovoltaikanlage für ein Einfamilienhaus?",
  "user_rank": 2,
  "user_sentiment": 81,
  "has_user_brand": "yes",
  "companies_preview_totalcount": 3,
  "companies_preview": [
   {
    "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
    "name": "HelioTech",
    "favicon_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64",
    "rank": 1,
    "brand_name_raw": "HelioTech"
   },
   {
    "company_id": "a1c3e5f7-1111-4a2b-8c9d-000000000001",
    "name": "SonnenKraft",
    "favicon_url": "https://www.google.com/s2/favicons?domain=sonnenkraft.de&sz=64",
    "rank": 2,
    "brand_name_raw": "SonnenKraft"
   },
   {
    "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
    "name": "SolarPlus",
    "favicon_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64",
    "rank": 3,
    "brand_name_raw": "Solar Plus"
   }
  ],
  "sources_totalcount": 5,
  "sources_preview": [
   {
    "url": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
    "domain": "de.wikipedia.org",
    "title": "Photovoltaikanlage – Wikipedia",
    "favicon": "https://www.google.com/s2/favicons?domain=de.wikipedia.org&sz=64",
    "pos": 1
   },
   {
    "url": "https://www.sonnenkraft.de/preise",
    "domain": "[www.sonnenkraft.de](https://www.sonnenkraft.de)",
    "title": "Preise | SonnenKraft",
    "favicon": "https://www.google.com/s2/favicons?domain=www.sonnenkraft.de&sz=64",
    "pos": 2
   },
   {
    "url": "https://www.verbraucherzentrale.de/pv-kosten",
    "domain": "[www.verbraucherzentrale.de](https://www.verbraucherzentrale.de)",
    "title": "Was kostet eine PV-Anlage?",
    "favicon": "https://www.google.com/s2/favicons?domain=www.verbraucherzentrale.de&sz=64",
    "pos": 3
   }
  ],
  "total_count": 87,
  "response_preview": "Eine Photovoltaikanlage für ein Einfamilienhaus kostet 2026 je nach Größe zwischen 12.000 und 20.000 Euro. Anbieter wie He",
  "matched_event_url_ids": [
   "9c8b7a6d-0001-4e5f-8a9b-000000000001",
   "9c8b7a6d-0003-4e5f-8a9b-000000000003"
  ]
 },
 {
  "prompt_run_id": "f0e1d2c3-0202-4b5a-9c8d-000000000202",
  "run_at": "2026-09-29T09:41:02.517+00:00",
  "model": "gemini",
  "prompt_id": "0a1b2c3d-0012-4e5f-8a9b-000000000012",
  "prompt_text": "Welcher Solaranbieter ist 2026 am besten?",
  "user_rank": 4,
  "user_sentiment": 70,
  "has_user_brand": "yes",
  "companies_preview_totalcount": 5,
  "companies_preview": [
   {
    "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
    "name": "HelioTech",
    "favicon_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64",
    "rank": 1,
    "brand_name_raw": "HelioTech"
   },
   {
    "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
    "name": "SolarPlus",
    "favicon_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64",
    "rank": 2,
    "brand_name_raw": "SolarPlus"
   },
   {
    "company_id": "d4f6b8ca-4444-4d5e-9f20-000000000004",
    "name": "Voltaro",
    "favicon_url": "https://www.google.com/s2/favicons?domain=voltaro.de&sz=64",
    "rank": 3,
    "brand_name_raw": "Voltaro"
   },
   {
    "company_id": "a1c3e5f7-1111-4a2b-8c9d-000000000001",
    "name": "SonnenKraft",
    "favicon_url": "https://www.google.com/s2/favicons?domain=sonnenkraft.de&sz=64",
    "rank": 4,
    "brand_name_raw": "SonnenKraft"
   }
  ],
  "sources_totalcount": 4,
  "sources_preview": [
   {
    "url": "https://www.sonnenkraft.de/ratgeber/photovoltaik-kosten",
    "domain": "[www.sonnenkraft.de](https://www.sonnenkraft.de)",
    "title": "Photovoltaik Kosten 2026",
    "favicon": "https://www.google.com/s2/favicons?domain=www.sonnenkraft.de&sz=64",
    "pos": 1
   },
   {
    "url": "https://www.test-solar.de/vergleich",
    "domain": "[www.test-solar.de](https://www.test-solar.de)",
    "title": "Solaranbieter im Vergleich",
    "favicon": "https://www.google.com/s2/favicons?domain=www.test-solar.de&sz=64",
    "pos": 2
   }
  ],
  "total_count": 87,
  "response_preview": "Zu den bekanntesten Solaranbietern gehören HelioTech, SolarPlus und Voltaro. Für eine individuelle Beratung empfiehlt sich",
  "matched_event_url_ids": [
   "9c8b7a6d-0002-4e5f-8a9b-000000000002"
  ]
 },
 {
  "prompt_run_id": "f0e1d2c3-0203-4b5a-9c8d-000000000203",
  "run_at": "2026-09-29T06:03:18.004+00:00",
  "model": "google_ai_overview",
  "prompt_id": "0a1b2c3d-0013-4e5f-8a9b-000000000013",
  "prompt_text": "Lohnt sich ein Stromspeicher für PV?",
  "user_rank": null,
  "user_sentiment": null,
  "has_user_brand": "no",
  "companies_preview_totalcount": 2,
  "companies_preview": [
   {
    "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
    "name": "HelioTech",
    "favicon_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64",
    "rank": 1,
    "brand_name_raw": "HelioTech"
   },
   {
    "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
    "name": "SolarPlus",
    "favicon_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64",
    "rank": 2,
    "brand_name_raw": "SolarPlus"
   }
  ],
  "sources_totalcount": 3,
  "sources_preview": [
   {
    "url": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
    "domain": "de.wikipedia.org",
    "title": "Photovoltaikanlage – Wikipedia",
    "favicon": "https://www.google.com/s2/favicons?domain=de.wikipedia.org&sz=64",
    "pos": 1
   }
  ],
  "total_count": 87,
  "response_preview": "Ein Stromspeicher lohnt sich vor allem, wenn der Eigenverbrauch erhöht werden soll. Typische Speichergrößen liegen bei 5",
  "matched_event_url_ids": [
   "9c8b7a6d-0003-4e5f-8a9b-000000000003"
  ]
 }
],
    "totalCount": 87
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderResponsesTable) window.renderResponsesTable(ROH); } catch (e) {}
})();
```
