/* ONBOARDING -- Tarife in die Komponente geben (Schritt 5, Plan)

   WANN: im Workflow hinter uobStep, unter der Bedingung "Ereigniswert = plan". Der Klick auf
   Continue bei Prompts feuert KEIN eigenes Ereignis -- er wechselt nur den Schritt, und das ist
   uobStep mit dem nackten Wert "plan". Ein zusaetzliches Ereignis dafuer waere ein Ereignis ohne
   Ereignis: es gibt nichts zu melden ausser dem Schritt, der gerade gemeldet wurde.

   Waehrend der Abruf laeuft, stehen drei Kartenhuellen. Kommt acht Sekunden lang nichts, steht
   dort ein Lesekasten. Es ist also NICHT noetig, die Tarife schon beim Seitenaufbau zu holen --
   und besser, es nicht zu tun: der Aufbau ist ohnehin lang genug.

   Felder je Tarif (die Karte liest genau diese):
     id                      geht als plan_id in uobFinish zurueck
     name                    Titel der Karte
     description             Zeile darunter. Fehlt sie, faellt die Zeile weg.
     monthly_price_eur       Preis im Monatsmodus
     yearly_price_eur        Jahrespreis. Angezeigt wird er GETEILT DURCH 12, und die Ersparnis
                             daneben ist daraus gerechnet -- kein Feld dafuer, kein getippter
                             Prozentwert, der beim naechsten Preis falsch waere.
     prompts_per_day         "Track up to N prompts"
     ai_responses_per_month  "Analyze up to N AI responses per month". Fehlt das Feld, faellt die
                             Zeile weg -- die Zahl laesst sich nicht rechnen (die Preisseite nennt
                             4.650, 13.500 und ueber 30.000 bei 50, 150 und 350 Prompts, das sind
                             gesetzte Zahlen und keine Formel).
     ai_responses_more       true -> "Analyze more than ..." statt "up to"
     competitors_max_active  Angezeigt wird N + 1: die Preisseite zaehlt die eigene Marke mit.
     support_label           Letzte Zeile. Fehlt sie, entscheidet die Position (der erste Tarif
                             bekommt "Standard email support", die anderen "Personal account
                             manager") -- besser mitschicken, das ist eine Annahme.
     trial_days              Der Vorspann ueber den Karten. Nur wenn ALLE Tarife dieselbe Zahl
                             tragen, steht sie im Text; sonst heisst es nur "a free trial".
     sort_order              Reihenfolge. Fehlt sie, wird nach monthly_price_eur sortiert.

   "Most popular" steht auf der MITTLEREN Karte und nur, wenn es genau drei gibt. Kein Feld dafuer
   -- ein erfundenes waere eine Behauptung aus der Komponente heraus.

   Backticks: den RPC-Text ROH hineinsetzen, nicht im Schritt parsen. Die Komponente liest ihn mit
   UC.readBubble, und der bringt die Reparatur fuer leere Werte und fuer nacktes yes/no schon mit --
   ein eigener Parser im Schritt hat sie nicht. */

/* ---------- dynamisch ---------- */
(function () {
  var PLANS = `[PLANS_RPC]`;
  var t = 0;
  (function go () {
    if (typeof window.setOnboardingPlans === "function") {
      window.setOnboardingPlans("INSTANCE_ID", PLANS);
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();

/* ---------- statisch, drei Tarife zum Ausprobieren ----------
(function () {
  window.setOnboardingPlans("INSTANCE_ID", `[
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Starter",
      "description": "For a first brand.",
      "monthly_price_eur": 49,
      "yearly_price_eur": 470,
      "prompts_per_day": 50,
      "ai_responses_per_month": 4650,
      "competitors_max_active": 5,
      "support_label": "Standard email support",
      "trial_days": 14,
      "sort_order": 1
    },
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "name": "Growth",
      "description": "For a growing team.",
      "monthly_price_eur": 129,
      "yearly_price_eur": 1238,
      "prompts_per_day": 150,
      "ai_responses_per_month": 13500,
      "competitors_max_active": 10,
      "support_label": "Personal account manager",
      "trial_days": 14,
      "sort_order": 2
    },
    {
      "id": "33333333-3333-3333-3333-333333333333",
      "name": "Scale",
      "description": "For an agency.",
      "monthly_price_eur": 299,
      "yearly_price_eur": 2870,
      "prompts_per_day": 350,
      "ai_responses_per_month": 30000,
      "ai_responses_more": true,
      "competitors_max_active": 25,
      "support_label": "Personal account manager",
      "trial_days": 14,
      "sort_order": 3
    }
  ]`);
})();
*/
