/* ONBOARDING -- SCHRITT B: nur der Statusfortschritt

   WANN: waehrend der Hintergrundlauf arbeitet, bei jeder Statusaenderung. Der kleine Bruder von
   Schritt A -- er stellt nur die Phase im Ladebild, ohne die uebrigen Projektdaten erneut zu
   schicken.

   status_phase 1 bis 4 = die vier Phasen des Ladebildes. 5 = fertig, die Seite schaltet weiter.
   Wer Schritt A ohnehin bei jedem Statuswechsel schickt, braucht diesen hier nicht. */
(function () {
  var INSTANCE_ID = "onboarding";

  var STATUS = `{
    "status_phase": "<Result of Step 1's status_phase>",
    "status_label": "<Result of Step 1's status_label>"
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var versuche = 0;
  (function los() {
    if (typeof window.setOnboardingStatus === "function") {
      window.setOnboardingStatus(INSTANCE_ID, STATUS);
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[onboarding] setOnboardingStatus gibt es nach 6s nicht.");
  })();
})();
