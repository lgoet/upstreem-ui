/* URL DETAIL -- der Run-JS-Schritt. EINE Fassung, mit echten Beispieldaten befuellt, sofort lauffaehig.

   EIN Backtick pro Aufruf, roher JSON-Text -- dasselbe Muster wie in jeder anderen Komponente
   dieses Repos. Kein Objekt, das aus mehreren Backtick-Werten zusammengebaut wird.

   markdown_summary steht GENAU DA, wo deine RPC es wirklich liefert: als Feld MITTEN in DETAIL,
   so wie beim ADAC-Payload gemessen. Das darf jetzt auch dann bleiben, wenn es selbst unescaptes
   JSON ist ({"summary": "..."} roh, ohne \" davor) -- UC.readBubble in der Komponente erkennt
   genau dieses Muster, zieht das Feld gezielt heraus, repariert den Rest normal. Gemessen (24.08.,
   der ADAC-Payload aus dem Bugreport, wortgleich): 14 Felder, 11 Firmen, Zusammenfassung -- alle
   korrekt gelesen, 0 Konsolenfehler.

   setUrlDetailSummary ist OPTIONAL -- nur fuer Aufbauten, die markdown_summary als EIGENEN
   Bubble-Wert getrennt vom Rest der Zeile haben (wie im bestehenden Zusammenfassungs-Widget der
   App). Wird er gerufen, gewinnt er; sonst zaehlt automatisch das Feld aus DETAIL.

   Jeder der drei Aufrufe unten steht in einem EIGENEN try/catch: fehlt einer der drei
   Bubble-Ausdruecke oder ist er (noch) nicht verdrahtet, reisst das NICHT die anderen beiden mit.
   Genau das ist am 24.08. passiert -- ein undefinierter SUMMARY-Wert hat per ReferenceError den
   ganzen Schritt gestoppt, auch DETAIL und CONVERSION liefen dadurch nie. */
(function () {
  var INSTANCE_ID = "urldetail";   // muss zum data-instance des Elements passen

  var DETAIL = `{"url":"https://www.paulcamper.de/magazin/festivals-2025-in-deutschland","title":"Festivals in Deutschland mit Camping: der Guide für Camper","domain":"paulcamper.de","favicon":"https://www.google.com/s2/favicons?domain=paulcamper.de&sz=128","url_type":"listicle","citation_type":"Brand_Platform","last_seen":"2026-08-23T13:25:01.38037+00:00","domain_share":99.15,"global_share":11.60,"global_rank":1,"description":"Die besten Festivals in Deutschland mit Camping – Techno, Rock, Metal, Reggae &amp; Elektro. Mit dem Camper campst du direkt vor Ort, mitten im Geschehen.","markdown_summary":"{"summary": "Der Festivalguide von Paulcamper stellt die beliebtesten Open-Air-Festivals in Deutschland vor, die Campingmöglichkeiten bieten. Er deckt verschiedene Musikgenres ab, darunter Techno, Rock, Metal, Reggae und Elektro, und informiert über Termine, Orte, Größe und Preise der Festivals."}","companies":[{"logo_url":"https://www.google.com/s2/favicons?domain=airbeat-one.de&sz=64","company_id":"c392c676-6327-4874-8e3f-a919fff7a76c","company_name":"Airbeat One Festival"},{"logo_url":"https://www.google.com/s2/favicons?domain=nature-one.de&sz=64","company_id":"215378ad-9322-498a-9331-b44d3d52a98b","company_name":"Nature One"},{"logo_url":"https://www.google.com/s2/favicons?domain=parookaville.com&sz=64","company_id":"26dd1507-721e-433c-a203-c6bb9ce96d0b","company_name":"Parookaville"},{"logo_url":"https://www.google.com/s2/favicons?domain=www.tomorrowland.com&sz=64","company_id":"37ae6e63-50d0-4d44-a8e0-5527353bf314","company_name":"Tomorrowland"}]}`;

  var CONVERSION = `[{"url":"https://www.paulcamper.de/magazin/festivals-2025-in-deutschland","role":"competitor","title":"Festivals in Deutschland mit Camping: der Guide für Camper","domain":"paulcamper.de","logo_url":"https://www.google.com/s2/favicons?domain=nature-one.de&sz=64","cited_runs":117,"company_id":"215378ad-9322-498a-9331-b44d3d52a98b","company_name":"Nature One","mentioned_runs":73,"citation_conversion_pct":62.39},{"url":"https://www.paulcamper.de/magazin/festivals-2025-in-deutschland","role":"own","title":"Festivals in Deutschland mit Camping: der Guide für Camper","domain":"paulcamper.de","logo_url":"https://www.google.com/s2/favicons?domain=parookaville.com&sz=64","cited_runs":117,"company_id":"26dd1507-721e-433c-a203-c6bb9ce96d0b","company_name":"Parookaville","mentioned_runs":56,"citation_conversion_pct":47.86},{"url":"https://www.paulcamper.de/magazin/festivals-2025-in-deutschland","role":"competitor","title":"Festivals in Deutschland mit Camping: der Guide für Camper","domain":"paulcamper.de","logo_url":"https://www.google.com/s2/favicons?domain=airbeat-one.de&sz=64","cited_runs":117,"company_id":"c392c676-6327-4874-8e3f-a919fff7a76c","company_name":"Airbeat One Festival","mentioned_runs":33,"citation_conversion_pct":28.21},{"url":"https://www.paulcamper.de/magazin/festivals-2025-in-deutschland","role":"competitor","title":"Festivals in Deutschland mit Camping: der Guide für Camper","domain":"paulcamper.de","logo_url":"https://www.google.com/s2/favicons?domain=www.tomorrowland.com&sz=64","cited_runs":117,"company_id":"37ae6e63-50d0-4d44-a8e0-5527353bf314","company_name":"Tomorrowland","mentioned_runs":2,"citation_conversion_pct":1.71}]`;

  var t = 0;
  (function go () {
    if (typeof window.setUrlDetail !== "function") {
      if (t++ < 60) setTimeout(go, 100);
      return;
    }
    try { window.setUrlDetail(INSTANCE_ID, DETAIL); } catch (e) { if (window.console) console.error("[url-detail] setUrlDetail:", e); }
    try { window.setUrlDetailConversion(INSTANCE_ID, CONVERSION); } catch (e) { if (window.console) console.error("[url-detail] setUrlDetailConversion:", e); }
    /* Optional -- siehe Kopfkommentar. Nur aktivieren, wenn markdown_summary als EIGENER Wert da ist:
    try { window.setUrlDetailSummary(INSTANCE_ID, `[SUMMARY_TEXT]`); } catch (e) { if (window.console) console.error("[url-detail] setUrlDetailSummary:", e); }
    */
  })();
})();

/* ---------- kleine Schritte fuer zwischendurch ----------
window.setUrlDetailLoading("INSTANCE_ID", "yes");
window.setUrlDetailLoading("INSTANCE_ID", "no");
window.resetUrlDetail("INSTANCE_ID");
*/
