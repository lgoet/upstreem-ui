/* ONBOARDING -- SCHRITT E: Steuerung (Fehler, Ladezustand, Schritt, Reset)

   Vier kleine Schritte, jeder fuer sich in Bubble anzulegen. Hier stehen sie zusammen, damit man
   sie an einer Stelle nachschlagen kann -- in Bubble gehoert jeweils NUR der eine Aufruf in den
   Schritt, den man braucht. */

/* ── E1: Fehler zeigen ────────────────────────────────────────────────────────────────────
   Ein Band ueber dem Inhalt. Beendet jede laufende Uhr und den Kreisel im Weiter-Knopf -- ein
   Fehler, der das Warten weiterlaufen laesst, sieht aus wie "gleich da". */
window.setOnboardingError("onboarding", "<Result of Step 1's last_error>");

/* ── E2: Kreisel im Weiter-Knopf ──────────────────────────────────────────────────────────
   Fuer die Zeit zwischen uobFinish und dem Weiterleiten in die App. "yes" an, "no" aus. */
window.setOnboardingLoading("onboarding", "yes");

/* ── E3: zu einem Schritt springen ────────────────────────────────────────────────────────
   brand | competitors | topics | prompts | plan. Braucht man selten -- die Seite merkt sich den
   Schritt selbst in der Adresse (?step=). Nuetzlich, wenn ein Workflow den Nutzer irgendwohin
   fuehren soll, etwa nach einem Fehler zurueck auf die Stammdaten. */
window.setOnboardingStep("onboarding", "competitors");

/* ── E4: alles zuruecksetzen ──────────────────────────────────────────────────────────────
   Leert Projekt, Listen und Auswahl, geht auf Schritt 1 und setzt die Adresse zurueck. Fuer
   "Start over" oder wenn der Nutzer ein zweites Team anlegt. */
window.resetOnboarding("onboarding");
