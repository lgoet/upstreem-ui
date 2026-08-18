/* SCHRITT 2 von 2 -- die URL-Serie fuer den Domain-Share. GENAU so, wie er in Bubble steht.
   WOHIN: in die Workflows hinter den Ereignissen uddMode, uddScope und uddGran. Alle drei fragen
   dieselben Daten mit anderen Parametern, also ist es EIN Schritt, dreimal eingehaengt. */
(function(){
  var INSTANCE_ID = "domain_detail_page";

  /* LIVE: hier die drei Werte aus dem Ereignis-JSON einsetzen (der Toolbox-Wert von uddMode /
     uddScope / uddGran, Feld "mode", "scope", "gran"). STATISCH: vom Umschalter der Komponente
     gelesen, damit Global und Domain unterschiedliche Kurven zeigen -- ohne das sieht der
     Schalter aus, als tue er nichts. */
  var el = document.querySelector('.udd-root[data-instance="' + INSTANCE_ID + '"] [data-scope].is-active');
  var SCOPE = el ? el.getAttribute("data-scope") : "global";

  /* Je URL: Adresse, Titel, Gesamtanteil global, Gesamtanteil innerhalb der Domain. */
  var TITEL = [
    ["https://www.youtube.com/watch?v=hFrdQNb0920", "So arbeiten die besten Handwerksbetriebe wirklich - YouTube", 5.2980, 30.0000],
    ["https://www.youtube.com/watch?v=c6uXUxbeOL0", "Handwerkersoftware-Vergleich 2026: Wie gut sind Streit, Bosc", 3.5872, 20.3125],
    ["https://www.youtube.com/watch?v=T-fOIKFC1zQ", "Lohnt sich die Handwerkersoftware PlanCraft fuer Handwerker i", 2.2627, 12.8125],
    ["https://www.youtube.com/watch?v=GF-TG-z3rUo", "5 Automatisierungen zum Zeit sparen fuer Handwerks-, Bau- & I", 1.9316, 10.9375],
    ["https://www.youtube.com/watch?v=PVbt_rWnh68", "Welche Handwerkersoftware ist die Beste fuer dich? Handwerker", 1.8212, 10.3125]
  ];
  /* Tagesanteile GLOBAL: Prozent aller Zitationen des Tages. */
  var TAGE = {
    "2026-08-12": [6.08, 4.18, 2.28, 2.66, 1.90], "2026-08-13": [7.63, 3.44, 2.29, 2.29, 2.29],
    "2026-08-14": [4.20, 3.44, 1.53, 1.53, 1.53], "2026-08-15": [5.75, 3.45, 1.53, 1.15, 1.92],
    "2026-08-16": [5.36, 3.45, 1.92, 2.30, 0.77], "2026-08-17": [3.86, 3.86, 3.47, 1.54, 2.32],
    "2026-08-18": [4.10, 3.28, 2.87, 2.05, 2.05]
  };
  /* Der Zitationsanteil der Domain selbst, Tag fuer Tag -- der Nenner fuer den Domain-Bezug.
     LIVE liefert die RPC den fertigen share_pct je Bezug; hier wird er gerechnet, damit der
     Schalter mit denselben Zahlen zwei ehrlich verschiedene Kurven zeigt:
     Anteil an der Domain = Anteil global / Anteil der Domain. */
  var DOMAIN_TAG = { "2026-08-12": 26.74, "2026-08-13": 22.07, "2026-08-14": 22.84,
                     "2026-08-15": 23.50, "2026-08-16": 22.68, "2026-08-17": 23.56,
                     "2026-08-18": 24.56 };

  var domain = SCOPE === "domain";
  var punkte = [];
  Object.keys(TAGE).sort().forEach(function (tag) {
    TITEL.forEach(function (t, i) {
      var global = TAGE[tag][i];
      punkte.push({
        day: tag, url: t[0], title: t[1],
        share_pct: domain ? Math.round(global / DOMAIN_TAG[tag] * 1000) / 10 : global,
        /* Nur fuer die Reihenfolge und damit die Farbe je URL gleich bleibt. */
        share_total_pct: domain ? t[3] : t[2]
      });
    });
  });

  /* share_mode gehoert in den Payload: die Komponente richtet ihren Schalter danach, statt ihn
     zu ueberschreiben -- so kann eine Antwort, die unterwegs war, den Schalter nicht verdrehen. */
  var URLS = { from: "2026-08-12", to: "2026-08-18", top_n: 5, domain: "youtube.com",
               share_mode: SCOPE, points: punkte };

  var versuche = 0;
  (function los(){
    if (typeof window.setDomainDetailUrls === "function") {
      window.setDomainDetailUrls(INSTANCE_ID, JSON.stringify(URLS));
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[domain-detail] setDomainDetailUrls gibt es nach 6s nicht. " +
      "Steht das HTML-Element auf der Seite und ist es sichtbar?");
  })();
})();
