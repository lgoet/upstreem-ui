(function(){
  var INSTANCE_ID = "response_detail_page";

  var MODELLE = [
    { key: "chatgpt",    display_name: "ChatGPT", short_name: "ChatGPT",
      logo_url: "https://cdn-icons-png.freepik.com/512/12222/12222588.png" },
    { key: "google-aio", display_name: "Google AI Overviews", short_name: "Google AIO",
      logo_url: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" },
    { key: "perplexity", display_name: "Perplexity", short_name: "Perplexity",
      logo_url: "https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64" }
  ];

  var TEXT = "Kurzer Einstiegsabsatz mit einer Marke: LeeUP Media ist dabei. [0](https://www.lee-up.de/solar) [1](https://anfragenfluss.de/neuigkeiten/beste-agentur-photovoltaik-leads)\n\n## Zwischentitel\n\n- Erster Listenpunkt mit **fett** darin\n- Zweiter Listenpunkt mit einem Zitat [1](https://anfragenfluss.de/neuigkeiten/beste-agentur-photovoltaik-leads)\n\n| Anbieter | Bewertung | Preis |\n| --- | :---: | ---: |\n| LeeUP Media | gut | 1.200 |\n| Anfragenfluss | sehr gut | 900 |\n\nEin Absatz mit \"Anfuehrungszeichen\" und einem Backslash C:\\temp, damit sichtbar ist, dass beides haelt.\n\n[[0] - Marketing für Solarbetriebe - LeeUP Media GmbH](https://www.lee-up.de/solar)\n[[1] - Beste Agentur für Photovoltaik-Leads - Anfragenfluss](https://anfragenfluss.de/neuigkeiten/beste-agentur-photovoltaik-leads)";

  var DATEN = [{
    prompt_run_id: "f052a30f-0b42-4fb9-a672-2bf797ff42e5",
    id: "f052a30f-0b42-4fb9-a672-2bf797ff42e5",
    run_at: "2026-08-18T14:04:32.103284+00:00",
    run_day: "2026-08-18",
    model: "google-aio",
    model_detailed: "searchapi-google_ai_overview+websearch",
    prompt_id: "e6784605-2649-418c-92be-6b6e14abc919",
    prompt_text: "wer sind die führenden Anbieter für digitale Marketinglösungen im Bereich Solar?",
    market: "DE",
    tags: [
      { id: "2e29b676-3e9b-485a-8821-de01c34281fd", name: "Solar", emoji: "☀️",
        hex_light: "#f59e0b", hex_dark: "#fbc55a" }
    ],
    response_json: {
      meta: { run_key: "962ed0083a526434ee1a178ac7-fa1bba5ef",
              model_start_iso: "2026-08-18T14:04:18.373+00:00" },
      text: TEXT
    },
    companies: [
      { name: "LeeUp Media", rank: 6, sentiment: 57,
        company_id: "88640dff-6468-471a-bee4-6c17d2ed0399",
        favicon_url: "https://www.google.com/s2/favicons?domain=lee-up.de&sz=64",
        brand_name_raw: "LeeUP Media" }
    ],
    citations: [
      { url: "https://www.lee-up.de/solar",
        title: "LeeUP Media GmbH - Marketing für Solarbetriebe",
        domain: "lee-up.de",
        favicon: "https://www.google.com/s2/favicons?domain=lee-up.de&sz=128",
        mentions: [
          { name: "LeeUp Media", role: "own", count: 1,
            company_id: "88640dff-6468-471a-bee4-6c17d2ed0399", match_type: null,
            favicon_url: "https://www.google.com/s2/favicons?domain=lee-up.de&sz=64" }
        ],
        description: "LeeUP Media GmbH - Marketing für Solarbetriebe, Digitalisierung und Recruiting für Handwerks- und Solarbetriebe." },
      { url: "https://anfragenfluss.de/neuigkeiten/beste-agentur-photovoltaik-leads",
        title: "Beste Agentur für Photovoltaik-Leads: 7 Kriterien · Anfragenfluss",
        domain: "anfragenfluss.de",
        favicon: "https://www.google.com/s2/favicons?domain=anfragenfluss.de&sz=128",
        mentions: [],
        description: "Woran erkennst du die beste Agentur für Photovoltaik-Leads? 7 Prüfkriterien, typische Red Flags und der Fragenkatalog fürs Erstgespräch." },
      { url: "https://www.mittelstand-digital.de/MD/Redaktion/DE/Karte/Kompetenzzentren-Projekte/mittelstand-digital-zentrum-handwerk.html",
        title: "Mittelstand Digital | Mittelstand-Digital Zentrum Handwerk",
        domain: "mittelstand-digital.de",
        favicon: "https://www.google.com/s2/favicons?domain=mittelstand-digital.de&sz=128",
        mentions: [],
        description: "Mittelstand Digital | Mittelstand-Digital Zentrum Handwerk — title: \"Radware Captcha Page\" We apologize for the inconvenience... ...but your activity..." }
    ]
  }];

  var versuche = 0;
  (function los(){
    if (typeof window.setResponseDetail === "function") {
      if (typeof MODELLE !== "undefined" && typeof window.setUpstreemModels === "function") {
        window.setUpstreemModels(JSON.stringify(MODELLE));
      }
      window.setResponseDetail(INSTANCE_ID, JSON.stringify(DATEN));
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[response-detail] setResponseDetail gibt es nach 6s nicht.");
  })();
})();
