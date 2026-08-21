/* ONBOARDING -- SCHRITT D: die Tarife

   WANN: beim Seitenaufbau. Sie haengen an keinem Hintergrundlauf und koennen sofort kommen.

   Vier Felder liefert die RPC heute NICHT und die Karte braucht sie:
     description              die Unterzeile ("Get started with basic monitoring and analytics")
     ai_responses_per_month   4650 / 13500 / 30000 -- NICHT rechenbar, siehe unten
     ai_responses_more        bei "Analyze MORE THAN 30.000" auf yes, sonst weglassen
     support_label            "Standard email support" / "Personal account manager"

   Warum die Antwortzahl aus den Daten kommen MUSS: die Preisseite nennt 4.650, 13.500 und ueber
   30.000 bei 50, 150 und 350 Prompts -- Faktoren von 93, 90 und 85,7. Das ist keine Formel, das
   sind gesetzte Zahlen. Fehlt das Feld, laesst die Karte die Zeile weg statt zu raten.

   Die Marken-Zeile rechnet die EIGENE Marke dazu: aus competitors_max_active 5 wird
   "Track up to 6 brands / competitors", wie auf der Preisseite. */
(function () {
  var INSTANCE_ID = "onboarding";

  var TARIFE = `[
    <Search for BillingPlans:sorted by sort_order:each item's ... :format as text>
      {
        "id": "<This item's id>",
        "name": "<This item's name>",
        "description": "<This item's description>",
        "monthly_price_eur": "<This item's monthly_price_eur>",
        "yearly_price_eur": "<This item's yearly_price_eur>",
        "prompts_per_day": "<This item's prompts_per_day>",
        "competitors_max_active": "<This item's competitors_max_active>",
        "ai_responses_per_month": "<This item's ai_responses_per_month>",
        "ai_responses_more": "<This item's ai_responses_more>",
        "support_label": "<This item's support_label>",
        "trial_days": "<This item's trial_days>",
        "sort_order": "<This item's sort_order>"
      }
    <Trenner: ,>
  ]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var versuche = 0;
  (function los() {
    if (typeof window.setOnboardingPlans === "function") {
      window.setOnboardingPlans(INSTANCE_ID, TARIFE);
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[onboarding] setOnboardingPlans gibt es nach 6s nicht.");
  })();
})();
