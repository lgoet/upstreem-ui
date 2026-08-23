/* ONBOARDING -- den grossen Hintergrundlauf anstossen

   WANN: im Workflow hinter uobStart, als LETZTER Schritt -- sobald das Onboarding-Projekt
   angelegt ist und du seine Id und den Run-Token hast.

   WARUM ueber ein Ereignis und nicht direkt: die beiden Werte entstehen erst in diesem Workflow,
   und dort laesst sich kein zweiter Ereignisaufruf anhaengen. Der Schritt hier nimmt sie auf und
   feuert damit uobWorkflowStart -- an dem haengt dann der grosse Workflow.

   Beide Werte sind PFLICHT. Fehlt einer, wird NICHTS gesendet und die Konsole sagt welcher --
   ein halber Payload waere schlimmer als gar keiner, weil der Lauf dann ohne Token startet.

   Backticks wie ueberall: nicht selbst formatieren, nicht JSON-safe machen. */
(function () {
  var INSTANCE_ID   = "onboarding";
  var ONBOARDING_ID = `[Result of step X's id]`;
  var RUN_TOKEN     = `[Result of step X's run_token]`;

  var t = 0;
  (function go () {
    if (typeof window.startOnboardingWorkflow === "function") {
      window.startOnboardingWorkflow(INSTANCE_ID, ONBOARDING_ID, RUN_TOKEN);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();
