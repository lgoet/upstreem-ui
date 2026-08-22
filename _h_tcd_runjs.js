(function () {
  /* Kein toArr, kein toObj mehr: Bubble setzt seine Ausdruecke zwischen Backticks, und ein
     Template-Literal loest Backslash-Escapes auf, BEVOR eine Zeile hier laeuft. Aus \" in einem
     Titel wird ", das JSON ist kaputt, und ein catch machte daraus still ein leeres Array.
     Die Listen und brand gehen deshalb als TEXT an die Komponente -- UC.parseBubbleJson dort ist
     die eine geteilte Reparatur, dieselbe wie in responses-table und domains-table. */
  function toNum(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (s === "") return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  var payload = {
    instanceId: "overview_v2_",
    isDark: "",
    mode: "",                 // "domain" | "url" — welche Liste/welcher Chart aktiv ist
    totalCountDomain: toNum(``),
    totalCountUrl: toNum(``),
    citations_total: toNum(``),
    brand: `{"id": "", "name": "", "logo": ""}`,
    top_domains: `[]`,
    top_urls: `[]`,
    types_breakdown: `[]`,
    url_types_breakdown: `[]`
  };

  var t = 0;
  (function go () {
    var fn = window.renderTopCitations
          || (window.parent && window.parent.renderTopCitations)
          || (window.top && window.top.renderTopCitations);
    if (typeof fn === "function") { fn(payload); return; }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();
