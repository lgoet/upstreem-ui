/* ONBOARDING -- SCHRITT C: Marken, Themen und Prompts

   Drei Listen, ein Muster. Jede kann einzeln geschickt werden; welche wann faellig ist:

     setOnboardingBrands   nach dem Hintergrundlauf, VOR dem Projekt mit status_phase 5
     setOnboardingTopics   ebenso
     setOnboardingPrompts  im Workflow hinter uobTopics, wenn die Prompts entstanden sind

   Die Listen kommen aus einem "Do a search for" mit :format as text. Der Trenner ist ein Komma,
   und JEDER Wert steht in Anfuehrungszeichen -- auch die Zahlen und auch selected. Der Grund
   steht in Schritt A: ein leerer Ausdruck in JS-Position ist ein Syntaxfehler, in einer
   Zeichenkette ist er harmlos und wird unten zu null.

   selected: "yes"/"no" oder "true"/"false" -- beides versteht die Komponente. Wer nichts
   vorwaehlen will, laesst das Feld weg.

   FALLE: ein BACKTICK oder ${ in einem Namen oder Prompttext bricht das Template-Literal. Bei
   Markennamen und Domains kommt das nicht vor; bei Prompttexten kann es das, deshalb dort
   :formatted as JSON-safe verwenden -- dann escaped Bubble selbst und der Text kommt
   unveraendert an. */
(function () {
  var INSTANCE_ID = "onboarding";

  /* ── Marken ──────────────────────────────────────────────────────────────────────────────
     Felder: id, name, domain, url, favicon_url, selected. favicon_url ist freiwillig -- fehlt
     sie, baut die Komponente sie aus der Domain. */
  var MARKEN = `[
    <Search for OnboardingBrands:each item's ... :format as text>
      {
        "id": "<This item's id>",
        "name": "<This item's name>",
        "domain": "<This item's domain>",
        "url": "<This item's url>",
        "favicon_url": "<This item's favicon_url>",
        "selected": "<This item's selected>"
      }
    <Trenner: ,>
  ]`;

  /* ── Themen ──────────────────────────────────────────────────────────────────────────────
     Felder: id, name, description, hex_light, hex_dark, selected. Alles ausser id und name ist
     freiwillig. OHNE hex greift die Themenpalette von core, in ihrer Reihenfolge -- das ist die
     bessere Vorgabe als eine erfundene Farbe. */
  var THEMEN = `[
    <Search for OnboardingTopics:each item's ... :format as text>
      {
        "id": "<This item's id>",
        "name": "<This item's name>",
        "hex_light": "<This item's hex_light>",
        "hex_dark": "<This item's hex_dark>",
        "selected": "<This item's selected>"
      }
    <Trenner: ,>
  ]`;

  /* ── Prompts ─────────────────────────────────────────────────────────────────────────────
     Felder: id, prompt_text, market, topic_ids, selected.
     topic_ids darf eine LISTE oder ein Komma-Text sein ("t-1,t-2") -- beides versteht die
     Komponente. Ein Prompt ohne Thema landet in der Gruppe "Other". Ein Prompt mit MEHREREN
     Themen steht genau einmal, unter seinem ersten. */
  var PROMPTS = `[
    <Search for OnboardingPrompts:each item's ... :format as text>
      {
        "id": "<This item's id>",
        "prompt_text": "<This item's prompt_text:formatted as JSON-safe>",
        "market": "<This item's market>",
        "topic_ids": "<This item's topic_ids:format as text, Trenner ,>",
        "selected": "<This item's selected>"
      }
    <Trenner: ,>
  ]`;

  function sauber(t) {
    return t
      /* §46, Zeile 1: leerer Wert -> null. */
      .replace(/:\s*([,}\]])/g, ": null$1")
      /* §46, Zeile 2: unquotiertes yes/no -> true/false. */
      .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t2) { return ": " + (v === "yes") + t2; });
  }

  var versuche = 0;
  (function los() {
    if (typeof window.setOnboardingBrands === "function") {
      /* Nur schicken, was dieser Schritt wirklich liefert: einen der drei Bloecke loeschen ist
         der normale Fall, nicht die Ausnahme. */
      window.setOnboardingBrands(INSTANCE_ID, sauber(MARKEN));
      window.setOnboardingTopics(INSTANCE_ID, sauber(THEMEN));
      window.setOnboardingPrompts(INSTANCE_ID, sauber(PROMPTS));
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[onboarding] setOnboardingBrands gibt es nach 6s nicht.");
  })();
})();
