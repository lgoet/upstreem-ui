/* upstreem export-data.js — Export-Dialog (Praefix `uex`). Braucht core.js und
   filters/date-range.js.

   ── Was sich gegenueber der Standalone-Fassung geaendert hat ─────────────────
   1. Der Kalender gehoert jetzt dieser Komponente. Vorher musste auf JEDER Seite ein zweites,
      unsichtbares date-range-Element liegen (dates_v2_export), dessen Knoten beim Oeffnen in den
      Dialog geschoben und beim Schliessen zurueckgeschoben wurde. Fehlte es, stand im Dialog
      "Date picker not found". Jetzt legt die Komponente sich ihr eigenes .udr-root an.
      filters/date-range.js wird dabei NICHT angefasst -- benutzt werden nur ihre oeffentlichen
      Wege. Die ganze bewaehrte Logik (Panelposition, Presets, Grenzen, die drei
      bubble_fn_udr_*-Workflows) bleibt unveraendert.
   2. Farben kommen aus core (--vc-*) statt aus einem eigenen --am-*-Satz. Zwei Paletten in einer
      App laufen genau so lange gleich, bis jemand eine davon anfasst.

   NICHT geaendert: Eventname und Payload-Form, upstreemExportOpen/Close/SetContext/Resolve,
   die Regex-Extraktion auf Bubble-Seite, der 90s-Sicherheitstimer. Wer die Komponente schon
   verdrahtet hat, muss nichts nachziehen ausser dem Loader. */

(function(){
  "use strict";

  /* VARIANTE C "Zweispaltig" (16.10., vom Nutzer gewaehlt): links ALLE Datensaetze der App in ihren
     Bereichen, rechts die Einstellungen des gewaehlten. Vorbild Figmas Export-Fenster (Liste links,
     Einstellungen rechts), die Einstellungsflaechen von Notion und Linear, die Spaltenwahl wie
     Attio und Airtable (die sichtbaren Spalten sind die Datei).
     gruppe: "" sind die Datensaetze von Prompts, Citations und Brands, die es auch ohne die App
     (Bubble-Weg) gibt; Shopping und Ads gibt es nur in der App und nur mit ihrer Datenbank (pruefen).
     Nach dem Schliessen gilt wieder der letzte Typ der Grundgruppe (stammTyp) -- ein spaeteres
     Oeffnen ohne Typ (Cmd+K) zeigt nie Shopping, dessen Seitenfilter dann nicht mehr gelten.
     icon: das Zeichen der Leinwand (Hugeicons aus core), beschr: der Satz unter der Ueberschrift
     rechts -- was eine Zeile der Datei ist und was sie traegt, nach den Spalten aus
     export_columns_v1 (Vertrag VOR_NEXTJS_V1 Abschnitt 3, Auftrag Exporte Shopping/Ads 16.10.). */
  var TYPES = [
    { value: "prompts",     label: "Prompts",   gruppe: "", icon: "zap",
      beschr: "Every tracked prompt with its topics, metrics and the brands it mentions most." },
    { value: "prompt_runs", label: "Responses", gruppe: "", icon: "response",
      beschr: "Every answer a model gave, with its prompt and the brands it mentions." },
    { value: "domains",     label: "Domains",   gruppe: "", icon: "domain",
      beschr: "Every cited domain with its share and how often it appeared in answers." },
    { value: "urls",        label: "URLs",      gruppe: "", icon: "link",
      beschr: "Every cited page with its share, type and when it was first and last seen." },
    { value: "brands",      label: "Brands",    gruppe: "", icon: "squareStack",
      beschr: "Every brand with its visibility, rank and sentiment." },
    { value: "shop_products",    label: "Products",         gruppe: "shopping", icon: "stackStar",
      beschr: "Every product in shopping results with its visibility, position, price and merchants." },
    { value: "shop_brands",      label: "Brands",           gruppe: "shopping", icon: "squareStack",
      beschr: "Every brand in shopping results with its share of shelf, presence and top product." },
    { value: "shop_merchants",   label: "Merchants",        gruppe: "shopping", icon: "store",
      beschr: "Every merchant with its share, products and average position." },
    { value: "shop_appearances", label: "Appearances",      gruppe: "shopping", icon: "eye",
      beschr: "One row for each time a product appeared in an answer, with position, price and merchant." },
    { value: "ads_advertisers",  label: "Advertisers",      gruppe: "ads", icon: "bank",
      beschr: "Every advertiser with its ad share, appearances and the prompts it showed up in." },
    { value: "ads_library",      label: "Ad Library",       gruppe: "ads", icon: "album",
      beschr: "Every ad seen in an answer, with its text, landing page, prompt and tracking parameters." },
    { value: "ads_prompts",      label: "Prompts with Ads", gruppe: "ads", icon: "marketing",
      beschr: "Every prompt that showed ads, with its ad coverage and advertisers." }
  ];
  /* Der Satz, solange es die Exporte einer Gruppe noch nicht gibt. Ganz ohne Technik: der Nutzer
     kann nichts tun ausser warten, und genau das sagt er. */
  var GRUPPEN = {
    shopping: { bald: "Exports for Shopping are coming soon." },
    ads: { bald: "Exports for Ads are coming soon." }
  };
  function typVon(v){ for (var i = 0; i < TYPES.length; i++) if (TYPES[i].value === v) return TYPES[i]; return null; }
  function gruppeVon(v){ var x = typVon(v); return x ? x.gruppe : ""; }
  /* Die Texte, die es nur hier gibt. Die Namen der Datensaetze stehen schon in ads.js -- mit
     demselben Wert, damit der Dialog auch dann deutsch ist, wenn Ads nie geladen wurde. Kein
     Schluessel aus core (Katalog-Kollision). Eingetragen beim ersten Controller, nicht beim Laden:
     diese Datei kommt ohne core aus, und steht sie im Loader vor core, waere der Katalog sonst leer. */
  var katalogDa = false;
  function katalog(){
    var C = window.UpstreemCore;
    if (katalogDa || !C || !C.addMessages) return;
    katalogDa = true;
    C.addMessages("de", {
      "Exports for Shopping are coming soon.": "Exporte für Shopping kommen bald.",
      "Exports for Ads are coming soon.": "Exporte für Ads kommen bald.",
      "This export is coming soon.": "Dieser Export kommt bald.",
      "Advertisers": "Werbetreibende", "Ad Library": "Anzeigenbibliothek",
      "Prompts with Ads": "Prompts mit Ads", "Appearances": "Auftritte",
      /* Variante C (16.10.). "Export data", "Done", "Back", "Cancel", "Filters", "Columns",
         "Date range", "Custom range", "Exporting…", "{n} rows exported" und die Saetze der Fehler
         stehen schon in core und werden hier NICHT eingetragen (Katalog-Kollision). "Filter" ist
         dort das Verb ("Filtern") -- das Feld heisst darum "Filters". */
      "Export {typ}": "{typ} exportieren",
      "Exporting {typ}": "Export läuft: {typ}",
      "Remove filter {name}": "Filter {name} entfernen",
      "Filtered to {name}": "Gefiltert auf {name}",
      "This prompt": "Dieser Prompt", "This brand": "Diese Brand",
      /* Seitenfilter (16.10.): die Namen der Chips stehen in core, wo die Filterleiste sie schon
         braucht (Topic, Model, Market, Intent, Prompt type, Brand, Brands, Rank, Sentiment, Citation
         type, URL type, Status, Search) und werden hier NICHT eingetragen. Segment, Merchant,
         Product, Advertiser und Format stehen in shopping.js bzw. ads.js -- mit demselben Wert auch
         hier, damit der Dialog deutsch ist, wenn die Seite nie geladen wurde (wie die Namen oben). */
      "Segment": "Segment", "Merchant": "Händler", "Product": "Produkt", "Advertiser": "Werbetreibender", "Format": "Format",
      "This product": "Dieses Produkt",
      "Restore filters": "Filter wiederherstellen",
      "Without filters, every row in the date range is exported.": "Ohne Filter geht jede Zeile im Zeitraum in die Datei.",
      "Your session has expired": "Deine Sitzung ist abgelaufen", 
      "Please wait {n} seconds and try again.": "Warte {n} Sekunden und versuch es noch einmal.",
      "Please wait 1 second and try again.": "Warte eine Sekunde und versuch es noch einmal.",
      "The file couldn't be created": "Die Datei konnte nicht erstellt werden",
      "Choose fewer columns or a shorter date range and try again.": "Wähl weniger Spalten oder einen kürzeren Zeitraum und versuch es noch einmal.",
      "Inactive prompts can't be exported": "Inaktive Prompts lassen sich nicht exportieren",
      "Only active prompts are exported.": "Exportiert werden nur aktive Prompts.",
      "Data": "Daten", "Soon": "Bald",
      "All columns": "Alle Spalten", "{n} columns": "{n} Spalten",
      "{k} of {n} columns": "{k} von {n} Spalten",
      "Choose at least one column.": "Wähl mindestens eine Spalte.",
      "Safe to open in Excel and Sheets. Up to {n} rows.": "Sicher in Excel und Sheets zu öffnen. Bis zu {n} Zeilen.",
      "{k} of {n} rows": "{k} von {n} Zeilen", "{n} rows": "{n} Zeilen",
      "Export progress": "Fortschritt des Exports",
      "Closing this window stops the export.": "Wenn du das Fenster schließt, bricht der Export ab.",
      "Loading columns": "Spalten werden geladen", "Columns loaded": "Spalten geladen",
      "Fetching rows": "Zeilen werden abgerufen", "Building the file": "Datei wird erstellt",
      "Page {k} of {n}": "Seite {k} von {n}", "Page {k}": "Seite {k}",
      "Cancel export": "Export abbrechen", "Export another": "Weiterer Export",
      /* Der Abschluss (17.10.): ein schlichter Erfolgssatz statt "Download again" -- der Screen
         kommt nur, wenn gerade heruntergeladen wurde. */
      "Your file has been downloaded.": "Deine Datei wurde heruntergeladen.",
      "Rename file": "Datei umbenennen",
      "{groesse}, {n} columns, CSV": "{groesse}, {n} Spalten, CSV",
      "{groesse}, 1 column, CSV": "{groesse}, 1 Spalte, CSV",
      /* Die Saetze unter der Ueberschrift (TYPES.beschr). Brand, Prompt, Topic, Visibility, Rank
         und Sentiment bleiben englisch wie ueberall in der App. */
      "Every tracked prompt with its topics, metrics and the brands it mentions most.":
        "Jeder getrackte Prompt mit seinen Topics, Kennzahlen und den Brands, die er am häufigsten nennt.",
      "Every answer a model gave, with its prompt and the brands it mentions.":
        "Jede Antwort eines Modells mit ihrem Prompt und den Brands, die sie nennt.",
      "Every cited domain with its share and how often it appeared in answers.":
        "Jede zitierte Domain mit ihrem Anteil und wie oft sie in Antworten vorkam.",
      "Every cited page with its share, type and when it was first and last seen.":
        "Jede zitierte Seite mit Anteil, Typ und wann sie zuerst und zuletzt auftauchte.",
      "Every brand with its visibility, rank and sentiment.":
        "Jede Brand mit ihrer Visibility, ihrem Rank und ihrem Sentiment.",
      "Every product in shopping results with its visibility, position, price and merchants.":
        "Jedes Produkt aus den Shopping-Ergebnissen mit Visibility, Position, Preis und Händlern.",
      "Every brand in shopping results with its share of shelf, presence and top product.":
        "Jede Brand aus den Shopping-Ergebnissen mit Share of Shelf, Präsenz und Top-Produkt.",
      "Every merchant with its share, products and average position.":
        "Jeder Händler mit Anteil, Produkten und durchschnittlicher Position.",
      "One row for each time a product appeared in an answer, with position, price and merchant.":
        "Eine Zeile für jeden Auftritt eines Produkts in einer Antwort, mit Position, Preis und Händler.",
      "Every advertiser with its ad share, appearances and the prompts it showed up in.":
        "Jeder Werbetreibende mit Anteil an den Ads, Auftritten und den Prompts, in denen er erschien.",
      "Every ad seen in an answer, with its text, landing page, prompt and tracking parameters.":
        "Jede Ad aus einer Antwort mit Text, Zielseite, Prompt und Tracking-Parametern.",
      "Every prompt that showed ads, with its ad coverage and advertisers.":
        "Jeder Prompt mit Ads, mit seiner Ad-Abdeckung und den Werbetreibenden."
    });
  }
  function tr(x){ var C = window.UpstreemCore; return C && C.t ? C.t(x) : x; }
  /* ---- Dateinamen (17.10.) ----
     STAMM_MAX: der ganze Name ohne .csv. Windows und macOS erlauben 255, aber ein Name, der im
     Download-Ordner nicht mehr in eine Zeile passt, hilft niemandem; der Vorschlag (Team 40 +
     Datensatz + zwei Daten) bleibt mit 72 sicher darunter. */
  var STAMM_MAX = 100, TEAM_MAX = 40;
  /* Der Teamname als Teil des Vorschlags: klein, Umlaute ausgeschrieben (ein "a" fuer "ä" liest
     sich falsch), andere Akzente ohne Zeichen (NFD trennt sie ab), alles uebrige -- Leerzeichen,
     Schraegstrich, Emoji -- wird zu einem "-". Gekuerzt wird VOR dem Abschneiden der Striche,
     sonst endete ein langer Name auf "-". Leer, wenn nichts Lesbares uebrig bleibt: ein Teamname nur
     aus Emoji oder japanischen Zeichen faellt ganz weg, dann steht vorne die Marke "upstreem"
     (namenVorschlag) -- so gewollt (Audit EXP-14, 17.10.), die Datei bleibt kenntlich am Datensatz
     und am Zeitraum. */
  function namensTeil(s, max){
    var t = String(s == null ? "" : s).toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
    try { t = t.normalize("NFD"); } catch(e){}
    t = t.replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "");
    if (max && t.length > max) t = t.slice(0, max);
    return t.replace(/-+$/, "");
  }
  /* Was der Nutzer als Namen tippt, bleibt seins (Grossbuchstaben, Leerzeichen, Umlaute). Weg
     muss nur, was eine Datei nicht tragen kann oder taeuscht: die Zeichen, die Windows verbietet
     (/ \ : * ? " < > |), Steuerzeichen und die unsichtbaren Richtungszeichen, mit denen
     "abc.exe" als "exe.cba" erscheinen kann. Am Ende (fertig): keine Punkte und Leerzeichen am
     Rand (Windows schneidet sie, ein fuehrender Punkt versteckt die Datei auf dem Mac) und kein
     getipptes ".csv" -- das steht schon fest dahinter. */
  var VERBOTEN = /[\/\\:*?"<>|\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;
  /* Die Geraetenamen von Windows (17.10., Audit EXP-14): "CON.csv", "NUL.csv", "COM1.csv" lassen
     sich dort nicht anlegen oder beschreiben, und das gilt auch mit Endung und fuer "con.x.csv"
     (massgeblich ist der Teil vor dem ersten Punkt). Ein "_" davor macht daraus einen gewoehnlichen
     Namen und laesst ihn erkennbar. Der Vorschlag trifft das nie (Team-Datensatz-Daten), nur ein
     getippter Name. */
  var RESERVIERT = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i;
  function stammSaeubern(s, fertig){
    var t = String(s == null ? "" : s).replace(VERBOTEN, "");
    if (!fertig) return t;
    t = t.replace(/\s+/g, " ").trim().replace(/\.csv$/i, "").replace(/^[.\s]+|[.\s]+$/g, "");
    if (t.length > STAMM_MAX) t = t.slice(0, STAMM_MAX).replace(/[.\s]+$/, "");
    return RESERVIERT.test(t) ? "_" + t : t;
  }
  /* Der Bereich der App, zu dem ein Datensatz gehoert: die Ueberschriften der Liste links, in der
     Reihenfolge der Seitenleiste. Ads traegt dort "Beta" (sidebar.js), Shopping seit dem 05.10. nicht. */
  var QUELLE = { prompts: "Prompt Insights", prompt_runs: "Prompt Insights", domains: "Citations",
                 urls: "Citations", brands: "Brands", shopping: "Shopping", ads: "Ads" };
  function quelleVon(v){ return QUELLE[gruppeVon(v) || v] || ""; }
  var BETA = { Ads: true };
  /* DER KONTEXTFILTER GILT NUR IN SEINEM SCOPE (16.10., Auftrag zu Variante C: "dass er in den
     korrekten Situationen Filter mitsetzt -- dann aber auch nur fuer den Scope, wo man gerade ist").
     Ein Drawer setzt seinen Filter (Domain, Adresse, Prompt, Brand) mit setContext. Er gilt fuer
     genau die Datensaetze, die der Drawer selbst gefiltert zeigt UND deren Funktion ihn als
     Parameter kennt -- diese Liste, dieselbe wie in exportParameter. Der Domain-Drawer zeigt URLs
     und Responses von adac.de: dort steht der Chip, dort geht p_domain mit. Waehlt man links
     Prompts oder Shopping, ist er weg (kein Chip, kein Parameter); zurueck auf URLs ist er wieder
     da -- der Wert bleibt fuer die Dauer des Oeffnens stehen, nur sein Geltungsbereich entscheidet.
     Links traegt jeder Datensatz im Scope das Filterzeichen, damit man sieht, wo er gilt. */
  var FILTER = [
    { feld: "url",      param: "p_url",       typen: ["prompt_runs"],                    icon: "link" },
    { feld: "domain",   param: "p_domain",    typen: ["prompt_runs", "urls"],            icon: "domain" },
    /* Seit exporte_fix_v1 (17.10., EXP-01) kennen auch Brands, Domains und URLs p_prompt_id: der Prompt-Drawer
       zeigt sie alle drei auf diesen Prompt beschraenkt, die Datei muss es auch sein. */
    { feld: "promptId", param: "p_prompt_id", typen: ["prompt_runs", "brands", "domains", "urls"], icon: "zap", ersatz: "This prompt" },
    { feld: "brandId",  param: "p_brand",     typen: ["prompt_runs", "domains", "urls"], icon: "squareStack", ersatz: "This brand" }
  ];
  /* DIE FILTER DER SEITE GEHEN MIT, SICHTBAR UND ABWAEHLBAR (16.10., Frage des Nutzers "wirklich
     alle? Machen andere Apps das auch so?"). Gemessen an den Hilfeseiten: der Export folgt der
     gefilterten Ansicht -- alle Zeilen, die die Filter treffen, nicht nur die sichtbare Seite --
     bei Profound, Scrunch, AthenaHQ, Search Console, Semrush, Airtable, Attio, Notion, Stripe,
     Vercel; der Zeitraum ist der der Ansicht. Die aktiven Filter zeigt dort kein Dialog (Search
     Console schreibt sie in die Datei), ohne Filter exportieren laesst nur Shopify waehlen. Hier
     beides: jeder Filter, der mitgeht, steht als Chip im Feld Filters, jeder laesst sich abwaehlen
     (dann exportiert der Dialog, was die Seite ohne ihn zeigt), "Restore filters" holt alle
     zurueck. Nichts geht still mit.
     Die Seite meldet je Datensatz die Parameter ihrer eigenen Liste (setContext params), ohne
     Team, Zeitraum und Seite. Es gilt nur, was die Exportfunktion als Parameter kennt (KENNT, die
     Signaturen aus der Datenbank, 16.10. gelesen) -- ein fremder Name liesse PostgREST die Funktion
     gar nicht finden (PGRST202). Ein Filter gilt fuer die Datensaetze, die die Seite gefiltert
     zeigt: die Filter der Leiste fuer alle ihrer Seite, die einer Tabelle (Suche, Rank ...) nur fuer
     den Datensatz des offenen Reiters -- das entscheidet die Seite, indem sie sie nur dort meldet.
     Die Sortierung geht als Reihenfolge der Zeilen mit (sie aendert keine Zeile, also kein Chip),
     ausser sie ist der Funktion fremd (ORDNUNG). */
  var GRUND_P = ["p_models", "p_markets", "p_tag_ids", "p_intents", "p_branded"];
  var KENNT = {
    prompts:          GRUND_P.concat(["p_tagmode", "p_untagged", "p_search", "p_mentioned", "p_company_ids", "p_status", "p_order"]),
    prompt_runs:      GRUND_P.concat(["p_tagmode", "p_order", "p_mentioned", "p_company_ids", "p_sentiment_min", "p_sentiment_max",
                                      "p_rank_min", "p_rank_max", "p_search", "p_url", "p_domain", "p_prompt_id", "p_brand"]),
    domains:          GRUND_P.concat(["p_tagmode", "p_mentioned", "p_mentioned_brands", "p_citation_types", "p_url_types", "p_search", "p_order", "p_brand", "p_prompt_id"]),
    urls:             GRUND_P.concat(["p_tagmode", "p_domain", "p_mentioned", "p_mentioned_brands", "p_citation_types", "p_url_types", "p_search", "p_order", "p_brand", "p_prompt_id"]),
    /* p_companies (exporte_fix_v1): die Fader-Auswahl der Brands-Tabelle, dieselbe Menge wie in der Liste. */
    brands:           GRUND_P.concat(["p_tagmode", "p_search", "p_order", "p_companies", "p_prompt_id"]),
    /* Shopping und Ads nach bubble/exporte_16_10/exporte_shopping_ads_v1.sql. Ads kennt kein p_tagmode. */
    shop_products:    GRUND_P.concat(["p_tagmode", "p_segment", "p_search", "p_merchant", "p_company_id", "p_order"]),
    shop_brands:      GRUND_P.concat(["p_tagmode", "p_search", "p_order"]),
    shop_merchants:   GRUND_P.concat(["p_tagmode", "p_search", "p_order"]),
    shop_appearances: GRUND_P.concat(["p_tagmode", "p_segment", "p_search", "p_merchant", "p_company_id", "p_source_product_id"]),
    ads_advertisers:  GRUND_P.concat(["p_advertisers", "p_ad_formats", "p_search", "p_sort"]),
    ads_library:      GRUND_P.concat(["p_advertisers", "p_ad_formats", "p_search"]),
    ads_prompts:      GRUND_P.concat(["p_advertisers", "p_ad_formats", "p_search", "p_sort"])
  };
  /* Die Sortierungen, die die Exportfunktionen annehmen (Datenbank, 16.10.). Eine andere liesse den
     ganzen Export mit exports_invalid_param scheitern -- dann lieber die Reihenfolge der Funktion.
     URLs einer Domain (p_domain) kennen andere (domainshare statt share). Shopping und Ads pruefen
     ihre Seiten selbst gegen dieselben Listen (ORDER in shopping.js/ads.js). */
  var ORDNUNG = {
    prompts: ["visibility_desc", "visibility_asc", "rank_asc", "rank_desc", "sentiment_desc", "sentiment_asc",
              "name_asc", "name_desc", "created_at_desc", "created_at_asc"],
    prompt_runs: ["run_at_desc", "run_at_asc", "rank_asc", "rank_desc", "sentiment_asc", "sentiment_desc"],
    domains: ["share_desc", "share_asc", "share_delta_desc", "share_delta_asc", "last_used_desc", "last_used_asc",
              "domain_asc", "domain_desc", "urls_count_desc", "urls_count_asc"],
    urls: ["share_desc", "share_asc", "share_delta_desc", "share_delta_asc", "last_used_desc", "last_used_asc", "domain_asc", "url_asc"],
    urls_domain: ["domainshare_desc", "domainshare_asc", "share_delta_desc", "share_delta_asc", "last_used_desc", "url_asc"],
    brands: ["visibility_desc", "visibility_asc", "rank_asc", "rank_desc", "sentiment_desc", "sentiment_asc",
             "mentions_desc", "mentions_asc", "name_asc", "name_desc"]
  };
  /* Die Chips der Seitenfilter, in der Reihenfolge der Filterleiste (Topics, Models, Markets,
     Intent), davor das Produkt eines Details und die Suche, danach die Filter der Tabellen. Name und Zeichen wie in der Leiste
     (filters/filter-bar.js FILTERS), damit derselbe Filter hier nicht anders heisst. Ein Chip fasst
     die Parameter zusammen, die nur gemeinsam Sinn haben (Topics mit ihrem Modus, Rank von bis).
     aktiv: ob der Wert ein Filter ist -- die Vorgabe der Funktion (Status active, Mentioned all,
     Segment all) ist keiner. Branded ist bei Prompts der Filter der Tabelle (Prompt type), sonst
     die Brille der App (UC.intentFilterParams): "non_branded" ist dort die Vorgabe der ganzen App
     und kein Chip, wie in der Filterleiste; "all" ist die Abweichung ("Branded: Included"), und
     abgewaehlt gilt wieder die Vorgabe (vorgabe), wie beim X der Leiste. */
  function voll(v){ return v != null && v !== "" && !(Array.isArray(v) && !v.length); }
  /* DIE BRILLE DER APP ALS GRUNDLAGE JEDES DATENSATZES (17.10., Audit EXP-02). Intent und Branded
     (UC.intentFilterParams) gelten fuer die ganze App, nicht fuer eine Seite. Bisher kamen sie nur
     ueber die params, die die Seite fuer IHRE Datensaetze meldet: oeffnete Cmd+K den Dialog ohne
     Kontext, oder wechselte man links auf einen Datensatz, den die Seite nicht gemeldet hatte
     (Brands-Seite, links Responses), ging p_branded gar nicht mit -- die Datenbank nimmt dann "all",
     und die Datei zaehlte Branded-Prompts, die die App ausblendet. Jetzt steht die Brille unter
     den params der Seite (die gewinnen, auch ein "all" der Seite) und erscheint, wie dort, als Chip
     (Intent) bzw. als Vorgabe ohne Chip (non_branded). Nur, was die Funktion kennt (KENNT). Die
     Prompts-Tabelle nimmt davon nur die Intents: Branded ist dort ihr eigener Filter (Prompt type),
     "branded: false" wie in der Tabelle selbst. Nicht freigegeben: leer, wie intentFilterParams. */
  function brille(art){
    var C = window.UpstreemCore, out = {}, kennt = KENNT[art] || [], f;
    if (!C || typeof C.intentFilterParams !== "function") return out;
    try { f = C.intentFilterParams(art === "prompts" ? { branded: false } : undefined) || {}; } catch(e){ f = {}; }
    Object.keys(f).forEach(function(n){ if (kennt.indexOf(n) >= 0 && voll(f[n])) out[n] = f[n]; });
    return out;
  }
  var SEITE = [
    /* Das Produkt zuerst: es ist kein Filter neben anderen, sondern der Gegenstand der Seite
       (Product Detail), wie die Filter der Drawer vor allen anderen stehen. */
    { key: "product",   params: ["p_source_product_id"], icon: "stackStar",  name: "Product" },
    { key: "search",    params: ["p_search"],           icon: "search",      name: "Search" },
    { key: "topics",    params: ["p_tag_ids", "p_tagmode"], icon: "tags",    name: "Topic" },
    { key: "models",    params: ["p_models"],           icon: "layers",      name: "Model" },
    { key: "markets",   params: ["p_markets"],          icon: "mapPin",      name: "Market" },
    { key: "intents",   params: ["p_intents"],          icon: "signpost",    name: "Intent" },
    { key: "branded",   params: ["p_branded"],          icon: "flag",        name: "Branded",
      aktiv: function(v, art){ return art === "prompts" ? (v === "branded" || v === "non_branded") : (voll(v) && v !== "non_branded"); },
      vorgabe: function(art){ return art === "prompts" ? undefined : "non_branded"; } },
    /* Kein Chip fuer Status (17.10., Regel des Nutzers: "Inaktive Prompts und Brands = kein Export
       moeglich"). Bis dahin stand hier "Status: Inactive", sobald die Seite vom Reiter Inactive
       exportierte. p_status geht nur noch als active hinaus (exportParameter), die Datenbank
       weist jeden anderen Wert mit 400 ab -- ein Chip dafuer haette nichts mehr zu waehlen. */
    { key: "mentioned", params: ["p_mentioned"],        icon: "megaphone",   name: "Brand",
      aktiv: function(v){ return v === "yes" || v === "no"; } },
    { key: "brands",    params: ["p_company_ids", "p_mentioned_brands", "p_companies"], icon: "squareStack", name: "Brands" },
    { key: "rank",      params: ["p_rank_min", "p_rank_max"], icon: "hash",  name: "Rank" },
    { key: "sentiment", params: ["p_sentiment_min", "p_sentiment_max"], icon: "smile", name: "Sentiment" },
    { key: "citation_types", params: ["p_citation_types"], icon: "newspaper", name: "Citation type" },
    { key: "url_types", params: ["p_url_types"],        icon: "linkFeather", name: "URL type" },
    { key: "segment",   params: ["p_segment"],          icon: "swords",      name: "Segment",
      aktiv: function(v){ return voll(v) && v !== "all"; } },
    { key: "company",   params: ["p_company_id"],       icon: "squareStack", name: "Brand" },
    { key: "merchant",  params: ["p_merchant"],         icon: "store",       name: "Merchant" },
    { key: "advertisers", params: ["p_advertisers"],    icon: "bank",        name: "Advertiser" },
    { key: "ad_formats", params: ["p_ad_formats"],      icon: "image",       name: "Format" }
  ];
  /* Der Chip, zu dem ein Parameter gehoert (p_tagmode zu Topics). */
  function seitenChip(param){
    for (var i = 0; i < SEITE.length; i++) if (SEITE[i].params.indexOf(param) >= 0) return SEITE[i];
    return null;
  }
  function seitenChipKey(key){
    for (var i = 0; i < SEITE.length; i++) if (SEITE[i].key === key) return SEITE[i];
    return null;
  }
  /* Zeichen aus core (Hugeicons). Ohne core gibt es keins -- diese Datei kommt ohne core aus, und
     ein Knopf ohne Zeichen ist besser als ein selbst gezeichnetes. */
  function ic(name){ var C = window.UpstreemCore; return C && C.icon ? C.icon(name, 2) : ""; }
  /* Keys are deliberately the SAME strings the date range picker uses for its own presets,
     so syncing the two is a straight pass-through with nothing to translate. */
  var PRESETS = [
    { key: "last7",  label: "Last 7 Days",   days: 7  },
    { key: "last30", label: "Last 30 Days",  days: 30 },
    { key: "last3",  label: "Last 3 Months", months: 3 },
    { key: "last6",  label: "Last 6 Months", months: 6 }
  ];

  function isYes(v){ return /^(1|true|yes|y)$/i.test(String(v == null ? "" : v).trim()); }
  /* Kennt core ein Thema, gewinnt core: data-isdark ist die Momentaufnahme aus dem Moment, in dem
     der Bubble-Workflow lief, und wer sie direkt ins data-theme schreibt, dreht sich beim naechsten
     Aufruf selbst zurueck. Diese Datei haelt keine UC-Variable -- sie kommt ohne core aus --,
     deshalb der direkte Griff mit Rueckfall auf das Attribut. */
  function dunkelJetzt(v){
    var C = window.UpstreemCore;
    return (C && C.themeParam) ? C.themeParam(v) : isYes(v);
  }
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c];
    });
  }
  function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n){ var r = startOfDay(d); r.setDate(r.getDate() + n); return r; }
  function addMonths(d, n){
    var t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    var last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(d.getDate(), last));
    return startOfDay(t);
  }
  function isoDate(d){
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  /* UTC midnight of the given (local) calendar date, as Unix ms. Deliberately NOT d.getTime():
     that reads local midnight, which in any timezone ahead of UTC (e.g. CEST, UTC+2) lands on the
     PREVIOUS UTC calendar day — so a date picked as "23 Jul" arrived at the backend as "22 Jul,
     22:00 UTC" and was read back as the 22nd. Date.UTC() builds the timestamp straight from the
     calendar fields, sidestepping the browser's local timezone entirely. */
  function utcMidnight(d){
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function parseIso(v){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ""));
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : startOfDay(d);
  }
  function prettyDate(d){
    var M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return String(d.getDate()).padStart(2,"0") + ". " + M[d.getMonth()] + " " + d.getFullYear();
  }
  /* INCLUSIVE day count: "Last 7 Days" (17th…23rd) is 7, not 6. */
  function dayCount(from, to){
    return Math.abs(Math.round((startOfDay(to) - startOfDay(from)) / 86400000)) + 1;
  }
  /* Outbound event lookup: window/parent/top first, then a full BFS over every reachable
     iframe — needed when the receiving Toolbox element sits deeper than one level up. */
  function resolveBubbleFn(fnName){
    /* Die EIGENE Suche, nicht die aus core. Ich hatte hier UC.resolveBubbleFn vorangestellt, weil
       es die gepflegtere Fassung ist -- danach kam der Export nicht mehr an, obwohl er vorher
       lief und der Aufruf nachweislich bei window.bubble_fn_upstreemExport ankam. Was core
       zusaetzlich tut (Cache, Frame-Behandlung), ist hier offenbar nicht neutral. Der Grund ist
       nicht aufgeklaert; zurueck auf den Stand, der funktioniert hat.
       Wer das eines Tages vereinheitlichen will, muss es an einer echten Seite messen, nicht im
       Harness -- dort liefen beide Wege. */
    var fn = window[fnName] || (window.parent && window.parent[fnName]) || (window.top && window.top[fnName]);
    if (typeof fn === "function") return fn;
    var start; try { start = window.top || window.parent || window; } catch(e){ start = window; }
    var queue = [start], seen = [];
    while (queue.length){
      var win = queue.shift();
      if (seen.indexOf(win) !== -1) continue;
      seen.push(win);
      try { if (typeof win[fnName] === "function") return win[fnName]; } catch(e){}
      var frames; try { frames = win.document.querySelectorAll("iframe"); } catch(e){ continue; }
      for (var i = 0; i < frames.length; i++){
        var cw; try { cw = frames[i].contentWindow; } catch(e){ cw = null; }
        if (cw && seen.indexOf(cw) === -1) queue.push(cw);
      }
    }
    return null;
  }

  /* State that must survive Bubble rebuilding the element, keyed by instanceId. */
  var STORE = (window.__uexStore = window.__uexStore || {});
  /* Welche Exporte von Shopping und Ads es gibt (pruefen im Controller), je Spaltenschluessel:
     { stand: true | false | null, spalten, laeuft }. Am window, fuer alle Controller und ueber
     einen Neuaufbau hinweg; jede Antwort zeichnet offene Dialoge neu (Ereignis uex-verfuegbar). */
  var DA = (window.__uexDa = window.__uexDa || {});
  function daGeaendert(){
    try { window.dispatchEvent(new CustomEvent("uex-verfuegbar")); } catch(e){}
  }

  function makeController(root){
    var instanceId = root.getAttribute("data-instance") || "default";
    var saved = STORE[instanceId] || {};
    /* KEIN Knopf. Diese Komponente ist nur der Dialog -- geoeffnet wird sie von den
       Export-Knoepfen der anderen Komponenten ueber upstreemExportOpen(instanceId). Das Element
       auf der Seite ist ein reiner Traeger und soll nichts anzeigen und nichts anklickbar machen.
       Ein Knopf im Markup wird trotzdem respektiert: wer die Standalone-Fassung eingebaut hat,
       behaelt ihn, ohne etwas nachziehen zu muessen. */
    var btn = root.querySelector(".uex-btn");

    var isDark = dunkelJetzt(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");

    katalog();
    var today = startOfDay(new Date());
    var state = {
      type: normType(root.getAttribute("data-export-type")) || saved.type || TYPES[0].value,
      token: root.getAttribute("data-token") || saved.token || "",
      preset: saved.preset || "last7",
      from: parseIso(saved.from) || addDays(today, -6),
      to: parseIso(saved.to) || today,
      open: false,
      processing: false,
      /* Kontext der Seite (setContext): die Parameter ihrer Listen je Datensatz (params), lesbare
         Werte zu Chips, die der Dialog nicht selbst aufloesen kann (namen: Produkt, Marke einer
         Shopping-Zeile), und die in diesem Oeffnen abgewaehlten Chips (weg, je Schluessel -- auch
         die Filter der Drawer). Wie url/domain nur fuer DIESEN Export, beim Schliessen geleert. */
      params: {}, namen: {}, weg: {}, zeitVonSeite: false,
      /* VARIANTE C (16.10.). phase: "wahl" (Einstellungen), "laeuft" (der Export blaettert) oder
         "fertig" (Datei heruntergeladen). schritt: am Telefon die Haelfte, die zu sehen ist
         ("liste" links oder "einst" rechts; breit ohne Wirkung). offen: "zeit", solange die
         Ersatzliste der Zeitraeume aufgeklappt ist (nur ohne Kalender). lauf: Zaehler des laufenden
         Exports, ergebnis: was der Abschluss ueber die Datei sagt (Zeilen, Name, Groesse, Spalten;
         die Datei selbst wird nicht gehalten, seit es "Download again" nicht mehr gibt, 17.10.).
         eigenName: der Dateiname ohne .csv, wenn der Nutzer ihn im Fuss geaendert hat, sonst null
         (der Vorschlag gilt); namenEdit: solange das Feld dafuer offen ist. fehler: der rote Satz im Fuss,
         zeitFehler: der am Feld Date range (ein Zeitraum, den die Datenbank ablehnt -- wie auf der
         Leinwand am Feld, nicht im Fuss). filterLabel: der Name zum Filter eines Drawers (Brand,
         Prompt) fuer den Chip. ohne: je Spaltensatz die abgewaehlten Spalten -- eine Einstellung,
         also im Speicher. */
      phase: "wahl", schritt: "einst", offen: "", lauf: null, ergebnis: null, fehler: "", zeitFehler: "", filterLabel: "",
      eigenName: null, namenEdit: false,
      ohne: (saved.ohne && typeof saved.ohne === "object") ? saved.ohne : {}
    };
    if (gruppeVon(state.type)) state.type = TYPES[0].value;
    state.stammTyp = state.type;
    /* Jeder Typwechsel hierueber: ein Typ der Grundgruppe wird der, zu dem der Dialog nach einem
       Shopping- oder Ads-Export zurueckkehrt. */
    function typSetzen(v){
      /* Ein eigener Dateiname gilt nur fuer den Datensatz, fuer den er getippt wurde: "Brands"
         hiesse nach dem Wechsel sonst weiter "prompts-q3". Mit dem Wechsel gilt wieder der
         Vorschlag, ein offenes Feld schliesst ohne Uebernahme. */
      if (v !== state.type){ state.eigenName = null; state.namenEdit = false; }
      state.type = v;
      if (!gruppeVon(v)) state.stammTyp = v;
    }

    function normType(v){
      var s = String(v == null ? "" : v).trim().toLowerCase();
      if (!s || s === "EXPORT_TYPE".toLowerCase()) return null;
      for (var i = 0; i < TYPES.length; i++) if (TYPES[i].value === s) return s;
      // tolerate a few obvious aliases so a slightly different Bubble value still lands right
      if (s === "responses" || s === "runs") return "prompt_runs";
      if (s === "url") return "urls";
      if (s === "domain") return "domains";
      if (s === "brand") return "brands";
      if (s === "prompt") return "prompts";
      return null;
    }
    function persist(){
      STORE[instanceId] = {
        type: state.stammTyp, token: state.token, preset: state.preset,
        from: isoDate(state.from), to: isoDate(state.to), ohne: state.ohne
      };
    }

    /* ---------------- popup ---------------- */
    var overlay = document.createElement("div");
    /* up-root MIT dazu: das Overlay haengt an <body>, also ausserhalb jeder .up-root -- und die
       --vc-*-Tokens stehen genau dort. Ohne die Klasse erbte der Dialog nichts und fiel auf die
       Rueckfallwerte zurueck; gemessen kam er fast schwarz heraus, obwohl kein Dark Mode aktiv
       war. Dasselbe Muster wie bei notification-card, die ebenfalls an <body> baut. */
    /* Das Core-Popup, nicht ein eigenes. .up-topicmodal-backdrop bringt Schleier, Weichzeichner,
       Einblendung und den Dark-Mode mit; .up-topicmodal-card die Karte samt Palette, Radius,
       Schatten und Auftauchbewegung. Vorher stand hier ein Nachbau mit eigenen Werten -- andere
       Deckkraft, kein Blur, andere Kurve. Genau das, was der Styleguide verbietet. */
    overlay.className = "up-root up-portal up-topicmodal-backdrop uex-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.inert = true;
    /* VARIANTE C "Zweispaltig" (16.10., vom Nutzer gewaehlt, Leinwand "Export-Varianten" C). Links
       die Liste aller Datensaetze in ihren Bereichen (alle zwoelf ohne Rollen), rechts die
       Einstellungen des gewaehlten: Ueberschrift mit Satz, Filter aus dem Kontext, Zeitraum,
       Spalten aus export_columns_v1 als Checkliste, Format. Im Fuss der Dateiname als Vorschau und
       die zwei Knoepfe. Laeuft der Export, steht rechts der echte Fortschritt (Zeilen von
       total_count) mit seinen drei Schritten, links ruht die Liste; fertig steht rechts die Datei.
       Am Telefon zwei Schritte: Liste, dann Einstellungen mit "Back" (data-schritt).
       Vorbelegt wie Variante D: Datensatz der Seite, Filter des Drawers, Zeitraum -- ein Klick
       (Enter) genuegt.
       DAS GERUEST STEHT EINMAL, gezeichnet wird nur hinein (zeichnen). Ein innerHTML ueber den
       ganzen Inhalt bei jedem Klick haette zweierlei gekostet: den Fokus (wer mit der Tastatur
       Spalten abwaehlt, stuende danach im Nichts) und den Kalender, dessen Knoten hier lebt und
       seinen Zustand behalten muss. */
    var titelId = "uex-titel-" + String(instanceId).replace(/[^a-z0-9_-]/gi, "") + "-" + Math.random().toString(36).slice(2, 7);
    overlay.innerHTML =
      '<div class="up-topicmodal-card uex-dialog" role="dialog" aria-modal="true" aria-labelledby="' + titelId + '" data-phase="wahl" data-schritt="einst">' +
        '<div class="up-topicmodal-head uex-head">' +
          '<h2 class="up-topicmodal-title uex-titel" id="' + titelId + '"></h2>' +
          /* .up-popup-close ist der Knopf JEDES Popups: kein Rahmen, Hover nur Flaeche und
             Primaerfarbe. */
          '<button class="up-popup-close uex-close" type="button">' + (ic("x") || "&times;") + '</button>' +
        '</div>' +
        '<div class="uex-rumpf">' +
          /* Die Liste ist eine Radiogruppe ueber alle Bereiche: Pfeiltasten wandern durch alle
             zwoelf, nur der gewaehlte ist ein Tab-Halt. Die Bereichsnamen haengen per
             aria-describedby an ihren Eintraegen -- "Brands" gibt es zweimal. */
          '<div class="uex-nav" role="radiogroup"></div>' +
          '<div class="uex-body">' +
            /* Nur am Telefon (CSS): zurueck zur Liste. */
            '<button class="uex-zurueck" type="button">' + ic("arrowLeft") + '<span class="uex-zurueck-text"></span></button>' +
            '<div class="uex-wahl">' +
              '<div class="uex-titelblock">' +
                '<h3 class="uex-h3" id="' + titelId + '-h"></h3>' +
                '<p class="uex-beschr"></p>' +
              '</div>' +
              '<div class="uex-feld uex-feld-filter">' +
                /* Der Kopf wie bei den Spalten: Etikett links, rechts der leise Knopf aus core
                   (.up-filter-reset), der die abgewaehlten Filter zurueckholt. */
                '<div class="uex-spalten-kopf uex-filter-kopf">' +
                  '<span class="uex-feld-label" id="' + titelId + '-f"></span>' +
                  '<button class="up-filter-reset uex-filter-zurueck" type="button" data-uex-filterzurueck="1" hidden></button>' +
                '</div>' +
                '<div class="uex-chips" role="group" aria-labelledby="' + titelId + '-f"></div>' +
                '<p class="uex-filter-leer"></p>' +
              '</div>' +
              '<div class="uex-feld uex-feld-zeit">' +
                '<span class="uex-feld-label" id="' + titelId + '-z"></span>' +
                /* DAS FELD IST DER KALENDER AUS filters/date-range.js. Sein Ausloeser liegt
                   UNSICHTBAR ueber dem Feld und nimmt den Mausklick; sein Feld (Presets, Reset,
                   Monate) oeffnet darunter, und core hebt es in die oberste Ebene. Dasselbe Feld wie
                   in jeder Werkzeugleiste der App, nichts nachgebaut. Mit der Tastatur steht man auf
                   dem sichtbaren Knopf, Enter klickt den Ausloeser. Der Picker schliesst sein Feld
                   ueber einen Klick-Waechter am Dokument, sobald ein Klick ausserhalb seiner Wurzel
                   landet -- ein eigener Knopf daneben wuerde also immer schliessen-und-wieder-oeffnen. */
                '<div class="uex-zeit-wrap">' +
                  '<button class="uex-zeitfeld" type="button" aria-haspopup="dialog" aria-expanded="false" aria-labelledby="' + titelId + '-z ' + titelId + '-zw">' +
                    '<span class="uex-zf-ic">' + ic("calendar") + '</span>' +
                    '<span class="uex-zf-wert" id="' + titelId + '-zw"></span>' +
                    '<span class="uex-zf-sub"></span>' +
                    '<span class="uex-zf-chev">' + ic("chevronDown") + '</span>' +
                  '</button>' +
                  '<div class="uex-cal-slot"></div>' +
                '</div>' +
                /* Ohne Kalender (Loader ohne date-range.js) die vier Presets als Liste unter dem
                   Feld -- die Wahl bleibt moeglich, nur der freie Zeitraum fehlt, und das sagt der
                   Satz darunter. */
                '<div class="uex-optionen uex-presets" role="radiogroup" aria-labelledby="' + titelId + '-z" hidden></div>' +
                '<div class="up-fehlerzeile uex-zeit-fehler" role="alert"><span></span></div>' +
              '</div>' +
              '<div class="uex-feld uex-feld-spalten" role="group" aria-labelledby="' + titelId + '-s">' +
                '<div class="uex-spalten-kopf">' +
                  '<span class="uex-feld-label" id="' + titelId + '-s"></span>' +
                  '<span class="uex-spalten-zahl"></span>' +
                  '<button class="up-filter-reset uex-alle" type="button" data-uex-alle="1"></button>' +
                '</div>' +
                '<div class="uex-spalten"></div>' +
                '<div class="uex-spalten-satz"></div>' +
              '</div>' +
              /* Format ohne Wahl: es gibt nur CSV. Die Leinwand zeigt CSV | Excel -- einen
                 Umschalter mit einer einzigen Moeglichkeit gaebe es nur zum Ansehen, und eine
                 Excel-Datei baut die App nicht (das hiesse eine Bibliothek im Browser). Also steht
                 das Format fest da, und der Hinweis darunter sagt, dass Excel die Datei sicher
                 oeffnet. */
              '<div class="uex-feld uex-feld-format">' +
                '<span class="uex-feld-label"></span>' +
                '<span class="uex-format-wert">CSV</span>' +
              '</div>' +
              '<div class="uex-hinweis"></div>' +
            '</div>' +
            '<div class="uex-lauf" hidden>' +
              '<div class="uex-titelblock">' +
                '<h3 class="uex-h3 uex-lauf-titel"></h3>' +
                '<p class="uex-beschr uex-lauf-satz"></p>' +
              '</div>' +
              '<div class="uex-fortschritt">' +
                '<div class="uex-balken" role="progressbar" aria-valuemin="0"><div class="uex-balken-f"></div></div>' +
                '<div class="uex-zahlen"><span class="uex-zahl-n"></span><span class="uex-zahl-pct"></span></div>' +
              '</div>' +
              '<ol class="uex-schritte" aria-live="polite"></ol>' +
            '</div>' +
            '<div class="uex-fertig" hidden>' +
              '<span class="uex-fertig-ic">' + ic("checkCircle") + '</span>' +
              '<div class="uex-titelblock">' +
                '<h3 class="uex-h3 uex-fertig-titel"></h3>' +
                '<p class="uex-beschr uex-fertig-satz"></p>' +
              '</div>' +
              '<div class="uex-datei">' +
                '<span class="uex-datei-ic">' + ic("fileText") + '</span>' +
                '<span class="uex-datei-text"><span class="uex-datei-name"></span><span class="uex-datei-meta"></span></span>' +
              '</div>' +
              '<p class="uex-beschr uex-gekappt" hidden></p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="uex-foot">' +
          /* Links der Dateiname als Vorschau -- oder, wenn etwas schiefging, der rote Satz an
             seiner Stelle: dort steht er neben dem Knopf, der es erneut versucht, und rollt nie
             aus dem Bild. */
          /* DER NAME IST ZUGLEICH SEIN UMBENENNEN (17.10.): ein Klick macht aus dem Knopf das Feld
             daneben, in derselben Box (Hoehe 24, Rand 1, Polster 5) -- der Text bleibt an seiner
             Stelle, nur Rand und Grund kommen dazu. Bearbeitet wird nur der Stamm; ".csv" steht
             in beiden fest dahinter, damit niemand die Endung verliert oder doppelt tippt. Das
             Feld waechst mit dem Text (uex-foot-mass, unsichtbare Kopie im selben Rasterfeld);
             size="1", weil ein Feld sonst rund 20 Zeichen breit in die Messung eingeht. */
          '<div class="uex-foot-info"><span class="uex-foot-ic">' + ic("fileText") + '</span>' +
            '<button class="uex-foot-name" type="button"><span class="uex-foot-stamm"></span><span class="uex-foot-endung">.csv</span></button>' +
            '<label class="up-fieldwrap uex-foot-feld" hidden>' +
              '<span class="uex-foot-mass"><input class="uex-foot-in" type="text" size="1" maxlength="' + STAMM_MAX + '" ' +
                'autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"></span>' +
              '<span class="uex-foot-endung">.csv</span>' +
            '</label>' +
          '</div>' +
          '<div class="up-fehlerzeile uex-fehler" role="alert"><span></span></div>' +
          '<div class="uex-foot-knoepfe">' +
            '<button class="up-btn-sec uex-zweit" type="button"><span class="uex-zweit-text"></span></button>' +
            '<button class="up-btn-pri uex-submit" type="button"><span class="uex-submit-icon"></span><span class="uex-submit-text"></span></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    /* Verwaiste Overlays derselben Instanz wegraeumen. Bubble baut diese Elemente staendig neu
       auf, und jeder Aufbau haengte bisher ein weiteres Overlay an <body> -- gemessen 36 Stueck
       bei 14 Elementen. Das ist nicht nur Speicher: die alten reagieren weiter auf Escape und
       auf ihre eigenen Klicks, und welches davon upstreemExportOpen erwischt, ist Zufall. */
    var alt = document.querySelectorAll('.uex-overlay[data-uex-instance="' + instanceId + '"]');
    for (var a = 0; a < alt.length; a++){
      if (alt[a].parentNode) alt[a].parentNode.removeChild(alt[a]);
    }
    overlay.setAttribute("data-uex-instance", instanceId);
    document.body.appendChild(overlay);

    function q(sel){ return overlay.querySelector(sel); }
    var elDialog  = q(".uex-dialog");
    var elBody    = q(".uex-body");
    var elTitel   = q(".uex-titel");
    var elNav     = q(".uex-nav");
    var elClose   = q(".uex-close");
    var elZurueck = q(".uex-zurueck");
    var elWahl    = q(".uex-wahl");
    var elLauf    = q(".uex-lauf");
    var elFertig  = q(".uex-fertig");
    var elFehler  = q(".uex-fehler");
    var elHinweis = q(".uex-hinweis");
    var elPresets = q(".uex-presets");
    var elZeitWrap = q(".uex-zeit-wrap");
    var elZeitfeld = q(".uex-zeitfeld");
    var elZeitFehler = q(".uex-zeit-fehler");
    var elCalSlot = q(".uex-cal-slot");
    var elFoot    = q(".uex-foot");
    var elFootInfo = q(".uex-foot-info");
    var elFootName = q(".uex-foot-name");
    var elFootStamm = q(".uex-foot-stamm");
    var elFootFeld = q(".uex-foot-feld");
    var elFootMass = q(".uex-foot-mass");
    var elFootIn  = q(".uex-foot-in");
    /* Der Screenreader hoert "Rename file" als Namen des Knopfs und den Dateinamen als
       Beschreibung -- ein aria-label allein haette den Namen verschluckt. */
    elFootStamm.id = titelId + "-dn";
    elFootName.setAttribute("aria-describedby", elFootStamm.id);
    var elZweit   = q(".uex-zweit");
    var elSubmit  = q(".uex-submit");
    var elSubmitIcon = q(".uex-submit-icon");
    var elSubmitText = q(".uex-submit-text");
    var SPINNER_SVG = '<span class="uex-spin" aria-hidden="true"></span>';

    function syncTheme(){
      var dark = dunkelJetzt(root.getAttribute("data-isdark"));
      isDark = dark;
      if (dark){ root.setAttribute("data-theme","dark"); overlay.setAttribute("data-theme","dark"); }
      else { root.removeAttribute("data-theme"); overlay.removeAttribute("data-theme"); }
    }

    /* ---------------- zeichnen ----------------
       Hilfen: setzen() schreibt nur, wenn sich etwas aendert -- sonst verloere ein fokussierter
       Knopf in einer Liste bei jedem Neuzeichnen seinen Fokus. */
    function setzen(el, html){ if (el && el.__uexHtml !== html){ el.__uexHtml = html; el.innerHTML = html; } }
    function text(el, s){ if (el && el.textContent !== s) el.textContent = s; }
    function zahl(n){ var C = window.UpstreemCore; return C && C.fmtInt ? C.fmtInt(n) : String(n); }
    function datum(d){
      var C = window.UpstreemCore;
      /* Das Datumsformat des Nutzers (UC.fmtDate). Als lokaler Zeitpunkt, nicht als "2026-07-15":
         den liest Date als UTC-Mitternacht, und westlich von UTC stuende der Vortag da. */
      return C && C.fmtDate ? C.fmtDate(isoDate(d) + "T00:00:00") : prettyDate(d);
    }
    /* Zeitraum wie im Styleguide (1c): beide Enden im App-Format, Halbgeviertstrich dazwischen. */
    function spanne(f, t){ return datum(f) + " – " + datum(t); }
    function presetSpanne(p){
      var t = startOfDay(new Date());
      return spanne(p.days ? addDays(t, -(p.days - 1)) : addMonths(t, -p.months), t);
    }
    function groesse(b){
      var C = window.UpstreemCore, f = C && C.fmtNum ? function(v, n){ return C.fmtNum(v, n); } : function(v, n){ return v.toFixed(n); };
      if (b < 1024) return b + " B";
      if (b < 1048576) return f(b / 1024, b < 10240 ? 1 : 0) + " KB";
      return f(b / 1048576, 1) + " MB";
    }
    /* Roving tabindex in einer Radiogruppe: nur die gewaehlte Zeile ist ein Tab-Halt, die Pfeile
       wandern (Tastatur unten). an: die Klasse des gewaehlten Zustands (.is-active an der
       Menuezeile, .is-on an der Zeile der Liste). */
    function radioStand(btn, an, klasse){
      btn.classList.toggle(klasse || "is-active", an);
      btn.setAttribute("aria-checked", an ? "true" : "false");
      btn.setAttribute("tabindex", an ? "0" : "-1");
    }

    /* Die Parameter der Seite fuer einen Datensatz ueber der Brille der App (siehe brille). */
    function seitenParams(art){
      var out = state.ohneBrille ? {} : brille(art), x = state.params[art];
      if (x) Object.keys(x).forEach(function(n){ if (voll(x[n]) || !Object.prototype.hasOwnProperty.call(out, n)) out[n] = x[n]; });
      return out;
    }
    function selbstMoeglich(art){
      var cfg = EXPORTE[art];
      return !!(cfg && kern() && (cfg.neu || !BUBBLE_TYP[art]));
    }
    function gewaehlteSpalten(art){
      var e = spaltenVon(art), cfg = EXPORTE[art];
      if (!e || !e.spalten || !cfg) return null;
      var aus = state.ohne[cfg.spalten] || {};
      return e.spalten.filter(function(c){ return !aus[c.key]; });
    }
    function keineSpalten(){
      if (!selbstMoeglich(state.type)) return false;
      var g = gewaehlteSpalten(state.type);
      return !!g && g.length === 0;
    }
    function kurzUrl(u){ return String(u).replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, ""); }
    /* Der Dateiname, wie exportSelbst ihn vergibt -- im Fuss als Vorschau, im Fertig-Zustand der
       echte. Eine Quelle fuer beide, damit die Vorschau nie etwas anderes verspricht. */
    /* Vorne das aktive Team statt der Marke (17.10., "den Teamnamen statt upstreem"): wer mehrere
       Teams exportiert, sieht im Download-Ordner, welche Datei wem gehoert. Der Name kommt
       von dort, wo auch der Reitertitel ihn hat (UC.teamName, gesetzt beim App-Start und nach
       einer Umbenennung) -- bei jedem Zeichnen frisch gelesen, ein spaeteres Oeffnen traegt also
       den neuen Namen. Ohne Team (Bubble, noch nicht geladen, nur Sonderzeichen) die Marke. */
    function namenVorschlag(art){
      var cfg = EXPORTE[art], C = window.UpstreemCore;
      var typName = (cfg && cfg.datei) || (typVon(art) || { label: art }).label;
      var team = "";
      try { team = namensTeil(C && C.teamName ? C.teamName() : "", TEAM_MAX); } catch(e){ team = ""; }
      return (team || "upstreem") + "-" + typName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + isoDate(state.from) + "-" + isoDate(state.to);
    }
    function dateiStamm(art){ return state.eigenName || namenVorschlag(art); }
    function dateiName(art){ return dateiStamm(art) + ".csv"; }

    /* ---- Kontext: welche Filter gelten fuer diesen Datensatz? ----
       Die Drawer-Filter nur im Scope (FILTER oben), die Seitenfilter nur fuer die Datensaetze, fuer
       die die Seite sie gemeldet hat, und nur, wenn die Funktion sie kennt (KENNT). Seitenfilter nur
       auf dem Weg ueber die App: der Bubble-Weg traegt sie nicht (seine Nutzlast kennt nur Adresse,
       Domain, Prompt und Brand), ein Chip stuende dort fuer einen Filter, der nicht gilt.
       mitWeg: auch die abgewaehlten (fuer "Restore filters"); sie tragen weg: true. */
    function namenListe(werte, fn){
      var l = (Array.isArray(werte) ? werte : [werte]).map(function(v){ var n = fn ? fn(String(v)) : ""; return n || String(v); });
      /* Wie die Chips der Filterleiste: zwei Namen, dann "+n" -- der ganze Satz steht im title. */
      return { kurz: l.length > 2 ? l.slice(0, 2).join(", ") + ", +" + (l.length - 2) : l.join(", "), lang: l.join(", ") };
    }
    function finde(liste, feld, id){
      for (var i = 0; i < liste.length; i++){
        var x = liste[i]; if (!x) continue;
        for (var j = 0; j < feld.length; j++) if (x[feld[j]] != null && String(x[feld[j]]).toLowerCase() === String(id).toLowerCase()) return x;
      }
      return null;
    }
    /* Der lesbare Wert eines Chips. Namen kommen aus den Ablagen von core (dieselben, aus denen die
       Filter ihre Zeilen bauen); was dort fehlt, bleibt als roher Schluessel stehen -- "Model:
       gpt-4o" ist eine Auskunft, eine Zahl waere keine (wie in der Filterleiste). */
    function chipWert(c, x, art){
      var C = window.UpstreemCore || {}, n = state.namen[c.key];
      if (n) return { kurz: String(n), lang: String(n) };
      var v = x[c.params[0]];
      function liste(fn){ return namenListe(v, fn); }
      switch (c.key){
        case "search": var s = "“" + String(v) + "”"; return { kurz: s, lang: s };
        case "models": return liste(function(k){ var m = finde(C.getModels ? C.getModels() : [], ["key", "model"], k); return m ? String(m.display_name || m.name || "") : ""; });
        case "markets": return liste(function(k){ return C.landName ? C.landName(k) : k; });
        case "topics": return liste(function(k){ var t = finde(C.getTopics ? C.getTopics() : [], ["topic_id", "tag_id", "id"], k); return t ? String(t.name || "") : ""; });
        case "intents": return liste(function(k){ var a = C.intentArt ? C.intentArt(k) : null; return a && C.intentName ? C.intentName(a) : ""; });
        case "brands": return liste(function(k){ var b = finde(C.getBrands ? C.getBrands() : [], ["company_id", "id"], k); return b ? String(b.name || "") : ""; });
        case "citation_types": return liste(function(k){ return C.typLabel ? C.typLabel(k, "citation") : ""; });
        case "url_types": return liste(function(k){ return C.typLabel ? C.typLabel(k, "url") : ""; });
        case "branded": var b = art === "prompts" ? (v === "branded" ? tr("Branded") : "Non-branded") : tr("Included"); return { kurz: b, lang: b };
        case "mentioned": var me = v === "yes" ? tr("Mentioned") : tr("Not mentioned"); return { kurz: me, lang: me };
        case "segment": var sg = { you: "You", competition: "Competition", other: "Other" }[v]; sg = sg ? tr(sg) : String(v); return { kurz: sg, lang: sg };
        case "product": var pr = tr("This product"); return { kurz: pr, lang: pr };
        case "company": return liste(function(k){ var b2 = finde(C.getBrands ? C.getBrands() : [], ["company_id", "id"], k); return b2 ? String(b2.name || "") : ""; });
        case "rank": case "sentiment":
          /* Ein Bereich wie im Chip der Leiste: "1–3"; offen nach oben "5+". */
          var lo = x[c.params[0]], hi = x[c.params[1]], r = voll(lo) && voll(hi) ? lo + "–" + hi : (voll(lo) ? lo + "+" : (c.key === "rank" ? "1" : "0") + "–" + hi);
          return { kurz: String(r), lang: String(r) };
      }
      return liste(null);
    }
    function filterFuer(art, mitWeg){
      var out = [];
      FILTER.forEach(function(f){
        var v = state[f.feld];
        if (!v || f.typen.indexOf(art) < 0) return;
        if (state.weg[f.feld] && !mitWeg) return;
        var l = f.feld === "url" ? kurzUrl(v) : (f.feld === "domain" ? String(v) : (state.filterLabel || tr(f.ersatz)));
        out.push({ feld: f.feld, icon: f.icon, label: l, title: l, weg: !!state.weg[f.feld] });
      });
      var x = seitenParams(art), kennt = KENNT[art] || [];
      if (!selbstMoeglich(art)) return out;
      SEITE.forEach(function(c){
        var haupt = c.params.filter(function(n){ return n !== "p_tagmode" && kennt.indexOf(n) >= 0 && (c.aktiv ? c.aktiv(x[n], art) : voll(x[n])); });
        if (!haupt.length) return;
        if (state.weg[c.key] && !mitWeg) return;
        /* Der erste gesetzte Parameter traegt den Wert (Brands: p_company_ids ODER p_mentioned_brands). */
        var cc = { key: c.key, params: haupt.concat(c.params.filter(function(n){ return haupt.indexOf(n) < 0; })) };
        var w = chipWert(cc, x, art);
        var name = tr(c.key === "branded" && art === "prompts" ? "Prompt type" : c.name);
        out.push({ feld: c.key, icon: c.icon, label: name + ": " + w.kurz, title: name + ": " + w.lang, weg: !!state.weg[c.key] });
      });
      return out;
    }
    function filterChipsHtml(art){
      /* Das Kreuz nur, solange gewaehlt wird -- im Lauf und danach aendert es nichts mehr. */
      var wahl = state.phase === "wahl";
      return filterFuer(art).map(function(f){
        return '<span class="up-entchip is-static uex-chip' + (wahl ? "" : " is-fest") + '" title="' + esc(f.title) + '">' +
          '<span class="uex-chip-ic">' + ic(f.icon) + '</span><span class="uex-chip-lbl">' + esc(f.label) + '</span>' +
          (wahl ? '<button class="up-iconbtn is-20 uex-chip-x" type="button" data-uex-filterweg="' + esc(f.feld) + '" aria-label="' +
            esc(tr("Remove filter {name}").replace("{name}", f.title)) + '">' + ic("x") + '</button>' : '') + '</span>';
      }).join("");
    }

    /* Welche Datensaetze links stehen: alle der Grundgruppe, Shopping und Ads nur in der App (ohne
       core und Team gibt es ihren Export nicht -- ein Eintrag, der nur einen Fehler bringt, steht
       besser gar nicht da). Ist einer davon gewaehlt, steht seine Gruppe trotzdem. */
    function sichtbareTypen(art){
      var k = !!kern(), g = gruppeVon(art);
      return TYPES.filter(function(t){ return !t.gruppe || k || t.gruppe === g; });
    }
    function navZeichnen(art){
      var typen = sichtbareTypen(art), html = "", zuletzt = null, nr = 0;
      typen.forEach(function(t){
        var bereich = quelleVon(t.value);
        if (bereich !== zuletzt){
          zuletzt = bereich; nr++;
          html += '<div class="uex-bereich" id="' + titelId + '-b' + nr + '"><span class="uex-bereich-name">' + esc(tr(bereich)) + '</span>' +
            (BETA[bereich] ? '<span class="up-marke is-akzent uex-beta">' + esc(tr("Beta")) + '</span>' : '') + '</div>';
        }
        html += '<button class="up-optrow uex-navitem" type="button" role="radio" aria-checked="false" tabindex="-1" data-type="' + t.value + '" aria-describedby="' + titelId + '-b' + nr + '">' +
          '<span class="uex-nav-ic">' + ic(t.icon) + '</span><span class="uex-nav-lbl">' + esc(tr(t.label)) + '</span><span class="uex-nav-zusatz"></span></button>';
      });
      setzen(elNav, html);
      elNav.setAttribute("aria-label", tr("Data"));
      [].forEach.call(elNav.querySelectorAll("[data-type]"), function(b){
        var v = b.getAttribute("data-type");
        radioStand(b, v === art, "is-on");
        /* Der ganze Name im title: lange Namen (deutsch) enden mit Auslassungspunkten. */
        var lbl = b.querySelector(".uex-nav-lbl");
        if (lbl) lbl.title = lbl.textContent;
        /* Rechts am Eintrag: "Soon", wenn es den Export noch nicht gibt, sonst das Filterzeichen,
           wenn ein Filter aus dem Kontext fuer ihn gilt -- so sieht man, wo der Scope liegt, auch
           wenn gerade ein anderer Datensatz gewaehlt ist. */
        var bald = baldSatz(v), f = filterFuer(v), z = "";
        if (bald) z = '<span class="uex-nav-bald">' + esc(tr("Soon")) + '</span>';
        else if (f.length){
          var name = tr("Filtered to {name}").replace("{name}", f.map(function(x){ return x.title; }).join(", "));
          z = '<span class="uex-nav-filter" title="' + esc(name) + '" aria-label="' + esc(name) + '" role="img">' + ic("listFilter") + '</span>';
        }
        setzen(b.querySelector(".uex-nav-zusatz"), z);
      });
    }

    function filterZeichnen(art){
      var html = filterChipsHtml(art);
      /* Abgewaehlte, die fuer diesen Datensatz gaelten: dann steht das Feld weiter da, mit "Restore
         filters" im Kopf (wie "Select all" bei den Spalten) -- und sind alle weg, sagt der Satz,
         was jetzt in die Datei geht. Im Lauf und danach aendert das nichts mehr. */
      var zurueck = state.phase === "wahl" && filterFuer(art, true).some(function(f){ return f.weg; });
      q(".uex-feld-filter").hidden = !html && !zurueck;
      /* data-i18n mit dem englischen Schluessel: das deutsche "Filter" ist selbst ein Schluessel in
         core ("Filter" -> "Filtern", das Verb), und der Sprachlauf von core machte daraus sonst
         "Filtern" (gemessen 16.10.). Mit dem Schluessel erkennt er den Text als fertig. */
      var lab = q(".uex-feld-filter .uex-feld-label");
      lab.setAttribute("data-i18n", "Filters");
      text(lab, tr("Filters"));
      var knopf = q(".uex-filter-zurueck");
      text(knopf, tr("Restore filters"));
      knopf.hidden = !zurueck;
      setzen(q(".uex-chips"), html);
      var leer = q(".uex-filter-leer");
      text(leer, !html && zurueck ? tr("Without filters, every row in the date range is exported.") : "");
    }

    function zeitZeichnen(){
      var custom = state.preset === "custom";
      var p = PRESETS.filter(function(x){ return x.key === state.preset; })[0];
      text(q(".uex-feld-zeit .uex-feld-label"), tr("Date range"));
      text(q(".uex-zf-wert"), custom || !p ? tr("Custom range") : tr(p.label));
      text(q(".uex-zf-sub"), spanne(state.from, state.to));
      /* Ein Zeitraum, den die Datenbank ablehnt, steht am Feld (Leinwand: roter Rahmen, Satz
         darunter), nicht im Fuss -- dort, wo man ihn aendert. */
      elZeitfeld.classList.toggle("is-fehler", !!state.zeitFehler);
      elZeitfeld.setAttribute("aria-invalid", state.zeitFehler ? "true" : "false");
      var mitCal = elZeitWrap.classList.contains("has-cal");
      /* Ohne Kalender: die Ersatzliste der Presets, mit dem Satz, warum der freie Zeitraum fehlt. */
      var listeAuf = !mitCal && state.offen === "zeit";
      elPresets.hidden = !listeAuf;
      if (!mitCal) elZeitfeld.setAttribute("aria-expanded", listeAuf ? "true" : "false");
      if (listeAuf){
        setzen(elPresets, PRESETS.map(function(x){
          return '<button class="up-pop-opt uex-opt" type="button" role="radio" aria-checked="false" tabindex="-1" data-preset="' + x.key + '">' +
            '<span class="up-pop-opt-l"><span class="uex-opt-label">' + esc(tr(x.label)) + '</span></span>' +
            '<span class="uex-opt-sub"></span><span class="up-check" aria-hidden="true">' + ic("check") + '</span></button>';
        }).join("") + '<p class="uex-presets-satz">' + esc(tr("Custom range is unavailable. Please reload the page.")) + '</p>');
        [].forEach.call(elPresets.querySelectorAll("[data-preset]"), function(b){
          var x = PRESETS.filter(function(y){ return y.key === b.getAttribute("data-preset"); })[0];
          text(b.querySelector(".uex-opt-sub"), x ? presetSpanne(x) : "");
          radioStand(b, b.getAttribute("data-preset") === state.preset);
        });
      }
      elZeitFehler.classList.toggle("is-on", !!state.zeitFehler);
      text(elZeitFehler.querySelector("span"), state.zeitFehler || "");
    }

    function spaltenZeichnen(art){
      var cfg = EXPORTE[art], e = spaltenVon(art), sel = gewaehlteSpalten(art);
      var kann = selbstMoeglich(art) && !!sel;
      /* Skelett, solange gefragt wird oder noch nie gefragt wurde. Hat die Frage keine Antwort
         gebracht (Netz, Zeitablauf: versucht, stand weiter null), steht "All columns" -- sonst
         liefe das Skelett endlos, und Laden saehe aus wie kaputt. */
      var laedt = selbstMoeglich(art) && !sel && !!e && (e.laeuft || e.stand === null && !e.versucht && !!cfg && !BUBBLE_TYP[art]);
      var n = kann ? e.spalten.length : 0, k = kann ? sel.length : 0;
      text(q(".uex-feld-spalten .uex-feld-label"), tr("Columns"));
      var zahlEl = q(".uex-spalten-zahl");
      text(zahlEl, kann ? (k === n ? tr("{n} columns").replace("{n}", zahl(n)) : tr("{k} of {n} columns").replace("{k}", zahl(k)).replace("{n}", zahl(n))) : "");
      var alle = q(".uex-alle");
      text(alle, tr("Select all"));
      alle.hidden = !kann || k === n;
      var gitter = q(".uex-spalten"), satz = q(".uex-spalten-satz");
      if (kann){
        /* Die Checkliste aus core (.up-filter-item/-check), zweispaltig wie auf der Leinwand. Gebaut
           je Spaltensatz, danach nur der Stand. */
        var aus = state.ohne[cfg.spalten] || {};
        setzen(gitter, e.spalten.map(function(c){
          var name = tr(c.header || c.key);
          return '<button class="up-filter-item uex-spalte" type="button" role="checkbox" aria-checked="true" data-spalte="' + esc(c.key) + '" title="' + esc(name) + '">' +
            '<span class="up-filter-check">' + ic("check") + '</span><span class="uex-spalte-lbl">' + esc(name) + '</span></button>';
        }).join(""));
        [].forEach.call(gitter.querySelectorAll("[data-spalte]"), function(b){
          var an = !aus[b.getAttribute("data-spalte")];
          b.classList.toggle("is-checked", an);
          b.setAttribute("aria-checked", an ? "true" : "false");
        });
        gitter.classList.remove("is-laden");
        /* Keine Spalte gewaehlt: der Knopf ruht, der Satz sagt warum -- direkt unter der Liste. */
        setzen(satz, k === 0 ? ic("info") + '<span>' + esc(tr("Choose at least one column.")) + '</span>' : "");
        return;
      }
      if (laedt){
        /* Das Skelett nur beim ersten Laden des Spaltensatzes (danach steht er im Speicher DA). */
        setzen(gitter, [62, 48, 70, 40, 56, 66, 44, 52].map(function(w){
          return '<span class="uex-spalte-sk"><span class="up-skelett uex-sk-box"></span><span class="up-skelett uex-sk-text" style="width:' + w + '%"></span></span>';
        }).join(""));
        gitter.classList.add("is-laden");
        setzen(satz, "");
        return;
      }
      /* Ohne Spaltenliste (Bubble-Weg, oder export_columns_v1 hat nicht geantwortet): die Datei
         hat alle Spalten, und genau das steht da. */
      setzen(gitter, ""); gitter.classList.remove("is-laden");
      setzen(satz, '<span>' + esc(tr("All columns")) + '</span>');
    }

    function hinweisZeichnen(art){
      var cfg = EXPORTE[art];
      if (cfg && selbstMoeglich(art)){
        /* Die Grenze vorab (Ahrefs): so viele Zeilen passen in einen Lauf -- Seitengroesse mal die
           60 Seiten, die die Datenbank je Minute erlaubt. Formelschutz macht die Datenbank
           (csv_safe_v1); beides gilt nur fuer den Weg ueber die App, nicht fuer Bubble. */
        setzen(elHinweis, ic("shieldCheck") + '<span>' + esc(tr("Safe to open in Excel and Sheets. Up to {n} rows.").replace("{n}", zahl(cfg.seite * MAX_SEITEN))) + '</span>');
        elHinweis.hidden = false; return;
      }
      setzen(elHinweis, ""); elHinweis.hidden = true;
    }

    function wahlZeichnen(art){
      var label = typVon(art);
      text(q(".uex-wahl .uex-h3"), label ? tr(label.label) : art);
      text(q(".uex-wahl .uex-beschr"), label ? tr(label.beschr) : "");
      /* Fehlt der Export noch (Shopping, Ads), steht unter der Ueberschrift nur der Satz, und der
         Knopf ruht -- Zeitraum und Spalten haetten dann nichts, wofuer sie gelten. */
      var bald = baldSatz(art);
      elWahl.classList.toggle("is-bald", !!bald);
      filterZeichnen(art);
      zeitZeichnen();
      spaltenZeichnen(art);
      text(q(".uex-feld-format .uex-feld-label"), tr("Format"));
      if (bald){
        elHinweis.classList.add("is-bald");
        setzen(elHinweis, ic("clock") + '<span>' + esc(bald) + '</span>');
        elHinweis.hidden = false;
      } else {
        elHinweis.classList.remove("is-bald");
        hinweisZeichnen(art);
      }
    }

    function laufZeichnen(){
      var L = state.lauf, art = state.type, label = typVon(art);
      if (!L) return;
      text(q(".uex-lauf-titel"), tr("Exporting {typ}").replace("{typ}", label ? tr(label.label) : art));
      text(q(".uex-lauf-satz"), tr("Closing this window stops the export."));
      var max = L.gesamt != null ? Math.min(L.gesamt, L.kappe) : null;
      var bar = q(".uex-balken");
      /* Der Balken zeigt nur echten Fortschritt (Zeilen von total_count). Kennt die Antwort keine
         Gesamtzahl, steht kein Balken da statt eines erfundenen -- vor der ersten Seite steht er
         leer, weil die Gesamtzahl mit ihr kommt. */
      var mitBalken = max != null || L.seiten === 0;
      bar.hidden = !mitBalken;
      bar.setAttribute("aria-label", tr("Export progress"));
      if (max != null){ bar.setAttribute("aria-valuemax", String(max)); bar.setAttribute("aria-valuenow", String(Math.min(L.zeilen, max))); }
      else { bar.removeAttribute("aria-valuemax"); bar.setAttribute("aria-valuenow", "0"); }
      var anteil = max ? Math.min(100, L.zeilen / max * 100) : 0;
      q(".uex-balken-f").style.width = anteil.toFixed(1) + "%";
      text(q(".uex-zahl-n"), max != null ? tr("{k} of {n} rows").replace("{k}", zahl(L.zeilen)).replace("{n}", zahl(max))
        : tr("{n} rows").replace("{n}", zahl(L.zeilen)));
      text(q(".uex-zahl-pct"), max ? zahl(Math.floor(anteil)) + "%" : "");
      /* Die drei Schritte der Leinwand: Spalten, Zeilen, Datei. Fertig mit Haken, der laufende mit
         dem Kreisel, der kommende mit der Uhr (ein gestrichelter Kreis steht nicht im Zeichensatz
         von core, und selbst gezeichnet wird keins). */
      var seitenGesamt = max != null ? Math.max(1, Math.ceil(max / L.limit)) : null;
      var k = seitenGesamt ? Math.min(L.seiten + 1, seitenGesamt) : L.seiten + 1;
      var schritte = [
        { stand: L.spalten != null ? "fertig" : "aktiv", label: L.spalten != null ? tr("Columns loaded") : tr("Loading columns"),
          meta: L.spalten != null ? tr("{n} columns").replace("{n}", zahl(L.spalten)) : "" },
        { stand: L.spalten == null ? "kommt" : "aktiv", label: tr("Fetching rows"),
          meta: L.spalten == null ? "" : (seitenGesamt ? tr("Page {k} of {n}").replace("{n}", zahl(seitenGesamt)) : tr("Page {k}")).replace("{k}", zahl(k)) },
        { stand: "kommt", label: tr("Building the file"), meta: "" }
      ];
      setzen(q(".uex-schritte"), schritte.map(function(s){
        var zeichen = s.stand === "fertig" ? ic("checkCircle") : (s.stand === "aktiv" ? SPINNER_SVG : ic("clock"));
        return '<li class="uex-schritt is-' + s.stand + '"><span class="uex-schritt-ic">' + zeichen + '</span>' +
          '<span class="uex-schritt-lbl">' + esc(s.label) + '</span><span class="uex-schritt-meta">' + esc(s.meta) + '</span></li>';
      }).join(""));
    }

    function fertigZeichnen(){
      var E = state.ergebnis;
      if (!E) return;
      text(q(".uex-fertig-titel"), E.n === 1 ? tr("1 row exported") : tr("{n} rows exported").replace("{n}", zahl(E.n)));
      text(q(".uex-fertig-satz"), tr("Your file has been downloaded."));
      var nm = q(".uex-datei-name");
      text(nm, E.name); nm.title = E.name;
      /* Die Groesse ist die der Datei, die der Browser gerade gebaut hat (Blob.size) -- gemessen,
         nicht geschaetzt; die Datenbank liefert keine. */
      text(q(".uex-datei-meta"), (E.spalten === 1 ? tr("{groesse}, 1 column, CSV") : tr("{groesse}, {n} columns, CSV").replace("{n}", zahl(E.spalten)))
        .replace("{groesse}", groesse(E.groesse)));
      var s = q(".uex-gekappt");
      s.hidden = !E.gekappt && !E.abweichung;
      text(s, E.gekappt ? tr("The export was cut at {n} rows. Choose a shorter range for the rest.").replace("{n}", zahl(E.n))
        : E.abweichung ? tr("The file has {n} rows, but {gesamt} were expected. It may be incomplete. Export again to be sure.").replace("{n}", zahl(E.n)).replace("{gesamt}", zahl(E.erwartet))
        : "");
    }

    function fussZeichnen(art){
      var label = typVon(art), ph = state.phase;
      /* Links: der Dateiname -- als Vorschau, im Lauf der kommende, fertig der echte. Nur wo die
         App die Datei selbst baut; den Namen der Bubble-Datei kennt sie nicht. */
      var name = ph === "fertig" && state.ergebnis ? state.ergebnis.name
        : (selbstMoeglich(art) && !baldSatz(art) ? dateiName(art) : "");
      var fehler = ph === "wahl" ? state.fehler : "";
      elFehler.classList.toggle("is-on", !!fehler);
      text(elFehler.querySelector("span"), fehler || "");
      elFootInfo.hidden = !!fehler || !name;
      /* Umbenennen nur in der Wahl: im Lauf steht der Name schon fest, fertig ist die Datei schon
         unterwegs. Dort ist der Knopf gesperrt und sieht aus wie Text (CSS). */
      var umbenennbar = ph === "wahl" && !state.processing && !!name;
      if (!umbenennbar) state.namenEdit = false;
      text(elFootStamm, name.replace(/\.csv$/i, ""));
      elFootName.disabled = !umbenennbar;
      if (umbenennbar){ elFootName.setAttribute("aria-label", tr("Rename file")); elFootName.title = tr("Rename file"); }
      else { elFootName.removeAttribute("aria-label"); elFootName.title = name; }
      elFootName.hidden = state.namenEdit;
      elFootFeld.hidden = !state.namenEdit;
      elFootIn.setAttribute("aria-label", tr("Rename file"));
      text(q(".uex-zweit-text"), ph === "laeuft" ? tr("Cancel export") : (ph === "fertig" ? tr("Export another") : tr("Cancel")));
      /* Der Bubble-Weg wartet auf upstreemExportResolve: schliessen kann ihn dann nur Bubble. */
      elZweit.disabled = !!state.processing;
      if (ph === "fertig"){
        setzen(elSubmitIcon, "");
        text(elSubmitText, tr("Done"));
        elSubmit.disabled = false;
        elSubmit.classList.remove("is-busy");
        return;
      }
      var busy = ph === "laeuft" || !!state.processing;
      setzen(elSubmitIcon, busy ? SPINNER_SVG : ic("download"));
      text(elSubmitText, busy ? tr("Exporting…") : tr("Export {typ}").replace("{typ}", label ? tr(label.label) : art));
      elSubmit.classList.toggle("is-busy", busy);
      knopfStand();
    }

    function zeichnen(){
      var art = state.type;
      text(elTitel, tr("Export data"));
      elClose.setAttribute("aria-label", tr("Close"));
      text(q(".uex-zurueck-text"), tr("Back"));
      elDialog.setAttribute("data-phase", state.phase);
      elDialog.setAttribute("data-schritt", state.schritt);
      elWahl.hidden = state.phase !== "wahl";
      elLauf.hidden = state.phase !== "laeuft";
      elFertig.hidden = state.phase !== "fertig";
      /* Im Lauf und danach ruht die Liste: ein anderer Datensatz gilt erst fuer den naechsten
         Export ("Export another"). inert nimmt sie auch aus der Tab-Folge. */
      var ruht = state.phase !== "wahl" || !!state.processing;
      elNav.classList.toggle("is-ruht", ruht);
      elNav.inert = ruht;
      elBody.classList.toggle("is-processing", !!state.processing);
      navZeichnen(art);
      if (state.phase === "wahl") wahlZeichnen(art);
      if (state.phase === "laeuft") laufZeichnen();
      if (state.phase === "fertig") fertigZeichnen();
      fussZeichnen(art);
    }
    /* renderAll zeichnet den GANZEN Inhalt des Dialogs. Am Aufruf beim Oeffnen stand ein leerer
       Faenger ohne Rueckfall: warf hier etwas, ging der Dialog leer auf, und leer sah damit
       genauso aus wie kaputt. Jetzt sagt er, dass er sich nicht aufbauen liess, und was zu tun
       ist. Kein interner Name, kein Verweis auf die Konsole.
       window.UpstreemCore direkt und mit Rueckfall, wie ueberall in dieser Datei: sie kommt ohne
       core aus (siehe setContext), und gerade der Fehlerfall darf nicht an einem fehlenden UC
       scheitern. */
    function aufbauFehler(){
      if (!elBody) return;
      var C = window.UpstreemCore;
      elBody.innerHTML = (C && C.leerHtml)
        ? C.leerHtml({ icon: "info", knopf: "",
            titel: "Export options could not be shown",
            text: "Please reload the page and try again." })
        : '<div class="up-empty">' +
            '<div class="up-empty-h">Export options could not be shown</div>' +
            '<div class="up-empty-t">Please reload the page and try again.</div>' +
          '</div>';
    }
    function renderAll(){
      try { zeichnen(); }
      catch(e){ aufbauFehler(); }
    }

    function applyPreset(key){
      var p = PRESETS.filter(function(x){ return x.key === key; })[0];
      if (!p) return;
      state.preset = key;
      // Drive the real picker and then adopt exactly what IT committed, rather than computing the
      // range twice in two places. That keeps the calendar showing the same thing the popup shows
      // (it used to sit at its own "Last 7 Days" no matter what was picked up here) and means any
      // clamping the picker applies — e.g. its 2024-01-01 lower bound — is honoured automatically.
      // Silent on purpose: syncing the display must not fire the picker's Bubble workflows.
      var synced = syncCalendarToPreset(key);
      if (!synced){
        var t = startOfDay(new Date());
        state.to = t;
        state.from = p.days ? addDays(t, -(p.days - 1)) : addMonths(t, -p.months);
      }
      persist(); renderAll();
    }
    /* Returns true only if the picker was actually driven AND reported a range back. */
    function syncCalendarToPreset(key){
      var cal = findCalendar();
      /* __udrCtrl, NICHT __udrController. Die Standalone-Fassung fragte den falschen Namen ab --
         der Zweig war damit immer false, der Picker wurde nie mitgezogen und stand bei "Last 7
         Days", egal was im Popup gewaehlt war. Gemessen: Popup zeigte 30 Tage, der Kalender
         weiterhin 7. Fallback ueber setDateRangePreset, falls die Datei ihre Innereien einmal
         anders benennt -- die globale Funktion ist der dokumentierte Weg. */
      var ctrl = cal && cal.__udrCtrl;
      if (ctrl && typeof ctrl.setPreset === "function"){
        try { if (ctrl.setPreset(key, false) === false) return false; } catch(e){ return false; }
      } else if (window.setDateRangePreset){
        try { if (window.setDateRangePreset(calendarId(), key, false) === false) return false; } catch(e){ return false; }
      } else return false;
      if (!cal) return false;
      var f = parseIso(cal.getAttribute("data-date-from"));
      var t = parseIso(cal.getAttribute("data-date-to"));
      if (!f || !t) return false;
      state.from = f; state.to = t;
      return true;
    }

    /* ---------------- Kalender ----------------
       Die Standalone-Fassung holte sich einen fremden Picker von der Seite, schob seinen Knoten
       in den Dialog und nach dem Schliessen wieder zurueck. Das verlangte auf JEDER Seite ein
       zweites, unsichtbares Element -- und wo es fehlte, stand "Date picker not found".
       Diese Komponente legt sich ihren Picker jetzt selbst an: ein .udr-root im Slot, aufgebaut
       von filters/date-range.js. Deren Datei wird dabei NICHT angefasst; benutzt werden nur ihre
       oeffentlichen Wege -- date-range.js sucht von sich aus nach neuen .udr-root-Elementen,
       __udrCtrl ist der fertige Controller, und das Fenster-Ereignis upstreem:date-range meldet
       jede bestaetigte Auswahl zurueck. Panelposition, Presets, Grenzen und die drei bubble_fn_udr_*-Workflows
       bleiben damit genau die, die sich bewaehrt haben. */
    var calBuilt = false;
    /* Die Kennung des eigenen Pickers IST die Instanz-Kennung. Ein Praefix davor war unnoetig:
       date-range sucht nur unter .udr-root-Elementen, und das Export-Element traegt diese Klasse
       nicht -- eine Kollision ist damit ausgeschlossen. Gleiche Kennung heisst: in der Konsole
       steht der Name, den man auch im Editor sieht. data-calendar-id wird weiterhin gelesen --
       wer schon ein Element verdrahtet hat, behaelt es. */
    function calendarId(){
      var vorgabe = String(root.getAttribute("data-calendar-id") || "").trim();
      if (vorgabe && vorgabe !== "dates_v2_export") return vorgabe;
      return instanceId;
    }
    function findCalendar(){
      var id = calendarId();
      var all = document.querySelectorAll(".udr-root, [data-udr-root]");
      for (var i = 0; i < all.length; i++){
        var el = all[i];
        var eid = String(el.getAttribute("data-instance") || el.getAttribute("data-instance-id") || "").trim();
        if (eid === id) return el;
      }
      return null;
    }
    /* Die Wurzel des Kalenders schon beim Aufbau des Controllers anlegen, nicht erst beim Oeffnen
       (16.10. gemessen): date-range.js baut neue Wurzeln in seinem Takt (bis 1,5 s), und solange
       war "Custom range" direkt nach dem ersten Oeffnen ein toter Klick. Nur anlegen -- ob der
       Kalender fehlt, entscheidet weiter adoptCalendar beim Oeffnen. */
    function kalenderAnlegen(){
      var vorhanden = findCalendar();
      if (calBuilt || (vorhanden && vorhanden.parentNode !== elCalSlot)) return;
      calBuilt = true;
      var d = document.createElement("div");
      d.className = "udr-root";
      d.setAttribute("data-instance", calendarId());
      /* Lokal (13.10.): der Dialog liest den Zeitraum ueber __udrCtrl und upstreem:date-range, beides
         kommt auch lokal. Ohne das feuerte jede Wahl die Bubble-Namen bubble_fn_udr_date_* -- und
         lag noch ein alter Kalender mit genau diesen Namen auf der Seite, lud der seine Ansicht neu. */
      d.setAttribute("data-local", "yes");
      /* Dieselbe Untergrenze, die der Picker sonst auch hat -- ohne Angabe faellt er auf den
         1.1.2024 zurueck, und ein Export darf nicht weiter zurueckreichen als die Daten. */
      var min = root.getAttribute("data-min-date");
      if (min) d.setAttribute("data-min-date", min);
      elCalSlot.innerHTML = "";
      elCalSlot.appendChild(d);
    }
    function adoptCalendar(){
      var vorhanden = findCalendar();
      /* Liegt schon einer auf der Seite -- etwa weil data-calendar-id auf ein bestehendes Element
         zeigt -- wird der benutzt, aber NICHT verschoben. Verschieben war der Teil, der beim
         Zurueckschieben schiefgehen konnte. */
      if (vorhanden && vorhanden.parentNode !== elCalSlot){
        watchCalendarOpenState(); syncCalendarToState(); return;
      }
      kalenderAnlegen();
      /* KEIN resetUpstreemDateRangePicker mehr. Der Aufruf sollte den Aufbau anstossen, fand das
         Element aber nicht -- und jeder Fehlversuch schrieb eine lange Warnung in die Konsole.
         Das Element steht im DOM; date-range.js sucht ohnehin alle 1,5s nach neuen Wurzeln und
         baut sie auf. Hier wird nur noch abgewartet, ob der Controller erscheint. Bis zu 20
         Versuche a 150ms sind 3 Sekunden -- laenger als der Takt dort, also reicht es in jedem
         Fall, und zwar ohne eine einzige Zeile in der Konsole. */
      var versuche = 0;
      (function warten(){
        var cal = null;
        try { cal = findCalendar(); } catch(e){}
        if (cal && cal.__udrCtrl){ sicherFertig(cal); return; }
        if (++versuche < 20){ setTimeout(warten, 150); return; }
        sicherFertig(cal);
      })();
    }
    /* Die Warteschleife laeuft verzoegert und damit ausserhalb des try in openPopup -- ein Wurf
       hier landete sonst als unbehandelter Fehler in der Konsole und liess den Custom-Bereich in
       einem halben Zustand zurueck. */
    function sicherFertig(cal){
      try { fertig(cal); }
      /* Still: der Custom-Bereich zeigt im Dialog selbst, ob er benutzbar ist. */
      catch(e){}
    }
    /* Zweiter Teil von adoptCalendar, aufgerufen sobald der Picker steht oder endgueltig fehlt. */
    function fertig(cal){
      if (!cal || !cal.__udrCtrl){
        /* date-range.js ist nicht geladen. Dann fehlt der Loader-Block: das Feld bleibt ein Knopf und
           klappt die vier Presets als Liste auf (zeitZeichnen), deren letzter Satz sagt, was zu tun
           ist. Der Grund gehoert in die Konsole. */
        elZeitWrap.classList.remove("has-cal");
        renderAll();
        if (window.console) console.error("upstreem export-data: filters/date-range.js fehlt im " +
          "Loader-Block dieses Elements, deshalb gibt es keinen Kalender.");
        return;
      }
      /* has-cal: der unsichtbare Ausloeser liegt ueber dem Feld und nimmt den Mausklick. Erst jetzt
         -- bis dahin nimmt das Feld selbst den Klick (Ersatzliste), sonst waere er ein toter Klick. */
      elZeitWrap.classList.add("has-cal");
      if (state.offen === "zeit") state.offen = "";
      watchCalendarOpenState();
      syncCalendarToState();
      renderAll();
    }
    /* The picker keeps aria-expanded on its trigger in sync with its panel, which makes it the
       cleanest signal for "the calendar is currently open" — no polling, no reaching into the
       picker's internals. Der unsichtbare Ausloeser ist kein Tab-Halt (tabindex -1): mit der
       Tastatur steht man auf dem sichtbaren Feld, und das oeffnet den Kalender per Klick auf ihn.
       Geht der Kalender zu und der Fokus stand auf dem unsichtbaren Ausloeser (der Picker gibt ihn
       dorthin zurueck), wandert er auf das sichtbare Feld -- sonst stuende er im Unsichtbaren. */
    function watchCalendarOpenState(){
      var trig = elCalSlot.querySelector(".udr-trigger");
      if (!trig || trig.__uexWatched) return;
      trig.__uexWatched = true;
      trig.setAttribute("tabindex", "-1");
      trig.setAttribute("aria-hidden", "true");
      var apply = function(){
        var auf = trig.getAttribute("aria-expanded") === "true";
        elZeitfeld.classList.toggle("is-cal-open", auf);
        elZeitfeld.setAttribute("aria-expanded", auf ? "true" : "false");
        if (!auf && document.activeElement === trig){ try { elZeitfeld.focus({ preventScroll: true }); } catch(e){} }
      };
      new MutationObserver(apply).observe(trig, { attributes: true, attributeFilter: ["aria-expanded"] });
      apply();
    }
    /* true, wenn der Kalender da ist und angestossen wurde; sonst klappt der Aufrufer die
       Ersatzliste auf. */
    function kalenderOeffnen(){
      if (!elZeitWrap.classList.contains("has-cal")) return false;
      var trig = elCalSlot.querySelector(".udr-trigger");
      if (!trig) return false;
      try { trig.click(); } catch(e){}
      return true;
    }
    /* The popup is what the user is looking at, so the popup's selection wins: on adoption the
       picker is driven to match it. Only when the popup is on a custom range (which came FROM the
       picker in the first place) is there nothing to push. */
    function syncCalendarToState(){
      if (state.preset && state.preset !== "custom"){
        if (syncCalendarToPreset(state.preset)){ persist(); renderAll(); }
        return;
      }
      var cal = findCalendar();
      if (!cal) return;
      /* Ein freier Zeitraum, den die SEITE mitgegeben hat (Shopping, Ads), kam nicht vom Picker --
         er wird ihm gegeben, still, und danach gilt wieder, was der Picker sagt (in seine Grenzen
         gezogen). */
      if (state.zeitVonSeite && cal.__udrCtrl && typeof cal.__udrCtrl.setRange === "function"){
        try { cal.__udrCtrl.setRange(isoDate(state.from), isoDate(state.to), false); } catch(e){}
      }
      state.zeitVonSeite = false;
      var f = parseIso(cal.getAttribute("data-date-from"));
      var t = parseIso(cal.getAttribute("data-date-to"));
      if (f && t){ state.from = f; state.to = t; renderAll(); }
    }
    /* Beim Schliessen des Dialogs muss auch das Kalenderfeld zu. Ueber den Trigger, nicht ueber
       die Klassen: der Picker haelt seinen Zustand intern (setOpen), und ein von aussen entferntes
       is-open liesse ihn glauben, er sei noch offen -- der naechste Klick wuerde dann zumachen
       statt aufmachen. Sein Controller bietet kein close() an, der Trigger schaltet aber um, und
       aria-expanded sagt verlaesslich, ob das noetig ist. */
    function closeCalendar(){
      var trig = elCalSlot.querySelector(".udr-trigger");
      if (trig && trig.getAttribute("aria-expanded") === "true"){
        try { trig.click(); } catch(e){}
      }
      elZeitfeld.classList.remove("is-cal-open");
      if (elZeitWrap.classList.contains("has-cal")) elZeitfeld.setAttribute("aria-expanded", "false");
    }
    function returnCalendar(){ closeCalendar(); }

    // the picker announces every committed range on window — that's our custom-range input
    if (!root.__uexRangeBound){
      root.__uexRangeBound = true;
      window.addEventListener("upstreem:date-range", function(ev){
        var d = ev && ev.detail;
        if (!d || String(d.instance_id || "") !== calendarId()) return;
        var f = parseIso(d.date_from), t = parseIso(d.date_to);
        if (!f || !t) return;
        /* Seit Variante C waehlt man auch die Presets im Feld des Kalenders (vorher standen sie als
           Liste im Dialog, der Kalender kam nur fuer den freien Zeitraum). Das Ereignis traegt den
           Schluessel des Presets -- gleiche Schluessel hier und dort --, ein freier Zeitraum keinen. */
        var pk = String(d.preset || "");
        state.preset = PRESETS.some(function(x){ return x.key === pk; }) ? pk : "custom";
        state.from = f; state.to = t;
        /* Ein neuer Zeitraum ist eine neue Wahl -- der rote Satz zum alten ("zu lang") gilt nicht mehr. */
        state.fehler = ""; state.zeitFehler = "";
        persist(); renderAll();
      });
    }

    /* ---------------- open / close ---------------- */
    var lastFocus = null;
    function fokus(el){ try { if (el && !el.hidden && !el.disabled) { el.focus({ preventScroll: true }); return true; } } catch(e){} return false; }
    /* Nach jedem Phasenwechsel steht der Fokus auf dem Knopf, der jetzt zaehlt -- der alte ist
       dann oft verschwunden (Cancel export nach dem Ende), und Fokus im Nichts heisst: die
       naechste Taste geht an die Seite dahinter. */
    function fokusFuss(){ if (!fokus(elSubmit) && !fokus(elZweit)) fokus(elClose); }
    /* Am Telefon steht immer nur eine Haelfte da (CSS, unter 640). Die Frage stellt nur, wer den
       Fokus setzt oder einen Schritt wechselt -- gezeichnet wird ueber data-schritt. */
    function schmal(){ try { return !!(window.matchMedia && window.matchMedia("(max-width: 640px)").matches); } catch(e){ return false; } }
    function gewaehlterEintrag(){ return elNav.querySelector('[data-type][aria-checked="true"]'); }
    function openPopup(){
      if (state.open) return;
      /* Das eigene Overlay MUSS im Dokument haengen. Auf einer Seite mit mehreren Elementen
         derselben data-instance -- beim Nutzer sechs -- raeumt jeder neu gebaute Controller die
         Overlays "seiner" Instanz weg, auch die seiner Geschwister. Der Controller, der dann
         oeffnet, setzte is-open auf einem Knoten, der nicht mehr im Dokument war: kein Fehler,
         keine Warnung, kein Dialog. Genau das Bild.
         Wieder anhaengen statt neu bauen -- alle Verweise und Zuhoerer bleiben damit gueltig. */
      if (!overlay.isConnected){
        var fremd = document.querySelectorAll('.uex-overlay[data-uex-instance="' + instanceId + '"]');
        for (var f = 0; f < fremd.length; f++){
          if (fremd[f] !== overlay && fremd[f].parentNode) fremd[f].parentNode.removeChild(fremd[f]);
        }
        document.body.appendChild(overlay);
      }
      syncTheme();
      /* Am Telefon oeffnet der Dialog auf den Einstellungen des vorbelegten Datensatzes: jeder
         Einstieg bringt einen mit, und der Schnellweg (ein Klick) soll auch dort gelten. Die Liste
         ist einen Schritt zurueck ("Back"). */
      state.phase = "wahl"; state.schritt = "einst"; state.offen = ""; state.fehler = ""; state.zeitFehler = ""; state.lauf = null; state.ergebnis = null;
      /* Der Kalender ist Beiwerk, das Oeffnen ist die Hauptsache. Wirft irgendetwas beim Anlegen
         oder Suchen des Pickers, kam der Dialog frueher gar nicht mehr hoch -- gemessen beim
         Nutzer: is-open blieb false, kein Inline-Stil, der Dialog unsichtbar da. Ein Fehler hier
         darf hoechstens den Custom-Bereich kosten, nie den ganzen Export. */
      try { adoptCalendar(); }
      /* Still, aus demselben Grund. Fehlt der Kalender, klappt das Feld die Presets als Liste auf. */
      catch(e){}
      pruefen();
      spaltenHolen(state.type);
      renderAll();
      lastFocus = document.activeElement;
      overlay.inert = false;
      overlay.setAttribute("aria-hidden", "false");
      /* is-shown ist der Zustand des Core-Popups, is-open bleibt fuer die eigenen Regeln. */
      overlay.classList.add("is-open", "is-shown");
      document.body.classList.add("uex-popup-open");   // lifts the picker's panel above us
      if (btn) btn.setAttribute("aria-expanded", "true");
      state.open = true;
      /* Ein Klick genuegt: der Fokus steht auf "Export ...", Enter exportiert. Ruht der Knopf
         (Shopping, Ads: kommt bald), steht er auf dem Schliessen-Knopf. */
      fokusFuss();
    }
    function closePopup(){
      if (!state.open) return;
      /* Der Filter des Drawers gilt nur fuer DIESEN Export (siehe setContext). */
      state.url = ""; state.domain = ""; state.promptId = ""; state.brandId = ""; state.filterLabel = "";
      /* Ebenso der Kontext der Seite und die Gruppe von Shopping und Ads: danach gilt wieder die
         Grundgruppe, und ein spaeteres Oeffnen ohne Kontext (Cmd+K) traegt keinen Filter mit. */
      state.params = {}; state.namen = {}; state.weg = {}; state.zeitVonSeite = false; state.ohneBrille = false;
      /* Der eigene Dateiname ebenso: das naechste Oeffnen beginnt mit dem Vorschlag. */
      state.eigenName = null; state.namenEdit = false;
      if (gruppeVon(state.type)) state.type = state.stammTyp;
      /* Schliessen bricht einen laufenden Export ab (das sagt der Satz unter dem Balken): die
         naechste Seite wird nicht mehr geholt, nichts heruntergeladen. */
      state.phase = "wahl"; state.schritt = "einst"; state.offen = ""; state.fehler = ""; state.zeitFehler = ""; state.lauf = null; state.ergebnis = null;
      laufStoppen();
      // never hide a focused element from assistive tech — move focus out FIRST
      if (overlay.contains(document.activeElement)){
        try {
          /* Zurueck auf den Ausloeser -- aber nur, wenn er ausserhalb liegt und fokussierbar ist.
             Kam das Oeffnen aus einem Skript (Fokus auf body) oder lag er selbst im Dialog, blieb
             der Fokus sonst auf einem Knopf im verdeckten Dialog stehen (gemessen 16.10.). */
          var ziel = lastFocus && lastFocus.isConnected && lastFocus !== document.body && !overlay.contains(lastFocus) ? lastFocus : btn;
          if (ziel) ziel.focus({ preventScroll: true });
          if (overlay.contains(document.activeElement)) document.activeElement.blur();
        } catch(e){ try { document.activeElement.blur(); } catch(e2){} }
      }
      overlay.classList.remove("is-open", "is-shown");
      overlay.setAttribute("aria-hidden", "true");
      overlay.inert = true;
      document.body.classList.remove("uex-popup-open");
      if (btn) btn.setAttribute("aria-expanded", "false");
      state.open = false;
      if (state.processing) setProcessing(false);   // defensive: don't leave a stale timer/state behind
      /* SOFORT, nicht verzoegert: das Panel soll mit dem Dialog verschwinden, nicht erst danach. */
      closeCalendar();
    }

    /* Der BUBBLE-Weg (fireExportBubble): der Dialog wartet auf upstreemExportResolve und ist so
       lange gesperrt -- schliessen kann ihn nur Bubble. Der Weg ueber die App laeuft dagegen in
       der Phase "laeuft" und laesst sich jederzeit abbrechen. */
    function setProcessing(on){
      state.processing = !!on;
      elClose.disabled = state.processing;
      renderAll();
      if (state.processing){
        // Safety net only — this should essentially never fire for a real export. It exists so a
        // missing/forgotten window.upstreemExportResolve() call can't strand the dialog in a
        // permanent spinner with no way out except reloading the page.
        clearTimeout(root.__uexProcessingTimeout);
        root.__uexProcessingTimeout = setTimeout(function(){
          if (!state.processing) return;
          console.warn("[upstreem-export] no window.upstreemExportResolve('" + instanceId +
            "') arrived within 90s — ending the processing state so the dialog isn't stuck. " +
            "If the export genuinely takes longer, call resolve() later; the dialog will still close correctly.");
          setProcessing(false);
        }, 90000);
      } else {
        clearTimeout(root.__uexProcessingTimeout);
      }
    }
    /* ---- DER EXPORT AUS DER KOMPONENTE (13.10., Vertrag VOR_NEXTJS_V1 Abschnitt 3) --------------
       Vorher: bubble_fn_upstreemExport -> Bubble ruft die Export-RPC mit dem Nutzer-Token, baut die
       Datei, laedt herunter, meldet upstreemExportResolve. Jetzt blaettert der Dialog selbst
       (offset + limit, solange meta.has_more), baut die CSV aus den Spalten von export_columns_v1
       (Reihenfolge und englische Kopfzeile kommen von der Datenbank -- nur diese Schluessel, nicht
       die Rohfelder) und laedt sie herunter. Formelschutz macht die Datenbank (csv_safe_v1 auf jeder
       Textspalte); hier steht trotzdem jedes Feld in Anfuehrungszeichen, " verdoppelt.
       Gibt es eine Funktion mit genau diesen Parametern noch nicht (404 PGRST202), geht DIESER Typ
       fuer die Sitzung wieder an Bubble -- ein Pin vor der SQL schaltet den Export nicht ab. */
    var EXPORTE = {
      prompts:     { fn: "export_prompts_v1",           spalten: "prompts",   seite: 5000 },
      prompt_runs: { fn: "export_responses_v1",         spalten: "responses", seite: 2000 },
      domains:     { fn: "export_citations_domains_v1", spalten: "domains",   seite: 10000 },
      urls:        { fn: "export_citations_urls_v1",    spalten: "urls",      seite: 5000 },
      brands:      { fn: "export_brands_v2",            spalten: "brands",    seite: 500 },
      /* SHOPPING UND ADS (16.10., Auftrag bubble/shopping_ads_export_db_auftrag_16_10.md). neu: kein
         Rueckweg an Bubble (die Seiten gibt es dort nicht), und ob es den Export gibt, fragt der
         Dialog beim Oeffnen export_columns_v1 (pruefen unten). Parameter: die der Seite (params). */
      shop_products:    { fn: "export_shopping_products_v1",    spalten: "shopping_products",    seite: 2000, neu: true, datei: "shopping-products" },
      shop_brands:      { fn: "export_shopping_brands_v1",      spalten: "shopping_brands",      seite: 1000, neu: true, datei: "shopping-brands" },
      shop_merchants:   { fn: "export_shopping_merchants_v1",   spalten: "shopping_merchants",   seite: 2000, neu: true, datei: "shopping-merchants" },
      shop_appearances: { fn: "export_shopping_appearances_v1", spalten: "shopping_appearances", seite: 5000, neu: true, datei: "shopping-appearances" },
      ads_advertisers:  { fn: "export_ads_advertisers_v1",      spalten: "ads_advertisers",      seite: 2000, neu: true, datei: "ads-advertisers" },
      ads_library:      { fn: "export_ads_library_v1",          spalten: "ads_library",          seite: 1000, neu: true, datei: "ads-library" },
      ads_prompts:      { fn: "export_ads_prompts_v1",          spalten: "ads_prompts",          seite: 2000, neu: true, datei: "ads-prompts" }
    };
    /* ---- GIBT ES DEN EXPORT SCHON? (16.10.) -------------------------------------------------------
       Fuer die Typen mit neu fragt der Dialog beim Oeffnen export_columns_v1 nach den Spalten jedes
       dieser Typen (seit Variante C alle sieben: die Liste links zeigt sie alle und sagt "Soon",
       wo es den Export noch nicht gibt): ein Aufruf, der keine Daten liest und nicht ins
       Ratenlimit der Exporte zaehlt. Je Typ einmal im Seitenleben. Kennt die Datenbank den Export nicht, antwortet sie 400 exports_invalid_param mit hint
       "p_export: ..." (vor_nextjs_v1.sql) -- dann "kommt bald" statt eines Fehlers. Ebenso 404
       PGRST202 (Funktion fehlt ganz) und, beim Export selbst, PGRST202 der Datenfunktion. Alles
       andere (Netz, Zeitablauf, 5xx) heisst "unbekannt": der Knopf geht, und beim naechsten Oeffnen
       wird neu gefragt. Gemerkt fuer das Seitenleben und alle Controller (DA am window) -- ist das
       SQL eingespielt, gilt es nach einem Neuladen ohne weitere Aenderung.
       Waehrend der Frage ruht der Knopf (laeuft): sonst waere er erst klickbar und dann nicht. */
    function spaltenAus(erg){
      var r = erg && erg.ok && erg.daten && Array.isArray(erg.daten.rows) ? erg.daten.rows : null;
      r = r ? r.filter(function(c){ return c && c.key; }) : null;
      return r && r.length ? r : null;
    }
    function exportFehlt(erg){
      if (!erg || erg.ok) return false;
      var f = erg.fehler || {}, m = String(f.message || ""), h = String(f.hint || "");
      if (String(f.code || "") === "PGRST202" ||
          (erg.status === 404 && /could not find the function/i.test(m + " " + String(f.details || "")))) return true;
      return erg.status === 400 && /exports_invalid_param/.test(m) && /p_export/.test(h);
    }
    /* Der Eintrag je Spaltensatz, fuer JEDEN Typ (die Spalten stehen rechts als Checkliste).
       daVon bleibt der Eintrag nur fuer die neuen Typen -- nur dort heisst ein fehlender
       Spaltensatz "kommt bald". */
    function spaltenVon(art){
      var cfg = EXPORTE ? EXPORTE[art] : null;
      if (!cfg) return null;
      return DA[cfg.spalten] || (DA[cfg.spalten] = { stand: null, spalten: null, laeuft: false });
    }
    function daVon(art){
      var cfg = EXPORTE ? EXPORTE[art] : null;
      if (!cfg || !cfg.neu) return null;
      return spaltenVon(art);
    }
    function pruefen(){
      var k = kern();
      if (!k) return;
      TYPES.forEach(function(x){
        if (!x.gruppe) return;
        var e = daVon(x.value), cfg = EXPORTE[x.value];
        if (!e || e.stand !== null || e.laeuft) return;
        e.laeuft = true;
        function fertig(){ e.laeuft = false; e.versucht = true; daGeaendert(); }
        k.rpc("export_columns_v1", { p_export: cfg.spalten }, { timeoutMs: 20000 }).then(function(erg){
          var r = spaltenAus(erg);
          if (r){ e.stand = true; e.spalten = r; }
          else if (exportFehlt(erg)) e.stand = false;
          fertig();
        }, fertig);
      });
    }
    /* Die Spalten eines Typs der Grundgruppe schon beim Waehlen (Leinwand C: "braucht
       export_columns_v1 schon beim Waehlen, nicht erst beim Export"). Derselbe Aufruf, den der
       Export ohnehin als ersten macht -- er wird danach nicht wiederholt. Scheitert er, steht
       "All columns" ohne Wahl da, und der Export fragt selbst. */
    function spaltenHolen(art){
      var cfg = EXPORTE[art], e = spaltenVon(art), k = kern();
      if (!cfg || cfg.neu || !e || !k || e.stand !== null || e.laeuft || BUBBLE_TYP[art]) return;
      e.laeuft = true;
      function ende(){ e.laeuft = false; e.versucht = true; daGeaendert(); }
      k.rpc("export_columns_v1", { p_export: cfg.spalten }, { timeoutMs: 20000 }).then(function(erg){
        var r = spaltenAus(erg);
        if (r){ e.stand = true; e.spalten = r; }
        ende();
      }, ende);
    }
    function gesperrt(art){ var e = daVon(art); return !!e && (e.stand === false || e.laeuft); }
    function baldSatz(art){
      var e = daVon(art), g = gruppeVon(art);
      if (!e || e.stand !== false) return "";
      var alle = TYPES.every(function(x){ var d = x.gruppe === g ? daVon(x.value) : null; return !d || d.stand === false; });
      return tr(alle && GRUPPEN[g] ? GRUPPEN[g].bald : "This export is coming soon.");
    }
    /* Der gesperrte Knopf ist der core-Knopf im disabled-Zustand (.up-btn-pri:disabled, 40 %),
       nicht mehr ein auf 70 % gedimmter -- der las sich fast wie aktiv. */
    /* Im Lauf ruht er ebenfalls (Leinwand: "Exporting…" mit Kreisel, 70 %) -- der Fokus steht dann
       auf "Cancel export" (fokusFuss), dem einzigen Knopf, der jetzt etwas tut. */
    function knopfStand(){ elSubmit.disabled = state.processing || state.phase === "laeuft" || gesperrt(state.type) || keineSpalten(); }
    /* Obergrenze an Seiten je Export: die Datenbank erlaubt 60 Seiten je Minute und Typ. Mehr als
       das passt nicht in einen Lauf, und eine Schleife ohne Ende waere der schlimmere Fehler. */
    var MAX_SEITEN = 60;
    var BUBBLE_TYP = (window.__uexBubbleTyp = window.__uexBubbleTyp || {});
    function kern(){ var k = window.UpstreemCore; return k && typeof k.rpc === "function" && typeof k.getTeam === "function" && k.getTeam() ? k : null; }
    /* Ohne Bubble (die App, UC.ohneBubble): kein Rueckweg, sondern der Fehler, den der Aufrufer schon zeigt (14.10.). */
    function ohneRpc(erg){
      var k = window.UpstreemCore;
      if (k && k.ohneBubble && k.ohneBubble()) return false;
      return !!erg && erg.status === 404 && !!erg.fehler && String(erg.fehler.code || "") === "PGRST202";
    }
    function exportParameter(art, team, offset, limit){
      var p = { p_team: team, p_date_from: isoDate(state.from), p_date_to: isoDate(state.to), p_offset: offset, p_limit: limit };
      /* Die Filter des Drawers (setContext) -- nur im Scope (FILTER) und nur, solange ihr Chip steht. */
      FILTER.forEach(function(f){
        if (state[f.feld] && f.typen.indexOf(art) >= 0 && !state.weg[f.feld]) p[f.param] = String(state[f.feld]);
      });
      /* Die Parameter der Seite (setContext params), in den Namen ihrer Liste -- nur die, die die
         Funktion kennt (KENNT). Team, Zeitraum, Seite und ein Filter des Drawers werden nie
         ueberschrieben; null heisst "kein Filter" und bleibt draussen -- jede Funktion hat dafuer
         ihren Standardwert, und ein Name weniger ist ein Grund weniger fuer PGRST202. Ein
         abgewaehlter Chip nimmt alle seine Parameter mit (Topics samt Modus) oder setzt die
         Vorgabe der App (Branded). Auf dem Bubble-Weg gibt es keine (filterFuer). */
      var x = seitenParams(art), kennt = KENNT[art] || [];
      /* Die Parameter der Drawer-Filter (p_url, p_domain, p_prompt_id, p_brand) kommen NUR ueber
         ihren Chip: meldet ein Drawer sie auch in params, ginge ein abgewaehlter Filter sonst still
         ueber die Liste wieder mit. */
      var drawerP = FILTER.map(function(f){ return f.param; });
      Object.keys(x).forEach(function(n){
        if (!/^p_[a-z0-9_]+$/.test(n) || Object.prototype.hasOwnProperty.call(p, n) || kennt.indexOf(n) < 0 || drawerP.indexOf(n) >= 0) return;
        /* Der Status der Seite geht nie mit -- darunter steht er fest auf active. */
        if (n === "p_status") return;
        var c = seitenChip(n);
        if (c && state.weg[c.key]){
          var vg = c.vorgabe ? c.vorgabe(art) : undefined;
          if (vg !== undefined) p[n] = vg;
          return;
        }
        if (!voll(x[n])) return;
        p[n] = x[n];
      });
      /* NUR AKTIVE PROMPTS (17.10., Regel des Nutzers; DB-Auftrag exporte_17_10 Teil B). Gilt fuer
         jeden Weg in den Dialog -- auch Cmd+K, das Dashboard oder einen Kontext, den eine Seite vom
         Reiter Inactive gemeldet hat: ausdruecklich active, nicht bloss weggelassen, damit es nicht
         am Standardwert der Funktion haengt. Nur wo die Funktion den Parameter kennt (Prompts);
         Brands hat keinen, export_brands_v2 liefert ohnehin nur aktive. */
      if (kennt.indexOf("p_status") >= 0) p.p_status = "active";
      /* Eine Sortierung, die die Funktion nicht kennt, faellt weg (ihre eigene gilt) -- sonst
         scheiterte der ganze Export an der Reihenfolge der Zeilen. */
      var ord = ORDNUNG[art === "urls" && p.p_domain ? "urls_domain" : art];
      if (ord && p.p_order != null && ord.indexOf(String(p.p_order)) < 0) delete p.p_order;
      return p;
    }
    function csvFeld(v, typ){
      if (v == null) return '""';
      if (typ === "bool") v = v === true || v === "true" ? "Yes" : (v === false || v === "false" ? "No" : v);
      else if (typeof v === "object") v = JSON.stringify(v);
      return '"' + String(v).replace(/"/g, '""') + '"';
    }
    function csvBauen(spalten, zeilen){
      var kopf = spalten.map(function(c){ return csvFeld(c.header, "text"); }).join(",");
      var rumpf = zeilen.map(function(z){
        return spalten.map(function(c){ return csvFeld(z ? z[c.key] : null, c.type); }).join(",");
      });
      /* BOM: ohne ihn liest Excel die Datei als Windows-1252, und jeder Umlaut zerfaellt. */
      return "﻿" + [kopf].concat(rumpf).join("\r\n");
    }
    /* Die Datei als Blob mit eigener Objekt-Adresse, nach 4 s wieder freigegeben. Gehalten wird
       er danach nicht mehr: "Download again" gibt es seit dem 17.10. nicht (der Abschluss kommt
       nur, wenn gerade heruntergeladen wurde), mit der Adresse geht also auch die Datei. */
    function herunterladen(blob, name){
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = name; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    }
    function exportSatz(erg){
      var m = erg && erg.fehler ? String(erg.fehler.message || "") : "";
      var h = erg && erg.fehler ? String(erg.fehler.hint || "") : "";
      /* 429: der hint ist die Zahl der Sekunden bis zum Ende des Minutenfensters (DB-Rueckmeldung
         16.10., Klarstellung 7) -- die steht im Satz; ohne Zahl bleibt es bei der Minute. */
      if (/rate_limited/.test(m) || (erg && erg.status === 429)){
        var sek = /^\d+$/.test(h.trim()) ? Number(h) : 0;
        return ["Too many exports in a short time", sek === 1 ? "Please wait 1 second and try again."
          : (sek > 1 ? { satz: "Please wait {n} seconds and try again.", n: sek } : "Please wait a minute and try again.")];
      }
      /* 402 team_access_*: core zeigt dazu selbst die Sperre der App (rpc -> appZugangWeg), wie bei
         jeder anderen Abfrage; hier steht nur der Satz. */
      if (/team_access/.test(m) || (erg && erg.status === 402)) return ["Exports are not available for this team", "Check your plan in Billing."];
      /* 401 (kein oder abgelaufenes Token -- PostgREST meldet es als "permission denied for
         function", die Rolle anon darf die Exporte nicht ausfuehren). Vor 403: dieselbe Meldung
         kaeme sonst als "kein Zugriff aufs Team" heraus. */
      if ((erg && erg.status === 401) || /not authenticated|permission denied|jwt/i.test(m)) return ["Your session has expired", "Please sign in again."];
      if (/forbidden|role_required/.test(m) || (erg && erg.status === 403)) return ["You can't export this team's data", "Ask a team owner for access."];
      /* 400 exports_invalid_param mit hint "p_status: active only" (DB-Auftrag exporte_17_10 Teil B):
         derselbe Satz wie am gesperrten Knopf der Seite statt "didn't work". Vor der Zeitraum-Regel
         darunter -- die nimmt jeden ungueltigen Parameter, dessen hint "date" enthaelt. */
      if (/invalid_param/.test(m) && /p_status/.test(h)) return ["Inactive prompts can't be exported", "Only active prompts are exported."];
      /* Der dritte Wert sagt, wohin der Satz gehoert: "zeit" an das Feld Date range (Leinwand C:
         roter Rahmen, Satz darunter). Ein ungueltiger Parameter, dessen hint keinen Zeitraum nennt
         (Sortierung, Seitengroesse), ist kein Fehler des Zeitraums -- den aendern hilft dort nicht. */
      if (/invalid_date/.test(m) || (/invalid_param/.test(m) && (!h || /date/i.test(h)))) return ["This date range can't be exported", "Choose a shorter range and try again.", "zeit"];
      return ["The export didn't work", "Please try again."];
    }
    /* Fehler stehen als roter Satz im Dialog (.up-fehlerzeile), nicht als Toast -- der Dialog
       bleibt offen, die Wahl steht noch da, und ein zweiter Klick versucht es erneut. Ganze Saetze
       durch den Katalog, zwei Saetze hintereinander. */
    function fehlerSetzen(paar){
      /* Der zweite Satz kann eine Zahl tragen ({ satz, n }): erst uebersetzen, dann einsetzen --
         "Warte 12 Sekunden ..." steht in keinem Katalog, nur der Satz mit {n}. */
      var zwei = paar[1] && typeof paar[1] === "object" ? tr(paar[1].satz).replace("{n}", zahl(paar[1].n)) : tr(paar[1]);
      var satz = tr(paar[0]) + ". " + zwei;
      if (paar[2] === "zeit"){ state.zeitFehler = satz; state.fehler = ""; }
      else { state.fehler = satz; state.zeitFehler = ""; }
    }
    var laufZaehler = 0;
    /* DER ABBRUCH DER LAUFENDEN ANFRAGE (17.10., Audit EXP-13). Vorher setzte "Cancel export" nur den
       Zustand zurueck: die Seite, die schon unterwegs war, lief in der Datenbank weiter (bis zu 30 s
       statement_timeout) und zaehlte in die Ratengrenze (60 je Minute und Typ), und ihre Antwort
       wurde erst danach verworfen. UC.rpc kennt opts.signal. Ein Griff je Lauf; Abbrechen, Schliessen
       und der Start eines neuen Laufs geben ihn frei. */
    var laufAbbruch = null;
    function laufStoppen(){
      var a = laufAbbruch; laufAbbruch = null;
      if (a){ try { a.abort(); } catch(e){} }
    }
    /* true: die Komponente exportiert selbst. false: Bubble-Weg. */
    function exportSelbst(){
      var art = state.type, cfg = EXPORTE[art], k = kern();
      if (!cfg || !k || (!cfg.neu && BUBBLE_TYP[art])) return false;
      var team = k.getTeam(), zeilen = [], seiten = 0, spalten = null;
      /* Der Schnappschuss der Responses (exporte_fix_v1, EXP-10): die erste Seite meldet meta.as_of, jede
         Folgeseite schickt es als p_as_of zurueck, sonst verschiebt ein waehrend des Laufs eingetroffener
         Lauf die Seiten (Doppel und Luecken beim Blaettern per Offset). Seite 1 sendet nichts, und eine
         Datenbank ohne die Neuerung liefert kein as_of: dann geht auch nie ein unbekannter Parameter hinaus. */
      var asOf = null;
      /* neu (Shopping, Ads): was pruefen schon weiss, gilt; fehlt der Export, steht der Satz im
         Dialog statt eines Fehlers. Einen Bubble-Weg gibt es fuer diese Typen nicht. */
      var da = daVon(art), sp = spaltenVon(art);
      /* Alles, was der Lauf braucht, EINMAL beim Start: Filter, Zeitraum und Spaltenwahl. Ein
         setContext oder eine Wahl waehrend des Laufs darf die spaeteren Seiten nicht umstellen. */
      var basis = exportParameter(art, team, 0, cfg.seite);
      var name = dateiName(art);
      var aus = state.ohne[cfg.spalten] || {};
      function gewaehlt(){ return spalten.filter(function(c){ return !aus[c.key]; }); }
      /* Jeder Lauf hat seine Nummer. Abbrechen, Schliessen oder ein neuer Lauf machen die Antworten
         des alten wertlos -- ohne die Nummer haette eine verspaetete Seite des abgebrochenen Laufs
         den neuen weitergefuehrt. */
      var nr = ++laufZaehler;
      laufStoppen();
      var ac = typeof AbortController !== "undefined" ? new AbortController() : null;
      laufAbbruch = ac;
      state.fehler = ""; state.zeitFehler = ""; state.offen = "";
      /* spalten: wie viele Spalten die Datei hat, sobald der Spaltensatz da ist (erster Schritt). */
      state.lauf = { nr: nr, zeilen: 0, gesamt: null, seiten: 0, limit: cfg.seite, kappe: cfg.seite * MAX_SEITEN, spalten: null };
      state.phase = "laeuft";
      closeCalendar();
      renderAll(); fokusFuss();
      function aktiv(){ return state.open && state.phase === "laeuft" && !!state.lauf && state.lauf.nr === nr; }
      /* Zurueck zur Wahl; steht der Fehler am Zeitraum, steht der Fokus dort. */
      function zurueck(){ state.lauf = null; state.phase = "wahl"; renderAll(); if (!(state.zeitFehler && fokus(elZeitfeld))) fokusFuss(); }
      function scheitern(erg){
        if (!aktiv()) return;
        var f = (erg && erg.fehler) || {};
        /* STUNDENGRENZE DER EXPORTE (17.10., l_ratengrenzen_v1): exports_rate_limited mit detail
           hour_user/hour_team (hint = Sekunden bis zur Freigabe). Ein Zustand, den der Nutzer abwartet,
           kein Fehler der Anfrage: eine ruhige Meldung mit der Wartezeit statt eines roten Satzes im
           Dialog; der Dialog bleibt offen, die Wahl steht noch da. */
        if (String(f.message || "") === "exports_rate_limited" && /^hour_(user|team)$/.test(String(f.details || "").trim()) && k && k.toast){
          k.toast("Export limit reached", { kind: "neutral", desc: k.warteSatz ? k.warteSatz(erg) : "" });
          zurueck(); return;
        }
        /* TOPICS UND MARKEN, DIE ES NICHT MEHR GIBT (22023): die Ids stehen in den Parametern, die die
           Seite gemeldet hat (state.params). Weg damit, die Chips des Dialogs zeigen den neuen Stand,
           und der Lauf beginnt EINMAL neu (Grenze: k.filterBereinigen). */
        var u = k && k.unbekannteIds ? k.unbekannteIds(erg) : null, ref = u ? state.params[art] : null;
        if (u && ref && Object.prototype.hasOwnProperty.call(ref, u.param) && k.filterBereinigen) {
          var feld = {
            lesen: function(){ var v = ref[u.param]; return Array.isArray(v) ? v : (typeof v === "string" && v ? v.split(",") : []); },
            setzen: function(rest){ ref[u.param] = Array.isArray(ref[u.param]) ? rest : rest.join(","); }
          };
          var felder = {}; felder[u.param] = feld;
          if (k.filterBereinigen(erg, { schluessel: "export|" + art, felder: felder, danach: function(){ renderAll(); exportSelbst(); } })) return;
        }
        fehlerSetzen(exportSatz(erg)); zurueck();
      }
      /* Eine Ausnahme im Erfolgszweig (die Datei ist zu gross fuer einen String oder Blob, der Speicher
         reicht nicht): das Promise wuerde sie still verwerfen, und der Dialog bliebe fuer immer auf
         "Exporting..." (Audit EXP-03, gemessen 17.10.). Jetzt ein Satz, und der Dialog ist wieder
         bedienbar -- Zeitraum und Spalten stehen noch da. */
      function dateiFehler(){
        if (!aktiv()) return;
        fehlerSetzen(["The file couldn't be created", "Choose fewer columns or a shorter date range and try again."]);
        zurueck();
      }
      /* opts fuer UC.rpc samt Abbruch-Signal dieses Laufs (falls der Browser AbortController kennt). */
      function rpcOpts(o){ if (ac) o.signal = ac.signal; return o; }
      function auchBubble(){ if (!aktiv()) return; BUBBLE_TYP[art] = true; state.lauf = null; state.phase = "wahl"; renderAll(); fireExportBubble(); }
      function fehlt(){ if (!aktiv()) return; da.stand = false; zurueck(); daGeaendert(); }
      if (sp && sp.stand === true && sp.spalten){ spalten = sp.spalten; state.lauf.spalten = gewaehlt().length; seite(0); return true; }
      k.rpc("export_columns_v1", { p_export: cfg.spalten }, rpcOpts({ timeoutMs: 20000 })).then(function(erg){
        if (!aktiv()) return;
        if (da && exportFehlt(erg)) { fehlt(); return; }
        if (!da && ohneRpc(erg)) { auchBubble(); return; }
        var r = spaltenAus(erg);
        if (!r) { scheitern(erg); return; }
        if (sp){ sp.stand = true; sp.spalten = r; }
        spalten = r;
        state.lauf.spalten = gewaehlt().length;
        renderAll();
        seite(0);
      }, scheitern).catch(dateiFehler);
      function seite(offset){
        if (!aktiv()) return;            /* abgebrochen oder Dialog geschlossen */
        var p = {}; Object.keys(basis).forEach(function(n){ p[n] = basis[n]; });
        p.p_offset = offset;
        if (asOf) p.p_as_of = asOf;
        k.rpc(cfg.fn, p, rpcOpts({ timeoutMs: 120000 })).then(function(erg){
          if (!aktiv()) return;
          if (da && exportFehlt(erg)) { fehlt(); return; }
          if (!da && ohneRpc(erg)) { auchBubble(); return; }
          var d = erg && erg.ok ? erg.daten : null;
          if (!d || !Array.isArray(d.rows)) { scheitern(erg); return; }
          zeilen = zeilen.concat(d.rows);
          seiten++;
          var m = d.meta || {};
          if (!asOf && art === "prompt_runs" && typeof m.as_of === "string" && m.as_of) asOf = m.as_of;
          var gesamt = m.total_count == null || m.total_count === "" ? NaN : Number(m.total_count);
          state.lauf.zeilen = zeilen.length; state.lauf.seiten = seiten;
          if (isFinite(gesamt)) state.lauf.gesamt = gesamt;
          if (m.has_more === true && seiten < MAX_SEITEN && d.rows.length){
            renderAll();
            seite(Number(m.offset || offset) + Number(m.limit || cfg.seite));
            return;
          }
          var g = gewaehlt();
          var blob = new Blob([csvBauen(g, zeilen)], { type: "text/csv;charset=utf-8" });
          herunterladen(blob, name);
          if (laufAbbruch === ac) laufAbbruch = null;
          /* VOLLSTAENDIGKEIT NICHT NUR AM has_more MESSEN (17.10., EXP-09/EXP-10): fehlt has_more oder
             stimmt es nicht, galt jede Datei als komplett (Stub: 5.000 von 12.001 Zeilen, kein Hinweis).
             total_count der letzten Seite gegen die Zeilen der Datei: weicht es ab (zu wenige: Seiten
             fehlen; zu viele oder gleich viele mit Doppeln: waehrend des Laufs kamen Zeilen hinzu, das
             Blaettern per Offset hat keinen Schnappschuss), sagt der Abschluss es. Nie still. */
          var gekappt = m.has_more === true;
          var abweichung = !gekappt && isFinite(gesamt) && zeilen.length !== gesamt;
          state.ergebnis = { n: zeilen.length, name: name, groesse: blob.size, spalten: g.length, gekappt: gekappt,
                             abweichung: abweichung, erwartet: isFinite(gesamt) ? gesamt : null };
          state.lauf = null; state.phase = "fertig";
          renderAll(); fokusFuss();
        }, scheitern).catch(dateiFehler);
      }
      return true;
    }
    function abbrechen(){
      if (state.phase !== "laeuft") return;
      state.lauf = null; state.phase = "wahl";
      laufStoppen();
      renderAll(); fokusFuss();
    }
    /* "Export another" (fertig): zurueck zu den Einstellungen, Datensatz und Wahl bleiben -- links
       ist die Liste wieder frei. Ein eigener Dateiname bleibt (derselbe Datensatz). */
    function nochEinExport(){
      if (state.phase !== "fertig") return;
      state.ergebnis = null; state.phase = "wahl";
      renderAll(); fokusFuss();
    }
    /* ---- Dateiname umbenennen (17.10.) ----
       Lebensdauer: der eigene Name gilt, bis links ein anderer Datensatz gewaehlt (typSetzen) oder
       der Dialog geschlossen wird (closePopup); danach wieder der Vorschlag. Ein zweiter Export
       desselben Datensatzes ("Export another") behaelt ihn. */
    function namenMass(){ elFootMass.setAttribute("data-wert", elFootIn.value); }
    function namenBeginnen(){
      if (state.phase !== "wahl" || state.processing || elFootName.disabled) return;
      state.namenEdit = true;
      elFootIn.value = dateiStamm(state.type);
      namenMass();
      renderAll();
      fokus(elFootIn);
      try { elFootIn.select(); } catch(e){}
    }
    /* Uebernehmen (Enter, Fokus geht woanders hin): leer oder gleich dem Vorschlag heisst "kein
       eigener Name" -- dann folgt der Name weiter dem Zeitraum, statt ein altes Datum festzuhalten. */
    function namenUebernehmen(zurueckFokus){
      if (!state.namenEdit) return;
      var s = stammSaeubern(elFootIn.value, true);
      state.eigenName = s && s !== namenVorschlag(state.type) ? s : null;
      state.namenEdit = false;
      renderAll();
      if (zurueckFokus) fokus(elFootName);
    }
    function namenVerwerfen(){
      if (!state.namenEdit) return;
      state.namenEdit = false;
      renderAll();
      fokus(elFootName);
    }
    /* Verbotene Zeichen fallen schon beim Tippen weg (auch beim Einfuegen), nicht erst beim
       Uebernehmen -- sonst stuende ein "/" im Feld, das dann still verschwindet. Die Schreibmarke
       bleibt dort, wo sie war, abzueglich der entfernten Zeichen davor. */
    elFootIn.addEventListener("input", function(){
      var v = elFootIn.value, s = stammSaeubern(v, false);
      if (s !== v){
        var pos = elFootIn.selectionStart == null ? s.length : elFootIn.selectionStart;
        var vorher = stammSaeubern(v.slice(0, pos), false).length;
        elFootIn.value = s;
        try { elFootIn.setSelectionRange(vorher, vorher); } catch(e){}
      }
      namenMass();
    });
    elFootIn.addEventListener("keydown", function(e){
      if (e.key === "Enter" && !e.isComposing){ e.preventDefault(); namenUebernehmen(true); }
    });
    elFootIn.addEventListener("blur", function(){ namenUebernehmen(false); });
    function fireExport(){
      if (state.processing || state.phase !== "wahl") return;   // already sent, ignore a repeat click
      if (gesperrt(state.type) || keineSpalten()) return;
      state.fehler = "";
      if (exportSelbst()) return;
      /* Shopping und Ads gibt es nur in der App: ohne core oder Team kein Bubble-Weg, sondern ein Satz. */
      if (EXPORTE[state.type] && EXPORTE[state.type].neu){ fehlerSetzen(["The export didn't work", "Please try again."]); renderAll(); return; }
      fireExportBubble();
    }
    function fireExportBubble(){
      if (state.processing) return;
      var fnName = root.getAttribute("data-export-fn") || "bubble_fn_upstreemExport";
      var fn = resolveBubbleFn(fnName);
      /* KEIN Rueckfall auf einen anderen Namen. Ich hatte einen eingebaut, als der Name mit
         Suffix nicht gefunden wurde -- und damit ging der Aufruf still an ein gleichnamiges
         Element ohne Workflow. Der Export tat nichts, ohne eine einzige Meldung, und die
         Ursache war unter dem Rueckfall begraben.
         Wird der konfigurierte Name nicht gefunden, ist das ein Fehler und gehoert gemeldet --
         so wie in jeder anderen Komponente hier auch. */
      /* Same shape as every other component here (see Mira's miraAction): ONE JSON string as the
         single argument, values pulled out on the Bubble side by regex. A Toolbox
         "Javascript to Bubble" element only captures the first argument anyway. */
      var payload = {
        export_type: state.type,
        date_from: isoDate(state.from),
        date_to: isoDate(state.to),
        /* Computed directly from the selected dates — no arithmetic needed on the Bubble side, and
           therefore no way for a days-vs-milliseconds unit mismatch to sneak back in (that's what
           made every range collapse to "today and yesterday": date_range added as if it were
           already milliseconds shifts the boundary by a few hundred ms, not by days). Both are
           START OF DAY in the browser's local timezone, matching what date_from/date_to already
           represent — so to_unix is the start of the LAST included day, not its end. If your
           backend query needs the end of that day, use `< to_unix + 86400000` (one day in ms)
           rather than `<= to_unix`. */
        from_unix: utcMidnight(state.from),
        to_unix: utcMidnight(state.to),
        // Negative on purpose: the workflow that (previously) built from_unix/to_unix on the
        // Bubble side added date_range to to_unix rather than subtracting it, which — with a
        // positive value — moved from_unix LATER than to_unix and produced "invalid date range".
        // Flipping the sign here made that addition land correctly. Now that from_unix/to_unix
        // above remove the need for that arithmetic entirely, this is kept only for anything else
        // that might still read it (e.g. a human-readable "N days" display) — for computing the
        // actual boundaries, prefer from_unix/to_unix.
        date_range: -dayCount(state.from, state.to),
        token: String(state.token == null ? "" : state.token),
        /* Leer heisst: kein Filter (Bubble setzt dann p_url / p_domain auf null). */
        url: String(state.url || ""),
        domain: String(state.domain || ""),
        prompt_id: String(state.promptId || ""),
        /* Marken-Drawer (12.10.): Bubble reicht es als p_brand an export_responses_v1,
           export_citations_domains_v1 und export_citations_urls_v1 weiter; leer heisst null. */
        brand_id: String(state.brandId || "")
      };
      var payloadJson;
      try { payloadJson = JSON.stringify(payload); } catch(e){ payloadJson = ""; }
      if (typeof fn === "function"){
        try { fn(payloadJson); } catch(e){}
      } else {
        /* NIEMAND EMPFAENGT (14.10.): bis hierher drehte der Knopf 90 s und ging dann still zurueck --
           in der App, wo es keinen Bubble-Workflow gibt, bei jedem Export, der hierher fiel. Jetzt
           sofort ein Satz, und der Dialog bleibt offen (seit Variante D als roter Satz im Dialog). */
        fehlerSetzen(["The export didn't work", "Please try again."]);
        renderAll();
        /* Knapp und ohne Namensliste. Die Meldung selbst bleibt: ein Export, der stumm nichts tut,
           ist der schlimmere Fall. Haeufigste Ursache, gemessen: das Element ist unsichtbar --
           Bubble veroeffentlicht bubble_fn_* nur fuer sichtbare Elemente. In der App (ohneBubble)
           gibt es kein solches Element -- dort sagt es der Satz oben, die Konsole bleibt still. */
        var kk = window.UpstreemCore;
        if (!(kk && kk.ohneBubble && kk.ohneBubble())) console.warn("[upstreem-export] " + fnName + " nicht gefunden. Ist das " +
          "JavaScriptToBubble-Element auf dieser Seite SICHTBAR? Unsichtbare Elemente " +
          "veroeffentlichen ihre Funktion nicht.");
      }
      try {
        root.dispatchEvent(new CustomEvent("upstreem-export", { detail: payload, bubbles: true }));
      } catch(e){}
      if (typeof fn === "function") setProcessing(true);
    }

    /* ---------------- listeners ---------------- */
    /* Nur wenn es einen gibt -- siehe oben. */
    if (btn) btn.addEventListener("click", function(e){ e.preventDefault(); e.stopPropagation(); openPopup(); });

    /* Ein Druck, der IM Dialog begann und auf dem Schleier endet (Text markieren und darueber
       hinausziehen), schliesst nicht -- dieselbe Regel wie in UC.makeModal. */
    var druckAufSchleier = false;
    overlay.addEventListener("mousedown", function(e){ druckAufSchleier = e.target === overlay; });
    overlay.addEventListener("click", function(e){
      if (state.processing) return;   // locked until window.upstreemExportResolve() is called
      // click on the backdrop (not inside the dialog) closes -- auch waehrend des Laufs (Abbruch)
      if (!elDialog.contains(e.target)){
        if (e.target === overlay && druckAufSchleier) closePopup();
        druckAufSchleier = false;
        return;
      }
      druckAufSchleier = false;
      var t = e.target;
      if (t.closest(".uex-close")){ closePopup(); return; }
      var weg = t.closest("[data-uex-filterweg]");
      if (weg){
        /* Abgewaehlt gilt fuer dieses Oeffnen und fuer jeden Datensatz, in dessen Scope der Filter
           liegt -- der Wert bleibt stehen, damit "Restore filters" ihn zurueckholt. Der Fokus geht
           auf das naechste Kreuz, sonst auf "Restore filters" (es steht jetzt da): die Tastatur
           bleibt im Feld, statt auf den Export zu springen. */
        var feld = weg.getAttribute("data-uex-filterweg");
        var kreuze = [].slice.call(overlay.querySelectorAll(".uex-chips [data-uex-filterweg]"));
        var nr = kreuze.indexOf(weg);
        if (feld) state.weg[feld] = true;
        renderAll();
        var rest = overlay.querySelectorAll(".uex-chips [data-uex-filterweg]");
        if (!fokus(rest[Math.min(nr, rest.length - 1)]) && !fokus(q(".uex-filter-zurueck"))) fokusFuss();
        return;
      }
      if (t.closest("[data-uex-filterzurueck]")){
        state.weg = {};
        renderAll();
        if (!fokus(q(".uex-chips [data-uex-filterweg]"))) fokusFuss();
        return;
      }
      var typeBtn = t.closest("[data-type]");
      if (typeBtn){
        typSetzen(typeBtn.getAttribute("data-type"));
        state.fehler = ""; state.zeitFehler = ""; state.offen = "";
        pruefen(); spaltenHolen(state.type); persist();
        /* Am Telefon ist die Wahl der Schritt nach rechts; der Fokus geht auf "Back", den
           Anfang der neuen Haelfte. Breit bleibt er auf dem Eintrag. */
        var weiter = schmal();
        if (weiter) state.schritt = "einst";
        renderAll();
        if (weiter) fokus(elZurueck);
        return;
      }
      if (t.closest(".uex-zurueck")){
        state.schritt = "liste"; closeCalendar();
        renderAll(); fokus(gewaehlterEintrag());
        return;
      }
      var presetBtn = t.closest("[data-preset]");
      if (presetBtn){
        state.fehler = ""; state.zeitFehler = ""; state.offen = "";
        applyPreset(presetBtn.getAttribute("data-preset"));
        fokus(elZeitfeld);
        return;
      }
      /* Hier kommt nur an, was den unsichtbaren Ausloeser nicht trifft: die Tastatur (Enter auf
         dem Feld) und die Maus, solange es keinen Kalender gibt. Gestoppt, damit der
         Aussen-Klick-Waechter der Dropdowns das eben geoeffnete Feld nicht gleich wieder schliesst. */
      if (t.closest(".uex-zeitfeld")){
        e.stopPropagation();
        if (!kalenderOeffnen()){ state.offen = state.offen === "zeit" ? "" : "zeit"; renderAll(); }
        return;
      }
      var sp = t.closest("[data-spalte]");
      if (sp){
        var cfg = EXPORTE[state.type];
        if (!cfg) return;
        var aus = state.ohne[cfg.spalten] || (state.ohne[cfg.spalten] = {});
        var key = sp.getAttribute("data-spalte");
        if (aus[key]) delete aus[key]; else aus[key] = true;
        persist(); renderAll(); return;
      }
      if (t.closest("[data-uex-alle]")){
        var c2 = EXPORTE[state.type];
        if (c2) delete state.ohne[c2.spalten];
        persist(); renderAll();
        /* Der Knopf ist danach weg (alle gewaehlt) -- der Fokus geht auf die erste Spalte. */
        fokus(q(".uex-spalten [data-spalte]"));
        return;
      }
      if (t.closest(".uex-foot-name")){ namenBeginnen(); return; }
      if (t.closest(".uex-zweit")){
        if (state.phase === "laeuft") abbrechen();
        else if (state.phase === "fertig") nochEinExport();
        else closePopup();
        return;
      }
      if (t.closest(".uex-submit")){ if (state.phase === "fertig") closePopup(); else fireExport(); return; }
    });

    /* Tastatur im Dialog: Pfeile in einer Radiogruppe (die Liste links, die Ersatzliste der
       Zeitraeume) wandern und waehlen; Tab bleibt im Fenster (aria-modal verspricht das, dieselbe
       Falle wie im Tarif-Fenster in core). Am Telefon waehlen die Pfeile in der Liste NICHT -- dort
       hiesse Waehlen den Schritt wechseln; Enter oder Leertaste waehlt. */
    overlay.addEventListener("keydown", function(e){
      if (!state.open) return;
      if (e.key === "Tab"){
        var f = [].filter.call(elDialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
          function(x){ return !x.disabled && x.tabIndex >= 0 && x.getClientRects().length > 0 && !x.closest("[hidden]") && !x.closest(".uex-cal-slot"); });
        if (!f.length) return;
        var erst = f[0], letzt = f[f.length - 1], akt = document.activeElement;
        if (e.shiftKey && (akt === erst || !elDialog.contains(akt))){ e.preventDefault(); letzt.focus(); }
        else if (!e.shiftKey && (akt === letzt || !elDialog.contains(akt))){ e.preventDefault(); erst.focus(); }
        return;
      }
      var r = e.target && e.target.closest ? e.target.closest('[role="radio"]') : null;
      var grp = r && r.closest('[role="radiogroup"]');
      if (!grp) return;
      var schritt = (e.key === "ArrowDown" || e.key === "ArrowRight") ? 1 : ((e.key === "ArrowUp" || e.key === "ArrowLeft") ? -1 : 0);
      if (!schritt) return;
      e.preventDefault();
      var alle = [].slice.call(grp.querySelectorAll('[role="radio"]'));
      var i = alle.indexOf(r);
      var ziel = alle[(i + schritt + alle.length) % alle.length];
      if (!ziel) return;
      fokus(ziel);
      if (grp === elNav && schmal()) return;
      ziel.click();
      fokus(ziel);
    });

    document.addEventListener("keydown", function(e){
      if (e.key === "Escape" && state.open && !state.processing){
        // let the calendar close its own panel first if that's what's open
        /* .udr-menu, nicht .udr-panel -- den Selektor gibt es nicht, die Pruefung lief also
           immer ins Leere und Escape schloss den Dialog samt offenem Kalender. */
        var calPanel = document.querySelector(".udr-menu.is-shown, .udr-wrap.is-open");
        if (calPanel) return;
        /* Das erste Escape gehoert dem Feld des Dateinamens: es verwirft die Eingabe, der Dialog
           bleibt offen. Hier in der Einfangphase, weil dieser Waechter vor dem Feld selbst laeuft. */
        if (state.namenEdit){
          e.preventDefault(); e.stopPropagation();
          namenVerwerfen();
          return;
        }
        /* Ebenso die Ersatzliste der Zeitraeume (ohne Kalender): erst sie, dann der Dialog. */
        if (state.offen === "zeit"){
          e.preventDefault(); e.stopPropagation();
          state.offen = ""; renderAll(); fokus(elZeitfeld);
          return;
        }
        /* Auch waehrend des Laufs: Schliessen bricht ab (der Satz unter dem Balken sagt es). */
        closePopup();
      }
    /* EINFANGPHASE (16.10. gemessen): core schliesst offene Dropdowns mit einem eigenen keydown am
       Dokument, der VOR diesem lief -- hier war das Kalenderfeld dann schon zu, und dasselbe Escape
       schloss den ganzen Dialog. In der Einfangphase sieht diese Pruefung das Feld noch offen. */
    }, true);

    /* Eine Antwort von pruefen/spaltenHolen (oder ein fehlender Export beim Klick) zeichnet den
       offenen Dialog neu -- auch wenn ein anderer Controller gefragt hat. */
    window.addEventListener("uex-verfuegbar", function(){ if (state.open) renderAll(); });

    new MutationObserver(syncTheme).observe(root, {
      attributes: true, attributeFilter: ["data-isdark"]
    });
    // reconcile once right after attaching: the value may have resolved between the initial
    // read above and this observer existing, and that change would otherwise be lost
    syncTheme();

    new MutationObserver(function(){
      var t = normType(root.getAttribute("data-export-type"));
      if (t && t !== state.type){ typSetzen(t); persist(); renderAll(); }
      var tok = root.getAttribute("data-token");
      if (tok != null && tok !== "EXPORT_ACCESSTOKEN" && tok !== state.token){ state.token = tok; persist(); }
    }).observe(root, { attributes: true, attributeFilter: ["data-export-type", "data-token"] });

    /* Der Kalender wird gleich angelegt (siehe kalenderAnlegen); ein Fehler dabei kostet nur den
       Custom-Bereich, den Dialog nie. */
    try { kalenderAnlegen(); } catch(e){}
    renderAll();

    return {
      root: root,
      open: openPopup,
      close: closePopup,
      isOpen: function(){ return !!state.open; },
      isProcessing: function(){ return !!state.processing; },
      /*
        Bubble Toolbox → Run JavaScript, called once the export workflow has actually finished:
        window.upstreemExportResolve("YOUR_INSTANCE_ID");
        Ends the processing state and closes the dialog. A no-op if the dialog isn't
        currently processing (safe to call defensively / more than once).
      */
      resolveProcessing: function(){
        if (!state.processing) return false;
        setProcessing(false);
        closePopup();
        return true;
      },
      setContext: function(opts){
        /* Auch TEXT annehmen. Ohne das musste der Run-JS-Schritt ein Objektliteral von Hand
           bauen -- und ein leerer Bubble-Ausdruck darin ("export_accesstoken": ,) toetet den
           ganzen Schritt beim PARSEN, samt aller Aufrufe darunter (§46). Mit einem einzigen
           Backtick ist derselbe leere Wert nur Text. */
        /* window.UpstreemCore direkt, KEINE UC-Variable: diese Datei kommt ohne core aus (siehe
           den Kommentar an dunkelJetzt), und ein `UC.` hier warf "UC is not defined" -- gemessen,
           bevor es jemand in Bubble gemerkt haette. Ohne core faellt es auf JSON.parse zurueck. */
        if (typeof opts === "string"){
          var C = window.UpstreemCore;
          if (C && C.readBubble) opts = C.readBubble(opts);
          else { try { opts = JSON.parse(opts); } catch (e){ opts = null; } }
        }
        opts = opts || {};
        /* Waehrend ein Export laeuft oder fertig dasteht, bleibt der Dialog bei seinem Datensatz --
           ein neuer Kontext gilt fuer das naechste Oeffnen. */
        if (state.open && state.phase !== "wahl") return true;
        var t = normType(opts.export_type != null ? opts.export_type : opts.type);
        if (t) typSetzen(t);
        var tok = (opts.export_accesstoken != null) ? opts.export_accesstoken : opts.token;
        if (tok != null) state.token = String(tok);
        /* EIN FILTER AUF EINE ADRESSE ODER DOMAIN (12.10., URL-Drawer: export_responses_v1 kennt
           p_url und p_domain). Bei JEDEM setContext neu gesetzt, auch auf leer -- und beim Schliessen
           geleert (closePopup): ein Export, der spaeter von einer Seite ohne Filter aufgeht, darf
           nicht die Adresse des Drawers mitnehmen. Nicht im Speicher (persist): ein Filter ist
           Kontext, keine Einstellung. */
        state.url = opts.url != null ? String(opts.url) : "";
        state.domain = opts.domain != null ? String(opts.domain) : "";
        state.promptId = opts.prompt_id != null ? String(opts.prompt_id) : "";
        state.brandId = opts.brand_id != null ? String(opts.brand_id) : "";
        /* filter_label (16.10.): der lesbare Name zu prompt_id bzw. brand_id fuer den Chip im Feld
           Filters und das Filterzeichen links ("Filtered to VW"). Ohne ihn steht dort "This brand" /
           "This prompt". */
        state.filterLabel = opts.filter_label != null ? String(opts.filter_label) : "";
        /* DIE FILTER DER SEITE (16.10., erst Shopping und Ads, seit dem Abend jede Seite): params je
           Datensatz (die Parameter ihrer Liste, siehe KENNT), namen je Chip (lesbare Werte, die der
           Dialog nicht selbst findet) und der Zeitraum der Seite als Vorgabe. Bei jedem Aufruf neu
           gesetzt, auch auf leer, und beim Schliessen geleert (closePopup) -- ein Kontext gilt fuer
           DIESEN Export; abgewaehlte Chips eines frueheren Kontexts gelten nicht mehr.
           filter_aktiv (die erste Fassung von Shopping und Ads, ein Chip "Page filters" ohne
           Kreuz) wird nicht mehr gelesen: die Chips entstehen jetzt aus den Parametern selbst. */
        state.params = {}; state.namen = {}; state.weg = {};
        /* ohne_brille (17.10.): Ein Drawer, dessen Listen ohne den Intent-/Branded-Filter der App laufen (Prompt-
           Detail: EIN Prompt, filterStand ohneIntent), meldet das hier. Sonst haengte der Export die Vorgabe
           non_branded der App an, und die Datei eines als branded erkannten Prompts waere leer, waehrend der
           Drawer seine Laeufe zeigt (Paritaetsaudit PAR-01, entstanden mit der Behebung von EXP-02). */
        state.ohneBrille = !!opts.ohne_brille;
        var pr = opts.params && typeof opts.params === "object" ? opts.params : {};
        Object.keys(pr).forEach(function(n){
          if (typVon(n) && pr[n] && typeof pr[n] === "object" && !Array.isArray(pr[n])) state.params[n] = pr[n];
        });
        var nm = opts.namen && typeof opts.namen === "object" ? opts.namen : {};
        Object.keys(nm).forEach(function(n){ if (seitenChipKey(n) && voll(nm[n]) && typeof nm[n] !== "object") state.namen[n] = String(nm[n]); });
        /* Ein Preset der Seite ist dasselbe Preset hier (gleiche Schluessel wie der Kalender); ein
           freier Zeitraum wird beim Oeffnen in den Picker gegeben (syncCalendarToState). */
        var zf = parseIso(opts.date_from), zt = parseIso(opts.date_to);
        if (zf && zt && zf.getTime() <= zt.getTime()){
          var pk = String(opts.preset == null ? "" : opts.preset);
          var istPreset = PRESETS.some(function(x){ return x.key === pk; });
          state.preset = istPreset ? pk : "custom";
          state.from = zf; state.to = zt;
          state.zeitVonSeite = !istPreset;
        }
        persist(); renderAll();
        return true;
      },
      destroy: function(){
        returnCalendar();
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (root.__uexController === this) root.__uexController = null;
      }
    };
  }

  /* ================= init / multi-instance bootstrap ================= */
  function initRoot(root){
    if (root.__uexController) return root.__uexController;
    var id = root.getAttribute("data-instance") || "default";
    if (id === "INSTANCE_ID") return null;   // placeholder not replaced yet
    var ctrl = makeController(root);
    if (!ctrl) return null;
    root.__uexController = ctrl;
    return ctrl;
  }
  function initAll(){
    var roots = document.querySelectorAll(".uex-root");
    for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
  }
  function rootsWithId(id){
    var out = [], roots = document.querySelectorAll(".uex-root");
    for (var i = 0; i < roots.length; i++){
      if (roots[i].getAttribute("data-instance") === id) out.push(roots[i]);
    }
    return out;
  }
  function resolve(id){
    var r = rootsWithId(String(id || "").trim());
    if (!r.length) return null;
    if (r.length === 1) return initRoot(r[0]);
    // instanceId collision (this reusable placed twice): prefer the visible one
    for (var i = 0; i < r.length; i++){
      try { if (r[i].offsetParent) return initRoot(r[i]); } catch(e){}
    }
    return initRoot(r[0]);
  }

  function doOpen(id, opts){
    var ctrl = resolve(id);
    if (!ctrl) return false;
    if (opts) ctrl.setContext(opts);
    ctrl.open();
    return true;
  }
  function doClose(id){ var c = resolve(id); if (!c) return false; c.close(); return true; }
  function doSetContext(id, opts){ var c = resolve(id); if (!c) return false; return c.setContext(opts); }
  function doResolve(id){ var c = resolve(id); if (!c) return false; return c.resolveProcessing(); }

  window.upstreemExportOpen = doOpen;
  window.upstreemExportClose = doClose;
  window.upstreemExportSetContext = doSetContext;
  window.upstreemExportResolve = doResolve;
  window.__uexResolveLocal = function(id){ return rootsWithId(id).length > 0; };

  /* ================= forwarder on parent AND top (nested reusables) =================
     If this component sits on a reusable that is itself placed on ANOTHER reusable, a Bubble
     "Run Javascript" step usually executes at window.top — two or more iframe layers above this
     script. Walk the full iframe tree and deliver only to the frame that owns the instanceId. */
  (function exposeUpward(){
    var targets = [];
    try { if (window.parent && window.parent !== window) targets.push(window.parent); } catch(e){}
    try { if (window.top && window.top !== window && targets.indexOf(window.top) === -1) targets.push(window.top); } catch(e){}
    if (!targets.length) return;
    function makeDeliver(w){
      return function(fnName, id, arg1, arg2){
        var queue = [w], seen = [];
        while (queue.length){
          var win = queue.shift(), ifr;
          try { ifr = win.document.querySelectorAll("iframe"); } catch(e){ continue; }
          for (var i = 0; i < ifr.length; i++){
            var cw; try { cw = ifr[i].contentWindow; } catch(e){ cw = null; }
            if (!cw || seen.indexOf(cw) !== -1) continue;
            seen.push(cw); queue.push(cw);
          }
        }
        for (var a = 0; a < seen.length; a++){
          try {
            var c = seen[a];
            if (c && typeof c[fnName] === "function" && c.__uexResolveLocal && c.__uexResolveLocal(id)) return c[fnName](arg1, arg2);
          } catch(e){}
        }
        for (var b = 0; b < seen.length; b++){
          try { var c2 = seen[b]; if (c2 && typeof c2[fnName] === "function") return c2[fnName](arg1, arg2); } catch(e){}
        }
        return false;
      };
    }
    for (var t = 0; t < targets.length; t++){
      (function(w){
        try {
          var deliver = makeDeliver(w);
          w.upstreemExportOpen = function(id, opts){ return deliver("upstreemExportOpen", id || "default", id, opts); };
          w.upstreemExportClose = function(id){ return deliver("upstreemExportClose", id || "default", id); };
          w.upstreemExportSetContext = function(id, opts){ return deliver("upstreemExportSetContext", id || "default", id, opts); };
          w.upstreemExportResolve = function(id){ return deliver("upstreemExportResolve", id || "default", id); };
        } catch(e){}
      })(targets[t]);
    }
  })();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
  else initAll();
  [30, 100, 250, 500, 1000, 1800].forEach(function(ms){ setTimeout(initAll, ms); });
  /* Nicht im Hintergrund-Tab (QS-14); der Wechsel zurueck holt einen Lauf nach. */
  setInterval(function(){ if (!document.hidden) initAll(); }, 1500);   // cheap no-op once initialised; catches late Bubble rebuilds
  document.addEventListener("visibilitychange", function(){ if (!document.hidden) initAll(); });
  /* Gebuendelt auf einen Lauf je 250ms und danach takeRecords -- derselbe Umbau, den der
     Icon-Stempel in core schon hinter sich hat. Ungebuendelt lief initAll() (mit einem
     dokumentweiten querySelectorAll) bei JEDER Mutation irgendwo auf der Seite: die
     Chart-Tooltips schreiben bei jeder Mausbewegung ihr innerHTML neu, also lief diese Suche
     mehrmals pro Mausbewegung mit. Ein spaet eingehaengtes Element wird 250ms spaeter gefunden,
     und das faellt niemandem auf -- die Suche im Animationsfenster fiel auf. */
  var uexGeplant = false;
  var uexObs = new MutationObserver(function(muts){
    if (uexGeplant) return;
    for (var i = 0; i < muts.length; i++){
      if (muts[i].addedNodes && muts[i].addedNodes.length){
        uexGeplant = true;
        setTimeout(function(){
          uexGeplant = false;
          initAll();
          try { uexObs.takeRecords(); } catch(e){}
        }, 250);
        return;
      }
    }
  });
  uexObs.observe(document.documentElement, { childList: true, subtree: true });
})();
