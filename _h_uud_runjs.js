/* URL DETAIL -- die Seite fuellen

   WANN: beim Aufbau der Detailseite, sobald die RPC geantwortet hat.

   Beide Payloads gehen als TEXT rein, roh zwischen den Backticks. Nicht im Schritt parsen, nicht
   JSON-safe formatieren: UC.readBubble in der Komponente liest gueltiges JSON unveraendert,
   repariert Bubbles Eigenheiten und trennt LEER von UNLESBAR -- ein unlesbarer Payload steht
   dann als Fehlerband oben statt als leere Seite.

   Die Warteschleife braucht es, weil Bubble diesen Schritt vor der Komponente ausfuehren kann. */
(function () {
  var DETAIL     = `[URL_DETAILED_RPC]`;
  var CONVERSION = `[CONVERSION_RPC]`;
  /* Die Zusammenfassung im EIGENEN Backtick. Grund, gemessen: markdown_summary ist JSON in JSON.
     Steht es im Payload, frisst das Template-Literal die Escapes der inneren Anfuehrungszeichen,
     und danach ist nicht mehr zu unterscheiden, ob ein ": zur Struktur gehoert oder zum Text --
     der GANZE Payload wird unlesbar, nicht nur die Zusammenfassung. Hier steht der Text fuer sich
     und kann nichts zerlegen.
     Also im RPC-Ausdruck fuer DETAIL das Feld markdown_summary WEGLASSEN. */
  var SUMMARY    = `[SUMMARY_TEXT]`;

  var t = 0;
  (function go () {
    if (typeof window.setUrlDetail === "function") {
      window.setUrlDetail("INSTANCE_ID", DETAIL);
      window.setUrlDetailConversion("INSTANCE_ID", CONVERSION);
      window.setUrlDetailSummary("INSTANCE_ID", SUMMARY);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();

/* ---------- Skelett an und aus, waehrend ein Workflow laeuft ----------
window.setUrlDetailLoading("INSTANCE_ID", "yes");
window.setUrlDetailLoading("INSTANCE_ID", "no");
---------- alles leeren ----------
window.resetUrlDetail("INSTANCE_ID");
*/

/* ============================================================================================
   STATISCH -- dieselben Aufrufe, aber mit deinen echten Daten fest eingesetzt. Laeuft sofort,
   ohne Bubble-Ausdruck und ohne Workflow. INSTANCE_ID anpassen, einfuegen, fertig.
   Die Daten sind wortgleich die aus dem Auftrag.
   ============================================================================================ */
(function () {
  var INSTANCE_ID = "urldetail";

  var DETAIL = {
  "url": "https://www.paulcamper.de/magazin/festivals-2025-in-deutschland",
  "title": "Festivals in Deutschland mit Camping: der Guide für Camper",
  "domain": "paulcamper.de",
  "favicon": "https://www.google.com/s2/favicons?domain=paulcamper.de&sz=128",
  "url_type": "listicle",
  "companies": [
    { "logo_url": "https://www.google.com/s2/favicons?domain=airbeat-one.de&sz=64",
      "company_id": "c392c676-6327-4874-8e3f-a919fff7a76c", "company_name": "Airbeat One Festival" },
    { "logo_url": "https://www.google.com/s2/favicons?domain=nature-one.de&sz=64",
      "company_id": "215378ad-9322-498a-9331-b44d3d52a98b", "company_name": "Nature One" },
    { "logo_url": "https://www.google.com/s2/favicons?domain=parookaville.com&sz=64",
      "company_id": "26dd1507-721e-433c-a203-c6bb9ce96d0b", "company_name": "Parookaville" },
    { "logo_url": "https://www.google.com/s2/favicons?domain=www.tomorrowland.com&sz=64",
      "company_id": "37ae6e63-50d0-4d44-a8e0-5527353bf314", "company_name": "Tomorrowland" }
  ],
  "last_seen": "2026-08-23T13:25:01.38037+00:00",
  "first_seen": null,
  "description": "Die besten Festivals in Deutschland mit Camping – Techno, Rock, Metal, Reggae &amp; Elektro. Mit dem Camper campst du direkt vor Ort, mitten im Geschehen.",
  "global_rank": 1,
  "domain_share": 99.15,
  "global_share": 11.60,
  "citation_type": "Brand_Platform",
  "markdown_summary": "{\"summary\": \"Der Festivalguide von Paulcamper stellt die beliebtesten Open-Air-Festivals in Deutschland vor, die Campingmöglichkeiten bieten. Er deckt verschiedene Musikgenres ab, darunter Techno, Rock, Metal, Reggae und Elektro, und informiert über Termine, Orte, Größe und Preise der Festivals. Besonderer Fokus liegt auf der Anreise mit dem eigenen Camper oder einem gemieteten Wohnmobil von Paulcamper. Der Guide enthält Tipps für das Camping auf Festivals sowie Geheimtipps für kostenlose Veranstaltungen. Zielgruppe sind Camper und Festivalbesucher, die Komfort und Flexibilität suchen.\"}"
};

  var CONVERSION = [
  { "url": "https://www.paulcamper.de/magazin/festivals-2025-in-deutschland", "role": "competitor",
    "title": "Festivals in Deutschland mit Camping: der Guide für Camper", "domain": "paulcamper.de",
    "logo_url": "https://www.google.com/s2/favicons?domain=nature-one.de&sz=64", "cited_runs": 117,
    "company_id": "215378ad-9322-498a-9331-b44d3d52a98b", "company_name": "Nature One",
    "mentioned_runs": 73, "citation_conversion_pct": 62.39 },
  { "url": "https://www.paulcamper.de/magazin/festivals-2025-in-deutschland", "role": "own",
    "title": "Festivals in Deutschland mit Camping: der Guide für Camper", "domain": "paulcamper.de",
    "logo_url": "https://www.google.com/s2/favicons?domain=parookaville.com&sz=64", "cited_runs": 117,
    "company_id": "26dd1507-721e-433c-a203-c6bb9ce96d0b", "company_name": "Parookaville",
    "mentioned_runs": 56, "citation_conversion_pct": 47.86 },
  { "url": "https://www.paulcamper.de/magazin/festivals-2025-in-deutschland", "role": "competitor",
    "title": "Festivals in Deutschland mit Camping: der Guide für Camper", "domain": "paulcamper.de",
    "logo_url": "https://www.google.com/s2/favicons?domain=airbeat-one.de&sz=64", "cited_runs": 117,
    "company_id": "c392c676-6327-4874-8e3f-a919fff7a76c", "company_name": "Airbeat One Festival",
    "mentioned_runs": 33, "citation_conversion_pct": 28.21 },
  { "url": "https://www.paulcamper.de/magazin/festivals-2025-in-deutschland", "role": "competitor",
    "title": "Festivals in Deutschland mit Camping: der Guide für Camper", "domain": "paulcamper.de",
    "logo_url": "https://www.google.com/s2/favicons?domain=www.tomorrowland.com&sz=64", "cited_runs": 117,
    "company_id": "37ae6e63-50d0-4d44-a8e0-5527353bf314", "company_name": "Tomorrowland",
    "mentioned_runs": 2, "citation_conversion_pct": 1.71 }
];

  var t = 0;
  (function go () {
    if (typeof window.setUrlDetail === "function") {
      /* Als TEXT hineingeben, damit der Weg exakt der ist, den Bubble spaeter nimmt --
         ein Objekt wuerde einen anderen Zweig treffen und den echten Fall nicht pruefen. */
      /* markdown_summary geht NICHT im Payload mit -- denselben Weg nehmen wie im Echtbetrieb,
         sonst prueft der Test den Fall nicht, der spaeter wirklich laeuft. */
      var OHNE = {}; Object.keys(DETAIL).forEach(function (k) {
        if (k !== "markdown_summary") OHNE[k] = DETAIL[k];
      });
      window.setUrlDetail(INSTANCE_ID, JSON.stringify(OHNE));
      window.setUrlDetailConversion(INSTANCE_ID, JSON.stringify(CONVERSION));
      window.setUrlDetailSummary(INSTANCE_ID, DETAIL.markdown_summary);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();
