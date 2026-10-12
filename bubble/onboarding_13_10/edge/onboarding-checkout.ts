// onboarding-checkout — Stripe-Kasse fürs Onboarding (Vertrag ONBOARDING_V1_VERTRAG.md, Abschnitt 3.3)
// Stand 13.10.2026. Ersetzt create-onboarding-checkout für die neue Oberfläche (die alte bleibt für Bubble).
//
// POST /functions/v1/onboarding-checkout
//   Body:   {"onboarding_id": "...", "plan_id": "...", "billing_interval": "monthly|yearly",
//            "return_path": "/onboarding"}          return_path optional: "/onboarding" oder "/version-test/onboarding"
//   200:    {"url": "https://checkout.stripe.com/...", "session_id": "cs_...", "trial_days": 14,
//            "plan_name": "Professional", "billing_interval": "monthly"}
//   Fehler: {"code","message","hint","details"}
//
// Preis, Testphase und Auswahl kommen aus der Datenbank (_onb_checkout_prepare_v1). Testphase nur, wenn
// Nutzer und Website-Domain noch keine hatten; die Karte prüft der Webhook nach der Zahlung.
// Rückkehr: <APP_URL><return_path>?checkout=success&session_id={CHECKOUT_SESSION_ID}
//           <APP_URL><return_path>?checkout=cancelled

import { clearCheckoutSession, corsHeaders, dbError, err, getUserId, json, rpc, stripe, STRIPE_SECRET_KEY, UUID_RE } from "./_onb.ts";

const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");
const RETURN_PATHS = new Set(["/onboarding", "/version-test/onboarding"]);

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return err(405, "edge_method_not_allowed", "POST, OPTIONS", cors);

  const userId = await getUserId(req);
  if (!userId) return err(401, "onboarding_not_authenticated", null, cors);
  if (!STRIPE_SECRET_KEY || !APP_URL) return err(503, "edge_not_configured", "STRIPE_SECRET_KEY, APP_URL", cors);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return err(400, "edge_invalid_body", "onboarding_id, plan_id, billing_interval", cors);
  }
  const onboardingId = typeof body?.onboarding_id === "string" ? body.onboarding_id : "";
  const planId = typeof body?.plan_id === "string" ? body.plan_id
    : (typeof body?.billing_plan_id === "string" ? body.billing_plan_id : "");
  const interval = body?.billing_interval;
  const returnPath = typeof body?.return_path === "string" ? body.return_path : "/onboarding";
  if (!UUID_RE.test(onboardingId)) return err(400, "edge_invalid_body", "onboarding_id", cors);
  if (!UUID_RE.test(planId)) return err(400, "edge_invalid_body", "plan_id", cors);
  if (interval !== "monthly" && interval !== "yearly") return err(400, "onboarding_invalid", "billing_interval", cors);
  if (!RETURN_PATHS.has(returnPath)) return err(400, "edge_invalid_body", "return_path", cors);

  const prep = await rpc("_onb_checkout_prepare_v1", {
    p_user: userId, p_onboarding: onboardingId, p_plan: planId, p_interval: interval,
  });
  if (prep.status >= 300) return dbError(prep, cors);
  const p = prep.body ?? {};

  try {
    if (p.previous_session_id) {
      const state = await clearCheckoutSession(String(p.previous_session_id));
      if (state === "complete") return err(409, "onboarding_checkout_open", "paid", cors);
    }

    const trialDays = Number(p.trial_days ?? 0);
    const metadata = {
      onboarding_id: onboardingId,
      user_id: userId,
      billing_plan_id: p.plan_id,
      billing_plan_name: p.plan_name,
      billing_interval: interval,
      trial_days: String(trialDays),
      source: "onboarding",
    };
    const base = `${APP_URL}${returnPath}`;
    const session = await stripe("POST", "checkout/sessions", {
      mode: "subscription",
      line_items: [{ price: p.price_id, quantity: 1 }],
      allow_promotion_codes: interval === "monthly" ? "true" : "false",
      payment_method_collection: "always",
      customer_email: p.email ?? undefined,
      client_reference_id: onboardingId,
      metadata,
      subscription_data: trialDays > 0 ? { metadata, trial_period_days: trialDays } : { metadata },
      success_url: `${base}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}?checkout=cancelled`,
    });

    const set = await rpc("_onb_checkout_set_v1", {
      p_user: userId, p_onboarding: onboardingId, p_plan: p.plan_id, p_interval: interval,
      p_session_id: session.id, p_url: session.url, p_trial_days: trialDays,
    });
    if (set.status >= 300) {
      try { await stripe("POST", `checkout/sessions/${encodeURIComponent(session.id)}/expire`); } catch (_) { /* egal */ }
      return dbError(set, cors);
    }
    return json(200, {
      url: session.url,
      session_id: session.id,
      trial_days: trialDays,
      plan_name: p.plan_name,
      billing_interval: interval,
    }, cors);
  } catch (e) {
    console.error("onboarding-checkout stripe", String(e).slice(0, 400));
    return err(502, "edge_upstream_failed", "stripe", cors);
  }
});
