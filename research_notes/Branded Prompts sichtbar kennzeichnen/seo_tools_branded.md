# Branded vs. Non-branded in klassischen SEO- und Search-Analytics-Tools (Stand 21.10.2026)

Lesart: "Cited Findings" = an der Quelle geprüft (Abruf 21.10.2026, Datum der Quelle dabei). "Inferences" = daraus abgeleitet, nicht vom Anbieter so gesagt. Wörtliche Zitate nur aus dem Google Search Central Blog (Lizenz CC BY 4.0); alle anderen Quellen sind auf Deutsch zusammengefasst, UI-Bezeichnungen im englischen Original. Quellen, die nur als Suchtreffer-Auszug gelesen werden konnten (Seite selbst 403 oder hinter Login), sind mit "(Auszug)" markiert.

## Frage 1: Google Search Console – Definition, Ort, Voreinstellung, Summen, Pages-Tab

### Takeaway
GSC hat seit 20.11.2025 (für alle berechtigten Properties seit 11.03.2026) einen KI-klassifizierten Query-Filter mit den Werten "Branded" und "Non-branded" im Search-results-Performance-Bericht, dazu eine Insights-Karte, die beide Klickmengen nebeneinander zeigt. Es gibt keine Voreinstellung: Ungefiltert sieht man alles. Der Filter wird in der Filterleiste gesetzt und gilt dann für Chart, Queries- und Pages-Tab gemeinsam. Weil es ein Query-Filter ist, fallen anonymisierte Anfragen aus allen Summen. Branded und Non-branded ergeben zusammen also weniger als die ungefilterte Summe. Google dokumentiert das in der Hilfe, nicht in der Ansicht selbst (Letzteres nicht verifiziert).

### Cited Findings
- **Einführung und Ausweitung:** Der Blogpost vom 20.11.2025 stammt von Michael Huzman (Software Engineer, Search Console). Das Update vom 11.03.2026 lautet: "The branded queries filter is now available to all eligible sites." – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en)
- **Definition (Blog):** "A branded query is a query that includes your brand name (for example, Google), variations or misspellings of the brand name (for example, Gogle), and brand-related products or services: (for example, Gmail)." – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en)
- **Zwei Sichten; Non-branded ist als Rest definiert (Blog):** "Branded: Shows performance data for queries that include your brand name or closely associated products (for example, Gmail for google.com)." / "Non-branded: Shows performance data for all other queries." – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en)
- **Klassifikation (Blog):** "The classification of branded versus non-branded is NOT based on a regular expression method of including or excluding keywords, which is already available in the "Filter by query" section. It is determined by an internal, AI-assisted system. It includes your website brand name in all languages, typos, and also queries that don't include the brand name but refer to a unique product or service of the site." – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en)
- **Fehlklassifikation eingeräumt (Blog):** "Due to the dynamic and contextual nature of brand classification, some queries may occasionally be misidentified." Der Filter habe außerdem keinen Einfluss auf das Ranking. – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en)
- **Wirkung auf Metriken (Blog):** Der Filter gilt für alle Suchtypen (web, image, video, news). Angewendet zeigt er "metrics—such as impressions, clicks, average position, and CTR—limited specifically to the selected group." – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en)
- **Insights-Karte (Blog):** "we have added a new card to the Insights report that shows the breakdown of total clicks for branded versus non-branded traffic". Den genauen Kartentitel nennt der Blog nicht. – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en)
- **Berechtigung (Blog):** Der Filter steht nur für "top level properties" bereit, nicht für URL-Pfad-Properties (`https://example.com/path`) oder Subdomain-Properties. Er setzt außerdem "a sufficient volume of queries and impressions" voraus. Der Blog listet diese Gründe ausdrücklich als Erklärung für den Fall, dass die Option fehlt. – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en)
- **Bedienung laut Hilfe (Abschnitt "Measuring brand awareness"):** Man klickt in die Filterleiste, wählt den Query-Filter und dort "Branded" oder "Non-branded". Die Hilfe definiert "Branded queries" als Anfragen mit Markenname, Domain oder einem markenspezifischen Produkt bzw. einer Dienstleistung, einschließlich gängiger Falschschreibungen. "Non-branded queries" sind Anfragen ohne Markennamen, oft allgemeiner. Ausgeschlossen sind Sub-Properties und Sites mit wenigen Impressionen. – [Search Console Help 17010961](https://support.google.com/webmasters/answer/17010961?hl=en)
- **Keine Voreinstellung genannt:** Weder Blog noch Hilfe nennen einen Default. Der Filter wird beschrieben als etwas, das man auswählt. Laut Hilfe zeigt die Standardansicht des Berichts Klicks und Impressionen der letzten drei Monate. – [Search Console Help 7576553](https://support.google.com/webmasters/answer/7576553); [Help 17010961](https://support.google.com/webmasters/answer/17010961?hl=en)
- **Ein Filter gilt für alle Tabs:** Laut Hilfe filtert ein Klick auf eine Query in der Tabelle den gesamten Bericht auf diese Query, und der Pages-Tab zeigt dann die zugehörigen URLs. Im Pages-Tab sind die Tabellendaten nach Seite aggregiert, deshalb können Summen von den Property-Summen im Chart abweichen. Der Chart ist immer nach Property aggregiert. – [Help 17010961](https://support.google.com/webmasters/answer/17010961?hl=en); [Help 17011259](https://support.google.com/webmasters/answer/17011259?hl=en)
- **Datenhistorie, widersprüchlich belegt:**
  - Hilfe 17010961: Daten ab Einführung "March 11, 2025".
  - Hilfe 17011259: 16 Monate Historie ab Einführung im März 2025.
  - SEJ vom 12.03.2026: Eine Nutzerin sah die Aufteilung erst ab etwa 21. Februar. John Mueller bestätigte, dass die Erfassung an einem bestimmten Punkt beginnt und man das im Bericht sieht, wenn man weit genug zurückgeht. Rückwirkend wird also nicht klassifiziert.

  Quellen: [Help 17010961](https://support.google.com/webmasters/answer/17010961?hl=en); [Help 17011259](https://support.google.com/webmasters/answer/17011259?hl=en); [Search Engine Journal, 12.03.2026](https://www.searchenginejournal.com/google-answers-questions-about-search-consoles-branded-queries-filter/569549/)
- **Keine Anpassung möglich:** Auf die Frage nach eigenen Markenvarianten sagte Mueller, ihm seien keine Pläne bekannt. Auf die Frage, ob man Begriffe hinzufügen kann: derzeit nicht. – [Search Engine Journal, 12.03.2026](https://www.searchenginejournal.com/google-answers-questions-about-search-consoles-branded-queries-filter/569549/)
- **Anonymisierte Anfragen (Blog 19.10.2022):**
  - "Anonymized queries are those that aren't issued by more than a few dozen users over a two-to-three month period."
  - "While the actual anonymized queries are always omitted from the tables, they are included in chart totals, unless you filter by query."
  - Rechenbeispiel im Post: Filter "fiction" = 175 Klicks, ohne "fiction" = 275, zusammen 450 bei einer ungefilterten Chart-Summe von 550.

  Quelle: [Google Search Central Blog, 19.10.2022](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive)
- **Troubleshooting-Hilfe:**
  - Anonymisierte (seltene) Ergebnisse fehlen in der Tabelle und stehen in den Chart-Summen, außer ein Query-Filter ist gesetzt.
  - Die Summen von "match" und "does not match" ergeben nicht unbedingt die ungefilterte Summe. Als Grund nennt die Hilfe Anonymisierung und Trunkierung.
  - Die Tabelle zeigt höchstens 1.000 Zeilen.
  - Daten sind meist nach 2–3 Tagen verfügbar.
  - Begründet wird das Weglassen mit dem Schutz der Privatsphäre.

  Quelle: [Search Console Help 17010575](https://support.google.com/webmasters/answer/17010575)
- **KI-Traffic nicht getrennt:** Für AI Overviews und AI Mode gibt es keinen eigenen Ausweis; dieser Traffic steckt in "Web". (Sekundärquelle) – [WebFX, 27.03.2026](https://www.webfx.com/blog/marketing/search-console-branded-queries/)
- **Widersprüchlicher UI-Pfad in Sekundärquelle:** Ruby Shore (22.05.2026) beschreibt den Weg "+ New" → "Search Type" → Branded/Non-branded. Laut Google-Hilfe liegt der Filter im Query-Filter; die Hilfe ist maßgeblich. Ruby Shore schreibt außerdem: Fehlt die Option, ist das eine Mengenschwelle und kein Fehler. – [Ruby Shore](https://www.rubyshore.com/insights/gsc-branded-queries-filter-explained-who-can-access-it-and-how-it-works)

### Inferences
- Branded/Non-branded ist technisch ein Query-Filter. Deshalb greift die dokumentierte Regel: Mit gesetztem Filter fallen anonymisierte Anfragen auch aus den Chart-Summen, und Branded plus Non-branded ergibt weniger als "alle". Google sagt das für den Brand-Filter nicht ausdrücklich; es folgt aus Blog 2022 und Help 17010575.
- **Keine Nullzeilen:** GSC-Tabellen entstehen aus den gefilterten Daten. Eine Seite, die nur Impressionen aus Marken-Anfragen hat, steht unter "Non-branded" gar nicht im Pages-Tab, auch nicht als Zeile mit 0. Stützend: Die Filterliste zeigt nur Optionen, für die Impressionen erfasst sind (Help 17011259). Eine ausdrückliche Doku zu 0-Zeilen gibt es nicht.
- **Keine Datumsfelder:** GSC hat im Performance-Bericht kein "First seen"/"Last seen". Zeitliche Information steckt nur im Chart, und der folgt demselben Filter wie die Tabelle. Damit gibt es in GSC keine Stelle, an der ein ungefiltertes Datum neben gefilterten Kennzahlen steht.
- **Sichtbarkeit des Filters:** Er ist sichtbar, weil man ihn in der Filterleiste selbst setzt und er dort als aktive Auswahl stehen bleibt. Wie das Chip genau beschriftet ist (etwa "Query: Non-branded"), konnte ohne Anmeldung nicht geprüft werden.
- **Der konkrete Fall in GSC** (URL nur über eine Marken-Anfrage geklickt):
  - **Ungefiltert, also Standard:** `/cedric-leenen` erscheint im Pages-Tab mit dem Klick, nach 2–3 Tagen Verzögerung. Eine einmalige Anfrage ist sehr wahrscheinlich "anonymized", also im Queries-Tab nicht zu sehen. Im Pages-Tab und in der Chart-Summe zählt der Klick nach der Doku trotzdem mit (für die Pages-Tabelle nicht ausdrücklich belegt).
  - **Mit "Non-branded":** Die Seite fehlt im Pages-Tab, der Klick fehlt im Chart, und der Filter steht sichtbar in der Leiste.
  - **Mit Page-Filter plus "Non-branded":** Beide Filter stehen in der Leiste, der Chart zeigt 0 und die Tabellen sind leer. Das entspricht der leeren URL-Detailseite in upstreem, nur dass dort der Grund nicht sichtbar ist.
  - **Kein gemischter Zustand:** Eine Zeile mit 0 Klicks plus "First seen: heute" gibt es in GSC nicht.

### Gaps
- Exakte Beschriftung des aktiven Filter-Chips und Titel der Insights-Karte: ohne Anmeldung nicht prüfbar, keine Quelle mit Screenshot-Text gefunden.
- Ob GSC im UI (nicht nur in der Hilfe) einen Hinweis zeigt, dass Summen unter Query-Filter ohne anonymisierte Anfragen sind: nicht belegt.
- Ob der Brand-Filter in der Search Analytics API verfügbar ist: keine Quelle gefunden.
- Datenbeginn: Die Hilfe nennt zweimal März 2025, eine Nutzerbeobachtung (SEJ) spricht von etwa Februar (vermutlich 2026). Möglicherweise ist "2025" in der Hilfe ein Tippfehler; nicht auflösbar.

## Frage 2: Semrush – Organic Research und Position Tracking

### Takeaway
Semrush klassifiziert automatisch und zielspezifisch. Das Feld heißt "Keyword type" und hat drei Werte: "Branded", "Non-branded" und "Branded for other domains". Es ist ein Advanced filter in Organic Research (Positions, Position Changes). Ohne Filter sieht man alles. Die Overview zeigt branded und non-branded traffic als zwei Kennzahlen nebeneinander. Position Tracking hat keine automatische Trennung; Semrush empfiehlt dort Tags.

### Cited Findings
- **Definition:** Ein Branded keyword enthält den Markennamen der Website oder eine Variante davon und ist für diese Domain eindeutig. Non-branded sind Keywords ohne Markenbezug. Phrasen mit einem Markenbegriff, der nicht nur einer Domain gehört, gelten ebenfalls als non-branded. Beispiele: "Amazon discount" ist für amazon.com nicht branded; "Dove" ist für keine der beiden Dove-Sites branded. – [Semrush KB 819](https://www.semrush.com/kb/819-branded-vs-non-branded-keywords)
- **Automatische Klassifikation:** Als branded gilt ein Keyword, wenn Sitelinks mit der eigenen URL im SERP stehen, wenn das Knowledge Graph auf die Site verlinkt, oder wenn ein Markenbegriff im Keyword steht und die Domain organisch auf Platz 1 rankt. Eigene Markenbegriffe lassen sich laut Artikel nicht pflegen. – [Semrush KB 819](https://www.semrush.com/kb/819-branded-vs-non-branded-keywords)
- **Ort und Labels:** Der Filter liegt unter Advanced filters → "Keyword type" mit den Optionen "Branded", "Non-branded" und "Branded for other domains". Letzteres sind Markennamen anderer Domains, für die die untersuchte Domain in den Top 100 rankt. Verfügbar ist er in den Reports Organic Positions und Position Changes. Eine Voreinstellung nennt der Artikel nicht. Die Seite trägt kein Datum (Copyright 2026, Screenshots 2019–2025). – [Semrush KB 819](https://www.semrush.com/kb/819-branded-vs-non-branded-keywords)
- **Overview:** Oben im Organic Research Overview stehen Anzahl Keywords, Traffic, Traffic-Kosten sowie "branded traffic" und "non-branded traffic" der Domain, als zwei getrennte Zahlen. Wie sie berechnet werden, steht nicht dabei. – [Semrush KB 890](https://www.semrush.com/kb/890-Organic-Research-Overview)
- **Position Tracking:** Die Tags-Anleitung empfiehlt, Marken-Keywords zu taggen, um branded und unbranded zu vergleichen. Das ist ein manueller Weg, keine Automatik. (Auszug) – [Semrush KB 1126](https://www.semrush.com/kb/1126-position-tracking-tags)
- **Erfasste Menge, Top 100:** Semrush hat nur Daten aus den Top-100-Ergebnissen. Rankt die Domain dort nicht, ist ihre Visibility in Position Tracking 0 %. (Auszug) – [Semrush KB 65](https://www.semrush.com/kb/65-no-data)
- **Drittanleitung:** Organic Research → Positions → "Advanced filters" → "Branded"/"Non-branded". Alternativ schließt man den Markennamen mit Minus aus. – [Guideflow](https://www.guideflow.com/tutorial/how-to-check-non-branded-keywords-in-semrush)

### Inferences
- **Filter wirkt auf Zeilen:** Der Filter sitzt auf Keyword-Zeilen (Keyword × URL). Unter "Non-branded" fällt eine URL, die nur für ein Marken-Keyword rankt, aus Positions heraus. Eine 0-Zeile entsteht nicht.
- **Ebenen können auseinanderlaufen:** Der Filter ist nur für Positions und Position Changes dokumentiert. Andere Ebenen wie der Pages-Report zeigen daher vermutlich weiter ungefilterte Werte. Dort ist dann aber auch kein Filter gesetzt, die Ansicht ist schlicht ungefiltert und nicht still gefiltert. Dass der Pages-Report den Filter wirklich nicht hat, ist nicht verifiziert.
- **"New"/"Lost" folgen dem Filter:** In Position Changes werden diese Zeilen nach dem Filter gebildet, sie folgen ihm also.
- **"Branded for other domains"** ist das direkte Gegenstück zu Prompts, die eine Konkurrenzmarke nennen. Semrush ordnet sie nicht als eigene Marke ein, weist sie aber eigens aus.
- **Der konkrete Fall in Semrush:**
  - Unter "Non-branded" taucht `/cedric-leenen` in Positions nicht auf.
  - Ohne Filter steht die Zeile mit ihrem Marken-Keyword da, erkennbar an der Klassifikation.
  - Die Overview zeigt den Anteil als eigene Zahl "branded traffic", die Menge ist also nicht verschwunden, sondern woanders ausgewiesen.
  - Ein "First seen" pro URL gibt es nicht.

### Gaps
- Ob der Pages-Report von Organic Research den "Keyword type"-Filter hat: nicht belegt.
- Darstellung nicht rankender Tracking-Keywords (Strich oder 0): nur indirekt über die 0-%-Visibility belegt.
- Ob der Semrush-Brand-Filter je als Voreinstellung aktiv ist: keine Quelle, die das nennt.

## Frage 3: Ahrefs – Site Explorer

### Takeaway
Ahrefs hat kein eigenes Marken-Setup in Site Explorer. "Branded" ist eines von mehreren Suchintent-Attributen, geschätzt aus dem SERP und definiert als "Suche nach einer bestimmten Marke oder Firma", also nicht ausdrücklich auf die eigene Marke bezogen. Gefiltert wird über das optionale "Intents"-Dropdown; Standard ist ungefiltert. Eine Option "Non-branded" ist nur in Drittanleitungen belegt.

### Cited Findings
- **Changelog Okt. 2024 (aktualisiert 11.11.2024):** Neue Spalte "Search Intents" in Site Explorer und Keywords Explorer. "Branded" bedeutet: Der Suchende sucht eine bestimmte Marke. Daneben gibt es "Local". – [Ahrefs Changelog Oct 2024](https://ahrefs.com/blog/new-features-oct-2024/)
- **Hilfeartikel (03.09.2026):**
  - Attribute: Informational, Navigational, Commercial, Transactional sowie "Branded" und "Local".
  - "Branded" heißt, dass nach einer bestimmten Marke oder Firma gesucht wird.
  - Der Intent wird aus den Google-Ergebnissen geschätzt und steht nur bei Keywords mit SERP-Daten; nur auf diese wirkt der Filter.
  - Mehrere gewählte Intents verknüpft der Filter mit ODER.
  - "Non-branded" kommt im Artikel nicht vor.

  Quelle: [Ahrefs Help 9973393](https://help.ahrefs.com/en/articles/9973393-how-to-filter-keywords-based-on-search-intent-and-other-useful-attributes)
- **Drittanleitung (Jan./Juli 2026):** Site Explorer → "Organic keywords" → Dropdown "Intents" → "Branded" bzw. "Non-branded" → Apply → "Show results". – [Guideflow non-branded](https://www.guideflow.com/tutorial/how-to-track-non-branded-keywords-in-ahrefs); [Guideflow branded](https://www.guideflow.com/tutorial/how-to-track-branded-keywords-in-ahrefs)
- **Top pages:** Ein Ahrefs-Blogpost zum Umbau von Top pages bildet "Top-Landingpages nach non-branded Traffic" über einen Keyword-Filter "Doesn't contain" mit dem Markenbegriff ab, also über einen manuellen Ausschluss. (Auszug) – [Ahrefs Blog Top Pages revamp](https://ahrefs.com/blog/top-pages-revamp)
- **Branded-Keywords-Beitrag:** Ahrefs definiert Branded keywords als Anfragen, die direkt mit Marke, Produkten oder Dienstleistungen verbunden sind. Zum Finden empfiehlt der Beitrag den Performance-Bericht in GSC bzw. Ahrefs Webmaster Tools mit den eigenen Markenbegriffen als Filter. – [Ahrefs Blog Branded Keywords](https://ahrefs.com/blog/branded-keywords/)
- **Export statt Automatik:** Ein weiterer Ahrefs-Beitrag trennt branded und unbranded per Export und händischer Markierung vor dem Chart. (Auszug) – [Ahrefs Blog ChatGPT visualizations](https://ahrefs.com/blog/ahrefs-chatgpt-visualizations/)

### Inferences
- Weil "Branded" bei Ahrefs "eine bestimmte Marke" meint, schlösse ein "Non-branded"-Filter vermutlich auch Anfragen mit Konkurrenzmarken aus. Semrush trennt hier sauber ("Branded for other domains"), Ahrefs dokumentiert das nicht. Unverifiziert.
- **Der konkrete Fall in Ahrefs:**
  - Unter Intents = Non-branded fehlt die Keyword-Zeile zu `/cedric-leenen` in Organic keywords.
  - Top pages zeigt die Seite ungefiltert weiter mit ihrem Traffic. Mit dem "Doesn't contain"-Workaround fällt sie heraus.
  - Eine 0-Zeile oder ein "First seen" für organische Seiten ist nicht dokumentiert.

### Gaps
- Offizielle Ahrefs-Doku zu einer "Non-branded"-Option in Site Explorer und dazu, ob der Overview-Traffic-Chart nach Brand geteilt werden kann: nicht gefunden.
- Ob "Branded" zielspezifisch ist (eigene Marke) oder jede Marke meint: von Ahrefs nicht klargestellt.

## Frage 4: Similarweb – Search Overview und Website Keywords

### Takeaway
Similarweb klassifiziert automatisch über Domain, Schreibvarianten und markenverwandte Begriffe mit nennenswertem Traffic. Standard ist "alles". Die Trennung erscheint als Kennzahl ("Branded Traffic" als Anteil), als Aufschlüsselung im Zeitverlauf und als Filter "Branded vs Non-Branded" in der Keyword-Tabelle. Wo eine Sicht fest nur non-branded zeigt, steht das im Namen ("Top Non-Branded Keywords") bzw. in der Definition des Presets ("Opportunities").

### Cited Findings
- **Definition und Berechnung:**
  - Ein Branded keyword enthält einen Marken- oder Produktnamen oder eine Variante davon.
  - "Domain Detection": Ist das Keyword im Domainnamen enthalten, gilt es als branded.
  - "Alternative spelling detection": Tippfehler und andere Sprachen zählen, wenn sie nennenswerten Traffic auf die Hauptdomain schicken (Beispiel "wallmart" → walmart.com).
  - "Brand-related terms": markenverwandte Begriffe mit nennenswertem Traffic auf Hauptseiten (Beispiel "itunes", "iphone" → apple.com).
  - Die Seite trägt kein Datum.

  Quelle: [Similarweb Knowledge Center: Branded Keywords](https://support.similarweb.com/hc/en-us/articles/4407713346065-Branded-Keywords)
- **Search Overview:**
  - Der Overview Bar enthält "Branded Traffic", den monatlichen Anteil des Suchtraffics aus branded gegenüber non-branded Keywords.
  - Der Graph "Search Performance over Time" lässt sich nach "Branded vs Non-branded traffic" aufschlüsseln, mit einem Tipp zur Deutung: Fokus auf Marke heißt Stärkung beim Bestandspublikum, Fokus auf non-branded heißt Verbreiterung.
  - Das Widget "Top Non-Branded Keywords" definiert im Text, was non-branded heißt, und hat drei Unteransichten: Highly Competitive, Opportunities, Wins.

  Quelle: [Similarweb Knowledge Center: Search Overview](https://support.similarweb.com/hc/en-us/articles/26006669611293-Search-Overview)
- **Website Keywords:**
  - Unter "Using the Keyword Filters" gibt es den Filter "Branded vs Non-Branded" mit Definitionen beider Werte.
  - Der Competitive-Preset "Opportunities" zeigt laut Definition nur non-branded Keywords mit 1–20 % Traffic-Anteil und Volumen über 10.
  - Die Spalte "Change" kennt "New" (Klicks im gewählten Monat, keine im Vormonat) und "Lost" (umgekehrt).
  - Der Filter "Clicks Change" hat die Werte Trending, De-Trending, Lost clicks und New clicks.

  Quelle: [Similarweb Knowledge Center: Using Website Keywords](https://support.similarweb.com/hc/en-us/articles/360010972657-Using-Website-Keywords)
- **API:** Ein Endpoint "Branded Keywords Distribution" liefert den Anteil branded gegenüber non-branded Klicks. Die alten Search-1.0-Endpoints für branded und non-branded Keywords wurden zum 28.02.2025 eingestellt. – [Similarweb API: Non-Branded Keywords – Desktop](https://developers.similarweb.com/reference/non-branded-keywords-desktop); [Similarweb Changelog](https://developers.similarweb.com/changelog/keywords-10-endpoints-will-be-deprecated-on-280225)

### Inferences
- **Benennung als Muster:** Eine dauerhaft gefilterte Sicht trägt den Filter im Titel. Der Nutzer muss nicht erraten, warum etwas fehlt.
- **"New"/"Lost" pro Zeile:** Diese Werte werden je Keyword-Zeile aus den Klicks gebildet. Unter einem Non-branded-Filter verschwindet eine Branded-Zeile samt ihrem Status, ein "New" aus ungefilterten Daten neben gefilterten 0-Klicks ist so nicht vorgesehen.
- **Der konkrete Fall in Similarweb:**
  - In Website Keywords mit "Non-Branded" fehlt die Keyword-Zeile.
  - Ungefiltert steht sie mit "New" in "Change".
  - Im Search Overview steckt der Klick im Anteil "Branded Traffic", als eigene, benannte Menge.
  - "Top Non-Branded Keywords" zeigt sie nie, und das sagt der Titel.

### Gaps
- Ob es eine Ansicht nach Landingpage mit Brand-Filter gibt und wie sie Seiten ohne non-branded Traffic zeigt: nicht gefunden.
- Schwelle für "significant traffic" in der Klassifikation: nicht genannt.

## Frage 5: Conductor, seoClarity, BrightEdge – regelbasierte Gruppen statt Automatik

### Takeaway
Die drei Enterprise-Plattformen klassifizieren laut öffentlicher Doku nicht automatisch. Nutzer legen "Branded"/"Unbranded" (Conductor), "Brand"/"Non-Brand" (seoClarity, als Search Intent bzw. Keyword Type) oder eine "Branded" keyword group (BrightEdge) über eigene Regeln an. Vor der Einrichtung gibt es keine Trennung; danach wird die Gruppe als benannter Filter in Berichten gewählt. Öffentliche Doku zu 0-Zeilen und Seitenansichten fehlt bei allen dreien.

### Cited Findings
- **Conductor:**
  - Branded entsteht als "smart keyword group", deren Regeln Keywords mit dem Markennamen einschließen. Unbranded ist dieselbe Art Gruppe, nur mit ausschließender Regel.
  - Bis zu 15 Regeln je Gruppe. Vor dem Anlegen soll man "Preview" nutzen.
  - Die Doku warnt vor "contains": "men" trifft auch "women".
  - Gruppen gelten kontoweit.
  - Im Keywords-Report filtert man nach Keyword-Gruppe, mehrere Gruppen mit OR oder AND.
  - Standardgruppen erwähnt die Doku nicht.
  - Begründung: Branded zeigt Rankings, wenn Suchende gezielt die Marke suchen; Unbranded zeigt, wo sie die Marke über Inhalte entdecken könnten.

  Quelle: [Conductor Docs: Keyword Group FAQs](https://www.conductor.com/docs/intelligence/keyword-group-faqs/)
- **Conductor Release Notes (27.05.2026):** Im Keywords-Report lassen sich Gruppen mit AND/OR kombinieren, etwa für eine breite Branded/Unbranded-Sicht ohne neue Gruppe. (Auszug) – [Conductor Release Notes](https://support.conductor.com/release-notes)
- **seoClarity:**
  - Laut Glossar ist "Search Intent (aka Keyword Types)" eine regelbasierte Klassifikation, etwa Brand gegenüber Non-Brand, über Muster auf dem Keyword-Text. Ändern sich die Regeln, wird neu berechnet.
  - Brand und Non-Brand sind die am häufigsten eingerichteten Muster.
  - Die Filter sind voneinander unabhängig und in mehreren Funktionen nutzbar.
  - Regex nach RE2 ohne Lookbehind. Bedingungen: Is, Isn't, Starts With, Ends With, Contains.
  - In Search Analytics wird sofort segmentiert.
  - (Auszug: KB-Seiten liefern 403 bzw. leiten auf den Login um.)

  Quellen: [seoClarity KB: Keyword Search Intent Types](https://kb.seoclarity.net/portal/en/kb/articles/setting-up-keyword-intent-types); [seoClarity Glossary](https://kb.seoclarity.net/portal/en/kb/articles/glossary-of-terms); [seoClarity KB: RegEx](https://kb.seoclarity.net/portal/en/kb/articles/regex-patterns); [seoClarity KB: Search Analytics](https://kb.seoclarity.net/portal/en/kb/articles/search-analytics)
- **seoClarity, Produktseite:** Versprochen wird, Brand-Keyword-Leistung zu berichten und Einblick in die Non-Brand-Leistung zu geben. (Auszug) – [seoClarity Search Analytics](https://www.seoclarity.net/search-analytics)
- **BrightEdge (Blogpost, laut Seite vor 11 Jahren 10 Monaten, also etwa Ende 2014):**
  - Mindestens zwei Markenvarianten tracken und 1–2 % des Keyword-Kontingents für Markenbegriffe einplanen.
  - Im "Clicks and Impressions Report" (Reports → Sites) einen Filter "Branded" über den Markennamen oder einen Teil davon anlegen. Filter und Sortierung bleiben erhalten, wenn der Chart ins Dashboard kommt.
  - Im Share-of-Voice-Report die "branded keyword group" wählen.

  Quelle: [BrightEdge Blog: How to monitor branded keywords](https://www.brightedge.com/blog/how-to-monitor-branded-keywords-in-brightedge-in-5-simple-steps)
- **BrightEdge, Wettbewerbsanalyse:** BrightEdge empfiehlt, zuerst Markenbegriffe herauszufiltern, um sich auf non-branded Begriffe zu konzentrieren, um die auch Wettbewerber kämpfen. Brand-Ausschluss soll man mit Positions- und Volumenfiltern kombinieren. (Auszug) – [BrightEdge Blog: Striking Distance Keywords](https://amp.brightedge.com/blog/how-to-expand-keywords-and-take-advantage-of-striking-distance-keywords); [BrightEdge Blog: Paid and Organic ROI](https://amp.brightedge.com/blog/how-to-boost-roi-for-paid-and-organic-campaigns-with-brightedge)

### Inferences
- **Filter heißt wie der Nutzer ihn nennt:** Der Filterzustand trägt hier immer den selbst vergebenen Gruppennamen ("Branded", "Unbranded"). Die Frage, ob ein Filter aktiv ist, stellt sich kaum, weil er in jedem Report bewusst gewählt wird.
- **Gruppen als Rahmen:** In Rank-Tracking-Werkzeugen mit fester Keyword-Liste (Conductor, BrightEdge, Semrush Position Tracking) sind Gruppen Teilmengen einer gepflegten Liste. Ein Keyword außerhalb der Gruppe ist schlicht nicht in der Auswahl, nicht "0".
- **Der konkrete Fall:** Eine Seite, die nur über ein Keyword der Gruppe "Branded" Traffic hat, erscheint im nach "Unbranded" gefilterten Keywords-Report nicht. Ohne Gruppenfilter erscheint sie. Unbelegt ist, ob Seitenberichte eine Zeile mit 0 zeigen.

### Gaps
- Öffentliche Doku zu Seiten- bzw. URL-Berichten unter Brand-Filter, zu 0-Zeilen und zu First-/Last-seen: bei allen drei nicht gefunden. Help-Center sind überwiegend hinter Login (seoClarity leitet auf app.seoclarity.net um, BrightEdge-Hilfe nicht frei).
- Ob Conductor oder seoClarity inzwischen eine automatische Brand-Erkennung anbieten: nicht gefunden.
- BrightEdge: aktuelle Doku zu Brand/Non-Brand nicht gefunden, nur Blogposts (teils etwa 2014).

## Frage 6: Querschnitt – Voreinstellung, Nullzeilen, First/Last seen, Filteranzeige und der konkrete Fall

### Takeaway
In keinem untersuchten Tool ist Non-branded die Voreinstellung; überall ist es eine gewählte Sicht oder ein paralleles Paar von Kennzahlen. Wo eine Sicht dauerhaft gefiltert ist, steht das im Namen (Similarweb). Kein Anbieter dokumentiert, dass eine Zeile unter Filter als 0 stehen bleibt; Zeilen entstehen aus den gefilterten Daten. Kein Anbieter dokumentiert ein Datumsfeld ("first seen", "new"), das aus ungefilterten Daten neben gefilterten Kennzahlen steht. Den Mischzustand aus upstreem (Zeile da, Kennzahl 0, Datum aus ungefilterten Daten, Filter unsichtbar) gibt es in den belegten Tools nicht.

### Cited Findings
- **Voreinstellung "alles" bzw. kein Default genannt:**
  - GSC: Der Filter wird gewählt; Standardansicht sind Klicks und Impressionen über 3 Monate. – [Help 17010961](https://support.google.com/webmasters/answer/17010961?hl=en); [Help 7576553](https://support.google.com/webmasters/answer/7576553)
  - Semrush: Advanced filter, kein Default genannt. – [Semrush KB 819](https://www.semrush.com/kb/819-branded-vs-non-branded-keywords)
  - Ahrefs: optionales Intents-Dropdown. – [Ahrefs Help 9973393](https://help.ahrefs.com/en/articles/9973393-how-to-filter-keywords-based-on-search-intent-and-other-useful-attributes)
  - Similarweb: Filter in der Tabelle, Anteil als KPI. – [Similarweb: Using Website Keywords](https://support.similarweb.com/hc/en-us/articles/360010972657-Using-Website-Keywords)
  - Conductor: Gruppenfilter. – [Conductor Docs](https://www.conductor.com/docs/intelligence/keyword-group-faqs/)
- **Beide Mengen nebeneinander statt einer ausgeblendet:**
  - GSC: Insights-Karte "branded versus non-branded". – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en)
  - Semrush: Overview mit "branded traffic" und "non-branded traffic". – [Semrush KB 890](https://www.semrush.com/kb/890-Organic-Research-Overview)
  - Similarweb: Overview Bar "Branded Traffic" plus Aufschlüsselung im Zeitverlauf. – [Similarweb: Search Overview](https://support.similarweb.com/hc/en-us/articles/26006669611293-Search-Overview)
- **Fest gefilterte Sichten tragen den Filter im Namen oder in der Definition:** "Top Non-Branded Keywords" und der Preset "Opportunities" (nur non-branded). – [Similarweb: Search Overview](https://support.similarweb.com/hc/en-us/articles/26006669611293-Search-Overview); [Similarweb: Using Website Keywords](https://support.similarweb.com/hc/en-us/articles/360010972657-Using-Website-Keywords)
- **Ein Filter gilt für den ganzen Bericht (GSC):** Ein Query-Filter wirkt auf alle Tabs, der Pages-Tab zeigt dann die zugehörigen URLs. – [Help 17010961](https://support.google.com/webmasters/answer/17010961?hl=en)
- **Summen unter Filter werden erklärt (GSC):** Unter Query-Filter fehlen anonymisierte Anfragen, und "match" plus "does not match" ergibt nicht die Gesamtsumme. Google erklärt das in Hilfe und Blog mit Rechenbeispiel. – [Help 17010575](https://support.google.com/webmasters/answer/17010575); [Google Search Central Blog 2022](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive)
- **Zeitstatus pro Zeile (Similarweb):** "New" und "Lost" werden je Keyword-Zeile aus den Klicks des gewählten gegen den vorigen Monat gebildet. – [Similarweb: Using Website Keywords](https://support.similarweb.com/hc/en-us/articles/360010972657-Using-Website-Keywords)
- **Beginn der Klassifikation wird nicht beschriftet, nur sichtbar (GSC):** Mueller sagt, der Startpunkt der Erfassung sei im Bericht zu sehen, wenn man weit genug zurückgeht. – [Search Engine Journal, 12.03.2026](https://www.searchenginejournal.com/google-answers-questions-about-search-consoles-branded-queries-filter/569549/)

### Inferences
- **Zwei Prinzipien in allen Tools:** Erstens wirkt ein Filter auf alle Elemente einer Ansicht gleich: Kennzahl, Zeilenmenge, Chart und Statusfelder. Zweitens gilt: Hat eine Ansicht keinen Filter, zeigt sie ungefilterte Daten und behauptet nichts anderes. Upstreem verletzt beides: In der Tabelle "Cited URLs" ist die Zeilenmenge ungefiltert und "Citations (30d)" gefiltert, und "First cited" kommt vermutlich aus ungefilterten Daten. Die Domain-Seite ist gefiltert, die Sitemap ungefiltert, und keine sagt es.
- **Zuordnung des konkreten Falls** (`lee-up.de/cedric-leenen`, heute einmal nur über einen Marken-Prompt zitiert):

| Ebene upstreem | GSC-Entsprechung unter "Non-branded" | Semrush ("Keyword type: Non-branded") | Similarweb ("Non-Branded") | Conductor/seoClarity/BrightEdge (Gruppe "Unbranded") |
|---|---|---|---|---|
| Tabelle "Cited URLs": Zeile da, 0, First cited heute | Pages-Tab: Zeile fehlt, Filter in der Leiste | Positions: Zeile fehlt | Keywords: Zeile fehlt; ungefiltert "New" | Keywords-Report: Zeile fehlt |
| URL-Detail: Last seen heute, 0, Liste leer | Page-Filter + Non-branded: beide Filter sichtbar, Chart 0, Tabellen leer | – (keine URL-Detailseite mit Brand-Filter belegt) | – | – |
| Sitemap/Coverage: 1 Zitat | Entspricht einer ungefilterten Ansicht; in GSC gäbe es keine ungefilterte Teilansicht ohne Hinweis | Overview: "branded traffic" als eigene Zahl | Overview: Anteil "Branded Traffic" | – |
| Domain › URLs: URL fehlt | Konsistent mit Pages-Tab unter Filter | konsistent | konsistent | konsistent |

  Die Tabelle ist abgeleitet; jede Zelle stützt sich auf die Findings der Fragen 1 bis 5. Die Zellen mit "–" sind nicht belegt.
- **Folgerung zu Nullzeilen:** Die 0-Zeile mit "First cited: today" in upstreem hat in den untersuchten Tools kein Vorbild. Analog wäre entweder "Zeile fehlt, Filter sichtbar" (GSC, Semrush) oder "Zeile da, Marken-Anteil benannt" (Overview-Paare).

### Gaps
- Für keines der Tools fand sich eine öffentliche Aussage zu "first seen/last seen folgt dem Filter". Die Tools mit Brand-Filter haben auf Seiten- bzw. Keyword-Ebene meist gar kein solches Feld, oder es ist zeilenbezogen (Similarweb "New").
- Keine Screenshots oder Doku-Texte zur genauen Darstellung aktiver Brand-Filter (Chip-Text) bei GSC, Semrush und Ahrefs ohne Anmeldung.

## Frage 7: Begründungen der Anbieter für die Trennung und wie eine Ausblendung kommuniziert wird (inkl. KI-Nachbar Microsoft Clarity)

### Takeaway
Alle Anbieter begründen die Trennung gleich: Branded misst bestehende Bekanntheit, non-branded misst Entdeckung und Wachstum. Keiner der untersuchten Anbieter blendet Marken-Traffic per Voreinstellung aus, deshalb gibt es auch keine Anleitung, wie man einen solchen Default kommuniziert. Die belegten Kommunikationsmuster sind:
- beide Mengen nebeneinander (Insights-Karte, KPI-Paar, getrennte Share-of-Authority-Karten),
- der Filter im Titel einer fest gefilterten Sicht,
- Erklärtexte, warum gefilterte Summen nicht aufgehen und warum der Filter fehlen kann.

Microsoft Clarity überträgt das Muster seit August 2026 auf KI-Zitate: Die Sicht ist nach Marke aufgeteilt, jede Query trägt ein Label, und die Markenbegriffe sind seit 29.09.2026 editierbar.

### Cited Findings
- **Google, Begründung (Blog):** "Branded queries typically lead to higher-ranking pages from your site and result in higher click-through rates, whereas non-branded queries offer organic growth, as they show how new users find your content without any initial intent to go to your site." Die Insights-Karte diene dazu, "measure brand recognition" und beide Volumina zu vergleichen. – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en)
- **Google, Hilfe:** Der Abschnitt heißt "Measuring brand awareness". Branded-Traffic komme oft von Nutzern, die die Site schon kennen; non-branded könne auf neues Publikum hinweisen. – [Help 17010961](https://support.google.com/webmasters/answer/17010961?hl=en)
- **Google, fehlende Option wird erklärt:** Der Blog listet Gründe, warum die Option fehlen kann (Property-Typ, Volumen), und räumt Fehlklassifikation offen ein. – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en)
- **Similarweb, Deutungshilfe im Produkt:** Liegt der Fokus auf branded Keywords, stärkt ein Unternehmen seine Marke beim Bestandspublikum; wer das Publikum verbreitern will, setzt auf non-branded. – [Similarweb: Search Overview](https://support.similarweb.com/hc/en-us/articles/26006669611293-Search-Overview)
- **Conductor:** Branded zeigt Rankings bei gezielter Markensuche, Unbranded die Chance, über Inhalte entdeckt zu werden. – [Conductor Docs](https://www.conductor.com/docs/intelligence/keyword-group-faqs/)
- **Semrush, Blog:** Überwiegend branded Traffic heißt, das Publikum kennt die Marke schon; mehr non-branded heißt, man erreicht neue Zielgruppen. (Auszug) – [Semrush Blog: Branded Search](https://www.semrush.com/blog/branded-search/)
- **BrightEdge:** Für Wettbewerbsanalysen zuerst Markenbegriffe herausfiltern, weil die Konkurrenz um die non-branded Begriffe kämpft. (Auszug) – [BrightEdge Blog](https://amp.brightedge.com/blog/how-to-expand-keywords-and-take-advantage-of-striking-distance-keywords)
- **Microsoft Clarity, AI Citations (Release 03.08.2026):**
  - Einzelne Queries im Queries-Card tragen ein Label "branded".
  - Die Share-of-Authority-Karte weist branded und non-branded getrennt aus.
  - Die Dashboard-Daten lassen sich nach branded oder non-branded filtern.
  - Gemeint sind "grounding queries", also die Suchen, die ein KI-System zur Quellensuche ausführt, nicht die Eingabe des Nutzers.
  - Microsofts Begründung laut Sekundärquelle: Summen verdecken, ob Leistung aus Bekanntheit oder aus Entdeckung stammt.
  - (Blog selbst nicht erreichbar, Azure-403 "web app is stopped"; Search Engine Land hinter Bot-Prüfung.)

  Quellen: [TechWyse, 04.08.2026](https://www.techwyse.com/news/platform-updates/microsoft-clarity-branded-non-branded-ai-citations-dashboard); [Clarity Blog (nicht erreichbar)](https://clarity.microsoft.com/blog/branded-non-branded-queries/)
- **Microsoft Clarity, Brand Terms editierbar (29.09.2026):**
  - Clarity füllt eine erste Liste je Site vor. Unter "Settings > AI Visibility" kann man Begriffe hinzufügen, ändern und entfernen.
  - Begriffe sind unter einem "Brand name" gruppiert, das Dashboard filtert nach Brand name oder einzelnem Begriff.
  - Karten heißen "Branded SoA" und "Non-branded SoA". In der Abbildung stehen außerdem "Edit brand names", "New brand name" sowie die Spalten "Brand name" und "Alias".
  - Eine Voreinstellung der Sicht nennt die Quelle nicht.

  Quelle: [Relevant Audience](https://www.relevantaudience.com/geo/microsoft-clarity-custom-brand-terms-ai-visibility/)

### Inferences
- **Abgrenzung zu upstreem:** Die Branche trennt, um beide Mengen getrennt zu messen, nicht um eine zu verstecken. Ein Default, der Marken-Traffic ausschließt (upstreem), ist in den untersuchten Tools ohne Vorbild. Umso mehr braucht er die Muster, die dort für gefilterte Sichten gelten: Filter im Titel oder als sichtbarer Chip, die ausgeschlossene Menge als eigene, benannte Zahl daneben, und ein Erklärtext, warum Summen nicht aufgehen.
- **Clarity als nächster Nachbar:** Clarity ist das nächstliegende Vorbild für upstreem, weil es dieselbe Domäne betrifft (KI-Zitate). Dort ist jede Query sichtbar etikettiert, und die Begriffsliste ist für den Kunden einsehbar und editierbar. GSC lässt keine Anpassung zu (Mueller); Semrush und Similarweb klassifizieren automatisch und ohne Eingriff; Conductor, seoClarity und BrightEdge lassen den Kunden alles selbst definieren.
- **Konkurrenzmarken:** Semrush führt mit "Branded for other domains" eine eigene Klasse für Anfragen mit Konkurrenzmarken. Das ist relevant, falls upstreem Prompts mit Wettbewerbernamen anders behandeln will als Prompts mit der eigenen Marke.

### Gaps
- Keine Herstellerquelle gefunden, die ausdrücklich beschreibt, wie man eine standardmäßige Ausblendung von Marken-Traffic im UI kennzeichnet, denn kein untersuchter Anbieter hat eine solche Voreinstellung.
- Clarity: Ob die AI-Citations-Ansicht standardmäßig "alle" zeigt und wie der aktive Filter beschriftet ist, steht in den erreichbaren Quellen nicht; der Originalblog war nicht abrufbar.
