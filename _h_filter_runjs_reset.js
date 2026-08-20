/* Dropdown-Filter -- RESET fuer Models, Topics und Markets
   Leert Auswahl UND gelieferte Liste, setzt Sortierung und Suchfeld auf die Vorgabe
   und schliesst das Dropdown. Danach steht dort "No models yet" / "No topics yet" /
   "No markets yet", bis der naechste Ladeschritt die Listen wieder fuellt.

   Still: kein Ereignis, kein Workflow. Sonst loeste der Reset selbst die Neuladung
   aus, die er gerade vorbereitet.

   Die drei INSTANCE_ID sind die Werte aus data-instance der drei HTML-Elemente --
   in der Regel drei verschiedene. */
window.resetModelsFilter("MODELS_INSTANCE_ID");
window.resetTopicsFilter("TOPICS_INSTANCE_ID");
window.resetMarketsFilter("MARKETS_INSTANCE_ID");
