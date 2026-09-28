/* upstreem settings-billing.js — "Billing & Subscription" im Settings-Bereich (Praefix ubl).
   Braucht core.js davor, wie jede Komponente dieser Familie.

   ── Was die Komponente ist ──────────────────────────────────────────────────
   Der dritte Reiter der Settings-Seite (page-headers/settings-page-header.js: Your Brand, Team,
   Billing). Ein Abschnitt: Ueberschrift, Beschreibung und rechts daneben "Manage Billing", das
   Stripes Kundenportal oeffnet. Darunter die kleine Tabelle zum laufenden Abo. In ihrer Zeile
   "Current plan" oeffnet "See all plans" ein Fenster mit allen Tarifen -- die Karten darin sind
   UC.makePlans aus core, also die Karte der Landingpage, mit dem eigenen Tarif markiert.

   ── Was sie NICHT ist ───────────────────────────────────────────────────────
   Sie rechnet nichts ab und entscheidet nichts. Das Portal, die Kasse und jeder Tarifwechsel
   laufen in Bubble (Stripe). Diese Datei zeigt, was die RPC liefert, und schickt die Ereignisse
   -- mit allem, was ein Workflow dafuer braucht, damit er nichts nachschlagen muss.

   ── Woher die Masse kommen ──────────────────────────────────────────────────
   Nichts davon ist neu erfunden. Siehe den Kopf von settings-billing.css:
     Abschnitt   settings-brand / team-orga (dieselbe Seite): Titel 16/500, Beschreibung 13/400
                 in der dritten Farbe, 12 im Abschnitt, Lesebreite 720
     Kopfknopf   rechts im Abschnittskopf wie "Invite new Members" in team-orga, hier .up-btn-pri
     Tabelle     die Tabellenschale von team-orga (Rahmen 1, Radius 12) mit core's .up-thead /
                 .up-row / .up-td, Kopf 45, Zeile 52, Zellen 13px
     Zeilenknopf .up-btn-sec.up-rowbtn aus core, dauerhaft sichtbar wie in team-orga
     Fenster     core's Modalschale (.up-topicmodal-backdrop / -card / .up-popup-close)
     Karten      UC.makePlans (core)

   ── Daten hinein (Run-JS, siehe bubble/settings_billing_bubble.html) ───────
     setBillingSubscription(TEXT)     die Nutzlast der Abo-RPC unveraendert: {ok, billing, team_id}
                                      (Schluessel siehe UC.aboLesen in core)
     setBillingPlans(TEXT)            alle Tarife, die Liste der Tarif-RPC unveraendert
     resetBilling()                   zurueck ins Skelett, Vorrat geleert (Teamwechsel)
   Alle drei auch mit der Instanz davor: setBillingSubscription("INSTANCE_ID", TEXT). Ohne sie
   gilt "default", und das trifft jede Platzierung -- eine Seite hat genau eine.

   ── Ereignisse heraus (ein JSON-Text als einziger Parameter) ────────────────
     ublManage      { team_id }                               "Manage Billing"
     ublPlans       { team_id, current_plan_id }              Fenster geoeffnet -> Tarif-RPC holen
     ublSelectPlan  { team_id, plan_id, plan_name, billing_interval, price_eur,
                      monthly_price_eur, yearly_price_eur, trial_days, current_plan_id }
   team_id kommt aus der Nutzlast des Abos (team_id), sonst aus data-team, sonst haengt core die
   Team-Id der Seite an (makeFire). current_plan_id ist der Tarif, auf den das Team GERADE Zugang
   hat (billing_plan_id bei has_active_access), sonst leer.
   Die Tarif-Id kommt NICHT uebers Element: data-plan-id gibt es seit dem 28.09. nicht mehr. */
(function () {
  "use strict";

  var API_NAMES = ["setBillingSubscription", "setBillingPlans", "resetBilling"];
  var Q = (window.__ublBootQueue = window.__ublBootQueue || []);

  /* ---- Fruehe Aufrufe: zwei Warteschlangen, eine Reihenfolge ------------------------------
     Das Kopf-Snippet (bubble/page_header_preload*.html) legt fuer jeden Namen seiner UP_API eine
     Platzhalterfunktion an, deren Aufrufe in window.__upFrueh landen. core holt sie nach, aber nur
     in seinen fuenf Nachlaeufen bis 3s nach dem eigenen Laden -- kommt diese Datei spaeter (eine
     langsame Leitung, 40 Dateien in Welle 2), bleibt der Aufruf dort fuer immer liegen, und die
     Tabelle steht im Skelett, bis die Warte-Uhr sie auf den Fehler setzt.
     Also holt die Datei ihre Aufrufe SELBST ab, und zwar VOR die eigene Warteschlange: was im
     Kopf-Snippet landete, ist aelter als alles, was danach am Stub der Vorlage ankam. makeMount
     arbeitet die Warteschlange dann in genau dieser Reihenfolge ab. */
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
  /* Der eigene Stub ersetzt NUR den Platzhalter des Kopf-Snippets (__upShim) oder ein Loch. Eine
     echte Funktion (diese Datei ein zweites Mal geladen) und der Stub der Vorlage bleiben stehen
     -- der schreibt ohnehin in dieselbe Warteschlange. */
  API_NAMES.forEach(function (n) {
    var f = window[n];
    if (typeof f === "function" && !f.__upShim) return;
    window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function ublBoot(n) {
    if (!window.UpstreemCore) {
      if (n > 0) { setTimeout(function () { ublBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[settings-billing] UpstreemCore (core.js) not loaded");
      return;
    }
    ublRun();
  }

  function ublRun() {
    var UC = window.UpstreemCore;
    var esc = UC.esc;

    var MISSING = ["makeMount", "makeFire", "makeLate", "readBubble", "leseFehlerHtml", "leerHtml",
                   "icon", "esc", "fmtDate", "t", "toNum", "widthTiers", "themeParam",
                   "makePlans", "planInterval", "planListe", "fmtEur", "aboLesen", "plaeneLesen"]
      .filter(function (k) { return typeof UC[k] !== "function"; });
    if (MISSING.length && window.console) {
      console.error("[settings-billing] Die core.js auf dieser Seite ist AELTER als " +
        "settings-billing.js, es fehlen: " + MISSING.join(", ") + ". Alle Elemente der Seite auf " +
        "denselben Commit pinnen.");
    }

    /* ---- Die Uhren, jede mit benanntem Ende --------------------------------------------------
       WARTE_MS: bis das Abo da sein muss. 25s wie team-orga, brand-detail und domain-detail --
       ohne Ende ist "kommt gleich" nicht von "kommt nie" zu unterscheiden.
       PLAN_WARTE_MS: bis die Tarife da sein muessen, nachdem das Fenster sie angefordert hat. 8s
       wie im Onboarding (PLAN_MAX_MS): drei Zeilen aus der Datenbank, wer laenger wartet, wartet
       auf etwas, das nicht mehr kommt.
       KLICK_SPERRE_MS: "Manage Billing" legt beim Klick eine Portal-Sitzung bei Stripe an. Ein
       Doppelklick waeren zwei Sitzungen und zwei Weiterleitungen; vier Sekunden decken die
       Rundreise ab und sind kurz genug, dass ein Nutzer, der aus einem neuen Tab zurueckkommt,
       den Knopf wieder bedienen kann. */
    var WARTE_MS = 25000, PLAN_WARTE_MS = 8000, KLICK_SPERRE_MS = 4000;

    /* Bubble-Platzhalter sind kein Wert. NUR die dieser Vorlage und keine Regel ueber
       Grossbuchstaben: settings-brand hat am 27.09. gemessen, dass /^[A-Z_]{3,}$/ auch ein Team
       "ADAC" verschluckt. */
    var PLATZHALTER = { TEAM_ID: 1, PLAN_ID: 1, INSTANCE_ID: 1 };
    function txt(v) { return String(v == null ? "" : v).trim(); }
    function feld(v) { var s = txt(v); return PLATZHALTER[s] ? "" : s; }
    function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }

    /* ---- EIN NEU GEBAUTES ELEMENT MACHT WEITER -------------------------------------------------
       Bubble baut das HTML-Element neu, sobald sich ein dynamischer Wert darin aendert -- beim
       Themenwechsel jedes Mal (27.09. gemeldet, siehe team-orga und settings-brand). Die alte
       Wurzel fliegt weg,
       eine frische Kopie der Vorlage kommt mit derselben data-instance, und Bubble schickt die
       Nutzlasten NICHT noch einmal. Ohne Vorrat stuende danach das Skelett fuer immer da.
       Also ein Speicher am window, je data-instance, wie team-orga und settings-brand: Abo,
       Tarife, die Stellung des Schalters und eine laufende Warte-Uhr. Das Fenster ist nach einem
       Neuaufbau zu -- es gehoerte der alten Wurzel. */
    var STORE = (window.__ublStore = window.__ublStore || {});
    /* Ein Fenster je Instanz, am body. Es lebt laenger als die Wurzel, die es geoeffnet hat, und
       wird von der naechsten weiterbenutzt (D.ctrl zeigt auf den Controller, der es zuletzt
       geoeffnet hat). */
    var DLG = {};
    var DLG_SEQ = 0;
    /* Wechselt die Host-App die Ansicht (die Settings-Seite wird verlassen), geht ein offenes
       Fenster zu. Es haengt am body und laege sonst mit z-index 100000 ueber der naechsten Seite --
       settings-brand verlangt dafuer einen Reset-Aufruf aus Bubble; hier reicht der Zuhoerer, den
       core ohnehin fuehrt (showView). EIN Zuhoerer fuer alle Instanzen, nicht einer je Wurzel. */
    if (UC.onViewChange) UC.onViewChange(function () {
      Object.keys(DLG).forEach(function (k) {
        var D = DLG[k];
        if (D && D.offen && D.ctrl) D.ctrl.planeSchliessen();
      });
    });

    var spaet = UC.makeLate ? UC.makeLate("settings-billing", ".ubl-root") : null;
    var mount;

    /* ---- Abo und Tarife lesen -------------------------------------------------------------------
       Seit dem 28.09. in core (UC.aboLesen, UC.plaeneLesen): access-gate liest dieselbe Nutzlast,
       und das Urteil "hat Zugang" darf es nur einmal geben -- sonst zeigte dieser Reiter einen
       laufenden Tarif, waehrend das Gate dieselbe App sperrt. Was gelesen wird und welche Felder
       herauskommen, steht dort. Fehlt der Leser (core auf einem aelteren Pin), meldet MISSING das
       oben; hier wird die Nutzlast dann als unlesbar behandelt -- der Lesefehler im UI statt eines
       Absturzes, der den ganzen Run-JS-Schritt mitnaehme. */
    function aboLesen(p) { return UC.aboLesen ? UC.aboLesen(p) : { ok: false }; }
    function plaeneLesen(p) { return UC.plaeneLesen ? UC.plaeneLesen(p) : { ok: false }; }

    /* ══ Eine Wurzel ═════════════════════════════════════════════════════════════════════════ */
    function initRoot(root) {
      if (root.__ublController) return;
      var instanceId = root.getAttribute("data-instance") || "default";

      /* Der Vorrat gilt nur fuer DAS Team, zu dem er aufgenommen wurde (settings-brand): nach
         einem Teamwechsel stuende sonst kurz das Abo des alten Teams da -- falsche Daten sind
         schlimmer als das Skelett, das sie ueberbruecken sollen. */
      var teamJetzt = feld(root.getAttribute("data-team"));
      var saved = STORE[instanceId] || {};
      if (saved.teamId && teamJetzt && saved.teamId !== teamJetzt) saved = {};
      var restWarte = saved.warteBis ? saved.warteBis - Date.now() : 0;

      var state = {
        teamId: saved.teamId || teamJetzt,
        /* Das Team aus der Nutzlast (team_id) -- es gewinnt fuer die Ereignisse gegen data-team:
           die RPC sagt, zu wem das Abo gehoert, das hier steht. */
        aboTeam: saved.aboTeam || "",
        /* can_manage_billing: false blendet "Manage Billing" aus; null heisst "nicht gesagt". */
        verwalten: saved.verwalten === false ? false : null,
        abo: saved.abo || null,
        aboDa: !!saved.aboDa,
        aboFehler: !!saved.aboFehler,
        plans: isArr(saved.plans) ? saved.plans : null,
        plansFehler: !!saved.plansFehler,
        /* Laeuft gerade eine Anfrage fuer die Tarife? Nicht aus dem Vorrat: nach einem Neuaufbau
           ist das Fenster zu, und das naechste Oeffnen fragt ohnehin neu. */
        plansWarten: false,
        /* Die Stellung des Schalters im Fenster. ivGewaehlt: der Nutzer hat selbst umgeschaltet --
           dann bleibt es dabei, auch wenn ein frisches Abo einen anderen Takt meldet. */
        iv: saved.iv || "",
        ivGewaehlt: !!saved.ivGewaehlt
      };

      var fire = UC.makeFire(root, { label: "settings-billing", eventPrefix: "ubl" });
      function isDark() {
        return UC.themeParam(root.getAttribute("data-isdark")) || root.getAttribute("data-theme") === "dark";
      }

      root.innerHTML =
        '<div class="ubl-body">' +
          '<section class="ubl-sec">' +
            '<div class="ubl-sechead">' +
              '<div class="ubl-sectext">' +
                '<h2 class="ubl-sectitle" data-ubl-titel></h2>' +
                '<p class="ubl-secsub" data-ubl-sub></p>' +
                /* Der Fehlerkasten aus core, UNTER der Beschreibung. Das Markup ist das der
                   Vorlaeufer (auth-page, onboarding): Huelle > Zwischenkasten > Innenkasten -- der
                   Zwischenkasten ist das Kind, das die 0fr-Zeile auf 0 zieht. Direkt mit dem
                   gepolsterten Innenkasten blieben zu 22px stehen (gemessen). */
                '<div class="up-formerr ubl-err" data-ubl-manageerr role="alert">' +
                  '<div><div class="up-formerr-in"></div></div></div>' +
              '</div>' +
              '<button class="up-btn-pri ubl-manage" type="button" data-ubl-manage>' +
                UC.icon("creditCard", 2) + '<span data-ubl-managelbl></span></button>' +
            '</div>' +
            '<div class="ubl-table" data-ubl-table></div>' +
          '</section>' +
        '</div>';

      var elTitel = root.querySelector("[data-ubl-titel]");
      var elSub = root.querySelector("[data-ubl-sub]");
      var elManage = root.querySelector("[data-ubl-manage]");
      var elManageLbl = root.querySelector("[data-ubl-managelbl]");
      var elManageErr = root.querySelector("[data-ubl-manageerr]");
      var elTable = root.querySelector("[data-ubl-table]");

      /* Die Stufen der Breite, wie settings-brand: unter 768 steht der Knopf unter dem Text,
         unter 500 die Bezeichnung ueber dem Wert (settings-billing.css). */
      UC.widthTiers(root);
      /* Fuer den Hinweis an einer gedaempften Tarifpille ("No active billing plan", data-tip) --
         ohne die Kachel aus core stuende das Attribut da und niemand saehe es. */
      if (UC.makeTooltips) UC.makeTooltips(root, isDark);

      /* ---- Zeichnen ---------------------------------------------------------------------------
         Jeder sichtbare Satz geht beim Zeichnen durch UC.t -- der Sprachlauf von core laesst
         Tabellenzellen aus (team-orga, 25.09.), und ein Satz, der erst beim Einfuegen uebersetzt
         wird, bliebe nach einem Neuzeichnen englisch. */
      function texte() {
        elTitel.textContent = UC.t("Billing & Subscription");
        elSub.textContent = UC.t("Manage your plan, payment method, invoices, and cancellation " +
          "settings securely through our billing portal.");
        elManageLbl.textContent = UC.t("Manage Billing");
        elManageErr.querySelector(".up-formerr-in").textContent =
          UC.t("The billing portal could not be opened. Please reload the page.");
      }
      /* Die Tarif-Id des Abos -- NUR aus dem ersten Run-JS-Schritt (billing_plan_id). Bis zum 28.09.
         gab es daneben data-plan-id am Element; so bestellt, dass sie nicht mehr uebers Element
         kommt, damit das Element ohne Ausdruck fuer den Tarif auskommt. */
      function aktuelleId() {
        return (state.abo && state.abo.planId) || "";
      }
      /* Die Id, die im Fenster "Current plan" traegt und als current_plan_id hinausgeht: dieselbe,
         aber nur solange das Team Zugang hat (has_active_access). Ein beendetes Abo hat keinen
         laufenden Tarif -- seine Karte bekommt wieder "Get started". */
      function markierteId() {
        return state.abo && state.abo.aktiv === false ? "" : aktuelleId();
      }
      /* Der Name: aus dem Abo, sonst aus der Tarifliste, falls sie schon da ist. */
      function planName() {
        if (state.abo && state.abo.planName) return state.abo.planName;
        var id = aktuelleId().toLowerCase();
        for (var i = 0; id && state.plans && i < state.plans.length; i++) {
          var p = state.plans[i];
          if (txt(p.id != null ? p.id : p.plan_id).toLowerCase() === id) return txt(p.name);
        }
        return "";
      }
      function kopf() {
        return '<div class="up-thead"><div class="up-th ubl-th">' +
          esc(UC.t("Current Subscription")) + '</div></div>';
      }
      function zeile(k, lbl, wert, skel) {
        return '<div class="up-row ubl-row' + (skel ? " up-tsk" : "") + '" data-ubl-zeile="' + k + '">' +
          '<div class="up-td ubl-key">' + esc(UC.t(lbl)) + '</div>' +
          '<div class="up-td ubl-val">' + wert + '</div>' +
        '</div>';
      }
      /* Ein Wert als EIN Kasten: die Zelle aus core ist ein Flex-Behaelter mit 10px Luecke, und
         "€2,220 / year" wurde darin zu zwei Kindern mit Luecke UND Leerzeichen dazwischen. */
      function kasten(html) { return '<span class="ubl-wert">' + html + '</span>'; }
      /* Das Datum im Format des Nutzers. Laesst es sich nicht lesen, steht der Wert selbst da --
         ein "–" an einer Stelle, an der etwas geliefert wurde, sieht aus wie "nichts da". */
      /* Wie viele KALENDERTAGE liegen zwischen heute und v -- in der Zeitzone des Nutzers, nicht in
         Stunden: eine Testphase, die heute um 8 Uhr endete, endet "heute", auch wenn es 20 Uhr ist.
         Math.round faengt die Tage mit 23 oder 25 Stunden der Zeitumstellung ab. null: unlesbar. */
      function tageBis(v) {
        var d = new Date(v);
        if (isNaN(d.getTime())) return null;
        var h = new Date();
        var heute = new Date(h.getFullYear(), h.getMonth(), h.getDate());
        var tag = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return Math.round((tag - heute) / 86400000);
      }
      /* Das Ende der Testphase (28.09. angefordert): liegt es VOR heute, gibt es die Zeile nicht --
         eine abgelaufene Testphase ist keine Angabe mehr, sondern Vergangenheit. Heute und morgen
         stehen als Wort ("Today", "Tomorrow"), alles danach als Datum im Format des Nutzers.
         Unlesbar: der Wert selbst, wie bei jedem anderen Datum hier (datumHtml). */
      function testphaseHtml(v) {
        var n = tageBis(v);
        if (n == null) return datumHtml(v);
        if (n < 0) return null;
        if (n === 0) return esc(UC.t("Today"));
        if (n === 1) return esc(UC.t("Tomorrow"));
        return datumHtml(v);
      }
      function datumHtml(v) {
        if (!v) return "–";
        var f = UC.fmtDate(v);
        return esc(f === "–" ? v : f);
      }
      function taktText(a) {
        if (a.interval === "monthly") return UC.t("Monthly");
        if (a.interval === "yearly") return UC.t("Yearly");
        return a.intervalRoh || "–";
      }
      function preisHtml(a) {
        if (a.preis == null) return "–";
        return esc(UC.fmtEur(a.preis)) + (a.interval
          ? ' <span class="ubl-per">' + esc(UC.t(a.interval === "yearly" ? "/ year" : "/ month")) + '</span>'
          : "");
      }
      /* Die vier Zeilen, die immer da sind, sobald es einen Tarif gibt. Das Skelett zeigt genau
         diese vier mit ihren echten Bezeichnungen -- die stehen fest, nur die Werte kommen vom
         Server (dieselbe Regel wie in settings-brand: nur verdecken, was geladen wird). */
      var BASIS = [
        { k: "plan", lbl: "Current plan", w: 104 },
        { k: "interval", lbl: "Billing interval", w: 64 },
        { k: "price", lbl: "Billing per interval", w: 92 },
        { k: "next", lbl: "Next billing date", w: 96 }
      ];
      function tabelleHtml() {
        /* Der Fehler VOR dem Skelett: endloses Laden saehe aus wie "gleich da". */
        if (state.aboFehler) return kopf() + UC.leseFehlerHtml("your subscription");
        if (!state.aboDa) {
          return kopf() + BASIS.map(function (z) {
            return zeile(z.k, z.lbl, '<span class="up-tsk-bar" style="width:' + z.w + 'px"></span>', true);
          }).join("");
        }
        var a = state.abo;
        var name = planName();
        var mitPlan = !!(a && (a.planId || a.planName)) || !!name;
        var html = kopf();
        html += zeile("plan", "Current plan",
          (mitPlan
            /* Die Pille aus core, wie in der Teams-Tabelle (28.09. angefordert: "die kleinen
               Shapes vor dem aktuellen Tarif"). Gedaempft mit Hinweis, solange das Team keinen
               Zugang hat (has_active_access false) -- dieselbe Aussage wie dort "No active
               billing plan". */
            ? UC.planPilleHtml(name || "–", !(a && a.aktiv === false), { klasse: "ubl-planpill" })
            : '<span class="ubl-plan is-none">' + esc(UC.t("No active plan")) + '</span>') +
          '<button class="up-btn-sec up-rowbtn ubl-plansbtn" type="button" data-ubl-plans' +
            ' aria-haspopup="dialog">' + esc(UC.t("See all plans")) + '</button>');
        if (mitPlan && a) {
          html += zeile("interval", "Billing interval", kasten(esc(taktText(a))));
          html += zeile("price", "Billing per interval", kasten(preisHtml(a)));
          html += zeile("next", "Next billing date", kasten(datumHtml(a.naechste)));
        }
        /* Die drei letzten NUR mit Wert (so bestellt): eine Zeile "Canceled at: –" bei einem
           laufenden Abo liest sich wie eine Warnung. */
        if (a && a.gekuendigt) html += zeile("canceled", "Canceled at", kasten(datumHtml(a.gekuendigt)));
        if (a && a.zugangBis) html += zeile("access", "Access ends at", kasten(datumHtml(a.zugangBis)));
        var testBis = a && a.testBis ? testphaseHtml(a.testBis) : null;
        if (testBis) html += zeile("trial", "Trial ends at", kasten(testBis));
        return html;
      }
      function render() {
        texte();
        /* can_manage_billing: false -- der Knopf fuehrte in ein Portal, das die RPC diesem Nutzer
           verweigert. Ausgeblendet erst auf ein ausdrueckliches Nein; solange nichts gesagt ist,
           steht er da (settings-billing.css, [hidden]). */
        elManage.hidden = state.verwalten === false;
        elTable.innerHTML = tabelleHtml();
      }

      /* ---- Manage Billing ---------------------------------------------------------------------- */
      /* team_id VORN: zuerst die aus der Nutzlast (das Team, dem das Abo hier gehoert), sonst
         data-team DIESES Elements, nicht das erste [data-team] der Seite. Ohne beides haengt core
         die Team-Id der Seite an (makeFire). */
      function mitTeam(o) {
        var tid = state.aboTeam || feld(root.getAttribute("data-team"));
        if (!tid) return o;
        var out = { team_id: tid };
        for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k];
        return out;
      }
      function manageFehler(an) { elManageErr.classList.toggle("is-on", !!an); }
      var sperrUhr = null;
      function manage() {
        if (sperrUhr) return;
        /* makeFire sagt, ob ein Empfaenger da war. Fehlt das JavaScript-to-Bubble-Element, taete
           der Knopf sonst schlicht nichts -- der stille Ausfall. Dann steht es darunter, mit dem,
           was der Nutzer tun kann. */
        var ok = fire("data-manage-fn", "ublManage", mitTeam({}));
        manageFehler(!ok);
        if (!ok) return;
        elManage.disabled = true;
        elManage.setAttribute("aria-busy", "true");
        sperrUhr = setTimeout(function () {
          sperrUhr = null;
          elManage.disabled = false;
          elManage.removeAttribute("aria-busy");
        }, KLICK_SPERRE_MS);
      }

      /* ---- Warte-Uhr fuer das Abo -------------------------------------------------------------
         Endet sie ohne Nutzlast, steht der Lesefehler da statt eines ewigen Skeletts ("gar nicht"
         ist einer der fuenf Wege, CLAUDE.md 2). warteBis geht in den Vorrat: eine neu gebaute
         Wurzel laesst ihre Uhr nur den REST laufen, sonst verlaengerte jeder Themenwechsel das
         Skelett um volle 25s. */
      var warteUhr = null, warteBis = 0;
      function warteBeenden() {
        if (warteUhr) { clearTimeout(warteUhr); warteUhr = null; }
        warteBis = 0;
      }
      function warteStarten(ms) {
        warteBeenden();
        var dauer = ms > 0 ? ms : WARTE_MS;
        warteBis = Date.now() + dauer;
        warteUhr = setTimeout(function () {
          warteUhr = null;
          /* Eine abgehaengte Wurzel wartet fuer niemanden mehr -- ihre Nachfolgerin fuehrt die Uhr. */
          if (root.isConnected === false) return;
          if (state.aboDa || state.aboFehler) { warteBis = 0; return; }
          /* Geparkt heisst: niemand sieht hin, der Workflow der Seite lief vielleicht noch gar
             nicht. Dann weiter warten statt einen Fehler zu setzen, der beim Oeffnen schon dasteht
             (domain-detail, dieselbe Ueberlegung). messbar kostet keinen Layoutzugriff. */
          if (UC.messbar && !UC.messbar(root)) { warteStarten(); persist(); return; }
          warteBis = 0;
          state.aboFehler = true;
          persist();
          render();
        }, dauer);
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
          planeZeichnen();
        }, PLAN_WARTE_MS);
      }

      /* ---- Vorrat -------------------------------------------------------------------------------
         Nur eine Wurzel, die noch im Dokument steht, schreibt: die alte lebt nach dem Neuaufbau
         als abgehaengter Knoten weiter, samt Uhren, und wuerde den Stand der neuen sonst mit ihrem
         alten ueberschreiben (team-orga, domain-detail). */
      function persist() {
        if (!root.isConnected) return;
        STORE[instanceId] = {
          teamId: state.teamId, aboTeam: state.aboTeam, verwalten: state.verwalten,
          abo: state.abo, aboDa: state.aboDa, aboFehler: state.aboFehler,
          plans: state.plans, plansFehler: state.plansFehler,
          iv: state.iv, ivGewaehlt: state.ivGewaehlt,
          warteBis: warteBis
        };
      }

      /* ══ Das Fenster mit allen Tarifen ═══════════════════════════════════════════════════════
         Die Schale ist core's Modal, wie der Einladen-Dialog in team-orga: up-root, damit die
         Marken aus core dort gelten und der Themen-Durchlauf von core es findet; up-portal, weil
         es ausserhalb jeder Komponentenwurzel am body haengt -- setUpstreemTheme() stempelt genau
         diese beiden. Am body und nicht im Element, damit kein overflow eines Bubble-Vorfahren es
         abschneidet und kein z-index eines fremden Vorfahren angefasst werden muss. */
      function dialog() {
        var D = DLG[instanceId];
        if (D && D.back.isConnected) return D;
        var back = document.createElement("div");
        back.className = "up-root up-portal up-topicmodal-backdrop ubl-backdrop";
        back.setAttribute("aria-hidden", "true");
        back.setAttribute("data-ubl-dialog", instanceId);
        var tid = "ubl-dlg-" + (++DLG_SEQ);
        back.innerHTML =
          '<div class="up-topicmodal-card ubl-card" role="dialog" aria-modal="true"' +
            ' aria-labelledby="' + tid + '" tabindex="-1">' +
            '<div class="up-topicmodal-head">' +
              '<div class="up-topicmodal-heading">' +
                '<h2 class="up-topicmodal-title" id="' + tid + '" data-ubl-dtitel></h2>' +
                '<p class="up-topicmodal-sub" data-ubl-dsub></p>' +
              '</div>' +
              '<button type="button" class="up-popup-close" data-ubl-close>' + UC.icon("x", 2) + '</button>' +
            '</div>' +
            '<div class="ubl-planbody" data-ubl-planbody></div>' +
            '<div class="up-formerr ubl-selerr" data-ubl-selerr role="alert"><div><div class="up-formerr-in"></div></div></div>' +
          '</div>';
        document.body.appendChild(back);
        D = {
          back: back,
          card: back.querySelector(".ubl-card"),
          body: back.querySelector("[data-ubl-planbody]"),
          err: back.querySelector("[data-ubl-selerr]"),
          offen: false, ctrl: null, opener: null, kit: null, taste: null, unten: false
        };
        /* Schliessen auf dem Grund nur, wenn der Druck AUCH dort begann: wer in einer Karte Text
           markiert und die Maus draussen loslaesst, bekommt einen click auf dem Grund -- und das
           Fenster waere weg. */
        back.addEventListener("pointerdown", function (e) { D.unten = e.target === back; });
        back.addEventListener("click", function (e) {
          if (e.target === back) {
            var war = D.unten;
            D.unten = false;
            if (war && D.ctrl) D.ctrl.planeSchliessen();
            return;
          }
          if (e.target.closest && e.target.closest("[data-ubl-close]") && D.ctrl) D.ctrl.planeSchliessen();
        });
        DLG[instanceId] = D;
        return D;
      }
      function aktuellesIv() {
        if (state.ivGewaehlt && state.iv) return state.iv;
        /* Der Takt des Abos, sonst Jahr -- die Vorbelegung der Landingpage: der guenstigere Preis
           soll zuerst dastehen. */
        return (state.abo && state.abo.interval) || state.iv || "yearly";
      }
      function selFehler(an) {
        var D = DLG[instanceId];
        if (!D) return;
        D.err.querySelector(".up-formerr-in").textContent =
          UC.t("This plan could not be selected right now. Please reload the page.");
        D.err.classList.toggle("is-on", !!an);
      }
      /* Der Inhalt des Fensters. Reihenfolge wie ueberall im Haus: der Fehler vor dem Skelett --
         nur eine laufende Anfrage geht vor, sie raeumt die Meldung weg, bis ihre Antwort da ist. */
      function planeZeichnen() {
        var D = DLG[instanceId];
        if (!D || !D.offen || D.ctrl !== ctrl) return;
        if (state.plansFehler && !state.plansWarten) {
          D.kit = null;
          D.body.innerHTML = UC.leseFehlerHtml("the plans");
          return;
        }
        if (state.plans && !state.plans.length) {
          D.kit = null;
          D.body.innerHTML = UC.leerHtml({ titel: "No plans available right now.", icon: "creditCard" });
          return;
        }
        /* Karten oder Skelett: beides ist die Reihe aus core, ohne Tarife zeichnet sie Huellen. */
        if (!D.kit || !D.body.contains(D.kit.el)) {
          D.kit = UC.makePlans(D.body, {
            plans: state.plans,
            interval: aktuellesIv(),
            currentId: markierteId(),
            cta: "Get started",
            fuss: "Prices exclude VAT. Cancel any time.",
            onInterval: function (iv) { state.iv = iv; state.ivGewaehlt = true; persist(); },
            onSelect: waehlen
          });
          return;
        }
        D.kit.setCurrent(markierteId());
        D.kit.setInterval(aktuellesIv());
        D.kit.setPlans(state.plans);
      }
      function dialogTexte(D) {
        D.back.querySelector("[data-ubl-dtitel]").textContent = UC.t("All plans");
        D.back.querySelector("[data-ubl-dsub]").textContent = UC.t("Pick the plan that fits your team.");
        D.back.querySelector("[data-ubl-close]").setAttribute("aria-label", UC.t("Close"));
      }
      /* Tab bleibt im Fenster (aria-modal verspricht das). Ohne die Falle landet der Fokus nach dem
         letzten Knopf hinter dem Grund auf der Seite, die man nicht sieht. */
      function fokusFalle(e, card) {
        var f = [].filter.call(card.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
          function (x) { return !x.disabled && x.getClientRects().length > 0; });
        if (!f.length) { e.preventDefault(); card.focus(); return; }
        var erst = f[0], letzt = f[f.length - 1], a = document.activeElement;
        if (e.shiftKey && (a === erst || a === card || !card.contains(a))) { e.preventDefault(); letzt.focus(); }
        else if (!e.shiftKey && (a === letzt || !card.contains(a))) { e.preventDefault(); erst.focus(); }
      }
      function aufTaste(e) {
        var D = DLG[instanceId];
        if (!D || !D.offen) return;
        /* Escape nur fuer DIESES Fenster und nicht weiter: sonst schloesse dieselbe Taste auch ein
           Menue oder einen Drawer darunter (core's Topic-Modal, dieselbe Ueberlegung). */
        if (e.key === "Escape" || e.key === "Esc") { e.stopPropagation(); e.preventDefault(); planeSchliessen(); return; }
        if (e.key === "Tab") fokusFalle(e, D.card);
      }
      function planeOeffnen(opener) {
        var D = dialog();
        D.ctrl = ctrl;
        D.opener = opener || document.activeElement;
        if (isDark()) D.back.setAttribute("data-theme", "dark"); else D.back.removeAttribute("data-theme");
        dialogTexte(D);
        selFehler(false);
        /* Ein neuer Ladeversuch: der alte Fehler geht weg, die Uhr laeuft. Liegen Tarife im
           Vorrat, stehen sie sofort da und werden ersetzt, sobald die Antwort kommt. */
        state.plansFehler = false;
        state.plansWarten = true;
        planUhrStarten();
        D.offen = true;
        /* Die Reihe wird bei jedem Oeffnen neu gebaut: ihre Rueckrufe gehoeren zum Controller, der
           sie gebaut hat, und nach einem Neuaufbau ist das ein toter. Ein Bau kostet eine Handvoll
           Knoten -- gegen einen Klick, der den Zustand einer abgehaengten Wurzel veraendert. */
        D.kit = null;
        planeZeichnen();
        D.back.setAttribute("aria-hidden", "false");
        /* Einmal Layout erzwingen, sonst laeuft der Uebergang von opacity 0 nicht (core's
           Topic-Modal, derselbe Kniff). */
        void D.back.offsetWidth;
        D.back.classList.add("is-shown");
        D.taste = aufTaste;
        document.addEventListener("keydown", D.taste, true);
        setTimeout(function () { try { if (D.offen) D.card.focus(); } catch (e) {} }, 40);
        persist();
        /* ZULETZT feuern: antwortet der Workflow im selben Zug (ein statischer Schritt), findet
           seine Antwort den Wartezustand schon gesetzt und beendet ihn -- andersherum setzte das
           Oeffnen ihn danach wieder auf "wartet". */
        fire("data-plans-fn", "ublPlans", mitTeam({ current_plan_id: markierteId() }));
      }
      function planeSchliessen() {
        var D = DLG[instanceId];
        if (!D || !D.offen) return;
        /* Fokus weg, BEVOR aria-hidden kommt -- ein fokussiertes Element unter aria-hidden weist
           Chrome mit einer Konsolenmeldung zurueck (core's Topic-Modal). */
        if (D.back.contains(document.activeElement)) { try { document.activeElement.blur(); } catch (e) {} }
        D.offen = false;
        D.back.classList.remove("is-shown");
        D.back.setAttribute("aria-hidden", "true");
        if (D.taste) document.removeEventListener("keydown", D.taste, true);
        D.taste = null;
        planUhrStoppen();
        state.plansWarten = false;
        var op = D.opener;
        D.opener = null;
        try { if (op && op.isConnected && op.focus) op.focus(); } catch (e) {}
      }
      function waehlen(info) {
        /* Zu geht das Fenster erst, wenn der Klick einen Empfaenger hatte. Ohne Empfaenger bliebe
           sonst ein geschlossenes Fenster und keine Wirkung -- dann steht der Satz im Fenster. */
        var ok = fire("data-select-plan-fn", "ublSelectPlan", mitTeam(info));
        if (!ok) { selFehler(true); return; }
        /* Und dann sofort zu: der Workflow fuehrt zur Kasse oder zeigt eine eigene Bestaetigung,
           und ein Bubble-Popup laege UNTER diesem Fenster (z-index 100000). */
        planeSchliessen();
      }

      /* ---- Klicks ------------------------------------------------------------------------------ */
      root.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var b = t.closest("button");
        if (b && b.disabled) return;
        if (t.closest("[data-ubl-manage]")) { manage(); return; }
        var pb = t.closest("[data-ubl-plans]");
        if (pb) { planeOeffnen(pb); return; }
      });

      /* ---- Setter ------------------------------------------------------------------------------ */
      function aboSetzen(p) {
        var r = aboLesen(p);
        warteBeenden();
        if (r.ok) {
          state.abo = r.abo;
          state.aboDa = true;
          state.aboFehler = false;
          if (r.teamId) state.aboTeam = r.teamId;
          state.verwalten = r.verwalten === false ? false : null;
        } else {
          /* Unlesbar ist nicht leer (CLAUDE.md 2): die Tabelle sagt es, statt still das alte Abo
             stehen zu lassen. */
          state.aboFehler = true;
          if (window.console) console.warn("[settings-billing] " + instanceId +
            ": setBillingSubscription konnte die Nutzlast nicht lesen.");
        }
        persist();
        render();
        /* Steht das Fenster offen, bekommt es den Tarif von JETZT -- ein Wechsel kann gerade
           durchgelaufen sein. Den Takt nur, wenn der Nutzer ihn nicht selbst gewaehlt hat. */
        var D = DLG[instanceId];
        if (D && D.offen && D.ctrl === ctrl && D.kit) {
          D.kit.setCurrent(markierteId());
          if (!state.ivGewaehlt) D.kit.setInterval(aktuellesIv());
        }
      }
      function plaeneSetzen(p) {
        var r = plaeneLesen(p);
        planUhrStoppen();
        state.plansWarten = false;
        if (r.ok) {
          state.plans = r.liste;
          state.plansFehler = false;
        } else {
          state.plansFehler = true;
          if (window.console) console.warn("[settings-billing] " + instanceId +
            ": setBillingPlans konnte die Nutzlast nicht lesen.");
        }
        persist();
        planeZeichnen();
        /* Die Tabelle nimmt den Namen notfalls aus der Tarifliste (planName). */
        render();
      }

      var ctrl = {
        abo: aboSetzen,
        plaene: plaeneSetzen,
        planeSchliessen: planeSchliessen,
        reset: function () {
          planeSchliessen();
          warteBeenden();
          planUhrStoppen();
          if (sperrUhr) { clearTimeout(sperrUhr); sperrUhr = null; }
          elManage.disabled = false;
          elManage.removeAttribute("aria-busy");
          manageFehler(false);
          state.abo = null; state.aboDa = false; state.aboFehler = false;
          state.aboTeam = ""; state.verwalten = null;
          state.plans = null; state.plansFehler = false; state.plansWarten = false;
          state.iv = ""; state.ivGewaehlt = false;
          /* Geloescht und nicht mit dem leeren Stand ueberschrieben: der zurueckgesetzte Stand IST
             der Anfangsstand, und ein ausdrueckliches Reset darf ein Neuaufbau nicht
             rueckgaengig machen (team-orga). */
          delete STORE[instanceId];
          /* Das Skelett ist zurueck -- also braucht es wieder sein benanntes Ende. */
          warteStarten();
          render();
        },
        /* Zahlen-, Datums- oder Sprachwahl geaendert (makeMount ruft das bei up-prefs-change). */
        redraw: function () {
          render();
          var D = DLG[instanceId];
          if (D && D.offen && D.ctrl === ctrl) { dialogTexte(D); selFehler(D.err.classList.contains("is-on")); if (D.kit) D.kit.redraw(); }
        }
      };
      root.__ublController = ctrl;

      /* Aendert Bubble data-team AN ORT UND STELLE (ohne Neuaufbau), gilt ab sofort der neue Wert.
         Ein anderes Team heisst: das Abo hier ist das falsche -- zurueck ins Skelett, bis das neue
         kommt. (data-plan-id stand hier bis zum 28.09. mit; die Tarif-Id kommt jetzt nur noch aus
         dem Run-JS-Schritt.) */
      if (window.MutationObserver) {
        new MutationObserver(function () {
          var t = feld(root.getAttribute("data-team"));
          if (t && state.teamId && t !== state.teamId) { state.teamId = t; ctrl.reset(); persist(); return; }
          if (t) state.teamId = t;
          render();
          var D = DLG[instanceId];
          if (D && D.offen && D.ctrl === ctrl && D.kit) D.kit.setCurrent(markierteId());
          persist();
        }).observe(root, { attributes: true, attributeFilter: ["data-team"] });
      }

      /* Ein Fenster, das die VORIGE Wurzel dieser Instanz offen liess, geht zu -- es redet mit
         einem Controller, den es nicht mehr gibt (so bestellt: nach dem Neuaufbau ist es zu). */
      var altD = DLG[instanceId];
      if (altD && altD.offen && altD.ctrl && altD.ctrl !== ctrl) altD.ctrl.planeSchliessen();

      /* Die Warte-Uhr: beim ersten Aufbau voll, bei einem Neuaufbau mitten im Warten nur der Rest.
         Ist der Rest schon um, endet es sofort -- genau wie es die alte Uhr getan haette. Mit Daten
         oder Fehler wartet hier niemand. */
      if (!state.aboDa && !state.aboFehler) warteStarten(saved.warteBis ? Math.max(1, restWarte) : 0);
      render();
      persist();
      if (spaet) spaet.drain(instanceId, ctrl);
    }

    /* Ohne Kennung ("default") trifft ein Aufruf jede Wurzel -- eine Seite hat genau eine
       Abrechnung. Genauer Name schlaegt Praefix (team-orga, 02.09. gemessen). Wurzeln, die noch
       nicht eingerichtet sind, werden es hier: wer Daten bekommt, wird gebaut. Gibt es noch gar
       keine, wartet der Aufruf (makeLate) und laeuft, sobald das Element erscheint. */
    function each(id, fn) {
      var roots = Array.prototype.slice.call(document.querySelectorAll(".ubl-root"));
      var genau = id !== "default" && roots.some(function (r) {
        return String(r.getAttribute("data-instance") || "default") === id; });
      roots = roots.filter(function (r) {
        var rid = String(r.getAttribute("data-instance") || "default");
        return id === "default" ? true : (genau ? rid === id : rid.indexOf(id) === 0);
      });
      roots.forEach(function (r) {
        if (r.__ublController) return;
        try { initRoot(r); }
        catch (e) { if (window.console) console.error("[settings-billing] initRoot ist gescheitert:", e); }
      });
      var mit = roots.filter(function (r) { return !!r.__ublController; });
      if (!mit.length && spaet) { spaet.park(id, fn); return; }
      mit.forEach(function (r) { fn(r.__ublController); });
    }
    /* (TEXT) oder (INSTANZ, TEXT). Unterschieden am ZWEITEN Argument und nicht an der Zahl der
       Argumente: der Weiterreicher von makeMount ueber Rahmengrenzen ruft immer mit drei. */
    function zwei(a, b, fn) {
      var mitId = b !== undefined;
      each(mitId ? (txt(a) || "default") : "default", function (c) { fn(c, mitId ? b : a); });
    }

    mount = UC.makeMount({
      onMount: function (m) { mount = m; },
      rootClass: "ubl-root", notPortal: true,
      ctrlProp: "__ublController",
      resolveLocal: "__ublResolveLocal",
      queue: "__ublBootQueue",
      initRoot: initRoot,
      redraw: function (c) { if (c && c.redraw) c.redraw(); },
      api: {
        setBillingSubscription: function (a, b) { zwei(a, b, function (c, p) { c.abo(p); }); },
        setBillingPlans: function (a, b) { zwei(a, b, function (c, p) { c.plaene(p); }); },
        resetBilling: function (id) { each(txt(id) || "default", function (c) { c.reset(); }); }
      },
      forwardShape: { resetBilling: "id" }
    });
  }

  ublBoot(50);
})();
