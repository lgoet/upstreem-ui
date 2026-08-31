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

   ── Daten hinein (ein Run-JS-Schritt, siehe bubble/team_orga_bubble.html) ───
     renderTeamOrga({ instanceId, members, permissions, viewer_role, pending_invites })
     setTeamOrgaInvites(INSTANCE_ID, { count, invites })      Einladungen einzeln nachliefern
     setTeamOrgaLog(INSTANCE_ID, [ ... ])                     das Protokoll
     setTeamOrgaLoading(INSTANCE_ID, "yes")                   Skelett, waehrend der RPC laeuft
     resetTeamOrga(INSTANCE_ID)                               zurueck auf leer

   Die drei Nutzlasten kommen getrennt, weil sie im Backend aus drei Abfragen kommen. Jede fuer
   sich darf fehlen: fehlt das Protokoll, steht dort "No entries yet" -- die Mitgliederliste
   funktioniert trotzdem.

   ── Ereignisse heraus (jedes mit einem JSON-Text als erstem Parameter) ──────
     utoInvite   { team_id, email, role }              Einladen im Dialog bestaetigt
     utoRevoke   { team_id, invite_id, email }         "Revoke invite" an einer offenen Einladung
     utoRemove   { team_id, user_id, email, self }     "Remove from team" bzw. "Leave team"
     utoRole     { team_id, user_id, email, role }     "Set Member" / "Set Admin" / "Set Owner"

   Nach JEDEM dieser vier muss der Workflow die Daten neu holen und die drei Setter erneut rufen --
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
           - Member duerfen nichts.
           - Admins verwalten MEMBER: entfernen und zum Admin machen. Admins und Besitzer nicht.
           - Besitzer duerfen alles.
           - Der LETZTE Besitzer kann sich weder entfernen noch seine Rolle abgeben.
         Dazu kommen die drei Flags aus dem Server (can_invite / can_manage_members /
         can_manage_roles) -- gezeigt wird nur, was BEIDE erlauben. Das ist die vorsichtige Seite:
         in der Beispielnutzlast steht viewer_role "admin" MIT can_manage_members, aber OHNE
         can_manage_roles, und dann gibt es eben kein Befoerdern. */
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
      function darfEntfernen(m) {
        if (!state.perm.can_manage_members) return false;
        var mr = rolleName(m.role), vr = rolleName(state.viewerRole);
        if (vr === "owner") {
          /* Der letzte Besitzer bleibt. Sonst steht ein Team ohne Besitzer da, und das kann die
             Seite nicht wieder heilen. */
          if (mr === "owner" && besitzerZahl() <= 1) return false;
          return true;
        }
        if (vr === "admin") return mr === "member";
        return false;
      }
      function darfRolle(m, ziel) {
        if (!state.perm.can_manage_roles) return false;
        var mr = rolleName(m.role), vr = rolleName(state.viewerRole), zr = rolleName(ziel);
        if (mr === zr) return false;
        if (vr === "owner") {
          if (mr === "owner" && besitzerZahl() <= 1) return false;
          return true;
        }
        /* Ein Admin fasst nur Member an und kann sie nur nach OBEN bewegen -- alles andere waere
           Verwaltung von Gleichrangigen. */
        if (vr === "admin") return mr === "member" && zr === "admin";
        return false;
      }
      function darfEinladen() { return !!state.perm.can_invite; }
      function darfWiderrufen() {
        /* Eine Einladung zurueckzunehmen ist Mitgliederverwaltung -- wer einladen darf, darf auch
           zuruecknehmen; sonst haengt eine falsch verschickte Einladung sieben Tage in der Liste. */
        return !!(state.perm.can_manage_members || state.perm.can_invite);
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
          /* Die eigene Zeile heisst "Leave team" -- es ist derselbe Vorgang, aber nicht dieselbe
             Aussage, und ein Nutzer soll nicht auf "Remove" klicken muessen, um zu gehen. */
          e.push({ art: "remove", ic: istSelbst(m) ? "logOut" : "userMinus",
                   lbl: istSelbst(m) ? "Leave team" : "Remove from team", gefahr: true });
        }
        return e;
      }

      /* mitAkt entscheidet ueber die ZELLEN, und --up-cols entscheidet ueber die SPUREN. Beide
         muessen dasselbe sagen, sonst rutscht die letzte Zelle in eine zweite, unsichtbare
         Rasterzeile -- gemessen, bevor das hier stand: 4 Spuren, 5 Zellen, die fuenfte 40px unter
         dem Zeilenanfang in einer 52px hohen Zeile. Unsichtbar nur, weil sie leer war. */
      function membersHtml(mitAkt) {
        var kopf =
          '<div class="up-thead up-row">' +
            '<div class="up-th">Name</div>' +
            '<div class="up-th uto-c-mail">E Mail</div>' +
            '<div class="up-th uto-c-when">Joined At</div>' +
            '<div class="up-th">Role</div>' +
            (mitAkt ? AKT_KOPF() : "") +
          '</div>';
        if (state.busy) return kopf + UC.skeletonRows(3, mitAkt ? 5 : 4);
        if (!state.members.length) {
          return kopf + '<div class="up-empty-mini">No members yet</div>';
        }
        return kopf + state.members.map(function (m, i) {
          var name = feld(m.display_name) || feld(m.email) || "–";
          var eintraege = menueEintraege(m);
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
            (mitAkt ? aktZelle(eintraege.length, i, "member") : "") +
          '</div>';
        }).join("");
      }

      /* Kopf und Zelle der Aktionsspalte an EINER Stelle: beide Tabellen lassen sie unter
         denselben Bedingungen weg, und zwei Kopien waeren zwei Stellen, an denen die Spaltenzahl
         von --up-cols abweichen kann. */
      function AKT_KOPF() { return '<div class="up-th uto-act"></div>'; }
      function aktZelle(anzahl, i, art) {
        if (!anzahl) return '<div class="up-td uto-act"></div>';
        return '<div class="up-td uto-act">' +
          '<span class="uto-menuwrap" data-uto-wrap>' +
            '<button class="up-iconbtn" type="button" aria-haspopup="menu" aria-expanded="false"' +
              ' aria-label="Actions" data-uto-menubtn="' + art + ':' + i + '">' +
              UC.icon("moreHorizontal", 2.2) + '</button>' +
            '<div class="up-menu uto-menu" role="menu" aria-hidden="true"></div>' +
          '</span>' +
        '</div>';
      }

      /* ---------------- Einladungen ---------------- */
      function invitesHtml(mitAkt) {
        var kopf =
          '<div class="up-thead up-row">' +
            '<div class="up-th">Email</div>' +
            '<div class="up-th">Role</div>' +
            '<div class="up-th uto-c-when">Expires</div>' +
            '<div class="up-th uto-c-by">Invited by</div>' +
            (mitAkt ? AKT_KOPF() : "") +
          '</div>';
        if (state.busy) return kopf + UC.skeletonRows(2, mitAkt ? 5 : 4);
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
            (mitAkt ? aktZelle(1, i, "invite") : "") +
          '</div>';
        }).join("");
      }

      /* ---------------- Protokoll ---------------- */
      function logHtml() {
        var kopf =
          '<div class="up-thead up-row">' +
            '<div class="up-th">Date</div>' +
            '<div class="up-th">Event</div>' +
            '<div class="up-th">Actor</div>' +
            '<div class="up-th uto-c-target">Target</div>' +
            '<div class="up-th uto-c-meta">Details</div>' +
          '</div>';
        if (state.busy) return kopf + UC.skeletonRows(4, 5);
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

        /* Die Aktionsspalte faellt weg, sobald KEINE Zeile eine Aktion hat. Der Wert wird EINMAL
           berechnet und dann sowohl an das Markup als auch an die Klasse gegeben -- das ist die
           Stelle, an der Spuren und Zellen zusammenbleiben. Waehrend des Ladens bleibt sie da:
           welche Aktionen es geben wird, weiss man erst mit den Daten, und eine Spalte, die nach
           dem Laden erscheint, laesst die Tabelle springen. */
        var mAkt = state.busy ||
          state.members.some(function (m) { return menueEintraege(m).length > 0; });
        var iAkt = state.busy || (state.invites.length > 0 && darfWiderrufen());
        elMembers.classList.toggle("no-actions", !mAkt);
        elInvites.classList.toggle("no-actions", !iAkt);

        elMembers.innerHTML = membersHtml(mAkt);
        elInvites.innerHTML = invitesHtml(iAkt);
        elLog.innerHTML = logHtml();

        elLogCnt.textContent = state.log.length
          ? state.log.length + (state.log.length === 1 ? " entry" : " entries") : "";
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
        var art = teile[0], i = parseInt(teile[1], 10);
        var html = "";
        if (art === "member") {
          var m = state.members[i];
          if (!m) return;
          var e = menueEintraege(m);
          if (!e.length) return;
          html = e.map(function (x, k) {
            return (x.gefahr && k > 0 ? '<div class="uto-menu-div"></div>' : "") +
              '<button class="up-optrow' + (x.gefahr ? " uto-danger" : "") + '" type="button"' +
              ' data-uto-do="' + esc(x.art) + '" data-uto-i="' + i + '"' +
              (x.ziel ? ' data-uto-target="' + esc(x.ziel) + '"' : "") + '>' +
              UC.icon(x.ic, 2) + '<span class="uto-menu-lbl">' + esc(x.lbl) + '</span></button>';
          }).join("");
        } else {
          var v = state.invites[i];
          if (!v || !darfWiderrufen()) return;
          html = '<button class="up-optrow uto-danger" type="button" data-uto-do="revoke"' +
            ' data-uto-i="' + i + '">' + UC.icon("x", 2.2) +
            '<span class="uto-menu-lbl">Revoke invite</span></button>';
        }
        menu.innerHTML = html;
        var pop = UC.makePopover({
          wrap: wrap, menu: menu, opener: btn, group: "uto-" + instanceId,
          onClose: function () {
            btn.setAttribute("aria-expanded", "false");
            var z = btn.closest(".uto-act"); if (z) z.classList.remove("is-open");
          }
        });
        popovers.push(pop);
        pop.open();
        btn.setAttribute("aria-expanded", "true");
        var zelle = btn.closest(".uto-act"); if (zelle) zelle.classList.add("is-open");
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
        if (was === "revoke") {
          var v = state.invites[i];
          if (!v || !darfWiderrufen()) return;
          fire("data-revoke-fn", "utoRevoke",
               { invite_id: feld(v.invite_id), email: feld(v.invited_email) });
          return;
        }
        var m = state.members[i];
        if (!m) return;
        if (was === "remove") {
          if (!darfEntfernen(m)) return;
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
          if (isArr(o.pending_invites)) state.invites = o.pending_invites.slice();
          state.hatDaten = true;
          state.fehler = null;
        } else {
          state.members = []; state.hatDaten = false;
          state.fehler = "members";
        }
        state.busy = false;
        render();
      }
      function setInvites(p) {
        var o = (p && typeof p === "object") ? p : UC.readBubble(p);
        var liste = isArr(o) ? o : (o && isArr(o.invites) ? o.invites : null);
        if (liste) {
          /* Nur OFFENE: der Server schickt in dieser Nutzlast auch zurueckgezogene und
             angenommene mit (revoked_at / accepted_at gesetzt). Die gehoeren ins Protokoll, nicht
             in eine Liste, die "Pending" heisst. */
          state.invites = liste.filter(function (v) {
            if (!v || typeof v !== "object") return false;
            if (feld(v.revoked_at) || feld(v.accepted_at)) return false;
            var st = String(v.status == null ? "" : v.status).trim().toLowerCase();
            return !st || st === "pending";
          });
        } else if (window.console) {
          console.warn("[team-orga] " + instanceId + ": setTeamOrgaInvites konnte die Nutzlast " +
            "nicht lesen. Die Liste der offenen Einladungen bleibt, wie sie war.");
        }
        state.busy = false;
        render();
      }
      function setLog(p) {
        var o = (p && typeof p === "object") ? p : UC.readBubble(p);
        var liste = isArr(o) ? o : (o && isArr(o.logs) ? o.logs : (o && isArr(o.entries) ? o.entries : null));
        if (liste) {
          /* Neueste zuerst. Der RPC liefert es schon so, aber eine Liste, deren Reihenfolge man
             annimmt, ist eine Liste, die eines Tages verkehrt steht. */
          state.log = liste.slice().sort(function (a, b) {
            return new Date(txt(b && b.created_at)).getTime() - new Date(txt(a && a.created_at)).getTime();
          });
        } else if (window.console) {
          console.warn("[team-orga] " + instanceId + ": setTeamOrgaLog konnte die Nutzlast nicht " +
            "lesen. Das Protokoll bleibt, wie es war.");
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
          state.hatDaten = false; state.fehler = null; state.busy = false;
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
      roots = roots.filter(function (r) {
        var rid = String(r.getAttribute("data-instance") || "default");
        return id === "default" ? true : (rid === id || rid.indexOf(id) === 0);
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
