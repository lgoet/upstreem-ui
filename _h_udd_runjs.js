/* SCHRITT 1 von 2 -- Seitenstart. GENAU so, wie er in Bubble steht, unveraendert getestet.
   Liefert den Kopf, die Zitationsanteils-Reihe, die Modelle und den Trichter: alles, was die
   Seite im Start-Modus "Citation Share" zeigt. Die URL-Serie fuer den Domain-Share ist NICHT
   dabei -- die kommt in Schritt 2 am Klick, siehe _h_udd_runjs_urls.js. */
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
    types_breakdown: [
      { type: "article", share_pct: 45.21 },
      { type: "homepage", share_pct: 30.14 },
      { type: "video", share_pct: 14.9 },
      { type: "uncategorized", share_pct: 9.75 }
    ],
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

  /* Die Setter sind Boot-Stubs, solange domain-detail.js noch laedt -- ein Aufruf landet dann in
     der Warteschlange und wird nachgeholt. Fehlen sie GANZ, ist das Element noch nicht gebaut:
     dann in 100ms-Schritten warten, hoechstens 6 Sekunden, und danach EINMAL sagen warum. */
  var versuche = 0;
  (function los(){
    if (typeof window.setDomainDetail === "function") {
      window.setDomainDetail(INSTANCE_ID, JSON.stringify(MAIN));
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[domain-detail] setDomainDetail gibt es nach 6s nicht. " +
      "Steht das HTML-Element auf der Seite und ist es sichtbar?");
  })();
})();
