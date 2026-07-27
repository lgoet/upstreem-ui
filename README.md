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
├─ STYLEGUIDE.md          Konventionen + Checkliste. Zuerst lesen.
├─ core.css               ausgeliefert (CDN) — geteiltes Styling, Prefix up-
├─ core.js                ausgeliefert (CDN) — window.UpstreemCore
├─ urls-table.css         ausgeliefert (CDN) — Komponenten-CSS, Prefix uut-
├─ urls-table.js          ausgeliefert (CDN) — Komponenten-Logik, braucht core.js
├─ bubble/                Loader-Vorlagen für Bubble (NICHT ausgeliefert)
│  └─ urls_table_bubble.html
└─ to-migrate/            alte Bubble-Komponenten, noch NICHT auf Core-Logik (Referenz)
```

- **Root** (`core.*`, `<komponente>.*`): wird von jsDelivr ausgeliefert; der
  Pfad muss zur CDN-URL passen (`@main/core.css` = Root). Prefixe: geteilt `up-`,
  komponenten-spezifisch `uut-` / `udt-` …
- **`core.js`** stellt `window.UpstreemCore` bereit: Farbtabellen, Utils, Icons,
  `resolveBubbleFn`, Stores und die Subsysteme `makeTooltips`, `makeFire`,
  `makePortal`, `placeMenu`, `makeSticky`.
- **`bubble/`**: die HTML-Schnipsel, die ins jeweilige Bubble-HTML-Element
  kommen (Markup + `data-*` + CDN-Includes). Werden nicht ausgeliefert, sind nur
  Kopiervorlagen. Eine pro Komponente.
- **`to-migrate/`**: die noch nicht umgebauten Bubble-Komponenten als
  Ausgangs-Referenz. Aus ihnen entstehen bei der Migration die Root-Dateien
  (`<name>.css`/`.js`) plus ein Loader in `bubble/`. Werden nicht ausgeliefert.

## Wie es zusammenspielt

Im Bubble-HTML-Element steht nur der Loader (`bubble/urls_table_bubble.html`): das
statische Markup mit den dynamischen `data-*`-Bindungen und vier CDN-Includes.
Reihenfolge ist wichtig — Core **vor** Komponente:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@main/core.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@main/urls-table.css">
...markup mit data-* ...
<script src="https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@main/core.js"></script>
<script src="https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@main/urls-table.js"></script>
```

Das Markup + die `data-*`-Attribute bleiben in Bubble, weil dort die dynamischen
Bindungen dranhängen. CSS und JS liegen im Repo und kommen per CDN.

## Ändern & ausliefern

1. Datei im Repo auf `main` bearbeiten / hochladen, „Commit changes".
2. Passende Purge-URL einmal im Browser aufrufen (sofort live; ohne Purge zieht
   `@main` von selbst nach ~12 h):
   ```
   https://purge.jsdelivr.net/gh/lgoet/upstreem-ui@main/core.css
   https://purge.jsdelivr.net/gh/lgoet/upstreem-ui@main/core.js
   https://purge.jsdelivr.net/gh/lgoet/upstreem-ui@main/urls-table.css
   https://purge.jsdelivr.net/gh/lgoet/upstreem-ui@main/urls-table.js
   ```
3. Seite hart neu laden (Strg+Shift+R).

Wenn es stabil ist, statt `@main` einen festen Versions-Tag verwenden
(`@1.0.0`) und nur bei bewussten Updates hochziehen — dann ohne Purge.

## Bubble-Verdrahtung (URLs-Tabelle)

Auf dem `<div class="up-root">` die `data-*` binden:

- `data-instance` — **eindeutig pro Platzierung** (z.B. `ROOTID_[dynamischer Wert]`).
  Mehrere Platzierungen mit derselben id kollidieren im Speicher.
- `data-isdark` — `"yes"`/`"no"` für Dark-Mode.
- `data-brand-name`, `data-brand-logo` — die Hauptmarke (steuert den „… mentioned"-Toggle; leer = Toggle unsichtbar).
- `data-sticky-top` — Pixel-Offset für den Sticky-Header (0 / `"no"` = aus).
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

Gleiches Muster:
1. Referenz in `to-migrate/` lesen (der aktuelle Bubble-Stand der Komponente).
2. `STYLEGUIDE.md` und `urls-table.js` als Vorlage nehmen.
3. Root-Dateien `<name>.css` (eigener Prefix, z.B. `udt-`) + `<name>.js` (nutzt
   `UpstreemCore`) bauen.
4. Einen Loader `bubble/<name>_bubble.html` (Markup + `data-*` + CDN-Includes) anlegen.

Der Core wird wiederverwendet. Nächste Kandidaten: `domains-table.*` (aus
`to-migrate/`, sehr ähnlich zur URLs-Tabelle), danach ein gemeinsamer **Chart-Core**
aus den Chart-Komponenten in `to-migrate/`.
