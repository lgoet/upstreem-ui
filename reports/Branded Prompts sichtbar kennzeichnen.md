# Branded-Ausschluss: gleich rechnen, sichtbar benennen, selten erklären

Der Fall lee-up.de/cedric-leenen ist kein Datenfehler. Es ist ein Mischzustand, den keines der untersuchten Werkzeuge kennt: Ob die Zeile erscheint und welches Datum sie trägt, wird ohne den Branded-Filter berechnet, ihre Zählung dagegen mit ihm, und den Filter nennt die Oberfläche nirgends. Von den AI-Visibility-Tools schließt nur **Scrunch** Branded-Prompts standardmäßig aus, und zwar im Home-Dashboard. Die Abweichung erklärt Scrunch nur im Hilfecenter. **Semrush Brand Performance** schreibt den Ausschluss in die Beschreibung der Kennzahl. Alle anderen zählen standardmäßig alles mit (Peec, AthenaHQ, Profound, Ahrefs, Otterly, Rankscale, Google Search Console, Semrush Organic, Similarweb). Gefiltert wird dort nur auf Wunsch, dann aber auf allen Ebenen gleich und sichtbar in der Filterleiste. Aus den belegten Mustern folgen drei Regeln für upstreem:

1. Jeder Wert einer Fläche wird im selben Umfang gerechnet. Das gilt auch für jedes Datum und für die Frage, ob eine Zeile überhaupt erscheint (Sentry: First und Last seen folgen der gewählten Umgebung).
2. Der Standard steht als benannter Chip in der Leiste, wie Vercels „Production“ oder GA4s „All users“. Er versteckt sich nicht als „Off“ in einem geschlossenen Menü.
3. Der ausgeschlossene Teil wird nur sichtbar, wo der Filter eine Ja/Nein-Antwort umkippt (zitiert oder nicht, leer oder nicht). An gewöhnlichen Zahlen erscheint kein Hinweis.

Für den Fall heißt das: Die URL fehlt in „Cited URLs“, wie schon auf der Domainseite. Die Sitemap markiert die Seite als „Branded only“. Das URL-Detail zeigt „Not cited yet“ mit einem Hovercard für „All prompts“ und eine leise Note mit „Show Branded Runs“. An der Rechnung ändert sich nichts. Drei RPCs müssen den Filter künftig vollständig anwenden, und vier Bausteine gehören nach core.

Lesart: Was belegt ist, trägt eine Quelle. Was daraus übertragen ist, steht als „abgeleitet“ da. Alle Aussagen darüber, wie ein Tool den konkreten Fall zeigen würde, sind abgeleitet: Ohne Anmeldung ließ sich keine Oberfläche prüfen.

## Teil 1: Nur Scrunch blendet Branded standardmäßig aus, und es sagt das nur im Hilfecenter

### AI-Visibility-Tools behandeln Branded als Segment, nicht als Ausschluss

Von den neun untersuchten AI-Visibility-Tools schließt nur **Scrunch** Branded-Prompts per Voreinstellung aus. Der Filter heißt dort „Branded Query“ mit den Werten „Branded“ und „Unbranded“. Laut Hilfeartikel vom 05.09.2026 zeigt das Dashboard von Haus aus nur Unbranded ([Scrunch Help: Filters](https://helpcenter.scrunchai.com/en/articles/12691756-understanding-filters-in-scrunch)). Dass die Prompt-Zahl im Home-Tab deshalb niedriger sein kann als im Prompts-Tab, steht nur im Hilfetext zum Home-Tab ([Scrunch Help: Home tab](https://helpcenter.scrunchai.com/en/articles/11971751-understanding-the-home-tab)). Ob die App den Standard als Chip zeigt, ist nicht dokumentiert. Der Citations-Tab bietet die Filter Platform, Owner, Prompt Topic und Citation Topic, aber keinen Branded-Filter ([Scrunch Help: Citations tab](https://intercom.help/scrunchai/en/articles/11944877-understanding-the-citations-tab-in-scrunch)). Daraus folgt (abgeleitet): Eine nur branded zitierte URL erscheint dort, fehlt aber im Home-Dashboard. Das ist genau upstreems Auseinanderlaufen der Ebenen. Für dieselbe Sache hat Scrunch zudem drei Namen: „Brand Mentioned in Prompt“ (nur als Suchauszug gesehen), „Branded Query“ und „Non-Branded Only“. Das ist ein Warnbeispiel für die Benennung.

**Semrush Brand Performance** weist denselben Fall wie upstreem als einziges Tool offen aus. Die Sentiment-Werte unter Perception und die Liste Top Cited Domains rechnen laut Berichtsbeschreibung nur über non-branded Fragen. Über der Tabelle Breakdown by Question stehen vier Preset-Karten: „Answers Non-branded“, „Answers Branded“, „Citations Non-branded“ und „Citations Branded“ ([Semrush KB 1595](https://www.semrush.com/kb/1595-brand-performance-reports)). Der Ausschluss steht also im Text der Kennzahl, und die ausgeschlossene Menge ist einen Klick entfernt. Semrushs Prompt Tracking kennt dagegen keine Klassifikation, nur Tags und „+Add filter“ ([Semrush KB 1503](https://www.semrush.com/kb/1503-prompt-tracking)).

**AthenaHQ** und **Peec** zählen standardmäßig alles mit. Bei AthenaHQ setzt man den Typ beim Anlegen des Prompts. Nur eine Kennzahl, AI Search Value, rechnet über non-branded commercial topics, Share of Voice schließt Branded ein. Erklärt ist das im FAQ des Dashboards ([AthenaHQ Docs: Olympus](https://docs.athenahq.ai/guides/olympus), [AthenaHQ Docs: Setting up prompts](https://docs.athenahq.ai/setting-up-prompts)). Peec klassifiziert seit dem 06.07.2026 jeden Prompt automatisch über ein System-Tag „Branded“ oder „Non-branded“, mit **derselben Definition wie upstreem**: Branded ist, was die eigene Marke oder einen Wettbewerber nennt ([Peec Docs: Organizing your setup](https://docs.peec.ai/organizing-your-setup), [Peec Changelog](https://www.peec.ai/changelog)). Der Typ steht als Spalte in der Prompt-Tabelle, gefiltert wird über eine Einfachauswahl oben ([Peec Help: System tags](https://help.peec.ai/article/what-are-system-tags-and-how-can-i-use-them-qarhqr017mu01f0wtpe413ua)). Seit dem 11.09.2026 bleiben Filter beim Seitenwechsel stehen. Seit dem 13.10.2026 zählen Branded-Prompts nicht mehr zur Content-Optimization-Nachfrage, überall sonst aber mit ([Peec Changelog](https://www.peec.ai/changelog)).

Bei den übrigen Tools sieht es so aus:

- **Profound** hat keinen Branded-Begriff. „Prompt Type“ meint dort die Analyseart, und Tags wirken rückwirkend auf alte Antworten ([Profound Glossary](https://docs.tryprofound.com/getting-started/glossary), [Profound: Why past numbers change](https://docs.tryprofound.com/cookbook/metrics/why-past-numbers-change)).
- **Ahrefs Brand Radar** hat keinen Schalter. Die Trennung baut man über Bedingungen wie „Query contains“ oder „does not contain“ mit dem Markennamen ([Ahrefs Blog: Brand Radar use cases](https://ahrefs.com/de/blog/brand-radar-use-cases/)). Laut einem parteiischen Vergleich von Peec ist Branded im Datensatz standardmäßig enthalten ([Peec vs Ahrefs Brand Radar](https://peec.ai/comparison/peec-ai-vs-ahrefs-brand-radar)).
- **Otterly** hat kein eigenes Feld. Es zeigt aber die Empfehlung „Branded Prompts“, sobald irgendein Branded-Prompt existiert ([Otterly Help: AI Recommendations](https://help.otterly.ai/ai-recommendations)).
- **Rankscale** verlangt je Prompt ein Pflicht-Tag branded oder non-branded und zeigt den Standard der Filterleiste als sichtbaren Wert „All Tags“ ([Rankscale Academy](https://rankscale.ai/resources/modules/setting-up-prompt-groups/branded-vs-non-branded), [Rankscale Help: Brand Dashboard](https://help.rankscale.ai/articles/3577670426)).
- **Adobe Brand Visibility** (Semrush Enterprise AIO) führt Branded nur als Gesundheitskachel „Branded / Unbranded“ in der Prompt-Verwaltung ([Adobe: Prompt Management](https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/prompt-management)).
- Zu **Goodie** gibt es keine öffentliche Dokumentation ([Goodie: Visibility Monitoring](https://higoodie.com/features/ai-visibility-monitoring/)).

### Herkunft, Zeitstempel und Leerzustände: wenig dokumentiert, aber eindeutig

Die Herkunft eines Werts macht **AthenaHQ** am deutlichsten sichtbar: mit Badges „Branded / Non-branded“ in der Prompt-Liste und einer Spalte „Prompt Type“ an jeder Antwortzeile der URL-Analyse ([AthenaHQ Docs: Prompts](https://docs.athenahq.ai/guides/prompts), [AthenaHQ Docs: URL Source Analytics](https://docs.athenahq.ai/guides/sources-analytics-source_url)). Ein Muster wie „N hidden by filter“ oder ausgegraute Zeilen für ein ausgefiltertes Segment dokumentiert keines der neun Tools. Am nächsten kommt **Ahrefs**. Es zeigt zwei Zählungen nebeneinander, „Cited in“ und „Found in“ ([Ahrefs: New features Apr 2026](https://ahrefs.com/blog/new-features-apr-2026/)). Null-Zeilen liefert seine API nur für ausdrücklich beobachtete URLs (`tracked_urls`) ([Ahrefs API: Cited pages](https://docs.ahrefs.com/api/reference/brand-radar/post-cited-pages)). Rankscale schreibt dazu einen Satz, der als Prinzip taugt: Ein fehlendes Vergleichs-Badge heißt nicht, dass der Wert im Durchschnitt liegt ([Rankscale Help: Brand Dashboard](https://help.rankscale.ai/articles/3577670426)).

Datumsfelder an zitierten URLs führen nur drei Tools:

- **Peec** zeigt im URL-Detail, wann die URL zuerst und zuletzt gesehen wurde ([Peec Docs: URLs](https://docs.peec.ai/urls)).
- **AthenaHQ** hat eine Spalte „First seen“ in der Seitenansicht der Sources ([AthenaHQ Docs: Sources](https://docs.athenahq.ai/guides/sources)).
- **Profound** zeigt in Citation Decay das erste und letzte Zitierdatum. In der API ist `first_cited_at` eine Metrik derselben Abfrage wie `count` ([Profound Docs: Interpret](https://docs.tryprofound.com/answer-engine-insights/interpret), [Profound API: Citations v2](https://docs.tryprofound.com/rest-api/reports/query-citations-v2)).

**Ob diese Daten einem Prompt-Filter folgen, schreibt keines der drei.** Ahrefs, Otterly, Rankscale, Semrush und Adobes URL Inspector zeigen nur Zählungen im gewählten Zeitraum ([Otterly API: List citations](https://docs.otterly.ai/api-reference/brand-reports/list-citations-for-a-brand-report.md), [Adobe: URL Inspector](https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/url-inspector)). Bei ihnen kann ein ungefiltertes Datum neben einer gefilterten Zahl gar nicht entstehen.

Leerzustände dokumentiert nur AthenaHQ im Wortlaut, und es trennt sauber zwei Fälle. Ist noch nichts erhoben, heißt es „No data yet for this website“. Ist die Ansicht durch Filter leer, heißt es „No data matches the selected filters“, mit dem Knopf „Clear Filters“ ([AthenaHQ Docs: Olympus](https://docs.athenahq.ai/guides/olympus)). In der Site Map lautet das Paar „No pages found yet“ und „No pages match these filters“ mit „Clear filters“ ([AthenaHQ Docs: Site Map](https://docs.athenahq.ai/guides/site-health-site-map)). Ausgegraute Plattform-Chips tragen den Tooltip „No data for current filters“. Tage ohne Antworten lässt der Chart aus, statt 0 zu zeichnen ([AthenaHQ Docs: Sources](https://docs.athenahq.ai/guides/sources), [AthenaHQ Docs: URL Source Analytics](https://docs.athenahq.ai/guides/sources-analytics-source_url)). Peec zeigt bei nie zitierten URLs einen Strich und hat Leerzustände für URLs erst im September 2026 nachgerüstet ([Peec Docs: URLs](https://docs.peec.ai/urls), [Peec Changelog](https://www.peec.ai/changelog)). **Einen Leertext, der den Branded-Ausschluss beim Namen nennt, gibt es bei keinem Tool.**

## Klassische SEO-Tools trennen, um beide Mengen zu zeigen, nicht um eine zu verstecken

**Google Search Console** hat seit dem 20.11.2025 einen KI-gestützten Query-Filter „Branded“ und „Non-branded“, seit dem 11.03.2026 für alle berechtigten Properties. Google räumt ein, dass die Zuordnung gelegentlich irrt. Eine Voreinstellung gibt es nicht: Man wählt den Filter in der Leiste. Dann gilt er für Chart, Queries- und Pages-Tab gemeinsam, und eine Insights-Karte stellt die Klicks beider Mengen nebeneinander ([Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter?hl=en), [Search Console Help 17010961](https://support.google.com/webmasters/answer/17010961?hl=en)). GSC zeigt auch, was passiert, wenn eine Lücke nur in der Doku erklärt ist. Unter einem Query-Filter fallen anonymisierte Anfragen aus den Summen, sodass Branded plus Non-branded weniger ergibt als die Gesamtsumme. Das steht in Blog und Hilfe ([Search Central Blog 2022](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive), [Search Console Help 17010575](https://support.google.com/webmasters/answer/17010575)). Nutzer melden genau diese Lücke trotzdem als Fehler ([Google Developer forums](https://discuss.google.dev/t/filters-on-gsc-query-dont-add-back-up-to-total-i-e-branded-and-non-branded-queries-dont-add/291116), nur Titel gelesen). Eigene Markenbegriffe lassen sich nicht pflegen ([Search Engine Journal](https://www.searchenginejournal.com/google-answers-questions-about-search-consoles-branded-queries-filter/569549/)).

**Semrush** klassifiziert in Organic Research automatisch über das Feld „Keyword type“. Es hat drei Werte: „Branded“, „Non-branded“ und „Branded for other domains“. Der dritte Wert ist eine eigene Klasse für fremde Marken ([Semrush KB 819](https://www.semrush.com/kb/819-branded-vs-non-branded-keywords)). Die Overview zeigt branded und non-branded traffic als zwei Zahlen nebeneinander ([Semrush KB 890](https://www.semrush.com/kb/890-Organic-Research-Overview)). **Ahrefs** führt „Branded“ nur als Suchintent-Attribut ([Ahrefs Help](https://help.ahrefs.com/en/articles/9973393-how-to-filter-keywords-based-on-search-intent-and-other-useful-attributes)). **Similarweb** macht den Anteil zur Kennzahl („Branded Traffic“) und schreibt den Filter in den Titel einer fest gefilterten Sicht („Top Non-Branded Keywords“). Die Statuswerte „New“ und „Lost“ bildet es je Zeile aus den gefilterten Monaten ([Similarweb: Search Overview](https://support.similarweb.com/hc/en-us/articles/26006669611293-Search-Overview), [Similarweb: Website Keywords](https://support.similarweb.com/hc/en-us/articles/360010972657-Using-Website-Keywords)). **Conductor**, **seoClarity** und **BrightEdge** lassen den Kunden Branded- und Unbranded-Gruppen selbst über Regeln anlegen. Gewählt wird die Gruppe bewusst je Bericht ([Conductor Docs](https://www.conductor.com/docs/intelligence/keyword-group-faqs/), [seoClarity KB](https://kb.seoclarity.net/portal/en/kb/articles/setting-up-keyword-intent-types), [BrightEdge Blog](https://www.brightedge.com/blog/how-to-monitor-branded-keywords-in-brightedge-in-5-simple-steps)).

Der nächste Nachbar in derselben Domäne ist **Microsoft Clarity**. Seit August 2026 trennt es KI-Zitate nach Marke: Jede Query trägt ein Label „branded“, und es gibt eigene Karten „Branded SoA“ und „Non-branded SoA“. Seit dem 29.09.2026 sind die Markenbegriffe editierbar. Das ist nur über Sekundärquellen belegt, der Originalblog war nicht erreichbar ([TechWyse](https://www.techwyse.com/news/platform-updates/microsoft-clarity-branded-non-branded-ai-citations-dashboard), [Relevant Audience](https://www.relevantaudience.com/geo/microsoft-clarity-custom-brand-terms-ai-visibility/)).

Über alle SEO-Tools gilt: **Non-branded ist nirgends Voreinstellung, unter einem Filter bleibt keine Zeile mit 0 stehen, und kein Datum aus ungefilterten Daten steht neben gefilterten Kennzahlen.** Der Mischzustand aus upstreem hat dort kein Vorbild.

## Sentry, Vercel, PostHog und Geist liefern das Vokabular für einen Standardumfang

Weil die Branche Branded kaum standardmäßig ausschließt, kommen die tragfähigsten Muster aus Produkten mit einem anderen Standardumfang: Umgebung, Testnutzer, Stichprobe.

**Sentry** löst genau den Widerspruch „Last seen today, aber 0 Läufe“. First und Last seen in der Seitenleiste hängen an der gewählten Umgebung. Die Zählungen dort weichen ausdrücklich von den Gesamtzahlen im Kopf ab, und die Doku sagt das ([Sentry Docs: Issue Details](https://docs.sentry.io/product/issues/issue-details/)). Im Quelltext zeigt das Hovercard zu First und Last seen immer eine Zeile „Any Environment“. Darunter steht die gewählte Umgebung mit ihrem Zeitpunkt oder „N/A“. Fehlt der Wert im Umfang, lautet der Text „N/A for %s“ ([Sentry seenInfo.tsx](https://raw.githubusercontent.com/getsentry/sentry/master/static/app/components/group/seenInfo.tsx)). In der Issue-Liste heißen die Zählungen „Matching filters“, „Total in %s“ und „Since issue began“. Die gefilterte Zahl ist die Hauptzahl, die Gesamtzahl steht kleiner daneben ([Sentry group.tsx](https://raw.githubusercontent.com/getsentry/sentry/master/static/app/components/stream/group.tsx)). Seit 2016 wählt Sentry standardmäßig die produktionsnächste Umgebung vor, und First und Last seen folgen ihr ([Sentry Blog](https://blog.sentry.io/environment-details)).

**Vercel** zeigt den Standardumfang als Wähler oben rechts: „Production“ ist vorgewählt, daneben „Preview“ und „All Environments“ ([Vercel Docs: Web Analytics](https://vercel.com/docs/analytics/using-web-analytics)). **PostHog** kommt einem vom Hersteller gesetzten Ausschluss am nächsten. An jedem Insight steht ein benannter Schalter „Filter out internal and test users“, und in den Projekteinstellungen gibt es „Enable this filter on all new insights“ ([PostHog Docs](https://posthog.com/docs/data/test-accounts)). **GA4** sammelt alle Vorbehalte in einem Symbol neben dem Berichtstitel, mit einem Satz je Vorbehalt ([GA4: Data quality](https://support.google.com/analytics/answer/12856703?hl=en)). Auch der ungefilterte Normalzustand trägt einen Namen, den Vergleich „All users“ ([GA4: Comparisons](https://support.google.com/analytics/answer/9269518?hl=en)). Vor der Zeile „(other)“ warnt GA4 auch dann, wenn ein Filter die Zeile gerade ausblendet ([GA4: (other) row](https://support.google.com/analytics/answer/13331684)). GA4 trennt außerdem endgültige, unsichtbare Datenfilter von sichtbaren Berichtsfiltern ([GA4: Data filters](https://support.google.com/analytics/answer/10108813?hl=en)). Hier liegt der Kern des upstreem-Problems (abgeleitet): **Der Branded-Ausschluss tritt auf wie ein Datenfilter, unsichtbar, ist aber ein Berichtsfilter.** Die Daten sind da, und die Sitemap zeigt sie. **Linear** blendet Triage-Issues standardmäßig aus und holt sie über einen benannten Schalter „Show triage issues“ zurück. Es trennt Filter, die die Liste verkleinern, von Display options, die Daten ein- oder ausblenden ([Linear Docs: Display options](https://linear.app/docs/display-options)).

**Geist** liefert die beiden Bausteine. Der Leerzustand für eine gefilterte Liste ohne Zeilen hat ein festes Satzmuster („No {Items} Match Your Filters“) und schlägt vor, den Filter zu erweitern oder zu leeren ([Geist: Empty State](https://vercel.com/geist/empty-state)). Die **Note** ist ein bleibender Hinweis ohne Schließen-Knopf, eine Note je Thema, ein aktiver Satz und höchstens eine Aktion ([Geist: Note](https://vercel.com/geist/note)). **Carbon** verlangt, dass aktive Filter auch bei geschlossenem Filtermenü sichtbar sind, samt Zurücksetzen ohne erneutes Öffnen. Das Zurücksetzen führt auf den Startzustand, nicht auf „nichts“ ([Carbon: Filtering](https://carbondesignsystem.com/patterns/filtering/)). Die Forschung stützt das:

- **Baymard:** 28 % der Shops zeigen keine Übersicht der angewandten Filter. Wer auch nur einen aktiven Filter übersieht, deutet die Ergebnismenge falsch, und eine bloße Filteranzahl schnitt im Test schlecht ab ([Baymard](https://baymard.com/blog/how-to-design-applied-filters)).
- **NN/g:** Leere gefilterte Ansichten lösen genau die Fragen aus, ob ein Fehler passiert ist, ob noch geladen wird oder ob der Filter falsch sitzt ([NN/g: Empty states](https://www.nngroup.com/articles/empty-state-interface-design/)). Der Product Owner hat sie im Fall cedric-leenen gestellt.

| Tool | Standard | Filter sichtbar | Herkunft an Zeile oder Wert | Datum an der URL | gefilterter Leerzustand |
|---|---|---|---|---|---|
| Scrunch | Dashboard nur Unbranded, Citations-Tab ohne Branded-Filter | nur im Hilfetext belegt | nicht dokumentiert | nicht dokumentiert | nicht dokumentiert |
| Semrush Brand Performance | einzelne Kennzahlen fest non-branded | im Beschreibungstext, Preset-Karten | Karten „Citations Branded / Non-branded“ | keins | nicht dokumentiert |
| AthenaHQ | alles, nur AI Search Value non-branded | im FAQ | Badge, Spalte „Prompt Type“ | „First seen“ | „No data matches the selected filters“, „Clear Filters“ |
| Peec | alles | Spalte und Einfachauswahl oben | Spalte „Branding“ | first und last seen im Detail | Strich bei nie zitiert |
| Profound | kein Branded-Begriff | nur eigene Tags | – | erstes und letztes Zitat | nicht dokumentiert |
| Ahrefs Brand Radar | alles | Bedingung in der Filterleiste | „Cited in“ und „Found in“ | keins | nicht dokumentiert |
| Otterly, Rankscale | alles | Tag-Filter, „All Tags“ als Standardwert | – | keins | nicht dokumentiert |
| GSC, Semrush Organic, Similarweb | alles | Filter in Leiste oder Tabelle, Titel „Top Non-Branded Keywords“ | beide Mengen als Paar (Karte, KPI) | keins (Similarweb: „New“ je Zeile, gefiltert) | nicht belegt |
| Sentry | produktionsnächste Umgebung | Umgebungswähler | „Matching filters“, „Total in …“ | First und Last seen im Umfang, Hovercard „Any Environment“ | – |
| Vercel, PostHog, GA4 | „Production“, Ausschluss an, „All users“ | Wähler, Schalter, Chip | – | – | – |

## Teil 2: drei Regeln und sechs Ebenen für den Fall cedric-leenen

### Die dritte Regel trennt den nötigen Hinweis vom Lärm

Alle belegten Vorbilder halten zwei Regeln ein, die upstreem heute verletzt.

**Regel 1: Jeder Wert einer Fläche ist im selben Umfang gerechnet, auch Datumsangaben und die Frage, ob eine Zeile überhaupt erscheint.** GSC wendet einen Query-Filter auf alle Tabs gemeinsam an ([Search Console Help 17010961](https://support.google.com/webmasters/answer/17010961?hl=en)). Otterly reicht denselben `tagId` an Liste und Verlauf einer URL ([Otterly API: Citation history](https://docs.otterly.ai/api-reference/brand-reports/get-citation-history-for-a-cited-url.md)). Sentry lässt First und Last seen der gewählten Umgebung folgen ([Sentry Docs](https://docs.sentry.io/product/issues/issue-details/)). In upstreem verletzen drei Flächen diese Regel:

- „Cited URLs“: Zeile und „First cited“ ohne Filter, die Zählung mit.
- das URL-Detail: „Last seen“ ohne Filter.
- die Sitemap: gar kein Filter.

Nur die Domainseite hält die Regel ein.

**Regel 2: Der Standardumfang hat einen sichtbaren Namen am Ort der Daten** (Vercel, GA4, PostHog, Carbon, siehe oben). In upstreem steht der Standard nur als Wert „Off“ in der Zeile „Branded“ des geschlossenen Filtermenüs (`filters/filter-bar.js`, `leer: "Off"`). Außerdem zählt `seitenFilterAktiv` in `core.js` den Wert `"non_branded"` ausdrücklich nicht als Filter. Gefilterte Leerzustände erscheinen deshalb als Ruhezustände. „Off“ ist zudem doppeldeutig (abgeleitet): Es lässt sich als „Branded-Filter aus, also alles drin“ lesen und meint das Gegenteil.

**Regel 3 (abgeleitet): Der ausgeschlossene Teil wird nur dort sichtbar, wo der Filter eine Ja/Nein-Antwort umkippt. Wo er eine Zahl nur verkleinert, bleibt es beim Chip.** Mit „Ja/Nein-Antwort“ sind zwei Fragen gemeint: zitiert oder nicht zitiert, leer oder nicht leer. Die Regel stützt sich auf vier Belege:

- Sentry stellt den zweiten Umfang in ein Hovercard, nicht an den Wert.
- AthenaHQ trennt „noch nichts“ von „durch Filter leer“.
- GA4 warnt vor einer ausgeblendeten Zeile auch dann, wenn sie unsichtbar ist.
- Scrunch und GSC erklären reine Größenunterschiede nur in der Hilfe. Das GSC-Forum zeigt, dass so etwas ohne sichtbaren Filter als Fehler gelesen wird. Mit einem sichtbaren Chip ist dieser Grund behoben.

Die Regel deckt sich mit der Vorgabe des Product Owners, keine Hinweise an jede Zahl zu hängen. „0 zitiert“ und „nur von Branded zitiert“ sind verschiedene Tatsachen. „5 statt 7“ ist dagegen nur eine Frage des Umfangs, und die beantwortet der Chip.

### Leiste: der Standard heißt „Non-branded prompts“ statt „Off“

Heute ist der Standard in keiner Ansicht zu sehen. Die Vorbilder würden ihn so zeigen (abgeleitet aus den Belegen oben): Vercel als vorgewählten Wert im Wähler, GA4 als Chip „All users“, PostHog als Schalter mit Namen, Rankscale als Wert „All Tags“ in der Leiste. Carbon verlangt den Hinweis im geschlossenen Zustand, Baymard den Namen statt einer Zahl. Empfehlung: Der Chip steht immer in der Leiste, auch wenn niemand das Filtermenü öffnet. Er benennt den Umfang positiv, wie Sentry („Any Environment“) und Vercel („All Environments“).

| Element | Text (EN) | Vorbild |
|---|---|---|
| Chip in der Leiste, Standard | „Non-branded prompts“ (Zeichen `bubbleChatUser`, kein X) | Vercel „Production“, GA4 „All users“, Carbon |
| Tooltip bzw. Erklärkarte am Chip | die vorhandene Karte `branded`: „The prompt names your brand or a tracked competitor. Branded prompts are left out of the metrics, because they say little about how visible you are on open questions. Detected automatically, and you can change it.“ | GA4: ein Satz je Vorbehalt |
| Zeile „Branded“ im Filtermenü | Wert „Excluded“ statt „Off“; Optionen unverändert „Include Branded“, „Only Branded“ | Rankscale: Standard als Wert |
| Chip nach einer Wahl | „All prompts“ bzw. „Branded prompts“, je mit X; X und „Clear filters“ führen zurück auf „Non-branded prompts“ | Carbon: Zurücksetzen führt auf den Standard |
| Leiste im URL- und Domain-Drawer | derselbe Chip, nur lesend (Klick öffnet die Erklärkarte) | GA4: Chip an jedem Bericht |

Wo eine Liste den globalen Umfang bewusst nicht anwendet, erscheint der Chip für diese Liste nicht. Das betrifft die Prompts-Tabelle mit ihrem eigenen Filter „Branded“ (Leerwert „All“). Im Drawer ist der Chip besonders wichtig: Dorthin führt der Weg über die Prompts-Tabelle, die Branded-Prompts immer zeigt, also aus einem anderen Umfang.

### Cited URLs: die Zeile verschwindet wie auf der Domainseite

Heute steht die Zeile da, mit „Citations (30d)“ = 0 und „First cited“ = heute. Die Liste und das Datum kommen aus `v_aff_all` ohne Branded-Filter, die Zählung aus `flt` mit Filter. Die Vorbilder würden den Fall so zeigen (abgeleitet):

- **GSC** unter „Non-branded“: Die Seite fehlt im Pages-Tab, der Filter steht in der Leiste.
- **Otterly** mit Tag-Filter: Die URL fehlt in Liste und Verlauf.
- **AthenaHQ** im Standard: Die Zeile ist da, mit Citation % > 0 und „First seen“ heute, weil nichts gefiltert ist.
- **Semrush Brand Performance**: Die URL fehlt in den non-branded Listen und steht in der Karte „Citations Branded“.

Eine Zeile mit 0 neben einem ungefilterten Datum zeigt keines dieser Tools.

**Empfehlung:** Zeilenmenge, „Citations (30d)“, „First cited“, „Prompts“ und „Models“ rechnen im Non-branded-Umfang. cedric-leenen erscheint nicht. „First cited“ deckt weiter alle Modelle und Märkte ab: Das ist die Entscheidung EV-10 vom 17.10. samt ihrer leisen Zeile. Branded schließt es künftig aber aus. Hinweise an einzelnen Zeilen gibt es nicht. Nur wenn der Ausschluss die Tabelle leert, nennt der Leerzustand den Grund.

| Element | Text (EN) | Umfang | Vorbild |
|---|---|---|---|
| Spalten | unverändert | Non-branded | GSC, Otterly |
| Erklärkarte „First cited“ und „Citations“ | ergänzt um „Branded prompts are not counted.“ | – | Semrush: Umfang im Beschreibungstext |
| Leerzustand, wenn nur der Standard leert | `UC.leerHtml` gefiltert: Titel „No matching URLs“, Text „1 URL was cited only by branded prompts, which are left out of the metrics.“ (Mehrzahl: „{n} URLs were …“), Knopf „Include Branded“ | Text braucht die Zahl außerhalb des Umfangs | Geist Empty State, AthenaHQ, Carbon |
| Leerzustand mit Nutzerfiltern | wie heute: „No matching URLs“, „Clear filters“ | – | Geist |
| Zeile EV-10 | bleibt: „First cited and New URLs always cover all models and markets, whatever the filters say.“ | – | eigener Bestand |

Der Knopf heißt „Include Branded“ und nicht „Clear filters“. Nach Carbon führt Zurücksetzen auf den Standard, also wieder auf den Ausschluss, und der Knopf wäre tot.

Verworfen wurde die Sentry-Doppelzahl in jeder Zeile (0 als Hauptwert, 1 als Nebenwert). Sie hätte den zweiten Umfang an jede Zahl gehängt, die eine Branded-Zitierung hat, und kein AI-Tool tut das. Die Tatsache „von Branded zitiert“ zeigt die Sitemap im selben Kasten.

### URL-Detail: „Last seen“ folgt dem Umfang, der zweite Umfang steht im Hovercard

Heute zeigt der Drawer „Last seen“ für heute (`last_cited_at` ohne Filter, laut Lexikon bewusst so), Kennzahlen 0, `in_range` false und eine leere Liste „Prompt Runs“. `meta.filters` nennt den Branded-Filter nicht, sodass die Oberfläche nicht erkennen kann, dass gefiltert wurde. Die Vorbilder (abgeleitet):

- **AthenaHQ** zeigt 1 Zitat und im Tab Responses eine Zeile mit „Prompt Type“ = Branded.
- **Peec** zeigt first und last seen heute und den Branded-Prompt in der Prompt-Tabelle des Details.
- **GSC** zeigt mit Page-Filter und „Non-branded“ beide Filter in der Leiste, einen Chart mit 0 und leere Tabellen. Der Grund ist sichtbar.
- **Sentry** zeigt den Zeitpunkt im Umfang als „N/A“ und im Hovercard die Zeile „Any Environment“ mit „today“.

**Empfehlung:** Alle Werte des Drawers rechnen im Umfang, auch „Last seen“. Der ungefilterte Zeitpunkt steht wie bei Sentry im Hovercard. Kippt der Fall, weil nichts im Umfang zitiert ist, aber außerhalb schon, erscheint unter dem Kopf eine Geist-Note. Über eine Anzeigeoption lassen sich die Branded-Läufe einblenden, wie bei Linear „Show triage issues“. Die Option ändert nur die Anzeige und keine Zahl, und jede eingeblendete Zeile trägt ihre Herkunft wie bei AthenaHQ.

| Element | Text (EN) | Umfang | Vorbild |
|---|---|---|---|
| Kennzahlen im Kopf | unverändert, hier 0 | Non-branded | Regel 1 |
| „Last seen“ | im Umfang: „Last seen 18. Oct 2026“, im Kippfall „Not cited yet“ | Non-branded | Sentry |
| Hovercard an „Last seen“ (immer) | „All prompts“ 21. Oct 2026, 13:08 / „Non-branded prompts“ Not yet | beide | Sentry „Any Environment“, „N/A for %s“ |
| Note, nur im Kippfall | „In this period, only branded prompts cited this URL (1 run, last on 21. Oct 2026), and branded prompts are left out of the metrics.“ Aktion „Show Branded Runs“, danach „Hide Branded Runs“ | beide | Geist Note, Linear |
| „Prompt Runs“ leer | `UC.leerHtml` gefiltert: „No matching runs“, Text „Runs from branded prompts are hidden.“, ohne Knopf (die Aktion trägt die Note) | Non-branded | Geist Empty State |
| eingeblendete Branded-Läufe | Zeilen mit dem Label aus `UC.brandedHtml` („Branded“ und Favicon Leeup Media); Kennzahlen bleiben | Branded | AthenaHQ „Prompt Type“ |

Verworfen wurde, den Drawer im Umfang „all“ zu öffnen, wenn man aus einem Branded-Kontext kommt. Dieselbe URL zeigte dann je nach Einstieg andere Zahlen, ein Bruch von Regel 1 an der Stelle, die Widersprüche gerade auflösen soll.

### Sitemap: „Branded only“ statt „1 citation“

Heute zeigt die Seitenabdeckung „1 citation“, weil `get_impact_event_coverage_v1` keinen Branded-Filter kennt. Dazu kommt das Badge „New or updated“: Laut `events.js` erscheint es nur an zitierten Seiten und meint, dass das Sitemap-Datum (lastmod 20.10.) nach dem Start des Trackings (19.10.) liegt. Mit dem Zitat hat es nichts zu tun. Die Vorbilder (abgeleitet):

- **AthenaHQ Site Map** zeigt je Seite eine AI citation rate, aber keine Datums-Badges, und filtert nur nach Bereich und Suche. Leer gefiltert heißt es „No pages match these filters“ ([AthenaHQ Docs: Site Map](https://docs.athenahq.ai/guides/site-health-site-map)).
- **Peec** führt das Inhaltsdatum als eigene Spalte „Updated“, getrennt von allen Zitierwerten ([Peec Docs: URLs](https://docs.peec.ai/urls)).
- Eine Abdeckungsansicht mit Branded-Filter hat kein Tool.

Die Sitemap ist eine Inventaransicht: Jede Seite steht immer da, offen ist nur ihr Status. Der Branchenkonsens (abgeleitet aus Scrunch, AthenaHQ und Peec) rechnet Kennzahlen non-branded und zeigt in Inventaransichten alles. Daraus folgt die **Empfehlung:** Zählung und Reiter folgen dem Umfang, cedric-leenen steht also unter „Not cited yet“. Im Kippfall ersetzt eine leise Marke die Marke „Not cited yet“. Sie fügt kein Element hinzu, sondern sagt an derselben Stelle die genauere Wahrheit.

| Element | Text (EN) | Umfang | Vorbild |
|---|---|---|---|
| Zählung je Seite, Reiter | wie heute, im Umfang | Non-branded | Regel 1 |
| Marke im Kippfall (auch im Reiter „Not cited yet“) | „Branded only“ (`up-marke is-leise`); Tooltip „Cited only by branded prompts (1 run, last on 21. Oct 2026). Branded prompts are left out of the metrics.“; Klick öffnet das URL-Detail | beide | AthenaHQ „Prompt Type“; Rankscale: Zustand an der Zeile |
| „New or updated“ | unverändert, erscheint weiter nur an zitierten Seiten und hier also nicht; optional später „New page“ / „Page updated“, damit das Subjekt die Seite ist | Sitemap-Datum | Peec „Updated“ |

Verworfen wurde, die Sitemap ungefiltert zu lassen und den Umfang an der Zahl zu nennen („incl. branded“). „Cited URLs“ und Sitemap stehen seit dem 21.10. in **einem** Kasten mit Umschalter. Zwei Umfänge in einem Kasten erzeugten den heutigen Widerspruch neu.

### Domainseite › URLs: schon richtig gerechnet, nur nicht benannt

`cached_citations_domain_urls_v1` filtert schon heute, und die URL fehlt. Das entspricht GSC (Pages-Tab unter Filter), Semrush (Positions unter „Non-branded“) und Otterly (Tag-Filter auf allen Endpunkten): fehlende Zeile, Filter in der Leiste. **Empfehlung:** Die Rechnung bleibt, wie sie ist. Neu sind nur der Chip „Non-branded prompts“ in der Leiste und, falls der Ausschluss die Liste leert, derselbe Leerzustand wie in „Cited URLs“: „No matching URLs“, „{n} URLs of this domain were cited only by branded prompts, which are left out of the metrics.“, Knopf „Include Branded“. Einen Hinweis an der Liste, dass Zeilen fehlen, gibt es nicht. So etwas dokumentiert kein Tool, und es wäre der Lärm, den der Product Owner ablehnt.

### Chart und Kennzahlen: der Umfang steht in der Erklärkarte, nicht an der Zahl

Der Analyse-Cache des Trackings rechnet schon heute mit `pf.branded = non_branded`, Chart und Kacheln folgen also dem Umfang. Die Vorbilder:

- **Scrunch** erklärt die niedrigere Zahl nur in der Hilfe.
- **AthenaHQ** erklärt AI Search Value gegen Share of Voice im FAQ.
- **Semrush** schreibt den Umfang in die Berichtsbeschreibung.
- **Similarweb** schreibt ihn in den Titel einer fest gefilterten Sicht.
- **GSC** und **Clarity** stellen beide Mengen als Kartenpaar nebeneinander.

Ein Kartenpaar wäre für upstreem ein Rückbau der Entscheidung vom 21.10., denn Branded zählt nicht in die Auswertungen. **Empfehlung:**

- Die Erklärkarten von „Overall Share“, „Overall Citations“, „URL Share“ und „New URLs“ bekommen den Satz „Branded prompts are not counted.“. An den Kacheln selbst steht nichts.
- Im Modus URL Share hat eine nur branded zitierte URL keine Linie, passend zu „Cited URLs“.
- Ist der Chart leer, weil alle Zitate im Fenster branded waren, zeigt `UC.chartLeerHtml` „No matching data“ mit dem Text „All citations in this period came from branded prompts, which are left out of the metrics.“. Einen Knopf gibt es nicht: Im Chart hängt nichts an `data-clearall`.

### Welcher Wert welchem Umfang folgt

| Wert | Ebene | heute | künftig | zweiter Umfang sichtbar |
|---|---|---|---|---|
| Zeile vorhanden | Cited URLs | ohne Filter | Non-branded | nein, nur im Leerzustand |
| „Citations (30d)“, „Prompts“, „Models“ | Cited URLs | Non-branded | Non-branded | nein |
| „First cited“ | Cited URLs | ohne Filter | Non-branded (alle Modelle und Märkte, EV-10) | nein |
| Kennzahlen im Kopf | URL-Detail | Non-branded | Non-branded | nein |
| „Last seen“ | URL-Detail | ohne Filter | Non-branded | ja, Hovercard „All prompts“ |
| „Prompt Runs“ | URL-Detail | Non-branded | Non-branded | auf Klick „Show Branded Runs“, mit Label |
| Note | URL-Detail | fehlt | nur im Kippfall | ja, sie ist der zweite Umfang |
| Zählung je Seite, Reiter | Sitemap | ohne Filter | Non-branded | nein |
| Marke | Sitemap | „New or updated“ (Sitemap-Datum) | „Branded only“ im Kippfall | ja |
| Zeilen und Werte | Domain › URLs | Non-branded | Non-branded | nein |
| Chart, Kacheln | Tracking | Non-branded | Non-branded | nein, Erklärkarte nennt den Umfang |
| Leerzustände | alle | Ruhezustand „No … yet“ | „No matching …“ mit Branded-Text, wenn außerhalb Daten liegen | ja, als Zahl im Satz |

Im Sinne von Sentry heißt das: Die Hauptzahl ist überall „Matching filters“, also Non-branded. Ein „Total“ über alle Prompts erscheint nur an drei Stellen: im Hovercard eines Datums, in einer Kippfall-Marke und im Satz eines Leerzustands.

### Was der Product Owner künftig sieht

Lukas öffnet „lee-up.de Tracker“. In der Leiste steht „Non-branded prompts“. Unter „Cited URLs“ fehlt /cedric-leenen. Wäre die Liste ohne diese Seite leer, stünde dort „No matching URLs“ mit „1 URL was cited only by branded prompts …“ und dem Knopf „Include Branded“. Er schaltet auf Sitemap und findet die Seite unter „Not cited yet“ mit der Marke „Branded only“. Der Tooltip nennt den einen Lauf vom 21. Oct 2026. Ein Klick öffnet den Drawer: im Kopf der Chip „Non-branded prompts“ und „Not cited yet“, das Hovercard zeigt „All prompts: 21. Oct 2026, 13:08“, die Kennzahlen stehen auf 0. Darunter steht die Note mit „Show Branded Runs“. Ein Klick zeigt den Lauf „Leeup Media Erfahrungen“ (Gemini, 13:08) mit dem Label „Branded“ und dem Favicon von Leeup Media. Auf der Domainseite fehlt die URL, und der Chip sagt warum. Wählt er „Include Branded“, steht die Seite überall mit 1 Zitat, „First cited“ und „Last seen“ heute. Jede Fläche sagt in jedem Umfang dasselbe.

## Teil 3: drei RPCs rechnen nach, vier Bausteine ziehen nach core

| Schicht | Änderung | Grund |
|---|---|---|
| `get_impact_event_urls_v1` | Zeilenmenge und „First cited“ (`fo`, `tu`) im Branded-Umfang; Modelle und Märkte bleiben offen (EV-10). Dazu im `meta` die Zahl der URLs, die nur außerhalb des Umfangs zitiert sind | Regel 1, Leerzustand |
| `get_impact_event_coverage_v1` | nimmt `p_intents` und `p_branded` an; je Seite die Zählung im Umfang, dazu ein Kennzeichen „nur außerhalb zitiert“ mit Zahl und letztem Datum | Regel 1, Marke „Branded only“ |
| `url_detail_v1` | `last_cited_at` im Umfang; zusätzlich ein ungefilterter Zeitpunkt und eine ungefilterte Laufzahl; `meta.filters` nennt `p_branded` | Hovercard, Note, Oberfläche erkennt den Filter |
| `cached_dashboard_responses_v1` | `meta.filters` nennt `p_branded`; ein Aufruf mit `p_branded "branded"` und `p_url` liefert die Läufe für „Show Branded Runs“ | Anzeigeoption |
| `cached_citations_domain_urls_v1`, Analyse des Trackings | die Zahl außerhalb des Umfangs im `meta`, mindestens wenn das Ergebnis leer ist | Leerzustände von Liste und Chart |
| core: `makeLeistenFilter` und Branded-Zeile in `filter-bar.js` | Standardwert als Chip ohne X sichtbar; Wert „Excluded“ statt „Off“; Chip-Texte „Non-branded prompts“, „All prompts“, „Branded prompts“; Zurücksetzen führt auf den Standard; lesende Fassung für Drawer | Regel 2, Carbon, Vercel |
| core: Leerzustand | die Entscheidung „gefiltert oder Ruhe“ liest künftig, ob außerhalb des Umfangs Daten liegen (aus `meta`), statt Branded pauschal auszunehmen wie heute `seitenFilterAktiv`. `leerHtml` bekommt eine Branded-Fassung mit Zahl im Satz und dem Knopf „Include Branded“ (`UC.intentFilterSet({ branded: "all" })`) | AthenaHQ, NN/g, Carbon |
| core: Note | die leise Zeile `.uev-filterhinweis` aus `events.js` (EV-10) wird zum geteilten Hinweis-Baustein nach Geist Note: kein Schließen, ein Satz, höchstens eine Aktion. `.core_parts.py hinweis` findet heute nichts | Geist Note, „Geteiltes sofort nach core“ |
| core: Hovercard für Zeitpunkte | zwei Zeilen „All prompts“ und „Non-branded prompts“, „Not yet“ für fehlende Werte; wiederverwendbar für jedes Datum | Sentry |
| Erklärkarten | Satz „Branded prompts are not counted.“ an „First cited“, „Citations“ und den Kennzahlen des Trackings; die Karte `branded` dient dem Chip | Semrush |
| `url-detail.js`, `events.js` | Note, Anzeigeoption mit `UC.brandedHtml`, Marke „Branded only“ samt Klickweg zum Drawer, Leerzustände | Teil 2 |
| Doku und Messung | CLAUDE.md §1d und STYLEGUIDE im selben Zug; Messung im Harness mit beiden Fällen (Kippfall und reiner Größenunterschied) und Gegentest gegen die alte Fassung (§3) | Hausregeln |

Die Cache-Schlüssel tragen den Branded-Wert schon, wie der Befund zeigt (`pf.branded`). Ein Export folgt nach der Hausregel „UI = Export“ demselben Umfang. Ein Nebenbefund gehört nicht zu dieser Frage, sollte aber nicht verloren gehen: `_impact_watch_sync_v1` löscht inaktive Prompts aus dem Spiegel. Damit fallen deren alte Läufe aus allen Zahlen des Citation Trackings, entgegen der Regel vom 17.10. Bei diesem Event wirkt das derzeit nicht, weil es 0 inaktive Prompts hat.

## Offene Lücken: ohne Anmeldung nicht prüfbar

Keine Aussage über die Oberflächen der Tools ließ sich an einer App prüfen. Es gibt keinen Zugang und keine auslesbaren Screenshots. Offen bleiben deshalb drei Fragen zur Darstellung:

- ob Scrunch seinen Standard „Non-Branded Only“ im Dashboard als Chip zeigt,
- wie der aktive Branded-Chip in GSC beschriftet ist,
- ob Semrush eine gewählte Preset-Karte hervorhebt.

Die zentrale Frage dieses Falls beantwortet keine öffentliche Quelle: ob Peecs first und last seen, AthenaHQs „First seen“ oder Profounds erstes Zitat unter einem Prompt-Filter neu gerechnet werden. Das Sentry-Muster ist deshalb eine Übertragung aus einem Fehler-Tracker, kein Branchenstandard. Mit Lücken belegt sind außerdem:

- Goodie: ohne jede Doku.
- Polaris und Material 3: nicht abrufbar.
- Heap: nicht recherchiert.
- Amplitude, Mixpanel, Datadog und Stripe: nur über Suchauszüge.
- Clarity: nur über Sekundärquellen.

Eine Studie zu Standardfiltern, die der Hersteller fest setzt, fehlt ebenso wie ein Beleg dafür, dass Nutzer einen Chip ohne X als Filter erkennen. Ungemessen ist schließlich, wie oft der Kippfall in upstreem vorkommt. Ein Tracking der eigenen Domain dürfte häufig eigene Seiten haben, die nur Branded-Prompts zitieren (Team- und Über-uns-Seiten), und davon hängt ab, wie oft „Branded only“ erscheint. Eine Zählung in der DB vor dem Bau würde das klären.

## Fazit

Ein sichtbarer Chip allein hätte den Fall nicht verhindert: Die 0 neben „heute“ entsteht aus gemischten Umfängen, nicht aus einem verborgenen Filter. Konsistente Umfänge allein hätten die Seite dagegen überall still verschwinden lassen. In einem Tracking der eigenen Domain wäre damit eine echte Tatsache unsichtbar geworden: dass die Seite zitiert wird, wenn auch nur, wenn man nach der Marke fragt. Erst die Kombination löst beides. Die Rechnung ist gleich, der Standard trägt einen Namen, und der zweite Umfang erscheint nur dort, wo er die Antwort umkehrt. Mit dieser Kombination muss upstreem etwas lösen, was der Markt kaum kennt: Außer Scrunch schließt kein Tool Branded standardmäßig aus, und Scrunch schiebt die Erklärung ins Hilfecenter.

Daraus folgt für künftige Entscheidungen eine Prüffrage für jede neue Fläche: Rechnet jedes Datum, jede Zählung und die Zeilenmenge im selben Umfang, und kippt der Umfang hier eine Ja/Nein-Antwort? Ist beides geklärt, braucht es keine Hinweise an Zahlen. Die Benennung sollte von Anfang an einheitlich sein: „Non-branded prompts“, „All prompts“, „Branded prompts“ und „Branded only“, nirgends „Off“. Scrunchs drei Namen für eine Sache zeigen, wie schnell das sonst ausfranst. Will upstreem Prompts mit Wettbewerbernamen später anders behandeln als solche mit der eigenen Marke, liegt mit Semrushs „Branded for other domains“ schon ein Vorbild bereit.
