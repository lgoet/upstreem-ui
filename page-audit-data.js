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
        /* Ab wann ein manueller Start wieder geht (23.10., page_audit_cooldown_23_10_v1.sql); leer = jetzt bzw. alte DB. */
        nextAllowedAt: str(r.next_allowed_at),
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
                 nextRunAt: str(p.next_run_at), runCount: num(p.run_count), createdAt: str(p.created_at),
                 nextAllowedAt: str(p.next_allowed_at) };
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
  /* Texte der 34 uebrigen Familien (22.10., "alle im gleichen Detailgrad wie der JS-Fall"): kurz ist die Zeile unter
     dem Titel, warum der Absatz "Why it matters", schritte die Liste "How to fix". Jede Aussage hat eine Quelle im
     Kommentar darueber (Notizen mit Zitaten: research_notes/Befundtexte Page Audit/); im sichtbaren Text stehen keine
     Quellen. kurz und warum werden NICHT gefuellt (befundText), darum dort keine Platzhalter; auch die neuen Schritte
     kommen ohne aus, damit t() sie findet. Wo eine Quelle fehlte, ist der Satz vorsichtiger oder weggelassen. */
  var BEFUNDE = {
    /* Quellen: Google, Debug network and DNS errors (developers.google.com/crawling/docs/troubleshooting/dns-network-errors):
       unerreichbare indexierte URLs "removed from Google's index within days", A/CNAME- und NS-Eintraege pruefen; MDN Glossar DNS.
       satz: der Worker meldet "dns" auch an einer Stufe der Weiterleitung (abruf.ts, zielPruefen je Hop). */
    "transport.dns_resolution_failed": { titel: "The domain could not be resolved", kurz: "Without a DNS answer, the server of this page can't be found.",
      warum: "To find the server, a client first looks up the host name in DNS. If that fails for crawlers too, they can't reach the page. Google removes indexed pages it can't reach from its index within days.",
      schritte: ["Check the A and CNAME records of this host name and of any host it redirects to.", "Check that the domain is still registered and that its name servers answer.", "Run the audit again."],
      satz: "Our request could not resolve the host name of the page or of a redirect target in DNS.", schritt: "Check the DNS records of this host and that the domain is still active.", umfang: "request" },
    /* Quellen: RFC 9110 4.3.4 (Clients pruefen die Identitaet am Zertifikat; "Automated clients ... SHOULD terminate the
       connection", Nutzer werden vorher gefragt); Google Search Console, HTTPS report (support.google.com/webmasters/answer/11396518):
       "HTTPS has invalid certificate", "update your HTTPS certificate". */
    "transport.tls_validation_failed": { titel: "The secure connection failed", kurz: "Crawlers and browsers that check the certificate stop here or show a warning.",
      warum: "The certificate shows that the server really belongs to this address. If it isn't valid, automated clients such as crawlers should end the connection, and browsers ask visitors before going on. Google reports invalid certificates as an HTTPS error to fix.",
      schritte: ["Check that the certificate is valid, not expired and issued for this exact host name.", "Renew or replace it, for example with your hosting provider or CDN.", "Run the audit again."],
      satz: "The TLS certificate or handshake could not be validated. We never skip this check.", schritt: "Check that the certificate is valid, not expired and covers this host name.", umfang: "request" },
    /* Quellen: Google, Debug network and DNS errors: Timeouts "similarly to 5xx server errors", Crawling verlangsamt sich,
       unerreichbare indexierte URLs "within days" entfernt. satz nach abruf.ts/netz.ts: 5 s Verbindung, 20 s Antwort; eine
       Wiederholung gibt es nur, wenn die Frist es erlaubt, darum steht sie nicht im Satz. */
    "transport.request_timeout": { titel: "The page did not respond in time", kurz: "If crawlers also wait in vain, they get no page to read.",
      warum: "A slow or stuck server delivers nothing to clients that stop waiting. Google treats timeouts like server errors: it crawls more slowly and removes indexed pages that stay unreachable within days.",
      schritte: ["Check how long this page takes to load for a first visit, without cookies.", "Check whether your server, CDN or bot protection holds back requests from unknown clients.", "Run the audit again."],
      satz: "Our request got no complete answer within our time limits (5 seconds to connect, 20 seconds for the response).", schritt: "Check the response time of this page and whether it slows down unknown clients.", umfang: "request" },
    /* Quellen: MDN 401 (fehlende gueltige Anmeldedaten); Google Search Essentials, technical requirements: "requiring a log-in
       ... Googlebot will not crawl it"; Google, HTTP status codes (developers.google.com/search/docs/crawling-indexing/http-network-errors):
       "Google doesn't use the content from URLs that return 4xx status codes". */
    "http.authentication_required": { titel: "The page requires sign-in", kurz: "Without a sign-in, crawlers can't read this page.",
      warum: "HTTP 401 means the request lacked valid credentials. Google says Googlebot doesn't crawl pages that require a sign-in, and Google doesn't use content from pages that return 4xx.",
      schritte: ["Check whether this page should be public.", "If it should, remove the sign-in requirement for this address in your server or CDN settings.", "Run the audit again."],
      satz: "The server answered with HTTP 401.", schritt: "If this page should be public, remove the sign-in requirement for it.", umfang: "request" },
    /* Quellen: MDN 403 ("understood the request but refused to process it"); Google HTTP status codes (4xx-Inhalte ungenutzt);
       veroeffentlichte IP-Bereiche der Crawler: Google (verify-google-requests), OpenAI (searchbot.json), Perplexity
       (perplexitybot.json), Anthropic (claude.com/crawling/bots.json). */
    "http.access_denied": { titel: "Access was denied", kurz: "The server refused our request, so the page couldn't be read.",
      warum: "HTTP 403 means the server understood the request and refused it. If crawlers get the same answer, they can't read the page, and Google doesn't use content from pages that return 4xx.",
      schritte: ["Check firewall, bot protection and CDN rules for this page.", "Look in your server logs for visits from the crawlers' published IP addresses and the status they got.", "Run the audit again."],
      satz: "The server answered our request with HTTP 403.", schritt: "Check firewall, bot protection and CDN rules for this page, and look for real crawler visits in your server logs.", umfang: "request" },
    /* Quellen: MDN 404; Google HTTP status codes (4xx ungenutzt, frueher indexierte URL wird entfernt); Google AI features
       (developers.google.com/search/docs/appearance/ai-features): "a page must be indexed"; Search Console Page indexing
       (support.google.com/webmasters/answer/7440203): "404 responses are not necessarily a problem, if the page has been removed";
       Google Troubleshoot crawling errors: verschoben -> 301. */
    "http.not_found": { titel: "The page was not found", kurz: "There is no page at this address.",
      warum: "HTTP 404 means the server found nothing at this address. Google doesn't index such pages, and AI Overviews and AI Mode only link to indexed pages. If the page was removed on purpose, this is fine.",
      schritte: ["Check that the address is right, for example in the link or sitemap you took it from.", "If the page moved, redirect this address to the new one with a 301. If it was removed, update the links to it.", "Run the audit again."],
      satz: "The server answered with HTTP 404.", schritt: "Restore the page or redirect it to its replacement, and fix links to it.", umfang: "request" },
    /* Quellen: MDN 410 ("likely to be permanent"); Google HTTP status codes (4xx ungenutzt); Google AI features (nur indexierte Seiten). */
    "http.gone": { titel: "The page was removed", kurz: "The server says this page was removed for good.",
      warum: "HTTP 410 means the page is gone and likely won't come back. Google doesn't index such pages, and AI Overviews and AI Mode only link to indexed pages.",
      schritte: ["Check whether this page was removed on purpose.", "If it should exist, restore it or redirect this address to its replacement with a 301.", "Run the audit again."],
      satz: "The server answered with HTTP 410, which means the page was removed permanently.", schritt: "If the page should exist, restore it or redirect it to its replacement.", umfang: "request" },
    /* Quellen: MDN 429 (RFC 6585 4); Google HTTP status codes: 429 "considered a server error", "5xx and 429 ... slow down",
       indexierte URLs "eventually dropped". satz: der Worker wiederholt 429 nur bei Retry-After bis 10 s (abruf.ts), das
       fruehere "also after a retry" stimmte also nicht immer. */
    "http.rate_limited": { titel: "The request was rate limited", kurz: "The server asked us to slow down instead of sending the page.",
      warum: "HTTP 429 says that a client sent too many requests in a given time. Google treats 429 as a server error: it crawls more slowly, and indexed pages that keep returning it are eventually dropped.",
      schritte: ["Check the rate limits of your server, CDN or bot protection for this page.", "Make sure a single request from a new visitor isn't limited.", "Run the audit again."],
      satz: "The server answered our request with HTTP 429, too many requests.", schritt: "Check the rate limits that apply to crawlers.", umfang: "request" },
    /* Quellen: RFC 9110 15.6 / MDN Status (5xx: Server konnte die Anfrage nicht ausfuehren); Google HTTP status codes
       (Crawling verlangsamt, indexierte URLs "eventually dropped"). satz: eine Wiederholung gibt es nur bei 502/503/504. */
    "http.server_error": { titel: "The server returned an error", kurz: "The server answered with an error instead of the page.",
      warum: "A 5xx status means the server couldn't handle the request. Google crawls more slowly when it gets server errors, and indexed pages that keep returning them are eventually dropped.",
      schritte: ["Look up this request in your server's error logs.", "Fix the cause, or ask your hosting provider if the error comes from their side.", "Run the audit again."],
      satz: "The server answered our request with an HTTP 5xx error status.", schritt: "Check the server logs for this page.", umfang: "request" },
    /* Quellen: Google HTTP status codes: 204 "wasn't able to receive any content and therefore can't process it", leere
       Seite -> soft 404; MDN 204. */
    "http.empty_representation": { titel: "The page returned no content", kurz: "The server answered successfully but sent no content to read.",
      warum: "Without content there is nothing to read or index. Google can't process a 204 response, and it reports empty pages as soft 404.",
      schritte: ["Open the address in a private browser window and check that the page shows.", "Check that the server sends the page's HTML for a normal GET request, without cookies or a sign-in.", "Run the audit again."],
      satz: "The response was successful but empty, so there was nothing to examine.", schritt: "Check that the page sends its content for a normal GET request.", umfang: "request" },
    /* Quellen: Google Search Essentials, technical requirements: "Google only indexes pages that are served with an HTTP 200";
       Google AI features (nur indexierte Seiten). */
    "http.unexpected_status": { titel: "Unexpected response", kurz: "The server answered with a status that doesn't deliver the page.",
      warum: "Google only indexes pages served with HTTP 200, and AI Overviews and AI Mode only link to indexed pages. With this status there was no content for us to check.",
      schritte: ["Find out why your server answers a normal GET request for this page with this status.", "Change it so the page is served with HTTP 200.", "Run the audit again."],
      satz: "The server returned a status without usable content.", schritt: "Check how the server answers a normal GET request for this page.", umfang: "request" },
    /* Quellen: MDN Redirections ("no page will ever be found", Browser zeigen einen Fehler); Search Console Page indexing:
       "Redirect error ... A redirect loop" als Grund fuer nicht indexiert. */
    "redirect.loop": { titel: "Redirect loop", kurz: "The redirects go in a circle and never reach a page.",
      warum: "A redirect loop never ends at a page, so no one gets the content: browsers show an error, and Google lists redirect loops as a reason a page isn't indexed.",
      schritte: ["Follow the redirects of this address step by step, for example in your browser's developer tools.", "Fix the rule that sends it back to an earlier address, so the chain ends at one page.", "Run the audit again."],
      satz: "The redirects lead back to an address that was already visited.", schritt: "Fix the redirect rules so the chain ends at one page.", umfang: "request" },
    /* Quellen: Google HTTP status codes ("follow up to 10 redirect hops"); Search Console Page indexing ("A redirect chain that
       was too long", "A bad or empty URL in the redirect chain"); unsere Grenze von 5 aus abruf.ts (BUDGET.weiterleitungen). */
    "redirect.unresolved": { titel: "The redirect chain does not end", kurz: "The redirects don't lead to a page.",
      warum: "Either a redirect had no valid target, or the chain went on for more than 5 steps, where our audit stops. Google follows up to 10 and lists chains that are too long and bad target addresses as redirect errors.",
      schritte: ["Follow the redirects of this address step by step, for example in your browser's developer tools.", "Let each redirect point straight to the final page, with a valid address.", "Run the audit again."],
      satz: "A redirect had no usable target, or there were more than 5 redirects.", schritt: "Shorten the chain and let every redirect point to a valid address.", umfang: "request" },
    /* Quellen: unsere Regel (HANDOFF 4.1, 7.3; netz.ts zielPruefen: Schema, Zugangsdaten, Port, IP-Literal, nicht oeffentlich);
       RFC 1918 3: private Adressen "have no global meaning", "cannot have IP connectivity to any host outside of the enterprise".
       Titel und satz korrigiert: "non-public" traf nicht jeden Grund (auch ein unueblicher Port oder eine reine IP-Adresse). */
    "redirect.unsafe_destination": { titel: "Redirect to an address we don't follow", kurz: "We couldn't check the page behind this redirect.",
      warum: "Our audit only follows redirects to public web addresses on the standard ports. If the target is in a private network, crawlers on the internet can't reach it either, because private addresses aren't routed on the internet.",
      schritte: ["Look at where this address redirects, for example in your browser's developer tools.", "Point the redirect to the public https address of the page.", "Run the audit again."],
      satz: "A redirect points to an address our audit doesn't follow, such as a private network address, a bare IP address, a non-standard port or a link that isn't http or https.", schritt: "Point the redirect to the public address of the page.", umfang: "request" },
    /* Quellen: Google, How to specify a canonical (developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls):
       "Google prefers HTTPS pages over equivalent HTTP pages as canonical", ausser u. a. "The HTTPS page redirects to the HTTP page". */
    "redirect.https_downgrade": { titel: "Redirect from HTTPS to HTTP", kurz: "A secure address ends on an unencrypted page.",
      warum: "After the redirect, the page is loaded over http without encryption. Google usually prefers the HTTPS version of a page as canonical, but not when the HTTPS address redirects to HTTP.",
      schritte: ["Find the redirect rule that sends this address to http://.", "Point it to the https address instead.", "Run the audit again."],
      satz: "A secure address redirects to an insecure one.", schritt: "Redirect to the HTTPS address instead.", umfang: "request" },
    /* Quellen: Google, Fix lazy-loaded content: "Google Search does not interact with your page"; OpenAI bots ("allowing requests
       from our published IP ranges"), Perplexity crawlers (WAF-Regel aus User Agent UND IP), Anthropic (bots.json). satz
       entschaerft: das Cloudflare-Merkmal kommt laut heuristics.json auch auf lesbaren Seiten vor. */
    "response.suspected_challenge": { titel: "Possible bot challenge", kurz: "If crawlers get this check instead of the page, they have nothing to read.",
      warum: "Our request got a response with signs of a bot check, such as a captcha. Google says its Search doesn't interact with pages, for example by clicking. Several AI search providers publish the IP addresses of their crawlers so you can let them through.",
      schritte: ["Check your bot protection and CDN settings for this page.", "If search crawlers should get the page, allow them by user agent and published IP addresses together. Keep the protection if it's intended.", "Run the audit again."],
      satz: "The response contains signs of a bot check or captcha, so the content may be hidden behind it.", schritt: "Check your bot protection for search crawlers. Keep it on if it is intended.", umfang: "heuristic" },
    /* Quellen: Google Search Essentials, technical requirements ("requiring a log-in ... Googlebot will not crawl it");
       der zweite Satz ist eine logische Folge, keine Behauptung ueber einen Anbieter. */
    "response.suspected_login_wall": { titel: "Possible login wall", kurz: "If the content needs a sign-in, crawlers without an account can't read it.",
      warum: "Google says Googlebot doesn't crawl pages that require a sign-in. Any other crawler would also need an account to read content behind one.",
      schritte: ["Open the page in a private browser window and check what you see without signing in.", "If the content should be public, make it readable without a sign-in.", "Run the audit again."],
      satz: "The page shows a password field and no readable main content.", schritt: "If the content should be public, make it readable without signing in.", umfang: "heuristic" },
    /* Quellen: Google HTTP status codes (2xx mit Fehlerinhalt -> soft 404); Search Console Page indexing ("Soft 404" als Grund
       fuer nicht indexiert); Google Troubleshoot crawling errors (404/410 fuer entfernte, 301 fuer verschobene Seiten).
       warum nach heuristics.json: Titel oder H1 wie "page not found" und kein weiterer Haupttext. */
    "response.suspected_soft_404": { titel: "Possible soft 404", kurz: "Google may treat this page as missing, although it reports success.",
      warum: "The server reports success, but the title or main heading says the page wasn't found, and there is no other main text. Google calls this a soft 404 and lists it as a reason a page isn't indexed.",
      schritte: ["Open the page and check whether the content is really missing.", "If the page is gone, return 404 or 410. If it moved, redirect it with a 301. If it should exist, restore the content.", "Run the audit again."],
      satz: "The page answers with HTTP 200 but looks like an error page.", schritt: "Return a real 404 for missing pages, or restore the content.", umfang: "heuristic" },
    /* Quellen: veroeffentlichte IP-Bereiche (Google verify-google-requests, OpenAI searchbot.json, Perplexity perplexitybot.json,
       Anthropic bots.json); Perplexity: User Agent und IP gemeinsam pruefen. Ausloeser im Worker: 401, 403, 429, 5xx,
       abgebrochene Kette oder Challenge-Merkmal nur mit dem Crawler-Namen (bewertung.ts). */
    "variants.ua_access_difference": { titel: "Different response for {token}", kurz: "With this crawler's name, our request was refused or challenged. Without it, the page loaded.",
      warum: "The server treats requests differently by their user agent. If it treats the real crawler like ours, that crawler can't read the page. The real crawler comes from IP addresses its provider publishes, ours came from our servers, so its result can differ.",
      schritte: ["Check your firewall, CDN and bot protection rules for this crawler's user agent.", "If the crawler should get the page, allow it by user agent and published IP addresses together.", "Run the audit again."],
      satz: "With the user agent of {token}, the page answered differently than for a normal request.", titelOhne: "Different response for a crawler user agent", satzOhne: "With a crawler's user agent, the page answered differently than for a normal request.", schritt: "Check CDN and bot rules for this user agent, and look for real crawler visits in your server logs.", umfang: "synthetic" },
    /* Quellen: MDN Accept-Language (Browser setzen es nach ihrer Sprache); Google, Managing multi-regional and multilingual sites:
       "Avoid automatically redirecting users from one language version ... to a different language version", Googlebot
       "sends HTTP requests without setting Accept-Language". */
    "variants.language_access_failure": { titel: "A language version failed", kurz: "Requests that state a preferred language, as browsers do, didn't get this page.",
      warum: "Browsers tell the server which languages they prefer. With such a preference our request failed or was refused, without one it worked. Google advises against redirecting automatically by language, and Googlebot itself sends no language preference.",
      schritte: ["Check the language redirects of this page in your server or CDN settings.", "Make sure every language version loads, or serve this page without redirecting by language.", "Run the audit again."],
      satz: "With a language preference, the request failed or was denied while the normal request worked.", schritt: "Check the language redirects of this page.", umfang: "request" },
    "robots.search_path_disallowed": { kurz: "The platform's search crawler is asked not to fetch this page.", warum: "The search crawler of a platform reads robots.txt before it fetches a page. A rule that excludes it keeps this page out of that platform's search, while training crawlers are a separate decision.",
      schritte: ["Find the rule shown above in your robots.txt.", "Allow {token} on this path if this page should appear in {platform}. Training crawlers can stay blocked.", "Run the audit again."],
      schritteOhne: ["Find the rule shown above in your robots.txt.", "Allow the search crawler on this path if this page should appear in AI search. Training crawlers can stay blocked.", "Run the audit again."], titel: "Published robots policy excludes {token}", satz: "The captured robots file excludes the requested {path} path for {token}. This is a public policy observation.", titelOhne: "robots.txt excludes a search crawler", satzOhne: "The captured robots file excludes the requested path for a search crawler. This is a public policy observation.", schritt: "Review the exact rule if this URL is intended for {platform} visibility. Keep training policy separate.", schrittOhne: "Review the exact rule if this URL should be visible in AI search. Keep training policy separate.", umfang: "policy" },
    /* Quellen: Google common crawlers (developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers):
       Google-Extended steuert Training kuenftiger Gemini-Modelle UND Grounding in Gemini Apps, "doesn't have a separate HTTP
       request user agent string", "does not impact a site's inclusion in Google Search". Ein Token fuer beides, darum sagt
       der Schritt, dass Erlauben auch das Training erlaubt. */
    "robots.grounding_policy_disallowed": { titel: "robots.txt excludes Google-Extended", kurz: "Google is asked not to use this page for Gemini answers or Gemini training.",
      warum: "Google-Extended is a robots.txt rule, not a crawler of its own. It decides whether content Google crawls may be used to train Gemini and to ground answers in Gemini Apps.",
      schritte: ["Find the rule in your robots.txt that applies to Google-Extended on this path.", "Allow Google-Extended on this path if this page should be used in Gemini answers. That also allows its use for training Gemini.", "Run the audit again."],
      satz: "The robots file excludes this path for Google-Extended, which controls use in Gemini answers. It does not affect Google Search.", schritt: "Review the rule if this page should be used in Gemini answers.", umfang: "policy" },
    /* Quellen: Google robots meta tag (developers.google.com/search/docs/crawling-indexing/robots-meta-tag): noindex "Do not show
       this page ... in search results", none = noindex, nofollow, Meta-Tag und X-Robots-Tag; Google AI features ("indexed");
       Bing Webmaster Guidelines 10: "Use NOINDEX when a URL should NOT appear in Bing search, Copilot experiences, or
       grounding API results" (am 22.10. im Browser gelesen). */
    "directives.noindex": { titel: "The page is marked noindex", kurz: "A noindex rule asks search engines not to show this page, also in their AI answers.",
      warum: "Google doesn't index pages with noindex, and AI Overviews and AI Mode only link to indexed pages. Bing names noindex as the way to keep a page out of Bing search, Copilot and grounding results.",
      schritte: ["Find noindex or none in the robots meta tag of the page or in its X-Robots-Tag HTTP header.", "Remove it if the page should appear in search and AI answers. Keep it if the page should stay out.", "Run the audit again."],
      satz: "A noindex directive was found in the {source}.", satzOhne: "A noindex directive was found.", schritt: "Remove noindex if this page should appear in AI search.", umfang: "policy" },
    /* Quellen: Google robots meta tag: unavailable_after "Do not show this page in search results after the specified
       date/time"; Google AI features ("indexed and eligible to be shown in Google Search"). */
    "directives.expired": { titel: "The page has expired", kurz: "The date after which Google should stop showing this page has passed.",
      warum: "The unavailable_after rule tells Google not to show a page in search results after a set date. AI Overviews and AI Mode only link to pages that can be shown in Google Search.",
      schritte: ["Find unavailable_after in the robots meta tag or the X-Robots-Tag header of this page.", "Remove it, or set a later date, if the page should stay visible.", "Run the audit again."],
      satz: "An unavailable_after date in the past was found.", schritt: "Remove or update the date if the page should stay visible.", umfang: "policy" },
    /* Quellen: Google robots meta tag: nosnippet gilt auch fuer "AI Overviews, AI Mode" und verhindert die Nutzung "as a direct
       input"; max-snippet:0 = nosnippet; data-nosnippet fuer Teile; Google AI features: "eligible to be shown in Google Search
       with a snippet". */
    "directives.nosnippet": { titel: "Text previews are disabled", kurz: "Google is asked not to show any text from this page, also in AI Overviews and AI Mode.",
      warum: "The nosnippet rule, or max-snippet:0, tells Google not to show a text snippet for this page. Google applies this to AI Overviews and AI Mode as well, and only links pages there that it may show with a snippet.",
      schritte: ["Find nosnippet or max-snippet:0 in the robots meta tag or the X-Robots-Tag header.", "Remove it if text from this page should be shown. To hide only some passages, mark them with data-nosnippet instead.", "Run the audit again."],
      satz: "nosnippet or max-snippet:0 keeps Google from showing text from this page, also in AI features.", schritt: "Remove the directive if text from this page should be shown.", umfang: "policy" },
    /* Quellen: Bing Webmaster Guidelines 10: "DATA-NOSNIPPET and NOSNIPPET prevent Bing from displaying captions and may limit
       Copilot citation quality"; Bing-Blog 15.10.2025 (data-nosnippet): max-snippet "Limit the size or duration of preview
       content". Eine Wirkung von max-snippet auf Copilot dokumentiert Bing nicht, darum steht keine da. */
    "directives.bing_preview_restriction": { titel: "Bing previews are limited", kurz: "Bing is asked to show less or no text from this page.",
      warum: "The nosnippet rule keeps Bing from showing text from this page in its results, and max-snippet limits how much it shows. Bing says nosnippet may also lower the quality of Copilot citations.",
      schritte: ["Find nosnippet or max-snippet in the robots meta tag or the X-Robots-Tag header.", "Remove the rule or raise the limit if Bing should show more text. To hide only some passages, use data-nosnippet instead.", "Run the audit again."],
      satz: "nosnippet or a max-snippet limit restricts Bing's text previews.", schritt: "Review the directive if you want fuller previews in Bing.", umfang: "policy" },
    /* Quellen: Google robots meta tag: max-snippet "Use a maximum of [number] characters", gilt auch fuer AI Overviews und AI Mode
       und "will also limit how much of the content may be used as a direct input". */
    "directives.snippet_cap": { titel: "Preview length is limited", kurz: "Google may show only a short excerpt of this page, also in AI Overviews and AI Mode.",
      warum: "The max-snippet rule sets how many characters Google may show as a text snippet. Google applies the limit to AI Overviews and AI Mode too, including how much of the content they may use directly.",
      schritte: ["Find max-snippet in the robots meta tag or the X-Robots-Tag header and check the number.", "Raise or remove the limit if longer excerpts should be shown. Keep it if the limit is intended.", "Run the audit again."],
      satz: "A max-snippet limit allows only a short excerpt. This is a limit, not an exclusion.", schritt: "Review the limit if longer excerpts should be shown.", umfang: "policy" },
    /* Quellen: Bing Webmaster Guidelines 10: "NOARCHIVE prevents content from being used in Copilot responses and grounding
       results"; Bing-Blog 22.09.2023 (Bing Chat): Inhalte mit NOCACHE oder NOARCHIVE "will still appear in our search results",
       NOCACHE: nur URL, Titel, Snippet. */
    "directives.bing_noarchive": { titel: "noarchive limits Copilot", kurz: "Bing is asked not to use this page in Copilot answers.",
      warum: "With noarchive, Bing leaves the content out of Copilot responses and grounding results. The page itself can still appear in Bing search.",
      schritte: ["Find noarchive in the robots meta tag or the X-Robots-Tag header.", "Remove it if this page should be used in Copilot answers. With nocache instead, Copilot may use only the URL, title and snippet.", "Run the audit again."],
      satz: "Bing documents that noarchive keeps content out of Copilot and grounding answers.", schritt: "Remove noarchive if this page should be used in Copilot answers.", umfang: "policy" },
    /* Quellen: Bing Webmaster Guidelines 10: "NOCACHE limits Copilot to using only the URL, title, and snippet, reducing citation
       depth and answer quality"; Bing-Blog 22.09.2023: beide Tags -> "we will treat it as NOCACHE". Der Schritt nennt noarchive
       mit, weil nach dem Entfernen von nocache sonst noarchive allein gilt. */
    "directives.bing_nocache": { titel: "nocache limits Copilot", kurz: "Copilot may use only the URL, title and snippet of this page.",
      warum: "Bing says this reduces how fully Copilot can cite the page and answer from it. If noarchive is set as well, Bing treats the page as nocache.",
      schritte: ["Find nocache in the robots meta tag or the X-Robots-Tag header.", "Remove it, and noarchive too if it's set, if Copilot should be able to use the full content.", "Run the audit again."],
      satz: "Bing documents that nocache limits how the content is used in Copilot answers.", schritt: "Review nocache if this page should be fully used in Copilot answers.", umfang: "policy" },
    /* Quellen: Google JavaScript SEO basics: "When Google encounters the noindex tag, it may skip rendering and JavaScript
       execution", "using JavaScript to change or remove the robots meta tag from noindex may not work as expected", "not all
       bots can run JavaScript". */
    "directives.dynamic_conflict": { titel: "Directives change after rendering", kurz: "JavaScript changes the page's robots rules after it loads.",
      warum: "Crawlers that don't run JavaScript only see the rules in the initial HTML. Google may skip rendering when it finds noindex there, so changing or removing it with JavaScript may not work as expected.",
      schritte: ["Compare the robots meta tag in View Source with the one in your browser's developer tools.", "Put the rules you want into the HTML your server sends, and don't change them with JavaScript.", "Run the audit again."],
      satz: "The robots directives in the initial HTML differ from those after JavaScript ran.", schritt: "Serve the intended directives in the initial HTML.", umfang: "content" },
    /* Die drei JS-Familien nach den Formulierungsgrenzen des Berichts (UMSETZUNGSPLAN 14, verbindlich):
       nur was unser Browser gemessen hat, Zaehler und Nenner statt Prozent, keine Aussage ueber das, was
       eine Plattform "sieht", und keine ueber Zitierungen. Der Satz mit Zahlen entsteht in jsSatz. */
    /* Quellen: MDN main ("represents the dominant content of the body"); Google JavaScript SEO basics ("not all bots can run
       JavaScript"). Vorsichtiger als vorher: der Befund kommt auch, wenn der Text nach dem Rendern ausserhalb des markierten
       Bereichs steht (bewertung.ts, D2 bestanden bei leerem main), darum sagt kein Satz mehr, die Seite habe keinen Haupttext. */
    "content.raw_main_empty": { titel: "No main text in the initial HTML", kurz: "Systems that read only this HTML find no text where the main content should be.",
      warum: "Pages mark their main content, for example with a main element, so software can find it. In the initial HTML this area is empty, and Google notes that not all bots can run JavaScript.",
      schritte: ["Check with View Source in your browser what this area contains before any script runs.", "Put the main text into it in the HTML your server sends, with server-side rendering, static generation or pre-rendering if it comes from JavaScript.", "Run the audit again."],
      satz: "The area marked as main content (main, role=main or article) is empty in the initial HTML.", schritt: "Make the main text available in the initial HTML (server-side rendering, static generation or pre-rendering), then run the audit again.", umfang: "content" },
    "content.raw_empty_rendered_present": { titel: "The main text only appears after JavaScript", kurz: "Systems that read only this HTML get a page without its main text.",
      warum: "Several AI platforms have been seen fetching pages without running JavaScript when they answer a question. For them, this page has no main text. The list below shows which platforms and how sure that is.",
      schritte: ["Send the main text in the HTML from your server, with server-side rendering, static generation or pre-rendering.", "Check it with View Source in your browser: the text should be there before any script runs.", "Run the audit again."], satz: "The main content area is empty in the initial HTML. Our browser filled it after running JavaScript (Chromium, up to 10 seconds, no interaction). Systems that read only the initial HTML do not receive this text.", schritt: "Make the main text available in the initial HTML (server-side rendering, static generation or pre-rendering), then run the audit again.", umfang: "content" },
    "content.rendered_text_difference": { titel: "Some of the page text is added by JavaScript", kurz: "Systems that read only this HTML get less text than your visitors.",
      warum: "Several AI platforms have been seen fetching pages without running JavaScript when they answer a question. For them, this page is shorter than what your visitors read. The list below shows which platforms and how sure that is.",
      schritte: ["Send the main text in the HTML from your server, with server-side rendering, static generation or pre-rendering.", "Check it with View Source in your browser: the text should be there before any script runs.", "Run the audit again."], satz: "Part of the text is missing from the initial HTML. Our browser added it after running JavaScript (Chromium, up to 10 seconds, no interaction). Systems that read only the initial HTML do not receive this text.", schritt: "Make the main text available in the initial HTML (server-side rendering, static generation or pre-rendering), then run the audit again.", umfang: "content" },
    /* Quellen: Google, Fix lazy-loaded content ("Google Search does not interact with your page"); Google Search Essentials,
       technical requirements ("requiring a log-in ... Googlebot will not crawl it"). Titel und satz um die Anmeldung ergaenzt:
       der Worker meldet heute genau Passwortfeld ohne gerenderten Haupttext (bewertung.ts, D3). */
    "interaction.suspected_gate": { titel: "Possible sign-in, overlay or paywall", kurz: "Without clicking, our browser found no main text, and something may be in the way.",
      warum: "Google says its Search doesn't interact with pages, for example by clicking, and that Googlebot doesn't crawl pages that need a sign-in. Text that only appears after such a step isn't there for a crawler that doesn't take it.",
      schritte: ["Open the page in a private browser window and check what covers the main text before you click.", "If the text should be public, show it without a sign-in, click or overlay. Keep the gate if it's intended.", "Run the audit again."],
      satz: "A sign-in form, overlay or paywall may hide the main content when the page is opened without interaction.", schritt: "Open the page without cookies and check what is visible without clicking.", umfang: "heuristic" },
    /* Quellen: Google, How to specify a canonical: "Don't specify different URLs as canonical for the same page"; Google,
       Fix canonicalization issues: CMS oder Plugins "can make incorrect use of canonicalization techniques". Was Google bei
       mehreren Angaben tut ("ignore all"), steht nur in einem Blogbeitrag von 2013 -- darum nicht im Text. */
    "canonical.conflicting": { titel: "Conflicting canonical tags", kurz: "It's unclear which address this page prefers.",
      warum: "A canonical tells search engines which address you prefer for this content. This page names different ones, in the HTML, the HTTP header or after JavaScript, and Google advises against naming different canonical URLs for the same page.",
      schritte: ["Find every canonical of this page: link tags in the HTML, a Link HTTP header and tags added by JavaScript.", "Keep one and remove the others. Check your CMS and its plugins too, as they can add canonical tags.", "Run the audit again."],
      satz: "The page declares more than one canonical address.", schritt: "Declare one canonical address.", umfang: "request" },
    /* Quellen: Google, How to specify a canonical: "Use absolute paths rather than relative paths with the rel="canonical" link
       element". Ausloeser im Worker: eine Angabe, die sich nicht als http(s)-Adresse aufloesen laesst (bewertung.ts, E1). */
    "canonical.invalid": { titel: "Invalid canonical tag", kurz: "A canonical on this page doesn't name a valid web address.",
      warum: "A canonical tells search engines which address you prefer for this content. This one can't be read as an http or https address, so it names no page. Google recommends full, absolute addresses in canonical tags.",
      schritte: ["Find the canonical in the HTML or the Link HTTP header of this page.", "Change it to the full address of the preferred page, starting with https://.", "Run the audit again."],
      satz: "The declared canonical address can't be resolved.", schritt: "Fix the canonical URL.", umfang: "request" },
    /* Quellen: MDN Content-Language (Publikum, nicht die Sprache des Texts; "use the lang attribute instead"); W3C, Declaring
       language in HTML ("the in-page language declaration always overrides the HTTP information"); Google, Managing
       multi-regional sites ("We don't use any code-level language information such as lang attributes"). satz korrigiert:
       der Worker vergleicht nur lang und Content-Language, hreflang nicht (bewertung.ts, F1). */
    "language.declaration_conflict": { titel: "Conflicting language signals", kurz: "The page declares two different languages.",
      warum: "The lang attribute says which language the text is written in, the Content-Language header which audience the page is meant for. They can differ on purpose, for example on a language course. Google determines the language from the visible text and doesn't use the lang attribute.",
      schritte: ["Check which language the text of this page is written in.", "Set the lang attribute of the html element to it, and change Content-Language unless the different audience is intended.", "Run the audit again."],
      satz: "The lang attribute of the page and its Content-Language header name different languages.", schritt: "Align the language declarations.", umfang: "request" }
  };
  /* Platzhalter aus details: nur einfache Texte bis 200 Zeichen, nie Objekte -- und nie ein
     Platzhalter, der stehen bleibt. Fehlt ein Wert, nimmt der Text seine Fassung ohne. */
  var QUELLE = { header: "X-Robots-Tag header", meta: "robots meta tag", html: "robots meta tag", rendered: "rendered page" };
  /* Erst uebersetzen, dann fuellen: t() findet nur den ganzen Satz, und der steht im Katalog mit
     Platzhalter. Gefuellt fand die Seite ihn nie, "Different response for PerplexityBot" blieb im
     Deutschen englisch. t() der Seite laesst den fertigen deutschen Satz danach unveraendert. */
  function tl(x) { var U = window.UpstreemCore; return x && U && U.t ? U.t(x) : x; }
  function fuellen(muster, ohne, w) {
    if (!muster) return "";
    muster = tl(muster);
    var fehlt = false;
    var aus = muster.replace(/\{([a-z]+)\}/g, function (_, k) {
      var v = str(w[k]).trim();
      if (!v || v.length > 200) { fehlt = true; return ""; }
      return v;
    });
    return fehlt ? (tl(ohne) || muster.replace(/\s*\{[a-z]+\}\s*/g, " ").replace(/\s+/g, " ").trim()) : aus;
  }
  function befundText(f) {
    var b = BEFUNDE[f.family], d = f.details || {};
    var platform = "";
    if (f.profiles && f.profiles.length === 1) platform = profil(f.profiles[0]).name;
    var w = { token: str(d.token || d.user_agent_token), path: str(d.path) || pfadAus(d.url), status: str(d.http_status || d.status),
              source: tl(QUELLE[str(d.source)] || ""), platform: platform };
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
  /* Der Worker schreibt die robots-Regel als Objekt regel { art, muster, zeile } und statt des Pfads die
     URL (bewertung.ts, B1). Gelesen wurde nur rule und path als Text: im echten Lauf fehlte die Regel,
     auf die der erste Schritt verweist ("the rule shown above"). Beide Formen werden gelesen. */
  function pfadAus(u) { var m = /^https?:\/\/[^\/?#]+([^#]*)/i.exec(str(u)); return m ? (m[1] || "/") : ""; }
  function regelText(r) {
    if (typeof r === "string") return r.trim().slice(0, 500);
    if (!obj(r)) return "";
    var art = str(r.art).toLowerCase(), muster = str(r.muster);
    if ((art !== "allow" && art !== "disallow") || !muster) return "";
    return (art === "allow" ? "Allow" : "Disallow") + ": " + muster;
  }
  function befundFelder(f) {
    var d0 = f.details || {}, d = {}, aus = [];
    for (var k in d0) if (Object.prototype.hasOwnProperty.call(d0, k)) d[k] = d0[k];
    if (d.rule == null) d.rule = regelText(d0.regel) || null;
    if (d.path == null && d0.regel != null) d.path = pfadAus(d0.url) || null;
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
    /* Als ganzer Satz mit Platzhaltern, damit t() ihn findet (Katalog in page-audit.js). */
    var muster = str(d.gerendert_strategie) === "body" ? "{x} of {n} characters of the page text are in the initial HTML."
      : "{x} of {n} characters of the main text are in the initial HTML.";
    return tl(muster).replace("{x}", fmt(x)).replace("{n}", fmt(n));
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
  /* Der Messwert eines Checks als GANZER Satz mit Platzhaltern (22.10.): vorher aus englischen Stuecken zusammengesetzt
     ("7 of 7" + " platforms allowed"), so fand ihn kein Katalog -- im Deutschen standen acht von 16 Werten englisch da
     (gemessen an upstreem.ai). Erst uebersetzen, dann fuellen, wie fuellen() oben. */
  function satzMit(muster, w) {
    var s = tl(muster);
    Object.keys(w || {}).forEach(function (k) { s = s.split("{" + k + "}").join(String(w[k])); });
    return s;
  }
  function checkWert(key, d, fmt) {
    d = obj(d) || {};
    fmt = fmt || function (v) { return String(v); };
    var n, m, l;
    switch (key) {
      case "A1": return num(d.status) != null ? "HTTP " + d.status + (num(d.ms) != null ? " in " + fmt(Math.round(d.ms)) + " ms" : "") : "";
      case "A2": n = num(d.weiterleitungen); if (n == null) return ""; if (n === 0) return tl("No redirects");
        return satzMit(n === 1 ? (d.andere_domain ? "1 redirect, to another domain" : "1 redirect") : (d.andere_domain ? "{n} redirects, to another domain" : "{n} redirects"), { n: fmt(n) });
      case "A3": return isArr(d.treffer) ? (d.treffer.length ? str(d.treffer.map(str).join(", ")).slice(0, 120) : tl("Nothing detected")) : "";
      case "A4": l = isArr(d.varianten) ? d.varianten : []; if (!l.length) return "";
        n = l.filter(function (v) { return v && v.gleicher_body === true && v.gleicher_status === true; }).length;
        return satzMit("Same response for {x} of {n} requests", { x: fmt(n), n: fmt(l.length) });
      case "B1": m = obj(d.profile) || {}; l = Object.keys(m); if (!l.length) return "";
        n = l.filter(function (k) { var e = ((m[k] || {}).ergebnisse || [])[0]; return e && e.entscheidung === "allowed"; }).length;
        return satzMit("{x} of {n} platforms allowed", { x: fmt(n), n: fmt(l.length) });
      case "B2": l = isArr(d.dateien) ? d.dateien : []; if (!l.length) return "";
        return num(l[0].sitemaps) ? satzMit(l[0].sitemaps === 1 ? "HTTP {status}, 1 sitemap listed" : "HTTP {status}, {n} sitemaps listed", { status: str(l[0].status), n: fmt(l[0].sitemaps) })
          : "HTTP " + str(l[0].status);
      case "C1": m = obj(d.profile) || {}; return Object.keys(m).length ? tl("Checked for Google and Bing") : "";
      case "C2": return obj(d.profile) ? tl("No nosnippet, max-snippet or data-nosnippet") : "";
      case "C3": return isArr(d.roh) && isArr(d.gerendert) ? tl(d.roh.length || d.gerendert.length ? "Different before and after rendering" : "Same before and after rendering") : "";
      case "D1": n = num(d.zeichen); m = obj(d.anzahl) || {};
        if (n == null) return "";
        return satzMit(num(m.article) ? (m.article === 1 ? "{n} characters in 1 article element" : "{n} characters in {m} article elements")
          : num(m.main) ? "{n} characters in the main element" : "{n} characters", { n: fmt(n), m: fmt(m.article) });
      case "D2": return num(d.numerator) != null && num(d.denominator) ? satzMit("{x} of {n} characters in the initial HTML", { x: fmt(d.numerator), n: fmt(d.denominator) }) : "";
      case "D3": return isArr(d.ueberlagerungen) ? tl(d.ueberlagerungen.length || num(d.passwortfelder) ? "Overlay or password field found" : "No overlays, paywalls or password fields") : "";
      case "E1": l = (isArr(d.html) && d.html.length ? d.html : isArr(d.gerendert) ? d.gerendert : []);
        return l.length && obj(l[0]) && str(l[0].aufgeloest) ? "Canonical " + str(l[0].aufgeloest).slice(0, 120) : (isArr(d.html) ? tl("No canonical tag") : "");
      case "F1": return str(d.html_lang) ? (num(d.hreflang) ? satzMit(d.hreflang === 1 ? "{lang}, 1 hreflang variant" : "{lang}, {n} hreflang variants", { lang: str(d.html_lang), n: fmt(d.hreflang) }) : str(d.html_lang)) : "";
      case "F2": m = obj(d.jsonld) || {}; l = [];
        if (str(d.titel)) l.push(tl("title")); if (d.beschreibung) l.push(tl("description")); if (d.h1_roh) l.push("H1");
        if (num(m.bloecke)) l.push(satzMit(m.bloecke === 1 ? "1 JSON-LD block" : "{n} JSON-LD blocks", { n: fmt(m.bloecke) }));
        return l.length ? l.join(", ").replace(/^./, function (c) { return c.toUpperCase(); }) : "";
      case "F3": return num(d.required) != null ? satzMit("{x} of {n} measurements", { x: fmt(d.satisfied), n: fmt(d.required) }) : "";
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
