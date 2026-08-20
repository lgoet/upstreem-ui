/* RESPONSES TABLE -- Markenlogo und Markenname setzen.

   WO ES ERSCHEINT: im Spaltenkopf ("<Logo> Mentioned?") und im Schalter ueber der Tabelle
   ("<Logo> Acme mentioned").

   WARUM ES KEIN SETTER IST: beides sind ATTRIBUTE am HTML-Element (data-brand-logo,
   data-brand-name). Die Komponente beobachtet sie und zeichnet neu, sobald sich eines aendert --
   ein eigener setResponsesTable...-Aufruf waere ein zweiter Weg fuer dieselbe Sache.

   ACHTUNG: bis zu dieser Runde hat das Beobachten zwar gefeuert, aber nicht neu gezeichnet -- das
   Attribut aenderte sich und das Bild blieb stehen. Gemessen und behoben; derselbe Fehler steckte
   in urls-table und domains-table. Mit einem aelteren Pin tut dieser Schritt also nichts. */
(function(){
  var INSTANCE_ID = "responses_table";      /* dasselbe data-instance wie am HTML-Element */

  /* In Backticks, damit ein leerer Bubble-Ausdruck den Schritt nicht sprengt: leer heisst dann
     einfach leerer Text, und die Komponente faellt sauber auf den Namen zurueck. */
  var LOGO = `<Bubble: Brand's favicon_url oder logo_url>`;
  var NAME = `<Bubble: Brand's name>`;

  var versuche = 0;
  (function los(){
    /* Alle Elemente mit dieser Instanz -- Bubble kann dasselbe Reusable mehrfach auf der Seite
       haben, und dann muessen alle Kopien dasselbe Logo tragen. */
    var wurzeln = document.querySelectorAll('.urt-root[data-instance="' + INSTANCE_ID + '"]');
    if (wurzeln.length) {
      [].forEach.call(wurzeln, function(w){
        /* Nur setzen, wenn sich etwas aendert: ein gleicher Wert loest sonst ein Neuzeichnen aus,
           das nichts bewirkt und die Eingangsanimation der Zeilen neu ansetzt. */
        if (String(w.getAttribute("data-brand-logo") || "") !== String(LOGO)) w.setAttribute("data-brand-logo", LOGO);
        if (String(w.getAttribute("data-brand-name") || "") !== String(NAME)) w.setAttribute("data-brand-name", NAME);
      });
      return;
    }
    /* Das Element steht beim Seitenaufbau nicht immer schon da -- in 100ms-Schritten warten,
       hoechstens 6 Sekunden, und danach EINMAL sagen warum. */
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn('[responses-table] kein Element mit data-instance="' +
      INSTANCE_ID + '" nach 6s. Stimmt die Instanz-Id, und ist das Element sichtbar?');
  })();
})();
