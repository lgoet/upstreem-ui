/* ==============================================================================================
   URL DETAIL -- DER Run-JS-Schritt fuer den Workflow.

   Diese Datei ist die einzige, in die Bubble-Ausdruecke gehoeren. Es gibt vier Stellen, und alle
   vier liegen zwischen BACKTICKS. Das ist keine Kosmetik:

     `...`   ein Backtick-Text vertraegt Anfuehrungszeichen im Inhalt.
     "..."   eine Zeichenkette mit Anfuehrungszeichen NICHT. Das erste " aus den Daten beendet sie,
             und der Schritt stirbt mit SyntaxError -- gemessen: der Wert {"summary": "..."} in
             Anfuehrungszeichen ergibt genau "Unexpected identifier 'summary'".

   Also: die Ausdruecke NUR zwischen die Backticks unten. Nirgendwo sonst, und niemals in ein
   Objektliteral mit "..." -- dafuer ist _h_uud_runjs_test.js da, und dort gehoert KEIN Ausdruck
   hinein.

   WANN: beim Aufbau der Detailseite, sobald die RPC geantwortet hat.

   Alle drei Werte gehen als TEXT rein. Nicht im Schritt parsen und nicht JSON-safe formatieren:
   UC.readBubble in der Komponente liest gueltiges JSON unveraendert, repariert Bubbles
   Eigenheiten und trennt LEER von UNLESBAR -- ein unlesbarer Payload steht dann als Fehlerband
   oben statt als leere Seite.

   Die Warteschleife braucht es, weil Bubble diesen Schritt vor der Komponente ausfuehren kann.
   ============================================================================================== */
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

/* ==============================================================================================
   Kleine Schritte fuer zwischendurch -- je einzeln in einen eigenen Run-JS-Schritt:

     window.setUrlDetailLoading("INSTANCE_ID", "yes");   Skelett an, waehrend ein Workflow laeuft
     window.setUrlDetailLoading("INSTANCE_ID", "no");    Skelett aus
     window.resetUrlDetail("INSTANCE_ID");               alles leeren
   ============================================================================================== */
