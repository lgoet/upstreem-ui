/* upstreem url-detail.js — die URL-Detailseite. Braucht core.js (window.UpstreemCore).

   Aufbau von oben, jeder Abschnitt erscheint nur, wenn er etwas zu zeigen hat:
     1. KPIs        Last Seen, Domain Share, Global Share, URL Rank, Citation Type, URL Type
     2. Mentions    die Marken, die auf dieser Seite vorkommen
     3. Embed       das Video oder der Post selbst, wenn die Adresse zu einem Anbieter passt
     4. Meta        die SEO-Beschreibung -- NICHT neben einem Embed, dort ist der Post der Inhalt
     5. AI Summary  die Zusammenfassung des Hintergrundlaufs
     6. Conversion  eine kompakte Tabelle: zitiert, genannt, Quote je Marke

   ABSCHNITTE, keine Karten -- wie in response-detail. Umrandet ist nur, was einen Rahmen
   braucht: das Embed (fremder Inhalt) und die Tabelle.

   Was aus core kommt und hier NICHT noch einmal entsteht:
     UC.typeColor / typeLabel / typeDesc   Farbe, Name und Erklaersatz beider Typ-Achsen
     UC.makeExplain                        die Erklaerkarte an den Ueberschriften
     UC.readBubble                         der eine Leseweg fuer Bubble-Payloads
     UC.makeMount / makeFire / makeLate / widthTiers / onTheme / themeParam / makeTooltips
     .up-tag / .up-entchip / .up-mentlist  die Bauteile

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
  var API_NAMES = ["setUrlDetail", "setUrlDetailConversion", "setUrlDetailSummary",
                   "setUrlDetailLoading", "resetUrlDetail"];
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

  /* markdown_summary kann MITTEN im DETAIL-Objekt stehen und dabei selbst unescaptes JSON sein:
     {"summary": "..."} roh, ohne \" davor. Gemessen (24.08.): genau das bringt den Parser der
     GANZEN Zeile durcheinander, nicht nur dieses eine Feld -- "Unexpected token ':'" auf dem
     kompletten Payload, alle vierzehn Felder verloren, nicht nur die Zusammenfassung.
     Deshalb: das Feld VOR dem eigentlichen Parsen roh herausziehen und den Rest davon befreien.
     Greedy statt lazy -- findet das LETZTE Anfuehrungszeichen vor , oder } oder dem Ende, und das
     ist bei Fliesstext zuverlaessiger als das erste (das waere die Klammer von "summary" selbst). */
  function ziehMarkdownSummary(text){
    var start = text.indexOf('"markdown_summary"');
    if (start < 0) return { rest: text, roh: null };
    var doppelpunkt = text.indexOf(":", start);
    var wertStart = text.indexOf('"', doppelpunkt) + 1;
    /* Nur bei GENAU diesem Muster greifen: {"summary" -- alles andere (schon sauberer Text, ein
       anderer Aufbau) bleibt unangetastet und laeuft ueber den normalen Weg.
       Die Grenze ist die literale Folge "}"  (Anfuehrungszeichen, Klammer zu, Anfuehrungszeichen)
       -- TEXT-Ende, Objekt-Ende, aeussere Huelle-Ende in einem Zug. Eine erste Fassung suchte das
       LETZTE Vorkommen einer schliessenden Klammer im Rest des Textes; das griff zu weit, sobald
       markdown_summary NICHT das letzte Feld war (companies kam danach) und fasste die halbe
       Firmenliste mit ein. Die literale 3-Zeichen-Folge ist eng genug, dass das FRUEHESTE
       Vorkommen bereits das richtige ist -- gemessen an vier Faellen: Feld zuletzt, Feld vor
       companies, sauberer Text ohne Sonderfall, sogar ein zusaetzliches Zitat mitten im Text. */
    var muster = '{"summary"';
    if (wertStart <= 0 || text.slice(wertStart, wertStart + muster.length) !== muster) return { rest: text, roh: null };
    var i = text.indexOf('"}"', wertStart);
    if (i < 0) return { rest: text, roh: null };
    var roh = text.slice(wertStart, i + 2);
    return { rest: text.slice(0, start) + '"markdown_summary": null' + text.slice(i + 3), roh: roh };
  }

  /* Wortgleich tryParseSummary aus dem bestehenden Zusammenfassungs-Widget der App -- keine neue
     Erfindung, dieselbe Ausleseregel: erst JSON.parse (auch doppelt verpackt), sonst per Regex
     "summary": "..." heraus, die vier gaengigen Escapes von Hand aufgeloest. */
  function parseSummary(s){
    if (!s) return "";
    var t = String(s).trim();
    try {
      var p1 = JSON.parse(t);
      if (typeof p1 === "string") {
        try { var p2 = JSON.parse(p1); return (p2 && p2.summary) || p1; } catch (e2) { return p1; }
      }
      return (p1 && p1.summary) || t;
    } catch (e) {
      var m = t.match(/"summary"\s*:\s*"([\s\S]*?)"\s*}/i);
      if (m && m[1]) return m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
      return t;
    }
  }

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
      art: "iframe", hoehe: 740,
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
      art: "iframe", hoehe: 600,
      src: function (u) {
        var m = /(?:activity-|urn:li:(?:activity|share|ugcPost):)(\d{6,})/i.exec(u);
        return "https://www.linkedin.com/embed/feed/update/urn:li:share:" + (m ? m[1] : "");
      }
    },
    {
      /* embed.reddit.com meldet seine tatsaechliche Hoehe nie ueber die Seitengrenze hinweg --
         weder per Auto-Resize noch per Scroll: Reddits eigene Seite blockiert internes Scrollen
         selbst (eigenes overflow:hidden vermutlich), scrolling="auto" auf unserer Seite aendert
         daran nichts, das ist gegengeprueft (Nutzer-Report: "einige Embeds abgeschnitten" BLIEB
         trotz scrollErlaubt:true bestehen). Auch der Script-Weg (widgets.js) haette nichts
         gebracht -- Reddits eigenes Beispiel dafuer setzt ebenfalls nur eine FESTE
         data-embed-height, kein Auto-Resize. Und die oEmbed-API liefert weder Hoehe/Breite noch
         einen CORS-Header, an dem man das programmatisch vorab abfragen koennte -- auch nicht in
         echter Produktion, nicht nur in dieser Sandbox. Es gibt keine Zahl, die fuer jeden Beitrag
         stimmt: kurze Beitraege bekommen etwas Leerraum, ungewoehnlich lange werden am unteren
         Rand abgeschnitten. Vor die Wahl gestellt, welcher der beiden Fehler bleiben darf, hat der
         Nutzer sich am 24.08. fuer Leerraum statt Abschneiden entschieden, 400px als Punkt
         dazwischen. */
      key: "reddit", label: "Reddit",
      passt: function (u) { return /reddit\.com\/r\/[^\/]+\/comments\/[a-z0-9]+/i.test(u); },
      art: "iframe", hoehe: 400, scrollErlaubt: true,
      src: function (u) {
        var m = /reddit\.com(\/r\/[^\/]+\/comments\/[^?#]*)/i.exec(u);
        return "https://embed.reddit.com" + (m ? m[1] : "") + "?embed=true";
      }
    },
    {
      /* Facebooks eigene Doku (developers.facebook.com/docs/plugins/embedded-posts, 24.08.
         gegengeprueft) warnt ausdruecklich: "Do not use CSS style tags to adjust the size of a
         plugin" -- das SDK verwaltet die Groesse seines iframes selbst (startet 1000x1000
         unsichtbar, schrumpft danach auf die echte Groesse). Der bisherige Weg -- ein roher
         iframe auf facebook.com/plugins/post.php -- ist Facebooks AELTERER, eigenstaendiger Weg
         und genau der, an dem "Cannot listen to an undefined element" auftrat: das ist ein Fehler
         AUS Facebooks eigenem Code, der IN diesem iframe laeuft, nicht aus unserem.
         Jetzt der offizielle, aktuelle Weg -- derselbe wie bei Instagram/X: Script einmal laden,
         Markup einsetzen, danach ausdruecklich FB.XFBML.parse() rufen. Ohne das verarbeitet das
         SDK ein spaeter eingefuegtes fb-post-div nicht, exakt dieselbe Falle wie bei TikToks
         embed.js. Keine feste Groesse im Markup -- "Leave empty to use fluid width" laut Doku. */
      key: "facebook", label: "Facebook",
      passt: function (u) { return /facebook\.com\/[^\/]+\/(posts|videos)\//i.test(u); },
      /* Ein Facebook-VIDEO ist wie YouTube ein Bild-/Bewegtbild-Format -- volle Spaltenbreite
         wirkt dort so ueberproportional wie beim YouTube-Embed. Ein normaler Facebook-POST bleibt
         textlastig (siehe Begruendung bei der Breiten-Regel unten) und damit bei 100%. */
      merkmal: function (u) { return /facebook\.com\/[^\/]+\/videos\//i.test(u) ? "video" : "post"; },
      art: "script", skript: "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0",
      markup: function (u) {
        return '<div id="fb-root"></div><div class="fb-post" data-href="' + esc(u) + '"></div>';
      },
      anstossen: function (el) {
        try { if (window.FB && window.FB.XFBML) window.FB.XFBML.parse(el); } catch (e) {}
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
    /* Abschnitte, keine Karten -- wie in response-detail. Eine Karte je Block macht aus einer
       Detailseite eine Kachelwand; die Ueberschrift traegt den Abschnitt, nicht ein Rahmen.
       Umrandet ist nur, was einen Rahmen BRAUCHT: das Embed (fremder Inhalt) und die Tabelle. */
    return '' +
      '<div class="uud-sect uud-sect-kpi">' +
        '<div class="uud-kpis"></div>' +
      '</div>' +

      '<div class="uud-sect uud-sect-ments" hidden>' +
        '<div class="uud-sec"><div class="uud-sec-txt">' +
          '<span class="uud-sec-title">Mentions</span>' +
          '<span class="uud-sec-desc">Relevant brands referenced on this page</span>' +
        '</div></div>' +
        '<div class="uud-ments up-mentlist"></div>' +
      '</div>' +

      '<div class="uud-sect uud-sect-embed" hidden>' +
        '<div class="uud-sec"><div class="uud-sec-txt">' +
          '<span class="uud-sec-title uud-embedtitle"></span>' +
          '<span class="uud-sec-desc uud-embeddesc"></span>' +
        '</div></div>' +
        '<div class="uud-embed"></div>' +
      '</div>' +

      '<div class="uud-sect uud-sect-meta" hidden>' +
        '<div class="uud-sec"><div class="uud-sec-txt">' +
          '<span class="uud-sec-title">Meta Description</span>' +
          '<span class="uud-sec-desc">The page\'s SEO description</span>' +
        '</div></div>' +
        '<div class="uud-quote"><span class="uud-rule"></span>' +
          '<p class="uud-text uud-meta"></p></div>' +
      '</div>' +

      '<div class="uud-sect uud-sect-sum" hidden>' +
        '<div class="uud-sec"><div class="uud-sec-txt">' +
          '<span class="uud-sec-title">AI Summary</span>' +
          '<span class="uud-sec-desc">High-level summary of this page</span>' +
        '</div></div>' +
        '<div class="uud-quote"><span class="uud-rule"></span>' +
          '<p class="uud-text uud-sum"></p></div>' +
      '</div>' +

      '<div class="uud-sect uud-sect-conv" hidden>' +
        '<div class="uud-sec"><div class="uud-sec-txt">' +
          '<span class="uud-sec-title">Citation Conversion</span>' +
          '<span class="uud-sec-desc">How often this citation leads to brand mentions</span>' +
        '</div></div>' +
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
    /* Die Schwellen haengen an der KPI-Leiste, nicht an einem runden Wert: sechs Felder brauchen
       6*120 + 5*16 = 800px, drei brauchen 3*120 + 2*16 = 392. Darunter zwei.
       Der Grund fuer genau 6/3/2 und nicht "was gerade passt": eine Zeile mit fuenf Feldern und
       eine mit einem darunter sieht aus wie ein Fehler. Teiler von sechs, also bricht es immer
       gleichmaessig -- 3 und 3, dann 2 und 2 und 2. */
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 800, vnarrowAt: 400 });

    var elKpis   = root.querySelector(".uud-kpis");
    var elMentSect = root.querySelector(".uud-sect-ments");
    var elMents  = root.querySelector(".uud-ments");
    var elEmbedSect = root.querySelector(".uud-sect-embed");
    var elEmbedTitle = root.querySelector(".uud-embedtitle");
    var elEmbedDesc = root.querySelector(".uud-embeddesc");
    var elEmbed  = root.querySelector(".uud-embed");
    var elMetaSect = root.querySelector(".uud-sect-meta");
    var elMeta   = root.querySelector(".uud-meta");
    var elSumSect = root.querySelector(".uud-sect-sum");
    var elSum    = root.querySelector(".uud-sum");
    var elConvSect = root.querySelector(".uud-sect-conv");
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
      oembed: null,
      /* Getrennt vom Payload gesetzt -- siehe setSummary. */
      summary: ""
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
          return '<div class="up-explain-vis">' + vorschau(k) + '</div>' +
                 '<div class="up-explain-h">' + esc(label) + '</div>' +
                 '<div class="up-explain-t">' + esc(satz) + '</div>';
        }
        return '<div class="up-explain-vis">' + vorschau(k) + '</div>' +
               '<div class="up-explain-h">' + esc(k.title) + '</div>' +
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

    /* Der Vorschau-Block der Erklaerkarte. Ohne ihn ist es keine Erklaerkarte der App, sondern
       ein Kasten mit Text -- jede andere Erklaerung dieser App zeigt oben, WIE der Wert aussieht,
       ueber den sie spricht. Das Muster ist das von prompts-table (explainVisual): eine Zeile im
       Kasten, aufgebaut aus denselben Bauteilen wie die Zelle selbst. */
    function vorschau(k) {
      if (k.typ) {
        /* Der Chip in seiner echten Form, mit dem echten Wert -- inklusive Punkt beim URL-Typ. */
        return '<span class="up-explain-row">' + kpiWert(k) + '</span>';
      }
      if (k.key === "last_seen") return '<span class="up-explain-row">23. Aug 2026</span>';
      if (k.key === "global_rank") {
        return '<span class="up-explain-row">' + rangHtml(1) + '</span>';
      }
      return '<span class="up-explain-row">' + esc(UC.fmtPct(k.key === "domain_share" ? 99.2 : 11.6, 1)) + '</span>';
    }
    /* Die Platzziffer an einer Stelle: das Gitter braucht sie, die Erklaerkarte auch, und zwei
       Kopien laufen auseinander. */
    /* UC.HASH_ICON kommt OHNE Klasse -- visibility-chart und performance-radar haengen sie
       genauso selbst an. Ohne .up-hash faellt die Raute auf currentColor und die Groesse des
       Textes zurueck; mit ihr steht sie in der dritten Farbe, und die Zeile darunter macht sie
       zwei Punkt kleiner als die Zahl daneben. */
    var HASH = UC.HASH_ICON ? UC.HASH_ICON.replace("<svg ", '<svg class="up-hash" ') : "";
    function rangHtml(n) {
      return '<span class="up-rank-group uud-rank">' + HASH +
             '<span class="uud-kpi-num">' + esc(String(n)) + '</span></span>';
    }
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
        return r == null ? LEER : rangHtml(Math.round(r));
      }
      var p = num(v);
      if (p == null) return LEER;
      return '<span class="uud-kpi-num">' + esc(UC.fmtPct(p, 1)) + '</span>';
    }

    function renderKpis() {
      elKpis.innerHTML = KPIS.map(function (k) {
        /* Ueberschrift ZUERST, Wert darunter -- so steht es auf der Seite und so wird es
           vorgelesen. Vorher stand der Wert oben und die Ueberschrift darunter; die Umkehr im
           Markup und nicht per column-reverse in der CSS, damit Lesereihenfolge und Bild
           dasselbe sagen. */
        return '<div class="uud-kpi">' +
                 '<span class="uud-kpi-lbl">' + esc(k.label) +
                   /* Das Symbol kommt aus UC.icon wie ueberall -- nie selbst gezeichnet. */
                   '<span class="up-th-info uud-info" data-explain="' + esc(k.key) + '">' +
                     UC.icon("info", 2) + '</span>' +
                 '</span>' +
                 '<span class="uud-kpi-val">' + kpiWert(k) + '</span>' +
               '</div>';
      }).join("");
    }

    /* companies kann als echtes Array ankommen ODER als roher JSON-Text -- die Feld-fuer-Feld-
       Vorlage setzt jedes Feld einzeln in Backticks, auch companies, und dann ist es beim ersten
       Lesen ein STRING, kein Array. UC.readBubble liest es nach, genau wie bei jedem anderen
       Textfeld. Ohne das blieb die Mention-Liste leer, sobald companies so eingesetzt wurde. */
    function companies() {
      var c = d().companies;
      if (isArr(c)) return c;
      if (typeof c === "string" && c.trim()) {
        var p = UC.readBubble ? UC.readBubble(c) : null;
        if (isArr(p)) return p;
      }
      return [];
    }
    function renderMents() {
      var liste = companies();
      elMentSect.hidden = !liste.length;
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
      elEmbedSect.hidden = !a;
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

      /* Die Breite je Anbieter (85% YouTube, 50% Instagram, volle Breite sonst, unter 800px
         Wurzelbreite ueberall 100%) steht in der CSS, ueber data-anbieter angesprochen -- nicht
         hier als Inline-Stil. Das JS setzt nur noch Hoehe/Seitenverhaeltnis, die von der Anbieter-
         KONFIGURATION kommen, keine feste Breite mehr. */
      if (a.art === "iframe") {
        var stil = a.ratio ? 'style="padding-top:' + a.ratio + '%"' : 'style="height:' + (a.hoehe || 560) + 'px"';
        elEmbed.innerHTML = '<div class="uud-frame' + (a.ratio ? " is-ratio" : "") + '" data-anbieter="' + a.key + '" ' + stil + '>' +
          /* scrolling="no": veraltetes Attribut, aber von jedem Browser weiter beachtet (HTML
             Living Standard fuehrt es als "obsolete but conforming"). Ohne das zeigt ein Anbieter,
             dessen Inhalt hoeher ist als unser fester Rahmen, einen eigenen Scrollbalken IN der
             iframe -- bei fremdem, cross-origin Inhalt kommt CSS da nicht ran, das Attribut schon.
             a.scrollErlaubt (bisher nur Reddit): Abschneiden ist schlimmer als ein Scrollbalken --
             siehe Begruendung am Reddit-Eintrag oben. */
          '<iframe src="' + esc(a.src(url)) + '" loading="lazy" allowfullscreen scrolling="' +
            (a.scrollErlaubt ? "auto" : "no") + '"' +
            ' referrerpolicy="strict-origin-when-cross-origin"' +
            ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"' +
            ' title="' + esc(a.label) + ' embed"></iframe>' +
        '</div>';
      } else {
        var merkmal = a.merkmal ? (a.merkmal(url) || "") : "";
        elEmbed.innerHTML = '<div class="uud-social" data-anbieter="' + a.key + '"' +
          (merkmal ? ' data-merkmal="' + esc(merkmal) + '"' : "") + '>' + a.markup(url) + '</div>';
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
      elMetaSect.hidden = !zeigen;
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
      /* state.summary gewinnt, wenn setUrlDetailSummary eigens gerufen wurde; sonst das Feld aus
         dem Payload -- beide durch dieselbe Ausleseregel (parseSummary). */
      /* state.summary ist "" solange setUrlDetailSummary nie gerufen wurde -- ein leerer Text
         zaehlt hier NICHT als "gewinnt", sonst verdeckt der leere Standardwert das echte Feld
         aus dem Payload. Nur ein WIRKLICH gesetzter Text gewinnt. */
      var roh = state.summary ? state.summary : d().markdown_summary;
      var t = (roh && typeof roh === "object") ? txt(roh.summary) : parseSummary(roh);
      elSumSect.hidden = !t;
      if (t) elSum.textContent = t;
    }

    /* ---- Citation Conversion ----------------------------------------------------------------- */

    /* Eine kompakte Tabelle, keine Balkenliste: hier stehen drei Zahlen je Marke nebeneinander
       (zitiert, genannt, Quote), und die liest man in Spalten, nicht in Balkenlaengen.
       Warum NICHT .up-row aus core als Raster: das ist das Gitter der grossen Tabellen -- 72px
       hohe Zeilen, verschiebbare Spalten, var(--up-cols). Hier stehen vier feste Spalten in einem
       Abschnitt. core loest denselben Fall selbst so: .up-vartable schaltet .up-row auf
       display:flex zurueck, weil sein Raster nicht passt. Dieselbe Ausnahme, hier noch einmal --
       Kopf- und Zellenaussehen borgt sie sich weiter bei .up-thead/.up-th/.up-td, damit sie wie
       eine Tabelle dieser App liest. */
    function renderConv() {
      var rows = state.conv || [];
      elConvSect.hidden = !rows.length;
      if (!rows.length) { elConv.innerHTML = ""; return; }
      var sortiert = rows.slice().sort(function (x, y) {
        return (num(y.citation_conversion_pct) || 0) - (num(x.citation_conversion_pct) || 0);
      });
      elConv.innerHTML =
        '<div class="uud-ctable">' +
          '<div class="up-thead uud-crow">' +
            '<div class="up-th uud-cbrand">Brand</div>' +
            '<div class="up-th uud-cnum">Conversion</div>' +
          '</div>' +
          sortiert.map(function (r) {
            var name = txt(r.company_name);
            var logo = txt(r.logo_url);
            var buchst = (name.charAt(0) || "?").toUpperCase();
            var pct = num(r.citation_conversion_pct);
            return '<div class="up-row uud-crow uud-cbody" data-brand="' + esc(txt(r.company_id)) +
                     '" role="button" tabindex="0">' +
              '<div class="up-td uud-cbrand">' +
                '<span class="up-ment-logo' + (logo ? " has-img" : "") + '">' +
                  '<span class="up-model-ltr">' + esc(buchst) + '</span>' +
                  (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                          ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "") +
                '</span>' +
                '<span class="uud-cname">' + esc(name) + '</span>' +
              '</div>' +
              '<div class="up-td uud-cnum">' +
                (pct == null ? LEER :
                  /* UC.sentColor ist die Gut/Schlecht-Skala dieser App: rot unter 25, orange bis 40,
                     grau bis 60, hellgruen bis 75, gruen darueber -- dieselben Schwellen, die die
                     Sentiment-Spalte in prompts-table und visibility-chart benutzen. Eine zweite
                     Skala fuer denselben Gedanken waere eine Skala zu viel.
                     Die Farbe traegt der Shape, die Zahl steht in der Primaerfarbe: der Wert soll
                     lesbar sein, die Bewertung daneben stehen. */
                  '<span class="uud-cpct">' +
                    '<span class="uud-cdot" style="background:' + esc(UC.sentColor(pct)) + '"></span>' +
                    '<span class="up-num">' + esc(UC.fmtPct(pct, 1)) + '</span>' +
                  '</span>') +
              '</div>' +
            '</div>';
          }).join("") +
        '</div>';
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
      /* Chip und Tabellenzeile feuern DASSELBE Ereignis -- es ist derselbe Sprung zur Marke, und
         zwei Ereignisse fuer einen Weg sind eines zu viel. */
      var ziel = e.target.closest && e.target.closest(".uud-ment, .uud-cbody");
      if (ziel) {
        fire("data-brand-fn", "uudBrand", {
          company_id: ziel.getAttribute("data-brand") || "",
          company_name: ((ziel.querySelector(".up-ment-name") || ziel.querySelector(".uud-cname")) || {}).textContent || ""
        });
      }
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var ziel2 = e.target.closest && e.target.closest(".uud-ment, .uud-cbody");
      if (!ziel2) return;
      e.preventDefault();
      ziel2.click();
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
        var text = (payload && typeof payload === "object") ? null : txt(payload);
        var p = null, mitgerissen = null;
        if (text) {
          /* Der Blick VOR dem eigentlichen Lesen: traegt der Text das bekannte kaputte Muster
             ({"summary" roh, ohne \" davor), waere der erste Versuch ueber readBubble ohnehin
             zum Scheitern verurteilt -- und dessen eigener parseBubbleJson-Zweig meldet JEDEN
             Fehlschlag mit einer eigenen Konsolenwarnung, auch wenn die zweite, gezielte
             Extraktion gleich danach erfolgreich ist. Gemessen: die Seite zeigte alle Felder
             richtig UND eine Warnung stand trotzdem da -- fuer einen Fall, der laengst behoben
             ist. Bei bekanntem Muster also direkt zur Extraktion, der normale Weg bleibt fuer
             alles andere (echte, unbekannte Fehler sollen weiter warnen). */
          var bekanntesMuster = /"markdown_summary"\s*:\s*"\{"summary"/.test(text);
          var gezogen = bekanntesMuster ? ziehMarkdownSummary(text) : null;
          if (gezogen && gezogen.roh != null) {
            mitgerissen = gezogen.roh;
            p = UC.readBubble ? UC.readBubble(gezogen.rest) : null;
          } else {
            p = UC.readBubble ? UC.readBubble(text) : null;
          }
        } else {
          p = payload;
        }
        if (isArr(p)) p = p[0];
        var ok = p && typeof p === "object";
        if (ok && mitgerissen != null && p.markdown_summary === null) p.markdown_summary = mitgerissen;
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
      /* Optional: fuer Aufbauten, die markdown_summary bereits als EIGENEN Bubble-Wert haben
         (getrennt vom Rest der Zeile) -- dieselbe Ausleseregel wie beim eingebetteten Feld
         (parseSummary), nur ohne den Umweg ueber setData. Wird dieser Setter nie gerufen, liest
         renderSum() das Feld direkt aus dem Payload von setData. */
      setSummary: function (payload) {
        var roh = (payload && typeof payload === "object") ? payload : txt(payload);
        state.summary = (roh && typeof roh === "object") ? txt(roh.summary) : parseSummary(roh);
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
        state.summary = "";
        state.embedKey = ""; state.oembed = null;
        elEmbed.innerHTML = "";
        elEmbedTitle.textContent = ""; elEmbedDesc.textContent = "";
        elMents.innerHTML = ""; elMeta.textContent = ""; elSum.textContent = "";
        elConv.innerHTML = "";
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
      setUrlDetailSummary:    function (id, p) { return each(id, function (c) { c.setSummary(p); }); },
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
