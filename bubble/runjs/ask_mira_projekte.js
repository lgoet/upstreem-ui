/* Mira: die Projekte der Chatleiste setzen.

   HAUSFORM (CLAUDE.md 2a): ein Backtick um den Bubble-Ausdruck, beide Sanitizer-Zeilen, roher
   Text in den Setter -- KEIN handgebautes Array und kein JSON.stringify.

   WARUM GERADE HIER (17.09.): Projektnamen sind NUTZEREINGABE. Bisher stand der Schritt als
       var projects = [ ...formatted as text ];  askMiraSetProjects(JSON.stringify(projects));
   also als JS-Array im Quelltext -- und ein Anfuehrungszeichen im Projektnamen beendet dort die
   Zeichenkette. Derselbe Tod wie beim Chat-Oeffnen-Schritt, nur dass ihn hier jeder Nutzer selbst
   ausloesen kann, indem er sein Projekt  Kunde "Nord"  nennt.
   Im Backtick ist das harmlos: Anfuehrungszeichen, Apostroph, #, *, Akzent, Umlaut, Emoji und
   Zeilenumbruch traegt er unbeschadet, und was danach kein gueltiges JSON mehr ist, repariert
   looseJsonParse in der Komponente.

   DIE EINE AUSNAHME, die kein Schritt der Welt abfangen kann: ein BACKTICK (`) oder ${ im
   Projektnamen beendet das Literal. Das gehoert an der Quelle weg -- im RPC, wie bei den
   Opportunities:
       replace(p.title, chr(96), '')
   Ohne das kann ein Nutzer seine eigene Chatleiste lahmlegen, indem er ein Projekt so nennt. */
(function () {
  var ROH = `[projects :format as text]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.askMiraSetProjects) window.askMiraSetProjects(ROH); } catch (e) {}
})();
