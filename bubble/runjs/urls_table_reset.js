/* URLs Table -- RESET

   Setzt alles zurueck, was bestimmt, WELCHE Zeilen man sieht:
     Suche (Feld leer und zu), Citation Types UND URL Types, "Brand mentioned",
     die Marken-Auswahl (Mentioned brands), Sortierung, Seite 1, Zeilen je Seite.
   Offene Dropdowns gehen zu, eine noch wartende Sucheingabe wird verworfen.

   BLEIBT, wie der Nutzer es eingestellt hat:
     Table Settings (sichtbare Spalten, Comfortable/Compact) und die gezogenen Spaltenbreiten.

   STILL: kein Ereignis, kein Workflow -- wie jeder Reset-Schritt dieser Bibliothek. Sonst
   loeste der Reset selbst sechs Neuladungen aus (je Filter eine).
   Heisst auch: deine Bubble-States fuer Suche, Typen, Marke und Sortierung setzt dieser
   Schritt NICHT zurueck. Die gehoeren im selben Workflow auf leer, BEVOR die Tabelle neu
   geladen wird -- sonst laedt der RPC mit den alten Filtern, waehrend die Leiste keine zeigt.

   INSTANCE_ID ist der Wert aus data-instance des HTML-Elements der Tabelle. Gibt es die id
   mehrfach auf der Seite, werden alle Kopien zurueckgesetzt. */
(function () {
  try { if (window.resetUrlsTable) window.resetUrlsTable("INSTANCE_ID"); } catch (e) {}
})();
