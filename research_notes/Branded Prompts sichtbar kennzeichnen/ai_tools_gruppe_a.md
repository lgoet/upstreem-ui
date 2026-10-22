# Branded vs. Non-branded Prompts in Profound, Peec AI, Scrunch und AthenaHQ (Gruppe A)

Stand der Recherche: 21.10.2026. Grundlage sind nur öffentliche Quellen: Hilfecenter, Docs, Changelogs, Blog. Es gab keine Anmeldung und keinen Zugriff auf eine App. Screenshots selbst waren nicht abrufbar. Wo unten von „UI“ die Rede ist, stammt das aus der Doku-Beschreibung und nicht aus eigener Ansicht. Datumsangaben stehen bei den Quellen, die eines tragen. Bei Peec und AthenaHQ sind die Docs-Seiten undatiert.

Kennzeichnung: **[belegt]** heißt mit Quelle verifiziert, **[Snippet]** heißt nur aus einer Suchzusammenfassung, Seite nicht selbst gelesen, **[abgeleitet]** heißt eigene Schlussfolgerung.

---

## Unterscheiden die Tools branded/non-branded überhaupt, und was ist der Default in Dashboards?

### Takeaway
Drei von vier Tools modellieren den Prompt-Typ ausdrücklich. Peec klassifiziert automatisch (seit 06.07.2026), Scrunch erkennt den Typ über den Markennamen, AthenaHQ lässt ihn beim Anlegen manuell setzen. Profound hat keine native branded-Klassifikation, dort geht es nur über eigene Tags. Nur **Scrunch** schließt branded Prompts im Haupt-Dashboard per Default aus. Das ist upstreems Modell. Peec und AthenaHQ zählen per Default alles mit. AthenaHQ schließt branded nur in einer einzelnen Kennzahl aus (AI Search Value).

### Cited Findings

**Peec AI**
- [belegt] Es gibt zwei „System tags“: **Branding** und **Intent Type**. Peec setzt sie automatisch an jeden Prompt, „assigned in the background when the prompt is created“. Werte: **Branded** und **Non-branded**. Jeder Prompt hat genau einen Wert je Gruppe. System tags lassen sich nicht umbenennen oder löschen, je Prompt aber umklassifizieren. Ein leerer Wert heißt, die Klassifikation läuft noch. — [Peec Help: What are system tags](https://help.peec.ai/article/what-are-system-tags-and-how-can-i-use-them-qarhqr017mu01f0wtpe413ua)
- [belegt] **Definition weicht von upstreem ab:** Branded = „The prompt mentions your brand or a competitor directly.“ Ein Prompt mit Wettbewerbernamen gilt also auch als branded. — [Peec Docs: Organizing your setup](https://docs.peec.ai/organizing-your-setup)
- [belegt] Changelog 06.07.2026: „Every prompt is now classified automatically: branded vs non-branded“, dazu Intent (informational, transactional, commercial). Beide funktionieren als Filter. Seit demselben Release liefern MCP und Customer API die System tags mit aus. — [Peec Changelog](https://www.peec.ai/changelog)
- [belegt] Changelog 13.10.2026 (Fix): „Branded prompts no longer count toward content optimization demand.“ Das ist ein gezielter Ausschluss branded Prompts in einer einzelnen Funktion. Allgemein werden sie nicht ausgeschlossen. — [Peec Changelog](https://www.peec.ai/changelog)
- [belegt] Bei der Prompt-Discovery stellt der Nutzer den Anteil selbst ein: „Set the share of branded versus unbranded prompts“. Default: „20% branded and a 25/50/25 intent split“. — [Peec Docs: Setting up your prompts](https://docs.peec.ai/setting-up-your-prompts)
- [belegt] Die Visibility-Formel „Visibility Score = (Number of responses mentioning your brand / Total responses) × 100“ gilt „across all your tracked prompts and competitors“. Ob branded Prompts dabei ausgenommen sind, sagt die Seite nicht. — [Peec Docs: Visibility](https://docs.peec.ai/metrics/brand-metrics/visibility)

**Scrunch**
- [belegt] Filter **Branded Query**: „Filters prompts that include your brand name (displays as Branded) or exclude it (displays as Unbranded).“ Dazu: „By default, the Dashboard displays Unbranded prompts only.“ (Artikel vom 05.09.2026) — [Scrunch Help: Understanding Filters](https://helpcenter.scrunchai.com/en/articles/12691756-understanding-filters-in-scrunch)
- [belegt] Home-Tab: „By default, Scrunch filters the Home dashboard by Non-Branded Only prompts, so the count here may be lower than what you see in your Prompts tab.“ (Artikel vom 09.07.2026) — [Scrunch Help: Understanding the Home tab](https://helpcenter.scrunchai.com/en/articles/11971751-understanding-the-home-tab)
- [Snippet] Eine ältere Fassung des Filter-Artikels nannte den Filter **„Brand Mentioned in Prompt“**: „Filters prompts that include your brand name (branded) or exclude it (non-branded).“ — [Scrunch Help: Understanding Filters (Suchsnippet)](https://helpcenter.scrunchai.com/en/articles/12691756-understanding-filters-in-scrunch). Für dieselbe Sache gibt es damit in den Docs **drei Bezeichnungen**: „Brand Mentioned in Prompt“, „Branded Query“ (Branded/Unbranded) und „Non-Branded Only“.
- [belegt] Die Erkennung läuft über den Markennamen samt Varianten. Für Data Studio rät Scrunch zu Tags statt Regex, denn „Each time you add a new brand name variation, you would need to update the regex filter manually“. Der Data-Studio-Connector bildet den branded/non-branded-Filter nicht ab. Workaround ist ein manuelles Tag „non-branded“. (Artikel vom 28.04.2026) — [Scrunch Help: Recreate prompt filters in Data Studio](https://helpcenter.scrunchai.com/en/articles/13431587-how-to-recreate-prompt-filters-in-your-data-studio-dashboard)
- [belegt] Nach dem Anlegen von Prompts kann man Insights an Dashboards pinnen: „(Citations, Non Branded Prompts, Topics)“. Es gibt also eine eigene Dashboard-Kachel für non-branded. (26.08.2026) — [Scrunch Help: How to add prompts](https://helpcenter.scrunchai.com/en/articles/11943981-how-to-add-prompts-in-scrunch)
- [Snippet] G2 beschreibt das Haupt-Dashboard als Ort, an dem Teams die Marke „for non-branded prompts“ verfolgen. — [G2: Scrunch AI](https://www.g2.com/products/scrunch-ai)

**AthenaHQ**
- [belegt] „Branded prompts include your company or product name.“ / „Non-Branded prompts are generic category queries where you want to show up without being named.“ Den Typ setzt der Nutzer beim manuellen Anlegen: „You set the type (Branded or Non-Branded)“. Ändern lässt er sich im Drawer „Edit Prompt“. Eine automatische Erkennung beschreiben die Docs nicht. — [AthenaHQ Docs: Setting up your prompts](https://docs.athenahq.ai/setting-up-prompts)
- [belegt] Im Olympus-FAQ steht: „The AI Search Value card uses a position-weighted, value-weighted share over non-branded commercial topics“ und „The main Share of Voice chart counts every mention equally across all topics, including branded queries.“ Der Default ist also **inklusive**, mit einer einzelnen Ausnahme-Kennzahl. — [AthenaHQ Docs: Olympus Dashboard](https://docs.athenahq.ai/guides/olympus)
- [belegt] Schedules (Enterprise) lassen sich nach „prompt type“ bedingen, ebenso nach prompt tag, topic und country. — [AthenaHQ Docs: Setting up your prompts](https://docs.athenahq.ai/setting-up-prompts)
- [Snippet] Ein Tester stellte fest, dass das automatisch erzeugte Prompt-Set einige branded Prompts enthielt, die den Score „naturally lifted“. — [OrganiKPI: AthenaHQ Review](https://organikpi.com/blog/reviews/athenahq-review/)

**Profound**
- [belegt] Im Prompt Designer gibt es nur freie Tags. Laut Docs ändern sie „which subset of prompts you see when you filter by tag“. Eine eingebaute branded-Kategorie ist nicht dokumentiert. — [Profound Docs: Prompt Designer](https://docs.tryprofound.com/answer-engine-insights/prompt-designer)
- [belegt] Der „Prompt Type“ ist bei Profound **etwas anderes**, nämlich die Analyseart: „A setting on a prompt that controls which analyses Profound runs on its response: Visibility, Sentiment, or FactCheck.“ Weiter: „Every prompt produces visibility data“. — [Profound Docs: Glossary](https://docs.tryprofound.com/getting-started/glossary). In der API ist `prompt_type` (`visibility`, `sentiment`) veraltet und durch `analysis_type` ersetzt. Einen Wert `branded` gibt es nicht. — [Profound API: List prompts](https://docs.tryprofound.com/api-reference/organization/list-prompts)
- [belegt] Blogpost vom 03.06.2026 zum neuen Sentiment-Produkt: „you'll see sentiment trends across a wider range of prompts than before, not just branded ones“. Sentiment lief demnach früher vor allem über branded Prompts. — [Profound Blog: Sentiment product](https://www.tryprofound.com/blog/graduate-from-tracking-ai-s-narrative-to-shaping-it-with-the-new-sentiment-product-in-profound)
- [Snippet, widersprüchlich] Laut Suchzusammenfassung beschrieb ein älteres Glossar (help.tryprofound.com, heute Weiterleitung) Sentiment-Prompts als festes Format „Evaluate [your brand] on [topic]“, immer mit Markenname. Das aktuelle Glossar enthält diesen Satz **nicht**. — [Profound Glossary (alte URL)](https://help.tryprofound.com/articles/9363559589-profound-glossary) bzw. [aktuell](https://docs.tryprofound.com/getting-started/glossary)
- [belegt] Die Anleitung zu guten Prompts erwähnt branded/non-branded gar nicht. Empfohlen werden „existing SEO key phrases“ und eine Mischung der Intents. — [Profound Docs: Create effective prompts](https://docs.tryprofound.com/answer-engine-insights/how-tos/create-effective-prompts)

### Inferences
- [abgeleitet] Bei Scrunch ist das Default-Modell genau das von upstreem: Dashboard non-branded, Prompts-Tab alles. Scrunch zieht die Grenze aber **zwischen Ansichten** (Home bzw. Dashboard gefiltert, Prompts-Tab und offenbar Citations-Tab ungefiltert, siehe unten) und nicht durchgehend über alle Ebenen.
- [abgeleitet] Peec und AthenaHQ behandeln „branded“ als **Attribut zum Segmentieren**, nicht als Ausschluss. Das Problem „Zeile da, Wert 0“ entsteht dort im Default nicht, weil nichts herausgefiltert ist.
- [abgeleitet] Bei Profound gibt es ohne eigenes Tag gar keinen branded-Begriff. Sentiment-Prompts mit Markennamen liefern trotzdem Visibility-Daten („Every prompt produces visibility data“) und gehen damit in die Visibility ein.
- [abgeleitet] Die Peec-Definition (Wettbewerbername zählt als branded) wäre für upstreem zu weit. Prompts wie „X vs. Leeup“ und „X vs. Y“ fielen beide heraus.

### Gaps
- Ob Peecs Dashboards (Visibility, Sources) branded per Default mitzählen, steht nirgends ausdrücklich. Es folgt nur daraus, dass kein Default-Filter dokumentiert ist.
- Wie Scrunch „brand name“ genau abgleicht (Aliase, Schreibweisen wie „Leeup“ und „Lee-Up“), ist nicht dokumentiert.
- AthenaHQ: Ob Discover bzw. Onboarding den Typ automatisch setzt, ist offen. Die Docs nennen einen Filter „Type“ in Discover, ohne Erklärung.
- Profound: Es gibt keine Doku zu branded Prompts. Ob die Profound University das empfiehlt, ließ sich nicht prüfen (Seite gab 404).

---

## Wo und wie ist der Filter oder das Segment sichtbar? Ist der Default je unsichtbar?

### Takeaway
Peec zeigt den Typ als **Spalte** in der Prompt-Tabelle plus Single-Select-Filter oben. AthenaHQ zeigt ihn als **Badge** („Branded / Non-branded“) in der Spalte Tags und als Spalte **„Prompt Type“** an jeder Antwortzeile im URL-Detail. Scrunch dokumentiert den Default-Ausschluss nur im Hilfetext, ergänzt um den Hinweis, dass die Zahl im Home-Tab „lower than … Prompts tab“ sein kann. Ob die App den Default als sichtbaren Chip zeigt, ist nicht belegt. Profound hat keinen solchen Filter.

### Cited Findings
- [belegt] Peec: Branding und Intent Type „appear as columns in your Prompts table“ und lassen sich „using the filters at the top of the page“ filtern. Beide Filter sind Single-Select und mit eigenen Tags und Topics kombinierbar. Beispiel aus der Doku: non-branded plus commercial ergibt Themen mit Potenzial „but no direct brand pull“. — [Peec Help: System tags](https://help.peec.ai/article/what-are-system-tags-and-how-can-i-use-them-qarhqr017mu01f0wtpe413ua), [Peec Docs: Organizing your setup](https://docs.peec.ai/organizing-your-setup)
- [belegt] Peec, 11.09.2026: „your filters persist as you move between pages“. Filter-Presets („save and reuse named filter combinations“) sind im Early Access. — [Peec Changelog](https://www.peec.ai/changelog)
- [belegt] Scrunch: Der Filter heißt „Branded Query“ mit den Anzeigewerten „Branded“ und „Unbranded“. Filter wirken „across charts, tables, and visualizations in Explorer“. Ein Explorer-View erlaubt bis zu 5 Metriken, 3 Breakdowns und 8 Filter. Wie man den Default ändert oder ob ein Chip ihn zeigt, beschreibt der Artikel nicht. — [Scrunch Help: Understanding Filters](https://helpcenter.scrunchai.com/en/articles/12691756-understanding-filters-in-scrunch)
- [belegt] Scrunch Home-Tab: Die Kennzahl **Prompts** ist definiert als „The number of prompts within the applied dashboard filters“. Der Hinweis zum Default lautet: „the count here may be lower than what you see in your Prompts tab“. — [Scrunch Help: Home tab](https://helpcenter.scrunchai.com/en/articles/11971751-understanding-the-home-tab)
- [belegt] AthenaHQ, Seite Prompts: Die Spalte **Tags** zeigt „Prompt type badges (e.g., Branded / Non-branded) and custom tags“. Es gibt die Filterkategorien Date range, Models, Schedule, Competitors, Personas, Locations, Countries, Prompt Tags und Prompt status. Einen eigenen Filter „Prompt type“ nennt die Seite nicht. — [AthenaHQ Docs: Prompts](https://docs.athenahq.ai/guides/prompts)
- [belegt] AthenaHQ, URL Source Analytics: Die Filter-Chips heißen „Date Range“, „Models“, „Competitors“, „Personas“, „Locations“, „Countries“, „Prompts“, „Attributes“ und „Response Search“. Die Filterzeile ist sticky. Ein branded-Chip ist nicht dokumentiert, der Typ erscheint nur als Spalte „Prompt Type“ (Branded oder Non-Branded) im Tab Responses. — [AthenaHQ Docs: URL Source Analytics](https://docs.athenahq.ai/guides/sources-analytics-source_url)
- [belegt] AthenaHQ, Seite Sources: Die Filterleiste umfasst Models, Competitors, Personas, Locations, Countries, Owned domains, Prompt tags, Prompt status, Date range, Source tag und Mentioned status. Branded/Non-branded ist nicht aufgeführt. — [AthenaHQ Docs: Sources](https://docs.athenahq.ai/guides/sources)
- [belegt] AthenaHQ Olympus: Filter bleiben „preserved in the browser URL“, dazu gibt es „Saved Views“. — [AthenaHQ Docs: Olympus](https://docs.athenahq.ai/guides/olympus)
- [belegt] Profound: Die Attributfilter sind „Topics“, „Platforms“, „Tags“, „Regions“, „Competitors“, „Languages“ und gegebenenfalls „Personas“. **Nur im Citations-Tab** kommen „Prompt Type“ und „Citation Categories“ hinzu. Prompt Type meint dort die Analyseart, siehe oben. — [Profound Docs: Interpret AEI](https://docs.tryprofound.com/answer-engine-insights/interpret)

### Inferences
- [abgeleitet] Kein Tool dokumentiert einen **sichtbaren Hinweis auf einen Default-Ausschluss** in der Oberfläche, etwa „Non-branded only“ als gesetzten Chip oder eine Fußnote „branded excluded“. Scrunch erklärt die Abweichung nur im Hilfecenter. Das legt nahe, dass der Default dort im UI zumindest nicht prominent ist. Belegt ist das nicht.
- [abgeleitet] AthenaHQs Muster, den Typ als **Spalte an der Antwortzeile** zu zeigen statt als Filter, macht die Herkunft eines Werts sichtbar, ohne Daten zu verstecken. Das ist ein Gegenentwurf zu upstreems unsichtbarem Default-Filter.
- [abgeleitet] Peecs „filters persist as you move between pages“ heißt: Wer Non-branded einmal setzt, sieht es auf allen Seiten. Die Ebenen bleiben untereinander konsistent, solange der Filter überall gilt.

### Gaps
- Für keines der Tools gibt es öffentliche Screenshots, die zeigen, wie ein aktiver branded-Filter in der Filterleiste aussieht (Chip-Text, Zähler).
- Scrunch: Ob der Default „Non-Branded Only“ im Dashboard als Chip oder Label sichtbar und abwählbar ist, ist nicht dokumentiert.
- Peec: Ob der Branding-Filter neben der Prompts-Seite auch auf den Seiten URLs und Domains angeboten wird, ist nicht ausdrücklich belegt. Der Changelog vom 06.07.2026 sagt nur, beide Tags „work as filters“.

---

## Wie werden Zeilen oder Werte gekennzeichnet, die nur aus einem ausgefilterten Segment stammen oder unter dem Filter 0 sind?

### Takeaway
Ein Muster wie „N hidden by filter“ oder ausgegraute Zeilen für ausgefilterte Segmente dokumentiert keines der vier Tools. Belegt sind nur allgemeine Null- und Leer-Darstellungen: Peec zeigt einen Strich bei nie zitierter Citation position. AthenaHQ zeigt „No data yet“, „(0)“ für leere Topics, graue Plattform-Chips mit Tooltip „No data for current filters“ und lässt Tage ohne Antworten im Chart aus, statt 0 zu zeichnen. Scrunch weist nur im Hilfetext auf niedrigere Zahlen unter dem Default hin.

### Cited Findings
- [belegt] Peec URLs: „Citation position: … Never-cited URLs show a dash.“ — [Peec Docs: URLs](https://docs.peec.ai/urls)
- [belegt] Peec API: „`filters` shrink the denominators behind `retrieval_rate` and `retrieved_percentage`.“ Filter verkleinern also die Grundgesamtheit, statt nur Zeilen auszublenden. — [Peec Docs: Filtering and dimensions](https://docs.peec.ai/api/filtering-and-dimensions)
- [belegt] AthenaHQ Prompts: Metrikspalten zeigen „No data yet“, wenn keine Daten existieren. Mit **Show empty topics** (Default aus) erscheinen leere Topics als Platzhalterzeilen mit „(0)“, sofern keine Text-, Tag- oder Segmentfilter aktiv sind. „An active prompt with zero responses still appears unless another selected filter excludes it.“ — [AthenaHQ Docs: Prompts](https://docs.athenahq.ai/guides/prompts)
- [belegt] AthenaHQ Sources: Social-Plattformen ohne Ergebnis sind ausgegraut, Tooltip „No data for current filters.“ Die Spalte „Source Mentions Brand“ zeigt „No data“, wenn eine Seite nicht bewertet werden konnte. — [AthenaHQ Docs: Sources](https://docs.athenahq.ai/guides/sources)
- [belegt] AthenaHQ URL Source Analytics: Im Chart „Citation rate over time“ werden „Days with zero responses are omitted rather than plotted as 0%“. — [AthenaHQ Docs: URL Source Analytics](https://docs.athenahq.ai/guides/sources-analytics-source_url)
- [belegt] AthenaHQ Olympus: Modelle mit Antworten, aber ohne erwähnte Marke, können mit Share of Voice 0 erscheinen. Laut Docs heißt das nicht, dass Antworten fehlen. — [AthenaHQ Docs: Olympus](https://docs.athenahq.ai/guides/olympus)
- [belegt] Scrunch: „the count here may be lower than what you see in your Prompts tab“. Das ist der einzige dokumentierte Hinweis auf eine durch den Default-Filter verringerte Zahl. — [Scrunch Help: Home tab](https://helpcenter.scrunchai.com/en/articles/11971751-understanding-the-home-tab)
- [belegt] Profound: „Pausing a prompt keeps its past answers in reports. Deleting it removes them from reports and the API until the prompt is restored.“ Tags und Topics werden bei jeder Anfrage aus der aktuellen Konfiguration angewandt. — [Profound Docs: Why past numbers change](https://docs.tryprofound.com/cookbook/metrics/why-past-numbers-change)

### Inferences
- [abgeleitet] Die drei Tools mit Filter (Peec, AthenaHQ, Profound) lassen unter einem Filter Zeilen offenbar ganz **wegfallen**. Peec und AthenaHQ zeigen dann leere Tabellen bzw. Leertexte. Eine Zeile mit 0, die nur wegen eines ausgefilterten Segments existiert, ist nirgends als eigener Fall beschrieben.
- [abgeleitet] AthenaHQs Unterscheidung „No data yet“ (noch nichts erhoben) gegen „No data for current filters“ (gefiltert leer) entspricht der Trennung, die upstreem braucht: „0 unter Filter“ ist etwas anderes als „nie zitiert“.

### Gaps
- Kein Tool dokumentiert ausgegraute Zeilen, einen „hidden by filter“-Zähler oder Tooltips an einer 0, die auf ein ausgefiltertes Segment verweisen.
- Bei Profound sind Leer- und Nullzustände der Dashboards nicht dokumentiert.

---

## Wie funktionieren Citation-, Source- und URL-Tabellen und URL-Detailseiten? Folgen „first seen“ und „last seen“ dem Filter?

### Takeaway
Alle vier Tools haben eine URL- bzw. Page-Ebene mit Drilldown auf die auslösenden Prompts oder Antworten. **Peec** zeigt im URL-Detail „first and last time the URL was seen“. **AthenaHQ** zeigt „First seen“ als Spalte in der Page-Ansicht der Sources. **Profound** hat in „Citation Decay“ erstes und letztes Zitierdatum und in der API `first_cited_at` als Metrik. **Scrunch** dokumentiert keine Datumsfelder. Ob diese Zeitstempel dem Prompt-Filter folgen, schreibt keines der Tools ausdrücklich.

### Cited Findings

**Peec**
- [belegt] URL-Tabelle, Spalten: URL, URL type, URL tags, Domain type, Brand mentioned, Mentions, Retrievals, Retrieved, Cited, Citation position, Citation rate, Total citations, Citation share, Updated. „Updated“ ist die letzte Inhaltsänderung der Seite, nicht das letzte Zitat. Darüber steht der Graph „URL movers“ mit Top/New/Trending/Losing. „New“ listet URLs, die im gewählten Zeitraum zum ersten Mal abgerufen wurden. — [Peec Docs: URLs](https://docs.peec.ai/urls)
- [belegt] URL-Detail: URL und Titel, „URL overview“ mit citation rate, citation position, retrievals, prompts using the page, „first and last time the URL was seen“ mit Änderung zur Vorperiode. Dazu Retrievals-Chart (Default 7 Tage), Retrievals by model, eine Prompts-Tabelle („prompts that triggered the URL and their topics“), Brands mentioned und Chats. — [Peec Docs: URLs](https://docs.peec.ai/urls)
- [belegt] Metriken beziehen sich auf den „selected timeframe“. Retrieved und Cited haben „all chats in that span“ als Nenner. — [Peec Docs: URLs](https://docs.peec.ai/urls); Domains: „Retrieved (Domains) = (Chats with at least one domain URL retrieved / Total chats) × 100“ — [Peec Docs: Domains](https://docs.peec.ai/domains)
- [belegt] Changelog-Fixes: „Fixed the Sources URL brand filter returning rows with no visible brand mentions“ und „Fixed an empty 'Retrievals by model' panel in URL analytics“ (03.08.2026). „Fixed … missing empty states for URLs“ (11.09.2026). — [Peec Changelog](https://www.peec.ai/changelog)

**Scrunch**
- [belegt] Citations-Tab (13.05.2026): Default „Group by Domain“, alternativ „Group by URL“. Kennzahlen: „Influence Score = Citation Consistency (%) × Number of Prompts“ sowie „Presence“ (Yes/No: Marke auf der zitierten Seite, nicht in der Antwort). Filter: Platform, Owner („Owned“, „Competitor“, „Third Party“), Prompt Topic, Citation Topic. Ein branded-Filter ist dort **nicht** aufgeführt. Drilldown: „Prompts the citation was cited for“, Zitierhäufigkeit über die Zeit, Plattform-Statistik. — [Scrunch Help: Citations tab](https://intercom.help/scrunchai/en/articles/11944877-understanding-the-citations-tab-in-scrunch)
- [belegt] Im Explorer gibt es zitatspezifische Filter: „Citation Source Owner“ und „Topic“ bei Citation-Breakdown. — [Scrunch Help: Understanding Filters](https://helpcenter.scrunchai.com/en/articles/12691756-understanding-filters-in-scrunch)

**AthenaHQ**
- [belegt] Sources: Umschalter „Domain“ und „Page“. Spalten der Page-Ansicht: URL, Spark, Type, Citation %, Responses influenced, Impressions captured, Source Mentions Brand, Source Mentions Competitor, **First seen**, Rescan. Eine Spalte „Last seen“ ist nicht dokumentiert. — [AthenaHQ Docs: Sources](https://docs.athenahq.ai/guides/sources)
- [belegt] URL Source Analytics: Breadcrumb „Sources / example.com / …“. Kacheln „Citation rate“, „Citations“ (je Antwort einmal gezählt) und „Platform coverage“. Tab Responses mit Spalten Date, Model, Mentioned, Competitors Mentioned, Sources, Cited, Attributed Citation, Market Position, Sentiment, **Prompt Type**, Prompt, Prompt Variation, Personas, Attributes, Response, Country und Location. „First seen“ für die URL insgesamt ist nicht dokumentiert, nur im YouTube-Untertab Creators. — [AthenaHQ Docs: URL Source Analytics](https://docs.athenahq.ai/guides/sources-analytics-source_url)
- [belegt] Site Health › Site Map (die Seitenabdeckung): Jede Seite trägt eine „AI citation rate“. Es gibt keine Datumsfelder und keine Badges „new“ oder „updated“. Filter sind nur „Filter by section“ und „Search pages“, also weder Datum noch Prompt-Typ. — [AthenaHQ Docs: Site Map](https://docs.athenahq.ai/guides/site-health-site-map)

**Profound**
- [belegt] Citations-Tab: „All Citations“ mit den Ansichten „Domains“, „Pages“ und „Watchlist“. „Citation Decay“ zeigt für Domains und Pages das Datum des ersten und letzten Zitats, die Anstiegsdauer in Tagen, Spitzenanteil, Spitzendatum und die Halbwertszeit in Tagen. Drilldown über „View citations“ und eine „All data“-Ansicht mit „Search urls“. — [Profound Docs: Interpret AEI](https://docs.tryprofound.com/answer-engine-insights/interpret)
- [belegt] Citations-API v2: Metriken `count`, `citation_share`, `rank`, `first_cited_at` („Pages only“). Filter `domain`, `page`, `analysis_type` (visibility, sentiment, factcheck, all), `citation_category` und `citation_tag`. — [Profound API: Citations v2](https://docs.tryprofound.com/rest-api/reports/query-citations-v2)
- [belegt] „Topic, tags, and brand attribution are not stored with the answer.“ Sie werden bei jedem Report aus der aktuellen Konfiguration angewandt. Gespeicherter Antworttext, Citations und Datum bleiben unverändert. — [Profound Docs: Why past numbers change](https://docs.tryprofound.com/cookbook/metrics/why-past-numbers-change)

### Inferences
- [abgeleitet] Bei Profound ist `first_cited_at` eine **Metrik** derselben Abfrage wie `count` und Share. Unter einem Filter (`analysis_type`) dürfte es deshalb dem Filter folgen. Belegt ist das nicht.
- [abgeleitet] Bei Peec beziehen sich alle URL-Metriken auf den gewählten Zeitraum, und Filter verkleinern die Nenner. „New“ in URL movers folgt sicher dem Zeitraum. Ob „first/last seen“ im Detail dem Branding-Filter folgt, bleibt offen. Die Formulierung „with absolute changes“ gegenüber der Vorperiode legt eine zeitraumbezogene Rechnung nahe.
- [abgeleitet] Scrunchs Citations-Tab führt den branded-Filter nicht auf, der Home-Default ist aber „Non-Branded Only“. Damit ist Scrunch das Tool, in dem die Ebenen **wahrscheinlich ähnlich auseinanderlaufen** wie bei upstreem: Eine nur branded zitierte URL zählt im Home-Tab nicht, im Citations-Tab vermutlich schon.

### Gaps
- Kein Tool dokumentiert, ob „first seen“, „last seen“ oder „first cited“ dem Prompt-Filter folgt oder ihn ignoriert. Das ist die zentrale Frage für upstreem, und öffentlich bleibt sie unbeantwortet.
- Scrunch: keine Doku zu Datumsfeldern in Citations.
- Peec: kein Hinweis, ob die Prompts-Tabelle im URL-Detail die Branding-Spalte zeigt.

---

## Wie lauten Leerzustände, wenn ein Filter alles entfernt?

### Takeaway
Nur AthenaHQ dokumentiert Leertexte wörtlich, darunter einen mit Aktion: „No data matches the selected filters“ plus Knopf „Clear Filters“ im Dashboard und „No pages match these filters“ plus „Clear filters“ in der Site Map. Peec hat Leerzustände für URLs erst im September 2026 nachgerüstet, den Wortlaut nennt es nicht. Scrunch und Profound dokumentieren keine Leertexte.

### Cited Findings
- [belegt] AthenaHQ Olympus: Ohne Daten erscheint „No data yet for this website“ bzw. „No results yet for this schedule“ mit Knopf „Stream Data“. Wenn Filter alles ausschließen: „No data matches the selected filters“ mit Knopf „Clear Filters“. — [AthenaHQ Docs: Olympus](https://docs.athenahq.ai/guides/olympus)
- [belegt] AthenaHQ URL Source Analytics: „No citation data available“, „No platform responses in this range.“, „No responses found.“ und „No URL parameters match '[search]'“. — [AthenaHQ Docs: URL Source Analytics](https://docs.athenahq.ai/guides/sources-analytics-source_url)
- [belegt] AthenaHQ Sources: „If no sources match your filters, the table will be empty.“ Graue Chips tragen den Tooltip „No data for current filters.“ — [AthenaHQ Docs: Sources](https://docs.athenahq.ai/guides/sources)
- [belegt] AthenaHQ Site Map: „No pages found yet“ (kein Crawl) gegen „No pages match these filters“ mit „Clear filters“. — [AthenaHQ Docs: Site Map](https://docs.athenahq.ai/guides/site-health-site-map)
- [belegt] Peec, 11.09.2026: „Fixed … missing empty states for URLs“. — [Peec Changelog](https://www.peec.ai/changelog)
- [belegt] Profound: Nach dem Anlegen ist ein anfänglicher Status „No Data“ normal. Metriken „populate after the first full 24–48 hour cycle“. — [Profound Docs: Create topics and prompts](https://docs.tryprofound.com/answer-engine-insights/how-tos/create-topics-and-prompts)

### Inferences
- [abgeleitet] AthenaHQ trennt konsequent „noch nichts da“ („No … yet“) von „durch Filter leer“ („No … match …“ plus „Clear Filters“). Das ist das einzige belegte Vorbild für einen Leerzustand, der den Filter benennt und aufhebbar macht. Es benennt aber nicht, **welcher** Filter es war.

### Gaps
- Bei keinem Tool ist ein Leertext dokumentiert, der den branded-Ausschluss beim Namen nennt, etwa „Only branded prompts cited this URL“.
- Scrunch und Profound: keine Leertexte dokumentiert.

---

## Gibt es Doku- oder Changelog-Einträge zu branded vs. non-branded Visibility, „brand bias“ oder Empfehlungen zur Trennung?

### Takeaway
Scrunch und AthenaHQ empfehlen ausdrücklich, **beide** Typen zu tracken und getrennt zu lesen. Scrunch begründet den Default-Ausschluss mit der Frage, wie oft die Marke empfohlen wird, ohne dass danach gefragt ist. Peec hat seit Juli 2026 die automatische Klassifikation und schließt branded seit Oktober 2026 gezielt aus einer Funktion aus. Profound äußert sich zum Thema nicht. Den Begriff „brand bias“ verwendet keines der Tools in den gefundenen Quellen.

### Cited Findings
- [belegt] Scrunch (20.11.2025): „a strong strategy includes both branded, and non-branded prompts“. Branded zeigt, „how accurately AI describes you when you are directly asked for“, non-branded zeigt, „where AI places you relative to competitors“. — [Scrunch Help: Prompt strategy guide](https://helpcenter.scrunchai.com/en/articles/12872036-scrunch-prompt-strategy-guide)
- [belegt] Scrunch: Der Dashboard-Default „Unbranded prompts only“ soll laut Artikel zeigen, wie oft AI-Plattformen die Marke empfehlen, ohne gefragt zu sein. — [Scrunch Help: Understanding Filters](https://helpcenter.scrunchai.com/en/articles/12691756-understanding-filters-in-scrunch)
- [belegt] AthenaHQ: „You need both.“ / „Branded mention rate reflects direct awareness.“ / „Non-Branded reflects whether you're showing up when buyers haven't decided yet.“ — [AthenaHQ Docs: Setting up your prompts](https://docs.athenahq.ai/setting-up-prompts)
- [belegt] AthenaHQ: AI Search Value rechnet nur über „non-branded commercial topics“, Share of Voice dagegen „including branded queries“. Deshalb kann AI Search Value niedriger ausfallen. — [AthenaHQ Docs: Olympus](https://docs.athenahq.ai/guides/olympus)
- [belegt] Peec: Automatische Klassifikation seit 06.07.2026. „Branded prompts no longer count toward content optimization demand“ (13.10.2026). — [Peec Changelog](https://www.peec.ai/changelog)
- [belegt] Peec: „AI models likely won't mention brands unless you specifically ask for them“. Das bezieht sich auf informationelle Prompts. Commercial prompts „reliably surface brands and are the core of most tracking“. — [Peec Docs: Setting up your prompts](https://docs.peec.ai/setting-up-your-prompts)
- [belegt] Profound: Sentiment deckt seit 03.06.2026 „a wider range of prompts than before, not just branded ones“ ab. Sonst gibt es keine Aussage zu branded. — [Profound Blog](https://www.tryprofound.com/blog/graduate-from-tracking-ai-s-narrative-to-shaping-it-with-the-new-sentiment-product-in-profound)

### Inferences
- [abgeleitet] Der Branchenkonsens: Branded misst Wahrnehmung und Genauigkeit, non-branded misst Sichtbarkeit im Wettbewerb. Kennzahlen zu Sichtbarkeit und Wert rechnen non-branded (Scrunch Dashboard, AthenaHQ AI Search Value, Peec Content Demand). Inventar- und Rohansichten (Prompts-Tab, Sources und Citations, Antwortlisten) zeigen alles.

### Gaps
- Keine Quelle verwendet den Begriff „brand bias“.
- Keine quantitative Aussage der Hersteller dazu, wie stark branded Prompts Visibility oder Citations verzerren.

---

## Übertragung auf den Fall lee-up.de/cedric-leenen (einmal heute zitiert, nur durch einen branded Prompt)

### Takeaway
Nach Doku-Lage würden Peec, AthenaHQ und Profound die URL im Default auf **allen** Ebenen normal zeigen (1 Zitat, heute), weil sie branded nicht ausschließen. AthenaHQ macht dabei an der Antwortzeile sichtbar, dass der Prompt „Branded“ war. Nur Scrunch schließt per Default aus, und zwar nur im Home-Dashboard. Dort fehlte das Zitat, im Citations-Tab erschiene es vermutlich. Das entspricht upstreems Inkonsistenz zwischen den Ebenen, mit dem Unterschied, dass Scrunch die Abweichung im Hilfetext erklärt.

### Cited Findings
- (Belege siehe die Abschnitte oben. Diese Übertragung ist durchgehend **[abgeleitet]**.)

### Inferences

Die vier Ebenen von upstreem: (1) Tabelle „Cited URLs“ im Tracking, (2) URL-Detail, (3) Sitemap/Seitenabdeckung, (4) Domainseite › URLs.

**Peec AI** (Default: kein Branding-Filter; der Prompt ist automatisch „Branded“, weil er die eigene Marke nennt)
- Ebenen 1 und 4 (URLs-Tabelle): Die Zeile erscheint mit Retrievals 1, Total citations 1 und Citation share > 0, in „URL movers › New“ als neu im Zeitraum. Grundlage: [Peec URLs](https://docs.peec.ai/urls).
- Ebene 2 (URL-Detail): Dort stünde „first and last time the URL was seen“ = heute, die Prompts-Tabelle enthielte den branded Prompt und die Chats-Liste den Chat.
- Ebene 3: Eine Ansicht zur Seitenabdeckung bzw. Sitemap ist bei Peec nicht dokumentiert.
- Setzt der Nutzer „Non-branded“ und gilt der Filter auch für URLs (persistiert seit 09/2026 über Seiten): Die URL fiele vermutlich aus der Tabelle, weil Filter die Nenner verkleinern. Das Detail ist unklar. Der Filter wäre oben in der Filterleiste sichtbar, weil der Nutzer ihn selbst gesetzt hat.

**Scrunch** (Default: Home bzw. Dashboard „Non-Branded Only“; der Filter heißt „Branded Query“ mit Branded/Unbranded)
- Home-Dashboard: Das Zitat zählt nicht. Die Prompt-Zahl liegt unter der im Prompts-Tab, wie im Hilfetext angekündigt.
- Ebenen 1 und 4 (Citations-Tab, „Group by URL“ bzw. „Group by Domain“): Für den Citations-Tab ist kein branded-Filter dokumentiert. Die URL erschiene dann vermutlich mit Number of Prompts 1 und einer Influence Score > 0.
- Ebene 2 (Drilldown): „Prompts the citation was cited for“ enthielte den branded Prompt. Ob der als branded gekennzeichnet ist, ist nicht dokumentiert.
- Ebene 3: Eine Ansicht zur Seitenabdeckung ist nicht dokumentiert.
- Explorer mit „Branded Query = Unbranded“: Die URL verschwände aus dem Citation-Breakdown, mit dem Filter als einem von höchstens 8 gesetzten Filtern.

**AthenaHQ** (Default: alles inklusive; der Typ wird beim Anlegen manuell gesetzt, hier „Branded“)
- Ebenen 1 und 4 (Sources › Page bzw. Domain): Die Zeile erschiene mit Citation % > 0, Responses influenced 1 und **First seen** = heute. Grundlage: [AthenaHQ Sources](https://docs.athenahq.ai/guides/sources).
- Ebene 2 (URL Source Analytics): Kacheln „Citations“ 1 und Citation rate > 0. Der Tab Responses hätte eine Zeile mit **Prompt Type = Branded**. Das ist das klarste belegte Muster, die branded Herkunft sichtbar zu machen, ohne zu filtern.
- Ebene 3 (Site Health › Site Map): Die „AI citation rate“ der Seite wäre > 0. Ein Badge „new“ gibt es nicht, ebenso wenig einen Typ-Filter. Grundlage: [AthenaHQ Site Map](https://docs.athenahq.ai/guides/site-health-site-map).
- Olympus: Share of Voice zählt das Zitat mit, AI Search Value nicht, weil diese Kennzahl nur non-branded commercial rechnet. Die Abweichung ist nur im FAQ erklärt.

**Profound** (Default: keine branded-Klassifikation; ohne eigenes Tag ist der Prompt einfach ein Prompt)
- Ebenen 1 und 4 (Citations › All Citations › Pages bzw. Domains): Die URL erschiene mit count 1 und Citation Share > 0. In Citation Decay wären erstes und letztes Zitat heute. Grundlage: [Profound Interpret AEI](https://docs.tryprofound.com/answer-engine-insights/interpret).
- Ebene 2 („View citations“ bzw. „All data“): Die zugrunde liegende Antwort wäre sichtbar.
- Ebene 3: Eine Ansicht zur Seitenabdeckung im Sinn von upstreem ist nicht dokumentiert.
- Hat der Nutzer ein eigenes Tag „branded“ und filtert es weg: Die URL fiele aus allen Citation-Ansichten. Weil Tags rückwirkend aus der aktuellen Konfiguration gelten, gälte das auch für vergangene Tage. `first_cited_at` folgte vermutlich dem Filter.

**Muster über alle vier**
- Kein Tool zeigt, soweit dokumentiert, eine Zeile mit „0 unter Filter“ zusammen mit einem ungefilterten Datum. Entweder ist die Zeile ganz da (kein Filter) oder ganz weg (Filter gesetzt).
- Wer einen Default-Ausschluss hat (Scrunch, AthenaHQ für eine Kennzahl), erklärt ihn **im Hilfetext**, nicht in der Oberfläche.
- Das sichtbarste Muster ist AthenaHQs Spalte „Prompt Type“ an jeder Antwortzeile plus die Badges „Branded / Non-branded“ in der Prompt-Liste. Danach folgt Peecs Spalte „Branding“ in der Prompt-Tabelle mit Single-Select-Filter.

### Gaps
- Alle Aussagen dieses Abschnitts sind abgeleitet. Ohne Zugang zu den Apps ließ sich keine davon an der Oberfläche prüfen.
- Am wichtigsten bleibt offen, ob Datumsfelder (Peecs first/last seen, AthenaHQs First seen, Profounds first cited) unter einem Prompt-Filter neu berechnet werden. Das ist nirgends dokumentiert.
