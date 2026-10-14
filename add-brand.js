/* upstreem add-brand.js — der "Add Brand"-Dialog. Braucht core.js (window.UpstreemCore) zuerst.

   Wie add-prompts hat diese Komponente KEIN eigenes sichtbares Element. Sie stellt
   window.openAddBrand() bereit und baut ihren Dialog beim ersten Aufruf nach <body>. Der Grund ist
   derselbe: der Ausloeser existiert schon (der Add-Knopf im Brands-Seitenkopf), und der will kein
   zweites HTML-Element nur als Wirt fuer einen Dialog.

   ── Was aus core kommt ──────────────────────────────────────────────────────
     Schale (Overlay, z-index, Scrim, Radius, Schatten)  .up-topicmodal-backdrop / -card
     Primaerknopf                                        .up-topicmodal-save
     Fokus-Ring der Felder                               --up-focus-Tokens
     Speichern, Team, Marken-Ablage                      UC.rpc, UC.teamWarten, UC.markenNachladen

   ── Speichern (seit 13.10.: EIN Weg) ────────────────────────────────────────
   Der Dialog speichert selbst ueber brand_add_v1 (Vertrag brands_v1_vertrag.md 6.3, Fehler 11.3),
   auf jeder Seite. Vorher ging es ausserhalb der Brands-Seite ueber bubble_fn_uabAddBrand, einen
   Bubble-Workflow und n8n an add_competitor_v4 -- dieses Ereignis feuert NICHT mehr. Danach:
     - der Toast ("Brand added" / "Brand activated again", schon da: Hinweis statt Fehler);
     - window-Ereignis up-brand-added {name, domain, company_id} (Explore Brands nimmt die Zeile
       raus, die Brands-Seite laedt neu). Es ist ABBRECHBAR: wer die Marken-Ablage selbst neu
       fuellt (die Brands-Seite), ruft preventDefault(), sonst fuellt der Dialog sie ueber
       UC.markenNachladen -- so laeuft brands_page_meta_v1 nie doppelt.
   Fehler stehen als Satz unter den Feldern, Feldfehler (hint p_name:/p_domain:) am Feld.
   addBrandSuccess()/addBrandError() bleiben oeffentlich, damit ein alter Bubble-Workflow, der
   noch auf einer Seite steht, nicht ins Leere ruft. openAddBrand({ onSubmit }) und
   setAddBrandSubmit(fn) gehen weiterhin vor, falls eine Seite das Speichern doch selbst will.

   ── Vorausgefuellt oeffnen ──────────────────────────────────────────────────
       openAddBrand({ name: "Apple", domain: "apple.com" });
   Beide Felder bleiben editierbar. Die Domain laeuft dabei durch dieselbe Normalisierung wie eine
   Eingabe von Hand, ein voller Link aus einem RPC landet also schon sauber im Feld. */
(function () {
  "use strict";

  var API_NAMES = ["openAddBrand", "closeAddBrand", "resetAddBrand", "addBrandSuccess", "addBrandError", "setAddBrandSubmit"];
  var Q = (window.__uabBootQueue = window.__uabBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  var MAX_NAME = 75;
  var MAX_DOMAIN = 300;

  /* Notbremse fuer den Ladezustand. Der Bubble-Workflow antwortet mit addBrandSuccess() oder
     addBrandError(); tut er beides nicht -- Workflow abgebrochen, RPC im Timeout, Schritt
     vergessen --, haenge der Dialog sonst unbegrenzt im Spinner und der Nutzer koennte weder
     abbrechen noch es erneut versuchen. Nach dieser Zeit endet der Ladezustand von selbst und
     sagt, dass die Marke TROTZDEM angelegt worden sein kann: alles andere waere geraten. */
  var TIMEOUT_MS = 20000;

  var ICON = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12C8 18 12 22 12 22C12 22 16 18 16 12C16 6 12 2 12 2C12 2 8 6 8 12Z"/><path d="M21 15H3"/><path d="M21 9H3"/></svg>'
  };

  function uabBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { uabBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[add-brand] UpstreemCore (core.js) not loaded");
      return;
    }
    uabRun();
  }

  function uabRun() {
    var UC = window.UpstreemCore;
    var esc = UC.esc;

    var MISSING = ["rpc", "esc"].filter(function (k) { return typeof UC[k] !== "function"; });
    if (MISSING.length && window.console) {
      console.error("[add-brand] The core.js on this page is OLDER than add-brand.js and is missing: " +
        MISSING.join(", ") + ". Pin every upstreem component on a page to the same commit.");
    }

    var M = null, isOpen = false, opener = null;
    var zuletzt = null;   /* der zuletzt abgeschickte Eintrag, fuer up-brand-added */
    var S = { name: "", domain: "", touched: false, saving: false, abgabe: null };
    /* SEITE STATT BUBBLE (11.10., Brands-Seite). Eine Seiten-Komponente kann das Speichern selbst
       uebernehmen (direkt in der Datenbank): entweder je Aufruf (openAddBrand({ onSubmit })) oder
       dauerhaft, solange sie auf der Seite steht (window.setAddBrandSubmit(fn, wurzel)) -- Letzteres,
       weil auch Explore Brands den Dialog oeffnet (Track) und von der Seite nichts weiss.
       fn(payload) liefert { ok: true } oder { ok: false, fehler: "Satz" } (auch als Promise). */
    var ABGABE = { fn: null, wurzel: null };

    /* ---------------------------------------------------------------------
       Domain: normalisieren und pruefen
       --------------------------------------------------------------------- */

    /* Ersetzt die Kette aus Find&Replace, die bisher in Bubble stand (https:// weg, www. weg,
       Schraegstrich am Ende weg) -- und macht zusaetzlich das, was diese Kette NICHT konnte:
       einen Pfad abschneiden. Das Feld sagt "Primary path - not a subpage", also gehoert
       apple.com/de/store als apple.com ins Feld und nicht als Fehler. Query und Fragment fallen
       aus demselben Grund weg. */
    function normDomain(v) {
      var s = String(v == null ? "" : v).trim().toLowerCase();
      if (!s) return "";
      s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");   // jedes Schema, nicht nur https
      s = s.replace(/^www\./, "");
      s = s.split(/[\/?#]/)[0];                        // Pfad, Query, Fragment
      s = s.replace(/:\d*$/, "");                      // Port (Vertrag Brands v1: die DB nimmt ihn auch weg)
      s = s.replace(/\.+$/, "");                       // Punkt am Ende
      return s;
    }
    /* DIE DOMAIN, WIE DIE DATENBANK SIE WILL (11.10., Vertrag Brands v1 6.5): nur ASCII -- eine
       Umlautdomain geht als Punycode hinaus, und die Oberflaeche wandelt sie (new URL macht genau
       das). Im FELD bleibt die lesbare Form stehen: "müller.de" soll nach dem Verlassen nicht als
       "xn--mller-kva.de" dastehen. Geprueft, gespeichert und fuers Favicon benutzt wird die ASCII-
       Form. Kann der Browser sie nicht bilden, bleibt die Eingabe -- die Pruefung sagt dann nein. */
    function asciiDomain(d) {
      d = String(d == null ? "" : d);
      if (!d || /^[\x00-\x7f]*$/.test(d)) return d;
      try { return new URL("http://" + d).hostname.replace(/\.+$/, ""); } catch (e) { return d; }
    }

    /* Bewusst keine TLD-Liste: die veraltet, und ein Tippfehler in der Liste sperrt eine echte
       Marke aus. Geprueft wird die FORM -- mindestens ein Punkt, erlaubte Zeichen, kein Bindestrich
       am Label-Rand, Endung mindestens zwei Buchstaben. Das faengt "apple", "apple." und
       "app le.com" ab und laesst alles Echte durch, auch .co.uk und Umlautdomains in Punycode. */
    /* Endung: Buchstaben ODER eine Punycode-Endung (xn--...), wie die Datenbank es prueft. */
    var DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.(?:[a-z]{2,}|xn--[a-z0-9-]+)$/;
    /* Labels hoechstens 63, alles hoechstens 253 Zeichen -- dieselben Grenzen wie in der DB. */
    function domainOk(d) {
      d = asciiDomain(d);
      if (!d || d.length > Math.min(MAX_DOMAIN, 253) || !DOMAIN_RE.test(d)) return false;
      return d.split(".").every(function (l) { return l.length <= 63; });
    }

    /* fremdUrl: in der App ueber die eigene Adresse (core, Datenschutz 14.10.). */
    function faviconFor(d) {
      var u = d ? "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(d) + "&sz=64" : "";
      return u && UC.fremdUrl ? UC.fremdUrl(u) : u;
    }

    /* ---------------------------------------------------------------------
       Aufbau
       --------------------------------------------------------------------- */
    function build() {
      var back = document.createElement("div");
      /* up-root, damit core's Theme-Sweep ihn findet; up-portal, weil er im <body> ausserhalb
         jeder Komponentenwurzel lebt -- setUpstreemTheme() sucht genau diese beiden. */
      back.className = "up-root up-portal up-topicmodal-backdrop uab-backdrop";
      back.setAttribute("role", "dialog");
      back.setAttribute("aria-modal", "true");
      back.setAttribute("aria-label", "Add brand");
      back.innerHTML =
        '<div class="up-topicmodal-card uab-card">' +

          '<div class="uab-head">' +
            '<div class="uab-heading">' +
              '<div class="uab-title">Add Brand</div>' +
              '<div class="uab-sub">Add a new Brand to track in your AI answers</div>' +
            '</div>' +
            '<button type="button" class="up-popup-close" data-act="close" aria-label="Close">' + ICON.x + '</button>' +
          '</div>' +

          '<div class="uab-body">' +

            '<div class="uab-field" data-field="name">' +
              '<div class="uab-labelwrap">' +
                '<label class="uab-label" for="uab-name">Name</label>' +
                '<div class="uab-hint">The primary brand name - exclude legal forms like GmbH, Inc., Ltd, etc.</div>' +
              '</div>' +
              '<span class="uab-inwrap">' +
                '<input class="uab-in" id="uab-name" data-in="name" type="text" placeholder="e.g. Apple" ' +
                  'maxlength="' + MAX_NAME + '" autocomplete="off" spellcheck="false" />' +
              '</span>' +
              '<div class="uab-count" data-count>0/' + MAX_NAME + '</div>' +
              '<div class="uab-err" data-err></div>' +
            '</div>' +

            '<div class="uab-field" data-field="domain">' +
              '<div class="uab-labelwrap">' +
                '<label class="uab-label" for="uab-domain">Domain</label>' +
                '<div class="uab-hint">The main domain. Primary path - not a subpage</div>' +
              '</div>' +
              '<span class="uab-inwrap has-icon">' +
                '<span class="uab-fav" data-fav aria-hidden="true">' + ICON.globe + '</span>' +
                '<input class="uab-in" id="uab-domain" data-in="domain" type="text" placeholder="e.g. apple.com" ' +
                  'maxlength="' + MAX_DOMAIN + '" autocomplete="off" spellcheck="false" ' +
                  'inputmode="url" />' +
              '</span>' +
              '<div class="uab-err" data-err></div>' +
            '</div>' +

          '</div>' +

          /* Die Fehlermeldung des Workflows steht UNTER den Feldern, direkt ueber der Fusszeile:
             sie gehoert zum Absenden, nicht zu einem einzelnen Feld. */
          '<div class="uab-formerr" data-formerr></div>' +

          '<div class="uab-foot">' +
            '<button type="button" class="uab-cancel" data-act="close">Cancel</button>' +
            '<button type="button" class="up-topicmodal-save uab-save" data-act="add">' +
              '<span class="uab-spin" aria-hidden="true"></span>' +
              '<span data-savelabel>Add Brand</span>' +
            '</button>' +
          '</div>' +

        '</div>';

      document.body.appendChild(back);

      M = {
        back: back,
        card: back.querySelector(".uab-card"),
        name: back.querySelector('[data-in="name"]'),
        domain: back.querySelector('[data-in="domain"]'),
        fName: back.querySelector('[data-field="name"]'),
        fDomain: back.querySelector('[data-field="domain"]'),
        count: back.querySelector("[data-count]"),
        fav: back.querySelector("[data-fav]"),
        save: back.querySelector(".uab-save"),
        formErr: back.querySelector("[data-formerr]")
      };

      back.addEventListener("click", function (e) {
        if (e.target === back) { close(); return; }          // Klick auf den Scrim
        var act = e.target.closest("[data-act]");
        if (!act) return;
        if (act.getAttribute("data-act") === "close") close();
        else if (act.getAttribute("data-act") === "add") submit();
      });

      M.name.addEventListener("input", function () {
        S.name = M.name.value;
        renderCount(); setFormErr("");
        if (S.touched) validate();
      });
      M.domain.addEventListener("input", function () {
        S.domain = M.domain.value;
        renderFav(); setFormErr("");
        if (S.touched) validate();
      });
      /* Erst beim Verlassen normalisieren, nicht bei jedem Tastendruck: waehrend des Tippens
         wuerde ein "https://" verschwinden, sobald der Doppelpunkt steht, und der Cursor spraenge.
         Beim Einfuegen eines Links ist das Verlassen des Feldes frueh genug. */
      M.domain.addEventListener("blur", function () {
        var n = normDomain(M.domain.value);
        if (n !== M.domain.value) { M.domain.value = n; S.domain = n; renderFav(); }
        if (S.touched) validate();
      });
      M.domain.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } });
      M.name.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); M.domain.focus(); } });
    }

    /* Escape schliesst nicht, waehrend der Workflow laeuft: der Klick ist ueber .is-saving
       ohnehin gesperrt, und ein offener Weg nur ueber die Tastatur waere ein Zustand, den man
       versehentlich trifft und in dem man dann nicht mehr erfaehrt, ob es geklappt hat. */
    function onKey(e) { if (e.key === "Escape" && isOpen && !S.saving) close(); }

    /* ---------------------------------------------------------------------
       Rendern
       --------------------------------------------------------------------- */
    function renderCount() {
      var n = M.name.value.length;
      M.count.textContent = n + "/" + MAX_NAME;
      M.count.classList.toggle("is-full", n >= MAX_NAME);
    }
    /* Das Favicon haengt an der NORMALISIERTEN Domain, nicht am Rohtext: sonst laedt es beim
       Tippen von "https://www.apple.com" dreimal fuer drei verschiedene Zwischenstaende. Erst ab
       einer formal gueltigen Domain wird ueberhaupt geladen -- vorher steht der Globus, und der
       ist ehrlicher als ein gebrochenes Bild. */
    function renderFav() {
      var d = normDomain(M.domain.value);
      var url = domainOk(d) ? faviconFor(asciiDomain(d)) : "";
      if (M.fav.getAttribute("data-src") === url) return;   // nicht bei jedem Tastendruck neu laden
      M.fav.setAttribute("data-src", url);
      if (!url) { M.fav.innerHTML = ICON.globe; return; }
      /* Das <img> wird gebaut, nicht als HTML-Text zusammengesetzt. Der Rueckfall auf den Globus
         hing vorher in einem inline onerror="...", und darin steckte das SVG als String -- dessen
         erstes DOPPELTES Anfuehrungszeichen (viewBox="0 0 24 24") beendete das Attribut, und der
         Rest des SVG landete als Muell-Attribute im img-Tag. Sichtbar wurde davon ein Stueck
         Text neben dem Favicon. Escapen waere hier das falsche Pflaster: ein Handler gehoert an
         das Element, nicht in einen String. */
      M.fav.innerHTML = "";
      var img = document.createElement("img");
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.onerror = function () { M.fav.innerHTML = ICON.globe; };
      img.src = url;
      M.fav.appendChild(img);
    }

    function setErr(field, msg) {
      field.classList.toggle("is-err", !!msg);
      field.querySelector("[data-err]").textContent = msg || "";
    }
    /* Die Meldung des Workflows, unter den Feldern. Getrennt von den Feldfehlern: die sagen "das
       hast du falsch eingegeben", diese sagt "der Server konnte es nicht anlegen". */
    function setFormErr(msg) {
      if (!M) return;
      M.formErr.textContent = msg || "";
      M.card.classList.toggle("has-formerr", !!msg);
    }

    var saveTimer = null;
    function setSaving(on) {
      S.saving = !!on;
      M.card.classList.toggle("is-saving", S.saving);
      M.save.disabled = S.saving;
      M.back.querySelector("[data-savelabel]").textContent = S.saving ? "Adding…" : "Add Brand";
      clearTimeout(saveTimer);
      if (S.saving) {
        setFormErr("");
        saveTimer = setTimeout(function () {
          if (!S.saving) return;
          setSaving(false);
          setFormErr("No answer from the server. The brand may still have been created. Close this and refresh before trying again.");
        }, TIMEOUT_MS);
      }
    }

    /* Liefert true, wenn alles passt. Faerbt dabei die Felder ein -- beides in einer Funktion,
       damit "geprueft" und "angezeigt" nicht auseinanderlaufen koennen. */
    function validate() {
      var name = M.name.value.trim();
      var dom = normDomain(M.domain.value);
      var okName = !!name;
      var okDom = domainOk(dom);
      setErr(M.fName, okName ? "" : "Enter a brand name.");
      setErr(M.fDomain, !dom ? "Enter a domain."
                        : (dom.length > MAX_DOMAIN ? "This domain is too long."
                        : (okDom ? "" : "That does not look like a domain. Example: apple.com")));
      return okName && okDom;
    }

    /* ---------------------------------------------------------------------
       Oeffnen / Schliessen / Absenden
       --------------------------------------------------------------------- */
    function open(opts) {
      opts = opts || {};
      if (!M) build();

      /* Vorausgefuellt oder leer -- beides derselbe Weg. Die Domain laeuft durch dieselbe
         Normalisierung wie eine Eingabe von Hand, ein voller Link aus einem RPC steht also schon
         sauber im Feld statt als "https://www.x.de/" darauf zu warten, dass jemand hineinklickt. */
      M.name.value = String(opts.name == null ? "" : opts.name).slice(0, MAX_NAME);
      M.domain.value = normDomain(opts.domain).slice(0, MAX_DOMAIN);
      S.name = M.name.value; S.domain = M.domain.value; S.touched = false;

      setErr(M.fName, ""); setErr(M.fDomain, "");
      setFormErr(""); setSaving(false);
      renderCount(); renderFav();
      S.abgabe = typeof opts.onSubmit === "function" ? opts.onSubmit : null;

      opener = document.activeElement;
      isOpen = true;
      M.back.classList.remove("is-closing");
      M.back.classList.add("is-shown");
      document.addEventListener("keydown", onKey);
      /* Steht schon ein Name, geht der Fokus ins Domainfeld: wer vorausgefuellt oeffnet, will
         meist nur noch bestaetigen und soll nicht erst den Namen wegtabben. */
      setTimeout(function () { (M.name.value ? M.domain : M.name).focus(); }, 40);
    }

    function close() {
      if (!M || !isOpen) return;
      isOpen = false;
      setSaving(false);                 // raeumt auch die Notbremse ab
      document.removeEventListener("keydown", onKey);
      M.back.classList.add("is-closing");
      M.back.classList.remove("is-shown");
      setTimeout(function () { if (M) M.back.classList.remove("is-closing"); }, 160);
      try { if (opener && opener.focus) opener.focus(); } catch (e) {}
    }

    function submit() {
      if (S.saving) return;             // kein Doppelklick waehrend der Workflow laeuft
      S.touched = true;                 // ab jetzt zeigen die Felder Fehler auch beim Tippen
      if (!validate()) {
        var bad = M.back.querySelector(".uab-field.is-err .uab-in");
        if (bad) bad.focus();
        return;
      }
      /* Beim Absenden noch einmal kappen. maxlength gilt nur fuer Tippeingaben -- ein per
         JS gesetzter Wert laeuft daran vorbei, und dann traegt das Event mehr als das Limit. */
      var payload = {
        name: M.name.value.trim().slice(0, MAX_NAME),
        domain: asciiDomain(normDomain(M.domain.value)).slice(0, MAX_DOMAIN)
      };

      setSaving(true);
      zuletzt = payload;
      /* Eine Seite, die das Speichern selbst uebernimmt, geht vor (siehe Kopf); sonst speichert
         der Dialog. Beide enden in denselben zwei Wegen. Der Dialog schliesst erst mit der
         Antwort: ein Dialog, der sofort zugeht, behauptet einen Erfolg, den noch niemand kennt. */
      var abgabe = S.abgabe || ((ABGABE.fn && (!ABGABE.wurzel || ABGABE.wurzel.isConnected)) ? ABGABE.fn : selbstAnlegen);
      var r;
      try { r = abgabe({ name: payload.name, domain: payload.domain }); } catch (e) { r = null; }
      Promise.resolve(r).then(function (erg) {
        if (!isOpen || !S.saving) return;
        if (erg && erg.ok) {
          if (erg.company_id && zuletzt) zuletzt.company_id = erg.company_id;
          window.addBrandSuccess();
          return;
        }
        /* Ein Feldfehler der DB (hint p_name:/p_domain:) steht am Feld, nicht unter dem Formular. */
        if (erg && erg.feld) {
          setSaving(false);
          setErr(erg.feld === "name" ? M.fName : M.fDomain, erg.fehler || "");
          (erg.feld === "name" ? M.name : M.domain).focus();
          return;
        }
        window.addBrandError(erg && erg.fehler);
      }, function () { if (isOpen && S.saving) window.addBrandError(""); });
    }

    /* ---------------------------------------------------------------------
       Speichern ueber brand_add_v1 (Vertrag 6.3; Fehler 11.3, Saetze wie auf der Brands-Seite)
       --------------------------------------------------------------------- */
    function t(x) { return UC.t ? UC.t(x) : x; }
    function toast(text, art, zusatz) {
      if (UC.toast) { try { UC.toast(text, { kind: art || "success", desc: zusatz || "" }); } catch (e) {} }
    }
    /* Ein Satz aus Code und hint. Zwei Saetze (Was, und was jetzt) in einer Zeile, weil der
       Dialog nur eine Fehlerzeile hat; der erste steht im Katalog ohne Punkt (er ist sonst
       Toast-Titel), darum der Punkt hier. */
    function fehlerSatz(erg) {
      var f = erg && erg.fehler ? erg.fehler : {}, m = String(f.message || ""), h = String(f.hint || "");
      var n = (/-?\d+/.exec(h) || [])[0];
      function zwei(a, b) { return t(a) + (b ? ". " + b : ""); }
      if (/daily_limit/.test(m)) {
        return zwei("Daily limit reached", /^tracked:/.test(h) && n && Number(n) > 0
          ? t("You can add or activate {n} more brands today.").replace("{n}", n) : t("Please try again tomorrow."));
      }
      if (/delete_pending/.test(m)) return zwei("This brand is still being removed", t("Please try again in a few minutes."));
      if (/inactive:/.test(h) && /limit_reached/.test(m)) return zwei("Too many inactive brands", t("Delete inactive brands you no longer need, then try again."));
      if (/limit_reached/.test(m)) {
        return zwei("Not enough room in your plan", n && Number(n) > 0
          ? t("{n} more brands fit into your plan.").replace("{n}", n) : t("Set brands inactive or upgrade your plan."));
      }
      if (/own_brand/.test(m)) return t("This is your own brand");
      if (/forbidden/.test(m) || /^team_access_/.test(m)) return zwei("You don't have permission for this", t("Refresh the page and try again."));
      if (/rate_limited/.test(m) || (erg && erg.status === 429)) return zwei("Too many requests", t("Please wait a moment and try again."));
      if (/invalid_param/.test(m)) return t("Please check the name and domain");
      return t("The brand could not be added");
    }
    function selbstAnlegen(p) {
      if (!UC.rpc) return Promise.resolve({ ok: false, fehler: t("The brand could not be added") });
      var warten = UC.teamWarten ? UC.teamWarten(10000) : Promise.resolve(UC.getTeam ? UC.getTeam() : "");
      return warten.then(function (team) {
        if (!team) return { ok: false, fehler: t("The brand could not be added") };
        return UC.rpc("brand_add_v1", { p_team: team, p_name: p.name, p_domain: p.domain }, { timeoutMs: 30000 }).then(function (erg) {
          var f = erg && !erg.ok && erg.fehler ? erg.fehler : null, m = f ? String(f.message || "") : "", h = f ? String(f.hint || "") : "";
          /* Schon da (gleiche Domain oder gleicher Name): kein Fehlschlag -- zu, mit Hinweis. So
             faengt sich auch ein doppelter Klick ab. */
          if (/duplicate/.test(m)) { toast(t("This brand is already in your account"), "neutral"); return { ok: true }; }
          if (f) {
            if (/invalid_param/.test(m) && /^p_name/.test(h)) return { ok: false, feld: "name", fehler: t("Use 1 to 75 characters, with at least one letter or digit.") };
            if (/invalid_param/.test(m) && /^p_domain/.test(h)) return { ok: false, feld: "domain", fehler: t("Enter a valid domain, for example apple.com") };
            return { ok: false, fehler: fehlerSatz(erg) };
          }
          var d = erg && erg.daten;
          if (Object.prototype.toString.call(d) === "[object Array]") d = d[0];
          if (!d || typeof d !== "object") return { ok: false, fehler: t("The brand could not be added") };
          var meta = d.meta && typeof d.meta === "object" ? d.meta : {}, row = d.row && typeof d.row === "object" ? d.row : {};
          toast(t(String(meta.action) === "reactivated" ? "Brand activated again" : "Brand added"), "success",
                meta.rewritten === true ? t("Special characters were removed from the name.") : "");
          return { ok: true, company_id: row.company_id != null ? String(row.company_id) : "" };
        });
      }).then(null, function () { return { ok: false, fehler: t("The brand could not be added") }; });
    }

    /* ---------------------------------------------------------------------
       Oeffentliche API
       --------------------------------------------------------------------- */
    window.openAddBrand = function (opts) {
      /* Bubble reicht Run-JS-Werte gern als String durch (STYLEGUIDE 47). Ein String wird als
         JSON gelesen; klappt das nicht, ist es ein leerer Aufruf und kein Absturz. */
      if (typeof opts === "string") {
        try { opts = JSON.parse(opts); } catch (e) { opts = {}; }
      }
      open(opts);
    };
    window.closeAddBrand = function () { close(); };
    window.setAddBrandSubmit = function (fn, wurzel) {
      ABGABE.fn = typeof fn === "function" ? fn : null;
      ABGABE.wurzel = ABGABE.fn && wurzel ? wurzel : null;
    };

    /* Die beiden Antworten des Workflows. Beide beenden den Ladezustand -- der Unterschied ist
       nur, ob der Dialog zugeht oder mit einer Meldung stehen bleibt. */
    /* Nach dem Erfolg sagt der Dialog der App, WAS angelegt wurde (05.10.): Explore Brands nimmt
       die Zeile dann aus der Liste der unbeobachteten Marken. */
    window.addBrandSuccess = function () {
      if (!M) return;
      setSaving(false); close();
      if (zuletzt) {
        var ev = null;
        try {
          ev = new CustomEvent("up-brand-added", { cancelable: true,
            detail: { name: zuletzt.name, domain: zuletzt.domain, company_id: zuletzt.company_id || "" } });
          window.dispatchEvent(ev);
        } catch (e) { ev = null; }
        /* Hat niemand die Ablage selbst neu gefuellt (preventDefault, siehe Kopf), tut es der
           Dialog -- sonst fehlt die neue Marke in Seitenleiste, Filtern und Menues. */
        if (!(ev && ev.defaultPrevented) && UC.markenNachladen) UC.markenNachladen();
        zuletzt = null;
      }
    };
    window.addBrandError = function (msg) {
      if (!M) return;
      setSaving(false);
      /* Ein leerer Aufruf darf nicht in einem stillen Dialog enden: dann steht wenigstens da,
         DASS es nicht geklappt hat. */
      var t = String(msg == null ? "" : msg).trim();
      setFormErr(t || "Could not add this brand. Please try again.");
      M.name.focus();
    };
    window.resetAddBrand = function () {
      if (!M) return;
      M.name.value = ""; M.domain.value = "";
      S.name = ""; S.domain = ""; S.touched = false;
      setErr(M.fName, ""); setErr(M.fDomain, "");
      renderCount(); renderFav();
    };

    /* Alles nachholen, was vor dem Laden dieser Datei aufgerufen wurde. */
    if (Q.length) {
      Q.splice(0, Q.length).forEach(function (c) {
        var f = window[c[0]];
        if (typeof f === "function") { try { f.apply(null, c[1]); } catch (e) {} }
      });
    }
  }

  uabBoot(50);
})();
