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
                  business_model}
                 brand_industry ist am 24.08. ENTFALLEN -- das Feld ist aus dem Formular raus und
                 der Schluessel geht nicht mehr mit. Steht er im Bubble-Workflow noch als
                 Parameter, bleibt er leer; er gehoert dort entfernt.
     uobStep     der Schluessel des Schritts, roh
     uobSelect   {kind, ids: "a,b,c", count, changed, changed_ids, on,
                  ids_json: ["a","b"], changed_ids_json: ["a"]}
                  ids/changed_ids sind Kommatexte, die *_json dieselben Ids als echtes Array --
                  die Form, die die RPCs als p_ids nehmen. Leer ist dort [] und nicht [""].
     uobTopics   die Themenauswahl beim Verlassen von Schritt 3 -- das ist der Anstoss, aus dem
                 die Prompts entstehen
     uobFinish   {plan_id, billing_interval, brand_ids, topic_ids, prompt_ids}
     uobExit     "dashboard" oder "logout"
     uobWorkflowStart  {onboarding_id, run_token} -- NICHT aus dem Ablauf heraus, sondern von
                 window.startOnboardingWorkflow(instanz, onboarding_id, run_token). Damit laesst
                 sich der grosse Hintergrundlauf aus einem Run-JS-Schritt anstossen, wenn beide
                 Werte im Workflow hinter uobStart entstanden sind.

   Setter: setOnboardingBundle (die ganze RPC-Antwort beim Seitenaufbau -- entscheidet zugleich,
   welchen Schritt der Nutzer sieht), setOnboardingProject, setOnboardingStatus, setOnboardingBrands, setOnboardingTopics,
   setOnboardingPrompts, setOnboardingPlans, setOnboardingStep, setOnboardingError,
   setOnboardingLoading, resetOnboarding. */
(function () {
  "use strict";

  /* Frueher Aufruf, bevor core oder diese Datei da sind: einsammeln statt verlieren. Dieselbe
     Mechanik wie in auth-page.js und in jeder Komponente mit makeLate. */
  var BOOTQ = window.__uobBootQueue = window.__uobBootQueue || [];
  if (!window.__uobBootStubbed) {
    window.__uobBootStubbed = true;
    ["setOnboardingBundle", "setOnboardingProject", "setOnboardingStatus", "setOnboardingBrands",
     "setOnboardingTopics", "setOnboardingPrompts", "setOnboardingPlans", "setOnboardingStep",
     "setOnboardingError", "setOnboardingLoading", "resetOnboarding",
     "startOnboardingWorkflow"].forEach(function (n) {
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
      /* Der Hilfe-Abschnitt am Ende jeder Tafel. Er steht bei JEDEM Schritt gleich da: wer
         haengt, haengt nicht schrittweise. */
      hilfe: {
        h: "Need help?",
        t: "Pick a slot of up to 30 minutes and we will walk through your setup together.",
        cta: "Book a call"
      },
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
      hilfe: {
        h: "Brauchst du Hilfe?",
        t: "Nimm dir bis zu 30 Minuten und wir gehen dein Setup gemeinsam durch.",
        cta: "Termin buchen"
      },
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
  var MAX = { name: 60, website: 255, topic: 40 };
  /* Fuenf eigene Themen. Die Grenze steht in der Aufgabe -- und sie ist auch sachlich richtig:
     wer im Onboarding zehn Themen tippt, hat danach zehn Themen ohne Prompts. */
  var EIGEN_MAX = 5;

  /* Dieselbe Liste wie im Bereich "Your Brand" (settings-brand.js). Sie steht hier ein zweites
     Mal und nicht in core, weil sie in beiden Faellen eine INHALTSliste ist und kein Bauteil --
     core traegt Geometrie und Verhalten, keine Branchennamen. Wer sie aendert, aendert sie an
     beiden Stellen; ein Payload mit industries uebersteuert sie ohnehin. */

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
  /* Der Globus als Rueckfall statt des Anfangsbuchstabens. Er kommt aus core (Feather/Lucide) und
     traegt die Primaerfarbe -- so angefordert am 24.08.
     Warum ein onload und nicht nur onerror: der Google-Dienst antwortet fuer eine unbekannte
     Domain NICHT mit einem Fehler, sondern mit seinem eigenen, generischen Globus -- und der ist
     immer 16px gross. Auf einer 26px-Kachel sieht das aus wie ein Bildfehler, und genau so wurde
     es gemeldet ("sehr verpixeltes default favicon"). onerror feuert dabei nie, weil das Bild ja
     erfolgreich laedt.
     Gemessen an sieben Domains: echte Favicons kommen bei sz=64 als 32 oder 64px zurueck, der
     Ausweich-Globus immer als 16px. Die Schwelle ist damit gemessen und nicht geraten. */
  /* Erst beim ersten Gebrauch holen und dann merken: hier oben ist UC noch NICHT im Scope (die
     Zuweisung steht in initRoot), und window.UpstreemCore kann beim Auswerten dieser Datei noch
     fehlen -- der Bootlauf wartet ja gerade darauf. */
  var globusCache = null;
  function globus() {
    if (globusCache === null) {
      var C = window.UpstreemCore;
      globusCache = (C && C.icon) ? C.icon("globe", 1.8) : "";
    }
    return globusCache;
  }
  function kachelInhalt(name, favUrl) {
    return '<span class="uob-kachel-globus">' + globus() + '</span>' +
      /* KEIN loading="lazy": die Kachel steht ganz oben im Bild, das Bild ist 26px gross, und
         lazy verzoegert es nur. Vor allem aber haengt die 16px-Erkennung unten am load-Ereignis --
         und ein verzoegertes Bild feuert es spaet oder (in einem nicht gerenderten Rahmen) gar
         nicht. Gemessen: naturalWidth 16, aber complete false und onload nie gelaufen. */
      (favUrl ? '<img src="' + esc(favUrl) + '" alt="" referrerpolicy="no-referrer"' +
                ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"' +
                ' onload="if(this.naturalWidth&&this.naturalWidth&lt;=16){' +
                  'this.parentNode.classList.remove(\'has-img\'); this.remove();}"/>' : "");
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

    /* Die Adresse EINMAL lesen, jetzt -- bevor irgendein gehe() sie anfasst. gehe() schreibt den
       Schritt naemlich hinein, und der Aufbau ruft es (mit "brand"), bevor das Buendel da ist.
       Ohne diese Momentaufnahme liest zielSchritt() spaeter genau das, was die Komponente selbst
       gerade geschrieben hat, und landet immer auf brand -- gemessen, und zwar erst NACHDEM der
       Fix schon geschrieben war. Was hier steht, ist der Schritt, auf dem der Nutzer die Seite
       verlassen hat. */
    var schrittBeimAufbau = stepAusUrl();

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
        name: "", website: "", market: "", timezone: "", business: BUSINESS_STD
      },
      fehler: {},               /* feldname -> text */
      banner: "",
      /* Beim Aufbau weiss die Komponente noch NICHT, ob es schon ein Projekt gibt -- die Antwort
         kommt erst mit dem ersten Setter, und bis dahin vergehen ein paar hundert Millisekunden
         bis eine Sekunde. Faengt sie in dieser Zeit mit dem Formular an, sieht jeder mit einem
         laufenden Onboarding kurz das Formular aufblitzen, bevor es zu seinem Schritt springt --
         genau so gemeldet am 24.08. Also startet sie in einem neutralen Ladezustand und zeigt
         erst dann etwas, wenn sie weiss, WAS sie zeigen soll.
         BOOT_MAX_MS ist die Notbremse: bleibt der Setter ganz aus (alte Verdrahtung), darf die
         Seite nicht ewig im Skelett stehen -- dann gilt "kein Projekt" und das Formular kommt. */
      hochfahren: true,
      projekt: null,            /* das Onboarding-Projekt, sobald es da ist */
      brands: [], topics: [], prompts: [], plans: [],
      selBrands: {}, selTopics: {}, selPrompts: {},
      /* Selbst getippte Themen: [{ id, name, farbe }]. Sie liegen NEBEN state.topics und nicht
         darin -- topics kommt vom Server und wird bei jedem Payload ersetzt, diese hier gehoeren
         dem Nutzer und duerfen dabei nicht verschwinden. */
      eigene: [],
      plan: "", interval: "yearly",
      /* Drei Zustaende am Tarifschritt, nicht zwei: noch keine Antwort (Skelett), Antwort mit
         nichts drin ("keine Tarife"), Antwort unlesbar oder ausgeblieben (Lesefehler). Ohne
         plansGeholt sahen die ersten beiden gleich aus, und "No plans available right now" waehrend
         eines laufenden Abrufs ist eine falsche Aussage, keine Wartemeldung. */
      plansGeholt: false, plansFehler: false,
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
      /* Die Neustart-Regel, wie sie die RPC im Buendel mitschickt (restart). Die Komponente
         RECHNET nichts davon nach: wie oft jemand neu starten darf, entscheidet die Datenbank,
         und zwei Rechnungen daneben waeren zwei Wahrheiten. Hier wird nur angezeigt, was sie
         sagt, und der Knopf gesperrt, wenn sie nein sagt. */
      restart: null,
      /* Kommt der Nutzer ueber "Start over" ins Formular? Dann sagt der Vorspann dort, was das
         Abschicken kostet -- an der Stelle, an der er ohnehin liest, und nicht als Fehlerkasten. */
      neuStart: false,
      /* Steht das Tor offen? Es kommt vor den ersten Schritt, wenn schon ein Onboarding
         existiert: fortsetzen oder von vorn. */
      torAuf: false,
      busy: false
    };
    var BRAND_MAX = 5;
    /* Das Tor wird vom ERSTEN Buendel dieser Seitenansicht entschieden, danach nie wieder. Ein
       Buendel kommt auch spaeter noch -- jeder aendernde Workflow schickt am Ende eine frische
       Antwort --, und oeffnete das erneut das Tor, floege der Nutzer mitten aus seinem Schritt.
       Bewusst KEINE Abfrage auf den Bootzustand: der endet nach sechs Sekunden von selbst, und
       auf der echten Seite vergehen bis zur Antwort der RPC schon mal neun. */
    var torGeprueft = false;
    /* Ist der Neustart-Knopf scharf? Der erste Klick zeigt den Hinweis, der zweite fuehrt aus.
       Ein Zwischenschritt und kein Fenster: der Nutzer bleibt, wo er ist, und die Bestaetigung
       steht an derselben Stelle wie der Knopf, den er gedrueckt hat. */
    var overScharf = false;
    /* Hat der Nutzer schon etwas angefasst? Das Tor darf ihn nie aus laufender Arbeit reissen.
       Diese Marke ist das ehrlichere Kriterium als eine Uhr: sie sagt, ob ueberhaupt schon jemand
       gehandelt hat, und nicht, ob eine willkuerliche Zahl von Sekunden vergangen ist. */
    var angefasst = false;

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

    function kopf(h1, sub, zaehler, aktion) {
      return '<div class="uob-head">' +
        (zaehler != null
          ? '<div class="uob-h1row"><h1 class="uob-h1">' + esc(h1) + '</h1>' +
            /* Knopf und Zaehler stehen als PAAR rechts, der Zaehler ganz aussen und der Knopf
               8px links davon. Dafuer ein eigener Behaelter: .uob-h1row haelt 16px Abstand, und
               der gilt fuer alle Kinder gleich -- ohne Gruppierung staenden die beiden ebenfalls
               16px auseinander UND der Knopf ganz aussen. Genau das war schief.
               Dieselbe Bauart wie der Knopf ueber jeder Prompt-Gruppe (.uob-group-all): ein
               UMSCHALTER, kein reines Hinzufuegen -- wer versehentlich alles waehlt, muesste es
               sonst einzeln wieder abwaehlen. Und die Beschriftung sagt, was der Klick TUT. */
            '<span class="uob-h1side">' +
              (aktion ? '<button class="uob-group-all uob-head-all" type="button" data-allof="' +
                          esc(aktion.kind) + '">' + esc(aktion.text) + '</button>' : "") +
              '<span class="uob-count' + (zaehler.voll ? " is-full" : "") + '">' + esc(zaehler.text) + '</span>' +
            '</span>' +
            '</div>'
          : '<h1 class="uob-h1">' + esc(h1) + '</h1>') +
        (sub ? '<p class="uob-sub">' + esc(sub) + '</p>' : "") +
      '</div>';
    }

    function selectHtml(kind, platzhalter, titel, suchbar) {
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
        '</div>' +
      '</div>';
    }

    function viewBrand() {
      return '<div class="uob-pane" data-pane="brand">' +
        kopf("Set up your brand",
             state.neuStart
               ? "This replaces your current setup. It is deleted when you submit this form."
               : "Help us understand what your business does and who it serves.") +
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
                selectHtml("market", "Select a market", "Markets", true) +
                '<div class="uob-err"><span data-err="market"></span></div>' +
              '</div>' +
              '<div class="uob-field" data-field="timezone">' +
                '<span class="uob-label">Time zone</span>' +
                selectHtml("timezone", "Select a time zone", "Time zones", true) +
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
          '</div>' +
        '</div>' +
      '</div>';
    }

    /* Der Zustand VOR der ersten Antwort. Bewusst ohne Ueberschrift und ohne Markenkachel: beides
       waere geraten, und ein falscher Name, der gleich umspringt, ist schlimmer als keiner.
       Die Balken sind .up-tsk-bar aus core -- dasselbe Skelett und derselbe Puls wie in jeder
       Tabelle der App, nicht ein zweites danebengebautes. */
    function viewBoot() {
      return '<div class="uob-pane" data-pane="boot">' +
        '<div class="uob-body"><div class="uob-boot" aria-busy="true" aria-live="polite">' +
          '<span class="up-tsk-bar uob-boot-a"></span>' +
          '<span class="up-tsk-bar uob-boot-b"></span>' +
          '<span class="up-tsk-bar uob-boot-c"></span>' +
        '</div></div>' +
      '</div>';
    }

    function viewLoad(kompakt) {
      var p = state.projekt || {};
      var name = txt(p.company_name) || txt(state.form.name) || "Your brand";
      /* Dieselbe Rueckfallkette wie in renderIdent: website_domain, sonst aus der Adresse
         abgeleitet -- website_domain fehlt in manchen RPC-Antworten schlicht. */
      var dom = txt(p.website_domain) ||
                normUrl(txt(p.website_url) || txt(p.website_input) || state.form.website).domain;
      return '<div class="uob-pane" data-pane="' + (kompakt ? "load2" : "load1") + '">' +
        '<div class="uob-body">' +
          '<div class="uob-load' + (kompakt ? " is-compact" : "") + '">' +
            /* Ohne vierten Parameter: das Zeichen entsteht aus der Domain (Google s2), siehe
               Begruendung in renderIdent. */
            kachel("uob-load-logo", name, dom) +
            '<div class="uob-load-name">' + esc(name) + '</div>' +
            (dom ? '<div class="uob-load-dom">' + esc(dom) + '</div>' : "") +
            /* Balken nur im ZWEITEN Ladebild. Im ersten stehen darunter die vier Phasenchips,
               und die sagen dasselbe genauer: welcher Abschnitt laeuft, nicht nur wie weit es
               ungefaehr ist. Zwei Fortschrittsanzeigen uebereinander sind eine zu viel.
               renderPhasen faellt darauf herein nicht: es fragt [data-bar] mit if (bar) ab. */
            (kompakt ? '<div class="uob-bar"><div class="uob-bar-fill" data-bar></div></div>' : "") +
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

    /* ---- Das Tor: fortsetzen oder von vorn ---------------------------------------------------
       Es gibt genau EIN Onboarding je Nutzer. Wer schon eines hat, landet nicht mehr stumm mittendrin,
       sondern sieht zuerst, was da liegt, und entscheidet. Bewusst OHNE Schiene und OHNE Knopfzeile:
       hier ist nichts zu bedienen ausser dieser einen Frage, und ein Fortschrittsbalken ueber einer
       Entscheidung behauptet, sie sei schon getroffen.

       Ob ein Neustart erlaubt ist, sagt die RPC (restart.allowed). Nachgerechnet wird hier nichts --
       die Grenze steht in der Datenbank, und eine zweite Rechnung daneben waere eine zweite Wahrheit,
       die irgendwann von der ersten abweicht. */
    function datumKurz(iso) {
      if (UC.fmtDate) return UC.fmtDate(iso);
      var d = new Date(String(iso));
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    /* Datum UND Uhrzeit. Ein Datum allein reicht hier nicht: bei einem Fenster von 24 Stunden faellt
       der naechste Neustart meist auf denselben Tag, und "wieder moeglich am 27. Aug" waere am
       27. Aug um neun Uhr keine Auskunft. */
    function zeitpunkt(iso) {
      var d = new Date(String(iso));
      if (isNaN(d.getTime())) return "";
      return datumKurz(iso) + ", " +
             String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    }
    /* Der erste Feldname, der wirklich etwas traegt. */
    function ersteZeit(o, namen) {
      if (!o || typeof o !== "object") return "";
      for (var i = 0; i < namen.length; i++) {
        var v = txt(o[namen[i]]);
        if (v) return v;
      }
      return "";
    }
    /* Und wenn keiner der bekannten Namen passt: ueber ALLES suchen, was das Projekt mitbringt,
       per Muster. Fuenf Runden lang stand hier nur eine Liste, und jede Runde hiess "noch ein Name
       fehlt". Ein Muster hoert damit auf.
       Der Wert muss sich als Zeitpunkt LESEN lassen -- ein Feld created_by mit einer Nutzerkennung
       traegt "creat" im Namen und ist keines. Ohne diese Pruefung stuende im Tor eine Uuid. */
    function zeitNachMuster(o, muster) {
      if (!o || typeof o !== "object") return "";
      for (var k in o) {
        if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
        if (!muster.test(k)) continue;
        var v = txt(o[k]);
        if (!v || v.length < 8) continue;
        var d = new Date(v);
        if (!isNaN(d.getTime())) return v;
      }
      return "";
    }
    function zeitFeld(o, namen, muster) {
      return ersteZeit(o, namen) || zeitNachMuster(o, muster);
    }
    function viewResume() {
      var p = state.projekt || {};
      var rs = state.restart || {};
      /* Der Name steht an zwei Stellen im Payload. Das Projekt gewinnt, weil es auch die Domain
         und die Zeiten traegt; restart.company_name ist der Rueckfall, falls nur die Regel kam. */
      var name = txt(p.company_name) || txt(rs.company_name) || "Your setup";
      var dom = txt(p.website_domain) ||
                normUrl(txt(p.website_url) || txt(p.website_input)).domain;
      /* Nicht nur EIN Feldname. Die RPC liefert created_at und updated_at, aber der Weg vom
         RPC-Ergebnis in den Setter fuehrt durch einen Bubble-Schritt, und der kann Felder anders
         benennen -- beim Chart hat genau dieser Weg aus einem ISO-Datum "August 1, 2026" gemacht.
         Ein Feldname, der nicht passt, ist hier nicht unterscheidbar von "kein Datum vorhanden":
         die Zeile bleibt einfach weg, und das ist die Meldung, die am schwersten zu finden ist.
         Viermal gemeldet am 26.08. */
      var erstellt = zeitFeld(p, ["created_at", "createdAt", "created", "created_on", "inserted_at"],
                              /creat|insert|start|begin|angeleg/i);
      var geaendert = zeitFeld(p, ["updated_at", "updatedAt", "updated", "last_updated",
                                   "modified_at", "changed_at"],
                               /updat|modif|chang|edit|touch|geaender/i);
      var laeuft = istJa(rs.run_in_progress);
      var darf = istJa(rs.allowed);

      /* Eine Zeile unter den Knoepfen, und sie sagt IMMER etwas. Darf der Nutzer neu starten, sagt
         sie, was er dabei verliert; darf er nicht, sagt sie warum und wann wieder. Kein interner
         Grund im Text: "rate_limited" ist eine Auskunft fuer uns, nicht fuer ihn. */
      /* Zwei verschiedene Dinge, die vorher in einer Zeile standen:
         die WARNUNG (was ein Neustart kostet) erscheint erst auf den ersten Klick -- vorher stand
         sie immer da und hat einen Schaden angekuendigt, den niemand vorhatte.
         der GRUND (warum es nicht geht) steht dagegen immer, sonst ist der gesperrte Knopf
         stumm. */
      var warnung = "Starting over deletes this setup with everything it found.";
      /* Der Zaehler nur dort, wo er eine Entscheidung aendert: beim letzten freien Neustart.
         Immer sichtbar waere er eine Einladung, ihn zu verbrauchen. */
      if (num(rs.remaining) === 1) warnung += " This is your last restart for now.";
      var hinweis;
      if (darf) {
        hinweis = "";
      } else if (laeuft) {
        hinweis = "We are still setting this one up. You can start over once it is done.";
      } else if (txt(rs.next_allowed_at)) {
        hinweis = "You have used all your restarts for now. The next one is available on " +
                  zeitpunkt(rs.next_allowed_at) + ".";
      } else {
        hinweis = "Starting over is not possible right now. Please try again later.";
      }

      var zeilen = [];
      if (erstellt) zeilen.push(["Created", datumKurz(erstellt)]);
      /* relativeTime nennt Frisches in Minuten und Stunden und faellt ab einem Tag auf das Datum
         zurueck -- genau die Aufloesung, die "zuletzt bearbeitet" braucht. */
      if (geaendert) zeilen.push(["Last updated",
        UC.relativeTime ? UC.relativeTime(geaendert) : datumKurz(geaendert)]);

      return '<div class="uob-pane" data-pane="resume">' +
        '<div class="uob-body">' +
          '<div class="uob-load is-compact">' +
            kachel("uob-load-logo", name, dom) +
            '<div class="uob-load-name">' + esc(name) + '</div>' +
            (dom ? '<div class="uob-load-dom">' + esc(dom) + '</div>' : "") +
          '</div>' +
          /* div und span, kein dl/dt/dd. Das waere die EINZIGE Stelle der Komponente mit
             Definitionslisten, und sie steht in einer fremden Seite: was Bubble an globaler CSS
             mitbringt, trifft semantische Tags als erstes. Der Rest dieser Datei benutzt aus
             demselben Grund ueberall div und span. */
          (zeilen.length
            ? '<div class="uob-res-meta">' +
                /* Wert OBEN, Beschriftung darunter -- so angesagt am 26.08. Die Reihenfolge im
                   Markup ist die Leserichtung: erst das Datum, dann wofuer es steht. */
                zeilen.map(function (z) {
                  return '<div class="uob-res-row">' +
                    '<span class="uob-res-v">' + esc(z[1]) + '</span>' +
                    '<span class="uob-res-k">' + esc(z[0]) + '</span>' +
                  '</div>';
                }).join("") +
              '</div>'
            : "") +
          '<div class="uob-res-acts">' +
            '<button class="uob-next" type="button" data-resume>Continue with this setup</button>' +
            '<button class="uob-back uob-res-over" type="button" data-restart' +
              (darf ? "" : " disabled") + '>Start over</button>' +
          '</div>' +
          /* Die Warnung steht IMMER im Markup und faehrt nur ihre Hoehe -- Bauart wie der Banner
             (.uob-banner). Sie beim Klick erst einzufuegen hiesse, sie ohne Uebergang aufblitzen
             zu lassen: ein frisch eingesetztes Element hat keinen Ausgangszustand, von dem aus
             etwas laufen koennte. */
          (darf
            ? '<div class="uob-res-warn" data-overwarn><div><p>' + esc(warnung) + '</p></div></div>'
            : '<p class="uob-res-note">' + esc(hinweis) + '</p>') +
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
                  /* is-plain wie bei Themen und Prompts: flache Zeile, die beim Ueberfahren und
                     im gewaehlten Zustand ihre Flaeche faerbt -- keine Karte mit Rahmen. Die
                     Auswahl sieht damit auf allen drei Schritten gleich aus, was sie inhaltlich
                     auch ist. Das zweispaltige Raster bleibt: acht Marken untereinander waeren
                     acht Bildschirmzeilen, nebeneinander sind es vier. */
                  return '<button class="uob-item is-plain' + (an ? " is-on" : "") + (gesperrt ? " is-blocked" : "") +
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

    /* Sobald Prompts existieren, sind die Themen FEST. Die Prompts wurden aus genau dieser
       Auswahl gebaut -- ein Thema danach abzuwaehlen liesse Prompts stehen, die zu einem Thema
       gehoeren, das es nicht mehr gibt, und ein neues Thema haette keine Prompts. Der Schritt
       bleibt erreichbar (nachsehen darf man immer), aber er nimmt keine Aenderung mehr an.
       Wer spaeter ein Thema dazunehmen will, tut das in der Themenverwaltung -- dort stehen die
       nicht gewaehlten weiter als Vorschlaege.
       Bewusst an den PROMPTS und nicht an einem eigenen Merker: existieren keine (der Lauf ist
       fehlgeschlagen), darf der Nutzer die Auswahl aendern und es erneut versuchen. */
    function themenGesperrt() { return isArr(state.prompts) && state.prompts.length > 0; }
    /* Der Grund am Zeiger, EINMAL formuliert: er steht an jeder Zeile, und zwei Wortlaute fuer
       dieselbe Sache waeren zwei Aussagen. Kurz, weil ein Tooltip kurz ist -- die lange Fassung
       steht im Vorspann darueber. */
    var FEST_TIP = "Locked: your prompts are already built on these topics.";

    function viewTopics() {
      var n = anzahl(state.selTopics);
      /* Nur die vom Server gelieferten Themen zaehlen fuer "alle": die selbst getippten stehen
         in state.eigene und sind ohnehin immer gewaehlt -- sie abzuwaehlen hiesse, sie zu
         loeschen, und das gehoert an ihr eigenes Kreuz, nicht an diesen Knopf. */
      var alleGewaehlt = state.topics.length > 0 && n >= state.topics.length;
      var fest = themenGesperrt();
      return '<div class="uob-pane" data-pane="topics">' +
        kopf("Topics",
             fest
               ? "Your prompts are already built on these topics, so they cannot be changed here."
               : "Topics group the questions we ask the models.",
             { text: n + " selected", voll: n > 0 },
             /* Kein Alle-Knopf, wenn nichts mehr zu waehlen ist. Ein Knopf, der nichts tut, ist
                schlechter als keiner. */
             (state.topics.length && !fest)
               ? { kind: "topics", text: alleGewaehlt ? "Deselect all" : "Select all" }
               : null) +
        '<div class="uob-body">' +
          (state.topics.length
            ? '<div class="uob-list up-scroll uob-group-items is-plain' + (fest ? " is-fest" : "") +
              '" role="group" aria-label="Topics">' +
                state.topics.map(function (t) {
                  var an = !!state.selTopics[t.id];
                  /* Gesperrt heisst: KEIN data-pick. Die Sperre steht damit im Markup und nicht
                     nur im Aussehen -- ein Klick findet gar kein Ziel mehr. */
                  /* is-blocked ist die vorhandene Sprache fuer "kann gerade nicht gewaehlt
                     werden" (das Wettbewerber-Limit benutzt sie). Dieselbe Bedeutung, also
                     dieselbe Klasse und derselbe Wert -- kein zweites Ausgegraut daneben.
                     data-tip statt disabled: ein disabled-Knopf feuert in Chrome keine
                     Mausereignisse, und der Tooltip aus core haengt an mouseover auf [data-tip].
                     Genau dieselbe Paarung benutzt der gesperrte Weiter-Knopf in dieser Datei. */
                  return '<button class="uob-item is-slim is-plain' + (an ? " is-on" : "") +
                           (fest ? " is-fest is-blocked" : "") + '" type="button" role="checkbox"' +
                           ' aria-checked="' + (an ? "true" : "false") + '"' +
                           (fest ? ' aria-disabled="true" data-tip="' + esc(FEST_TIP) + '"'
                                 : ' data-pick="topics"') +
                           ' data-id="' + esc(t.id) + '">' +
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
      var fest = themenGesperrt();
      var html = state.eigene.map(function (e, i) {
        return '<div class="uob-item is-slim is-plain' + (fest ? " is-fest is-blocked" : "") +
          '"' + (fest ? ' data-tip="' + esc(FEST_TIP) + '"' : "") + ' data-eigen="' + i + '">' +
          '<span class="uob-check' + (txt(e.name) ? "" : " is-leer") + '">' + ic("check", 3) + '</span>' +
          '<span class="uob-swatch" style="--uob-sw:' + esc(e.farbe) + '"></span>' +
          /* Gesperrt: das Feld liest sich noch, aber es nimmt nichts an. readonly und nicht
             disabled -- ein disabled-Feld ist fuer Vorlesesoftware weg, und der Name soll
             lesbar bleiben. */
          '<input class="uob-newin" type="text" maxlength="' + MAX.topic + '" value="' + esc(e.name) + '"' +
            (fest ? ' readonly tabindex="-1"' : '') +
            ' placeholder="Name your topic" autocomplete="off" spellcheck="false" data-eigen-in="' + i + '"/>' +
          (fest ? "" :
            '<button class="uob-newdel" type="button" data-eigen-del="' + i + '" aria-label="Remove topic">' +
              ic("x", 3) + '</button>') +
        '</div>';
      }).join("");
      if (state.eigene.length < EIGEN_MAX && !fest) {
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

    /* Drei Kartenhuellen mit den Massen der echten -- so ruckt beim Eintreffen der Tarife nur
       der Inhalt und nicht das Raster. Die Balken sind .up-tsk-bar aus core, dasselbe Skelett wie
       im Bootbild und in jeder Tabelle der App, nicht ein zweites danebengebautes. */
    function planSkelett() {
      var karte = '<div class="uob-plan is-skel" aria-hidden="true">' +
        '<span class="up-tsk-bar uob-sk-name"></span>' +
        '<span class="up-tsk-bar uob-sk-preis"></span>' +
        '<span class="up-tsk-bar uob-sk-z"></span>' +
        '<span class="up-tsk-bar uob-sk-z"></span>' +
        '<span class="up-tsk-bar uob-sk-z is-kurz"></span>' +
      '</div>';
      /* Drei Huellen, weil die Zahl der Tarife noch niemand kennt. Drei ist der Normalfall, und
         kommt ein vierter dazu, rueckt genau eine Spalte nach -- ein Skelett, das die Zahl raet,
         waere haeufiger falsch als eines, das den Normalfall zeigt. */
      return '<div class="uob-plans" style="--uob-plancols:3" aria-busy="true" aria-live="polite">' +
             karte + karte + karte + '</div>';
    }
    /* Ein Skelett braucht ein benanntes Ende. Bleibt die Antwort aus, stuende hier sonst fuer
       immer ein Platzhalter -- der Ausfall, der wie "gleich da" aussieht. Acht Sekunden: die
       Tarife sind drei Zeilen aus der Datenbank, und wer laenger wartet, wartet auf etwas, das
       nicht mehr kommt. */
    var PLAN_MAX_MS = 8000, planUhr = null;
    function planUhrStarten() {
      if (planUhr || state.plansGeholt || state.plans.length) return;
      planUhr = window.setTimeout(function () {
        planUhr = null;
        if (state.plansGeholt || state.plans.length) return;
        state.plansGeholt = true; state.plansFehler = true;
        render();
      }, PLAN_MAX_MS);
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
          /* Reihenfolge wie ueberall im Haus: Fehler VOR dem Skelett. Sonst sieht ein Ausfall
             aus wie "gleich da", und das ist die Meldung, die niemand findet. */
          (state.plansFehler
            ? (UC.leseFehlerHtml ? UC.leseFehlerHtml("plans")
                : '<p class="uob-sub" style="margin-top:18px">We could not load the plans. ' +
                  'Please reload the page.</p>')
            : !state.plans.length && !state.plansGeholt
            ? planSkelett()
            : state.plans.length
            ? '<div class="uob-plans" style="--uob-plancols:' + Math.min(4, state.plans.length) + '">' +
              state.plans.map(function (pl, i) {
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
    /* Der gewaehlte Tarif, als Datensatz. */
    function gewaehlterPlan() {
      for (var i = 0; i < state.plans.length; i++) {
        if (String(state.plans[i].id) === String(state.plan)) return state.plans[i];
      }
      return null;
    }
    function hatTest(pl) { return pl ? num(pl.trial_days) > 0 : false; }
    /* Der Knopf sagt, was der Klick TUT. Ein Tarif ohne Testphase fuehrt direkt zur Kasse, und
       "Start free trial" waere dort eine Zusage, die niemand einhaelt.
       Entschieden wird das an trial_days des GEWAEHLTEN Tarifs und nicht am Namen: "Enterprise"
       ist ein Wort auf einer Preisseite, es kann morgen anders heissen, und ein zweiter Tarif ohne
       Testphase waere von einer Namensabfrage nicht erfasst.
       Solange nichts gewaehlt ist, ist der Knopf ohnehin gesperrt -- dort steht der Fall, der auf
       die Mehrheit zutrifft, und mit dem ersten Klick sagt er die Wahrheit fuer DIESEN Tarif. */
    function planKnopfText() {
      var pl = gewaehlterPlan();
      if (pl) return hatTest(pl) ? "Start free trial" : "Proceed to checkout";
      for (var i = 0; i < state.plans.length; i++) if (hatTest(state.plans[i])) return "Start free trial";
      return "Proceed to checkout";
    }
    /* "Every plan starts with a free trial" war falsch, sobald EIN Tarif keine Testphase hat --
       und darunter steht ein Knopf, der fuer genau diesen Tarif "Proceed to checkout" sagt. Zwei
       Aussagen, die sich widersprechen, und die falsche steht groesser.
       Also drei Faelle, und jeder ist wahr. Der gemischte nennt keinen Namen: welcher Tarif keine
       Testphase hat, steht in den Daten und nicht in diesem Satz. */
    function testText() {
      var mit = 0, ohne = 0, tage = null, gleich = true;
      for (var i = 0; i < state.plans.length; i++) {
        var t = num(state.plans[i].trial_days);
        if (t != null && t > 0) {
          mit++;
          if (tage == null) tage = t; else if (t !== tage) gleich = false;
        } else ohne++;
      }
      if (!mit) return "Pick the plan that fits your team.";
      if (ohne) return "Pick the plan that fits your team. Not every plan includes a free trial.";
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
    /* Dieselben Ids ein zweites Mal, als echtes Array im Payload. Es ist die Form, die die RPCs
       nehmen (p_ids als jsonb), und in Bubble ist der Weg dorthin sonst Zeichenkettenchirurgie:
       aus "a,b" ein ["a","b"] zu bauen heisst Komma tauschen und Anfuehrungszeichen anhaengen --
       und bei LEERER Auswahl kommt dabei [""] heraus, also eine leere Id, die der RPC dann sucht.
       Hier ist leer sauber []. Die Kommatexte bleiben, sie sind in Gebrauch.
       Die neuen Felder stehen am ENDE des Payloads: alles davor bleibt byteweise, wie es war, und
       eine Extraktion, die einen Wert per Namen greift, sieht keinen Unterschied. */
    function alsListe(arr) { return isArr(arr) ? arr.map(function (x) { return String(x); }) : []; }

    /* ---- Zeichnen -------------------------------------------------------------------------- */
    var letzteAnsicht = "";
    function ansichtKey() {
      /* Vor allem anderen: solange nicht feststeht, ob es ein Projekt gibt, wird nichts gezeigt,
         was sich gleich wieder aendern koennte. */
      if (state.hochfahren) return "boot";
      /* Das Tor steht VOR allem anderen, auch vor einem laufenden Lauf: wer schon ein Onboarding
         hat, soll zuerst sehen, DASS er eins hat. Laeuft gerade etwas, fuehrt Continue ihn genau
         dorthin, ins Ladebild. */
      if (state.torAuf) return "resume";
      if (state.warten === "main") return "load1";
      if (state.warten === "prompts") return "load2";
      return state.step;
    }
    function viewFor(k) {
      if (k === "boot") return viewBoot();
      if (k === "resume") return viewResume();
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
    var BREITE = { brand: "480px", load1: "480px", load2: "560px", resume: "480px",
                   competitors: "880px", topics: "620px", prompts: "720px", plan: "1040px" };

    /* Gleiche Ansicht heisst normalerweise gleiche Gestalt: dieselbe Zahl von Kindern in
       derselben Art. Geprueft wird es trotzdem, denn ein Tausch Kind fuer Kind schreibt sonst
       Inhalt in das falsche Element -- lieber der grobe Weg als vertauschte Haelften. */
    function gleicheGestalt(a, b) {
      var n = a.children.length;
      if (!n || n !== b.children.length) return false;
      for (var i = 0; i < n; i++) if (a.children[i].tagName !== b.children[i].tagName) return false;
      return true;
    }
    /* Attribute nachziehen statt das Element ersetzen. Eine Klasse, die sich aendert, startet
       keine Animation neu -- ein neues Element schon. Erst weg, was nicht mehr dasteht, sonst
       bleibt der Zustand des letzten Zeichnens haengen. */
    function attrNachziehen(von, nach) {
      for (var i = nach.attributes.length - 1; i >= 0; i--) {
        var alt = nach.attributes[i].name;
        if (!von.hasAttribute(alt)) nach.removeAttribute(alt);
      }
      for (var j = 0; j < von.attributes.length; j++) {
        var a = von.attributes[j];
        if (nach.getAttribute(a.name) !== a.value) nach.setAttribute(a.name, a.value);
      }
    }

    function render(neuEingezogen) {
      var k = ansichtKey();
      var wechsel = k !== letzteAnsicht;
      /* Vier Tarife brauchen mehr Spalte als drei -- mit 1040px waeren die Karten so schmal, dass
         jede Merkmalszeile dreifach umbricht. Die Spalte ist ohnehin nur eine Obergrenze; auf
         einem engeren Schirm schrumpft sie mit. */
      var spalte = BREITE[k] || "480px";
      if (k === "plan" && state.plans.length >= 4) spalte = "1240px";
      root.style.setProperty("--uob-w", spalte);
      /* Im Tor bleiben Schiene und Knopfzeile weg -- die Begruendung steht an viewResume. */
      root.classList.toggle("is-gate", k === "resume");
      /* Erst hier, nicht beim Aufbau: die Uhr laeuft nur, wenn der Nutzer den Tarifschritt
         wirklich sieht. Wer nie dort ankommt, braucht keinen Ablauf. */
      if (k === "plan") planUhrStarten();

      if (wechsel) {
        /* Der abgehende Bereich bleibt fuer die Dauer des Uebergangs stehen und geht dabei weg.
           Ohne ihn faellt die Spalte auf null zusammen und schnellt wieder auf -- der haesslichste
           Fall eines Schrittwechsels. */
        /* ALLE bestehenden Bereiche, nicht nur den ersten. Hier stand querySelector, also der
           ERSTE Treffer -- und der ist bei einem zweiten Wechsel innerhalb der 240ms immer noch
           der ALTE, weil der erst danach entfernt wird. Der dazwischen eingefuegte Bereich bekam
           dann nie ein is-off und blieb fuer immer stehen: Competitors, Topics und Prompts mit
           ihren Ueberschriften und Zaehlern uebereinander. Genau so gemeldet am 24.08., und ein
           Neuladen half, weil der Stapel dabei neu entsteht.
           Zwei Wechsel so dicht hintereinander sind der Normalfall und kein Sonderfall: das Ende
           des Ladebilds schaltet weiter, und der Payload, der gleich darauf eintrifft, schaltet
           noch einmal. */
        var alte = elStack.querySelectorAll(".uob-pane");
        elStack.insertAdjacentHTML("beforeend", viewFor(k));
        var neu = elStack.lastElementChild;
        for (var ai = 0; ai < alte.length; ai++) (function (p) {
          /* Ein Bereich, der schon abgeht, fliegt SOFORT raus: sein Uebergang ist ueberholt, und
             ihn ein zweites Mal auslaufen zu lassen haelt ihn nur laenger im Bild. */
          if (p.classList.contains("is-off")) { if (p.parentNode) p.parentNode.removeChild(p); return; }
          p.classList.add("is-off");
          window.setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 240);
        })(alte[ai]);
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
             liefe bei jedem Haken der Einzug erneut.
             Der Bereich allein reicht dafuer NICHT, und das war der Ruck vom 25.08.: der Einzug
             haengt an .uob-head und .uob-body, und die beiden wurden hier mitgetauscht. Ein
             frisches Element beginnt jede Animation seiner Vorfahren von vorn, und uob-rise hat
             backwards-Fuellung -- der Inhalt sass erst die Verzoegerung lang 18px zu tief und fuhr
             dann hoch. Einmal runter und wieder hoch, ohne dass etwas passiert waere. Gemeldet
             fuer Prompts, gemessen fuer Prompts, Topics UND Competitors: jeder zweite Setter, der
             Millisekunden nach dem ersten kommt, loeste es aus.
             Also bleiben Kopf und Rumpf STEHEN und bekommen nur neuen Inhalt. Das ist mehr als
             die Animation zu unterdruecken: ein Einzug, der noch laeuft, laeuft ungestoert weiter
             -- er haengt am Element, und das Element ist noch da. Wer den Tausch mitten im Einzug
             abbekommt, sieht ihn zu Ende laufen statt auf die Endlage zu springen. */
          var frisch = document.createElement("div");
          frisch.innerHTML = viewFor(k);
          var neuIn = frisch.firstElementChild;
          if (gleicheGestalt(jetzt, neuIn)) {
            for (var ci = 0; ci < neuIn.children.length; ci++) {
              attrNachziehen(neuIn.children[ci], jetzt.children[ci]);
              jetzt.children[ci].innerHTML = neuIn.children[ci].innerHTML;
            }
          } else {
            /* Andere Gestalt heisst: hier ist mehr passiert als ein Inhaltswechsel. Dann doch ganz
               tauschen -- aber mit der Marke, damit der Inhalt nicht ein zweites Mal einzieht.
               Das Warum der Marke steht an ihrer Regel in der CSS. */
            jetzt.classList.add("is-quiet");
            jetzt.innerHTML = neuIn.innerHTML;
          }
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
      /* Ein frisch gezeichnetes Tor traegt eine zugeklappte Warnung -- also muss die Marke
         dazu passen, sonst waere der erste Klick schon die Bestaetigung. */
      if (k === "resume") overScharf = false;
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
    /* Gilt die Station als abgeschlossen? Fuer alle ausser Topics: ja, sobald man dort war.
       Topics braucht mindestens ein gewaehltes Thema -- sonst steht dort ein Haken fuer etwas,
       das noch zu tun ist. So angesagt am 24.08. */
    function stationErledigt(n) {
      if (STEPS[n] && STEPS[n].key === "topics") return anzahl(state.selTopics) > 0;
      return true;
    }

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
        /* Besucht ist nicht erledigt. Wer bei Topics war und nichts gewaehlt hat, hat den Schritt
           NICHT hinter sich -- ein Haken dort behauptet etwas, das nicht stimmt, und der Schritt
           ist der einzige, der wirklich Pflicht ist (ohne Thema entstehen keine Prompts).
           Nur Topics: bei Competitors und Prompts ist Ueberspringen ausdruecklich erlaubt, dort
           IST der Besuch die Erledigung. */
        var erledigt = (n <= state.maxErreicht && n !== i) && stationErledigt(n);
        dots[n].classList.toggle("is-done", fertig || erledigt);
        dots[n].classList.toggle("is-now", !wartet && n === i);

        var klickbar = !wartet && !gesperrt && n !== i && n <= state.maxErreicht;
        if (hits[n]) {
          hits[n].classList.toggle("is-link", klickbar);
          hits[n].disabled = !klickbar;
          hits[n].tabIndex = klickbar ? 0 : -1;
        }
        if (labels[n]) {
          labels[n].classList.toggle("is-done", erledigt);
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
      var an = !!p && k !== "brand" && k !== "load1" && k !== "load2" && k !== "resume";
      elIdent.classList.toggle("is-on", an);
      if (!an) return;
      var name = txt(p.company_name) || txt(state.form.name);
      /* website_domain ist das bequemste Feld, aber nicht das einzige, das die Domain KENNT --
         und es fehlt in manchen Antworten schlicht. Dann stand hier eine leere Domain, und das
         hiess: keine Domainzeile UND kein Favicon (favicon() gibt ohne Domain "" zurueck, die
         Kachel faellt auf den Anfangsbuchstaben zurueck). Genau so gemeldet am 24.08.
         normUrl zieht die Domain aus jeder Schreibweise, mit oder ohne Protokoll -- dieselbe
         Rueckfallkette, die das Ladebild in viewLoad() schon benutzt. */
      var dom = txt(p.website_domain) ||
                normUrl(txt(p.website_url) || txt(p.website_input) || state.form.website).domain;
      elIdentNm.textContent = name;
      elIdentDm.textContent = dom;
      /* Nur neu bauen, wenn sich die Marke wirklich geaendert hat -- sonst laedt das Favicon bei
         jedem Haken in der Liste erneut und blitzt dabei. */
      /* Das Zeichen der EIGENEN Marke wird aus der Domain aufgeloest, ueber Google s2 -- es steht
         bewusst NICHT im Payload. Eine Adresse, die ohnehin aus der Domain entsteht, durch den
         Run-JS-Step zu schleifen, macht den Schritt laenger und schafft eine zweite Stelle, an
         der etwas fehlen kann; die Domain allein reicht. (Bei den WETTBEWERBERN ist es anders:
         dort liefert die RPC favicon_url schon mit, und kachel() nimmt sie dann auch.) */
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
      /* inert statt aria-hidden -- genau das, wozu der Browser in der Konsole selbst raet:
         "Blocked aria-hidden on an element because its descendant retained focus." Der Fall trat
         auf, wenn jemand mit der Tastatur auf "Next" stand und der Klick die Wartezeit startete:
         aria-hidden versteckt die Zeile vor Vorlesesoftware, nimmt dem Knopf aber NICHT den
         Fokus -- der Nutzer stand dann auf einem Element, das es fuer ihn nicht mehr gab.
         inert nimmt beides zugleich. Wo es das nicht gibt (aeltere Browser), bleibt aria-hidden
         als Rueckfall, und der Fokus wird von Hand herausgenommen -- damit ist der gemeldete
         Zustand auch dort nicht mehr erreichbar. */
      if (wartet && elNav.contains(document.activeElement)) {
        try { document.activeElement.blur(); } catch (e) {}
      }
      if ("inert" in elNav) {
        elNav.inert = wartet;
        elNav.removeAttribute("aria-hidden");
      } else {
        elNav.setAttribute("aria-hidden", wartet ? "true" : "false");
      }
      if (wartet) return;

      var i = stepIndex(state.step);
      /* Kein Zurueck von Competitors: dahinter liegt nur Brand, und dorthin darf niemand mehr
         -- die Stammdaten sind abgeschickt und haben einen Hintergrundlauf gestartet. Ein Knopf,
         der nichts tut, ist schlechter als keiner. */
      elBack.classList.toggle("is-hidden", i <= 1);
      elNext.classList.toggle("is-busy", state.busy);
      elNext.disabled = state.busy || (state.step === "plan" && !state.plan);

      var texte = { brand: "Continue", competitors: "Continue", topics: "Continue",
                    prompts: "Continue", plan: planKnopfText() };
      elNextTxt.textContent = texte[state.step] || "Continue";
      /* Mindestens ein Thema. Ohne Thema entstehen keine Prompts, und ohne Prompts hat das
         fertige Konto nichts zu messen -- der Schritt ist der einzige, der wirklich noetig ist.
         Deshalb hier kein Ueberspringen und ein gesperrter Weiter-Knopf, solange nichts steht.

         aria-disabled statt disabled: ein disabled-Knopf feuert in Chrome KEINE Mausereignisse,
         und der Tooltip aus core haengt an einem mouseover auf [data-tip] -- er waere also nie
         zu sehen. Genau das Muster benutzen die gesperrten Wettbewerber-Zeilen in dieser Datei
         schon. weiter() prueft die Auswahl ohnehin selbst, der Klick kann also nichts ausloesen;
         der Knopf sieht gesperrt aus, sagt jetzt aber auch WARUM. */
      var themaFehlt = state.step === "topics" && !anzahl(state.selTopics);
      elNext.classList.toggle("is-blocked", themaFehlt);
      if (themaFehlt) {
        elNext.setAttribute("aria-disabled", "true");
        elNext.setAttribute("data-tip", "Pick at least one topic");
      } else {
        elNext.removeAttribute("aria-disabled");
        elNext.removeAttribute("data-tip");
      }

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
    /* ---- cal.com: erst laden, wenn der Guide wirklich offen ist ----------------------------
       NICHT beim Seitenaufbau. Der ist ohnehin lang genug (gemessen am 25.08.: 4,2 Sekunden
       vergehen, bevor eine Zeile von uns laeuft), und ein Fremdskript fuer einen Knopf, den die
       meisten nie druecken, hat dort nichts zu suchen. Der Aufruf steht deshalb hinter dem Render
       der Tafel -- und der Knopf existiert dann schon, was wichtig ist: cal bindet beim Init an
       die vorhandenen [data-cal-link]-Elemente.

       Einmal und nie wieder: das Fahnenzeichen haengt am window, nicht am Zustand der Komponente.
       Zwei Platzierungen auf einer Seite wuerden das Skript sonst zweimal holen. */
    function calLaden() {
      if (window.__uobCalAn) return;
      window.__uobCalAn = true;
      /* Wortgleich der Ausschnitt von cal.com, nur in eine Funktion gelegt. Nichts daran
         umgeschrieben: es ist ihr Ladeprogramm, und eine eigene Fassung davon waere eine zweite
         Wahrheit, die beim naechsten Update ihrer Seite auseinanderlaeuft. */
      try {
        (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document;
          C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments;
            if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || [];
              d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; }
            if (ar[0] === L) { var api = function () { p(api, arguments); };
              var namespace = ar[1]; api.q = api.q || [];
              if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api;
                p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); }
              else p(cal, ar); return; }
            p(cal, ar); };
        })(window, "https://app.cal.com/embed/embed.js", "init");
        window.Cal("init", "15min", { origin: "https://app.cal.com" });
        window.Cal.config = window.Cal.config || {};
        window.Cal.config.forwardQueryParams = true;
        window.Cal.ns["15min"]("ui", { hideEventTypeDetails: false, layout: "month_view" });
      } catch (e) {
        /* Kein sichtbarer Fehler: der Guide ist auch ohne Terminknopf vollstaendig, und ein
           blockiertes Fremdskript (CSP, Blocker) ist nichts, was der Nutzer beheben kann. */
        if (window.console) console.warn("upstreem onboarding: cal.com liess sich nicht laden.", e);
      }
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
        '</div>' +
        /* Die drei data-cal-Attribute sind der Weg, den cal.com dafuer vorgibt (element-click
           embed): das Skript bindet sich selbst daran, wir rufen keine eigene API. Der einfache
           Anfuehrungsstrich um die Konfiguration ist Absicht -- der Wert ist JSON und traegt
           doppelte. */
        '<div class="uob-help-sec uob-help-cal">' +
          '<h4 class="uob-help-h">' + esc(sp.hilfe.h) + '</h4>' +
          '<p class="uob-help-t">' + esc(sp.hilfe.t) + '</p>' +
          '<button class="uob-help-calbtn" type="button"' +
            ' data-cal-link="upstreem/15min"' +
            ' data-cal-namespace="15min"' +
            ' data-cal-config=\'{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}\'>' +
            ic("clock", 2) + '<span>' + esc(sp.hilfe.cta) + '</span>' +
          '</button>' +
        '</div>';
      /* Nach dem Render, nicht davor: der Knopf muss dastehen, wenn cal sich bindet. */
      calLaden();
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
      /* Auch LEEREN, nicht nur zuklappen. Sichtbar ist der zugeklappte Banner nicht (0fr plus
         opacity 0), aber der Text blieb im Dokument stehen -- Vorlesesoftware liest ihn weiter,
         und klappt der Banner spaeter aus einem anderen Grund auf, stuende fuer einen Moment die
         alte Meldung darin. */
      elBannerT.textContent = state.banner || "";
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
      bsegBeobachten(root.querySelectorAll("[data-biz]"));
    }
    /* EINMAL messen reicht nicht. Die Pille steht auf gemessenen Pixeln, und die aendern sich
       noch, NACHDEM sie gesetzt wurden: die Hausschrift laedt spaeter nach, und mit ihr werden
       alle vier Beschriftungen anders breit -- die Pille bleibt dann an der alten Stelle stehen
       und liegt hinter dem falschen Knopf. Genau so gemeldet am 24.08. ("B2B ist selected, aber
       der weisse BG ist hinter B2X"), und es passt zusammen: es trat "ab und an" auf, naemlich
       dann, wenn die Schrift nicht schon im Zwischenspeicher lag.
       Deshalb zwei Nachmessungen: eine, wenn die Schriften fertig sind, und dauerhaft eine bei
       jeder Groessenaenderung der Leiste (Fensterbreite, Sprache, Zoom). */
    var bsegRo = null, bsegSchriftHaengt = false;
    function bsegBeobachten(knoepfe) {
      if (!knoepfe || !knoepfe.length) return;
      if (!bsegSchriftHaengt && document.fonts && document.fonts.ready) {
        bsegSchriftHaengt = true;
        document.fonts.ready.then(function () { bsegMarke(); })["catch"](function () {});
      }
      if (bsegRo || !window.ResizeObserver) return;
      /* Beobachtet werden die KNOEPFE, nicht die Leiste um sie herum. Die Leiste ist 100% breit
         und aendert ihre Groesse nie -- ein Beobachter auf ihr feuert also genau dann nicht, wenn
         es darauf ankaeme. Gemessen: bei 1100px stand die Pille an der richtigen Stelle, war aber
         2px statt 100px breit, weil die Knopfbreite sich NACH der einzigen Messung noch aenderte.
         Der Rueckruf ruft bsegMarke, das wieder hierher fuehrt -- der Beobachter wird aber nur
         einmal angelegt (bsegRo), und bsegMarke aendert nur die Pille, nie einen Knopf: keine
         Schleife. */
      bsegRo = new ResizeObserver(function () { bsegMarke(); });
      for (var i = 0; i < knoepfe.length; i++) bsegRo.observe(knoepfe[i]);
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
      return [];
    }
    var FELD_VON = { market: "market", timezone: "timezone", business: "business" };

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
      angefasst = true;
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

      /* data-allof, nicht data-all: closest("[data-all]") darunter trifft nur den exakten
         Attributnamen, die beiden Knoepfe kommen sich also nicht ins Gehege. */
      var alleVon = e.target.closest("[data-allof]");
      if (alleVon) { alleUmschalten(alleVon.getAttribute("data-allof")); return; }
      /* Die Sperre steht auch HIER, nicht nur im Markup: ein Klick aus dem Code oder ein alter
         Knopf in einem noch nicht neu gezeichneten Bereich darf nichts aendern. */

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
      if (e.target.closest("[data-resume]")) { torSchliessen(); return; }
      if (e.target.closest("[data-restart]")) { neustartKlick(); return; }
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

    root.addEventListener("keydown", function (e) {
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
      var ei = e.target.getAttribute && e.target.getAttribute("data-eigen-in");
      if (ei != null) {
        /* readonly im Markup haelt die Tastatur auf; das hier haelt auch ein Ereignis auf, das
           von woanders kommt. */
        if (themenGesperrt()) return;
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
      var sf = e.target.closest ? e.target.closest("[data-dd-search]") : null;
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
      /* Die Sperre steht in der SACHE und nicht nur im Markup: ein Klick aus dem Code, ein alter
         Knopf in einem Bereich, der noch nicht neu gezeichnet wurde, ein Tastendruck auf einem
         Element mit aria-disabled -- alles das kaeme sonst durch. */
      if (kind === "topics" && themenGesperrt()) return;
      var topf = kind === "brands" ? state.selBrands : kind === "topics" ? state.selTopics : state.selPrompts;
      var jetztAn;
      if (topf[id]) { delete topf[id]; jetztAn = false; }
      else {
        if (kind === "brands" && anzahl(topf) >= BRAND_MAX) return;
        topf[id] = true; jetztAn = true;
      }
      /* NICHT neu zeichnen. Ein Klick aendert genau eine Zeile, und die Liste hat einen eigenen
         Scrollbereich: wer die achte Marke anklickt und dabei zurueck an den Anfang geworfen
         wird, verliert seinen Platz -- gemessen sprang der Scrollstand auf 0. Ausserdem holt ein
         neu gebautes Markup jedes Favicon erneut, was sichtbar flackert. */
      auswahlZeichnen(kind);
      if (kind === "prompts") gruppenKnoepfe();
      /* Der Knopf im Kopf sagt, was der Klick TUT -- nach dem letzten fehlenden Haken muss dort
         "Deselect all" stehen, sonst behauptet er das Gegenteil. */
      if (kind === "topics") {
        var kn = root.querySelector('[data-allof="topics"]');
        if (kn) kn.textContent = alleServerThemenAn() ? "Deselect all" : "Select all";
      }
      renderNav();
      /* ids traegt die VOLLSTAENDIGE Auswahl, nicht das angeklickte Element -- und das bleibt so.
         Der Workflow kann damit stumpf ueberschreiben, statt hinzufuegen und entfernen zu
         unterscheiden, und er heilt sich selbst: geht ein Ereignis verloren (Bubble verwirft und
         stapelt sie unter Last), steht die Wahrheit beim naechsten Klick wieder komplett da. Mit
         einer Differenz waere der Server dann dauerhaft daneben, ohne dass es jemand merkt. Auch
         zwei schnelle Klicks in falscher Reihenfolge enden mit der Vollmenge richtig; mit einer
         Differenz nicht.

         changed und on kommen NEU dazu, additiv: wer den Klick selbst braucht -- etwas
         protokollieren, eine Empfehlung nachladen -- hat ihn jetzt, ohne dass das Ueberschreiben
         seine Verlaesslichkeit verliert. Beim Alle-Knopf ist changed leer, dort gibt es kein
         einzelnes Element. */
      var eineId = String(id == null ? "" : id);
      fire("data-select-fn", "uobSelect",
        { kind: kind, ids: idsVon(topf).join(","), count: anzahl(topf),
          changed: eineId,
          changed_ids: eineId, on: !!jetztAn,
          ids_json: alsListe(idsVon(topf)),
          changed_ids_json: eineId ? [eineId] : [] });
    }

    /* Alle Themen auf einmal. Gezaehlt wird nur, was der Server geliefert hat -- die selbst
       getippten Themen aus state.eigene sind ohnehin immer gewaehlt, und sie hier abzuwaehlen
       hiesse, sie zu loeschen; das gehoert an ihr eigenes Kreuz.
       Wie waehle(): NICHT neu zeichnen, sondern nur die betroffenen Zeilen -- sonst springt der
       Scrollstand der Liste auf 0 und jedes Favicon wird erneut geholt. */
    function alleServerThemenAn() {
      for (var i = 0; i < state.topics.length; i++) if (!state.selTopics[state.topics[i].id]) return false;
      return state.topics.length > 0;
    }
    function alleUmschalten(kind) {
      if (kind !== "topics" || !state.topics.length) return;
      if (themenGesperrt()) return;
      var aus = alleServerThemenAn();
      for (var i = 0; i < state.topics.length; i++) {
        if (aus) delete state.selTopics[state.topics[i].id];
        else state.selTopics[state.topics[i].id] = true;
      }
      auswahlZeichnen("topics");
      var knopf = root.querySelector('[data-allof="topics"]');
      if (knopf) knopf.textContent = alleServerThemenAn() ? "Deselect all" : "Select all";
      renderNav();
      /* changed bleibt leer: hier gibt es kein EINZELNES Element. changed_ids traegt dafuer genau
         die Ids, die dieser Klick angefasst hat -- die vom Server gelieferten Themen, nicht die
         selbst getippten (die schaltet der Knopf absichtlich nicht, siehe oben). Damit kann ein
         Workflow gezielt schreiben, statt "alle" aufloesen zu muessen. */
      var alleThemen = state.topics.map(function (t) { return String(t.id); });
      fire("data-select-fn", "uobSelect",
        { kind: "topics", ids: idsVon(state.selTopics).join(","), count: anzahl(state.selTopics),
          changed: "",
          changed_ids: alleThemen.join(","),
          on: alleServerThemenAn(),
          ids_json: alsListe(idsVon(state.selTopics)),
          changed_ids_json: alleThemen });
    }

    /* Ein neues eigenes Thema. Die Zeile wird an Ort und Stelle eingesetzt und der Platzhalter
       wandert darunter -- kein Neuaufbau der Liste, sonst verlaere jedes andere Feld seinen
       Fokus und die Liste ihren Scrollstand. Die Farbe kommt aus der Themenpalette von core,
       weitergezaehlt hinter den vorgeschlagenen, damit zwei eigene nicht dieselbe bekommen. */
    function eigenesThemaAnlegen(platzhalter) {
      if (state.eigene.length >= EIGEN_MAX) return;
      if (themenGesperrt()) return;
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
      if (themenGesperrt()) return;
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
      /* DER Fall, an dem eine Topic-Id nicht genuegt: ein Prompt kann mehrere Themen tragen. Steht
         er unter "Partyreihe", weil das sein primary_topic_id ist, traegt aber auch "Hardtekk",
         dann trifft ein serverseitiges "alle Prompts mit Topic Hardtekk" ihn MIT -- obwohl er in
         der Oberflaeche unter einer anderen Ueberschrift steht und der Nutzer ihn nicht angefasst
         hat. Gemeldet am 25.08.

         Deshalb traegt changed_ids die Prompt-Ids DIESER Gruppe, nicht die Themen-Id. Der Workflow
         muss dann nichts aufloesen -- er schreibt genau die Zeilen, die der Klick gemeint hat.
         `on` sagt die Richtung: der Knopf schaltet die ganze Gruppe an oder aus. */
      var gruppenIds = g.items.map(function (it) { return String(it.p.id); });
      fire("data-select-fn", "uobSelect",
        { kind: "prompts", ids: idsVon(state.selPrompts).join(","), count: anzahl(state.selPrompts),
          changed: "",
          changed_ids: gruppenIds.join(","),
          on: !!an,
          ids_json: alsListe(idsVon(state.selPrompts)),
          changed_ids_json: gruppenIds });
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

    /* Der Schritt wird gemeldet, wenn der Nutzer ihn SEHEN kann -- nicht, wenn er sich intern
       aendert. Zwei Faelle hingen daran, und beide waren gemeldet:

         Neuladen MIT dem Schritt in der Adresse. Dann aendert einstieg() den Schritt nicht (er
         steht schon) und rief nur render(). Es feuerte also nichts, und ein Workflow, der auf
         uobStep die Daten des Schritts holt, lud nie -- auf dem Tarifschritt hiess das: keine
         Tarife nach einem Neuladen.

         Das Tor. Solange es davor steht, ist der Nutzer NICHT im Schritt, und ein Ereignis dafuer
         wuerde Daten fuer einen Schritt holen, den vielleicht niemand betritt. Gemeldet wird
         daher erst, wenn das Tor zugeht.

       Die Marke verhindert nur das DOPPELTE Melden derselben Ankunft. Wer zurueckgeht und wieder
       vorkommt, wird erneut gemeldet -- er kommt ja wirklich wieder an. */
    var schrittGemeldet = "";
    function schrittMelden() {
      if (state.torAuf) return;
      if (schrittGemeldet === state.step) return;
      schrittGemeldet = state.step;
      fire("data-step-fn", "uobStep", state.step);
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
      schrittMelden();
    }

    /* Fortsetzen: das Tor zu, mehr nicht. Der Schritt steht schon -- einstieg() hat ihn beim
       Aufbau gesetzt, samt Adresse. Ein gehe() darauf waere ein zweites uobStep fuer denselben
       Schritt, also ein Ereignis ohne Ereignis. */
    function torSchliessen() {
      if (!state.torAuf) return;
      state.torAuf = false;
      render();
      /* JETZT ist der Nutzer im Schritt. Vorher stand hier ausdruecklich kein Ereignis ("der
         Schritt steht schon") -- das war falsch gedacht: uobStep ist nicht die Meldung einer
         Aenderung, sondern der Anlass, die Daten des Schritts zu holen. */
      schrittMelden();
    }

    /* Von vorn anfangen. Geloescht wird HIER NICHTS: das tut die Start-RPC, wenn das Formular
       abgeschickt wird. Wer klickt und die Seite dann verlaesst, hat noch alles -- beim naechsten
       Aufbau steht dasselbe Tor wieder da.
       Lokal muss aber weg, was zum alten Lauf gehoert: Listen und Auswahl stammen aus einem
       Onboarding, das es gleich nicht mehr gibt. Die FORMULARWERTE bleiben stehen: der haeufigste
       Grund fuer einen Neustart ist dieselbe Marke noch einmal, und wer eine andere will, tippt
       darueber -- die Felder liegen offen, es ist nichts versteckt. */
    /* Der erste Klick klappt die Warnung auf und macht aus dem Knopf die Bestaetigung. NICHT neu
       zeichnen: ein Neuaufbau setzte die Warnung in ihren Endzustand und der Uebergang liefe nie.
       Deshalb wird hier von Hand am Element gearbeitet, wie beim Haken in einer Liste. */
    function neustartKlick() {
      if (!(state.restart && istJa(state.restart.allowed))) return;
      if (overScharf) { neuAnfangen(); return; }
      overScharf = true;
      var w = root.querySelector("[data-overwarn]");
      if (w) w.classList.add("is-on");
      var k = root.querySelector("[data-restart]");
      if (k) k.textContent = "Confirm";
      return;
    }

    function neuAnfangen() {
      /* Die Regel wird hier ein zweites Mal gefragt. Ein gesperrter Knopf ist eine Anzeige und
         kein Riegel: disabled im Markup haelt einen Klick aus dem Code nicht auf, und die Antwort
         der RPC waere dann ein Fehler statt einer Verweigerung. */
      if (!(state.restart && istJa(state.restart.allowed))) return;
      state.brands = []; state.topics = []; state.prompts = []; state.eigene = [];
      state.selBrands = {}; state.selTopics = {}; state.selPrompts = {};
      state.promptsFuer = null; state.maxErreicht = 0; state.planGesehen = false;
      state.projekt = null; state.plan = ""; state.banner = ""; state.fehler = {};
      state.neuStart = true;
      state.torAuf = false;
      warteBeenden();
      /* gehe() kehrt um, wenn der Schritt schon steht -- und nach einem Entwurf steht er auf
         brand. Dann zeichnet hier niemand, und das Tor bliebe stehen. */
      if (state.step === "brand") { urlSetzen("brand", false); render(); }
      else gehe("brand", false);
    }

    function weiter(ueberspringen) {
      if (state.busy) return;
      /* Laeuft eine Uhr, tut Continue NICHTS. Bisher hing das allein am Bild: die Knopfzeile wird
         waehrend einer Wartezeit unsichtbar und inert gesetzt, also trifft sie kein Zeiger und
         keine Tastatur -- gemessen, und mit der Maus ist ein zweiter Klick auch nicht moeglich.
         Nur steht die Sperre damit im Aussehen und nicht in der Sache: drei Klicks aus dem Code
         loesten dreimal aus, und der Rueckfall fuer Browser ohne inert (aria-hidden) haelt einen
         Klick gar nicht auf. Ein zweites uobTopics heisst ein zweiter Lauf ueber denselben
         Themen, also eine zweite Rechnung fuer dieselbe Arbeit. Eine Zeile ist billiger als die
         Frage, ob das Bild ueberall stimmt. */
      if (state.warten) return;
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
          business_model: txt(state.form.business)
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

    /* EIN Leseweg fuer alles, was aus Bubble kommt -- jetzt UC.readBubble in core, weil
       url-detail denselben braucht. Was er kann und warum, steht dort. Der Rueckfall haelt die
       Seite am Leben, falls ein alter Pin core ohne readBubble liefert. */
    function lies(payload) {
      if (UC.readBubble) return UC.readBubble(payload);
      if (payload && typeof payload === "object") return payload;
      var t = txt(payload);
      if (!t) return null;
      try { var q = JSON.parse(t); return (q && typeof q === "object") ? q : null; } catch (e) { return null; }
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

    /* Die Huelle abziehen, in der ein Status ankommen kann. Der Realtime-Kanal schickt die Zeile
       je nach Verdrahtung nackt, als {record:...}, als {new:...} (so heisst es bei Postgres-
       Changes) oder im ganzen Buendel unter {project:...}. Bisher verstand die Komponente nur
       die nackte Form -- alles andere fiel still durch, und der Loader lief einfach weiter.
       Genau so gemeldet am 24.08.: "n8n setzt korrekt die status dinger, aber das Event updatet
       die Steps nicht". */
    function kernAus(p) {
      if (!p || typeof p !== "object") return p;
      if (isArr(p)) p = p[0];
      if (!p || typeof p !== "object") return p;
      var h = ["project", "record", "new", "row", "data"];
      for (var i = 0; i < h.length; i++) {
        var k = p[h[i]];
        if (k && typeof k === "object" && !isArr(k) &&
            (k.status != null || k.status_phase != null || k.progress_percent != null)) return k;
      }
      return p;
    }

    /* "Konnte nicht gelesen werden" ist als Meldung wertlos -- damit weiss niemand, wo er suchen
       soll. Der haeufigste echte Fall ist gemessen: am 24.08. kam das Buendel ohne seine ersten
       elf Zeichen an (das literale {"topics":[ vor dem dynamischen Teil des Bubble-Ausdrucks war
       verschwunden), alles danach war unversehrt. Das kann niemand reparieren -- welcher
       Schluessel dort stand, steht nirgends mehr im Text --, aber es laesst sich BENENNEN: ein
       Text, der auf eine schliessende Klammer endet, ohne mit einer oeffnenden zu beginnen, hat
       seinen Anfang verloren. */
    /* EINE Meldung, und zwar eine, die dem Nutzer etwas sagt. Hier stand vorher eine
       Klammerbilanz, die zwischen "Anfang fehlt" und "am Ende abgeschnitten" unterschied und dazu
       riet, den Ausdruck im Bubble-Schritt zu pruefen. Das ist Entwicklerdiagnose und hat im
       Bild eines Nutzers nichts zu suchen -- so ausdruecklich angemahnt am 24.08. Wer die Seite
       benutzt, kann an einem Payload nichts richten; er kann neu laden. Also sagt die Meldung
       genau das und nichts weiter.
       Die Diagnose ist damit ganz weg und nicht nur unsichtbar: eine Konsolenausgabe waere nach
       §5 ebenfalls nicht erlaubt, und toter Code, der nichts erreicht, ist schlechter als keiner.
       Wer sie braucht, hat den Payload im Bubble-Log und im Harness. */
    function leseFehlerText() {
      return "We could not load your onboarding. Please reload the page.";
    }

    /* Die Statuswerte des Datenmodells. Als Menge, damit ein nacktes Wort als Status erkannt
       werden kann, ohne dass jeder beliebige Text dafuer durchgeht. */
    var STATUS_WORTE = { draft:1, submitted:1, processing:1, running:1, queued:1,
                         ready:1, done:1, complete:1, completed:1, failed:1, error:1 };

    /* Ein Status kann auf vier Wegen gesagt werden, und das Datenmodell traegt alle vier:
       status_phase (1..5), progress_percent (0..100), status ("draft"/"submitted"/"processing"/
       "ready"/"failed") und status_label. Bisher zaehlte NUR status_phase -- fehlte die, tat
       setStatus nichts und meldete auch nichts (return false). Jetzt wird jedes Signal gelesen
       und in dieselbe Phase uebersetzt, damit es egal ist, welche Felder der Kanal mitschickt. */
    function statusAus(p) {
      var st = txt(p.status).toLowerCase();
      var phase = num(p.status_phase);
      var proz = num(p.progress_percent);
      /* "ready" ist fertig, auch ohne status_phase 5 -- und 100% ebenso. */
      var fertig = (st === "ready" || st === "done" || st === "complete" || st === "completed") ||
                   (phase != null && phase >= 5) ||
                   (phase == null && proz != null && proz >= 100);
      /* Ohne Phase, aber mit Prozent: die Spur hat vier Abschnitte, also je 25%. */
      if (phase == null && proz != null) phase = Math.floor(proz / (100 / PHASES.length)) + 1;
      return {
        status: st,
        phase: phase,
        prozent: proz,
        label: txt(p.status_label),
        fertig: fertig,
        laeuft: st === "submitted" || st === "processing" || st === "running" || st === "queued",
        entwurf: st === "draft" || st === "",
        fehler: fehlerAus(p)
      };
    }

    /* ---- Einstieg: wohin gehoert dieser Nutzer? ------------------------------------------------
       Der Aufruf beim Seitenaufbau bekommt ein Buendel {project, competitors, topics, prompts}.
       Daraus faellt die Entscheidung, was der Nutzer ueberhaupt sieht -- das ist der einzige Ort,
       an dem sie faellt, damit nicht drei Setter nacheinander an der Ansicht ziehen.

         kein project        -> Formular (neuer Nutzer)
         draft               -> Formular, aber mit den gespeicherten Werten vorbelegt
         submitted/processing-> Ladebild, Startwert aus status_phase bzw. progress_percent
         ready               -> Auswahl; wie weit, sagt das, was schon gewaehlt ist
         failed              -> Fehlermeldung aus last_error, Formular bleibt zum erneuten Versuch

       Bewusst NICHT vorwaerts geschoben wird, wer schon weiter ist als das Buendel: ein Nutzer,
       der gerade auf Topics steht, darf durch ein spaeter eintreffendes Buendel nicht auf
       Competitors zurueckfallen. */
    /* Was der Server schon weiss, gewinnt ueber das, was im Formular steht: nach einem Neuladen
       ist das Formular leer, das Projekt aber vollstaendig. Steht in beiden Einstiegen (Buendel
       und Einzel-Projekt), deshalb hier einmal. */
    function formAusProjekt(p) {
      if (!p || typeof p !== "object") return;
      if (txt(p.company_name)) state.form.name = txt(p.company_name);
      /* website_input ist die ROHE Eingabe des Nutzers, website_url die aufgeraeumte. Ins Feld
         gehoert das, was er selbst getippt hat -- sonst sieht er beim Zurueckkommen eine Adresse,
         die er so nie eingegeben hat. Fehlt sie, tut es die aufgeraeumte. */
      var w = txt(p.website_input) || txt(p.website_url);
      if (w) state.form.website = w;
      if (txt(p.market)) state.form.market = txt(p.market);
      if (txt(p.business_model)) state.form.business = txt(p.business_model);
      if (txt(p.timezone)) state.form.timezone = txt(p.timezone);
      setzeFormWerte();
    }

    /* Der Bootzustand endet, sobald IRGENDEINE Antwort da ist -- auch eine leere, denn "kein
       Projekt" ist eine gueltige Antwort und bedeutet: neuer Nutzer, Formular. */
    var BOOT_MAX_MS = 6000, bootUhr = null;
    function bootBeenden() {
      if (bootUhr) { window.clearTimeout(bootUhr); bootUhr = null; }
      if (!state.hochfahren) return false;
      state.hochfahren = false;
      return true;
    }
    bootUhr = window.setTimeout(function () {
      bootUhr = null;
      /* Niemand hat geantwortet. Lieber das Formular als ein Skelett ohne Ende -- ein Nutzer, der
         doch ein Projekt hat, landet spaeter trotzdem richtig, sobald der Setter eintrifft. */
      if (state.hochfahren) { state.hochfahren = false; render(); }
    }, BOOT_MAX_MS);

    /* Wohin gehoert dieser Nutzer beim Aufbau?

       Zwei Belege, und der spaetere von beiden gewinnt -- sie sind UNTERGRENZEN, keine Obergrenzen:

         die Adresse   gehe() schreibt den Schritt bei jedem Wechsel hinein, ein Neuladen bringt
                       ihn also mit. Das sagt, wo der Nutzer WAR. Gelesen wird die Momentaufnahme
                       vom Aufbau: fragte man live, laese man das, was die Komponente beim Aufbau
                       selbst geschrieben hat (gemessen -- so landete es in allen Faellen auf brand).
         die Prompts   Sie entstehen erst im Workflow hinter uobTopics, also erst nachdem der Nutzer
                       den Themenschritt wirklich verlassen hat. Ihre Existenz BEWEIST einen
                       abgeschlossenen Schritt.

       Warum das Maximum und nicht die Adresse allein: genau daran ist es am 25.08. gescheitert.
       Die Adresse stand auf topics, das Buendel trug 15 Prompts -- und die Adresse als Obergrenze
       hielt den Nutzer auf Topics fest, obwohl der Schritt nachweislich durch war. Prompts waren
       nicht einmal anklickbar. Andersherum (Prompts allein) wuerde jemand, der bewusst auf Topics
       zurueckgegangen ist und neu laedt, nach vorn geworfen. Das Maximum trifft beide Faelle.

       Was ABSICHTLICH kein Beleg ist: eine Auswahl. Ein Haken wird sofort gespeichert (uobSelect
       feuert bei jedem Klick), er sagt also nichts darueber, ob ein Schritt abgeschlossen ist.
       Genau das war der Fehler vom 24.08.: ein angeklickter Wettbewerber schob nach Topics. */
    function zielSchritt() {
      var a = schrittBeimAufbau ? stepIndex(schrittBeimAufbau) : -1;
      var b = (isArr(state.prompts) && state.prompts.length) ? stepIndex("prompts") : -1;
      var i = Math.max(a, b);
      return i >= 0 ? STEPS[i].key : "competitors";
    }
    function einstieg(b) {
      bootBeenden();
      var pr = (b && typeof b === "object" && b.project && typeof b.project === "object")
             ? b.project : b;
      if (!pr || typeof pr !== "object") { gehe("brand", false); return; }
      var s = statusAus(pr);
      if (s.fehler) { state.banner = s.fehler; warteBeenden(); state.busy = false;
                      if (state.step !== "brand") gehe("brand", false); else render(); return; }
      if (s.fertig) {
        warteBeenden();
        var ziel = zielSchritt();
        /* Was belegt erreicht ist, muss in der Leiste auch anklickbar sein. Ohne diese Zeile stand
           der Nutzer auf Topics, die Prompts lagen vor -- und Prompts war trotzdem gesperrt, weil
           maxErreicht nur aus dem AKTUELLEN Schritt waechst. So gemeldet am 25.08. */
        var zi = stepIndex(ziel);
        if (zi > state.maxErreicht) state.maxErreicht = zi;
        /* Nur vorwaerts, nie zurueck -- siehe Begruendung oben. */
        if (stepIndex(ziel) > stepIndex(state.step)) gehe(ziel, false);
        else { render(); schrittMelden(); }
        return;
      }
      if (s.laeuft) {
        if (state.warten !== "main") warteStarten("main");
        if (s.phase != null) phaseSetzen(Math.max(0, s.phase - 1));
        else if (s.prozent != null) state.fortschritt = Math.max(state.fortschritt, s.prozent);
        renderPhasen();
        return;
      }
      /* draft oder unbekannt: das Formular, mit dem was schon dasteht. */
      warteBeenden();
      if (state.step !== "brand") gehe("brand", false); else render();
    }

    /* ---- Aussenschnittstelle ------------------------------------------------------------------ */
    var ctrl = {
      instanceId: instanceId,
      /* Das ganze Buendel aus EINEM Aufruf: Projekt, Wettbewerber, Themen und Prompts zugleich.
         Genau die Form, in der die RPC beim Seitenaufbau antwortet -- ein Setter statt vier, und
         die Ansicht wird erst gesetzt, wenn alles vier eingetragen ist. */
      setBundle: function (payload) {
        /* GAR NICHTS ist kein Fehler, sondern ein neuer Nutzer: die RPC antwortet leer, wenn es
           noch kein Onboarding-Projekt gibt. Das von einem kaputten Payload zu unterscheiden ist
           der ganze Punkt -- sonst begruesst die Seite jeden neuen Nutzer mit einer Fehlermeldung.
           Leer heisst hier: kein Text. Ein Text, den niemand lesen kann, ist weiter ein Fehler. */
        if (payload == null || (typeof payload !== "object" && txt(payload) === "")) {
          state.banner = "";
          bootBeenden();
          warteBeenden();
          /* KEIN Projekt heisst: nichts ist je erreicht worden. Der Fortschritt muss deshalb
             mit weg, nicht nur der Schritt.
             Der Grund, warum das ueberhaupt auffiel: der Startschritt kommt aus der Adresse
             (?step=topics), damit jemand nach Tagen wieder dort landet, wo er war. Wird das
             Onboarding in der Datenbank geloescht und die Seite neu geladen, traegt die Adresse
             den alten Schritt aber weiter -- die Komponente startete auf "topics", maxErreicht
             sprang auf 2, und Competitors und Topics standen abgehakt und anklickbar da, obwohl
             es nichts mehr gab. Genau so gemeldet am 24.08.
             Mit Listen und Auswahl zusammen: sie stammen aus demselben geloeschten Projekt. */
          state.projekt = null;
          state.maxErreicht = 0; state.planGesehen = false; state.promptsFuer = null;
          state.brands = []; state.topics = []; state.prompts = []; state.eigene = [];
          state.selBrands = {}; state.selTopics = {}; state.selPrompts = {};
          state.step = "brand";
          urlSetzen("brand", false);
          render();
          return true;
        }
        var b = lies(payload);
        if (isArr(b)) b = b[0];
        if (!b || typeof b !== "object") {
          state.banner = leseFehlerText(payload);
          bootBeenden(); warteBeenden(); render(); return true;
        }
        /* Ein Buendel, das gelesen werden konnte, raeumt eine alte Fehlermeldung weg. Ohne diese
           Zeile blieb der Banner eines frueheren Versuchs ueber dem neuen, heilen Zustand stehen
           -- gemessen: die Meldung aus dem Fall "leer" stand noch ueber draft, processing und
           ready. Was danach wirklich ein Fehler ist, setzt einstieg() gleich neu. */
        state.banner = "";
        /* Die Neustart-Regel reist im selben Buendel mit. Nur uebernehmen, nicht auswerten: wie
           oft jemand neu starten darf, entscheidet die Datenbank. */
        if (b.restart && typeof b.restart === "object") state.restart = b.restart;
        /* Die Einmal-Marke wird nur verbraucht, wenn ueberhaupt eine Regel dabei war. Sonst haette
           ein erstes Buendel ohne restart das Tor fuer die ganze Seitenansicht verspielt, und was
           danach kommt, koennte es nie mehr aufmachen.
           istJa und nicht === true: was als Wahrheitswert aus Bubble kommt, kommt als true, "true",
           yes oder 1 -- derselbe Grund, aus dem selected schon so gelesen wird. Ein strenger
           Vergleich haette hier stumm nichts getan, und "es passiert nichts" ist die Meldung, die
           am schwersten zu finden ist. */
        if (state.restart && !torGeprueft) {
          torGeprueft = true;
          /* Nicht, wenn der Nutzer schon handelt: auf der echten Seite vergehen bis zur Antwort
             der RPC gut und gerne neun Sekunden, und wer in der Zeit angefangen hat, darf nicht
             vor eine Frage gestellt werden, die er langst beantwortet hat. */
          if (istJa(state.restart.has_onboarding) && !angefasst) state.torAuf = true;
        }
        /* Das PROJEKT zuerst, und das ist keine Kosmetik: listeSetzen zeichnet, wenn keine Uhr
           laeuft -- dreimal, einmal je Liste. Stand das Projekt danach, zeichneten diese drei
           Durchgaenge eine Ansicht, der das Projekt fehlt. Am Tor sieht man das: die Karte kommt
           ohne Domain und ohne Zeiten, weil beides nur aus dem Projekt stammt, und erst der
           Durchgang am Ende setzt sie ein. Nichts davon braucht die Listen, also gehoert es nach
           vorn. */
        var pr = (b.project && typeof b.project === "object") ? b.project : null;
        if (pr) {
          state.projekt = pr;
          formAusProjekt(pr);
        }
        /* Dann die Listen, dann der Einstieg: zielSchritt() liest sie. Die Listen zeichnen
           waehrend einer Uhr ohnehin nicht (siehe listeSetzen). */
        if (isArr(b.competitors)) listeSetzen(b.competitors, "brands");
        else if (isArr(b.brands)) listeSetzen(b.brands, "brands");
        if (isArr(b.topics)) listeSetzen(b.topics, "topics");
        if (isArr(b.prompts)) listeSetzen(b.prompts, "prompts");
        einstieg(b);
        return true;
      },
      /* Nimmt weiterhin das nackte Projekt -- UND das ganze Buendel, falls jemand die RPC-Antwort
         unveraendert hierher gibt. Beides zu koennen ist billiger, als es falsch zu erwischen:
         der Unterschied ist von aussen nicht sichtbar, es ist dieselbe RPC. */
      setProject: function (payload) {
        var b = lies(payload);
        if (isArr(b)) b = b[0];
        if (b && typeof b === "object" &&
            (isArr(b.competitors) || isArr(b.topics) || (b.project && typeof b.project === "object"))) {
          return ctrl.setBundle(b);
        }
        var p = kernAus(b);
        if (!p || typeof p !== "object") {
          state.banner = "We could not load your onboarding. Please reload the page.";
          warteBeenden(); render(); return true;
        }
        state.projekt = p;
        /* Wie bei setBundle: ein lesbares Projekt raeumt die alte Fehlermeldung weg, einstieg()
           setzt gleich die neue, falls dieses Projekt wirklich einen Fehler traegt. */
        state.banner = "";
        formAusProjekt(p);
        einstieg(p);
        return true;
      },
      setStatus: function (payload) {
        /* Ein Status ist auch eine Antwort: ab hier ist klar, dass ein Lauf existiert. */
        bootBeenden();
        var p = kernAus(lies(payload));
        /* Eine nackte Zahl ist eindeutig -- sie kann nur die Phase sein. Vorher hat
           setOnboardingStatus("...", "3") NICHTS getan und auch nichts gesagt: kein Fehler,
           keine Meldung, die Uhr lief einfach weiter. Das ist der naheliegendste Griff, weil
           der Parameter "Status" heisst und in der RPC eine Zahl ist. Gemessen: 0 Phasen
           fertig mit "3", 2 mit {"status_phase": 3}. */
        if ((!p || typeof p !== "object") && txt(payload) !== "" && num(payload) != null) {
          p = { status_phase: num(payload) };
        }
        /* Ein blosses Wort reicht auch: "processing", "ready", "failed". Aber NUR ein bekanntes:
           sonst wird jeder unlesbare Text zu einem Status, der nichts bedeutet, und der Aufruf
           verpufft wieder still -- gemessen mit "{kaputt::", das genau so durchrutschte. */
        if ((!p || typeof p !== "object") && STATUS_WORTE[txt(payload).toLowerCase()]) {
          p = { status: txt(payload) };
        }
        if (!p || typeof p !== "object") {
          /* KEIN stilles false mehr. Ein Payload, den niemand lesen konnte, ist ein Fehler --
             und ein Loader, der ewig weiterlaeuft, sieht aus wie "gleich fertig". */
          state.banner = "We could not load your onboarding. Please reload the page.";
          warteBeenden(); state.busy = false; render(); return true;
        }
        var s = statusAus(p);
        /* status_label wird bewusst NICHT angezeigt: die vier Phasentexte sind auf den Nutzer
           geschrieben ("Reading your website"), das Label des Servers ist eine Systemmeldung
           ("Done"). Beides gemischt laese sich wie zwei verschiedene Stimmen. */
        if (s.fehler) { state.banner = s.fehler; warteBeenden(); state.busy = false; render(); return true; }
        if (s.fertig) {
          state.fortschritt = 100; renderPhasen();
          window.setTimeout(function () {
            warteBeenden();
            gehe(state.step === "brand" ? "competitors" : "prompts", false);
          }, 360);
          return true;
        }
        if (s.phase != null) { phaseSetzen(Math.max(0, s.phase - 1)); return true; }
        /* Laeuft noch, sagt aber keine Phase: dann wenigstens die Uhr am Laufen halten, statt
           den Aufruf verpuffen zu lassen. */
        if (s.laeuft) { if (!state.warten) warteStarten("main"); return true; }
        return true;
      },
      setBrands: function (payload) { return listeSetzen(payload, "brands"); },
      setTopics: function (payload) { return listeSetzen(payload, "topics"); },
      setPrompts: function (payload) { return listeSetzen(payload, "prompts"); },
      setPlans: function (payload) {
        if (planUhr) { window.clearTimeout(planUhr); planUhr = null; }
        var p = lies(payload);
        /* Der Ladezustand endet IMMER, auch bei einem Payload, den niemand lesen kann. Die Meldung
           steht im Rumpf und nicht mehr im Banner: sie gehoert an die Stelle, an der der Inhalt
           fehlt, und zweimal dasselbe an zwei Orten zu sagen ist einmal zu viel. */
        state.plansGeholt = true;
        if (!isArr(p)) { state.plansFehler = true; state.plans = []; render(); return true; }
        state.plansFehler = false;
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
        /* Wer den Schritt von aussen setzt, weiss wohin -- dann ist der Bootzustand erledigt. */
        bootBeenden();
        gehe(txt(k), false);
        return true;
      },
      setError: function (text) { state.banner = txt(text); warteBeenden(); state.busy = false; render(); return true; },
      /* Zwei Bedeutungen, sauber getrennt nach Zeitpunkt -- und beide heissen fuer den Nutzer
         dasselbe: "die Seite arbeitet gerade".
           VOR der ersten Antwort (state.projekt ist noch leer): der Aufruf steuert den
           Bootzustand, also das seitenweite Skelett. Genau dafuer angefragt am 24.08. -- "yes"
           beim Pageload, damit das Formular nicht aufblitzt, bevor die Daten da sind.
           DANACH: der Kreisel im Weiter-Knopf, wie bisher.
         "no" beendet den Bootzustand immer -- es ist die ausdrueckliche Ansage, dass fertig
         geladen ist. */
      setLoading: function (on) {
        var an = istJa(on);
        if (!an) { if (bootBeenden()) { render(); return true; } }
        else if (state.hochfahren || !state.projekt) {
          if (!state.hochfahren) { state.hochfahren = true; render(); return true; }
          return true;
        }
        state.busy = an; renderNav(); return true;
      },
      reset: function () {
        warteBeenden();
        bootBeenden();
        state.step = "brand"; state.projekt = null;
        state.brands = []; state.topics = []; state.prompts = [];
        state.selBrands = {}; state.selTopics = {}; state.selPrompts = {}; state.eigene = [];
        state.plan = ""; state.banner = ""; state.busy = false;
        state.fehler = {}; state.maxErreicht = 0; state.planGesehen = false;
        state.promptsFuer = null;
        state.restart = null; state.torAuf = false; state.neuStart = false;
        railStand = "";
        state.form = { name: "", website: "", market: eigenerMarkt(), timezone: eigeneZone(),
                       business: BUSINESS_STD };
        letzteAnsicht = "";
        elStack.innerHTML = "";
        urlSetzen("brand", false);
        render();
        return true;
      }
    };

    /* Interner Schluessel -> das Wort, das in der Oberflaeche steht. */
    var LISTENNAME = { brands: "competitors", topics: "topics", prompts: "prompts" };
    function listeSetzen(payload, welche) {
      var p = lies(payload);
      if (!isArr(p)) {
        /* NICHT den internen Namen einsetzen: "welche" ist brands/topics/prompts, und
           "brands" heisst in der Oberflaeche Competitors -- der Nutzer saehe ein Wort, das auf
           seinem Bildschirm nirgends steht. Interne Bezeichner haben in sichtbarem Text nichts
           zu suchen, so angemahnt am 24.08. */
        state.banner = "We could not load the " + LISTENNAME[welche] + ". Please reload the page.";
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
          /* Die Themenzuordnung eines Prompts kommt in DREI Formen aus der RPC, und nur die erste
             war bisher gelesen -- mit dem echten Buendel vom 25.08. standen darum alle 15 Prompts
             unter "Other": dort heisst das Feld `topics` und traegt Objekte, kein `topic_ids`.

               topic_ids          Liste oder Komma-Text von Ids
               topics             Liste von Objekten {id, is_primary} ODER von nackten Ids
               primary_topic_id / topic_id   eine einzelne Id

             Die PRIMAERE gehoert nach vorn: promptGruppen() nimmt die erste Id, die es kennt, als
             Gruppe. Ohne diese Sortierung entschiede die Reihenfolge im Payload, unter welchem
             Thema ein Prompt landet -- und die ist keine Aussage. */
          var tids = [];
          if (isArr(r.topic_ids)) tids = r.topic_ids.map(txt);
          else if (txt(r.topic_ids)) tids = txt(r.topic_ids).split(",").map(function (s2) { return s2.trim(); });
          else if (isArr(r.topics)) {
            tids = r.topics.map(function (t) { return (t && typeof t === "object") ? txt(t.id) : txt(t); });
            var prim = txt(r.primary_topic_id);
            if (!prim) {
              for (var pi = 0; pi < r.topics.length; pi++) {
                var t2 = r.topics[pi];
                if (t2 && typeof t2 === "object" && istJa(t2.is_primary)) { prim = txt(t2.id); break; }
              }
            }
            if (prim) tids = [prim].concat(tids.filter(function (x) { return x !== prim; }));
          }
          if (!tids.length && txt(r.primary_topic_id)) tids = [txt(r.primary_topic_id)];
          if (!tids.length && txt(r.topic_id)) tids = [txt(r.topic_id)];
          tids = tids.filter(function (x) { return !!x; });
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
         liefe unnoetig noch einmal durch die Wartezeit.
         Nur wenn es eine Auswahl GIBT: in welcher Folge die Setter kommen, steht nicht in unserer
         Hand. Kommen die Prompts VOR den Themen, waere das hier die leere Auswahl -- und die passt
         zu keiner spaeteren. Genau so gemessen: der Weiter-Klick fand einen Unterschied, wo keiner
         war, und schickte den Nutzer ein zweites Mal durch die ganze Wartezeit. Dann bleibt es
         unbekannt, und der Themen-Setter traegt es nach. */
      if (welche === "prompts") {
        var ausw = idsVon(state.selTopics).sort().join(",");
        if (ausw) state.promptsFuer = ausw;
      }
      /* Die andere Richtung. Nur wenn es noch unbekannt ist -- eine bekannte Zuordnung darf ein
         Themen-Setter nicht ueberschreiben: aendert er die Auswahl, gehoeren die liegenden
         Prompts eben NICHT mehr dazu, und dann muss der naechste Weiter-Klick neue anfordern. */
      if (welche === "topics" && state.prompts.length && !state.promptsFuer) {
        state.promptsFuer = idsVon(state.selTopics).sort().join(",");
      }
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
    ruf("setOnboardingBundle",  function (id, p) { var c = resolve(id); return c ? c.setBundle(p) : false; });
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
