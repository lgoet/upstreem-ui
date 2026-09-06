/* BUBBLE RUN-JS -- "Chatleiste: Skelette AN"
   WOHIN: in den Workflow, der die Chatliste holt, als ERSTER Schritt (Page is loaded, und vor
   jedem Neuladen der Liste). Direkt danach kommt der RPC.

   WARUM ES DIESEN SCHRITT GIBT: die Komponente hat bisher selbst geraten, wann geladen wird --
   die Skelette endeten, sobald eine nicht leere Liste ankam, sonst nach sechs Sekunden. Wer die
   Daten holt, weiss es besser. */
(function(){
  var WERT = "yes";
  var fn = window.askMiraSetChatsLoading;
  /* Laeuft dieser Schritt, bevor ask-mira.js geladen ist -- beim Seitenaufbau der Normalfall --,
     dann gibt es die Funktion noch nicht oder nur als Platzhalter. Dann wird der Aufruf in die
     Warteschlange gelegt, die die Komponente beim Start abarbeitet. Ohne diesen Zweig wirft der
     Schritt einen Fehler und reisst die folgenden Schritte desselben Workflows mit. */
  if (typeof fn === "function" && !fn.__amStub) fn(WERT);
  else (window.__amBootQueue = window.__amBootQueue || []).push(["askMiraSetChatsLoading", [WERT]]);
})();
