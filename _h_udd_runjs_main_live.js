/* SCHRITT 1 von 2 -- Seitenstart. Kopf, Zitationsanteils-Reihe, Modelle, Typen und Trichter.

   WARUM ALLES IN BACKTICKS STEHT, und warum das keine Geschmacksfrage ist:
   In der bisherigen Fassung standen die Bubble-Ausdruecke in JS-POSITION:

       citation_share_delta_pct: ,
       total_citations_delta_pct:

   Ein leerer Ausdruck ergibt dort "Unexpected token ','" -- ein Syntaxfehler im QUELLTEXT. Der
   Schritt stirbt beim eval, BEVOR eine Zeile der Komponente laeuft. Kein Sanitizer kann das
   abfangen, weil er nie zur Ausfuehrung kommt. Genau das reisst die ganze Komponente mit, und es
   passiert immer bei einer Domain ohne Vorperiode: dann gibt es kein Delta.

   In einer Zeichenkette kann derselbe leere Wert nichts kaputtmachen. Er landet als Text im JSON,
   und UC.parseLoose im Setter repariert ihn zu null -- dasselbe gilt fuer unquotierte yes/no, fuer
   leere Listenelemente ([a, , b]) und fuer Anfuehrungszeichen mitten in einem Titel.

   REGEL FUER JEDEN WERT: die Anfuehrungszeichen bleiben stehen, AUCH bei Zahlen.
   "current_citation_share": "<Ausdruck>" -- leer wird null, "11.29" wird die Zahl 11.29.

   EINZIGE FALLE: ein BACKTICK oder ${ in einem Text bricht das Template-Literal. Bei Domains und
   Datumsangaben kommt das nicht vor; wenn ein Feld es fuehren kann, mit "formatted as text"
   einsetzen, dann escaped Bubble selbst. */
(function(){
  var INSTANCE_ID = "domain_detail_page";

  var MAIN = `{
    "header": {
      "id": "<Domain>",
      "domain": "<Domain>",
      "favicon": "<Favicon-URL>",
      "first_seen": "<Erstes Datum>",
      "last_seen": "<Letztes Datum>",
      "citation_type": "<Citation Type>",
      "current_citation_share": "<Anteil jetzt>",
      "citation_share_delta_pct": "<Veraenderung in Prozent>",
      "citation_share_prev": "<Anteil vorher>",
      "total_citations_count": "<Zitationen jetzt>",
      "total_citations_prev": "<Zitationen vorher>",
      "total_citations_delta_pct": "<Veraenderung der Zitationen>"
    },
    "granularity": "<day, week oder month>",
    "timeseries": {
      "citation_share_over_time": [
        <Liste: je Zeile { "day": "...", "share_pct": ... }, mit Komma dazwischen>
      ]
    },
    "types_breakdown": [
      <Liste: je Zeile { "type": "...", "share_pct": ... }, mit Komma dazwischen>
    ],
    "model_breakdown": [
      <Liste: je Zeile { "model": "...", "model_share_pct": ..., "model_logo_url": "..." }>
    ],
    "source_presence_funnel": {
      "cited_urls_count": "<Zitierte URLs>",
      "urls_with_tracked_brands": "<URLs mit Marken>",
      "tracked_brand_presence_pct": "<Anteil davon>",
      "urls_mentioning_you": "<URLs mit eigener Marke>",
      "your_url_presence_pct": "<Anteil davon>"
    }
  }`;

  /* Die Setter sind Boot-Stubs, solange domain-detail.js noch laedt -- ein Aufruf landet dann in
     der Warteschlange und wird nachgeholt. Fehlen sie GANZ, ist das Element noch nicht gebaut:
     dann in 100ms-Schritten warten, hoechstens 6 Sekunden, und danach EINMAL sagen warum. */
  var versuche = 0;
  (function los(){
    if (typeof window.setDomainDetail === "function") {
      window.setDomainDetail(INSTANCE_ID, MAIN);
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[domain-detail] setDomainDetail gibt es nach 6s nicht. " +
      "Steht das HTML-Element auf der Seite und ist es sichtbar?");
  })();
})();
