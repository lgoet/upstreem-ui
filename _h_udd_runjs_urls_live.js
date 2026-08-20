/* SCHRITT 2 von 2 -- die URL-Serie fuer den Domain-Share. Ausgeloest von uddMode/uddScope/uddGran.

   DER UNTERSCHIED ZUR ALTEN FASSUNG, und er ist der ganze Punkt:
   Die Werte stehen NICHT mehr in JS-Position, sondern in einer Zeichenkette. Vorher stand da

       var URLS = { to: "", from: "", top_n: , domain: "", ... };

   und ein leerer Bubble-Ausdruck ergab "top_n: ," -- das ist "Unexpected token ','" beim eval, und
   der Schritt stirbt, BEVOR irgendein Code der Komponente laeuft. Kein Sanitizer der Welt kann das
   abfangen, weil er nie zur Ausfuehrung kommt.

   In Backticks kann derselbe leere Wert nichts kaputtmachen: er landet als Text im JSON, und
   UC.parseLoose im Setter repariert ihn zu null. Dasselbe gilt fuer unquotierte yes/no, fuer leere
   Listenelemente ([a, , b]) und fuer Anfuehrungszeichen mitten in einem Titel.

   EINZIGE FALLE, und sie ist real: ein BACKTICK oder ${ in einem Titel bricht das Template-Literal.
   Titel mit Backticks sind selten, aber wenn Deine Daten sie fuehren koennen, schick den Titel als
   Bubble-Ausdruck mit "formatted as text" -- Bubble escaped dann selbst. */
(function(){
  var INSTANCE_ID = "domain_detail_page";

  /* Alles in EINER Zeichenkette. Die Bubble-Ausdruecke kommen genau dorthin, wo jetzt die
     Platzhalter stehen -- die Anfuehrungszeichen bleiben stehen, auch bei Zahlen: parseLoose macht
     aus "5" die Zahl 5, und aus "" wird null statt eines Syntaxfehlers. */
  var URLS = `{
    "to": "<Datum bis>",
    "from": "<Datum von>",
    "top_n": "<Anzahl>",
    "domain": "<Domain>",
    "share_mode": "<global oder domain>",
    "points": [
      <Liste der Punkte, je Zeile ein Objekt mit Komma dazwischen>
    ]
  }`;

  var versuche = 0;
  (function los(){
    if (typeof window.setDomainDetailUrls === "function") {
      window.setDomainDetailUrls(INSTANCE_ID, URLS);
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[domain-detail] setDomainDetailUrls gibt es nach 6s nicht. " +
      "Steht das HTML-Element auf der Seite und ist es sichtbar?");
  })();
})();
