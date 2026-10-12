// _onb.ts — gemeinsame Helfer der Onboarding-Edge-Functions (Stand 13.10.2026)
// Wird in jede Function mit hochgeladen (onboarding-start, onboarding-prompts,
// onboarding-checkout, onboarding-checkout-status).

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function firstKey(jsonEnv: string): string {
  try {
    const obj = JSON.parse(Deno.env.get(jsonEnv) ?? "{}");
    const values = Object.values(obj);
    return typeof values[0] === "string" ? (values[0] as string) : "";
  } catch {
    return "";
  }
}

export const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || firstKey("SUPABASE_PUBLISHABLE_KEYS");
export const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || firstKey("SUPABASE_SECRET_KEYS");
export const N8N_SHARED_SECRET = Deno.env.get("N8N_SHARED_SECRET") ?? "";

const ALLOWED_ORIGINS = new Set<string>([
  "https://app.upstreem.ai",
  "https://llmoscout.bubbleapps.io",
]);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

export function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function err(status: number, code: string, hint: string | null, cors: Record<string, string>): Response {
  return json(status, { code, message: code, hint, details: null }, cors);
}

export type RpcResult = { status: number; body: any };

// Datenbank immer mit service_role (die Funktionen prüfen p_user selbst).
export async function rpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers: Record<string, string> = {
      "apikey": SERVICE_KEY,
      "Content-Type": "application/json",
      "Content-Profile": "app",
      "Accept-Profile": "app",
    };
    if (!SERVICE_KEY.startsWith("sb_")) headers["Authorization"] = `Bearer ${SERVICE_KEY}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers,
      body: JSON.stringify(args),
    });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { code: "edge_upstream_failed", message: "edge_upstream_failed", hint: null, details: null };
    }
    const retryable = !res.ok && body && body.code === "XX000" && String(body.message ?? "").includes("pldbgapi2");
    if (retryable && attempt === 0) {
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    return { status: res.status, body };
  }
  return { status: 502, body: { code: "edge_upstream_failed", message: "edge_upstream_failed", hint: null, details: null } };
}

// Fehler der DB unverändert weitergeben (message = Code), aber nie Rohtext anderer Fehler.
export function dbError(r: RpcResult, cors: Record<string, string>): Response {
  const b = r.body ?? {};
  const known = typeof b.message === "string" && /^[a-z_]+$/.test(b.message);
  if (known) return json(r.status, { code: b.message, message: b.message, hint: b.hint ?? null, details: null }, cors);
  console.error("db error", r.status, JSON.stringify(b).slice(0, 500));
  return err(502, "edge_upstream_failed", null, cors);
}

export async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { "apikey": ANON_KEY, "Authorization": `Bearer ${m[1]}` },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  return u && typeof u.id === "string" ? u.id : null;
}

// n8n anstoßen: geheimer Header, 20 s. Liefert null bei Erfolg, sonst Fehlertext (nur fürs Log).
export async function callN8n(url: string, payload: unknown): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Upstreem-Secret": N8N_SHARED_SECRET },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    await res.text().catch(() => "");
    return res.ok ? null : `n8n HTTP ${res.status}`;
  } catch (e) {
    return String(e).slice(0, 300);
  }
}

// ---------------------------------------------------------------- Stripe (fetch, ohne SDK)
export const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

function formEncode(obj: Record<string, unknown>, prefix = "", out: string[] = []): string[] {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") formEncode(item as Record<string, unknown>, `${key}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      formEncode(v as Record<string, unknown>, key, out);
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

export async function stripe(method: "GET" | "POST", path: string, params?: Record<string, unknown>): Promise<any> {
  let url = `https://api.stripe.com/v1/${path}`;
  const init: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (params) {
    const body = formEncode(params).join("&");
    if (method === "GET") url += (url.includes("?") ? "&" : "?") + body;
    else init.body = body;
  }
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(`stripe ${res.status} ${data?.error?.code ?? ""} ${data?.error?.message ?? ""}`.trim());
    (e as any).stripeStatus = res.status;
    throw e;
  }
  return data;
}

// Offene Sitzung verwerfen. Liefert den Zustand: 'complete' (bezahlt), 'expired', 'open_expired', 'missing'.
export async function clearCheckoutSession(sessionId: string): Promise<string> {
  try {
    const s = await stripe("GET", `checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (s.status === "complete") return "complete";
    if (s.status === "open") {
      await stripe("POST", `checkout/sessions/${encodeURIComponent(sessionId)}/expire`);
      return "open_expired";
    }
    return "expired";
  } catch (e) {
    if ((e as any).stripeStatus === 404) return "missing";
    throw e;
  }
}

function idOf(v: any): string | null {
  if (typeof v === "string" && v) return v;
  if (v && typeof v === "object" && typeof v.id === "string") return v.id;
  return null;
}

function iso(v: unknown): string | null {
  return typeof v === "number" && Number.isFinite(v) ? new Date(v * 1000).toISOString() : null;
}

// Gemeinsamer Abschluss nach der Kasse (Webhook und Rückfall-Abfrage).
// Idempotent: Finalize liefert bei completed sofort das Team.
export async function finalizeFromSession(session: any): Promise<{ ok: boolean; team_id: string | null; code: string | null }> {
  const md = session.metadata ?? {};
  const onboardingId = md.onboarding_id;
  const userId = md.user_id;
  const planId = md.billing_plan_id;
  const interval = md.billing_interval;
  const subId = idOf(session.subscription);
  if (!onboardingId || !userId || !planId || !interval || !subId) {
    return { ok: false, team_id: null, code: "finalize_failed" };
  }
  const sub = await stripe("GET", `subscriptions/${encodeURIComponent(subId)}`, { "expand": ["default_payment_method"] });
  const customerId = idOf(session.customer) ?? idOf(sub.customer);
  const firstItem = sub?.items?.data?.[0] ?? {};
  const fin = await rpc("onboarding_finalize_after_billing_v1", {
    p_onboarding_id: onboardingId,
    p_user_id: userId,
    p_billing_plan_id: planId,
    p_billing_interval: interval,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subId,
    p_stripe_subscription_status: sub.status ?? "unknown",
    p_trial_ends_at: iso(sub.trial_end),
    p_current_period_end: iso(sub.current_period_end) ?? iso(firstItem.current_period_end),
  });
  if (fin.status >= 300) {
    const msg = String(fin.body?.message ?? "");
    const code = /cannot be finalized from status/i.test(msg) ? "finalize_state" : "finalize_failed";
    console.error("finalize failed", onboardingId, fin.status, msg.slice(0, 300));
    const r = await rpc("_onb_finalize_failed_v1", { p_onboarding: onboardingId, p_code: code });
    if (r.status >= 300) console.error("finalize_failed marker failed", r.status);
    return { ok: false, team_id: null, code };
  }
  // Testphase festhalten; schon einmal genutzt (Nutzer, Domain oder Karte) -> sofort beenden
  try {
    const trialDays = sub.status === "trialing" && sub.trial_end && sub.trial_start
      ? Math.round((sub.trial_end - sub.trial_start) / 86400) : 0;
    if (trialDays > 0) {
      const fp = sub?.default_payment_method?.card?.fingerprint ?? null;
      const reg = await rpc("_onb_trial_register_v1", {
        p_onboarding: onboardingId, p_subscription: subId, p_fingerprint: fp, p_trial_days: trialDays,
      });
      if (reg.status < 300 && reg.body?.end_trial === true && sub.status === "trialing") {
        await stripe("POST", `subscriptions/${encodeURIComponent(subId)}`, { trial_end: "now", proration_behavior: "none" });
        console.log("trial ended early", onboardingId, subId);
      }
    }
  } catch (e) {
    console.error("trial register failed", String(e).slice(0, 300));
  }
  return { ok: true, team_id: fin.body?.team_id ?? null, code: null };
}
