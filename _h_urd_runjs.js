/* STATISCHER START fuer response-detail -- Run-JS im Pageload-Workflow.
   VOLLSTAENDIG: der Antworttext steht ausgeschrieben, die Quellen wortgleich. Keine Platzhalter.
   Unveraendert getestet -- was hier steht, ist genau das, was gemessen wurde.

   google-aio-Payload: zwei Marken in companies (Anfragenfluss und LeeUP Media), beide auch im
   Antworttext ausgezeichnet, Mentions an zwei der elf Quellen. Die Fussnotenliste am Ende des
   Textes bleibt drin -- die Komponente entfernt sie selbst, weil der Abschnitt "Citations"
   dieselben Quellen schon als Karten zeigt.

   LIVE wird DATEN gegen den Bubble-Ausdruck getauscht, mit den zwei Sanitizer-Zeilen (§46). */
(function(){
  var INSTANCE_ID = "response_detail_page";

  /* Ohne den Modell-Store steht im Chip der rohe Schluessel "google-aio" ohne Logo. Laeuft
     setUpstreemModels schon woanders auf der Seite, kann dieser Block weg. */
  var MODELLE = [
    { key: "chatgpt",    display_name: "ChatGPT",
      logo_url: "https://cdn-icons-png.freepik.com/512/12222/12222588.png" },
    { key: "google-aio", display_name: "Google AI Overviews", short_name: "Google AIO",
      logo_url: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" },
    { key: "perplexity", display_name: "Perplexity",
      logo_url: "https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64" }
  ];

  /* Der Antworttext. Ein Absatz je Zeile, damit der Block kopierbar bleibt -- eine einzige
     3789 Zeichen lange Zeile bricht beim Einfuegen und ist danach kaputt. */
  var TEXT =
        "Führende Anbieter für digitale Marketing- und Vertriebslösungen im Solarbereich lassen sich in spezialisierte Agenturen für exklusive Leadgenerierung (wie AnfragenflussAurora Solar im Einsatz bei E.ON) und Full-Service-Kommunikationsagenturen (wie 4iMEDIA) unterteilen. Sie unterstützen Handwerker, Solarteure und Konzerne bei Kundengewinnung und Markenaufbau. [0](https://www.pv-magazine.de/unternehmensmeldungen/e-on-deutschland-setzt-auf-aurora-solar-fuer-digitale-pv-planung/) [3](https://www.google.com/searchviewer/10?svid=CAwSHRIbCgNwdnESFENnMHZaeTh4TVdJMWNHbzRhbDkzGAo) [4](https://www.4imedia.com/solar/)\n" +
        "\n" +
        "Anfragenfluss: Starker Fokus auf exklusive, telefonisch vorqualifizierte Photovoltaik-Leads und feste Vertriebstermine im DACH-Raum.\n" +
        "\n" +
        "Digital030: Bietet KI-Qualifizierung, Google Ads und automatisierte Terminbuchungen speziell für Solar- und Energiebetriebe.\n" +
        "\n" +
        "LeeUP Media: Konzentriert sich auf Digitalisierung, Online-Marketing und Recruiting für Handwerks- und Solarbetriebe.\n" +
        "\n" +
        "Adsway: Spezialisiert auf planbare PV- und Wärmepumpen-Anfragen sowie Performance-Optimierung. [2](https://www.digital030.de/branchen/solar-energie) [5](https://anfragenfluss.de/neuigkeiten/beste-agentur-photovoltaik-leads) [6](https://www.lee-up.de/solar) [7](https://www.adsway.de/)\n" +
        "\n" +
        "## Software & Digitale Vertriebs-/Planungslösungen\n" +
        "\n" +
        "Aurora Solar: Bietet marktführende Software für die digitale Live-Planung und den Vertrieb von Photovoltaikanlagen (u. a. von Großkonzernen wie E.ON genutzt).\n" +
        "\n" +
        "OpenSolar: Stellt neben Design-Tools auch direkte Marketing-Services für PV-Marken bereit. [0](https://www.pv-magazine.de/unternehmensmeldungen/e-on-deutschland-setzt-auf-aurora-solar-fuer-digitale-pv-planung/) [8](https://www.opensolar.com/de/marketing-dienstleistungen/)\n" +
        "\n" +
        "## Full-Service-PR- und Kommunikationsagenturen\n" +
        "\n" +
        "4iMEDIA: Bietet branchenspezifische Komplettlösungen von SEO und Content-Marketing bis hin zu Social-Media-Kampagnen für Solarunternehmen.\n" +
        "\n" +
        "Gruppe Drei: Kommunikationsagentur mit ausgewiesenem Schwerpunkt auf den Bereich GreenTech und Nachhaltigkeit. [9](https://www.gruppedrei.com/aktuelles/marketing-greentech/) [4](https://www.4imedia.com/solar/) [10](https://www.4imedia.com/solar/marketing-agentur-solar-pv-full-service/)\n" +
        "\n" +
        "Suchen Sie eher nach einer Performance-Agentur für die Kundengewinnung (Leads) oder nach Software-Tools für die technische Vertriebsplanung Ihrer Solaranlagen?\n" +
        "\n" +
        "[[0] - E.ON Deutschland setzt auf Aurora Solar für digitale PV-Planung](https://www.pv-magazine.de/unternehmensmeldungen/e-on-deutschland-setzt-auf-aurora-solar-fuer-digitale-pv-planung/)\n" +
        "[[1] - Wie Solarunternehmen mit Software mehr Aufträge gewinnen](https://enact.solar/digitale-tools-echte-ergebnisse-wie-solarunternehmen-mit-software-mehr-auftrage-gewinnen/)\n" +
        "[[2] - Marketing Agentur Solar & Energie Berlin - Digital030](https://www.digital030.de/branchen/solar-energie)\n" +
        "[[3] - SOLAR-professionell](https://www.google.com/searchviewer/10?svid=CAwSHRIbCgNwdnESFENnMHZaeTh4TVdJMWNHbzRhbDkzGAo)\n" +
        "[[4] - Solar | PR, Werbung, Web – Marketing-Experten für Photovoltaik](https://www.4imedia.com/solar/)\n" +
        "[[5] - Beste Agentur für Photovoltaik-Leads: 7 Kriterien - Anfragenfluss](https://anfragenfluss.de/neuigkeiten/beste-agentur-photovoltaik-leads)\n" +
        "[[6] - Marketing für Solarbetriebe - LeeUP Media GmbH](https://www.lee-up.de/solar)\n" +
        "[[7] - Adsway: Planbare PV- & Wärmepumpen- Anfragen aus der ...](https://www.adsway.de/)\n" +
        "[[8] - Marketing Service - OpenSolar](https://www.opensolar.com/de/marketing-dienstleistungen/)\n" +
        "[[9] - Wir sind die Marketing-Agentur für Greentech & Nachhaltigkeit](https://www.gruppedrei.com/aktuelles/marketing-greentech/)\n" +
        "[[10] - Marketing für Solar & PV: Spezialisierte Full Service Agentur](https://www.4imedia.com/solar/marketing-agentur-solar-pv-full-service/)";

  /* Die RPC liefert eine Liste mit einem Eintrag -- genau so wird sie weitergegeben. */
  var DATEN = [{
    prompt_run_id: "f052a30f-0b42-4fb9-a672-2bf797ff42e5",
    id: "f052a30f-0b42-4fb9-a672-2bf797ff42e5",
    run_at: "2026-08-18T14:04:32.103284+00:00",
    run_day: "2026-08-18",
    model: "google-aio",
    model_detailed: "searchapi-google_ai_overview+websearch",
    prompt_id: "e6784605-2649-418c-92be-6b6e14abc919",
    prompt_text: "wer sind die f\u00fchrenden Anbieter f\u00fcr digitale Marketingl\u00f6sungen im Bereich Solar?",
    market: "DE",
    tags: [
      { id: "3001e901-d2f2-4662-984e-a4d5e54bb9b7", name: "Digitalisierung", emoji: null,
        hex_light: "#2563eb", hex_dark: "#7ea8f8" },
      { id: "9dbcfa97-f327-4a92-a95f-a6adff2a46a5", name: "Marketing", emoji: null,
        hex_light: "#db2777", hex_dark: "#f27bb0" },
      { id: "2e29b676-3e9b-485a-8821-de01c34281fd", name: "Solar", emoji: null,
        hex_light: "#f59e0b", hex_dark: "#fbc55a" }
    ],
    response_json: {
      meta: { run_key: "962ed0083a526434ee1a178ac7-fa1bba5ef",
              model_start_iso: "2026-08-18T14:04:18.373+00:00" },
      text: TEXT
    },
    companies: [
      { name: "Anfragenfluss", rank: 1, sentiment: 77,
        company_id: "fd2f56a4-d11d-45a3-b10e-bd93a249b75f",
        favicon_url: "https://www.google.com/s2/favicons?domain=anfragenfluss.de&sz=64",
        brand_name_raw: "Anfragenfluss" },
      { name: "LeeUp Media", rank: 6, sentiment: 57,
        company_id: "88640dff-6468-471a-bee4-6c17d2ed0399",
        favicon_url: "https://www.google.com/s2/favicons?domain=lee-up.de&sz=64",
        brand_name_raw: "LeeUP Media" }
    ],
    citations:
    [
      {
        "url": "https://anfragenfluss.de/neuigkeiten/beste-agentur-photovoltaik-leads",
        "title": "Beste Agentur für Photovoltaik-Leads: 7 Kriterien · Anfragenfluss",
        "domain": "anfragenfluss.de",
        "favicon": "https://www.google.com/s2/favicons?domain=anfragenfluss.de&sz=128",
        "mentions": [
          {
            "name": "Anfragenfluss",
            "role": "competitor",
            "count": 1,
            "company_id": "fd2f56a4-d11d-45a3-b10e-bd93a249b75f",
            "match_type": null,
            "favicon_url": "https://www.google.com/s2/favicons?domain=anfragenfluss.de&sz=64"
          }
        ],
        "description": "Woran erkennst du die beste Agentur für Photovoltaik-Leads? 7 Prüfkriterien, typische Red Flags und der Fragenkatalog fürs Erstgespräch, ehrlich erklärt für…"
      },
      {
        "url": "https://enact.solar/digitale-tools-echte-ergebnisse-wie-solarunternehmen-mit-software-mehr-auftrage-gewinnen",
        "title": "Digitale Tools, echte Ergebnisse: Wie Solarunternehmen mit Software mehr Aufträge gewinnen | ENACT",
        "domain": "enact.solar",
        "favicon": "https://www.google.com/s2/favicons?domain=enact.solar&sz=128",
        "mentions": [],
        "description": "Digitale Tools, echte Ergebnisse: Wie Solarunternehmen mit Software mehr Aufträge gewinnen | ENACT — title: \"Digitale Tools, echte Ergebnisse: Wie Sol..."
      },
      {
        "url": "https://www.4imedia.com/solar",
        "title": "Solar | PR, Werbung, Web – Marketing-Experten für Photovoltaik",
        "domain": "4imedia.com",
        "favicon": "https://www.google.com/s2/favicons?domain=4imedia.com&sz=128",
        "mentions": [],
        "description": "Als Experten für Marketing, PR &amp; Online Werbung in den Bereichen Solar und Photovoltaik unterstützen wir Sie in allen Bereichen der Kommunikation"
      },
      {
        "url": "https://www.4imedia.com/solar/marketing-agentur-solar-pv-full-service",
        "title": "Marketing für Solar & PV: Spezialisierte Full Service Agentur",
        "domain": "4imedia.com",
        "favicon": "https://www.google.com/s2/favicons?domain=4imedia.com&sz=128",
        "mentions": [],
        "description": "Erfolgreiches Marketing für Solar- &amp; PV-Unternehmen. Unsere Full-Service-Agentur steigert Bekanntheit, Image und Absatz. Digital und Print."
      },
      {
        "url": "https://www.adsway.de/",
        "title": "Adsway: Planbare PV- & Wärmepumpen- Anfragen aus der Region",
        "domain": "adsway.de",
        "favicon": "https://www.google.com/s2/favicons?domain=adsway.de&sz=128",
        "mentions": [],
        "description": "Generieren Sie planbar hochwertige PV- und Wärmepumpen-Anfragen. Adsway bietet Solarbetrieben nachhaltiges Wachstum durch qualifizierte Leads und Optimierung."
      },
      {
        "url": "https://www.digital030.de/branchen/solar-energie",
        "title": "Marketing Agentur Solar & Energie Berlin | Digital030",
        "domain": "digital030.de",
        "favicon": "https://www.google.com/s2/favicons?domain=digital030.de&sz=128",
        "mentions": [],
        "description": "Mehr Solar-Leads für Ihr Unternehmen. KI-Qualifizierung, Google Ads &amp; automatisierte Terminbuchung für Solarunternehmen in Berlin &amp; Brandenburg."
      },
      {
        "url": "https://www.google.com/searchviewer/10?svid=CAwSHRIbCgNwdnESFENnMHZaeTh4TVdJMWNHbzRhbDkzGAo",
        "title": "https://www.google.com/searchviewer/10?svid=CAwSHRIbCgNwdnESFENnMHZaeTh4TVdJMWNHbzRhbDkzGAo",
        "domain": "google.com",
        "favicon": "https://www.google.com/s2/favicons?domain=google.com&sz=128",
        "mentions": [],
        "description": "https://www.google.com/searchviewer/10?svid=CAwSHRIbCgNwdnESFENnMHZaeTh4TVdJMWNHbzRhbDkzGAo — title: \"Place Viewer\" SOLAR professionell 4,0 (1) Rezens..."
      },
      {
        "url": "https://www.gruppedrei.com/aktuelles/marketing-greentech",
        "title": "Greentech Marketing Agentur für nachhaltiges Wachstum",
        "domain": "gruppedrei.com",
        "favicon": "https://www.google.com/s2/favicons?domain=gruppedrei.com&sz=128",
        "mentions": [],
        "description": "Marketing für Greentech &amp; Nachhaltigkeit: Wir machen Technologien verständlich, stärken Marken und schaffen messbaren Vertriebserfolg."
      },
      {
        "url": "https://www.lee-up.de/solar",
        "title": "LeeUP Media GmbH - Marketing für Solarbetriebe",
        "domain": "lee-up.de",
        "favicon": "https://www.google.com/s2/favicons?domain=lee-up.de&sz=128",
        "mentions": [
          {
            "name": "LeeUp Media",
            "role": "own",
            "count": 1,
            "company_id": "88640dff-6468-471a-bee4-6c17d2ed0399",
            "match_type": null,
            "favicon_url": "https://www.google.com/s2/favicons?domain=lee-up.de&sz=64"
          }
        ],
        "description": "LeeUP Media GmbH - Marketing für Solarbetriebe — title: \"LeeUP Media GmbH Marketing für Solarbetriebe\" meta: \"og:title\": \"LeeUP Media GmbH Marketing f..."
      },
      {
        "url": "https://www.opensolar.com/de/marketing-dienstleistungen",
        "title": "OpenSolar Marketing Dienstleistungen: Erhöhen Sie die Reichweite Ihrer PV-Marke",
        "domain": "opensolar.com",
        "favicon": "https://www.google.com/s2/favicons?domain=opensolar.com&sz=128",
        "mentions": [],
        "description": "Stärken Sie Ihre PV-Marke mit den Marketing-Services von OpenSolar. Werden Sie in Angeboten erwähnt, nutzen Sie Anzeigenservices und erhalten Sie datengestützte Einblicke."
      },
      {
        "url": "https://www.pv-magazine.de/unternehmensmeldungen/e-on-deutschland-setzt-auf-aurora-solar-fuer-digitale-pv-planung",
        "title": "E.ON Deutschland setzt auf Aurora Solar für digitale PV-Planung - pv magazine Deutschland",
        "domain": "pv-magazine.de",
        "favicon": "https://www.google.com/s2/favicons?domain=pv-magazine.de&sz=128",
        "mentions": [],
        "description": "- Start der Zusammenarbeit bei klarsolar, einer Solar-Tochter von E.ON Deutschland, anschließend Rollout auf weitere PV-Tochtergesellschaften. - Klarsolar setzt Software von Aurora entlang der gesamten Customer Journey ein: in der Live‑Planung als Teil der Beratung digital oder vor Ort und in der technischen Planung inkl. Schaltplan - Ziel ist maximale Schnelligkeit bei noch stärkerem Einbezug von Kundinnen und Kunden in die PV-Planung"
      }
    ]
  }];

  /* Die Setter sind Boot-Stubs, solange response-detail.js noch laedt -- ein Aufruf landet dann
     in der Warteschlange und wird nachgeholt. Fehlen sie GANZ, ist das Element noch nicht gebaut:
     dann in 100ms-Schritten warten, hoechstens 6 Sekunden, und danach EINMAL sagen warum. */
  var versuche = 0;
  (function los(){
    if (typeof window.setResponseDetail === "function") {
      if (typeof window.setUpstreemModels === "function") window.setUpstreemModels(JSON.stringify(MODELLE));
      window.setResponseDetail(INSTANCE_ID, JSON.stringify(DATEN));
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[response-detail] setResponseDetail gibt es nach 6s nicht. " +
      "Steht das HTML-Element auf der Seite, ist es sichtbar, und stimmt data-cdn-pin?");
  })();
})();
