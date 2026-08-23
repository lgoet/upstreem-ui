/* ONBOARDING -- Marken in die Komponente geben (Schritt 2, Competitors)

   WANN: wenn der Hintergrundlauf sie gefunden hat -- VOR dem Status 5, sonst steht der Schritt
   einen Moment leer da.

   Felder:  id, name, domain, url, favicon_url, selected
            Pflicht sind id und name. Fehlt favicon_url, baut die Komponente das Bild aus der
            Domain. selected versteht yes, true, 1 und den nackten Wahrheitswert -- no oder
            weglassen heisst nicht vorgewaehlt.

   Backticks: den RPC-Text roh hineinsetzen. NICHT im Schritt parsen, nicht JSON-safe
   formatieren -- UC.parseBubbleJson in der Komponente ist der eine geteilte Leseweg. */

/* ---------- dynamisch ---------- */
(function () {
  var MARKEN = `[TOP_BRANDS_RPC]`;
  var t = 0;
  (function go () {
    if (typeof window.setOnboardingBrands === "function") {
      window.setOnboardingBrands("INSTANCE_ID", MARKEN);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();

/* ---------- statisch, ein Eintrag zum Ausprobieren ----------
(function () {
  window.setOnboardingBrands("INSTANCE_ID", `[
    {
      "id": "f6450b61-b104-44b8-a9f9-c9cd30f53c58",
      "name": "d&b audiotechnik",
      "domain": "dbaudio.com",
      "url": "https://dbaudio.com",
      "favicon_url": "https://www.google.com/s2/favicons?domain=dbaudio.com&sz=64",
      "selected": "no"
    }
  ]`);
})();
*/
