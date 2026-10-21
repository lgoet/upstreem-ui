/* upstreem page-audit.js -- die Seite Page Audit (21.10.). Praefix upa.

   Eine technische Pruefung EINER oeffentlichen URL: kommen die sieben KI-Suchen an die Seite und
   ihren Text heran? Die Seite rechnet nichts selbst -- jede Zahl und jede Aussage kommt aus den
   RPCs (bubble/page_audit_21_10/sql/02_rpcs_v1.sql), die Saetze zu den Schluesseln aus
   page-audit-data.js. Kein Score: die Hauptzahl ist "Reachable for x of 7" (Plan 2).

   ZWEI ZUSTAENDE, eine Komponente (wie Impact):
     ?view=audits                          Liste: eine Zeile je Seite, die eine Leiste, Seiten
     ?view=audits&page_id=<uuid>[&run_id]  Detail mit Krumen "Page Audit > <Seite>", kein Modal
   Die Adresse fuehrt: die Seite schreibt page_id selbst (pushState), Zurueck im Browser fuehrt
   zurueck, und von aussen oeffnet window.upstreemPageAuditOpen(pageId) (core.js, pageAuditOeffnen).

   DATENWEGE (direkt an Supabase mit UC.rpc, Login des Nutzers):
     list_page_audits_v1           Liste (Suche, Sortierung, Seiten in der DB; meta.quota, meta.schedule_capacity)
     get_page_audit_v1             Detail (Seite, Laeufe, gewaehlter Lauf mit Vergleich)
     create_page_audit_v1          Create Audit, Run again (je Absenden ein p_idempotency_key)
     set_page_audit_schedule_v1    Once, Weekly, Monthly
     cancel_page_audit_v1          Cancel run
     delete_page_audit_v1          Delete audit
   Die Meldung "Audit updated" (list/mark_page_audit_notices) steht in core -- sie gehoert auf
   jede Seite, diese Datei laedt nur mit ihrer Ansicht.

   LAEUFT EIN AUDIT (queued, running), laedt die Seite leise nach: das Detail 2 s lang in den ersten
   20 s nach der Annahme, danach alle 5 s; die Liste alle 5 s, solange eine Zeile laeuft (HANDOFF 16).
   Nur, solange die Seite zu sehen ist. Kein Skelett dabei: das gibt es nur beim ersten Laden.

   Was fehlt, sagt die Oberflaeche ausdruecklich (CLAUDE.md 2): unlesbare Antwort -> Lesefehler,
   keine Audits -> Leerzustand, noch nicht da -> Skelett. Die drei sehen nie gleich aus. */
(function () {
  "use strict";

  function upaBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemPageAuditDaten) {
      if (triesLeft > 0) { setTimeout(function () { upaBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[page-audit] core.js oder page-audit-data.js nicht geladen");
      return;
    }
    upaStart();
  }

  function upaStart() {
  var UC = window.UpstreemCore, D = window.UpstreemPageAuditDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  var STORE = (window.__upaStore = window.__upaStore || {});

  /* Laut sagen, WAS fehlt -- der Name des Kits zeigt auf den veralteten Stand von core. */
  var FEHLT = ["rpc", "makeColumns", "makeSearch", "makePager", "makeHeadSort", "makeSticky", "makePageCrumbs",
               "makeModal", "toast", "leerHtml", "leseFehlerHtml", "skeletonRows", "kpiKarte", "makePopover", "pageAuditOeffnen", "pageAuditFehlerSatz"]
    .filter(function (k) { return typeof UC[k] !== "function"; });
  if (FEHLT.length && window.console) console.error("[page-audit] Die core.js ist aelter als page-audit.js, es fehlen: " + FEHLT.join(", "));

  /* Deutsch fuer das Geruest der Seite (Katalog app-weit: nur Schluessel, die core nicht schon traegt).
     Die langen Saetze der Befunde bleiben vorerst englisch -- offen in der Uebergabe. */
  if (UC.addMessages) UC.addMessages("de", {
    "Page Audit": "Page Audit",
    "Check whether AI search platforms can technically reach a page.": "Prüfe, ob KI-Suchen eine Seite technisch erreichen können.",
    "Create Audit": "Audit erstellen",
    "{used} of {n} audits this week": "{used} von {n} Audits diese Woche",
    "Search audits…": "Audits durchsuchen…",
    "Search audits": "Audits durchsuchen",
    /* "Reachable", "{x} of {n}" und die Status-Woerter stehen in core (mit Impact geteilt). */
    "Restrictions": "Sperren", "Issues": "Probleme", "Last audit": "Letztes Audit",
    "Schedule": "Zeitplan", "Result": "Ergebnis",
    "Once": "Einmalig", "Weekly": "Wöchentlich", "Monthly": "Monatlich",
    "Next {date}": "Nächstes {date}",
    "No audits yet": "Noch keine Audits",
    "Audit a page to see whether AI search platforms can reach it.": "Prüfe eine Seite, um zu sehen, ob KI-Suchen sie erreichen.",
    "No audit matches your search": "Kein Audit passt zu deiner Suche",
    "Try a shorter search term.": "Versuche einen kürzeren Suchbegriff.",
    "Clear search": "Suche leeren",
    "Restriction detected": "Sperre gefunden", "Potential issue": "Mögliches Problem",
    "No obstacle found": "Kein Hindernis gefunden", "Inconclusive": "Nicht eindeutig",
    "Run again": "Erneut prüfen", "Cancel run": "Lauf abbrechen", "Cancelling…": "Wird abgebrochen…",
    "Delete Audit": "Audit löschen", "Open page": "Seite öffnen",
    "Audit started": "Audit gestartet", "This page is already being audited": "Diese Seite wird schon geprüft",
    "Audit deleted": "Audit gelöscht", "Schedule updated": "Zeitplan geändert", "Audit cancelled": "Audit abgebrochen",
    "Stopping the audit…": "Audit wird gestoppt…",
    "Platforms": "Plattformen", "Findings": "Befunde", "Runs": "Läufe", "Checks": "Checks",
    "Measurements": "Messwerte", "Evidence": "Belege", "Run details": "Details zum Lauf",
    "Tracked by your team": "Von deinem Team getrackt", "Other platforms": "Weitere Plattformen",
    "Not reachable": "Nicht erreichbar", "Not confirmed": "Nicht bestätigt",
    "Potential issues": "Mögliche Probleme", "Coverage": "Abdeckung",
    "First run": "Erster Lauf", "Persistent": "Bleibt", "New": "Neu", "Rules updated": "Regeln aktualisiert",
    "Not comparable": "Nicht vergleichbar", "Resolved": "Behoben",
    "Next step": "Nächster Schritt", "What this doesn't show": "Was das nicht zeigt",
    "Passed": "Bestanden", "Finding": "Befund", "Not measured": "Nicht gemessen", "Not applicable": "Nicht anwendbar",
    "Not supported": "Nicht unterstützt", "Measurement error": "Messfehler",
    "Manual": "Manuell", "Scheduled": "Geplant",
    "Previous run": "Voriger Lauf", "Change": "Veränderung", "Value": "Wert", "Measurement": "Messung",
    "Platform": "Plattform", "Access": "Zugang", "Request": "Abruf", "Status": "Status", "Size": "Größe",
    "Time": "Zeit", "Raw data": "Rohdaten", "Date": "Datum", "Trigger": "Auslöser", "Check": "Check"
  });

  /* ---- Kleine Helfer ------------------------------------------------------------------------- */
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  function sichtbar(el) { return el.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(el)); }
  function beiSicht(el, schl, fn, test, o) { if (UC.beiSicht) UC.beiSicht(el, schl, fn, test, o); else fn(); }
  function messbar(el) { return !UC.messbar || UC.messbar(el); }
  /* Host ohne www und der Pfad -- so steht eine Seite in Zeilen und Krumen. */
  function kurz(u) {
    var s = str(u).trim();
    try {
      var x = new URL(s);
      var p = (x.pathname || "/") + (x.search || "");
      return x.hostname.replace(/^www\./i, "") + (p === "/" ? "" : p.replace(/\/$/, ""));
    } catch (e) { return s.replace(/^https?:\/\//i, ""); }
  }
  function sicherHref(u) { var s = str(u).trim(); return /^https?:\/\//i.test(s) ? s : ""; }
  /* Datum mit Uhrzeit: das Datum im Format des Nutzers (UC.fmtDate), die Uhrzeit dazu -- fuer Laeufe
     am selben Tag ist sie die eigentliche Auskunft. */
  function zeit(v) {
    var d = new Date(str(v));
    if (!str(v) || isNaN(d.getTime())) return "–";
    function z(n) { return String(n).padStart(2, "0"); }
    return UC.fmtDate(v) + ", " + z(d.getHours()) + ":" + z(d.getMinutes());
  }
  function wann(v) {
    var d = new Date(str(v));
    if (!str(v) || isNaN(d.getTime())) return "–";
    return Date.now() - d.getTime() < 86400000 ? (UC.relativeTime ? UC.relativeTime(v) : zeit(v)) : UC.fmtDate(v);
  }
  function fmtInt(v) { return UC.fmtInt ? UC.fmtInt(v) : String(v); }
  function von(x, n) { return t("{x} of {n}").replace("{x}", x == null ? "–" : fmtInt(x)).replace("{n}", n == null ? "–" : fmtInt(n)); }

  /* Zeichen + Text in der Farbe der Bedeutung (ton: pos, neg, warn, leise). KEINE Punkt-Pille
     (Memory "Keine Punkt-Pillen"): eine Angabe mit Zeichen, ohne Rahmen und ohne Flaeche. */
  function zustandHtml(z, o) {
    o = o || {};
    if (!z) return '<span class="up-num is-empty">–</span>';
    return '<span class="upa-zustand is-' + esc(z.ton || "leise") + (z.dreht ? " is-dreht" : "") + (o.klasse ? " " + o.klasse : "") + '"' +
      (o.tip ? ' data-tip="' + esc(o.tip) + '"' : '') + '>' +
      '<span class="upa-zustand-ic" aria-hidden="true">' + UC.icon(z.zeichen, 2) + '</span>' +
      '<span class="upa-zustand-t">' + esc(t(z.text)) + '</span></span>';
  }
  function ergebnisHtml(a, o) { return zustandHtml(D.ERGEBNIS[a] || null, o); }
  function statusHtml(s, o) { return zustandHtml(D.STATUS[s] || null, o); }
  /* Die Veraenderung zum vorigen Lauf als leise Marke (core .up-marke.is-leise), "New" und
     "Resolved" in der Farbe der Bedeutung -- Text, kein Punkt. */
  function aenderungHtml(c) {
    var a = D.AENDERUNG[c];
    if (!a) return "";
    return '<span class="up-marke is-leise upa-marke is-' + a.ton + '" data-tip="' + esc(t(a.tip)) + '">' + esc(t(a.text)) + '</span>';
  }
  /* Das Favicon der Seite (google.com/s2 wie ueberall, UC.faviconUrl); ohne Bild der Globus (.up-fav). */
  function seitenLogo(url, gross) {
    var f = UC.faviconUrl ? UC.faviconUrl(url, 64) : "";
    return '<span class="up-logo-box up-fav' + (f ? " has-img" : "") + (gross ? " upa-logo-gross" : "") + '">' +
      (f ? '<img src="' + esc(f) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>' : '') +
      '<span class="up-logo-ltr">' + esc((kurz(url).charAt(0) || "?").toUpperCase()) + '</span></span>';
  }
  /* Das Zeichen einer Plattform: getrackt das Logo aus dem Modell-Store, sonst das Favicon ihrer Domain. */
  function plattformLogo(p, modell) {
    var src = "";
    if (modell && modell.logo_url) src = UC.modelLogoUrl ? UC.modelLogoUrl(modell.key, modell.logo_url, undefined, modell.provider) : modell.logo_url;
    if (src && src.indexOf("//") === 0) src = "https:" + src;
    if (!src && p.domain && UC.faviconUrl) src = UC.faviconUrl(p.domain, 64);
    return '<span class="up-logo-box upa-plogo' + (src ? " has-img" : "") + '">' +
      (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' + (modell ? ' data-up-logo-thema' : '') + '/>' : '') +
      '<span class="up-logo-ltr">' + esc(p.name.charAt(0)) + '</span></span>';
  }
  function modellVon(p) {
    var l = [];
    try { l = (UC.getModels && UC.getModels()) || []; } catch (e) {}
    for (var i = 0; i < l.length; i++) {
      var m = l[i];
      if (m && m.is_active !== false && D.modellPasst(p, m.key || m.model)) return m;
    }
    return null;
  }
  function sekKopf(titel, unter, rechts) {
    return '<div class="up-sec-head upa-sec-head"><div class="up-sec-titles">' +
      '<span class="up-heading up-sec-h">' + esc(t(titel)) + '</span>' +
      (unter ? '<span class="up-sec-sub">' + esc(t(unter)) + '</span>' : '') +
      '</div>' + (rechts || '') + '</div>';
  }

  function initRoot(root) {
    if (root.__upaCtrl) return root.__upaCtrl;
    var instanceId = str(root.getAttribute("data-instance")).trim() || "audits_page";
    if (instanceId === "INSTANCE_ID") return null;
    var gem = STORE[instanceId] || (STORE[instanceId] = {});
    function isDark() { return root.getAttribute("data-theme") === "dark" || (UC.getUpstreemTheme && UC.getUpstreemTheme() === "dark"); }

    /* Der Stand fuer einen Neuaufbau (Themenwechsel baut die Wurzel neu, Memory "Themenwechsel =
       Neuaufbau"): Liste, Suche, Seite, Sortierung und das zuletzt gezeigte Detail. */
    var L = gem.liste || (gem.liste = { query: "", sort: "last_run", dir: "desc", page: 1, pageSize: UC.DEFAULT_PAGE_SIZE || 15,
                                        daten: null, fehler: "", hatDaten: false, alt: true });
    var DET = gem.detail || (gem.detail = {});
    var state = { ansicht: "liste", pageId: "", runId: "", offen: gem.offen || (gem.offen = {}), profilOffen: gem.profilOffen || (gem.profilOffen = {}), alleLaeufe: false };

    root.classList.add("up-sidebar-clear");
    root.innerHTML =
      '<div class="up-ph-top upa-pagehead">' +
        '<div class="up-ph-left">' +
          '<h1 class="up-ph-heading">' + esc(t("Page Audit")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("Check whether AI search platforms can technically reach a page.")) + '</p>' +
        '</div>' +
        '<div class="upa-kopfrechts"></div>' +
      '</div>' +
      /* Reiter des Details (Variante B der Leinwand, 21.10. gewaehlt): core makePageNav, nur sichtbar,
         wenn ein Ergebnis da ist -- ein wartender Lauf hat nichts, das sich aufteilen liesse. */
      '<div class="up-ph-nav upa-nav" role="tablist" hidden></div>' +
      '<div class="upa-main">' + startGeruest() + listeGeruest() + '<div class="upa-detail" hidden></div></div>';
    var elKopf = root.querySelector(".upa-kopfrechts");
    var elListe = root.querySelector(".upa-liste"), elDetail = root.querySelector(".upa-detail");
    var elStart = root.querySelector(".upa-start"), elNav = root.querySelector(".upa-nav");
    var tips = UC.makeTooltips ? UC.makeTooltips(root, isDark) : null;
    UC.widthTiers(root);

    var krumen = UC.makePageCrumbs(root, {
      icon: "dna01", name: "Page Audit", komponente: true,
      klick: function () { zurListe(true); },
      klickWenn: function () { return state.ansicht === "detail"; },
      stufen: function () {
        if (state.ansicht !== "detail") return [];
        var d = dasDetail(), p = d && d.page;
        return [{ name: p ? (p.title || kurz(p.url)) : "…" }];
      }
    });
    function krumenNeu() { if (krumen && krumen.zeichnen) krumen.zeichnen(); }
    /* Reiter des Details: Overview (Ergebnis, Plattformen, Befunde), Checks, Evidence (Messwerte und
       Abrufe), Runs (Verlauf und Details zum Lauf). Gemerkt je Instanz, ueber einen Neuaufbau hinweg. */
    var REITER = [
      { value: "overview", label: "Overview", icon: UC.icon("dashboardSquare", 2) },
      { value: "checks", label: "Checks", icon: UC.icon("listTodo", 2) },
      { value: "evidence", label: "Evidence", icon: UC.icon("fileText", 2) },
      { value: "runs", label: "Runs", icon: UC.icon("clock", 2) }
    ];
    function reiter() { var r = gem.reiter; return REITER.some(function (x) { return x.value === r; }) ? r : "overview"; }
    var nav = UC.makePageNav ? UC.makePageNav(root, { nav: elNav, storeKey: instanceId + "|upa-nav", selected: reiter(), pages: REITER,
      onSelect: function (v) { gem.reiter = v; detailZeichnen(); } }) : null;
    function reiterSetzen(v) { gem.reiter = v; if (nav) nav.selectPage(v, false); }
    var auftritt = UC.makeAuftritt ? UC.makeAuftritt(root, { kopf: ":scope > .up-ph-top", inhalt: ":scope > .upa-main" }) : null;
    var auftrittDa = false;
    function auftrittBereit() { if (!auftrittDa && auftritt) { auftrittDa = true; auftritt.bereit(); } }

    /* ============================================================================================
       Liste
       ============================================================================================ */
    /* Die Spalten nach der Mitte (UC.makeColumns; die erste ist "page"). art bestimmt, was bei
       Platzmangel zuerst weicht (SPALTEN_ART in core): Reachable ist die Hauptzahl und weicht nie. */
    var SPALTEN = [
      /* Mindestbreiten am Inhalt gemessen (14/500): "Restriction detected" mit Zeichen 160, "6 of 7" mit
         Trend im festen Platz 66 + 12 Abstand 120, "21. Oct 2026" bzw. "3 minutes ago" 128. */
      { key: "result", label: "Result", w: "minmax(160px, 1fr)", min: 160, art: "kpi" },
      { key: "reachable", label: "Reachable", w: "minmax(120px, 0.8fr)", min: 120, art: "anteil" },
      { key: "restrictions", label: "Restrictions", w: "minmax(118px, 0.7fr)", min: 118, art: "zaehl" },
      { key: "issues", label: "Issues", w: "minmax(88px, 0.6fr)", min: 88, art: "zaehl" },
      { key: "last", label: "Last audit", w: "minmax(128px, 0.9fr)", min: 128, art: "datum" },
      { key: "schedule", label: "Schedule", w: "minmax(120px, 0.8fr)", min: 120, art: "typ" }
    ];
    /* Sortierbar ist, was der Vertrag kennt. "issues" sortiert nach Sperren und dann Problemen
       (restriction_count * 1000 + issue_count) -- darum steht der Schluessel an Restrictions; einen
       eigenen fuer Issues gibt es nicht (Vertragswunsch in der Uebergabe). */
    var SORT_SPALTE = { page: "url", result: "status", reachable: "reachable", restrictions: "issues", last: "last_run", schedule: "next_run" };
    var ZYKLEN = { url: ["url:asc", "url:desc"], status: ["status:desc", "status:asc"], reachable: ["reachable:desc", "reachable:asc"],
                   issues: ["issues:desc", "issues:asc"], last_run: ["last_run:desc", "last_run:asc"], next_run: ["next_run:asc", "next_run:desc"] };

    /* ---- Startbereich (Leinwand "Page Audit UI", Version 9, 21.10. gewaehlt) ------------------------
       Links oben Ueberschrift und ein Satz, OHNE Karte, kurz und ausdruecklich technisch (Nachtrag Lukas:
       "technischer Audit, nicht inhaltlich"); darunter die Auswahlkarte aus core (UC.wkKarteHtml, kompakt,
       160 hoch), ein Klick oeffnet Create Audit. Rechts ueber beide Zeilen die Grafik (Vorlage: Vercels
       Feld aus Browserfenstern). Nur in der Liste. */
    /* Drei Kaskaden zu je 18 Fenstern (120 x 84, je Schritt 16 nach rechts und 32 nach unten, Kaskaden 168
       auseinander), Masse wie im Vorbild. Eines ist hervorgehoben (das Zeichen der Pruefung), die zwei Fenster
       dahinter fehlen, damit es frei steht; seine Mitte liegt auf der Mitte der Flaeche. Erscheinen gestaffelt
       um 18 ms wie im Vorbild; ohne Bewegung bei reduzierter Bewegung (page-audit.css). */
    /* (Die Werte stehen in den Funktionen: startGeruest laeuft schon beim Aufbau der Wurzel, vor den
       var-Zuweisungen dieses Abschnitts.) */
    function fensterHtml() {
      var f = { w: 120, h: 84, dx: 16, dy: 32, spalte: 168, n: 18, hl: [1, 4], weg: ["1|5", "1|6"] }, h = "";
      for (var c = 0; c < 3; c++) for (var i = 0; i < f.n; i++) {
        if (f.weg.indexOf(c + "|" + i) >= 0) continue;
        var hl = c === f.hl[0] && i === f.hl[1];
        h += '<div class="upa-fenster-win' + (hl ? " is-hl" : "") + '" style="left:' + (c * f.spalte + i * f.dx) + 'px;top:' + (i * f.dy) + 'px;animation-delay:' + (i * 18) + 'ms">' +
          '<span class="upa-fenster-punkte"><i></i><i></i><i></i></span>' +
          (hl ? '<span class="upa-fenster-ic">' + UC.icon("scanSearch", 1.8) + '</span>' : '') + '</div>';
      }
      var mx = f.hl[0] * f.spalte + f.hl[1] * f.dx + f.w / 2, my = f.hl[1] * f.dy + f.h / 2;
      return '<div class="upa-fenster" aria-hidden="true"><div class="upa-fenster-feld" style="transform:translate(' + (-mx) + 'px,' + (-my) + 'px)">' + h + '</div></div>';
    }
    function startGeruest() {
      var START = { titel: "Technical page audit",
        unter: "A technical check of one URL for AI search platforms (response, robots.txt, directives, text in the initial HTML), not a review of its content." };
      return '<section class="upa-start">' +
        '<div class="upa-start-text"><h2 class="up-heading up-sec-h">' + esc(t(START.titel)) + '</h2><p class="up-sec-sub">' + esc(t(START.unter)) + '</p></div>' +
        (UC.wkKarteHtml ? UC.wkKarteHtml({ titel: "Run Page Audit", satz: "Enter one URL and see whether seven AI search platforms can reach it",
          icon: "dna01", invers: true, kompakt: true, klasse: "upa-startkarte", daten: { "upa-anlegen": "" } }) : '') +
        fensterHtml() +
      '</section>';
    }

    function listeGeruest() {
      /* Die eine Leiste (STYLEGUIDE 8b) wie Brands und Teams: der Kopf der Tabelle traegt rechts Suche
         und Table Settings, er klebt (makeSticky), Gesamtzeile und Pagination kleben unten
         (data-kleb-fuss). Links gibt es nichts, was die Daten aendert -- der Vertrag kennt nur die Suche. */
      return '<section class="up-root upa-liste" data-flach="yes" data-leiste="yes" data-kleb-fuss="yes" data-sticky-top="16" data-instance="' + esc(instanceId + "_liste") + '">' +
        '<div class="up-head upa-head">' +
          '<div class="up-leiste-scope upa-scope"></div>' +
          '<div class="up-head-tools">' +
            '<div class="up-search upa-suche">' +
              '<button type="button" class="up-iconbtn up-search-btn" aria-label="' + esc(t("Search")) + '" data-tip="' + esc(t("Search")) + '">' + UC.icon("search", 2) + '</button>' +
              '<div class="up-search-box">' +
                '<input class="up-search-input" type="text" placeholder="' + esc(t("Search audits…")) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(t("Search audits")) + '" maxlength="200"/>' +
                '<button type="button" class="up-search-clear" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2.2) + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="up-cols">' +
              '<button type="button" class="up-iconbtn up-cols-btn" data-tip="' + esc(t("Table Settings")) + '" aria-label="' + esc(t("Table settings")) + '">' +
                UC.icon("settings", 2) + '<span class="up-badge upa-cols-badge"></span></button>' +
              '<div class="up-menu up-cols-menu" role="menu" aria-hidden="true"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="up-box upa-box"><div class="up-table" role="table" data-table></div></div>' +
        '<div class="up-foot">' +
          '<div class="up-pagesize"><span class="up-pagesize-lbl">' + esc(t("Rows per page")) + '</span>' +
            '<div class="up-pagesize-seg" role="group" aria-label="' + esc(t("Rows per page")) + '"></div></div>' +
          '<div class="up-pager"></div>' +
        '</div>' +
      '</section>';
    }

    var elTable = elListe.querySelector("[data-table]");
    var elSuche = elListe.querySelector(".upa-suche"), elSucheIn = elListe.querySelector(".up-search-input");
    var lst = { query: L.query, page: L.page, pageSize: L.pageSize, sortField: L.sort, sortDir: L.dir, loading: false, cols: {}, widths: {} };
    UC.widthTiers(elListe);

    var colsKit = UC.makeColumns({
      root: elListe, state: lst, columns: SPALTEN, storePrefix: "upa", instanceId: instanceId,
      /* firstShare 0.24 statt der 30 % aus core: die Seite ist eine Adresse, keine Ueberschrift --
         bei 1158 (1440 mit Seitenleiste) wich mit 30 % schon "Last audit". */
      firstKey: "page", firstMin: 260, firstShare: 0.24, noActions: true,
      badgeSel: ".upa-cols-badge", cellPrefixes: ["up", "upa", "up-sum"],
      nachspann: function () { return zaehl ? zaehl.schalter() : null; },
      onChange: function () { tabelleZeichnen(); }
    });
    lst.cols = colsKit.readCols(); lst.widths = colsKit.readWidths();
    elListe.addEventListener("pointerdown", function (e) { var g = e.target.closest(".up-grip"); if (g) colsKit.startResize(e, g); });
    var elColsMenu = elListe.querySelector(".up-cols-menu");
    var colsPop = UC.makePopover({ wrap: elListe.querySelector(".up-cols"), menu: elColsMenu, opener: elListe.querySelector(".up-cols-btn"), group: "upa-" + instanceId });
    elColsMenu.addEventListener("click", function (e) {
      if (e.target.closest("[data-colsall]")) { colsKit.selectAllCols(); colsKit.populateCols(); return; }
      var row = e.target.closest("[data-col]");
      if (!row) return;
      colsKit.toggleCol(row.getAttribute("data-col")); colsKit.populateCols();
    });
    elListe.querySelector(".up-cols-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      if (colsPop.isOpen()) { colsPop.close(false); return; }
      colsKit.populateCols(); colsPop.open();
    });

    /* Suche in der DB (p_query ueber URL und Titel), Entprellung und Mindestlaenge aus core
       (Memory "Suche nur mit Kern-Vorgaben"). */
    var suche = UC.makeSearch({
      root: elListe, box: elSuche, input: elSucheIn, state: lst, prefix: "upa", mobileMax: 560,
      onRender: function () {},
      onFire: function (p) {
        var q = str(p.query).trim();
        if (q === L.query) return;
        L.query = q; L.page = 1; lst.page = 1;
        listeLaden({ leise: false });
      },
      persist: function () {}
    });
    elSucheIn.addEventListener("input", function () { suche.onInput(); });
    elSucheIn.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); suche.toggle(); } });
    elListe.querySelector(".up-search-btn").addEventListener("click", function (e) { e.stopPropagation(); colsPop.close(false); suche.toggle(); });
    elListe.querySelector(".up-search-clear").addEventListener("click", function (e) {
      e.stopPropagation();
      if (elListe.classList.contains("is-searchtakeover")) { suche.toggle(); return; }
      sucheLeeren();
      try { elSucheIn.focus(); } catch (e2) {}
    });
    function sucheLeeren() {
      elSucheIn.value = ""; lst.query = ""; elSuche.classList.remove("has-text"); suche.cancel();
      if (L.query) { L.query = ""; L.page = 1; lst.page = 1; listeLaden({ leise: false }); }
    }
    if (L.query) { elSucheIn.value = L.query; elSuche.classList.add("is-open", "has-text"); suche.syncTakeover(); }

    var pager = UC.makePager({
      root: elListe, state: lst,
      total: function () { var m = L.daten && L.daten.meta; return m && m.total != null ? m.total : 0; },
      onChange: function () { L.page = lst.page; L.pageSize = lst.pageSize; listeLaden({ leise: false }); },
      onClamp: function () { L.page = lst.page; listeLaden({ leise: false }); }
    });
    var kopfSort = UC.makeHeadSort({
      root: elListe, state: lst, cycles: ZYKLEN, defaultSort: { field: "last_run", dir: "desc" },
      onSort: function (feld, dir) {
        lst.sortField = feld; lst.sortDir = dir; L.sort = feld; L.dir = dir; L.page = 1; lst.page = 1;
        kopfSort.syncHeadSorters(); listeLaden({ leise: false });
      }
    });
    elListe.addEventListener("click", function (e) {
      if (e.target.closest(".up-grip")) return;
      var ps = e.target.closest("[data-pagesize]");
      if (ps) { pager.setPageSize(Number(ps.getAttribute("data-pagesize"))); return; }
      if (e.target.closest(".up-page-prev")) { pager.goToPage(lst.page - 1); return; }
      if (e.target.closest(".up-page-next")) { pager.goToPage(lst.page + 1); return; }
      var pg = e.target.closest(".up-page[data-page]");
      if (pg) { pager.goToPage(Number(pg.getAttribute("data-page"))); return; }
      var so = e.target.closest(".up-th.is-sortable[data-sort]");
      if (so) { kopfSort.headSortClick(so.getAttribute("data-sort")); return; }
      if (e.target.closest("[data-upa-anlegen]")) { anlegenOeffnen(); return; }
      if (e.target.closest("[data-upa-suche-weg]")) { sucheLeeren(); return; }
      var z = e.target.closest(".up-row[data-page-id]");
      if (z && !e.target.closest("a")) detailOeffnen(z.getAttribute("data-page-id"), "", true);
    });
    elListe.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var so = e.target.closest && e.target.closest(".up-th.is-sortable[data-sort]");
      if (so) { e.preventDefault(); kopfSort.headSortClick(so.getAttribute("data-sort")); return; }
      var z = e.target.closest && e.target.closest(".up-row[data-page-id]");
      if (z && e.target === z) { e.preventDefault(); detailOeffnen(z.getAttribute("data-page-id"), "", true); }
    });

    if (elStart) elStart.addEventListener("click", function (e) { if (e.target.closest("[data-upa-anlegen]")) anlegenOeffnen(); });

    var kleber = UC.makeSticky(elListe, elListe.querySelector(".up-head"));
    function kleben() { if (state.ansicht === "liste" && kleber) kleber.applySticky(); }
    if (UC.aufResize) UC.aufResize(kleben); else window.addEventListener("resize", UC.rafThrottle ? UC.rafThrottle(kleben) : kleben);
    UC.onResize(elListe, function () { colsKit.applyCols(); });

    /* Die Gesamtzeile wie Teams und Brands: links die Anzahl (meta.total_count, also ueber ALLE
       Seiten der Suche). Berechnungen gibt es keine -- die Liste kommt seitenweise, eine Summe ueber
       die gezeigte Seite waere falsch, und der Vertrag hat keine Summenabfrage. */
    var zaehl = UC.makeZaehlZeile ? UC.makeZaehlZeile({
      root: elListe, nach: elTable, instanceId: instanceId, praefix: "upa",
      cols: function () { return colsKit; }, rechnen: {},
      spalten: function () { return SPALTEN.map(function (c) { return c.key; }); },
      anzahl: function () { return L.fehler ? null : (L.hatDaten && L.daten && L.daten.meta.total != null ? L.daten.meta.total : null); },
      laedt: function () { return !L.hatDaten && !L.fehler; }
    }) : null;

    function kopfZelle(key, label) {
      var sort = SORT_SPALTE[key];
      return '<div class="up-th up-th-' + key + (sort ? " is-sortable" : "") + '" role="columnheader"' +
        (sort ? ' data-sort="' + sort + '" tabindex="0"' : '') + '>' +
        (sort && UC.thSortHtml ? UC.thSortHtml(sort, lst.sortField === sort, lst.sortDir) : '') +
        '<span class="up-th-txt">' + esc(t(label)) + '</span></div>';
    }
    function kopfHtml() {
      var h = '<div class="up-thead" role="row">' + kopfZelle("page", "Page");
      colsKit.visibleCols().forEach(function (c) { h += kopfZelle(c.key, c.label); });
      return h + '</div>';
    }
    function skelett(n) {
      return UC.skeletonRows({ count: n, cols: [
        { w: 150, jitter: 30, logo: true, cls: "up-td-page" },
        { w: 110, cls: "up-td-result" }, { w: 46, cls: "up-td-reachable", zahl: true },
        { w: 18, cls: "up-td-restrictions", zahl: true }, { w: 18, cls: "up-td-issues", zahl: true },
        { w: 80, cls: "up-td-last" }, { w: 60, cls: "up-td-schedule" }
      ] });
    }
    function zelleHtml(key, r) {
      var re = r.result, la = r.latest, laeuft = la && D.laeuft(la.status);
      if (key === "result") {
        if (re && re.assessment) return ergebnisHtml(re.assessment);
        if (laeuft) return statusHtml(la.status);
        if (la) return statusHtml(la.status);
        return '<span class="up-num is-empty">–</span>';
      }
      if (key === "reachable") {
        if (!re || re.reachable == null) return '<span class="up-num is-empty">–</span>';
        var tr = "";
        /* Veraenderung nur gegen ein vergleichbares Ergebnis: bei geaenderten Regeln keine Zahl
           (Plan 2: "Regeln aktualisiert" statt einer Aussage). */
        /* Und nur bei vollstaendiger Messung: ein Teillauf zeigt 0 of 7, weil nichts BESTAETIGT ist --
           das ist kein Rueckgang um 7 (HANDOFF 15.1: weniger durch fehlende Abdeckung ist keine
           Veraenderung). Ob der vorige Lauf vollstaendig war, sagt die Liste nicht (Vertragswunsch). */
        var voll = re.coverageRequired != null && re.coverageSatisfied === re.coverageRequired;
        if (voll && re.previousReachable != null && !re.rulesChanged && UC.trendChip) tr = UC.trendChip(re.reachable - re.previousReachable, {});
        return tr + '<span class="up-num"' + (re.rulesChanged ? ' data-tip="' + esc(t("Rules updated since the previous run, not compared.")) + '"' : '') + '>' +
          esc(von(re.reachable, re.profiles)) + '</span>';
      }
      if (key === "restrictions" || key === "issues") {
        var v = re ? (key === "restrictions" ? re.restrictions : re.issues) : null;
        return v == null ? '<span class="up-num is-empty">–</span>' : '<span class="up-num">' + esc(fmtInt(v)) + '</span>';
      }
      if (key === "last") {
        /* Laeuft ein Lauf neben einem Ergebnis, steht sein Status hier (das Ergebnis links ist das
           vorige); ohne Ergebnis steht der Status schon links, hier dann seine Startzeit. */
        if (laeuft && re) return statusHtml(la.status);
        if (laeuft) return '<span class="upa-zweizeilig"><span class="upa-z1">' + esc(wann(la.acceptedAt)) + '</span></span>';
        var wa = re && re.finishedAt ? re.finishedAt : (la ? (la.finishedAt || la.acceptedAt) : "");
        var spaeter = la && re && la.runId !== re.runId ? la.status : "";
        /* Lief der letzte Lauf ins Leere (failed, cancelled, skipped), steht das daneben: das
           Ergebnis links ist dann das vorige. */
        return '<span class="upa-zweizeilig"><span class="upa-z1">' + esc(wa ? wann(wa) : "–") + '</span>' +
          (spaeter && spaeter !== "completed" && spaeter !== "partial" ? '<span class="upa-z2">' + esc(t("Last run:")) + ' ' + esc(t((D.STATUS[spaeter] || {}).text || spaeter)) + '</span>' : '') + '</span>';
      }
      if (key === "schedule") {
        /* Einmalig ist kein Zeitplan: ein Minus aus core (.up-sumkeine, dasselbe Zeichen wie in der
           Gesamtzeile), der Tooltip sagt es (Leinwand, 21.10. gewaehlt). */
        if (r.schedule !== "weekly" && r.schedule !== "monthly") {
          var tipOnce = t("Not scheduled. Runs when you start it.");
          return '<span class="up-sumkeine" data-tip="' + esc(tipOnce) + '" aria-label="' + esc(tipOnce) + '">' + UC.icon("minus", 2) + '</span>';
        }
        var plan = D.PLAN[r.schedule] || "Once";
        return '<span class="upa-zweizeilig"><span class="upa-z1">' + esc(t(plan)) + '</span>' +
          (r.schedule !== "once" && r.nextRunAt ? '<span class="upa-z2">' + esc(t("Next {date}").replace("{date}", UC.fmtDate(r.nextRunAt))) + '</span>' : '') + '</span>';
      }
      return "";
    }
    function zeileHtml(r) {
      var name = r.title || kurz(r.url);
      var h = '<div class="up-row upa-zeile" role="row" tabindex="0" data-page-id="' + esc(r.id) + '" aria-label="' + esc(name) + '">' +
        '<div class="up-td up-td-page" role="cell">' + seitenLogo(r.url) +
          '<span class="upa-seite"><span class="up-zeilenname upa-name">' + esc(name) + '</span>' +
          (r.title ? '<span class="upa-url">' + esc(kurz(r.url)) + '</span>' : '') + '</span></div>';
      colsKit.visibleCols().forEach(function (c) { h += '<div class="up-td up-td-' + c.key + '" role="cell">' + zelleHtml(c.key, r) + '</div>'; });
      return h + '</div>';
    }
    function leerListeHtml() {
      if (L.fehler) return UC.leseFehlerHtml("audits", L.fehler === "unlesbar" ? "" : L.fehler);
      if (L.query) return UC.leerHtml({ gefiltert: true, was: "audits", titel: "No audit matches your search", text: "Try a shorter search term.", knopf: "Clear search", knopfAttr: "data-upa-suche-weg" });
      /* Ohne Knopf: die Karte "Run Page Audit" darueber ist der Start, sonst stuenden drei gleiche
         Aktionen untereinander (Kopf, Karte, Leerzustand). */
      return UC.leerHtml({ icon: "dna01", titel: "No audits yet", text: "Audits you create appear here." });
    }
    function tabelleZeichnen() {
      var kopf = kopfHtml();
      if (!L.hatDaten && !L.fehler) {
        elTable.innerHTML = kopf + '<div class="up-tbody">' + skelett(5) + '</div>';
      } else if (!L.daten || !L.daten.rows.length) {
        elTable.innerHTML = kopf + leerListeHtml();
      } else {
        elTable.innerHTML = kopf + '<div class="up-tbody" role="rowgroup">' + L.daten.rows.map(zeileHtml).join("") + '</div>';
      }
      colsKit.applyCols(); colsKit.syncColsBadge(); kopfSort.syncHeadSorters();
      elListe.classList.toggle("is-onepage", !L.hatDaten);
      lst.page = L.page; lst.pageSize = L.pageSize;
      pager.renderPageSize(); pager.renderPager();
      if (zaehl) zaehl.zeichnen();
      if (elListe.classList.contains("up-sticky") && kleber.syncTheadOffset) kleber.syncTheadOffset();
      kleben();
    }

    var listeNr = 0;
    function listeLaden(o) {
      o = o || {};
      if (!team()) return;
      var nr = ++listeNr;
      if (!o.leise) { L.hatDaten = false; L.fehler = ""; tabelleZeichnen(); }
      var a = D.liste(team(), { query: L.query, sort: L.sort, dir: L.dir, limit: L.pageSize, offset: (L.page - 1) * L.pageSize });
      UC.rpc(a.fn, a.params, { timeoutMs: 20000 }).then(function (erg) {
        if (nr !== listeNr) return;
        var d = erg && erg.ok ? D.zuListe(erg.daten) : null;
        if (!d) {
          if (window.console) console.warn("[page-audit] liste:", erg && erg.ok ? "Antwort ohne rows" : (erg && erg.fehler));
          /* Ein leises Nachladen, das scheitert, laesst die gezeigte Liste stehen -- der naechste
             Takt versucht es wieder. Nur das erste Laden zeigt den Fehler. */
          if (o.leise && L.daten) { planen(); return; }
          L.fehler = (erg && erg.ok) || !UC.fehlerSatzArt ? "unlesbar" : (UC.fehlerSatzArt(erg) || "unlesbar");
          L.daten = null;
        } else {
          var stand = standVon(erg.daten);
          /* Leise und unveraendert: die Zeilen bleiben stehen (Fokus, Hover, offene Menues). */
          if (o.leise && L.daten && L.stand === stand && !L.fehler) { L.alt = false; planen(); return; }
          L.daten = d; L.fehler = ""; L.stand = stand;
        }
        L.hatDaten = true; L.alt = false;
        tabelleZeichnen();
        kopfZeichnen();
        auftrittBereit();
        planen();
      });
    }

    /* ============================================================================================
       Kopf rechts: Kontingent und Create Audit (Liste) bzw. die Aktionen (Detail)
       ============================================================================================ */
    function quota() {
      var d = state.ansicht === "detail" ? dasDetail() : null;
      return (d && d.meta && d.meta.quota) || (L.daten && L.daten.meta && L.daten.meta.quota) || null;
    }
    function kapazitaet() {
      var d = state.ansicht === "detail" ? dasDetail() : null;
      return (d && d.meta && d.meta.capacity) || (L.daten && L.daten.meta && L.daten.meta.capacity) || null;
    }
    function kontingentHtml() {
      var q = quota();
      if (!q) return "";
      var k = kapazitaet();
      var tip = (q.resetsAt ? t("Resets on {date}.").replace("{date}", UC.fmtDate(q.resetsAt)) : "") +
        (k ? " " + t("Recurring audits: {used} of {n} weekly slots in use.").replace("{used}", D.fmtZahl(k.used)).replace("{n}", D.fmtZahl(k.capacity)) : "") +
        (q.trial ? " " + t("Trial: {n} audits per week.").replace("{n}", fmtInt(q.allowance)) : "");
      return '<span class="upa-kontingent' + (q.remaining <= 0 ? " is-voll" : "") + '" tabindex="0" data-tip="' + esc(tip.trim()) + '">' +
        esc(t("{used} of {n} audits this week").replace("{used}", fmtInt(q.used)).replace("{n}", fmtInt(q.allowance))) + '</span>';
    }
    var kopfStand = "";
    function kopfZeichnen() {
      /* Nur bei einer Aenderung neu: das leise Nachladen zeichnete sonst alle 2 s Knoepfe und Menues
         neu (ein offenes Menue ginge dabei zu). */
      var d0 = state.ansicht === "detail" ? dasDetail() : null, a0 = aktiverLauf(d0);
      var stand = state.ansicht + "|" + kontingentHtml() + "|" + (d0 && d0.page ? [d0.page.id, d0.page.schedule, d0.page.fetchUrl].join(",") : "") +
        "|" + (a0 ? a0.id + (a0.cancelRequested ? "!" : "") : "");
      if (stand === kopfStand && elKopf.firstChild) return;
      kopfStand = stand;
      if (state.ansicht === "liste") {
        elKopf.innerHTML = kontingentHtml() +
          '<button class="up-ph-addbtn up-export upa-anlegen" type="button" data-upa-anlegen>' + UC.icon("plus", 1.8) +
            '<span>' + esc(t("Create Audit")) + '</span></button>';
        return;
      }
      var d = dasDetail();
      if (!d || !d.page) { elKopf.innerHTML = ""; return; }
      var aktiv = aktiverLauf(d);
      var plan = D.PLAN[d.page.schedule] || "Once";
      elKopf.innerHTML =
        '<div class="up-sort upa-plan">' +
          '<button type="button" class="up-btn-sec upa-planknopf" aria-haspopup="menu" aria-label="' + esc(t("Schedule")) + '">' +
            UC.icon("calendar", 2) + '<span>' + esc(t(plan)) + '</span>' + UC.icon("chevronDown", 2) + '</button>' +
          '<div class="up-sort-menu upa-planmenu" role="menu" aria-hidden="true"></div>' +
        '</div>' +
        (aktiv
          ? '<button type="button" class="up-btn-sec upa-abbrechen"' + (aktiv.cancelRequested ? ' disabled' : '') + '>' + UC.icon("x", 2) +
              '<span>' + esc(t(aktiv.cancelRequested ? "Cancelling…" : "Cancel run")) + '</span></button>'
          : '<button type="button" class="up-btn-sec upa-nochmal">' + UC.icon("refreshCw", 2) + '<span>' + esc(t("Run again")) + '</span></button>') +
        '<div class="up-sort upa-mehr">' +
          '<button type="button" class="up-iconbtn upa-mehrknopf" aria-haspopup="menu" aria-label="' + esc(t("More")) + '" data-tip="' + esc(t("More")) + '">' + UC.icon("moreHorizontal", 2) + '</button>' +
          '<div class="up-sort-menu upa-mehrmenu" role="menu" aria-hidden="true">' +
            (sicherHref(d.page.fetchUrl) ? '<a class="up-pop-opt" role="menuitem" href="' + esc(sicherHref(d.page.fetchUrl)) + '" target="_blank" rel="noopener noreferrer"><span class="up-pop-opt-l">' + UC.icon("externalLink", 2) + '<span>' + esc(t("Open page")) + '</span></span></a>' : '') +
            '<div class="up-pop-opt upa-loeschen" role="menuitem" tabindex="0"><span class="up-pop-opt-l">' + UC.icon("trash", 2) + '<span>' + esc(t("Delete Audit")) + '</span></span></div>' +
          '</div>' +
        '</div>';
      menuesVerdrahten(d);
    }
    var planPop = null, mehrPop = null;
    function menuesVerdrahten(d) {
      var pw = elKopf.querySelector(".upa-plan"), mw = elKopf.querySelector(".upa-mehr");
      planPop = UC.makePopover({ wrap: pw, menu: pw.querySelector(".upa-planmenu"), opener: pw.querySelector(".upa-planknopf"), group: "upa-kopf-" + instanceId });
      mehrPop = UC.makePopover({ wrap: mw, menu: mw.querySelector(".upa-mehrmenu"), opener: mw.querySelector(".upa-mehrknopf"), group: "upa-kopf-" + instanceId });
      pw.querySelector(".upa-planknopf").addEventListener("click", function (e) {
        e.stopPropagation(); mehrPop.close(false);
        if (planPop.isOpen()) { planPop.close(false); return; }
        pw.querySelector(".upa-planmenu").innerHTML = planMenuHtml(dasDetail());
        planPop.open();
      });
      mw.querySelector(".upa-mehrknopf").addEventListener("click", function (e) {
        e.stopPropagation(); planPop.close(false);
        if (mehrPop.isOpen()) mehrPop.close(false); else mehrPop.open();
      });
    }
    /* Einmalig ist die Vorgabe (Plan 2), wiederkehrend die Wahl. Die Grenze fuer Wiederkehrende
       steht im Menue selbst: weekly belegt 1, monthly 1/4 (_page_audit_capacity_v1). */
    function planMenuHtml(d) {
      var jetzt = d && d.page ? d.page.schedule : "once", k = kapazitaet();
      var opt = [["once", "Once", "Runs only when you start it."], ["weekly", "Weekly", "Runs every week at night."], ["monthly", "Monthly", "Runs once a month at night."]];
      return '<div class="up-pop-head">' + esc(t("Schedule")) + '</div>' +
        opt.map(function (o) {
          return '<div class="up-pop-opt upa-planopt' + (o[0] === jetzt ? " is-active" : "") + '" role="menuitemradio" tabindex="0" aria-checked="' + (o[0] === jetzt) + '" data-plan="' + o[0] + '">' +
            '<span class="upa-planopt-l"><span class="upa-planopt-t">' + esc(t(o[1])) + '</span><span class="upa-planopt-d">' + esc(t(o[2])) + '</span></span>' +
            '<span class="up-check">' + UC.icon("check", 2) + '</span></div>';
        }).join("") +
        (k ? '<div class="up-pop-div"></div><p class="upa-planhinweis">' +
          /* get_page_audit_v1 rechnet die Kapazitaet OHNE diese Seite (_page_audit_capacity_v1 mit p_page_id):
             "used" ist also, was die anderen Seiten belegen. */
          esc(t("Recurring audits can use up to {n} of your weekly audits. Other pages use {used}.").replace("{n}", D.fmtZahl(k.capacity)).replace("{used}", D.fmtZahl(k.used))) +
          ' ' + esc(t("Weekly counts 1, monthly counts 1/4.")) + '</p>' : '');
    }
    elKopf.addEventListener("click", function (e) {
      if (e.target.closest("[data-upa-anlegen]")) { anlegenOeffnen(); return; }
      if (e.target.closest(".upa-nochmal")) { nochmal(); return; }
      if (e.target.closest(".upa-abbrechen")) { abbrechen(); return; }
      var po = e.target.closest(".upa-planopt[data-plan]");
      if (po) { if (planPop) planPop.close(false); planSetzen(po.getAttribute("data-plan")); return; }
      if (e.target.closest(".upa-loeschen")) { if (mehrPop) mehrPop.close(false); loeschenFragen(); return; }
      if (e.target.closest(".upa-mehrmenu a")) { if (mehrPop) mehrPop.close(false); }
    });
    elKopf.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var po = e.target.closest && e.target.closest(".upa-planopt[data-plan]");
      if (po) { e.preventDefault(); if (planPop) planPop.close(false); planSetzen(po.getAttribute("data-plan")); return; }
      if (e.target.closest && e.target.closest(".upa-loeschen")) { e.preventDefault(); if (mehrPop) mehrPop.close(false); loeschenFragen(); }
    });

    /* ============================================================================================
       Create Audit (Popup nach Geists Modal, UC.makeModal)
       ============================================================================================ */
    function quotaSatz() {
      var q = quota();
      if (!q) return "";
      var s = q.remaining <= 0
        ? t("You've used all {n} audits for this week.").replace("{n}", fmtInt(q.allowance))
        : t("{used} of {n} audits used this week.").replace("{used}", fmtInt(q.used)).replace("{n}", fmtInt(q.allowance));
      if (q.resetsAt) s += " " + t("Resets on {date}.").replace("{date}", UC.fmtDate(q.resetsAt));
      return s;
    }
    /* ZEITPLAN SCHON BEIM ANLEGEN (21.10., nach der Recherche: Semrush, Sitebulb und Lumar legen ihn im
       Anlege-Ablauf fest, geaendert wird er spaeter im Kopf). core .up-seg.is-lg (32 hoch), darunter der Satz
       zur Grenze wie im Zeitplan-Menue. Was die Grenze sprengen wuerde, ist gesperrt -- gerechnet wie
       _page_audit_capacity_v1: weekly 1, monthly 1/4, Platz bis capacity. create_page_audit_v1 kennt keinen
       Zeitplan: nach dem Anlegen setzt set_page_audit_schedule_v1 ihn (Vertragswunsch: p_schedule). */
    var PLAN_KOSTEN = { weekly: 1, monthly: 0.25 };
    function planFrei(plan) {
      var k = kapazitaet();
      if (plan === "once" || !k) return true;
      return k.used + PLAN_KOSTEN[plan] <= k.capacity + 1e-9;
    }
    function planFeldHtml() {
      var k = kapazitaet();
      var keinPlatz = !planFrei("monthly");
      var satz = k ? t("Recurring audits can use up to {n} of your weekly audits. Other pages use {used}.").replace("{n}", D.fmtZahl(k.capacity)).replace("{used}", D.fmtZahl(k.used)) +
        " " + t("Weekly counts 1, monthly counts 1/4.") : "";
      return '<div class="up-topicmodal-field upa-planfeld">' +
        '<span class="up-topicmodal-label" id="upa-plan-l-' + esc(instanceId) + '">' + esc(t("Schedule")) + '</span>' +
        '<div class="up-seg is-lg upa-planseg" role="radiogroup" aria-labelledby="upa-plan-l-' + esc(instanceId) + '">' +
          [["once", "Once"], ["weekly", "Weekly"], ["monthly", "Monthly"]].map(function (o) {
            var an = o[0] === "once", zu = !planFrei(o[0]);
            return '<button type="button" class="up-seg-btn' + (an ? " is-active" : "") + (zu ? " is-disabled" : "") + '" role="radio" aria-checked="' + an + '"' +
              (zu ? ' aria-disabled="true" data-tip="' + esc(t("No recurring slots left")) + '"' : '') + ' data-plan="' + o[0] + '">' + esc(t(o[1])) + '</button>';
          }).join("") +
        '</div>' +
        (satz ? '<p class="upa-planhinweis upa-planhinweis-feld">' + esc((keinPlatz ? t("No recurring slots left.") + " " : "") + satz) + '</p>' : '') +
      '</div>';
    }
    function anlegenOeffnen(vorgabe) {
      var schl = D.schluessel(), letzte = null;
      var api = UC.makeModal({
        titel: "Create Audit",
        unter: "Check whether AI search platforms can technically reach one public page.",
        isDark: isDark,
        inhaltHtml:
          '<div class="up-topicmodal-field">' +
            '<label class="up-topicmodal-label" for="upa-url-' + esc(instanceId) + '">' + esc(t("Page URL")) + '</label>' +
            '<input class="up-topicmodal-name upa-urlfeld" id="upa-url-' + esc(instanceId) + '" type="text" inputmode="url" autocomplete="off" spellcheck="false" maxlength="2048" placeholder="https://example.com/page"/>' +
            '<div class="up-fehlerzeile upa-urlfehler" role="alert"><span></span></div>' +
            '<button type="button" class="upa-vorschlag" hidden></button>' +
          '</div>' +
          planFeldHtml() +
          '<p class="up-modal-hinweis upa-quotahinweis">' + esc(quotaSatz()) + '</p>',
        knoepfe: [
          { id: "ab", text: "Cancel", art: "sec" },
          { id: "ok", text: "Create Audit", art: "pri", aktion: function (a) { absenden(a); return false; } }
        ]
      });
      var feld = api.body.querySelector(".upa-urlfeld"), fz = api.body.querySelector(".upa-urlfehler"), vor = api.body.querySelector(".upa-vorschlag");
      var seg = api.body.querySelector(".upa-planseg"), plan = "once";
      if (seg) {
        if (UC.segJetzt) { try { UC.segJetzt(seg); } catch (e) {} }
        seg.addEventListener("click", function (e) {
          var b = e.target.closest(".up-seg-btn[data-plan]");
          if (!b || b.classList.contains("is-disabled")) return;
          plan = b.getAttribute("data-plan");
          [].forEach.call(seg.querySelectorAll(".up-seg-btn"), function (x) { var an = x === b; x.classList.toggle("is-active", an); x.setAttribute("aria-checked", String(an)); });
          if (UC.segJetzt) { try { UC.segJetzt(seg); } catch (e2) {} }
        });
      }
      var elQuota = api.body.querySelector(".upa-quotahinweis");
      if (vorgabe) feld.value = vorgabe;
      if (!quotaSatz()) elQuota.hidden = true;
      function feldFehler(text) {
        fz.firstChild.textContent = text || "";
        fz.classList.toggle("is-on", !!text);
        feld.setAttribute("aria-invalid", text ? "true" : "false");
      }
      feld.addEventListener("input", function () {
        /* Eine andere Eingabe ist ein anderer Auftrag: neuer Schluessel (sonst meldete die DB
           idempotency_conflict fuer denselben Schluessel mit anderer URL). */
        if (letzte != null && feld.value.trim() !== letzte) { schl = D.schluessel(); letzte = null; }
        feldFehler(""); vor.hidden = true;
      });
      feld.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); absenden(api); } });
      vor.addEventListener("click", function () {
        feld.value = vor.getAttribute("data-url") || ""; vor.hidden = true; feldFehler("");
        schl = D.schluessel(); letzte = null;
        try { feld.focus(); } catch (e) {}
      });
      var laeuftGerade = false;
      function absenden(a) {
        if (laeuftGerade) return;
        var url = feld.value.trim();
        if (!url) { feldFehler(t("Enter the URL of a page.")); try { feld.focus(); } catch (e) {} return; }
        if (!team()) { feldFehler(t("Something went wrong on our side. Please try again.")); return; }
        laeuftGerade = true; letzte = url;
        a.busy("ok", true); feldFehler(""); vor.hidden = true;
        UC.rpc(D.FN.anlegen, { p_team: team(), p_url: url, p_idempotency_key: schl }, { timeoutMs: 20000 }).then(function (erg) {
          laeuftGerade = false; a.busy("ok", false);
          var q = erg && erg.ok ? D.zuQuittung(erg.daten) : null;
          if (q) {
            a.schliessen();
            var titel = t(q.deduplicated && !q.replayed ? "This page is already being audited" : "Audit started");
            L.alt = true; aufListeStale();
            detailOeffnen(q.pageId, "", true);
            if (plan === "once") { UC.toast(titel, { kind: "success" }); return; }
            /* Der Lauf steht; der Zeitplan ist ein zweiter Aufruf. Scheitert er, bleibt das Audit einmalig --
               das sagt der Toast, statt still auf Once zu bleiben. */
            UC.rpc(D.FN.plan, { p_team: team(), p_page_id: q.pageId, p_schedule: plan }, { timeoutMs: 20000 }).then(function (pe) {
              if (pe && pe.ok) {
                var nx = str(pe.daten && pe.daten.next_run_at);
                UC.toast(titel, { kind: "success", desc: nx ? t(plan === "weekly" ? "Runs weekly, next on {date}." : "Runs monthly, next on {date}.").replace("{date}", zeit(nx)) : "" });
              } else {
                UC.toast(titel, { kind: "success" });
                UC.toast(t("The schedule couldn't be set, so this audit runs once.") + " " + D.fehlerSatz(pe, { t: t }).satz, { kind: "error", roh: true });
              }
              aufListeStale();
              if (state.ansicht === "detail" && state.pageId === q.pageId) detailLaden({ leise: true });
            });
            return;
          }
          var f = D.fehlerSatz(erg, { t: t, eingabe: url, datum: UC.fmtDate, sonst: "The audit couldn't be started. Please try again." });
          if (elQuota && erg && erg.fehler && erg.fehler.message === "page_audit_quota_exhausted") elQuota.hidden = true;
          if (f.neuerSchluessel) { schl = D.schluessel(); letzte = null; }
          feldFehler(f.satz);
          if (f.vorschlag) { vor.setAttribute("data-url", f.vorschlag); vor.textContent = t("Use {url}").replace("{url}", f.vorschlag); vor.hidden = false; }
          try { feld.focus(); } catch (e) {}
        });
      }
    }

    /* ============================================================================================
       Detail
       ============================================================================================ */
    function detailSig(pageId, runId) { return pageId + "|" + (runId || ""); }
    /* Der Stand einer Antwort OHNE ihren Zeitstempel (meta.generated_at aendert sich bei jedem Aufruf):
       sonst zeichnete das leise Nachladen alle 2 s alles neu, und Fokus, Hover und Tooltip gingen mit. */
    function standVon(d) {
      if (!d || typeof d !== "object") return "";
      var m = d.meta && typeof d.meta === "object" ? d.meta : {};
      try { return JSON.stringify([m.quota, m.schedule_capacity, m.total_count, d.page, d.runs, d.selected, d.rows]); } catch (e) { return ""; }
    }
    function dasDetail() { var e = DET[detailSig(state.pageId, state.runId)]; return e && e.daten ? e.daten : null; }
    function detailEintrag() { return DET[detailSig(state.pageId, state.runId)] || null; }
    function aktiverLauf(d) {
      if (!d) return null;
      for (var i = 0; i < d.runs.length; i++) if (D.laeuft(d.runs[i].status)) return d.runs[i];
      return null;
    }
    var detailNr = 0;
    function detailLaden(o) {
      o = o || {};
      if (!team() || !D.uuidOk(state.pageId)) return;
      var nr = ++detailNr, sig = detailSig(state.pageId, state.runId);
      var e = DET[sig] || (DET[sig] = { daten: null, fehler: "" });
      if (!o.leise && !e.daten) { e.fehler = ""; detailZeichnen(); }
      var a = D.detail(team(), state.pageId, state.runId);
      UC.rpc(a.fn, a.params, { timeoutMs: 20000 }).then(function (erg) {
        if (nr !== detailNr) return;
        var d = erg && erg.ok ? D.zuDetail(erg.daten) : null;
        if (!d) {
          if (window.console) console.warn("[page-audit] detail:", erg && erg.ok ? "Antwort unlesbar" : (erg && erg.fehler));
          if (o.leise && e.daten) { planen(); return; }
          var m = erg && erg.fehler ? str(erg.fehler.message) : "";
          e.fehler = m === "page_audit_not_found" ? "weg" : ((erg && erg.ok) || !UC.fehlerSatzArt ? "unlesbar" : (UC.fehlerSatzArt(erg) || "unlesbar"));
          e.daten = null;
        } else {
          var stand = standVon(erg.daten), gleich = !!e.daten && e.json === stand;
          e.daten = d; e.fehler = ""; e.json = stand;
          /* Leise und unveraendert: nichts neu zeichnen -- aufgeklappte Befunde und die Lage
             bleiben, wie sie sind. */
          if (o.leise && gleich) { planen(); return; }
        }
        if (state.ansicht === "detail" && detailSig(state.pageId, state.runId) === sig) { detailZeichnen(); kopfZeichnen(); krumenNeu(); }
        auftrittBereit();
        planen();
      });
    }

    function kpiHtml(d) {
      var s = d.selected, r = s && s.run, vor = null;
      if (s && s.previousRunId) for (var i = 0; i < d.runs.length; i++) if (d.runs[i].id === s.previousRunId) { vor = d.runs[i]; break; }
      /* Verglichen wird nur zwischen zwei vollstaendig gemessenen Laeufen derselben Regeln. */
      function voll(x) { return !!x && x.coverageRequired != null && x.coverageSatisfied === x.coverageRequired; }
      var vergleich = !!vor && !s.rulesChanged && voll(r) && voll(vor);
      function tr(a, b, umg) { return vergleich && a != null && b != null && UC.trendChip ? UC.trendChip(a - b, { inverted: !!umg }) : ""; }
      var fussR = !vor ? t("First run of this page") : (s.rulesChanged ? t("Rules updated, not compared") :
        (vergleich ? t("Compared with the previous run") : t("Incomplete measurement, not compared")));
      return '<div class="up-kpiband is-4 is-offen upa-kpis">' +
        UC.kpiKarte({ label: "Reachable", wertHtml: esc(von(r.reachable, r.profiles)), trendHtml: tr(r.reachable, vor && vor.reachable), fussHtml: esc(fussR) }) +
        UC.kpiKarte({ label: "Restrictions", wertHtml: '<span class="up-num">' + esc(r.restrictions == null ? "–" : fmtInt(r.restrictions)) + '</span>', trendHtml: tr(r.restrictions, vor && vor.restrictions, true), fussHtml: esc(t("Block access for a platform")) }) +
        UC.kpiKarte({ label: "Potential issues", wertHtml: '<span class="up-num">' + esc(r.issues == null ? "–" : fmtInt(r.issues)) + '</span>', trendHtml: tr(r.issues, vor && vor.issues, true), fussHtml: esc(t("May limit how the page is used")) }) +
        UC.kpiKarte({ label: "Coverage", wertHtml: esc(von(r.coverageSatisfied, r.coverageRequired)), fussHtml: esc(t("Required measurements completed")) }) +
      '</div>';
    }
    function identHtml(d) {
      var p = d.page, s = d.selected, r = s && s.run;
      var name = p.title || kurz(p.url), href = sicherHref(p.fetchUrl || p.url);
      var meta = [];
      if (r && r.assessment) meta.push(ergebnisHtml(r.assessment));
      else if (r) meta.push(statusHtml(r.status));
      if (r) meta.push('<span class="upa-metaitem">' + UC.icon("clock", 2) + '<span>' + esc(zeit(r.finishedAt || r.acceptedAt)) + '</span></span>');
      meta.push('<span class="upa-metaitem">' + UC.icon("calendar", 2) + '<span>' + esc(t(D.PLAN[p.schedule] || "Once")) +
        (p.schedule !== "once" && p.nextRunAt ? ', ' + esc(t("next {date}").replace("{date}", zeit(p.nextRunAt))) : '') + '</span></span>');
      return '<section class="upa-ident">' + seitenLogo(p.url, true) +
        '<div class="upa-ident-txt">' +
          '<h2 class="up-heading up-sec-h upa-ident-name">' + esc(name) + '</h2>' +
          (href ? '<a class="up-sec-sub upa-ident-url" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer"><span>' + esc(p.fetchUrl || p.url) + '</span>' + UC.icon("externalLink", 2) + '</a>'
                : '<span class="up-sec-sub upa-ident-url">' + esc(p.url) + '</span>') +
          '<div class="upa-meta">' + meta.join("") + '</div>' +
        '</div>' +
      '</section>';
    }
    /* Ein laufender Lauf neben einem gezeigten Ergebnis: eine Zeile darueber, das Ergebnis bleibt
       das vorige, bis der neue Lauf fertig ist. */
    function laufzeileHtml(d) {
      var a = aktiverLauf(d), s = d.selected;
      if (!a || (s && s.run.id === a.id)) return "";
      var satz = a.status === "queued" ? t("A new audit is waiting to start.") : t("A new audit is running.");
      return '<div class="upa-laufzeile" role="status">' + statusHtml(a.status) + '<span>' + esc(satz) + ' ' +
        esc(t("Started {time}.").replace("{time}", wann(a.acceptedAt))) + '</span></div>';
    }
    /* Ein Lauf ohne Ergebnis: der wartende/laufende bekommt das Ladebild (lange Laeufe nur ueber
       UC.makeLadebild), der gescheiterte einen Satz mit dem Grund. */
    function ohneErgebnisHtml(d) {
      var r = d.selected.run;
      if (D.laeuft(r.status)) return '<div class="upa-ladebild" data-upa-ladebild></div>';
      var satz = D.LAUF_FEHLER[r.errorCode] || (r.status === "cancelled" ? "This audit was cancelled." :
        r.status === "skipped_quota" ? "This scheduled audit was skipped because the weekly quota was used up." :
        "This audit could not be completed. It was not charged.");
      return UC.leerHtml({ icon: r.status === "failed" ? "alertCircle" : "ban", titel: (D.STATUS[r.status] || {}).text || "No result",
                           text: satz, knopf: "Run again", knopfAttr: "data-upa-nochmal" });
    }
    function teilHinweisHtml(r) {
      if (r.status !== "partial") return "";
      return '<p class="upa-hinweis">' + UC.icon("info", 2) + '<span>' +
        esc(D.teilSatz(r.errorCode, r.coverageSatisfied != null ? fmtInt(r.coverageSatisfied) : null, r.coverageRequired != null ? fmtInt(r.coverageRequired) : null, t)) + '</span></p>';
    }
    /* "Reachable for x of 7" steht nie allein, wenn der Haupttext nicht im ersten HTML steht (Bericht,
       Abschnitt "Reachable bleibt eine Aussage ueber Zugang"): dieselbe Zone, ein Satz. */
    function zugangHinweisHtml(d) {
      if (!D.haupttextFehlt(d.selected.findings)) return "";
      return '<p class="upa-hinweis">' + UC.icon("info", 2) + '<span>' +
        esc(t("The main text is not in the initial HTML. Reachable only means that no access or policy block was found and all required measurements completed.")) + '</span></p>';
    }

    /* ---- Plattformen ---------------------------------------------------------------------------- */
    function plattformenHtml(d) {
      var s = d.selected, nachId = {}, vorLauf = null;
      s.profiles.forEach(function (p) { nachId[p.id] = p; });
      d.runs.forEach(function (x) { if (x.id === s.previousRunId) vorLauf = x; });
      function voll(x) { return !!x && x.coverageRequired != null && x.coverageSatisfied === x.coverageRequired; }
      var wechselZeigen = !s.rulesChanged && voll(s.run) && voll(vorLauf);
      var getrackt = [], weitere = [];
      D.PROFILE.forEach(function (p) {
        var m = modellVon(p);
        (m ? getrackt : weitere).push({ p: p, m: m, x: nachId[p.id] || null });
      });
      function zeile(e) {
        var x = e.x, zugang;
        var bef = s.findings.filter(function (f) { return f.profiles.indexOf(e.p.id) >= 0; }).sort(nachSchwere);
        var offen = !!state.profilOffen[e.p.id] && bef.length > 0;
        if (!x) zugang = '<span class="up-num is-empty">–</span>';
        else if (x.reachable) zugang = zustandHtml({ text: "Reachable", zeichen: "checkCircle", ton: "pos" });
        else if (x.restrictions > 0) zugang = zustandHtml({ text: "Not reachable", zeichen: "ban", ton: "neg" });
        /* Ohne Sperre, aber mit Luecke in der Messung: NICHT "erreichbar" (Plan 7), sondern
           ausdruecklich unbestaetigt. */
        else zugang = zustandHtml({ text: "Not confirmed", zeichen: "helpCircle", ton: "leise" }, { tip: t("Some measurements for this platform are missing, so access is not confirmed.") });
        var wechsel = "";
        if (wechselZeigen && x && x.previousReachable != null && x.previousReachable !== x.reachable)
          wechsel = '<span class="up-marke is-leise upa-marke is-' + (x.reachable ? "pos" : "neg") + '">' + esc(t(x.reachable ? "Now reachable" : "Was reachable")) + '</span>';
        var pk = "upa-pk-" + instanceId + "-" + e.p.id;
        return '<div class="up-row upa-statisch' + (bef.length ? " upa-paufklapp" : "") + (offen ? " is-offen" : "") + '" role="row"' +
            (bef.length ? ' tabindex="0" data-upa-profil="' + esc(e.p.id) + '" aria-expanded="' + offen + '" aria-controls="' + esc(pk) + '"' : '') + '>' +
          '<div class="up-td upa-td-plattform" role="cell">' + plattformLogo(e.p, e.m) +
            '<span class="upa-seite"><span class="up-zeilenname">' + esc(e.p.name) + '</span>' +
            '<span class="upa-url upa-mono">' + esc(e.p.ohneUa ? t("{token} rule, no own crawler").replace("{token}", e.p.token) : e.p.token) + '</span></span></div>' +
          '<div class="up-td upa-td-zugang" role="cell">' + zugang + wechsel + '</div>' +
          '<div class="up-td upa-td-zahl upa-td-r" role="cell"><span class="up-num">' + esc(x && x.restrictions != null ? fmtInt(x.restrictions) : "–") + '</span></div>' +
          '<div class="up-td upa-td-zahl upa-td-i" role="cell"><span class="up-num">' + esc(x && x.issues != null ? fmtInt(x.issues) : "–") + '</span></div>' +
          '<div class="up-td upa-td-zahl upa-td-c" role="cell"><span class="up-num">' + esc(x ? von(x.coverageSatisfied, x.coverageRequired) : "–") + '</span></div>' +
          '<div class="up-td upa-td-chev" role="cell">' + (bef.length ? '<span class="upa-befund-chev" aria-hidden="true">' + UC.icon(offen ? "chevronUp" : "chevronDown", 2) + '</span>' : '') + '</div>' +
        '</div>' +
        (bef.length ? '<div class="upa-pkoerper" role="row" id="' + esc(pk) + '"' + (offen ? '' : ' hidden') + '><div class="upa-pkoerper-in" role="cell">' +
          bef.map(function (f) {
            var tx = D.befundText(f), w = D.wirkung(f, e.p.id);
            var sperre = f.contribution === "restriction";
            return '<div class="upa-pb"><div class="upa-pb-kopf">' + zustandHtml({ text: "", zeichen: sperre ? "ban" : "alertCircle", ton: sperre ? "neg" : "warn" }, { klasse: "upa-pb-ic" }) +
              '<span class="upa-pb-t">' + esc(t(tx.titel)) + '</span>' + schwereHtml(f.severity) + wirkungHtml(w) + '</div>' +
              (w && w.effect ? '<p class="upa-satz is-leise">' + esc(w.effect) + '</p>' : '') + '</div>';
          }).join("") + '</div></div>' : '');
      }
      function gruppe(titel, liste) {
        if (!liste.length) return "";
        return '<div class="upa-gruppe" role="row"><span class="up-blockhead">' + esc(t(titel)) + '</span></div>' + liste.map(zeile).join("");
      }
      var koerper = getrackt.length ? gruppe("Tracked by your team", getrackt) + gruppe("Other platforms", weitere) : weitere.map(zeile).join("");
      return '<section class="upa-sek">' + sekKopf("Platforms", "Whether each AI search platform can reach this page under the tested conditions.") +
        '<div class="up-box upa-kasten upa-tab-plattformen"><div class="up-table" role="table">' +
          '<div class="up-thead" role="row" data-up-colsig="upa">' +
            '<div class="up-th" role="columnheader"><span class="up-th-txt">' + esc(t("Platform")) + '</span></div>' +
            '<div class="up-th" role="columnheader"><span class="up-th-txt">' + esc(t("Access")) + '</span></div>' +
            '<div class="up-th up-th-zahl upa-td-r" role="columnheader"><span class="up-th-txt">' + esc(t("Restrictions")) + '</span></div>' +
            '<div class="up-th up-th-zahl upa-td-i" role="columnheader"><span class="up-th-txt">' + esc(t("Issues")) + '</span></div>' +
            '<div class="up-th up-th-zahl upa-td-c" role="columnheader"><span class="up-th-txt">' + esc(t("Coverage")) + '</span></div>' +
            '<div class="up-th upa-td-chev" role="columnheader"><span class="up-th-txt"></span></div>' +
          '</div><div class="up-tbody" role="rowgroup">' + koerper + '</div></div></div>' +
        '<p class="upa-fussnote">' + esc(t("Crawler requests were sent with each platform's user agent from our servers, not by the real crawlers. Gemini has no crawler of its own and follows the Google-Extended rule in robots.txt.")) + '</p>' +
      '</section>';
    }

    /* ---- Etiketten: Schweregrad je Befund, impact_basis je Befund und Plattform (UMSETZUNGSPLAN 14) ----
       Beide als leise Marke aus core (.up-marke.is-leise), Text statt Punkt. Sortiert wird nur nach dem
       Schweregrad -- die Wirkung steht daneben, ordnet aber nicht. */
    function schwereHtml(sev) {
      var x = D.SCHWERE[sev];
      return x ? '<span class="up-marke is-leise upa-marke upa-schwere" data-tip="' + esc(t("Severity: how much this matters for the tested path. It is set per finding, not per platform.")) + '">' + esc(t(x)) + '</span>' : '';
    }
    function wirkungHtml(w) {
      var x = w && D.WIRKUNG[w.basis];
      return x ? '<span class="up-marke is-leise upa-marke upa-wirkung" data-tip="' + esc(t(x.tip)) + '">' + esc(t(x.text)) + '</span>' : '';
    }
    function nachSchwere(a, b) {
      var x = D.SCHWERE_RANG[a.severity], y = D.SCHWERE_RANG[b.severity];
      return (x == null ? 9 : x) - (y == null ? 9 : y);
    }
    /* Der Satz eines Befunds; beim JS-Befund mit Zaehler und Nenner vorn (Formulierungsgrenzen). */
    function befundSatz(f, tx) {
      if (f.family !== "content.rendered_text_difference") return t(tx.satz);
      var z = D.jsSatz(f, fmtInt);
      return z ? z + " " + t("Our browser added the rest after running JavaScript (Chromium, up to 10 seconds, no interaction). Systems that read only the initial HTML do not receive this text.") : t(tx.satz);
    }

    /* ---- Befunde --------------------------------------------------------------------------------- */
    function plattformStapel(ids) {
      /* Alle sieben: ein Wort statt sieben Logos -- die Reihe saehe aus wie eine Aufzaehlung. */
      if (ids.length >= D.PROFILE.length) return '<span class="upa-pstapel"><span class="upa-leise">' + esc(t("All platforms")) + '</span></span>';
      return '<span class="upa-pstapel">' + ids.map(function (id) {
        var p = D.profil(id);
        return '<span class="upa-pchip" data-tip="' + esc(p.name) + '">' + plattformLogo(p, modellVon(p)) + '</span>';
      }).join("") + '</span>';
    }
    function befundHtml(f, vorher) {
      var tx = D.befundText(f), schl = (vorher ? "v|" : "") + (f.causeKey || f.id), offen = !!state.offen[schl];
      var schwer = f.contribution === "restriction" ? "neg" : "warn";
      var ic = f.contribution === "restriction" ? "ban" : "alertCircle";
      if (vorher) { schwer = f.change === "resolved" ? "pos" : "leise"; ic = f.change === "resolved" ? "checkCircle" : "helpCircle"; }
      var felder = D.befundFelder(f), bel = vorher ? [] : D.belege(f);
      var koerperId = "upa-bf-" + instanceId + "-" + schl.replace(/[^a-z0-9]/gi, "").slice(0, 24);
      return '<div class="upa-befund' + (offen ? " is-offen" : "") + '" data-befund="' + esc(schl) + '">' +
        '<button type="button" class="upa-befund-kopf" aria-expanded="' + offen + '" aria-controls="' + esc(koerperId) + '">' +
          '<span class="upa-zustand is-' + schwer + '"><span class="upa-zustand-ic" aria-hidden="true">' + UC.icon(ic, 2) + '</span></span>' +
          '<span class="upa-befund-titel">' + esc(t(tx.titel)) + '</span>' +
          (vorher ? '' : schwereHtml(f.severity)) + aenderungHtml(f.change) +
          '<span class="upa-befund-rechts">' + plattformStapel(f.profiles) +
            '<span class="upa-befund-chev" aria-hidden="true">' + UC.icon(offen ? "chevronUp" : "chevronDown", 2) + '</span></span>' +
        '</button>' +
        '<div class="upa-befund-koerper" id="' + esc(koerperId) + '"' + (offen ? '' : ' hidden') + '>' +
          (tx.satz ? '<p class="upa-satz">' + esc(befundSatz(f, tx)) + '</p>' : '') +
          (felder.length ? '<dl class="upa-kv">' + felder.map(function (x) { return '<dt>' + esc(t(x.label)) + '</dt><dd class="upa-mono">' + esc(x.wert) + '</dd>'; }).join("") + '</dl>' : '') +
          belegeBlockHtml(bel) +
          (vorher ? '' : jePlattformHtml(f)) +
          (tx.schritt && !vorher ? '<div class="upa-absatz"><span class="up-blockhead">' + esc(t("Next step")) + '</span><p class="upa-satz">' + esc(t(tx.schritt)) + '</p></div>' : '') +
          (tx.umfang && !vorher ? '<div class="upa-absatz"><span class="up-blockhead">' + esc(t("What this doesn't show")) + '</span><p class="upa-satz is-leise">' + esc(t(tx.umfang)) + '</p></div>' : '') +
          '<p class="upa-checks">' + f.checkKeys.map(function (k) { var c = D.CHECK[k]; return '<span class="upa-mono">' + esc(k) + '</span> ' + esc(c ? t(c.name) : ""); }).join(", ") + '</p>' +
        '</div>' +
      '</div>';
    }
    /* Belege gruppiert nach ihrer Art: eine Ueberschrift (Gruppe-Stufe) je Art, darunter die Auszuege. */
    function belegeBlockHtml(bel) {
      var h = "", zuletzt = null;
      bel.forEach(function (b) {
        if (b.titel !== zuletzt) { zuletzt = b.titel; if (b.titel) h += '<span class="up-blockhead upa-belegkopf">' + esc(t(b.titel)) + '</span>'; }
        h += '<pre class="upa-beleg">' + esc(b.text) + '</pre>';
      });
      return h;
    }
    /* Je Plattform: Schweregrad und Wirkung nebeneinander, darunter der datierte Satz der Registry
       (fremder Text, escaped). Nur, wenn der Befund Wirkungen traegt. */
    function jePlattformHtml(f) {
      var zeilen = D.PROFILE.filter(function (p) { return f.profiles.indexOf(p.id) >= 0; }).map(function (p) {
        var w = D.wirkung(f, p.id);
        if (!w) return "";
        return '<div class="upa-jp-zeile"><div class="upa-jp-kopf">' + plattformLogo(p, modellVon(p)) + '<span class="up-zeilenname">' + esc(p.name) + '</span>' +
          schwereHtml(f.severity) + wirkungHtml(w) + '</div>' + (w.effect ? '<p class="upa-satz is-leise">' + esc(w.effect) + '</p>' : '') + '</div>';
      }).join("");
      return zeilen ? '<div class="upa-absatz"><span class="up-blockhead">' + esc(t("By platform")) + '</span><div class="upa-jp">' + zeilen + '</div></div>' : '';
    }
    function befundeHtml(d) {
      var s = d.selected, r = s.run;
      var sperren = s.findings.filter(function (f) { return f.contribution === "restriction"; });
      var probleme = s.findings.filter(function (f) { return f.contribution !== "restriction"; });
      var behoben = s.previousFindings.filter(function (f) { return f.change === "resolved"; });
      var unklar = s.previousFindings.filter(function (f) { return f.change !== "resolved"; });
      function gruppe(titel, liste, vorher, unter) {
        if (!liste.length) return "";
        return '<div class="upa-bgruppe"><div class="upa-bgruppe-kopf"><span class="up-blockhead">' + esc(t(titel)) + '</span>' +
          '<span class="upa-bgruppe-n">' + esc(fmtInt(liste.length)) + '</span></div>' +
          (unter ? '<p class="upa-bgruppe-unter">' + esc(t(unter)) + '</p>' : '') +
          '<div class="up-box upa-kasten upa-befunde">' + liste.map(function (f) { return befundHtml(f, vorher); }).join("") + '</div></div>';
      }
      var inhalt = gruppe("Restrictions", sperren) + gruppe("Potential issues", probleme) +
        gruppe("Resolved since the previous run", behoben, true) +
        gruppe("No longer reported, not compared", unklar, true, "These were found before but could not be measured the same way in this run, so they are not counted as resolved.");
      if (!sperren.length && !probleme.length) {
        var voll = r.coverageRequired != null && r.coverageSatisfied === r.coverageRequired;
        inhalt = '<div class="up-box upa-kasten upa-keinbefund">' + zustandHtml({ text: voll ? "No restrictions or potential issues found" : "No findings in the completed measurements",
          zeichen: voll ? "checkCircle" : "helpCircle", ton: voll ? "pos" : "leise" }) +
          '<p class="upa-satz is-leise">' + esc(t(voll ? "All required public measurements completed. This doesn't prove that a platform indexes or cites the page." : "Some measurements are missing, so this is not a clean result.")) + '</p></div>' + inhalt;
      }
      return '<section class="upa-sek">' + sekKopf("Findings", "Restrictions block access for a platform. Potential issues may limit how the page is used.") + inhalt + '</section>';
    }

    /* ---- Laeufe ---------------------------------------------------------------------------------- */
    function laeufeHtml(d) {
      var sel = d.selected ? d.selected.run.id : "";
      var liste = state.alleLaeufe ? d.runs : d.runs.slice(0, 10);
      function zeile(r) {
        var ist = r.id === sel;
        return '<div class="up-row upa-lauf' + (ist ? " is-gewaehlt" : "") + '" role="row" tabindex="0" data-run-id="' + esc(r.id) + '"' + (ist ? ' aria-current="true"' : '') + '>' +
          '<div class="up-td" role="cell"><span class="upa-zeit">' + esc(zeit(r.acceptedAt)) + '</span></div>' +
          '<div class="up-td upa-td-trigger" role="cell"><span class="upa-leise">' + esc(t(r.trigger === "schedule" ? "Scheduled" : "Manual")) + '</span></div>' +
          '<div class="up-td" role="cell">' + (r.assessment && (r.status === "completed" || r.status === "partial") ? ergebnisHtml(r.assessment) : statusHtml(r.status)) +
            (r.status === "partial" ? '<span class="up-marke is-leise upa-marke">' + esc(t("Partial")) + '</span>' : '') + '</div>' +
          '<div class="up-td upa-td-zahl" role="cell"><span class="up-num">' + esc(r.reachable != null ? von(r.reachable, r.profiles) : "–") + '</span></div>' +
          '<div class="up-td upa-td-zahl upa-td-r" role="cell"><span class="up-num">' + esc(r.restrictions != null ? fmtInt(r.restrictions) : "–") + '</span></div>' +
          '<div class="up-td upa-td-zahl upa-td-i" role="cell"><span class="up-num">' + esc(r.issues != null ? fmtInt(r.issues) : "–") + '</span></div>' +
        '</div>';
      }
      return '<section class="upa-sek">' + sekKopf("Runs", "Every audit of this page. Select a run to see its result.") +
        '<div class="up-box upa-kasten upa-tab-laeufe"><div class="up-table" role="table">' +
          '<div class="up-thead" role="row" data-up-colsig="upa">' +
            ['Date', 'Trigger', 'Result', 'Reachable', 'Restrictions', 'Issues'].map(function (h, i) {
              return '<div class="up-th' + (i >= 3 ? " up-th-zahl" : "") + (i === 1 ? " upa-td-trigger" : "") + (i === 4 ? " upa-td-r" : "") + (i === 5 ? " upa-td-i" : "") + '" role="columnheader"><span class="up-th-txt">' + esc(t(h)) + '</span></div>';
            }).join("") +
          '</div><div class="up-tbody" role="rowgroup">' + liste.map(zeile).join("") + '</div></div></div>' +
        (d.runs.length > 10 && !state.alleLaeufe ? '<button type="button" class="upa-mehrlaeufe">' + esc(t("Show all {n} runs").replace("{n}", fmtInt(d.runs.length))) + '</button>' : '') +
      '</section>';
    }

    /* ---- Checks ---------------------------------------------------------------------------------- */
    function checksHtml(d) {
      var s = d.selected, nach = {};
      s.checks.forEach(function (c) { nach[c.key] = c; });
      var zeilen = D.CHECKS.map(function (k) {
        var c = nach[k.key];
        if (!c) return "";
        /* E2 vergleicht mit einem Sitemap-Schnappschuss des Teams; den gibt es noch nicht (Worker: no_snapshot),
           die Zeile stuende in JEDEM Lauf als "Not applicable" da. Ausgeblendet, bis es ihn gibt (Memory:
           kein Feature, das fest "nicht geprueft" zeigt). */
        if (k.key === "E2" && c.state === "not_applicable" && c.reason === "no_snapshot") return "";
        var z = D.CHECK_ZUSTAND[c.state] || null;
        if (c.state === "finding" && (c.severity === "critical" || c.severity === "high")) z = { text: "Finding", zeichen: "ban", ton: "neg" };
        var wechsel = "";
        if (s.previousRunId) {
          if (c.rulesChanged) wechsel = aenderungHtml("rules_changed");
          else if (c.previousState && c.previousState !== c.state) {
            var pz = D.CHECK_ZUSTAND[c.previousState];
            wechsel = '<span class="upa-leise">' + esc(t("Previously: {state}").replace("{state}", t(pz ? pz.text : c.previousState))) + '</span>';
          } else wechsel = '<span class="upa-leise">' + esc(t("Unchanged")) + '</span>';
        }
        return '<div class="up-row upa-statisch" role="row">' +
          '<div class="up-td upa-td-check" role="cell"><span class="upa-checkkey upa-mono">' + esc(k.key) + '</span>' +
            '<span class="upa-seite"><span class="up-zeilenname">' + esc(t(k.name)) + '</span><span class="upa-url">' + esc(t(k.text)) + '</span></span></div>' +
          '<div class="up-td" role="cell">' + zustandHtml(z) + '</div>' +
          '<div class="up-td upa-td-wechsel" role="cell">' + (wechsel || '<span class="up-num is-empty">–</span>') + '</div>' +
        '</div>';
      }).join("");
      return '<section class="upa-sek">' + sekKopf("Checks", "Each rule family of the audit and what it found.") +
        '<div class="up-box upa-kasten upa-tab-checks"><div class="up-table" role="table">' +
          '<div class="up-thead" role="row" data-up-colsig="upa">' +
            '<div class="up-th" role="columnheader"><span class="up-th-txt">' + esc(t("Check")) + '</span></div>' +
            '<div class="up-th" role="columnheader"><span class="up-th-txt">' + esc(t("Result")) + '</span></div>' +
            '<div class="up-th upa-td-wechsel" role="columnheader"><span class="up-th-txt">' + esc(t("Previous run")) + '</span></div>' +
          '</div><div class="up-tbody" role="rowgroup">' + zeilen + '</div></div></div>' +
      '</section>';
    }

    /* ---- Messwerte ------------------------------------------------------------------------------- */
    function wertText(m, v) {
      if (v == null) return "–";
      if (m.unit === "bytes") return v >= 1024 * 1024 ? UC.fmtNum(v / 1048576, 1) + " MB" : (v >= 1024 ? UC.fmtNum(v / 1024, 1) + " KB" : fmtInt(v) + " B");
      if (m.unit === "ms") return v >= 1000 ? UC.fmtNum(v / 1000, 1) + " s" : fmtInt(Math.round(v)) + " ms";
      if (m.unit === "chars") return fmtInt(v);
      if (m.unit === "ratio") return UC.fmtPct ? UC.fmtPct(v * 100, 1) : (Math.round(v * 1000) / 10) + "%";
      if (m.unit === "bool") return t(v ? "Yes" : "No");
      return fmtInt(v);
    }
    /* Einheit hinter einem Bruch ("4,719 of 15,046 characters"). */
    var BRUCH_EINHEIT = { raw_retention_ratio: "characters", coverage_ratio: "measurements" };
    function messwerteHtml(d) {
      var s = d.selected, nach = {};
      s.metrics.forEach(function (m) { nach[m.key] = m; });
      var reihe = D.METRIK_REIHE.filter(function (k) { return nach[k]; }).concat(s.metrics.map(function (m) { return m.key; }).filter(function (k) { return !D.METRIKEN[k]; }));
      if (!reihe.length) return "";
      var zeilen = reihe.map(function (k) {
        var m = nach[k], wert;
        if (m.missing) wert = '<span class="upa-leise">' + esc(t(D.FEHLT[m.missing] || "Not available")) + '</span>';
        else if (m.text && m.value == null) wert = '<span class="upa-mono">' + esc(m.text) + '</span>';
        else if (m.unit === "ratio" && m.numerator != null && m.denominator != null)
          wert = '<span class="up-num">' + esc(von(m.numerator, m.denominator)) + '</span>' +
            (BRUCH_EINHEIT[k] ? '<span class="upa-leise upa-bruch">' + esc(t(BRUCH_EINHEIT[k])) + '</span>' : '');
        else wert = '<span class="up-num">' + esc(wertText(m, m.value)) + '</span>';
        var vorher;
        if (!s.previousRunId) vorher = '<span class="up-num is-empty">–</span>';
        else if (!m.comparable) vorher = '<span class="upa-leise" data-tip="' + esc(t("Measured differently or missing in one of the runs.")) + '">' + esc(t("Not comparable")) + '</span>';
        else {
          var diff = m.value != null && m.previous != null ? m.value - m.previous : null;
          if (m.unit === "ratio") vorher = '<span class="upa-leise">' + esc(t(diff ? (diff > 0 ? "Higher than before" : "Lower than before") : "Unchanged")) + '</span>';
          else vorher = '<span class="up-num">' + esc(wertText(m, m.previous)) + '</span>' +
            (diff ? '<span class="upa-leise upa-diff">' + esc((diff > 0 ? "+" : "−") + wertText(m, Math.abs(diff))) + '</span>' : '');
        }
        return '<div class="up-row upa-statisch upa-einzeilig" role="row">' +
          '<div class="up-td" role="cell"><span class="upa-mlabel">' + esc(t(D.METRIKEN[k] || k)) + '</span></div>' +
          '<div class="up-td upa-td-zahl" role="cell">' + wert + '</div>' +
          '<div class="up-td upa-td-zahl upa-td-wechsel" role="cell">' + vorher + '</div>' +
        '</div>';
      }).join("");
      return '<section class="upa-sek">' + sekKopf("Measurements", "Measured values of this run, next to the previous run where they are comparable.") +
        '<div class="up-box upa-kasten upa-tab-mess"><div class="up-table" role="table">' +
          '<div class="up-thead" role="row" data-up-colsig="upa">' +
            '<div class="up-th" role="columnheader"><span class="up-th-txt">' + esc(t("Measurement")) + '</span></div>' +
            '<div class="up-th up-th-zahl" role="columnheader"><span class="up-th-txt">' + esc(t("Value")) + '</span></div>' +
            '<div class="up-th up-th-zahl upa-td-wechsel" role="columnheader"><span class="up-th-txt">' + esc(t("Previous run")) + '</span></div>' +
          '</div><div class="up-tbody" role="rowgroup">' + zeilen + '</div></div></div>' +
      '</section>';
    }

    /* ---- Belege (Einzelabrufe) -------------------------------------------------------------------- */
    function belegeHtml(d) {
      var s = d.selected;
      if (!s.observations.length) return "";
      var zeilen = s.observations.map(function (b) {
        var n = D.slotName(b.slot);
        var st = b.outcome !== "observed" ? '<span class="upa-leise">' + esc(t(D.ERGEBNIS_BEOBACHTUNG[b.outcome] || b.outcome)) + '</span>'
               : (b.status != null ? '<span class="up-num upa-mono">' + esc(String(b.status)) + '</span>' : '<span class="up-num is-empty">–</span>');
        var roh;
        /* Rohdaten 90 Tage (Plan 2): danach "expired" -- das Ergebnis bleibt, der Mitschnitt nicht. */
        if (!b.artifact) roh = '<span class="up-num is-empty">–</span>';
        /* Hover-Tausch wie in jeder Liste (Memory): die Angabe steht, beim Ueberfahren der Zeile an ihrer
           Stelle der Zeilenknopf aus core (.up-rowbtn). */
        else if (b.artifact.state === "available" && D.uuidOk(b.id))
          roh = '<span class="upa-roh"><span class="upa-leise upa-rohtext">' + esc(b.artifact.expiresAt ? t("Kept until {date}").replace("{date}", UC.fmtDate(b.artifact.expiresAt)) : t("Available")) + '</span>' +
            '<button type="button" class="up-btn-sec up-rowbtn upa-rohknopf" data-upa-roh="' + esc(b.id) + '" aria-label="' + esc(t("Download raw data")) + '">' +
            UC.icon("download", 2) + '<span>' + esc(t("Download JSON")) + '</span></button></span>';
        else if (b.artifact.state === "available") roh = '<span class="upa-leise">' + esc(b.artifact.expiresAt ? t("Kept until {date}").replace("{date}", UC.fmtDate(b.artifact.expiresAt)) : t("Available")) + '</span>';
        else roh = '<span class="upa-leise">' + esc(t(b.artifact.state === "expired" ? "Expired after 90 days" : "Deleted")) + '</span>';
        return '<div class="up-row upa-statisch" role="row">' +
          '<div class="up-td upa-td-abruf" role="cell"><span class="upa-seite"><span class="up-zeilenname">' + esc(t(n.name)) +
            (n.zusatz ? ' <span class="upa-mono upa-zusatz">' + esc(n.zusatz) + '</span>' : '') +
            (b.synthetic ? ' <span class="up-marke is-leise upa-marke" data-tip="' + esc(t("Sent with this crawler's user agent from our servers. This is not the real crawler.")) + '">' + esc(t("Test user agent")) + '</span>' : '') + '</span>' +
            (b.requestUrl ? '<span class="upa-url">' + esc(b.requestUrl) + '</span>' : '') + '</span></div>' +
          '<div class="up-td upa-td-zahl" role="cell">' + st + '</div>' +
          '<div class="up-td upa-td-typ" role="cell"><span class="upa-leise upa-mono">' + esc(b.contentType ? b.contentType.split(";")[0] : "–") + '</span></div>' +
          '<div class="up-td upa-td-zahl upa-td-groesse" role="cell"><span class="up-num">' + esc(b.bytes != null ? wertText({ unit: "bytes" }, b.bytes) : "–") + '</span></div>' +
          '<div class="up-td upa-td-zahl upa-td-dauer" role="cell"><span class="up-num">' + esc(b.durationMs != null ? wertText({ unit: "ms" }, b.durationMs) : "–") + '</span></div>' +
          '<div class="up-td upa-td-roh" role="cell">' + roh + '</div>' +
        '</div>';
      }).join("");
      return '<section class="upa-sek">' + sekKopf("Evidence", "Every request of this run. Results are kept, raw captures for 90 days.") +
        '<div class="up-box upa-kasten upa-tab-belege"><div class="up-table" role="table">' +
          '<div class="up-thead" role="row" data-up-colsig="upa">' +
            '<div class="up-th" role="columnheader"><span class="up-th-txt">' + esc(t("Request")) + '</span></div>' +
            '<div class="up-th up-th-zahl" role="columnheader"><span class="up-th-txt">' + esc(t("Status")) + '</span></div>' +
            '<div class="up-th upa-td-typ" role="columnheader"><span class="up-th-txt">' + esc(t("Type")) + '</span></div>' +
            '<div class="up-th up-th-zahl upa-td-groesse" role="columnheader"><span class="up-th-txt">' + esc(t("Size")) + '</span></div>' +
            '<div class="up-th up-th-zahl upa-td-dauer" role="columnheader"><span class="up-th-txt">' + esc(t("Time")) + '</span></div>' +
            '<div class="up-th upa-td-roh" role="columnheader"><span class="up-th-txt">' + esc(t("Raw data")) + '</span></div>' +
          '</div><div class="up-tbody" role="rowgroup">' + zeilen + '</div></div></div>' +
      '</section>';
    }

    /* ---- Details zum Lauf --------------------------------------------------------------------------- */
    function laufDetailsHtml(d) {
      var r = d.selected.run, v = r.versions || {};
      var paare = [
        ["Requested URL", r.fetchUrl || d.page.fetchUrl, true], ["Final URL", r.finalUrl, true],
        ["HTTP status", r.httpStatus != null ? String(r.httpStatus) : ""], ["Redirects", r.redirects != null ? fmtInt(r.redirects) : ""],
        ["Locale", r.locale], ["Trigger", t(r.trigger === "schedule" ? "Scheduled" : "Manual")],
        ["Started", r.startedAt ? zeit(r.startedAt) : ""], ["Finished", r.finishedAt ? zeit(r.finishedAt) : ""],
        ["Duration", r.durationMs != null ? wertText({ unit: "ms" }, r.durationMs) : ""],
        ["Rule set", str(v.ruleset), true], ["Platform rules", str(v.policy), true], ["Extractor", str(v.extractor), true]
      ].filter(function (p) { return p[1]; });
      return '<section class="upa-sek">' + sekKopf("Run details") +
        '<dl class="up-box upa-kasten upa-kv upa-kv-lauf">' + paare.map(function (p) {
          return '<dt>' + esc(t(p[0])) + '</dt><dd' + (p[2] ? ' class="upa-mono"' : '') + '>' + esc(p[1]) + '</dd>';
        }).join("") + '</dl></section>';
    }

    function detailSkelett() {
      return '<div class="upa-ident is-sk"><span class="up-tsk-logo upa-logo-gross"></span><span class="upa-ident-txt"><span class="up-tsk-bar" style="width:220px"></span><span class="up-tsk-bar" style="width:300px"></span></span></div>' +
        '<div class="up-kpiband is-4 is-offen upa-kpis">' + [0, 1, 2, 3].map(function () { return UC.kpiKarteSkelett ? UC.kpiKarteSkelett() : ""; }).join("") + '</div>' +
        '<section class="upa-sek">' + sekKopf("Platforms") + '<div class="up-box upa-kasten upa-tab-plattformen"><div class="up-table">' +
          UC.skeletonRows({ count: 7, cols: [{ w: 140, logo: true, jitter: 20 }, { w: 90 }, { w: 16, zahl: true }, { w: 16, zahl: true }, { w: 40, zahl: true }] }) + '</div></div></section>';
    }
    var ladebild = null;
    /* Die Reiter erscheinen erst mit einem Ergebnis. Beim Einblenden den Strich neu setzen: makePageNav hat
       ihn im verborgenen Zustand mit Breite 0 gemessen. */
    function navZeigen(an) {
      if (!elNav || elNav.hidden === !an) return;
      elNav.hidden = !an;
      root.classList.toggle("has-upa-nav", an);
      if (an && nav) { try { nav.positionUnderline(elNav.querySelector(".up-ph-navitem.is-selected"), false); } catch (e) {} }
    }
    function detailZeichnen() {
      var e = detailEintrag(), d = e && e.daten;
      if (ladebild && ladebild.stop) { try { ladebild.stop(); } catch (x) {} }
      ladebild = null;
      if (e && e.fehler) {
        navZeigen(false);
        elDetail.innerHTML = e.fehler === "weg"
          ? UC.leerHtml({ icon: "dna01", titel: "This audit no longer exists", text: "It may have been deleted by someone in your team.", knopf: "Back to Page Audit", knopfAttr: "data-upa-zurueck" })
          : UC.leseFehlerHtml("this audit", e.fehler === "unlesbar" ? "" : e.fehler);
        return;
      }
      var s = d && d.selected, mitErgebnis = !!s && (s.run.status === "completed" || s.run.status === "partial");
      navZeigen(mitErgebnis);
      if (!d) { elDetail.innerHTML = detailSkelett(); return; }
      var html;
      if (!s) {
        html = identHtml(d) + laufzeileHtml(d) + UC.leerHtml({ icon: "dna01", titel: "No runs yet", text: "Run the audit to see the result.", knopf: "Run again", knopfAttr: "data-upa-nochmal" });
      } else if (!mitErgebnis) {
        html = identHtml(d) + laufzeileHtml(d) + ohneErgebnisHtml(d) + (d.runs.length > 1 ? laeufeHtml(d) : '');
      } else {
        var r = reiter();
        if (r === "checks") html = checksHtml(d);
        else if (r === "evidence") html = messwerteHtml(d) + belegeHtml(d);
        else if (r === "runs") html = laeufeHtml(d) + laufDetailsHtml(d);
        else html = identHtml(d) + laufzeileHtml(d) + teilHinweisHtml(s.run) + kpiHtml(d) + zugangHinweisHtml(d) + plattformenHtml(d) + befundeHtml(d);
      }
      elDetail.innerHTML = html;
      var lb = elDetail.querySelector("[data-upa-ladebild]");
      if (lb && UC.makeLadebild) {
        ladebild = UC.makeLadebild(lb, { icon: "dna01", name: s.run.status === "queued" ? "Waiting to start" : "Auditing this page",
          saetze: ["This usually takes less than 3 minutes.", "You can leave this page, the audit keeps running."] });
        if (ladebild && ladebild.start) ladebild.start();
      }
    }
    elDetail.addEventListener("click", function (e) {
      if (e.target.closest("[data-upa-zurueck]")) { zurListe(true); return; }
      if (e.target.closest("[data-upa-nochmal]")) { nochmal(); return; }
      if (e.target.closest(".upa-mehrlaeufe")) { state.alleLaeufe = true; detailZeichnen(); return; }
      if (e.target.closest("[data-upa-roh]")) { rohdatenLaden(e.target.closest("[data-upa-roh]")); return; }
      var pr = e.target.closest(".upa-paufklapp[data-upa-profil]");
      if (pr) { profilUmschalten(pr); return; }
      var k = e.target.closest(".upa-befund-kopf");
      if (k) {
        var b = k.closest("[data-befund]"), schl = b.getAttribute("data-befund");
        var auf = !state.offen[schl];
        /* Die angeklickte Zeile bleibt an ihrer Stelle (UC.zeileHalten, CLAUDE.md 1d "Aufklapper"). */
        var aendern = function () {
          if (auf) state.offen[schl] = true; else delete state.offen[schl];
          b.classList.toggle("is-offen", auf);
          k.setAttribute("aria-expanded", String(auf));
          b.querySelector(".upa-befund-koerper").hidden = !auf;
          b.querySelector(".upa-befund-chev").innerHTML = UC.icon(auf ? "chevronUp" : "chevronDown", 2);
        };
        if (UC.zeileHalten) UC.zeileHalten(k, aendern); else aendern();
        return;
      }
      var lauf = e.target.closest(".upa-lauf[data-run-id]");
      if (lauf) laufWaehlen(lauf.getAttribute("data-run-id"));
    });
    /* Profilansicht: eine Plattformzeile klappt ihre Befunde auf; die Zeile bleibt an ihrer Stelle
       (UC.zeileHalten), das Zeichen wird getauscht, nie gedreht. */
    function profilUmschalten(pr) {
      var id = pr.getAttribute("data-upa-profil"), koerper = document.getElementById(pr.getAttribute("aria-controls"));
      if (!koerper) return;
      var auf = !state.profilOffen[id];
      var aendern = function () {
        if (auf) state.profilOffen[id] = true; else delete state.profilOffen[id];
        pr.classList.toggle("is-offen", auf);
        pr.setAttribute("aria-expanded", String(auf));
        koerper.hidden = !auf;
        var ch = pr.querySelector(".upa-befund-chev");
        if (ch) ch.innerHTML = UC.icon(auf ? "chevronUp" : "chevronDown", 2);
      };
      if (UC.zeileHalten) UC.zeileHalten(pr, aendern); else aendern();
    }
    elDetail.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var pr = e.target.closest && e.target.closest(".upa-paufklapp[data-upa-profil]");
      if (pr && e.target === pr) { e.preventDefault(); profilUmschalten(pr); return; }
      var lauf = e.target.closest && e.target.closest(".upa-lauf[data-run-id]");
      if (lauf && e.target === lauf) { e.preventDefault(); laufWaehlen(lauf.getAttribute("data-run-id")); }
    });
    function laufWaehlen(id) {
      var d = dasDetail();
      if (!d || (d.selected && d.selected.run.id === id)) return;
      /* Der neueste Lauf mit Ergebnis ist die Vorgabe der DB -- dann ohne run_id in der Adresse. */
      state.runId = id;
      reiterSetzen("overview");
      adresseSetzen(state.pageId, id, false);
      zeigen();
      detailLaden({});
    }

    /* ---- Rohdaten (Sicherheitspruefung, UMSETZUNGSPLAN 17) -----------------------------------------
       Der Bucket page-audits ist privat und hat keine Regel fuer Clients. Die Route der App prueft mit dem
       Token des Nutzers die Mitgliedschaft (get_page_audit_v1 fuer genau diesen Lauf) und gibt eine kurz
       gueltige signierte Adresse zurueck (createSignedUrl mit download, Dateiname .json). Hier nur: fragen,
       pruefen, dass es eine https-Adresse ist, und hinnavigieren -- der Browser laedt die Datei. */
    function rohdatenLaden(knopf) {
      var d = dasDetail(), s = d && d.selected, id = knopf.getAttribute("data-upa-roh");
      if (!s || !D.uuidOk(id) || knopf.disabled) return;
      knopf.disabled = true;
      var holen = UC.sitzungsToken ? UC.sitzungsToken() : Promise.resolve("");
      holen.then(function (token) {
        return fetch("/api/page-audit/rohdaten", {
          method: "POST", credentials: "omit", cache: "no-store",
          headers: { "content-type": "application/json", "authorization": "Bearer " + (token || "") },
          body: JSON.stringify({ team_id: team(), page_id: d.page.id, run_id: s.run.id, observation_id: id })
        }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j || {} }; }); });
      }).then(function (x) {
        knopf.disabled = false;
        var url = x && x.status === 200 ? str(x.j.url) : "";
        if (/^https:\/\//i.test(url)) { window.location.assign(url); return; }
        var satz = x && x.status === 410 ? "These raw data have expired." :
                   x && (x.status === 401 || x.status === 403) ? "You don't have access to these raw data." :
                   "The raw data can't be downloaded right now. Please try again later.";
        UC.toast(t(satz), { kind: "error" });
      }, function () {
        knopf.disabled = false;
        UC.toast(t("Check your connection and try again."), { kind: "error" });
      });
    }

    /* ---- Aktionen ------------------------------------------------------------------------------- */
    var schreibt = false;
    function nochmal() {
      var d = dasDetail();
      if (!d || schreibt) return;
      schreibt = true;
      var knopf = elKopf.querySelector(".upa-nochmal");
      if (knopf) knopf.disabled = true;
      UC.rpc(D.FN.anlegen, { p_team: team(), p_url: d.page.fetchUrl || d.page.url, p_idempotency_key: D.schluessel() }, { timeoutMs: 20000 }).then(function (erg) {
        schreibt = false;
        if (knopf) knopf.disabled = false;
        var q = erg && erg.ok ? D.zuQuittung(erg.daten) : null;
        if (!q) { UC.toast(D.fehlerSatz(erg, { t: t, datum: UC.fmtDate, sonst: "The audit couldn't be started. Please try again." }).satz, { kind: "error", roh: true }); return; }
        UC.toast(t(q.deduplicated && !q.replayed ? "This page is already being audited" : "Audit started"), { kind: "success" });
        aufListeStale();
        /* Zurueck auf die Vorgabe (neuestes Ergebnis): der neue Lauf steht dann in der Laufzeile. */
        if (state.runId) { state.runId = ""; adresseSetzen(state.pageId, "", false); }
        detailLaden({ leise: !!dasDetail() });
      });
    }
    function abbrechen() {
      var d = dasDetail(), a = aktiverLauf(d);
      if (!a || schreibt) return;
      schreibt = true;
      UC.rpc(D.FN.abbrechen, { p_team: team(), p_run_id: a.id }, { timeoutMs: 20000 }).then(function (erg) {
        schreibt = false;
        if (!erg || !erg.ok) { UC.toast(D.fehlerSatz(erg, { t: t }).satz, { kind: "error", roh: true }); return; }
        var st = erg.daten && erg.daten.status;
        UC.toast(t(st === "cancelled" ? "Audit cancelled" : (st === "running" ? "Stopping the audit…" : "Audit cancelled")), { kind: st === "running" ? "neutral" : "success" });
        aufListeStale();
        detailLaden({ leise: true });
      });
    }
    function planSetzen(plan) {
      var d = dasDetail();
      if (!d || schreibt || plan === d.page.schedule) return;
      schreibt = true;
      UC.rpc(D.FN.plan, { p_team: team(), p_page_id: d.page.id, p_schedule: plan }, { timeoutMs: 20000 }).then(function (erg) {
        schreibt = false;
        if (!erg || !erg.ok) { UC.toast(D.fehlerSatz(erg, { t: t }).satz, { kind: "error", roh: true }); return; }
        var o = erg.daten || {};
        d.page.schedule = str(o.schedule) || plan; d.page.nextRunAt = str(o.next_run_at);
        /* schedule_capacity der Antwort zaehlt ALLE Seiten, das Detail zeigt die ohne diese -- also nicht
           uebernehmen, das leise Nachladen unten holt den richtigen Wert. */
        UC.toast(t("Schedule updated"), { kind: "success",
          desc: d.page.schedule !== "once" && d.page.nextRunAt ? t("Next run {date}.").replace("{date}", zeit(d.page.nextRunAt)) : "" });
        aufListeStale();
        detailZeichnen(); kopfZeichnen();
        detailLaden({ leise: true });
      });
    }
    function loeschenFragen() {
      var d = dasDetail();
      if (!d) return;
      UC.makeModal({
        titel: "Delete Audit", isDark: isDark,
        inhaltHtml: '<div class="up-modal-saetze"><p class="up-modal-hinweis">' +
          esc(t("This deletes the audit of {url} with all its runs and results. This can't be undone.").replace("{url}", kurz(d.page.url))) + '</p>' +
          '<p class="up-modal-hinweis">' + esc(t("Audits already used this week stay used.")) + '</p></div>' +
          '<div class="up-fehlerzeile upa-loeschfehler" role="alert"><span></span></div>',
        knoepfe: [
          { id: "ab", text: "Cancel", art: "sec" },
          { id: "weg", text: "Delete Audit", art: "gefahr", aktion: function (api) {
            var fz = api.body.querySelector(".upa-loeschfehler");
            api.busy("weg", true);
            UC.rpc(D.FN.loeschen, { p_team: team(), p_page_id: d.page.id }, { timeoutMs: 20000 }).then(function (erg) {
              api.busy("weg", false);
              if (!erg || !erg.ok) { fz.firstChild.textContent = D.fehlerSatz(erg, { t: t }).satz; fz.classList.add("is-on"); return; }
              api.schliessen();
              UC.toast(t("Audit deleted"), { kind: "success" });
              Object.keys(DET).forEach(function (k) { if (k.indexOf(d.page.id + "|") === 0) delete DET[k]; });
              aufListeStale();
              zurListe(true);
            });
            return false;
          } }
        ]
      });
    }
    /* Nach jeder Aenderung: die Liste beim naechsten Zeigen leise neu (Zahlen, Zeitplan, Kontingent). */
    function aufListeStale() { L.alt = true; }

    /* ============================================================================================
       Ansicht, Adresse, Nachladen
       ============================================================================================ */
    function adresseLesen() {
      var q;
      try { q = new URLSearchParams(window.location.search); } catch (e) { q = null; }
      var pid = q ? str(q.get("page_id")).trim() : "", rid = q ? str(q.get("run_id")).trim() : "";
      return { pageId: D.uuidOk(pid) ? pid : "", runId: D.uuidOk(rid) ? rid : "" };
    }
    function adresseSetzen(pageId, runId, neuerEintrag) {
      try {
        var u = new URL(window.location.href);
        if (pageId) u.searchParams.set("page_id", pageId); else u.searchParams.delete("page_id");
        if (pageId && runId) u.searchParams.set("run_id", runId); else u.searchParams.delete("run_id");
        var neu = u.pathname + u.search + u.hash;
        if (neu === window.location.pathname + window.location.search + window.location.hash) return;
        if (neuerEintrag) window.history.pushState(window.history.state, "", neu);
        else window.history.replaceState(window.history.state, "", neu);
      } catch (e) {}
    }
    function zeigen() {
      var detail = state.ansicht === "detail";
      elListe.hidden = detail; elDetail.hidden = !detail;
      if (elStart) elStart.hidden = detail;
      if (!detail) navZeigen(false);
      root.classList.toggle("is-detail", detail);
      kopfZeichnen(); krumenNeu();
      if (detail) detailZeichnen();
      else { tabelleZeichnen(); kleben(); }
    }
    function detailOeffnen(pageId, runId, neuerEintrag) {
      if (!D.uuidOk(pageId)) return;
      var gleich = state.ansicht === "detail" && state.pageId === pageId && state.runId === (runId || "");
      state.ansicht = "detail"; state.pageId = pageId; state.runId = runId || ""; state.alleLaeufe = false;
      adresseSetzen(pageId, state.runId, !!neuerEintrag);
      zeigen();
      try { var main = document.getElementById("main"); if (main && !gleich) main.scrollTop = 0; } catch (e) {}
      detailLaden({ leise: gleich || !!dasDetail() });
    }
    function zurListe(neuerEintrag) {
      state.ansicht = "liste"; state.pageId = ""; state.runId = "";
      adresseSetzen("", "", !!neuerEintrag);
      zeigen();
      if (!L.hatDaten || L.alt) listeLaden({ leise: L.hatDaten && !L.fehler });
    }
    function ausAdresse() {
      var a = adresseLesen();
      if (a.pageId) detailOeffnen(a.pageId, a.runId, false);
      else if (state.ansicht !== "liste" || !L.hatDaten) zurListe(false);
    }
    window.addEventListener("popstate", function () {
      if (!root.isConnected || (UC.currentView && UC.currentView() && UC.currentView() !== "audits")) return;
      ausAdresse();
    });
    window.addEventListener("up-page-audit-open", function (e) {
      if (!root.isConnected) return;
      var dt = (e && e.detail) || {};
      if (D.uuidOk(dt.pageId)) detailOeffnen(dt.pageId, dt.runId || "", false);
    });
    if (UC.ansichtsParameter) UC.ansichtsParameter({ ansicht: "audits", schluessel: ["page_id", "run_id"], owner: root,
      onTeamWechsel: function () { leeren(); state.ansicht = "liste"; state.pageId = ""; state.runId = ""; zeigen(); } });
    if (UC.onViewChange) UC.onViewChange(function (v) {
      if (!root.isConnected || v !== "audits") return;
      /* Nach dem Wechsel liest die Seite die Adresse (ein Einstieg von aussen hat page_id gesetzt)
         und holt leise nach, was sich inzwischen getan hat. */
      setTimeout(function () {
        var a = adresseLesen();
        if (a.pageId && (a.pageId !== state.pageId || a.runId !== state.runId || state.ansicht !== "detail")) detailOeffnen(a.pageId, a.runId, false);
        else if (!a.pageId && state.ansicht === "detail") zurListe(false);
        else if (state.ansicht === "detail") detailLaden({ leise: true });
        else listeLaden({ leise: L.hatDaten && !L.fehler });
      }, 0);
    });
    function leeren() {
      L.daten = null; L.hatDaten = false; L.fehler = ""; L.page = 1; L.alt = true;
      Object.keys(DET).forEach(function (k) { delete DET[k]; });
    }
    /* Das erste Team (Direkteinstieg: es kommt aus app_start erst nach dem Aufbau) laedt; ein
       Wechsel leert und geht zur Liste -- page_id gehoert zum alten Team. */
    function ersterLaden() {
      if (state.ansicht === "detail") detailLaden({ leise: !!dasDetail() });
      else listeLaden({ leise: L.hatDaten && !L.fehler });
    }
    if (UC.onTeamChange) UC.onTeamChange(function () {
      var neu = team();
      if (!neu || gem.team === neu) return;
      var vorher = gem.team;
      gem.team = neu;
      if (vorher) { leeren(); state.ansicht = "liste"; state.pageId = ""; state.runId = ""; adresseSetzen("", "", false); zeigen(); }
      ersterLaden();
    }, root);

    /* Leises Nachladen, solange etwas laeuft (HANDOFF 16: 2 s in den ersten 20 s, dann 5 s). */
    var uhr = null;
    function planen() {
      if (uhr) { clearTimeout(uhr); uhr = null; }
      if (!root.isConnected) return;
      var ms = 0;
      if (state.ansicht === "detail") {
        var a = aktiverLauf(dasDetail());
        if (a) ms = Date.now() - new Date(a.acceptedAt).getTime() < 20000 ? 2000 : 5000;
      } else if (L.daten && L.daten.rows.some(function (r) { return r.latest && D.laeuft(r.latest.status); })) ms = 5000;
      if (!ms) return;
      uhr = setTimeout(function () {
        uhr = null;
        if (!sichtbar(root) || (typeof document.hidden === "boolean" && document.hidden)) { beiSicht(root, "nachladen", planenNachSicht, sichtbar); return; }
        if (state.ansicht === "detail") detailLaden({ leise: true }); else listeLaden({ leise: true });
      }, ms);
    }
    function planenNachSicht() { if (state.ansicht === "detail") detailLaden({ leise: true }); else listeLaden({ leise: true }); }
    document.addEventListener("visibilitychange", function () { if (!document.hidden && root.isConnected && !uhr) planen(); });

    var ctrl = { root: root, neuLaden: function () { leeren(); ausAdresse(); if (state.ansicht === "liste") listeLaden({}); } };
    root.__upaCtrl = ctrl;
    /* Erster Stand: das gemerkte Detail bzw. die gemerkte Liste sofort (Neuaufbau ohne Skelett), dann
       die Adresse. Ohne Team wartet die Seite auf setUpstreemTeam (onTeamChange oben). */
    gem.team = team() || gem.team;
    var start = adresseLesen();
    if (start.pageId) { state.ansicht = "detail"; state.pageId = start.pageId; state.runId = start.runId; }
    zeigen();
    if (team()) ersterLaden();
    return ctrl;
  }

  function alle() { return [].slice.call(document.querySelectorAll(".upa-root")); }
  function einrichten() {
    alle().forEach(function (r) {
      if (r.__upaCtrl) return;
      if (messbar(r)) { try { initRoot(r); } catch (e) { if (window.console) console.error("[page-audit] initRoot:", e); } return; }
      var neu = !(UC.wartetAufSicht && UC.wartetAufSicht(r));
      beiSicht(r, "einrichten", function () { try { initRoot(r); } catch (e) { if (window.console) console.error("[page-audit] initRoot:", e); } }, messbar, { lang: neu });
    });
  }
  if (UC.watchRoots) UC.watchRoots("upa-root", einrichten);
  einrichten();
  }

  upaBoot(30);
})();
