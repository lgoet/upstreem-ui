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

  var t = 0;
  (function go () {
    if (typeof window.setUrlDetail === "function") {
      window.setUrlDetail("INSTANCE_ID", DETAIL);
      window.setUrlDetailConversion("INSTANCE_ID", CONVERSION);
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
