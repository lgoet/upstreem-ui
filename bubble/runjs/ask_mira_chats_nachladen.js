/* Mira: die naechste Seite der Chatliste ANHAENGEN -- Antwort auf das Ereignis more_chats.

   HAUSFORM (CLAUDE.md 2a): ein Backtick um den Bubble-Ausdruck, beide Sanitizer-Zeilen, roher
   Text in den Setter.

   WAS HIER HINEINGEHOERT, UND WAS NICHT (17.09.):
   In den Ausdruck kommt NUR das Ergebnis dieses einen RPC-Aufrufs -- "Result of step N's
   sessions" -- und nicht eine Bubble-Liste, in der alle bisherigen Chats gesammelt werden.
   Gemessen am laufenden System: der RPC lieferte 15 Sitzungen, bei askMiraAppendPreviousChats
   kamen 38 an, alle schon bekannt. Anhaengen heisst anhaengen; was die Leiste schon hat, weiss
   sie selbst.

   DER OFFSET KOMMT AUS DER VORIGEN ANTWORT, nicht aus der Nutzlast des Ereignisses. Das Ereignis
   meldet have und have_recents -- das ist eine Auskunft, kein Offset: have zaehlt auch die Chats
   in Projekten mit (bei ihm 30 Sitzungen + 8 aus Projekten = 38, und der naechste Aufruf sprang
   damit auf p_offset 38 statt 30 -- acht Chats uebersprungen). Der RPC gibt next_offset selbst
   zurueck; das gehoert in einen Custom State und von dort in den naechsten Aufruf. */
(function () {
  var ROH = `[Result of step N's sessions :format as text]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.askMiraAppendPreviousChats) window.askMiraAppendPreviousChats(ROH); } catch (e) {}
})();
