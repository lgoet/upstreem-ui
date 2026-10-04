# Shopping-Seiten – Backend-Übergabe für Claude Code

Diese Datei beschreibt die **Daten**: welche RPC welche UI-Bereiche füllt, die Parameter, die Antworten mit Beispielen und die Regeln. Layout und Komponenten kommen aus den Designs. Das Backend ist fertig und getestet, bitte nichts davon nachbauen oder im Frontend nachrechnen.

---

## 1. Überblick: welche RPC für welche Seite

| Seite | RPC | Aufruf |
|---|---|---|
| Overview | `app.cached_shopping_overview_v1` | einmal pro Filteränderung |
| Brands | `app.cached_shopping_overview_v1` (dieselbe) | mit `p_brand_*`-Parametern fürs Blättern, Suchen und Sortieren der Markentabelle |
| Products | `app.cached_shopping_products_v1` | pro Seite, Suche, Segment, Sortierung |
| Product Detail | `app.cached_shopping_product_detail_v1` | pro Produkt (`source_product_id`), Recent Appearances blätterbar |
| Merchants | `app.cached_shopping_merchants_v1` | pro Seite, Suche, Sortierung |
| Antwort öffnen („View Response“) | bestehende `app.get_mention_detail_v7(p_prompt_run_id, p_team)` | mit `prompt_run_id` aus Recent Appearances |

---

## 2. Aufruf und Antwortform

- **Aufruf:** Supabase/PostgREST, Schema `app`, Nutzer-JWT, Parameter **per Name**. Optionale Parameter weglassen oder `null` senden.
- **Antwort:** immer ein Umschlag, wie bei den Impact Events: `{"json": "<Antwort als JSON-Text>"}`. Im Text sind Backticks und `${` entfernt und Backslashes verdoppelt. Auspacken:
  - **Bubble „Run JavaScript“:** Den dynamischen Wert direkt **in den Quelltext** eines Template-Strings einsetzen. Bubble fügt den Text ein, JavaScript wertet die verdoppelten Backslashes beim Lesen des Template-Strings wieder einfach aus:
    ```js
    const data = JSON.parse(`<Result of step X's json>`);   // Bubble-Ausdruck an dieser Stelle einfügen
    ```
  - **Liegt der Text schon als JS-Variable vor** (z. B. `fetch` in core.js): nicht in `${…}` stecken, das würde die Verdopplung nicht auflösen. Stattdessen zuerst zurückwandeln:
    ```js
    const data = JSON.parse(text.replace(/\\\\/g, '\\'));
    ```
  Alle Beispiele unten zeigen den Inhalt **nach** dem Auspacken.
- **Fehler:** Sie kommen nicht im Umschlag, sondern als HTTP-Fehler mit stabilem `message` (Abschnitt 9).

---

## 3. Gemeinsame Filter (alle 4 RPCs)

| Parameter | Typ | Default | Bedeutung |
|---|---|---|---|
| `p_team` | uuid | – | Pflicht |
| `p_date_from` | date `"YYYY-MM-DD"` | `p_date_to − 29` | Beginn |
| `p_date_to` | date | heute | Ende (höchstens heute) |
| `p_models` | text[] | `null` = alle | z. B. `["chatgpt"]` |
| `p_markets` | text[] | `null` = alle | z. B. `["DE"]` |
| `p_tag_ids` | uuid[] | `null` = alle | Topics |
| `p_tagmode` | text | `"or"` | `"or"` / `"and"` |

Der Vergleichszeitraum wird automatisch gewählt: die gleiche Länge direkt davor. Einen Parameter dafür gibt es nicht.

---

## 4. Regeln für alle Werte

- **Kennzahl-Objekt:** Jede Kennzahl mit Vergleich kommt als `{"value": x, "previous": y, "delta": x − y}`.
  - Ohne Vergleich (`meta.comparison_available = false`) sind `previous` und `delta` `null`. Dann keinen Trend-Indikator zeigen.
- **Prozent:** Zahl mit 2 Nachkommastellen, `31.95` = 31,95 %. Anzeige mit 1 Nachkommastelle, Deltas in **pp**.
- **Position:** 1 = erster Platz, kleiner ist besser. Ein **negatives** Delta bei `avg_position` ist eine Verbesserung (grün).
- **`null` = kein Wert:** als „–“ anzeigen, nie als 0.
- **`source_product_id` ist immer ein String:** Die IDs sind größer als `Number.MAX_SAFE_INTEGER`. Nie in eine Zahl umwandeln, nie als Zahl in URLs oder State.
- **Marken-Typ:** `own` (eigene Marke), `competitor` (getrackter Wettbewerber) oder `other`.
  - `other` ist der **Sammeleintrag „Andere (nicht zugeordnet)“**: Produkte ohne getrackte Marke.
  - Er hat **keinen** Namen, kein Logo, keine Farbe und keinen Rang. In der UI grau, als „Andere“, nicht klickbar.
  - Einzelne „andere“ Marken gibt es nicht. Die Designs müssen das so abbilden.
- **Händler:** Nur `merchant_name`. Es gibt **keine Domain und kein Logo**, im UI ein Monogramm (Anfangsbuchstabe) zeigen.
- **Markenfarbe:** `color` kommt fertig vom Backend (Override, Firmenfarbe oder Palette, wie im Competition-Chart). „Andere“ hat `null`, dort neutral grau verwenden.
- **Bilder:** Sie liegen auf `images.openai.com`. Ein Platzhalter für fehlende oder kaputte Bilder ist nötig.
- **Preise:** `price_ranges` = Liste `{currency, min, max}` je Währung. Ist `min = max`, nur einen Preis zeigen.
- **Zwei verschiedene First Position Rates:**
  - **Marke:** Antworten mit der Marke auf Platz 1 ÷ alle Antworten mit Produktliste.
  - **Produkt:** Antworten mit dem Produkt auf Platz 1 ÷ Antworten, in denen das Produkt vorkommt.
  - Tooltips bitte entsprechend formulieren.
- **Summary-Text der Overview** (in den Designs): wird im Frontend aus `kpis` und `meta` zusammengesetzt (Textvorlage). Es gibt dafür kein Feld.

---

## 5. `meta` (in jeder Antwort gleich) und UI-Zustände

| Feld | Bedeutung |
|---|---|
| `data_available_from` | ab hier gibt es Shopping-Daten (Prod: `2026-10-03`) |
| `period {from, to, requested_from, days}` | ausgewerteter Zeitraum. `from` ≠ `requested_from` heißt: auf den Datenstart gekürzt |
| `previous_period {from, to}` | Vergleichszeitraum oder `null` |
| `comparison_available` | `true` = Deltas und Movement sind gefüllt |
| `own_company {company_id, name, logo_url, color}` | eigene Marke oder `null` |
| `own_company_set` | Team hat eine eigene Marke |
| `own_observations` | Anzahl Beobachtungen der eigenen Marke im Zeitraum |
| `totals` | `runs_with_known_state`, `runs_with_shopping`, `shopping_responses`, `observations`, `responses_with_list`, `products` |
| `previous_totals` | dasselbe für den Vergleichszeitraum oder `null` |

| UI-Zustand | Erkennen |
|---|---|
| Lädt | Frontend |
| Keine Shopping-Ergebnisse | `meta.totals.shopping_responses = 0` |
| Shopping für die gewählten Modelle nicht verfügbar | `meta.totals.runs_with_known_state = 0` (z. B. nur Perplexity gewählt) |
| Keine eigene Marke angelegt | `meta.own_company_set = false` |
| Eigene Marke nicht in Shopping gesehen | `meta.own_company_set = true` und `meta.own_observations = 0` |
| Kein Vergleich | `meta.comparison_available = false` |
| Zeitraum gekürzt | `meta.period.from !== meta.period.requested_from` → Hinweis „Daten ab {data_available_from}“ |

---

## 6. Paging, Suche, Sortierung (alle Tabellen)

| Tabelle | Parameter | Antwort |
|---|---|---|
| Products | `p_search`, `p_order`, `p_limit` (25, max. 100), `p_offset` | `rows`, `total_count`, `limit`, `offset` |
| Brands-Tabelle | `p_brand_search`, `p_brand_order`, `p_brand_limit` (25, max. 100), `p_brand_offset` | `brands`, `brands_page {total_count, limit, offset}` |
| Merchants | `p_search`, `p_order`, `p_limit` (25, max. 100), `p_offset` | `merchants`, `total_count`, `limit`, `offset` |
| Recent Appearances | `p_limit` (20, max. 100), `p_offset` | `appearances {rows, total_count, limit, offset}` |

- **Nächste Seite:** `offset += limit`. Ende ist erreicht, wenn `offset + Zeilen ≥ total_count`.
- **Suche:** Groß-/Kleinschreibung egal. Bitte mit Debounce aufrufen.
- **Übersichtswerte** (Zähler, Top-Händler, Top-Wettbewerber, Segment-Zähler) gelten für den ganzen Zeitraum und hängen nicht von der Seite ab.
- **`rank`** ist immer der Rang nach Share of Shelf (Marken) bzw. Nennungen (Händler), auch bei anderer Sortierung.

---

## 7. Die RPCs

### 7.1 Overview + Brands: `app.cached_shopping_overview_v1`

**Parameter:** gemeinsame Filter, dazu für die Markentabelle:

| Parameter | Default | Werte |
|---|---|---|
| `p_brand_search` | `null` | Teil des Markennamens |
| `p_brand_order` | `share_of_shelf_desc` | `share_of_shelf_desc`, `share_of_shelf_asc`, `share_of_shelf_delta_desc`, `presence_desc`, `avg_position_asc`, `first_position_rate_desc`, `observations_desc`, `products_desc`, `name_asc` |
| `p_brand_limit` / `p_brand_offset` | `25` / `0` | Paging |

**Welches Feld füllt welchen UI-Bereich:**

| UI-Bereich | Feld | Hinweis |
|---|---|---|
| KPI-Karten (Overview) | `kpis.shopping_rate`, `kpis.brand_presence`, `kpis.share_of_shelf`, `kpis.first_position_rate` | Kennzahl-Objekte. Die Marken-KPIs gelten für die **eigene** Marke. `kpis.avg_position` gibt es zusätzlich |
| Chart (Overview: Top 5) | `chart.series` mit `in_top5 = true` | Die eigene Marke ist immer dabei. Kennzahl-Umschalter: `presence`, `share_of_shelf`, `avg_position`, `first_position_rate` in `points[]` |
| Chart (Brands: Top 6) | alle `chart.series` (max. 6) | wie oben |
| X-Achse | `chart.days` | alle Tage des Zeitraums |
| Brand Landscape / Brands-Tabelle | `brands[]` + `brands_other` | `brands` = getrackte Marken (blätterbar), die eigene immer enthalten. `brands_other` = Zeile „Andere“, unter der Tabelle anpinnen, nicht blättern. `null`, wenn es keine gibt |
| Brands-Übersicht | `brands_summary` | `tracked_brands_observed`, `unassigned_share_of_shelf` (Anteil „Andere“), `unassigned_products`, `own_rank`, `own_share_of_shelf` (Kennzahl), `top_competitor` |
| Top Product je Marke | `brands[].top_product` | `{source_product_id, title, image_url, visibility}` |
| Top Products | `top_products[]` (10) | gleiche Zeilenform wie Products |
| Product Movement | `movement.rising[]`, `movement.declining[]` (je max. 5) | `status`: `rising`, `declining`, `new` (nur im aktuellen Zeitraum), `gone` (nur im Vergleich). Leer ohne Vergleich |
| Merchant Distribution | `merchant_distribution.top[]` (5) + `.rest` | `top + rest = 100 %`. `merchants_total` = Anzahl Händler |

Tageswerte im Chart:
- Hat ein Tag gar keine Shopping-Antwort, ist der Wert `null`: die Linie dort unterbrechen.
- Hat eine Marke an einem Tag keinen Treffer, ist der Wert `0`.
- `avg_position` ist `null`, wenn die Marke an dem Tag nicht vorkommt.

**Beispiel** (Arrays gekürzt, jedes Feld kommt mindestens einmal vor):
```json
{
  "meta": {
    "data_available_from": "2026-09-07",
    "period": {
      "from": "2026-09-21",
      "to": "2026-10-04",
      "requested_from": "2026-09-21",
      "days": 14
    },
    "previous_period": {
      "from": "2026-09-07",
      "to": "2026-09-20"
    },
    "comparison_available": true,
    "own_company": {
      "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c",
      "name": "HOLY",
      "logo_url": "https://www.google.com/s2/favicons?domain=holy.com",
      "color": "#e11d48"
    },
    "own_company_set": true,
    "own_observations": 77,
    "totals": {
      "runs_with_known_state": 196,
      "runs_with_shopping": 72,
      "shopping_responses": 72,
      "observations": 241,
      "responses_with_list": 64,
      "products": 20
    },
    "previous_totals": {
      "runs_with_known_state": 196,
      "runs_with_shopping": 74,
      "shopping_responses": 74,
      "observations": 239,
      "responses_with_list": 60,
      "products": 20
    }
  },
  "kpis": {
    "shopping_rate": {
      "value": 36.73,
      "previous": 37.76,
      "delta": -1.03
    },
    "share_of_shelf": {
      "value": 31.95,
      "previous": 25.52,
      "delta": 6.43
    },
    "avg_position": {
      "value": 1.77,
      "previous": 2.32,
      "delta": -0.55
    },
    "first_position_rate": {
      "value": 65.63,
      "previous": 36.67,
      "delta": 28.96
    },
    "brand_presence": {
      "value": 84.72,
      "previous": 58.11,
      "delta": 26.61
    }
  },
  "chart": {
    "days": [
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "…"
    ],
    "series": [
      {
        "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c",
        "name": "HOLY",
        "logo_url": "https://www.google.com/s2/favicons?domain=holy.com",
        "color": "#e11d48",
        "is_own": true,
        "in_top5": true,
        "points": [
          {
            "day": "2026-09-21",
            "share_of_shelf": 28.57,
            "presence": 100,
            "avg_position": 1,
            "first_position_rate": 100
          },
          {
            "day": "2026-09-22",
            "share_of_shelf": 33.33,
            "presence": 100,
            "avg_position": 1,
            "first_position_rate": 100
          },
          {
            "day": "2026-09-23",
            "share_of_shelf": 26.67,
            "presence": 80,
            "avg_position": 1,
            "first_position_rate": 80
          }
        ]
      },
      {
        "company_id": "5c282ab4-4af1-4a7d-ab36-9a5e25e7767d",
        "name": "Waterdrop",
        "logo_url": "https://www.google.com/s2/favicons?domain=waterdrop.de",
        "color": "#0ea5e9",
        "is_own": false,
        "in_top5": true,
        "points": [
          {
            "day": "2026-09-21",
            "share_of_shelf": 14.29,
            "presence": 50,
            "avg_position": 2.5,
            "first_position_rate": 0
          },
          {
            "day": "2026-09-22",
            "share_of_shelf": 22.22,
            "presence": 66.67,
            "avg_position": 3.5,
            "first_position_rate": 0
          },
          {
            "day": "2026-09-23",
            "share_of_shelf": 33.33,
            "presence": 80,
            "avg_position": 2.75,
            "first_position_rate": 20
          }
        ]
      }
    ]
  },
  "brands": [
    {
      "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c",
      "name": "HOLY",
      "logo_url": "https://www.google.com/s2/favicons?domain=holy.com",
      "color": "#e11d48",
      "type": "own",
      "rank": 1,
      "share_of_shelf": {
        "value": 31.95,
        "previous": 25.52,
        "delta": 6.43
      },
      "presence": {
        "value": 84.72,
        "previous": 58.11,
        "delta": 26.61
      },
      "observations": {
        "value": 77,
        "previous": 61,
        "delta": 16
      },
      "avg_position": {
        "value": 1.77,
        "previous": 2.32,
        "delta": -0.55
      },
      "first_position_rate": {
        "value": 65.63,
        "previous": 36.67,
        "delta": 28.96
      },
      "products": 4,
      "top_product": {
        "source_product_id": "5481951625162248933",
        "title": "HOLY Hydration Probier-Box",
        "image_url": "https://images.openai.com/thumbnails/5481951625162248933_1.jpg",
        "visibility": 37.5
      }
    },
    {
      "company_id": "5c282ab4-4af1-4a7d-ab36-9a5e25e7767d",
      "name": "Waterdrop",
      "logo_url": "https://www.google.com/s2/favicons?domain=waterdrop.de",
      "color": "#0ea5e9",
      "type": "competitor",
      "rank": 2,
      "share_of_shelf": {
        "value": 12.03,
        "previous": 12.97,
        "delta": -0.94
      },
      "presence": {
        "value": 36.11,
        "previous": 36.49,
        "delta": -0.38
      },
      "observations": {
        "value": 29,
        "previous": 31,
        "delta": -2
      },
      "avg_position": {
        "value": 2.71,
        "previous": 2.5,
        "delta": 0.21
      },
      "first_position_rate": {
        "value": 4.69,
        "previous": 10,
        "delta": -5.31
      },
      "products": 2,
      "top_product": {
        "source_product_id": "12345678901234567894",
        "title": "Waterdrop Microdrink Starter Set",
        "image_url": "https://images.openai.com/thumbnails/12345678901234567894_1.jpg",
        "visibility": 25
      }
    }
  ],
  "brands_other": {
    "company_id": null,
    "name": null,
    "logo_url": null,
    "color": null,
    "type": "other",
    "rank": null,
    "share_of_shelf": {
      "value": 30.71,
      "previous": 35.56,
      "delta": -4.85
    },
    "presence": {
      "value": 68.06,
      "previous": 68.92,
      "delta": -0.86
    },
    "observations": {
      "value": 74,
      "previous": 85,
      "delta": -11
    },
    "avg_position": {
      "value": 2.88,
      "previous": 2.53,
      "delta": 0.35
    },
    "first_position_rate": {
      "value": 14.06,
      "previous": 31.67,
      "delta": -17.61
    },
    "products": 10,
    "top_product": {
      "source_product_id": "12345678901234567902",
      "title": "Powerbar Electrolyte Tabs",
      "image_url": "https://images.openai.com/thumbnails/12345678901234567902_1.jpg",
      "visibility": 16.67
    }
  },
  "brands_page": {
    "total_count": 7,
    "limit": 25,
    "offset": 0
  },
  "brands_summary": {
    "tracked_brands_observed": 7,
    "unassigned_share_of_shelf": 30.71,
    "unassigned_products": 10,
    "own_rank": 1,
    "own_share_of_shelf": {
      "value": 31.95,
      "previous": 25.52,
      "delta": 6.43
    },
    "top_competitor": {
      "company_id": "5c282ab4-4af1-4a7d-ab36-9a5e25e7767d",
      "name": "Waterdrop",
      "logo_url": "https://www.google.com/s2/favicons?domain=waterdrop.de",
      "color": "#0ea5e9",
      "share_of_shelf": 12.03
    }
  },
  "top_products": [
    {
      "source_product_id": "5481951625162248933",
      "title": "HOLY Hydration Probier-Box",
      "listing_title": "HOLY Hydration Probier-Box Elektrolyte ohne Zucker",
      "brand": {
        "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c",
        "name": "HOLY",
        "logo_url": "https://www.google.com/s2/favicons?domain=holy.com",
        "color": "#e11d48",
        "type": "own"
      },
      "image_url": "https://images.openai.com/thumbnails/5481951625162248933_1.jpg",
      "visibility": {
        "value": 37.5,
        "previous": 25.68,
        "delta": 11.82
      },
      "observations": {
        "value": 27,
        "previous": 19,
        "delta": 8
      },
      "avg_position": {
        "value": 1.31,
        "previous": 2.13,
        "delta": -0.82
      },
      "first_position_rate": {
        "value": 74.07,
        "previous": 42.11,
        "delta": 31.96
      },
      "price_ranges": [
        {
          "currency": "EUR",
          "min": 13.49,
          "max": 14.99
        }
      ],
      "rating": 4.4,
      "num_reviews": 100,
      "merchants": [
        "Amazon.de - Amazon.de-Seller",
        "HOLY"
      ],
      "merchant_count": 2,
      "first_seen": "2026-09-21T08:11:00+00:00",
      "last_seen": "2026-10-04T15:43:00+00:00"
    }
  ],
  "movement": {
    "rising": [
      {
        "source_product_id": "9007199254740993001",
        "title": "HOLY Hydration Watermelon",
        "status": "rising",
        "brand": {
          "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c",
          "name": "HOLY",
          "logo_url": "https://www.google.com/s2/favicons?domain=holy.com",
          "type": "own"
        },
        "image_url": "https://images.openai.com/thumbnails/9007199254740993001_1.jpg",
        "visibility": {
          "value": 26.39,
          "previous": 12.16,
          "delta": 14.23
        },
        "avg_position": {
          "value": 1.88,
          "previous": 2,
          "delta": -0.12
        }
      }
    ],
    "declining": [
      {
        "source_product_id": "12345678901234567898",
        "title": "YFood Classic Choco",
        "status": "declining",
        "brand": {
          "company_id": "48bcbc6a-74cf-4b1a-b0fc-26a6c45f759b",
          "name": "YFood",
          "logo_url": "https://www.google.com/s2/favicons?domain=yfood.eu",
          "type": "competitor"
        },
        "image_url": "https://images.openai.com/thumbnails/12345678901234567898_1.jpg",
        "visibility": {
          "value": 13.89,
          "previous": 20.27,
          "delta": -6.38
        },
        "avg_position": {
          "value": 3,
          "previous": 3,
          "delta": 0
        }
      }
    ]
  },
  "merchant_distribution": {
    "top": [
      {
        "merchant_name": "Amazon.de - Amazon.de-Seller",
        "observations": 62,
        "share": 25.73,
        "products": 11
      },
      {
        "merchant_name": "HOLY",
        "observations": 43,
        "share": 17.84,
        "products": 4
      },
      {
        "merchant_name": "waterdrop.de",
        "observations": 26,
        "share": 10.79,
        "products": 2
      }
    ],
    "rest": {
      "observations": 64,
      "share": 26.54,
      "merchants": 7
    },
    "merchants_total": 12
  }
}
```

**Ohne Vergleich** (Auszug: Zeitraum beginnt am Datenstart):
```json
{
  "meta": {
    "data_available_from": "2026-09-07",
    "period": {
      "from": "2026-09-07",
      "to": "2026-09-13",
      "requested_from": "2026-09-07",
      "days": 7
    },
    "previous_period": null,
    "comparison_available": false,
    "own_company": {
      "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c",
      "name": "HOLY",
      "logo_url": "https://www.google.com/s2/favicons?domain=holy.com",
      "color": "#e11d48"
    },
    "own_company_set": true,
    "own_observations": 35,
    "totals": {
      "runs_with_known_state": 98,
      "runs_with_shopping": 38,
      "shopping_responses": 38,
      "observations": 127,
      "responses_with_list": 29,
      "products": 20
    },
    "previous_totals": null
  },
  "kpis": {
    "shopping_rate": {
      "value": 38.78,
      "previous": null,
      "delta": null
    },
    "share_of_shelf": {
      "value": 27.56,
      "previous": null,
      "delta": null
    },
    "avg_position": {
      "value": 2.32,
      "previous": null,
      "delta": null
    },
    "first_position_rate": {
      "value": 41.38,
      "previous": null,
      "delta": null
    },
    "brand_presence": {
      "value": 65.79,
      "previous": null,
      "delta": null
    }
  },
  "movement": {
    "rising": [],
    "declining": []
  }
}
```

**Brands-Tabelle, Seite 2** (`p_brand_order: "name_asc", p_brand_limit: 3, p_brand_offset: 3`, Auszug):
```json
{
  "brands": [
    {
      "name": "INSTICK",
      "rank": 6,
      "share_of_shelf": {
        "value": 4.15,
        "previous": 3.35,
        "delta": 0.8
      }
    },
    {
      "name": "More Nutrition",
      "rank": 3,
      "share_of_shelf": {
        "value": 6.64,
        "previous": 8.37,
        "delta": -1.73
      }
    },
    {
      "name": "Waterdrop",
      "rank": 2,
      "share_of_shelf": {
        "value": 12.03,
        "previous": 12.97,
        "delta": -0.94
      }
    }
  ],
  "brands_page": {
    "total_count": 7,
    "limit": 3,
    "offset": 3
  }
}
```

---

### 7.2 Products: `app.cached_shopping_products_v1`

**Parameter:** gemeinsame Filter, dazu:

| Parameter | Default | Werte |
|---|---|---|
| `p_segment` | `all` | `all`, `you`, `competition`, `other` |
| `p_search` | `null` | durchsucht Titel, Listing-Titel und Markenname |
| `p_merchant` | `null` | exakter `merchant_name` (Klick aus Merchants) |
| `p_company_id` | `null` | eine Marke (Klick aus Brands) |
| `p_order` | `visibility_desc` | `visibility_desc`, `visibility_asc`, `observations_desc`, `avg_position_asc`, `avg_position_desc`, `first_position_rate_desc`, `last_seen_desc`, `price_asc`, `price_desc`, `title_asc`, `rating_desc` |
| `p_limit` / `p_offset` | `25` / `0` | Paging |

**UI-Zuordnung:**
- **Segment-Tabs:** `segment_counts {all, you, competition, other}`. Suche, Händler- und Marken-Filter sind berücksichtigt, das gewählte Segment nicht.
- **Tabelle:** `rows[]`, Paging über `total_count`.

**Produkt-Zeile** (gleich in `top_products`):

| Feld | UI |
|---|---|
| `source_product_id` | Schlüssel für Product Detail (String) |
| `title` | Produkttitel (aus der KI-Antwort) |
| `listing_title` | Original-Listing-Titel (Google), `null`, wenn gleich `title` |
| `brand {company_id, name, logo_url, color, type}` | Marke mit Typ. Bei `other` alles außer `type` `null` |
| `image_url` | Produktbild |
| `visibility`, `observations`, `avg_position`, `first_position_rate` | Kennzahl-Objekte |
| `price_ranges[]` | Preis min–max je Währung |
| `rating`, `num_reviews` | Bewertung, sonst `null` (bei rund 30 % der Produkte) |
| `merchants[]`, `merchant_count` | Händlerliste, häufigster zuerst |
| `first_seen`, `last_seen` | Zeitstempel. `last_seen` = „Last Seen“ |

**Beispiel** (eine eigene Zeile, eine „Andere“-Zeile):
```json
{
  "meta": "… wie Overview …",
  "segment_counts": {
    "all": 20,
    "you": 4,
    "competition": 8,
    "other": 8
  },
  "total_count": 20,
  "limit": 25,
  "offset": 0,
  "rows": [
    {
      "source_product_id": "5481951625162248933",
      "title": "HOLY Hydration Probier-Box",
      "listing_title": "HOLY Hydration Probier-Box Elektrolyte ohne Zucker",
      "brand": {
        "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c",
        "name": "HOLY",
        "logo_url": "https://www.google.com/s2/favicons?domain=holy.com",
        "color": "#e11d48",
        "type": "own"
      },
      "image_url": "https://images.openai.com/thumbnails/5481951625162248933_1.jpg",
      "visibility": {
        "value": 37.5,
        "previous": 25.68,
        "delta": 11.82
      },
      "observations": {
        "value": 27,
        "previous": 19,
        "delta": 8
      },
      "avg_position": {
        "value": 1.31,
        "previous": 2.13,
        "delta": -0.82
      },
      "first_position_rate": {
        "value": 74.07,
        "previous": 42.11,
        "delta": 31.96
      },
      "price_ranges": [
        {
          "currency": "EUR",
          "min": 13.49,
          "max": 14.99
        }
      ],
      "rating": 4.4,
      "num_reviews": 100,
      "merchants": [
        "Amazon.de - Amazon.de-Seller",
        "HOLY"
      ],
      "merchant_count": 2,
      "first_seen": "2026-09-21T08:11:00+00:00",
      "last_seen": "2026-10-04T15:43:00+00:00"
    },
    {
      "source_product_id": "12345678901234567902",
      "title": "Powerbar Electrolyte Tabs",
      "listing_title": "PowerBar Electrolyte Tabs Mango Passion 10 Stk",
      "brand": {
        "company_id": null,
        "name": null,
        "logo_url": null,
        "color": null,
        "type": "other"
      },
      "image_url": "https://images.openai.com/thumbnails/12345678901234567902_1.jpg",
      "visibility": {
        "value": 16.67,
        "previous": 17.57,
        "delta": -0.9
      },
      "observations": {
        "value": 12,
        "previous": 13,
        "delta": -1
      },
      "avg_position": {
        "value": 2.7,
        "previous": 2.25,
        "delta": 0.45
      },
      "first_position_rate": {
        "value": 0,
        "previous": 30.77,
        "delta": -30.77
      },
      "price_ranges": [
        {
          "currency": "EUR",
          "min": 4.04,
          "max": 4.49
        }
      ],
      "rating": 4.3,
      "num_reviews": 655,
      "merchants": [
        "Rossmann.de",
        "dm-drogerie markt",
        "Amazon.de - Amazon.de-Seller"
      ],
      "merchant_count": 3,
      "first_seen": "2026-09-22T15:07:00+00:00",
      "last_seen": "2026-10-02T16:19:00+00:00"
    }
  ]
}
```

---

### 7.3 Product Detail: `app.cached_shopping_product_detail_v1`

**Parameter:** `p_source_product_id` (**String**, Pflicht), gemeinsame Filter, `p_limit` (20) und `p_offset` für Recent Appearances.

**UI-Zuordnung:**

| UI-Bereich | Feld | Hinweis |
|---|---|---|
| Kopf | `product` | `title`, `listing_title`, `brand`, `image_url`, `images[]` (Galerie), `latest_price`, `price_ranges`, `rating`, `num_reviews`, `merchant_count`, `last_seen`. Der Kopf kommt aus der letzten Beobachtung, unabhängig von den Filtern |
| KPI-Karten mit Delta | `kpis.visibility`, `.observations`, `.avg_position`, `.first_position_rate` | identisch mit der Zeile in Products |
| Mini-Linien in den KPI-Karten | `trend[]` | `visibility`, `observations`, `avg_position` je Tag |
| Performance-Chart | `trend[]` | Vergleichslinie der Marke: `brand_presence` (neben Visibility) und `brand_avg_position` (neben Avg. Position). Bei Marke „Andere“ `null`, dann keine Vergleichslinie |
| Where this product appears: Topics | `topics[] {tag_id, name, responses, share}` | Ein Prompt kann mehrere Topics haben, die Summe kann > 100 % sein. Absolute Zahlen zeigen, keine Torte |
| … Modelle / Märkte | `models[]`, `markets[]` `{model/market, responses, share}` | Summe 100 % |
| Merchants | `merchants[] {merchant_name, observations, share, price_ranges, latest_price}` | Preis je Händler. Keine Domain |
| Recent Appearances | `appearances {rows, total_count, limit, offset}` | neueste zuerst |

Felder einer Appearance-Zeile:
- `prompt_run_id` (für „View Response“), `run_at`, `day`, `model`, `market`.
- `topics[]` (Namen). Kann mehrere enthalten.
- `position`: `null` bei Einzelkarte.
- `is_first`, `render_type`, `title`, `price`, `currency`, `price_str`, `merchant_name`.

**Beispiel** (Arrays gekürzt):
```json
{
  "meta": "… wie Overview …",
  "product": {
    "source_product_id": "5481951625162248933",
    "title": "HOLY Hydration Probier-Box",
    "listing_title": "HOLY Hydration Probier-Box Elektrolyte ohne Zucker",
    "brand": {
      "company_id": "4c278bea-6a13-4ea6-9f78-16cf31e6ae9c",
      "name": "HOLY",
      "logo_url": "https://www.google.com/s2/favicons?domain=holy.com",
      "color": "#e11d48",
      "type": "own"
    },
    "image_url": "https://images.openai.com/thumbnails/5481951625162248933_1.jpg",
    "images": [
      "https://images.openai.com/thumbnails/5481951625162248933_1.jpg",
      "https://images.openai.com/thumbnails/5481951625162248933_2.jpg"
    ],
    "latest_price": {
      "price": 14.99,
      "currency": "EUR",
      "price_str": "14,99 €"
    },
    "price_ranges": [
      {
        "currency": "EUR",
        "min": 13.49,
        "max": 14.99
      }
    ],
    "rating": 4.4,
    "num_reviews": 100,
    "merchant_count": 2,
    "first_seen": "2026-09-21T08:11:00+00:00",
    "last_seen": "2026-10-04T15:43:00+00:00"
  },
  "kpis": {
    "visibility": {
      "value": 37.5,
      "previous": 25.68,
      "delta": 11.82
    },
    "observations": {
      "value": 27,
      "previous": 19,
      "delta": 8
    },
    "avg_position": {
      "value": 1.31,
      "previous": 2.13,
      "delta": -0.82
    },
    "first_position_rate": {
      "value": 74.07,
      "previous": 42.11,
      "delta": 31.96
    }
  },
  "trend": [
    {
      "day": "2026-10-02",
      "visibility": 25,
      "observations": 2,
      "avg_position": 1,
      "brand_presence": 100,
      "brand_avg_position": 1.67
    },
    {
      "day": "2026-10-03",
      "visibility": 75,
      "observations": 3,
      "avg_position": 1,
      "brand_presence": 100,
      "brand_avg_position": 1
    },
    {
      "day": "2026-10-04",
      "visibility": 33.33,
      "observations": 2,
      "avg_position": 2.5,
      "brand_presence": 100,
      "brand_avg_position": 2.17
    }
  ],
  "topics": [
    {
      "tag_id": "e1f2a3b4-0000-4000-8000-000000000002",
      "name": "Energy Drinks",
      "responses": 16,
      "share": 59.26
    },
    {
      "tag_id": "e1f2a3b4-0000-4000-8000-000000000003",
      "name": "Sportnahrung",
      "responses": 11,
      "share": 40.74
    }
  ],
  "models": [
    {
      "model": "chatgpt",
      "responses": 27,
      "share": 100
    }
  ],
  "markets": [
    {
      "market": "DE",
      "responses": 20,
      "share": 74.07
    },
    {
      "market": "AT",
      "responses": 7,
      "share": 25.93
    }
  ],
  "merchants": [
    {
      "merchant_name": "Amazon.de - Amazon.de-Seller",
      "observations": 17,
      "share": 62.96,
      "latest_price": {
        "price": 14.99,
        "currency": "EUR",
        "price_str": "14,99 €"
      },
      "price_ranges": [
        {
          "currency": "EUR",
          "min": 13.49,
          "max": 14.99
        }
      ]
    },
    {
      "merchant_name": "HOLY",
      "observations": 10,
      "share": 37.04,
      "latest_price": {
        "price": 14.99,
        "currency": "EUR",
        "price_str": "14,99 €"
      },
      "price_ranges": [
        {
          "currency": "EUR",
          "min": 13.49,
          "max": 14.99
        }
      ]
    }
  ],
  "appearances": {
    "total_count": 27,
    "limit": 20,
    "offset": 0,
    "rows": [
      {
        "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000765",
        "run_at": "2026-10-04T15:43:00+00:00",
        "day": "2026-10-04",
        "merchant_name": "HOLY",
        "model": "chatgpt",
        "market": "DE",
        "title": "HOLY Hydration Probier-Box",
        "price": 14.99,
        "currency": "EUR",
        "price_str": "14,99 €",
        "topics": [
          "Energy Drinks"
        ],
        "position": 2,
        "is_first": false,
        "render_type": "products"
      },
      {
        "prompt_run_id": "f0e1d2c3-0000-4000-8000-000000000781",
        "run_at": "2026-10-04T07:29:00+00:00",
        "day": "2026-10-04",
        "merchant_name": "Amazon.de - Amazon.de-Seller",
        "model": "chatgpt",
        "market": "AT",
        "title": "HOLY Hydration Probier-Box",
        "price": 14.99,
        "currency": "EUR",
        "price_str": "14,99 €",
        "topics": [
          "Energy Drinks"
        ],
        "position": 3,
        "is_first": false,
        "render_type": "products"
      }
    ]
  }
}
```

**Produkt ohne getrackte Marke** (Auszug):
```json
{
  "product": {
    "title": "ESN Hydro Charge",
    "brand": {
      "company_id": null,
      "name": null,
      "logo_url": null,
      "color": null,
      "type": "other"
    }
  },
  "trend": [
    {
      "day": "2026-10-04",
      "visibility": 16.67,
      "observations": 1,
      "avg_position": 2,
      "brand_presence": null,
      "brand_avg_position": null
    }
  ]
}
```

---

### 7.4 Merchants: `app.cached_shopping_merchants_v1`

**Parameter:** gemeinsame Filter, dazu:

| Parameter | Default | Werte |
|---|---|---|
| `p_search` | `null` | Teil des Händlernamens |
| `p_order` | `observations_desc` | `observations_desc`, `observations_asc`, `observations_delta_desc`, `products_desc`, `tracked_brands_desc`, `avg_position_asc`, `first_seen_asc`, `last_seen_desc`, `name_asc` |
| `p_limit` / `p_offset` | `25` / `0` | Paging |

**UI-Zuordnung:**

| UI-Bereich | Feld |
|---|---|
| Übersicht | `summary {merchants, products, observations, top_merchant {merchant_name, share, observations}}`, immer für den ganzen Zeitraum |
| Balken (Anteil) | `merchants[]` der ersten Seite mit `p_order = observations_desc` |
| Tabelle | `merchants[]` + `total_count` |
| Klick auf Händler | Products mit `p_merchant = merchant_name` |

Felder einer Händler-Zeile:
- `merchant_name`, `rank`.
- `observations` und `share`: Kennzahl-Objekte. `share` ist der Anteil an allen Beobachtungen mit Händler.
- `products`: Anzahl verschiedener Produkte.
- `tracked_brands`: Anzahl verschiedener **getrackter** Marken. `has_unassigned_products = true` heißt: dazu kommen noch Produkte unter „Andere“. Anzeige z. B. „3 + Andere“.
- `avg_position`, `first_seen`, `last_seen`.

**Beispiel** (`p_limit: 5`, gekürzt):
```json
{
  "meta": "… wie Overview …",
  "summary": {
    "observations": 241,
    "products": 20,
    "merchants": 12,
    "top_merchant": {
      "merchant_name": "Amazon.de - Amazon.de-Seller",
      "observations": 62,
      "share": 25.73
    }
  },
  "total_count": 12,
  "limit": 5,
  "offset": 0,
  "merchants": [
    {
      "merchant_name": "Amazon.de - Amazon.de-Seller",
      "rank": 1,
      "observations": {
        "value": 62,
        "previous": 62,
        "delta": 0
      },
      "share": {
        "value": 25.73,
        "previous": 25.94,
        "delta": -0.21
      },
      "avg_position": 2.46,
      "products": 11,
      "tracked_brands": 6,
      "has_unassigned_products": true,
      "first_seen": "2026-09-21T08:11:00+00:00",
      "last_seen": "2026-10-04T12:45:00+00:00"
    },
    {
      "merchant_name": "HOLY",
      "rank": 2,
      "observations": {
        "value": 43,
        "previous": 41,
        "delta": 2
      },
      "share": {
        "value": 17.84,
        "previous": 17.15,
        "delta": 0.69
      },
      "avg_position": 1.62,
      "products": 4,
      "tracked_brands": 1,
      "has_unassigned_products": false,
      "first_seen": "2026-09-21T13:21:00+00:00",
      "last_seen": "2026-10-04T15:43:00+00:00"
    }
  ]
}
```

---

## 8. Hinweise zu den Daten
- Echte Shopping-Daten gibt es seit `2026-10-03` und nur von **ChatGPT**. Bei Perplexity und Google gibt es kein Shopping, siehe den Zustand „nicht verfügbar“.
- **Vergleiche und Movement** sind auf Prod in den ersten Tagen meist leer (`comparison_available = false`). Die Leer-Zustände müssen deshalb gut aussehen.
- **„Andere“ ist groß:** heute rund zwei Drittel der Beobachtungen. Die eigene Marke und Wettbewerber werden nur über exakte Namen erkannt.
- **Händlernamen sind Rohdaten:** „Amazon.de“ und „Amazon.de - Amazon.de-Seller“ sind zwei Händler. So gewollt, nicht im Frontend zusammenführen.
- **Beispiel-Zeitstempel:** Die Beispiele stammen aus einem Testsystem mit vier Wochen künstlicher Daten, damit alle Felder gefüllt sind. Die Zeitstempel sind dort UTC.

---

## 9. Fehler (`message` aus dem Fehler-Body)
| `message` | Wann | Anzeige |
|---|---|---|
| `shopping_invalid_param` | ungültiges `p_segment`, `p_order`, `p_brand_order`, `p_tagmode` oder leere Produkt-ID | technischer Fehler |
| `shopping_invalid_date` | `p_date_from` nach `p_date_to` | „Ungültiger Zeitraum“ |
| `shopping_product_not_found` | unbekannte Produkt-ID | „Produkt nicht gefunden“ |
| `shopping_rate_limited` | zu viele Aufrufe | „Bitte kurz warten“ |
| `not authenticated`, `forbidden`, `team_access_*` | Zugriff | wie auf den anderen Seiten |

Ein Zeitraum ohne Daten ist **kein Fehler**: Es kommen leere Listen, `totals` = 0 und die KPIs sind `null`.
