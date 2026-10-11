// team-invite-send (11.10.2026), Settings v1 Schritt 3
// Einladen und erneut senden in einem Aufruf. Ersetzt fuer Settings v1 den Weg
// create_team_invite_v1 + send-team-invite (die bleiben fuer Bubble alt bestehen).
//
// Eingang (POST, JSON, Authorization: Bearer <Nutzer-JWT>):
//   neu einladen:  { team_id, email, role: "member" | "admin", base_url? }
//   erneut senden: { team_id, invite_id, base_url? }
// base_url nur, wenn sie auf eine erlaubte eigene Adresse zeigt (z. B. https://app.upstreem.ai/version-test),
// sonst INVITE_BASE_URL (Secret), sonst https://app.upstreem.ai.
//
// Ablauf:
//   1. Klartext-Token (32 Byte, 64 hex) erzeugen, nur sha256(token) geht in die Datenbank.
//   2. Regeln prueft die Datenbank mit dem JWT des Nutzers:
//      app.team_invite_create_v1 / app.team_invite_resend_v1 (Rolle, Zugang, Grenzen, Pflichtfelder).
//   3. E-Mail ueber Resend (Idempotency-Key, 10 s Timeout, 1 Wiederholung).
//   4. Ergebnis zurueck in die Datenbank (service_role):
//      zugestellt   -> app._team_invite_mark_sent_v1 (Protokoll member_invited / invite_resent)
//      abgelehnt    -> app._team_invite_send_failed_v1 (neu: status send_failed; erneut: alter Link bleibt)
//      unklar       -> nichts; die Einladung steht mit send_state "unknown"
//
// Erfolg 200: { success:true, invite_id, sent_at, unchanged, send_state, resend_count, expires_at }
// Fehler:     { success:false, error, message, code, hint, invite_id? } (Tabelle in SETTINGS_V1_VORSCHLAG.md 10.4)
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

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return json({ success: false, error, message: error, code: null, hint: null, ...extra }, status);
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// Fehler aus der Datenbank (message = Code) -> HTTP
function statusFor(message: string, code: string | undefined): number {
  switch (message) {
    case "team_deleted": return 409;
    case "team_invite_not_found": return 404;
    case "team_member_not_found": return 404;
  }
  switch (code) {
    case "28000": return 401;
    case "42501": return 403;
    case "PT402": return 402;
    case "PT403": return 403;
    case "PT404": return 404;
    case "PT409": return 409;
    case "PT429": return 429;
    case "22023": return 400;
    default: return 500;
  }
}

function dbFail(err: { message?: string; code?: string; hint?: string | null; details?: string | null }) {
  const message = String(err?.message ?? "settings_failed");
  // Rechtefehler der Datenbank selbst (z. B. fehlende Grants) nicht nach aussen tragen
  const error = /^[a-z0-9_]+$/.test(message) ? message : "settings_failed";
  return json({ success: false, error, message: error, code: err?.code ?? null, hint: err?.hint ?? null },
    statusFor(error, err?.code));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanName(value: string): string {
  const one = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return one.length > 80 ? one.slice(0, 79) + "…" : one;
}

// Link nur auf eigene Adressen (llmoscout.bubbleapps.io ist alt und nicht erlaubt)
const ALLOWED_INVITE_HOSTS = new Set(["app.upstreem.ai", "upstreem.ai", "www.upstreem.ai"]);
const ALLOWED_INVITE_PATHS = new Set(["", "/", "/version-test", "/version-live"]);

function allowedBaseUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return null;
    if (!ALLOWED_INVITE_HOSTS.has(u.hostname.toLowerCase())) return null;
    if (u.port || u.username || u.password || u.search || u.hash) return null;
    const path = u.pathname.replace(/\/+$/, "");
    if (!ALLOWED_INVITE_PATHS.has(path)) return null;
    return `https://${u.hostname.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return hex(new Uint8Array(d));
}

type SendResult = { kind: "sent"; id: string | null } | { kind: "rejected"; detail: string } | { kind: "unknown"; detail: string };

// Resend: 10 s Timeout, eine Wiederholung bei Timeout, Netzfehler, 429 oder 5xx.
// Der Idempotency-Key verhindert eine doppelte Mail, wenn der erste Versuch doch durchging.
async function sendMail(apiKey: string, idemKey: string, payload: Record<string, unknown>): Promise<SendResult> {
  let last = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idemKey,
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const txt = await r.text();
      clearTimeout(timer);
      if (r.ok) {
        let id: string | null = null;
        try { id = JSON.parse(txt)?.id ?? null; } catch { id = null; }
        return { kind: "sent", id };
      }
      last = `resend ${r.status} ${txt.slice(0, 300)}`;
      if (r.status === 429 || r.status >= 500) continue;
      // 409: gleicher Key mit anderem Inhalt oder noch in Arbeit -> Ausgang unklar
      if (r.status === 409) return { kind: "unknown", detail: last };
      return { kind: "rejected", detail: last };
    } catch (e) {
      clearTimeout(timer);
      last = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
  }
  return { kind: "unknown", detail: last };
}

function buildMail(teamNameRaw: string, inviteLink: string, logoUrl: string) {
  const teamName = cleanName(teamNameRaw || "") || "your team";
  const subject = `Join ${teamName} on upstreem`;
  const teamNameHtml = escapeHtml(teamName);
  const inviteLinkHtml = escapeHtml(inviteLink);
  const subjectHtml = escapeHtml(subject);
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="48" height="48" alt="upstreem" style="display:block;width:48px;height:48px;border:0;outline:none;text-decoration:none;" />`
    : "";
  const text = [
    `Join ${teamName} on upstreem`,
    "",
    `You have been invited to join the ${teamName} team on upstreem. Click the following link to accept the invite.`,
    "",
    inviteLink,
    "",
    "If you have any questions, please send us a mail to support@upstreem.ai.",
    "",
    "— Team upstreem",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${subjectHtml}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
<tr>
<td style="padding:48px 48px 40px 48px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td align="center" style="padding-bottom:28px;">
${logoHtml}
</td>
</tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td align="center" style="padding-bottom:32px;">
<h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;line-height:1.3;font-weight:400;">
Join <strong style="font-weight:700;">${teamNameHtml}</strong> on <strong style="font-weight:700;">upstreem</strong>
</h1>
</td>
</tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td style="padding-bottom:28px;">
<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">
You have been invited to join the <strong style="font-weight:700;">${teamNameHtml}</strong> team on <strong style="font-weight:700;">upstreem</strong>. Click the following button to accept the invite.
</p>
</td>
</tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td align="center" style="padding:8px 0 32px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" bgcolor="#000000" style="background-color:#000000;border-radius:10px;">
<a href="${inviteLinkHtml}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;">
Join the ${teamNameHtml} team
</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td style="padding-bottom:8px;">
<p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;">
Alternatively, copy and paste this URL into your browser:
</p>
<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;word-break:break-all;">
<a href="${inviteLinkHtml}" target="_blank" style="color:#4c9aff;text-decoration:none;">${inviteLinkHtml}</a>
</p>
</td>
</tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td style="padding:32px 0 24px 0;">
<div style="height:1px;line-height:1px;font-size:1px;background-color:#d0d0d0;opacity:0.3;">&nbsp;</div>
</td>
</tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td>
<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;opacity:0.65;">
If you have any questions, please send us a mail to
<a href="mailto:support@upstreem.ai" style="color:inherit;text-decoration:underline;">support@upstreem.ai</a>.
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
  return { subject, text, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "method_not_allowed");

  try {
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
    const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromEmail = (Deno.env.get("INVITE_FROM_EMAIL") ?? "").trim() || "upstreem <invites@send.upstreem.ai>";
    const logoUrl = (Deno.env.get("INVITE_LOGO_URL") ?? "").trim();
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendKey) return fail(500, "server_config_missing");

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return fail(401, "settings_not_authenticated");
    const jwt = authHeader.replace(/^bearer\s+/i, "").trim();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return fail(400, "team_invalid_param", { hint: "body" });
    const teamId = body.team_id;
    const inviteIdIn = body.invite_id ?? null;
    if (!isUuid(teamId)) return fail(400, "team_invalid_param", { hint: "team_id" });
    if (inviteIdIn !== null && inviteIdIn !== "" && !isUuid(inviteIdIn)) {
      return fail(400, "team_invalid_param", { hint: "invite_id" });
    }
    const mode: "create" | "resend" = isUuid(inviteIdIn) ? "resend" : "create";
    const email = typeof body.email === "string" ? body.email : "";
    const role = typeof body.role === "string" && body.role.trim() ? body.role : "member";
    if (mode === "create" && !email.trim()) return fail(400, "team_invalid_email");

    const baseUrl = allowedBaseUrl(body.base_url) ||
      allowedBaseUrl(Deno.env.get("INVITE_BASE_URL") ?? "") ||
      "https://app.upstreem.ai";

    const userDb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    }).schema("app");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminDb = admin.schema("app");

    // Nutzer fuer das Protokoll (die Rechte prueft die Datenbank ueber auth.uid())
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user?.id) return fail(401, "settings_not_authenticated");
    const actor = userData.user.id;

    // 1. Token
    const plain = hex(crypto.getRandomValues(new Uint8Array(32)));
    const hash = await sha256Hex(plain);

    // 2. Pruefen und anlegen bzw. erneut senden vorbereiten
    const rpc = mode === "create"
      ? await userDb.rpc("team_invite_create_v1", { p_team: teamId, p_email: email, p_role: role, p_token_hash: hash })
      : await userDb.rpc("team_invite_resend_v1", { p_team: teamId, p_invite_id: inviteIdIn, p_token_hash_next: hash });
    if (rpc.error) return dbFail(rpc.error);
    const meta = (rpc.data as any)?.meta ?? {};
    const row = (rpc.data as any)?.row ?? {};
    const inviteId: string | null = row.invite_id ?? null;
    if (!isUuid(inviteId)) return fail(500, "settings_failed");

    if (meta.unchanged === true) {
      return json({
        success: true,
        invite_id: inviteId,
        sent_at: row.sent_at ?? null,
        unchanged: true,
        send_state: row.send_state ?? null,
        resend_count: row.resend_count ?? 0,
        expires_at: row.expires_at ?? null,
      });
    }

    const toEmail = String(row.invited_email ?? "").trim().toLowerCase();
    const n = mode === "create" ? 0 : Number(row.resend_count ?? 0) + 1;
    const inviteLink = `${baseUrl.replace(/\/+$/, "")}/invite?token=${encodeURIComponent(plain)}`;
    const mail = buildMail(String(meta.team_name ?? ""), inviteLink, logoUrl);

    // 3. Versand
    const sent = await sendMail(resendKey, mode === "create" ? `invite-${inviteId}-create-0` : `invite-${inviteId}-resend-${n}-${hash.slice(0, 12)}`, {
      from: fromEmail,
      to: [toEmail],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    // 4. Ergebnis festhalten
    if (sent.kind === "sent") {
      let marked = await adminDb.rpc("_team_invite_mark_sent_v1", { p_invite_id: inviteId, p_kind: mode, p_actor: actor });
      if (marked.error) {
        marked = await adminDb.rpc("_team_invite_mark_sent_v1", { p_invite_id: inviteId, p_kind: mode, p_actor: actor });
      }
      if (marked.error) {
        // Mail ist raus, nur der Vermerk fehlt. Link gilt (neu: token_hash, erneut: token_hash_next).
        console.error("team-invite-send: mark_sent failed", inviteId, marked.error.message);
        return json({
          success: true, invite_id: inviteId, sent_at: null, unchanged: false,
          send_state: "unknown", resend_count: row.resend_count ?? 0, expires_at: row.expires_at ?? null,
        });
      }
      const r2 = (marked.data as any)?.row ?? {};
      return json({
        success: true,
        invite_id: inviteId,
        sent_at: r2.last_sent_at ?? r2.sent_at ?? null,
        unchanged: false,
        send_state: r2.send_state ?? "sent",
        resend_count: r2.resend_count ?? 0,
        expires_at: r2.expires_at ?? null,
      });
    }

    if (sent.kind === "rejected") {
      console.error("team-invite-send: rejected", inviteId, sent.detail);
      const f = await adminDb.rpc("_team_invite_send_failed_v1", {
        p_invite_id: inviteId, p_kind: mode, p_error: sent.detail, p_actor: actor,
      });
      if (f.error) console.error("team-invite-send: send_failed store failed", inviteId, f.error.message);
      return json({
        success: false,
        error: "team_invite_send_failed",
        message: "team_invite_send_failed",
        code: null,
        hint: mode,
        invite_id: inviteId,
      }, 502);
    }

    console.error("team-invite-send: unknown", inviteId, sent.detail);
    return json({
      success: false,
      error: "team_invite_send_unknown",
      message: "team_invite_send_unknown",
      code: null,
      hint: mode,
      invite_id: inviteId,
    }, 502);
  } catch (e) {
    console.error("team-invite-send failed", e instanceof Error ? e.message : e);
    return fail(500, "settings_failed");
  }
});
