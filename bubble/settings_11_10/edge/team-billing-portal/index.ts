// team-billing-portal (11.10.2026), Settings v1 Schritt 5
// Oeffnet das Stripe-Kundenportal (Zahlungsart, Rechnungen, Kuendigen) fuer ein Team.
// Ersetzt fuer Settings v1 create-billing-portal-session (bleibt fuer Bubble alt bestehen).
//
// Eingang (POST, JSON, Authorization: Bearer <Nutzer-JWT>): { team_id, return_path? }
// return_path: eigener Pfad mit Query, genau ein fuehrendes "/", hoechstens 300 Zeichen, auf APP_URL;
// sonst BILLING_RETURN_PATH (Secret) bzw. "/?view=settings&st=billing" (wie create-team-checkout v3).
// Regeln (owner/admin, Team nicht geloescht, Stripe-Kunde vorhanden, 5 je Minute) prueft
// app.billing_portal_prepare_v1 mit dem JWT des Nutzers. Auch ohne Zugang (Abo abgelaufen) erlaubt,
// damit die Zahlung repariert werden kann.
//
// Erfolg 200: { success:true, url, portal_url, return_url, team_id }
// Fehler:     { success:false, error, message, code, hint }
import Stripe from "npm:stripe@16.12.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(status: number, error: string, hint: string | null = null) {
  return json({ success: false, error, message: error, code: null, hint }, status);
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function statusFor(message: string, code: string | undefined): number {
  if (message === "team_deleted") return 409;
  switch (code) {
    case "28000": return 401;
    case "42501": return 403;
    case "PT403": return 403;
    case "PT404": return 404;
    case "PT409": return 409;
    case "PT429": return 429;
    case "22023": return 400;
    default: return 500;
  }
}

function safeReturnUrl(raw: unknown, appOrigin: string, fallbackPath: string): string {
  const fallback = () => {
    const f = /^\/(?!\/)/.test(fallbackPath) ? fallbackPath : "/";
    return new URL(f, appOrigin).toString();
  };
  if (typeof raw !== "string") return fallback();
  const p = raw.trim();
  if (p.length === 0 || p.length > 300) return fallback();
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return fallback();
  if (/[\u0000-\u001f\u007f\s]/.test(p)) return fallback();
  try {
    const u = new URL(p, appOrigin);
    if (u.origin !== appOrigin || u.pathname.startsWith("//")) return fallback();
    u.searchParams.delete("checkout");
    u.searchParams.delete("session_id");
    u.hash = "";
    return u.toString();
  } catch {
    return fallback();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "method_not_allowed");

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const appUrlRaw = (Deno.env.get("APP_URL") ?? "").trim();
    let appUrl = "";
    try { appUrl = appUrlRaw ? new URL(appUrlRaw).origin : ""; } catch { appUrl = ""; }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!stripeSecretKey || !appUrl || !supabaseUrl || !anonKey) return fail(500, "server_config_missing");

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return fail(401, "settings_not_authenticated");

    const body = await req.json().catch(() => null);
    const teamId = body?.team_id;
    if (!isUuid(teamId)) return fail(400, "team_invalid_param", "team_id");
    const returnUrl = safeReturnUrl(
      body?.return_path,
      appUrl,
      (Deno.env.get("BILLING_RETURN_PATH") ?? "/?view=settings&st=billing").trim(),
    );

    const userDb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    }).schema("app");
    const { data: prep, error: prepError } = await userDb.rpc("billing_portal_prepare_v1", { p_team: teamId });
    if (prepError) {
      const msg = String(prepError.message ?? "billing_portal_failed");
      const error = /^[a-z0-9_]+$/.test(msg) ? msg : "billing_portal_failed";
      return json({ success: false, error, message: error, code: prepError.code ?? null, hint: prepError.hint ?? null },
        statusFor(error, prepError.code));
    }
    const customerId = (prep as any)?.row?.stripe_customer_id;
    if (typeof customerId !== "string" || !customerId.startsWith("cus_")) return fail(500, "billing_portal_failed");

    const stripe = new Stripe(stripeSecretKey);
    let session: Stripe.BillingPortal.Session;
    try {
      session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("team-billing-portal: stripe failed", teamId, m);
      if (/No such customer/i.test(m)) return fail(409, "billing_no_customer", "checkout");
      return fail(502, "billing_portal_failed");
    }
    if (!session?.url) return fail(502, "billing_portal_failed");

    return json({ success: true, url: session.url, portal_url: session.url, return_url: returnUrl, team_id: teamId });
  } catch (e) {
    console.error("team-billing-portal failed", e instanceof Error ? e.message : e);
    return fail(500, "billing_portal_failed");
  }
});
