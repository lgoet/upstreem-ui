# Shopping: Workflows und Run-JS-Schritte (Stand 04.10.)

Hausform nach CLAUDE.md 2a: ein Backtick je Ausdruck, beide Ersetzungen, `window.<name>`, je ein
`try`. Zu jedem Schritt die **statische Fassung mit den Beispieldaten der Uebergabe**
(`bubble/shopping_backend_vertrag.md`, Codebloecke wortgleich) zum Testen ohne RPC. Die Instanz heisst
ueberall `shopping_page` (Vorlage: `bubble/shopping_bubble.html`).

## 0. Einmal einrichten

**Vier Elemente "JavaScript to Bubble"** auf der Seite (z.B. in der Gruppe `view-shopping`), je mit
*Trigger event* an, *Publish value* an, Typ **text**:

| Element (Name)        | Attribut am Wurzel-Div                         | RPC (Schema `app`)                  | Setter                     |
|-----------------------|------------------------------------------------|-------------------------------------|----------------------------|
| `shopOverview`        | `data-overview-fn="bubble_fn_shopOverview"`    | `cached_shopping_overview_v1`       | `setShoppingOverview`      |
| `shopProducts`        | `data-products-fn="bubble_fn_shopProducts"`    | `cached_shopping_products_v1`       | `setShoppingProducts`      |
| `shopProductDetail`   | `data-detail-fn="bubble_fn_shopProductDetail"` | `cached_shopping_product_detail_v1` | `setShoppingProductDetail` |
| `shopMerchants`       | `data-merchants-fn="bubble_fn_shopMerchants"`  | `cached_shopping_merchants_v1`      | `setShoppingMerchants`     |

Optional ein fuenftes, `view_first_shopping`, ohne Workflow: showView ruft es beim ersten Oeffnen
der Ansicht, und ohne das Element steht dafuer eine Warnung in der Konsole. Shopping laedt seine
Daten selbst ueber die vier Ereignisse oben.

**API Connector, vier Calls** -- eingerichtet wie die Events-Calls (derselbe Supabase-Server,
dieselben Header, Schema `app`, Nutzer-JWT), je:

- Methode **POST**, Pfad `rest/v1/rpc/<RPC aus der Tabelle>`
- Body-Typ JSON, Body genau `<body>` -- ein Parameter mit dem Schluessel **`body`**
- **"Include errors in response and allow workflow actions to continue" an.** Dann gibt es
  `Result of step 1's error body`, und der Workflow laeuft bei einem Fehler weiter in Schritt 2.
- Antwort: der Umschlag `{"json": "<Text>"}` (Uebergabe 2). Bubble kennt dann nur das Feld `json`
  (Text); es geht unveraendert in den Backtick. Zum Initialisieren den Beispiel-Body des
  jeweiligen Abschnitts unten einsetzen.

Jedes Ereignis traegt den FERTIGEN Body als Text: alle sieben gemeinsamen Filter (Uebergabe 3), p_team
schon drin, nicht gesetzte Werte als `null`, dazu die Parameter der RPC. Nichts davon in Bubble
zusammensetzen.

**Was die Komponente in Bubble NICHT braucht:** keinen Seitenaufbau-Schritt, kein "Only when", keinen
Lade-Setter, keinen zweiten Aufruf zum Blaettern -- Blaettern, Suchen, Sortieren, Segment, Kalender und
Filter feuern jeweils das Ereignis ihrer RPC mit dem neuen Body.

---

## 1. Overview und Brands: `shopOverview` → `cached_shopping_overview_v1` → `setShoppingOverview`

Eine RPC fuer zwei Reiter (Uebergabe 1). Overview fragt mit `p_brand_limit` 25 (Landscape, Zusammenfassung,
Kennzahlen); der Reiter Brands mit der Seite seiner Tabelle (Vorgabe 15 Zeilen, Pager 15/25/50/100).
Kennzahlen und Chart der Brands-Seite kommen aus jeder Overview-Antwort mit denselben Filtern -- beim
Blaettern bleiben sie stehen.

**Body, wie er kommt** (Overview, Kalender "Last 7 Days"):

```json
{"p_team":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-28","p_date_to":"2026-10-04","p_models":null,"p_markets":null,"p_tag_ids":null,"p_tagmode":"or","p_brand_search":null,"p_brand_order":"share_of_shelf_desc","p_brand_limit":25,"p_brand_offset":0}
```

**Body** (Reiter Brands, Seite 2, nach Name sortiert, Suche "ho"):

```json
{"p_team":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-28","p_date_to":"2026-10-04","p_models":null,"p_markets":null,"p_tag_ids":null,"p_tagmode":"or","p_brand_search":"ho","p_brand_order":"name_asc","p_brand_limit":15,"p_brand_offset":15}
```

**Workflow** "When shopOverview event" (JavaScript to Bubble `shopOverview`):

1. API Connector `cached_shopping_overview_v1`, Parameter `body` = `This JavascriptToBubble's value` (unveraendert, kein
   :formatted as, kein find & replace).
2. Run JavaScript, der Schritt unten (dynamisch). Ohne "Only when".

**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setShoppingOverview) window.setShoppingOverview("shopping_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch (Uebergabe 7.1, wortgleich)** -- auf dem Reiter Overview oder Brands ausfuehren:

```javascript
(function () {
  var ROH = `{
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
}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setShoppingOverview) window.setShoppingOverview("shopping_page", ROH); } catch (e) {}
})();
```

---

## 2. Products: `shopProducts` → `cached_shopping_products_v1` → `setShoppingProducts`

Segment (All/You/Competition/Other), Suche (ab 2 Zeichen, 300 ms Entprellung), Sortierung ueber die
Spaltenkoepfe, Seite. `p_merchant` kommt aus einem Klick auf einen Haendler (Merchants, Merchant
Distribution) und steht als Chip ueber der Tabelle. `p_company_id` setzt die Marken-Auswahl in der
Werkzeugleiste ("All Brands", eine Marke, seit 05.10.) -- oder ein Klick auf eine Marke in Brands bzw.
der Landscape, der dieselbe Auswahl setzt. Die Liste kommt aus dem Markenspeicher (setUpstreemBrands).

**Body, wie er kommt** (Reiter Products, Vorgabe):

```json
{"p_team":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-28","p_date_to":"2026-10-04","p_models":null,"p_markets":null,"p_tag_ids":null,"p_tagmode":"or","p_segment":"all","p_search":null,"p_merchant":null,"p_company_id":null,"p_order":"visibility_desc","p_limit":15,"p_offset":0}
```

**Body** (nach Klick auf den Haendler "Amazon.de" in Merchants, Segment Competition, nach Preis):

```json
{"p_team":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-28","p_date_to":"2026-10-04","p_models":null,"p_markets":null,"p_tag_ids":null,"p_tagmode":"or","p_segment":"competition","p_search":null,"p_merchant":"Amazon.de","p_company_id":null,"p_order":"price_asc","p_limit":15,"p_offset":0}
```

**Workflow** "When shopProducts event" (JavaScript to Bubble `shopProducts`):

1. API Connector `cached_shopping_products_v1`, Parameter `body` = `This JavascriptToBubble's value` (unveraendert, kein
   :formatted as, kein find & replace).
2. Run JavaScript, der Schritt unten (dynamisch). Ohne "Only when".

**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setShoppingProducts) window.setShoppingProducts("shopping_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch (Uebergabe 7.2, wortgleich)** -- auf dem Reiter Products ausfuehren:

```javascript
(function () {
  var ROH = `{
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
}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setShoppingProducts) window.setShoppingProducts("shopping_page", ROH); } catch (e) {}
})();
```

---

## 3. Product Detail: `shopProductDetail` → `cached_shopping_product_detail_v1` → `setShoppingProductDetail`

Ein Klick auf ein Produkt (Products, Top Products, Product Movement, Top Product einer Marke).
`p_source_product_id` ist **Text** -- die Ids sind 19-stellig und ueberstehen als Zahl kein JSON
(Uebergabe 7.3). `p_limit`/`p_offset` blaettern Recent Appearances; Kopf, Kennzahlen und Chart bleiben
dabei stehen. "View Response" oeffnet `openDrawer("response", prompt_run_id)` -- den Drawer der
Responses-Tabelle (`get_mention_detail_v7`), in Bubble nichts Neues.

**Body, wie er kommt:**

```json
{"p_team":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-28","p_date_to":"2026-10-04","p_models":null,"p_markets":null,"p_tag_ids":null,"p_tagmode":"or","p_source_product_id":"5481951625162248933","p_limit":15,"p_offset":0}
```

**Workflow** "When shopProductDetail event" (JavaScript to Bubble `shopProductDetail`):

1. API Connector `cached_shopping_product_detail_v1`, Parameter `body` = `This JavascriptToBubble's value` (unveraendert, kein
   :formatted as, kein find & replace).
2. Run JavaScript, der Schritt unten (dynamisch). Ohne "Only when".

**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setShoppingProductDetail) window.setShoppingProductDetail("shopping_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch (Uebergabe 7.3, wortgleich)** -- erst das Detail dieses Produkts oeffnen
(`?view=shopping&shop=products&product=5481951625162248933`), dann ausfuehren. Die Antwort gehoert
immer zu dem Produkt, das gerade offen ist:

```javascript
(function () {
  var ROH = `{
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
}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setShoppingProductDetail) window.setShoppingProductDetail("shopping_page", ROH); } catch (e) {}
})();
```

---

## 4. Merchants: `shopMerchants` → `cached_shopping_merchants_v1` → `setShoppingMerchants`

Die Balken "Merchant Share" zeigen die ERSTE Seite in der Vorgabe-Sortierung (Uebergabe 7.4). Steht die
Tabelle darunter auf einer anderen Seite oder Sortierung, fragt die Komponente beides an -- nacheinander,
dieselbe RPC, zwei Bodies. Solange die Tabelle in der Vorgabe steht, ist es eine Anfrage.

**Body, wie er kommt** (Reiter Merchants, Vorgabe -- auch die Balken):

```json
{"p_team":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-28","p_date_to":"2026-10-04","p_models":null,"p_markets":null,"p_tag_ids":null,"p_tagmode":"or","p_search":null,"p_order":"observations_desc","p_limit":15,"p_offset":0}
```

**Body** (Tabelle nach Produkten sortiert, Seite 2):

```json
{"p_team":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-28","p_date_to":"2026-10-04","p_models":null,"p_markets":null,"p_tag_ids":null,"p_tagmode":"or","p_search":null,"p_order":"products_desc","p_limit":15,"p_offset":15}
```

**Body** (05.10.: Products, das Dropdown "All Merchants" wird zum ersten Mal aufgeklappt -- es holt die Liste
der Haendler ueber DENSELBEN Workflow, 100 Zeilen, einmal je Filterstand):

```json
{"p_team":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_date_from":"2026-09-28","p_date_to":"2026-10-04","p_models":null,"p_markets":null,"p_tag_ids":null,"p_tagmode":"or","p_search":null,"p_order":"observations_desc","p_limit":100,"p_offset":0}
```

Bubble-seitig ist dafuer nichts zu tun: der Workflow reicht den Body unveraendert durch, und die RPC kennt
`p_limit` bis 100.

**Workflow** "When shopMerchants event" (JavaScript to Bubble `shopMerchants`):

1. API Connector `cached_shopping_merchants_v1`, Parameter `body` = `This JavascriptToBubble's value` (unveraendert, kein
   :formatted as, kein find & replace).
2. Run JavaScript, der Schritt unten (dynamisch). Ohne "Only when".

**Dynamisch:**

```javascript
(function () {
  var ROH = `[Result of step 1's json]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var FEHLER = `[Result of step 1's error body]`;
  try { if (window.setShoppingMerchants) window.setShoppingMerchants("shopping_page", ROH, FEHLER); } catch (e) {}
})();
```

**Statisch (Uebergabe 7.4, wortgleich)** -- auf dem Reiter Merchants ausfuehren:

```javascript
(function () {
  var ROH = `{
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
}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setShoppingMerchants) window.setShoppingMerchants("shopping_page", ROH); } catch (e) {}
})();
```

---

## 5. Was der Nutzer bei Fehlern sieht

Der Fehler-Body zaehlt nur, wenn `json` nicht lesbar ist. Dann steht an der Stelle, die gewartet hat,
ein Kasten mit "Try again" (fragt dieselbe RPC mit demselben Body noch einmal):

| `message` (Uebergabe 9) | Anzeige |
|---|---|
| `shopping_invalid_date` | "The date range is not valid." |
| `shopping_product_not_found` | Detail: "This product was not found." (Krume: "Product") |
| `shopping_rate_limited` | "Too many requests. Please wait a moment." |
| `team_access_*`, `forbidden`, `not authenticated` | "Your team doesn't have access right now." |
| `shopping_invalid_param`, alles andere | "Something went wrong. Please try again." |
| leere oder unlesbare Antwort ohne Fehler-Body | "The data could not be read. Please reload the page." |
| 25 s keine Antwort | "This is taking longer than expected. Please try again." |

Ein Zeitraum ohne Daten ist kein Fehler (Uebergabe 9): `totals.shopping_responses = 0` zeigt "No AI
Shopping products observed", `totals.runs_with_known_state = 0` "Shopping results aren't available
for these models" (z.B. nur Perplexity gewaehlt), beide mit "Clear all filters", wenn ein Filter steht.

**In der Konsole (seit 05.10.)** -- nie im UI:
- `setShoppingOverview bekam die Antwort von cached_shopping_products_v1 ...`: ein Workflow ruft den
  Setter einer anderen RPC (typisch: kopierter Workflow). Die Komponente erkennt die Antwort am Inhalt
  und zeigt sie trotzdem richtig; den Setter im genannten Workflow trotzdem korrigieren.
- `Keine Antwort auf shopProducts nach 25 s ...`: der Workflow laeuft nicht zu Ende oder ruft keinen
  Setter.
- `setShoppingProducts("..."): kein Shopping-Element mit dieser data-instance`: die Instanz im
  Run-JS-Schritt passt nicht zu `data-instance` am Element.
