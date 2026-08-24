/* URL DETAIL -- der Run-JS-Schritt. EINE Fassung, mit echten Beispieldaten befuellt, sofort lauffaehig.

   Der Aufbau ist der Aufbau, den diese ganze App fuer Bubble-Text benutzt: EIN Backtick, roher
   JSON-Text, egal wie er von innen aussieht. Kein Objekt, das aus mehreren Backtick-Werten
   zusammengebaut wird -- genau DAS hat zuletzt gebrochen, weil ein rohes Anfuehrungszeichen aus
   einem Feld die Struktur ausserhalb seines eigenen Backticks getroffen hat.

   So gehst du vor: die Werte unten sind die aus dem Auftrag, unveraendert -- der Schritt laeuft
   sofort. Danach ersetzt du EINEN Wert nach dem anderen, direkt im Text, durch deinen
   Bubble-Ausdruck -- z.B. "title":"Festivals in Deutschland..." wird zu "title":<dein Ausdruck>.
   Die Anfuehrungszeichen drumherum bleiben stehen, nur der Inhalt dazwischen wechselt.

   WARUM DAS nicht mehr bricht, selbst wenn dein Wert selbst ein " enthaelt (z.B. ein Titel mit
   Zitat): UC.readBubble in der Komponente kennt genau diesen Fall (core.js, Repair 6) -- ein
   unescaptes Anfuehrungszeichen MITTEN in einem Textwert. Es erkennt am naechsten Zeichen, ob das
   " zur Struktur gehoert (dahinter kommt , : } ] oder das Ende) oder zum Text -- und repariert nur
   dort, wo es wirklich noetig ist. Gemessen (24.08.): ein Titel mit eingebautem Zitat, ein
   Firmenname mit " und Apostroph, eine Zusammenfassung mit " -- alle drei liefen unveraendert
   durch, 0 Fehler.

   Das ist auch der Grund, warum die Werte hier NICHT einzeln in eigenen Backticks stehen: jeder
   zusaetzliche Backtick ist eine zusaetzliche Stelle, an der Bubbles rohe Einfuegung auf
   JavaScript-Syntax trifft, statt auf den geteilten Textreparatur-Weg, der genau dafuer gebaut ist.
   Ein Backtick, ein Text, eine Reparatur.

   markdown_summary steht NICHT hier drin -- es ist JSON IN JSON und braucht deshalb einen EIGENEN
   Backtick (siehe SUMMARY unten), sonst verwechselt der Parser die inneren Anfuehrungszeichen mit
   der aeusseren Struktur. Das ist die einzige Ausnahme, und sie hat einen eigenen Grund. */
(function () {
  var INSTANCE_ID = "urldetail";   // muss zum data-instance des Elements passen

  var DETAIL = `{"url":"https://www.paulcamper.de/magazin/festivals-2025-in-deutschland","title":"Festivals in Deutschland mit Camping: der Guide für Camper","domain":"paulcamper.de","favicon":"https://www.google.com/s2/favicons?domain=paulcamper.de&sz=128","url_type":"listicle","citation_type":"Brand_Platform","last_seen":"2026-08-23T13:25:01.38037+00:00","domain_share":99.15,"global_share":11.60,"global_rank":1,"description":"Die besten Festivals in Deutschland mit Camping – Techno, Rock, Metal, Reggae &amp; Elektro. Mit dem Camper campst du direkt vor Ort, mitten im Geschehen.","companies":[{"logo_url":"https://www.google.com/s2/favicons?domain=airbeat-one.de&sz=64","company_id":"c392c676-6327-4874-8e3f-a919fff7a76c","company_name":"Airbeat One Festival"},{"logo_url":"https://www.google.com/s2/favicons?domain=nature-one.de&sz=64","company_id":"215378ad-9322-498a-9331-b44d3d52a98b","company_name":"Nature One"},{"logo_url":"https://www.google.com/s2/favicons?domain=parookaville.com&sz=64","company_id":"26dd1507-721e-433c-a203-c6bb9ce96d0b","company_name":"Parookaville"},{"logo_url":"https://www.google.com/s2/favicons?domain=www.tomorrowland.com&sz=64","company_id":"37ae6e63-50d0-4d44-a8e0-5527353bf314","company_name":"Tomorrowland"}]}`;

  /* Eigener Backtick, eigener Aufruf -- markdown_summary ist JSON IN JSON. */
  var SUMMARY = `{"summary": "Der Festivalguide von Paulcamper stellt die beliebtesten Open-Air-Festivals in Deutschland vor, die Campingmöglichkeiten bieten. Er deckt verschiedene Musikgenres ab, darunter Techno, Rock, Metal, Reggae und Elektro, und informiert über Termine, Orte, Größe und Preise der Festivals. Besonderer Fokus liegt auf der Anreise mit dem eigenen Camper oder einem gemieteten Wohnmobil von Paulcamper. Der Guide enthält Tipps für das Camping auf Festivals sowie Geheimtipps für kostenlose Veranstaltungen. Zielgruppe sind Camper und Festivalbesucher, die Komfort und Flexibilität suchen."}`;

  var CONVERSION = `[{"url":"https://www.paulcamper.de/magazin/festivals-2025-in-deutschland","role":"competitor","title":"Festivals in Deutschland mit Camping: der Guide für Camper","domain":"paulcamper.de","logo_url":"https://www.google.com/s2/favicons?domain=nature-one.de&sz=64","cited_runs":117,"company_id":"215378ad-9322-498a-9331-b44d3d52a98b","company_name":"Nature One","mentioned_runs":73,"citation_conversion_pct":62.39},{"url":"https://www.paulcamper.de/magazin/festivals-2025-in-deutschland","role":"own","title":"Festivals in Deutschland mit Camping: der Guide für Camper","domain":"paulcamper.de","logo_url":"https://www.google.com/s2/favicons?domain=parookaville.com&sz=64","cited_runs":117,"company_id":"26dd1507-721e-433c-a203-c6bb9ce96d0b","company_name":"Parookaville","mentioned_runs":56,"citation_conversion_pct":47.86},{"url":"https://www.paulcamper.de/magazin/festivals-2025-in-deutschland","role":"competitor","title":"Festivals in Deutschland mit Camping: der Guide für Camper","domain":"paulcamper.de","logo_url":"https://www.google.com/s2/favicons?domain=airbeat-one.de&sz=64","cited_runs":117,"company_id":"c392c676-6327-4874-8e3f-a919fff7a76c","company_name":"Airbeat One Festival","mentioned_runs":33,"citation_conversion_pct":28.21},{"url":"https://www.paulcamper.de/magazin/festivals-2025-in-deutschland","role":"competitor","title":"Festivals in Deutschland mit Camping: der Guide für Camper","domain":"paulcamper.de","logo_url":"https://www.google.com/s2/favicons?domain=www.tomorrowland.com&sz=64","cited_runs":117,"company_id":"37ae6e63-50d0-4d44-a8e0-5527353bf314","company_name":"Tomorrowland","mentioned_runs":2,"citation_conversion_pct":1.71}]`;

  var t = 0;
  (function go () {
    if (typeof window.setUrlDetail === "function") {
      window.setUrlDetail(INSTANCE_ID, DETAIL);
      window.setUrlDetailSummary(INSTANCE_ID, SUMMARY);
      window.setUrlDetailConversion(INSTANCE_ID, CONVERSION);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();

/* ---------- kleine Schritte fuer zwischendurch ----------
window.setUrlDetailLoading("INSTANCE_ID", "yes");
window.setUrlDetailLoading("INSTANCE_ID", "no");
window.resetUrlDetail("INSTANCE_ID");
*/
