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
     set_page_audit_schedule_v1    Not Scheduled, Weekly, Monthly (nur im fertigen Audit)
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

  /* Deutsch fuer die Seite (Katalog app-weit: nur Schluessel, die core nicht schon traegt). Die neuen Texte aus v2 sind alle
     uebersetzt; aeltere lange Saetze der Befunde aus der ersten Fassung koennen noch englisch sein. */
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
    "Weekly": "Wöchentlich", "Monthly": "Monatlich",
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
    "Time": "Zeit", "Raw data": "Rohdaten", "Date": "Datum", "Trigger": "Auslöser", "Check": "Check",
    /* v2 (22.10.): neue Texte aus Canvas v8. */
    "A new audit is running: {phase}.": "Ein neues Audit läuft: {phase}.",
    "AI platforms with no access block and all required measurements done.": "KI-Plattformen ohne Zugangssperre, bei denen alle nötigen Messungen gelaufen sind.",
    "All measurements": "Alle Messwerte",
    "All {y} passed.": "Alle {y} bestanden.",
    "Allowed": "Erlaubt",
    "As a visitor": "Als Besucher",
    "As each crawler": "Als die einzelnen Crawler",
    "Assessing": "Bewerten",
    "Auditing for {s}": "Audit läuft seit {s}",
    "Block access for a platform.": "Sperren den Zugang für eine Plattform.",
    "Blocked": "Gesperrt",
    "Blocks added by JavaScript": "Durch JavaScript ergänzte Blöcke",
    "Browser": "Browser",
    "Check whether AI search platforms can reach a page and read its text.": "Prüfe, ob KI-Suchen eine Seite erreichen und ihren Text lesen können.",
    "Checking robots.txt and access rules": "robots.txt und Zugriffsregeln prüfen",
    "Chromium, up to 10 seconds, no clicks": "Chromium, bis zu 10 Sekunden, ohne Klicks",
    "Comparing and assessing the results": "Ergebnisse vergleichen und bewerten",
    "Copy for developer": "Für Entwickler kopieren",
    "Crawler": "Crawler",
    "Crawler user agents": "User Agents der Crawler",
    "Different": "Anders",
    "Different response": "Andere Antwort",
    "Directives": "Direktiven",
    "Download": "Herunterladen",
    "Gemini draws on Google's index. Google-Extended is only a robots.txt rule.": "Gemini nutzt den Google-Index. Google-Extended ist nur eine Regel in der robots.txt.",
    "How to fix": "So behebst du es",
    "Indexing allowed": "Indexierung erlaubt",
    "Languages": "Sprachen",
    "Limited": "Eingeschränkt",
    "May limit how the page is used.": "Können einschränken, wie die Seite genutzt wird.",
    "Measured": "Gemessen",
    "Needs attention": "Braucht Aufmerksamkeit",
    "No issue": "Kein Problem",
    "No noindex in headers or HTML": "Kein noindex in Headern oder HTML",
    "No nosnippet or max-snippet": "Kein nosnippet oder max-snippet",
    "No screenshot for this run: the page took too long to finish loading.": "Kein Screenshot für diesen Lauf: Die Seite hat zu lange zum Laden gebraucht.",
    "No screenshot: our browser didn't open the page in this run.": "Kein Screenshot: Unser Browser hat die Seite in diesem Lauf nicht geöffnet.",
    "No screenshot: robots.txt asks us not to open this page.": "Kein Screenshot: Die robots.txt bittet uns, diese Seite nicht zu öffnen.",
    "No screenshot: robots.txt couldn't be read, so we didn't open the page.": "Kein Screenshot: Die robots.txt war nicht lesbar, deshalb haben wir die Seite nicht geöffnet.",
    "No screenshot: the page is only reachable over IPv6.": "Kein Screenshot: Die Seite ist nur über IPv6 erreichbar.",
    "No screenshot: we didn't open the page to avoid too many requests to this site.": "Kein Screenshot: Wir haben die Seite nicht geöffnet, um diese Website nicht mit Anfragen zu überlasten.",
    "Not Scheduled": "Nicht geplant",
    "Not Scheduled. Runs when you start it.": "Nicht geplant. Läuft, wenn du es startest.",
    "Nothing found that only appears after JavaScript": "Nichts gefunden, was erst nach JavaScript erscheint",
    "One thing to fix on this page.": "Eine Sache auf dieser Seite zu beheben.",
    "Only after JavaScript, for example": "Erst nach JavaScript, zum Beispiel",
    "Other crawlers of {platform}:": "Weitere Crawler von {platform}:",
    "Other pages already use {used} of the {n}.": "Andere Seiten nutzen schon {used} der {n}.",
    "Our user agent": "Unser User Agent",
    "Own crawler": "Eigener Crawler",
    "Page loads for {token}": "Seite lädt für {token}",
    "Partly": "Teilweise",
    "Rendering": "Rendern",
    "Rendering the page in a browser and taking a screenshot": "Seite im Browser rendern und Screenshot aufnehmen",
    "Requesting the page": "Seite abrufen",
    "Requesting the page like the AI crawlers": "Seite abrufen wie die KI-Crawler",
    "Requests": "Abrufe",
    "Required measurements completed.": "Nötige Messungen abgeschlossen.",
    "Restriction": "Sperre",
    "Restrictions first, then by severity.": "Sperren zuerst, dann nach Schwere.",
    "Run Audit": "Audit starten",
    "Same as a visitor": "Wie für Besucher",
    "Saving": "Speichern",
    "Saving the result": "Ergebnis speichern",
    "Screenshot of {page} as our browser rendered it": "Screenshot von {page}, wie unser Browser sie dargestellt hat",
    "See finding": "Zum Befund",
    "Starting": "Starten",
    "Starting the test environment": "Testumgebung starten",
    "Test conditions": "Testbedingungen",
    "Text after JavaScript": "Text nach JavaScript",
    "Text in the initial HTML": "Text im ersten HTML",
    "Text previews allowed": "Textvorschau erlaubt",
    "Text that only appears after JavaScript": "Text, der erst nach JavaScript erscheint",
    "Text without JavaScript": "Text ohne JavaScript",
    "The screenshot couldn't be loaded.": "Der Screenshot konnte nicht geladen werden.",
    "The screenshot was deleted after 90 days.": "Der Screenshot wurde nach 90 Tagen gelöscht.",
    "This text, for example, is only there afterwards:": "Dieser Text steht zum Beispiel erst danach da:",
    "Unclear": "Unklar",
    "Up to {n} audits a week can run on a schedule.": "Bis zu {n} Audits pro Woche können geplant laufen.",
    "Up to {n} of your {all} weekly audits can run on a schedule, so {rest} always stay free for audits you start yourself.": "Bis zu {n} deiner {all} Audits pro Woche können geplant laufen, damit {rest} immer frei bleiben für Audits, die du selbst startest.",
    "Waiting for {s}": "Wartet seit {s}",
    "Waiting in the queue": "In der Warteschlange",
    "We request one URL with the crawler names of seven AI search platforms and check what can stop them: robots.txt rules for each crawler, the response and redirects, noindex and snippet rules, and how much of the text is there before JavaScript runs.": "Wir rufen eine URL mit den Crawler-Namen von sieben KI-Suchen ab und prüfen, was sie aufhalten kann: robots.txt-Regeln je Crawler, Antwort und Weiterleitungen, noindex- und Snippet-Regeln und wie viel Text schon vor JavaScript da ist.",
    "We sent the requests with each platform's crawler name from our servers. The real crawlers may get a different response.": "Wir haben die Anfragen mit dem Crawler-Namen jeder Plattform von unseren Servern geschickt. Die echten Crawler können eine andere Antwort bekommen.",
    "Weekly counts as 1 audit a week, monthly as ¼.": "Wöchentlich zählt als 1 Audit pro Woche, monatlich als ¼.",
    "What an audit checks": "Was ein Audit prüft",
    "What each AI search platform gets when it requests this page.": "Was jede KI-Suche bekommt, wenn sie diese Seite abruft.",
    "What to fix": "Was zu beheben ist",
    "What we found": "Was wir gefunden haben",
    "What your server sends, next to what our browser shows after running scripts.": "Was dein Server schickt, neben dem, was unser Browser nach den Skripten zeigt.",
    "Why it matters": "Warum das wichtig ist",
    "Without and with JavaScript": "Ohne und mit JavaScript",
    "characters in our browser": "Zeichen in unserem Browser",
    "characters, before any script runs": "Zeichen, bevor ein Skript läuft",
    "different from a visitor": "anders als für Besucher",
    "in the rules for this crawler": "in den Regeln für diesen Crawler",
    "robots.txt couldn't be evaluated for this crawler.": "Die robots.txt ließ sich für diesen Crawler nicht auswerten.",
    "same response as a visitor": "gleiche Antwort wie für Besucher",
    "text blocks of the rendered page": "Textblöcke der gerenderten Seite",
    "{n} checks.": "{n} Checks.",
    "{x} need attention, {y} passed.": "{x} brauchen Aufmerksamkeit, {y} bestanden.",
    "{x} of {n} characters": "{x} von {n} Zeichen",
    "A crawler or language gets a different response": "Ein Crawler oder eine Sprache bekommt eine andere Antwort",
    "AI Mode uses Google's index. In one test, text added by JavaScript showed up only after the page was indexed.": "AI Mode nutzt den Google-Index. In einem Test tauchte per JavaScript ergänzter Text erst auf, nachdem die Seite indexiert war.",
    "AI Overviews use Google's index, which is built after rendering. Text can be missing until Google has rendered the page.": "AI Overviews nutzen den Google-Index, der nach dem Rendern entsteht. Text kann fehlen, bis Google die Seite gerendert hat.",
    "Address, language and metadata": "Adresse, Sprache und Metadaten",
    "All measurements were completed": "Alle Messungen wurden abgeschlossen",
    "Allow the search crawler on this path if this page should appear in AI search. Training crawlers can stay blocked.": "Erlaube den Such-Crawler auf diesem Pfad, wenn die Seite in der KI-Suche erscheinen soll. Trainings-Crawler können gesperrt bleiben.",
    "Allow {token} on this path if this page should appear in {platform}. Training crawlers can stay blocked.": "Erlaube {token} auf diesem Pfad, wenn die Seite in {platform} erscheinen soll. Trainings-Crawler können gesperrt bleiben.",
    "Check it with View Source in your browser: the text should be there before any script runs.": "Prüfe es mit der Quelltextansicht im Browser: Der Text sollte da sein, bevor ein Skript läuft.",
    "Checked for Google and Bing": "Für Google und Bing geprüft",
    "Copilot answers from the Bing index. Tests show mixed results for text added by JavaScript.": "Copilot antwortet aus dem Bing-Index. Tests zeigen gemischte Ergebnisse für per JavaScript ergänzten Text.",
    "Crawlers and languages get the same page": "Crawler und Sprachen bekommen dieselbe Seite",
    "Different before and after rendering": "Vor und nach dem Rendern verschieden",
    "Find the rule shown above in your robots.txt.": "Such die oben gezeigte Regel in deiner robots.txt.",
    "Gemini answers and training": "Gemini-Antworten und Training",
    "Gemini answers from Google's index. Pages that aren't indexed yet have been seen read as initial HTML only.": "Gemini antwortet aus dem Google-Index. Noch nicht indexierte Seiten wurden schon nur als erstes HTML gelesen.",
    "JavaScript changes the directives": "JavaScript ändert die Direktiven",
    "JavaScript doesn't change the directives": "JavaScript ändert die Direktiven nicht",
    "No canonical tag": "Kein Canonical-Tag",
    "No noindex": "Kein noindex",
    "No nosnippet, max-snippet or data-nosnippet": "Kein nosnippet, max-snippet oder data-nosnippet",
    "No overlays, paywalls or password fields": "Keine Overlays, Paywalls oder Passwortfelder",
    "No redirects": "Keine Weiterleitungen",
    "No text depends on JavaScript": "Kein Text hängt von JavaScript ab",
    "Nothing covers the content without clicks": "Nichts verdeckt den Inhalt ohne Klicks",
    "Nothing detected": "Nichts gefunden",
    "Overlay or password field found": "Overlay oder Passwortfeld gefunden",
    "Redirects end at this page": "Weiterleitungen enden auf dieser Seite",
    "Run the audit again.": "Starte das Audit noch einmal.",
    "Same before and after rendering": "Vor und nach dem Rendern gleich",
    "Screenshot": "Screenshot",
    "Send the main text in the HTML from your server, with server-side rendering, static generation or pre-rendering.": "Schick den Haupttext im HTML von deinem Server, mit Server-Side Rendering, statischer Generierung oder Pre-Rendering.",
    "Several AI platforms have been seen fetching pages without running JavaScript when they answer a question. For them, this page has no main text. The list below shows which platforms and how sure that is.": "Mehrere KI-Plattformen wurden dabei beobachtet, wie sie Seiten ohne JavaScript abrufen, wenn sie eine Frage beantworten. Für sie hat diese Seite keinen Haupttext. Die Liste unten zeigt, welche Plattformen das sind und wie sicher das ist.",
    "Several AI platforms have been seen fetching pages without running JavaScript when they answer a question. For them, this page is shorter than what your visitors read. The list below shows which platforms and how sure that is.": "Mehrere KI-Plattformen wurden dabei beobachtet, wie sie Seiten ohne JavaScript abrufen, wenn sie eine Frage beantworten. Für sie ist diese Seite kürzer als das, was deine Besucher lesen. Die Liste unten zeigt, welche Plattformen das sind und wie sicher das ist.",
    "Some measurements are missing": "Einige Messungen fehlen",
    "Some of the page text is added by JavaScript": "Ein Teil des Seitentexts kommt per JavaScript",
    "Some of the page text needs JavaScript": "Ein Teil des Seitentexts braucht JavaScript",
    "Something may cover the content": "Etwas könnte den Inhalt verdecken",
    "Systems that read only this HTML get a page without its main text.": "Systeme, die nur dieses HTML lesen, bekommen eine Seite ohne Haupttext.",
    "Systems that read only this HTML get less text than your visitors.": "Systeme, die nur dieses HTML lesen, bekommen weniger Text als deine Besucher.",
    "Text and rendering": "Text und Rendern",
    "Text previews are allowed": "Textvorschau ist erlaubt",
    "Text previews are limited": "Textvorschau ist eingeschränkt",
    "The canonical address is this page": "Die kanonische Adresse ist diese Seite",
    "The canonical address is unclear": "Die kanonische Adresse ist unklar",
    "The initial HTML has no readable main text": "Das erste HTML hat keinen lesbaren Haupttext",
    "The initial HTML has readable main text": "Das erste HTML hat lesbaren Haupttext",
    "The language is declared": "Die Sprache ist angegeben",
    "The language signals disagree": "Die Sprachsignale widersprechen sich",
    "The page didn't load for a normal request": "Die Seite lädt bei einem normalen Abruf nicht",
    "The page is in your sitemap": "Die Seite steht in deiner Sitemap",
    "The page is missing from your sitemap": "Die Seite fehlt in deiner Sitemap",
    "The page loads for a normal request": "Die Seite lädt bei einem normalen Abruf",
    "The page may be a challenge, login or error page": "Die Seite könnte eine Prüf-, Login- oder Fehlerseite sein",
    "The page shows content, not a challenge or login": "Die Seite zeigt Inhalt, keine Prüf- oder Loginseite",
    "The platform's search crawler is asked not to fetch this page.": "Der Such-Crawler der Plattform wird gebeten, diese Seite nicht abzurufen.",
    "The redirects don't end at a usable page": "Die Weiterleitungen enden nicht auf einer nutzbaren Seite",
    "The search crawler of a platform reads robots.txt before it fetches a page. A rule that excludes it keeps this page out of that platform's search, while training crawlers are a separate decision.": "Der Such-Crawler einer Plattform liest die robots.txt, bevor er eine Seite abruft. Eine Regel, die ihn ausschließt, hält diese Seite aus der Suche dieser Plattform heraus. Trainings-Crawler sind eine eigene Entscheidung.",
    "Title, description and structured data are present": "Titel, Beschreibung und strukturierte Daten sind da",
    "Title, description or structured data are missing": "Titel, Beschreibung oder strukturierte Daten fehlen",
    "When ChatGPT opens this page to answer a question, it has been seen reading only the initial HTML.": "Wenn ChatGPT diese Seite öffnet, um eine Frage zu beantworten, wurde beobachtet, dass es nur das erste HTML liest.",
    "When Claude opens this page, it has been seen reading only the initial HTML.": "Wenn Claude diese Seite öffnet, wurde beobachtet, dass es nur das erste HTML liest.",
    "When Perplexity opens this page to answer a question, it has been seen reading only the initial HTML.": "Wenn Perplexity diese Seite öffnet, um eine Frage zu beantworten, wurde beobachtet, dass es nur das erste HTML liest.",
    "robots.txt allows every search crawler": "Die robots.txt erlaubt jeden Such-Crawler",
    "robots.txt could be read": "Die robots.txt war lesbar",
    "robots.txt couldn't be read": "Die robots.txt war nicht lesbar",
    "user requests": "Nutzeranfragen",
    "Conditional: applies when the platform fetches the page itself.": "Bedingt: gilt, wenn die Plattform die Seite selbst abruft.",
    "Unverified: no published test has measured it for this platform yet.": "Unbestätigt: Noch kein veröffentlichter Test hat das für diese Plattform gemessen.",
    "Nothing to fix on this page.": "Nichts zu beheben auf dieser Seite.",
    "These were found before but could not be measured the same way in this run, so they are not counted as resolved.": "Diese wurden vorher gefunden, ließen sich in diesem Lauf aber nicht gleich messen. Deshalb zählen sie nicht als behoben.",
    "Documented": "Dokumentiert",
    "Conditional": "Bedingt",
    "Unverified": "Unbestätigt",
    "The platform documents this behavior.": "Die Plattform dokumentiert dieses Verhalten."
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
      { value: "checks", label: "Checks", icon: UC.icon("shieldCheck", 2) },
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
      /* v2 (Lukas, 21.10. nachts, Canvas v8 "1 Start A"): Ueberschrift, darunter EIN kurzer Satz, was es ist; darunter eine
         kleinere Karte mit der genaueren Erklaerung, was getestet wird, und unten rechts "Run Audit ->". Keine Zeile neben
         dem Knopf (22.10.: keine Erklaerzeilen unter Bauteilen). */
      var START = { titel: "Technical page audit", unter: "Check whether AI search platforms can reach a page and read its text." };
      return '<section class="upa-start">' +
        '<div class="upa-start-text"><h2 class="up-heading up-sec-h">' + esc(t(START.titel)) + '</h2><p class="up-sec-sub">' + esc(t(START.unter)) + '</p></div>' +
        '<div class="up-box upa-startkarte">' +
          '<span class="upa-sk-titel">' + esc(t("What an audit checks")) + '</span>' +
          '<p class="upa-sk-satz">' + esc(t("We request one URL with the crawler names of seven AI search platforms and check what can stop them: robots.txt rules for each crawler, the response and redirects, noindex and snippet rules, and how much of the text is there before JavaScript runs.")) + '</p>' +
          '<div class="upa-sk-fuss">' +
            '<button type="button" class="up-btn-pri upa-sk-los" data-upa-anlegen>' + '<span>' + esc(t("Run Audit")) + "</span>" + UC.icon("arrowRightLong", 2) + '</button></div>' +
        '</div>' +
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
    /* Kurzform des Schritts fuer die Liste (Status steht schon daneben). */
    var SCHRITT_KURZ = { start: "Starting", robots: "Checking robots.txt", fetch: "Requesting the page", render: "Rendering", evaluate: "Assessing", save: "Saving" };
    function laufStatusHtml(la) {
      var f = FORT[la.runId], st = f && f.status ? f.status : la.status;
      var kurz = !gem.fortFehlt && f && st === "running" && f.phase ? SCHRITT_KURZ[f.phase] : "";
      return '<span class="upa-laufstatus" data-upa-lauf="' + esc(la.runId) + '">' + statusHtml(st) + (kurz ? '<span class="upa-leise upa-schritt">' + esc(t(kurz)) + '</span>' : '') + '</span>';
    }
    function laufZellenNeu() {
      if (!L.daten) return;
      L.daten.rows.forEach(function (r) {
        if (!r.latest || !D.laeuft(r.latest.status)) return;
        [].forEach.call(root.querySelectorAll('.upa-laufstatus[data-upa-lauf="' + r.latest.runId + '"]'), function (el) {
          var neu = laufStatusHtml(r.latest);
          if (el.outerHTML !== neu) el.outerHTML = neu;
        });
      });
    }
    function zelleHtml(key, r) {
      var re = r.result, la = r.latest, laeuft = la && D.laeuft(la.status);
      if (key === "result") {
        if (re && re.assessment) return ergebnisHtml(re.assessment);
        if (laeuft) return laufStatusHtml(la);
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
        if (laeuft && re) return laufStatusHtml(la);
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
          var tipOnce = t("Not Scheduled. Runs when you start it.");
          return '<span class="up-sumkeine" data-tip="' + esc(tipOnce) + '" aria-label="' + esc(tipOnce) + '">' + UC.icon("minus", 2) + '</span>';
        }
        var plan = D.PLAN[r.schedule] || "Not Scheduled";
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
      /* Tarif ohne Page Audits: kein "0 of 0 audits this week". */
      if (q.allowance === 0) return '<span class="upa-kontingent is-voll" tabindex="0" data-tip="' + esc(t("Choose a plan with page audits to run one.")) + '">' +
        esc(t("Not included in your plan")) + '</span>';
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
      var plan = D.PLAN[d.page.schedule] || "Not Scheduled";
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
    /* Der Satz zur Grenze der Zeitplaene (v2): was belegt ist, wie viel geht, was ein Zeitplan kostet. Die Kapazitaet
       des Details rechnet OHNE diese Seite (_page_audit_capacity_v1 mit p_page_id) -- "andere Seiten" also. */
    function planGrenzeSatz(k) {
      var q = quota(), von_ = q ? fmtInt(q.allowance) : "";
      /* v2 (Lukas: "was soll das heissen"): zuerst, was die Grenze bedeutet und wozu sie da ist, dann wie gezaehlt wird,
         zuletzt der Stand. Der Rest bis zum Kontingent bleibt immer fuer Audits, die man selbst startet. */
      var rest = q && num(q.allowance) != null && num(k.capacity) != null ? Math.max(0, q.allowance - k.capacity) : null;
      return (q ? t("Up to {n} of your {all} weekly audits can run on a schedule, so {rest} always stay free for audits you start yourself.")
                    .replace("{n}", D.fmtZahl(k.capacity)).replace("{all}", von_).replace("{rest}", rest == null ? "–" : D.fmtZahl(rest))
                : t("Up to {n} audits a week can run on a schedule.").replace("{n}", D.fmtZahl(k.capacity))) + " " +
        t("Weekly counts as 1 audit a week, monthly as ¼.") + " " +
        t("Other pages already use {used} of the {n}.").replace("{used}", viertel(k.used)).replace("{n}", D.fmtZahl(k.capacity));
    }
    /* 1.25 -> "1¼", 0.5 -> "½": monatlich zaehlt ein Viertel, als Dezimalzahl las sich das wie ein Fehler. */
    function viertel(v) {
      var n = Number(v); if (!isFinite(n)) return "–";
      var g = Math.floor(n + 1e-9), r = Math.round((n - g) * 4) / 4;
      var z = { 0.25: "¼", 0.5: "½", 0.75: "¾" }[r] || "";
      return (g || !z ? String(g) : "") + z;
    }
    function planMenuHtml(d) {
      var jetzt = d && d.page ? d.page.schedule : "once", k = kapazitaet();
      var opt = [["once", "Not Scheduled", "Runs only when you start it."], ["weekly", "Weekly", "Runs every week at night."], ["monthly", "Monthly", "Runs once a month at night."]];
      return '<div class="up-pop-head">' + esc(t("Schedule")) + '</div>' +
        opt.map(function (o) {
          return '<div class="up-pop-opt upa-planopt' + (o[0] === jetzt ? " is-active" : "") + '" role="menuitemradio" tabindex="0" aria-checked="' + (o[0] === jetzt) + '" data-plan="' + o[0] + '">' +
            '<span class="upa-planopt-l"><span class="upa-planopt-t">' + esc(t(o[1])) + '</span><span class="upa-planopt-d">' + esc(t(o[2])) + '</span></span>' +
            '<span class="up-check">' + UC.icon("check", 2) + '</span></div>';
        }).join("") +
        (k ? '<div class="up-pop-div"></div><p class="upa-planhinweis">' +
          /* get_page_audit_v1 rechnet die Kapazitaet OHNE diese Seite (_page_audit_capacity_v1 mit p_page_id):
             "used" ist also, was die anderen Seiten belegen. */
          esc(planGrenzeSatz(k)) + '</p>' : '');
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
      /* Tarif ohne Page Audits: derselbe Satz wie die Fehlermeldung aus core, ohne Rueckstelldatum. */
      if (q.allowance === 0) return t("Page audits aren't included in your plan.") + " " + t("Choose a plan with page audits to run one.");
      var s = q.remaining <= 0
        ? t("You've used all {n} audits for this week.").replace("{n}", fmtInt(q.allowance))
        : t("{used} of {n} audits used this week.").replace("{used}", fmtInt(q.used)).replace("{n}", fmtInt(q.allowance));
      if (q.resetsAt) s += " " + t("Resets on {date}.").replace("{date}", UC.fmtDate(q.resetsAt));
      return s;
    }
    /* Zeitplan nur noch im fertigen Audit (Lukas, v2: nicht im Anlegen). Was die Grenze sprengen wuerde, ist im Menue
       gesperrt -- gerechnet wie _page_audit_capacity_v1: weekly 1, monthly 1/4, Platz bis capacity. */
    var PLAN_KOSTEN = { weekly: 1, monthly: 0.25 };
    function planFrei(plan) {
      var k = kapazitaet();
      if (plan === "once" || !k) return true;
      return k.used + PLAN_KOSTEN[plan] <= k.capacity + 1e-9;
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
          '<p class="up-modal-hinweis upa-quotahinweis">' + esc(quotaSatz()) + '</p>',
        knoepfe: [
          { id: "ab", text: "Cancel", art: "sec" },
          { id: "ok", text: "Create Audit", art: "pri", aktion: function (a) { absenden(a); return false; } }
        ]
      });
      var feld = api.body.querySelector(".upa-urlfeld"), fz = api.body.querySelector(".upa-urlfehler"), vor = api.body.querySelector(".upa-vorschlag");
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
            /* Der Zeitplan steht nicht mehr im Anlegen, nur noch in den Einstellungen des fertigen Audits (Lukas, v2). */
            UC.toast(titel, { kind: "success" });
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

    /* v2 (Lukas 22.10., Canvas v8 "4 Kopf A"): die Kennzahlen kompakt links unter der Domain, neben dem Bildschirmfoto, 2 x 2,
       Etikett ueber dem Wert. Die Bedeutung jeder Kennzahl steht in der Erklaerkarte der Kachel (UC.makeExplain), nicht als Zeile
       darunter. Verglichen wird nur zwischen zwei vollstaendigen Laeufen derselben Regeln. */
    function kpiKleinHtml(d) {
      var s = d.selected, r = s && s.run, vor = null;
      if (s && s.previousRunId) for (var i = 0; i < d.runs.length; i++) if (d.runs[i].id === s.previousRunId) { vor = d.runs[i]; break; }
      function voll(x) { return !!x && x.coverageRequired != null && x.coverageSatisfied === x.coverageRequired; }
      var vergleich = !!vor && !s.rulesChanged && voll(r) && voll(vor);
      function tr(a, b, umg) { return vergleich && a != null && b != null && UC.trendChip ? UC.trendChip(a - b, { inverted: !!umg }) : ""; }
      var l = [
        { label: "Reachable", wert: von(r.reachable, r.profiles), trend: tr(r.reachable, vor && vor.reachable), key: "pa_reachable" },
        { label: "Restrictions", wert: r.restrictions == null ? "–" : fmtInt(r.restrictions), trend: tr(r.restrictions, vor && vor.restrictions, true), key: "pa_restrictions" },
        { label: "Potential issues", wert: r.issues == null ? "–" : fmtInt(r.issues), trend: tr(r.issues, vor && vor.issues, true), key: "pa_issues" },
        { label: "Coverage", wert: von(r.coverageSatisfied, r.coverageRequired), trend: "", key: "pa_coverage" }
      ];
      return '<div class="upa-kk">' + l.map(function (x) {
        return '<div class="upa-kk-i" tabindex="0" data-explain="' + esc(x.key) + '"' + (x.trend ? ' data-trend="1"' : '') + '><span class="upa-kk-l">' + esc(t(x.label)) + '</span>' +
          '<span class="upa-kk-w"><span class="up-num">' + esc(x.wert) + '</span>' + (x.trend || '') + '</span></div>';
      }).join("") + '</div>';
    }
    /* ---- v2: Screenshot der geprueften Seite im Browserfenster (Lukas: "oben rechts im Audit Overview") ----------------
       Rahmen wie die Fenster der Startgrafik (Radius 12, drei Punkte, Adresse). Drei Zustaende: Bild, laeuft (Flaeche mit Glanz),
       keins (Satz mit Grund -- ohne Seitenabruf gibt es kein Bild). Das Bild ist ein Angebot ans Backend (Plan v2). */
    /* ---- Bildschirmfoto im Browserfenster (Datei 5): Beobachtung slot "screenshot", kind "browser", 1440 x 900 JPEG.
       Die Adresse kommt NUR aus der Route der App (/api/page-audit/bild: Mitgliedschaft wie bei den Rohdaten, signiert ohne
       download, kurze Laufzeit, nur dieser slot, nur image/jpeg). Je Beobachtung einmal geholt und gemerkt, bis sie abläuft.
       Zustaende: Bild; laedt (Flaeche mit Glanz, auch waehrend der Lauf laeuft); keins mit Grund. */
    var BILD = gem.bild || (gem.bild = {});
    var OHNE_BROWSER = {
      scanner_own_policy_denial: "No screenshot: robots.txt asks us not to open this page.",
      robots_policy_unresolved: "No screenshot: robots.txt couldn't be read, so we didn't open the page.",
      politeness_budget_exceeded: "No screenshot: we didn't open the page to avoid too many requests to this site.",
      target_ipv6_only: "No screenshot: the page is only reachable over IPv6."
    };
    function bildHolen(d, b) {
      var e = BILD[b.id];
      if (e && (e.laedt || e.fehler || (e.url && e.bis > Date.now()))) return;
      BILD[b.id] = { laedt: true };
      var holen = UC.sitzungsToken ? UC.sitzungsToken() : Promise.resolve("");
      holen.then(function (token) {
        return fetch("/api/page-audit/bild", {
          method: "POST", credentials: "omit", cache: "no-store",
          headers: { "content-type": "application/json", "authorization": "Bearer " + (token || "") },
          body: JSON.stringify({ team_id: team(), page_id: d.page.id, run_id: d.selected.run.id, observation_id: b.id })
        }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j || {} }; }); });
      }).then(function (x) {
        var url = x && x.status === 200 ? str(x.j.url) : "";
        /* Nur https oder ein Pfad der App -- nie eine andere Form in src. */
        var gut = /^https:\/\//i.test(url) || /^\/[a-z0-9_\-\/.]+$/i.test(url);
        BILD[b.id] = gut ? { url: url, bis: Date.now() + Math.max(10, (num(x.j.expires_in) || 60) - 10) * 1000 } : { fehler: x && x.status === 410 ? "weg" : "laden" };
        if (state.ansicht === "detail") browserNeu();
      }, function () { BILD[b.id] = { fehler: "laden" }; if (state.ansicht === "detail") browserNeu(); });
    }
    function browserNeu() {
      var d = dasDetail(), alt = d && elDetail.querySelector(".upa-browser");
      if (!alt) return;
      var neu = document.createElement("div"); neu.innerHTML = browserHtml(d);
      if (alt.outerHTML !== neu.firstChild.outerHTML) alt.replaceWith(neu.firstChild);
    }
    function browserHtml(d) {
      var s = d.selected, r = s && s.run, adr = kurz(d.page.fetchUrl || d.page.url);
      var bv = D.bildVon(s ? s.observations : []), b = bv.bild, bild = "";
      function leer(satz) { return '<span class="upa-browser-leer">' + UC.icon("appWindow", 1.8) + '<span>' + esc(t(satz)) + '</span></span>'; }
      var sk = '<span class="upa-browser-sk" aria-hidden="true"></span>';
      if (!r || D.laeuft(r.status) || (aktiverLauf(d) && !(s && (s.run.status === "completed" || s.run.status === "partial")))) bild = sk;
      else if (b && b.artifact && b.artifact.state === "available" && D.uuidOk(b.id)) {
        var e = BILD[b.id];
        if (!e || e.laedt || (e.url && e.bis <= Date.now())) { bildHolen(d, b); bild = sk; }
        else if (e.url) bild = '<img src="' + esc(e.url) + '" alt="' + esc(t("Screenshot of {page} as our browser rendered it").replace("{page}", adr)) + '" loading="lazy"/>';
        else bild = leer(e.fehler === "weg" ? "The screenshot was deleted after 90 days." : "The screenshot couldn't be loaded.");
      }
      else if (b && b.artifact && b.artifact.state === "expired") bild = leer("The screenshot was deleted after 90 days.");
      else if (!bv.browser) bild = leer(OHNE_BROWSER[r.errorCode] || "No screenshot: our browser didn't open the page in this run.");
      else bild = leer("No screenshot for this run: the page took too long to finish loading.");
      return browserRahmen(esc(adr), bild);
    }
    /* Der Rahmen allein (Leiste mit Punkten und Adresse, Bildflaeche 16:10): auch fuers Skelett, damit beim Laden nichts springt. */
    function browserRahmen(adrHtml, bildHtml) {
      return '<figure class="upa-browser">' +
        '<div class="upa-browser-leiste"><span class="upa-browser-punkte" aria-hidden="true"><i></i><i></i><i></i></span><span class="upa-browser-adresse">' + adrHtml + '</span></div>' +
        '<div class="upa-browser-bild">' + bildHtml + '</div>' +
      '</figure>';
    }
    function identHtml(d, o) {
      o = o || {};
      var p = d.page, s = d.selected, r = s && s.run;
      var name = p.title || kurz(p.url), href = sicherHref(p.fetchUrl || p.url);
      var meta = [];
      if (r && r.assessment) meta.push(ergebnisHtml(r.assessment));
      else if (r) meta.push(statusHtml(r.status));
      if (r) meta.push('<span class="upa-metaitem">' + UC.icon("clock", 2) + '<span>' + esc(zeit(r.finishedAt || r.acceptedAt)) + '</span></span>');
      meta.push('<span class="upa-metaitem">' + UC.icon("calendar", 2) + '<span>' + esc(t(D.PLAN[p.schedule] || "Not Scheduled")) +
        (p.schedule !== "once" && p.nextRunAt ? ', ' + esc(t("next {date}").replace("{date}", zeit(p.nextRunAt))) : '') + '</span></span>');
      return '<section class="upa-ident">' + seitenLogo(p.url, true) +
        '<div class="upa-ident-txt">' +
          '<h2 class="up-heading up-sec-h upa-ident-name">' + esc(name) + '</h2>' +
          (href ? '<a class="up-sec-sub upa-ident-url" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer"><span>' + esc(p.fetchUrl || p.url) + '</span>' + UC.icon("externalLink", 2) + '</a>'
                : '<span class="up-sec-sub upa-ident-url">' + esc(p.url) + '</span>') +
          (o.ohneMeta ? '' : '<div class="upa-meta">' + meta.join("") + '</div>') +
        '</div>' +
      '</section>';
    }
    /* Ein laufender Lauf neben einem gezeigten Ergebnis: eine Zeile darueber, das Ergebnis bleibt
       das vorige, bis der neue Lauf fertig ist. */
    function laufzeileHtml(d) {
      var a = aktiverLauf(d), s = d.selected;
      if (!a || (s && s.run.id === a.id)) return "";
      var ph = phasenStand(a).phasen.filter(function (x) { return x.st === "laeuft"; })[0];
      var satz = a.status === "queued" ? t("A new audit is waiting to start.") : t("A new audit is running: {phase}.").replace("{phase}", t(ph ? ph.ph.text : "Auditing this page").replace(/^./, function (c) { return c.toLowerCase(); }));
      return '<div class="upa-laufzeile" role="status">' + statusHtml(a.status) + '<span>' + esc(satz) + ' ' +
        esc(t("Started {time}.").replace("{time}", wann(a.acceptedAt))) + '</span></div>';
    }
    /* Ein Lauf ohne Ergebnis: der wartende/laufende bekommt das Ladebild (lange Laeufe nur ueber
       UC.makeLadebild), der gescheiterte einen Satz mit dem Grund. */
    /* ---- v2: Arbeitsprotokoll statt Ladebild (Lukas: "gerne bei Mira in der Ladeanimation bedienen") ----------------
       Aufbau wie Miras Protokoll (ask-mira.css .am-run): oben die laufende Uhr, darunter je Schritt eine Zeile, die laufende mit
       Spinner und Glanz in der zweiten Textfarbe, fertige in der ersten. Die Schritte kommen aus get_page_audit_progress_v1
       (Datei 5, 21.10.): phase je Lauf, abgefragt alle 1,5 s, solange etwas wartet oder laeuft. Gemessene Zeiten (10 Laeufe fra1):
       start bis 3 s, robots kurz, fetch 3 bis 10 s, render 10 bis 33 s, evaluate Bruchteil, save 1 s.
       Erledigt ist ein Schritt, der vor dem laufenden liegt -- ausser dem Browser: Laeufe ohne Browser (robots-Sperre, 403, nur IPv6)
       springen von fetch weiter, ihn zeigt die Liste nur, wenn wir ihn wirklich laufen sahen. Ohne die Funktion (PGRST202) oder vor
       der ersten Antwort: nur Warten bzw. Laufen, nie erfundene Schritte. Kommende Schritte stehen nicht da (Canvas v8,
       "3 Lauf A"): die Liste waechst mit dem Lauf. */
    var PHASEN = [
      { k: "queued", text: "Waiting in the queue", ic: "clock" },
      { k: "start", text: "Starting the test environment", ic: "zap" },
      { k: "robots", text: "Checking robots.txt and access rules", ic: "fileText" },
      { k: "fetch", text: "Requesting the page like the AI crawlers", ic: "globe", logos: true },
      { k: "render", text: "Rendering the page in a browser and taking a screenshot", ic: "appWindow", bedingt: true },
      { k: "evaluate", text: "Comparing and assessing the results", ic: "scanSearch" },
      { k: "save", text: "Saving the result", ic: "checkCircle" }
    ];
    var OHNE_SCHRITT = { k: "lauf", text: "Auditing this page", ic: "scanSearch" };
    var FORT = gem.fort || (gem.fort = {});
    function phasenStand(r) {
      var f = FORT[r.id], status = f && f.status ? f.status : r.status;
      var jetzt = Date.now() + (f && f.versatz ? f.versatz : 0), an = Date.parse(r.acceptedAt) || jetzt;
      var sek = Math.max(0, Math.round((jetzt - an) / 1000));
      if (!f || gem.fortFehlt) return { phasen: [{ ph: status === "queued" ? PHASEN[0] : OHNE_SCHRITT, st: "laeuft" }], sekunden: sek, status: status, ohne: true };
      var akt = status === "queued" ? "queued" : (f.phase || "start"), ai = 0;
      PHASEN.forEach(function (ph, i) { if (ph.k === akt) ai = i; });
      var aus = [];
      PHASEN.forEach(function (ph, i) {
        if (i < ai) { if (!ph.bedingt || f.gesehen[ph.k]) aus.push({ ph: ph, st: "fertig" }); }
        else aus.push({ ph: ph, st: i === ai ? "laeuft" : "kommt" });
      });
      return { phasen: aus, sekunden: sek, status: status };
    }
    function protokollHtml(r, kompakt) {
      var p = phasenStand(r);
      var zeilen = p.phasen.filter(function (x) { return x.st !== "kommt"; }).map(function (x) {
        var logos = x.ph.logos ? '<span class="upa-run-lead">' + D.PROFILE.filter(function (q) { return !q.ohneUa; }).slice(0, 5).map(function (q) { return plattformLogo(q, modellVon(q)); }).join("") + '</span>' : '';
        return '<div class="upa-run-step is-in is-' + x.st + '"><div class="upa-run-inner"><div class="upa-run-line">' +
          '<span class="upa-run-spin" aria-hidden="true"><i></i></span><span class="upa-run-ic" aria-hidden="true">' + UC.icon(x.ph.ic, 2) + '</span>' +
          '<span class="upa-run-txt">' + esc(t(x.ph.text)) + '</span>' + logos + '</div></div></div>';
      }).join("");
      var uhr = (p.status === "queued" ? t("Waiting for {s}") : t("Auditing for {s}")).replace("{s}", p.sekunden < 60 ? p.sekunden + "s" : Math.floor(p.sekunden / 60) + "m " + (p.sekunden % 60) + "s");
      return '<div class="upa-run is-live' + (kompakt ? " is-kompakt" : "") + '" role="status" aria-live="polite">' +
        '<div class="upa-run-head"><span class="upa-run-clock">' + esc(uhr) + '</span></div>' +
        '<div class="upa-run-steps">' + zeilen + '</div></div>';
    }
    function ohneErgebnisHtml(d) {
      var r = d.selected.run;
      if (D.laeuft(r.status)) return protokollHtml(r, false);
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
    /* ---- Plattformen (v2) --------------------------------------------------------------------------
       Lukas (v2): "in jeder aufklappbaren Zeile steht das Gleiche". Die Zeile zeigt darum, was je Plattform VERSCHIEDEN ist:
       ihren Crawler, was robots.txt genau ihm erlaubt (B1 je Profil), wie die Seite seiner Kennung antwortet (A4), die
       Direktiven, wo sie fuer die Plattform gelten (C1/C2 nur Google und Bing), und wie belastbar die JS-Wirkung fuer
       genau sie ist (impact_basis). Alles aus den details der Checks -- fremde Texte (Regeln, Token) nur escaped. */
    function checkDetail(s, key) {
      for (var i = 0; i < s.checks.length; i++) if (s.checks[i].key === key) return s.checks[i].details || {};
      return {};
    }
    function robotsVon(s, pid) {
      var pr = (checkDetail(s, "B1").profile || {})[pid];
      if (!pr || typeof pr !== "object") return null;
      var e = (pr.ergebnisse || [])[0] || {}, r = e.regel || {};
      var regel = r.art ? (r.art === "allow" ? "Allow: " : "Disallow: ") + str(r.muster) : "";
      return { token: str(pr.token), entscheidung: str(e.entscheidung), regel: regel, zeile: num(r.zeile),
               gruppe: str(e.gruppe) === "stern" ? "*" : str(e.gruppe),
               kontext: (pr.kontext || []).filter(function (k) { return k && k.token; }).map(function (k) { return { token: str(k.token), erlaubt: k.erlaubt === true }; }) };
    }
    function antwortVon(s, token) {
      var v = (checkDetail(s, "A4").varianten || []).filter(function (x) { return x && str(x.rolle) === "ua:" + token; })[0];
      return v ? { status: num(v.status), gleich: v.gleicher_body === true && v.gleicher_status === true } : null;
    }
    function direktivenVon(s, pid) {
      var c1 = (checkDetail(s, "C1").profile || {})[pid], c2 = (checkDetail(s, "C2").profile || {})[pid];
      if (!c1 && !c2) return null;
      var l = [];
      if (c1 && c1.noindex) l.push("noindex");
      if (c2 && c2.nosnippet) l.push("nosnippet");
      if (c2 && c2.max_snippet != null) l.push("max-snippet:" + str(c2.max_snippet));
      if (c2 && c2.noarchive) l.push("noarchive");
      if (c2 && c2.nocache) l.push("nocache");
      return l;
    }
    /* Aus welcher Gruppe die Regel kommt (Recherche: Peec "Reason", Backlinko, GEO Toolbox): die Regel fuer alle
       Crawler (*) oder eine eigene fuer diesen Crawler. Die Zeile wird damit nachpruefbar. */
    function gruppeText(rb) {
      if (!rb || !rb.gruppe) return "";
      return rb.gruppe === "*" ? t("in the rules for all crawlers (User-agent: *)") : t("in the rules for this crawler");
    }
    function regelHtml(rb) {
      if (!rb || !rb.regel) return "";
      return '<code class="upa-code">' + esc(rb.regel) + '</code> <span class="upa-leise">' +
        esc(t("(line {n})").replace("{n}", rb.zeile != null ? String(rb.zeile) : "–") + (gruppeText(rb) ? " " + gruppeText(rb) : "")) + '</span>';
    }
    /* v2 Variante B der Plattformzeile (Recherche: Google Search Console "Crawl allowed? / Page fetch / Indexing allowed?",
       Lumar-Trichter): je Plattform dieselbe Kette von Fragen. Man sieht, an welcher Stufe sie ausfaellt, und was sich je
       Plattform unterscheidet: Crawler, Regel, Antwort, Direktiven (nur Google und Bing), Wirkung des JS-Befunds. */
    function ketteHtml(p, rb, an, dir, js, bef) {
      var r = [];
      var sperre = !rb && (bef || []).filter(function (f) { return /^robots\./.test(f.family); })[0];
      function stufe(ton, frage, antwort, detail, satz) {
        var ic = ton === "pos" ? "checkCircle" : ton === "neg" ? "ban" : ton === "warn" ? "alertCircle" : "helpCircle";
        r.push('<div class="upa-kette-z"><span class="upa-zustand is-' + ton + '"><span class="upa-zustand-ic" aria-hidden="true">' + UC.icon(ic, 2) + '</span></span>' +
          '<span class="upa-kette-f">' + esc(frage) + '</span>' +
          '<span class="upa-kette-a"><span class="upa-kette-w">' + esc(antwort) + '</span>' + (detail ? '<span class="upa-kette-d">' + detail + '</span>' : '') + (satz ? '<span class="upa-kette-satz">' + esc(satz) + '</span>' : '') + '</span></div>');
      }
      if (rb) stufe(rb.entscheidung === "allowed" ? "pos" : rb.entscheidung === "disallowed" ? "neg" : "leise", t("Allowed in robots.txt"),
        t(rb.entscheidung === "allowed" ? "Yes" : rb.entscheidung === "disallowed" ? "No" : "Unclear"), regelHtml(rb));
      else if (sperre) stufe("neg", t("Allowed in robots.txt"), t("No"), (sperre.details && sperre.details.rule ? '<code class="upa-code">' + esc(str(sperre.details.rule)) + '</code>' : ''));
      if (an) {
        var ok = an.status != null && an.status >= 200 && an.status < 300;
        stufe(ok && an.gleich ? "pos" : ok ? "warn" : "neg", t("Page loads for {token}").replace("{token}", p.token),
          t(ok && an.gleich ? "Yes" : ok ? "Different response" : "No"),
          esc((an.status != null ? "HTTP " + an.status : "–") + ", " + t(an.gleich ? "same response as a visitor" : "different from a visitor")));
      } else if (p.ohneUa) {
        stufe("leise", t("Own crawler"), t("None"), esc(t("Gemini draws on Google's index. Google-Extended is only a robots.txt rule.")));
      }
      if (dir) {
        stufe(dir.indexOf("noindex") >= 0 ? "neg" : "pos", t("Indexing allowed"), t(dir.indexOf("noindex") >= 0 ? "No" : "Yes"),
          dir.indexOf("noindex") >= 0 ? '<code class="upa-code">noindex</code>' : esc(t("No noindex in headers or HTML")));
        var grenzen = dir.filter(function (x) { return x !== "noindex"; });
        stufe(grenzen.length ? "warn" : "pos", t("Text previews allowed"), t(grenzen.length ? "Limited" : "Yes"),
          grenzen.length ? '<code class="upa-code">' + esc(grenzen.join(", ")) + '</code>' : esc(t("No nosnippet or max-snippet")));
      }
      if (js) {
        var w = D.wirkung(js, p.id), jd = js.details || {};
        var z = num(jd.numerator) != null && num(jd.denominator) ? t("{x} of {n} characters").replace("{x}", fmtInt(jd.numerator)).replace("{n}", fmtInt(jd.denominator)) : "";
        stufe("warn", t("Text in the initial HTML"), t("Partly"),
          (z ? esc(z) + " " : "") + wirkungHtml(w), w ? t(D.wirkungKurz(p.id, w.basis)) : "");
      } else {
        stufe("pos", t("Text in the initial HTML"), t("Yes"), esc(t("Nothing found that only appears after JavaScript")));
      }
      var andere = rb && rb.kontext.length ? '<p class="upa-satz is-leise upa-kette-andere">' + esc(t("Other crawlers of {platform}:").replace("{platform}", p.name)) + ' ' +
        rb.kontext.map(function (k) {
          var rolle = D.CRAWLER_ROLLE[k.token];
          return '<code class="upa-code">' + esc(k.token) + '</code> ' + esc((rolle ? "(" + t(rolle) + ") " : "") + t(k.erlaubt ? "allowed" : "blocked"));
        }).join(", ") + '</p>' : '';
      return '<div class="upa-kette">' + r.join("") + '</div>' + andere;
    }
    function robotsZelle(rb) {
      if (!rb) return '<span class="up-num is-empty">–</span>';
      var tip = rb.regel ? t("{rule} (line {n})").replace("{rule}", rb.regel).replace("{n}", rb.zeile != null ? String(rb.zeile) : "–") + (gruppeText(rb) ? " " + gruppeText(rb) : "") : "";
      if (rb.entscheidung === "allowed") return zustandHtml({ text: "Allowed", zeichen: "checkCircle", ton: "pos" }, { tip: tip });
      if (rb.entscheidung === "disallowed") return zustandHtml({ text: "Blocked", zeichen: "ban", ton: "neg" }, { tip: tip });
      return zustandHtml({ text: "Unclear", zeichen: "helpCircle", ton: "leise" }, { tip: t("robots.txt couldn't be evaluated for this crawler.") });
    }
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
        var js = bef.filter(function (f) { return /^content\./.test(f.family); })[0] || null;
        var rb = robotsVon(s, e.p.id), an = e.p.ohneUa ? null : antwortVon(s, e.p.token), dir = direktivenVon(s, e.p.id);
        var offen = !!state.profilOffen[e.p.id];
        if (!x) zugang = '<span class="up-num is-empty">–</span>';
        else if (x.reachable) zugang = zustandHtml({ text: "Reachable", zeichen: "checkCircle", ton: "pos" });
        else if (x.restrictions > 0) zugang = zustandHtml({ text: "Not reachable", zeichen: "ban", ton: "neg" });
        else zugang = zustandHtml({ text: "Not confirmed", zeichen: "helpCircle", ton: "leise" }, { tip: t("Some measurements for this platform are missing, so access is not confirmed.") });
        var wechsel = "";
        if (wechselZeigen && x && x.previousReachable != null && x.previousReachable !== x.reachable)
          wechsel = '<span class="up-marke is-leise upa-marke is-' + (x.reachable ? "pos" : "neg") + '">' + esc(t(x.reachable ? "Now reachable" : "Was reachable")) + '</span>';
        var jsZelle = js ? wirkungHtml(D.wirkung(js, e.p.id), e.p.id) : zustandHtml({ text: "No issue", zeichen: "checkCircle", ton: "pos" });
        var pk = "upa-pk-" + instanceId + "-" + e.p.id;
        return '<div class="up-row upa-statisch upa-paufklapp' + (offen ? " is-offen" : "") + '" role="row" tabindex="0" data-upa-profil="' + esc(e.p.id) + '" aria-expanded="' + offen + '" aria-controls="' + esc(pk) + '">' +
          '<div class="up-td upa-td-plattform" role="cell">' + plattformLogo(e.p, e.m) +
            '<span class="upa-seite"><span class="up-zeilenname">' + esc(e.p.name) + '</span>' +
            '<span class="upa-url upa-mono">' + esc(e.p.token) + '</span></span></div>' +
          '<div class="up-td upa-td-zugang" role="cell">' + zugang + wechsel + '</div>' +
          '<div class="up-td upa-td-robots" role="cell">' + robotsZelle(rb) + '</div>' +
          '<div class="up-td upa-td-js" role="cell">' + jsZelle + '</div>' +
          '<div class="up-td upa-td-zahl upa-td-c" role="cell"><span class="up-num">' + esc(x ? von(x.coverageSatisfied, x.coverageRequired) : "–") + '</span></div>' +
          '<div class="up-td upa-td-chev" role="cell"><span class="upa-befund-chev" aria-hidden="true">' + UC.icon(offen ? "chevronUp" : "chevronDown", 2) + '</span></div>' +
        '</div>' +
        '<div class="upa-pkoerper upa-klapp' + (offen ? " is-offen" : "") + '" role="row" id="' + esc(pk) + '" aria-hidden="' + !offen + '"><div class="upa-klapp-in" role="cell"><div class="upa-pkoerper-in">' +
          /* Aufgeklappt (Canvas v8 "5 Plattform B"): die Kette der Ja/Nein-Stufen, was diese Plattform bekommt. */
          ketteHtml(e.p, rb, an, dir, js, bef) +
        '</div></div></div>';
      }
      function gruppe(titel, liste) {
        if (!liste.length) return "";
        return '<div class="upa-gruppe" role="row"><span class="up-blockhead">' + esc(t(titel)) + '</span></div>' + liste.map(zeile).join("");
      }
      var koerper = getrackt.length ? gruppe("Tracked by your team", getrackt) + gruppe("Other platforms", weitere) : weitere.map(zeile).join("");
      return '<section class="upa-sek">' + sekKopf("Platforms", "What each AI search platform gets when it requests this page.") +
        '<div class="up-box upa-kasten upa-tab-plattformen"><div class="up-table" role="table">' +
          '<div class="up-thead" role="row" data-up-colsig="upa">' +
            '<div class="up-th" role="columnheader"><span class="up-th-txt">' + esc(t("Platform")) + '</span></div>' +
            /* Was frueher als Fussnote unter der Tabelle stand, steht im Tooltip der Spalte (22.10.: keine Erklaerzeilen). */
            '<div class="up-th" role="columnheader"><span class="up-th-txt" data-tip="' + esc(t("We sent the requests with each platform's crawler name from our servers. The real crawlers may get a different response.")) + '">' + esc(t("Access")) + '</span></div>' +
            '<div class="up-th upa-td-robots" role="columnheader"><span class="up-th-txt">' + esc(t("robots.txt")) + '</span></div>' +
            '<div class="up-th upa-td-js" role="columnheader"><span class="up-th-txt">' + esc(t("Text without JavaScript")) + '</span></div>' +
            '<div class="up-th up-th-zahl upa-td-c" role="columnheader"><span class="up-th-txt">' + esc(t("Coverage")) + '</span></div>' +
            '<div class="up-th upa-td-chev" role="columnheader"><span class="up-th-txt"></span></div>' +
          '</div><div class="up-tbody" role="rowgroup">' + koerper + '</div></div></div>' +
      '</section>';
    }

    /* ---- Etiketten: Schweregrad je Befund, impact_basis je Befund und Plattform (UMSETZUNGSPLAN 14) ----
       Beide als leise Marke aus core (.up-marke.is-leise), Text statt Punkt. Sortiert wird nur nach dem
       Schweregrad -- die Wirkung steht daneben, ordnet aber nicht. */
    function schwereHtml(sev) {
      var x = D.SCHWERE[sev];
      return x ? '<span class="up-marke is-leise upa-marke upa-schwere" data-tip="' + esc(t("Severity: how much this matters for the tested path. It is set per finding, not per platform.")) + '">' + esc(t(x)) + '</span>' : '';
    }
    /* Das Etikett der Wirkung. Im Tooltip zuerst, was das Etikett heisst (vorher eine Legende unter der Tabelle, 22.10.:
       keine Erklaerzeilen), dann der datierte Satz der Registry (mit Quellen und Zeitraum) -- im Text steht der kurze Satz je
       Plattform (D.wirkungKurz), damit nicht jede Erklaerung Quellen aufzaehlt (Lukas, v2). */
    function wirkungHtml(w) {
      var x = w && D.WIRKUNG[w.basis];
      return x ? '<span class="up-marke is-leise upa-marke upa-wirkung" data-tip="' + esc(t(x.tip) + (w.effect ? " " + w.effect : "")) + '">' + esc(t(x.text)) + '</span>' : '';
    }
    function befundTitel(f, tx) { return tx.titel; }
    function nachSchwere(a, b) {
      var x = D.SCHWERE_RANG[a.severity], y = D.SCHWERE_RANG[b.severity];
      return (x == null ? 9 : x) - (y == null ? 9 : y);
    }
    /* Der Satz eines Befunds; beim JS-Befund mit Zaehler und Nenner vorn (Formulierungsgrenzen). */
    function befundSatz(f, tx) {
      if (f.family !== "content.rendered_text_difference") return t(tx.satz);
      var z = D.jsSatz(f, fmtInt);
      return z ? z + " " + t("Our browser added the rest after running JavaScript (up to 10 seconds, no clicks).") : t(tx.satz);
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
    function befundHtml(f, vorher, erster) {
      /* Der erste Befund ist offen (Lukas, v2), bis ihn jemand schliesst: state.offen haelt true UND false. */
      var tx = D.befundText(f), schl = (vorher ? "v|" : "") + (f.causeKey || f.id);
      var offen = state.offen[schl] === undefined ? !!erster : !!state.offen[schl];
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
        '<div class="upa-befund-koerper upa-klapp' + (offen ? " is-offen" : "") + '" id="' + esc(koerperId) + '" aria-hidden="' + !offen + '"><div class="upa-klapp-in"><div class="upa-befund-in">' +
          abschnitt("What we found", (tx.satz ? '<p class="upa-satz">' + esc(befundSatz(f, tx)) + '</p>' : '') +
            (felder.length ? '<dl class="upa-kv">' + felder.map(function (x) { return '<dt>' + esc(t(x.label)) + '</dt><dd class="upa-mono">' + esc(x.wert) + '</dd>'; }).join("") + '</dl>' : '') +
            belegeBlockHtml(bel)) +
          (tx.warum && !vorher ? abschnitt("Why it matters", '<p class="upa-satz">' + esc(t(tx.warum)) + '</p>') : '') +
          (tx.schritt && !vorher ? abschnitt("How to fix", '<p class="upa-satz">' + esc(t(tx.schritt)) + '</p>') : '') +
          (vorher ? '' : jePlattformHtml(f)) +
          (tx.umfang && !vorher ? '<p class="upa-satz is-leise upa-umfang">' + esc(t(tx.umfang)) + '</p>' : '') +
        '</div></div></div>' +
      '</div>';
    }
    function abschnitt(titel, inhalt) {
      return inhalt ? '<div class="upa-absatz"><span class="up-blockhead">' + esc(t(titel)) + '</span>' + inhalt + '</div>' : '';
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
          schwereHtml(f.severity) + wirkungHtml(w) + '</div>' + '<p class="upa-satz is-leise">' + esc(t(D.wirkungKurz(p.id, w.basis))) + '</p></div>';
      }).join("");
      return zeilen ? '<div class="upa-absatz"><span class="up-blockhead">' + esc(t("By platform")) + '</span><div class="upa-jp">' + zeilen + '</div></div>' : '';
    }
    /* v2 Variante B der Befunde: eine nummerierte Liste "What to fix" (Recherche: Sitebulb zwei Saetze Was und Warum,
       Peec "What to do" als Schritte, Webflow "top priorities", Backlinko Fehlgeschlagenes zuerst). Sperren vor
       Problemen, dann nach Schweregrad; Art und Schwere als zwei Etiketten (Sitebulb: Issue/Potential Issue x Critical..Low). */
    var KOPIE = {};
    function fixSatz(f, tx) {
      var z = f.family === "content.rendered_text_difference" || f.family === "content.raw_empty_rendered_present" ? D.jsSatz(f, fmtInt) : "";
      /* Zwei Saetze (Sitebulb): der Titel sagt schon, was ist -- darunter die Zahl (JS) und warum es zaehlt. */
      if (z) return (z + (tx.kurz ? " " + t(tx.kurz) : "")).trim();
      return tx.kurz ? t(tx.kurz) : t(tx.satz).split(". ")[0].replace(/\.?$/, ".");
    }
    function fixHtml(f, i, erster, url) {
      var tx = D.befundText(f), schl = f.causeKey || f.id;
      var offen = state.offen[schl] === undefined ? !!erster : !!state.offen[schl];
      var sperre = f.contribution === "restriction";
      var felder = D.befundFelder(f), bel = D.belege(f);
      var koerperId = "upa-bf-" + instanceId + "-" + schl.replace(/[^a-z0-9]/gi, "").slice(0, 24);
      var schritte = tx.schritte && tx.schritte.length ? tx.schritte : (tx.schritt ? [tx.schritt] : []);
      KOPIE[schl] = [t(tx.titel), url || "", "", t("What we found") + ": " + befundSatz(f, tx), "",
        t("How to fix") + ":"].concat(schritte.map(function (x, j) { return (j + 1) + ". " + t(x); })).join("\n");
      var jp = D.PROFILE.filter(function (p) { return f.profiles.indexOf(p.id) >= 0; }).map(function (p) {
        var w = D.wirkung(f, p.id);
        return '<div class="up-row upa-statisch upa-fixp" role="row"><div class="up-td" role="cell">' + plattformLogo(p, modellVon(p)) + '<span class="up-zeilenname">' + esc(p.name) + '</span></div>' +
          '<div class="up-td" role="cell">' + (w ? wirkungHtml(w) : '<span class="up-num is-empty">–</span>') + '</div>' +
          '<div class="up-td upa-fixp-satz" role="cell"><span class="upa-satz is-leise">' + esc(w ? t(D.wirkungKurz(p.id, w.basis)) : "") + '</span></div></div>';
      }).join("");
      var mitWirkung = f.profiles.some(function (pid) { return !!D.wirkung(f, pid); });
      return '<div class="upa-befund upa-fixb' + (offen ? " is-offen" : "") + '" data-befund="' + esc(schl) + '">' +
        '<button type="button" class="upa-befund-kopf upa-fix-kopf" aria-expanded="' + offen + '" aria-controls="' + esc(koerperId) + '">' +
          '<span class="upa-fix-n is-' + (sperre ? "neg" : "warn") + '">' + esc(String(i + 1)) + '</span>' +
          '<span class="upa-fix-txt"><span class="upa-befund-titel">' + esc(t(tx.titel)) + '</span><span class="upa-fix-kurz">' + esc(fixSatz(f, tx)) + '</span></span>' +
          '<span class="upa-befund-rechts"><span class="up-marke is-leise upa-marke">' + esc(t(sperre ? "Restriction" : "Potential issue")) + '</span>' + schwereHtml(f.severity) + plattformStapel(f.profiles) +
            '<span class="upa-befund-chev" aria-hidden="true">' + UC.icon(offen ? "chevronUp" : "chevronDown", 2) + '</span></span>' +
        '</button>' +
        '<div class="upa-befund-koerper upa-klapp' + (offen ? " is-offen" : "") + '" id="' + esc(koerperId) + '" aria-hidden="' + !offen + '"><div class="upa-klapp-in"><div class="upa-befund-in upa-fix-in">' +
          abschnitt("What we found", '<p class="upa-satz">' + esc(/^content\./.test(f.family) && D.jsSatz(f, fmtInt)
              ? t("Our browser added the rest after running JavaScript (up to 10 seconds, no clicks).") + (bel.some(function (b) { return b.art === "rendered_only_excerpt"; }) ? " " + t("This text, for example, is only there afterwards:") : "")
              : befundSatz(f, tx)) + '</p>' +
            (felder.length ? '<dl class="upa-kv">' + felder.map(function (x) { return '<dt>' + esc(t(x.label)) + '</dt><dd class="upa-mono">' + esc(x.wert) + '</dd>'; }).join("") + '</dl>' : '') +
            (bel.some(function (b) { return b.art === "rendered_only_excerpt"; }) ? '<div class="upa-diff" aria-label="' + esc(t("Text that only appears after JavaScript")) + '">' + bel.filter(function (b) { return b.art === "rendered_only_excerpt"; }).map(function (b) {
              return '<div class="upa-diff-z"><span class="upa-diff-plus" aria-hidden="true">+</span><span class="upa-diff-t">' + esc(b.text) + '</span></div>'; }).join("") + '</div>' : '') +
            belegeBlockHtml(bel.filter(function (b) { return b.art !== "rendered_only_excerpt"; }))) +
          (tx.warum ? abschnitt("Why it matters", '<p class="upa-satz">' + esc(t(tx.warum)) + '</p>') : '') +
          (schritte.length ? '<div class="upa-absatz"><div class="upa-fix-schrittkopf"><span class="up-blockhead">' + esc(t("How to fix")) + '</span>' +
            '<button type="button" class="up-btn-sec upa-kopie" data-upa-kopie="' + esc(schl) + '">' + UC.icon("copy", 2) + '<span>' + esc(t("Copy for developer")) + '</span></button></div>' +
            '<ol class="upa-schritte">' + schritte.map(function (x) { return '<li>' + esc(t(x)) + '</li>'; }).join("") + '</ol></div>' : '') +
          (mitWirkung ? '<div class="upa-absatz"><span class="up-blockhead">' + esc(t("By platform")) + '</span>' +
            '<div class="up-box upa-kasten upa-fixplattformen"><div class="up-table" role="table"><div class="up-tbody" role="rowgroup">' + jp + '</div></div></div></div>' : '') +
          (tx.umfang ? '<p class="upa-satz is-leise upa-umfang">' + esc(t(tx.umfang)) + '</p>' : '') +
        '</div></div></div></div>';
    }
    /* Befunde (Canvas v8 "6 Befunde B"): eine nummerierte Liste, Sperren zuerst, dann nach Schwere; der erste offen. Darunter,
       was seit dem letzten Lauf behoben ist bzw. nicht mehr gleich gemessen werden konnte. Ohne Befund: ein ehrlicher Satz,
       nie "bestanden" (HANDOFF 3). */
    function befundeHtml(d) {
      var s = d.selected, r = s.run;
      var liste = s.findings.slice().sort(function (a, b) {
        return ((a.contribution === "restriction" ? 0 : 1) - (b.contribution === "restriction" ? 0 : 1)) || nachSchwere(a, b);
      });
      var behoben = s.previousFindings.filter(function (f) { return f.change === "resolved"; });
      var unklar = s.previousFindings.filter(function (f) { return f.change !== "resolved"; });
      /* Was eine Gruppe heisst, steht im Tooltip ihres Titels (22.10.: keine Erklaerzeilen unter Bauteilen). */
      function gruppe(titel, l, tip) {
        if (!l.length) return "";
        return '<div class="upa-bgruppe"><div class="upa-bgruppe-kopf"><span class="up-blockhead"' + (tip ? ' tabindex="0" data-tip="' + esc(t(tip)) + '"' : '') + '>' + esc(t(titel)) + '</span>' +
          '<span class="upa-bgruppe-n">' + esc(fmtInt(l.length)) + '</span></div>' +
          '<div class="up-box upa-kasten upa-befunde">' + l.map(function (f) { return befundHtml(f, true, false); }).join("") + '</div></div>';
      }
      var oben;
      if (liste.length) oben = '<div class="up-box upa-kasten upa-befunde upa-fixliste">' + liste.map(function (f, i) { return fixHtml(f, i, i === 0, d.page && d.page.url); }).join("") + '</div>';
      else {
        var voll = r.coverageRequired != null && r.coverageSatisfied === r.coverageRequired;
        oben = '<div class="up-box upa-kasten upa-keinbefund">' + zustandHtml({ text: voll ? "No restrictions or potential issues found" : "No findings in the completed measurements",
          zeichen: voll ? "checkCircle" : "helpCircle", ton: voll ? "pos" : "leise" }) +
          '<p class="upa-satz is-leise">' + esc(t(voll ? "All required public measurements completed. This doesn't prove that a platform indexes or cites the page." : "Some measurements are missing, so this is not a clean result.")) + '</p></div>';
      }
      return '<section class="upa-sek">' + sekKopf("What to fix", !liste.length ? "Nothing to fix on this page." : liste.length === 1 ? "One thing to fix on this page." : "Restrictions first, then by severity.") +
        oben +
        gruppe("Resolved since the previous run", behoben) +
        gruppe("No longer reported, not compared", unklar, "These were found before but could not be measured the same way in this run, so they are not counted as resolved.") +
      '</section>';
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
    /* v2: ein Check als Zielzustand mit Messwert (Recherche: Webflow "About page exists", isitagentready Pass/Fail
       mit Statuscode, Lighthouse Titel und Messwert in der Zeile). */
    function checkZeileNeu(k, c, s) {
      var z = D.CHECK_ZIEL[k.key] || {}, st = c.state;
      var ton = st === "pass" ? "pos" : st === "finding" ? ((c.severity === "critical" || c.severity === "high") ? "neg" : "warn") : "leise";
      var ic = st === "pass" ? "checkCircle" : st === "finding" ? (ton === "neg" ? "ban" : "alertCircle") : (st === "not_applicable" || st === "unsupported") ? "minus" : "helpCircle";
      var name = st === "pass" ? z.ok : st === "finding" ? z.nein : k.name;
      var wert = st === "pass" || st === "finding" ? D.checkWert(k.key, c.details, fmtInt) : t((D.CHECK_ZUSTAND[st] || {}).text || st);
      var wechsel = "";
      if (s.previousRunId && c.previousState && c.previousState !== c.state && !c.rulesChanged) {
        var pz = D.CHECK_ZUSTAND[c.previousState];
        wechsel = '<span class="upa-leise">' + esc(t("Previously: {state}").replace("{state}", t(pz ? pz.text : c.previousState))) + '</span>';
      } else if (c.rulesChanged) wechsel = aenderungHtml("rules_changed");
      return '<div class="upa-crow' + (st === "finding" ? " is-befund" : "") + '">' +
        '<span class="upa-zustand is-' + ton + '"><span class="upa-zustand-ic" aria-hidden="true">' + UC.icon(ic, 2) + '</span></span>' +
        '<span class="upa-crow-t"><span class="upa-crow-n">' + esc(t(name || k.name)) + '</span><span class="upa-crow-k">' + esc(k.key + " " + t(k.name)) + '</span></span>' +
        '<span class="upa-crow-w">' + esc(wert) + '</span>' + wechsel +
        (st === "finding" ? '<button type="button" class="up-btn-sec upa-crow-link" data-upa-zumbefund>' + esc(t("See finding")) + '</button>' : '') +
      '</div>';
    }
    function klappGruppe(schl, titel, zahl, inhalt, offenVorgabe) {
      var offen = state.offen[schl] === undefined ? !!offenVorgabe : !!state.offen[schl];
      var id = "upa-cg-" + instanceId + "-" + schl.replace(/[^a-z0-9]/gi, "");
      return '<div class="upa-befund upa-cgruppe' + (offen ? " is-offen" : "") + '" data-befund="' + esc(schl) + '">' +
        '<button type="button" class="upa-befund-kopf upa-cgruppe-kopf" aria-expanded="' + offen + '" aria-controls="' + esc(id) + '">' +
          '<span class="upa-cgruppe-t">' + esc(t(titel)) + '</span><span class="upa-bgruppe-n">' + esc(fmtInt(zahl)) + '</span>' +
          '<span class="upa-befund-rechts"><span class="upa-befund-chev" aria-hidden="true">' + UC.icon(offen ? "chevronUp" : "chevronDown", 2) + '</span></span></button>' +
        '<div class="upa-befund-koerper upa-klapp' + (offen ? " is-offen" : "") + '" id="' + esc(id) + '" aria-hidden="' + !offen + '"><div class="upa-klapp-in"><div class="upa-cgruppe-in">' + inhalt + '</div></div></div></div>';
    }
    /* Checks (Canvas v8 "7 Checks B"): nach Zustand (Lighthouse, Lumar Failed/Passed). */
    function checksHtml(d) {
      var s = d.selected, nach = {};
      s.checks.forEach(function (c) { nach[c.key] = c; });
      var alle = D.CHECKS.filter(function (k) {
        var c = nach[k.key];
        return c && !(k.key === "E2" && c.state === "not_applicable" && c.reason === "no_snapshot");
      });
      var befund = alle.filter(function (k) { return nach[k.key].state === "finding" || nach[k.key].state === "error"; });
      var gut = alle.filter(function (k) { return nach[k.key].state === "pass"; });
      var offenN = alle.filter(function (k) { return nach[k.key].state === "unknown"; });
      var na = alle.filter(function (k) { var x = nach[k.key].state; return x === "not_applicable" || x === "unsupported"; });
      var unter = t("{n} checks.").replace("{n}", fmtInt(alle.length)) + " " +
        (befund.length ? t("{x} need attention, {y} passed.").replace("{x}", fmtInt(befund.length)).replace("{y}", fmtInt(gut.length)) : t("All {y} passed.").replace("{y}", fmtInt(gut.length)));
      if (befund.length === 1) unter = t("{n} checks.").replace("{n}", fmtInt(alle.length)) + " " + t("1 needs attention, {y} passed.").replace("{y}", fmtInt(gut.length));
      function zeilen(l) { return l.map(function (k) { return checkZeileNeu(k, nach[k.key], s); }).join(""); }
      /* Offen, was Aufmerksamkeit braucht; Bestandenes eingeklappt mit Zahl, damit die Gruendlichkeit sichtbar bleibt, ohne
         die Befunde zu verdecken. */
      var inhalt = (befund.length ? '<div class="upa-bereich"><div class="upa-bereich-kopf"><span class="up-blockhead upa-bereich-t">' + esc(t("Needs attention")) + '</span><span class="upa-bgruppe-n">' + esc(fmtInt(befund.length)) + '</span></div>' +
          '<div class="up-box upa-kasten upa-crows">' + zeilen(befund) + '</div></div>' : '') +
        '<div class="up-box upa-kasten upa-cgruppen">' +
          (gut.length ? klappGruppe("cg|gut", "Passed", gut.length, zeilen(gut), !befund.length) : '') +
          (offenN.length ? klappGruppe("cg|offen", "Not measured", offenN.length, zeilen(offenN), true) : '') +
          (na.length ? klappGruppe("cg|na", "Not applicable", na.length, zeilen(na), false) : '') +
        '</div>';
      return '<section class="upa-sek">' + sekKopf("Checks", unter) + inhalt + '</section>';
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


    /* v2 Variante B von Evidence (Recherche: Screaming Frog View Source und "JS Word Count", Sitebulb "Response vs Render",
       Ahrefs "Compare with", Lighthouse Testbedingungen, Google Search Console "View tested page"): zuerst der Vergleich
       ohne und mit JavaScript, dann die Bedingungen des Tests, dann die Abrufe nach Art; die Messwerte eingeklappt. */
    function belegeNeuHtml(d) {
      var s = d.selected, r = s.run, m = {};
      s.metrics.forEach(function (x) { m[x.key] = x; });
      var js = s.findings.filter(function (f) { return /^content\./.test(f.family); })[0] || null;
      var bel = js ? D.belege(js) : [];
      var jd = js ? js.details || {} : {};
      var rr = m.raw_retention_ratio, tb = m.added_text_blocks;
      var vergleich = '<div class="up-kpiband is-3 is-offen upa-kpis">' +
        UC.kpiKarte({ label: "Text in the initial HTML", wertHtml: '<span class="up-num">' + esc(rr && rr.numerator != null ? fmtInt(rr.numerator) : "–") + '</span>', explain: "pa_text_raw" }) +
        UC.kpiKarte({ label: "Text after JavaScript", wertHtml: '<span class="up-num">' + esc(rr && rr.denominator != null ? fmtInt(rr.denominator) : "–") + '</span>', explain: "pa_text_rendered" }) +
        UC.kpiKarte({ label: "Blocks added by JavaScript", wertHtml: esc(tb && tb.value != null ? (jd.gerenderte_bloecke != null ? von(tb.value, jd.gerenderte_bloecke) : fmtInt(tb.value)) : "–"), explain: "pa_blocks_added" }) +
      '</div>' +
      (bel.length ? '<div class="upa-absatz"><span class="up-blockhead">' + esc(t("Only after JavaScript, for example")) + '</span><div class="upa-diff">' + bel.map(function (b) {
        return '<div class="upa-diff-z"><span class="upa-diff-plus" aria-hidden="true">+</span><span class="upa-diff-t">' + esc(b.text) + '</span></div>'; }).join("") + '</div></div>' : '');
      var basis = s.observations.filter(function (b) { return b.slot === "baseline"; })[0] || null;
      var spr = s.observations.filter(function (b) { return /^variant\.language\./.test(b.slot); }).map(function (b) { return b.acceptLanguage || D.slotName(b.slot).zusatz; });
      var uas = s.observations.filter(function (b) { return /^variant\.ua\./.test(b.slot); }).map(function (b) { return D.slotName(b.slot).zusatz; });
      var bed = [
        ["Requested URL", r.fetchUrl || d.page.fetchUrl, true], ["Final URL", r.finalUrl, true],
        ["Our user agent", basis && basis.userAgent, true],
        ["Crawler user agents", uas.join(", "), true], ["Languages", spr.join(", "), true],
        ["Browser", t("Chromium, up to 10 seconds, no clicks")], ["Measured", r.finishedAt ? zeit(r.finishedAt) : ""]
      ].filter(function (p) { return p[1]; });
      var gleich = {};
      (checkDetail(s, "A4").varianten || []).forEach(function (v) { if (v && v.rolle) gleich[str(v.rolle)] = v.gleicher_body === true && v.gleicher_status === true; });
      function abrufZeile(b) {
        var n = D.slotName(b.slot), ua = /^variant\.ua\./.test(b.slot), sp = /^variant\.language\./.test(b.slot);
        var rolle = ua ? "ua:" + n.zusatz : sp ? "lang:" + n.zusatz : "";
        var st = b.outcome !== "observed" ? '<span class="upa-leise">' + esc(t(D.ERGEBNIS_BEOBACHTUNG[b.outcome] || b.outcome)) + '</span>'
               : (b.status != null ? '<span class="up-num upa-mono">' + esc(String(b.status)) + '</span>' : '<span class="up-num is-empty">–</span>');
        var roh = b.artifact && b.artifact.state === "available" && D.uuidOk(b.id)
          ? '<span class="upa-roh"><span class="upa-leise upa-rohtext">' + esc(t("JSON")) + '</span><button type="button" class="up-btn-sec up-rowbtn upa-rohknopf" data-upa-roh="' + esc(b.id) + '" aria-label="' + esc(t("Download raw data")) + '">' + UC.icon("download", 2) + '<span>' + esc(t("Download")) + '</span></button></span>'
          : '<span class="up-num is-empty">–</span>';
        return '<div class="up-row upa-statisch upa-abruf" role="row">' +
          '<div class="up-td upa-td-abruf" role="cell"><span class="upa-seite"><span class="up-zeilenname">' + esc(ua ? n.zusatz : t(n.name) + (n.zusatz ? " " + n.zusatz : "")) + '</span>' +
            (b.userAgent ? '<span class="upa-url upa-mono" title="' + esc(b.userAgent) + '">' + esc(b.userAgent) + '</span>' : '') + '</span></div>' +
          '<div class="up-td upa-td-zahl" role="cell">' + st + '</div>' +
          '<div class="up-td upa-td-gleich" role="cell">' + (rolle && gleich[rolle] != null ? zustandHtml(gleich[rolle] ? { text: "Same as a visitor", zeichen: "checkCircle", ton: "pos" } : { text: "Different", zeichen: "alertCircle", ton: "warn" }) : '') + '</div>' +
          '<div class="up-td upa-td-zahl upa-td-groesse" role="cell"><span class="up-num">' + esc(b.bytes != null ? wertText({ unit: "bytes" }, b.bytes) : "–") + '</span></div>' +
          '<div class="up-td upa-td-zahl upa-td-dauer" role="cell"><span class="up-num">' + esc(b.durationMs != null ? wertText({ unit: "ms" }, b.durationMs) : "–") + '</span></div>' +
          '<div class="up-td upa-td-roh" role="cell">' + roh + '</div></div>';
      }
      var arten = [
        ["As a visitor", function (b) { return b.slot === "baseline" || b.slot === "browser" || /^variant\.language\./.test(b.slot); }],
        ["As each crawler", function (b) { return /^variant\.ua\./.test(b.slot); }],
        ["robots.txt", function (b) { return /^robots\./.test(b.slot); }]
      ];
      var abrufe = arten.map(function (a) {
        var l = s.observations.filter(a[1]);
        return l.length ? '<div class="upa-gruppe" role="row"><span class="up-blockhead">' + esc(t(a[0])) + '</span></div>' + l.map(abrufZeile).join("") : '';
      }).join("");
      var mess = messwerteHtml(d).replace(/^<section class="upa-sek">[\s\S]*?<\/div><\/div>(<div class="up-box)/, "$1").replace(/<\/section>$/, "");
      return '<section class="upa-sek">' + sekKopf("Without and with JavaScript", "What your server sends, next to what our browser shows after running scripts.", qtKnopfHtml(s)) + vergleich + '</section>' +
        '<section class="upa-sek">' + sekKopf("Test conditions") + '<dl class="up-box upa-kasten upa-kv upa-kv-lauf">' + bed.map(function (p) {
          return '<dt>' + esc(t(p[0])) + '</dt><dd' + (p[2] ? ' class="upa-mono"' : '') + '>' + esc(p[1]) + '</dd>'; }).join("") + '</dl></section>' +
        '<section class="upa-sek">' + sekKopf("Requests", "Every request of this run. Results are kept, raw captures for 90 days.") +
          '<div class="up-box upa-kasten upa-tab-abrufe"><div class="up-table" role="table">' +
            '<div class="up-thead" role="row" data-up-colsig="upa">' +
              ['Request', 'Status', 'Compared', 'Size', 'Time', 'Raw data'].map(function (h, i) {
                return '<div class="up-th' + (i === 1 || i === 3 || i === 4 ? " up-th-zahl" : "") + ['', '', ' upa-td-gleich', ' upa-td-groesse', ' upa-td-dauer', ' upa-td-roh'][i] + '" role="columnheader"><span class="up-th-txt">' + esc(t(h)) + '</span></div>';
              }).join("") +
            '</div><div class="up-tbody" role="rowgroup">' + abrufe + '</div></div></div></section>' +
        '<section class="upa-sek"><div class="up-box upa-kasten upa-cgruppen">' + klappGruppe("ev|mess", "All measurements", s.metrics.length, mess, false) + '</div></section>';
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

    /* Skelett in der Form des fertigen Kopfs (Canvas v8 "4 Kopf A"): Domain, Kennzahlen 2 x 2, rechts das Fenster. */
    function detailSkelett() {
      return '<div class="upa-kopfzone is-k"><div class="upa-kopfzone-l">' +
          '<div class="upa-ident is-sk"><span class="up-tsk-logo upa-logo-gross"></span><span class="upa-ident-txt"><span class="up-tsk-bar" style="width:220px"></span><span class="up-tsk-bar" style="width:300px"></span></span></div>' +
          '<div class="upa-kk">' + [70, 80, 100, 70].map(function (w) { return '<div class="upa-kk-i"><span class="up-tsk-bar" style="width:' + w + 'px"></span><span class="up-tsk-bar" style="width:44px"></span></div>'; }).join("") + '</div>' +
        '</div>' + browserRahmen('<span class="up-tsk-bar" style="width:120px"></span>', '<span class="upa-browser-sk" aria-hidden="true"></span>') + '</div>' +
        '<section class="upa-sek">' + sekKopf("Platforms") + '<div class="up-box upa-kasten upa-tab-plattformen"><div class="up-table">' +
          UC.skeletonRows({ count: 7, cols: [{ w: 140, logo: true, jitter: 20 }, { w: 90 }, { w: 16, zahl: true }, { w: 16, zahl: true }, { w: 40, zahl: true }] }) + '</div></div></section>';
    }
    var protokollUhr = null;
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
        /* v2: auch ohne Ergebnis die Kopfzone -- laeuft der Lauf, zeigt das Fenster die Flaeche mit Glanz, sonst den Grund. */
        if (D.laeuft(s.run.status))
          html = '<div class="upa-kopfzone is-lauf"><div class="upa-kopfzone-l">' + identHtml(d, { ohneMeta: true }) + protokollHtml(s.run, false) + '</div>' + browserHtml(d) + '</div>' +
            (d.runs.length > 1 ? laeufeHtml(d) : '') +
            '<p class="upa-run-weg">' + esc(t("You can leave this page, the audit keeps running.")) + '</p>';
        else html = '<div class="upa-kopfzone">' + identHtml(d) + browserHtml(d) + '</div>' + laufzeileHtml(d) + ohneErgebnisHtml(d) + (d.runs.length > 1 ? laeufeHtml(d) : '');
      } else {
        var r = reiter();
        if (r === "checks") html = checksHtml(d);
        else if (r === "evidence") html = belegeNeuHtml(d);
        else if (r === "runs") html = laeufeHtml(d) + laufDetailsHtml(d);
        else {
          html = '<div class="upa-kopfzone is-k"><div class="upa-kopfzone-l">' + identHtml(d) + kpiKleinHtml(d) + '</div>' + browserHtml(d) + '</div>' +
            laufzeileHtml(d) + teilHinweisHtml(s.run) + zugangHinweisHtml(d) + plattformenHtml(d) + befundeHtml(d);
        }
      }
      elDetail.innerHTML = html;
      if (protokollUhr) { clearInterval(protokollUhr); protokollUhr = null; }
      if (elDetail.querySelector(".upa-run") && s && s.run) {
        protokollUhr = setInterval(function () {
          var alt = elDetail.querySelector(".upa-run");
          if (!alt || !root.isConnected) { clearInterval(protokollUhr); protokollUhr = null; return; }
          var neu = document.createElement("div"); neu.innerHTML = protokollHtml(s.run, alt.classList.contains("is-kompakt"));
          alt.replaceWith(neu.firstChild);
        }, 1000);
      }
    }
    /* Erklaerkarten der Kennzahlen (Memory "Erklaerkarten-Format"): helle Platte mit dem Wert, wie die Kachel ihn zeigt (mit
       Trend, wenn sie einen zeigt), Titel = Etikett, Satz aus UC.explainCopy (core EXPLAIN_TEXT pa_*). Ausloeser ist die Kachel
       selbst: der Canvas v8 hat kein Zeichen und keine Zeile daran. */
    if (UC.makeExplain && UC.explainCopy) UC.makeExplain({ root: root, triggerSel: "[data-explain^='pa_']", getIsDark: isDark,
      html: function (key, el) {
        var e = UC.explainCopy(key, { trend: el && el.getAttribute("data-trend") ? ", compared with the previous run" : "" });
        if (!e) return "";
        var w = el && el.querySelector(".upa-kk-w, .up-kpi-row");
        return (w ? '<div class="up-explain-vis"><span class="up-explain-row">' + w.innerHTML + '</span></div>' : '') +
          '<div class="up-explain-h">' + esc(e.h) + '</div><div class="up-explain-t">' + esc(e.t) + '</div>';
      } });
    elDetail.addEventListener("click", function (e) {
      if (e.target.closest("[data-upa-zurueck]")) { zurListe(true); return; }
      if (e.target.closest("[data-upa-nochmal]")) { nochmal(); return; }
      if (e.target.closest(".upa-mehrlaeufe")) { state.alleLaeufe = true; detailZeichnen(); return; }
      if (e.target.closest("[data-upa-roh]")) { rohdatenLaden(e.target.closest("[data-upa-roh]")); return; }
      if (e.target.closest("[data-upa-html]")) { htmlOeffnen(e.target.closest("[data-upa-html]")); return; }
      var kp = e.target.closest("[data-upa-kopie]");
      if (kp) {
        /* Ins Ticket kopierbar (Recherche: Sitebulb, Screaming Frog "How To Fix" im Export, Semrush "Send to", Lumar). */
        var txt = KOPIE[kp.getAttribute("data-upa-kopie")] || "";
        var fertig = function () { if (UC.toast) UC.toast(t("Copied to clipboard"), { kind: "success" }); };
        try { navigator.clipboard.writeText(txt).then(fertig, function () { if (UC.legacyCopy) UC.legacyCopy(txt); fertig(); }); }
        catch (x) { if (UC.legacyCopy) UC.legacyCopy(txt); fertig(); }
        return;
      }
      if (e.target.closest("[data-upa-zumbefund]")) { reiterSetzen("overview"); detailZeichnen(); return; }
      var pr = e.target.closest(".upa-paufklapp[data-upa-profil]");
      if (pr) { profilUmschalten(pr); return; }
      var k = e.target.closest(".upa-befund-kopf");
      if (k) {
        var b = k.closest("[data-befund]"), schl = b.getAttribute("data-befund");
        /* Die angeklickte Zeile bleibt an ihrer Stelle (UC.zeileHalten, CLAUDE.md 1d "Aufklapper"). */
        var auf = k.getAttribute("aria-expanded") !== "true";
        var aendern = function () {
          state.offen[schl] = auf;
          b.classList.toggle("is-offen", auf);
          k.setAttribute("aria-expanded", String(auf));
          var kp = b.querySelector(".upa-befund-koerper");
          kp.classList.toggle("is-offen", auf); kp.setAttribute("aria-hidden", String(!auf));
          b.querySelector(".upa-befund-chev").innerHTML = UC.icon(auf ? "chevronUp" : "chevronDown", 2);
        };
        /* 200 ms auf und zu (Lukas, v2): upa-klapp in page-audit.css; die Zeile bleibt dabei stehen. */
        if (UC.zeileHalten) UC.zeileHalten(k, aendern, { dauer: 200 }); else aendern();
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
        koerper.classList.toggle("is-offen", auf); koerper.setAttribute("aria-hidden", String(!auf));
        var ch = pr.querySelector(".upa-befund-chev");
        if (ch) ch.innerHTML = UC.icon(auf ? "chevronUp" : "chevronDown", 2);
      };
      if (UC.zeileHalten) UC.zeileHalten(pr, aendern, { dauer: 200 }); else aendern();
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
    /* "View initial HTML": der Drawer bekommt alles, was die Route der Rohdaten braucht, als Stand fuer genau dieses
       Oeffnen mit (UC.drawerOeffnen, kontext) -- die Kennung in der Adresse ist nur die Beobachtung. */
    function htmlOeffnen(knopf) {
      var d = dasDetail(), s = d && d.selected, b = qtBasis(s);
      if (!b || b.id !== knopf.getAttribute("data-upa-html")) return;
      UC.drawerOeffnen(QT_ART, b.id, "page-audit", { team: team(), pageId: d.page.id, runId: s.run.id,
        url: d.page.fetchUrl || d.page.url, zustand: b.artifact ? b.artifact.state : "", bytes: b.bytes });
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
      fortPlanen(fortUhr ? null : 0);
      if (!ms) return;
      uhr = setTimeout(function () {
        uhr = null;
        if (!sichtbar(root) || (typeof document.hidden === "boolean" && document.hidden)) { beiSicht(root, "nachladen", planenNachSicht, sichtbar); return; }
        if (state.ansicht === "detail") detailLaden({ leise: true }); else listeLaden({ leise: true });
      }, ms);
    }
    /* Fortschritt: alle 1,5 s, solange ein Lauf wartet oder laeuft (Vertrag: 1 bis 2 s, Grenze 240 je Minute). Erreicht ein
       Lauf einen Endzustand, laedt die Ansicht leise nach, damit das Ergebnis sofort statt beim naechsten Takt erscheint.
       Fehlt die Funktion (PGRST202): einmal merken, ohne Schritte weiter; eine Drossel (PT429) verlangsamt auf 5 s. */
    var fortUhr = null, fortLaeuft = false;
    function fortIds() {
      if (state.ansicht === "detail") { var a = aktiverLauf(dasDetail()); return a ? [a.id] : []; }
      return L.daten ? L.daten.rows.filter(function (r) { return r.latest && D.laeuft(r.latest.status) && D.uuidOk(r.latest.runId); }).map(function (r) { return r.latest.runId; }).slice(0, 50) : [];
    }
    function fortPlanen(ms) {
      if (fortUhr) { clearTimeout(fortUhr); fortUhr = null; }
      if (gem.fortFehlt || !root.isConnected || !fortIds().length) return;
      fortUhr = setTimeout(fortHolen, ms == null ? 1500 : ms);
    }
    function fortHolen() {
      fortUhr = null;
      var ids = fortIds();
      if (!ids.length || fortLaeuft || !team()) return;
      if (!sichtbar(root) || (typeof document.hidden === "boolean" && document.hidden)) { beiSicht(root, "fortschritt", function () { fortPlanen(0); }, sichtbar); return; }
      fortLaeuft = true;
      UC.rpc(D.FN.fortschritt, { p_team: team(), p_run_ids: ids }, { timeoutMs: 10000 }).then(function (erg) {
        fortLaeuft = false;
        var code = erg && erg.fehler ? str(erg.fehler.code) : "";
        if (code === "PGRST202") { gem.fortFehlt = true; return; }
        var f = erg && erg.ok ? D.zuFortschritt(erg.daten) : null;
        if (!f) { fortPlanen(code === "PT429" ? 5000 : 3000); return; }
        var ende = false;
        Object.keys(f.laeufe).forEach(function (id) {
          var x = f.laeufe[id], alt = FORT[id] || { gesehen: {} };
          if (x.phase) alt.gesehen[x.phase] = true;
          alt.status = x.status; alt.phase = x.phase; alt.versatz = f.serverZeit ? f.serverZeit - Date.now() : 0;
          FORT[id] = alt;
          if (!D.laeuft(x.status)) ende = true;
        });
        if (state.ansicht === "liste") laufZellenNeu();
        if (ende) { if (state.ansicht === "detail") detailLaden({ leise: true }); else listeLaden({ leise: true }); }
        fortPlanen();
      });
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

  /* ============================================================================================
     DAS ERSTE HTML ANSEHEN (22.10., Variante A von Lukas: "View initial HTML")
     Die Seite spricht ueberall vom "initial HTML", dem HTML, das der Server schickt, bevor ein Skript
     laeuft. Zu sehen war es bisher nur als JSON der Rohdaten. Der Knopf im Abschnitt "Without and with
     JavaScript" oeffnet es zum Lesen: Zeilennummern und Suche, sonst nichts.
     WO: im Drawer aus core (KERN_DRAWER "initialhtml"), der grossen Leseansicht der App wie bei Response
     Detail. Ein Popup aus core ist hoechstens 560 breit, fuer Quelltext zu schmal.
     DATEN: die Beobachtung slot "baseline", Datei basis.f<n>.json = {"html": "..."}. Die Adresse kommt nur
     ueber die Route der App (/api/page-audit/rohdaten: Mitgliedschaft mit dem Token des Nutzers), dieselbe
     wie fuer den Download. Sie ist mit download signiert; das setzt nur Content-Disposition, und fetch liest
     den Inhalt trotzdem. Supabase Storage antwortet mit access-control-allow-origin * (gemessen 22.10.),
     und sein Ursprung steht schon in connect-src der App. Die Route bleibt, wie sie ist.
     SICHERHEIT (UMSETZUNGSPLAN 17): das HTML ist fremder Text. Es steht nur escaped als Text im DOM (esc),
     nie als HTML, kein iframe, keine Vorschau, kein Link daraus.
     GROSSE DATEIEN: der Worker liest hoechstens 5 MiB (acquisition_config document_decompressed_bytes). Nie
     alles auf einmal ins DOM: der Text steht in Bloecken zu hoechstens 12.000 Zeichen bzw. 250 Zeilen, und
     gefuellt sind nur die Bloecke im Bild und 1.600 px darueber und darunter. Die uebrigen sind leere
     Platzhalter mit gemessener oder geschaetzter Hoehe (Monospace: Zeichen je Zeile aus der Zeichenbreite).
     Grenzen: hoechstens 6 Mi Zeichen und 1 Mio. Zeilen werden gezeigt (darueber abgeschnitten, mit Satz -- vom
     Worker kommt das nicht), eine Datei ueber 32 MiB wird beim Lesen abgebrochen (qtLesen); die Suche zaehlt bis
     10.000 Treffer.
     ============================================================================================ */
  var QT_ART = "initialhtml";
  var QT_GRENZE = 6 * 1024 * 1024, QT_GRENZE_BYTES = 32 * 1024 * 1024, QT_WORKER = 5 * 1024 * 1024;
  var QT_BLOCK_Z = 12000, QT_BLOCK_L = 250, QT_RAND = 1600, QT_MAX = 10000, QT_ZEILEN = 1000000;
  var QT = { ctx: null, el: null, d: null, k: null, id: "", lauf: 0, io: null, ro: null, uhr: null,
             bl: [], voll: {}, mass: null, q: "", ql: 0, treffer: [], mehr: false, aktiv: -1 };

  if (UC.addMessages) UC.addMessages("de", {
    "View initial HTML": "Erstes HTML ansehen",
    "Initial HTML": "Erstes HTML",
    "Search HTML": "HTML durchsuchen",
    "Previous match": "Vorheriger Treffer",
    "Next match": "Nächster Treffer",
    "{n} lines": "{n} Zeilen",
    "1 line": "1 Zeile",
    "The initial HTML couldn't be loaded": "Das erste HTML konnte nicht geladen werden",
    "The initial HTML couldn't be read": "Das erste HTML konnte nicht gelesen werden",
    "You don't have access to this audit.": "Du hast keinen Zugriff auf dieses Audit.",
    "This HTML is no longer stored": "Dieses HTML ist nicht mehr gespeichert",
    "Raw captures are kept for 90 days. Run the audit again to capture the page anew.": "Rohdaten werden 90 Tage aufbewahrt. Prüfe die Seite erneut, um sie neu zu erfassen.",
    "The server sent no HTML": "Der Server hat kein HTML geschickt",
    "The response to this request was empty.": "Die Antwort auf diesen Abruf war leer.",
    "This HTML is too large to show here": "Dieses HTML ist zu groß für die Ansicht",
    "Download the raw data under Requests instead.": "Lade stattdessen die Rohdaten unter Abrufe herunter.",
    "The page is larger than 5 MiB. The audit read the first 5 MiB, so the end is missing here.": "Die Seite ist größer als 5 MiB. Das Audit hat die ersten 5 MiB gelesen, das Ende fehlt hier.",
    "Only the first {n} characters are shown.": "Gezeigt werden nur die ersten {n} Zeichen.",
    "Only the first {n} lines are shown.": "Gezeigt werden nur die ersten {n} Zeilen."
  });

  function qtBasis(s) { return s && s.observations ? s.observations.filter(function (b) { return b.slot === "baseline"; })[0] || null : null; }
  /* Der Knopf nur, wo er auch aufgeht: Beobachtung mit Rohdaten (verfuegbar oder nach 90 Tagen weg -- das zeigt der
     Drawer selbst), ein core mit diesem Drawer und eine Host-App mit openDrawer. */
  function qtKnopfHtml(s) {
    var b = qtBasis(s);
    if (!b || !b.artifact || !/^(available|expired)$/.test(b.artifact.state) || !D.uuidOk(b.id)) return "";
    if (!(UC.kernDrawerAktiv && UC.kernDrawerAktiv(QT_ART) && UC.drawerOeffnen && typeof window.openDrawer === "function")) return "";
    return '<button type="button" class="up-btn-sec upa-htmlknopf" data-upa-html="' + esc(b.id) + '">' + UC.icon("sourceCode", 2) +
      '<span>' + esc(t("View initial HTML")) + '</span></button>';
  }

  /* ---- Laden: Route der App, dann die signierte Adresse ---- */
  function qtHolen(id, k) {
    var holen = UC.sitzungsToken ? UC.sitzungsToken() : Promise.resolve("");
    return holen.then(function (token) {
      return fetch("/api/page-audit/rohdaten", {
        method: "POST", credentials: "omit", cache: "no-store",
        headers: { "content-type": "application/json", "authorization": "Bearer " + (token || "") },
        body: JSON.stringify({ team_id: k.team, page_id: k.pageId, run_id: k.runId, observation_id: id })
      });
    }).then(function (r) {
      if (r.status === 410) throw { art: "weg" };
      if (r.status === 401 || r.status === 403) throw { art: "zugang" };
      if (r.status !== 200) throw { art: "laden" };
      return r.json().catch(function () { return {}; });
    }).then(function (j) {
      var url = str(j && j.url);
      /* Nur https oder ein Pfad der App (wie beim Bildschirmfoto) -- nie eine andere Form. */
      if (!/^https:\/\//i.test(url) && !/^\/(?!\/)[a-z0-9_\-\/.]+(\?[a-z0-9_\-.=&%]*)?$/i.test(url)) throw { art: "laden" };
      return fetch(url, { method: "GET", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
    }).then(function (r) {
      if (!r.ok) throw { art: "laden" };
      var n = num(r.headers.get("content-length"));
      if (n != null && n > QT_GRENZE_BYTES) throw { art: "gross" };
      return qtLesen(r);
    }).then(function (txt) {
      if (txt.length > QT_GRENZE_BYTES) throw { art: "gross" };
      var o = null;
      try { o = JSON.parse(txt); } catch (e) { o = null; }
      if (!o || typeof o !== "object" || typeof o.html !== "string") throw { art: "unlesbar" };
      return o.html;
    }).then(null, function (f) { throw f && f.art ? f : { art: "laden" }; });
  }

  /* Der Koerper als Strom, nach 32 MiB abgebrochen (Sicherheitspruefung 22.10., niedrig): Content-Length fehlt mal oder zaehlt
     bei gepackter Antwort nur die gepackten Bytes -- dann haette r.text() alles eingelesen. Gezaehlt wird hier entpackt. */
  function qtLesen(r) {
    if (!r.body || typeof r.body.getReader !== "function" || typeof TextDecoder !== "function") return r.text();
    var leser = r.body.getReader(), dec = new TextDecoder("utf-8"), teile = [], n = 0;
    function weiter() {
      return leser.read().then(function (x) {
        if (x.done) { teile.push(dec.decode()); return teile.join(""); }
        n += x.value.byteLength;
        if (n > QT_GRENZE_BYTES) { try { leser.cancel(); } catch (e) {} throw { art: "gross" }; }
        teile.push(dec.decode(x.value, { stream: true }));
        return weiter();
      });
    }
    return weiter();
  }

  /* ---- Aufbereiten: Zeilenanfaenge und Bloecke (einmal je Datei) ---- */
  function qtAufbereiten(id, roh) {
    var gekappt = roh.length > QT_GRENZE;
    var text = (gekappt ? roh.slice(0, QT_GRENZE) : roh).replace(/\r\n?/g, "\n");
    /* Ein Umbruch am Ende ist keine eigene Zeile (wie view-source). */
    var ende = text.length && text.charCodeAt(text.length - 1) === 10 ? text.length - 1 : text.length;
    var anf = [0], i = text.indexOf("\n");
    while (i !== -1 && i < ende) { anf.push(i + 1); i = text.indexOf("\n", i + 1); }
    /* Hoechstens eine Million Zeilen: 20 px je Zeile sind dann 20 Mio. px, und Chrome begrenzt die Hoehe eines Elements bei
       rund 33,5 Mio. px -- dahinter waere der Rest nicht mehr zu erreichen. Echtes HTML von 5 MiB hat weit weniger (gemessen:
       380.000 Zeilen zu je 13 Zeichen sind schon 5 MiB). */
    var zeilenGekappt = anf.length > QT_ZEILEN;
    if (zeilenGekappt) { ende = anf[QT_ZEILEN] - 1; anf.length = QT_ZEILEN; text = text.slice(0, ende); }
    var bl = [], B = null, n = anf.length;
    for (var z = 0; z < n; z++) {
      var e = z + 1 < n ? anf[z + 1] - 1 : ende, pos = anf[z];
      for (;;) {
        if (!B || B.zeichen >= QT_BLOCK_Z || B.zeilen >= QT_BLOCK_L) { B = { s0: pos, s1: pos, l0: z, l1: z, zeichen: 0, zeilen: 0 }; bl.push(B); }
        var platz = QT_BLOCK_Z - B.zeichen;
        if (e - pos <= platz) { B.zeichen += e - pos; B.zeilen++; B.l1 = z; B.s1 = e; break; }
        /* Eine lange Zeile (minifiziertes HTML: auf upstreem.ai 123.815 Zeichen in Zeile 27) geht ueber mehrere
           Bloecke; nie mitten in einem Ersatzpaar trennen. */
        var cut = pos + platz, c = text.charCodeAt(cut - 1);
        if (c >= 0xD800 && c <= 0xDBFF && cut - 1 > pos) cut--;
        B.zeichen = QT_BLOCK_Z; B.zeilen++; B.l1 = z; B.s1 = cut; pos = cut;
      }
    }
    return { id: id, text: text, anf: anf, ende: ende, bl: bl, gekappt: zeilenGekappt ? "zeilen" : gekappt ? "zeichen" : "" };
  }
  function qtEnde(d, z) { return z + 1 < d.anf.length ? d.anf[z + 1] - 1 : d.ende; }

  /* ---- Zeichnen ---- */
  function qtGroesse(v) {
    return v >= 1048576 ? UC.fmtNum(v / 1048576, 1) + " MB" : (v >= 1024 ? UC.fmtNum(v / 1024, 1) + " KB" : fmtInt(v) + " B");
  }
  function qtLeisteHtml(d) {
    var n = d ? d.anf.length : 0;
    return '<div class="upa-q-leiste">' +
      '<div class="up-search is-open upa-q-suche">' +
        '<span class="up-iconbtn up-search-btn" aria-hidden="true">' + UC.icon("search", 2) + '</span>' +
        '<div class="up-search-box">' +
          '<input class="up-search-input" type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(t("Search HTML")) + '" aria-label="' + esc(t("Search HTML")) + '"' + (d ? '' : ' disabled') + '>' +
          '<button class="up-search-clear" type="button" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2) + '</button>' +
        '</div></div>' +
      '<span class="upa-q-zahl" aria-live="polite"></span>' +
      '<button type="button" class="up-iconbtn upa-q-schritt" data-upa-q-schritt="-1" aria-label="' + esc(t("Previous match")) + '" data-tip="' + esc(t("Previous match")) + '" disabled>' + UC.icon("chevronUp", 2) + '</button>' +
      '<button type="button" class="up-iconbtn upa-q-schritt" data-upa-q-schritt="1" aria-label="' + esc(t("Next match")) + '" data-tip="' + esc(t("Next match")) + '" disabled>' + UC.icon("chevronDown", 2) + '</button>' +
      (d ? '<span class="upa-q-meta"><span>' + esc(n === 1 ? t("1 line") : t("{n} lines").replace("{n}", fmtInt(n))) + '</span>' +
        '<span>' + esc(qtGroesse(QT.k && QT.k.bytes != null ? QT.k.bytes : d.text.length)) + '</span></span>' : '') +
    '</div>';
  }
  function qtSkelettHtml() {
    return qtLeisteHtml(null) + '<div class="up-box upa-q-code" aria-busy="true">' + [62, 88, 40, 74, 96, 55, 81, 33, 70, 92, 47, 66, 85, 58].map(function (w) {
      return '<div class="upa-q-z"><span class="upa-q-t upa-q-sk"><span class="up-tsk-bar" style="width:' + w + '%"></span></span></div>';
    }).join("") + '</div>';
  }
  function qtZustand(art) {
    if (!QT.el) return;
    qtLos();
    var o = art === "weg" ? { icon: "clock", titel: "This HTML is no longer stored", text: "Raw captures are kept for 90 days. Run the audit again to capture the page anew." }
          : art === "leer" ? { icon: "sourceCode", titel: "The server sent no HTML", text: "The response to this request was empty." }
          : art === "gross" ? { icon: "info", titel: "This HTML is too large to show here", text: "Download the raw data under Requests instead." }
          : art === "zugang" ? { icon: "lock", titel: "The initial HTML couldn't be loaded", text: "You don't have access to this audit." }
          : art === "unlesbar" ? { icon: "info", titel: "The initial HTML couldn't be read", text: "Please try again.", knopf: "Try again", knopfAttr: "data-upa-q-nochmal" }
          : { icon: "info", titel: "The initial HTML couldn't be loaded", text: "Please try again.", knopf: "Try again", knopfAttr: "data-upa-q-nochmal" };
    QT.el.innerHTML = UC.leerHtml(o);
  }
  /* Die Zeilen eines Blocks; ein Treffer ist .up-hl wie in jeder Suche der App, mit Nummer fuer vor und zurueck. */
  function qtText(a, e) {
    var tr = QT.treffer, ql = QT.ql, text = QT.d.text;
    if (!tr.length) return esc(text.slice(a, e));
    var lo = 0, hi = tr.length;
    while (lo < hi) { var m = (lo + hi) >> 1; if (tr[m] + ql <= a) lo = m + 1; else hi = m; }
    var h = "", pos = a;
    for (var k = lo; k < tr.length && tr[k] < e; k++) {
      var s = Math.max(tr[k], a), f = Math.min(tr[k] + ql, e);
      if (s > pos) h += esc(text.slice(pos, s));
      h += '<mark class="up-hl' + (k === QT.aktiv ? ' is-aktiv' : '') + '" data-m="' + k + '">' + esc(text.slice(s, f)) + '</mark>';
      pos = f;
    }
    return pos < e ? h + esc(text.slice(pos, e)) : h;
  }
  function qtBlockHtml(B) {
    var d = QT.d, h = "";
    for (var z = B.l0; z <= B.l1; z++) {
      var a = Math.max(d.anf[z], B.s0), e = Math.min(qtEnde(d, z), B.s1), fort = a > d.anf[z];
      /* Die Nummer als data-n und ::before: nicht markierbar, also beim Kopieren nicht im Text. */
      h += '<div class="upa-q-z"' + (fort ? '' : ' data-n="' + (z + 1) + '"') + '><span class="upa-q-t">' + qtText(a, e) + '</span></div>';
    }
    return h;
  }
  function qtFuellen(i) {
    if (QT.voll[i] || !QT.bl[i]) return;
    QT.bl[i].innerHTML = qtBlockHtml(QT.d.bl[i]);
    QT.bl[i].style.height = "";
    QT.voll[i] = true;
  }
  /* Leeren mit der gemessenen Hoehe: der Platzhalter ist genau so hoch wie eben der Inhalt, nichts verschiebt sich. */
  function qtLeeren(i) {
    if (!QT.voll[i]) return;
    var el = QT.bl[i], B = QT.d.bl[i], h = el.offsetHeight;
    el.style.height = h + "px"; el.innerHTML = "";
    delete QT.voll[i];
    B.hMess = h; B.hBreite = QT.mass ? QT.mass.breite : 0;
  }
  /* Zeichen je Zeile aus der Probe (64 Nullen in der Schrift des Codes) und der Breite der Textspalte. */
  function qtMessen() {
    var p = QT.el && QT.el.querySelector(".upa-q-probe .upa-q-t");
    if (!p || !p.firstChild) return false;
    var zw = p.firstChild.getBoundingClientRect().width / 64, tw = p.getBoundingClientRect().width;
    if (!(zw > 0) || !(tw > 0)) return false;
    QT.mass = { cpr: Math.max(1, Math.floor((tw + 0.01) / zw)), zh: parseFloat(getComputedStyle(p).lineHeight) || 20, breite: Math.round(tw) };
    return true;
  }
  function qtHoehe(B) {
    var m = QT.mass, d = QT.d;
    if (B.hMess && B.hBreite === m.breite) return B.hMess;
    if (B.hCpr === m.cpr) return B.hS;
    var reihen = 0;
    for (var z = B.l0; z <= B.l1; z++) reihen += Math.max(1, Math.ceil((Math.min(qtEnde(d, z), B.s1) - Math.max(d.anf[z], B.s0)) / m.cpr));
    B.hCpr = m.cpr; B.hS = reihen * m.zh;
    return B.hS;
  }
  function qtHoehenSetzen() {
    if (!QT.mass) return;
    for (var i = 0; i < QT.bl.length; i++) if (!QT.voll[i]) QT.bl[i].style.height = qtHoehe(QT.d.bl[i]) + "px";
  }
  function qtLos() {
    if (QT.io) { QT.io.disconnect(); QT.io = null; }
    if (QT.ro) { QT.ro.disconnect(); QT.ro = null; }
    QT.bl = []; QT.voll = {};
  }
  function qtZeichnen() {
    var d = QT.d, el = QT.el;
    if (!d || !el) return;
    qtLos();
    QT.q = ""; QT.ql = 0; QT.treffer = []; QT.mehr = false; QT.aktiv = -1;
    var hinweis = QT.k && QT.k.bytes >= QT_WORKER ? t("The page is larger than 5 MiB. The audit read the first 5 MiB, so the end is missing here.")
                : d.gekappt === "zeilen" ? t("Only the first {n} lines are shown.").replace("{n}", fmtInt(QT_ZEILEN))
                : d.gekappt ? t("Only the first {n} characters are shown.").replace("{n}", fmtInt(QT_GRENZE)) : "";
    el.innerHTML = qtLeisteHtml(d) + (hinweis ? '<p class="upa-q-hinweis">' + esc(hinweis) + '</p>' : '') +
      '<div class="up-box upa-q-code" role="region" aria-label="' + esc(t("Initial HTML")) + '" style="--upa-q-ziffern:' + String(d.anf.length).length + '">' +
        '<div class="upa-q-z upa-q-probe" aria-hidden="true"><span class="upa-q-t"><span>' + new Array(65).join("0") + '</span></span></div>' +
        d.bl.map(function (B, i) { return '<div class="upa-q-b" data-b="' + i + '"></div>'; }).join("") +
      '</div>';
    QT.bl = [].slice.call(el.querySelectorAll(".upa-q-b"));
    qtSucheAnlegen();
    /* Ohne Mass (die Probe hatte keine Breite) mit 100 Zeichen je Zeile schaetzen: Platzhalter der Hoehe 0 laegen alle
       zugleich im Bild, und der Beobachter fuellte die ganze Datei auf einmal. */
    if (!qtMessen()) QT.mass = { cpr: 100, zh: 20, breite: -1 };
    qtHoehenSetzen();
    /* Was beim Oeffnen im Bild steht, sofort -- sonst stuende bis zum ersten Rueckruf des Beobachters ein leerer Kasten da. */
    var sc = QT.ctx.koerper, bis = (sc.clientHeight || 900) + QT_RAND, y = 0;
    for (var i = 0; i < QT.bl.length && y < bis; i++) { qtFuellen(i); y += QT.bl[i].offsetHeight; }
    if (typeof IntersectionObserver === "function") {
      QT.io = new IntersectionObserver(function (ein) {
        ein.forEach(function (x) { var j = +x.target.getAttribute("data-b"); if (x.isIntersecting) qtFuellen(j); else qtLeeren(j); });
      }, { root: sc, rootMargin: QT_RAND + "px 0px" });
      QT.bl.forEach(function (b) { QT.io.observe(b); });
    }
    if (typeof ResizeObserver === "function") {
      QT.ro = new ResizeObserver(function () { var alt = QT.mass && QT.mass.breite; if (qtMessen() && QT.mass.breite !== alt) qtHoehenSetzen(); });
      QT.ro.observe(el.querySelector(".upa-q-code"));
    }
  }

  /* ---- Suche: das Feld aus core (UC.makeSearch, Kern-Vorgaben 2 Zeichen und 400 ms), Treffer ohne Gross und Klein wie
     UC.highlight; Enter springt zum naechsten, Umschalt+Enter zum vorigen. ---- */
  function qtSucheAnlegen() {
    var box = QT.el.querySelector(".upa-q-suche"), input = box && box.querySelector(".up-search-input");
    if (!input || !UC.makeSearch) return;
    var st = { query: "", page: 1, loading: false };
    var kit = UC.makeSearch({ root: QT.el, box: box, input: input, state: st, mobileMax: 0, prefix: "upaq",
      onRender: function () {}, onFire: function () { st.loading = false; qtSuchen(st.query); } });
    box.addEventListener("click", function (e) {
      if (!e.target.closest(".up-search-clear")) return;
      input.value = ""; st.query = ""; box.classList.remove("has-text");
      kit.cancel(); kit.run();
      try { input.focus(); } catch (x) {}
    });
    input.addEventListener("input", function () { kit.onInput(); });
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      /* Enter vor Ablauf der 400 ms: gleich suchen statt einen Schritt in der alten Trefferliste. */
      if (st.query !== QT.q && (st.query.length >= 2 || !st.query)) { kit.cancel(); kit.run(); return; }
      qtSchritt(e.shiftKey ? -1 : 1);
    });
  }
  function qtSuchen(q) {
    var d = QT.d;
    if (!d) return;
    q = str(q).trim();
    QT.q = q; QT.ql = q.length; QT.treffer = []; QT.mehr = false; QT.aktiv = -1;
    if (q) {
      var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), m;
      while ((m = re.exec(d.text))) {
        if (QT.treffer.length >= QT_MAX) { QT.mehr = true; break; }
        QT.treffer.push(m.index);
      }
    }
    /* Der erste Treffer ab der Stelle, die gerade oben im Bild steht -- nicht zurueck an den Anfang. */
    if (QT.treffer.length) {
      var ab = qtBildAnfang(), lo = 0, hi = QT.treffer.length;
      while (lo < hi) { var mi = (lo + hi) >> 1; if (QT.treffer[mi] < ab) lo = mi + 1; else hi = mi; }
      QT.aktiv = lo < QT.treffer.length ? lo : 0;
    }
    Object.keys(QT.voll).forEach(function (i) { QT.bl[i].innerHTML = qtBlockHtml(d.bl[i]); });
    qtZaehler();
    if (QT.aktiv >= 0) qtHin(QT.aktiv);
  }
  function qtBildAnfang() {
    var sc = QT.ctx && QT.ctx.koerper, l = QT.el.querySelector(".upa-q-leiste");
    if (!sc || !QT.bl.length) return 0;
    var oben = l ? l.getBoundingClientRect().bottom : sc.getBoundingClientRect().top, lo = 0, hi = QT.bl.length - 1;
    while (lo < hi) { var m = (lo + hi) >> 1; if (QT.bl[m].getBoundingClientRect().bottom <= oben) lo = m + 1; else hi = m; }
    return QT.d.bl[lo].s0;
  }
  function qtBlockVon(pos) {
    var bl = QT.d.bl, lo = 0, hi = bl.length - 1;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (bl[m].s0 <= pos) lo = m; else hi = m - 1; }
    return lo;
  }
  function qtZaehler() {
    var z = QT.el && QT.el.querySelector(".upa-q-zahl"), n = QT.treffer.length;
    if (z) z.textContent = !QT.q ? "" : !n ? t("No matches")
      : t("{x} of {n}").replace("{x}", fmtInt(QT.aktiv + 1)).replace("{n}", fmtInt(n) + (QT.mehr ? "+" : ""));
    [].forEach.call(QT.el.querySelectorAll("[data-upa-q-schritt]"), function (b) { b.disabled = !n; });
  }
  function qtSchritt(r) {
    var n = QT.treffer.length;
    if (!n) return;
    var k = ((QT.aktiv < 0 ? (r > 0 ? -1 : 0) : QT.aktiv) + r + n) % n;
    [].forEach.call(QT.el.querySelectorAll(".up-hl.is-aktiv"), function (x) { x.classList.remove("is-aktiv"); });
    QT.aktiv = k;
    [].forEach.call(QT.el.querySelectorAll('.up-hl[data-m="' + k + '"]'), function (x) { x.classList.add("is-aktiv"); });
    qtZaehler();
    qtHin(k);
  }
  /* Zum Treffer: steht er schon zwischen Leiste und unterem Rand, bleibt alles stehen; sonst ein Drittel unter die Leiste. */
  function qtHin(k) {
    var bi = qtBlockVon(QT.treffer[k]), sc = QT.ctx && QT.ctx.koerper;
    if (!sc) return;
    qtFuellen(bi);
    var m = QT.bl[bi] && QT.bl[bi].querySelector('.up-hl[data-m="' + k + '"]');
    if (!m) return;
    var l = QT.el.querySelector(".upa-q-leiste"), rs = sc.getBoundingClientRect(), r = m.getBoundingClientRect();
    var oben = (l ? l.getBoundingClientRect().bottom : rs.top) + 8, unten = rs.bottom - 16;
    if (r.top >= oben && r.bottom <= unten) return;
    sc.scrollTop += r.top - (oben + (unten - oben) / 3);
  }

  /* ---- Der Drawer ---- */
  function qtZeigen(id, k) {
    if (!QT.el) return;
    var nr = ++QT.lauf;
    clearTimeout(QT.uhr);
    if (k) QT.k = k;
    else if (!(QT.d && QT.d.id === id)) QT.k = null;
    QT.id = id;
    QT.ctx.name(QT.k ? kurz(QT.k.url) : "");
    if (QT.d && QT.d.id === id) { qtZeichnen(); return; }
    /* Ohne den Stand aus dem Knopf (Lauf, Seite, Team) gibt es nichts zu fragen. */
    if (!QT.k || !D.uuidOk(id)) { qtZustand("laden"); return; }
    if (QT.k.zustand === "expired") { qtZustand("weg"); return; }
    qtLos();
    QT.el.innerHTML = qtSkelettHtml();
    var k0 = QT.k;
    qtHolen(id, k0).then(function (roh) {
      if (nr !== QT.lauf) return;
      if (!roh.length) { qtZustand("leer"); return; }
      QT.d = qtAufbereiten(id, roh);
      qtZeichnen();
    }, function (f) {
      if (nr !== QT.lauf) return;
      qtZustand(f && f.art);
    });
  }
  function qtZu() {
    QT.lauf++;
    qtLos();
    /* Nach dem Hinausfahren (200 ms) die Knoten weg; das aufbereitete HTML bleibt fuer ein erneutes Oeffnen. */
    clearTimeout(QT.uhr);
    QT.uhr = setTimeout(function () { if (QT.el && !(QT.ctx && QT.ctx.offen())) QT.el.innerHTML = ""; }, 400);
  }
  function qtAnmelden() {
    if (!UC.kernDrawer) return;
    UC.kernDrawer(QT_ART, {
      aufbauen: function (ctx) {
        QT.ctx = ctx;
        /* Eine eigene .up-root wie jeder Drawer-Inhalt: core stempelt das Thema daran, und die Regeln fuer Kaesten im
           Drawer (Rand im Geist-Dunkel) suchen eine .up-root IN der Huelle. */
        ctx.slot.innerHTML = '<div class="up-root upa-q"></div>';
        QT.el = ctx.slot.firstChild;
        QT.el.addEventListener("click", function (e) {
          var s = e.target.closest("[data-upa-q-schritt]");
          if (s) { qtSchritt(+s.getAttribute("data-upa-q-schritt")); return; }
          if (e.target.closest("[data-upa-q-nochmal]")) { QT.d = null; qtZeigen(QT.id, QT.k); }
        });
        /* Cmd/Strg+F sucht im HTML: die Suche des Browsers faende nur die Bloecke, die gerade gefuellt sind. */
        document.addEventListener("keydown", function (e) {
          if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || String(e.key).toLowerCase() !== "f" || !QT.ctx || !QT.ctx.offen()) return;
          var f = QT.el.querySelector(".upa-q-suche .up-search-input");
          if (!f || f.disabled) return;
          e.preventDefault();
          try { f.focus(); f.select(); } catch (x) {}
        }, true);
      },
      zeigen: qtZeigen,
      zu: qtZu
    });
  }
  qtAnmelden();

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
