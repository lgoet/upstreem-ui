/* STATISCH ZUM TESTEN -- die Hausform, sofort lauffaehig ohne Bubble.
   EIN Backtick je Ausdruck, beide Ersetzungen darauf, ROHER Text in den Setter. Kein JSON.parse,
   kein von Hand gebautes Objekt, kein :formatted as JSON-safe -- UC.readBubble in der Komponente
   ist der eine geteilte Leseweg.
   Die Beispieldaten sind absichtlich beschaedigt, damit die Reparatur mitgemessen wird: nacktes
   yes/no, ein leerer Wert ("totalCountUrl": ,), ein echter Zeilenumbruch, ein unescaptes
   Anfuehrungszeichen mitten im Text und ein Emoji.
   Gemessen am 15.09.: 0 Fehler, alle vier Bereiche gefuellt, eigene Marke als is-own erkannt,
   URL-Modus zeigt den Abschnittsfehler.
   Fuer den Einsatz: die Backtick-Inhalte durch die Bubble-Ausdruecke ersetzen. */
(function () {
  function sauber(s){
    return s.replace(/:\s*([,}\]])/g, ": null$1")
            .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  }
  var haupt = sauber(`{ "overview": { "visibility_pct": 2.83, "visibility_delta_pct": 0.17,
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
    "errors": { "citations_url": "timeout beim Abruf" } }`);
  var chats = sauber(`[ { "id": "ce9ab4cc", "title": "Bewertungen über LeeUP",
      "preview": "Die URL https://de.trustpilot.com/review/lee-up.de ist deine Seite -- mit "Zitat" drin.
Und einer zweiten Zeile. 🚀", "updated_at": "2026-09-09T05:48:17+00:00", "status": "active", "is_pinned": no } ]`);
  var proj  = sauber(`[ { "id": "e41479ed", "title": "Reportings", "status": "active", "session_count": 7 } ]`);
  var opps  = sauber(`[ { "id": "opp_1", "status": "Created", "label": "Guest post", "priority_label": "High",
      "headline": "Get listed on omr.com", "reason": "Zitiert in 41 % der Antworten.", "lead_domain": "omr.com",
      "lead_url": "https://omr.com/x", "created_at": "2026-09-01T09:00:00Z" } ]`);

  try { window.renderPowerDashboard(haupt); } catch (e) {}
  try { window.askMiraSetPreviousChats(chats); } catch (e) {}
  try { window.askMiraSetProjects(proj); } catch (e) {}
  try { window.opportunitiesSetItems(opps); } catch (e) {}
})();
