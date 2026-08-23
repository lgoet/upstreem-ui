/* upstreem onboarding-page.js — Team-Onboarding als ganze Seite (Praefix `uob`).

   ── Was diese Seite ist ─────────────────────────────────────────────────────────────────────
   Der erste Bildschirm nach der Anmeldung: ein Nutzer ohne Team, oder einer, der "Create new
   team" geklickt hat. Fuenf Stationen, dazwischen zwei Wartezustaende:

     1 Brand        Stammdaten                    -> startet den Hintergrundlauf
       (warten)     vier Phasen, Statusanzeige
     2 Competitors  bis zu acht gefundene Marken, Mehrfachauswahl, hoechstens fuenf
     3 Topics       fuenf bis acht Themen, Mehrfachauswahl
       (warten)     kurz, waehrend die Prompts entstehen
     4 Prompts      nach Themen gruppiert, Mehrfachauswahl
     5 Plan         Tarif und Abrechnungszeitraum

   Marken, Themen und Prompts sind FREIWILLIG. Wer nichts auswaehlt, kommt trotzdem weiter --
   deshalb steht neben Weiter ein sichtbarer Ueberspringen-Weg und keine stille Sperre.


   ── Bubble ──────────────────────────────────────────────────────────────────────────────────
   Ereignisse (data-*-fn am Root, sonst bubble_fn_<name>):
     uobStart    {brand_name, website_input, website_url, website_domain, market, timezone,
                  business_model, brand_industry}
     uobStep     der Schluessel des Schritts, roh
     uobSelect   {kind: "brands"|"topics"|"prompts", ids: "a,b,c", count: n}
     uobTopics   die Themenauswahl beim Verlassen von Schritt 3 -- das ist der Anstoss, aus dem
                 die Prompts entstehen
     uobFinish   {plan_id, billing_interval, brand_ids, topic_ids, prompt_ids}
     uobExit     "dashboard" oder "logout"
     uobWorkflowStart  {onboarding_id, run_token} -- NICHT aus dem Ablauf heraus, sondern von
                 window.startOnboardingWorkflow(instanz, onboarding_id, run_token). Damit laesst
                 sich der grosse Hintergrundlauf aus einem Run-JS-Schritt anstossen, wenn beide
                 Werte im Workflow hinter uobStart entstanden sind.

   Setter: setOnboardingProject, setOnboardingStatus, setOnboardingBrands, setOnboardingTopics,
   setOnboardingPrompts, setOnboardingPlans, setOnboardingStep, setOnboardingError,
   setOnboardingLoading, resetOnboarding. */
(function () {
  "use strict";

  /* Frueher Aufruf, bevor core oder diese Datei da sind: einsammeln statt verlieren. Dieselbe
     Mechanik wie in auth-page.js und in jeder Komponente mit makeLate. */
  var BOOTQ = window.__uobBootQueue = window.__uobBootQueue || [];
  if (!window.__uobBootStubbed) {
    window.__uobBootStubbed = true;
    ["setOnboardingProject", "setOnboardingStatus", "setOnboardingBrands", "setOnboardingTopics",
     "setOnboardingPrompts", "setOnboardingPlans", "setOnboardingStep", "setOnboardingError",
     "setOnboardingLoading", "resetOnboarding", "startOnboardingWorkflow"].forEach(function (n) {
      if (typeof window[n] === "function") return;
      window[n] = function () { BOOTQ.push([n, [].slice.call(arguments)]); return true; };
    });
  }

  function uobBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemCore.makeMount) {
      if (triesLeft <= 0) {
        if (window.console) console.error("[onboarding-page] core.js fehlt -- die Seite bleibt leer.");
        return;
      }
      setTimeout(function () { uobBoot(triesLeft - 1); }, 60);
      return;
    }
    uobRun();
  }

  var UC = null;                       /* wird in uobRun gesetzt, sobald core sicher da ist */

  /* ---------- kleine Helfer ---------------------------------------------------------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function txt(v) { return String(v == null ? "" : v).trim(); }
  function num(v) { var n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : null; }

  /* ---------- Schritte ---------------------------------------------------------------------
     Die Reihenfolge ist die Wahrheit ueber den Ablauf: Schiene, Zurueck-Knopf und die
     Adresszeile lesen alle aus diesem einen Array. Die Wartezustaende stehen NICHT darin --
     sie sind keine Station, sondern das, was zwischen zwei Stationen passiert. */
  var STEPS = [
    { key: "brand",       label: "Brand" },
    { key: "competitors", label: "Competitors" },
    { key: "topics",      label: "Topics" },
    { key: "prompts",     label: "Prompts" },
    { key: "plan",        label: "Plan" }
  ];
  function stepIndex(k) {
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].key === k) return i;
    return -1;
  }

  /* Die Phasen des Hintergrundlaufs. status_phase 1..4 waehrend der Arbeit, 5 heisst fertig.
     Die Texte sind bewusst in derselben Sprache wie die Anmeldeseite geschrieben: was der Nutzer
     davon hat, nicht was das System tut. "Creating your personal workspace" wurde zu "Setting up
     your workspace" -- "personal" ist es nicht, es ist ein Team. */
  var PHASES = [
    { h: "Setting up your workspace",  b: "Creating the space your team will work in" },
    { h: "Reading your website",       b: "Getting to know what your brand does" },
    { h: "Mapping your market",        b: "Looking for the brands you compete with" },
    { h: "Preparing your insights",    b: "Turning what we found into something useful" }
  ];

  /* Vier Werte, vier Segmente. Der Wert bleibt exakt der, den Bubble erwartet -- nur die
     Beschriftung von Hybrid ist kurz: "Hybrid (B2B & B2C)" sprengt in einem Switcher jede
     Zeile, und was Hybrid heisst, weiss ohnehin jeder, der die drei anderen liest. */
  /* ---------- Begleittexte ------------------------------------------------------------------
     Die Klapptafel rechts. Sie beantwortet je Schritt drei Fragen, in dieser Reihenfolge: was
     ist das, warum zaehlt es, worauf kommt es an. Das Warum steht VOR dem Wie -- so ist es in
     der Doku-Lehre (Diataxis trennt Erklaerung von Anleitung, und die Erklaerung kommt zuerst),
     und so liest es sich auch: wer nicht weiss, wozu Wettbewerber gut sind, waehlt die
     groessten statt der richtigen.

     Kurz gehalten, mit Absicht. Ein Onboarding ist kein Handbuch: drei Bloecke, der letzte als
     Liste, zusammen unter 120 Woertern je Schritt. Wer mehr will, findet es spaeter in der App.

     Zwei Sprachen. Deutsch bei Markt DE, sonst Englisch -- so steht es in der Aufgabe. AT und CH
     bekommen damit Englisch; wer das aendern will, erweitert MARKT_DE unten um die zwei Codes.
     Die deutschen Texte sind geschrieben und nicht uebersetzt: eine woertliche Uebertragung
     klingt an genau den Stellen falsch, an denen es um Fachbegriffe geht. */
  var MARKT_DE = { DE: 1 };
  var HILFE_KEY = "uobHilfe";
  /* Standard: OFFEN. Ein Erklaerkasten, den man erst suchen muss, wird beim ersten Durchlauf
     nicht gefunden -- und der erste Durchlauf ist der einzige, den es gibt. Wer ihn zumacht,
     hat ihn danach zu. */
  function hilfeGelesen() {
    var v = null;
    try { v = UC.prefGet ? UC.prefGet(UC.prefKey ? UC.prefKey(HILFE_KEY) : HILFE_KEY) : null; } catch (e) {}
    return v == null ? true : v === "1";
  }

  var HILFE = {
    en: {
      titel: "Guide",
      brand: {
        lead: "The brand we start tracking for you.",
        warum: {
          h: "Why this matters",
          t: "We read your website to work out what you sell and who you sell it to. The " +
             "competitors and topics on the next screens are derived from it – so a precise " +
             "address means better suggestions and less for you to correct."
        },
        wie: {
          h: "What to watch for",
          l: ["Website: the domain you want to be found for, not a landing page.",
              "Market: where your buyers are, not where your office is.",
              "Industry is optional and only sharpens the suggestions on the next screens."]
        }
      },
      competitors: {
        ic: "squareStack",
        lead: "The {ic}brands we measure you against.",
        warum: {
          h: "Why this matters",
          t: "A visibility of 20% is good or bad depending on who else is in the answer. " +
             "Competitors are the yardstick: Share of Voice, Rank and Sentiment all compare " +
             "your brand against exactly these. Without them you get a number without a scale."
        },
        wie: {
          h: "How to choose",
          l: ["Brands a buyer would genuinely consider instead of you – not the biggest names in the industry.",
              "Three to five is plenty to start. You can add more from your dashboard.",
              "Pick brands that show up in the same kind of questions as you."]
        }
      },
      topics: {
        ic: "tags",
        lead: "The {ic}topics you want to be found for.",
        warum: {
          h: "Why this matters",
          t: "Topics decide what you can measure later. Prompts are written per topic, and " +
             "every report groups by topic – so a subject you skip here is a subject you " +
             "cannot see a number for afterwards."
        },
        wie: {
          h: "How to choose",
          l: ["Areas where a buying decision happens, not everything you do.",
              "Name them the way a customer would say them, not the way your catalogue does.",
              "Three to six is a good start. Missing one? Add your own at the bottom."]
        }
      },
      prompts: {
        ic: "zap",
        lead: "The {ic}prompts we run for you, every day.",
        warum: {
          h: "Why this matters",
          t: "This is where the data comes from. Every model runs these questions daily in your " +
             "market, and everything upstreem shows is built from the answers. A question you " +
             "drop here is a question nobody answers for you."
        },
        wie: {
          h: "How to choose",
          l: ["Keep the ones a real customer would type into ChatGPT.",
              "Questions WITHOUT your brand name are the valuable ones – they show whether you get recommended when nobody is looking for you yet.",
              "Your plan sets how many run per day. You can swap them any time."]
        }
      }
    },
    de: {
      titel: "Guide",
      brand: {
        lead: "Die Marke, die wir ab jetzt für dich beobachten.",
        warum: {
          h: "Warum das zählt",
          t: "Wir lesen deine Website, um zu verstehen, was du verkaufst und an wen. Die " +
             "Wettbewerber und Themen auf den nächsten Schritten entstehen daraus – eine " +
             "präzise Adresse bringt dir also bessere Vorschläge und weniger zu korrigieren."
        },
        wie: {
          h: "Worauf es ankommt",
          l: ["Website: die Domain, für die du gefunden werden willst, keine Unterseite.",
              "Markt: wo deine Käufer sind, nicht wo dein Büro steht.",
              "Die Branche ist freiwillig und schärft nur die Vorschläge auf den nächsten Schritten."]
        }
      },
      competitors: {
        ic: "squareStack",
        lead: "Die {ic}Brands, an denen wir dich messen.",
        warum: {
          h: "Warum das zählt",
          t: "Eine Sichtbarkeit von 20% ist gut oder schlecht, je nachdem, wer sonst in der " +
             "Antwort steht. Wettbewerber sind der Maßstab: Share of Voice, Rang und Sentiment " +
             "vergleichen deine Marke mit genau diesen. Ohne sie bekommst du eine Zahl ohne Skala."
        },
        wie: {
          h: "Worauf es ankommt",
          l: ["Marken, die ein Käufer wirklich statt deiner in Betracht zieht – nicht die größten der Branche.",
              "Drei bis fünf reichen zum Start. Weitere kannst du später im Dashboard ergänzen.",
              "Nimm Marken, die in derselben Art von Fragen auftauchen wie du."]
        }
      },
      topics: {
        ic: "tags",
        lead: "Die {ic}Themen, für die du gefunden werden willst.",
        warum: {
          h: "Warum das zählt",
          t: "Themen entscheiden, was du später messen kannst. Prompts entstehen je Thema, und " +
             "jede Auswertung gruppiert nach Thema – ein Thema, das du hier auslässt, ist ein " +
             "Thema, zu dem du danach keine Zahl siehst."
        },
        wie: {
          h: "Worauf es ankommt",
          l: ["Bereiche, in denen eine Kaufentscheidung fällt, nicht alles, was du tust.",
              "Benenne sie so, wie ein Kunde sie sagen würde, nicht wie dein Katalog sie nennt.",
              "Drei bis sechs sind ein guter Start. Fehlt eins? Unten kannst du eigene ergänzen."]
        }
      },
      prompts: {
        ic: "zap",
        lead: "Die {ic}Prompts, die wir täglich für dich an die Modelle stellen.",
        warum: {
          h: "Warum das zählt",
          t: "Hier kommen die Daten her. Jedes Modell beantwortet diese Fragen täglich in " +
             "deinem Markt, und alles, was upstreem zeigt, entsteht aus diesen Antworten. Eine " +
             "Frage, die du hier wegnimmst, beantwortet niemand für dich."
        },
        wie: {
          h: "Worauf es ankommt",
          l: ["Behalte die, die ein echter Kunde so bei ChatGPT eintippen würde.",
              "Fragen OHNE deinen Markennamen sind die wertvollen – sie zeigen, ob du empfohlen wirst, wenn noch niemand nach dir sucht.",
              "Wie viele täglich laufen, bestimmt dein Tarif. Tauschen kannst du sie jederzeit."]
        }
      }
    }
  };

  var BUSINESS = [
    { value: "B2B",           label: "B2B" },
    { value: "B2C",           label: "B2C" },
    { value: "Hybrid",        label: "Hybrid" },
    { value: "CitiesRegions", label: "Cities & Regions" }
  ];
  /* B2B ist die Vorbelegung. Ein Pflichtfeld, das schon ausgefuellt ist, spart einen Klick und
     einen moeglichen Fehler -- und B2B ist der weit haeufigste Fall in dieser App. */
  var BUSINESS_STD = "B2B";

  /* Zeichengrenzen. Kein Zaehler unter dem Feld: der zaehlt bei jedem Anschlag mit und lenkt vom
     Tippen ab. Stattdessen sagt das Feld erst etwas, wenn die Grenze WIRKLICH erreicht ist. */
  var MAX = { name: 60, website: 255, industry: 60, topic: 40 };
  /* Fuenf eigene Themen. Die Grenze steht in der Aufgabe -- und sie ist auch sachlich richtig:
     wer im Onboarding zehn Themen tippt, hat danach zehn Themen ohne Prompts. */
  var EIGEN_MAX = 5;

  /* Dieselbe Liste wie im Bereich "Your Brand" (settings-brand.js). Sie steht hier ein zweites
     Mal und nicht in core, weil sie in beiden Faellen eine INHALTSliste ist und kein Bauteil --
     core traegt Geometrie und Verhalten, keine Branchennamen. Wer sie aendert, aendert sie an
     beiden Stellen; ein Payload mit industries uebersteuert sie ohnehin. */
  var INDUSTRIES = [
    "Agriculture & Food", "Automotive & Mobility", "Construction & Real Estate",
    "Consulting & Agencys", "E-Commerce & Retail", "Education & Training",
    "Energy & Utilities", "Fashion & Beauty", "Finance & Insurance", "Health & Pharma",
    "Hospitality & Gastronomy", "Industry & Manufacturing", "Legal & Compliance",
    "Logistics & Transport", "Media & Publishing", "Non-Profit & Public Sector",
    "SaaS & Software", "Sports & Fitness", "Telecommunications", "Travel & Tourism"
  ];

  /* Rueckfall fuer die Maerkte. Normalerweise kommt die Liste ueber setUpstreemAllMarkets aus
     derselben Quelle wie ueberall sonst -- aber diese Seite ist der ERSTE Bildschirm, und dort
     ist noch kein Team geladen, das die Liste mitbraechte. Ohne Rueckfall waere das Marktfeld
     genau dann leer, wenn es gebraucht wird. Die Flaggen holt UC.marketChip aus derselben
     Quelle wie im Rest der App. */
  var MARKETS_FALLBACK = [
    ["DE", "Germany"], ["AT", "Austria"], ["CH", "Switzerland"], ["GB", "United Kingdom"],
    ["IE", "Ireland"], ["US", "United States"], ["CA", "Canada"], ["FR", "France"],
    ["ES", "Spain"], ["IT", "Italy"], ["NL", "Netherlands"], ["BE", "Belgium"],
    ["LU", "Luxembourg"], ["DK", "Denmark"], ["SE", "Sweden"], ["NO", "Norway"],
    ["FI", "Finland"], ["PL", "Poland"], ["CZ", "Czechia"], ["PT", "Portugal"],
    ["GR", "Greece"], ["HU", "Hungary"], ["RO", "Romania"], ["TR", "Turkey"],
    ["AU", "Australia"], ["NZ", "New Zealand"], ["JP", "Japan"], ["SG", "Singapore"],
    ["IN", "India"], ["BR", "Brazil"], ["MX", "Mexico"], ["ZA", "South Africa"],
    ["AE", "United Arab Emirates"]
  ];
  function marketList() {
    var aus = UC && UC.getAllMarkets ? UC.getAllMarkets() : [];
    var raus = [];
    if (isArr(aus)) {
      for (var i = 0; i < aus.length; i++) {
        var m = aus[i]; if (!m) continue;
        var code = txt(m.alpha2 || m.code || m.market_code || m.id).toUpperCase();
        var name = txt(m.name || m.label || code);
        if (code) raus.push({ code: code, name: name || code });
      }
    }
    if (raus.length) return raus;
    return MARKETS_FALLBACK.map(function (p) { return { code: p[0], name: p[1] }; });
  }

  /* Zeitzonen aus der Laufzeit, nicht aus einer gepflegten Liste: Intl kennt sie, und eine
     eigene Liste waere ab dem naechsten Zonenwechsel falsch. Wo Intl das nicht hergibt (aeltere
     Browser), bleibt wenigstens die eigene Zone plus die gebraeuchlichsten. */
  function timezoneList() {
    try {
      if (typeof Intl !== "undefined" && Intl.supportedValuesOf) {
        var l = Intl.supportedValuesOf("timeZone");
        if (isArr(l) && l.length) return l;
      }
    } catch (e) {}
    var eigen = eigeneZone();
    var basis = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "Europe/London", "Europe/Paris",
                 "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Warsaw", "Europe/Lisbon",
                 "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
                 "America/Sao_Paulo", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
                 "Australia/Sydney", "UTC"];
    if (eigen && basis.indexOf(eigen) < 0) basis.unshift(eigen);
    return basis;
  }
  /* Der Versatz zu UTC, einmal je Zone gerechnet und gemerkt. Ohne den Speicher liefe die
     Rechnung bei jedem Tastendruck im Suchfeld ueber alle vierhundert Zonen.
     shortOffset liefert "GMT+1"; daraus wird "UTC+1" -- beides meint dasselbe, und UTC ist der
     Begriff, den eine Zeitzonenwahl heute fuehrt. Kennt ein Browser das Format nicht, bleibt
     der Zusatz weg statt falsch zu sein. */
  var VERSATZ = {};
  function versatz(zone) {
    if (VERSATZ[zone] !== undefined) return VERSATZ[zone];
    var v = "";
    try {
      var teile = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
        .formatToParts(new Date());
      for (var i = 0; i < teile.length; i++) {
        if (teile[i].type === "timeZoneName") { v = teile[i].value; break; }
      }
      v = v.replace(/^GMT/, "UTC");
      if (v === "UTC") v = "UTC+0";
    } catch (e) { v = ""; }
    VERSATZ[zone] = v;
    return v;
  }
  function eigeneZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; }
  }
  /* Zeitzone -> Land. Die ZEITZONE ist die Ortsangabe, die Browsersprache ist eine Vorliebe --
     und genau daran ist der erste Versuch gescheitert: auf einem deutschen Windows mit
     englischer Oberflaeche steht in navigator.languages "en-US" vorn, und der Markt sprang auf
     die USA, obwohl der Rechner in Deutschland stand. Die Zeitzone sagt dort weiterhin
     Europe/Berlin.
     Die Tabelle deckt Europa vollstaendig ab und die uebrigen Maerkte, die in MARKETS_FALLBACK
     stehen. Was nicht darin steht, faellt auf die Sprache zurueck und zuletzt auf DE. */
  var ZONE_LAND = {
    "Europe/Berlin": "DE", "Europe/Busingen": "DE",
    "Europe/Vienna": "AT", "Europe/Zurich": "CH",
    "Europe/London": "GB", "Europe/Belfast": "GB", "Europe/Dublin": "IE",
    "Europe/Paris": "FR", "Europe/Monaco": "FR",
    "Europe/Madrid": "ES", "Atlantic/Canary": "ES", "Europe/Lisbon": "PT", "Atlantic/Madeira": "PT",
    "Europe/Rome": "IT", "Europe/Vatican": "IT", "Europe/San_Marino": "IT", "Europe/Malta": "MT",
    "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Luxembourg": "LU",
    "Europe/Copenhagen": "DK", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Helsinki": "FI",
    "Atlantic/Reykjavik": "IS", "Europe/Tallinn": "EE", "Europe/Riga": "LV", "Europe/Vilnius": "LT",
    "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Bratislava": "SK", "Europe/Budapest": "HU",
    "Europe/Ljubljana": "SI", "Europe/Zagreb": "HR", "Europe/Sarajevo": "BA", "Europe/Belgrade": "RS",
    "Europe/Skopje": "MK", "Europe/Podgorica": "ME", "Europe/Tirane": "AL",
    "Europe/Bucharest": "RO", "Europe/Sofia": "BG", "Europe/Athens": "GR", "Asia/Nicosia": "CY",
    "Europe/Kiev": "UA", "Europe/Kyiv": "UA", "Europe/Istanbul": "TR",
    "America/New_York": "US", "America/Detroit": "US", "America/Chicago": "US",
    "America/Denver": "US", "America/Phoenix": "US", "America/Los_Angeles": "US",
    "America/Anchorage": "US", "Pacific/Honolulu": "US",
    "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
    "America/Winnipeg": "CA", "America/Halifax": "CA",
    "America/Mexico_City": "MX", "America/Sao_Paulo": "BR",
    "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU",
    "Australia/Perth": "AU", "Australia/Adelaide": "AU", "Pacific/Auckland": "NZ",
    "Asia/Tokyo": "JP", "Asia/Singapore": "SG", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
    "Asia/Dubai": "AE", "Africa/Johannesburg": "ZA"
  };
  function eigenerMarkt() {
    var z = eigeneZone();
    if (z && ZONE_LAND[z]) return ZONE_LAND[z];
    /* Rueckfall: die Region aus der Sprache. Sie ist schwaecher, aber besser als nichts -- und
       fuer Zonen, die hier nicht stehen, oft die einzige Angabe. */
    var kandidaten = [];
    try {
      if (navigator.languages && navigator.languages.length) kandidaten = [].slice.call(navigator.languages);
      if (navigator.language) kandidaten.push(navigator.language);
    } catch (e) {}
    for (var i = 0; i < kandidaten.length; i++) {
      var m = /-([A-Za-z]{2})(?:$|-)/.exec(String(kandidaten[i] || ""));
      if (m) return m[1].toUpperCase();
    }
    return "DE";
  }

  /* Adresse normalisieren. Entschieden: IMMER https, und der Host OHNE www.
     Grund: die App fuehrt ueberall website_domain als Schluessel (funktion-one.com), und jeder
     Vergleich auf Domainebene -- Favicon, Zitationen, Domain-Detailseite -- laeuft ohne www.
     Bliebe das www in der URL stehen, waeren website_url und website_domain zwei verschiedene
     Schreibweisen derselben Sache, und irgendwann vergleicht jemand die falschen zwei. */
  function normUrl(roh) {
    var s = txt(roh);
    if (!s) return { url: "", domain: "" };
    s = s.replace(/^\s*(?:https?:)?\/\//i, "");
    s = s.replace(/^www\./i, "");
    s = s.replace(/\/+$/, "");
    if (!s) return { url: "", domain: "" };
    var host = s.split(/[\/?#]/)[0].toLowerCase();
    var rest = s.slice(host.length);
    return { url: "https://" + host + rest, domain: host };
  }
  function urlOk(u) {
    /* Bewusst grob: ein Punkt und mindestens zwei Zeichen danach. Eine strengere Pruefung wuerde
       neue Endungen aussperren, und die Adresse wird ohnehin serverseitig aufgerufen. */
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(u || "").split(/[\/?#]/)[0]);
  }
  function favicon(domain) {
    var d = txt(domain);
    return d ? "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(d) + "&sz=64" : "";
  }
  function initial(s) { return txt(s).charAt(0).toUpperCase() || "?"; }
  /* Eine fremde Adresse in einem neuen Tab. noopener,noreferrer wie ueberall im Haus: das neue
     Fenster darf weder an window.opener noch an den Verweis auf die Herkunft. Ohne Schema wuerde
     der Browser relativ zur Bubble-Seite aufloesen. */
  function urlOeffnen(u) {
    var wert = txt(u);
    if (!wert) return;
    if (!/^https?:\/\//i.test(wert)) wert = "https://" + wert;
    try { window.open(wert, "_blank", "noopener,noreferrer"); } catch (e) {}
  }
  /* Eine Markenkachel, dreimal in derselben Form gebraucht (Kopf, Listenzeile, Ladebild) und
     deshalb an EINER Stelle gebaut. Der Anfangsbuchstabe steht IMMER im Markup, das Bild liegt
     darueber und wird durch has-img sichtbar gemacht -- genau wie .up-ment-logo in core. Faellt
     das Favicon aus, nimmt onerror nur die Klasse weg und der Buchstabe steht wieder da. Eine
     Fassung, die den Buchstaben nur bei fehlender Adresse ausgibt, hinterlaesst bei einem
     kaputten Favicon eine leere Kachel -- und die sieht aus wie ein Ladefehler der Seite. */
  function kachelInhalt(name, favUrl) {
    return esc(initial(name)) +
      (favUrl ? '<img src="' + esc(favUrl) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "");
  }
  function kachel(cls, name, domain, favUrl) {
    /* Eine mitgelieferte Adresse gewinnt ueber die selbst gebaute: die RPC kennt das Logo
       moeglicherweise besser als der Google-Dienst. */
    var fav = txt(favUrl) || favicon(domain);
    return '<span class="' + cls + (fav ? " has-img" : "") + '">' + kachelInhalt(name, fav) + '</span>';
  }

  /* ---------- Adresszeile ------------------------------------------------------------------
     ?step=<key>. Damit landet jemand nach Tagen wieder dort, wo er war, und der Zurueck-Knopf
     des Browsers tut, was er soll. Die Wartezustaende stehen nicht in der Adresse: sie sind
     kein Ort, an den man zurueckkehren kann. */
  function urlParam(name) {
    try {
      var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
    } catch (e) { return ""; }
  }
  function stepAusUrl() {
    var p = txt(urlParam("step")).toLowerCase();
    return stepIndex(p) >= 0 ? p : "";
  }
  function urlSetzen(key, neuerEintrag) {
    try {
      if (!window.history || !window.history.replaceState) return;
      var u = new URL(window.location.href);
      if (u.searchParams.get("step") === key) return;
      u.searchParams.set("step", key);
      window.history[neuerEintrag ? "pushState" : "replaceState"]({}, "", u.toString());
    } catch (e) {}
  }

  /* ==========================================================================================
     Controller
     ========================================================================================== */
  function makeController(root) {
    var fire = UC.makeFire(root, { label: "onboarding-page", eventPrefix: "uob" });
    var instanceId = txt(root.getAttribute("data-instance")) || "onboarding";

    function attr(n, f) {
      var v = root.getAttribute(n);
      return (v == null || v === "" || /^[A-Z_]{3,}$/.test(v)) ? (f || "") : v;
    }
    function istJa(v) { return UC.isYes ? UC.isYes(v) : /^(yes|true|1)$/i.test(txt(v)); }

    /* ---- Zustand ------------------------------------------------------------------------- */
    var state = {
      step: "brand",
      /* Der Wartezustand ist KEIN Schritt, sondern eine Schicht darueber: "" | "main" | "prompts".
         So bleibt der Schritt darunter erhalten -- wer waehrend des Wartens neu laedt, kommt an
         der Station an, zu der die Uhr gehoerte, und nicht an einer Uhr ohne Inhalt. */
      warten: "",
      phase: 0,                 /* 0..3, der Index der laufenden Phase */
      fortschritt: 0,           /* 0..100 fuer die Spur */
      form: {
        name: "", website: "", market: "", timezone: "", business: BUSINESS_STD, industry: ""
      },
      fehler: {},               /* feldname -> text */
      banner: "",
      projekt: null,            /* das Onboarding-Projekt, sobald es da ist */
      brands: [], topics: [], prompts: [], plans: [],
      selBrands: {}, selTopics: {}, selPrompts: {},
      /* Selbst getippte Themen: [{ id, name, farbe }]. Sie liegen NEBEN state.topics und nicht
         darin -- topics kommt vom Server und wird bei jedem Payload ersetzt, diese hier gehoeren
         dem Nutzer und duerfen dabei nicht verschwinden. */
      eigene: [],
      plan: "", interval: "yearly",
      /* Die Begleittafel: einmal weggeklickt bleibt sie weg, ueber Schritte und Neuladen hinweg. */
      hilfeAuf: hilfeGelesen(),
      /* Hat der Nutzer den Guide selbst angefasst? Bricht die Fuenf-Sekunden-Uhr ab. */
      hilfeVonHand: false,
      /* Welche Schritte hat der Nutzer im Guide schon gesehen. Nur fuer diese Sitzung: der Punkt
         am Knopf soll auf einen NEUEN Schritt hinweisen, nicht eine Woche spaeter noch. */
      hilfeGesehen: {},
      /* Einmal beim Tarif gewesen heisst: der Punkt bleibt in der Schiene. Siehe renderRail. */
      planGesehen: false,
      /* Die Themenauswahl, zu der die aktuellen Prompts gehoeren. Sie entscheidet, ob ein
         erneutes Weiter aus Schritt 3 die Wartezeit noch einmal braucht. */
      promptsFuer: null,
      /* Der weiteste Schritt, an dem der Nutzer je war. Er entscheidet, worauf in der Leiste
         geklickt werden darf -- nicht der aktuelle Schritt. Wer von Plan auf Competitors
         zurueckgeht, muss von dort auch wieder nach vorn kommen, ohne alles noch einmal
         durchzuklicken. */
      maxErreicht: 0,
      busy: false
    };
    var BRAND_MAX = 5;

    /* ---- Thema ---------------------------------------------------------------------------- */
    var isDark = false;
    function istDunkelRoh() {
      if (UC.themeParam) {
        var t = UC.themeParam(root, "data-isdark");
        if (t != null) return !!t;
      }
      var roh = root.getAttribute("data-isdark");
      if (roh != null && roh !== "" && !/^[A-Z_]{3,}$/.test(roh)) return istJa(roh);
      return false;
    }
    var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2' +
      'M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
    function syncTheme() {
      isDark = istDunkelRoh();
      if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      var b = root.querySelector("[data-theme-btn]");
      if (b) {
        /* Das Icon zeigt, WOHIN der Klick fuehrt, nicht wo man ist -- wortgleich zur
           Anmeldeseite, damit der Knopf beim Seitenwechsel nicht die Bedeutung tauscht. */
        b.innerHTML = isDark ? SUN : MOON;
        b.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      }
      var l = root.querySelector(".uob-logo");
      if (l && l.tagName === "IMG") {
        var neu = (isDark && attr("data-logo-dark")) || attr("data-logo");
        if (neu && l.getAttribute("src") !== neu) l.setAttribute("src", neu);
      }
    }

    /* ---- Geruest -------------------------------------------------------------------------- */
    function ic(name, w) { return UC.icon ? UC.icon(name, w) : ""; }

    function shell() {
      var logo = (istDunkelRoh() && attr("data-logo-dark")) || attr("data-logo");
      return '' +
      '<div class="uob-top">' +
        /* onerror: eine Adresse, die ins Leere zeigt, hinterlaesst sonst das Bruchbild-Symbol
           des Browsers oben links -- auf dem ersten Bildschirm eines neuen Nutzers das denkbar
           schlechteste Zeichen. Leer ist besser als kaputt. */
        (logo ? '<img class="uob-logo" src="' + esc(logo) + '" alt="upstreem" ' +
                'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),' +
                '{className:\'uob-logo\'}))"/>'
              : '<span class="uob-logo"></span>') +
        '<div class="uob-topr">' +
          /* Die Beschriftungen stecken in einem eigenen Element und die Knoepfe tragen
             aria-label und data-tip: faellt die Beschriftung bei Platzmangel weg, bleibt der
             Knopf lesbar -- fuer Vorleseprogramme ueber aria-label, fuer die Maus ueber den
             Tooltip. Ein nackter Text hinter dem Icon liesse sich per CSS gar nicht ausblenden. */
          '<button class="uob-link uob-link-dot" type="button" data-help-btn aria-pressed="false" ' +
            'aria-label="Guide" data-tip="Guide">' +
            ic("libraryBig", 1.8) + '<span class="uob-link-t" data-help-lbl>Guide</span>' +
            '<span class="up-badge is-dot" data-help-dot></span></button>' +
          '<button class="uob-link" type="button" data-exit="dashboard" aria-label="Dashboard" ' +
            'data-tip="Dashboard">' + ic("home", 1.8) + '<span class="uob-link-t">Dashboard</span></button>' +
          '<button class="uob-link" type="button" data-exit="logout" aria-label="Log out" ' +
            'data-tip="Log out">' + ic("logOut", 1.8) + '<span class="uob-link-t">Log out</span></button>' +
          '<button class="uob-themebtn" type="button" data-theme-btn aria-label="Switch theme"></button>' +
        '</div>' +
      '</div>' +

      '<div class="uob-rail" role="group" aria-label="Setup progress" data-rail>' +
        '<div class="uob-rail-line">' +
          '<div class="uob-rail-fill" data-rail-fill></div>' +
          '<div class="uob-rail-dots" data-rail-dots></div>' +
        '</div>' +
        '<div class="uob-rail-labels" data-rail-labels></div>' +
        '<div class="uob-rail-hits" data-rail-hits></div>' +
      '</div>' +

      '<div class="uob-mid">' +
        '<div class="uob-col">' +
          '<div class="uob-banner" data-banner><div><div class="uob-banner-in" data-banner-txt></div></div></div>' +
          '<div class="uob-ident" data-ident><div><div class="uob-ident-in">' +
            '<span class="uob-ident-logo" data-ident-logo></span>' +
            '<span class="uob-ident-txt">' +
              '<span class="uob-ident-name" data-ident-name></span>' +
              '<span class="uob-ident-dom" data-ident-dom></span>' +
            '</span>' +
          '</div></div></div>' +
          '<div class="uob-stack" data-stack></div>' +
        '</div>' +
      '</div>' +

      /* Die Tafel liegt IM Root und ist absolut gesetzt, nicht fixiert: position: fixed haengt in
         Bubble an jedem Vorfahren mit transform oder filter, und dieser Root steckt dort in
         fremdem Markup. Absolut im eigenen Root ist dasselbe Bild ohne diese Abhaengigkeit. */
      '<aside class="uob-help" data-help aria-hidden="true">' +
        '<div class="uob-help-head">' +
          '<span class="uob-help-ic">' + ic("libraryBig", 1.9) + '</span>' +
          '<span class="uob-help-title" data-help-title></span>' +
          '<button class="uob-help-x" type="button" data-help-close aria-label="Close">' + ic("x", 2.6) + '</button>' +
        '</div>' +
        '<div class="uob-help-body up-scroll" data-help-body></div>' +
      '</aside>' +

      '<div class="uob-nav" data-nav>' +
        '<button class="uob-back" type="button" data-back>' + ic("chevronRight", 2) + 'Back</button>' +
        '<div class="uob-navr">' +
          '<button class="uob-next" type="button" data-next>' +
            '<span data-next-txt>Continue</span><span class="uob-spin"></span>' +
          '</button>' +
        '</div>' +
      '</div>';
    }

    root.innerHTML = shell();

    var elStack   = root.querySelector("[data-stack]");
    var elNav     = root.querySelector("[data-nav]");
    var elBack    = root.querySelector("[data-back]");
    var elNext    = root.querySelector("[data-next]");
    var elNextTxt = root.querySelector("[data-next-txt]");
    var elRail    = root.querySelector("[data-rail]");
    var elRailFill= root.querySelector("[data-rail-fill]");
    var elRailDots= root.querySelector("[data-rail-dots]");
    var elRailLbls= root.querySelector("[data-rail-labels]");
    var elRailHits= root.querySelector("[data-rail-hits]");
    var elMid     = root.querySelector(".uob-mid");
    var elHelp    = root.querySelector("[data-help]");
    var elHelpBody= root.querySelector("[data-help-body]");
    var elHelpTtl = root.querySelector("[data-help-title]");
    var elHelpBtn = root.querySelector("[data-help-btn]");
    var elIdent   = root.querySelector("[data-ident]");
    var elIdentLg = root.querySelector("[data-ident-logo]");
    var elIdentNm = root.querySelector("[data-ident-name]");
    var elIdentDm = root.querySelector("[data-ident-dom]");
    var elBanner  = root.querySelector("[data-banner]");
    var elBannerT = root.querySelector("[data-banner-txt]");
    /* Der Zurueck-Pfeil ist chevronRight, gedreht: core hat kein chevronLeft, und ein selbst
       gezeichneter waere ein zweiter Pfeil mit anderer Strichfuehrung. */
    var backSvg = elBack.querySelector("svg");
    if (backSvg) backSvg.style.transform = "rotate(180deg)";

    /* ---- Ansichten ------------------------------------------------------------------------
       Jede Ansicht liefert nur ihr Markup. Welche gerade sichtbar ist, entscheidet render() --
       so gibt es genau eine Stelle, an der ein Zustand zu einem Bild wird. */

    function kopf(h1, sub, zaehler) {
      return '<div class="uob-head">' +
        (zaehler != null
          ? '<div class="uob-h1row"><h1 class="uob-h1">' + esc(h1) + '</h1>' +
            '<span class="uob-count' + (zaehler.voll ? " is-full" : "") + '">' + esc(zaehler.text) + '</span></div>'
          : '<h1 class="uob-h1">' + esc(h1) + '</h1>') +
        (sub ? '<p class="uob-sub">' + esc(sub) + '</p>' : "") +
      '</div>';
    }

    function selectHtml(kind, platzhalter, titel, suchbar, mitEigen) {
      return '<div class="uob-ddwrap" data-dd="' + kind + '">' +
        '<button class="uob-select" type="button" data-dd-btn aria-haspopup="listbox" aria-expanded="false">' +
          '<span class="uob-select-ic" data-dd-icon></span>' +
          '<span class="uob-select-lbl" data-dd-label data-ph="' + esc(platzhalter) + '">' +
            esc(platzhalter) + '</span>' +
          '<span class="uob-select-chev">' + ic("chevronDown", 2) + '</span>' +
        '</button>' +
        '<div class="up-ment-menu uob-ddmenu is-flat" role="listbox" aria-hidden="true">' +
          '<div class="up-filter-head"><span class="up-filter-title">' + esc(titel) + '</span></div>' +
          (suchbar
            ? '<div class="up-ment-searchwrap"><span class="up-ddsearch" data-dd-searchwrap>' +
                '<input class="up-ddsearch-in" type="text" placeholder="Search" autocomplete="off" ' +
                  'spellcheck="false" aria-label="Search" data-dd-search/>' +
                /* Lupe und Loeschkreuz sind das Paar aus core: hat das Feld Text, tauscht
                   .has-text am Rahmen die Lupe gegen das Kreuz. */
                '<span class="up-ddsearch-ic">' + ic("search", 2) + '</span>' +
                '<button class="up-ddsearch-x" type="button" aria-label="Clear search" data-dd-clear>' +
                  ic("x", 3.5) + '</button>' +
              '</span></div>'
            : "") +
          '<div class="up-filter-list uob-ddlist up-scroll" data-dd-list></div>' +
          (mitEigen
            /* Feld und Add-Knopf nebeneinander, das Loesch-X IM Feld -- exakt die Zeile aus
               "Your Brand" (settings-brand, .usb-ddcustom-row). Dort steht der Grund auch: ein
               Feld mit X darin ist EIN Bedienelement, ein Knopf mit eigener Beschriftung gehoert
               daneben. Ohne den Knopf liess sich eine getippte Branche nur ueber die
               Eingabetaste uebernehmen, und das sieht niemand. */
            ? '<div class="uob-ddcustom">' +
                '<span class="uob-ddcustom-field">' +
                  '<input class="up-ddsearch-in uob-ddcustom-in" type="text" maxlength="' + MAX.industry + '" ' +
                    'placeholder="Not listed? Add your own" autocomplete="off" spellcheck="false" ' +
                    'aria-label="Add your own" data-dd-custom/>' +
                  '<button class="uob-ddcustom-clear" type="button" aria-label="Clear" data-dd-customclear>' +
                    ic("x", 3.5) + '</button>' +
                '</span>' +
                '<button class="uob-ddcustom-add" type="button" data-dd-customadd disabled>Add</button>' +
              '</div>'
            : "") +
        '</div>' +
      '</div>';
    }

    function viewBrand() {
      return '<div class="uob-pane" data-pane="brand">' +
        kopf("Set up your brand", "Help us understand what your business does and who it serves.") +
        '<div class="uob-body">' +
          '<div class="uob-fields">' +
            '<div class="uob-field" data-field="name">' +
              '<label class="uob-label" for="' + instanceId + '-name">Brand name</label>' +
              '<input class="uob-input up-field" id="' + instanceId + '-name" type="text" ' +
                'maxlength="' + MAX.name + '" placeholder="Your brand" autocomplete="organization" ' +
                'data-f="name"/>' +
              '<div class="uob-hint">Avoid legal suffixes (e.g. GmbH, Inc., Ltd., LLC).</div>' +
              '<div class="uob-err"><span data-err="name"></span></div>' +
            '</div>' +
            '<div class="uob-field" data-field="website">' +
              '<label class="uob-label" for="' + instanceId + '-web">Website</label>' +
              /* Das Favicon sitzt IM Feld und zeigt beim Tippen, dass die Adresse gefunden wird.
                 Dieselbe Idee wie im Add-Brand-Popup -- dort steht es links, hier rechts, weil
                 das Feld hier keinen Einzug fuer ein Praefix hat und der rechte Rand sonst leer
                 bleibt. */
              '<span class="uob-inwrap">' +
                '<input class="uob-input up-field has-fav" id="' + instanceId + '-web" type="text" ' +
                  'maxlength="' + MAX.website + '" placeholder="yourbrand.com" autocomplete="url" ' +
                  'inputmode="url" data-f="website"/>' +
                '<span class="uob-fav" data-fav></span>' +
              '</span>' +
              '<div class="uob-err"><span data-err="website"></span></div>' +
            '</div>' +
            '<div class="uob-frow">' +
              '<div class="uob-field" data-field="market">' +
                '<span class="uob-label">Market</span>' +
                selectHtml("market", "Select a market", "Markets", true, false) +
                '<div class="uob-err"><span data-err="market"></span></div>' +
              '</div>' +
              '<div class="uob-field" data-field="timezone">' +
                '<span class="uob-label">Time zone</span>' +
                selectHtml("timezone", "Select a time zone", "Time zones", true, false) +
                '<div class="uob-err"><span data-err="timezone"></span></div>' +
              '</div>' +
            '</div>' +
            '<div class="uob-field" data-field="business">' +
              '<span class="uob-label">Business model</span>' +
              /* Vier feste Werte, alle gleich wichtig, keiner erklaerungsbeduerftig -- das ist
                 ein Switcher und kein Kasten, den man erst aufmachen muss. .up-seg aus core. */
              '<div class="up-seg uob-bseg" role="tablist" aria-label="Business model">' +
                '<span class="uob-bseg-ind" data-bseg-ind></span>' +
                BUSINESS.map(function (b) {
                  return '<button class="up-seg-btn" type="button" role="tab" aria-selected="false"' +
                         ' data-biz="' + esc(b.value) + '">' + esc(b.label) + '</button>';
                }).join("") +
              '</div>' +
              '<div class="uob-err"><span data-err="business"></span></div>' +
            '</div>' +
            /* Ein Feld wie jedes andere. Es steckte eine Zeit lang in einem Einklapp-Wrapper,
               weil es erst nach dem Geschaeftsmodell erscheinen sollte -- der Wrapper braucht
               fuer die Hoehenanimation ein overflow: hidden, und das SCHNITT den Ausklapp-Kasten
               auf Feldhoehe ab: sichtbar blieben dreissig bis fuenfzig Pixel. Die Staffelung ist
               zurueckgenommen, also faellt auch der Wrapper weg. Kaeme sie zurueck, muss das
               overflow nach der Animation wieder auf visible. */
            '<div class="uob-field" data-field="industry">' +
              '<span class="uob-labrow"><span class="uob-label">Industry</span>' +
                '<span class="uob-opt">Optional</span></span>' +
              selectHtml("industry", "Select an industry", "Industries", true, true) +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function viewLoad(kompakt) {
      var p = state.projekt || {};
      var name = txt(p.company_name) || txt(state.form.name) || "Your brand";
      var dom = txt(p.website_domain) || normUrl(state.form.website).domain;
      return '<div class="uob-pane" data-pane="' + (kompakt ? "load2" : "load1") + '">' +
        '<div class="uob-body">' +
          '<div class="uob-load' + (kompakt ? " is-compact" : "") + '">' +
            kachel("uob-load-logo", name, dom) +
            '<div class="uob-load-name">' + esc(name) + '</div>' +
            (dom ? '<div class="uob-load-dom">' + esc(dom) + '</div>' : "") +
            '<div class="uob-bar"><div class="uob-bar-fill" data-bar></div></div>' +
            (kompakt
              ? '<p class="uob-sub" style="margin-top:18px">Writing the first prompts for the topics you picked.</p>' +
                /* Die gewaehlten Themen als Marken -- dieselbe Idee wie im Ladebild von
                   prompt-research: das Warten zeigt, WOMIT gearbeitet wird. Hat der Nutzer
                   nichts gewaehlt, bleibt die Zeile leer statt etwas zu behaupten. */
                '<div class="uob-tl-tags" data-tltags>' +
                  state.topics.filter(function (t) { return state.selTopics[t.id]; })
                    .map(function (t) {
                      /* .up-topicchip aus core -- derselbe Chip, den die Prompts-Tabelle und die
                         Themenverwaltung zeichnen. is-static, weil er hier nur anzeigt. */
                      return '<span class="up-topicchip is-static" style="--ust-tag-color:' +
                             esc(farbeVon(t) || "#6b7280") + '">' +
                        '<span class="up-topicchip-lbl">' + esc(t.name) + '</span></span>';
                    }).join("") +
                '</div>'
              : '<div class="uob-phases" data-phases>' +
                  PHASES.map(function (ph, i) {
                    return '<div class="uob-phase" data-phase="' + i + '">' +
                      '<span class="uob-phase-ic">' +
                        '<span class="uob-phase-dot"></span>' +
                        '<span class="uob-phase-ring"></span>' +
                        '<span class="uob-phase-ok">' + ic("check", 3) + '</span>' +
                      '</span>' +
                      '<span class="uob-phase-txt">' +
                        '<span class="uob-phase-h">' + esc(ph.h) + '</span>' +
                        '<span class="uob-phase-b">' + esc(ph.b) + '</span>' +
                      '</span>' +
                    '</div>';
                  }).join("") +
                '</div>') +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function viewBrands() {
      var n = anzahl(state.selBrands);
      return '<div class="uob-pane" data-pane="competitors">' +
        kopf("Competitors",
             "Pick the brands closest to yours for sharper benchmarking. You can add more later.",
             { text: n + "/" + BRAND_MAX, voll: n >= BRAND_MAX }) +
        '<div class="uob-body">' +
          (state.brands.length
            ? '<div class="uob-list up-scroll is-cols" role="group" aria-label="Competitors">' +
                state.brands.map(function (b) {
                  var an = !!state.selBrands[b.id];
                  var gesperrt = !an && n >= BRAND_MAX;
                  return '<button class="uob-item' + (an ? " is-on" : "") + (gesperrt ? " is-blocked" : "") +
                           '" type="button" role="checkbox" aria-checked="' + (an ? "true" : "false") + '"' +
                           ' data-pick="brands" data-id="' + esc(b.id) + '"' + (gesperrt ? ' aria-disabled="true"' : "") + '>' +
                    '<span class="uob-check">' + ic("check", 3) + '</span>' +
                    kachel("uob-item-logo", b.name, b.domain, b.favicon_url) +
                    '<span class="uob-item-txt">' +
                      '<span class="uob-item-name">' + esc(b.name) + '</span>' +
                      /* Die Domain ist ein eigenes Ziel und oeffnet die Seite. Wer eine fremde
                         Marke nicht kennt, will sie ansehen koennen, bevor er sie als
                         Wettbewerber setzt -- und dafuer soll er das Onboarding nicht
                         verlassen muessen. Der Klick darf deshalb nicht bis zur Zeile
                         durchlaufen, sonst haekelt er nebenbei die Auswahl an. */
                      '<span class="uob-item-sub uob-link-out" role="link" tabindex="0"' +
                        ' data-open="' + esc(txt(b.url) || ("https://" + txt(b.domain))) + '"' +
                        ' data-tip="Open ' + esc(b.domain) + '">' + esc(b.domain) + '</span>' +
                    '</span>' +
                  '</button>';
                }).join("") +
              '</div>'
            : '<p class="uob-sub" style="margin-top:18px">We could not find comparable brands yet. ' +
              'You can add them from your dashboard at any time.</p>') +
        '</div>' +
      '</div>';
    }

    function viewTopics() {
      var n = anzahl(state.selTopics);
      return '<div class="uob-pane" data-pane="topics">' +
        kopf("Topics",
             "Topics group the questions we ask the models. Pick at least one you want to be found for.",
             { text: n + " selected", voll: n > 0 }) +
        '<div class="uob-body">' +
          (state.topics.length
            ? '<div class="uob-list up-scroll uob-group-items is-plain" role="group" aria-label="Topics">' +
                state.topics.map(function (t) {
                  var an = !!state.selTopics[t.id];
                  return '<button class="uob-item is-slim is-plain' + (an ? " is-on" : "") + '" type="button" role="checkbox"' +
                           ' aria-checked="' + (an ? "true" : "false") + '"' +
                           ' data-pick="topics" data-id="' + esc(t.id) + '">' +
                    '<span class="uob-check">' + ic("check", 3) + '</span>' +
                    /* Nur Farbe und Name. Die Beschreibung stand als zweite Zeile darunter und
                       machte aus einer Auswahlliste eine Leseaufgabe -- an dieser Stelle des
                       Ablaufs entscheidet niemand anhand eines Halbsatzes. */
                    '<span class="uob-swatch" style="--uob-sw:' + esc(farbeVon(t)) + '"></span>' +
                    '<span class="uob-item-txt">' +
                      '<span class="uob-item-name">' + esc(t.name) + '</span>' +
                    '</span>' +
                  '</button>';
                }).join("") +
                eigeneThemenHtml() +
              '</div>'
            : '<div class="uob-list uob-group-items is-plain" role="group" aria-label="Topics">' +
                eigeneThemenHtml() + '</div>') +
        '</div>' +
      '</div>';
    }

    /* Selbst hinzugefuegte Themen und der Platzhalter darunter. Sie stehen im selben Listenraster
       wie die vorgeschlagenen, damit sie gleichwertig aussehen -- sie SIND gleichwertig, der
       Nutzer weiss besser als der Hintergrundlauf, wofuer er gefunden werden will.
       Ein Thema ohne Namen zaehlt nicht mit: erst wenn etwas dasteht, ist es eines. */
    function eigeneThemenHtml() {
      var html = state.eigene.map(function (e, i) {
        return '<div class="uob-item is-slim is-plain" data-eigen="' + i + '">' +
          '<span class="uob-check' + (txt(e.name) ? "" : " is-leer") + '">' + ic("check", 3) + '</span>' +
          '<span class="uob-swatch" style="--uob-sw:' + esc(e.farbe) + '"></span>' +
          '<input class="uob-newin" type="text" maxlength="' + MAX.topic + '" value="' + esc(e.name) + '"' +
            ' placeholder="Name your topic" autocomplete="off" spellcheck="false" data-eigen-in="' + i + '"/>' +
          '<button class="uob-newdel" type="button" data-eigen-del="' + i + '" aria-label="Remove topic">' +
            ic("x", 3) + '</button>' +
        '</div>';
      }).join("");
      if (state.eigene.length < EIGEN_MAX) {
        html += '<button class="uob-add" type="button" data-addtopic>' + ic("plus", 2) + 'Add your own</button>';
      }
      return html;
    }

    /* Prompts nach Thema. Ein Prompt mit mehreren Themen steht GENAU EINMAL, unter seinem ersten
       -- sonst waere derselbe Prompt zweimal anwaehlbar und der Zaehler zaehlte ihn doppelt. Die
       uebrigen Themen stehen als kleine Marken am Zeilenende, damit die Ueberschneidung sichtbar
       bleibt. Prompts ohne Thema kommen als letzte Gruppe, nicht unter ein erfundenes. */
    function promptGruppen() {
      var byId = {}, i;
      for (i = 0; i < state.topics.length; i++) byId[state.topics[i].id] = state.topics[i];
      var gruppen = [], index = {};
      function gruppe(id, name, farbe) {
        if (index[id]) return index[id];
        var g = { id: id, name: name, farbe: farbe, items: [] };
        index[id] = g; gruppen.push(g); return g;
      }
      /* Reihenfolge der Gruppen = Reihenfolge der Themen, nicht die des ersten Treffers: sonst
         springt die Liste bei jedem neuen Payload anders. */
      for (i = 0; i < state.topics.length; i++) {
        gruppe(state.topics[i].id, state.topics[i].name, farbeVon(state.topics[i]));
      }
      for (i = 0; i < state.prompts.length; i++) {
        var p = state.prompts[i];
        var ids = isArr(p.topic_ids) ? p.topic_ids : (txt(p.topic_id) ? [txt(p.topic_id)] : []);
        var erst = null;
        for (var j = 0; j < ids.length; j++) if (byId[ids[j]]) { erst = ids[j]; break; }
        var g = erst ? gruppe(erst, byId[erst].name, farbeVon(byId[erst]))
                     : gruppe("__ohne", "Other", "");
        g.items.push({ p: p, weitere: ids.filter(function (x) { return x !== erst && byId[x]; }) });
      }
      return gruppen.filter(function (g) { return g.items.length; });
    }

    function viewPrompts() {
      var n = anzahl(state.selPrompts);
      var gruppen = promptGruppen();
      return '<div class="uob-pane" data-pane="prompts">' +
        kopf("Prompts",
             "These are the questions we will ask the models for you. Keep the ones that matter.",
             { text: n + " selected", voll: n > 0 }) +
        '<div class="uob-body">' +
          (gruppen.length
            ? '<div class="uob-list up-scroll" role="group" aria-label="Prompts">' +
                gruppen.map(function (g) {
                  return '<div class="uob-group">' +
                    '<div class="uob-group-h">' +
                      (g.farbe ? '<span class="uob-swatch" style="--uob-sw:' + esc(g.farbe) + '"></span>' : "") +
                      '<span>' + esc(g.name) + '</span>' +
                      '<span class="uob-group-n">' + g.items.length + '</span>' +
                      /* Alle Prompts eines Themas auf einmal. Ein Umschalter und kein reines
                         Hinzufuegen: wer versehentlich alles waehlt, muss es sonst einzeln
                         wieder abwaehlen. Die Beschriftung sagt, was der Klick TUT, nicht was
                         gerade gilt. */
                      '<button class="uob-group-all" type="button" data-all="' + esc(g.id) + '">' +
                        (alleAn(g) ? "Deselect all" : "Select all") +
                      '</button>' +
                    '</div>' +
                    '<div class="uob-group-items is-plain">' +
                      g.items.map(function (it) {
                        var an = !!state.selPrompts[it.p.id];
                        return '<button class="uob-item is-multiline is-plain' + (an ? " is-on" : "") + '" type="button"' +
                                 ' role="checkbox" aria-checked="' + (an ? "true" : "false") + '"' +
                                 ' data-pick="prompts" data-id="' + esc(it.p.id) + '">' +
                          '<span class="uob-check">' + ic("check", 3) + '</span>' +
                          (txt(it.p.market) && UC.marketChip ? UC.marketChip(it.p.market) : "") +
                          '<span class="uob-item-txt">' +
                            '<span class="uob-item-long">' + esc(it.p.prompt_text) + '</span>' +
                          '</span>' +
                        '</button>';
                      }).join("") +
                    '</div>' +
                  '</div>';
                }).join("") +
              '</div>'
            : '<p class="uob-sub" style="margin-top:18px">No prompts yet.</p>') +
        '</div>' +
      '</div>';
    }

    function viewPlan() {
      var jaehrlich = state.interval === "yearly";
      return '<div class="uob-pane" data-pane="plan">' +
        kopf("Choose your plan", testText()) +
        '<div class="uob-body">' +
          '<div class="uob-billrow">' +
            '<div class="up-seg" role="tablist" aria-label="Billing interval">' +
              '<button class="up-seg-btn' + (!jaehrlich ? " is-active" : "") + '" type="button" role="tab"' +
                ' aria-selected="' + (!jaehrlich ? "true" : "false") + '" data-interval="monthly">Monthly</button>' +
              '<button class="up-seg-btn' + (jaehrlich ? " is-active" : "") + '" type="button" role="tab"' +
                ' aria-selected="' + (jaehrlich ? "true" : "false") + '" data-interval="yearly">Yearly</button>' +
            '</div>' +
          '</div>' +
          (state.plans.length
            ? '<div class="uob-plans">' + state.plans.map(function (pl, i) {
                var an = state.plan === pl.id;
                var mon = num(pl.monthly_price_eur), jah = num(pl.yearly_price_eur);
                /* Der Jahrespreis wird auf den Monat umgerechnet, damit die drei Karten
                   vergleichbar bleiben. Die Ersparnis daneben ist gerechnet, nicht getippt --
                   ein getippter Prozentwert waere beim naechsten Preis falsch. */
                var zeigMon = jaehrlich && jah != null ? jah / 12 : mon;
                var spar = (mon != null && jah != null && mon > 0)
                  ? Math.round(100 - (jah / (mon * 12)) * 100) : null;
                /* Empfohlen ist die MITTLERE Karte. Nicht die teuerste, und nicht per Feld aus
                   den Daten: dort gibt es keins, und ein erfundenes waere eine Behauptung. */
                var empfohlen = state.plans.length === 3 && i === 1;
                return '<button class="uob-plan' + (an ? " is-on" : "") + '" type="button" role="radio"' +
                         ' aria-checked="' + (an ? "true" : "false") + '" data-plan="' + esc(pl.id) + '">' +
                  (empfohlen ? '<span class="uob-plan-tag">Most popular</span>' : "") +
                  '<span class="uob-plan-h"><span class="uob-plan-name">' + esc(pl.name) + '</span></span>' +
                  (txt(pl.description) ? '<span class="uob-plan-desc">' + esc(pl.description) + '</span>' : "") +
                  '<span class="uob-plan-price">' +
                    '<span class="uob-plan-amt">' + esc(geld(zeigMon)) + '</span>' +
                    '<span class="uob-plan-per">/ month</span>' +
                  '</span>' +
                  '<span class="uob-plan-note' + (jaehrlich && spar ? " is-on" : "") + '"><span>' +
                    (spar ? "Save " + spar + "% billed yearly" : "") + '</span></span>' +
                  /* Wortlaut und Reihenfolge sind die der Preisseite. Sie stehen hier nicht,
                     weil sie mir gefallen, sondern damit ein Nutzer, der von dort kommt,
                     dieselbe Liste wiederfindet. */
                  '<span class="uob-plan-feats">' +
                    feat("Track <b>ChatGPT, Perplexity &amp; Google AI Overviews</b>") +
                    feat("Track up to <b>" + esc(String(pl.prompts_per_day)) + " prompts</b>") +
                    feat("Prompts executed daily") +
                    (antworten(pl) != null
                      ? feat((pl.ai_responses_more === true ? "Analyze more than " : "Analyze up to ") +
                             "<b>" + esc(zahl(antworten(pl))) + " AI responses per month</b>")
                      : "") +
                    feat("Unlimited countries / languages") +
                    feat("Unlimited seats for your team") +
                    feat("Track up to <b>" + esc(marken(pl)) + " brands / competitors</b>") +
                    feat(esc(hilfe(pl))) +
                  '</span>' +
                '</button>';
              }).join("") + '</div>'
            : '<p class="uob-sub" style="margin-top:18px">No plans available right now.</p>') +
        '</div>' +
      '</div>';
    }
    /* Der Wechsel zwischen Monat und Jahr, ohne das Markup anzufassen: Schalter umstellen, die
       Ersparnis-Zeile auf- oder zuklappen (die traegt ihren Uebergang selbst und schiebt die
       Kartenhoehe damit weich mit), und die Betraege von der alten Zahl auf die neue zaehlen.
       Ein Preis, der einfach umspringt, liest sich wie ein anderer Preis -- ein zaehlender sagt,
       dass es DERSELBE Tarif zu anderen Bedingungen ist. */
    function intervalZeichnen() {
      var jaehrlich = state.interval === "yearly";
      var sw = root.querySelectorAll("[data-interval]");
      for (var i = 0; i < sw.length; i++) {
        var an = sw[i].getAttribute("data-interval") === state.interval;
        sw[i].classList.toggle("is-active", an);
        sw[i].setAttribute("aria-selected", an ? "true" : "false");
      }
      var karten = root.querySelectorAll(".uob-plan");
      for (var k = 0; k < karten.length; k++) {
        var pl = state.plans[k]; if (!pl) continue;
        var mon = num(pl.monthly_price_eur), jah = num(pl.yearly_price_eur);
        var ziel = jaehrlich && jah != null ? jah / 12 : mon;
        var betrag = karten[k].querySelector(".uob-plan-amt");
        if (betrag) zaehle(betrag, ziel);
        var notiz = karten[k].querySelector(".uob-plan-note");
        if (notiz) notiz.classList.toggle("is-on", jaehrlich && !!notiz.textContent.trim());
      }
    }
    /* Von der Zahl, die dasteht, auf die neue. Die Ausgangszahl wird aus dem Text gelesen und
       nicht mitgefuehrt: so stimmt sie auch dann, wenn mitten im Zaehlen erneut umgeschaltet
       wird. 380ms mit weichem Ausklang -- laenger als ein Zustandswechsel, weil hier eine Zahl
       gelesen werden soll, waehrend sie laeuft. */
    function zaehle(el, ziel) {
      if (ziel == null) { el.textContent = geld(null); return; }
      var von = num(String(el.textContent).replace(/[^0-9.,-]/g, ""));
      if (von == null || von === Math.round(ziel)) { el.textContent = geld(ziel); return; }
      if (el.__uobLauf) { window.cancelAnimationFrame(el.__uobLauf); el.__uobLauf = 0; }
      if (el.__uobEnde) { window.clearTimeout(el.__uobEnde); el.__uobEnde = 0; }
      var start = 0, DAUER = 380;
      function fertig() {
        if (el.__uobLauf) { window.cancelAnimationFrame(el.__uobLauf); el.__uobLauf = 0; }
        el.__uobEnde = 0;
        el.textContent = geld(ziel);
      }
      /* Die SICHERUNG steht vor der Animation, nicht dahinter: requestAnimationFrame ist in
         einem verdeckten Tab angehalten. Ohne diese Uhr bliebe dort der ALTE Preis stehen --
         ein Zaehler, der nicht laeuft, waere Schoenheitsfehler, ein falscher Preis nicht.
         Der Zeitgeber wird gedrosselt, aber nicht gestoppt. */
      el.__uobEnde = window.setTimeout(fertig, DAUER + 80);
      if (!window.requestAnimationFrame) { fertig(); return; }
      function schritt(t) {
        if (!start) start = t;
        var p = Math.min(1, (t - start) / DAUER);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = geld(von + (ziel - von) * e);
        if (p < 1) el.__uobLauf = window.requestAnimationFrame(schritt);
        else fertig();
      }
      el.__uobLauf = window.requestAnimationFrame(schritt);
    }

    /* Die Testphase steht EINMAL unter der Ueberschrift und nicht in jeder Karte: sie ist bei
       allen Tarifen dieselbe, und dreimal derselbe Satz nebeneinander liest sich wie ein
       Unterschied, den es nicht gibt. Die Zahl kommt aus den Daten; sind sie uneinheitlich,
       bleibt der Satz allgemein. */
    function testText() {
      var tage = null, gleich = true;
      for (var i = 0; i < state.plans.length; i++) {
        var t = num(state.plans[i].trial_days);
        if (i === 0) tage = t; else if (t !== tage) gleich = false;
      }
      return (gleich && tage)
        ? "Every plan starts with a " + Math.round(tage) + "-day free trial. No charge until it ends."
        : "Every plan starts with a free trial. No charge until it ends.";
    }

    function feat(html) { return '<span class="uob-plan-feat">' + ic("check", 2.6) + '<span>' + html + '</span></span>'; }
    /* Die Zahl der Antworten je Monat kommt AUS DEN DATEN oder gar nicht. Rechnen laesst sie
       sich nicht: die Preisseite nennt 4.650, 13.500 und ueber 30.000 bei 50, 150 und 350
       Prompts -- das sind Faktoren von 93, 90 und 85,7, also gesetzte Zahlen und keine Formel.
       Eine hier erfundene Rechnung stuende ueber kurz oder lang im Widerspruch zur Preisseite,
       und von zwei Zahlen glaubt ein Nutzer der kleineren. Fehlt das Feld, faellt die Zeile
       weg. */
    function antworten(pl) { return num(pl.ai_responses_per_month); }
    /* Die Preisseite zaehlt die EIGENE Marke mit: fuenf Wettbewerber sind dort "6 brands /
       competitors". Die Rechnung steht hier und nicht in den Daten, weil competitors_max_active
       eine technische Grenze ist und die Karte eine Aussage an den Kunden. */
    function marken(pl) {
      var n = num(pl.competitors_max_active);
      return n == null ? "–" : String(Math.round(n) + 1);
    }
    function zahl(v) {
      if (v == null) return "–";
      /* PUNKT als Tausendertrenner, nicht Komma. Der englische Text der Oberflaeche spraeche
         fuer das Komma -- aber diese Zahl steht wortgleich so auf der Preisseite, und ein Nutzer,
         der von dort kommt, soll dieselbe Zahl wiedererkennen und nicht kurz stutzen. Der
         Wiedererkennungswert schlaegt die Schreibkonvention. */
      return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    /* Die letzte Zeile im Wortlaut der Preisseite: "Standard email support" beim kleinsten
       Tarif, sonst "Personal account manager". Steht sie im Payload, gilt der Payload -- der
       Rueckfall haengt an der Position und ist damit eine Annahme, die beim vierten Tarif
       stillschweigend falsch waere. */
    function hilfe(pl) {
      var eigen = txt(pl.support_label);
      if (eigen) return eigen;
      return state.plans.indexOf(pl) <= 0 ? "Standard email support" : "Personal account manager";
    }
    function geld(v) {
      if (v == null) return "–";
      /* Ganze Euro, wenn es aufgeht -- "89 €" liest sich schneller als "89,00 €", und bei der
         Monatsumrechnung eines Jahrespreises ist die Nachkommastelle keine Information, sondern
         ein Rundungsrest. */
      var g = Math.round(v);
      return "€" + (Math.abs(v - g) < 0.005 ? String(g) : v.toFixed(0));
    }
    function farbeVon(t) {
      if (!t) return "";
      var h = txt(isDark ? (t.hex_dark || t.hex_light) : (t.hex_light || t.hex_dark));
      if (h) return h;
      /* Kein Farbwert dabei: die Themenpalette von core, IN IHRER REIHENFOLGE. Sie ist als Zeile
         durch den ganzen Farbkreis gebaut (rot, braun, oliv, gruen, tuerkis, blau, violett,
         magenta) -- wer aus ihr auswaehlt statt sie abzulaufen, bekommt einen Regenbogen ohne
         Ordnung. Genau dieselbe Palette benutzen die Themenverwaltung und die Prompts-Tabelle. */
      /* Kein Farbwert dabei: aus der Themenpalette von core, stabil nach der Position -- so
         bekommt dasselbe Thema bei jedem Aufbau denselben Ton. */
      var pal = UC.TOPIC_COLOR_PALETTE || [];
      if (!pal.length) return "";
      var i = 0;
      for (var k = 0; k < state.topics.length; k++) if (state.topics[k].id === t.id) { i = k; break; }
      return pal[i % pal.length];
    }
    function alleAn(g) {
      for (var i = 0; i < g.items.length; i++) if (!state.selPrompts[g.items[i].p.id]) return false;
      return g.items.length > 0;
    }
    function anzahl(o) { var n = 0; for (var k in o) if (o[k]) n++; return n; }
    function idsVon(o) { var a = []; for (var k in o) if (o[k]) a.push(k); return a; }

    /* ---- Zeichnen -------------------------------------------------------------------------- */
    var letzteAnsicht = "";
    function ansichtKey() {
      if (state.warten === "main") return "load1";
      if (state.warten === "prompts") return "load2";
      return state.step;
    }
    function viewFor(k) {
      if (k === "load1") return viewLoad(false);
      if (k === "load2") return viewLoad(true);
      if (k === "brand") return viewBrand();
      if (k === "competitors") return viewBrands();
      if (k === "topics") return viewTopics();
      if (k === "prompts") return viewPrompts();
      if (k === "plan") return viewPlan();
      return "";
    }

    /* Die Spaltenbreite je Ansicht. Ein Formular liest sich schmal besser, Listen brauchen mehr,
       drei Preiskarten am meisten. */
    var BREITE = { brand: "480px", load1: "480px", load2: "560px",
                   competitors: "880px", topics: "620px", prompts: "720px", plan: "1040px" };

    function render(neuEingezogen) {
      var k = ansichtKey();
      var wechsel = k !== letzteAnsicht;
      root.style.setProperty("--uob-w", BREITE[k] || "480px");

      if (wechsel) {
        /* Der abgehende Bereich bleibt fuer die Dauer des Uebergangs stehen und geht dabei weg.
           Ohne ihn faellt die Spalte auf null zusammen und schnellt wieder auf -- der haesslichste
           Fall eines Schrittwechsels. */
        var alt = elStack.querySelector(".uob-pane");
        elStack.insertAdjacentHTML("beforeend", viewFor(k));
        var neu = elStack.lastElementChild;
        if (alt) {
          alt.classList.add("is-off");
          window.setTimeout(function () { if (alt.parentNode) alt.parentNode.removeChild(alt); }, 240);
        }
        if (!neuEingezogen) {
          neu.classList.add("is-arriving");
          window.setTimeout(function () { neu.classList.remove("is-arriving"); }, 420);
        }
        letzteAnsicht = k;
        nachZeichnen(k);
      } else {
        var jetzt = elStack.querySelector(".uob-pane:not(.is-off)");
        if (jetzt) {
          /* Innerhalb derselben Ansicht wird nur der Inhalt getauscht, nicht der Bereich: sonst
             liefe bei jedem Haken der Einzug erneut. */
          var frisch = document.createElement("div");
          frisch.innerHTML = viewFor(k);
          var neuIn = frisch.firstElementChild;
          jetzt.innerHTML = neuIn.innerHTML;
          nachZeichnen(k);
        }
      }
      renderRail();
      renderIdent();
      renderNav();
      renderBanner();
      renderHilfe();
    }

    /* Was nach jedem Zeichnen wieder gesetzt werden muss, weil es nicht im Markup steht. */
    function nachZeichnen(k) {
      if (k === "brand") {
        setzeFormWerte();
        baueSelects();
        zeigeFeldfehler();
      }
      if (k === "load1" || k === "load2") renderPhasen();
      if (k === "load2") tlTagsEinblenden();
      if (UC.makeTooltips) UC.makeTooltips(root, function () { return isDark; });
    }

    /* Der Tarif steht NICHT von Anfang an in der Schiene. Wer beim ersten Blick sieht, dass am
       Ende eine Bezahlseite wartet, entscheidet ueber den ganzen Ablauf anders. Sichtbar wird er
       genau dann, wenn der Nutzer dort ankommt -- und bleibt es danach, auch wenn er nochmal
       zurueckgeht: ein Punkt, der wieder verschwindet, waere ein Taschenspielertrick. */
    function sichtbareSteps() {
      if (state.planGesehen) return STEPS;
      return STEPS.filter(function (x) { return x.key !== "plan"; });
    }
    var railStand = "";
    function renderRail() {
      var k = ansichtKey();
      if (state.step === "plan") state.planGesehen = true;
      var liste = sichtbareSteps();
      var i = 0;
      for (var q = 0; q < liste.length; q++) if (liste[q].key === state.step) { i = q; break; }
      var letzte = Math.max(1, liste.length - 1);

      /* Die Punkte nur neu bauen, wenn sich ihre ZAHL geaendert hat. Sonst blieben Klassen und
         Uebergaenge nicht erhalten, und der Tarif-Punkt koennte nicht sanft dazukommen. */
      var schluessel = liste.map(function (x) { return x.key; }).join(",");
      var neuGebaut = schluessel !== railStand;
      if (neuGebaut) {
        var vorher = railStand ? railStand.split(",") : [];
        function x(n) { return (n / letzte * 100) + "%"; }
        elRailDots.innerHTML = liste.map(function (e, n) {
          var frisch = vorher.length && vorher.indexOf(e.key) < 0;
          return '<span class="uob-dot' + (frisch ? " is-fresh" : "") + '"' +
                 ' data-dot="' + esc(e.key) + '" style="--uob-x:' + x(n) + '">' + ic("check", 3) + '</span>';
        }).join("");
        elRailLbls.innerHTML = liste.map(function (e, n) {
          var frisch = vorher.length && vorher.indexOf(e.key) < 0;
          return '<span class="' + (frisch ? "is-fresh" : "") + '" data-lbl="' + esc(e.key) +
                 '" style="--uob-x:' + x(n) + '">' + esc(e.label) + '</span>';
        }).join("");
        /* Eine Trefferflaeche je Station, ueber Punkt UND Beschriftung. Sie traegt Klick und
           Hover; Punkt und Text sind nur noch Bild (pointer-events: none im CSS). */
        elRailHits.innerHTML = liste.map(function (e, n) {
          return '<button class="uob-rail-hit" type="button" data-go="' + esc(e.key) + '"' +
                 ' style="--uob-x:' + x(n) + '" aria-label="' + esc(e.label) + '" tabindex="-1"></button>';
        }).join("");
        railStand = schluessel;
        window.setTimeout(function () {
          [].forEach.call(root.querySelectorAll(".is-fresh"), function (e2) { e2.classList.remove("is-fresh"); });
        }, 30);
      }

      var dots = elRailDots.children, labels = elRailLbls.children, hits = elRailHits.children;
      var wartet = !!state.warten;
      /* Der weiteste je erreichte Schritt entscheidet, nicht der aktuelle: wer von Plan
         zurueckgeht, muss auch wieder nach vorn. Brand ist davon ausgenommen und bleibt
         gesperrt -- ein zweites Absenden der Stammdaten wuerde den Hintergrundlauf doppeln. */
      if (i > state.maxErreicht) state.maxErreicht = i;
      var brandGesperrt = state.maxErreicht > 0;

      for (var n = 0; n < dots.length; n++) {
        var fertig = wartet ? n <= i : n < i;
        var anteil = (n / letzte * 100) + "%";
        dots[n].style.setProperty("--uob-x", anteil);
        if (labels[n]) labels[n].style.setProperty("--uob-x", anteil);
        if (hits[n]) hits[n].style.setProperty("--uob-x", anteil);

        /* Brand bleibt nach dem Absenden gesperrt -- aber nur im Verhalten. Sichtbar ist es ein
           erledigter Schritt wie jeder andere; eine ausgegraute Station war hier eine Zeit lang
           zu sehen und ist zurueckgenommen worden. */
        var gesperrt = n === 0 && brandGesperrt;
        dots[n].classList.toggle("is-done", fertig || (n <= state.maxErreicht && n !== i));
        dots[n].classList.toggle("is-now", !wartet && n === i);

        var klickbar = !wartet && !gesperrt && n !== i && n <= state.maxErreicht;
        if (hits[n]) {
          hits[n].classList.toggle("is-link", klickbar);
          hits[n].disabled = !klickbar;
          hits[n].tabIndex = klickbar ? 0 : -1;
        }
        if (labels[n]) {
          labels[n].classList.toggle("is-done", n <= state.maxErreicht && n !== i);
          labels[n].classList.toggle("is-now", !wartet && n === i);
          if (!klickbar) labels[n].classList.remove("is-hot");
        }
        if (!klickbar) dots[n].classList.remove("is-hot");
      }
      /* Die Breite der Trefferflaeche: der halbe Abstand zwischen zwei Punkten nach jeder Seite,
         damit sich benachbarte Flaechen weder ueberlappen noch eine Luecke lassen. */
      if (elRail.clientWidth) {
        elRailHits.style.setProperty("--uob-w-hit",
          Math.max(44, Math.round((elRail.clientWidth - 16) / letzte)) + "px");
      }

      var pos = wartet ? i + 0.5 : i;
      var breite = pos / letzte * 100;
      if (elRailFill) elRailFill.style.width = breite + "%";
      labelsPruefen(liste.length);
      root.setAttribute("data-view", k);
    }

    /* Passt die breiteste Beschriftung nicht mehr zwischen zwei Punkte, verschwinden alle. Ein
       fester Breakpoint waere hier falsch: wie breit "Competitors" ist, haengt an der Schrift und
       nicht am Fenster. */
    function labelsPruefen(anzahl) {
      if (!elRail || !elRailLbls || anzahl < 2) return;
      var spanne = elRail.clientWidth - 16;             /* 16 = Polster der Schiene */
      if (spanne <= 0) return;
      var abstand = spanne / (anzahl - 1);
      /* Gemessen wird IMMER im sichtbaren Zustand. Ohne die zwei Zeilen schaukelt sich das auf:
         ausgeblendet ist display:none, damit ist scrollWidth 0, damit passt alles wieder, damit
         kommen die Beschriftungen zurueck, passen nicht -- und es flackert. Gemessen im Wechsel
         von 380 auf 330 Pixel. */
      var warAus = elRail.classList.contains("is-nolabels");
      if (warAus) elRail.classList.remove("is-nolabels");
      var breiteste = 0;
      for (var n = 0; n < elRailLbls.children.length; n++) {
        var w = elRailLbls.children[n].scrollWidth;
        if (w > breiteste) breiteste = w;
      }
      elRail.classList.toggle("is-nolabels", breiteste + 12 > abstand);
    }

    function renderIdent() {
      var p = state.projekt;
      /* Waehrend BEIDER Ladebilder steht die Marke schon gross in der Mitte -- der kleine Block
         oben waere dann dasselbe zweimal auf einem Bildschirm. Beim ersten Schritt gibt es noch
         nichts zu zeigen. */
      var k = ansichtKey();
      var an = !!p && k !== "brand" && k !== "load1" && k !== "load2";
      elIdent.classList.toggle("is-on", an);
      if (!an) return;
      var name = txt(p.company_name) || txt(state.form.name);
      var dom = txt(p.website_domain);
      elIdentNm.textContent = name;
      elIdentDm.textContent = dom;
      /* Nur neu bauen, wenn sich die Marke wirklich geaendert hat -- sonst laedt das Favicon bei
         jedem Haken in der Liste erneut und blitzt dabei. */
      var schluessel = dom + "|" + name;
      if (elIdentLg.getAttribute("data-for") !== schluessel) {
        elIdentLg.setAttribute("data-for", schluessel);
        var fav = favicon(dom);
        elIdentLg.className = "uob-ident-logo" + (fav ? " has-img" : "");
        elIdentLg.innerHTML = kachelInhalt(name, fav);
      }
    }

    function renderNav() {
      var k = ansichtKey();
      var wartet = k === "load1" || k === "load2";
      /* Waehrend einer Uhr gibt es nichts zu bedienen. Die Zeile wird ausgeblendet und nicht
         entfernt: ihr Platz bleibt, damit der Inhalt darueber nicht nach unten rutscht und
         zurueckspringt, sobald sie wiederkommt. */
      elNav.style.visibility = wartet ? "hidden" : "";
      elNav.setAttribute("aria-hidden", wartet ? "true" : "false");
      if (wartet) return;

      var i = stepIndex(state.step);
      /* Kein Zurueck von Competitors: dahinter liegt nur Brand, und dorthin darf niemand mehr
         -- die Stammdaten sind abgeschickt und haben einen Hintergrundlauf gestartet. Ein Knopf,
         der nichts tut, ist schlechter als keiner. */
      elBack.classList.toggle("is-hidden", i <= 1);
      elNext.classList.toggle("is-busy", state.busy);
      elNext.disabled = state.busy || (state.step === "plan" && !state.plan);

      var texte = { brand: "Continue", competitors: "Continue", topics: "Continue",
                    prompts: "Continue", plan: "Start free trial" };
      elNextTxt.textContent = texte[state.step] || "Continue";
      /* Mindestens ein Thema. Ohne Thema entstehen keine Prompts, und ohne Prompts hat das
         fertige Konto nichts zu messen -- der Schritt ist der einzige, der wirklich noetig ist.
         Deshalb hier kein Ueberspringen und ein gesperrter Weiter-Knopf, solange nichts steht. */
      if (state.step === "topics" && !anzahl(state.selTopics)) elNext.disabled = true;

      /* Ueberspringen erscheint nur dort, wo wirklich nichts ausgewaehlt ist -- sobald jemand
         etwas angeklickt hat, waere "Skip" das falsche Wort fuer das, was der Klick tut. */
      var alt = elNav.querySelector("[data-skip]");
      /* Themen fehlen hier mit Absicht: sie sind Pflicht, siehe oben. */
      var zeigen = (state.step === "competitors" && !anzahl(state.selBrands)) ||
                   (state.step === "prompts" && !anzahl(state.selPrompts));
      if (zeigen && !alt) {
        /* Direkt NEBEN den Weiter-Knopf, nicht irgendwo in die Mitte der Zeile: die beiden sind
           zwei Antworten auf dieselbe Frage, und die gehoeren nebeneinander. */
        elNext.insertAdjacentHTML("beforebegin",
          '<button class="uob-skip" type="button" data-skip>Skip for now</button>');
      } else if (!zeigen && alt) {
        alt.parentNode.removeChild(alt);
      }
    }

    /* ---- Begleittafel ------------------------------------------------------------------------
       Sie folgt dem Schritt und faellt bei den Wartezustaenden auf den Schritt zurueck, zu dem
       die Uhr gehoert -- waehrend des Wartens ist Erklaerung genau das Richtige, und ein leerer
       Kasten waere die falsche Antwort auf zwanzig Sekunden Leerlauf. */
    function hilfeSprache() {
      return MARKT_DE[txt(state.form.market).toUpperCase()] ? "de" : "en";
    }
    /* Waehrend einer Uhr und beim Tarif gibt es keinen Guide. Beim Warten hat der Nutzer nichts
       zu entscheiden -- da ist Lesestoff daneben nur Betrieb; und der Tarif erklaert sich auf
       den Karten selbst, ein Kasten daneben waere eine zweite Meinung zum selben Preis. */
    function hilfeSchluessel() {
      var k = ansichtKey();
      if (k === "load1" || k === "load2" || k === "plan") return "";
      return k;
    }
    /* Passt die Tafel neben den Inhalt, ohne ihn zu verdecken? Sie steht rechts und ist absolut
       gesetzt, schiebt also nichts zur Seite -- auf einem schmalen Schirm liegt sie damit ueber
       der Spalte. Von SELBST darf sie nur aufgehen, wenn daneben Platz ist; per Knopf jederzeit,
       denn dann hat der Nutzer sie ausdruecklich geholt und weiss, was er verdeckt.
       Gemessen bei 900px: Spalte endet bei 690, Tafel begann bei 570 -- 120 Pixel Ueberdeckung.
       Im schmalen Modus legt sich die Tafel ohnehin ueber die ganze Breite, dort ist die Antwort
       immer nein. */
    function hilfePasst() {
      if (!elHelp) return false;
      if (root.classList.contains("is-narrow") || root.classList.contains("is-vnarrow")) return false;
      var col = root.querySelector(".uob-col");
      if (!col) return true;
      var rr = root.getBoundingClientRect(), cc = col.getBoundingClientRect();
      var breite = elHelp.offsetWidth || 320;
      var rechts = parseFloat(window.getComputedStyle(elHelp).right);
      if (!isFinite(rechts)) rechts = 24;
      /* 16px Luft zwischen Spalte und Tafel -- beruehren zaehlt nicht als "passt". */
      return (rr.right - rechts - breite) >= (cc.right + 16);
    }
    function renderHilfe() {
      var sp = HILFE[hilfeSprache()];
      var schl = hilfeSchluessel();
      var d = schl ? sp[schl] : null;
      var offen = !!state.hilfeAuf && !!d;
      if (elHelpBtn) {
        var lbl = elHelpBtn.querySelector("[data-help-lbl]");
        if (lbl) lbl.textContent = sp.titel;
        elHelpBtn.setAttribute("aria-pressed", offen ? "true" : "false");
        elHelpBtn.classList.toggle("is-on", offen);
        /* Kein Guide fuer diesen Schritt heisst: auch keinen Knopf dafuer. Ein Knopf, der
           nichts aufmacht, ist schlimmer als keiner. */
        elHelpBtn.hidden = !d;
        /* Der Punkt am Knopf: es gibt etwas zu lesen, und der Nutzer hat es fuer DIESEN Schritt
           noch nicht gesehen. Genau das Zeichen, das die Icon-Knoepfe der App tragen
           (.up-badge.is-dot). Er verschwindet, sobald der Kasten einmal offen war. */
        var dot = elHelpBtn.querySelector("[data-help-dot]");
        if (dot) dot.classList.toggle("is-visible", !!d && !offen && !state.hilfeGesehen[schl]);
      }
      elHelp.classList.toggle("is-on", offen);
      elHelp.setAttribute("aria-hidden", offen ? "false" : "true");
      if (!d) { return; }
      if (offen) state.hilfeGesehen[schl] = true;
      elHelpTtl.textContent = sp.titel;
      /* Nur neu setzen, wenn sich der Inhalt wirklich aendert -- sonst springt der Scrollstand
         der Tafel bei jedem Haken in der Liste zurueck. */
      var kennung = hilfeSprache() + "|" + hilfeSchluessel();
      if (elHelpBody.getAttribute("data-fuer") === kennung) return;
      elHelpBody.setAttribute("data-fuer", kennung);
      /* Das Zeichen steht MITTEN im Satz, direkt vor dem Wort, um das es geht. Deshalb kommt es
         ueber einen Platzhalter in den Text und nicht daneben: "Die [Marken] Brands, an denen
         wir dich messen" liest sich als ein Satz, ein Zeichen vor dem Absatz waere eine
         Ueberschrift. esc() laeuft VOR dem Einsetzen, damit der Text weiter maskiert ist und
         nur das Zeichen als Markup durchgeht. */
      /* Ohne d.ic gibt es kein Zeichen im Satz -- der erste Schritt kommt bewusst ohne aus.
         Der Platzhalter wird dann einfach entfernt, statt ein Ersatzzeichen einzusetzen. */
      var leadHtml = d.ic
        ? esc(d.lead).replace("{ic}", '<span class="uob-help-leadic">' + ic(d.ic, 2) + '</span>')
        : esc(d.lead).replace("{ic}", "");
      elHelpBody.innerHTML =
        '<p class="uob-help-lead">' + leadHtml + '</p>' +
        '<div class="uob-help-sec">' +
          '<h4 class="uob-help-h">' + esc(d.warum.h) + '</h4>' +
          '<p class="uob-help-t">' + esc(d.warum.t) + '</p>' +
        '</div>' +
        '<div class="uob-help-sec">' +
          '<h4 class="uob-help-h">' + esc(d.wie.h) + '</h4>' +
          '<ul class="uob-help-l">' +
            d.wie.l.map(function (z) { return '<li>' + esc(z) + '</li>'; }).join("") +
          '</ul>' +
        '</div>';
    }
    /* Auf oder zu ueberlebt den Schrittwechsel und das Neuladen: wer sie einmal weggeklickt hat,
       will sie nicht auf jedem Schritt wieder wegklicken. Derselbe Speicher wie beim Thema. */
    function hilfeSchreiben() {
      try {
        if (UC.prefSet) UC.prefSet(UC.prefKey ? UC.prefKey(HILFE_KEY) : HILFE_KEY,
          state.hilfeAuf ? "1" : "0");
      } catch (e) {}
    }

    function renderBanner() {
      elBanner.classList.toggle("is-on", !!state.banner);
      if (state.banner) elBannerT.textContent = state.banner;
    }

    /* Gestaffelt einblenden, 120ms Vorlauf und 140ms je Marke -- dieselben Zahlen wie in
       prompt-research. Nacheinander statt gleichzeitig, damit es aussieht, als wuerde gerade
       eines nach dem anderen aufgegriffen. */
    function tlTagsEinblenden() {
      var host = root.querySelector("[data-tltags]");
      if (!host) return;
      [].forEach.call(host.children, function (el, i) {
        window.setTimeout(function () { el.classList.add("is-in"); }, 120 + i * 140);
      });
    }

    function renderPhasen() {
      var bar = root.querySelector("[data-bar]");
      if (bar) bar.style.width = state.fortschritt + "%";
      var ph = root.querySelectorAll("[data-phase]");
      for (var i = 0; i < ph.length; i++) {
        ph[i].classList.toggle("is-done", i < state.phase);
        ph[i].classList.toggle("is-now", i === state.phase);
      }
    }

    function zeigeFeldfehler() {
      var felder = root.querySelectorAll("[data-field]");
      for (var i = 0; i < felder.length; i++) {
        var n = felder[i].getAttribute("data-field");
        var t = state.fehler[n] || "";
        felder[i].classList.toggle("is-err", !!t);
        var s = felder[i].querySelector('[data-err="' + n + '"]');
        if (s) s.textContent = t;
      }
    }

    function setzeFormWerte() {
      var n = root.querySelector('[data-f="name"]');
      var w = root.querySelector('[data-f="website"]');
      if (n && n.value !== state.form.name) n.value = state.form.name;
      if (w && w.value !== state.form.website) w.value = state.form.website;
      syncBusiness();
      favZeichnen();
    }
    /* Das Favicon haengt an der NORMALISIERTEN Domain und nicht am Rohtext -- sonst laedt es
       beim Tippen von "https://www.apple.com" dreimal fuer drei Zwischenstaende. Erst ab einer
       formal gueltigen Domain wird ueberhaupt geladen; vorher steht der Globus, und der ist
       ehrlicher als ein gebrochenes Bild.
       Das img wird gebaut und nicht als Text zusammengesetzt: der Rueckfall haengt an
       img.onerror, und ein SVG in einem inline-onerror zerlegt sich am ersten doppelten
       Anfuehrungszeichen. Genau diesen Fehler hat add-brand schon einmal gehabt. */
    function favZeichnen() {
      var host = root.querySelector("[data-fav]");
      if (!host) return;
      var n = normUrl(state.form.website);
      var url = (n.domain && urlOk(n.domain)) ? favicon(n.domain) : "";
      if (host.getAttribute("data-src") === url) return;
      host.setAttribute("data-src", url);
      if (!url) { host.innerHTML = ic("globe", 1.7); return; }
      /* Der Dienst antwortet IMMER mit einem Bild -- kennt er die Domain nicht, schickt er
         seinen eigenen Weltkugel-Platzhalter. Der ist an der GROESSE zu erkennen: ein echtes
         Favicon kommt in der angeforderten Groesse (gemessen 64, bei kleineren Quellen 32),
         der Platzhalter immer mit 16, auch wenn 64 angefordert wurde. Genau daher sah er
         verpixelt aus -- 16 Pixel auf 20 hochgezogen.
         Unter 32 zeigen wir deshalb weiter unser eigenes Zeichen. Das kostet die wenigen
         Seiten, von denen der Dienst nur eine 16er-Fassung hat -- die saehe hochskaliert aber
         ohnehin schlecht aus. onerror bleibt als zweites Netz fuer echte Ausfaelle. */
      host.innerHTML = "";
      var img = document.createElement("img");
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.onerror = function () { host.innerHTML = ic("globe", 1.7); };
      img.onload = function () {
        if (img.naturalWidth && img.naturalWidth < 32) host.innerHTML = ic("globe", 1.7);
      };
      img.src = url;
      host.appendChild(img);
    }

    /* Der Switcher und das davon abhaengige Branchenfeld an einer Stelle: beide haengen am
       selben Wert, und getrennte Funktionen liefen frueher oder spaeter auseinander. */
    function syncBusiness() {
      var btns = root.querySelectorAll("[data-biz]");
      for (var i = 0; i < btns.length; i++) {
        var an = btns[i].getAttribute("data-biz") === state.form.business;
        btns[i].classList.toggle("is-active", an);
        btns[i].setAttribute("aria-selected", an ? "true" : "false");
      }
      bsegMarke();
    }
    /* Die gleitende Marke unter den aktiven Knopf legen. Gemessen statt gerechnet: die vier
       Beschriftungen sind verschieden breit, und flex verteilt den Rest -- eine Rechnung aus der
       Zahl der Knoepfe waere falsch, sobald ein Wort laenger wird. */
    function bsegMarke() {
      var ind = root.querySelector("[data-bseg-ind]");
      if (!ind) return;
      var an = root.querySelector("[data-biz].is-active");
      if (!an || !an.offsetWidth) { ind.classList.remove("is-bereit"); return; }
      ind.style.left = an.offsetLeft + "px";
      ind.style.width = an.offsetWidth + "px";
      ind.classList.add("is-bereit");
    }

    /* ---- Die vier Auswahlfelder ------------------------------------------------------------
       Alle vier teilen denselben Ausklapp-Kasten aus core. Was sie unterscheidet, sind Liste,
       Beschriftung und ob sie ein Icon tragen -- das steht hier in EINER Tabelle statt in vier
       fast gleichen Funktionen. */
    function ddDaten(kind) {
      if (kind === "market") {
        return marketList().map(function (m) {
          var flag = "https://flagcdn.com/w40/" + m.code.toLowerCase() + ".png";
          return { value: m.code, label: m.name + " " + m.code, kurz: m.name, flag: flag,
                   ic: '<img src="' + flag + '" alt="" loading="lazy" ' +
                       'referrerpolicy="no-referrer" onerror="this.remove()"/>' };
        });
      }
      if (kind === "timezone") {
        return timezoneList().map(function (z) {
          var name = z.replace(/_/g, " ");
          var v = versatz(z);
          return { value: z, label: name + (v ? " " + v : ""), kurz: name + (v ? " (" + v + ")" : ""),
                   ic: UC.icon ? UC.icon("clock", 1.8) : "" };
        });
      }
      if (kind === "business") {
        return BUSINESS.map(function (b) { return { value: b.value, label: b.label, kurz: b.label, ic: "" }; });
      }
      var eigen = state.form.industry && INDUSTRIES.indexOf(state.form.industry) < 0
        ? [{ value: state.form.industry, label: state.form.industry, kurz: state.form.industry, ic: "" }] : [];
      return eigen.concat(INDUSTRIES.map(function (s) {
        return { value: s, label: s, kurz: s, ic: "" };
      }));
    }
    var FELD_VON = { market: "market", timezone: "timezone", business: "business", industry: "industry" };

    function baueSelects() {
      var wraps = root.querySelectorAll(".uob-ddwrap");
      for (var i = 0; i < wraps.length; i++) ddFuellen(wraps[i]);
    }
    function ddFuellen(wrap) {
      var kind = wrap.getAttribute("data-dd");
      var feld = FELD_VON[kind];
      var wert = state.form[feld];
      var daten = ddDaten(kind);
      var such = txt((wrap.querySelector("[data-dd-search]") || {}).value).toLowerCase();
      var liste = wrap.querySelector("[data-dd-list]");
      var lbl = wrap.querySelector("[data-dd-label]");
      var ico = wrap.querySelector("[data-dd-icon]");
      var treffer = daten.filter(function (d) {
        return !such || d.label.toLowerCase().indexOf(such) >= 0;
      });
      liste.innerHTML = treffer.length
        ? treffer.map(function (d) {
            return '<div class="up-filter-item' + (d.value === wert ? " is-checked" : "") + '"' +
                     ' role="option" aria-selected="' + (d.value === wert ? "true" : "false") + '"' +
                     ' data-dd-val="' + esc(d.value) + '">' +
              '<span class="up-filter-check">' + (UC.icon ? UC.icon("check", 3) : "") + '</span>' +
              /* Der Markt bekommt die Zeile, die er im Rest der App auch hat: Flagge, Name,
                 rechts der Alpha-2-Code als Sekundaeres. Alles andere ist eine schlichte
                 Beschriftung. */
              (d.flag
                ? '<span class="uob-ddmain">' +
                    '<img class="uob-ddflag" src="' + esc(d.flag) + '" alt="" loading="lazy" ' +
                      'referrerpolicy="no-referrer" onerror="this.remove()"/>' +
                    '<span class="uob-ddname">' + esc(d.kurz) + '</span>' +
                  '</span>' +
                  '<span class="uob-ddcode">' + esc(d.value) + '</span>'
                : '<span class="up-filter-lbl">' + esc(d.label) + '</span>') +
            '</div>';
          }).join("")
        : '<div class="up-filter-empty">No match</div>';
      var gewaehlt = null;
      for (var i = 0; i < daten.length; i++) if (daten[i].value === wert) { gewaehlt = daten[i]; break; }
      wrap.classList.toggle("has-sel", !!gewaehlt);
      lbl.textContent = gewaehlt ? gewaehlt.kurz : (lbl.getAttribute("data-ph") || "");
      ico.innerHTML = gewaehlt ? (gewaehlt.ic || "") : "";
    }
    /* is-flat nimmt dem Kasten die Hoehe (siehe CSS, STYLEGUIDE §6 bleibt gewahrt: display wird
       nie umgeschaltet) und muss VOR dem Einblenden fallen, sonst laeuft der Uebergang auf einem
       null Pixel hohen Kasten. Das erzwungene offsetHeight dazwischen zwingt den Browser, den
       neuen Ausgangszustand zu berechnen, bevor is-shown dazukommt -- ohne die Zeile springt der
       Kasten fertig ins Bild, statt aufzugehen. */
    function ddOeffnen(wrap) {
      var m = wrap.querySelector(".uob-ddmenu");
      wrap.classList.add("is-open");
      m.classList.remove("is-flat");
      void m.offsetHeight;
      m.classList.add("is-shown");
      m.setAttribute("aria-hidden", "false");
      var b = wrap.querySelector("[data-dd-btn]");
      if (b) b.setAttribute("aria-expanded", "true");
      /* Der Kasten darf nicht unter der Kante des Scrollbereichs enden. Weder Umklappen nach oben
         noch ein Portal (beides verbietet STYLEGUIDE §6/§14) -- also bekommt er genau die Hoehe,
         die noch da ist, und seine Liste scrollt in sich.
         Warum ueberhaupt: gemessen endete das Branchenmenue 246 Pixel unter dem Scrollbereich,
         und dorthin kam man auch durch Scrollen nicht -- ein absolut gesetzter Kasten zaehlt
         nicht zur scrollbaren Hoehe seines Vorfahren (scrollHeight blieb bei 560 statt 806).
         Erst scrollen, dann messen: nach dem Scrollen ist mehr Platz da als davor. */
      ddRichtung(wrap, m);
    }
    /* Nach OBEN aufklappen, wenn unten kein Platz ist. Der Styleguide sagt in §6 "kein
       Flip-nach-oben" -- diese Ausnahme ist ausdruecklich gewuenscht, und der Grund liegt an
       dieser Seite: die Mitte ist ein Scrollbereich, und ein absolut gesetzter Kasten zaehlt
       NICHT zu ihrer scrollbaren Hoehe. Gemessen blieb scrollHeight bei 560, waehrend das
       Branchenmenue 246 Pixel tiefer endete -- dorthin kam man durch kein Scrollen. Der Versuch
       davor, dem Bereich Polster unterzuschieben, war die schlechtere Loesung: er verschob den
       Kasten waehrend des Messens mit und liess ihn oben UND unten anschneiden.
       Wer das hier spaeter "richtigstellt", nimmt die Branchenwahl wieder ausser Betrieb.

       Reihenfolge: passt es unten, bleibt es unten -- nach oben geht es nur, wenn dort mehr
       Platz ist. Und passt es weder oben noch unten ganz, wird die Liste im Kasten begrenzt,
       damit er wenigstens vollstaendig zu sehen ist. */
    function ddRichtung(wrap, menu) {
      var liste = menu.querySelector("[data-dd-list]");
      if (liste) liste.style.maxHeight = "";
      wrap.classList.remove("is-up");

      if (!elMid) return;
      var btn = wrap.querySelector("[data-dd-btn]");
      /* ZUERST das Feld selbst ins Bild holen. Ohne das wurde ueber die Richtung eines Kastens
         entschieden, dessen Feld gar nicht zu sehen war -- gemessen lag der Ausloeser bei 621,
         waehrend der sichtbare Bereich bei 548 endete. Dann ist jede Richtung falsch.
         block: "nearest" bewegt nur so weit wie noetig, und ohne weiches Scrollen: das ist eine
         Zuweisung, deren Ergebnis im naechsten Ausdruck schon stimmen muss. */
      try { btn.scrollIntoView({ block: "nearest" }); } catch (e) {}
      var grenze = elMid.getBoundingClientRect();
      var bb = btn.getBoundingClientRect();
      var LUFT = 10, ABSTAND = 6;
      var untenFrei = grenze.bottom - bb.bottom - ABSTAND - LUFT;
      var obenFrei  = bb.top - grenze.top - ABSTAND - LUFT;
      var hoch = menu.getBoundingClientRect().height;

      if (hoch > untenFrei && obenFrei > untenFrei) wrap.classList.add("is-up");
      var frei = wrap.classList.contains("is-up") ? obenFrei : untenFrei;
      if (liste && hoch > frei) {
        var neuHoch = liste.getBoundingClientRect().height - (hoch - frei);
        /* Unter 96px zeigt die Liste weniger als drei Zeilen -- dann ist der Kasten kein Kasten
           mehr. Lieber ein Stueck ueberstehen lassen als ihn zur Schlitzblende machen. */
        liste.style.maxHeight = Math.max(96, Math.round(neuHoch)) + "px";
      }
    }
    function ddSchliessen(ausser) {
      var wraps = root.querySelectorAll(".uob-ddwrap.is-open");
      for (var i = 0; i < wraps.length; i++) {
        if (wraps[i] === ausser) continue;
        wraps[i].classList.remove("is-open");
        var m = wraps[i].querySelector(".uob-ddmenu");
        if (m) {
          m.classList.remove("is-shown");
          m.setAttribute("aria-hidden", "true");
          /* Erst nach dem Ausblenden flachlegen -- sonst ist der Kasten weg, bevor er
             verblasst ist. Der Vergleich auf is-open faengt den Fall ab, dass er in der
             Zwischenzeit wieder geoeffnet wurde. */
          (function (menu, w) {
            window.setTimeout(function () {
              if (w.classList.contains("is-open")) return;
              menu.classList.add("is-flat");
              /* is-up faellt ZUSAMMEN mit is-flat, nicht vorher. Wurde es sofort abgenommen,
                 sprang der noch sichtbare Kasten waehrend des Ausblendens von oben nach unten
                 -- und blitzte fuer zwei Bildaenderungen unter dem Feld auf. */
              w.classList.remove("is-up");
            }, 220);
          })(m, wraps[i]);
        }
        var b = wraps[i].querySelector("[data-dd-btn]");
        if (b) b.setAttribute("aria-expanded", "false");
      }
    }

    /* ---- Klicks ----------------------------------------------------------------------------- */
    root.addEventListener("click", function (e) {
      if (!e.target.closest) return;

      var go = e.target.closest("[data-go]");
      if (go && elRail.contains(go)) {
        if (!go.disabled) gehe(go.getAttribute("data-go"));
        return;
      }

      var exit = e.target.closest("[data-exit]");
      if (exit) { fire("data-exit-fn", "uobExit", exit.getAttribute("data-exit")); return; }

      if (e.target.closest("[data-help-btn]")) {
        if (hilfeUhr) { window.clearTimeout(hilfeUhr); hilfeUhr = null; }
        state.hilfeVonHand = true;
        state.hilfeAuf = !state.hilfeAuf;
        hilfeSchreiben();
        renderHilfe();
        return;
      }
      if (e.target.closest("[data-help-close]")) {
        if (hilfeUhr) { window.clearTimeout(hilfeUhr); hilfeUhr = null; }
        state.hilfeVonHand = true;
        state.hilfeAuf = false;
        hilfeSchreiben();
        renderHilfe();
        return;
      }

      var tb = e.target.closest("[data-theme-btn]");
      if (tb) {
        var neu = !isDark;
        if (UC.setUpstreemTheme) UC.setUpstreemTheme(neu ? "dark" : "light");
        isDark = neu;
        syncTheme();
        /* Themenfarben haengen am Modus -- die Listen muessen also neu, nicht nur die Tokens. */
        render(true);
        return;
      }

      var ddb = e.target.closest("[data-dd-btn]");
      if (ddb) {
        var wrap = ddb.closest(".uob-ddwrap");
        var offen = wrap.classList.contains("is-open");
        ddSchliessen(offen ? null : wrap);
        if (offen) { ddSchliessen(null); return; }
        var s = wrap.querySelector("[data-dd-search]");
        if (s) s.value = "";
        ddFuellen(wrap);
        ddOeffnen(wrap);
        if (s) window.setTimeout(function () { s.focus(); }, 30);
        return;
      }
      var opt = e.target.closest("[data-dd-val]");
      if (opt) {
        var w2 = opt.closest(".uob-ddwrap");
        var kind = w2.getAttribute("data-dd");
        state.form[FELD_VON[kind]] = opt.getAttribute("data-dd-val");
        delete state.fehler[FELD_VON[kind]];
        ddFuellen(w2);
        zeigeFeldfehler();
        ddSchliessen(null);
        return;
      }
      if (!e.target.closest(".uob-ddwrap")) ddSchliessen(null);

      var auf = e.target.closest("[data-open]");
      if (auf) {
        e.stopPropagation();
        urlOeffnen(auf.getAttribute("data-open"));
        return;
      }

      var add = e.target.closest("[data-addtopic]");
      if (add) { eigenesThemaAnlegen(add); return; }
      var del = e.target.closest("[data-eigen-del]");
      if (del) { eigenesThemaLoeschen(parseInt(del.getAttribute("data-eigen-del"), 10)); return; }
      /* Ein Klick irgendwo in die Zeile eines eigenen Themas setzt den Fokus ins Feld -- die
         Zeile IST das Feld, nur ist das Feld schmaler als sie. */
      var eig = e.target.closest("[data-eigen]");
      if (eig) { var f = eig.querySelector("[data-eigen-in]"); if (f) f.focus(); return; }

      var alle = e.target.closest("[data-all]");
      if (alle) {
        gruppeUmschalten(alle.getAttribute("data-all"));
        return;
      }

      var pick = e.target.closest("[data-pick]");
      if (pick) {
        if (pick.getAttribute("aria-disabled") === "true") return;
        waehle(pick.getAttribute("data-pick"), pick.getAttribute("data-id"));
        return;
      }

      var biz = e.target.closest("[data-biz]");
      if (biz) {
        state.form.business = biz.getAttribute("data-biz");
        delete state.fehler.business;
        syncBusiness();
        zeigeFeldfehler();
        return;
      }

      var cadd = e.target.closest("[data-dd-customadd]");
      if (cadd) { eigeneBrancheNehmen(cadd.closest(".uob-ddwrap")); return; }
      var cclr = e.target.closest("[data-dd-customclear]");
      if (cclr) {
        var cf = cclr.parentNode.querySelector("input");
        if (cf) { cf.value = ""; cf.dispatchEvent(new Event("input", { bubbles: true })); cf.focus(); }
        return;
      }

      var clr = e.target.closest("[data-dd-clear]");
      if (clr) {
        var feld = clr.parentNode.querySelector("input");
        if (feld) { feld.value = ""; feld.dispatchEvent(new Event("input", { bubbles: true })); feld.focus(); }
        return;
      }

      var iv = e.target.closest("[data-interval]");
      if (iv) {
        var neuIv = iv.getAttribute("data-interval");
        if (neuIv === state.interval) return;
        state.interval = neuIv;
        /* NICHT neu zeichnen. Ein Neuaufbau setzt die Preise hart um und laesst die Karten
           springen; hier soll der Preis zaehlen und die Karte ihre Hoehe mitnehmen. */
        intervalZeichnen();
        return;
      }

      var pl = e.target.closest("[data-plan]");
      if (pl) { state.plan = pl.getAttribute("data-plan"); render(true); return; }

      if (e.target.closest("[data-skip]")) { weiter(true); return; }
      if (e.target.closest("[data-back]")) { zurueck(); return; }
      if (e.target.closest("[data-next]")) { weiter(false); return; }
    });

    /* Der Hover einer Station faerbt Punkt UND Beschriftung. Beide liegen in getrennten
       Schichten, CSS kann von der einen nicht auf die andere zeigen -- also setzt das hier die
       Klasse auf beide. Getragen wird der Hover von der Trefferflaeche, die ueber beidem liegt:
       vorher reagierte nur, was gerade unter dem Zeiger stand, und der Weg vom Punkt zum Text
       ging durch tote Zone. */
    function heiss(key, an) {
      var d = elRailDots.querySelector('[data-dot="' + key + '"]');
      var l = elRailLbls.querySelector('[data-lbl="' + key + '"]');
      if (d) d.classList.toggle("is-hot", an);
      if (l) l.classList.toggle("is-hot", an);
    }
    elRailHits.addEventListener("mouseover", function (e) {
      var h = e.target.closest ? e.target.closest("[data-go]") : null;
      if (h && !h.disabled) heiss(h.getAttribute("data-go"), true);
    });
    elRailHits.addEventListener("mouseout", function (e) {
      var h = e.target.closest ? e.target.closest("[data-go]") : null;
      if (h) heiss(h.getAttribute("data-go"), false);
    });
    elRailHits.addEventListener("focusin", function (e) {
      var h = e.target.closest ? e.target.closest("[data-go]") : null;
      if (h && !h.disabled) heiss(h.getAttribute("data-go"), true);
    });
    elRailHits.addEventListener("focusout", function (e) {
      var h = e.target.closest ? e.target.closest("[data-go]") : null;
      if (h) heiss(h.getAttribute("data-go"), false);
    });

    /* Eigene Branche uebernehmen -- ueber den Knopf oder die Eingabetaste. Beide Wege enden
       hier, damit sie nicht auseinanderlaufen. */
    function eigeneBrancheNehmen(wrap) {
      if (!wrap) return;
      var feld = wrap.querySelector("[data-dd-custom]");
      var v = txt(feld && feld.value);
      if (!v) return;
      state.form.industry = v;
      feld.value = "";
      ddFuellen(wrap);
      ddSchliessen(null);
    }
    root.addEventListener("keydown", function (e) {
      var c = e.target.closest ? e.target.closest("[data-dd-custom]") : null;
      if (c && e.key === "Enter") {
        e.preventDefault();
        eigeneBrancheNehmen(c.closest(".uob-ddwrap"));
        return;
      }
      if (e.key === "Escape") ddSchliessen(null);
    });

    root.addEventListener("input", function (e) {
      var f = e.target.getAttribute && e.target.getAttribute("data-f");
      if (f) {
        state.form[f] = e.target.value;
        /* Die Grenze meldet sich erst, wenn sie WIRKLICH erreicht ist -- maxlength haelt die
           Eingabe ohnehin an, und ein Zaehler, der bei jedem Anschlag mitzaehlt, lenkt vom
           Tippen ab. Der Fehler verschwindet von selbst, sobald wieder Platz ist. */
        if (f === "website") favZeichnen();
        if (MAX[f] && String(e.target.value).length >= MAX[f]) {
          state.fehler[f] = "Maximum of " + MAX[f] + " characters reached.";
        } else if (state.fehler[f]) {
          delete state.fehler[f];
        }
        zeigeFeldfehler();
        return;
      }
      var cu = e.target.closest ? e.target.closest("[data-dd-custom]") : null;
      if (cu) {
        var knopf = cu.closest(".uob-ddwrap").querySelector("[data-dd-customadd]");
        if (knopf) knopf.disabled = !txt(cu.value);
        var x = cu.parentNode.querySelector("[data-dd-customclear]");
        if (x) x.style.display = txt(cu.value) ? "inline-flex" : "none";
        return;
      }
      var ei = e.target.getAttribute && e.target.getAttribute("data-eigen-in");
      if (ei != null) {
        var k = parseInt(ei, 10);
        var eintrag = state.eigene[k];
        if (eintrag) {
          eintrag.name = e.target.value;
          /* Ein Thema mit Namen ist gewaehlt, eines ohne nicht -- ohne diesen Schritt zaehlte
             ein leer gelassener Platzhalter mit. */
          if (txt(eintrag.name)) state.selTopics[eintrag.id] = true;
          else delete state.selTopics[eintrag.id];
          var zeile = e.target.closest("[data-eigen]");
          var hk = zeile && zeile.querySelector(".uob-check");
          if (hk) hk.classList.toggle("is-leer", !txt(eintrag.name));
          themenZaehler();
        }
        return;
      }
      var sf = e.target.closest ? e.target.closest("[data-dd-search], [data-dd-custom]") : null;
      if (sf) {
        /* has-text tauscht in core die Lupe gegen das Loeschkreuz. */
        var wrap = sf.closest("[data-dd-searchwrap]");
        if (wrap) wrap.classList.toggle("has-text", !!String(sf.value).length);
        if (sf.getAttribute("data-dd-search") != null || sf.hasAttribute("data-dd-search")) {
          ddFuellen(sf.closest(".uob-ddwrap"));
        }
      }
    });

    /* Die Adresse wird beim Verlassen des Feldes normalisiert, nicht beim Tippen: wer mitten in
       "beispiel.de" steht, will nicht sehen, wie ihm ein https:// vor die Hand geschoben wird. */
    root.addEventListener("blur", function (e) {
      if (!e.target.getAttribute) return;
      if (e.target.getAttribute("data-f") !== "website") return;
      var n = normUrl(e.target.value);
      if (n.url) { state.form.website = n.url; e.target.value = n.url; }
    }, true);

    /* ---- Auswahl --------------------------------------------------------------------------- */
    function waehle(kind, id) {
      var topf = kind === "brands" ? state.selBrands : kind === "topics" ? state.selTopics : state.selPrompts;
      if (topf[id]) delete topf[id];
      else {
        if (kind === "brands" && anzahl(topf) >= BRAND_MAX) return;
        topf[id] = true;
      }
      /* NICHT neu zeichnen. Ein Klick aendert genau eine Zeile, und die Liste hat einen eigenen
         Scrollbereich: wer die achte Marke anklickt und dabei zurueck an den Anfang geworfen
         wird, verliert seinen Platz -- gemessen sprang der Scrollstand auf 0. Ausserdem holt ein
         neu gebautes Markup jedes Favicon erneut, was sichtbar flackert. */
      auswahlZeichnen(kind);
      if (kind === "prompts") gruppenKnoepfe();
      renderNav();
      fire("data-select-fn", "uobSelect",
        { kind: kind, ids: idsVon(topf).join(","), count: anzahl(topf) });
    }

    /* Ein neues eigenes Thema. Die Zeile wird an Ort und Stelle eingesetzt und der Platzhalter
       wandert darunter -- kein Neuaufbau der Liste, sonst verlaere jedes andere Feld seinen
       Fokus und die Liste ihren Scrollstand. Die Farbe kommt aus der Themenpalette von core,
       weitergezaehlt hinter den vorgeschlagenen, damit zwei eigene nicht dieselbe bekommen. */
    function eigenesThemaAnlegen(platzhalter) {
      if (state.eigene.length >= EIGEN_MAX) return;
      var pal = UC.TOPIC_COLOR_PALETTE || [];
      var i = state.topics.length + state.eigene.length;
      state.eigene.push({
        id: "eigen-" + i + "-" + state.eigene.length,
        name: "",
        farbe: pal.length ? pal[i % pal.length] : "#6b7280"
      });
      var idx = state.eigene.length - 1;
      var frisch = document.createElement("div");
      frisch.innerHTML = eigeneThemenHtml();
      /* Der alte Platzhalter geht, die neue Zeile und der neue Platzhalter kommen an seine
         Stelle. Ueber ein Zwischenelement, weil eigeneThemenHtml ALLE eigenen Zeilen liefert
         und nur die neuen gebraucht werden. */
      var neuZeile = frisch.querySelector('[data-eigen="' + idx + '"]');
      var neuPlatz = frisch.querySelector("[data-addtopic]");
      neuZeile.classList.add("is-fresh");
      platzhalter.parentNode.insertBefore(neuZeile, platzhalter);
      if (neuPlatz) { neuPlatz.classList.add("is-fresh"); platzhalter.parentNode.replaceChild(neuPlatz, platzhalter); }
      else platzhalter.parentNode.removeChild(platzhalter);
      window.setTimeout(function () {
        neuZeile.classList.remove("is-fresh");
        if (neuPlatz) neuPlatz.classList.remove("is-fresh");
        var f = neuZeile.querySelector("[data-eigen-in]");
        if (f) f.focus();
      }, 20);
      themenZaehler();
    }
    function eigenesThemaLoeschen(idx) {
      if (!(idx >= 0) || idx >= state.eigene.length) return;
      var id = state.eigene[idx].id;
      delete state.selTopics[id];
      state.eigene.splice(idx, 1);
      /* Hier wird neu gebaut: die Indizes aller folgenden Zeilen verschieben sich, und die von
         Hand nachzuziehen waere mehr Code als der Neuaufbau kostet. Der Fokus ist ohnehin auf
         einem Knopf, der gerade verschwindet. */
      render(true);
    }
    /* Der Zaehler zaehlt vorgeschlagene UND eigene -- ein eigenes Thema mit Namen gilt als
       gewaehlt, denn wer es tippt, will es. */
    function themenZaehler() {
      var z = root.querySelector(".uob-count");
      if (z) {
        var n = anzahl(state.selTopics);
        z.textContent = n + " selected";
        z.classList.toggle("is-full", n > 0);
      }
      renderNav();
    }

    /* Alle Prompts eines Themas auf einmal an oder aus. Ist schon alles gewaehlt, raeumt der
       Klick auf -- sonst waere der Knopf nach dem ersten Druck wirkungslos. */
    function gruppeUmschalten(gid) {
      var gruppen = promptGruppen(), g = null;
      for (var i = 0; i < gruppen.length; i++) if (gruppen[i].id === gid) { g = gruppen[i]; break; }
      if (!g) return;
      var an = !alleAn(g);
      for (var j = 0; j < g.items.length; j++) {
        var id = g.items[j].p.id;
        if (an) state.selPrompts[id] = true; else delete state.selPrompts[id];
      }
      auswahlZeichnen("prompts");
      gruppenKnoepfe();
      renderNav();
      fire("data-select-fn", "uobSelect",
        { kind: "prompts", ids: idsVon(state.selPrompts).join(","), count: anzahl(state.selPrompts) });
    }
    /* Die Beschriftungen der Gruppenknoepfe nachziehen, ohne die Liste neu zu bauen -- sonst
       ginge der Scrollstand verloren, und die Mehrspaltenaufteilung wuerde neu berechnet. */
    function gruppenKnoepfe() {
      var gruppen = promptGruppen();
      for (var i = 0; i < gruppen.length; i++) {
        var b = root.querySelector('[data-all="' + gruppen[i].id + '"]');
        if (b) b.textContent = alleAn(gruppen[i]) ? "Deselect all" : "Select all";
      }
    }

    /* Nur die Zustaende an den vorhandenen Zeilen nachziehen: Haken, Sperre, Zaehler. */
    function auswahlZeichnen(kind) {
      var topf = kind === "brands" ? state.selBrands : kind === "topics" ? state.selTopics : state.selPrompts;
      var n = anzahl(topf);
      var voll = kind === "brands" && n >= BRAND_MAX;
      var zeilen = root.querySelectorAll('[data-pick="' + kind + '"]');
      for (var i = 0; i < zeilen.length; i++) {
        var an = !!topf[zeilen[i].getAttribute("data-id")];
        zeilen[i].classList.toggle("is-on", an);
        zeilen[i].setAttribute("aria-checked", an ? "true" : "false");
        var sperr = !an && voll;
        zeilen[i].classList.toggle("is-blocked", sperr);
        if (sperr) zeilen[i].setAttribute("aria-disabled", "true");
        else zeilen[i].removeAttribute("aria-disabled");
      }
      var z = root.querySelector(".uob-count");
      if (z) {
        z.textContent = kind === "brands" ? (n + "/" + BRAND_MAX) : (n + " selected");
        z.classList.toggle("is-full", kind === "brands" ? n >= BRAND_MAX : n > 0);
      }
    }

    /* ---- Navigation ------------------------------------------------------------------------ */
    function pruefeForm() {
      state.fehler = {};
      if (!txt(state.form.name)) state.fehler.name = "Please enter your brand name.";
      var n = normUrl(state.form.website);
      if (!n.domain) state.fehler.website = "Please enter your website.";
      else if (!urlOk(n.domain)) state.fehler.website = "That does not look like a website address.";
      if (!txt(state.form.market)) state.fehler.market = "Please pick a market.";
      if (!txt(state.form.timezone)) state.fehler.timezone = "Please pick a time zone.";
      if (!txt(state.form.business)) state.fehler.business = "Please pick a business model.";
      zeigeFeldfehler();
      for (var k in state.fehler) if (state.fehler[k]) return false;
      return true;
    }

    function gehe(key, neuerEintrag) {
      /* Schon dort und nicht am Warten: nichts tun. Ohne diese Sperre navigiert ein Payload,
         der status_phase 5 traegt, ein zweites Mal nach Competitors -- der Aufruf tauscht den
         Inhalt des schon stehenden Bereichs aus, und genau das sieht man als Flackern kurz nach
         dem Einzug. Zwei Setter kurz hintereinander reichen dafuer. */
      if (state.step === key && !state.warten) return;
      state.step = key;
      state.warten = "";
      urlSetzen(key, neuerEintrag !== false);
      render();
      fire("data-step-fn", "uobStep", key);
    }

    function weiter(ueberspringen) {
      if (state.busy) return;
      if (state.step === "brand") {
        if (!pruefeForm()) return;
        /* Der Rohtext MUSS vor dem Normalisieren weg: state.form.website wird gleich mit der
           aufgeraeumten Adresse ueberschrieben, und website_input war danach byteweise dasselbe
           wie website_url -- ein Feld, das nur so aussah, als traege es die Eingabe. */
        var roheEingabe = txt(state.form.website);
        var n = normUrl(state.form.website);
        state.form.website = n.url;
        setzeFormWerte();
        state.banner = "";
        warteStarten("main");
        fire("data-start-fn", "uobStart", {
          brand_name: txt(state.form.name),
          website_input: roheEingabe,
          website_url: n.url,
          website_domain: n.domain,
          market: txt(state.form.market),
          timezone: txt(state.form.timezone),
          business_model: txt(state.form.business),
          brand_industry: txt(state.form.industry)
        });
        return;
      }
      if (state.step === "competitors") { gehe("topics"); return; }
      if (state.step === "topics") {
        if (!anzahl(state.selTopics)) return;
        /* Sind die Prompts schon da und passen sie zur AKTUELLEN Themenauswahl, geht es direkt
           weiter -- niemand will dieselbe Wartezeit zweimal absitzen, nur weil er einen Schritt
           zurueckgegangen ist. Hat sich die Auswahl geaendert, muessen neue Prompts entstehen,
           und dann gehoert die Wartezeit dazu: die alten Prompts gehoeren zu anderen Themen. */
        /* Eigene Themen gehen als NAME hinaus, nicht als Id: sie haben serverseitig noch keine.
           Der Workflow legt sie an und bekommt seine Ids beim naechsten Payload zurueck. */
        var jetztGewaehlt = idsVon(state.selTopics).sort().join(",");
        if (state.prompts.length && state.promptsFuer === jetztGewaehlt) { gehe("prompts"); return; }
        state.promptsFuer = jetztGewaehlt;
        /* Die Themenauswahl ist der Anstoss fuer die Prompts -- deshalb ein eigenes Ereignis und
           nicht nur uobStep: der Workflow dahinter tut etwas, das dauert. */
        warteStarten("prompts");
        fire("data-topics-fn", "uobTopics", {
          topic_ids: state.topics.filter(function (t) { return state.selTopics[t.id]; })
            .map(function (t) { return t.id; }).join(","),
          new_topics: state.eigene.filter(function (e2) { return txt(e2.name); })
            .map(function (e2) { return txt(e2.name); }).join(","),
          count: anzahl(state.selTopics)
        });
        return;
      }
      if (state.step === "prompts") { gehe("plan"); return; }
      if (state.step === "plan") {
        if (!state.plan) return;
        state.busy = true; renderNav();
        fire("data-finish-fn", "uobFinish", {
          plan_id: state.plan,
          billing_interval: state.interval,
          brand_ids: idsVon(state.selBrands).join(","),
          topic_ids: idsVon(state.selTopics).join(","),
          prompt_ids: idsVon(state.selPrompts).join(",")
        });
        return;
      }
      if (ueberspringen) gehe(STEPS[Math.min(stepIndex(state.step) + 1, STEPS.length - 1)].key);
    }

    function zurueck() {
      var i = stepIndex(state.step);
      if (i <= 0) return;
      gehe(STEPS[i - 1].key);
    }

    /* ---- Wartezustaende --------------------------------------------------------------------
       Die Spur laeuft weich weiter, auch wenn zwischen zwei Statusmeldungen nichts kommt: sie
       naehert sich dem Ende der laufenden Phase an und bleibt kurz davor stehen. Ein Balken, der
       zwischen zwei Meldungen einfriert, liest sich als Absturz -- die Recherche zu Ladeanzeigen
       ist da eindeutig, und vier Phasen mit je zehn Sekunden sind lang genug, dass es auffiele. */
    var tick = null, t0 = 0, hilfeUhr = null;
    function warteStarten(art) {
      state.warten = art;
      state.phase = 0;
      state.fortschritt = 0;
      render();
      t0 = new Date().getTime();
      if (tick) window.clearInterval(tick);
      tick = window.setInterval(spurTick, 240);
    }
    function warteBeenden() {
      state.warten = "";
      if (tick) { window.clearInterval(tick); tick = null; }
    }
    function spurTick() {
      var ziel, unten;
      if (state.warten === "prompts") { unten = 0; ziel = 96; }
      else {
        /* Je Phase ein Viertel der Spur. Die laufende Phase fuellt ihr Viertel nur zu vier
           Fuenfteln -- der Rest springt, wenn die Phase wirklich fertig ist. */
        unten = (state.phase / PHASES.length) * 100;
        ziel = unten + (100 / PHASES.length) * 0.8;
      }
      var v = new Date().getTime() - t0;
      /* Vorne ziehen, hinten nachlassen: 1 - e^(-t/tau). Genau die Kurve, die Ladebalken
         schneller wirken laesst, als sie sind. */
      /* 2600 statt 4200: bei fuenf Sekunden je Phase war die alte Zeitkonstante so traege, dass
         der Balken innerhalb einer Phase kaum vom Fleck kam. Der Wert ist auf das Ergebnis
         kalibriert, nicht gerechnet. */
      var anteil = 1 - Math.exp(-v / 2600);
      var w = unten + (ziel - unten) * anteil;
      if (w > state.fortschritt) { state.fortschritt = w; renderPhasen(); }
    }
    function phaseSetzen(i) {
      var neu = Math.max(0, Math.min(PHASES.length, i));
      if (neu === state.phase) return;
      state.phase = neu;
      state.fortschritt = Math.max(state.fortschritt, (neu / PHASES.length) * 100);
      t0 = new Date().getTime();
      renderPhasen();
    }

    /* ---- Breite ------------------------------------------------------------------------------
       Zwei Stufen: unter 760px stapelt alles, unter 460px wird es noch enger. Gemessen an der
       Wurzel und nicht am Fenster, weil diese Seite in Bubble in einem Element steckt. */
    /* Die Kopfzeile darf NIE ueber den Rand hinauslaufen. Gemessen mit einem 132px breiten
       Logo: bei 480px Fensterbreite standen die Ausgaenge 21px ausserhalb des Bildschirms, bei
       380px 121px -- der Themenknopf war ganz draussen und die Seite scrollte seitwaerts.
       Reicht der Platz nicht, fallen die Beschriftungen weg und die Icons bleiben. Das ist die
       einzige Stelle, die nachgibt, bevor Inhalt den Schirm verlaesst -- lieber die 32px zum
       Rand halten und ein Wort weniger zeigen als einen Knopf, den niemand erreicht.
       Gemessen wird im SICHTBAREN Zustand: mit display:none haben die Beschriftungen Breite 0,
       dann passt es, dann kommen sie zurueck, dann passt es nicht. Dieselbe Schaukel wie bei
       den Schienenbeschriftungen, und derselbe Ausweg. */
    function kopfPruefen() {
      var top = root.querySelector(".uob-top");
      var logo = root.querySelector(".uob-logo");
      var rechts = root.querySelector(".uob-topr");
      if (!top || !logo || !rechts) return;
      root.classList.remove("is-tight");
      var st = window.getComputedStyle(top);
      var platz = top.clientWidth - (parseFloat(st.paddingLeft) || 0) - (parseFloat(st.paddingRight) || 0);
      var lueckeRoh = parseFloat(st.columnGap || st.gap);
      var luecke = isFinite(lueckeRoh) ? lueckeRoh : 16;
      var noetig = logo.offsetWidth + rechts.offsetWidth + luecke;
      if (noetig > platz) root.classList.add("is-tight");
    }
    function messeBreite() {
      var w = root.clientWidth;
      root.classList.toggle("is-narrow", w < 760);
      root.classList.toggle("is-vnarrow", w < 460);
      /* Die Beschriftungen der Schiene haengen an der Breite und nicht am Zustand -- ohne diese
         Zeile wurde nur beim Zeichnen geprueft, und ein blosses Ziehen am Fensterrand liess eine
         Reihe stehen, die laengst nicht mehr passte. */
      labelsPruefen(sichtbareSteps().length);
      kopfPruefen();
      /* Die Marke haengt an Pixelmassen, die sich mit der Breite aendern. */
      bsegMarke();
    }
    messeBreite();
    if (UC.onResize) UC.onResize(root, messeBreite);
    else window.addEventListener("resize", messeBreite);
    /* Nachmessen, sobald das Logo da ist. In Bubble ist es eine URL und liegt beim ersten Messen
       noch nicht vor -- dann ist es 0 breit, alles passt, und wenn es ankommt, misst niemand
       nach. Genau so standen die Ausgaenge auf der echten Seite ausserhalb des Bildes, und zwar
       bei JEDER Fensterbreite gleich weit: der Ueberhang ist die Logobreite und haengt nicht am
       Fenster. Gemessen: Logo nach dem Start von 132 auf 360 gesetzt, is-tight blieb aus, die
       Knoepfe standen 109px draussen.
       error zaehlt mit: schlaegt die Adresse fehl, ersetzt der onerror-Griff das Bild durch ein
       leeres Element, und die Breite aendert sich ein zweites Mal.
       Die Schrift ebenso -- laedt sie spaet, sind die Beschriftungen breiter als beim ersten
       Messen. Beides kostet nichts und schliesst die ganze Klasse. */
    var logoEl = root.querySelector(".uob-logo");
    if (logoEl && logoEl.tagName === "IMG") {
      logoEl.addEventListener("load", kopfPruefen);
      logoEl.addEventListener("error", function () { window.setTimeout(kopfPruefen, 0); });
    }
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(kopfPruefen); } catch (e) {}

    /* ---- Zurueck-Taste des Browsers ---------------------------------------------------------- */
    window.addEventListener("popstate", function () {
      var k = stepAusUrl();
      if (k && k !== state.step) { state.step = k; state.warten = ""; render(); }
    });

    /* EIN Leseweg fuer alles, was aus Bubble kommt -- dieselbe geteilte Reparatur wie in jeder
       Tabelle dieses Repos. UC.parseBubbleJson kennt die Faelle, die wirklich auftreten: ein
       unescaptes " mitten in einem Namen, rohe Zeilenumbrueche, nacktes yes/no. parseLoose war
       hier ein zweiter Weg, und genau an so einem zweiten Weg ist Top Citations gestorben --
       ein Markenname mit Anfuehrungszeichen reicht, und die ganze Liste ist still weg.
       Markennamen, Themennamen und die Zusammenfassung kommen vom Crawler; dort ist ein
       Anfuehrungszeichen keine Ausnahme, sondern Alltag.
       Objekte gehen unveraendert durch: parseBubbleJson liest TEXT, ein Objekt wuerde es zu
       "[object Object]" verstringen. JSON.parse als Rueckfall, falls das geladene core.js
       aelter ist als parseBubbleJson -- sonst nimmt ein alter Pin die ganze Seite mit. */
    function lies(payload) {
      if (payload && typeof payload === "object") return payload;
      var t = txt(payload);
      if (!t) return null;
      /* Doppelt verpackt: ein Run-JS-Step, der JSON.stringify UM einen Payload legt, der schon
         Text ist. Das Ergebnis ist ein String, dessen erstes Zeichen ein Anfuehrungszeichen ist
         und der escapte Anfuehrungszeichen enthaelt. parseBubbleJson liest das als leere Liste --
         gemessen: array:0, Payload still weg. parseLoose packte es aus, und diese eine Faehigkeit
         darf beim Wechsel auf den geteilten Leseweg nicht verlorengehen. Nur bei genau diesem
         Muster, damit ein Textwert nicht zerlegt wird. */
      if (t.charAt(0) === '"' && t.charAt(t.length - 1) === '"' && t.indexOf('\\"') >= 0) {
        try {
          var innen = JSON.parse(t);
          if (typeof innen === "string" && /^\s*[\[{]/.test(innen)) t = txt(innen);
        } catch (e) {}
      }
      var a = null;
      try { if (UC.parseBubbleJson) a = UC.parseBubbleJson(t); } catch (e) {}
      if (!isArr(a)) { try { a = JSON.parse(t); } catch (e) { a = null; } }
      /* Leer und unlesbar sind zwei Dinge (§46): parseBubbleJson gibt fuer beides [] zurueck.
         Eine WIRKLICH leere Lieferung ist am leeren Klammerpaar zu erkennen -- alles andere,
         das nichts ergibt, ist ein Lesefehler und muss als Fehler zurueck. Sonst sieht ein
         kaputter Payload aus wie "es gibt hier nichts", und der Nutzer sucht an der falschen
         Stelle. Gemessen: "das ist kein json" lieferte eine leere Liste ohne jede Meldung. */
      if (isArr(a) && !a.length && !/^\[\s*\]$/.test(t)) return null;
      return a;
    }
    /* Ein Fehler aus dem Hintergrundlauf. Die RPC traegt ihn ohnehin mit (status, last_error) --
       bisher hat die Komponente beide gelesen und weggeworfen, und ein abgebrochener Lauf sah
       aus wie ein Lauf, der gleich fertig ist: die Uhr drehte weiter, ohne Ende. */
    function fehlerAus(p) {
      if (!p || typeof p !== "object") return "";
      var st = txt(p.status).toLowerCase();
      var le = txt(p.last_error);
      if (le) return le;
      if (st === "error" || st === "failed") return "Something went wrong while setting up your workspace. Please try again.";
      return "";
    }

    /* ---- Aussenschnittstelle ------------------------------------------------------------------ */
    var ctrl = {
      instanceId: instanceId,
      setProject: function (payload) {
        var p = lies(payload);
        if (isArr(p)) p = p[0];
        if (!p || typeof p !== "object") {
          state.banner = "We could not read the project data. Please try again.";
          warteBeenden(); render(); return true;
        }
        state.projekt = p;
        /* Was der Server schon weiss, gewinnt ueber das, was im Formular steht: nach einem
           Neuladen ist das Formular leer, das Projekt aber vollstaendig. */
        if (txt(p.company_name)) state.form.name = txt(p.company_name);
        if (txt(p.website_url)) state.form.website = txt(p.website_url);
        if (txt(p.market)) state.form.market = txt(p.market);
        if (txt(p.business_model)) state.form.business = txt(p.business_model);
        if (txt(p.brand_industry)) state.form.industry = txt(p.brand_industry);
        /* Fehler VOR der Phase: ein abgebrochener Lauf schickt oft trotzdem eine status_phase,
           und die wuerde die Uhr weiterdrehen lassen. */
        var fehl1 = fehlerAus(p);
        if (fehl1) { state.banner = fehl1; warteBeenden(); state.busy = false; render(); return true; }
        var ph = num(p.status_phase);
        if (ph != null) {
          /* status_phase 5 heisst fertig, 1..4 sind die laufenden. Der Index ist eins kleiner. */
          if (ph >= 5) { warteBeenden(); if (state.step === "brand") { gehe("competitors", false); return true; } }
          else if (state.warten === "main") phaseSetzen(Math.max(0, ph - 1));
        }
        render();
        return true;
      },
      setStatus: function (payload) {
        var p = lies(payload);
        if (isArr(p)) p = p[0];
        /* Eine nackte Zahl ist eindeutig -- sie kann nur die Phase sein. Vorher hat
           setOnboardingStatus("...", "3") NICHTS getan und auch nichts gesagt: kein Fehler,
           keine Meldung, die Uhr lief einfach weiter. Das ist der naheliegendste Griff, weil
           der Parameter "Status" heisst und in der RPC eine Zahl ist. Gemessen: 0 Phasen
           fertig mit "3", 2 mit {"status_phase": 3}. */
        if ((!p || typeof p !== "object") && txt(payload) !== "" && num(payload) != null) {
          p = { status_phase: num(payload) };
        }
        if (!p || typeof p !== "object") return false;
        /* Vor der Phase, und ohne status_phase gueltig: {"status":"error","last_error":"..."}
           allein muss reichen, um die Uhr zu beenden. */
        var fehl2 = fehlerAus(p);
        if (fehl2) { state.banner = fehl2; warteBeenden(); state.busy = false; render(); return true; }
        var ph = num(p.status_phase);
        if (ph == null) return false;
        if (ph >= 5) {
          state.fortschritt = 100; renderPhasen();
          window.setTimeout(function () {
            warteBeenden();
            gehe(state.step === "brand" ? "competitors" : "prompts", false);
          }, 360);
          return true;
        }
        phaseSetzen(Math.max(0, ph - 1));
        return true;
      },
      setBrands: function (payload) { return listeSetzen(payload, "brands"); },
      setTopics: function (payload) { return listeSetzen(payload, "topics"); },
      setPrompts: function (payload) { return listeSetzen(payload, "prompts"); },
      setPlans: function (payload) {
        var p = lies(payload);
        if (!isArr(p)) { state.banner = "We could not read the plans."; render(); return true; }
        state.plans = p.slice().sort(function (a, b) {
          var sa = num(a.sort_order), sb = num(b.sort_order);
          if (sa != null && sb != null && sa !== sb) return sa - sb;
          /* Ohne sort_order nach Preis -- das ist die Reihenfolge, in der ein Nutzer Tarife
             erwartet, und sie ist stabil, solange die Preise verschieden sind. */
          return (num(a.monthly_price_eur) || 0) - (num(b.monthly_price_eur) || 0);
        });
        render(true);
        return true;
      },
      /* Startet den grossen Hintergrundlauf. NICHT Teil des uobStart-Ablaufs: die beiden Werte
         entstehen erst im Workflow hinter uobStart, und dort laesst sich kein zweiter Ereignis-
         aufruf anhaengen. Deshalb ein eigener Weg, den ein Run-JS-Schritt ruft, sobald er sie hat.
         Beide Werte sind Pflicht -- ein Lauf ohne Token startet nichts, und ein leeres Feld im
         Payload waere genau der stille Ausfall, den es hier nicht geben darf.
         Der Platzhaltertest ist derselbe wie in attr(): bleibt ONBOARDING_ID in der Vorlage
         stehen, weil der Bubble-Ausdruck fehlt, wird daraus kein Lauf mit dem Namen des
         Platzhalters. Echte Werte fallen nicht darunter -- eine UUID hat Ziffern und Striche. */
      startWorkflow: function (onboardingId, runToken) {
        var oid = txt(onboardingId), tok = txt(runToken);
        var offen = !oid ? "onboarding_id"
                  : !tok ? "run_token"
                  : /^[A-Z_]{3,}$/.test(oid) ? "onboarding_id (Platzhalter nicht ersetzt)"
                  : /^[A-Z_]{3,}$/.test(tok) ? "run_token (Platzhalter nicht ersetzt)" : "";
        if (offen) {
          if (window.console) console.warn("[onboarding] startOnboardingWorkflow: " + offen +
            " fehlt -- uobWorkflowStart wird NICHT gesendet.");
          return false;
        }
        fire("data-workflow-fn", "uobWorkflowStart", { onboarding_id: oid, run_token: tok });
        return true;
      },
      setStep: function (k) {
        if (stepIndex(txt(k)) < 0) return false;
        gehe(txt(k), false);
        return true;
      },
      setError: function (text) { state.banner = txt(text); warteBeenden(); state.busy = false; render(); return true; },
      setLoading: function (on) { state.busy = istJa(on); renderNav(); return true; },
      reset: function () {
        warteBeenden();
        state.step = "brand"; state.projekt = null;
        state.brands = []; state.topics = []; state.prompts = [];
        state.selBrands = {}; state.selTopics = {}; state.selPrompts = {}; state.eigene = [];
        state.plan = ""; state.banner = ""; state.busy = false;
        state.fehler = {}; state.maxErreicht = 0; state.planGesehen = false;
        state.promptsFuer = null;
        railStand = "";
        state.form = { name: "", website: "", market: eigenerMarkt(), timezone: eigeneZone(),
                       business: BUSINESS_STD, industry: "" };
        letzteAnsicht = "";
        elStack.innerHTML = "";
        urlSetzen("brand", false);
        render();
        return true;
      }
    };

    function listeSetzen(payload, welche) {
      var p = lies(payload);
      if (!isArr(p)) {
        state.banner = "We could not read the " + welche + ".";
        render(); return true;
      }
      var rein = [];
      for (var i = 0; i < p.length; i++) {
        var r = p[i]; if (!r || typeof r !== "object") continue;
        var id = txt(r.id) || (welche + "-" + i);
        if (welche === "brands") {
          rein.push({ id: id, name: txt(r.name), domain: txt(r.domain), url: txt(r.url),
                      favicon_url: txt(r.favicon_url) });
        } else if (welche === "topics") {
          rein.push({ id: id, name: txt(r.name), description: txt(r.description),
                      hex_light: txt(r.hex_light), hex_dark: txt(r.hex_dark) });
        } else {
          var tids = isArr(r.topic_ids) ? r.topic_ids
                   : (txt(r.topic_ids) ? txt(r.topic_ids).split(",").map(function (s) { return s.trim(); })
                                       : []);
          rein.push({ id: id, prompt_text: txt(r.prompt_text), market: txt(r.market), topic_ids: tids });
        }
        /* Eine schon gesetzte Auswahl aus den Daten uebernehmen -- so ueberlebt sie ein
           Neuladen, wenn der Server sie kennt. */
        /* istJa statt eines Vergleichs auf "yes": Bubble schickt je nach Feldtyp und Formatierung
           yes, true, 1 oder den nackten Wahrheitswert -- und ein "true" als Text fiel bisher
           durch, ohne dass irgendwo etwas davon stand. Der geteilte Helfer aus core kennt alle
           vier Schreibweisen; ein echter Boolean geht ohnehin voran. */
        if (r.selected === true || istJa(r.selected)) {
          (welche === "brands" ? state.selBrands : welche === "topics" ? state.selTopics : state.selPrompts)[id] = true;
        }
      }
      state[welche] = rein;
      /* Ankommende Prompts gehoeren zur Auswahl, die sie angefordert hat. Ohne diese Zeile
         waere promptsFuer nach einem Setter von aussen leer, und der naechste Weiter-Klick
         liefe unnoetig noch einmal durch die Wartezeit. */
      if (welche === "prompts") state.promptsFuer = idsVon(state.selTopics).sort().join(",");
      /* Waehrend einer Uhr NICHT zeichnen. Die Daten fuer den naechsten Schritt kommen an,
         waehrend das Ladebild laeuft -- ein Neuaufbau baut dann das Ladebild neu, mitten in der
         Animation seiner letzten Phase, und genau das sah man kurz zucken. Gezeichnet wird, wenn
         die Uhr endet und gehe() den neuen Schritt aufbaut. */
      if (!state.warten) render(true);
      return true;
    }

    root.__uobController = ctrl;

    /* ---- Start ------------------------------------------------------------------------------- */
    state.form.market = eigenerMarkt();
    state.form.timezone = eigeneZone();
    state.form.business = BUSINESS_STD;
    var ausUrl = stepAusUrl();
    if (ausUrl) state.step = ausUrl; else urlSetzen("brand", false);

    if (UC.onTheme) UC.onTheme(syncTheme, root);
    syncTheme();

    root.classList.add("is-entering");
    render(true);
    window.setTimeout(function () { root.classList.remove("is-entering"); }, 900);

    /* Der Guide meldet sich nach fuenf Sekunden von selbst -- lange genug, dass die Seite
       angekommen ist und der Blick auf dem Formular war, kurz genug, dass er noch zum ersten
       Schritt gehoert. Nur beim ERSTEN Mal: wer ihn schon einmal zugemacht hat, bekommt ihn
       nicht wieder aufgedraengt (hilfeGelesen liest denselben Speicher).
       Ein Klick auf den Knopf davor bricht die Uhr ab, sonst spraenge die Tafel gleich nach dem
       Zumachen wieder auf. */
    if (state.hilfeAuf) {
      state.hilfeAuf = false;
      renderHilfe();
      hilfeUhr = window.setTimeout(function () {
        hilfeUhr = null;
        if (state.hilfeVonHand) return;
        if (!hilfePasst()) {
          /* Kein Platz: die Tafel bleibt zu. Nicht aufgedraengt heisst aber nicht versteckt --
             der erste Render hat den Schritt schon als "gesehen" markiert, weil die Tafel gleich
             von selbst aufgehen sollte. Diese Marke muss weg, sonst steht kein Punkt am Knopf
             und der Guide ist auf schmalen Schirmen unauffindbar: kein Kasten, kein Zeichen.
             Gemessen: display none am Punkt, obwohl der Nutzer nie etwas gesehen hatte. */
          var k = hilfeSchluessel();
          if (k) delete state.hilfeGesehen[k];
          renderHilfe();
          return;
        }
        state.hilfeAuf = true;
        renderHilfe();
      }, 5000);
    }

    return ctrl;
  }

  /* ==========================================================================================
     Montage und globale Funktionen
     ========================================================================================== */
  var CONTROLLERS = [];
  function initRootNow(root) {
    if (root.__uobController) return root.__uobController;
    var c = makeController(root);
    CONTROLLERS.push(c);
    return c;
  }
  function initAll() {
    var roots = document.querySelectorAll(".uob-root");
    for (var i = 0; i < roots.length; i++) initRootNow(roots[i]);
  }
  function resolve(id) {
    var wunsch = String(id == null ? "" : id).trim();
    for (var i = 0; i < CONTROLLERS.length; i++) {
      if (!wunsch || CONTROLLERS[i].instanceId === wunsch) return CONTROLLERS[i];
    }
    return CONTROLLERS.length === 1 ? CONTROLLERS[0] : null;
  }

  function uobRun() {
    UC = window.UpstreemCore;
    initAll();
    if (UC.watchRoots) UC.watchRoots("uob-root", initAll);

    function ruf(name, fn) {
      window[name] = fn;
    }
    ruf("setOnboardingProject", function (id, p) { var c = resolve(id); return c ? c.setProject(p) : false; });
    ruf("setOnboardingStatus",  function (id, p) { var c = resolve(id); return c ? c.setStatus(p) : false; });
    ruf("setOnboardingBrands",  function (id, p) { var c = resolve(id); return c ? c.setBrands(p) : false; });
    ruf("setOnboardingTopics",  function (id, p) { var c = resolve(id); return c ? c.setTopics(p) : false; });
    ruf("setOnboardingPrompts", function (id, p) { var c = resolve(id); return c ? c.setPrompts(p) : false; });
    ruf("setOnboardingPlans",   function (id, p) { var c = resolve(id); return c ? c.setPlans(p) : false; });
    ruf("setOnboardingStep",    function (id, k) { var c = resolve(id); return c ? c.setStep(k) : false; });
    ruf("setOnboardingError",   function (id, t) { var c = resolve(id); return c ? c.setError(t) : false; });
    ruf("setOnboardingLoading", function (id, v) { var c = resolve(id); return c ? c.setLoading(v) : false; });
    ruf("resetOnboarding",      function (id)    { var c = resolve(id); return c ? c.reset() : false; });
    ruf("startOnboardingWorkflow", function (id, oid, tok) {
      var c = resolve(id); return c ? c.startWorkflow(oid, tok) : false;
    });

    /* Alles nachholen, was gerufen wurde, bevor es die Seite gab. */
    var q = BOOTQ.splice(0, BOOTQ.length);
    for (var i = 0; i < q.length; i++) {
      try { window[q[i][0]].apply(null, q[i][1]); } catch (e) {
        if (window.console) console.warn("[onboarding-page] nachgeholter Aufruf " + q[i][0] + " schlug fehl:", e);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { uobBoot(80); });
  } else {
    uobBoot(80);
  }
})();
