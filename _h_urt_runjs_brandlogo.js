/* RESPONSES TABLE -- Markenlogo und Markenname setzen.

   WO ES ERSCHEINT: im Spaltenkopf ("<Logo> Mentioned?") und im Schalter ueber der Tabelle
   ("<Logo> Acme mentioned").

   WARUM EIN SETTER UND NICHT DAS ATTRIBUT:
   data-brand-name und data-brand-logo sind BUBBLE-Attribute. Wer sie aus einem Run-JS-Schritt
   ueberschreibt, gewinnt genau bis zum naechsten Mal, in dem Bubble das Element anfasst -- der Name
   blinkt kurz auf und springt zurueck, und das Logo wechselt gar nicht sichtbar, weil ein Bild
   einen Ladevorgang braucht und der Wert vorher schon wieder ueberschrieben ist.
   setResponsesTableBrand legt den Wert dagegen in einen Speicher, der dem Attribut VORGEHT und ein
   Neueinspritzen des Markups ueberlebt.

   VORSICHT, zwei Namen mit einem Buchstaben Unterschied:
     setResponsesTableBrands  (Mehrzahl)  der Filter ueber mehrere Marken
     setResponsesTableBrand   (Einzahl)   die EIGENE Marke, also dieser Schritt hier */
(function(){
  var INSTANCE_ID = "responses_table";      /* dasselbe data-instance wie am HTML-Element */

  /* In Backticks, damit ein leerer Bubble-Ausdruck den Schritt nicht sprengt. Leerer Text heisst
     ausdruecklich "weg damit" -- ohne Logo faellt der Spaltenkopf auf "<Name> mentioned?" zurueck. */
  var NAME = `<Bubble: Brand's name>`;
  var LOGO = `<Bubble: Brand's favicon_url oder logo_url>`;

  var versuche = 0;
  (function los(){
    if (typeof window.setResponsesTableBrand === "function") {
      window.setResponsesTableBrand(INSTANCE_ID, NAME, LOGO);
      return;
    }
    /* Die Setter sind Boot-Stubs, solange responses-table.js noch laedt -- ein Aufruf landet dann
       in der Warteschlange und wird nachgeholt. Fehlen sie GANZ, ist das Element noch nicht
       gebaut: in 100ms-Schritten warten, hoechstens 6 Sekunden, danach EINMAL sagen warum. */
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[responses-table] setResponsesTableBrand gibt es nach 6s " +
      "nicht. Steht das HTML-Element auf der Seite, und ist der CDN-Pin aktuell?");
  })();
})();
