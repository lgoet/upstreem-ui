/* ONBOARDING -- TESTDATEN 4: Tarife

   Wortgleich die Beispieldaten aus onboarding-page.js. Zum Ausprobieren OHNE Bubble-Daten:
   in einen Run-JavaScript-Schritt kopieren, INSTANCE_ID anpassen, fertig.
   Fuer den Echtbetrieb dann _h_uob_runjs_*.js nehmen -- die tragen die Bubble-Ausdruecke.

   WANN: beim Seitenaufbau -- sie haengen an keinem Hintergrundlauf.
   description, ai_responses_per_month, ai_responses_more und support_label liefert die RPC
   heute NICHT. Fehlen sie, laesst die Karte die betreffende Zeile weg statt eine Zahl zu
   erfinden -- die Antwortzahlen lassen sich nicht aus den Prompts rechnen. */
(function () {
  var INSTANCE_ID = "onboarding";

  var TARIFE = `[
     {
      "id": "54be31d2-dc61-4a5e-8ea0-31c4370a4cb3",
      "name": "Essential",
      "description": "Get started with basic monitoring and analytics",
      "monthly_price_eur": 89.0,
      "yearly_price_eur": 948.0,
      "prompts_per_day": 50,
      "competitors_max_active": 5,
      "trial_days": 30,
      "sort_order": null,
      "ai_responses_per_month": 4650,
      "support_label": "Standard email support"
     },
     {
      "id": "3129be58-d59a-4221-ba53-7b2e4131cf5f",
      "name": "Professional",
      "description": "Advanced monitoring and AI search insights",
      "monthly_price_eur": 205.0,
      "yearly_price_eur": 2220.0,
      "prompts_per_day": 150,
      "competitors_max_active": 10,
      "trial_days": 30,
      "sort_order": null,
      "ai_responses_per_month": 13500,
      "support_label": "Personal account manager"
     },
     {
      "id": "a980c741-807e-43dd-9617-8e06b82999ba",
      "name": "Enterprise",
      "description": "Advanced features for growing businesses",
      "monthly_price_eur": 429.0,
      "yearly_price_eur": 4380.0,
      "prompts_per_day": 350,
      "competitors_max_active": 15,
      "trial_days": 30,
      "sort_order": null,
      "ai_responses_per_month": 30000,
      "ai_responses_more": true,
      "support_label": "Personal account manager"
     }
    ]`;

  var t = 0;
  (function go () {
    if (typeof window.setOnboardingPlans === "function") {
      window.setOnboardingPlans(INSTANCE_ID, TARIFE);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();
