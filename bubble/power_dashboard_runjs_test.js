/* STATISCH ZUM TESTEN -- OHNE Run-JS-Schritt.
   Die Daten stehen im INHALT von vier Elementen, nicht in JS-Quelltext. Deshalb vertragen sie
   jedes Zeichen: der Chattitel unten traegt wortwoertlich den Backtick, an dem der alte Schritt
   am 15.09. gestorben ist ("Unexpected identifier 'https'"), dazu ${, einen Backslash, echte
   Zeilenumbrueche und ein Emoji.

   Diese Datei ist KEIN Workflow-Schritt. Sie zeigt das Markup, das auf die Seite gehoert -- in
   Bubble ein verstecktes Element je Id, gefuellt mit dem dynamischen Ausdruck. Zum Ausprobieren
   ohne Bubble: den Block in die Seite einfuegen, fertig. Es laeuft kein Schritt, es gibt nichts
   zu escapen.

<div style="display:none">

  <div id="upw-data">
  { "overview": { "range_label": "Last 30 days", "visibility_pct": 2.83, "visibility_delta_pct": 0.17,
      "visibility_position": 2, "brand_count": 8, "avg_rank": 3.6, "avg_rank_delta": 0.42,
      "best_rank": 2.38, "sentiment": 75, "sentiment_delta": -2.11, "field_avg_sentiment": 73 },
    "brands": [
      { "position": 1, "name": "Anfragenfluss", "visibility_pct": 5.8,
        "visibility_delta_pct": 0.8, "is_own": "no" },
      { "position": 2, "name": "LeeUp Media", "visibility_pct": 2.83,
        "visibility_delta_pct": 0.17, "is_own": "yes" } ],
    "citations_label": "Last 30 days",
    "top_domains": [
      { "domain": "youtube.com", "share_pct": 21.68, "share_delta_pct": 0.58 },
      { "domain": "omr.com", "share_pct": 13.61, "share_delta_pct": -0.22 } ],
    "top_urls": [],
    "errors": { "citations_url": "timeout beim Abruf" } }
  </div>

  <div id="upw-chats-data">
  [ { "id": "ce9ab4cc", "title": "Bewertungen ueber LeeUP",
      "preview": "Die URL `https://de.trustpilot.com/review/lee-up.de` ist deine Bewertungsseite.",
      "updated_at": "2026-09-09T05:48:17+00:00", "status": "active", "is_pinned": "no" } ]
  </div>

  <div id="upw-projects-data">
  [ { "id": "e41479ed", "title": "Reportings", "status": "active", "session_count": 7 } ]
  </div>

  <div id="upw-opportunities-data">
  [ { "id": "opp_1", "status": "Created", "label": "Guest post", "priority_label": "High",
      "headline": "Get listed on omr.com", "reason": "Zitiert in 41 % der Antworten.",
      "lead_domain": "omr.com", "lead_url": "https://omr.com/x",
      "created_at": "2026-09-01T09:00:00Z" } ]
  </div>

</div>
*/
