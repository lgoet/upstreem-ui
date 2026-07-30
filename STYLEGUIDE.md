# Upstreem UI-Komponenten — Styleguide

Gilt für alle Tabellen- und Chart-Komponenten des Upstreem-UI-Systems. Root-Klasse aller Komponenten: **`.up-root`** (Core, `core.css`/`core.js`). Komponentenspezifische Präfixe: `uut-` (URLs Table), `udt-` (Domains Table), weitere folgen. Chart-Komponenten aus der Pre-Core-Ära (`vc-`/`cc-`/`uc-`-Präfixe) sind noch nicht migriert und in `to-migrate/` abgelegt.

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

### Light Mode
| Rolle | Variable | Wert |
|---|---|---|
| Primär-Fontfarbe (Haupttext) | `--vc-text` | `#1f1f1b` |
| Sekundär-/Mutedfarbe (Labels, Icons default) | `--vc-muted` | `#6f737c` |
| Drittfarbe (Hash-Icon, Positionsnummer) | `--vc-third` | `#9e9e9e` |
| Border | `--vc-border` | `#e0e2e6` |
| Haupt-Background | `--vc-bg` | `#ffffff` |
| Topbar-Background | `--vc-topbar-bg` | `#ffffff` |
| Hover-/Heading-Background | `--vc-heading-bg` | `#f5f5f5` |
| Skeleton-Grundfarbe | `--vc-sk` | `#e8e8e8` |
| Switch-/Switcher-Track-BG | `--vc-switch-bg` | `#f5f5f5` |
| Switch-Border | `--vc-switch-border` | `#e0e2e6` |
| Akzent/Primärfarbe | `--vc-primary` | `#1f1f1b` (identisch mit `--vc-text`) |
| Tabellen-Head-BG | `--vt-head-bg` | `rgba(245,245,245,0.3)` |
| Logo-Box-BG | `--vt-logo-bg` | `#ffffff` |
| Row-Hover | `--vt-row-hover` | `rgba(245,245,245,0.75)` |
| Trend positiv | `--vt-up` | `#2ea84a` |
| Trend negativ | `--vt-down` | `#b0200c` |

### Dark Mode
| Rolle | Variable | Wert |
|---|---|---|
| Primär-Fontfarbe | `--vc-text` | `#e0e0e0` |
| Sekundärfarbe | `--vc-muted` | `#a0a0a0` |
| Drittfarbe | `--vc-third` | `#808080` |
| Border | `--vc-border` | `#353535` |
| Haupt-Background | `--vc-bg` | `#1b1b1b` |
| Topbar-Background | `--vc-topbar-bg` | `#121212` |
| Hover-/Heading-Background | `--vc-heading-bg` | `rgba(42,42,42,0.6)` |
| Skeleton-Grundfarbe | `--vc-sk` | `#3a3a3a` |
| Switch-Track-BG | `--vc-switch-bg` | `rgba(42,42,42,0.6)` |
| Switch-Border | `--vc-switch-border` | `#353535` |
| Akzent/Primärfarbe | `--vc-primary` | `#e0e0e0` (identisch mit `--vc-text`) |
| Icon-Farbe default | — | `#a0a0a0` |
| Tabellen-Head-BG | `--vt-head-bg` | `#121212` |
| Logo-Box-BG | `--vt-logo-bg` | `#e0e0e0` |
| Row-Hover | `--vt-row-hover` | `rgba(42,42,42,0.6)` |
| Trend positiv | `--vt-up` | `#60d25d` |
| Trend negativ | `--vt-down` | `#d25d5d` |

> **Verbindlich: Es gibt kein Teal, kein Mint, keine eigene Markenfarbe als Akzent.**
> Die Akzent-/Primärfarbe ist **immer** die Fontprimärfarbe des jeweiligen Themes,
> also `#1f1f1b` im Light Mode und `#e0e0e0` im Dark Mode. Das gilt für **jedes**
> Element, das einen „aktiv", „ausgewählt", „primär" oder „hervorgehoben"-Zustand
> hat: Switches, Checkboxen, aktive Segmented-Buttons, Primär-Buttons (Goto,
> Filter-Submit), Fokus-Rahmen, aktive Tabs, Progress-Fills, Slider-Tracks.
> Der frühere Wert `#14b8a6` ist ersatzlos gestrichen und darf in keiner neuen
> Komponente mehr auftauchen.
>
> Auf dunklem Grund (z. B. Text auf einem Primär-Button) kehrt sich das Paar um:
> BG `--vc-text`, Text/Icon `#e0e0e0` im Light Mode bzw. `#1f1f1b` im Dark Mode
> (siehe Abschnitt 4, Primärfarben-Buttons).
>
> Davon **nicht** betroffen sind die semantischen Paletten: Citation-Type- und
> URL-Type-Farben (1a/1b), Trend-Farben `--vt-up`/`--vt-down` und die
> Sentiment-Ampel. Das sind Datenkodierungen, keine Akzente.

### Feste (nicht theme-abhängige) Farben
- Icon-Buttons default: `#6f6f6f` (light) / `#a0a0a0` (dark) — **nicht** über `--vc-muted`, sondern hart codiert
- Primär-Button-Hover-BG (Goto, Filter-Submit): `#585855` (light) / `#a0a0a0` (dark)
- Sentiment-Ampel: ≤25 `#D25D5D` · ≤40 `#D2865D` · ≤60 `#9E9E9E` · ≤75 `#9FD25D` · sonst `#60D25D` (gilt in beiden Themes gleich)
- Dark-Tooltip (Icon-Buttons): BG `#1f1f1b` (light Mode!) / `#f0f0f0` (dark Mode) — **invertiert** zum Theme, Text jeweils umgekehrt (`#ffffff` / `#1f1f1b`)

---

## 1a. Citation-Type-Farben

Verwendet in: `topcitations_dashboard.html`, `citations_combo_chart.html`, `url_classification.html`.
Bewusst **keine** Verwendung in `visibility_chart.html` (dort gibt es keine Citation-Type-Anzeige).

**Wichtiger struktureller Unterschied zu URL-Types (unten):** In `citations_combo_chart.html`
und `url_classification.html` ist der Akzentwert **in beiden Themes identisch** — nur der
Chip-Hintergrund wechselt (siehe Formel unten). Einzige Ausnahme: `topcitations_dashboard.html`
hat auf expliziten Wunsch eine **eigene, kräftigere Dark-Variante** (`CITE_COLOR_DARK`) bekommen
und ist damit die einzige Komponente mit echtem Light/Dark-Unterschied bei Citation Types.

| Citation Type | Standard (Combo Chart, URL Classification — beide Themes) | TopCitations Dashboard — Light | TopCitations Dashboard — Dark |
|---|---|---|---|
| Editorial | `#27a79b` | `#27a79b` | `#8bd0c8` |
| UGC / Community | `#34a1d1` | `#34a1d1` | `#91bfd4` |
| Knowledge-Base | `#797ad8` | `#797ad8` | `#abacd9` |
| Brand Platforms | `#bc69c9` | `#bc69c9` | `#c7a2cd` |
| Institutional | `#5e7eac` | `#5e7eac` | `#a0abba` |
| Competition | `#dd7e3e` | `#dd7e3e` | `#d6a685` |
| You | `#d35f73` | `#d35f73` | `#d39ca6` |
| Fallback (unbekannt) | `#6f737c` (`OTHER_LIGHT`) / `#a0a0a0` (`OTHER_DARK`) | — | — |

**Chip-Hintergrund-Formel** (Combo Chart & URL Classification, per `tagInfo()`/Badge-Logik):
```
Light:  rgba(farbe, 0.12)   — 12%-Tönung der Akzentfarbe
Dark:   #242424             — flach, KEINE Tönung
Border: keiner
```

**Chip-Maße** (`.tct-tag` in TopCitations, `.ut-badge` in URL Classification):
```
Höhe:          24px (TopCitations, kompakt) / 28px (URL Classification, groß)
Padding:       0 10px / 0 11px
Border-Radius: 7px / 8px
Font-Size:     12px / 14px
Font-Weight:   600
Gap:           6px / 7px  (Punkt → Label)
Punkt:         KEINER
```

> **Wichtige Unterscheidung, die überall gilt:**
> **Citation Types haben KEINEN Punkt** im Chip, nur farbigen Text auf getöntem Grund.
> **URL Types haben IMMER einen Punkt** (6×6px, `border-radius: 999px`, in der
> Akzentfarbe, davor 6px Gap). So sind die beiden Systeme auf einen Blick
> auseinanderzuhalten, auch wenn sie in derselben Tabelle nebeneinander stehen.

Aliase auf dem Weg zu diesen Keys (`CITE_ALIAS`/`citeName()`): `Brand_Platform`/`Brand Platform` →
`Brand Platforms`, `Knowledge_Base`/`Knowledge Base` → `Knowledge-Base`, `UGC_Community`/
`UGC Community` → `UGC / Community`.

---

## 1b. URL-Type-Farben

Verwendet in: `url_classification.html`, `url_type_chip.html` (eigenständige Komponente, **keine**
Citation-Type-Farben — ausschließlich URL-Types). Die **Chart-Fill-Variante** in
`topcitations_dashboard.html` (`URL_COLOR_CHART`/`URL_COLOR_DARK`) ist bewusst kräftiger für große
Flächen und weicht leicht von der Chip-Palette unten ab — beide sind unten dokumentiert.

Anders als Citation Types haben URL Types eine **echte** eigene Dark-Palette (`cDark`) in jeder
Komponente, nicht nur in TopCitations.

**Commercial / Brand** — warme Amber-/Bronzetöne

| Type | Chip Hell | Chip Dunkel |
|---|---|---|
| Homepage | `#b45309` | `#fbbf24` |
| Product / Service | `#c2683b` | `#fdba74` |
| Marketplace | `#9a5b2e` | `#fcae6f` |
| Company Info | `#a16207` | `#facc15` |

**Editorial** — kühles Türkis bis Blau

| Type | Chip Hell | Chip Dunkel |
|---|---|---|
| Article | `#047857` | `#6ee7b7` |
| Listicle | `#0e7490` | `#67e8f9` |
| Guide | `#2563eb` | `#93c5fd` |
| Comparison | `#4f46e5` | `#a5b4fc` |
| Review | `#6d28d9` | `#c4b5fd` |

**Reference / Community / Media** — Indigo bis Violett

| Type | Chip Hell | Chip Dunkel |
|---|---|---|
| Documentation | `#6d28d9` | `#c4b5fd` |
| Forum | `#9333ea` | `#d8b4fe` |
| Directory | `#a21caf` | `#f0abfc` |
| Video | `#7c3aed` | `#c4b5fd` |
| Social Post | `#8b5cf6` | `#ddd6fe` |

**Fallback**

| Type | Chip Hell | Chip Dunkel |
|---|---|---|
| Uncategorized (`other`) | `#6f737c` | `#a0a0a0` |

> Documentation und Review teilen zufällig denselben Wert (`#6d28d9`/`#c4b5fd`) — das ist
> beabsichtigt so im Code, kein Fehler.

**Chart-Fill-Variante** (`topcitations_dashboard.html`, `URL_COLOR_CHART`/`URL_COLOR_DARK` —
kräftiger, für Doughnut-/Bar-Slices statt kleiner Chips):

| Type | Chart Hell | Chart Dunkel |
|---|---|---|
| Homepage | `#c3753a` | `#fbbf24` |
| Product / Service | `#ce8662` | `#fdba74` |
| Marketplace | `#ae7c58` | `#fcae6f` |
| Company Info | `#b48139` | `#facc15` |
| Article | `#369379` | `#6ee7b7` |
| Listicle | `#3e90a6` | `#67e8f9` |
| Guide | `#5182ef` | `#93c5fd` |
| Comparison | `#726bea` | `#a5b4fc` |
| Review | `#8a53e1` | `#c4b5fd` |
| Documentation | `#8a53e1` | `#c4b5fd` |
| Forum | `#a95cee` | `#d8b4fe` |
| Directory | `#b549bf` | `#f0abfc` |
| Video | `#9661f1` | `#c4b5fd` |
| Social Post | `#a27df8` | `#ddd6fe` |
| Fallback | `#8c8f96` | `#a0a0a0` |

**Chip-Hintergrund-Formel** (identisch zur Citation-Type-Formel):
```
Light:  rgba(farbe, 0.12)
Dark:   #242424   — flach, KEINE Tönung
Border: keiner
```

**Chip-Maße** (`.ut-badge` in `url_classification.html` — groß, dotless):
```
Höhe:          28px
Padding:       0 11px
Border-Radius: 8px
Font-Size:     14px
Font-Weight:   600
Gap:           7px  (Punkt → Label)
```

**Chip-Maße** (`.utc-chip` in `url_type_chip.html` — eigenständige Komponente, kompakt, mit Punkt):
```
Höhe:          24px
Padding:       0 10px
Border-Radius: 7px
Font-Size:     12px
Font-Weight:   600
Gap:           6px
Punkt:         6×6px, border-radius 999px, in der Akzentfarbe
```
Farben und Hintergrund-Formel sind identisch zu oben — `url_type_chip.html` ist die **Quelle**,
aus der die Palette in `topcitations_dashboard.html` 1:1 übernommen wurde (siehe Kommentar dort:
"canonical URL type chip colours — copied 1:1 from the standalone URL Type chip component").

---

---

## 1c. Datums- und Zahlenformate

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

**Prozentwerte:** eine Nachkommastelle, immer ausgeschrieben — `23.8%`, nicht `23.81%`
oder `24%`. Fehlender Wert → `–`.

**Ganze Zahlen** (Counts): ohne Nachkommastellen, ohne Tausender-Trennzeichen — `1403`.

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
| Tabellen-Header-Label | 12px | 400 | `--vc-muted` | — |
| Tabellen-Zelle (Brand-Name) | 14px | 500 | `--vc-text` | ellipsis |
| Tabellen-Zahlen (`.vt-num`) | 14px | 500 | `--vc-text` | — |
| Trend-Chip | 13px | 600 | `--vt-up`/`--vt-down` | gap 4px zum Icon |
| Sentiment-Wert | 13px | 500 | `--vc-text` | — |
| Legend-Name (Line-Chart) | 12px | 500 | `--vc-text` | max-width + ellipsis |
| Dropdown-Head (SORT BY, COMPANIES) | 11px | 600 | `--vc-muted` | uppercase, letter-spacing 0.04em |
| Dropdown-Item | 13px – 13.5px | 500 | `--vc-text` | — |
| Filter-Item | 13px | normal | `--vc-text` | — |
| Filter-Counter (7/7) | 11px | 600 | `--vc-muted` | tabular-nums |
| Icon-Button-Tooltip | 12px | 500 | invertiert (s.o.) | line-height 1 |
| Switcher-Label (Day/Week/Month) | 12px | 500 | `--vc-muted` → `--vc-text` aktiv | — |
| Segmented-Switcher (uc-seg, Doughnut/Bar) | — (nur Icon) | — | `--uc-muted` → `--uc-text` aktiv | 14×14 Icon |

---

## 2a. Icons

**Alle Icons sind Feather Icons.** Keine gemischten Sets, kein Material, kein
Heroicons, kein Lucide. Inline als SVG eingebettet, nie als Font oder externes
Sprite, damit sie `currentColor` erben und im Dark Mode automatisch mitgehen.

Standard-Attribute, so wie Feather sie ausliefert:
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
```
- `stroke-width` liegt je nach Größe zwischen **2** und **2.2**. Kleine Icons
  (14px, Chevrons) vertragen 2.2, große bleiben bei 2. Ein Häkchen in einer
  Checkbox darf auf 3 gehen, sonst wirkt es zu zart.
- **Nie `fill` setzen**, immer `stroke: currentColor`. Farbe kommt ausschließlich
  über die `color`-Eigenschaft des Elternelements.
- Größen: 16×16 in Icon-Buttons, 14×14 in Trigger-Chevrons und Info-Icons,
  11×11 in Checkboxen.

---

## 3. Spacing / Gaps / Radius

| Kontext | Wert |
|---|---|
| Gap zwischen linkem/rechtem Chart-Unit | **16px** |
| Gap im gestapelten (mobilen) Modus | **32px** |
| Head-Höhe (über jeder Chart-Box) | 32px, `margin-bottom: 16px` |
| Head-Tools-Gap (Icon-Buttons untereinander) | 8px |
| Box-Border-Radius (Chart-Container) | **16px** — beide Boxen, volle Radien (kein "verschmolzener" Look mehr) |
| Tooltip-Border-Radius (Line-Chart) | **16px** |
| Tooltip-Border-Radius (Icon-Button, dunkel) | 6px |
| Dropdown-Menü-Radius | 12px (Filter) / 14px (Sort) |
| Icon-Button | 32×32px, radius 8px, SVG 16×16px |
| Switch-Track (Toggle) | 38×22px, radius 999px (voll rund), Knopf 18×18px |
| Gran-Switcher (Day/Week/Month) | Höhe 32px, Button-Radius 8px |
| Segmented-Switcher (Doughnut/Bar, uc-seg) | Höhe 24px, Radius 7px |
| Tabellen-Zeile Höhe | 55px (Gap-Row: 50px, wegen 4px Marge + 1px Border) |
| Tabellen-Head Höhe | 45px |
| Logo-Box | 24×24px, radius 8px, Bild 22×22px radius 7px (1px Padding) |
| Zellen-Padding | `0 16px 0 8px` |
| Filter-Item Padding | `7px 9px`, radius 8px |
| Filter-Dropdown Padding | 6px außen |
| Filter-Submit-Button | Höhe 34px, radius 9px, `margin-top: 6px` |

**Standard-Schatten (Dropdowns/Popovers):** `box-shadow: 0 10px 28px rgba(0,0,0,.14)`
**Tooltip-Schatten (dunkel, Icon-Buttons):** `box-shadow: 0 4px 14px rgba(0,0,0,0.18)`
**Tooltip-Schatten (Line-Chart, hell):** `box-shadow: 0 4px 14px rgba(0,0,0,.10)` · **(dunkel):** `rgba(0,0,0,.25)`

---

## 4. Icon-Buttons

```css
.iconbtn {
  width: 32px; height: 32px; border: 0; border-radius: 8px;
  background: transparent; color: #6f6f6f; cursor: pointer; padding: 0;
}
[data-theme="dark"] .iconbtn { color: #a0a0a0; }
.iconbtn:hover { color: var(--vc-text); }              /* WICHTIG: braucht eigene dark-mode-hover-Regel! */
[data-theme="dark"] .iconbtn:hover { color: var(--vc-text); }
.iconbtn svg { width: 16px; height: 16px; display: block; }
```

⚠️ **Bekannte Falle:** Eine simple `.iconbtn:hover { color: var(--vc-text); }`-Regel reicht **nicht** — die Dark-Mode-Grundfarben-Regel (`[data-theme="dark"] .iconbtn`) hat höhere CSS-Spezifität als ein einfaches `:hover`, und überschreibt es lautlos. Immer eine **explizite** `[data-theme="dark"] .iconbtn:hover`-Regel danebensetzen. Derselbe Trick gilt für **jeden** Zustand, der im Dark Mode „verschwindet": Switch-`is-on`, Filter-`is-checked`, etc. — immer eine theme-gescopte Version der Zustands-Klasse ergänzen.

### Primärfarben-Buttons (Goto, Filter-Submit)
```css
.goto { background: var(--vc-text) !important; color: #e0e0e0; }
[data-theme="dark"] .goto { color: #1f1f1b; }
.goto:hover, .filter-submit:hover { background: #585855 !important; }
[data-theme="dark"] .goto:hover, [data-theme="dark"] .filter-submit:hover { background: #a0a0a0 !important; }
```
Regel: **nur der Background ändert sich beim Hover**, nie die Icon-/Textfarbe.

---

## 5. Switcher & Toggles

### Segmentierter Switcher (Day/Week/Month, Doughnut/Bar)
```css
.gran { display: inline-flex; background: var(--vc-switch-bg); border-radius: 8px; height: 32px; }
.gran-btn { height: 32px; padding: 0 12px; border: 1px solid transparent; border-radius: 8px;
  background: transparent; color: var(--vc-muted); font-size: 12px; font-weight: 500; }
.gran-btn:hover { color: var(--vc-text); }
.gran-btn.is-active { background: #ffffff; color: var(--vc-text); border-color: var(--vc-switch-border); }
[data-theme="dark"] .gran-btn.is-active { background: #121212; border-color: #353535; }
```
Kleinere Variante (Segmented Icon-Switcher, z.B. Doughnut/Bar in Citations Overview): Höhe 24px statt 32px, Radius 7px statt 8px, Icons 14×14.

### An/Aus-Switch (z.B. „Descending" im Sort-Dropdown)
```css
.switch { width: 38px; height: 22px; border-radius: 999px; background: var(--vc-border); }
[data-theme="dark"] .switch { background: rgba(42,42,42,0.6); }
.switch::after { content:""; position:absolute; top:2px; left:2px; width:18px; height:18px;
  border-radius:999px; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.2); transition: transform 160ms ease; }
.switch.is-on { background: var(--vc-text); }
.switch.is-on::after { transform: translateX(16px); }
[data-theme="dark"] .switch::after { background: #e0e0e0; }
[data-theme="dark"] .switch.is-on { background: var(--vc-text); }   /* Spezifitäts-Fix, s.o. */
[data-theme="dark"] .switch.is-on::after { background: #1f1f1b; }
```
Kein Mint/Teal irgendwo in Switches oder Checkboxen — immer `--vc-text` als „aktiv"-Farbe
(siehe die verbindliche Akzentfarben-Regel in Abschnitt 1).

---

## 6. Dropdowns / Popover-Menüs

**Alle Dropdowns nutzen dieselbe Appear-Animation** (opacity + leichtes Scale, kein `display:none`-Hard-Toggle):
```css
.menu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 60;
  background: var(--vc-bg); border: 1px solid var(--vc-border); border-radius: 12px;
  box-shadow: 0 10px 28px rgba(0,0,0,.14); padding: 6px;
  opacity: 0; transform: translateY(-4px) scale(0.985); pointer-events: none;
  transition: opacity 140ms ease, transform 140ms ease;
}
.wrap.is-open .menu { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
.wrap.is-open .trigger-btn { color: var(--vc-text); background: var(--vc-heading-bg); }
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
.pop-opt { display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:9px 10px; border-radius:9px; font-size:13.5px; font-weight:500; color:var(--vc-text); }
.pop-opt:hover { background: var(--vc-heading-bg); }
```
Divider zwischen Gruppen: `height:1px; background:var(--vc-border); margin:7px 4px;`

### Filter-/Auswahl-Item (Checkbox-Liste)
```css
.filter-item { display:flex; align-items:center; gap:10px; padding:7px 9px; border-radius:8px; font-size:13px; }
.filter-item:hover { background: var(--vc-heading-bg); }
.filter-item.is-disabled { opacity: .4; cursor: default; }   /* NIE cursor:not-allowed verwenden */
.filter-check { width:16px; height:16px; border-radius:5px; border:1.5px solid var(--vc-border); color:#fff; }
.filter-item.is-checked .filter-check { background: var(--vc-text); border-color: var(--vc-text); }
[data-theme="dark"] .filter-item.is-checked .filter-check { color: #1f1f1b; }
```

---

---

## 6a. Dropdown-Trigger: Hover- und Open-States (verbindlich)

Gilt für **jeden** Dropdown-Auslöser, egal ob Icon-Button oder beschrifteter Container.

**Elemente MIT Rahmen** (beschriftete Container, Inputs, Karten):
```
Ruhezustand   bg: transparent          border: var(--vc-border)        text: var(--vc-text)
Hover         bg: var(--vc-hover-bg)   border: var(--vc-hover-border)
Geöffnet      bg: TRANSPARENT          border: var(--vc-hover-border)
```

> **Der Geöffnet-Zustand ist NICHT der Hover-Zustand.** Geöffnet ändert **ausschließlich
> die Rahmenfarbe**, der Hintergrund bleibt transparent. Sonst sieht ein offenes Dropdown
> aus, als läge der Mauszeiger darauf, und man verliert die Rückmeldung beim Überfahren
> des bereits geöffneten Auslösers.
```
--vc-hover-bg:     #f5f5f5   (hell)  /  rgba(42,42,42,0.6)  (dunkel)
--vc-hover-border: #6f6f6f   (hell)  /  #707070             (dunkel)
```

**Elemente OHNE Rahmen** (Icon-Buttons) — nur der Hintergrund:
```
Ruhezustand   bg: transparent          icon: #6f6f6f / #a0a0a0
Hover         bg: var(--vc-hover-bg)   icon: var(--vc-text)
Geöffnet      bg: var(--vc-hover-bg)   icon: var(--vc-text)
```

Ein Chevron **rotiert nicht** beim Öffnen.

### Aktiver Filter: gleiche Optik wie „Geöffnet"

Ein Trigger, dessen Filter **angewendet** ist, trägt exakt dieselbe Darstellung wie
ein geöffnetes Dropdown:

```
Aktiv (Filter angewendet)   bg: TRANSPARENT   border: var(--vc-hover-border)   text: var(--vc-text)
```

Das ist Absicht und kein Zufall: „dieses Element tut gerade etwas" und „dieses
Element ist offen" haben dasselbe visuelle Gewicht, beide heißen *hier hinsehen*.
Ein separates Zähl-Badge oder eine Akzentfarbe braucht es dafür nicht, das Label
nennt die Auswahl ohnehin.

Umgesetzt als eigene Klasse `.is-active` am Wrapper, gesetzt aus derselben
Funktion, die auch das Label schreibt:
```css
.x-filter.is-active .x-filter-btn { background: transparent; color: var(--vc-text); border-color: var(--vc-hover-border); }
.x-filter.is-active .x-filter-btn-chev { color: var(--vc-text); }
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

Beschriftete Container (z. B. „All Citation Types", „All Brands"):
```
Höhe 32px, Padding 0 10px, Radius 8px, Border 1px solid var(--vc-border)
Font 12px / 500, Gap 8px zum Chevron, Chevron 14×14 in var(--vc-muted)
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
.tip {
  position: fixed; z-index: 2147483000;   /* an <body> gehängt, damit nichts es clippen kann */
  height: 24px; padding: 0 9px; border-radius: 6px;
  font-size: 12px; font-weight: 500; line-height: 1;
  box-shadow: 0 4px 14px rgba(0,0,0,0.18);
  opacity: 0; transform: translateY(4px); transition: opacity .14s ease, transform .14s ease;
}
.tip.show { opacity: 1; transform: translateY(0); }
```
Farben: BG `#1f1f1b` / Text `#ffffff` — **in beiden Themes identisch, nicht invertieren.**
Tooltips schweben über der Seite und liegen nicht in der Oberfläche; eine Invertierung
lässt sie im Dark Mode wie eine fremde Komponente wirken.

Erscheint nach **60ms** Hover-Delay (bewusst kurz gehalten, „fast ohne Delay" wie Mira),
verschwindet sofort bei Klick/Mousedown.

Die Farben müssen **literal** gesetzt werden, nicht über `var(--vc-text)`: Der Tooltip hängt
an `<body>` und damit außerhalb des Komponenten-Roots, wo die CSS-Variablen nicht definiert
sind. Genau daran ist der Explainer-Tooltip einmal unsichtbar geblieben.

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

**B) Line-Chart-Datenpunkt-Tooltip** (folgt dem Cursor, größer, mit Zeilen)
- Radius **16px**, Padding `10px 12px`
- Light Mode: `background:#ffffff; border:1px solid #e0e2e6; box-shadow:0 4px 14px rgba(0,0,0,.10)`
- Dark Mode: `background:#121212; kein Border; box-shadow:0 4px 14px rgba(0,0,0,.25)`
- Text: Titel `--vc-muted`-Ton (`#6f737c` hell / `#8a8a8a` dunkel), Werte `--vc-text`-Ton
- Folgt der Maus mit Easing (`FOLLOW = 0.18` pro Frame, ca. 280ms „Trägheit")

**C) Explainer-Tooltip** (Spaltenüberschriften in den Tabellen, erklärt eine Metrik)

Zweiteiliger Aufbau: oben ein helles Panel, das die Metrik so zeigt, wie sie in der Tabelle
aussieht, darunter Überschrift und ein Satz Erklärung auf dunklem Grund.

```css
.explain {
  position: fixed; z-index: 2147483001; width: 248px; padding: 8px;
  border-radius: 14px; background: #1f1f1b;          /* literal, siehe oben */
  box-shadow: 0 12px 32px rgba(0,0,0,.28);
  opacity: 0; transform: translateY(-4px);
  transition: opacity .14s ease, transform .14s ease;
}
.explain.is-on { opacity: 1; transform: translateY(0); }

.explain-vis {          /* helles Panel mit der visuellen Darstellung */
  background: #ffffff; border-radius: 9px; padding: 11px 12px;
  display: flex; flex-direction: column; gap: 7px; align-items: flex-start;
  margin-bottom: 9px; min-height: 46px; justify-content: center;
}
.explain-h { font-size: 14.5px; font-weight: 600; line-height: 1.2; padding: 0 3px;
             margin-bottom: 4px; color: #ffffff; }
.explain-t { font-size: 13.5px; font-weight: 400; line-height: 1.5; padding: 0 3px;
             color: rgba(255,255,255,0.68); }
```

**Zacken**, zeigt immer auf das auslösende Info-Icon:
```css
.explain::before {
  content: ""; position: absolute; top: -10px; left: var(--caret, 50%);
  transform: translateX(-50%);
  border-left: 12px solid transparent; border-right: 12px solid transparent;
  border-bottom: 11px solid #1f1f1b;
}
.explain.is-flipped::before {    /* nach oben geklappt, wenn unten kein Platz ist */
  top: auto; bottom: -10px;
  border-bottom: 0; border-top: 11px solid #1f1f1b;
}
```
`--caret` wird beim Öffnen per JS auf die Icon-Mitte gesetzt, geklemmt auf
`14px … Breite-14px`. Ohne das zeigt der Zacken ins Leere, sobald die Box am
Bildschirmrand seitlich verschoben wurde.

**Auslöser:** Info-Icon 14×14 in `var(--vc-third)`, `opacity: 0`, erscheint beim Hover über
die Spaltenüberschrift. **Kein `cursor: help`** — der Cursor bleibt wie im Rest der Zeile.

---

## 8. Tabelle (Top Brands)

```css
.thead, .row { display: grid; grid-template-columns: 44px minmax(120px,1fr) 22% 20% 20%; }
.thead { height: 45px; background: var(--vt-head-bg); }
.row   { height: 55px; cursor: pointer; transition: background 120ms ease; }
.row:hover { background: var(--vt-row-hover); }
.td { padding: 0 16px 0 8px; gap: 12px; border-right/-bottom: 1px solid var(--vc-border); }
```
- Brand-Spalte hat eine **harte Mindestbreite von 120px** — schrumpft nie weiter, egal wie eng der Rest wird.
- Logo-Box 24×24px (radius 8, 1px Padding), Bild 22×22px (radius 7).
- Trend-Chip: Icon 16×16 + Text, `gap:4px`, Farbe je nach Richtung/Invertierung (`--vt-up`/`--vt-down`).
- Sentiment-Chip: `height:24px; padding:0 6px; border:1px solid var(--vc-border); radius:6px;` + 6×6px Dot (radius 2, Ampel-Farbe).
- Eigene Zeile für „Own Brand außerhalb Top 7": 4px Extra-Marge + 1px Top-Border, nur wenn `position > 7`.

**Responsive Degradierung** (in dieser Reihenfolge, je enger):
1. Trend-Chips ausblenden — **nicht** über einen Breiten-Schwellwert, sondern per echter Messung: sobald der Trend-Chip weniger als **8px** Abstand zum tatsächlichen Zellenrand hat (`getBoundingClientRect()`-Vergleich, nicht `scrollWidth`/`clientWidth` — letzteres erkennt keinen Slack).
2. Sentiment-Spalte ausblenden — nur wenn bereits gestapelt (`is-narrow`) **und** Root-Breite < 700px.
3. Ranking-Spalte ausblenden — nur wenn gestapelt **und** Root-Breite < 500px.

---

## 9. Skeleton / Loading

- Pulsierende Skeleton-Blöcke: `background: var(--vc-sk)`, `@keyframes votpulse { 0%,100%{opacity:1} 50%{opacity:.45} }`
- Line-Chart-Skeleton zusätzlich mit Shimmer-Sweep: ein `::after`-Gradient-Streifen, der per `translateX(-100% → 100%)` über 1200ms linear durchläuft
- Zwei unabhängige Processing-Flags pro Element (`data-processing` + `data-processing2`) — Skeleton zeigt sich, sobald **einer** von beiden `"yes"` ist. So lassen sich Chart- und Tabellen-Ladezustand getrennt an unterschiedliche Bubble-States binden.

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

## 12. Historische Referenz: `quick_actions.html` (Mira-Familie, Präfix `am-`, noch NICHT migriert)

> Dieser Abschnitt dokumentiert eine Komponente aus der Pre-Core-Ära, die noch in `to-migrate/` liegt und noch kein `core.js`/`core.css` nutzt. Dient als Referenz beim zukünftigen Umbau, gilt nicht für neue Tabellen-Komponenten.

Verwandt, aber mit eigenen Werten — falls du dort auch mal was anpasst:
- Border: `#e5e7eb` (statt `#e0e2e6`)
- Soft-Backgrounds: `#f7f8fa` / `#f3f4f6` (statt `#f5f5f5`)
- Card-Radius: 16px (Popover-Karte), kleinere Elemente 5–10px
- Icon-Kreis (Avatar): radius 999px, 20×20 oder 30×30px
- Scrollbar-Thumb: `var(--am-border-strong)`, radius 999px, 3px „Border" in Card-Farbe (erzeugt einen schwebenden Thumb-Look)
- Trend-Farben identisch zum Hauptsystem: `#60d25d` / `#d25d5d` im Dark Mode

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
.up-sort-menu { position: absolute; top: calc(100% + 8px); right: 0; z-index: 60;
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
- **Clear-X** im Suchfeld (Feather-X), erscheint via `:not(:placeholder-shown) +`, in
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

## 16. Suchfeld (Notion-Style) + Mobile

- **Lupe links, dann randloses, transparentes Feld** (kein Rahmen), Placeholder in dritter
  Fontfarbe (`--vc-third`). Clear-X-Platz **immer reserviert** (`visibility`, nicht
  `display`), aktive Lupe in Primärfarbe ohne Hintergrund.
- **Kopf-Reserve:** Die geöffnete Suchbreite (`SEARCH_OPEN_WIDTH`, ~202px) wird im
  Gap-Budget **auch bei geschlossener Suche** eingerechnet, damit das Aufklappen nie
  überläuft. `fitToolbar()` **nicht** beim Toggle aufrufen (läuft mitten in der Transition).
- **Mobile-Takeover:** Unter einer Mobile-Breite (`MOBILE_SEARCH_MAX`, ~640px) übernimmt die
  offene Suche die ganze Toolbar-Zeile: Lupe links, Feld voll breit, X rechts (schließt +
  reset), Heading und Count ausgeblendet (`is-searchtakeover`). Solange aktiv, pausiert
  `fitToolbar`; beim Verlassen einmal neu messen.
- **Aktiv (offen):** Eingabetext und Placeholder werden einen Tick größer/fetter
  (`.<pfx>-search.is-open .<pfx>-search-input { font-size: 14px; font-weight: 500; }`).
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

## 17. Brand-Logo-Stack in Zeilen

Überlappende Logo-Kreise (`… + …{ margin-left: -6px }`), Fill = `--vt-logo-bg` (im Dark
hell, damit Favicons Kontrast haben), 2px-Ring in Zeilenfarbe erzeugt die Lücke.

Hover-Regel (Flicker-frei):

- **Gehovertes Element + alles danach rücken nach rechts**, alles davor bleibt stehen
  (das erste Logo darf nie nach links wandern). Gehovertes `translateX(8px)`, folgende
  `translateX(16px)` → nur die zwei Nachbar-Lücken öffnen, der Rest behält seinen Abstand.
- **Lift:** gehovertes zusätzlich `translateY(-3px)` + `z-index` nach vorn.
- **Kein Flicker:** ein **hover-only** `::before` vergrößert den Hit-Bereich über die
  Ursprungsposition, damit das Verschieben das Element nicht unter dem Cursor wegzieht.
- `transition: transform .16s ease` auch am „+X" (`…-stack-more`), damit es mitzieht.

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
  background: var(--vc-text); color:#e0e0e0;            /* Dark-Mode: color:#1f1f1b */
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

- **Seiten-Hintergrund als eigene Variable:** `--<pfx>-surface` (Light `#ffffff`, Dark
  `#121212`) für Kopf-Hintergrund + Maske. Nicht `--vc-bg` (das ist die Kartenfarbe
  `#1b1b1b` im Dark) — sonst ist der Bereich über/hinter der Tabelle sichtbar zu hell.
- **Maske +16px:** Die opake Maske über dem Header (`…-head::before`) bekommt
  `height: calc(var(--<pfx>-sticky-top) + 16px)`, damit beim Scrollen oben keine
  Zeilenkante durchlugt.
- **Ecken oben:** Die Radial-Eckstücke, die das Dreieck außerhalb der 16px-Rundung füllen,
  nutzen `var(--<pfx>-surface)` (Seitenfarbe), **nicht** `--vc-bg` — sonst guckt im Dark ein
  helleres Dreieck raus.

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
- **Ausrichtung:** Text linksbündig, Header nach Spaltentyp ausrichten, nie zentriert.
  Quantitative Zahlen (Beträge, Maße) idealerweise rechtsbündig; bei **Prozent + Trend-Badge
  in einer Zelle** ist links vertretbar (der Rechtsbündig-Gewinn ist bei Werten ähnlicher
  Größenordnung klein).
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

### Was der Core stellt

| Bereich | Aufruf |
|---|---|
| Linien-Chart (Plugins, Tooltip, Skeleton, Größen-Poll, Verify, Legende, Watermark) | `UC.makeLine({wrap, canvas, legend, isDark, isOwner, gran})` |
| Doughnut + Bars hinter einem Controller | `UC.makeTypeChart({body, isDark, isOwner, mode, total, centerLabel})` |
| Chart-Daten aufbereiten / Farben | `UC.prepTypeData`, `UC.typeColor`, `UC.CITE_COLOR_DARK`, `UC.barIsLight` |
| Button-Tooltips (`[data-tip]`, `[data-brandtip]`) | `UC.makeTooltips(root, getIsDark)` |
| Dropdowns | `UC.makePopover({wrap, menu, opener, onClose, group})` |
| Spalten: Sichtbarkeit, Breiten, Resize, Cols-Menü | `UC.makeColumns({root, state, columns, storePrefix, instanceId, …})` |
| Pagination | `UC.makePager({root, state, onChange})` |
| Header-Sortierung mit Klick-Zyklus | `UC.makeHeadSort({root, state, cycles, defaultSort, trendField, onSort})` |
| Suche (Slide-out, Debounce, requestId-Schutz) | `UC.makeSearch({root, box, input, state, prefix, onRender, onFire, …})` |
| Skelett-Zeilen, Trend-Chip, Leer-Schonfrist, Spalten-Erklärer | `UC.skeletonRows`, `UC.trendChip`, `UC.makeEmptyGrace`, `UC.makeExplain` |
| Bubble-Klempnerei: Root-Registry, iframe-Forwarder, Wheel, Init-Kaskade, Stub-Replay | `UC.makeMount({rootClass, ctrlProp, resolveLocal, queue, initRoot, api, forwardShape})` |

CSS dazu kommt aus `core.css`: `.up-root`, `.up-head*`, `.up-iconbtn`, `.up-thead/.up-row/.up-th/.up-td`,
`.up-pop-*`, `.up-filter-*`, `.up-line-*`, `.up-legend`, `.up-donut-*`, `.up-bars/.up-bar-*`,
`.up-trend`, `.up-logo-box`, `.up-row-goto`, `.up-tag`, `.up-tip`, `.up-explain`, `.up-empty*`.

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
border-radius: 18px;
box-shadow: 0 20px 48px rgba(0,0,0,.22);
```
Dark Mode: `--up-surface: #1b1b1b` (Karten-Hintergrund).

**Kopfzeile** (`.up-topicmodal-head`, `align-items:flex-start` wegen des zweizeiligen Headings):
- Heading: **22px, Weight 500**.
- Optionale Subheading direkt darunter (eigener `.up-topicmodal-heading`-Wrapper mit **8px Gap**
  zwischen Heading und Subheading): **16px, Weight 400, Drittfarbe** (`--vc-third`). Nicht jedes
  Popup braucht eine — das Token existiert, damit ein künftiges nicht wieder Größe/Farbe/Gewicht
  neu erfindet.
- Close-Button: **32×32px** Container, **16×16px** Icon, `margin: -8px -8px 0 0` — zieht den
  Button trotz der 16px Karten-Padding näher an die wirkliche Ecke, statt sichtbar "freizuschweben".

**Feld-Headings** (z. B. "Name", "Appearance" innerhalb der Karte): **14px, Weight 500,
Primärfarbe** (`--vc-text`, NICHT Mutedfarbe — der User liest diese Labels bei jedem Öffnen).
**8px Gap** zwischen Feld-Heading und dem Feldinhalt darunter.

**Alle Elemente untereinander** (Header-Block, jedes Feld, Footer): **32px Gap** — getragen vom
Card-Flex-Container selbst, nicht von individuellem Padding pro Block.

---

*Stand: Werte 1:1 aus dem aktuellen Code der vier Dateien extrahiert (nicht aus Erinnerung). Bei Widersprüchen zwischen den Dateien wurde die neueste/zuletzt gefixte Version als Standard genommen.*

### Interaktive Chips (`.up-chiphover`)

Jeder farbige Chip/Tag, der **klickbar** ist, bekommt zusaetzlich `.up-chiphover`. Im Ruhezustand
behaelt der Chip seine eigene Tint-Farbe; beim Hover faellt er auf die neutrale Flaeche mit dem
geteilten Hover-Border zurueck, damit "das ist ein Control" ueberall gleich liest — unabhaengig
davon, welche Farbe das Tag zufaellig traegt.

```
light:  background #f5f5f5 · border #6f6f6f · color #1f1f1b · box-shadow none
dark:   background #2a2a2a · border #707070 · color #e0e0e0 · box-shadow none
```

Die Dark-Regel matcht sowohl `.up-root[data-theme="dark"]` als auch ein `[data-theme="dark"]`
direkt auf der Flaeche — Chips koennen auch ausserhalb des Komponenten-Roots leben (z.B. in der
Bulk-Action-Bar, die an `document.body` haengt).

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
ein reines `opacity`-Fade, das den Platz permanent reservieren würde). Layout-Detail: zwei
Geschwister mit je `margin-left:auto`, von denen zur Laufzeit meist nur eines eine reale Breite
hat, funktionieren problemlos — ein `width:0`-Element trägt zur "Schub"-Rechnung der Flexbox
nichts bei, das andere übernimmt automatisch die volle Rolle.

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
