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

   EIN Schritt statt zwei: der Folgeschritt hiess frueher
       askMiraTypeLastAnswer(); if (window.askMiraSetExtras) askMiraSetExtras(messages);
   und griff damit auf die Variable des ERSTEN Schrittes zu. Die gibt es dort nicht -- Bubble
   fuehrt jeden Run-JS-Schritt fuer sich aus, und genau das war die zweite Haelfte der Fehlerkette
   ("messages is not defined").

   askMiraTypeLastAnswer BLEIBT, denn es macht den Tippeffekt der letzten Antwort. Es darf im
   selben Schritt stehen: es sucht die Antwort im DOM und probiert es bis zu 30 mal ueber rund
   zwei Sekunden, wartet also von sich aus, bis gezeichnet ist. Gemessen: 150ms nach dem Aufruf
   traegt die Nachricht am-typing und die Wurzel am-is-typing.

   askMiraSetExtras ist RAUS, und zwar nicht aus Bequemlichkeit: es montiert Opportunity-Karten
   und Aktionsknoepfe in Nachrichten, die SCHON im DOM stehen -- gedacht fuer Einbauten, die ihre
   Liste selbst zeichnen und NICHT ueber askMiraSetMessages gehen. Hier geht alles darueber, und
   der Weg montiert beides bereits selbst (mountInlineCards + mountOpportunityActions im
   Zeichnen). Gemessen: nach askMiraSetMessages allein steht der "Add as Opportunity"-Knopf da,
   ohne einen einzigen weiteren Aufruf. */
(function () {
  var CHAT_ID = `[Chat-ID]`;

  var ROH = `[get_mira_chat_messages's ... :format as text]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.askMiraSetActiveChat) window.askMiraSetActiveChat(CHAT_ID, false); } catch (e) {}
  try { if (window.askMiraSetMessages)   window.askMiraSetMessages(ROH); } catch (e) {}
  try { if (window.askMiraTypeLastAnswer) window.askMiraTypeLastAnswer(); } catch (e) {}
  try { if (window.askMiraSetLoading)    window.askMiraSetLoading("no"); } catch (e) {}
})();
