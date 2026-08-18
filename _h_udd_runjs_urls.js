/* SCHRITT 2 von 2 -- die URL-Serie fuer den Domain-Share. GENAU so, wie er in Bubble steht.
   WOHIN: in die Workflows hinter uddMode (nur bei mode "domain"), uddScope und uddGran
   (bei mode "domain"). Alle drei fragen dieselben Daten mit anderen Parametern.

   Die Werte sind die der RPC, unveraendert -- alle 35 Punkte, nichts gerechnet, Umlaute im Titel
   erhalten (der Titel steht sichtbar in der Legende). Nur die Schreibweise ist kompakt: ein Punkt
   pro Zeile. LIVE wird der Inhalt von URLS gegen den Bubble-Ausdruck getauscht, mit den zwei
   Sanitizer-Zeilen nach STYLEGUIDE §46. */
(function(){
  var INSTANCE_ID = "domain_detail_page";

  var URLS = {
    to: "2026-08-18", from: "2026-08-12", top_n: 5, domain: "youtube.com", share_mode: "global",
    points: [
      { day: "2026-08-12", url: "https://www.youtube.com/watch?v=hFrdQNb0920", title: "So arbeiten die besten Handwerksbetriebe wirklich - YouTube", share_pct: 6.08, url_runs_total: 96, share_total_pct: 5.2488, domain_share_total_pct: 29.8137, global_share_total_pct: 5.2488 },
      { day: "2026-08-12", url: "https://www.youtube.com/watch?v=c6uXUxbeOL0", title: "Handwerkersoftware-Vergleich 2026: Wie gut sind Streit, Bosc", share_pct: 4.18, url_runs_total: 65, share_total_pct: 3.5539, domain_share_total_pct: 20.1863, global_share_total_pct: 3.5539 },
      { day: "2026-08-12", url: "https://www.youtube.com/watch?v=T-fOIKFC1zQ", title: "Lohnt sich die Handwerkersoftware PlanCraft für Handwerker i", share_pct: 2.28, url_runs_total: 41, share_total_pct: 2.2417, domain_share_total_pct: 12.7329, global_share_total_pct: 2.2417 },
      { day: "2026-08-12", url: "https://www.youtube.com/watch?v=GF-TG-z3rUo", title: "5 Automatisierungen zum Zeit sparen für Handwerks-, Bau- & I", share_pct: 2.66, url_runs_total: 35, share_total_pct: 1.9136, domain_share_total_pct: 10.8696, global_share_total_pct: 1.9136 },
      { day: "2026-08-12", url: "https://www.youtube.com/watch?v=PVbt_rWnh68", title: "Welche Handwerkersoftware ist die Beste für dich? Handwerker", share_pct: 1.9, url_runs_total: 33, share_total_pct: 1.8043, domain_share_total_pct: 10.2484, global_share_total_pct: 1.8043 },
      { day: "2026-08-13", url: "https://www.youtube.com/watch?v=hFrdQNb0920", title: "So arbeiten die besten Handwerksbetriebe wirklich - YouTube", share_pct: 7.63, url_runs_total: 96, share_total_pct: 5.2488, domain_share_total_pct: 29.8137, global_share_total_pct: 5.2488 },
      { day: "2026-08-13", url: "https://www.youtube.com/watch?v=c6uXUxbeOL0", title: "Handwerkersoftware-Vergleich 2026: Wie gut sind Streit, Bosc", share_pct: 3.44, url_runs_total: 65, share_total_pct: 3.5539, domain_share_total_pct: 20.1863, global_share_total_pct: 3.5539 },
      { day: "2026-08-13", url: "https://www.youtube.com/watch?v=T-fOIKFC1zQ", title: "Lohnt sich die Handwerkersoftware PlanCraft für Handwerker i", share_pct: 2.29, url_runs_total: 41, share_total_pct: 2.2417, domain_share_total_pct: 12.7329, global_share_total_pct: 2.2417 },
      { day: "2026-08-13", url: "https://www.youtube.com/watch?v=GF-TG-z3rUo", title: "5 Automatisierungen zum Zeit sparen für Handwerks-, Bau- & I", share_pct: 2.29, url_runs_total: 35, share_total_pct: 1.9136, domain_share_total_pct: 10.8696, global_share_total_pct: 1.9136 },
      { day: "2026-08-13", url: "https://www.youtube.com/watch?v=PVbt_rWnh68", title: "Welche Handwerkersoftware ist die Beste für dich? Handwerker", share_pct: 2.29, url_runs_total: 33, share_total_pct: 1.8043, domain_share_total_pct: 10.2484, global_share_total_pct: 1.8043 },
      { day: "2026-08-14", url: "https://www.youtube.com/watch?v=hFrdQNb0920", title: "So arbeiten die besten Handwerksbetriebe wirklich - YouTube", share_pct: 4.2, url_runs_total: 96, share_total_pct: 5.2488, domain_share_total_pct: 29.8137, global_share_total_pct: 5.2488 },
      { day: "2026-08-14", url: "https://www.youtube.com/watch?v=c6uXUxbeOL0", title: "Handwerkersoftware-Vergleich 2026: Wie gut sind Streit, Bosc", share_pct: 3.44, url_runs_total: 65, share_total_pct: 3.5539, domain_share_total_pct: 20.1863, global_share_total_pct: 3.5539 },
      { day: "2026-08-14", url: "https://www.youtube.com/watch?v=T-fOIKFC1zQ", title: "Lohnt sich die Handwerkersoftware PlanCraft für Handwerker i", share_pct: 1.53, url_runs_total: 41, share_total_pct: 2.2417, domain_share_total_pct: 12.7329, global_share_total_pct: 2.2417 },
      { day: "2026-08-14", url: "https://www.youtube.com/watch?v=GF-TG-z3rUo", title: "5 Automatisierungen zum Zeit sparen für Handwerks-, Bau- & I", share_pct: 1.53, url_runs_total: 35, share_total_pct: 1.9136, domain_share_total_pct: 10.8696, global_share_total_pct: 1.9136 },
      { day: "2026-08-14", url: "https://www.youtube.com/watch?v=PVbt_rWnh68", title: "Welche Handwerkersoftware ist die Beste für dich? Handwerker", share_pct: 1.53, url_runs_total: 33, share_total_pct: 1.8043, domain_share_total_pct: 10.2484, global_share_total_pct: 1.8043 },
      { day: "2026-08-15", url: "https://www.youtube.com/watch?v=hFrdQNb0920", title: "So arbeiten die besten Handwerksbetriebe wirklich - YouTube", share_pct: 5.75, url_runs_total: 96, share_total_pct: 5.2488, domain_share_total_pct: 29.8137, global_share_total_pct: 5.2488 },
      { day: "2026-08-15", url: "https://www.youtube.com/watch?v=c6uXUxbeOL0", title: "Handwerkersoftware-Vergleich 2026: Wie gut sind Streit, Bosc", share_pct: 3.45, url_runs_total: 65, share_total_pct: 3.5539, domain_share_total_pct: 20.1863, global_share_total_pct: 3.5539 },
      { day: "2026-08-15", url: "https://www.youtube.com/watch?v=T-fOIKFC1zQ", title: "Lohnt sich die Handwerkersoftware PlanCraft für Handwerker i", share_pct: 1.53, url_runs_total: 41, share_total_pct: 2.2417, domain_share_total_pct: 12.7329, global_share_total_pct: 2.2417 },
      { day: "2026-08-15", url: "https://www.youtube.com/watch?v=GF-TG-z3rUo", title: "5 Automatisierungen zum Zeit sparen für Handwerks-, Bau- & I", share_pct: 1.15, url_runs_total: 35, share_total_pct: 1.9136, domain_share_total_pct: 10.8696, global_share_total_pct: 1.9136 },
      { day: "2026-08-15", url: "https://www.youtube.com/watch?v=PVbt_rWnh68", title: "Welche Handwerkersoftware ist die Beste für dich? Handwerker", share_pct: 1.92, url_runs_total: 33, share_total_pct: 1.8043, domain_share_total_pct: 10.2484, global_share_total_pct: 1.8043 },
      { day: "2026-08-16", url: "https://www.youtube.com/watch?v=hFrdQNb0920", title: "So arbeiten die besten Handwerksbetriebe wirklich - YouTube", share_pct: 5.36, url_runs_total: 96, share_total_pct: 5.2488, domain_share_total_pct: 29.8137, global_share_total_pct: 5.2488 },
      { day: "2026-08-16", url: "https://www.youtube.com/watch?v=c6uXUxbeOL0", title: "Handwerkersoftware-Vergleich 2026: Wie gut sind Streit, Bosc", share_pct: 3.45, url_runs_total: 65, share_total_pct: 3.5539, domain_share_total_pct: 20.1863, global_share_total_pct: 3.5539 },
      { day: "2026-08-16", url: "https://www.youtube.com/watch?v=T-fOIKFC1zQ", title: "Lohnt sich die Handwerkersoftware PlanCraft für Handwerker i", share_pct: 1.92, url_runs_total: 41, share_total_pct: 2.2417, domain_share_total_pct: 12.7329, global_share_total_pct: 2.2417 },
      { day: "2026-08-16", url: "https://www.youtube.com/watch?v=GF-TG-z3rUo", title: "5 Automatisierungen zum Zeit sparen für Handwerks-, Bau- & I", share_pct: 2.3, url_runs_total: 35, share_total_pct: 1.9136, domain_share_total_pct: 10.8696, global_share_total_pct: 1.9136 },
      { day: "2026-08-16", url: "https://www.youtube.com/watch?v=PVbt_rWnh68", title: "Welche Handwerkersoftware ist die Beste für dich? Handwerker", share_pct: 0.77, url_runs_total: 33, share_total_pct: 1.8043, domain_share_total_pct: 10.2484, global_share_total_pct: 1.8043 },
      { day: "2026-08-17", url: "https://www.youtube.com/watch?v=hFrdQNb0920", title: "So arbeiten die besten Handwerksbetriebe wirklich - YouTube", share_pct: 3.86, url_runs_total: 96, share_total_pct: 5.2488, domain_share_total_pct: 29.8137, global_share_total_pct: 5.2488 },
      { day: "2026-08-17", url: "https://www.youtube.com/watch?v=c6uXUxbeOL0", title: "Handwerkersoftware-Vergleich 2026: Wie gut sind Streit, Bosc", share_pct: 3.86, url_runs_total: 65, share_total_pct: 3.5539, domain_share_total_pct: 20.1863, global_share_total_pct: 3.5539 },
      { day: "2026-08-17", url: "https://www.youtube.com/watch?v=T-fOIKFC1zQ", title: "Lohnt sich die Handwerkersoftware PlanCraft für Handwerker i", share_pct: 3.47, url_runs_total: 41, share_total_pct: 2.2417, domain_share_total_pct: 12.7329, global_share_total_pct: 2.2417 },
      { day: "2026-08-17", url: "https://www.youtube.com/watch?v=GF-TG-z3rUo", title: "5 Automatisierungen zum Zeit sparen für Handwerks-, Bau- & I", share_pct: 1.54, url_runs_total: 35, share_total_pct: 1.9136, domain_share_total_pct: 10.8696, global_share_total_pct: 1.9136 },
      { day: "2026-08-17", url: "https://www.youtube.com/watch?v=PVbt_rWnh68", title: "Welche Handwerkersoftware ist die Beste für dich? Handwerker", share_pct: 2.32, url_runs_total: 33, share_total_pct: 1.8043, domain_share_total_pct: 10.2484, global_share_total_pct: 1.8043 },
      { day: "2026-08-18", url: "https://www.youtube.com/watch?v=hFrdQNb0920", title: "So arbeiten die besten Handwerksbetriebe wirklich - YouTube", share_pct: 3.83, url_runs_total: 96, share_total_pct: 5.2488, domain_share_total_pct: 29.8137, global_share_total_pct: 5.2488 },
      { day: "2026-08-18", url: "https://www.youtube.com/watch?v=c6uXUxbeOL0", title: "Handwerkersoftware-Vergleich 2026: Wie gut sind Streit, Bosc", share_pct: 3.07, url_runs_total: 65, share_total_pct: 3.5539, domain_share_total_pct: 20.1863, global_share_total_pct: 3.5539 },
      { day: "2026-08-18", url: "https://www.youtube.com/watch?v=T-fOIKFC1zQ", title: "Lohnt sich die Handwerkersoftware PlanCraft für Handwerker i", share_pct: 2.68, url_runs_total: 41, share_total_pct: 2.2417, domain_share_total_pct: 12.7329, global_share_total_pct: 2.2417 },
      { day: "2026-08-18", url: "https://www.youtube.com/watch?v=GF-TG-z3rUo", title: "5 Automatisierungen zum Zeit sparen für Handwerks-, Bau- & I", share_pct: 1.92, url_runs_total: 35, share_total_pct: 1.9136, domain_share_total_pct: 10.8696, global_share_total_pct: 1.9136 },
      { day: "2026-08-18", url: "https://www.youtube.com/watch?v=PVbt_rWnh68", title: "Welche Handwerkersoftware ist die Beste für dich? Handwerker", share_pct: 1.92, url_runs_total: 33, share_total_pct: 1.8043, domain_share_total_pct: 10.2484, global_share_total_pct: 1.8043 }
    ]
  };

  /* Der Setter ist ein Boot-Stub, solange domain-detail.js noch laedt -- ein Aufruf landet dann
     in der Warteschlange und wird nachgeholt. Fehlt er GANZ, ist das Element noch nicht gebaut:
     dann in 100ms-Schritten warten, hoechstens 6 Sekunden, und danach EINMAL sagen warum. */
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
