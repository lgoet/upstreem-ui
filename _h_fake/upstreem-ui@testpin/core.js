/* Steht fuer eine Datei, die ein alter Element-Loader ein zweites Mal einhaengt. Sie zaehlt nur,
   dass sie AUSGEFUEHRT wurde -- genau die Frage, um die es geht: der Doppel-Waechter nimmt den
   Tag aus dem Dokument, aber verhindert das die Ausfuehrung? */
window.__coreLaeufe = (window.__coreLaeufe || 0) + 1;
