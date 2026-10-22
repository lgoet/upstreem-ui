# UX-Muster: einen Standardfilter sichtbar machen und Werte kennzeichnen, die nur im ausgeschlossenen Teil existieren

Stand der Recherche: 21.10.2026. Ältere Quellen tragen ihr Datum. „Verifiziert“ heißt: die Seite wurde abgerufen und die Stelle dort gelesen. Was nur aus einem Suchergebnis-Auszug stammt, ist als solches markiert. UI-Texte stehen im englischen Original.

Bezug (der upstreem-Fall): `lee-up.de/cedric-leenen` wurde heute genau einmal zitiert, nur von einem Branded Prompt. Standardfilter „non-branded“ ist nirgends sichtbar. Ergebnis: (1) Cited URLs: Zeile da, Citations (30d) = 0, First cited = heute; (2) URL-Detail: Last seen today, Kennzahlen 0, Läufe leer; (3) Sitemap: 1 Citation, Badge „New or updated“; (4) Domain › URLs: Zeile fehlt.

---

## 1. Google Analytics 4: Schwellen, Sampling, „(other)“, Vergleiche und Datenfilter

### Takeaway
GA4 bündelt alle Einschränkungen der Datenbasis in **einem** Symbol neben dem Berichtstitel (Data quality indicator) mit einem Satz je Einschränkung; der ungefilterte Normalzustand ist als sichtbarer Chip „All users“ benannt, nicht unsichtbar. Datenfilter (internal traffic) wirken dagegen unsichtbar und endgültig, mit einem „Testing“-Zustand, der markiert statt ausschließt.

### Cited Findings
- Data quality indicator, Ort: „next to the title of a detail report“, „in the top right of a summary card on an overview report“ und „in the top right of an exploration“. – [GA4 Data quality](https://support.google.com/analytics/answer/12856703?hl=en) (verifiziert; Seite ohne Datum, Fußzeile ©2026)
- Drei Zustände mit Mustertexten: ungesampelt „This report is based on 100% of available data.“; Thresholding „Google Analytics has applied thresholding to one or more cards in this report“; stark gesampelt „This report is based on 8.88% of available data.“ mit dem Zusatz „A smaller sample size means that the data in this report is less accurate.“ – [GA4 Data quality](https://support.google.com/analytics/answer/12856703?hl=en) (verifiziert; Farben des Symbols stehen nur in Screenshots, nicht im Text)
- Thresholding-Meldung im Wortlaut: „Google Analytics has applied thresholding to one or more cards in this report“ und „will only display the data in the cards when the data meets the minimum aggregation thresholds.“ Schwellen sind systemseitig, nicht änderbar; Abhilfe: Zeitraum vergrößern. – [GA4 About data thresholds](https://support.google.com/analytics/answer/9383630) (verifiziert)
- Die Zeile „(other)“ fasst die seltensten Werte zusammen, wenn eine Tabelle ihr Zeilenlimit übersteigt („other“ ohne Klammern bedeutet dasselbe). Wichtig für upstreem: eine Warnung zu „(other)“ kann im Data-quality-Symbol erscheinen, **auch wenn keine (other)-Zeile sichtbar ist**, nämlich wenn ein Filter die zusammengefassten Ergebnisse ausblendet. – [GA4 About the (other) row](https://support.google.com/analytics/answer/13331684) (verifiziert; exakter Hinweistext steht nicht auf der Seite)
- Vergleiche: ein Bericht zeigt „data for All users by default“; die Vergleichsdefinitionen stehen oben im Bericht, jede mit eigener Farbe („A color-coded version of the data appears for each comparison“), Entfernen per „X to the right of the definition“. Beim Seitenwechsel werden „all comparisons but the All users one“ abgewählt. Kann ein Bericht eine Bedingung nicht, „a blank card appears for that comparison“. – [GA4 Apply comparisons to reports](https://support.google.com/analytics/answer/9269518?hl=en) (verifiziert)
- Einzelne Berichte sagen ausdrücklich, dass sie alle Nutzer zeigen, und verweisen auf „Add filter“ oben links (z. B. Key event attribution models, All channels performance). – [Suchergebnis-Auszüge, support.google.com/analytics/answer/10596865 und /12198930](https://support.google.com/analytics/answer/10596865?hl=en) (nur Auszug, nicht abgerufen)
- Datenfilter (internal/developer traffic) sind endgültig: „Once you apply a data filter, the effect on the data is permanent“; ausgeschlossene Daten „is never processed and will never be available in Google Analytics or BigQuery“. Wer nur ausblenden will, soll „report filters“ nutzen. – [GA4 Data filters](https://support.google.com/analytics/answer/10108813?hl=en) (verifiziert)
- Zustand „Testing“ eines Datenfilters: der Verkehr wird markiert, bleibt aber in den Berichten, über die Dimension „Test data filter name“ vergleichbar; „Active“ schließt aus. – [Search Engine Journal](https://www.searchenginejournal.com/how-to-filter-internal-traffic-in-google-analytics/485913/), [Optimize Smart](https://optimizesmart.com/blog/understanding-data-filters-in-google-analytics-4/) (Drittquellen aus Suchergebnissen, nicht bei Google gegengeprüft)

### Inferences
- Das stärkste übertragbare Muster ist der **eine Ort für Datenvorbehalte** neben dem Titel: ein Symbol, das je Vorbehalt einen Satz zeigt. Für upstreem hieße das: neben dem Titel jeder Karte/Seite ein Hinweis, der den Ausschluss der Branded Prompts nennt, sobald er die Zahlen dieser Fläche verändert.
- GA4 zeigt einen Vorbehalt auch dann, wenn die betroffene Zeile durch einen Filter gar nicht sichtbar ist. Das ist genau Ebene (4) des upstreem-Falls: die fehlende URL auf der Domainseite verdient einen Hinweis, obwohl keine Zeile da ist.
- „All users“ als sichtbarer Chip zeigt: auch der Normalzustand bekommt einen Namen. Ein Standardfilter, der nie verschwindet, sollte erst recht als Chip dastehen.
- GA4s Unterscheidung „Data filter“ (endgültig, unsichtbar) vs. „Report filter“ (sichtbar, umkehrbar) ist eine Warnung: upstreem verhält sich nach außen wie ein Datenfilter (unsichtbar), ist aber ein Berichtsfilter (Daten sind da, Sitemap zeigt sie). Genau diese Mischung erzeugt die Widersprüche.

### Gaps
- Farbe und Form des Data-quality-Symbols (grüner Haken, gelbes Ausrufezeichen) stehen nur in Screenshots; aus Textquellen nicht belegbar.
- Exakter Hinweistext der (other)-Warnung im Symbol nicht gefunden.
- Ob GA4 Report-Filter als Chip unter dem Titel zeigt (Wortlaut „Filter: …“), konnte nicht aus offiziellem Text belegt werden.

---

## 2. Google Search Console: anonymisierte Queries, Summen ohne Deckung, Branded-Filter

### Takeaway
GSC erklärt die Lücke zwischen Chart-Summe und Tabellensumme **nur in der Doku und im Blog**, nicht im UI, und Nutzer melden das bis heute als „doesn't add up“. Seit November 2025 hat GSC einen Filter **Branded / Non-branded**, das direkteste Gegenstück zum upstreem-Fall.

### Cited Findings
- „Anonymized queries are those that aren't issued by more than a few dozen users over a two-to-three month period.“ Sie fehlen in Tabellen, „they are included in chart totals, unless you filter by query.“ Folge: „if you sum up clicks for all the rows, you'll not find the same number of clicks as the chart totals.“ – [Google Search Central Blog, 19.10.2022](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive) (verifiziert)
- Zahlenbeispiel dort: Zeilen 150 + 125 + 100 + 75 = 450 Klicks, Chart-Summe 550. Mit Query-Filter: „contains fiction“ 175 + „doesn't contain fiction“ 275 = 450, Chart ohne Filter 550. – [Google Search Central Blog, 19.10.2022](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive) (verifiziert)
- Der Artikel sagt nicht, dass das UI einen eigenen Wert für anonymisierte Queries zeigt. – [ebd.](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive) (verifiziert als Abwesenheit im Text)
- Help-Seite des Performance-Berichts: „The chart totals can sometimes differ from the table totals“, Ursache verschiedene Aggregation (Property vs. Seite); vorläufige Daten als gestrichelte Linie; „Values shown as either ~ or - in the report (not available/not a number) will be zeros in the downloaded data.“ Anonymisierte Queries erwähnt diese Seite nicht. – [GSC Performance report](https://support.google.com/webmasters/answer/7576553) (verifiziert)
- Nutzerwahrnehmung: Forenthread mit dem Titel „Filters on GSC Query don't add back up to total, i.e. branded and non-branded queries don't add“. – [Google Developer forums](https://discuss.google.dev/t/filters-on-gsc-query-dont-add-back-up-to-total-i-e-branded-and-non-branded-queries-dont-add/291116) (nur Titel aus Suchergebnis, Inhalt nicht gelesen)
- Branded queries filter (20.11.2025, Michael Huzman): Optionen **Branded** („performance data for queries that include your brand name or closely associated products“) und **Non-branded** („performance data for all other queries“); Einordnung durch „an internal, AI-assisted system“, ausdrücklich nicht über Keyword-Ein-/Ausschluss; Vorbehalt „some queries may occasionally be misidentified“; nur für Top-Level-Properties mit genug Volumen. Eine neue Insights-Karte zeigt „the breakdown of total clicks for branded versus non-branded traffic.“ Nachtrag 11.03.2026: „now available to all eligible sites.“ – [Google Search Central Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter) (verifiziert)

### Inferences
- GSC ist das Negativbeispiel für Ebene (f): eine erklärte, aber im UI unsichtbare Lücke wird als Fehler gelesen, selbst von Fachleuten. Für upstreem reicht Doku nicht; die Erklärung muss an der Zahl stehen.
- GSC behandelt Branded/Non-branded als **wählbaren Filter mit sichtbarem Namen** und zeigt die Aufteilung zusätzlich als eigene Karte. Für upstreem bietet sich dieselbe Doppelung an: der Standardfilter als benannter Chip plus eine kleine Aufteilung („N citations from branded prompts, excluded“) dort, wo sie Widersprüche erklärt.
- GSC sagt offen, dass die Einordnung irren kann. upstreem klassifiziert ebenfalls (Markenname im Prompt); derselbe Vorbehalt in der Erklärkarte wäre ehrlich.

### Gaps
- Standardzustand des GSC-Branded-Filters (vermutlich „aus“, also alle Queries) steht nicht im Blog; nicht belegt.
- Ob GSC heute im UI einen Hinweis auf anonymisierte Queries zeigt, ist aus den abgerufenen Quellen nicht belegbar.

---

## 3. Produktanalyse (PostHog, Amplitude, Mixpanel, Heap): „interne und Test-Nutzer ausfiltern“

### Takeaway
PostHog ist das klarste Vorbild: ein projektweit definierter Ausschluss, der **je Insight als benannter Schalter** im Filterbereich steht und für neue Insights standardmäßig an sein kann. Für Amplitude, Mixpanel und Heap fand sich kein offizieller projektweiter Standardausschluss mit sichtbarer Kennzeichnung.

### Cited Findings
- PostHog, Wortlaut: Schalter „Filter out internal and test users“ im Filterbereich jedes Insights; Einstellungen unter „Settings → Project → Filter out internal and test users“; Option „Enable this filter on all new insights“; Abschnitt „Existing insights“ mit „Turn on for existing insights“ / „Turn off for existing insights“. – [PostHog Docs: Internal and test users](https://posthog.com/docs/data/test-accounts) (verifiziert; Seite ohne Datum)
- PostHog: „Defining the filters does not switch them on by itself.“ Dashboards folgen dem Insight, außer ein Dashboard hat eine eigene Übersteuerung. Geänderte Filterlisten aktualisieren Caches nicht; empfohlen wird „Refresh“ am Insight. – [PostHog Docs](https://posthog.com/docs/data/test-accounts) (verifiziert)
- PostHog: SQL-Insights haben keinen solchen Schalter, der Ausschluss muss in die Abfrage. Das Filtern verhindert nicht die Erfassung, es wirkt nur auf die Analyse. – [PostHog Suchergebnis-Zusammenfassung zu test-accounts und tutorials/filter-internal-users](https://posthog.com/tutorials/filter-internal-users) (aus Suchergebnis-Auszug)
- Amplitude: Offizielle Empfehlung ist ein getrenntes Entwicklungsprojekt; in der Community wird eine Kohorte interner Nutzer je Chart ausgeschlossen, mit der Klage, das müsse Chart für Chart geschehen. Ein projektweiter „Default user exclusions“-Abschnitt existiert laut Release Note nur für Guides and Surveys. – [Amplitude Community](https://community.amplitude.com/discussion/12851/filtering-out-internal-users-from-the-data), [Amplitude Release: project-wide user exclusions](https://amplitude.com/releases/project-wide-user-exclusions) (aus Suchergebnis-Auszügen, nicht abgerufen)
- Mixpanel: gefunden wurde nur der allgemeine „global filter“ je Bericht (Filter-Knopf, gilt für den ganzen Bericht); ein eingebauter Test-Account-Schalter ließ sich nicht belegen. – [Mixpanel Docs: Reports](https://docs.mixpanel.com/docs/reports) (aus Suchergebnis-Auszug)

### Inferences
- Das PostHog-Muster passt fast deckungsgleich: ein Ausschluss mit festem Namen, an jeder Auswertung als Schalter sichtbar, standardmäßig an. Der Name beschreibt die **Wirkung** („Filter out …“), nicht die Ursache.
- PostHog zeigt auch die Schwäche: wo der Schalter fehlt (SQL-Insights), ist der Ausschluss still. upstreem hat dieselbe Gefahr an jeder Fläche, die den Filter nicht anwendet (Sitemap, Ebene 3).

### Gaps
- Ob PostHog auf Dashboard-Kacheln ein eigenes Abzeichen für den aktiven Ausschluss zeigt, steht nicht in der Doku.
- Heap nicht recherchiert (Budget); Mixpanel und Amplitude nur über Auszüge.

---

## 4. Vercel, Datadog, Sentry, Linear, Stripe: Standard-Umfang, „N hidden“, gefilterte Zeitstempel

### Takeaway
Sentry ist die genaueste Entsprechung zum upstreem-Detailproblem: First/Last seen folgen dem gewählten Umfang, und ein Hovercard stellt den Wert für „Any Environment“ daneben, inklusive „N/A for <environment>“, wenn im Umfang nichts vorkommt. In Listen zeigt Sentry drei Zählungen mit Namen: „Matching filters“, „Total in <Zeitraum>“, „Since issue began“. Vercel und Stripe machen den Standardumfang als dauerhaft sichtbaren Wähler bzw. Banner kenntlich.

### Cited Findings
- Sentry Issue Details, Seitenleiste: „These values depend on your environment selection and update if you change the environment.“ (First/Last seen); „The event and user counts reflect your current search, selected environments, and time period.“; „This differs from the counts in the header, which show total counts across the issue's lifetime.“ – [Sentry Docs: Issue Details](https://docs.sentry.io/product/issues/issue-details/) (verifiziert)
- Sentry-Code, Komponente für First/Last seen (Stand master, abgerufen 21.10.2026): Hovercard-Kopf immer mit Zeile `"Any Environment"` (relativer Zeitpunkt global); ist eine Umgebung gewählt, zweite Zeile mit dem Umgebungsnamen und entweder dem Zeitpunkt oder `"N/A"`; Körper bei fehlendem Wert `"N/A for %s"` (Umgebung). Auslöser zeigt den Wert im Umfang, sonst „N/A“. – [getsentry/sentry seenInfo.tsx](https://raw.githubusercontent.com/getsentry/sentry/master/static/app/components/group/seenInfo.tsx) (verifiziert am Quelltext)
- Sentry-Issue-Liste (master, 21.10.2026): Hovercards der Ereignis- und Nutzerzahl mit `'Matching filters'` (nur wenn die Suche Filter enthält), `'Total in %s'` (Zeitraum) und `'Since issue began'`; mit gefilterten Werten ist die gefilterte Zahl die Hauptzahl, die Gesamtzahl steht als zweite, kleinere Zahl daneben. – [getsentry/sentry stream/group.tsx](https://raw.githubusercontent.com/getsentry/sentry/master/static/app/components/stream/group.tsx) (verifiziert am Quelltext)
- Sentry-Blog (22.07.2016): „By default we automatically select the most production-like environment“ und „The First Seen and Last Seen attributes will reflect the chosen environment.“ – [Sentry Blog: Environment details](https://blog.sentry.io/environment-details) (verifiziert, alt)
- Vercel Web Analytics: Umgebungswähler oben rechts mit **Production**, **Preview**, **All Environments**; „Production is selected by default.“ – [Vercel Docs: Using Web Analytics, last_updated 16.09.2026](https://vercel.com/docs/analytics/using-web-analytics) (verifiziert)
- Vercel Web Analytics API filtert „by default“ nur auf Produktion. – [Vercel Docs: Web Analytics API](https://vercel.com/docs/analytics/web-analytics-api) (nur Suchergebnis-Auszug)
- Vercel Web Analytics: Filtern durch Klick auf eine Zeile in einem Panel, Filter kombinierbar. – [Vercel Docs: Filtering Analytics](https://vercel.com/docs/analytics/filtering) (nur Suchergebnis-Auszug)
- Linear, standardmäßig Verborgenes mit benanntem Schalter: „Project issue views hide issues in Triage by default.“, sichtbar über „Show triage issues“; leere Gruppen nur mit dem Schalter („When toggled on, this setting shows groups with no issues.“); Unterscheidung „filters will refine the list“ vs. Display options, die „show all issues in the list but hide or show data“. – [Linear Docs: Display options](https://linear.app/docs/display-options) (verifiziert)
- Stripe: „The banner at the top of the Dashboard indicates that you're in a sandbox.“ Ohne Banner soll man von Live-Daten ausgehen. – [Stripe Docs: Manage sandboxes](https://docs.stripe.com/sandboxes/dashboard/manage) (aus Suchergebnis-Auszug; Wortlaut des Banners nicht belegt)
- Datadog Error Tracking: Warnung, dass ein Issue, das zuerst in `env:staging` und eine Woche später erstmals in `env:prod` auftritt, als alt gilt (betrifft „New Issue“-Alarme). – [Datadog Docs: Error Tracking Monitor](https://docs.datadoghq.com/monitors/types/error_tracking/) (nur Suchergebnis-Auszug)

### Inferences
- Sentry löst genau den Widerspruch „Last seen today, aber 0 Läufe“: Der sichtbare Zeitstempel folgt dem Filter; der ungefilterte steht im Hovercard mit eigenem Namen. Übertragen: „Last seen“ im Non-branded-Umfang = „N/A“ (bzw. „Not seen in non-branded prompts“), Hovercard: „All prompts: today“ / „Non-branded: N/A“.
- Die drei Zählungen von Sentry („Matching filters“ / „Total in …“ / „Since issue began“) sind ein fertiges Vokabular für Ebene (1): 0 als Hauptzahl, 1 als Nebenzahl, beide benannt, statt einer 0 neben einem First-cited-Datum, das ohne Filter berechnet ist.
- Datadogs Warnung zeigt dieselbe Falle in die andere Richtung: ein „first seen“ ohne Umfang erzeugt Fehlurteile. Für upstreem: jedes Datum muss im selben Umfang wie die Zahlen daneben berechnet sein oder seinen Umfang nennen.
- Vercel und Linear geben dem Standard einen sichtbaren Namen am Ort der Daten („Production“, „Show triage issues“). Ein Standardfilter ohne Steuerelement im Blickfeld ist bei keinem der Produkte zu finden.

### Gaps
- Datadog: Anzeige von Standard-Template-Variablen und Exclusion-Filtern im UI nicht recherchiert.
- Stripe: genauer Banner-Text („Test mode“/„Sandbox“) nicht belegt; ob Stripe-Listen gefilterte Zählungen kennzeichnen, nicht recherchiert.
- Vercel Observability/Logs: Darstellung aktiver Filter (Chips) nicht aus Doku belegt.
- Linear: kein Beleg für eine Fußzeile der Art „N hidden“ gefunden.

---

## 5. Designsysteme: Geist, Atlassian, Polaris, Carbon, Material

### Takeaway
Geist liefert beides, was upstreem braucht: einen Leerzustand für „gefiltert, null Zeilen“ mit festem Satzmuster und den Baustein **Note** für einen bleibenden, nicht wegklickbaren Hinweis in einem Satz. Carbon verlangt einen sichtbaren Hinweis auf angewandte Filter im geschlossenen Zustand, samt Zahl und Zurücksetzen.

### Cited Findings
- Geist Empty State: Varianten „Blank Slate“, „Informational“, „Educational“, „Guide“; für „a filtered list that returned zero rows“ die No-results-Variante. Satzmuster bei einer Suche: `No logs match “${query}”. Clear the filter to see all logs.`; bei mehreren Filtern Titel „No {Items} Match Your Filters“, Beispiel „No Logs Match Your Filter“; danach Filter erweitern oder leeren vorschlagen. Nach asynchronem Filterwechsel `aria-live="polite"`. Knöpfe in Title Case, Verb + Nomen; vermeiden: „Get Started“, „Continue“, „OK“. – [Geist: Empty State](https://vercel.com/geist/empty-state) (verifiziert)
- Geist Note: „Display text that requires attention or provides additional information“, für Hinweise neben Feld, Karte oder Abschnitt. Varianten: Standard (Info-Zeichen), `secondary`, `success`, `error`, `warning`, `violet`, `cyan` (kein `info`). Regeln: Notes bleiben, bis sich der Zustand ändert, **kein Schließen-Knopf**; eine Note je Thema; `NoteAction` mit genau einer Aktion; `NoteLabel` 1–2 Wörter Title Case (Beispiel „Region Change:“); `NoteContent` ein aktiver Satz. Seitenweite Meldungen: `Banner`; flüchtige: `Toast`. – [Geist: Note](https://vercel.com/geist/note) (verifiziert)
- Carbon Filtering: Sind Filter in Drawer/Dropdown/Menü verborgen, „there should be an indicator visible on the closed filter state that informs the user that filters have been applied“; mindestens „the number of filters applied“ und die Möglichkeit „to clear filters without re-opening the filter container“. Zurücksetzen „returns the filters to their original default starting state.“ Startzustand je Kategorie „all unselected“ oder „all selected“. – [Carbon: Filtering pattern](https://carbondesignsystem.com/patterns/filtering/) (verifiziert)
- Atlassian Empty State: ein „general no-result state (such as no search results) might be more neutral, but still motivate by showing next steps“; „Consider all scenarios that could cause the empty state to occur, and use that to inform the tone of your writing.“; kurze Aufforderungen mit „Try, Remove, or Create“. – [Atlassian Design: Empty state usage](https://atlassian.design/components/empty-state/usage) (verifiziert)

### Inferences
- Geist Note (Variante `secondary` oder Standard, Größe `small`) ist der passende Baustein für Ebene (2) und (4): ein Satz, ein Label, eine Aktion, bleibt stehen, solange der Filter wirkt. Beispiel im Geist-Muster: Label „Filtered:“, Text „This URL was only cited by branded prompts, which are excluded.“, Aktion „Include Branded“.
- Das Geist-Satzmuster für gefilterte Leerzustände („Clear the filter to see all …“) lässt sich auf die leere Läufe-Liste übertragen. Wichtig: bei einem **Standard**filter heißt die Aktion nicht „Clear“, sondern zeigt das Einschließen an, weil „Clear“ beim Zurücksetzen nach Carbon wieder auf den Standard führt, also auf den Ausschluss.
- Carbon „Indikator im geschlossenen Zustand“ ist die Mindestform für Ebene (a): der Standardfilter muss sichtbar sein, auch wenn niemand das Filtermenü öffnet.

### Gaps
- Polaris (IndexFilters, EmptySearchResult) nicht abrufbar: Seiten auf polaris.shopify.com leiten inzwischen auf shopify.dev um, polaris-react.shopify.com brach ab. Kein Wortlaut belegt.
- Material 3 (Filter Chips) nicht abgerufen.
- Geist Badge und Tooltip nicht eigens abgerufen.

---

## 6. Forschung: übersehene Filter, Standardwerte, „null“ vs. „keine Daten“

### Takeaway
Belegt ist: Nutzer, die einen einzigen aktiven Filter übersehen, deuten die Ergebnismenge falsch (Baymard), leere gefilterte Ansichten lösen Zweifel an System, Ladezustand und Filtern aus (NN/g), und Standardwerte werden meist nicht geändert (NN/g). Eine Studie speziell zu **vorbelegten Standardfiltern** in Analysewerkzeugen wurde nicht gefunden.

### Cited Findings
- Baymard, „Display 'Applied Filters' in an Overview (28% Don't)“ (06.10.2020, aktualisiert 13.05.2026): „28% of sites across our UX benchmarks don't display an overview at all.“; „users who overlooked even a single applied filter were likely to misinterpret both the type and range of products“; vergessene Filter ließen Nutzer glauben, das Sortiment habe nichts Passendes. Schlecht getestet: nur die **Anzahl** angewandter Filter anzeigen. Empfohlen: Übersicht über der Liste, über der Seitenleiste oder unter einer waagerechten Filterleiste. – [Baymard](https://baymard.com/blog/how-to-design-applied-filters) (verifiziert)
- NN/g, „Designing Empty States in Complex Applications: 3 Guidelines“ (Kate Kaplan, 19.09.2021): komplett leere Zustände „cause confusion about how and whether the system is working“; nach Filtern fragen Nutzer „Is the system finished processing the request?“, „Is content still loading?“, „Did an error occur?“, „Did I set the wrong filters or parameters?“; Beispieltext „There are no records to display for the selected date range.“; „No records“ nie während des Ladens zeigen. – [NN/g](https://www.nngroup.com/articles/empty-state-interface-design/) (verifiziert)
- NN/g „The Power of Defaults“: Designer sollen annehmen, dass Nutzer Standardwerte nicht ändern. – [NN/g](https://www.nngroup.com/articles/the-power-of-defaults/) (nur Suchergebnis-Auszug; Datum nicht geprüft)
- UK DWP Design System, Filter (zuletzt aktualisiert 30.01.2026): „The user should not have to remember what they have done to produce the current view.“; Zustand „should be shown near filtered results“; „It is common practice to have a Clear all function which resets the view to its default unfiltered state.“ Ausdrücklich als Konventionen, nicht als Studienergebnis. – [DWP Design System: Filters research summary](https://design-system.dwp.gov.uk/research/filters/summary) (verifiziert)
- Fallbericht aus der Praxis: Endnutzer können nicht erkennen, welche Standardfilter auf einer Karte liegen („There is no way for an end-user to know what default filters have been applied to a card/module.“). – [Anaplan Community](https://community.anaplan.com/discussion/158721/nux-allow-users-to-filter-using-other-modules-and-see-remove-applied-filters) (Suchergebnis-Auszug, Einzelstimme)

### Inferences
- Baymards Befund wiegt für upstreem schwerer als im Shop: dort stellt der Nutzer den Filter selbst ein und vergisst ihn; bei upstreem hat er ihn nie gesetzt, also gibt es nichts zu erinnern. Das Risiko der Fehldeutung ist mindestens so hoch.
- „Nur eine Zahl angewandter Filter“ ist laut Baymard zu wenig. Ein Chip „Non-branded prompts“ mit Namen ist besser als ein Zähler „1 filter“.
- NN/gs Liste der Nutzerzweifel deckt die Rückmeldung „wirkt kaputt“ genau ab: ohne Grund für die Leere liest man Fehler.

### Gaps
- Keine Studie zu stets aktiven Standardfiltern in B2B-Analysewerkzeugen gefunden.
- NN/g-Artikel speziell zu Filtern in Tabellen/Dashboards nicht abgerufen; „The Power of Defaults“ nur als Auszug.

---

## 7. Abgeleitete Muster je Problemklasse (a)–(f), angewandt auf den upstreem-Fall

### Takeaway
Alle belegten Vorbilder folgen zwei Regeln: (1) jeder Wert auf einer Fläche, einschließlich Datumsangaben, ist im **selben Umfang** berechnet oder nennt seinen abweichenden Umfang; (2) der Standardumfang hat einen **sichtbaren Namen** am Ort der Daten und einen Weg, ihn zu erweitern. Im upstreem-Fall verletzen Ebene 1 und 2 Regel 1, Ebene 3 verletzt Regel 1 in der Gegenrichtung, Ebene 4 und alle Ebenen verletzen Regel 2.

### Cited Findings
- (a) Standardumfang sichtbar: Vercel „Production is selected by default“ im Wähler oben rechts – [Vercel](https://vercel.com/docs/analytics/using-web-analytics); GA4 Chip „All users“ – [GA4](https://support.google.com/analytics/answer/9269518?hl=en); PostHog Schalter „Filter out internal and test users“ je Insight – [PostHog](https://posthog.com/docs/data/test-accounts); Carbon Indikator im geschlossenen Zustand – [Carbon](https://carbondesignsystem.com/patterns/filtering/) (alle verifiziert)
- (b) gefiltert vs. ungefiltert benannt: Sentry „Matching filters“ / „Total in %s“ / „Since issue began“ – [Sentry group.tsx](https://raw.githubusercontent.com/getsentry/sentry/master/static/app/components/stream/group.tsx); Sentry-Doku „This differs from the counts in the header, which show total counts across the issue's lifetime.“ – [Sentry Docs](https://docs.sentry.io/product/issues/issue-details/) (verifiziert)
- (c)/(d) Wert nur außerhalb des Umfangs: Sentry `"Any Environment"` neben der gewählten Umgebung, `"N/A for %s"` – [Sentry seenInfo.tsx](https://raw.githubusercontent.com/getsentry/sentry/master/static/app/components/group/seenInfo.tsx); GA4 warnt auch ohne sichtbare Zeile – [GA4 (other)](https://support.google.com/analytics/answer/13331684) (verifiziert)
- (e) gefilterter Leerzustand: Geist „No {Items} Match Your Filters“, „Clear the filter to see all logs.“ – [Geist](https://vercel.com/geist/empty-state); NN/g Zweifel bei leerer Filteransicht – [NN/g](https://www.nngroup.com/articles/empty-state-interface-design/) (verifiziert)
- (f) Summen ohne Deckung: GSC erklärt nur in Doku/Blog – [Google Search Central Blog 2022](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive); Nutzer melden es als Fehler – [Google Developer forums](https://discuss.google.dev/t/filters-on-gsc-query-dont-add-back-up-to-total-i-e-branded-and-non-branded-queries-dont-add/291116) (Titel aus Suchergebnis)

### Inferences
- **Ebene (a), alle Seiten:** In der einen Leiste (links, bei den Datenfiltern) ein dauerhafter Chip „Non-branded prompts“ im Stil eines Standardwerts (nicht wie ein nutzergesetzter Filter, kein X, das auf „nichts“ zurücksetzt). Klick öffnet Erklärung plus Schalter „Include branded prompts“. Vorbild Vercel-Umgebungswähler und PostHog-Schalter. Nur ein Zähler („1 filter“) reicht laut Baymard nicht.
- **Ebene (1), Tabelle Cited URLs:** Entweder „First cited“ im selben Umfang berechnen (dann „–“ statt heute) oder die Zahl nach Sentry doppelt führen: Hauptwert 0, Nebenwert „+1 branded“ bzw. im Tooltip „Non-branded: 0“ / „All prompts: 1“. Ein Datum ohne Umfang neben einer gefilterten Zahl ist das Kernproblem.
- **Ebene (2), URL-Detail:** Sentry-Muster für Last/First seen: Anzeige im Umfang („N/A“ bzw. „Not seen in non-branded prompts“), Hovercard mit zwei Zeilen „All prompts“ / „Non-branded“. Darüber eine Geist Note ohne Schließen: Label „Filtered:“, ein Satz, eine Aktion „Include Branded“. Leere Läufe-Liste als gefilterter Leerzustand nach Geist, nicht als Ruhe-Leerzustand („No runs match your filter“ plus Aktion, die die Branded-Läufe einblendet).
- **Ebene (3), Sitemap:** Der einzige Ort, der den Filter ignoriert. Nach Regel 1 entweder ebenfalls filtern oder den Umfang an der Zahl nennen („incl. branded“), sonst widerspricht er allen anderen Flächen. Welcher Weg, ist eine Produktentscheidung; belegt ist nur, dass unbenannte Umfangswechsel als Fehler gelesen werden (GSC-Forum, Baymard).
- **Ebene (4), Domain › URLs:** Nach GA4/Linear-Muster eine Fußzeile oder Note „1 URL only cited by branded prompts“ mit „Show“, statt stillem Fehlen.
- **(f) Summen:** Weicht eine Gesamtzahl von der Summe der sichtbaren Zeilen ab, steht der Grund an der Gesamtzahl (Tooltip oder Fußnote), nicht nur in einer Hilfeseite; GSC zeigt die Folgen des Gegenteils.
- Begriffe: Sentry benennt Umfang immer positiv („Matching filters“, „Any Environment“). Für upstreem lesen sich „Non-branded“ / „All prompts“ als Paar klarer als „excluded“ allein.

### Gaps
- Keine Quelle gefunden, die einen **stets aktiven, vom Hersteller gesetzten** Inhaltsfilter (nicht Umgebung, nicht Testnutzer) in einem Analysewerkzeug so kennzeichnet; die Übertragung von Umgebungs- und Testnutzer-Mustern ist Ableitung.
- Ob ein Chip ohne X (nicht entfernbar, nur umschaltbar) von Nutzern als Filter erkannt wird, ist nicht durch Studien belegt.
