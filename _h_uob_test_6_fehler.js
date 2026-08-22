/* ONBOARDING -- TESTDATEN 6: Fehler, Ladezustand, Schritt, Reset

   Wortgleich die Beispieldaten aus onboarding-page.js. Zum Ausprobieren OHNE Bubble-Daten:
   in einen Run-JavaScript-Schritt kopieren, INSTANCE_ID anpassen, fertig.
   Fuer den Echtbetrieb dann _h_uob_runjs_*.js nehmen -- die tragen die Bubble-Ausdruecke.

   In Bubble gehoert jeweils NUR der eine Aufruf in den Schritt, den man braucht. Hier stehen
   sie zusammen zum Nachschlagen. */
(function () {
  var INSTANCE_ID = "onboarding";

  /* Abbruch des Hintergrundlaufs: beendet die Uhr, zeigt das Band, bleibt stehen.
     Die RPC-Felder reichen -- status "error"/"failed" oder ein gefuelltes last_error. */
  window.setOnboardingStatus(INSTANCE_ID,
    `{"status":"error","last_error":"The website could not be reached."}`);

  /* Fehlerband ohne Lauf, mit eigenem Text. */
  // window.setOnboardingError(INSTANCE_ID, "Something went wrong. Please try again.");

  /* Kreisel im Weiter-Knopf, waehrend ein Workflow laeuft. */
  // window.setOnboardingLoading(INSTANCE_ID, "yes");
  // window.setOnboardingLoading(INSTANCE_ID, "no");

  /* Direkt auf einen Schritt springen: brand | competitors | topics | prompts | plan */
  // window.setOnboardingStep(INSTANCE_ID, "topics");

  /* Alles leeren, zurueck auf Schritt 1. */
  // window.resetOnboarding(INSTANCE_ID);
})();
