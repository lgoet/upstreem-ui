/* upstreem team-orga.js — Team-Verwaltung im Settings-Bereich (Praefix uto). Braucht core.js.

   ── Was die Komponente ist ──────────────────────────────────────────────────
   Drei Abschnitte auf einer Settings-Seite:

     Team Members     wer im Team ist, mit Rolle und einem Zeilenmenue je Person
     Pending Invites  offene Einladungen, mit Zuruecknehmen
     Activity Log     das Protokoll, aufklappbar und ausdruecklich TECHNISCH gehalten

   ── Was sie NICHT ist ───────────────────────────────────────────────────────
   Sie entscheidet nichts. Wer wen einladen, entfernen oder befoerdern darf, entscheidet der RPC;
   diese Datei zeigt nur die Aktionen, die dort erlaubt sind, und schickt das Ereignis. Die Regeln
   unten (darfEntfernen / darfRolle) sind also KEINE Rechteprüfung, sondern die Sichtbarkeit im
   Menue -- die Pruefung steht im Server, und das gehoert so: ein Klick, den die Seite verbietet,
   ist bequem; ein Klick, den nur die Seite verbietet, ist ein Loch.

   ── Woher die Masse kommen ──────────────────────────────────────────────────
   Nichts davon ist neu gebaut. Die Abschnitte sind die von settings-brand (derselbe Bereich), die
   Tabellen die von brand-editor (.ube-table + core's .up-row/.up-thead mit --up-cols), der Dialog
   ist core's Modalschale mit den Innenmassen von add-brand, das Zeilenmenue ist .up-iconbtn +
   UC.makePopover + .up-optrow. Siehe den Kopf von team-orga.css, dort steht die Liste mit Zahlen.

   ── Daten hinein (drei Run-JS-Schritte, siehe bubble/team_orga_bubble.html) ──
     renderTeamOrga({ instanceId, members, permissions, viewer_role, pending_invites })
     setTeamOrgaInvites(INSTANCE_ID, { count, invites })      die offenen Einladungen
     setTeamOrgaLog(INSTANCE_ID, [ ... ])                     das Protokoll
     setTeamOrgaLoading(INSTANCE_ID, "yes")                   Skelett, waehrend der RPC laeuft
     resetTeamOrga(INSTANCE_ID)                               zurueck aufs Skelett, bis neu geliefert wird

   Die drei Nutzlasten kommen getrennt, weil sie im Backend aus drei Abfragen kommen -- und seit
   dem 25.09. auch aus drei eigenen Run-JS-Schritten, in beliebiger Reihenfolge. Jeder Abschnitt
   wartet auf SEINE Nutzlast und zeigt bis dahin sein Skelett; keiner behauptet "leer", nur weil
   ein anderer Schritt zuerst kam. Das gilt auch fuers Protokoll: ohne seinen Schritt bleibt es im
   Ladezustand. Frueher stand dort dann "No entries yet" -- bei einem Team mit dreizehn Eintraegen.
   Leer ("", [], "invites": ,) zeigt den Leerzustand, unlesbar einen Lesefehler im Abschnitt.

   ── Ereignisse heraus (jedes mit einem JSON-Text als erstem Parameter) ──────
     utoInvite   { team_id, email, role }              Einladen im Dialog bestaetigt
     utoResend   { team_id, invite_id, email, role }   "Resend" an einer offenen Einladung
     utoRevoke   { team_id, invite_id, email }         "Revoke" an einer offenen Einladung
     utoRemove   { team_id, user_id, email, self }     "Remove from team" (self immer false, s. u.)
     utoRole     { team_id, user_id, email, role }     "Set Member" / "Set Admin" / "Set Owner"

   Nach JEDEM dieser fuenf muss der Workflow die Daten neu holen und die Schritte erneut laufen lassen --
   diese Datei aendert ihren Zustand NICHT von sich aus. Der Grund ist derselbe wie ueberall in
   dieser App: die Wahrheit steht im Server, und eine Zeile, die sich schon geaendert hat, waehrend
   der RPC noch laeuft, luegt bei jedem Fehlschlag. */
(function () {
  "use strict";

  var API_NAMES = ["renderTeamOrga", "setTeamOrgaInvites", "setTeamOrgaLog",
                   "setTeamOrgaLoading", "resetTeamOrga"];
  var Q = (window.__utoBootQueue = window.__utoBootQueue || []);
  if (!window.__utoBootStubbed) {
    window.__utoBootStubbed = true;
    API_NAMES.forEach(function (n) {
      if (typeof window[n] !== "function") window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
    });
  }

  function utoBoot(n) {
    if (!window.UpstreemCore) {
      if (n > 0) { setTimeout(function () { utoBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[team-orga] UpstreemCore (core.js) not loaded");
      return;
    }
    utoRun();
  }

  function utoRun() {
    var UC = window.UpstreemCore;
    var esc = UC.esc, fmtDate = UC.fmtDate;

    var MISSING = ["makeMount", "makeFire", "makePopover", "makeTooltips", "widthTiers",
                   "skeletonRows", "leseFehlerHtml", "readBubble", "icon", "esc", "fmtDate"]
      .filter(function (k) { return typeof UC[k] !== "function"; });
    if (MISSING.length && window.console) {
      console.error("[team-orga] Die core.js auf dieser Seite ist AELTER als team-orga.js, es " +
        "fehlen: " + MISSING.join(", ") + ". Alle Elemente der Seite auf denselben Commit pinnen.");
    }

    /* Die drei Rollen. Ein unbekannter Wert aus dem Server wird zu "member" -- die niedrigste
       Rolle ist die vorsichtige Antwort: sie zeigt keine Aktion, die es vielleicht nicht gibt. */
    var ROLLEN = { member: 1, admin: 1, owner: 1 };
    function rolleName(r) {
      var k = String(r == null ? "" : r).trim().toLowerCase();
      return ROLLEN[k] ? k : "member";
    }

    /* Die drei Ereignisarten des Protokolls. Der Punkt davor macht es ueberfliegbar; alles, was
       hier nicht steht, bekommt den neutralen Punkt und seinen Rohnamen -- ein neues Ereignis im
       Backend fuehrt also nie zu einer leeren Zelle. */
    var EV_TON = { member_invited: "is-new", invite_accepted: "is-ok", invite_revoked: "is-off",
                   member_removed: "is-off", role_changed: "is-new" };

    function txt(v) { return String(v == null ? "" : v).trim(); }
    /* Bubble-Platzhalter sind kein Wert. Sie stehen als GROSSBUCHSTABEN im Markup, solange
       niemand den dynamischen Ausdruck eingesetzt hat, und wuerden sonst als Text erscheinen. */
    function feld(v) { var s = txt(v); return (!s || /^[A-Z_]{3,}$/.test(s)) ? "" : s; }
    function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
    function isYes(v) { var s = String(v == null ? "" : v).trim().toLowerCase();
      return s === "yes" || s === "true" || s === "1"; }

    /* Zeitpunkt im Protokoll: ISO-Datum und 24-Stunden-Uhr, also 2026-08-31 15:42.
       Bewusst NICHT UC.fmtDate ("31. Aug 2026") wie in den Tabellen darueber: ein Protokoll wird
       nach Zeit gelesen und verglichen, und dafuer ist die sortierbare Schreibweise die richtige.
       Genau das war mit "technischer" gemeint. Ortszeit, weil der Leser in seiner Zeit denkt. */
    function zeitpunkt(v) {
      var s = txt(v);
      if (!s) return "–";
      var d = new Date(s);
      if (isNaN(d.getTime())) return "–";
      function z(n) { return String(n).padStart(2, "0"); }
      return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) +
             " " + z(d.getHours()) + ":" + z(d.getMinutes());
    }
    /* Eine Einladung laeuft ab. Der Server schickt expires_at; abgelaufen heisst nicht
       zurueckgezogen, also ein eigener Zustand und keine Warnfarbe. */
    function abgelaufen(v) {
      var s = txt(v);
      if (!s) return false;
      var d = new Date(s);
      return !isNaN(d.getTime()) && d.getTime() < Date.now();
    }

    var spaet = UC.makeLate ? UC.makeLate("team-orga", ".uto-root") : null;
    var mount;

    /* ══ Der Einladen-Dialog ═══════════════════════════════════════════════════════════════════
       EINER fuer die ganze Seite, nicht einer je Wurzel: es gibt genau eine Teamverwaltung, und
       ein Dialog im <body> darf nicht mit dem Element sterben, das ihn geoeffnet hat. Genauso
       macht es add-brand.
       Die Schale ist core's Modal (.up-topicmodal-backdrop / -card), die Innenmasse sind die von
       add-brand -- siehe team-orga.css. */
    var DLG = null;
    function dialog() {
      if (DLG) return DLG;
      var back = document.createElement("div");
      /* up-root, damit core's Theme-Sweep ihn findet; up-portal, weil er ausserhalb jeder
         Komponentenwurzel im <body> lebt -- setUpstreemTheme() sucht genau diese beiden. */
      back.className = "up-root up-portal up-topicmodal-backdrop uto-backdrop";
      back.setAttribute("role", "dialog");
      back.setAttribute("aria-modal", "true");
      back.setAttribute("aria-label", "Invite new members");
      back.innerHTML =
        '<div class="up-topicmodal-card uto-card">' +
          '<div class="uto-head">' +
            '<div class="uto-heading">' +
              '<div class="uto-title">Invite new Members</div>' +
              '<div class="uto-sub">They get an email with a link to join this team</div>' +
            '</div>' +
            '<button type="button" class="up-popup-close" data-uto-close aria-label="Close">' +
              UC.icon("x", 2) + '</button>' +
          '</div>' +
          '<div class="uto-dlgbody">' +
            '<div class="uto-field" data-uto-field>' +
              '<label class="uto-label" for="uto-mail">Email</label>' +
              '<input class="uto-in" id="uto-mail" type="email" autocomplete="off"' +
                ' spellcheck="false" placeholder="name@company.com" data-uto-mail>' +
              '<div class="uto-err" data-uto-err></div>' +
            '</div>' +
            '<div class="uto-field">' +
              '<div>' +
                '<div class="uto-label">Role</div>' +
                '<div class="uto-hint">Admins can invite and manage members. Members have read ' +
                  'access to the team\'s data.</div>' +
              '</div>' +
              /* .up-seg aus core -- zwei Werte, also ein Umschalter und kein Auswahlfeld. */
              '<span class="up-seg is-lg uto-seg" role="group" aria-label="Role">' +
                '<button class="up-seg-btn is-active" type="button" data-uto-role="member">Member</button>' +
                '<button class="up-seg-btn" type="button" data-uto-role="admin">Admin</button>' +
              '</span>' +
            '</div>' +
          '</div>' +
          '<div class="uto-dlgfoot">' +
            '<div class="uto-formerr" data-uto-formerr></div>' +
            '<button class="up-btn-sec" type="button" data-uto-close>Cancel</button>' +
            '<button class="up-export" type="button" data-uto-send>' +
              UC.icon("userPlus", 2) + '<span>Send invite</span></button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(back);

      var D = {
        back: back,
        card: back.querySelector(".uto-card"),
        feld: back.querySelector("[data-uto-field]"),
        mail: back.querySelector("[data-uto-mail]"),
        err: back.querySelector("[data-uto-err]"),
        formerr: back.querySelector("[data-uto-formerr]"),
        rolle: "member",
        offen: false, sendet: false, opener: null, ctrl: null, uhr: null
      };

      function setErr(s) {
        D.err.textContent = s || "";
        D.feld.classList.toggle("is-err", !!s);
      }
      function setFormErr(s) { D.formerr.textContent = s || ""; }
      function setSendet(v) {
        D.sendet = !!v;
        D.card.classList.toggle("is-saving", D.sendet);
        clearTimeout(D.uhr);
        /* Notbremse. Antwortet der Workflow nicht, bleibt der Dialog sonst fuer immer gesperrt --
           dieselben 8 Sekunden, mit denen der Switch-Knopf in teams.js sich selbst wieder oeffnet. */
        if (D.sendet) D.uhr = setTimeout(function () { setSendet(false); }, 8000);
      }
      /* Ein Punkt und ein Punkt hinter dem @ -- mehr prueft diese Seite nicht. Die richtige
         Pruefung ist der Versand: ob es die Adresse GIBT, weiss nur der Mailserver, und eine
         strengere Regel hier sperrt regelmaessig gueltige Adressen aus. */
      function mailOk(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s); }

      function senden() {
        if (D.sendet) return;
        var wert = txt(D.mail.value);
        setFormErr("");
        if (!wert) { setErr("Please enter an email address."); D.mail.focus(); return; }
        if (!mailOk(wert)) { setErr("That does not look like an email address."); D.mail.focus(); return; }
        setErr("");
        if (!D.ctrl) { setFormErr("This element is not connected yet. Please reload the page."); return; }
        setSendet(true);
        D.ctrl.invite(wert, D.rolle);
        /* Zu geht er SOFORT. Der Workflow laedt danach neu und die neue Einladung steht in der
           Liste -- ein Dialog, der auf die Antwort wartet, haelt den Nutzer fuer nichts fest. */
        schliessen();
      }

      function oeffnen(ctrl, opener) {
        D.ctrl = ctrl;
        D.opener = opener || document.activeElement;
        D.mail.value = "";
        D.rolle = "member";
        rolleZeigen();
        setErr(""); setFormErr(""); setSendet(false);
        D.offen = true;
        back.classList.remove("is-closing");
        back.classList.add("is-shown");
        document.addEventListener("keydown", aufTaste);
        setTimeout(function () { try { D.mail.focus(); } catch (e) {} }, 40);
      }
      function schliessen() {
        if (!D.offen) return;
        D.offen = false;
        setSendet(false);
        document.removeEventListener("keydown", aufTaste);
        back.classList.add("is-closing");
        back.classList.remove("is-shown");
        setTimeout(function () { back.classList.remove("is-closing"); }, 160);
        try { if (D.opener && D.opener.focus) D.opener.focus(); } catch (e) {}
      }
      function aufTaste(e) {
        if (e.key === "Escape" && D.offen && !D.sendet) { e.stopPropagation(); schliessen(); }
        /* Enter im Feld sendet. Ein Dialog mit einem Feld und einem Knopf soll auf der Tastatur
           fertig werden. */
        if (e.key === "Enter" && D.offen && document.activeElement === D.mail) {
          e.preventDefault(); senden();
        }
      }
      function rolleZeigen() {
        Array.prototype.forEach.call(back.querySelectorAll("[data-uto-role]"), function (b) {
          b.classList.toggle("is-active", b.getAttribute("data-uto-role") === D.rolle);
        });
      }

      back.addEventListener("click", function (e) {
        /* Klick auf den Grund schliesst. e.target === back heisst: nicht in die Karte getroffen. */
        if (e.target === back) { if (!D.sendet) schliessen(); return; }
        if (!e.target.closest) return;
        if (e.target.closest("[data-uto-close]")) { if (!D.sendet) schliessen(); return; }
        if (e.target.closest("[data-uto-send]")) { senden(); return; }
        var r = e.target.closest("[data-uto-role]");
        if (r) { D.rolle = rolleName(r.getAttribute("data-uto-role")); rolleZeigen(); return; }
      });
      D.mail.addEventListener("input", function () { if (D.err.textContent) setErr(""); });

      D.oeffnen = oeffnen;
      D.schliessen = schliessen;
      DLG = D;
      return D;
    }

    /* ══ Eine Wurzel ═══════════════════════════════════════════════════════════════════════════ */
    function initRoot(root) {
      if (root.__utoController) return;

      var instanceId = root.getAttribute("data-instance") || "default";
      var state = {
        members: [], invites: [], log: [],
        perm: { can_invite: false, can_manage_roles: false, can_manage_members: false },
        viewerRole: "member", viewerId: "", viewerMail: "",
        logOffen: false,
        busy: true, hatDaten: false,
        /* Kamen die offenen Einladungen schon ueber setTeamOrgaInvites? Dann gewinnt diese Liste
           ueber pending_invites in der Mitglieder-Nutzlast (siehe render1). */
        invitesEigen: false,
        /* Je Abschnitt: ist seine Nutzlast schon da, und war sie lesbar? Seit jeder Abschnitt
           seinen eigenen Run-JS-Schritt hat, kommen sie einzeln und in beliebiger Reihenfolge --
           ein Abschnitt, dessen Schritt noch unterwegs ist, zeigt das Skelett und nicht "No
           pending invites". Leer und noch-nicht-da sind zwei Dinge, unlesbar ist ein drittes. */
        invitesDa: false, logDa: false,
        invitesLeseFehler: false, logLeseFehler: false,
        fehler: null            /* Text fuer das UI, nicht fuer die Konsole */
      };

      var fire = UC.makeFire(root, { label: "team-orga", eventPrefix: "uto" });
      function isDark() {
        return UC.themeParam(root.getAttribute("data-isdark")) || root.getAttribute("data-theme") === "dark";
      }

      root.innerHTML =
        /* Der Lesefehler steht VOR dem Koerper und nicht darin: er ersetzt die ganze Seite, weil
           bei einem unlesbaren Payload keine der drei Abschnitte etwas Wahres zeigen kann. */
        '<div class="uto-loaderr" data-uto-loaderr hidden></div>' +
        '<div class="uto-body" data-uto-body>' +

          '<div class="uto-sec">' +
            '<div class="uto-sechead">' +
              '<div class="uto-sectext">' +
                '<h2 class="uto-sectitle">Team Members</h2>' +
                '<p class="uto-secsub">Manage who has access to this team and what they can do</p>' +
              '</div>' +
              '<button class="up-export uto-secbtn" type="button" data-uto-invite>' +
                UC.icon("userPlus", 2) + '<span>Invite new Members</span></button>' +
            '</div>' +
            '<div class="uto-table uto-members" data-uto-members></div>' +
          '</div>' +

          '<div class="uto-sec">' +
            '<div class="uto-sechead">' +
              '<div class="uto-sectext">' +
                '<h2 class="uto-sectitle">Pending Invites</h2>' +
                '<p class="uto-secsub">Invitations that have been sent but not accepted yet</p>' +
              '</div>' +
            '</div>' +
            '<div class="uto-table uto-invites" data-uto-invites></div>' +
          '</div>' +

          '<div class="uto-sec">' +
            '<div class="uto-sechead">' +
              '<div class="uto-sectext">' +
                '<h2 class="uto-sectitle">' +
                  '<button class="uto-logtoggle" type="button" data-uto-logtoggle' +
                    ' aria-expanded="false">' +
                    '<span>Activity Log</span>' +
                    '<span data-uto-logchev></span>' +
                  '</button>' +
                '</h2>' +
                '<p class="uto-secsub">Every change to this team, newest first</p>' +
              '</div>' +
              '<span class="uto-seccount" data-uto-logcount></span>' +
            '</div>' +
            '<div class="uto-logbox" data-uto-logbox hidden>' +
              '<div class="uto-table uto-log" data-uto-log></div>' +
            '</div>' +
          '</div>' +

        '</div>';

      var elLoadErr = root.querySelector("[data-uto-loaderr]");
      var elBody    = root.querySelector("[data-uto-body]");
      var elMembers = root.querySelector("[data-uto-members]");
      var elInvites = root.querySelector("[data-uto-invites]");
      var elLogBox  = root.querySelector("[data-uto-logbox]");
      var elLog     = root.querySelector("[data-uto-log]");
      var elLogChev = root.querySelector("[data-uto-logchev]");
      var elLogCnt  = root.querySelector("[data-uto-logcount]");
      var elToggle  = root.querySelector("[data-uto-logtoggle]");

      if (UC.makeTooltips) UC.makeTooltips(root, isDark);
      /* Bubble legt um jedes HTML-Element eine Gruppe; steht dort eine Hoehe, schneidet sie mit
         overflow: hidden alles ab, was heraus will -- hier das Zeilenmenue. Dieselbe Zeile, die
         jede Tabelle und jeder Filter der App ruft. */
      if (UC.unclipAncestors) UC.unclipAncestors(root);
      if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 860 });

      /* ---------------- wer darf was ----------------
         NUR die Sichtbarkeit im Menue. Die Pruefung steht im RPC -- siehe Kopf dieser Datei.
         Die Regeln, wie vorgegeben:
           - Member verwalten niemanden.
           - Admins verwalten MEMBER: entfernen und zum Admin machen. Admins und Besitzer nicht.
           - Besitzer duerfen alles.
           - Der LETZTE Besitzer kann sich weder entfernen noch seine Rolle abgeben.
           - Die EIGENE Zeile bietet kein Entfernen und kein "Leave team" (25.09. angefordert):
             das Team verlaesst man unter Your Brand, Danger Zone, "Leave Team" (settings-brand).

         Was hier NICHT mehr mitentscheidet: die drei Flags can_invite / can_manage_members /
         can_manage_roles. Zuerst musste BEIDES zutreffen, Flag und Regel -- und damit war das
         Zeilenmenue in der echten Nutzlast an jeder Zeile leer: dort steht viewer_role "admin"
         zusammen mit can_manage_roles: false, waehrend die Vorgabe sagt, dass genau dieser Admin
         Member befoerdern darf. Zwei Wahrheiten, und die Vorgabe gewinnt.
         can_invite bleibt: es steuert den Einladen-Knopf, und dort widerspricht nichts.
         Dass ein Flag hier nichts mehr sperrt, ist unbedenklich -- gesperrt wird im RPC. Wer die
         Flags wieder mitreden lassen will, muss sie erst mit dieser Regel in Deckung bringen. */
      function besitzerZahl() {
        var n = 0;
        state.members.forEach(function (m) { if (rolleName(m.role) === "owner") n++; });
        return n;
      }
      /* Die eigene Zeile. Zwei Wege, weil Bubble den einen leichter liefert als den anderen: die
         Nutzer-Id (data-user / viewer_user_id) ist eindeutig, die E-Mail (data-user-email) ist in
         Bubble ein Klick. Steht keines von beiden, gibt es keine "You"-Marke -- geraten wird nicht,
         und in der Beispielnutzlast stehen zwei Zeilen mit demselben Anzeigenamen. */
      function istSelbst(m) {
        var id = feld(state.viewerId);
        if (id && txt(m.user_id) === id) return true;
        var mail = feld(state.viewerMail);
        return !!mail && txt(m.email).toLowerCase() === mail.toLowerCase();
      }
      /* Der LETZTE Besitzer ist unantastbar -- weder entfernen noch Rolle abgeben. Sonst steht ein
         Team ohne Besitzer da, und das kann die Seite nicht wieder heilen. */
      function letzterBesitzer(m) {
        return rolleName(m.role) === "owner" && besitzerZahl() <= 1;
      }
      function darfEntfernen(m) {
        if (letzterBesitzer(m)) return false;
        /* Die EIGENE Zeile nie (25.09. angefordert). Bis dahin stand hier "Leave team" -- das
           gibt es aber schon unter Your Brand (settings-brand, Danger Zone), und zwei Ausgaenge
           aus demselben Team an zwei Stellen waren einer zu viel. */
        if (istSelbst(m)) return false;
        var mr = rolleName(m.role), vr = rolleName(state.viewerRole);
        if (vr === "owner") return true;
        if (vr === "admin") return mr === "member";
        return false;
      }
      function darfRolle(m, ziel) {
        var mr = rolleName(m.role), vr = rolleName(state.viewerRole), zr = rolleName(ziel);
        if (mr === zr) return false;
        if (letzterBesitzer(m)) return false;
        if (vr === "owner") return true;
        /* Ein Admin fasst nur Member an und kann sie nur nach OBEN bewegen -- alles andere waere
           Verwaltung von Gleichrangigen. */
        if (vr === "admin") return mr === "member" && zr === "admin";
        return false;
      }
      function darfEinladen() { return !!state.perm.can_invite; }
      function darfWiderrufen() {
        /* Wer einladen darf, darf auch zuruecknehmen -- sonst haengt eine falsch verschickte
           Einladung sieben Tage in der Liste. */
        return darfEinladen() || rolleName(state.viewerRole) !== "member";
      }

      /* ---------------- Mitgliedertabelle ---------------- */
      function menueEintraege(m) {
        var e = [];
        ["member", "admin", "owner"].forEach(function (z) {
          if (!darfRolle(m, z)) return;
          e.push({ art: "role", ziel: z,
                   ic: z === "owner" ? "crown" : (z === "admin" ? "shieldCheck" : "users"),
                   lbl: "Set " + z.charAt(0).toUpperCase() + z.slice(1) });
        });
        if (darfEntfernen(m)) {
          e.push({ art: "remove", ic: "userMinus", lbl: "Remove from team", gefahr: true });
        }
        return e;
      }

      /* mitAkt entscheidet ueber die ZELLEN, und --up-cols entscheidet ueber die SPUREN. Beide
         muessen dasselbe sagen, sonst rutscht die letzte Zelle in eine zweite, unsichtbare
         Rasterzeile -- gemessen, bevor das hier stand: 4 Spuren, 5 Zellen, die fuenfte 40px unter
         dem Zeilenanfang in einer 52px hohen Zeile. Unsichtbar nur, weil sie leer war. */
      function membersHtml(mitAkt) {
        var kopf =
          '<div class="up-thead">' +
            '<div class="up-th">Name</div>' +
            '<div class="up-th uto-c-mail">E Mail</div>' +
            '<div class="up-th uto-c-when">Joined At</div>' +
            '<div class="up-th">Role</div>' +
            (mitAkt ? AKT_KOPF() : "") +
          '</div>';
        /* Skelett auch, solange die MITGLIEDER noch nicht da sind -- nicht nur bei busy. Seit
           Mitglieder und Einladungen zwei Schritte haben, kann der Einladungs-Schritt zuerst
           ankommen; er beendet busy, und die Tabelle behauptete dann "No members yet", obwohl
           die Mitglieder nur noch unterwegs waren. Leer und noch-nicht-da sind zwei Dinge.
           Die Spalten bekommt core als EIN Objekt. Vorher stand hier skeletonRows(3, 5), und aus
           zwei Zahlen machte core sieben Zeilen ohne eine einzige Zelle -- 364px leere Flaeche
           statt Balken, in allen drei Tabellen. cls traegt die Klasse der echten Zelle mit, weil
           das schmale Bild Spalten ueber genau diese Klassen ausblendet. */
        if (state.busy || !state.hatDaten) {
          return kopf + UC.skeletonRows({ count: 3, cols: [
            { w: 120, jitter: 26 },
            { w: 140, jitter: 26, cls: "uto-mail" },
            { w: 78, cls: "uto-when" },
            { w: 58, cls: "uto-role" }
          ].concat(mitAkt ? [{ w: 0, cls: "uto-act" }] : []) });
        }
        if (!state.members.length) {
          return kopf + '<div class="up-empty-mini">No members yet</div>';
        }
        return kopf + state.members.map(function (m, i) {
          var name = feld(m.display_name) || feld(m.email) || "–";
          return '<div class="up-row" data-uto-row="' + i + '">' +
            '<div class="up-td uto-name">' +
              '<span class="uto-nametxt">' + esc(name) + '</span>' +
              (istSelbst(m) ? '<span class="uto-you">You</span>' : "") +
            '</div>' +
            '<div class="up-td uto-mail">' + esc(feld(m.email) || "–") + '</div>' +
            '<div class="up-td uto-when">' + esc(fmtDate(feld(m.joined_at))) + '</div>' +
            '<div class="up-td uto-role">' +
              '<span class="up-entchip is-static' +
                (rolleName(m.role) === "owner" ? " is-owner" : "") + '">' +
                '<span class="uto-rolelbl">' + esc(rolleName(m.role)) + '</span>' +
              '</span>' +
            '</div>' +
            (mitAkt ? aktZelle(i) : "") +
          '</div>';
        }).join("");
      }

      /* Kopf und Zelle der Aktionsspalte an EINER Stelle: beide Tabellen lassen sie unter
         denselben Bedingungen weg, und zwei Kopien waeren zwei Stellen, an denen die Spaltenzahl
         von --up-cols abweichen kann. */
      function AKT_KOPF(kl) { return '<div class="up-th ' + (kl || "uto-act") + '"></div>'; }
      /* Der Punktknopf steht an JEDER Mitgliederzeile -- so vorgegeben, und ohne Bedingung: was
         die Zeile erlaubt, entscheidet erst das Menue (menueOeffnen). Erlaubt sie nichts, sagt es
         das in einem Satz statt leer aufzugehen. */
      function aktZelle(i) {
        return '<div class="up-td uto-act">' +
          '<span class="uto-menuwrap" data-uto-wrap>' +
            '<button class="up-iconbtn" type="button" aria-haspopup="menu" aria-expanded="false"' +
              ' aria-label="Actions" data-uto-menubtn="member:' + i + '">' +
              UC.icon("moreHorizontal", 2.2) + '</button>' +
            '<div class="up-menu uto-menu" role="menu" aria-hidden="true"></div>' +
          '</span>' +
        '</div>';
      }
      /* Und die Einladungen: ZWEI Knoepfe, kein Menue -- so vorgegeben. Beide aus core
         (.up-btn-sec.up-rowbtn), nur dauerhaft sichtbar (team-orga.css). */
      function invZelle(i) {
        return '<div class="up-td uto-invact">' +
          /* data-tip an beiden: im schmalen Bild faellt die Beschriftung weg (team-orga.css),
             und ein Knopf ohne Text muss trotzdem sagen, was er tut. */
          '<button class="up-btn-sec up-rowbtn" type="button" data-uto-do="resend"' +
            ' data-tip="' + esc(UC.t("Resend")) + '" aria-label="' + esc(UC.t("Resend")) + '"' +
            ' data-uto-i="' + i + '">' + UC.icon("send", 2) + '<span>' + esc(UC.t("Resend")) + '</span></button>' +
          '<button class="up-btn-sec up-rowbtn uto-danger" type="button" data-uto-do="revoke"' +
            ' data-tip="' + esc(UC.t("Revoke")) + '" aria-label="' + esc(UC.t("Revoke")) + '"' +
            ' data-uto-i="' + i + '">' + UC.icon("x", 2.4) + '<span>' + esc(UC.t("Revoke")) + '</span></button>' +
        '</div>';
      }

      /* ---------------- Einladungen ---------------- */
      /* Skelett, waehrend busy UND solange die Einladungen noch nicht kamen. EINE Stelle, weil
         render() daraus auch die Aktionsspalte ableitet -- das Skelett hat fuenf Zellen, und
         Spuren und Zellen muessen dasselbe sagen. */
      function invitesWarten() {
        return !state.invitesLeseFehler && (state.busy || !state.invitesDa);
      }
      function invitesHtml(mitAkt) {
        var kopf =
          '<div class="up-thead">' +
            '<div class="up-th">Email</div>' +
            '<div class="up-th">Role</div>' +
            '<div class="up-th uto-c-when">Expires</div>' +
            '<div class="up-th uto-c-by">Invited by</div>' +
            (mitAkt ? AKT_KOPF("uto-invact") : "") +
          '</div>';
        /* Der Lesefehler VOR dem Skelett: er ist eine Aussage, das Skelett waere keine. */
        if (state.invitesLeseFehler) return kopf + UC.leseFehlerHtml("pending invites");
        if (invitesWarten()) {
          return kopf + UC.skeletonRows({ count: 2, cols: [
            { w: 140, jitter: 26 },
            { w: 58, cls: "uto-role" },
            { w: 78, cls: "uto-when" },
            { w: 130, jitter: 20, cls: "uto-inv-by" }
          ].concat(mitAkt ? [{ w: 0, cls: "uto-invact" }] : []) });
        }
        if (!state.invites.length) {
          return kopf + '<div class="up-empty-mini">No pending invites</div>';
        }
        return kopf + state.invites.map(function (v, i) {
          var alt = abgelaufen(v.expires_at);
          return '<div class="up-row" data-uto-invrow="' + i + '">' +
            '<div class="up-td"><span class="uto-inv-mail">' +
              esc(feld(v.invited_email) || "–") + '</span></div>' +
            '<div class="up-td uto-role">' +
              '<span class="up-entchip is-static"><span class="uto-rolelbl">' +
                esc(rolleName(v.invited_role)) + '</span></span>' +
            '</div>' +
            '<div class="up-td uto-when"><span class="uto-inv-state' + (alt ? " is-expired" : "") +
              '">' + (alt ? "expired" : esc(fmtDate(feld(v.expires_at)))) + '</span></div>' +
            '<div class="up-td uto-inv-by">' + esc(feld(v.created_by_email) || "–") + '</div>' +
            (mitAkt ? invZelle(i) : "") +
          '</div>';
        }).join("");
      }

      /* ---------------- Protokoll ---------------- */
      function logHtml() {
        var kopf =
          '<div class="up-thead">' +
            '<div class="up-th">Date</div>' +
            '<div class="up-th">Event</div>' +
            '<div class="up-th">Actor</div>' +
            '<div class="up-th uto-c-target">Target</div>' +
            '<div class="up-th uto-c-meta">Details</div>' +
          '</div>';
        if (state.logLeseFehler) return kopf + UC.leseFehlerHtml("the activity log");
        /* 80px am Datum: im schmalen Bild ist die Spalte 112px breit, abzueglich der 28px
           Polsterung der Zelle bleiben 84 -- ein breiterer Balken wuerde dort abgeschnitten. */
        if (state.busy || !state.logDa) {
          return kopf + UC.skeletonRows({ count: 4, cols: [
            { w: 80 },
            { w: 100, jitter: 14 },
            { w: 130, jitter: 20 },
            { w: 130, jitter: 20, cls: "uto-c-target" },
            { w: 150, jitter: 24, cls: "uto-c-meta" }
          ] });
        }
        if (!state.log.length) return kopf + '<div class="up-empty-mini">No entries yet</div>';
        return kopf + state.log.map(function (l) {
          var ev = feld(l.event_type) || "unknown";
          var ton = EV_TON[ev] || "";
          return '<div class="up-row">' +
            '<div class="up-td"><span class="uto-log-mono">' + esc(zeitpunkt(l.created_at)) + '</span></div>' +
            '<div class="up-td"><span class="uto-log-evwrap">' +
              '<span class="uto-log-dot ' + ton + '"></span>' +
              '<span class="uto-log-mono uto-log-ev">' + esc(ev) + '</span>' +
            '</span></div>' +
            '<div class="up-td"><span class="uto-log-txt">' +
              esc(feld(l.actor_email) || feld(l.actor_display_name) || "system") + '</span></div>' +
            '<div class="up-td uto-c-target"><span class="uto-log-txt">' +
              esc(feld(l.target_email) || "–") + '</span></div>' +
            '<div class="up-td uto-c-meta"><span class="uto-log-mono">' +
              esc(metaText(l.meta)) + '</span></div>' +
          '</div>';
        }).join("");
      }
      /* Die Zusatzangaben als eine Zeile "schluessel=wert". Nur SKALARE Werte und nur die kurzen:
         invite_id ist eine UUID und sagt einem Leser nichts, invited_role sagt alles. Was hier
         nicht steht, ist nicht verloren -- es steht im Server. */
      var META_AUS = { invite_id: true, log_id: true };
      function metaText(m) {
        if (!m || typeof m !== "object" || isArr(m)) return "";
        var teile = [];
        Object.keys(m).forEach(function (k) {
          if (META_AUS[k]) return;
          var v = m[k];
          if (v == null) return;
          if (typeof v === "object") return;
          teile.push(k + "=" + String(v));
        });
        return teile.join("  ");
      }

      /* ---------------- render ---------------- */
      var popovers = [];
      function render() {
        /* Der Fehlerfall kommt VOR dem Skelett: endloses Laden sieht aus wie "gleich da". */
        if (state.fehler) {
          elLoadErr.hidden = false;
          elLoadErr.innerHTML = UC.leseFehlerHtml("team members");
          elBody.hidden = true;
          return;
        }
        elLoadErr.hidden = true;
        elBody.hidden = false;

        root.classList.toggle("can-invite", darfEinladen());

        /* Offene Popover gehen mit ihrem Markup weg -- sonst bleiben Karteileichen in der
           Registry von core stehen und ein Escape schliesst Menues, die es nicht mehr gibt. */
        popovers.forEach(function (p) { try { p.close(false); } catch (e) {} });
        popovers = [];

        /* Die Mitgliedertabelle hat die Aktionsspalte IMMER -- der Punktknopf steht an jeder Zeile.
           Bei den Einladungen faellt sie weg, wenn es keine gibt oder niemand widerrufen darf.
           Der Wert wird EINMAL berechnet und sowohl an das Markup als auch an die Klasse gegeben:
           das ist die Stelle, an der Rasterspuren und Zellen zusammenbleiben. */
        var mAkt = true;
        var iAkt = invitesWarten() ||
                   (!state.invitesLeseFehler && state.invites.length > 0 && darfWiderrufen());
        elMembers.classList.toggle("no-actions", !mAkt);
        elInvites.classList.toggle("no-actions", !iAkt);

        elMembers.innerHTML = membersHtml(mAkt);
        elInvites.innerHTML = invitesHtml(iAkt);
        elLog.innerHTML = logHtml();

        /* Kein Zaehler neben einem Lesefehler -- er zaehlte die Eintraege von VORHER. */
        var logZahl = state.logLeseFehler ? 0 : state.log.length;
        elLogCnt.textContent = logZahl ? logZahl + (logZahl === 1 ? " entry" : " entries") : "";
        elLogBox.hidden = !state.logOffen;
        elToggle.setAttribute("aria-expanded", state.logOffen ? "true" : "false");
        elLogChev.innerHTML = UC.icon(state.logOffen ? "chevronUp" : "chevronDown", 2);
      }

      /* ---------------- Zeilenmenues ----------------
         Erst beim Klick gebaut. Ein Menue je Zeile im Voraus waere bei 40 Mitgliedern 40 Menues,
         und ihr Inhalt haengt am Zustand, der sich mit jedem Rerender aendert. */
      function menueOeffnen(btn) {
        var wrap = btn.closest("[data-uto-wrap]");
        var menu = wrap && wrap.querySelector(".uto-menu");
        if (!menu) return;
        var teile = String(btn.getAttribute("data-uto-menubtn") || "").split(":");
        var i = parseInt(teile[1], 10);
        var m = state.members[i];
        if (!m) return;
        var e = menueEintraege(m);
        var html = e.length
          ? e.map(function (x, k) {
              return (x.gefahr && k > 0 ? '<div class="uto-menu-div"></div>' : "") +
                '<button class="up-optrow' + (x.gefahr ? " uto-danger" : "") + '" type="button"' +
                ' data-uto-do="' + esc(x.art) + '" data-uto-i="' + i + '"' +
                (x.ziel ? ' data-uto-target="' + esc(x.ziel) + '"' : "") + '>' +
                UC.icon(x.ic, 2) + '<span class="uto-menu-lbl">' + esc(x.lbl) + '</span></button>';
            }).join("")
          /* Kein leeres Kaestchen: der Grund steht drin. Drei Faelle fuehren hierhin -- der letzte
             Besitzer, ein Admin, der einen anderen Admin oder den Besitzer ansieht, und die
             EIGENE Zeile eines Admins oder Members: seit dort "Leave team" fehlt, bleibt nichts.
             "You cannot manage this member." waere ueber die eigene Zeile falsch, also steht dort,
             wo das Gehen jetzt wohnt. */
          : '<div class="uto-menu-leer">' +
              (letzterBesitzer(m)
                ? "The last owner cannot be changed or removed."
                : (istSelbst(m)
                    ? "You can leave the team under Your Brand."
                    : "You cannot manage this member.")) +
            '</div>';
        menu.innerHTML = html;
        var zeile = btn.closest(".up-row");
        var pop = UC.makePopover({
          wrap: wrap, menu: menu, opener: btn, group: "uto-" + instanceId,
          onClose: function () {
            btn.setAttribute("aria-expanded", "false");
            var z = btn.closest(".uto-act"); if (z) z.classList.remove("is-open");
            /* Die Hebung wieder wegnehmen -- eine dauerhaft gehobene Zeile liegt ueber dem
               Menue der naechsten. */
            if (zeile) zeile.classList.remove("uto-rowopen");
          }
        });
        popovers.push(pop);
        pop.open();
        btn.setAttribute("aria-expanded", "true");
        var zelle = btn.closest(".uto-act"); if (zelle) zelle.classList.add("is-open");
        /* Hebt die ZEILE, nicht das Menue: .up-row traegt contain: layout und ist damit ein
           eigener Stapelkontext -- siehe team-orga.css. */
        if (zeile) zeile.classList.add("uto-rowopen");
      }

      /* ---------------- Klicks ---------------- */
      root.addEventListener("click", function (e) {
        if (!e.target.closest) return;

        if (e.target.closest("[data-uto-invite]")) {
          if (!darfEinladen()) return;
          dialog().oeffnen(root.__utoController, e.target.closest("[data-uto-invite]"));
          return;
        }
        if (e.target.closest("[data-uto-logtoggle]")) {
          state.logOffen = !state.logOffen;
          render();
          return;
        }
        var btn = e.target.closest("[data-uto-menubtn]");
        if (btn) {
          e.stopPropagation();
          var wrap = btn.closest("[data-uto-wrap]");
          /* Zweiter Klick auf denselben Knopf schliesst -- die Erwartung an einen Aufklapper. */
          if (wrap && wrap.classList.contains("is-open")) {
            popovers.forEach(function (p) { try { p.close(false); } catch (er) {} });
            return;
          }
          menueOeffnen(btn);
          return;
        }
        var tun = e.target.closest("[data-uto-do]");
        if (tun) { ausfuehren(tun); return; }
      });

      function ausfuehren(el) {
        var was = el.getAttribute("data-uto-do");
        var i = parseInt(el.getAttribute("data-uto-i"), 10);
        popovers.forEach(function (p) { try { p.close(true); } catch (e) {} });
        if (was === "revoke" || was === "resend") {
          var v = state.invites[i];
          if (!v || !darfWiderrufen()) return;
          if (was === "resend") {
            fire("data-resend-fn", "utoResend",
                 { invite_id: feld(v.invite_id), email: feld(v.invited_email),
                   role: rolleName(v.invited_role) });
            return;
          }
          fire("data-revoke-fn", "utoRevoke",
               { invite_id: feld(v.invite_id), email: feld(v.invited_email) });
          return;
        }
        var m = state.members[i];
        if (!m) return;
        if (was === "remove") {
          if (!darfEntfernen(m)) return;
          /* self bleibt im Payload, obwohl es seit dem 25.09. immer false ist (die eigene Zeile
             bietet kein Entfernen mehr): ein bestehender Workflow liest das Feld womoeglich mit
             Regex, und ein fehlendes Feld liefert dort leeren Text statt "false". */
          fire("data-remove-fn", "utoRemove",
               { user_id: feld(m.user_id), email: feld(m.email), self: istSelbst(m) });
          return;
        }
        if (was === "role") {
          var ziel = rolleName(el.getAttribute("data-uto-target"));
          /* Zweite Pruefung genau hier: zwischen dem Bauen des Menues und dem Klick kann ein
             Rerender die Zeilen verschoben haben. Der RPC prueft ohnehin, aber ein Ereignis, das
             der Nutzer nie gemeint hat, soll die Seite nicht senden. */
          if (!darfRolle(m, ziel)) return;
          fire("data-role-fn", "utoRole",
               { user_id: feld(m.user_id), email: feld(m.email), role: ziel });
        }
      }

      /* ---------------- Setter ---------------- */
      /* Ein Payload, den readBubble nicht lesen konnte, darf NIE stillschweigend verpuffen: der
         Ladezustand endet immer, und der Fehler steht im UI. readBubble und nicht parseLoose --
         parseLoose scheitert an Emoji, und Anzeigenamen enthalten sie. */
      function render1(p) {
        var o = (p && typeof p === "object" && !isArr(p)) ? p : UC.readBubble(p);
        var ok = !!(o && typeof o === "object" && !isArr(o) && isArr(o.members));
        if (ok) {
          state.members = o.members.slice();
          var perm = (o.permissions && typeof o.permissions === "object") ? o.permissions : {};
          state.perm = {
            can_invite: perm.can_invite === true || isYes(perm.can_invite),
            can_manage_roles: perm.can_manage_roles === true || isYes(perm.can_manage_roles),
            can_manage_members: perm.can_manage_members === true || isYes(perm.can_manage_members)
          };
          state.viewerRole = rolleName(o.viewer_role);
          /* Die eigene Zeile: entweder sagt der Payload, wer der Leser ist, oder das Attribut am
             Element. Steht nirgends etwas, gibt es keine "You"-Marke -- geraten wird nicht. */
          state.viewerId = feld(o.viewer_user_id) || feld(root.getAttribute("data-user"));
          state.viewerMail = feld(o.viewer_email) || feld(root.getAttribute("data-user-email"));
          /* NUR, wenn die Einladungen nicht schon ueber ihren eigenen Setter kamen (25.09.). Der
             Mitglieder-RPC schickt "pending_invites": [] mit -- und seit Mitglieder und
             Einladungen zwei eigene Run-JS-Schritte haben, leerte jedes Neuladen der Mitglieder
             die Einladungsliste, sobald es NACH dem Einladungs-Schritt lief (gemessen: erst
             Einladungen, dann Mitglieder -> Liste leer). Der eigene Setter ist die genauere
             Quelle, also gewinnt er, egal in welcher Reihenfolge die Schritte laufen. */
          if (isArr(o.pending_invites) && !state.invitesEigen) {
            state.invites = o.pending_invites.slice();
            /* Eine LEERE Liste von hier beendet das Warten aber nicht: die echte Nutzlast
               schickt "pending_invites": [] auch dann, wenn es offene Einladungen gibt (Beispiel
               vom 25.09.: hier [], im Einladungs-RPC eine). Als Aussage genommen, stand "No
               pending invites" da, bis der Einladungs-Schritt ankam. */
            if (state.invites.length) state.invitesDa = true;
          }
          state.hatDaten = true;
          state.fehler = null;
        } else {
          state.members = []; state.hatDaten = false;
          state.fehler = "members";
        }
        state.busy = false;
        render();
      }
      /* readBubble liefert ein OBJEKT als Liste mit EINEM Eintrag: aus {"count":1,"invites":[...]}
         wird [{"count":1,"invites":[...]}]. Gemessen am 25.09. -- setTeamOrgaInvites hielt diese
         Liste fuer die Einladungen selbst und zeichnete den Umschlag als eine Einladung ohne
         Adresse ("–"). Aufgefallen ist es erst mit dem ROHEN Text aus dem Run-JS-Schritt; der
         alte Schritt der Vorlage hatte vorher selbst geparst und Objekte uebergeben.
         Ausgepackt wird nur, was eindeutig ein Umschlag ist: genau ein Eintrag, und der traegt
         die Liste unter einem der genannten Schluessel. Eine echte Liste mit einer einzigen
         Einladung bleibt, wie sie ist.
         null zaehlt mit: laesst Bubble eine LEERE Liste weg ("invites": ,), macht die
         Sanitizer-Zeile ein null daraus -- und ohne Auspacken wurde der Umschlag wieder zur
         Einladung, als Zeile "–" mit Resend und Revoke (gemessen am 25.09.). Eine Einladung
         selbst hat keinen Schluessel "invites", ein Protokolleintrag kein "logs" oder "entries". */
      function auspacken(o, schluessel) {
        if (isArr(o) && o.length === 1 && o[0] && typeof o[0] === "object" && !isArr(o[0])) {
          for (var i = 0; i < schluessel.length; i++) {
            var w = o[0][schluessel[i]];
            if (isArr(w) || w === null) return o[0];
          }
        }
        return o;
      }
      /* Die Liste aus dem ausgepackten Wert. null unter dem Schluessel ist LEER, nicht kaputt
         (siehe oben); kaputt ist nur, was gar keine Liste hergibt -- dann null. */
      function listeAus(o, schluessel) {
        if (isArr(o)) return o;
        if (!o || typeof o !== "object") return null;
        var i;
        for (i = 0; i < schluessel.length; i++) if (isArr(o[schluessel[i]])) return o[schluessel[i]];
        for (i = 0; i < schluessel.length; i++) if (o[schluessel[i]] === null) return [];
        return null;
      }
      /* Ein WIRKLICH leerer Text ist leer, nicht kaputt -- dieselbe Linie wie normParams in core
         (§46): "" und "[]" sind der normale Leerzustand, erst Text, der sich nicht lesen laesst,
         ist ein Lesefehler. */
      function roh(p) { return (typeof p === "string" && !p.trim()) ? [] : p; }
      function setInvites(p) {
        p = roh(p);
        var o = auspacken((p && typeof p === "object") ? p : UC.readBubble(p), ["invites"]);
        var liste = listeAus(o, ["invites"]);
        if (liste) {
          /* Nur OFFENE: der Server schickt in dieser Nutzlast auch zurueckgezogene und
             angenommene mit (revoked_at / accepted_at gesetzt). Die gehoeren ins Protokoll, nicht
             in eine Liste, die "Pending" heisst. */
          state.invitesEigen = true;
          state.invitesDa = true;
          state.invitesLeseFehler = false;
          state.invites = liste.filter(function (v) {
            if (!v || typeof v !== "object") return false;
            if (feld(v.revoked_at) || feld(v.accepted_at)) return false;
            var st = String(v.status == null ? "" : v.status).trim().toLowerCase();
            return !st || st === "pending";
          });
        } else {
          /* Unlesbar ist nicht leer (§2): der Abschnitt sagt es, statt still die alte Liste
             stehen zu lassen -- die dann Resend und Revoke an Einladungen anbietet, von denen
             niemand weiss, ob es sie noch gibt. */
          state.invitesLeseFehler = true;
          if (window.console) console.warn("[team-orga] " + instanceId +
            ": setTeamOrgaInvites konnte die Nutzlast nicht lesen.");
        }
        state.busy = false;
        render();
      }
      function setLog(p) {
        p = roh(p);
        var o = auspacken((p && typeof p === "object") ? p : UC.readBubble(p), ["logs", "entries"]);
        var liste = listeAus(o, ["logs", "entries"]);
        if (liste) {
          state.logDa = true;
          state.logLeseFehler = false;
          /* Neueste zuerst. Der RPC liefert es schon so, aber eine Liste, deren Reihenfolge man
             annimmt, ist eine Liste, die eines Tages verkehrt steht. */
          state.log = liste.slice().sort(function (a, b) {
            return new Date(txt(b && b.created_at)).getTime() - new Date(txt(a && a.created_at)).getTime();
          });
        } else {
          state.logLeseFehler = true;
          if (window.console) console.warn("[team-orga] " + instanceId +
            ": setTeamOrgaLog konnte die Nutzlast nicht lesen.");
        }
        state.busy = false;
        render();
      }

      var ctrl = {
        render: render1,
        setInvites: setInvites,
        setLog: setLog,
        setLoading: function (v) { state.busy = isYes(v); render(); },
        reset: function () {
          state.members = []; state.invites = []; state.log = [];
          state.hatDaten = false; state.fehler = null; state.busy = false; state.invitesEigen = false;
          state.invitesDa = false; state.logDa = false;
          state.invitesLeseFehler = false; state.logLeseFehler = false;
          /* Die Rechte mit: sonst stand nach dem Zuruecksetzen "Invite new Members" noch da, und
             Einladungen, die VOR den Mitgliedern ankamen, trugen Resend und Revoke -- beides nach
             den Rechten des vorigen Teams (gemessen am 25.09.). Bis die Mitglieder kommen, gilt,
             was beim Start gilt. */
          state.perm = { can_invite: false, can_manage_roles: false, can_manage_members: false };
          state.viewerRole = "member"; state.viewerId = ""; state.viewerMail = "";
          state.logOffen = false;
          render();
        },
        /* Vom Dialog gerufen. Er kennt die Wurzel nicht und soll sie nicht kennen -- er bekommt
           den Controller und ruft eine Methode. */
        invite: function (email, rolle) {
          if (!darfEinladen()) return;
          fire("data-invite-fn", "utoInvite", { email: txt(email), role: rolleName(rolle) });
        },
        setTheme: function (t) { if (UC.setUpstreemTheme) UC.setUpstreemTheme(t); }
      };
      root.__utoController = ctrl;
      render();
      if (spaet) spaet.drain(instanceId, ctrl);
    }

    function each(id, fn) {
      var roots = Array.prototype.slice.call(document.querySelectorAll(".uto-root, [data-uto-root]"));
      /* Genauer Name schlaegt Praefix. Auf der echten Seite heisst ein Filter "..._prompts" und
         ein zweiter "..._promptspotlight" -- der erste Name ist ein Praefix des zweiten, und der
         Aufruf fuer die Prompts-Seite bediente damit STILL auch das Prompt-Spotlight (gemessen
         02.09. auf der laufenden App). Die dokumentierte Praefix-Form (etwa "dates_v2_") bleibt
         erhalten: sie greift weiter, sobald es keinen genauen Treffer gibt. */
      var genau = id !== "default" && roots.some(function (r) {
        return String(r.getAttribute("data-instance") || "default") === id; });
      roots = roots.filter(function (r) {
        var rid = String(r.getAttribute("data-instance") || "default");
        return id === "default" ? true : (genau ? rid === id : rid.indexOf(id) === 0);
      });
      /* Erst einrichten, dann rufen -- makeMount arbeitet die Warteschlange ab, bevor initAll
         gelaufen ist, und ein Aufruf aus der Warteschlange darf nicht ins Leere gehen. */
      roots.forEach(function (r) {
        if (r.__utoController) return;
        try { initRoot(r); }
        catch (e) { if (window.console) console.error("[team-orga] initRoot ist gescheitert:", e); }
      });
      var mit = roots.filter(function (r) { return !!r.__utoController; });
      if (!mit.length && spaet) { spaet.park(id, fn); return; }
      mit.forEach(function (r) { fn(r.__utoController); });
    }

    mount = UC.makeMount({
      onMount: function (m) { mount = m; },
      rootClass: "uto-root", notPortal: true,
      ctrlProp: "__utoController",
      resolveLocal: "__utoResolveLocal",
      queue: "__utoBootQueue",
      initRoot: initRoot,
      api: {
        /* Ohne instanceId gilt "default", und each() trifft dann JEDE Wurzel -- die
           Beispielnutzlast des Servers hat kein solches Feld, und eine Seite hat genau eine
           Teamverwaltung. Wer zwei Platzierungen hat, gibt die Kennung mit. */
        renderTeamOrga: function (p) {
          var o = p || {};
          each((typeof o === "object" && o.instanceId) || "default", function (c) { c.render(o); });
        },
        setTeamOrgaInvites: function (id, p) { each(id || "default", function (c) { c.setInvites(p); }); },
        setTeamOrgaLog: function (id, p) { each(id || "default", function (c) { c.setLog(p); }); },
        setTeamOrgaLoading: function (id, v) { each(id || "default", function (c) { c.setLoading(v); }); },
        resetTeamOrga: function (id) { each(id || "default", function (c) { c.reset(); }); }
      },
      forwardShape: { renderTeamOrga: "params", resetTeamOrga: "id" }
    });
  }

  utoBoot(50);
})();
