/* ==============================================================================================
   brand-detail: der Run-JS-Step fuer den Seitenaufbau.

   Was gegenueber der vorigen Fassung anders ist: der Company-Payload steht in EINEM Backtick als
   roher Text, nicht mehr als JS-Objekt in JSON.stringify([{...}]).

   Der Grund ist der Fehler vom 24.08. Ein Objektliteral im Step wird vom Browser GEPARST, bevor
   irgendetwas laeuft. Ist ein Bubble-Ausdruck leer, steht dort

       avg_visibility_prev_pct: ,

   und das ist kein gueltiges JavaScript -- "Uncaught SyntaxError: Unexpected token ','". Der Step
   stirbt beim Parsen, also laufen AUCH die Aufrufe darunter nicht mehr (hier: setBrandDetailSeries),
   und die Komponente bleibt im Ladezustand stehen. Kein Sanitizer und kein Code im Kit kann das
   abfangen, weil nichts davon zur Ausfuehrung kommt.

   Im Backtick ist derselbe leere Wert nur Text. Die erste Ersetzung macht daraus null, die zweite
   quotiert Bubbles unquotiertes yes/no. Beide Zeilen sind Pflicht (STYLEGUIDE §46).

   Jeder Aufruf steht in seinem EIGENEN try: faellt ein Ausdruck aus, nimmt er die anderen nicht mit.
   ============================================================================================== */
(function () {
  var ID = "brand_detail_page";                 /* <- deine data-instance */

  /* Bubbles Ausdruecke direkt zwischen die Anfuehrungszeichen setzen. Zahlen bleiben OHNE
     Anfuehrungszeichen -- avg_rank: 3.0, nicht "3.0" -- sonst kommt der Trend als Text an. */
  var COMPANY = `[{
    "company_id": "",
    "name": "",
    "logo_url": "",
    "domain": "",
    "avg_visibility_pct": , "avg_visibility_prev_pct": ,
    "avg_rank": , "avg_rank_prev": , "avg_rank_delta": ,
    "avg_sentiment": , "avg_sentiment_prev": , "avg_sentiment_delta": ,
    "total_runs_now": , "mentions_now":
  }]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var SERIES = `{
    "mode": "",
    "series": [],
    "granularity": ""
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  /* window.<name> statt des nackten Namens: haengt das Element noch an einem aelteren Pin, ist der
     Name schlicht undefined statt ein ReferenceError, der den Step mitnimmt. */
  try { if (window.setBrandDetailCompany) window.setBrandDetailCompany(ID, COMPANY); } catch (e) {}
  try { if (window.setBrandDetailSeries)  window.setBrandDetailSeries(ID, SERIES); } catch (e) {}
})();
