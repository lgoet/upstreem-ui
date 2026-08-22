/* ONBOARDING -- TESTDATEN 5: Das Projekt

   Wortgleich die Beispieldaten aus onboarding-page.js. Zum Ausprobieren OHNE Bubble-Daten:
   in einen Run-JavaScript-Schritt kopieren, INSTANCE_ID anpassen, fertig.
   Fuer den Echtbetrieb dann _h_uob_runjs_*.js nehmen -- die tragen die Bubble-Ausdruecke.

   Fuellt das Formular aus Schritt 1 nach (company_name, website_url, market, business_model,
   brand_industry) und stellt ueber status_phase zugleich die Phase. status_phase 5 schaltet
   sofort weiter -- also auch hier erst die Listen schicken.
   status "error" oder ein gefuelltes last_error beendet die Uhr und zeigt das Fehlerband. */
(function () {
  var INSTANCE_ID = "onboarding";

  var PROJEKT = `{
     "id": "9346b43e-f7b9-4122-ad10-0869aaecc21d",
     "user_id": "aea6e317-d901-419b-b2b2-5ca3573ea2f5",
     "mode": "Brand",
     "business_model": "B2B",
     "brand_industry": "Lautsprecher / Beschallung",
     "market_focus": null,
     "website_input": "https://www.funktion-one.com",
     "website_url": "https://funktion-one.com",
     "website_domain": "funktion-one.com",
     "status": "ready",
     "run_group_uuid": null,
     "status_phase": 5,
     "status_label": "Finalizing insights",
     "progress_percent": 100,
     "last_error": null,
     "created_at": "2026-08-20T11:52:29.900336+00:00",
     "updated_at": "2026-08-20T11:52:29.97104+00:00",
     "company_name": "Function One",
     "summary": "Funktion-One ist ein Hersteller professioneller Lautsprechersysteme fuer Tourneen, Festivals, Arenen, Clubs und Installationen.",
     "market": "DE",
     "selected_billing_plan_id": null,
     "billing_interval": null,
     "stripe_checkout_session_id": null,
     "stripe_checkout_url": null,
     "team_id": null
    }`;

  var t = 0;
  (function go () {
    if (typeof window.setOnboardingProject === "function") {
      window.setOnboardingProject(INSTANCE_ID, PROJEKT);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();
