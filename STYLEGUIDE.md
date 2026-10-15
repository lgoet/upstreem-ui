# Upstreem UI-Komponenten — Styleguide

Gilt für alle Tabellen- und Chart-Komponenten des Upstreem-UI-Systems. Root-Klasse aller Komponenten: **`.up-root`** (Core, `core.css`/`core.js`). Komponentenspezifische Präfixe: `uut-` (URLs Table), `udt-` (Domains Table), `upt-` (Prompts Table), `vot-` (Visibility Chart), `tcd-` (TopCitations Dashboard), `combo-` (Citations Combo Chart), `utm-` (Topics Manager). Ausnahme `quick-actions.*` (Präfix `mqa-`): eigenes Token-Set, kein `core.css`/`core.js` — siehe Abschnitt 12.

> **Hinweis:** Abschnitte 1–11 dokumentieren das Design-System (Farben, Typo, Spacing). Abschnitte 12–25 dokumentieren Verhalten und Implementierungsmuster. Abschnitt 0 (direkt unten) listet die `window.UpstreemCore` API.

---

## 0. Core-Architektur (`window.UpstreemCore`)

`core.js` stellt `window.UpstreemCore` bereit. Jede Komponente importiert daraus per Destructuring:

```js
var UC = window.UpstreemCore;
var fmtTotal = UC.fmtTotal, isYes = UC.isYes, highlight = UC.highlight,
    esc = UC.esc, citeName = UC.citeName, tint = UC.tint, fmtDate = UC.fmtDate,
    foldDiacritics = UC.foldDiacritics, germanExpand = UC.germanExpand,
    resolveBubbleFn = UC.resolveBubbleFn, toNum = UC.toNum, fmt1 = UC.fmt1, fmtInt = UC.fmtInt,
    CITE_COLOR = UC.CITE_COLOR, CITE_ALIAS = UC.CITE_ALIAS, ALL_CITATION_TYPES = UC.ALL_CITATION_TYPES,
    URL_TYPE = UC.URL_TYPE, ALL_URL_TYPES = UC.ALL_URL_TYPES,
    OTHER_LIGHT = UC.OTHER_LIGHT, OTHER_DARK = UC.OTHER_DARK, CHIP_BG_DARK = UC.CHIP_BG_DARK,
    MONTHS = UC.MONTHS, DEBOUNCE = UC.DEBOUNCE, MIN = UC.MIN, SORT_DEBOUNCE = UC.SORT_DEBOUNCE,
    PAGE_SIZES = UC.PAGE_SIZES, DEFAULT_PAGE_SIZE = UC.DEFAULT_PAGE_SIZE,
    TREND_UP = UC.TREND_UP, TREND_DOWN = UC.TREND_DOWN,
    CHECK_SVG = UC.CHECK_SVG, COPY_SVG = UC.COPY_SVG, GOTO_SVG = UC.GOTO_SVG,
    DONE_SVG = UC.DONE_SVG, EXT_SVG = UC.EXT_SVG,
    makeTooltips = UC.makeTooltips, makeFire = UC.makeFire,
    makePortal = UC.makePortal, placeMenu = UC.placeMenu, makeSticky = UC.makeSticky;
```

**Subsysteme** (alle als Factory/Utility, nicht als Klassen):

| Funktion | Aufrufsignatur | Was es liefert |
|---|---|---|
| `makeTooltips(root, getIsDark)` | einmal im Init | `{showTip, showTipText, showTipWide, hideTip, el}` |
| `makeFire(root, {label, eventPrefix})` | einmal im Init | `fire(attr, fallbackName, payload)` |
| `makePortal(root, menuEls[], instanceId)` | einmal im Init | `{portalLayer, syncPortalTheme}` |
| `placeMenu(menu, btn, opts?)` | beim Öffnen eines Dropdowns | — (positioniert in-place) |
| `makeSticky(root, headEl)` | einmal im Init | `{applySticky, syncTheadOffset}` |

**Persistenz-Stores:** `window.UpstreemCore.STORE` zeigt auf `window.__uutStore` (URLs-Table-spezifisch). Jede neue Komponente legt ihren eigenen Store an:
```js
var STORE = (window.__udtStore = window.__udtStore || {});
var LOADING_EXPLICIT = (window.__udtLoadingExplicit = window.__udtLoadingExplicit || {});
```
`UpstreemCore.STORE` **nicht** für andere Komponenten nutzen — das würde den URLs-Table-State überschreiben.

---

## 1. Farben

Quelle aller Werte: `core.css` (Block `.up-root`, `.up-root[data-theme="dark"]`, die Blöcke an
`:root`, `html[data-up-hell="grau"]` und `html[data-up-dunkel="geist"]`). Stand 15.10.

### Thema: Light, Dark, System (seit 15.10.)

Es gibt genau **drei** Wahlen: Light, Dark, System. „Legacy Light“ bzw. „Hell (klassisch)“ ist
als Wahl entfallen (15.10. abends: „Das Hell klassisch fällt weg als Design“). Wer es gespeichert
hatte, bekommt ohne eigenes Zutun das neue Light: `prefsLesen()` liest `light_style` nur noch
als `"gray"` und schreibt den bereinigten Stand zurück; `setUpstreemThemeOption("legacy-light")`
wird als `"light"` angenommen (Aufrufer an alten Pins).

**Das Light ist wie bei Vercel:** Seite, Seitenleiste, Topbars und Sub-Navigation **grau**
(`#fafafa`), Tabellen, Karten, Charts, Drawer und Menüs **weiß**. Umgesetzt über ein Attribut,
nicht über eine zweite Palette:

```
hellAnwenden() (core.js)   setzt html[data-up-hell="grau"], sobald hell gemalt wird
                           (Thema aus __upTheme, sonst pref_theme, sonst Betriebssystem);
                           im Dunkeln entfernt; nie auf der Landingpage (__upApp.landing)
```

Das Attribut überschreibt an jeder hellen Wurzel fünf Marken und sonst nichts:

| Marke | ohne Attribut | im grauen Light | Herkunft |
|---|---|---|---|
| `--up-surface` (Seitengrund) | `#ffffff` | `#fafafa` | Geist Background 2 |
| `--vc-border` | `#e4e2e4` | `#ebebeb` | Geist Gray 400, Default border |
| `--vc-switch-border` | `#e4e2e4` | `#ebebeb` | wie oben |
| `--vc-heading-bg` (Hover, Kopfzeilen) | `#f9f8f9` | `#f2f2f2` | Geist Gray 100; `#f9f8f9` wäre auf `#fafafa` unsichtbar |
| `--vc-field` (Eingabefeld) | `#f9f8f9` | `--vc-bg` (weiß) | Vercel: Felder weiß mit Rahmen |

**Innerhalb einer weißen Fläche ist der Grund weiß:** Drawer (`.up-kdr`, `[id^="drawer-"]`),
Portale (`.up-portal`), `.up-band`, `.up-box`, die flache Tabelle und ihr Band setzen
`--up-surface` wieder auf `--vc-bg`. Was dort „Seitenfarbe“ sagt (klebender Kopf, Gesamtzeile),
ist die Farbe dieser Fläche. Ohne das Attribut (Landingpage, erstes Bild vor dem Kopf-Skript)
gelten die Werte der linken Spalte.

**Gewählter Zustand im Light** (Seitenleiste, Reiter der Sub-Navigation `.up-ph-navpille`,
Navigation im Preferences-Fenster, gedrückte Knöpfe): die Farbe aus Geists Seitennavigation.

```
--up-wahl-bg:   #ededed           deckend, die Farbe des Vorbilds (Screenshot des Nutzers)
--up-wahl-rand: rgba(0,0,0,.03)   1px, über dem Grund #e6e6e6
```

- **Seitenleiste ohne Rand** (15.10. spät: „die Sidebar Nav Items ohne Border im selected
  State!“): nur der Grund, wie bei Geist.
- **Sub-Navigation, Preferences, gedrückte Knöpfe** behalten einen Rand („weiterhin eine
  Border“), aber nur einen Hauch dunkler als der Grund. Wo ein echter Rand die Zeile um einen
  Pixel verschöbe, steht er als `box-shadow: inset 0 0 0 1px var(--up-wahl-rand)`.
- Bis 15.10. spät: Grund 5 % Schwarz und Rand 8 % darüber, zusammen `#dadada`. Das war die harte
  Kontur, die der Nutzer „zu dunkel“ fand; der Grund selbst war schon fast `#ededed`.
- Nur das Gewählte trägt den Rand, der Hover nicht.

**Das Dark ist das Spiegelbild** (15.10. abends, „Darkmode … sieht sehr off und übel unordentlich
aus“): dieselben Rollen mit Geists dunkler Skala. Seite, Seitenleiste, Topbars und Sub-Navigation
**Background 2 `#000`**, Tabellen, Karten, Charts, Drawer, Menüs und Felder **Background 1
`#0a0a0a`** -- der Inhalt ist im Dunkeln also eine Spur HELLER als die Seite, wie im
Vercel-Dashboard. Vorher lag im Dunkeln alles auf einem Grund (`#101114`), getrennt nur durch
Ränder, in Linears blaustichigen Tönen neben neutralen Resten aus älteren Zeiten.

**Eine Stufe ruhiger** (15.10. spät, „das Dunkel wirkt zu dolle“; Vorbild ist das Dunkel der
Design-Leinwand der Benachrichtigungen): dieselben Rollen und Geists Abstände, die ganze Leiter
angehoben. **Seite `#0a0a0a`, Inhalt `#0f0f0f`, Linie `#222222`** (8 % Weiß auf dem Inhalt, deckend
gerechnet, weil `--vc-border` auch als Fläche und in `color-mix` steht). Hover und Auswahl ziehen im
selben Abstand mit (+16 / +21 / +31 über dem Inhalt), der Rand schwebender Schichten wird eine Stufe
leiser (`#333333`, Geists Ring 14,5 % auf dem Inhalt). Unverändert: die Schrift, der ausgeschaltete
Schalter (`#454545`) und alles Durchscheinende (Gewählt, Schiene, Pille).

```
hellAnwenden() (core.js)   setzt html[data-up-dunkel="geist"], sobald dunkel gemalt wird;
                           eigener Name, nicht ein zweiter Wert von data-up-hell
core.css                   Marken am dunklen .up-root und an :where(html[data-up-dunkel]) [data-theme="dark"];
                           Block "DAS DUNKEL NACH GEIST: SEITE UND INHALT" spiegelt jede Regel des grauen Hells
```

Gemessen an vercel.com/geist im dunklen Thema (Stylesheet `.dark-theme`, sRGB, 15.10.):
Background 1 `#0a0a0a`, Background 2 `#000000`, Gray 100 `#1a1a1a`, 200 `#1f1f1f`, 300 `#292929`,
400 `#2e2e2e`, 500 `#454545`, 600 `#878787`, 700 `#8f8f8f`, 800 `#7d7d7d`, 900 `#a1a1a1`, 1000
`#ededed`; Gray Alpha 100 bis 500 = 6 / 9 / 13 / 14 / 24 % Weiß. Menüs, Popover, Tooltips-Materialien
und Dialoge tragen dort Background 1 mit einem Ring aus 14,5 % Weiß; Menü-Hover Gray Alpha 100;
gewählter Punkt der Seitennavigation Gray Alpha 100 ohne Rand; Input Background 1 mit Ring Gray
Alpha 400; Secondary-Knopf Background 1, Hover Gray 200, Rand Gray 400.

**Gewählter Zustand im Dark:** `--up-wahl-bg: rgba(255,255,255,.06)` (Gray Alpha 100),
`--up-wahl-rand: rgba(255,255,255,.03)`. Durchscheinend statt deckend wie im Light, weil dieselbe
Stufe auf `#000` (Seitenleiste) und `#0a0a0a` (Preferences) sichtbar bleiben muss; auf der Seite
ergibt sie `#0f0f0f` -- in L* derselbe Schritt wie `#ededed` auf `#fafafa` (4,1 gegen 4,3).
Seit „eine Stufe ruhiger“ auf der Seite `#0a0a0a` → `#191919`, in der Seitenspalte der Preferences
(`#1f1f1f`) → `#2c2c2c`.
Seitenleiste ohne Rand, Sub-Navigation, Preferences, Events-Arten und gedrückte Knöpfe mit dem Hauch.

**Dunkle Elemente im Light** (die Bulk-Leiste der Prompts-Tabelle ist im Light eine dunkle Leiste)
lesen weiter die alte Zeile `[data-theme="dark"]` an `:root` mit den Linear-Werten -- das Light
darf sich nicht ändern. Das dunkle Thema überschreibt sie nur unter `html[data-up-dunkel]`.

**Themenschalter** nach Geist: `UC.themeSchalterHtml({ klein, wahl })`, siehe Abschnitt 5.

### Light (`.up-root`)
| Rolle | Variable | Wert |
|---|---|---|
| Primär-Fontfarbe | `--vc-text` | `#1f1f1b` |
| Zweite Stufe (Beschriftungen) | `--vc-muted` | `#3e4146` |
| Dritte Stufe (Metadaten, Platzhalter, Zeichen) | `--vc-third` | `#6b6f78` |
| Vierte Stufe (Zähler, Etiketten der Gesamtzeile) | `--vc-fourth` | `#80858e` |
| Border | `--vc-border` | `#e4e2e4` (grau: `#ebebeb`) |
| Karte, Tabelle, Menü | `--vc-bg` | `#ffffff` |
| Seitengrund | `--up-surface` | `#ffffff` (grau: `#fafafa`) |
| Hover-/Heading-Background | `--vc-heading-bg` | `#f9f8f9` (grau: `#f2f2f2`) |
| Skeleton-Grundfarbe | `--vc-sk` | `#eeedef` |
| Menü / Auswahl im Menü / Menürand | `--up-menu-bg` / `--up-sel-bg` / `--up-menu-border` | `#ffffff` / `#f4f2f4` / `#dcdbdd` |
| Schiene / Pille eines Umschalters | `--vc-switch-rail` / `--vc-switch-pill` | `#f2f2f2` / `#ffffff` |
| Switch-Border | `--vc-switch-border` | `#e4e2e4` (grau: `#ebebeb`) |
| Eingabefeld | `--vc-field` | `#f9f8f9` (grau: `#ffffff`) |
| Tabellen-Head-BG / Row-Hover | `--vt-head-bg` / `--vt-row-hover` | `#f9f8f9` / `#f9f8f9` |
| Logo-Box-BG | `--vt-logo-bg` | `#ffffff` |
| Akzent Fläche / Schrift darauf / Akzent als Schrift | `--up-accent` / `--up-accent-fg` / `--up-accent-ink` | `#1f1f1b` / `#ffffff` / `#1f1f1b` |
| Fokus / Fokusring | `--up-focus` / `--up-focus-ring` | `#4A9EFF` / `rgba(74,158,255,0.20)`, Breite `--up-focus-w` 2px |
| Gefahr-Knopf | `--vc-danger` / `--vc-danger-fg` | `#da2f35` (Geist Red 800) / `#ffffff` |

### Dark (`.up-root[data-theme="dark"]`, seit 15.10. Geist, eine Stufe ruhiger)
Spalte „Geist“ nennt die Stufe, deren ROLLE der Wert trägt; seit „eine Stufe ruhiger“ (15.10.
spät) liegt jeder Wert eine Stufe über Geists eigenem (der steht in Klammern), die Abstände sind
dieselben. „bis 15.10.“ ist der Stand vor Geist (Linear).

| Rolle | Variable | Wert | Geist | bis 15.10. |
|---|---|---|---|---|
| Primär-Fontfarbe | `--vc-text` | `#ededed` | Gray 1000 (seit 16.10.; vorher `#e0e0e0`) | |
| Zweite / dritte / vierte Stufe | `--vc-muted` / `--vc-third` / `--vc-fourth` | `#c9c9c9` / `#a1a1a1` / `#7d7d7d` | neutral statt blaustichig (seit 16.10., vorher `#c9cbd0` / `#a0a0a0` / `#6c717a`): `--vc-third` Gray 900, `--vc-fourth` Gray 800 (4,8:1 auf `#0a0a0a`, seit „eine Stufe ruhiger“ 4,7:1 auf dem Inhalt `#0f0f0f`); `--vc-muted` hat bei Geist keine Stufe, derselbe Wert ohne Blaustich. Nur unter `html[data-up-dunkel]`; Menüs und Tooltips mit eigener Leiter Wert für Wert getauscht | |
| Border, Linie | `--vc-border` | `#222222` | Gray 400 (`#2e2e2e`); 8 % Weiß auf `#0f0f0f`, deckend | `#34343a` |
| Inhalt: Karte, Tabelle, Chart, Drawer | `--vc-bg` | `#0f0f0f` | Background 1 (`#0a0a0a`) | `#1c1c1f` |
| Seitengrund (Seite, Seitenleiste, Kopf) | `--up-surface`, `--up-seite-dunkel` | `#0a0a0a` | Background 2 (`#000000`) | `#101114` |
| Hover-/Heading-Background | `--vc-heading-bg` | `#1f1f1f` | Gray 100 (`#1a1a1a`), +16 über dem Inhalt | `#232326` |
| Skeleton-Grundfarbe | `--vc-sk` | `#1e1e1e` (Glanz 2,5 % Weiß, bis `#242424`) | wie die Leinwand (Geist: Gray 100 → 200) | `#28282c` |
| Menü / Auswahl / Menürand | `--up-menu-bg` / `--up-sel-bg` / `--up-menu-border` | `#0f0f0f` / `#242424` / `#333333` | Bg 1 / Gray 200 (+21) / Geists Ring 14,5 % (`#0a0a0a` / `#1f1f1f` / `#454545`) | `#232326` / `#28282c` / `#3e3e44` |
| Schiene / Pille | `--vc-switch-rail` / `--vc-switch-pill` | `rgba(255,255,255,.06)` / `rgba(255,255,255,.09)` | Gray Alpha 100 / 200 | `.055` / `.07` |
| Switch-Fläche / -Rand / Aus-Schiene | `--vc-switch-bg` / `--vc-switch-border` / `--up-switch-off` | `#1f1f1f` / `#222222` / `#454545` | Gray 100 / 400 / 500 (`#1a1a1a` / `#2e2e2e` / Aus unverändert) | `#232326` / `#34343a` / `#444444` |
| Eingabefeld | `--vc-field` | `#0f0f0f` (mit Rand) | Background 1 (`#0a0a0a`) | `#232326` |
| Tabellen-Head-BG / Row-Hover | `--vt-head-bg` / `--vt-row-hover(-solid)` | `#0f0f0f` / `#1f1f1f` | Bg 1 / Gray 100 (`#0a0a0a` / `#1a1a1a`) | `#232326` / `#232326` |
| Chips: gewählt / gewählt+Hover / Rand Hover / Rand gewählt+Hover | `--up-chip-an` / `-an-hover` / `--up-chip-rand-hover` / `-rand-an-hover` | `#242424` / `#2e2e2e` / `#333333` / `rgba(255,255,255,.24)` | Gray 200 / 300 / Ring / Alpha 500 (`#1f1f1f` / `#292929` / `#454545`) | `#26262a` / `#2c2c30` / `#4a4a52` / `#5a5a62` |
| Event-Pin-Rand | `--up-evm-rand` | `#333333` | wie der Menürand (`#454545`) | `#4a4a52` |
| Gewählt (Navigation) | `--up-wahl-bg` / `--up-wahl-rand` | `rgba(255,255,255,.06)` / `rgba(255,255,255,.03)` | Gray Alpha 100 | (Seitenleiste `#28282c`) |
| Logo-Box-BG | `--vt-logo-bg` | `#e0e0e0` | | |
| Akzent | `--up-accent` / `--up-accent-fg` | `#e0e0e0` / `#1b1b1b` | (unverändert) | |
| Fokus / Fokusring | `--up-focus` / `--up-focus-ring` | `#6DB2FF` / `rgba(109,178,255,0.28)` | | |

Die Linien-Charts lesen im Dunkeln Achse `#222222`, Punktkern `#0f0f0f` und Raster 6 % Weiß
(`themeColors` in core.js; bis „eine Stufe ruhiger“ `#2e2e2e`, `#0a0a0a`, 9 % -- das Raster ging mit,
weil es schwächer als die Achse bleiben soll: 9 % lägen auf `#0f0f0f` mit `#252525` über ihr). Das
Dimm-Grau abgewählter Doughnut-Segmente ist `#2e2e2e` (vorher `#292929`, +31 über dem Inhalt). Die
Tooltips tragen `--up-menu-bg`/`--up-menu-border` und die Schriftstufen statt eigener Werte
(`#232326`, `#e6e6e6`, `#8a8a8a`).

### Zustandsfarben nach Geist (seit 15.10., an `:root`)

Quelle: Vercels eigene Werte (vercel.com/geist/colors, sRGB-Fassung). Geists Rollen werden
übernommen: **Schrift und Zeichen** Stufe 900, **Fläche** (Ring, Punkt, Balken) 700/800,
**Notiz** Grund 100 mit Rand 400. Die Marken stehen an `:root` (nicht nur an `.up-root`), damit
Tooltips, Dialoge und Menüs am `<body>` sie erreichen; eigene Kopien in Komponenten sind entfernt.

| Rolle | Variable | Light | Dark |
|---|---|---|---|
| Trend positiv, Text „gut“ | `--vt-up` (= `--vc-pos`) | `#297a3a` (Green 900) | `#62c073` |
| Trend negativ, Fehlertext | `--vt-down` (= `--vc-neg`) | `#cb2a2f` (Red 900) | `#ff6166` |
| Fläche gut (Kontingent-Ring, Punkt „Active“) | `--vt-up-flaeche` | `#45a557` (Green 700) | `#45a557` |
| Fläche Fehler (Kontingent ab Limit) | `--vt-down-flaeche` | `#da2f35` (Red 800) | `#d93036` |
| Fläche Warnung | `--vt-warn-flaeche` | `#ffb224` (Amber 700) | `#ffb224` |
| Notiz positiv: Grund | `--vc-pos-bg` | `#effbef` | `#0b2212` |
| Notiz negativ: Grund / Rand | `--vc-neg-bg` / `--vc-neg-border` | `#fff0f0` / `#fdd8d8` | `#2a1314` / `#671e21` |
| Warnung: Text / Grund / Rand | `--vc-warn` / `--vc-warn-bg` / `--vc-warn-border` | `#a35200` / `#fff6e5` / `#ffdd8f` | `#f2a20d` / `#291800` / `#573300` |

Bis 15.10. war es `#2ea84a`/`#b0200c` (hell) und `#60d25d`/`#d25d5d` (dunkel); `#2ea84a` lag auf
Weiß bei 3.08 und damit unter AA. Jetzt auf Weiß 5.33 und 5.37.

**Das Grün des Prompt-Kontingents** (Ring in Prompt Insights, `prompts-page.css`): Bogen
`--vt-up-flaeche`, ab dem Limit `--vt-down-flaeche`. Flächenstufe, nicht die Schriftstufe 900.

> **Akzentfarbe.** Von Haus aus ist der Akzent die Fontprimärfarbe des Themes (`--up-accent`
> `#1f1f1b` hell, `#e0e0e0` dunkel). Er trägt jeden „aktiv / ausgewählt / primär“-Zustand:
> Switches, Checkboxen, Primär-Buttons, aktive Seite der Pagination, Slider-Füllung. Seit dem
> 18.09. ist er in den Preferences wählbar (`html[data-accent]`: Indigo `#5E6AD2`, Azur
> `#0075DE`, Terrakotta `#BD5836`, dazu „Standard + Blau“ nur für Chartlinien). Komponenten lesen
> deshalb immer `--up-accent`/`--up-accent-fg`/`--up-accent-ink`, nie `--vc-text` für einen
> Akzent. Teal `#14b8a6` ist ersatzlos gestrichen.
>
> Davon **nicht** betroffen sind die semantischen Paletten: Citation- und URL-Type-Farben
> (1a/1b), Zustandsfarben (oben), Chartfarben und die Sentiment-Ampel. Das sind
> Datenkodierungen, keine Akzente.

### Chartfarben nach Geist (seit 15.10.)

- **Linienpalette „Geist“** (`GEIST_LINIEN` in `core.js`, Vorgabe der Farbskala,
  `SCALE_VORGABE = "geist"`): `#0072f5` Blue, `#ff990a` Amber, `#8e4ec6` Purple, `#12a594`
  Teal, `#ea3e83` Pink, `#45a557` Green, `#e5484d` Red, `#8f8f8f` Gray. Geists Stufe 700, in
  beiden Themen derselbe Ton; Amber als 800, weil 700 auf Weiß kaum zu sehen wäre. Wer eine
  andere Skala gespeichert hat (Linear, Tableau ...), behält sie. Bis 15.10. Tailwind 500.
- **Märkte** (`MARKT_FARBEN`): `#0072f5`, `#99ceff`, `#00254c`, `#52aeff`, `#0a4380`, `#cce6ff`,
  `#0062d1`, `#0090ff` (Geist Blue, hell und dunkel gemischt).
- **Tarifpunkte**: Essential `#12a594`, Professional `#0072f5`, Enterprise `#8e4ec6`.

### Feste (nicht theme-abhängige) Farben
- Icon-Buttons: Ruhe `--vc-third`, Hover `--vc-text` (über die Marke, nicht mehr hart `#6f6f6f`)
- Primär-Button-Hover: nur `opacity: .88`, keine zweite Farbe
- Sentiment-Ampel (`UC.sentColor`, seit 15.10. Geist, in beiden Themes gleich): ≤25 `#E5484D`,
  ≤40 `#FF990A`, ≤60 `#8F8F8F`, ≤75 `#6CDA75`, sonst `#45A557`. Bis 15.10. `#D25D5D`,
  `#D2865D`, `#9E9E9E`, `#9FD25D`, `#60D25D`.
- Icon-Tooltip `.up-tip`: BG `#1f1f1b`, Text `#ffffff`; an einem Element mit
  `data-theme="dark"` BG `#f0f0f0`, Text `--vc-text-invert` (Geists Tooltip ist im Dunkeln
  ebenfalls hell: gemessen `#fff` mit `#171717`)

---

## 1a. Citation-Type-Farben (Stand 15.10.)

Quelle der Werte: `CITE_TYPE` und `TYPE_OTHER` in `core.js`. Zuordnung und **Werte** sind die von
Variante D (13.10., Branchenkonvention: Competition rot, Brand Platforms orange, Editorial blau, UGC
türkis, Knowledge-Base violett, Institutional schiefergrau). Der Geist-Umbau vom 15.10. abends hatte
sie kurz auf Geists Skalen gestellt; auf Wunsch des Nutzers sind die **Farben wieder die von
vorher** („nur die Chip-Form und Abmessungen“), die Form ist das Geist-Badge (unten).

| Citation Type | fill | fillDark | ink | inkDark | bg | bgDark |
|---|---|---|---|---|---|---|
| Editorial | `#7493C7` | `#8BA6D1` | `#375587` | `#B4CCF2` | `#F0F7FF` | `#1D232E` |
| UGC / Community | `#49A1AB` | `#6DB2B9` | `#00636D` | `#9CD6DD` | `#EAFBFD` | `#162628` |
| Knowledge-Base | `#9688C1` | `#A79CCC` | `#594A82` | `#CDC3EE` | `#F7F5FF` | `#23212C` |
| Brand Platforms | `#BB845F` | `#C8997B` | `#7B461E` | `#EAC1A6` | `#FFF4EC` | `#2B2019` |
| Institutional | `#8195A6` | `#97A7B5` | `#455868` | `#BECDDA` | `#F3F7FB` | `#1F2327` |
| Competition | `#C17E78` | `#CD948F` | `#803F3B` | `#EFBCB7` | `#FFF2F1` | `#2D1F1D` |
| You | `#1F1F1B` | `#E0E0E0` | `#FFFFFF` | `#1B1B1B` | `#1F1F1B` | `#E0E0E0` |
| Fallback / Uncategorized | `#9E9E9E` | `#808080` | `#5F636B` | `#A8A8A8` | `#F5F5F5` | `#262626` |

- **fill**: Flächen in Charts (Doughnut, Balken, Legendenpunkt) und der Punkt im URL-Chip.
- **ink, bg**: Schrift und Grund des Chips. In den Grund werden 7 % der Typfarbe (`fill`)
  gemischt (`chipGrund`/`hexMisch`, seit 14.10.: „minimal mehr Opacity, so dass der Kontrast der
  Schrift noch stimmt“). Der Rand liegt in der Grundfarbe und ist damit unsichtbar; `bd` steht nur
  noch in den Daten.
- **You** trägt die Akzentfarbe des Themes (Abschnitt 1) und ist als einziger Chip invertiert.
- **Lesen** immer über `UC.typeStyle("citation" | "url", roh, isDark)` → `{ fill, ink, bg, bd, dot }`; Ringe und Legenden über `UC.typeColor` (= `fill`). Keine Komponente hält eine eigene Kopie.

**Kontrast** Schrift auf Grund (WCAG, Kopfkommentar in `core.js`): Typen hell 6.6 bis 7.1, dunkel
9.5 bis 9.7; Rückfall 5.5 / 6.4; You 16.5 / 13. Die 7-%-Beimischung hält alle über 4.5.

**Chip-Form: ein Geist-Badge** (seit 15.10., `core.css` „DER TYP-CHIP IST EIN GEIST-BADGE“).
EINE Regel für jeden Citation- und URL-Type-Chip (`.up-tag`, `.up-filter-tag`, `.udt-tag`,
`.uut-tag`, `.tct-tag`), Komponenten behalten nur Lage und Kürzung. Farben weiter inline aus
`UC.typeStyle`.

```
                 md (Tabellenzeile, Filter)   sm (Drilldown, Erklärkarten)
Höhe             24  --up-badge-h             20  --up-badge-h-s
Polster          0 12px                       0 8px
Abstand          5px                          4px
Schrift          12 / 500, tabular-nums       11 / 500, Sperrung 0.2px
Radius           voll rund (--up-r-voll)      voll rund
Rand             1px in bg (unsichtbar)       wie md
```

Bis 15.10. waren es 24px hoch, Polster 10, Radius 7 und ein sichtbarer Rand in `bd`.

> **Unverändert gilt:** Citation Types haben KEINEN Punkt im Chip, URL Types haben IMMER einen
> (`.up-tag-dot` 6×6px, voll rund, im Abstand des Badges).

Aliase auf dem Weg zu diesen Keys (`CITE_ALIAS`/`citeName()`): `Brand_Platform`/`Brand Platform` →
`Brand Platforms`, `Knowledge_Base`/`Knowledge Base` → `Knowledge-Base`, `UGC_Community`/
`UGC Community` → `UGC / Community`.

---

## 1b. URL-Type-Farben (Stand 15.10.)

Quelle: `URL_FAMILY` und `URL_TYPE` in `core.js`, Werte von Variante D (13.10.), seit dem 15.10.
spät wieder in Kraft (siehe 1a). Es gibt **drei Chip-Farben**, eine je Familie, dieselben Töne wie
Brand Platforms, Editorial und Knowledge-Base in 1a. Die Typen unterscheiden sich im Chip durch die
Beschriftung und durch den **Punkt**, der die Chart-Fläche des Typs trägt.

**Chip je Familie**

| Familie | ink | inkDark | bg | bgDark |
|---|---|---|---|---|
| Commercial | `#7B461E` | `#EAC1A6` | `#FFF4EC` | `#2B2019` |
| Editorial | `#375587` | `#B4CCF2` | `#F0F7FF` | `#1D232E` |
| Reference, community, media | `#594A82` | `#CDC3EE` | `#F7F5FF` | `#23212C` |
| Fallback | `#5F636B` | `#A8A8A8` | `#F5F5F5` | `#262626` |

**Fläche je Typ** (Chart und Chip-Punkt):

| Typ | Familie | fill | fillDark |
|---|---|---|---|
| Homepage | Commercial | `#845738` | `#F1C7AC` |
| Product / Service | Commercial | `#A57656` | `#D2AA8F` |
| Marketplace | Commercial | `#C89675` | `#B48D73` |
| Company Info | Commercial | `#EBB896` | `#977158` |
| Article | Editorial | `#4A648E` | `#BAD2F9` |
| Listicle | Editorial | `#607BA7` | `#A4BCE2` |
| Guide | Editorial | `#7793C1` | `#8FA6CB` |
| Comparison | Editorial | `#8FACDB` | `#7A90B4` |
| Review | Editorial | `#A8C6F5` | `#667B9E` |
| Documentation | Reference | `#665A8A` | `#D3CAF5` |
| Forum | Reference | `#7D71A2` | `#BDB4DE` |
| Directory | Reference | `#9589BC` | `#A79EC7` |
| Video | Reference | `#AEA2D6` | `#9188B1` |
| Social Post | Reference | `#C7BBF0` | `#7C749B` |
| Uncategorized | Fallback | `#9E9E9E` | `#808080` |

Hell gestaffelt von dunkel nach hell, im Dark Mode **gegenläufig** von hell nach dunkel, damit der
erste (meist größte) Typ einer Familie in beiden Themes am stärksten wirkt.

`URL_COLOR_CHART`/`URL_COLOR_DARK` gibt es weiter, aber nur als Ableitung aus `fill`/`fillDark`.

**Chip-Maße:** wie 1a (Geist-Badge), plus Punkt.

---

---

## 1c. Datums- und Zahlenformate

**Prozentwerte — immer durch `UC.fmtPct(v)`, nie selbst `Math.round(v) + "%"`.**

Ein Wert, der echt über null liegt, aber auf null rundet, darf **nie** `0%` anzeigen — er zeigt
`<1%`. `0%` und „kommt überhaupt nicht vor" sind zwei verschiedene Aussagen, und der Leser kann
sie sonst nicht auseinanderhalten. Schwelle ist `Math.round(v) === 0`, also unter 0.5; 0.7 rundet
auf 1 und zeigt `1%`.

```js
UC.fmtPct(0)     // "0%"      wirklich null
UC.fmtPct(0.3)   // "<1%"     über null, rundet auf null
UC.fmtPct(0.7)   // "1%"
UC.fmtPct(42.4)  // "42%"
```

Fehlende Werte (`null`, `""`) sind davon unberührt und bleiben der `–`-Platzhalter — auch das ist
eine dritte, eigene Aussage.

Einzige Ausnahme: **Achsen-Ticks** bleiben roh (`Math.round(v) + "%"`). Ein Tick mit `0` ist eine
Skalenposition, keine Messung.

**Datum — app-weit einheitlich:** `dd. mmm yyyy`

```
24. Jul 2026        (nicht 24.07.2026, nicht Jul 24 2026)
```
Tag immer zweistellig mit führender Null, Monat als englische Drei-Buchstaben-Abkürzung
(`Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec`), Jahr vierstellig, Punkt nach dem Tag.

Implementierung (aus `domains_table.html`, direkt übernehmbar):
```js
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(v){
  if (v == null || v === "") return "–";
  var d = new Date(String(v));
  if (isNaN(d.getTime())) return "–";           // nie "Invalid Date" rendern
  return String(d.getDate()).padStart(2,"0") + ". " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}
```
Nicht parsebare oder fehlende Werte rendern als Gedankenstrich `–`, nie als leere Zelle
oder „Invalid Date".

**Datumsbereiche** (Kalender-Label, Export-Zusammenfassung): dasselbe Format,
verbunden mit einem Gedankenstrich und Leerzeichen:
```
18. Jul 2026 – 24. Jul 2026
```

**Nachkommastellen je Kennzahl** legt CLAUDE.md §2b fest, nicht eine Regel für alle Prozente:
Visibility und Share of Voice in Zellen 1 (`UC.fmtPct(v, 1)` → `34.3%`), Rank immer 1 (`3.0`),
Sentiment und Mention Count 0, Trend 1. Chart-Tooltips je Chart (ebenda). Bewusste Ausnahme:
der Visibility Chart (Top Brands) zeigt Visibility und Trend ganzzahlig. Fehlender Wert → `–`.
Bis zum 15.10. stand hier „Prozentwerte immer eine Nachkommastelle“, das widersprach `UC.fmtPct`
(Standard 0) und §2b.

**Ganze Zahlen** (Counts): ohne Nachkommastellen; unter 1000 als Ganzzahl (`999`), ab 1000 im
Kompaktformat darunter (`1.4k`), nie mit Tausender-Trennzeichen.

**Counts in Tabellenzellen und Überschriften — Kompaktformat.** Jede Zahl, die eine
Menge zählt (Total-Count neben der Überschrift, „Used", Treffer, Zeilen), nutzt
dasselbe kompakte Format. Es gilt app-weit, damit dieselbe Größenordnung überall
gleich aussieht:

```
< 1000        gerundete Ganzzahl              999
< 10 000      zwei Nachkommastellen, k        1.23k   ·  4.5k  ·  9k
< 1 000 000   eine Nachkommastelle, k         12.3k   ·  340k
sonst         eine Nachkommastelle, m         1.4m
```
Überflüssige Nullen fallen weg: `4.50k` wird zu `4.5k`, `9.00k` zu `9k`.

```js
function fmtTotal(n){
  n = Number(n) || 0;
  if (n < 1000) return String(Math.round(n));
  var k = n / 1000;
  if (n < 10000)   return (Math.round(k * 100) / 100).toFixed(2).replace(/0+$/,"").replace(/\.$/,"") + "k";
  if (n < 1000000) return (Math.round(k * 10) / 10).toFixed(1).replace(/\.0$/,"") + "k";
  return (Math.round((n/1000000) * 10) / 10).toFixed(1).replace(/\.0$/,"") + "m";
}
```
Fehlender oder nicht parsebarer Wert → `–`, nie `0` und nie eine leere Zelle.
Zahlen in Zellen bekommen zusätzlich `font-variant-numeric: tabular-nums`, sonst
tanzen sie beim Sortieren.

**Trend-Chips:** Betrag mit einer Nachkommastelle plus Pfeil-Icon, Vorzeichen steckt in
Farbe und Pfeilrichtung, nicht im Text. Rundet der Wert auf `0.0`, wird gar kein Chip
gezeigt (statt eines nichtssagenden „0.0%").

---

## 2. Typografie

- **Font-Family überall:** `Geist, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`
- Alles `-webkit-font-smoothing: antialiased`

| Element | Size | Weight | Farbe | Sonstiges |
|---|---|---|---|---|
| Heading (Chart-Titel) | 14px | 500 | `--vc-text` | line-height 1.2, ellipsis |
| Tabellen-Header-Label (`.up-root .up-th`, `.vt-th`, `.tct-th`) | 14px | 500 | `--vc-muted` | seit 15.10. für jede Tabelle (vorher 12/400, flach 13/500); Zeichen im Kopf 15px |
| Tabellen-Zelle (Brand-Name) | 14px | 500 | `--vc-text` | ellipsis |
| Tabellen-Zahlen (`.up-num`) | 14px | 500 | `--vc-text` | tabular-nums |
| Trend-Chip (`.up-trend`) | 13px | 600 | `--vt-up`/`--vt-down` | Pfeil 16×16, gap 4px |
| Sentiment-Wert | 14px (wie `.up-num`; im Kontext so gross wie Visibility/Rank daneben) | 500 | `--vc-text` | — |
| Gesamtzeile: Wert / Etikett (`.up-sumwert` / `.up-sumlabel`) | 16px / 13px | 600 / 500 | `--up-accent-ink` / `--vc-fourth` | Abschnitt 8e |
| Leerzustand: Titel / Satz (`.up-leer`) | 16px / 14px | 500 / 400 | `--vc-text` / `--vc-muted` | Zeilenhöhe 24 / 20 |
| Suchfeld offen (`.up-search-input`) | 14px | 400 | `--vc-text` | bis 15.10. 14/500 |
| Legend-Name (Line-Chart) | 12px | 500 | `--vc-text` | max-width + ellipsis |
| Dropdown-Head (`.up-pop-head`, `.up-label`) | 12px | 600 | `--vc-third` | keine Versalien |
| Dropdown-Item | 13px – 13.5px | 500 | `--vc-text` | — |
| Filter-Item | 13px | normal | `--vc-text` | — |
| Filter-Counter (7/7) | 11px | 600 | `--vc-muted` | tabular-nums |
| Icon-Button-Tooltip | 12px | 500 | invertiert (s.o.) | line-height 1 |
| Switcher-Label (Day/Week/Month) | 12px | 500 | `--vc-muted` → `--vc-text` aktiv | — |
| Segmented-Switcher (`.up-seg`, Doughnut/Bar) | – (nur Icon) | – | `--vc-muted` → `--vc-text` aktiv | 14×14 Icon |

---

## 2a. Icons

**Alle Icons kommen aus `UC.icon(name, strokeWidth)`** (`ICON_PATHS` in `core.js`), nie selbst
gezeichnet. Der Satz ist seit dem 22.09. **Hugeicons 4.3.5, stroke-rounded** (vorher Lucide,
davor Feather; die Schlüssel sind geblieben). Einzelne Zeichen sind wörtlich aus Lucide
übernommen (z. B. die Sortierpfeile im Spaltenkopf), `linkFeather` ist das Feather-„link“.
Inline als SVG, nie als Font oder externes Sprite, damit sie `currentColor` erben und im Dark
Mode automatisch mitgehen.

Standard-Attribute (die Hülle von `icon()`):
```html
<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
```
- Gezeichnet ist der Satz für Strichstärke 1.5; Aufrufer mit 2 bekommen ein etwas
  kräftigeres Bild (gewollt). Ein Häkchen in einer Checkbox darf auf 3 gehen.
- **Keine gefüllten Icons** für „aktiv“ oder „gespeichert“: den Zustand zeigt der Knopf, das
  Zeichen bleibt Strich. Farbe kommt ausschließlich über `color` des Elternelements.
- Größen: 16×16 in Icon-Buttons, 15×15 im Tabellenkopf (Kopfzeichen, Info, Sortierpfeile),
  14×14 in Trigger-Chevrons, Info-Icons außerhalb des Kopfs und offener Suchlupe, 11×11 in
  Checkboxen.
- Ein unbekannter Name liefert `""` und einen Konsolenfehler. Wer das Ergebnis in eine eigene
  Hülle setzt, hat ein Loch; darum prüfen Bausteine wie `UC.kopfZeichenHtml` das Ergebnis.

---

## 3. Spacing / Gaps / Radius / Tiefe

### Radius-Skala nach Geist (seit 15.10.)

Die Stufen sind die von Geist (vercel.com/geist/materials): 4, 6, 8, 12, 16 und rund, nichts
dazwischen. Gegenüber vorher (4/6/8/10/12/16/32) ist alles eine Stufe kleiner.

| Token | Wert | Rolle | bis 15.10. |
|---|---|---|---|
| `--up-r-xs` | 4px | Punkt, Haken, Checkbox, Plakette, Knopf im Segment | 4 |
| `--up-r-s` | 4px | Chip, Tag, Knopf bis 24px, Menüzeile im 12er-Menü | 6 |
| `--up-r-m` | 6px | Knopf, Feld 32 bis 36px, Segment, Logo-Box, Tooltip einzeilig | 8 |
| `--up-r-l` | 8px | Knopf und Feld ab 40px, Kachel, Tooltip mehrzeilig | 10 |
| `--up-r-xl` | 8px | Karte innen, große Logoplatte, Vorschaubild | 12 |
| `--up-r-2xl` | 12px | Karte, Box, Tabelle, Dialog, Toast, Erklärkarte | 16 |
| `--up-r-3xl` | 16px | ganzseitige Fläche (heute das Anmeldefeld `.uau-panel`) | 32 |
| `--up-r-voll` | 999px | alles ganz Runde (Badge, Avatar, Switch) | 999 |
| `--up-dd-radius` | 12px | jedes Menü; steht auch an `:root` | 14 |

`s = xs` und `xl = l` tragen denselben Wert, weil zwei alte Rollen auf dieselbe Geist-Stufe
fallen. Die Namen bleiben getrennt: sie sagen, **was** gerundet wird. `--up-dd-radius` ist seit
dem 15.10. **keine Ausnahme** mehr, sondern die Kartenstufe 12.

**Die Regel nach Rolle**, nicht nach Gefühl:

```
Knopf, Feld, Segment, Zeile   nach ihrer Höhe:  bis 24 -> 4,  25-36 -> 6,  ab 37 -> 8
Menü                          12; die Zeile darin konzentrisch (Polster 8 -> 4, Polster 6 -> 6)
Karte, Tabelle, Dialog,
Toast, Erklärkarte            12; ihre direkten Kinder 11
Tooltip                       einzeilig 6 (.up-tip), mehrzeilig 8 (Chart-Tooltips)
Badge, Avatar-Gruppe          voll rund
```

**Konzentrische Kinder gibt es weiterhin**: innen = außen minus Abstand, dann auf die nächste
Stufe gerundet. Geschrieben wird das Kind aus dem Token, nicht als Zahl: ein Bild mit 1px Rand
in einer 6er-Ecke `calc(var(--up-r-m) - 1px)`, das Bild im Logo-Stapel (Rand 1 plus Polster 2)
`calc(var(--up-r-m) - 3px)`. Fest stehen nur noch 0, 50 %, Haarlinien unter 4 (Flaggen 3,
Markierungsstriche 2 und 1) und die em-Werte in Miras Text.

**Alte Zahlen in Kommentaren** (vor dem 15.10.) meinen die alte Skala. Zuordnung alt → neu
(Radius-Block in `core.css`): 4 → 4, 6 → 4, 8 und 9 → 6, 10 bis 12 → 8, 14 bis 18 → 12,
32 → 16. Maßgeblich ist die Rolle, nicht der Kommentar.

### Maße

| Kontext | Wert |
|---|---|
| Luft unter Seitenkopf bzw. Reiterleiste bis zur ersten Zeile | **16px** (`--up-band-luft`), auf jeder Seite und in jedem Reiter; mit Filterzeile 16 über und 16 unter ihr. Seitenende 64. Eine Regel in core (`:is(.ucs-main, .uds-main, .upi-main, …)`, „DIE LUFT UNTER DEM SEITENKOPF“), seit 15.10. spät; vorher 24 ohne Filterzeile (Topics, Opportunities, Performance, Settings) |
| Kartenraster (Ad Cards `.up-adgrid`, Response-Karten `.urt-cards`) | **16px** (Response-Karten bis 15.10. 14); Events bewusst 20 (Kartenentwurf 03.10.) |
| Gap zwischen linkem/rechtem Chart-Unit | **16px** |
| Gap im gestapelten (mobilen) Modus | **32px** |
| Head-Höhe (über jeder Chart-Box) | 32px, `margin-bottom: 16px` |
| Head-Tools-Gap (Icon-Buttons untereinander) | 8px |
| Box-Radius (`.up-box`, Chart-Container) | 12px (`--up-r-2xl`) |
| Tooltip-Radius Chart (Linie, Doughnut) | 8px (`--up-r-l`) |
| Tooltip-Radius Icon-Button (`.up-tip`) | 6px (`--up-r-m`) |
| Dropdown-Menü-Radius | 12px (`--up-dd-radius`), Polster 8 (`--up-dd-pad`), Abstand zum Auslöser 6 (`--up-dd-gap`) |
| Icon-Button (`.up-iconbtn`) | 32×32px, Radius 6, SVG 16×16px; Stufen 28 (Radius 6), 24 (4), 20 (4) |
| Switch-Track (Toggle) | 38×22px, voll rund, Knopf 18×18px mit `--up-e-1` |
| Gran-Switcher (D/W/M, `.vc-gran`) | Höhe 26px, Radius 6, Knöpfe min. 26 breit |
| Segment (`.up-seg`) | Höhe 26px, Radius 6; `.is-lg` 32px |
| Tabellen-Zeile Höhe | `.up-row` 72px (Comfortable), 55px (Compact, `.is-dense`); Top Brands `.vt-row` 55px |
| Tabellen-Head Höhe | 45px; flache Tabelle 48px (`--up-flach-h`) |
| Logo-Box (`.up-logo-box`) | 24×24px, Radius 6, Bild 22×22px Radius 5 (1px Polster) |
| Zellen-Padding (`.up-th`, `.up-td`) | `0 16px 0 12px` |
| Filter-Item (`.up-filter-item`) | Polster `6px 9px`, Radius 4 |
| Filter-Submit-Button (`.up-filter-submit`) | Höhe 32px, Radius 6, `margin-top: 6px` |

### Tiefe: die Schatten nach Geist (seit 15.10.)

Quelle: Vercels `--ds-shadow-*` (vercel.com/geist/materials). Jede Stufe ist zwei bis drei
schmale Lagen mit negativer Streuung statt einer breiten Lage; Geists 1px-Ring fehlt mit Absicht
(jedes Bauteil hat seinen Rahmen schon als `border`). Alle Tiefen stehen an `:root`, `.up-root`
und `[data-theme]`, erreichen also auch, was am `<body>` hängt. **Kein Rückfallwert** in
`var(--up-e-*, …)`; einzige Ausnahme `quick-actions.css`, die ohne core laufen muss.

| Token | Rolle | Geist | Light |
|---|---|---|---|
| `--up-e-1` | liegt auf der Fläche: Knopf, Feld, Regler, Zeichen-Kachel (keine Karte, siehe unten) | small | `0 2px 2px rgba(0,0,0,.04)` |
| `--up-e-2` | hängt an einem Auslöser: Menü, Popover, Tooltip, Erklärkarte, Hover-Anhub | menu | `0 1px 1px rgba(0,0,0,.02), 0 4px 8px -4px rgba(0,0,0,.04), 0 16px 24px -8px rgba(0,0,0,.06)` |
| `--up-e-3` | schwebt frei über dem Inhalt: Leiste, Kasten | modal | `0 1px 1px rgba(0,0,0,.02), 0 8px 16px -4px rgba(0,0,0,.04), 0 24px 32px -8px rgba(0,0,0,.06)` |
| `--up-e-4` | liegt über einem Schleier: Dialog, Palette, **Toast** | modal-elevated | `0 32px 72px -12px rgba(0,0,0,.06), 0 8px 32px -12px rgba(0,0,0,.08), 0 8px 24px -12px rgba(0,0,0,.12)` |
| `--up-e-drawer` | Schublade, wirft seitlich | modal-elevated, um 90° gedreht | `-32px 0 72px -12px rgba(0,0,0,.06), -8px 0 32px -12px rgba(0,0,0,.08), -8px 0 24px -12px rgba(0,0,0,.12)` |
| `--up-e-chip` | gehobener Chip | medium | `0 2px 2px rgba(0,0,0,.04), 0 8px 8px -8px rgba(0,0,0,.04)` |

**Im Dunkeln** werden nur die flachen Stufen kräftiger, wie bei Geist: `--up-e-1`
`0 1px 2px rgba(0,0,0,.16)`, `--up-e-chip` `0 2px 2px rgba(0,0,0,.32), 0 8px 8px -8px
rgba(0,0,0,.16)`. e-2, e-3, e-4 und e-drawer behalten die hellen Zahlen (sie stehen trotzdem im
dunklen Block ausgeschrieben); die Kante tragen dort die helleren Rahmen.

`--up-dd-shadow` **ist** `var(--up-e-2)`, nicht mehr eine eigene Zahl. Bis 15.10. war jede Stufe
eine breite Lage (Menüs `0 10px 28px rgba(0,0,0,.14)`, Tooltips `0 4px 14px rgba(0,0,0,.18)`);
diese Werte gelten nirgends mehr.

### Karten: ruhend ohne Schatten, Hover nur die Fläche (seit 15.10.)

Gemessen am 15.10. auf vercel.com. Geist legt eine ruhende Karte als `material-base` an:
1px-Ring (hell `rgba(0,0,0,.08)`, dunkel `rgba(255,255,255,.145)`), **kein Schatten**, und schreibt
dazu „base for resting cards, small–large for raised content“. Dieselbe Form an jeder Karte, die
Vercel öffentlich zeigt: Fieldset (`material-base`), Marketplace-Kachel, Docs-Karte, Vorlagen-Karte,
Tarifspalte. Beim Überfahren bekommt keine davon einen Schatten, und der Rand bleibt:

| Vercel | Ruhe | Hover |
|---|---|---|
| Marketplace-Kachel | Ring, kein Schatten | Fläche `#fff` → `#f9f9f9` (Hälfte von Gray 100), dunkel `#0a0a0a` → `#0e0e0e` |
| Docs-Karte | Rand 1px, kein Schatten | Fläche → Background 200 (`#fafafa`) |
| Vorlagen-Karte | Rand 1px, kein Schatten | nur ein Pfeil blendet ein |

Bei uns heißt das:

| Karte | Ruhe | Hover (`.up-karte-klick`) |
|---|---|---|
| Event, Opportunity, Antwort (Card Mode), Produkt, Quelle, Ad Card, Recent Ad | `1px solid var(--vc-border)`, Radius 12, **kein Schatten** | Fläche einen halben Schritt zur Hover-Fläche, **2px nach oben** und **`--up-e-1`**, der Rand bleibt |
| Kasten, Hero, Chart-Kasten, Einstellungs-Karte (`.up-box`, `.usb-card`) | wie oben | — (nicht klickbar) |
| Kennzahlen im Band, flache Tabelle, offenes Band | flach, ohne Kasten | — |
| Erklärkarte, Menü, Popover | schwebt: `--up-e-2` | — |
| Benachrichtigung, Toast, Dialog | `--up-e-4` | — |

Die Tönung ist `--up-karte-hover` (core, an `:root`, `.up-root`, `[data-theme]`):
`color-mix(in srgb, var(--up-knopf-hover) 50%, transparent)`, als Ebene **über** dem Grund
(`background-image: linear-gradient(var(--up-karte-hover), var(--up-karte-hover))`), nicht an
seiner Stelle. Auf Weiß ergibt das genau Geists `#f9f9f9`; der durchscheinende Grund der
Opportunity-Karte im Dunkeln (`--uo-col-bg`) bleibt erhalten. Druck (`scale(.99)`) und Fokus
(2px-Outline, 2px Abstand) sind unverändert. Vom 13. bis 15.10. war der Hover „Rand eine Spur
kräftiger plus `--up-e-1`“.

**Dazu Hebung und Hauch Schatten** (15.10. spät, Nutzer: „nur Fläche ist super. Ganz leichter
Slide-up-Effekt wie wir ihn schon hatten und minimal mehr Schatten ist aber auch gut“):
`transform: translateY(-2px)` (wie die Ad Card bis zum 13.10.) und `box-shadow: var(--up-e-1)`
(Geist small, die leiseste Stufe), Übergang `--up-t-2` mit `--up-ease`. Beim Druck fällt die
Hebung weg (`scale(.99)`), bei `prefers-reduced-motion` gibt es keine Hebung.

Eine Karte mit Schatten in Ruhe gibt es nur noch an einer Stelle: die Tarifkarte (`.up-plan`,
`--up-e-1`), die am 28.09. samt Schatten von der Landingpage übernommen wurde. Zeichen-Kacheln
(`.up-lb-tile`, `.uev-avatar`) sind keine Karten und behalten `--up-e-1`. (`.unc-tile` gibt es
seit dem 16.10. nicht mehr, siehe §49.)

---

## 4. Icon-Buttons und Knopf-Zustände

```css
/* core.css, .up-iconbtn (laut) und .up-iconbtn.is-quiet (leise) */
.up-iconbtn {
  width: 32px; height: 32px; border: 0; border-radius: var(--up-r-m);   /* 6 */
  background: transparent; color: var(--vc-third); cursor: pointer; padding: 0;
}
.up-root[data-theme="dark"] .up-iconbtn { color: var(--vc-third); }
.up-root[data-theme="dark"] .up-iconbtn:hover { color: var(--vc-text); }  /* eigene Dunkel-Regel, s. Falle */
.up-iconbtn:not(.is-quiet):hover { color: var(--vc-text); background: var(--vc-heading-bg); }
.up-iconbtn.is-quiet:hover { color: var(--vc-text); background: transparent; }
.up-iconbtn svg { width: 16px; height: 16px; display: block; }
```
Größenleiter: `.is-28` (28, Radius 6, SVG 15), `.is-24` (24, Radius 4, SVG 14), `.is-20` (20,
Radius 4, SVG 13).

⚠️ **Bekannte Falle:** Eine simple `:hover`-Regel reicht **nicht**: die Dark-Mode-Grundregel
(`.up-root[data-theme="dark"] .up-iconbtn`) hat höhere Spezifität als ein einfaches `:hover`
und überschreibt es lautlos. Immer eine **explizite** dunkle Hover-Regel danebensetzen. Derselbe
Trick gilt für **jeden** Zustand, der im Dark Mode „verschwindet": Switch-`is-on`,
Filter-`is-checked`, etc.

### Knopf-Zustände nach Geist (seit 15.10.)

Gelesen an vercel.com/geist/button, /menu und /select. Die Töne bleiben unsere, als Token in
core (an `:root`, `.up-root` und jedem `[data-theme]` neu ausgewertet, damit ein Menü mit eigenem
Rand den eigenen Ton bekommt):

```
--up-knopf-hover:          var(--vc-heading-bg)                                 Fläche beim Überfahren
--up-knopf-rand-hover:     color-mix(in srgb, var(--vc-border) 86%, var(--vc-text))   eine Stufe kräftigere Kante
--up-knopf-fokus-abstand:  2px
```

| Bauteil | Ruhe | Hover | Offen | Fokus (Tastatur) |
|---|---|---|---|---|
| Sekundärknopf (`.up-btn-sec`, 32, Radius 6, Rand `--vc-border`) | transparent | **nur** Fläche `--up-knopf-hover`, Rand bleibt | – | `outline: 2px solid var(--up-focus)`, `outline-offset: 2px` |
| Menü-Auslöser mit Rahmen (`.up-ddtrigger`) | Grund `--vc-bg`, Rand `--vc-border`, Schrift `--vc-muted` | Fläche `--up-knopf-hover` **und** Rand `--up-knopf-rand-hover`, Schrift `--vc-text` | wie Hover | wie oben |
| Menü-Auslöser gewählt (`.up-ddwrap.has-sel`) | Fläche `--vc-heading-bg`, Rand `--vc-hover-border` | unverändert: ein Zustand, kein Hover | | |
| Gedrückt | nichts Eigenes (Geist: `data-pressed` ändert weder Fläche noch Rand) | | | |

Bis 15.10. zog jeder umrandete Knopf beim Überfahren seinen Rand auf `--vc-hover-border`
(`#6f6f6f` hell, `#707070` dunkel), „recht dunkel“. Diese Kante trägt jetzt nur noch der
**gewählte** Zustand. Der Fokus ist eine `outline` mit Abstand, kein `box-shadow`: so ist der
Abstand durchsichtig und braucht keine Grundfarbe.

### Primärfarben-Buttons (`.up-btn-pri`, `.up-filter-submit`, `.up-topicmodal-save`)
```css
.up-btn-pri { height: 32px; padding: 0 14px; border-radius: var(--up-r-m); border: 0;
  background: var(--up-accent); color: var(--up-accent-fg); font-size: 13px; font-weight: 500; }
.up-btn-pri:not(:disabled):hover { opacity: .88; }
.up-btn-pri:disabled { opacity: .4; }
.up-btn-pri:focus-visible { outline: 0; box-shadow: 0 0 0 var(--up-focus-w) var(--up-focus-ring); }
```
Regel: **beim Hover ändert sich nur die Deckkraft**, nie Icon-/Textfarbe; ausgeschaltet bleibt die
Füllung und wird gedimmt.

---

## 5. Switcher & Toggles

### Segmentierter Switcher (`.up-seg`, D/W/M `.vc-gran`, Doughnut/Bar)
```css
.up-seg   { display: inline-flex; height: 26px; background: var(--vc-switch-rail);
            border-radius: var(--up-r-m); border: 0; }                 /* 6 */
.vc-gran-btn { height: 26px; min-width: 26px; padding: 0 8px; border-radius: var(--up-r-m);
            color: var(--vc-muted); font-size: 12px; font-weight: 500; }
/* die aktive Stufe ist ein gleitender Streifen (::before), kein umgefärbter Knopf */
.up-seg::before { border-radius: var(--up-r-m); background: var(--vc-switch-pill);
            border: 1px solid var(--vc-switch-border); }               /* fährt 200ms */
```
Große Form `.up-seg.is-lg` (allein über dem Inhalt, z. B. Brand Detail): 32px hoch, Knöpfe
`0 16px`. Die Schiene ist in jeder Größe `--vc-switch-rail`, die Pille `--vc-switch-pill`.

### Themenschalter nach Geist (`UC.themeSchalterHtml`, seit 15.10.)

Geists Theme Switcher (vercel.com/geist/theme-switcher), aufgebaut auf `.up-seg` (der gleitende
Streifen bleibt). EIN Markup für beide Orte: das Konto-Menü der Seitenleiste (klein) und
Preferences (groß). Vorher dort eine Liste mit Haken und hier ein Auswahlmenü.

```
UC.themeSchalterHtml({ klein, wahl })  -> .up-seg.up-themesw[.is-klein], role="radiogroup"
Reihenfolge     System (Zeichen computer), Light (sun), Dark (moon); nur Zeichen 16px,
                Name als aria-label und Tooltip
Größe           32 (--up-h-btn, Preferences) / 24 (--up-h-chip, .is-klein, Konto-Menü)
Knopf           Kapsel mit Polster neben dem Zeichen: 40 x 32 (0 12px) / 32 x 24 (0 8px),
                seit 15.10. spät ("mehr Padding in den 3 Bereichen"); vorher rund 32 / 24
Form            voll rund, keine Schiene; außen ein 1px-Ring --vc-switch-border (box-shadow)
Gewählt         Fläche --vc-switch-pill mit eigenem 1px-Ring --vc-switch-border und --up-e-1
Farben          Ruhe --vc-third, Hover und gewählt --vc-text
Klick           data-up-themawahl am Knopf; der Ort ruft setUpstreemThemeOption
```

### An/Aus-Switch (z.B. „Descending" im Sort-Dropdown, „Summary row" im Display-Menü)
```css
.up-switch { width: 38px; height: 22px; border-radius: var(--up-r-voll);
  background: var(--up-switch-off, #d6d6d4); }                       /* dunkel #444444 */
.up-switch::after { content:""; position:absolute; top:2px; left:2px; width:18px; height:18px;
  border-radius: var(--up-r-voll); background:#fff; box-shadow: var(--up-e-1);
  transition: transform 160ms ease; }
.up-switch.is-on { background: var(--up-accent); }
.up-root[data-theme="dark"] .up-switch.is-on { background: var(--up-accent); }   /* Spezifitäts-Fix */
.up-switch.is-on::after { transform: translateX(16px); }
```
Kein Mint/Teal in Switches oder Checkboxen: „aktiv“ ist immer `--up-accent` (Abschnitt 1).

### Slider nach Geist (`.urt-slider`, seit 15.10.)

Der Doppelregler der Responses-Filter und des Panels in der einen Leiste (`responses-table.css`),
gelesen an vercel.com/geist/slider:

```
Bahn       8px hoch, voll rund, --vc-border (im grauen Light #ebebeb = Geist Gray 200)
Füllung    volle Bahnhöhe, --up-accent
Griff      stehender Riegel 6x14, Radius 1 innen, Grund --up-surface,
           1px-Ring innen in --up-knopf-rand-hover
Ziehen     scale(1.2) über --up-t-1; Fokus dazu 2px-Outline --up-focus im Abstand 2
Treffer    der Griff trägt ringsum 6px durchsichtigen Rand (--urt-griff-rand), sichtbar
           sind nur die 6x14; die Eingabefelder ragen je einen halben Griff über die Bahn,
           damit die Griffmitte an den Enden auf dem Bahnende steht
```
Kein Hover-Zustand. Werte, Schritte und Ereignisse sind unverändert.

---

## 6. Dropdowns / Popover-Menüs

**Alle Dropdowns nutzen dieselbe Hülle `.up-menu`** und dieselbe Appear-Animation (opacity +
leichtes Scale, kein `display:none`-Hard-Toggle):
```css
.up-menu {
  position: absolute; top: calc(100% + var(--up-dd-gap)); right: 0; z-index: 60; width: 230px;
  background: var(--vc-bg); border: 1px solid var(--vc-border);
  border-radius: var(--up-dd-radius);          /* 12, Geist material-menu (bis 15.10. 14) */
  box-shadow: var(--up-dd-shadow);             /* = --up-e-2 */
  padding: var(--up-dd-pad);                   /* 8 */
  opacity: 0; transform: translateY(-4px) scale(0.985); pointer-events: none;
  transition: opacity 140ms ease, transform 140ms ease;
}
.up-menu.is-shown { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
.up-root[data-theme="dark"] .up-menu { background: var(--up-menu-bg); }
.is-open > .up-iconbtn { color: var(--vc-text); background: var(--vc-heading-bg); }
```
Wichtig: das Menü bleibt IMMER im DOM/Layout (`display` wird nie umgeschaltet) — nur `opacity`/`transform`/`pointer-events`. Nur **ein** Dropdown gleichzeitig offen (beim Öffnen eines anderen wird das erste geschlossen).

### Positionierung: reines `position:absolute` (siehe Abschnitt 14 für das ganze Warum)

`position:absolute` im `position:relative`-Wrapper, `top: calc(100% + Npx); right: 0;
z-index: 60`. Klappt immer nach unten auf, klebt per CSS am Trigger, auch beim Scrollen.
**Kein** JS-Positioning, **kein** `position:fixed`, **kein** Body-Portal, **kein** Flip-nach-oben.

Frühere Versionen haben das Menü nach `<body>` portiert + auf `position:fixed` gesetzt + per
JS-Scroll-Listener nachgezogen (gegen `overflow:hidden`-Clipping). Ergebnis: das Menü ruckelte/
sprang beim Scrollen, weil JS-Repositioning immer eine Frame zu spät kommt. Verworfen. Details,
Trade-off und die verbindliche Regel stehen in **Abschnitt 14**.

### Staging-Semantik: Apply committet, Schließen verwirft

Dropdowns **mit Apply-Button** (Typ-Filter, Mentioned-Brands) behandeln die
Auswahl als **Entwurf**. Verbindliche Regel:

```
Öffnen              -> Entwurf wird aus dem angewendeten Stand geseedet
Klicken im Menü     -> ändert nur den Entwurf (nichts geht raus)
Apply               -> Entwurf wird übernommen, EVENT feuert
Schließen ohne Apply-> Entwurf wird verworfen, angewendeter Stand bleibt unberührt
```

Das heißt konkret: Wer ein Dropdown öffnet, Haken setzt oder entfernt und es dann
**ohne Apply** wieder schließt (Klick daneben, Trigger erneut klicken, anderes
Dropdown öffnen), darf **keine** Änderung sehen — weder ein Event noch ein
geändertes Label noch einen geänderten Trigger-Zustand. Nur Apply schreibt.

Umsetzung: Zwei Objekte pro Filter — der **angewendete** Stand (`appliedSel` /
`mentionApplied`, die Quelle der Wahrheit, speist Label und `is-active`) und der
**Entwurf** (`filterSel` / `mentionSel`), den das offene Menü rendert. Beim Öffnen
`draft = clone(applied)`, beim Schließen ohne Apply `draft = clone(applied)` (also
zurückgesetzt), bei Apply `applied = clone(draft)` + Event. `clone` übernimmt nur
truthy Keys, damit ein stehengebliebenes `false` nie als Auswahl zählt.

**Reset und das Trigger-X sind Ausnahmen** — sie sind selbst ein Apply: sie leeren
und feuern sofort (siehe 6a). Dropdowns **ohne** Apply (Sort, Columns) wenden
ohnehin sofort an und haben keinen Entwurf.

### Dropdown-Item (Liste, z.B. Sort-Optionen)
```css
.up-pop-opt { display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:9px 10px; border-radius: var(--up-r-s);   /* 4 = 12er-Menü minus 8 Polster */
  font-size:13.5px; font-weight:500; color:var(--vc-text); }
.up-pop-opt:hover { background: var(--vc-heading-bg); }
```
Menüs mit 6er-Polster (Zeilenmenüs der Gruppen, Brands-Aktionen) runden ihre Zeilen mit 6
(`--up-r-m`). Divider zwischen Gruppen (`.up-pop-div`): `height:1px; background:var(--vc-border); margin:7px 4px;`

### Filter-/Auswahl-Item (Checkbox-Liste)
```css
.up-filter-item { display:flex; align-items:center; gap:10px; padding:6px 9px; border-radius: var(--up-r-s); }
.up-filter-item:hover { background: var(--vc-heading-bg); }
.up-filter-item.is-disabled { opacity: .4; cursor: default; }   /* NIE cursor:not-allowed verwenden */
.up-filter-check { width:16px; height:16px; border-radius: var(--up-r-xs);   /* 4 */
  border:1.5px solid var(--vc-border); color: var(--up-accent-fg); }
.up-filter-item.is-checked .up-filter-check { background: var(--up-accent); border-color: var(--up-accent); }
```

---

---

## 6a. Dropdown-Trigger: Hover- und Open-States (verbindlich)

Gilt für **jeden** Dropdown-Auslöser, egal ob Icon-Button oder beschrifteter Container. Seit
dem 15.10. nach Geist (Abschnitt 4, Knopf-Zustände); bis dahin zog der Hover den Rand auf
`--vc-hover-border`.

**Elemente MIT Rahmen** (`.up-ddtrigger`: Markets, Models, Topics, Kalender, Settings):
```
Ruhezustand   bg: var(--vc-bg)              border: var(--vc-border)            text: var(--vc-muted)
Hover         bg: var(--up-knopf-hover)     border: var(--up-knopf-rand-hover)  text: var(--vc-text)
Geöffnet      wie Hover (.up-ddwrap.is-open)
Gewählt       bg: var(--vc-heading-bg)      border: var(--vc-hover-border)      text: var(--vc-text)
              (.up-ddwrap.has-sel: ein Zustand, kein Hover; die dunkle Kante gibt es nur hier)
Fokus         outline 2px var(--up-focus), outline-offset 2px
```
Maße: 32 hoch, Polster `0 10px`, Radius 6 (`--up-r-m`), 1px Rand, Schrift 13/500, Zeichen 16,
Abstand 8. Die Form ist `[Icon] [Beschriftung] [Chevron]`, nur so breit wie ihr Inhalt.

**Elemente OHNE Rahmen** (Icon-Buttons, `.up-filter-btn`): nur der Hintergrund.
```
Ruhezustand   bg: transparent                 icon/text: var(--vc-third) bzw. var(--vc-text)
Hover         bg: var(--vc-heading-bg)        icon: var(--vc-text)
Geöffnet      bg: var(--vc-heading-bg)        icon: var(--vc-text)
Aktiv         bg: var(--vc-heading-bg)        (.up-filter.is-active: angewendeter Filter)
```

Ein Chevron **rotiert nicht** beim Öffnen.

### Aktiver Filter: gleiche Optik wie „Geöffnet"

Ein Trigger, dessen Filter **angewendet** ist, trägt dieselbe Darstellung wie ein geöffnetes
Dropdown. „Dieses Element tut gerade etwas“ und „dieses Element ist offen“ haben dasselbe
Gewicht, beide heißen *hier hinsehen*. Ein separates Zähl-Badge braucht es dafür nicht, das
Label nennt die Auswahl ohnehin.

Umgesetzt als eigene Klasse `.is-active` am Wrapper, gesetzt aus derselben
Funktion, die auch das Label schreibt:
```css
.up-filter.is-active .up-filter-btn { background: var(--vc-heading-bg); color: var(--vc-text); }
.up-filter.is-active .up-filter-btn-chev { color: var(--vc-text); }
```

### Chevron wird zum X, solange der Filter aktiv ist

Hovert man einen **aktiven** Trigger, wird das Chevron durch ein X ersetzt. Ein
Klick darauf leert den Filter und **wendet sofort an**, ohne das Menü zu öffnen.
Es ist damit exakt der Reset-Button aus dem Dropdown, nur eine Ebene höher.

```css
.x-filter-btn-clear { display: none; width: 14px; height: 14px; flex: 0 0 14px; color: var(--vc-muted); }
.x-filter-btn-clear:hover { color: var(--vc-text); }   /* Icon-Hover: Sekundär -> Primär */
.x-filter.is-active .x-filter-btn:hover .x-filter-btn-chev  { display: none; }
.x-filter.is-active .x-filter-btn:hover .x-filter-btn-clear { display: block; }
```

Das X ruht in der **Sekundärfarbe** (`--vc-muted`) und geht erst beim Hover über das
Icon selbst auf die **Primärfarbe** (`--vc-text`). So bleibt es im Ruhezustand ein
unaufdringliches Angebot und wird erst unter dem Cursor zur klaren Aktion.

Zwei Fallen dabei:

1. Das X liegt **innerhalb** des Triggers. Der Klick-Handler dafür muss also
   **vor** dem Auf/Zu-Handler des Triggers stehen, sonst leert der Klick den
   Filter und öffnet gleich danach das Menü, das er gerade geleert hat.
2. Ein **inaktiver** Trigger behält immer sein Chevron. Ohne die
   `.is-active`-Bedingung böte man ein Zurücksetzen von etwas an, das gar nicht
   gesetzt ist.

### Reset wendet sofort an

Der Reset in einem Filter-Dropdown ist eine **Entscheidung, kein Zwischenschritt**.
Er leert die Auswahl *und* feuert das Filter-Event, ohne dass danach noch „Apply"
gedrückt werden muss. Das Menü bleibt dabei offen, damit die geleerten Checkboxen
sichtbar sind. Für den Weg über das X am Trigger schließt es sich, weil dort nie
eines offen war.

Beschriftete Container ohne Rahmen (`.up-filter-btn`, z. B. „All Citation Types"):
```
Höhe 32px, Padding 0 10px, Radius 6 (--up-r-m), Rand 1px transparent
Font 12px / 500, Gap 8px zum Chevron, Chevron 14×14 in var(--vc-muted), max-width 220px
```
Das Label nennt die aktive Auswahl: `All X` → bei einer Auswahl deren Name → ab zwei
`N X`. Ein separates Zähl-Badge entfällt dann.

---

## 6b. Schreibweise in UI-Texten

**Keine Em-Dashes (`—`) in sichtbaren Texten.** Weder in Tooltips, Erklärungen,
Leerzuständen noch in Buttons. Stattdessen Komma, Doppelpunkt oder ein eigener Satz:

```
FALSCH   "How much of all citations went to this domain — plus the change."
RICHTIG  "How much of all citations went to this domain, plus the change."

FALSCH   "What kind of source this is — editorial, a competitor, your own site."
RICHTIG  "What kind of source this is: editorial, a competitor, your own site."
```

Gedankenstriche in **Datumsbereichen** sind davon ausgenommen, dort ist der
Halbgeviertstrich korrekt: `18. Jul 2026 – 24. Jul 2026`.

---

## 7. Tooltips

Es gibt **zwei unterschiedliche Tooltip-Typen** im System:

**A) Icon-Button-Tooltip** (Mira-Style, dunkel, klein)
```css
.up-tip {
  position: fixed; z-index: 2147483640;   /* an <body> gehängt, damit nichts es clippen kann */
  height: 24px; padding: 0 9px; border-radius: var(--up-r-m);   /* 6, Geist: einzeiliger Tooltip */
  font-size: 12px; font-weight: 500; line-height: 1;
  box-shadow: var(--up-e-2);              /* Tiefe "haengt an einem Ausloeser" */
  opacity: 0; transform: translateY(4px); transition: opacity .14s ease, transform .14s ease;
}
.up-tip.is-wide { height: auto; white-space: normal; max-width: 340px; padding: 6px 9px; line-height: 1.35;
                 border-radius: var(--up-r-l); }   /* 8, Geist: mehrzeiliger Tooltip (seit 15.10.) */
```
Farben: BG `#1f1f1b` / Text `#ffffff`, in beiden Themes; nur ein Tooltip, das selbst
`data-theme="dark"` trägt, wird hell (`#f0f0f0`, Schrift `--vc-text-invert`).
Tooltips schweben über der Seite und liegen nicht in der Oberfläche.

Erscheint nach **60ms** Hover-Delay (bewusst kurz gehalten, „fast ohne Delay" wie Mira),
verschwindet sofort bei Klick/Mousedown.

Die Farben stehen **literal** da, nicht über `var(--vc-text)`: Der Tooltip hängt an `<body>`,
und `--vc-text` würde dort nicht mit dem Thema der Komponente wechseln (genau daran ist der
Explainer-Tooltip einmal unsichtbar geblieben) -- und er soll ohnehin in beiden Themes gleich
aussehen. Die **Tiefen** dagegen (`--up-e-*`) stehen seit dem 28.09. auch an `:root` und
erreichen den Tooltip dort; deshalb `var(--up-e-2)` statt eines eigenen Schattens.

**JS-Nutzungsmuster (Tabellen-Komponenten):**
```js
var _tips = UpstreemCore.makeTooltips(root, function(){ return isDark; });
var showTip = _tips.showTip, showTipText = _tips.showTipText,
    showTipWide = _tips.showTipWide, hideTip = _tips.hideTip;
/* showTip(el)               -> liest data-tip-Attribut
   showTipText(el, text)     -> zeigt beliebigen Text
   showTipWide(el, text)     -> breiter Tooltip (für truncated Titel)
   hideTip()                 -> sofort ausblenden */
```
`makeTooltips` installiert auch `[data-tip]`- und `[data-brandtip]`-Hover-Handler am Root automatisch.

**B) Chart-Datenpunkt-Tooltip** (Linie folgt dem Cursor; derselbe Kasten am Doughnut)
- Radius **8px** (`--up-r-l`, Geist: mehrzeiliger Tooltip; bis 15.10. 16px), Padding `10px 12px` (Linie) bzw. `12px 14px` (Doughnut)
- Light Mode: `background:#ffffff; border:1px solid #dcdbdd`
- Dark Mode: `background: var(--up-menu-bg); border: 1px solid var(--up-menu-border)` (seit 15.10.
  `#0a0a0a` / `#454545`, Geist) -- die **Menüfläche**, nicht der Seitengrund; Schrift
  `--vc-text`, Unterzeile `--vc-third`. Bis 15.10. `#232326` / `#3e3e44` mit `#e6e6e6` / `#8a8a8a`
- Schatten in beiden Themen `var(--up-e-2)` (seit 06.10.; vorher je Thema ein eigener Wert;
  seit 15.10. die mehrlagigen Geist-Werte aus Abschnitt 3). Das Token löst sich am Ort auf: der
  Tooltip hängt im Chart, also unter der Wurzel mit ihrem Thema.
- Text: Titel `#6b6f78` hell / `#8a8a8a` dunkel, Werte `#1f1f1b` / `#e6e6e6`
- Folgt der Maus mit Easing (`FOLLOW = 0.18` pro Frame, ca. 280ms „Trägheit")

**C) Explainer-Tooltip** (Spaltenüberschriften in den Tabellen, erklärt eine Metrik)

Zweiteiliger Aufbau: oben ein helles Panel, das die Metrik so zeigt, wie sie in der Tabelle
aussieht, darunter Überschrift und ein Satz Erklärung auf dunklem Grund.

```css
.up-explain {
  position: fixed; z-index: 2147483001; width: 248px; padding: 8px;
  border-radius: var(--up-r-2xl);   /* 12, Kartenstufe (bis 15.10. 14) */
  /* Die UMGEKEHRTE Karte (seit 28.09. Token): hell eine dunkle Karte, dunkel eine helle.
     --vc-inverse-bg #1f1f1b / #eeedef, --vc-inverse-ink #ffffff / #1f1f1b -- an :root und an
     [data-theme="dark"], also auch am <body> richtig. */
  background: var(--vc-inverse-bg); color: var(--vc-inverse-ink);
  box-shadow: var(--up-e-2);
  opacity: 0; transform: translateY(-4px);
  transition: opacity .14s ease, transform .14s ease;
}
.up-explain.is-on { opacity: 1; transform: translateY(0); }

.up-explain-vis {       /* Beispielplatte: die Karte noch einmal umgekehrt */
  background: var(--vc-inverse-ink); color: var(--vc-inverse-bg);
  border-radius: var(--up-r-s);   /* 4 = 12 minus 8 Polster, konzentrisch */
  padding: 11px 12px;
  display: flex; flex-direction: column; gap: 7px; align-items: flex-start;
  margin-bottom: 9px; min-height: 46px; justify-content: center;
}
.up-explain-h { font-size: 14.5px; font-weight: 600; line-height: 1.2; padding: 0 3px;
             margin-bottom: 4px; color: var(--vc-inverse-ink); }
.up-explain-t { font-size: 13.5px; font-weight: 400; line-height: 1.5; padding: 0 3px;
             color: color-mix(in srgb, var(--vc-inverse-ink) 68%, transparent); }
```

**Zacken**, zeigt immer auf das auslösende Info-Icon:
```css
.up-explain::before {
  content: ""; position: absolute; top: -6px; left: var(--up-caret, 50%);
  transform: translateX(-50%);
  border-left: 12px solid transparent; border-right: 12px solid transparent;
  border-bottom: 11px solid var(--vc-inverse-bg);
}
.up-explain.is-flipped::before {    /* nach oben geklappt, wenn unten kein Platz ist */
  top: auto; bottom: -10px;
  border-bottom: 0; border-top: 11px solid var(--vc-inverse-bg);
}
```
`--up-caret` wird beim Öffnen per JS auf die Icon-Mitte gesetzt, geklemmt auf
`14px … Breite-14px`. Ohne das zeigt der Zacken ins Leere, sobald die Box am
Bildschirmrand seitlich verschoben wurde.

**Auslöser:** Info-Icon 14×14 in `var(--vc-third)`, `opacity: 0`, erscheint beim Hover über
die Spaltenüberschrift. **Kein `cursor: help`** — der Cursor bleibt wie im Rest der Zeile.

---

## 8. Tabelle (Top Brands)

```css
/* visibility-chart.css */
.vt-thead, .vt-row { display: grid; grid-template-columns: 44px minmax(100px,1fr) 22% 20% minmax(92px,20%); }
.vt-thead { height: 45px; background: var(--vt-head-bg); }
.vt-th    { font-size: var(--up-fs-l); font-weight: var(--up-fw-m); color: var(--vc-muted); }  /* 14/500 seit 15.10. */
.vt-row   { height: 55px; cursor: pointer; }
.vt-row:hover { background: var(--vt-row-hover); }
.vt-td    { padding: 0 16px 0 8px; gap: 12px; }
```
- Brand-Spalte mindestens 100px (ohne Sentiment- oder Rank-Spalte 120px).
- Logo-Box 24×24px (Radius 6, 1px Padding), Bild 22×22px (Radius 5, konzentrisch).
- Trend-Chip: Icon 16×16 + Text, `gap:4px`, Farbe je nach Richtung/Invertierung (`--vt-up`/`--vt-down`). In Top Brands bewusst ganzzahlig (15.10.).
- Sentiment (seit 29.09.): **kein Kasten** -- Balken 3×12px (voller Radius, Ampel-Farbe) + Zahl wie `.up-num`, Markup nur aus `UC.sentHtml(v)`. Die Pille mit Rahmen (`.up-sent.up-pille`: 24px, Polster 6, Rahmen, Radius 4 (`--up-r-s`), Punkt 6×6 Radius 2) gibt es nur noch für Plaketten, die kein Messwert sind (Tarif, Team-Status).
- Eigene Zeile für „Own Brand außerhalb Top 7": 4px Extra-Marge + 1px Top-Border, nur wenn `position > 7`.

**Responsive Degradierung** (in dieser Reihenfolge, je enger):
1. Trend-Chips ausblenden — **nicht** über einen Breiten-Schwellwert, sondern per echter Messung: sobald der Trend-Chip weniger als **8px** Abstand zum tatsächlichen Zellenrand hat (`getBoundingClientRect()`-Vergleich, nicht `scrollWidth`/`clientWidth` — letzteres erkennt keinen Slack).
2. Sentiment-Spalte ausblenden — nur wenn bereits gestapelt (`is-narrow`) **und** Root-Breite < 700px.
3. Ranking-Spalte ausblenden — nur wenn gestapelt **und** Root-Breite < 500px.

---

## 8a. Die flache Tabelle, Kopfschrift und Kopfzeichen (seit 15.10.)

**Flache Tabelle** (`data-flach="yes"` an `.up-root`, `core.css` „DIE FLACHE TABELLE“): zuerst
in der Prompt-Tabelle abgenommen, dann nach core gehoben. Ein Attribut, kein Nachbau.

```
Kasten        keiner: oben und unten 1px --vc-border, seitlich 0 breit, kein Radius, kein Grund
Auslauf       die Tabelle läuft um --up-flach-aus (16) links und rechts bis an die Kanten; jede
              Zeile beginnt links an der Kante (ihr Zellpolster 12 ist der Abstand) und hält
              rechts 16 Polster. In Karte oder Drawer setzt die Komponente --up-flach-aus: 0px.
Kopf und Fuß  48 hoch (--up-flach-h). Linie unter dem Kopf als inset-Schatten, Grund
              --up-surface (deckend, weil er kleben kann)
Pagination    Knöpfe in der 28er Form (--up-h-seg)
Feste Höhe    UC.makeFestHoehe(root, cfg): nur der Kasten scrollt, Leiste oben und Pagination
              unten stehen; nur mit klebendem Kopf (ab 1000 breit), nie unter 240px Platz
```
Im grauen Light (Abschnitt 1) wird der Kasten der flachen Tabelle weiß, bleibt aber flach: kein
Rahmen, kein Radius. Das ist auch Vercels Bild (die Inhaltsfläche läuft bis an den Fensterrand).

**Kopfschrift jeder Tabelle: 14/500** (`.up-root .up-th`, dazu `.vt-th`, `.tct-th`), Farbe
`--vc-muted`. Bis 15.10. zwei Stufen: 12/400 in normalen Tabellen, 13/500 in der flachen. Die
Zeichen im Kopf wachsen mit auf **15px** (Info, Sortierpfeile, Kopfzeichen, Raute), das
Markenlogo im Kopf (`.up-th-brandlogo`) auf 17px. Die Mindestbreiten der Spalten sind darauf neu
vermessen (`min`/`minFlach` je Spalte).

**Kopfzeichen** (`.up-th-ic`, Drittfarbe, schrumpft nie, das Wort kürzt sich zuerst):

```
UC.kopfZeichenHtml(name)   Markup für Köpfe, die als Zeichenkette gebaut werden
UC.kopfZeichen(th, name)   setzt es als erstes Kind in einen vorhandenen Kopf, nur einmal
```

| Spalte | Zeichen |
|---|---|
| Brand Mentions, Brand (Brands Overview, Top Brands im Visibility Chart) | `squareStack` (wie Brands in der Seitenleiste) |
| Topics | `tags` |
| Citations (Responses) | `globe` (wie Citations in der Seitenleiste) |
| Type (Domains, URLs, Top Citations) | `dropdownFieldType` |

Dieselbe Spalte trägt in jeder Tabelle dasselbe Zeichen, und nur, wenn die Seitentabelle eins
hat: Visibility, Rank/Ranking, Sentiment, Share, Used, Domain und URL tragen keins. Top Brands
(`.vt-th-brand`) und Top Citations (`.tct-th-type`) sind keine `.up-th`; der Kopf mit Zeichen
bekommt dort den Abstand der Seitentabellen (`gap: 6px`) selbst, nur dieser eine Kopf, weil das
Info-Zeichen der anderen mit `margin-left: auto` steht.

`aria-hidden`: das Wort daneben sagt alles. Neue Tabellen bekommen ihr Kopfzeichen über
`UC.kopfZeichenHtml` und je Spalte eine `art` (Abschnitt 8d).

**Tabellenköpfe im Drawer** (seit 15.10. spät, `core.css` „DIE TABELLENKOEPFE IM DRAWER“): jede
Tabelle in einem Drawer (`.up-kdr`, `[id^="drawer-"]`) trägt den Kopf der Seitentabellen, behält
aber ihren Kasten mit Rand und Radius 12 — sie wird **nicht** flach. **Im Dunkeln** (nach Geist)
behält der Kasten im Drawer seinen Rand `--vc-border` (`#2e2e2e`): Drawer und Kasten sind dort beide
`#0a0a0a`, ohne Rand wäre er unsichtbar (`core.css` „IM DRAWER NACH GEIST BLEIBT DER RAND“). Klebend
zeichnen Kopf und Körper den Rand, der Kasten bleibt durchsichtig wie im Light.

```
Höhe     48 (var(--up-flach-h, 48px)), in beiden Themen; vorher 45, Conversion (URL-Drawer)
         und Variations (Brand-Drawer) 40
Grund    im Light die Fläche der Tabelle (--vc-bg), kein --vt-head-bg mehr; deckend, weil der
         Kopf der Responses klebt. Nur über html[data-up-hell="grau"], nie über
         :not([data-theme="dark"]) an .up-root (das träfe eine Hülle ohne Thema über einer
         dunklen Tabelle)
Dunkel   behält seinen Kopfgrund (--vt-head-bg)
Gilt für Responses, URLs, Conversion, Variations, Brand-Editor (Alias, Tracking); Top Brands und
         Top Citations bekommen dasselbe als Band im Kasten (Abschnitt 8f)
```

---

## 8b. Die eine Leiste (`data-leiste="yes"`, seit 15.10.)

Der Kopf einer Tabelle trägt **links, was die Daten ändert**, und **rechts, was nur die Ansicht
ändert**. Zuerst in der Prompt-Tabelle, abends nach core für Responses und weitere Tabellen.

```
.up-leiste-scope   links: Status-Umschalter, Kalender, "Filters", Chips (die Seite hängt
                   ihre Filterzeile hinein), flex 1 1 480px
.up-head-tools     rechts: Suche, Sortierer, Display, Export
.up-heading        entfällt; die Zahl steht im Seitenkopf bzw. in der Gesamtzeile
Umbruch            der Kopf BRICHT UM statt Knöpfe wegzunehmen (row-gap 8, column-gap 16),
                   die Höhe kommt aus dem Inhalt; schmal (is-vnarrow) je eine volle Zeile
```

Die Filterleiste der Seite fließt in der Leiste mit: ihre Hüllen lösen sich auf
(`display: contents`), „Filters“, jeder Chip und „Clear All“ stehen einzeln in der Reihe und
brechen dort um. **`.up-leiste-fluss`** ist dasselbe für eine Filterzeile, die nicht im Kopf
einer Tabelle steht, sondern über einem Band (Citations, Shopping, Ads): die Klasse an den
Flex-Behälter, die Filterleiste als sein direktes Kind.

**Filter der Leiste** (`UC.makeLeistenFilter(root, cfg)`): Filter, die Daten ändern
(„<Marke> mentioned?“, Mentioned brands, Rank, Sentiment ...), stehen nicht mehr als Knöpfe in
der Werkzeugleiste, sondern als Zeilen im Menü „Filters“ mit Chip dahinter. Der Baustein baut je
Filter eine Wurzel `.up-ff.up-ff-<key>` (unsichtbarer Trigger, Panel mit `.up-filter-item`,
Zeilen mindestens 34 hoch, eigener Inhalt wie ein Regler in `.up-ff-panel` mit `12px 10px 14px`
Polster). Der Zustand bleibt in der Tabelle; sie feuert dieselben Ereignisse wie vorher ihre Knöpfe.

**Die Leiste über dem Band** (seit 16.10., Variante A der Leinwand „Citations Seitenaufbau“, für
Citations und Brands › Tracked gewählt). Steht ein Chart über der Tabelle, steht die eine Leiste
**über dem Chart**: Kalender und Filter gelten für Chart und Tabelle, und sie bleiben beim
Scrollen greifbar. Es gibt keine eigene Filterzeile mehr und keine halbleere Werkzeugleiste der
Tabelle.

```
Aufbau         in der Wurzel der Tabelle: Leiste (.up-head) – Band – Kasten
               UC.bandUnterLeiste(root, band, { kopf }) stellt um, setzt .has-leistenband
Filterzeile    die Seite hängt sie in .up-leiste-scope (display: contents, wie Prompt Insights)
Reiterwechsel  Filterzeile und Band wandern zur Tabelle des Reiters (das Element, nicht eine
               Kopie: Zustand und Handler bleiben); die Werkzeuge bleiben in ihrer Tabelle
Kleben         makeSticky wie jede Tabelle, ab 1000 breit: Kopf, Reiter und Chart scrollen weg,
               die Leiste klebt bei --up-sticky-top (16), der Spaltenkopf direkt darunter
               (--up-thead-off = gemessene Höhe der Leiste), das Band scrollt dazwischen weg
Linie          unter der Leiste NUR, solange sie klebt (.is-geklebt), eingeblendet (--up-t-2)
Abstände       Leiste 16 unten, Band 16 unten; der Stapel der Wurzel fällt auf 0
```

Warum in der Wurzel der Tabelle und nicht als Leiste der Seite: Domains, URLs und Brands
hängen Klicks, Suche, Tooltips und Menüs an ihre Wurzel (`ownsTarget`, `root.contains`); ein
Werkzeug außerhalb wäre tot. Dafür ignorieren die drei Tabellen Klicks in fremden Bausteinen in
ihrer Wurzel (`.up-band, .up-leiste-scope .up-root, .up-ff`, wie prompts-table.js) – sonst griffe
etwa `[data-brand]` einer Markenzeile im Menü „Filters“ als Wahl der eigenen Markenliste.

---

## 8c. Zahlen in Zellen: rechtsbündig in fester Spur (seit 15.10.)

**Eine Zahlzelle stellt ihren Wert an die rechte Zellkante, der Trend steht an der linken.**
Erkannt am Inhalt, nicht an der Spaltenklasse: direktes Kind ist `.up-num`, `.up-rank-group`
oder `.up-sent` (ohne `.up-pille`). Der Kopf bleibt linksbündig.

```css
.up-td:has(> :where(.up-num, .up-rank-group, .up-sent:not(.up-pille))) { justify-content: flex-end; }
.up-td.up-td:has(> :where(.up-trend, .up-varring)) { column-gap: var(--up-spur-abstand); }   /* 12 */
.up-td > :where(.up-trend, .up-varring) { order: -1; margin-right: auto; }
.up-td > .up-num { min-width: var(--up-spur, 0); text-align: right; }
```

So beginnt der Trend in jeder Zeile auf demselben Pixel, egal wie breit Zahl oder Trend sind;
die 12 sind der kleinste Abstand, wenn es eng wird. Wird es zu eng, läuft der Trend links aus dem
Bild, nicht die Zahl. Die rechte Kante ist dieselbe wie die der Gesamtzeile darunter.

**Die Spur** ist eine Mindestbreite je Format, gemessen in der Zellschrift (14/500, Geist,
Tabellenziffern) am **größten** Wert der Skala, auf ganze Pixel aufgerundet. Die Komponente
ordnet sie über ihre Spaltenklasse zu (z. B. `.upt-td-visibility { --up-spur: var(--up-spur-pct0) }`):

| Token | Wert | Format |
|---|---|---|
| `--up-spur-pct0` | 38px | „100%“ |
| `--up-spur-pct1` | 49px | „100.0%“ |
| `--up-spur-rang` | 29px | „10.0“ |
| `--up-spur-note` | 26px | „100“ (Sentiment) |
| `--up-spur-anzahl` | 38px | „0.00k“ / „0,000“ |
| `--up-spur-abstand` | 12px | Abstand Trend (oder Ring der Variationen) zur Zahl |

**Nur die direkte Zahl bekommt die Spur.** Rang-„#“ und Sentiment-Balken bleiben dicht an ihrer
Zahl (`.up-rank-group` gap 4, `.up-sent` gap 6); mit der Spur rückte die Zahl von ihrem Zeichen
weg („# 1“: 24 statt 4). Ausnahmen gewinnen über eine Klasse mehr, nie über die Reihenfolge: die
zentrierte Indexspalte, Datumsspalten mit `.up-num` (Shopping, Ads) bleiben links. Eine Zahl mit
Zusatz („102 of 150“, `.up-var-cnt`) hält 6 Abstand.

---

## 8d. Spaltenbreite: Deckel und Rangfolge bei Platzmangel (seit 15.10.)

**Deckel** (`deckeln()` in `UC.makeColumns`, nur flache Tabelle, nicht schmal): jede fr-Spalte
außer der ersten wächst höchstens bis zu ihrer Mindestbreite plus **32px** (`DECKEL_SPIEL`). Am
Ende wächst nur noch die erste Spalte. Gerechnet wird wie im Raster (Anteil je fr; wer unter
seiner Untergrenze läge, steht auf ihr, wer darüber, auf dem Deckel, bis nichts mehr kippt),
nicht als `minmax(min, max)` in der Spur: dann füllte das Raster die gedeckelten Spuren zuerst und
die erste Spalte stünde auf ihrer Untergrenze. Eine Untergrenze in Prozent wird flach zur
gemessenen Mindestbreite in px. Spuren mit px-Grenze bleiben, wie sie sind.

**Rangfolge** (`SPALTEN_ART` in core, je Spalte `art`): Reicht die Breite nicht, weichen Spalten
nach ihrer Art, nie nach einer Zahl je Datei. Die kleinste Zahl fällt zuerst:

| Stufe | `art` | Spalten |
|---|---|---|
| 1 | `datum` | Datum, Erstellt |
| 2 | `intent` | Intent |
| 3 | `markt` | Markt |
| 4 | `topics` | Topics |
| 5 | `citations` | Citations |
| 6 | `typ` | Typ |
| 7 | `marken` | Brand Mentions |
| 8 | `zaehl` | Zähl- und Zusatzspalten (Used, Mentioned Count, Active Prompts) |
| 9 | `sentiment` | Sentiment |
| 10 | `kpi` | weitere Kennzahlen (Presence, First Position Rate) |
| 11 | `rang` | Rank |
| 12 | `erwaehnt` | Mentioned? |
| nie | `anteil` | Share, Visibility |

Innerhalb einer Art entscheidet `prio`, sonst die Stelle (die linke bleibt länger). Eine Spalte
ohne `art` behält ihre alte `prio`; eine Tabelle stellt ganz um oder gar nicht. **Eine im Menü
ausdrücklich angeklickte Spalte bleibt** (Vorrang vom 14.10.), dafür weicht die nächst
unwichtigere. Ausschalten kann der Nutzer auch `anteil`-Spalten.

---

## 8e. Die Gesamtzeile (`UC.makeSumZeile`, `UC.makeZaehlZeile`, seit 15.10.)

Eine feste Zeile unter den Zeilen und über der Pagination (`.up-sumrow`). Vorbild der Geometrie
ist der Gruppenkopf der Prompt-Tabelle; Vorbild der Rechenzeile Attio.

```
Raster        var(--up-cols) wie .up-row, Höhe 48 (--up-flach-h), Grund --up-surface (deckend)
Linie oben    inset 0 1px 0 var(--vc-border); senkrechte Linien an den Zellgrenzen (border-left)
Zelle         .up-sumzelle, Polster 0 16px 0 12px, RECHTSBÜNDIG
Ganz links    NUR die Anzahl ("102 count"), auch sie rechts in ihrer Zelle
Paar          Wert 16/600 in --up-accent-ink, 6 Abstand, Etikett 13/500 in --vc-fourth
"Ø"           Durchschnitt als Zeichen (Icon "durchschnitt", 13px, Farbe des Etiketts) statt
              "avg"/"Schnitt"; vorgelesen als "Average"
Leer          "–" in --vc-fourth, nie 0
Knopf         Paar mit Auswahl: .up-sumknopf 28 hoch, Radius 6, Chevron 12 in --vc-fourth
              (dreht sich nie); Menü 220 breit, klappt nach OBEN, rechtsbündig am Knopf
Feste Höhe    klebt unten im scrollenden Kasten (sticky, z 4)
Schmal        is-vnarrow: nur die Anzahl, über die ganze Breite
```

**Von Haus aus keine Berechnung:** in den Spalten steht „**+ Calculation**“ (Plus 12px,
13/500, `--vc-fourth`). Mit Berechnungen ist es ein Knopf, der das Menü der Spalte öffnet
(„None“ zuerst, von Haus aus gewählt); ohne ist es bloßer Text ohne Zeiger. Bis 15.10. abends
hieß es „+ Add“ („sonst denkt man, man kann da was hinzufügen“).

**Berechnungen laden getrennt von der Tabelle** (`UC.makeZaehlZeile`, `cfg.rechnen` je Spalte,
`cfg.quelle = { sig(), holen(felder) }`): geholt wird nur, was gewählt ist, und nur dann; je
Filterstand einmal (Blättern und Sortieren holen nichts). Die Zeilen warten nie darauf, das
**Skelett steht nur in der Zelle**, nie über der ganzen Tabelle. Scheitert es, steht „–“.
`lokal()` rechnet im Browser, wo die Tabelle alle Zeilen hat (Brands, Teams).

**Kein Median** bei den Kennzahlen: in der Prompt-Tabelle gestrichen, der gewichtete Wert heißt
„Average Visibility“ (ebenso Rank, Sentiment). Einzige Ausnahme ist der **Preis** in Shopping
und Ads (Median des Preises, vom Nutzer so abgenommen).

Der Schalter „Summary row“ steht im Display-Menü; Schalter und Wahl je Spalte werden je Nutzer
gemerkt (`<praefix>_summe__<instanceId>`). Die Zellen tragen `up-sum-td-<Spalte>` und blenden
mit ihren Spalten aus. Topics with Ads (Ads Overview) hat bewusst keine Gesamtzeile.

**Der klebende Fuß** (`data-kleb-fuss="yes"` an der Wurzel, seit 16.10., zuerst Citations und
Brands › Tracked). Gesamtzeile und Pagination kleben unten am Scrollbereich, **sobald die Tabelle
den Bildschirm füllt** – also sobald ihr Spaltenkopf klebt. Solange Kopf, Reiter oder Chart zu
sehen sind, stehen sie an ihrem Platz am Ende der Tabelle; am Ende geben sie von selbst dorthin
zurück. Ein Scrollbereich, kein zweiter wie bei fester Höhe. Jede Tabelle mit `UC.makeSticky`
bekommt ihn über das Attribut (applySticky richtet ihn ein, `UC.klebFuss(root)` direkt).

```
Wann           nur mit klebendem Kopf (.up-sticky, ab 1000 breit); darunter klebt nichts
Herein         fängt die Tabelle an zu füllen, während ihr Ende unter dem Bild liegt: Fahrt von
               unten, transform + opacity, --up-t-3 / --up-t-2, easeOutExpo (--up-ease-expo)
Hinaus         füllt sie nicht mehr (zurück zum Chart): dieselbe Fahrt nach unten, ERST DANACH
               zurück in den Fluss (dort liegt er unter dem Bild); Umkehr mittendrin kehrt von
               der Stelle um (Übergänge, keine Keyframes)
Ende           Wechsel ohne Bewegung (sticky selbst); beide Teile lösen sich im selben Bild
Weg            --up-fuss-weg: Höhe beider Teile + 24, aber nie mehr als Inhalt unter ihrem Platz
               steht (sonst verlängert die Fahrt die Seite, der Balken zuckt; gemessen 57px)
Lage           Pagination bottom 0, Gesamtzeile darüber (--up-fuss-unter = Pagination + Linie);
               die Linie dazwischen zeichnet die Pagination (0 -1px 0 --vc-border)
Grund          deckend: Gesamtzeile wie bisher, Pagination --up-surface; sie läuft rechts mit aus
Schatten       NUR wenn er wirklich klebt (.is-fuss-klebt; Marke .up-fuss-marke unter dem
               Kasten liest den natürlichen Platz): --up-e-3 nach oben gespiegelt, auf dem
               obersten Teil (ohne Gesamtzeile die Pagination, .is-fuss-ohne-summe)
z              4 (unter Spaltenkopf 5 und Leiste 6)
Bewegung aus   prefers-reduced-motion: dieselben Zustände ohne Fahrt
```

---

## 8f. Das offene Band (`.up-band*`, seit 15.10.)

Ein Chart über einer Tabelle steht als **offenes Band**, die Form der flachen Tabelle übertragen
auf Diagramme (Variante A der Citations-Vorschau, danach Brands, Shopping, Ads, Dashboard). Greift
nur unter `data-flach="yes"`.

```
.up-band          kein Kasten, läuft um --up-flach-aus bis an die Kanten, oben und unten 1px
.up-band-einheit  ein Teil mit eigener Überschrift; sein Polster gibt den Auslauf zurück
.up-band-head     Überschrift samt Werkzeugen als erste Zeile IM Band, min. 48 hoch;
                  zweizeilig (Unterzeile oder schmal umgebrochen) 16 oben, 8 unten
.up-band-flaeche  der bisherige Kasten: kein Rahmen, kein Radius, kein Grund
.up-band-inhalt   8 oben, 16 unten
.up-band-zwei     zwei Einheiten; die Trennlinie ist die 1px-Lücke, durch die der Grund des
                  Bandes (--vc-border) scheint
.up-band-raster   auto-fit-Raster, nebeneinander solange jede Spalte --up-band-spalte (472px) hat
```
`UC.bandTeile(band, { zwei, selbst, einheit, kopf, flaeche, inhalt })` setzt die Klassen an die
Teile einer Komponente (das Markup steckt oft in eingebauten Elementen).

**Ausgeblendet ist das Band ganz weg** (`.is-band-aus`): keine Restzeile, keine Linie; eine
Hülle, die nur das Band trägt, fällt mit. Ein und aus schaltet der **Umschalter im Seitenkopf**
(`.up-seg.up-bandsw`, `UC.bandSchalterHtml({ aus, id, klein })`), den
`UC.bandAus(band, aus, { id, setzen })` immer setzt (seit 16.10., Nutzer: „Switcher nur mit 2
Icons, aber entspanntem Padding“, kein Auge): zwei Felder nur mit Zeichen, „Chart and table“
(`chartSpline`) und „Table only“ (`listIcon`), Name als aria-label und Tooltip, radiogroup. Form
und Maße wie der Themenschalter (dieselben Regeln): Kapseln 40 × 32; auf dem Telefon
(`is-vnarrow`) rund 32 × 32, und der Hinzufügen-Knopf daneben zeigt dort nur sein Zeichen. Er
steht vor den Knöpfen des Kopfs. Das Auge der Komponente (`bandTeile`, `teile.auge`) weicht,
solange er steht; ohne Seitenkopf (Bubble) bleibt es. Der Zustand wird über das Neuladen gemerkt
(`up_band_aus__<id>`). Bis 16.10. ein Auge am Band und „Show chart“ im Kopf.

**Die Zeile unter dem Band:** zwischen Unterkante des Bandes und der Leiste bzw. Überschrift der
Tabelle stehen **16px** (`--up-band-luft`). Vorbild ist Prompt Insights: Linie der Navigation bis
zur Leiste 16, Leiste bis zum Tabellenkopf 16. Vorher je Seite anders (24 in Citations und
Brands, 48 in Shopping und Ads). Ein Stapel setzt seinen Abstand als `--up-stapel-luft`
(`gap: var(--up-stapel-luft)`), die Regel gleicht ihn auf die 16 aus; darum setzt jede Seite mit
Band die Variable. Zwischen zwei Bändern bleibt der Blockabstand. Eine Abschnittsüberschrift
direkt über einer flachen Tabelle hält ebenfalls 16. **Über** der ersten Zeile einer Seite
dieselben 16: von der Linie des Seitenkopfs bzw. der Reiterleiste bis zur Filterzeile oder Leiste,
und unter der Filterzeile wieder 16 (Abschnitt 3, „Maße“; seit 15.10. spät in jedem Reiter, auch
ohne Filterzeile).

Im grauen Light ist das Band Inhalt und damit weiß wie die flache Tabelle.

**Das Band im Kasten (Drawer, seit 15.10. spät):** Visibility Chart und Top Citations stehen im
Drawer als Band (`data-flach="yes"` aus `.drawer_markup.py`), aber in **einem** Kasten mit
**einer** durchgehenden Trennlinie zwischen Chart und Tabelle — „als ein Container mit Border,
bzw. einen durchgehenden Separator mittig“. Vorher zwei Karten mit Überschrift darüber und 16
Luft dazwischen. Innen alles wie das offene Band (Überschriftzeile 48, Fläche, flache Tabelle mit
Linie unter der Überschriftzeile, Tabellenkopf 48 ohne Grund).

```
Kasten       1px --vc-border, Radius --up-r-2xl (12), Grund --vc-bg, kein Auslauf
Trennlinie   der Rand der zweiten Einheit: nebeneinander links (Top Citations bei 35 %),
             gestapelt (.is-narrow, .is-max) oben; über die volle Höhe bzw. Breite
Ecken        overflow bleibt sichtbar (Menüs der Überschriftzeile); die Tabelle rundet an der
             Ecke des Kastens selbst mit 11 (unten rechts, gestapelt beide unteren)
Dunkel       der Rand bleibt (Drawer und Kasten tragen beide Background 1, die Füllung trennt
             nicht); Tabellenkopf behält --vt-head-bg; die Trennlinie bleibt
Luft         die 16 unter dem Band (--up-band-luft) gilt im Drawer nicht, der Stapel hält 64
Schmal       fällt die letzte Spalte weg, verliert die dann letzte sichtbare ihre Linie rechts
             (sonst doppelt neben dem Rand des Kastens)
```
Nur im Drawer-Kontext; auf den Seiten bleibt das Band offen.

---

## 8g. Add-Prompts-Liste und Plus im Prompt-Kopf (seit 15.10.)

**Liste im Dialog „Add Prompts“** (`add-prompts.css`): Zeilen wie in einer Tabelle, keine grauen
Kästen mehr.

```
Zeile       40 hoch (--up-h-gross), Polster 0 4px 0 8px, getrennt durch 1px --vc-border,
            Hover --vt-row-hover
Text        13/500, eine Zeile mit Ellipse; voller Text per UC.makeClipTip nur bei Kürzung
Stift       .up-iconbtn.is-24 direkt hinter dem Text, sichtbar bei Hover/Fokus (Platz bleibt),
            ohne Zeiger immer
Markt       UC.marketChip in fester 52er Spur; X ganz rechts; beide immer sichtbar
Bearbeiten  einzeiliges Feld in derselben Zeile (32 in 40), der erste Buchstabe bleibt auf
            seinem Pixel; Enter/Blur speichern, Esc bricht ab
```

**Plus im Kopf „Prompt“** (`.upt-addprompt`, nur in der einen Leiste): `.up-iconbtn.is-24` mit
Zeichen `plus`, Tooltip „Add Prompts“, öffnet denselben Dialog. Lage wie bei Brands
(`.ubo-addbrand`): `margin-left: auto; margin-right: -8px` am rechten Ende der Kopfzelle, der
Greifer bleibt frei.

---

## 9. Skeleton / Loading (Geist, seit 15.10.)

**Eine Form für alle Skelette**, gelesen an vercel.com/geist/skeleton: ein wandernder Glanz statt
Pulsieren. Bis 15.10. gab es zwei nebeneinander (Pulsieren `uutpulse` an Tabellen, Lichtlauf
`upskt` an Diagrammen); ihre Keyframes bleiben für den Vertrag stehen, tragen aber nichts mehr.

```css
.up-skelett { background: var(--vc-sk) var(--up-sk-verlauf); border-radius: var(--up-sk-r);
              animation: var(--up-sk-bewegung); }
@keyframes up-sk-geist { from { background-position: 300% 0; } to { background-position: 0 0; } }
```

| Token | Wert |
|---|---|
| `--up-sk-r` | 5px (Geist `rounded-[5px]`; voll rund für Avatare, eckig für Bildkacheln) |
| `--up-sk-dauer` / `--up-sk-kurve` | 1.5s / ease-in-out |
| `--up-sk-bewegung` | `up-sk-geist var(--up-sk-dauer) var(--up-sk-kurve) infinite`; bei `prefers-reduced-motion` `none` |
| `--up-sk-glanz` | hell `rgba(0,0,0,.03)`, dunkel `rgba(255,255,255,.025)` |
| `--up-sk-verlauf` | Verlauf transparent, Glanz, transparent auf einer 150 % breiten Kachel |

Grundfarbe bleibt `--vc-sk` (`#eeedef` / `#28282c`) und wird am Element aufgelöst. Die Kachel ist
150 % breit und fährt per `background-position` um ihre eigene Breite, ohne `::after` und ohne
`overflow` am Element (sonst verschöbe sich die Grundlinie jeder Tabellenzeile). Wer kein
`.up-skelett` nehmen kann, schreibt `background: var(--vc-sk) var(--up-sk-verlauf); animation:
var(--up-sk-bewegung);`. Tabellenbalken `.up-tsk-bar` (12 hoch, Radius 5), Logo `.up-tsk-logo`
(24, Radius 6). Skelette in geparkten Ansichten und geschlossenen Drawern stehen still.

- Zwei unabhängige Processing-Flags pro Element (`data-processing` + `data-processing2`): Skeleton zeigt sich, sobald **einer** von beiden `"yes"` ist. So lassen sich Chart- und Tabellen-Ladezustand getrennt an unterschiedliche Bubble-States binden.

---

## 9a. Leerzustand (Geist, seit 15.10.)

Gelesen an vercel.com/geist/empty-state. Gilt nur für `.up-leer`, das `UC.leerHtml({ gefiltert,
was, icon, titel, text, knopf, mini })` setzt. Der Fehlerzustand (`UC.leseFehlerHtml`) bleibt
bewusst, wie er ist.

```
Aufbau     eine Spalte, mittig; 24 zwischen Zeichen, Textblock und Aktion; 8 zwischen Titel
           und Satz; Polster 48 oben und unten, 24 seitlich
Zeichen    32px in einer umrandeten Kachel 54x54: 10 Polster, 1px --vc-border, Radius 8
           (--up-r-l), Grund --vc-bg, Farbe --vc-muted
Titel      16/24, Schnitt 500, Laufweite -0.02em, höchstens 340 breit, ausgeglichen umbrochen
Satz       14/20, --vc-muted, höchstens 340 breit
Aktion     Sekundärknopf: 32 hoch, Polster 0 12px, Radius 6 (--up-r-m), Grund --vc-bg,
           1px --vc-border, Schrift 14/500
```
Kein eigener Rahmen um das Ganze (anders als bei Geist): der Leerzustand steht fast immer schon
in einem Tabellenkörper oder `.up-box`. Gefiltert bringt der Baustein die Lupe, „No matching …“
und den Räum-Knopf mit; im Ruhefall gibt es kein Standardsymbol. Bis 15.10. Zeichen 28px ohne
Kachel, Titel 14, Satz 12.5.

### Die Chart-Fassung (`UC.chartLeerHtml`, seit 15.10.)

Jeder leere Chart trägt denselben Leerzustand, gezeichnet von den Bausteinen selbst:
`makeLine().empty()`, `makeTypeChart().empty()` (auch über `renderDonut`/`renderBars` mit leeren
Daten) und `makeBarList().render([])`. Eine Komponente muss ihn nicht kennen. Flächen ohne diese
Bausteine (Landschaft in brands-overview, Heatmap des Performance Radar) rufen
`UC.chartLeerHtml({ titel, text, icon, gefiltert, fluss })` selbst.

```
Text       Titel "No data yet", Satz "Data will appear here once responses are collected for
           this period."; gefiltert "No matching data" mit Lupe und "Try changing the filters
           or the date range." Kein Knopf (im Chart hängt niemand an data-clearall).
           Wer den Grund genauer kennt, gibt den Satz mit: empty({ text: "No URL types for
           this period." }).
Zeichen    Linie chartSpline, Ring donut, Balken chartBarDec, Landschaft und Heatmap
           dashboardSquare (layoutGrid ist das Rautenzeichen der Gitteransicht, liest sich wie #)
Lage       Hülle .up-chart-leer absolut über der GANZEN Chartfläche (inset 0), Inhalt senkrecht
           mittig, Polster 16 24. Die Fläche behält die Höhe des Charts, die Seite springt nicht.
Größe      nach der Fläche (Container-Query an der Hülle), nicht nach dem Aufrufer:
             ab 220 hoch     Kachel, Titel, Satz (bis 202 mit Polster)
             unter 220       Kachel und Titel, Abstand 16 (126)
             unter 130       nur der Titel (56)
             unter 280 breit ohne Satz
Fluss      fluss: true für Flächen ohne eigene Höhe (Balkenliste): im Fluss, Polster 24,
           immer kompakt (Kachel und Titel, 142) — außer im Band mit zwei Einheiten (unten)
Wirt       makeTypeChart setzt .up-chart-leer-wirt (nur position: relative), solange der
           Zustand im Körper steht; die Linie braucht nichts, .up-line-wrap ist positioniert
```

**Leer ist nicht kaputt.** Ein Lese- oder Ladefehler im Chart bleibt der knappe Text von vorher:
`meldung("…")` an makeLine und makeTypeChart. `empty("Text")` mit einer Zeichenkette ist aus
demselben Grund dasselbe wie `meldung` — ältere Aufrufer, die dort einen Fehler hineinreichen,
zeigen weiter keinen Leerzustand. Gefiltert kommt aus `cfg.gefiltert()` der Bausteine; die
Seiten (Dashboard, Brands, Citations) schicken dafür `gefiltert` im Payload, berechnet mit
`UC.seitenFilterAktiv(f)` (Modelle, Märkte, Topics, Intent-Filter; der Zeitraum zählt nicht).

### Die Tabellen-Fassung (`UC.tabelleLeerHtml`, seit 15.10.)

Kleine Tabellen und Listen neben einem Chart tragen denselben Zustand wie der Chart, nicht mehr
das knappe „No data" (`.up-empty-mini`). `UC.tabelleLeerHtml({ titel, text, icon, gefiltert,
zeilen })` ist `chartLeerHtml` in einer Hülle, die der absoluten Fläche ihre Höhe gibt.

```
Text       wie im Chart: "No data yet" / gefiltert "No matching data" mit Lupe; ein Satz, den
           die Tabelle genauer kennt, wird der Satz ("No variations recorded for this brand.")
Fläche     .up-tab-leer: min-height = zeilen x Zeilenhöhe, also genau die Fläche des Skeletts
           davor (kein Sprung zwischen Laden und Leer); flex 1, in einem Band fester Höhe bis an
           dessen Unterkante. Ohne zeilen 4 (220, volle Form)
Zeile      --up-tab-leer-zeile: 72 wie .up-row, dicht (is-dense) und .up-vrow 55 (--up-h-row);
           eigene Zeilen setzt die Komponente: Top Brands und Top Citations 55, Brands Overview
           56, Agentic-Listen 36
Größe      die Stufen der Chart-Fassung: ab 220 voll, darunter Zeichen und Titel, unter 130 nur
           der Titel, unter 280 breit ohne Satz
Kopf       bleibt stehen wie beim Skelett. In Shopping und Ads steht der Zustand NEBEN dem
           Spaltenscroller (Kopf darin, Zustand darunter im Kasten): bei 375 ist der Kopf dort
           bis 1096 breit, der Zustand sitzt mittig über dem Sichtbaren
Zeichen    das des Spaltenkopfs bzw. der Sache: squareStack (Marken, Varianten), domain
           (Domains/URLs), stackStar (Produkte), store (Händler), messageCircle (Auftritte),
           tags (Topics), zap (Prompts)
```

Verwender: Top Brands (visibility-chart), Top Domains/URLs (topcitations-dashboard), Brands
Overview (auch Suche und Reiter Inactive, dort ohne Satz), die zwei Agentic-Listen
(power-dashboard), Brand Landscape, Top Products, Merchants und Recent Appearances (shopping),
Topics with Ads und Prompts des Werbetreibenden (ads), die Variantentabelle (`UC.variationRows`
in brand-detail und performance-detail). Die Ads-Kacheln des Werbetreibenden tragen den vollen
`UC.leerHtml` wie „Recent Ads" der Übersicht (Kacheln, keine Zeilen). Lesefehler und der
Widerspruch zum Zähler in Top Citations bleiben der knappe Text.

`makeColumns` stempelt seit demselben Tag auch den Kopf (`data-up-colsig` an `.up-thead`):
eine Tabelle, die im Leerzustand nur ihren Kopf neu zeichnet, hat keine Zeile, an der die
Prüfung „ungestempelt" anschlagen könnte, und zeigte bei 375 alle Kopfzellen (Brands: sechs
Zellen auf vier Spuren, zweite Rasterzeile).

### Zwei Leerzustände in einem Band (seit 15.10. spät)

In einem Band mit zwei Einheiten (`.up-band-zwei`: Visibility Chart und Top Citations auf dem
Dashboard und in den Drawern, Citations, Shopping, Ads) sitzen beide Leerzustände **gleich**:
gleiche Höhe, gleiche Stufe, mittig — egal ob Chart, Doughnut, Balkenliste oder Tabelle. Vorher
lag jeder über seiner Teilfläche (Zeichenfläche, Körper unter dem Doughnut-Kopf, Tabelle unter
ihrem Kopf, Balkenliste oben im Fluss und immer kompakt); gemessen bei 1440 standen die Mitten
bis 108 auseinander (Ads), dazu kompakt neben voll.

```
Fläche     der GANZE Kasten der Einheit: ihr Kind unter der Überschriftzeile. Er reicht in beiden
           Einheiten von derselben Linie bis an die Unterkante des Bandes, also gleiche Mitte und
           gleiche Container-Größe (Stufe). Was dazwischen positioniert war (.up-line-wrap,
           .up-chart-leer-wirt, .up-tab-leer, Panels der Komponenten), steht statisch, solange
           die Ebene darin steht — gefüllt greift keine Regel
Kopf       der Tabellenkopf liegt unter der Ebene und bleibt bedienbar (pointer-events none);
           .up-tab-leer ist im Band mindestens 220, der volle Zustand lässt über sich 49 frei
Balken     die Balkenliste wird im Band eine Ebene wie die anderen (Stufe nach Fläche statt
           immer kompakt). Ihre Hülle .up-bars-leer hält die Höhe des letzten Skeletts
           (Zeilen x 26), gestapelt springt nichts. Außerhalb eines Bandes unverändert (is-fluss)
Gestapelt  jede Einheit ist ihre eigene Zeile und mittig in ihrem Kasten; die Stufe folgt dort
           ihrer eigenen Höhe (Balkenliste 154/180: kompakt, Tabelle voll)
Nur zwei   ein Band aus einer Einheit (Brands, die Diagramme über Shopping und Ads) hat keinen
           Nachbarn und bleibt, wie es ist; ohne data-flach (Bubble) greift nichts
```

Product Movement (Shopping) zeigt „Not enough history yet" seitdem über `UC.tabelleLeerHtml`
(4 Zeilen, wie sein Skelett) statt `UC.leerHtml` im Fluss: das Band sprang beim Laden um 42.
Steht nur eine Einheit leer neben einer gefüllten, sitzt ihr Zustand ebenfalls mittig im ganzen
Kasten (vorher: Balkenliste kompakt oben).

---

## 10. Layout-Verhalten (Responsive)

### Kopfzeile: 64px Mindestabstand, gemessen statt geraten

Zwischen dem Überschriften-Block links (Label + Punkt + Count) und den
Bedienelementen rechts bleiben **mindestens 64px** Abstand. Wird es enger, fallen
die Controls **einzeln** weg, unwichtigstes zuerst.

Der Auslöser ist eine **echte Messung**, kein Breiten-Schwellwert. Der Platz für die
**geöffnete Suche wird dabei immer reserviert**, auch solange sie zugeklappt ist,
sonst würde das Ausklappen auf engem Screen in die Überschrift laufen oder die
Toolbar-Tiers beim Öffnen umspringen lassen:
```js
var MIN_HEAD_GAP = 64;
var SEARCH_OPEN_WIDTH = 202;   // Box 200 + 2 Margin (siehe .udt-search.is-open)
var TOOLBAR_TIERS = ["is-w3", "is-w2", "is-w1", "is-w0"];   // unwichtigstes zuerst
function headGap(){
  var h  = elHeading.getBoundingClientRect();
  var tl = elHeadTools.getBoundingClientRect();
  if (!tl.width) return Infinity;        // noch nicht gelayoutet -> nichts ausblenden
  var gap = tl.left - h.right;
  if (!elSearch.classList.contains("is-open")) gap -= SEARCH_OPEN_WIDTH;   // als wäre Suche offen
  return gap;
}
function fitToolbar(){
  TOOLBAR_TIERS.forEach(function(c){ root.classList.remove(c); });   // von vorn beginnen
  for (var i = 0; i < TOOLBAR_TIERS.length; i++){
    if (headGap() >= MIN_HEAD_GAP) return;
    root.classList.add(TOOLBAR_TIERS[i]);   // erzwingt Reflow, nächste Messung ist ehrlich
  }
}
```
Effekt: Die Tier-Entscheidung ist identisch, ob die Suche offen oder zu ist, das
Layout ist über das Öffnen hinweg stabil.

Warum gemessen und nicht per Breakpoint: Die Root-Breite sagt nichts darüber aus,
wie viel Platz die Controls tatsächlich brauchen. Ein langer Brand-Name, ein Label
wie „3 Citation Types" oder eine andere Überschrift verschieben den Punkt, an dem
es eng wird. Feste Schwellwerte ließen Elemente verschwinden, während noch reichlich
Platz war. Dasselbe Prinzip wie bei den Trend-Chips in Abschnitt 8.

**Wichtig:** `fitToolbar()` muss auch dann laufen, wenn sich die Toolbar von selbst
verbreitert, ohne dass ein Resize stattfindet — beim Auf- und Zuklappen des
Suchfelds und bei jeder Label-Änderung eines Trigger-Buttons. Hilfsfunktionen, die
Labels setzen, dürfen deshalb **keine frühen `return`s** haben, sonst läuft die
Neumessung nur in einem der Zweige.

### Sticky Table-Header (nur wenn die Komponente direkt injiziert ist)

Ein seitenweit klebender Header ist nur möglich, wenn die Komponente **direkt in die
Seite injiziert** ist (kein iframe). Im iframe klebt er nur am iframe-Rand. Umgesetzt
in `domains_table.html`; die Reihenfolge der Fallen unten ist die, in der sie real
aufgetreten sind, jede war ein eigener Bug.

**Aktivierung.** Standardmäßig an ab **1000px Seitenbreite** (`window.innerWidth`,
bei direkter Injektion die echte Seitenbreite), abschaltbar per `data-sticky="no"`.
Nur Desktop, weil auf Mobile/Tablet die Filter von oben ausklappen und mit einem
klebenden Header kollidieren. Toggle setzt die Klasse `udt-sticky` am Root.

**Offset ist ein fixer, an EINER Stelle editierbarer Wert.** CSS-Variable
`--udt-sticky-top` am Root (Default 171px = Topbar-Höhe der Seite), zusätzlich pro
Platzierung via `data-sticky-top="171"`. Nicht aus der Komponente heraus messen
wollen — über die Seitengrenze kommt sie an fremde Floating-Groups nicht heran.

**Scroll-Modell bestimmt den Offset.** Scrollt die ganze Seite, ist der Offset die
Topbar-Höhe. Scrollt eine Bubble-Group (häufig), klebt der Header relativ zur
Group-Oberkante — der Offset kommt dann meist automatisch daher, wo die Group sitzt.
Bei der falschen Annahme reißt der Offset eine Lücke auf.

**1. Overflow-Falle.** `overflow: hidden` auf der Box (das, was die runden Ecken
macht) **fängt `position: sticky` ein**. Im Sticky-Modus daher `overflow: visible`.

**2. Zwischen-Container entsperren (Bubble).** Sticky klebt am nächsten scrollenden
Vorfahren, aber jeder Vorfahre dazwischen mit `overflow != visible` fängt es vorher
ein — in Bubble haben Reusable-/HTML-Wrapper oft `overflow: hidden` (oder
`overflow-x: hidden`, was per Spec `overflow-y` heimlich zu `auto` macht). Ein
JS-Walk-up läuft von der Tabelle nach oben und setzt solche Traps auf `visible`, bis
er den echten Scroll-Container (`overflow-y: auto/scroll`) erreicht, den lässt er in
Ruhe. Originalwerte in einem `data`-Attribut sichern, um beim Abschalten sauber
zurückzusetzen. **Ohne diesen Walk-up klebt in Bubble gar nichts.**

**3. Beide Header kleben.** Komponenten-Kopf (`.udt-head`) und Spaltenkopf
(`.udt-thead`) sind beide `position: sticky`. Der Spaltenkopf-Offset ist die per JS
gemessene Kopfhöhe (`--udt-thead-off`), damit er lückenlos darunter sitzt.

**4. box-sizing-Falle beim Gap.** Der 16px-Abstand zwischen Kopf und Tabelle wird im
Sticky-Modus von `margin` zu opakem `padding-bottom` (sonst kollabiert er beim
Kleben und Zeilen scheinen durch). ABER mit `box-sizing: border-box` frisst das
Padding die 32px-Kopfhöhe von innen auf → Toolbar-Buttons werden abgeschnitten.
Deshalb im Sticky-Modus zusätzlich `height: 48px` (32 Inhalt + 16 Padding).

**5. Opake Hintergründe sind Pflicht.** Kopf, Maske und Spaltenkopf brauchen soliden
`--vc-bg`, sonst scheinen durchscrollende Zeilen durch. Beim Spaltenkopf den Tint als
`linear-gradient`-Layer über soliden `--vc-bg` legen (behält den Tint, wird opak).

**6. Zeilen hinter einer transparenten Topbar.** Ist die Seiten-Topbar transparent,
scrollen Zeilen dahinter durch. Der Kopf bekommt ein opakes `::before`, das von seiner
Oberkante bis zur Viewport-Oberkante reicht (`height: var(--udt-sticky-top)`).

**7. Border NICHT auf die Box, sondern auf Kopf/Body.** Sitzt der Spaltenkopf 1px
innerhalb der Box-Border, überdeckt sein opaker Hintergrund die gerade obere
Box-Border, während die Ecken sie durchlassen → doppelte Ecke, fehlende Oberkante.
Lösung: Box-Border transparent, sichtbare Border auf `.udt-thead` (oben + Seiten,
runde obere Ecken) und `.udt-tbody` (Seiten + unten, runde untere Ecken). Beide volle
Breite, exakt fluchtend, kein Versatz. Der `.udt-table`-Hintergrund muss dabei
transparent werden (sonst überdeckt er die Border).

**8. Der Eck-Zipfel (der letzte Boss).** Eine runde Ecke ist an der Ecke per Definition
transparent — dahinter scrollt die gerade Seiten-Border des Bodys vorbei und schaut
durch. Fix: zwei 16×16-`::before`/`::after`-Eckstücke am Spaltenkopf, die **nur das
Dreieck außerhalb der Rundung** mit `--vc-bg` füllen, die Rundung selbst bleibt
transparent:
```css
.udt-sticky .udt-thead::before,
.udt-sticky .udt-thead::after { content:""; position:absolute; top:-1px; width:16px; height:16px; pointer-events:none; z-index:2; }
.udt-sticky .udt-thead::before { left:-1px;  background: radial-gradient(circle at bottom right, transparent 16px, var(--vc-bg) 16.5px); }
.udt-sticky .udt-thead::after  { right:-1px; background: radial-gradient(circle at bottom left,  transparent 16px, var(--vc-bg) 16.5px); }
```
Zwei Details, die beim ersten Versuch falsch waren: Das Stück muss `top:-1px`/`left:-1px`
an die **Außenkante** der Border (absolute Positionierung bezieht sich sonst auf die
Padding-Box, 1px zu weit innen), und der Farbübergang muss **hinter** der Border liegen
(16px, nicht 15.5px), sonst wird die runde Border selbst überdeckt.

> **Stand 15.10.:** In core heißt das heute `.up-sticky .up-thead::before/::after` und füllt mit
> `--up-surface` statt `--vc-bg`. Größe und Verlauf kommen seit dem 15.10. aus `--up-r-2xl`, dem
> Radius des Kopfes (heute 12; vorher standen dort 16 fest). Die Regel: Eckstück = Radius des
> Kopfes, Verlauf ab genau diesem Radius, Übergang `calc(var(--up-r-2xl) + .5px)`.

**Alternative (garantiert sauber):** interner Scroll — Box mit `max-height` +
`overflow: hidden` (runde Ecken) + `overflow-y: auto`, Spaltenkopf klebt an der Box.
Das clippt alles automatisch an der Rundung (kein Zipfel, keine Border-Tricks), kostet
aber den Gruppen-Scroll (Tabelle scrollt dann im eigenen Bereich). Wenn ein Layout
internen Scroll verträgt, ist das der einfachere Weg.

`z-index`: Kopf 6 > Spaltenkopf 5 > Zeilen, alle weit unter den `position:fixed`-Dropdowns
(`9999`), damit Menüs alles überlagern.


### Weiteres

- Zwei Chart-Units nebeneinander (Flex, `gap:16px`) brechen unter **880px** Root-Breite in gestapelten Modus um (`gap:32px`, jede Unit 100% Breite, feste Höhe 427px)
- Legenden-Namen truncaten via echtem `flex-shrink` (nicht nur feste `max-width`-Stufen) — Zeile hat zusätzlich `overflow:hidden` als Sicherheitsnetz, damit Text **nie** aus dem Rahmen ragt
- Bei Root-Breite < 500px: Legende wird komplett ausgeblendet
- Doughnut-Chart: fix `52%/max 200px` Durchmesser, sobald die Legende darunter statt daneben rutscht (`.is-collapsed`, Layout-Breite < 320px) wächst er auf `75%/max 220px` — **quadratisch über `aspect-ratio:1/1`**, nie über getrennte width/height-Werte (sonst droht ein ovaler statt runder Doughnut)

---

## 11. Scroll-Verhalten (wichtige Falle)

Chart.js setzt `touch-action:none` auf den Canvas, was natives Scrollen blockiert. Der Fix dafür: ein `wheel`-Listener, der das Event manuell an den **nächsten echten Scroll-Container** weiterreicht — gesucht wird ab dem **tatsächlichen Event-Ziel** (`e.target`) nach oben, nicht ab einem festen Element. Das ist entscheidend, sonst hijackt der Listener auch Scroll-Versuche in eigenen Dropdown-Listen oder (schlimmer) in einem Bubble-Popup, das die Komponente zufällig enthält — beides führte in der Vergangenheit zu Bugs, bei denen die Hauptseite mitscrollte statt des eigentlich gemeinten Containers.

---

## 12. Quick Actions (Mira-Familie, Präfix `am-`/`mqa-`) — eigenes Token-Set, bewusst kein core.css

> Inzwischen migriert: `quick-actions.css`/`.js` + `bubble/quick_actions_bubble.html`. Bleibt
> trotzdem eigenständig dokumentiert, weil die Komponente absichtlich **kein** `core.css`/`core.js`
> lädt — sie ist ein Seiten-Singleton (`#mira-quick-actions`, kein `.up-root`, keine
> `data-instance`), nicht ein wiederholbares Tabellen-/Chart-Element, und brachte ihr komplettes
> eigenes `--am-*`-Token-Set schon aus der Pre-Core-Ära mit. Gilt nicht als Vorlage für neue
> Tabellen-/Chart-Komponenten — dafür `urls-table.*`/Abschnitt 25 nehmen.

Die Schriftstufen zeigen seit dem 24.09. auf die Kern-Token (`--am-text: var(--vc-text)` usw.),
Radien, Höhen und Tiefen lesen die Kern-Token mit Rückfallwert (`var(--up-r-2xl, 12px)`,
`var(--up-e-4, …)`), damit die Palette auch ohne core funktioniert. Eigene Werte bleiben für
Rahmen und weiche Flächen: hell `--am-border` `#e5e7eb`, `--am-soft` `#f7f8fa`, `--am-soft-2`
`#f3f4f6`; dunkel seit 15.10. die Marken der Dropdowns selbst (`var(--up-menu-border)`,
`var(--up-sel-bg)`, Karte `var(--up-menu-bg)`, also `#454545` / `#1f1f1f` / `#0a0a0a`).

### Das Command Menu von Geist (seit 15.10.)

Gelesen an vercel.com/geist/command-menu (berechnete Stile des geöffneten Beispiels).

```
Schleier       hell: der Grund zu 80 % (color-mix(--am-card 80%, transparent)), OHNE Unschärfe;
               dunkel rgba(0,0,0,.55); Karte 15vh von oben
Karte          min(640px, 94vw) breit, max. 82vh, Radius 12 (--up-r-2xl), 1px --am-border,
               Schatten --up-e-4; Einblenden aus scale(.96) mit Deckkraft,
               cubic-bezier(.175,.885,.32,1.1), 260ms (--up-t-3)
Eingabezeile   Polster 12px 16px 13px, min. 53 hoch, Abstand 12; Lupe 16; Feld 28 hoch,
               16/400 (Geist 18, unter 16 zoomt iOS); rechts die Taste "Esc"
               (.mqa-kbd im Menü: 20 hoch, Polster 0 4px, Radius 4, 1px-Ring, 12/400)
Auslöser       das "⌘K" am Quick-Actions-Knopf der Seitenleiste in einem kleinen Kasten:
               20 hoch, Polster 0 5px, 1px --vc-border, Radius 4 (--up-r-xs), ohne Grund,
               Schrift --vc-third (15.10. spät; vorher ohne Rand)
Gruppenkopf    36 hoch, Polster 0 8px, 13/400, --vc-third
Eintrag        mindestens 36 hoch, Polster 4px 8px, Abstand 12, Radius 6 (--up-r-m);
               aktiv: 5 % der Schriftfarbe als Grund (color-mix)
Avatar         24, Radius 6, 1px Rand; Flaggen 24x18 Radius 3 ohne Rand
Trenner        1px --am-border über die volle Breite, 8 darüber und darunter
Keine Treffer  Polster 30px 16px, 14/20, mittig
```

> **Bewusst OHNE Linie unter dem Suchfeld.** Geists Command Menu trennt die Eingabezeile mit
> einer Linie; der Nutzer hat „ohne Linie“ mehrfach ausdrücklich verlangt, und das gilt, bis er
> es aufhebt. An ihrer Stelle steht 1px Luft (Polster unten 13 statt 12), damit die Liste nicht
> springt. Nicht „nach Geist“ nachziehen.

Ebenfalls bewusst abweichend: Nachsatz 13 statt 14, Ergebniszeilen zweizeilig (Titel und
Adresse), die Lupe bleibt. Eine Fußzeile mit Tastenhinweisen hat Geist nicht, hier auch nicht.
Tastatur (Pfeile, Enter, Esc), Suche und Ereignisse sind unverändert.

- Scrollbar-Thumb: `var(--am-border-strong)`, voll rund, 3px „Border“ in Kartenfarbe (schwebender Thumb)
- Trend-Farben: eigene Marken `--am-up`/`--am-down` (die Datei sieht core nicht), mit denselben
  Werten wie `--vt-up`/`--vt-down` nach Geist: hell `#297a3a`/`#cb2a2f`, dunkel `#62c073`/`#ff6166`
  (seit 15.10.; vorher `#2ea84a`/`#b0200c` und `#60d25d`/`#d25d5d`).

---

## 13. Bubble-Event-Kontrakt (JS → Bubble)

Genauso verbindlich wie die visuellen Regeln. Jede neue Komponente folgt exakt
diesem Muster, damit die Bubble-Seite immer gleich aufgesetzt wird.

### Grundprinzip

**Ein Event feuert genau EINEN JSON-String als einziges Argument.** Nie mehrere
Parameter, nie ein Objekt, nie ein Array. Die Bubble-Seite zieht die Werte per
Regex aus diesem String. Dasselbe Format wie bei `miraAction` und dem Export-Popup.

```js
/* Im Init einmal aufrufen — gibt eine fire()-Funktion zurück. */
var fire = UpstreemCore.makeFire(root, { label: "udt", eventPrefix: "udt-" });

/* Danach pro Event einfach: */
fire("data-sort-fn", "udtSort", { sort_field: "share", sort_dir: "desc" });
```

`makeFire` übernimmt die Funktionssuche über iframe-Grenzen, das `console.warn` beim Fehlen und das DOM-`CustomEvent`. Drei Dinge sind Pflicht:

1. **Funktionsname kommt aus einem `data-*-fn`-Attribut**, mit dem Standardnamen als
   Fallback. So kann dieselbe Komponente mehrfach auf einer Seite liegen
   (`bubble_fn_udtSearch_[dynamic id]`), ohne dass sich die Events gegenseitig auslösen.
2. **Fehlt die Funktion, wird `console.warn` mit dem gesuchten Namen geloggt** — nie
   stillschweigend nichts tun. Ein Event, das im Nichts landet, ist sonst
   stundenlang nicht auffindbar.
3. **Zusätzlich immer ein `CustomEvent` am Root** (`bubbles: true`). Damit können
   andere Komponenten auf derselben Seite mithören, ohne über Bubble zu gehen.

### Funktionssuche über iframe-Grenzen

Bubble rendert HTML-Elemente teils in iframes, teils nicht. Deshalb wird die
Funktion nicht nur auf `window` gesucht:

```js
window[fnName] → window.parent[fnName] → window.top[fnName] → Breitensuche über alle
erreichbaren iframes (Queue + seen-Liste gegen Zyklen, jeder Zugriff in try/catch
wegen Cross-Origin)
```

Ohne diese Suche funktioniert die Komponente im Editor, aber nicht im Popup, oder
umgekehrt. Der `try/catch` um jeden Fensterzugriff ist nicht optional — ein
fremdes iframe wirft sonst und bricht die ganze Schleife ab.

### Namenskonvention

```
bubble_fn_<präfix><Event>          z. B. bubble_fn_udtSearch, bubble_fn_uutRowClick
```
Präfix ist das Komponenten-Kürzel in Kleinbuchstaben (`udt` = Domains Table,
`uut` = URLs Table), Event in CamelCase. Dieselben Kürzel auch für die
`requestId` (`udt_1721…`), die localStorage-Keys (`udt_cols__<instanceId>`) und
das CustomEvent (`udt-udtSearch`).

### Regex-Konvention (Bubble-Seite)

```
Strings:   (?<="key":")[^"]*
Zahlen:    (?<="key":)[0-9]+          ← ohne Anführungszeichen im Lookbehind!
```

Daraus folgt eine harte Regel für die Payloads: **Was in Bubble als Text ankommen
soll, wird als JSON-String geschrieben, was als Zahl ankommen soll, als JSON-Zahl.**
Nachträglich lässt sich das nicht mehr unterscheiden, weil die Regex fest an den
Anführungszeichen hängt.

Konkret heißt das:

- **Booleans gibt es nicht.** Ein An/Aus-Zustand geht als `"yes"` / `"no"` / `""`
  raus (leer = Filter aus), nie als `true`/`false`. Bubble-Regex zieht nur Text,
  und `true` ohne Anführungszeichen wäre mit dem String-Pattern nicht greifbar.
- **Listen sind kommaseparierte Strings**, kein Array: `{"citation_types":"Editorial,Competition"}`.
  In Bubble dann per `:split by (,)` weiterverarbeiten.
- **Nur `limit`, `offset` und `page` sind echte Zahlen.**

### requestId gegen Race Conditions (bei jeder Suche Pflicht)

Suchanfragen kommen nicht garantiert in der Reihenfolge zurück, in der sie
rausgingen. Ohne Schutz überschreibt eine langsame Antwort auf „ni" die schnellere
auf „nike".

```js
function newReqId(){ return PREFIX + "_" + Date.now() + "_" + Math.random().toString(36).slice(2,8); }

// beim Feuern:
var reqId = newReqId(); latestReqId = reqId;
fire("data-search-fn", "…Search", { query: …, query_folded: …, query_de: …, requestId: reqId });

// beim Zurückrendern:
if (params.requestId != null && latestReqId != null &&
    String(params.requestId) !== String(latestReqId)) return;   // veraltet, verwerfen
```

Die Bubble-Seite muss die `requestId` also **unverändert zurückgeben**. Tut sie es
nicht (`null`), greift der Schutz einfach nicht, und es bricht nichts.

### Such-Verhalten (einheitlich in allen Komponenten)

```
DEBOUNCE = 400ms
MIN      = 2 Zeichen
```
- Unter der Mindestlänge geht **nichts** raus, und `latestReqId` wird auf `null`
  gesetzt, damit noch laufende Antworten nicht doch noch landen.
- **Eine leere Query geht immer raus.** Sonst bekommt die Tabelle ihre ungefilterte
  Liste nicht zurück, wenn der Nutzer das Suchfeld leert.
- Jede neue Suche setzt `state.page = 1` — ein neues Ergebnis hat keine Seite 3.
- Mitgeliefert werden immer drei Varianten der Query: `query` (roh),
  `query_folded` (Diakritika entfernt) und `query_de` (deutsche Umlaut-Expansion).
  Welche davon die RPC nutzt, entscheidet die Bubble-Seite.

### Alles ist serverseitig

Diese Events sagen Bubble, dass die RPC neu laufen soll. **Die Komponente filtert
und sortiert nie lokal.** Sonst laufen Anzeige und `totalCount` auseinander, sobald
paginiert wird.

### Rückkanal (Bubble → JS)

Zwei globale Funktionen pro Komponente, beide über `instanceId` adressiert:

```js
window.render<Name>Table({ instanceId: "...", rows: [...], totalCount: 123 });
window.set<Name>TableLoading("INSTANCE_ID", "yes" | "no");
```
Auch hier gilt `"yes"`/`"no"` statt Boolean, aus demselben Grund wie oben. Beide
werden zusätzlich auf `window.top` und in erreichbare iframes gespiegelt, damit ein
Run-JS-Step sie von überall erreicht.

Für die „Mentioned brands"-Auswahl gibt es zusätzlich einen dedizierten Setter:
```js
window.set<Name>TableBrands("INSTANCE_ID", brands);   // Array ODER JSON-String
```
`brands` sind Objekte im Format `{ company_id, name, logo_url }`. Aus Robustheit
werden auch `id`/`brand_id` (für die ID) und `logo`/`favicon` (fürs Logo) erkannt,
aber `company_id`/`logo_url` ist das kanonische Format. Der als Filter gefeuerte
Wert (`udtMentioned` → `brands`) ist die kommaseparierte Liste der `company_id`s.

### Zwei getrennte Brand-Filter — nicht verwechseln

Es gibt in der Kopfzeile **zwei** brand-bezogene Bedienelemente, die **verschiedene**
Events feuern:

| Bedienelement | Beschriftung | Event | Payload |
|---|---|---|---|
| Toggle-Button | „{Brand} mentioned" | `…Brand` | `brand_mentioned`: `"yes"`/`"no"`/`""` |
| Dropdown | „All Brands" / „N Brands" | `…Mentioned` | `brands`: kommaseparierte `company_id`s |

Das ist die häufigste Verwechslung: Der **Toggle** heißt zwar „…mentioned", feuert
aber `…Brand` (yes/no/leer), **nicht** `…Mentioned`. `…Mentioned` gehört zum
**Dropdown** mit der Mehrfachauswahl. Wer den Toggle testet und einen Workflow auf
`bubble_fn_…Mentioned` gelegt hat, sieht deshalb „nichts passieren" — der richtige
Workflow-Name für den Toggle ist `bubble_fn_…Brand`.

### Sortieren: optimistische UI, gebündeltes Event

Ein Sortier-Klick darf **nie** blockiert werden. Der Header-Pfeil, der aktive
Spaltenzustand und das Dropdown reagieren sofort beim ersten Klick, ohne Delay.
Gebündelt wird ausschließlich das **ausgehende Event**:

```js
var SORT_DEBOUNCE = 250;   // kürzer als die Suche: ein Klick ist eine bewusste Handlung

function applySort(field, dir){
  state.sortField = field; state.sortDir = dir;
  state.page = 1;
  persist(); syncHeadSorters(); populateSort();   // UI zuerst, sofort
  clearTimeout(sortTimer);
  sortTimer = setTimeout(function(){
    fire("data-sort-fn", "…Sort", {
      order: orderValue(state.sortField, state.sortDir),
      sort_field: state.sortField, sort_dir: state.sortDir
    });
  }, SORT_DEBOUNCE);
}
```

Der Timeout liest den Zustand **beim Feuern** aus `state`, nicht die Argumente vom
Klick. Sonst ginge bei einer Klickfolge der zuerst geklickte Wert raus statt des
zuletzt gewählten.

Damit kostet der Weg Share → Share Trend → Last Seen **eine** Anfrage statt drei,
und Dauerklicken kostet eine statt dutzender.

**Warum nicht während des Ladens sperren:** Ein Control, das aufhört zu reagieren,
liest sich als kaputt, und Leute klicken dann härter statt zu warten. Große Apps
(Linear, Notion, GitHub, Airtable) machen es umgekehrt: Zustand sofort lokal
anzeigen, Anfrage bündeln, veraltete Antworten verwerfen. Genau dieses Muster.

### Sortier-Zyklus in Spaltenköpfen

Die Position innerhalb des Zyklus einer Spalte wird **aus dem aktiven Sort
abgeleitet, nie gespeichert**:

```js
function headSortClick(col){
  var cycle = HEAD_CYCLE[col];
  if (!cycle) return;
  var idx = cycle.indexOf(state.sortField + ":" + state.sortDir);  // -1 = andere Spalte sortiert
  var pos = idx + 1;                                               // -1 -> 0: Zyklus von vorn
  if (pos >= cycle.length){ applySort(DEFAULT_SORT.field, DEFAULT_SORT.dir); return; }
  var parts = cycle[pos].split(":");
  applySort(parts[0], parts[1]);
}
```

Eine gespeicherte Position driftet vom echten Zustand weg. Konkreter Fall, der
dadurch entstand: Nach dem Durchlauf sprang der Zyklus zurück auf den Default
(`share:desc`) und löschte die gespeicherte Position. Der nächste Klick startete
deshalb wieder bei Index 0 und lieferte **ein zweites Mal** `share:desc`, statt
weiter auf `share:asc` zu gehen. Abgeleitet kann das nicht passieren: Wo wir sind,
ist der Punkt, an dem der nächste Klick weitermacht, egal wie wir dorthin kamen
(Spaltenklick, Sort-Dropdown, Umbruch am Zyklusende oder Reset).

### Event-Tabelle: Domains Table (`udt`)

| Event | Funktionsname | Value | Regex |
|---|---|---|---|
| Suche | `bubble_fn_udtSearch` | `query` | `(?<="query":")[^"]*` |
| | | `query_folded` | `(?<="query_folded":")[^"]*` |
| | | `query_de` | `(?<="query_de":")[^"]*` |
| | | `requestId` | `(?<="requestId":")[^"]*` |
| Sortierung | `bubble_fn_udtSort` | `sort_field` | `(?<="sort_field":")[^"]*` |
| | | `sort_dir` | `(?<="sort_dir":")[^"]*` |
| Typ-Filter | `bubble_fn_udtFilter` | `citation_types` | `(?<="citation_types":")[^"]*` |
| Brand-Toggle | `bubble_fn_udtBrand` | `brand_mentioned` | `(?<="brand_mentioned":")[^"]*` |
| Mentioned-Brands | `bubble_fn_udtMentioned` | `brands` | `(?<="brands":")[^"]*` |
| Pagination | `bubble_fn_udtPage` | `limit` | `(?<="limit":)[0-9]+` |
| | | `offset` | `(?<="offset":)[0-9]+` |
| | | `page` | `(?<="page":)[0-9]+` |
| Zeilen-Klick | `bubble_fn_udtRowClick` | `domain` | `(?<="domain":")[^"]*` |

### Event-Tabelle: URLs Table (`uut`)

| Event | Funktionsname | Value | Regex |
|---|---|---|---|
| Suche | `bubble_fn_uutSearch` | `query` | `(?<="query":")[^"]*` |
| | | `query_folded` | `(?<="query_folded":")[^"]*` |
| | | `query_de` | `(?<="query_de":")[^"]*` |
| | | `requestId` | `(?<="requestId":")[^"]*` |
| Sortierung | `bubble_fn_uutSort` | `sort_field` | `(?<="sort_field":")[^"]*` |
| | | `sort_dir` | `(?<="sort_dir":")[^"]*` |
| Typ-Filter | `bubble_fn_uutFilter` | `citation_types` | `(?<="citation_types":")[^"]*` |
| | | `url_types` | `(?<="url_types":")[^"]*` |
| Brand-Toggle | `bubble_fn_uutBrand` | `brand_mentioned` | `(?<="brand_mentioned":")[^"]*` |
| Mentioned-Brands | `bubble_fn_uutMentioned` | `brands` | `(?<="brands":")[^"]*` |
| Pagination | `bubble_fn_uutPage` | `limit` | `(?<="limit":)[0-9]+` |
| | | `offset` | `(?<="offset":)[0-9]+` |
| | | `page` | `(?<="page":)[0-9]+` |
| Zeilen-Klick | `bubble_fn_uutRowClick` | `url` | `(?<="url":")[^"]*` |

> Der einzige strukturelle Unterschied zwischen beiden Tabellen: URLs Table hat
> zusätzlich `url_types` im Filter-Event, und der Zeilen-Klick liefert `url`
> statt `domain`.

### Reset-Verhalten

Ein „Filter zurücksetzen" feuert die betroffenen Events **einzeln mit leerem Wert**,
nicht ein eigenes Reset-Event:
```js
fire("data-filter-fn", "…Filter", { citation_types: "" });
fire("data-brand-fn",  "…Brand",  { brand_mentioned: "" });
```
So braucht die Bubble-Seite keinen Sonderfall, der leere String läuft durch
dieselben Workflows wie jeder andere Wert.

Der Reset **wendet sofort an** (siehe Abschnitt 6a), es folgt kein separater
Apply-Klick.

## 14. Dropdown-Menüs: reines `position:absolute` — KEIN Body-Portal, KEIN JS beim Scrollen

**Endgültige Entscheidung (nach einer sehr langen, schmerzhaften Runde — bitte nie wieder
umbauen).** Jedes Dropdown-Menü ist ein ganz normales `position:absolute`-Kind seines
`position:relative`-Wrappers (`.up-sort` / `.up-filter` / `.up-cols` / `.up-ment` / `.vot-sort`
/ `.vot-filter` / `.tcd-filter` …). Positioniert wird **ausschließlich per CSS**:

```css
.up-sort  { position: relative; }
.up-sort-menu { position: absolute; top: calc(100% + var(--up-dd-gap)); right: 0; z-index: 60;
  opacity: 0; transform: translateY(-4px) scale(.985); pointer-events: none;
  transition: opacity 140ms, transform 140ms; }
.up-sort-menu.is-shown { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
```

Öffnen/Schließen togglet nur die Klasse `.is-shown` am Menü (plus `.is-open` am Wrapper für den
Trigger-State). **Sonst passiert nichts** — kein Verschieben ins `<body>`, kein `placeMenu`, kein
Scroll-Listener.

**Warum kein Portal / kein JS-Repositioning (die Falle):** Früher wurden die Menüs beim Init nach
`document.body` verschoben und auf `position:fixed` gesetzt, damit ein `overflow:hidden`-Vorfahre
sie nicht abschneidet. Ein fixed-Menü bewegt sich beim Scrollen aber nicht von selbst mit, also
musste ein JS-Scroll-Listener es bei **jedem** Scroll-Event nachpositionieren. Egal wie das
optimiert wurde (rAF-gedrosselt, dann `transform`-Nudge + Settle-Timer): ein JS-Follow reagiert
prinzipbedingt **eine Frame zu spät** auf das Scrollen, also **zog/sprang** das Menü sichtbar
gegen seinen Trigger. Ein `position:absolute`-Kind bewegt sich dagegen im **selben Layout/Paint**
wie sein Trigger — geklebt per Konstruktion, null JS, null Lag, unmöglich zu ruckeln.

`UpstreemCore.makePortal()` und `UpstreemCore.placeMenu()` sind bewusst **No-op-Hüllen** (damit
bestehende Aufrufstellen nicht angefasst werden müssen). Neue Komponenten müssen sie **nicht**
aufrufen — einfach das Menü als `position:absolute`-Kind im relativen Wrapper lassen.

**Trade-off (bewusst akzeptiert):** Ein Menü kann jetzt von einem Vorfahren mit `overflow:hidden`
abgeschnitten werden — genau das, wogegen das Portal existierte. In der Praxis nie aufgetreten
(die Pre-Migration-Komponenten liefen schon immer auf `position:absolute`). Ein Dropdown, das
**immer** korrekt am Trigger klebt, ist mehr wert als die Robustheit gegen einen Clipping-Fall,
der real nicht vorkommt. Falls doch mal ein Container clippt: dort `overflow: visible` setzen —
nicht das Portal wieder einbauen.

- **Events:** Weil das Menü im `root` bleibt, deckt `root.contains(tg)` Menü-Klicks ab (der
  zentrale Outside-Click-Handler schließt nur bei Klick **außerhalb**). Die alten expliziten
  `elFilterMenu.contains(tg)`-Checks sind harmlos-redundant.
- **Dark-Mode:** greift über die normale Kaskade (`.up-root[data-theme="dark"] .<pfx>-menu`), weil
  das Menü im themed root liegt. Kein `syncPortalTheme` mehr nötig.
- **Nach unten aufklappend, kein Flip:** `top: calc(100% + Npx)` klappt immer nach unten auf —
  das ist „normales Dropdown"-Verhalten und war beim ursprünglichen Sort-By in der Visibility
  Chart nie ein Problem. Kein Flip-nach-oben, keine JS-`max-height`.

**Die eine bewusste Ausnahme:** visibility-chart's Color-Scale-Dropdown (`.up-scale-menu`, siehe
`visibility-chart.js`) IST body-gemountet und `position:fixed`. Kein Widerspruch zur Regel oben —
der Unterschied ist der GRUND: dort ging es um einen Bubble-Container, der zufällig zu kurz war
(ein Konfigurationsproblem, siehe `UC.unclipAncestors`, §-Core-B4). Hier ist der Vorfahre `.vot-box`
mit voller Absicht `overflow:hidden` — das clippt den Chart selbst an seinen runden Ecken, das darf
nicht weg. Und entscheidend: es gibt trotzdem **keinen Scroll-Listener** — die Position wird einmal
beim Öffnen aus `getBoundingClientRect()` berechnet, nicht laufend nachgeführt. Genau das JS-Follow-
Problem, das §14 verhindern soll, existiert hier also gar nicht; nur der Mount-Ort unterscheidet sich.

## 15. Multi-Select-Dropdown mit Suche (Mentioned Brands)

Für lange Auswahl-Listen (Brands) im Dropdown:

- **Suchfeld** ganz oben (zwischen Head und Liste), filtert **in-place** (blendet
  Nicht-Treffer per `style.display` aus, kein Re-Render → Fokus bleibt). Matching über ein
  `data-name`-Attribut (lowercase) am Item. Bei 0 Treffern ein dezentes „No matches".
- **Clear-X** im Suchfeld (`UC.icon("x")`), erscheint via `:not(:placeholder-shown) +`, in
  Sekundärfarbe, im Hover Primär.
- **Listenhöhe begrenzt:** `max-height` ≈ **10,5 Zeilen** — die 11. lugt halb raus als
  Scroll-Hinweis. Menü-`max-height` groß genug wählen, dass Kopf + Suche + Apply die Liste
  nicht unter die 10,5 Zeilen stauchen.
- **„Select all"** im Head, wenn nichts gewählt ist; **„Reset"**, wenn etwas gewählt ist.
  Beide **wenden sofort an** (kein Apply nötig).
- **(De)selektieren rendert nicht die ganze Liste neu** (das flackert), sondern togglet nur
  die `is-checked`-Klasse der Zeile und aktualisiert den Head (`syncMentHead()`).
- **Head-Höhe reservieren:** Der optionale Head-Button (Select all / Reset) ist **immer im
  Layout** und nur per `visibility:hidden` unsichtbar, wenn nicht gebraucht — sonst rutscht
  der Head in der Höhe, sobald der Button erscheint. (Gleiche Regel für den Columns-Head.)

## 16. Suchfeld (Geist-Search-Input, seit 15.10.) + Mobile

Aufbau unverändert: die Lupe (`.up-search-btn`, ein `.up-iconbtn`) zieht ein Feld nach rechts
auf (`.up-search-box`, 200px plus 2 Abstand, damit rechnet die Werkzeugleiste). **Offen ist es
Geists Search-Input**, in unserem Blau („nur halt mit meinem Blau, sonst aber genau das
Verhalten“):

```
Rahmen      .up-search.is-open: 1px --vc-border als box-shadow um Lupe UND Feld,
            Radius 6 (--up-r-m), Grund --vc-bg
Lupe        innen links als Präfix: 14px, 12px vom Rand, --vc-third, ohne Fläche
Text        14/400, beginnt 38px vom Feldrand; Platzhalter --vc-third
Hover       Ring --up-knopf-rand-hover (eine Stufe kräftiger)
Fokus       1px --up-focus plus 4px --up-focus-ring (#4A9EFF, wie jedes Feld der App)
Leeren      Zeiger-Geräte: Tastenschild "Esc" (20 hoch, min. 20 breit, Polster 0 4px,
            Radius 4, 1px-Ring --vc-border, 12/500) als Leeren-Knopf; Touch behält das X
Escape      das erste Escape leert den Text (über den Leeren-Knopf der Komponente, Fokus
            bleibt), erst ein leeres Feld schließt die Suche (einmal am Dokument, core.js)
```
Bis 15.10. war das offene Feld randlos und transparent (Notion-Stil), Text 14/500.

- **Clear-Platz immer reserviert** (`visibility`, nicht `display`), damit der Text nicht springt.
- **Kopf-Reserve:** Die geöffnete Suchbreite (`SEARCH_OPEN_WIDTH`, ~202px) wird im
  Gap-Budget **auch bei geschlossener Suche** eingerechnet, damit das Aufklappen nie
  überläuft. `fitToolbar()` **nicht** beim Toggle aufrufen (läuft mitten in der Transition).
- **Mobile-Takeover:** Unter einer Mobile-Breite (`MOBILE_SEARCH_MAX`, ~640px) übernimmt die
  offene Suche die ganze Toolbar-Zeile: Lupe links, Feld voll breit, X rechts (schließt +
  reset), Heading und Count ausgeblendet (`is-searchtakeover`). Solange aktiv, pausiert
  `fitToolbar`; beim Verlassen einmal neu messen.
- **Aktiv (offen):** Eingabetext und Placeholder werden einen Tick größer
  (`.up-search.is-open .up-search-input { font-size: var(--up-fs-l); font-weight: var(--up-fw-n); }`, 14/400).
- **Voller URL-Titel per Hover:** Truncated Titel in Tabellenzeilen zeigen nach ~400ms
  Hover den vollen Text (nur wenn wirklich abgeschnitten, `scrollWidth > clientWidth`). Der
  Hover-Bereich ist die **ganze `…-url-wrap`-Zone** (Titel- + URL-Zeile) mit
  relatedTarget-Guard, damit der Wechsel zwischen den Zeilen oder über Highlight-Marks den
  Timer nicht abbricht. Tooltip-Variante `.<pfx>-tip.is-wide` bricht um (max ~340px). Das
  native `title`-Attribut an Titel/URL entfernen, damit kein doppeltes Tooltip erscheint.
- **Touch (`@media (hover: none)`):** Suchfeld auf `font-size: 16px` (verhindert iOS-Zoom
  beim Fokus) und **Hover-Tooltips ausblenden** (`.<pfx>-tip { display:none !important; }`).
  Die 16px-Regel muss die 14px-Aktiv-Regel überstimmen (gleiche Spezifität → im `@media`
  denselben Selektor `.<pfx>-search.is-open .<pfx>-search-input` nutzen, damit sie später
  greift).

## 17. Brand-Logo-Stack in Zeilen: eine Geist-Avatar-Group (seit 15.10.)

`.up-stack` (Brand Mentions, Citations in Responses, Karten) ist eine Geist-AvatarGroup aus
Geist-Avataren (vercel.com/geist/avatar):

```
Chip          .up-stack-item 32×32 (--up-stack-gr = --up-h-btn, seit 15.10. nachts; vorher 28);
              sichtbare Ebene .up-stack-vis ist ein KREIS wie Geists Avatar (rounded-full, innen
              1px-Ring): Radius --up-r-voll, 1px --vc-border (im Dark ebenfalls, als Ring), 4px
              Polster, Platte --vt-logo-bg (im Dark nur unter dem Logo). Das Logo ein 22er Quadrat
              mit Radius 4 (--up-r-xs), ganz im Kreis (Ecke 13.9 vom Mittelpunkt, Kreis innen 15;
              im Dark mit 1px Plattenrand 14.9), nichts abgeschnitten. Buchstabe 11 (--up-fs-xs).
              Bis 15.10. spät: abgerundetes Quadrat Radius 6 mit 22er Bild ("ein Logo ist kein
              Porträt") -- vom Nutzer verworfen: "das solltest du vom Geist-System-Avatar nutzen".
Überlappung   --up-stack-ueber 5px, Schritt 27 (vorher 4 und 24 bei 28). Vom Nachfolger verdeckt:
              Überlappung + Ring = 8 von 32 (25 %; vorher 5 von 28 = 18 %). Geists 0.3 × Größe
              (8 bei 28, verdeckt 9 = 32 %) war dem Nutzer zu eng ("etwas zu nah beieinander").
              5 + 3 = 8 = das Spreizen beim Hover: der angefasste Chip reicht mit seinem Ring genau
              an die Nachbarn heran, ohne in sie zu schneiden.
Ring          --up-stack-ring-w 3px in der Zeilenfarbe -- der sichtbare ABSTAND zwischen zwei
              Chips (folgt Zeilen- und Karten-Hover). Bis 15.10. 4px, am 15.10. kurz 1px
              (Haarstrich, vom Nutzer zurückgeholt: "wieder ein sichtbares Gap ... wie es vorher
              ja auch gab")
Dicht         Faktor 0.88 über die drei Marken an .up-root.is-dense: 28.16, Überlappung 4.4,
              Ring 2.64; Polster 3.52, Logo 19.12, "+N" 11
Reihenfolge   das ERSTE Mitglied liegt oben (--up-stack-z absteigend, von brandStack gesetzt);
              isolation: isolate hält die Stufen im Stapel, unter dem klebenden Tabellenkopf
"+N"          .up-stack-more: ein Kreis in Chipgröße (min. 32, Polster 0 5px), unterlappt wie
              ein Mitglied und liegt zuunterst; Grund --up-sel-bg, 1px --vc-border, 12/600 in
              --vc-muted; bis 15.10. reiner Text 12/500
Eigene Maße   Response Detail (.urd-cc-foot, .urd-cr-ments): Reihe statt Stapel, 26er Chip mit
              Polster 3 und "+N" 11 fest in response-detail.css; Leiste (.usn-chips, ungenutzt): 22
```

**Hover-Verhalten unverändert** (gemessen):

- **Gehovertes Element + alles danach rücken nach rechts**, alles davor bleibt stehen
  (das erste Logo darf nie nach links wandern). Gehovertes `translateX(8px)`, folgende
  `translateX(16px)` → nur die zwei Nachbar-Lücken öffnen, der Rest behält seinen Abstand.
  Gespiegelt bei `.is-spread-left` (Stapel an der rechten Kante).
- **Lift:** gehovertes zusätzlich `translateY(-3px)` und nach vorn (`z-index: 20`, über jeder
  Stufe des Stapels).
- **Kein Flicker:** der Treffer liegt auf `.up-stack-item`, das sich nie bewegt; nur die innere
  `.up-stack-vis` animiert. Der Tooltip (`data-brandtip`) hängt am unbeweglichen Kasten.
- `transition: transform .16s ease` auch am „+N“ und am Anhang (`.up-stack-tail`), damit sie mitziehen.

## 18. Density / „Table Settings"

Der Zahnrad-Button heißt „Table Settings" und enthält (unter den Spalten, per Divider
getrennt) einen **Row-Height-Switcher** (Segmented-Control wie in Abschnitt 5):

- **Comfortable** (Default): normale Zeilenhöhe, zweizeilige erste Spalte (Titel + Sub).
- **Compact:** kürzere Zeile (~55px), nur die Titelzeile (`… .<pfx>-url-sub { display:none }`),
  Brand-Logos ~12% kleiner (alle Gaps/Shifts im gleichen Verhältnis mitskaliert), Skeleton
  ebenfalls.
- **Mode-Wechsel animiert mit 200ms ease** (Zeilenhöhe + Logo-Größen).
- **Persistenz in localStorage** (`<pfx>_dense__<instance>`), wie Spalten und Breiten.

## 19. Notification-Badge (aktive Anzahl)

Kleine Zahl oben rechts an einem Toolbar-Button (z.B. Anzahl aktiver Spalten am Zahnrad),
Styling identisch zur Combo-Chart-Badge über dem Fader:

```css
.<pfx>-cols-badge { position:absolute; top:-3px; right:-3px; z-index:2;
  min-width:16px; height:16px; padding:0 4px; border-radius:999px;
  background: var(--vc-text); color: var(--vc-text-invert);   /* core .up-badge, beide Themen */
  font-size:10px; font-weight:600; line-height:1; font-variant-numeric: tabular-nums;
  display:none; align-items:center; justify-content:center; pointer-events:none; }
.<pfx>-cols-badge.is-visible { display:inline-flex; }
```
Regel: **sichtbar nur, wenn manche (nicht alle) aktiv sind** (`0 < aktiv < gesamt`), Text =
aktive Anzahl. Basiert auf der **User-Auswahl** (`state.cols`), nicht auf responsivem
Ausblenden. Update in allen Pfaden aufrufen (Toggle, Select-all, Reset, Render).

**JS-Nutzungsmuster:**
```js
var _sticky = UpstreemCore.makeSticky(root, elHead);   /* elHead = .up-head Element */
function applySticky(){ _sticky.applySticky(); }
function syncTheadOffset(){ _sticky.syncTheadOffset(); }
window.addEventListener("resize", applySticky);
applySticky();   /* einmal sofort */
/* syncTheadOffset() nach jeder Kopfhöhen-Änderung aufrufen */
```

## 20. Sticky-Header — Ergänzungen

- **Seiten-Hintergrund als eigene Variable:** `--up-surface` (Light `#ffffff`, im grauen Light
  `#fafafa`, Dark `#000000`) für Kopf-Hintergrund + Maske. Nicht `--vc-bg` (das ist die
  Kartenfarbe, `#0a0a0a` im Dark): sonst ist der Bereich über/hinter der Tabelle sichtbar zu
  hell. In einer Inhaltsfläche (Drawer, Band, flache Tabelle) ist `--up-surface` die Farbe dieser
  Fläche, in beiden Themen (Abschnitt 1).
- **Maske +16px:** Die opake Maske über dem Header (`…-head::before`) bekommt
  `height: calc(var(--up-sticky-top) + 16px)`, damit beim Scrollen oben keine
  Zeilenkante durchlugt.
- **Ecken oben:** Die Radial-Eckstücke, die das Dreieck außerhalb der Rundung füllen,
  nutzen `var(--up-surface)` (Seitenfarbe), **nicht** `--vc-bg`: sonst guckt im Dark ein
  helleres Dreieck raus. Größe = Radius des Kopfes, aus `--up-r-2xl` (heute 12, siehe §10).

## 21. Dark-Mode — zwei Fallen, die Zeit kosten

1. **Jede Farbe braucht eine Dark-Variante.** Eine im Dark referenzierte, aber nicht
   definierte Variable (`OTHER_DARK`) wirft `ReferenceError` und **crasht das Rendern** →
   die Komponente hängt im Skeleton, ohne offensichtlichen Grund. Beim Anlegen einer
   Fallback-/Sonderfarbe immer beide Modi definieren.
2. **Spezifität:** Dark-Basisregeln (`.<pfx>-root[data-theme="dark"] .x`, 0-3-0) sind
   **spezifischer** als State-Regeln (`.x:hover` / `.x.is-on`, 0-2-0) und überschreiben sie
   im Dark. Für Hover-/Aktiv-Farben im Dark braucht es eine eigene, spezifischere Regel:
   `.<pfx>-root[data-theme="dark"] .x:hover { … }` (0-3-1) bzw.
   `.<pfx>-root[data-theme="dark"] .x.is-on { … }` (0-4-0).

## 22. Persistenz

- **Display-Präferenzen → localStorage**, pro Instanz gekeyt: Spalten (`<pfx>_cols__<id>`),
  Breiten (`<pfx>_widths__<id>`), Row-Height (`<pfx>_dense__<id>`). Überleben Reload.
- **Rest (Query, Sort, Filter, Page, Auswahl) → In-Memory-STORE** (`window.__<pfx>Store`),
  überlebt innerhalb der Session, nicht über Reload. Bewusst so: fachliche Auswahl soll bei
  Reload nicht „kleben", Anzeige-Vorlieben schon.

> ⚠️ **STORE-Falle:** `UpstreemCore.STORE` zeigt auf `window.__uutStore` — URLs-Table-spezifisch!
> Neue Komponenten **dürfen `UpstreemCore.STORE` nicht verwenden**, sonst teilen sie sich den State
> mit der URLs-Tabelle. Immer einen eigenen Store anlegen:
> ```js
> var STORE = (window.__udtStore = window.__udtStore || {});
> var LOADING_EXPLICIT = (window.__udtLoadingExplicit = window.__udtLoadingExplicit || {});
> ```

## 23. Numerik & Ausrichtung

- **Zahlen:** `font-variant-numeric: tabular-nums` (Beträge, %, Trend), damit Werte sauber
  untereinander vergleichbar sind.
- **Ausrichtung:** Text und alle Spaltenköpfe linksbündig, nie zentriert (Ausnahme: die
  Indexspalte „#“). **Zahlen stehen seit dem 15.10. rechtsbündig an der Zellkante, der Trend an
  der linken Kante** (Abschnitt 8c, feste Spur `--up-spur-*`, Abstand `--up-spur-abstand` 12).
  Datumsspalten bleiben links. Bis 15.10. standen Zahl und Trend links nebeneinander.
- **`aria-sort`** am aktiven Spaltenkopf setzen (`ascending`/`descending`/`none`).

## 23b. Abstände an Separatoren

**Regel: ober- und unterhalb einer Trennlinie steht immer derselbe Abstand — und in einer
Fläche ist es überall derselbe Wert.** Ein Separator trennt zwei Blöcke; sitzt er näher am
einen als am anderen, liest er sich als Teil dieses Blocks statt als Trennung.

Praktisch heißt das: **ein Token pro Fläche**, nicht pro Regel eine Zahl.

```css
.upt-bulkbar { --upt-sep-gap: 12px; }

.upt-bulkpanel     { margin-top: var(--upt-sep-gap); padding-top: var(--upt-sep-gap); }  /* border-top */
.upt-topicpickpanel{ margin-top: var(--upt-sep-gap); padding-top: var(--upt-sep-gap); }  /* border-top */
.upt-topichead     { padding-bottom: var(--upt-sep-gap); }   /* keine Linie, gleicher Rhythmus */
.upt-topicfoot     { margin-top: var(--upt-sep-gap); }
```

Warum als Regel und nicht als Einzelfall: im Topic-Editor standen Panel (12px), Head (10px) und
Foot (10px) lange nebeneinander, ohne dass es auffiel — **sichtbar wurde es erst, als ein
zusätzliches Panel aufklappte** und drei dieser Abstände übereinander lagen. Ungleiche
Separator-Abstände fallen einzeln fast nie auf und in der Summe sofort; deshalb gehören sie an
ein Token, nicht in die jeweilige Regel.

Auch Blöcke **ohne** Linie (Head, Foot) nehmen denselben Wert — sonst rutscht der Rhythmus der
Fläche auseinander, sobald ein Abschnitt ein- oder ausgeblendet wird.

## 24. Loading — explicitOverride

`setLoading(on)` muss **immer** greifen (auch wenn ein `data-processing`-Attribut existiert)
und **ankommende Zeilen löschen das Skeleton**. Mechanik: `setLoading` setzt
`explicitOverride = true`; im Update gilt: bei `explicitOverride` löschen nur ein explizites
„no" **oder** ankommende Zeilen das Loading; sonst treibt das Attribut. Ein neuer
Attributwert nimmt die Kontrolle zurück (`explicitOverride = false`). (Die frühere
attribut-zuerst-Logik ignorierte `setLoading("no")` und ließ Zeilen im Skeleton hängen.)

Pagination/Sort: `latestReqId = null` **vor** dem Feuern setzen, damit der requestId-Guard
die Antwort nicht verwirft (sonst „jeder zweite Sort kommt an").

## 25. Neue Komponente bauen — gegen die Kits, nicht daneben

**Die wichtigste Regel: nichts nachbauen, was `core.js` schon kann.** Wenn du in einer bestehenden
Komponente Code siehst, den du kopieren willst, prüfe zuerst, ob er inzwischen im Core liegt — die
vier Altkomponenten sind vollständig darauf umgestellt, aber alte Codebeispiele in älteren
Abschnitten dieses Dokuments können noch den Vorher-Zustand zeigen.

**Das gilt für CSS genauso, und dort fällt es später auf.** Eine Tabelle benutzt `.up-table` /
`.up-thead` / `.up-tbody` / `.up-row` / `.up-th` / `.up-td` und `--up-cols` — es gibt keinen Grund,
je eigene `<pfx>-th` / `<pfx>-td` zu schreiben. brands-overview hatte genau das: eine
byte-ähnliche, aber eben nicht identische Kopie dieser Regeln, in der der `border-left` pro Zelle
fehlte. Das ist die vertikale Gridline. Ergebnis war eine Tabelle, die als einzige in der ganzen
App keine Spaltentrenner hatte — und niemandem fällt beim Schreiben einer Kopie auf, welche
einzelne Deklaration er vergessen hat. Komponenten-eigene Klassen sind nur für das da, was diese
Komponente wirklich zusätzlich hat (eine Zeilenhöhe, eine Index-Zelle, ein Actions-Button).

### Was der Core stellt

| Bereich | Aufruf |
|---|---|
| Linien-Chart (Plugins, Tooltip, Skeleton, Größen-Poll, Verify, Legende, Watermark) | `UC.makeLine({wrap, canvas, legend, isDark, isOwner, gran})` |
| Doughnut + Bars hinter einem Controller | `UC.makeTypeChart({body, isDark, isOwner, mode, total, centerLabel})` |
| Chart-Daten aufbereiten / Farben | `UC.prepTypeData`, `UC.typeColor`, `UC.CITE_COLOR_DARK`, `UC.barIsLight` |
| Typ-Chips (Citation und URL, Schrift/Grund/Rand/Punkt) | `UC.typeStyle(art, roh, isDark)`, Werte in `UC.CITE_TYPE`/`UC.URL_TYPE`/`UC.URL_FAMILY`/`UC.TYPE_OTHER` (1a/1b) |
| Button-Tooltips (`[data-tip]`, `[data-brandtip]`) | `UC.makeTooltips(root, getIsDark)` |
| Dropdowns | `UC.makePopover({wrap, menu, opener, onClose, group})` |
| Spalten: Sichtbarkeit, Breiten, Resize, Cols-Menü | `UC.makeColumns({root, state, columns, storePrefix, instanceId, …})` |
| Pagination | `UC.makePager({root, state, onChange})` |
| Header-Sortierung mit Klick-Zyklus | `UC.makeHeadSort({root, state, cycles, defaultSort, trendField, onSort})` |
| Suche (Slide-out, Debounce, requestId-Schutz) | `UC.makeSearch({root, box, input, state, prefix, onRender, onFire, …})` |
| Skelett-Zeilen, Trend-Chip, Leer-Schonfrist, Spalten-Erklärer | `UC.skeletonRows`, `UC.trendChip`, `UC.makeEmptyGrace`, `UC.makeExplain` |
| Leerzustand nach Geist (9a) | `UC.leerHtml({ gefiltert, was, icon, titel, text, knopf, mini })` |
| Leerzustand im Chart / in der Tabelle daneben (9a) | `UC.chartLeerHtml({ titel, text, icon, gefiltert, fluss })`, `UC.tabelleLeerHtml({ …, zeilen })` |
| Sentiment (Balken + Zahl) | `UC.sentHtml(v)`, Farbe `UC.sentColor(v)` |
| Themenschalter (5) | `UC.themeSchalterHtml({ klein, wahl })` |
| Kopfzeichen im Spaltenkopf (8a) | `UC.kopfZeichenHtml(name)`, `UC.kopfZeichen(th, name)` |
| Filter der einen Leiste (8b) | `UC.makeLeistenFilter(root, { instanceId, arten })` |
| Feste Höhe der flachen Tabelle (8a) | `UC.makeFestHoehe(root, { min, kopf, fuss })` |
| Leiste über dem Band (8b) | `UC.bandUnterLeiste(root, band, { kopf })` |
| Klebender Fuß (8e) | `data-kleb-fuss="yes"` an der Wurzel (mit `UC.makeSticky`), direkt `UC.klebFuss(root)` |
| Gesamtzeile (8e) | `UC.makeZaehlZeile({ root, nach, praefix, instanceId, spalten, laedt, anzahl, rechnen, quelle, cols })`, darunter `UC.makeSumZeile`, `UC.sumPaarHtml` |
| Offenes Band (8f) | `UC.bandTeile(band, teile)` (mit `teile.auge`), `UC.bandAus(band, aus, { id, setzen })` setzt den Umschalter im Seitenkopf, `UC.bandSchalterHtml({ aus, id, klein })`, `UC.bandAusGemerkt(id)`, `UC.bandAusMerken(id, aus)` |
| Bubble-Klempnerei: Root-Registry, iframe-Forwarder, Wheel, Init-Kaskade, Stub-Replay | `UC.makeMount({rootClass, ctrlProp, resolveLocal, queue, initRoot, api, forwardShape})` |

CSS dazu kommt aus `core.css`: `.up-root`, `.up-head*`, `.up-iconbtn`, `.up-thead/.up-row/.up-th/.up-td`,
`.up-pop-*`, `.up-filter-*`, `.up-line-*`, `.up-legend`, `.up-donut-*`, `.up-bars/.up-bar-*`,
`.up-trend`, `.up-logo-box`, `.up-row-goto`, `.up-tag`, `.up-tip`, `.up-explain`, `.up-empty*`,
`.up-leer`, `.up-skelett`, `.up-search`, `.up-ddtrigger`, `.up-btn-sec`, `.up-seg`/`.up-themesw`,
`.up-stack*`, `.up-th-ic`, `.up-sumrow`/`.up-sum*`, `.up-band*`, `.up-leiste-fluss`, `.up-ff*`
und die Attribute `data-flach="yes"` und `data-leiste="yes"`.

### Was zwingend lokal bleibt

- **Daten-Mapping** — Bubble-Payload → Datasets bzw. Zeilen. Jede Komponente bekommt eine andere
  Form; das ist kein Duplikat.
- **Event-Vertrag** — `data-*-fn`-Attribute, Event-Namen, Payload-Keys (Abschnitt 13).
- **Markup und Rahmen** — Layout, Header, komponenteneigene Schalter.
- **`doRender` / `doLoading` / `initRoot`** — bewusst pro Komponente: die meisten broadcasten an
  jeden Root mit derselben `instanceId`, topcitations löst gezielt den sichtbaren auf.
- **Spaltendefinition** (`COLUMNS` mit `min` und `dropAt`) und Toolbar-Stufen (`fitToolbar`).

### Schritte

1. **Präfix** wählen. Root: `<div class="up-root <pfx>-root" data-instance="…" data-cdn-pin="CDN_PIN">`.
   Das `up-root` ist Pflicht — daran hängen alle geteilten CSS-Variablen.
2. **Stub-Block** ganz oben, vor dem core.js-Warten (siehe jede bestehende Komponente): Bubble
   pollt die `render*`-Funktionen und würde die frühesten Aufrufe sonst verlieren.
3. **Boot-Retry** `<pfx>Boot(50)` → `<pfx>Run()`, weil Bubble Scripts nicht in DOM-Reihenfolge
   ausführt.
4. **Kits verdrahten** statt nachbauen (Tabelle oben).
5. **`UC.makeMount`** am Ende von `<pfx>Run()` — ersetzt Forwarder, Wheel-Fix, Init-Kaskade und
   Stub-Replay.
6. **Loading**: `data-processing` und `data-processing2` verodern, plus `LOADING_EXPLICIT`-Gate
   (ein expliziter `set*Loading`-Aufruf hat ab dann Vorrang vor den Attributen).
7. **`reset*()`** leert Filter **und** Daten und feuert **null** Bubble-Events.
8. **Bubble-Referenzdatei** unter `bubble/` mit dem `getElementsByClassName`-Loader (Abschnitt 26),
   niemals `document.currentScript`.

### Verifizieren

- **CSS-Klassen-Sweep**: jede im JS ausgegebene Klasse muss eine Regel haben. Das ist genau der
  Fehler, der schon zweimal passiert ist (Regel gelöscht, JS gab den Namen weiter aus):
  `class="…"` aus dem JS ziehen und gegen `core.css` + die eigene CSS prüfen. Reine JS-Hooks
  (`.up-td-<key>`, `.up-act-*`, `.up-page-prev/next`) haben bewusst kein CSS.
- **Definitions-Diff** nach jedem größeren Umbau: welche Funktion war vorher definiert, wird noch
  aufgerufen, ist aber weg? Fängt genau die Fehler, die erst zur Laufzeit auffallen.
- **Multi-Instanz**: zwei Roots derselben Komponente auf einer Seite — Tooltips, Dropdowns,
  SVG-Mask-IDs und Chart-Instanzen dürfen sich nicht gegenseitig stören.
- **Größen-Poll**: Daten liefern, während der Root in `display:none` steckt, dann einblenden —
  der Chart muss trotzdem bauen.
- **Persistenz**: localStorage-Keyformat nicht ändern, sonst verlieren alle Nutzer ihre
  gespeicherten Spalten und Breiten. Format ist `<pfx>_cols__<instanceId>` / `<pfx>_widths__<id>`.
- **`reset*()`**: Events-Spy, **0** Events.
- Konsole fehlerfrei, in Light **und** Dark.

## 26. CDN-Auslieferung & dynamischer Pin (`data-cdn-pin`) — Bubble-Falle

Jedes Bubble-Element lädt seine Dateien per kleinem Loader-Script (unten im Element) von jsDelivr.
Der Commit, von dem geladen wird, steht im Attribut **`data-cdn-pin`** am Root-Div (direkt unter
`data-instance`). Gesetzt → `@<pin>`, leer/`CDN_PIN`-Platzhalter → `@main`. So kann man in Bubble
den Pin einmal zentral (Konstante/Option-Set → als Text!) auf einen neuen Commit setzen, statt in
jedem Embed die URL von Hand zu tauschen.

**DIE FALLE (hat eine ganze Runde gekostet):** `document.currentScript` ist in Bubble **null bzw.
falsch zugeordnet**. Bubble injiziert den HTML-Element-Inhalt via jQuery `.html()` und erzeugt die
`<script>`-Tags neu, um sie auszuführen — dabei zeigt `document.currentScript` nicht mehr auf das
Markup. Ein Loader, der den Pin über `document.currentScript.previousElementSibling` liest, liest
also **nichts** und fällt für **jede** Datei auf `@main` zurück. Und `@main` wird von jsDelivr
**Stunden** lang gecacht → man bekommt alten Code, egal was im Pin steht. Symptom: `data-cdn-pin`
zu setzen „tut nichts", die Konsole zeigt alle Script-URLs auf `@main`.

**Richtig — Pin über die Klasse suchen, NICHT über `currentScript`:**
```js
(function(){
  function readPin(cls){
    var els = document.getElementsByClassName(cls), i, p;
    for (i = 0; i < els.length; i++){
      p = (els[i].getAttribute("data-cdn-pin") || "").trim();
      if (p && p !== "CDN_PIN") return p;
    }
    return "main";
  }
  var base = "https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@" + readPin("<pfx>-root") + "/";
  function css(f){ var l=document.createElement("link"); l.rel="stylesheet"; l.href=base+f; document.head.appendChild(l); }
  function js(f){ var s=document.createElement("script"); s.src=base+f; s.async=false; document.head.appendChild(s); }
  css("core.css"); css("<component>.css");
  js("core.js"); js("<component>.js");
})();
```

Weitere Regeln:
- **Immer auf einen Commit-Hash pinnen, nie dauerhaft auf `@main`.** Commit-URLs (`@<hash>`) sind
  unveränderlich und werden korrekt gecacht — keine Propagierungs-Verzögerung, kein stale. `@main`
  hat jsDelivr-Cache-Lag von Stunden.
- **In Bubble den Pin als reinen Text** in `data-cdn-pin` eintragen (oder via Konstante, die einen
  Text liefert) — keine zirkuläre Option-Set-Referenz (die wirft `cdn_pin contains circular
  reference` und liefert leer → `@main`).
- Jede Komponente lädt ihr eigenes `core.js` vom selben Pin. Mehrfaches Laden derselben
  (unveränderlichen) URL ist billig (Browser-Cache) und die Init jeder Komponente ist idempotent —
  **kein** „load-once"-Sharing über `window` nötig (das hat früher bei EINEM kaputten Pin den
  ganzen Seiten-Core vergiftet).

## 27. Popup/Modal — verbindliches Template

Referenzimplementierung: `.up-topicmodal-backdrop`/`.up-topicmodal-card` in `core.css`, gebaut über
`UC.makeTopicModal(cfg)`. War ursprünglich `.utm-*` lokal in topics-manager.css — mit
prompts-table's "Add Topic"-Button als zweitem Verbraucher (identisches Modal, eigener
Event-Vertrag über `cfg.onSave`/`cfg.onDelete`) nach core extrahiert, siehe dortigen Kommentar für
die Callback-Architektur. Jedes künftige Popup/Modal übernimmt die Werte unten 1:1, statt eigene
zu erfinden — bei einem echten NEUEN Modal-Typ (nicht Topic-Create/Edit) dupliziere die Werte
zunächst lokal, extrahiere erst nach einem zweiten Verbraucher (STYLEGUIDE §25).

**Backdrop** (fixed, `inset:0`, abgedunkelter Scrim hinter einer schwebenden Karte):
```css
background: rgba(0,0,0,.30);                                            /* Light Mode */
backdrop-filter: blur(1.5px); -webkit-backdrop-filter: blur(1.5px);
```
```css
[data-theme="dark"] { background: rgba(0,0,0,.35); }                    /* Dark Mode */
```
Dieselbe 30%-Abdunkelung liest im Dark Mode heller/ausgewaschener als im Light Mode — daher der
eigene, etwas dunklere Wert. Der Blur bleibt in beiden Themes bei `1.5px`: subtil genug, um den
Hintergrund als "außer Fokus" zu lesen, ohne selbst sichtbar zu wirken oder auf schwächerer
Hardware zu ruckeln.

**Karte** — EIN Flex-Column-Container, EIN Padding-Wert, EIN Gap-Wert zwischen allen
Top-Level-Blöcken (Header, jedes Feld, Footer):
```css
padding: 16px;
display: flex; flex-direction: column; gap: 32px;
max-width: 420px;
border: 1px solid var(--vc-border);
border-radius: var(--up-r-2xl);   /* 12, Geist Dialog; bis 15.10. 16, davor 18 */
box-shadow: var(--up-e-4);        /* liegt über einem Schleier */
```
Hintergrund `--up-surface`: hell `#ffffff`, Dark Mode `#0a0a0a` (Geist Background 1, bis 15.10.
`#1c1c1f`). Die Karte setzt ihre Palette selbst, weil sie am `<body>` hängt -- und zwar
vollständig: ihre helle Grundregel setzt die Marken selbst, eine geerbte dunkle verlöre dagegen.

**Kopfzeile** (`.up-topicmodal-head`, `align-items:flex-start` wegen des zweizeiligen Headings):
- Heading: **22px, Weight 500**.
- Optionale Subheading direkt darunter (eigener `.up-topicmodal-heading`-Wrapper mit **8px Gap**
  zwischen Heading und Subheading): **16px, Weight 400, Drittfarbe** (`--vc-third`). Nicht jedes
  Popup braucht eine — das Token existiert, damit ein künftiges nicht wieder Größe/Farbe/Gewicht
  neu erfindet.
- Close-Button: **`.up-popup-close` aus core.css nehmen**, nicht selbst bauen. 32×32px Container,
  16×16px Icon, `margin: -8px -8px 0 0` — zieht den Button trotz der 16px Karten-Padding näher an
  die wirkliche Ecke, statt sichtbar "freizuschweben".
  Entscheidend ist, was NICHT drinsteht: **kein Rahmen, auch nicht im Hover.** Der Hover ist
  ausschließlich Fläche (`--vc-heading-bg`) plus Primärfarbe, wie bei `.up-iconbtn`. Ein Rahmen,
  der erst beim Überfahren erscheint, lässt den Knopf springen und kommt sonst nirgends in der App
  vor. `.up-topicmodal-close` ist derselbe Knopf unter dem alten Namen und bleibt gültig.

**Feld-Headings** (z. B. "Name", "Appearance" innerhalb der Karte): **14px, Weight 500,
Primärfarbe** (`--vc-text`, NICHT Mutedfarbe — der User liest diese Labels bei jedem Öffnen).
**8px Gap** zwischen Feld-Heading und dem Feldinhalt darunter.

**Alle Elemente untereinander** (Header-Block, jedes Feld, Footer): **32px Gap** — getragen vom
Card-Flex-Container selbst, nicht von individuellem Padding pro Block.

---

*Stand: Werte 1:1 aus dem aktuellen Code der vier Dateien extrahiert (nicht aus Erinnerung). Bei Widersprüchen zwischen den Dateien wurde die neueste/zuletzt gefixte Version als Standard genommen.*

### Interaktive Chips (`.up-chiphover`)

Jeder farbige Chip/Tag, der **klickbar** ist, bekommt zusaetzlich `.up-chiphover`. Im Ruhezustand
behaelt der Chip seine eigene Tint-Farbe; beim Hover faellt er auf die neutrale Flaeche zurueck,
damit "das ist ein Control" ueberall gleich liest, unabhaengig davon, welche Farbe das Tag
zufaellig traegt.

```css
.up-chiphover { transition: background 120ms ease, border-color 120ms ease, color 120ms ease; }
.up-chiphover:hover { background: var(--vt-row-hover-solid); color: var(--up-accent-ink); box-shadow: none; }
```
`--vt-row-hover-solid` ist hell `#f9f8f9`, dunkel `#1a1a1a` (Geist Gray 100); eine eigene Dunkel-Regel gibt es
nicht mehr. Chips koennen auch ausserhalb des Komponenten-Roots leben (z.B. in der
Bulk-Action-Bar am `document.body`); diese Leiste fuehrt die Marken deshalb selbst mit.

Genutzt von: prompts-table (Topics-Zelle, Topics-Editor in der Bulk-Bar).

## 28. Der `*/`-in-CSS-Kommentar-Bug — PFLICHTCHECK vor jedem CSS-Commit

**Das ist jetzt zweimal live passiert und hat beide Male eine ganze Komponente unbenutzbar gemacht
(Dropdown-Clipping in topics-manager, dann das Topic-Modal komplett kaputt — öffnete unstyled am
Seitenende statt als zentriertes Overlay, kein Backdrop, Seite sprang). Beide Male war die Ursache
identisch und beide Male hat es Stunden gekostet, weil der Fehler NICHT da ist, wo man ihn vermutet.**

**Der Mechanismus:** `/* ... */` ist der einzige Kommentar-Syntax in CSS. Der Parser sucht stur
nach der ERSTEN Zeichenfolge `*/` nach einem `/*` — ihm ist völlig egal, ob die Absicht dahinter
"das ist ein Kommentar-Ende" war oder ob da zufällig ein `*` gefolgt von `/` in normalem Fließtext
steht (Klassenlisten mit `*` als Platzhalter, Pfade, CSS-Custom-Property-Namen mit Sternchen-Suffix
etc.). Sobald das passiert, schließt der Kommentar Zeilen zu früh — der Rest des ursprünglichen
Kommentartexts wird plötzlich als ECHTES CSS interpretiert, ergibt keinen Sinn, und der Parser
verwirft alles bis zum nächsten Punkt, an dem er sich wieder "einfängt". Das kann eine einzelne
Regel verschlucken (wie beim Topic-Modal: nur `.up-topicmodal-backdrop` fehlte, alle Folgeregeln
mit demselben Klassennamen-Präfix parsten trotzdem normal weiter — sieht beim flüchtigen Draufblick
aus wie "muss doch da sein"). Kein Build-Fehler, keine Warnung, keine Konsolen-Ausgabe — die Seite
lädt einfach mit einer leise fehlenden Regel.

**Beide bisherigen Fälle, wörtlich:**
```
.up-root/.up-head/.up-export/.up-search*/.up-sort*/.up-pop-*/.up-chiphover
                              ^^^^^^^^^^^ "search*" + "/" = "*/" → Kommentar schließt hier
```
```
it redeclares its own --vc-*/--up-surface tokens locally
                      ^^^^^^^^^^^^^^^^^^^ "--vc-*" + "/--up-surface" = "*/" → Kommentar schließt hier
```

**Die Regel, ab sofort ohne Ausnahme:** Schreib niemals `*` unmittelbar gefolgt von `/` innerhalb
eines CSS-Kommentars — auch nicht über eine Zeilenumbruch-Grenze hinweg, auch nicht wenn die
Absicht "Wildcard" oder "oder" war. Bei Klassenlisten: Kommas oder Zeilenumbrüche statt `/` als
Trenner (`.up-search, .up-sort, .up-pop-` statt `.up-search*/.up-sort*/.up-pop-*`). Bei
CSS-Custom-Property-Namen mit gemeinsamem Präfix: ausschreiben statt abkürzen (`--vc- und
--up-surface` statt `--vc-*/--up-surface`).

**Vor jedem Commit, der eine `.css`-Datei ändert (kein Ausnahme-Fall — auch bei "nur ein
Kommentar geändert"):**
```bash
grep -n '[a-zA-Z0-9_-]\*/[a-zA-Z._-]' *.css
```
Ein Treffer heißt: irgendwo schließt ein Kommentar zu früh. Nicht ignorieren, nicht "sieht schon
richtig aus" — im Browser via `document.styleSheets` nachsehen, ob die erwartete Regel wirklich in
`cssRules` auftaucht (siehe Debug-Technik unten), dann erst committen.

**Debug-Technik, falls der Grep-Check zu spät kommt und etwas schon kaputt gerendert wird:**
```js
var sheet = [...document.styleSheets].find(s => s.href && s.href.includes('core.css'));
[...sheet.cssRules].filter(r => r.selectorText && r.selectorText.includes('DEIN-SELECTOR'));
```
Kommt nichts zurück, obwohl die Regel im Quelltext eindeutig dasteht: exakt dieser Bug. Nicht an
Spezifität, Ladereihenfolge oder Browser-Bugs denken — zuerst hier suchen.

## 29. Sub-Tabellen (Drilldown) — Core-Klassen weiterverwenden, Core-Verhalten NICHT erben

Ein Drilldown, der aufgeht und Zeilen zeigt, ist eine eigene kleine Tabelle. Damit er sich wie
Teil der App anfühlt und nicht wie ein Popover mit Zeilen drin, bekommt er dieselbe Möblierung wie
jede andere Tabelle: **Topbar (Suche + Filter), Spaltenüberschriften, waagerechte Trennlinien,
Pager.** Präzedenzfall: `domains-table.js` / `.udt-sub-*`.

**Eigenes Grid, nicht das des Elternteils.** Die Sub-Zeile ist ein Geschwister von `.up-row`, nie
selbst eine `.up-row` — sonst landet sie im Show/Hide-Sweep und im `data-up-colsig`-Stempel von
`UC.makeColumns` (§ Spaltenlogik) und wird beim Spaltenausblenden zerlegt. Sie bekommt eine eigene
Custom Property (`--udt-subcols`) statt `var(--up-cols)`: es sind andere Spalten, und die Werte
driften sonst in die Breiten der Elternspalten auseinander.

**Klassen teilen, Handler nicht.** Für Filter-Dropdown und Pager werden die Core-Klassen 1:1
weiterverwendet (`.up-filter-btn`, `.up-filter-menu`, `.up-filter-item`, `.up-filter-reset`,
`.up-pagesize`, `.up-pager`, `.up-page`) — ein Pager, der eine Ebene tiefer anders aussieht, liest
sich als anderes Produkt. Die Kehrseite: **der Klick-Listener der Komponente matcht genau diese
Selektoren bereits.** Ohne Gegenmaßnahme öffnet der Klick auf den Sub-Filter das Haupt-Dropdown
und ein Klick auf einen Sub-Typ schreibt einen Null-Key in `state.filterSel`. Regel:

- Sub-Controls tragen **`data-sub*`-Attribute** und werden **ganz oben** im Klick-Listener
  behandelt, vor jedem Core-Klassen-Match — mit `return`.
- Die Popover-Buchführung darauf (`inMenu` / `onOpener` / `closePops()`) muss über ein
  `closest(".udt-subrows")`-Gate ausgenommen werden.

**Derselbe Konflikt taucht auch OHNE Klick-Handler auf, sobald ein core-Kit selbst per
`root.querySelector(EINE_KLASSE)` (nicht `querySelectorAll`, nicht gescoped) in einen bestimmten
Container schreibt — z.B. `UC.makePager`s `renderPageSize()`, das ungezielt das ERSTE Element mit
`.up-pagesize-seg` im ganzen `root` überschreibt.** Ein Drilldown-Control, das rein optisch dieselbe
Klasse trägt (z.B. ein zweiter Segment-Switcher fürs Anzeigeformat), sitzt in der DOM-Reihenfolge
VOR der echten Fußzeile des Haupttabs und wird beim nächsten `renderPageSize()`-Aufruf klammheimlich
mit den 10/25/50/100-Buttons der äußeren Tabelle überschrieben — sichtbarer Bug erst beim visuellen
Check, nicht beim Lesen des Codes. Regel: Sub-Controls, die optisch ein core-Primitive nachbilden
(Segment-Switcher, Icon-Button, …), bekommen **eigene Klassennamen** und eine **eigene, fast
identische CSS-Regel** — nicht die wörtlich gleiche Klasse. Etwas mehr CSS-Duplikation ist hier der
richtige Preis dafür, dass kein core-Kit sie versehentlich für sein eigenes Element hält.

**Genau EIN Drilldown offen.** Zwei offene Blöcke mit je eigener Suche, eigenem Filter und eigenem
Pager lesen sich als zwei konkurrierende Tabellen in einer dritten. Öffnen schließt und **resettet**
den vorherigen (Suche, Filter, Seite, Seitengröße).

**Auf/Zu animieren: Keyframe, keine Transition.** Der Block wird von `renderTable()` frisch erzeugt;
eine Transition läuft auf einem gerade eingefügten Knoten nie an. `grid-template-rows: 0fr -> 1fr`
über 200 ms, `.is-closing` mit `forwards` für den Weg zurück (JS wartet die 200 ms ab, dann erst
State löschen und rendern). Die Enter-Klasse darf **nur** beim Render direkt nach dem Toggle
gesetzt werden — sonst spielt die Animation bei jedem Tastendruck in der Sub-Suche neu.

**Skeleton = die echte Zeile in grau.** Ein Balken pro Spalte, in dieser Spalte, in deren realer
Breite — plus bereits sichtbare Spaltenköpfe. Ein generischer Streifen lässt das Panel beim
Eintreffen der Daten sichtbar umspringen.

**Nachtrag — echte Server-Pagination statt "einmal laden, lokal filtern":**
`domains-table`s Drilldown wurde von "die ganze Liste kommt in einem Call, Suche/Filter/Paging
laufen lokal darüber" auf "jede Zustandsänderung feuert ein neues Request" umgestellt, weil der
darunterliegende RPC jetzt selbst paginiert (jede Zeile trägt `total_count`). Zwei Regeln, die
dabei wichtig wurden:

- **Toolbar bleibt IMMER live, nur die Zeilenliste geht in den Skeleton-Zustand.** Öffnen, Suchen,
  Filtern, Blättern — jedes davon setzt einen `loading`-Flag und rendert neu, aber Such-Input,
  Typ-Filter-Button und der Schließen-Button dürfen dabei nicht aus dem DOM verschwinden, sonst
  verliert das Suchfeld beim Tippen den Fokus, sobald die Debounce-Zeit abläuft. Toolbar und
  Zeilenliste sind deshalb zwei getrennte Render-Zweige in derselben Funktion, nicht ein
  gemeinsamer "alles oder Skeleton"-Schalter.
- **Eine optionale request_id gegen Race Conditions.** Ein Request feuert eine hochzählende ID
  mit; die Antwort-Funktion vergleicht sie (falls mitgegeben) gegen die zuletzt gefeuerte ID und
  verwirft eine zu spät ankommende, veraltete Antwort still, statt kurz falsche Zeilen zu zeigen.
  Optional halten (nicht erzwingen): eine bestehende Bubble-Seite, die den vierten Parameter nicht
  mitgibt, funktioniert unverändert weiter, nur ohne den Schutz.

**Nachtrag — nur das Panel wird eingefärbt, nie die Eltern-Zeile.** Ein früher Versuch tintete
zusätzlich `.up-row.is-expanded` — zwei Signale für "das ist offen" (Zeile UND Panel) lasen sich
nicht klarer, und beim Schließen sprang die Zeilenfarbe eine Frame NACH dem Zuklapp-Fade sichtbar
zurück auf Weiß, was sich wie ein kurzes Aufblitzen anfühlte. Die Zeile bleibt jetzt in beiden
Themes exakt im Ruhezustand; nur der Drilldown-Container selbst trägt die Tönung.

**Nachtrag — jede Aktion in der ÄUSSEREN Toolbar schließt einen offenen Drilldown.** Suche, Sort,
Filter, Mentioned-Brands, Brand-Toggle, Haupt-Pagination — und auch ein von außen (nicht über die
eigene UI) hereinkommender `render...`-Aufruf mit neuen Zeilen. Ein Drilldown, der über einer
Zeile offen bleibt, die es im neuen Ergebnis vielleicht gar nicht mehr gibt, oder dessen eigener
Suchzustand nie neu geladen wird, ist der komplexere und fehleranfälligere Zustand — ein einziges
`closeDrilldown()`, an jeder dieser Stellen aufgerufen, ist einfacher als jede Aktion einzeln
dazu zu bringen, den Drilldown-Zustand zu berücksichtigen. Kein Fade-out dabei — nur der User-
getriebene Schließen-Klick (über den Toggle oder den Drilldown-eigenen X-Button) bekommt die
200-ms-Animation, ein programmatisches Schließen ist sofort.

**Nachtrag — ein zweiter, spät auftauchender Trigger für dieselbe Aktion.** `domains-table`s
Zeile bekommt nach 1.5s Hover einen zweiten Weg, den Drilldown zu öffnen (ein "Show Pages"-Button
an der Stelle des Pfeils) — reiner CSS-Klassen-Toggle über einen JS-Timer (kein `transition-delay`
für "erst rein, dann nach mehr Zeit wieder raus" — das sind zwei verschiedene Endzustände auf
demselben `:hover`, was CSS ohne Keyframes an eine feste Gesamtdauer koppeln müsste). Der neue
Button trägt einfach dasselbe `data-pages-toggle`-Attribut wie der bestehende Trigger — der
existierende Klick-Handler greift dafür automatisch, kein zweiter Handler nötig. Beide Elemente
(Pfeil und "Show Pages") stehen bei `width:0; overflow:hidden; opacity:0` in Ruhe und animieren
`width`+`opacity` beim Klassenwechsel — dieselbe Technik wie schon der "N pages"-Chevron
(`.udt-chev`), weil `display` selbst nicht animierbar ist, `width` aber schon: so faden/schieben
beide sich rein/raus statt hart umzuschalten, UND belegen in Ruhe trotzdem keinen Platz (anders als
ein reines `opacity`-Fade, das den Platz permanent reservieren würde).

**Korrektur (galt nur so lange beide Elemente nie gleichzeitig eine reale Breite hatten):** Die
ursprüngliche Annahme oben — zwei Geschwister mit je `margin-left:auto` seien unproblematisch, weil
zur Laufzeit meist nur eines eine reale Breite hat — hielt nicht. Flexbox verteilt den verfügbaren
freien Platz GLEICHMÄSSIG auf ALLE Kinder mit `margin-left:auto` auf einer Zeile, nicht nur auf das
sichtbare. Sobald beide (Pfeil UND Show-Pages-Button) während der Übergangsphase gleichzeitig
Platz beanspruchten (z.B. während der Opacity-Transition, wo beide kurz im Layout mitzählen), landete
der Pfeil nicht mehr flächenbündig am Zellenrand, sondern irgendwo in der Zellenmitte — je nachdem,
wie sich der Platz gerade aufteilte. Fix: **nur EIN** `margin-left:auto`-Element pro Zeile, ein
`width:0; position:relative`-Wrapper (`.udt-row-affordance`), an das beide Zustände als
`position:absolute; right:0`-Kinder andocken. Damit gibt es pro Zeile immer nur einen Auto-Margin-
Teilnehmer, und beide Kinder teilen sich exakt denselben rechten Ankerpunkt, unabhängig davon,
welches gerade sichtbar ist — kein Flex-Verteilungsproblem mehr möglich. Faustregel: **mehr als ein
`margin-left:auto`-Geschwister auf derselben Flex-Zeile ist ein Bug, sobald mehr als eines davon
jemals gleichzeitig eine reale (auch nur kurzzeitige, transition-bedingte) Breite haben kann** —
in Zweifel immer auf einen einzigen Anker + `position:absolute`-Kinder umstellen.

**Nachtrag — die eigentliche Ursache des Aufblitzens war nie die Farbe, sondern volle
Neu-Erzeugung.** `renderTable()` ersetzte bei JEDER Zustandsänderung (Öffnen, Suche, Filter, Seite)
das komplette `innerHTML` der Tabelle — alle Zeilen, nicht nur die betroffene. Eine Zeile, unter
der die Maus gerade steht, wird dabei als BRANDNEUER DOM-Knoten eingefügt; der Browser muss `:hover`
für diesen Knoten von null neu auswerten, was hover-abhängige Elemente (Goto-Pfeil, "Show
Pages"-Pille) für einen Frame sichtbar verschwinden und wieder auftauchen ließ — das eigentliche
"Aufblitzen", mehrfach als Farb-Bug missverstanden und entsprechend erfolglos an der Farbe gefixt.
Die richtige Lösung war eine gezielte Aktualisierung statt eines vollen Re-Renders:

- `renderSubBlockOnly(dom)` ersetzt NUR das `.udt-subrows`-Element (Suche, Filter, Seite,
  Seitengröße, die asynchrone RPC-Antwort, der Title/URL-Switch — alles, was rein den Drilldown-
  Inhalt betrifft). Die Domain-ZEILE wird dabei nie angefasst.
- `togglePages()` selbst fasst die Zeile beim Öffnen/Schließen nur noch per `classList`/
  `setAttribute` an (`is-expanded`, `is-open`, `aria-expanded`) — keine `innerHTML`-Neuerzeugung,
  auch nicht für die tatsächlich angeklickte Zeile. Das `.udt-subrows`-Element wird als
  Geschwister-Knoten eingefügt/entfernt, alle anderen Zeilen bleiben zu jedem Zeitpunkt exakt
  dieselben DOM-Objekte.
- Direkter Wechsel von Domain A zu Domain B (ohne Zuklapp-Animation dazwischen) räumt A's Zustand
  explizit von Hand ab (Klassen runter, Sub-Block entfernen), BEVOR B geöffnet wird — das lief
  vorher "kostenlos" über den vollen Re-Render mit, muss beim gezielten Update aber nachgebaut
  werden, sonst blieben zwei Drilldowns gleichzeitig sichtbar offen.

Faustregel für den nächsten Fall: Ein Flackern, das an EINER Zeile hängt, sobald irgendein
`:hover`-Element daran beteiligt ist, ist fast nie ein Farb-/Timing-Problem — es ist fast immer
"dieser Knoten wurde gerade neu erzeugt". Die Lösung ist selten mehr CSS, sondern gezielteres DOM-
Patching statt eines pauschalen `innerHTML`-Ersatzes.

## 30. Truncation-Tooltip: nach einem Klick ist der Tooltip global stummgeschaltet

`UC.makeTooltips` setzt bei jedem `mousedown`/`click` innerhalb der Root `S.suppressed = true` (der
Tooltip soll nicht über dem aufpoppen, was der Klick gerade geöffnet hat). Zurückgesetzt wird das
**ausschließlich** im delegierten `[data-tip]`-Hover-Pfad.

Komponenten-eigene Hover-Tooltips — das „volle Titel nur zeigen, wenn wirklich abgeschnitten“-
Muster in allen drei Tabellen — laufen aber nicht über `[data-tip]`: ob überhaupt etwas gezeigt
wird, hängt an einer Messung (`scrollWidth > clientWidth`), also gibt es kein Attribut. Folge ohne
Gegenmaßnahme: **ein einziger Klick irgendwo in der Komponente** (Drilldown öffnen, sortieren,
blättern) schaltet jeden Truncation-Tooltip stumm, bis der User zufällig einen fremden Icon-Button
überfährt.

Deshalb im eigenen `mouseover`-Handler, direkt beim Betreten eines neuen Wraps:
```js
var _tips = UC.makeTooltips(root, function(){ return isDark; });
var showTipWide = _tips.showTipWide, hideTip = _tips.hideTip, unsuppressTip = _tips.unsuppress;
// …
if (unsuppressTip) unsuppressTip();   // vor dem 400ms-Timer
```
Kein `title="…"`-Attribut als Ersatz: das feuert unabhängig davon, ob der Text abgeschnitten ist,
und ist weder verzögerbar noch stylebar.

## 31. Filter-Defaults folgen dem Modus, nicht der Historie

Wenn eine Komponente zwischen zwei Datenarten umschaltet (Domains ↔ URLs), muss ein Filter, den es
in beiden Welten gibt, in der **Standarddimension der aktuellen Welt** aufgehen — nicht in der, die
zufällig zuletzt aktiv war. Konkret in `topcitations-dashboard`: URL-Modus öffnet den Typ-Filter auf
**URL Types**, Domain-Modus auf **Citation Types** (`defaultDim(mode)`). Begründung: Die Liste IST
die Antwort auf „welche URLs", Citation Types sind dort die zweite Frage — und jede andere Stelle,
die URLs zeigt (`urls-table`, der `domains-table`-Drilldown), filtert sie nach URL-Typ.

Drei Regeln, die zusammengehören:
- Eine **explizite** Wahl des Users wird persistiert und gewinnt beim Re-Render.
- Ein **Moduswechsel** setzt trotzdem auf den Default des neuen Modus zurück — der User hat die
  Dimension für die alte Welt gewählt, nicht für die neue.
- Der Default ist **komponenten-eigen**: nicht als Render-Parameter von Bubble annehmen. Sonst
  überschreibt der erste Re-Render nach dem Umschalten den gerade gesetzten Default wieder.

## 32. Ein Dropdown kann von MEHREREN Vorfahren gleichzeitig geclippt werden

`UC.unclipAncestors` (§Core-B4) läuft nur AUFWÄRTS von `root.parentElement` — es fixt Clipping durch
Elemente AUSSERHALB der Komponente (z.B. ein Bubble-Wrapper-Div mit `overflow:hidden`). Es erreicht
nie Container, die selbst Teil der Komponenten-eigenen Markup-Struktur sind — genau das ist der
Fall, wenn ein Dropdown-Menü innerhalb eines Panels sitzt, das aus Animationsgründen sein eigenes
`overflow:hidden` braucht (z.B. `domains-table`s `.udt-sub-inner`, dessen Clip die
`grid-template-rows`-Öffnen/Schließen-Animation überhaupt erst möglich macht).

Konkret beim Drilldown-Types-Filter waren es sogar **zwei** solcher Container gleichzeitig:
`.udt-sub-inner` (Animation) UND, sobald der sticky Header greift, `.up-tbody` (dessen
`overflow:hidden` core.css nur für die abgerundeten unteren Ecken braucht, §14). Ein Fix, der nur
einen der beiden lockert, bleibt für den User unsichtbar kaputt — das Menü ragt einfach an der
NÄCHSTEN Grenze wieder ab.

Muster für diesen Fall (targeted overflow-lift, kein `unclipAncestors`, kein Portal, siehe
STYLEGUIDE-Policy „falls doch mal ein Container clippt: dort `overflow:visible` setzen"):
- Eine State-Klasse (`is-menu-open`/`is-subfilter-open`) wird **beim Öffnen und Schließen des
  Menüs** auf JEDEM betroffenen Container gesetzt/entfernt — nicht nur auf dem unmittelbaren
  Eltern-Element des Menüs. `renderSubBlockOnly()` setzt sie auf `.udt-sub-inner` direkt in seiner
  eigenen Markup-Rückgabe; `.up-tbody` sitzt außerhalb dieses ausgetauschten Teilbaums, bekommt sie
  deshalb separat über `root.classList.toggle(...)` (CSS-Selektor `.is-subfilter-open.up-sticky
  .up-tbody`).
- Die Klasse muss auch beim SCHLIESSEN des ganzen Drilldowns (nicht nur beim Schließen des Menüs)
  wieder runter — sonst bleibt `overflow:visible` hängen, obwohl gar kein Menü mehr offen ist.
  Sicherster Ort dafür: die zentrale `resetSubState()`, die ohnehin bei jedem Schließen-Pfad läuft.
- `overflow:hidden` bleibt der Normalzustand (Animation/Ecken brauchen es die meiste Zeit) —
  `overflow:visible` gilt nur, WÄHREND das Menü faktisch offen ist.

Faustregel: Bei jedem neuen Dropdown-im-Panel immer die GESAMTE Vorfahren-Kette bis zum nächsten
echten Scroll-Container auf `overflow:hidden` prüfen, nicht nur den direkten Elternknoten — es sind
oft mehrere, aus unterschiedlichen, voneinander unabhängigen Gründen.

## 33. Zwei unabhängig berechnete Limits für dieselbe Grenze driften auseinander

`UC.makeColumns`s Spalten-Resize hatte zwei Stellen, die beide "wie weit darf die erste Spalte
wachsen" beantworten sollten, aber nie gegeneinander abgeglichen wurden:

- `startResize()` berechnet beim Drag-Start ein `maxA` aus `total - others` (Summe der Minimalbreiten
  aller anderen Spalten).
- `autoFit()` berechnet bei JEDEM Frame (auch während des Drags) ein `budget`, das zusätzlich einen
  `reserve`-Fudge-Faktor abzieht (Border/Rahmen/Rundungs-Puffer, §44) — und dropt eine Spalte, sobald
  `need > budget`.

Da `startResize` den `reserve` nie kannte, erlaubte es dem Drag, GENAU um `reserve` px weiter zu
gehen, als `autoFit` tatsächlich toleriert — der Drag lief also regelmäßig über die eigene, von
`autoFit` gesetzte Grenze hinaus, wodurch mitten im Ziehen eine Spalte verschwand, obwohl jede
andere Spalte noch exakt an ihrem Minimum stand. Fix: `maxA` zieht denselben `reserve` ab wie
`autoFit`s `budget` — beide Grenzen landen dadurch algebraisch auf demselben Punkt (siehe
Kommentar an der Fix-Stelle für die Herleitung).

Faustregel: Wenn zwei Funktionen unabhängig voneinander entscheiden, wo dieselbe Grenze liegt (hier:
"wie weit darf X wachsen, bevor Y passiert"), MÜSSEN sie entweder dieselbe Formel teilen oder
explizit gegeneinander verifiziert werden — sonst drainet die Diskrepanz irgendwann sichtbar durch,
und zwar nur in dem schmalen Bereich nahe der Grenze, was sie beim ersten Test leicht übersehen
lässt.

## 34. `parseBubbleJson`: ein einzelnes unescaptes Anführungszeichen im Text bricht ALLES danach

Bubble baut seine quasi-JSON-Ausgabe per Text-Konkatenation, nicht per echtem `JSON.stringify` —
ein Titel/Description-Feld, das selbst ein wörtliches `"` enthält (z.B. `von "Meine Top 3" geht`),
kommt deshalb manchmal OHNE das nötige `\"`-Escaping durch. `parseBubbleJson`s Scanner behandelte
bis jetzt JEDES `"` innerhalb eines Strings als dessen Ende — trifft es auf so ein wörtliches
Anführungszeichen, hält es den String für beendet und interpretiert den gesamten Rest des Textes
(alle folgenden Felder/Objekte) als syntaktisch kaputt. Ergebnis: der komplette `eval()` schlägt
fehl, `parseBubbleJson` gibt `[]` zurück, und die Komponente zeigt scheinbar grundlos gar keine
Daten — obwohl nur EIN einziges Zeichen in einem einzigen Feld eines einzigen Objekts das Problem
war.

Fix: beim Antreffen eines `"` innerhalb eines Strings erst nach vorne schauen (Whitespace
überspringen) — ist das nächste Zeichen eines von `, } ] :` oder das Textende, ist es ein echtes
schließendes Anführungszeichen; alles andere (ein Buchstabe, ein Leerzeichen vor mehr Text) ist
Inhalt und wird escaped, der Scanner bleibt im String. Deckt den weit überwiegenden Realfall ab
("Wort in Anführungszeichen mitten im Fließtext") — ein `"` das zufällig direkt vor einem
Trennzeichen als Inhalt gemeint ist, bleibt ein unlösbarer Grenzfall (kein Kontext-freier Scanner
kann das von einem echten Ende unterscheiden), kam in der Praxis aber noch nie vor.

Faustregel: **"Sanitizer vergessen" ist bei diesem Repo fast nie das Rendering** (jedes gerenderte
Feld läuft durch `esc()`/`highlight()`) — es ist fast immer das ROHE RPC-Parsing, bevor überhaupt
ein JS-Objekt existiert. Bei einem gemeldeten Fehler mit echten Nutzdaten zuerst `parseBubbleJson`
gegen genau diesen Payload testen (nicht nur den Render-Pfad), speziell auf eingebettete
Anführungszeichen, Backslashes und Emoji in Freitextfeldern.

## 35. Chart-Segment-Klick als Typ-Filter: geteiltes Kit, komponenten-eigene Bedeutung

`UC.makeTypeChart` kann optional `cfg.onSliceClick(key)` nehmen — verkabelt automatisch Klicks auf
Doughnut-Segmente (Chart.js `onClick`, inkl. `onHover`-Cursor), Legenden-Zeilen
(`.up-donut-legend-row.is-clickable`) und Bar-Zeilen (`.up-bar-row.is-clickable`), alle drei auf
denselben `key` aus den vorbereiteten Items. Der "other"-Sammel-Key (URL-Modus, mehr als
`MAX_URL_SLICES` Typen) ist NIE klickbar — er fasst mehrere echte Typen zusammen und lässt sich
nicht auf einen einzelnen Filter-Wert zurückführen. `UC.applyTypeDim(prepped, sel, isDark)` ist das
eigentliche Grau-Legen non-selektierter Slices, extrahiert aus `topcitations-dashboard`s vorheriger
lokaler `applySelectionDim`.

**Aktuell nur EIN echter Verbraucher: `topcitations-dashboard`.** `citations-combo-chart` hatte
diese Funktion kurzzeitig (eigener, rein clientseitiger Typ-Filter ohne Apply-Menü, UND-verknüpft
mit dem Pro-Serie-Filter) — auf expliziten User-Wunsch wieder komplett entfernt. Das Kit selbst
(`onSliceClick`/`applyTypeDim`) bleibt trotzdem in core, weil `topcitations-dashboard` es weiter
braucht; nur die Verkabelung in `citations-combo-chart.js`s `UC.makeTypeChart({...})`-Aufruf ist
weg (kein `onSliceClick` mehr übergeben → `clickable` ist dort automatisch `false`, keine
`.is-clickable`-Klasse, kein Cursor-Wechsel — nichts extra abzuschalten). Falls das je wieder
gebraucht wird: der Git-Verlauf dieser Datei zeigt die vorherige Implementierung (`state.typeSel`,
`seriesTypeFilter()`, UND-Verknüpfung mit `hiddenSeries`) — nicht neu erfinden, nur zurückholen.

**`topcitations-dashboard`s Klick feuert seit dieser Runde SOFORT das echte Apply-Event**, nicht
nur den Live-Dim wie ein bloßer Checkbox-Klick im Menü. `onSliceClick` toggelt `sel[key]` — exakt
dasselbe Objekt, das die Checkboxen im Filtermenü auch schreiben, beide Entry-Points bleiben also
automatisch synchron — UND ruft danach `fireApplyFilter()` selbst auf (nicht eine Kopie davon: ein
Klick auf ein Chart-Segment kann sich sonst nie von einem echten Apply-Klick unterscheiden). Die
Menü-Checkboxen selbst bleiben staged-bis-Apply (siehe §31-Nachbarschaft/`up-filter-submit`) — nur
der Chart-Klick committet sofort, weil er eine einzelne, abgeschlossene Entscheidung ist, kein
Multi-Select-Vorgang wie das Ankreuzen mehrerer Boxen vor einem gemeinsamen Apply.

**Reset-Button LINKS vom Chart-Type-Switch** (`.tcd-chart-reset`, `topcitations-dashboard.js`) —
`insertBefore(btn, chartHeadTools.firstChild)`, nicht `appendChild`: die naheliegende erste
Instinkt-Platzierung ("neuer Button = rechts anhängen") war hier falsch, User wollte ihn explizit
VOR dem Doughnut/Bar-Switch. Nur sichtbar, wenn `state.appliedTypeSel`/`appliedUrlTypeSel`
mindestens einen Key enthält — exakt dasselbe Signal, das schon den Filter-Badge zeigt
(`syncFilterBadge()` toggelt jetzt beide). Klick ruft `resetTypeFilters()` — dieselbe Funktion, die
auch das Filtermenü-eigene Reset benutzt, damit die zwei Einstiegspunkte nie auseinanderlaufen
können. **Wird per JS in `.tcd-unit-left .tcd-head-tools` injiziert statt in die statische Bubble-
Markup aufgenommen** — bestehende Embeds bekommen den Button dadurch automatisch mit dem nächsten
CDN-Pin, ohne dass der User seine Bubble-HTML neu einfügen muss. Faustregel für jede zukünftige
"neuer Header-Button"-Anfrage: erst prüfen, ob eine JS-Injektion reicht (spart dem User einen
Markup-Reimport), statisches Markup nur, wenn das Element wirklich vom allerersten Render an da
sein muss.

**`typeChart.updateColors(d)` — re-colouren statt neu bauen.** Jeder Klick auf ein Chart-Segment
löste vorher einen kompletten `renderDonut()`/`renderBars()`-Neuaufbau aus (über `syncChartDim()` →
`renderChartSide()` → `drawChart()`) — bei Bars sichtbar als kurzes Aufblitzen, weil jede Bar-Fill
beim Neuaufbau erst auf `width:0%` zurückgesetzt und dann neu hochanimiert wird (dieselbe
Entrance-Animation wie beim allerersten Laden), beim Doughnut als ein erneutes 200ms-Fade-in. Ein
reiner Dim-Wechsel (welches Segment ausgegraut ist) ändert aber weder die Anzahl noch die
Reihenfolge der Items — nur ihre Farbe. `updateColors(d)` vergleicht die Keys/Reihenfolge des neuen
gegen das zuletzt gerenderte `d` (`lastKeys`/`lastMode`, Bars werden dafür identisch zu `renderBars`
nach Share sortiert, sonst false positive) — bei Übereinstimmung wird NUR neu eingefärbt (Bars:
`.up-bar-fill.style.background` direkt gesetzt, kein `innerHTML`, keine neuen Knoten; Doughnut:
`chart.data.datasets[0].backgroundColor` ersetzt + `chart.update("none")`, `"none"` heißt explizit
"ohne die Update-Animation abzuspielen"). Bei einer echten Strukturänderung (andere Keys) fällt es
automatisch auf den vollen `renderDonut`/`renderBars`-Pfad zurück. `topcitations-dashboard.js`s
`syncChartDim()` nutzt das jetzt für alle drei Aufrufer (Menü-Checkbox, Chart-Klick, Reset) — ein
einziger Fix an einer Stelle behebt das Aufblitzen überall, nicht nur beim Chart-Klick, den der
User konkret meldete.

**Dimm-Zustand braucht seine ECHTE Farbe griffbereit, nicht nur die gedimmte.** `UC.applyTypeDim`
hängt `__dimmed:true` und `__realColor:<Original>` an jedes ausgegraute Item — zwei Stellen lesen
das:
- **Tooltip-Name-Text** (`makeDonutTooltip`, core.js): der Punkt/Dot im Tooltip zeigt weiterhin die
  TATSÄCHLICH gemalte (gedimmte) Farbe — das ist ein Farb-Swatch, "so sieht das Segment gerade aus".
  Der NAME-Text daneben liest aber aus `chart.data.datasets[0].__realColors[i]` — ein gehovertes,
  gerade ausgefiltertes Segment soll lesbar/erkennbar bleiben, nicht selbst grau wirken, nur weil
  die Ringfarbe gerade grau ist.
- **Hover-Richtung** (`.up-bar-row.is-dimmed`/Doughnuts `hoverBackgroundColor`): ein bereits graues
  Element auf Hover Richtung Weiß aufzuhellen (`UC.brighten`) sah aus wie "wird fast unsichtbar
  weiß" — falsch. Gedimmte Elemente dunkeln stattdessen leicht ab (`UC.darken`, neuer Helper neben
  `brighten` — Blend Richtung Schwarz statt Weiß), echte Farben hellen wie gehabt auf. Faustregel:
  Hover-Richtung ist nie universell "heller" — bei einem Element, das selbst schon eine gedämpfte
  Farbe TRÄGT (nicht nur optisch hell aussieht, sondern bewusst als "gedimmt/inaktiv" markiert ist),
  muss Hover die Dämpfung verstärken, nicht umkehren.

## 38. Der Scroll-Bug: fremdes `overscroll-behavior: contain` auf ALLEM (gelöst)

**Ursache — gemessen und vom User live bestätigt.** Das Bubble-Header-CSS dieser App enthält einen
"Universal Scroll Fix" mit u.a. dieser Regel:

```css
[id*="allow_scroll"] * { overscroll-behavior: contain !important; }
```

`overscroll-behavior: contain` unterbindet Scroll-Chaining: erreicht ein Scroll-Container sein Ende
— oder hat gar nichts zu scrollen — wird das Scrollen NICHT an die Seite weitergereicht. Auf einem
echten Scroll-Container (Modal, lange Dropdown-Liste) ist das sinnvoll. Per `*` auf ALLES gelegt
trifft es aber auch jedes Element, das nur wegen runder Ecken/Clipping ein `overflow: hidden` hat —
und `overflow: hidden` macht ein Element bereits zum Scroll-Container. Gemessene Betroffene:
`.tct-table`, `.tcd-box`, `.vt-table`. Über genau diesen Flächen versickerte das Scrollen komplett.

Das erklärt alle vier Beobachtungen widerspruchsfrei:
- Tabellen in `visibility-chart`/`topcitations-dashboard` gar nicht scrollbar → `.tcd-box`/
  `.vt-table` blockten das Chaining.
- Charts "scrollten, aber komisch, kein iOS-Bounce" → dort lief das JS-Wheel-Forwarding, das
  `preventDefault` rief und von Hand scrollte.
- `domains-`/`urls-`/`prompts-table` immer einwandfrei → deren Bubble-Wrapper trägt die
  `allow_scroll`-ID nicht, die Regel greift dort gar nicht.
- Wheel-Forwarding komplett zu entfernen machte die Charts UNscrollbar → ohne die JS-Krücke schlug
  dort dieselbe CSS-Blockade durch (der Chart sitzt in `.tcd-box`).

**Fix in core.css** — die Bibliothek stellt für ihren eigenen Teilbaum den Browser-Default wieder
her, statt sich auf fremdes Seiten-CSS zu verlassen:
```css
.up-root.up-root, .up-root.up-root * { overscroll-behavior: auto !important; }
```
Doppeltes `.up-root` rein wegen Spezifität: (0,2,0) schlägt `[id*="..."] *` (0,1,0) unabhängig von
der Ladereihenfolge, da beide `!important` nutzen. Verifiziert mit dem echten Header-CSS im
Testaufbau: innerhalb der Komponente `auto`, außerhalb weiterhin `contain` — die fremde Regel
bleibt überall sonst wirksam.

**Sauberste Lösung wäre trotzdem seitenseitig**: `overscroll-behavior: contain` aus der `*`-Regel
entfernen (`touch-action: pan-y` darf bleiben). Die core.css-Regel ist die Verteidigungslinie für
den Fall, dass das nicht passiert.

**Wheel-Forwarding ist danach komplett entfernt worden** — als SEPARATER zweiter Schritt, erst
nachdem der CSS-Fix am echten Embed bestätigt war. `cfg.wheelSel` und der ganze
`forwardWheel`/`scrollTarget`/`attachWheel`-Block sind aus `UC.makeMount` raus, alle drei
Chart-Komponenten übergeben kein `wheelSel` mehr. Damit scrollt überall wieder der Browser selbst,
inkl. Trägheit und Rubber-Banding.

Verifiziert mit dem echten Header-CSS im Testaufbau, beide Bedingungen gleichzeitig:
`overscroll-behavior` innerhalb von `.up-root` überall `auto` (Blockade weg) UND
`defaultPrevented === false` auf `.tct-table`/`.tcd-box`/`.up-donut-body`/`canvas` (JS-Krücke weg).
Zusätzlich geprüft, dass die core.css-Regel nicht über `.up-root` hinausleckt: ein frisches div im
`allow_scroll`-Wrapper, aber außerhalb `.up-root`, behält `contain`.

Dass diese zwei Änderungen zusammen ausgeliefert einmal ZWEI kaputte Deploys erzeugt haben, lag
genau daran, dass sie in der falschen Reihenfolge kamen: Krücke weg, bevor die Ursache behoben war.
Reihenfolge zählt — erst die Ursache beheben, bestätigen lassen, dann die Krücke entfernen.

**Drei Lehren, die diese Session teuer bezahlt hat:**
1. Ein aus reiner Code-Lektüre abgeleiteter Fix ist eine Hypothese, kein Fix.
2. **Prämissen in Kommentaren sind Behauptungen, keine Fakten.** Der Satz "Chart.js sets
   touch-action:none on its canvas" stand jahrelang im Code, ist auf Chart.js 4 messbar falsch
   (`touch-action: auto`) — und hat zwei Debug-Runden in die völlig falsche Richtung geschickt. Der
   Mechanismus war trotzdem nötig, nur aus einem ganz anderen Grund als dort behauptet.
3. **Immer einen Kontrolltest fahren, bevor man einer Messung glaubt.** Ein Test "über der Tabelle
   scrollt nichts → Bug bestätigt" war wertlos, weil derselbe Test über normalem Seiteninhalt
   ebenfalls nichts scrollte: das Messwerkzeug lieferte gar keine echten Scroll-Events. Ohne den
   Kontrolltest wäre daraus der dritte falsche Fix geworden.

## 36. Bar-Hover "wie im Doughnut": zwei verschiedene Mechanismen für denselben Eindruck

Der Doughnut hovert per Chart.js `hoverBackgroundColor` (ein Array vorberechneter, aufgehellter
Farben, `UC.brighten(hex, amt)` — blendet Richtung Weiß). Bars sind aber kein Canvas-Fill, sondern
ein `<div>` mit `background: <inline-color>` — Chart.js' Mechanismus greift dort gar nicht. Gleiche
WIRKUNG, andere Technik: `.up-bar-row:hover .up-bar-fill { filter: brightness(1.12); }` funktioniert
direkt gegen jede beliebige inline gesetzte Farbe, ganz ohne pro Bar eine eigene Hover-Farbe
vorausberechnen zu müssen.

**Der graue Track darf NICHT über `filter` mitgedimmt werden.** `.up-bar-fill` sitzt als echtes
Kind-Element IN `.up-bar-track` — ein `filter` auf dem Track würde das gerenderte Ergebnis der
gesamten Subtree (also auch den bereits gehoverten Fill) ein zweites Mal einfärben, die beiden
Effekte multiplizieren sich (0.94 × 1.12 ≈ 1.05 statt der beabsichtigten 1.12). Deshalb bekommt der
Track stattdessen `background: color-mix(in srgb, var(--vc-heading-bg) 100%, black 6%)` — ändert
nur die eigene Hintergrundfarbe, lässt das gerenderte Kind unangetastet. Faustregel: `filter` auf
einem Container trifft IMMER auch dessen Kinder mit — sobald ein Kind selbst schon einen Hover-
Filter/eine Hover-Transition hat, gehört die Elternfarbe auf `background`, nicht auf `filter`.

Genauso wichtig: der Hover-Trigger sitzt auf `.up-bar-row` (die ganze Zeile reagiert, großzügige
Trefferfläche), aber die sichtbare ÄNDERUNG bleibt auf `.up-bar-fill`/`.up-bar-track` beschränkt —
nie ein Border, nie ein Hintergrund/Schatten auf der Row selbst. Eine Row-weite Hover-Optik liest
sich wie "die ganze Zeile ist ein Button", was außerhalb von `.is-clickable` schlicht falsch ist.

## 37. Reddit-URLs: der gescrapte Titel ist fast immer nur "reddit.com"

`UC.redditTitleHtml(url, title, query)` (core.js) parst `r/<subreddit>` und den optionalen
Slug-Teil direkt aus dem URL-Pfad (`/r/sub/comments/<id>/<slug>`) und baut daraus "r/sub / Lesbarer
Titel" — Slug URL-dekodiert, Unterstriche durch Leerzeichen ersetzt, erster Buchstabe groß. Läuft
NUR an, wenn der mitgelieferte `title` "generisch" ist (leer, oder exakt die URL, oder exakt der
Hostname — `isGenericUrlTitle()`) — ein echter, vom RPC gelieferter Titel gewinnt immer, auch wenn
er zufällig ebenfalls von einer Reddit-URL kommt. Reddit liefert nicht jedem Kommentar-Link einen
Slug (z.B. `.../comments/1k1eu6a` ganz ohne Textteil) — in dem Fall zeigt die Funktion nur
`r/subreddit`, ohne Trenner oder leeren Rest danach.

Gibt `null` zurück (nicht einen leeren String), wenn die URL kein Reddit ist ODER schon ein echter
Titel vorliegt — der Aufrufer fällt in dem Fall auf sein normales `highlight(title, query)` zurück
(`redditTitleHtml(...) || highlight(...)`). Zwei Verbraucher bislang: `domains-table.js`s
`subrowHtml()` (nur im Title-Modus des Drilldown-Switchers, nicht im URL-Modus — der zeigt bewusst
die rohe URL) und `urls-table.js`s `rowHtml()` (nur die Titel-Zeile `.uut-url-title`, die separate
URL-Subzeile `.uut-url-sub` bleibt unverändert die rohe URL). Zweiter echter Verbraucher direkt bei
Einführung — deshalb sofort in core statt erst komponenten-lokal gebaut.

Visuell: `r/sub` UND der `/`-Trenner laufen über `--vc-third` (die gedämpfteste Textfarbe im
System — "das hier ist Kontext, nicht der Inhalt"), der geparste Titel-Teil bleibt in der Zeile
eigener normaler Textfarbe. Als reine Leerzeichen im HTML eingefügt (kein Flex-`gap`), weil die
Titel-Zellen selbst kein Flex-Layout sind — funktioniert dadurch unabhängig davon, wie die jeweilige
Zelle sonst aufgebaut ist.

## 38b. Combo-Chart Titel-Bug, dritter Anlauf: der Code war korrekt, das Matching nicht

Zweimal (R5, R6) wurde `buildLineDatasets()` in `citations-combo-chart.js` gegen isolierte
Testdaten verifiziert und als korrekt bestätigt — `label: dataMode === "url" ? String(m.title ||
id) : String(id)` liest den Titel exakt dort, wo Legende/Tooltip ihn holen. Beim dritten Report
("hab ich dir nicht schon das dritte mal gesagt") lag der eigentliche Fehler nicht in dieser Zeile,
sondern eine Ebene darüber: `series[].url` (aus der Zeitreihen-RPC) und `meta.urls[].url` (aus der
separaten Metadaten-RPC) werden per exaktem String-Vergleich gejoint (`metaMap[String(id)]`). Bubble
liefert beide aus unterschiedlichen Datenquellen — weichen sie auch nur in Trailing-Slash,
Groß-/Kleinschreibung, Whitespace oder %-Encoding voneinander ab, matched nichts, und der Code
fällt lautlos (by design, als "RPC hat keinen Titel geschickt"-Fallback) auf die rohe URL zurück.
Von außen exakt nicht von einem fehlenden Titel zu unterscheiden — deshalb bestand der Bug beide
vorigen Male die Codeprüfung, obwohl er nie im geprüften Code lag.

Fix: `normKey()` — trim, `decodeURIComponent`, lowercase, trailing Slashes weg — als zweiter,
nachsichtiger Lookup (`metaMapNorm`), bevor auf die rohe id zurückgefallen wird. Ändert nichts am
Verhalten, wenn beide Seiten exakt übereinstimmen oder wenn wirklich kein Titel gesendet wird (dann
bleibt der dokumentierte Fallback auf die URL bestehen) — schließt nur die stille Lücke dazwischen.

**Lehre, direkt aus [[feedback_verify_live_before_shipping]]:** "der Code ist korrekt" ist nur eine
Antwort auf "stimmt die Logik", nicht auf "wieso sieht der User in Produktion das falsche Ergebnis".
Bei einer dritten identischen Beschwerde nach zwei bestandenen Code-Reviews ist die richtige nächste
Frage nicht "ist der Code nochmal richtig", sondern "was zwischen zwei korrekten Code-Pfaden könnte
in echten Bubble-Daten anders aussehen als im selbstgebauten Testdatensatz" — hier: zwei RPCs, eine
gemeinsame ID, keine garantierte Formatgleichheit.

## 39. R8-Runde: sieben kleine, unabhängige Fixes

- **Tag-Creator-Farbpalette**: `TOPIC_COLOR_PALETTE` (dupliziert in `prompts-table.js` UND
  `core.js` — zwei unabhängige Kopien, siehe §25/§G1) hatte denselben Grauton (`#666666`) zweimal:
  Reihe 1 Spalte 9 UND Reihe 3 (deep) Spalte 10. Da die Auswahl-Markierung über den Hex-Wert läuft,
  markierte ein Klick auf den einen automatisch auch den anderen — kein Bug in der Selection-Logik,
  echte Datenduplikation. Ersetzt durch `#6f6f6f` (gleiche Luminanz-Familie wie die Zeile, per
  WCAG-Kontrast-Formel gegen Weiß UND Schwarz neu geprüft, siehe die Kommentare direkt über der
  Palette). Beide Kopien synchron gehalten.
- **Prompts-Table Inactive-Mode**: Row-Click feuerte `uptRowClick` unabhängig vom `state.status` —
  jetzt gated auf `state.status !== "inactive"` (Maus- UND Keyboard-Pfad).
- **`resetPromptsTable()` verengt**: resettete bisher zusätzlich Suche/Sort/Paging/Status/
  Spaltenbreiten — als "Page-Leave-Reset" ursprünglich so gewollt und dokumentiert, aber das hat den
  User überrascht, der die Funktion für einen reinen Popover-Reset hielt. Jetzt: nur noch Add-Topic-
  Modal schließen, Bulk-Topic-Panel schließen, Selection leeren. Bubble-Doku entsprechend
  nachgezogen — wer weiterhin einen vollen Tabellen-Reset beim Seitenverlassen will, muss die
  Tabelle stattdessen mit frischen Daten neu rendern.
- **TCD Bar-/Doughnut-Deselect-Flash**: `onSliceClick`/`resetTypeFilters()` feuern immer sofort
  Apply (kein Staging). Der bisherige Weg über `syncChartDim()` zeigte dabei kurz den lokal schon
  aktualisierten (oft: komplett ungedimmten, weil leere Selektion = kein Filter) Zwischenzustand,
  bevor die echte Bubble-Antwort den Loader brachte. Beide Pfade setzen jetzt sofort
  `state.optimisticLoading = true` und rufen den vollen `renderChartSide()` (Skeleton) statt der
  Dim-Preview — genau der gleiche Mechanismus, den ein manueller Mode-Switch schon nutzt.
- **Bar-Chart-Skeleton**: `makeTypeChart.skeleton()` baute bisher immer `donutSkeletonHtml()`,
  unabhängig vom aktiven Chart-Typ. Neues `cfg.chartMode()` (NICHT zu verwechseln mit `cfg.mode()`,
  das ist der Daten-Modus domain/url bzw. citation/url-type!) plus `barSkeletonHtml()` — descending-
  width `.up-bar-track`-Zeilen mit demselben Shimmer wie der Doughnut. Beide Verbraucher
  (`topcitations-dashboard.js`, `citations-combo-chart.js`) geben jetzt `chartMode` mit rein.
- **Domains-Table Show-Pages-Delay**: Hover-Dwell 1.5s → 1s (`domains-table.js`, ein `setTimeout`-
  Wert plus zwei Kommentare, `domains-table.css` zwei Kommentare — die eigentlichen
  `transition-delay`-Werte für den Fade-Handoff selbst waren davon nie betroffen, die stehen für
  den Übergang NACH dem Dwell, nicht für den Dwell selbst).

## 40. R10-Runde: sechs kleine, unabhängige Fixes

- **Bulk-Bar dimmt bei Loading**: `elBulk` sitzt auf `document.body`, außerhalb von `.up-root` —
  `.up-root.is-reloading .up-tbody` (core.css) erreicht ihn deshalb nie. Eigene Klasse
  `.upt-bulkbar.is-loading`, in `renderBulkBar()` per `isBusy()` gesetzt, dimmt Row+Panel und
  schaltet `pointer-events:none` — unabhängig vom on/off-Zustand der Bar selbst.
- **"Select all N matching" + neue Seite/Limit**: `state.selectAllMatching` wurde nie in
  `state.selected` zurückgeschrieben — nur neu geladene Zeilen (Page-Wechsel, Page-Size hoch)
  zeigten sich deshalb als nicht selektiert, obwohl die Predicate-Selektion sie längst umfasst.
  `rowHtml()`, `syncRowChecks()`, `syncSelectAll()` prüfen jetzt `state.selectAllMatching ||
  state.selected[id]` statt nur `state.selected[id]`.
- **Select-All-Header-Checkbox**: der Deselect-Zweig von `toggleSelectAll()` leerte nur die
  aktuell geladene Seite — über mehrere Seiten selektiert (oder mit aktivem
  `selectAllMatching`) blieb entweder eine fremde Seite selektiert oder die Bulk-Bar zeigte
  weiter den vollen Count trotz leerer Checkboxen. Deselect leert jetzt immer die komplette
  Selection (`state.selected = {}`, `invalidateSelectAll()`).
- **Status-Switch (Active/Inactive) + Pagination**: `uptStatus` trägt jetzt `limit`/`offset`/
  `page` (immer Seite 1) im Payload, gleiche Form wie `uptPage` — vorher hatte die Bubble-Seite
  keine explizite Bestätigung, dass sie ihre eigene Pagination-State auf Seite 1 zurücksetzen
  muss, und konnte eine stehengebliebene Seite/Offset weiter anfragen.
- **TopCitations Dashboard Empty-Grace**: 3s → 600ms (Chart-Seite über `UC.makeEmptyGrace({ms:
  600})`, Tabellen-Seite über den eigenen `tableEmptyGraceTimer`). Der 3s-Wert war 1:1 von
  visibility-chart übernommen, ohne dass der dortige Anti-Flash-Grund (RPC-Zwischenschritt
  räumt kurz leer) hier in der Praxis so lange gebraucht hätte — fühlte sich nach "hängt" an,
  nicht nach "settled".
- **Chart-Settings-Zahnrad Position**: `.vot-scale-btn`/`.ccl-settings-btn` (visibility-chart,
  citations-combo-chart) von `top:12px;right:12px` auf `top:8px;right:8px` — sitzt jetzt näher
  an der Ecke.
- **Topics-Zellen-Höhe in der Prompts-Table**: `.ust-tag`/`.ust-more`/`.ust-row` (die JS-
  injizierte In-Table-Widget-CSS, siehe `installUstTopics()`) von 32px auf 28px. Bewusst NUR
  dort — der Bulk-Popover-Chip (`.upt-topicchip`) und die Add-Topic-Modal-Chips
  (`.up-topicmodal-*`) bleiben bei 32px, das sind komplett andere CSS-Klassen.
- **Bulk-Bar z-index unter Bubble-Drawern**: `.upt-bulkbar` von `z-index:99999` auf `8000` — lag
  bisher über den Host-Page-eigenen Floating-Group-Drawern/Backdrops (deren `dz1-3`/`bz1-3` bei
  ~9905-9930 liegen), obwohl ein geöffneter Drawer konzeptionell über der Seite liegen sollte.
  Das Add-Topic-Modal (core.css, `z-index:100000`) öffnet weiterhin über der Bar, unabhängig
  von diesem Wert.

## 41. Der Loader-Akkumulations-Bug (Teilbefund — die eigentliche Ursache steht in §42)

> **Korrektur:** Dieser Abschnitt beschreibt einen echten, aber NACHRANGIGEN Bug. Er erklärt
> nicht das gemeldete Symptom: der User hatte das Problem sofort beim ERSTEN Öffnen, nicht
> erst nach mehreren Navigationen. Der Dedupe-Fix unten verhindert nur Wiederholungen und hat
> entsprechend nichts gebracht. Die echte Ursache und der wirksame Fix: §42.

**Symptom (vom User gemeldet):** vor der Umstellung auf diese HTML-Komponenten hatten die Bubble-
Drawer und View-Wechsel eine saubere kurze Animation. Danach: Animationen laufen oft gar nicht
mehr ("es ploppt einfach rein"), teils bis zu einer Sekunde Verzögerung.

**Ursache:** der CDN-Loader am Fuß jeder `bubble/*.html`. Bubble re-injiziert den kompletten
Markup-Block einer Komponente — inklusive dieses `<script>` — bei JEDEM Re-Render des Reusables,
in dem sie sitzt. Also bei jedem Drawer-/View-Öffnen. Der Loader hatte keinerlei Dedupe und hängte
dabei jedes Mal erneut `<link core.css>`, `<link component.css>`, `<script core.js>`,
`<script component.js>` an den `<head>` — 4 Tags pro Render, dauerhaft, nie aufgeräumt.

Gemessen (lokaler Harness, 7 Komponenten auf der Seite):
`14 Tags` nach einem Seitenaufbau → `24` nach 5 Drawer-Öffnungen → `64` nach ~25 Navigationen.

Warum das die Animation trifft und nicht bloß Speicher kostet: **das Einfügen eines
`<link rel="stylesheet">` ist render-blocking.** Der Browser hält das Painting an, bis das
Stylesheet aufgelöst ist. Das passierte exakt im Moment der Öffnungsanimation, und bei kaltem oder
revalidierendem Cache mit einem vollen Netzwerk-Roundtrip zu jsDelivr davor.

**Zwei Hypothesen, die vorher geprüft und WIDERLEGT wurden** (bewusst hier festgehalten, damit sie
nicht nochmal jemand verfolgt):
- Der ganzseitige MutationObserver in `watchRoots` — mit Kontrolltest gemessen: ~0.6ms Mehrkosten
  bei 1200 injizierten Knoten. Zu klein, um relevant zu sein.
- Mehrfaches Auswerten von core.js — gemessen: ~0.1ms Median pro Evaluation (180kB). Die Datei ist
  fast nur Funktionsdefinitionen, das Parsen ist billig.
Nicht die Ursache war auch der `data-cdn-pin` gegenüber `@main` — der Pin bestimmt nur, WELCHE
Datei geholt wird, beide werden gleich gecacht.

**Fix:** Registry auf `window.__upAssetsLoaded`, gekeyed auf die volle URL; `css()`/`js()` gehen
durch ein `once()`. Bewusst auf `window` und nicht in der Closure — jede Komponente bringt ihre
eigene Kopie des Loaders mit, eine Closure-Variable würde pro Komponente einmal existieren und
genau nichts verhindern.

**Warum das Überspringen sicher ist** (die kritische Annahme, separat verifiziert): ein
re-gerenderter Root braucht die Scripts NICHT erneut. `core.js`s `watchRoots`-Observer plus der
1.5s-Heartbeat finden den neuen Root und initialisieren ihn. Gegengetestet mit einem Harness, der
die Scripts absichtlich genau einmal ausführt und danach frisches Component-Markup in den DOM
hängt: Root wird gefunden, `__uptController` wird gesetzt, `renderPromptsTable()` rendert echte
Zeilen. Ohne diesen Test wäre der Dedupe ein Blindflug gewesen — er hätte die Komponenten nach dem
ersten Render tot stellen können.


## 42. Ladelatenz im Animationsfenster (Teilbefund — die dominante Ursache steht in §44)

> **Korrektur:** die Massnahme unten wurde ausgeliefert und wirkt technisch wie gemessen (0 neue
> Tags, Chart.js vorher bereit) — hat das gemeldete Symptom aber nicht spürbar behoben ("außer
> dass der Pageload jetzt bisschen laggyer ist... hat sich nicht wirklich was geändert"). Die
> dominante Ursache war §44 (Bubble-Workflow-Arbeit im Animationsfenster), nicht diese. Bleibt als
> sinnvolle Sekundär-Optimierung bestehen — ist nur nicht "der Fix".

**Symptom:** Drawer und View-Wechsel animieren nicht mehr ("ploppt rein") oder hängen 600–1000ms.
Sofort, ab dem ersten Öffnen. Entfernt man die Komponenten von der Page, ist alles sofort wieder
flüssig.

**Was es NICHT ist** (alles gemessen, nicht vermutet):
- Keine CPU-Blockade. Beim Öffnen eines Drawers mit visibility-chart + topcitations-dashboard:
  **null Long Tasks, 0ms blockierte Zeit.** Die Komponenten rechnen beim Start praktisch nichts.
- Nicht der ganzseitige MutationObserver (~0.6ms bei 1200 Knoten).
- Nicht das mehrfache Auswerten von core.js (~0.1ms Median).
- Nicht `data-cdn-pin` vs. `@main`.
- Nicht die Tag-Akkumulation aus §41 (die ist real, aber tritt erst über viele Navigationen auf).

**Was es IST:** die Assets werden erst geladen, wenn Bubble das Komponenten-Markup injiziert —
und das passiert exakt während der Öffnungsanimation. Drei Latenzen hintereinander:

    1. <link rel="stylesheet"> in den <head>            ← RENDER-BLOCKING
    2. core.js + component.js (async=false → seriell)
    3. beim ersten Chart: Chart.js, ~200kB, eigener Request

Schritt 1 erklärt das "Ploppen" vollständig: ein frisch eingefügtes Stylesheet hält das Painting
an, bis es aufgelöst ist. Die Animation läuft in dieser Zeit ins Leere und ist vorbei, bevor
wieder gemalt werden darf. Schritt 2+3 erklären die 600–1000ms. Lokal ist das alles ~0ms, gegen
jsDelivr eben nicht — deshalb war es im Harness nie sichtbar und nur in der echten App.

**Fix:** `bubble/page_header_preload.html` — lädt core + alle Komponenten-Assets + Chart.js einmal
beim Seitenaufbau ins Page-Header-Script und trägt sie in dieselbe `window.__upAssetsLoaded`
Registry ein, die die Loader in den Komponenten benutzen. Die finden ihre URLs dann als "schon da"
vor und tun nichts mehr.

Verifiziert: beim Öffnen eines Drawers entstehen danach **0 neue `<link>`/`<script>`-Tags**
(vorher 4), Chart.js ist vorher schon bereit, und die Komponente initialisiert sich trotzdem
korrekt — weil ein neu auftauchender Root von `watchRoots` + Heartbeat gefunden wird und die
Scripts gar nicht erneut braucht.

**Regel für neue Komponenten:** alles, was ein Komponenten-Loader zur Laufzeit nachlädt, landet
zwangsläufig im Animationsfenster desjenigen Containers, der die Komponente einblendet. Neue
Assets (weitere Libs, Fonts, Icon-Sets) gehören deshalb in den Header-Preload, nicht in einen
Lazy-Load beim ersten Gebrauch.

## 43. Dynamische Bubble-Attribute im Komponenten-Markup (WIDERLEGT — siehe §44)

> **Korrektur:** Diese Erklärung war falsch. Der User hat `data-processing` und `data-isdark`
> entfernt — die Long Tasks blieben unverändert (249ms / 285ms). Statisches Markup bleibt
> gute Praxis und `upstreemSetTheme()` bleibt nützlich, aber die Ursache war es nicht.
> Die tatsächliche Ursache und der Beweis: §44.

Bubble rendert ein HTML-Element, dessen Inhalt dynamische Ausdrücke enthält, bei jeder Änderung
komplett neu (`$.fn.html()`). Die Komponente wird dabei abgerissen und neu gebaut. Auf der echten
Seite gemessen: 209–320ms Long Tasks, 6 statt 24 Frames — jedes Mal, wenn `data-processing` kippt,
also bei jedem Ladevorgang und damit mitten in jeder Drawer-/View-Animation.

Wichtig für die Fehlersuche: die Long Tasks liegen laut Stacktrace komplett in Bubbles `run.js`
(`freeze_workflows_sync`, `find_element_references`) und `$.fn.html` — nicht in unserem Code.
Dieselben Operationen lokal: Markup einfügen 2ms, Init 0 Long Tasks, `reset()` 8ms. Es ist also
kein Perf-Bug in den Komponenten, sondern ein Integrationsfehler im Bubble-Setup. Das war auch der
Grund, warum drei vorherige Erklärungsversuche (Tag-Akkumulation §41, Ladelatenz §42, Chart.js)
danebenlagen: lokal war nie etwas messbar, weil lokal kein Bubble die Komponente neu baut.

**Regel:** kein dynamischer Bubble-Ausdruck im Markup, der sich zur Laufzeit ändert. Für alles
Veränderliche gibt es JS-Funktionen (`set…Loading`, `upstreemSetTheme`, `render…({brand})`).
Details und Umstellungstabelle: `bubble/STATISCHES_MARKUP_PFLICHT.md`.

`upstreemSetTheme(isDark)` (core.js) setzt `data-isdark` per JS auf allen `.up-root`s — die pro
Komponente ohnehin vorhandenen MutationObserver auf dieses Attribut ziehen nach, ohne dass Bubble
etwas davon mitbekommt. Genau deshalb bleibt der Attribut-Mechanismus erhalten, statt ihn durch
eine neue API zu ersetzen: er funktioniert, sobald ihn nicht mehr Bubble triggert.


## 44. Die tatsächliche Ursache: Bubble-Workflow-Arbeit im Animationsfenster

**Der entscheidende Test** (nachdem vier Erklärungsversuche danebenlagen): den Drawer einmal
komplett ohne Bubble aufrufen — direkt aus der Konsole, kein Button, kein Workflow, kein RPC:

    openDrawer('prompt')      →  32 Frames, 0 verzögert, keine Long Tasks   ✓ flüssig
    closeDrawer('prompt')     →  32 Frames, 0 verzögert, keine Long Tasks   ✓ flüssig

Exakt derselbe Drawer, exakt derselbe Inhalt, exakt dieselben Komponenten — nur ohne den Workflow
drumherum. Über den Button dagegen: 249ms bzw. 285ms Long Tasks, 12 statt 24 Frames.

Damit ist bewiesen: **weder die Komponenten noch ihr DOM kosten irgendetwas.** Die Blockade ist
Bubbles eigene Workflow-Maschinerie (`freeze_workflows_sync`, `find_element_references`,
`evaluate_property` im Stacktrace), die gleichzeitig mit der CSS-Transition läuft und den
Main-Thread so lange belegt, dass keine Frames mehr gerendert werden.

**Fix (Bubble-seitig):** die Animation zuerst durchlaufen lassen, dann arbeiten.

    Schritt 1:  Run JS  →  openDrawer('prompt')
    Schritt 2:  Add a pause before next action  →  ~300ms
    Schritt 3+: RPCs, States, Run-JS-Datenschritte

    Schritt 1:  Run JS  →  closeDrawer('prompt')
    Schritt 2:  Add a pause before next action  →  ~250ms
    Schritt 3:  reset…()

**Die Debugging-Lehre, die hier teuer war:** der Kontrollversuch des Users ("Komponenten raus →
alles flüssig") wurde von mir als Beweis gelesen, dass die Komponenten die Ursache sind. Das war
ein Fehlschluss — mit den Komponenten verschwanden auch die Workflows, die sie füttern. Wenn ein
Kontrollversuch etwas entfernt, entfernt er meistens mehr als eine Sache. Der richtige nächste
Schritt ist, die verdächtige Sache **isoliert auszulösen** (hier: openDrawer direkt aus der
Konsole), statt weiter innerhalb der eigenen Codebasis nach der Ursache zu suchen.

Zu den vier falschen Fährten unterwegs, alle mit lokal gemessenen Gegenbeweisen: Tag-Akkumulation
(§41), Ladelatenz im Animationsfenster (§42), Chart.js-Nachladen, dynamische Attribute (§43).
Gemeinsamer Nenner: alle wurden lokal nie sichtbar, weil das Problem gar nicht im Repo lag.

## 45. View-Wechsel: 1686ms blockiert, davon 83ms unsere — Messung und Konsequenz

Gemessen auf der echten Seite (Navigation zur Prompts-View, `bubble/diagnostics/_diagnose_view_console.js`):

    +0ms      Navigation
    +198ms    View sichtbar
    +803ms    ⛔ 165ms
    +969ms    ⛔ 586ms          ← groesste Blockade, VOR unserem ersten Aufruf
    +1309ms   setPromptsTableLoading()   ⏱ 21ms
    +1555ms   ⛔ 87ms
    +1692ms   ⛔ 52ms
    +1908ms   renderPromptsTable()       ⏱ 14ms      (15 Zeilen)
    +2153ms   ⛔ 451ms
    +2390ms   setPromptsTableTopics()    ⏱ 12ms
    +2405ms   renderTopicsManager()      ⏱ <2ms
    +2414ms   setPromptsTableLoading()   ⏱ 36ms
    +2735ms   ⛔ 345ms

Summe blockiert: 1686ms. Summe unserer Funktionen: ~83ms (5%). **Keine der sechs Blockaden liegt
auf einem unserer Aufrufe** — alle sitzen in den Luecken dazwischen, die groesste sogar bevor wir
das erste Mal gerufen werden. Die Zeit gehoert Bubbles Workflow-/Expression-Maschinerie.

**Konsequenz fuer dieses Repo:** an der Render-Pipeline der Tabellen ist hier nichts zu holen.
`renderPromptsTable` mit 15 Zeilen kostet 14ms — selbst eine Halbierung waere im Rauschen. Wer das
naechste Mal einen langsamen View-Wechsel meldet, misst zuerst mit dem Snippet und optimiert erst,
wenn eine Blockade tatsaechlich AUF einem unserer Aufrufe liegt.

**Was auf Bubble-Seite hilft** (nach Hebelwirkung):
1. Ladezustand als ERSTEN Workflow-Schritt setzen, vor der RPC. Im Log kam er bei +1309ms — die
   View stand da schon 1.1s leer da, ohne dass irgendetwas blockiert war. Kostet keine Millisekunde
   Gesamtzeit, aendert aber die gefuehlte Geschwindigkeit komplett.
2. Alles hinter die erste Tabellendarstellung schieben, was fuer sie nicht gebraucht wird —
   `setPromptsTableTopics` (nur fuer den Bulk-Editor noetig) und `renderTopicsManager` (gehoert
   gar nicht auf diese View) liefen hier im selben Block mit.
3. Payload der Run-JS-Schritte kleiner halten: die Blockaden vor unserem ersten Aufruf sind Bubble
   beim Auswerten der RPC-Antwort und Bauen des Text-Ausdrucks.

## 46. Eine fehlende Verdrahtung darf nie schweigen

**Regel:** Wenn eine Komponente einen Bubble-Event-Namen aus einem Attribut liest und das Attribut
leer ist, muss sie das sagen. Genau einmal pro Instanz, mit Instanz-Id, Attributnamen und einem
Beispielwert. Ein `if (!name) return;` ohne Meldung ist verboten.

**Warum die Regel existiert.** Das Models-Dropdown feuert auf zwei Kanälen: `data-models-fn` an das
Element im Reusable, `data-models-apply-fn` an das Element auf der Seite. Der zweite blieb bei allen
elf Platzierungen ungefüllt. Die Bubble-Events waren korrekt angelegt und lagen an der richtigen
Stelle, nur wusste kein Element ihren Namen. `fireTo()` kehrte bei leerem Namen wortlos zurück, also
war das Symptom "das Dropdown feuert nicht" und die Ursache stand nirgends.

Von den drei möglichen Ausgängen war das der schlechteste:

| Attribut | Verhalten vorher | Verhalten jetzt |
|---|---|---|
| richtig gesetzt | feuert | feuert |
| falscher Name | warnt mit Namen | warnt mit Namen |
| leer | **nichts, wortlos** | Hinweis mit Attributname und Beispiel |

**Zweite Regel, wo die Namen einer Konvention folgen: leiten statt fordern.** Ein zweites Attribut
pro Platzierung ist bei elf Platzierungen elf Edits für einen Namen, der ohnehin einer Regel folgt.
Das Models-Dropdown leitet den Apply-Namen deshalb aus `data-models-fn` ab, indem es `umfModels`
durch `umfApply` ersetzt. Ein explizit gesetztes Attribut gewinnt weiterhin.

Ableiten ist nur erlaubt, wenn die Namen in der App tatsächlich einheitlich sind. Beim
Topics-Dropdown wird bewusst NICHT abgeleitet: dort stehen `utfTopics_*` und `utfsettopics_*`
nebeneinander, eine Ableitung würde also das falsche Ziel rufen. Dort greift nur die erste Regel.

**Beim Bauen einer neuen Komponente zu prüfen:** jeder Pfad, auf dem ein Event-Name ins Leere laufen
kann, endet entweder in einem Aufruf oder in genau einer Konsolenzeile. Nie in beidem und nie in
keinem von beidem.

---

## 46b. Bubble schreibt Booleans als nacktes yes/no ins JSON

Ein Boolean aus einer RPC kommt nicht als `true`, sondern als `yes` bzw. `no` — **ohne
Anfuehrungszeichen**:

```
"user_can_manage": yes,
```

Das ist kein gueltiges JSON. `JSON.parse` bricht genau dort ab, mit
`Unexpected token 'y'`, und der ganze Datensatz ist weg — dieselbe Bauart wie das
verschluckte `null` aus §46. Der Sanitizer bekommt darum eine zweite Zeile:

```js
var RAW = `[RPC-Ergebnis]`
  .replace(/:\s*([,}\]])/g, ": null$1")
  .replace(/:\s*(yes|no)\s*([,}\]])/g, function(_, v, t){ return ": " + (v === "yes") + t; });
```

Ein echter Textwert `"yes"` steht in Anfuehrungszeichen und bleibt unberuehrt — gepruefter
Kontrolltest mit `"note":"say yes, then no"`, der Text kommt unveraendert an. Beide Zeilen
gehoeren in JEDEN Run-JS-Schritt, der eine RPC liest, nicht nur in den, der gerade kaputtging.

## 47. Der Payload kommt durch ein Template-Literal — der Sanitizer muss das mitdenken

Bubble übergibt jeden RPC-Payload in einem „Run JavaScript"-Step **in Backticks**:

```js
renderResponsesTable({ instanceId: "…", rows: `[RESPONSE]` });
```

Ein Template-Literal wird von der JS-Engine aufgelöst, **bevor** unsere Komponente den Text je zu
sehen bekommt. Aus zwei Zeichen `\n`, die der RPC als Escape geschrieben hat, wird dabei ein echter
Zeilenumbruch — und der steht dann mitten in einem JSON-String-Wert. JSON verbietet rohe
Steuerzeichen in Strings, also scheitert der strikte Parse. Dasselbe gilt für `\t` und für jeden
Backslash, der seine Escape-Bedeutung im Literal verliert.

`UC.parseLoose` escaped solche Zeichen beim Reparieren wieder (`scanString`, Repair 7). Wer eine
neue Komponente baut, muss dafür nichts tun — aber wer den Sanitizer anfasst, darf diese Reparatur
nicht wegoptimieren. Erster Verbraucher, an dem es aufgefallen ist: `response_preview` in der
Responses-Tabelle, das erste Feld der App mit mehrzeiligem Text.

**Typografische Anführungszeichen werden NICHT normalisiert.** `„so ist das", sagte er` ist eine
völlig legale Zeichenfolge in einem JSON-String. Wer sie global durch `"` ersetzt, schiebt zwei
strukturell aussehende Anführungszeichen in einen Textwert; das vor dem Komma beendet den String
dann mehrere hundert Zeichen zu früh. `repair()` behandelt sie nur dort als Struktur, wo sie
außerhalb eines Literals stehen — dann können sie nichts anderes sein.

**Und die Fehlermeldung meldet den Fehler der Reparatur, nicht den strikten.** Der strikte Fehler
zeigt immer auf das, was Bubble zuerst verbogen hat — ein leerer Wert, ein unquotierter Key — und
für jedes davon existiert eine Reparatur. Ihn zu drucken schickt einen auf die Jagd nach einem Bug,
der längst gefixt ist. Aussagekräftig ist nur, warum der **reparierte** Text immer noch nicht
parst, mitsamt den 60 Zeichen um die Fehlerstelle. Das hat eine ganze Runde gekostet.

## 48. Neue Felder in einem Event-Payload gehören nach VORNE

`JSON.stringify` schreibt Keys in Einfügereihenfolge. Ein Feld anzuhängen verschiebt damit jedes
bestehende Feld weiter weg vom Ende des Strings — und Bubble-Workflows lesen Werte per Regex.

Für die meisten Felder ist das egal, weil `(?<="key":")[^"]*` von der Position unabhängig ist. Für
Werte, die selbst JSON enthalten, ist es das nicht: `uptGroups.groups` trägt ein JSON-Array als
String, voller escapter Anführungszeichen, und die einzige Regel, die den Wert vollständig greift,
reicht bis ans Ende des Payloads. `team_id` ans Ende zu hängen hat sich hinter diesen Wert gesetzt
und die Extraktion still gebrochen: Custom Groupings wurden weiter gespeichert und in den Pickern
weiter angezeigt, aber die Gruppenliste der Tabelle kam leer zurück.

`makeFire` in core.js stellt `team_id` deshalb voran. Der Schwanz jedes Payloads bleibt damit
byte-identisch zu dem Stand, bevor es Team-Scoping gab. Wer ein weiteres globales Feld ergänzt,
macht es genauso.

## 49. Die schwebende Benachrichtigung (`notification-card`, Präfix `unc`, seit 16.10.)

Variante C „Invers“ der Leinwand „Notification Varianten“: die schmale Karte in der Sprache von
`UC.toast`, **umgekehrt zum Thema** (im Hellen dunkel, im Dunkeln hell), die Seite dahinter behält
ihr Thema. Vorher (bis 15.10.): 424 breit, weiß, Kopfzeile mit Logo, Zeichenkachel, Zierlinien.

| Teil | Wert |
|---|---|
| Lage | `position: fixed`, rechts und unten **16**, unter 480px Breite links/rechts 16, unten 8, volle Breite |
| Karte | 360 breit, Polster `14 10 14 16`, `gap 12`, Radius `--up-r-2xl` (12), Rand 1px in der Flächenfarbe, `--up-e-4` |
| Farben | Fläche `--vc-inverse-bg`, Schrift `--vc-inverse-ink`, Nebenschrift `--vc-inverse-sub`, Hover-Fläche `--vc-toast-flaeche` |
| Zeichen | eigene Spalte 18×20, `UC.icon(name, 1.5)` in 18px, Strich |
| Bezeichnung | Geist Mono 12/20, 500, Nebenschrift, normale Schreibung |
| Titel / Text | 14/20 600 (−0.01em) / 13/20 400 Nebenschrift; 4 Abstand, 4 über dem Titel |
| Knöpfe | linksbündig, 14 darüber, `gap 8`, Hauptknopf zuerst; beide `.up-btn-sec` (32, Radius 6) mit Polster 12 und 13px |
| Hauptknopf | gefüllt (`--vc-inverse-ink` als Fläche) bei feature, announcement, security, whats_new; umrandet (Tinte zu 22 %) bei maintenance, tip |
| Zweitknopf | nur Text in der Nebenschrift, Fläche erst beim Hover |
| X | `.up-iconbtn.is-24` (Radius 4 nach Geist), 2px über der ersten Zeile |

**Bewegung.** Karte 1 s easeOutExpo (`--up-ease-expo`) aus 12px und `scale(.985)`; Zeichen und
Bezeichnung, Titel und Text, Knöpfe folgen mit 100, 200, 300 ms Verzögerung (6px Weg). Ab 600 ms
läuft der Glanz (`--vc-inverse-glanz`) einmal schräg über die Karte, 1.6 s,
`cubic-bezier(.45,.05,.3,1)`. Nur `opacity` und `transform`. Eine **neue** Nachricht (andere id)
spielt die Einblendung neu ab, dieselbe noch einmal nicht. Bei `prefers-reduced-motion` keine
Bewegung und kein Glanz.

**Thema zur Laufzeit.** Die Karte hängt am `<body>` und trägt `data-theme` selbst. Sie folgt
`UC.onTheme` und einem Beobachter auf `data-theme`/`data-isdark` der Wurzel; vorher blieb sie bis
zum nächsten Datensatz im alten Thema.

**Zu lange Knopfbeschriftung** bricht in eine zweite Zeile um; ein einzelner Knopf, der allein
nicht passt, kürzt mit Auslassung.

`data-logo` wird weiter angenommen (Vertrag), aber nicht mehr gezeichnet.
