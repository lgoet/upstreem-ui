// onboarding-checkout-status — Rückfall nach der Kasse (Vertrag ONBOARDING_V1_VERTRAG.md, Abschnitt 3.4)
// Stand 13.10.2026
//
// POST /functions/v1/onboarding-checkout-status
//   Body:   {"session_id": "cs_..."}
//   200:    {"onboarding_id": "...", "status": "completed", "status_phase": 100, "team_id": "...",
//            "error_code": null, "payment": "complete|open|expired"}
//   Fehler: {"code","message","hint","details"}; fremde oder unbekannte Sitzung: 404 onboarding_not_found
//
// Normalfall: der Stripe-Webhook schließt ab, die Seite hört auf den Broadcast onboarding:<id>.
// Bleibt der aus, ruft die Seite diese Function EINMAL. Ist die Sitzung bezahlt (bzw. die Testphase
// angelegt) und gehört sie dem Nutzer, ruft sie dasselbe idempotente Finalize wie der Webhook.

import { corsHeaders, dbError, err, finalizeFromSession, getUserId, json, rpc, stripe, STRIPE_SECRET_KEY } from "./_onb.ts";

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return err(405, "edge_method_not_allowed", "POST, OPTIONS", cors);

  const userId = await getUserId(req);
  if (!userId) return err(401, "onboarding_not_authenticated", null, cors);
  if (!STRIPE_SECRET_KEY) return err(503, "edge_not_configured", "STRIPE_SECRET_KEY", cors);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return err(400, "edge_invalid_body", "session_id", cors);
  }
  const sessionId = typeof body?.session_id === "string" ? body.session_id : "";
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return err(400, "edge_invalid_body", "session_id", cors);

  const look = await rpc("_onb_checkout_lookup_v1", { p_user: userId, p_session_id: sessionId });
  if (look.status >= 300) return dbError(look, cors);
  const o = look.body ?? {};
  const out = (payment: string, extra: Record<string, unknown> = {}) => json(200, {
    onboarding_id: o.onboarding_id, status: o.status, status_phase: o.status_phase, team_id: o.team_id,
    error_code: o.error_code, payment, ...extra,
  }, cors);

  if (o.status === "completed" && o.team_id) return out("complete");

  let session: any;
  try {
    session = await stripe("GET", `checkout/sessions/${encodeURIComponent(sessionId)}`);
  } catch (e) {
    if ((e as any).stripeStatus === 404) return err(404, "onboarding_not_found", null, cors);
    console.error("checkout-status stripe", String(e).slice(0, 300));
    return err(502, "edge_upstream_failed", "stripe", cors);
  }
  const md = session.metadata ?? {};
  if (md.user_id !== userId || md.onboarding_id !== o.onboarding_id) return err(404, "onboarding_not_found", null, cors);

  if (session.status === "open") return out("open");
  if (session.status !== "complete") return out("expired");
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return out("open");

  try {
    const fin = await finalizeFromSession(session);
    const again = await rpc("_onb_checkout_lookup_v1", { p_user: userId, p_session_id: sessionId });
    const n = again.body ?? {};
    return json(200, {
      onboarding_id: n.onboarding_id, status: n.status, status_phase: n.status_phase,
      team_id: n.team_id ?? fin.team_id, error_code: n.error_code ?? fin.code, payment: "complete",
    }, cors);
  } catch (e) {
    console.error("checkout-status finalize", String(e).slice(0, 300));
    return err(502, "edge_upstream_failed", "stripe", cors);
  }
});
