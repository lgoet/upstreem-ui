# upstreem-ui — Pflichtlektüre vor jeder Änderung

Diese Datei wird in jeden Kontext geladen. Der STYLEGUIDE (2595 Zeilen) wird es nicht — er ist
Nachschlagewerk, diese Datei ist die Arbeitsanweisung. Wenn beide sich widersprechen, gilt diese.

---

## 0. Der Ablauf, ohne Ausnahme

**Vor** dem Schreiben von CSS oder Markup:

```bash
python3 .core_parts.py <stichwort>      # z.B. sentiment, switcher, tabelle, suche, trend
```

Das liefert die vorhandenen Bauteile mit ihren Maßen. Kommt ein Treffer: **verwenden**, nicht
nachbauen und nicht überschreiben. Kommt keiner: dann ist es wirklich neu.

**Vor** jedem Commit:

```bash
python3 .scan_comments.py               # §28: kein */ in CSS-Kommentaren
python3 .check_reinvention.py           # Nachbauten und gesprengte Bauteile
python3 .check_skala.py                 # Maße außerhalb der Skala (seit 21.09.)
```

Alle drei müssen sauber sein. `.check_reinvention.py` meldet Verdachtsfälle, keine Gewissheiten —
jeden Treffer entweder beheben oder mit einem Satz begründen, warum er hier richtig ist.

---

## 1. Core-Bauteile: verwenden oder ganz lassen

Es gibt **249** `.up-*`/`.vc-*`-Klassen. Ein Bauteil ist ein Paket aus Geometrie: Höhe, Polsterung,
Radius, Abstände, Schriftgröße. Wer einen Wert daraus ändert, muss **alle** im selben Verhältnis
mitziehen.

Der Fehler, der sich in dieser Sitzung dreimal wiederholt hat:

```css
/* FALSCH — sprengt die Pille: 15px Text in 24px Höhe stößt an den Rahmen */
.xyz-kpi .up-planpill .up-sent-val { font-size: 15px; }

/* RICHTIG — Faktor 15/13 auf alles */
.xyz-kpi .up-planpill              { height: 28px; padding: 0 7px; border-radius: 7px; gap: 7px; }
.xyz-kpi .up-planpill .up-sent-val { font-size: 15px; }
.xyz-kpi .up-planpill .up-sent-dot { width: 7px; height: 7px; border-radius: 2.5px; }
```

Das Beispiel ist älter als die Skalen (§1c). Heute gilt: erst mit dem Faktor rechnen, dann jede
Größe auf ihre Stufe runden – hier Schrift 16 (`--up-fs-xl`) statt 15, Radius nicht mitgerechnet,
sondern nach Rolle (28 hoch → 6, `var(--up-r-m)`).

Sentiment selbst hat seit dem 29.09. **keinen** Kasten mehr: Balken 3×12 plus Zahl in der Schrift
von `.up-num`, Markup nur aus `UC.sentHtml(v)`. Dort zieht ein Kontext nur die Schrift der Zahl mit.

**Markup in core heißt nicht, dass das Bauteil geteilt ist.** Prüfen, ob die CSS auch in `core.css`
steht — sonst kommen die Zeilen mit den richtigen Klassen heraus, für die es keine Regeln gibt.

**`.up-row` ist ein GRID** mit `grid-template-columns: var(--up-cols)`, kein Flex. Eine Tabelle ohne
dieses Raster braucht eine eigene `display: flex`-Regel, sonst erbt sie die Spalten der zuletzt
definierten Tabelle.

Konflikte über **Spezifität** lösen, nie über Ladereihenfolge (`.up-vartable .up-row.up-vrow`, nicht
`.up-vrow`). Kein `!important`. Farben nur aus `--vc-*`.

---

## 1b. Neue Komponenten: das Rezept (Stand 18.08., domain-detail)

So lief der Bau von domain-detail in einem Durchgang durch — dieselbe Reihenfolge bei jeder
neuen Komponente:

1. **Vorbild benennen, Werte übernehmen.** Erst `.core_parts.py`, dann die nächstverwandte
   Komponente lesen (hier brand-detail) und deren Maße 1:1 übernehmen — dieselben Zahlen, nicht
   ähnliche. Was das Vorbild aus core holt, holt die neue Komponente aus core.
2. **Geteiltes sofort nach core.** Was es schon fast gibt, wird VOR dem Bau zum Kit-Baustein
   (hier: makeBarList aus dem Balkenmodus von makeTypeChart — gleiche CSS, gleiches Markup).
   Lokal bleibt nur, was es wirklich genau einmal gibt (der Funnel).
3. **Die Beispieldaten des Nutzers unverändert verwenden** — als Harness-Daten UND als
   wortgleicher Run-JS-Schritt, der selbst gegen die fertige Komponente getestet wird. Keine
   erfundenen Testdaten; die Demo-Daten gehören in den Workflow-Schritt, nicht in die Vorlage.
4. **Nicht nur den Gutfall messen.** Dunkel, is-narrow/is-vnarrow (Klassen von Hand setzen, wenn
   der ResizeObserver im verdeckten Tab schweigt), Ladezustand, Reset, alle Events mit Payload,
   kaputte Payloads. Jede Behauptung in der Übergabe hat einen Messwert.
5. **Farben ableiten statt erfinden.** Neue Skalen entstehen aus den bestehenden (hier: Familie
   um die Zitationstyp-Farbe, Helligkeit/Sättigung gestaffelt, gegenläufig je Thema).
6. Von Anfang an: makeLate für frühe Aufrufe, Warte-Uhr mit benanntem Ende, parseLoose mit
   Fehlerzustand vor dem Skelett, themeParam statt data-isdark roh.

## 1c. Die Skalen: Maße kommen aus core.css, nicht aus dem Kopf

Seit dem 21.09. stehen in `core.css` an `.up-root` **27 Maß-Token** neben den Farben. Vorher gab
es für Schriftgröße, Radius, Höhe, Dauer und Tiefe keine gemeinsame Quelle — jede dieser
Entscheidungen wurde in jeder der 43 Dateien neu getroffen. Gemessen kamen dabei **34
Schriftgrößen** und **57 Radien** heraus, wo sechs und fünf gemeint waren.

| | Skala | Token | gegengeprüft an |
|---|---|---|---|
| Schriftgröße | 11 · 12 · 13 · 14 · 16 · 22 · 28 | `--up-fs-xs/s/m/l/xl/2xl/3xl` | Polaris (8 Stufen), EightShapes, Dashboard-Ratgeber (6) |
| Schnitt | **Bereich** 400–700 | `--up-fw-n/m/h/b` | der geladenen Achse in `core.css` |
| Radius (seit 15.10.) | 4 · 6 · 8 · 12 · 16 · 999 **plus konzentrische Kinder** | `--up-r-xs/s` 4, `-m` 6, `-l/xl` 8, `-2xl` 12, `-3xl` 16, `-voll` | Geist materials (vercel.com/geist), Konzentrik-Formel |
| Höhe | 24 · 28 · 32 · 40 · 55 | `--up-h-chip/seg/btn/gross/row` | Primer, identisch (24/28/32/40/48) |
| Dauer | 120 · 200 · 260 | `--up-t-1/2/3` | Material 3 (UI-Band 100–300) |
| Kurve | 2 | `--up-ease`, `--up-ease-auf` | — |
| Tiefe (seit 15.10.) | 4 + 2 benannte | `--up-e-1..4`, `--up-e-drawer`, `--up-e-chip` | Werte aus Vercels `--ds-shadow-*`; Rollen gegen Atlassian (sunken/default/raised/overlay) |

**Die Skalen kommen aus DEINEM Bestand, nicht von außen.** Jede Stufe ist die, die die App
ohnehin am häufigsten trägt; die Fachsysteme oben waren die Gegenprobe, nicht die Vorlage. Zwei
Korrekturen sind dabei herausgekommen, beide wichtig:

- **28px gehört auf die Skala.** Die erste Fassung endete bei 22 und hätte `.up-ph-heading`
  (`core.css:3601`, der Kopf **aller sieben** Seiten) auf Dialogtitelgröße gedrückt. Die
  Hierarchie war da — sie war nur je Stufe uneinheitlich (Titel als 20/22/23/23.5, Kennzahlen als
  21/22/23). Das ist etwas anderes, als keine zu haben.
- **Kein modulares Verhältnis.** Ein Faktor wie 1.2 erzeugt bei dieser Dichte Bruchteile
  (13.2, 15.8), die je Browser anders runden — genau daher kommen die 216 halben Pixel im
  Bestand. Die Stufen sind von Hand gesetzt.

Was man dabei wissen muss:

- **Konzentrische Radien sind kein Fehler.** Ein Element mit 1px Rahmen in einer 6er-Ecke
  braucht innen 5, sonst läuft der Spalt zwischen beiden Rundungen ungleich breit; die Kinder
  der Stufen sind also 3/5/7/11/15. Am 21.09. lagen von 763 Radiusangaben 185 genau dort.
  Geschrieben wird das Kind seit dem 15.10. aus dem Token: `calc(var(--up-r-m) - 1px)`, das
  Bild im Logo-Stapel (Rahmen 1 + Polster 2) `calc(var(--up-r-m) - 3px)`. `.check_skala.py`
  lässt Basis minus 1 durch.

- **Radius nach Rolle (Geist, 15.10.).** Knopf, Feld, Segment und Zeile nach ihrer Höhe: bis 24
  → 4, 25–36 → 6, ab 37 → 8. Menü 12, die Zeile darin konzentrisch. Karte, Tabelle, Dialog,
  Toast, Erklärkarte 12, ihre Kinder 11. Tooltip einzeilig 6, mehrzeilig 8. Badge und Avatar
  (Person) voll rund. Marken- und Citation-Chips (`.up-stack`) sind **Logoplatten, keine
  Avatare**: 28 hoch → 6, das Bild 3 (am 15.10. kurz Geist-Kreise, am 16.10. auf Wunsch zurück:
  „Die eckigen.“). Seit dem Umbau laufen 811 von 963 Angaben über ein Token; fest stehen nur noch 0,
  50 %, Haarlinien unter 4 und die em-Werte in Mira. **Alte Zahlen in Kommentaren** (vor dem
  15.10.) meinen die alte Skala; die Zuordnung steht im Radius-Block von `core.css`.

- **Der Schnitt ist ein Bereich, keine Liste.** Geist wird als *variable* Schrift geladen
  (`@import … wght@400..700`), also rendert auch 450 oder 550 wirklich — an 37 Stellen ist genau
  das gewollt. Falsch ist nur, was **außerhalb** von 400–700 liegt: das wird still auf den Rand
  gezogen. So sind am 21.09. 15 Stellen aufgefallen, die wie 600 aussahen, obwohl 650, 700 oder
  750 dastand — zwei davon hatten sogar zwei Stufen gebaut, die beide als 600 herauskamen.
- **Verschachtelte Radien werden gerechnet, dann gerundet:** innen = außen − Innenabstand, danach
  auf die nächste Stufe. Ohne das Runden erzeugt die Regel aus §1 („Faktor auf alles") genau die
  `3.23`, `4.28`, `7.04` und `8.9`, die bis zum 15.10. im Bestand standen.
- **Ausnahmen, die bleiben:** `--up-dd-pad`, `--up-dd-gap`, `--up-sub-gap`, `--up-focus-w`. Die
  gab es vorher und sie sind in sich stimmig. `--up-dd-radius` ist seit dem 15.10. **keine**
  Ausnahme mehr: 12 wie `--up-r-2xl`, und es steht auch an `:root`, weil Menüs von Mira und der
  Fader am `<body>` hängen (ein unaufgelöstes `var()` in `border-radius` ist eine scharfe Ecke).

- **Tiefe nach Rolle, nicht nach Auge** (Stand 06.10.): `e-1` liegt auf der Fläche (Knopf,
  Feld, Kachel), `e-2` hängt an einem Auslöser (Menü, Popover, jeder Tooltip, Erklärkarte),
  `e-3` schwebt frei über dem Inhalt (Auswahlleiste, schwebender Knopf, freier Kasten), `e-4` liegt über einem Schleier
  (Dialog, Palette, Toast); dazu `e-drawer` (wirft seitlich) und `e-chip` (gehobener Chip). Die
  umgekehrte Karte (hell dunkel, dunkel hell) trägt `--vc-inverse-bg`/`--vc-inverse-ink`. Alle
  stehen auch an `:root` und erreichen damit, was an `<body>` hängt. `--up-dd-shadow` ist e-2.
  Seit dem 15.10. sind die Werte Geists eigene (small, menu, modal, modal-elevated; e-chip =
  medium; e-drawer = modal-elevated um 90° gedreht), mehrlagig und leise. Im Dunkeln werden nur
  e-1 und e-chip kräftiger, die Kante tragen dort die Rahmen. Kein Rückfallwert in
  `var(--up-e-*, …)`: der hielte beim nächsten Wechsel der Werte die alte Fassung fest.

`.check_skala.py` hält das. Es arbeitet mit einer **Grundlinie** (`.skala_grundlinie.json`): was
am Einführungstag schon dastand, ist als Bestand vermerkt und blockiert nie einen Commit —
gemeldet wird nur, was **dazukommt**. Ein Prüfer, der am ersten Tag tausend Treffer meldet, wird
weggeklickt. Der Bestand (Stand 21.09.: **1295** Angaben — 673 Farbliterale, 318 Schriftgrößen,
268 Dauern, 65 Radien) wird abgebaut, wenn eine Datei ohnehin angefasst wird; Stand 15.10.:
**900** (444 Farbliterale, 192 Schriftgrößen, 257 Dauern, 7 Radien); Stand 17.10.: **436**
(0 Farbliterale, 183 Schriftgrößen, 246 Dauern, 7 Radien). Nach dem Aufräumen
einer Datei: `python3 .check_skala.py --grundlinie`.

**Farben stehen nur noch in `core.css` (seit 17.10.).** Auf Wunsch („alles, was wir an Farben
nutzen, nach core“) tragen die Komponenten keinen Farbwert mehr: jede Farbe ist ein Token in
einem der Blöcke „Komponentenfarben: …“ am Ende der beiden Themenblöcke
(`:root, .up-root, [data-theme="light"]` und `[data-theme="dark"], .up-root[data-theme="dark"]`),
damit sie auch Flächen am `<body>` erreichen. Umgezogen ohne sichtbare Änderung, gemessen über
rund 3,5 Mio. berechnete Farbwerte in vier Themen. Eine neue Farbe ist ein neues Token dort, nie
ein Literal in der Komponente – `.check_skala.py` meldet jedes neue. JS setzt Farben als
`var(--vc-…)` oder liest sie per `getComputedStyle`. Bewusst ausgenommen: Masken (Deckkraft, keine
Themenfarbe), gespeicherte Daten (Markenfarben im Brand Editor, Coloris-Vorschläge), Demodaten
(`events-demo.js`), Kommentare. Bubble-Vorlagen in `bubble/` ziehen mit (sonst bringt ein neuer
Lauf der `.…_markup.py`-Skripte die Literale zurück).

Er erkennt auch, wenn ein bekannter Wert nur **häufiger** wird: eine 16. Angabe auf `12.5px` in
einer Datei mit 15 im Bestand fällt auf ("Bestand war 15").

Ausgenommen sind `vendor-coloris.min.css` (Fremdcode) und `landing-hero.css` — eine Landingpage
ist kein Dashboard und verträgt eine größere Spreizung; 38px Überschrift ist dort richtig und in
der App falsch. Ebenso gehen **`clamp()` und `calc()` durch**: in `clamp()` stehen neun
Überschriften ganzseitiger Flächen (auth-page, onboarding, ask-mira, prompt-research), die mit
dem Fenster mitwachsen sollen — dieselbe Überlegung; `calc()` rechnet meist aus einem Token und
ist damit schon auf der Skala.

## 1d. Stand 15.10.: Geist und die Tabellenbausteine

Am 14. und 15.10. ist das Aussehen der App an vielen Stellen neu festgelegt worden. Vorlage für
Ecken, Schatten, Farben, Skelett, Leerzustand, Command Menu, Suchfeld, Knopf-Hover, Slider
und Badge ist **Geist** (vercel.com/geist). Wer davon etwas baut, schaut dort
nach, nicht im Bestand. **Ausnahme:** der Logo-Stapel (Marken-/Citation-Chips) ist seit dem
16.10. wieder die alte Reihe eckiger Logoplatten, nicht Geists Avatar-Gruppe (STYLEGUIDE §17). Die Einzelheiten stehen im STYLEGUIDE; hier steht, was man vorher wissen
muss.

| Thema | Regel | Wo |
|---|---|---|
| Thema | Nur **Light, Dark, System**. „Hell klassisch“/Legacy Light gibt es nicht mehr. Light ist wie bei Vercel: Seite, Seitenleiste und Leisten grau, Tabellen, Inhalte und Charts weiß. Seit 17.10. trägt im grauen Hell auch `<html>` die leise Fläche (`--vc-heading-bg: var(--up-leise-grau)`, #f2f2f2 statt #f9f8f9) | `html[data-up-hell="grau"]` aus `hellAnwenden()`, `UC.themeSchalterHtml` |
| Auswahl | Gewählte Zustände im Light `#ededed` (Geists Seitennavigation). Seitenleiste **ohne** Rand, Sub-Navigation, Preferences und gedrückte Knöpfe mit einem Hauch Rand (3 %) | `--up-wahl-bg`, `--up-wahl-rand` |
| Knopf-Hover | Nur die Fläche ändert sich, der Rand bleibt; Fokus 2px-Outline mit 2px Abstand | `--up-knopf-hover`, `--up-knopf-rand-hover`, `--up-knopf-fokus-abstand` |
| Drawer-Schleier (16.10.) | Schwarz zu 20 %, **hell und dunkel gleich**, Unschärfe 1.5px; nie aus `--vc-text`/`--vc-text-invert` mischen (das hellte im Dunkeln die Seite auf). Dialoge behalten `.30`/`.35` | `--vc-drawer-schleier` |
| Suchfeld | Geist-Search-Input in **unserem** Blau; Esc-Schild; erstes Escape leert, zweites schließt | `.up-search` |
| Langer Text zum Lesen (22.10.) | Quelltext oder anderer langer Text: **Drawer aus core** (`KERN_DRAWER`, Vorbild `initialhtml` in page-audit.js), nie ein Popup (höchstens 560 breit). Fremder Text nur escaped, nie als HTML, kein iframe. Große Texte in Blöcken, nur die im Bild gefüllt (5 MiB gemessen ohne lange Aufgabe). Suche mit Schritten: `.up-hl` + `.is-aktiv`, Zähler „x of n“, STYLEGUIDE §16 | `UC.kernDrawer`, `.up-hl.is-aktiv`, `--vc-treffer-aktiv` |
| Command Menu | Geist-Aufbau, aber **ohne Linie unter dem Suchfeld** (ausdrücklicher Wunsch) | `quick-actions.css` |
| Zahlen in Zellen | Rechtsbündig in fester Spur, der Trend (seit 17.10.) **direkt vor dem Wert** in einem festen Platz von 66px (rechtsbündig darin, fehlt er, bleibt der Platz leer: der Wert steht auf demselben Pixel); Rang-„#“ und Sentiment-Balken bleiben mit 4/6 an der Zahl. **Kopf einer Zahlenspalte rechtsbündig, Sortierzeichen links vom Text** (`.up-th-zahl`, von `zahlSpalten` in core nach dem Zelleninhalt gesetzt, keine Namensliste); Text- und Datumsspalten links | `--up-spur-*`, `--up-spur-abstand` (12), `--up-spur-trend` (66), `.up-th-zahl`, STYLEGUIDE 8c |
| Spaltenbreite | Flach wächst jede fr-Spalte höchstens bis min + 32; am Ende wächst nur die erste | `deckeln()` in makeColumns |
| Spalten-Menü (20.10.) | **Chip-Form für JEDE Tabelle** (`makeColumns`, `cfg.form !== "rows"`): Kopf "Columns" mit Select all, Spalten als Chips, die Zeilenhöhe als Feld darüber (`rowHeightSwitch` oder `dense`). Die Lanes in Opportunities sind dieselbe Form. Die Zeilenform nur noch mit `form: "rows"` | `UC.makeColumns`, `.up-spaltchips` |
| Werkzeugleiste (20.10.) | Sie klappt nirgends mehr ein oder auf: alle Knöpfe stehen immer da. `UC.makeToolGroup` liefert nur noch die leere Fassung (Rest samt `.is-tools-*`-CSS ist tot und kann entfernt werden) | `makeToolGroup` in core.js |
| Shopping und Ads: die eine Leiste (20.10.) | Auf Products, Brands, Merchants (Shopping) und Advertisers, Ad Library (Ads) ist der Kopf der Tabelle die Leiste der Seite, **Vorbild Brands und Citations (Variante A)**: links Kalender und Filter (die Filterzeile wandert in `.up-leiste-scope`, in der Library davor der Umschalter Ads/Prompts), rechts Grid/List, Suche, Table Settings, **Export als letzter**. Sie klebt, der Spaltenkopf direkt darunter, Gesamtzeile und Pagination unten (`data-kleb-fuss`); Brands und Merchants tragen Kennzahlen und Chart zwischen Leiste und Tabelle (`UC.bandUnterLeiste`). Das Geruest wird je Reiter neu gebaut, darum geht die Filterzeile vorher zurueck (`filterzeileZurueck`). Shopping hat im Seitenkopf den Umschalter Chart und Tabelle (`UC.bandAus`, ein Schalter fuer die Seite: Linie der Overview und Brands, Balken der Merchants; Products ohne). Die Balken der Merchants zeigen hoechstens 10 (`ME_BALKEN`) | `leisteStellen`, `filterzeileZurueck`, `bandSchalten` in `shopping.js`; `leisteStellen` in `ads.js`; `.ush-filterzeile.is-in-tabelle`, `.uad-filterzeile.is-in-tabelle` |
| Scrollkasten klebt (20.10.) | Shopping und Ads scrollen waagerecht (`.up-colscroll`, `cfg.scrollen`) -- ein Scrollkasten ist in beiden Achsen ein Scroller, Kopf und Gesamtzeile darin klebten nie an der Seite. `UC.colscrollTeilen(box)` hebt sie in Halter (`.up-cs-kopf` oben, `.up-cs-fuss` unten) im selben `.up-box`; sie kleben als Ganzes, das Innere faehrt per `--up-cs-x` mit dem Kasten (kein eigener Scroller, `overflow: clip`). Nach jedem Zeichnen der Tabelle und nach `makeZaehlZeile` aufrufen, danach `applySticky()` der Leiste (der Kasten wechselt je Zeichnen, `fussKastenHolen` in core folgt ihm). Die Tabelle steht in einer eigenen `.up-root` (`.ush-tabwurzel`, `.uad-tabwurzel`): dort `--up-sticky-top`/`--up-thead-off` auf `inherit`, sonst klebt der Kopf bei 204. Die Kartenansicht der Library (`.up-adgrid`) klebt nur die Pagination | `UC.colscrollTeilen`, `fussKastenVon`, `.up-cs-kopf`, `.up-cs-fuss` in core |
| Gesamtzeile: Minus statt toter Knopf (20.10.) | Eine Spalte ohne Berechnung zeigt ein **Minus** (`.up-sumkeine`, Tooltip "No calculation for this column"), nie den Text "+ Calculation" ohne Knopf. Mit Berechnungen ist "+ Calculation" ein Knopf; ist die Zelle zu schmal, kuerzt der Text mit "…" (`.up-sumadd-t`), das Zeichen bleibt, die Mindestbreiten der Spalten bleiben | `zellenHtml` in `makeSumZeile` (core.js), `.up-sumkeine`, `.up-sumadd-t` |
| Ueberschriften (20.10.) | **Vier Stufen, Werte nach Geist** (vercel.com/geist/typography, am Original gemessen: heading-16 16/24/600/-0.32, copy-13 13/18, label-12 12/16), als Tokens in core (`--up-ueb-*`): **Abschnitt** 16/600/-0.32 (`.up-heading`, `.up-sec-h`, `.up-dk-h2`, `*-sectitle`, `.udd-sec-title`, `.urd-cc-title`, `combo-/ubo-/tcd-/ubd-heading`), auch in der Kopfzeile einer Tabelle oder eines Charts, auch mit Zahl ("Event Tracking 1"); **Unterzeile** 13/400 muted, 4 unter dem Titel (`.up-sec-sub`, `.up-dk-unter`, `*-secsub`, `.udd-sec-desc`, `.urd-cc-desc`); **Block** 14/600/-0.28 nur fuer Titel INNERHALB einer Karte (Kanban-Spalte, Verlaufseintrag); **Gruppe** 12/500 muted, keine Versalien (`.up-blockhead`, `.up-label`, `.up-pop-head`, `*-navhead`, `combo-filter-title`). Vorher sieben Varianten (Titel 12/14/15/16 in 500 und 600, Unterzeilen 12/12.5/13/14). Neue Ueberschrift: eine dieser vier Klassen, nie eine eigene Groesse | `--up-ueb-*` in core.css (neben `--up-fs-*`) |
| Platzmangel | Spalten weichen nach ihrer `art`, nie nach einer Zahl je Datei; Share/Visibility (`anteil`) nie; eine angeklickte Spalte bleibt, dafür weicht die nächst unwichtigere | `SPALTEN_ART` in core |
| Gesamtzeile | Links nur der Count, Werte rechtsbündig, von Haus aus keine Berechnung („+ Calculation“), Ø-Zeichen statt „avg“. Berechnungen laden **getrennt** von der Liste, Skelett nur in der Zelle. Kein Median bei Kennzahlen; einzige Ausnahme der Preis in Shopping und Ads | `UC.makeZaehlZeile` (`cfg.rechnen`, `cfg.quelle`) |
| Band | Chart oben als Band; ausgeblendet ist es **ganz** weg. Ein und aus über den **Umschalter im Seitenkopf** (immer da, zwei Zeichen: Chart und Tabelle / nur Tabelle, Form des Themenschalters) – kein Auge am Band, kein „Show chart“. Luft über und unter der Leiste einheitlich nach dem Vorbild der Prompts-Tabelle | `.up-band*`, `UC.bandTeile`, `UC.bandAus`, `UC.bandSchalterHtml`, `--up-band-luft`. Seit 18.10. auch im Event-Detail, mit eigenen Etiketten (`o.wahlen`: "Full Event Overview" / "Citation Tracking only"), Zustand je Event im Browser (`events_detail_<id>`); aus sind Kennzahlen, Bericht, Chart und Marktbewegung |
| Kleben (16.10.) | Seitenkopf und Reiter scrollen weg, erst die Leiste klebt – auf ALLEN Seiten mit der einen Leiste (Citations, Brands › Tracked, All Prompts, Responses, Teams), auch auf dem Telefon samt Spaltenkopf. Gesamtzeile und Pagination kleben unten nur ab 1000 breit: herein, sobald die Tabelle die untere Hälfte des Bildes einnimmt, hinaus erst unter 70 % (Hysterese); beim ersten Blick keine Fahrt, sonst nur transform/opacity. EIN Scrollbereich (#main), keine feste Kastenhöhe (makeFestHoehe bleibt nur für den Vertrag) – ein innerer Kasten ließ das Rad an Zeile 1 stocken. Über der klebenden Leiste deckt das **Deck** (zwei sticky-Kästen direkt vor ihr, in Ruhe unter ihr verborgen) – nie wieder einen Deckstreifen, der an einer Klasse aus dem Scroll-Takt hängt: die kam nach Sprüngen zu spät und fiel nach einem applySticky beim Kleben ganz weg. Die Linie über dem klebenden Spaltenkopf (flach) trägt der Kopf selbst: Schatten `0 -1px 0`, klebt dafür 1px tiefer; wer darunter klebt, rechnet + 1px mit | `UC.bandUnterLeiste`, `.has-leistenband`, `data-kleb-fuss="yes"` (`UC.klebFuss`, `FUSS_REIN`/`FUSS_RAUS`), `data-leiste` bzw. `data-kleb-fuss` → `.up-sticky` auch unter 1000, `.up-kleb-deck` (`klebDeckStellen`) |
| Ladebild (16.10.) | Lange Läufe nur über `UC.makeLadebild`: Seitenzeichen **ohne Kachel**, Kreis 48 (im Dialog 40), Bogen in Textfarbe, Spur in Linienfarbe, Statuszeile blendet nur über; kein Balken, kein Schweben. Keine eigene Kopie in einer Seite | `UC.makeLadebild` (`cfg.kompakt`), `.up-lb*`, STYLEGUIDE §9b |
| Aufklapper (16.10.) | Ein Drilldown/eine Gruppe öffnet über `UC.zeileHalten`: die angeklickte Zeile bleibt an ihrer Stelle, auch wenn darüber ein größerer Block schließt (`#main` hat `overflow-anchor: none`, die Verankerung des Browsers greift nicht) | `UC.zeileHalten(el, aendern, { dauer })`, STYLEGUIDE §29 |
| Seitenleiste am Telefon (16.10.) | Kein schwebender Knopf mehr: der Umschalter steht **ganz links in der Kopfzeile** jeder Seite (Mira: in ihrem Kopf), im Fluss, scrollt mit ihr weg; nur im hint-Zustand (unter 500). Die Übrigen machen Platz: Hinzufügen-Knopf kurz, erste Krumenstufe nur als Zeichen, wenn gemessen zu eng. `.usn-fab` bleibt nur als Rückfall für eine Ansicht ohne Kopfknopf | `makePageCrumbs` setzt ihn, eigener Kopf `UC.seitenleistenKnopfEinsetzen`; `html[data-usn-modus]`, `.up-ph-seitenleiste`, `.is-knapp` |
| Zeilen-Hover (16.10.) | **Kein Pfeil** (arrowUpRight), der beim Hover hereingleitet, in keiner Tabelle – er belegte auch unsichtbar Platz. Eine Zeilenaktion kommt beim Hover sofort, in der ersten Zelle, ohne Verweildauer | `.up-btn-sec.up-rowbtn`; `.up-row-goto`/`.up-rowswap` stillgelegt (nur `display:none`, Vertrag) |
| Impact (19.10.) | Die Events-Seite heißt Impact (vorläufig, Name noch offen) und hat zwei Arten, beim Anlegen im Dialog "Create" gewählt und danach nie änderbar: **Event Tracking** (`kind` event: Datum, Topics Pflicht, Kohorte, Kontrollgruppe; "All active prompts" gibt es nicht mehr) und **Citation Tracking** (`kind` watch: alle Prompts auch nachträglich, kein Datum, keine Pins, keine Meldungen, Delta = letztes gegen das Fenster davor). Übersicht: zwei gestapelte Abschnitte mit eigener Leiste, ein Abschnitt ohne Einträge fehlt. Detail eines Watch: fest ohne Marken-Teile, kein Umschalter. Wizard in zwei Schritten (Tracking, Check and create), der Name steht im letzten, mit der Domain des ersten Ziels vorbelegt, und der Titel der Vorschau folgt dem Feld. **URL-Listen je Regel (20.10.):** die Tabelle der URLs kommt seitenweise aus `get_impact_event_urls_v1` (Suche in URL und Titel, Sortierung und Seite in der DB; `analyseKoerper()` gibt dieselben Filter wie die Analyse mit), die Sitemap-Liste bei Suchtext aus `get_impact_event_coverage_v1` (Argument `p_query`); beide haben in der Hinweiszeile bzw. neben den Reitern die Suche aus core (`UC.makeSearch`, `suchenAnlegen`). Fehlt die Funktion (PGRST202), rechnet der Browser mit den URLs der Analyse. DB-Dateien: `bubble/events_urls_20_10/` | `events.js` (`istWatch`, `popupArt`, `ABSCHNITTE`), Kanal `uevCreateWatch` = `create_impact_watch_v1`, Auftrag `bubble/experiments_19_10/DB_AUFTRAG.md`; Titelbilder je Art (`coversFuer`), Citation Tracking mit eigenen sechs (`event-covers/hills-*`); die Seitenleiste und alle Charts lesen Events aus `team_context_v1`, nicht aus `list_impact_events_v3` (dort `kind` mitziehen) |
| Popups (19.10.) | **Vorlage ist Geists Modal (vercel.com/geist/modal)**, nicht der Bestand. Karte 540 breit, Radius 12, höchstens min(800px, 80vh) und selbst der Rollbereich; Kopf Titel 20/26/600/-0.4, Untertitel 14/20 in der zweiten Textfarbe, Polster 20; Fuß Polster 12, links Cancel, rechts die Hauptaktion, Knöpfe 32 hoch, eigene Fläche (`--up-popup-fuss`) und Haarlinie (`--up-popup-linie`). Rollt der Inhalt, kleben Kopf (mit Haarlinie ab Scroll, `.is-gerollt`) und Fuß. Unter 540 wird die Karte ein Blatt am unteren Rand. **Fokus:** erstes sichtbares Eingabefeld, sonst die Karte selbst, mit Gefahraktion Cancel; Tab bleibt im Popup, Fokus kehrt zum Auslöser zurück. Inhalt nach Geist: Titel im Title Case ohne Fragezeichen, Hauptknopf Verb + Nomen wie der Titel, Abbrechen heißt Cancel, reine Bestätigung Done; Gefahraktion: Cancel zuerst fokussiert, Enter löst sie nie aus. **Rollt etwas im Popup:** unter dem Fuß liegt ein Schatten, solange noch Inhalt darunter wegrollt (`.has-mehr`, 200 ms); liegt oben Inhalt weggerollt, wirft der Kopf einen Schatten nach unten (`.has-oben`). Beides macht `UC.modalVerhalten`. Einen "Nach oben"-Knopf gibt es bewusst nicht (am 20.10. wieder gestrichen). Ein geschlossenes Menü im Fuß gehört aus dem Fluss (`display: none`), sonst vergrößert es den Rollbereich und der klebende Fuß läuft mit. Der klebende Kopf deckt den ersten Rahmen- und Fokusring ab: Kopf unten 16, Inhalt oben 4. Dropdowns in Popups öffnen wie überall (unten, sonst oben, frei über der Karte): `UC.dropdownOpened`. Gilt für alles aus `UC.makeModal` (`.up-modal`) und für jedes eigene Fenster mit Klasse `.up-geist` auf der Karte (Add Brand, Add Prompts, Einladen im Team, Gefahrendialog der Brand-Settings, Topic bearbeiten, Gruppierung, Topics ändern): Kopf, Inhalt und Fuß heißen dort `.up-topicmodal-head/-body/-foot` (direkte Kinder der Karte), danach `UC.modalVerhalten(karte)` für Fokus, Tab im Kreis und klebenden Kopf. Die Zwei-Spalten-Fenster (Preferences, Miras Einstellungen, Export-Assistent) behalten ihr Gerüst und nehmen von Geist Titel 20/26/600, Untertitel 14/20, Polster 20 bzw. 12 und (Preferences, Mira) Fokus auf die Karte; die Tarifwahl ist `.up-geist`. Bewusst unberührt: die Zugangssperre (ganzseitiges Tor, kein Modal) | `.up-modal` in core.css, `makeModal` in core.js, `--up-fs-modaltitel` |
| Citation Tracking, Ziel (21.10.) | Chart mit drei Modi **Overall Share | Overall Citations | URL Share** (URL Share: eine Linie je URL wie Domain Detail, Daten aus `get_impact_event_url_series_v1`, Nenner `daily[].total_citations` der Analyse, fehlt die Funktion (PGRST202), verschwindet der Modus). Cited URLs und Sitemap in **einem** `.up-box` (`.uev-quellen`): Kopf 48 mit Umschalter links und URL-Suche rechts, Haarlinie, darunter randlos Tabelle oder Sitemap (16 Polster, 12 Rhythmus). Fenster und Filter (Steuerzeile) 32 ueber und unter sich. URL Share: Chart 64 hoeher (284), Hoehe zieht in 200 ms `ease` auf (`zielHoeheFolgen` zeichnet Chart.js je Bild nach), Hover auf einer URL-Zeile hebt deren Linie hervor (`makeLine.highlight`) | `quellenStellen`, `urlReiheZeigen` in events.js; `.uev-quellen*` in events.css |
| Branded sichtbar (22.10.) | Branded-Prompts bleiben von Haus aus draußen (`non_branded`), aber **sichtbar**: ohne Wahl steht in jeder Filterleiste mit der Zeile Branded der Chip **„Non-branded prompts“** (ohne X, Klick öffnet die Wahl, `has-standard` statt `has-filters`), im Menü „Excluded“ statt „Off“. Jeder Wert und jedes Datum rechnet im selben Umfang; kippt der Ausschluss „zitiert ja/nein“, steht die Marke **„Branded only“** statt einer stillen 0 (Tabelle „Cited URLs“ in First cited, Sitemap an der Stelle von „Not cited yet“); im URL-Detail ein Hinweis mit „Include Branded“, das nur den Drawer umschaltet. „Last seen“ im Umfang (`scope_last_cited_at`). Nie ein Hinweis an gewöhnlichen Zahlen. Bericht `reports/Branded Prompts sichtbar kennzeichnen.md`, STYLEGUIDE §8e | `standardChip` in filters/filter-bar.js, `nurBrandedMarke`/`ABD_PF` in events.js, `letzteImUmfang`/`__uudBranded` in url-detail.js, DB `bubble/branded_kennzeichnen_22_10/` |
| Auswahlkarte (21.10.) | Die Karte aus dem Dialog "Create" von Impact ist ein **core-Baustein** (Nutzer: "Die Cards gehoeren nach Core"): `UC.wkKarteHtml({ titel, satz, icon, invers, kompakt, klasse, daten })` -- Titel 16 mit Pfeil beim Ueberfahren, Satz 14, gekippte Tafel mit dem Zeichen; `is-invers` in den Farben des anderen Themas, `is-kompakt` 160 statt 201.5 hoch (Page Audit, Startbereich). Verhalten (Klick, Pfeiltasten) beim Aufrufer. Impact (`events.css` `.uev-wk`) zieht in eigener Sitzung um; neue Karten nur ueber den Baustein | `.up-wk*` in core.css, `wkKarteHtml` in core.js |
| Page Audit v2 (22.10.) | Seite nach Canvas v8 (Zielbild S9, Lukas: "genau so"). **Erklärungen nur hinter dem Info-Zeichen** (22.10. abends, Lukas: "Tooltips haben sich über Icons zu öffnen, die on hover oben rechts in Cards sichtbar werden"): Kennzahlen im Kopf (2 x 2, `.upa-kk`, Kacheln bis 600, Fenster 480) und unter Evidence (`UC.kpiKarte({ explain })`, setzt das Zeichen selbst) tragen `.up-th-info` **oben rechts in der Kachel**, sichtbar beim Überfahren der Kachel; jeder Spaltenkopf der Plattform-Tabelle, der Titel "What to fix" und die Befundgruppe "No longer reported" ebenso (`.up-th-info` + `data-explain`, Karte über `UC.makeExplain`, Texte `EXPLAIN_TEXT pa_*` mit Deutsch im core-Katalog; STYLEGUIDE "Erklärkarte an einer Kennzahl"). Nie mehr die ganze Kachel als Auslöser, nie ein Erklärsatz als Tooltip auf Text; Tooltips bleiben nur für Kurzinfos (Zustandswort, Regel und Zeile, gekürzter Text). Plattform-Tabelle ohne Gruppenzeilen: getrackte Plattformen zuerst, `.up-marke.is-leise` "Tracked" hinter dem Namen; die Linie trägt die Zeile, ein offener Körper seine eigene (Schatten innen am `.upa-klapp-in`, zugeklappt ohne Höhe). Reiter des Details wie eine Unterseiten-Navigation (core-Liste, Kopf 0–48, Reiter ab 48, Inhalt 16 darunter). "See finding" springt zum Befund des Checks (`finding.check_keys`), offen, im Bild. Erklärzeilen unter Bauteilen gibt es nicht (Memory "Keine Meta-Unterzeilen"). Laufprotokoll nach Miras `.am-run` mit echten Schritten aus `get_page_audit_progress_v1` (Dauern bewusst wie Mira, nicht auf `--up-t-*`). Bildschirmfoto im Browserfenster nur über `/api/page-audit/bild` der App (signiert, kurz, nur slot `screenshot`) | `page-audit.js`, `kpiKarte`/`EXPLAIN_TEXT` in core.js, `bubble/page_audit_21_10/` |
| Laufprotokoll (22.10.) | Mira (`.am-run`) und Page Audit (`.upa-run`) nehmen Takt und Bewegung aus **core**, nie eigene Zahlen (Lukas: "bei mira haben wir die regeln ja auch ... mach es genauso"): Mindeststandzeit 1500 je Schritt mit Schlange statt Sprung, am Ende Rest auf einmal nachtragen, frisch 520, kalt 480, Auftritt 20, Logo-Versatz 70, Uhr 1000. Zeilen werden nie neu gebaut, nur ihre Klasse wechselt; die Uhr ändert nur ihren Text. Page Audit zeigt nur Schritte, die der Server gemeldet hat, und hält das Ergebnis `frisch` lang zurück, bis der nachgetragene Rest zu sehen war | `UC.LAUF_TAKT`, `laufWarten`, `laufAuftritt`, `laufAbhaken` in core.js; `--up-lauf-*` in core.css; STYLEGUIDE 9c |
| Meldungskarte (20.10.) | Die Meldung "X is cited" bei Events ist eine **Karte**, keine Toast-Zeile: `UC.toast(name, { karte: { bildUrl, zeichen, zeichenFarbe }, inhalt })` -- Kachel 44 links mit dem Favicon der ERSTEN zitierten Seite (ohne Seite das Zeichen des Events), Name des Events, eine Zeile Text (Adresse in der Textfarbe), Radius 16, Kachel 12, umgekehrte Farben wie jeder Toast. Stapel, Ort, X und Warteschlange sind die des Toasts; normale Toasts bleiben unverändert | `.up-toast.is-karte`, `.up-toast-bild`, `evmKarteText` |
| Namen und Zeilen in Tabellen (20.10.) | Der Name in der ersten Zelle (Marke, Händler, Werbetreibender) trägt `.up-zeilenname` (14/500 wie `.up-num`), das Logo davor ist `.up-logo-box`; nie `.up-varname` allein (erbt 16/400). Brands, Merchants (Shopping) und Advertisers (Ads): Default 55 (`--up-h-row`), Compact 34 (wie die Protokoll-Tabelle), per `ush-rh`/`uad-rh`; Brands Overview 55. **Gaps:** zwischen Abschnitten 32, nur Kennzahlen→Chart und Zusammenfassung→Kennzahlen 16; die core-Regel "Zeile unter dem Band" (16) gilt nur vor einer TABELLE, vor einem eigenen Abschnitt wird sie mit Klassenkette zurückgenommen (`.ush-seite … :has(+ .ush-sek)`, `.uad-seite`). Card-Ansicht (Responses): 16 Luft unter der klebenden Leiste, sonst schneidet sie den Hover (-2px) ab. Kartenfelder: `.up-feldchip` im Feld weiß + `--up-e-1` | `.up-zeilenname`, `.up-row` |
| Eingabefelder (19.10.) | EIN Token `--up-feld-bg`: Weiss im Hellen (auch im grauen Hell und in Popups), `#0f0f0f` im Dunkeln. Jedes Feld mit Rahmen liest nur dieses Token, nie `--vc-bg`/`--up-surface`/`transparent`; die Felder fielen vorher je Datei verschieden aus. Gemessen: 26 Feldklassen, in drei Themen je ein Wert | `--up-feld-bg` in core.css (neben `--up-popup-bg`) **Maße und Esc-Schild (20.10., Audit aller Felder):** Suchfeld 32 hoch, Formularfeld 40 (`--up-h-gross`), Schrift 14, Polster 12, Radius 6 bzw. 8. **Jedes Suchfeld** (Werkzeugleiste, Menüs, Filter-Dropdowns, Listen) trägt rechts das Geist-Esc-Schild statt eines X: es erscheint, sobald Text drinsteht, sitzt mit 6px Abstand oben, rechts und unten; Escape leert zuerst (`SCHILD_SEL` in core.js), ein zweites schließt. Formularfelder bekommen kein Schild. Ausgenommen: Quick Actions, Mira-Eingabe, mehrzeilige Textfelder, Umbenennen in der Zeile. **Typ-Filter** (Citation/URL type, `suche: true`, `ohneLogo: true`) suchen lokal wie Topics, die Liste zeigt seit 22.10. alle Zeilen (eigene Höhe, gedeckelt bei `100dvh - 106px`; vorher 244 wie `.utf-list`, die siebte Citation-Zeile war angeschnitten), aktive Chips zeigen die farbigen Typ-Chips der Liste (`typChip` in filter-bar.js); Untermenüs der Schale bleiben im Bild (`klemmen` in `makeSubmenu`) |
| Drawer: Filter, Chips, Vererbung (22.10.) | Jeder Drawer mit Listen hat **die Leiste aus core** (Kalender + Filters; URL-Drawer seit 22.10. mit Topics, Models, Markets, Intent, Branded). **Chips in eigener Zeile** unter dem Kopf (`.up-dk-chipzeile`, `data-chips-ziel`), Kalender und Filters bleiben oben rechts stehen; Id nie `drawer-…` (das Kopf-Skript schiebt jedes `[id^="drawer-"]` aus dem Bild), sondern `chips-drawer-<art>`. **Drawer zu Drawer erbt** Zeitraum, Topics, Models, Markets und Intent als Startwert, sichtbar und abwählbar (`UC.drawerOeffnen(art, id, wer, kontext)`, `UC.drawerKontextLesen`/`-Setzen`, `zeigen(id, kontext)`); von einer Seite nichts (FLT-07). **Intent/Branded im Drawer lokal** (`UC.drawerIntent`, `data-intent-lokal`; meldet `up-intentfilter-lokal`, nie `up-intentfilter`; Daten über `f.intent`, Export über `brille`). **Schließen behält** den Stand bis zum Neuladen | core.js, filter-bar.js, STYLEGUIDE 8d |

Neue Tabellen bekommen Kopfzeichen über `UC.kopfZeichenHtml` und je Spalte eine `art`.


## 1e. Stand 17.10.: Tabellenkopf, Tabellen-Rollen, Menü-Lage

Vier Regeln aus der Fix-Runde vom 17.10., jede aus einem gemessenen Fehler:

- **Die Linie unter dem Tabellenkopf trägt die Kopfzelle selbst.** Jede `.up-th` hat in core
  `border-bottom`. Ein Schatten nach innen unten (`inset 0 -1px 0`) an einer Kopfzelle liegt einen
  Pixel DARÜBER und ergibt eine 2px-Linie. Gemeldet in Ads (15.10., behoben) und in Shopping unter
  Brand und Product (17.10.): dieselbe Regel, zweimal einzeln geschrieben. Die stehende erste
  Kopfzelle (`.up-colscroll`) setzt nur ihren Trenner nach rechts (`box-shadow: 1px 0 0`).
  `.check_reinvention.py` meldet `DOPPELLINIE`; gemessen mit einem Zeilenzähler je Kopfzelle (1 = richtig).
- **Tabellen-Rollen.** `.up-table` = `table`, `.up-thead`/`.up-row` = `row`, `.up-th` = `columnheader`,
  `.up-td` = `cell`; `aria-sort` nur an der sortierten Spalte. Die Zeile ist kein `role=button`:
  Tabulatorstopp (`tabindex=0`) und Enter bleiben; aufklappende Zeilen (Ads) behalten `role=button` mit
  `aria-expanded`. Kein `grid`: das verlangt ein Pfeiltastenmodell, das die Listen nicht haben.
- **Fokus an Kopf und Zeile liegt innen** (Abstand `-2px`), weil Köpfe und Zeilen Kante an Kante
  stoßen und ein Ring außen am Rand des Kastens abgeschnitten würde. Sortierköpfe bedienen Enter und Leertaste.
- **Die Lage eines Menüs bleibt bis zum Ende der Ausblendebewegung.** Oben/unten, links/rechts und die
  Top-Layer-Freigabe werden beim Öffnen einmal bestimmt; zurückgesetzt wird erst danach per Zeitgeber in
  der Dauer des eigenen Übergangs (nie beim Entfernen von `.is-shown`, nie durch Neuberechnen beim
  Schließen), und ein Wiederöffnen in dieser Zeit bricht das Zurücksetzen ab (`dropEscape`, `ausblendDauer`
  in core). Vorher blitzte ein nach oben geöffnetes Menü beim Zugehen unten auf (71 px Sprung, 15 von 15 Bildern).

## 2. Daten von Bubble: leer und kaputt sind zwei Dinge

Jeder Setter bekommt Text aus einem Bubble-Ausdruck. Fünf Arten, wie der beschädigt ankommt:
leerer Wert (`"key": ,`), unquotiertes `yes`/`no`, abgeschnitten, doppelt geschickt, gar nicht.

**Regel: Ein Payload, den `parseLoose` nicht lesen konnte, darf nie stillschweigend verpuffen.**

```javascript
// FALSCH — bei kaputtem Payload bleibt loading auf true, das Skelett läuft endlos
if (p && typeof p === "object") { state.data = p; state.loading = false; }
render();

// RICHTIG — Fehlerzustand ins UI, Ladezustand IMMER beenden
var ok = p && typeof p === "object" && isArr(p.series);
state.error = ok ? null : "The chart data could not be read.";
if (ok) state.data = p; else state.data = null;
state.loading = false;
render();
```

Im Render kommt der Fehlerfall **vor** dem Skelett — sonst sieht endloses Laden aus wie "gleich da".
`reset()` löscht den Fehlerzustand mit.

**Zwei Fehlerzustände, zwei Namen — nicht verwechseln (22.09.):**

| Feld | Form | Bedeutung | Gerendert als |
|---|---|---|---|
| `state.leseFehler` | Schalter (true/false) | Die Nutzlast war unlesbar | `UC.leseFehlerHtml("brands")` |
| `state.fehler` | Text, oder eine Tabelle davon | EINE konkrete Meldung | der Text selbst |

`leseFehler` steht in 18 Dateien, `fehler` in 8. Der Unterschied ist echt und soll bleiben:
power-dashboard führt `state.fehler` je Abschnitt (`.overview`, `.brands`), onboarding-page je
Formularfeld — das sind Meldungs**tabellen**, kein Schalter. `state.error` gibt es seit dem 22.09.
nicht mehr; brand-detail, domain-detail und response-detail hießen als einzige englisch.

Der **Leerzustand** hat seit dem 22.09. ebenfalls einen Baustein: `UC.leerHtml({ gefiltert, was,
icon, titel, text, knopf, mini })`. Gefiltert bringt er Lupe, "No matching …" und den Räum-Knopf
mit; der Satz für den Ruhefall kommt vom Aufrufer. Kein Symbol ohne Angabe — ein geratener Name
liefert eine leere Hülle und damit ein Loch über der Überschrift.
Leere Charts zeigen `UC.chartLeerHtml`, leere Tabellen neben einem Chart `UC.tabelleLeerHtml({ titel,
text, icon, gefiltert, zeilen })` (seit 16.10.): dieselbe Form, mindestens so hoch wie das Skelett davor –
sonst springt die Fläche beim Wechsel von Laden zu Leer.

Zahlenfelder immer durch `num()`/`toNum()` (gibt `null` statt `NaN`), Listen durch `isArr()` prüfen,
bevor `.map()` darauf läuft. Ein `undefined.map` reißt den ganzen Run-JS-Step mit — also auch die
Setter der anderen Komponenten, die darunter stehen.

Jede Bubble-Doku braucht **beide** Sanitizer-Zeilen (§46):

```javascript
.replace(/:\s*([,}\]])/g, ": null$1")
.replace(/:\s*(yes|no)\s*([,}\]])/g, function(_, v, t){ return ": " + (v === "yes") + t; })
```

---

## 2a. Run-JS-Schritte: die Hausform, abschreiben statt erfinden

**Alle ~100 Komponenten der App werden ueber Run-JS-Schritte gefuellt.** Bevor einer geschrieben
wird: `bubble/urls_table_bubble.html` ab "DER RUN-JS-SCHRITT" lesen und die Form **kopieren**.
`brand_detail_bubble.html` und `ask_mira_bubble.html` tragen dieselbe.

```javascript
(function () {
  var ROH = `[Bubble-Ausdruck]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setXyz) window.setXyz(ROH); } catch (e) {}
})();
```

Mehrere Setter: **je ein eigener Backtick, je eine eigene Variable, je ein try.** Das Literal nie
in einem Aufruf (`sauber(...)`) -- ein Fehler darin meldet dann "missing ) after argument list"
statt der wahren Stelle. `window.<name>` statt des nackten Namens: haengt ein Element noch an
einem aelteren Pin, ist der Name `undefined` statt ein ReferenceError, der den Schritt mitnimmt.

**Verboten:** `JSON.parse` im Schritt, ein handgebautes Objekt mit `JSON.stringify`,
`:formatted as JSON-safe`, `String.raw`, Bubbles `find & replace`, versteckte Datenelemente.
Der **rohe** Text geht in den Setter; `UC.readBubble` in der Komponente ist der EINE geteilte
Leseweg. Eine Komponente mit eigenem `looseParse` statt `readBubble` ist ein Fehler -- sie zeigt
bei jeder Bubble-Eigenheit einen Lesefehler (so gefunden in opportunities.js am 15.09.).

**Die Regel dahinter.** Im Backtick sind drei Dinge in einem WERT gefaehrlich: ein **Backtick**,
ein **`${`** und ein **Backslash** (19.09. ergaenzt -- ein `reason`, das auf `\` endete, hat das
schliessende Anfuehrungszeichen gefressen und den ganzen Schritt der Opportunities getoetet:
"Unexpected identifier 'priority_score'"). Anfuehrungszeichen, Apostrophe, Umlaute,
Zeilenumbrueche und Emoji traegt er unbeschadet. Deshalb
traegt **keine Nutzlast dieser App ein Feld mit Text aus einem Sprachmodell** -- Miras Chatliste
ist `id`, `title`, `updated_at`, mehr nicht. Stirbt ein Schritt daran, ist die Frage NICHT "wie
escape ich das", sondern **"welches Feld gehoert da gar nicht rein"**. Am 15.09. war es
`chats.preview`: in keiner Spezifikation, von keiner Komponente gelesen, groesster Teil der
Nutzlast -- und es trug die Backticks. Wo Modelltext wirklich angezeigt wird
(`opportunities.headline`/`.reason`), entfernt der RPC den Backtick:
`replace(feld, chr(96), '')`.

**Der Sonderfall RPC-JSON (20.09.).** Die Regel oben gilt fuer Text, den BUBBLE zusammensetzt --
dort stehen Werte roh im Backtick. Reicht ein Schritt dagegen das JSON eines RPC durch, ist die
Rechnung eine andere: in echtem JSON ist JEDER Zeilenumbruch ein `\n` und JEDES
Anfuehrungszeichen im Text ein `\"`. Das Backtick frisst genau diese Ebene, und uebrig bleibt
ein roher Umbruch und ein rohes Anfuehrungszeichen -- also kaputtes JSON. Gemessen an einer
gemeldeten Mira-Antwort: 967 Backslashes vor dem Schritt, 0 danach, `JSON.parse` stirbt am ersten
Umbruch. Erkennungszeichen in der Konsole: **der Payload kommt mit 0 Backslashes an.** Dann ist
nichts abgeschnitten -- dann reicht ein Schritt RPC-JSON durch ein Backtick. Zu beheben ist das
Bubble-seitig (denselben Ausdruck nehmen wie der Schritt, der funktioniert, oder die Backslashes
im RPC verdoppeln: `replace(txt, chr(92), chr(92)||chr(92))`); `UC.readBubble` liest den Schaden
zwar wieder zusammen, aber Raten bleibt Raten.

Zu jedem Schritt gehoert **ungefragt** die statische Fassung mit den echten Daten des Nutzers,
in derselben Antwort -- und beide vorher gegen die Komponente laufen lassen.

---

## 2b. Zahlenformate: pro Kennzahl festgelegt

| Kennzahl | Einheit | Nachkommastellen | Beispiel |
|---|---|---|---|
| Visibility / Share of Voice | `%` | 1 in Zellen | `34.3%` |
| Rank | keine | **immer 1**, auch bei glatt 3 | `3.0`, `3.1` |
| Sentiment | keine | 0 (ganze Note auf 0-100) | `76` |
| Mention Count | keine | 0 | `214` |
| Trend (Delta) | `%` nur beim Prozentwert | 1 | `4.7%`, `0.3` |

**Chart-Tooltips: pro Chart festgelegt, nicht global.** Der Standard des Kits ist 2 — der ist
nirgends erwuenscht, also immer mitgeben:

| Chart | Nachkommastellen |
|---|---|
| Visibility Chart, Linie | 0 |
| Top Citations Dashboard, Doughnut | 0 |
| Citations Combo Chart, Linie und Doughnut | 1 |
| Brands Overview, Linie und Landscape | 1 |

`UC.fmtPct(v)` rundet auf 0 — fuer die Visibility-Zelle und den Landscape-Tooltip in
brands-overview `UC.fmtPct(v, 1)`.

Rang und Sentiment sind **keine Prozentwerte**. Wer eine Achse, einen Tooltip oder eine Zelle
baut, gibt die Einheit mit: `UC.makeLine` kennt `cfg.unit`, `cfg.decimals`, `cfg.tipLabel`, alle
drei auch als Funktion oder als Zahl. `UC.makeTypeChart` kennt `cfg.decimals` fuer den
Doughnut-Tooltip. Ohne Angabe bleibt es bei Prozent mit zwei Stellen -- der Rueckfall aus der
Zeit, als es nur eine Genauigkeit gab, und fuer keinen Chart der App richtig.

Beim Rang ist WENIGER besser: `UC.trendChip(delta, { inverted: true })`, sonst zeigt der Pfeil in
die falsche Richtung.

---

## 3. Verifikation: gemessen, nicht gelesen

Kein Fix gilt als fertig, bevor er im lokalen Harness (`_h_*.html`, `python3 -m http.server`)
**gemessen** wurde. Nicht "der Code sieht richtig aus".

- **Messinstrument gegentesten.** Ein Wert von 0 oder ein ausbleibender Fehler ist erst dann ein
  Ergebnis, wenn die alte Fassung im selben Aufbau das Gegenteil zeigt. Sonst hat man die eigene
  Messung gemessen. (Zwei Fehlschlüsse in dieser Sitzung: ein 48px breites Browserfenster, das wie
  ein Layoutfehler aussah, und eine gecachte CSS, die den Fix verschluckte.)
- **Frische der geladenen Datei BEWEISEN, nicht bumpen und hoffen.** Ein `?v=…` im Harness ist
  kein Beweis: er hat mehrfach in derselben Sitzung nicht gewirkt, und drei Runden Diagnose gingen
  gegen eine veraltete Datei. Vor dem ersten Messwert prüfen, dass die geänderte Zeile wirklich
  angekommen ist:

  ```javascript
  // CSS: steht die neue Regel im geladenen Stylesheet?
  [].some.call(document.styleSheets, function (ss) {
    try { return [].some.call(ss.cssRules, function (r) {
      return (r.cssText || "").indexOf("DIE-NEUE-REGEL") >= 0; }); } catch (e) { return false; }
  })
  // JS: ist der neue Zweig aktiv? Am Ergebnis prüfen, das es vorher NICHT gab —
  // etwa an einer Klasse oder einem Attribut, das die alte Fassung nicht setzte.
  ```

  Kommt `false`, ist jeder weitere Messwert wertlos. Dann Dateinamen ändern (`_h_x2.html`), nicht
  nur die Version — das umgeht jeden Cache zuverlässig.
- **Nichts annehmen, was messbar ist.** Nicht die Einrückung zählen, um einen Scope zu bestimmen —
  laden und schauen. Nicht vermuten, eine Trennlinie sei verloren — nachsehen, ob der Nachbar
  schon eine hat, sonst stehen am Ende zwei.

Vor jedem Commit zusätzlich `.contract_snapshot.py` / `.contract_diff.py`: **0 Entfernungen.**

### §28 gilt auch in JS — und dort ist der Rauchtest die Wache

`.scan_comments.py` prüft **nur CSS**. Am 22.09. stand in einem `core.js`-Kommentar `--up-*` gefolgt
von `*/` — das schloss den Kommentar, der Rest des Absatzes wurde Code, und core.js hatte einen
Syntaxfehler: **die ganze App tot**, nicht nur eine Regel daneben. Gefunden hat es der Rauchtest im
Browser (`new Function` über alle 39 Dateien), nicht der Prüfer.

Den Prüfer auf JS auszuweiten ist einmal versucht und wieder verworfen worden: er kann ein `*/` in
einem **Regex-Literal** (`/\*\*([^*]+)\*\*/g`) nicht von einem echten unterscheiden und meldete
neun Fehlalarme. Ein Prüfer mit neun Fehlalarmen wird weggeklickt — dieselbe Überlegung wie bei der
Grundlinie von `.check_skala.py`.

**Also: nach jeder Änderung an einem JS-Kommentar den Rauchtest laufen lassen.** Und beim Schreiben
daran denken, dass `*/` in Prosa vorkommt, wo man es nicht erwartet — in Pfadangaben (`--up-*/--vc-*`),
in Klassenlisten (`.up-cg-*/.up-cgm-*`) und in Dateimustern.

### Löschen ist keine Mustersuche (22.09., drei Fehler an einem Tag)

Ein Löschbereich, dessen **Anfang oder Ende ein Textmuster bestimmt**, löscht früher oder später
etwas anderes mit. Alle drei Fälle vom 22.09. waren dieselbe Sorte:

| Was ich tat | Was wegging |
|---|---|
| Regex `\.klasse \{[^}]*\}` | traf mitten in einer Zeile, ließ `.up-root[data-theme="dark"]` als Präfix stehen — vier Dateien gingen in den Dark-Mode-Zweig (`b6cf87b`) |
| Schnitt von `var comps` bis zum Ende des Ausdrucks | nahm `kpis` und `meta` mit, die Karte warf `kpis is not defined` |
| Zeilen entfernen, die `uo-comp` enthalten | zog eine Zeile **aus einem Kommentar** heraus, das `*/` blieb verwaist stehen |

**Regel:** Entweder ein **exakter, vollständiger Textblock** als Anker (`s.count(alt) == 1`,
sonst Abbruch) oder ein Zeilenbereich, dessen **beide Grenzen** vorher von Hand gelesen wurden.
Nie ein Muster, das über mehrere Regeln oder in Kommentare hineinlaufen kann. Danach immer
`.scan_comments.py` und eine Syntaxprobe — bei JS **im Browser gegen `new Function`**, nicht an
der Klammerzahl: die täuscht, weil Klammern in Zeichenketten mitzählen.

---

## 4. Nach jedem Commit, unaufgefordert

1. `git push origin main` als eigener Bash-Block
2. **Commit-gepinnte** jsDelivr-URLs für jede geänderte Datei — nie `@main`
2b. **Pin purgen und prüfen, bevor er übergeben wird.** jsDelivr merkt sich einen fehlgeschlagenen
   GitHub-Abruf **pro Datei und pro Commit**. Wird ein frischer Pin angefragt, während GitHub
   gerade drosselt, liefert jede dieser Dateien dauerhaft `Failed to fetch … from GitHub` — mit
   Status 200 und 54 Zeichen Text, also nicht als 404 erkennbar. Trifft es `core.js`, ist die
   ganze App tot, und es sieht aus wie ein kaputter Commit. Genau das ist am 17.08. passiert.

   ```
   _h_pin_purge.html?pin=<hash>     purgt alle ausgelieferten Dateien und prueft danach
   _h_pin_check2.html?pin=<hash>     prueft nur, 76 Dateien parallel, meldet die kaputten
   ```

   Übergeben wird ein Pin erst bei **0 kaputten Dateien**. Der Purge ist `pending`, wirkt also
   mit Verzögerung — nach dem Purge einmal warten und erneut prüfen. Ein einzelner Abruf als
   Beweis reicht nicht: am 17.08. lieferten `sidebar.css` und `sidebar.js` längst, während
   `core.js` am selben Pin noch scheiterte.
3. Explizit benennen, was **Bubble-seitig** zu tun ist (neues Attribut, neuer Event, Workflow-Schritt)
4. Was gemessen wurde, mit Zahlen. Was nicht geprüft werden konnte, ebenfalls — offen und benannt.

`bubble/*.html` ist eine **Vorlage für Neuinstallationen**. Änderungen daran erreichen ein bereits
eingebautes Element nicht — das muss dort von Hand nachgezogen werden, und das gehört in die
Übergabe.

---

## 5. Sprache und Form

- Sichtbare UI-Texte: **Englisch**. Kommentare und Commit-Meldungen: **Deutsch**.
- Kommentare sagen **warum**, nicht was. Bei jedem nicht offensichtlichen Wert: die Begründung dazu.
- Keine Geviertstriche in Texten an den Nutzer (Halbgeviertstriche sind in Ordnung).
- **Keine Mittelpunkte (·) als Trenner** in der UI (03.10. eingefuehrt: "ich hasse die"). Teile
  einer Zeile werden durch Abstand getrennt -- je ein eigenes Element mit `gap` --, in reinem Text
  (aria-label, Tooltip, Satz) durch Komma, Doppelpunkt oder Klammer.
- Icons kommen aus `UC.icon(name, strokeWidth)` — nie selbst gezeichnet. Der Satz ist seit dem
  22.09. **Hugeicons** 4.3.5 (stroke-rounded), einzelne Zeichen aus Lucide; Feather gibt es nicht
  mehr. Ein neues Zeichen wird in `ICON_PATHS` aufgenommen, nach dem Bild gewählt, nicht nach dem
  Namen. Ausnahme nur dort, wo `UC` nachweislich nicht im Scope ist; dann mit Begründung im
  Kommentar.
- Keine Debug-Ausgaben in der ausgelieferten App.
- Fremde Bubble-Vorfahren nie im `z-index` anfassen (hat am 11.08. die App lahmgelegt).
