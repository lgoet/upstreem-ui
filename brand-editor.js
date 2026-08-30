/* upstreem brand-editor.js — der Editor fuer EINE getrackte Marke. Braucht core.js
   (window.UpstreemCore) davor, wie jede Komponente dieser Familie.

   Was hier steht und warum es eine eigene Komponente ist: settings-brand ist die Seite fuer die
   EIGENE Marke und sagt selbst, dass Name und Aliase dort aussen vor bleiben ("der Editor dafuer
   ist ein eigener Dialog auf Bubble-Seite"). Das ist dieser Dialog -- fuer jede getrackte Marke,
   also auch fuer Wettbewerber.

   Aufbau von oben:
     1. Kopf       Favicon, Label, Name mit Umbenennen-Knopf, Domain
     2. Aliase     Beschreibung, Eingabe + Add, Tabelle (Alias | Active | Delete)
     3. Farbe      Farbwaehler mit Hex-Eingabe + Save
     4. Zeitraeume Tabelle (Starting Date | Ending Date | Reason)

   Was aus core kommt und hier NICHT noch einmal entsteht:
     .up-table/.up-thead/.up-row/.up-th/.up-td   die Tabelle, beide Male
     .up-switch                                  der Aktiv-Schalter
     .up-iconbtn / .up-btn-sec / .up-btn-pri     alle drei Knopfformen
     .up-field                                   das Eingabefeld
     .up-fav                                     der Favicon-Kasten samt Globus-Rueckfall
     .up-empty                                   der Leerzustand
     UC.readBubble / makeMount / makeLate / makeFire / esc / fmtDate / icon / themeParam
   Der Aufbau der Abschnitte (Titel, Unterzeile, Karte) ist der von settings-brand, Wert fuer
   Wert -- die beiden stehen in derselben Ecke der App und sollen sich nicht unterscheiden.

   Der Farbwaehler ist Coloris (MIT, 14,5 KB, keine Abhaengigkeiten). Nicht selbst gebaut: ein
   Farbwaehler mit Hex-Feld, Tastaturbedienung und Dunkelmodus ist ein eigenes kleines Projekt.
   Er wird EINMAL PRO SEITE geladen, wie Chart.js in core -- und wenn er nicht kommt, bleibt das
   Hex-Feld ein normales Textfeld, in das man #1f6feb tippen kann. Kein stiller Ausfall. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung -----------------------------------
     Bubble ruft die Setter aus einem Workflow, der neben dem Laden dieser Datei laeuft. Ohne
     Stubs wirft der erste Aufruf und reisst den ganzen Run-JS-Step mit. */
  var API_NAMES = ["setBrandEditor", "setBrandEditorLoading", "resetBrandEditor"];
  var Q = (window.__ubeBootQueue = window.__ubeBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function ubeBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { ubeBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    ubeStart();
  }

  function ubeStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc;
  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function txt(v) { return v == null ? "" : String(v); }

  /* ---- Coloris, einmal pro Seite ------------------------------------------------------------
     Zwei Instanzen des Editors auf einer Seite duerfen die Datei nicht zweimal einhaengen; der
     zweite Aufruf wartet auf denselben Ladevorgang. Genau der Weg, den core fuer Chart.js geht. */
  var COLORIS_V = "0.25.0";
  var COLORIS_JS  = "https://cdn.jsdelivr.net/npm/@melloware/coloris@" + COLORIS_V + "/dist/umd/coloris.min.js";
  var COLORIS_CSS = "https://cdn.jsdelivr.net/npm/@melloware/coloris@" + COLORIS_V + "/dist/coloris.min.css";
  function ladeColoris() {
    if (window.Coloris) return Promise.resolve(true);
    if (window.__ubeColoris) return window.__ubeColoris;
    window.__ubeColoris = new Promise(function (res) {
      if (!document.querySelector('link[data-ube-coloris]')) {
        var l = document.createElement("link");
        l.rel = "stylesheet"; l.href = COLORIS_CSS; l.setAttribute("data-ube-coloris", "1");
        document.head.appendChild(l);
      }
      var s = document.createElement("script");
      s.src = COLORIS_JS; s.async = true;
      s.onload  = function () { res(!!window.Coloris); };
      /* Kein throw und kein Fehler in der Konsole des Nutzers: das Hex-Feld funktioniert auch
         ohne die Datei, und der Editor soll deswegen nicht stehenbleiben. */
      s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
    return window.__ubeColoris;
  }

  /* Bubble schickt die Domain gelegentlich als Markdown-Link -- gemessen am Beispiel-Payload:
     "[www.anfragenfluss.de](https://www.anfragenfluss.de)". Angezeigt wird der Text, verlinkt
     wird das Ziel. Steht dort eine nackte Domain, bleibt sie, wie sie ist. */
  function domainTeile(roh) {
    var t = txt(roh).trim();
    var m = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(t);
    var text = m ? m[1].trim() : t;
    var ziel = m ? m[2].trim() : t;
    if (!text) return null;
    if (!/^https?:\/\//i.test(ziel)) ziel = "https://" + ziel.replace(/^\/+/, "");
    return { text: text, ziel: ziel };
  }

  /* Datum MIT Uhrzeit. UC.fmtDate gibt den Tag, und der reicht hier nicht: zwei Zeitraeume am
     selben Tag saehen sonst gleich aus, und genau die entstehen, wenn jemand eine Marke kurz
     abschaltet und wieder anschaltet. */
  function zeitpunkt(v) {
    if (v == null || v === "") return "–";
    var d = new Date(String(v));
    if (isNaN(d.getTime())) return "–";
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    return UC.fmtDate(v) + ", " + hh + ":" + mm;
  }

  /* Aus "created" wird "Created", aus "manual_stop" "Manual stop". Der Grund kommt als Schluessel
     aus der Datenbank; ihn ungefiltert anzuzeigen waere ein Entwicklertext im UI. */
  function grund(v) {
    var t = txt(v).trim().replace(/[_-]+/g, " ");
    if (!t) return "–";
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function hexOk(v) { return /^#[0-9a-fA-F]{6}$/.test(txt(v).trim()); }

  function initRoot(root) {
    if (!root) return null;
    if (root.__ubeController) return root.__ubeController;

    var instanceId = txt(root.getAttribute("data-instance")).trim() || "default";
    var fire = UC.makeFire(root, { label: "brand-editor", eventPrefix: "ube" });
    if (UC.themeParam) UC.themeParam(root);

    /* data-isdark ist, was Bubble ans Element schreibt; data-theme ist, was die CSS liest. Die
       Uebersetzung macht jede Komponente selbst (so steht sie auch in settings-brand und
       prompts-table) -- core stempelt sie nur bei einem Themenwechsel ueber applyThemeTo. */
    function themaSetzen() {
      var dunkel = UC.isYes(root.getAttribute("data-isdark"));
      if (dunkel) root.setAttribute("data-theme", "dark");
      else root.removeAttribute("data-theme");
    }
    themaSetzen();
    /* Und mitziehen, wenn Bubble das Attribut spaeter aendert -- der Themenwechsel der App laeuft
       ueber genau dieses Attribut. */
    if (window.MutationObserver) {
      new MutationObserver(function () { themaSetzen(); colorisSetzen(); })
        .observe(root, { attributes: true, attributeFilter: ["data-isdark"] });
    }

    var state = { data: null, loading: true, fehler: "", farbe: "", farbeDirty: false, neu: "" };

    root.innerHTML =
      '<div class="ube-loaderr up-empty" hidden></div>' +
      '<div class="ube-body">' +
        '<div class="ube-kopf"></div>' +
        '<section class="ube-sec ube-sec-alias">' +
          '<div class="ube-sechead">' +
            '<h2 class="ube-sectitle">Brand Match Aliases / Products</h2>' +
            '<p class="ube-secsub">Define how the system should recognize this brand across sources. ' +
              'Every name entered here is also tracked for this brand in AI answers and citations.</p>' +
          '</div>' +
          '<div class="ube-aliasadd">' +
            '<input class="up-field ube-feld ube-aliasin" type="text" placeholder="New alias" ' +
              'autocomplete="off" spellcheck="false" maxlength="120">' +
            '<button class="up-btn-pri ube-aliasbtn" type="button" data-alias-add disabled></button>' +
          '</div>' +
          '<div class="ube-aliastable"></div>' +
        '</section>' +
        '<section class="ube-sec ube-sec-farbe">' +
          '<div class="ube-sechead">' +
            '<h2 class="ube-sectitle">Brand Color</h2>' +
            '<p class="ube-secsub">Change the primary color for this brand. It is used in every chart.</p>' +
          '</div>' +
          '<div class="ube-farbzeile">' +
            '<span class="ube-farbfeld">' +
              '<input class="up-field ube-feld ube-farbin" type="text" spellcheck="false" autocomplete="off" ' +
                'maxlength="7" placeholder="#000000" aria-label="Brand color">' +
            '</span>' +
            '<button class="up-btn-pri ube-farbsave" type="button" data-color-save disabled></button>' +
            '<button class="up-btn-sec ube-farbreset" type="button" data-color-reset hidden>Reset</button>' +
          '</div>' +
        '</section>' +
        '<section class="ube-sec ube-sec-zeit">' +
          '<div class="ube-sechead">' +
            '<h2 class="ube-sectitle ube-zeittitle">Tracking Statistics</h2>' +
            '<p class="ube-secsub">The periods during which this brand was tracked in AI responses.</p>' +
          '</div>' +
          '<div class="ube-zeittable"></div>' +
        '</section>' +
      '</div>';

    var elErr    = root.querySelector(".ube-loaderr");
    var elBody   = root.querySelector(".ube-body");
    var elKopf   = root.querySelector(".ube-kopf");
    var elAliasT = root.querySelector(".ube-aliastable");
    var elZeitT  = root.querySelector(".ube-zeittable");
    var elIn     = root.querySelector(".ube-aliasin");
    var elAddBtn = root.querySelector(".ube-aliasbtn");
    var elFarbIn = root.querySelector(".ube-farbin");
    var elFarbSv = root.querySelector(".ube-farbsave");
    var elFarbRs = root.querySelector(".ube-farbreset");
    var elZeitTi = root.querySelector(".ube-zeittitle");

    elAddBtn.innerHTML = (UC.icon ? UC.icon("plus", 2.2) : "") + "<span>Add</span>";
    elFarbSv.innerHTML = (UC.icon ? UC.icon("save", 2) : "") + "<span>Save</span>";

    /* ---- Farbwaehler ------------------------------------------------------------------------
       Coloris haengt sich an ein Feld mit data-coloris. Die Instanz gehoert der Seite, nicht dem
       Element: zweimal init() mit denselben Optionen ist harmlos, zweimal geladen waere es nicht. */
    function colorisSetzen() {
      ladeColoris().then(function (da) {
        if (!da || !window.Coloris) return;
        /* Coloris gehoert der SEITE, nicht dem Element: seine Optionen gelten fuer alle Felder,
           die er kennt. Deshalb zaehlt hier das Thema der App und nicht das Attribut an dieser
           Wurzel -- sonst gewinnt bei zwei Editoren der zuletzt angemeldete, und der Waehler
           stuende hell in einer dunklen Seite. */
        /* Das Thema der SEITE, und nur wenn die keins gesetzt hat, das dieser Wurzel. Gemessen im
           Harness: dort steht data-theme allein an der Komponente, und der Waehler stand weiss
           in einem dunklen Editor. */
        var seite = document.documentElement.getAttribute("data-theme") ||
                    (UC.getUpstreemTheme ? UC.getUpstreemTheme() : "");
        var dunkel = (seite || root.getAttribute("data-theme")) === "dark";
        try {
          window.Coloris({
            el: ".ube-farbin", themeMode: dunkel ? "dark" : "light", theme: "polaroid",
            alpha: false, format: "hex", focusInput: false, selectInput: false,
            /* Die Vorschlaege sind die Markenfarben der App (dieselben, die die Charts vergeben) --
               so trifft man mit einem Klick eine Farbe, die neben den anderen funktioniert. */
            swatches: ["#1f6feb", "#8957e5", "#1a7f5a", "#b3541e", "#be185d", "#0e7490", "#a16207", "#6f737c"]
          });
        } catch (e) {}
      });
    }

    function farbeAusDaten(c) {
      var v = txt(c && (c.color_override || c.effective_color || c.default_color)).trim();
      return hexOk(v) ? v.toLowerCase() : "";
    }

    function kopfHtml(c) {
      var d = domainTeile(c.domain);
      var fav = txt(c.favicon_url).trim();
      /* Die Platte ist .up-logo-box aus core (Radius, Grund, 1px Polster); .up-fav ist der
         Aufhaenger, an dem der Globus-Rueckfall greift. Beide zusammen, wie in den Tabellen. */
      return '<span class="up-logo-box up-fav ube-fav' + (fav ? " has-img" : "") + '">' +
               (fav ? '<img src="' + esc(fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : "") +
             '</span>' +
             '<div class="ube-kopftext">' +
               '<p class="ube-koplabel">Primary tracking- and display name</p>' +
               '<div class="ube-namezeile">' +
                 '<h1 class="ube-name">' + esc(txt(c.name) || "–") + '</h1>' +
                 '<button class="up-iconbtn ube-rename" type="button" data-rename ' +
                   'data-tip="Rename" aria-label="Rename brand">' + (UC.icon ? UC.icon("squarePen", 2) : "") + '</button>' +
               '</div>' +
               (d ? '<a class="ube-domain" href="' + esc(d.ziel) + '" target="_blank" rel="noopener">' +
                      esc(d.text) + '</a>'
                  : '<span class="ube-domain is-leer">–</span>') +
             '</div>';
    }

    function aliasHtml(liste) {
      var kopf = '<div class="up-thead up-row ube-row">' +
          '<div class="up-th">Alias</div>' +
          '<div class="up-th">Active</div>' +
          '<div class="up-th">Delete</div>' +
        '</div>';
      if (!liste.length) {
        return '<div class="up-table ube-table ube-aliaslist">' + kopf +
          '<div class="up-tbody"><div class="up-empty ube-leer">No aliases yet. ' +
          'The brand is matched by its primary name.</div></div></div>';
      }
      var zeilen = liste.map(function (a) {
        var id = esc(txt(a.alias_id));
        var an = a.is_active !== false;
        return '<div class="up-row ube-row" data-alias="' + id + '">' +
            '<div class="up-td ube-td-name"><span class="ube-alias">' + esc(txt(a.pattern) || "–") + '</span></div>' +
            '<div class="up-td">' +
              '<button class="up-switch ube-switch' + (an ? " is-on" : "") + '" type="button" ' +
                'role="switch" aria-checked="' + (an ? "true" : "false") + '" ' +
                'data-alias-toggle aria-label="Active"></button>' +
            '</div>' +
            '<div class="up-td">' +
              '<button class="up-iconbtn ube-del" type="button" data-alias-del ' +
                'data-tip="Delete alias" aria-label="Delete alias">' +
                (UC.icon ? UC.icon("trash", 2) : "") + '</button>' +
            '</div>' +
          '</div>';
      }).join("");
      return '<div class="up-table ube-table ube-aliaslist">' + kopf +
             '<div class="up-tbody">' + zeilen + '</div></div>';
    }

    function zeitHtml(liste) {
      var kopf = '<div class="up-thead up-row ube-row">' +
          '<div class="up-th">Starting date</div>' +
          '<div class="up-th">Ending date</div>' +
          '<div class="up-th">Reason</div>' +
        '</div>';
      if (!liste.length) {
        return '<div class="up-table ube-table ube-zeitlist">' + kopf +
          '<div class="up-tbody"><div class="up-empty ube-leer">No tracking periods yet.</div></div></div>';
      }
      /* Neueste zuerst: der letzte Wechsel ist der, nach dem hier jemand sucht. */
      var sortiert = liste.slice().sort(function (a, b) {
        return String(b.started_at || "").localeCompare(String(a.started_at || ""));
      });
      var zeilen = sortiert.map(function (z) {
        var laeuft = z.ended_at == null || z.ended_at === "";
        return '<div class="up-row ube-row">' +
            '<div class="up-td">' + esc(zeitpunkt(z.started_at)) + '</div>' +
            '<div class="up-td' + (laeuft ? " ube-laeuft" : "") + '">' +
              (laeuft ? "Running" : esc(zeitpunkt(z.ended_at))) + '</div>' +
            '<div class="up-td">' + esc(grund(z.start_reason)) + '</div>' +
          '</div>';
      }).join("");
      return '<div class="up-table ube-table ube-zeitlist">' + kopf +
             '<div class="up-tbody">' + zeilen + '</div></div>';
    }

    function skelett() {
      elKopf.innerHTML = '<span class="up-logo-box up-fav ube-fav"></span>' +
        '<div class="ube-kopftext"><span class="ube-sk ube-sk-lbl"></span>' +
        '<span class="ube-sk ube-sk-name"></span><span class="ube-sk ube-sk-dom"></span></div>';
      var reihen = UC.skeletonRows
        ? UC.skeletonRows({ count: 2, rowClass: "up-row ube-row", cellClass: "up-td", cells: 3 })
        : "";
      elAliasT.innerHTML = '<div class="up-table ube-table ube-aliaslist">' +
        '<div class="up-thead up-row ube-row"><div class="up-th">Alias</div>' +
        '<div class="up-th">Active</div><div class="up-th">Delete</div></div>' +
        '<div class="up-tbody">' + reihen + '</div></div>';
      elZeitT.innerHTML = '<div class="up-table ube-table ube-zeitlist">' +
        '<div class="up-thead up-row ube-row"><div class="up-th">Starting date</div>' +
        '<div class="up-th">Ending date</div><div class="up-th">Reason</div></div>' +
        '<div class="up-tbody">' + reihen + '</div></div>';
    }

    function render() {
      /* Der Fehlerfall steht VOR dem Skelett: ein endloses Skelett sieht aus wie "gleich da". */
      if (state.fehler) {
        elErr.hidden = false;
        elErr.textContent = state.fehler;
        elBody.hidden = true;
        return;
      }
      elErr.hidden = true;
      elBody.hidden = false;
      root.classList.toggle("is-loading", !!state.loading);
      if (state.loading || !state.data) { skelett(); return; }

      var d = state.data;
      var c = (d.company && typeof d.company === "object") ? d.company : {};
      elKopf.innerHTML = kopfHtml(c);
      elAliasT.innerHTML = aliasHtml(isArr(d.aliases) ? d.aliases : []);
      elZeitT.innerHTML = zeitHtml(isArr(d.tracking_periods) ? d.tracking_periods : []);
      elZeitTi.textContent = (txt(c.name) ? txt(c.name) + " " : "") + "Tracking Statistics";

      if (!state.farbeDirty) {
        state.farbe = farbeAusDaten(c);
        elFarbIn.value = state.farbe;
      }
      farbeSpiegeln();
      elFarbRs.hidden = !txt(c.color_override);
      if (UC.makeTooltips) UC.makeTooltips(root);
    }

    /* Der Kasten links im Feld zeigt die Farbe auch dann, wenn Coloris nicht geladen hat.
       Der Traeger wird ueber die Klasse gesucht und NICHT ueber parentNode: Coloris haengt beim
       Anmelden einen eigenen Wrapper (.clr-field) um das Feld, und danach zeigte parentNode auf
       den -- die Farbe landete an einem Element ohne die Regel, der Kasten blieb leer. */
    function farbeSpiegeln() {
      var traeger = root.querySelector(".ube-farbfeld");
      var v = txt(elFarbIn.value).trim();
      var gut = hexOk(v);
      if (traeger) {
        traeger.style.setProperty("--ube-farbe", gut ? v : "transparent");
        traeger.classList.toggle("is-leer", !gut);
      }
      elFarbSv.disabled = !state.farbeDirty || !gut;
    }

    /* ---- Bedienung -------------------------------------------------------------------------- */
    elIn.addEventListener("input", function () {
      state.neu = elIn.value;
      elAddBtn.disabled = !txt(state.neu).trim();
    });
    elIn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && txt(elIn.value).trim()) { e.preventDefault(); aliasAnlegen(); }
    });
    elFarbIn.addEventListener("input", function () { state.farbeDirty = true; farbeSpiegeln(); });
    /* Coloris meldet seine Auswahl als input-Ereignis am Feld, aber erst beim Schliessen als
       change -- beide anhaengen, sonst bleibt der Speichern-Knopf nach einem Klick im Waehler grau. */
    elFarbIn.addEventListener("change", function () { state.farbeDirty = true; farbeSpiegeln(); });

    function aliasAnlegen() {
      var v = txt(elIn.value).trim();
      if (!v) return;
      var c = (state.data && state.data.company) || {};
      fire("data-aliasadd-fn", "ubeAliasAdd", { company_id: txt(c.company_id), pattern: v });
      elIn.value = ""; state.neu = ""; elAddBtn.disabled = true;
    }

    root.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var c = (state.data && state.data.company) || {};

      if (t.closest("[data-alias-add]")) { aliasAnlegen(); return; }
      if (t.closest("[data-rename]")) {
        fire("data-rename-fn", "ubeRename", { company_id: txt(c.company_id), name: txt(c.name) });
        return;
      }
      var sw = t.closest("[data-alias-toggle]");
      if (sw) {
        var zeile = sw.closest("[data-alias]");
        var an = !sw.classList.contains("is-on");
        /* Sofort umlegen und erst dann melden: der Schalter soll dem Finger folgen und nicht dem
           Server. Kommt der naechste Payload, gewinnt er ohnehin. */
        sw.classList.toggle("is-on", an);
        sw.setAttribute("aria-checked", an ? "true" : "false");
        fire("data-aliastoggle-fn", "ubeAliasToggle", {
          company_id: txt(c.company_id),
          alias_id: zeile ? txt(zeile.getAttribute("data-alias")) : "",
          is_active: an
        });
        return;
      }
      var del = t.closest("[data-alias-del]");
      if (del) {
        var z2 = del.closest("[data-alias]");
        fire("data-aliasdelete-fn", "ubeAliasDelete", {
          company_id: txt(c.company_id),
          alias_id: z2 ? txt(z2.getAttribute("data-alias")) : ""
        });
        return;
      }
      if (t.closest("[data-color-save]")) {
        var v = txt(elFarbIn.value).trim().toLowerCase();
        if (!hexOk(v)) return;
        state.farbeDirty = false; farbeSpiegeln();
        fire("data-color-fn", "ubeColor", { company_id: txt(c.company_id), color: v });
        return;
      }
      if (t.closest("[data-color-reset]")) {
        /* Leerer Wert heisst "zurueck auf die vergebene Farbe" -- der Server entscheidet, welche
           das ist. Hier eine auszurechnen waere geraten. */
        state.farbeDirty = false;
        fire("data-color-fn", "ubeColor", { company_id: txt(c.company_id), color: "" });
        return;
      }
    });

    /* onTheme nimmt NUR eine Funktion (kein root) -- der Rueckgabewert meldet ab, was hier
       niemand tut: die Komponente lebt, solange die Seite lebt. */
    if (UC.onTheme) UC.onTheme(function () { themaSetzen(); colorisSetzen(); });
    colorisSetzen();

    var ctrl = {
      setData: function (payload) {
        var p = UC.readBubble ? UC.readBubble(payload) : null;
        /* readBubble ist der LISTEN-Leser der App: ein einzelnes Objekt kommt als Liste mit einem
           Eintrag zurueck -- gemessen mit dem Payload dieser Komponente ([object Array], Laenge 1,
           darin das Objekt mit company). Genau so liefert die RPC es auch, wenn sie eine Zeile
           zurueckgibt. Also hier auspacken statt einen zweiten Leseweg aufzumachen. */
        if (isArr(p) && p.length === 1 && p[0] && typeof p[0] === "object") p = p[0];
        /* company MUSS da sein: ohne sie gibt es keine Marke zu bearbeiten, und ein Formular mit
           lauter Strichen sieht aus wie eine leere Marke statt wie ein Payload, der unterwegs
           kaputtgegangen ist. Bubbles eigene Sanitizer machen aus "key": , ein null -- lesbar,
           aber eben ohne Inhalt. */
        var ok = p && typeof p === "object" && !isArr(p) && p.company && typeof p.company === "object";
        state.fehler = ok ? "" : "The brand data could not be read.";
        state.data = ok ? p : null;
        state.farbeDirty = false;
        /* Der Ladezustand endet IMMER -- auch bei kaputtem Payload. */
        state.loading = false;
        render();
        return true;
      },
      setLoading: function (v) {
        state.loading = UC.isYes(v);
        if (state.loading) state.fehler = "";
        render();
        return true;
      },
      reset: function () {
        state.data = null; state.loading = true; state.fehler = "";
        state.farbe = ""; state.farbeDirty = false; state.neu = "";
        elIn.value = ""; elFarbIn.value = ""; elAddBtn.disabled = true;
        render();
        return true;
      }
    };

    root.__ubeController = ctrl;
    if (spaet) spaet.drain(instanceId, ctrl);
    render();
    return ctrl;
  }

  /* Wartet ein Aufruf auf eine Instanz, die es gerade nicht gibt, geht er NICHT verloren. */
  var spaet = UC.makeLate ? UC.makeLate("brand-editor", ".ube-root") : null;

  var mount;
  mount = UC.makeMount({
    onMount: function (m) { mount = m; },
    rootClass: "ube-root", notPortal: true,
    ctrlProp: "__ubeController",
    resolveLocal: "__ubeResolveLocal",
    queue: "__ubeBootQueue",
    initRoot: initRoot,
    api: {
      setBrandEditor:        function (id, p) { return each(id, function (c) { c.setData(p); }); },
      setBrandEditorLoading: function (id, v) { return each(id, function (c) { c.setLoading(v); }); },
      resetBrandEditor:      function (id)    { return each(id, function (c) { c.reset(); }); }
    }
  });

  function each(id, fn) {
    var roots = mount.rootsWithId(String(id == null ? "default" : id).trim());
    if (!roots.length) {
      if (spaet) return spaet.park(id == null ? "default" : id, fn);
      return false;
    }
    roots.forEach(function (r) { var c = initRoot(r); if (c) fn(c); });
    return true;
  }

  if (UC.watchRoots) UC.watchRoots("ube-root", function () {
    [].forEach.call(document.querySelectorAll(".ube-root"), initRoot);
  });
  }

  ubeBoot(30);
})();
