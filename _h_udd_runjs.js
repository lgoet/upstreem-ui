/* GENAU der Run-JS-Schritt, wie er in Bubble stehen soll -- unveraendert getestet. */
(function(){
  var INSTANCE_ID = "domain_detail_page";

  var MAIN = {
    header: {
      id: "youtube.com", domain: "youtube.com",
      favicon: "https://www.youtube.com/s/desktop/e2e75771/img/favicon_32x32.png",
      first_seen: "2026-08-08", last_seen: "2026-08-18", citation_type: "UGC_Community",
      current_citation_share: 23.65, citation_share_delta_pct: 3.51,
      citation_share_prev: 20.14, total_citations_count: 622, total_citations_prev: 269,
      total_citations_delta_pct: 131.23
    },
    timeseries: {
      citation_share_over_time: [
        { day: "2026-08-12", share_pct: 26.74 }, { day: "2026-08-13", share_pct: 22.07 },
        { day: "2026-08-14", share_pct: 22.84 }, { day: "2026-08-15", share_pct: 23.50 },
        { day: "2026-08-16", share_pct: 22.68 }, { day: "2026-08-17", share_pct: 23.56 },
        { day: "2026-08-18", share_pct: 24.56 }
      ]
    },
    model_breakdown: [
      { model: "Google AI Overviews", model_share_pct: 98.75,
        color_lightmode: "#4285F4", color_darkmode: "#8AB4F8",
        model_logo_url: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" },
      { model: "ChatGPT", model_share_pct: 1.25,
        color_lightmode: "#111827", color_darkmode: "#F3F4F6",
        model_logo_url: "https://cdn-icons-png.freepik.com/512/12222/12222588.png" }
    ],
    source_presence_funnel: {
      ai_searches_citing_domain: 320, cited_urls_count: 93,
      urls_with_tracked_brands: 2, tracked_brand_presence_pct: 2.15,
      urls_mentioning_you: 0, your_url_presence_pct: 0.00,
      urls_mentioning_competitors: 2, urls_without_tracked_brands: 91
    }
  };

  var TITEL = [
    ["https://www.youtube.com/watch?v=hFrdQNb0920", "So arbeiten die besten Handwerksbetriebe wirklich - YouTube", 5.2980, 30.0000],
    ["https://www.youtube.com/watch?v=c6uXUxbeOL0", "Handwerkersoftware-Vergleich 2026: Wie gut sind Streit, Bosc", 3.5872, 20.3125],
    ["https://www.youtube.com/watch?v=T-fOIKFC1zQ", "Lohnt sich die Handwerkersoftware PlanCraft fuer Handwerker i", 2.2627, 12.8125],
    ["https://www.youtube.com/watch?v=GF-TG-z3rUo", "5 Automatisierungen zum Zeit sparen fuer Handwerks-, Bau- & I", 1.9316, 10.9375],
    ["https://www.youtube.com/watch?v=PVbt_rWnh68", "Welche Handwerkersoftware ist die Beste fuer dich? Handwerker", 1.8212, 10.3125]
  ];
  var TAGE = {
    "2026-08-12": [6.08, 4.18, 2.28, 2.66, 1.90], "2026-08-13": [7.63, 3.44, 2.29, 2.29, 2.29],
    "2026-08-14": [4.20, 3.44, 1.53, 1.53, 1.53], "2026-08-15": [5.75, 3.45, 1.53, 1.15, 1.92],
    "2026-08-16": [5.36, 3.45, 1.92, 2.30, 0.77], "2026-08-17": [3.86, 3.86, 3.47, 1.54, 2.32],
    "2026-08-18": [4.10, 3.28, 2.87, 2.05, 2.05]
  };
  var punkte = [];
  Object.keys(TAGE).sort().forEach(function (tag) {
    TITEL.forEach(function (t, i) {
      punkte.push({ day: tag, url: t[0], title: t[1], share_pct: TAGE[tag][i],
                    share_total_pct: t[2], domain_share_total_pct: t[3], global_share_total_pct: t[2] });
    });
  });
  var URLS = { from: "2026-08-12", to: "2026-08-18", top_n: 5, domain: "youtube.com",
               share_mode: "global", points: punkte };

  /* Die Setter sind Boot-Stubs, solange domain-detail.js noch laedt -- ein Aufruf landet dann in
     der Warteschlange und wird nachgeholt. Fehlen sie GANZ, ist das Element noch nicht gebaut:
     dann in 100ms-Schritten warten, hoechstens 6 Sekunden, und danach EINMAL sagen warum. */
  var versuche = 0;
  (function los(){
    if (typeof window.setDomainDetail === "function" && typeof window.setDomainDetailUrls === "function") {
      window.setDomainDetail(INSTANCE_ID, JSON.stringify(MAIN));
      window.setDomainDetailUrls(INSTANCE_ID, JSON.stringify(URLS));
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[domain-detail] setDomainDetail gibt es nach 6s nicht. " +
      "Steht das HTML-Element auf der Seite und ist es sichtbar?");
  })();
})();
