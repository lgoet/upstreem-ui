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
| Radius | 4 · 6 · 8 · 10 · 12 · 16 · 999 **plus konzentrische Kinder** | `--up-r-xs/s/m/l/xl/2xl/voll` | Primer (3/6/12), Konzentrik-Formel |
| Höhe | 24 · 28 · 32 · 40 · 55 | `--up-h-chip/seg/btn/gross/row` | Primer, identisch (24/28/32/40/48) |
| Dauer | 120 · 200 · 260 | `--up-t-1/2/3` | Material 3 (UI-Band 100–300) |
| Kurve | 2 | `--up-ease`, `--up-ease-auf` | — |
| Tiefe | 4 | `--up-e-1..4` | Atlassian (sunken/default/raised/overlay) |

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

Vier Dinge, die man dabei wissen muss:

- **Konzentrische Radien sind kein Fehler.** Von 763 Radiusangaben liegen 443 auf der Basis und
  **185 auf Basis minus 1** — das sind die konzentrischen Kinder: ein Element mit 1px Rahmen in
  einer 8er-Ecke braucht innen 7, sonst läuft der Spalt zwischen beiden Rundungen ungleich
  breit. Die Regel steht seit langem im STYLEGUIDE (Zeile 424, Logo-Box), sie hatte nur keinen
  Namen. Wirklich falsch sind nur die **35 mit Nachkommastelle**. `.check_skala.py` lässt Basis
  minus 1 durch — die erste Fassung tat das nicht und meldete 185 völlig richtige Werte.

- **Der Schnitt ist ein Bereich, keine Liste.** Geist wird als *variable* Schrift geladen
  (`@import … wght@400..700`), also rendert auch 450 oder 550 wirklich — an 37 Stellen ist genau
  das gewollt. Falsch ist nur, was **außerhalb** von 400–700 liegt: das wird still auf den Rand
  gezogen. So sind am 21.09. 15 Stellen aufgefallen, die wie 600 aussahen, obwohl 650, 700 oder
  750 dastand — zwei davon hatten sogar zwei Stufen gebaut, die beide als 600 herauskamen.
- **Verschachtelte Radien werden gerechnet, dann gerundet:** innen = außen − Innenabstand, danach
  auf die nächste Stufe. Ohne das Runden erzeugt die Regel aus §1 („Faktor auf alles") genau die
  `3.23`, `4.28`, `7.04` und `8.9`, die heute im Bestand stehen.
- **Ausnahmen, die bleiben:** `--up-dd-radius` (14px) für Menüs, `--up-dd-pad`, `--up-dd-gap`,
  `--up-sub-gap`, `--up-focus-w`. Die gab es vorher und sie sind in sich stimmig. Eine Skala mit
  einer benannten Ausnahme ist besser als zwei Skalen nebeneinander.

`.check_skala.py` hält das. Es arbeitet mit einer **Grundlinie** (`.skala_grundlinie.json`): was
am Einführungstag schon dastand, ist als Bestand vermerkt und blockiert nie einen Commit —
gemeldet wird nur, was **dazukommt**. Ein Prüfer, der am ersten Tag tausend Treffer meldet, wird
weggeklickt. Der Bestand (Stand 21.09.: **1295** Angaben — 673 Farbliterale, 318 Schriftgrößen,
268 Dauern, 65 Radien) wird abgebaut, wenn eine Datei ohnehin angefasst wird. Nach dem Aufräumen
einer Datei: `python3 .check_skala.py --grundlinie`.

Er erkennt auch, wenn ein bekannter Wert nur **häufiger** wird: eine 16. Angabe auf `12.5px` in
einer Datei mit 15 im Bestand fällt auf ("Bestand war 15").

Ausgenommen sind `vendor-coloris.min.css` (Fremdcode) und `landing-hero.css` — eine Landingpage
ist kein Dashboard und verträgt eine größere Spreizung; 38px Überschrift ist dort richtig und in
der App falsch. Ebenso gehen **`clamp()` und `calc()` durch**: in `clamp()` stehen neun
Überschriften ganzseitiger Flächen (auth-page, onboarding, ask-mira, prompt-research), die mit
dem Fenster mitwachsen sollen — dieselbe Überlegung; `calc()` rechnet meist aus einem Token und
ist damit schon auf der Skala.


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
- Icons kommen aus Feather über `UC.icon(name, strokeWidth)` — nie selbst gezeichnet. Ausnahme nur
  dort, wo `UC` nachweislich nicht im Scope ist; dann mit Begründung im Kommentar.
- Keine Debug-Ausgaben in der ausgelieferten App.
- Fremde Bubble-Vorfahren nie im `z-index` anfassen (hat am 11.08. die App lahmgelegt).
