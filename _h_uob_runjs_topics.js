/* ONBOARDING -- Themen in die Komponente geben (Schritt 3, Topics)

   WANN: zusammen mit den Marken, VOR dem Status 5.

   Felder:  id, name, description, hex_light, hex_dark, selected
            Pflicht sind id und name. OHNE hex_light/hex_dark greift die Themenpalette von core
            in ihrer Reihenfolge -- das ist die bessere Vorgabe als eine erfundene Farbe.
            Liefert die RPC eigene Farben, gewinnen die.

   Backticks: den RPC-Text roh hineinsetzen, nicht im Schritt parsen. */

/* ---------- dynamisch ---------- */
(function () {
  var THEMEN = `[TOPICS_RPC]`;
  var t = 0;
  (function go () {
    if (typeof window.setOnboardingTopics === "function") {
      window.setOnboardingTopics("INSTANCE_ID", THEMEN);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();

/* ---------- statisch, ein Eintrag zum Ausprobieren ----------
(function () {
  window.setOnboardingTopics("INSTANCE_ID", `[
    {
      "id": "t-line-array",
      "name": "Line Array Systems",
      "description": "Vertikal arraybare Systeme fuer grosse Flaechen",
      "hex_light": "",
      "hex_dark": "",
      "selected": "no"
    }
  ]`);
})();
*/
