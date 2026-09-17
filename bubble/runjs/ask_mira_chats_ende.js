/* Mira: "es gibt nichts mehr" -- der Schlusspunkt der Chatliste.

   Ein Schritt ohne Bubble-Ausdruck, und er hat genau eine Aufgabe: eine LEERE Liste anhaengen.
   Das ist das vereinbarte Ende -- danach fragt die Leiste beim Scrollen nicht mehr nach.

   Wann er laeuft: im selben Workflow wie das Nachladen, als eigener Schritt mit der Bedingung
   "Only when Result of step N's has_more is no".

   Ohne ihn hoert das Nachfragen erst auf, wenn zweimal hintereinander eine Seite ohne neue Chats
   ankommt -- das funktioniert, kostet aber jedes Mal zwei ueberfluessige Abfragen. */
(function () {
  try { if (window.askMiraAppendPreviousChats) window.askMiraAppendPreviousChats("[]"); } catch (e) {}
})();
