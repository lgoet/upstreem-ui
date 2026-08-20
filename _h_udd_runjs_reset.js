/* Domain Detail -- RESET
   Leert die Daten und stellt die Skelette an. Einstellungen des Nutzers bleiben:
   Citation Share / URL Share (liegt in localStorage) und alles, was an den Charts
   eingestellt ist. Zurueck geht nur die Granularitaet auf Day.

   In Bubble als "Run javascript" mit genau diesem Inhalt. INSTANCE_ID ist der Wert,
   der im HTML-Element unter data-instance steht. */
window.resetDomainDetail("INSTANCE_ID");
