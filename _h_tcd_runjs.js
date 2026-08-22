(function () {
  /* Hausmuster, identisch zu responses-table: den rohen RPC-Text in Backticks, als STRING
     durchreichen. Kein eval, kein Sanitizer hier. UC.parseBubbleJson in der Komponente ist die
     eine geteilte Reparatur -- sie kennt das unescapte " im Titel, rohe Zeilenumbrueche,
     nacktes yes/no. Wer hier selbst parst, verliert den Payload still. */
  var URLS    = `[TOP_URLS_RPC]`;
  var DOMAINS = `[TOP_DOMAINS_RPC]`;
  var TYPES   = `[TYPES_BREAKDOWN_RPC]`;
  var UTYPES  = `[URL_TYPES_BREAKDOWN_RPC]`;
  var BRAND   = `[BRAND_RPC]`;

  var t = 0;
  (function go () {
    var w  = window,
        fn = w.renderTopCitations
          || (w.parent && w.parent.renderTopCitations)
          || (w.top && w.top.renderTopCitations);
    if (typeof fn === "function") {
      fn({
        instanceId: `INSTANCE_ID`,
        isDark: `IS_DARK`,
        mode: `MODE`,                            // "domain" | "url"
        totalCountDomain: Number(`[TOTAL_COUNT_DOMAIN]`),
        totalCountUrl:    Number(`[TOTAL_COUNT_URL]`),
        citations_total:  Number(`[CITATIONS_TOTAL]`),
        brand:               BRAND,              // bleiben Strings -- Absicht
        top_domains:         DOMAINS,
        top_urls:            URLS,
        types_breakdown:     TYPES,
        url_types_breakdown: UTYPES
      });
      return;
    }
    if (t++ < 60) { setTimeout(go, 100); return; }
    console.error("[top-citations] renderTopCitations never appeared after 6s -- " +
      "check data-cdn-pin and that the component is actually on this page.");
  })();
})();
