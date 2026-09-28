/* upstreem access-gate.js — die Sperre der App ohne laufendes Abo (Praefix uag).
   Braucht core.js davor, wie jede Komponente dieser Familie.

   ── Was die Komponente ist ──────────────────────────────────────────────────
   Ein Fenster ueber der ganzen App, das nicht zugeht (28.09. bestellt: "beim Betreten der App ein
   Popup, wo er zur Wiederaufnahme seines Abonnements aufgefordert wird, und der Zugang der App
   damit eingeschraenkt"). Es erscheint, sobald die Quota-RPC sagt, dass das Team keinen Zugang
   hat (has_access: false). Es sagt, was los ist, und bietet genau die Handlungen an, die den
   Zugang zurueckbringen -- den alten Tarif wieder buchen, einen anderen waehlen, die
   Zahlungsmethode richten -- und die Wege hinaus: ein anderes Team, ein neues Team, abmelden.
   Ohne einen Weg hinaus saesse fest, wer in mehreren Teams ist (auch jeder von upstreem, der ein
   ausgelaufenes Kundenteam oeffnet).
   Solange es steht, geht kein Drawer der App auf, auch nicht aus einem Link (siehe "Kein Drawer
   hinter der Sperre").

   ── Was sie NICHT ist ───────────────────────────────────────────────────────
   Sie ist das Schild an der Tuer, nicht das Schloss. Wer die Entwicklerwerkzeuge oeffnet, nimmt
   das Fenster weg; die Daten dahinter muss die Datenbank verweigern -- jede RPC prueft den Zugang
   des Teams (bubble/access_gate_setup.md).
   Sie entscheidet auch nichts: das Urteil faellt die Datenbank (team_access, dieselbe Funktion,
   die jede RPC davor fragt) und liefert es in der Quota-RPC mit -- has_access und access_state.
   Gesperrt wird NUR auf ein ausdrueckliches has_access:false. Fehlt die Angabe, ist die Nutzlast
   unlesbar oder kommt sie gar nicht, bleibt die App offen: ein Fehler in der Anlieferung darf
   keinen zahlenden Kunden aussperren, und das Schloss sitzt ohnehin in der Datenbank. Gemeldet
   wird das in der Konsole wie in settings-billing -- im UI gibt es hier keine Flaeche, auf der
   ein Lesefehler stehen koennte, ohne die App zu sperren.
   Ein Loeschdatum in der ZUKUNFT (28.09. gemeldet: "is_deleted kann auch mit einem Datum in der
   Zukunft kommen") ist deshalb hier kein Fall: bis zu diesem Datum hat das Team Zugang, und das
   sagt team_access mit has_access:true.

   ── Woher die Masse kommen ──────────────────────────────────────────────────
   Nichts davon ist neu erfunden, siehe den Kopf von access-gate.css: die Schale ist core's Modal
   wie in team-orga, die Karte hat die Masse des Einladen-Dialogs, die Teamzeilen sind core's
   .up-pop-opt mit .up-logo-box wie im Teamschalter der Seitenleiste. Die Tarifliste ist KEIN
   eigenes Fenster: es ist UC.makePlanDialog aus core -- exakt das Fenster des Billing-Reiters
   (28.09. gefragt: "kann ich nicht einfach das exakt gleiche Popup nutzen?").

   ── Daten hinein (Run-JS, siehe bubble/access_gate_bubble.html) ────────────
     setAccessGate(TEXT)        die Zeile der Quota-RPC get_team_plan_quota, unveraendert --
                                derselbe Aufruf, der beim Seitenaufbau ohnehin laeuft, um die
                                Felder des Gates erweitert (siehe quotaLesen)
     setAccessGatePlans(TEXT)   alle Tarife, die Liste der Tarif-RPC unveraendert (wie
                                setBillingPlans)
     resetAccessGate()          Fenster weg, Vorrat geleert (Teamwechsel ohne Neuladen)
   Alle drei auch mit der Instanz davor: setAccessGate("INSTANCE_ID", TEXT).
   Die Teams fuer "Switch team" kommen NICHT von Bubble: die Seitenleiste hat sie ohnehin (siehe
   leistenTeams).

   ── Ereignisse heraus (ein JSON-Text als einziger Parameter) ────────────────
     uagSelectPlan  { team_id, plan_id, plan_name, billing_interval, price_eur, monthly_price_eur,
                      yearly_price_eur, trial_days, current_plan_id }
                    dieselben Schluessel wie ublSelectPlan im Billing-Reiter -- derselbe Workflow
                    zur Kasse kann beide bedienen. Aus "Reactivate …"/"Continue with …" (der Tarif
                    aus der Quota-Zeile) oder aus einer Karte des Tarif-Fensters.
     uagPlans       { team_id, current_plan_id: "" }   Tarif-Fenster geoeffnet -> Tarif-RPC holen
     uagManage      { team_id }                         Portal (Zahlungsmethode, Rechnungen)
     uagTeam        { team_id }        das GEWAEHLTE Team -- dieselbe Form wie usnTeam der Leiste
     uagNewTeam     { team_id, action: "new_team" }     dieselbe Form wie usnNewTeam
     uagLogout      { team_id, action: "logout" }       dieselbe Form wie usnLogout
   Die letzten drei duerfen auf DIESELBEN bubble_fn_* zeigen wie die Seitenleiste: die Workflows
   dahinter gibt es schon. */
(function () {
  "use strict";

  var API_NAMES = ["setAccessGate", "setAccessGatePlans", "resetAccessGate"];
  var Q = (window.__uagBootQueue = window.__uagBootQueue || []);

  /* ---- Fruehe Aufrufe: zwei Warteschlangen, eine Reihenfolge ------------------------------
     Wie settings-billing: was im Platzhalter des Kopf-Snippets landete (window.__upFrueh), holt
     die Datei SELBST ab und stellt es VOR die eigene Warteschlange -- core holt nur in seinen
     Nachlaeufen bis 3s nach dem eigenen Laden nach, und das Gate darf einen Aufruf nicht deshalb
     verlieren, weil die Leitung langsam war. */
  (function fruehUebernehmen() {
    var fr = window.__upFrueh;
    if (!fr || !fr.length) return;
    var mein = [], rest = [];
    for (var i = 0; i < fr.length; i++) {
      (fr[i] && API_NAMES.indexOf(fr[i][0]) >= 0 ? mein : rest).push(fr[i]);
    }
    if (!mein.length) return;
    window.__upFrueh = rest;
    Array.prototype.unshift.apply(Q, mein);
  })();
  /* Der eigene Stub ersetzt NUR den Platzhalter des Kopf-Snippets (__upShim) oder ein Loch. */
  API_NAMES.forEach(function (n) {
    var f = window[n];
    if (typeof f === "function" && !f.__upShim) return;
    window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function uagBoot(n) {
    if (!window.UpstreemCore) {
      if (n > 0) { setTimeout(function () { uagBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[access-gate] UpstreemCore (core.js) not loaded");
      return;
    }
    uagRun();
  }

  function uagRun() {
    var UC = window.UpstreemCore;
    var esc = UC.esc;

    var MISSING = ["makeMount", "makeFire", "makeLate", "leerHtml", "icon", "esc", "fmtDate", "t",
                   "themeParam", "readBubble", "toNum", "planInterval", "plaeneLesen", "makePlanDialog",
                   "drawerRiegel"]
      .filter(function (k) { return typeof UC[k] !== "function"; });
    if (MISSING.length && window.console) {
      console.error("[access-gate] Die core.js auf dieser Seite ist AELTER als access-gate.js, es " +
        "fehlen: " + MISSING.join(", ") + ". Alle Elemente der Seite auf denselben Commit pinnen.");
    }

    /* ---- Die Uhren, jede mit benanntem Ende ------------------------------------------------
       KLICK_SPERRE_MS: jeder Knopf hier legt bei Stripe etwas an (Kasse, Portal) oder laedt die
       Seite neu (Teamwechsel, Abmelden). Ein Doppelklick waeren zwei Sitzungen; vier Sekunden
       decken die Rundreise ab -- dieselbe Zahl wie "Manage Billing" im Billing-Reiter.
       TEAM_SUCHE_MS: so lange wird nach der Teamliste der Seitenleiste gesehen, falls die nach der
       Sperre ankommt. Danach gibt es kein "Switch team" -- die Leiste bekommt ihre Liste im
       selben Seiten-Workflow, 20s sind weit mehr als dessen Laufzeit.
       WURZEL_PRUEF_MS: wie oft das offene Fenster prueft, ob sein Element noch auf der Seite
       steht (siehe wurzelWache).
       Die Uhr fuer die Tarife (8s) fuehrt das Tarif-Fenster selbst (core, makePlanDialog). */
    var KLICK_SPERRE_MS = 4000, TEAM_SUCHE_MS = 20000, WURZEL_PRUEF_MS = 1500;

    /* ---- Kein Drawer hinter der Sperre (28.09.) -------------------------------------------------
       Bestellt: "dass in dem Zustand keine Drawer offen sein koennen -- wenn man mit einem
       Drawer-Link auf die Seite kommt und das Team keinen Zugang hat, sollen sich die Drawer gar
       nicht erst oeffnen, oder zumindest nicht angezeigt werden." Drei Teile, fuer zwei
       Reihenfolgen:
         - Die Sperre kommt ZUERST (der Normalfall): die Host-App stellt einen Drawer aus der
           Adresse (?detail=...) erst mit drawersReady() her, und das steht am ENDE des
           Seiten-Workflows, hinter der Quota-RPC. Dann haelt der Riegel aus core den Aufruf von
           openDrawer auf -- es geht nichts auf, und der Bubble-Workflow des Drawers mit seinen
           RPCs laeuft gar nicht erst los.
         - Der Drawer war SCHON offen, als die Sperre kam (Quota-Zeile langsamer als der Rest):
           dann geht er zu, siehe drawerZu.
         - Und ausgeblendet ist jeder Drawer, solange die Sperre steht (access-gate.css): fuer
           die 180ms, in denen einer hinausgleitet, und fuer eine Host-App ohne closeAllDrawers.
       Alles haengt an EINER Klasse am <html>. Sie folgt dem, was zu sehen ist -- irgendein Gate
       mit is-shown --, und keinem Zaehler: so bleibt sie richtig, egal wie viele Wurzeln,
       Neuaufbauten oder Kopien dieser Datei es auf der Seite gab. */
    var SPERR_KLASSE = "uag-gesperrt";
    function sperrMarke() {
      document.documentElement.classList.toggle(SPERR_KLASSE, !!document.querySelector(".uag-backdrop.is-shown"));
    }
    if (typeof UC.drawerRiegel === "function") {
      UC.drawerRiegel(function () { return document.documentElement.classList.contains(SPERR_KLASSE); });
    }
    /* Ein offener Drawer geht zu, mit dem Werkzeug der Host-App selbst (window.closeAllDrawers,
       Drawer-System v4): es schliesst alle, nimmt den Scroll-Lock von #main und den Drawer aus der
       Adresse, genau wie ein Klick auf das X -- ein Neuladen oeffnet ihn also nicht wieder, und
       nach einem Teamwechsel ohne Neuladen steht nicht der Drawer des alten Teams da.
       Nur, wenn wirklich einer offen ist: ohne offenen Drawer naehme closeAllDrawers trotzdem die
       Klasse drawer-locked von #main, und die setzen auch opportunities und prompt-research fuer
       ihre eigenen Flaechen. Fehlt das Werkzeug (aeltere Host-App), schliesst core die Drawer,
       deren Oeffnen es mitbekommen hat; was dann noch offen ist, bleibt ausgeblendet. */
    function drawerZu() {
      if (!document.querySelector('[id^="drawer-"].open')) return;
      try {
        if (typeof window.closeAllDrawers === "function") window.closeAllDrawers();
        else if (typeof UC.closeAllDrawers === "function") UC.closeAllDrawers();
      } catch (e) {
        if (window.console) console.warn("[access-gate] Die offenen Drawer liessen sich nicht schliessen:", e);
      }
    }

    /* Bubble-Platzhalter sind kein Wert -- nur die dieser Vorlage (settings-billing, 27.09.). */
    var PLATZHALTER = { TEAM_ID: 1, INSTANCE_ID: 1 };
    function txt(v) { return String(v == null ? "" : v).trim(); }
    function feld(v) { var s = txt(v); return PLATZHALTER[s] ? "" : s; }
    function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
    /* Ein ausdrueckliches Nein, in jeder Form, in der es ankommen kann: false aus echtem JSON,
       "false"/"no" aus einem Bubble-Ausdruck. Fehlt der Wert, ist es KEIN Nein. */
    function nein(v) { return v === false || /^(false|no|0)$/i.test(txt(v)); }
    function zeit(v) {
      if (!v) return null;
      var d = new Date(v);
      return isNaN(d.getTime()) ? null : d.getTime();
    }

    /* ---- EIN NEU GEBAUTES ELEMENT MACHT WEITER -------------------------------------------------
       Bubble baut das HTML-Element neu, sobald sich ein dynamischer Wert darin aendert -- beim
       Themenwechsel jedes Mal. Die Nutzlast kommt dann NICHT noch einmal. Also ein Vorrat am
       window je data-instance (wie settings-billing), und das Fenster am body bleibt stehen: die
       neue Wurzel uebernimmt es, statt es zu und wieder auf zu machen. Eine Sperre, die bei jedem
       Themenwechsel kurz die App freigibt, waere keine. */
    var STORE = (window.__uagStore = window.__uagStore || {});
    var GATE = {};
    var SEQ = 0;

    var spaet = UC.makeLate ? UC.makeLate("access-gate", ".uag-root") : null;
    var mount;

    /* ---- Die Quota-Zeile lesen --------------------------------------------------------------
       get_team_plan_quota liefert EINE Zeile je Team, als Liste mit einem Eintrag (28.09.
       geliefert: plan_id, plan_name, prompts_per_day, active_prompts, remaining_by_active,
       competitors_max_active, competitors_active, competitors_remaining). Fuer das Gate kommt
       dazu (bubble/access_gate_setup.md, Schritt 3):
         team_id, team_name     wessen Zugang, fuer Ereignisse und den Satz
         has_access             DAS URTEIL -- team_access(team_id), dieselbe Funktion wie vor
                                jeder RPC
         access_state           warum nicht: deleted | past_due | trial_ended | no_plan | ended
         access_ended_at        seit wann nicht (beim geloeschten Team: das Loeschdatum)
         can_manage_billing     darf DIESER Nutzer buchen
         billing_interval       Takt des letzten Abos -- ohne ihn kein "Reactivate <Tarif>"
         monthly_price_eur, yearly_price_eur   freiwillig: der Preis im Ereignis zur Kasse
       Leer ("", "null", "[]") heisst: keine Zeile, also kein Urteil -- die App bleibt offen.
       Unlesbar ist etwas anderes (CLAUDE.md 2): das meldet die Konsole, und die letzte gelesene
       Lage bleibt stehen. */
    function quotaLesen(p) {
      if (p == null) return { ok: true, zeile: null };
      if (typeof p === "string") {
        var s = p.trim();
        if (!s || s === "null" || s === "[]" || s === "{}") return { ok: true, zeile: null };
        p = UC.readBubble(s);
        if (p == null) return { ok: false };
      }
      /* readBubble liefert ein Objekt als Liste mit EINEM Eintrag; die RPC selbst auch. */
      if (isArr(p)) {
        if (!p.length) return { ok: true, zeile: null };
        p = p[0];
      }
      if (!p || typeof p !== "object" || isArr(p)) return { ok: false };
      if (nein(p.ok)) return { ok: false };
      return { ok: true, zeile: p };
    }
    /* Das Urteil wird nur GELESEN. Gesperrt ist nur ein ausdrueckliches Nein; welche der fuenf
       Lagen es ist, sagt access_state -- die Datenbank weiss, ob eine Testphase auslief oder eine
       Zahlung offen ist, die Oberflaeche muesste es aus Datumswerten raten. Ein unbekannter Wert
       ist "ended": der allgemeine Satz passt immer.
       verwalten: can_manage_billing:false -- dieser Nutzer kann nichts buchen. Er sieht dieselbe
       Lage, aber statt der Knoepfe den Satz, wen er fragen muss. */
    var ARTEN = { deleted: "deleted", past_due: "pastdue", unpaid: "pastdue", trial_ended: "trial",
                  no_plan: "noplan", ended: "ended" };
    function lageAus(z) {
      if (!z || !nein(z.has_access)) return null;
      var st = txt(z.access_state).toLowerCase();
      return {
        art: ARTEN[st] || "ended",
        verwalten: !nein(z.can_manage_billing),
        teamId: txt(z.team_id),
        teamName: txt(z.team_name),
        endeAm: txt(z.access_ended_at),
        planId: txt(z.plan_id),
        planName: txt(z.plan_name),
        interval: UC.planInterval(z.billing_interval),
        monatPreis: UC.toNum(z.monthly_price_eur),
        jahrPreis: UC.toNum(z.yearly_price_eur)
      };
    }
    /* Das Datum im Satz: WANN es endete. Nur eines, das schon war -- ein Datum in der Zukunft bei
       has_access:false passt nicht zusammen, und "endete am 3. Oktober" am 28. September waere
       falsch. Dann steht der Satz ohne Datum ("is no longer active"). */
    function warDatum(v) {
      var t = zeit(v);
      if (t == null || t > Date.now()) return "";
      var f = UC.fmtDate(v);
      return f && f !== "–" ? f : "";
    }
    /* Kann "Reactivate …" den alten Tarif wieder buchen? Nur mit Id UND Takt: ohne Takt waere es
       eine Kasse zu einem geratenen Preis -- dann fuehrt der Weg ueber das Tarif-Fenster, wo der
       Nutzer den Takt selbst waehlt. */
    function wiederbuchbar(L) { return !!(L.planId && L.interval); }
    /* Was "Reactivate …" meldet: dieselben Schluessel in derselben Reihenfolge wie ein Klick auf
       eine Karte (core planInfo), damit EIN Workflow zur Kasse beide bedient. Preise nur, wenn die
       Quota-Zeile sie mitbringt; trial_days bleibt leer -- ob ein zurueckkehrender Kunde noch
       einmal eine Testphase bekommt, entscheidet der Workflow, nicht diese Datei. */
    function reaktivInfo(L) {
      var preis = L.interval === "monthly" ? L.monatPreis : (L.interval === "yearly" ? L.jahrPreis : null);
      return {
        plan_id: L.planId,
        plan_name: L.planName,
        billing_interval: L.interval,
        price_eur: preis,
        monthly_price_eur: L.monatPreis,
        yearly_price_eur: L.jahrPreis,
        trial_days: null,
        current_plan_id: ""
      };
    }

    /* ---- Die Teams des Nutzers -- aus der Seitenleiste -----------------------------------------
       "Switch team" braucht die Liste der Teams. Die Seitenleiste hat sie auf jeder Seite der App
       ohnehin (setSidebarTeams), in ihrem Vorrat am window (sidebar.js: window.__usnStore, je
       Instanz .teams und .teamsDa). Hier wird sie nur GELESEN -- eine zweite Anlieferung aus Bubble
       waere derselbe Text ein zweites Mal. Aendert die Leiste die Form ihres Vorrats, faellt hier
       "Switch team" weg, ohne Absturz; der Hinweis steht deshalb auch dort. */
    function leistenTeams() {
      var S = window.__usnStore;
      if (!S || typeof S !== "object") return null;
      for (var k in S) {
        if (!Object.prototype.hasOwnProperty.call(S, k)) continue;
        var v = S[k];
        if (v && v.teamsDa && isArr(v.teams)) return v.teams;
      }
      return null;
    }
    function logoHtml(name, url) {
      /* Die Kachel aus core (.up-logo-box), mit dem Anfangsbuchstaben darunter -- faellt das Bild
         aus, steht der Buchstabe da (dieselbe Reihenfolge wie in sidebar.js: erst die Klasse weg,
         dann das Bild). */
      var q = txt(url);
      var ltr = '<span class="up-logo-ltr">' + esc(txt(name).charAt(0) || "?") + '</span>';
      if (!/^https?:\/\//i.test(q)) return '<span class="up-logo-box">' + ltr + '</span>';
      return '<span class="up-logo-box has-img"><img src="' + esc(q) + '" alt="" referrerpolicy="no-referrer" ' +
        'onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/>' + ltr + '</span>';
    }

    /* ══ Eine Wurzel ═════════════════════════════════════════════════════════════════════════ */
    function initRoot(root) {
      if (root.__uagController) return;
      var instanceId = root.getAttribute("data-instance") || "default";

      /* Der Vorrat gilt nur fuer DAS Team, zu dem er aufgenommen wurde: nach einem Teamwechsel
         ohne Neuladen stuende sonst die Sperre des alten Teams ueber dem neuen. */
      var teamJetzt = feld(root.getAttribute("data-team"));
      var saved = STORE[instanceId] || {};
      if (saved.teamId && teamJetzt && saved.teamId !== teamJetzt) saved = {};

      var state = {
        teamId: saved.teamId || teamJetzt,
        /* Die Lage (lageAus). null: die App ist offen. */
        lage: saved.lage || null,
        /* Welche Seite des Fensters: info (die Nachricht) oder teams. Die Tarife sind kein Teil
           davon -- sie sind das Tarif-Fenster aus core, das UEBER dem Gate aufgeht. */
        ansicht: saved.ansicht === "teams" ? "teams" : "info",
        /* Der Satz im Fehlerkasten, wenn ein Klick keinen Empfaenger fand. */
        fehler: ""
      };

      var fire = UC.makeFire(root, { label: "access-gate", eventPrefix: "uag" });
      function isDark() {
        return UC.themeParam(root.getAttribute("data-isdark")) || root.getAttribute("data-theme") === "dark";
      }
      /* Die Wurzel selbst zeigt nichts (0x0, access-gate.css) -- das Fenster haengt am body. */
      root.innerHTML = "";

      /* ---- Das Fenster ------------------------------------------------------------------------
         Die Schale ist core's Modal, wie der Einladen-Dialog in team-orga: up-root, damit die
         Marken aus core gelten und der Themen-Durchlauf von core es findet; up-portal, weil es am
         body haengt -- setUpstreemTheme() stempelt genau diese beiden. Am body und nicht im
         Element: kein overflow eines Bubble-Vorfahren schneidet es ab, und kein z-index eines
         fremden Vorfahren muss angefasst werden.
         Alle Zuhoerer sitzen EINMAL am Fenster und fragen G.ctrl -- so uebernimmt eine neu gebaute
         Wurzel das Fenster, ohne dass ein Zuhoerer an einem toten Controller haengt. */
      function gate() {
        var G = GATE[instanceId];
        if (G && G.back.isConnected) return G;
        var back = document.createElement("div");
        back.className = "up-root up-portal up-topicmodal-backdrop uag-backdrop";
        back.setAttribute("aria-hidden", "true");
        back.setAttribute("data-uag-gate", instanceId);
        var n = ++SEQ;
        /* Drei Bloecke wie auf der Anmeldeseite (28.09. angefordert, siehe access-gate.css):
           oben Logo und die leisen Wege, in der Mitte was los ist, unten die Knoepfe. */
        back.innerHTML =
          '<div class="up-topicmodal-card uag-card" role="alertdialog" aria-modal="true"' +
            ' aria-labelledby="uag-t-' + n + '" aria-describedby="uag-d-' + n + '" tabindex="-1">' +
            '<div class="uag-top">' +
              '<span class="uag-marke" data-uag-marke></span>' +
              '<nav class="uag-wege" data-uag-meta></nav>' +
            '</div>' +
            '<div class="uag-mid">' +
              '<div class="uag-head">' +
                '<button type="button" class="up-iconbtn uag-back" data-uag-back hidden>' +
                  UC.icon("arrowLeft", 2) + '</button>' +
                '<div class="uag-heading">' +
                  '<h2 class="uag-title" id="uag-t-' + n + '" data-uag-titel></h2>' +
                  '<p class="uag-text" id="uag-d-' + n + '" data-uag-text></p>' +
                '</div>' +
              '</div>' +
              '<div class="uag-body" data-uag-body hidden></div>' +
              /* Der Fehlerkasten aus core, wie im Billing-Reiter: Huelle > Zwischenkasten >
                 Innenkasten, der Zwischenkasten zieht die 0fr-Zeile auf 0. */
              '<div class="up-formerr uag-err" data-uag-err role="alert"><div><div class="up-formerr-in"></div></div></div>' +
            '</div>' +
            '<div class="uag-foot" data-uag-foot></div>' +
          '</div>';
        document.body.appendChild(back);
        G = {
          back: back,
          card: back.querySelector(".uag-card"),
          zurueck: back.querySelector("[data-uag-back]"),
          marke: back.querySelector("[data-uag-marke]"),
          titel: back.querySelector("[data-uag-titel]"),
          text: back.querySelector("[data-uag-text]"),
          body: back.querySelector("[data-uag-body]"),
          foot: back.querySelector("[data-uag-foot]"),
          err: back.querySelector("[data-uag-err]"),
          meta: back.querySelector("[data-uag-meta]"),
          offen: false, ctrl: null, taste: null, wache: null, fehlend: 0,
          teamUhr: null, sperre: null, kommtUhr: null
        };
        /* Ein Klick auf den Grund tut NICHTS -- es gibt kein Schliessen. Alles andere geht an den
           Controller, der das Fenster gerade fuehrt. */
        back.addEventListener("click", function (e) { if (G.ctrl) G.ctrl.klick(e); });
        GATE[instanceId] = G;
        return G;
      }

      /* ---- Das Tarif-Fenster -- dasselbe wie im Billing-Reiter (core, makePlanDialog) ----------
         Es geht UEBER dem Gate auf (core.css: 100002 gegen 100001) und schliesst wie dort mit X,
         Escape und Klick daneben -- darunter steht wieder das Gate. praefix "uagp" und nicht
         "uag": dessen Klassen (.uag-backdrop, .uag-card) traegt schon das Gate selbst, und ihre
         Regeln (Breite 520, z-index) duerfen das Tarif-Fenster nicht treffen. Derselbe key liefert
         einer neu gebauten Wurzel dasselbe Fenster mit ihren Rueckrufen. */
      var dlg = typeof UC.makePlanDialog === "function" ? UC.makePlanDialog({
        key: "uag:" + instanceId,
        praefix: "uagp",
        isDark: isDark,
        /* Kein Tarif ist "Current plan": ohne Zugang gibt es keinen laufenden. */
        currentId: function () { return ""; },
        interval: function () { return (state.lage && state.lage.interval) || ""; },
        onOpen: function () {
          return fire("data-plans-fn", "uagPlans", mitTeam({ current_plan_id: "" }));
        },
        onSelect: function (info) {
          var ok = fire("data-select-plan-fn", "uagSelectPlan", mitTeam(info));
          /* Das Tarif-Fenster geht danach zu, das Gate steht wieder da -- und seine Knoepfe
             stehen dieselben 4s still wie nach einem eigenen Klick: ein "Reactivate" jetzt waere
             die zweite Kasse. */
          var G = GATE[instanceId];
          if (ok && G) sperren(G, null);
          return ok;
        }
      }) : null;

      /* ---- Die Saetze ----------------------------------------------------------------------------
         Jeder Satz geht beim Zeichnen durch UC.t: der Sprachlauf von core erreicht ein Fenster am
         body nicht verlaesslich, und ein Satz, der erst beim Einfuegen uebersetzt wird, bliebe
         nach einem Neuzeichnen englisch. Die Platzhalter kommen NACH der Uebersetzung hinein --
         der Katalog kennt den Satz mit {plan}, nicht mit "Enterprise". Namen gehen escaped und
         unter translate="no" hinein: ein Team- oder Tarifname ist ein Name. */
      var TITEL = {
        ended: "Your subscription has ended",
        trial: "Your free trial has ended",
        pastdue: "The last payment didn't go through",
        noplan: "This team doesn't have a plan yet",
        deleted: "This team has been deleted"
      };
      function nameHtml(s) { return '<span translate="no">' + esc(s) + '</span>'; }
      function setze(satz, werte) {
        var h = esc(UC.t(satz));
        for (var k in werte) if (Object.prototype.hasOwnProperty.call(werte, k)) h = h.split("{" + k + "}").join(werte[k]);
        return h;
      }
      /* Der Teamname, oder "this team" -- am Satzanfang gross ("This team was deleted"). */
      function teamHtml(L, anfang) {
        if (L.teamName) return nameHtml(L.teamName);
        var s = UC.t("this team");
        return esc(anfang ? s.charAt(0).toUpperCase() + s.slice(1) : s);
      }
      function textHtml(L) {
        var d = warDatum(L.endeAm);
        var dh = d ? esc(d) : "";
        var w = { team: teamHtml(L, false), plan: L.planName ? nameHtml(L.planName) : "", date: dh };
        var s1, s2;
        if (L.art === "deleted") {
          s1 = d ? setze("{team} was deleted on {date}.", { team: teamHtml(L, true), date: dh })
                 : setze("{team} was deleted.", { team: teamHtml(L, true) });
          s2 = andereTeams().length ? "Switch to another team or create a new one."
                                    : "Create a new team to keep using upstreem.";
        } else if (L.art === "pastdue") {
          s1 = setze("The latest payment for {team} could not be collected.", w);
          s2 = L.verwalten ? "Update the payment method to restore access."
                           : "Ask a team owner to update the payment method.";
        } else if (L.art === "trial") {
          s1 = setze(d ? "The free trial for {team} ended on {date}." : "The free trial for {team} has ended.", w);
          s2 = L.verwalten ? "Choose a plan to keep using upstreem." : "Ask a team owner to choose a plan.";
        } else if (L.art === "noplan") {
          s1 = setze("{team} needs an active plan to use upstreem.", { team: teamHtml(L, true) });
          s2 = L.verwalten ? "Pick the plan that fits your team." : "Ask a team owner to choose a plan.";
        } else {
          s1 = L.planName
            ? setze(d ? "The {plan} plan for {team} ended on {date}." : "The {plan} plan for {team} is no longer active.", w)
            : setze(d ? "The subscription for {team} ended on {date}." : "The subscription for {team} is no longer active.", w);
          s2 = !L.verwalten ? "Ask a team owner to reactivate it."
             : wiederbuchbar(L) ? "Reactivate it to pick up where you left off."
             : "Choose a plan to pick up where you left off.";
        }
        return s1 + " " + esc(UC.t(s2));
      }

      /* ---- Die Knoepfe -------------------------------------------------------------------------
         Je Lage genau EIN Hauptknopf -- die Handlung, die den Zugang zurueckbringt -- und
         hoechstens ein zweiter. Wer nicht verwalten darf, bekommt keinen: jeder davon fuehrte in
         eine Kasse oder ein Portal, das Stripe ihm verweigert. Ausnahme ist das geloeschte Team:
         ein neues anlegen darf jeder, genau wie im Teamschalter der Seitenleiste. */
      function knoepfe(L) {
        var k = [];
        if (L.art === "deleted") {
          k.push({ tat: "newteam", lbl: "Create a new team", pri: true, ic: "plus" });
          return k;
        }
        if (!L.verwalten) return k;
        if (L.art === "pastdue") {
          k.push({ tat: "manage", lbl: "Update payment method", pri: true, ic: "creditCard" });
          return k;
        }
        if ((L.art === "ended" || L.art === "trial") && wiederbuchbar(L)) {
          k.push({ tat: "plans", lbl: "See all plans" });
          k.push({ tat: "reaktiv", pri: true,
                   lbl: L.art === "trial" ? "Continue with {plan}" : "Reactivate {plan}" });
          return k;
        }
        k.push({ tat: "plans", lbl: "See all plans", pri: true });
        return k;
      }
      function knopfHtml(b, L) {
        var lbl = b.lbl.indexOf("{plan}") >= 0 ? setze(b.lbl, { plan: nameHtml(L.planName || "") }) : esc(UC.t(b.lbl));
        return '<button class="' + (b.pri ? "up-btn-pri" : "up-btn-sec") + ' is-lg uag-btn" type="button"' +
          ' data-uag-tat="' + b.tat + '"' + (b.tat === "plans" ? ' aria-haspopup="dialog"' : "") + '>' +
          (b.ic ? UC.icon(b.ic, 2) : "") + '<span>' + lbl + '</span></button>';
      }
      /* Die leisen Wege, oben rechts in der Kopfzeile (28.09.: "die Leiste unten als Topbar").
         "Manage Billing" nur fuer ein Abo, das es gab (Rechnungen, Zahlungsmethode) -- bei offener
         Zahlung ist es schon der Hauptknopf, ohne Abo gibt es im Portal nichts zu sehen. "Switch
         team" nur, wenn es ein anderes Team gibt, und nicht in der Teamliste selbst. Abmelden
         immer. Der Name steht auch als aria-label und title am Knopf: auf dem Telefon zeigen die
         Wege nur ihr Zeichen (access-gate.css). */
      function wegHtml(tat, ic, lbl) {
        var t = esc(UC.t(lbl));
        return '<button class="uag-link" type="button" data-uag-tat="' + tat + '" aria-label="' + t +
          '" title="' + t + '">' + UC.icon(ic, 2) + '<span>' + t + '</span></button>';
      }
      function metaHtml(L, inListe) {
        var h = "";
        if (!inListe && L.verwalten && (L.art === "ended" || L.art === "trial")) {
          h += wegHtml("manage", "creditCard", "Manage Billing");
        }
        if (!inListe && andereTeams().length) h += wegHtml("teams", "users", "Switch team");
        h += wegHtml("logout", "logOut", "Log out");
        return h;
      }
      /* Keine Statuspille ueber der Ueberschrift mehr (28.09.: "mach den Team-geloescht-Chip
         weg"). Sie sagte in zwei Woertern, was die Ueberschrift direkt darunter in einem Satz sagt
         -- in allen fuenf Lagen, deshalb ist sie fuer alle weg, nicht nur fuer das geloeschte Team. */
      /* Das Logo oben links. Eigene Quellen hat das Element nur, wenn Bubble sie setzt (data-logo,
         data-logo-dark -- dieselben Namen wie auf der Anmeldeseite). Ohne sie nimmt es die der
         Seitenleiste, die im selben Reusable steht und ihre Logos ohnehin traegt
         (data-upstreem-logo, -dark): kein zweites Attribut, das in Bubble gepflegt werden muss.
         Nur echte Adressen zaehlen -- ein Platzhalter aus einer Vorlage ("UPSTREEM_LOGO") laedt
         nie. Ohne Bild der Schriftzug als Text, wie in der Seitenleiste. */
      function logoQuelle(v) {
        var q = txt(v);
        if (/^\/\//.test(q)) q = "https:" + q;
        return /^https?:\/\//i.test(q) || /^data:image\//i.test(q) ? q : "";
      }
      function markeHtml() {
        var hell = logoQuelle(root.getAttribute("data-logo"));
        var dunkel = logoQuelle(root.getAttribute("data-logo-dark"));
        if (!hell && !dunkel) {
          var leiste = document.querySelector(".usn-root");
          if (leiste) {
            hell = logoQuelle(leiste.getAttribute("data-upstreem-logo"));
            dunkel = logoQuelle(leiste.getAttribute("data-upstreem-logo-dark"));
          }
        }
        hell = hell || dunkel; dunkel = dunkel || hell;
        /* Bricht ein Bild, gehen BEIDE: sonst stuende im anderen Thema das eine, im einen gar
           nichts -- der Schriftzug darunter tritt nur zurueck, solange ein Bild da ist. */
        function bild(q, kl) {
          return '<img class="uag-logo' + (kl ? " " + kl : "") + '" src="' + esc(q) + '" alt="upstreem"' +
            ' onerror="var m=this.parentNode;[].slice.call(m.querySelectorAll(\'img\')).forEach(function(i){i.remove();})"/>';
        }
        var wort = '<span class="uag-wort" translate="no">upstreem</span>';
        if (!hell) return wort;
        return (hell === dunkel ? bild(hell, "") : bild(hell, "is-hell") + bild(dunkel, "is-dunkel")) + wort;
      }

      /* ---- Teams ----------------------------------------------------------------------------- */
      function aktuellesTeam() {
        return (state.lage && state.lage.teamId) || state.teamId || (UC.getTeam ? UC.getTeam() : "") || "";
      }
      function andereTeams() {
        var l = leistenTeams() || [];
        var jetzt = aktuellesTeam();
        return l.filter(function (t) { return t && t.id != null && txt(t.id) && txt(t.id) !== jetzt; });
      }
      function teamsHtml() {
        var l = andereTeams();
        if (!l.length) return UC.leerHtml({ titel: "No other teams", icon: "users" });
        return '<div class="uag-teams">' + l.map(function (t) {
          return '<button class="up-pop-opt uag-team" type="button" data-uag-team="' + esc(txt(t.id)) + '">' +
            logoHtml(t.name, t.favicon_url) +
            '<span class="uag-team-txt">' +
              '<span class="uag-team-name" translate="no">' + esc(txt(t.name) || "–") + '</span>' +
              (txt(t.domain) ? '<span class="uag-team-dom" translate="no">' + esc(txt(t.domain)) + '</span>' : "") +
            '</span>' +
          '</button>';
        }).join("") + '</div>';
      }
      /* Kommt die Teamliste der Leiste NACH der Sperre, taucht "Switch team" nachtraeglich auf.
         Gesehen wird alle 500ms, bis sie da ist oder TEAM_SUCHE_MS um sind -- nicht ewig. */
      function teamSuche(G) {
        if (G.teamUhr || leistenTeams()) return;
        var bis = Date.now() + TEAM_SUCHE_MS;
        G.teamUhr = setInterval(function () {
          var da = leistenTeams();
          if (da || Date.now() > bis || !G.offen) {
            clearInterval(G.teamUhr); G.teamUhr = null;
            if (da && G.offen && G.ctrl) G.ctrl.zeichnen();
          }
        }, 500);
      }

      /* ---- Zeichnen ---------------------------------------------------------------------------- */
      function fehlerZeigen(G, satz) {
        state.fehler = satz || "";
        G.err.querySelector(".up-formerr-in").textContent = satz ? UC.t(satz) : "";
        G.err.classList.toggle("is-on", !!satz);
      }
      function zeichnen() {
        var G = GATE[instanceId];
        if (!G || G.ctrl !== ctrl) return;
        var L = state.lage;
        if (!L) return;
        if (isDark()) G.back.setAttribute("data-theme", "dark"); else G.back.removeAttribute("data-theme");
        /* Ohne andere Teams gibt es die Teamliste nicht -- auch nicht aus dem Vorrat. */
        if (state.ansicht === "teams" && !andereTeams().length) state.ansicht = "info";
        var teams = state.ansicht === "teams";
        G.marke.innerHTML = markeHtml();
        G.zurueck.hidden = !teams;
        G.zurueck.setAttribute("aria-label", UC.t("Back"));
        G.body.hidden = !teams;
        G.meta.setAttribute("aria-label", UC.t("Account"));
        G.meta.innerHTML = metaHtml(L, teams);
        if (teams) {
          G.titel.textContent = UC.t("Switch team");
          G.text.textContent = UC.t("Open another team you belong to.");
          G.body.innerHTML = teamsHtml();
          G.foot.innerHTML = "";
        } else {
          G.titel.textContent = UC.t(TITEL[L.art] || TITEL.ended);
          G.text.innerHTML = textHtml(L);
          G.body.innerHTML = "";
          G.foot.innerHTML = knoepfe(L).map(function (b) { return knopfHtml(b, L); }).join("");
          teamSuche(G);
        }
        fehlerZeigen(G, state.fehler);
        if (G.sperre) sperreAnwenden(G);
      }

      /* ---- Zeigen und verbergen ------------------------------------------------------------------ */
      function zeigen() {
        var G = gate();
        var neu = !G.offen;
        G.ctrl = ctrl;
        zeichnen();
        if (!neu) return;
        G.offen = true;
        G.back.setAttribute("aria-hidden", "false");
        /* Einmal Layout erzwingen, sonst laeuft der Uebergang von opacity 0 nicht (core's
           Topic-Modal, derselbe Kniff). */
        void G.back.offsetWidth;
        G.back.classList.add("is-shown");
        /* Erst die Klasse, dann zu: so gleitet der Drawer schon ausgeblendet hinaus. */
        sperrMarke();
        drawerZu();
        /* Der Inhalt kommt in zwei Stufen herein (access-gate.css, Auftritt). Die Klasse geht nach
           dem Durchlauf wieder ab, sonst liefe die Bewegung beim naechsten Erscheinen nicht noch
           einmal -- und bei jedem Neuzeichnen nicht versehentlich mit. */
        G.card.classList.add("is-kommt");
        if (G.kommtUhr) clearTimeout(G.kommtUhr);
        G.kommtUhr = setTimeout(function () { G.card.classList.remove("is-kommt"); G.kommtUhr = null; }, 700);
        G.taste = function (e) { if (G.ctrl) G.ctrl.taste(e); };
        /* Am window und in der Fangphase: das ist die allererste Station jeder Taste. Am document
           kaeme das zu spaet -- quick-actions hoert dort selbst in der Fangphase auf Cmd/Ctrl+K,
           ist frueher angemeldet und oeffnete seine Palette in der obersten Ebene UEBER der Sperre
           (von dort ginge es zu Seiten und zum Export). */
        window.addEventListener("keydown", G.taste, true);
        /* Den Fokus ins Fenster: was auf der Seite dahinter fokussiert war, bekaeme sonst die Tasten. */
        setTimeout(function () { try { if (G.offen) G.card.focus(); } catch (e) {} }, 40);
        wurzelWache(G);
      }
      function verbergen() {
        var G = GATE[instanceId];
        /* Das Tarif-Fenster gehoert zur Sperre -- ist der Zugang zurueck, geht es mit. */
        if (dlg && dlg.isOpen()) dlg.close();
        if (!G || !G.offen) return;
        /* Fokus weg, BEVOR aria-hidden kommt -- ein fokussiertes Element unter aria-hidden weist
           Chrome mit einer Konsolenmeldung zurueck. */
        if (G.back.contains(document.activeElement)) { try { document.activeElement.blur(); } catch (e) {} }
        G.offen = false;
        G.back.classList.remove("is-shown");
        sperrMarke();
        G.back.setAttribute("aria-hidden", "true");
        if (G.taste) window.removeEventListener("keydown", G.taste, true);
        G.taste = null;
        if (G.wache) { clearInterval(G.wache); G.wache = null; }
        if (G.teamUhr) { clearInterval(G.teamUhr); G.teamUhr = null; }
      }
      /* Verschwindet das Element von der Seite und kommt keine neue Wurzel derselben Instanz nach
         (ein Neuaufbau bringt sie im selben Zug), geht das Fenster weg: es gehoerte zu einem
         Element, das Bubble hier nicht mehr zeigt. Zweimal hintereinander, damit ein Neuaufbau,
         der sich ueber zwei Takte zieht, das Fenster nicht zucken laesst. Der Vorrat bleibt --
         kommt das Element zurueck, steht die Sperre sofort wieder. */
      function wurzelWache(G) {
        if (G.wache) return;
        G.fehlend = 0;
        G.wache = setInterval(function () {
          if (!G.offen) { clearInterval(G.wache); G.wache = null; return; }
          var da = G.ctrl && G.ctrl.root && G.ctrl.root.isConnected;
          if (!da) {
            var alle = document.querySelectorAll(".uag-root");
            for (var i = 0; i < alle.length; i++) {
              if ((alle[i].getAttribute("data-instance") || "default") === instanceId) { da = true; break; }
            }
          }
          G.fehlend = da ? 0 : G.fehlend + 1;
          if (G.fehlend >= 2 && G.ctrl) G.ctrl.verbergen();
        }, WURZEL_PRUEF_MS);
      }

      /* ---- Handlungen ------------------------------------------------------------------------- */
      /* team_id VORN: zuerst die aus der Nutzlast (das Team, dem die Sperre gilt), sonst data-team
         DIESES Elements. Ohne beides haengt core die Team-Id der Seite an (makeFire). */
      function mitTeam(o) {
        var tid = (state.lage && state.lage.teamId) || feld(root.getAttribute("data-team"));
        if (!tid) return o;
        var out = { team_id: tid };
        for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k];
        return out;
      }
      /* Nach einem Klick, der einen Empfaenger hatte, stehen ALLE Knoepfe des Fensters 4s still:
         der Workflow leitet weiter, und ein zweiter Klick waere eine zweite Kasse. */
      function sperreAnwenden(G) {
        var bs = G.card.querySelectorAll("button:not([data-uag-back])");
        for (var i = 0; i < bs.length; i++) bs[i].disabled = !!G.sperre;
        var t = G.sperre && G.sperre.knopf;
        if (t && t.isConnected) t.setAttribute("aria-busy", "true");
      }
      function sperren(G, knopf) {
        if (G.sperre) clearTimeout(G.sperre.uhr);
        G.sperre = { knopf: knopf || null, uhr: setTimeout(function () {
          var alt = G.sperre;
          G.sperre = null;
          if (alt && alt.knopf) alt.knopf.removeAttribute("aria-busy");
          var bs = G.card.querySelectorAll("button:not([data-uag-back])");
          for (var i = 0; i < bs.length; i++) bs[i].disabled = false;
        }, KLICK_SPERRE_MS) };
        sperreAnwenden(G);
      }
      /* Ein Ereignis, das keinen Empfaenger fand, sagt es im Fenster -- ein Knopf, der still nichts
         tut, ist in einem Fenster, das man nicht schliessen kann, eine Falle. */
      var FEHLER = {
        reaktiv: "This plan could not be selected right now. Please reload the page.",
        manage: "The billing portal could not be opened. Please reload the page.",
        team: "The team could not be switched right now. Please reload the page.",
        newteam: "A new team could not be created right now. Please reload the page.",
        logout: "You could not be logged out right now. Please reload the page."
      };
      function melden(G, tat, ok, knopf) {
        if (!ok) { fehlerZeigen(G, FEHLER[tat]); return; }
        fehlerZeigen(G, "");
        sperren(G, knopf);
      }
      function ansichtSetzen(an) {
        state.ansicht = an;
        state.fehler = "";
        persist();
        zeichnen();
        var G = GATE[instanceId];
        if (G) setTimeout(function () { try { if (G.offen) G.card.focus(); } catch (e) {} }, 0);
      }
      function klick(e) {
        var t = e.target;
        var G = GATE[instanceId];
        if (!G || !t || !t.closest) return;
        if (t.closest("[data-uag-back]")) { ansichtSetzen("info"); return; }
        var b = t.closest("button");
        if (b && b.disabled) return;
        var tm = t.closest("[data-uag-team]");
        if (tm) {
          melden(G, "team", fire("data-team-fn", "uagTeam", { team_id: tm.getAttribute("data-uag-team") }), tm);
          return;
        }
        var el = t.closest("[data-uag-tat]");
        if (!el) return;
        var tat = el.getAttribute("data-uag-tat");
        var L = state.lage;
        if (tat === "plans") {
          fehlerZeigen(G, "");
          if (dlg) dlg.open(el);
          return;
        }
        if (tat === "teams") { ansichtSetzen("teams"); return; }
        if (tat === "reaktiv" && L) {
          melden(G, tat, fire("data-select-plan-fn", "uagSelectPlan", mitTeam(reaktivInfo(L))), el);
          return;
        }
        if (tat === "manage") { melden(G, tat, fire("data-manage-fn", "uagManage", mitTeam({})), el); return; }
        if (tat === "newteam") { melden(G, tat, fire("data-newteam-fn", "uagNewTeam", mitTeam({ action: "new_team" })), el); return; }
        if (tat === "logout") { melden(G, tat, fire("data-logout-fn", "uagLogout", mitTeam({ action: "logout" })), el); return; }
      }
      /* Tab bleibt im Fenster (aria-modal verspricht das), Escape geht eine Seite zurueck und
         schliesst NIE. Und keine Taste erreicht die App dahinter: ihre Kurzbefehle wuerden sonst
         hinter der Sperre weiterarbeiten. stopPropagation und nicht preventDefault -- die Tasten
         des Browsers (neu laden, Adresszeile) bleiben, und ein Knopf im Fenster reagiert weiter
         auf Enter und Leertaste, das ist seine eigene Voreinstellung und kein Zuhoerer.
         Steht das Tarif-Fenster offen, bekommt ES die Taste: sein eigener Zuhoerer am document
         hoert hinter dieser Fangphase nichts mehr (Escape schliesst es, Tab bleibt darin). */
      function fokusFalle(e, card) {
        var f = [].filter.call(card.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
          function (x) { return !x.disabled && x.getClientRects().length > 0; });
        if (!f.length) { e.preventDefault(); card.focus(); return; }
        var erst = f[0], letzt = f[f.length - 1], a = document.activeElement;
        if (e.shiftKey && (a === erst || a === card || !card.contains(a))) { e.preventDefault(); letzt.focus(); }
        else if (!e.shiftKey && (a === letzt || !card.contains(a))) { e.preventDefault(); erst.focus(); }
      }
      function taste(e) {
        var G = GATE[instanceId];
        if (!G || !G.offen) return;
        e.stopPropagation();
        if (dlg && dlg.isOpen()) { dlg.taste(e); return; }
        if (e.key === "Escape" || e.key === "Esc") {
          e.preventDefault();
          if (state.ansicht !== "info") ansichtSetzen("info");
          return;
        }
        if (e.key === "Tab") fokusFalle(e, G.card);
      }

      /* ---- Vorrat -------------------------------------------------------------------------------
         Nur eine Wurzel, die noch im Dokument steht, schreibt: die alte lebt nach dem Neuaufbau als
         abgehaengter Knoten weiter und wuerde den Stand der neuen sonst ueberschreiben. */
      function persist() {
        if (!root.isConnected) return;
        STORE[instanceId] = { teamId: state.teamId, lage: state.lage, ansicht: state.ansicht };
      }

      /* ---- Setter ------------------------------------------------------------------------------ */
      function aboSetzen(p) {
        var r = quotaLesen(p);
        if (!r.ok) {
          /* Unlesbar: die LETZTE gelesene Lage bleibt stehen -- sie ist wahrer als ein Fehler, und
             ohne sie ist die App offen (siehe Kopf). */
          if (window.console) console.warn("[access-gate] " + instanceId +
            ": setAccessGate konnte die Nutzlast nicht lesen. Es bleibt bei der letzten Lage (" +
            (state.lage ? "gesperrt" : "offen") + ").");
          return;
        }
        var L = lageAus(r.zeile);
        var vorher = state.lage;
        state.lage = L;
        if (L && L.teamId) state.teamId = L.teamId;
        /* Eine andere Lage beginnt auf der Nachricht, nicht auf der Teamliste der alten. */
        if (!L || !vorher || vorher.art !== L.art || vorher.verwalten !== L.verwalten) {
          state.ansicht = "info";
          state.fehler = "";
        }
        persist();
        if (L) zeigen(); else verbergen();
      }
      function plaeneSetzen(p) {
        var r = UC.plaeneLesen ? UC.plaeneLesen(p) : { ok: false };
        if (!dlg) return;
        if (r.ok) dlg.setPlans(r.liste);
        else {
          dlg.setFehler();
          if (window.console) console.warn("[access-gate] " + instanceId +
            ": setAccessGatePlans konnte die Nutzlast nicht lesen.");
        }
      }

      var ctrl = {
        root: root,
        abo: aboSetzen,
        plaene: plaeneSetzen,
        klick: klick,
        taste: taste,
        zeichnen: zeichnen,
        verbergen: verbergen,
        reset: function () {
          verbergen();
          if (dlg) dlg.reset();
          var G = GATE[instanceId];
          if (G && G.sperre) { clearTimeout(G.sperre.uhr); G.sperre = null; }
          state.lage = null; state.ansicht = "info"; state.fehler = "";
          /* Geloescht und nicht mit dem leeren Stand ueberschrieben: ein ausdrueckliches Reset darf
             ein Neuaufbau nicht rueckgaengig machen. */
          delete STORE[instanceId];
        },
        /* Zahlen-, Datums- oder Sprachwahl geaendert (makeMount ruft das bei up-prefs-change). */
        redraw: function () {
          if (dlg) dlg.redraw();
          zeichnen();
        }
      };
      root.__uagController = ctrl;

      /* Aendert Bubble data-team AN ORT UND STELLE (ohne Neuaufbau), gilt die Sperre des alten
         Teams nicht mehr -- weg damit, bis die Nutzlast des neuen kommt. */
      if (window.MutationObserver) {
        new MutationObserver(function () {
          var t = feld(root.getAttribute("data-team"));
          if (t && state.teamId && t !== state.teamId) { ctrl.reset(); state.teamId = t; persist(); return; }
          if (t) state.teamId = t;
          persist();
        }).observe(root, { attributes: true, attributeFilter: ["data-team"] });
      }

      /* Stand die Sperre schon (Neuaufbau), steht sie sofort wieder -- dasselbe Fenster, ohne
         Zucken: zeigen() uebernimmt ein offenes und zeichnet es nur neu. */
      if (state.lage) zeigen();
      persist();
      if (spaet) spaet.drain(instanceId, ctrl);
    }

    /* Ohne Kennung ("default") trifft ein Aufruf jede Wurzel -- eine Seite hat genau ein Gate.
       Genauer Name schlaegt Praefix (team-orga, 02.09. gemessen). Gibt es noch keine Wurzel,
       wartet der Aufruf (makeLate) und laeuft, sobald das Element erscheint. */
    function each(id, fn) {
      var roots = Array.prototype.slice.call(document.querySelectorAll(".uag-root"));
      var genau = id !== "default" && roots.some(function (r) {
        return String(r.getAttribute("data-instance") || "default") === id; });
      roots = roots.filter(function (r) {
        var rid = String(r.getAttribute("data-instance") || "default");
        return id === "default" ? true : (genau ? rid === id : rid.indexOf(id) === 0);
      });
      roots.forEach(function (r) {
        if (r.__uagController) return;
        try { initRoot(r); }
        catch (e) { if (window.console) console.error("[access-gate] initRoot ist gescheitert:", e); }
      });
      var mit = roots.filter(function (r) { return !!r.__uagController; });
      if (!mit.length && spaet) { spaet.park(id, fn); return; }
      mit.forEach(function (r) { fn(r.__uagController); });
    }
    /* (TEXT) oder (INSTANZ, TEXT). Unterschieden am ZWEITEN Argument und nicht an der Zahl der
       Argumente: der Weiterreicher von makeMount ueber Rahmengrenzen ruft immer mit drei. */
    function zwei(a, b, fn) {
      var mitId = b !== undefined;
      each(mitId ? (txt(a) || "default") : "default", function (c) { fn(c, mitId ? b : a); });
    }

    mount = UC.makeMount({
      onMount: function (m) { mount = m; },
      rootClass: "uag-root", notPortal: true,
      ctrlProp: "__uagController",
      resolveLocal: "__uagResolveLocal",
      queue: "__uagBootQueue",
      initRoot: initRoot,
      redraw: function (c) { if (c && c.redraw) c.redraw(); },
      api: {
        setAccessGate: function (a, b) { zwei(a, b, function (c, p) { c.abo(p); }); },
        setAccessGatePlans: function (a, b) { zwei(a, b, function (c, p) { c.plaene(p); }); },
        resetAccessGate: function (id) { each(txt(id) || "default", function (c) { c.reset(); }); }
      },
      forwardShape: { resetAccessGate: "id" }
    });
  }

  uagBoot(50);
})();
