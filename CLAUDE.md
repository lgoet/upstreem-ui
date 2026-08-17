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
```

Beide müssen sauber sein. `.check_reinvention.py` meldet Verdachtsfälle, keine Gewissheiten —
jeden Treffer entweder beheben oder mit einem Satz begründen, warum er hier richtig ist.

---

## 1. Core-Bauteile: verwenden oder ganz lassen

Es gibt **249** `.up-*`/`.vc-*`-Klassen. Ein Bauteil ist ein Paket aus Geometrie: Höhe, Polsterung,
Radius, Abstände, Schriftgröße. Wer einen Wert daraus ändert, muss **alle** im selben Verhältnis
mitziehen.

Der Fehler, der sich in dieser Sitzung dreimal wiederholt hat:

```css
/* FALSCH — sprengt die Pille: 15px Text in 24px Höhe stößt an den Rahmen */
.xyz-kpi .up-sent-val { font-size: 15px; }

/* RICHTIG — Faktor 15/13 auf alles */
.xyz-kpi .up-sent      { height: 28px; padding: 0 7px; border-radius: 7px; gap: 7px; }
.xyz-kpi .up-sent-val  { font-size: 15px; }
.xyz-kpi .up-sent-dot  { width: 7px; height: 7px; border-radius: 2.5px; }
```

**Markup in core heißt nicht, dass das Bauteil geteilt ist.** Prüfen, ob die CSS auch in `core.css`
steht — sonst kommen die Zeilen mit den richtigen Klassen heraus, für die es keine Regeln gibt.

**`.up-row` ist ein GRID** mit `grid-template-columns: var(--up-cols)`, kein Flex. Eine Tabelle ohne
dieses Raster braucht eine eigene `display: flex`-Regel, sonst erbt sie die Spalten der zuletzt
definierten Tabelle.

Konflikte über **Spezifität** lösen, nie über Ladereihenfolge (`.up-vartable .up-row.up-vrow`, nicht
`.up-vrow`). Kein `!important`. Farben nur aus `--vc-*`.

---

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
`reset()` löscht `state.error` mit.

Zahlenfelder immer durch `num()`/`toNum()` (gibt `null` statt `NaN`), Listen durch `isArr()` prüfen,
bevor `.map()` darauf läuft. Ein `undefined.map` reißt den ganzen Run-JS-Step mit — also auch die
Setter der anderen Komponenten, die darunter stehen.

Jede Bubble-Doku braucht **beide** Sanitizer-Zeilen (§46):

```javascript
.replace(/:\s*([,}\]])/g, ": null$1")
.replace(/:\s*(yes|no)\s*([,}\]])/g, function(_, v, t){ return ": " + (v === "yes") + t; })
```

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
- Icons kommen aus Feather über `UC.icon(name, strokeWidth)` — nie selbst gezeichnet. Ausnahme nur
  dort, wo `UC` nachweislich nicht im Scope ist; dann mit Begründung im Kommentar.
- Keine Debug-Ausgaben in der ausgelieferten App.
- Fremde Bubble-Vorfahren nie im `z-index` anfassen (hat am 11.08. die App lahmgelegt).
