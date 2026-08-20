/* Beispieldaten fuer das Onboarding. Projekt, Marken, Prompts und Tarife sind WORTGLEICH die
   Payloads aus der Aufgabe -- nichts erfunden, nichts gekuerzt. Erfunden sind nur die Themen und
   die zusaetzlichen Prompts, weil es beides in der heutigen Fassung noch nicht gibt.

   Die Datei liegt am Fenster (window.__uobDemo), weil onboarding-page.js sie im Demobetrieb von
   dort liest -- so bleibt die Komponente frei von Beispieldaten, und dieselbe Datei laesst sich
   im Harness und in einer Bubble-Testseite verwenden. */
window.__uobDemo = {

  project: {
    "id": "9346b43e-f7b9-4122-ad10-0869aaecc21d",
    "user_id": "aea6e317-d901-419b-b2b2-5ca3573ea2f5",
    "mode": "Brand",
    "business_model": "B2B",
    "brand_industry": "Lautsprecher / Beschallung",
    "market_focus": null,
    "website_input": "https://www.funktion-one.com",
    "website_url": "https://funktion-one.com",
    "website_domain": "funktion-one.com",
    "status": "ready",
    "run_group_uuid": null,
    "status_phase": 5,
    "status_label": "Finalizing insights",
    "progress_percent": 100,
    "last_error": null,
    "created_at": "2026-08-20T11:52:29.900336+00:00",
    "updated_at": "2026-08-20T11:52:29.97104+00:00",
    "company_name": "Function One",
    "summary": "Funktion-One ist ein Hersteller professioneller Lautsprechersysteme fuer Tourneen, Festivals, Arenen, Clubs und Installationen.",
    "market": "DE",
    "selected_billing_plan_id": null,
    "billing_interval": null,
    "stripe_checkout_session_id": null,
    "stripe_checkout_url": null,
    "team_id": null
  },

  brands: [
    { "id": "f6450b61-b104-44b8-a9f9-c9cd30f53c58", "name": "d&b audiotechnik", "domain": "dbaudio.com",
      "url": "https://dbaudio.com", "favicon_url": "https://www.google.com/s2/favicons?domain=dbaudio.com&sz=64", "selected": false },
    { "id": "56f0910d-a8dc-4f48-8f52-1d5bc86ba038", "name": "L-Acoustics", "domain": "l-acoustics.com",
      "url": "https://l-acoustics.com", "favicon_url": "https://www.google.com/s2/favicons?domain=l-acoustics.com&sz=64", "selected": false },
    { "id": "3d0c0160-25a0-475b-bab3-29b4f5cd120b", "name": "Meyer Sound", "domain": "meyersound.com",
      "url": "https://meyersound.com", "favicon_url": "https://www.google.com/s2/favicons?domain=meyersound.com&sz=64", "selected": false },
    { "id": "ae8e82b0-fb4f-4b56-a052-00cc730a97e2", "name": "KV2 Audio", "domain": "kv2audio.com",
      "url": "https://kv2audio.com", "favicon_url": "https://www.google.com/s2/favicons?domain=kv2audio.com&sz=64", "selected": false },
    { "id": "1ddc14fd-f7e1-4c83-98a6-4433b7b9222a", "name": "CODA Audio", "domain": "codaaudio.com",
      "url": "https://codaaudio.com", "favicon_url": "https://www.google.com/s2/favicons?domain=codaaudio.com&sz=64", "selected": false },
    { "id": "9a2fad22-cb7b-4acc-919f-da37972d6bcd", "name": "NEXO", "domain": "nexo-sa.com",
      "url": "https://nexo-sa.com", "favicon_url": "https://www.google.com/s2/favicons?domain=nexo-sa.com&sz=64", "selected": false },
    { "id": "1fff4526-d922-4305-820b-6ef33d607c7d", "name": "RCF", "domain": "rcf.it",
      "url": "https://rcf.it", "favicon_url": "https://www.google.com/s2/favicons?domain=rcf.it&sz=64", "selected": false },
    { "id": "422b43a8-ec22-49d3-ae0f-7c893b22b4e0", "name": "Electro-Voice", "domain": "electrovoice.com",
      "url": "https://electrovoice.com", "favicon_url": "https://www.google.com/s2/favicons?domain=electrovoice.com&sz=64", "selected": false }
  ],

  /* Sieben Themen. Ohne Emoji, wie verlangt -- der farbige Koerper traegt die Unterscheidung.
     hex_light/hex_dark wie in der Themenverwaltung der App; wo sie fehlen, greift die Palette
     aus core. */
  topics: [
    { "id": "t-line-array",  "name": "Line Array Systems",
      "description": "Vertikal arraybare Systeme fuer grosse Flaechen",
      "hex_light": "#1b6eda", "hex_dark": "#1b6eda" },
    { "id": "t-touring",     "name": "Festival & Touring Sound",
      "description": "Open Air, Tourneen, wechselnde Spielstaetten",
      "hex_light": "#de1b22", "hex_dark": "#de1b22" },
    { "id": "t-club",        "name": "Club & Nightlife",
      "description": "Feste Installationen in Clubs und Bars",
      "hex_light": "#9145e8", "hex_dark": "#9145e8" },
    { "id": "t-spatial",     "name": "Spatial & Immersive Audio",
      "description": "Objektbasiertes Mischen, raeumliche Wiedergabe",
      "hex_light": "#107c84", "hex_dark": "#107c84" },
    { "id": "t-amps",        "name": "Amplifiers & Rigging",
      "description": "Endstufenracks, Traversen, Transporthardware",
      "hex_light": "#8d6a11", "hex_dark": "#8d6a11" },
    { "id": "t-efficiency",  "name": "Energy Efficiency",
      "description": "Wirkungsgrad, Leistungsbedarf, Nachhaltigkeit",
      "hex_light": "#108440", "hex_dark": "#108440" },
    { "id": "t-venues",      "name": "Arenas & Venues",
      "description": "Mehrzweckhallen, Theater, Arenen",
      "hex_light": "#d51a8b", "hex_dark": "#d51a8b" }
  ],

  /* Dreizehn Prompts. Die ersten vier sind wortgleich die aus der Aufgabe, nur mit topic_ids.
     Vier davon tragen ZWEI Themen -- genau der Fall, an dem die Gruppierung sich beweisen muss:
     jeder Prompt steht einmal, unter seinem ersten Thema, die uebrigen als Marken am Zeilenende. */
  prompts: [
    { "id": "p1",  "prompt_text": "beste Line-Array-Lautsprecher fuer Festivals und Arenatouren",
      "market": "DE", "selected": false, "topic_ids": ["t-line-array", "t-touring"] },
    { "id": "p2",  "prompt_text": "Welcher Pro-Audio-Hersteller bietet energieeffiziente Touring-PA-Systeme mit hoher Sprachverstaendlichkeit fuer Open-Air-Festivals?",
      "market": "DE", "selected": false, "topic_ids": ["t-efficiency", "t-touring"] },
    { "id": "p3",  "prompt_text": "Top Anbieter von raeumlichen Beschallungssystemen und Objekt-basiertem Mixing fuer Theater und Mehrzweckhallen in Europa",
      "market": "DE", "selected": false, "topic_ids": ["t-spatial", "t-venues"] },
    { "id": "p4",  "prompt_text": "vergleiche Hersteller von vertikal arraybaren Lautsprechersystemen und passenden Endstufenracks fuer grosse Konzertproduktionen",
      "market": "DE", "selected": false, "topic_ids": ["t-line-array", "t-amps"] },
    { "id": "p5",  "prompt_text": "welches Line-Array-System hat die beste Direktivitaetskontrolle bei langen Wurfweiten",
      "market": "DE", "selected": false, "topic_ids": ["t-line-array"] },
    { "id": "p6",  "prompt_text": "PA-System fuer ein Festival mit 20.000 Besuchern - welche Hersteller kommen infrage?",
      "market": "DE", "selected": false, "topic_ids": ["t-touring"] },
    { "id": "p7",  "prompt_text": "beste Clublautsprecher fuer elektronische Musik mit sauberem Tiefbass",
      "market": "DE", "selected": false, "topic_ids": ["t-club"] },
    { "id": "p8",  "prompt_text": "welche Beschallungsmarken werden in Technoclubs am haeufigsten verbaut?",
      "market": "DE", "selected": false, "topic_ids": ["t-club"] },
    { "id": "p9",  "prompt_text": "Loesungen fuer objektbasiertes Mischen in Theatern - Anbieter im Vergleich",
      "market": "DE", "selected": false, "topic_ids": ["t-spatial"] },
    { "id": "p10", "prompt_text": "welche Verstaerkerracks passen zu grossen Touring-Lautsprechersystemen?",
      "market": "DE", "selected": false, "topic_ids": ["t-amps"] },
    { "id": "p11", "prompt_text": "Lautsprecher mit hohem Wirkungsgrad - welche Hersteller brauchen am wenigsten Strom pro dB?",
      "market": "DE", "selected": false, "topic_ids": ["t-efficiency"] },
    { "id": "p12", "prompt_text": "Beschallungsanlage fuer eine Mehrzweckhalle - worauf kommt es bei der Auswahl an?",
      "market": "DE", "selected": false, "topic_ids": ["t-venues"] },
    { "id": "p13", "prompt_text": "welche Lautsprecherhersteller gelten als nachhaltig in der Veranstaltungstechnik?",
      "market": "DE", "selected": false, "topic_ids": ["t-efficiency"] }
  ],

  plans: [
    { "id": "54be31d2-dc61-4a5e-8ea0-31c4370a4cb3", "name": "Essential",
      "monthly_price_eur": 89.00, "yearly_price_eur": 948.00,
      "prompts_per_day": 50, "competitors_max_active": 5, "trial_days": 30, "sort_order": null },
    { "id": "3129be58-d59a-4221-ba53-7b2e4131cf5f", "name": "Professional",
      "monthly_price_eur": 205.00, "yearly_price_eur": 2220.00,
      "prompts_per_day": 150, "competitors_max_active": 10, "trial_days": 30, "sort_order": null },
    { "id": "a980c741-807e-43dd-9617-8e06b82999ba", "name": "Enterprise",
      "monthly_price_eur": 429.00, "yearly_price_eur": 4380.00,
      "prompts_per_day": 350, "competitors_max_active": 15, "trial_days": 30, "sort_order": null }
  ]
};
