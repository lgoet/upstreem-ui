/* ONBOARDING -- SCHRITT A: das Projekt (und damit der Statusfortschritt)

   WANN: im Workflow hinter uobStart, sobald das Onboarding-Projekt angelegt und wieder geladen
   ist -- und danach bei jedem Statuswechsel erneut. status_phase 1..4 stellt die Phase im
   Ladebild, 5 heisst fertig und schaltet auf Competitors weiter.

   REIHENFOLGE: erst setOnboardingBrands und setOnboardingTopics, DANN dieser Schritt. Das
   Projekt mit status_phase 5 schaltet weiter -- kommt es zuerst, baut sich der naechste Schritt
   leer auf und danach noch einmal mit Inhalt, und das sieht man.

   WARUM ALLES IN BACKTICKS UND JEDER WERT IN ANFUEHRUNGSZEICHEN, AUCH ZAHLEN:
   Ein leerer Bubble-Ausdruck in JS-Position ("status_phase": ,) ist ein SYNTAXFEHLER im
   Quelltext. Der Schritt stirbt beim eval, bevor eine Zeile der Komponente laeuft -- kein
   Sanitizer kann das abfangen, weil er nie zur Ausfuehrung kommt. In einer Zeichenkette kann
   derselbe leere Wert nichts kaputtmachen: er wird unten zu null repariert.
   "5" wird zur Zahl 5, "" wird null. */
(function () {
  var INSTANCE_ID = "onboarding";

  var PROJEKT = `{
    "id": "<Result of Step 1's id>",
    "company_name": "<Result of Step 1's company_name>",
    "website_url": "<Result of Step 1's website_url>",
    "website_domain": "<Result of Step 1's website_domain>",
    "market": "<Result of Step 1's market>",
    "business_model": "<Result of Step 1's business_model>",
    "brand_industry": "<Result of Step 1's brand_industry>",
    "status": "<Result of Step 1's status>",
    "status_phase": "<Result of Step 1's status_phase>",
    "last_error": "<Result of Step 1's last_error>"
  }`
    /* §46, Zeile 1: Bubble schreibt einen leeren Wert als "key": , -- das ist kein JSON. */
    .replace(/:\s*([,}\]])/g, ": null$1")
    /* §46, Zeile 2: und Ja/Nein unquotiert als yes / no. */
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  /* Ab hier ist nichts anzupassen. Der Setter ist ein Boot-Stub, solange onboarding-page.js noch
     laedt -- ein Aufruf landet dann in der Warteschlange und wird nachgeholt. Fehlt er GANZ, ist
     das Element noch nicht gebaut: in 100ms-Schritten warten, hoechstens 6 Sekunden, danach
     EINMAL sagen warum. */
  var versuche = 0;
  (function los() {
    if (typeof window.setOnboardingProject === "function") {
      window.setOnboardingProject(INSTANCE_ID, PROJEKT);
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[onboarding] setOnboardingProject gibt es nach 6s nicht. " +
      "Steht das HTML-Element auf der Seite und ist es sichtbar?");
  })();
})();
