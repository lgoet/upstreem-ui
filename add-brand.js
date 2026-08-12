/* upstreem add-brand.js — der "Add Brand"-Dialog. Braucht core.js (window.UpstreemCore) zuerst.

   Wie add-prompts hat diese Komponente KEIN eigenes sichtbares Element. Sie stellt
   window.openAddBrand() bereit und baut ihren Dialog beim ersten Aufruf nach <body>. Der Grund ist
   derselbe: der Ausloeser existiert schon (der Add-Knopf im Brands-Seitenkopf), und der will kein
   zweites HTML-Element nur als Wirt fuer einen Dialog.

   ── Was aus core kommt ──────────────────────────────────────────────────────
     Schale (Overlay, z-index, Scrim, Radius, Schatten)  .up-topicmodal-backdrop / -card
     Primaerknopf                                        .up-topicmodal-save
     Fokus-Ring der Felder                               --up-focus-Tokens
     Event nach Bubble (team_id, JSON, DOM-Fallback)     UC.makeFire

   ── Vorausgefuellt oeffnen ──────────────────────────────────────────────────
       openAddBrand({ name: "Apple", domain: "apple.com" });
   Beide Felder bleiben editierbar. Die Domain laeuft dabei durch dieselbe Normalisierung wie eine
   Eingabe von Hand, ein voller Link aus einem RPC landet also schon sauber im Feld. */
(function () {
  "use strict";

  var API_NAMES = ["openAddBrand", "closeAddBrand", "resetAddBrand"];
  var Q = (window.__uabBootQueue = window.__uabBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  var MAX_NAME = 75;
  var MAX_DOMAIN = 300;

  var ICON = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>'
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

    var MISSING = ["makeFire", "esc"].filter(function (k) { return typeof UC[k] !== "function"; });
    if (MISSING.length && window.console) {
      console.error("[add-brand] The core.js on this page is OLDER than add-brand.js and is missing: " +
        MISSING.join(", ") + ". Pin every upstreem component on a page to the same commit.");
    }

    var M = null, fire = null, isOpen = false, opener = null;
    var S = { name: "", domain: "", touched: false };

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
      s = s.replace(/\.+$/, "");                       // Punkt am Ende
      return s;
    }

    /* Bewusst keine TLD-Liste: die veraltet, und ein Tippfehler in der Liste sperrt eine echte
       Marke aus. Geprueft wird die FORM -- mindestens ein Punkt, erlaubte Zeichen, kein Bindestrich
       am Label-Rand, Endung mindestens zwei Buchstaben. Das faengt "apple", "apple." und
       "app le.com" ab und laesst alles Echte durch, auch .co.uk und Umlautdomains in Punycode. */
    var DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
    function domainOk(d) { return !!d && d.length <= MAX_DOMAIN && DOMAIN_RE.test(d); }

    function faviconFor(d) {
      return d ? "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(d) + "&sz=64" : "";
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

          '<div class="uab-foot">' +
            '<button type="button" class="uab-cancel" data-act="close">Cancel</button>' +
            '<button type="button" class="up-topicmodal-save" data-act="add">Add Brand</button>' +
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
        fav: back.querySelector("[data-fav]")
      };

      /* eventPrefix "uab-", damit das DOM-Ersatzereignis uab-bubble_fn_uabAddBrand heisst -- im
         Gleichschritt mit jeder anderen Komponente. */
      fire = UC.makeFire(back, "uab", { eventPrefix: "uab-" });

      back.addEventListener("click", function (e) {
        if (e.target === back) { close(); return; }          // Klick auf den Scrim
        var act = e.target.closest("[data-act]");
        if (!act) return;
        if (act.getAttribute("data-act") === "close") close();
        else if (act.getAttribute("data-act") === "add") submit();
      });

      M.name.addEventListener("input", function () {
        S.name = M.name.value;
        renderCount();
        if (S.touched) validate();
      });
      M.domain.addEventListener("input", function () {
        S.domain = M.domain.value;
        renderFav();
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

    function onKey(e) { if (e.key === "Escape" && isOpen) close(); }

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
      var url = domainOk(d) ? faviconFor(d) : "";
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
      renderCount(); renderFav();
      M.card.classList.remove("is-saving");

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
      document.removeEventListener("keydown", onKey);
      M.back.classList.add("is-closing");
      M.back.classList.remove("is-shown");
      setTimeout(function () { if (M) M.back.classList.remove("is-closing"); }, 160);
      try { if (opener && opener.focus) opener.focus(); } catch (e) {}
    }

    function submit() {
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
        domain: normDomain(M.domain.value).slice(0, MAX_DOMAIN)
      };

      /* makeFire und nicht resolveBubbleFn: nur makeFire stellt team_id voran, macht EINEN
         JSON-String daraus (STYLEGUIDE 13), warnt genau einmal wenn niemand zuhoert, und
         verschickt das DOM-Ersatzereignis. */
      fire("data-add-fn", "bubble_fn_uabAddBrand", payload);
      close();
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
