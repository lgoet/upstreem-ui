/* Mira: einen Chat oeffnen und seine Nachrichten setzen -- EIN Run-JS-Schritt.

   HAUSFORM (CLAUDE.md 2a): je ein Backtick, je eine eigene Variable, beide Sanitizer-Zeilen,
   und der ROHE Text geht in den Setter. Kein JSON.parse, kein handgebautes Objekt, kein
   ":formatted as JSON-safe".

   WARUM DAS HIER DER UNTERSCHIED ZWISCHEN LAEUFT UND STIRBT IST (17.09.):
   Der Schritt stand vorher als JS-Array da --  const messages = [ ...formatted as text ] --
   also MITTEN im Quelltext. Ein Anfuehrungszeichen im Text beendet dort die Zeichenkette:
       "reason": "Der Prompt "beste lead agentur solar" zeigt 0 % ..."
   -> Uncaught SyntaxError: Unexpected identifier 'beste'
   Damit stirbt der ganze Schritt, der Folgeschritt findet seine Variable nicht mehr
   ("messages is not defined"), askMiraSetLoading(false) kommt nie an -- und der Loader dreht
   ewig weiter.
   Im Backtick ist ein Anfuehrungszeichen harmlos. Gefaehrlich sind dort nur ein BACKTICK und
   ${ in einem Wert -- und beides steht in dieser Nutzlast nicht (der RPC entfernt Backticks).
   Dass der Text danach kein gueltiges JSON mehr ist, macht nichts: askMiraSetMessages liest ihn
   mit looseJsonParse und repariert unescapte Anfuehrungszeichen selbst. Gemessen am echten
   Payload: JSON.parse scheitert, die Komponente zeigt beide Nachrichten.

   EIN Schritt statt zwei: askMiraSetExtras braucht dieselbe Nutzlast. Standen sie in zwei
   Schritten, musste die Variable des einen im anderen sichtbar sein -- genau daran ist es
   gescheitert. */
(function () {
  var CHAT_ID = `[Chat-ID]`;

  var ROH = `[get_mira_chat_messages's ... :format as text]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.askMiraSetActiveChat) window.askMiraSetActiveChat(CHAT_ID, false); } catch (e) {}
  try { if (window.askMiraSetMessages)   window.askMiraSetMessages(ROH); } catch (e) {}
  try { if (window.askMiraSetExtras)     window.askMiraSetExtras(ROH); } catch (e) {}
  try { if (window.askMiraTypeLastAnswer) window.askMiraTypeLastAnswer(); } catch (e) {}
  try { if (window.askMiraSetLoading)    window.askMiraSetLoading("no"); } catch (e) {}
})();
