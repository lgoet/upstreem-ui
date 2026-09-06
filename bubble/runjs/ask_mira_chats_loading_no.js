/* BUBBLE RUN-JS -- "Chatleiste: Skelette AUS"
   WOHIN: in denselben Workflow, als LETZTER Schritt -- nach askMiraSetPreviousChats, also wenn
   die Liste wirklich im Element steht. Auch dann setzen, wenn die Liste LEER ist: ein Nutzer
   ohne Chats soll seine leere Leiste sehen und kein Dauerskelett.

   Nicht noetig, wenn direkt davor eine nicht leere Liste gesetzt wurde -- die beendet das Laden
   von selbst. Schadet aber nicht, und der leere Fall braucht ihn. */
(function(){
  var WERT = "no";
  var fn = window.askMiraSetChatsLoading;
  if (typeof fn === "function" && !fn.__amStub) fn(WERT);
  else (window.__amBootQueue = window.__amBootQueue || []).push(["askMiraSetChatsLoading", [WERT]]);
})();
