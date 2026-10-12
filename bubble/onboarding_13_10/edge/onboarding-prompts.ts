// onboarding-prompts — startet den Promptlauf (Vertrag ONBOARDING_V1_VERTRAG.md, Abschnitt 3.2)
// Stand 13.10.2026
//
// POST /functions/v1/onboarding-prompts
//   Body:   {"onboarding_id": "...", "new_topics": ["Eigenes Thema", ...]}   (new_topics optional, max. 5 × 40 Zeichen)
//   202:    {"onboarding_id": "...", "status": "processing", "status_phase": 6, "reused": false}
//   200:    {..., "reused": true}   gleiche Themenauswahl wie beim letzten fertigen Lauf, oder Lauf läuft schon
//   Fehler: {"code","message","hint","details"} mit HTTP-Status
//
// Die Themenauswahl liest die Datenbank selbst (onboarding_select_v1 'topics' vorher).
// Eigene Themen legt _onb_prompts_start_v1 an (ausgewählt). Offene Kasse: wie onboarding-start.
// n8n: N8N_ONBOARDING_PROMPTS_URL mit Header X-Upstreem-Secret, Body {onboarding_id, run_token}.

import { callN8n, clearCheckoutSession, corsHeaders, dbError, err, getUserId, json, rpc, STRIPE_SECRET_KEY, UUID_RE } from "./_onb.ts";

const N8N_URL = Deno.env.get("N8N_ONBOARDING_PROMPTS_URL") ?? "";

async function triggerRun(onboardingId: string, runToken: string): Promise<void> {
  const failure = await callN8n(N8N_URL, { onboarding_id: onboardingId, run_token: runToken });
  if (failure) {
    console.log("onboarding-prompts n8n failed", onboardingId, failure);
    await rpc("onboarding_run_update_v1", {
      p_onboarding: onboardingId, p_run_token: runToken, p_phase: null, p_error_code: "start_failed",
    });
  }
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return err(405, "edge_method_not_allowed", "POST, OPTIONS", cors);

  const userId = await getUserId(req);
  if (!userId) return err(401, "onboarding_not_authenticated", null, cors);
  if (!N8N_URL || !STRIPE_SECRET_KEY) return err(503, "edge_not_configured", "N8N_ONBOARDING_PROMPTS_URL, STRIPE_SECRET_KEY", cors);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return err(400, "edge_invalid_body", "onboarding_id, new_topics", cors);
  }
  const onboardingId = typeof body?.onboarding_id === "string" ? body.onboarding_id : "";
  if (!UUID_RE.test(onboardingId)) return err(400, "edge_invalid_body", "onboarding_id", cors);
  let topics: string[] | null = null;
  if (body?.new_topics !== undefined && body?.new_topics !== null) {
    if (!Array.isArray(body.new_topics) || body.new_topics.some((t: unknown) => typeof t !== "string")) {
      return err(400, "edge_invalid_body", "new_topics", cors);
    }
    if (body.new_topics.length > 5) return err(400, "onboarding_invalid", "too_many_own_topics", cors);
    topics = body.new_topics.map((t: string) => t.slice(0, 200));
  }

  const args = { p_user: userId, p_onboarding: onboardingId, p_new_topics: topics, p_checkout_cleared: false };
  let r = await rpc("_onb_prompts_start_v1", args);
  if (r.status >= 300) return dbError(r, cors);

  if (r.body?.checkout_check) {
    let state: string;
    try {
      state = await clearCheckoutSession(String(r.body.checkout_check));
    } catch (e) {
      console.error("onboarding-prompts stripe", String(e).slice(0, 300));
      return err(502, "edge_upstream_failed", "stripe", cors);
    }
    if (state === "complete") return err(409, "onboarding_checkout_open", "paid", cors);
    r = await rpc("_onb_prompts_start_v1", { ...args, p_checkout_cleared: true });
    if (r.status >= 300) return dbError(r, cors);
  }

  const m = r.body ?? {};
  if (m.reused === true) {
    return json(200, { onboarding_id: m.onboarding_id, status: m.status, status_phase: m.status_phase, reused: true }, cors);
  }
  if (!m.run_token) return err(502, "edge_upstream_failed", null, cors);

  // @ts-ignore EdgeRuntime ist in Supabase Edge Functions vorhanden
  EdgeRuntime.waitUntil(triggerRun(m.onboarding_id, m.run_token));
  return json(202, { onboarding_id: m.onboarding_id, status: "processing", status_phase: 6, reused: false }, cors);
});
