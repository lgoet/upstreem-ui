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

   ── Statisch und dynamisch in EINER Datei ───────────────────────────────────────────────────
   data-demo="yes" fuellt die Seite mit den Beispieldaten (DEMO_DATEN, weiter unten in dieser
   Datei) und laesst die Uhren fest laufen: fuenf Sekunden je Phase, also zwanzig, danach zehn.
   Nichts nachzuladen, nichts zu verdrahten -- das Attribut genuegt. Ohne das Attribut passiert
   nichts von selbst: dann fuettern die Setter unten, und die Phasen kommen aus dem
   Statuspayload. Es sind DIESELBEN Zustaende, nicht zwei Fassungen.

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
     "setOnboardingLoading", "resetOnboarding"].forEach(function (n) {
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

  /* ---------- Beispieldaten fuer den Demobetrieb ---------------------------------------------
     Sie stehen HIER und nicht in einer zweiten Datei. Der erste Versuch hatte sie ausgelagert,
     und genau daran ist er gescheitert: auf einer Seite, die diese Datei nicht mitlaedt, blieben
     alle Listen leer, und die Ladeuhr stand still, weil im Demobetrieb sie es ist, die die
     Phasen weiterschaltet. Eine Fassung, die von einer zweiten Datei abhaengt, ist keine
     Fassung, die man einfach anschalten kann.

     Projekt, Marken, Prompts und Tarife sind wortgleich die Payloads aus der Aufgabe. Erfunden
     sind nur die Themen und die zusaetzlichen Prompts, weil es beides in der heutigen Fassung
     noch nicht gibt.

     Sie werden NUR gelesen, wenn am Element data-demo="yes" steht. Ohne das Attribut ruehrt
     diese Komponente den Block nicht an. */
  var DEMO_DATEN = {
  
    project: {
      "id": "9346b43e-f7b9-4122-ad10-0869aaecc21d",
      "user_id": "aea6e317-d901-419b-b2b2-5ca3573ea2f5",
      "mode": "Brand",
      "business_model": "B2B",
      "brand_industry": "Lautsprecher / Beschallung",
      "market_focus": null,
      "website_input": "https://www.funktion-one.com",
      "website_url": "https://funktion-one.com",
      "website_domain": "funktion-one.com",
      "status": "ready",
      "run_group_uuid": null,
      "status_phase": 5,
      "status_label": "Finalizing insights",
      "progress_percent": 100,
      "last_error": null,
      "created_at": "2026-08-20T11:52:29.900336+00:00",
      "updated_at": "2026-08-20T11:52:29.97104+00:00",
      "company_name": "Function One",
      "summary": "Funktion-One ist ein Hersteller professioneller Lautsprechersysteme fuer Tourneen, Festivals, Arenen, Clubs und Installationen.",
      "market": "DE",
      "selected_billing_plan_id": null,
      "billing_interval": null,
      "stripe_checkout_session_id": null,
      "stripe_checkout_url": null,
      "team_id": null
    },
  
    brands: [
      { "id": "f6450b61-b104-44b8-a9f9-c9cd30f53c58", "name": "d&b audiotechnik", "domain": "dbaudio.com",
        "url": "https://dbaudio.com", "favicon_url": "https://www.google.com/s2/favicons?domain=dbaudio.com&sz=64", "selected": false },
      { "id": "56f0910d-a8dc-4f48-8f52-1d5bc86ba038", "name": "L-Acoustics", "domain": "l-acoustics.com",
        "url": "https://l-acoustics.com", "favicon_url": "https://www.google.com/s2/favicons?domain=l-acoustics.com&sz=64", "selected": false },
      { "id": "3d0c0160-25a0-475b-bab3-29b4f5cd120b", "name": "Meyer Sound", "domain": "meyersound.com",
        "url": "https://meyersound.com", "favicon_url": "https://www.google.com/s2/favicons?domain=meyersound.com&sz=64", "selected": false },
      { "id": "ae8e82b0-fb4f-4b56-a052-00cc730a97e2", "name": "KV2 Audio", "domain": "kv2audio.com",
        "url": "https://kv2audio.com", "favicon_url": "https://www.google.com/s2/favicons?domain=kv2audio.com&sz=64", "selected": false },
      { "id": "1ddc14fd-f7e1-4c83-98a6-4433b7b9222a", "name": "CODA Audio", "domain": "codaaudio.com",
        "url": "https://codaaudio.com", "favicon_url": "https://www.google.com/s2/favicons?domain=codaaudio.com&sz=64", "selected": false },
      { "id": "9a2fad22-cb7b-4acc-919f-da37972d6bcd", "name": "NEXO", "domain": "nexo-sa.com",
        "url": "https://nexo-sa.com", "favicon_url": "https://www.google.com/s2/favicons?domain=nexo-sa.com&sz=64", "selected": false },
      { "id": "1fff4526-d922-4305-820b-6ef33d607c7d", "name": "RCF", "domain": "rcf.it",
        "url": "https://rcf.it", "favicon_url": "https://www.google.com/s2/favicons?domain=rcf.it&sz=64", "selected": false },
      { "id": "422b43a8-ec22-49d3-ae0f-7c893b22b4e0", "name": "Electro-Voice", "domain": "electrovoice.com",
        "url": "https://electrovoice.com", "favicon_url": "https://www.google.com/s2/favicons?domain=electrovoice.com&sz=64", "selected": false }
    ],
  
    /* Sieben Themen. Ohne Emoji, wie verlangt -- der farbige Koerper traegt die Unterscheidung.
       hex_light/hex_dark wie in der Themenverwaltung der App; wo sie fehlen, greift die Palette
       aus core. */
    topics: [
      { "id": "t-line-array",  "name": "Line Array Systems",
        "description": "Vertikal arraybare Systeme fuer grosse Flaechen",
        "hex_light": "#1b6eda", "hex_dark": "#1b6eda" },
      { "id": "t-touring",     "name": "Festival & Touring Sound",
        "description": "Open Air, Tourneen, wechselnde Spielstaetten",
        "hex_light": "#de1b22", "hex_dark": "#de1b22" },
      { "id": "t-club",        "name": "Club & Nightlife",
        "description": "Feste Installationen in Clubs und Bars",
        "hex_light": "#9145e8", "hex_dark": "#9145e8" },
      { "id": "t-spatial",     "name": "Spatial & Immersive Audio",
        "description": "Objektbasiertes Mischen, raeumliche Wiedergabe",
        "hex_light": "#107c84", "hex_dark": "#107c84" },
      { "id": "t-amps",        "name": "Amplifiers & Rigging",
        "description": "Endstufenracks, Traversen, Transporthardware",
        "hex_light": "#8d6a11", "hex_dark": "#8d6a11" },
      { "id": "t-efficiency",  "name": "Energy Efficiency",
        "description": "Wirkungsgrad, Leistungsbedarf, Nachhaltigkeit",
        "hex_light": "#108440", "hex_dark": "#108440" },
      { "id": "t-venues",      "name": "Arenas & Venues",
        "description": "Mehrzweckhallen, Theater, Arenen",
        "hex_light": "#d51a8b", "hex_dark": "#d51a8b" }
    ],
  
    /* Dreizehn Prompts. Die ersten vier sind wortgleich die aus der Aufgabe, nur mit topic_ids.
       Vier davon tragen ZWEI Themen -- genau der Fall, an dem die Gruppierung sich beweisen muss:
       jeder Prompt steht einmal, unter seinem ersten Thema, die uebrigen als Marken am Zeilenende. */
    prompts: [
      { "id": "p1",  "prompt_text": "beste Line-Array-Lautsprecher fuer Festivals und Arenatouren",
        "market": "DE", "selected": false, "topic_ids": ["t-line-array", "t-touring"] },
      { "id": "p2",  "prompt_text": "Welcher Pro-Audio-Hersteller bietet energieeffiziente Touring-PA-Systeme mit hoher Sprachverstaendlichkeit fuer Open-Air-Festivals?",
        "market": "DE", "selected": false, "topic_ids": ["t-efficiency", "t-touring"] },
      { "id": "p3",  "prompt_text": "Top Anbieter von raeumlichen Beschallungssystemen und Objekt-basiertem Mixing fuer Theater und Mehrzweckhallen in Europa",
        "market": "DE", "selected": false, "topic_ids": ["t-spatial", "t-venues"] },
      { "id": "p4",  "prompt_text": "vergleiche Hersteller von vertikal arraybaren Lautsprechersystemen und passenden Endstufenracks fuer grosse Konzertproduktionen",
        "market": "DE", "selected": false, "topic_ids": ["t-line-array", "t-amps"] },
      { "id": "p5",  "prompt_text": "welches Line-Array-System hat die beste Direktivitaetskontrolle bei langen Wurfweiten",
        "market": "DE", "selected": false, "topic_ids": ["t-line-array"] },
      { "id": "p6",  "prompt_text": "PA-System fuer ein Festival mit 20.000 Besuchern - welche Hersteller kommen infrage?",
        "market": "DE", "selected": false, "topic_ids": ["t-touring"] },
      { "id": "p7",  "prompt_text": "beste Clublautsprecher fuer elektronische Musik mit sauberem Tiefbass",
        "market": "DE", "selected": false, "topic_ids": ["t-club"] },
      { "id": "p8",  "prompt_text": "welche Beschallungsmarken werden in Technoclubs am haeufigsten verbaut?",
        "market": "DE", "selected": false, "topic_ids": ["t-club"] },
      { "id": "p9",  "prompt_text": "Loesungen fuer objektbasiertes Mischen in Theatern - Anbieter im Vergleich",
        "market": "DE", "selected": false, "topic_ids": ["t-spatial"] },
      { "id": "p10", "prompt_text": "welche Verstaerkerracks passen zu grossen Touring-Lautsprechersystemen?",
        "market": "DE", "selected": false, "topic_ids": ["t-amps"] },
      { "id": "p11", "prompt_text": "Lautsprecher mit hohem Wirkungsgrad - welche Hersteller brauchen am wenigsten Strom pro dB?",
        "market": "DE", "selected": false, "topic_ids": ["t-efficiency"] },
      { "id": "p12", "prompt_text": "Beschallungsanlage fuer eine Mehrzweckhalle - worauf kommt es bei der Auswahl an?",
        "market": "DE", "selected": false, "topic_ids": ["t-venues"] },
      { "id": "p13", "prompt_text": "welche Lautsprecherhersteller gelten als nachhaltig in der Veranstaltungstechnik?",
        "market": "DE", "selected": false, "topic_ids": ["t-efficiency"] }
    ],
  
    plans: [
      { "id": "54be31d2-dc61-4a5e-8ea0-31c4370a4cb3", "name": "Essential",
        "monthly_price_eur": 89.00, "yearly_price_eur": 948.00,
        "prompts_per_day": 50, "competitors_max_active": 5, "trial_days": 30, "sort_order": null },
      { "id": "3129be58-d59a-4221-ba53-7b2e4131cf5f", "name": "Professional",
        "monthly_price_eur": 205.00, "yearly_price_eur": 2220.00,
        "prompts_per_day": 150, "competitors_max_active": 10, "trial_days": 30, "sort_order": null },
      { "id": "a980c741-807e-43dd-9617-8e06b82999ba", "name": "Enterprise",
        "monthly_price_eur": 429.00, "yearly_price_eur": 4380.00,
        "prompts_per_day": 350, "competitors_max_active": 15, "trial_days": 30, "sort_order": null }
    ]
  };

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
  var MAX = { name: 60, website: 255, industry: 60 };

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
  function eigeneZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; }
  }
  /* Der Markt aus dem Browser. Die Sprache traegt die Region ("de-DE" -> DE) und ist verlaesslicher
     als die Zeitzone, in der halb Europa unter Europe/Berlin steht. Findet sich nichts, ist DE
     die Vorgabe -- so steht es in der Aufgabe. */
  function eigenerMarkt() {
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
    var demo = istJa(attr("data-demo"));

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
      plan: "", interval: "yearly",
      /* Einmal beim Tarif gewesen heisst: der Punkt bleibt in der Schiene. Siehe renderRail. */
      planGesehen: false,
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
          '<button class="uob-link" type="button" data-exit="dashboard">' + ic("home", 1.8) + 'Dashboard</button>' +
          '<button class="uob-link" type="button" data-exit="logout">' + ic("logOut", 1.8) + 'Log out</button>' +
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
            ? '<div class="uob-ddcustom">' +
                '<span class="up-ddsearch" data-dd-searchwrap>' +
                  '<input class="up-ddsearch-in" type="text" maxlength="' + MAX.industry + '" ' +
                    'placeholder="Not listed? Add your own" autocomplete="off" spellcheck="false" ' +
                    'aria-label="Add your own" data-dd-custom/>' +
                  '<span class="up-ddsearch-ic">' + ic("plus", 2) + '</span>' +
                  '<button class="up-ddsearch-x" type="button" aria-label="Clear" data-dd-clear>' +
                    ic("x", 3.5) + '</button>' +
                '</span>' +
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
              '<input class="uob-input up-field" id="' + instanceId + '-web" type="text" ' +
                'maxlength="' + MAX.website + '" placeholder="yourbrand.com" autocomplete="url" ' +
                'inputmode="url" data-f="website"/>' +
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
                BUSINESS.map(function (b) {
                  return '<button class="up-seg-btn" type="button" role="tab" aria-selected="false"' +
                         ' data-biz="' + esc(b.value) + '">' + esc(b.label) + '</button>';
                }).join("") +
              '</div>' +
              '<div class="uob-err"><span data-err="business"></span></div>' +
            '</div>' +
            /* Die Branche kommt erst, wenn das Geschaeftsmodell steht -- siehe CSS. */
            '<div class="uob-field uob-later" data-field="industry" data-later="industry">' +
              '<div class="uob-later-in">' +
                '<span class="uob-labrow"><span class="uob-label">Industry</span>' +
                  '<span class="uob-opt">Optional</span></span>' +
                selectHtml("industry", "Select an industry", "Industries", true, true) +
              '</div>' +
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
                      return '<span class="uob-tl-tag">' +
                        '<span class="uob-tl-dot" style="background:' + esc(farbeVon(t)) + '"></span>' +
                        esc(t.name) + '</span>';
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
             "Topics group the questions we ask the models. Pick the ones you want to be found for.",
             { text: n + " selected", voll: n > 0 }) +
        '<div class="uob-body">' +
          (state.topics.length
            ? '<div class="uob-list up-scroll" role="group" aria-label="Topics">' +
                state.topics.map(function (t) {
                  var an = !!state.selTopics[t.id];
                  return '<button class="uob-item is-slim' + (an ? " is-on" : "") + '" type="button" role="checkbox"' +
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
              '</div>'
            : '<p class="uob-sub" style="margin-top:18px">No topics yet.</p>') +
        '</div>' +
      '</div>';
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
                    '</div>' +
                    '<div class="uob-group-items is-cols">' +
                      g.items.map(function (it) {
                        var an = !!state.selPrompts[it.p.id];
                        return '<button class="uob-item is-multiline' + (an ? " is-on" : "") + '" type="button"' +
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
        kopf("Choose your plan", "Every plan starts with a free trial. No charge until it ends.") +
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
                var tage = num(pl.trial_days);
                /* Empfohlen ist die MITTLERE Karte. Nicht die teuerste, und nicht per Feld aus
                   den Daten: dort gibt es keins, und ein erfundenes waere eine Behauptung. */
                var empfohlen = state.plans.length === 3 && i === 1;
                return '<button class="uob-plan' + (an ? " is-on" : "") + '" type="button" role="radio"' +
                         ' aria-checked="' + (an ? "true" : "false") + '" data-plan="' + esc(pl.id) + '">' +
                  (empfohlen ? '<span class="uob-plan-tag">Most popular</span>' : "") +
                  '<span class="uob-plan-h"><span class="uob-plan-name">' + esc(pl.name) + '</span></span>' +
                  '<span class="uob-plan-price">' +
                    '<span class="uob-plan-amt">' + esc(geld(zeigMon)) + '</span>' +
                    '<span class="uob-plan-per">/ month</span>' +
                  '</span>' +
                  '<span class="uob-plan-note' + (jaehrlich && spar ? " is-on" : "") + '"><span>' +
                    (spar ? "Save " + spar + "% billed yearly" : "") + '</span></span>' +
                  '<span class="uob-plan-feats">' +
                    feat("<b>" + esc(String(pl.prompts_per_day)) + "</b> prompts per day") +
                    feat("<b>~" + esc(zahl(antworten(pl))) + "</b> AI responses per month") +
                    feat("<b>" + esc(String(pl.competitors_max_active)) + "</b> tracked competitors") +
                    feat("Choose the <b>LLM models</b> to track") +
                    feat("<b>Unlimited</b> seats") +
                    feat("<b>Every</b> location and language") +
                    feat(hilfe(pl)) +
                    feat(tage ? "<b>" + tage + " days</b> free, cancel anytime" : "Cancel anytime") +
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

    function feat(html) { return '<span class="uob-plan-feat">' + ic("check", 2.6) + '<span>' + html + '</span></span>'; }
    /* Die Zahl der Antworten je Monat. Liefert der Tarif sie selbst mit, gilt seine -- sonst
       gerechnet aus Prompts je Tag mal dreissig. Gerechnet und nicht getippt, damit sie beim
       naechsten Preisblatt nicht als einzige stehenbleibt.
       ACHTUNG: die Rechnung nimmt EIN Modell je Prompt an. Werden mehrere Modelle je Prompt
       abgefragt, ist die echte Zahl ein Vielfaches davon -- dann gehoert ai_responses_per_month
       in den Payload, und diese Zeile ruehrt sich nicht mehr. */
    function antworten(pl) {
      var eigen = num(pl.ai_responses_per_month);
      if (eigen != null) return eigen;
      var proTag = num(pl.prompts_per_day);
      return proTag == null ? null : proTag * 30;
    }
    function zahl(v) {
      if (v == null) return "–";
      /* Tausenderpunkte, aber ohne Gebietsschema: die Seite ist englisch, also Kommas. */
      return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    /* Der Support waechst mit dem Tarif. Er steht NICHT in den Daten -- solange das so ist,
       haengt er an der Position, und das ist eine Annahme: pruefen und gegebenenfalls ein Feld
       support_level in den Payload aufnehmen. */
    function hilfe(pl) {
      var eigen = txt(pl.support_level);
      if (eigen) return "<b>" + esc(eigen) + "</b> support";
      var i = state.plans.indexOf(pl);
      if (i <= 0) return "<b>Email</b> support";
      if (i === 1) return "<b>Priority</b> support";
      return "<b>Dedicated</b> support";
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
      /* Kein Farbwert dabei: aus der Themenpalette von core, stabil nach der Position -- so
         bekommt dasselbe Thema bei jedem Aufbau denselben Ton. */
      var pal = UC.TOPIC_COLOR_PALETTE || [];
      if (!pal.length) return "";
      var i = 0;
      for (var k = 0; k < state.topics.length; k++) if (state.topics[k].id === t.id) { i = k; break; }
      return pal[i % pal.length];
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
                   competitors: "880px", topics: "620px", prompts: "880px", plan: "940px" };

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

        var gesperrt = n === 0 && brandGesperrt;
        dots[n].classList.toggle("is-done", fertig || (n <= state.maxErreicht && n !== i));
        dots[n].classList.toggle("is-now", !wartet && n === i);
        dots[n].classList.toggle("is-locked", gesperrt);

        var klickbar = !wartet && !gesperrt && n !== i && n <= state.maxErreicht;
        if (hits[n]) {
          hits[n].classList.toggle("is-link", klickbar);
          hits[n].disabled = !klickbar;
          hits[n].tabIndex = klickbar ? 0 : -1;
        }
        if (labels[n]) {
          labels[n].classList.toggle("is-done", n <= state.maxErreicht && n !== i);
          labels[n].classList.toggle("is-now", !wartet && n === i);
          labels[n].classList.toggle("is-locked", gesperrt);
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
      if (elRailFill) {
        elRailFill.style.width = breite + "%";
        /* Der Verlauf im gefuellten Teil: stumpf am Anfang, voll ab Competitors -- aber nur,
           solange Brand gesperrt ist. Die Umrechnung geht auf die Breite der FUELLUNG, nicht auf
           die der Schiene: ein Verlauf misst sich an seinem eigenen Kasten. */
        var bis = breite > 0 ? Math.min(100, (100 / letzte) / breite * 100) : 0;
        elRailFill.style.setProperty("--uob-grau", (brandGesperrt ? bis : 0) + "%");
        elRailFill.style.setProperty("--uob-grauton", brandGesperrt ? "var(--vc-sk)" : "var(--vc-text)");
      }
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
      elBack.classList.toggle("is-hidden", i <= 0);
      elNext.classList.toggle("is-busy", state.busy);
      elNext.disabled = state.busy || (state.step === "plan" && !state.plan);

      var texte = { brand: "Continue", competitors: "Continue", topics: "Continue",
                    prompts: "Continue", plan: "Start free trial" };
      elNextTxt.textContent = texte[state.step] || "Continue";

      /* Ueberspringen erscheint nur dort, wo wirklich nichts ausgewaehlt ist -- sobald jemand
         etwas angeklickt hat, waere "Skip" das falsche Wort fuer das, was der Klick tut. */
      var alt = elNav.querySelector("[data-skip]");
      var zeigen = (state.step === "competitors" && !anzahl(state.selBrands)) ||
                   (state.step === "topics" && !anzahl(state.selTopics)) ||
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
        window.setTimeout(function () { el.classList.add("is-on"); }, 120 + i * 140);
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
      /* Die Branche steht immer da. Sie war eine Zeit lang eingeklappt, bis das
         Geschaeftsmodell angefasst wurde -- zurueckgenommen: mit B2B als Vorbelegung ist die
         Frage davor bereits beantwortet, und ein Feld, das erst nach einem Klick auf eine schon
         getroffene Wahl erscheint, wirkt wie ein Fehler. Die Klasse bleibt im Markup, damit die
         Staffelung ohne Umbau wieder eingeschaltet werden kann. */
      var spaet = root.querySelector('[data-later="industry"]');
      if (spaet) spaet.classList.add("is-on");
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
          return { value: z, label: z.replace(/_/g, " "), kurz: z.replace(/_/g, " "),
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
              if (!w.classList.contains("is-open")) menu.classList.add("is-flat");
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

    /* Eigene Branche: Enter im Zusatzfeld uebernimmt sie. Kein Add-Knopf daneben -- ein Feld mit
       genau einer moeglichen Handlung braucht keinen zweiten Bedienpunkt. */
    root.addEventListener("keydown", function (e) {
      var c = e.target.closest ? e.target.closest("[data-dd-custom]") : null;
      if (c && e.key === "Enter") {
        e.preventDefault();
        var v = txt(c.value);
        if (!v) return;
        state.form.industry = v;
        c.value = "";
        ddFuellen(c.closest(".uob-ddwrap"));
        ddSchliessen(null);
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
        if (MAX[f] && String(e.target.value).length >= MAX[f]) {
          state.fehler[f] = "Maximum of " + MAX[f] + " characters reached.";
        } else if (state.fehler[f]) {
          delete state.fehler[f];
        }
        zeigeFeldfehler();
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
      renderNav();
      fire("data-select-fn", "uobSelect",
        { kind: kind, ids: idsVon(topf).join(","), count: anzahl(topf) });
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
        var n = normUrl(state.form.website);
        state.form.website = n.url;
        setzeFormWerte();
        state.banner = "";
        warteStarten("main");
        fire("data-start-fn", "uobStart", {
          brand_name: txt(state.form.name),
          website_input: txt(state.form.website),
          website_url: n.url,
          website_domain: n.domain,
          market: txt(state.form.market),
          timezone: txt(state.form.timezone),
          business_model: txt(state.form.business),
          brand_industry: txt(state.form.industry)
        });
        if (demo) demoLauf1();
        return;
      }
      if (state.step === "competitors") { gehe("topics"); return; }
      if (state.step === "topics") {
        /* Die Themenauswahl ist der Anstoss fuer die Prompts -- deshalb ein eigenes Ereignis und
           nicht nur uobStep: der Workflow dahinter tut etwas, das dauert. */
        warteStarten("prompts");
        fire("data-topics-fn", "uobTopics",
          { topic_ids: idsVon(state.selTopics).join(","), count: anzahl(state.selTopics) });
        if (demo) demoLauf2();
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
    var uhr = null, tick = null, t0 = 0;
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
      if (uhr) { window.clearTimeout(uhr); uhr = null; }
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

    /* ---- Demo -------------------------------------------------------------------------------
       Feste Uhren: fuenf Sekunden je Phase, also zwanzig fuer den ersten Lauf, spaeter zehn.
       Sie ersetzen den Statuspayload NICHT -- kommt einer, gewinnt er (siehe setStatus).
       Die Daten stehen oben in dieser Datei (DEMO_DATEN); es ist nichts nachzuladen. */
    var DEMO_PHASE_MS = 5000;
    var DEMO_PROMPT_MS = 10000;
    /* Ein von aussen gesetztes window.__uobDemo gewinnt -- so laesst sich der Demobetrieb mit
       anderen Daten fuettern, ohne diese Datei anzufassen. Ohne das steht der eingebaute Block
       bereit, und der ist immer da. */
    var DEMO = window.__uobDemo || DEMO_DATEN;
    function demoLauf1() {
      var i = 0;
      (function schritt() {
        uhr = window.setTimeout(function () {
          i++;
          if (i >= PHASES.length) {
            if (DEMO && DEMO.project) ctrl.setProject(DEMO.project);
            if (DEMO && DEMO.brands) ctrl.setBrands(DEMO.brands);
            if (DEMO && DEMO.topics) ctrl.setTopics(DEMO.topics);
            state.fortschritt = 100; renderPhasen();
            window.setTimeout(function () { warteBeenden(); gehe("competitors"); }, 360);
            return;
          }
          phaseSetzen(i);
          schritt();
        }, DEMO_PHASE_MS);
      })();
    }
    function demoLauf2() {
      uhr = window.setTimeout(function () {
        if (DEMO && DEMO.prompts) ctrl.setPrompts(DEMO.prompts);
        state.fortschritt = 100; renderPhasen();
        window.setTimeout(function () { warteBeenden(); gehe("prompts"); }, 360);
      }, DEMO_PROMPT_MS);
    }

    /* ---- Breite ------------------------------------------------------------------------------
       Zwei Stufen: unter 760px stapelt alles, unter 460px wird es noch enger. Gemessen an der
       Wurzel und nicht am Fenster, weil diese Seite in Bubble in einem Element steckt. */
    function messeBreite() {
      var w = root.clientWidth;
      root.classList.toggle("is-narrow", w < 760);
      root.classList.toggle("is-vnarrow", w < 460);
      /* Die Beschriftungen der Schiene haengen an der Breite und nicht am Zustand -- ohne diese
         Zeile wurde nur beim Zeichnen geprueft, und ein blosses Ziehen am Fensterrand liess eine
         Reihe stehen, die laengst nicht mehr passte. */
      labelsPruefen(sichtbareSteps().length);
    }
    messeBreite();
    if (UC.onResize) UC.onResize(root, messeBreite);
    else window.addEventListener("resize", messeBreite);

    /* ---- Zurueck-Taste des Browsers ---------------------------------------------------------- */
    window.addEventListener("popstate", function () {
      var k = stepAusUrl();
      if (k && k !== state.step) { state.step = k; state.warten = ""; render(); }
    });

    /* ---- Aussenschnittstelle ------------------------------------------------------------------ */
    var ctrl = {
      instanceId: instanceId,
      setProject: function (payload) {
        var p = UC.parseLoose ? UC.parseLoose(payload, "onboarding project") : payload;
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
        var p = UC.parseLoose ? UC.parseLoose(payload, "onboarding status") : payload;
        if (!p || typeof p !== "object") return false;
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
        var p = UC.parseLoose ? UC.parseLoose(payload, "onboarding plans") : payload;
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
        state.selBrands = {}; state.selTopics = {}; state.selPrompts = {};
        state.plan = ""; state.banner = ""; state.busy = false;
        state.fehler = {}; state.maxErreicht = 0; state.planGesehen = false;
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
      var p = UC.parseLoose ? UC.parseLoose(payload, "onboarding " + welche) : payload;
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
        if (r.selected === true || txt(r.selected) === "yes") {
          (welche === "brands" ? state.selBrands : welche === "topics" ? state.selTopics : state.selPrompts)[id] = true;
        }
      }
      state[welche] = rein;
      render(true);
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

    if (demo && DEMO) {
      /* Im Demobetrieb sind Tarife von Anfang an da -- sie haengen an keinem Lauf. Marken,
         Themen und Prompts kommen dort an, wo sie auch echt ankaemen: nach ihrer Uhr. */
      if (DEMO.plans) ctrl.setPlans(DEMO.plans);
      /* Wer per Adresse mitten im Ablauf einsteigt, braucht die Daten dieses Schritts sofort --
         sonst steht er vor einer leeren Liste, obwohl er schon weiter war. */
      if (ausUrl && ausUrl !== "brand") {
        if (DEMO.project) ctrl.setProject(DEMO.project);
        if (DEMO.brands) ctrl.setBrands(DEMO.brands);
        if (DEMO.topics) ctrl.setTopics(DEMO.topics);
        if (ausUrl === "prompts" || ausUrl === "plan") { if (DEMO.prompts) ctrl.setPrompts(DEMO.prompts); }
        state.step = ausUrl;
        render();
      }
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
