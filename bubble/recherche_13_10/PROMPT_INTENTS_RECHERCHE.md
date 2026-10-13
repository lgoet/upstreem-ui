# Prompt-Intents in GEO-Tools: Recherche und Vorschlag für upstreem (13.10.)

„Belegt“ heißt: in einer Primärquelle des Herstellers gelesen (Doku, Help Center, Produktseite). „Indiz“ heißt: nur aus Marketingtext oder von Dritten. „Nicht gefunden“ heißt: in öffentlichen Quellen nicht auffindbar, was nicht bedeutet, dass es das Feature nicht gibt.

## 1. Vergleich

| Tool | Kategorien | Wer vergibt | Wo sichtbar | Beleg |
|---|---|---|---|---|
| **Peec AI** | System-Tag „Intent Type“: **Informational / Commercial / Transactional**. Dazu ein zweiter System-Tag **Branded / Non-branded** | **Automatisch**, je Prompt genau ein Wert pro Gruppe. Einzelne Prompts lassen sich umstufen, die Kategorien selbst nicht ändern. Eine leere Zelle heißt „wird noch klassifiziert“ | Spalte in der Prompt-Tabelle plus Filter, kombinierbar mit Tags und Topics | belegt |
| **Conductor** | Buyer Journey: Education, Comparison, Pricing, Recommendations, Purchase, Support, Brand/Service Navigation | **Automatisch** per KI, Stufen anpassbar | **Heatmap Persona × Intent** mit Drilldown bis zum Prompt. Die Prompt-Generierung lässt sich nach Intent steuern | belegt |
| **Scrunch** | „Stage“: Awareness, Comparison, Evaluation, Advice, Other. Dazu Personas und Branded/Unbranded | Unklar. Die Stage ist per Bulk änderbar | Filter, Persona × Stage | belegt |
| **Semrush AI Toolkit** | Informational, Navigational, Commercial, Transactional, Task-based | Automatisch | „Intent Breakdown“ je **Topic**, keine Spalte an den getrackten Prompts | belegt |
| **Profound** | Informational / Commercial / Transactional in den Prompt-Volumes. Im Tracking nur als **eigene Tags** | Volumes automatisch, Tracking von Hand | Intent Breakdown. Warnung: Gemischte Intents verzerren den Visibility-Score | belegt |
| **Rankscale** | Pflicht-Tag Information / Consideration / Transaction, dazu Branded/Non-branded | Von Hand | Prompt-Gruppen, Startmatrix 3 × 2 × 2 | belegt |
| **GrackerAI** | 8 Intents: Informational, Comparison, Alternatives, How-to, Troubleshooting, Recommendation, Pricing, Transactional | **Automatisch beim Speichern**. Eine manuelle Wahl ist endgültig, auch im Bulk | Filter. „Prompt Diagnosis“ schlägt Prompts für unterbesetzte Intents vor | belegt |
| **BrightEdge** | informational / navigational / commercial / transactional | Automatisch | Vergleich mit Wettbewerbern | Indiz |
| **Evertune** | Prompt-Typen statt Intents (ohne Marke, attributbezogen) | Methodik | Eigene Reports | Indiz |
| Otterly, AthenaHQ, Ahrefs Brand Radar, Similarweb, Writesonic, Goodie, Knowatoa, HubSpot | kein Intent-Feld gefunden | – | – | – |

## 2. Muster

1. **Drei Stufen sind der Standard.** Peec, Profound und Rankscale nutzen Informational / Commercial / Transactional. Feiner werden nur Conductor (7), Gracker (8) und Semrush (5).
2. **Branded und Non-branded sind eine eigene Achse**, kein Intent. Das ist für GEO vermutlich die wichtigste Trennung.
3. **Wo es ein echtes Feature ist, vergibt die KI den Wert automatisch und der Nutzer kann ihn überschreiben.** Ein Override bleibt danach stehen.
4. **Der Intent ist ein festes Systemfeld neben den freien Tags.** Wo das fehlt, bauen Nutzer ihn als Tag nach, und das wird uneinheitlich.
5. **Typische Darstellung:** Spalte und Filter in der Prompt-Tabelle, ein Breakdown-Chart bzw. eine Heatmap und die Steuerung der Prompt-Generierung nach Intent.

## 3. Wofür Kunden es nutzen

- **Lücken im Funnel finden:** „In informationellen Prompts sind wir sichtbar, in Kauf-Prompts kaum.“
- **Inhalte priorisieren** nach Kaufphase statt nur nach Volumen.
- **Kennzahlen sauber halten:** Informationelle Antworten nennen seltener Marken, ein gemischter Score verzerrt.
- **Wettbewerb nach Intent vergleichen:** „Wettbewerber X gewinnt die Vergleichs-Prompts.“
- **Das Prompt-Set ausbalancieren**, mit Hinweisen auf unterbesetzte Intents.
- Peecs eigene Studie (1.754 Prompts, nicht unabhängig geprüft): Der Intent erklärt mehr als das Keyword. Formulierungsvarianten mit gleichem Intent liefern zu über 90 % dasselbe.

## 4. Stolpersteine

- **Zu viele Kategorien:** Ab etwa 6 verschwimmt die KI-Zuordnung, und die Charts werden dünn.
- **Genau ein Label je Prompt**, sonst ergeben die Anteile nicht 100 %.
- **Falsche KI-Zuordnung:** Deshalb braucht es einen Override, der stehen bleibt, und den sichtbaren Zustand „Classifying…“ statt einer leeren Zelle.
- **Topic ist nicht Intent:** Das Topic sagt *worüber*, der Intent *warum*. Liegt der Intent in den Tags, kann ihn jemand löschen.
- **Kleine Stichproben:** Die Prompt-Anzahl gehört immer neben den Wert.
- **Branded-Prompts** haben fast 100 % Visibility und blähen jede Stufe auf. Deshalb braucht es einen eigenen Schalter.

## 5. Vorschlag für upstreem

**Ausgangslage im Code**

- Prompts haben schon Topics (1–3) und Tags.
- Die Prompt Research hat intent-artige Chips: Discovery, Comparison, Buying intent, How-to, Reviews, Alternatives, Pricing, Best-of (`prompt-research.js:586`).
- Der Onboarding-Generator erzeugt ausdrücklich **nur** Kauf- und Anbieterbewertungs-Prompts. Eine Intent-Verteilung würde diese Einseitigkeit sofort sichtbar machen. Das ist bewusst zu entscheiden.

**Taxonomie: 5 Intents, genau einer je Prompt, plus ein Branded-Schalter**

| Intent | Funnel | Bedeutung | Beispiel Auto | Beispiel SaaS |
|---|---|---|---|---|
| **Informational** | Awareness | Thema oder Problem verstehen | „Wie lange hält ein E-Auto-Akku?“ | „What is lead scoring?“ |
| **Recommendation** | Consideration | Offene Anbietersuche (best/top) | „Bestes Elektro-SUV für Familien“ | „Best CRM for small agencies“ |
| **Comparison** | Consideration/Decision | Benannte Optionen, Alternativen | „EQE vs BMW i5“ | „HubSpot vs Pipedrive“ |
| **Purchase** | Decision | Preis, Leasing, Händler, Abschluss | „GLC Leasing ohne Anzahlung“ | „Pipedrive pricing per user“ |
| **Support** | Retention | Nutzung eines vorhandenen Produkts | „Serviceintervall zurücksetzen“ | „Import contacts into HubSpot“ |

- **Branded/Non-branded** wird nicht gespeichert, sondern per Namensabgleich gegen eigene Marke und Wettbewerber berechnet. Das ist deterministisch, billig und erklärbar.
- Navigational, Pricing und Alternatives gehen in Branded, Purchase bzw. Comparison auf.

**Vergabe**

- Generierte Prompts (Onboarding, Prompt Research, Create with AI) bekommen `intent` im selben LLM-Aufruf mit, ohne Mehrkosten.
- Manuell oder per Bulk angelegte Prompts klassifiziert ein Hintergrundjob mit kleinem Modell. Bis dahin steht in der UI „Classifying…“.
- Den Override gibt es im Prompt-Detail und als Bulk-Aktion „Set intent“. Danach gilt `intent_source = 'user'`, und keine Neuklassifikation fasst den Wert mehr an.
- Ein einmaliger Backfill erfasst die bestehenden Prompts.

**Wo es erscheint**

1. **Prompts-Tabelle:** Spalte (dezenter Text-Chip ohne Punkt und ohne Rahmen) und Filter, dazu ein Filter Branded/Non-branded.
2. **Dashboard:** „Visibility by intent“ (Visibility, SoV, Rang, Sentiment), eigene Marke gegen die Wettbewerber, immer mit Prompt-Anzahl. Standardansicht Non-branded. Später optional eine Heatmap Topic × Intent.
3. **Opportunities:** der Intent an jeder Opportunity, Kauf- und Vergleichslücken zuerst.
4. **Prompt Research:** der Intent an jedem Vorschlag und ein Hinweis bei Schieflage („No Comparison prompts tracked“).
5. **Export, Brand- und Domain-Detail:** Spalte bzw. Filter durchgereicht.

**DB-Arbeit (grob)**

1. Spalten `prompts.intent` (Check auf die 5 Werte, nullable), `intent_source` ('ai'|'user'), `intent_confidence`, `intent_classified_at`, `intent_model_version`, mit Rückweg-SQL.
2. Den Klassifizierer im n8n-Generatorschema und in einem Job bzw. einer Edge Function für manuelle Prompts plus Backfill. Liefert das Modell Schutt, bleibt der Wert `null` und wird erneut versucht, nie geraten.
3. `set_prompt_intent(prompt_ids[], intent)` für den Einzel- und Bulk-Override.
4. **Vorhandene** RPCs erweitern: Die Prompt-Liste liefert `intent`, Dashboard und Opportunities bekommen einen Filter `intent` und ein Aggregat je Intent.
5. Optional: 50 Prompts von Hand labeln, um die Trefferquote zu messen.

## Offen

- Bei Scrunch, BrightEdge, AthenaHQ, Otterly, Writesonic, Goodie, Knowatoa und HubSpot war nicht zu klären, wie bzw. ob der Intent vergeben wird.
- Ob Conductor Overrides je Prompt erlaubt, steht nicht in der Quelle.

## Quellen

- https://help.peec.ai/article/what-are-system-tags-and-how-can-i-use-them-qarhqr017mu01f0wtpe413ua
- https://help.peec.ai/article/part-2-using-tags-effectively-bfwwu4otvcf9r796xqhlprnr
- https://www.conductor.com/platform/features/ai-search-performance/ai-audience-intent-analysis/
- https://helpcenter.scrunchai.com/en/articles/12691756-understanding-filters-in-scrunch
- https://scrunch.com/faqs/does-scrunch-let-me-filter-data-based-on-persona-and-funnel-stage
- https://www.semrush.com/kb/1597-prompt-research-report
- https://www.tryprofound.com/features/prompt-volumes/research-reports
- https://university.tryprofound.com/courses/profound-101/modules/setup/lessons/organizing-for-scale-and-experimentation
- https://rankscale.ai/resources/modules/setting-up-prompt-groups/intent-information-consideration-transaction
- https://gracker.ai/docs/using-gracker/working-with-prompts/prompts/
- https://www.evertune.ai/research/insights-on-ai/how-evertunes-prompt-tracking-works
- https://aisearch.similarweb.com/ai-brand-visibility/prompt-analysis/
- https://help.ahrefs.com/en/articles/9973393-how-to-filter-keywords-based-on-search-intent-and-other-useful-attributes
- https://letsdatascience.com/news/peec-ai-finds-intent-outweighs-keywords-for-visibility-686adcfa

## Nachtrag: Branded in den Kennzahlen und Onboarding-Set (13.10.)

**Branded in den Kennzahlen**
- **Scrunch:** Das Dashboard zeigt standardmäßig nur Unbranded („This is intentional“). Der Filter gilt für alle Kennzahlen, auch Sentiment und Position. Branded heißt dort: nennt die eigene Marke. Wettbewerber haben einen eigenen Filter. (belegt)
- **Peec, Conductor:** Branded heißt, der Prompt nennt die eigene Marke oder einen Wettbewerber. Es gibt einen Filter, aber keine belegte Standardansicht. (belegt)
- **Otterly:** Branded-Prompts gar nicht erst tracken („bias the results“). Liegen doch welche vor, gibt es einen Hinweis. (belegt)
- **Rankscale:** Den Visibility Score für Branded und Non-branded getrennt ausweisen. Branded gilt als „floor“, Non-branded als „ceiling“. (belegt)
- **Adobe:** Eine Kachel zeigt den Branded-Anteil im Set und warnt, wenn er „outside a healthy range“ liegt. (belegt)
- **Sentiment und Rang:** Kein Hersteller trennt die Kennzahlen ausdrücklich. Bei Scrunch folgen alle Kennzahlen demselben Filter.

**Onboarding-Set**
- **Peec:** Ein sichtbarer Schritt „Distribution“, voreingestellt auf 20 % branded und Intent 25/50/25 (Informational/Commercial/Transactional). Danach nimmt der Nutzer jeden Vorschlag einzeln an oder lehnt ihn ab. (belegt)
- **Conductor:** Ein eigener Setup-Reiter „Search Intents“, Prompt-Typ „Both“ empfohlen. (belegt)
- **Scrunch:** 5 automatische Starter-Prompts, dazu 5–15 eigene. (belegt)
- **Otterly:** Nur non-branded, Mitte bis Ende des Funnels, etwa 100 Prompts je Land und Sprache. (belegt)
- **Profound:** 5–10 Topics mit je 5–10 Prompts, „healthy mix of intents“. Das wird in der Akademie erklärt, nicht in einem Wizard. (belegt)
- **Support als Intent** hat kein Tool.

Quellen: helpcenter.scrunchai.com/en/articles/13566677-scrunch-metrics-guide, docs.peec.ai/setting-up-your-prompts, conductor.com/en/docs/intelligence/ai-search-setup.md, help.otterly.ai/onboarding3, rankscale.ai/resources/modules/setting-up-prompt-groups/branded-vs-non-branded, experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/prompt-management, help.tryprofound.com/articles/4097254385-creating-the-right-prompts

## Nachtrag 2: die vierte Stufe (13.10.)

**Definitionen (belegt)**
- **Peec:** Commercial = „comparing products“ (best X, X vs Y). Transactional = „ready to buy or sign up“, Beispiel „Lululemon Align leggings price“. Genau ein Wert je Prompt.
- **Rankscale:** Information / Consideration („best CRM“) / Transaction = „Filtering for purchase conditions“ („CRM pricing“).
- **Ahrefs:** Transactional = „ready to complete an action, often a purchase“. Transaktionale Modifier sind unter anderem price und pricing.
- **Conductor:** Purchase („buy or take conversion action“) und Pricing („seeks cost information“) sind GETRENNTE Klassen. Recommendations = „not direct comparison“.
- **Profound:** Purchase = „Ready to buy, book, or subscribe“. Preise zählen dort zur Consideration.
- **Google Quality Rater Guidelines:** Do-Query = download, buy, obtain. Ein Login ist eine Website-Query, also navigational.

**Folgerung:** Purchase ist eine Teilmenge von Transactional. Transactional umfasst auch Anmelden, Testversion, Buchung und Download. Das geplante Bündel aus Preis, Testversion, Händler, Leasing und Kauf entspricht genau Peecs und Rankscales Transactional. Wo Preisanfragen hingehören, regelt jedes Tool anders.

**Überschneidung:** Peec, Conductor, GrackerAI und Rankscale vergeben genau ein Label. Eine veröffentlichte Regel für den Gleichstand hat keines dieser Tools.

**Häufigkeit:** In ChatGPT sind transaktionale Prompts selten. Laut Profound-Studie sind es 6,1 % (Indiz, Methode nicht offengelegt). OpenAI fasst Empfehlung und Preis in einer Kategorie „purchasable_products“ zusammen.

Quellen: help.peec.ai (System Tags), rankscale.ai (Modul Intent), help.ahrefs.com/en/articles/9973393, conductor.com/docs/intelligence/ai-search-faqs/, tryprofound.com/blog/introducing-conversation-intent-in-prompt-volumes, guidelines.raterhub.com (QRG 11.09.2025), tryprofound.com/blog/chatgpt-intent-landmark-study
