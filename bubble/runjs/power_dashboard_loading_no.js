/* BUBBLE RUN-JS -- "Power Dashboard: Skelett AUS"
   WOHIN: als LETZTER Schritt in denselben Workflow, hinter den Setter-Schritt.

   Meist nicht noetig: echte Daten beenden den Ladezustand von selbst (renderPowerDashboard).
   Gebraucht wird dieser Schritt, wenn der Workflow OHNE Daten endet -- die Abfrage findet nichts,
   bricht ab, oder ein Zweig ueberspringt den Setter. Ohne ihn dreht das Skelett dann endlos, und
   der Nutzer sieht "gleich da" statt "hier ist nichts" (CLAUDE.md 2).

   Auch dann setzen, wenn das Ergebnis LEER ist: leer ist ein Ergebnis, kein Ladezustand.

   INSTANCE_ID durch die Kennung des Elements ersetzen (data-instance). */
(function () {
  var WERT = "no";
  var fn = window.setPowerDashboardLoading;
  if (typeof fn === "function") { try { fn("INSTANCE_ID", WERT); } catch (e) {} return; }
  (window.__upwBootQueue = window.__upwBootQueue || []).push(["setPowerDashboardLoading", ["INSTANCE_ID", WERT]]);
})();
