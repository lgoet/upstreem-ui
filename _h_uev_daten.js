/* Pruefdaten Impact Events (02.10.). QUELLE: der Backend-Vertrag des Nutzers vom 02.10.
   ("Impact Events - vollstaendiger Backend-Vertrag fuer das Frontend", Stand final), die
   JSON-Bloecke maschinell aus dem Chat uebernommen -- unveraendert:
     UEV_LISTE (3.1), UEV_DETAIL_A / UEV_DETAIL_B (3.2), UEV_CREATE_REQ (3.4), UEV_URL_6M (3.9),
     UEV_RESP_EVENT / UEV_RESP_URL / UEV_RESP_NORMAL (3.10), UEV_TREND_A (Anhang A.1),
     UEV_PREVIEW_* (3.3, aus der Tabelle).
   ABGELEITET, weil der Vertrag dort nur die abweichenden Felder zeigt:
     UEV_ANALYSE_A   = 3.9 Beispiel A mit dem vollen Trend aus A.1
     UEV_ANALYSE_B   = Beispiel B ueber A gelegt ("affected, competitors wie A"); der Trend ist
                       aus den Ankerpunkten des Ausschnitts linear gerechnet, vor dem 19.03. null
     UEV_ANALYSE_NEU = "Event von gestern" ueber A gelegt, Zahlen der Kohorte aus der Liste,
                       Vorher-Tage aus A.1 verschoben, Nachher leer; URL aus dem Vorentwurf
     UEV_DETAIL_C    = Produktlaunch aus der Listenzeile, Topic und URL aus den Beispielen */
window.UEV_LISTE = [
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
];
window.UEV_DETAIL_A = {
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
};
window.UEV_DETAIL_B = {
 "id": "6f2e1d4c-bbbb-4a7f-8b8c-0000000000b2",
 "team_id": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
 "name": "Markenkampagne TV",
 "description": null,
 "event_type": "brand_campaign",
 "event_date": "2026-03-25",
 "icon": "📣",
 "color": null,
 "scope_mode": "all",
 "created_by": "3f2a9c1e-7b44-4d0a-9e61-2c8d5f1a0b77",
 "created_at": "2026-04-02T12:00:00.000+00:00",
 "updated_at": "2026-04-02T12:00:00.000+00:00",
 "can_delete": true,
 "topics": [],
 "selected_topic_count": null,
 "affected_prompt_count": 61,
 "comparison_prompt_count": 0,
 "affected_url_count": 0,
 "urls": []
};
window.UEV_DETAIL_C = {
 "id": "7a3f2e5d-cccc-4b80-9c9d-0000000000c3",
 "team_id": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
 "name": "Produktlaunch Speicher X",
 "description": "Launch des neuen Heimspeichers Speicher X mit eigener Landingpage und Pressemitteilung.",
 "event_type": "product_launch",
 "event_date": "2026-10-01",
 "icon": "🚀",
 "color": "#7c3aed",
 "scope_mode": "topics",
 "created_by": "3f2a9c1e-7b44-4d0a-9e61-2c8d5f1a0b77",
 "created_at": "2026-10-01T16:22:09.101+00:00",
 "updated_at": "2026-10-01T16:22:09.101+00:00",
 "can_delete": true,
 "topics": [
  {
   "id": "e1f2a3b4-0003-4c5d-8e6f-000000000003",
   "name": "Stromspeicher",
   "deleted": false
  }
 ],
 "selected_topic_count": 1,
 "affected_prompt_count": 9,
 "comparison_prompt_count": 52,
 "affected_url_count": 1,
 "urls": [
  {
   "id": "9c8b7a6d-0011-4e5f-8a9b-000000000011",
   "url": "https://www.sonnenkraft.de/speicher-x",
   "url_input": "https://www.sonnenkraft.de/speicher-x",
   "team_kannte_url": false,
   "created_at": "2026-10-01T16:22:09.101+00:00"
  }
 ]
};
window.UEV_CREATE_REQ = {
 "p_team": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
 "p_name": "Website Relaunch",
 "p_event_date": "2026-09-01",
 "p_scope_mode": "topics",
 "p_tag_ids": [
  "e1f2a3b4-0001-4c5d-8e6f-000000000001",
  "e1f2a3b4-0002-4c5d-8e6f-000000000002",
  "e1f2a3b4-0003-4c5d-8e6f-000000000003"
 ],
 "p_urls": [
  "https://www.sonnenkraft.de/preise/?utm_source=newsletter",
  "sonnenkraft.de/ratgeber/photovoltaik-kosten",
  "https://de.wikipedia.org/wiki/Photovoltaikanlage"
 ],
 "p_description": "Neue Website mit überarbeiteten Produkt- und Preisseiten, neue Ratgeber-Sektion.",
 "p_event_type": "website_relaunch",
 "p_icon": "🌐",
 "p_color": "#22aa55"
};
window.UEV_ANALYSE_A = {
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
};
window.UEV_ANALYSE_B = {
 "event_id": "6f2e1d4c-bbbb-4a7f-8b8c-0000000000b2",
 "event_date": "2026-03-25",
 "windows": {
  "window_days": 90,
  "event_date": "2026-03-25",
  "requested_before_from": "2025-12-25",
  "requested_before_to": "2026-03-24",
  "requested_after_from": "2026-03-26",
  "requested_after_to": "2026-06-23",
  "effective_after_to": "2026-06-23",
  "after_complete": true,
  "actual_first_before": "2026-03-19",
  "actual_last_before": "2026-03-24",
  "actual_first_after": "2026-03-26",
  "actual_last_after": "2026-06-23",
  "before_observed_days": 6,
  "after_observed_days": 90,
  "limited_baseline": true,
  "sentiment_before_from": "2026-02-23",
  "sentiment_after_from": "2026-05-25"
 },
 "cohort": {
  "affected_prompt_count": 61,
  "affected_in_filter_count": 61,
  "comparable_prompt_count": 44,
  "post_only_prompt_count": 15,
  "no_data_prompt_count": 0,
  "deleted_prompt_count": 2,
  "comparable_models": [
   "chatgpt",
   "google_ai_overview"
  ],
  "comparison_prompt_count": 0,
  "comparison_comparable_prompt_count": 0,
  "comparison_comparable_models": []
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
 "comparison": null,
 "comparison_delta": null,
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
 "urls": [],
 "trend": [
  {
   "day": "2025-12-25",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2025-12-26",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2025-12-27",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2025-12-28",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2025-12-29",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2025-12-30",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2025-12-31",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-01",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-02",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-03",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-04",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-05",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-06",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-07",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-08",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-09",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-10",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-11",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-12",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-13",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-14",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-15",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-16",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-17",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-18",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-19",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-20",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-21",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-22",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-23",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-24",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-25",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-26",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-27",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-28",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-29",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-30",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-01-31",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-01",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-02",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-03",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-04",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-05",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-06",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-07",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-08",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-09",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-10",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-11",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-12",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-13",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-14",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-15",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-16",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-17",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-18",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-19",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-20",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-21",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-22",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-23",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-24",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-25",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-26",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-27",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-02-28",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-01",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-02",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-03",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-04",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-05",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-06",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-07",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-08",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-09",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-10",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-11",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-12",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-13",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-14",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-15",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-16",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-17",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-18",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-19",
   "is_event_day": false,
   "affected_visibility": 16.16,
   "affected_rank": 5.08,
   "affected_sentiment": 68.99,
   "affected_runs": 94,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-20",
   "is_event_day": false,
   "affected_visibility": 16.61,
   "affected_rank": 5.07,
   "affected_sentiment": 69.05,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-21",
   "is_event_day": false,
   "affected_visibility": 17.06,
   "affected_rank": 5.07,
   "affected_sentiment": 69.1,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-22",
   "is_event_day": false,
   "affected_visibility": 17.51,
   "affected_rank": 5.06,
   "affected_sentiment": 69.16,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-23",
   "is_event_day": false,
   "affected_visibility": 17.96,
   "affected_rank": 5.05,
   "affected_sentiment": 69.22,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-24",
   "is_event_day": false,
   "affected_visibility": 18.41,
   "affected_rank": 5.05,
   "affected_sentiment": 69.27,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-25",
   "is_event_day": true,
   "affected_visibility": 18.86,
   "affected_rank": 5.04,
   "affected_sentiment": 69.33,
   "affected_runs": 97,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-26",
   "is_event_day": false,
   "affected_visibility": 18.95,
   "affected_rank": 5.03,
   "affected_sentiment": 69.35,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-27",
   "is_event_day": false,
   "affected_visibility": 19.04,
   "affected_rank": 5.03,
   "affected_sentiment": 69.38,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-28",
   "is_event_day": false,
   "affected_visibility": 19.13,
   "affected_rank": 5.02,
   "affected_sentiment": 69.4,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-29",
   "is_event_day": false,
   "affected_visibility": 19.21,
   "affected_rank": 5.01,
   "affected_sentiment": 69.43,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-30",
   "is_event_day": false,
   "affected_visibility": 19.3,
   "affected_rank": 5.0,
   "affected_sentiment": 69.45,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-03-31",
   "is_event_day": false,
   "affected_visibility": 19.39,
   "affected_rank": 5.0,
   "affected_sentiment": 69.48,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-01",
   "is_event_day": false,
   "affected_visibility": 19.48,
   "affected_rank": 4.99,
   "affected_sentiment": 69.5,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-02",
   "is_event_day": false,
   "affected_visibility": 19.57,
   "affected_rank": 4.98,
   "affected_sentiment": 69.52,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-03",
   "is_event_day": false,
   "affected_visibility": 19.66,
   "affected_rank": 4.98,
   "affected_sentiment": 69.55,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-04",
   "is_event_day": false,
   "affected_visibility": 19.75,
   "affected_rank": 4.97,
   "affected_sentiment": 69.57,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-05",
   "is_event_day": false,
   "affected_visibility": 19.83,
   "affected_rank": 4.96,
   "affected_sentiment": 69.6,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-06",
   "is_event_day": false,
   "affected_visibility": 19.92,
   "affected_rank": 4.95,
   "affected_sentiment": 69.62,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-07",
   "is_event_day": false,
   "affected_visibility": 20.01,
   "affected_rank": 4.95,
   "affected_sentiment": 69.64,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-08",
   "is_event_day": false,
   "affected_visibility": 20.1,
   "affected_rank": 4.94,
   "affected_sentiment": 69.67,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-09",
   "is_event_day": false,
   "affected_visibility": 20.19,
   "affected_rank": 4.93,
   "affected_sentiment": 69.69,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-10",
   "is_event_day": false,
   "affected_visibility": 20.28,
   "affected_rank": 4.93,
   "affected_sentiment": 69.72,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-11",
   "is_event_day": false,
   "affected_visibility": 20.37,
   "affected_rank": 4.92,
   "affected_sentiment": 69.74,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-12",
   "is_event_day": false,
   "affected_visibility": 20.45,
   "affected_rank": 4.91,
   "affected_sentiment": 69.77,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-13",
   "is_event_day": false,
   "affected_visibility": 20.54,
   "affected_rank": 4.9,
   "affected_sentiment": 69.79,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-14",
   "is_event_day": false,
   "affected_visibility": 20.63,
   "affected_rank": 4.9,
   "affected_sentiment": 69.81,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-15",
   "is_event_day": false,
   "affected_visibility": 20.72,
   "affected_rank": 4.89,
   "affected_sentiment": 69.84,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-16",
   "is_event_day": false,
   "affected_visibility": 20.81,
   "affected_rank": 4.88,
   "affected_sentiment": 69.86,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-17",
   "is_event_day": false,
   "affected_visibility": 20.9,
   "affected_rank": 4.88,
   "affected_sentiment": 69.89,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-18",
   "is_event_day": false,
   "affected_visibility": 20.99,
   "affected_rank": 4.87,
   "affected_sentiment": 69.91,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-19",
   "is_event_day": false,
   "affected_visibility": 21.07,
   "affected_rank": 4.86,
   "affected_sentiment": 69.94,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-20",
   "is_event_day": false,
   "affected_visibility": 21.16,
   "affected_rank": 4.86,
   "affected_sentiment": 69.96,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-21",
   "is_event_day": false,
   "affected_visibility": 21.25,
   "affected_rank": 4.85,
   "affected_sentiment": 69.98,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-22",
   "is_event_day": false,
   "affected_visibility": 21.34,
   "affected_rank": 4.84,
   "affected_sentiment": 70.01,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-23",
   "is_event_day": false,
   "affected_visibility": 21.43,
   "affected_rank": 4.83,
   "affected_sentiment": 70.03,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-24",
   "is_event_day": false,
   "affected_visibility": 21.52,
   "affected_rank": 4.83,
   "affected_sentiment": 70.06,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-25",
   "is_event_day": false,
   "affected_visibility": 21.61,
   "affected_rank": 4.82,
   "affected_sentiment": 70.08,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-26",
   "is_event_day": false,
   "affected_visibility": 21.69,
   "affected_rank": 4.81,
   "affected_sentiment": 70.11,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-27",
   "is_event_day": false,
   "affected_visibility": 21.78,
   "affected_rank": 4.81,
   "affected_sentiment": 70.13,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-28",
   "is_event_day": false,
   "affected_visibility": 21.87,
   "affected_rank": 4.8,
   "affected_sentiment": 70.15,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-29",
   "is_event_day": false,
   "affected_visibility": 21.96,
   "affected_rank": 4.79,
   "affected_sentiment": 70.18,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-04-30",
   "is_event_day": false,
   "affected_visibility": 22.05,
   "affected_rank": 4.78,
   "affected_sentiment": 70.2,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-01",
   "is_event_day": false,
   "affected_visibility": 22.14,
   "affected_rank": 4.78,
   "affected_sentiment": 70.23,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-02",
   "is_event_day": false,
   "affected_visibility": 22.23,
   "affected_rank": 4.77,
   "affected_sentiment": 70.25,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-03",
   "is_event_day": false,
   "affected_visibility": 22.31,
   "affected_rank": 4.76,
   "affected_sentiment": 70.27,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-04",
   "is_event_day": false,
   "affected_visibility": 22.4,
   "affected_rank": 4.76,
   "affected_sentiment": 70.3,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-05",
   "is_event_day": false,
   "affected_visibility": 22.49,
   "affected_rank": 4.75,
   "affected_sentiment": 70.32,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-06",
   "is_event_day": false,
   "affected_visibility": 22.58,
   "affected_rank": 4.74,
   "affected_sentiment": 70.35,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-07",
   "is_event_day": false,
   "affected_visibility": 22.67,
   "affected_rank": 4.73,
   "affected_sentiment": 70.37,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-08",
   "is_event_day": false,
   "affected_visibility": 22.76,
   "affected_rank": 4.73,
   "affected_sentiment": 70.4,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-09",
   "is_event_day": false,
   "affected_visibility": 22.84,
   "affected_rank": 4.72,
   "affected_sentiment": 70.42,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-10",
   "is_event_day": false,
   "affected_visibility": 22.93,
   "affected_rank": 4.71,
   "affected_sentiment": 70.44,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-11",
   "is_event_day": false,
   "affected_visibility": 23.02,
   "affected_rank": 4.71,
   "affected_sentiment": 70.47,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-12",
   "is_event_day": false,
   "affected_visibility": 23.11,
   "affected_rank": 4.7,
   "affected_sentiment": 70.49,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-13",
   "is_event_day": false,
   "affected_visibility": 23.2,
   "affected_rank": 4.69,
   "affected_sentiment": 70.52,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-14",
   "is_event_day": false,
   "affected_visibility": 23.29,
   "affected_rank": 4.68,
   "affected_sentiment": 70.54,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-15",
   "is_event_day": false,
   "affected_visibility": 23.38,
   "affected_rank": 4.68,
   "affected_sentiment": 70.57,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-16",
   "is_event_day": false,
   "affected_visibility": 23.46,
   "affected_rank": 4.67,
   "affected_sentiment": 70.59,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-17",
   "is_event_day": false,
   "affected_visibility": 23.55,
   "affected_rank": 4.66,
   "affected_sentiment": 70.61,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-18",
   "is_event_day": false,
   "affected_visibility": 23.64,
   "affected_rank": 4.66,
   "affected_sentiment": 70.64,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-19",
   "is_event_day": false,
   "affected_visibility": 23.73,
   "affected_rank": 4.65,
   "affected_sentiment": 70.66,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-20",
   "is_event_day": false,
   "affected_visibility": 23.82,
   "affected_rank": 4.64,
   "affected_sentiment": 70.69,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-21",
   "is_event_day": false,
   "affected_visibility": 23.91,
   "affected_rank": 4.63,
   "affected_sentiment": 70.71,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-22",
   "is_event_day": false,
   "affected_visibility": 24.0,
   "affected_rank": 4.63,
   "affected_sentiment": 70.73,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-23",
   "is_event_day": false,
   "affected_visibility": 24.08,
   "affected_rank": 4.62,
   "affected_sentiment": 70.76,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-24",
   "is_event_day": false,
   "affected_visibility": 24.17,
   "affected_rank": 4.61,
   "affected_sentiment": 70.78,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-25",
   "is_event_day": false,
   "affected_visibility": 24.26,
   "affected_rank": 4.61,
   "affected_sentiment": 70.81,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-26",
   "is_event_day": false,
   "affected_visibility": 24.35,
   "affected_rank": 4.6,
   "affected_sentiment": 70.83,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-27",
   "is_event_day": false,
   "affected_visibility": 24.44,
   "affected_rank": 4.59,
   "affected_sentiment": 70.86,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-28",
   "is_event_day": false,
   "affected_visibility": 24.53,
   "affected_rank": 4.58,
   "affected_sentiment": 70.88,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-29",
   "is_event_day": false,
   "affected_visibility": 24.62,
   "affected_rank": 4.58,
   "affected_sentiment": 70.9,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-30",
   "is_event_day": false,
   "affected_visibility": 24.7,
   "affected_rank": 4.57,
   "affected_sentiment": 70.93,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-05-31",
   "is_event_day": false,
   "affected_visibility": 24.79,
   "affected_rank": 4.56,
   "affected_sentiment": 70.95,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-01",
   "is_event_day": false,
   "affected_visibility": 24.88,
   "affected_rank": 4.56,
   "affected_sentiment": 70.98,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-02",
   "is_event_day": false,
   "affected_visibility": 24.97,
   "affected_rank": 4.55,
   "affected_sentiment": 71.0,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-03",
   "is_event_day": false,
   "affected_visibility": 25.06,
   "affected_rank": 4.54,
   "affected_sentiment": 71.03,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-04",
   "is_event_day": false,
   "affected_visibility": 25.15,
   "affected_rank": 4.54,
   "affected_sentiment": 71.05,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-05",
   "is_event_day": false,
   "affected_visibility": 25.24,
   "affected_rank": 4.53,
   "affected_sentiment": 71.07,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-06",
   "is_event_day": false,
   "affected_visibility": 25.32,
   "affected_rank": 4.52,
   "affected_sentiment": 71.1,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-07",
   "is_event_day": false,
   "affected_visibility": 25.41,
   "affected_rank": 4.51,
   "affected_sentiment": 71.12,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-08",
   "is_event_day": false,
   "affected_visibility": 25.5,
   "affected_rank": 4.51,
   "affected_sentiment": 71.15,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-09",
   "is_event_day": false,
   "affected_visibility": 25.59,
   "affected_rank": 4.5,
   "affected_sentiment": 71.17,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-10",
   "is_event_day": false,
   "affected_visibility": 25.68,
   "affected_rank": 4.49,
   "affected_sentiment": 71.2,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-11",
   "is_event_day": false,
   "affected_visibility": 25.77,
   "affected_rank": 4.49,
   "affected_sentiment": 71.22,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-12",
   "is_event_day": false,
   "affected_visibility": 25.86,
   "affected_rank": 4.48,
   "affected_sentiment": 71.24,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-13",
   "is_event_day": false,
   "affected_visibility": 25.94,
   "affected_rank": 4.47,
   "affected_sentiment": 71.27,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-14",
   "is_event_day": false,
   "affected_visibility": 26.03,
   "affected_rank": 4.46,
   "affected_sentiment": 71.29,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-15",
   "is_event_day": false,
   "affected_visibility": 26.12,
   "affected_rank": 4.46,
   "affected_sentiment": 71.32,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-16",
   "is_event_day": false,
   "affected_visibility": 26.21,
   "affected_rank": 4.45,
   "affected_sentiment": 71.34,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-17",
   "is_event_day": false,
   "affected_visibility": 26.3,
   "affected_rank": 4.44,
   "affected_sentiment": 71.36,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-18",
   "is_event_day": false,
   "affected_visibility": 26.39,
   "affected_rank": 4.44,
   "affected_sentiment": 71.39,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-19",
   "is_event_day": false,
   "affected_visibility": 26.48,
   "affected_rank": 4.43,
   "affected_sentiment": 71.41,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-20",
   "is_event_day": false,
   "affected_visibility": 26.56,
   "affected_rank": 4.42,
   "affected_sentiment": 71.44,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-21",
   "is_event_day": false,
   "affected_visibility": 26.65,
   "affected_rank": 4.41,
   "affected_sentiment": 71.46,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-22",
   "is_event_day": false,
   "affected_visibility": 26.74,
   "affected_rank": 4.41,
   "affected_sentiment": 71.49,
   "affected_runs": 95,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  },
  {
   "day": "2026-06-23",
   "is_event_day": false,
   "affected_visibility": 26.83,
   "affected_rank": 4.4,
   "affected_sentiment": 71.51,
   "affected_runs": 98,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": null
  }
 ],
 "overlaps": []
};
window.UEV_ANALYSE_NEU = {
 "event_id": "7a3f2e5d-cccc-4b80-9c9d-0000000000c3",
 "event_date": "2026-10-01",
 "windows": {
  "window_days": 30,
  "event_date": "2026-10-01",
  "requested_before_from": "2026-09-01",
  "requested_before_to": "2026-09-30",
  "requested_after_from": "2026-10-02",
  "requested_after_to": "2026-10-31",
  "effective_after_to": "2026-10-02",
  "after_complete": false,
  "actual_first_before": "2026-09-01",
  "actual_last_before": "2026-09-30",
  "actual_first_after": null,
  "actual_last_after": null,
  "before_observed_days": 30,
  "after_observed_days": 0,
  "limited_baseline": false,
  "sentiment_before_from": "2026-09-01",
  "sentiment_after_from": "2026-10-02"
 },
 "cohort": {
  "affected_prompt_count": 9,
  "affected_in_filter_count": 9,
  "comparable_prompt_count": 0,
  "post_only_prompt_count": 0,
  "no_data_prompt_count": 0,
  "deleted_prompt_count": 0,
  "comparable_models": [],
  "comparison_prompt_count": 52,
  "comparison_comparable_prompt_count": 0,
  "comparison_comparable_models": []
 },
 "affected": {
  "company_id": "a1c3e5f7-1111-4a2b-8c9d-000000000001",
  "name": "SonnenKraft",
  "logo_url": "https://www.google.com/s2/favicons?domain=sonnenkraft.de&sz=64",
  "visibility": {
   "before": null,
   "after": null,
   "delta": null
  },
  "rank": {
   "before": null,
   "after": null,
   "delta": null
  },
  "sentiment": {
   "before": null,
   "after": null,
   "delta": null
  },
  "mention_runs": {
   "before": null,
   "after": null
  },
  "total_runs": {
   "before": null,
   "after": null
  }
 },
 "comparison": null,
 "comparison_delta": null,
 "competitors": [],
 "urls": [
  {
   "id": "9c8b7a6d-0011-4e5f-8a9b-000000000011",
   "url": "https://www.sonnenkraft.de/speicher-x",
   "url_input": "https://www.sonnenkraft.de/speicher-x",
   "team_kannte_url": false,
   "global_share": {
    "before": null,
    "after": null,
    "delta": null
   },
   "runs_with_url": {
    "before": null,
    "after": null
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
  }
 ],
 "trend": [
  {
   "day": "2026-09-01",
   "is_event_day": false,
   "affected_visibility": 33.15,
   "affected_rank": 4.18,
   "affected_sentiment": 71.88,
   "affected_runs": 56,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-02",
   "is_event_day": false,
   "affected_visibility": 33.08,
   "affected_rank": 4.12,
   "affected_sentiment": 71.21,
   "affected_runs": 56,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-03",
   "is_event_day": false,
   "affected_visibility": 33.23,
   "affected_rank": 4.26,
   "affected_sentiment": 72.25,
   "affected_runs": 56,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-04",
   "is_event_day": false,
   "affected_visibility": 32.08,
   "affected_rank": 4.24,
   "affected_sentiment": 73.45,
   "affected_runs": 58,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-05",
   "is_event_day": false,
   "affected_visibility": 31.05,
   "affected_rank": 4.22,
   "affected_sentiment": 72.02,
   "affected_runs": 55,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-06",
   "is_event_day": false,
   "affected_visibility": 30.13,
   "affected_rank": 4.11,
   "affected_sentiment": 72.82,
   "affected_runs": 56,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-07",
   "is_event_day": false,
   "affected_visibility": 30.83,
   "affected_rank": 4.09,
   "affected_sentiment": 72.49,
   "affected_runs": 56,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-08",
   "is_event_day": false,
   "affected_visibility": 31.51,
   "affected_rank": 4.06,
   "affected_sentiment": 71.42,
   "affected_runs": 58,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-09",
   "is_event_day": false,
   "affected_visibility": 31.95,
   "affected_rank": 4.23,
   "affected_sentiment": 72.54,
   "affected_runs": 59,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-10",
   "is_event_day": false,
   "affected_visibility": 32.78,
   "affected_rank": 4.23,
   "affected_sentiment": 71.94,
   "affected_runs": 57,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-11",
   "is_event_day": false,
   "affected_visibility": 33.07,
   "affected_rank": 4.26,
   "affected_sentiment": 72.82,
   "affected_runs": 58,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-12",
   "is_event_day": false,
   "affected_visibility": 32.22,
   "affected_rank": 4.15,
   "affected_sentiment": 72.41,
   "affected_runs": 59,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-13",
   "is_event_day": false,
   "affected_visibility": 33.06,
   "affected_rank": 4.28,
   "affected_sentiment": 72.36,
   "affected_runs": 58,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-14",
   "is_event_day": false,
   "affected_visibility": 31.32,
   "affected_rank": 4.17,
   "affected_sentiment": 73.29,
   "affected_runs": 58,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-15",
   "is_event_day": false,
   "affected_visibility": 30.51,
   "affected_rank": 4.25,
   "affected_sentiment": 73.39,
   "affected_runs": 57,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-16",
   "is_event_day": false,
   "affected_visibility": 31.59,
   "affected_rank": 4.23,
   "affected_sentiment": 72.22,
   "affected_runs": 56,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-17",
   "is_event_day": false,
   "affected_visibility": 30.22,
   "affected_rank": 4.26,
   "affected_sentiment": 73.49,
   "affected_runs": 60,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-18",
   "is_event_day": false,
   "affected_visibility": 31.53,
   "affected_rank": 4.25,
   "affected_sentiment": 73.0,
   "affected_runs": 59,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-19",
   "is_event_day": false,
   "affected_visibility": 32.66,
   "affected_rank": 4.29,
   "affected_sentiment": 71.37,
   "affected_runs": 55,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-20",
   "is_event_day": false,
   "affected_visibility": 32.84,
   "affected_rank": 4.32,
   "affected_sentiment": 72.69,
   "affected_runs": 57,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-21",
   "is_event_day": false,
   "affected_visibility": 33.76,
   "affected_rank": 4.23,
   "affected_sentiment": 72.41,
   "affected_runs": 59,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-22",
   "is_event_day": false,
   "affected_visibility": 32.93,
   "affected_rank": 4.22,
   "affected_sentiment": 73.25,
   "affected_runs": 55,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-23",
   "is_event_day": false,
   "affected_visibility": 32.09,
   "affected_rank": 4.1,
   "affected_sentiment": 72.94,
   "affected_runs": 55,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-24",
   "is_event_day": false,
   "affected_visibility": 31.09,
   "affected_rank": 4.23,
   "affected_sentiment": 72.42,
   "affected_runs": 59,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-25",
   "is_event_day": false,
   "affected_visibility": 31.65,
   "affected_rank": 4.11,
   "affected_sentiment": 72.68,
   "affected_runs": 59,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-26",
   "is_event_day": false,
   "affected_visibility": 30.2,
   "affected_rank": 4.07,
   "affected_sentiment": 71.38,
   "affected_runs": 58,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-27",
   "is_event_day": false,
   "affected_visibility": 30.97,
   "affected_rank": 4.21,
   "affected_sentiment": 72.13,
   "affected_runs": 60,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-28",
   "is_event_day": false,
   "affected_visibility": 31.18,
   "affected_rank": 4.26,
   "affected_sentiment": 73.16,
   "affected_runs": 55,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-29",
   "is_event_day": false,
   "affected_visibility": 31.88,
   "affected_rank": 4.32,
   "affected_sentiment": 72.77,
   "affected_runs": 58,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-09-30",
   "is_event_day": false,
   "affected_visibility": 33.51,
   "affected_rank": 4.24,
   "affected_sentiment": 73.02,
   "affected_runs": 56,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-10-01",
   "is_event_day": true,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  },
  {
   "day": "2026-10-02",
   "is_event_day": false,
   "affected_visibility": null,
   "affected_rank": null,
   "affected_sentiment": null,
   "affected_runs": 0,
   "comparison_visibility": null,
   "comparison_rank": null,
   "comparison_sentiment": null,
   "comparison_runs": 0
  }
 ],
 "overlaps": []
};
window.UEV_URL_6M = {
 "id": "9c8b7a6d-0021-4e5f-8a9b-000000000021",
 "url": "https://www.solar-verzeichnis.de/anbieter/sonnenkraft",
 "url_input": "https://www.solar-verzeichnis.de/anbieter/sonnenkraft",
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
  "status": "not_observed_within_6_months",
  "first_observed_day": null,
  "first_observed_at": null,
  "first_observed_prompt_run_id": null,
  "day_number": null,
  "observed_before_event": false,
  "search_until": "2026-09-24"
 }
};
window.UEV_RESP_EVENT = [
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
];
window.UEV_RESP_REQ = {
 "p_team": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
 "p_date_from": "2026-09-02",
 "p_date_to": "2026-10-01",
 "p_limit": 15,
 "p_offset": 0,
 "p_event_id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1"
};
window.UEV_RESP_URL = [
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
  "total_count": 31,
  "response_preview": "Eine Photovoltaikanlage für ein Einfamilienhaus kostet 2026 je nach Größe zwischen 12.000 und 20.000 Euro. Anbieter wie He",
  "matched_event_url_ids": [
   "9c8b7a6d-0001-4e5f-8a9b-000000000001",
   "9c8b7a6d-0003-4e5f-8a9b-000000000003"
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
  "total_count": 31,
  "response_preview": "Ein Stromspeicher lohnt sich vor allem, wenn der Eigenverbrauch erhöht werden soll. Typische Speichergrößen liegen bei 5",
  "matched_event_url_ids": [
   "9c8b7a6d-0003-4e5f-8a9b-000000000003"
  ]
 }
];
window.UEV_RESP_NORMAL = [
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
  "total_count": 1214,
  "response_preview": "Eine Photovoltaikanlage für ein Einfamilienhaus kostet 2026 je nach Größe zwischen 12.000 und 20.000 Euro. Anbieter wie He"
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
  "total_count": 1214,
  "response_preview": "Zu den bekanntesten Solaranbietern gehören HelioTech, SolarPlus und Voltaro. Für eine individuelle Beratung empfiehlt sich"
 }
];
window.UEV_PREVIEW_TOPICS = {
 "affected_prompt_count": 47
};
window.UEV_PREVIEW_ALL = {
 "affected_prompt_count": 84
};
window.UEV_PREVIEW_LEER = {
 "affected_prompt_count": 0
};
window.UEV_DELETE_OK = {
 "ok": true,
 "deleted_event_id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1"
};
