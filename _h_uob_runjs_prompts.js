/* ONBOARDING -- Prompts in die Komponente geben (Schritt 4, Prompts)

   WANN: im Workflow hinter uobTopics, sobald die Prompts entstanden sind. Die Komponente wartet
   solange in der zweiten Uhr; sie endet mit setOnboardingStatus(..., "5").

   Felder:  id, prompt_text, market, topic_ids, selected
            topic_ids darf eine LISTE sein oder ein Komma-Text ("t-1,t-2") -- beides versteht die
            Komponente. Ein Prompt ohne Thema landet in der Gruppe "Other". Ein Prompt mit
            MEHREREN Themen steht genau einmal, unter seinem ersten; die uebrigen erscheinen als
            Marken am Zeilenende.
            market ist der Laendercode, z.B. DE -- daraus wird die Flagge.

   Backticks: den RPC-Text roh hineinsetzen, nicht im Schritt parsen. Prompttexte sind Freitext
   und enthalten regelmaessig Anfuehrungszeichen; parseBubbleJson in der Komponente kommt damit
   zurecht, ein eigener Parser im Schritt nicht. */

/* ---------- dynamisch ---------- */
(function () {
  var PROMPTS = `[PROMPTS_RPC]`;
  var t = 0;
  (function go () {
    if (typeof window.setOnboardingPrompts === "function") {
      window.setOnboardingPrompts("INSTANCE_ID", PROMPTS);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();

/* ---------- statisch, ein Eintrag zum Ausprobieren ----------
(function () {
  window.setOnboardingPrompts("INSTANCE_ID", `[
    {
      "id": "p1",
      "prompt_text": "beste Line-Array-Lautsprecher fuer Festivals und Arenatouren",
      "market": "DE",
      "topic_ids": "t-line-array,t-touring",
      "selected": "no"
    }
  ]`);
})();
*/
