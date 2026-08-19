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
     Zwischen die Anfuehrungszeichen kommt der Bubble-Ausdruck mit dem JSON der RPC -- die Liste
     mit dem einen Eintrag, so wie sie zurueckkommt. In Bubble also etwa:
         Result of step 1 (get response detail)'s returned value

     UND DAHINTER GEHOERT :formatted as JSON-safe. Das ist keine Feinheit, sondern die Bedingung,
     unter der das hier ueberhaupt funktioniert. Gemessen, alle drei Wege mit einem Antworttext,
     der Umbrueche, Anfuehrungszeichen, einen Code-Block und einen Backslash enthaelt:

       "<Ausdruck>" ohne JSON-safe        SyntaxError: Invalid or unexpected token
                                          (ein "..."-String vertraegt keinen echten Umbruch)
       String.raw`<Ausdruck>`             laeuft -- ABER nur solange der Text keine Backticks
                                          enthaelt. Eine ChatGPT-Antwort mit ```python bricht mit
                                          "Unexpected identifier 'python'".
       "<Ausdruck:formatted as JSON-safe>"  laeuft, und der Text kommt unveraendert an: 8 Umbrueche,
                                          Backticks erhalten, ${...} nicht interpoliert,
                                          Backslash erhalten.

     JSON-safe escaped Umbrueche, Anfuehrungszeichen und Backslashes so, dass daraus ein gueltiges
     JS-String-Literal wird -- und Backticks sind darin einfach Zeichen. Das ist der einzige Weg,
     der gegen jeden Antworttext haelt. */
  var ROH_ANTWORT = "RPC_RESPONSE_JSON"
    /* §46, Zeile 1: Bubble schreibt einen leeren Wert als "key": , -- das ist kein JSON. */
    .replace(/:\s*([,}\]])/g, ": null$1")
    /* §46, Zeile 2: und Ja/Nein unquotiert als yes / no. */
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function(_, v, t){ return ": " + (v === "yes") + t; });

  /* ── 3 von 3: die Modelle ──────────────────────────────────────────────────────────────────
     Nur noetig, wenn der Modell-Store auf DIESER Seite nicht schon anderswo gefuellt wird. Ohne
     ihn steht im Chip der rohe Schluessel ("google-aio") ohne Logo.
     LAEUFT setUpstreemModels SCHON WOANDERS: diesen Block ersatzlos loeschen. Der Aufruf unten
     prueft mit typeof und laeuft dann ohne ihn weiter.
     Auch hier :formatted as JSON-safe -- aus demselben Grund wie oben. */
  var ROH_MODELLE = "RPC_MODELS_JSON"
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function(_, v, t){ return ": " + (v === "yes") + t; });

  /* Ab hier ist nichts mehr anzupassen.
     Die Setter sind Boot-Stubs, solange response-detail.js noch laedt -- ein Aufruf landet dann in
     der Warteschlange und wird nachgeholt. Fehlen sie GANZ, ist das Element noch nicht gebaut:
     dann in 100ms-Schritten warten, hoechstens 6 Sekunden, und danach EINMAL sagen warum. */
  var versuche = 0;
  (function los(){
    if (typeof window.setResponseDetail === "function") {
      /* Drei Gruende, hier nichts zu schicken, und alle drei sind gueltige Zustaende:
         der Block oben wurde geloescht (typeof -- jede andere Pruefung wuerde mit
         "ROH_MODELLE is not defined" werfen und den Schritt mitreissen), der Store existiert auf
         dieser Seite nicht, oder der Platzhalter steht noch drin. */
      if (typeof ROH_MODELLE !== "undefined" &&
          typeof window.setUpstreemModels === "function" &&
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
