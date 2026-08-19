/* LIVE-FASSUNG des Run-JS-Schritts fuer response-detail -- Pageload-Workflow.
   Hier stehen die Stellen, an denen die dynamischen Bubble-Ausdruecke hinein muessen. Es sind
   genau zwei, und keine davon baut JSON von Hand zusammen: die Komponente nimmt den Payload so,
   wie die RPC ihn liefert.

   WARUM NICHT FELD FUER FELD: wer prompt_text, tags, companies und citations einzeln in einen
   String klebt, baut JSON per Hand -- und ein Apostroph in einem Titel, ein Anfuehrungszeichen in
   einer Beschreibung oder ein leeres Feld reissen das Ganze auf. Der ganze Payload in einem Stueck
   kann das nicht. Die Sanitizer-Zeilen unten fangen ab, was Bubble selbst kaputt macht (§46). */
(function(){
  /* ── 1 von 3: die Instanz ──────────────────────────────────────────────────────────────────
     Muss GENAU dem data-instance am HTML-Element entsprechen. Stimmt es nicht, wartet der Aufruf
     in der Warteschlange und die Konsole nennt den Namen, der tatsaechlich im Dokument steht. */
  var INSTANCE_ID = "response_detail_page";

  /* ── 2 von 3: die Antwort ──────────────────────────────────────────────────────────────────
     Zwischen die Backticks kommt der Bubble-Ausdruck mit dem JSON der RPC -- die Liste mit dem
     einen Eintrag, so wie sie zurueckkommt. In Bubble also etwa:
         Result of step 1 (get response detail)'s returned value
     oder das Textfeld, in dem die Antwort liegt. Backticks bleiben stehen.

     String.raw davor ist PFLICHT und kein Beiwerk: ohne es verarbeitet JavaScript die
     Escape-Folgen im Text, BEVOR JSON.parse sie sieht. Aus \n im Antworttext wird dann ein echter
     Zeilenumbruch mitten in einem JSON-String -- und der ist dort verboten. Gemessen ohne
     String.raw: "Bad control character in string literal at position 1585", die Komponente blieb
     leer. Mit String.raw bleibt \n stehen und JSON.parse macht daraus den Umbruch, richtig. */
  var ROH_ANTWORT = String.raw`RPC_RESPONSE_JSON`
    /* §46, Zeile 1: Bubble schreibt einen leeren Wert als "key": , -- das ist kein JSON. */
    .replace(/:\s*([,}\]])/g, ": null$1")
    /* §46, Zeile 2: und Ja/Nein unquotiert als yes / no. */
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function(_, v, t){ return ": " + (v === "yes") + t; });

  /* ── 3 von 3: die Modelle ──────────────────────────────────────────────────────────────────
     Nur noetig, wenn der Modell-Store auf DIESER Seite nicht schon anderswo gefuellt wird. Ohne
     ihn steht im Chip der rohe Schluessel ("google-aio") ohne Logo. Auch hier der ganze Payload
     in einem Stueck: eine Liste mit key, display_name, optional short_name und logo_url.
     Faellt weg, wenn setUpstreemModels bereits im Pageload laeuft -- dann diesen Block loeschen. */
  var ROH_MODELLE = String.raw`RPC_MODELS_JSON`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function(_, v, t){ return ": " + (v === "yes") + t; });

  /* Ab hier ist nichts mehr anzupassen.
     Die Setter sind Boot-Stubs, solange response-detail.js noch laedt -- ein Aufruf landet dann in
     der Warteschlange und wird nachgeholt. Fehlen sie GANZ, ist das Element noch nicht gebaut:
     dann in 100ms-Schritten warten, hoechstens 6 Sekunden, und danach EINMAL sagen warum. */
  var versuche = 0;
  (function los(){
    if (typeof window.setResponseDetail === "function") {
      /* Der Platzhalter bleibt stehen, wenn der Ausdruck nicht eingesetzt wurde -- dann lieber
         nichts an den Store schicken als den Text "RPC_MODELS_JSON". */
      if (typeof window.setUpstreemModels === "function" &&
          ROH_MODELLE.indexOf("RPC_MODELS" + "_JSON") < 0) {
        window.setUpstreemModels(ROH_MODELLE);
      }
      if (ROH_ANTWORT.indexOf("RPC_RESPONSE" + "_JSON") >= 0) {
        if (window.console) console.warn("[response-detail] ROH_ANTWORT ist noch der Platzhalter " +
          "aus der Vorlage. Dort gehoert der dynamische Bubble-Ausdruck hinein.");
        return;
      }
      window.setResponseDetail(INSTANCE_ID, ROH_ANTWORT);
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[response-detail] setResponseDetail gibt es nach 6s nicht. " +
      "Steht das HTML-Element auf der Seite, ist es sichtbar, und stimmt data-cdn-pin?");
  })();
})();
