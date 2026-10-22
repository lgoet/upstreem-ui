/* upstreem page-audit-data.js -- der Datenteil der Seite Page Audit (21.10.), OHNE DOM.

   Gleiche Bauart wie teams-data.js und citations-data.js: Anfragen, Umformung und die Texte, die
   aus Schluesseln der Datenbank entstehen. Geht so mit, wenn die Seite einmal eine Next-Route wird.
   Vertrag: bubble/page_audit_21_10/sql/02_rpcs_v1.sql (Namen, Parameter, Antwortform, Fehler mit
   hint/detail). Die Datenbank liefert Schluessel (assessment, family, check_key, metric_key,
   missing_reason ...), nie Saetze -- die Saetze stehen hier, damit sich ein Text aendern kann, ohne
   dass ein Lauf seine Bedeutung aendert (HANDOFF 12: "Translations and explanation copy can change
   without changing the stable finding key").

   Ehrlichkeit (HANDOFF 3, Plan 2): kein Score, "not verified" ist nie bestanden, eine fehlende
   Messung ist nie "resolved". Jeder Zustand hier hat darum einen eigenen Text; nichts faellt still
   auf "Passed" zurueck.

   Exportiert als window.UpstreemPageAuditDaten. */
(function () {
  "use strict";
  if (window.UpstreemPageAuditDaten) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function obj(v) { return v && typeof v === "object" && !isArr(v) ? v : null; }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function bool(v) { return v === true || v === "true" || v === "yes"; }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function uuidOk(v) { return UUID.test(str(v)); }

  var FN = {
    liste: "list_page_audits_v1",
    detail: "get_page_audit_v1",
    anlegen: "create_page_audit_v1",
    plan: "set_page_audit_schedule_v1",
    abbrechen: "cancel_page_audit_v1",
    loeschen: "delete_page_audit_v1",
    /* Datei 5 (21.10.): Status und Schritt laufender Audits, 1 bis 50 Laeufe je Aufruf. */
    fortschritt: "get_page_audit_progress_v1"
  };
  /* Die Sortierschluessel des Vertrags (list_page_audits_v1 prueft genau diese). */
  var SORTIERUNG = ["last_run", "url", "reachable", "issues", "status", "schedule", "next_run"];
  var LIMIT_MAX = 100;

  /* ---- Anfragen ------------------------------------------------------------------------------ */
  function liste(team, o) {
    o = o || {};
    var sort = SORTIERUNG.indexOf(o.sort) >= 0 ? o.sort : "last_run";
    var p = {
      p_team: str(team), p_query: str(o.query).trim().slice(0, 200) || null, p_sort: sort,
      p_dir: o.dir === "asc" ? "asc" : "desc",
      p_limit: Math.max(1, Math.min(LIMIT_MAX, Math.round(num(o.limit) || 15))),
      p_offset: Math.max(0, Math.round(num(o.offset) || 0))
    };
    return { art: "liste", fn: FN.liste, params: p, sig: FN.liste + "|" + JSON.stringify(p) };
  }
  function detail(team, pageId, runId) {
    var p = { p_team: str(team), p_page_id: str(pageId), p_run_id: uuidOk(runId) ? str(runId) : null };
    return { art: "detail", fn: FN.detail, params: p, sig: FN.detail + "|" + JSON.stringify(p) };
  }
  /* Ein Schluessel JE ABSENDEN (Vertrag: p_idempotency_key): ein doppelter Klick oder ein
     wiederholter Aufruf nach einem Netzfehler bekommt dieselbe Quittung statt eines zweiten
     Laufs. Der Aufrufer behaelt den Schluessel, bis die Eingabe sich aendert. */
  function schluessel() {
    try { if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID(); } catch (e) {}
    var b = new Uint8Array(16);
    try { window.crypto.getRandomValues(b); } catch (e) { for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = [].map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  /* ---- Antworten ----------------------------------------------------------------------------- */
  function zuQuota(q) {
    q = obj(q);
    if (!q) return null;
    var a = num(q.allowance), u = num(q.used);
    if (a == null || u == null) return null;
    return { allowance: a, used: u, remaining: num(q.remaining) != null ? num(q.remaining) : Math.max(0, a - u),
             trial: bool(q.trial), resetsAt: str(q.resets_at), weekStart: str(q.week_start) };
  }
  function zuKapazitaet(c) {
    c = obj(c);
    if (!c) return null;
    var k = num(c.capacity), u = num(c.used);
    if (k == null || u == null) return null;
    return { capacity: k, used: u };
  }
  function zuMeta(m) {
    m = obj(m) || {};
    return { total: num(m.total_count), limit: num(m.limit), offset: num(m.offset),
             quota: zuQuota(m.quota), capacity: zuKapazitaet(m.schedule_capacity), generatedAt: str(m.generated_at) };
  }
  /* { meta, rows } -- oder null, wenn die Form nicht stimmt (dann zeigt die Seite den Lesefehler,
     nie eine leere Liste). */
  function zuListe(d) {
    var o = obj(d);
    if (!o || !isArr(o.rows)) return null;
    var rows = o.rows.filter(obj).map(function (r) {
      var la = obj(r.latest), re = obj(r.result);
      return {
        id: str(r.page_id), url: str(r.url), fetchUrl: str(r.fetch_url) || str(r.url), host: str(r.host),
        title: str(r.title), favicon: str(r.favicon), schedule: str(r.schedule) || "once",
        nextRunAt: str(r.next_run_at), runCount: num(r.run_count), createdAt: str(r.created_at),
        latest: la ? { runId: str(la.run_id), status: str(la.status), trigger: str(la.trigger),
                       acceptedAt: str(la.accepted_at), finishedAt: str(la.finished_at) } : null,
        result: re ? {
          runId: str(re.run_id), finishedAt: str(re.finished_at), assessment: str(re.assessment),
          reachable: num(re.reachable_count), profiles: num(re.profile_count),
          restrictions: num(re.restriction_count), issues: num(re.issue_count),
          coverageRequired: num(re.coverage_required), coverageSatisfied: num(re.coverage_satisfied),
          httpStatus: num(re.http_status), previousReachable: num(re.previous_reachable_count),
          rulesChanged: bool(re.rules_changed)
        } : null
      };
    }).filter(function (r) { return uuidOk(r.id) && r.url; });
    return { meta: zuMeta(o.meta), rows: rows };
  }
  function zuLauf(r) {
    r = obj(r);
    if (!r || !uuidOk(r.run_id)) return null;
    return {
      id: str(r.run_id), status: str(r.status), trigger: str(r.trigger), acceptedAt: str(r.accepted_at),
      startedAt: str(r.started_at), finishedAt: str(r.finished_at), assessment: str(r.assessment),
      reachable: num(r.reachable_count), profiles: num(r.profile_count), restrictions: num(r.restriction_count),
      issues: num(r.issue_count), coverageRequired: num(r.coverage_required), coverageSatisfied: num(r.coverage_satisfied),
      httpStatus: num(r.http_status), rulesetVersion: str(r.ruleset_version), errorCode: str(r.error_code),
      cancelRequested: bool(r.cancel_requested),
      fetchUrl: str(r.fetch_url), finalUrl: str(r.final_url), locale: str(r.locale), durationMs: num(r.duration_ms),
      redirects: num(r.redirect_count), versions: obj(r.versions) || null
    };
  }
  function strListe(v) { return isArr(v) ? v.map(str).filter(Boolean) : []; }
  function zuBefund(f) {
    f = obj(f);
    if (!f) return null;
    return {
      id: str(f.finding_id), family: str(f.family), causeKey: str(f.cause_key), contribution: str(f.contribution),
      severity: str(f.severity), profiles: strListe(f.profiles), checkKeys: strListe(f.check_keys),
      details: obj(f.details) || {}, evidence: isArr(f.evidence) ? f.evidence.filter(obj) : [], change: str(f.change)
    };
  }
  /* Das Detail: { meta, page, runs, selected } -- selected ist null, wenn die Seite noch keinen
     Lauf hat. Fehlt page oder runs, ist die Antwort unlesbar. */
  function zuDetail(d) {
    var o = obj(d);
    if (!o || !obj(o.page) || !isArr(o.runs)) return null;
    var p = o.page;
    var page = { id: str(p.page_id), url: str(p.url), fetchUrl: str(p.fetch_url) || str(p.url), host: str(p.host),
                 title: str(p.title), favicon: str(p.favicon), schedule: str(p.schedule) || "once",
                 nextRunAt: str(p.next_run_at), runCount: num(p.run_count), createdAt: str(p.created_at) };
    if (!uuidOk(page.id) || !page.url) return null;
    var runs = o.runs.map(zuLauf).filter(Boolean);
    var s = obj(o.selected), sel = null;
    if (s) {
      var lauf = zuLauf(s.run);
      if (!lauf) return null;
      sel = {
        run: lauf, previousRunId: str(s.previous_run_id), rulesChanged: bool(s.rules_changed),
        profiles: (isArr(s.profiles) ? s.profiles : []).filter(obj).map(function (x) {
          return { id: str(x.profile_id), assessment: str(x.assessment), reachable: x.reachable === true,
                   previousReachable: x.previous_reachable === true ? true : (x.previous_reachable === false ? false : null),
                   coverageRequired: num(x.coverage_required), coverageSatisfied: num(x.coverage_satisfied),
                   restrictions: num(x.restriction_count), issues: num(x.issue_count) };
        }),
        checks: (isArr(s.checks) ? s.checks : []).filter(obj).map(function (c) {
          return { key: str(c.check_key), version: str(c.check_version), state: str(c.state), severity: str(c.severity),
                   reason: str(c.reason_code), details: obj(c.details) || {}, previousState: str(c.previous_state),
                   rulesChanged: bool(c.rules_changed) };
        }),
        findings: (isArr(s.findings) ? s.findings : []).map(zuBefund).filter(Boolean),
        previousFindings: (isArr(s.previous_findings) ? s.previous_findings : []).map(zuBefund).filter(Boolean),
        metrics: (isArr(s.metrics) ? s.metrics : []).filter(obj).map(function (m) {
          return { key: str(m.metric_key), version: str(m.metric_version), unit: str(m.unit), value: num(m.value),
                   text: str(m.value_text), numerator: num(m.numerator), denominator: num(m.denominator),
                   missing: str(m.missing_reason), previous: num(m.previous_value), comparable: m.comparable === true };
        }),
        observations: (isArr(s.observations) ? s.observations : []).filter(obj).map(function (b) {
          var a = obj(b.artifact);
          return { id: str(b.observation_id), slot: str(b.slot), kind: str(b.kind), outcome: str(b.outcome),
                   missing: str(b.missing_reason), requestUrl: str(b.request_url), userAgent: str(b.user_agent),
                   acceptLanguage: str(b.accept_language), synthetic: b.synthetic_ua === true, status: num(b.http_status),
                   finalUrl: str(b.final_url), contentType: str(b.content_type), bytes: num(b.body_bytes),
                   durationMs: num(b.duration_ms), capturedAt: str(b.captured_at), payload: obj(b.payload) || {},
                   artifact: a ? { state: str(a.state), bytes: num(a.bytes), expiresAt: str(a.expires_at) } : null };
        })
      };
    }
    return { meta: zuMeta(o.meta), page: page, runs: runs, selected: sel };
  }
  /* Die Quittung von create_page_audit_v1. */
  function zuQuittung(d) {
    var o = obj(d), r = o && obj(o.run);
    if (!r || !uuidOk(r.page_id)) return null;
    return { runId: str(r.id), pageId: str(r.page_id), url: str(r.url), status: str(r.status),
             deduplicated: bool(o.deduplicated), replayed: bool(o.replayed), quota: zuQuota(o.quota) };
  }
  /* Laeuft ein Lauf noch? Nur diese zwei Zustaende sind nicht endgueltig (01_tabellen: Trigger). */
  function laeuft(status) { return status === "queued" || status === "running"; }

  /* ---- Die sieben Profile (Plan 2: alle 7 je Lauf) -------------------------------------------
     name: wie die Seite es nennt; token: der robots-Name, unter dem geprueft wird (HANDOFF 6);
     modelle: Schluessel der Modelle der App, an denen "vom Team getrackt" erkannt wird (Plan 2:
     "zuerst die Modelle, die das Team trackt"); domain: fuer das Zeichen, wenn das Team das Modell
     nicht trackt (dann gibt es im Modell-Store kein Logo). ohneUa: Google-Extended hat keinen
     eigenen Abruf -- nie einen erfinden (HANDOFF 6). */
  var PROFILE = [
    { id: "chatgpt_search", name: "ChatGPT Search", token: "OAI-SearchBot", modelle: ["chatgpt", "openai", "searchgpt", "gpt"], domain: "chatgpt.com" },
    { id: "google_ai_overviews", name: "Google AI Overviews", token: "Googlebot", modelle: ["google-aio", "google-ai-overviews", "aio"], domain: "google.com" },
    { id: "google_ai_mode", name: "Google AI Mode", token: "Googlebot", modelle: ["google-ai-mode", "ai-mode", "google-aimode"], domain: "google.com" },
    { id: "gemini_apps_grounding", name: "Gemini", token: "Google-Extended", modelle: ["gemini"], domain: "gemini.google.com", ohneUa: true },
    { id: "perplexity_search", name: "Perplexity", token: "PerplexityBot", modelle: ["perplexity"], domain: "perplexity.ai" },
    { id: "claude_search", name: "Claude", token: "Claude-SearchBot", modelle: ["claude", "anthropic"], domain: "claude.ai" },
    { id: "bing_copilot_grounding", name: "Copilot and Bing", token: "bingbot", modelle: ["copilot", "bing", "microsoft-copilot"], domain: "copilot.microsoft.com" }
  ];
  var PROFIL = {};
  PROFILE.forEach(function (p) { PROFIL[p.id] = p; });
  function profil(id) { return PROFIL[id] || { id: id, name: id, token: "", modelle: [], domain: "" }; }
  function modellPasst(p, schluessel) {
    var k = str(schluessel).toLowerCase().replace(/[_\s]+/g, "-");
    return !!k && p.modelle.some(function (m) { return k === m || k.indexOf(m + "-") === 0; });
  }

  /* ---- Ergebnis eines Laufs (assessment, 4 Stufen, HANDOFF 3) und Status ---------------------- */
  var ERGEBNIS = {
    restriction_detected: { text: "Restriction detected", zeichen: "ban", ton: "neg" },
    potential_issue: { text: "Potential issue", zeichen: "alertCircle", ton: "warn" },
    no_tested_obstacle: { text: "No obstacle found", zeichen: "checkCircle", ton: "pos" },
    inconclusive: { text: "Inconclusive", zeichen: "helpCircle", ton: "leise" }
  };
  /* Status eines Laufs und die Fehlersaetze teilt sich die Seite mit Impact: sie stehen in core
     (UC.pageAuditStatus, UC.pageAuditFehlerSatz, UC.pageAuditDauerText), hier nur der Verweis -- eine Quelle.
     core laedt vor jeder Ansicht; fehlt es doch, zeigen die Zellen "–" statt eines geratenen Worts. */
  var UCK = window.UpstreemCore || {};
  var STATUS = UCK.pageAuditStatus || {};
  var PLAN = { once: "Not Scheduled", weekly: "Weekly", monthly: "Monthly" };
  /* Warum ein Lauf ohne Ergebnis blieb (error_code). Nur bekannte Codes bekommen einen Satz; ein
     unbekannter faellt auf den allgemeinen, nie auf einen erfundenen Grund. */
  var LAUF_FEHLER = {
    cancelled_before_start: "This audit was cancelled before it started. It was not charged.",
    cancel_requested: "This audit was cancelled while it was running.",
    cancelled_worker_lost: "This audit was cancelled while it was running.",
    job_deadline_exceeded: "The audit took longer than 3 minutes and was stopped. It was not charged.",
    deadline_exceeded: "The audit took longer than 3 minutes and was stopped. It was not charged.",
    queue_timeout: "The audit waited too long in the queue and was stopped. It was not charged.",
    queue_expired: "The audit waited too long in the queue and was stopped. It was not charged.",
    team_access: "This audit could not run because your team has no active access. It was not charged.",
    worker_error: "Something went wrong on our side. It was not charged.",
    worker_lost: "Something went wrong on our side. It was not charged.",
    result_rejected: "Something went wrong on our side. It was not charged.",
    renderer_crash: "The browser check could not be completed. It was not charged.",
    service_failure: "Something went wrong on our side. It was not charged."
  };
  /* TEILLAEUFE (status partial, 21.10.): je error_code EIN Satz, ohne interne Namen. Ein Teillauf
     wird nie berechnet (Vertrag: partial gibt frei), und was fehlt, gilt nie als bestanden.
     target_ipv6_only: unser Pruefer kommt nur ueber IPv4 hinaus (Plan 18.2) -- das sagt nichts ueber
     die Seite. {x}/{n}: erfuellte und noetige Messungen. */
  var TEIL_GRUND = {
    scanner_own_policy_denial: "The site's robots.txt doesn't allow our audit crawler, so the page itself wasn't requested.",
    robots_policy_unresolved: "The site's robots.txt couldn't be read reliably, so the page itself wasn't requested.",
    politeness_budget_exceeded: "The site's robots.txt asks crawlers to wait longer between requests than an audit can, so the page itself wasn't requested.",
    target_ipv6_only: "This site can only be reached over IPv6, and our audit currently connects over IPv4 only. This says nothing about the page.",
    coverage_incomplete: "Some measurements could not be completed ({x} of {n})."
  };
  function teilSatz(code, x, n, t) {
    t = t || function (v) { return v; };
    var g = TEIL_GRUND[code] || TEIL_GRUND.coverage_incomplete;
    var satz = t(g);
    if (satz.indexOf("{x}") >= 0) satz = satz.replace("{x}", x == null ? "–" : String(x)).replace("{n}", n == null ? "–" : String(n));
    return satz + " " + t("This run wasn't charged, and nothing missing counts as passed.");
  }

  /* ---- Die 17 Checks (Plan 2, Paket-Katalog ohne E3) ------------------------------------------ */
  var CHECKS = [
    { key: "A1", name: "Transport", text: "DNS, TLS and the response to a normal request." },
    { key: "A2", name: "Redirect chain", text: "Every redirect up to the final address." },
    { key: "A3", name: "Response classification", text: "Whether the page is real content or a challenge, login or error page." },
    { key: "A4", name: "Request variants", text: "Responses for crawler user agents and languages." },
    { key: "B1", name: "Robots policy", text: "What robots.txt allows each search crawler on this path." },
    { key: "B2", name: "Robots availability", text: "Whether robots.txt could be read and interpreted." },
    { key: "C1", name: "Index directives", text: "noindex and similar rules in headers and HTML." },
    { key: "C2", name: "Preview directives", text: "nosnippet, max-snippet and Bing's grounding rules." },
    { key: "C3", name: "Directive changes", text: "Whether JavaScript changes the robots directives." },
    { key: "D1", name: "Initial content", text: "Readable main text in the initial HTML." },
    { key: "D2", name: "Rendered content", text: "Main text that only appears after JavaScript." },
    { key: "D3", name: "Interaction limits", text: "Overlays, paywalls and blocked resources without clicking." },
    { key: "E1", name: "URL and canonical", text: "Requested, final and canonical addresses." },
    { key: "E2", name: "Sitemap", text: "Whether the page is in your team's sitemap snapshot." },
    { key: "F1", name: "Language", text: "Declared languages and language variants." },
    { key: "F2", name: "Metadata and structure", text: "Title, description, headings and structured data." },
    { key: "F3", name: "Format and coverage", text: "Content type and which measurements were completed." }
  ];
  var CHECK = {};
  CHECKS.forEach(function (c) { CHECK[c.key] = c; });
  /* Zustand eines Checks. "unknown" heisst: die Messung fehlt -- nie "Passed" (HANDOFF 10). */
  var CHECK_ZUSTAND = {
    pass: { text: "Passed", zeichen: "checkCircle", ton: "pos" },
    finding: { text: "Finding", zeichen: "alertCircle", ton: "warn" },
    unknown: { text: "Not measured", zeichen: "helpCircle", ton: "leise" },
    not_applicable: { text: "Not applicable", zeichen: "minus", ton: "leise" },
    unsupported: { text: "Not supported", zeichen: "minus", ton: "leise" },
    error: { text: "Measurement error", zeichen: "alertCircle", ton: "leise" }
  };

  /* ---- Befunde (rules/finding_catalog.json, ohne E3) -------------------------------------------
     titel, satz, schritt; {token}, {path}, {status}, {source}, {platform} werden aus details
     gefuellt, wenn sie dort stehen (sonst die Fassung ohne Platzhalter: ohne). umfang sagt, was die
     Messung NICHT zeigt (HANDOFF 3, "uncertainty") -- je Art der Messung ein Satz.
     robots.search_path_disallowed traegt den Wortlaut aus paket/examples/robots_restriction.json. */
  var UMFANG = {
    policy: "This is the published policy. Visits by the real crawler and the provider's index were not observed.",
    request: "Measured with our own request from our servers. The real crawler may get a different response.",
    synthetic: "Tested with the crawler's user agent from our servers, not by the real crawler.",
    heuristic: "This is a heuristic. We don't click, sign in or solve challenges, so check the page yourself.",
    content: "Measured with our text extractor in one browser. AI crawlers may extract text differently."
  };
  var BEFUNDE = {
    "transport.dns_resolution_failed": { titel: "The domain could not be resolved", satz: "Our request could not resolve the page's host name.", schritt: "Check the DNS records of this host and that the domain is still active.", umfang: "request" },
    "transport.tls_validation_failed": { titel: "The secure connection failed", satz: "The TLS certificate or handshake could not be validated. We never skip this check.", schritt: "Check that the certificate is valid, not expired and covers this host name.", umfang: "request" },
    "transport.request_timeout": { titel: "The page did not respond in time", satz: "The request did not finish within 20 seconds.", schritt: "Check the response time of this page and whether it slows down unknown clients.", umfang: "request" },
    "http.authentication_required": { titel: "The page requires sign-in", satz: "The server answered with HTTP 401.", schritt: "If this page should be public, remove the sign-in requirement for it.", umfang: "request" },
    "http.access_denied": { titel: "Access was denied", satz: "The server answered our request with HTTP 403.", schritt: "Check firewall, bot protection and CDN rules for this page, and look for real crawler visits in your server logs.", umfang: "request" },
    "http.not_found": { titel: "The page was not found", satz: "The server answered with HTTP 404.", schritt: "Restore the page or redirect it to its replacement, and fix links to it.", umfang: "request" },
    "http.gone": { titel: "The page was removed", satz: "The server answered with HTTP 410, which means the page was removed permanently.", schritt: "If the page should exist, restore it or redirect it to its replacement.", umfang: "request" },
    "http.rate_limited": { titel: "The request was rate limited", satz: "The server kept answering with HTTP 429, also after a retry.", schritt: "Check the rate limits that apply to crawlers.", umfang: "request" },
    "http.server_error": { titel: "The server returned an error", satz: "The server kept answering with an error status, also after a retry.", schritt: "Check the server logs for this page.", umfang: "request" },
    "http.empty_representation": { titel: "The page returned no content", satz: "The response was successful but empty, so there was nothing to examine.", schritt: "Check that the page sends its content for a normal GET request.", umfang: "request" },
    "http.unexpected_status": { titel: "Unexpected response", satz: "The server returned a status without usable content.", schritt: "Check how the server answers a normal GET request for this page.", umfang: "request" },
    "redirect.loop": { titel: "Redirect loop", satz: "The redirects lead back to an address that was already visited.", schritt: "Fix the redirect rules so the chain ends at one page.", umfang: "request" },
    "redirect.unresolved": { titel: "The redirect chain does not end", satz: "A redirect had no usable target, or there were more than 5 redirects.", schritt: "Shorten the chain and let every redirect point to a valid address.", umfang: "request" },
    "redirect.unsafe_destination": { titel: "Redirect to a non-public address", satz: "A redirect points to an address that is not publicly reachable, so it was not followed.", schritt: "Point the redirect to the public address of the page.", umfang: "request" },
    "redirect.https_downgrade": { titel: "Redirect from HTTPS to HTTP", satz: "A secure address redirects to an insecure one.", schritt: "Redirect to the HTTPS address instead.", umfang: "request" },
    "response.suspected_challenge": { titel: "Possible bot challenge", satz: "The page looks like a bot challenge or captcha instead of its content.", schritt: "Check your bot protection for search crawlers. Keep it on if it is intended.", umfang: "heuristic" },
    "response.suspected_login_wall": { titel: "Possible login wall", satz: "The page shows a password field and no readable main content.", schritt: "If the content should be public, make it readable without signing in.", umfang: "heuristic" },
    "response.suspected_soft_404": { titel: "Possible soft 404", satz: "The page answers with HTTP 200 but looks like an error page.", schritt: "Return a real 404 for missing pages, or restore the content.", umfang: "heuristic" },
    "variants.ua_access_difference": { titel: "Different response for {token}", satz: "With the user agent of {token}, the page answered differently than for a normal request.", titelOhne: "Different response for a crawler user agent", satzOhne: "With a crawler's user agent, the page answered differently than for a normal request.", schritt: "Check CDN and bot rules for this user agent, and look for real crawler visits in your server logs.", umfang: "synthetic" },
    "variants.language_access_failure": { titel: "A language version failed", satz: "With a language preference, the request failed or was denied while the normal request worked.", schritt: "Check the language redirects of this page.", umfang: "request" },
    "robots.search_path_disallowed": { kurz: "The platform's search crawler is asked not to fetch this page.", warum: "The search crawler of a platform reads robots.txt before it fetches a page. A rule that excludes it keeps this page out of that platform's search, while training crawlers are a separate decision.",
      schritte: ["Find the rule shown above in your robots.txt.", "Allow {token} on this path if this page should appear in {platform}. Training crawlers can stay blocked.", "Run the audit again."],
      schritteOhne: ["Find the rule shown above in your robots.txt.", "Allow the search crawler on this path if this page should appear in AI search. Training crawlers can stay blocked.", "Run the audit again."], titel: "Published robots policy excludes {token}", satz: "The captured robots file excludes the requested {path} path for {token}. This is a public policy observation.", titelOhne: "robots.txt excludes a search crawler", satzOhne: "The captured robots file excludes the requested path for a search crawler. This is a public policy observation.", schritt: "Review the exact rule if this URL is intended for {platform} visibility. Keep training policy separate.", schrittOhne: "Review the exact rule if this URL should be visible in AI search. Keep training policy separate.", umfang: "policy" },
    "robots.grounding_policy_disallowed": { titel: "robots.txt excludes Google-Extended", satz: "The robots file excludes this path for Google-Extended, which controls use in Gemini answers. It does not affect Google Search.", schritt: "Review the rule if this page should be used in Gemini answers.", umfang: "policy" },
    "directives.noindex": { titel: "The page is marked noindex", satz: "A noindex directive was found in the {source}.", satzOhne: "A noindex directive was found.", schritt: "Remove noindex if this page should appear in AI search.", umfang: "policy" },
    "directives.expired": { titel: "The page has expired", satz: "An unavailable_after date in the past was found.", schritt: "Remove or update the date if the page should stay visible.", umfang: "policy" },
    "directives.nosnippet": { titel: "Text previews are disabled", satz: "nosnippet or max-snippet:0 keeps Google from showing text from this page, also in AI features.", schritt: "Remove the directive if text from this page should be shown.", umfang: "policy" },
    "directives.bing_preview_restriction": { titel: "Bing previews are limited", satz: "nosnippet or a max-snippet limit restricts Bing's text previews.", schritt: "Review the directive if you want fuller previews in Bing.", umfang: "policy" },
    "directives.snippet_cap": { titel: "Preview length is limited", satz: "A max-snippet limit allows only a short excerpt. This is a limit, not an exclusion.", schritt: "Review the limit if longer excerpts should be shown.", umfang: "policy" },
    "directives.bing_noarchive": { titel: "noarchive limits Copilot", satz: "Bing documents that noarchive keeps content out of Copilot and grounding answers.", schritt: "Remove noarchive if this page should be used in Copilot answers.", umfang: "policy" },
    "directives.bing_nocache": { titel: "nocache limits Copilot", satz: "Bing documents that nocache limits how the content is used in Copilot answers.", schritt: "Review nocache if this page should be fully used in Copilot answers.", umfang: "policy" },
    "directives.dynamic_conflict": { titel: "Directives change after rendering", satz: "The robots directives in the initial HTML differ from those after JavaScript ran.", schritt: "Serve the intended directives in the initial HTML.", umfang: "content" },
    /* Die drei JS-Familien nach den Formulierungsgrenzen des Berichts (UMSETZUNGSPLAN 14, verbindlich):
       nur was unser Browser gemessen hat, Zaehler und Nenner statt Prozent, keine Aussage ueber das, was
       eine Plattform "sieht", und keine ueber Zitierungen. Der Satz mit Zahlen entsteht in jsSatz. */
    "content.raw_main_empty": { titel: "No main text in the initial HTML", satz: "The main content area of the initial HTML is empty. Systems that read only the initial HTML do not receive main text from this page.", schritt: "Make the main text available in the initial HTML (server-side rendering, static generation or pre-rendering), then run the audit again.", umfang: "content" },
    "content.raw_empty_rendered_present": { titel: "The main text only appears after JavaScript", kurz: "Systems that read only this HTML get a page without its main text.",
      warum: "Several AI platforms have been seen fetching pages without running JavaScript when they answer a question. For them, this page has no main text. The list below shows which platforms and how sure that is.",
      schritte: ["Send the main text in the HTML from your server, with server-side rendering, static generation or pre-rendering.", "Check it with View Source in your browser: the text should be there before any script runs.", "Run the audit again."], satz: "The main content area is empty in the initial HTML. Our browser filled it after running JavaScript (Chromium, up to 10 seconds, no interaction). Systems that read only the initial HTML do not receive this text.", schritt: "Make the main text available in the initial HTML (server-side rendering, static generation or pre-rendering), then run the audit again.", umfang: "content" },
    "content.rendered_text_difference": { titel: "Some of the page text is added by JavaScript", kurz: "Systems that read only this HTML get less text than your visitors.",
      warum: "Several AI platforms have been seen fetching pages without running JavaScript when they answer a question. For them, this page is shorter than what your visitors read. The list below shows which platforms and how sure that is.",
      schritte: ["Send the main text in the HTML from your server, with server-side rendering, static generation or pre-rendering.", "Check it with View Source in your browser: the text should be there before any script runs.", "Run the audit again."], satz: "Part of the text is missing from the initial HTML. Our browser added it after running JavaScript (Chromium, up to 10 seconds, no interaction). Systems that read only the initial HTML do not receive this text.", schritt: "Make the main text available in the initial HTML (server-side rendering, static generation or pre-rendering), then run the audit again.", umfang: "content" },
    "interaction.suspected_gate": { titel: "Possible overlay or paywall", satz: "An overlay or paywall may hide the main content when the page is opened without interaction.", schritt: "Open the page without cookies and check what is visible without clicking.", umfang: "heuristic" },
    "canonical.conflicting": { titel: "Conflicting canonical tags", satz: "The page declares more than one canonical address.", schritt: "Declare one canonical address.", umfang: "request" },
    "canonical.invalid": { titel: "Invalid canonical tag", satz: "The declared canonical address can't be resolved.", schritt: "Fix the canonical URL.", umfang: "request" },
    "language.declaration_conflict": { titel: "Conflicting language signals", satz: "The declared languages (lang, Content-Language, hreflang) contradict each other.", schritt: "Align the language declarations.", umfang: "request" }
  };
  /* Platzhalter aus details: nur einfache Texte bis 200 Zeichen, nie Objekte -- und nie ein
     Platzhalter, der stehen bleibt. Fehlt ein Wert, nimmt der Text seine Fassung ohne. */
  var QUELLE = { header: "X-Robots-Tag header", meta: "robots meta tag", html: "robots meta tag", rendered: "rendered page" };
  function fuellen(muster, ohne, w) {
    if (!muster) return "";
    var fehlt = false;
    var aus = muster.replace(/\{([a-z]+)\}/g, function (_, k) {
      var v = str(w[k]).trim();
      if (!v || v.length > 200) { fehlt = true; return ""; }
      return v;
    });
    return fehlt ? (ohne || muster.replace(/\s*\{[a-z]+\}\s*/g, " ").replace(/\s+/g, " ").trim()) : aus;
  }
  function befundText(f) {
    var b = BEFUNDE[f.family], d = f.details || {};
    var platform = "";
    if (f.profiles && f.profiles.length === 1) platform = profil(f.profiles[0]).name;
    var w = { token: str(d.token || d.user_agent_token), path: str(d.path), status: str(d.http_status || d.status),
              source: QUELLE[str(d.source)] || "", platform: platform };
    if (!b) {
      /* Eine Befundart, die diese Fassung nicht kennt (neueres Regelwerk): ehrlich als solche, mit
         dem Schluessel des Checks -- nie geraten, was sie bedeutet. */
      return { titel: "Finding", satz: "This finding comes from a newer version of the rules.", schritt: "", umfang: "" };
    }
    var schritte = (b.schritte || []).map(function (x, i) { return fuellen(x, (b.schritteOhne || [])[i], w); });
    return { titel: fuellen(b.titel, b.titelOhne, w), satz: fuellen(b.satz, b.satzOhne, w), warum: b.warum || "", kurz: b.kurz || "",
             schritt: fuellen(b.schritt, b.schrittOhne, w), schritte: schritte, umfang: UMFANG[b.umfang] || "" };
  }
  /* Was in details als Beleg lesbar ist: wenige bekannte Schluessel, als Paar Etikett + Wert. Alles
     andere bleibt in der Datenbank (Keine Entwicklertexte im UI). */
  var DETAIL_FELDER = [
    ["rule", "Rule"], ["path", "Path"], ["token", "Crawler"], ["robots_url", "robots.txt"], ["http_status", "HTTP status"],
    ["directive", "Directive"], ["location", "Redirect target"], ["canonical", "Canonical"], ["header", "Header"]
  ];
  function befundFelder(f) {
    var d = f.details || {}, aus = [];
    DETAIL_FELDER.forEach(function (x) {
      var v = d[x[0]];
      if (v == null || typeof v === "object") return;
      v = String(v).trim();
      if (v && v.length <= 500) aus.push({ label: x[1], wert: v });
    });
    return aus;
  }
  /* Belegauszuege (je hoechstens 500 Zeichen, Plan 2). Seiteninhalt -- also nur als Text, die Seite
     setzt ihn escaped in ein pre (HANDOFF 17, Sicherheitspruefung 17). Der Worker schreibt
     { art, text } (bewertung.ts, 21.10.: art rendered_only_excerpt = nur gerendert vorhanden), das
     Paket { excerpt }; beides wird gelesen. art bestimmt die Ueberschrift ueber dem Auszug. */
  var BELEG_ART = { rendered_only_excerpt: "Added by JavaScript, for example" };
  function belege(f) {
    return (f.evidence || []).map(function (e) {
      var x = str(e.text || e.excerpt);
      return x ? { text: x.slice(0, 500), art: str(e.art), titel: BELEG_ART[str(e.art)] || "", notiz: str(e.note).slice(0, 200) } : null;
    }).filter(Boolean);
  }
  /* Der Zahlensatz der JS-Befunde: "{x} of {n} characters of the main text are in the initial HTML."
     Zaehler und Nenner aus details (numerator, denominator) -- nie ein Prozent (Formulierungsgrenzen).
     Hat der Worker ueber den ganzen Body verglichen (gerendert_strategie body: das main war gerendert
     versteckt, Plan 16.3), heisst es "of the page text". Ohne beide Zahlen: kein Satz. */
  function jsSatz(f, fmt) {
    var d = f.details || {}, x = num(d.numerator), n = num(d.denominator);
    if (x == null || n == null || n <= 0) return "";
    fmt = fmt || function (v) { return String(v); };
    var was = str(d.gerendert_strategie) === "body" ? "of the page text" : "of the main text";
    return fmt(x) + " of " + fmt(n) + " characters " + was + " are in the initial HTML.";
  }
  var SCHWERE = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
  var SCHWERE_RANG = { critical: 0, high: 1, medium: 2, low: 3 };
  /* impact_basis je Profil (finding.details.profile_impacts, UMSETZUNGSPLAN 14): wie belastbar die
     WIRKUNG ist, nicht wie schwer. Nie "documented" fuer JS (dort nur conditional/unverified). */
  var WIRKUNG = {
    documented: { text: "Documented", tip: "The platform documents this behavior." },
    conditional: { text: "Conditional", tip: "Conditional: applies when the platform fetches the page itself." },
    unverified: { text: "Unverified", tip: "Unverified: no published test has measured it for this platform yet." }
  };
  /* Die Wirkung eines Befunds fuer ein Profil: { basis, effect } oder null. effect ist ein datierter
     Satz aus der Registry des Workers -- fremder Text, nur escaped zeigen. */
  function wirkung(f, profilId) {
    var l = isArr((f.details || {}).profile_impacts) ? f.details.profile_impacts : [];
    for (var i = 0; i < l.length; i++) {
      var x = obj(l[i]);
      if (x && str(x.profile_id) === profilId) return { basis: WIRKUNG[str(x.impact_basis)] ? str(x.impact_basis) : "", effect: str(x.effect).slice(0, 500) };
    }
    return null;
  }
  /* Der kurze Satz je Plattform und Wirkung (v2, Lukas: "Erklaerungen besser, nicht in jeder Quellen"). Zusammengefasst
     aus den datierten effect-Saetzen der Registry (UMSETZUNGSPLAN 14); der datierte Satz selbst steht im Tooltip des
     Etiketts. Grenzen wie dort: beobachtetes Verhalten, kein "cannot see", keine Zitierfolge. */
  var WIRKUNG_KURZ = {
    chatgpt_search: "When ChatGPT opens this page to answer a question, it has been seen reading only the initial HTML.",
    claude_search: "When Claude opens this page, it has been seen reading only the initial HTML.",
    perplexity_search: "When Perplexity opens this page to answer a question, it has been seen reading only the initial HTML.",
    gemini_apps_grounding: "Gemini answers from Google's index. Pages that aren't indexed yet have been seen read as initial HTML only.",
    google_ai_overviews: "AI Overviews use Google's index, which is built after rendering. Text can be missing until Google has rendered the page.",
    google_ai_mode: "AI Mode uses Google's index. In one test, text added by JavaScript showed up only after the page was indexed.",
    bing_copilot_grounding: "Copilot answers from the Bing index. Tests show mixed results for text added by JavaScript."
  };
  function wirkungKurz(pid, basis) {
    return WIRKUNG_KURZ[pid] || (WIRKUNG[basis] ? WIRKUNG[basis].tip : "");
  }
  /* Sperrt der Haupttext die Aussage "Reachable"? Nach dem Bericht (Abschnitt "Reachable bleibt eine
     Aussage ueber Zugang") darf "Reachable for x of 7" dann nicht allein stehen. */
  function haupttextFehlt(findings) {
    return (findings || []).some(function (f) {
      return f.family === "content.raw_empty_rendered_present" || (f.family === "content.rendered_text_difference" && (f.severity === "high" || f.severity === "critical"));
    });
  }

  /* ---- Veraenderung zum vorigen Lauf (get_page_audit_v1, Feld change) --------------------------
     resolved gibt es nur in previous_findings, und nur wenn alle beteiligten Checks jetzt mit
     derselben Regel wirklich gemessen sind -- das entscheidet die Datenbank, hier steht der Text. */
  var AENDERUNG = {
    first_run: { text: "First run", tip: "There is no earlier result to compare with.", ton: "leise" },
    persistent: { text: "Persistent", tip: "This was already found in the previous run.", ton: "leise" },
    "new": { text: "New", tip: "Not found in the previous run, which checked the same way.", ton: "neg" },
    rules_changed: { text: "Rules updated", tip: "The rules for this check changed since the previous run, so it is not compared.", ton: "leise" },
    not_comparable: { text: "Not comparable", tip: "This could not be measured in the other run, so it is not compared.", ton: "leise" },
    resolved: { text: "Resolved", tip: "Found in the previous run and measured again with the same rules, without this finding.", ton: "pos" }
  };

  /* ---- Messwerte (rules/metric_catalog.json) ---------------------------------------------------- */
  var METRIKEN = {
    http_status: "HTTP status", response_bytes: "Response size", redirect_count: "Redirects",
    request_duration: "Response time", robots_parse_bytes: "robots.txt size",
    initial_main_characters: "Main text in the initial HTML", rendered_main_characters: "Main text after rendering",
    matched_rendered_characters: "Rendered text found in the initial HTML", raw_retention_ratio: "Rendered text in the initial HTML",
    added_text_blocks: "Text blocks added by JavaScript", removed_text_blocks: "Text blocks removed by JavaScript",
    nosnippet_covered_characters: "Text excluded by data-nosnippet", required_slots: "Required measurements",
    satisfied_slots: "Completed measurements", coverage_ratio: "Coverage"
  };
  var METRIK_REIHE = Object.keys(METRIKEN);
  var FEHLT = {
    not_applicable: "Not applicable", not_requested: "Not requested", unsupported: "Not supported for this format",
    blocked: "Blocked", timeout: "Timed out", truncated: "Truncated", parse_error: "Could not be parsed",
    upstream_unavailable: "Not available", zero_denominator: "Nothing to compare", measurement_error: "Measurement failed",
    artifact_expired: "Raw data expired"
  };

  /* ---- Beobachtungen (Einzelabrufe) -------------------------------------------------------------- */
  function slotName(slot) {
    var s = str(slot);
    var m;
    if ((m = /^robots\.(.+)$/.exec(s))) {
      var h = m[1];
      try { h = new URL(m[1]).host; } catch (e) {}
      return { name: "robots.txt", zusatz: h };
    }
    if ((m = /^variant\.ua\.(.+)$/.exec(s))) return { name: "User agent", zusatz: m[1] };
    if ((m = /^variant\.language\.(.+)$/.exec(s))) return { name: "Language", zusatz: m[1] };
    var fest = {
      baseline: "Page request", browser: "Browser", screenshot: "Screenshot", "extraction.raw": "Text, initial HTML", "extraction.rendered": "Text, rendered page",
      "baseline.transport": "Page request", "baseline.body": "Page content", "browser.navigation": "Browser navigation",
      "browser.initial_body": "Browser, initial HTML", "browser.rendered_dom": "Browser, rendered page",
      "extraction.baseline": "Text, initial HTML", "extraction.browser_initial": "Text, browser initial HTML",
      "extraction.browser_rendered": "Text, rendered page"
    };
    return { name: fest[s] || s, zusatz: "" };
  }
  var ERGEBNIS_BEOBACHTUNG = { observed: "Observed", measurement_error: "Measurement failed", unsupported: "Not supported",
                               not_applicable: "Not applicable", missing: "Missing" };

  /* ---- Rolle je Crawler (v2): Suche, Abruf auf Anfrage, Training -------------------------------
     Nach den Seiten der Anbieter (OpenAI, Anthropic, Perplexity, Google, Microsoft). Gehoert in die
     Plattform-Registry des Workers; bis die sie mitliefert, steht sie hier. Ohne Eintrag: keine Rolle. */
  var CRAWLER_ROLLE = {
    "OAI-SearchBot": "search", "GPTBot": "training", "ChatGPT-User": "user requests",
    "Claude-SearchBot": "search", "ClaudeBot": "training", "Claude-User": "user requests",
    "PerplexityBot": "search", "Perplexity-User": "user requests",
    "Googlebot": "search", "Google-Extended": "Gemini answers and training", "bingbot": "search"
  };

  /* ---- Checks als Zielzustand (v2): Name im Gutfall, Name im Befund, Bereich und ein Messwert aus
     details. details ist heute Worker-intern (Vertragswunsch: Form festschreiben); fehlt ein Feld,
     steht kein Wert -- nie ein geratener. */
  var CHECK_BEREICH = [
    { id: "zugang", name: "Access", keys: ["A1", "A2", "A3", "A4"] },
    { id: "robots", name: "robots.txt", keys: ["B1", "B2"] },
    { id: "direktiven", name: "Directives", keys: ["C1", "C2", "C3"] },
    { id: "inhalt", name: "Text and rendering", keys: ["D1", "D2", "D3"] },
    { id: "meta", name: "Address, language and metadata", keys: ["E1", "E2", "F1", "F2", "F3"] }
  ];
  var CHECK_ZIEL = {
    A1: { ok: "The page loads for a normal request", nein: "The page didn't load for a normal request" },
    A2: { ok: "Redirects end at this page", nein: "The redirects don't end at a usable page" },
    A3: { ok: "The page shows content, not a challenge or login", nein: "The page may be a challenge, login or error page" },
    A4: { ok: "Crawlers and languages get the same page", nein: "A crawler or language gets a different response" },
    B1: { ok: "robots.txt allows every search crawler", nein: "robots.txt excludes a search crawler" },
    B2: { ok: "robots.txt could be read", nein: "robots.txt couldn't be read" },
    C1: { ok: "No noindex", nein: "The page is marked noindex" },
    C2: { ok: "Text previews are allowed", nein: "Text previews are limited" },
    C3: { ok: "JavaScript doesn't change the directives", nein: "JavaScript changes the directives" },
    D1: { ok: "The initial HTML has readable main text", nein: "The initial HTML has no readable main text" },
    D2: { ok: "No text depends on JavaScript", nein: "Some of the page text needs JavaScript" },
    D3: { ok: "Nothing covers the content without clicks", nein: "Something may cover the content" },
    E1: { ok: "The canonical address is this page", nein: "The canonical address is unclear" },
    E2: { ok: "The page is in your sitemap", nein: "The page is missing from your sitemap" },
    F1: { ok: "The language is declared", nein: "The language signals disagree" },
    F2: { ok: "Title, description and structured data are present", nein: "Title, description or structured data are missing" },
    F3: { ok: "All measurements were completed", nein: "Some measurements are missing" }
  };
  function checkWert(key, d, fmt) {
    d = obj(d) || {};
    fmt = fmt || function (v) { return String(v); };
    var n, m, l;
    switch (key) {
      case "A1": return num(d.status) != null ? "HTTP " + d.status + (num(d.ms) != null ? " in " + fmt(Math.round(d.ms)) + " ms" : "") : "";
      case "A2": n = num(d.weiterleitungen); return n == null ? "" : n === 0 ? "No redirects" : fmt(n) + (n === 1 ? " redirect" : " redirects") + (d.andere_domain ? ", to another domain" : "");
      case "A3": return isArr(d.treffer) ? (d.treffer.length ? str(d.treffer.map(str).join(", ")).slice(0, 120) : "Nothing detected") : "";
      case "A4": l = isArr(d.varianten) ? d.varianten : []; if (!l.length) return "";
        n = l.filter(function (v) { return v && v.gleicher_body === true && v.gleicher_status === true; }).length;
        return "Same response for " + fmt(n) + " of " + fmt(l.length) + " requests";
      case "B1": m = obj(d.profile) || {}; l = Object.keys(m); if (!l.length) return "";
        n = l.filter(function (k) { var e = ((m[k] || {}).ergebnisse || [])[0]; return e && e.entscheidung === "allowed"; }).length;
        return fmt(n) + " of " + fmt(l.length) + " platforms allowed";
      case "B2": l = isArr(d.dateien) ? d.dateien : []; if (!l.length) return "";
        return "HTTP " + str(l[0].status) + (num(l[0].sitemaps) ? ", " + fmt(l[0].sitemaps) + (l[0].sitemaps === 1 ? " sitemap listed" : " sitemaps listed") : "");
      case "C1": m = obj(d.profile) || {}; return Object.keys(m).length ? "Checked for Google and Bing" : "";
      case "C2": return obj(d.profile) ? "No nosnippet, max-snippet or data-nosnippet" : "";
      case "C3": return isArr(d.roh) && isArr(d.gerendert) ? (d.roh.length || d.gerendert.length ? "Different before and after rendering" : "Same before and after rendering") : "";
      case "D1": n = num(d.zeichen); m = obj(d.anzahl) || {};
        return n == null ? "" : fmt(n) + " characters" + (num(m.article) ? " in " + fmt(m.article) + " article " + (m.article === 1 ? "element" : "elements") : num(m.main) ? " in the main element" : "");
      case "D2": return num(d.numerator) != null && num(d.denominator) ? fmt(d.numerator) + " of " + fmt(d.denominator) + " characters in the initial HTML" : "";
      case "D3": return isArr(d.ueberlagerungen) ? (d.ueberlagerungen.length || num(d.passwortfelder) ? "Overlay or password field found" : "No overlays, paywalls or password fields") : "";
      case "E1": l = (isArr(d.html) && d.html.length ? d.html : isArr(d.gerendert) ? d.gerendert : []);
        return l.length && obj(l[0]) && str(l[0].aufgeloest) ? "Canonical " + str(l[0].aufgeloest).slice(0, 120) : (isArr(d.html) ? "No canonical tag" : "");
      case "F1": return str(d.html_lang) ? str(d.html_lang) + (num(d.hreflang) ? ", " + fmt(d.hreflang) + " hreflang variants" : "") : "";
      case "F2": m = obj(d.jsonld) || {}; l = [];
        if (str(d.titel)) l.push("title"); if (d.beschreibung) l.push("description"); if (d.h1_roh) l.push("H1");
        if (num(m.bloecke)) l.push(fmt(m.bloecke) + " JSON-LD " + (m.bloecke === 1 ? "block" : "blocks"));
        return l.length ? l.join(", ").replace(/^./, function (c) { return c.toUpperCase(); }) : "";
      case "F3": return num(d.required) != null ? fmt(d.satisfied) + " of " + fmt(d.required) + " measurements" : "";
    }
    return "";
  }

  /* ---- Fortschritt (get_page_audit_progress_v1, Datei 5) ------------------------------------------
     phase nur bei running und nur fuer den laufenden Versuch. Unbekannte Werte werden nicht geraten:
     ein Schritt, den diese Fassung nicht kennt, zaehlt wie "kein Schritt bekannt". */
  var PHASEN_REIHE = ["start", "robots", "fetch", "render", "evaluate", "save"];
  function zuFortschritt(x) {
    x = obj(x);
    if (!x || !isArr(x.runs)) return null;
    var aus = { serverZeit: Date.parse(str(x.server_time)) || null, laeufe: {} };
    x.runs.forEach(function (r) {
      r = obj(r);
      if (!r || !uuidOk(r.run_id)) return;
      var ph = str(r.phase);
      aus.laeufe[str(r.run_id)] = { status: str(r.status), phase: PHASEN_REIHE.indexOf(ph) >= 0 ? ph : "", phaseAt: str(r.phase_at),
        acceptedAt: str(r.accepted_at), startedAt: str(r.started_at), errorCode: str(r.error_code), cancel: bool(r.cancel_requested) };
    });
    return aus;
  }
  /* Die Beobachtung mit dem Bildschirmfoto (slot "screenshot", kind "browser") und ob unser Browser die Seite
     ueberhaupt geoeffnet hat (slot "browser" beobachtet). */
  function bildVon(obs) {
    var l = isArr(obs) ? obs : [];
    var bild = l.filter(function (b) { return b && b.slot === "screenshot"; })[0] || null;
    /* Geoeffnet = irgendeine Browser-Beobachtung ausser dem Foto selbst (der Worker schreibt slot "browser", aeltere
       Fassungen browser.navigation usw.). */
    var browser = l.some(function (b) { return b && b.kind === "browser" && b.slot !== "screenshot" && b.outcome === "observed"; });
    return { bild: bild, browser: browser };
  }

  /* ---- Fehler der RPCs -> ein Satz fuer den Nutzer: aus core (siehe STATUS oben) ---------------- */
  function fehlerSatz(erg, o) {
    if (typeof UCK.pageAuditFehlerSatz === "function") return UCK.pageAuditFehlerSatz(erg, o);
    return { satz: ((o && o.t) || function (x) { return x; })("Something went wrong on our side. Please try again.") };
  }
  function dauerText(sek, t) { return typeof UCK.pageAuditDauerText === "function" ? UCK.pageAuditDauerText(sek, t) : String(Math.round(num(sek) || 0)) + " s"; }
  /* 0.25-Schritte (monatlich = 1/4) ohne lange Nachkommastellen. */
  function fmtZahl(v) {
    var n = num(v);
    if (n == null) return "–";
    return String(Math.round(n * 100) / 100);
  }

  window.UpstreemPageAuditDaten = {
    FN: FN, SORTIERUNG: SORTIERUNG, LIMIT_MAX: LIMIT_MAX,
    liste: liste, detail: detail, schluessel: schluessel,
    zuListe: zuListe, zuDetail: zuDetail, zuQuittung: zuQuittung, zuQuota: zuQuota, zuKapazitaet: zuKapazitaet, laeuft: laeuft,
    PROFILE: PROFILE, profil: profil, modellPasst: modellPasst,
    ERGEBNIS: ERGEBNIS, STATUS: STATUS, PLAN: PLAN, LAUF_FEHLER: LAUF_FEHLER, TEIL_GRUND: TEIL_GRUND, teilSatz: teilSatz,
    SCHWERE: SCHWERE, SCHWERE_RANG: SCHWERE_RANG, WIRKUNG: WIRKUNG, wirkung: wirkung, wirkungKurz: wirkungKurz, jsSatz: jsSatz, haupttextFehlt: haupttextFehlt,
    CHECKS: CHECKS, CHECK: CHECK, CHECK_ZUSTAND: CHECK_ZUSTAND, CHECK_BEREICH: CHECK_BEREICH, CHECK_ZIEL: CHECK_ZIEL, checkWert: checkWert, CRAWLER_ROLLE: CRAWLER_ROLLE,
    BEFUNDE: BEFUNDE, befundText: befundText, befundFelder: befundFelder, belege: belege, AENDERUNG: AENDERUNG,
    METRIKEN: METRIKEN, METRIK_REIHE: METRIK_REIHE, FEHLT: FEHLT,
    slotName: slotName, ERGEBNIS_BEOBACHTUNG: ERGEBNIS_BEOBACHTUNG, PHASEN_REIHE: PHASEN_REIHE, zuFortschritt: zuFortschritt, bildVon: bildVon,
    fehlerSatz: fehlerSatz, dauerText: dauerText, fmtZahl: fmtZahl, uuidOk: uuidOk
  };
})();
