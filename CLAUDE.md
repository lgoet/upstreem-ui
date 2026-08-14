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

## 3. Verifikation: gemessen, nicht gelesen

Kein Fix gilt als fertig, bevor er im lokalen Harness (`_h_*.html`, `python3 -m http.server`)
**gemessen** wurde. Nicht "der Code sieht richtig aus".

- **Messinstrument gegentesten.** Ein Wert von 0 oder ein ausbleibender Fehler ist erst dann ein
  Ergebnis, wenn die alte Fassung im selben Aufbau das Gegenteil zeigt. Sonst hat man die eigene
  Messung gemessen. (Zwei Fehlschlüsse in dieser Sitzung: ein 48px breites Browserfenster, das wie
  ein Layoutfehler aussah, und eine gecachte CSS, die den Fix verschluckte.)
- **Cache bumpen** (`?v=…` im Harness), sonst misst man die alte Datei.
- **Nichts annehmen, was messbar ist.** Nicht die Einrückung zählen, um einen Scope zu bestimmen —
  laden und schauen. Nicht vermuten, eine Trennlinie sei verloren — nachsehen, ob der Nachbar
  schon eine hat, sonst stehen am Ende zwei.

Vor jedem Commit zusätzlich `.contract_snapshot.py` / `.contract_diff.py`: **0 Entfernungen.**

---

## 4. Nach jedem Commit, unaufgefordert

1. `git push origin main` als eigener Bash-Block
2. **Commit-gepinnte** jsDelivr-URLs für jede geänderte Datei — nie `@main`
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
