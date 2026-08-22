/* ONBOARDING -- TESTDATEN 3: Prompts

   Wortgleich die Beispieldaten aus onboarding-page.js. Zum Ausprobieren OHNE Bubble-Daten:
   in einen Run-JavaScript-Schritt kopieren, INSTANCE_ID anpassen, fertig.
   Fuer den Echtbetrieb dann _h_uob_runjs_*.js nehmen -- die tragen die Bubble-Ausdruecke.

   WANN: im Workflow hinter uobTopics, sobald die Prompts entstanden sind. Vier der dreizehn
   tragen ZWEI Themen -- jeder Prompt steht genau einmal, unter seinem ersten Thema. */
(function () {
  var INSTANCE_ID = "onboarding";

  var PROMPTS = `[
     {
      "id": "p1",
      "prompt_text": "beste Line-Array-Lautsprecher fuer Festivals und Arenatouren",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-line-array",
       "t-touring"
      ]
     },
     {
      "id": "p2",
      "prompt_text": "Welcher Pro-Audio-Hersteller bietet energieeffiziente Touring-PA-Systeme mit hoher Sprachverstaendlichkeit fuer Open-Air-Festivals?",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-efficiency",
       "t-touring"
      ]
     },
     {
      "id": "p3",
      "prompt_text": "Top Anbieter von raeumlichen Beschallungssystemen und Objekt-basiertem Mixing fuer Theater und Mehrzweckhallen in Europa",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-spatial",
       "t-venues"
      ]
     },
     {
      "id": "p4",
      "prompt_text": "vergleiche Hersteller von vertikal arraybaren Lautsprechersystemen und passenden Endstufenracks fuer grosse Konzertproduktionen",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-line-array",
       "t-amps"
      ]
     },
     {
      "id": "p5",
      "prompt_text": "welches Line-Array-System hat die beste Direktivitaetskontrolle bei langen Wurfweiten",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-line-array"
      ]
     },
     {
      "id": "p6",
      "prompt_text": "PA-System fuer ein Festival mit 20.000 Besuchern - welche Hersteller kommen infrage?",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-touring"
      ]
     },
     {
      "id": "p7",
      "prompt_text": "beste Clublautsprecher fuer elektronische Musik mit sauberem Tiefbass",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-club"
      ]
     },
     {
      "id": "p8",
      "prompt_text": "welche Beschallungsmarken werden in Technoclubs am haeufigsten verbaut?",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-club"
      ]
     },
     {
      "id": "p9",
      "prompt_text": "Loesungen fuer objektbasiertes Mischen in Theatern - Anbieter im Vergleich",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-spatial"
      ]
     },
     {
      "id": "p10",
      "prompt_text": "welche Verstaerkerracks passen zu grossen Touring-Lautsprechersystemen?",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-amps"
      ]
     },
     {
      "id": "p11",
      "prompt_text": "Lautsprecher mit hohem Wirkungsgrad - welche Hersteller brauchen am wenigsten Strom pro dB?",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-efficiency"
      ]
     },
     {
      "id": "p12",
      "prompt_text": "Beschallungsanlage fuer eine Mehrzweckhalle - worauf kommt es bei der Auswahl an?",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-venues"
      ]
     },
     {
      "id": "p13",
      "prompt_text": "welche Lautsprecherhersteller gelten als nachhaltig in der Veranstaltungstechnik?",
      "market": "DE",
      "selected": false,
      "topic_ids": [
       "t-efficiency"
      ]
     }
    ]`;

  var t = 0;
  (function go () {
    if (typeof window.setOnboardingPrompts === "function") {
      window.setOnboardingPrompts(INSTANCE_ID, PROMPTS);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();
