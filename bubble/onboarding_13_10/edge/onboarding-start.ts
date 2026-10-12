// onboarding-start — startet den großen Onboarding-Lauf (Vertrag ONBOARDING_V1_VERTRAG.md, Abschnitt 3.1)
// Stand 13.10.2026
//
// POST /functions/v1/onboarding-start
//   Header: Authorization: Bearer <Nutzer-JWT>, apikey: <publishable key>, Content-Type: application/json
//   Body:   {"company_name": "...", "website": "...", "market": "DE", "timezone": "Europe/Berlin",
//            "business_model": "B2B|B2C|Hybrid|CitiesRegions"}
//   202:    {"onboarding_id": "...", "status": "submitted", "status_phase": 1, "reused": false}
//   200:    {"onboarding_id": "...", "status": "...", "status_phase": n, "reused": true}   (ein Lauf läuft schon)
//   Fehler: {"code": "...", "message": "...", "hint": "...", "details": null} mit HTTP-Status
//
// Ablauf
//   1. JWT prüfen (selbst, damit auch 401 und OPTIONS CORS tragen).
//   2. Website: Umlautdomain -> Punycode; DNS-Auflösung gegen private Netze (website_blocked).
//   3. _onb_start_v1 (service_role, p_user aus dem JWT): Prüfung, Neustart-Regel, Kosten-Grenzen, Token.
//      Offene Stripe-Kasse: hier prüfen. Bezahlt -> 409 onboarding_checkout_open (hint paid), sonst verwerfen
//      und erneut mit p_checkout_cleared = true.
//   4. Im Hintergrund: n8n-Webhook N8N_ONBOARDING_START_URL mit Header X-Upstreem-Secret,
//      Body {onboarding_id, run_token}. Schlägt das fehl: onboarding_run_update_v1(..., 'start_failed').
//   Der Browser sieht nie einen Token und nie die Webhook-Adresse.

import { callN8n, clearCheckoutSession, corsHeaders, dbError, err, getUserId, json, rpc, STRIPE_SECRET_KEY } from "./_onb.ts";

const N8N_URL = Deno.env.get("N8N_ONBOARDING_START_URL") ?? "";

function str(v: unknown, max = 400): string | null {
  return typeof v === "string" ? v.slice(0, max) : null;
}

// Umlautdomain als Punycode; sonst unverändert.
function asciiWebsite(w: string): string {
  const t = w.trim();
  if (/^[\x00-\x7f]*$/.test(t)) return t;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return t;
  }
}

function hostOf(w: string): string {
  let s = w.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  s = s.split(/[\/?#]/)[0].split("@").pop() ?? "";
  s = s.replace(/:\d*$/, "").replace(/\.+$/, "").replace(/^www\./, "");
  return s;
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") ||
      l.startsWith("::ffff:") || l.startsWith("64:ff9b");
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

// 'ok' | 'blocked' | 'unresolved' | 'skipped' (DNS im Laufzeitsystem nicht verfügbar)
async function dnsCheck(host: string): Promise<string> {
  // deno-lint-ignore no-explicit-any
  const resolve = (Deno as any).resolveDns;
  if (typeof resolve !== "function" || !host) return "skipped";
  const ips: string[] = [];
  let anyAnswer = false;
  for (const name of [host, `www.${host}`]) {
    for (const type of ["A", "AAAA"]) {
      try {
        const r: string[] = await resolve(name, type);
        if (r.length) anyAnswer = true;
        ips.push(...r);
      } catch (e) {
        const n = (e as Error)?.name ?? "";
        if (n !== "NotFound" && !/no record|not found|NXDOMAIN/i.test(String(e))) return "skipped";
      }
    }
    if (anyAnswer) break;
  }
  if (!anyAnswer) return "unresolved";
  return ips.some(isPrivateIp) ? "blocked" : "ok";
}

async function triggerRun(onboardingId: string, runToken: string): Promise<void> {
  const failure = await callN8n(N8N_URL, { onboarding_id: onboardingId, run_token: runToken });
  if (failure) {
    console.log("onboarding-start n8n failed", onboardingId, failure);
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
  if (!N8N_URL || !STRIPE_SECRET_KEY) return err(503, "edge_not_configured", "N8N_ONBOARDING_START_URL, STRIPE_SECRET_KEY", cors);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return err(400, "edge_invalid_body", "company_name, website, market, timezone, business_model", cors);
  }
  const website = asciiWebsite(str(body?.website, 300) ?? "");
  const args = {
    p_user: userId,
    p_company_name: str(body?.company_name, 400),
    p_website: website,
    p_market: str(body?.market, 10),
    p_timezone: str(body?.timezone, 80),
    p_business_model: str(body?.business_model, 40),
    p_checkout_cleared: false,
  };

  // DNS: zeigt der Host ins interne Netz, gar nicht erst anlegen
  const dns = await dnsCheck(hostOf(website));
  if (dns === "blocked") return err(400, "onboarding_invalid", "website_blocked", cors);
  if (dns === "unresolved") return err(400, "onboarding_invalid", "website_unreachable", cors);

  let r = await rpc("_onb_start_v1", args);
  if (r.status >= 300) return dbError(r, cors);

  if (r.body?.checkout_check) {
    let state: string;
    try {
      state = await clearCheckoutSession(String(r.body.checkout_check));
    } catch (e) {
      console.error("onboarding-start stripe", String(e).slice(0, 300));
      return err(502, "edge_upstream_failed", "stripe", cors);
    }
    if (state === "complete") return err(409, "onboarding_checkout_open", "paid", cors);
    r = await rpc("_onb_start_v1", { ...args, p_checkout_cleared: true });
    if (r.status >= 300) return dbError(r, cors);
  }

  const m = r.body ?? {};
  if (m.reused === true) {
    return json(200, { onboarding_id: m.onboarding_id, status: m.status, status_phase: m.status_phase, reused: true }, cors);
  }
  if (!m.run_token || !m.onboarding_id) return err(502, "edge_upstream_failed", null, cors);

  // @ts-ignore EdgeRuntime ist in Supabase Edge Functions vorhanden
  EdgeRuntime.waitUntil(triggerRun(m.onboarding_id, m.run_token));
  return json(202, { onboarding_id: m.onboarding_id, status: "submitted", status_phase: 1, reused: false }, cors);
});
