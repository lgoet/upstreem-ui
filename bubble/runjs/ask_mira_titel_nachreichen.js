/* Mira: einen einzelnen Chat nachreichen -- fuer den Workflow "Realtime: Titel aktualisiert".

   EIN Datensatz statt einer ganzen Liste. askMiraAppendPreviousChats fuegt ihn ein, wenn die
   Leiste ihn noch nicht hat, und FRISCHT IHN AUF, wenn sie ihn schon kennt (seit 17.09.). Beide
   Faelle kommen vor: ein frisch angelegter Chat fehlt der Liste noch, ein aelterer steht schon
   ohne Titel darin.

   WARUM NICHT DIE GANZE LISTE NEU HOLEN: der Workflow tat das bisher, und es hing daran, dass
   die geholte Seite den Chat auch wirklich enthaelt. Genau das war nicht verlaesslich -- in der
   Spur stand offenerChatDabei: NEIN. Ein Datensatz, den der Ausloeser ohnehin in der Hand haelt,
   kann nicht die falsche Seite sein.

   WICHTIG: NICHT askMiraSetActiveChat nehmen. Der Titel kann zu einem Chat gehoeren, der gerade
   gar nicht offen ist -- damit wuerde der Aufruf den offenen Chat wechseln. */
(function () {
  var ROH = `[{ "id": "Feld mit der Chat-Id", "title": "Feld mit dem Titel" }]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.askMiraAppendPreviousChats) window.askMiraAppendPreviousChats(ROH); } catch (e) {}
})();
