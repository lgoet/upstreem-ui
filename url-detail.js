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

  /* ---- EIN NEU GEBAUTES ELEMENT MACHT WEITER (27.09. gemeldet) ----
     "Es ist gar nicht noetig, dass beim Theme-Wechsel was in den Loading-yes-State geht."
     Themenwechsel -> Bubble baut das Element neu (data-isdark ist ein dynamischer Wert im
     Markup) -> neue Wurzel mit derselben data-instance, initRoot von vorn -> loading true, und
     weil diese Komponente keine Warte-Uhr hat, pulsierte das Skelett fuer immer. Bubble schickt
     die Daten nicht noch einmal, sie haben sich ja nicht geaendert.
     Jetzt liegt der zuletzt gelieferte Stand hier, je Instanz, und eine neue Wurzel startet von
     dort. Dasselbe Muster wie responses-table und urls-table; geschrieben wird er von persist()
     in initRoot, nach jedem Setter. */
  var STORE = (window.__uudStore = window.__uudStore || {});

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
      /* DER TYP DER KENNUNG KOMMT AUS DER ADRESSE (30.09. gemeldet: jede LinkedIn-Einbettung
         zeigte "Seite nicht gefunden", obwohl es die Beitraege gibt). Hier stand fest
         urn:li:share: -- eine Beitragsadresse (/posts/...-activity-<id>-...) traegt aber eine
         ACTIVITY-Kennung, und unter share gibt es diese Nummer nicht. Gemessen an zwei
         oeffentlichen Beitraegen (Person und Unternehmen): share -> "Seite nicht gefunden",
         activity -> der Beitrag. Steht der Typ ausdruecklich in der Adresse (urn:li:share:,
         urn:li:ugcPost:), gilt er so. */
      src: function (u) {
        var m = /(?:urn:li:(activity|share|ugcPost):|activity-)(\d{6,})/i.exec(u);
        var art = m && m[1] ? m[1] : "activity";
        return "https://www.linkedin.com/embed/feed/update/urn:li:" + art + ":" + (m ? m[2] : "");
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

  /* Balken aus core (.up-tsk-bar: 12px hoch, Radius 4, --vc-sk, uutpulse) -- derselbe Balken, den
     UC.skeletonRows in die Tabellen legt. Nur die Breiten stehen in der CSS, denn sie haengen am
     Text darunter: volle Zeilen, die letzte kuerzer.
     Im Modul-Scope und nicht in initRoot: shell() steht hier oben und wuerde eine Funktion aus dem
     Instanz-Scope nicht sehen. */
  function skelettText(zeilen) {
    var n = zeilen || 3, out = "", i;
    for (i = 0; i < n; i++) out += '<span class="up-tsk-bar"></span>';
    return '<span class="uud-sk" aria-hidden="true">' + out + '</span>';
  }

  function shell() {
    /* Abschnitte, keine Karten -- wie in response-detail. Eine Karte je Block macht aus einer
       Detailseite eine Kachelwand; die Ueberschrift traegt den Abschnitt, nicht ein Rahmen.
       Umrandet ist nur, was einen Rahmen BRAUCHT: das Embed (fremder Inhalt) und die Tabelle. */
    /* DER KOPF (v3, 12.10., nach dem Vorbild Response Detail): Meta-Zeile (Domain, die zwei Typen,
       zuletzt gesehen), der Titel der Seite, darunter ihre Adresse als Link nach draussen, die
       Leiste der Kennzahlen und die Leiste der genannten Marken. Die Bausteine kommen aus core
       (.up-dk-*); vorher standen sechs Kennzahlen gleichrangig in einem Raster und die Marken als
       eigener Abschnitt "Mentions". */
    return '' +
      '<div class="uud-sect uud-head up-dk">' +
        '<div class="uud-kopfzeile up-dk-meta"></div>' +
        '<h2 class="uud-titel up-dk-titel"></h2>' +
        '<a class="uud-link" target="_blank" rel="noopener noreferrer" hidden></a>' +
        '<div class="uud-kpis up-dk-leiste"></div>' +
        '<div class="uud-mrow up-dk-leiste" hidden>' +
          '<span class="up-dk-zahl"><span class="up-dk-zahl-n uud-mrow-n"></span><span class="uud-mrow-wort"></span></span>' +
          '<div class="uud-ments up-mentlist"></div>' +
        '</div>' +
      '</div>' +

      '<div class="uud-sect uud-sect-embed" hidden>' +
        '<div class="uud-sec"><div class="uud-sec-txt">' +
          '<span class="uud-sec-title up-dk-h2 uud-embedtitle"></span>' +
          '<span class="uud-sec-desc up-dk-unter uud-embeddesc"></span>' +
        '</div></div>' +
        '<div class="uud-embed"></div>' +
      '</div>' +

      '<div class="uud-sect uud-sect-meta" hidden>' +
        '<div class="uud-sec"><div class="uud-sec-txt">' +
          '<span class="uud-sec-title up-dk-h2">Meta Description</span>' +
          '<span class="uud-sec-desc up-dk-unter">The page\'s SEO description</span>' +
        '</div></div>' +
        /* Das Skelett steht IM Markup und nicht erst im Ladezustand: die CSS blendet es um,
           und damit gibt es keinen zweiten Aufbau, den jemand pflegen muss. Drei Balken, der
           letzte kuerzer -- so endet ein Absatz. */
        '<div class="uud-quote">' + skelettText() +
          '<p class="uud-text uud-meta"></p></div>' +
      '</div>' +

      '<div class="uud-sect uud-sect-sum" hidden>' +
        '<div class="uud-sec"><div class="uud-sec-txt">' +
          '<span class="uud-sec-title up-dk-h2">AI Summary</span>' +
          '<span class="uud-sec-desc up-dk-unter">High-level summary of this page</span>' +
        '</div></div>' +
        '<div class="uud-quote">' + skelettText(4) +
          '<p class="uud-text uud-sum"></p></div>' +
      '</div>' +

      '<div class="uud-sect uud-sect-conv" hidden>' +
        '<div class="uud-sec"><div class="uud-sec-txt">' +
          '<span class="uud-sec-title up-dk-h2">Citation Conversion</span>' +
          '<span class="uud-sec-desc up-dk-unter">How often this citation leads to brand mentions</span>' +
        '</div></div>' +
        '<div class="uud-conv"></div>' +
      '</div>' +

      /* Gibt es zu einer URL GAR NICHTS zu zeigen -- keine Mentions, keine Einbettung, keine
         Beschreibung, keine Zusammenfassung, keine Conversion --, steht hier ein kleiner
         Platzhalter statt einer Seite, die nach den Kennzahlen einfach aufhoert (30.09.). */
      '<div class="uud-sect uud-sect-leer" hidden></div>' +

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
    var elMeta0  = root.querySelector(".uud-kopfzeile");
    var elTitel  = root.querySelector(".uud-titel");
    var elLink   = root.querySelector(".uud-link");
    var elMentSect = root.querySelector(".uud-mrow");
    var elMents  = root.querySelector(".uud-ments");
    var elMN     = root.querySelector(".uud-mrow-n");
    var elMWort  = root.querySelector(".uud-mrow-wort");
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
    var elLeerSect = root.querySelector(".uud-sect-leer");
    /* Der Leerzustand aus core (UC.leerHtml): Symbol und eine Zeile, kein Knopf -- es gibt hier
       nichts, was der Nutzer tun koennte. */
    if (elLeerSect && UC.leerHtml) elLeerSect.innerHTML = UC.leerHtml({ icon: "fileText", titel: "No data for this URL yet" });

    var isDark = UC.themeParam ? UC.themeParam(root.getAttribute("data-isdark")) : false;
    function dunkel() { return isDark; }

    /* Der gemerkte Stand dieser Instanz, wenn es ihn gibt -- dann ist diese Wurzel ein Neuaufbau
       und macht dort weiter, wo die alte stand (siehe STORE). Ohne ihn gelten genau die
       Anfangswerte von vorher; gemerkt() liefert dann den zweiten Wert. */
    var saved = STORE[instanceId] || null;
    function gemerkt(k, sonst) { return saved && saved[k] != null ? saved[k] : sonst; }

    var state = {
      data: gemerkt("data", null),
      conv: gemerkt("conv", []),
      /* true beim ersten Aufbau: die Seite steht, bevor der Workflow lief. Ein Neuaufbau
         uebernimmt den Zustand der alten Wurzel -- nach den Daten also false. */
      loading: gemerkt("loading", true),
      fehler: gemerkt("fehler", ""),
      /* Der zuletzt eingebettete Anbieter samt Adresse. Ohne das baut jeder Render den iframe neu,
         und ein laufendes Video springt beim ersten Datenupdate zurueck auf Anfang.
         NICHT aus dem Speicher: die neue Wurzel hat noch kein Embed, also muss der erste Render
         es bauen -- mit einer gemerkten Kennung hielte renderEmbed es fuer schon vorhanden. */
      embedKey: "",
      oembed: null,
      /* Getrennt vom Payload gesetzt -- siehe setSummary. */
      summary: gemerkt("summary", "")
    };

    /* Den Stand dieser Instanz fuer einen Neuaufbau festhalten (siehe STORE). Aufgerufen NACH dem
       Zeichnen: wirft render() an einem Payload, landet dieser nicht im Speicher -- sonst wuerfe
       jeder spaetere Neuaufbau schon in initRoot, und die Komponente kaeme nie wieder hoch.
       Nur eine Wurzel im Dokument schreibt: eine abgehaengte lebt in ihren Abonnements noch
       weiter und wuerde den Stand der neuen sonst mit ihrem alten ueberschreiben. */
    function persist() {
      if (root.isConnected === false) return;
      STORE[instanceId] = {
        data: state.data, conv: state.conv, loading: !!state.loading,
        fehler: state.fehler || "", summary: state.summary || ""
      };
    }

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

    /* ---- Der Kopf (v3) ----------------------------------------------------------------------
       Meta-Zeile: Domain (Favicon und Name, oeffnet den Domain-Drawer), Zitationstyp, URL-Typ,
       zuletzt gesehen -- getrennt durch den feinen Strich aus core. Die Typen und das Datum tragen
       ihre Erklaerkarte am Element selbst (data-explain), nicht an einem Info-Zeichen: in einer
       Zeile aus Angaben waere ein Zeichen je Angabe Rauschen.
       Leiste der Kennzahlen: nur die drei Zahlen (Domain Share, Global Share, URL Rank), je mit
       Ueberschrift und Info-Zeichen wie bisher. */
    var STRICH = '<span class="up-dk-sep" aria-hidden="true"></span>';
    var KENNZAHLEN = ["domain_share", "global_share", "global_rank"];
    /* Nur http(s) wird zum Link und nur http(s) oder // zum Bild -- die Adressen kommen aus dem
       Crawl (Befund des DB-Chats 11.10.: es gibt Quellen ohne Schema und eine mit dem Text null). */
    function linkAdresse(u) { u = txt(u); return /^https?:\/\//i.test(u) ? u : ""; }
    function bildAdresse(u) { u = txt(u); return /^(https?:)?\/\//i.test(u) ? u : ""; }
    function anzeigeAdresse(u) {
      try { var x = new URL(u); var o = x.hostname.replace(/^www\./i, "") + x.pathname + x.search;
        return o.length > 1 && o.charAt(o.length - 1) === "/" ? o.slice(0, -1) : o; }
      catch (e) { return txt(u).replace(/^https?:\/\//i, "").replace(/^www\./i, ""); }
    }
    function renderKpis() {
      var x = d(), laedt = !!state.loading && !state.data;
      if (laedt) {
        elMeta0.innerHTML = '<span class="uud-skz is-m"></span><span class="uud-skz is-s"></span><span class="uud-skz is-s"></span>';
        elTitel.innerHTML = '<span class="uud-skz is-titel"></span><span class="uud-skz is-titel2"></span>';
        elLink.hidden = true;
      } else {
        var teile = [];
        var dom = txt(x.domain), fav = bildAdresse(x.favicon);
        if (dom) teile.push('<span class="uud-domain" role="button" tabindex="0" data-domain="' + esc(dom) + '"' +
          ' data-tip="' + esc(UC.t("Open domain")) + '">' +
          '<span class="up-ment-logo' + (fav ? " has-img" : "") + '"><span class="up-model-ltr">' +
            esc((dom.charAt(0) || "?").toUpperCase()) + '</span>' +
            (fav ? '<img src="' + esc(fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                   ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "") +
          '</span><span class="uud-domain-txt">' + esc(dom) + '</span></span>');
        KPIS.forEach(function (k) {
          if (!k.typ) return;
          if (!txt(x[k.key])) return;
          teile.push('<span class="uud-metachip" data-explain="' + esc(k.key) + '">' + kpiWert(k) + '</span>');
        });
        /* url_detail_v1: last_cited_at ist das letzte Zitat des Teams -- DAS ist "zuletzt gesehen".
           last_scraped_at sagt nur, wann die Seite gelesen wurde, und steht hier nicht. */
        var ls = txt(x.last_cited_at || x.last_seen);
        if (ls) teile.push('<span class="uud-zuletzt" data-explain="last_seen">' +
          esc(UC.t("Last seen {date}").replace("{date}", UC.fmtDate(ls))) + '</span>');
        elMeta0.innerHTML = teile.join(STRICH);
        var url = txt(x.url);
        elTitel.textContent = txt(x.title) || anzeigeAdresse(url) || "\u2013";
        var href = linkAdresse(url);
        elLink.hidden = !url;
        if (url) {
          if (href) elLink.setAttribute("href", href); else elLink.removeAttribute("href");
          elLink.innerHTML = '<span class="uud-link-txt">' + esc(anzeigeAdresse(url)) + '</span>' +
            (href ? UC.icon("externalLink", 2) : "");
        }
      }
      /* NICHT IM ZEITRAUM (url_detail_v1: in_range false): die Seite wurde zitiert, nur nicht im
         gewaehlten Zeitraum. Statt drei Nullen und einem Strich ein Satz mit dem letzten Zitat und
         ein Knopf, der den Zeitraum dorthin legt -- so machen es Analytics-Werkzeuge (Vorschlag
         des DB-Chats, 12.10.). Den Knopf gibt es nur, wo jemand den Zeitraum setzen kann. */
      if (!laedt && x.in_range === false) {
        var lc = txt(x.last_cited_at);
        elKpis.classList.add("is-hinweis");
        elKpis.innerHTML = '<span class="uud-hinweis">' + esc(lc
            ? UC.t("Not cited in the selected period. Last cited on {date}.").replace("{date}", UC.fmtDate(lc))
            : UC.t("Not cited in the selected period.")) + '</span>' +
          (lc && typeof root.__uudZeitraum === "function"
            ? '<button type="button" class="up-btn-sec uud-zeitraum" data-uud-zeitraum>' + esc(UC.t("Adjust period")) + '</button>' : "");
        return;
      }
      elKpis.classList.remove("is-hinweis");
      elKpis.innerHTML = KPIS.filter(function (k) { return KENNZAHLEN.indexOf(k.key) >= 0; }).map(function (k) {
        /* Ueberschrift ZUERST, Wert darunter -- so steht es auf der Seite und so wird es
           vorgelesen. Das Symbol kommt aus UC.icon wie ueberall, nie selbst gezeichnet. */
        return '<div class="uud-kpi">' +
                 '<span class="uud-kpi-lbl">' + esc(UC.t(k.label)) +
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
      /* url_detail_v1 (Vorschlag an den DB-Chat): brands[] -- eine Zeile je Marke, logo_url nach
         der Logo-Regel. Sonst companies wie bisher. */
      if (isArr(d().brands)) return d().brands;
      var c = d().companies;
      if (isArr(c)) return c;
      if (typeof c === "string" && c.trim()) {
        var p = UC.readBubble ? UC.readBubble(c) : null;
        if (isArr(p)) return p;
      }
      return [];
    }
    function renderMents() {
      var liste = companies().filter(function (c) { return c && txt(c.company_name || c.name); });
      elMentSect.hidden = !liste.length;
      elMN.textContent = liste.length ? String(liste.length) : "";
      elMWort.textContent = UC.t(liste.length === 1 ? "brand mentioned" : "brands mentioned");
      if (!liste.length) { elMents.innerHTML = ""; return; }
      elMents.innerHTML = liste.map(function (c) {
        var name = txt(c && (c.company_name || c.name));
        var logo = bildAdresse(c && (c.logo_url || c.favicon_url));
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
                  /* NUR DIE ZAHL (29.09. spaet angefordert, "bei Conversion ist der Sentiment-
                     Balken sichtbar -- weg damit"). Die Quote ist keine Stimmung; der Balken aus
                     UC.sentHtml faerbte sie auf der Sentiment-Skala ein. .up-num traegt dieselbe
                     Schrift wie die Zahl darin (14/500, tabular-nums), die Zeile bleibt gleich. */
                  '<span class="up-num">' + esc(UC.fmtPct(pct, 1)) + '</span>') +
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
      /* Erst zu, dann -- nur ganz unten, wenn wirklich alles leer ist -- wieder auf: im Ladezustand
         und im Fehlerfall kehrt render() vorher zurueck, und der Platzhalter der VORIGEN URL
         stuende sonst ueber dem Skelett der naechsten. */
      if (elLeerSect) elLeerSect.hidden = true;
      elFehler.hidden = !state.fehler;
      root.classList.toggle("is-fehler", !!state.fehler);
      if (state.fehler && root.__uudKopf) {
        /* Im Drawer aus core: der Leerzustand aus core, mit "Try again", wo ein zweiter Versuch
           etwas bringen kann (wie Response Detail). */
        elFehler.innerHTML = UC.leerHtml({ icon: "info", titel: "Page not available", text: state.fehler,
          knopf: wiederholbar(state.fehlerCode) ? "Try again" : "", knopfAttr: "data-uud-retry" });
        return;
      }
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
      if (elLeerSect) elLeerSect.hidden = !(elMentSect.hidden && elEmbedSect.hidden &&
        elMetaSect.hidden && elSumSect.hidden && elConvSect.hidden);
    }

    /* Die Codes des direkten Abrufs (UC.rpc und der Vorschlag url_detail_v1) als Satz. Nicht
       wiederholbar ist, was ein zweiter Klick nicht aendert. */
    function fehlerText(code) {
      var c = String(code || "").trim();
      /* url_not_found kommt auch, wenn nur ein ANDERES Team die Adresse zitiert hat -- der Satz
         spricht darum nur vom eigenen Team (Vertrag 12.10.). */
      if (c === "url_not_found") return "Your team has never cited this page.";
      if (c === "team_invalid_param") return "This page could not be found.";
      if (c === "dashboard_invalid_date") return "The selected period isn't valid. Please choose another one.";
      if (c === "settings_not_authenticated" || c === "not authenticated") return "Your session has expired. Please sign in again.";
      if (c === "team_deleted") return "This team has been deleted.";
      if (/^team_access_/.test(c) || c === "forbidden" || c === "team_forbidden") return "Your team doesn't have access right now.";
      if (c === "url_rate_limited") return "Too many requests in a short time. Please wait a moment.";
      return "This page could not be loaded. Please try again.";
    }
    function wiederholbar(code) {
      var c = String(code || "").trim();
      return !(c === "url_not_found" || c === "team_invalid_param" || c === "dashboard_invalid_date" || /^team_access_/.test(c) || c === "forbidden" ||
        c === "team_forbidden" || c === "team_deleted" || c === "not authenticated" || c === "settings_not_authenticated");
    }

    /* ---- Klicks ------------------------------------------------------------------------------ */
    root.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-uud-zeitraum]")) {
        if (typeof root.__uudZeitraum === "function") root.__uudZeitraum(txt(d().last_cited_at));
        return;
      }
      if (e.target.closest && e.target.closest("[data-uud-retry]")) {
        if (typeof root.__uudNeuLaden === "function") root.__uudNeuLaden();
        return;
      }
      /* Die Domain in der Meta-Zeile oeffnet den Domain-Drawer -- derselbe Weg wie der Globus der
         Kopfleiste (openDrawer der Host-App, Ebene 1). */
      var dm = e.target.closest && e.target.closest(".uud-domain[data-domain]");
      if (dm) { if (UC.drawerOeffnen) UC.drawerOeffnen("domain", dm.getAttribute("data-domain"), "url-detail"); return; }
      /* Chip und Tabellenzeile feuern DASSELBE Ereignis -- es ist derselbe Sprung zur Marke, und
         zwei Ereignisse fuer einen Weg sind eines zu viel. */
      var ziel = e.target.closest && e.target.closest(".uud-ment, .uud-cbody");
      if (ziel) {
        var markeId = ziel.getAttribute("data-brand") || "";
        fire("data-brand-fn", "uudBrand", {
          company_id: markeId,
          company_name: ((ziel.querySelector(".up-ment-name") || ziel.querySelector(".uud-cname")) || {}).textContent || ""
        });
        /* UND DER DRAWER GEHT SELBST AUF (25.09. gemeldet: "der Klick macht in Bubble nix").
           Das Ereignis gab es, verdrahtet war es nie -- und es braucht auch keinen Workflow:
           openDrawer der Host-App oeffnet den Brand-Drawer und meldet die Kennung selbst an
           bubble_fn_drawer_brand, derselbe Weg wie die Zeilen im Power Dashboard. Das Ereignis
           feuert weiter, fuer alles, was ZUSAETZLICH passieren soll. */
        if (UC.drawerOeffnen) UC.drawerOeffnen("brand", markeId, "url-detail");
      }
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var ziel2 = e.target.closest && e.target.closest(".uud-ment, .uud-cbody, .uud-domain");
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
        persist();
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
        persist();
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
        persist();
        return true;
      },
      /* url_detail_v1 (Vorschlag an den DB-Chat, 12.10.): EIN Objekt mit allem -- Kopf, brands[],
         conversion[], summary als Klartext, description dekodiert. Ein Aufbau statt drei Settern. */
      setV1: function (row) {
        var ok = row && typeof row === "object" && !isArr(row);
        state.data = ok ? row : null;
        state.conv = ok && isArr(row.conversion) ? row.conversion : [];
        state.summary = ok ? txt(row.summary) : "";
        state.fehler = ok ? "" : "The page data could not be read.";
        state.fehlerCode = "";
        state.loading = false;
        render();
        persist();
        return true;
      },
      setFehlerCode: function (code) {
        state.data = null; state.conv = []; state.summary = "";
        state.fehler = fehlerText(code); state.fehlerCode = String(code || "");
        state.loading = false;
        render();
        persist();
        return true;
      },
      setLoading: function (v) {
        state.loading = UC.isYes(v);
        if (state.loading) state.fehler = "";
        render();
        persist();
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
        /* Der geleerte Stand ersetzt den gemerkten: ein Neuaufbau nach dem Reset zeigt nicht die
           alte Seite, sondern wartet wie diese Wurzel. */
        persist();
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

  /* ==========================================================================================
     ALS DRAWER AUS CORE (12.10.): Seite, Kalender und Antworten in einem
     ==========================================================================================
     Steht keine Bubble-Floating-Group #drawer-url mehr auf der Seite, baut core die Huelle
     (core.js, KERN_DRAWER) und ruft hier zeigen(<adresse>) -- vor dem Hereinfahren. Darin:
       - oben rechts der Kalender (lokal, nimmt am geteilten Zeitraum teil wie jeder andere);
       - diese Komponente (die Seite) aus url_detail_v1;
       - die Responses-Tabelle (responses-table.js, lokaler Modus) aus
         cached_dashboard_responses_v1 mit p_url -- derselbe Weg wie Dashboard und Prompt
         Insights, nur auf diese Adresse eingeschraenkt.
     Kopfleiste (core): "URL / <Titel>", Globus (Domain), Create with AI, Ask Mira, Anheften.
     Vertrag: bubble/url_detail_12_10/AN_CLAUDE_CODE_URL_DETAIL.md (12.10.). Solange die
     Bubble-Gruppe steht, laeuft hier nichts -- die Umstellung ist das Loeschen der Gruppe.
     DIE ADRESSE DER ANTWORT GILT (meta.url): die Datenbank findet eine Seite auch in anderer
     Schreibweise (http/https, www., Schraegstrich, Raute) und nennt sie so, wie das Team sie
     zitiert hat. Tabelle, Export, Pin, Mira und Create with AI nehmen DIESE Schreibweise -- die
     Tabelle laedt darum erst nach der Seite. */
  /* ---- MARKUP ANFANG (erzeugt von .url_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    urt: "<div class=\"up-root urt-root\" data-local=\"yes\" data-merken=\"yes\" data-instance=\"__UUD_URT__\" data-cdn-pin=\"\" data-isdark=\"__UUD_DARK__\" data-brand-name=\"__UUD_BRAND__\" data-brand-logo=\"__UUD_BRANDLOGO__\" data-spotlight-mode=\"no\" data-export-instance=\"\" data-sticky-top=\"16\" data-sticky=\"no\" data-default-view=\"table\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Responses</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"urt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"urt-brand-toggle-lbl\"><img class=\"urt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"urt-brand-label\"></span></span><span class=\"urt-brand-check\"><svg class=\"urt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"urt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"urt-fader\"><button class=\"urt-fader-btn up-iconbtn\" type=\"button\" data-tip=\"Filter by rank &amp; sentiment\" aria-label=\"Filter by rank and sentiment\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg></button><div class=\"urt-fader-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search prompts...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search responses\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"urt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-dense urt-viewswitch\" role=\"group\" aria-label=\"View\"><button class=\"up-dense-btn up-dense-btn-icon is-active\" type=\"button\" data-view=\"table\" data-tip=\"Table view\" aria-label=\"Table view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18\"/></svg></button><button class=\"up-dense-btn up-dense-btn-icon\" type=\"button\" data-view=\"cards\" data-tip=\"Card view\" aria-label=\"Card view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 4V20\"/><path d=\"M18 4V20\"/><path d=\"M21 7L3 7\"/><path d=\"M21 17L3 17\"/></svg></button></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><div class=\"up-th up-th-prompt\">Prompt<span class=\"up-grip\" data-grip=\"prompt\"></span></div><div class=\"up-th up-th-mentioned\"><img class=\"up-th-brandlogo\" src=\"\" alt=\"\" style=\"display:none\"/><span class=\"up-th-mentlbl\">Mentioned</span></div><div class=\"up-th up-th-sentiment is-sortable\" data-sortcol=\"sentiment\"><span class=\"up-th-txt\">Sentiment</span><span class=\"up-thsort\" data-for=\"sentiment\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-rank is-sortable\" data-sortcol=\"rank\"><span class=\"up-th-txt\">Rank</span><span class=\"up-thsort\" data-for=\"rank\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-brands\">Brand Mentions</div><div class=\"up-th up-th-citations\">Citations</div><div class=\"up-th up-th-model\">Model</div><div class=\"up-th up-th-date is-sortable\" data-sortcol=\"date\"><span class=\"up-th-txt\">Date</span><span class=\"up-thsort\" data-for=\"date\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div></div><div class=\"up-tbody\"></div></div></div><div class=\"urt-cards\"></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>"
  };
  /* ---- MARKUP ENDE ---- */
  var DU = {
    FN: { detail: "url_detail_v1" },
    slot: null, root: null, kopf: null, url: "", kanon: "", inRange: true, gezeigt: "", nr: 0, rnr: 0, ab: null, rab: null,
    speicher: {}, reihe: [], zeile: null,
    ids: { daten: "drawer-url-daten", seite: "drawer-url", urt: "drawer-url-responses" },
    resp: null
  };
  function duRespStart() {
    return { order: "run_at_desc", limit: 15, offset: 0, suche: "", erwaehnt: "all", firmen: null,
             rankMin: null, rankMax: null, sentMin: null, sentMax: null, requestId: null };
  }
  DU.resp = duRespStart();
  function duStr(v) { return String(v == null ? "" : v); }
  function duNum(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function duDunkel() {
    try { return (window.getUpstreemTheme ? window.getUpstreemTheme() : "") === "dark"; } catch (e) { return false; }
  }
  function duSetter(n) { return typeof window[n] === "function" ? window[n] : function () {}; }
  function duMerken(sig, o) {
    DU.speicher[sig] = o;
    var i = DU.reihe.indexOf(sig);
    if (i >= 0) DU.reihe.splice(i, 1);
    DU.reihe.push(sig);
    while (DU.reihe.length > 20) delete DU.speicher[DU.reihe.shift()];
  }
  /* Der Zeitraum aus dem Kalender des Drawers; ohne Kalender (Datei fehlt) nimmt die RPC ihre
     Vorgabe. */
  function duZeitraum() {
    var k = DU.slot ? DU.slot.querySelector(".uud-dw-daten") : null, r = null;
    try { r = k && k.__udrCtrl && k.__udrCtrl.getRange ? k.__udrCtrl.getRange() : null; } catch (e) { r = null; }
    return { von: r && r.from ? duStr(r.from) : null, bis: r && r.to ? duStr(r.to) : null };
  }
  function duEigeneMarke() {
    var l = UC.getBrands ? UC.getBrands() : [];
    for (var i = 0; i < l.length; i++) if (l[i] && (duStr(l[i].role).toLowerCase() === "own" || l[i].is_own === true)) return l[i];
    return null;
  }

  /* ---- Die Seite ---- */
  function duLaden(frisch) {
    var c = DU.root ? initRoot(DU.root) : null;
    if (!c || !DU.url) return;
    var z = duZeitraum(), sig = DU.url + "|" + z.von + "|" + z.bis;
    if (!frisch && DU.speicher[sig]) {
      var e = DU.speicher[sig];
      if (DU.gezeigt !== sig) { DU.zeile = e.row; DU.zeileFuer = DU.url; c.setV1(e.row); DU.gezeigt = sig; duKopf(e.row); }
      duAngenommen(e);
      return;
    }
    DU.gezeigt = "";
    /* Neue Adresse: leeren (Skelett). Derselbe Adresse mit neuem Zeitraum: die alte Seite gedimmt
       stehen lassen, bis die neue da ist -- Dimmen statt Skelett (12.10.). */
    /* Verglichen mit der Kennung, unter der die Seite geladen wurde -- die RPC darf die Adresse
       normalisiert zurueckgeben (Schema, Schraegstrich). */
    var gleiche = !!DU.zeile && DU.zeileFuer === DU.url;
    if (gleiche) DU.root.classList.add("is-reloading"); else { c.reset(); duKopf(null); }
    if (DU.ab) { try { DU.ab.abort(); } catch (e) {} }
    var ab = typeof AbortController !== "undefined" ? new AbortController() : null;
    DU.ab = ab;
    var nr = ++DU.nr, url = DU.url;
    (UC.teamWarten ? UC.teamWarten(10000) : Promise.resolve(UC.getTeam ? UC.getTeam() : "")).then(function (team) {
      if (nr !== DU.nr) return null;
      if (!team) return { ok: false, status: 0, fehler: { message: "not authenticated" } };
      return UC.rpc(DU.FN.detail, { p_team: team, p_url: url, p_date_from: z.von, p_date_to: z.bis },
        { timeoutMs: 60000, signal: ab ? ab.signal : undefined });
    }).then(function (erg) {
      if (!erg || nr !== DU.nr) return;
      if (DU.ab === ab) DU.ab = null;
      DU.root.classList.remove("is-reloading");
      var roh = erg.ok ? erg.daten : null;
      if (isArr(roh)) roh = roh.length ? roh[0] : null;
      var d = roh && roh.row && typeof roh.row === "object" ? roh.row : roh;
      var meta = roh && roh.meta && typeof roh.meta === "object" ? roh.meta : {};
      var ok = d && typeof d === "object" && (d.url != null || d.title != null);
      if (ok) {
        var e = { row: d, meta: meta };
        duMerken(sig, e); DU.zeile = d; DU.zeileFuer = url; c.setV1(d); DU.gezeigt = sig; duKopf(d);
        duAngenommen(e);
        return;
      }
      var code = erg.ok ? "" : duStr((erg.fehler && (erg.fehler.message || erg.fehler.code)) || "");
      if (window.console) console.warn("[url-detail] " + DU.FN.detail + " fuer " + url + ": " +
        (code || "Antwort nicht lesbar") + (erg.status ? " (HTTP " + erg.status + ")" : ""));
      DU.zeile = null; DU.kanon = "";
      c.setFehlerCode(code);
      duKopf(false);
      /* Ohne Seite auch keine Tabelle: sie stuende sonst leer unter der Meldung. */
      if (DU.slot) DU.slot.querySelector(".uud-dw").classList.add("is-fehler");
    });
  }
  /* Die Seite ist da: ihre Schreibweise merken und die Tabelle damit laden. */
  function duAngenommen(e) {
    DU.kanon = duStr((e.meta && e.meta.url) || (e.row && e.row.url) || DU.url);
    DU.inRange = !(e.row && e.row.in_range === false);
    if (DU.slot) DU.slot.querySelector(".uud-dw").classList.remove("is-fehler");
    duRespLaden();
  }
  /* "Zeitraum anpassen": die 30 Tage bis zum letzten Zitat (Vorschlag des DB-Chats). Der Kalender
     meldet die Aenderung selbst ("change"), und die laedt Seite und Tabelle neu. */
  function duZeitraumAufZitat(letztes) {
    var k = DU.slot ? DU.slot.querySelector(".uud-dw-daten") : null;
    var ctrl = k && k.__udrCtrl;
    var bis = duStr(letztes).slice(0, 10);
    if (!ctrl || typeof ctrl.setRange !== "function" || !/^\d{4}-\d{2}-\d{2}$/.test(bis)) return;
    var t = new Date(bis + "T12:00:00Z");
    t.setUTCDate(t.getUTCDate() - 29);
    ctrl.setRange(t.toISOString().slice(0, 10), bis, true);
  }

  /* ---- Die Kopfleiste: Name und die vier Knoepfe dieser Art (wie drawer-topbar bei einer URL) ---- */
  function duKopf(d) {
    var k = DU.kopf;
    if (!k) return;
    if (d === null) { k.name(null); k.eigen.innerHTML = ""; return; }
    if (!d) { k.name(""); k.eigen.innerHTML = ""; return; }
    k.name(duStr(d.title).trim() || duStr(d.domain) || DU.url);
    function knopf(art, zeichen, label) {
      return '<button type="button" class="up-iconbtn" data-uud-kopf="' + art + '" data-tip="' + esc(UC.t(label)) +
        '" aria-label="' + esc(UC.t(label)) + '">' + UC.icon(zeichen, 2) + '</button>';
    }
    var html = "";
    if (duStr(d.domain).trim() && typeof window.openDrawer === "function") html += knopf("domain", "domain", "Go to parent domain");
    if (UC.openCreateWithAi) html += knopf("ai", "astroid", "Create with AI");
    if (UC.anMira && UC.miraBezug) html += knopf("mira", "blend", "Ask Mira about this");
    if (typeof window.upstreemPinToSidebar === "function") html += knopf("pin", "pin", "Pin to sidebar");
    k.eigen.innerHTML = html;
  }
  function duKopfKlick(art) {
    var d = DU.zeile || {}, url = DU.kanon || DU.url, titel = duStr(d.title).trim(), fav = duStr(d.favicon).trim();
    if (art === "domain" && d.domain && UC.drawerOeffnen) UC.drawerOeffnen("domain", duStr(d.domain), "url-detail");
    else if (art === "ai" && UC.openCreateWithAi) UC.openCreateWithAi({ url: url, lead_title: titel, lead_favicon: fav });
    else if (art === "mira" && UC.anMira && UC.miraBezug) {
      var b = UC.miraBezug({ type: "url", url: url, title: titel, favicon: fav });
      if (b) UC.anMira(b, ["url"]);
    } else if (art === "pin" && typeof window.upstreemPinToSidebar === "function") {
      try { window.upstreemPinToSidebar({ type: "url", id: url, label: titel || url, logo: fav }); } catch (e) {}
    }
  }

  /* ---- Die Antworten (wie dashboard-page / prompts-page, eingeschraenkt auf p_url) ---- */
  function duRespLaden() {
    var DDx = window.UpstreemDashboardDaten;
    if (!DU.kanon) return;
    if (!DU.inRange) {
      /* Nicht im Zeitraum: kein Abruf -- die Antwort waere leer --, sondern der Leerzustand der
         Tabelle mit demselben Satz wie oben in der Seite. */
      var lc = DU.zeile ? duStr(DU.zeile.last_cited_at) : "";
      duSetter("renderResponsesTable")({ instanceId: DU.ids.urt, rows: [], totalCount: 0, isDark: duDunkel(),
        empty_text: lc ? UC.t("Not cited in the selected period. Last cited on {date}.").replace("{date}", UC.fmtDate(lc))
                       : UC.t("Not cited in the selected period.") });
      duSetter("setResponsesTableLoading")(DU.ids.urt, "no");
      return;
    }
    if (!DDx || !DDx.responsesTeile) {
      duSetter("renderResponsesTable")({ instanceId: DU.ids.urt, __parseError: true });
      return;
    }
    duSetter("setResponsesTableLoading")(DU.ids.urt, "yes");
    if (DU.rab) { try { DU.rab.abort(); } catch (e) {} }
    var ab = typeof AbortController !== "undefined" ? new AbortController() : null;
    DU.rab = ab;
    var nr = ++DU.rnr, url = DU.kanon, z = duZeitraum(), reqId = DU.resp.requestId;
    (UC.teamWarten ? UC.teamWarten(10000) : Promise.resolve(UC.getTeam ? UC.getTeam() : "")).then(function (team) {
      if (nr !== DU.rnr) return null;
      var teile = DDx.responsesTeile({ team: team, von: z.von, bis: z.bis }, DU.resp);
      return Promise.all(teile.map(function (a) {
        var params = {}, k;
        for (k in a.params) params[k] = a.params[k];
        params.p_url = url;
        return UC.rpc(a.fn, params, { timeoutMs: 60000, signal: ab ? ab.signal : undefined });
      }));
    }).then(function (es) {
      if (!es || nr !== DU.rnr) return;
      var ok = es.every(function (x) { return x && x.ok; });
      var p = ok ? DDx.zuResponses(es.map(function (x) { return x.daten; })) : null;
      if (!p) {
        if (window.console) console.warn("[url-detail] Antworten fuer " + url + ": " +
          es.map(function (x) { return x && !x.ok ? duStr(x.fehler && x.fehler.message) : "ok"; }).join(", "));
        duSetter("renderResponsesTable")({ instanceId: DU.ids.urt, __parseError: true });
      } else {
        var mk = duEigeneMarke();
        p.instanceId = DU.ids.urt; p.isDark = duDunkel();
        if (reqId != null) p.requestId = reqId;
        if (mk) { p.brand_name = duStr(mk.name); p.brand_logo = duStr(mk.logo_url); }
        duSetter("renderResponsesTable")(p);
      }
      duSetter("setResponsesTableLoading")(DU.ids.urt, "no");
    });
  }
  function duAn(name, fn) { DU.slot.addEventListener(name, function (e) { fn(e.detail || {}); }); }
  function duRespNeu(fn) { return function (d) { fn(d); DU.resp.requestId = null; duRespLaden(); }; }

  if (UC.kernDrawer) UC.kernDrawer("url", {
    aufbauen: function (ctx) {
      var dk = duDunkel() ? "yes" : "no", mk = duEigeneMarke();
      var urt = String(MARKUP.urt || "")
        .split("__UUD_URT__").join(esc(DU.ids.urt)).split("__UUD_DARK__").join(dk)
        .split("__UUD_BRAND__").join(esc(mk ? duStr(mk.name) : "")).split("__UUD_BRANDLOGO__").join(esc(mk ? duStr(mk.logo_url) : ""));
      ctx.slot.innerHTML =
        '<div class="uud-dw">' +
          '<div class="uud-dw-leiste"><div class="up-root udr-root uud-dw-daten" data-instance="' + esc(DU.ids.daten) +
            '" data-local="yes" data-isdark="' + dk + '"></div></div>' +
          /* data-local: der Klick auf eine Marke oeffnet den Brand-Drawer selbst; ein Bubble-Ereignis
             hat im Drawer aus core keinen Empfaenger (und meldete das sonst in der Konsole). */
          '<div class="up-root uud-root uud-im-drawer" data-local="yes" data-instance="' + esc(DU.ids.seite) + '"></div>' +
          '<div class="uud-dw-resp">' + urt + '</div>' +
        '</div>';
      DU.slot = ctx.slot; DU.kopf = ctx;
      var r = ctx.slot.querySelector(".uud-root");
      /* VOR initRoot: der erste render() muss schon wissen, dass er im Drawer steht. */
      r.__uudKopf = ctx;
      r.__uudNeuLaden = function () { duLaden(true); };
      r.__uudZeitraum = duZeitraumAufZitat;
      DU.root = r;
      initRoot(r);
      ctx.eigen.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest("[data-uud-kopf]") : null;
        if (b) duKopfKlick(b.getAttribute("data-uud-kopf"));
      });
      /* EXPORT der Tabelle (12.10.): export_responses_v1 kennt p_url. Wie auf den Seiten wird das
         Export-Fenster der App vor dem Klick der Tabelle eingestellt (Fangphase), hier mit der
         Adresse der Seite. Ohne Export-Fenster auf der Seite: ein Satz statt eines toten Knopfs. */
      ctx.slot.addEventListener("click", function (e) {
        var b = e.target && e.target.closest ? e.target.closest(".urt-root .up-export") : null;
        if (!b) return;
        var tab = b.closest(".urt-root");
        var ex = document.querySelector(".uex-root[data-instance]");
        var k = ex ? duStr(ex.getAttribute("data-instance")).trim() : "";
        if (!k || /^[A-Z_]{3,}$/.test(k) || typeof window.upstreemExportOpen !== "function" || !DU.kanon) {
          e.stopPropagation();
          if (UC.toast) UC.toast(UC.t("Export isn't available on this page"), "neutral");
          return;
        }
        tab.setAttribute("data-export-instance", k);
        try { if (window.upstreemExportSetContext) window.upstreemExportSetContext(k, { export_type: "prompt_runs", url: DU.kanon }); } catch (err) {}
      }, true);
      /* Neuer Zeitraum: Seite und Antworten neu (die Kennzahlen gelten fuer den Zeitraum). */
      ctx.slot.addEventListener("change", function (e) {
        if (!e.target || !e.target.classList || !e.target.classList.contains("uud-dw-daten")) return;
        /* Nur ein WIRKLICH anderer Zeitraum: der Kalender meldet sich auch beim Einrichten. */
        var z = duZeitraum();
        if (z.von + "|" + z.bis === DU.zLetzt) return;
        DU.resp.offset = 0;
        DU.zLetzt = z.von + "|" + z.bis;
        duLaden(false);
      });
      duAn("urt-urtSearch", function (d) {
        DU.resp.suche = duStr(d.query); DU.resp.offset = 0;
        DU.resp.requestId = d.requestId != null ? d.requestId : null;
        duRespLaden();
      });
      duAn("urt-urtSort", duRespNeu(function (d) {
        var o = duStr(d.order);
        if (["run_at_desc", "run_at_asc", "rank_asc", "rank_desc", "sentiment_asc", "sentiment_desc"].indexOf(o) >= 0) DU.resp.order = o;
        DU.resp.offset = 0;
      }));
      duAn("urt-urtPage", duRespNeu(function (d) {
        var l = duNum(d.limit), o = duNum(d.offset);
        if (l != null) DU.resp.limit = Math.max(1, Math.min(100, Math.round(l)));
        if (o != null) DU.resp.offset = Math.max(0, Math.round(o));
      }));
      duAn("urt-urtFilter", duRespNeu(function (d) {
        var ra = d.rank_active === true || d.rank_active === "true", sa = d.sent_active === true || d.sent_active === "true";
        DU.resp.rankMin = ra ? duNum(d.rank_min) : null;
        /* 20 heisst "20+": offenes Ende, kein p_rank_max (Vertrag Dashboard v1). */
        DU.resp.rankMax = ra && duNum(d.rank_max) != null && duNum(d.rank_max) < 20 ? duNum(d.rank_max) : null;
        DU.resp.sentMin = sa ? duNum(d.sent_min) : null;
        DU.resp.sentMax = sa ? duNum(d.sent_max) : null;
        DU.resp.offset = 0;
      }));
      duAn("urt-urtMentioned", duRespNeu(function (d) {
        var l = isArr(d.brands) ? d.brands.map(duStr).filter(Boolean) : [];
        DU.resp.firmen = l.length ? l : null; DU.resp.offset = 0;
      }));
      duAn("urt-urtBrand", duRespNeu(function (d) {
        var v = duStr(d.brand_mentioned);
        DU.resp.erwaehnt = v === "yes" || v === "no" ? v : "all"; DU.resp.offset = 0;
      }));
      duAn("urt-urtRowClick", function (d) {
        var id = duStr(d.prompt_run_id).trim();
        if (id && UC.drawerOeffnen) UC.drawerOeffnen("response", id, "url-detail");
      });
    },
    zeigen: function (id) {
      var url = duStr(id).trim();
      if (!url) return;
      if (url !== DU.url) {
        /* Neue Adresse: Suche, Filter und Seite der Tabelle gehoeren zur vorigen. Sortierung und
           Seitengroesse bleiben -- das sind Vorlieben, keine Auswahl. */
        var alt = DU.resp;
        DU.resp = duRespStart();
        DU.resp.order = alt.order; DU.resp.limit = alt.limit;
        DU.url = url; DU.kanon = ""; DU.inRange = true;
        try { duSetter("resetResponsesTable")(DU.ids.urt); } catch (e) {}
      }
      /* Erst wenn der Kalender steht (er richtet sich einen Takt nach dem Drawer ein), sonst ginge
         der erste Abruf ohne Zeitraum hinaus und der zweite gleich hinterher. Hoechstens 1,5s;
         fehlt date-range.js, laedt der Drawer ohne Zeitraum (die RPC nimmt ihre Vorgabe). */
      var n = 0;
      (function warten() {
        var k = DU.slot && DU.slot.querySelector(".uud-dw-daten");
        if (!(k && k.__udrCtrl) && n++ < 50) { setTimeout(warten, 30); return; }
        var z = duZeitraum();
        DU.zLetzt = z.von + "|" + z.bis;
        duLaden(false);
      })();
    },
    zu: function () {}
  });

  if (UC.watchRoots) UC.watchRoots("uud-root", function () {
    [].forEach.call(document.querySelectorAll(".uud-root"), initRoot);
  });
  }

  uudBoot(30);
})();
