/* UPSTREEM -- LAEUFT DAS FLIMMERRASTER, UND WENN NICHT: WARUM?

   WOHIN: in die Browser-Konsole der echten Seite, waehrend das Onboarding offen ist. Es aendert
   nichts, es liest nur.

   DER BEFUND, DEM ES NACHGEHT: gemeldet am 08.09. als "das ist ein statisches Bild". Und
   "es bewegt sich nichts" hat auf einer laufenden Seite VIER moegliche Gruende, die von aussen
   alle gleich aussehen:
       1. Das System steht auf "Bewegung reduzieren" (macOS: Bedienungshilfen -> Anzeige).
          Dann malt das Kit absichtlich EIN Bild und hoert auf.
       2. Der Tab ist verdeckt -- dann haelt es an und laeuft beim Zurueckkommen weiter.
       3. Die Huelle steht nicht im sichtbaren Bereich (IntersectionObserver).
       4. Die Schleife laeuft gar nicht, weil das Kit nie gestartet wurde (alte core.js am Pin,
          Element nicht gebaut, Ausnahme im Aufbau).
   Und ein fuenfter Grund, der nichts mit dem Kit zu tun hat: der ausgelieferte Pin ist noch der
   alte, dann steht dort das SVG mit Raster und Sternen und ueberhaupt kein Canvas.

   WAS ES AUSGIBT: eine Zeile je gefundener Huelle, mit dem Bildzaehler VORHER und NACHHER
   (eine Sekunde spaeter). Waechst er, laeuft es. Waechst er nicht, steht daneben, welcher der
   vier Gruende es ist. */
(function(){
  var huellen = document.querySelectorAll(".up-bgart-flimmer");
  var alt = document.querySelectorAll(".up-bgart-raster, .up-bgart-marken");
  console.log("%cupstreem Flimmerraster", "font-weight:600");
  console.log("  Huellen .up-bgart-flimmer:", huellen.length);
  console.log("  alte SVG-Ebenen im Dokument (.up-bgart-raster/-marken):", alt.length,
    alt.length ? "-- dann laeuft noch der alte Pin oder ein altes Element" : "");
  var kern = window.UpstreemCore;
  console.log("  core.js BUILD:", kern && kern.BUILD,
    "  makeFlickerGrid vorhanden:", !!(kern && kern.makeFlickerGrid));
  try {
    console.log("  System auf Bewegung reduzieren:",
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch(e){}
  if (!huellen.length) return;
  var vorher = [];
  [].forEach.call(huellen, function(h, i){
    var kit = h.__upFlicker;
    var cv = h.querySelector("canvas");
    if (!kit || !kit.info){
      console.log("  [" + i + "] KEIN Kit an der Huelle" +
        (cv ? " (aber ein Canvas -- dann ist core.js aelter als der Bildzaehler)" : " und kein Canvas"));
      vorher.push(null); return;
    }
    var inf = kit.info();
    vorher.push(inf.bilder);
    console.log("  [" + i + "]", JSON.stringify(inf));
  });
  setTimeout(function(){
    [].forEach.call(huellen, function(h, i){
      var kit = h.__upFlicker;
      if (!kit || !kit.info || vorher[i] == null) return;
      var inf = kit.info();
      var neu = inf.bilder - vorher[i];
      if (neu > 0){
        console.log("  [" + i + "] LAEUFT: " + neu + " Bilder in einer Sekunde" +
          " (erwartet etwa 30)");
        return;
      }
      var grund = inf.ruhemodus ? "das System steht auf Bewegung reduzieren"
        : inf.tabVerdeckt ? "der Tab ist verdeckt"
        : !inf.sichtbar ? "die Huelle steht nicht im sichtbaren Bereich"
        : !inf.laeuft ? "die Schleife ist gestoppt (Huelle aus dem Dokument gefallen?)"
        : "kein bekannter Grund -- bitte diese Zeile melden";
      console.log("  [" + i + "] STEHT STILL, Grund: " + grund, inf);
    });
  }, 1000);
})();
