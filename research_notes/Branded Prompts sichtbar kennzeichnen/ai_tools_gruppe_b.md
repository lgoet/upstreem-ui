# Branded vs. Non-branded Prompts in Otterly.AI, Rankscale, Goodie AI, Semrush (AI Toolkit / Enterprise AIO) und Ahrefs Brand Radar

Stand der Recherche: 21.10.2026. Alle Quellen öffentlich (Help-Center, Academy, Changelogs, API-Dokumentation, Vergleichsseiten), keine Anmeldung. Datumsangaben der Quellen stehen jeweils dabei; ältere Angaben sind markiert.
**Lesart:** „Cited Findings" = an der Quelle verifiziert (abgerufen). Steht „nur Suchtreffer", wurde die Aussage nur im Suchergebnis-Auszug gesehen, nicht auf der abgerufenen Seite. „Inferences" = eigene Ableitung, nicht dokumentiert.

Fall, auf den abgeleitet wird: lee-up.de/cedric-leenen wurde heute genau einmal zitiert, nur durch einen branded Prompt („Leeup Media Erfahrungen"). Standardfilter in upstreem: „non-branded". (1) Tabelle „Cited URLs" im Tracking: Zeile da, „Citations (30d)" = 0, „First cited" = heute; (2) URL-Detail: „Last seen today", Kennzahlen 0, Läufe leer; (3) Sitemap/Abdeckung: 1 Zitierung, Badge „New or updated"; (4) Domainseite › URLs: URL fehlt. Der Filter ist nirgends sichtbar.

---

## Frage 1: Unterscheiden die Tools branded und non-branded Prompts, und was ist der Standard (enthalten, ausgeschlossen, getrennt)?

### Takeaway
Nur **Semrush** (Brand Performance) und **Rankscale** modellieren branded/non-branded als echte Dimension: Semrush mit festen, beschrifteten Segmenten und teils fest auf „non-branded" beschränkten Kennzahlen, Rankscale als Pflicht-Tag je Prompt. **Ahrefs Brand Radar** hat keinen Schalter: branded Anfragen sind standardmäßig enthalten, man baut die Trennung über „Query contains / does not contain {brand}". **Otterly** kennt kein Feld, warnt aber über eine Empfehlung „Branded Prompts", sobald überhaupt einer existiert. Zu **Goodie** gibt es keine öffentliche Dokumentation. Kein Tool schließt branded Prompts standardmäßig *still* aus; wo ein Teil ausgeschlossen ist (Semrush), steht es im Namen bzw. in der Beschreibung der Kennzahl.

### Cited Findings

**Ahrefs Brand Radar**
- Keine eigene branded/non-branded-Klassifikation dokumentiert; Ahrefs empfiehlt Filterkombinationen: „Query contains {your brand}" für „Branded searches only", „Query does not contain {your brand} AND response OR citation contains {your brand}" für „Unbranded queries where you have visibility", „Citation contains {your domain} AND response AND query don't contain {your brand}" für „Unbranded topics AI links to you"; Filter lassen sich in Gruppen verschachteln (Seite zuletzt aktualisiert 12.12.2025) – [Ahrefs Blog: 10 Ways to Use Brand Radar](https://ahrefs.com/de/blog/brand-radar-use-cases/)
- Dieselbe Seite: Die Eingabe des Markennamens in eine leere Suche „pre-filter[s] the database to show you high-intent, relevant queries and responses that contain your brand name"; ohne Markennamen zeigt eine leere Suche alle Anfragen/Antworten, die die Domain zitieren. Der Bericht „Search queries" ist auf Anfragen mit dem Markennamen vorgefiltert – [Ahrefs Blog](https://ahrefs.com/de/blog/brand-radar-use-cases/)
- Academy-Lektion „AI responses": „apply a filter where the query doesn't contain your brand, but the response or citation contains your brand" (Screenshots laut Dateinamen vom 12.11.2025) – [Ahrefs Academy: AI responses](https://ahrefs.com/academy/how-to-use-brand-radar/ai-responses)
- Wettbewerber-Vergleich (Peec AI, 27.02.2026, also parteiisch): branded Begriffe „are included in the dataset by default, causing significant data bias"; zum Ausschluss „applying a separate filter for each individual brand you want to exclude"; als Schwäche gelistet: „No easy exclusion of branded prompts" – [Peec AI vs Ahrefs Brand Radar](https://peec.ai/comparison/peec-ai-vs-ahrefs-brand-radar)
- Datengrundlage: Ahrefs-Prompts stammen aus Googles People-Also-Ask-Fragen (Datensatz Jul./Aug. 2026 von ca. 14 auf 30 Mio. Prompts erweitert) – [Ahrefs: New in July and August ’26](https://ahrefs.com/blog/new-features-july-august-2026/); Help-Artikel vom 03.09.2026: Prompts „derived from People Also Ask questions", Chatbots einmal im Monat aktualisiert – [Ahrefs Help: What is Brand Radar](https://help.ahrefs.com/pt-BR/articles/11064852)
- Seit Dez. 2025 zwei Datensätze (globaler Ahrefs-Datensatz und eigene „custom queries"), umschaltbar über den „Dataset filter"; dazu der „“Your brand” quick filter", der die eigene Marke „with one click" in Mentions und Citations ein- oder ausschließt. Welcher Datensatz Standard ist, steht dort nicht – [Ahrefs: New features Dec 2025](https://ahrefs.com/blog/new-features-dec-2025)

**Semrush AI Visibility Toolkit / Semrush One**
- Brand Performance › Perception: „Sentiment metrics across this report are based on non-branded queries only." – [Semrush KB 1595: Brand Performance Reports](https://www.semrush.com/kb/1595-brand-performance-reports)
- Brand Performance › Narrative Drivers › Top Cited Domains: „Lists the most cited domains that AI platforms cite for non-branded questions in your topic area." – [Semrush KB 1595](https://www.semrush.com/kb/1595-brand-performance-reports)
- Brand Performance › Narrative Drivers › Breakdown by Question: vier Preset-Karten über der Tabelle: „Answers Non-branded", „Answers Branded", „Citations Non-branded", „Citations Branded" (z. B. „Citations Branded: Ensure the right story is being told by checking the sources cited in answers to branded queries"); „Above the table, use the preset cards to quickly filter the data" – [Semrush KB 1595](https://www.semrush.com/kb/1595-brand-performance-reports)
- Die Brand-Performance-Prompts sind laut Semrush synthetisch, „a mix of branded and non-branded queries" (nur Suchtreffer-Auszug aus der Semrush-KB; auf der abgerufenen englischen Fassung von KB 1595 nicht wiedergefunden) – [Semrush KB 1595 (ko)](https://ko.semrush.com/kb/1595-brand-performance-reports)
- Prompt Tracking (eigene Prompts): keine branded/non-branded-Klassifikation dokumentiert. Marke nur über „Manage brand names" (Zahnrad). Tags sind „Custom labels you apply to prompts (for example, by brand, location, or intent)"; „+Add filter" bietet Textbedingungen, die Prompts ein- oder ausschließen (KB ohne Datum, Bilder vom 09.07.2026) – [Semrush KB 1503: Prompt Tracking](https://www.semrush.com/kb/1503-prompt-tracking)
- Visibility Overview: Daten aus Semrushs Prompt-Datenbank („317M+ AI queries"); eine branded/non-branded-Trennung ist nicht dokumentiert (Seite verweist auf ein Update vom 17.07.2026) – [Semrush KB 1596: Visibility Overview Report](https://semrush.com/kb/1596-visibility-overview-report)
- Reviewer-Beobachtung (Exploding Topics, 28.08.2026, gilt toolübergreifend): „these default prompts are typically branded"; für unbranded, thematisch verwandte Prompts „you'll need to find and add those queries manually" – [Exploding Topics: SE Visible vs. Semrush](https://explodingtopics.com/blog/se-visible-vs-semrush)

**Semrush Enterprise AIO (heute in Adobe Brand Visibility)**
- Adobe Brand Visibility, Prompt Management (31.07.2026): bezahlte Prompt Library „powered by Semrush Enterprise AIO"; eine Kachel „Branded / Unbranded" als Gesundheitsindikator, der meldet, wenn der Branded-Anteil aus einem gesunden Bereich läuft. Bereich, Wortlaut und Erkennung sind nicht dokumentiert – [Adobe Experience League: Prompt Management](https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/prompt-management)
- Adobe-Partner-News Juli 2026: Health Checks in der Prompt Library, „such as balance between branded and unbranded prompts" (nur Suchtreffer) – [Adobe Partner News: What's new in Adobe Brand Visibility](https://partners.adobe.com/digitalexperience/news/2026/07/what-new-adobe-brand-visibility)
- Enterprise-AIO-Landingpage: Aufschlüsselung „by model, country, topic, and more"; branded/unbranded nicht genannt (nur Suchtreffer) – [Semrush Enterprise AIO (Adobe)](https://business.adobe.com/products/semrush/enterprise/aio)

**Otterly.AI**
- Recommendations: Empfehlung Nr. 2 „Branded Prompts", Auslöser „Any branded prompt exists", Typ „Prompts", Bereich „General" (Seite vom 05.10.2026); eine Begründung steht dort nicht – [Otterly Help: AI Recommendations](https://help.otterly.ai/ai-recommendations)
- Ein Suchtreffer-Auszug des Onboarding-Leitfadens sagte, non-branded Prompts würden betont, um „biased reports" zu vermeiden, branded solle man getrennt überwachen; auf der abgerufenen Seite steht das **nicht** (Widerspruch, evtl. geänderte Seite) – [Otterly Help: Onboarding](https://help.otterly.ai/onboarding2)
- Kein Feld „branded" in der Prompt-Tabelle; Spalten: „Prompt, Brand Coverage, Brand Sentiment Score, Intent Volume, Brand Mentions, Total Brand Mentions, Domain Citations, Total Domain Citations, Ads, Shopping Cards, Competitors, Tags" (05.10.2026) – [Otterly Help: Prompt Monitoring](https://help.otterly.ai/search-prompt-monitoring?hsLang=en)
- Ein Brand Report enthält nur die ihm zugeordneten Prompts („adjust which are included at any time via the gear icon"); „Set up a separate report for each brand, market, or campaign" (05.08.2026) – [Otterly Help: Custom Brand Reports](https://help.otterly.ai/custom-brand-reports)

**Rankscale**
- Jeder Prompt einer Gruppe bekommt ein „visibility hygiene"-Tag, branded oder non-branded, eine von drei Pflicht-Tag-Dimensionen (neben Intent und Scope); branded = „floor", non-branded = „ceiling" (27.04.2026) – [Rankscale Academy: Branded vs Non-Branded Prompts](https://rankscale.ai/resources/modules/setting-up-prompt-groups/branded-vs-non-branded)
- Prompt-Gruppe nach Schema 3x2x2 = 12 Prompts („Three intents x two scopes x two visibility-hygiene states (branded / non-branded)"); Beispiel-Tags „Non-branded, Consideration, Niche (prepaid)"; branded = Kernphrase plus Markenname (27.04.2026) – [Rankscale Academy: What is a Prompt Group](https://rankscale.ai/resources/modules/setting-up-prompt-groups/what-is-a-prompt-group)
- Unterschiedliche Schwellen: branded „Good if Detection Rate ≥ 95%", „Bad if Detection Rate < 90%"; non-branded gegen Kategorie-Median („Standard") und „Floor"; branded zuerst beheben – [Rankscale Help: How to Prioritize Which Search Term to Fix First](https://help.rankscale.ai/articles/6779353551-how-to-prioritize-which-prompt-to-fix-first)
- Dashboard-Lektion: Mentions-Ziel „≥95%" bei branded, „≥ top 3 competitors" bei non-branded (27.04.2026) – [Rankscale Academy: How to Read Your Dashboard](https://rankscale.ai/resources/modules/diagnose/how-to-read-your-rankscale-dashboard)
- Rankscale-Inhalte liegen gespiegelt auch unter ai-visibility.keyword.com; eine Übernahme durch Keyword.com ist nicht belegt – [Rankscale-Spiegel auf keyword.com](https://ai-visibility.keyword.com/resources/modules/setting-up-prompt-groups/branded-vs-non-branded)

**Goodie AI**
- Keine öffentliche Dokumentation zu branded/unbranded. Visibility Monitoring nennt Segmente „geography, persona, model, language, and topic category" (Seite ohne Datum, Inhalte ca. Mitte/Ende 2026) – [Goodie: Visibility Monitoring](https://higoodie.com/features/ai-visibility-monitoring/)
- Preisseite: Core „110 prompts", Pro „250 prompts"; „We'll recommend a starting set during onboarding based on your brand profile"; Berichte „Visibility Overviews", „Deep Citation Analysis"; branded/non-branded nicht erwähnt – [Goodie: Pricing](https://higoodie.com/pricing/)
- Ein Suchtreffer-Auszug zeigte auf der GEO-Seite „Increase branded and non-branded generative impressions"; auf der abgerufenen Seite kommt der Begriff **nicht** vor (Widerspruch) – [Goodie: Generative Engine Optimization](https://higoodie.com/features/generative-engine-optimization)
- Goodie AI Visibility Index: „real user prompts, not brand-supplied keywords", Prompt-Arten „comparisons, recommendations, "best of" questions, and troubleshooting" – [Goodie: Index Methodology](https://higoodie.com/ai-visibility-index/methodology/)

### Inferences
- Standard je Tool (abgeleitet): **Ahrefs** enthalten (Peec-Aussage plus fehlender Schalter); **Semrush Prompt Tracking** enthalten (keine Klassifikation); **Semrush Brand Performance** gemischt: einzelne Kennzahlen fest non-branded, andere per Karte getrennt; **Otterly** enthalten, aber als Problem markiert (Empfehlung); **Rankscale** enthalten, über den Tag-Filter („All Tags") trennbar; **Goodie** unbekannt.
- upstreem ist mit „non-branded als Standard" näher an Semrush Brand Performance als an den anderen. Semrush löst die Sichtbarkeit dort über die **Beschriftung der Kennzahl selbst** („non-branded queries only", „for non-branded questions"), nicht über einen versteckten globalen Filter.
- Die branded-Erkennung ist in keinem der fünf Tools für Prompts automatisch dokumentiert: Ahrefs per Textfilter, Rankscale per Tag, Otterly erkennt „branded" offenbar intern (sonst könnte die Empfehlung nicht auslösen), Semrush Brand Performance klassifiziert seine synthetischen Prompts selbst.

### Gaps
- Wie Otterly einen Prompt als „branded" erkennt (für die Empfehlung) und ob es eine Begründung bzw. Aktion dazu gibt: nicht dokumentiert.
- Ob Rankscale das branded-Tag automatisch setzt: nicht dokumentiert.
- Ob der Ahrefs-„Dataset filter" standardmäßig beide Datensätze zeigt: nicht dokumentiert (die API nimmt ohne Angabe beide, siehe Frage 4).
- Goodie: keine Doku, keine unabhängigen Reviews mit Screenshots gefunden; Verhalten offen. Klärung nur per Demo/Vertrieb.
- Semrush Enterprise AIO selbst (ohne Adobe-Hülle): keine öffentliche Doku zu einem branded-Filter gefunden.

---

## Frage 2: Wo und wie ist der Filter bzw. das Segment sichtbar (Chip, Schalter, Segmentwahl, Badge, Fußnote, Tooltip)?

### Takeaway
Drei Muster: (a) **Filterbedingung in einer Filterleiste**, die der Nutzer selbst baut und die damit sichtbar bleibt (Ahrefs, Semrush „+Add filter"); (b) **Dropdown mit „All …" als Standardwert** (Rankscale „All Tags"); (c) **Segment im Namen der Kennzahl oder Karte** (Semrush „Answers Non-branded", „Citations Branded"; Sätze „based on non-branded queries only"). Badges an Zeilen für „branded" sind in keinem Tool dokumentiert.

### Cited Findings
- Ahrefs: Filter stehen in „the filter bar at the top of any report" und lassen sich stapeln (03.09.2026) – [Ahrefs Help](https://help.ahrefs.com/pt-BR/articles/11064852); seit April 2026 sitzen URL-Filter in den Cited-Berichten in „a filter bar below the tabs" statt im Tabellenkopf – [Ahrefs: New features Apr 2026](https://ahrefs.com/blog/new-features-apr-2026/)
- Ahrefs: Mentions-Segmente „Only brand", „With others", „Others only" im Overview – [Ahrefs Blog](https://ahrefs.com/de/blog/brand-radar-use-cases/); „Others only" per Hover über die eigene Marke im Mentions-Index – [Ahrefs Academy](https://ahrefs.com/academy/how-to-use-brand-radar/ai-responses)
- Ahrefs: Der „Your brand"-Filter hat laut API zwei Felder: `brand_name` (`mentioned`/`not_mentioned`) und `page_status` (`cited`, `found_but_not_cited`, `not_found`); er bezieht sich auf die **Antwort**, nicht auf die Anfrage – [Ahrefs API: Cited pages](https://docs.ahrefs.com/api/reference/brand-radar/post-cited-pages)
- Semrush Brand Performance: Segmente als Preset-Karten über der Tabelle („Answers Non-branded" usw.) und als Satz in der Berichtsbeschreibung („based on non-branded queries only") – [Semrush KB 1595](https://www.semrush.com/kb/1595-brand-performance-reports)
- Semrush Prompt Tracking: „Tags filter" im Overview, „+Add filter" mit Ein-/Ausschluss per Textbedingung – [Semrush KB 1503](https://www.semrush.com/kb/1503-prompt-tracking)
- Rankscale Brand Dashboard: Filterleiste mit „All Engines", „All Topics", „All Tags", „All Prompts", dazu Zeitraum und „Apply" – [Rankscale Help: Brand Dashboard](https://help.rankscale.ai/articles/3577670426); Citations-Tab: dieselbe Leiste filtert alle Abschnitte nach Engine, Topic, Tag oder Search Term – [Rankscale Help: Citations Tab](https://help.rankscale.ai/articles/3980938915)
- Otterly: Filter oben im Citations-Bericht: „date range, tags, engine, and country" (24.07.2026) – [Otterly Help: Citations Report](https://help.otterly.ai/how-can-citations-report-help-you-analyze-your-content-gaps); Tags „to categorize and filter" Prompts (nur Suchtreffer) – [Otterly Help: Using Tags](https://help.otterly.ai/using-tags)
- Adobe Brand Visibility (Semrush Enterprise AIO): Gesundheitsanzeige als Kachel „Branded / Unbranded" in der Prompt Library, also auf der Verwaltungsseite der Prompts, nicht im Bericht – [Adobe: Prompt Management](https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/prompt-management)

### Inferences
- Für upstreem übertragbar: der Standardfilter „non-branded" sollte wie bei Rankscale als **sichtbarer Wert in der Filterleiste** stehen (ein Chip „Non-branded" statt eines leeren „All …"), oder wie bei Semrush im **Etikett der betroffenen Kennzahl** („Citations (30d, non-branded)").
- Kein Tool zeigt ein Zeilen-Badge „branded" an Prompts oder URLs. Das wäre bei upstreem eine eigene Lösung, kein übernommenes Muster.

### Gaps
- Exakte UI-Beschriftung des Ahrefs-„Your brand"-Schalters (Chip, Segmented Control?) ist nur über die API umrissen; die Help-Seite nennt Labels nur in Screenshots, die nicht auslesbar waren.
- Ob Semrush die Preset-Karte bei Auswahl als aktiv markiert (Chip, Hervorhebung): nicht beschrieben.

---

## Frage 3: Wie werden Zeilen und Werte gekennzeichnet, die nur aus einem herausgefilterten Segment stammen oder unter dem aktuellen Filter 0 sind?

### Takeaway
Dokumentiert sind vor allem **Statusetiketten auf Antwortebene** (Ahrefs „Found but not cited", Otterly „brand mention (Yes/No)" und „Not Mentioned"-Filter, Semrush „Your brand not mentioned"-Tag, Rankscale Domains in Klammern). Eine Kennzeichnung „0 unter diesem Filter, aber außerhalb vorhanden" („N hidden") hat **keines** der fünf Tools dokumentiert. Im Normalfall verschwindet eine Zeile einfach, wenn der Filter ihre einzige Quelle entfernt; nur Ahrefs kann gezielt **Null-Zeilen** für beobachtete URLs liefern.

### Cited Findings
- Ahrefs Cited pages: Spalten „Cited in" (Antworten, in denen zitiert) und „Found in" (Antworten, in denen die Seite gefunden wurde, zitiert oder nicht); Kennzeichnung „Found but not cited"; Chart-Modus „Found in" mit durchgezogener Linie (gefunden) und gestrichelter (zitiert) – [Ahrefs: New features Apr 2026](https://ahrefs.com/blog/new-features-apr-2026/)
- Ahrefs API: `tracked_urls` – „the response includes zero-citation rows for tracked URLs with no data"; der `page_status`-Wert `not_found` existiert als eigener Zustand – [Ahrefs API: Cited pages](https://docs.ahrefs.com/api/reference/brand-radar/post-cited-pages)
- Otterly „All cited URLs": Spalte „brand mention (Yes/No)", dazu ein Filter „Not Mentioned" – [Otterly Help: Citations Report](https://help.otterly.ai/how-can-citations-report-help-you-analyze-your-content-gaps)
- Otterly API: Wachstum aus null wird als `percentageChange` = 100 ausgegeben – [Otterly API: Citation history for a cited URL](https://docs.otterly.ai/api-reference/brand-reports/get-citation-history-for-a-cited-url.md)
- Otterly Winners & Losers: Warnung, dass eine kleine Ausgangsbasis wenige neue Zitierungen wie einen großen Sprung aussehen lässt; man solle den absoluten Wert prüfen – [Otterly Help: Citations Report](https://help.otterly.ai/how-can-citations-report-help-you-analyze-your-content-gaps)
- Semrush Visibility Overview: im Antwort-Modal ein Tag „Your brand not mentioned" – [Semrush KB 1596](https://semrush.com/kb/1596-visibility-overview-report); Prompt Tracking › cited page details zeigt je Prompt den Erwähnungsstatus „including lost mentions" – [Semrush KB 1503](https://www.semrush.com/kb/1503-prompt-tracking)
- Semrush Share of Voice by Platform: „Other" ist standardmäßig ausgeblendet – [Semrush KB 1595](https://www.semrush.com/kb/1595-brand-performance-reports)
- Rankscale Top Domains List: „Domains with no brand mentions appear in brackets" – [Rankscale Help: Citations Tab](https://help.rankscale.ai/articles/3980938915)
- Rankscale Brand Dashboard: kein Vergleichs-Badge, wenn weniger als drei Wettbewerber genug Daten haben oder Marke und alle Wettbewerber null sind; ausdrücklich „No badge does not mean average." – [Rankscale Help: Brand Dashboard](https://help.rankscale.ai/articles/3577670426)

### Inferences
- Das Rankscale-Muster („kein Badge heißt nicht Durchschnitt", Klammern für Domains ohne Markennennung) und Otterlys Ja/Nein-Spalte zeigen: Die Tools kennzeichnen **Zustände**, nicht **Filterherkunft**. Für upstreem wäre „nur durch branded Prompts zitiert" also ein neues Etikett, für das es bei diesen fünf kein Vorbild gibt.
- Ahrefs' Paar „Cited in"/„Found in" ist strukturell das nächste Vorbild für „im Filter / insgesamt": zwei Zählungen nebeneinander statt einer, die stumm 0 wird. Übertragen hieße das bei upstreem etwa „Citations (30d)" = 0 neben „All prompts: 1".
- Otterlys Warnung zur kleinen Basis passt auf den Fall: eine einzelne Zitierung erzeugt bei upstreem ein „New or updated"-Badge; Otterly würde dafür +100 % zeigen, aber mit der Aufforderung, den absoluten Wert zu prüfen.

### Gaps
- Wie Ahrefs/Semrush/Otterly eine Zelle mit 0 darstellen („0", „–", leer, grau): nicht dokumentiert.
- Ob irgendein Tool „N rows hidden by filter" oder ähnliche Hinweise zeigt: nicht gefunden.

---

## Frage 4: Wie funktionieren Cited-Pages-/Source-/URL-Tabellen und URL-Detailseiten (First seen, Last seen, Citations, Share), und folgen Zeitstempel dem Filter?

### Takeaway
**Keines** der Tools dokumentiert „First seen" oder „Last seen" für zitierte URLs. Alle arbeiten mit **Zählungen im gewählten Zeitraum** (plus Vergleich zum Vorzeitraum oder Tagesreihe), und diese Zählungen hängen an denselben Filtern wie der Rest des Berichts (Tag, Engine, Land, Datum). Damit stellt sich die Frage „Zeitstempel ignoriert den Filter" dort gar nicht. Wo es eine URL-Detailansicht gibt (Otterly Citation Details, Semrush cited page details, Adobe URL Inspector „Details", Ahrefs AI responses gefiltert nach Citation-URL), listet sie die **Prompts/Antworten, die die URL zitiert haben**.

### Cited Findings

**Ahrefs Brand Radar**
- Cited domains ist seit April 2026 kein eigener Bericht mehr, sondern Reiter „All domains" neben „Yours", „Competitors", „Other"; Spalten „Cited in" und „Found in"; Chart-Modi „Found in" und „Position" (durchschnittliche Zitierposition über Zeit, Linienstärke = Anzahl der Zitierungen) – [Ahrefs: New features Apr 2026](https://ahrefs.com/blog/new-features-apr-2026/)
- API Cited pages: Rückgabefelder nur `url` und `responses` („Number of responses that cited the page"); Parameter `date` (ein Datum), `prompts` (`ahrefs` oder `custom`, „If omitted, both are used"), `tags_filter` (nur mit `report_id`), `content_filter` (`include`/`exclude` exakter Phrasen), `brand_filter`; **kein** first_seen/last_seen – [Ahrefs API: Cited pages](https://docs.ahrefs.com/api/reference/brand-radar/post-cited-pages)
- Eine URL im Citation-Filter des Berichts AI responses „will show you all AI responses that cite this URL" (de facto die URL-Detailansicht) – [Ahrefs Academy](https://ahrefs.com/academy/how-to-use-brand-radar/ai-responses)

**Semrush**
- Visibility Overview: Reiter „Your Performing Topics", „Topic Opportunities", „Cited Sources", „Source Opportunities", „Cited Pages"; Zeiträume „1M", „6M" (Standard), „All time"; Spalten der Cited-Tabellen und first/last seen nicht beschrieben – [Semrush KB 1596](https://semrush.com/kb/1596-visibility-overview-report)
- Prompt Tracking › Sources: „Sources by Category", „All Sources" mit Umschalter Domains/Pages; Spalten „Source Domain", „Domain category", „Cited for Prompts", „Your mentions", „Diff" (Änderung seit letztem Update), „Mention Rate"; Detail einer zitierten Seite: Prompts, in denen sie zitiert wurde, Erwähnungsstatus je Prompt inkl. verlorener Erwähnungen, Zahl der genannten Marken, „page mention rate" – [Semrush KB 1503](https://www.semrush.com/kb/1503-prompt-tracking)
- Adobe Brand Visibility (Semrush Enterprise AIO), AI Visibility (04.09.2026): Reiter „Cited pages" = eigene Seiten „and how many responses cited each"; Filter „Domain", „Market", „Platform", „Reporting period"; keine first/last-seen-Spalten – [Adobe: AI Visibility](https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/ai-visibility)
- Adobe URL Inspector (06.08.2026): Filter „Date Range" (z. B. letzte 4 Wochen, „Custom Weeks"), „Category", „Platform", „Page Content type", „Region", aktiviert per „Apply Filters", gelten für alle Abschnitte. Tabelle „Your Cited URLs": URL, „Times cited", „Prompts cited in", Categories, Regions, „Agentic hits", „Referral hits"; „Details" je Zeile zeigt Häufigkeit, Topics und Prompts, Verlauf. Kein first/last seen, kein branded-Filter dokumentiert – [Adobe: URL Inspector](https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/url-inspector)
- Adobe Brand Visibility (21.08.2026): „Citations: Each response is counted once if your website is cited." – [Adobe: Brand Visibility Overview](https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/brand-visibility/brand-visibility-overview)

**Otterly.AI**
- Citations-Bericht (24.07.2026): Filter „date range, tags, engine, and country"; Vergleich gegen ein gleich langes Fenster davor; Tabelle „All cited URLs" mit „citations count, brand mention (Yes/No), domain, domain category, and competitors"; „Citation Details" je URL: Kennzahlen, Markennennung, Wettbewerber, „Cited in prompts" mit Spalte „Brand Coverage"; Klick auf einen Prompt öffnet „Prompt Details" darüber; „Citations update daily" – [Otterly Help: Citations Report](https://help.otterly.ai/how-can-citations-report-help-you-analyze-your-content-gaps)
- Blog zum Redesign (23.07.2026): „Citation Details Drawer" mit „Citations over time", Prompts samt Engine, „brand coverage"; Sternmarkierung als persönliche Watchlist – [Otterly Blog: Citations tracking update](https://otterly.ai/blog/ai-search-citations-tracking-update/)
- API „List citations": Pflicht `startDate`, `endDate`, `country`; optional `tagId`, `engines`, `domains`, `search`, `brandMentioned`, `competitors`, `domainCategories`; Felder `url`, `domain`, `title`, `citations`, `isMyBrandDomain`, `brandMentioned`, `domainCategory`; kein first/last seen, kein Prompt-Filter – [Otterly API: List citations](https://docs.otterly.ai/api-reference/brand-reports/list-citations-for-a-brand-report.md)
- API „Citation history for a cited URL": `tagId` als Filter; Rückgabe `totalPeriodCitations`, `totalCitationsPreviousPeriod`, `percentageChange`, `citationsHistory` (tägliche Punkte je Engine) – [Otterly API: Citation history](https://docs.otterly.ai/api-reference/brand-reports/get-citation-history-for-a-cited-url.md)
- Changelog: 22.07.2026 Redesign des Citations-Berichts; 31.08.2026 „Domain Sources" in der Brand Report Overview; 23.06.2026 Reiter „Citations" im Prompt-Detail – [Otterly Changelog](https://help.otterly.ai/changelog?hsLang=en)

**Rankscale**
- Citations-Tab: „Total Citation Occurrences", „Top 20 Citations by Domain", „Daily Mentions by Top Domain", „Citation Category Distribution", „Brand Share" (drei Donuts), „Top Domains List", „Top URLs"; alles über die Filterleiste filterbar; Spalten und Datumsfelder nicht beschrieben – [Rankscale Help: Citations Tab](https://help.rankscale.ai/articles/3980938915)
- Brand Dashboard: „Sources" zählt Seiten der eigenen Domains in den Quellenlisten „even when the brand isn't named"; Kennzahlen als „Latest" oder Periodendurchschnitt (Ø), Mentions/Sources/Citations als Periodensumme – [Rankscale Help: Brand Dashboard](https://help.rankscale.ai/articles/3577670426)

**Goodie AI**
- Nur Marketingtext: „top domains citing you", Bericht „Deep Citation Analysis"; keine Spalten dokumentiert – [Goodie: Visibility Monitoring](https://higoodie.com/features/ai-visibility-monitoring/), [Goodie: Pricing](https://higoodie.com/pricing/)

### Inferences
- Wenn upstreem „First cited"/„Last seen" behält, gibt es dafür bei diesen fünf Tools **kein Vorbild**. Die Mitbewerber vermeiden das Problem, indem sie nur Zählungen im Filterfenster zeigen; die Herkunft einer Zeile ergibt sich aus der Zählung.
- Da bei Otterly `tagId` sowohl in der Liste als auch in der Historie wirkt, folgt dort jede Zahl derselben Prompt-Auswahl. Eine URL, die nur von ausgefilterten Prompts kommt, erscheint dann gar nicht (keine Zeile mit 0), sofern die Liste nur Zeilen mit Zitierungen liefert (abgeleitet; die API liefert `citations` als Zahl, Nullzeilen sind nicht beschrieben).
- Ahrefs ist das einzige Tool mit dokumentierten **Null-Zeilen auf Wunsch** (`tracked_urls`). Das ist der nächste Fall zu upstreem-Ebene (1), wo die Zeile mit 0 stehen bleibt; bei Ahrefs aber nur, weil die URL ausdrücklich beobachtet wird.

### Gaps
- Ob Semrush „Cited Pages" eine Spalte mit Datum hat: nicht dokumentiert.
- Ob Ahrefs in der UI einen „First seen"-Wert für Cited pages zeigt (in Site Explorer gibt es solche Spalten für Backlinks): für Brand Radar nicht gefunden.
- Ob Otterly eine Zeile mit 0 Zitierungen zeigt, wenn ein Tag-Filter alle Quellen entfernt: nicht dokumentiert.

---

## Frage 5: Welche Leerzustände zeigen die Tools, wenn ein Filter alles entfernt?

### Takeaway
Praktisch nicht öffentlich dokumentiert. Belegt sind nur Randfälle: Adobe/Semrush Prompt Research bleibt leer bis zur Eingabe, Rankscale blendet ein Badge ohne Daten aus und sagt ausdrücklich, was das nicht bedeutet.

### Cited Findings
- Adobe Brand Visibility (Semrush Enterprise AIO) › Prompt Research: „Empty until you type a topic and press Enter" – [Adobe: AI Visibility](https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/ai-visibility)
- Rankscale: „No badge does not mean average." (kein Vergleichs-Badge bei zu wenig Daten oder wenn alle null sind) – [Rankscale Help: Brand Dashboard](https://help.rankscale.ai/articles/3577670426)
- Otterly: kein Leerzustand in Changelog oder Citations-Hilfe beschrieben – [Otterly Changelog](https://help.otterly.ai/changelog?hsLang=en), [Otterly Help: Citations Report](https://help.otterly.ai/how-can-citations-report-help-you-analyze-your-content-gaps)
- Semrush KB 1596 und 1503: keine Leerzustände beschrieben – [Semrush KB 1596](https://semrush.com/kb/1596-visibility-overview-report), [Semrush KB 1503](https://www.semrush.com/kb/1503-prompt-tracking)

### Inferences
- Für den Fall „URL-Detail, Läufe leer" gibt es bei diesen Tools keinen dokumentierten Text wie „1 run hidden by the Non-branded filter". Das Rankscale-Prinzip („Abwesenheit erklären") ist das einzige belegte Vorbild für einen erklärenden Leerzustand.

### Gaps
- Leerzustände von Ahrefs, Semrush, Otterly und Goodie bei filterbedingt leeren Tabellen: nur mit Testzugang oder Video-Walkthrough zu klären; keine Screenshots mit solchen Zuständen gefunden.

---

## Frage 6: Ahrefs Brand Radar und Semrush im Detail: Wie behandeln sie Prompts mit Markennamen in „AI visibility", „Cited pages", „Mentions", und wird ihr klassischer Branded/Non-branded-Keyword-Filter wiederverwendet?

### Takeaway
**Ahrefs:** Prompts mit Markennamen sind in allen Brand-Radar-Berichten standardmäßig enthalten. Es gibt keinen Branded-Schalter; man filtert über die Anfrage („Query contains/does not contain"), über Texteinschluss/-ausschluss oder „Your brand" (bezieht sich auf die Antwort). Der klassische Ahrefs-Filter für Keywords („Intents" › „Branded"/„Non-branded" in Organic keywords) ist laut Doku in Brand Radar **nicht** übernommen. **Semrush:** Brand Performance trennt fest und beschriftet (einzelne Kennzahlen nur non-branded, Karten für beide Segmente); Prompt Tracking und Visibility Overview haben keine Trennung. Der klassische Semrush-Filter („Advanced filters" › „Keyword type" › „Branded" / „Non-branded" / „Branded for other domains", automatische Erkennung) ist für die AI-Berichte **nicht dokumentiert**.

### Cited Findings

**Ahrefs**
- Branded-Ansichten nur über Query-Bedingungen, verschachtelbar – [Ahrefs Blog](https://ahrefs.com/de/blog/brand-radar-use-cases/)
- Branded standardmäßig im Datensatz; Ausschluss je Marke per Einzelfilter (Wettbewerberquelle, 27.02.2026) – [Peec AI vs Ahrefs Brand Radar](https://peec.ai/comparison/peec-ai-vs-ahrefs-brand-radar)
- „Your brand"-Schnellfilter: eigene Marke in Mentions und Citations der AI-Visibility-Berichte ein- oder ausschließen (Dez. 2025) – [Ahrefs: New features Dec 2025](https://ahrefs.com/blog/new-features-dec-2025); per API `brand_name` mentioned/not_mentioned und `page_status` cited/found_but_not_cited/not_found – [Ahrefs API: Cited pages](https://docs.ahrefs.com/api/reference/brand-radar/post-cited-pages)
- Marken-Erkennung als Entität: „Entity is", „Entity contains", „Text matching", optional „Company" oder „Product category" (Jul./Aug. 2026) – [Ahrefs: New in July and August ’26](https://ahrefs.com/blog/new-features-july-august-2026/)
- `content_filter` mit `include`/`exclude` exakter Phrasen und `tags_filter` für eigene Prompt-Tags (nur mit `report_id`) – [Ahrefs API: Cited pages](https://docs.ahrefs.com/api/reference/brand-radar/post-cited-pages)
- Klassischer Ahrefs-Filter: in Organic keywords über das Dropdown „Intents" mit „Branded"/„Non-branded" (nur Drittquelle, Tutorial) – [Guideflow: Non-branded keywords in Ahrefs](https://www.guideflow.com/tutorial/how-to-track-non-branded-keywords-in-ahrefs)

**Semrush**
- Brand Performance: Perception „based on non-branded queries only"; Top Cited Domains „for non-branded questions"; Preset-Karten „Answers Non-branded/Branded", „Citations Non-branded/Branded" – [Semrush KB 1595](https://www.semrush.com/kb/1595-brand-performance-reports)
- Prompt Tracking: Mentions zählen „the brand name you selected in campaign settings"; Tags frei; Ausschluss über „+Add filter" – [Semrush KB 1503](https://www.semrush.com/kb/1503-prompt-tracking)
- Visibility Overview: Kennzahlen Mentions, Citations, Cited Pages, Monthly Audience, AI Visibility; „Citations" = „the number of AI responses that cite your domain as a source"; keine branded-Trennung beschrieben – [Semrush KB 1596](https://semrush.com/kb/1596-visibility-overview-report)
- Klassischer Semrush-Filter: Definition „A Branded keyword is a query that includes your website's brand name or variations of it and is unique to your domain"; automatische Erkennung über Sitelinks, Knowledge-Graph-Link oder erste organische Position; in „Organic Positions" und „Position Changes" über „Advanced filters" › „Keyword type" › „Branded" / „Non-branded" / „Branded for other domains"; KI-Berichte werden dort nicht erwähnt (Screenshots vom 22.05.2025) – [Semrush KB 819](https://ko.semrush.com/kb/819-branded-vs-non-branded-keywords)
- Enterprise AIO / Adobe Brand Visibility: nur der Gesundheitsindikator „Branded / Unbranded" in der Prompt Library; in AI Visibility, Brand Visibility und URL Inspector kein branded-Filter dokumentiert – [Adobe: Prompt Management](https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/prompt-management), [Adobe: URL Inspector](https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/url-inspector)

### Inferences
- Semrush ist das einzige Tool, das **denselben Fall wie upstreem** (Kennzahl bewusst ohne branded Prompts) offen ausweist: in der Berichtsbeschreibung und im Namen der Karte. Für die Zitierungen gibt es dort zwei getrennte Karten, „Citations Non-branded" und „Citations Branded"; branded Zitierungen sind also nicht verborgen, sondern einen Klick entfernt.
- Ahrefs zeigt branded Anfragen gleichrangig und überlässt die Trennung dem Nutzer; der Filter bleibt dafür als Bedingung in der Leiste sichtbar.
- Weder Ahrefs noch Semrush übernehmen ihre automatische Keyword-Erkennung für Prompts. Die naheliegende Erklärung (abgeleitet): Semrushs Erkennung stützt sich auf SERP-Signale (Sitelinks, Knowledge Graph), die es für Prompts nicht gibt.

### Gaps
- Ob die Semrush-Karten „Citations Branded/Non-branded" auch URL-Ebene haben oder nur Domains: nicht beschrieben.
- Ob Ahrefs' „Intents"-Filter mit „Branded" offiziell dokumentiert ist: nur Drittquelle gefunden.

---

## Frage 7: Ableitung: Wie würde jedes Tool den Fall lee-up.de/cedric-leenen auf den vier upstreem-Ebenen zeigen?

### Takeaway
Alle Angaben in diesem Abschnitt sind **abgeleitet**, nicht dokumentiert. Kern: In **Ahrefs, Semrush Prompt Tracking, Otterly und Rankscale** wäre die URL im Standardzustand überall mit **1 Zitierung** sichtbar, weil branded Prompts dort standardmäßig mitzählen. Erst ein vom Nutzer gesetzter, in der Filterleiste sichtbarer Filter würde sie entfernen, und zwar **auf allen Ebenen gleich**. Den upstreem-Widerspruch (Zeile mit 0, Datum „heute", Badge „neu", auf der Domainseite fehlend) kann keines dieser Tools erzeugen, weil keines first/last seen führt und Filter überall gleich wirken. Semrush Brand Performance käme upstreem am nächsten: Die non-branded-Kennzahlen würden die URL nicht zählen, die Karte „Citations Branded" würde sie zeigen.

### Cited Findings
- Grundlagen der Ableitung: Ahrefs branded standardmäßig enthalten – [Peec AI vs Ahrefs Brand Radar](https://peec.ai/comparison/peec-ai-vs-ahrefs-brand-radar); Ahrefs-URL-Filter zeigt „all AI responses that cite this URL" – [Ahrefs Academy](https://ahrefs.com/academy/how-to-use-brand-radar/ai-responses); Ahrefs Null-Zeilen nur über `tracked_urls` – [Ahrefs API](https://docs.ahrefs.com/api/reference/brand-radar/post-cited-pages)
- Semrush Brand Performance: non-branded-Kennzahlen und Karten „Citations Branded/Non-branded" – [Semrush KB 1595](https://www.semrush.com/kb/1595-brand-performance-reports); Prompt Tracking: All Sources (Pages) mit „Cited for Prompts", Detail mit Prompts – [Semrush KB 1503](https://www.semrush.com/kb/1503-prompt-tracking)
- Otterly: Filter „date range, tags, engine, and country", „All cited URLs" mit Zitierzahl und „brand mention (Yes/No)", Citation Details mit „Cited in prompts" – [Otterly Help: Citations Report](https://help.otterly.ai/how-can-citations-report-help-you-analyze-your-content-gaps); Empfehlung „Branded Prompts" – [Otterly Help: AI Recommendations](https://help.otterly.ai/ai-recommendations)
- Rankscale: Filterleiste „All Tags", Citations-Tab mit „Top URLs" – [Rankscale Help: Brand Dashboard](https://help.rankscale.ai/articles/3577670426), [Rankscale Help: Citations Tab](https://help.rankscale.ai/articles/3980938915)

### Inferences

**Ahrefs Brand Radar** (Datensatz „custom" mit dem branded Prompt; Chatbots laut Help monatlich, custom bis täglich)
- (1) Cited pages, Reiter „Yours": Zeile vorhanden, „Cited in" = 1, „Found in" ≥ 1. Mit Filter „Query does not contain Leeup": Zeile weg (oder, nur bei beobachteter URL über `tracked_urls`, 0). Der Filter steht sichtbar in der Leiste unter den Reitern.
- (2) URL-Detail = AI responses mit Citation-Filter auf die URL: eine Antwort mit der branded Anfrage daneben. Mit Query-Filter: leere Liste, aber beide Filter stehen sichtbar oben, die Ursache ist also ablesbar.
- (3) Keine Sitemap-/Abdeckungsansicht in Brand Radar (nicht gefunden); kein „New"-Badge dokumentiert.
- (4) Cited domains (Reiter „All domains") zählt die Domain mit derselben Logik wie (1). Ebenen widersprechen sich nicht, weil derselbe Filter überall gilt.

**Semrush AI Visibility Toolkit**
- Prompt Tracking, der branded Prompt als eigener Prompt: (1) Sources › All Sources › Pages: Zeile mit „Cited for Prompts" = 1; (2) Detail der zitierten Seite: der branded Prompt mit Erwähnungsstatus; (3) keine Abdeckungsansicht dokumentiert; (4) die Domain erscheint mit 1. Nur wenn der Nutzer über „+Add filter" Prompts mit „Leeup" ausschließt, fällt die URL überall heraus, und die Bedingung steht sichtbar in der Filterzeile.
- Brand Performance (falls der synthetische Satz den branded Prompt enthält): „Top Cited Domains" (nur non-branded) zählt lee-up.de **nicht** mit; Karte „Citations Branded" in Breakdown by Question zeigt die Quelle. Das ist das upstreem-Verhalten mit sichtbarer Beschriftung.

**Otterly.AI**
- Vorab: Die Empfehlung „Branded Prompts" würde anschlagen, solange der Prompt im Brand Report ist.
- Im Brand Report, ohne Tag-Filter: (1) „All cited URLs": Zeile mit Zitierzahl 1, „brand mention" Yes oder No je nach Seiteninhalt; (2) Citation Details: „Cited in prompts" listet den branded Prompt mit „Brand Coverage"; „Citations over time" mit einem Punkt heute; in Winners & Losers würde die URL ggf. als Gewinner mit +100 % erscheinen (Wachstum aus null); (3) keine Sitemap-Abdeckung dokumentiert, „Domain Sources" zählt lee-up.de mit; (4) dito.
- Mit Tag-Filter auf einen non-branded Tag: URL aus Liste und Historie verschwunden (alle Endpunkte filtern per `tagId`), konsistent auf allen Ebenen; der Tag-Filter ist oben sichtbar.
- Liegt der branded Prompt in einem eigenen Report („separate report for each brand, market, or campaign"): im Haupt-Report gar nicht vorhanden, auch nicht als Datum.

**Rankscale**
- Standard „All Tags": (1)/(4) „Top URLs" bzw. „Top Domains List" mit 1 Zitierung; (2) eine eigene URL-Detailseite ist nicht dokumentiert. Mit Tag-Filter „Non-branded": URL weg, der Filter steht als gewählter Wert statt „All Tags" in der Leiste. Rankscale würde die URL zudem als Beleg für die branded-Gesundheit lesen (Detection Rate auf branded Prompts), nicht als Gewinn.

**Goodie AI**
- Keine Ableitung belastbar; Verhalten undokumentiert.

**Übertragung auf upstreem (Muster, die belegt sind)**
- Filter als sichtbarer Wert in der Leiste statt „All …" (Rankscale, Otterly, Ahrefs).
- Segment im Etikett der Kennzahl (Semrush: „based on non-branded queries only"; Karten „Citations Branded" neben „Citations Non-branded").
- Zwei Zählungen nebeneinander statt einer, die still 0 wird (Ahrefs „Cited in"/„Found in").
- Abwesenheit erklären (Rankscale „No badge does not mean average").
- Keine Zeitstempel außerhalb des Filters: Die Mitbewerber führen gar keine first/last-seen-Werte für zitierte URLs; wenn upstreem sie behält, müssen sie demselben Filter folgen oder als „über alle Prompts" beschriftet sein.

### Gaps
- Alle Ebenen-Ableitungen sind ohne Testzugang entstanden; ob z. B. Otterly eine 0-Zeile zeigt oder Ahrefs eine Zeile ohne `tracked_urls` mit 0 stehen lässt, ist ungeprüft.
- Eine Sitemap-/Seitenabdeckungsansicht (upstreem-Ebene 3) wurde bei keinem der fünf Tools gefunden; die nächste Entsprechung ist Adobes URL Inspector (Enterprise AIO), ohne branded-Filter und ohne „New"-Badge.
- Goodie vollständig offen.
