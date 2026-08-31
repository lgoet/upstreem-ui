# upstreem-ui

Geteilte UI-Bausteine für die Bubble-App, gehostet über jsDelivr (GitHub-CDN).
Ein Ort für den geteilten Core, pro Komponente eine schlanke Datei. Änderungen
wirken nach einem Push + Purge sofort auf allen Platzierungen, kein Neu-Einfügen
in Bubble mehr.

> **Vor dem Bauen einer neuen Komponente zuerst `STYLEGUIDE.md` lesen** — dort
> stehen alle Konventionen (Prefixe, Farben, Muster) und die Checkliste.

## Struktur

```
upstreem-ui/
├─ README.md
├─ STYLEGUIDE.md              Konventionen + Checkliste. Zuerst lesen.
├─ core.css / core.js         ausgeliefert (CDN) — geteiltes Styling + window.UpstreemCore
├─ urls-table.css/.js         ausgeliefert (CDN) — Prefix uut-
├─ domains-table.css/.js      ausgeliefert (CDN) — Prefix udt-
├─ prompts-table.css/.js      ausgeliefert (CDN) — Prefix upt-
├─ visibility-chart.css/.js   ausgeliefert (CDN) — Prefix vot-
├─ topcitations-dashboard.css/.js  ausgeliefert (CDN) — Prefix tcd-
├─ citations-combo-chart.css/.js   ausgeliefert (CDN) — Prefix combo-
├─ topics-manager.css/.js     ausgeliefert (CDN) — Prefix utm-
├─ teams.css/.js              ausgeliefert (CDN) — Prefix uts-. Seitenkopf UND Tabelle in
│                             EINEM Element: auf die Teams-Seite kommt KEIN eigenes
│                             page-headers/*-Element dazu.
├─ quick-actions.css/.js      ausgeliefert (CDN) — Prefix mqa- (eigenes Token-Set, siehe unten)
├─ landing-hero.css/.js       ausgeliefert (CDN) — Prefix ulh-, für die Landingpage in Framer.
│                             Setzt die ECHTEN Komponenten in ein Fenster; das Markup dafür
│                             erzeugt .landing_markup.py aus den bubble/-Vorlagen.
├─ framer/landing_hero.html   Einbau-Schnipsel für Framer (NICHT ausgeliefert)
└─ bubble/                    Loader-Vorlagen für Bubble (NICHT ausgeliefert)
   ├─ <name>_bubble.html      eine pro Komponente — Markup + data-* + CDN-Includes
   ├─ page_header_preload.html   optionale Asset-Vorwärmung fürs Bubble-Page-Header-Script
   ├─ STATISCHES_MARKUP_PFLICHT.md   Regel: kein dynamischer Bubble-Ausdruck im Komponenten-Markup
   └─ diagnostics/            Konsolen-Snippets für Perf-Untersuchungen, siehe dortige README
```

- **Root** (`core.*`, `<komponente>.*`): wird von jsDelivr ausgeliefert; der
  Pfad muss zur CDN-URL passen (`@main/core.css` = Root). Prefixe: geteilt `up-`,
  komponenten-spezifisch `uut-` / `udt-` / `upt-` / `vot-` / `tcd-` / `combo-` / `utm-` / `uts-`.
  `quick-actions` ist die eine Ausnahme (siehe unten).
- **`core.js`** stellt `window.UpstreemCore` (kurz `UC`) bereit: Farbtabellen, Utils, Icons,
  `resolveBubbleFn`, Stores, `watchRoots`/`makeMount`, und die Kits `makeTooltips`, `makeFire`,
  `makePortal`, `placeMenu`, `makeSticky`, `makeSearch`, die Chart-Kits (`makeLine`, Doughnut/Bar),
  `makeTopicModal`, `unclipAncestors`. Neue Komponenten bauen **gegen diese Kits**, nicht daneben
  — siehe STYLEGUIDE §25.
- **`bubble/`**: die HTML-Schnipsel, die ins jeweilige Bubble-HTML-Element kommen (Markup +
  `data-*` + CDN-Includes). Werden nicht ausgeliefert, sind nur Kopiervorlagen.

### Ausnahme: `quick-actions`

Singleton (`#mira-quick-actions`, ein Cmd-K-Command-Menü), keine per-Instanz-`.up-root`-Komponente
wie die anderen acht. Lädt bewusst **kein** `core.css`/`core.js` — bringt ihr eigenes komplettes
`--am-*`-Token-Set mit, das schon vor der Migration in diese CDN-Struktur existierte. Details in
STYLEGUIDE §12.

## Wie es zusammenspielt

Im Bubble-HTML-Element steht nur der Loader (`bubble/<name>_bubble.html`): das
statische Markup mit den dynamischen `data-*`-Bindungen und die CDN-Includes.
Reihenfolge ist wichtig — Core **vor** Komponente (außer bei `quick-actions`,
das lädt nur sich selbst):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@main/core.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@main/urls-table.css">
...markup mit data-* ...
<script src="https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@main/core.js"></script>
<script src="https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@main/urls-table.js"></script>
```

Jeder `bubble/<name>_bubble.html`-Loader bringt am eigenen Fuß ein Dedupe-Script mit
(`window.__upAssetsLoaded`-Registry), das verhindert, dass Bubbles Re-Render des Reusables
dieselben `<link>`/`<script>`-Tags immer wieder anhängt — siehe STYLEGUIDE §26/§41.

Das Markup + die `data-*`-Attribute bleiben in Bubble, weil dort die dynamischen
Bindungen dranhängen. CSS und JS liegen im Repo und kommen per CDN. **Kein dynamischer
Bubble-Ausdruck im Komponenten-Markup** — Details: `bubble/STATISCHES_MARKUP_PFLICHT.md`.

## Ändern & ausliefern

1. Datei im Repo auf `main` bearbeiten / hochladen, „Commit changes".
2. Passende Purge-URL einmal im Browser aufrufen (sofort live; ohne Purge zieht
   `@main` von selbst nach ~12 h), z.B.:
   ```
   https://purge.jsdelivr.net/gh/lgoet/upstreem-ui@main/core.css
   https://purge.jsdelivr.net/gh/lgoet/upstreem-ui@main/core.js
   https://purge.jsdelivr.net/gh/lgoet/upstreem-ui@main/urls-table.css
   https://purge.jsdelivr.net/gh/lgoet/upstreem-ui@main/urls-table.js
   ```
3. Seite hart neu laden (Strg+Shift+R).

Wenn es stabil ist, statt `@main` einen festen Versions-Tag verwenden
(`@1.0.0`) und nur bei bewussten Updates hochziehen — dann ohne Purge. Aktuell verdrahtet:
`data-cdn-pin` auf jeder Komponente pinnt sie auf einen festen Commit-Hash statt `@main`,
damit ein Fix erst live geht, wenn der User den Pin aktualisiert — siehe STYLEGUIDE §26.

## Bubble-Verdrahtung (Beispiel URLs-Tabelle)

Auf dem `<div class="up-root uut-root">` die `data-*` binden:

- `data-instance` — **eindeutig pro Platzierung** (z.B. `ROOTID_[dynamischer Wert]`).
  Mehrere Platzierungen mit derselben id kollidieren im Speicher.
- `data-isdark` — `"yes"`/`"no"` für Dark-Mode.
- `data-brand-name`, `data-brand-logo` — die Hauptmarke (steuert den „… mentioned"-Toggle; leer = Toggle unsichtbar).
- `data-sticky-top` — Pixel-Offset für den Sticky-Header (0 / `"no"` = aus).
- `data-cdn-pin` — Commit-Hash für die CDN-URLs.
- Die `data-*-fn` — Namen der „JavaScript to Bubble"-Toolbox-Elemente.

### Event-Vertrag

| UI-Element                        | Bubble-Funktion   | Payload                       | Regex zum Auslesen                         |
|-----------------------------------|-------------------|-------------------------------|--------------------------------------------|
| Suche                             | `uutSearch`       | `{"q":"..."}`                 | `(?<="q":")[^"]*`                          |
| Sortierung                        | `uutSort`         | `{"field":"...","dir":"..."}` | —                                          |
| Filter (Typen)                    | `uutFilter`       | `{...}`                       | —                                          |
| Paginierung                       | `uutPage`         | `{"page":N,"size":N}`         | —                                          |
| Zeilen-Klick                      | `uutRowClick`     | `{...}`                       | —                                          |
| **Dropdown „Brands mentioned"**   | `uutBrand`        | `{"brand_mentioned":"id1,id2"}` | `(?<="brand_mentioned":")[^"]*`          |
| **Toggle „Marke mentioned"**      | `uutMentioned`    | `{"brands":"yes"}`            | `(?<="brands":")[^"]*`                     |

Jede andere Komponente hat ihren eigenen, analogen Event-Vertrag — vollständig dokumentiert im
Kopf ihres jeweiligen `bubble/<name>_bubble.html` und in STYLEGUIDE §13.

Daten rein (aus Bubble aufrufen):

```js
renderUrlsTable({ instanceId: "...", rows: [...], totalCount: 123 });
setUrlsTableBrands("...", [ { id, name, logo } ]);   // volle Markenliste (nicht gefiltert!)
setUrlsTableLoading("...", "yes");
resetUrlsTable("...");
```

Hinweis: `setUrlsTableBrands` mit einer **leeren** Liste wird ignoriert (die
bestehende Auswahl bleibt). Die Markenliste sollte immer alle verfügbaren Marken
liefern, unabhängig vom aktiven Filter.

## Neue Komponente hinzufügen

1. `STYLEGUIDE.md` §25 lesen — "gegen die Kits bauen, nicht daneben".
2. Eine bestehende Komponente (z.B. `urls-table.js`) als Vorlage nehmen: gleiches
   Boot-Stub-/`UC.makeMount`-Skelett, gleicher Event-Vertrag-Stil.
3. Root-Dateien `<name>.css` (eigener Prefix) + `<name>.js` (nutzt `UpstreemCore`) bauen.
4. Einen Loader `bubble/<name>_bubble.html` (Markup + `data-*` + CDN-Includes + Dedupe-Script)
   anlegen — bestehenden Loader kopieren, nicht neu erfinden.
5. Lokal mit einem Test-Harness (Markup ohne CDN-Loader, relative `<script>`-Tags, per
   `python3 -m http.server` serviert) gegen die STYLEGUIDE-§25-Checkliste verifizieren, bevor
   committet wird.

## Bekannte offene Punkte

- Etwas Duplikation zwischen den Komponenten ist noch nicht in `core.js` extrahiert (Kandidat für
  ein künftiges Aufräumen, keine akute Baustelle).
- `bubble/diagnostics/_diagnose_rpc_to_render.js`: ein einzelner beobachteter Fall (Prompts-Table,
  ~557ms zwischen Daten-da und Loading=no) wirkte wie ein Ausnahmefall, kein systemisches Muster —
  Tool liegt bereit, falls es wiederkehrt.
