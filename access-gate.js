/* upstreem access-gate.js — die Sperre der App ohne laufendes Abo (Praefix uag).
   Braucht core.js davor, wie jede Komponente dieser Familie.

   ── Was die Komponente ist ──────────────────────────────────────────────────
   Ein Fenster ueber der ganzen App, das nicht zugeht (28.09. bestellt: "beim Betreten der App ein
   Popup, wo er zur Wiederaufnahme seines Abonnements aufgefordert wird, und der Zugang der App
   damit eingeschraenkt"). Es erscheint, sobald die Abo-RPC sagt, dass das Team keinen Zugang hat
   (has_active_access: false) oder dass es das Team nicht mehr gibt (is_deleted). Es sagt, was los
   ist, und bietet genau die Handlungen an, die den Zugang zurueckbringen -- den alten Tarif wieder
   buchen, einen anderen waehlen, die Zahlungsmethode richten -- und die Wege hinaus: ein anderes
   Team, ein neues Team, abmelden. Ohne einen Weg hinaus saesse fest, wer in mehreren Teams ist
   (auch jeder von upstreem, der ein ausgelaufenes Kundenteam oeffnet).

   ── Was sie NICHT ist ───────────────────────────────────────────────────────
   Sie ist das Schild an der Tuer, nicht das Schloss. Wer die Entwicklerwerkzeuge oeffnet, nimmt
   das Fenster weg; die Daten dahinter muss die Datenbank verweigern -- jede RPC prueft den Zugang
   des Teams, die taeglichen Prompt-Laeufe ueberspringen Teams ohne Zugang. Das steht in der
   Vorlage (bubble/access_gate_bubble.html, "DAS SCHLOSS").
   Sie entscheidet auch nichts: gesperrt wird NUR auf ein ausdrueckliches has_active_access:false
   oder is_deleted:true, gelesen von UC.aboLesen -- demselben Leser wie im Billing-Reiter. Fehlt die
   Angabe, ist die Nutzlast unlesbar oder kommt sie gar nicht, bleibt die App offen: ein Fehler in
   der Anlieferung darf keinen zahlenden Kunden aussperren, und das Schloss sitzt ohnehin in der
   Datenbank. Gemeldet wird das in der Konsole wie in settings-billing -- im UI gibt es hier keine
   Flaeche, auf der ein Lesefehler stehen koennte, ohne die App zu sperren.

   ── Woher die Masse kommen ──────────────────────────────────────────────────
   Nichts davon ist neu erfunden, siehe den Kopf von access-gate.css: die Schale ist core's Modal
   wie in team-orga und settings-billing, die Karte hat die Masse des Einladen-Dialogs, die Tarife
   sind UC.makePlans (dieselbe Reihe wie im Billing-Reiter), die Teamzeilen core's .up-pop-opt mit
   .up-logo-box wie im Teamschalter der Seitenleiste.

   ── Daten hinein (Run-JS, siehe bubble/access_gate_bubble.html) ────────────
     setAccessGate(TEXT)        die Nutzlast der Abo-RPC unveraendert -- DIESELBE wie im
                                Billing-Reiter (setBillingSubscription): {ok, team_id, team_name,
                                is_deleted, deleted_at, billing:{…}}
     setAccessGatePlans(TEXT)   alle Tarife, die Liste der Tarif-RPC unveraendert
     resetAccessGate()          Fenster weg, Vorrat geleert (Teamwechsel ohne Neuladen)
   Alle drei auch mit der Instanz davor: setAccessGate("INSTANCE_ID", TEXT).
   Die Teams fuer "Switch team" kommen NICHT von Bubble: die Seitenleiste hat sie ohnehin (siehe
   leistenTeams).

   ── Ereignisse heraus (ein JSON-Text als einziger Parameter) ────────────────
     uagSelectPlan  { team_id, plan_id, plan_name, billing_interval, price_eur, monthly_price_eur,
                      yearly_price_eur, trial_days, current_plan_id }
                    dieselben Schluessel wie ublSelectPlan im Billing-Reiter -- derselbe Workflow
                    zur Kasse kann beide bedienen. Aus "Reactivate …"/"Continue with …" (der Tarif
                    aus dem Abo) oder aus einer Karte der Tarifliste.
     uagPlans       { team_id, current_plan_id: "" }   Tarifliste geoeffnet -> Tarif-RPC holen
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

    var MISSING = ["makeMount", "makeFire", "makeLate", "leseFehlerHtml", "leerHtml", "icon", "esc",
                   "fmtDate", "t", "themeParam", "makePlans", "aboLesen", "plaeneLesen"]
      .filter(function (k) { return typeof UC[k] !== "function"; });
    if (MISSING.length && window.console) {
      console.error("[access-gate] Die core.js auf dieser Seite ist AELTER als access-gate.js, es " +
        "fehlen: " + MISSING.join(", ") + ". Alle Elemente der Seite auf denselben Commit pinnen.");
    }

    /* ---- Die Uhren, jede mit benanntem Ende ------------------------------------------------
       KLICK_SPERRE_MS: jeder Knopf hier legt bei Stripe etwas an (Kasse, Portal) oder laedt die
       Seite neu (Teamwechsel, Abmelden). Ein Doppelklick waeren zwei Sitzungen; vier Sekunden
       decken die Rundreise ab -- dieselbe Zahl wie "Manage Billing" im Billing-Reiter.
       PLAN_WARTE_MS: bis die Tarife da sein muessen, nachdem die Liste sie angefordert hat -- 8s
       wie im Billing-Reiter und im Onboarding.
       TEAM_SUCHE_MS: so lange wird nach der Teamliste der Seitenleiste gesehen, falls die nach der
       Sperre ankommt. Danach gibt es kein "Switch team" -- die Leiste bekommt ihre Liste im
       selben Seiten-Workflow, 20s sind weit mehr als dessen Laufzeit.
       WURZEL_PRUEF_MS: wie oft das offene Fenster prueft, ob sein Element noch auf der Seite
       steht (siehe wurzelWache). */
    var KLICK_SPERRE_MS = 4000, PLAN_WARTE_MS = 8000, TEAM_SUCHE_MS = 20000, WURZEL_PRUEF_MS = 1500;

    /* Bubble-Platzhalter sind kein Wert -- nur die dieser Vorlage (settings-billing, 27.09.). */
    var PLATZHALTER = { TEAM_ID: 1, INSTANCE_ID: 1 };
    function txt(v) { return String(v == null ? "" : v).trim(); }
    function feld(v) { var s = txt(v); return PLATZHALTER[s] ? "" : s; }
    function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
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

    /* ---- Das Urteil ----------------------------------------------------------------------------
       Aus dem gelesenen Abo (UC.aboLesen) wird genau eine von fuenf Lagen -- oder null, dann ist
       die App offen. Die Reihenfolge ist die Rangfolge:
         deleted   is_deleted -- das Team gibt es nicht mehr. KEINE Reaktivierung: wer ein
                   geloeschtes Team wieder bucht, bezahlt fuer etwas, das es nicht mehr gibt.
                   Das gilt auch bei laufendem Abo -- ein geloeschtes Team ist nicht benutzbar.
         pastdue   is_past_due oder status past_due/unpaid -- das Problem ist die Karte, nicht der
                   Tarif. Der Weg ist das Portal (Zahlungsmethode), keine neue Kasse.
         trial     die Testphase lief aus, ohne dass bezahlt wurde (testVorbei)
         noplan    lesbar, aber kein Abo -- und die RPC sagt ausdruecklich "kein Zugang"
         ended     alles andere ohne Zugang: gekuendigt, abgelaufen
       verwalten: can_manage_billing:false -- dieser Nutzer kann nichts buchen. Er sieht dieselbe
       Lage, aber statt der Knoepfe den Satz, wen er fragen muss. */
    function lageAus(r) {
      if (!r || !r.ok) return null;
      if (!r.geloescht && r.zugang !== false) return null;
      var a = r.abo;
      var art = r.geloescht ? "deleted"
        : !a ? "noplan"
        : a.zahlungOffen ? "pastdue"
        : testVorbei(a) ? "trial"
        : "ended";
      return { art: art, verwalten: r.verwalten !== false, teamId: r.teamId || "",
               teamName: r.teamName || "", geloeschtAm: r.geloeschtAm || "", abo: a || null };
    }
    /* Endete das Abo mit der Testphase? Dann ist es eine abgelaufene Testphase und kein
       gekuendigtes Abo. Ein Abo, das nach der Testphase bezahlt lief und spaeter endete, traegt
       trial_ends_at weiter -- es endete dann aber deutlich NACH ihr. Ein Tag Spielraum faengt ab,
       dass Stripe die Kuendigung Sekunden bis Stunden nach dem Ende der Testphase schreibt. */
    function testVorbei(a) {
      if (a.testLaeuft) return true;
      var t = zeit(a.testBis);
      if (t == null) return false;
      var e = zeit(a.zugangBis || a.beendet || a.gekuendigt);
      return e == null || e <= t + 86400000;
    }
    /* Das Datum im Satz: WANN es endete. Nur eines, das schon war -- ein Datum in der Zukunft bei
       has_active_access:false passt nicht zusammen, und "endete am 3. Oktober" am 28. September
       waere falsch. Dann steht der Satz ohne Datum ("is no longer active"). */
    function warDatum(v) {
      var t = zeit(v);
      if (t == null || t > Date.now()) return "";
      var f = UC.fmtDate(v);
      return f && f !== "–" ? f : "";
    }
    function lageDatum(L) {
      if (L.art === "deleted") return warDatum(L.geloeschtAm);
      var a = L.abo;
      if (!a) return "";
      var ende = warDatum(a.zugangBis) || warDatum(a.beendet) || warDatum(a.gekuendigt);
      return L.art === "trial" ? (warDatum(a.testBis) || ende) : ende;
    }
    /* Kann "Reactivate …" den alten Tarif wieder buchen? Nur mit Id UND Takt: ohne Takt waere es
       eine Kasse zu einem geratenen Preis -- dann fuehrt der Weg ueber die Tarifliste, wo der
       Nutzer den Takt selbst waehlt. */
    function wiederbuchbar(L) {
      return !!(L.abo && L.abo.planId && L.abo.interval);
    }
    /* Was "Reactivate …" meldet: dieselben Schluessel in derselben Reihenfolge wie ein Klick auf
       eine Karte (core planInfo), damit EIN Workflow zur Kasse beide bedient. price_eur ist der
       Betrag JE TAKT zum heutigen Preis des Tarifs; nur ohne den der Betrag des alten Abos.
       trial_days wie es die RPC am Abo fuehrt -- ob ein zurueckkehrender Kunde noch einmal eine
       Testphase bekommt, entscheidet der Workflow, nicht diese Datei. */
    function reaktivInfo(a) {
      var iv = a.interval;
      var preis = iv === "monthly" ? a.monatPreis : (iv === "yearly" ? a.jahrPreis : null);
      if (preis == null) preis = a.preis;
      return {
        plan_id: a.planId,
        plan_name: a.planName,
        billing_interval: iv,
        price_eur: preis,
        monthly_price_eur: a.monatPreis,
        yearly_price_eur: a.jahrPreis,
        trial_days: a.testTage,
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
        plans: isArr(saved.plans) ? saved.plans : null,
        plansFehler: !!saved.plansFehler,
        plansWarten: false,
        /* Welche Seite des Fensters: info (die Nachricht), plans, teams. */
        ansicht: saved.ansicht || "info",
        iv: saved.iv || "",
        ivGewaehlt: !!saved.ivGewaehlt,
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
         Die Schale ist core's Modal, wie das Tarif-Fenster im Billing-Reiter: up-root, damit die
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
        back.innerHTML =
          '<div class="up-topicmodal-card uag-card" role="alertdialog" aria-modal="true"' +
            ' aria-labelledby="uag-t-' + n + '" aria-describedby="uag-d-' + n + '" tabindex="-1">' +
            '<div class="uag-head">' +
              '<button type="button" class="up-iconbtn uag-back" data-uag-back hidden>' +
                UC.icon("arrowLeft", 2) + '</button>' +
              '<div class="uag-heading">' +
                '<h2 class="up-topicmodal-title uag-title" id="uag-t-' + n + '" data-uag-titel></h2>' +
                '<p class="up-topicmodal-sub uag-text" id="uag-d-' + n + '" data-uag-text></p>' +
              '</div>' +
            '</div>' +
            /* Zwei feste Gastgeber statt eines geteilten: die Tarifreihe bleibt stehen, wenn man
               zur Nachricht zurueckgeht. Jede NEUE Reihe haengt in core einen Breitenwaechter an,
               der nie wieder abgemeldet wird (makePlans, widthTiers) -- beim Hin und Her waeren es
               sonst so viele Waechter wie Klicks. */
            '<div class="uag-body" data-uag-body hidden>' +
              '<div class="uag-planbody" data-uag-plans hidden></div>' +
              '<div class="uag-teambody" data-uag-teams hidden></div>' +
            '</div>' +
            '<div class="uag-actions" data-uag-actions>' +
              '<div class="uag-foot" data-uag-foot></div>' +
              /* Der Fehlerkasten aus core, wie im Billing-Reiter: Huelle > Zwischenkasten >
                 Innenkasten, der Zwischenkasten zieht die 0fr-Zeile auf 0. */
              '<div class="up-formerr uag-err" data-uag-err role="alert"><div><div class="up-formerr-in"></div></div></div>' +
              '<div class="uag-meta" data-uag-meta></div>' +
            '</div>' +
          '</div>';
        document.body.appendChild(back);
        G = {
          back: back,
          card: back.querySelector(".uag-card"),
          zurueck: back.querySelector("[data-uag-back]"),
          titel: back.querySelector("[data-uag-titel]"),
          text: back.querySelector("[data-uag-text]"),
          body: back.querySelector("[data-uag-body]"),
          plans: back.querySelector("[data-uag-plans]"),
          teams: back.querySelector("[data-uag-teams]"),
          actions: back.querySelector("[data-uag-actions]"),
          foot: back.querySelector("[data-uag-foot]"),
          err: back.querySelector("[data-uag-err]"),
          meta: back.querySelector("[data-uag-meta]"),
          offen: false, ctrl: null, kit: null, taste: null, wache: null, fehlend: 0,
          teamUhr: null, sperre: null
        };
        /* Ein Klick auf den Grund tut NICHTS -- es gibt kein Schliessen. Alles andere geht an den
           Controller, der das Fenster gerade fuehrt. */
        back.addEventListener("click", function (e) { if (G.ctrl) G.ctrl.klick(e); });
        GATE[instanceId] = G;
        return G;
      }

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
        var d = lageDatum(L);
        var dh = d ? esc(d) : "";
        var plan = L.abo && L.abo.planName;
        var w = { team: teamHtml(L, false), plan: plan ? nameHtml(plan) : "", date: dh };
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
          s1 = plan
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
        var lbl = b.lbl.indexOf("{plan}") >= 0 ? setze(b.lbl, { plan: nameHtml(L.abo.planName || "") }) : esc(UC.t(b.lbl));
        return '<button class="' + (b.pri ? "up-btn-pri" : "up-btn-sec") + ' is-lg uag-btn" type="button"' +
          ' data-uag-tat="' + b.tat + '">' + (b.ic ? UC.icon(b.ic, 2) : "") + '<span>' + lbl + '</span></button>';
      }
      /* Die leisen Wege darunter. "Manage Billing" nur fuer ein Abo, das es gab (Rechnungen,
         Zahlungsmethode) -- bei offener Zahlung ist es schon der Hauptknopf, ohne Abo gibt es im
         Portal nichts zu sehen. "Switch team" nur, wenn es ein anderes Team gibt. Abmelden immer. */
      function metaHtml(L) {
        var h = "";
        if (L.verwalten && (L.art === "ended" || L.art === "trial")) {
          h += '<button class="uag-link" type="button" data-uag-tat="manage">' + UC.icon("creditCard", 2) +
            '<span>' + esc(UC.t("Manage Billing")) + '</span></button>';
        }
        if (andereTeams().length) {
          h += '<button class="uag-link" type="button" data-uag-tat="teams">' + UC.icon("users", 2) +
            '<span>' + esc(UC.t("Switch team")) + '</span></button>';
        }
        h += '<button class="uag-link" type="button" data-uag-tat="logout">' + UC.icon("logOut", 2) +
          '<span>' + esc(UC.t("Log out")) + '</span></button>';
        /* Eine innere Reihe, die um das Polster der Knoepfe nach links rueckt: so steht auch eine
           umbrochene zweite Zeile buendig (gemessen bei 375px Deutsch: "Abmelden" stand 6px
           weiter rechts als "Abrechnung verwalten" darueber). */
        return '<div class="uag-wege">' + h + '</div>';
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
        /* In der Tarif- und der Teamliste gibt es weder Knoepfe noch Wege darunter -- der leere
           Block naehme trotzdem die 32px Luecke der Karte mit (gemessen: ein Streifen unter der
           Liste). Er steht dort nur, solange ein Fehler zu sagen ist. */
        G.actions.hidden = state.ansicht !== "info" && !satz;
      }
      function zeichnen() {
        var G = GATE[instanceId];
        if (!G || G.ctrl !== ctrl) return;
        var L = state.lage;
        if (!L) return;
        if (isDark()) G.back.setAttribute("data-theme", "dark"); else G.back.removeAttribute("data-theme");
        var an = state.ansicht;
        /* Ohne andere Teams gibt es die Teamliste nicht -- auch nicht aus dem Vorrat. */
        if (an === "teams" && !andereTeams().length) an = state.ansicht = "info";
        /* Wer nicht verwalten darf, sieht keine Tarifliste (sie fuehrte in eine Kasse). */
        if (an === "plans" && !L.verwalten) an = state.ansicht = "info";
        G.card.classList.toggle("is-plans", an === "plans");
        G.zurueck.hidden = an === "info";
        G.body.hidden = an === "info";
        G.plans.hidden = an !== "plans";
        G.teams.hidden = an !== "teams";
        G.zurueck.setAttribute("aria-label", UC.t("Back"));
        if (an === "plans") {
          G.titel.textContent = UC.t("All plans");
          G.text.textContent = UC.t("Pick the plan that fits your team.");
          G.foot.innerHTML = "";
          G.meta.innerHTML = "";
          planeZeichnen(G);
        } else if (an === "teams") {
          G.titel.textContent = UC.t("Switch team");
          G.text.textContent = UC.t("Open another team you belong to.");
          G.teams.innerHTML = teamsHtml();
          G.foot.innerHTML = "";
          G.meta.innerHTML = "";
        } else {
          G.titel.textContent = UC.t(TITEL[L.art] || TITEL.ended);
          G.text.innerHTML = textHtml(L);
          G.foot.innerHTML = knoepfe(L).map(function (b) { return knopfHtml(b, L); }).join("");
          G.meta.innerHTML = metaHtml(L);
          teamSuche(G);
        }
        fehlerZeigen(G, state.fehler);
        if (G.sperre) sperreAnwenden(G);
      }
      function aktuellesIv() {
        if (state.ivGewaehlt && state.iv) return state.iv;
        /* Der Takt des alten Abos, sonst Jahr -- die Vorbelegung der Landingpage. */
        return (state.lage && state.lage.abo && state.lage.abo.interval) || state.iv || "yearly";
      }
      /* Der Inhalt der Tarifliste. Reihenfolge wie ueberall im Haus: der Fehler vor dem Skelett --
         nur eine laufende Anfrage geht vor, sie raeumt die Meldung weg, bis ihre Antwort da ist. */
      function planeZeichnen(G) {
        if (state.plansFehler && !state.plansWarten) {
          G.kit = null;
          G.plans.innerHTML = UC.leseFehlerHtml("the plans");
          return;
        }
        if (state.plans && !state.plans.length) {
          G.kit = null;
          G.plans.innerHTML = UC.leerHtml({ titel: "No plans available right now.", icon: "creditCard" });
          return;
        }
        /* Die Rueckrufe fragen G.ctrl und nicht diesen Controller: die Reihe ueberlebt so auch einen
           Neuaufbau der Wurzel. */
        if (!G.kit || !G.plans.contains(G.kit.el)) {
          G.kit = UC.makePlans(G.plans, {
            plans: state.plans,
            interval: aktuellesIv(),
            /* Kein Tarif ist "Current plan": ohne Zugang gibt es keinen laufenden. */
            currentId: "",
            cta: "Get started",
            fuss: "Prices exclude VAT. Cancel any time.",
            onInterval: function (iv) { if (G.ctrl) G.ctrl.ivSetzen(iv); },
            onSelect: function (info) { if (G.ctrl) G.ctrl.waehlen(info); }
          });
          return;
        }
        if (!state.ivGewaehlt) G.kit.setInterval(aktuellesIv());
        G.kit.setPlans(state.plans);
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
        if (!G || !G.offen) return;
        /* Fokus weg, BEVOR aria-hidden kommt -- ein fokussiertes Element unter aria-hidden weist
           Chrome mit einer Konsolenmeldung zurueck. */
        if (G.back.contains(document.activeElement)) { try { document.activeElement.blur(); } catch (e) {} }
        G.offen = false;
        G.back.classList.remove("is-shown");
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
        select: "This plan could not be selected right now. Please reload the page.",
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
      function planeOeffnen() {
        state.plansFehler = false;
        state.plansWarten = true;
        planUhrStarten();
        ansichtSetzen("plans");
        /* ZULETZT feuern (wie im Billing-Reiter): antwortet der Workflow im selben Zug, findet seine
           Antwort den Wartezustand schon gesetzt und beendet ihn. Fehlt der Empfaenger, kommt nie
           eine Antwort -- dann steht der Fehler sofort da und nicht erst nach 8s Schimmern. */
        var ok = fire("data-plans-fn", "uagPlans", mitTeam({ current_plan_id: "" }));
        if (!ok && state.plansWarten) {
          planUhrStoppen();
          state.plansWarten = false;
          if (!state.plans) state.plansFehler = true;
          persist();
          zeichnen();
        }
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
        if (tat === "plans") { planeOeffnen(); return; }
        if (tat === "teams") { ansichtSetzen("teams"); return; }
        if (tat === "reaktiv" && L && L.abo) {
          melden(G, tat, fire("data-select-plan-fn", "uagSelectPlan", mitTeam(reaktivInfo(L.abo))), el);
          return;
        }
        if (tat === "manage") { melden(G, tat, fire("data-manage-fn", "uagManage", mitTeam({})), el); return; }
        if (tat === "newteam") { melden(G, tat, fire("data-newteam-fn", "uagNewTeam", mitTeam({ action: "new_team" })), el); return; }
        if (tat === "logout") { melden(G, tat, fire("data-logout-fn", "uagLogout", mitTeam({ action: "logout" })), el); return; }
      }
      function waehlen(info) {
        var G = GATE[instanceId];
        if (!G) return;
        var ok = fire("data-select-plan-fn", "uagSelectPlan", mitTeam(info));
        var knopf = null;
        try { knopf = G.plans.querySelector('[data-up-plan-go="' + String(info.plan_id).replace(/"/g, "") + '"]'); } catch (e) {}
        melden(G, "select", ok, knopf);
      }
      /* Tab bleibt im Fenster (aria-modal verspricht das), Escape geht eine Seite zurueck und
         schliesst NIE. Und keine Taste erreicht die App dahinter: ihre Kurzbefehle wuerden sonst
         hinter der Sperre weiterarbeiten. stopPropagation und nicht preventDefault -- die Tasten
         des Browsers (neu laden, Adresszeile) bleiben, und ein Knopf im Fenster reagiert weiter
         auf Enter und Leertaste, das ist seine eigene Voreinstellung und kein Zuhoerer. */
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
        if (e.key === "Escape" || e.key === "Esc") {
          e.preventDefault();
          if (state.ansicht !== "info") ansichtSetzen("info");
          return;
        }
        if (e.key === "Tab") fokusFalle(e, G.card);
      }

      /* ---- Warte-Uhr fuer die Tarife ----------------------------------------------------------- */
      var planUhr = null;
      function planUhrStoppen() { if (planUhr) { clearTimeout(planUhr); planUhr = null; } }
      function planUhrStarten() {
        planUhrStoppen();
        planUhr = setTimeout(function () {
          planUhr = null;
          if (!state.plansWarten) return;
          state.plansWarten = false;
          /* Mit Vorrat bleibt der Vorrat stehen -- er ist die letzte gelesene Liste und wahrer als
             ein Fehler. Ohne ihn waere weiteres Schimmern die Luege "gleich da". */
          if (!state.plans) state.plansFehler = true;
          persist();
          zeichnen();
        }, PLAN_WARTE_MS);
      }

      /* ---- Vorrat -------------------------------------------------------------------------------
         Nur eine Wurzel, die noch im Dokument steht, schreibt: die alte lebt nach dem Neuaufbau als
         abgehaengter Knoten weiter und wuerde den Stand der neuen sonst ueberschreiben. */
      function persist() {
        if (!root.isConnected) return;
        STORE[instanceId] = {
          teamId: state.teamId, lage: state.lage,
          plans: state.plans, plansFehler: state.plansFehler,
          ansicht: state.ansicht, iv: state.iv, ivGewaehlt: state.ivGewaehlt
        };
      }

      /* ---- Setter ------------------------------------------------------------------------------ */
      function aboSetzen(p) {
        var r = UC.aboLesen ? UC.aboLesen(p) : { ok: false };
        if (!r.ok) {
          /* Unlesbar: die LETZTE gelesene Lage bleibt stehen -- sie ist wahrer als ein Fehler, und
             ohne sie ist die App offen (siehe Kopf). */
          if (window.console) console.warn("[access-gate] " + instanceId +
            ": setAccessGate konnte die Nutzlast nicht lesen. Es bleibt bei der letzten Lage (" +
            (state.lage ? "gesperrt" : "offen") + ").");
          return;
        }
        var L = lageAus(r);
        var vorher = state.lage;
        state.lage = L;
        if (r.teamId) state.teamId = r.teamId;
        /* Eine andere Lage beginnt auf der Nachricht, nicht auf einer Unterseite der alten. */
        if (!L || !vorher || vorher.art !== L.art || vorher.verwalten !== L.verwalten) {
          state.ansicht = "info";
          state.fehler = "";
        }
        persist();
        if (L) zeigen(); else verbergen();
      }
      function plaeneSetzen(p) {
        var r = UC.plaeneLesen ? UC.plaeneLesen(p) : { ok: false };
        planUhrStoppen();
        state.plansWarten = false;
        if (r.ok) {
          state.plans = r.liste;
          state.plansFehler = false;
        } else {
          state.plansFehler = true;
          if (window.console) console.warn("[access-gate] " + instanceId +
            ": setAccessGatePlans konnte die Nutzlast nicht lesen.");
        }
        persist();
        zeichnen();
      }

      var ctrl = {
        root: root,
        abo: aboSetzen,
        plaene: plaeneSetzen,
        klick: klick,
        taste: taste,
        waehlen: waehlen,
        zeichnen: zeichnen,
        verbergen: verbergen,
        ivSetzen: function (iv) { state.iv = iv; state.ivGewaehlt = true; persist(); },
        reset: function () {
          verbergen();
          planUhrStoppen();
          var G = GATE[instanceId];
          if (G && G.sperre) { clearTimeout(G.sperre.uhr); G.sperre = null; }
          state.lage = null; state.plans = null; state.plansFehler = false; state.plansWarten = false;
          state.ansicht = "info"; state.iv = ""; state.ivGewaehlt = false; state.fehler = "";
          /* Geloescht und nicht mit dem leeren Stand ueberschrieben: ein ausdrueckliches Reset darf
             ein Neuaufbau nicht rueckgaengig machen. */
          delete STORE[instanceId];
        },
        /* Zahlen-, Datums- oder Sprachwahl geaendert (makeMount ruft das bei up-prefs-change). */
        redraw: function () {
          var G = GATE[instanceId];
          if (G && G.ctrl === ctrl && G.kit) G.kit.redraw();
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
