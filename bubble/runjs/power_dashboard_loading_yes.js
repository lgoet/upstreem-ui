/* BUBBLE RUN-JS -- "Power Dashboard: Skelett AN"
   WOHIN: als ERSTER Schritt in jeden Workflow, der Daten fuer dieses Element holt -- vor dem RPC,
   nicht danach. Danach gesetzt blitzt zwischen altem Bild und Skelett kurz der alte Stand auf.

   Nicht noetig beim Seitenaufbau: das Element startet von sich aus im Ladezustand. Gebraucht wird
   es beim NACHLADEN -- Zeitraum gewechselt, Filter geaendert, Aktualisieren gedrueckt.

   INSTANCE_ID durch die Kennung des Elements ersetzen (data-instance). Ein Element ohne
   data-instance heisst "default".

   Der Ladezustand endet auch von selbst, sobald echte Daten kommen (renderPowerDashboard setzt
   ihn zurueck) -- "no" ist nur fuer den Fall noetig, dass der Workflow OHNE Daten endet, etwa
   wenn die Abfrage nichts findet oder abbricht. Siehe power_dashboard_loading_no.js. */
(function () {
  var WERT = "yes";
  var fn = window.setPowerDashboardLoading;
  if (typeof fn === "function") { try { fn("INSTANCE_ID", WERT); } catch (e) {} return; }
  /* Das Element ist noch nicht geladen: in die Warteschlange, core spielt sie beim Start nach. */
  (window.__upwBootQueue = window.__upwBootQueue || []).push(["setPowerDashboardLoading", ["INSTANCE_ID", WERT]]);
})();
