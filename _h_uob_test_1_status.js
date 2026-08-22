/* ONBOARDING -- TESTDATEN 1: Statusfortschritt 1..4

   Wortgleich die Beispieldaten aus onboarding-page.js. Zum Ausprobieren OHNE Bubble-Daten:
   in einen Run-JavaScript-Schritt kopieren, INSTANCE_ID anpassen, fertig.
   Fuer den Echtbetrieb dann _h_uob_runjs_*.js nehmen -- die tragen die Bubble-Ausdruecke.

   Einmal je Phase ausfuehren, Zahl hochzaehlen. 1..4 sind die laufenden Phasen; die 5 gehoert
   in Schritt 2, weil vorher die Listen da sein muessen. */
(function () {
  var INSTANCE_ID = "onboarding";
  var PHASE = "2";                       // 1 | 2 | 3 | 4

  var t = 0;
  (function go () {
    if (typeof window.setOnboardingStatus === "function") {
      window.setOnboardingStatus(INSTANCE_ID, PHASE);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();
