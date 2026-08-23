/* upstreem url-detail.js — die URL-Detailseite. Braucht core.js (window.UpstreemCore).

   Aufbau von oben, jede Karte erscheint nur, wenn sie etwas zu zeigen hat:
     1. Kopf        Favicon, Titel, Domain, Link nach draussen
     2. KPIs        Last Seen, Domain Share, Global Share, URL Rank, Citation Type, URL Type
     3. Mentions    die Marken, die auf dieser Seite vorkommen
     4. Embed       das Video oder der Post selbst, wenn die Adresse zu einem Anbieter passt
     5. Meta        die SEO-Beschreibung -- NICHT neben einem Embed, dort ist der Post der Inhalt
     6. AI Summary  die Zusammenfassung des Hintergrundlaufs
     7. Conversion  wie oft diese Zitation zu einer Markennennung fuehrt

   Was aus core kommt und hier NICHT noch einmal entsteht:
     UC.typeColor / typeLabel / typeDesc   Farbe, Name und Erklaersatz beider Typ-Achsen
     UC.makeExplain                        die Erklaerkarte an den Ueberschriften
     UC.makeBarList                        die Balkenliste der Conversion
     UC.readBubble                         der eine Leseweg fuer Bubble-Payloads
     UC.makeMount / makeFire / makeLate / widthTiers / onTheme / themeParam / makeTooltips
     .up-tag / .up-entchip / .up-card      die Bauteile

   Die Chip-Regel aus quick-actions gilt auch hier: URL-Typen tragen einen Punkt, Zitationstypen
   nie. Das ist es, was die beiden Vokabulare auf einen Blick auseinanderhaelt, wenn sie
   nebeneinander stehen.

   Neu ist nur die Embed-Schicht. Dafuer gibt es in core nichts und es gibt sie genau einmal in
   der App -- deshalb steht sie hier. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung -----------------------------------
     Bubble ruft die Setter aus einem Workflow, der neben dem Laden dieser Datei laeuft. Ohne
     Stubs wirft der erste Aufruf und reisst den ganzen Run-JS-Step mit. */
  var API_NAMES = ["setUrlDetail", "setUrlDetailConversion", "setUrlDetailLoading",
                   "resetUrlDetail"];
  var Q = (window.__uudBootQueue = window.__uudBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function uudBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { uudBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uudStart();
  }

  function uudStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc;
  /* core exportiert kein isArr -- eine Zeile, kein Nachbau eines Bauteils. */
  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }

  /* ---- Die KPI-Leiste ------------------------------------------------------------------------
     Sechs Felder, jedes mit einer Erklaerkarte an der Ueberschrift. Der Text steht hier und nicht
     im Markup, damit Reihenfolge und Erklaerung nicht auseinanderlaufen koennen.
     Die beiden Typ-Felder haben KEINEN eigenen Text: ihre Erklaerung haengt am Wert, nicht am
     Feld, und kommt aus UC.typeDesc -- ein Listicle heisst etwas anderes als ein Forum. */
  var KPIS = [
    { key: "last_seen", label: "Last Seen",
      title: "Last Seen",
      body: "The most recent run in which a model cited this exact URL. A date far in the past " +
            "means the page still counts in totals but is no longer being picked up." },
    { key: "domain_share", label: "Domain Share",
      title: "Domain Share",
      body: "This URL's share of all citations its own domain received. High here means the page " +
            "carries its domain: the models reach for this one rather than the rest of the site." },
    { key: "global_share", label: "Global Share",
      title: "Global Share",
      body: "This URL's share of every citation in the period, across all domains. It answers how " +
            "much of the whole citation landscape this single page holds." },
    { key: "global_rank", label: "URL Rank",
      title: "URL Rank",
      body: "Where this page sits among all cited URLs, by citation count. #1 is the most cited " +
            "page in the period." },
    { key: "citation_type", label: "Citation Type", typ: "citation" },
    { key: "url_type", label: "URL Type", typ: "url" }
  ];

  /* ---- Embeds --------------------------------------------------------------------------------
     Sieben Anbieter, drei Bauarten:

       iframe    YouTube, TikTok, LinkedIn, Reddit, Facebook -- eine Adresse, fertig. Kein fremdes
                 Script, kein Timing, kein Nachladen. Wo es einen reinen iframe gibt, nehmen wir
                 ihn: TikToks embed.js laedt rund 200 KB und verarbeitet NUR, was beim Laden schon
                 im Dokument stand -- ein Blockquote, das diese Komponente spaeter einsetzt, bleibt
                 dort leer stehen. Genau daran scheitert das Muster, das in der App bisher stand.
       script    Instagram und X. Beide haben keinen offenen iframe-Weg. Deshalb wird das Script
                 einmal geladen und danach ausdruecklich zum Verarbeiten aufgefordert
                 (instgrm.Embeds.process bzw. twttr.widgets.load) -- ohne das bleibt der Kasten leer.
       oembed    YouTube und TikTok liefern zusaetzlich Titel und Kanal, ohne Schluessel und mit
                 CORS. Gemessen am 23.08.: beide 200 mit Access-Control. Aufrufzahlen stehen dort
                 NICHT -- die gibt es nur ueber die Data API mit Schluessel, und ein Schluessel in
                 Client-JS ist oeffentlich. Deshalb Kanal und Titel, keine Zahlen. */
  function ytId(u) {
    var m = /youtu\.be\/([A-Za-z0-9_-]{6,})/.exec(u)
         || /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/.exec(u)
         || /[?&]v=([A-Za-z0-9_-]{6,})/.exec(u)
         || /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/.exec(u)
         || /youtube\.com\/live\/([A-Za-z0-9_-]{6,})/.exec(u);
    return m ? m[1] : "";
  }
  var ANBIETER = [
    {
      key: "youtube", label: "YouTube",
      passt: function (u) { return /(?:^|\.)youtu\.?be(?:\.com)?\//i.test(u) && !!ytId(u); },
      art: "iframe", ratio: 56.25,
      src: function (u) { return "https://www.youtube-nocookie.com/embed/" + ytId(u) + "?rel=0&modestbranding=1"; },
      oembed: function (u) { return "https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(u); }
    },
    {
      key: "tiktok", label: "TikTok",
      passt: function (u) { return /tiktok\.com\/.*\/video\/(\d{6,})/i.test(u); },
      /* Fester Rahmen statt Seitenverhaeltnis: TikTok liefert je nach Post mal Hoch-, mal
         Querformat, und der eigene Player bringt seine Beschriftung mit. 740px ist die Hoehe,
         die TikTok in seinem eigenen Einbettungscode vorgibt. */
      art: "iframe", hoehe: 740, maxBreite: 605,
      src: function (u) { return "https://www.tiktok.com/embed/v2/" + (/video\/(\d{6,})/.exec(u) || [])[1]; },
      oembed: function (u) { return "https://www.tiktok.com/oembed?url=" + encodeURIComponent(u); }
    },
    {
      key: "instagram", label: "Instagram",
      passt: function (u) { return /instagram\.com\/(p|reel|tv)\//i.test(u); },
      art: "script", skript: "https://www.instagram.com/embed.js",
      /* utm_source=ig_embed gehoert an den Permalink -- ohne ihn weisen einzelne Posts die
         Einbettung ab. Steht er schon da, nicht doppelt anhaengen. */
      markup: function (u) {
        var link = u.indexOf("utm_source=ig_embed") >= 0 ? u
                 : u + (u.indexOf("?") >= 0 ? "&" : "?") + "utm_source=ig_embed";
        return '<blockquote class="instagram-media" data-instgrm-permalink="' + esc(link) +
               '" data-instgrm-version="14"></blockquote>';
      },
      anstossen: function () {
        try { if (window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process(); } catch (e) {}
      }
    },
    {
      key: "x", label: "X",
      passt: function (u) { return /(?:twitter|x)\.com\/[^\/]+\/status\/\d+/i.test(u); },
      art: "script", skript: "https://platform.twitter.com/widgets.js",
      markup: function (u) {
        return '<blockquote class="twitter-tweet"><a href="' + esc(u) + '"></a></blockquote>';
      },
      anstossen: function (el, isDark) {
        try {
          if (window.twttr && window.twttr.widgets) {
            /* Das Thema geht als Attribut mit, sonst steht ein weisser Kasten im dunklen Modus. */
            var bq = el.querySelector(".twitter-tweet");
            if (bq) bq.setAttribute("data-theme", isDark ? "dark" : "light");
            window.twttr.widgets.load(el);
          }
        } catch (e) {}
      }
    },
    {
      key: "linkedin", label: "LinkedIn",
      passt: function (u) { return /linkedin\.com\/.*(?:activity-|urn:li:(?:activity|share|ugcPost):)(\d{6,})/i.test(u); },
      art: "iframe", hoehe: 600, maxBreite: 560,
      src: function (u) {
        var m = /(?:activity-|urn:li:(?:activity|share|ugcPost):)(\d{6,})/i.exec(u);
        return "https://www.linkedin.com/embed/feed/update/urn:li:share:" + (m ? m[1] : "");
      }
    },
    {
      key: "reddit", label: "Reddit",
      passt: function (u) { return /reddit\.com\/r\/[^\/]+\/comments\/[a-z0-9]+/i.test(u); },
      art: "iframe", hoehe: 560,
      /* embed.reddit.com nimmt den Pfad des Beitrags unveraendert und braucht kein Script. */
      src: function (u) {
        var m = /reddit\.com(\/r\/[^\/]+\/comments\/[^?#]*)/i.exec(u);
        return "https://embed.reddit.com" + (m ? m[1] : "") + "?embed=true";
      }
    },
    {
      key: "facebook", label: "Facebook",
      passt: function (u) { return /facebook\.com\/[^\/]+\/(posts|videos)\//i.test(u); },
      art: "iframe", hoehe: 620, maxBreite: 560,
      src: function (u) {
        return "https://www.facebook.com/plugins/post.php?href=" + encodeURIComponent(u) +
               "&show_text=true&width=500";
      }
    }
  ];
  function anbieterFuer(u) {
    var s = String(u == null ? "" : u).trim();
    if (!s) return null;
    for (var i = 0; i < ANBIETER.length; i++) {
      try { if (ANBIETER[i].passt(s)) return ANBIETER[i]; } catch (e) {}
    }
    return null;
  }
  /* Ein fremdes Script genau EINMAL je Seite, egal wie viele Instanzen es anfordern. Zwei
     widgets.js im Dokument laden beide und ueberschreiben einander. */
  var GELADEN = {};
  function skriptLaden(src, fertig) {
    if (GELADEN[src] === "ok") { fertig(); return; }
    if (GELADEN[src]) { GELADEN[src].push(fertig); return; }
    GELADEN[src] = [fertig];
    var s = document.createElement("script");
    s.async = true; s.src = src;
    s.onload = function () {
      var warteschlange = GELADEN[src]; GELADEN[src] = "ok";
      if (warteschlange && warteschlange.forEach) warteschlange.forEach(function (f) { try { f(); } catch (e) {} });
    };
    s.onerror = function () {
      var warteschlange = GELADEN[src]; GELADEN[src] = null;
      if (warteschlange && warteschlange.forEach) warteschlange.forEach(function (f) { try { f(true); } catch (e) {} });
    };
    document.head.appendChild(s);
  }

  function shell() {
    return '' +
      '<div class="up-card uud-card uud-headcard">' +
        '<div class="uud-head">' +
          '<span class="up-logo-box uud-logobox"><span class="up-logo-ltr"></span></span>' +
          '<div class="uud-headtxt">' +
            '<span class="uud-title"></span>' +
            '<a class="uud-domain" target="_blank" rel="noopener noreferrer"></a>' +
          '</div>' +
        '</div>' +
        '<div class="uud-kpis"></div>' +
      '</div>' +

      '<div class="up-card uud-card uud-mentcard" hidden>' +
        '<div class="uud-sec">' +
          '<span class="uud-sec-title">Mentions</span>' +
          '<span class="uud-sec-desc">Relevant brands referenced on this page</span>' +
        '</div>' +
        '<div class="uud-ments"></div>' +
      '</div>' +

      '<div class="up-card uud-card uud-embedcard" hidden>' +
        '<div class="uud-sec uud-sec-row">' +
          '<div class="uud-sec-txt">' +
            '<span class="uud-sec-title uud-embedtitle"></span>' +
            '<span class="uud-sec-desc uud-embeddesc"></span>' +
          '</div>' +
        '</div>' +
        '<div class="uud-embed"></div>' +
      '</div>' +

      '<div class="up-card uud-card uud-metacard" hidden>' +
        '<div class="uud-sec">' +
          '<span class="uud-sec-title">Meta Description</span>' +
          '<span class="uud-sec-desc">The page\'s SEO description</span>' +
        '</div>' +
        '<p class="uud-text uud-meta"></p>' +
      '</div>' +

      '<div class="up-card uud-card uud-sumcard" hidden>' +
        '<div class="uud-sec">' +
          '<span class="uud-sec-title">AI Summary</span>' +
          '<span class="uud-sec-desc">High-level summary of this page</span>' +
        '</div>' +
        '<p class="uud-text uud-sum"></p>' +
      '</div>' +

      '<div class="up-card uud-card uud-convcard" hidden>' +
        '<div class="uud-sec">' +
          '<span class="uud-sec-title">Citation Conversion</span>' +
          '<span class="uud-sec-desc">How often this citation leads to brand mentions</span>' +
        '</div>' +
        '<div class="uud-conv"></div>' +
      '</div>' +

      '<div class="uud-fehler" hidden></div>';
  }

  function initRoot(root) {
    if (root.__uudController) return root.__uudController;
    var instanceId = root.getAttribute("data-instance") || "default";
    if (instanceId === "INSTANCE_ID") return null;   /* Platzhalter noch nicht ersetzt */

    root.innerHTML = shell();
    var fire = UC.makeFire(root, { label: "url-detail", eventPrefix: "uud" });

    /* Schmale Breiten ueber die EIGENE Box, nicht ueber eine Media Query auf das Fenster: diese
       Seite kann in einem Drawer stehen, der auf einem breiten Bildschirm schmal ist. */
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 640, vnarrowAt: 480 });

    var elLogo   = root.querySelector(".uud-logobox");
    var elTitle  = root.querySelector(".uud-title");
    var elDomain = root.querySelector(".uud-domain");
    var elKpis   = root.querySelector(".uud-kpis");
    var elMentCard = root.querySelector(".uud-mentcard");
    var elMents  = root.querySelector(".uud-ments");
    var elEmbedCard = root.querySelector(".uud-embedcard");
    var elEmbedTitle = root.querySelector(".uud-embedtitle");
    var elEmbedDesc = root.querySelector(".uud-embeddesc");
    var elEmbed  = root.querySelector(".uud-embed");
    var elMetaCard = root.querySelector(".uud-metacard");
    var elMeta   = root.querySelector(".uud-meta");
    var elSumCard = root.querySelector(".uud-sumcard");
    var elSum    = root.querySelector(".uud-sum");
    var elConvCard = root.querySelector(".uud-convcard");
    var elConv   = root.querySelector(".uud-conv");
    var elFehler = root.querySelector(".uud-fehler");

    var isDark = UC.themeParam ? UC.themeParam(root.getAttribute("data-isdark")) : false;
    function dunkel() { return isDark; }

    var state = {
      data: null,
      conv: [],
      loading: true,
      fehler: "",
      /* Der zuletzt eingebettete Anbieter samt Adresse. Ohne das baut jeder Render den iframe neu,
         und ein laufendes Video springt beim ersten Datenupdate zurueck auf Anfang. */
      embedKey: "",
      oembed: null
    };

    if (UC.makeTooltips) UC.makeTooltips(root, dunkel);

    /* Die Erklaerkarte der App, nicht ein eigener Tooltip: dieselbe Karte mit Ueberschrift und
       Satz, die an jedem Tabellenkopf haengt. Das alte freistehende URL-Type-Element brachte ein
       eigenes Portal mit -- das faellt damit weg. */
    var explain = UC.makeExplain ? UC.makeExplain({
      root: root,
      getIsDark: dunkel,
      html: function (key) {
        var k = KPIS.filter(function (x) { return x.key === key; })[0];
        if (!k) return "";
        /* Die Typ-Felder erklaeren ihren WERT, nicht das Feld: ein Listicle heisst etwas anderes
           als ein Forum, und die Ueberschrift "URL Type" allein sagt niemandem etwas. Fehlt der
           Wert, faellt die Karte auf die Achse zurueck statt einen Satz zu erfinden. */
        if (k.typ) {
          var roh = state.data ? state.data[k.key] : "";
          var label = UC.typeLabel ? UC.typeLabel(roh, k.typ) : "";
          var satz = UC.typeDesc ? UC.typeDesc(roh, k.typ) : "";
          if (!satz) {
            satz = k.typ === "url"
              ? "What kind of page this is: the format the models found at this address."
              : "Who owns this page in relation to you: your own site, a competitor, editorial coverage, and so on.";
            label = k.label;
          }
          return '<div class="up-explain-h">' + esc(label) + '</div>' +
                 '<div class="up-explain-t">' + esc(satz) + '</div>';
        }
        return '<div class="up-explain-h">' + esc(k.title) + '</div>' +
               '<div class="up-explain-t">' + esc(k.body) + '</div>';
      }
    }) : null;

    /* ---- Werte ------------------------------------------------------------------------------ */
    function d() { return state.data || {}; }
    function txt(v) { return String(v == null ? "" : v).trim(); }
    function num(v) {
      var n = parseFloat(String(v == null ? "" : v).replace(",", "."));
      return isFinite(n) ? n : null;
    }
    /* Der Strich der App fuer "nichts da" -- eine Antwort auf die Frage, nicht drei. */
    var LEER = '<span class="up-dash">–</span>';

    function kpiWert(k) {
      var v = d()[k.key];
      if (k.typ) {
        var roh = txt(v);
        if (!roh) return LEER;
        var farbe = UC.typeColor(roh, k.typ === "url" ? "url" : "citation", dunkel());
        var grund = dunkel() ? UC.CHIP_BG_DARK : UC.tint(farbe, 0.12);
        var label = UC.typeLabel ? UC.typeLabel(roh, k.typ) : roh;
        /* Punkt nur beim URL-Typ. Das ist die Regel des Hauses (siehe quick-actions): sie haelt
           die beiden Vokabulare auseinander, wenn sie nebeneinander stehen. */
        return '<span class="up-tag" style="color:' + esc(farbe) + ';background:' + esc(grund) + '">' +
                 (k.typ === "url" ? '<span class="up-tag-dot" style="background:' + esc(farbe) + '"></span>' : '') +
                 '<span class="up-tag-lbl">' + esc(label) + '</span>' +
               '</span>';
      }
      if (k.key === "last_seen") {
        var t = txt(v);
        /* In ein Element gewickelt und nicht als nackter Text: der Ladezustand blendet die
           Kinder der Zelle aus, und ein Textknoten ist kein Kind, das CSS fassen kann --
           gemessen stand das Datum waehrend des Ladens und nach reset weiter da. */
        return t ? '<span class="uud-kpi-num">' + esc(UC.fmtDate(t)) + '</span>' : LEER;
      }
      if (k.key === "global_rank") {
        var r = num(v);
        /* Platzziffer, kein Durchschnittsrang: #1 ist die meistzitierte Seite des Zeitraums.
           Die Nachkommastelle aus der Rang-Regel gilt dem Durchschnitt, nicht einer Position. */
        return r == null ? LEER : '<span class="up-rank-group">' + UC.HASH_ICON +
               '<span class="uud-kpi-num">' + esc(String(Math.round(r))) + '</span></span>';
      }
      var p = num(v);
      if (p == null) return LEER;
      return '<span class="uud-kpi-num">' + esc(UC.fmtPct(p, 1)) + '</span>';
    }

    function renderKpis() {
      elKpis.innerHTML = KPIS.map(function (k) {
        return '<div class="uud-kpi">' +
                 '<span class="uud-kpi-val">' + kpiWert(k) + '</span>' +
                 '<span class="uud-kpi-lbl">' + esc(k.label) +
                   /* Das Symbol kommt aus UC.icon wie ueberall -- nie selbst gezeichnet. */
                   '<span class="up-th-info uud-info" data-explain="' + esc(k.key) + '">' +
                     UC.icon("info", 2) + '</span>' +
                 '</span>' +
               '</div>';
      }).join("");
    }

    function renderHead() {
      var p = d();
      var titel = txt(p.title) || txt(p.url);
      elTitle.textContent = titel;
      var dom = txt(p.domain);
      elDomain.textContent = dom;
      elDomain.setAttribute("href", txt(p.url) || ("https://" + dom));
      var fav = txt(p.favicon);
      var buchst = (dom.charAt(0) || "?").toUpperCase();
      elLogo.className = "up-logo-box uud-logobox" + (fav ? " has-img" : "");
      elLogo.innerHTML = '<span class="up-logo-ltr">' + esc(buchst) + '</span>' +
        (fav ? '<img src="' + esc(fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
               ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "");
    }

    function renderMents() {
      var liste = isArr(d().companies) ? d().companies : [];
      elMentCard.hidden = !liste.length;
      if (!liste.length) { elMents.innerHTML = ""; return; }
      elMents.innerHTML = liste.map(function (c) {
        var name = txt(c && (c.company_name || c.name));
        var logo = txt(c && (c.logo_url || c.favicon_url));
        var buchst = (name.charAt(0) || "?").toUpperCase();
        /* Dasselbe Markup wie in response-detail: .up-entchip is-soft mit dem geteilten
           .up-chiphover. Zwei Schreibweisen desselben Chips lesen sich wie zwei Bauteile. */
        return '<span class="up-entchip is-soft up-chiphover uud-ment" role="button" tabindex="0"' +
                 ' data-brand="' + esc(txt(c && c.company_id)) + '">' +
                 '<span class="up-ment-logo' + (logo ? " has-img" : "") + '">' +
                   '<span class="up-model-ltr">' + esc(buchst) + '</span>' +
                   (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                           ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "") +
                 '</span>' +
                 '<span class="up-ment-name">' + esc(name) + '</span>' +
               '</span>';
      }).join("");
    }

    /* ---- Embed ------------------------------------------------------------------------------ */
    function renderEmbed() {
      var url = txt(d().url);
      var a = anbieterFuer(url);
      elEmbedCard.hidden = !a;
      if (!a) {
        elEmbed.innerHTML = ""; state.embedKey = ""; state.oembed = null;
        /* Auch die Beschriftung raeumen: sie steht sonst beim naechsten Anbieter kurz mit dem
           Namen des vorigen da -- die Karte ist zwar verborgen, aber der Text ueberlebt sie. */
        elEmbedTitle.textContent = ""; elEmbedDesc.textContent = "";
        return;
      }

      var kennung = a.key + "|" + url;
      if (state.embedKey === kennung) { schreibeEmbedKopf(a); return; }
      state.embedKey = kennung;
      state.oembed = null;

      if (a.art === "iframe") {
        var stil = a.ratio
          ? 'style="padding-top:' + a.ratio + '%"'
          : 'style="height:' + (a.hoehe || 560) + 'px"';
        elEmbed.innerHTML = '<div class="uud-frame' + (a.ratio ? " is-ratio" : "") + '"' +
          (a.maxBreite ? ' style="max-width:' + a.maxBreite + 'px;' + (a.ratio ? "padding-top:" + a.ratio + "%" : "height:" + (a.hoehe || 560) + "px") + '"' : " " + stil) + '>' +
          '<iframe src="' + esc(a.src(url)) + '" loading="lazy" allowfullscreen' +
            ' referrerpolicy="strict-origin-when-cross-origin"' +
            ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"' +
            ' title="' + esc(a.label) + ' embed"></iframe>' +
        '</div>';
      } else {
        elEmbed.innerHTML = '<div class="uud-social">' + a.markup(url) + '</div>';
        var ziel = elEmbed.querySelector(".uud-social");
        skriptLaden(a.skript, function (fehlgeschlagen) {
          /* Der Kasten darf nicht leer stehen bleiben, wenn das fremde Script nicht kommt --
             ein leerer Rahmen sieht aus wie ein Fehler unserer Seite. */
          if (fehlgeschlagen) {
            ziel.innerHTML = '<a class="uud-fallback" href="' + esc(url) + '" target="_blank" ' +
              'rel="noopener noreferrer">Open this ' + esc(a.label) + ' post</a>';
            return;
          }
          try { a.anstossen(ziel, dunkel()); } catch (e) {}
        });
      }
      schreibeEmbedKopf(a);
      holeOembed(a, url);
    }
    function schreibeEmbedKopf(a) {
      var o = state.oembed;
      elEmbedTitle.textContent = a.label;
      /* Kanal und Titel, wenn der Anbieter sie ohne Schluessel herausgibt. Keine Aufrufzahlen:
         die stehen nur hinter einem API-Schluessel, und ein Schluessel in Client-JS ist
         oeffentlich. Lieber eine Zeile weniger als eine Zahl, die nicht stimmt. */
      elEmbedDesc.textContent = o && (o.author_name || o.title)
        ? [o.author_name, o.title].filter(Boolean).join(" — ")
        : "";
    }
    function holeOembed(a, url) {
      if (!a.oembed || !window.fetch) return;
      var fuer = state.embedKey;
      fetch(a.oembed(url)).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          /* Nur uebernehmen, wenn inzwischen nicht schon eine ANDERE Adresse eingebettet wurde --
             sonst steht der Kanal des vorigen Videos unter dem neuen. */
          if (!j || state.embedKey !== fuer) return;
          state.oembed = j;
          schreibeEmbedKopf(a);
        }).catch(function () {});
    }

    /* ---- Text-Karten ------------------------------------------------------------------------ */
    function renderMeta() {
      var t = txt(d().description);
      /* Neben einem Embed keine SEO-Beschreibung: bei einem Video oder Post ist der Beitrag der
         Inhalt, und die Meta-Zeile ist dort meist der automatische Text der Plattform. */
      var zeigen = !!t && !anbieterFuer(txt(d().url));
      elMetaCard.hidden = !zeigen;
      if (zeigen) elMeta.textContent = entities(t);
    }
    /* Die Beschreibung kommt HTML-kodiert aus dem Crawl ("Techno &amp; Elektro"). Einmal
       dekodieren, sonst steht das kaufmaennische Und als Zeichenfolge in der Oberflaeche.
       textContent danach schreibt es wieder sicher zurueck -- es entsteht kein Markup. */
    function entities(s) {
      var d2 = document.createElement("textarea");
      d2.innerHTML = String(s == null ? "" : s);
      return d2.value;
    }
    function renderSum() {
      var roh = d().markdown_summary;
      var t = "";
      if (roh && typeof roh === "object") t = txt(roh.summary);
      else {
        var s = txt(roh);
        if (s) {
          /* markdown_summary kommt als JSON-TEXT mit einem einzigen Feld. Ist es keins, gilt der
             Text selbst als Zusammenfassung -- eine Zeile weniger Vertrag fuer die RPC. */
          var p = UC.readBubble ? UC.readBubble(s) : null;
          var o = isArr(p) ? p[0] : p;
          t = (o && typeof o === "object" && txt(o.summary)) || s;
        }
      }
      elSumCard.hidden = !t;
      if (t) elSum.textContent = t;
    }

    /* ---- Citation Conversion ----------------------------------------------------------------- */
    var bars = UC.makeBarList ? UC.makeBarList({
      mount: elConv,
      isDark: dunkel,
      labelCol: function () { return true; },
      fmt: function (v) { return UC.fmtPct(v, 1); }
    }) : null;

    function renderConv() {
      var rows = state.conv || [];
      elConvCard.hidden = !rows.length;
      if (!rows.length) { if (bars) bars.render([]); return; }
      /* Die eigene Marke bekommt die Markenfarbe, die uebrigen die Wettbewerbsfarbe -- dieselbe
         Trennung wie ueberall in der App: es geht um "wir" gegen "die anderen", nicht um sieben
         Farben ohne Ordnung. */
      var eigen = UC.typeColor("You", "citation", dunkel());
      var fremd = UC.typeColor("Competition", "citation", dunkel());
      var items = rows.slice().sort(function (a, b) {
        return (num(b.citation_conversion_pct) || 0) - (num(a.citation_conversion_pct) || 0);
      }).map(function (r) {
        return {
          key: txt(r.company_id) || txt(r.company_name),
          name: txt(r.company_name),
          logo: txt(r.logo_url),
          color: txt(r.role) === "own" ? eigen : fremd,
          share: num(r.citation_conversion_pct) || 0
        };
      });
      if (bars) bars.render(items);
    }

    /* ---- Render ------------------------------------------------------------------------------ */
    function render() {
      /* Der Fehlerfall steht VOR dem Skelett. Endloses Laden sieht sonst aus wie "gleich da",
         und genau daran sucht man dann an der falschen Stelle. */
      root.classList.toggle("is-loading", !!state.loading && !state.fehler);
      elFehler.hidden = !state.fehler;
      if (state.fehler) { elFehler.textContent = state.fehler; return; }
      /* Kopf und KPI-Leiste werden AUCH im Ladezustand gezeichnet. Ohne das blieben die Werte
         des vorigen Aufrufs im Dokument stehen, und das Skelett lag daneben ueber alten Zahlen --
         gemessen: nach reset stand "23. Aug 2026" weiter in der Zelle. Mit state.data === null
         ergeben sie leere Zellen, und die CSS legt den Puls darueber. */
      renderHead();
      renderKpis();
      if (state.loading) return;
      renderMents();
      renderEmbed();
      renderMeta();
      renderSum();
      renderConv();
    }

    /* ---- Klicks ------------------------------------------------------------------------------ */
    root.addEventListener("click", function (e) {
      var chip = e.target.closest && e.target.closest(".uud-ment");
      if (chip) {
        fire("data-brand-fn", "uudBrand", {
          company_id: chip.getAttribute("data-brand") || "",
          company_name: (chip.querySelector(".up-ment-name") || {}).textContent || ""
        });
      }
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var chip = e.target.closest && e.target.closest(".uud-ment");
      if (!chip) return;
      e.preventDefault();
      chip.click();
    });

    if (UC.onTheme) UC.onTheme(function (dark) {
      isDark = dark;
      if (dark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      /* Ein X-Embed traegt sein Thema im Markup -- es muss neu gebaut werden, die anderen nicht. */
      if (state.embedKey.indexOf("x|") === 0) { state.embedKey = ""; }
      render();
    }, root);
    if (isDark) root.setAttribute("data-theme", "dark");

    var ctrl = {
      instanceId: instanceId,
      setData: function (payload) {
        var p = UC.readBubble ? UC.readBubble(payload) : null;
        if (isArr(p)) p = p[0];
        var ok = p && typeof p === "object";
        state.fehler = ok ? "" : "The page data could not be read.";
        state.data = ok ? p : null;
        /* Der Ladezustand endet IMMER -- auch bei kaputtem Payload. Sonst laeuft das Skelett
           endlos und sieht aus wie ein Aufruf, der noch unterwegs ist. */
        state.loading = false;
        render();
        return true;
      },
      setConversion: function (payload) {
        var p = UC.readBubble ? UC.readBubble(payload) : null;
        if (!isArr(p)) {
          state.conv = [];
          if (p === null && String(payload == null ? "" : payload).trim()) {
            state.fehler = "The conversion data could not be read.";
          }
        } else {
          state.conv = p;
        }
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
        state.data = null; state.conv = []; state.loading = true; state.fehler = "";
        state.embedKey = ""; state.oembed = null;
        elEmbed.innerHTML = "";
        elEmbedTitle.textContent = ""; elEmbedDesc.textContent = "";
        elMents.innerHTML = ""; elMeta.textContent = ""; elSum.textContent = "";
        if (bars) bars.render([]);
        render();
        return true;
      }
    };

    root.__uudController = ctrl;
    if (spaet) spaet.drain(instanceId, ctrl);
    render();
    return ctrl;
  }

  /* Wartet ein Aufruf auf eine Instanz, die es gerade nicht gibt, geht er NICHT verloren --
     siehe UC.makeLate. Bubble baut das Element zwischen zwei Durchlaeufen neu, und der Workflow
     feuert genau in dieses Fenster. */
  var spaet = UC.makeLate ? UC.makeLate("url-detail", ".uud-root") : null;

  var mount;
  mount = UC.makeMount({
    onMount: function (m) { mount = m; },
    rootClass: "uud-root", notPortal: true,
    ctrlProp: "__uudController",
    resolveLocal: "__uudResolveLocal",
    queue: "__uudBootQueue",
    initRoot: initRoot,
    api: {
      setUrlDetail:           function (id, p) { return each(id, function (c) { c.setData(p); }); },
      setUrlDetailConversion: function (id, p) { return each(id, function (c) { c.setConversion(p); }); },
      setUrlDetailLoading:    function (id, v) { return each(id, function (c) { c.setLoading(v); }); },
      resetUrlDetail:         function (id)    { return each(id, function (c) { c.reset(); }); }
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

  if (UC.watchRoots) UC.watchRoots("uud-root", function () {
    [].forEach.call(document.querySelectorAll(".uud-root"), initRoot);
  });
  }

  uudBoot(30);
})();
