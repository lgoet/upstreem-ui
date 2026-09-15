/* STATISCH ZUM TESTEN -- die Hausform aus urls_table_bubble.html / brand_detail_bubble.html.
   EIN Backtick je Ausdruck, in einer eigenen Variablen, beide Ersetzungen darauf, ROHER Text in
   den Setter. Kein JSON.parse, kein handgebautes Objekt, kein :formatted as JSON-safe, kein
   find & replace -- UC.readBubble in der Komponente ist der eine geteilte Leseweg.

   Die Daten sind absichtlich beschaedigt, damit die Reparatur mitgemessen wird: nacktes yes/no,
   ein leerer Wert, ein echter Zeilenumbruch, ein unescaptes Anfuehrungszeichen mitten im Text
   und ein Emoji.

   chats traegt id, title und updated_at -- KEIN preview. Das Feld steht in keiner Spezifikation,
   wird von keiner Komponente gelesen und trug den Backtick, der den Schritt am 15.09. getoetet
   hat. Fuer den Einsatz: die Backtick-Inhalte durch die Bubble-Ausdruecke ersetzen. */
(function () {
  var HAUPT = `{ "overview": { "visibility_pct": 2.83, "visibility_delta_pct": 0.17,
      "visibility_position": 2, "brand_count": 8, "avg_rank": 3.6, "avg_rank_delta": 0.42,
      "best_rank": 2.38, "sentiment": 75, "sentiment_delta": -2.11, "field_avg_sentiment": 73 },
    "brands": [
      { "position": 1, "name": "Anfragenfluss", "visibility_pct": 5.8, "visibility_delta_pct": 0.8, "is_own": no },
      { "position": 2, "name": "LeeUp Media", "visibility_pct": 2.83, "visibility_delta_pct": 0.17, "is_own": yes } ],
    "citations_label": "Last 30 days",
    "top_domains": [ { "domain": "youtube.com", "share_pct": 21.68, "share_delta_pct": 0.58 },
                     { "domain": "omr.com", "share_pct": 13.61, "share_delta_pct": -0.22 } ],
    "top_urls": [],
    "totalCountUrl": ,
    "errors": { "citations_url": "timeout beim Abruf" } }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var CHATS = `[ { "id": "ce9ab4cc", "title": "Bewertungen über LeeUP -- mit "Zitat" drin 🚀",
      "updated_at": "2026-09-09T05:48:17+00:00" },
    { "id": "60315a85", "title": "Markenvergleich mit Anfragenfluss",
      "updated_at": "2026-09-13T06:25:45+00:00" } ]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var PROJ = `[ { "id": "e41479ed", "title": "Reportings", "status": "active", "session_count": 7 } ]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var OPPS = `[ { "id": "opp_1", "status": "Created", "label": "Guest post", "priority_label": "High",
      "headline": "Get listed on omr.com", "reason": "Zitiert in 41 % der Antworten.
Zweite Zeile.", "lead_domain": "omr.com", "lead_url": "https://omr.com/x",
      "created_at": "2026-09-01T09:00:00Z" } ]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.renderPowerDashboard) window.renderPowerDashboard(HAUPT); } catch (e) {}
  try { if (window.askMiraSetPreviousChats) window.askMiraSetPreviousChats(CHATS); } catch (e) {}
  try { if (window.askMiraSetProjects) window.askMiraSetProjects(PROJ); } catch (e) {}
  try { if (window.opportunitiesSetItems) window.opportunitiesSetItems(OPPS); } catch (e) {}
})();
